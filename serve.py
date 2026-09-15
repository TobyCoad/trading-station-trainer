"""Static dev server. Port comes from $PORT when a launcher assigns one, else 8391.

`python -m http.server` only takes a positional port, which is why this wrapper exists:
the Claude preview launcher sets PORT and expects the process to honour it.
"""
import http.server
import os
import pathlib
import socketserver

PORT = int(os.environ.get("PORT", "8391"))
ROOT = pathlib.Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # A PWA with a service worker; never let the dev server cache-pin stale assets.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("", PORT), Handler) as httpd:
        print(f"serving {ROOT} on http://localhost:{PORT}", flush=True)
        httpd.serve_forever()
