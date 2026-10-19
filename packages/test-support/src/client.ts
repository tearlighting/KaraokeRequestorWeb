import { readFileSync } from 'node:fs';
export const apiBase = process.env.E2E_API_BASE || 'http://127.0.0.1:3000';
export const phpBase = process.env.E2E_PHP_BASE || 'http://127.0.0.1:8080';
/** Tests only: existing local config is read transiently, never logged or copied to files. */
export function testCredentials() {
  const value = process.env.E2E_ADMIN_PASSWORD ?? (readFileSync(new URL('../../../config.ini', import.meta.url), 'utf8').match(/^configpass\s*=\s*(.*)$/m)?.[1] || '').trim().replace(/^(["'])(.*)\1$/, '$2');
  if (!value) throw new Error('真实管理测试需要已配置的非空原 PHP 密码');
  return { username: 'admin' as const, password: value, easyPass: process.env.E2E_EASY_PASS || '' };
}
export class TestAgent {
  private cookies = new Map<string, string>();
  async call(path: string, method = 'GET', data?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(`${apiBase}/api/v1${path}`, { method,
      headers: { 'X-Yukari-Client': '1', ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...extra, Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ') + (extra.Cookie ? '; ' + extra.Cookie : '') },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
    for (const cookie of response.headers.getSetCookie()) {
      const [key, value] = cookie.split(';')[0].split('=');
      this.cookies.set(key, value);
    }
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async user() {
    const result = await this.call('/user/session', 'POST', { easypass: process.env.E2E_EASY_PASS || '' });
    if (result.status !== 200) throw new Error('用户会话初始化失败：' + result.body.error?.message);
    return result.body.data.userId as string;
  }
  async admin() {
    const result = await this.call('/admin/session', 'POST', testCredentials());
    if (result.status !== 200) throw new Error('原管理认证失败：' + result.body.error?.message);
  }
}
