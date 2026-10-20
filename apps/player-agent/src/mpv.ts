import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { basename } from 'node:path';

export type PlayerStatus = { state: 'idle'|'playing'|'paused'|'stopped'; file?: string; path?: string };
export interface PlayerAdapter {
  open(path: string): Promise<void>;
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
  private connect() {
    return new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(this.pipe);
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('mpv IPC connection timeout')); }, this.timeoutMs);
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
  private async command(command: unknown[]) {
    await this.ensure(); const socket = this.socket; if (!socket) throw new Error('mpv IPC unavailable');
    const id = ++this.requestId;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('mpv IPC request timed out')); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      socket.write(`${JSON.stringify({ command, request_id: id })}\n`, error => { if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); } });
    });
  }
  private async property(name: string) {
    try { return await this.command(['get_property', name]); }
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
  async getStatus(): Promise<PlayerStatus> {
    await this.ensure();
    const [idle, paused, path] = await Promise.all([this.property('idle-active'), this.property('pause'), this.property('path')]);
    if (idle === true || typeof path !== 'string') return { state: 'idle' };
    return { state: paused === true ? 'paused' : 'playing', file: basename(path), path };
  }
  async open(path: string) {
    let timer: NodeJS.Timeout;
    let onLoaded: () => void;
    const loadedPromise = new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => { this.fileLoadedListeners.delete(onLoaded); reject(new Error('mpv did not report file-loaded')); }, 15000);
      onLoaded = () => { clearTimeout(timer); this.fileLoadedListeners.delete(onLoaded); resolve(); };
      this.fileLoadedListeners.add(onLoaded);
    });
    try { await this.command(['loadfile', path, 'replace']); await loadedPromise; }
    catch (error) { clearTimeout(timer!); this.fileLoadedListeners.delete(onLoaded!); throw error; }
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const status = await this.getStatus();
      if (status.path === path && status.state === 'playing') return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('mpv did not report the requested file as playing');
  }
  async play() { await this.command(['set_property', 'pause', false]); }
  async pause() { await this.command(['set_property', 'pause', true]); }
  async stop() { await this.command(['stop']); }
  async close() {
    try { if (this.socket) await this.command(['quit']); } catch { /* best effort shutdown */ }
    this.socket?.destroy(); this.socket = null;
    if (this.child && this.child.exitCode === null) this.child.kill();
  }
}
