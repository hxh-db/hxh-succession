/* Shared public-record presentation for the directory, modal and static pages. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CharacterFacts = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  function locationLabel(value) {
    return String(value || '').replace(/第?([1-5])層\s*/g, '第$1層 ')
      .replace(/(^|[^\d])(10\d{2})(?!号室)/g, '$1$2号室').trim();
  }
  function assignmentRows(person, people) {
    return (person.assignment_history || []).map(entry => {
      const prince = people.find(p => p.id === entry.prince_id);
      const name = prince ? `第${prince.rank}王子${(prince.display_name || prince.name).replace(/＝ホイコーロ$/, '')}` : entry.prince_id;
      return {...entry, text: `${entry.label}：${name}／${locationLabel(entry.room)}（第${entry.chapter}話）`};
    });
  }
  function latestLocation(person, events) {
    const minutes = value => /^\d{1,2}:\d{2}$/.test(value || '') ? Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]) : null;
    const byId = new Map(events.map(e => [e.id, e]));
    const before = (a, b, seen = new Set()) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      const next = events.filter(e => e.time_after_event_id === a.id).map(e => e.id);
      if (a.time_before_event_id) next.push(a.time_before_event_id);
      return next.some(id => id === b.id || (byId.has(id) && before(byId.get(id), b, seen)));
    };
    const compare = (a, b) => {
      if (before(a, b)) return -1;
      if (before(b, a)) return 1;
      if (a.day != null && b.day != null && a.day !== b.day) return a.day - b.day;
      const at = minutes(a.time_start || a.time_estimate), bt = minutes(b.time_start || b.time_estimate);
      if (a.day != null && a.day === b.day && at != null && bt != null && at !== bt) return at - bt;
      // A missing clock is not midnight. Chapter/order is drawing order, not a proven clock.
      return a.chapter - b.chapter || (a.chapter_order || Number(a.id.split('-')[1])) - (b.chapter_order || Number(b.id.split('-')[1]));
    };
    const matching = events.filter(e => (e.characters || []).includes(person.id)).map(event => {
      const presence = event.character_presence?.[person.id] || 'unknown';
      if (['mentioned', 'remote'].includes(presence) || ['flashback', 'reference', 'setting'].includes(event.chronology_kind) || event.period) return {event, location: null};
      if (event.character_locations && Object.hasOwn(event.character_locations, person.id))
        return {event, presence, location: event.character_locations[person.id]};
      const remote = /電話|通話|連絡|報告|手紙|回想|モノローグ|知らされ|伝え/.test(event.description || '')
        || /死後.*閉鎖/.test(event.description || '');
      return {event, presence, location: remote && presence === 'unknown' ? null : event.location || event.room};
    }).filter(e => e.location && e.location !== '場所不明').sort((a, b) => compare(a.event, b.event));
    const located = matching.filter(e => ['present', 'body'].includes(e.presence));
    const latest = located.at(-1);
    if (latest) return {location: locationLabel(latest.location), chapter: latest.event.chapter,
      eventId: latest.event.id, presence: latest.presence, review: latest.event.verification_status || 'unverified',
      candidates: matching.filter(e => e.presence === 'unknown' && compare(e.event, latest.event) > 0)
        .map(e => ({eventId: e.event.id, chapter: e.event.chapter, location: locationLabel(e.location)}))};
    const candidate = matching.at(-1);
    if (candidate) return {location: locationLabel(candidate.location), chapter: candidate.event.chapter,
      eventId: candidate.event.id, presence: 'unknown', review: candidate.event.verification_status || 'unverified',
      candidates: matching.filter(e => e !== candidate && e.location !== candidate.location
        && !before(e.event, candidate.event) && !before(candidate.event, e.event)
        && (e.event.day == null || candidate.event.day == null || (e.event.day === candidate.event.day
          && (minutes(e.event.time_start || e.event.time_estimate) == null || minutes(candidate.event.time_start || candidate.event.time_estimate) == null))))
        .map(e => ({eventId:e.event.id, chapter:e.event.chapter, location:locationLabel(e.location)}))};
    const location = person.room || person.location;
    return location ? {location: locationLabel(location), chapter: person.location_basis_chapter || null, eventId: null, presence: 'unknown', review: 'unverified', candidates: []} : null;
  }
  // 同じ話・同じ場所の関係記録は1行にまとめ、件数を添える（記録そのものは減らさない）。
  function groupLocationCandidates(candidates) {
    const groups = new Map();
    for (const entry of candidates || []) {
      const key = `${entry.chapter}\u0000${entry.location}`;
      if (!groups.has(key)) groups.set(key, {chapter: entry.chapter, location: entry.location, eventIds: []});
      groups.get(key).eventIds.push(entry.eventId);
    }
    return [...groups.values()].map(group => ({...group, count: group.eventIds.length,
      text: `第${group.chapter}話 ${group.location}${group.eventIds.length > 1 ? `（${group.eventIds.length}件）` : ''}`}));
  }
  function latestLocationLabel(person, events) {
    const latest = latestLocation(person, events);
    if (!latest) return '未登録';
    const review = latest.review === 'review_recorded' ? '' : latest.review === 'hypothesis' ? '・内容は推測' : '・再照合待ち';
    const kind = latest.presence === 'body' ? '遺体の所在：' : latest.presence === 'unknown' ? '所在候補（在室は未確認）：' : '';
    const groups = groupLocationCandidates(latest.candidates);
    const pending = groups.length ? `。ほかに所在未判定の記録：${groups.map(group => group.text).join('／')}` : '';
    return `${kind}${latest.location}（${latest.chapter ? `第${latest.chapter}話時点` : '登録値'}${review}）${pending}`;
  }
  // 長い記述を、話数で始まる文の前で区切る。データは変えず表示だけを分ける。
  function readableSegments(text) {
    const value = String(text ?? '').trim();
    if (!value) return [];
    const sentences = value.split(/(?<=。)(?![」』）)])/).map(s => s.trim()).filter(Boolean);
    const startsChapter = s => /^(?:（)?第?\d{3}(?:[・〜～]第?\d{3})*話/.test(s);
    const segments = [];
    sentences.forEach((sentence, index) => {
      if (!segments.length || (index > 0 && startsChapter(sentence))) segments.push(sentence);
      else segments[segments.length - 1] += sentence;
    });
    if (segments.length === 1 && sentences.length >= 3 && value.length > 140) return sentences;
    return segments;
  }
  function reviewLabel(event) {
    return ({review_recorded: '原作確認記録あり', hypothesis: '内容は推測'})[event?.verification_status] || '原作再照合待ち';
  }
  function claimRows(person, events) {
    return (person.review_claims || []).map(claim => {
      const refs = claim.event_ids.map(id => events.find(e => e.id === id));
      const reviewed = refs.length > 0 && refs.every(e => e?.verification_status === 'review_recorded');
      const status = reviewed ? '原作確認記録あり' : refs.some(e => e?.verification_status === 'hypothesis') ? '内容は推測' : '原作再照合待ち';
      return {...claim, text: `${status}：${claim.text}`, status};
    });
  }
  function statusLabel(person, events) {
    const log = person.status_log?.at(-1);
    const event = events.find(e => e.id === log?.event_id);
    const parts = [log?.chapter ? `第${log.chapter}話時点` : null,
      event?.verification_status === 'hypothesis' ? '内容は推測' : event && event.verification_status !== 'review_recorded' ? '再照合待ち' : null].filter(Boolean);
    return `${person.status || '未登録'}${parts.length ? `（${parts.join('・')}）` : ''}${person.status_review_note ? `。${person.status_review_note}` : ''}`;
  }
  // 編集者向けの詳しい根拠表示。読者向けの本文ではなく「編集状況」欄やツールチップで使う。
  function statusEditorialNote(person, events) {
    const log = person.status_log?.at(-1);
    const event = events.find(e => e.id === log?.event_id);
    return `状態の確認話数：${log?.chapter ? `第${log.chapter}話` : '未登録'}／根拠の出来事：${event ? `${event.id}（${reviewLabel(event)}）` : '未照合'}`;
  }
  // ===== 人物検索（表記ゆれ・ローマ字・ネタバレ制御） =====
  // 検索語と対象の両方を同じ規則で正規化する：NFKC → 小文字 → ひらがなをカタカナへ → 長音・中黒・＝・空白などを除く。
  const SEARCH_IGNORED = /[\s・･=＝ー―‐‑–—－\-~〜～_.,、。'’"“”]/g;
  function normalizeSearchText(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
      .replace(SEARCH_IGNORED, '');
  }
  // カタカナの簡易ヘボン式ローマ字化（人物名の検索用。厳密な表記規則ではない）。
  const KANA_ROMAJI = Object.fromEntries(('ア a イ i ウ u エ e オ o カ ka キ ki ク ku ケ ke コ ko サ sa シ shi ス su セ se ソ so '
    + 'タ ta チ chi ツ tsu テ te ト to ナ na ニ ni ヌ nu ネ ne ノ no ハ ha ヒ hi フ fu ヘ he ホ ho マ ma ミ mi ム mu メ me モ mo '
    + 'ヤ ya ユ yu ヨ yo ラ ra リ ri ル ru レ re ロ ro ワ wa ヰ i ヱ e ヲ o ン n ガ ga ギ gi グ gu ゲ ge ゴ go ザ za ジ ji ズ zu ゼ ze ゾ zo '
    + 'ダ da ヂ ji ヅ zu デ de ド do バ ba ビ bi ブ bu ベ be ボ bo パ pa ピ pi プ pu ペ pe ポ po ヴ vu '
    + 'ァ a ィ i ゥ u ェ e ォ o ャ ya ュ yu ョ yo ヮ wa').split(' ').reduce((pairs, token, index, list) => (index % 2 ? pairs : [...pairs, [token, list[index + 1]]]), []));
  function katakanaToRomaji(value) {
    const text = normalizeSearchText(value);
    let result = '';
    let doubleNext = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === 'ッ') { doubleNext = true; continue; }
      let roma = KANA_ROMAJI[ch];
      if (roma == null) { doubleNext = false; result += /[a-z0-9]/.test(ch) ? ch : ''; continue; }
      const next = text[i + 1];
      if ('ャュョ'.includes(next || 'x') && /i$/.test(roma) && roma.length > 1) {
        // キャ→kya、シャ→sha、チャ→cha、ジャ→ja
        const stem = roma.slice(0, -1);
        roma = (/(sh|ch|j)$/.test(stem) ? stem : `${stem}y`) + KANA_ROMAJI[next].slice(1);
        i++;
      } else if ('ァィゥェォ'.includes(next || 'x') && roma.length > 1) {
        // フィ→fi、ティ→ti、ヴァ→va、シェ→she
        roma = roma.replace(/[aiueo]$/, '') + KANA_ROMAJI[next];
        i++;
      }
      if (doubleNext) roma = (roma.startsWith('ch') ? 't' : roma[0]) + roma;
      doubleNext = false;
      result += roma;
    }
    return result;
  }
  const SEARCH_TYPE_LABELS = {king:'国王', prince:'王子', queen:'王妃', hunter:'ハンター', soldier:'兵士', attendant:'従事者',
    mercenary:'傭兵', expedition_member:'探検隊関係者', mafia:'マフィア', phantom_troupe:'幻影旅団', official:'司法・政府'};
  function shortName(person) {
    return String(person.display_name || person.name || '').replace(/＝ホイコーロ/g, '');
  }
  // 王子・王妃は「第1王子」「ベンジャミン王子」「ベンジャミン」などの呼び方でも探せるようにする（データは変えない）。
  function royalAliases(person) {
    const short = shortName(person);
    const title = person.type === 'prince' ? '王子' : person.type === 'queen' ? '王妃' : null;
    if (!title || person.rank == null) return [];
    return [`第${person.rank}${title}`, `${short}${title}`, `第${person.rank}${title}${short}`, short];
  }
  function searchNames(person) {
    return [person.name, person.display_name, shortName(person), ...(person.aliases || []), ...royalAliases(person)].filter(Boolean);
  }
  // 役職は初期情報として扱える部分だけを使う：括弧書き（実態・後の転属など）と文章の形の説明は除く。
  function initialRole(role) {
    const text = String(role || '').replace(/（[^）]*）|\([^)]*\)/g, '').trim();
    return !text || /[、。]/.test(text) ? null : text;
  }
  // ネタバレ非表示の時は、名前・別名・所属・初期配置・分類だけを検索対象にする。
  // 表示中は、状態・念能力・備考・任務・配置先など後の話の情報も対象にする。
  // extra.initial / extra.later には画面側で整形した値（所属の表示名・守護霊獣など）を渡す。
  function searchFields(person, {revealed = false, extra = {}} = {}) {
    const names = searchNames(person);
    const initial = [...names, ...names.map(katakanaToRomaji), person.affiliation, initialRole(person.role),
      SEARCH_TYPE_LABELS[person.type], person.soldier_category, person.initial_room, ...(extra.initial || [])];
    if (!revealed) return initial.filter(Boolean);
    return [...initial, person.role, person.camp, person.nen_ability, person.nen_type, person.notes, person.mission, person.target,
      person.room, person.current_assignment, person.location, ...(extra.later || [])].filter(Boolean);
  }
  function buildSearchText(fields) {
    return fields.filter(Boolean).map(normalizeSearchText).filter(Boolean).join('|');
  }
  // 数字は前後に数字が続かない所だけに一致させる（「4王子」が「第14王子」、「101」が「1014号室」に当たらない）。
  function searchPattern(query) {
    const q = normalizeSearchText(query);
    if (!q) return null;
    const source = q.match(/\d+|\D+/g)
      .map(part => /^\d/.test(part) ? `(?<![0-9])${part}(?![0-9])` : part.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
      .join('');
    return new RegExp(source);
  }
  function matchesSearch(text, query) {
    const pattern = searchPattern(query);
    return !pattern || pattern.test(text);
  }
  function searchRank(person, query) {
    const q = normalizeSearchText(query);
    if (!q) return 0;
    const pattern = searchPattern(query);
    const names = searchNames(person).map(normalizeSearchText);
    const romaji = names.map(katakanaToRomaji);
    if (names.includes(q) || romaji.includes(q)) return 0;
    return [...names, ...romaji].some(n => pattern.test(n)) ? 1 : 2;
  }
  function questionSections(event, events = []) {
    const sections = new Map();
    const headings = {unreviewed:'その話時点の疑問（現在の解決状況は未判定）', open:'現在も未解決として登録', resolved:'後に判明した問い'};
    for (const text of event.mysteries || []) {
      const update = (event.mystery_updates || []).find(entry => entry.text === text);
      const heading = headings[update?.status || 'unreviewed'];
      const refs = (update?.related_event_ids || []).map(id => events.find(e => e.id === id));
      const basis = update && update.status !== 'unreviewed'
        ? `（${refs.length && refs.every(e => e?.verification_status === 'review_recorded') ? '確認記録あり' : '原作再照合待ち'}${update.review_note ? `：${update.review_note}` : ''}）` : '';
      if (!sections.has(heading)) sections.set(heading, []);
      sections.get(heading).push(text + basis);
    }
    if (event.editorial_questions?.length) sections.set('編集上の確認課題（作品内の謎とは別）', event.editorial_questions);
    return [...sections].map(([heading, lines]) => ({heading, lines}));
  }
  function dateCertainty(event) {
    if (event.date_certainty) return event.date_certainty;
    if (Number(event.chapter) >= 411) return 'provisional';
    return 'unknown';
  }
  function dateCertaintyLabel(event) {
    const labels = {confirmed: '', estimated: '日付推定', provisional: '日付暫定',
      unknown: event.day != null ? '日付の確度未確認' : '日付不明'};
    return labels[dateCertainty(event)] ?? '日付の確度未確認';
  }
  function dayLabel(event) {
    if (event.day == null) return event.relative_days_before_departure != null ? `出航${event.relative_days_before_departure}日前` : '';
    const day = `${event.day}日目`;
    return ({confirmed: day, estimated: `推定${day}`, provisional: `暫定${day}`, unknown: `${day}（確度未確認）`})[dateCertainty(event)];
  }
  return {assignmentRows, latestLocation, latestLocationLabel, groupLocationCandidates, readableSegments, dateCertainty, dateCertaintyLabel, dayLabel, claimRows, statusLabel, statusEditorialNote, searchRank, questionSections,
    normalizeSearchText, katakanaToRomaji, royalAliases, initialRole, searchFields, buildSearchText, searchPattern, matchesSearch};
});
