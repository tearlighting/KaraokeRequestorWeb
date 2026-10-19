import { ApiError, apiJson } from '../../lib/api';
import type { ReservationInput } from '../../../../../packages/contracts/src/index';
import type { Song } from '../search/api';

export async function reserve(song: Song | null, singer: string, comment: string): Promise<{ id: number; warnings: string[] }> {
  const form: ReservationInput = {
    filename: song?.name ?? '小休止',
    fullpath: song?.fullpath ?? '',
    singer: singer.trim(),
    comment,
    kind: song ? '動画' : '小休止',
  };
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(form))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const key = 'yukari.pendingSubmission.v1';
  const pending = JSON.parse(localStorage.getItem(key) || 'null') as { fingerprint: string; receipt: string } | null;
  if (pending && pending.fingerprint !== fingerprint) {
    const status = await apiJson('/requests/result', { method: 'POST', body: JSON.stringify({receipt: pending.receipt}) });
    if (status.state !== 'committed') throw new ApiError('上一预约结果未确认。请保持原内容，用原提交凭据重试；不要新建重复预约。');
    localStorage.removeItem(key);
  }
  const receipt = pending?.fingerprint === fingerprint ? pending.receipt : String((await apiJson('/requests/intent', {method:'POST',body:'{}'})).receipt);
  localStorage.setItem(key, JSON.stringify({fingerprint,receipt}));
  const result = await apiJson('/requests', {
    method: 'POST',
    headers: {'X-Yukari-Submission': receipt},
    body: JSON.stringify(form),
  });
  if (typeof result.id !== 'number' || !Number.isSafeInteger(result.id) || result.id <= 0) {
    throw new ApiError('原预约接口未返回有效 newid，未确认预约成功。请先刷新队列。');
  }
  localStorage.removeItem(key);
  return {id: result.id, warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : []};
}
