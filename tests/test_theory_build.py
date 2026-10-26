import contextlib
import io
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch


class TheoryBuildTests(unittest.TestCase):
    def check_build(self, stale=False):
        root = Path(__file__).resolve().parents[1]
        original_read = Path.read_text

        def read(path, *args, **kwargs):
            if stale and path == root / "theories/Q001/index.html":
                return "stale test content"
            return original_read(path, *args, **kwargs)

        output = io.StringIO()
        with patch("sys.argv", ["build-theories.py", "--check"]), \
                patch.object(Path, "read_text", read), \
                patch.object(Path, "write_text", side_effect=AssertionError("--check must never write")), \
                contextlib.redirect_stdout(output):
            if stale:
                with self.assertRaises(SystemExit) as error:
                    runpy.run_path(str(root / "scripts/build-theories.py"), run_name="__main__")
                self.assertEqual(error.exception.code, 1)
            else:
                runpy.run_path(str(root / "scripts/build-theories.py"), run_name="__main__")
        return output.getvalue()

    def test_generated_pages_are_current_without_writing(self):
        self.assertIn("17 articles and index match", self.check_build())

    def test_stale_article_fails_without_overwriting(self):
        self.assertIn("STALE: theories", self.check_build(stale=True))


if __name__ == "__main__":
    unittest.main()
