import { isAbsolute, resolve, relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';
export function queueDatabasePath(root: string, database: string) {
  if (!isAbsolute(root) || isAbsolute(database) || database.includes('\\')) throw new Error('Invalid queue path');
  const base = realpathSync(root), path = realpathSync(resolve(base, database)), rel = relative(base, path);
  if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Queue path escapes mount');
  return path;
}
