/* Shared public-record presentation for the directory, modal and static pages. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CharacterFacts = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  const localFieldEdited = (person,field) => Boolean(person.local_edit_fields?.includes(field));
  function publicRecord(person) {
    const {local_edited,local_edit_fields,local_public_values,...original}=person;
    return {...original,...local_public_values};
  }
  const localEditLabels = person => (person.local_edit_fields || []).map(field=>
    ({status:'状態',room:'部屋・現在地',role:'役割',nen_ability:'念能力',notes:'備考'})[field] || field);
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
    if(localFieldEdited(person,'room')) return {location:locationLabel(person.room) || '未設定',chapter:null,eventId:null,
      presence:'unknown',review:'unverified',locationStatus:'local',confirmed:null,candidates:[]};
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
    const placeStatus = event => ['recorded', 'original_unknown'].includes(event.location_status) ? event.location_status : 'estimated';
    if (latest) {
      // 場所そのものを画像で確認できた最後の記録（最後に登場した場面の場所が推定のときに併記する）。
      const confirmed = located.filter(e => placeStatus(e.event) === 'recorded').at(-1);
      return {location: locationLabel(latest.location), chapter: latest.event.chapter,
        eventId: latest.event.id, presence: latest.presence, review: latest.event.verification_status || 'unverified',
        locationStatus: placeStatus(latest.event),
        confirmed: confirmed ? {location: locationLabel(confirmed.location), chapter: confirmed.event.chapter,
          eventId: confirmed.event.id, presence: confirmed.presence} : null,
        candidates: matching.filter(e => e.presence === 'unknown' && compare(e.event, latest.event) > 0)
          .map(e => ({eventId: e.event.id, chapter: e.event.chapter, location: locationLabel(e.location)}))};
    }
    const candidate = matching.at(-1);
    if (candidate) return {location: locationLabel(candidate.location), chapter: candidate.event.chapter,
      eventId: candidate.event.id, presence: 'unknown', review: candidate.event.verification_status || 'unverified',
      locationStatus: placeStatus(candidate.event), confirmed: null,
      candidates: matching.filter(e => e !== candidate && e.location !== candidate.location
        && !before(e.event, candidate.event) && !before(candidate.event, e.event)
        && (e.event.day == null || candidate.event.day == null || (e.event.day === candidate.event.day
          && (minutes(e.event.time_start || e.event.time_estimate) == null || minutes(candidate.event.time_start || candidate.event.time_estimate) == null))))
        .map(e => ({eventId:e.event.id, chapter:e.event.chapter, location:locationLabel(e.location)}))};
    const location = person.room || person.location;
    return location ? {location: locationLabel(location), chapter: person.location_basis_chapter || null, eventId: null, presence: 'unknown', review: 'unverified', locationStatus: 'estimated', confirmed: null, candidates: []} : null;
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
  // 最後の所在の表示を部品に分ける。{text, eventId, chapter} の部品は根拠の出来事へのリンクにできる（画面ごとに描画）。
  // 場所を画像で確認できた記録（location_status: recorded）と、場所が推定の記録を言葉で区別する。
  function latestLocationParts(person, events) {
    if(localFieldEdited(person,'room')) return {main:[{text:`自分用の場所：${locationLabel(person.room) || '未設定'}（未照合）`}],confirmed:null,candidates:[]};
    const latest = latestLocation(person, events);
    if (!latest) return {main: [{text: '未登録'}], confirmed: null, candidates: []};
    const ref = (text, entry) => entry.eventId ? {text, eventId: entry.eventId, chapter: entry.chapter} : {text};
    const reviewNote = latest.review === 'review_recorded' ? '' : latest.review === 'hypothesis' ? '内容は推測' : '再照合待ち';
    const placeNote = latest.locationStatus === 'original_unknown' ? '場所は原作で示されない' : '場所は推定';
    let main;
    let confirmed = null;
    if (!latest.eventId) {
      main = [{text: `${latest.location}（${latest.chapter ? `第${latest.chapter}話時点の登録値` : '登録値'}・場所は未確認）`}];
    } else if (latest.presence === 'unknown') {
      main = [{text: `所在候補（在室は未確認）：${latest.location}（`}, ref(`第${latest.chapter}話時点`, latest),
        {text: `${reviewNote ? `・${reviewNote}` : ''}${latest.locationStatus === 'recorded' ? '' : `・${placeNote}`}）`}];
    } else if (latest.locationStatus === 'recorded') {
      main = [{text: `${latest.presence === 'body' ? '遺体の所在：' : ''}${latest.location}（`}, ref(`第${latest.chapter}話時点`, latest),
        {text: `${reviewNote ? `・${reviewNote}` : ''}・場所は画像で確認）`}];
    } else {
      main = [{text: latest.presence === 'body' ? '遺体が最後に描かれた場面：' : '最後に登場した場面：'}, ref(`第${latest.chapter}話`, latest),
        {text: `（${placeNote}：${latest.location}${reviewNote ? `／${reviewNote}` : ''}）`}];
      const c = latest.confirmed;
      confirmed = c
        ? [{text: '場所を確認できた最後の記録：'}, ref(`第${c.chapter}話`, c), {text: ` ${c.presence === 'body' ? '遺体：' : ''}${c.location}`}]
        : [{text: '場所を画像で確認できた記録はまだありません'}];
    }
    const candidates = groupLocationCandidates(latest.candidates);
    return {main, confirmed, candidates};
  }
  const partsText = parts => (parts || []).map(part => part.text).join('');
  function latestLocationLabel(person, events) {
    const {main, confirmed, candidates} = latestLocationParts(person, events);
    const pending = candidates.length ? `。ほかに所在未判定の記録：${candidates.map(group => group.text).join('／')}` : '';
    return `${partsText(main)}${confirmed ? `。${partsText(confirmed)}` : ''}${pending}`;
  }
  // 能力欄の編集上の注記。文字列・配列のどちらでも受け付け、「能力欄の編集注記：」を付けた行にする。
  function nenAbilityEditorialLines(person) {
    if(localFieldEdited(person,'nen_ability')) return ['能力欄は自分用の変更です。公開データの能力名・系統・出典は、変更後の能力の裏付けではありません。'];
    const value = person?.nen_ability_editorial;
    return (Array.isArray(value) ? value : [value]).map(v => String(v ?? '').trim()).filter(Boolean).map(v => `能力欄の編集注記：${v}`);
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
    if(localFieldEdited(person,'status')) return `${person.status || '未設定'}（自分用の変更・未照合）`;
    const log = person.status_log?.at(-1);
    const event = events.find(e => e.id === log?.event_id);
    const parts = [log?.chapter ? `第${log.chapter}話時点` : null,
      event?.verification_status === 'hypothesis' ? '内容は推測' : event && event.verification_status !== 'review_recorded' ? '再照合待ち' : null].filter(Boolean);
    return `${person.status || '未登録'}${parts.length ? `（${parts.join('・')}）` : ''}${person.status_review_note ? `。${person.status_review_note}` : ''}`;
  }
  // 編集者向けの詳しい根拠表示。読者向けの本文ではなく「編集状況」欄やツールチップで使う。
  function statusEditorialNote(person, events) {
    if(localFieldEdited(person,'status')) return '状態は自分用の変更（未照合）です。元の確認話数・出来事は、変更後の状態の根拠ではありません。';
    const log = person.status_log?.at(-1);
    const event = events.find(e => e.id === log?.event_id);
    return `状態の確認話数：${log?.chapter ? `第${log.chapter}話` : '未登録'}／根拠の出来事：${event ? `${event.id}（${reviewLabel(event)}）` : '未照合'}`;
  }
  function familyHistoryUnorganized(person) {
    return Boolean(person.roster_view?.public_data && !person.historical_known_fields?.some(field=>['parent_ids','children','known_half_sibling_ids','known_sibling_ids','public_mother_id','reported_biological_mother_id','suggested_father_id','suggested_child_id'].includes(field)));
  }
  function familyRelations(person, people) {
    const historical=person.roster_view?.public_data;
    if (familyHistoryUnorganized(person)) return [];
    const byId = new Map(people.map(p => [p.id,p]));
    const relations = new Map();
    const add = (id, kind, group = 'parent-child', speculative = false, extra = {}) => {
      if (id !== person.id && byId.has(id)) relations.set(id, {id,kind,group,speculative,...extra});
    };
    // 王子の公的な父と実父は別問題。従来同様、父を自動的な実親タグへ変換しない。
    let parents = person.parent_ids || [];
    if (!person.parent_ids && person.type === 'prince') parents = people.filter(p=>p.type==='queen' && (p.children||[]).includes(person.id)).map(p=>p.id);
    if (!person.parent_ids && ['P05-G01','P05-G02'].includes(person.id)) parents = ['BYD-001'];
    parents.filter(id=>id!=='KNG-001').forEach(id=>add(id,byId.get(id)?.type==='queen'?'母':'親'));
    if (person.type === 'queen' || person.id === 'BYD-001' || (historical && person.historical_known_fields?.includes('children'))) {
      (person.children || (person.id==='BYD-001' ? ['P05-G01','P05-G02'] : [])).forEach(id=>add(id,'子'));
      if (!historical) people.filter(p=>p.public_mother_id===person.id).forEach(p=>add(p.id,'公的な子'));
      if (!historical) people.filter(p=>p.reported_biological_mother_id===person.id).forEach(p=>add(p.id,'実子説','parent-child',true));
    }
    if (person.public_mother_id) add(person.public_mother_id,'公的な母');
    if (person.reported_biological_mother_id) add(person.reported_biological_mother_id,'実母説','parent-child',true);
    if (person.suggested_father_id) add(person.suggested_father_id,'実父説','parent-child',true);
    if (person.suggested_child_id) add(person.suggested_child_id,'実子説','parent-child',true);
    (person.known_half_sibling_ids || (person.known_half_sibling_id?[person.known_half_sibling_id]:[])).forEach(id=>add(id,'異母兄弟','siblings'));
    (person.known_sibling_ids||[]).forEach(id=>add(id,'兄弟（母親の同異は未確認）','siblings'));
    (person.nominal_parent_relations||[]).forEach(r=>add(r.id,'父（名義上）','parent-child',false,{nominal:true,note:r.note}));
    if (!historical) people.forEach(child=>(child.nominal_parent_relations||[]).filter(r=>r.id===person.id)
      .forEach(r=>add(child.id,'子（名義上）','parent-child',false,{nominal:true,note:r.note})));
    return [...relations.values()];
  }
  function familyRelationLabel(relation) {
    return relation.group === 'siblings' ? '兄弟姉妹' : relation.group === 'parent-child' ? (relation.nominal ? '親子（名義上）' : '親子') : '血縁';
  }
  function isConfirmedNenUser(person) {
    if(localFieldEdited(person,'nen_ability')) return isConfirmedNenUser(publicRecord(person));
    if (person.verification_status === 'unverified') return false;
    if (person.nen_status) return person.nen_status === 'confirmed';
    if (typeof person.nen_user === 'boolean') return person.nen_user;
    if (/^非念能力者/.test(person.nen_type || '')) return false;
    if (person.nen_type && !/^不明/.test(person.nen_type)) return true;
    const ability = person.nen_ability || '';
    return Boolean(ability && !/^(?:非念能力者|念能力は持たない|詳細不明$|本人の念使用.*未確認|本人固有の念能力.*未確認)/.test(ability));
  }
  function nenKnowledgeLabel(person, compact = false) {
    if(localFieldEdited(person,'nen_ability')) return '自分用の能力欄：未照合（公開データの念使用確認とは別）';
    if (person.nen_status === 'historical_unorganized') return '念：この時点の能力情報は未整理';
    const state = person.verification_status === 'unverified' ? 'unknown' : person.nen_status || (isConfirmedNenUser(person) ? 'confirmed' : 'unknown');
    const labels = compact
      ? {confirmed:'念：確認済み', unknown:'念：未確認', unavailable_confirmed:'念：使用不可の記録', not_awakened_confirmed:'念：未覚醒の記録'}
      : {confirmed:'念使用：確認済み', unknown:'念使用：未確認（使用不可とは限りません）', unavailable_confirmed:'念使用：使用不可の記録あり', not_awakened_confirmed:'念使用：未覚醒の記録あり'};
    return (labels[state] || labels.unknown) + (person.nen_status_chapter ? `（第${person.nen_status_chapter}話${compact ? '' : '時点'}）` : '');
  }
  function nenTypeLabel(person) {
    if(localFieldEdited(person,'nen_ability')) return `変更した能力は未照合（公開データの系統：${nenTypeLabel(publicRecord(person))}）`;
    if (person.nen_status === 'historical_unorganized') return 'この時点の能力情報は未整理';
    return person.nen_type_detail || person.nen_type || '未確認';
  }
  function tagIsSpoiler(tag, person = {}) {
    if (!tag) return false;
    if (['血縁', '状態', '念', '念の系統', '念講習会'].includes(tag.category)) return true;
    const secretMission = value => /暗殺|呪殺|憑依|潜入/.test(value || '');
    if (tag.category === '任務' && secretMission(tag.label)) return true;
    if (tag.id?.startsWith('possession-target-')) return true;
    return ['対象', '護衛'].includes(tag.category) && Boolean(secretMission(person.mission) ||
      person.target_history?.length || person.assignment_history?.length);
  }
  function registrationNotice(person) {
    if (person.roster_projection) return '王妃所属兵の対応未同定枠です。全体名簿と同じ人員を表し、別人として人数に加算しません。';
    if (person.is_count_only) return '氏名・顔との対応が未確認の人数枠です。登場確認済みの個人とは区別した仮登録です。';
    if (person.identity_status === 'unnamed_confirmed') return '原作で顔と所属を確認した氏名未判明の人物です。番号は識別用の仮称で、本名や現在の生死を示しません。';
    if (person.verification_status === 'unverified') return '出典未確認の旧登録です。氏名・所属・能力を確認済みの人物情報として扱わないでください。';
    if (person.identity_status === 'provisional') return '人物の同定は暫定です。詳細で根拠を確認できます。';
    if (person.generated_by) return '人数資料から復元した仮登録です。個人の氏名・容姿・出航時の在室を確認したものではありません。';
    if (person.is_identity_reference) return '顔の対応を確認するための仮登録です。既存の名前付き人物と重複する可能性があり、人数に加算しません。';
    return '';
  }
  function statusHistoryRows(person, events) {
    return (person.status_log || []).map(log => {
      const event = events.find(e => e.id === log.event_id);
      return {...log, text: `${log.chapter ? `第${log.chapter}話` : '話数未登録'}：${log.status}${log.cause ? ` — ${log.cause}` : ''}`, review: event ? reviewLabel(event) : '根拠の出来事は未紐付け'};
    });
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
    mercenary:'傭兵', expedition_member:'探検隊関係者', mafia:'マフィア', phantom_troupe:'幻影旅団', official:'司法・政府', unclassified:'関係者 職種未確認'};
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
  function basicRole(person) {
    const role=initialRole(person.role);
    const secret=tagIsSpoiler({category:'任務',label:person.mission},person);
    return role && !(secret && role.includes(person.mission)) ? role : null;
  }
  // ネタバレ非表示の時は、名前・別名・所属・初期配置・分類だけを検索対象にする。
  // 表示中は、状態・念能力・備考・任務・配置先など後の話の情報も対象にする。
  // extra.initial / extra.later には画面側で整形した値（所属の表示名・守護霊獣など）を渡す。
  function searchFields(person, {revealed = false, extra = {}} = {}) {
    const names = searchNames(person);
    const initial = [...names, ...names.map(katakanaToRomaji), person.affiliation, basicRole(person),
      SEARCH_TYPE_LABELS[person.type], person.soldier_category, person.initial_room, ...(extra.initial || [])];
    if (!revealed) return initial.filter(Boolean);
    const status = !person.roster_view?.public_data || person.historical_known_fields?.includes('status') ? person.status : null;
    return [...initial, status, person.role, person.camp, person.nen_ability, person.nen_ability_name, person.nen_type, person.nen_type_detail, person.notes, person.mission, person.target,
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
    return searchPatterns(query).every(pattern => pattern.test(text));
  }
  function searchPatterns(query) {
    return String(query || '').split(/\s+/).map(searchPattern).filter(Boolean);
  }
  function searchRank(person, query) {
    const q = normalizeSearchText(query);
    if (!q) return 0;
    const patterns = searchPatterns(query);
    const names = searchNames(person).map(normalizeSearchText);
    const romaji = names.map(katakanaToRomaji);
    if (names.includes(q) || romaji.includes(q)) return 0;
    return [...names, ...romaji].some(n => patterns.some(pattern => pattern.test(n))) ? 1 : 2;
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
  return {localFieldEdited,publicRecord,localEditLabels,assignmentRows, latestLocation, latestLocationLabel, latestLocationParts, partsText, nenAbilityEditorialLines, groupLocationCandidates, readableSegments, dateCertainty, dateCertaintyLabel, dayLabel, claimRows, statusLabel, statusEditorialNote, familyRelations, familyRelationLabel, familyHistoryUnorganized, isConfirmedNenUser, nenKnowledgeLabel, nenTypeLabel, tagIsSpoiler, registrationNotice, statusHistoryRows, searchRank, questionSections,
    normalizeSearchText, katakanaToRomaji, royalAliases, initialRole, basicRole, searchFields, buildSearchText, searchPattern, searchPatterns, matchesSearch};
});
