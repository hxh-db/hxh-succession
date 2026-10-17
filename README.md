# 王位継承戦データまとめサイト

HUNTER×HUNTER のカキン帝国王位継承戦について、人物・出来事・作中の基礎資料をまとめた静的サイトです。

## 使い方

1. Windowsで `run_server.bat` をダブルクリックします。
2. ブラウザで `http://127.0.0.1:8765/` を開きます。サイトの「詳細」に書いた修正メモは `.local/drafts.json` に自動保存されます。

```powershell
python local_server.py
```

このサイトはPC内だけで動き、公開用JSONは変更しません。Codexに「修正メモを見て」と伝えると、保存された `.local/drafts.json` を確認できます。サーバーを終了してもメモファイルは残ります。`index.html` を直接開いた場合や通常の静的サーバーではPCへの自動保存は使えません。

## ファイル構成

- `theories/` — 謎・考察一覧と15本の静的記事。本文はネタバレ設定に従って初期開閉し、個別にも開けます。
- `scripts/build-theories.py` — 記事の執筆内容と生成処理。編集後に `python scripts/build-theories.py` を実行してください。根拠は `data/events.json` の説明・確認状態を参照し、既存の謎一覧から各記事へリンクします。公開反映は既存の公開手順で別途行います。

- `index.html` - ページ本体
- `style.css` - レイアウトとデザイン
- `script.js` - データ読み込みと描画
- `data/characters.json` - 王子・王妃・護衛/ハンター・マフィア・幻影旅団・官吏などキャラクター全件
- `data/events.json` - タイムラインのイベント一覧
- `data/open_questions.json` - 作中の未解決事項と関連する出来事
- `data/personnel_snapshots.json` - 第374話の王子別兵力と王妃所属兵の配置スナップショット
- `data/personnel_roster.json` - 出航時230枠の名簿、後の加入確認、王妃別の未同定枠。`personnel-roster.js` が話数ごとの表示を計算します。
- `data/personnel_roster_overrides.json` - 初期枠の個人対応の補完、加入確認話数、追加の状態・配置履歴。未知の加入時点を登場話数だけで埋めません。
- 仮登録の氏名・画像などが判明したら、`identity_updates` にその人物IDの項目を追加して再生成するとIDを保って更新できます。既存人物との同定は `slot_identities` で枠を対応付けます。王妃別の未同定枠7件は `roster_projection` として区別し、全体名簿・人物索引の人数へ追加しません。
- `data/personnel_roster_report.md` - 王妃ごとの初期人数、原図記載人数、履歴適用後の人数と残る差。原図と個人記録の照合が完了していない箇所を記録します。
- 人数は「初期復元」「原図記載」「死亡・拘束・辞退・離脱の履歴なし」を区別します。履歴なしには状態未確認も含み、確認済みの稼働人数ではありません。後の時点で状態履歴がない人物を自動で存命とは扱いません。差は登録漏れの人数ではなく、原図の集計範囲・除外条件との対応は未確定です。
- 初期配置は時点フィルタで変更しません。「選択時点の担当」と部屋は別に表示します。過去時点の能力情報はまだ話数別に整理していないため「この時点の能力情報は未整理」と表示し、原作で当時未判明だったとは断定しません。
- 考察記事の参照リンクは `?event=<出来事ID>&from_theory=<記事ID>#timeline` で出来事の詳細を直接開きます。詳細には参照元の記事へ戻るリンクがあります。記事検索の追加語は `scripts/build-theories.py` の `search_terms` に登録し、参照出来事の関連人物名・別名も索引に使います。記事更新後は `python scripts/build-theories.py` で再生成してください。
- 記事本文の話数範囲は同スクリプトの `spoiler_limits` に明記し、`key_points` の要点3点と参照イベントも合わせて更新します。本文・反証を含む範囲を編集時に確認してください（自動検査は明示された話数とイベント参照を検出するもので、文章の意味を完全には検証しません）。`node tests/theory-scope.cjs` で上限と記事構成を検査します。過去名簿では選択話数より後の根拠を必要とする人物説明は表示しません。
- 考察一覧の検索語・分類はURLの `q`・`category` に保存し、記事往復・再読込でも復元します。本文のネタバレ上限、謎データの `last_checked_chapter`（台帳の確認範囲）、記事の最終更新日は別項目です。台帳の話数だけで全話照合済みとせず、照合記録未整備の場合は明記します。更新日は構成・表記の更新日で、原作再照合日とは区別します。
- 記事の主題人物・能力・別名は `search_terms` へ明示登録します。主題一致を優先し、参照イベントの登場人物だけの一致は理由付きで後に表示します。`theory-search.js` はハイフン・全半角等を正規化します。「読んだ話数」は本文の上限が指定話数以内の記事だけを表示し、`read` としてURLへ保存・引継ぎします。検索検査は `node tests/theory-search.cjs`、ブラウザ検査は `node tests/theory-search-browser.cjs`。
- 名簿を更新するときは `node scripts/build-personnel-roster.cjs` → `node scripts/build-initial-personnel-review.cjs` → `node scripts/build-character-pages.cjs`。`node tests/personnel-roster.cjs` で230枠・二重計上・時点・王妃別人数を確認します。未同定人物の仮称は短い役職名＋数字とし、確度は詳細に記載します。
- `data/intake/initial_personnel_review_20261013.md` - 出航時の15人枠＋準協会員を王子別に復元した初期人数案
- `data/intake/initial_personnel_coverage_20261013.md` - 初期230枠と既存人物IDの対応候補・未対応枠・旧人数枠の照合表。`node scripts/build-initial-personnel-review.cjs` で再生成し、`--check` で人物台帳との一致と二重計上等を検査
- `data/spirit_beasts.json` - 王子と国王の人物詳細に表示する守護霊獣データ
- `images/guide/*.webp` - ユーザー提供原作画像から基礎資料用に切り出した引用コマ（話数を画面に表示）
- `data/factions.json` - 派閥（陣営）マップ
- `data/alliances.json` - 王子の陣営とは別に管理する共闘関係
- `data/mafia.json` - 下層デッキのマフィア・幻影旅団マップ
- `data/*.schema.json` - 各JSONに対応するJSON Schema（検証用）
- `images/characters/*.png` - キャラクターのポートレート（一部のみ。未整備のキャラは頭文字アバターで表示）
- `validate_data.py` - データ検証スクリプト

## 機能

- **14王子一覧・護衛・ハンター一覧**: カード表示で検索可能（名前、王妃、部屋、能力、状態等）。念系統・ハンター有無・生死状況に加え、所属・人員区分・資格タグで絞り込み
- **守護霊獣**: 各王子と国王の人物詳細に表示
- **派閥マップ**: 陣営ごとのリーダー・メンバー・戦略を表示
- **下層勢力マップ**: カキン三大マフィアと幻影旅団の組織図（組長・若頭・幹部の能力付き）
- **基礎資料**: 船の階層図、王子の人数と最新状態、第360話の警護派遣ルール、第374話の兵力・所属兵配置、継承戦と壺中卵の儀の共通情報、出典付きの原作コマを表示。人数と最新状態はネタバレを隠して表示
- **出来事一覧**: 時系列・話数別・未解決事項の3表示。未解決事項はネタバレを隠して表示
  - 話数・人物・場所・一連の出来事・大分類したイベント種類で絞り込み
  - 場所は出航セレモニー会場、王子名つきの1001〜1014号室、各階層から選択
  - 画面上のイベント種類は8分類。元データの細かな `type` は詳細表示と内部記録に保持
  - 表示用の目安時刻は「15:22頃？」と表示。「内容は推測」タグは出来事の内容自体が推測の場合だけ使う（一覧のカードでは「再照合待ち」などの例外だけをバッジにし、既定の意味は出来事一覧の上の凡例で説明する）。根拠のない乗船前の日時は入れず、出航35日前など明示された相対日付はそのまま表示する
  - 仮時刻は前後関係・話内の描写順・既存の時計時刻をもとに `time_estimate` に記録し、`time_estimate_basis` で表示用の仮置きであることを区別する。日付未確定の出来事は日付を変えない。配置は全データを基準にするため、人物や話数で絞っても変わらない。前後関係の明示がある場合はそれを優先する
- **詳細モーダル**: 王子・護衛・守護霊獣・イベントをクリックすると詳細と関連イベントを表示。詳細画像はクリック／Enterで拡大でき、拡大画面の「さらに拡大」で2倍表示できる
- **自分用メモ・編集**: 人物一覧の「詳細」と詳細モーダルでメモを入力すると、自動でPC内の `.local/drafts.json` に保存されます。主な項目の編集は「編集を保存」で反映されます。「この項目の編集を戻す」で公開データの表示に戻せます。メモ・編集は公開JSONに反映されません
- **出来事の追加**: タイムラインの「＋ 出来事を追加」から、話数・日・時刻・確度・場所・関係人物・備考を入力できます。追加した出来事はPC内の `.local/drafts.json` に保存され、再読み込み後も表示されます。詳細から編集でき、メモのバックアップにも含まれます。公開JSONには反映されません
- **メモ一覧・バックアップ**: ページ上部で書いたメモを一覧確認できます。必要な場合だけ「バックアップ・復元」を開き、JSONを手動でダウンロード・読み込みできます。`.local/` と `codex-notes*.json` はGitの公開対象から除外しています

## データの管理

### 人物の固有URL・静的ページ

人物URLは `characters/<既存ID>/`（例：`characters/P14/`）です。GitHub Pages の `/hxh-succession/` 配下にも対応する実ファイルを生成します。一覧からは同じ詳細モーダルを開いてURLだけを変更し、戻る・進む・閉じるで一覧の条件と位置を保持します。直接アクセス・再読み込みでは静的ページを表示します。

公開JSONを更新したら、リポジトリ直下で次を実行してください（Node.jsを使用）。

```powershell
node scripts/build-character-pages.cjs
node scripts/build-character-pages.cjs --check
node tests/character-pages.cjs
node tests/character-consistency.cjs
node tests/character-evidence.cjs
node tests/review-followups.cjs
node tests/spoiler-settings.cjs
python validate_data.py
python -m unittest discover -s tests -p "test_*.py"
```

最初に1人だけ試す場合は `node scripts/build-character-pages.cjs --id P14` を使い、確認後に引数なしで全件生成してください。`--check` は生成漏れ・元JSONとの差分を検出します。生成した `characters/` と `sitemap.xml` も、承認後の公開対象に含めます。IDを削除・変更した場合は旧URLの扱いを別途確認してください（スクリプトは既存ページを自動削除しません）。

生成元は公開用の `data/characters.json`、`data/events.json`、`data/count_only_characters.json`、`data/sources.json` です。`.local/` のメモ・編集、調査記録、人物の自由記述メモは静的HTMLに含めません。個人編集は静的ページの「編集状況」の折りたたみにある「一覧の詳細でメモ・編集」から利用できます。

配置履歴・最終確認場所の表記は `character-facts.js` を一覧・モーダル・静的ページで共有します。公開JSONだけでなく、この共通処理を変更した場合も静的ページを再生成してください。配置履歴の王子・出来事・話数・参加人物の対応は `validate_data.py` で検証します。日付の確度が未入力の場合は、登録済みの日付を「確度未確認」と表示し、確定へ自動昇格させません。画面間の一致確認は `tests/CHARACTER_CONSISTENCY_QA.md` を参照してください。

人物の `review_claims` は出来事の確認状態を継承して通常の紹介から分離します。`status_log.event_id` は同じ死亡事件の履歴漏れ・話数不一致を検証します。所在は `character_presence`（`present` 本人／`body` 遺体／`mentioned` 話題のみ／`remote` 遠隔／`unknown` 未判定）で関係人物と分けます。未判定は所在候補であり、出典の確認済みを意味しません。時計がない場面を午前0時とは扱いません。

出来事の `editorial_questions` は日時・出典などの編集上の確認課題です。作品内の問いは `mysteries` に残し、現在の解決状況を照合できた場合だけ `mystery_updates` に対象の `text`、`status`（`unreviewed`／`open`／`resolved`）、根拠の `related_event_ids`、必要なら `review_note` を記録します。未入力は「その話時点の疑問・現在は未判定」です。推測だけで解決済み／現在も未解決へ更新しません。原作再照合待ちの参照は、解決状況にも再照合待ちと表示します。

レビュー対応と保留事項は `data/intake/consistency_review_20261009.md`、追加の検証記録は `tests/CHARACTER_EVIDENCE_QA.md` を参照してください。収録件数・参照検証の成功は原作の正誤の保証ではありません。

人物索引と個別ページのCSS参照はトップページ `index.html` のバージョンを生成時に共有します。CSSを変更してキャッシュバージョンを更新する場合はトップページを更新して再生成し、索引だけ古い版に戻らないことを `tests/review-followups.cjs` で確認してください。

初期配置などの基本情報はJavaScript実行前から読めます。後の展開を含む詳細は初期HTMLでは閉じた `details` に入れ、`data-nosnippet` を指定しています。title・descriptionには能力・生死などを載せません。JavaScript有効時は一覧と同じネタバレ設定を使い、無効時も手動で詳細を開けます。折りたたみを手で開いても共通のネタバレ設定は変わりません（一覧の人物カード・人物詳細も同様で、後の話の情報はその人物の中の「後の話の情報を表示」で開きます。回帰テストは `tests/spoiler-settings.cjs`）。検索エンジンでの表示はサービス側の判断ですが、検索向け説明文に後の展開は出しません。

ローカル確認例：`http://127.0.0.1:8765/characters/P14/`。検証用 `tests/fixtures/character-nojs.html` はスクリプト実行を禁止したフレームで索引・人物ページを確認します。`tests/` は検証用で、公開コンテンツではありません。確認記録は `tests/CHARACTER_PAGES_QA.md` を参照してください。

### スキーマ検証

各 JSON ファイルには対応するスキーマファイル（`.schema.json`）が定義されています。

```powershell
python validate_data.py
```

このスクリプトはすべてのデータを JSON スキーマに対して検証し、エラーを報告します（`pip install jsonschema` が必要）。

## 拡張ポイント

- `data/events.json` にイベントを追加（必須: `id`, `chapter`, `description`, `characters`。任意: `time_start`/`time_end`, `time_estimate`, `time_estimate_basis`, `room`/`location`, `revealed_facts`, `mysteries` 等）。確定していない時刻は `time_start` に入れず、目安や表示用の仮時刻を `time_estimate` に記録し、根拠を `time_estimate_basis` で出典に紐づける
- `images/characters/` にポートレートを追加し、`characters.json` の該当キャラに `image` フィールドを設定
- イベント種別（`type` フィールド）を拡張する場合は `style.css` に `.timeline-item.type-<種別>` 等の色定義を追記
- カスタムフィルター機能の追加
