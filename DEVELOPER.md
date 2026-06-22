# 開発引き継ぎノート

次にこのプロジェクトを引き継ぐ開発者向けの最低限の手順と場所をまとめたメモです。
このフォルダ自体がサイトのソースであり、ここを直接編集してそのまま `git commit` / push します（他フォルダへのコピー等は不要）。

## 重要ファイル
- `index.html` - メインの HTML（概要／14王子一覧／守護霊獣一覧／護衛・ハンター一覧／派閥マップ／下層勢力マップ／タイムライン）
- `style.css` - スタイル定義
  - イベント種別の色は `.timeline-item.type-<種別>` を参照
  - キャラクターアバターは念系統カラーの円に `mix-blend-mode: multiply` で線画ポートレート（白背景）を重ねている。新しい色を追加する場合は `.nen-avatar-<系統名>` の `background` も合わせて定義する
- `script.js` - 描画ロジック、フィルタ、ガント描画など
- `data/characters.json` - キャラクター全件（`type`: prince/queen/hunter/soldier/attendant/mafia/phantom_troupe/official）
- `data/events.json` - タイムラインのイベント全件
- `data/spirit_beasts.json` / `data/factions.json` / `data/mafia.json` - 守護霊獣・派閥・下層マフィアのデータ
- `data/*.schema.json` - 上記5ファイルに対応するJSON Schema
- `validate_data.py` - データ検証スクリプト（プロジェクトルートで実行）
- `images/characters/*.png` - 一部キャラのポートレート。`characters.json` の `image` に存在しないパスを書くと自動で頭文字アバターにフォールバックする（`script.js` の `makeAvatar` 参照）

## ローカル起動（Windows）
このフォルダで以下を実行してください。

```powershell
python -m http.server 8000
```

`run_server.bat` / `run_server.ps1` でも同じことができます（ダブルクリック可）。
その後ブラウザで `http://localhost:8000` を開いて確認してください。`index.html` を直接 `file://` で開くと `fetch` が失敗してデータが表示されないので、必ずサーバー経由にしてください。

## データ編集・追加の流れ
1. `data/events.json` にイベントを追加します。
   - 必須フィールド: `id`（例: `E345-002`）, `chapter`, `description`, `characters`（配列。`characters.json` の `id` か、該当しない無名キャラはそのままの名前文字列）
   - 任意: `chapter_title`, `day`, `time_start`/`time_end`（`HH:MM`）, `room`/`location`, `camp`, `revealed_facts`, `mysteries`, `notes`
2. キャラクターを追加・編集する場合は `data/characters.json` を更新します。`type` ごとに必須となる項目が異なる（例: `prince` は `rank`/`queen`、`hunter`/`soldier`/`attendant` は `position_code`/`role`）ので、既存の同じ `type` のレコードを参考にしてください。
3. `validate_data.py` を実行してデータ整合性を確認します:
```powershell
python validate_data.py
```
4. 問題なければそのまま commit します（`pip install jsonschema` が未導入の場合は事前に入れてください）。

## キャラクターポートレートの追加
- `images/characters/` に PNG を追加し、`characters.json` の該当レコードの `image` にパスを設定します。
- 線画（白背景）を想定したCSS処理（`mix-blend-mode: multiply`）になっているため、白背景の線画素材であればそのまま追加するだけでテーマに馴染みます。背景が透過でない写真調の画像を使う場合は見た目が変わるので要確認。

## イベント種別（type）の追加
- 新しい種別を追加する場合、`style.css` に `.timeline-item.type-あなたの種別` と対応する色（`border-left-color` 等）を追記してください。
- `script.js` は `type` フィールドをそのままクラス名として使うため、種別名にスペースを入れないでください。

## 既知の制約・次に取り掛かると良いタスク（提案）
- `characters.json` の118キャラのうちポートレートがあるのは一部のみ。残りは頭文字アバターのまま
- ナビの `#timeline` 等のアンカーリンクは、データの非同期読み込み完了前のレイアウトを基準にブラウザがスクロール位置を決めるため、共有リンクや再読み込み直後は意図した位置からずれる場合がある（`script.js` の `init()` 末尾でデータ描画後に `location.hash` への再スクロールを行っている。新しいセクションを追加した際はここも確認すること）
- イベント追加用の入力UI（管理画面）を作り、JSONを自動生成・検証する
- ガントチャートの時間スケールを分単位で厳密に配置する

## 補足
- すべて Windows 環境で開発しています。Unix 系での実行時はスクリプトを適宜書き換えてください。
- 何か引継ぎで追加してほしい情報があれば教えてください。
