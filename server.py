from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from datetime import datetime
import threading


DATA_FILE = Path(__file__).with_name("data.json")
BACKUP_DIR = Path(__file__).with_name("backups")
MAX_BACKUPS = 10
DEFAULT_STATE = {
    "items": [],
    "products": [],
    "sections": [],
    "users": [],
    "history": [],
    "deletedItemIds": [],
    "deletedProductKeys": [],
    "deletedSectionIds": [],
    "deletedUserIds": [],
    "restoredProductKeys": [],
    "productChanges": {},
}
STATE_LOCK = threading.Lock()


class ValidadeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/state":
            self.send_json(load_state())
            return

        super().do_GET()

    def do_POST(self):
        if self.path != "/api/state":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)

        try:
            state = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        cleaned = {
            "items": state.get("items", []),
            "products": state.get("products", []),
            "sections": state.get("sections", []),
            "users": state.get("users", []),
            "history": state.get("history", []),
            "deletedItemIds": state.get("deletedItemIds", []),
            "deletedProductKeys": state.get("deletedProductKeys", []),
            "deletedSectionIds": state.get("deletedSectionIds", []),
            "deletedUserIds": state.get("deletedUserIds", []),
            "restoredProductKeys": state.get("restoredProductKeys", []),
            "productChanges": state.get("productChanges", {}),
        }
        with STATE_LOCK:
            save_state(cleaned)
        self.send_json({"ok": True, "updatedAt": datetime.now().isoformat()})

    def send_json(self, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def load_state():
    if not DATA_FILE.exists():
        backup_state = load_latest_backup()
        return backup_state or DEFAULT_STATE

    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup_state = load_latest_backup()
        return backup_state or DEFAULT_STATE


def load_latest_backup():
    if not BACKUP_DIR.exists():
        return None

    for backup_file in sorted(BACKUP_DIR.glob("data-*.json"), reverse=True):
        try:
            return json.loads(backup_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

    return None


def save_state(state):
    BACKUP_DIR.mkdir(exist_ok=True)

    if DATA_FILE.exists():
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_file = BACKUP_DIR / f"data-{timestamp}.json"
        backup_file.write_text(DATA_FILE.read_text(encoding="utf-8"), encoding="utf-8")

    temporary_file = DATA_FILE.with_suffix(".json.tmp")
    temporary_file.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_file.replace(DATA_FILE)
    cleanup_old_backups()


def cleanup_old_backups():
    backups = sorted(BACKUP_DIR.glob("data-*.json"), reverse=True)
    for backup_file in backups[MAX_BACKUPS:]:
        backup_file.unlink(missing_ok=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8080), ValidadeHandler)
    print("ValidadeApp em http://0.0.0.0:8080")
    server.serve_forever()
