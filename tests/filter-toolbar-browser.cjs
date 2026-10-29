const {chromium}=require('playwright'),assert=require('node:assert/strict');const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const group=page.locator('#typeFilter'),conversation=group.locator('[data-value="conversation"]');
 const open=async()=>{const toggle=page.locator('#timelineFilterToggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();};
 const checkSelection=async value=>{
  assert.equal(await group.evaluate(el=>el.value),value);assert.equal(await group.locator('[aria-pressed="true"]').count(),1);
  assert.equal(await group.locator('[aria-pressed="true"]').getAttribute('data-value'),value);assert.equal(await group.locator('[tabindex="0"]').count(),1);
 };
 await page.goto(base+'?t_period=all#timeline');await ready(page);await page.locator('#spoilerRange').selectOption('all');await open();
 assert.equal(await group.getAttribute('role'),'toolbar');assert.equal(await group.getAttribute('aria-label'),'出来事の種類');await checkSelection('all');
 assert.equal(await group.getByRole('button',{name:'すべて',exact:true}).count(),1,'the first button must not inherit the enclosing field label');
 assert.equal(await group.getByRole('button',{name:await conversation.textContent(),exact:true}).count(),1);
 const original=await conversation.elementHandle();await conversation.focus();await conversation.press('Enter');
 await checkSelection('conversation');assert.equal(await original.evaluate(el=>el===document.activeElement),true,'keep the selected button rather than replacing it');
 assert.ok(await page.evaluate(()=>filteredEventsData.length>0&&filteredEventsData.every(e=>getEventTypeGroup(e)==='conversation')));
 const before=page.url(),ids=await page.evaluate(()=>filteredEventsData.map(e=>e.id));await conversation.press('ArrowRight');
 const next=await page.evaluate(()=>document.activeElement.dataset.value);assert.notEqual(next,'conversation');assert.equal(page.url(),before);assert.deepEqual(await page.evaluate(()=>filteredEventsData.map(e=>e.id)),ids);
 await page.keyboard.press('Space');await checkSelection(next);assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),next);
 const enabled=await group.locator('button:not(:disabled)').evaluateAll(nodes=>nodes.map(n=>n.dataset.value));
 await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),enabled[0]);
 await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),enabled[enabled.length-1]);
 // Refreshing result counts must neither replace a focused button nor steal input focus.
 await conversation.focus();await conversation.press('Enter');await page.locator('#timelineSearch').fill('該当しない出来事XYZ');
 await checkSelection('conversation');assert.equal(await conversation.isDisabled(),false);assert.ok(await group.locator('button:disabled').count()>0);assert.equal(await page.evaluate(()=>document.activeElement.id),'timelineSearch');
 assert.equal(await original.evaluate(el=>el.isConnected),true);await page.locator('#clearTimelineSearch').click();assert.ok((await conversation.textContent()).match(/\d+/));
 await page.locator('.timeline-view-tab[data-view="chapters"]').click();await checkSelection('conversation');assert.equal(await group.locator('button:disabled').count(),0);assert.doesNotMatch(await conversation.textContent(),/\d/);
 await page.locator('.timeline-view-tab[data-view="schedule"]').click();await checkSelection('conversation');assert.match(await conversation.textContent(),/\d/);assert.equal(await original.evaluate(el=>el.isConnected),true);
 await page.locator('[data-primary-view="characters"]').click();await page.goBack();await ready(page);await open();await checkSelection('conversation');
 await page.reload();await ready(page);await open();await checkSelection('conversation');
 // A selected zero-count type remains operable, and clearing it keeps the person condition.
 await page.goto(base+'?t_period=all&t_person=P04-U01&t_type=conversation#timeline');await ready(page);await open();await checkSelection('conversation');
 assert.equal(await conversation.isDisabled(),false);assert.match(await conversation.textContent(),/0$/);assert.equal(await page.evaluate(()=>filteredEventsData.length),0);
 await conversation.focus();await conversation.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.dataset.value),'all');await page.keyboard.press('Enter');await checkSelection('all');assert.equal(await page.locator('#participantFilter').inputValue(),'P04-U01');
 // Pointer clicks keep native button focus without a forced jump elsewhere.
 await page.goto(base+'?t_period=all#timeline');await ready(page);await open();await conversation.click();await checkSelection('conversation');assert.equal(await conversation.evaluate(el=>el===document.activeElement),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: stable filter buttons, ARIA selection, arrows/Home/End/Space, count refresh, views/history, zero counts and pointer focus`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
