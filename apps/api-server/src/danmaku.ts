import { BoundaryError } from './errors.js';
import type { MysqlStore } from './mysql.js';

export type DanmakuMessage = { id: number; text: string; createdAt: number };

/** Ephemeral, bounded live messages. This is intentionally not persisted. */
export class DanmakuBuffer {
  private messages: DanmakuMessage[] = [];
  private nextId = 1;
  private clearVersion = 0;
  private buckets = new Map<string, { tokens: number; updatedAt: number }>();
  private globalTokens = 30;
  private globalUpdatedAt = 0;
  constructor(private readonly now = () => Date.now(), private readonly capacity = 100) {}

  publish(text: string, nickname: string, key: string) {
    const message = normalizeDanmaku(text, nickname);
    const now = this.now();
    if (this.buckets.size > 4096) {
      for (const [id, bucket] of this.buckets) if (now - bucket.updatedAt > 60_000) this.buckets.delete(id);
    }
    const bucket = this.buckets.get(key) || { tokens: 3, updatedAt: now };
    this.globalTokens = Math.min(30, this.globalTokens + Math.max(0, now - this.globalUpdatedAt) / 1000);
    this.globalUpdatedAt = now;
    if (!this.buckets.has(key) && this.buckets.size >= 4096 || this.globalTokens < 1) throw new BoundaryError(429, 'DANMAKU_RATE_LIMITED', 'Live comment limit reached');
    bucket.tokens = Math.min(3, bucket.tokens + Math.max(0, now - bucket.updatedAt) / 2500);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) { this.buckets.set(key, bucket); throw new BoundaryError(429, 'DANMAKU_RATE_LIMITED', 'Please wait before sending another message'); }
    bucket.tokens -= 1;
    this.globalTokens -= 1;
    this.buckets.set(key, bucket);
    this.messages = this.messages.filter(item => now - item.createdAt <= 30_000);
    const item = { id: this.nextId++, text: message, createdAt: now };
    this.messages.push(item);
    if (this.messages.length > this.capacity) this.messages.splice(0, this.messages.length - this.capacity);
    return { accepted: true as const, id: item.id };
  }

  /** Publish a reservation's initial comment after confirmed playback starts.
   * This is server-originated, so it shares the bounded buffer but not visitor rate limits. */
  publishReservationComment(text: string, nickname: string) {
    const body = [...cleanDanmakuText(text)].slice(0, 100).join('');
    const name = [...cleanDanmakuText(nickname)].slice(0, 32).join('');
    if (!body) return { accepted: false as const };
    const now = this.now();
    this.messages = this.messages.filter(item => now - item.createdAt <= 30_000);
    const item = { id: this.nextId++, text: name ? `${name}: ${body}` : body, createdAt: now };
    this.messages.push(item);
    if (this.messages.length > this.capacity) this.messages.splice(0, this.messages.length - this.capacity);
    return { accepted: true as const, id: item.id };
  }

  clear() { this.messages = []; this.clearVersion++; return { cleared: true as const, clearVersion: this.clearVersion }; }

  poll(input: { enabled: boolean; cursor?: number; clearVersion?: number }) {
    const cursor = input.cursor ?? 0;
    const reset = cursor > 0 && cursor >= this.nextId;
    const effectiveCursor = reset ? 0 : cursor;
    const versionChanged = input.clearVersion !== undefined && input.clearVersion !== this.clearVersion;
    return {
      enabled: input.enabled,
      clearVersion: this.clearVersion,
      clear: versionChanged || reset || !input.enabled,
      reset,
      cursor: reset ? 0 : this.nextId - 1,
      messages: input.enabled ? this.messages.filter(item => item.id > effectiveCursor && this.now() - item.createdAt <= 30_000).slice(0, 12) : [],
    };
  }
  status() { return { enabled: false as const }; }
}

export function normalizeDanmaku(text: string, nickname: string) {
  const body = cleanDanmakuText(text);
  const name = cleanDanmakuText(nickname);
  if (!body || [...body].length > 100) throw new BoundaryError(400, 'DANMAKU_INVALID', 'Message must contain 1–100 characters');
  if ([...name].length > 32) throw new BoundaryError(400, 'DANMAKU_INVALID', 'Nickname must be at most 32 characters');
  return name ? `${name}: ${body}` : body;
}

function cleanDanmakuText(value: string) { return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim(); }

export class MysqlDanmakuSettingsRepository {
  constructor(private readonly store: MysqlStore) {}
  async enabled() {
    const rows = await this.store.rows<{ setting_key: string; value_json: unknown } & import('mysql2/promise').RowDataPacket>("SELECT setting_key,value_json FROM app_setting WHERE setting_key='danmaku_enabled'");
    if (!rows[0]) return false;
    const value = typeof rows[0].value_json === 'string' ? JSON.parse(rows[0].value_json) : rows[0].value_json;
    return value === true || value === 1;
  }
  async setEnabled(enabled: boolean) {
    return this.store.transaction(async connection => {
      await connection.execute("INSERT IGNORE INTO app_setting(setting_key,value_json,updated_at,revision) VALUES('danmaku_enabled','false',?,0)", [Math.floor(this.now())]);
      const [rows] = await connection.query<(import('mysql2/promise').RowDataPacket & { revision: number })[]>("SELECT revision FROM app_setting WHERE setting_key='danmaku_enabled' FOR UPDATE");
      const revision = Number(rows[0]?.revision || 0) + 1;
      await connection.execute('UPDATE app_setting SET value_json=?,updated_at=?,revision=? WHERE setting_key=?', [JSON.stringify(enabled), Math.floor(this.now()), revision, 'danmaku_enabled']);
      return { enabled, revision };
    });
  }
  private now() { return Date.now(); }
}
