# 開発引き継ぎノート

このファイルは、次にこのプロジェクトを引き継ぐ開発者向けの最低限の手順と場所をまとめたメモです。

## 重要ファイル
- `site/index.html` - メインの HTML
- `site/style.css` - スタイル定義（イベント種別の色は `.timeline-item.type-<種別>` を参照）
- `site/script.js` - 描画ロジック、フィルタ、ガント描画など
- `site/data/*.json` - データ（`timeline.json`, `princes.json`, `bodyguards.json`）
- `site/data/*.schema.json` - JSON スキーマ（検証用）
- `validate_data.py` - データ検証スクリプト（プロジェクトルート）

## ローカル起動（Windows）
PowerShell またはコマンドプロンプトで `site` ディレクトリに移動して起動します。

PowerShell:
```powershell
cd "c:\Users\supri\Desktop\claude動画作成\site"
python -m http.server 8000
```

バッチファイル（site/run_server.bat）を用意しています：
```bat
cd /d "%~dp0"
python -m http.server 8000
```

PowerShell スクリプト（site/run_server.ps1）:
```powershell
Set-Location -Path $PSScriptRoot
python -m http.server 8000
```

その後ブラウザで `http://localhost:8000` を開いて確認してください。

## データ編集・追加の流れ
1. `site/data/timeline.json` にイベントを追加します。
   - 必須フィールド: `chapter`, `time`(HH:MM), `room`, `event`, `participants`(配列), `summary`, `type`
   - 任意: `duration`（分）。ガントチャートで使用されます。
2. `validate_data.py` を実行してデータ整合性を確認します:
```powershell
cd "c:\Users\supri\Desktop\claude動画作成"
python validate_data.py
```
3. 問題なければデプロイ先へコピーします（PowerShell例）:
```powershell
Copy-Item -Path "site\*" -Destination "c:\Users\supri\Desktop\private\王位継承選" -Recurse -Force
```

## イベント種別（type）の追加
- 新しい種別を追加する場合、`site/style.css` に `.timeline-item.type-あなたの種別` と対応する色（`border-left` 等）を追記してください。
- `site/script.js` は `type` フィールドをそのままクラス名として使います（スペースが入ると不具合になるため、種別は短い単語推奨）。

## 次に取り掛かると良いタスク（提案）
- イベント追加用の UI（管理画面）を作り、入力から自動で JSON を生成・検証する
- ガントチャートの時間スケールを分単位で厳密に配置する
- イベントの重複表示や詳細ツールチップの改善

## 補足
- すべて Windows 環境で開発しました。Unix 系での実行時はスクリプトを適宜書き換えてください。
- 何か引継ぎで追加してほしい情報があれば教えてください。
