import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = join(process.cwd(), '.local', 'phase16-mysql');
await mkdir(directory, { recursive: true });
for (const name of ['root-password','app-password','viewer-password']) {
  const path = join(directory,name);
  try { await readFile(path); }
  catch (error) {
    // Never treat ACL or I/O failures as a missing credential: doing so would
    // attempt to replace an existing secret and obscure the actual problem.
    if (error?.code !== 'ENOENT') {
      throw new Error(`Cannot read existing local MySQL credential file (${name}); refusing to replace it.`);
    }
    await writeFile(path,randomBytes(36).toString('base64url'),{flag:'wx',mode:0o600});
  }
}
const viewer=await readFile(join(directory,'viewer-password'),'utf8');
const navicat=`Host: 127.0.0.1\nPort: 3307\nDatabase: yukari\nUsername: yukari_viewer\nPassword: ${viewer.trim()}\nSSL: disabled (loopback development only)\n`;
await writeFile(join(directory,'navicat-connection.txt'),navicat,{mode:0o600});
if(process.platform==='win32'){
  const account=process.env.USERNAME;
  if(!account)throw new Error('Cannot identify the current Windows account for local secret ACLs');
  execFileSync('icacls.exe',[directory,'/inheritance:r','/grant:r',`${account}:(OI)(CI)F`,'/T','/C'],{stdio:'ignore'});
}
console.log('Local MySQL secret files are ready; values were not printed.');
