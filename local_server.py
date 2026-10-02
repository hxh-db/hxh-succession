"""Local-only site server with a private, automatically saved draft file."""

from __future__ import annotations

import json
import os
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
PRIVATE_DIR = Path(os.environ.get("SUCCESSION_NOTES_DIR", ROOT / ".local")).resolve()
DRAFT_FILE = PRIVATE_DIR / "drafts.json"
MAX_BODY_BYTES = 5 * 1024 * 1024
PORT = int(os.environ.get("SUCCESSION_LOCAL_PORT", "8765"))
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}


class LocalSiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _path(self) -> str:
        return unquote(urlsplit(self.path).path)

    def _is_private_path(self) -> bool:
        parts = Path(self._path().replace("\\", "/")).parts
        return any(part.startswith(".") for part in parts if part not in {".", ".."}) or any(
            part.startswith("codex-notes") and part.endswith(".json") for part in parts
        )

    def _send_json(self, status: int, payload: dict) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:
        if self.headers.get("Host", "").lower() not in ALLOWED_HOSTS:
            self.send_error(403)
            return
        if self._path() == "/api/drafts":
            if DRAFT_FILE.exists():
                try:
                    self._send_json(200, json.loads(DRAFT_FILE.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    self._send_json(500, {"error": "メモファイルを読めません。元ファイルは残しています。"})
            else:
                self._send_json(200, {"format": "hxh-succession-local-drafts", "version": 1, "items": {}})
            return
        if self._is_private_path() or self._path().startswith("/api/"):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if self.headers.get("Host", "").lower() not in ALLOWED_HOSTS:
            self.send_error(403)
            return
        if self._is_private_path() or self._path().startswith("/api/"):
            self.send_error(404)
            return
        super().do_HEAD()

    def list_directory(self, path: str):
        self.send_error(403, "Directory listing is disabled")
        return None

    def do_PUT(self) -> None:
        if self._path() != "/api/drafts":
            self.send_error(404)
            return
        host = self.headers.get("Host", "").lower()
        origin = self.headers.get("Origin", "")
        if host not in ALLOWED_HOSTS or origin != f"http://{host}":
            self._send_json(403, {"error": "このPCのサイトからだけ保存できます。"})
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0] != "application/json":
            self._send_json(415, {"error": "JSON形式で送信してください。"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY_BYTES:
            self._send_json(413, {"error": "メモのサイズが大きすぎます。"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"error": "メモの形式が正しくありません。"})
            return
        if (not isinstance(payload, dict) or payload.get("format") != "hxh-succession-local-drafts"
                or payload.get("version") != 1 or not isinstance(payload.get("items"), dict)
                or not isinstance(payload.get("entries"), list)):
            self._send_json(400, {"error": "メモの形式が正しくありません。"})
            return
        PRIVATE_DIR.mkdir(exist_ok=True)
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=PRIVATE_DIR, suffix=".tmp", delete=False) as temp:
                temp_path = Path(temp.name)
                json.dump(payload, temp, ensure_ascii=False, indent=2)
                temp.write("\n")
                temp.flush()
                os.fsync(temp.fileno())
            os.replace(temp_path, DRAFT_FILE)
        except OSError:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
            self._send_json(500, {"error": "PCへの保存に失敗しました。"})
            return
        self._send_json(200, {"saved": True, "count": len(payload["items"])})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), LocalSiteHandler)
    print(f"Local site: http://127.0.0.1:{PORT}/", flush=True)
    print(f"Private drafts: {DRAFT_FILE}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
