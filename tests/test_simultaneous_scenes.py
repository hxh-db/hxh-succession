import copy
import json
import unittest
from pathlib import Path
from validate_data import validate_simultaneous_scenes


class SimultaneousSceneTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.events = json.loads((root / "data/events.json").read_text(encoding="utf-8"))

    def mutated(self, changes):
        events = copy.deepcopy(self.events)
        by_id = {event["id"]: event for event in events}
        for event_id, values in changes.items():
            for key, value in values.items():
                if value is None:
                    by_id[event_id].pop(key, None)
                else:
                    by_id[event_id][key] = value
        return validate_simultaneous_scenes(events)

    def assert_detected(self, changes, message):
        errors = self.mutated(changes)
        self.assertTrue(any(message in error for error in errors), errors)

    def test_current_records(self):
        self.assertEqual(validate_simultaneous_scenes(self.events), [])

    def test_broadcast_pair(self):
        by_id = {event["id"]: event for event in self.events}
        self.assertEqual(by_id["E400-001"]["simultaneous_with"], ["E404-008"])
        self.assertEqual(by_id["E404-008"]["simultaneous_with"], ["E400-001"])
        self.assertEqual(by_id["E400-001"]["day"], 12)
        self.assertEqual(by_id["E400-001"]["time_estimate"], by_id["E404-008"]["time_estimate"])

    def test_missing_reference(self):
        self.assert_detected({"E400-001": {"simultaneous_with": ["E404-008", "E999-001"]}}, "参照先がありません")

    def test_one_way_reference(self):
        self.assert_detected({"E404-008": {"simultaneous_with": None}}, "相互参照になっていません")

    def test_day_mismatch(self):
        self.assert_detected({"E400-001": {"day": 10}}, "日付が一致しません")

    def test_time_mismatch(self):
        self.assert_detected({"E400-001": {"time_estimate": "14:50"}}, "時刻が一致しません")

    def test_estimate_must_match_confirmed(self):
        self.assert_detected({"E415-008": {"time_estimate": "14:20"}}, "仮時刻が確定時刻と一致しません")

    def test_incomplete_group(self):
        self.assert_detected({"E408-008": {"simultaneous_with": ["E409-001"]}}, "全員を挙げていません")


if __name__ == "__main__":
    unittest.main()
