import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer

class ReliableHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Cloud previews and README links often include the repo path prefix; the server
    # document root is already this directory, so strip the prefix to avoid 404s.
    _PATH_PREFIXES = (
        '/Hunch/nasa-llaso-cad',
        '/hunch/nasa-llaso-cad',
    )

    def translate_path(self, path):
        bare = path.split('?', 1)[0].split('#', 1)[0]
        for prefix in self._PATH_PREFIXES:
            if bare == prefix or bare.startswith(prefix + '/'):
                path = path.replace(bare, bare[len(prefix):] or '/', 1)
                break
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        try:
            sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format%args))
            sys.stderr.flush()
        except Exception:
            pass

    def do_POST(self):
        if self.path == '/api/mesh_export':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 50_000_000:
                self.send_error(413, "Payload too large")
                return
            import json
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON")
                return
            rel = payload.get('path', '')
            body = payload.get('body', '')
            if not rel or '..' in rel or rel.startswith('/'):
                self.send_error(400, "Bad path")
                return
            root = os.path.dirname(os.path.abspath(__file__))
            dest = os.path.normpath(os.path.join(root, rel))
            if not dest.startswith(root):
                self.send_error(400, "Bad path")
                return
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'w', encoding='utf-8') as f:
                f.write(body)
            resp = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(resp)
            return
        if self.path == '/api/log' or self.path == '/api/navstudy':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 200000:
                self.send_error(413, "Payload too large")
                return
            post_data = self.rfile.read(content_length)
            msg = post_data.decode('utf-8', errors='ignore').replace('\n', ' ').strip()
            name = 'nav_study.jsonl' if self.path == '/api/navstudy' else 'rover_actions.log'
            with open(name, 'a') as f:
                f.write(msg + '\n')
            resp = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp)))
            self.send_header('Connection', 'close')
            self.end_headers()
            self.wfile.write(resp)
            return
        self.send_error(404, "Endpoint not found")

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            port = self.server.server_address[1]
            body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=http://127.0.0.1:{port}/launcher.html"/>
<title>NASA HUNCH sim — wrong URL</title></head>
<body style="font-family:system-ui,sans-serif;background:#07080d;color:#e2e8f0;padding:2rem">
<h1>Sim URL needs port <code>{port}</code></h1>
<p><code>http://127.0.0.1</code> alone uses port 80 and is not the sim.</p>
<p>Open the launch pad: <a href="http://127.0.0.1:{port}/launcher.html">http://127.0.0.1:{port}/launcher.html</a></p>
<p>Start server: <code>cd Hunch/nasa-llaso-cad && ./start_sim.sh</code></p>
</body></html>"""
            encoded = body.encode("utf-8")
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        super().send_error(code, message, explain)


def _start_redirect_server(redirect_port: int, main_port: int) -> None:
    class RedirectHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = self.path.split("?", 1)[0] or "/"
            if path in ("/", ""):
                loc = f"http://127.0.0.1:{main_port}/launcher.html"
            else:
                loc = f"http://127.0.0.1:{main_port}{self.path}"
            self.send_response(302)
            self.send_header("Location", loc)
            self.end_headers()

        def log_message(self, format, *args):
            pass

    try:
        redirect = ThreadingHTTPServer(("0.0.0.0", redirect_port), RedirectHandler)
    except OSError as err:
        sys.stderr.write(f"Port {redirect_port} redirect skipped ({err})\n")
        return

    def run():
        redirect.serve_forever()

    threading.Thread(target=run, daemon=True).start()
    sys.stderr.write(
        f"Redirect http://127.0.0.1:{redirect_port}/ → http://127.0.0.1:{main_port}/launcher.html\n"
    )


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)
    bind = os.environ.get('HUNCH_SIM_BIND', '0.0.0.0')
    redirect_port = os.environ.get('HUNCH_SIM_REDIRECT_PORT', '')
    if redirect_port:
        try:
            _start_redirect_server(int(redirect_port), port)
        except ValueError:
            pass
    server = ThreadingHTTPServer((bind, port), ReliableHandler)
    print(f"NASA CAD Simulation Server online at http://127.0.0.1:{port}/launcher.html")
    print(f"  Do not use bare http://127.0.0.1 — always include :{port}")
    print(f"  (also /viewer.html, /rover_solo.html — no /Hunch/nasa-llaso-cad/ prefix needed)")
    print(f"  Autopilot sim: http://127.0.0.1:{port}/viewer.html")
    print(f"  Bind: {bind}")
    print(f"Serving files from: {root}")
    server.serve_forever()
