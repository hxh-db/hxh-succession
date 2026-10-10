/* 人物の詳細を開いても、全画面共通のネタバレ設定を自動で変えない・保存しないことの回帰テスト。
 * Usage: node tests/spoiler-settings.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
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

// 1. 人物カードの展開・人物詳細モーダルから全体設定を切り替えない。
for (const name of ['createCharacterDirectoryCard', 'showDetailModal', 'renderCharacterTimeline', 'makeLaterInfoDetails', 'restoreViewFromUrl']) {
  assert.ok(!extract(name).includes('setSpoilersRevealed('), `${name} must not change the shared spoiler setting`);
}
// 全体設定を「表示」に変えるのは、利用者が押すボタン（共通トグル・各画面の表示ボタン）だけ。
const revealCalls = [...source.matchAll(/setSpoilersRevealed\(true\)/g)].map(m => source.slice(Math.max(0, m.index - 160), m.index));
assert.equal(revealCalls.length, 1);
assert.ok(revealCalls[0].includes('[data-reveal-global]') && revealCalls[0].includes('addEventListener("click"'));

// 2. 「後の話の情報」の折りたたみは、全体設定が非表示なら閉じた状態で作られる。
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.open = false; this.textContent = ''; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
}
const ctx = vm.createContext({document: {createElement: tag => new Element(tag)}, spoilersRevealed: false});
vm.runInContext(extract('makeLaterInfoDetails'), ctx);
const later = ctx.makeLaterInfoDetails();
assert.equal(later.open, false);
assert.equal(later.children[0].textContent, '後の話の情報を表示');
later.open = true; later.listeners.toggle();
assert.equal(later.children[0].textContent, '後の話の情報を閉じる');
assert.equal(ctx.spoilersRevealed, false);

// 3. 静的人物ページ：折りたたみを手で開いても共通設定を保存しない。ボタンだけが保存する。
const stored = new Map();
const pageListeners = {};
const details = {open: false, addEventListener: (type, fn) => { pageListeners[type] = fn; }};
const button = {hidden: true, textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
  addEventListener: (type, fn) => { button.click = fn; }};
const status = {textContent: ''};
const pageCtx = vm.createContext({
  document: {getElementById: id => ({pageSpoilerToggle: button, pageSpoilerStatus: status})[id], querySelector: () => details},
  localStorage: {getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v)},
  window: {addEventListener: () => {}}
});
vm.runInContext(fs.readFileSync(path.join(root, 'character-page.js'), 'utf8'), pageCtx);
details.open = true;
pageListeners.toggle?.();
assert.equal(stored.size, 0, 'opening the static details must not persist the shared setting');
button.click();
assert.equal(stored.get('hxh-succession-spoilers-revealed-v1'), 'true');
console.log('PASS: opening a person card/modal/static page keeps the shared spoiler setting; later-chapter info is folded locally');
