const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/browser-fixture.cjs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [1280,390]){
 const {context,base}=await fixture(b,{local:false,width,prefix:'/hxh-succession'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'theories/?q=TSK17');await p.locator('#spoilerRange').waitFor();
 assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');assert.equal(await p.locator('.spoiler-directory').evaluate(e=>e.open),false);
 assert.ok(await p.locator('#essay-search').isHidden());assert.ok(await p.locator('#essay-count').isHidden());assert.doesNotMatch(await p.locator('main').innerText(),/TSK|ビヨンド|血縁|余命/);
 await p.locator('.spoiler-directory > summary').click();assert.ok(await p.locator('#essay-search').isVisible());assert.equal(await p.locator('#essay-search').inputValue(),'TSK17');
 assert.ok(await p.locator('.essay-card:visible a[href*="Q009"]').count());assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');
 for(const fragment of ['','evidence','theory','key-points','%']){
  await p.goto(base+'theories/Q009/'+(fragment?'#'+fragment:''));await p.locator('#spoilerRange').waitFor();
  const title=await p.locator('.essay-title').textContent();assert.equal(await p.locator('.spoiler-article').evaluate(e=>e.open),false,fragment);
  assert.doesNotMatch(await p.locator('main').innerText(),/TSK|感染|余命/);assert.ok(!(await p.title()).includes(title));
 }
 await p.goto(base+'theories/Q009/#evidence');await p.locator('#spoilerRange').waitFor();
 await p.locator('.spoiler-article > summary').click();await p.waitForFunction(()=>document.querySelector('[data-section="evidence"]').open);
 assert.match(await p.locator('main').innerText(),/TSK-17/);await p.waitForFunction(()=>document.title.includes('TSK-17'));
 assert.equal(await p.locator('#spoilerRange').inputValue(),'basic');
 await p.locator('a[href="#theory"]').click();assert.equal(new URL(p.url()).hash,'#theory');
 assert.ok(await p.locator('[data-section="theory"]').isVisible());await p.locator('.spoiler-article > summary').click();await p.waitForFunction(()=>!document.title.includes('TSK-17'));
 await p.locator('#spoilerRange').selectOption('all');assert.ok(await p.locator('.spoiler-article').evaluate(e=>e.open));
 const other=await context.newPage();await other.goto(base+'theories/');await other.locator('#spoilerRange').waitFor();assert.ok(await other.locator('.spoiler-directory').evaluate(e=>e.open));
 await other.locator('#spoilerRange').selectOption('basic');await p.waitForFunction(()=>!document.querySelector('.spoiler-article').open);assert.ok(!(await p.title()).includes('TSK-17'));
 await p.goto(base+'theories/?q=TSK17');await p.locator('#spoilerRange').waitFor();await p.reload();await p.locator('#spoilerRange').waitFor();assert.ok(await p.locator('#essay-search').isHidden());
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}: hidden titles/search/counts, neutral tab title, safe fragments, explicit local read and shared preference sync`);
}
 const {context,base}=await fixture(b,{local:false,javaScriptEnabled:false}),p=await context.newPage();await p.goto(base+'theories/');assert.ok(await p.locator('.essay-card').first().isHidden());await p.locator('.spoiler-directory > summary').click();assert.ok(await p.locator('.essay-card').first().isVisible());
 await p.goto(base+'theories/Q009/#evidence');assert.ok(await p.locator('.essay-title').isHidden());await p.locator('.spoiler-article > summary').click();assert.ok(await p.locator('.essay-title').isVisible());await context.close();console.log('PASS no-JavaScript: native disclosure and direct fragment preserve title boundaries');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
