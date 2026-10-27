import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAgentConfig } from '../src/config.js';

test('local Agent config is user-scoped, environment overrides it, and token is loaded separately', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-agent-config-'));
  try {
    const local = join(root, 'YukariPlayerAgent'); mkdirSync(local);
    const configPath = join(local, 'agent-config.json');
    writeFileSync(configPath, JSON.stringify({ apiUrl: 'http://127.0.0.1:3000', mpvPath: 'C:\\mpv\\mpv.exe', mediaRoot: 'D:\\Media', testVideo: 'clip.mp4', pathMappings: [{ source: '/legacy/music', target: 'D:\\Media' }] }));
    const tokenPath = join(root, 'token'); writeFileSync(tokenPath, 'private-agent-token\n');
    const config = loadAgentConfig({ LOCALAPPDATA: root, YUKARI_PLAYER_AGENT_TOKEN_FILE: tokenPath });
    assert.equal(config.mediaRoot, 'D:\\Media'); assert.equal(config.pathMappings[0].source, '/legacy/music');
    assert.equal(config.token, 'private-agent-token'); assert.equal(config.lockDir, join(local, 'runtime-v2')); assert.equal(config.logDir, join(local, 'logs'));
    const overridden = loadAgentConfig({ LOCALAPPDATA: root, YUKARI_PLAYER_AGENT_CONFIG: configPath, YUKARI_PLAYER_AGENT_TOKEN: 'env-token', MPV_PATH: 'C:\\other\\mpv.exe', PLAYER_MEDIA_ROOT: 'E:\\Media', PLAYER_PATH_MAPPINGS: '[]' });
    assert.equal(overridden.executable, 'C:\\other\\mpv.exe'); assert.equal(overridden.mediaRoot, 'E:\\Media');
    assert.equal(overridden.pathMappings.length, 0); assert.equal(overridden.token, 'env-token');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('local Agent config rejects unknown fields, including credential persistence', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-agent-config-'));
  try {
    const configPath = join(root, 'agent.json'); writeFileSync(configPath, JSON.stringify({ mediaRoot: 'D:\\Media', token: 'should-not-be-configurable' }));
    assert.throws(() => loadAgentConfig({ YUKARI_PLAYER_AGENT_CONFIG: configPath, LOCALAPPDATA: root }), /Cannot read a valid Player Agent config/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
