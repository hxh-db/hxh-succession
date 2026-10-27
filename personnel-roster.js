(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PersonnelRoster = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const chapterFor = (period, latest = 420) => period === 'departure' ? 0 : period === 'latest' ? latest : /^chapter-\d+$/.test(period) ? Number(period.slice(8)) : null;
  // 希望の表明だけでは、実際に配置から外れたと数えない。
  const isInactive = status => /死亡|拘束|辞退|離脱/.test(String(status || '').replace(/離脱希望（実際の離脱は未確認）/g, ''));
  function historicalNen(person, chapter) {
    const entry = (person.nen_history || []).filter(item => item.chapter <= chapter)
      .sort((a,b) => a.chapter - b.chapter).at(-1);
    return {
      nen_ability: entry?.nen_ability || null, nen_ability_name: entry?.nen_ability_name || null,
      nen_type: entry?.nen_type || null, nen_type_detail: null,
      nen_status: entry?.nen_status || 'historical_unorganized', nen_user: entry ? entry.nen_status === 'confirmed' : null,
      nen_status_chapter: entry?.chapter || null, nen_role: null, nen_origin: null,
      nen_ability_editorial: null, nen_ability_image: null, nen_ability_image_source: null,
      nen_history_view: entry ? {chapter:entry.chapter, basis:entry.basis, source_event_ids:entry.source_event_ids} : null
    };
  }
  function state(person, member, chapter, events = []) {
    if (chapter === null) return {status: person.status, inactive: isInactive(person.status), assignment: person.current_assignment || person.camp || '', chapter: null};
    // 出航時の復元在籍と、その後の生存・稼働確認は別の情報。
    let status = chapter === 0 ? '在籍（復元）' : '状態未確認';
    const changes = [
      ...(member.history || []).filter(log => log.status).map(log => ({...log, kind: 'status'})),
      ...(person.status_log || []).filter(log => Number.isInteger(log.chapter)).map(log => ({...log, kind: 'status'})),
      ...events.flatMap(event => (event.status_effects || []).filter(effect => effect.character === person.id).map(effect => ({...effect, chapter: event.chapter, kind: 'status'})))
    ].filter(log => log.chapter <= chapter).sort((a, b) => a.chapter - b.chapter);
    changes.forEach(log => {status = log.status;});
    const history = (person.assignment_history || []).filter(log => log.chapter <= chapter).sort((a,b) => a.chapter - b.chapter);
    const ranks = member.prince_ranks || [];
    let assignment = ranks.length === 1 ? `第${ranks[0]}王子` : ranks.length ? ranks.map(rank => `第${rank}王子`).join('／') + '（出身未確定）' : '配置未確認';
    if (history.length) assignment = history.at(-1).label + '：' + history.at(-1).prince_id;
    (member.history || []).filter(log => log.chapter <= chapter && log.assignment).sort((a,b) => a.chapter-b.chapter).forEach(log => {assignment = log.assignment;});
    return {status, inactive: isInactive(status), assignment, chapter};
  }
  function select(roster, people, options = {}) {
    const {period = 'all', queen = null, latest = 420, events = []} = options;
    const chapter = chapterFor(period, latest);
    const byId = new Map(people.map(person => [person.id, person]));
    const available = [...(chapter !== null && chapter > 0 && chapter < 359 ? [] : roster.members), ...roster.later.filter(m => chapter === null || (m.observed_from !== null && m.observed_from <= chapter && chapter !== 0))];
    const result = available.filter(m => !queen || m.queen_rank === queen).map(member => ({member, person: byId.get(member.character_id)})).filter(item => item.person);
    if (queen && !(chapter !== null && chapter > 0 && chapter < 359)) for (const projection of roster.queen_projections.filter(p => p.queen_rank === queen)) {
      const person = byId.get(projection.character_id);
      if (person) result.push({member: {...projection, initial: true, basis: 'pooled_identity', observed_from: 0}, person});
    }
    return result.map(({member, person}) => {
      const historical = chapter !== null && period !== 'latest';
      if(historical && person.local_edited) {
        const {local_edited,local_edit_fields,local_public_values,...publicData}=person;
        person={...publicData,...local_public_values};
      }
      let selected = state(person, member, chapter, events);
      if (member.inactive_from && (chapter === null || chapter >= member.inactive_from)) selected = {...selected, status: member.inactive_status, inactive: true};
      let rank = member.prince_ranks?.length === 1 ? member.prince_ranks[0] : null;
      const assignment = (person.assignment_history || []).filter(log => chapter !== null && log.chapter <= chapter).sort((a,b) => a.chapter-b.chapter).at(-1);
      if (assignment?.prince_id) rank = Number(assignment.prince_id.slice(1));
      const prince = people.find(p => p.type === 'prince' && p.rank === rank);
      const initialRank = member.prince_ranks?.length === 1 ? member.prince_ranks[0] : null;
      const initialRoom = person.initial_room || (initialRank ? `第1層 ${1000 + initialRank}号室` : null);
      const selectedRoom = rank ? `第1層 ${1000 + rank}号室` : null;
      const assignmentLabel = selected.assignment.replace(/\bP\d{2}\b/g, id => {
        const royal = byId.get(id);
        return royal ? `第${royal.rank}王子${(royal.display_name || royal.name).replace(/＝ホイコーロ$/, '')}` : '担当未確認';
      });
      const eventById = new Map(events.map(event => [event.id, event]));
      const claimsAtChapter = (person.review_claims || []).filter(claim =>
        claim.event_ids?.length && claim.event_ids.every(id => eventById.has(id) && eventById.get(id).chapter <= chapter)
        && [...(claim.text || '').matchAll(/第?(\d{3})話/g)].every(match => Number(match[1]) <= chapter));
      const ability = historical ? historicalNen(person, chapter) : null;
      if (ability?.nen_history_view) claimsAtChapter.push({text:`第${ability.nen_history_view.chapter}話までに読者へ示された能力情報：${ability.nen_history_view.basis}`,event_ids:ability.nen_history_view.source_event_ids});
      return {...person, ...(historical ? {
        status: selected.status, room: selectedRoom, initial_room: initialRoom, current_assignment: assignmentLabel,
        camp: prince?.camp || null, target: rank ? `第${rank}王子` : null,
        role: ({monitors:'監視兵',private:'私設兵',maternal:'王妃所属兵',attendants:'従事者',hunters:'ハンター',staff:'職種未確認の人員枠'})[member.group] || '役割未整理（選択時点）',
        mission: member.group === 'monitors' ? '監視' : null,
        role_evidence: person.source_chapter && person.source_chapter <= chapter ? person.role_evidence : null,
        assignment_history: (person.assignment_history || []).filter(log => log.chapter <= chapter),
        status_log: (person.status_log || []).filter(log => log.chapter <= chapter),
        claim_history: [], target_history: [], location: null, location_basis_chapter: null,
        review_claims: claimsAtChapter, reference_images: [], spoiler_notes: null, faction_note: null,
        nen_ability_editorial: null, status_review_note: null,
        notes: `選択時点：${assignmentLabel}。初期配置・役割には名簿からの復元を含み、個人の出航時在室をすべて確認済みという意味ではありません。能力は選んだ話数までに読者へ判明した内容のうち、出典を整理した範囲を表示します。`,
        ...ability
      } : {}), roster_view: {...selected, assignment: assignmentLabel, period, public_data:historical, initial: member.initial, basis: member.basis, slot_id: member.slot_id || null},
        roster_member: member};
    });
  }
  function counts(people) {
    const stopped = people.filter(p => p.roster_view.inactive).length;
    const unknown = people.filter(p => !p.roster_view.inactive && /未確認|復元/.test(p.roster_view.status || '')).length;
    return {total: people.length, stopped, withoutStop: people.length - stopped, unknown};
  }
  function diagramCount(snapshot, queen) {
    const placements = (snapshot?.princes || []).flatMap(p => p.queen_deployments).filter(d => d.queen_rank === queen);
    const monitoring = placements.filter(d => d.purpose === '下位王子の監視');
    if (new Set(monitoring.map(d => d.count)).size > 1) throw new Error(`第${queen}王妃の原図監視人数が不一致`);
    return (monitoring[0]?.count || 0) + placements.filter(d => d.purpose !== '下位王子の監視').reduce((n,d) => n + d.count, 0);
  }
  return {chapterFor, state, select, counts, diagramCount, historicalNen};
});
