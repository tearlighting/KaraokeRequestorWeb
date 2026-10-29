/** Fixed-rate scheduler with a single in-flight render and one coalesced update. */
export class DanmakuFrameScheduler {
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<void> | undefined;
  private rerender = false;
  private running = false;

  constructor(private readonly render: () => Promise<boolean>, private readonly intervalMs = 33, private readonly onError: (error: unknown) => void = () => {}) {}

  get isRunning() { return this.running; }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => { void this.requestFrame(); }, this.intervalMs);
    this.timer.unref();
    void this.requestFrame();
  }

  async stop() {
    this.running = false;
    this.rerender = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight;
  }

  private requestFrame() {
    if (!this.running) return Promise.resolve();
    if (this.inFlight) { this.rerender = true; return this.inFlight; }
    this.inFlight = (async () => {
      do {
        this.rerender = false;
        let keepRunning = false;
        try { keepRunning = await this.render(); }
        catch (error) { this.onError(error); }
        if (!keepRunning && !this.rerender) {
          this.running = false;
          if (this.timer) clearInterval(this.timer);
          this.timer = undefined;
        }
      } while (this.running && this.rerender);
    })().finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
}
