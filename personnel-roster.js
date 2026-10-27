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
  const identityFields = ['id','name','display_name','aliases','image','image_crop','image_source','image_source_chapter','avatar_zoom','image_zoom',
    'is_count_only','is_placeholder','identity_status','generated_by','roster_projection','is_identity_reference','verification_status','source_chapter','setting_only'];
  const factFields = ['type','soldier_category','is_hunter','affiliation','camp','queen','role','mission','target','room','initial_room','current_assignment',
    'parent_ids','children','known_half_sibling_ids','known_sibling_ids','public_mother_id','reported_biological_mother_id','suggested_father_id','suggested_child_id','nen_role'];
  function historicalFacts(person, chapter) {
    const values = {}, entries = (person.fact_history || []).filter(entry => entry.chapter <= chapter).sort((a,b)=>a.chapter-b.chapter);
    for (const entry of entries) for (const [field,value] of Object.entries(entry.values)) if (factFields.includes(field)) values[field] = value;
    return {values,entries};
  }
  function projectPerson(source, {member = null, period = 'all', latest = 420, events = [], people = []} = {}) {
    const chapter = chapterFor(period, latest), historical = chapter !== null && period !== 'latest';
    if (!member && !historical) return source;
    const person = historical && source.local_edited ? {...source,...source.local_public_values} : source;
    const frame = member || {history:[],prince_ranks:[],initial:false,basis:'outside_ledger'};
    let selected = state(person, frame, chapter, events);
    if (frame.inactive_from && (chapter === null || chapter >= frame.inactive_from)) selected = {...selected,status:frame.inactive_status,inactive:true};
    const byId = new Map(people.map(person=>[person.id,person]));
    const label = text => text.replace(/\bP\d{2}\b/g,id=>{
      const royal=byId.get(id);return royal ? `第${royal.rank}王子${(royal.display_name||royal.name).replace(/＝ホイコーロ$/,'')}` : '担当未確認';
    });
    if (!historical) return {...person,roster_view:{...selected,assignment:label(selected.assignment),period,public_data:false,initial:frame.initial,basis:frame.basis,slot_id:frame.slot_id||null},roster_member:frame};
    const {values,entries} = historicalFacts(person,chapter);
    const assignments = (person.assignment_history||[]).filter(log=>log.chapter<=chapter).sort((a,b)=>a.chapter-b.chapter);
    const changes = [...assignments.map(log=>({...log,assignment:`${log.label}：${log.prince_id}`})),
      ...(frame.history||[]).filter(log=>log.chapter<=chapter&&log.assignment)].sort((a,b)=>a.chapter-b.chapter);
    const last = changes.at(-1), prince = last?.prince_id ? byId.get(last.prince_id) : null;
    const initial = assignments.find(log=>log.label==='初期');
    const assignment = label(last?.assignment || values.current_assignment || '配置未整理（選択時点）');
    selected = {...selected,assignment};
    const eventById=new Map(events.map(event=>[event.id,event]));
    const claims=(person.review_claims||[]).filter(claim=>claim.event_ids?.length&&claim.event_ids.every(id=>eventById.has(id)&&eventById.get(id).chapter<=chapter)
      && [...(claim.text||'').matchAll(/第?(\d{3})話/g)].every(match=>Number(match[1])<=chapter));
    for(const entry of entries) claims.push({text:`第${entry.chapter}話までの確認記録：${entry.basis}`,event_ids:entry.source_event_ids});
    const ability=historicalNen(person,chapter);
    if(ability.nen_history_view) claims.push({text:`第${ability.nen_history_view.chapter}話までに読者へ示された能力情報：${ability.nen_history_view.basis}`,event_ids:ability.nen_history_view.source_event_ids});
    const known=new Set(Object.keys(values));
    if ((person.status_log||[]).some(log=>Number.isInteger(log.chapter)&&log.chapter<=chapter) || (frame.history||[]).some(log=>log.status&&log.chapter<=chapter)
      || events.some(event=>event.chapter<=chapter&&(event.status_effects||[]).some(effect=>effect.character===person.id))) known.add('status');
    if(initial) known.add('initial_room');
    if(last) ['current_assignment','camp','room','target'].forEach(field=>known.add(field));
    return {...Object.fromEntries(identityFields.filter(field=>Object.hasOwn(person,field)).map(field=>[field,person[field]])),
      ...(['prince','queen'].includes(person.type) ? {identity_title:`第${person.rank}${person.type==='prince'?'王子':'王妃'}${person.display_name||person.name.replace(/＝ホイコーロ$/,'')}`} : {}),
      type:null,is_hunter:null,affiliation:null,soldier_category:null,role:null,mission:null,queen:null,
      parent_ids:[],children:[],known_half_sibling_ids:[],known_sibling_ids:[],
      ...ability,...values,
      status:selected.status,room:last ? last.room||null : values.room||null,
      initial_room:values.initial_room||initial?.room||null,current_assignment:last ? assignment : values.current_assignment||null,
      camp:last ? prince?.camp||null : values.camp||null,target:last ? (prince ? `第${prince.rank}王子` : null) : values.target||null,
      role_evidence:entries.filter(entry=>Object.hasOwn(entry.values,'role')).at(-1)?.basis||null,
      assignment_history:assignments.map(log=>Object.fromEntries(['chapter','label','prince_id','room','event_id'].filter(key=>Object.hasOwn(log,key)).map(key=>[key,log[key]]))),
      status_log:(person.status_log||[]).filter(log=>Number.isInteger(log.chapter)&&log.chapter<=chapter).map(log=>Object.fromEntries(['chapter','status','event_id'].filter(key=>Object.hasOwn(log,key)).map(key=>[key,log[key]]))),
      review_claims:claims,reference_images:[],historical_known_fields:[...known],
      notes:null,
      roster_view:{...selected,period,public_data:true,initial:frame.initial,basis:frame.basis,slot_id:frame.slot_id||null},roster_member:frame};
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
    return result.map(({member,person})=>projectPerson(person,{member,period,latest,events,people}));
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
  return {chapterFor, state, select, counts, diagramCount, historicalNen, historicalFacts, projectPerson, factFields};
});
