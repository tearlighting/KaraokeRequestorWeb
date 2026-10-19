import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = '/run/yukari/bridge-token';
if (!existsSync(path)) writeFileSync(path, randomBytes(48).toString('hex'), { mode: 0o444, flag: 'wx' });
if (readFileSync(path, 'utf8').trim().length < 64) throw new Error('Invalid existing bridge token');
console.log('Internal bridge credential is ready');
