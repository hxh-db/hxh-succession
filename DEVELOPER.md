# 開発引き継ぎノート

次にこのプロジェクトを引き継ぐ開発者向けの最低限の手順と場所をまとめたメモです。
このフォルダ自体がサイトのソースであり、ここを直接編集してそのまま `git commit` / push します（他フォルダへのコピー等は不要）。

## 重要ファイル
- `index.html` - メインの HTML（概要／14王子一覧／守護霊獣一覧／護衛・ハンター一覧／派閥マップ／下層勢力マップ／タイムライン）
- `style.css` - スタイル定義
  - イベント種別の色は `.timeline-item.type-<種別>` を参照
  - キャラクターアバターは白背景の線画が見やすい薄色の円で表示する。`mix-blend-mode: multiply` は使わず、念系統ごとの差は淡い背景・枠色で表す
- `script.js` - 描画ロジック、フィルタ、ガント描画など
- `data/characters.json` - キャラクター全件（`type`: prince/queen/hunter/soldier/attendant/mafia/phantom_troupe/official）
- `data/events.json` - タイムラインのイベント全件
- `data/spirit_beasts.json` / `data/factions.json` / `data/mafia.json` - 守護霊獣・派閥・下層マフィアのデータ
- `data/alliances.json` - 別陣営の王子間の共闘関係。人物の `camp` と初期配置の人数には合算しない
- `data/*.schema.json` - 主要な公開JSON 12ファイルに対応するJSON Schema。人物タグ・画像・共闘・出典も検証する
- `validate_data.py` - データ検証スクリプト（プロジェクトルートで実行）
- `images/characters/*.png` - 一部キャラのポートレート。`characters.json` の `image` に存在しないパスを書くと自動で頭文字アバターにフォールバックする（`script.js` の `makeAvatar` 参照）

## ローカル起動（Windows）
このフォルダで以下を実行してください。

```powershell
python local_server.py
```

`run_server.bat` / `run_server.ps1` でも同じことができます（ダブルクリック可）。
その後ブラウザで `http://127.0.0.1:8765/` を開いて確認してください。このローカルサーバーだけがメモを `.local/drafts.json` に自動保存します。`index.html` を直接 `file://` で開くと `fetch` が失敗してデータが表示されないので、必ずサーバー経由にしてください。

## データ編集・追加の流れ

全体の検証は `node scripts/check-project.cjs` で実行できます。重要な保存・復旧・ネタバレ同期の隔離ブラウザ検査も含める場合は `--browser` を付けます。生成元を編集した後は各ビルドを実行し、検証コマンド自体では生成物を更新しません。詳しい保存仕様・前提環境はREADMEを参照してください。
1. `data/events.json` にイベントを追加します。
   - 必須フィールド: `id`（例: `E345-002`）, `chapter`, `description`, `characters`（配列。`characters.json` の `id` か、該当しない無名キャラはそのままの名前文字列）
   - 任意: `chapter_title`, `day`, `time_start`/`time_end`（`HH:MM`）, `room`/`location`, `camp`, `revealed_facts`, `mysteries`, `notes`
2. キャラクターを追加・編集する場合は `data/characters.json` を更新します。`type` ごとに必須となる項目が異なる（例: `prince` は `rank`/`queen`、`hunter`/`soldier`/`attendant` は `position_code`/`role`）ので、既存の同じ `type` のレコードを参考にしてください。
3. `validate_data.py` を実行してデータ整合性を確認します:
```powershell
python validate_data.py
```
4. 変更内容と検証結果を提示し、ユーザーの明示的な承認を得てからcommit・pushします。`jsonschema` のimportに失敗した場合、まず既存のローカル検証パッケージを指定して再実行してください（追加インストール不要）。

```powershell
$env:PYTHONPATH = (Resolve-Path .local/validation-packages).Path
$env:PYTHONIOENCODING = 'utf-8'
python validate_data.py
python -m unittest discover -s tests -p 'test_*.py'
python check_status_sync.py
```

この設定は実行中のPowerShellだけに適用されます。`.local/validation-packages` がない別環境では、その環境のjsonschemaを使ってください。人物や出来事を更新した場合はREADMEの手順で静的人物ページも再生成します。

## キャラクターポートレートの追加
- `images/characters/` に画像を追加し、`characters.json` の `image` または `data/character_images.json` の該当IDにパスと出典URLを設定します。
- 氏名不明の仮称人物には、容姿とレコードの一対一対応が確認できる場合だけ画像を付けます。人数だけが判明しているレコードへ別人の顔を流用しません。
- 白背景の線画はそのまま表示し、淡い背景・枠色で視認性を保ちます。

## イベント種別（type）の追加
- 新しい種別を追加する場合、`style.css` に `.timeline-item.type-あなたの種別` と対応する色（`border-left-color` 等）を追記してください。
- `script.js` は `type` フィールドをそのままクラス名として使うため、種別名にスペースを入れないでください。

## 既知の制約・次に取り掛かると良いタスク（提案）
- ポートレートがない人物は頭文字アバターで表示します。人数だけの仮登録には別人の顔を流用しません。
- ナビの `#timeline` 等のアンカーリンクは、データの非同期読み込み完了前のレイアウトを基準にブラウザがスクロール位置を決めるため、共有リンクや再読み込み直後は意図した位置からずれる場合がある（`script.js` の `init()` 末尾でデータ描画後に `location.hash` への再スクロールを行っている。新しいセクションを追加した際はここも確認すること）
- 出来事のローカル追加UIは実装済みです。追加内容は個人メモとして保存し、公開JSONへの採用は別作業です。
- 個人メモの変更には `DraftState.editItem(previous, changes)` を使います。メモ・内容編集・題名・追加記録の更新日時（`fieldUpdatedAt`）を分け、別タブの異なる変更を保持します。`updatedAt` だけを更新する全項目の置換はバックアップ復元用です。復元時は古い `fieldUpdatedAt` を取り除き、確認済みの上書きを新しい日時で適用します。
- ガントチャートの時間スケールを分単位で厳密に配置する

## 補足
- すべて Windows 環境で開発しています。Unix 系での実行時はスクリプトを適宜書き換えてください。
- 何か引継ぎで追加してほしい情報があれば教えてください。
