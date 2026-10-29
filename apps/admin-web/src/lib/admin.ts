import { apiRequest, ApiError, type ConnectionEntry } from '../../../../packages/contracts/src/index';
export type { QueueItem, QueueData, Settings, SystemStatus, PlayerAgentStatus, MpvLiveStatus, ConnectionEntry } from '../../../../packages/contracts/src/index';
export type { AdminSession as Session } from '../../../../packages/contracts/src/index';
export { ApiError as AdminError };
export interface Credentials { username: string; password: string; easyPass: string }
export interface PlaybackHistory { tasks: Array<{id:string;requestId:number;attempt:number;state:string;createdAt:number;startedAt:number|null;finishedAt:number|null;errorCode:string|null}>; events: Array<{id:number;taskId:string;type:string;occurredAt:number}> }
export interface GatewayTunnelStatus { configured: boolean; connected: boolean }
/** MySQL playback timestamps are Unix seconds; tolerate millisecond values from older API builds. */
export function formatPlaybackTimestamp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  const milliseconds = value < 100_000_000_000 ? value * 1000 : value;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
export interface PlaybackRecoveryTask { id:string; requestId:number; state:'failed'|'uncertain'; agentId:string|null; playback:string; updatedAt:number; startedAt:number|null; errorCode:string|null; error:string|null; nowplaying:string|null; playtimes:number|null; songfile:string|null; singer:string|null; reservationExists?:boolean }
export interface PlaybackRecoveryCheck { task:PlaybackRecoveryTask; agentConnected:boolean; agentMatchesTask:boolean; mpvConnected:boolean; mpvState:string; mpvFile?:string; mpvObservedAt?:number; recoveryApplied?:boolean; adminConfirmedInactive?:boolean; safeToRetry:boolean; safeToHandle:boolean; recommendation:string }
export interface MediaCheck { id?: string; requestId: number; state: import('../../../../packages/contracts/src/index').MediaAvailability }
export interface ParticipantAdminItem { id:string;displayName:string;createdAt:number;reservationCount:number;submittedCount:number }
export function message(error: unknown) { return error instanceof Error ? error.message : '请求失败'; }
export const login = (credentials: Credentials) => apiRequest<import('../../../../packages/contracts/src/index').AdminSession>('/admin/session', { method: 'POST', body: JSON.stringify(credentials) });
export const logout = () => apiRequest('/admin/session', { method: 'DELETE', body: '{}' });
export const currentSession = () => apiRequest<import('../../../../packages/contracts/src/index').AdminSession>('/admin/session');
export type AdminInput = Record<string, unknown>;
export function adminClient() {
  return async function request<T>(operation: string, body?: AdminInput): Promise<T> {
    let path: string;
    let method = 'GET';
    let payload: unknown;
    switch (operation) {
      case 'queue': path = '/admin/queue'; break;
      case 'participants': path = '/admin/participants'; break;
      case 'participant-rename': path = `/admin/participants/${encodeURIComponent(String(body?.id||''))}`; method = 'PUT'; payload = { displayName: body?.displayName }; break;
      case 'status': path = '/admin/status'; break;
      case 'player-agent-status': path = '/admin/player-agent'; break;
      case 'mpv-status': path = '/admin/player-agent/mpv'; break;
      case 'mpv-control': path = '/admin/player-agent/mpv-control'; method = 'POST'; payload = body; break;
      case 'player-agent-launcher': path = '/admin/player-agent/launcher'; method = 'POST'; payload = body; break;
      case 'playback-history': path = '/admin/playback/history?limit=20'; break;
      case 'playback-recoverable': path = '/admin/playback/recoverable'; break;
      case 'playback-recheck': path = `/admin/playback/tasks/${encodeURIComponent(String(body?.taskId||''))}/recheck`; method = 'POST'; payload = {}; break;
      case 'playback-confirm-inactive': path = `/admin/playback/tasks/${encodeURIComponent(String(body?.taskId||''))}/confirm-inactive`; method = 'POST'; payload = { confirmed: body?.confirmed, reason: body?.reason }; break;
      case 'playback-retry': path = `/admin/playback/tasks/${encodeURIComponent(String(body?.taskId||''))}/retry`; method = 'POST'; payload = { reason: body?.reason }; break;
      case 'playback-handled': path = `/admin/playback/tasks/${encodeURIComponent(String(body?.taskId||''))}/handled`; method = 'POST'; payload = { reason: body?.reason || 'Admin skipped this failed playback attempt' }; break;
      case 'connection-entry': path = '/admin/connection-entry'; break;
      case 'gateway-status': path = '/admin/gateway/status'; break;
      case 'connection-entry-save': path = '/admin/connection-entry'; method = 'PUT'; payload = body; break;
      case 'player-agent-test': path = '/admin/player-agent/test'; method = 'POST'; payload = body || {}; break;
      case 'player-agent-control': path = '/admin/player-agent/control'; method = 'POST'; payload = body; break;
      case 'player-agent-autoplay': path = '/admin/player-agent/autoplay'; method = 'POST'; payload = body; break;
      case 'media-check': path = `/admin/queue/${encodeURIComponent(String(body?.id || ''))}/media-check`; method = 'POST'; payload = {}; break;
      case 'media-check-result': path = `/admin/queue/${encodeURIComponent(String(body?.id || ''))}/media-check/${encodeURIComponent(String(body?.checkId || ''))}`; break;
      case 'settings': path = '/settings'; break;
      case 'settings-save': path = '/settings'; method = 'PUT'; payload = { ...body, playmode: Number(body?.playmode), startvolume: Number(body?.startvolume), requestlistactivereload: Number(body?.requestlistactivereload), request_automove: Number(body?.request_automove), request_automove_reset: Number(body?.request_automove_reset), request_automove_midjoin_first: Number(body?.request_automove_midjoin_first) }; break;
      case 'danmaku-settings': path = '/admin/danmaku/settings'; break;
      case 'danmaku-settings-save': path = '/admin/danmaku/settings'; method = 'PUT'; payload = body; break;
      case 'danmaku-clear': path = '/admin/danmaku/clear'; method = 'POST'; payload = {}; break;
      case 'delete': path = `/admin/requests/${encodeURIComponent(String(body?.id || ''))}`; method = 'DELETE'; payload = {}; break;
      case 'reservation-comment': path = `/admin/requests/${encodeURIComponent(String(body?.id || ''))}/comment`; method = 'PUT'; payload = { comment: body?.comment }; break;
      case 'move': path = `/admin/requests/${encodeURIComponent(String(body?.id || ''))}/move`; method = 'POST'; payload = { action: body?.action }; break;
      case 'reorder': path = '/admin/queue/reorder'; method = 'POST'; payload = { ids: body?.ids, ...(Array.isArray(body?.expectedIds)?{expectedIds:body.expectedIds}:{}) }; break;
      case 'player': path = '/playback/control'; method = 'POST'; payload = body; break;
      default: throw new ApiError('未知管理操作', 400, 'UNKNOWN_OPERATION');
    }
    return apiRequest<T>(path, { method, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  };
}
export type AdminClient = ReturnType<typeof adminClient>;
