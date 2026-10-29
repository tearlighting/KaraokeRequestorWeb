import { expect, test } from '@playwright/test';

test('PWA manifest is scoped to User Web and declares standalone app icons', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as { name: string; short_name: string; start_url: string; scope: string; display: string; icons: Array<{ src: string; sizes: string; purpose?: string }> };
  expect(manifest.name).toBe('Yukari Karaoke');
  expect(manifest.short_name).toBe('Yukari');
  expect(manifest.start_url).toBe('/user/');
  expect(manifest.scope).toBe('/user/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map(icon => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await page.request.get(`/${icon.src}`)).ok()).toBe(true);
  expect((await page.request.get('/icons/yukari-180.png')).ok()).toBe(true);
});

test('standalone mode detection supports the iOS Safari standalone flag', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }));
  await page.goto('/');
  await expect.poll(() => page.locator('html').getAttribute('data-standalone')).toBe('true');
});

test('User Web keeps normal browser access and does not register an offline service worker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  expect(await page.evaluate(() => navigator.serviceWorker?.controller === null)).toBe(true);
});

test('mobile user flow keeps search context and submits from the song detail route',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('yukari.selectedParticipant.v1','some-other-person'));
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/v1','');let data:unknown={};
    if(path==='/user/session')data={userId:'actor-a'};
    else if(path==='/capabilities')data={features:{everything_search:true,lister_search:false},server:{room_name:'Test room'}};
    else if(path==='/user/profile')data={id:'actor-a',displayName:'Tester'};
    else if(path==='/search')data={total:1,items:[{name:'Test song ED',fullpath:'Z:/authorized/Test song ED.mkv',artist:'Test Artist',size:1024}]};
    else if(path==='/queue')data={items:[],total:0,remaining_count:0,has_more:false,remaining_seconds:0};
    else if(path==='/playback')data={playing:false};
    else if(path==='/playback/agent')data={connected:false,playback:'unavailable',active:false,taskState:null,mpv:null};
    else if(path==='/requests/intent')data={receipt:'mock-receipt'};
    else if(path==='/requests'&&req.method()==='POST')data={id:4102,warnings:[]};
    else if(path==='/requests/result')data={state:'committed',result:{id:4102,warnings:[]}};
    else if(path==='/user/reservations')data={items:[{id:4102,title:'Test song ED',singer:'Tester',kind:'video',status:'queued',position:1,requestedAt:1700000000,playbackState:null,startedAt:null,finishedAt:null,errorCode:null}],hasMore:false,nextOffset:1};
    return route.fulfill({status:path==='/requests'?201:200,json:{ok:true,data}});
  });
  await page.goto('/');
  await expect(page.getByTestId('user-bottom-nav')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('yukari.selectedParticipant.v1'))).toBeNull();
  await page.getByTestId('search-keyword').fill('Test song');await page.getByTestId('search-submit').click();
  await expect(page).toHaveURL(/\/search\/results$/);await expect(page.getByTestId('search-results-title')).toBeVisible();await expect(page.getByTestId('search-keyword-refine')).toHaveValue('Test song');
  await page.locator('.search-result-button').click();await expect(page).toHaveURL(/\/song$/);await expect(page.getByTestId('song-detail')).toContainText('Test song ED');await expect(page.locator('#participant-select')).toHaveCount(0);
  await page.getByTestId('song-detail-back').click();await expect(page).toHaveURL(/\/search\/results$/);await expect(page.getByTestId('search-results-title')).toBeVisible();
  await page.locator('.search-result-button').click();await expect(page).toHaveURL(/\/song$/);
  await page.getByTestId('reservation-submit').click();await expect(page).toHaveURL(/\/queue$/);await expect(page.getByTestId('reservation-feedback')).toContainText('#4102');
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(1).click();await expect(page.getByTestId('user-player-page')).toBeVisible();await expect(page.getByTestId('user-player-controls')).toBeVisible();
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(2).click();await expect(page.getByTestId('user-queue-page')).toBeVisible();
  await page.getByTestId('user-bottom-nav').getByRole('link').nth(3).click();await expect(page.getByTestId('my-reservation-4102')).toContainText('Test song ED');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('first reservation saves the entered nickname as this session participant',async({page})=>{
  const writes:string[]=[];
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1','');let data:unknown={};
    if(path==='/user/session')data={userId:'first-time-actor'};
    else if(path==='/capabilities')data={features:{everything_search:true},server:{}};
    else if(path==='/user/profile'&&req.method()==='GET')data={id:'first-time-actor',displayName:''};
    else if(path==='/user/profile'&&req.method()==='PUT'){const body=JSON.parse(req.postData()||'{}') as {displayName:string};writes.push(`profile:${body.displayName}`);data={id:'first-time-actor',displayName:body.displayName};}
    else if(path==='/search')data={total:1,items:[{name:'First song',fullpath:'Z:/authorized/First song.mkv',artist:'',size:1024}]};
    else if(path==='/requests/intent')data={receipt:'first-time-receipt'};
    else if(path==='/requests'&&req.method()==='POST'){const body=JSON.parse(req.postData()||'{}') as {participantId:string;singer:string};writes.push(`reservation:${body.participantId}:${body.singer}`);data={id:4201,warnings:[]};}
    else if(path==='/requests/result')data={state:'committed',result:{id:4201,warnings:[]}};
    else if(path==='/queue')data={items:[],total:0,remaining_count:0,has_more:false,remaining_seconds:0};
    else if(path==='/playback')data={playing:false};
    else if(path==='/playback/agent')data={connected:false,playback:'unavailable',active:false,taskState:null,mpv:null};
    return route.fulfill({status:path==='/requests'?201:200,json:{ok:true,data}});
  });
  await page.goto('/');
  await page.getByTestId('search-keyword').fill('First song');await page.getByTestId('search-submit').click();
  await page.locator('.search-result-button').click();
  await page.getByTestId('reservation-singer').fill('Natsu');
  await expect(page.getByTestId('reservation-submit')).toBeEnabled();
  await page.getByTestId('reservation-submit').click();
  await expect(page.getByTestId('reservation-feedback')).toContainText('#4201');
  expect(writes).toEqual(['profile:Natsu','reservation:first-time-actor:Natsu']);
});

test('player page controls the current track but exposes no queue skip or stop action',async({page})=>{
  const commands:unknown[]=[];
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1','');let data:unknown={};
    if(path==='/user/session')data={userId:'player-actor'};
    else if(path==='/capabilities')data={features:{everything_search:true},server:{}};
    else if(path==='/user/profile')data={id:'player-actor',displayName:'Natsu'};
    else if(path==='/playback')data={playing:true,playingtitle:'Current song',playingsinger:'Natsu',status:'再生中'};
    else if(path==='/playback/agent')data={connected:true,playback:'playing',active:true,taskState:'playing',mpv:{connected:true,state:'playing',duration:180,position:32,volume:72,muted:false,audioDelay:0,keySemitones:0,keyChangeAvailable:true,audioTracks:[{id:2,title:'Original vocal',selected:true},{id:7,title:'Instrumental',selected:false}],selectedAudioTrackId:2,subtitleTracks:[{id:4,title:'Lyrics',selected:true}],selectedSubtitleTrackId:4}};
    else if(path==='/user/player/control'&&req.method()==='POST'){commands.push(JSON.parse(req.postData()||'{}'));data={queued:true,action:(JSON.parse(req.postData()||'{}') as {action:string}).action,id:'control-id'};}
    else if(path==='/danmaku/status')data={enabled:false};
    return route.fulfill({status:200,json:{ok:true,data}});
  });
  await page.setViewportSize({width:390,height:844});await page.goto('/player');
  await expect(page.getByTestId('user-player-page')).toContainText('Current song');
  await expect(page.getByRole('button',{name:'スキップ',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'停止',exact:true})).toHaveCount(0);
  await page.getByLabel('音声トラック').selectOption('7');await expect.poll(()=>commands.length).toBe(1);
  await page.getByRole('button',{name:'一時停止'}).click();await expect.poll(()=>commands.length).toBe(2);
  expect(commands).toEqual([{action:'audio-track',trackId:7},{action:'pause'}]);
});

