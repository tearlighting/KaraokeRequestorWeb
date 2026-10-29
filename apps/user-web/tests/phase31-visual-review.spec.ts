import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.cwd(), '../../docs/ui-review/phase31');
const idle = { connected: true, playback: 'playing', active: true, taskState: 'playing', mpv: { connected: true, state: 'playing', duration: 184, position: 61, volume: 68, muted: false, audioDelay: 0, keySemitones: 0, keyChangeAvailable: true, fullscreen: false, audioTracks: [{ id: 1, title: 'Vocal', selected: true }, { id: 3, title: 'Instrumental', selected: false }], selectedAudioTrackId: 1, subtitleTracks: [{ id: 2, title: 'Lyrics', selected: false }], selectedSubtitleTrackId: null } };
const reservations = [
  { id: 81, title: '[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv', singer: 'Natsu', kind: 'video', status: 'queued', position: 1, requestedAt: 1793320000, playbackState: null, startedAt: null, finishedAt: null, errorCode: null },
  { id: 80, title: 'Karaoke - Instrumental mix', singer: 'Sora', kind: 'video', status: 'playing', position: 0, requestedAt: 1793319000, playbackState: 'playing', startedAt: 1793319100, finishedAt: null, errorCode: null },
];

async function setup(page: Page, theme: 'default' | 'anisong-dark', agentOffline = false) {
  await page.addInitScript(value => { localStorage.setItem('yukari-theme', value); localStorage.setItem('yukari-locale', 'ja'); }, theme);
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = {};
    if (path === '/playback/agent' && agentOffline) return route.fulfill({ status: 503, json: { ok: false, error: { code: 'AGENT_OFFLINE', message: '隔离测试：Agent 未连接' } } });
    if (path === '/user/session') data = { userId: 'phase31-isolated-session' };
    else if (path === '/capabilities') data = { features: { everything_search: true, lister_search: false }, server: { room_name: 'OFF Karaoke' } };
    else if (path === '/user/profile') data = { id: 'phase31-isolated-session', displayName: 'Natsu' };
    else if (path === '/search' && url.searchParams.get('keyword') === 'phase31-no-match') data = { total: 0, items: [] };
    else if (path === '/search') data = { total: 3, items: [
      { name: '[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv', fullpath: 'MOCK:/media/ed06.mkv', artist: 'Yuka Iguchi', size: 212000000 },
      { name: 'DanMachi - OP Hey World', fullpath: 'MOCK:/media/op.mkv', artist: 'Yuka Iguchi', size: 180000000 },
      { name: 'DanMachi - Insert Song', fullpath: 'MOCK:/media/insert.mkv', artist: 'Saori Hayami', size: 140000000 },
    ] };
    else if (path === '/playback') data = { playing: true, playingtitle: 'DanMachi - ED ep06', playingsinger: 'Natsu', status: 'playing' };
    else if (path === '/playback/agent') data = idle;
    else if (path === '/danmaku/status') data = { enabled: true };
    else if (path === '/queue') data = { items: reservations.map((item, index) => ({ id: item.id, position: index + 1, display_name: item.title, singer: item.singer, nowplaying: index === 0 ? '\u672a\u518d\u751f' : '\u518d\u751f\u4e2d', kind: item.kind, keychange: index === 0 ? -2 : 0 })), total: 2, remaining_count: 1, has_more: false };
    else if (path === '/user/reservations') data = { items: reservations, hasMore: false, nextOffset: reservations.length };
    else if (path === '/requests/intent') data = { receipt: 'phase31-mock-receipt' };
    else if (path === '/requests' && request.method() === 'POST') data = { id: 99, warnings: [] };
    else if (path === '/requests/result') data = { state: 'committed', result: { id: 99, warnings: [] } };
    else if (path === '/user/player/control' && request.method() === 'POST') data = { queued: true, action: 'mock' };
    return route.fulfill({ status: path === '/requests' ? 201 : 200, json: { ok: true, data } });
  });
}

test('Phase 31 isolated visual review captures mobile and desktop User pages and checks CTA/layout bounds', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const measurements: Record<string, unknown>[] = [];
  async function open(width: number, height: number, theme: 'default' | 'anisong-dark', agentOffline = false) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await setup(page, theme, agentOffline);
    await page.goto('/');
    await expect(page.getByTestId('user-home')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return { page, context };
  }
  async function capture(page: Page, name: string, fullPage = false) {
    await page.screenshot({ path: resolve(output, name), fullPage, animations: 'disabled' });
    measurements.push(await page.evaluate((screenshot) => {
      const box = (selector: string) => { const node = document.querySelector(selector); if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
      const main = document.querySelector('main');
      return { screenshot, viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, theme: document.documentElement.dataset.theme, main: box('main'), search: box('.search-form'), results: box('.search-results-list'), detail: box('[data-testid="song-detail"]'), reservationCta: box('[data-testid="reservation-submit"]'), participantHint: box('.reservation-current-singer'), player: box('[data-testid="user-player-controls"]'), volume: box('input[aria-label="音量"]'), queue: box('[data-testid="queue-panel"]'), myPage: box('[data-testid="my-page"]'), tabs: box('[data-testid="user-bottom-nav"]'), mainScrollHeight: main?.scrollHeight ?? 0 };
    }, name));
  }

  let { page, context } = await open(440, 956, 'default');
  await capture(page, 'iphone-home-sakura.png');
  await page.getByTestId('search-keyword').fill('DanMachi');
  await page.getByTestId('search-submit').click();
  await expect(page.getByTestId('search-results-title')).toBeVisible();
  await capture(page, 'iphone-search-sakura.png');
  await page.locator('.search-result-button').first().click();
  await expect(page.getByTestId('song-detail')).toBeVisible();
  const cta = page.getByTestId('reservation-submit');
  await cta.scrollIntoViewIfNeeded();
  const ctaBox = await cta.boundingBox();
  const tabBox = await page.getByTestId('user-bottom-nav').boundingBox();
  const participantHintBox = await page.locator('.reservation-current-singer').boundingBox();
  expect(ctaBox).not.toBeNull(); expect(tabBox).not.toBeNull();
  expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(tabBox!.y + 1);
  expect(participantHintBox).not.toBeNull();
  expect(participantHintBox!.y + participantHintBox!.height).toBeLessThan(ctaBox!.y);
  await capture(page, 'iphone-detail-sakura.png');
  await context.close();

  ({ page, context } = await open(440, 956, 'default'));
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(1).click();
  await expect(page.getByTestId('user-player-controls')).toBeVisible();
  await capture(page, 'iphone-player-sakura.png');
  await page.getByLabel('音声トラック').scrollIntoViewIfNeeded();
  await capture(page, 'iphone-player-controls-sakura.png');
  await page.getByTestId('danmaku-panel').scrollIntoViewIfNeeded();
  await capture(page, 'iphone-player-danmaku-sakura.png');
  await context.close();

  ({ page, context } = await open(440, 956, 'default'));
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(2).click();
  await expect(page.getByTestId('queue-panel')).toBeVisible();
  await capture(page, 'iphone-queue-sakura.png', true);
  await context.close();

  ({ page, context } = await open(440, 956, 'default'));
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(3).click();
  await expect(page.getByTestId('my-page')).toBeVisible();
  await capture(page, 'iphone-my-sakura.png', true);
  await context.close();

  ({ page, context } = await open(390, 844, 'default'));
  await page.getByTestId('search-keyword').fill('DanMachi'); await page.getByTestId('search-submit').click();
  await capture(page, 'iphone-search-390-sakura.png');
  await context.close();

  ({ page, context } = await open(440, 956, 'default'));
  await page.getByTestId('search-keyword').fill('phase31-no-match'); await page.getByTestId('search-submit').click();
  await expect(page.getByText('曲が見つかりません。キーワードや曲庫の設定をご確認ください。')).toBeVisible();
  await capture(page, 'iphone-search-empty-sakura.png');
  await context.close();

  ({ page, context } = await open(360, 780, 'default'));
  await page.getByTestId('search-keyword').fill('DanMachi'); await page.getByTestId('search-submit').click(); await page.locator('.search-result-button').first().click();
  await page.getByTestId('reservation-submit').scrollIntoViewIfNeeded();
  await capture(page, 'iphone-detail-360-sakura.png');
  await context.close();

  ({ page, context } = await open(1440, 900, 'default'));
  await capture(page, 'desktop-home-sakura.png');
  await page.locator('.user-desktop-nav a').nth(1).click(); await expect(page.getByTestId('user-player-controls')).toBeVisible();
  await capture(page, 'desktop-player-sakura.png');
  await context.close();

  ({ page, context } = await open(1440, 900, 'anisong-dark'));
  await page.locator('.user-desktop-nav a').nth(1).click(); await expect(page.getByTestId('user-player-controls')).toBeVisible();
  await capture(page, 'desktop-player-aurora.png');
  await context.close();

  ({ page, context } = await open(440, 956, 'default', true));
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(1).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await capture(page, 'iphone-player-agent-offline-mock-sakura.png');
  await context.close();

  await writeFile(resolve(output, 'metrics.json'), `${JSON.stringify({ source: 'isolated-mock API; no production reservations or playback controls were used', generatedAt: new Date().toISOString(), measurements }, null, 2)}\n`);
});
