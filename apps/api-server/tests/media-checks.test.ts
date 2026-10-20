import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaCheckCoordinator } from '../src/media-checks.js';

test('media checks are assigned to one authenticated Agent, redact paths, and expire', () => {
  let now=1000; const checks=new MediaCheckCoordinator(()=>now);
  const created=checks.create(12,'/library/secret-folder/song.mp4');
  assert.equal(checks.read(created.id,12).state,'pending');
  const assigned=checks.claim('agent-a'); assert.equal(assigned?.path,'/library/secret-folder/song.mp4');
  assert.equal(checks.claim('agent-b'),null);
  assert.throws(()=>checks.complete(created.id,'agent-b','playable'),{code:'STALE_MEDIA_CHECK'});
  assert.deepEqual(checks.complete(created.id,'agent-a','path_unmapped'),{id:created.id,requestId:12,state:'path_unmapped'});
  assert.deepEqual(checks.read(created.id,12),{id:created.id,requestId:12,state:'path_unmapped'});
  now+=31000; assert.throws(()=>checks.read(created.id,12),{code:'MEDIA_CHECK_NOT_FOUND'});
});
