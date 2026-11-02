const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {for(const width of [1280,390,320]) {
  const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const guideUrl=base+'?g_search='+encodeURIComponent('戒厳令')+'&g_topic=lawGuideTitle#guide';
  const link=()=>page.locator('#guide a[href="?event=E416-001#timeline"]');
  const back=()=>page.getByRole('button',{name:'元の資料へ戻る',exact:true});
  const visitGuide=async()=>{await page.goto(guideUrl);await ready(page);await page.locator('#spoilerRange').selectOption('all');await link().scrollIntoViewIfNeeded();await link().focus();};
  const snapshot=()=>page.evaluate(()=>({url:location.href,scroll:scrollY,search:document.getElementById('guideSearch').value,details:[...document.querySelectorAll('#guide details[id][open]')].map(el=>el.id)}));
  const open=async()=>{await link().press('Enter');await ready(page);await page.waitForFunction(()=>document.getElementById('detailModal').dataset.eventId==='E416-001');assert.ok(await back().isVisible());};
  const checkReturn=async before=>{
   await page.waitForURL(before.url);await ready(page);
   const after=await snapshot();assert.equal(after.search,before.search);assert.deepEqual(after.details,before.details);
   assert.ok(Math.abs(after.scroll-before.scroll)<2,JSON.stringify({before,after}));
   assert.ok(await link().evaluate(el=>document.activeElement===el));
   assert.equal(await page.locator('#spoilerRange').inputValue(),'all');
  };
  await visitGuide();const before=await snapshot();await open();await back().click();await checkReturn(before);
  await page.goForward();await ready(page);assert.ok(await back().isVisible());await back().click();await checkReturn(before);
  const popupPromise=context.waitForEvent('page');await link().click({modifiers:['Control']});
  const popup=await popupPromise;await popup.bringToFront();await ready(popup);
  assert.equal(await popup.getByRole('button',{name:'元の資料へ戻る',exact:true}).count(),0);
  assert.equal(page.url(),before.url);await popup.close();await page.bringToFront();
  await link().focus();await open();
  const person=page.locator('#modalContent a[data-character-link]').first();await person.click();
  await page.getByRole('button',{name:'元の出来事へ戻る',exact:true}).click();await ready(page);
  assert.ok(await back().isVisible());await back().click();await checkReturn(before);
  await link().focus();await open();await page.locator('#modalClose').click();
  assert.equal(await page.locator('[data-primary-panel]:not([hidden])').getAttribute('data-primary-panel'),'timeline');
  await page.goBack();await checkReturn(before);
  await link().focus();await open();await page.locator('#spoilerRange').selectOption('basic');
  assert.ok(await page.locator('#detailModal').isHidden(),'changing disclosure range closes the detail as before');
  await page.goBack();await ready(page);
  assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');assert.equal(await page.locator('#guideSearch').inputValue(),'戒厳令');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'guideSearch');assert.ok(await page.locator('#lawGuideTitle').isHidden());
  await page.goto(base+'?event=E416-001&from_guide=lawGuideTitle#timeline');await ready(page);
  assert.equal(await back().count(),0,'a shared or invented URL cannot create a source context');
  await visitGuide();await open();await page.reload();await ready(page);assert.equal(await back().count(),0,'reload does not invent a live source-link reference');
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS ${width}: guide return with exact focus/scroll/search/folds, history, person round trip, native tab, close, basic safety and direct/reloaded links`);
 }} finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
