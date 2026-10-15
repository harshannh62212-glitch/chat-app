#!/usr/bin/env python3
"""Open only the updated AEGIS-V1 3D rover.

Does not use port 8002. That port on the M1 Air is often a different
Python server, which is why /rover_solo.html returns "File not found".

Run from anywhere:
    python3 /Users/nhharshan/Hunch/open_rover.py
Or double-click Open-Rover.command in Finder.
"""
import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

def cad_root():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "Hunch", "nasa-llaso-cad"),
        os.path.join(here, "nasa-llaso-cad"),
        here,
    ]
    for path in candidates:
        if os.path.isfile(os.path.join(path, "rover_solo.html")) and os.path.isfile(
            os.path.join(path, "js", "fusion_rover.js")
        ):
            return path
    sys.exit("Could not find rover_solo.html next to this script.")

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

def main():
    root = cad_root()
    os.chdir(root)
    preferred = int(os.environ.get("HUNCH_ROVER_PORT", "8012"))
    server = None
    port = None
    for port in range(preferred, preferred + 8):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), QuietHandler)
            break
        except OSError:
            server = None
    if server is None:
        sys.exit("No free port from %s to %s" % (preferred, preferred + 7))
    url = "http://127.0.0.1:%s/rover_solo.html" % port
    print("AEGIS-V1 3D rover only")
    print("  folder:", root)
    print("  open:  ", url)
    threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")

if __name__ == "__main__":
    main()
