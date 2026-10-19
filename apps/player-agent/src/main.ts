import { randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { MediaPathResolver } from './media-path.js';
import { MpvJsonIpcAdapter, type PlayerStatus } from './mpv.js';

const api = (process.env.YUKARI_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const token = process.env.YUKARI_PLAYER_AGENT_TOKEN || '';
const id = process.env.YUKARI_PLAYER_AGENT_ID || `host_${hostname().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 44)}`;
if (!/^[A-Za-z0-9_-]{1,50}$/.test(id)) throw new Error('YUKARI_PLAYER_AGENT_ID must be 1-50 safe characters');
const executable = process.env.MPV_PATH || '';
const mediaRoot = process.env.PLAYER_MEDIA_ROOT || '';
const testVideo = process.env.PLAYER_TEST_VIDEO || '';
if (token.length < 32) throw new Error('Set YUKARI_PLAYER_AGENT_TOKEN to the private token from .local/player-agent-token');
if (!executable || !mediaRoot) throw new Error('Set MPV_PATH and PLAYER_MEDIA_ROOT');
const paths = new MediaPathResolver(mediaRoot);
// The Agent may connect while waiting for a local test clip. A task cannot be
// accepted until its configured file is present and passes the root check.
const testPath = testVideo ? paths.resolve(testVideo) : null;

// Prevent two Agent processes on this Windows profile from consuming the same task.
const lockDir = process.env.YUKARI_PLAYER_AGENT_LOCK_DIR || join(process.env.LOCALAPPDATA || homedir(), 'YukariPlayerAgent');
mkdirSync(lockDir, { recursive: true });
const lockPath = join(lockDir, 'agent.lock');
let lock: number;
try { lock = openSync(lockPath, 'wx'); }
catch { throw new Error(`Another Player Agent appears to be running (${lockPath})`); }
const adapter = new MpvJsonIpcAdapter(executable, 4000, `yukari-player-${id}`);
let currentTask = '';
let activePlayback = false;
let pendingEndReport: Report | null = null;
let closing = false;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${api}/api/v1/agent/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const value = await response.json() as { ok?: boolean; data?: T; error?: { code?: string; message?: string } };
  if (!response.ok || value.ok !== true) throw new Error(`API ${response.status} ${value.error?.code || ''}: ${value.error?.message || 'request failed'}`);
  return value.data as T;
}
type Assignment = { task: { id: string; kind: 'test'; state: 'claimed'|'playing' } | null; command: 'pause'|'resume'|'stop'|null };
type Report = { taskId?: string; state?: 'claimed'|'playing'|'completed'|'failed'; playback: 'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable'; file?: string; error?: string };
const mapStatus = (value: PlayerStatus['state']): Report['playback'] => value;

async function report(value: Report) { return call('report', { agentId: id, testReady: Boolean(testPath), ...value }); }
async function executeCommand(command: NonNullable<Assignment['command']>) {
  if (!currentTask) return;
  if (command === 'stop') activePlayback = false;
  if (command === 'pause') await adapter.pause();
  else if (command === 'resume') await adapter.play();
  else await adapter.stop();
  const actual = await adapter.getStatus();
  if (command === 'stop') {
    await report({ taskId: currentTask, state: 'failed', playback: 'stopped', file: actual.file, error: '管理员停止播放' }); currentTask = '';
  } else await report({ taskId: currentTask, state: 'playing', playback: mapStatus(actual.state), file: actual.file });
}

adapter.onEnded((event) => {
  const taskId = currentTask; if (!taskId || !activePlayback || closing) return;
  activePlayback = false;
  const completed = event.reason === 'eof';
  pendingEndReport = { taskId, state: completed ? 'completed' : 'failed', playback: event.reason === 'stop' ? 'stopped' : 'idle', ...(completed ? {} : { error: event.error || `mpv ended: ${event.reason}` }) };
});

async function runTask(task: NonNullable<Assignment['task']>) {
  if (task.kind !== 'test') throw new Error('Unsupported task kind');
  if (!testPath) throw new Error('Set PLAYER_TEST_VIDEO to a file under PLAYER_MEDIA_ROOT before starting a test task');
  currentTask = task.id;
  activePlayback = false;
  const actual = await adapter.getStatus();
  if (task.state === 'playing') {
    // After an Agent restart, never replay a task that mpv cannot confirm is still active.
    if (actual.path !== testPath || actual.state === 'idle') throw new Error('mpv no longer reports the active task; refusing an automatic replay');
  } else {
    await report({ taskId: task.id, state: 'claimed', playback: 'starting', file: testVideo.split(/[\\/]/).pop() });
    if (actual.path !== testPath || actual.state === 'idle') await adapter.open(testPath);
    else if (actual.state === 'paused') await adapter.play();
  }
  const verified = await adapter.getStatus();
  if (verified.path !== testPath || !['playing','paused'].includes(verified.state)) throw new Error('mpv did not confirm the configured video is loaded');
  activePlayback = true;
  await report({ taskId: task.id, state: 'playing', playback: mapStatus(verified.state), file: verified.file });
}

async function loop() {
  while (!closing) {
    try {
      const assignment = await call<Assignment>('next', { agentId: id, testReady: Boolean(testPath) });
      if (pendingEndReport) {
        const endedTask = pendingEndReport.taskId;
        await report(pendingEndReport); pendingEndReport = null;
        if (currentTask === endedTask) currentTask = '';
        continue;
      }
      if (assignment.command) await executeCommand(assignment.command);
      const task = assignment.task;
      if (task && task.id !== currentTask) await runTask(task);
      else if (!task && currentTask) {
        // The server may have restarted. Stop rather than play without an authoritative task.
        await adapter.stop(); currentTask = '';
      } else if (task && task.id === currentTask) {
        const actual = await adapter.getStatus();
        if (actual.path === testPath && (actual.state === 'playing' || actual.state === 'paused')) activePlayback = true;
        await report({ taskId: task.id, state: actual.state === 'playing' || actual.state === 'paused' ? 'playing' : undefined,
          playback: mapStatus(actual.state), file: actual.file });
      } else await report({ playback: currentTask ? 'unavailable' : 'idle' });
    } catch (error) {
      if (pendingEndReport) {
        try { await report(pendingEndReport); if (currentTask === pendingEndReport.taskId) currentTask = ''; pendingEndReport = null; }
        catch { process.stderr.write(`Player completion report pending API reconnect: ${String(error)}\n`); }
      } else if (currentTask) {
        const taskId = currentTask; currentTask = '';
        try { await adapter.stop(); } catch { /* the report still records an uncertain player failure */ }
        try { await report({ taskId, state: 'failed', playback: 'unavailable', error: String(error).slice(0, 250) }); } catch { /* reconnect loop retries transport */ }
      } else process.stderr.write(`Player Agent API/IPC unavailable: ${String(error)}\n`);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

async function shutdown() {
  if (closing) return; closing = true;
  try { if (currentTask) { await adapter.stop(); await report({ taskId: currentTask, state: 'failed', playback: 'stopped', error: 'Agent shutting down' }); } } catch { /* shutdown cannot claim successful state */ }
  await adapter.close(); closeSync(lock); try { unlinkSync(lockPath); } catch { /* lock cleanup is best effort */ }
}
process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
process.on('uncaughtException', error => { process.stderr.write(`Fatal Agent error: ${String(error)}\n`); void shutdown().then(() => process.exit(1)); });
process.stdout.write(`Player Agent ${id} started for ${api}; ${testPath ? 'test video is configured under the media root' : 'waiting for PLAYER_TEST_VIDEO'}.\n`);
await loop();
