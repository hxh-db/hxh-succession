const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390,320]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'#guide');await ready(p);const search=p.locator('#guideSearch'),rect=await search.boundingBox(),intro=await p.locator('.guide-reading-intro').boundingBox();
 assert.ok(rect.y>=0&&rect.y+rect.height<900,'guide search is available in the first viewport');assert.ok(rect.y<intro.y);
 assert.ok(await p.locator('#guideContents [data-guide-target="guideFactsTitle"]').isVisible());assert.ok(await p.locator('#guideContents [data-guide-target="lawGuideTitle"]').isHidden());
 await search.fill('戒厳令');assert.match(await p.locator('#guideSearchStatus').innerText(),/中0項目/);assert.ok(await p.locator('#guideNoResults').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.id),'guideSearch');
 await p.locator('#spoilerRange').selectOption('all');assert.ok(await p.locator('#guideContents [data-guide-target="lawGuideTitle"]').isVisible());
 await p.locator('#guideContents [data-guide-target="lawGuideTitle"]').click();assert.equal(await p.evaluate(()=>document.activeElement.id),'lawGuideTitle');
 const heading=await p.locator('#lawGuideTitle').boundingBox();assert.ok(heading.y>=0&&heading.y<100);
 await p.locator('#guideSearchClear').click();assert.equal(await search.inputValue(),'');assert.equal(await p.evaluate(()=>document.activeElement.id),'guideSearch');
 assert.ok(await p.locator('.guide-reading-intro').innerText().then(t=>t.includes('情報の確かさ')));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 await context.close();console.log(`PASS ${width}: guide search before introduction, first viewport, safe counts/contents, clear and focused topic navigation`);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
