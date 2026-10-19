import { readFileSync } from 'node:fs';
import { createApp } from './app.js';

const token = readFileSync(process.env.LEGACY_BRIDGE_TOKEN_FILE || '/run/yukari/bridge-token', 'utf8').trim();
const app = createApp({ legacyUrl: process.env.LEGACY_PHP_URL || 'http://web', bridgeToken: token,
  userOrigins: (process.env.USER_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(','),
  adminOrigins: (process.env.ADMIN_ORIGINS || 'http://127.0.0.1:5174,http://localhost:5174').split(','),
  queueRoot: process.env.LEGACY_DATABASE_ROOT,
  legacyOrigins: (process.env.LEGACY_QUEUE_ORIGINS || 'http://127.0.0.1:8080,http://localhost:8080').split(','),
  settingsPath: process.env.LEGACY_SETTINGS_PATH,
  secureCookies: process.env.COOKIE_SECURE === '1' });
await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3000) });
console.log('Yukari API ready');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
