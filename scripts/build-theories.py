"""Build static, source-linked theory pages. Run from any directory."""
import json
import re
from pathlib import Path
from html import escape as esc

ROOT = Path(__file__).resolve().parents[1]
questions = json.loads((ROOT / 'data/open_questions.json').read_text(encoding='utf-8'))
events = {e['id']: e for e in json.loads((ROOT / 'data/events.json').read_text(encoding='utf-8'))}
# Each entry: neutral title, conclusion, interpretation, counterargument, next evidence.
editorial = {
'Q001': ['1014号室の最初の殺害は、誰の仕業か', '初期の死亡事件を、後の講習会の暗殺と同一犯だと断定する根拠は足りない。', '警護を短時間で減らすという結果に注目すると、王子そのものへの攻撃だけでなく、防衛体制の弱体化を狙った可能性も考えられる。まずウッディーの発見と残る4名の発見を分け、接触できた人物と時間帯を比較したい。', '遺体の外見や発生場所の類似だけでは能力も犯人も特定できない。複数の襲撃が重なった可能性も残る。サイールドによる後の襲撃は別の記録であり、最初の5名と混ぜない。', '攻撃の瞬間、能力の条件、術者の独白のいずれかが初期の遺体と結び付くか。'],
'Q002': ['サイレントマジョリティーの術者をどう絞るか', '人形が憑いた人物と術者を同一視せず、観測できる条件から絞るのが妥当。', 'ロベリーが人形を認識したことは能力の仕掛けの一部と読める。術者候補を考えるなら、講習会の情報を得られたか、攻撃時に条件を満たせたかを別々に評価する必要がある。', 'クラピカが同じ犯人の遠隔操作と判断したことは重要だが、読者に術者の正体まで示されたことにはならない。落ち着いた態度や視線だけで特定する説は弱い。', '術者側の視点と参加者の行動が対応する描写、射程や標的選択の制限。'],
'Q003': ['船外への脱出は、なぜ阻まれるのか', '物理的に船を離れることと、継承戦から離脱できることは別と考える必要がある。', '救命艇を用意しても無数の手に阻まれるため、通常の警備を突破するだけでは解決しない仕組みが示唆される。儀式による拘束という読みは自然だが、誰が発動させたかは別の問題だ。', '一度の脱出場面だけで、全王子・全経路・全距離に同じ規則が適用されるとは確定できない。船外に出た瞬間が条件か、継承戦から逃れる意図が条件かも区別できない。', '境界、対象者、例外を明示する説明。同じ条件で別の人物が移動する場面。'],
'Q004': ['チョウライのコインは何を蓄積するのか', '蓄積と所有者の変化が手掛かり。ただし具体的な利益や支配の効果は分けて検証したい。', '時間と数字の変化、受け渡しと絵柄の変化を別の変数と見ると整理しやすい。長く持つほど利益が増す仕組みなら、受領者が自発的にコインを保持する誘因にもなり得る。これは効果の確定ではなく機能の仮説である。', 'クラピカの蓄積型・操作系の見立ては作中人物の推察。数字をそのまま金額、忠誠度、操作の強さと読む根拠はない。第417話の操作に関する報告も、条件全体の実証とは分ける。', '誰が何日持ち、誰へ渡し、何が起きたかを同じ硬貨で追える記録。'],
'Q005': ['フウゲツの異変と能力の変化はつながるか', '能力の使用回数の増加と衰弱は並行して描かれるが、原因と結果の方向は未確定。', '便利になった能力を繰り返し使わせる仕掛けなら、本人が異常を利点だと受け取る点に罠の強さがある。センリツの依存性への懸念とも整合する読みだ。', '衰弱で邪霊が寄ったのか、邪霊が衰弱を招いたのか、別の攻撃が両方を起こしたのかは切り分けが必要。ルズールスへの疑いは登場人物の推理で、犯人確定ではない。', '使用回数と体調の関係、背中の痕の由来、術者を排除した場合の変化。'],
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
    refs=['E361-001','E361-005','E364-006','E365-004','E366-002','E368-002','E369-001'], chapter=369, status='時間描写の不整合を検討'))

def shell(title, body, depth=0, article_id=None):
    base = '../' * (depth + 1)
    if article_id:
        body = (f'<div data-theory-id="{esc(article_id, quote=True)}">{body}</div>'
                f'<script src="{base}theories/theory-memos.js?v=20261013a"></script>')
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} | 王位継承戦データまとめ</title><meta name="description" content="王位継承戦の謎を、参照場面・考察・反証に分けて整理。"><link rel="stylesheet" href="{base}style.css"><link rel="stylesheet" href="{base}theories/theories.css?v=20261015-article-state"></head><body><a class="skip-link" href="#main">本文へ移動</a><header class="essay-header"><a href="{base}index.html">王位継承戦データまとめ</a><nav aria-label="メインメニュー"><a href="{base}index.html#characters">人物一覧</a><a href="{base}index.html#timeline">出来事</a><a href="{base}index.html#guide">基礎資料</a><a href="{base}theories/" aria-current="{'page' if depth == 0 else 'false'}">謎・考察</a></nav></header><main id="main" class="essay-main">{body}</main><footer class="essay-main">個人による考察です。原作の事実と仮説を分けて記載しています。</footer><script src="{base}theories/theories.js?v=20261015-article-state"></script></body></html>'''

out = ROOT / 'theories'
out.mkdir(exist_ok=True)
cards = []
for a in articles:
    refs = [events[i] for i in a['refs']]
    question = next((q for q in questions if q['id'] == a['id']), None)
    checked = question.get('last_checked_chapter') if question else None
    # 台帳の話数だけから原作全話の照合完了へ昇格しない。
    checked_label = (f'第{checked}話（謎データの登録値。未解決状況を全話再照合した記録は未整備）'
                     if checked else '未登録（この記事独自の確認記録は未整備）')
    metadata = f'<dl class="article-metadata"><dt>本文のネタバレ</dt><dd>第{a["chapter"]}話まで</dd><dt>未解決状況の確認範囲（台帳）</dt><dd>{checked_label}</dd><dt>記事の最終更新日</dt><dd><time datetime="2026-10-15">2026年10月15日</time>（構成・表記の更新日。原作再照合日ではありません）</dd></dl>'
    assert max(e['chapter'] for e in refs) <= a['chapter'], f'{a["id"]}: 参照場面が上限を超えています'
    mentioned = [int(n) for n in re.findall(r'第?(\d{3})話', ' '.join(str(a[k]) for k in ['conclusion', 'theory', 'weakness', 'next_step']) + ' '.join(key_points[a['id']]))]
    assert not mentioned or max(mentioned) <= a['chapter'], f'{a["id"]}: 本文の話数が上限を超えています'
    points = '<ul class="key-evidence">' + ''.join(f'<li>{esc(point)}</li>' for point in key_points[a['id']]) + '</ul>'
    comparison = ''
    if a['id'] == 'Q001':
        comparison = '<h3>仮説の比較（この記事の考察）</h3><div class="comparison-scroll"><table><tr><th>仮説</th><th>説明できる可能性がある点</th><th>足りない証拠</th></tr><tr><td>後の講習会の暗殺と同じ術者</td><td>被害の共通点を一つの仕組みで説明できる可能性</td><td>初期事件とその能力を直接結ぶ描写</td></tr><tr><td>別の術者・別の事件</td><td>複数勢力による襲撃が重なる可能性</td><td>初期事件固有の攻撃手段と術者の描写</td></tr></table></div><p>現状はどちらにも決め手がありません。被害の類似だけで同一犯説を優先せず、初期事件に固有の証拠を待つのが妥当です。</p>'
    evidence = ''.join(f'<li><a href="../../index.html?t_chapter={e["chapter"]}&amp;event={esc(e["id"])}&amp;from_theory={esc(a["id"])}#timeline">第{e["chapter"]}話：この出来事の詳細を開く</a><p>{esc(e["description"])}</p><small>{esc(e["id"])} · {"原作確認記録あり" if e.get("verification_status") == "review_recorded" else "再照合・推測を含む記録"}</small></li>' for e in refs)
    related = '<a href="../Q012/">ドルフィンの解除条件の考察</a>' if a['id']=='emperor-time' else '<a href="../emperor-time/">発動時刻と12時間の食い違い</a>' if a['id']=='Q012' else ''
    timeline = '<table><caption>第369話からの逆算（確定時刻ではない）</caption><tr><th>開始</th><th>失神</th><th>覚醒</th></tr><tr><td>1日目18時ごろ</td><td>1日目21時ごろ</td><td>2日目6時ごろ</td></tr></table>' if a['id']=='emperor-time' else ''
    body = f'''<a href="../">← 謎・考察一覧</a><p class="eyebrow">{esc(a['category'])}</p><h1>{esc(a['title'])}</h1><p>本文を含むネタバレ範囲：第{a['chapter']}話まで · 執筆日：2026年10月13日</p><p class="scope-note">{esc(a['status'])}。原作全話での未解決を保証する一覧ではありません。参照場面は既存の照合記録に基づきます。</p><details class="spoiler-article"><summary>第{a['chapter']}話までのネタバレを含む記事を読む</summary><nav class="toc" aria-label="記事の目次"><a href="#conclusion">結論</a><a href="#key-points">重要な根拠3点</a><a href="#theory">考察</a><a href="#limits">反証・限界</a><a href="#evidence">詳しい参照場面</a></nav><h2 id="conclusion">現時点の結論</h2><p class="conclusion">{esc(a['conclusion'])}</p><h2 id="key-points">重要な根拠3点</h2>{points}<h2 id="theory">考察：どう読むと説明できるか</h2><p>{esc(a['theory'])}</p>{timeline}{comparison}<h2 id="limits">反証・断定できない点</h2><p>{esc(a['weakness'])}</p><h2>何が分かれば判断が進むか</h2><p>{esc(a['next_step'])}</p>{related}<details class="evidence-details" id="evidence"><summary>詳しい参照場面と確認状態を開く（{len(refs)}件）</summary><ul class="evidence">{evidence}</ul></details></details><p><a href="../">謎・考察一覧へ戻る</a></p>'''
    body = body.replace('重要な根拠3点', 'この記事の要点3つ')
    body = body.replace(f'<p>本文を含むネタバレ範囲：第{a["chapter"]}話まで · 執筆日：2026年10月13日</p>', metadata)
    dest=out/a['id']; dest.mkdir(exist_ok=True)
    (dest/'index.html').write_text(shell(a['title'], body, 1, a['id']), encoding='utf-8')
    # 本文の全文検索はしない。関連する人物名・別名と編集指定語だけを索引にする。
    terms = list(search_terms.get(a['id'], []))
    for e in refs:
        for person_id in e.get('characters', []):
            person = people.get(person_id, {})
            terms.extend([person.get('display_name') or person.get('name', '')])
            terms.extend(person.get('aliases', []) if isinstance(person.get('aliases', []), list) else [])
    keywords = esc(' '.join(dict.fromkeys(t for t in terms if isinstance(t, str) and t)), quote=True)
    cards.append(f'<article class="essay-card" data-category="{esc(a["category"])}" data-keywords="{keywords}"><p class="eyebrow">{esc(a["category"])}</p><h2><a href="./{a["id"]}/">{esc(a["title"])}</a></h2><p>第{a["chapter"]}話までのネタバレ · 考察記事</p></article>')
options=''.join(f'<option>{esc(c)}</option>' for c in dict.fromkeys(a['category'] for a in articles))
body=f'''<p class="eyebrow">物語の疑問を、根拠から考える</p><h1>謎・考察</h1><p>作中の謎、能力の解釈、時系列の食い違いを15本の記事にまとめました。各記事で事実・登場人物の推測・この記事の考察を分けています。</p><p>身元など説明が進んだテーマも含みます。記事ごとの参照範囲を確認してください。本文は初期状態では閉じています。</p><div class="essay-filters" hidden><label>記事を探す<input id="essay-search" type="search" placeholder="人物名・テーマで検索"></label><label>分類<select id="essay-category"><option value="">すべて</option>{options}</select></label></div><p id="essay-count" role="status">15本の記事</p><div class="essay-grid">{''.join(cards)}</div><p id="essay-empty" hidden>該当する記事はありません。検索語や分類を変えてください。</p>'''
(out/'index.html').write_text(shell('謎・考察',body),encoding='utf-8')
print(f'Built {len(articles)} articles and index.')
