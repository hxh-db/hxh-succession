const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');

// Preserve identity coverage and make queen affiliation a single, normal tag.
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage();await p.goto(base+'#characters');await ready(p);
 const expected=await p.evaluate(()=>charactersData.filter(isDirectoryCharacter).map(p=>p.id).sort());
 assert.deepEqual(await p.evaluate(()=>currentCharacterResults.map(p=>p.id).sort()),expected);
 await p.locator('#characterFilterToggle').click();
 const tag=p.locator('#characterFilterPanel [data-tag-id="affiliation-q03-guards"]');await tag.click();
 assert.deepEqual(await p.evaluate(()=>[...activeCharacterTags.values()]),['affiliation-q03-guards']);
 assert.ok(await p.evaluate(()=>currentCharacterResults.length>0&&currentCharacterResults.every(p=>!p.roster_view&&!p.roster_projection&&getCharacterFilterTags(p).some(t=>t.id==='affiliation-q03-guards'))));
 assert.ok(!(await p.locator('#characterActiveTag').innerText()).includes('時点'));const count=await p.evaluate(()=>currentCharacterResults.length);
 await p.reload();await ready(p);assert.equal(await p.evaluate(()=>currentCharacterResults.length),count);assert.equal(new URL(p.url()).searchParams.get('c_tags'),'affiliation-q03-guards');
 await p.locator('#resetCharacterTags').click();assert.deepEqual(await p.evaluate(()=>currentCharacterResults.map(p=>p.id).sort()),expected);
 if(!await p.locator('#characterFilterPanel').isVisible())await p.locator('#characterFilterToggle').click();await p.locator('#characterCampNav [data-group-id="personnel"]').click();
 assert.ok(await p.evaluate(()=>currentCharacterResults.length>0&&currentCharacterResults.every(p=>['soldier','attendant'].includes(p.type)||(p.type==='hunter'&&p.mission==='護衛'))),'reference membership alone does not classify an unreviewed role');
 await p.locator('#clearCharacterFilters').click();
 await p.locator('#characterSearch').fill('クラピカ ハンター');assert.ok(await p.locator('.directory-character-card[data-character-id="P14-H01"]').count());
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();console.log('PASS normal identity coverage, queen tag sharing/reset and ordinary search',width);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
