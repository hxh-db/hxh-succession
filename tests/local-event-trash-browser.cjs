const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture,ready}=require('./helpers/browser-fixture.cjs');
const D=require('../draft-state.js'),KEY='hxh-succession-local-drafts-v1',ID='LOCAL-trash-browser';
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const local of [true,false])for(const width of [1280,390]){
  const item=D.editItem({}, {createdRecord:{id:ID,description:'ゴミ箱の検査用出来事',chapter:361,chapter_order:1,day:null,characters:[]},memo:'残すメモ',edits:{location:'残す編集'}});
  const drafts={format:'hxh-succession-local-drafts',version:2,items:{[`event:${ID}`]:item,'guide:keep':{memo:'無関係のメモ'}},entries:[]};
  const {context,base,state}=await fixture(browser,{local,width,prefix:local?'':'/hxh-succession',drafts});
  await context.addInitScript(({KEY,drafts})=>{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(drafts));localStorage.setItem('hxh-succession-spoilers-revealed-v1','true');},{KEY,drafts});
  const page=await context.newPage(),stale=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));stale.on('pageerror',e=>errors.push(e.message));
  const url=base+`?event=${ID}#timeline`;
  await page.goto(url);await ready(page);await stale.goto(url);await ready(stale);
  const staleSnapshot=await stale.evaluate(()=>buildDraftExport());
  const remove=page.locator('#modalContent [data-event-trash="trash"]');
  assert.equal(await remove.count(),1);
  if(local){state.failPut=true;await remove.click();await page.locator('.event-trash-status').filter({hasText:'保存できません'}).waitFor();state.failPut=false;}
  await Promise.all([page.waitForEvent('load'),remove.click()]);await ready(page);
  assert.equal(await page.evaluate(ID=>eventsData.some(e=>e.id===ID),ID),false);
  assert.match(await page.locator('#recordLinkStatus').innerText(),/ゴミ箱にあります/);
  await ready(stale);
  // Storage synchronization may already have closed the deleted detail. Model
  // a save captured before deletion, arriving later through the real writer.
  await stale.evaluate(async({source,KEY,ID})=>{
    source.items[`event:${ID}`]=DraftState.editItem(source.items[`event:${ID}`],{memo:'古いタブからの追記'});
    await DraftState.persist({source,key:KEY,storage:localStorage,fetcher:fetch,api:draftStorageMode==='file'?LOCAL_DRAFTS_API:null});
  },{source:staleSnapshot,KEY,ID});
  await page.reload();await ready(page);
  assert.equal(await page.evaluate(ID=>eventsData.some(e=>e.id===ID),ID),false,'stale memo save cannot resurrect a trashed event');
  const backup=await page.evaluate(()=>buildDraftExport());
  assert.ok(D.isTrashed(backup.items[`event:${ID}`]));assert.equal(backup.items['guide:keep'].memo,'無関係のメモ');
  assert.equal(backup.items[`event:${ID}`].memo,'古いタブからの追記');
  assert.equal(await page.evaluate(b=>DraftState.isTrashed(validateDraftImport(b)['event:LOCAL-trash-browser']),backup),true,'restore importer preserves trash metadata');
  await page.locator('#localDraftsLink').click();await page.locator('#localEventTrash > summary').click();
  fs.mkdirSync('.local/event-trash-20261027',{recursive:true});
  await page.locator('#localEventTrash').screenshot({path:`.local/event-trash-20261027/trash-${local?'file':'browser'}-${width}.png`});
  if(!local && width===390){
    const recipient=await fixture(browser,{local:false,width,prefix:'/hxh-succession'}),other=await recipient.context.newPage();
    await other.goto(recipient.base);await ready(other);
    await Promise.all([other.waitForEvent('load'),other.locator('#importLocalDrafts').setInputFiles({name:'trash-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))})]);await ready(other);
    assert.ok(await other.evaluate(ID=>DraftState.isTrashed(localDrafts.items[`event:${ID}`]),ID));
    assert.equal(await other.evaluate(ID=>eventsData.some(e=>e.id===ID),ID),false);
    await other.locator('#localDraftsLink').click();await other.locator('#localEventTrash > summary').click();
    await Promise.all([other.waitForEvent('load'),other.locator('#localEventTrashList [data-event-trash="restore"]').click()]);await ready(other);
    assert.equal(await other.evaluate(ID=>eventsData.filter(e=>e.id===ID).length,ID),1);await recipient.context.close();
  }
  await Promise.all([page.waitForEvent('load'),page.locator('#recordLinkStatus [data-event-trash="restore"]').click()]);await ready(page);
  assert.equal(await page.evaluate(ID=>eventsData.filter(e=>e.id===ID).length,ID),1);
  assert.equal(await page.locator('#modalContent .local-editor textarea').first().inputValue(),'古いタブからの追記');
  assert.equal(await page.evaluate(ID=>eventsData.find(e=>e.id===ID).location,ID),'残す編集');
  await page.locator('#modalClose').click();await page.locator('#localDraftsLink').click();
  await page.locator('#localEventTrash > summary').click();
  assert.match(await page.locator('#localEventTrashList').innerText(),/ゴミ箱は空/);
  assert.equal(await page.evaluate(()=>eventsData.filter(e=>!e.local_created).length),465);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await context.close();
  console.log(`PASS ${local?'file':'browser'} ${width}: trash/reload/restore, stale tab, JSON import, retry, other memo and public-event preservation`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
