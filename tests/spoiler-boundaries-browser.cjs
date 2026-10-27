const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
const defs=require('../data/character_tags.json').definitions;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [1280,390]){
  const {context,base}=await fixture(browser,{local:false,width,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=base+'?c_view=table&c_assignment=any&c_search='+encodeURIComponent('モモゼ')+'#characters';
  await page.goto(url);await ready(page);
  const body=page.locator('#characterAssignmentTable tbody');
  const hidden=async()=>{assert.equal(await page.locator('#globalSpoilerToggle').getAttribute('aria-pressed'),'false');assert.doesNotMatch(await body.innerText(),/遺体|暗殺|呪殺|拘束房|第371話|第389話/);};
  await hidden();await page.locator('#characterViewCards').click();assert.doesNotMatch(await page.locator('#characterDirectory').innerText(),/暗殺|呪殺|拘束房/);
  await page.locator('#characterViewTable').click();await hidden();
  await page.locator('#globalSpoilerToggle').click();assert.match(await body.innerText(),/遺体が最後/);assert.match(await body.innerText(),/暗殺|拘束房/);
  await page.locator('#globalSpoilerToggle').click();await hidden();await page.locator('#characterSearch').fill('ヌクオコン');await hidden();
  await page.locator('#characterViewCards').click();assert.doesNotMatch(await page.locator('#characterDirectory').innerText(),/呪殺/);
  await page.locator('#characterViewTable').click();await page.locator('#globalSpoilerToggle').click();assert.match(await body.innerText(),/呪殺/);
  const other=await context.newPage();await other.goto(url);await ready(other);await other.locator('#globalSpoilerToggle').click();await page.waitForFunction(()=>spoilersRevealed===false);await hidden();
  const clean=async()=>{assert.equal(await page.locator('#globalSpoilerToggle').getAttribute('aria-pressed'),'false');assert.deepEqual(await page.evaluate(()=>[...activeCharacterTags.values()]),[]);assert.ok(await page.evaluate(()=>currentCharacterResults.some(p=>p.id==='P01')));assert.doesNotMatch(await page.locator('#characterActiveTag').innerText(),/死亡|親子|呪殺/);};
  const curse=defs.find(t=>t.category==='任務'&&t.label==='呪殺');assert.ok(curse);
  for(const id of ['status-deceased','nen-user','relation-parent-child',curse.id]){
   await page.goto(base+'?c_tags='+id+'#characters');await ready(page);await clean();assert.equal(new URL(page.url()).searchParams.has('c_tags'),false);
  }
  const camp=await page.locator('#characterCampFilter option').nth(1).getAttribute('value');
  await page.goto(base+'?c_camp='+encodeURIComponent(camp)+'#characters');await ready(page);await clean();
  assert.equal(await page.locator('#characterCampFilter').inputValue(),'all');assert.equal(new URL(page.url()).searchParams.has('c_camp'),false);
  await page.locator('#globalSpoilerToggle').click();await page.goto(base+'?c_camp='+encodeURIComponent(camp)+'#characters');await ready(page);
  assert.equal(await page.locator('#characterCampFilter').inputValue(),camp);assert.ok(await page.evaluate(camp=>currentCharacterResults.length>0&&currentCharacterResults.every(p=>p.camp===camp),camp));
  await other.goto(base);await ready(other);await other.locator('#globalSpoilerToggle').click();await page.waitForFunction(()=>!spoilersRevealed);await clean();
  assert.equal(await page.locator('#characterCampFilter').inputValue(),'all');
  await page.locator('#globalSpoilerToggle').click();await page.goto(base+'?c_tags=status-deceased#characters');await ready(page);
  assert.deepEqual(await page.evaluate(()=>[...activeCharacterTags.values()]),['status-deceased']);assert.ok(await page.evaluate(()=>currentCharacterResults.every(p=>/^死亡/.test(p.status))));
  await other.goto(base+'?c_tags=status-deceased#characters');await ready(other);await other.locator('#globalSpoilerToggle').click();await page.waitForFunction(()=>spoilersRevealed===false);await clean();
  await page.locator('#globalSpoilerToggle').click();await page.goto(base+'?c_tags=status-deceased#characters');await ready(page);
  await page.locator('[data-primary-view="guide"]').click();await page.locator('#globalSpoilerToggle').click();await page.goBack();await ready(page);await clean();
  await page.goto(base+'?c_tags=group-kurapika-team#characters');await ready(page);assert.deepEqual(await page.evaluate(()=>[...activeCharacterTags.values()]),['group-kurapika-team']);assert.ok(await page.locator('.directory-character-card[data-character-id="P14-H01"]').count());
  fs.mkdirSync('.local/spoiler-boundaries-20261028',{recursive:true});await page.screenshot({path:`.local/spoiler-boundaries-20261028/safe-${width}.png`});
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log(`PASS ${width}: table/card and secret-mission boundaries; tag URLs, enabled filters, history/cross-tab OFF and safe affiliation sharing`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
