import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const appRoot = process.cwd();
const app = JSON.parse(await readFile(path.join(appRoot, 'package.json'), 'utf8'));
if (!['@yukari/user-web', '@yukari/admin-web'].includes(app.name)) {
  throw new Error(`Run this script from a user-web or admin-web directory (got ${app.name}).`);
}

const appPath = app.name.endsWith('user-web') ? '/user/' : '/admin/';
const defaultPort = app.name.endsWith('user-web') ? 5173 : 5174;
const port = Number(process.env.E2E_WEB_PORT || defaultPort);
const viteBin = path.join(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const playwrightBin = path.join(appRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const node = process.execPath;
let vite;
let interrupted = false;

function child(args, env = process.env) {
  return spawn(node, args, { cwd: appRoot, env, stdio: 'inherit', windowsHide: true });
}

async function waitForExit(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  await new Promise((resolve) => proc.once('exit', resolve));
}

async function stopOwnedVite() {
  if (!vite || vite.exitCode !== null || vite.signalCode !== null) return;
  vite.kill('SIGTERM');
  const exited = await Promise.race([waitForExit(vite).then(() => true), delay(3000).then(() => false)]);
  if (!exited && vite.pid) {
    // Exact PID tree created by this script; never target unrelated Node processes.
    const killer = spawn('taskkill.exe', ['/PID', String(vite.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await waitForExit(killer);
    await Promise.race([waitForExit(vite), delay(3000)]);
  }
}

async function runExternal() {
  const proc = child([playwrightBin, 'test']);
  const onSignal = (signal) => { interrupted = true; proc.kill(signal); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const result = await new Promise((resolve, reject) => {
    proc.once('error', reject);
    proc.once('exit', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0) }));
  });
  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
  return interrupted ? 130 : result.code;
}

async function runWithOwnedVite() {
  vite = child([viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  const viteExited = new Promise((resolve) => vite.once('exit', (code) => resolve(code ?? 1)));
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (vite.exitCode !== null || vite.signalCode !== null) {
      throw new Error(`Vite exited before becoming ready (code ${await viteExited}).`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(500) });
      if (response.ok) { ready = true; break; }
    } catch { /* Vite is still starting. */ }
    await delay(200);
  }
  if (!ready) throw new Error(`Vite did not become ready at ${baseUrl}.`);

  const env = { ...process.env, E2E_BASE_URL: baseUrl, E2E_APP_PATH: '/' };
  const proc = child([playwrightBin, 'test'], env);
  const onSignal = (signal) => { interrupted = true; proc.kill(signal); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const code = await new Promise((resolve, reject) => {
    proc.once('error', reject);
    proc.once('exit', (status, signal) => resolve(status ?? (signal ? 1 : 0)));
  });
  process.removeListener('SIGINT', onSignal);
  process.removeListener('SIGTERM', onSignal);
  return interrupted ? 130 : code;
}

let code;
try {
  code = process.env.E2E_BASE_URL ? await runExternal() : await runWithOwnedVite();
} finally {
  await stopOwnedVite();
}
process.exitCode = code ?? 1;
