// Windows sandbox environments may reject libuv's account lookup. tsx uses
// os.userInfo only to name its temporary transform directory; keep tests local.
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
if (process.platform === 'win32') {
  try { os.userInfo(); }
  catch { os.userInfo = () => ({ username: 'test', uid: -1, gid: -1, shell: null, homedir: os.tmpdir() }); syncBuiltinESMExports(); }
}
