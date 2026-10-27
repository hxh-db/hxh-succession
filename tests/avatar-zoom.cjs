/* 人物の顔画像アバターが既存のライトボックスで拡大できることの回帰テスト。
 * 一覧・モーダル（script.js の makeAvatar）と静的人物ページ（生成HTML＋character-page.js）を確認する。
 * Usage: node tests/avatar-zoom.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  let depth = 0;
  for (let i = source.indexOf('{', source.indexOf(') {', start)); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

// 最小限の DOM 要素
function makeElement(tag) {
  const classes = new Set();
  const attrs = {};
  return {
    tagName: tag.toUpperCase(), children: [], style: {}, dataset: {}, textContent: '',
    classList: {add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c)},
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
    set tabIndex(v) { attrs.tabindex = String(v); }, get tabIndex() { return Number(attrs.tabindex ?? -1); },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null, removeAttribute(k) { delete attrs[k]; },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); }
  };
}
const createdImages=[];
const ctx = vm.createContext({document: {createElement: tag=>{const element=makeElement(tag);if(tag==='img') createdImages.push(element);return element;}}, getDisplayName: p => p.display_name || p.name});
vm.runInContext(['getAvatarZoom', 'makeAvatarZoomable', 'clearAvatarZoomable', 'makeAvatar'].map(extract).join('\n'), ctx);

// 1. 画像のある王子：ボタンとして拡大でき、キャプションに人物名と出典の話数を出す。
const prince = {type: 'prince', rank: 14, name: 'ワブル', image: 'images/characters/woble.webp', image_source_chapter: 400};
const zoom = ctx.getAvatarZoom(prince);
const avatar = ctx.makeAvatar('第14', '特質系', prince.image, null, zoom);
assert.ok(avatar.classList.contains('zoomable-image'));
assert.equal(avatar.getAttribute('role'), 'button');
assert.equal(avatar.getAttribute('tabindex'), '0');
assert.equal(avatar.getAttribute('aria-label'), '第14王子ワブルの顔画像を拡大');
assert.equal(avatar.dataset.zoomSrc, prince.image);
assert.equal(avatar.dataset.zoomCaption, '第14王子ワブル（第400話より）');

// 2. 切り抜き（背景画像）でも、拡大時は元画像全体を指す。
const cropped = ctx.makeAvatar('クロ', null, 'images/characters/sheet.webp', {size: 'auto 400%', position: '96% 99%'}, ctx.getAvatarZoom({type: 'phantom_troupe', name: 'クロロ'}));
assert.ok(!cropped.classList.contains('zoomable-image'),'A crop must not offer zoom until its image loads');
createdImages.at(-1).naturalWidth=100;createdImages.at(-1).onload();
assert.equal(cropped.dataset.zoomSrc, 'images/characters/sheet.webp');
assert.equal(cropped.dataset.zoomCaption, 'クロロ');
const brokenCrop=ctx.makeAvatar('仮',null,'images/missing.webp',{size:'400%',position:'50% 50%'},ctx.getAvatarZoom({name:'仮称'}));
createdImages.at(-1).onerror();
assert.equal(brokenCrop.textContent,'仮');
assert.equal(brokenCrop.getAttribute('role'),null);
assert.equal(brokenCrop.getAttribute('tabindex'),null);
assert.equal(brokenCrop.style.backgroundImage,'');

// 3. 頭文字アバター・画像の読み込み失敗は拡大しない。
const initials = ctx.makeAvatar('ハル', null, null, null, ctx.getAvatarZoom({type: 'soldier', name: 'ハルケン'}));
assert.ok(!initials.classList.contains('zoomable-image'));
assert.equal(initials.getAttribute('role'), null);
const broken = ctx.makeAvatar('ハル', null, 'images/missing.webp', null, ctx.getAvatarZoom({type: 'soldier', name: 'ハルケン'}));
broken.children[0].onerror();
assert.ok(!broken.classList.contains('zoomable-image'));
assert.equal(broken.getAttribute('tabindex'), null);

// 4. 既存ライトボックスを再利用し、カードの開閉・詳細表示より先に（キャプチャ段階で）処理する。
const lightbox = extract('setupImageLightbox');
assert.match(lightbox, /\.zoomable-image\[data-zoom-src\]/);
assert.match(lightbox, /}, true\);[\s\S]*}, true\);/);
assert.ok((source.match(/getAvatarZoom\(/g) || []).length >= 5, 'cards, directory and modal must pass zoom info');
assert.match(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /\.char-avatar\.avatar-zoomable \{ cursor: zoom-in;/);

// 5. 静的人物ページ：顔画像のある人物だけに拡大リンクとライトボックスを出す。
const {expectedOutputs} = require('../scripts/build-character-pages.cjs');
const images = new Map(JSON.parse(fs.readFileSync(path.join(root, 'data', 'character_images.json'), 'utf8')).map(e => [e.id, e]));
const characters = JSON.parse(fs.readFileSync(path.join(root, 'data', 'characters.json'), 'utf8'));
let withAvatar = 0;
for (const [file, html] of expectedOutputs()) {
  const id = file.match(/^characters\/([^/]+)\/index\.html$/)?.[1];
  if (!id) continue;
  const person = characters.find(p => p.id === id);
  const image = images.get(id)?.image || person.image;
  const hasImage = /^images\//.test(image || '');
  assert.equal(html.includes('class="zoomable-image character-page-avatar"'), hasImage, `${id} avatar`);
  // 顔画像がなくても、能力・守護霊獣の画像があれば共通の拡大表示を提供する。
  assert.equal(html.includes('id="imageLightbox"'), html.includes('data-zoom-src='), `${id} lightbox`);
  if (hasImage) {
    withAvatar++;
    assert.match(html, /aria-label="[^"]+の顔画像を拡大" data-zoom-src="\.\.\/\.\.\/images\//);
    const chapter = images.get(id)?.source_chapter;
    if (chapter) assert.ok(html.includes(`（第${chapter}話より）"`), `${id} source chapter caption`);
  }
}
assert.ok(withAvatar > 0, 'some static pages must have avatars');

// 6. 静的ページの拡大：クリックで開き、リンク遷移せず、閉じたら元の画像へフォーカスを戻す。
const listeners = new Map();
const on = (el) => (type, fn) => listeners.set(`${el}:${type}`, fn);
const focused = [];
const trigger = {dataset: {zoomSrc: '../../images/characters/woble.webp', zoomAlt: '第14王子 ワブルの顔画像', zoomCaption: '第14王子 ワブル'},
  setAttribute(k, v) { this[k] = v; }, addEventListener: on('trigger'), focus: () => focused.push('trigger')};
const dialog = {open: false, classList: {remove() {}, toggle: () => true}, addEventListener: on('dialog'),
  showModal() { this.open = true; }, close() { this.open = false; listeners.get('dialog:close')(); }};
const enlarged = {removeAttribute(k) { delete this[k]; }};
const caption = {textContent: ''};
const close = {addEventListener: on('close'), focus: () => focused.push('close')};
const zoomButton = {setAttribute() {}, addEventListener: on('zoom'), focus: () => focused.push('zoom')};
const pageCtx = vm.createContext({
  document: {
    getElementById: id => ({imageLightbox: dialog, lightboxImage: enlarged, lightboxCaption: caption, lightboxClose: close, lightboxZoom: zoomButton})[id] || null,
    querySelector: () => null, querySelectorAll: () => [trigger], activeElement: null
  },
  localStorage: {getItem: () => null, setItem() {}}, window: {addEventListener() {}}
});
vm.runInContext(fs.readFileSync(path.join(root, 'character-page.js'), 'utf8'), pageCtx);
assert.equal(trigger.role, 'button');
let prevented = false;
listeners.get('trigger:click')({preventDefault: () => { prevented = true; }});
assert.ok(prevented, 'the fallback image link must not navigate');
assert.ok(dialog.open);
assert.equal(enlarged.src, '../../images/characters/woble.webp');
assert.equal(caption.textContent, '第14王子 ワブル');
dialog.close();
assert.equal(focused.at(-1), 'trigger');
console.log(`PASS: face avatars zoom in the shared lightbox (cards/modal/${withAvatar} static pages), crop shows the full image, initials stay static`);
