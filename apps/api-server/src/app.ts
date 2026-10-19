import { RequestRepository, RequestService, SubmissionReceipts, verifyLegacySubmission, requestInputSchema, requestContextSchema, normalizeRequest } from './requests.js';
import { QueueMutationRepository, QueueMutationService } from './queue-mutations.js';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z, ZodError } from 'zod';
import { LegacyPhpAdapter } from './legacy.js';
import { SessionStore } from './sessions.js';
import { BoundaryError } from './errors.js';
import { SettingsRepository, SettingsService, settingsSchema } from './settings.js';
import { verifyQueueTicket } from './legacy-queue.js';
import { QueueRepository, QueueService, queueSchema, queueContextSchema } from './queue.js';
import type { AdminSession } from '../../../packages/contracts/src/index.js';
import { PlayerTaskStore, agentAuthorized } from './player-agent.js';

const id = z.coerce.number().int().positive().max(2147483647);
const statusSchema = z.object({ php_version: z.string(), os: z.string(), detected_player: z.string(), playmode: z.number(),
  mpc_reachable: z.boolean(), foobar_reachable: z.boolean(), playback: z.object({}).passthrough().nullable(), password_configured: z.boolean() });
const success = <T>(data: T) => ({ ok: true as const, data });
function legacyParse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原 PHP 响应不符合预期字段：' + parsed.error.issues.map((item) => item.path.join('.')).join(', '));
  return parsed.data;
}
export interface AppOptions { legacyUrl: string; bridgeToken: string; userOrigins: string[]; adminOrigins: string[]; secureCookies?: boolean; settingsPath?: string; queueRoot?: string; legacyOrigins?: string[]; playerAgentToken?: string; playerStatePath?: string }
export function createApp(options: AppOptions) {
  // No request/body logging: login secrets, session cookies and service tokens never enter logs.
  const app = Fastify({ logger: false, bodyLimit: 65536, trustProxy: false });
  const legacy = new LegacyPhpAdapter(options.legacyUrl, options.bridgeToken);
  const sessions = new SessionStore(options.secureCookies);
  const receipts = new SubmissionReceipts(options.bridgeToken);
  const requests = new RequestService(new RequestRepository(options.queueRoot || '/run/legacy-db'), receipts);
  const mutations = new QueueMutationService(new QueueMutationRepository(options.queueRoot || '/run/legacy-db'));
  const queue = new QueueService(new QueueRepository(options.queueRoot || '/run/legacy-db'));
  const settings = new SettingsService(new SettingsRepository(options.settingsPath || '/run/legacy-settings/config.ini'));
  const playerTasks = new PlayerTaskStore(options.playerStatePath || join(tmpdir(), 'yukari-player-agent', randomUUID(), 'state.json'));
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && (request.url === '/health' || request.url === '/api/v1/meta/health')) return;
    const legacyQueue = request.url.split('?')[0] === '/api/v1/legacy/queue';
    const legacyReorder = request.url.split('?')[0] === '/api/v1/admin/queue/reorder';
    const agentRoute = request.url.split('?')[0].startsWith('/api/v1/agent/');
    if (request.headers.authorization && !(agentRoute && request.headers.authorization.startsWith('Bearer '))) throw new BoundaryError(400, 'BASIC_NOT_ACCEPTED', '新 API 不接受 Basic 凭据，请使用登录会话');
    const admin = request.url.startsWith('/api/v1/admin') || request.url.startsWith('/api/v1/settings') || request.url.startsWith('/api/v1/playback/control');
    const allowed = legacyQueue || legacyReorder ? [...options.adminOrigins,...(options.legacyOrigins || ['http://127.0.0.1:8080', 'http://localhost:8080'])] : admin ? options.adminOrigins : [...options.userOrigins, ...options.adminOrigins];
    if (request.headers.origin && !allowed.includes(request.headers.origin)) throw new BoundaryError(403, 'ORIGIN_DENIED', '不允许该来源请求');
    if (!agentRoute && request.headers['x-yukari-client'] !== '1') throw new BoundaryError(403, 'CSRF_HEADER_REQUIRED', '缺少客户端请求标记');
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
  const health = async () => success({ service: 'yukari-api', version: 'v1' });
  app.get('/health', health);
  // Public infrastructure metadata only: no PHP call, session or user data.
  app.get('/api/v1/meta/health', health);

  app.get('/api/v1/legacy/queue', async (request, reply) => {
    const ticket = String(request.headers['x-yukari-legacy-queue'] || '');
    const value = verifyQueueTicket(ticket, options.bridgeToken, request.headers['user-agent'] || '');
    const context = legacyParse(queueContextSchema, await legacy.call('legacy-queue-context', { role: 'user', userid: value.userid }, { ticket }));
    if (context.role !== value.role || context.ip !== value.ip || context.ua !== value.ua) throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const paging = z.object({ limit: z.coerce.number().int().min(0).max(2147483647).default(0), offset: z.coerce.number().int().min(0).max(2147483647).default(0) }).strict().parse(request.query);
    const data = queue.read(context, paging.limit, paging.offset);
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });

  app.post('/api/v1/user/session', async (request, reply) => {
    const body = z.object({ easypass: z.string().max(512).optional() }).strict().parse(request.body);
    // Preserve Legacy's one-year YkariUserID so PHP pages and Node requests
    // share the same history identity without trusting it as an auth session.
    const identity = { role: 'user' as const, userid: sessions.legacyUserId(request) || randomUUID() };
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
  app.get('/api/v1/queue', async (request, reply) => {
    const identity = sessions.get(request, 'user');
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'user') throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const data = queueSchema.parse(queue.read(context));
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });
  app.get('/api/v1/playback', async (request) => success(legacyParse(z.object({ playing: z.boolean() }).passthrough(), await legacy.call('playback', sessions.get(request, 'user')))));
  // Public view deliberately omits task IDs, filenames, paths and control material.
  app.get('/api/v1/playback/agent', async (request) => {
    sessions.get(request, 'user');
    const value = playerTasks.status();
    return success({ connected: value.connected, playback: value.playback, active: Boolean(value.task && ['claimed','playing'].includes(value.task.state)) });
  });
  app.get('/api/v1/admin/player-agent', async (request) => { sessions.get(request, 'admin'); return success(playerTasks.status()); });
  app.post('/api/v1/admin/player-agent/test', async (request) => {
    sessions.get(request, 'admin'); z.object({}).strict().parse(request.body);
    if (!options.playerAgentToken) throw new BoundaryError(503, 'PLAYER_AGENT_NOT_CONFIGURED', 'Player Agent 未配置');
    return success(playerTasks.createTest());
  });
  app.post('/api/v1/admin/player-agent/control', async (request) => {
    sessions.get(request, 'admin');
    const body = z.object({ action: z.enum(['pause','resume','stop']) }).strict().parse(request.body);
    if (!options.playerAgentToken) throw new BoundaryError(503, 'PLAYER_AGENT_NOT_CONFIGURED', 'Player Agent 未配置');
    return success(playerTasks.control(body.action));
  });
  const agentIdentity = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), testReady: z.boolean().optional() }).strict();
  const requireAgent = (request: { headers: { authorization?: string } }) => {
    if (!options.playerAgentToken || !agentAuthorized(request.headers.authorization, options.playerAgentToken)) throw new BoundaryError(401, 'PLAYER_AGENT_UNAUTHORIZED', 'Player Agent 凭据无效');
  };
  app.post('/api/v1/agent/next', async (request) => {
    requireAgent(request); const body = agentIdentity.parse(request.body); return success(playerTasks.next(body.agentId, body.testReady === true));
  });
  app.post('/api/v1/agent/report', async (request) => {
    requireAgent(request);
    const body = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), taskId: z.string().uuid().optional(),
      state: z.enum(['claimed','playing','completed','failed']).optional(), playback: z.enum(['idle','starting','playing','paused','stopped','unavailable']),
      testReady: z.boolean().optional(), file: z.string().max(255).optional(), error: z.string().max(300).optional() }).strict().parse(request.body);
    return success(playerTasks.report(body.agentId, body));
  });
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
  app.post('/api/v1/internal/legacy-request', async (request,reply) => {
    const {envelope}=z.object({envelope:z.string().max(60000)}).strict().parse(request.body);
    const claim=verifyLegacySubmission(envelope,options.bridgeToken);
    const identity={role:'user' as const,userid:claim.userid,proof:claim.proof};
    const context=legacyParse(requestContextSchema,await legacy.call('request-context',identity,{fullpath:typeof claim.input.fullpath==='string'?claim.input.fullpath:'',username:claim.username||''}));
    context.ip=claim.ip;context.ua=claim.ua;context.userid=claim.userid;
    if(claim.mode==='result') {
      const result=requests.lookup(context.database,claim.receipt,claim.userid);
      return success({state:result?'committed':'not_found',result});
    }
    const value=await requests.submit(context,requestInputSchema.parse(claim.input),claim.receipt,()=>legacy.call('queue-notify',identity));
    reply.header('X-Yukari-Owner','node-request-create');
    return reply.code(201).send(success(value.result));
  });
  app.post('/api/v1/requests/intent', async request => {
    await legacy.call('queue-context', sessions.get(request, 'user'));
    return success({receipt:receipts.issue()});
  });
  app.post('/api/v1/requests/result', async request => {
    const body=z.object({receipt:z.string().max(256)}).strict().parse(request.body);
    const context=legacyParse(queueContextSchema,await legacy.call('queue-context',sessions.get(request,'user')));
    const result=requests.lookup(context.database,body.receipt,sessions.get(request,'user').userid);
    return success({state:result?'committed':'not_found',result});
  });
  app.post('/api/v1/requests', async (request, reply) => {
    const identity = sessions.get(request, 'user');
    const body = requestInputSchema.parse(request.body);
    const receipt=String(request.headers['x-yukari-submission']||'');
    receipts.verify(receipt);
    let username='';
    try { username=decodeURIComponent((request.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('YkariUsername='))?.slice('YkariUsername='.length)||'').slice(0,64); } catch { username=''; }
    const context=legacyParse(requestContextSchema,await legacy.call('request-context',identity,{fullpath:body.fullpath,username}));
    const value=await requests.submit(context,body,receipt,()=>legacy.call('queue-notify',identity));
    const normalized=normalizeRequest(body);
    if(normalized.singer!==context.nonameusername && normalized.kind!=='小休止' && normalized.singer!=='') reply.header('Set-Cookie',`YkariUsername=${encodeURIComponent(normalized.singer)}; Path=/; SameSite=Lax; Max-Age=5184000${options.secureCookies?'; Secure':''}`);
    reply.header('X-Yukari-Owner','node-request-create');
    return reply.code(201).send(success(value.result));
  });
  app.post('/api/v1/admin/queue/reorder',async(request,reply)=>{
    const identity=sessions.get(request,'admin');
    const body=z.object({ids:z.array(z.number().int().positive().max(2147483647)).max(5000)}).strict().parse(request.body);
    const context=legacyParse(queueContextSchema,await legacy.call('queue-context',identity));
    if(context.role!=='admin')throw new BoundaryError(403,'ROLE_MISMATCH','Admin context required');
    const result=await mutations.reorder(context.database,body.ids,async()=>legacyParse(z.object({notified:z.literal(true)}),await legacy.call('queue-notify',identity)));
    reply.header('X-Yukari-Owner','node-queue-mutation');return success(result);
  });
  app.get('/api/v1/admin/queue', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const data = queueSchema.parse(queue.read(context));
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });
  app.get('/api/v1/admin/status', async (request) => success(legacyParse(statusSchema, await legacy.call('admin-status', sessions.get(request, 'admin')))));
  app.delete('/api/v1/admin/requests/:id', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', 'Admin context required');
    const result = await mutations.execute(context.database, params.id, 'delete', async () => legacyParse(z.object({ notified: z.literal(true) }), await legacy.call('queue-notify', identity)));
    reply.header('X-Yukari-Owner', 'node-queue-mutation');
    return success(z.object({ id: z.literal(params.id), deleted: z.literal(true) }).parse(result));
  });
  app.post('/api/v1/admin/requests/:id/move', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    const body = z.object({ action: z.enum(['up', 'down', 'warikomi']) }).strict().parse(request.body);
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', 'Admin context required');
    const result = await mutations.execute(context.database, params.id, body.action, async () => legacyParse(z.object({ notified: z.literal(true) }), await legacy.call('queue-notify', identity)));
    reply.header('X-Yukari-Owner', 'node-queue-mutation');
    return success(z.object({ id: z.literal(params.id), action: z.literal(body.action), message: z.string() }).parse(result));
  });
  app.get('/api/v1/settings', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    // PHP verifies current credentials/policy only; it never builds settings here.
    const grant = legacyParse(z.object({ config_revision: z.string().regex(/^[a-f0-9]{64}$/) }), await legacy.call('admin-session', identity));
    const data = await settings.read(grant.config_revision);
    // Recheck revocation and concurrent in-place/atomic configuration replacement.
    const after = legacyParse(z.object({ config_revision: z.string() }), await legacy.call('admin-session', identity));
    if (after.config_revision !== data.revision) throw new BoundaryError(503, 'SETTINGS_CHANGED', '配置读取期间发生变化，请重新读取');
    reply.header('X-Yukari-Owner', 'node-settings-read');
    return success(data);
  });
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
