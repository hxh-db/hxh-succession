const {toggleDisclosure}=require('./helpers/disclosure.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [1280,390]) {
   const {context,base}=await fixture(browser,{local:false,width});
   await context.addInitScript(()=>localStorage.setItem('hxh-succession-spoilers-revealed-v1','true'));
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'?t_view=chapters&t_period=all#timeline');await ready(page);
   const group=chapter=>page.locator(`.chapter-group[data-chapter="${chapter}"]`);
   assert.ok(await page.locator('.chapter-group').first().evaluate(node=>node.open));
   for(const chapter of [344,347]) if(!await group(chapter).evaluate(node=>node.open)) await group(chapter).locator('summary').click();
   await group(344).locator('summary').scrollIntoViewIfNeeded();
   await page.evaluate(()=>saveReadingState());const scroll=await page.evaluate(()=>window.scrollY);
   // Activate without Playwright first scrolling the off-screen header into
   // view: the saved scroll position must be the reading position under test.
   await page.locator('[data-primary-view="guide"]').evaluate(link=>link.click());await page.goBack();await ready(page);
   for(const chapter of [344,347]) assert.ok(await group(chapter).evaluate(node=>node.open));
   assert.ok(Math.abs((await page.evaluate(()=>window.scrollY))-scroll)<8,'Chapter layout and reading position must both restore');
   await page.goForward();await ready(page);assert.ok(await page.locator('#guide').isVisible());
   await page.goBack();await ready(page);
   await page.evaluate(()=>{document.querySelectorAll('.chapter-group').forEach(node=>{node.open=false;});saveReadingState();});
   await page.locator('[data-primary-view="guide"]').click();await page.goBack();await ready(page);
   assert.equal(await page.locator('.chapter-group[open]').count(),0,'All-closed is a saved state');
   await group(344).locator('summary').click();
   const person=group(344).locator('[data-character-link]').first();
   await person.click();await page.locator('#detailModal:not(.hidden)').waitFor();
   await page.goBack();await ready(page);assert.ok(await group(344).evaluate(node=>node.open));
   for(const view of ['characters','timeline','guide']) {
    const before=page.url(),active=await page.evaluate(()=>document.querySelector('[data-primary-panel]:not([hidden])').dataset.primaryPanel);
    const popup=context.waitForEvent('page');await page.locator(`[data-primary-view="${view}"]`).click({modifiers:['Control']});
     const opened=await popup;
     assert.equal(page.url(),before);
     // Activate the new tab so its layout/animation-frame readiness completes.
     await opened.bringToFront();
     const popupErrors=[];opened.on('pageerror',error=>popupErrors.push(error.message));
     try {await ready(opened);}
     catch(error) {throw new Error(`Popup ${view}: ${opened.url()} ${JSON.stringify(await opened.evaluate(()=>({ready:typeof viewLinksReady==='undefined'?null:viewLinksReady,busy:document.getElementById('main-content')?.getAttribute('aria-busy'),message:document.getElementById('databaseLoadMessage')?.textContent})))}, errors=${popupErrors.join('; ')}`,{cause:error});}
    assert.equal(page.url(),before);assert.equal(await page.evaluate(()=>document.querySelector('[data-primary-panel]:not([hidden])').dataset.primaryPanel),active);
    assert.ok(await opened.locator('#'+view).isVisible());await opened.close();
   }
   const prevented=await page.evaluate(()=>{
    const link=document.querySelector('[data-primary-view="characters"]');
    return [{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{button:2}].map(options=>{
     const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,...options});
     // Stop browser navigation after the app listener, preserving its own verdict.
     let appPrevented;const stop=e=>{appPrevented=e.defaultPrevented;e.preventDefault();};
     document.addEventListener('click',stop,{once:true});link.dispatchEvent(event);return appPrevented;
    });
   });assert.deepEqual(prevented,[false,false,false,false,false]);
   await page.locator('[data-primary-view="characters"]').click();
   await page.locator('#characterSearch').fill('死亡');
   assert.equal(await page.locator('.directory-character-card[data-character-id="P12"]').count(),1);
   await toggleDisclosure(page);
   assert.equal(await page.locator('.directory-character-card[data-character-id="P12"]').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   await context.close();console.log(`PASS reading recovery ${width}: chapter keys/multiple/all-closed/history/position/person, Ctrl+new-tab and modifier defaults, status search spoiler protection`);
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
