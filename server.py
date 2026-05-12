#!/usr/bin/env python3
"""Static file server + tiny user-account API for the racing game.
Accounts are stored in users.json so they're shared across all origins
(localhost AND tunneled URLs)."""

import http.server
import socketserver
import json
import os
import sys
from pathlib import Path

PORT = 7777
ROOT = Path(__file__).parent
USERS_FILE = ROOT / 'users.json'

def load_users():
    if not USERS_FILE.exists():
        return {}
    try:
        return json.loads(USERS_FILE.read_text())
    except Exception:
        return {}

def save_users(users):
    USERS_FILE.write_text(json.dumps(users, indent=2))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS so the API works from any origin (loca.lt tunnels too)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Don't cache HTML/JS so dev edits show up immediately. GLBs and
        # other heavy static assets get long-lived caching — they're
        # content-addressable (filename changes when the model changes),
        # and forcing re-download on every click made the car-select
        # screen feel slow on LAN.
        if self.path.endswith(('.html', '.js')) or '?v=' in self.path:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        elif self.path.endswith(('.glb', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.ogg', '.wav')):
            self.send_header('Cache-Control', 'public, max-age=86400')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/users':
            self._send_json(200, load_users())
            return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/users':
            length = int(self.headers.get('Content-Length', 0))
            try:
                body = json.loads(self.rfile.read(length))
                save_users(body)
                self._send_json(200, {'ok': True})
            except Exception as e:
                self._send_json(400, {'error': str(e)})
            return
        self.send_error(404)

    def _send_json(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # Quieter logs — only log API hits or errors
        msg = ' '.join(str(a) for a in args)
        if '/api/' in msg or any(code in msg for code in ('404', '500')):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    os.chdir(ROOT)
    # ThreadingHTTPServer handles requests in parallel — single-threaded
    # serving gets stuck when a request stalls (e.g. a long-poll or hung
    # browser keepalive), and that breaks every other request.
    server = http.server.ThreadingHTTPServer(('', PORT), Handler)
    server.daemon_threads = True
    print(f'Serving from {ROOT} on port {PORT}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
