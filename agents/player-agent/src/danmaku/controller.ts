import { DANMAKU_CANVAS_WIDTH, DANMAKU_LANE_COUNT, estimateDanmakuWidth, renderDanmakuOverlay, type DanmakuFrameItem } from './renderer.js';
import { DanmakuFrameScheduler } from './scheduler.js';

type Lane = { active?: { text: string; width: number; startedAt: number }; queue: string[] };
type OverlaySink = (data: string | null) => Promise<void>;

const MAX_MESSAGES = 70;
const MAX_TEXT_LENGTH = 100;

/** Ephemeral message queue, lane allocator and animation lifecycle. It knows
 * only a constrained overlay sink; it cannot issue playback or task commands. */
export class DanmakuController {
  private readonly lanes: Lane[] = Array.from({ length: DANMAKU_LANE_COUNT }, () => ({ queue: [] }));
  private readonly scheduler: DanmakuFrameScheduler;
  private enabled = false;
  private playbackActive = false;
  private disposed = false;
  private overlayVisible = false;
  private epoch = 0;
  private readonly now: () => number;

  constructor(private readonly setOverlay: OverlaySink, options: { now?: () => number; intervalMs?: number; onError?: (error: unknown) => void } = {}) {
    this.now = options.now ?? Date.now;
    this.scheduler = new DanmakuFrameScheduler(() => this.draw(), options.intervalMs ?? 33, options.onError);
  }

  async setEnabled(enabled: boolean) {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) await this.resetAndClear();
  }

  async setPlaybackActive(active: boolean) {
    if (this.disposed || this.playbackActive === active) return;
    this.playbackActive = active;
    if (!active) await this.resetAndClear();
  }

  add(text: string) { return this.addMany([text]) === 1; }

  /** Adds a poll batch before scheduling its first frame, avoiding partial
   * first-frame consumption when multiple comments arrive together. */
  addMany(texts: readonly string[]) {
    if (this.disposed || !this.enabled || !this.playbackActive) return 0;
    let accepted = 0;
    for (const text of texts) {
      if (this.pendingCount >= MAX_MESSAGES) break;
      const clean = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) continue;
      const lane = this.lanes.reduce((best, item) =>
        item.queue.length + (item.active ? 1 : 0) < best.queue.length + (best.active ? 1 : 0) ? item : best);
      lane.queue.push([...clean].slice(0, MAX_TEXT_LENGTH).join(''));
      accepted++;
    }
    if (accepted) {
      this.epoch++;
      this.scheduler.start();
    }
    return accepted;
  }

  async clear() {
    if (this.disposed) return;
    await this.resetAndClear();
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.playbackActive = false;
    await this.resetAndClear();
  }

  get pendingCount() { return this.lanes.reduce((sum, lane) => sum + lane.queue.length + (lane.active ? 1 : 0), 0); }
  get isAnimating() { return this.scheduler.isRunning; }

  private async resetAndClear() {
    const epoch = ++this.epoch;
    for (const lane of this.lanes) { lane.active = undefined; lane.queue = []; }
    await this.scheduler.stop();
    // A concurrent new message/enable wins over this clear and will render its
    // latest state. This avoids a slow IPC clear blanking a newer frame.
    if (epoch !== this.epoch) return;
    await this.setOverlay(null);
    this.overlayVisible = false;
  }

  private async draw() {
    if (this.disposed || !this.enabled || !this.playbackActive) return false;
    const frame = this.nextFrame(this.now());
    if (!frame.length) {
      if (this.overlayVisible) { await this.setOverlay(null); this.overlayVisible = false; }
      return false;
    }
    const epoch = this.epoch;
    await this.setOverlay(renderDanmakuOverlay(frame));
    if (epoch !== this.epoch) return false;
    this.overlayVisible = true;
    return this.pendingCount > 0;
  }

  private nextFrame(now: number): DanmakuFrameItem[] {
    const result: DanmakuFrameItem[] = [];
    this.lanes.forEach((lane, index) => {
      if (lane.active) {
        const x = DANMAKU_CANVAS_WIDTH - (now - lane.active.startedAt) / 1000 * 280;
        if (x + lane.active.width < 0) lane.active = undefined;
        else result.push({ text: lane.active.text, x, y: 56 + index * 78 });
      }
      if (!lane.active && lane.queue.length) {
        const text = lane.queue.shift()!;
        lane.active = { text, width: estimateDanmakuWidth(text), startedAt: now };
        result.push({ text, x: DANMAKU_CANVAS_WIDTH, y: 56 + index * 78 });
      }
    });
    return result;
  }
}
