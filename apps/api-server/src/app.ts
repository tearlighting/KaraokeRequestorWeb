import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { LegacyPhpAdapter } from './legacy.js';
import { SessionStore } from './sessions.js';
import { BoundaryError } from './errors.js';
import type { AdminSession, QueueData, Settings, ReservationInput } from '../../../packages/contracts/src/index.js';

const id = z.coerce.number().int().positive().max(2147483647);
const queueSchema = z.object({ items: z.array(z.object({ id: z.number().int(), position: z.number().int(), reqorder: z.number().int(),
  display_name: z.string(), songfile: z.string(), singer: z.string(), nowplaying: z.string(), kind: z.string() })),
  total: z.number().int(), remaining_count: z.number().int(), has_more: z.boolean(), remaining_seconds: z.number() }) satisfies z.ZodType<QueueData>;
const settingsSchema = z.object({ playmode: z.number().int().min(1).max(5), startvolume: z.number().int().min(0).max(100),
  requestlistactivereload: z.number().int().min(0).max(1), revision: z.string().regex(/^[a-f0-9]{64}$/), changed: z.boolean().optional() }) satisfies z.ZodType<Settings>;
const statusSchema = z.object({ php_version: z.string(), os: z.string(), detected_player: z.string(), playmode: z.number(),
  mpc_reachable: z.boolean(), foobar_reachable: z.boolean(), playback: z.object({}).passthrough().nullable(), password_configured: z.boolean() });
const reservationSchema = z.object({ filename: z.string().min(1).max(2048), fullpath: z.string().max(4096),
  singer: z.string().trim().min(1).max(256), comment: z.string().max(512), kind: z.enum(['動画', '小休止']), secret: z.number().int().min(0).max(1).optional() }).strict() satisfies z.ZodType<ReservationInput>;
const success = <T>(data: T) => ({ ok: true as const, data });
function legacyParse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原 PHP 响应不符合预期字段：' + parsed.error.issues.map((item) => item.path.join('.')).join(', '));
  return parsed.data;
}
export interface AppOptions { legacyUrl: string; bridgeToken: string; userOrigins: string[]; adminOrigins: string[]; secureCookies?: boolean }
export function createApp(options: AppOptions) {
  // No request/body logging: login secrets, session cookies and service tokens never enter logs.
  const app = Fastify({ logger: false, bodyLimit: 16384, trustProxy: false });
  const legacy = new LegacyPhpAdapter(options.legacyUrl, options.bridgeToken);
  const sessions = new SessionStore(options.secureCookies);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (request.url === '/health') return;
    if (request.headers.authorization) throw new BoundaryError(400, 'BASIC_NOT_ACCEPTED', '新 API 不接受 Basic 凭据，请使用登录会话');
    const admin = request.url.startsWith('/api/v1/admin') || request.url.startsWith('/api/v1/settings') || request.url.startsWith('/api/v1/playback/control');
    const allowed = admin ? options.adminOrigins : [...options.userOrigins, ...options.adminOrigins];
    if (request.headers.origin && !allowed.includes(request.headers.origin)) throw new BoundaryError(403, 'ORIGIN_DENIED', '不允许该来源请求');
    if (request.headers['x-yukari-client'] !== '1') throw new BoundaryError(403, 'CSRF_HEADER_REQUIRED', '缺少客户端请求标记');
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method) && !request.headers['content-type']?.startsWith('application/json')) throw new BoundaryError(415, 'JSON_REQUIRED', '新 API 只接受 JSON 写入');
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BoundaryError) return reply.code(error.status).send({ ok: false, error: { code: error.code, message: error.message,
      requestId: request.id, ...(error.legacyStatus ? { legacyStatus: error.legacyStatus } : {}), ...(error.legacyReason ? { legacyReason: error.legacyReason } : {}) } });
    if (error instanceof ZodError) return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.issues.map((item) => `${item.path.join('.')}: ${item.message}`).join('; '), requestId: request.id } });
    if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ ok: false, error: { code: 'INVALID_REQUEST', message: '请求格式无效', requestId: request.id } });
    }
    return reply.code(500).send({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'API 处理失败，写操作请重新查询确认结果', requestId: request.id } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: '接口不存在', requestId: request.id } }));
  app.get('/health', async () => success({ service: 'yukari-api', version: 'v1' }));

  app.post('/api/v1/user/session', async (request, reply) => {
    const body = z.object({ easypass: z.string().max(512).optional() }).strict().parse(request.body);
    const identity = { role: 'user' as const, userid: randomUUID() };
    const grant = legacyParse(z.object({ proof: z.string().length(64) }), await legacy.call('user-auth', identity, { easypass: body.easypass || '' }));
    sessions.create(reply, { ...identity, proof: grant.proof });
    return success({ userId: identity.userid });
  });
  app.post('/api/v1/admin/session', async (request, reply) => {
    sessions.loginAttempt(request.ip);
    const body = z.object({ username: z.literal('admin'), password: z.string().min(1).max(512), easyPass: z.string().max(512).optional() }).strict().parse(request.body);
    const identity = { role: 'admin' as const, userid: randomUUID() };
    const grant = legacyParse(z.object({ proof: z.string().length(64) }), await legacy.call('admin-auth', identity, { username: body.username, password: body.password, easypass: body.easyPass || '' }));
    sessions.create(reply, { ...identity, proof: grant.proof }); sessions.loginSucceeded(request.ip);
    return success<AdminSession>({ username: 'admin', password_configured: true, authProvider: 'legacy' });
  });
  app.get('/api/v1/admin/session', async (request) => {
    await legacy.call('admin-session', sessions.get(request, 'admin'));
    return success<AdminSession>({ username: 'admin', password_configured: true, authProvider: 'legacy' });
  });
  app.delete('/api/v1/admin/session', async (request, reply) => {
    sessions.get(request, 'admin'); sessions.remove(request, reply, 'admin'); return success({ loggedOut: true });
  });
  app.get('/api/v1/capabilities', async (request) => success(legacyParse(z.object({ features: z.record(z.string(), z.boolean()) }).passthrough(), await legacy.call('capabilities', sessions.get(request, 'user')))));
  app.get('/api/v1/queue', async (request) => success(legacyParse(queueSchema, await legacy.call('queue', sessions.get(request, 'user')))));
  app.get('/api/v1/playback', async (request) => success(legacyParse(z.object({ playing: z.boolean() }).passthrough(), await legacy.call('playback', sessions.get(request, 'user')))));
  app.get('/api/v1/search', async (request) => {
    const identity = sessions.get(request, 'user');
    const query = z.object({ backend: z.enum(['everything', 'lister']), keyword: z.string().trim().min(1).max(256) }).strict().parse(request.query);
    if (query.backend === 'everything') {
      const capabilities = legacyParse(z.object({ features: z.object({ everything_search: z.boolean() }) }), await legacy.call('capabilities', identity));
      if (!capabilities.features.everything_search) throw new BoundaryError(503, 'SEARCH_UNAVAILABLE', 'Everything 服务不可用；未将连接失败当作空搜索结果');
    }
    return success(legacyParse(z.object({ total: z.number().nonnegative(), items: z.array(z.record(z.string(), z.unknown())) }).passthrough(),
      await legacy.call(query.backend === 'lister' ? 'lister' : 'search', identity,
        query.backend === 'lister' ? { anyword: query.keyword } : { keyword: query.keyword })));
  });
  app.post('/api/v1/requests', async (request, reply) => {
    const identity = sessions.get(request, 'user');
    const body = reservationSchema.parse(request.body);
    if (body.kind === '動画' && !body.fullpath) throw new BoundaryError(400, 'VALIDATION_ERROR', '歌曲预约需要完整路径');
    const data = legacyParse(z.object({ id: z.number().int().positive() }), await legacy.call('request', identity, { ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])), freesinger: '' }));
    return reply.code(201).send(success(data));
  });
  app.get('/api/v1/admin/queue', async (request) => success(legacyParse(queueSchema, await legacy.call('admin-queue', sessions.get(request, 'admin')))));
  app.get('/api/v1/admin/status', async (request) => success(legacyParse(statusSchema, await legacy.call('admin-status', sessions.get(request, 'admin')))));
  app.delete('/api/v1/admin/requests/:id', async (request) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    return success(legacyParse(z.object({ id: z.literal(params.id), deleted: z.literal(true) }), await legacy.call('admin-delete', identity, { id: String(params.id) })));
  });
  app.post('/api/v1/admin/requests/:id/move', async (request) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    const body = z.object({ action: z.enum(['up', 'down', 'warikomi']) }).strict().parse(request.body);
    return success(legacyParse(z.object({ id: z.literal(params.id), action: z.literal(body.action), message: z.string() }), await legacy.call('admin-move', identity, { id: String(params.id), action: body.action })));
  });
  app.get('/api/v1/settings', async (request) => success(legacyParse(settingsSchema, await legacy.call('admin-settings', sessions.get(request, 'admin')))));
  app.put('/api/v1/settings', async (request) => {
    const identity = sessions.get(request, 'admin');
    const body = settingsSchema.omit({ changed: true }).strict().parse(request.body);
    return success(legacyParse(settingsSchema, await legacy.call('admin-settings-save', identity, Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])))));
  });
  app.post('/api/v1/playback/control', async (request) => {
    const identity = sessions.get(request, 'admin');
    const body = z.object({ player: z.enum(['mpc', 'foobar']), action: z.enum(['play', 'pause', 'playpause', 'stop']) }).strict().parse(request.body);
    return success(legacyParse(z.object({ acknowledged: z.literal(true), player: z.literal(body.player), action: z.literal(body.action), message: z.string() }), await legacy.call('admin-player', identity, body)));
  });
  return app;
}
