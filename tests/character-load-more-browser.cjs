const {chromium}=require('playwright'),assert=require('node:assert/strict');const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#characters');await ready(page);
 const cards=page.locator('#characterDirectory .directory-character-card'),more=page.locator('#characterMoreButton'),total=await page.evaluate(()=>currentCharacterResults.length);
 assert.ok(total>120);assert.equal(await cards.count(),60);assert.equal(await more.getAttribute('aria-controls'),'characterDirectory');
 const original=await cards.first().elementHandle(),prefix=await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.characterId));
 const add=async()=>{
  const before=await cards.count(),remaining=total-before,expected=await page.evaluate(index=>currentCharacterResults[index].id,before);
  assert.equal(await more.innerText(),`もっと見る（次の${Math.min(60,remaining)}人）`);await more.focus();await more.scrollIntoViewIfNeeded();await more.press('Enter');
  assert.equal(await cards.count(),Math.min(total,before+60));assert.equal(await page.evaluate(()=>document.activeElement.dataset.characterLink),expected);
  assert.ok(await page.evaluate(()=>{const rect=document.activeElement.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight+1;}),'focus the newly added person within the viewport');
  return expected;
 };
 const firstNew=await add();assert.equal(await original.evaluate(el=>el.isConnected),true);assert.deepEqual(await cards.evaluateAll(nodes=>nodes.slice(0,60).map(n=>n.dataset.characterId)),prefix);
 await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>{const card=document.activeElement.closest('.directory-character-card');const index=[...document.querySelectorAll('#characterDirectory .directory-character-card')].indexOf(card);return index>=60&&index<120;}),'Tab must continue inside the new results, rather than skip them');
 const link=page.locator(`#characterDirectory [data-character-link="${firstNew}"]`).first();await link.focus();const position=await page.evaluate(()=>scrollY);await link.press('Enter');await page.waitForFunction(id=>history.state?.characterId===id,firstNew);
 await page.goBack();await ready(page);assert.equal(await cards.count(),120);assert.equal(await page.evaluate(()=>document.activeElement.dataset.characterLink),firstNew);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-position)<2);
 while(await more.isVisible())await add();
 assert.equal(await cards.count(),total);assert.ok(await more.isHidden());assert.match(await page.locator('#characterPageStatus').innerText(),new RegExp(`${total}人中${total}人`));
 const actual=await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.characterId));assert.equal(new Set(actual).size,total);assert.deepEqual(actual,await page.evaluate(()=>currentCharacterResults.map(p=>p.id)));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 // Pointer activation retains the visible reading position and does not force focus to a person.
 const fresh=await fixture(browser,{width,local:false}),pointer=await fresh.context.newPage();pointer.on('pageerror',e=>errors.push(e.message));await pointer.goto(fresh.base+'#characters');await ready(pointer);
 const pointerMore=pointer.locator('#characterMoreButton');await pointerMore.focus();await pointerMore.scrollIntoViewIfNeeded();const top=await pointer.evaluate(()=>scrollY);await pointerMore.click();
 assert.equal(await pointer.locator('#characterDirectory .directory-character-card').count(),120);assert.equal(await pointer.evaluate(()=>document.activeElement.id),'characterMoreButton');assert.ok(Math.abs(await pointer.evaluate(()=>scrollY)-top)<2);
 await pointer.locator('#characterSearch').fill('該当なし人物XYZ');assert.ok(await pointer.locator('#characterLoadMore').isHidden());await pointer.locator('#clearCharacterFilters').click();assert.equal(await pointer.locator('#characterDirectory .directory-character-card').count(),60);assert.equal(await pointerMore.innerText(),'もっと見る（次の60人）');
 assert.deepEqual(errors,[]);await fresh.context.close();console.log(`PASS ${width}: new-result keyboard focus, reading/return continuity, exact final count, complete ordered list and unchanged pointer position`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
