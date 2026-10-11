/* 人物検索の回帰テスト：ネタバレ非表示時の検索対象、表記ゆれ・ローマ字、王子番号・号室の一致。
 * Usage: node tests/search-spoilers.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const facts = require(path.join(root, 'character-facts.js'));
const people = JSON.parse(fs.readFileSync(path.join(root, 'data', 'characters.json'), 'utf8'));
const byId = id => people.find(p => p.id === id);
const search = (query, revealed) => people
  .filter(p => facts.matchesSearch(facts.buildSearchText(facts.searchFields(p, {revealed})), query))
  .sort((a, b) => facts.searchRank(a, query) - facts.searchRank(b, query));

// 1. ネタバレ非表示：後の話の情報（状態・念能力・備考・出来事）では一致しない。表示中は一致する。
for (const query of ['死亡', '刹那', '遺体安置室']) {
  assert.equal(search(query, false).length, 0, `非表示で「${query}」に一致してはいけない`);
  assert.ok(search(query, true).length > 0, `表示中は「${query}」に一致する`);
}
// 非表示時の検索対象に、後の話の情報のフィールドの値が入っていないこと。
const hiddenOnly = ['notes', 'nen_ability', 'mission', 'target', 'room', 'current_assignment', 'location', 'camp'];
for (const person of people) {
  const fields = facts.searchFields(person, {revealed: false});
  for (const key of hiddenOnly) {
    const value = person[key];
    if (typeof value !== 'string' || !value) continue;
    // 初期配置・所属・名前と同じ値（例：room が initial_room と同じ）は初期情報として入ってよい。
    if ([person.initial_room, person.affiliation, person.name, person.role].includes(value)) continue;
    assert.ok(!fields.includes(value), `${person.id} の ${key} が非表示時の検索対象に入っている`);
  }
  assert.ok(!fields.includes(person.status) || ['兵士', '王子'].includes(person.status), `${person.id} の状態が非表示時の検索対象に入っている`);
}
// 役職は括弧書き（実態・後の転属）を除いた初期の部分だけを使う。
assert.equal(facts.initialRole('第12王子モモゼ護衛（実態：第五王妃スィンコスィンコ配下の暗殺者）'), '第12王子モモゼ護衛');
assert.equal(facts.initialRole('3101号室に入って消え、別の扉の前に移動させられた後、殺害された組員'), null);

// 2. 表記ゆれ：NFKC・ひらがな→カタカナ・長音／中黒／＝／空白の揺れ。
assert.equal(facts.normalizeSearchText('はんぞー'), facts.normalizeSearchText('ハンゾー'));
assert.equal(facts.normalizeSearchText('ﾂｪﾘｰﾄﾞﾆﾋ ＝ ﾎｲｺｰﾛ'), facts.normalizeSearchText('ツェリードニヒ＝ホイコーロ'));
assert.equal(search('はんぞー', false)[0].name, 'ハンゾー');
assert.equal(search('ひそか・もろう', false)[0].name, 'ヒソカ＝モロウ');

// 3. ローマ字（簡易ヘボン式）。
assert.equal(facts.katakanaToRomaji('ヒソカ'), 'hisoka');
assert.equal(facts.katakanaToRomaji('ベンジャミン'), 'benjamin');
assert.equal(facts.katakanaToRomaji('クラピカ'), 'kurapika');
assert.equal(search('hisoka', false)[0].name, 'ヒソカ＝モロウ');
assert.equal(search('HISOKA', false)[0].name, 'ヒソカ＝モロウ');

// 4. 王子番号は数字の境界で比較し、王子の別名を自動で付ける。
for (const revealed of [false, true]) {
  const hits = search('4王子', revealed);
  assert.equal(hits[0].id, 'P04');
  assert.ok(!hits.some(p => p.id === 'P14'), '「4王子」が第14王子に当たってはいけない');
}
assert.ok(search('第1王子', false).some(p => p.id === 'P01'));
assert.ok(!search('第1王子', false).some(p => ['P10', 'P11', 'P12', 'P13', 'P14'].includes(p.id)));
assert.equal(search('ベンジャミン王子', false)[0].id, 'P01');
assert.equal(facts.searchRank(byId('P01'), 'ベンジャミン王子'), 0);
assert.equal(facts.searchRank(byId('P01'), 'ベンジャミン'), 0);

// 5. 号室：非表示時は初期配置だけ、表示中は配置先も対象にする。
const initial1014 = people.filter(p => /1014/.test(p.initial_room || '')).map(p => p.id).sort();
assert.deepEqual(search('1014', false).map(p => p.id).sort(), initial1014);
assert.ok(initial1014.length >= 10);
assert.ok(search('1014', true).length > initial1014.length);
assert.ok(!search('101', false).length, '「101」が1014号室に部分一致してはいけない');

// 6. 画面側の配線：一覧の検索は CharacterFacts の検索対象を使い、ネタバレ設定を変えたら作り直す。
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const finder = source.slice(source.indexOf('const findMatchingCharacters'), source.indexOf('const apply = () =>'));
assert.ok(finder.includes('CharacterFacts.matchesSearch(getCharacterSearchText(character), query)'));
assert.ok(!/notes|nen_ability|mission/.test(finder), '検索の対象は getCharacterSearchFields にまとめる');
const fieldsFn = source.slice(source.indexOf('function getCharacterSearchFields'), source.indexOf('function getCharacterSearchText'));
const hiddenBranch = fieldsFn.slice(0, fieldsFn.indexOf('if (!revealed)') + 200);
assert.ok(hiddenBranch.includes('revealed: false') && !/beast|getNenClassLabel|formatAssignment|character\.room/.test(hiddenBranch.slice(0, hiddenBranch.indexOf('const beast') > 0 ? hiddenBranch.indexOf('const beast') : undefined)));
assert.ok(source.includes('document.dispatchEvent(new CustomEvent("spoiler-visibility-change"'));
assert.ok(source.includes('document.addEventListener("spoiler-visibility-change"'));

console.log('PASS: spoiler-safe search fields, kana/romaji normalization, prince numbers, aliases and room search');
