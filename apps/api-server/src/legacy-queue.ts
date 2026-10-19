import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { BoundaryError } from './errors.js';

const schema = z.object({ v: z.literal(1), aud: z.literal('legacy-queue'), iat: z.number().int(), exp: z.number().int(),
  userid: z.string().regex(/^[a-f0-9-]{36}$/), role: z.enum(['user', 'admin']), ip: z.string().max(256), ua: z.string().max(1024),
  proof: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function verifyQueueTicket(ticket: string, secret: string, ua: string) {
  try {
    if (ticket.length > 4096) throw new Error();
    const parts = ticket.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) throw new Error();
    const expected = createHmac('sha256', secret).update('legacy-queue-v1\0' + parts[0]).digest();
    if (!timingSafeEqual(expected, Buffer.from(parts[1], 'hex'))) throw new Error();
    const value = schema.parse(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')));
    const now = Math.floor(Date.now() / 1000);
    if (value.exp <= now || value.iat > now + 5 || value.iat < now - 45 || value.exp - value.iat > 45 || value.ua !== ua) throw new Error();
    return value;
  } catch { throw new BoundaryError(401, 'LEGACY_QUEUE_UNAUTHORIZED', '旧页面队列授权无效或已过期，请重新加载'); }
}
