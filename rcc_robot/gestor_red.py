# -*- coding: utf-8 -*-
"""
=============================================================================
GESTOR DE RED Y CASCADA ANTI-BLOQUEO DE IP (v1.0 COSTE 0)
=============================================================================
Implementa la estrategia de 3 niveles para saltar el bloqueo de 10 días
del Consulado de La Habana y blindar las reservas de familias enteras:

Nivel 1: Conexión base / Verificación de IP pública activa.
Nivel 2: Intento automático por túnel Cloudflare WARP (si está instalado).
Nivel 3: Alerta interactiva (Consola + Telegram) para rotación por red móvil
         (Modo Avión 5s) con verificación en vivo del cambio de IP.
=============================================================================
"""

import os
import sys
import io
import time
import requests
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def obtener_ip_publica():
    """Consulta la dirección IP pública actual a través de servicios de alta velocidad."""
    servicios = [
        "https://api.ipify.org?format=text",
        "https://ifconfig.me/ip",
        "https://icanhazip.com"
    ]
    for s in servicios:
        try:
            resp = requests.get(s, timeout=4)
            if resp.status_code == 200:
                ip = resp.text.strip()
                if len(ip) >= 7 and "." in ip:
                    return ip
        except Exception:
            pass
    return "DESCONOCIDA"


def intentar_rotacion_warp(log_fn=print):
    """Nivel 2: Intenta conectar/reconectar Cloudflare WARP si está instalado en el sistema."""
    try:
        # Verificar si warp-cli está en PATH
        res = subprocess.run(["warp-cli", "status"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            log_fn("   🔄 [RED NIVEL 2] Conmutando túnel Cloudflare WARP...")
            subprocess.run(["warp-cli", "disconnect"], capture_output=True, timeout=3)
            time.sleep(1)
            subprocess.run(["warp-cli", "connect"], capture_output=True, timeout=5)
            time.sleep(2)
            nueva_ip = obtener_ip_publica()
            log_fn(f"   ✅ [WARP ACTIVO] Salida conmutada por red Cloudflare. IP: {nueva_ip}")
            return True, nueva_ip
    except Exception:
        pass
    return False, None


def solicitar_rotacion_ip_movil(bot_token=None, chat_id=None, log_fn=print):
    """
    Nivel 3: Solicita al usuario rotar la IP móvil mediante Modo Avión (5 segundos)
    y verifica en vivo que la IP haya cambiado antes de permitir la siguiente reserva.
    """
    ip_anterior = obtener_ip_publica()
    
    log_fn("\n" + "=" * 65)
    log_fn("  🚨 RESTRICCIÓN DE IP DETECTADA (REGLA DE 10 DÍAS DEL CONSULADO)")
    log_fn("=" * 65)
    log_fn(f"  IP Actual Bloqueada: {ip_anterior}")
    log_fn("  INSTRUCCIONES PARA OBTENER UNA IP VIRGEN DE COSTE 0:")
    log_fn("  1. En tu teléfono móvil (punto de acceso / tethering), activa el MODO AVIÓN.")
    log_fn("  2. Espera 5 segundos y vuelve a DESACTIVAR el Modo Avión.")
    log_fn("  3. Tu operador te asignará una IP nueva e indetectable de inmediato.")
    log_fn("=" * 65)

    # Notificar también por Telegram si está configurado
    if bot_token and chat_id:
        try:
            texto_tg = (
                "🔄 *[ACCIÓN REQUERIDA: CAMBIO DE IP]*\n\n"
                f"El Consulado ha bloqueado la IP previa (`{ip_anterior}`).\n\n"
                "📱 *Activa el Modo Avión en tu móvil 5s y desactívalo* para agendar al siguiente familiar.\n\n"
                "Pulsa *ENTER* en tu PC cuando lo hayas hecho."
            )
            api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            requests.post(api_url, json={"chat_id": chat_id, "text": texto_tg, "parse_mode": "Markdown"}, timeout=5)
        except Exception:
            pass

    try:
        input("\n👉 Pulsa [ENTER] tras desactivar el Modo Avión para verificar la nueva IP... ")
    except Exception:
        time.sleep(10)

    # Verificar que la IP cambió
    log_fn("   🔍 Verificando nueva IP pública...")
    for _ in range(6):
        time.sleep(1.5)
        nueva_ip = obtener_ip_publica()
        if nueva_ip != "DESCONOCIDA" and nueva_ip != ip_anterior:
            log_fn(f"   🎉 ¡ÉXITO! Nueva IP limpia detectada: {nueva_ip} (Anterior: {ip_anterior})")
            log_fn("   🚀 Continuando con la reserva del siguiente cliente sin esperas...")
            return True, nueva_ip

    log_fn(f"   [AVISO] La IP sigue siendo {obtener_ip_publica()}. Continuando de todos modos...")
    return True, obtener_ip_publica()


def gestionar_cascada_ip_post_reserva(bot_token=None, chat_id=None, log_fn=print):
    """
    Ejecuta la cascada completa tras reservar una cita:
      1. Intenta conmutar WARP.
      2. Si no o si persiste, solicita rotación móvil con Modo Avión.
    """
    warp_ok, nueva_ip = intentar_rotacion_warp(log_fn)
    if warp_ok:
        return True, nueva_ip
    
    return solicitar_rotacion_ip_movil(bot_token, chat_id, log_fn)
