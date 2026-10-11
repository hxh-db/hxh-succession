"""2026-10-11 ユーザーレビュー（訂正が別の欄に反映されていない・読み違えやすい）への対応の検査。"""
import copy
import json
import unittest
from pathlib import Path

from validate_data import (
    validate_absence_claims,
    validate_character_evidence,
    validate_nen_ability_editorial,
    validate_same_incidents,
)


ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


class SameIncidentTests(unittest.TestCase):
    def setUp(self):
        self.events = load("events.json")
        self.by_id = {event["id"]: event for event in self.events}

    def mutated(self, changes):
        events = copy.deepcopy(self.events)
        by_id = {event["id"]: event for event in events}
        for event_id, value in changes.items():
            if value is None:
                by_id[event_id].pop("same_incident_with", None)
            else:
                by_id[event_id]["same_incident_with"] = value
        return validate_same_incidents(events)

    def test_current_records(self):
        self.assertEqual(validate_same_incidents(self.events), [])

    def test_first_prince_shot_is_one_incident(self):
        # 第416話の発砲を、第417話の扉と第418話のツェリードニヒ側が描き直す（発砲は1回）。
        group = {"E416-002", "E417-001", "E418-003"}
        for event_id in group:
            self.assertTrue(group - {event_id} <= set(self.by_id[event_id]["same_incident_with"]), event_id)
        self.assertIn("E416-005", self.by_id["E418-003"]["same_incident_with"])
        self.assertIn("描き直", self.by_id["E417-001"]["description"])

    def test_teta_shot_is_one_incident(self):
        for event_id in ("E385-002", "E385-003", "E385-004", "E385-005"):
            self.assertIn(event_id, self.by_id["E387-001"]["same_incident_with"])
            self.assertEqual(self.by_id[event_id]["same_incident_with"], ["E387-001"])

    def test_times_need_not_match(self):
        # simultaneous_with と違い、日付・時刻の一致は求めない。
        self.assertNotEqual(self.by_id["E416-002"]["time_estimate"], self.by_id["E418-003"]["time_estimate"])

    def test_missing_reference(self):
        errors = self.mutated({"E416-002": ["E417-001", "E418-003", "E999-001"]})
        self.assertTrue(any("参照先がありません" in error for error in errors), errors)

    def test_one_way_reference(self):
        errors = self.mutated({"E417-001": None})
        self.assertTrue(any("相互参照になっていません" in error for error in errors), errors)

    def test_self_reference(self):
        errors = self.mutated({"E416-002": ["E416-002", "E417-001", "E418-003"]})
        self.assertTrue(any("自分自身を参照" in error for error in errors), errors)


class AbsenceClaimTests(unittest.TestCase):
    def setUp(self):
        self.characters = load("characters.json")
        self.events = load("events.json")

    def test_current_records(self):
        self.assertEqual(validate_absence_claims(self.characters, self.events), [])

    def test_hyulikoff_ch416_record_removed(self):
        ids = {event["id"] for event in self.events}
        self.assertNotIn("E416-003", ids)
        for event in self.events:
            if event["chapter"] == 416:
                self.assertNotIn("P01-P06", event["characters"], event["id"])

    def test_detects_uncorrected_event(self):
        events = copy.deepcopy(self.events)
        events.append({"id": "E416-099", "chapter": 416, "characters": ["P01", "P01-P06"], "description": "旧記録"})
        errors = validate_absence_claims(self.characters, events)
        self.assertTrue(any("P01-P06 -> E416-099" in error for error in errors), errors)

    def test_mentioned_is_allowed(self):
        events = copy.deepcopy(self.events)
        events.append({"id": "E416-099", "chapter": 416, "characters": ["P01-P06"], "character_presence": {"P01-P06": "mentioned"}})
        self.assertEqual(validate_absence_claims(self.characters, events), [])


class NenAbilityEditorialTests(unittest.TestCase):
    def setUp(self):
        self.characters = load("characters.json")
        self.by_id = {person["id"]: person for person in self.characters}

    def test_current_records(self):
        self.assertEqual(validate_nen_ability_editorial(self.characters), [])

    def test_tserriednich_reading_note_moved(self):
        person = self.by_id["P04"]
        self.assertNotIn("テン・セカンズ", person["nen_ability"])
        self.assertIn("テン・セカンズ", person["nen_ability_editorial"])
        self.assertIn("仮説", person["nen_ability"])

    def test_detects_editorial_in_body(self):
        characters = copy.deepcopy(self.characters)
        next(p for p in characters if p["id"] == "P04")["nen_ability"] += "（旧記載の読みは出典未確認）"
        errors = validate_nen_ability_editorial(characters)
        self.assertTrue(any("P04" in error for error in errors), errors)

    def test_empty_editorial_rejected(self):
        characters = copy.deepcopy(self.characters)
        next(p for p in characters if p["id"] == "P04")["nen_ability_editorial"] = " "
        self.assertTrue(validate_nen_ability_editorial(characters))


class HalkenburgStatusTests(unittest.TestCase):
    def setUp(self):
        self.characters = load("characters.json")
        self.events = load("events.json")
        self.people = {person["id"]: person for person in self.characters}
        self.by_id = {event["id"]: event for event in self.events}

    def test_ch403_heading_matches_depiction(self):
        log = self.people["P09"]["status_log"]
        first = log[0]
        self.assertEqual(first["chapter"], 403)
        for word in ("拘束", "入れ替わる）"):
            self.assertNotIn(word, first["status"].replace("入れ替わりは描かれない", ""))
        self.assertIn("描かれない", first["status"])
        self.assertEqual(first["event_id"], "E403-017")

    def test_personality_swap_belongs_to_ch404(self):
        swap = [entry for entry in self.people["P09"]["status_log"] if entry.get("event_id") == "E404-002"]
        self.assertEqual(len(swap), 1)
        self.assertEqual(swap[0]["chapter"], 404)
        effects = {effect["character"]: effect["status"] for effect in self.by_id["E404-002"]["status_effects"]}
        self.assertEqual(effects["P09"], swap[0]["status"])
        self.assertIn("P01-P05", effects)

    def test_status_links_are_consistent(self):
        self.assertEqual(validate_character_evidence(self.characters, self.events), [])


if __name__ == "__main__":
    unittest.main()
