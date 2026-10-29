const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const input=page.locator('#participantCandidateSearch'),select=page.locator('#participantFilter'),clear=page.locator('#clearParticipantCandidates');
 const options=()=>select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
 const eventIds=()=>page.evaluate(()=>filteredEventsData.map(e=>e.id));
 const open=async()=>{
  const toggle=page.locator('#timelineFilterToggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  const details=page.locator('.timeline-more-filters');if(!(await details.evaluate(el=>el.open)))await details.locator('summary').click();
 };
 await page.goto(base+'?t_search='+encodeURIComponent('電話')+'&t_period=all#timeline');await ready(page);
 assert.equal(await page.locator('#spoilerRange').inputValue(),'basic');assert.ok(await input.isHidden());assert.equal(await page.locator('#timeline .schedule-event:visible').count(),0);
 await page.locator('#spoilerRange').selectOption('all');assert.ok(await input.isHidden(),'the helper starts inside the collapsed extra filters');await open();
 const allOptions=await options(),initial=await eventIds(),originalUrl=page.url();assert.ok(allOptions.length>200);assert.equal(await select.inputValue(),'all');
 await input.focus();await page.evaluate(()=>{
  const input=document.getElementById('participantCandidateSearch');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='くら';
  input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'くら'}));
 });assert.deepEqual(await options(),allOptions,'do not rebuild the picker during composition');
 await page.evaluate(()=>{const input=document.getElementById('participantCandidateSearch');input.value='くらぴか';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'くらぴか'}));});
 assert.ok((await options()).includes('P14-H01'));assert.ok((await options()).length<allOptions.length);assert.equal(await page.evaluate(()=>document.activeElement.id),'participantCandidateSearch');
 assert.deepEqual(await eventIds(),initial);assert.equal(page.url(),originalUrl);await input.press('Enter');assert.deepEqual(await eventIds(),initial);
 // Native select remains keyboard operable; selection, not candidate text, applies the condition.
 await select.focus();await select.press('ArrowDown');await page.waitForFunction(()=>document.getElementById('participantFilter').value==='P14-H01');
 assert.equal(new URL(page.url()).searchParams.get('t_person'),'P14-H01');assert.equal(await page.locator('#timelineSearch').inputValue(),'電話');
 assert.ok(await page.evaluate(()=>filteredEventsData.every(e=>e.characters.includes('P14-H01'))));
 const selectedEvents=await eventIds(),selectedUrl=page.url();await input.fill('存在しない人物候補');
 assert.deepEqual(await options(),['all','P14-H01']);assert.equal(await select.inputValue(),'P14-H01');assert.match(await select.locator('option:checked').innerText(),/選択中/);
 assert.match(await page.locator('#participantCandidateStatus').innerText(),/候補0件.*選択.*維持/);assert.deepEqual(await eventIds(),selectedEvents);assert.equal(page.url(),selectedUrl);
 await clear.click();assert.equal(await input.inputValue(),'');assert.equal(await select.inputValue(),'P14-H01');assert.deepEqual(await options(),allOptions);assert.deepEqual(await eventIds(),selectedEvents);
 for(const [query,id] of [['ｸﾗﾋﾟｶ','P14-H01'],['第１王子','P01'],['ベンジャミン＝ホイコーロ','P01'],['シャア組員１','SAA-U01'],['ワブル監視兵1','P14-U01']]){
  await input.fill(query);assert.ok((await options()).includes(id),query);
  if(query==='第１王子')assert.ok(!(await options()).includes('P11'),'prince number 1 must not match 11');
  assert.equal(await select.inputValue(),'P14-H01');assert.deepEqual(await eventIds(),selectedEvents);assert.equal(page.url(),selectedUrl);
 }
 await input.fill('ベンジャミン＝ホイコーロ');await select.selectOption('P01');assert.equal(new URL(page.url()).searchParams.get('t_person'),'P01');
 const share=await page.locator('#currentViewLink').getAttribute('href');assert.equal(new URL(share).searchParams.get('t_search'),'電話');assert.ok(!new URL(share).searchParams.has('participantCandidateSearch'));
 await page.reload();await ready(page);await open();assert.equal(await input.inputValue(),'');assert.equal(await select.inputValue(),'P01');assert.deepEqual(await options(),allOptions);
 await input.fill('くらぴか');await page.locator('[data-primary-view="characters"]').click();await page.goBack();await ready(page);await open();
 assert.equal(await select.inputValue(),'P01');assert.equal(await input.inputValue(),'');await page.goForward();await ready(page);await page.goBack();await ready(page);await open();assert.equal(await select.inputValue(),'P01');
 await input.fill('候補なし');
 const participantChip=page.locator('#timelineActiveFilters button').filter({hasText:'人物：'});await participantChip.click();assert.equal(await select.inputValue(),'all');assert.equal(await input.inputValue(),'候補なし');
 await page.locator('#clearFilters').click();assert.equal(await input.inputValue(),'');assert.deepEqual(await options(),allOptions);
 // A known person with no event records keeps a real ID and a shareable zero result.
 await page.goto(base+'?person=P04-U01&detail=1#characters');await ready(page);
 await page.getByRole('button',{name:'この人物の出来事を見る',exact:true}).click();await ready(page);await open();
 assert.equal(await select.inputValue(),'P04-U01');assert.equal((await eventIds()).length,0);assert.equal(new URL(page.url()).searchParams.get('t_person'),'P04-U01');
 await input.fill('くらぴか');assert.equal(await select.inputValue(),'P04-U01');assert.equal((await eventIds()).length,0);
 await page.reload();await ready(page);await open();assert.equal(await select.inputValue(),'P04-U01');assert.equal((await eventIds()).length,0);
 await page.goto(base+'?t_person=P04-U01#timeline');await ready(page);await open();assert.equal(await select.inputValue(),'P04-U01');assert.equal((await eventIds()).length,0);
 for(const id of ['UNKNOWN','constructor','__proto__']) {
  await page.goto(base+'?t_person='+encodeURIComponent(id)+'#timeline');await ready(page);await open();assert.equal(await select.inputValue(),'all');
  assert.equal(await page.evaluate(()=>filteredEventsData.length),await page.evaluate(()=>eventsData.length),'unrecognized IDs must not create a false participant');
 }
 // Existing links and the person-details route can select people outside a previously narrowed picker.
 await page.goto(base+'?t_person=P13#timeline');await ready(page);await open();assert.equal(await select.inputValue(),'P13');
 await input.fill('くらぴか');await page.locator('[data-primary-view="characters"]').click();await page.locator('#characterSearch').fill('モレナ');
 await page.locator('.directory-character-card[data-character-id="EII-001"] h3 a').click();await page.getByRole('button',{name:'この人物の出来事を見る',exact:true}).click();await ready(page);await open();
 assert.equal(await select.inputValue(),'EII-001');assert.equal(await input.inputValue(),'');assert.ok(await page.evaluate(()=>filteredEventsData.length>0&&filteredEventsData.every(e=>e.characters.includes('EII-001'))));
 assert.ok(await select.evaluate(el=>el.getBoundingClientRect().height>=40&&el.getBoundingClientRect().height<80),'keep a usable single-line native control');
 assert.ok(await page.locator('.participant-filter-control').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#spoilerRange').selectOption('basic');assert.ok(await input.isHidden());assert.equal(await page.locator('#timeline .schedule-event:visible').count(),0);
 const fresh=await fixture(browser,{width,local:false,prefix:'/hxh-succession'}),recipient=await fresh.context.newPage();await recipient.goto(share);await ready(recipient);
 assert.equal(await recipient.locator('#spoilerRange').inputValue(),'basic');assert.equal(await recipient.locator('#participantFilter').inputValue(),'P01');assert.ok(await recipient.locator('#participantCandidateSearch').isHidden());await fresh.context.close();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();
 console.log(`PASS ${width}: candidate-only IME/name/alias search, native selection, zero-match retention, clear/reset, URLs/history and existing person route`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
