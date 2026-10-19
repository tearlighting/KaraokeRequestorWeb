import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, writeFileSync, closeSync, existsSync, chmodSync } from 'node:fs';

const path = new URL('../.local/player-agent-token', import.meta.url);
const filename = decodeURIComponent(path.pathname).replace(/^\//, process.platform === 'win32' ? '' : '/');
mkdirSync(new URL('../.local/', import.meta.url), { recursive: true });
if (!existsSync(filename)) {
  const fd = openSync(filename, 'wx', 0o600);
  try { writeFileSync(fd, randomBytes(48).toString('base64url')); }
  finally { closeSync(fd); }
  if (process.platform !== 'win32') chmodSync(filename, 0o600);
  process.stdout.write('Created ignored .local/player-agent-token. Keep it private; it is shared only with the host Agent and API container.\n');
} else process.stdout.write('Player Agent token already exists; left unchanged.\n');
