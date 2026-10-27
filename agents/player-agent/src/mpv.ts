import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { basename } from 'node:path';

import type { MpvLiveStatus, MpvTrack } from '../../../packages/contracts/src/index.js';

export type MpvControl =
  | { id: string; taskId: string; action: 'seek'; position: number }
  | { id: string; taskId: string; action: 'volume'; value: number }
  | { id: string; taskId: string; action: 'mute'; value: boolean }
  | { id: string; taskId: string; action: 'audio-track'; trackId: number }
  | { id: string; taskId: string; action: 'subtitle-track'; trackId: number|null }
  | { id: string; taskId: string; action: 'audio-delay'; value: number }
  | { id: string; taskId: string; action: 'key-change'; semitones: number }
  | { id: string; taskId: string; action: 'fullscreen'; value: boolean };
export type PlayerStatus = MpvLiveStatus & { path?: string };
export interface PlayerAdapter {
  open(path: string, initialKeySemitones?: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<PlayerStatus>;
  onEnded(listener: (result: { reason: 'eof'|'stop'|'error'; error?: string }) => void): void;
  close(): Promise<void>;
}

type MpvMessage = { request_id?: number; error?: string; data?: unknown; event?: string; reason?: string; file_error?: string };
export class MpvJsonIpcAdapter implements PlayerAdapter {
  private child: ChildProcess | null = null;
  private socket: net.Socket | null = null;
  private buffer = '';
  private requestId = 0;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  private fileLoadedListeners = new Set<() => void>();
  private appliedKeySemitones: number | undefined;
  private ended = (_: { reason: 'eof'|'stop'|'error'; error?: string }) => {};
  private pipe: string;
  constructor(private executable: string, private timeoutMs = 4000, pipeName = `yukari-player-${randomUUID()}`) {
    if (!existsSync(executable)) throw new Error('MPV_PATH does not exist');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(pipeName)) throw new Error('Invalid mpv pipe name');
    this.pipe = `\\\\.\\pipe\\${pipeName}`;
  }
  onEnded(listener: (result: { reason: 'eof'|'stop'|'error'; error?: string }) => void) { this.ended = listener; }
  private receive(message: MpvMessage) {
    if (message.request_id !== undefined) {
      const entry = this.pending.get(message.request_id); if (!entry) return;
      clearTimeout(entry.timer); this.pending.delete(message.request_id);
      if (message.error && message.error !== 'success') entry.reject(new Error(`mpv IPC: ${message.error}`)); else entry.resolve(message.data);
    }
    if (message.event === 'end-file') {
      const reason = message.reason === 'eof' ? 'eof' : message.reason === 'stop' ? 'stop' : 'error';
      this.ended({ reason, ...(message.file_error ? { error: message.file_error } : {}) });
    }
    if (message.event === 'file-loaded') for (const listener of [...this.fileLoadedListeners]) listener();
  }
  private connect(timeoutMs=this.timeoutMs) {
    return new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(this.pipe);
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('mpv IPC connection timeout')); }, timeoutMs);
      socket.once('connect', () => {
        clearTimeout(timer); this.socket = socket; resolve();
        socket.write(`${JSON.stringify({ command: ['observe_property', 1, 'pause'] })}\n`);
        socket.write(`${JSON.stringify({ command: ['observe_property', 2, 'idle-active'] })}\n`);
        socket.write(`${JSON.stringify({ command: ['observe_property', 3, 'path'] })}\n`);
        socket.on('data', (chunk) => {
          this.buffer += chunk.toString('utf8'); let index: number;
          while ((index = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
            try { this.receive(JSON.parse(line) as MpvMessage); } catch { /* ignore malformed notification; status query remains authoritative */ }
          }
        });
        socket.on('error', (error) => this.failPending(error));
        socket.on('close', () => { if (this.socket === socket) this.socket = null; this.failPending(new Error('mpv IPC disconnected')); });
      });
      socket.once('error', (error) => { clearTimeout(timer); reject(error); });
    });
  }
  private failPending(error: Error) {
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear();
  }
  private async ensure() {
    if (this.socket?.destroyed === false) return;
    try { await this.connect(); return; } catch { /* start a local mpv only if the configured IPC endpoint is absent */ }
    if (!this.child || this.child.exitCode !== null) {
      this.child = spawn(this.executable, ['--no-config', '--idle=yes', '--force-window=immediate', '--geometry=960x540+40+40', '--title=Yukari Player Agent', '--no-terminal', '--input-ipc-server=' + this.pipe], { shell: false, windowsHide: false, stdio: 'ignore' });
      this.child.once('error', (error) => this.failPending(error));
    }
    let last: Error | undefined;
    for (let i = 0; i < 40; i++) {
      try { await this.connect(); return; } catch (error) { last = error as Error; await new Promise(resolve => setTimeout(resolve, 150)); }
    }
    throw last || new Error('mpv IPC did not become ready');
  }
  private async send(command: unknown[], startIfMissing: boolean) {
    if(startIfMissing)await this.ensure();
    else if(this.socket?.destroyed!==false){await this.connect(Math.min(this.timeoutMs,500));}
    const socket = this.socket; if (!socket||socket.destroyed) throw new Error('mpv IPC unavailable');
    const id = ++this.requestId;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('mpv IPC request timed out')); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      socket.write(`${JSON.stringify({ command, request_id: id })}\n`, error => { if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); } });
    });
  }
  private command(command: unknown[]) { return this.send(command,true); }
  private commandExisting(command: unknown[]) { return this.send(command,false); }
  private async property(name: string) {
    try { return await this.commandExisting(['get_property', name]); }
    catch (error) {
      // mpv reports "property unavailable" for media-specific values such as
      // `path` while its idle window is open. That is a valid idle state, not
      // an IPC failure. getStatus still requires a concrete path before it can
      // report playing or paused, so this cannot turn an unloaded player into
      // a false positive.
      if (error instanceof Error && error.message === 'mpv IPC: property unavailable') return undefined;
      throw error;
    }
  }
  private async prepareKeyFilter() {
    const readFilters=async()=>await this.commandExisting(['get_property','af']) as unknown[];
    let filters=await readFilters();
    const hasFilter=()=>Array.isArray(filters)&&filters.some(value=>value&&typeof value==='object'&&(value as Record<string,unknown>).label==='yukari-key');
    if(!hasFilter()){
      await this.commandExisting(['af','add','@yukari-key:rubberband=pitch-scale=1']);
      filters=await readFilters();
    }
    if(!hasFilter())throw new Error('MPV_KEY_CHANGE_UNAVAILABLE');
    await this.commandExisting(['af-command','yukari-key','set-pitch','1']);
    this.appliedKeySemitones=0;
  }
  async getStatus(): Promise<PlayerStatus> {
    if(this.socket?.destroyed!==false){try{await this.connect(Math.min(this.timeoutMs,500));}catch{return {connected:false,state:'unavailable',audioTracks:[],subtitleTracks:[],error:'MPV_IPC_UNAVAILABLE'};}}
    try {
      const [idle, paused, path, duration, position, volume, muted, audioDelay, fullscreen, rawTracks, rawAf] = await Promise.all([
        this.property('idle-active'),this.property('pause'),this.property('path'),this.property('duration'),
        this.property('time-pos'),this.property('volume'),this.property('mute'),this.property('audio-delay'),this.property('fullscreen'),this.property('track-list'),this.property('af'),
      ]);
      const trackList=Array.isArray(rawTracks)?rawTracks:[];
      const typedTracks=trackList.map(value=>({type:value&&typeof value==='object'?(value as Record<string,unknown>).type:undefined,track:safeTrack(value)})).filter((entry):entry is {type:unknown;track:MpvTrack}=>entry.track!==null);
      const audioTracks=typedTracks.filter(entry=>entry.type==='audio').map(entry=>entry.track);
      const subtitleTracks=typedTracks.filter(entry=>entry.type==='sub').map(entry=>entry.track);
      const selectedAudioTrackId=audioTracks.find(track=>track.selected)?.id;
      const selectedSubtitleTrackId=subtitleTracks.find(track=>track.selected)?.id;
      const keyFilter=Array.isArray(rawAf)?rawAf.find(value=>value&&typeof value==='object'&&(value as Record<string,unknown>).label==='yukari-key') as Record<string,unknown>|undefined:undefined;
      // mpv's `af` property retains Rubber Band's construction parameters after
      // `af-command set-pitch`; it does not report its live dynamic pitch value.
      // Report only the last successful typed IPC command from this Agent.
      const keySemitones=keyFilter?this.appliedKeySemitones:undefined;
      const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
      if(idle===true||typeof path!=='string')return {connected:true,state:'idle',audioTracks,subtitleTracks,...(finite(volume)!==undefined?{volume:finite(volume)}:{}),...(typeof muted==='boolean'?{muted}:{}),...(finite(audioDelay)!==undefined?{audioDelay:finite(audioDelay)}:{}),...(typeof fullscreen==='boolean'?{fullscreen}:{}),keyChangeAvailable:Boolean(keyFilter),...(keySemitones!==undefined?{keySemitones}:{})};
      const state=paused===true?'paused':'playing';
      return {connected:true,state,file:basename(path),path,...(finite(duration)!==undefined?{duration:finite(duration)}:{}),...(finite(position)!==undefined?{position:finite(position)}:{}),...(finite(volume)!==undefined?{volume:finite(volume)}:{}),...(typeof muted==='boolean'?{muted}:{}),...(finite(audioDelay)!==undefined?{audioDelay:finite(audioDelay)}:{}),...(typeof fullscreen==='boolean'?{fullscreen}:{}),keyChangeAvailable:Boolean(keyFilter),...(keySemitones!==undefined?{keySemitones}:{}),audioTracks,subtitleTracks,...(selectedAudioTrackId!==undefined?{selectedAudioTrackId}:{}),...(selectedSubtitleTrackId!==undefined?{selectedSubtitleTrackId}:{})};
    } catch {
      return {connected:false,state:'unavailable',audioTracks:[],subtitleTracks:[],error:'MPV_STATUS_UNAVAILABLE'};
    }
  }
  async open(path: string, initialKeySemitones = 0) {
    if(!Number.isInteger(initialKeySemitones)||initialKeySemitones < -6||initialKeySemitones > 6)throw new Error('MPV_INVALID_KEY_CHANGE');
    // Hold audio until the pitch filter and requested key are applied. A keyed
    // request must never briefly start in the original key or silently fall back.
    const holdForKey=initialKeySemitones!==0;
    if(holdForKey)await this.commandExisting(['set_property','pause',true]);
    let timer: NodeJS.Timeout;
    let onLoaded: () => void;
    const loadedPromise = new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => { this.fileLoadedListeners.delete(onLoaded); reject(new Error('mpv did not report file-loaded')); }, 15000);
      onLoaded = () => { clearTimeout(timer); this.fileLoadedListeners.delete(onLoaded); resolve(); };
      this.fileLoadedListeners.add(onLoaded);
    });
    try { await this.command(['loadfile', path, 'replace']); await loadedPromise; }
    catch (error) { clearTimeout(timer!); this.fileLoadedListeners.delete(onLoaded!); throw error; }
    // Pitch support is optional for ordinary requests. A request that explicitly
    // asks for a key change fails closed if this mpv build cannot apply it.
    try {
      await this.prepareKeyFilter();
      if(holdForKey){await this.commandExisting(['af-command','yukari-key','set-pitch',String(2**(initialKeySemitones/12))]);this.appliedKeySemitones=initialKeySemitones;}
    } catch(error) {
      if(holdForKey)throw new Error('MPV_KEY_CHANGE_UNAVAILABLE');
      // Status reports keyChangeAvailable=false; unkeyed video still plays.
    }
    if(holdForKey)await this.commandExisting(['set_property','pause',false]);
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const status = await this.getStatus();
      if (status.path === path && status.state === 'playing') return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('mpv did not report the requested file as playing');
  }
  async setInitialVolume(value:number){
    if(!Number.isInteger(value)||value<0||value>100)throw new Error('Invalid configured start volume');
    await this.command(['set_property','volume',value]);
  }
  async play() { await this.commandExisting(['set_property', 'pause', false]); }
  async pause() { await this.commandExisting(['set_property', 'pause', true]); }
  async stop() { await this.commandExisting(['stop']); }
  async applyControl(control:MpvControl) {
    const status=await this.getStatus();
    if(!status.connected||!['playing','paused'].includes(status.state))throw new Error('MPV_NOT_PLAYING');
    if(control.action==='seek'){
      if(!Number.isFinite(control.position)||control.position<0||status.duration===undefined||control.position>status.duration)throw new Error('MPV_INVALID_SEEK');
      await this.commandExisting(['seek',control.position,'absolute+exact']);
    }else if(control.action==='volume'){
      if(!Number.isFinite(control.value)||control.value<0||control.value>130)throw new Error('MPV_INVALID_VOLUME');
      await this.commandExisting(['set_property','volume',control.value]);
    }else if(control.action==='mute'){
      await this.commandExisting(['set_property','mute',control.value]);
    }else if(control.action==='audio-track'){
      if(!status.audioTracks.some(track=>track.id===control.trackId))throw new Error('MPV_AUDIO_TRACK_UNAVAILABLE');
      await this.commandExisting(['set_property','aid',control.trackId]);
    }else if(control.action==='subtitle-track'){
      if(control.trackId!==null&&!status.subtitleTracks.some(track=>track.id===control.trackId))throw new Error('MPV_SUBTITLE_TRACK_UNAVAILABLE');
      await this.commandExisting(['set_property','sid',control.trackId===null?'no':control.trackId]);
    }else if(control.action==='audio-delay'){
      if(!Number.isFinite(control.value)||control.value < -10||control.value > 10)throw new Error('MPV_INVALID_AUDIO_DELAY');
      await this.commandExisting(['set_property','audio-delay',control.value]);
    }else if(control.action==='key-change'){
      if(!Number.isInteger(control.semitones)||control.semitones < -6||control.semitones > 6)throw new Error('MPV_INVALID_KEY_CHANGE');
      const status=await this.getStatus();
      if(!status.keyChangeAvailable)throw new Error('MPV_KEY_CHANGE_UNAVAILABLE');
      const scale=2**(control.semitones/12);
      await this.commandExisting(['af-command','yukari-key','set-pitch',String(scale)]);
      this.appliedKeySemitones=control.semitones;
    }else{
      await this.commandExisting(['set_property','fullscreen',control.value]);
    }
  }
  async close() {
    try { if (this.socket) await this.commandExisting(['quit']); } catch { /* best effort shutdown */ }
    this.socket?.destroy(); this.socket = null;
    if (this.child && this.child.exitCode === null) this.child.kill();
  }
}

function safeTrack(value:unknown):MpvTrack|null{
  if(!value||typeof value!=='object')return null;
  const item=value as Record<string,unknown>;
  if(!Number.isInteger(item.id)||Number(item.id)<0)return null;
  const label=(input:unknown)=>typeof input==='string'&&!/^(?:[a-z][a-z0-9+.-]*:\/\/|[a-z]:[\\/]|\\\\|\/)/i.test(input)?input.replace(/[\\/\u0000-\u001f]/g,' ').trim().slice(0,96)||undefined:undefined;
  return {id:Number(item.id),selected:item.selected===true,...(label(item.title)?{title:label(item.title)}:{}),...(label(item.lang)?{language:label(item.lang)}:{}),...(label(item.codec)?{codec:label(item.codec)}:{})};
}
