import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MediaPathResolver } from '../../media-agent/src/media-path.js';

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

test('POSIX queue paths require an explicit mapping and remain under the mapped allowlist', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-map-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'yukari-map-outside-'));
  try {
    const library = join(root, 'library'); mkdirSync(library);
    const song = join(library, 'song.mp4'); writeFileSync(song, 'fixture');
    writeFileSync(join(outside, 'escape.mp4'), 'fixture');
    const resolver = new MediaPathResolver(root, [{ source: '/srv/karaoke', target: library }]);
    assert.equal(resolver.resolveQueueFile('/srv/karaoke/song.mp4'), song);
    assert.equal(resolver.checkQueueFile('/srv/karaoke/song.mp4'), 'playable');
    assert.equal(resolver.checkQueueFile('/srv/karaoke/missing.mp4'), 'file_missing');
    assert.equal(resolver.checkQueueFile('/srv/unmapped/song.mp4'), 'path_unmapped');
    assert.equal(resolver.checkQueueFile('/srv/karaoke/../outside/escape.mp4'), 'invalid_path');
    assert.throws(() => resolver.resolveQueueFile('/srv/unmapped/song.mp4'), /no configured mapping/);
    assert.throws(() => resolver.resolveQueueFile('/srv/karaoke/../outside/escape.mp4'));
    assert.throws(() => resolver.resolveQueueFile('/srv/karaoke/missing.mp4'));
    assert.throws(() => new MediaPathResolver(root, [{ source: '/srv//karaoke', target: library }]));
    assert.throws(() => new MediaPathResolver(root, [{ source: '/srv/karaoke', target: outside }]));
    let symlinksSupported = true;
    try { symlinkSync(join(outside, 'escape.mp4'), join(library, 'symlink.mp4')); } catch { symlinksSupported = false; }
    if (symlinksSupported) assert.throws(() => resolver.resolveQueueFile('/srv/karaoke/symlink.mp4'));
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
