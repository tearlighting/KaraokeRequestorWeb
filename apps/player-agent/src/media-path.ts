import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep, posix, win32 } from 'node:path';

export type MediaPathMapping = { source: string; target: string };
export type MediaCheckResult = 'playable' | 'path_unmapped' | 'file_missing' | 'invalid_path';

function inside(root: string, candidate: string) {
  const rel = relative(root, candidate);
  return Boolean(rel) && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}

export class MediaPathResolver {
  private root: string;
  private mappings: Array<{ source: string; target: string }>;
  constructor(root: string, mappings: MediaPathMapping[] = []) {
    if (!isAbsolute(root)) throw new Error('PLAYER_MEDIA_ROOT must be an absolute path');
    this.root = realpathSync(root);
    if (!statSync(this.root).isDirectory()) throw new Error('PLAYER_MEDIA_ROOT must be a directory');
    this.mappings = mappings.map(({ source, target }) => {
      if (!source.startsWith('/') || source.includes('\\') || source.includes('\0') || posix.normalize(source) !== source.replace(/\/$/, '') || source === '/') {
        throw new Error('Media mapping source must be a normalized absolute POSIX directory');
      }
      if (!win32.isAbsolute(target)) throw new Error('Media mapping target must be an absolute Windows directory');
      const realTarget = realpathSync(target);
      if (!statSync(realTarget).isDirectory() || !inside(this.root, realTarget) && realTarget !== this.root) {
        throw new Error('Media mapping target must be a directory under PLAYER_MEDIA_ROOT');
      }
      return { source: source.replace(/\/$/, ''), target: realTarget };
    }).sort((a, b) => b.source.length - a.source.length);
  }
  resolve(relativeFile: string) {
    if (!relativeFile || isAbsolute(relativeFile) || relativeFile.includes('\0') || relativeFile.includes(':')) throw new Error('Invalid media-relative path');
    const candidate = realpathSync(resolve(this.root, relativeFile));
    const rel = relative(this.root, candidate);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Media path escapes configured root');
    if (!statSync(candidate).isFile()) throw new Error('Media path is not a file');
    return candidate;
  }
  /** DB paths may be absolute Windows paths; only accept them after realpath proves they remain under the root. */
  resolveQueueFile(file: string) {
    if (!file || file.includes('\0')) throw new Error('Invalid media path');
    let candidatePath: string;
    if (file.startsWith('/')) {
      if (posix.normalize(file) !== file || file.split('/').includes('..')) throw new Error('Non-canonical POSIX media path');
      const mapping = this.mappings.find(item => file.startsWith(item.source + '/'));
      if (!mapping) throw new Error('POSIX media path has no configured mapping');
      const suffix = file.slice(mapping.source.length + 1);
      if (!suffix || suffix.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid mapped media path');
      candidatePath = resolve(mapping.target, ...suffix.split('/'));
    } else {
      candidatePath = win32.isAbsolute(file) ? file : resolve(this.root, file);
    }
    const candidate = realpathSync(candidatePath);
    if (!inside(this.root, candidate)) throw new Error('Media path escapes configured root');
    if (!statSync(candidate).isFile()) throw new Error('Media path is not a file');
    return candidate;
  }
  checkQueueFile(file: string): MediaCheckResult {
    if (!file || file.includes('\0')) return 'invalid_path';
    try {
      if (file.startsWith('/')) {
        if (posix.normalize(file) !== file || file.split('/').includes('..')) return 'invalid_path';
        const mapping = this.mappings.find(item => file.startsWith(item.source + '/'));
        if (!mapping) return 'path_unmapped';
        const suffix = file.slice(mapping.source.length + 1);
        if (!suffix || suffix.split('/').some(part => !part || part === '.' || part === '..')) return 'invalid_path';
      } else if (win32.isAbsolute(file)) {
        if (!inside(this.root, win32.normalize(file))) return 'path_unmapped';
      } else if (isAbsolute(file) || file.includes(':') || file.split(/[\\/]/).includes('..')) return 'invalid_path';
      this.resolveQueueFile(file);
      return 'playable';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return 'file_missing';
      if (String(error).includes('no configured mapping') || String(error).includes('escapes configured root')) return 'path_unmapped';
      return 'invalid_path';
    }
  }
}
