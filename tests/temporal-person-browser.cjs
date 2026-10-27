const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [1280,390]){
  const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('hxh-succession-spoilers-revealed-v1','true'));
  const open=async(chapter,query)=>{await page.goto(base+`?c_group=personnel&c_when=chapter-${chapter}&c_search=${encodeURIComponent(query)}#characters`);await ready(page);};
  await open(365,'ヒュリコフ 私設兵');assert.equal(await page.locator('.directory-character-card').count(),0);
  await open(366,'ヒュリコフ 私設兵');assert.equal(await page.locator('.directory-character-card').count(),1);
  await open(414,'ヒュリコフ ビヨンド');assert.equal(await page.locator('.directory-character-card').count(),0);
  await open(415,'ヒュリコフ ビヨンド');assert.equal(await page.locator('.directory-character-card').count(),1);
  await open(374,'ヒュリコフ');const link=page.locator('.directory-character-card h3 a');assert.match(await link.getAttribute('href'),/c_when=chapter-374/);
  const [other]=await Promise.all([context.waitForEvent('page'),link.click({modifiers:['Control']})]);await other.bringToFront();await ready(other);await other.locator('#detailModal:not(.hidden)').waitFor();
  assert.doesNotMatch(await other.locator('#modalContent').innerText(),/ビヨンド|TSK|鋼の錬金術師|第413話|第415話/);
  assert.equal(await other.locator('#modalContent .local-editor-fields').count(),0);assert.match(await other.locator('#modalContent').innerText(),/血縁情報は未整理/);await other.close();
  await link.click();
  await page.evaluate(()=>document.dispatchEvent(new Event('spoiler-visibility-change')));
  assert.doesNotMatch(await page.locator('#modalContent').innerText(),/ビヨンド|第413話|第415話|第417話|鋼の錬金術師/,'refresh keeps the projected person');
  assert.equal(await page.evaluate(()=>getCharacterAffiliationText({id:'P12',type:'prince',roster_view:{public_data:true}})),null,'latest mother records do not backfill a historical prince');
  await page.locator('#modalClose').click();await page.waitForFunction(()=>!CharacterRoutes.isActive());
  await page.locator('#characterSearch').fill('');assert.equal(await page.evaluate(()=>currentCharacterResults.length),230);
  await page.locator('#characterViewTable').click();assert.equal(await page.locator('#characterAssignmentTable tbody tr').count(),230,'unorganized types remain visible in the roster table');
  assert.ok(await page.evaluate(()=>{const event=eventsData.find(e=>e.id==='E366-004'),original=event.description;event.local_edited=true;event.local_public_values={description:original};event.description='自分用の後の情報';return getPersonnelEvents().find(e=>e.id===event.id).description===original;}));
  await open(374,'クラピカ ハンター');assert.equal(await page.locator('.directory-character-card').count(),0,'unreviewed qualifications do not filter the past roster');
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: classification/family source boundaries, unknown-filter exclusion, temporal Ctrl-link, read-only facts, public events and 230 table rows`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
