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
  function latestLocationLabel(person, events) {
    const latest = latestLocation(person, events);
    if (!latest) return '未確認（場所・確認話数とも未登録）';
    const review = latest.review === 'review_recorded' ? '原作確認記録あり'
      : latest.review === 'hypothesis' ? '内容は推測' : '原作再照合待ち';
    const kind = latest.presence === 'body' ? '遺体の所在：' : latest.presence === 'unknown' ? '所在候補（本人の在室未確認）：' : '';
    const pending = latest.candidates?.length ? `。所在未判定の関係記録：${latest.candidates.map(e => `第${e.chapter}話 ${e.location}（所在未判定）`).join('／')}` : '';
    return `${kind}${latest.location}（${latest.chapter ? `第${latest.chapter}話時点` : '確認話数未登録・人物台帳の値'}／${review}）${pending}`;
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
    const basis = log?.chapter ? `第${log.chapter}話の登録` : '確認話数未登録';
    return `${person.status || '未登録'}（${basis}／${event ? reviewLabel(event) : '状態の根拠未照合'}）${person.status_review_note ? `。${person.status_review_note}` : ''}`;
  }
  function searchRank(person, query) {
    const names = [person.name, person.display_name, ...(person.aliases || [])].filter(Boolean).map(n => n.toLowerCase());
    const q = query.trim().toLowerCase();
    return !q ? 0 : names.includes(q) ? 0 : names.some(n => n.includes(q)) ? 1 : 2;
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
  return {assignmentRows, latestLocation, latestLocationLabel, dateCertainty, dateCertaintyLabel, dayLabel, claimRows, statusLabel, searchRank, questionSections};
});
