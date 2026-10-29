import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DanmakuController } from '../src/danmaku/controller.js';
import { renderDanmakuOverlay } from '../src/danmaku/renderer.js';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 5));

test('comments move from the right edge to the left at deterministic positions and dispose clears the overlay', async () => {
  const frames: Array<string | null> = [];
  const controller = new DanmakuController(async data => { frames.push(data); }, { now: () => 1_000 });
  await controller.setEnabled(true);
  await controller.setPlaybackActive(true);
  assert.equal(controller.add('hello'), true);
  assert.equal(controller.isAnimating, true);
  await tick();
  assert.ok(frames[0]!.includes('\\pos(1280,56)'));
  await controller.dispose();
  assert.equal(frames.at(-1), null);
  assert.equal(controller.isAnimating, false);
});

test('poll batches use seven distinct lanes, queue overflow waits, and clear stops animation', async () => {
  let now = 1_000;
  const frames: Array<string | null> = [];
  const controller = new DanmakuController(async data => { frames.push(data); }, { now: () => now, intervalMs: 2 });
  await controller.setEnabled(true);
  await controller.setPlaybackActive(true);
  assert.equal(controller.addMany(Array.from({ length: 9 }, (_, i) => 'comment ' + i)), 9);
  await tick();
  const first = frames.find(frame => frame !== null)!.split('\n');
  assert.equal(first.length, 7);
  assert.equal(new Set(first.map(item => item.match(/\\pos\(\d+,(\d+)\)/)?.[1])).size, 7);
  assert.equal(controller.pendingCount, 9);
  now = 20_000;
  await tick();
  const afterClear = frames.filter((frame): frame is string => frame !== null).at(-1)!.split('\n');
  assert.equal(afterClear.length, 2);
  await controller.clear();
  assert.equal(frames.at(-1), null, 'clear sends a null overlay rather than rendering an empty payload');
  assert.equal(controller.pendingCount, 0);
  assert.equal(controller.isAnimating, false);
});

test('ASS overlay uses positional frames, bounds visible messages, and escapes user tags', () => {
  const data = renderDanmakuOverlay([
    { text: 'hello {\\fs90} world', x: 600, y: 56 },
    ...Array.from({ length: 8 }, (_, i) => ({ text: 'line' + i, x: 1000 - i, y: 134 + i * 78 })),
  ]);
  assert.equal(data.split('\n').length, 7);
  assert.ok(data.includes('\\pos(600,56)'));
  assert.ok(data.includes('hello (/fs90) world'));
  assert.doesNotMatch(data, /\{\\fs90\}/);
});

test('comment queue is bounded, disable clears it, and empty queues do not refresh', async () => {
  let calls = 0;
  const controller = new DanmakuController(async () => { calls++; }, { intervalMs: 2 });
  await controller.setEnabled(true);
  await controller.setPlaybackActive(true);
  assert.equal(controller.isAnimating, false, 'empty controller has no animation loop');
  let accepted = 0;
  for (let i = 0; i < 100; i++) if (controller.add('comment ' + i)) accepted++;
  assert.equal(accepted, 70);
  await controller.setEnabled(false);
  assert.equal(controller.pendingCount, 0);
  assert.equal(controller.isAnimating, false);
  const afterDisable = calls;
  await tick();
  assert.equal(calls, afterDisable, 'disabled controller schedules no further frames');
  await controller.dispose();
});

test('slow overlay IPC is coalesced to one in-flight write plus one latest frame', async () => {
  let release!: () => void;
  let inFlight = 0, maxInFlight = 0, calls = 0;
  let signalSecond!: () => void;
  const secondStarted = new Promise<void>(resolve => { signalSecond = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const controller = new DanmakuController(async () => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); calls++;
    if (calls === 1) await gate;
    if (calls === 2) signalSecond();
    inFlight--;
  }, { intervalMs: 2 });
  await controller.setEnabled(true);
  await controller.setPlaybackActive(true);
  controller.add('backpressure');
  await tick();
  release();
  await secondStarted;
  await controller.dispose();
  assert.equal(maxInFlight, 1);
  assert.equal(calls, 3, 'two coalesced frames plus one clear; no overlapping IPC writes');
});

test('mpv disconnect or playback end clears lanes before the next player session', async () => {
  const frames: Array<string | null> = [];
  const controller = new DanmakuController(async data => { frames.push(data); }, { intervalMs: 2 });
  await controller.setEnabled(true);
  await controller.setPlaybackActive(true);
  controller.addMany(['one', 'two']);
  await tick();
  assert.equal(controller.pendingCount, 2);
  await controller.setPlaybackActive(false);
  assert.equal(controller.pendingCount, 0);
  assert.equal(frames.at(-1), null);
  assert.equal(controller.isAnimating, false);
  await controller.setPlaybackActive(true);
  controller.add('next session');
  await tick();
  const nextFrame = frames.filter((frame): frame is string => frame !== null).at(-1)!;
  assert.match(nextFrame, /next session/);
  assert.doesNotMatch(nextFrame, /one|two/);
  await controller.dispose();
});
