# 王位継承戦データまとめサイト

このフォルダには、王子一覧・警護兵一覧・タイムテーブルを表示する静的サイトの雛形があります。

## 使い方

1. `site/index.html` をブラウザで表示します。
2. 直接開く場合、ブラウザにより `fetch` が動作しない場合があります。その場合は簡易サーバーを使ってください。

### 簡易サーバーの例（PowerShell）

```powershell
cd "c:\Users\supri\Desktop\claude動画作成\site"
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開きます。

## ファイル構成

- `index.html` - ページ本体
- `style.css` - レイアウトとデザイン
- `script.js` - データ読み込みと描画
- `data/princes.json` - 王子一覧データ
- `data/bodyguards.json` - 警護兵一覧データ
- `data/timeline.json` - タイムテーブルデータ
- `data/*.schema.json` - JSON スキーマ定義ファイル

## 機能

- **王子一覧・警護兵一覧**: カード表示で検索可能（部屋、能力、担当者等）
- **タイムテーブル**: 複数のフィルタ機能を搭載
  - 参加者で絞り込み
  - 部屋で絞り込み
  - 種別（戦闘、移動、会合など）で絞り込み
  - イベント色分け（type 別）
- **部屋マップ**: 各部屋のイベント数を視覚表示
- **人物別タイムライン**: 特定人物の出現イベントを一覧
- **タイムラインマトリクス**: 部屋×時刻の二次元俯瞰
- **ガントチャート**: イベント継続時間を視覚化

## データの管理

### スキーマ検証

各 JSON ファイルには対応するスキーマファイル（`.schema.json`）が定義されています。

#### 検証スクリプトの実行

```bash
cd <プロジェクトルート>
python validate_data.py
```

このスクリプトはすべてのデータを JSON スキーマに対して検証し、エラーを報告します。

#### スキーマについて

- `timeline.schema.json`: イベント（time, room, type, participants, summary等）の形式を定義
- `princes.schema.json`: 王子（name, age, room, ability, status等）の形式を定義
- `bodyguards.schema.json`: 警護兵（name, prince, ability, role等）の形式を定義

### JSON フォーマット例

#### timeline.json
```json
{
  "chapter": "開始前",
  "time": "21:00",
  "duration": 12,
  "room": "B棟ロビー",
  "event": "王子全員集合",
  "participants": ["継承候補A", "警護兵X"],
  "summary": "王子と警護兵の配置が発表される。",
  "type": "会合"
}
```

## 拡張ポイント

- `data/timeline.json` にイベントを追加
- 参加者検索と部屋別タイムラインの表示を活用する
- 王子・警護兵一覧の検索機能を使いやすくする
- イベント種別（`type` フィールド）を拡張（デフォルト: 戦闘, 移動, 会合, 会話, 特殊）
- ガントチャートの時間スケール調整（`duration` フィールド）
- カスタムフィルター機能の追加

