# -*- coding: utf-8 -*-
"""
Servidor local seguro para previsualizar el portal web de LMD (app.lmd2022.com)
"""
import os
import sys
import webbrowser
import http.server
import socketserver

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_PORTAL = os.path.join(BASE_DIR, "portal_web_lmd")

if not os.path.exists(DIR_PORTAL):
    DIR_PORTAL = os.path.join(os.path.dirname(BASE_DIR), "portal_web_lmd")

os.chdir(DIR_PORTAL)

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # Manejo elegante de POST en servidor de previsualización estático
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'{"success":true,"fallback":true,"message":"OK"}')

Handler = NoCacheHTTPRequestHandler

class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

PUERTOS = [3000, 5000, 5500, 8000, 8888, 9000, 9090]
servidor = None
puerto_activo = None

for p in PUERTOS:
    try:
        servidor = ThreadingServer(("", p), Handler)
        puerto_activo = p
        break
    except OSError:
        continue

if not servidor:
    print("[ERROR] No se pudo vincular a ningún puerto libre.")
    sys.exit(1)

url = f"http://localhost:{puerto_activo}"
print("=" * 65)
print(f"  PORTAL WEB LMD — VISTA PREVIA LOCAL ACTIVA")
print("=" * 65)
print(f"  Dirección local: {url}")
print(f"  Contraseña de acceso: Aristeo2026!")
print(f"  Presiona CTRL + C para detener el servidor.")
print("=" * 65)

webbrowser.open(url)

try:
    servidor.serve_forever()
except KeyboardInterrupt:
    print("\nServidor local detenido.")
    servidor.server_close()
