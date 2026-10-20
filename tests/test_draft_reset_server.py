"""Use an isolated temporary draft file; never touch the user's real notes."""
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import local_server


class DraftResetServerTests(unittest.TestCase):
    def test_reset_rejects_delayed_old_save_and_accepts_new_notes(self):
        with tempfile.TemporaryDirectory(prefix="hxh-reset-test-") as directory:
            server = local_server.ThreadingHTTPServer(("127.0.0.1", 0), local_server.LocalSiteHandler)
            host = f"127.0.0.1:{server.server_port}"
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            with patch.multiple(local_server, PRIVATE_DIR=Path(directory),
                                DRAFT_FILE=Path(directory) / "drafts.json", ALLOWED_HOSTS={host}):
                thread.start()
                try:
                    def put(payload):
                        request = Request(f"http://{host}/api/drafts", method="PUT",
                                          data=json.dumps(payload).encode(),
                                          headers={"Content-Type": "application/json", "Origin": f"http://{host}"})
                        with urlopen(request) as response:
                            return response.status

                    old = {"format": "hxh-succession-local-drafts", "version": 1,
                           "items": {"theory:Q001": {"memo": "private test only"}}, "entries": []}
                    self.assertEqual(put(old), 200)
                    reset = {**old, "items": {}, "resetAt": "2026-10-20T01:00:00.000Z"}
                    self.assertEqual(put(reset), 200)
                    with self.assertRaises(HTTPError) as caught:
                        put(old)
                    self.assertEqual(caught.exception.code, 409)
                    self.assertEqual(json.loads(local_server.DRAFT_FILE.read_text(encoding="utf-8")), reset)
                    fresh = {**reset, "items": {"theory:Q002": {"memo": "new note"}}}
                    self.assertEqual(put(fresh), 200)
                    self.assertEqual(json.loads(local_server.DRAFT_FILE.read_text(encoding="utf-8")), fresh)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join()


if __name__ == "__main__":
    unittest.main()
