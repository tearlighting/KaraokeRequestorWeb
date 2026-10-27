import { DatabaseSync } from 'node:sqlite';
import { isAbsolute, resolve, relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { z } from 'zod';
import { BoundaryError } from './errors.js';
import type { QueueData, LegacyQueueData } from '../../../packages/contracts/src/index.js';

export const queueSchema = z.object({ items: z.array(z.object({ id: z.number().int(), position: z.number().int(), reqorder: z.number().int(),
  display_name: z.string(), songfile: z.string(), singer: z.string(), nowplaying: z.string(), kind: z.string(), keychange: z.number().int() })),
  total: z.number().int(), remaining_count: z.number().int(), has_more: z.boolean(), remaining_seconds: z.number().int() }) satisfies z.ZodType<QueueData>;
export const queueContextSchema = z.object({ database: z.string().min(1), secret_text: z.string(), ip: z.string(), ua: z.string(), role: z.enum(['user', 'admin']) });
export const legacyQueueSchema = queueSchema.extend({ items: z.array(queueSchema.shape.items.element.extend({
  song_name: z.string(), lister_artist: z.string(), lister_work: z.string(), lister_op_ed: z.string(), lister_comment: z.string(),
  comment: z.string(), masked: z.number().int().min(0).max(1), fullpath: z.string(), volume: z.number().int(),
  secret: z.number().int(), loop: z.number().int(), pause: z.number().int(), track: z.number().int(),
  keychange: z.number().int(), audiodelay: z.number().int(), duration: z.number().int(),
})) }) satisfies z.ZodType<LegacyQueueData>;
export type QueueContext = z.infer<typeof queueContextSchema>;
type Row = Record<string, unknown>;
const columns = 'id,songfile,fullpath,singer,comment,kind,reqorder,nowplaying,secret,loop,pause,track,keychange,audiodelay,duration,volume,song_name,lister_artist,lister_work,lister_op_ed,lister_comment,clientip,clientua';
const failure = () => new BoundaryError(503, 'QUEUE_UNAVAILABLE', '队列数据库不可读取、被锁定或结构不兼容；未返回空队列');
export const phpEmpty = (v: unknown) => v === null || v === undefined || v === '' || v === '0' || v === 0 || v === false;
export function integer(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v !== 'string' && typeof v !== 'number') throw failure();
  const value = typeof v === 'number' ? Math.trunc(v) : Math.trunc(Number(v.match(/^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0] || '0'));
  if (!Number.isSafeInteger(value)) throw failure();
  return value;
}

export class QueueRepository {
  constructor(private root: string) { if (!isAbsolute(root)) throw new Error('Queue database root must be absolute'); }
  read(database: string) {
    let db: DatabaseSync | undefined;
    try {
      if (isAbsolute(database) || database.includes('\\')) throw failure();
      const root = realpathSync(this.root);
      const path = realpathSync(resolve(root, database));
      const rel = relative(root, path);
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw failure();
      db = new DatabaseSync(path, { readOnly: true, timeout: 250, allowExtension: false });
      db.exec('PRAGMA query_only=ON; BEGIN');
      const stats = db.prepare(`SELECT COUNT(*) AS total,
        COUNT(CASE WHEN nowplaying IN ('未再生','1') THEN 1 END) AS remaining_count,
        COALESCE(SUM(CASE WHEN nowplaying IN ('未再生','1') AND duration > 0 THEN duration END),0) AS remaining_seconds FROM requesttable`).get()!;
      // Full ordered snapshot is also required for returnusername_self, even on paged requests.
      const rows = db.prepare(`SELECT ${columns} FROM requesttable ORDER BY reqorder DESC`).all();
      db.exec('COMMIT');
      return { stats, rows };
    } catch { throw failure(); }
    finally { db?.close(); }
  }
}

export class QueueService {
  constructor(private repository: QueueRepository) {}
  read(context: QueueContext, limit = 0, offset = 0) {
    const { rows, stats } = this.repository.read(context.database);
    if (rows.some((row) => Object.values(row).some((value) => value instanceof Uint8Array))) throw failure();
    // Original returnusername reverses the entire DESC result and takes the first IP+UA match.
    let myname: unknown = '';
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].clientip === context.ip && rows[i].clientua === context.ua) { myname = rows[i].singer; break; }
    }
    const selected = limit > 0 ? rows.slice(offset, offset + limit) : rows;
    const total = integer(stats.total);
    const items = selected.map((row: Row, index) => {
      const playing = phpEmpty(row.nowplaying) ? '1' : row.nowplaying;
      const secret = !phpEmpty(row.secret) && Number(row.secret) === 1 && (playing === '未再生' || playing === '1');
      const display = secret ? context.secret_text : row.songfile;
      const owner = ((row.clientip ?? '') !== '' && row.clientip === context.ip && row.clientua === context.ua)
        || ((row.singer ?? '') !== '' && row.singer === myname);
      const mask = secret && !owner && context.role !== 'admin';
      const item: Record<string, unknown> = {
        id: integer(row.id), reqorder: integer(row.reqorder), songfile: mask ? display : row.songfile, display_name: display,
        singer: row.singer ?? '', comment: row.comment ?? '', kind: row.kind ?? '', nowplaying: playing,
        masked: mask ? 1 : 0, fullpath: mask ? '' : (row.fullpath ?? ''),
        volume: row.volume !== null && row.volume !== '' ? integer(row.volume) : -1,
        position: total - offset - index,
      };
      for (const name of ['song_name', 'lister_artist', 'lister_work', 'lister_op_ed', 'lister_comment']) item[name] = mask ? '' : (row[name] ?? '');
      for (const name of ['secret', 'loop', 'pause', 'track', 'keychange', 'audiodelay', 'duration']) item[name] = integer(row[name]);
      return item;
    });
    const data = { items, total, remaining_count: integer(stats.remaining_count), remaining_seconds: integer(stats.remaining_seconds),
      has_more: limit > 0 && offset + items.length < total };
    // Preserve the existing unified contract and reject malformed core fields.
    const parsed = legacyQueueSchema.safeParse(data);
    if (!parsed.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '队列记录不符合既有字段契约');
    return parsed.data;
  }
}
