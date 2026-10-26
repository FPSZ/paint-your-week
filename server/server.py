#!/usr/bin/env python3
"""涂色周历 tenant store.

A tiny JSON document API that sits behind nginx and listens on 127.0.0.1 only.
Each username is a tenant; there is no password, so a tenant is a namespace,
not a secret. Abuse limits live here as a second layer behind nginx's
per-IP rate and connection limits.

  GET  /week/api/ping
  GET  /week/api/doc/<user>/<key>     -> 200 {"data": {...}} | 404
  PUT  /week/api/doc/<user>/<key>     body: {...,"updatedAt": <ms>}
                                       -> 200 | 409 {"data": newer} | 413 | 429 | 507
"""
import json
import os
import re
import sqlite3
import threading
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

DB_PATH = os.environ.get("TUSE_DB", "/var/lib/tuse-week/data.db")
PORT = int(os.environ.get("TUSE_PORT", "18731"))

MAX_BODY = 256 * 1024                 # one week of blocks is ~10-30 KB
MAX_DOCS_PER_USER = 600               # core + ~11 years of weeks
MAX_NEW_USERS_PER_IP_PER_DAY = 10     # stops one client minting tenants to fill the disk
MAX_DB_BYTES = 512 * 1024 * 1024      # refuse new documents beyond this
MAX_INFLIGHT = 24                     # concurrent requests handled at once; the rest get 503

USER_RE = re.compile(r"^[0-9a-z_\-.一-鿿]{1,24}$")
KEY_RE = re.compile(r"^(core|w\d{4}-\d{2}-\d{2})$")
PREFIX = "/week/api/"

lock = threading.Lock()
inflight = threading.BoundedSemaphore(MAX_INFLIGHT)
conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA synchronous=NORMAL")
conn.execute("CREATE TABLE IF NOT EXISTS docs (user TEXT NOT NULL, k TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user, k))")
conn.execute("CREATE TABLE IF NOT EXISTS users (user TEXT PRIMARY KEY, created INTEGER NOT NULL, ip TEXT)")
conn.execute("CREATE INDEX IF NOT EXISTS users_ip ON users (ip, created)")


def norm_user(raw):
    user = unicodedata.normalize("NFC", unquote(raw)).strip().lower()
    return user if USER_RE.match(user) else None


def db_bytes():
    total = 0
    for suffix in ("", "-wal"):
        try:
            total += os.path.getsize(DB_PATH + suffix)
        except OSError:
            pass
    return total


def put_doc(user, key, doc, ip):
    """Returns (status, payload_bytes)."""
    updated = int(doc["updatedAt"])
    data = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    now = int(time.time())
    with lock:
        row = conn.execute("SELECT updated, data FROM docs WHERE user=? AND k=?", (user, key)).fetchone()
        if row and row[0] > updated:
            return 409, ('{"data":' + row[1] + "}").encode()
        if not row:
            if db_bytes() > MAX_DB_BYTES:
                return 507, b'{"error":"storage_full"}'
            known = conn.execute("SELECT 1 FROM users WHERE user=?", (user,)).fetchone()
            if not known:
                recent = conn.execute("SELECT COUNT(*) FROM users WHERE ip=? AND created>?", (ip, now - 86400)).fetchone()[0]
                if recent >= MAX_NEW_USERS_PER_IP_PER_DAY:
                    return 429, b'{"error":"too_many_users"}'
                conn.execute("INSERT INTO users (user, created, ip) VALUES (?, ?, ?)", (user, now, ip))
            count = conn.execute("SELECT COUNT(*) FROM docs WHERE user=?", (user,)).fetchone()[0]
            if count >= MAX_DOCS_PER_USER:
                return 507, b'{"error":"too_many_docs"}'
        conn.execute(
            "INSERT INTO docs (user, k, data, updated) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (user, k) DO UPDATE SET data=excluded.data, updated=excluded.updated",
            (user, key, data, updated),
        )
    return 200, b'{"ok":true}'


class Handler(BaseHTTPRequestHandler):
    server_version = "tuse"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    timeout = 10  # seconds a slow client may hold a worker

    def log_message(self, fmt, *args):
        pass

    def reply(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(payload)
        self.close_connection = True

    def guarded(self, method):
        if not inflight.acquire(blocking=False):
            return self.reply(503, b'{"error":"busy"}')
        try:
            self.route(method)
        except Exception:
            try:
                self.reply(500, b'{"error":"server"}')
            except Exception:
                pass
        finally:
            inflight.release()

    def do_GET(self):
        self.guarded("GET")

    def do_PUT(self):
        self.guarded("PUT")

    def route(self, method):
        path = self.path.split("?", 1)[0]
        if not path.startswith(PREFIX):
            return self.reply(404, b'{"error":"not_found"}')
        seg = path[len(PREFIX):].split("/")
        if seg == ["ping"] and method == "GET":
            return self.reply(200, b'{"ok":true}')
        if len(seg) != 3 or seg[0] != "doc":
            return self.reply(404, b'{"error":"not_found"}')
        user, key = norm_user(seg[1]), seg[2]
        if not user or not KEY_RE.match(key):
            return self.reply(400, b'{"error":"bad_name"}')

        if method == "GET":
            with lock:
                row = conn.execute("SELECT data FROM docs WHERE user=? AND k=?", (user, key)).fetchone()
            if not row:
                return self.reply(404, b'{"error":"not_found"}')
            return self.reply(200, ('{"data":' + row[0] + "}").encode())

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, b'{"error":"too_large"}')
        try:
            doc = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return self.reply(400, b'{"error":"bad_json"}')
        if not isinstance(doc, dict) or not isinstance(doc.get("updatedAt"), (int, float)) or isinstance(doc.get("updatedAt"), bool):
            return self.reply(400, b'{"error":"bad_doc"}')
        ip = self.headers.get("X-Real-IP") or self.client_address[0]
        status, payload = put_doc(user, key, doc, ip)
        return self.reply(status, payload)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64


if __name__ == "__main__":
    Server(("127.0.0.1", PORT), Handler).serve_forever()
