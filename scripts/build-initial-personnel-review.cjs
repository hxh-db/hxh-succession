/* Reconcile initial-allocation candidates without changing the public character roster. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const INPUT = 'data/intake/initial_personnel_assignments_20261013.json';
const OUTPUT = 'data/intake/initial_personnel_coverage_20261013';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const config = read(INPUT);
const counts = read(config.counts_file);
const characters = read('data/characters.json').filter(person => person.generated_by !== 'personnel-roster');
const characterMap = new Map(characters.map(person => [person.id, person]));
const countOnly = new Set(read('data/count_only_characters.json').ids);
const imageMap = new Map(read('data/character_images.json').map(item => [item.id, item.image]));
const classifications = new Map();
const groups = new Map();
const label = id => `${characterMap.get(id).name}（${id}）`;
const link = id => `[${label(id)}](../../characters/${id}/index.html)`;
function classify(id, review) {
  assert.ok(characterMap.has(id), `存在しない人物ID: ${id}`);
  assert.ok(!classifications.has(id), `人物IDの重複計上: ${id}`);
  classifications.set(id, review);
}
function candidate(id) {
  const person = characterMap.get(id);
  assert.ok(person, `存在しない人物ID: ${id}`);
  assert.ok(!countOnly.has(id), `人数だけの旧枠を個人同定済み扱いにしない: ${id}`);
  assert.ok(!person.is_identity_reference || person.setting_only, `未同定の顔資料を別人として加算しない: ${id}`);
  return {
    id, name: person.name,
    identity_basis: person.setting_only ? 'author_setting_roster' : person.is_placeholder ? 'unnamed_face_or_presence_record' : 'named_character_record',
    initial_allocation_status: 'reconstructed',
    body_mapping: person.author_setting?.body_mapping || (imageMap.has(id) || person.image ? 'image_registered' : 'image_unmapped'),
    qualification_at_departure: 'unreviewed'
  };
}
assert.equal(config.princes.length, 14);
assert.equal(new Set(config.princes.map(row => row.rank)).size, 14);
const princes = config.princes.map(row => {
  const initial = counts.princes.find(prince => prince.rank === row.rank);
  assert.ok(initial);
  const usedFields = new Set();
  const groupResults = row.groups.map(group => {
    assert.ok(!groups.has(group.key), `グループIDの重複: ${group.key}`);
    group.capacity_fields.forEach(field => {
      assert.ok(!usedFields.has(field), `初期人数の分類の二重加算: ${row.rank}/${field}`);
      usedFields.add(field);
    });
    const capacity = group.capacity_fields.reduce((sum, field) => {
      assert.ok(Number.isInteger(initial[field]) && initial[field] >= 0, field);
      return sum + initial[field];
    }, 0);
    const members = group.member_ids.map(id => {
      const member = candidate(id);
      if (group.key.endsWith('.private') || group.key.endsWith('.staff')) {
        const person = characterMap.get(id);
        assert.ok(person.type === 'attendant' || person.soldier_category === '私設兵',
          `王妃所属兵等を私設兵・従事者の枠へ誤配分しない: ${group.key}/${id}`);
      }
      classify(id, { status: 'allocation_candidate', prince_rank: row.rank, group_key: group.key });
      return member;
    });
    assert.ok(members.length <= capacity, `人数超過: ${group.key} (${members.length}/${capacity})`);
    const result = {
      key: group.key, label: group.label, capacity,
      candidate_count: members.length, unresolved_slots_before_shared_pools: capacity - members.length,
      members, notes: group.notes
    };
    groups.set(group.key, result);
    return result;
  });
  const capacity = groupResults.reduce((sum, group) => sum + group.capacity, 0);
  assert.equal(capacity, initial.initial_total, `初期人数の内訳が欠落: 第${row.rank}王子`);
  const candidateCount = groupResults.reduce((sum, group) => sum + group.candidate_count, 0);
  return {
    rank: row.rank, name: initial.name, capacity, candidate_count: candidateCount,
    unresolved_slots_before_shared_pools: capacity - candidateCount,
    author_setting_only_count: groupResults.flatMap(group => group.members).filter(member => member.identity_basis === 'author_setting_roster').length,
    groups: groupResults
  };
});
const pooledGroups = new Set();
const sharedPools = config.shared_pools.map(pool => {
  const capacity = pool.group_keys.reduce((sum, key) => {
    assert.ok(groups.has(key), `共有先グループがない: ${key}`);
    assert.ok(!pooledGroups.has(key), `同じ枠に複数の共有候補群: ${key}`);
    pooledGroups.add(key);
    return sum + groups.get(key).unresolved_slots_before_shared_pools;
  }, 0);
  const members = pool.member_ids.map(id => {
    const member = candidate(id);
    classify(id, { status: 'shared_origin_candidate', pool_key: pool.key, group_keys: pool.group_keys });
    return member;
  });
  assert.ok(members.length <= capacity, `共有枠の人数超過: ${pool.key}`);
  return { key: pool.key, label: pool.label, group_keys: pool.group_keys, capacity,
    candidate_count: members.length, unresolved_slots: capacity - members.length, members, notes: pool.notes };
});
config.record_reviews.forEach(review => review.ids.forEach(id => {
  classify(id, { status: review.status, target: review.target || null, reason: review.reason });
}));
const outside = new Set(config.out_of_scope_personnel_ids || []);
outside.forEach(id => classify(id, { status: 'outside_initial_prince_scope', reason: '国王付き・協会の独立任務・船外関係者・国王軍等。14王子の初期同行人員への所属を確認していない。' }));
const unreviewed = characters.filter(person => ['soldier', 'hunter', 'attendant'].includes(person.type) && !classifications.has(person.id));
assert.equal(unreviewed.length, 0, `未分類の人員レコード: ${unreviewed.map(person => label(person.id)).join(' / ')}`);
const candidateCount = princes.reduce((sum, prince) => sum + prince.candidate_count, 0);
const sharedCount = sharedPools.reduce((sum, pool) => sum + pool.candidate_count, 0);
const initialCount = princes.reduce((sum, prince) => sum + prince.capacity, 0);
const summary = {
  initial_slots: initialCount,
  candidates_assigned_to_prince: candidateCount,
  shared_origin_candidates: sharedCount,
  individual_candidates: candidateCount + sharedCount,
  unresolved_individual_slots: initialCount - candidateCount - sharedCount,
  author_setting_only_candidates: princes.reduce((sum, prince) => sum + prince.author_setting_only_count, 0),
  existing_personnel_records_reviewed: characters.filter(person => ['soldier', 'hunter', 'attendant'].includes(person.type)).length,
  public_character_records: characters.length,
  count_only_records: countOnly.size
};
assert.equal(initialCount, counts.totals.initial);
assert.equal(summary.individual_candidates + summary.unresolved_individual_slots, summary.initial_slots);
const recordReviews = characters.map(person => ({
  id: person.id, name: person.name,
  ...(classifications.get(person.id) || { status: 'outside_initial_prince_scope', reason: '王族本人・マフィア・旅団・探検チームの同定資料等。今回の230人枠へ加算しない。' })
}));
const sourceFiles = [INPUT, config.counts_file, 'data/characters.json', 'data/count_only_characters.json', 'data/character_images.json'];
const report = {
  review_date: config.review_date, scope: config.scope, counting_policy: config.counting_policy,
  summary, princes, shared_pools: sharedPools, record_reviews: recordReviews,
  corrections: config.corrections, issues: config.issues,
  source_hashes: Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]))
};
const md = [
  '# 出航時の初期人員と既存IDの対応（2026-10-13）', '',
  config.scope, '',
  `初期${initialCount}枠に対して、既存IDの対応候補は${summary.individual_candidates}人分。王子ごとの枠まで置ける候補${candidateCount}人分と、元モモゼ・元マラヤーム側の出身枠が保留の共有候補${sharedCount}人分を含む。残る${summary.unresolved_individual_slots}枠は個人IDを対応させられていない。`, '',
  'この数字は原作で230人の出航時の個別配置を確認済みという意味ではない。後の登場からの所属推定、作者設定表の本編未対応者、無名だが別人として存在が確認された人員を含む。旧人数枠や同定用の顔資料は別に記録する。', '',
  '## 王子別の登録状況', '',
  '| 王子 | 初期枠 | 対応候補ID | 残り枠（共有候補の割当て前） | 注記 |',
  '|---|---:|---:|---:|---|',
  ...princes.map(prince => `| ${prince.rank} ${prince.name} | ${prince.capacity} | ${prince.candidate_count} | ${prince.unresolved_slots_before_shared_pools} | ${prince.author_setting_only_count ? `作者設定表のみ${prince.author_setting_only_count}人を含む` : [12,13].includes(prince.rank) ? '下記の共有候補あり' : ''} |`),
  `| 合計 | ${initialCount} | ${candidateCount} | ${initialCount-candidateCount} | 共有候補${sharedCount}人分を差し引いた残りは${summary.unresolved_individual_slots}枠 |`, '',
  '「残り枠」は新規人物を作る件数ではない。顔資料や後の登場人物と対応する可能性があり、まず同定・初期在籍・分類を確認する。', '',
  '## 個人IDの対応候補', '',
  ...princes.flatMap(prince => [
    `### 第${prince.rank}王子 ${prince.name}`, '',
    ...prince.groups.flatMap(group => [
      `- ${group.label}：${group.candidate_count}／${group.capacity}枠。${group.members.length ? group.members.map(member => link(member.id) + (member.identity_basis === 'author_setting_roster' ? '［作者設定表・本編未対応］' : '')).join('、') : '個人ID未対応。'}`,
      ...(group.notes ? [`  根拠・保留：${group.notes}`] : [])
    ]), ''
  ]),
  '## 元モモゼ側・元マラヤーム側の共有候補', '',
  ...sharedPools.flatMap(pool => [
    `- ${pool.label}：${pool.candidate_count}／${pool.capacity}枠。${pool.members.map(member => link(member.id)).join('、')}。`,
    `  ${pool.notes}`, ''
  ]),
  '共有候補は個人として一度だけ数える。各王子の未対応枠に全員を重ねて置かない。移動後の人数は24人、初期は15＋15人という人数の照合を保つ。', '',
  '## 旧人数枠・顔資料・初期枠への割当てを保留した人物', '',
  '| 対象 | 判定 | 理由 |', '|---|---|---|',
  ...config.record_reviews.map(review => `| ${review.ids.map(link).join('、')} | ${review.status} | ${review.reason} |`), '',
  '## 今回修正した所属', '',
  ...config.corrections.map(correction => `- ${label(correction.character_id)}：${correction.action} 根拠：${correction.basis}`), '',
  '## 人数の確定前に残る照合', '',
  ...config.issues.map(issue => `- ${issue}`), '',
  `既存の兵士・ハンター・従事者${summary.existing_personnel_records_reviewed}件をすべて「対応候補／保留／初期王子人員の対象外」に分類。人物台帳${characters.length}件の分類結果もJSONに記録した。`, '',
  '## 更新・検査', '',
  '人物名は characters.json、人数は initial_personnel_review_20261013.json、手動対応は initial_personnel_assignments_20261013.json を参照する。レポート内の氏名や合計を手で更新しない。', '',
  '再生成：`node scripts/build-initial-personnel-review.cjs`', '',
  '照合：`node scripts/build-initial-personnel-review.cjs --check`', '',
  '検査内容：存在しないID、個人IDの二重計上、各分類の容量超過、初期枠の内訳欠落、旧人数枠・未同定顔資料の加算、共有枠の重複、未分類の人員、入力変更後のレポート更新漏れ。', ''
].join('\n');
for (const [extension, content] of [['json', JSON.stringify(report, null, 2) + '\n'], ['md', md]]) {
  const file = path.join(ROOT, `${OUTPUT}.${extension}`);
  if (process.argv.includes('--check')) {
    assert.ok(fs.existsSync(file), `未生成: ${file}`);
    assert.equal(fs.readFileSync(file, 'utf8'), content, `再生成が必要: ${file}`);
  } else {
    fs.writeFileSync(file, content, 'utf8');
  }
}
console.log(`PASS: 初期${initialCount}枠、対応候補${summary.individual_candidates}人分（王子別${candidateCount}＋出身保留${sharedCount}）、個人ID未対応${summary.unresolved_individual_slots}枠。人員${summary.existing_personnel_records_reviewed}件を分類。`);
