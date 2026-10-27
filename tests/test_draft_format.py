"""Cross-language format examples and real handler boundaries, isolated notes only."""
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from draft_format import validate_snapshot
import local_server

VECTORS = json.loads((Path(__file__).parent / "fixtures/draft-format-cases.json").read_text(encoding="utf-8"))


def payload(row):
    value = copy.deepcopy(row.get("source", {**VECTORS["base"], **row.get("patch", {})}))
    if "item" in row:
        value["items"]["event:E383-004"] = copy.deepcopy(row["item"])
    return value


class DraftFormatTests(unittest.TestCase):
    def handler(self, content=b"", revision=None):
        handler = local_server.LocalSiteHandler.__new__(local_server.LocalSiteHandler)
        handler.path = "/api/drafts"
        host = f"127.0.0.1:{local_server.PORT}"
        handler.headers = {"Host": host, "Origin": f"http://{host}", "Content-Type": "application/json",
                           "Content-Length": str(len(content)), "If-Match": revision or local_server.LocalSiteHandler._revision(b"")}
        handler.rfile = io.BytesIO(content)
        responses = []
        handler._send_json = lambda status, body, *args: responses.append((status, body))
        return handler, responses

    def test_shared_vectors_and_put_do_not_overwrite_on_rejection(self):
        with tempfile.TemporaryDirectory(prefix="hxh-format-test-") as directory:
            file = Path(directory) / "drafts.json"
            original = json.dumps(VECTORS["base"], ensure_ascii=False).encode()
            with patch.multiple(local_server, PRIVATE_DIR=Path(directory), DRAFT_FILE=file):
                for row in VECTORS["cases"]:
                    with self.subTest(row=row["name"]):
                        value = payload(row)
                        file.write_bytes(original)
                        handler, responses = self.handler(json.dumps(value).encode(), handler_revision(original))
                        if row["valid"]:
                            validate_snapshot(value, envelope=True)
                            handler.do_PUT()
                            self.assertEqual(responses[0][0], 200)
                            self.assertEqual(json.loads(file.read_bytes()), value)
                        else:
                            with self.assertRaises(ValueError):
                                validate_snapshot(value, envelope=True)
                            with patch.object(handler, "_save_drafts", side_effect=AssertionError("invalid input reached saving")):
                                handler.do_PUT()
                            self.assertEqual(responses[0][0], 400)
                            self.assertEqual(file.read_bytes(), original)

    def test_structurally_corrupt_existing_files_remain_exactly_unchanged(self):
        with tempfile.TemporaryDirectory(prefix="hxh-corrupt-format-test-") as directory:
            file = Path(directory) / "drafts.json"
            with patch.multiple(local_server, PRIVATE_DIR=Path(directory), DRAFT_FILE=file):
                invalid = [json.dumps(payload(row)).encode() for row in VECTORS["cases"] if not row["valid"]]
                invalid += [b"", b" \r\n\t", b"null", b"{broken", b'{"version":1,"items":{},"format":"hxh-succession-local-drafts","entries":[],"unknown":NaN}', b'{"version":1,"items":{},"format":"hxh-succession-local-drafts","entries":[],"unknown":1e999}']
                for raw in invalid:
                    with self.subTest(raw=raw[:80]):
                        file.write_bytes(raw)
                        getter, responses = self.handler()
                        getter.do_GET()
                        self.assertEqual(responses[0][0], 500)
                        self.assertIn("元ファイル", responses[0][1]["error"])
                        putter, responses = self.handler(json.dumps(VECTORS["base"]).encode(), handler_revision(raw))
                        putter.do_PUT()
                        self.assertEqual(responses[0][0], 500)
                        self.assertIn("元ファイル", responses[0][1]["error"])
                        self.assertEqual(file.read_bytes(), raw)
                        self.assertEqual(list(Path(directory).glob("*.tmp")), [])

    def test_missing_file_is_readable_and_first_save_still_creates_it(self):
        with tempfile.TemporaryDirectory(prefix="hxh-first-save-test-") as directory:
            file=Path(directory)/'drafts.json'
            with patch.multiple(local_server,PRIVATE_DIR=Path(directory),DRAFT_FILE=file):
                getter,responses=self.handler()
                getter.do_GET()
                self.assertEqual(responses[0][0],200)
                self.assertEqual(responses[0][1]['items'],{})
                self.assertFalse(file.exists(), 'Reading an unused store must not create a file')
                writer,responses=self.handler(json.dumps(VECTORS['base']).encode(),handler_revision(b''))
                writer.do_PUT()
                self.assertEqual(responses[0][0],200)
                self.assertEqual(json.loads(file.read_bytes()),VECTORS['base'])

    def test_non_json_numbers_cannot_be_stored(self):
        for value in [b"NaN",b"Infinity",b"1e999"]:
            handler, responses = self.handler(b'{"format":"hxh-succession-local-drafts","version":1,"items":{},"entries":[],"unknown":'+value+b'}')
            with patch.object(handler, "_save_drafts", side_effect=AssertionError("non-JSON reached saving")):
                handler.do_PUT()
            self.assertEqual(responses[0][0], 400)

    def test_conflicts_roundtrip_and_legacy_downgrade_is_blocked(self):
        value=payload(next(row for row in VECTORS['cases'] if row['name']=='version 2 memo conflict'))
        with tempfile.TemporaryDirectory(prefix='hxh-version2-test-') as directory:
            file=Path(directory)/'drafts.json'
            raw=json.dumps(value,ensure_ascii=False).encode()
            file.write_bytes(raw)
            with patch.multiple(local_server,PRIVATE_DIR=Path(directory),DRAFT_FILE=file):
                getter,responses=self.handler()
                getter.do_GET()
                self.assertEqual(responses[0],(200,value))
                old,responses=self.handler(json.dumps(VECTORS['base']).encode(),handler_revision(raw))
                old.do_PUT()
                self.assertEqual(responses[0][0],409)
                self.assertIn('再読み込み',responses[0][1]['error'])
                self.assertEqual(file.read_bytes(),raw)
                chosen={**value,'items':{'event:E383-004':{'memo':'B','updatedAt':'2026-10-28T00:00:00Z'}}}
                writer,responses=self.handler(json.dumps(chosen).encode(),handler_revision(raw))
                writer.do_PUT()
                self.assertEqual(responses[0][0],200)
                self.assertEqual(json.loads(file.read_bytes()),chosen)


def handler_revision(raw):
    return local_server.LocalSiteHandler._revision(raw)


if __name__ == "__main__":
    unittest.main()
