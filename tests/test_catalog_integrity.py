import copy
import io
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_data

BASE = Path(__file__).resolve().parents[1] / "data"


class CatalogIntegrityTests(unittest.TestCase):
    def errors(self, filename, mutate):
        data = json.loads((BASE / filename).read_text(encoding="utf-8"))
        mutate(data)
        original_open = open

        def read(path, *args, **kwargs):
            if Path(path) == BASE / filename:
                return io.StringIO(json.dumps(data, ensure_ascii=False))
            return original_open(path, *args, **kwargs)

        with patch("builtins.open", side_effect=read):
            return "\n".join(validate_data.validate_cross_references(BASE))

    def test_current_catalogs_are_consistent(self):
        self.assertEqual(validate_data.validate_cross_references(BASE), [])

    def test_duplicate_event_id(self):
        self.assertIn("出来事IDが重複", self.errors("events.json", lambda rows: rows.append(copy.deepcopy(rows[0]))))

    def test_duplicate_source_id(self):
        self.assertIn("出典IDが重複", self.errors("sources.json", lambda rows: rows.append(copy.deepcopy(rows[0]))))

    def test_duplicate_image_and_missing_person(self):
        self.assertIn("人物画像IDが重複", self.errors("character_images.json", lambda rows: rows.append(copy.deepcopy(rows[0]))))
        self.assertIn("人物画像の参照先がありません", self.errors("character_images.json", lambda rows: rows[0].update(id="MISSING")))

    def test_tag_definitions_assignments_and_unknown_tag(self):
        self.assertIn("人物タグIDが重複", self.errors("character_tags.json", lambda data: data["definitions"].append(copy.deepcopy(data["definitions"][0]))))
        self.assertIn("人物タグ割当が重複", self.errors("character_tags.json", lambda data: data["assignments"].append(copy.deepcopy(data["assignments"][0]))))
        self.assertIn("未定義の人物タグ", self.errors("character_tags.json", lambda data: data["assignments"][0]["tag_ids"].append("missing-tag")))
        self.assertIn("未定義の人物タグ", self.errors("character_tags.json", lambda data: data["assignments"][0]["tag_ids"].append("guard-p99")))
        self.assertEqual(self.errors("character_tags.json", lambda data: data["assignments"][0]["tag_ids"].append("guard-p02")), "")

    def test_alliance_people_events_and_prince_type(self):
        for field, missing, message in [
            ("prince_ids", "MISSING", "共闘の王子参照が不正"),
            ("prince_ids", "P14-H01", "共闘の王子参照が不正"),
            ("cooperator_ids", "MISSING", "共闘の協力者参照先がありません"),
            ("evidence_event_ids", "E999-999", "共闘の根拠となる出来事参照先がありません"),
        ]:
            with self.subTest(field=field, missing=missing):
                self.assertIn(message, self.errors("alliances.json", lambda data: data["alliances"][0][field].append(missing)))
        self.assertIn("共闘IDが重複", self.errors("alliances.json", lambda data: data["alliances"].append(copy.deepcopy(data["alliances"][0]))))

    def test_chronology_cycles_and_self_reference(self):
        def cycle(rows):
            rows[0]["time_before_event_id"] = rows[1]["id"]
            rows[1]["time_before_event_id"] = rows[2]["id"]
            rows[2]["time_before_event_id"] = rows[0]["id"]
        self.assertIn("出来事の前後関係が循環", self.errors("events.json", cycle))
        self.assertIn("出来事の前後関係が循環", self.errors("events.json", lambda rows: rows[0].update(time_after_event_id=rows[0]["id"])))

    def test_supporting_catalog_shapes(self):
        samples = {
            "sources": [{"id": "source", "title": "資料", "url": None, "source_type": "official", "supports": "根拠"}],
            "character_images": [{"id": "P01", "image": "images/characters/p01.png"}],
            "character_tags": {"version": 1, "definitions": [{"id": "tag", "category": "分類", "label": "タグ"}], "assignments": [{"character_id": "P01", "tag_ids": ["tag"]}]},
            "alliances": {"version": 1, "alliances": [{"id": "ALL-1", "name": "共闘", "prince_ids": ["P01", "P02"], "cooperator_ids": [], "evidence_event_ids": ["E001-001"]}]},
        }
        for name, sample in samples.items():
            with self.subTest(name=name):
                schema_path = BASE / f"{name}.schema.json"
                self.assertTrue(schema_path.exists(), name)
                schema = json.loads(schema_path.read_text(encoding="utf-8"))
                validator = validate_data.jsonschema.Draft7Validator(schema)
                self.assertEqual(list(validator.iter_errors(sample)), [])
                self.assertTrue(list(validator.iter_errors(None)))
                invalid = copy.deepcopy(sample)
                if name == "character_tags":
                    invalid["assignments"][0]["tag_ids"] = "tag"
                elif name == "alliances":
                    invalid["alliances"][0]["prince_ids"] = ["P01", "P01"]
                else:
                    invalid[0]["id"] = ""
                self.assertTrue(list(validator.iter_errors(invalid)))


if __name__ == "__main__":
    unittest.main()
