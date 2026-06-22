# 王位継承戦データまとめサイト

HUNTER×HUNTER のカキン帝国王位継承戦（暗黒大陸編）について、14王子・守護霊獣・護衛/ハンター・派閥・下層マフィア・タイムラインをまとめた静的サイトです。

## 使い方

1. `index.html` をブラウザで表示します。
2. 直接開く場合、ブラウザにより `fetch` が動作しないことがあります（データを読み込めず空白になります）。その場合は簡易サーバーを使ってください。

```powershell
python -m http.server 8000
```

またはこのフォルダにある `run_server.bat` / `run_server.ps1` を実行し、`http://localhost:8000` を開きます。

## ファイル構成

- `index.html` - ページ本体
- `style.css` - レイアウトとデザイン
- `script.js` - データ読み込みと描画
- `data/characters.json` - 王子・王妃・護衛/ハンター・マフィア・幻影旅団・官吏などキャラクター全件
- `data/events.json` - タイムラインのイベント一覧
- `data/spirit_beasts.json` - 守護霊獣一覧
- `data/factions.json` - 派閥（陣営）マップ
- `data/mafia.json` - 下層デッキのマフィア・幻影旅団マップ
- `data/*.schema.json` - 各JSONに対応するJSON Schema（検証用）
- `images/characters/*.png` - キャラクターのポートレート（一部のみ。未整備のキャラは頭文字アバターで表示）
- `validate_data.py` - データ検証スクリプト

## 機能

- **14王子一覧・護衛・ハンター一覧**: カード表示で検索可能（名前、王妃、部屋、能力、状態等）。念系統・ハンター有無・生死状況でフィルタ
- **守護霊獣一覧**: 念系統でフィルタ
- **派閥マップ**: 陣営ごとのリーダー・メンバー・戦略を表示
- **下層勢力マップ**: カキン三大マフィアと幻影旅団の組織図（組長・若頭・幹部の能力付き）
- **タイムライン**: 複数のフィルタ機能を搭載
  - 参加者・部屋・種別で絞り込み
  - イベント色分け（`type` 別）
  - 部屋マップ／部屋別タイムライン／人物別タイムライン／タイムラインマトリクス／ガントチャート
- **詳細モーダル**: 王子・護衛・守護霊獣・イベントをクリックすると詳細と関連イベントを表示

## データの管理

### スキーマ検証

各 JSON ファイルには対応するスキーマファイル（`.schema.json`）が定義されています。

```powershell
python validate_data.py
```

このスクリプトはすべてのデータを JSON スキーマに対して検証し、エラーを報告します（`pip install jsonschema` が必要）。

## 拡張ポイント

- `data/events.json` にイベントを追加（必須: `id`, `chapter`, `description`, `characters`。任意: `time_start`/`time_end`, `room`/`location`, `revealed_facts`, `mysteries` 等）
- `images/characters/` にポートレートを追加し、`characters.json` の該当キャラに `image` フィールドを設定
- イベント種別（`type` フィールド）を拡張する場合は `style.css` に `.timeline-item.type-<種別>` 等の色定義を追記
- カスタムフィルター機能の追加
