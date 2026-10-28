/* 2026-10-11 第5回レビューの回帰テスト：
 * 1. 最後の所在：場所を画像で確認できた記録（location_status: recorded）と、場所が推定の記録を区別する
 * 2. 「第○話」から根拠の出来事へ（一覧・モーダルはネタバレ表示中だけリンク、静的ページは ?event= のURL）
 * 3. same_incident_with（同じ出来事を別の視点で描いた場面）を出来事カード・出来事モーダルに出す
 * 4. nen_ability_editorial は能力の本文に混ぜず「編集状況」に出す
 * 5. 最初の画面：関係王子の行は既定で閉じる
 * Usage: node tests/location-certainty.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const facts = require('../character-facts.js');
const build = require('../scripts/build-character-pages.cjs');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const events = require('../data/events.json');
const people = require('../data/characters.json');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const body = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw Error(name);
}
const text = parts => facts.partsText(parts);

// ---- 1. 場所の確度ラベル（架空データで全パターン） ----
const X = {id: 'X', name: 'テスト'};
const ev = (id, chapter, status, extra = {}) => ({id, chapter, day: 1, characters: ['X'], location: `第1層 10${String(chapter).slice(-2)}号室`,
  character_presence: {X: 'present'}, verification_status: 'review_recorded', location_status: status, ...extra});
// 最後の場面の場所が推定 → 「最後に登場した場面」と「場所を確認できた最後の記録」を分けて出す
let parts = facts.latestLocationParts(X, [ev('E101-001', 101, 'recorded'), ev('E102-001', 102, 'unverified')]);
assert.equal(text(parts.main), '最後に登場した場面：第102話（場所は推定：第1層 1002号室）');
assert.equal(text(parts.confirmed), '場所を確認できた最後の記録：第101話 第1層 1001号室');
assert.equal(parts.main.find(p => p.eventId)?.eventId, 'E102-001');
assert.equal(parts.confirmed.find(p => p.eventId)?.eventId, 'E101-001');
assert.equal(facts.latestLocationLabel(X, [ev('E101-001', 101, 'recorded'), ev('E102-001', 102, 'unverified')]),
  '最後に登場した場面：第102話（場所は推定：第1層 1002号室）。場所を確認できた最後の記録：第101話 第1層 1001号室');
// 最後の場面の場所を画像で確認できた → 1行（話数時点＋画像で確認）
parts = facts.latestLocationParts(X, [ev('E101-001', 101, 'unverified'), ev('E102-001', 102, 'recorded')]);
assert.equal(text(parts.main), '第1層 1002号室（第102話時点・場所は画像で確認）');
assert.equal(parts.confirmed, null);
assert.equal(parts.main.find(p => p.eventId).text, '第102話時点');
// 確認できた記録がない
parts = facts.latestLocationParts(X, [ev('E102-001', 102, 'unverified', {verification_status: 'unverified'})]);
assert.equal(text(parts.main), '最後に登場した場面：第102話（場所は推定：第1層 1002号室／再照合待ち）');
assert.equal(text(parts.confirmed), '場所を画像で確認できた記録はまだありません');
// 遺体
parts = facts.latestLocationParts(X, [ev('E102-001', 102, 'unverified', {character_presence: {X: 'body'}})]);
assert.ok(text(parts.main).startsWith('遺体が最後に描かれた場面：第102話'));
parts = facts.latestLocationParts(X, [ev('E102-001', 102, 'recorded', {character_presence: {X: 'body'}})]);
assert.ok(text(parts.main).startsWith('遺体の所在：第1層 1002号室（第102話時点'));
// 在室が未判定の候補は「場所は推定」を添える
parts = facts.latestLocationParts(X, [ev('E102-001', 102, 'unverified', {character_presence: {X: 'unknown'}})]);
assert.equal(text(parts.main), '所在候補（在室は未確認）：第1層 1002号室（第102話時点・場所は推定）');
// 出来事がない人物は登録値（リンクなし）
parts = facts.latestLocationParts({id: 'Y', room: '1001'}, []);
assert.ok(parts.main.every(p => !p.eventId));

// ---- 実データ：ベンジャミン（P01）。最後の場面の location_status に応じて表示が変わる ----
const benjamin = people.find(p => p.id === 'P01');
const bLatest = facts.latestLocation(benjamin, events);
const bParts = facts.latestLocationParts(benjamin, events);
const bEvent = events.find(e => e.id === bLatest.eventId);
if (bEvent.location_status === 'recorded') assert.ok(text(bParts.main).includes(`（第${bEvent.chapter}話時点`));
else {
  assert.ok(text(bParts.main).startsWith(`最後に登場した場面：第${bEvent.chapter}話（場所は推定：`), text(bParts.main));
  assert.ok(bParts.confirmed, '場所が推定のときは確認できた記録の行も出す');
}
// 静的ページ：同じ文言で、「第○話」は根拠の出来事のURL（一覧側でネタバレ設定を守って開く）
const bHtml = fs.readFileSync(path.join(root, 'characters/P01/index.html'), 'utf8');
const plain = value => value.replace(/<[^>]+>/g, '');
const bDd = bHtml.match(/<dt>最後の所在<\/dt><dd>([\s\S]*?)<\/dd>/)[1];
assert.ok(plain(bDd).includes(text(bParts.main)));
if (bParts.confirmed) assert.ok(plain(bDd).includes(text(bParts.confirmed)));
assert.ok(bDd.includes(`href="../../?event=${bLatest.eventId}#timeline"`));
// 静的ページのリンクは後の展開を含む折りたたみ（data-nosnippet）の中だけにある
const spoilerStart = bHtml.indexOf('<details class="character-page-spoilers" data-nosnippet>');
assert.ok(spoilerStart >= 0 && bHtml.indexOf('latest-place-event-link') > spoilerStart);
// 一覧からの ?event= はネタバレ非表示なら詳細を開かない（既存の経路）
assert.ok(source.includes('if (spoilersRevealed) showDetailModal(event.id, "event", event);'));

// ---- 2. 一覧・モーダル：「第○話」のリンクはネタバレ表示中だけ ----
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.hidden = false; this.listeners = {}; this.textContent = ''; this.className = ''; }
  appendChild(child) { this.children.push(child); return child; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const opened = [];
const ctx = vm.createContext({
  eventsData: [...events, {id: 'E999-001', chapter: 999, description: '後の話', same_incident_with: ['E998-001']},
    {id: 'E998-001', chapter: 998, description: '前の話', same_incident_with: ['E999-001']}],
  spoilersRevealed: false, URL, location: {href: 'http://127.0.0.1:8765/?t_chapter=400#characters'}, CharacterFacts: facts,
  siteRootUrl: new URL('http://127.0.0.1:8765/'),
  document: {createElement: tag => new Node(tag), createTextNode: value => ({text: value}), createDocumentFragment: () => new Node('#fragment')},
  showDetailModal: (id, category) => opened.push([id, category]),
  openPersonEvent: () => false
});
vm.runInContext('function getPersonnelEvents() { return eventsData; }', ctx);
vm.runInContext(['sortKey', 'makeLocationPartNodes', 'fillLatestLocationContent', 'makeLatestLocationContent',
  'getSimultaneousScenes', 'fillSimultaneousScenes', 'makeSimultaneousScenesBlock'].map(extract).join('\n'), ctx);
const links = node => node.children.flatMap(child => child.tagName === 'a' ? [child] : child.children ? links(child) : []);
let content = ctx.makeLatestLocationContent(benjamin, '最後の所在');
assert.equal(links(content).length, 0, 'ネタバレ非表示では根拠の出来事へのリンクを出さない');
ctx.spoilersRevealed = true;
content = ctx.makeLatestLocationContent(benjamin, '最後の所在');
assert.ok(links(content).length >= 1);
const first = links(content)[0];
assert.match(first.href, new RegExp(`[?&]event=${bLatest.eventId}`));
assert.doesNotMatch(first.href, /t_chapter/);
first.listeners.click({preventDefault() {}, stopPropagation() {}});
assert.deepEqual(opened.pop(), [bLatest.eventId, 'event']);
const routed=[];
ctx.openPersonEvent=(event,focusKind)=>{routed.push([event.id,focusKind]);return true;};
first.listeners.click({preventDefault() {},stopPropagation() {}});
assert.deepEqual(routed.pop(),[bLatest.eventId,'location']);
assert.equal(opened.length,0,'the person return route must not open a second detail');
first.listeners.click({ctrlKey:true,preventDefault(){throw new Error('modified links must keep native navigation');},stopPropagation(){}});
assert.equal(routed.length,0);
ctx.openPersonEvent=()=>false;
// History API後の人物URLにいても、新しいタブ・リンクコピー先は一覧の出来事へ。
for (const rootUrl of ['http://127.0.0.1:8765/', 'https://hxh-db.github.io/hxh-succession/']) {
  ctx.siteRootUrl = new URL(rootUrl);
  ctx.location.href = `${rootUrl}characters/P01/?c_search=test&t_chapter=400#characters`;
  const href = links(ctx.makeLatestLocationContent(benjamin, '最後の所在'))[0].href;
  assert.equal(href, `${rootUrl}?event=${bLatest.eventId}#timeline`);
}
ctx.siteRootUrl = new URL('http://127.0.0.1:8765/');
ctx.location.href = 'http://127.0.0.1:8765/?t_chapter=400#characters';
// 一覧カード・モーダルとも同じ部品から作る。ネタバレ切替で作り直す
assert.ok(source.includes('makeLatestLocationContent(character, "最後の所在")'));
assert.ok(extract('showDetailModal').includes('makeLatestLocationContent(record)'));
assert.match(source, /addEventListener\("spoiler-visibility-change", \(\) => \{\s*document\.querySelectorAll\("\.latest-place-content\[data-person-id\]"\)/);
assert.ok(!extract('fillLatestLocationContent').includes('setSpoilersRevealed('));

// ---- 3. same_incident_with ----
ctx.spoilersRevealed = false;
const later = ctx.eventsData.find(e => e.id === 'E999-001'), earlier = ctx.eventsData.find(e => e.id === 'E998-001');
let block = ctx.makeSimultaneousScenesBlock(earlier, 'same_incident_with');
assert.equal(links(block).length, 0, '非表示時に後の話の別視点へのリンクを出さない');
assert.equal(block.hidden, true);
block = ctx.makeSimultaneousScenesBlock(later, 'same_incident_with');
assert.equal(links(block).length, 1);
assert.equal(block.children[0].textContent, '同じ出来事を別の視点で描いた場面：');
assert.equal(block.dataset.field, 'same_incident_with');
assert.ok(block.className.includes('simultaneous-scenes'), 'ネタバレ切替の作り直し対象に入る');
ctx.spoilersRevealed = true;
block = ctx.makeSimultaneousScenesBlock(earlier, 'same_incident_with');
assert.equal(links(block).length, 1);
assert.match(links(block)[0].textContent, /^第999話 /);
ctx.location.href = 'http://127.0.0.1:8765/characters/P01/?c_search=test#characters';
assert.equal(links(ctx.makeSimultaneousScenesBlock(earlier, 'same_incident_with'))[0].href,
  'http://127.0.0.1:8765/?event=E999-001#timeline');
// 同時刻の別の場面とは見出しを分ける
assert.equal(ctx.makeSimultaneousScenesBlock({id: 'T', chapter: 1, simultaneous_with: ['E998-001']}).children[0].textContent, '同時刻の別の場面：');
assert.ok(extract('createTimelineCard').includes('makeSimultaneousScenesBlock(event, "same_incident_with")'));
assert.ok(extract('showDetailModal').includes('makeSimultaneousScenesBlock(record, "same_incident_with")'));
// 実データに same_incident_with があれば相互参照・参照先の存在を確認
const byId = new Map(events.map(e => [e.id, e]));
for (const event of events.filter(e => (e.same_incident_with || []).length)) {
  for (const id of event.same_incident_with) {
    assert.ok(byId.has(id), `${event.id} -> ${id} の参照先がない`);
    assert.ok((byId.get(id).same_incident_with || []).includes(event.id), `${event.id} -> ${id} が相互参照になっていない`);
  }
}

// ---- 4. nen_ability_editorial ----
assert.deepEqual(facts.nenAbilityEditorialLines({}), []);
assert.deepEqual(facts.nenAbilityEditorialLines({nen_ability_editorial: '能力名は未確認'}), ['能力欄の編集注記：能力名は未確認']);
assert.deepEqual(facts.nenAbilityEditorialLines({nen_ability_editorial: ['a', '', 'b']}), ['能力欄の編集注記：a', '能力欄の編集注記：b']);
const testPerson = {...benjamin, nen_ability: '本文の能力説明', nen_ability_editorial: '編集用の注記テキスト'};
const pageHtml = build.pageHtml(testPerson, events, people, require('../data/sources.json'));
const abilityDd = pageHtml.match(/<dt>念能力<\/dt><dd>([\s\S]*?)<\/dd>/)[1];
assert.ok(abilityDd.includes('本文の能力説明') && !abilityDd.includes('編集用の注記テキスト'));
const editorial = pageHtml.match(/<details class="editorial-status">([\s\S]*?)<\/details>/)[1];
assert.ok(editorial.includes('能力欄の編集注記：編集用の注記テキスト'));
assert.ok(extract('showDetailModal').includes('...getNenAbilityEditorialLines(record)'));
assert.ok(!extract('showDetailModal').includes('nen_ability_editorial'), 'モーダル本文の能力欄に注記を混ぜない');
assert.ok(source.includes('abilityText.appendChild(makeEditorialStatusDetails(abilityEditorial))'));
// 実データの注記が静的ページの編集状況に出る
for (const person of people.filter(p => p.nen_ability_editorial)) {
  const html = fs.readFileSync(path.join(root, `characters/${person.id}/index.html`), 'utf8');
  for (const line of facts.nenAbilityEditorialLines(person)) assert.ok(html.includes(line.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))), person.id);
}

// ---- 5. 関係王子は常設し、タグ一覧の開閉とは分ける ----
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /<div id="characterPrinceDetails" class="character-prince-details">/);
assert.ok(index.includes('id="characterFilterToggle"'), 'タグ一覧の開閉を維持');
assert.ok(index.includes('id="characterPrinceNav"'), '関係王子の条件を維持');

console.log('PASS: location certainty labels, evidence links (spoiler-safe), same-incident scenes, ability editorial notes, grouped prince filters');
