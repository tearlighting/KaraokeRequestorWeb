import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMediaTitle } from '../src/features/search/formatMediaTitle.ts';

test('removes obvious release and encoding noise from display title', () => {
  assert.equal(formatMediaTitle('[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv'), 'DanMachi - ED ep06');
});

test('preserves Japanese, Chinese and bracketed titles when they are not technical tags', () => {
  assert.equal(formatMediaTitle('夜に駆ける.mkv'), '夜に駆ける');
  assert.equal(formatMediaTitle('[星街すいせい] ビビデバ.mp4'), '[星街すいせい] ビビデバ');
  assert.equal(formatMediaTitle('[中文标题] 歌曲名.mkv'), '[中文标题] 歌曲名');
});

test('keeps unrecognized extensions and safe fallback names intact', () => {
  assert.equal(formatMediaTitle('example audio.flac'), 'example audio.flac');
  assert.equal(formatMediaTitle('[x].mkv'), '[x]');
});
