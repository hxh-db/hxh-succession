const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?c_search='+encodeURIComponent('クラピカ')+'#characters');await ready(page);await page.locator('#spoilerRange').selectOption('all');
 const original=page.locator('.directory-character-card[data-character-id="P14-H01"] h3 a');await original.click();
 const target=()=>page.locator('#modalContent .schedule-event').last();
 await target().focus();await target().scrollIntoViewIfNeeded();
 const position=await page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop),eventId=await target().getAttribute('data-event-id');
 assert.ok(position>1000,'use the bottom of a long real timeline');
 const personUrl=page.url(),beforeLength=await page.evaluate(()=>history.length);
 const waitPerson=async()=>{await page.waitForURL(personUrl);await ready(page);await page.waitForFunction(id=>document.activeElement?.dataset.eventId===id,eventId);
   assert.equal(await page.locator('#modalTitle').innerText(),'クラピカ');
   assert.ok(Math.abs(await page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop)-position)<2,'restore the exact reading position');
   assert.equal(await page.locator('#characterSearch').inputValue(),'クラピカ');assert.ok(await page.locator('#characters').isVisible());};
 const waitEvent=async()=>{await ready(page);await page.waitForFunction(id=>document.querySelector('#detailModal').dataset.eventId===id,eventId);
   assert.ok(await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).isVisible());assert.equal(new URL(page.url()).searchParams.get('event'),eventId);};
 await target().press('Enter');await waitEvent();
 assert.equal(await page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop),0,'a newly opened event starts at its heading');
 assert.equal(await page.evaluate(()=>history.length),beforeLength+1);
 const eventUrl=page.url();assert.equal(new URL(eventUrl).searchParams.has('returnPersonId'),false,'return context is not part of a shared URL');
 await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await waitPerson();
 assert.equal(await page.evaluate(()=>history.length),beforeLength+1,'return reuses the person entry');
 await page.goForward();await waitEvent();await page.keyboard.press('Escape');await waitPerson();
 await page.goForward();await waitEvent();await page.goBack();await waitPerson();
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#detailModal').classList.contains('hidden'));await ready(page);
 assert.ok(await page.locator('#characters').isVisible());assert.equal(await page.locator('#characterSearch').inputValue(),'クラピカ');
 assert.equal(await original.evaluate(el=>el===document.activeElement),true);
 // A fresh recipient opens an ordinary event link, with no invented return path.
 const recipient=await context.newPage();await recipient.goto(eventUrl);await ready(recipient);
 assert.equal(await recipient.getByRole('button',{name:'元の人物へ戻る',exact:true}).count(),0);await recipient.close();await page.bringToFront();
 // Opening a person from the event must retain both existing return directions.
 await original.click();await target().press('Enter');await waitEvent();
 const chip=page.locator('#modalContent a[data-character-link]').first(),otherId=await chip.getAttribute('data-character-link');
 await chip.click();await page.waitForURL('**/characters/'+otherId+'/');
 await page.getByRole('button',{name:'元の出来事へ戻る',exact:true}).click();await waitEvent();
 await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await waitPerson();
 await target().press('Enter');await waitEvent();await page.reload();await waitEvent();
 await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await waitPerson();
 // The evidence link in the person's location uses the same return path.
 const location=page.locator('#modalContent .latest-place-event-link').first();await location.focus();await location.scrollIntoViewIfNeeded();
 const locationPosition=await page.locator('.modal-card').evaluate(el=>el.scrollTop),locationUrl=await location.getAttribute('href');
 await location.press('Enter');await ready(page);assert.equal(new URL(page.url()).searchParams.get('event'),new URL(locationUrl).searchParams.get('event'));
 await page.getByRole('button',{name:'元の人物へ戻る',exact:true}).click();await ready(page);
 assert.equal(await location.evaluate(el=>el===document.activeElement),true);
 assert.ok(Math.abs(await page.locator('.modal-card').evaluate(el=>el.scrollTop)-locationPosition)<2);
 await target().focus();await target().scrollIntoViewIfNeeded();
 // Another tab hiding later information cannot restore an old open disclosure.
 await target().press('Enter');await waitEvent();const settings=await context.newPage();await settings.goto(base+'theories/');await settings.locator('#spoilerRange').selectOption('basic');
 await page.bringToFront();await page.waitForURL(personUrl);await ready(page);assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');
 assert.equal(await page.locator('#modalContent .person-later-info').evaluate(el=>el.open),false);await settings.close();
 assert.equal(await page.locator('.modal-card').evaluate(el=>el.scrollTop),0,'a hidden return target leaves the basic detail at its heading');
 await page.goto(base+'?person=P04-U01&detail=1#characters');await ready(page);await page.locator('#modalContent .person-later-info > summary').click();
 assert.equal(await page.locator('.timeline-empty-state').innerText(),'関連する出来事は未登録です。');
 // A locally opened disclosure does not enable full information on the event page.
 await page.goto(base+'?person=P14-H01&detail=1#characters');await ready(page);
 await page.locator('#modalContent .person-later-info > summary').click();await target().focus();await target().scrollIntoViewIfNeeded();
 const basicPosition=await page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop);
 await target().press('Enter');await ready(page);assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');
 assert.ok(await page.locator('#detailModal').isHidden());await page.goBack();await ready(page);
 assert.equal(await page.locator('#modalContent .person-later-info').evaluate(el=>el.open),true,'restore the explicit local disclosure');
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.eventId),eventId);
 assert.ok(Math.abs(await page.locator('#detailModal .modal-card').evaluate(el=>el.scrollTop)-basicPosition)<2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 console.log(`PASS ${width}: person position/focus, event return/back/forward/Escape, nested person, safe sharing and cross-tab disclosure`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
