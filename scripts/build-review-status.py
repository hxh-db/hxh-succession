"""Read-only current review summary; --write explicitly refreshes its two artifacts."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUTS = ["data/events.json", "data/characters.json", "data/research_backlog.json",
          "data/intake/pending23_recheck_20261016.json", "data/intake/review_targets.json", "data/web_research.json"]
OUTPUT = "data/intake/current_review_status"
CLOSED = {"resolved", "resolved_with_inference"}


def build_report(events, characters, backlog, pending, targets, web_research, scope_exclusions=None):
    by_event = {row["id"]: row for row in events}
    by_character = {row["id"]: row for row in characters}
    by_web = {row["id"]: row for row in web_research}
    old = {row["event_id"]: row for row in pending["records"]}
    scope_exclusions = scope_exclusions or []
    excluded_chapters = {chapter for row in scope_exclusions for chapter in row["chapters"]}
    excluded_ids = {event["id"] for event in events if event["chapter"] in excluded_chapters}
    assert len(by_event) == len(events) and len(by_character) == len(characters)
    assert len({row["id"] for row in backlog}) == len(backlog), "台帳IDが重複"
    active, completed, inference = [], [], []
    for row in backlog:
        if row["status"] in CLOSED:
            (inference if row["status"] == "resolved_with_inference" else completed).append(row)
            continue
        assert row["id"] in targets, f"確認対象と次の作業の登録が必要: {row['id']}"
        scope = targets[row["id"]]
        assert set(scope.get("chapters", [])) <= {event["chapter"] for event in events}, f"存在しない対象話数: {row['id']}"
        event_ids = set(scope.get("event_ids", []))
        event_ids.update(event["id"] for event in events if event["chapter"] in scope.get("chapters", []))
        if scope.get("event_selector") == "missing_presence":
            event_ids.update(event["id"] for event in events if event.get("characters") and not event.get("character_presence"))
        elif scope.get("event_selector") == "pending23_unverified":
            event_ids.update(event["id"] for event in events if event["id"] in old and event.get("verification_status") == "unverified")
        else:
            assert scope.get("event_selector") is None, "未知の出来事範囲"
        event_ids.difference_update(excluded_ids)
        character_ids = set(scope.get("character_ids", []))
        if scope.get("character_selector") == "unnamed":
            character_ids.update(person["id"] for person in characters if person.get("is_placeholder") and not person.get("is_count_only") and not person.get("generated_by"))
        else:
            assert scope.get("character_selector") is None, "未知の人物範囲"
        assert event_ids <= by_event.keys(), f"存在しない対象出来事: {row['id']} {event_ids - by_event.keys()}"
        assert character_ids <= by_character.keys(), f"存在しない対象人物: {row['id']}"
        assert set(scope.get("web_research_ids", [])) <= by_web.keys(), f"存在しないWeb調査ID: {row['id']}"
        assert event_ids or character_ids or scope.get("web_research_ids"), f"対象が空: {row['id']}"
        assert scope.get("evidence_paths") and scope.get("next_action"), f"根拠・次の作業が必要: {row['id']}"
        active.append({**row, **scope, "event_ids": sorted(event_ids), "character_ids": sorted(character_ids)})
    unverified = []
    for event in events:
        if event.get("verification_status") != "unverified":
            continue
        prior = old.get(event["id"], {})
        unverified.append({"event_id": event["id"], "chapter": event["chapter"], "description": event["description"],
                           "review_kind": "source_not_found" if prior.get("outcome") == "source_not_found" else "partial_or_identity_review",
                           "current_note": event.get("verification_note", ""), "historical_outcome": prior.get("outcome"),
                           "excluded_from_current_review": event["id"] in excluded_ids,
                           "historical_remaining": prior.get("remaining", ""), "existing_image_references": prior.get("images", []),
                           "evidence_paths": ["data/events.json", "data/intake/pending23_recheck_20261016.json"],
                           "next_action": "既存索引・照合記録を先に確認し、現在の留保に対応する原作を比較する。未発見・判読保留・原作上の未明示を混同しない。"})
    return {"scope": "現行データの読取り集計。未入力・仮説はエラー件数ではなく、確認記録ありも全項目の原作確定を意味しない。",
            "counts": {"characters": len(characters), "events": len(events),
                       "event_verification": dict(sorted(Counter(event.get("verification_status", "unset") for event in events).items())),
                       "with_presence": sum(bool(event.get("character_presence")) for event in events),
                       "with_source_pages": sum(bool(event.get("source_locator", {}).get("pages")) for event in events),
                       "day_unset": sum(event.get("day") is None for event in events),
                       "active_backlog": len(active), "resolved_backlog": len(completed), "adopted_inference_backlog": len(inference)},
            "active_backlog": active, "resolved_backlog": completed, "adopted_inference_backlog": inference,
            "scope_exclusions": scope_exclusions, "excluded_event_ids": sorted(excluded_ids),
            "unverified_events": unverified,
            "hypothesis_event_ids": [event["id"] for event in events if event.get("verification_status") == "hypothesis"],
            "historical_records_absent_from_current_events": [key for key in old if key not in by_event]}


def render(report):
    counts = report["counts"]
    lines = ["# 現行の照合状況（自動集計）", "", report["scope"], "",
             f"人物{counts['characters']}件・出来事{counts['events']}件。確認状態：" + "、".join(f"{key} {value}件" for key, value in counts["event_verification"].items()) + "。", "",
             f"所在区分のある出来事{counts['with_presence']}件、ページ根拠のある出来事{counts['with_source_pages']}件、日付空欄{counts['day_unset']}件。これらの差分を不具合や原作未確認の件数と読み替えない。", "",
             f"未解決の台帳{counts['active_backlog']}件、解消済み{counts['resolved_backlog']}件、採用仮説を含む整理済み{counts['adopted_inference_backlog']}件。", "",
             "## 未解決の台帳", "", "対象IDは比較する範囲であり、対象の全レコードが誤りという意味ではない。全IDと履歴は同名JSONを参照。", ""]
    for row in report["active_backlog"]:
        ids = row["event_ids"] + row["character_ids"] + row.get("web_research_ids", [])
        lines += [f"### {row['id']}：{row['topic']}", "", f"状態：{row['status']}。対象：" + "、".join(ids[:12]) + (f" ほか（全{len(ids)}件）" if len(ids) > 12 else "") + "。", "",
                  f"必要な根拠：{row['required_source']}", "", "既存資料：" + "、".join(f"`{name}`" for name in row["evidence_paths"]), "", f"次の作業：{row['next_action']}", ""]
    if report["scope_exclusions"]:
        lines += ["## 今回の照合対象外", ""]
        for exclusion in report["scope_exclusions"]:
            lines += [f"- 第{min(exclusion['chapters'])}〜{max(exclusion['chapters'])}話：{exclusion['reason']}"]
        lines += ["", "対象外の出来事は削除・確認済みへの変更を行わず、今回の照合作業からだけ外す。", ""]
    lines += ["## 現在の未照合イベント", "", "画像が保管場所で未発見のものと、画像のある部分保留・同定保留を分ける。判読不能と原作上の未明示の区別は各記録を読んで判断し、自動確定しない。", ""]
    for row in report["unverified_events"]:
        label = "今回の照合対象外・確認状態は維持" if row["excluded_from_current_review"] else row["review_kind"]
        lines += [f"- {row['event_id']}（第{row['chapter']}話、{label}）：{row['current_note']}"]
    lines += ["", "## 維持する履歴と採用仮説", "",
              "解消済み：" + "、".join(row["id"] for row in report["resolved_backlog"]), "",
              "採用仮説を含む整理済み：" + "、".join(row["id"] for row in report["adopted_inference_backlog"]), "",
              "過去の照合記録にあるが現行出来事にないID：" + "、".join(report["historical_records_absent_from_current_events"]) + "。現行の未解決一覧へ戻さない。", "",
              "2026-10-26に反映済みの時系列5指摘は `data/intake/event_chronology_audit_20261025.md` 冒頭を参照。本文の旧配置を再適用しない。", "",
              "## 更新", "", "読取り集計：`python scripts/build-review-status.py`。JSON表示：`--json`。", "",
              "生成物更新：`python scripts/build-review-status.py --write`。更新漏れ検査：`--check`（書込みなし）。", "",
              "旧監査文書の当時の件数は履歴として維持し、現在値はこの生成レポートを参照する。原作の再照合や事実認定の変更を自動で行うものではない。", ""]
    return "\n".join(lines)


def load_report(root=ROOT):
    contents = {name: (root / name).read_text(encoding="utf-8") for name in INPUTS}
    values = [json.loads(contents[name]) for name in INPUTS]
    report = build_report(values[0], values[1], values[2], values[3], values[4]["targets"], values[5]["entries"], values[4].get("scope_exclusions"))
    for row in report["active_backlog"]:
        for name in row["evidence_paths"]:
            assert (root / name).is_file() and (root / name).resolve().is_relative_to(root.resolve()), f"既存資料の参照切れ: {name}"
    report["source_sha256"] = {name: hashlib.sha256(text.encode()).hexdigest() for name, text in contents.items()}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--write", action="store_true")
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--json", action="store_true")
    args = parser.parse_args()
    report = load_report()
    json_text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    outputs = {ROOT / f"{OUTPUT}.json": json_text, ROOT / f"{OUTPUT}.md": render(report)}
    if args.check:
        stale = [str(file.relative_to(ROOT)) for file, expected in outputs.items() if not file.exists() or file.read_text(encoding="utf-8") != expected]
        if stale:
            parser.exit(1, "再生成が必要: " + ", ".join(stale) + "\n")
        print("PASS: 現行の照合状況と対象ID・既存資料が一致。書込みなし。")
    elif args.write:
        for file, body in outputs.items():
            file.write_text(body, encoding="utf-8", newline="\n")
        print("Generated current_review_status.json / .md. Source records unchanged.")
    else:
        print(json_text if args.json else render(report), end="")


if __name__ == "__main__":
    main()
