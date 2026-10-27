const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/browser-fixture.cjs');
const sources=require('../data/character_images.json');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const width of [1280,390]) for(const id of ['P07-U02','P14-H01']) for(const failure of ['404','abort',null]) {
      const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'});
      const file=sources.find(item=>item.id===id).image;
      if(failure) await context.route('**/'+file,route=>failure==='abort'?route.abort():route.fulfill({status:404,body:''}));
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+`characters/${id}/`);
      const avatar=page.locator('.character-page-avatar');
      await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('.character-page-avatar')?.dataset.avatarState));
      if(failure) {
        assert.equal(await avatar.getAttribute('data-avatar-state'),'error');
        assert.ok((await avatar.innerText()).trim());
        assert.equal(await avatar.getAttribute('href'),null);
        assert.equal(await avatar.getAttribute('data-zoom-src'),null);
        assert.equal(await avatar.getAttribute('role'),'img');
        assert.match(await avatar.getAttribute('aria-label'),/読み込めませんでした/);
        const before=page.url();await avatar.click();
        assert.equal(page.url(),before);assert.ok(!await page.locator('#imageLightbox').evaluate(node=>node.open));
      } else {
        assert.equal(await avatar.getAttribute('data-avatar-state'),'ready');
        await avatar.focus();await page.keyboard.press('Enter');
        await page.waitForFunction(()=>document.getElementById('imageLightbox').open && document.getElementById('lightboxImage').naturalWidth>0);
        assert.ok((await page.locator('#lightboxImage').getAttribute('src')).endsWith(file));
        await page.keyboard.press('Escape');assert.ok(await avatar.evaluate(node=>node===document.activeElement));
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.deepEqual(errors,[]);await context.close();
      console.log(`PASS static avatar ${width} ${id} ${failure || 'success'}: fallback/no dead zoom, or full-source keyboard zoom and focus return`);
    }
    const {context,base}=await fixture(browser,{local:false,width:390});
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await context.route('**/luzurus-guard-toothless-panel.webp',async route=>{await gate;await route.fulfill({path:require('node:path').join(process.cwd(),'images/characters/luzurus-guard-toothless-panel.webp'),contentType:'image/webp'});});
    try {
      const page=await context.newPage();await page.goto(base+'characters/P07-U02/',{waitUntil:'domcontentloaded'});
      const avatar=page.locator('.character-page-avatar');
      await page.waitForFunction(()=>document.querySelector('.character-page-avatar')?.dataset.avatarState==='loading');
      assert.equal(await avatar.getAttribute('href'),null);assert.equal(await avatar.getAttribute('aria-disabled'),'true');
      await avatar.evaluate(node=>node.click());assert.ok(!await page.locator('#imageLightbox').evaluate(node=>node.open));
      release();await page.waitForFunction(()=>document.querySelector('.character-page-avatar')?.dataset.avatarState==='ready');
      await avatar.click();await page.waitForFunction(()=>document.getElementById('imageLightbox').open && document.getElementById('lightboxImage').naturalWidth>0);
      console.log('PASS static avatar pending: disabled during loading, then zoom becomes usable');
    } finally {release();await context.close();}
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
