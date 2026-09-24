#!/usr/bin/env python3
"""
JSON データの検証スクリプト
characters.json, events.json, spirit_beasts.json, factions.json, mafia.json
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

    ids = [character["id"] for character in characters]
    names = [character["name"] for character in characters]
    id_set = set(ids)
    name_set = set(names)

    for label, values in (("人物ID", ids), ("人物名", names)):
        duplicates = sorted({value for value in values if values.count(value) > 1})
        for value in duplicates:
            errors.append(f"{label}が重複しています: {value}")

    for character in characters:
        room = character.get("room")
        if room is not None and not isinstance(room, str):
            errors.append(f"人物の部屋表記が文字列ではありません: {character['id']} -> {room}")
        for relation_id in (character.get("children") or []) + (character.get("parent_ids") or []):
            if relation_id not in id_set:
                errors.append(f"人物関係の参照先がありません: {character['id']} -> {relation_id}")

    for event in events:
        room = event.get("room")
        if room is not None and not isinstance(room, str):
            errors.append(f"イベントの部屋表記が文字列ではありません: {event['id']} -> {room}")
        for token in event.get("characters") or []:
            if token not in id_set and token not in name_set:
                errors.append(f"イベント人物の参照先がありません: {event['id']} -> {token}")
        for token in (event.get("character_locations") or {}):
            if token not in id_set:
                errors.append(f"人物別所在地の参照先がありません: {event['id']} -> {token}")
            if token not in (event.get("characters") or []):
                errors.append(f"人物別所在地の人物がイベント参加者に含まれていません: {event['id']} -> {token}")

    for source_name, records in (("人物", characters), ("イベント", events)):
        for record in records:
            for key, value in record.items():
                if isinstance(value, str) and re.search(r"\bch\d+\b", value, re.IGNORECASE):
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
