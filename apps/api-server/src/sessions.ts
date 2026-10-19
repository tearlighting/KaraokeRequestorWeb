import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { BoundaryError } from './errors.js';
import type { LegacyIdentity } from './legacy.js';

interface Session extends LegacyIdentity { expires: number }
export class SessionStore {
  private sessions = new Map<string, Session>();
  private failures = new Map<string, { count: number; reset: number }>();
  constructor(private secure = false) {}
  private key(token: string) { return createHash('sha256').update(token).digest('hex'); }
  cookieName(role: 'user' | 'admin') { return role === 'admin' ? 'YukariAdminSession' : 'YukariUserSession'; }
  private cookie(request: FastifyRequest, role: 'user' | 'admin') {
    return (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(this.cookieName(role) + '='))?.split('=')[1] || '';
  }
  legacyUserId(request: FastifyRequest) {
    const value=(request.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('YkariUserID='))?.slice('YkariUserID='.length)||'';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:'';
  }
  get(request: FastifyRequest, role: 'user' | 'admin'): Session {
    const value = this.sessions.get(this.key(this.cookie(request, role)));
    if (!value || value.role !== role || value.expires < Date.now()) throw new BoundaryError(401, 'UNAUTHENTICATED', '需要有效的' + (role === 'admin' ? '管理' : '用户') + '会话');
    return value;
  }
  create(reply: FastifyReply, identity: LegacyIdentity) {
    for (const [key, session] of this.sessions) if (session.expires < Date.now()) this.sessions.delete(key);
    if (this.sessions.size >= 10000) throw new BoundaryError(503, 'SESSION_CAPACITY', '会话数量已达上限');
    const token = randomBytes(32).toString('base64url');
    const seconds = identity.role === 'admin' ? 3600 : 43200;
    this.sessions.set(this.key(token), { ...identity, expires: Date.now() + seconds * 1000 });
    const cookies=[`${this.cookieName(identity.role)}=${token}; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=${seconds}${this.secure ? '; Secure' : ''}`];
    if(identity.role==='user') cookies.push(`YkariUserID=${identity.userid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${this.secure ? '; Secure' : ''}`);
    reply.header('Set-Cookie',cookies);
  }
  remove(request: FastifyRequest, reply: FastifyReply, role: 'user' | 'admin') {
    this.sessions.delete(this.key(this.cookie(request, role)));
    reply.header('Set-Cookie', `${this.cookieName(role)}=; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=0${this.secure ? '; Secure' : ''}`);
  }
  loginAttempt(ip: string) {
    const now = Date.now();
    for (const [key, value] of this.failures) if (value.reset < now) this.failures.delete(key);
    const value = this.failures.get(ip) || { count: 0, reset: now + 900000 };
    if (value.count >= 10) throw new BoundaryError(429, 'LOGIN_RATE_LIMIT', '登录尝试过多，请稍后重试');
    if (this.failures.size > 1000 && !this.failures.has(ip)) throw new BoundaryError(429, 'LOGIN_RATE_LIMIT', '登录请求过多');
    value.count++; this.failures.set(ip, value);
  }
  loginSucceeded(ip: string) { this.failures.delete(ip); }
}
