import { RequestRepository, RequestService, SubmissionReceipts, verifyLegacySubmission, requestInputSchema, requestContextSchema, normalizeRequest } from './requests.js';
import { QueueMutationRepository, QueueMutationService } from './queue-mutations.js';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { z, ZodError } from 'zod';
import { LegacyPhpAdapter } from './legacy.js';
import { SessionStore } from './sessions.js';
import { BoundaryError } from './errors.js';
import { SettingsRepository, SettingsService, settingsSchema } from './settings.js';
import { verifyQueueTicket } from './legacy-queue.js';
import { QueueRepository, QueueService, queueSchema, adminQueueSchema, queueContextSchema } from './queue.js';
import type { AdminSession, MpvControlInput } from '../../../packages/contracts/src/index.js';
import { PlayerTaskStore, agentAuthorized } from './player-agent.js';
import { QueueAutoplayOwner, QueueAutoplayRepository, QueueAutoplayService } from './queue-autoplay.js';
import { PlaybackTaskRepository } from './playback-tasks.js';
import { MediaCheckCoordinator, type MediaCheckResult } from './media-checks.js';
import { AgentSearchCoordinator } from './agent-search.js';
import { MysqlConnectionEntryRepository, MysqlParticipantRepository, MysqlPlaybackRepository, MysqlQueueMutationRepository, MysqlQueueRepository, MysqlRequestRepository, MysqlRequestService, MysqlSettingsRepository, reservationViewState } from './mysql-domain.js';
import type { MysqlStore } from './mysql.js';
import { DanmakuBuffer, MysqlDanmakuSettingsRepository } from './danmaku.js';

const id = z.coerce.number().int().positive().max(2147483647);
const statusSchema = z.object({ php_version: z.string(), os: z.string(), detected_player: z.string(), playmode: z.number(),
  mpc_reachable: z.boolean(), foobar_reachable: z.boolean(), playback: z.object({}).passthrough().nullable(), password_configured: z.boolean() });
const success = <T>(data: T) => ({ ok: true as const, data });
export function isAllowedUserLanOrigin(origin: string, forwardedHost: string, proxyMarker: string | undefined, port = 8181): boolean {
  if (proxyMarker !== '1') return false;
  try {
    const parsed = new URL(origin);
    const octets = parsed.hostname.split('.').map(Number);
    const privateIpv4 = octets.length === 4 && octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255)
      && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
    return parsed.protocol === 'http:' && parsed.port === String(port) && parsed.host === forwardedHost.toLowerCase()
      && parsed.pathname === '/' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password && privateIpv4;
  } catch { return false; }
}
export function isAllowedAdminLanOrigin(origin: string, forwardedHost: string, proxyMarker: string | undefined, port = 8181): boolean {
  if (proxyMarker !== '1') return false;
  try {
    const parsed = new URL(origin);
    const octets = parsed.hostname.split('.').map(Number);
    const privateIpv4 = octets.length === 4 && octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255)
      && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
    return parsed.protocol === 'http:' && parsed.port === String(port) && parsed.host === forwardedHost.toLowerCase()
      && parsed.pathname === '/' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password && privateIpv4;
  } catch { return false; }
}
export function normalizePublicUserUrl(value:string):string {
  let parsed:URL;try{parsed=new URL(value.trim());}catch{throw new BoundaryError(400,'PUBLIC_ENTRY_URL_INVALID','公开入口必须是完整的 HTTPS 用户端 URL');}
  const ip=/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)||parsed.hostname.includes(':');
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!['/','/user','/user/'].includes(parsed.pathname)||!parsed.hostname||parsed.hostname==='localhost'||parsed.hostname.endsWith('.localhost')||ip)
    throw new BoundaryError(400,'PUBLIC_ENTRY_URL_INVALID','公开入口必须使用域名 HTTPS，并指向站点根路径或 /user/；不能包含凭据、查询参数或片段');
  return `${parsed.origin}/user/`;
}
const safeMpvLabel=z.string().max(96).refine(value=>!/[\\/\u0000-\u001f]/.test(value)&&!/^(?:[a-z]:|\\\\)/i.test(value));
const mpvTrackSchema=z.object({id:z.number().int().nonnegative(),title:safeMpvLabel.optional(),language:safeMpvLabel.optional(),codec:safeMpvLabel.optional(),selected:z.boolean()}).strict();
const safeMediaName=z.string().max(255).regex(/^[^/\\\u0000-\u001f]*$/);
  const mpvStatusSchema=z.object({connected:z.boolean(),state:z.enum(['idle','playing','paused','stopped','unavailable']),file:safeMediaName.optional(),duration:z.number().finite().nonnegative().optional(),position:z.number().finite().nonnegative().optional(),volume:z.number().finite().min(0).max(130).optional(),muted:z.boolean().optional(),audioDelay:z.number().finite().optional(),fullscreen:z.boolean().optional(),keySemitones:z.number().int().min(-24).max(24).optional(),keyChangeAvailable:z.boolean().optional(),audioTracks:z.array(mpvTrackSchema).max(64),selectedAudioTrackId:z.number().int().nonnegative().optional(),subtitleTracks:z.array(mpvTrackSchema).max(64),selectedSubtitleTrackId:z.number().int().nonnegative().optional(),error:z.enum(['MPV_IPC_UNAVAILABLE','MPV_STATUS_UNAVAILABLE']).optional()}).strict();
function legacyParse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原 PHP 响应不符合预期字段：' + parsed.error.issues.map((item) => item.path.join('.')).join(', '));
  return parsed.data;
}
export interface AppOptions { legacyUrl: string; bridgeToken: string; userOrigins: string[]; adminOrigins: string[]; secureCookies?: boolean; settingsPath?: string; queueRoot?: string; queueDatabase?: string; nodeAutoplay?: boolean; agentSearchEnabled?: boolean; legacyOrigins?: string[]; playerAgentToken?: string; playerStatePath?: string; userLanPort?: number; adminLanPort?: number; mysqlStore?: MysqlStore }
export function createApp(options: AppOptions) {
  // No request/body logging: login secrets, session cookies and service tokens never enter logs.
  const app = Fastify({ logger: false, bodyLimit: 65536, trustProxy: false });
  const legacy = new LegacyPhpAdapter(options.legacyUrl, options.bridgeToken);
  const sessions = new SessionStore(options.secureCookies);
  const receipts = new SubmissionReceipts(options.bridgeToken);
  const requests = new RequestService(new RequestRepository(options.queueRoot || '/run/legacy-db'), receipts);
  const mysqlRequests = options.mysqlStore ? new MysqlRequestRepository(options.mysqlStore) : undefined;
  const mysqlParticipants = options.mysqlStore ? new MysqlParticipantRepository(options.mysqlStore) : undefined;
  const mysqlRequestService = mysqlRequests ? new MysqlRequestService(mysqlRequests, receipts) : undefined;
  const mysqlQueue = options.mysqlStore ? new MysqlQueueRepository(options.mysqlStore) : undefined;
  const mysqlMutations = options.mysqlStore ? new MysqlQueueMutationRepository(options.mysqlStore) : undefined;
  const mysqlPlayback = options.mysqlStore ? new MysqlPlaybackRepository(options.mysqlStore) : undefined;
  const mutations = new QueueMutationService(new QueueMutationRepository(options.queueRoot || '/run/legacy-db'));
  const queue = new QueueService(new QueueRepository(options.queueRoot || '/run/legacy-db'));
  const autoplay = new QueueAutoplayService(new QueueAutoplayRepository(options.queueRoot || '/run/legacy-db'));
  const autoplayOwner = new QueueAutoplayOwner(options.queueRoot || '/run/legacy-db');
  const playbackTasks = new PlaybackTaskRepository(options.queueRoot || '/run/legacy-db');
  const playbackDatabase = options.queueDatabase || 'request.db';
  app.addHook('onReady', async () => { if(options.mysqlStore)await options.mysqlStore.ping(); if(mysqlPlayback){await mysqlPlayback.requireSchema();await mysqlPlayback.recoverOnStartup();if(await mysqlPlayback.current())if(!autoplayOwner.active())autoplayOwner.acquire();}else if(options.nodeAutoplay){playbackTasks.requireSchema(playbackDatabase);playbackTasks.recoverOnStartup(playbackDatabase);if(playbackTasks.current(playbackDatabase)&&!autoplayOwner.active())autoplayOwner.acquire();} });
  if(options.mysqlStore)app.addHook('onClose',async()=>options.mysqlStore!.close());
  const settings = new SettingsService(new SettingsRepository(options.settingsPath || '/run/legacy-settings/config.ini'));
  const mysqlSettings = options.mysqlStore ? new MysqlSettingsRepository(options.mysqlStore) : undefined;
  const mysqlConnectionEntry = options.mysqlStore ? new MysqlConnectionEntryRepository(options.mysqlStore) : undefined;
  const danmaku = new DanmakuBuffer();
  const mysqlDanmaku = options.mysqlStore ? new MysqlDanmakuSettingsRepository(options.mysqlStore) : undefined;
  const readCurrentSettings = async () => mysqlSettings ? settingsSchema.parse(await mysqlSettings.read()) : settings.readCurrent();
  const playerTasks = new PlayerTaskStore(options.playerStatePath || join(tmpdir(), 'yukari-player-agent', randomUUID(), 'state.json'));
  const mediaChecks = new MediaCheckCoordinator();
  const agentSearch = new AgentSearchCoordinator();
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && (request.url === '/health' || request.url === '/api/v1/meta/health')) return;
    const legacyQueue = request.url.split('?')[0] === '/api/v1/legacy/queue';
    const legacyReorder = request.url.split('?')[0] === '/api/v1/admin/queue/reorder';
    const entryProbe = request.url.split('?')[0] === '/api/v1/user/entry-probe' && request.method === 'GET';
    const agentRoute = request.url.split('?')[0].startsWith('/api/v1/agent/');
    if (request.headers.authorization && !(agentRoute && request.headers.authorization.startsWith('Bearer '))) throw new BoundaryError(400, 'BASIC_NOT_ACCEPTED', '新 API 不接受 Basic 凭据，请使用登录会话');
    const admin = request.url.startsWith('/api/v1/admin') || request.url.startsWith('/api/v1/settings') || request.url.startsWith('/api/v1/playback/control');
    const allowed = legacyQueue || legacyReorder ? [...options.adminOrigins,...(options.legacyOrigins || ['http://127.0.0.1:8180', 'http://localhost:8180'])] : admin ? options.adminOrigins : [...options.userOrigins, ...options.adminOrigins];
    if (!entryProbe && request.headers.origin && !allowed.includes(request.headers.origin)) {
      const forwardedHost = request.headers['x-forwarded-host'];
      const proxyMarker = request.headers['x-yukari-user-lan-proxy'];
      const validLanOrigin = !admin && !legacyQueue && !legacyReorder && typeof forwardedHost === 'string'
        && isAllowedUserLanOrigin(request.headers.origin, forwardedHost, typeof proxyMarker === 'string' ? proxyMarker : undefined, options.userLanPort || 8181);
      const validPublicOrigin = !admin && !legacyQueue && !legacyReorder && mysqlConnectionEntry
        ? await mysqlConnectionEntry.allowsPublicOrigin(request.headers.origin,typeof forwardedHost==='string'?forwardedHost:undefined,typeof proxyMarker==='string'?proxyMarker:undefined)
        : false;
      const adminProxyMarker = request.headers['x-yukari-admin-lan-proxy'];
      const validAdminLanOrigin = admin && typeof forwardedHost === 'string'
        && isAllowedAdminLanOrigin(request.headers.origin, forwardedHost, typeof adminProxyMarker === 'string' ? adminProxyMarker : undefined, options.adminLanPort || 8181);
      if (!validLanOrigin && !validPublicOrigin && !validAdminLanOrigin) throw new BoundaryError(403, 'ORIGIN_DENIED', '不允许该来源请求');
    }
    if (!entryProbe && !agentRoute && request.headers['x-yukari-client'] !== '1') throw new BoundaryError(403, 'CSRF_HEADER_REQUIRED', '缺少客户端请求标记');
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

  app.get('/api/v1/danmaku/status', async () => {
    if (!mysqlDanmaku) throw new BoundaryError(503, 'DANMAKU_UNAVAILABLE', 'Live comments require MySQL mode');
    return success({ enabled: await mysqlDanmaku.enabled() });
  });
  app.post('/api/v1/danmaku', async (request) => {
    if (!mysqlDanmaku) throw new BoundaryError(503, 'DANMAKU_UNAVAILABLE', 'Live comments require MySQL mode');
    if (!(await mysqlDanmaku.enabled())) throw new BoundaryError(409, 'DANMAKU_DISABLED', 'Live comments are currently disabled');
    const body = z.object({ text: z.string().max(400), nickname: z.string().max(128).optional().default('') }).strict().parse(request.body);
    const proxy = request.headers['x-yukari-user-lan-proxy'] === '1';
    const forwarded = typeof request.headers['x-forwarded-for'] === 'string' ? request.headers['x-forwarded-for'].split(',')[0]?.trim() : '';
    const key = proxy && forwarded && /^[0-9a-f:.]{3,64}$/i.test(forwarded) ? forwarded : request.ip;
    return success({ ...danmaku.publish(body.text, body.nickname, key), requestId: request.id });
  });
  app.post('/api/v1/agent/danmaku/poll', async (request) => {
    requireAgent(request);
    const body = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), cursor: z.number().int().nonnegative().default(0), clearVersion: z.number().int().nonnegative().default(0) }).strict().parse(request.body);
    const live = playerTasks.mpvStatus();
    if (!live.connected || live.agentId !== body.agentId) throw new BoundaryError(401, 'PLAYER_AGENT_IDENTITY_MISMATCH', 'This Agent is not the currently authenticated player');
    return success(danmaku.poll({ enabled: mysqlDanmaku ? await mysqlDanmaku.enabled() : false, cursor: body.cursor, clearVersion: body.clearVersion }));
  });
  app.get('/api/v1/admin/danmaku/settings', async (request) => {
    sessions.get(request, 'admin');
    if (!mysqlDanmaku) throw new BoundaryError(503, 'DANMAKU_UNAVAILABLE', 'Live comment settings require MySQL mode');
    return success({ enabled: await mysqlDanmaku.enabled() });
  });
  app.put('/api/v1/admin/danmaku/settings', async (request) => {
    sessions.get(request, 'admin');
    if (!mysqlDanmaku) throw new BoundaryError(503, 'DANMAKU_UNAVAILABLE', 'Live comment settings require MySQL mode');
    const body = z.object({ enabled: z.boolean() }).strict().parse(request.body);
    const saved = await mysqlDanmaku.setEnabled(body.enabled);
    if (!body.enabled) danmaku.clear();
    return success(saved);
  });
  app.post('/api/v1/admin/danmaku/clear', async (request) => {
    sessions.get(request, 'admin');
    return success(danmaku.clear());
  });

  app.get('/api/v1/legacy/queue', async (request, reply) => {
    const ticket = String(request.headers['x-yukari-legacy-queue'] || '');
    const value = verifyQueueTicket(ticket, options.bridgeToken, request.headers['user-agent'] || '');
    const context = legacyParse(queueContextSchema, await legacy.call('legacy-queue-context', { role: 'user', userid: value.userid }, { ticket }));
    if (context.role !== value.role || context.ip !== value.ip || context.ua !== value.ua) throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const paging = z.object({ limit: z.coerce.number().int().min(0).max(2147483647).default(0), offset: z.coerce.number().int().min(0).max(2147483647).default(0) }).strict().parse(request.query);
    const data = mysqlQueue ? await mysqlQueue.read(context,paging.limit,paging.offset,true) : queue.read(context, paging.limit, paging.offset);
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });

  app.post('/api/v1/user/session', async (request, reply) => {
    const body = z.object({ easypass: z.string().max(512).optional() }).strict().parse(request.body);
    // Preserve Legacy's one-year YkariUserID so PHP pages and Node requests
    // share the same history identity without trusting it as an auth session.
    const identity = { role: 'user' as const, userid: sessions.legacyUserId(request) || randomUUID() };
    const grant = legacyParse(z.object({ proof: z.string().length(64) }), await legacy.call('user-auth', identity, { easypass: body.easypass || '' }));
    sessions.create(reply, { ...identity, proof: grant.proof },request.headers.origin?.startsWith('https://'));
    return success({ userId: identity.userid });
  });
  app.post('/api/v1/admin/session', async (request, reply) => {
    sessions.loginAttempt(request.ip);
    const body = z.object({ username: z.literal('admin'), password: z.string().min(1).max(512), easyPass: z.string().max(512).optional() }).strict().parse(request.body);
    const identity = { role: 'admin' as const, userid: randomUUID() };
    const grant = legacyParse(z.object({ proof: z.string().length(64) }), await legacy.call('admin-auth', identity, { username: body.username, password: body.password, easypass: body.easyPass || '' }));
    sessions.create(reply, { ...identity, proof: grant.proof },request.headers.origin?.startsWith('https://')); sessions.loginSucceeded(request.ip);
    return success<AdminSession>({ username: 'admin', password_configured: true, authProvider: 'legacy' });
  });
  app.get('/api/v1/admin/session', async (request) => {
    await legacy.call('admin-session', sessions.get(request, 'admin'));
    return success<AdminSession>({ username: 'admin', password_configured: true, authProvider: 'legacy' });
  });
  app.delete('/api/v1/admin/session', async (request, reply) => {
    sessions.get(request, 'admin'); sessions.remove(request, reply, 'admin'); return success({ loggedOut: true });
  });
  app.get('/api/v1/user/profile',async request=>{const identity=sessions.get(request,'user');if(!mysqlParticipants)throw new BoundaryError(503,'PARTICIPANTS_UNAVAILABLE','Participant profiles require MySQL mode');return success(await mysqlParticipants.profile(identity.userid));});
  app.put('/api/v1/user/profile',async request=>{const identity=sessions.get(request,'user');if(!mysqlParticipants)throw new BoundaryError(503,'PARTICIPANTS_UNAVAILABLE','Participant profiles require MySQL mode');const body=z.object({displayName:z.string().trim().min(1).max(64).refine(value=>!/[\u0000-\u001f\u007f]/.test(value),'Nickname contains unsupported characters')}).strict().parse(request.body);return success(await mysqlParticipants.saveProfile(identity.userid,body.displayName));});
  app.get('/api/v1/user/participants',async request=>{sessions.get(request,'user');if(!mysqlParticipants)throw new BoundaryError(503,'PARTICIPANTS_UNAVAILABLE','Participant profiles require MySQL mode');return success({items:await mysqlParticipants.choices()});});
  app.get('/api/v1/user/reservations',async request=>{const identity=sessions.get(request,'user');if(!mysqlRequests)throw new BoundaryError(503,'USER_HISTORY_UNAVAILABLE','Reservation history requires MySQL mode');const paging=z.object({limit:z.coerce.number().int().min(1).max(50).default(20),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().parse(request.query);const items=await mysqlRequests.listOwned(identity.userid,paging.limit+1,paging.offset);return success({items:items.slice(0,paging.limit).map(item=>({id:Number(item.id),title:item.songfile,singer:item.singer,kind:item.kind,status:reservationViewState(item.nowplaying,item.task_state),position:Number(item.reqorder),requestedAt:Number(item.created_at),playbackState:item.task_state,startedAt:item.started_at===null?null:Number(item.started_at),finishedAt:item.finished_at===null?null:Number(item.finished_at),errorCode:item.error_code})),hasMore:items.length>paging.limit,nextOffset:paging.offset+Math.min(items.length,paging.limit)});});
  app.get('/api/v1/admin/participants',async request=>{sessions.get(request,'admin');if(!mysqlParticipants)throw new BoundaryError(503,'PARTICIPANTS_UNAVAILABLE','Participant profiles require MySQL mode');return success({items:await mysqlParticipants.adminList()});});
  app.put('/api/v1/admin/participants/:id',async request=>{sessions.get(request,'admin');if(!mysqlParticipants)throw new BoundaryError(503,'PARTICIPANTS_UNAVAILABLE','Participant profiles require MySQL mode');const {id:participantId}=z.object({id:z.string().uuid()}).parse(request.params);const body=z.object({displayName:z.string().trim().min(1).max(64).refine(value=>!/[\u0000-\u001f\u007f]/.test(value),'Nickname contains unsupported characters')}).strict().parse(request.body);return success(await mysqlParticipants.rename(participantId,body.displayName));});
  app.get('/api/v1/user/entry-probe',async(request,reply)=>{const nonce=z.string().uuid().parse((request.query as {nonce?:unknown}).nonce);reply.header('Access-Control-Allow-Origin','*').header('Access-Control-Allow-Methods','GET').header('Cross-Origin-Resource-Policy','cross-origin');return success({service:'yukari-user-entry',nonce});});
  app.get('/api/v1/admin/gateway/status',async(request)=>{
    sessions.get(request,'admin');
    const configured=process.env.CLOUDFLARE_TUNNEL_CONFIGURED==='1';
    if(!configured)return success({configured:false,connected:false});
    try{const response=await fetch('http://cloudflared:2000/ready',{signal:AbortSignal.timeout(900)});return success({configured:true,connected:response.ok});}
    catch{return success({configured:true,connected:false});}
  });
  app.get('/api/v1/admin/connection-entry',async(request)=>{sessions.get(request,'admin');const config=await mysqlConnectionEntry?.read();if(!config)throw new BoundaryError(503,'MYSQL_REQUIRED','房间入口设置需要 MySQL 模式');return success(config);});
  app.put('/api/v1/admin/connection-entry',async(request)=>{sessions.get(request,'admin');if(!mysqlConnectionEntry)throw new BoundaryError(503,'MYSQL_REQUIRED','房间入口设置需要 MySQL 模式');const body=z.object({roomName:z.string().trim().max(64).refine(value=>!/[\\/]/.test(value)&&!/[\u0000-\u001f]/.test(value),'房间名不能包含控制字符或路径分隔符'),publicUrl:z.string().trim().max(512).transform(value=>value?normalizePublicUserUrl(value):''),preferredMode:z.enum(['lan','public'])}).strict().parse(request.body);if(body.preferredMode==='public'&&!body.publicUrl)throw new BoundaryError(400,'PUBLIC_ENTRY_REQUIRED','选择公开入口前请先配置 HTTPS 用户端 URL');return success(await mysqlConnectionEntry.save(body));});
  app.get('/api/v1/capabilities', async (request) => {const value=legacyParse(z.object({ features: z.record(z.string(), z.boolean()) }).passthrough(), await legacy.call('capabilities', sessions.get(request, 'user')));if(mysqlConnectionEntry){const entry=await mysqlConnectionEntry.read();const server=typeof value.server==='object'&&value.server!==null?value.server as Record<string,unknown>:{};value.server={...server,room_name:entry.roomName||server.room_name||''};}return success(value);});
  app.get('/api/v1/queue', async (request, reply) => {
    const identity = sessions.get(request, 'user');
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'user') throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const paging = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), offset: z.coerce.number().int().min(0).max(100000).default(0), scope:z.enum(['all','active']).default('all') }).strict().parse(request.query);
    const data = mysqlQueue ? queueSchema.parse(await mysqlQueue.read(context,paging.limit,paging.offset,false,false,paging.scope==='active')) : queueSchema.parse(queue.read(context,paging.limit,paging.offset,paging.scope==='active'));
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });
  app.get('/api/v1/playback', async (request) => { const identity=sessions.get(request,'user'); return options.mysqlStore ? success(await mysqlQueue!.playback()) : success(legacyParse(z.object({ playing: z.boolean() }).passthrough(), await legacy.call('playback', identity))); });
  // Public view deliberately omits task IDs, filenames, paths and control material.
  app.get('/api/v1/playback/agent', async (request) => {
    sessions.get(request, 'user');
    const value = playerTasks.status();
    const formal=mysqlPlayback?await mysqlPlayback.current():playbackTasks.hasSchema(playbackDatabase)?playbackTasks.current(playbackDatabase):undefined;
    const snapshot=playerTasks.mpvStatus(),raw=snapshot.mpv;
    const mpv=raw?{connected:raw.connected,state:raw.state,...(raw.duration!==undefined?{duration:raw.duration}:{}),...(raw.position!==undefined?{position:raw.position}:{}),...(raw.volume!==undefined?{volume:raw.volume}:{}),...(raw.muted!==undefined?{muted:raw.muted}:{}),...(raw.audioDelay!==undefined?{audioDelay:raw.audioDelay}:{}),...(raw.fullscreen!==undefined?{fullscreen:raw.fullscreen}:{}),...(raw.keySemitones!==undefined?{keySemitones:raw.keySemitones}:{}),...(raw.keyChangeAvailable!==undefined?{keyChangeAvailable:raw.keyChangeAvailable}:{}),audioTracks:raw.audioTracks,selectedAudioTrackId:raw.selectedAudioTrackId,subtitleTracks:raw.subtitleTracks,selectedSubtitleTrackId:raw.selectedSubtitleTrackId,...(snapshot.controlAck?{controlAck:snapshot.controlAck}:{})}:null;
    const taskState=formal&&['pending','claimed','playing','uncertain'].includes(String(formal.state))?formal.state as 'pending'|'claimed'|'playing'|'uncertain':null;
    return success({ connected: value.connected, playback: value.playback, active: Boolean(formal&&['claimed','playing'].includes(String(formal.state))), taskState, mpv });
  });
  app.post('/api/v1/playback/mpv-control', async (request) => {
    sessions.get(request, 'admin');
    const body=z.discriminatedUnion('action',[
      z.object({action:z.enum(['pause','resume'])}).strict(),
      z.object({action:z.literal('seek'),position:z.number().finite().nonnegative()}).strict(),
      z.object({action:z.literal('volume'),value:z.number().finite().min(0).max(130)}).strict(),
      z.object({action:z.literal('mute'),value:z.boolean()}).strict(),
      z.object({action:z.literal('audio-track'),trackId:z.number().int().nonnegative()}).strict(),
      z.object({action:z.literal('subtitle-track'),trackId:z.number().int().nonnegative().nullable()}).strict(),
      z.object({action:z.literal('audio-delay'),value:z.number().finite().min(-10).max(10)}).strict(),
      z.object({action:z.literal('key-change'),semitones:z.number().int().min(-6).max(6)}).strict(),
      z.object({action:z.literal('fullscreen'),value:z.boolean()}).strict(),
    ]).parse(request.body);
    const current=mysqlPlayback?await mysqlPlayback.current():playbackTasks.hasSchema(playbackDatabase)?playbackTasks.current(playbackDatabase):undefined;
    if(!current||!['claimed','playing'].includes(String(current.state)))throw new BoundaryError(409,'NO_ACTIVE_QUEUE_PLAYBACK','No active queue playback can be controlled');
    const live=playerTasks.mpvStatus();
    if(!live.connected||!live.agentId||!live.mpv?.connected)throw new BoundaryError(503,'MPV_IPC_UNAVAILABLE','Player Agent or mpv IPC is unavailable');
    if('agentId'in current&&current.agentId!==live.agentId)throw new BoundaryError(409,'STALE_PLAYER_TASK','Active playback belongs to another Agent');
    if(!['playing','paused'].includes(live.mpv.state))throw new BoundaryError(409,'MPV_NOT_PLAYING','mpv has no confirmed active media');
    if(body.action==='pause'||body.action==='resume'){
      const result=mysqlPlayback?await mysqlPlayback.control(body.action):playbackTasks.control(playbackDatabase,body.action);
      return success(result);
    }
    if(body.action==='seek'&&(live.mpv.duration===undefined||body.position>live.mpv.duration))throw new BoundaryError(400,'MPV_INVALID_SEEK','Seek position is outside the current media duration');
    if(body.action==='audio-track'&&!live.mpv.audioTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Audio track is not present in the current media');
    if(body.action==='key-change'&&!live.mpv.keyChangeAvailable)throw new BoundaryError(409,'MPV_KEY_CHANGE_UNAVAILABLE','This mpv build does not have the required pitch filter');
    if(body.action==='subtitle-track'&&body.trackId!==null&&!live.mpv.subtitleTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Subtitle track is not present in the current media');
    const {action,...values}=body;
    const taskId=z.string().uuid().parse(current.id);
    return success(playerTasks.requestMpvControl(live.agentId,taskId,{action,...values} as MpvControlInput));
  });
  // User controls are deliberately limited to the currently confirmed queue
  // task. They cannot start, stop, skip, or target a task supplied by a client.
  app.post('/api/v1/user/player/control', async (request) => {
    sessions.get(request, 'user');
    const body=z.discriminatedUnion('action',[
      z.object({action:z.enum(['pause','resume'])}).strict(),
      z.object({action:z.literal('seek'),position:z.number().finite().nonnegative()}).strict(),
      z.object({action:z.literal('volume'),value:z.number().finite().min(0).max(130)}).strict(),
      z.object({action:z.literal('mute'),value:z.boolean()}).strict(),
      z.object({action:z.literal('audio-track'),trackId:z.number().int().nonnegative()}).strict(),
      z.object({action:z.literal('subtitle-track'),trackId:z.number().int().nonnegative().nullable()}).strict(),
      z.object({action:z.literal('audio-delay'),value:z.number().finite().min(-10).max(10)}).strict(),
      z.object({action:z.literal('key-change'),semitones:z.number().int().min(-6).max(6)}).strict(),
      z.object({action:z.literal('fullscreen'),value:z.boolean()}).strict(),
    ]).parse(request.body);
    const current=mysqlPlayback?await mysqlPlayback.current():playbackTasks.hasSchema(playbackDatabase)?playbackTasks.current(playbackDatabase):undefined;
    if(!current||current.kind!=='queue'||!['claimed','playing'].includes(String(current.state)))throw new BoundaryError(409,'NO_ACTIVE_QUEUE_PLAYBACK','There is no confirmed queue song to control');
    const live=playerTasks.mpvStatus();
    if(!live.connected||!live.agentId||!live.mpv?.connected)throw new BoundaryError(503,'MPV_IPC_UNAVAILABLE','Player Agent or mpv IPC is unavailable');
    if('agentId'in current&&current.agentId!==live.agentId)throw new BoundaryError(409,'STALE_PLAYER_TASK','Active playback belongs to another Agent');
    if(!['playing','paused'].includes(live.mpv.state))throw new BoundaryError(409,'MPV_NOT_PLAYING','mpv has no confirmed active media');
    if(body.action==='pause'||body.action==='resume'){
      const result=mysqlPlayback?await mysqlPlayback.control(body.action):playbackTasks.control(playbackDatabase,body.action);
      return success(result);
    }
    if(body.action==='seek'&&(live.mpv.duration===undefined||body.position>live.mpv.duration))throw new BoundaryError(400,'MPV_INVALID_SEEK','Seek position is outside the current media duration');
    if(body.action==='audio-track'&&!live.mpv.audioTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Audio track is not present in the current media');
    if(body.action==='key-change'&&!live.mpv.keyChangeAvailable)throw new BoundaryError(409,'MPV_KEY_CHANGE_UNAVAILABLE','This mpv build does not have the required pitch filter');
    if(body.action==='subtitle-track'&&body.trackId!==null&&!live.mpv.subtitleTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Subtitle track is not present in the current media');
    const {action,...values}=body;
    return success(playerTasks.requestMpvControl(live.agentId,z.string().uuid().parse(current.id),{action,...values} as MpvControlInput));
  });
  app.get('/api/v1/admin/player-agent', async (request) => {
    sessions.get(request, 'admin');
    const current = mysqlPlayback ? await mysqlPlayback.current() : playbackTasks.hasSchema(playbackDatabase) ? playbackTasks.current(playbackDatabase) : undefined;
    // The production MySQL scheduler is a native implementation. Its presence
    // must not be confused with the old SQLite-only availability check.
    // Autoplay remains unavailable unless explicitly enabled and an Agent
    // credential plus the matching task store are configured.
    const nodeAutoplayAvailable = options.nodeAutoplay === true
      && Boolean(options.playerAgentToken)
      && Boolean(mysqlPlayback || playbackTasks.hasSchema(playbackDatabase));
    const autoplayUnavailableReason = options.nodeAutoplay !== true
      ? 'Disabled by deployment policy (YUKARI_NODE_AUTOPLAY=0)'
      : !options.playerAgentToken ? 'Player Agent authentication is not configured'
      : !mysqlPlayback && !playbackTasks.hasSchema(playbackDatabase) ? 'Playback task storage is unavailable'
      : undefined;
    const schedule=mysqlSettings?await mysqlSettings.scheduling():undefined;
    const base=playerTasks.status();
    return success({ ...base, autoplayEnabled:schedule?.enabled??base.autoplayEnabled, manualMode:schedule?schedule.enabled&&schedule.playmode===2:base.manualMode, manualStartRequested:schedule?.manualStartRequested??base.manualStartRequested, task: current || base.task, nodeOwnsQueue: autoplayOwner.active(), nodeAutoplayAvailable, autoplayUnavailableReason, agentSearchEnabled:options.agentSearchEnabled===true, userLanPort: options.userLanPort || 8181 });
  });
  // Fast live telemetry comes from the Agent heartbeat snapshot only. This route
  // deliberately avoids MySQL so a 1s Admin poll cannot create database writes.
  app.get('/api/v1/admin/player-agent/mpv', async (request) => {
    sessions.get(request, 'admin');
    return success(playerTasks.mpvStatus());
  });
  app.post('/api/v1/admin/player-agent/mpv-control', async (request) => {
    sessions.get(request, 'admin');
    const body=z.discriminatedUnion('action',[
      z.object({taskId:z.string().uuid(),action:z.literal('seek'),position:z.number().finite().nonnegative()}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('volume'),value:z.number().finite().min(0).max(130)}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('mute'),value:z.boolean()}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('audio-track'),trackId:z.number().int().nonnegative()}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('subtitle-track'),trackId:z.number().int().nonnegative().nullable()}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('audio-delay'),value:z.number().finite().min(-10).max(10)}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('key-change'),semitones:z.number().int().min(-6).max(6)}).strict(),
      z.object({taskId:z.string().uuid(),action:z.literal('fullscreen'),value:z.boolean()}).strict(),
    ]).parse(request.body);
    const live=playerTasks.mpvStatus();
    if(!live.connected||!live.agentId||!live.mpv?.connected)throw new BoundaryError(503,'MPV_IPC_UNAVAILABLE','Player Agent or mpv IPC is unavailable');
    const formal=mysqlPlayback?await mysqlPlayback.current():playbackTasks.hasSchema(playbackDatabase)?playbackTasks.current(playbackDatabase):undefined;
    const local=playerTasks.status().task;
    const task=formal&&['claimed','playing'].includes(String(formal.state))?formal:local&&['claimed','playing'].includes(local.state)?local:undefined;
    if(!task||task.id!==body.taskId||('agentId' in task&&task.agentId!==live.agentId))throw new BoundaryError(409,'STALE_PLAYER_TASK','Control is not for the active Agent task');
    if(!['playing','paused'].includes(live.mpv.state))throw new BoundaryError(409,'MPV_NOT_PLAYING','mpv has no confirmed active media');
    if(body.action==='seek'&&(live.mpv.duration===undefined||body.position>live.mpv.duration))throw new BoundaryError(400,'MPV_INVALID_SEEK','Seek position is outside the current media duration');
    if(body.action==='audio-track'&&!live.mpv.audioTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Audio track is not present in the current media');
    if(body.action==='key-change'&&!live.mpv.keyChangeAvailable)throw new BoundaryError(409,'MPV_KEY_CHANGE_UNAVAILABLE','This mpv build does not have the required pitch filter');
    if(body.action==='subtitle-track'&&body.trackId!==null&&!live.mpv.subtitleTracks.some(track=>track.id===body.trackId))throw new BoundaryError(409,'MPV_TRACK_UNAVAILABLE','Subtitle track is not present in the current media');
    const {taskId,...input}=body;
    return success(playerTasks.requestMpvControl(live.agentId,taskId,input));
  });
  app.post('/api/v1/admin/player-agent/launcher',async(request)=>{
    sessions.get(request,'admin');
    const {action}=z.object({action:z.enum(['start','stop'])}).strict().parse(request.body);
    if(!options.playerAgentToken)throw new BoundaryError(503,'PLAYER_AGENT_NOT_CONFIGURED','Player Agent is not configured');
    if(action==='stop'){
      const formal=mysqlPlayback?await mysqlPlayback.current():undefined;
      const test=playerTasks.status().task;
      if(formal&&['claimed','playing','uncertain'].includes(formal.state))await mysqlPlayback!.control('stop');
      else if(test&&['claimed','playing'].includes(test.state))playerTasks.control('stop');
      playerTasks.setAutoplay(false);
      if(!formal||['completed','failed'].includes(formal.state))autoplayOwner.release();
    }
    const command=playerTasks.requestLauncherAction(action);
    return success({action,commandId:command.id,state:action==='start'?'starting':'stopping'});
  });
  app.post('/api/v1/admin/queue/:id/media-check', async (request) => {
    sessions.get(request, 'admin'); const requestId=id.parse((request.params as {id:string}).id); z.object({}).strict().parse(request.body);
    const live=playerTasks.status(); if(!live.connected) return success({state:'agent_offline' as const,requestId});
    const row=mysqlQueue?await mysqlQueue.row(requestId):autoplay.read(playbackDatabase,requestId); if(!row)throw new BoundaryError(404,'REQUEST_NOT_FOUND','Reservation was not found');
    return success(mediaChecks.create(requestId,row.fullpath));
  });
  app.get('/api/v1/admin/queue/:id/media-check/:checkId', async (request) => {
    sessions.get(request, 'admin'); const params=z.object({id:z.coerce.number().int().positive(),checkId:z.string().uuid()}).parse(request.params);
    return success(mediaChecks.read(params.checkId,params.id));
  });
  app.get('/api/v1/admin/playback/recoverable', async (request) => { sessions.get(request,'admin'); return success(mysqlPlayback?await mysqlPlayback.recoverable():[]); });
  app.post('/api/v1/admin/playback/tasks/:taskId/recheck', async (request) => {
    sessions.get(request,'admin'); const {taskId}=z.object({taskId:z.string().uuid()}).parse(request.params);
    if(!mysqlPlayback)throw new BoundaryError(503,'PLAYBACK_RECOVERY_UNAVAILABLE','MySQL playback recovery is unavailable');
    let task=await mysqlPlayback.recoveryTask(taskId);if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');
    const live=playerTasks.mpvStatus();
    const ownerOnline=live.connected&&live.agentId===task.agentId;
    const playerIdle=live.mpv?.connected===true&&(live.mpv.state==='idle'||live.mpv.state==='stopped');
    const freshMpvReport=typeof live.observedAt==='number'&&Date.now()-live.observedAt>=0&&Date.now()-live.observedAt<=5000;
    const adminConfirmedInactive=await mysqlPlayback.hasAdminInactiveConfirmation(taskId);
    let recoveryApplied=false;
    // An uncertain attempt is not the same as an active playback. Allow the
    // owning Agent's fresh, authenticated idle/stopped telemetry to settle it
    // as failed (never EOF), so the administrator can retry or mark it handled.
    if(task.state==='uncertain'&&ownerOnline&&playerIdle&&freshMpvReport){
      const settled=await mysqlPlayback.report(taskId,task.agentId!,{state:'failed',recovery:'confirmed_inactive',playback:live.mpv!.state});
      recoveryApplied=settled.changed;
      task=await mysqlPlayback.recoveryTask(taskId)||task;
      const remaining=await mysqlPlayback.current(),local=playerTasks.status().task;
      if(!remaining&&!(local&&['pending','claimed','playing'].includes(local.state)))autoplayOwner.release();
    }
    const active=await mysqlPlayback.current();
    const local=playerTasks.status().task,localActive=Boolean(local&&['pending','claimed','playing'].includes(local.state));
    const legacyActive=await mysqlPlayback.hasLegacyActivePlayback();
    // A terminal failed report already establishes the previous attempt's outcome.
    // It must remain actionable even when the Agent is offline. Only uncertainty
    // requires an explicit inactive confirmation; global playback fences still apply.
    const noOtherPlayback=!active&&!localActive&&!legacyActive;
    const safe=(task.state==='failed'||adminConfirmedInactive||(ownerOnline&&playerIdle&&freshMpvReport))&&noOtherPlayback;
    const blocker=active?'Another formal playback task is active':localActive?'A local test task is active':legacyActive?'A Legacy playback marker exists':!live.connected?'Player Agent is offline':live.agentId!==task.agentId?'The task owner Agent is not connected':!live.mpv?.connected?'mpv status is unavailable':!freshMpvReport?'Waiting for a fresh mpv status report':!playerIdle?'mpv still reports active or unknown media':undefined;
    return success({task,agentConnected:live.connected,agentMatchesTask:ownerOnline,mpvConnected:live.mpv?.connected===true,mpvState:live.mpv?.state||'unavailable',mpvFile:live.mpv?.file,mpvObservedAt:live.observedAt,recoveryApplied,adminConfirmedInactive,safeToRetry:task.state==='failed'&&safe,safeToHandle:task.state==='failed'&&safe,recommendation:task.state==='uncertain'?(ownerOnline?'Waiting for a fresh idle/stopped report from the owning Agent, or an explicit Admin confirmation; no completion is inferred':'Reconnect the task-owning Agent or explicitly confirm it is inactive'):safe?'The previous task is confirmed inactive; retry or mark handled is available':blocker||'Wait for the Agent to confirm the player state'});
  });
  app.post('/api/v1/admin/playback/tasks/:taskId/confirm-inactive', async (request) => {
    sessions.get(request,'admin'); const {taskId}=z.object({taskId:z.string().uuid()}).parse(request.params);
    const {confirmed,reason}=z.object({confirmed:z.literal(true),reason:z.string().trim().min(3).max(240)}).strict().parse(request.body);
    if(!confirmed)throw new BoundaryError(400,'PLAYBACK_CONFIRMATION_REQUIRED','Explicit Admin confirmation is required');
    if(!mysqlPlayback)throw new BoundaryError(503,'PLAYBACK_RECOVERY_UNAVAILABLE','MySQL playback recovery is unavailable');
    const local=playerTasks.status().task;
    if(local&&['claimed','playing','uncertain'].includes(local.state))throw new BoundaryError(409,'LOCAL_PLAYBACK_ACTIVE','A local Player Agent task is still active; stop or resolve it first');
    const result=await mysqlPlayback.confirmInactiveByAdmin(taskId,reason);
    const remaining=await mysqlPlayback.current();
    if(!remaining)autoplayOwner.release();
    return success({...result,warning:'This is an Admin attestation, not a player telemetry result; it is never recorded as EOF.'});
  });
  app.post('/api/v1/admin/playback/tasks/:taskId/retry', async (request) => {
    sessions.get(request,'admin'); const {taskId}=z.object({taskId:z.string().uuid()}).parse(request.params);z.object({}).strict().parse(request.body);
    if(!mysqlPlayback)throw new BoundaryError(503,'PLAYBACK_RECOVERY_UNAVAILABLE','MySQL playback recovery is unavailable');
    const task=await mysqlPlayback.recoveryTask(taskId);if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');
    const {reason}=z.object({reason:z.string().trim().min(3).max(240).optional()}).strict().parse(request.body);
    if(task.state!=='failed')throw new BoundaryError(409,'PLAYBACK_RECOVERY_REQUIRED','Uncertain playback must first be confirmed inactive; failed attempts can be retried directly');
    const local=playerTasks.status().task;if(await mysqlPlayback.current()||local&&['pending','claimed','playing'].includes(local.state))throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Resolve other active playback before retrying');
    if(await mysqlPlayback.hasLegacyActivePlayback())throw new BoundaryError(409,'LEGACY_PLAYBACK_ACTIVE','A Legacy playback marker exists; reconcile it before retrying');
    const schedule=await mysqlSettings!.scheduling(),resumeAutomatic=options.nodeAutoplay===true&&schedule.playmode===1;
    const acquired=resumeAutomatic&&!autoplayOwner.active();if(acquired)autoplayOwner.acquire();
    try{
      const result=await mysqlPlayback.retry(taskId,resumeAutomatic,reason);
      if(acquired&&!result.schedulerResumed)autoplayOwner.release();
      return success(result);
    }catch(error){if(acquired)autoplayOwner.release();throw error;}
  });
  app.post('/api/v1/admin/playback/tasks/:taskId/handled', async (request) => {
    sessions.get(request,'admin'); const {taskId}=z.object({taskId:z.string().uuid()}).parse(request.params);const {reason}=z.object({reason:z.string().trim().min(3).max(240).optional()}).strict().parse(request.body);
    if(!mysqlPlayback)throw new BoundaryError(503,'PLAYBACK_RECOVERY_UNAVAILABLE','MySQL playback recovery is unavailable');
    const task=await mysqlPlayback.recoveryTask(taskId);if(!task)throw new BoundaryError(404,'PLAYBACK_TASK_NOT_FOUND','Playback task was not found');
    if(task.state!=='failed')throw new BoundaryError(409,'PLAYBACK_RECOVERY_REQUIRED','Uncertain playback must first be confirmed inactive; failed attempts can be skipped directly');
    const local=playerTasks.status().task;if(await mysqlPlayback.current()||local&&['pending','claimed','playing'].includes(local.state))throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Resolve other active playback before marking this handled');
    if(await mysqlPlayback.hasLegacyActivePlayback())throw new BoundaryError(409,'LEGACY_PLAYBACK_ACTIVE','A Legacy playback marker exists; reconcile it before skipping this reservation');
    const schedule=await mysqlSettings!.scheduling(),resumeAutomatic=options.nodeAutoplay===true&&schedule.playmode===1;
    const acquired=resumeAutomatic&&!autoplayOwner.active();if(acquired)autoplayOwner.acquire();
    try{
      const result=await mysqlPlayback.markHandled(taskId,(reason||'Admin skipped this failed playback attempt').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim(),resumeAutomatic);
      if(acquired&&!result.schedulerResumed)autoplayOwner.release();
      return success(result);
    }catch(error){if(acquired)autoplayOwner.release();throw error;}
  });
  app.get('/api/v1/admin/playback/history', async (request) => { sessions.get(request,'admin'); const paging=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)}).strict().parse(request.query); return success(mysqlPlayback?await mysqlPlayback.history(paging.limit,paging.offset):playbackTasks.history(playbackDatabase,paging.limit,paging.offset)); });
  app.post('/api/v1/admin/player-agent/test', async (request) => {
    sessions.get(request, 'admin'); z.object({}).strict().parse(request.body);
    if (autoplayOwner.active()) throw new BoundaryError(409,'AUTOPLAY_ACTIVE','Stop formal autoplay before starting a local test task');
    if (!options.playerAgentToken) throw new BoundaryError(503, 'PLAYER_AGENT_NOT_CONFIGURED', 'Player Agent 未配置');
    return success(playerTasks.createTest());
  });
  app.post('/api/v1/admin/player-agent/control', async (request) => {
    sessions.get(request, 'admin');
    const body = z.object({ action: z.enum(['pause','resume','stop']) }).strict().parse(request.body);
    if (!options.playerAgentToken) throw new BoundaryError(503, 'PLAYER_AGENT_NOT_CONFIGURED', 'Player Agent 未配置');
    return success(playerTasks.control(body.action));
  });
  app.post('/api/v1/admin/player-agent/autoplay', async (request) => {
    sessions.get(request, 'admin');
    const { action } = z.object({ action: z.enum(['start','arm-manual','start-next','stop','pause','resume','skip']) }).strict().parse(request.body);
    if(mysqlPlayback){
      if(action==='stop'){
        const local=playerTasks.status().task;
        if(local?.kind==='test'&&['claimed','playing'].includes(local.state))throw new BoundaryError(409,'TEST_TASK_ACTIVE','Stop the local test task with its dedicated control');
        const formal=await mysqlPlayback.current();
        if(formal&&!options.playerAgentToken)throw new BoundaryError(503,'PLAYER_AGENT_NOT_CONFIGURED','Cannot safely stop the active task without the Agent credential');
        await mysqlSettings!.setSchedulerEnabled(false);
        if(formal?.state==='claimed')await mysqlPlayback.stopPending();
        else if(formal)await mysqlPlayback.control('stop');
        if(!formal||formal.state==='claimed')autoplayOwner.release();
        return success({autoplayEnabled:false,manualMode:false});
      }
      if(['start','arm-manual','start-next'].includes(action)&&!options.nodeAutoplay)throw new BoundaryError(503,'NODE_AUTOPLAY_DISABLED','Node scheduler is blocked by deployment policy (YUKARI_NODE_AUTOPLAY=0)');
      if(!options.playerAgentToken)throw new BoundaryError(503,'PLAYER_AGENT_NOT_CONFIGURED','Player Agent authentication is not configured');
      if(['pause','resume','skip'].includes(action))return success(await mysqlPlayback.control(action as 'pause'|'resume'|'skip'));
      const state=playerTasks.status();
      if(action==='start-next'){
        const schedule=await mysqlSettings!.scheduling();
        if(schedule.playmode!==2||!schedule.enabled)throw new BoundaryError(409,'MANUAL_PLAYBACK_NOT_ARMED','Select manual mode and enable Node queue ownership first');
        if(!state.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
        if(await mysqlPlayback.current())throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Wait for the current reservation to finish or stop it before starting the next');
        if(!autoplayOwner.active())autoplayOwner.acquire();
        return success(await mysqlSettings!.requestManualStart());
      }
      if(action==='arm-manual'&&!state.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
      const mode=(await readCurrentSettings()).playmode;
      if(action==='arm-manual'&&mode!==2)throw new BoundaryError(409,'MANUAL_MODE_REQUIRED','Select manual mode before enabling manual queue ownership');
      if(action==='start'&&mode!==1)throw new BoundaryError(409,'AUTOPLAY_MODE_UNSUPPORTED','Select FIFO automatic mode before starting automatic playback');
      if(!state.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
      if(state.task?.kind==='test'&&['pending','claimed','playing','uncertain'].includes(state.task.state))throw new BoundaryError(409,'TEST_TASK_ACTIVE','Stop the local test task before starting queue playback');
      if(await mysqlPlayback.current())throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Resolve the active playback task before starting the scheduler');
      if(await mysqlPlayback.hasLegacyActivePlayback())throw new BoundaryError(409,'LEGACY_PLAYBACK_ACTIVE','A Legacy playback marker exists; reconcile it before transferring queue ownership');
      const acquired=!autoplayOwner.active();if(acquired)autoplayOwner.acquire();
      try{return success(await mysqlSettings!.setSchedulerEnabled(true));}catch(error){if(acquired)autoplayOwner.release();throw error;}
    }
    if (!options.nodeAutoplay) throw new BoundaryError(503, 'NODE_AUTOPLAY_DISABLED', 'Node autoplay is blocked by deployment policy');
    if (!options.playerAgentToken) throw new BoundaryError(503, 'PLAYER_AGENT_NOT_CONFIGURED', 'Player Agent authentication is not configured');
    if (['pause','resume','skip'].includes(action)) return success(playbackTasks.control(playbackDatabase,action as 'pause'|'resume'|'skip'));
    if (action === 'stop') {
      const local=playerTasks.status().task;
      if(local?.kind==='test'&&['claimed','playing'].includes(local.state))throw new BoundaryError(409,'TEST_TASK_ACTIVE','Stop the local test task with its dedicated control');
      const formal=playbackTasks.current(playbackDatabase);
      if(formal?.state==='claimed')playbackTasks.stopPending(playbackDatabase);
      else if(formal)playbackTasks.control(playbackDatabase,'stop');
      const result=playerTasks.autoplayAction('stop');
      if(!formal||formal.state==='claimed')autoplayOwner.release();
      return success(result);
    }
    if(action==='arm-manual'){
      if(!playerTasks.status().connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
      const mode=(await readCurrentSettings()).playmode;
      if(mode!==2)throw new BoundaryError(409,'LEGACY_MODE_MISMATCH','Manual queue start requires the existing Legacy playmode=2');
      if(playbackTasks.current(playbackDatabase)||playbackTasks.hasLegacyActivePlayback(playbackDatabase))throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Resolve active playback before enabling manual mode');
      if(!autoplayOwner.active())autoplayOwner.acquire();
      return success(playerTasks.armManual());
    }
    if(action==='start-next'){
      if((await readCurrentSettings()).playmode!==2||!playerTasks.status().manualMode)throw new BoundaryError(409,'MANUAL_PLAYBACK_NOT_ARMED','Enable manual queue ownership before starting a song');
      if(playbackTasks.current(playbackDatabase))throw new BoundaryError(409,'PLAYBACK_TASK_ACTIVE','Wait for current playback before starting the next song');
      return success(playerTasks.requestManualStart());
    }
    const live=playerTasks.status();
    if(!live.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
    if(live.task?.kind==='test'&&['pending','claimed','playing'].includes(live.task.state))throw new BoundaryError(409,'TEST_TASK_ACTIVE','Stop the local test task before starting queue autoplay');
    if((await readCurrentSettings()).playmode!==1)throw new BoundaryError(409,'AUTOPLAY_MODE_UNSUPPORTED','FIFO automatic mode 1 is required');
    if(playbackTasks.hasLegacyActivePlayback(playbackDatabase))throw new BoundaryError(409,'LEGACY_PLAYBACK_ACTIVE','A Legacy playback marker exists; reconcile it before transferring ownership');
    if(!autoplayOwner.active())autoplayOwner.acquire();
    return success(playerTasks.autoplayAction('start'));
  });
  const agentIdentity = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), testReady: z.boolean().optional() }).strict();
  const requireAgent = (request: { headers: { authorization?: string } }) => {
    if (!options.playerAgentToken || !agentAuthorized(request.headers.authorization, options.playerAgentToken)) throw new BoundaryError(401, 'PLAYER_AGENT_UNAUTHORIZED', 'Player Agent 凭据无效');
  };
  app.post('/api/v1/agent/next', async (request) => {
    requireAgent(request); const body = agentIdentity.extend({searchReady:z.boolean().optional()}).parse(request.body);
    let assignment: {task:{id:string;kind:'test'|'queue';requestId?:number;state:'pending'|'claimed'|'playing'|'completed'|'failed'|'uncertain';createdAt?:number;agentId?:string;error?:string;mediaPath?:string;initialVolume?:number;initialKeySemitones?:number}|null;command:'pause'|'resume'|'stop'|'skip'|null;commandTaskId?:string;mediaCheck?:{id:string;requestId:number;path:string};searchJob?:{id:string;keyword:string};mpvControl?:ReturnType<typeof playerTasks.pendingMpvControl>} = playerTasks.next(body.agentId,body.testReady===true);
    if(assignment.task?.kind==='queue')assignment={task:null,command:null};
    if(!assignment.command){const mediaCheck=mediaChecks.claim(body.agentId);if(mediaCheck)assignment={...assignment,mediaCheck};}
    // Older Agents omit searchReady. Do not claim a job they cannot execute.
    const searchJob=agentSearch.claim(body.agentId,body.searchReady===true);
    if(searchJob)assignment={...assignment,searchJob};
    const agentStatus=playerTasks.status();
    if(!assignment.task&&!assignment.command&&!assignment.mediaCheck){
      if(mysqlPlayback){
        const claimed=await mysqlPlayback.claimNext(body.agentId,options.nodeAutoplay===true&&autoplayOwner.active());
        if(claimed.task)assignment={...assignment,task:claimed.task,command:claimed.command};
        else if(claimed.command)assignment={...assignment,task:null,command:claimed.command,commandTaskId:claimed.commandTaskId};
      }else if(options.nodeAutoplay&&autoplayOwner.active()&&(!agentStatus.manualMode||agentStatus.manualStartRequested)){
        const configuredMode=(await readCurrentSettings()).playmode;
        if(agentStatus.manualMode&&configuredMode!==2)throw new BoundaryError(409,'LEGACY_MODE_MISMATCH','Manual playback strategy no longer matches configured playmode=2');
        const claimed=playbackTasks.claimNext(playbackDatabase,agentStatus.manualMode?1:configuredMode,body.agentId);
        if(agentStatus.manualMode)playerTasks.consumeManualStart();
        if(claimed.task){const task=claimed.task.state==='claimed'?{...claimed.task,initialVolume:(await readCurrentSettings()).startvolume}:claimed.task;assignment={...assignment,task,command:claimed.command};}
        else if(claimed.command)assignment={...assignment,task:null,command:claimed.command,commandTaskId:claimed.commandTaskId};
      }
    }
    assignment.mpvControl=playerTasks.pendingMpvControl(body.agentId)||undefined;
    return success(assignment);
  });
  app.post('/api/v1/agent/report', async (request) => {
    requireAgent(request);
    const body = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), taskId: z.string().uuid().optional(),
      state: z.enum(['claimed','playing','completed','failed']).optional(), recovery:z.enum(['verified_active','confirmed_inactive']).optional(), playback: z.enum(['idle','starting','playing','paused','stopped','unavailable']),
      testReady: z.boolean().optional(), file: safeMediaName.optional(), error: z.string().max(300).optional(), endReason: z.literal('eof').optional(), outcome: z.literal('skipped').optional(),
      everything:z.enum(['not_checked','connected_no_media','connected_media_found','unavailable']).optional(),mediaRootConfigured:z.boolean().optional(),lanAddresses:z.array(z.string().regex(/^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})$/)).max(16).optional(),agentError:z.enum(['EVERYTHING_CONFIG_INVALID','EVERYTHING_AUTH_FAILED','EVERYTHING_HTTP_ERROR','EVERYTHING_RESPONSE_TOO_LARGE','EVERYTHING_INVALID_JSON','EVERYTHING_TIMEOUT','EVERYTHING_UNREACHABLE','SEARCH_REPORT_FAILED']).nullable().optional(),
      mpv:mpvStatusSchema.optional(),controlAck:z.object({id:z.string().uuid(),ok:z.boolean(),error:z.enum(['MPV_IPC_UNAVAILABLE','MPV_NOT_PLAYING','MPV_CONTROL_FAILED','MPV_TRACK_UNAVAILABLE','MPV_KEY_CHANGE_UNAVAILABLE']).optional()}).strict().optional() }).strict().parse(request.body);
    if(body.controlAck)playerTasks.acknowledgeMpvControl(body.agentId,body.controlAck);
    if(body.taskId){
      const localTask=playerTasks.status().task;
      const formal=localTask?.id===body.taskId?undefined:mysqlPlayback?await mysqlPlayback.readTask(body.taskId):playbackTasks.readTask(playbackDatabase,body.taskId);
      if(formal){
        const result=mysqlPlayback?await mysqlPlayback.report(body.taskId,body.agentId,body):playbackTasks.report(playbackDatabase,body.taskId,body.agentId,body);
        if(result.changed&&result.eventType&&!options.mysqlStore)void legacy.notifyQueueService().catch(()=>{});
        if(result.changed&&result.eventType==='playing'&&formal.startedAt==null&&mysqlDanmaku){
          try{if(await mysqlDanmaku.enabled()){const reservation=await mysqlPlayback?.reservationCommentForTask(body.taskId);if(reservation?.comment.trim())danmaku.publishReservationComment(reservation.comment,reservation.singer);}}catch{/* Optional comments must never block playback state transitions. */}
        }
        if(body.state==='failed'&&body.outcome!=='skipped'){
          if(mysqlSettings)await mysqlSettings.setSchedulerEnabled(false);
          else playerTasks.setAutoplay(false,'Formal playback failed; inspect task history and explicitly stop the owner fence');
        }
        const heartbeat=playerTasks.report(body.agentId,{playback:body.playback,testReady:body.testReady===true,file:body.file,everything:body.everything,mediaRootConfigured:body.mediaRootConfigured,lanAddresses:body.lanAddresses,agentError:body.agentError,mpv:body.mpv});
        if(body.state==='failed'&&(!mysqlSettings||!(await mysqlSettings.scheduling()).enabled))autoplayOwner.release();
        return success({...heartbeat,task:result.state});
      }
    }
    if(body.state==='completed'&&body.endReason!=='eof')throw new BoundaryError(400,'PLAYER_EOF_REQUIRED','Only real mpv end-file reason=eof can complete a task');
    return success(playerTasks.report(body.agentId,{...body,lanAddresses:body.lanAddresses}));
  });
  app.post('/api/v1/agent/launcher/poll',async(request)=>{
    requireAgent(request);
    const body=z.object({launcherId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),state:z.enum(['starting','running','stopping','stopped','error']),error:z.enum(['AGENT_CONFIG_INVALID','AGENT_PROCESS_UNVERIFIED','AGENT_START_FAILED','AGENT_STOP_FAILED','LAUNCHER_RUNTIME_ERROR']).optional()}).strict().parse(request.body);
    const launcher=playerTasks.reportLauncher(body.launcherId,body.state,body.error);
    const agent=playerTasks.status();
    const formal=mysqlPlayback?await mysqlPlayback.current():undefined;
    const test=agent.task;
    // A server-restart `uncertain` task must not deadlock the Launcher stop
    // command. Graceful Agent shutdown never reports EOF; the next Agent
    // reconciles the persisted task against the live mpv state.
    const taskActive=Boolean(formal&&['claimed','playing'].includes(formal.state)||test&&['claimed','playing'].includes(test.state));
    return success({launcher,command:playerTasks.launcherCommand(),agentConnected:agent.connected,taskActive,playback:agent.playback});
  });
  app.post('/api/v1/agent/media-check', async (request) => {
    requireAgent(request);
    const body=z.object({agentId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),checkId:z.string().uuid(),result:z.enum(['playable','path_unmapped','file_missing','invalid_path'])}).strict().parse(request.body);
    return success(mediaChecks.complete(body.checkId,body.agentId,body.result as MediaCheckResult));
  });
  app.post('/api/v1/agent/search-result',async(request)=>{
    requireAgent(request);
    const body=z.object({agentId:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),searchId:z.string().uuid(),health:z.enum(['connected_no_media','connected_media_found','unavailable']),error:z.enum(['EVERYTHING_CONFIG_INVALID','EVERYTHING_AUTH_FAILED','EVERYTHING_HTTP_ERROR','EVERYTHING_RESPONSE_TOO_LARGE','EVERYTHING_INVALID_JSON','EVERYTHING_TIMEOUT','EVERYTHING_UNREACHABLE']).optional(),items:z.array(z.object({name:z.string().min(1).max(512),path:z.string().min(3).max(4096),size:z.number().int().nonnegative()}).strict()).max(50)}).strict().parse(request.body);
    if(body.items.some(item=>!win32.isAbsolute(item.path)))throw new BoundaryError(400,'INVALID_AGENT_MEDIA_PATH','Agent search returned a non-absolute media path');
    return success(agentSearch.complete(body.searchId,body.agentId,body.items,body.health,body.error));
  });
  app.get('/api/v1/search', async (request) => {
    const identity = sessions.get(request, 'user');
    const query = z.object({ backend: z.enum(['everything', 'lister']), keyword: z.string().trim().min(1).max(256) }).strict().parse(request.query);
    if(query.backend==='everything'&&options.agentSearchEnabled){
      if(!playerTasks.status().connected)throw new BoundaryError(503,'MEDIA_AGENT_OFFLINE','Windows Media Agent is offline; search is unavailable');
      return success(await agentSearch.create(query.keyword,identity.userid));
    }
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
      const result=mysqlRequests?await mysqlRequests.lookup(receipts.verify(claim.receipt),claim.userid):requests.lookup(context.database,claim.receipt,claim.userid);
      return success({state:result?'committed':'not_found',result});
    }
    const effectiveContext=mysqlSettings?await mysqlSettings.applyRequestOrdering(context):context;
    const value=mysqlRequestService?await mysqlRequestService.submit(effectiveContext,requestInputSchema.parse(claim.input),claim.receipt):await requests.submit(context,requestInputSchema.parse(claim.input),claim.receipt,()=>legacy.call('queue-notify',identity));
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
    const result=mysqlRequests?await mysqlRequests.lookup(receipts.verify(body.receipt),sessions.get(request,'user').userid):requests.lookup(context.database,body.receipt,sessions.get(request,'user').userid);
    return success({state:result?'committed':'not_found',result});
  });
  app.post('/api/v1/requests', async (request, reply) => {
    const identity = sessions.get(request, 'user');
    const body = requestInputSchema.parse(request.body);
    const receipt=String(request.headers['x-yukari-submission']||'');
    receipts.verify(receipt);
    body.fullpath=agentSearch.resolveSelection(identity.userid,body.fullpath);
    let username='';
    try { username=decodeURIComponent((request.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('YkariUsername='))?.slice('YkariUsername='.length)||'').slice(0,64); } catch { username=''; }
    const context=legacyParse(requestContextSchema,await legacy.call('request-context',identity,{fullpath:body.fullpath,username}));
    const effectiveContext=mysqlSettings?await mysqlSettings.applyRequestOrdering(context):context;
    const value=mysqlRequestService?await mysqlRequestService.submit(effectiveContext,body,receipt):await requests.submit(context,body,receipt,()=>legacy.call('queue-notify',identity));
    const normalized=normalizeRequest(body);
    if(normalized.singer!==context.nonameusername && normalized.kind!=='小休止' && normalized.singer!=='') reply.header('Set-Cookie',`YkariUsername=${encodeURIComponent(normalized.singer)}; Path=/; SameSite=Lax; Max-Age=5184000${options.secureCookies?'; Secure':''}`);
    reply.header('X-Yukari-Owner','node-request-create');
    return reply.code(201).send(success(value.result));
  });
  app.post('/api/v1/admin/queue/reorder',async(request,reply)=>{
    const identity=sessions.get(request,'admin');
    const body=z.object({ids:z.array(z.number().int().positive().max(2147483647)).max(5000),expectedIds:z.array(z.number().int().positive().max(2147483647)).max(5000).optional()}).strict().parse(request.body);
    const context=legacyParse(queueContextSchema,await legacy.call('queue-context',identity));
    if(context.role!=='admin')throw new BoundaryError(403,'ROLE_MISMATCH','Admin context required');
    const count=mysqlMutations?await mysqlMutations.reorder(body.ids,body.expectedIds):undefined;
    const result=count===undefined?await mutations.reorder(context.database,body.ids,async()=>legacyParse(z.object({notified:z.literal(true)}),await legacy.call('queue-notify',identity))):{reordered:true as const,count};
    reply.header('X-Yukari-Owner','node-queue-mutation');return success(result);
  });
  app.get('/api/v1/admin/queue', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', '队列身份不一致');
    const data = mysqlQueue ? adminQueueSchema.parse(await mysqlQueue.read(context,0,0,false,true)) : queueSchema.parse(queue.read(context));
    reply.header('X-Yukari-Owner', 'node-queue-read');
    return success(data);
  });
  app.get('/api/v1/admin/status', async (request) => {
    const identity=sessions.get(request,'admin');
    if(!options.mysqlStore)return success(legacyParse(statusSchema,await legacy.call('admin-status',identity)));
    await legacy.call('admin-session',identity);
    const settingsValue=await mysqlSettings!.read(), agent=playerTasks.status();
    const playback=await mysqlQueue!.playback();
    return success(statusSchema.parse({php_version:'Legacy-only',os:'Windows Player Agent',detected_player:agent.connected?'mpv':'unavailable',
      playmode:settingsValue.playmode,mpc_reachable:false,foobar_reachable:false,playback,password_configured:true}));
  });
  app.delete('/api/v1/admin/requests/:id', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', 'Admin context required');
    let result;
    if(mysqlMutations){await mysqlMutations.mutate(params.id,'delete');result={id:params.id,deleted:true as const};}
    else result=await mutations.execute(context.database, params.id, 'delete', async () => legacyParse(z.object({ notified: z.literal(true) }), await legacy.call('queue-notify', identity)));
    reply.header('X-Yukari-Owner', 'node-queue-mutation');
    return success(z.object({ id: z.literal(params.id), deleted: z.literal(true) }).parse(result));
  });
  app.put('/api/v1/admin/requests/:id/comment', async (request, reply) => {
    const identity=sessions.get(request,'admin');
    const params=z.object({id}).parse(request.params);
    const body=z.object({comment:z.string().max(512)}).strict().parse(request.body);
    const context=legacyParse(queueContextSchema,await legacy.call('queue-context',identity));
    if(context.role!=='admin')throw new BoundaryError(403,'ROLE_MISMATCH','Admin context required');
    if(!mysqlMutations)throw new BoundaryError(503,'ADMIN_COMMENT_STORAGE_UNAVAILABLE','Reservation comment editing requires MySQL mode');
    const result=await mysqlMutations.updateComment(params.id,body.comment);
    reply.header('X-Yukari-Owner','node-reservation-comment');
    return success(result);
  });
  app.post('/api/v1/admin/requests/:id/move', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    const params = z.object({ id }).parse(request.params);
    const body = z.object({ action: z.enum(['up', 'down', 'warikomi']) }).strict().parse(request.body);
    const context = legacyParse(queueContextSchema, await legacy.call('queue-context', identity));
    if (context.role !== 'admin') throw new BoundaryError(403, 'ROLE_MISMATCH', 'Admin context required');
    let result;
    if(mysqlMutations){const message=await mysqlMutations.mutate(params.id,body.action);result={id:params.id,action:body.action,message};}
    else result=await mutations.execute(context.database, params.id, body.action, async () => legacyParse(z.object({ notified: z.literal(true) }), await legacy.call('queue-notify', identity)));
    reply.header('X-Yukari-Owner', 'node-queue-mutation');
    return success(z.object({ id: z.literal(params.id), action: z.literal(body.action), message: z.string() }).parse(result));
  });
  app.get('/api/v1/settings', async (request, reply) => {
    const identity = sessions.get(request, 'admin');
    // PHP verifies current credentials/policy only; it never builds settings here.
    const grant = legacyParse(z.object({ config_revision: z.string().regex(/^[a-f0-9]{64}$/) }), await legacy.call('admin-session', identity));
    const data = options.mysqlStore ? settingsSchema.parse(await new MysqlSettingsRepository(options.mysqlStore).read()) : await settings.read(grant.config_revision);
    // Recheck revocation and concurrent in-place/atomic configuration replacement.
    const after = legacyParse(z.object({ config_revision: z.string() }), await legacy.call('admin-session', identity));
    if (!options.mysqlStore && after.config_revision !== data.revision) throw new BoundaryError(503, 'SETTINGS_CHANGED', '配置读取期间发生变化，请重新读取');
    reply.header('X-Yukari-Owner', 'node-settings-read');
    return success(data);
  });
  app.put('/api/v1/settings', async (request) => {
    const identity = sessions.get(request, 'admin');
    const body = settingsSchema.omit({ changed: true }).strict().parse(request.body);
    if(options.mysqlStore){
      const repository=new MysqlSettingsRepository(options.mysqlStore),current=await repository.read();
      if(body.playmode!==current.playmode){
        const schedule=await repository.scheduling(),task=await mysqlPlayback!.current(),local=playerTasks.status().task;
        if(schedule.enabled||task||local&&['pending','claimed','playing','uncertain'].includes(local.state))throw new BoundaryError(409,'PLAYMODE_CHANGE_BLOCKED','Stop the Node scheduler and resolve the active task before changing playback mode');
      }
      return success(await repository.update(body));
    }
    const before=await settings.read(body.revision);
    if(body.request_automove!==before.request_automove||body.request_automove_reset!==before.request_automove_reset||body.request_automove_midjoin_first!==before.request_automove_midjoin_first)
      throw new BoundaryError(409,'MYSQL_SETTINGS_REQUIRED','Reservation ordering settings are Node/MySQL-owned; this Legacy SQLite profile cannot save them');
    const saved=legacyParse(z.object({playmode:z.number(),startvolume:z.number(),requestlistactivereload:z.number(),revision:z.string().regex(/^[a-f0-9]{64}$/),changed:z.boolean().optional()}),await legacy.call('admin-settings-save', identity, Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)]))));
    return success({...await settings.read(saved.revision),changed:saved.changed});
  });
  app.post('/api/v1/playback/control', async (request) => {
    const identity = sessions.get(request, 'admin');
    if (autoplayOwner.active()) throw new BoundaryError(409, 'AUTOPLAY_OWNS_PLAYER', 'Fastify owns playback while queue autoplay is active');
    const body = z.object({ player: z.enum(['mpc', 'foobar']), action: z.enum(['play', 'pause', 'playpause', 'stop']) }).strict().parse(request.body);
    return success(legacyParse(z.object({ acknowledged: z.literal(true), player: z.literal(body.player), action: z.literal(body.action), message: z.string() }), await legacy.call('admin-player', identity, body)));
  });
  return app;
}
