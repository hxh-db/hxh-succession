const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1280,390]) for(const failure of ['404','abort',null]) {
   const {context,base}=await fixture(browser,{local:false,width});
   if(failure) await context.route('**/luzurus-guard-toothless-panel.webp',route=>failure==='abort'?route.abort():route.fulfill({status:404,body:''}));
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'?person=P07-U02&detail=1#characters');await ready(page);
   const avatar=page.locator('#detailModal .char-avatar').first();await avatar.waitFor({state:'visible'});
   if(failure) {
    await page.waitForFunction(()=>{const node=document.querySelector('#detailModal .char-avatar');return node && node.textContent && !node.style.backgroundImage;});
    assert.equal(await avatar.getAttribute('role'),null);assert.equal(await avatar.getAttribute('tabindex'),null);
    assert.equal(await avatar.getAttribute('data-zoom-src'),null);await avatar.click();
    assert.ok(!await page.locator('#imageLightbox').evaluate(node=>node.open));
   } else {
    await avatar.locator('xpath=self::*[contains(@class,"avatar-zoomable")]').waitFor();
    await avatar.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.getElementById('imageLightbox').open && document.getElementById('lightboxImage').naturalWidth>0);
    assert.match(await page.locator('#lightboxImage').getAttribute('src'),/luzurus-guard-toothless-panel/);
   }
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS crop avatar ${width} ${failure || 'success'}: initials and no dead zoom on failure, original-image keyboard zoom on success`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
