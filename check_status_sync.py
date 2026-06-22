#!/usr/bin/env python3
"""
characters.json と events.json の状態（status）連動チェック。

events.json の各イベントは任意で "status_effects" を持てる：
  "status_effects": [{"character": "P09", "status": "死亡"}]

これは「このイベントの結果、このキャラのステータスがこうなった」という
事実を明示するフィールド。本スクリプトは、各キャラについて
events.json 内の status_effects を章番号順に並べた「最終状態」と、
characters.json の status / status_log を比較し、食い違いを報告する。

使い方:
  python check_status_sync.py
"""

import json
import sys
from pathlib import Path


def main():
    base = Path(__file__).parent / "data"

    with open(base / "characters.json", encoding="utf-8") as f:
        characters = json.load(f)
    with open(base / "events.json", encoding="utf-8") as f:
        events = json.load(f)

    char_by_id = {c["id"]: c for c in characters}

    # キャラID -> [(chapter, status, event_id), ...]
    effects_by_char = {}
    errors = []

    for e in events:
        for effect in e.get("status_effects", []):
            cid = effect.get("character")
            status = effect.get("status")
            if cid not in char_by_id:
                errors.append(
                    f"[{e['id']}] status_effects が未知のキャラID '{cid}' を参照しています"
                )
                continue
            effects_by_char.setdefault(cid, []).append((e["chapter"], status, e["id"]))

    warnings = []

    for cid, effects in effects_by_char.items():
        char = char_by_id[cid]
        # 章番号で並べて最後の状態を「イベントから見た最終状態」とする
        effects_sorted = sorted(effects, key=lambda t: t[0])
        latest_chapter, latest_status, latest_event = effects_sorted[-1]

        if char.get("status") != latest_status:
            warnings.append(
                f"{cid} ({char['name']}): characters.json の status='{char.get('status')}' "
                f"だが、events.json 最新イベント {latest_event} (ch{latest_chapter}) では "
                f"status_effects='{latest_status}' になっている"
            )

        # status_log にこのイベントの章が含まれているかも確認
        log_chapters = {log.get("chapter") for log in char.get("status_log", [])}
        for chapter, status, event_id in effects_sorted:
            if chapter not in log_chapters:
                warnings.append(
                    f"{cid} ({char['name']}): {event_id} (ch{chapter}) の status_effects "
                    f"'{status}' に対応する status_log エントリが見つからない"
                )

    print("=" * 60)
    print(f"検証対象: characters.json {len(characters)}件 / events.json {len(events)}件")
    print(f"status_effects を持つイベント: "
          f"{sum(1 for e in events if e.get('status_effects'))}件")
    print(f"status_effects で言及されたキャラ: {len(effects_by_char)}件")
    print("=" * 60)

    if errors:
        print("\nエラー:")
        for err in errors:
            print(f"  - {err}")

    if warnings:
        print("\n不一致の可能性:")
        for w in warnings:
            print(f"  - {w}")
    else:
        print("\n不一致なし。すべてのstatus_effectsがcharacters.jsonと整合しています。")

    return 1 if (errors or warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
