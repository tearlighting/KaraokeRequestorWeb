import { apiRequest, ApiError } from '../../../../packages/contracts/src/index';
export type { QueueItem, QueueData, Settings, SystemStatus, PlayerAgentStatus } from '../../../../packages/contracts/src/index';
export type { AdminSession as Session } from '../../../../packages/contracts/src/index';
export { ApiError as AdminError };
export interface Credentials { username: string; password: string; easyPass: string }
export interface PlaybackHistory { tasks: Array<{id:string;requestId:number;state:string;createdAt:number;startedAt:number|null;finishedAt:number|null;errorCode:string|null}>; events: Array<{id:number;taskId:string;type:string;occurredAt:number}> }
export interface MediaCheck { id?: string; requestId: number; state: import('../../../../packages/contracts/src/index').MediaAvailability }
export function message(error: unknown) { return error instanceof Error ? error.message : '请求失败'; }
export const login = (credentials: Credentials) => apiRequest<import('../../../../packages/contracts/src/index').AdminSession>('/admin/session', { method: 'POST', body: JSON.stringify(credentials) });
export const logout = () => apiRequest('/admin/session', { method: 'DELETE', body: '{}' });
export function adminClient() {
  return async function request<T>(operation: string, body?: Record<string, string>): Promise<T> {
    let path: string;
    let method = 'GET';
    let payload: unknown;
    switch (operation) {
      case 'queue': path = '/admin/queue'; break;
      case 'status': path = '/admin/status'; break;
      case 'player-agent-status': path = '/admin/player-agent'; break;
      case 'playback-history': path = '/admin/playback/history?limit=20'; break;
      case 'player-agent-test': path = '/admin/player-agent/test'; method = 'POST'; payload = body || {}; break;
      case 'player-agent-control': path = '/admin/player-agent/control'; method = 'POST'; payload = body; break;
      case 'player-agent-autoplay': path = '/admin/player-agent/autoplay'; method = 'POST'; payload = body; break;
      case 'media-check': path = `/admin/queue/${encodeURIComponent(body?.id || '')}/media-check`; method = 'POST'; payload = {}; break;
      case 'media-check-result': path = `/admin/queue/${encodeURIComponent(body?.id || '')}/media-check/${encodeURIComponent(body?.checkId || '')}`; break;
      case 'settings': path = '/settings'; break;
      case 'settings-save': path = '/settings'; method = 'PUT'; payload = { ...body, playmode: Number(body?.playmode), startvolume: Number(body?.startvolume), requestlistactivereload: Number(body?.requestlistactivereload) }; break;
      case 'delete': path = `/admin/requests/${encodeURIComponent(body?.id || '')}`; method = 'DELETE'; payload = {}; break;
      case 'move': path = `/admin/requests/${encodeURIComponent(body?.id || '')}/move`; method = 'POST'; payload = { action: body?.action }; break;
      case 'player': path = '/playback/control'; method = 'POST'; payload = body; break;
      default: throw new ApiError('未知管理操作', 400, 'UNKNOWN_OPERATION');
    }
    return apiRequest<T>(path, { method, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  };
}
export type AdminClient = ReturnType<typeof adminClient>;
