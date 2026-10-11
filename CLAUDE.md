# 王位継承戦データベース（HUNTER×HUNTER）

物語の事実を引くための検索型データベース（静的 HTML/JS/JSON）。読み物・考察記事ではない。このフォルダが正本で、公開先は GitHub Pages（`https://hxh-db.github.io/hxh-succession/`、origin `hxh-db/hxh-succession`）。2026-10-10 に Codex から引き継いだ。開発手順の詳細は `DEVELOPER.md` と `README.md` を参照。

## 承認ゲート（必ず守る）
- コミット・push・公開反映は、ユーザーの明示的な承認があるときだけ行う。設計や方針への合意を実装・コミットの承認とみなさない。
- push する場合は、確認済みのまとまりだけをステージする。無関係な作業や未対応の添付バッチは混ぜない。push と公開サイトでの反映確認は分けて報告する。
- このフォルダを別の場所へコピー・移動しない。

## 確認コマンド（変更後に実行）
```
python validate_data.py
node scripts/build-character-pages.cjs --check
node tests/character-pages.cjs
node tests/character-consistency.cjs
node tests/character-evidence.cjs
node tests/review-followups.cjs
node tests/timeline-labels.cjs
node tests/author-settings.cjs
node tests/link-check.cjs
node tests/spoiler-settings.cjs
node tests/avatar-zoom.cjs
node tests/search-spoilers.cjs
node tests/simultaneous-scenes.cjs
node tests/location-certainty.cjs
python -m unittest discover -s tests -p "test_*.py"
```
- 人物データや `character-facts.js` を変えたら `node scripts/build-character-pages.cjs` で `characters/` と `sitemap.xml` を再生成する。最初の1人は `--id <ID>` で試す。
- CSS のキャッシュバージョンは `index.html` を正とし、再生成で索引・個別ページに揃える。
- ローカル確認は `python local_server.py` → `http://127.0.0.1:8765/`。`file://` では動かない。画面の確認はスマホ幅も含めて行う。

## データの原則
- 根拠の優先順：ユーザーが提供した原作ページ ＞ 411話より前の単行本 ＞ 411話以降の雑誌掲載本文 ＞ ユーザーのメモ・文字起こし ＞ 二次情報。
- 原作で確認していない情報を確定扱いにしない。`verification_status` を自動で「原作確認」に上げない。判読できない箇所は「判読不明」と書く。
- 時刻：物語の中で明示された時刻は確定とする。時計・キャプションの表示だけでなく、「出航4時間後」「出航より18時間経過」「発令まであと5分」のような、確定時刻からの経過表示で決まる時刻も含む（出航は日曜12:00＝第374・381話の経過表示と日時表示から確定）。ただし台詞の中の予定時刻（「14時15分に発令する」）や、別の場面・配置図の時刻を流用したものは、その場面の時刻ではないので仮時刻にする（2026-10-11 ユーザー方針）。原作で確認した時刻だけを確定として表示する。同じ頃と推定されるものは `14:00頃？` の形にする。乗船前で出典のない出来事には時刻を作らない。時計の入力がないことを0時として扱わない。
- 同時刻の別場面：同じ瞬間（同じ放送・鳴動・合図など）を別の場所から描いた場面は `simultaneous_with` で相互に結び、日付と時刻をそろえる（確定時刻があればそれに合わせ、仮時刻の根拠は `editorial-simultaneous-scenes-20261011`）。同じ瞬間だと画像・台詞で言えるものだけを結び、似ているだけ・時計の値が同じだけの場面は結ばない（2026-10-11 ユーザー方針。例：第400話の緊急放送＝第404話の第9王子逝去の放送）。
- 場面転換のカット：船の外観・水平線の太陽などの場面転換のカットは時間の経過を表すものとして扱い、日付の表示がない区間の日付の切れ目はこうしたカットや監視映像の経過（『数時間後』）の位置に置いてよい（2026-10-11 ユーザー見解）。昼の空で前後の場面が直接続くカットは同じ日の区切りとして扱う。仮時刻の根拠は `editorial-scene-transition-days-20261011`（例：第394話の2つのカットで10日目→11日目→12日目、E394-004 を11日目）。
- 所在は「本人／遺体／話題のみ／遠隔／未判定」に分ける。`initial_room`、現在の配置、`camp` は別物として扱う。
- `nen_user: false` を「固有の念能力は未確認」の意味で使わない。
- 編集の前に「対象：第◯話、ページ：◯〜◯」を明示し、既存イベントの `chapter` と一致するか確かめる（以前、411話を400話と取り違えた）。
- 原作画像は `.codex-remote-attachments/`（git管理外）に置いたまま参照する。公開リポジトリにはコピーしない。画像と場面の対応が確認できないものは登録しない。
- ネタバレ設定は人物・出来事・基礎資料で共通にする。後の話の情報は初期状態で隠す。
- 一覧からはモーダルで開き、URLは History API で更新する。静的な人物ページは、検索や直リンクから入るための入口として扱う。

## 未完了の課題（2026-10-10 時点）
- 2026-10-10 の第343〜420話の再照合とユーザー判断の反映で決着したもの：`data/intake/consistency_review_20261009.md` の5項目のうち、サンドラの死亡話数（第363話）、ヒュリコフの能力（〝鋼の錬金術師〟）、411話以降の身元（第14王子＝オイトの娘として扱う）、画像のある話の全イベント再照合。添付バッチ（360・371・406〜410話）も照合済みで、358話は画像なし。経緯は `data/AUDIT.md` の 2026-10-10 節。
- 残り：351〜358・396〜397話は画像がなく未照合。第347話（E347-001）も2026-10-10の再照合の対象に入っていない。一部未確認（`unverified` のまま）の30件。フィンクスの能力名・条件は第377〜382話の画像に出てこない。未登録の人物や、名前表記の食い違い（登録名は変えず `notes` に画像の表記を記録）、2026-10-08 の退室時刻仮説と第359話の画像の食い違い（仮説は維持）など。各話の未解決の指摘は `data/intake/ch<話数>_reconcile_20261010.md` と `.local/reconcile-20261010/apply_report.txt` の「未解決・担当外の指摘」。
- 監査の状況は `data/AUDIT.md`、未着手の作業は `data/research_backlog.json` にある。
