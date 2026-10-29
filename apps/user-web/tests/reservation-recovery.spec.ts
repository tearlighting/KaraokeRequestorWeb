import { expect, test } from '@playwright/test';

const ok = (data: unknown) => ({ ok: true, data });

test('予約 POST の応答が失われても同じ提出 ID の照会で確定済み予約を表示する', async ({ page }) => {
  // Model an HTTP LAN origin where Safari may not expose Web Crypto subtle.
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: undefined });
    const writes: string[] = [];
    Object.defineProperty(window, '__pendingWrites', { value: writes });
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'yukari.pendingSubmission.v1') writes.push(value); return original.call(this, key, value); };
  });
  let postCount = 0;
  let receipt = '';
  let formBody = '';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/v1/user/session') return route.fulfill({ json: ok({ userId: 'e2e-user' }) });
    if (path === '/api/v1/capabilities') return route.fulfill({ json: ok({ features: { everything_search: true, lister_search: false }, server: { room_name: 'Recovery test' } }) });
    if (path === '/api/v1/queue') return route.fulfill({ json: ok({ items: [], total: 0, remaining_count: 0, has_more: false, remaining_seconds: 0 }) });
    if (path === '/api/v1/playback') return route.fulfill({ json: ok({ playing: false }) });
    if (path === '/api/v1/requests/intent' && request.method() === 'POST') {
      receipt = 'same-owner-bound-idempotency-receipt';
      return route.fulfill({ json: ok({ receipt }) });
    }
    if (path === '/api/v1/requests' && request.method() === 'POST') {
      postCount++;
      formBody = request.postData() || '';
      expect(request.headers()['x-yukari-submission']).toBe(receipt);
      // The server committed, but the LAN proxy lost the response.
      return route.abort('timedout');
    }
    if (path === '/api/v1/requests/result' && request.method() === 'POST') {
      expect(JSON.parse(request.postData() || '{}')).toEqual({ receipt });
      return route.fulfill({ json: ok({ state: 'committed', result: { id: 4242, warnings: [] } }) });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { code: 'TEST_UNEXPECTED_ROUTE', message: path } } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(process.env.E2E_APP_PATH || '/');
  await page.getByTestId('reservation-singer').fill('ReceiptRecovery');
  await page.getByTestId('reservation-comment').fill('network response recovery');
  await page.getByTestId('reservation-submit').click();

  await expect(page.getByTestId('reservation-feedback')).toContainText('#4242');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(postCount).toBe(1);
  expect(JSON.parse(formBody)).toMatchObject({ singer: 'ReceiptRecovery', kind: '小休止' });
  const pendingWrite = await page.evaluate(() => (window as unknown as { __pendingWrites: string[] }).__pendingWrites[0]);
  const fingerprint = Object.keys(JSON.parse(pendingWrite!).receipts)[0];
  expect(fingerprint).toBe('827c4747324d88c7cdb613369a0c072307435f8fe07f448e64fa8dc0ad6c6dd7');
});

test('結果照会も一時失敗した場合は不明として保持し、再操作時に同じ receipt を照会する', async ({ page }) => {
  let postCount = 0;
  let resultLookups = 0;
  const receipt = 'persisted-owner-bound-receipt';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/user/session') return route.fulfill({ json: ok({ userId: 'e2e-user' }) });
    if (path === '/api/v1/capabilities') return route.fulfill({ json: ok({ features: { everything_search: true, lister_search: false }, server: {} }) });
    if (path === '/api/v1/queue') return route.fulfill({ json: ok({ items: [], total: 0, remaining_count: 0, has_more: false, remaining_seconds: 0 }) });
    if (path === '/api/v1/playback') return route.fulfill({ json: ok({ playing: false }) });
    if (path === '/api/v1/requests/intent') return route.fulfill({ json: ok({ receipt }) });
    if (path === '/api/v1/requests' && request.method() === 'POST') { postCount++; return route.abort('timedout'); }
    if (path === '/api/v1/requests/result' && request.method() === 'POST') {
      resultLookups++;
      if (resultLookups === 1) return route.abort('timedout');
      return route.fulfill({ json: ok({ state: 'committed', result: { id: 4343, warnings: [] } }) });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { code: 'TEST_UNEXPECTED_ROUTE', message: path } } });
  });

  await page.goto(process.env.E2E_APP_PATH || '/');
  await page.getByTestId('reservation-singer').fill('ReceiptRetry');
  await page.getByTestId('reservation-submit').click();
  await expect(page.getByTestId('reservation-diagnostic')).toContainText('code=RESERVATION_RESULT_UNKNOWN');
  await page.reload();
  await expect(page.locator('.success-banner').first()).toContainText('#4343');
  expect(postCount).toBe(1);
  expect(resultLookups).toBe(2);
});

test('予約前の認証失敗を段階・HTTP 状態・request ID 付きで安全に表示する', async ({ page }) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/user/session') return route.fulfill({ json: ok({ userId: 'diagnostic-user' }) });
    if (path === '/api/v1/capabilities') return route.fulfill({ json: ok({ features: {}, server: {} }) });
    if (path === '/api/v1/queue') return route.fulfill({ json: ok({ items: [], total: 0, remaining_count: 0, has_more: false, remaining_seconds: 0 }) });
    if (path === '/api/v1/playback') return route.fulfill({ json: ok({ playing: false }) });
    if (path === '/api/v1/requests/intent') return route.fulfill({ status: 401, headers: { 'X-Yukari-Request-Id': 'safe-test-request-id' }, json: { ok: false, error: { code: 'UNAUTHENTICATED', message: 'unauthorized', requestId: 'safe-test-request-id' } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { code: 'TEST_UNEXPECTED_ROUTE', message: 'not found' } } });
  });
  await page.goto(process.env.E2E_APP_PATH || '/');
  await page.getByTestId('reservation-singer').fill('Diagnostic');
  await page.getByTestId('reservation-submit').click();
  const diagnostic = page.getByTestId('reservation-diagnostic');
  await expect(diagnostic).toContainText('stage=authentication');
  await expect(diagnostic).toContainText('code=UNAUTHENTICATED');
  await expect(diagnostic).toContainText('http=401');
  await expect(diagnostic).toContainText('requestId=safe-test-request-id');
  await expect(page.getByRole('alert')).not.toContainText('Diagnostic');
});
