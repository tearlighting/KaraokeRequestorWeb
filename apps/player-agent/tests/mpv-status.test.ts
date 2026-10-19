import test from 'node:test';
import assert from 'node:assert/strict';
import { MpvJsonIpcAdapter } from '../src/mpv.js';

test('mpv media properties unavailable while idle do not fail status or claim playback', async () => {
  const adapter = new MpvJsonIpcAdapter(process.execPath);
  Object.assign(adapter, {
    ensure: async () => {},
    command: async (command: unknown[]) => {
      if (command[1] === 'path') throw new Error('mpv IPC: property unavailable');
      return command[1] === 'idle-active' ? true : false;
    },
    property: MpvJsonIpcAdapter.prototype['property'],
  });

  assert.deepEqual(await adapter.getStatus(), { state: 'idle' });
});

test('mpv status requires a confirmed loaded path even if not idle', async () => {
  const adapter = new MpvJsonIpcAdapter(process.execPath);
  Object.assign(adapter, { ensure: async () => {}, property: async (name: string) => name === 'idle-active' ? false : name === 'pause' ? false : undefined });
  assert.deepEqual(await adapter.getStatus(), { state: 'idle' });
});
