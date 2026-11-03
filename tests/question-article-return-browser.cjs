const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(b,{width,local:false,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const source=base+'?t_view=questions&t_period=all&t_question='+encodeURIComponent('念・能力')+'#timeline';
 const link=()=>p.locator('#questionDirectory .question-card[data-question-id="Q014"] > a');
 const visit=async()=>{await p.goto(source);await ready(p);if(await p.locator('#spoilerRange').inputValue()!=='all')await p.locator('#spoilerRange').selectOption('all');await link().focus();await link().scrollIntoViewIfNeeded();return {url:p.url(),top:await p.evaluate(()=>scrollY)};};
 const article=async()=>{await p.waitForURL('**/theories/Q014/');await p.locator('.essay-title').waitFor();assert.equal(new URL(p.url()).search,'','native article URLs contain no new return parameters');};
 const returned=async before=>{await p.waitForURL(before.url);await ready(p);assert.equal(await p.locator('#questionCategory').inputValue(),'念・能力');assert.equal(await p.locator('#questionDirectory [data-question-id]').count(),5);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-before.top)<2);assert.ok(await link().evaluate(el=>el===document.activeElement),'return to the original article anchor');};
 for(const mode of ['Enter','click']){
  const before=await visit();assert.ok(before.top>300,'exercise a link near the bottom of the list');
  assert.equal(await link().getAttribute('href'),'theories/Q014/');
  if(mode==='Enter')await link().press('Enter');else await link().click();await article();
  await p.goBack();await returned(before);await p.goForward();await article();await p.goBack();await returned(before);
  await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>document.activeElement.getAttribute('href')),'#main-content');assert.ok(await p.evaluate(()=>scrollY)>300,'the next Tab must not jump to the page start');
 }
 const before=await visit(),popupPromise=context.waitForEvent('page');await link().click({modifiers:['Control']});const popup=await popupPromise;await popup.bringToFront();await popup.locator('.essay-title').waitFor();assert.equal(new URL(popup.url()).pathname,new URL('theories/Q014/',base).pathname);assert.equal(new URL(popup.url()).search,'');assert.equal(p.url(),before.url);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-before.top)<2);await popup.close();await p.bringToFront();
 // A disclosure change in the article must not reopen hidden source contents.
 await link().focus();await link().press('Enter');await article();await p.locator('#spoilerRange').selectOption('basic');await p.goBack();await ready(p);assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');assert.ok(await p.locator('#questionDirectory').isHidden());assert.equal(await p.locator('#questionDirectory a:visible').count(),0);assert.ok(await p.locator('#timelineSpoilerGate [data-reveal-global]').evaluate(el=>el===document.activeElement));
 assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log(`PASS ${width}: native Enter/click/article URLs, Back/Forward category/position/anchor focus, next-Tab continuity, Ctrl tab and basic-safe return`);
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
