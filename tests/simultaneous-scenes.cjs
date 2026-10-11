/* 同時刻の別の場面（simultaneous_with）の回帰テスト：データの相互参照・日付・時刻と、
 * 画面のリンク（出来事カード・出来事モーダル）がネタバレ設定を守ること。
 * Usage: node tests/simultaneous-scenes.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const events = JSON.parse(fs.readFileSync(path.join(root, 'data/events.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root, 'data/events.schema.json'), 'utf8'));
const byId = new Map(events.map(e => [e.id, e]));
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
const clock = e => e.time_start || e.time_estimate || null;

// 1. スキーマに項目がある。
assert.ok(schema.items.properties.simultaneous_with, 'events.schema.json に simultaneous_with がない');

// 2. データ：参照先がある・相互参照・同じ組の日付と時刻が一致・確定時刻があれば仮時刻も同じ値。
const linked = events.filter(e => (e.simultaneous_with || []).length);
assert.ok(linked.length >= 2);
for (const event of linked) {
  for (const otherId of event.simultaneous_with) {
    const other = byId.get(otherId);
    assert.ok(other, `${event.id} -> ${otherId} の参照先がない`);
    assert.ok((other.simultaneous_with || []).includes(event.id), `${event.id} -> ${otherId} が相互参照になっていない`);
    assert.equal(other.day, event.day, `${event.id} と ${otherId} の日付が違う`);
    assert.ok(clock(event) && clock(other), `${event.id} と ${otherId} に時刻がない`);
    assert.equal(clock(other), clock(event), `${event.id} と ${otherId} の時刻が違う`);
    if (other.time_start && !event.time_start) assert.equal(event.time_estimate, other.time_start, `${event.id} の仮時刻が確定時刻と違う`);
  }
}
// ユーザー判断（2026-10-11）：第400話の緊急放送と第404話の第9王子逝去の放送は同じ放送。
const broadcast400 = byId.get('E400-001'), broadcast404 = byId.get('E404-008');
assert.deepEqual(broadcast400.simultaneous_with, ['E404-008']);
assert.deepEqual(broadcast404.simultaneous_with, ['E400-001']);
assert.equal(broadcast400.day, 12);
assert.equal(broadcast400.time_estimate, broadcast404.time_estimate);
// 第398〜400話は12日目（第400話の放送からの連続）。
for (const id of ['E398-001', 'E398-002', 'E398-003', 'E399-001', 'E399-002', 'E399-003']) assert.equal(byId.get(id).day, 12, id);
// 特殊戒厳令の発令放送の組は確定時刻14:15（第416話）にそろう。
for (const id of byId.get('E416-001').simultaneous_with) assert.equal(clock(byId.get(id)), '14:15', id);

// 3. 画面：ネタバレ非表示では、元の出来事より後の話の場面へのリンクを出さない。
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.hidden = false; this.listeners = {}; this.textContent = ''; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const opened = [];
const ctx = vm.createContext({
  eventsData: events, spoilersRevealed: false, URL, location: {href: 'http://127.0.0.1:8765/?t_chapter=400#timeline'},
  document: {createElement: tag => new Node(tag), createTextNode: text => ({text})},
  showDetailModal: (id, category) => opened.push([id, category])
});
vm.runInContext(['sortKey', 'getSimultaneousScenes', 'fillSimultaneousScenes', 'makeSimultaneousScenesBlock'].map(extract).join('\n'), ctx);
const links = block => block.children.filter(child => child.tagName === 'a');

let block = ctx.makeSimultaneousScenesBlock(broadcast400);
assert.equal(links(block).length, 0, '非表示時に第400話から第404話（後の話）へのリンクを出してはいけない');
assert.equal(block.hidden, true);
block = ctx.makeSimultaneousScenesBlock(broadcast404);
assert.equal(links(block).length, 1, '前の話（第400話）へのリンクは非表示時も出す');
assert.match(links(block)[0].textContent, /^第400話 /);
assert.match(links(block)[0].href, /[?&]event=E400-001/);
assert.doesNotMatch(links(block)[0].href, /t_chapter/);
links(block)[0].listeners.click({preventDefault() {}, stopPropagation() {}});
assert.deepEqual(opened.pop(), ['E400-001', 'event']);

ctx.spoilersRevealed = true;
block = ctx.makeSimultaneousScenesBlock(broadcast400);
assert.equal(links(block).length, 1, '表示中は後の話の場面へのリンクも出す');
assert.match(links(block)[0].textContent, /^第404話 /);
assert.equal(block.children[0].textContent, '同時刻の別の場面：');
// 組の全員が非表示時に後の話を出さないこと（全組で確認）。
ctx.spoilersRevealed = false;
for (const event of linked) {
  for (const scene of ctx.getSimultaneousScenes(event)) assert.ok(scene.chapter <= event.chapter, `${event.id} -> ${scene.id}`);
}

// 4. 出来事カードと出来事モーダルに表示し、ネタバレ設定の切り替えで作り直す。
assert.ok(extract('createTimelineCard').includes('makeSimultaneousScenesBlock(event)'));
assert.ok(extract('showDetailModal').includes('makeSimultaneousScenesBlock(record)'));
assert.match(source, /addEventListener\("spoiler-visibility-change", \(\) => \{\s*document\.querySelectorAll\("\.simultaneous-scenes\[data-event-id\]"\)/);
// 詳細から全画面のネタバレ設定を変えない。
assert.ok(!extract('fillSimultaneousScenes').includes('setSpoilersRevealed('));

console.log(`simultaneous scenes ok (${linked.length} events linked)`);
