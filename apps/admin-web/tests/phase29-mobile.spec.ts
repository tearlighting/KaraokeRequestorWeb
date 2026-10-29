import { expect, test, type Page } from '@playwright/test';

async function openMobileQueue(page:Page,onReorder:(ids:number[])=>void,count=2){
  await page.setViewportSize({width:390,height:844});let reorderCalls=0;let queueIds=Array.from({length:count},(_,index)=>index+1);
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1','');let data:unknown={};let status=200;
    if(path==='/admin/session'&&req.method()==='GET'){status=401;return route.fulfill({status,json:{ok:false,error:{code:'ADMIN_SESSION_REQUIRED',message:'Sign in'}}});}
    if(path==='/admin/session'&&req.method()==='POST')data={username:'admin',password_configured:true,authProvider:'node'};
    else if(path==='/admin/queue')data={items:queueIds.map((id,index)=>({id,position:index+1,reqorder:index+1,display_name:id===1?'First song':'Second song',songfile:id===1?'First song':'Second song',singer:id===1?'A':'B',kind:'\u52d5\u753b',nowplaying:'\u672a\u518d\u751f',keychange:0,comment:''})),total:2,remaining_count:2,has_more:false,remaining_seconds:0};
    else if(path==='/admin/playback/recoverable')data=[];
    else if(path==='/admin/player-agent')data={connected:false,agentId:null,mpvConnected:false,mpvState:'unavailable'};
    else if(path==='/admin/player-agent/mpv')data={connected:false,state:'unavailable'};
    else if(path==='/admin/queue/reorder'){reorderCalls++;const ids=req.postDataJSON().ids;queueIds=[...ids];onReorder(ids);data={reordered:true,count:2};}
    return route.fulfill({status,json:{ok:true,data}});
  });
  await page.goto('/');await page.getByTestId('admin-password').fill('test-only');await page.getByTestId('admin-login').click();
  await expect(page.getByTestId('admin-mobile-nav')).toBeVisible();await expect(page.getByTestId('queue-reorder-list')).toBeVisible();
  await expect(page.locator('.queue-drag-handle')).toHaveCount(count);
  return ()=>reorderCalls;
}

test('mobile Admin uses compact navigation and target-position control commits one atomic queue reorder',async({page})=>{
  let submitted:number[]=[];const calls=await openMobileQueue(page,ids=>{submitted=ids;});
  await page.getByTestId('queue-position-1').selectOption('2');await page.getByTestId('admin-save-queue-order').click();
  await expect.poll(calls).toBe(1);expect(submitted).toEqual([2,1]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('mobile long-press drag previews a destination and submits once on release',async({page})=>{
  let submitted:number[]=[];const calls=await openMobileQueue(page,ids=>{submitted=ids;});
  const source=page.getByTestId('sortable-1'),target=page.getByTestId('sortable-2');await source.scrollIntoViewIfNeeded();const box=await target.boundingBox();expect(box).not.toBeNull();
  await source.locator('.queue-drag-handle').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:20,clientY:20,button:0});
  await page.waitForTimeout(400);
  await page.evaluate(({x,y})=>window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,pointerType:'touch',clientX:x,clientY:y,movementY:40,bubbles:true})),{x:box!.x+box!.width/2,y:box!.y+box!.height/2});
  await expect(source).toHaveClass(/is-dragging/);
  await expect(page.getByTestId('sortable-2').locator('.queue-reorder-position')).toHaveText('01');
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'touch',bubbles:true})));
  await expect.poll(calls).toBe(1);expect(submitted).toEqual([2,1]);
  await expect(page.getByTestId('sortable-2').locator('.queue-reorder-song')).toContainText('Second song');
  await expect(page.getByTestId('sortable-2').locator('.queue-reorder-position')).toHaveText('01');
});

test('desktop queue rows expose a visible grip, compact action menu, and one persistent reorder commit',async({page})=>{
  let submitted:number[]=[];const calls=await openMobileQueue(page,ids=>{submitted=ids;});
  await page.setViewportSize({width:1600,height:1000});
  await expect(page.getByTestId('sortable-1').locator('.queue-drag-handle')).toBeVisible();
  await expect(page.getByTestId('sortable-1').locator('.queue-row-details > summary')).toBeVisible();
  await page.getByTestId('queue-position-1').selectOption('2');
  await page.getByTestId('admin-save-queue-order').click();
  await expect.poll(calls).toBe(1);expect(submitted).toEqual([2,1]);
  await page.getByTestId('admin-refresh-queue').click();
  await expect(page.getByTestId('sortable-2').locator('.queue-reorder-song')).toContainText('Second song');
  await expect(page.getByTestId('sortable-2').locator('.queue-reorder-position')).toHaveText('01');
  await expect(page.locator('.admin-main')).toHaveCSS('max-width','none');
});

test('desktop can drag the 20th reservation to position 2 with one reorder request',async({page})=>{
  let submitted:number[]=[];const calls=await openMobileQueue(page,ids=>{submitted=ids;},20);
  await page.setViewportSize({width:1600,height:900});
  const source=page.getByTestId('sortable-20');
  await source.scrollIntoViewIfNeeded();
  const handle=source.locator('.queue-drag-handle');
  const box=await handle.boundingBox();expect(box).not.toBeNull();
  await handle.dispatchEvent('pointerdown',{pointerType:'mouse',clientX:box!.x+box!.width/2,clientY:box!.y+box!.height/2,button:0,bubbles:true});
  await page.evaluate(({x})=>window.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:x,clientY:20,movementY:-100,bubbles:true})),{x:box!.x+box!.width/2});
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const started=Date.now();
    const timer=window.setInterval(()=>{
      const position=document.querySelector('[data-testid="sortable-20"] .queue-reorder-position')?.textContent?.trim();
      if(position==='02'){
        window.clearInterval(timer);
        window.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse',bubbles:true}));
        resolve();
      }else if(Date.now()-started>6000){window.clearInterval(timer);reject(new Error('drag did not reach position 2'));}
    },10);
  }));
  await expect.poll(calls).toBe(1);
  expect(submitted).toEqual([1,20,...Array.from({length:18},(_,index)=>index+2)]);
  await expect(page.getByTestId('sortable-20').locator('.queue-reorder-position')).toHaveText('02');
});
