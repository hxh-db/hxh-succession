const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');

// The dated roster is now reference material, rather than a search mode.
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage();await p.goto(base+'#characters');await ready(p);
 assert.equal(await p.locator('#characterPeriodFilter,#characterQueenFilter,#personnelQueenNav,#personnelFilters').count(),0);
 assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');
 assert.equal(await p.evaluate(()=>{const ids=new Set(currentCharacterResults.map(p=>p.id));return personnelRosterData.members.filter(m=>ids.has(m.character_id)).length;}),230);
 await p.locator('[data-primary-view="guide"]').click();await p.locator('#spoilerRange').selectOption('all');
 assert.match(await p.locator('#initialPersonnelContent').innerText(),/230/);
 assert.ok((await p.locator('#personnelSnapshotContent').innerText()).length>50);
 assert.ok(await p.locator('#guide img[src*="queen-guard-assignment"]').count());
 await p.locator('#spoilerRange').selectOption('basic');assert.equal(await p.locator('#initialPersonnelContent').innerText(),'');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log('PASS guide placement/230-slot references and simplified directory',width);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
