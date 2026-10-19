import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaPathResolver } from '../src/media-path.js';

test('media paths remain inside the configured real directory, including symlinks', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-media-'));
  const outside = mkdtempSync(join(tmpdir(), 'yukari-outside-'));
  try {
    mkdirSync(join(root, 'songs')); writeFileSync(join(root, 'songs', 'sample.mp4'), 'placeholder');
    writeFileSync(join(outside, 'outside.mp4'), 'placeholder');
    let symlinksSupported = true;
    try { symlinkSync(join(outside, 'outside.mp4'), join(root, 'escape.mp4')); } catch { symlinksSupported = false; }
    const resolver = new MediaPathResolver(root);
    assert.equal(resolver.resolve('songs/sample.mp4'), join(root, 'songs', 'sample.mp4'));
    assert.throws(() => resolver.resolve('../outside.mp4'));
    assert.throws(() => resolver.resolve(join(outside, 'outside.mp4')));
    if (symlinksSupported) assert.throws(() => resolver.resolve('escape.mp4'));
    assert.throws(() => resolver.resolve('missing.mp4'));
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
