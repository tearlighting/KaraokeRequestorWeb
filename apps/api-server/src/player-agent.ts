import { randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BoundaryError } from './errors.js';

export type TaskState = 'pending' | 'claimed' | 'playing' | 'completed' | 'failed';
export type AgentPlayback = 'idle' | 'starting' | 'playing' | 'paused' | 'stopped' | 'unavailable';
export interface PlaybackTask { id: string; kind: 'test'; state: TaskState; createdAt: number; agentId?: string; error?: string }
interface PersistedState { task: PlaybackTask | null; agent: { id: string; seenAt: number; playback: AgentPlayback; testReady: boolean; file?: string } | null; command: 'pause' | 'resume' | 'stop' | null }
const blank = (): PersistedState => ({ task: null, agent: null, command: null });

/** Atomic JSON snapshot on a dedicated Docker volume; queue SQLite/schema is untouched. */
export class PlayerTaskStore {
  private state: PersistedState;
  constructor(private path: string, private clock = () => Date.now()) {
    mkdirSync(dirname(path), { recursive: true });
    try { this.state = JSON.parse(readFileSync(path, 'utf8')) as PersistedState; }
    catch { this.state = blank(); this.save(); }
    if (!this.valid(this.state)) throw new Error('Invalid persisted player state');
  }
  private valid(value: PersistedState) {
    return value && (value.task === null || (typeof value.task.id === 'string' && ['pending','claimed','playing','completed','failed'].includes(value.task.state)))
      && (value.agent === null || typeof value.agent.id === 'string') && [null,'pause','resume','stop'].includes(value.command);
  }
  private save() {
    const temp = `${this.path}.${randomUUID()}.tmp`;
    writeFileSync(temp, JSON.stringify(this.state), { mode: 0o600 });
    renameSync(temp, this.path);
  }
  status() {
    const seen = this.state.agent?.seenAt || 0;
    const connected = seen > 0 && this.clock() - seen < 15000;
    return { connected, testReady: connected && this.state.agent?.testReady === true, playback: connected ? this.state.agent?.playback || 'unavailable' as AgentPlayback : 'unavailable' as AgentPlayback,
      ...(connected && this.state.agent?.file ? { file: this.state.agent.file } : {}), task: this.state.task ? { ...this.state.task } : null };
  }
  createTest() {
    const status = this.status();
    if (!status.connected) throw new BoundaryError(503, 'PLAYER_AGENT_OFFLINE', 'Player Agent is offline');
    if (!status.testReady) throw new BoundaryError(409, 'PLAYER_TEST_NOT_READY', 'Configure a test video under PLAYER_MEDIA_ROOT first');
    if (this.state.task && ['pending','claimed','playing'].includes(this.state.task.state)) throw new BoundaryError(409, 'PLAYER_BUSY', '当前播放任务尚未结束');
    this.state.task = { id: randomUUID(), kind: 'test', state: 'pending', createdAt: this.clock() };
    this.state.command = null; this.save(); return { ...this.state.task };
  }
  control(action: 'pause' | 'resume' | 'stop') {
    if (!this.state.task || !['claimed','playing'].includes(this.state.task.state)) throw new BoundaryError(409, 'NO_ACTIVE_PLAYER_TASK', '没有可控制的播放任务');
    this.state.command = action; this.save(); return { taskId: this.state.task.id, action, queued: true as const };
  }
  next(agentId: string, testReady = false) {
    this.state.agent = { id: agentId, seenAt: this.clock(), playback: this.state.agent?.playback || 'idle', testReady, ...(this.state.agent?.file ? { file: this.state.agent.file } : {}) };
    const task = this.state.task;
    if (task?.state === 'pending') { task.state = 'claimed'; task.agentId = agentId; }
    const assigned = task && task.agentId === agentId && ['claimed','playing'].includes(task.state) ? { ...task } : null;
    const command = this.state.command; this.save();
    return { task: assigned, command };
  }
  report(agentId: string, input: { taskId?: string; state?: 'claimed'|'playing'|'completed'|'failed'; playback: AgentPlayback; testReady?: boolean; file?: string; error?: string }) {
    const task = this.state.task;
    if (input.taskId && (!task || task.id !== input.taskId || task.agentId !== agentId)) throw new BoundaryError(409, 'STALE_PLAYER_TASK', '播放任务已失效');
    if (input.state) {
      if (!task || task.agentId !== agentId) throw new BoundaryError(409, 'STALE_PLAYER_TASK', '播放任务未分配给此 Agent');
      const transitions: Record<TaskState, TaskState[]> = { pending: ['claimed'], claimed: ['claimed','playing','failed'], playing: ['playing','completed','failed'], completed: [], failed: [] };
      if (!transitions[task.state].includes(input.state)) throw new BoundaryError(409, 'INVALID_PLAYER_TRANSITION', `${task.state} → ${input.state} 不允许`);
      task.state = input.state;
      if (input.state === 'failed') task.error = (input.error || '播放器报告失败').slice(0, 300);
    }
    this.state.command = null;
    this.state.agent = { id: agentId, seenAt: this.clock(), playback: input.playback, testReady: input.testReady === true, ...(input.file ? { file: input.file.slice(0, 255) } : {}) };
    this.save(); return this.status();
  }
}

export function agentAuthorized(header: string | undefined, expected: string) {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const left = Buffer.from(token), right = Buffer.from(expected);
  return left.length === right.length && left.length >= 32 && timingSafeEqual(left, right);
}
