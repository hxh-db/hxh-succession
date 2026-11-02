const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await ready(page);await page.locator('#spoilerRange').selectOption('all');
 const event=async id=>{await ready(page);await page.waitForFunction(id=>document.getElementById('detailModal').dataset.eventId===id&&!document.getElementById('detailModal').classList.contains('hidden'),id);assert.equal(new URL(page.url()).searchParams.get('event'),id);};
 const state=()=>page.evaluate(()=>({search:document.getElementById('timelineSearch').value,chapter:document.getElementById('chapterFilter').value,view:activeTimelineView,period:activeTimelinePeriodId,ids:filteredEventsData.map(e=>e.id),groups:[...document.querySelectorAll('#chapterEventGroups details[open]')].map(el=>el.dataset.chapter),top:scrollY}));
 for(const view of ['schedule','chapters']){
  await page.goto(base+`?event=E385-002&t_view=${view}#timeline`);await event('E385-002');await page.locator('#modalClose').click();assert.ok(await page.locator('#detailModal').isHidden());
  const cards=()=>page.locator(view==='chapters'?'#chapterEventGroups .schedule-event[data-event-id="E385-003"]':'#timelineSchedule .schedule-event[data-event-id="E385-003"]');
  if(view==='chapters'){const group=page.locator('#chapterEventGroups .chapter-group[data-chapter="385"]');if(!await group.evaluate(el=>el.open))await group.locator('summary').click();}
  await cards().scrollIntoViewIfNeeded();await cards().focus();const before=await state();
  await cards().press('Enter');await event('E385-003');await page.reload();await event('E385-003');await page.locator('#modalClose').click();await ready(page);await page.waitForFunction(()=>!new URL(location.href).searchParams.has('event'));
  assert.ok(await page.locator('#detailModal').isHidden());assert.deepEqual(await state(),before);assert.ok(await cards().evaluate(el=>el===document.activeElement));
  await page.goForward();await event('E385-003');await page.goBack();await ready(page);assert.deepEqual(await state(),before);assert.ok(await cards().evaluate(el=>el===document.activeElement));
 }
 // Starting without an event URL preserves a multi-chapter search through close.
 await page.goto(base+'?t_search='+encodeURIComponent('テータ')+'&t_period=all&t_view=chapters#timeline');await ready(page);
 const group=page.locator('#chapterEventGroups .chapter-group[data-chapter="385"]');if(!await group.evaluate(el=>el.open))await group.locator('summary').click();
 const card=page.locator('#chapterEventGroups .schedule-event[data-event-id="E385-002"]');await card.scrollIntoViewIfNeeded();await card.focus();const filtered=await state();await card.press('Enter');await event('E385-002');await page.keyboard.press('Escape');await ready(page);await page.waitForFunction(()=>!new URL(location.href).searchParams.has('event'));assert.deepEqual(await state(),filtered);assert.ok(await card.evaluate(el=>el===document.activeElement));
 // Each real claim button returns to its exact position in the person modal.
 await page.goto(base+'?person=Q08&detail=1#characters');await ready(page);const personUrl=page.url();
 // Isolated in-memory duplicate: two rows referencing one event must return to distinct buttons.
 await page.evaluate(()=>{const person=charactersData.find(p=>p.id==='Q08');person.review_claims.push(structuredClone(person.review_claims[0]));showDetailModal(person.id,'bodyguard');});
 const claims=page.locator('#modalContent .character-review-panel button');const count=await claims.count();assert.ok(count>=3);
 assert.equal(new Set(await claims.evaluateAll(buttons=>buttons.map(el=>el.dataset.claimKey))).size,count);
 for(let index=0;index<count;index++){
  const button=claims.nth(index);await button.focus();await button.scrollIntoViewIfNeeded();const key=await button.getAttribute('data-claim-key'),id=(await button.getAttribute('title')).replace('場面ID ','');const top=await page.locator('.modal-card').evaluate(el=>el.scrollTop);
  await button.press('Enter');await event(id);assert.ok(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).isVisible());await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await page.waitForURL(personUrl);await ready(page);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.claimKey),key);assert.ok(Math.abs(await page.locator('.modal-card').evaluate(el=>el.scrollTop)-top)<2);
 }
 // Card evidence returns to the card, not an invented person modal.
 await page.goto(base+'?c_search='+encodeURIComponent('オイト')+'#characters');await ready(page);
 const directory=page.locator('.directory-character-card[data-character-id="Q08"]');await directory.locator('.directory-character-details > summary').click();
 const proof=directory.locator('.character-review-panel button').first();await proof.focus();await proof.scrollIntoViewIfNeeded();const proofKey=await proof.getAttribute('data-claim-key'),proofTop=await page.evaluate(()=>scrollY),listUrl=page.url(),proofId=(await proof.getAttribute('title')).replace('場面ID ','');
 await proof.press('Enter');await event(proofId);assert.equal(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).count(),0);await page.locator('#modalClose').click();await page.waitForURL(listUrl);await ready(page);
 assert.ok(await page.locator('#detailModal').isHidden());assert.equal(await page.evaluate(()=>document.activeElement.dataset.claimKey),proofKey);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-proofTop)<2);assert.ok(await directory.locator('.directory-character-details').evaluate(el=>el.open));
 await page.locator('#spoilerRange').selectOption('basic');assert.equal(await directory.locator('.character-review-panel button:visible').count(),0);
 await page.goto(base+'?event='+proofId+'#timeline');await ready(page);assert.ok(await page.locator('#detailModal').isHidden());assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log(`PASS ${width}: schedule/chapter cards, stale/direct/new URLs, reload/close/history, exact filters/open groups/position/focus, every claim button, card evidence and basic protection`);
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
