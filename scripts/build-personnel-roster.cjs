/* Build the departure ledger and anonymous people from the reviewed allocation.
 * Slot IDs remain stable when a name is identified: replace its character_id in
 * personnel_roster_overrides.json, then rebuild. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const counts = read('data/intake/initial_personnel_review_20261013.json');
const config = read('data/intake/initial_personnel_assignments_20261013.json');
const overrides = read('data/personnel_roster_overrides.json');
const original = read('data/characters.json').filter(p => p.generated_by !== 'personnel-roster');
for (const person of original) if (overrides.display_names?.[person.id]) person.display_name = overrides.display_names[person.id];
const people = new Map(original.map(p => [p.id, p]));
const queenRank = p => {
  const text = p?.affiliation || '';
  const numbered = text.match(/第([1-8一二三四五六七八])王妃/);
  if (numbered) return Number(numbered[1]) || '一二三四五六七八'.indexOf(numbered[1]) + 1;
  return original.find(q => q.type === 'queen' && text.includes(q.name.split('＝')[0]))?.rank || null;
};
const generated = [], members = [], projections = [], pools = [];
const reserved = new Set(config.shared_pools.flatMap(p => p.group_keys));
const used = new Set();
const nameCounters = new Map();
function shortName(prefix, role) {
  const base = `${prefix}${role}`;
  let n = (nameCounters.get(base) || 0) + 1;
  while ([...people.values()].some(p => (p.display_name || p.name) === `${base}${n}`)) n++;
  nameCounters.set(base, n);
  return `${base}${n}`;
}
function anonymous(id, name, ranks, category, queen, notes, projection = false) {
  const type = category === 'staff' ? 'unclassified' : category === 'attendants' ? 'attendant' : category === 'hunters' ? 'hunter' : 'soldier';
  const role = {staff:'私設兵・従事者（個人対応未確定）', attendants:'従事者', hunters:'護衛ハンター', private:'私設兵', monitors:'監視兵', maternal:'王妃所属兵'}[category];
  const prince = ranks.length === 1 ? counts.princes.find(p => p.rank === ranks[0]) : null;
  const record = {id, type, position_code: id, name, status: '未確認', is_hunter: type === 'hunter',
    role,
    affiliation: queen ? `第${queen}王妃所属兵` : null,
    camp: prince ? `${prince.name}陣営` : null,
    initial_room: prince ? `第1層 ${1000 + prince.rank}号室` : null,
    initial_room_basis: '人数枠の復元。個人の出航時在室を直接確認したものではない。',
    mission: category === 'staff' ? null : category === 'monitors' ? '監視' : type === 'attendant' ? '従事' : '護衛',
    soldier_category: queen ? '王妃所属兵' : category === 'private' ? '私設兵' : null,
    status_log: [], notes, is_placeholder: true, identity_status: 'provisional', is_count_only: true,
    role_evidence: `第374話の職種別人数と第360話の派遣制度を用いた人数枠の復元。${role}の個人を確認した記録ではない。氏名・顔・個別の登場場面は未確認。`,
    generated_by: 'personnel-roster', roster_projection: projection};
  if (projection) record.display_name = name.replace('監視兵', '監視枠');
  Object.assign(record, overrides.identity_updates?.[id] || {}, {id, generated_by: 'personnel-roster', roster_projection: projection});
  generated.push(record); people.set(id, record);
  return id;
}
function addGroup(key, ranks, category, capacity, known, queen = null, notes = '') {
  assert.ok(known.length <= capacity, `人数超過 ${key}`);
  const prefix = ranks.length === 1 ? counts.princes.find(p => p.rank === ranks[0]).name : '王室';
  const possibleQueens = category === 'monitors'
    ? Array.from({length: counts.princes.find(p => p.rank === ranks[0]).queen_rank - 1}, (_, i) => i + 1) : [];
  const assigned = new Set(known.map(id => queenRank(people.get(id))).filter(Boolean));
  const remainingQueens = possibleQueens.filter(q => !assigned.has(q));
  const unknownKnown = known.filter(id => !queenRank(people.get(id)));
  const ambiguous = category === 'monitors' && unknownKnown.length > 1;
  const poolId = ambiguous ? key : null;
  const groupIds = [];
  for (let i = 0; i < capacity; i++) {
    const slot = `INIT-${key.replaceAll('.', '-').toUpperCase()}-${String(i + 1).padStart(2, '0')}`;
    let id = overrides.slot_identities[slot] || known[i];
    let q = id ? queenRank(people.get(id)) : null;
    if (!id) {
      q = category === 'monitors' ? remainingQueens.shift() : queen;
      const label = {staff:'人員', attendants:'従事者', hunters:'護衛ハンター', private:'私設兵', monitors:'監視兵', maternal:'王妃所属兵'}[category];
      id = anonymous(slot, shortName(prefix, `${label}枠`),
        ranks, category, q, `出航時の人数枠を埋める仮登録。氏名・顔は未確認。${notes}`);
    }
    assert.ok(people.has(id), `不明なID ${id}`);
    assert.ok(!used.has(id), `二重計上 ${id}`); used.add(id);
    const entry = {slot_id: slot, character_id: id, initial: true, prince_ranks: ranks,
      queen_rank: q || queen, queen_pool: !q && ambiguous ? possibleQueens : [],
      identity_pool: poolId, group: category, basis: 'reconstructed', notes,
      history: overrides.history[id] || []};
    members.push(entry); groupIds.push(id);
  }
  if (ambiguous) {
    pools.push({id: key, character_ids: groupIds, queen_ranks: possibleQueens,
      note: '各王妃から1名ずつ。氏名・顔と所属王妃の対応は未確定。同じ人員を別人として足さない。'});
    for (const q of possibleQueens) {
      const id = `VIEW-Q${q}-${key.replaceAll('.', '-').toUpperCase()}`;
      anonymous(id, `${prefix}監視兵${q}`, ranks, category, q,
        `第${q}王妃からの1人分。個人対応は未確定。候補：${groupIds.map(id => people.get(id).name).join('、')}。全体名簿の同じ人員を所属王妃別に示す枠で、追加の別人ではありません。`, true);
      projections.push({character_id: id, queen_rank: q, pool_id: key, prince_ranks: ranks,
        inactive_from: ranks[0] === 14 ? 361 : null, inactive_status: '死亡'});
    }
  }
}
for (const row of config.princes) {
  const count = counts.princes.find(p => p.rank === row.rank);
  for (const group of row.groups) {
    if (reserved.has(group.key)) continue;
    const capacity = group.capacity_fields.reduce((sum, key) => sum + count[key], 0);
    const known = [...group.member_ids, ...(overrides.extra_initial_members[group.key] || [])]
      .filter(id => !overrides.exclude_initial_ids.includes(id));
    addGroup(group.key, [row.rank], group.key.split('.')[1], capacity, known,
      group.key.endsWith('.maternal') ? count.queen_rank : null, group.notes);
  }
}
for (const pool of config.shared_pools) {
  const capacity = pool.group_keys.reduce((sum, key) => {
    const [princeKey] = key.split('.');
    const prince = counts.princes.find(p => p.rank === Number(princeKey.slice(1)));
    const group = config.princes.find(p => p.rank === prince.rank).groups.find(g => g.key === key);
    return sum + group.capacity_fields.reduce((n, f) => n + prince[f], 0);
  }, 0);
  addGroup(pool.key, [12, 13], pool.key.split('.').at(-1), capacity, pool.member_ids,
    pool.key.endsWith('.maternal') ? 7 : null, pool.notes);
}
assert.equal(members.length, 230);
assert.equal(new Set(members.map(m => m.character_id)).size, 230);
const later = original.filter(p => !used.has(p.id) && ['soldier', 'attendant', 'hunter'].includes(p.type)
  && (p.type !== 'hunter' || /護衛|警護/.test(p.role || ''))
  && !p.is_identity_reference && !read('data/count_only_characters.json').ids.includes(p.id)
  && p.verification_status !== 'unverified').map(p => {
    const explicit = overrides.later_entries[p.id];
    return {character_id: p.id, initial: false, observed_from: explicit?.chapter || null,
      queen_rank: queenRank(p), prince_ranks: [], history: overrides.history[p.id] || [], basis: explicit?.basis || 'entry_unverified',
      notes: explicit?.notes || '初期230人の個人枠への対応と王子居住区の任務開始時点は未確認。全員表示では表示する。'};
  });
const roster = {version: 1, initial_total: 230, scope: '出航時230人の復元名簿。王族本人・マフィア・下層兵力を含む船全体の総数ではない。',
  members, later, identity_pools: pools, queen_projections: projections};
const api = require('../personnel-roster.js');
const events = read('data/events.json');
const snapshot = read('data/personnel_snapshots.json').snapshots.find(s => s.chapter === 374);
const report = [
  '# 出航時名簿と王妃別人数の照合', '',
  `出航時230枠。個人IDとの対応${members.filter(m => !people.get(m.character_id).is_count_only).length}枠、個人未同定${members.filter(m => people.get(m.character_id).is_count_only).length}枠。未同定枠は「個人未同定（人数枠）」として人物一覧に表示する。対応済みのIDにも初期配置の復元・作者設定表のみの人物を含み、全員の初期在室を個別確認したという意味ではない。`, '',
  '王妃別の個人未同定枠は全体名簿と同じ人員を示す。全体230枠へ追加しない。', '',
  '初期復元・原図記載・履歴上の停止なしは異なる集計です。停止なしには状態未確認を含み、稼働確認済み人数ではありません。原図との比較範囲・除外条件は未確定で、差を登録漏れとは扱いません。', '',
  '| 王妃 | 初期復元人数 | 第374話 原図記載人数 | 第374話 死亡・拘束・辞退・離脱の履歴なし | うち状態未確認 | 差（履歴−原図・参考） |',
  '|---|---:|---:|---:|---:|---:|'
];
for (let queen = 1; queen <= 7; queen++) {
  const diagram = api.diagramCount(snapshot, queen);
  const initial = api.select(roster, [...people.values()], {period:'departure',queen,events}).length;
  const count = api.counts(api.select(roster, [...people.values()], {period:'chapter-374',queen,events}));
  report.push(`| 第${queen}王妃 | ${initial} | ${diagram} | ${count.withoutStop} | ${count.unknown} | ${count.withoutStop - diagram} |`);
}
report.push('', '第1王妃の12→9は死亡2・拘束1で一致する復元案。ただし他の王妃は同じ減算で原図と一致しない。原図の数字を一律に現時点の稼働人数と読み替えない。第2王妃のロンギは初期の職種欄との対応も未確定。', '',
  `初期外・初期枠対応未確認の登録は${later.length}件。うち確認話数を指定した${later.filter(p => p.observed_from !== null).length}件を後の時点へ表示。残る${later.filter(p => p.observed_from === null).length}件は時点指定なしで表示し、未確認の加入時点を作らない。`, '',
  '履歴の空白期間に死亡・除籍・新しい配置を推定して追加しない。未登場枠の後の状態は未確認として表示する。', '');
const outputs = new Map([
  ['data/personnel_roster_report.md', report.join('\n')],
  ['data/personnel_roster.json', JSON.stringify(roster, null, 2) + '\n'],
  ['data/characters.json', JSON.stringify([...original, ...generated], null, 2) + '\n']
]);
for (const [file, expected] of outputs) {
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'), expected, `再生成が必要: ${file}`);
  else fs.writeFileSync(path.join(root, file), expected);
}
console.log(`PASS: 出航時${members.length}人、仮登録${generated.filter(p => !p.roster_projection).length}人、王妃別対応未同定枠${projections.length}件`);
