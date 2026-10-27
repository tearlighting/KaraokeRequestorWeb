import { ApiError, apiJson, record } from '../../lib/api';
import type { MpvControlInput, PublicPlayerStatus } from '../../../../../packages/contracts/src/index';

export interface QueueItem {
  id: number;
  position: number;
  display_name: string;
  singer: string;
  nowplaying: string;
  kind: string;
}
export interface Queue { items: QueueItem[]; total: number; remaining: number }
export interface Playback { playing: boolean; title: string; singer: string; status: string }

export async function getPlayerStatus(): Promise<PublicPlayerStatus> {
  const data = await apiJson('/playback/agent');
  if (typeof data.connected !== 'boolean' || typeof data.active !== 'boolean' || !['idle','starting','playing','paused','stopped','unavailable'].includes(String(data.playback)))
    throw new ApiError('Invalid player status response', 502, 'INVALID_PLAYER_STATUS');
  return data as unknown as PublicPlayerStatus;
}

export async function controlPlayer(input: MpvControlInput | { action: 'pause' | 'resume' }): Promise<{ queued: boolean; action: string; id?: string }> {
  return apiJson('/playback/mpv-control', { method: 'POST', body: JSON.stringify(input) }) as Promise<{ queued: boolean; action: string; id?: string }>;
}

export async function getQueue(): Promise<Queue> {
  const data = await apiJson('/queue');
  if (!Array.isArray(data.items) || typeof data.total !== 'number') throw new ApiError('队列接口缺少 items 或 total');
  const items = data.items.map((value) => {
    const row = record(value);
    if (typeof row.id !== 'number' || typeof row.position !== 'number' || typeof row.nowplaying !== 'string') throw new ApiError('队列记录缺少 ID、位置或状态');
    return {
      id: row.id, position: row.position, display_name: String(row.display_name ?? ''),
      singer: String(row.singer ?? ''), nowplaying: row.nowplaying, kind: String(row.kind ?? ''),
    };
  });
  // Preserve server order and server position, including secret display_name masking.
  return { items, total: data.total, remaining: Number(data.remaining_count ?? 0) };
}

export async function getPlayback(): Promise<Playback> {
  const data = await apiJson('/playback');
  if (typeof data.playing !== 'boolean') throw new ApiError('播放状态接口缺少 playing');
  return { playing: data.playing, title: String(data.playingtitle ?? ''), singer: String(data.playingsinger ?? ''), status: String(data.status ?? '') };
}
