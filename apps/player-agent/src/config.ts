import { existsSync, readFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

export interface AgentLocalConfig {
  agentId?: string;
  apiUrl?: string;
  mpvPath?: string;
  mediaRoot?: string;
  testVideo?: string;
  pathMappings?: Array<{ source: string; target: string }>;
}

export interface AgentRuntimeConfig {
  apiUrl: string;
  token: string;
  id: string;
  executable: string;
  mediaRoot: string;
  testVideo: string;
  pathMappings: Array<{ source: string; target: string }>;
  lockDir: string;
  configPath: string;
}

function parseConfig(value: unknown): AgentLocalConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Player Agent config must be a JSON object');
  const input = value as Record<string, unknown>;
  const allowed = new Set(['agentId', 'apiUrl', 'mpvPath', 'mediaRoot', 'testVideo', 'pathMappings']);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new Error('Player Agent config contains an unsupported field');
  for (const key of ['agentId', 'apiUrl', 'mpvPath', 'mediaRoot', 'testVideo']) {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`Player Agent config ${key} must be text`);
  }
  if (typeof input.agentId === 'string' && !/^[A-Za-z0-9_-]{1,50}$/.test(input.agentId)) throw new Error('Player Agent config agentId is invalid');
  if (input.pathMappings !== undefined && (!Array.isArray(input.pathMappings) || input.pathMappings.some(item =>
    !item || typeof item !== 'object' || Array.isArray(item) || typeof (item as Record<string, unknown>).source !== 'string' || typeof (item as Record<string, unknown>).target !== 'string' || Object.keys(item as object).some(key => key !== 'source' && key !== 'target')))) {
    throw new Error('Player Agent config pathMappings must be an array of {source,target} entries');
  }
  return input as AgentLocalConfig;
}

export function loadAgentConfig(env: NodeJS.ProcessEnv = process.env): AgentRuntimeConfig {
  const localAppData = env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const configPath = env.YUKARI_PLAYER_AGENT_CONFIG || join(localAppData, 'YukariPlayerAgent', 'agent-config.json');
  let local: AgentLocalConfig = {};
  if (existsSync(configPath)) {
    try { local = parseConfig(JSON.parse(readFileSync(configPath, 'utf8'))); }
    catch { throw new Error(`Cannot read a valid Player Agent config from ${configPath}`); }
  }
  let pathMappings = local.pathMappings || [];
  if (env.PLAYER_PATH_MAPPINGS) {
    try { pathMappings = parseConfig({ pathMappings: JSON.parse(env.PLAYER_PATH_MAPPINGS) }).pathMappings || []; }
    catch { throw new Error('PLAYER_PATH_MAPPINGS must be a JSON array of {source,target} entries'); }
  }
  const tokenPath = env.YUKARI_PLAYER_AGENT_TOKEN_FILE || join(process.cwd(), '.local', 'player-agent-token');
  let token = env.YUKARI_PLAYER_AGENT_TOKEN || '';
  if (!token && existsSync(tokenPath)) token = readFileSync(tokenPath, 'utf8').trim();
  return {
    apiUrl: (env.YUKARI_API_URL || local.apiUrl || 'http://127.0.0.1:3000').replace(/\/$/, ''),
    token,
    id: env.YUKARI_PLAYER_AGENT_ID || local.agentId || `host_${hostname().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 44)}`,
    executable: env.MPV_PATH || local.mpvPath || '',
    mediaRoot: env.PLAYER_MEDIA_ROOT || local.mediaRoot || '',
    testVideo: env.PLAYER_TEST_VIDEO ?? local.testVideo ?? '',
    pathMappings,
    lockDir: env.YUKARI_PLAYER_AGENT_LOCK_DIR || join(localAppData, 'YukariPlayerAgent'),
    configPath,
  };
}
