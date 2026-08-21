# -*- coding: utf-8 -*-
"""
=============================================================================
RADAR MONITOR DE CITAS DE VISADOS — CONSULADOS DE ESPAÑA (v1.0)
=============================================================================
Trámites Soportados:
  - LA HABANA: Visado Residencia Familiar de Español / Ciudadano UE (V5)

Novedades:
  - Perfil de navegador independiente (perfil_chrome_visados).
  - Alertas push instantáneas por Telegram específicas de Visados.
  - Radiografía Total Multi-Mes de disponibilidad.
  - Compatible para ejecutarse en paralelo con el Radar LMD.
=============================================================================
"""

import os
import sys
import io
import time
import json
import random
import urllib.parse
import winsound
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

# Módulos especializados de visados
from visados.habana_visado_fe import verificar_citas_habana_visado_fe, inyectar_cita_habana_visados
from gestor_red import obtener_ip_publica

# Salida UTF-8 nativa y segura para consola de Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ─────────────────────────────────────────────
# CONFIGURACIÓN GENERAL
# ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config_visados.json")
PERFIL_DIR  = os.path.join(BASE_DIR, "perfil_chrome_visados")


def log(msg):
    print(msg, flush=True)


def cargar_configuracion():
    """Carga la configuración desde config_visados.json."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as e:
            log(f"[CONFIG] Error al leer {CONFIG_FILE}: {e}")
    return {
        "TELEGRAM_BOT_TOKEN": "",
        "TELEGRAM_CHAT_ID": "",
        "PAUSA_MINIMA_SEGUNDOS": 45,
        "PAUSA_MAXIMA_SEGUNDOS": 80,
        "SONIDO_ALARMA": True,
        "TRAMITES_VISADOS": [
            {
                "consulado": "LA HABANA",
                "tramite": "Visado Familiar de Español / Ciudadano UE (V5)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/2686d3b68dc9e0db0ba3c6a20437e9cc7",
                "activo": True
            }
        ]
    }


def pausa_con_conteo_regresivo(segundos, mensaje_prefijo="⏳ [ENFRIAMIENTO] Próximo escaneo en"):
    """Muestra un contador regresivo animado segundo a segundo en la consola."""
    total = int(segundos)
    for restante in range(total, 0, -1):
        sys.stdout.write(f"\r{mensaje_prefijo}: {restante:02d}s (seguridad IP)... ")
        sys.stdout.flush()
        time.sleep(1)
    sys.stdout.write("\r" + " " * 85 + "\r")
    sys.stdout.flush()


def emitir_alarma_sonora():
    """Emite una secuencia de beeps de alta prioridad en Windows."""
    try:
        for _ in range(3):
            winsound.Beep(1400, 300)
            time.sleep(0.1)
            winsound.Beep(1900, 400)
            time.sleep(0.1)
    except Exception:
        pass


def enviar_alerta_telegram_visados(bot_token, chat_id, consulado, tramite, fecha_detectada, url_cita, info_slots=None):
    """Envía notificación push instantánea por Telegram para Visados."""
    if not bot_token or not chat_id:
        log("   [TELEGRAM] Token o Chat ID no configurados. Alerta no enviada a móvil.")
        return False

    try:
        texto = (
            f"🚨 *¡CITAS DISPONIBLES DE VISADOS DETECTADAS!*\n\n"
            f"🏛 *Consulado:* `{consulado}`\n"
            f"📋 *Trámite:* `{tramite}`\n"
            f"⏰ *Hora de Alerta:* `{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}`\n\n"
            f"📊 *DISPONIBILIDAD GENERAL POR MESES:*\n"
        )

        mapa_meses = info_slots.get("mapa_meses", {}) if isinstance(info_slots, dict) else {}
        if mapa_meses:
            for mes_nombre, datos in mapa_meses.items():
                dias_list = datos.get("dias", [])
                if dias_list:
                    dias_formateados = ", ".join(dias_list[:12])
                    texto += f"🗓️ *{mes_nombre} ({datos.get('total_dias', len(dias_list))} días):*\n"
                    texto += f"• *Días:* `{dias_formateados}`\n"
                else:
                    texto += f"🗓️ *{mes_nombre}:* `⏸️ Agenda cerrada aún`\n"
        else:
            texto += f"• *{fecha_detectada}*\n"

        franja = info_slots.get("franja_horaria") if isinstance(info_slots, dict) else ""
        if franja:
            texto += f"⏰ *Franja Horaria:* `{franja}`\n"

        texto += f"\n🔗 [Abrir Sistema de Citas Directo]({url_cita})"

        api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": texto,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False
        }

        resp = requests.post(api_url, json=payload, timeout=8)
        if resp.status_code == 200:
            log("   📱 [TELEGRAM] Alerta de Visados enviada en < 0.5s.")
            return True
        else:
            log(f"   [TELEGRAM] Error de API: HTTP {resp.status_code}")
    except Exception as e:
        log(f"   [TELEGRAM] Excepción al enviar alerta: {e}")

    return False


def main():
    config = cargar_configuracion()
    tramites_activos = [t for t in config.get("TRAMITES_VISADOS", []) if t.get("activo", True)]

    log("\n" + "=" * 65)
    log("  RADAR DE CITAS DE VISADOS — CONSULADOS DE ESPAÑA (v1.0)")
    log("=" * 65)
    log(f"  [TRÁMITES EN VIGILANCIA]:")
    for t in tramites_activos:
        log(f"   • {t['consulado']} — {t['tramite']}")
    log("=" * 65)
    log(f"[IP DE SALIDA ACTIVA]: {obtener_ip_publica()}")

    os.makedirs(PERFIL_DIR, exist_ok=True)
    log("[CHROME] Abriendo perfil de navegación dedicado a Visados...")

    ciclo = 1
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=PERFIL_DIR,
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        try:
            while True:
                log(f"\n─────────────────────────────────────────────────────────────────")
                log(f"CICLO VISADOS #{ciclo} — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
                log(f"─────────────────────────────────────────────────────────────────")

                for item in tramites_activos:
                    nombre_cons = item["consulado"].upper()
                    nombre_tramite = item["tramite"]

                    hay_citas, info_fechas, info_slots = verificar_citas_habana_visado_fe(page, config, log_fn=log)

                    if hay_citas:
                        if config.get("SONIDO_ALARMA"):
                            emitir_alarma_sonora()

                        # Alerta push por Telegram
                        enviar_alerta_telegram_visados(
                            config.get("TELEGRAM_BOT_TOKEN"),
                            config.get("TELEGRAM_CHAT_ID"),
                            nombre_cons,
                            nombre_tramite,
                            info_fechas,
                            item["url"],
                            info_slots
                        )

                        log(f"\n👉 [ACCIÓN REQUERIDA]: ¡Citas de Visado disponibles! Revisa la ventana y formaliza.")
                        time.sleep(120)

                    # Pausa estándar con Jitter aleatorio
                    p_min = config.get("PAUSA_MINIMA_SEGUNDOS", 45)
                    p_max = config.get("PAUSA_MAXIMA_SEGUNDOS", 80)
                    pausa = random.uniform(p_min, p_max)
                    pausa_con_conteo_regresivo(pausa)

                # Descanso extendido cada 15 ciclos
                if ciclo % 15 == 0:
                    pausa_larga = random.uniform(180, 240)
                    log(f"\n☕ [DESCANSO DE IP] Pausa de seguridad ({pausa_larga/60:.1f} min)...")
                    pausa_con_conteo_regresivo(pausa_larga, mensaje_prefijo="☕ [DESCANSO IP] Reanudando radar en")

                ciclo += 1

        except KeyboardInterrupt:
            log("\n[RADAR VISADOS DETENIDO] Operación finalizada.")
        finally:
            context.close()


if __name__ == "__main__":
    main()
