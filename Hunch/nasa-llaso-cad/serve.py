import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

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

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)
    bind = os.environ.get('HUNCH_SIM_BIND', '0.0.0.0')
    server = ThreadingHTTPServer((bind, port), ReliableHandler)
    print(f"NASA CAD Simulation Server online at http://127.0.0.1:{port}/launcher.html")
    print(f"  (also /viewer.html, /rover_solo.html — no /Hunch/nasa-llaso-cad/ prefix needed)")
    print(f"  Autopilot sim: http://127.0.0.1:{port}/viewer.html")
    print(f"  Bind: {bind}")
    print(f"Serving files from: {root}")
    server.serve_forever()
