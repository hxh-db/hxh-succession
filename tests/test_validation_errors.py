import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import validate_data


class ValidationErrorTests(unittest.TestCase):
    def test_bad_json_and_missing_schema_are_failures(self):
        with tempfile.TemporaryDirectory(prefix="hxh-validation-test-") as directory:
            data = Path(directory) / "data.json"
            schema = Path(directory) / "schema.json"
            data.write_text("{broken", encoding="utf-8")
            ok, errors = validate_data.validate_json_file(data, schema)
            self.assertFalse(ok)
            self.assertIn("JSON パースエラー", errors[0])
            data.write_text("[]", encoding="utf-8")
            ok, errors = validate_data.validate_json_file(data, schema)
            self.assertFalse(ok)
            self.assertIn("スキーマファイルが見つかりません", errors[0])

    def test_schema_error_does_not_crash_cross_references(self):
        output = io.StringIO()
        with patch.object(validate_data, "validate_json_file", return_value=(False, ["test schema error"])), \
                patch.object(validate_data, "validate_cross_references") as cross, contextlib.redirect_stdout(output):
            self.assertEqual(validate_data.main(), 1)
            cross.assert_not_called()
        self.assertIn("JSON・スキーマのエラーを修正", output.getvalue())

    def test_malformed_supporting_data_is_reported_as_a_failure(self):
        output = io.StringIO()
        with patch.object(validate_data, "validate_json_file", return_value=(True, [])), \
                patch.object(validate_data, "validate_cross_references", side_effect=KeyError("assignments")), \
                contextlib.redirect_stdout(output):
            self.assertEqual(validate_data.main(), 1)
        self.assertIn("参照検証に必要なデータを読めません", output.getvalue())


if __name__ == "__main__":
    unittest.main()
