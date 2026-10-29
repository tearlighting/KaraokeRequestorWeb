/** Phase 3 wire contracts shared by both browsers and the API boundary. No PHP paths. */
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; requestId?: string; legacyStatus?: number; legacyReason?: string };
}
export interface ApiSuccess<T> { ok: true; data: T }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
export interface QueueItem {
  id: number; position: number; reqorder: number; display_name: string; songfile: string;
  singer: string; kind: string; nowplaying: string; keychange: number; comment?: string;
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
export interface Settings {
  playmode: number; startvolume: number; requestlistactivereload: number;
  request_automove: number; request_automove_reset: number; request_automove_midjoin_first: number;
  revision: string; changed?: boolean;
}
export interface AdminSession { username: string; password_configured: boolean; authProvider: 'node' | 'legacy' }
export interface SystemStatus {
  php_version: string; os: string; detected_player: string; playmode: number;
  mpc_reachable: boolean; foobar_reachable: boolean;
  playback: { playingtitle?: string; playingsinger?: string; status?: string } | null;
  password_configured: boolean;
}
export interface PlayerAgentStatus {
  connected: boolean;
  /** RFC1918 IPv4 candidates reported by the authenticated Windows Agent; Admin-only. */
  lanAddresses?: string[];
  userLanPort?: number;
  testReady: boolean;
  mediaRootConfigured: boolean;
  everything: 'not_checked'|'connected_no_media'|'connected_media_found'|'unavailable';
  agentSearchEnabled?: boolean;
  launcher?: { connected: boolean; state: 'starting'|'running'|'stopping'|'stopped'|'error'; error?: string };
  agentError?: string;
  autoplayEnabled: boolean;
  manualMode: boolean;
  manualStartRequested: boolean;
  nodeOwnsQueue: boolean;
  nodeAutoplayAvailable: boolean;
  autoplayUnavailableReason?: string;
  blockedReason?: string;
  playback: 'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable';
  file?: string;
  mpv?: MpvLiveStatus;
  task: { id: string; kind: 'test'|'queue'; requestId?: number; state: 'pending'|'claimed'|'playing'|'completed'|'failed'|'uncertain'; createdAt: number; error?: string } | null;
}
export interface ConnectionEntry { roomName:string; publicUrl:string; preferredMode:'lan'|'public'; revision?:number }
export interface MpvTrack { id: number; title?: string; language?: string; codec?: string; selected: boolean }
export interface MpvLiveStatus {
  connected: boolean;
  state: 'idle'|'playing'|'paused'|'stopped'|'unavailable';
  file?: string;
  duration?: number;
  position?: number;
  volume?: number;
  muted?: boolean;
  audioDelay?: number;
  keySemitones?: number;
  keyChangeAvailable?: boolean;
  fullscreen?: boolean;
  audioTracks: MpvTrack[];
  selectedAudioTrackId?: number;
  subtitleTracks: MpvTrack[];
  selectedSubtitleTrackId?: number;
  error?: 'MPV_IPC_UNAVAILABLE'|'MPV_STATUS_UNAVAILABLE';
}
export interface PublicPlayerStatus {
  connected: boolean;
  playback: PlayerAgentStatus['playback'];
  active: boolean;
  taskState: 'pending'|'claimed'|'playing'|'uncertain'|null;
  mpv: (Omit<MpvLiveStatus, 'file' | 'error'> & { controlAck?: { id: string; ok: boolean; error?: string } }) | null;
}
export type MpvControlInput =
  | { action: 'seek'; position: number }
  | { action: 'volume'; value: number }
  | { action: 'mute'; value: boolean }
  | { action: 'audio-track'; trackId: number }
  | { action: 'subtitle-track'; trackId: number | null }
  | { action: 'audio-delay'; value: number }
  | { action: 'key-change'; semitones: number }
  | { action: 'fullscreen'; value: boolean };
export type MediaAvailability = 'playable' | 'path_unmapped' | 'file_missing' | 'invalid_path' | 'agent_offline' | 'pending' | 'claimed';
export interface ReservationInput {
  participantId?: string;
  filename: string; fullpath: string; singer: string; comment: string; kind: '動画' | '小休止' | 'カラオケ配信' | 'URL指定' | '動画_別プ'; secret?: number | string;
  freesinger?: string; selectid?: number | string; loop?: number | string; otherplayer?: number | string; urlreq?: number | string;
  keychange?: number | string; track?: number | string; pause?: number | string; audiodelay?: number | string; volume?: number | string; duration?: number | string;
}
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR', public legacyReason?: string,
    public requestId?: string, public stage?: string, public relatedRequestId?: string) { super(message); }
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
    throw new ApiError(error?.message || `请求失败（HTTP ${response.status}）`, response.status, error?.code || 'API_ERROR', error?.legacyReason,
      error?.requestId || response.headers.get('x-yukari-request-id') || undefined);
  }
  return result.data;
}
