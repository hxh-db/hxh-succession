# 最新残件整理・第414話の確度同期の検証（2026-10-13）

## 対応範囲

- 第414話写真1〜4、第415話写真9左を直接再閲覧。P07-U01の死亡断定を撤回、P07-U02の刺突・遺体と分離。人物の状態・履歴と出来事の状態変化を同期。
- 場所は1007号室の区域という描写と、第415話の休憩室での殺害という証言を分離。時刻14:10・推定12日目は最新判断を維持。
- 人物修正案186件の反映突合と、未照合23件の理由別整理。全原作を今回再読した検証ではない。
- ボークセン本文のギッバー表記を既存の確定訂正ギッパーへ同期。
- 人物モーダルのHistory API後も、所在根拠・同時刻／別視点リンクのhrefが一覧の出来事へ向くよう修正。通常クリックのモーダル表示とネタバレ制御は維持。

## 自動検証

環境：Windows、Python 3.12。既存の `.local/validation-packages` をPYTHONPATHに指定。追加インストールなし。

```powershell
$env:PYTHONPATH = (Resolve-Path .local/validation-packages).Path
$env:PYTHONIOENCODING = 'utf-8'
python validate_data.py
python -m unittest discover -s tests -p 'test_*.py'
python check_status_sync.py
```

- 7公開JSONのスキーマ・ファイル間参照：成功。
- Python unit tests：44件成功（第414話の状態・場所・表記の回帰6件を追加）。
- 状態連動検査：不一致なし。
- 最初にP07-U01の1ページを生成・確認し、全人物へ再生成。266人物ページ＋索引・manifest・sitemap＝269ファイルが公開JSONと一致。
- `node --check script.js`：成功。
- Node tests：character-pages、character-consistency、character-evidence、review-followups、timeline-labels、author-settings、link-check、spoiler-settings、avatar-zoom、search-spoilers、simultaneous-scenes、location-certaintyを通過。
- 内部リンク検査：エラー0件。既存の未参照画像10件は警告として残す（無関係な画像は削除しない）。
- 所在根拠URLのテストはローカルの `/` とGitHub Pagesの `/hxh-succession/` の両方で検証。個人メモ・原作全ページの生成HTMLへの混入防止も既存テストで確認。

## ローカル画面

検証用に `python local_server.py` を起動。公開サイトへは反映していない。

- `http://127.0.0.1:8765/characters/P07-U01/` の直接アクセス・再読み込みで人物ページを表示。
- ネタバレ非表示の初期状態では後の状態情報を隠し、表示操作後は生死未確認・第414話・再照合待ち・保留理由が読める。
- 「人物一覧で見る」から検索語付きの一覧へ移動し、名前から同じ状態のモーダルを開く。
- 戻るでモーダルを閉じ、進むで再表示。Escapeで閉じても検索語を保持。Shift+Tabのフォーカスはモーダル内に残る。スクロール位置は今回個別に計測していない（既存ルートの自動テストとは区別する）。
- モーダルの「第414話」のhrefが `/?event=E414-001#timeline` となることを確認。そのURLを別タブで直接開くと出来事の詳細が表示される。
- 390×844でページ幅390px、モーダル幅・scrollWidthとも390px。横はみ出しなし。実機ではなくブラウザの表示幅検証。
- 検証した出来事タブのconsole errorは0件。
- 証跡：非公開の `.local/remaining-review-mobile-20261013.png`。表示幅の上書きとネタバレ設定は検証後に解除・非表示へ復元した。個人メモの入力・保存はしていない。

## 継続課題

未照合23件・仮説12件は維持。死亡の真相や未確定の人物同定をこの変更で確定へ昇格していない。未提供・判読不明の出典、公式訂正、全件のページ入力、実機・網羅的アクセシビリティ確認は別課題。

コミット・push・公開反映なし。無関係な未追跡画像は維持。
