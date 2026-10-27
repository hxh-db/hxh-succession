const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [1280,390]){
  const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>localStorage.setItem('hxh-succession-spoilers-revealed-v1','true'));
  await page.goto(base+'?person=P12&detail=1#characters');await ready(page);await page.locator('#detailModal:not(.hidden)').waitFor();assert.match(await page.locator('#modalTitle').innerText(),/モモゼ/);
  await page.locator('#modalClose').click();await page.waitForFunction(()=>!CharacterRoutes.isActive());await page.locator('#characterSearch').fill('クラピカ');
  const count=await page.evaluate(()=>currentCharacterResults.length);assert.ok(count>1);const personUrl=await page.locator('#currentViewLink').getAttribute('href');assert.equal(new URL(personUrl).searchParams.has('person'),false);assert.equal(new URL(personUrl).searchParams.has('detail'),false);
  const other=await context.newPage();await other.goto(personUrl);await ready(other);assert.equal(await other.locator('#characterSearch').inputValue(),'クラピカ');assert.equal(await other.evaluate(()=>currentCharacterResults.length),count);
  await page.reload();await ready(page);assert.equal(await page.locator('#characterSearch').inputValue(),'クラピカ');
  await page.goto(base+'?event=E414-001#timeline');await ready(page);await page.locator('#detailModal:not(.hidden)').waitFor();await page.locator('#modalClose').click();
  await page.locator('#timelineSearch').fill('クラピカ 電話');const eventCount=await page.evaluate(()=>filteredEventsData.length);const chapter=await page.locator('#chapterFilter').inputValue();
  const eventUrl=await page.locator('#currentViewLink').getAttribute('href');assert.equal(new URL(eventUrl).searchParams.has('event'),false);
  await other.goto(eventUrl);await ready(other);assert.equal(await other.locator('#timelineSearch').inputValue(),'クラピカ 電話');assert.equal(await other.locator('#chapterFilter').inputValue(),chapter);assert.equal(await other.evaluate(()=>filteredEventsData.length),eventCount);assert.equal(await other.locator('#detailModal').getAttribute('aria-hidden'),'true');
  await page.reload();await ready(page);assert.equal(await page.locator('#timelineSearch').inputValue(),'クラピカ 電話');assert.equal(await page.evaluate(()=>filteredEventsData.length),eventCount);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: initial person/event detail retained; changed list searches survive sharing and reload without stale record reopening`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
