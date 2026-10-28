const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');

// The data histories remain intact, but old roster URLs do not promise a
// chapter-specific disclosure level in the ordinary search interface.
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage();
 for(const chapter of [413,415]){
  await p.goto(base+`?c_when=chapter-${chapter}&c_search=${encodeURIComponent('ヒュリコフ 鋼の錬金術師')}#characters`);await ready(p);
  assert.equal(await p.locator('#characterPeriodFilter').count(),0);assert.equal(new URL(p.url()).searchParams.has('c_when'),false);
  assert.ok(await p.locator('#characterLegacyFilterNotice').isVisible());
  const all=await p.locator('#spoilerRange').inputValue()==='all';assert.equal(await p.locator('.directory-character-card').count(),all?1:0);
  await p.locator('#spoilerRange').selectOption('all');assert.equal(await p.locator('.directory-character-card').count(),1);
  await p.locator('.directory-character-card h3 a').click();assert.match(await p.locator('#modalContent').innerText(),/鋼の錬金術師/);
  assert.equal(await p.evaluate(()=>charactersData.find(p=>p.id==='P01-P06').nen_history.length),2);
  await p.locator('#modalClose').click();await p.waitForFunction(()=>!CharacterRoutes.isActive());await p.locator('#spoilerRange').selectOption('basic');
  assert.equal(await p.locator('.directory-character-card').count(),0);
 }
 await context.close();console.log('PASS old ability-history bookmarks migrate to explicit basic/all scope; source history preserved',width);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
