const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready,empty}=require('./helpers/browser-fixture.cjs');
const KEY='hxh-succession-local-drafts-v1',target='guide:shipDecksTitle';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const change of ['other','reset','corrupt']) {
      const initial={...empty(),items:{[target]:{memo:'元のPCメモ',updatedAt:'2026-10-26T00:00:00Z'}}};
      const {context,base,state}=await fixture(browser,{local:true,width:390,drafts:initial});
      await context.addInitScript(()=>{
        // Delayed cross-tab notifications must not be required for preservation.
        window.addEventListener('storage',event=>event.stopImmediatePropagation(),true);
        const schedule=window.setTimeout;
        window.setTimeout=(callback,delay,...args)=>schedule(callback,delay===650?60000:delay,...args);
      });
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await ready(page);
      await page.locator('#localDraftsLink').click();
      await page.locator('.local-drafts-backup > summary').click();
      const other=await context.newPage();await other.goto(base+'theories/Q001/');
      await other.locator('.local-editor textarea:not([disabled])').waitFor({state:'attached'});
      await other.locator('.spoiler-article').evaluate(node=>{node.open=true;});
      await other.locator('.local-editor-collapsed > summary').click();
      let release,entered;const paused=new Promise(resolve=>{entered=resolve;});
      const gate=new Promise(resolve=>{release=resolve;});
      await page.route('**/api/drafts',async route=>{
        if(route.request().method()!=='PUT') return route.fallback();
        entered();await gate;await route.fulfill({status:503,body:'{}'});
      });
      const imported={format:initial.format,version:1,items:{[target]:{memo:'読み込み用JSONのメモ'}}};
      page.once('dialog',dialog=>dialog.accept());
      await page.locator('#importLocalDrafts').setInputFiles({name:'isolated-restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
      await paused;
      if(change==='other') {
        await other.locator('.local-editor textarea').fill('通信待ち中の別画面の入力');
        await other.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
      } else await other.evaluate(({KEY,change})=>{
        const next=change==='reset'?JSON.stringify(DraftState.reset(JSON.parse(localStorage.getItem(KEY)))):'{damaged during import';
        localStorage.setItem(KEY,next);
      },{KEY,change});
      const checkpoint=await other.evaluate(KEY=>localStorage.getItem(KEY),KEY);
      release();await page.locator('#localDraftsTransferStatus').filter({hasText:/読み込めませんでした/}).waitFor();
      const retained=await page.evaluate(KEY=>localStorage.getItem(KEY),KEY);
      assert.deepEqual(state.drafts,initial,'A failed PUT must not claim to have saved the file');
      if(change==='other') {
        const saved=JSON.parse(retained);
        assert.equal(saved.items['theory:Q001']?.memo,'通信待ち中の別画面の入力','Failure handling must retain the newer checkpoint');
        assert.equal(saved.items[target].memo,'読み込み用JSONのメモ');
        assert.match(await page.locator('#localDraftsTransferStatus').innerText(),/ブラウザの控えに残/);
        await other.close();await page.unroute('**/api/drafts');
        await page.reload();await ready(page);
        assert.equal(state.drafts.items['theory:Q001'].memo,'通信待ち中の別画面の入力');
        assert.equal(state.drafts.items[target].memo,'読み込み用JSONのメモ');
      } else assert.equal(retained,checkpoint,`${change}: never replace an invalidated browser copy with the old snapshot`);
      assert.deepEqual(errors,[]);await context.close();
      console.log(`PASS import failure ${change}: no stale rollback, original file retained, browser checkpoint protected`);
    }
    const {context,base,state}=await fixture(browser,{local:true,width:1280});
    await context.addInitScript(()=>{
      const write=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value) {
        if(this===sessionStorage && key==='hxh-succession-draft-import-status-v1') throw new DOMException('blocked notice','SecurityError');
        return write.call(this,key,value);
      };
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await ready(page);
    const restored={format:'hxh-succession-local-drafts',version:1,items:{[target]:{memo:'通知保存を禁止しても復元する'}}};
    await Promise.all([page.waitForEvent('load'),page.locator('#importLocalDrafts').setInputFiles({
      name:'isolated-restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(restored))})]);
    await ready(page);
    assert.equal(state.drafts.items[target].memo,'通知保存を禁止しても復元する');
    assert.equal(await page.evaluate(target=>localDrafts.items[target].memo,target),'通知保存を禁止しても復元する');
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS restore success: blocked session-only notice does not prevent reload or report a false failure');
    for(const local of [false,true]) {
      const key='event:LOCAL-legacy-defaults';
      const created={id:'LOCAL-legacy-defaults',chapter:383,chapter_order:1,description:'旧形式の追加出来事',day:null,characters:[]};
      const drafts={...empty(),items:{[key]:{createdRecord:created,updatedAt:'2026-10-26T00:00:00Z'}}};
      const {context,base}=await fixture(browser,{local,width:390,drafts});
      await context.addInitScript(({KEY,drafts})=>localStorage.setItem(KEY,JSON.stringify(drafts)),{KEY,drafts});
      const page=await context.newPage();await page.goto(base);await ready(page);
      const stored=await page.evaluate(async key=>{await readCurrentDrafts();return buildDraftExport().items[key];},key);
      assert.deepEqual(stored.createdRecord,created);
      assert.ok(!stored.conflicts,'Reading/merging a legacy event cannot manufacture a conflict from display defaults');
      assert.equal(await page.evaluate(()=>eventsData.find(item=>item.id==='LOCAL-legacy-defaults').local_created),true);
      await context.close();console.log(`PASS legacy event ${local?'file':'browser'}: stored fields retained verbatim, no false conflict, normalized screen record`);
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
