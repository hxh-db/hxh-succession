const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
const fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await ready(page);await page.locator('#spoilerRange').selectOption('all');
 const event=async id=>{await ready(page);await page.waitForFunction(id=>document.getElementById('detailModal').dataset.eventId===id&&!document.getElementById('detailModal').classList.contains('hidden'),id);assert.equal(new URL(page.url()).searchParams.get('event'),id);};
 const scene=(source,target,field,container='#modalContent')=>page.locator(`${container} .simultaneous-scenes[data-event-id="${source}"]${field==='same_incident_with'?'[data-field="same_incident_with"]':':not([data-field])'} a[href*="event=${target}"]`);
 const position=()=>page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop);
 const prepare=async link=>{await link.focus();await link.scrollIntoViewIfNeeded();return position();};
 for(const [source,target,field] of [['E385-002','E387-001','same_incident_with'],['E400-001','E404-008','simultaneous_with']]){
  await page.goto(base+`?event=${source}#timeline`);await event(source);
  const origin=scene(source,target,field),before=await prepare(origin),sourceUrl=page.url();
  await origin.press('Enter');await event(target);assert.equal(await position(),0);
  assert.equal(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).count(),0);
  const returnLink=scene(target,source,field),targetTop=await prepare(returnLink),targetUrl=page.url();
  await page.waitForFunction(top=>history.state?.readingSnapshot?.eventDetail?.scrollTop===top,targetTop);
  await page.goBack();await page.waitForURL(sourceUrl);await event(source);
  assert.ok(Math.abs(await position()-before)<2);assert.ok(await origin.evaluate(el=>el===document.activeElement));
  await page.goForward();await page.waitForURL(targetUrl);await event(target);
  assert.ok(Math.abs(await position()-targetTop)<2);assert.ok(await returnLink.evaluate(el=>el===document.activeElement));
  await page.reload();await event(target);
  await page.goBack();await event(source);
  const popupPromise=context.waitForEvent('page');const originalUrl=page.url();await origin.click({modifiers:['Control']});
  const popup=await popupPromise;await popup.bringToFront();await ready(popup);assert.equal(new URL(popup.url()).searchParams.get('event'),target);
  assert.equal(await popup.getByRole('button',{name:'元の人物へ戻る',exact:true}).count(),0);
  assert.equal(await popup.getByRole('button',{name:'元の資料へ戻る',exact:true}).count(),0);
  assert.equal(page.url(),originalUrl);assert.equal(await page.locator('#detailModal').getAttribute('data-event-id'),source);
  await popup.close();await page.bringToFront();
 }
 // A modal opened without an event URL still obtains an accurate source entry.
 await page.goto(base+'?t_search='+encodeURIComponent('テータ')+'&t_period=all&t_view=chapters#timeline');await ready(page);
 const chapter=page.locator('#timeline .chapter-group[data-chapter="385"]');if(!await chapter.evaluate(el=>el.open))await chapter.locator('summary').click();
 const listState=()=>page.evaluate(()=>({search:document.getElementById('timelineSearch').value,chapter:document.getElementById('chapterFilter').value,ids:filteredEventsData.map(e=>e.id),open:[...document.querySelectorAll('#chapterEventGroups details[open]')].map(el=>el.dataset.chapter)}));
 const beforeList=await listState();assert.ok(beforeList.ids.length>5);
 const card=page.locator('#timeline .schedule-event[data-event-id="E385-002"]');await card.focus();await card.press('Enter');
 assert.equal(new URL(page.url()).searchParams.has('event'),false);
 const unlinked=scene('E385-002','E387-001','same_incident_with'),unlinkedTop=await prepare(unlinked);
 await unlinked.press('Enter');await event('E387-001');await page.goBack();await event('E385-002');
 assert.ok(Math.abs(await position()-unlinkedTop)<2);assert.ok(await unlinked.evaluate(el=>document.activeElement===el));
 await page.locator('#modalClose').click();assert.deepEqual(await listState(),beforeList,'returning to a source event must preserve the underlying search, chapter, results and open groups');
 // Scene navigation from a person's event must not inherit that person's return context.
 await page.goto(base+'?person=P04&detail=1#characters');await ready(page);
 const personUrl=page.url(),personCard=page.locator('#modalContent .schedule-event[data-event-id="E385-002"]');const personTop=await prepare(personCard);
 await personCard.press('Enter');await event('E385-002');assert.ok(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).isVisible());
 await scene('E385-002','E387-001','same_incident_with').press('Enter');await event('E387-001');assert.equal(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).count(),0);
 await page.goBack();await event('E385-002');await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await page.waitForURL(personUrl);await ready(page);
 assert.ok(Math.abs(await position()-personTop)<2);assert.ok(await personCard.evaluate(el=>document.activeElement===el));
 // The guide context belongs to its original event, not a subsequently opened scene.
 await page.goto(base+'?g_search='+encodeURIComponent('戒厳令')+'&g_topic=lawGuideTitle#guide');await ready(page);
 const guideLink=page.locator('#guide a[href="?event=E416-001#timeline"]');await guideLink.scrollIntoViewIfNeeded();await guideLink.press('Enter');await event('E416-001');
 const related=page.locator('#modalContent .simultaneous-scenes a').first(),relatedId=await related.getAttribute('data-scene-id');await related.press('Enter');await event(relatedId);
 assert.equal(await page.getByRole('button',{name:'元の資料へ戻る',exact:true}).count(),0);
 await page.goBack();await event('E416-001');assert.ok(await related.evaluate(el=>document.activeElement===el));
 await page.getByRole('button',{name:'元の資料へ戻る',exact:true}).click();await ready(page);assert.ok(await guideLink.evaluate(el=>document.activeElement===el));
 await page.goto(base+'?event=E385-002#timeline');await event('E385-002');await page.locator('#spoilerRange').selectOption('basic');
 assert.ok(await page.locator('#detailModal').isHidden());assert.equal(await page.locator('.simultaneous-scene-link[data-scene-id="E387-001"]:visible').count(),0);
 await page.goto(base+'?event=E387-001#timeline');await ready(page);assert.ok(await page.locator('#detailModal').isHidden());assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 console.log(`PASS ${width}: both relation types, URL/reload, Back/Forward reading/focus, native tabs, unlinked modal source, person/guide context and basic protection`);
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
