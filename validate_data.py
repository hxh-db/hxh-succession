#!/usr/bin/env python3
"""
JSON データの検証スクリプト
characters.json, events.json, spirit_beasts.json, factions.json, mafia.json,
personnel_snapshots.json
を対応するスキーマファイルで検証します。
"""

import json
import re
import sys
from pathlib import Path

try:
    import jsonschema
except ImportError:
    print("jsonschema がインストールされていません。")
    print("実行: pip install jsonschema")
    sys.exit(1)


def validate_json_file(data_path, schema_path):
    errors = []

    try:
        with open(data_path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"JSON パースエラー: {e}"]
    except FileNotFoundError:
        return False, [f"ファイルが見つかりません: {data_path}"]

    if not schema_path.exists():
        return True, ["スキーマファイルなし（スキップ）"]

    try:
        with open(schema_path, encoding="utf-8") as f:
            schema = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"スキーマ パースエラー: {e}"]

    validator = jsonschema.Draft7Validator(schema)
    for error in validator.iter_errors(data):
        path = " -> ".join(str(p) for p in error.absolute_path)
        errors.append(f"[{path}] {error.message}" if path else error.message)

    return len(errors) == 0, errors


def validate_cross_references(base):
    errors = []
    with open(base / "characters.json", encoding="utf-8") as f:
        characters = json.load(f)
    with open(base / "events.json", encoding="utf-8") as f:
        events = json.load(f)
    with open(base / "open_questions.json", encoding="utf-8") as f:
        questions = json.load(f)

    ids = [character["id"] for character in characters]
    names = [character["name"] for character in characters]
    id_set = set(ids)
    name_set = set(names)
    event_ids = {event["id"] for event in events}
    prince_room = re.compile(r"^第1層 10(?:0[1-9]|1[0-4])号室$")
    prince_room_reference = re.compile(r"10(?:0[1-9]|1[0-4])号室")
    noncanonical_place = re.compile(r"王子居住区|エリア\d+|第\d+王子居室|の居室")

    for label, values in (("人物ID", ids), ("人物名", names)):
        duplicates = sorted({value for value in values if values.count(value) > 1})
        for value in duplicates:
            errors.append(f"{label}が重複しています: {value}")

    for character in characters:
        room = character.get("room")
        if room is not None and not isinstance(room, str):
            errors.append(f"人物の部屋表記が文字列ではありません: {character['id']} -> {room}")
        elif room and prince_room_reference.search(room) and not prince_room.fullmatch(room):
            errors.append(f"人物の王子居住区表記が統一されていません: {character['id']} -> {room}")
        for relation_id in (character.get("children") or []) + (character.get("parent_ids") or []):
            if relation_id not in id_set:
                errors.append(f"人物関係の参照先がありません: {character['id']} -> {relation_id}")

    for event in events:
        room = event.get("room")
        if room is not None and not isinstance(room, str):
            errors.append(f"イベントの部屋表記が文字列ではありません: {event['id']} -> {room}")
        elif room and prince_room_reference.search(room) and not prince_room.fullmatch(room):
            errors.append(f"イベントの王子居住区表記が統一されていません: {event['id']} -> {room}")
        if noncanonical_place.search(event.get("description") or ""):
            errors.append(f"イベント本文に号室以外の王子居住区表記があります: {event['id']}")
        if noncanonical_place.search(event.get("location") or ""):
            errors.append(f"イベント場所に号室以外の王子居住区表記があります: {event['id']}")
        for token in event.get("characters") or []:
            if token not in id_set and token not in name_set:
                errors.append(f"イベント人物の参照先がありません: {event['id']} -> {token}")
        for token in (event.get("character_locations") or {}):
            if token not in id_set:
                errors.append(f"人物別所在地の参照先がありません: {event['id']} -> {token}")
            if token not in (event.get("characters") or []):
                errors.append(f"人物別所在地の人物がイベント参加者に含まれていません: {event['id']} -> {token}")

    question_ids = [question["id"] for question in questions]
    for question_id in sorted({value for value in question_ids if question_ids.count(value) > 1}):
        errors.append(f"未解決事項IDが重複しています: {question_id}")
    for question in questions:
        for event_id in question["related_event_ids"]:
            if event_id not in event_ids:
                errors.append(f"未解決事項の出来事参照先がありません: {question['id']} -> {event_id}")

    with open(base / "character_tags.json", encoding="utf-8") as f:
        character_tags = json.load(f)
    for assignment in character_tags["assignments"]:
        if assignment["character_id"] not in id_set:
            errors.append(f"人物タグの参照先がありません: {assignment['character_id']}")

    with open(base / "personnel_snapshots.json", encoding="utf-8") as f:
        snapshots = json.load(f)["snapshots"]
    with open(base / "sources.json", encoding="utf-8") as f:
        source_ids = {source["id"] for source in json.load(f)}
    for snapshot in snapshots:
        chapter = snapshot["chapter"]
        if snapshot["source_id"] not in source_ids:
            errors.append(f"人員配置の出典参照先がありません: 第{chapter}話")
        ranks = [row["rank"] for row in snapshot["princes"]]
        if sorted(ranks) != list(range(1, 15)):
            errors.append(f"人員配置に第1〜第14王子の行が一つずつ必要です: 第{chapter}話")
        shared_monitor_counts = {}
        for row in snapshot["princes"]:
            if row["provisional_associates"] > row["private_soldiers"]:
                errors.append(f"準協会員が私設兵の内数になっていません: 第{chapter}話 第{row['rank']}王子")
            for deployment in row["queen_deployments"]:
                if deployment["purpose"] != "下位王子の監視":
                    continue
                queen_rank = deployment["queen_rank"]
                count = deployment["count"]
                if queen_rank in shared_monitor_counts and shared_monitor_counts[queen_rank] != count:
                    errors.append(f"同じ王妃の監視兵数が一致しません: 第{chapter}話 第{queen_rank}王妃")
                shared_monitor_counts[queen_rank] = count

    for source_name, records in (("人物", characters), ("イベント", events)):
        for record in records:
            for key, value in record.items():
                if isinstance(value, str) and not key.endswith("_image") and re.search(r"\bch\d+\b", value, re.IGNORECASE):
                    errors.append(f"{source_name}に旧話数表記が残っています: {record['id']} -> {key}")

    return errors


def main():
    base = Path(__file__).parent / "data"

    files = [
        ("characters.json",     "characters.schema.json"),
        ("events.json",         "events.schema.json"),
        ("spirit_beasts.json",  "spirit_beasts.schema.json"),
        ("factions.json",       "factions.schema.json"),
        ("mafia.json",          "mafia.schema.json"),
        ("open_questions.json", "open_questions.schema.json"),
        ("personnel_snapshots.json", "personnel_snapshots.schema.json"),
    ]

    all_ok = True

    for data_file, schema_file in files:
        data_path = base / data_file
        schema_path = base / schema_file if schema_file else Path("__none__")

        print(f"\n検証中: {data_file}")

        ok, errors = validate_json_file(data_path, schema_path)

        if ok:
            print(f"  OK ({errors[0] if errors else ''})" if errors else "  OK")
        else:
            print("  エラー:")
            for e in errors:
                print(f"    - {e}")
            all_ok = False

    print("\n検証中: ファイル間の参照")
    cross_errors = validate_cross_references(base)
    if cross_errors:
        print("  エラー:")
        for error in cross_errors:
            print(f"    - {error}")
        all_ok = False
    else:
        print("  OK")

    print("\n" + "=" * 60)
    if all_ok:
        print("すべてのファイルが有効です。")
        return 0
    else:
        print("エラーがあります。上記を確認してください。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
