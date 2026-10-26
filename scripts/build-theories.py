"""Build static, source-linked theory pages. Run from any directory."""
import json
import re
import argparse
import sys
from pathlib import Path
from html import escape as esc

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Report stale pages without writing files')
args = parser.parse_args()
stale_pages = []


def write_page(path, content):
    if args.check:
        if not path.exists() or path.read_text(encoding='utf-8') != content:
            stale_pages.append(str(path.relative_to(ROOT)))
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')


questions = json.loads((ROOT / 'data/open_questions.json').read_text(encoding='utf-8'))
events = {e['id']: e for e in json.loads((ROOT / 'data/events.json').read_text(encoding='utf-8'))}
# Each entry: neutral title, conclusion, interpretation, counterargument, next evidence.
editorial = {
'Q001': ['1014号室の最初の殺害は、誰の仕業か', '初期の死亡事件を、後の講習会の暗殺と同一犯だと断定する根拠は足りない。', '警護を短時間で減らすという結果に注目すると、王子そのものへの攻撃だけでなく、防衛体制の弱体化を狙った可能性も考えられる。まずウッディーの発見と残る4名の発見を分け、接触できた人物と時間帯を比較したい。', '遺体の外見や発生場所の類似だけでは能力も犯人も特定できない。複数の襲撃が重なった可能性も残る。サイールドによる後の襲撃は別の記録であり、最初の5名と混ぜない。', '攻撃の瞬間、能力の条件、術者の独白のいずれかが初期の遺体と結び付くか。'],
'Q002': ['サイレントマジョリティーの術者をどう絞るか', '人形が憑いた人物と術者を同一視せず、観測できる条件から絞るのが妥当。', 'ロベリーが人形を認識したことは能力の仕掛けの一部と読める。術者候補を考えるなら、講習会の情報を得られたか、攻撃時に条件を満たせたかを別々に評価する必要がある。', 'クラピカが同じ犯人の遠隔操作と判断したことは重要だが、読者に術者の正体まで示されたことにはならない。落ち着いた態度や視線だけで特定する説は弱い。', '術者側の視点と参加者の行動が対応する描写、射程や標的選択の制限。'],
'Q003': ['船外への脱出は、なぜ阻まれるのか', '物理的に船を離れることと、継承戦から離脱できることは別と考える必要がある。', '救命艇を用意しても無数の手に阻まれるため、通常の警備を突破するだけでは解決しない仕組みが示唆される。儀式による拘束という読みは自然だが、誰が発動させたかは別の問題だ。', '一度の脱出場面だけで、全王子・全経路・全距離に同じ規則が適用されるとは確定できない。船外に出た瞬間が条件か、継承戦から逃れる意図が条件かも区別できない。', '境界、対象者、例外を明示する説明。同じ条件で別の人物が移動する場面。'],
'Q004': ['チョウライのコインは何を蓄積するのか', '蓄積と所有者の変化が手掛かり。ただし具体的な利益や支配の効果は分けて検証したい。', '時間と数字の変化、受け渡しと絵柄の変化を別の変数と見ると整理しやすい。長く持つほど利益が増す仕組みなら、受領者が自発的にコインを保持する誘因にもなり得る。これは効果の確定ではなく機能の仮説である。', 'クラピカの蓄積型・操作系の見立ては作中人物の推察。数字をそのまま金額、忠誠度、操作の強さと読む根拠はない。第417話の操作に関する報告も、条件全体の実証とは分ける。', '誰が何日持ち、誰へ渡し、何が起きたかを同じ硬貨で追える記録。'],
'Q005': ['フウゲツの消耗は何が原因か――ルズールスの守護霊獣との関係', '能力の使用回数の増加と衰弱は並行して描かれる。罠や依存を疑う材料はあるが、ルズールスの守護霊獣を原因と確定はできない。', '便利になった能力を繰り返し使わせる仕掛けなら、本人が異常を利点だと受け取る点に罠の強さがある。第402話でセンリツは背中の痕を念による記と見立て、敵の能力と依存性を疑う。ルズールスの守護霊獣を疑うのはカチョウの姿の守護霊獣であり、センリツたちは原因となる術者を探す立場にある。疑いをもとに対処計画を立てたことと、犯人を特定できたことは区別したい。', '衰弱で邪霊が寄ったのか、邪霊が衰弱を招いたのか、別の攻撃が両方を起こしたのかは切り分けが必要。秘密の扉の使い過ぎだけで背中の痕まで説明できるとは限らない。ルズールスへの疑いは登場人物の推理で、犯人確定ではない。', '使用回数と体調の関係、背中の痕の由来、誰の罠にいつ接触したか、術者を排除した場合の変化。'],
'Q006': ['ビヨンドの計画と王子の血縁をどう読むか', 'ロンギの説明のうち、自身の出自と王子の血縁についての推測は区別する。', '王妃の子という参加資格に父親の指定がない点は、ロンギの仮説を考える余地を作る。呪いを持つ子供たちの配置は長期的な介入を疑わせるが、それだけで特定の王子へ結び付けられない。', 'ヒュリコフとビヨンドの会話が呪いの存在を補強しても、王子の中にいる実子の名前まで補強するわけではない。容姿の類似だけを血縁の証拠にしない。', '王妃との関係、出生に関する直接の証言、呪いの標的と血縁が結び付く説明。'],
'Q007': ['第14王子をめぐり、何が判明して何が残ったか', '身元の説明は進んでいる。残る中心は本物の娘の所在と、資格・呪いの適用である。', '第412話ではオイトが、儀式を受けたのは娘で、船内の乳児は妹の息子だと説明し、クラピカは嘘がないと判断する。したがって二人を分けて追う必要がある。第414話の捜索方針は、船外にいれば安全という単純な結論を取れないことを示す。', '鎖が嘘を検出しないことと、オイトが儀式の仕組みを完全に理解していることは同じではない。本人が知らない所在や、資格の法則までその証言だけで確定できない。', '娘の所在の確認、儀式を受けた者と王子として扱われる者のどちらに効果が及ぶか。'],
'Q008': ['ハルケンブルグの肉体と人格をどう追うか', '肉体の死亡、人格の所在、継承資格の三つを別々に追う必要がある。', 'バルサミルコの姿で行動する場面では、外見より独白と能力の説明を重視したい。ベンジャミンの人格交換への推理も、彼が把握した情報の範囲での認識として読む。', '本人の肉体が死亡したから人格も消えた、あるいは別の肉体にいるから資格も残る、とは自動的に言えない。第417話の本人確認の報告も、人格交換を完全に判定できる検査なのかは別問題。', '人格交換後の睡眠・覚醒の順序、矢の発動側、本人だけが知る情報、儀式側の反応。'],
'Q009': ['TSK-17の感染と余命をどう整理するか', '感染を示す発言と、発症・死亡の描写を分ける。各王子の余命を同じ時計で数えるのは早い。', '第413話のヒュリコフの告白では噴霧による感染が説明される。第417話の他王子への感染はベンジャミンの独白が根拠で、感染時点や投与条件まで同一とは限らない。戒厳令を急ぐ動機と感染経過を分けると混乱が減る。', '本人の余命予測は診断の確定値ではない。呪いによる攻撃が並行する場合も、症状をすべてTSK-17だけに帰属させることはできない。', '各人の散布・接触時点、症状の発現、医療側の確認を一人ずつ結ぶ記録。'],
'Q010': ['ビルの残り二つの脱出方法とは', 'パリストンとビヨンドの協力が必要なことは分かるが、方法の中身は未提示。', '協力者の名前を条件として挙げるため、単なる移動手段以外に交渉や組織の力が必要な可能性がある。誰をどこから逃がす案なのかを分け、船からの脱出と継承戦の終了を同じ目標にしない。', '第414話の継承戦をやめさせる案を、最初から想定した二案の答えと結び付ける明示はない。協力者が同じというだけでは同一計画と断定できない。', 'ビルが以前の二案に言及する台詞、協力の対価と対象者、儀式の拘束を避ける条件。'],
'Q011': ['バビマイナの最重要任務はどこまで分かるか', '情報掌握と警護は本人が語っているが、命令の全文は不明。', '能力把握と一次報告を実行しているため、情報収集が実際の任務に含まれるという読みには行動の裏付けがある。殺害を急がず観察する態度も、その役割から説明できる。', '敵側に明かした説明が命令のすべてとは限らない。ただし、説明されていない任務がある可能性だけで、暗殺命令が出ていると逆算することもできない。', 'ベンジャミンからの具体的な指示、報告の内容、説明された任務と実際の行動の対応。'],
'Q012': ['ドルフィンは待機中でも解除できるのか', '待機命令を、絶対時間の停止命令と読む根拠はない。', '第361話の説明では、奪った能力を使いドルフィンを解除するまで絶対時間が続く。第366話でも継続を危ぶむため、使用対象が見つからない間も負担が進むという読みが自然。', '能力使用後の解除命令が可能でも、使用前の解除が可能とは限らない。第364話で搭載を保留するのは新たに奪った能力であり、既に搭載した裏窓の解除ではない。', '能力を一度も使わずに解除する場面、待機・貸与・解除を区別した説明。'],
'Q013': ['三種の神器の盗難で継承戦は止まるか', 'クロロの能力進化の計画と、儀式そのものへの影響は別の問い。', '儀式に関わる品の奪取は継承戦への介入になり得る。ただし神器が継続的な動力なのか、開始時に条件を成立させる物なのかによって、盗難の効果は大きく異なる。', '盗めば儀式が停止するという説明は、参照した場面にはない。クロロが求める盗みの達成と、王子たちが求める生存が一致する保証もない。', '神器を移動・破損させた際の反応、儀式を維持する条件、クロロの達成条件。'],
'Q014': ['クロロの電話は誰を探しているのか', '対象を発見したという応答と、上層にいるというクロロの推測を分けて読む。', '念波が届かないことは探索に距離や遮断などの制約がある可能性を示す。欲しい能力と盗むための条件を分ければ、対象を見つけるだけでは計画が終わらない理由も整理できる。', '上層という推測だけで王子やその護衛に限定できない。電話の応答が示すのは探索の状態であり、特定の人物名や能力名の答えではない。', '電話に与えた検索条件、通信が成立する条件、対象との接触。'],
}

articles = []
# 本文・反証も読んだ上で指定する編集上のネタバレ上限。根拠イベントだけから自動決定しない。
spoiler_limits = dict(Q001=376, Q002=376, Q003=383, Q004=417, Q005=402,
    Q006=415, Q007=414, Q008=417, Q009=417, Q010=414, Q011=370,
    Q012=369, Q013=406, Q014=406, **{'emperor-time': 369})
search_terms = {
    'Q001': ['ウッディー', '王室警護兵', '1014号室'],
    'Q002': ['ロベリー', 'バリゲン', 'ミュハン', 'サイレントマジョリティー'],
    'emperor-time': ['クラピカ', 'エンペラータイム', '絶対時間', '12時間', '18時'],
    'Q003': ['カチョウ', 'フウゲツ', '救命艇', '脱出'],
    'Q004': ['チョウライ', 'コイン', '硬貨', '蓄積'],
    'Q005': ['フウゲツ', 'センリツ', '邪霊', '依存'],
    'Q006': ['ビヨンド', 'ロンギ', 'ヒュリコフ', '呪い', '血縁'],
    'Q007': ['ワブル', 'オイト', '第14王子', '替え玉', '身元'],
    'Q008': ['ハルケンブルグ', 'バルサミルコ', '人格交換', '肉体'],
    'Q009': ['TSK-17', 'TSK17', 'ベンジャミン', 'ヒュリコフ', '感染', '余命'],
    'Q010': ['ビル', 'パリストン', 'ビヨンド', '脱出', '協力'],
    'Q011': ['バビマイナ', '任務', '情報掌握', '警護'],
    'Q012': ['クラピカ', 'ドルフィン', '絶対時間', 'エンペラータイム', '待機', '解除'],
    'Q013': ['クロロ', '三種の神器', '盗難', '継承戦'],
    'Q014': ['クロロ', '電話', '探索', '念波'],
}
people = {p['id']: p for p in json.loads((ROOT / 'data/characters.json').read_text(encoding='utf-8'))}
key_points = {
 'Q001': ['ウッディーの発見と、残る4名の発見は分けて追う。', '後の講習会の暗殺には別の観測記録がある。', '初期事件と同じ術者・能力を結ぶ決定的な描写は確認できていない。'],
 'Q002': ['人形を認識したロベリーと術者は同一とは限らない。', 'クラピカの遠隔操作という判断は、術者の正体の確定とは別。', '攻撃時の行動と能力条件の両方で候補を比較する必要がある。'],
 'Q003': ['救命艇での脱出は無数の手に阻まれる。', '船を離れる移動と継承戦からの離脱は分けて考える。', '対象・境界・例外を明示する説明は未確認。'],
 'Q004': ['時間の経過と硬貨の数字・絵柄の変化が手掛かり。', '蓄積型・操作系という見立ては作中人物の推察。', '第417話の報告だけで硬貨の全条件が実証されたとは扱わない。'],
 'Q005': ['能力の使用回数の増加と衰弱が並行して描かれる。', 'センリツは能力への依存を懸念する。', 'ルズールスへの疑いは登場人物の推理であり、犯人確定ではない。'],
 'Q006': ['ロンギ自身の出自の説明と、王子の血縁の推測を区別する。', '子供への呪いとその配置が長期的介入の手掛かり。', '呪いの存在が補強されても、特定の王子の実父は決まらない。'],
 'Q007': ['第412話でオイトが儀式を受けた娘と船内の乳児を区別する。', 'クラピカは証言に嘘がないと判断する。', '第414話では娘の捜索と呪いへの対応が課題になる。'],
 'Q008': ['肉体の死亡と人格の所在は同じ問題ではない。', 'バルサミルコの姿での行動は独白と能力説明も参照する。', '第417話の本人確認の報告と、人格交換の完全な判定を分ける。'],
 'Q009': ['第413話ではヒュリコフ本人が噴霧による感染を説明する。', '第417話の他王子への感染はベンジャミンの独白が根拠。', '感染時点・発症・余命予測を同じ時計で一括計算しない。'],
 'Q010': ['ビルは残る方法にパリストンとビヨンドの協力が必要だと説明する。', '第414話では協会全体で継承戦を止めるべきだと主張する。', '後の提案が初期の二案の答えだという明示は確認できない。'],
 'Q011': ['情報掌握と警護は本人が説明した任務。', '能力把握と一次報告は実際の行動として記録される。', '本人が敵側へ説明した内容だけで、命令の全文が分かったとは扱わない。'],
 'Q012': ['第361話では能力使用・解除まで絶対時間が続くと説明される。', '第366話でも強制継続が懸念される。', '第364話の別能力の搭載保留は、裏窓の解除の証拠ではない。'],
 'Q013': ['クロロは能力進化に関わる盗みを計画する。', '神器の奪取と継承戦の停止は別の問い。', '盗難で儀式が停止するとの説明は参照場面にない。'],
 'Q014': ['電話には対象発見を示す応答がある。', '上層にいるという位置の判断はクロロの推測。', '対象の特定と能力を盗む条件の達成は別。'],
 'emperor-time': ['第361話の発動場面は出航約2時間の説明より前に置かれる。', '第369話の翌朝6時と継続12時間からは前日18時が逆算される。', '途中の解除・再発動は確認できず、両者の約4時間の差が残る。'],
}
for q in questions:
    title, conclusion, theory, weakness, next_step = editorial[q['id']]
    refs = list(q['related_event_ids'])
    if 'E361-001' in refs and 'E361-007' not in refs:
        refs += ['E361-007']
    if q['id'] == 'Q012': refs += ['E361-008']
    if q['id'] == 'Q004': refs += ['E417-005']
    if q['id'] == 'Q008': refs += ['E417-005']
    if q['id'] == 'Q009': refs += ['E413-005']
    if q['id'] == 'Q010': refs += ['E414-005']
    if q['id'] == 'Q001': refs += ['E370-003', 'E376-002']
    articles.append(dict(id=q['id'], title=title, category=q['category'], conclusion=conclusion,
        theory=theory, weakness=weakness, next_step=next_step, refs=refs,
        chapter=spoiler_limits[q['id']], status='参照場面に基づく考察'))
articles.insert(0, dict(id='emperor-time', title='クラピカの絶対時間はいつ始まった？', category='時系列の不整合',
    conclusion='描写上は1日目14時ごろまでに発動している。一方、翌朝の継続12時間から逆算すると18時ごろになる。途中の解除・再発動は確認できず、時刻を一つに確定できない。',
    theory='第361話ではサイールドを制圧し、裏窓を奪って絶対時間を発動する。その後に出航から約2時間という説明が入る。正午出航を基準にすれば、発動は14時ごろまで。分単位の時刻は分からない。第369話冒頭の出航18時間後を覚醒場面に適用すると翌朝6時となり、継続12時間を引けば前日18時、失神約9時間を引けば前日21時となる。発動約3時間で倒れたという後半の流れは整うが、第361話の発動からなら翌朝まで約16時間以上になり、少なくとも約4時間の差が残る。',
    weakness='途中で解除し18時に再発動したという仮説なら数字を合わせられる。しかし第361話のドルフィンは能力使用・解除までの強制継続を説明し、第365〜366話でも緋の目と強制継続への懸念が続く。描かれていない解除と、それを可能にする条件を補う必要がある。待機命令や、第364話で別の能力の搭載を保留したことを解除の証拠にはできない。経過時間の記述にずれがあるという読みも残るが、作者の誤りと断定する材料はない。',
    next_step='解除・再発動を示す描写や、時間表示を訂正・補足する情報。現状では14時ごろまでの発動場面と18時の逆算値を併記し、18時を確定時刻として採用しない。',
    refs=['E361-001','E361-007','E361-008','E361-005','E364-006','E365-004','E366-002','E368-002','E369-001'], chapter=369, status='時間描写の不整合を検討'))

key_points['fugetsu-overnight'] = [
 '第380話の4日目10時は船内配置図の時刻。捜索・発見が直後に終わったとは限らない。',
 '第381話の演奏後は晩餐会まで76時間＝5日目16時。警報解除は5日目20時と明示される。',
 '本サイトは第380話末と第381話冒頭の間に一晩を置く。就寝後の移動と翌朝の不在確認は、この配置を説明する仮説。',
]
search_terms['fugetsu-overnight'] = ['フウゲツ', 'ミザイストム', 'センリツ', '4日目', '5日目', '一晩', '13:44', '76時間', 'マジカルワーム']
articles.insert(1, dict(id='fugetsu-overnight', title='4日目から5日目へ、フウゲツは一晩保護されていた？', category='時系列の解釈',
 conclusion='本サイトでは、第380話末のフウゲツ保護と第381話冒頭の聴取の間で4日目から5日目へ日付が変わると解釈する。一晩保護され、翌日に不在の確認・聴取・帰還が進んだという仮説で整理する。',
 theory='4日目10時の船内配置図の後、軍は居住区を順番に捜索する。イルミ・カルトとの遭遇を午後から夕方、その後のフウゲツ保護を同日と読む。展望デッキからの海面の光は夕景とも解釈できるが、補助的な手掛かりにとどまる。フウゲツの寝室からのマジカルワームによる移動に着目すれば、この日も早めに就寝する形をとった後に抜け出した可能性がある。兵士が寝室のベッドの中まで容易に確認できなかったと仮定すれば、保護の翌朝になって1011号室の不在が確認されたとしても矛盾しない。第381話冒頭を翌日の聴取とし、5日目13:44の電話、帰還、72時間監視の説明、16時ごろの演奏へつなぐ。監視が16時ごろ開始なら72時間後は8日目16時ごろで、20時の晩餐会前に解除される説明とも整合する。5日目20時に解除される船内の警報・自室待機は、王子個人への72時間監視とは別である。',
 weakness='一晩の保護、当夜の就寝・移動時刻、翌朝の不在確認は直接描かれていない。兵士が寝室を確認できないという規則も確認しておらず、確認が遅れ得る事情としての仮説である。寝室からの移動を、すべての移動が就寝後だった証拠にはしない。第381話冒頭の不在確認が即時の続報である可能性や、4日目13:44の電話後に一晩を挟む別案も残る。話数の区切りや海の描写だけで翌日と確定したわけではなく、作者の誤記を断定するものでもない。',
 next_step='夜間の保護、王子の寝室確認の運用、聴取の日付を示す原作の補足があれば再検討する。それまでは本サイトの採用仮説として日付をそろえ、原作の明示時刻と区別する。',
 refs=['E380-006','E380-003','E380-004','E380-005','E381-001','E381-003','E381-002','E381-004','E381-007'],chapter=381,status='本サイトの採用仮説',updated='2026-10-20'))

key_points['halkenburg-four-days'] = [
 '第375話で直訴に出発し、第376話で手紙を渡して毎日の訪問を宣言する。初日は前後関係から3日目と推定する。',
 '第382話の「毎朝」と「4日かかった」を、3・4・5・6日目という初日込みの4日間と読む。',
 '本サイトは直訴と続く能力発動を6日目に配置。話末の8日目20時は晩餐会に付く日時として分ける。',
]
search_terms['halkenburg-four-days'] = ['ハルケンブルグ', 'ナスビー', 'シカク', '鳴動', '4日', '6日目', '7日目', '手紙', '直訴']
articles.insert(2, dict(id='halkenburg-four-days',title='ハルケンブルグの「4日かかった」は6日目の朝か',category='時系列の解釈',
 conclusion='本サイトでは、第382話の国王への直訴と続くシカクへの能力発動・二度目の鳴動を6日目と推定する。手紙の訪問初日を3日目と置き、初日を含む4日間と数える解釈を採用する。',
 theory='第375話でハルケンブルグはモモゼの犠牲を受けて再び父へ直訴に向かう。続く第376話では面会を断られ、手紙を託し、明日・明後日・明々後日も来ると宣言する。この最初の訪問を3日目とする既存の推定を起点にすると、初回が3日目、2回目が4日目、3回目が5日目、4回目が6日目となる。第382話の受付は「毎朝」と挨拶し、王子は「国王軍の銃を下ろすのに4日かかった」と振り返る。96時間の厳密な計測ではなく、毎日の訪問で警戒を緩めさせるのに要した4日間と読むなら、6日目の朝で整合する。その後のシカクへの指示・ハルケンブルグ帰還・能力発動も同日の流れと推定する。話末は夜の船と別の王子の場面を経て8日目20時の晩餐会に移るため、この日時を冒頭へ遡って適用しない。サレサレの死亡として扱う寝台の場面は、本サイトでは7日目の夜に仮置きする。ただし6日目夜〜8日目夜のいずれの可能性も残り、8日目なら晩餐会開始前と読む。暗い海と星空のカットだけで別々の夜だと確定せず、以前の19:50頃という分刻みの仮時刻は撤回する。',
 weakness='第376話の初訪問自体には3日目の明示がなく、前後関係による推定である。「4日かかった」が初日込みか、初訪問から丸4日経過かも明記されない。後者なら3日目から4日後の7日目となる。したがって6日目は採用仮説であり確定日ではない。第382話内の日付が変わる正確なコマも特定できない。午前の根拠は受付の挨拶で、09:00・09:20という分刻みは従来の表示順の目安にすぎない。',
 next_step='初訪問の日付、何回目の訪問か、直訴や二度目の鳴動の日時を示す補足があれば見直す。現状は6日目を推定表示し、7日目説と初日の不確実性を併記する。',
 refs=['E375-001','E375-003','E376-008','E382-001','E382-002','E382-003','E382-004'],chapter=382,status='本サイトの採用仮説',updated='2026-10-20'))

def shell(title, body, depth=0, article_id=None):
    base = '../' * (depth + 1)
    if article_id:
        body = (f'<div data-theory-id="{esc(article_id, quote=True)}">{body}</div>'
                f'<script src="{base}draft-state.js?v=20261026-inflight-checkpoint"></script>'
                f'<script src="{base}theories/theory-memos.js?v=20261026-field-merge"></script>')
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} | 王位継承戦データまとめ</title><meta name="description" content="王位継承戦の謎を、参照場面・考察・反証に分けて整理。"><link rel="stylesheet" href="{base}style.css?v=20261018-reading"><link rel="stylesheet" href="{base}theories/theories.css?v=20261018-reading"></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><div class="header-inner"><a class="site-title" href="{base}index.html">王位継承戦データまとめ</a><p>カキン王位継承戦の人物、出来事、作中の基礎資料を確認</p></div><nav class="primary-nav" aria-label="メインメニュー"><a class="primary-nav-link" href="{base}index.html#characters">人物一覧</a><a class="primary-nav-link" href="{base}index.html#timeline">出来事</a><a class="primary-nav-link" href="{base}index.html#guide">基礎資料</a><a class="primary-nav-link active" href="{base}theories/" aria-current="page">謎・考察</a></nav></header><main id="main" class="essay-main">{body}</main><footer class="essay-main">個人による考察です。原作の事実と仮説を分けて記載しています。</footer><script src="{base}theories/theory-search.js?v=20261015-search"></script><script src="{base}theories/theories.js?v=20261026-spoiler-sync"></script></body></html>'''

out = ROOT / 'theories'
cards = []
for a in articles:
    refs = [events[i] for i in a['refs']]
    question = next((q for q in questions if q['id'] == a['id']), None)
    checked = question.get('last_checked_chapter') if question else None
    # 台帳の話数だけから原作全話の照合完了へ昇格しない。
    checked_label = (f'状況の更新確認は未了です（参考：第{checked}話までの登録情報）。'
                     if checked else ('状況の更新確認は未了です。' if a['id'] in {'fugetsu-overnight', 'halkenburg-four-days'} else 'その後の解決状況は未確認です。'))
    metadata = f'<dl class="article-metadata"><div><dt>本文のネタバレ</dt><dd>第{a["chapter"]}話まで</dd></div><div><dt>記事の最終更新日</dt><dd><time datetime="2026-10-18">2026年10月18日</time></dd></div></dl><details class="article-review-note"><summary>その後の解決状況について</summary><p>{checked_label} 更新日は記事の編集日で、原作の再確認日ではありません。</p></details>'
    if a.get('updated'):
        metadata = metadata.replace('2026-10-18', a['updated']).replace('2026年10月18日', '2026年10月20日')
    assert max(e['chapter'] for e in refs) <= a['chapter'], f'{a["id"]}: 参照場面が上限を超えています'
    mentioned = [int(n) for n in re.findall(r'第?(\d{3})話', ' '.join(str(a[k]) for k in ['conclusion', 'theory', 'weakness', 'next_step']) + ' '.join(key_points[a['id']]))]
    assert not mentioned or max(mentioned) <= a['chapter'], f'{a["id"]}: 本文の話数が上限を超えています'
    points = '<ul class="key-evidence">' + ''.join(f'<li>{esc(point)}</li>' for point in key_points[a['id']]) + '</ul>'
    comparison = ''
    if a['id'] == 'Q001':
        comparison = '<h3>仮説の比較（この記事の考察）</h3><div class="comparison-scroll"><table><tr><th>仮説</th><th>説明できる可能性がある点</th><th>足りない証拠</th></tr><tr><td>後の講習会の暗殺と同じ術者</td><td>被害の共通点を一つの仕組みで説明できる可能性</td><td>初期事件とその能力を直接結ぶ描写</td></tr><tr><td>別の術者・別の事件</td><td>複数勢力による襲撃が重なる可能性</td><td>初期事件固有の攻撃手段と術者の描写</td></tr></table></div><p>現状はどちらにも決め手がありません。被害の類似だけで同一犯説を優先せず、初期事件に固有の証拠を待つのが妥当です。</p>'
    if a['id'] == 'Q005':
        comparison = '<h3>消耗の原因を比較する</h3><div class="table-scroll"><table><thead><tr><th>仮説</th><th>説明できる点</th><th>未確認の点</th></tr></thead><tbody><tr><th>ルズールスの守護霊獣の罠</th><td>作中で疑われ、能力への依存という見立てと整合し得る</td><td>罠への接触・発動・痕を刻んだ場面は確認できない</td></tr><tr><th>別の術者による罠や呪い</th><td>能力の変化・痕・消耗を外部からの攻撃として検討できる</td><td>術者と具体的な条件を特定できない</td></tr><tr><th>能力の酷使や衰弱に伴う邪霊</th><td>使用回数の増加と体調悪化の並行を説明し得る</td><td>痕や帰りの扉の変化まで単独で説明できるか不明</td></tr></tbody></table></div>'
    if a['id'] == 'Q002':
        conditions = [
            ('座敷人形を視認できる者', 'E370-003', '能力者本人と憑かれた者だけが視認でき、ロベリーが騒ぐ。', '「視認したからロベリーが術者」という特定はできない。', 'もう一人の視認者の身元。ロベリーを個人として除外できるかも別問題。'),
            ('注意が逸れた時の攻撃', 'E370-003', '全員の注意を引いた直後にバリゲンが襲われる。', '騒いだ者と術者を同一とする推論は成立しない。', '合図を誰が観測し、誰が指令したか。参加者ごとの行動証拠は未整理。'),
            ('現場の外から指令できるか', 'E376-002', 'クラピカは同じ犯人の遠隔操作と推理する。', '現場にいないという理由だけで候補から外せない（遠隔操作説を採る場合）。', '射程・視認方法・術者の在室条件。遠隔操作は作中人物の推理。'),
        ]
        rows = ''.join(f'<tr><td>{esc(condition)}</td><td><a href="../../index.html?event={ref}&amp;from_theory=Q002#timeline">第{events[ref]["chapter"]}話の場面</a>：{esc(scene)}</td><td>{esc(excluded)}</td><td>{esc(unknown)}</td></tr>' for condition, ref, scene, excluded, unknown in conditions)
        comparison = '<h3>条件からどこまで絞れるか（この記事の考察）</h3><p>この表で除外するのは安易な特定方法です。参照場面だけで特定人物を術者候補から確実に除外した、という比較結果ではありません。</p><div class="comparison-scroll"><table><thead><tr><th>確認する条件</th><th>根拠となる場面</th><th>除外できる解釈</th><th>まだ判断できないこと</th></tr></thead><tbody>' + rows + '</tbody></table></div><p>現状は「人形が見える人」「騒いだ人」「殺害現場にいた人」という単純な絞り方はいずれも決め手になりません。術者の正体を絞るには、観測・指令と各人の行動を結ぶ追加の証拠が必要です。</p>'
    evidence = ''.join(f'<li><a href="../../index.html?t_chapter={e["chapter"]}&amp;event={esc(e["id"])}&amp;from_theory={esc(a["id"])}#timeline">第{e["chapter"]}話：この出来事の詳細を開く</a><p>{esc(e["description"])}</p><small>{"原作確認記録あり" if e.get("verification_status") == "review_recorded" else "再照合・推測を含む記録"}</small></li>' for e in refs)
    if a['id'] == 'Q002':
        comparison = comparison.replace('<table>', '<table class="condition-table">')
    related = '<a href="../Q012/">ドルフィンの解除条件の考察</a>' if a['id']=='emperor-time' else '<a href="../emperor-time/">発動時刻と12時間の食い違い</a>' if a['id']=='Q012' else ''
    timeline = '<table><caption>第369話からの逆算（確定時刻ではない）</caption><tr><th>開始</th><th>失神</th><th>覚醒</th></tr><tr><td>1日目18時ごろ</td><td>1日目21時ごろ</td><td>2日目6時ごろ</td></tr></table>' if a['id']=='emperor-time' else ''
    body = f'''<a href="../">← 謎・考察一覧</a><p class="eyebrow">{esc(a['category'])}</p><h1>{esc(a['title'])}</h1><p>本文を含むネタバレ範囲：第{a['chapter']}話まで · 執筆日：2026年10月13日</p><p class="scope-note">{esc(a['status'])}。原作全話での未解決を保証する一覧ではありません。参照場面は既存の照合記録に基づきます。</p><details class="spoiler-article"><summary>第{a['chapter']}話までのネタバレを含む記事を読む</summary><nav class="toc" aria-label="記事の目次"><a href="#conclusion">結論</a><a href="#key-points">重要な根拠3点</a><a href="#theory">考察</a><a href="#limits">反証・限界</a><a href="#evidence">詳しい参照場面</a></nav><h2 id="conclusion">現時点の結論</h2><p class="conclusion">{esc(a['conclusion'])}</p><h2 id="key-points">重要な根拠3点</h2>{points}<h2 id="theory">考察：どう読むと説明できるか</h2><p>{esc(a['theory'])}</p>{timeline}{comparison}<h2 id="limits">反証・断定できない点</h2><p>{esc(a['weakness'])}</p><h2>何が分かれば判断が進むか</h2><p>{esc(a['next_step'])}</p>{related}<details class="evidence-details" id="evidence"><summary>詳しい参照場面と確認状態を開く（{len(refs)}件）</summary><ul class="evidence">{evidence}</ul></details></details><p><a href="../">謎・考察一覧へ戻る</a></p>'''
    body = body.replace('重要な根拠3点', 'この記事の要点3つ')
    body = re.sub(r'<p class="scope-note">.*?</p>', '', body)
    body = body.replace(f'<p>本文を含むネタバレ範囲：第{a["chapter"]}話まで · 執筆日：2026年10月13日</p>', metadata)
    dest=out/a['id']
    write_page(dest/'index.html', shell(a['title'], body, 1, a['id']))
    # 本文の全文検索はしない。関連する人物名・別名と編集指定語だけを索引にする。
    terms = list(search_terms.get(a['id'], []))
    for e in refs:
        for person_id in e.get('characters', []):
            person = people.get(person_id, {})
            terms.extend([person.get('display_name') or person.get('name', '')])
            terms.extend(person.get('aliases', []) if isinstance(person.get('aliases', []), list) else [])
    keywords = esc(' '.join(dict.fromkeys(t for t in terms if isinstance(t, str) and t)), quote=True)
    topics = esc(' '.join(search_terms[a['id']]), quote=True)
    cards.append(f'<article class="essay-card" data-category="{esc(a["category"])}" data-chapter="{a["chapter"]}" data-topic-keywords="{topics}" data-reference-keywords="{keywords}"><p class="eyebrow">{esc(a["category"])}</p><h2><a href="./{a["id"]}/">{esc(a["title"])}</a></h2><p>第{a["chapter"]}話までのネタバレ · 考察記事</p><p class="essay-match-reason" hidden></p></article>')
options=''.join(f'<option>{esc(c)}</option>' for c in dict.fromkeys(a['category'] for a in articles))
chapter_options = '<option value="">制限なし</option>' + ''.join(f'<option value="{chapter}">第{chapter}話まで読了</option>' for chapter in range(340, max(e['chapter'] for e in events.values()) + 1))
body=f'''<p class="eyebrow">物語の疑問を、根拠から考える</p><h1>謎・考察</h1><p>作中の謎、能力の解釈、時系列の食い違いを{len(articles)}本の記事にまとめました。各記事で事実・登場人物の推測・この記事の考察を分けています。</p><p>身元など説明が進んだテーマも含みます。記事ごとの参照範囲を確認してください。本文は初期状態では閉じています。</p><div class="essay-filters" hidden><label>記事を探す<input id="essay-search" type="search" placeholder="人物名・テーマで検索"></label><label>分類<select id="essay-category"><option value="">すべて</option>{options}</select></label></div><p id="essay-count" role="status">{len(articles)}本の記事</p><div class="essay-grid">{''.join(cards)}</div><p id="essay-empty" hidden>該当する記事はありません。検索語や分類を変えてください。</p>'''
body = body.replace('</select></label></div>', f'</select></label><label>読んだ話数<select id="essay-read-through">{chapter_options}</select></label></div>')
write_page(out/'index.html', shell('謎・考察',body))
if stale_pages:
    print('Regenerate theory pages with: python scripts/build-theories.py')
    for page in stale_pages:
        print(f'STALE: {page}')
    sys.exit(1)
print(f'PASS: {len(articles)} articles and index match their sources.' if args.check else f'Built {len(articles)} articles and index.')
