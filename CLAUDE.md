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
python -m unittest discover -s tests -p "test_*.py"
```
- 人物データや `character-facts.js` を変えたら `node scripts/build-character-pages.cjs` で `characters/` と `sitemap.xml` を再生成する。最初の1人は `--id <ID>` で試す。
- CSS のキャッシュバージョンは `index.html` を正とし、再生成で索引・個別ページに揃える。
- ローカル確認は `python local_server.py` → `http://127.0.0.1:8765/`。`file://` では動かない。画面の確認はスマホ幅も含めて行う。

## データの原則
- 根拠の優先順：ユーザーが提供した原作ページ ＞ 411話より前の単行本 ＞ 411話以降の雑誌掲載本文 ＞ ユーザーのメモ・文字起こし ＞ 二次情報。
- 原作で確認していない情報を確定扱いにしない。`verification_status` を自動で「原作確認」に上げない。判読できない箇所は「判読不明」と書く。
- 時刻：原作で確認した時刻だけを確定として表示する。同じ頃と推定されるものは `14:00頃？` の形にする。乗船前で出典のない出来事には時刻を作らない。時計の入力がないことを0時として扱わない。
- 所在は「本人／遺体／話題のみ／遠隔／未判定」に分ける。`initial_room`、現在の配置、`camp` は別物として扱う。
- `nen_user: false` を「固有の念能力は未確認」の意味で使わない。
- 編集の前に「対象：第◯話、ページ：◯〜◯」を明示し、既存イベントの `chapter` と一致するか確かめる（以前、411話を400話と取り違えた）。
- 原作画像は `.codex-remote-attachments/`（git管理外）に置いたまま参照する。公開リポジトリにはコピーしない。画像と場面の対応が確認できないものは登録しない。
- ネタバレ設定は人物・出来事・基礎資料で共通にする。後の話の情報は初期状態で隠す。
- 一覧からはモーダルで開き、URLは History API で更新する。静的な人物ページは、検索や直リンクから入るための入口として扱う。

## 未完了の課題（2026-10-09 時点）
- `data/intake/consistency_review_20261009.md` の「原作再照合が必要」の5項目（サンドラの死亡話数、ヒュリコフの能力、411話以降の身元・行動、フィンクスの能力名、全イベントの再照合）。
- 未対応の添付バッチ：358・360・371・406〜410話。画像と場面の対応付けを推測で行わない。
- 監査の状況は `data/AUDIT.md`、未着手の作業は `data/research_backlog.json` にある。
