const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
const label='内容が推測の出来事を非表示 ×';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const chip=()=>page.getByRole('button',{name:label,exact:true});
 const collapse=async()=>{const toggle=page.locator('#timelineFilterToggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='true')await toggle.click();};
 await page.goto(base+'?t_period=all&t_hypotheses=hide#timeline');await ready(page);
 assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');assert.ok(await chip().isHidden());assert.equal(await page.locator('#timeline .schedule-event:visible').count(),0);
 await page.locator('#spoilerRange').selectOption('all');await collapse();assert.ok(await chip().isVisible());
 const totals=await page.evaluate(()=>({all:eventsData.length,visible:filteredEventsData.length,estimated:eventsData.filter(e=>e.is_estimate).length}));
 assert.ok(totals.estimated>0);assert.equal(totals.visible,totals.all-totals.estimated);
 assert.ok(await page.locator('#hideHypothesisEvents').isChecked());if(width<600)assert.ok(await page.locator('#hideHypothesisEvents').isHidden());
 await page.reload();await ready(page);await collapse();assert.ok(await chip().isVisible());
 const share=await page.locator('#currentViewLink').getAttribute('href');assert.equal(new URL(share).searchParams.get('t_hypotheses'),'hide');
 const fresh=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),recipient=await fresh.context.newPage();await recipient.goto(share);await ready(recipient);
 assert.equal(await recipient.locator('#spoilerRange').inputValue(),'basic');assert.equal(await recipient.locator('#timeline .schedule-event:visible').count(),0);
 await recipient.locator('#spoilerRange').selectOption('all');assert.ok(await recipient.getByRole('button',{name:label,exact:true}).isVisible());
 assert.equal(await recipient.evaluate(()=>filteredEventsData.length),totals.visible);await fresh.context.close();await page.bringToFront();
 await page.locator('[data-primary-view="characters"]').click();await page.goBack();await ready(page);assert.ok(await chip().isVisible());
 await page.goForward();await ready(page);assert.ok(await page.locator('#characters').isVisible());await page.goBack();await ready(page);
 await collapse();await chip().focus();const top=await page.evaluate(()=>scrollY);await chip().press('Enter');
 assert.equal(await page.locator('#hideHypothesisEvents').isChecked(),false);assert.equal(await chip().count(),0);assert.equal(await page.evaluate(()=>document.activeElement.id),'timelineSearch');
 assert.ok(Math.abs(await page.evaluate(()=>scrollY)-top)<2);assert.equal(await page.evaluate(()=>filteredEventsData.length),totals.all);assert.equal(new URL(page.url()).searchParams.has('t_hypotheses'),false);
 await page.reload();await ready(page);assert.equal(await page.locator('#hideHypothesisEvents').isChecked(),false);assert.equal(await chip().count(),0);
 await page.locator('[data-primary-view="characters"]').click();await page.goBack();await ready(page);
 assert.equal(await page.locator('#hideHypothesisEvents').isChecked(),false);assert.equal(await chip().count(),0);
 // Preserve a real matching event's search, date, chapter, person, place and series.
 const sample=await page.evaluate(()=>{
  const event=eventsData.find(e=>e.is_estimate&&e.series&&getRoomAreaIds(e).length&&e.characters.some(id=>CHAR_MAP[id]));
  if(!event)return null;const person=event.characters.find(id=>CHAR_MAP[id]);
  return {id:event.id,query:CHAR_MAP[person].name,person,room:getRoomAreaIds(event)[0],chapter:String(event.chapter),series:event.series,period:getEventPeriodId(event),type:getEventTypeGroup(event)};
 });assert.ok(sample,'use a real estimated event with several matching filters');
 const url=new URL(base);for(const [key,value] of Object.entries({t_search:sample.query,t_period:sample.period,t_person:sample.person,t_room:sample.room,t_chapter:sample.chapter,t_series:sample.series,t_type:sample.type,t_hypotheses:'hide'}))url.searchParams.set(key,value);url.hash='timeline';
 await page.goto(url.href);await ready(page);await collapse();assert.ok(await chip().isVisible());
 const controls=()=>page.evaluate(()=>({query:document.getElementById('timelineSearch').value,person:document.getElementById('participantFilter').value,room:document.getElementById('roomFilter').value,chapter:document.getElementById('chapterFilter').value,series:document.getElementById('seriesFilter').value,type:document.getElementById('typeFilter').value,period:activeTimelinePeriodId}));
 const before=await controls(),buttons=await page.locator('#timelineActiveFilters button').allTextContents(),length=await page.evaluate(()=>history.length);
 assert.equal(await page.evaluate(id=>filteredEventsData.some(e=>e.id===id),sample.id),false);
 await chip().focus();await chip().press('Enter');assert.deepEqual(await controls(),before);assert.equal(await page.evaluate(()=>history.length),length);
 assert.equal(await page.evaluate(id=>filteredEventsData.some(e=>e.id===id),sample.id),true,JSON.stringify({sample,controls:await controls()}));
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),buttons[buttons.length-2],'last chip returns focus to the previous condition');
 assert.equal(new URL(page.url()).searchParams.has('t_hypotheses'),false);
 // Chapter selection spans dates; separately verify a specific date survives removal.
 url.searchParams.delete('t_chapter');await page.goto(url.href);await ready(page);await collapse();
 const dated=await controls();assert.equal(dated.period,sample.period);assert.notEqual(dated.period,'all');
 await chip().focus();await chip().press('Enter');assert.deepEqual(await controls(),dated);
 // Removing a first chip focuses its next neighbour; removing the final one focuses search.
 await page.goto(base+'?t_period=all&t_hypotheses=hide&t_search='+encodeURIComponent('クラピカ')+'#timeline');await ready(page);await collapse();
 const searchChip=page.getByRole('button',{name:'検索：クラピカ ×',exact:true});await searchChip.focus();await searchChip.press('Enter');
 assert.equal(await chip().evaluate(el=>el===document.activeElement),true);assert.ok(await page.locator('#hideHypothesisEvents').isChecked());
 await chip().press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'timelineSearch');
 // Pointer removal does not move focus to a new chip or the search field.
 await page.goto(base+'?t_period=all&t_hypotheses=hide&t_search='+encodeURIComponent('クラピカ')+'#timeline');await ready(page);await collapse();await chip().click();
 assert.equal(await page.locator('#timelineSearch').inputValue(),'クラピカ');assert.equal(await page.evaluate(()=>document.activeElement.id==='timelineSearch'||document.activeElement.matches('.timeline-active-filter')),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 console.log(`PASS ${width}: visible hypothesis condition, checkbox-only removal, exact remaining filters, keyboard/pointer focus, URL/reload/history and basic-mode protection`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
