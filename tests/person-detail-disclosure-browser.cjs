const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const [id,secret] of [['P02-P07',/呪殺|担当外れ/],['P12-Q05',/暗殺者/],['P01-P02',/スパイ潜入/],['P11-G01',/引き継いだ|1008号室|1009号室|暗殺/]]){
  await p.goto(base+`?person=${id}&detail=1#characters`);await ready(p);assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');
  assert.doesNotMatch(await p.locator('#modalContent').innerText(),secret);
  const later=p.locator('#modalContent .person-later-info');await later.locator(':scope > summary').click();
  assert.match(await p.locator('#modalContent').innerText(),secret);assert.equal(await p.locator('#spoilerRange').inputValue(),'basic','explicit local disclosure does not change the shared preference');
  await later.locator(':scope > summary').click();assert.doesNotMatch(await p.locator('#modalContent').innerText(),secret);
  await p.locator('#spoilerRange').selectOption('all');assert.match(await p.locator('#modalContent').innerText(),secret);
  await p.locator('#spoilerRange').selectOption('basic');await p.waitForFunction(()=>!CharacterRoutes.isActive());
  await p.goto(base+`characters/${id}/`);await p.locator('#spoilerRange').waitFor();assert.doesNotMatch(await p.locator('main').innerText(),secret);
  await p.locator('#spoilerRange').selectOption('all');assert.match(await p.locator('main').innerText(),secret);
  await p.locator('#spoilerRange').selectOption('basic');
 }
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: normal/detail links, covert roles and missions, local/global disclosure, static page boundaries`);
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
