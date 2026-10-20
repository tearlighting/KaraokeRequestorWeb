import { z } from 'zod';
import { BoundaryError } from './errors.js';

export interface LegacyIdentity { role: 'user' | 'admin'; userid: string; proof?: string }
const envelope = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional() });
export class LegacyPhpAdapter {
  constructor(private base: string, private token: string) {
    if (!/^https?:\/\//.test(base) || token.length < 32) throw new Error('Invalid legacy bridge configuration');
  }
  async call<T>(operation: string, identity: LegacyIdentity, body: Record<string, string> = {}): Promise<T> {
    const uncertainWrite = ['request', 'admin-delete', 'admin-move', 'admin-settings-save'].includes(operation);
    let response: Response;
    try {
      response = await fetch(`${this.base}/api/node_bridge.php?operation=${encodeURIComponent(operation)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
          'X-Yukari-Bridge': this.token, 'X-Yukari-Role': identity.role,
          'X-Yukari-User-Id': identity.userid, 'User-Agent': `YukariNode/${identity.userid}`,
          ...(identity.proof ? { 'X-Yukari-Admin-Proof': identity.proof } : {}) },
        body: new URLSearchParams(body), redirect: 'error', signal: AbortSignal.timeout(12000),
      });
    } catch {
      // Never retry a possibly committed write. No browser credentials/cookies forwarded.
      throw new BoundaryError(502, 'LEGACY_UNREACHABLE', '无法连接原 PHP。写操作结果未知，请先重新查询。');
    }
    const text = (await response.text()).trim();
    let value: unknown;
    try { value = JSON.parse(text); }
    catch {
      const reason = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 1200) || '原 PHP 返回空响应';
      throw new BoundaryError(502, 'LEGACY_INVALID_JSON', (uncertainWrite ? '写入结果未知，请查询后再决定是否重试。' : '') + '原 PHP 返回非 JSON：' + reason, response.status, reason);
    }
    const parsed = envelope.safeParse(value);
    if (!parsed.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原 PHP 响应结构不符合已审计契约', response.status);
    if (!response.ok || !parsed.data.ok) {
      const reason = parsed.data.error || `原 PHP HTTP ${response.status}`;
      throw new BoundaryError(response.status >= 400 ? response.status : 502, 'LEGACY_ERROR', (uncertainWrite && response.status >= 500 ? '原 PHP 写入结果未知，请先重新查询。' : '') + reason, response.status, reason);
    }
    if (parsed.data.data === undefined) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原 PHP 缺少 data');
    return parsed.data.data as T;
  }

  /** Fixed service-token scope; PHP implements only the existing queue invalidation helper. */
  async notifyQueueService(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.base}/api/node_bridge.php?operation=queue-notify-service`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Yukari-Bridge': this.token },
        body: new URLSearchParams(), redirect: 'error', signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new BoundaryError(502, 'QUEUE_NOTICE_UNAVAILABLE', '播放状态已提交，但更新通知未确认');
    }
    const text = (await response.text()).trim();
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new BoundaryError(502, 'QUEUE_NOTICE_UNAVAILABLE', '播放状态已提交，但更新通知响应无效'); }
    const parsed = z.object({ ok: z.boolean(), data: z.object({ notified: z.literal(true) }).optional(), error: z.string().optional() }).safeParse(value);
    if (!response.ok || !parsed.success || parsed.data.ok !== true || !parsed.data.data) throw new BoundaryError(502, 'QUEUE_NOTICE_UNAVAILABLE', '播放状态已提交，但更新通知未确认');
  }
}
