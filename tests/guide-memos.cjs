// 基礎資料のメモ：実際の保存・読み戻し・バックアップ処理を隔離DOMで検証。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function extract(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert.ok(start >= 0, name);
  const tail = source.slice(start);
  const next = tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next < 0 ? tail : tail.slice(0, next + 1);
}
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; }
  append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
  appendChild(node) { node.parent = this; this.children.push(node); return node; }
  setAttribute(key, value) { this[key] = value; }
  getAttribute(key) { return this[key]; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  closest() { return this.parent; }
  querySelector(selector) { return this.all().find(node => node.className?.split(' ').includes(selector.slice(1))); }
  all() { return this.children.flatMap(node => [node, ...node.all()]); }
}
const sections = [...html.matchAll(/<section class="(?:guide-facts|guide-data-section)[^"]*" aria-labelledby="([^"]+)">\s*<h3[^>]*>([^<]+)<\/h3>/g)]
  .map(([, id, title]) => {
    const section = new Element('section');
    section['aria-labelledby'] = id;
    const heading = new Element('h3'); heading.id = id; heading.textContent = title;
    section.appendChild(heading);
    return section;
  });
assert.ok(sections.length > 8);
assert.match(html, /全員念能力者/);
assert.match(html, /class="guide-data-section" aria-labelledby="soemonoTitle"/);
const storage = new Map();
const puts = [];
const timers = new Map();
const context = vm.createContext({
  console, Date, Map, Object, Boolean, DraftState: require('../draft-state.js'),
  document: {
    createElement: tag => new Element(tag),
    querySelectorAll: () => sections,
    getElementById: id => sections.flatMap(section => section.all()).find(node => node.id === id)
  },
  localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
  fetch: async (url, options) => {
    if (options.method === 'PUT') puts.push({url, ...options});
    return {ok: true, json: async () => ({format: 'hxh-succession-local-drafts', version: 1, items: {}, entries: []})};
  },
  setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; },
  clearTimeout: id => timers.delete(id),
  renderDraftOverview() {}, updateDraftStorageStatus() {}, updateDraftExitGuard() {}, memoEditorEnabled: () => true
});
const fields = source.match(/const LOCAL_EDIT_FIELDS = ([\s\S]*?);\r?\n/)[1];
vm.runInContext(`const LOCAL_EDIT_FIELDS = ${fields};
  const LOCAL_DRAFTS_KEY = 'test'; const LOCAL_DRAFTS_API = 'api/drafts';
  let localDrafts = {version: 1, items: {}};
  let draftStorageMode = 'browser', draftFileHealthy = false;
  let draftSaveQueue = Promise.resolve();
  let draftResetInProgress = false, draftLoadError = ''; const draftMemoFlushers = new Set();
  let draftSaveCount = 0, draftChangesUnsaved = false;
  const charactersData = [], eventsData = [], spiritBeastsData = [];
  ${['localRecordKey', 'getGuideMemoRecords', 'setupGuideMemos', 'renderLocalEditor', 'saveLocalDrafts', 'buildDraftExport', 'validateDraftImport'].map(extract).join('\n')}
  setupGuideMemos(); setupGuideMemos();`, context);
const memoFor = section => section.all().find(node => node.tag === 'textarea');
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  for (const section of sections) {
    assert.equal(section.all().filter(node => node.className?.includes('guide-local-memo')).length, 1);
    assert.equal(section.all().filter(node => node.tag === 'form').length, 0);
    assert.ok(memoFor(section));
  }
  const first = memoFor(sections[0]);
  first.value = '  基本数値の確認メモ  '; first.listeners.input();
  [...timers.values()].forEach(callback => callback()); timers.clear();
  await flush();
  const key = `guide:${sections[0]['aria-labelledby']}`;
  assert.equal(JSON.parse(storage.get('test')).items[key].memo, '基本数値の確認メモ');
  vm.runInContext("draftStorageMode = 'file'", context);
  const second = memoFor(sections[1]);
  second.value = '別項目のメモ'; second.listeners.input(); second.listeners.blur();
  await flush();
  assert.equal(puts.length, 1);
  assert.equal(puts[0].url, 'api/drafts');
  const backup = JSON.parse(puts[0].body);
  assert.equal(backup.items[key].memo, '基本数値の確認メモ');
  assert.equal(backup.entries.find(entry => entry.key === key).title, `基本情報：${sections[0].children[0].textContent}`);
  context.backup = backup;
  vm.runInContext('localDrafts.items = validateDraftImport(backup)', context);
  const restored = new Element('div'); context.restored = restored;
  vm.runInContext('renderLocalEditor(restored, getGuideMemoRecords()[0], "guide")', context);
  assert.equal(memoFor(restored).value, '基本数値の確認メモ');
  first.value = ''; sections[0].all().find(node => node.tag === 'button').listeners.click();
  await flush();
  const final = JSON.parse(storage.get('test'));
  assert.equal(final.items[key].memo, '');
  assert.ok(Date.parse(final.items[key].updatedAt), 'clearing must have a timestamp to beat a stale tab');
  assert.equal(require('../draft-state.js').envelope(final).entries.length, 1);
  console.log(`guide-memos: ${sections.length} sections; autosave, blur, export/import, restore, delete passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
