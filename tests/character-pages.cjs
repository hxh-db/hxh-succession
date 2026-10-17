const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {expectedOutputs,publicFields,spoilerFields,SITE} = require('../scripts/build-character-pages.cjs');
const root = path.resolve(__dirname,'..');
const characters = JSON.parse(fs.readFileSync(path.join(root,'data/characters.json'),'utf8'));
const outputs = expectedOutputs();
const decode = s => s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
for (const [file,html] of outputs) {
  assert.equal(fs.readFileSync(path.join(root,file),'utf8'),html,`stale: ${file}`);
  if (!file.endsWith('.html')) continue;
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(html.includes('<title>') && html.includes('name="description"'));
  for (const [,encoded] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(decode(encoded),new URL(file,SITE));
    if (url.origin !== new URL(SITE).origin) continue;
    assert.ok(url.pathname.startsWith('/hxh-succession/'),`prefix escaped: ${url}`);
    let relative = decodeURIComponent(url.pathname.slice('/hxh-succession/'.length));
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    assert.ok(fs.existsSync(path.join(root,relative)),`broken link ${file}: ${url}`);
    assert.ok(!url.pathname.includes('/.local/') && !url.pathname.includes('/intake/'));
  }
}
const sitemap = outputs.get('sitemap.xml');
assert.equal((sitemap.match(/<loc>/g)||[]).length, characters.length+2);
for (const person of characters) {
  const html = outputs.get(`characters/${person.id}/index.html`);
  assert.ok(html.includes(`characters/${person.id}/">`),`canonical ID: ${person.id}`);
  assert.ok(html.includes('<details class="character-page-spoilers" data-nosnippet>'));
  const beforeSpoilers = html.split('<details class="character-page-spoilers"')[0];
  for (const field of ['status','nen_ability','spoiler_notes']) {
    if (person[field] && String(person[field]).length > 10) assert.ok(!beforeSpoilers.includes(person[field]),`spoiler leak: ${person.id}/${field}`);
  }
  assert.ok(html.includes('人物一覧で見る') && html.includes('関連する出来事'));
  assert.ok(!html.includes('originalRecords') && !html.includes('drafts.json') && !html.includes('/api/drafts'));
  if (person.notes && person.notes.length > 30) assert.ok(!html.includes(person.notes),`research notes copied: ${person.id}`);
}
// Pure navigation state machine (no browser automation).
let currentUrl = 'http://127.0.0.1:8765/hxh-succession/?c_search=ワブル&c_group=princes#characters';
const entries = [{state:null,url:currentUrl}]; let position=0, popstate, opens=[], closes=0, focus=0, scroll=620;
const history = {get state(){return entries[position].state;},
  replaceState(state,_,url){entries[position]={state,url};currentUrl=url;},
  pushState(state,_,url){entries.splice(position+1);entries.push({state,url});position++;currentUrl=url;},
  back(){position--;currentUrl=entries[position].url;popstate();},
  forward(){position++;currentUrl=entries[position].url;popstate();}};
const document = {title:'人物一覧',activeElement:{focus:()=>focus++},contains:()=>true};
const window = {addEventListener:(event,fn)=>{if(event==='popstate')popstate=fn;},get scrollY(){return scroll;},scrollTo:({top})=>scroll=top};
const context=vm.createContext({window,document,history,URL,requestAnimationFrame:fn=>fn(),location:{get href(){return currentUrl;}}});
vm.runInContext(fs.readFileSync(path.join(root,'character-routing.js'),'utf8'),context);
const routes=window.CharacterRoutes;
routes.setup({rootUrl:'http://127.0.0.1:8765/hxh-succession/',getPerson:id=>characters.find(p=>p.id===id),open:id=>{opens.push(id);routes.open(id);},close:()=>closes++});
routes.open('P14'); assert.equal(currentUrl,'http://127.0.0.1:8765/hxh-succession/characters/P14/'); assert.equal(entries.length,2);
history.back(); assert.equal(closes,1); assert.equal(scroll,620); assert.ok(currentUrl.includes('c_group=princes')); assert.equal(focus,1);
history.forward(); assert.deepEqual(opens,['P14']); assert.equal(entries.length,2);
assert.ok(routes.requestClose()); assert.equal(closes,2);
history.forward(); routes.open('P12-H01'); assert.equal(entries.length,2); assert.ok(currentUrl.endsWith('/P12-H01/'));
routes.requestClose(); assert.ok(currentUrl.includes('c_search=')); assert.equal(scroll,620);
history.forward(); routes.prepareReload();
assert.ok(currentUrl.includes('c_search=') && !currentUrl.includes('/characters/P12-H01/'));
assert.equal(routes.isActive(),false);
// Saving a local edit must reload the list app so its pending detail can reopen.
const appSource = fs.readFileSync(path.join(root,'script.js'),'utf8');
const reopenSource = appSource.slice(appSource.indexOf('function reopenDetailAfterReload('),appSource.indexOf('async function loadJson('));
let pendingDetail, reloadedUrl;
context.sessionStorage = {setItem:(_,value)=>pendingDetail=JSON.parse(value)};
context.REOPEN_DETAIL_KEY = 'test-reopen-detail';
context.console = console;
window.location = {reload:()=>reloadedUrl=currentUrl};
routes.open('P14');
vm.runInContext(reopenSource,context);
context.reopenDetailAfterReload({id:'P14'},'prince','modal');
assert.equal(pendingDetail.id,'P14'); assert.equal(pendingDetail.view,'modal');
assert.ok(reloadedUrl.includes('c_search=') && !reloadedUrl.endsWith('/characters/P14/'));
// A person opened from an event returns to that event, not to an empty overlay.
const background = {eventId:'E361-008',scrollTop:120};
const restored = [];
routes.prepareReload();
routes.setup({rootUrl:'http://127.0.0.1:8765/hxh-succession/',getPerson:id=>characters.find(p=>p.id===id),
  open:id=>{opens.push(id);routes.open(id);},close:()=>closes++,captureBackground:()=>background,
  restoreBackground:(value,id)=>restored.push([value.eventId,id])});
routes.open('P14-H01');
assert.equal(routes.background().eventId,'E361-008');
assert.ok(routes.requestClose());
assert.deepEqual(restored,[['E361-008','P14-H01']]);
history.forward();
assert.ok(currentUrl.endsWith('/characters/P14-H01/'));
routes.requestClose();
assert.equal(restored.length,2);
console.log(`PASS: ${characters.length} static character pages, metadata, sitemap, JSON parity, internal links, spoiler/private exclusions, history state and subpath routing`);
