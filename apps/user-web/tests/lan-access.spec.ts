import { expect, test } from '@playwright/test';

test('LAN user entry stays same-origin, mobile-fit, and isolates anonymous browser sessions', async ({ browser, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const pageUrls: string[] = [];
  const first = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const second = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const pages = [await first.newPage(), await second.newPage()];
    const userIds: string[] = [];
    for (const page of pages) {
      page.on('request', request => { if (request.url().includes('/api/v1/')) pageUrls.push(request.url()); });
      const session = page.waitForResponse(response => response.url().endsWith('/api/v1/user/session') && response.request().method() === 'POST');
      const queue = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/queue' && response.request().method() === 'GET');
      const playback = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/playback' && response.request().method() === 'GET');
      const profile = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/user/profile' && response.request().method() === 'GET');
      await page.goto(`${baseURL}/user/`);
      await expect(page.getByTestId('user-heading')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const response = await session;
      expect(response.ok()).toBe(true);
      userIds.push((await response.json()).data.userId);
      expect((await queue).status()).toBe(200);
      expect((await playback).status()).toBe(200);
      expect((await profile).status()).toBe(200);
      const cookies = await page.context().cookies(`${baseURL}/api/v1/queue`);
      const userSession = cookies.find(cookie => cookie.name === 'YukariUserSession');
      const stableUserId = cookies.find(cookie => cookie.name === 'YkariUserID');
      expect(userSession?.sameSite).toBe('Strict');
      expect(userSession?.path).toBe('/api/v1');
      expect(stableUserId?.sameSite).toBe('Strict');
      expect(stableUserId?.path).toBe('/');
    }
    expect(userIds[0]).toBeTruthy(); expect(userIds[1]).toBeTruthy(); expect(userIds[0]).not.toBe(userIds[1]);
    expect(pageUrls.length).toBeGreaterThan(0);
    for (const url of pageUrls) expect(new URL(url).origin).toBe(baseURL);
    const receiptState = await pages[0]!.evaluate(async () => {
      const headers = { 'Content-Type': 'application/json', 'X-Yukari-Client': '1' };
      const intent = await fetch('/api/v1/requests/intent', { method: 'POST', headers, body: '{}' });
      if (!intent.ok) return `intent-http-${intent.status}`;
      const { data } = await intent.json();
      const result = await fetch('/api/v1/requests/result', { method: 'POST', headers, body: JSON.stringify({ receipt: data.receipt }) });
      if (!result.ok) return `result-http-${result.status}`;
      return (await result.json()).data.state;
    });
    expect(receiptState).toBe('not_found');
    const forbidden = await pages[0]!.evaluate(async () => {
      const [adminApi, adminPage] = await Promise.all([fetch('/api/v1/admin/queue'), fetch('/admin/')]);
      return [adminApi.status, adminPage.status];
    });
    expect(forbidden).toEqual([404, 404]);
  } finally {
    await first.close(); await second.close();
  }
});

