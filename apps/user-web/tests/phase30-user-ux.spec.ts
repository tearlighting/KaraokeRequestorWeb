import { expect, test } from '@playwright/test';

function mockUserApi(page: import('@playwright/test').Page, seen: string[] = []) {
  return page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/v1', '');
    seen.push(`${request.method()} ${path}${url.search}`);
    let data: unknown = {};
    if (path === '/user/session') data = { userId: 'phase30-browser' };
    else if (path === '/capabilities') data = { features: { everything_search: true, lister_search: false }, server: { room_name: 'OFF Room' } };
    else if (path === '/user/profile') data = { id: 'phase30-browser', displayName: 'Natsu' };
    else if (path === '/queue') data = { items: [{ id: 23, position: 1, display_name: '[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv', singer: 'Natsu', nowplaying: '未再生', kind: '動画', keychange: 0 }], total: 1, remaining_count: 1, has_more: false };
    else if (path === '/playback') data = { playing: false };
    else if (path === '/playback/agent') data = { connected: false, playback: 'unavailable', active: false, taskState: null, mpv: null };
    else if (path === '/user/reservations') data = { items: [], hasMore: false, nextOffset: 0 };
    else if (path === '/search') data = { total: 1, items: [{ name: '[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv', fullpath: 'Z:/authorized/real-file.mkv', artist: '', size: 200000000 }] };
    return route.fulfill({ status: 200, json: { ok: true, data } });
  });
}

test('mobile navigation is four-tab, preferences live in My Page, and the User queue requests only active items', async ({ page }) => {
  const seen: string[] = [];
  await mockUserApi(page, seen);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.getByTestId('user-bottom-nav');
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: '歌いたい曲を探す' })).toBeVisible();
  await expect(page.locator('.user-topbar [data-testid="locale-switch"]')).toHaveCount(0);
  await nav.getByRole('link', { name: 'マイページ' }).click();
  await expect(page.getByTestId('locale-switch')).toBeVisible();
  await nav.getByRole('link', { name: 'キュー' }).click();
  await expect(page.getByTestId('queue')).toContainText('DanMachi - ED ep06');
  expect(seen.some(value => value === 'GET /queue?limit=20&offset=0&scope=active')).toBe(true);
});

test('search results show a cleaned display title but song detail retains the full filename', async ({ page }) => {
  await mockUserApi(page);
  await page.goto('/');
  await page.getByTestId('search-keyword').fill('DanMachi');
  await page.getByTestId('search-submit').click();
  await expect(page.getByRole('button', { name: 'DanMachi - ED ep06 の詳細' })).toBeVisible();
  await page.getByRole('button', { name: 'DanMachi - ED ep06 の詳細' }).click();
  await expect(page.getByTestId('song-detail').getByRole('heading', { name: 'DanMachi - ED ep06' })).toBeVisible();
  await page.getByText('ファイル情報').click();
  await expect(page.locator('.raw-media-name p').first()).toContainText('[ReinForce] DanMachi - ED ep06 (BDRip 1920x1080 x264 FLAC).mkv');
});
