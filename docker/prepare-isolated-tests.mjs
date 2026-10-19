// Creates disposable synthetic test data, never copies a runtime configuration/database.
import { readdir, mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = join(root, '.local/phase7-test-legacy');
const marker = join(target, '.isolated-test-fixture');
await mkdir(join(root, '.local'), { recursive: true });
try { await mkdir(target); await writeFile(marker, 'synthetic only'); }
catch { if ((await readFile(marker, 'utf8')) !== 'synthetic only') throw new Error('Not a test fixture'); }
const allowed = new Set(['.php','.js','.css','.html','.htm','.json','.svg','.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.eot','.txt']);
async function copy(source, dest) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (['runtime','cache','test_race','.git'].includes(entry.name)) continue;
    const from = join(source, entry.name), to = join(dest, entry.name);
    if (entry.isDirectory()) await copy(from, to);
    else if (allowed.has(extname(entry.name)) && !['mypage_google_relay_config.php'].includes(entry.name)) await copyFile(from, to);
  }
}
await mkdir(join(root, '.local/phase7-test-tools'), { recursive: true });
await copy(join(root, 'legacy/php'), target);
await mkdir(join(target, 'runtime/queue'), { recursive: true });
// Public, disposable fixture credential; not a deployed credential.
await writeFile(join(target, 'config.ini'), 'dbname="runtime/queue/request.db"\nconfigpass="phase7-isolated-only"\nuuid="phase7-isolated-fixture"\nplaymode=3\nstartvolume=50\nrequestlistactivereload=1\nuseeasyauth=0\n');
console.log('Isolated source fixture prepared (no production runtime data copied).');
