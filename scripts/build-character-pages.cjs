/* Public JSON -> static character pages. No local drafts/intake/audit files are read. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const CharacterFacts = require('../character-facts.js');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://hxh-db.github.io/hxh-succession/';
// Reuse the main page's stylesheet URL so regenerated index/detail pages cannot drift.
const STYLE_URL = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/href="(style\.css\?v=[^"]+)"/)?.[1];
if (!STYLE_URL) throw new Error('Missing versioned stylesheet URL in index.html');
const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8'));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeNames = {king:'国王', prince:'王子', queen:'王妃', hunter:'ハンター', soldier:'兵士', attendant:'従事者', mafia:'マフィア', phantom_troupe:'幻影旅団', official:'司法・政府関係者', mercenary:'傭兵', expedition_member:'探検隊関係者'};
function displayName(person) { return person.display_name || person.name.replace(/＝ホイコーロ$/, ''); }
function titleName(person) { return (['prince','queen'].includes(person.type) ? `第${person.rank}${typeNames[person.type]} ` : '') + displayName(person); }
function publicFields(person) {
  return [['登録名', person.id === 'KNG-001' ? displayName(person) : person.name], ['分類', person.is_count_only ? '人数枠（個人未同定）' : person.type === 'unclassified' ? '関係者（職種未確認）' : typeNames[person.type] || person.type],
    ['初期配置（現在地ではありません）', person.initial_room]];
}
function spoilerFields(person, events = []) {
  // Explicit allowlist: never copy notes, spoiler_notes, research or editor state.
  return [['状態', CharacterFacts.statusLabel(person, events)],
    ['所属', person.former_affiliations?.length ? `${person.affiliation || ''}（旧所属：${person.former_affiliations.join('・')}）` : person.affiliation],
    ['役割', person.target ? (person.role || '').replace(person.target, '').trim() : person.role], ['役割・兵種の根拠', person.role_evidence], ['母（王妃）', person.queen], ['任務', person.role?.includes(person.mission) ? null : person.mission],
    ['最後の登録任務先', person.current_assignment], ['最後の所在', CharacterFacts.latestLocationParts(person, events)],
    ['念使用の確認', CharacterFacts.nenKnowledgeLabel(person)],
    ['念系統', CharacterFacts.nenTypeLabel(person)], ['念能力', person.nen_ability || '本人固有の能力は未確認'], ['守護霊獣', person.id === 'KNG-001' ? person.spirit_beast_name?.replace('ナスビー', 'ホイコーロ国王') : person.spirit_beast_name]];
}
// 最後の所在。「第○話」は根拠の出来事を一覧で開くURLにする（一覧側はネタバレ非表示なら詳細を開かず、その話の一覧だけを出す）。
function locationPartsHtml(parts) {
  return parts.map(part => part.eventId
    ? `<a class="latest-place-event-link" href="../../?event=${encodeURIComponent(part.eventId)}#timeline" title="根拠の出来事 ${escape(part.eventId)}">${escape(part.text)}</a>`
    : escape(part.text)).join('');
}
function latestLocationHtml({main, confirmed, candidates}) {
  let html = `<p class="latest-place-main">${locationPartsHtml(main)}</p>`;
  if (confirmed) html += `<p class="latest-place-confirmed">${locationPartsHtml(confirmed)}</p>`;
  if (candidates.length) html += `<p class="latest-place-candidates-label">ほかの関係記録（本人の在室は未確認）</p><ul class="readable-list latest-place-candidates">${candidates.map(group => `<li>${locationPartsHtml([{text: `第${group.chapter}話`, eventId: group.eventIds[0]}, {text: group.text.slice(`第${group.chapter}話`.length)}])}</li>`).join('')}</ul>`;
  return html;
}
// 長い記述（念能力など）は話数の区切りで箇条書きにする。データは変えず表示だけを分ける。
const READABLE_LABELS = new Set(['念能力']);
function fieldValue(label, value) {
  const segments = READABLE_LABELS.has(label) ? CharacterFacts.readableSegments(value) : [];
  if (segments.length > 1) return `<ul class="readable-list">${segments.map(s => `<li>${escape(s)}</li>`).join('')}</ul>`;
  if (label === '最後の所在') return latestLocationHtml(value);
  return escape(value);
}
function definitionList(fields) {
  return '<dl class="detail-list">' + fields.filter(([,v]) => v !== undefined && v !== null && v !== '').map(([label,value]) => `<dt>${escape(label)}</dt><dd>${fieldValue(label, value)}</dd>`).join('\n') + '</dl>';
}
function familyHtml(person, characters) {
  const relatives = CharacterFacts.familyRelations(person, characters);
  if (!relatives.length) return '';
  return `<section class="character-family-relations"><h2>家族関係</h2><ul>${relatives.map(relation=>{
    const relative = characters.find(p=>p.id===relation.id);
    return `<li>[${escape(CharacterFacts.familyRelationLabel(relation))}] <a href="../${encodeURIComponent(relative.id)}/">${escape(titleName(relative))}</a>（${escape(relation.kind)}${relation.speculative?'・未確定':''}）${relation.note?`<p>${escape(relation.note)}</p>`:''}</li>`;
  }).join('')}</ul></section>`;
}
// 顔画像（一覧と同じく character_images.json を優先）。拡大は character-page.js が既存と同じライトボックスで行う。
function withImages(characters) {
  const byId = new Map(read('character_images.json').map(entry => [entry.id, entry]));
  return characters.map(person => {
    const entry = byId.get(person.id);
    return entry ? {...person, image: entry.image, image_crop: entry.crop || null, image_source_chapter: entry.source_chapter || null} : person;
  });
}
function avatarHtml(person) {
  if (!/^images\/[\w./-]+$/.test(person.image || '') || person.image.includes('..')) return '';
  const name = titleName(person);
  const src = `../../${person.image}`;
  const caption = person.image_source_chapter ? `${name}（第${person.image_source_chapter}話より）` : name;
  const crop = person.image_crop;
  const inner = crop
    ? `<span class="character-page-avatar-crop" role="img" aria-label="${escape(name)}の顔画像" style="display:block;width:100%;height:100%;background:url(&quot;${escape(src)}&quot;) no-repeat;background-size:${escape(crop.size)};background-position:${escape(crop.position)}"></span>`
    : `<img src="${escape(src)}" alt="${escape(name)}の顔画像" width="112" height="112">`;
  return `<p class="character-page-avatar-wrap"><a class="zoomable-image character-page-avatar" href="${escape(src)}" aria-label="${escape(name)}の顔画像を拡大" data-zoom-src="${escape(src)}" data-zoom-alt="${escape(name)}の顔画像" data-zoom-caption="${escape(caption)}">${inner}</a></p>\n`;
}
const LIGHTBOX_HTML = '<dialog id="imageLightbox" class="image-lightbox" aria-label="画像の拡大表示"><div class="image-lightbox-controls"><button id="lightboxZoom" type="button" aria-pressed="false">＋ さらに拡大</button><button id="lightboxClose" type="button">× 閉じる</button></div><div class="image-lightbox-stage"><img id="lightboxImage" alt=""></div><p id="lightboxCaption"></p></dialog>';
function mediaHtml(src, caption) {
  if (!/^images\/[\w./-]+$/.test(src || '') || src.includes('..')) return '';
  return `<figure><a class="zoomable-image" href="../../${escape(src)}" data-zoom-src="../../${escape(src)}" data-zoom-alt="${escape(caption)}" data-zoom-caption="${escape(caption)}"><img class="spirit-beast-usage-image" src="../../${escape(src)}" alt="${escape(caption)}" loading="lazy"></a><figcaption class="guide-source-note">${escape(caption)}</figcaption></figure>`;
}
function beastHtml(person, beasts, events) {
  const b = beasts.find(b => b.prince === person.name);
  if (!b) return '';
  const refs = (b.source_event_ids || []).map(id => events.find(e=>e.id===id)).filter(Boolean);
  return `<section class="character-beast-detail"><h2>守護霊獣：${escape(b.name)}</h2>${definitionList([['外見・形態',b.appearance],['守護霊獣の念系統',b.nen_type || '未確認'],['念能力',b.ability]])}<p>${refs.map(e=>`<a href="../../?event=${encodeURIComponent(e.id)}#timeline">第${e.chapter}話（${e.verification_status === 'review_recorded' ? '原作確認記録あり' : '原作再照合待ち'}）</a>`).join(' ／ ')}</p>${mediaHtml(b.image,b.name)}${mediaHtml(b.usage_image,b.usage_image_source || `${b.name}の使用・顕現場面`)}</section>`;
}
function historyHtml(person, events) {
  const rows = CharacterFacts.statusHistoryRows(person, events);
  return rows.length ? `<section class="character-status-history"><h2>状態の経緯</h2><ul class="readable-list">${rows.map(row=>`<li>${escape(row.text)}（${escape(row.review)}）${row.event_id ? ` <a href="../../?event=${encodeURIComponent(row.event_id)}#timeline">根拠の出来事</a>` : ''}</li>`).join('')}</ul></section>` : '';
}
function pageHtml(person, events, characters, sources, beasts = []) {
  const title = `${titleName(person)} | HUNTER×HUNTER 王位継承戦データベース`;
  const description = `${titleName(person)}の人物情報。初期配置と登録情報を確認し、人物一覧の検索や関連する出来事へ移動できます。後の展開は折りたたんでいます。`;
  const related = events.filter(e => (e.characters || []).includes(person.id) || (e.characters || []).includes(person.name));
  const grouped = [...new Set(related.map(e => e.chapter))].sort((a,b) => a-b);
  const assignments = CharacterFacts.assignmentRows(person, characters);
  const claims = CharacterFacts.claimRows(person, events);
  const evidence = person.author_setting;
  const source = evidence ? sources.find(s=>s.id===evidence.source_id) : null;
  const avatar = avatarHtml(person);
  const abilityMedia = CharacterFacts.isConfirmedNenUser(person) ? mediaHtml(person.nen_ability_image,person.nen_ability_image_source || `${titleName(person)}の念能力`) : '';
  const beast = beastHtml(person,beasts,events);
  const hasZoomableImage = (avatar + abilityMedia + beast).includes('data-zoom-src=');
  const authorPanel = evidence ? `<section class="author-setting-panel"><h2>作者の公式設定資料</h2><p>確認済み：${escape(evidence.confirmed_fields.join('・'))}。${escape(evidence.scope)}</p>${source?.source_type === 'author_official_x' && /^https:\/\/x\.com\//.test(source.url || '') ? `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)}を確認</a>` : ''}${evidence.correction ? `<p>${escape(evidence.correction)}</p>` : ''}</section>` : '';
  return `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${person.verification_status === 'unverified' || person.is_count_only || person.roster_projection ? '<meta name="robots" content="noindex,follow">' : ''}
<link rel="canonical" href="${SITE}characters/${encodeURIComponent(person.id)}/">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../../${STYLE_URL}">
<script src="../../spoiler-preferences.js?v=20261028-ui" defer></script>
<script src="../../character-page.js?v=20261028-ui" defer></script>
</head><body class="standalone-character-page" data-character-id="${escape(person.id)}">
<header class="site-header"><div class="header-inner"><p>HUNTER×HUNTER 王位継承戦データベース</p></div>
<nav class="primary-nav"><a href="../../#characters">人物一覧</a><a href="../../#timeline">出来事</a><a href="../../characters/">人物索引</a></nav></header>
<main class="page-container"><article class="character-page-card">
${avatar}<h1>${escape(titleName(person))}</h1>
${CharacterFacts.registrationNotice(person) ? `<p class="guide-source-note">${escape(CharacterFacts.registrationNotice(person))}</p>` : ''}
${definitionList(publicFields(person))}
${evidence ? `<p class="author-setting-badge">${person.setting_only ? '作者設定表／本編対応未確認' : '作者設定表で氏名確認'}</p>` : ''}
<p class="character-page-actions"><a class="character-page-list-link" href="../../?person=${encodeURIComponent(person.id)}#characters">人物一覧で見る</a></p>
<p>初期配置は台帳の当初の担当先です。後任の人物や復元枠も含み、全員の出航時の在室を示すものではありません。後の展開は下の折りたたみにまとめています。</p>
<div id="spoilerPreferences" class="spoiler-preferences" data-latest-chapter="${Math.max(...events.map(event=>event.chapter))}" hidden></div>
<details class="character-page-spoilers" data-nosnippet><summary>人物詳細（後の展開を含む）</summary>
${definitionList(spoilerFields(person, events))}
${familyHtml(person, characters)}
${abilityMedia}
${beast}
${historyHtml(person,events)}
${authorPanel}
${claims.length ? `<section class="character-review-panel"><h2>出来事の記録から分かること</h2>${claims.map(claim=>`<p>${escape(claim.text)}</p>${claim.event_ids.map(id=>{const event=events.find(e=>e.id===id); return event ? `<a href="../../?t_person=${encodeURIComponent(person.id)}&t_chapter=${event.chapter}&t_period=all#timeline" title="場面ID ${escape(id)}">第${event.chapter}話の出来事</a>` : '';}).join(' ')}`).join('')}</section>` : ''}
${assignments.length ? `<h2>${assignments.length > 1 ? '配置履歴' : '担当陣営'}</h2><ul>${assignments.map(e=>`<li>${escape(e.text)}${e.event_id ? ` <a href="../../?t_person=${encodeURIComponent(person.id)}&t_chapter=${e.chapter}&t_period=all#timeline" title="場面ID ${escape(e.event_id)}">関連する出来事</a>` : ''}</li>`).join('')}</ul>` : ''}
<details class="editorial-status"><summary>編集状況</summary><ul><li>人物ID：${escape(person.id)}</li><li>${escape(CharacterFacts.statusEditorialNote(person, events))}</li>${CharacterFacts.nenAbilityEditorialLines(person).map(line => `<li>${escape(line)}</li>`).join('')}<li>公開データの登録情報から生成したページです。個人メモ・編集内容・調査記録は含めません。</li><li><a href="../../?person=${encodeURIComponent(person.id)}&detail=1#characters">一覧の詳細でメモ・編集</a></li></ul></details>
</details>
<section class="character-page-related"><h2>関連する出来事</h2><p>話数から人物の出来事へ移動できます。出来事本文のネタバレは一覧側の共通設定で表示します。</p>
${grouped.length ? `<ul>${grouped.map(ch=>`<li><a href="../../?t_person=${encodeURIComponent(person.id)}&t_chapter=${ch}&t_period=all#timeline">第${ch}話の関連する出来事</a></li>`).join('\n')}</ul>` : '<p>関連する出来事は未登録です。</p>'}
<a href="../../?t_person=${encodeURIComponent(person.id)}&t_period=all#timeline">この人物の出来事を一覧で見る</a></section>
<p class="guide-source-note">情報源：公開人物台帳・公開出来事台帳。</p>
</article></main>${hasZoomableImage ? LIGHTBOX_HTML : ''}</body></html>\n`;
}
function expectedOutputs(onlyId = null) {
  const characters = withImages(read('characters.json')), events = read('events.json'), sources = read('sources.json'), beasts = read('spirit_beasts.json');
  const ids = new Set();
  characters.forEach(p => { if (!/^[A-Za-z0-9_-]+$/.test(p.id) || ids.has(p.id)) throw new Error(`Invalid/duplicate ID: ${p.id}`); ids.add(p.id); });
  if (onlyId && !ids.has(onlyId)) throw new Error(`Unknown ID: ${onlyId}`);
  const selected = onlyId ? characters.filter(p => p.id === onlyId) : characters;
  const outputs = new Map(selected.map(p => [`characters/${p.id}/index.html`, pageHtml(p,events,characters,sources,beasts)
    .replace(/ナスビー(?:＝ホイコーロ)?(?:国王)?/g, 'ホイコーロ国王')]));
  if (!onlyId) {
    const countOnly = new Set(read('count_only_characters.json').ids);
    const initialIds = new Set(read('personnel_roster.json').members.map(member => member.character_id));
    const directory = characters.filter(p=>!p.roster_projection && p.verification_status !== 'unverified'
      && (initialIds.has(p.id) || (!p.is_count_only && !countOnly.has(p.id))));
    // 既存の type / camp で見出しごとに分ける（王子陣営に配置されたハンターは護衛として扱う）。
    const princeCamps = new Set(characters.filter(p => p.type === 'prince').map(p => p.camp).filter(Boolean));
    const indexGroups = [
      ['王族（国王・王子・王妃）', p => ['king', 'prince', 'queen'].includes(p.type)],
      ['護衛・私設兵・王妃所属兵', p => p.type === 'soldier' || (p.type === 'hunter' && princeCamps.has(p.camp))],
      ['従事者', p => p.type === 'attendant'],
      ['ハンター協会・ビヨンドチーム', p => p.type === 'hunter'],
      ['マフィア', p => p.type === 'mafia'],
      ['幻影旅団', p => p.type === 'phantom_troupe'],
      ['司法・政府・その他', () => true]
    ];
    const typeOrder = {king: 0, queen: 1, prince: 2};
    const placed = new Set();
    const links = indexGroups.map(([heading, match]) => {
      const members = directory.filter(p => !placed.has(p.id) && match(p));
      members.forEach(p => placed.add(p.id));
      if (heading.startsWith('王族')) members.sort((a, b) => (typeOrder[a.type] - typeOrder[b.type]) || ((a.rank ?? 0) - (b.rank ?? 0)));
      return members.length ? `<h2>${escape(heading)}（${members.length}人）</h2>\n<ul class="static-character-index">${members.map(p => `<li><a href="${encodeURIComponent(p.id)}/">${escape(titleName(p))}</a></li>`).join('\n')}</ul>` : '';
    }).filter(Boolean).join('\n');
    outputs.set('characters/index.html', `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>人物索引 | HUNTER×HUNTER 王位継承戦</title><meta name="description" content="王位継承戦の人物を名前から探す静的人物索引。"><link rel="canonical" href="${SITE}characters/"><link rel="icon" href="../favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../${STYLE_URL}"></head><body><main class="page-container"><h1>人物索引</h1><p><a href="../#characters">検索・絞り込みができる人物一覧へ</a></p>
<div id="spoilerPreferences" class="spoiler-preferences" data-latest-chapter="${Math.max(...events.map(event=>event.chapter))}" hidden></div>
${links}
</main><script src="../spoiler-preferences.js?v=20261028-ui" defer></script><script src="../character-page.js?v=20261028-ui" defer></script></body></html>\n`);
    // 人数枠は閲覧できるようにするが、実在の個人として検索エンジンへ推薦しない。
    const urls = [SITE, SITE+'characters/', ...directory.filter(p=>!p.is_count_only && !countOnly.has(p.id)).map(p=>`${SITE}characters/${p.id}/`)];
    outputs.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(url=>`<url><loc>${escape(url)}</loc></url>`).join('\n')+'\n</urlset>\n');
    const hashes = ['characters.json','character_images.json','events.json','spirit_beasts.json','count_only_characters.json','personnel_roster.json','sources.json'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'data',file))).digest('hex')]);
    outputs.set('characters/build-manifest.json', JSON.stringify({generator:'scripts/build-character-pages.cjs',site:SITE,character_count:characters.length,directory_count:directory.length,source_sha256:Object.fromEntries(hashes)},null,2)+'\n');
  }
  return outputs;
}
function run(argv) {
  const onlyId = argv.includes('--id') ? argv[argv.indexOf('--id')+1] : null;
  if (argv.includes('--id') && !onlyId) throw new Error('--id needs a character ID');
  const outputs = expectedOutputs(onlyId);
  if (argv.includes('--check')) {
    const stale = [...outputs].filter(([file,body]) => !fs.existsSync(path.join(ROOT,file)) || fs.readFileSync(path.join(ROOT,file),'utf8') !== body).map(([file])=>file);
    if (stale.length) throw new Error(`Missing/stale generated files: ${stale.join(', ')}`);
    console.log(`PASS: ${outputs.size} generated files match public JSON`); return;
  }
  for (const [file,body] of outputs) { const target=path.join(ROOT,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,body,'utf8'); }
  console.log(`Generated ${outputs.size} files${onlyId ? ` (pilot: ${onlyId})` : ''}. No source JSON or local drafts changed.`);
}
if (require.main === module) run(process.argv.slice(2));
module.exports = {expectedOutputs, publicFields, spoilerFields, titleName, pageHtml, SITE};
