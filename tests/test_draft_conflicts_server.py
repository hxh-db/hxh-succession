"""HTTP revision checks use only isolated temporary notes."""
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import local_server


class DraftConflictServerTests(unittest.TestCase):
    def test_concurrent_writer_cannot_replace_another_save_or_reset(self):
        with tempfile.TemporaryDirectory(prefix="hxh-conflicts-test-") as directory:
            server = local_server.ThreadingHTTPServer(("127.0.0.1", 0), local_server.LocalSiteHandler)
            host = f"127.0.0.1:{server.server_port}"
            url = f"http://{host}/api/drafts"
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            with patch.multiple(local_server, PRIVATE_DIR=Path(directory),
                                DRAFT_FILE=Path(directory) / "drafts.json", ALLOWED_HOSTS={host}):
                thread.start()
                try:
                    def get():
                        with urlopen(url) as response:
                            self.assertEqual(response.headers["Cache-Control"], "no-store")
                            return json.load(response), response.headers["ETag"]

                    def put(payload, revision):
                        request = Request(url, method="PUT", data=json.dumps(payload).encode(),
                                          headers={"Content-Type": "application/json", "Origin": f"http://{host}",
                                                   "If-Match": revision})
                        with urlopen(request) as response:
                            return response.status

                    empty, initial = get()
                    self.assertEqual(empty["entries"], [])
                    first = {**empty, "items": {"guide:test": {"memo": "keep this"}}}
                    self.assertEqual(put(first, initial), 200)
                    current, revision = get()
                    self.assertNotEqual(revision, initial)
                    self.assertEqual(current, first)
                    # A tab still running the old client cannot perform an unconditional overwrite.
                    with self.assertRaises(HTTPError) as legacy:
                        urlopen(Request(url, method="PUT", data=json.dumps(empty).encode(),
                                        headers={"Content-Type": "application/json", "Origin": f"http://{host}"}))
                    self.assertEqual(legacy.exception.code, 428)
                    self.assertEqual(get(), (first, revision))
                    with self.assertRaises(HTTPError) as conflict:
                        put(empty, initial)
                    self.assertEqual(conflict.exception.code, 412)
                    self.assertEqual(get(), (first, revision))
                    reset = {**empty, "resetAt": "2026-10-26T00:00:00.000Z"}
                    self.assertEqual(put(reset, revision), 200)
                    with self.assertRaises(HTTPError) as conflict:
                        put(first, revision)
                    self.assertEqual(conflict.exception.code, 412)
                    self.assertEqual(get()[0], reset)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join()


if __name__ == "__main__":
    unittest.main()
