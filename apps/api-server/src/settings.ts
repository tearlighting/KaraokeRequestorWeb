import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BoundaryError } from './errors.js';
import type { Settings } from '../../../packages/contracts/src/index.js';

export const settingsSchema = z.object({
  playmode: z.number().int().min(1).max(5),
  startvolume: z.number().int().min(0).max(100),
  requestlistactivereload: z.number().int().min(0).max(1),
  revision: z.string().regex(/^[a-f0-9]{64}$/), changed: z.boolean().optional(),
}) satisfies z.ZodType<Settings>;

const unavailable = () => new BoundaryError(503, 'SETTINGS_UNAVAILABLE', '无法安全读取管理设置；请检查配置文件、格式或并发保存后重试');

/** Three-field projection only. Never return, retain or log other config values.
 * The PHP auth gate validates the complete INI; unsupported target expressions fail closed.
 */
export function projectSettings(bytes: Buffer): Settings {
  const values: Record<string, number> = { playmode: 3, startvolume: 50, requestlistactivereload: 1 };
  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    // Refuse unsupported quoted keys or multiline values rather than treating
    // text inside a different INI value as a setting. Legacy's serializer uses
    // one physical line per URL-encoded value.
    if (/^\s*["'](?:playmode|startvolume|requestlistactivereload)["']\s*=/.test(line)) throw unavailable();
    const assignment = line.match(/^\s*[^;#=]+=(.*)$/);
    if (assignment && assignment[1].trim().startsWith('"') && !/^"(?:[^"\\]|\\.)*"\s*(?:;.*)?$/.test(assignment[1].trim())) throw unavailable();
    const match = line.match(/^\s*(playmode|startvolume|requestlistactivereload)\s*(\[|=)(.*)$/);
    if (!match) continue;
    if (match[2] !== '=') throw unavailable(); // PHP arrays are not supported settings scalars.
    let value = match[3].trim();
    if (value.startsWith('"')) {
      const quoted = value.match(/^"([^"\\$]*)"\s*(?:;.*)?$/);
      if (!quoted) throw unavailable();
      value = quoted[1];
    } else {
      value = value.split(';')[0].trim();
      if (/['"${}|&~!()\\]/.test(value)) throw unavailable();
      if (/^(true|on|yes)$/i.test(value)) value = '1';
      else if (/^(false|off|no|none|null)$/i.test(value)) value = '';
      else if (/^[a-z_]/i.test(value)) throw unavailable(); // PHP constants can vary by runtime.
    }
    // PHP's (int) string conversion permits numeric prefixes and truncates floats.
    const numeric = value.match(/^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    values[match[1]] = numeric ? Math.trunc(Number(numeric[0])) : 0;
  }
  const result = settingsSchema.safeParse({ ...values, revision: createHash('sha256').update(bytes).digest('hex') });
  if (!result.success) throw new BoundaryError(502, 'LEGACY_CONTRACT_ERROR', '原配置设置值不符合既有 API 范围');
  return result.data;
}

/** File access is read-only; no config/schema creation, repair, caching or write methods. */
export class SettingsRepository {
  constructor(private path: string) {
    if (!isAbsolute(path)) throw new Error('Settings path must be absolute');
  }
  async snapshot(expectedRevision: string): Promise<Buffer> {
    try {
      const bytes = await readFile(this.path);
      if (bytes.length > 2 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== expectedRevision) throw unavailable();
      return bytes;
    } catch { throw unavailable(); }
  }
  async currentSnapshot(): Promise<Buffer> {
    try { const bytes = await readFile(this.path); if (bytes.length > 2 * 1024 * 1024) throw unavailable(); return bytes; }
    catch { throw unavailable(); }
  }
}

export class SettingsService {
  constructor(private repository: SettingsRepository) {}
  async read(expectedRevision: string): Promise<Settings> {
    return projectSettings(await this.repository.snapshot(expectedRevision));
  }
  /** Internal playback coordinator projection; exposes only the existing allowlisted scalar settings. */
  async readCurrent(): Promise<Settings> {
    return projectSettings(await this.repository.currentSnapshot());
  }
}
