import contextlib
import copy
import importlib.util
import io
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/build-review-status.py"
spec = importlib.util.spec_from_file_location("review_status", SCRIPT)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class ReviewStatusTests(unittest.TestCase):
    def fixture(self):
        events = [
            {"id":"E001-001", "chapter":1, "description":"reviewed", "verification_status":"review_recorded", "day":1},
            {"id":"E002-001", "chapter":2, "description":"pending", "verification_status":"unverified", "day":None, "verification_note":"source missing"},
            {"id":"E003-001", "chapter":3, "description":"adopted hypothesis", "verification_status":"hypothesis", "day":None},
        ]
        characters = [{"id":"C1", "is_placeholder":True}]
        backlog = [{"id":name, "status":status} for name,status in [("open","needs_original_review"),("done","resolved"),("inference","resolved_with_inference")]]
        pending = {"records":[{"event_id":"E001-001", "outcome":"resolved"},{"event_id":"E002-001", "outcome":"source_not_found"},{"event_id":"E372-009", "outcome":"partial"}]}
        targets = {"open":{"event_ids":["E002-001"], "evidence_paths":["existing-review.md"], "next_action":"read source"}}
        return [events,characters,backlog,pending,targets,[]]

    def test_closed_inference_and_removed_records_are_not_open_issues(self):
        fixture = self.fixture()
        original = copy.deepcopy(fixture)
        report = review.build_report(*fixture)
        self.assertEqual(fixture,original,"Reporting must not change facts or backlog status")
        self.assertEqual([row["id"] for row in report["active_backlog"]],["open"])
        self.assertEqual([row["id"] for row in report["resolved_backlog"]],["done"])
        self.assertEqual([row["id"] for row in report["adopted_inference_backlog"]],["inference"])
        self.assertEqual([row["event_id"] for row in report["unverified_events"]],["E002-001"])
        self.assertEqual(report["historical_records_absent_from_current_events"],["E372-009"])
        self.assertEqual(report["hypothesis_event_ids"],["E003-001"])
        self.assertEqual(report["counts"]["day_unset"],2)
        self.assertNotIn("errors",report["counts"])

    def test_target_registration_catches_omissions_and_invalid_ids(self):
        for changes in [{}, {"event_ids":["missing"]}, {"character_ids":["missing"]}, {"web_research_ids":["missing"]}, {"chapters":[999]}]:
            fixture=self.fixture()
            if changes:
                fixture[4]["open"].update(changes)
            else:
                fixture[4]={}
            with self.subTest(changes=changes),self.assertRaises(AssertionError):
                review.build_report(*fixture)

    def test_scope_exclusion_does_not_delete_or_promote_event_records(self):
        fixture = self.fixture()
        fixture[4]["open"]["event_ids"] = ["E001-001","E002-001"]
        before = copy.deepcopy(fixture)
        report = review.build_report(*fixture, scope_exclusions=[{"chapters":[2],"reason":"user scope"}])
        self.assertEqual(fixture,before)
        self.assertEqual(report["active_backlog"][0]["event_ids"],["E001-001"])
        self.assertEqual(report["excluded_event_ids"],["E002-001"])
        self.assertTrue(report["unverified_events"][0]["excluded_from_current_review"])
        self.assertEqual(report["counts"]["event_verification"]["unverified"],1)

    def test_current_report_is_valid_and_check_never_writes(self):
        report=review.load_report()
        active={row["id"] for row in report["active_backlog"]}
        self.assertTrue(active.isdisjoint(row["id"] for row in report["resolved_backlog"]+report["adopted_inference_backlog"]))
        self.assertNotIn("E372-009",[row["event_id"] for row in report["unverified_events"]])
        with patch("sys.argv",[str(SCRIPT),"--check"]),patch.object(Path,"write_text",side_effect=AssertionError("check wrote")),contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(SCRIPT),run_name="__main__")

    def test_deferred_material_stays_visible_without_becoming_verified(self):
        fixture = self.fixture()
        fixture[2][0].update(topic="open original review", required_source="manga")
        fixture[2].append({"id":"optional", "status":"deferred_material", "topic":"extra original", "reason":"user scope", "required_source":"DVD"})
        fixture[4]["optional"] = {"event_ids":["E002-001"], "evidence_paths":["existing-review.md"], "next_action":"original becomes available"}
        before = copy.deepcopy(fixture)
        report = review.build_report(*fixture)
        self.assertEqual(fixture,before)
        self.assertEqual([row["id"] for row in report["active_backlog"]],["open"])
        self.assertEqual([row["id"] for row in report["deferred_material_backlog"]],["optional"])
        self.assertEqual(report["counts"]["deferred_material_backlog"],1)
        self.assertEqual(report["counts"]["event_verification"]["unverified"],1)
        self.assertNotIn("optional", [row["id"] for row in report["resolved_backlog"]])
        self.assertIn("extra original", review.render(report))
        self.assertIn("original becomes available", review.render(report))
        fixture[4]["optional"]["event_ids"] = ["missing"]
        with self.assertRaises(AssertionError):
            review.build_report(*fixture)

    def test_stale_output_check_fails_without_writing(self):
        original_read=Path.read_text
        def read(path,*args,**kwargs):
            if path==ROOT/"data/intake/current_review_status.md":
                return "stale report"
            return original_read(path,*args,**kwargs)
        with patch("sys.argv",[str(SCRIPT),"--check"]),patch.object(Path,"read_text",read),patch.object(Path,"write_text",side_effect=AssertionError("check wrote")),contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                runpy.run_path(str(SCRIPT),run_name="__main__")
        self.assertEqual(caught.exception.code,1)


if __name__ == "__main__":
    unittest.main()
