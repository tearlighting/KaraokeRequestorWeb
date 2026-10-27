import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { MediaPathResolver } from '../../media-agent/src/media-path.js';
import { MpvJsonIpcAdapter, type MpvControl, type PlayerStatus } from './mpv.js';
import { loadAgentConfig } from './config.js';
import { acquireInstanceLock } from './instance-lock.js';
import { searchEverything, type EverythingHealth } from '../../media-agent/src/everything.js';

const config = loadAgentConfig();
const { apiUrl: api, token, id, executable, mediaRoot, testVideo, pathMappings, lockDir, everythingUrl, everythingUsername, everythingPassword } = config;
if (!/^[A-Za-z0-9_-]{1,50}$/.test(id)) throw new Error('YUKARI_PLAYER_AGENT_ID must be 1-50 safe characters');
if (token.length < 32) throw new Error('Set YUKARI_PLAYER_AGENT_TOKEN to the private token from .local/player-agent-token');
if (!executable || !mediaRoot) throw new Error('Set MPV_PATH and PLAYER_MEDIA_ROOT');
const paths = new MediaPathResolver(mediaRoot, pathMappings);
// The Agent may connect while waiting for a local test clip. A task cannot be
// accepted until its configured file is present and passes the root check.
const testPath = testVideo ? paths.resolve(testVideo) : null;

// Prevent two Agent processes on this Windows profile from consuming the same task.
mkdirSync(lockDir, { recursive: true });
const lockPath = join(lockDir, 'agent.lock');
const releaseLock = acquireInstanceLock(lockPath);
const adapter = new MpvJsonIpcAdapter(executable, 4000, `yukari-player-${id}`);
let currentTask = '';
let activePlayback = false;
let pendingEndReport: Report | null = null;
let closing = false;
let controlServer: Server | undefined;
let searchBusy=false;
let everythingHealth:EverythingHealth|'not_checked'='not_checked';
let lastAgentError:string|undefined;
let lastProbeAt=0;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${api}/api/v1/agent/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  } catch (error) {
    throw new Error(`Agent API ${path} transport failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const value = await response.json() as { ok?: boolean; data?: T; error?: { code?: string; message?: string } };
  if (!response.ok || value.ok !== true) throw new Error(`API ${response.status} ${value.error?.code || ''}: ${value.error?.message || 'request failed'}`);
  return value.data as T;
}
type Assignment = { task: { id: string; kind: 'test'|'queue'; requestId?: number; mediaPath?: string; initialVolume?:number; state: 'claimed'|'playing' } | null; command: 'pause'|'resume'|'stop'|'skip'|null; commandTaskId?: string; mpvControl?:MpvControl|null; mediaCheck?: { id: string; requestId: number; path: string }; searchJob?:{id:string;keyword:string} };
type Report = { taskId?: string; state?: 'claimed'|'playing'|'completed'|'failed'; playback: 'idle'|'starting'|'playing'|'paused'|'stopped'|'unavailable'; file?: string; error?: string; endReason?: 'eof'; outcome?: 'skipped'; mpv?:ReturnType<typeof publicStatus>; controlAck?:{id:string;ok:boolean;error?:'MPV_IPC_UNAVAILABLE'|'MPV_NOT_PLAYING'|'MPV_CONTROL_FAILED'|'MPV_TRACK_UNAVAILABLE'|'MPV_KEY_CHANGE_UNAVAILABLE'} };
const mapStatus = (value: PlayerStatus['state']): Report['playback'] => value;
function publicStatus(status:PlayerStatus){const{path:_path,...safe}=status;return safe;}

async function report(value: Report) { return call('report', { agentId: id, testReady: Boolean(testPath), everything:everythingHealth, mediaRootConfigured:Boolean(mediaRoot), agentError:lastAgentError??null, ...value }); }
async function performSearch(job:{id:string;keyword:string}) {
  searchBusy=true;
  const outcome=await searchEverything(job.keyword,everythingUrl,paths,{username:everythingUsername,password:everythingPassword,timeoutMs:3500});
  everythingHealth=outcome.health;lastAgentError=outcome.error;
  try { await call('search-result',{agentId:id,searchId:job.id,health:outcome.health,error:outcome.error,items:outcome.items}); }
  catch(error) { lastAgentError='SEARCH_REPORT_FAILED';process.stderr.write('Everything search result could not be delivered to Fastify; browser request will expire.\n'); }
  finally { searchBusy=false; }
}
async function probeEverything(){
  lastProbeAt=Date.now();const outcome=await searchEverything(`path:"${mediaRoot}"`,everythingUrl,paths,{username:everythingUsername,password:everythingPassword,timeoutMs:2500});
  everythingHealth=outcome.health;lastAgentError=outcome.error;
  try{const actual=await adapter.getStatus();await report({playback:mapStatus(actual.state),file:actual.file,mpv:publicStatus(actual)});}catch{/* The next normal heartbeat will publish current player state. */}
}
async function executeCommand(command: NonNullable<Assignment['command']>) {
  if (!currentTask && command === 'stop') { await adapter.stop(); return; }
  if (!currentTask) return;
  if (command === 'stop' || command === 'skip') activePlayback = false;
  if (command === 'pause') await adapter.pause();
  else if (command === 'resume') await adapter.play();
  else await adapter.stop();
  const actual = await adapter.getStatus();
  if (command === 'stop' || command === 'skip') {
    await report({ taskId: currentTask, state: 'failed', playback: 'stopped', file: actual.file,
      ...(command === 'skip' ? { outcome: 'skipped', error: '邂｡逅・遭霍ｳ霑・ｭ､鬚・ｺｦ' } : { error: '邂｡逅・遭蛛懈ｭ｢閾ｪ蜉ｨ謦ｭ謾ｾ' }) }); currentTask = '';
  } else await report({ taskId: currentTask, state: 'playing', playback: mapStatus(actual.state), file: actual.file, mpv:publicStatus(actual) });
}

adapter.onEnded((event) => {
  const taskId = currentTask; if (!taskId || !activePlayback || closing) return;
  activePlayback = false;
  const completed = event.reason === 'eof';
  pendingEndReport = { taskId, state: completed ? 'completed' : 'failed', playback: event.reason === 'stop' ? 'stopped' : 'idle', ...(completed ? { endReason: 'eof' } : { error: event.error || `mpv ended: ${event.reason}` }) };
});

async function runTask(task: NonNullable<Assignment['task']>) {
  currentTask = task.id;
  activePlayback = false;
  const target = task.kind === 'test' ? testPath : task.mediaPath ? paths.resolveQueueFile(task.mediaPath) : null;
  if (!target) throw new Error(task.kind === 'test' ? 'Set PLAYER_TEST_VIDEO to a file under PLAYER_MEDIA_ROOT before starting a test task' : 'Queue task has no media path');
  const actual = await adapter.getStatus();
  if (task.state === 'playing') {
    // After an Agent restart, never replay a task that mpv cannot confirm is still active.
    if (actual.path !== target || actual.state === 'idle') throw new Error('mpv no longer reports the active task; refusing an automatic replay');
  } else {
    await report({ taskId: task.id, state: 'claimed', playback: 'starting', file: basename(target) });
    // A fresh claim is a new task even when it points to the same file that
    // mpv happened to have loaded before. Replace it and apply the configured
    // initial volume once; polling/playing recoveries never enter this branch.
    if(task.kind==='queue'&&task.initialVolume!==undefined)await adapter.setInitialVolume(task.initialVolume);
    await adapter.open(target);
  }
  const verified = await adapter.getStatus();
  if (verified.path !== target || !['playing','paused'].includes(verified.state)) throw new Error('mpv did not confirm the configured media is loaded');
  activePlayback = true;
  await report({ taskId: task.id, state: 'playing', playback: mapStatus(verified.state), file: verified.file, mpv:publicStatus(verified) });
}

let lastControlResult:Report['controlAck']|undefined;
async function executeMpvControl(control:MpvControl){
  if(control.taskId!==currentTask){lastControlResult={id:control.id,ok:false,error:'MPV_NOT_PLAYING'};}
  else if(lastControlResult?.id!==control.id){
    try{await adapter.applyControl(control);lastControlResult={id:control.id,ok:true};}
    catch(error){const reason=error instanceof Error?error.message:'';lastControlResult={id:control.id,ok:false,error:reason==='MPV_IPC_UNAVAILABLE'?'MPV_IPC_UNAVAILABLE':reason==='MPV_NOT_PLAYING'?'MPV_NOT_PLAYING':reason==='MPV_KEY_CHANGE_UNAVAILABLE'?'MPV_KEY_CHANGE_UNAVAILABLE':reason.includes('TRACK')?'MPV_TRACK_UNAVAILABLE':'MPV_CONTROL_FAILED'};}
  }
  const actual=await adapter.getStatus();
  await report({playback:mapStatus(actual.state),file:actual.file,mpv:publicStatus(actual),controlAck:lastControlResult});
}

async function loop() {
  while (!closing) {
    try {
      if(Date.now()-lastProbeAt>30000)void probeEverything();
      const assignment = await call<Assignment>('next', { agentId: id, testReady: Boolean(testPath), searchReady:!searchBusy });
      if(assignment.searchJob&&!searchBusy)void performSearch(assignment.searchJob);
      if (assignment.mediaCheck) {
        const result = paths.checkQueueFile(assignment.mediaCheck.path);
        await call('media-check', { agentId: id, checkId: assignment.mediaCheck.id, result });
        continue;
      }
      if (pendingEndReport) {
        const endedTask = pendingEndReport.taskId;
        await report(pendingEndReport); pendingEndReport = null;
        if (currentTask === endedTask) currentTask = '';
        continue;
      }
      if (assignment.command) {
        if(!currentTask&&assignment.command==='stop'&&assignment.commandTaskId)currentTask=assignment.commandTaskId;
        await executeCommand(assignment.command);
        // The assignment was captured before executing the command. A stop
        // makes the server task terminal, so do not act on that stale copy and
        // reopen the just-stopped file in this same poll cycle.
        if (assignment.command === 'stop' || assignment.command === 'skip') {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
      }
      const task = assignment.task;
      if (task && task.id !== currentTask) await runTask(task);
      else if (!task && currentTask) {
        // The server may have restarted. Stop rather than play without an authoritative task.
        await adapter.stop(); currentTask = '';
      } else if (task && task.id === currentTask) {
        const actual = await adapter.getStatus();
        const expectedPath = task.kind === 'test' ? testPath : task.mediaPath ? paths.resolveQueueFile(task.mediaPath) : null;
        if (actual.path === expectedPath && (actual.state === 'playing' || actual.state === 'paused')) activePlayback = true;
        await report({playback:mapStatus(actual.state),file:actual.file,mpv:publicStatus(actual)});
      } else { const actual=await adapter.getStatus();await report({playback:mapStatus(actual.state),file:actual.file,mpv:publicStatus(actual)}); }
      if(assignment.mpvControl){await executeMpvControl(assignment.mpvControl);}else lastControlResult=undefined;
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
  controlServer?.close();
  await adapter.close(); releaseLock();
}
process.on('SIGINT', () => void shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)));
process.on('uncaughtException', error => { process.stderr.write(`Fatal Agent error: ${String(error)}\n`); void shutdown().then(() => process.exit(1)); });
if (process.platform === 'win32') {
  const pipePath = `\\\\.\\pipe\\yukari-agent-${id}`;
  controlServer = createServer(socket => {
    socket.setEncoding('utf8');
    let command = '';
    socket.on('data', chunk => { command += chunk; if (command.length > 32) socket.destroy(); });
    socket.on('end', () => {
      if (command.trim() === 'stop') { socket.end('stopping'); void shutdown().then(() => process.exit(0)); }
      else socket.end('denied');
    });
  });
  controlServer.listen(pipePath);
}
process.stdout.write(`Player Agent ${id} started for ${api}; ${testPath ? 'test video is configured under the media root' : 'waiting for PLAYER_TEST_VIDEO'}.\n`);
await loop();
