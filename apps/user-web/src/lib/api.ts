import { apiRequest, ApiError } from '../../../../packages/contracts/src/index';
export { ApiError };
let session: Promise<unknown> | null = null;
export function ensureUserSession() {
  session ??= apiRequest('/user/session', { method: 'POST', body: '{}' }).catch((error) => {
    session = null;
    if (error instanceof ApiError) error.stage = 'session';
    throw error;
  });
  return session;
}
export async function apiJson(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  await ensureUserSession();
  try { return record(await apiRequest(path, init)); }
  catch (error) { if (error instanceof ApiError && error.status === 401) session = null; throw error; }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('API 响应结构不符合契约');
  return value as Record<string, unknown>;
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : '请求失败，请稍后重试'; }
