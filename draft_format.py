"""Version-1/2 draft validation shared by the local HTTP read/write boundaries.

The cross-language examples in tests/fixtures/draft-format-cases.json also run
against DraftState.validateSnapshot. No application or third-party runtime is needed.
"""

from datetime import datetime, timezone
import json
import math
import re

FORMAT = "hxh-succession-local-drafts"
FIELDS = {"memo", "edits", "title", "createdRecord"}
DATE = re.compile(r"\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?", re.ASCII)
CLOCK = re.compile(r"(?:[01]\d|2[0-3]):[0-5]\d", re.ASCII)
TEXT_FIELDS = {"description", "location", "type", "notes", "room", "status", "role", "nen_ability", "appearance", "nen_type", "ability"}


def valid_date(value) -> bool:
    if not isinstance(value, str) or not DATE.fullmatch(value):
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        return True
    except (ValueError, OverflowError):
        return False


def integer(value) -> bool:
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value == int(value)
    except OverflowError:
        return False


def valid_values(values) -> bool:
    if not isinstance(values, dict):
        return False
    for key, value in values.items():
        if key == "day" and value is not None and (not integer(value) or not 0 <= value <= 12):
            return False
        if key in {"time_start", "time_estimate", "time_end"} and value not in (None, "") and (not isinstance(value, str) or not CLOCK.fullmatch(value)):
            return False
        if key in TEXT_FIELDS:
            if key == "description":
                if not isinstance(value, str) or not value.strip():
                    return False
            elif value is not None and not isinstance(value, str):
                return False
    return not (values.get("time_start") and values.get("time_estimate"))


def finite_numbers(value) -> bool:
    if isinstance(value, dict):
        return all(finite_numbers(item) for item in value.values())
    if isinstance(value, list):
        return all(finite_numbers(item) for item in value)
    if isinstance(value, (int, float)):
        try:
            return math.isfinite(value)
        except OverflowError:
            return False
    return True


def milliseconds(value):
    if not value:
        return 0
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    elapsed = parsed.astimezone(timezone.utc) - datetime(1970, 1, 1, tzinfo=timezone.utc)
    return elapsed.days * 86400000 + elapsed.seconds * 1000 + elapsed.microseconds // 1000


def choice_key(choice):
    def normalize(value):
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normalize(item) for item in value]
        return int(value) if integer(value) else value
    return (True, json.dumps(normalize(choice["value"]), ensure_ascii=False, sort_keys=True, separators=(",", ":"))) if choice["present"] else (False, "")


def validate_conflicts(item):
    if not isinstance(item["conflicts"], dict):
        raise ValueError("競合したメモの形式が正しくありません。")
    for field, choices in item["conflicts"].items():
        if field not in FIELDS or not isinstance(choices, list) or len(choices) < 2:
            raise ValueError("競合したメモの形式が正しくありません。")
        time = milliseconds(item.get("fieldUpdatedAt", {}).get(field, item.get("updatedAt")))
        seen = set()
        for choice in choices:
            if not isinstance(choice, dict) or not isinstance(choice.get("present"), bool) or not valid_date(choice.get("updatedAt")) or milliseconds(choice["updatedAt"]) != time:
                raise ValueError("競合したメモの日時の形式が正しくありません。")
            if choice["present"]:
                if "value" not in choice:
                    raise ValueError("競合したメモの形式が正しくありません。")
                validate_snapshot({"version": 2, "items": {"candidate": {field: choice["value"]}}})
            elif "value" in choice:
                raise ValueError("競合したメモの形式が正しくありません。")
            key = choice_key(choice)
            if key in seen:
                raise ValueError("競合したメモの候補が重複しています。")
            seen.add(key)
        current = {"present": field in item, **({"value": item[field]} if field in item else {})}
        if choice_key(current) not in seen:
            raise ValueError("競合したメモの表示候補の形式が正しくありません。")


def validate_snapshot(source, *, envelope=False) -> None:
    """Reject invalid input without normalizing or deleting any stored fields."""
    if not isinstance(source, dict) or not integer(source.get("version")) or source["version"] not in (1, 2) or not isinstance(source.get("items"), dict) or not finite_numbers(source):
        raise ValueError("メモの保存データの形式が正しくありません。")
    if ("format" in source and source["format"] != FORMAT) or (envelope and source.get("format") != FORMAT):
        raise ValueError("メモの保存データの形式が正しくありません。")
    for key in ("resetAt", "exportedAt"):
        if key in source and not valid_date(source[key]):
            raise ValueError("メモの保存日時の形式が正しくありません。")
    if envelope and "entries" not in source:
        raise ValueError("メモの一覧の形式が正しくありません。")
    if "entries" in source:
        if not isinstance(source["entries"], list):
            raise ValueError("メモの一覧の形式が正しくありません。")
        for entry in source["entries"]:
            if not isinstance(entry, dict) or any(key in entry and not isinstance(entry[key], str) for key in ("key", "memo", "title")) or (entry.get("updatedAt") is not None and not valid_date(entry["updatedAt"])):
                raise ValueError("メモの一覧の形式が正しくありません。")
    for key, item in source["items"].items():
        if not isinstance(key, str) or not key.strip() or key in {"__proto__", "constructor", "prototype"} or not isinstance(item, dict):
            raise ValueError("メモの項目の形式が正しくありません。")
        if any(key in item and not isinstance(item[key], str) for key in ("memo", "title")):
            raise ValueError("メモ本文の形式が正しくありません。")
        if "updatedAt" in item and not valid_date(item["updatedAt"]):
            raise ValueError("メモの更新日時の形式が正しくありません。")
        if "edits" in item and not valid_values(item["edits"]):
            raise ValueError("メモの編集内容の形式が正しくありません。")
        if "createdRecord" in item:
            created = item["createdRecord"]
            if not valid_values(created) or any(key in created and (not integer(created[key]) or created[key] < 1) for key in ("chapter", "chapter_order")) or ("characters" in created and (not isinstance(created["characters"], list) or any(not isinstance(value, str) for value in created["characters"]))):
                raise ValueError("追加した出来事の形式が正しくありません。")
            if "trashedAt" in created and not valid_date(created["trashedAt"]):
                raise ValueError("ゴミ箱へ移した日時の形式が正しくありません。")
        if "fieldUpdatedAt" in item:
            dates = item["fieldUpdatedAt"]
            if not isinstance(dates, dict) or any(key not in FIELDS or not valid_date(value) for key, value in dates.items()):
                raise ValueError("メモの項目別更新日時の形式が正しくありません。")
        if "conflicts" in item:
            validate_conflicts(item)
            if source["version"] == 1 and item["conflicts"]:
                raise ValueError("競合したメモは保存形式2が必要です。")
