import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export class MediaPathResolver {
  private root: string;
  constructor(root: string) {
    if (!isAbsolute(root)) throw new Error('PLAYER_MEDIA_ROOT must be an absolute path');
    this.root = realpathSync(root);
    if (!statSync(this.root).isDirectory()) throw new Error('PLAYER_MEDIA_ROOT must be a directory');
  }
  resolve(relativeFile: string) {
    if (!relativeFile || isAbsolute(relativeFile) || relativeFile.includes('\0') || relativeFile.includes(':')) throw new Error('Invalid media-relative path');
    const candidate = realpathSync(resolve(this.root, relativeFile));
    const rel = relative(this.root, candidate);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Media path escapes configured root');
    if (!statSync(candidate).isFile()) throw new Error('Media path is not a file');
    return candidate;
  }
}
