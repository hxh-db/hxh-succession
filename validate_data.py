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


def validate_assignment_references(characters, events):
    errors = []
    by_id = {character["id"]: character for character in characters}
    by_event_id = {event["id"]: event for event in events}
    for character in characters:
        for entry in character.get("assignment_history") or []:
            prince = by_id.get(entry["prince_id"])
            if not prince or prince.get("type") != "prince":
                errors.append(f"配置履歴の王子参照先がありません: {character['id']} -> {entry['prince_id']}")
            event_id = entry.get("event_id")
            if not event_id:
                continue
            event = by_event_id.get(event_id)
            if not event:
                errors.append(f"配置履歴の出来事参照先がありません: {character['id']} -> {event_id}")
            elif event["chapter"] != entry["chapter"]:
                errors.append(f"配置履歴と出来事の話数が一致しません: {character['id']} -> {event_id}")
            elif not {character['id'], character['name']}.intersection(event.get("characters") or []):
                errors.append(f"配置履歴の人物が出来事に含まれていません: {character['id']} -> {event_id}")
    return errors


def validate_character_evidence(characters, events):
    errors = []
    people = {p['id']: p for p in characters}
    by_event = {e['id']: e for e in events}
    linked_status_events = set()
    for person in characters:
        for claim in person.get('review_claims') or []:
            for event_id in claim['event_ids']:
                event = by_event.get(event_id)
                if not event or person['id'] not in event['characters']:
                    errors.append(f"人物の確認情報の参照先・関係人物が不正: {person['id']} -> {event_id}")
        for log in person.get('status_log') or []:
            event_id = log.get('event_id')
            if not event_id:
                continue
            linked_status_events.add(event_id)
            event = by_event.get(event_id)
            if not event or event['chapter'] != log.get('chapter'):
                errors.append(f"状態履歴の出来事参照・話数が不一致: {person['id']} -> {event_id}")
                continue
            if not any(effect['character'] == person['id'] and effect['status'] == log['status'] for effect in event.get('status_effects') or []):
                errors.append(f"状態履歴が出来事の状態変化と不一致: {person['id']} -> {event_id}")
    for event in events:
        for update in event.get('mystery_updates') or []:
            if update['text'] not in (event.get('mysteries') or []):
                errors.append(f"疑問の更新対象が不正: {event['id']} -> {update['text']}")
            for event_id in update['related_event_ids']:
                if event_id not in by_event:
                    errors.append(f"疑問の確認記録の参照切れ: {event['id']} -> {event_id}")
        for person_id in event.get('character_presence') or {}:
            if person_id not in people or person_id not in event['characters']:
                errors.append(f"所在区分の人物参照が不正: {event['id']} -> {person_id}")
        # A linked multi-victim incident must not silently omit another victim's log.
        if event['id'] in linked_status_events:
            for effect in event.get('status_effects') or []:
                if not effect['status'].startswith('死亡'):
                    continue
                logs = people.get(effect['character'], {}).get('status_log') or []
                if not any(log.get('event_id') == event['id'] and log.get('chapter') == event['chapter'] and log.get('status') == effect['status'] for log in logs):
                    errors.append(f"同一事件の死亡履歴が未入力: {event['id']} -> {effect['character']}")
    return errors


def validate_simultaneous_scenes(events):
    """同時刻の別場面（simultaneous_with）の参照・相互参照・日付・時刻を検査する。"""
    errors = []
    by_id = {event["id"]: event for event in events}
    linked = {event["id"]: list(event.get("simultaneous_with") or []) for event in events if event.get("simultaneous_with")}
    for event_id, others in linked.items():
        for other_id in others:
            if other_id == event_id:
                errors.append(f"同時刻の場面が自分自身を参照しています: {event_id}")
            elif other_id not in by_id:
                errors.append(f"同時刻の場面の参照先がありません: {event_id} -> {other_id}")
            elif event_id not in (by_id[other_id].get("simultaneous_with") or []):
                errors.append(f"同時刻の場面が相互参照になっていません: {event_id} -> {other_id}")

    # 参照でつながった組ごとに、全員が互いを挙げているか・日付と時刻がそろっているかを見る。
    seen = set()
    for start in sorted(linked):
        if start in seen:
            continue
        group, stack = set(), [start]
        while stack:
            current = stack.pop()
            if current in group or current not in by_id:
                continue
            group.add(current)
            stack.extend(by_id[current].get("simultaneous_with") or [])
        seen |= group
        members = sorted(group)
        label = "・".join(members)
        for member in members:
            missing = sorted(set(members) - {member} - set(by_id[member].get("simultaneous_with") or []))
            if missing:
                errors.append(f"同時刻の組の全員を挙げていません: {member} -> {'・'.join(missing)}")
        days = {by_id[member].get("day") for member in members}
        if len(days) != 1 or None in days:
            errors.append(f"同時刻の組で日付が一致しません: {label} -> {sorted(days, key=str)}")
        times = {member: by_id[member].get("time_start") or by_id[member].get("time_estimate") for member in members}
        if None in times.values():
            errors.append(f"同時刻の組に時刻のない場面があります: {label}")
        exact = {by_id[member]["time_start"] for member in members if by_id[member].get("time_start")}
        if len(exact) > 1:
            errors.append(f"同時刻の組で確定時刻が一致しません: {label} -> {sorted(exact)}")
        elif exact:
            confirmed = next(iter(exact))
            for member in members:
                estimate = by_id[member].get("time_estimate")
                if not by_id[member].get("time_start") and estimate and estimate != confirmed:
                    errors.append(f"同時刻の組の仮時刻が確定時刻と一致しません: {member} {estimate} -> {confirmed}")
        elif len({value for value in times.values() if value}) > 1:
            errors.append(f"同時刻の組で時刻が一致しません: {label} -> {sorted(value for value in times.values() if value)}")
    return errors


def validate_same_incidents(events):
    """同一事件の別視点（same_incident_with）の参照・相互参照・自己参照を検査する。

    同じ事件を別の話・別の視点で描き直した場面（回想を含む）を結ぶ項目で、
    simultaneous_with と違って日付・時刻の一致は求めない。
    """
    errors = []
    by_id = {event["id"]: event for event in events}
    for event in events:
        others = event.get("same_incident_with") or []
        for other_id in others:
            if other_id == event["id"]:
                errors.append(f"同一事件の別視点が自分自身を参照しています: {event['id']}")
            elif other_id not in by_id:
                errors.append(f"同一事件の別視点の参照先がありません: {event['id']} -> {other_id}")
            elif event["id"] not in (by_id[other_id].get("same_incident_with") or []):
                errors.append(f"同一事件の別視点が相互参照になっていません: {event['id']} -> {other_id}")
    return errors


ABSENCE_CLAIM_PATTERN = re.compile(r"第(\d{3})話[：:]\s*(?:[^。：]*?)(登場しない|登場せず)")


def validate_absence_claims(characters, events):
    """人物欄で「第N話：登場しない／登場せず」と訂正した人物が、その話のイベントに本人として残っていないかを検査する。

    話題のみ（mentioned）・遠隔（remote）として結ぶのは許す。訂正が出来事側に反映されていない記録
    （2026-10-11 に見つかった E416-003 のような例）を拾うための検査。
    """
    errors = []
    by_chapter = {}
    for event in events:
        by_chapter.setdefault(event["chapter"], []).append(event)
    for person in characters:
        texts = [claim.get("text", "") for claim in person.get("review_claims") or []]
        texts.append(person.get("notes") or "")
        chapters = {int(match.group(1)) for text in texts for match in ABSENCE_CLAIM_PATTERN.finditer(text)}
        for chapter in sorted(chapters):
            for event in by_chapter.get(chapter, []):
                if person["id"] not in (event.get("characters") or []):
                    continue
                presence = (event.get("character_presence") or {}).get(person["id"])
                if presence not in ("mentioned", "remote"):
                    errors.append(
                        f"人物欄で第{chapter}話に登場しないと訂正した人物が出来事に本人として残っています: {person['id']} -> {event['id']}"
                    )
    return errors


NEN_ABILITY_EDITORIAL_PATTERN = re.compile(
    r"旧記載|旧記録|旧備考|出典未確認|画像にな|画像には|画像に記載|再照合|照合待ち|として登録されている|未整理|ファンの|判読不明|読み違え|採用しない"
)


def validate_nen_ability_editorial(characters):
    """能力説明（nen_ability）に編集上の注記が混ざっていないかを検査する。

    旧記載の扱い・判読状況・出典確認の状況などは nen_ability_editorial に書く。
    """
    errors = []
    for character in characters:
        text = character.get("nen_ability") or ""
        match = NEN_ABILITY_EDITORIAL_PATTERN.search(text)
        if match:
            errors.append(f"能力説明に編集上の注記が混ざっています（nen_ability_editorial へ移す）: {character['id']} -> {match.group(0)}")
        editorial = character.get("nen_ability_editorial")
        if editorial is not None and not editorial.strip():
            errors.append(f"能力の編集注記が空です: {character['id']}")
    return errors


def validate_cross_references(base):
    errors = []
    with open(base / "characters.json", encoding="utf-8") as f:
        characters = json.load(f)
    with open(base / "events.json", encoding="utf-8") as f:
        events = json.load(f)
    with open(base / "open_questions.json", encoding="utf-8") as f:
        questions = json.load(f)
    errors.extend(validate_assignment_references(characters, events))
    errors.extend(validate_character_evidence(characters, events))
    errors.extend(validate_simultaneous_scenes(events))
    errors.extend(validate_same_incidents(events))
    errors.extend(validate_nen_ability_editorial(characters))
    errors.extend(validate_absence_claims(characters, events))

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
        for relation in ("time_before_event_id", "time_after_event_id"):
            related_id = event.get(relation)
            if related_id and related_id not in event_ids:
                errors.append(f"前後関係の出来事参照先がありません: {event['id']} -> {related_id}")
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
            setting = record.get("author_setting")
            if setting:
                if setting["source_id"] not in source_ids:
                    errors.append(f"作者設定資料の参照先がありません: {record['id']}")
                if setting["name_in_sheet"] != record["name"]:
                    errors.append(f"作者設定表の氏名と登録名が一致しません: {record['id']}")
                if record.get("setting_only") and (setting["body_mapping"] != "unmatched" or not record.get("is_identity_reference") or record.get("room") or record.get("initial_room")):
                    errors.append(f"設定表のみの人物を原作配置・増員として扱っています: {record['id']}")
            source_id = record.get("source_id")
            if source_id and source_id not in source_ids:
                errors.append(f"{source_name}の出典参照先がありません: {record['id']} -> {source_id}")
            time_basis = record.get("time_estimate_basis")
            if time_basis and time_basis not in source_ids:
                errors.append(f"仮時刻の根拠参照先がありません: {record['id']} -> {time_basis}")
            for key, value in record.items():
                if isinstance(value, str) and key not in {"image", "source_id"} and not key.endswith("_image") and re.search(r"\bch\d+\b", value, re.IGNORECASE):
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
