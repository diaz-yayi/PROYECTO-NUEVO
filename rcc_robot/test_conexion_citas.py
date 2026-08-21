# -*- coding: utf-8 -*-
"""
Test de Diagnóstico y Enlace de Extremo a Extremo:
1. Conexión con Google Workspace WebApp (CREDENCIALES_LMD).
2. Recuperación de candidatos prioritarios por Consulado.
3. Envío de Alerta Simulada a Telegram.
"""
import os
import sys
import io
import json
import urllib.parse
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config_citas.json")

with open(CONFIG_FILE, "r", encoding="utf-8") as f:
    config = json.load(f)

PALABRA_SECRETA = "Aristeo_Seguridad_2026_LMD!"
WEB_APP_URL     = "https://script.google.com/macros/s/AKfycbz7IrFci86-mzRwl1ty9KcI53P89kQ6Zh7NEyAxLlguqBL0fFdZuASX1e3Hmnars-eZgQ/exec"
BOT_TOKEN       = config.get("TELEGRAM_BOT_TOKEN")
CHAT_ID         = config.get("TELEGRAM_CHAT_ID")

print("=" * 65)
print("  TEST DE DIAGNÓSTICO Y ENLACE: RADAR <-> WORKSPACE <-> TELEGRAM")
print("=" * 65)

# Paso 1: Consultar candidatos en Google Workspace
print("\n[1/2] Consultando cola de candidatos en Google Workspace para 'SAN FRANCISCO'...")
url_api = f"{WEB_APP_URL}?accion=obtener_citas_candidatos&key={urllib.parse.quote(PALABRA_SECRETA)}&consulado=SAN%20FRANCISCO"

try:
    resp = requests.get(url_api, timeout=12)
    print(f"  -> Respuesta HTTP: {resp.status_code}")
    datos = resp.json()
    
    if datos.get("ok"):
        candidatos = datos.get("candidatos", [])
        total = datos.get("total", 0)
        print(f"  -> ✅ Conexión con Google Workspace EXITOSA.")
        print(f"  -> Total candidatos listos con credenciales para San Francisco: {total}")
        
        for idx, c in enumerate(candidatos[:3]):
            print(f"     [{idx+1}] ID: {c['identificador']} | Nombre: {c['nombreCompleto']} | Urgencia: {c.get('urgencia')} | Usuario: {c['usuarioConsular']}")
        
        # Paso 2: Enviar alerta de prueba a Telegram
        print("\n[2/2] Enviando alerta de prueba a Telegram con los datos vinculados...")
        primer_candidato = candidatos[0] if candidatos else {
            "identificador": "I_DEMO",
            "nombreCompleto": "Cliente Demostración",
            "urgencia": "1. ALTA / URGENTE",
            "usuarioConsular": "DEMO_SF_2026"
        }
        
        urg = primer_candidato.get('urgencia', '2. MEDIA / NORMAL')
        icono_urg = "🔴" if "1." in urg or "ALTA" in urg else ("🟡" if "2." in urg or "MEDIA" in urg else "🟢")
        
        texto_telegram = (
            f"🧪 *[SIMULACRO DE TEST]* 🚨\n"
            f"🏛 *Consulado:* `SAN FRANCISCO`\n"
            f"📅 *Disponibilidad Detectada:* `2 día(s) con cupos libres`\n\n"
            f"👤 *Cliente Prioritario Asignable (Nube):*\n"
            f"• *ID:* `{primer_candidato.get('identificador', '')}`\n"
            f"• *Nombre:* `{primer_candidato.get('nombreCompleto', '')}`\n"
            f"• *Prioridad:* {icono_urg} `{urg}`\n"
            f"• *Usuario Consular:* `{primer_candidato.get('usuarioConsular', '')}`\n\n"
            f"🔗 [Abrir Sistema de Citas Directo](https://www.citaconsular.es/es/hosteds/widgetdefault/2d7c60f44f450863fb149b64fdd4b74a1/#services)"
        )
        
        api_telegram = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        resp_tg = requests.post(api_telegram, json={
            "chat_id": CHAT_ID,
            "text": texto_telegram,
            "parse_mode": "Markdown"
        }, timeout=8)
        
        if resp_tg.status_code == 200:
            print("  -> 📱 ✅ ¡Alerta enviada a tu Telegram con éxito en < 0.5s!")
        else:
            print(f"  -> [!] Error en Telegram: {resp_tg.status_code} - {resp_tg.text}")
    else:
        print(f"  -> [!] Error devuelto por Workspace: {datos.get('error')}")

except Exception as e:
    print(f"  -> [!] Error de conexión: {e}")

print("\n" + "=" * 65)
print("  FIN DEL TEST DE ENLACE")
print("=" * 65)
