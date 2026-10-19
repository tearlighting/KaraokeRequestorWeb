/** Phase 3 wire contracts shared by both browsers and the API boundary. No PHP paths. */
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; requestId?: string; legacyStatus?: number; legacyReason?: string };
}
export interface ApiSuccess<T> { ok: true; data: T }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface QueueItem {
  id: number; position: number; reqorder: number; display_name: string; songfile: string;
  singer: string; kind: string; nowplaying: string;
}
export interface QueueData { items: QueueItem[]; total: number; remaining_count: number; has_more: boolean; remaining_seconds: number }
/** Scoped Legacy read response. Sensitive fields are masked by the server. */
export interface LegacyQueueItem extends QueueItem {
  song_name: string; lister_artist: string; lister_work: string; lister_op_ed: string; lister_comment: string;
  comment: string; masked: number; fullpath: string; volume: number;
  secret: number; loop: number; pause: number; track: number; keychange: number; audiodelay: number; duration: number;
}
export interface LegacyQueueData extends Omit<QueueData, 'items'> { items: LegacyQueueItem[] }
/** GET: Node-native read. PUT: PHP-only write. revision hashes exact config bytes. */
export interface Settings { playmode: number; startvolume: number; requestlistactivereload: number; revision: string; changed?: boolean }
export interface AdminSession { username: string; password_configured: boolean; authProvider: 'node' | 'legacy' }
export interface SystemStatus {
  php_version: string; os: string; detected_player: string; playmode: number;
  mpc_reachable: boolean; foobar_reachable: boolean;
  playback: { playingtitle?: string; playingsinger?: string; status?: string } | null;
  password_configured: boolean;
}
export interface ReservationInput {
  filename: string; fullpath: string; singer: string; comment: string; kind: '動画' | '小休止' | 'カラオケ配信' | 'URL指定' | '動画_別プ'; secret?: number | string;
  freesinger?: string; selectid?: number | string; loop?: number | string; otherplayer?: number | string; urlreq?: number | string;
  keychange?: number | string; track?: number | string; pause?: number | string; audiodelay?: number | string; volume?: number | string; duration?: number | string;
}
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR', public legacyReason?: string) { super(message); }
}
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...init, credentials: 'same-origin',
      headers: { 'X-Yukari-Client': '1', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(20000) });
  } catch { throw new ApiError('连接失败或超时。写操作请先刷新队列确认结果，避免重复提交。'); }
  let result: ApiResponse<T>;
  try { result = JSON.parse(await response.text()); }
  catch { throw new ApiError('API 返回非 JSON，未确认操作成功', response.status, 'INVALID_RESPONSE'); }
  if (!response.ok || result.ok !== true) {
    const error = result.ok === false ? result.error : null;
    throw new ApiError(error?.message || `请求失败（HTTP ${response.status}）`, response.status, error?.code || 'API_ERROR', error?.legacyReason);
  }
  return result.data;
}
