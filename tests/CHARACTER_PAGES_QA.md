# 人物URL・個別ページの確認記録（2026-10-09）

## 実装範囲

- 既存の公開人物台帳251件に `characters/<ID>/index.html` を生成。通常の索引は一覧と同じ対象221件。
- 生成元の公開JSONと `.local/drafts.json` は変更しない。開始時・終了時のSHA256を比較して一致。
- 人物一覧の名前と詳細リンク、配置表の人物名は実際の個別ページへのリンク。通常クリックのみをモーダルで処理。
- title / description / canonical / sitemap / 公開JSONのハッシュ付き生成記録。
- 個別ページは初期配置を現在地と区別し、後の展開は閉じた details + data-nosnippet。個人メモ・編集・調査記録は生成対象外。

## ブラウザ確認

検証用タブのみ使用。既存タブ・メモは変更せず、実データへのテスト書き込みはしていない。

1. 全件生成前にP14（ワブル）1件だけ生成して確認。
2. 一覧で「ワブル」検索＋14王子カテゴリ → 名前から開く → URL `/characters/P14/` → 戻る → 進む → 閉じる。検索・カテゴリ・クリック位置のスクロールを保持。
3. 固有URLへ直接移動・再読み込み → 静的個別ページの本文を表示。
4. ハンゾーで検索＋ハンターカテゴリ。390×844のスマホ幅で Enter → モーダル / Escape → 一覧。戻る・進むと位置の保持も確認（開く直前・戻った後とも scrollY=1103）。
5. モーダルの初期フォーカスは閉じるボタン。Tabでメモ欄へ移動、Shift+Tabで戻る。端では閉じる ↔ 最後の関連イベントsummaryを循環。閉じた編集欄の入力にはフォーカスしない。背景は inert、閉じると解除。
6. スマホ幅で個別ページの折りたたみを開閉。本文・配置履歴が読め、横方向のはみ出しなし。実機のタッチ操作までは未確認。
7. `tests/fixtures/character-nojs.html` の sandbox フレームでスクリプト実行を禁止。索引リンク → P14本文 → native detailsを展開 → 人物索引へ戻るを確認。スクリプト用ボタンは隠れたまま。
8. `node tests/serve-prefix.cjs` の一時サーバー（127.0.0.1:8766）で `/hxh-succession/` を再現。個別URL直接アクセス・HTTP 200・再読み込み・一覧/出来事リンク・一覧からモーダル/戻る/進むを確認。
9. ハンゾーの「第372話の関連する出来事」 → 人物・372話・全部の日付で1件表示。
10. ローカル編集は保存後に一覧アプリを再読み込みするよう補正。復元先とpending detailは自動テストで確認。実メモの上書きを伴う保存テストは行っていない。

スマホ表示の画像：`.local/character-page-mobile-20261009.jpg`（公開対象外）。一時サーバーは確認後に停止。viewport overrideも解除。

## 自動検証

以下はすべてPASS。

```powershell
node scripts/build-character-pages.cjs --check
node tests/character-pages.cjs
node .local/test-filter-combinations.cjs
node .local/test-event-creation.cjs
node .local/test-ceremony-consistency.cjs
node --check script.js
node --check character-routing.js
node --check character-page.js
python validate_data.py
```

データ検証はローカル既存のjsonschemaを利用し、7スキーマとファイル間参照を検証した。人物ページ検証は全251件のJSONとの一致、実ファイルへの内部リンク、canonicalの `/hxh-succession/` 配下、253件のサイトマップURL、非公開ファイル除外、履歴状態、編集後の一覧再読み込みを確認。

GitHub Pagesでの実際の公開・検索エンジンによるクロールは未実施。コミット・push・公開は承認後。
