/* Static link check for the published files (read-only; no network, no dependencies).
 * Usage: node tests/link-check.cjs
 * Errors (exit 1): broken internal href/src, sitemap URLs without a local file,
 *   image paths in data/*.json or code that do not exist.
 * Warnings: ?v= mismatches between pages, images/ files referenced from nowhere. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const SITE = 'https://hxh-db.github.io/hxh-succession/';
const PREFIX = new URL(SITE).pathname; // "/hxh-succession/"
const errors = [], warnings = [];
const rel = p => path.relative(root, p).split(path.sep).join('/');
const decode = s => s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');

// Directories that are not part of the public site (tests/fixtures is QA-only, see README).
const SKIP_DIRS = new Set(['.git','.local','node_modules','__pycache__','tests','intake']);
function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
const allFiles = walk(root);
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));

// Map a site URL (already resolved against SITE) to a local file, or null when outside the site.
function localTarget(url) {
  if (!url.pathname.startsWith(PREFIX)) return {escaped:true};
  let relative = decodeURIComponent(url.pathname.slice(PREFIX.length));
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const full = path.join(root, relative);
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return {full: path.join(full,'index.html'), relative: relative + '/index.html'};
  return {full, relative};
}

const referencedImages = new Set();
const markImage = relative => { if (relative.startsWith('images/')) referencedImages.add(relative); };
const versions = new Map(); // asset -> Map(version -> [pages])

// 1. Internal href/src in public HTML.
let linkCount = 0;
for (const file of htmlFiles) {
  const page = rel(file);
  const html = fs.readFileSync(file, 'utf8');
  const base = new URL(page, SITE);
  for (const [, attr, raw] of html.matchAll(/\b(href|src)\s*=\s*["']([^"']*)["']/gi)) {
    const value = decode(raw.trim());
    if (!value || value.startsWith('#') || /^(mailto|tel|data|javascript|blob):/i.test(value)) continue;
    let url;
    try { url = new URL(value, base); } catch (_) { errors.push(`${page}: 不正なURL ${value}`); continue; }
    if (url.origin !== new URL(SITE).origin) continue; // external site
    const target = localTarget(url);
    linkCount++;
    if (target.escaped) { errors.push(`${page}: /hxh-succession/ の外を指すパス ${value}`); continue; }
    if (!fs.existsSync(target.full)) errors.push(`${page}: リンク切れ ${value} (→ ${target.relative})`);
    markImage(target.relative);
    const v = url.searchParams.get('v');
    if (v && /\.(css|js)$/.test(target.relative)) {
      if (!versions.has(target.relative)) versions.set(target.relative, new Map());
      const byVersion = versions.get(target.relative);
      if (!byVersion.has(v)) byVersion.set(v, []);
      byVersion.get(v).push(page);
    }
  }
}

// 2. sitemap.xml URLs must map to local files.
let sitemapCount = 0;
const sitemapPath = path.join(root, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  for (const [, loc] of fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    sitemapCount++;
    const url = new URL(decode(loc));
    if (url.origin !== new URL(SITE).origin) { errors.push(`sitemap.xml: 別オリジンのURL ${loc}`); continue; }
    const target = localTarget(url);
    if (target.escaped) errors.push(`sitemap.xml: /hxh-succession/ の外を指すURL ${loc}`);
    else if (!fs.existsSync(target.full)) errors.push(`sitemap.xml: 対応するファイルなし ${loc} (→ ${target.relative})`);
  }
} else errors.push('sitemap.xml が見つかりません');

// 3. Image paths in data/*.json (top level only; intake material is not published).
const IMAGE_RE = /^(?:\.\/|\/hxh-succession\/|\/)?(images\/[^?#\s]+?\.(?:png|webp|jpe?g|gif|svg|avif))(?:[?#].*)?$/i;
let dataImageCount = 0;
// script.js init() replaces characters.json `image` with data/character_images.json entries,
// so a missing image there is shadowed at runtime: report it as a warning, not an error.
let imageOverrides = new Set();
try { imageOverrides = new Set(JSON.parse(fs.readFileSync(path.join(root,'data/character_images.json'),'utf8')).map(e => e.id)); } catch (_) {}
let currentRecordId = null;
function checkImageString(where, value, key) {
  const m = typeof value === 'string' && value.match(IMAGE_RE);
  if (!m) return;
  dataImageCount++;
  const relative = decodeURIComponent(m[1]);
  markImage(relative);
  if (fs.existsSync(path.join(root, relative))) return;
  if (where.startsWith('data/characters.json:') && key === 'image' && imageOverrides.has(currentRecordId))
    warnings.push(`${where} (${currentRecordId}): 画像なし ${value} — character_images.json で上書き済みのため表示には影響なし`);
  else errors.push(`${where}: 画像なし ${value}`);
}
function walkJson(where, node, trail, key, depth = 0) {
  if (Array.isArray(node)) node.forEach((v, i) => walkJson(where, v, `${trail}[${i}]`, key, depth + 1));
  else if (node && typeof node === 'object') {
    if (depth === 1) currentRecordId = typeof node.id === 'string' ? node.id : null;
    for (const [k, v] of Object.entries(node)) walkJson(where, v, trail ? `${trail}.${k}` : k, k, depth + 1);
  }
  else checkImageString(`${where}:${trail}`, node, key);
}
for (const name of fs.readdirSync(path.join(root, 'data')).filter(n => n.endsWith('.json')).sort()) {
  let json;
  try { json = JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8')); }
  catch (e) { errors.push(`data/${name}: JSONとして読めません (${e.message})`); continue; }
  walkJson(`data/${name}`, json, '');
}
// Literal image paths in public JS/CSS (e.g. script.js sets chart.src directly).
for (const file of allFiles.filter(f => /\.(js|cjs|css)$/.test(f))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [, p] of text.matchAll(/["'(`](?:\.\.\/|\.\/)*(images\/[^"'`)\s?#${}]+\.(?:png|webp|jpe?g|gif|svg|avif))/gi)) {
    dataImageCount++;
    markImage(p);
    if (!fs.existsSync(path.join(root, p))) errors.push(`${rel(file)}: 画像なし ${p}`);
  }
}

// 4. ?v= cache-busting versions should match across pages (warning only).
for (const [asset, byVersion] of [...versions].sort()) {
  if (byVersion.size < 2) continue;
  const detail = [...byVersion].map(([v, pages]) => `v=${v} (${pages.length}ページ 例: ${pages.slice(0,2).join(', ')})`).join(' / ');
  warnings.push(`バージョン不一致 ${asset}: ${detail}`);
}

// 5. Images under images/ that nothing references (warning only).
const unreferenced = allFiles.map(rel).filter(p => p.startsWith('images/') && !referencedImages.has(p)).sort();
for (const p of unreferenced) warnings.push(`未参照画像 ${p}`);

console.log(`HTML ${htmlFiles.length}件 / 内部リンク ${linkCount}件 / sitemap URL ${sitemapCount}件 / データ・コード内の画像パス ${dataImageCount}件を確認`);
if (errors.length) { console.log(`\nエラー ${errors.length}件:`); for (const e of errors) console.log(`  ERROR ${e}`); }
if (warnings.length) { console.log(`\n警告 ${warnings.length}件:`); for (const w of warnings) console.log(`  WARN  ${w}`); }
console.log(`\n結果: エラー ${errors.length}件 / 警告 ${warnings.length}件 (うち未参照画像 ${unreferenced.length}件)`);
process.exitCode = errors.length ? 1 : 0;
