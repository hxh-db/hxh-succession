import copy
import json
import unittest
from pathlib import Path
from validate_data import validate_assignment_references


class AssignmentReferenceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.people = json.loads((root / "data/characters.json").read_text(encoding="utf-8"))
        self.events = json.loads((root / "data/events.json").read_text(encoding="utf-8"))
        self.hanzo = next(p for p in self.people if p["id"] == "P12-H01")

    def test_current_records(self):
        self.assertEqual(validate_assignment_references(self.people, self.events), [])

    def assert_mutation_detected(self, key, value, message):
        person = copy.deepcopy(self.hanzo)
        person["assignment_history"][1][key] = value
        self.assertTrue(any(message in error for error in validate_assignment_references([person] + [p for p in self.people if p["id"] != person["id"]], self.events)))

    def test_missing_event(self):
        self.assert_mutation_detected("event_id", "E361-003", "出来事参照先")

    def test_missing_prince(self):
        self.assert_mutation_detected("prince_id", "P99", "王子参照先")

    def test_wrong_chapter(self):
        self.assert_mutation_detected("chapter", 362, "話数が一致")

    def test_wrong_participant(self):
        self.assert_mutation_detected("event_id", "E361-004", "人物が出来事")


if __name__ == "__main__":
    unittest.main()
