const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');

// Retired period/queen controls must not survive in URLs or saved history as
// invisible restrictions. A known queen is migrated to a visible affiliation tag.
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?c_group=personnel&c_when=chapter-374&c_queen=3#characters');await ready(p);
 assert.equal(await p.locator('#characterPeriodFilter,#characterQueenFilter,#personnelQueenNav').count(),0);
 assert.deepEqual(await p.evaluate(()=>[...activeCharacterTags.values()]),['affiliation-q03-guards']);
 assert.match(await p.locator('#characterActiveTag').innerText(),/第3王妃/);
 for(const key of ['c_when','c_queen'])assert.equal(new URL(p.url()).searchParams.has(key),false);
 await p.locator('#clearCharacterFilters').click();const total=await p.evaluate(()=>currentCharacterResults.length);
 await p.evaluate(()=>{const s=captureReadingState();s.controls.c_when='chapter-365';s.controls.c_queen='all';restoreReadingState(s,new URL(location.href));});await ready(p);
 assert.equal(await p.evaluate(()=>currentCharacterResults.length),total);assert.ok(await p.locator('#characterLegacyFilterNotice').isVisible());
 await p.goto(base+'?c_when=chapter-374&person=P01-P06&detail=1#characters');await ready(p);await p.locator('#detailModal:not(.hidden)').waitFor();
 assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');assert.equal(await p.locator('#modalContent .person-later-info').evaluate(el=>el.open),false);
 await p.locator('#modalClose').click();await p.waitForFunction(()=>!CharacterRoutes.isActive());await p.locator('#spoilerRange').selectOption('all');
 const personLink=p.locator('.directory-character-card[data-character-id="P01-P06"] h3 a');
 const link=await personLink.getAttribute('href');assert.equal(new URL(link).searchParams.has('c_when'),false);
 assert.ok(new URL(link).pathname.endsWith('/characters/P01-P06/'));
 await personLink.click();assert.match(await p.locator('#modalContent').innerText(),/鋼の錬金術師|365日/);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS legacy URL/snapshot migration, visible queen tag, direct-link basic protection and current person link',width);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
