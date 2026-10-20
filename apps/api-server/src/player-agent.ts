import { randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BoundaryError } from './errors.js';

export type TaskState = 'pending' | 'claimed' | 'playing' | 'completed' | 'failed';
export type AgentPlayback = 'idle' | 'starting' | 'playing' | 'paused' | 'stopped' | 'unavailable';
export interface PlaybackTask { id: string; kind: 'test'|'queue'; requestId?: number; state: TaskState; createdAt: number; agentId?: string; error?: string }
interface PersistedState { task: PlaybackTask | null; agent: { id: string; seenAt: number; playback: AgentPlayback; testReady: boolean; file?: string } | null; command: 'pause' | 'resume' | 'stop' | 'skip' | null; autoplayEnabled: boolean; manualMode?: boolean; manualStartRequested?: boolean; blockedReason?: string }
const blank = (): PersistedState => ({ task: null, agent: null, command: null, autoplayEnabled: false, manualMode: false, manualStartRequested: false });

/** Atomic JSON snapshot on a dedicated Docker volume; queue SQLite/schema is untouched. */
export class PlayerTaskStore {
  private state: PersistedState;
  constructor(private path: string, private clock = () => Date.now()) {
    mkdirSync(dirname(path), { recursive: true });
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<PersistedState>;
      this.state = { ...blank(), ...parsed } as PersistedState;
    }
    catch { this.state = blank(); this.save(); }
    if (!this.valid(this.state)) throw new Error('Invalid persisted player state');
  }
  private valid(value: PersistedState) {
    return value && typeof value.autoplayEnabled === 'boolean'
      && (value.task === null || (typeof value.task.id === 'string' && ['pending','claimed','playing','completed','failed'].includes(value.task.state) && ['test','queue'].includes(value.task.kind)))
      && (value.agent === null || typeof value.agent.id === 'string') && [null,'pause','resume','stop','skip'].includes(value.command);
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
      autoplayEnabled: this.state.autoplayEnabled, manualMode: this.state.manualMode === true, manualStartRequested: this.state.manualStartRequested === true,
      ...(this.state.blockedReason ? { blockedReason: this.state.blockedReason } : {}),
      ...(connected && this.state.agent?.file ? { file: this.state.agent.file } : {}), task: this.state.task?.kind==='test' ? { ...this.state.task } : null };
  }
  pendingCommand() { return this.state.command; }
  createTest() {
    const status = this.status();
    if (!status.connected) throw new BoundaryError(503, 'PLAYER_AGENT_OFFLINE', 'Player Agent is offline');
    if (!status.testReady) throw new BoundaryError(409, 'PLAYER_TEST_NOT_READY', 'Configure a test video under PLAYER_MEDIA_ROOT first');
    if (this.state.autoplayEnabled) throw new BoundaryError(409, 'AUTOPLAY_ACTIVE', '自动播放已启用；先停止自动播放再运行本地测试');
    if (this.state.task?.kind==='test' && ['pending','claimed','playing'].includes(this.state.task.state)) throw new BoundaryError(409, 'PLAYER_BUSY', 'Local test task is active');
    this.state.task = { id: randomUUID(), kind: 'test', state: 'pending', createdAt: this.clock() };
    this.state.command = null; this.save(); return { ...this.state.task };
  }
  setAutoplay(enabled:boolean,blockedReason?:string) {
    this.state.autoplayEnabled=enabled;this.state.blockedReason=blockedReason;
    if (!enabled) { this.state.manualMode=false; this.state.manualStartRequested=false; }
    this.save();
  }
  armManual() {
    const status=this.status();
    if(!status.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
    if(this.state.task?.kind==='test'&&['pending','claimed','playing'].includes(this.state.task.state))throw new BoundaryError(409,'PLAYER_BUSY','Stop the local test task before queue playback');
    this.state.autoplayEnabled=true;this.state.manualMode=true;this.state.manualStartRequested=false;this.state.blockedReason=undefined;this.save();
    return {autoplayEnabled:true,manualMode:true};
  }
  requestManualStart() {
    const status=this.status();
    if(!status.connected)throw new BoundaryError(503,'PLAYER_AGENT_OFFLINE','Player Agent is offline');
    if(!this.state.autoplayEnabled||!this.state.manualMode)throw new BoundaryError(409,'MANUAL_PLAYBACK_NOT_ARMED','Arm manual playback before starting the next request');
    this.state.manualStartRequested=true;this.save();return {manualStartRequested:true};
  }
  consumeManualStart() { if(this.state.manualStartRequested){this.state.manualStartRequested=false;this.save();} }
  control(action: 'pause' | 'resume' | 'stop' | 'skip') {
    if (!this.state.task || this.state.task.kind!=='test' || !['claimed','playing'].includes(this.state.task.state)) throw new BoundaryError(409, 'NO_ACTIVE_PLAYER_TASK', 'No active test task');
    this.state.command = action; this.save(); return { taskId: this.state.task.id, action, queued: true as const };
  }
  autoplayAction(action:'start'|'stop'|'skip'|'pause'|'resume') {
    if(action==='start') {
      if(this.state.task?.kind==='test'&&['pending','claimed','playing'].includes(this.state.task.state))throw new BoundaryError(409,'PLAYER_BUSY','本地测试任务仍在运行');
      this.state.manualMode=false;this.state.manualStartRequested=false;
      this.setAutoplay(true); return {autoplayEnabled:true,taskId:this.state.task?.kind==='test'?this.state.task.id:undefined};
    }
    if(action==='stop') {
      this.state.autoplayEnabled=false;
      this.state.manualMode=false;this.state.manualStartRequested=false;
      if(this.state.task?.kind==='test'&&['claimed','playing'].includes(this.state.task.state))this.state.command='stop';
      this.save();return {autoplayEnabled:false,taskId:this.state.task?.kind==='test'?this.state.task.id:undefined};
    }
    return this.control(action);
  }
  next(agentId: string, testReady = false) {
    this.state.agent = { id: agentId, seenAt: this.clock(), playback: this.state.agent?.playback || 'idle', testReady, ...(this.state.agent?.file ? { file: this.state.agent.file } : {}) };
    const task = this.state.task;
    if (task?.kind==='test' && task.state === 'pending') { task.state = 'claimed'; task.agentId = agentId; }
    const assigned = task?.kind==='test' && task.agentId === agentId && ['claimed','playing'].includes(task.state) ? { ...task } : null;
    const command = this.state.command; this.save();
    return { task: assigned, command, commandTaskId: undefined as string|undefined };
  }
  validateReport(agentId: string, input: { taskId?: string; state?: 'claimed'|'playing'|'completed'|'failed' }) {
    const task = this.state.task;
    if (input.taskId && (!task || task.id !== input.taskId || task.agentId !== agentId)) throw new BoundaryError(409, 'STALE_PLAYER_TASK', 'Stale player task');
    if (!input.state) return;
    if (!task || task.agentId !== agentId) throw new BoundaryError(409, 'STALE_PLAYER_TASK', 'Task is not assigned to this Agent');
    const transitions: Record<TaskState, TaskState[]> = { pending: ['claimed'], claimed: ['claimed','playing','failed'], playing: ['playing','completed','failed'], completed: [], failed: [] };
    if (!transitions[task.state].includes(input.state)) throw new BoundaryError(409, 'INVALID_PLAYER_TRANSITION', `${task.state} -> ${input.state} is not allowed`);
  }
  report(agentId: string, input: { taskId?: string; state?: 'claimed'|'playing'|'completed'|'failed'; playback: AgentPlayback; testReady?: boolean; file?: string; error?: string; outcome?:'skipped' }) {
    this.validateReport(agentId, input);
    const task = this.state.task;
    if (input.taskId && (!task || task.id !== input.taskId || task.agentId !== agentId)) throw new BoundaryError(409, 'STALE_PLAYER_TASK', '播放任务已失效');
    if (input.state) {
      if (!task || task.agentId !== agentId) throw new BoundaryError(409, 'STALE_PLAYER_TASK', '播放任务未分配给此 Agent');
      const transitions: Record<TaskState, TaskState[]> = { pending: ['claimed'], claimed: ['claimed','playing','failed'], playing: ['playing','completed','failed'], completed: [], failed: [] };
      if (!transitions[task.state].includes(input.state)) throw new BoundaryError(409, 'INVALID_PLAYER_TRANSITION', `${task.state} → ${input.state} 不允许`);
      task.state = input.state;
      if (input.state === 'failed') task.error = (input.error || '播放器报告失败').slice(0, 300);
      if (input.state === 'failed' && input.outcome !== 'skipped') this.state.autoplayEnabled = false;
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
