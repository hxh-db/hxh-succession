"""Generate the source-linked research catalog; --check never writes files."""
import argparse
import json
import sys
from collections import Counter
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS = {
    'confirmed_supplement': '公式資料で補足',
    'already_recorded': '既存収録を確認',
    'needs_primary': '一次資料の照合待ち',
    'hypothesis': '考察として収録',
    'superseded': '後の説明と対照',
    'excluded': '確定情報への採用見送り',
}


def build():
    read = lambda name: json.loads((ROOT / 'data' / f'{name}.json').read_text(encoding='utf-8'))
    data = read('web_research')
    sources = {s['id']: s for s in read('sources')}
    people = {p['id']: p for p in read('characters')}
    events = {e['id']: e for e in read('events')}
    cards = []
    for row in data['entries']:
        refs = []
        for source_id in row['source_ids']:
            source = sources[source_id]
            url = source['url']
            assert not url or url.startswith('https://'), f'{source_id}: public HTTPS source required'
            access = '検索インデックス確認・本文未取得' if source.get('verification_status') == 'search_index_checked' else '出典台帳の確認範囲を参照'
            if source_id.startswith('togashi-x-'):
                access = '既存の2026-10-09一次画像確認を参照・今回は本文取得不可'
            title = escape(source['title'])
            source_link = f'<a href="{escape(url, quote=True)}" rel="noopener noreferrer">{title}</a>' if url else title
            refs.append(f'<li>{source_link}<p>{escape(source["supports"])}</p><small>{access}。{escape(source.get("notes", ""))}</small></li>')
        connections = []
        for person_id in row['related_character_ids']:
            connections.append(f'<a href="../characters/{escape(person_id, quote=True)}/">{escape(people[person_id].get("display_name") or people[person_id]["name"])}</a>')
        for event_id in row['related_event_ids']:
            assert events[event_id]['chapter'] <= row['chapter'], f'{row["id"]}: spoiler range'
            connections.append(f'<a href="../index.html?event={escape(event_id, quote=True)}#timeline">第{events[event_id]["chapter"]}話の関連場面</a>')
        for article_id in row['related_theory_ids']:
            assert (ROOT / 'theories' / article_id / 'index.html').exists(), article_id
            connections.append(f'<a href="../theories/{escape(article_id, quote=True)}/">関連する考察記事（記事側の話数範囲を確認）</a>')
        keywords = ' '.join([row['id'], row['title'], *row['keywords'], *row['related_theory_ids']])
        body = ''.join(f'<h3>{title}</h3><p>{escape(row[field])}</p>' for title, field in [
            ('見つかった情報', 'summary'), ('今のデータとの比較', 'database_comparison'),
            ('取り込み方と留保', 'assessment'), ('次に確認する根拠', 'next_check')])
        cards.append(f'''<article class="research-card" id="{row['id']}" data-category="{escape(row['category'])}" data-status="{row['status']}" data-chapter="{row['chapter']}" data-keywords="{escape(keywords, quote=True)}">
<p class="eyebrow">{escape(row['category'])} · {LABELS[row['status']]}</p><h2>{escape(row['title'])}</h2>
<p>第{row['chapter']}話までの照合を含む · 調査日 <time datetime="{row['checked_at']}">{row['checked_at']}</time></p>
<details class="spoiler-article" data-nosnippet><summary>調査内容と出典を開く</summary>{body}
<h3>出典と確認範囲</h3><ul class="evidence">{''.join(refs)}</ul>
<p>関連記録：{' ／ '.join(connections) if connections else '資料の入手・判読を待って照合します。'}</p>
<p><a href="#{row['id']}">この調査項目へのリンク</a></p></details></article>''')
    counts = Counter(r['status'] for r in data['entries'])
    tally = ' ／ '.join(f'{LABELS[key]} {counts[key]}件' for key in LABELS if counts[key])
    categories = ''.join(f'<option>{escape(c)}</option>' for c in dict.fromkeys(r['category'] for r in data['entries']))
    status_options = ''.join(f'<option value="{s}">{label}</option>' for s, label in LABELS.items())
    chapters = ''.join(f'<option value="{c}">第{c}話まで読了</option>' for c in range(340, max(e['chapter'] for e in events.values()) + 1))
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Web調査と追加資料 | 王位継承戦データまとめ</title><meta name="description" content="作者の設定資料、公式資料、細かな考察を出典・採否・未確認点とともに整理。">
<link rel="stylesheet" href="../style.css?v=20261029-table-reading"><link rel="stylesheet" href="../theories/theories.css?v=20261018-reading"><link rel="stylesheet" href="research.css?v=20261026"></head>
<body><a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><div class="header-inner"><a class="site-title" href="../index.html">王位継承戦データまとめ</a><p>出典から追加情報を調べる</p></div>
<nav class="primary-nav" aria-label="メインメニュー"><a class="primary-nav-link" href="../index.html#characters">人物一覧</a><a class="primary-nav-link" href="../index.html#timeline">出来事</a><a class="primary-nav-link" href="../index.html#guide">基礎資料</a><a class="primary-nav-link" href="../theories/">謎・考察</a></nav></header>
<main id="main" class="essay-main"><div id="spoilerPreferences" class="spoiler-preferences" data-latest-chapter="{max(e['chapter'] for e in events.values())}" hidden></div><p><a href="../theories/">← 謎・考察</a></p><h1>Web調査と追加資料</h1>
<p>作者の人物表、公式資料、細かな考察を{len(data['entries'])}件に整理しました。公式の補足、一次資料待ちの候補、読者の仮説を分けて読めます。</p>
<p>{escape(data['scope'])}</p><p class="research-tally">{tally}</p>
<p>本文は初期状態では閉じています。「資料の対象話数」は各資料全体の話数上限で絞り込む条件で、全画面の表示設定とは別です。外部記事は後から更新される場合があり、リンク先のネタバレ範囲は各サイトで確認してください。</p>
<div class="essay-filters" id="research-filters" hidden><label>人物名・テーマ<input id="research-search" type="search" placeholder="例：人物表、カイザル、コイン"></label>
<label>分類<select id="research-category"><option value="">すべて</option>{categories}</select></label>
<label>取り込み状況<select id="research-status"><option value="">すべて</option>{status_options}</select></label>
<label>資料の対象話数<select id="research-read"><option value="">制限なし</option>{chapters}</select></label></div>
<p id="research-count" role="status">{len(data['entries'])}件の調査項目</p><div class="research-list">{''.join(cards)}</div><p id="research-empty" hidden>条件に合う調査項目はありません。</p>
</main><script src="../spoiler-preferences.js?v=20261028-ui"></script><script src="../theories/theory-search.js?v=20261015-search"></script><script src="../theories/theories.js?v=20261029-native-links"></script><script src="research.js?v=20261026"></script></body></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'research' / 'index.html'
    content = build()
    if args.check:
        if not path.exists() or path.read_text(encoding='utf-8') != content:
            print('STALE: research/index.html; run python scripts/build-web-research.py')
            return 1
        print('PASS: research catalog matches its sources.')
    else:
        path.parent.mkdir(exist_ok=True)
        path.write_text(content, encoding='utf-8', newline='\n')
        print('Built research catalog.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
