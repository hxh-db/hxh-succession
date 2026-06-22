#!/usr/bin/env python3
"""
JSON データの検証スクリプト
characters.json, events.json, spirit_beasts.json, factions.json, mafia.json
を対応するスキーマファイルで検証します。
"""

import json
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

    print("\n" + "=" * 60)
    if all_ok:
        print("すべてのファイルが有効です。")
        return 0
    else:
        print("エラーがあります。上記を確認してください。")
        return 1


if __name__ == "__main__":
    sys.exit(main())
