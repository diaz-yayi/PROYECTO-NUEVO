# -*- coding: utf-8 -*-
"""
=============================================================================
RADAR MONITOR DE CITAS LMD - CONSULADOS DE ESPAÑA (v8.0 MULTI-SEDES TOTAL)
=============================================================================
Sedes Soportadas:
  - SAN FRANCISCO (LMD)
  - LA HABANA (LMD)
  - MIAMI (LMD)
  - LOS ÁNGELES (LMD)
  - TODOS LOS CONSULADOS (Rotación Automática Continua)

Novedades v8.0:
  - Integración completa del Consulado General de España en LOS ÁNGELES.
  - Reporte Ejecutivo Estructurado por Bloques Mensuales (Septiembre, Octubre, etc.).
  - Desglose Limpio de Días y Horarios por Mes en Consola y Telegram.
  - Clasificación Transparente de Candidatos:
      🟢 CLIENTES COMPATIBLES (Aptos para los meses abiertos).
      ⏸️ CLIENTES EN ESPERA (Explicando qué meses están abiertos vs qué pidió).
  - Selector Asistido de 1 Tecla con Asignación e Inyección Instantánea.
  - Filtrado Estricto por Sede Consular.
  - Motor Universal de Preferencias Multirango.
  - Cascada Anti-Bloqueo de IP de 3 Niveles (Gasto 0).
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

# Módulos especializados de consulados
from consulados.san_francisco_lmd import verificar_citas_san_francisco, inyectar_cita_san_francisco
from consulados.habana_lmd import verificar_citas_habana, inyectar_cita_habana
from consulados.miami_lmd import verificar_citas_miami, inyectar_cita_miami
from consulados.los_angeles_lmd import verificar_citas_los_angeles, inyectar_cita_los_angeles

# Motores centrales
from motor_preferencias import clasificar_candidatos_con_mapa_citas
from gestor_red import gestionar_cascada_ip_post_reserva, obtener_ip_publica

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
CONFIG_FILE = os.path.join(BASE_DIR, "config_citas.json")
PERFIL_DIR  = os.path.join(BASE_DIR, "perfil_chrome_citas")

PALABRA_SECRETA = "Aristeo_Seguridad_2026_LMD!"
WEB_APP_URL     = "https://script.google.com/macros/s/AKfycbz7IrFci86-mzRwl1ty9KcI53P89kQ6Zh7NEyAxLlguqBL0fFdZuASX1e3Hmnars-eZgQ/exec"


def log(msg):
    print(msg, flush=True)


def cargar_configuracion():
    """Carga la configuración desde config_citas.json."""
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
        "CONSULADOS_LMD": [
            {
                "nombre": "SAN FRANCISCO",
                "tramite": "Ley de Memoria Democrática (LMD)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/2d7c60f44f450863fb149b64fdd4b74a1/#services",
                "activo": True
            },
            {
                "nombre": "LA HABANA",
                "tramite": "Ley de Memoria Democrática (LMD)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/28330379fc95acafd31ee9e8938c278ff",
                "activo": True
            },
            {
                "nombre": "MIAMI",
                "tramite": "Ley de Memoria Democrática (LMD)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/2533f04b1d3e818b66f175afc9c24cf63",
                "activo": True
            },
            {
                "nombre": "LOS ANGELES",
                "tramite": "Ley de Memoria Democrática (LMD)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/2244a1a71808fe950abb503cd46c2e517",
                "activo": True
            }
        ]
    }


# ─────────────────────────────────────────────
# TEMPORIZADOR VISUAL (CONTEO REGRESIVO ANIMADO)
# ─────────────────────────────────────────────
def pausa_con_conteo_regresivo(segundos, mensaje_prefijo="⏳ [ENFRIAMIENTO] Próximo escaneo en"):
    """Muestra un contador regresivo animado segundo a segundo en la consola."""
    total = int(segundos)
    for restante in range(total, 0, -1):
        sys.stdout.write(f"\r{mensaje_prefijo}: {restante:02d}s (seguridad IP)... ")
        sys.stdout.flush()
        time.sleep(1)
    sys.stdout.write("\r" + " " * 85 + "\r")
    sys.stdout.flush()


# ─────────────────────────────────────────────
# SISTEMA DE ALERTAS (TELEGRAM + SONIDO)
# ─────────────────────────────────────────────
def emitir_alarma_sonora():
    """Emite una secuencia de beeps de alta prioridad en Windows."""
    try:
        for _ in range(3):
            winsound.Beep(1200, 300)
            time.sleep(0.1)
            winsound.Beep(1800, 400)
            time.sleep(0.1)
    except Exception:
        pass


def enviar_alerta_telegram(bot_token, chat_id, consulado, fecha_detectada, url_cita, compatibles=None, en_espera=None, info_slots=None):
    """Envía notificación push instantánea por Telegram con desglose estructurado por meses."""
    if not bot_token or not chat_id:
        log("   [TELEGRAM] Token o Chat ID no configurados. Alerta no enviada a móvil.")
        return False

    try:
        texto = (
            f"🚨 *¡CITAS DISPONIBLES LMD DETECTADAS!*\n\n"
            f"🏛 *Consulado:* `{consulado}`\n"
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

        if compatibles:
            texto += "\n🟢 *Clientes Compatibles con esta Apertura:*\n"
            for item in compatibles[:4]:
                c = item["candidato"]
                urg = c.get("urgencia", "2. MEDIA / NORMAL")
                icono = "🔴" if "1." in urg or "ALTA" in urg else ("🟡" if "2." in urg or "MEDIA" in urg else "🟢")
                texto += f"• {icono} `{c['nombreCompleto']}` (`{c['identificador']}`) ➔ _{item['motivo']}_\n"

        if en_espera:
            texto += "\n⏸️ *Clientes en Espera de Futura Apertura:*\n"
            for item in en_espera[:3]:
                c = item["candidato"]
                texto += f"• `{c['nombreCompleto']}` ➔ _{item['motivo']}_\n"

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
            log("   📱 [TELEGRAM] Alerta ejecutiva enviada en < 0.5s.")
            return True
        else:
            log(f"   [TELEGRAM] Error de API: HTTP {resp.status_code}")
    except Exception as e:
        log(f"   [TELEGRAM] Excepción al enviar alerta: {e}")

    return False


# ─────────────────────────────────────────────
# CONEXIÓN CON GOOGLE WORKSPACE
# ─────────────────────────────────────────────
def obtener_candidatos_workspace(consulado):
    """Consulta la cola prioritaria de candidatos en Google Workspace filtrados estrictamente por Consulado."""
    try:
        url = (
            f"{WEB_APP_URL}?accion=obtener_citas_candidatos"
            f"&key={urllib.parse.quote(PALABRA_SECRETA)}"
            f"&consulado={urllib.parse.quote(consulado)}"
        )
        resp = requests.get(url, timeout=12)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                return data.get("candidatos", [])
    except Exception as e:
        log(f"   [WORKSPACE] Error al consultar candidatos: {e}")
    return []


def registrar_cita_en_workspace(datos_cita):
    """Registra y sincroniza la cita asignada en EXPEDIENTES LMD y CREDENCIALES_LMD."""
    try:
        payload = {
            "accion": "guardar_cita_capturada",
            "key": PALABRA_SECRETA,
            "identificador": datos_cita.get("identificador"),
            "nombreCompleto": datos_cita.get("nombreCompleto"),
            "consulado": datos_cita.get("consulado"),
            "fechaCita": datos_cita.get("fechaCita"),
            "detalle": datos_cita.get("detalle", "Asignado por Radar LMD")
        }
        resp = requests.post(WEB_APP_URL, json=payload, timeout=12)
        if resp.status_code == 200:
            log("   ☁️ [WORKSPACE] Cita sincronizada en ambas hojas con éxito.")
            return True
    except Exception as e:
        log(f"   [WORKSPACE] Error al guardar cita: {e}")
    return False


# ─────────────────────────────────────────────
# SELECTOR ASISTIDO DE 1 TECLA (V8.0 EJECUTIVO)
# ─────────────────────────────────────────────
def ejecutar_selector_asistido(page, nombre_consulado, candidatos, info_slots, config):
    """
    Despliega en consola el selector asistido de 1 tecla con el desglose estructurado
    por meses, días y horarios y la clasificación transparente de candidatos.
    """
    log("\n" + "=" * 65)
    log(f"  🎮 SELECTOR ASISTIDO DE CITAS: {nombre_consulado}")
    log("=" * 65)
    
    # 1. Desglose Estructurado por Meses
    log("  📊 DISPONIBILIDAD GENERAL ESTRUCTURADA POR MESES:")
    mapa_meses = info_slots.get("mapa_meses", {}) if isinstance(info_slots, dict) else {}
    if mapa_meses:
        for mes_nombre, datos in mapa_meses.items():
            dias_list = datos.get("dias", [])
            if dias_list:
                log(f"     🗓️ {mes_nombre} ({datos.get('total_dias', len(dias_list))} días habilitados):")
                log(f"        • Días abiertos: {', '.join(dias_list)}")
            else:
                log(f"     🗓️ {mes_nombre}: ⏸️ Agenda cerrada aún por el Consulado")
    else:
        log(f"     • {info_slots.get('fecha_texto', '')} ({info_slots.get('total_slots', 0)} huecos)")
    
    franja = info_slots.get("franja_horaria", "")
    if franja:
        log(f"     ⏰ Franja Horaria de la vista actual: {franja}")
    log("=" * 65)

    if not candidatos:
        log("  [!] No hay clientes con credenciales registradas para este consulado.")
        return False

    slots_lista = info_slots.get("slots_detalle", [])
    if not slots_lista:
        slots_lista = [{"texto": h, "index": idx, "href": ""} for idx, h in enumerate(info_slots.get("horas", []))]

    # 2. Clasificar candidatos
    compatibles, en_espera = clasificar_candidatos_con_mapa_citas(candidatos, info_slots)

    # 3. Mostrar compatibles
    log("\n  🟢 CLIENTES COMPATIBLES CON ESTA APERTURA:")
    if compatibles:
        for idx, item in enumerate(compatibles[:6]):
            c = item["candidato"]
            urg = c.get("urgencia", "2. MEDIA / NORMAL")
            icono = "🔴" if "1." in urg or "ALTA" in urg else ("🟡" if "2." in urg or "MEDIA" in urg else "🟢")
            log(f"     [{idx+1}] {c['nombreCompleto']} ({c['identificador']}) | {icono} {urg} ➔ ✅ {item['motivo']}")
    else:
        log("     (Ningún cliente tiene preferencia coincidente con los meses abiertos)")

    # 4. Mostrar clientes en espera
    if en_espera:
        log("\n  ⏸️ CLIENTES EN ESPERA DE FUTURA APERTURA:")
        for idx, item in enumerate(en_espera[:4]):
            c = item["candidato"]
            num_ref = len(compatibles) + idx + 1
            log(f"     [{num_ref}] {c['nombreCompleto']} ({c['identificador']}) ➔ ❌ {item['motivo']}")

    # 5. Mostrar huecos horarios
    log(f"\n  ⏰ HUECOS HORARIOS DE LA VISTA ACTUAL:")
    letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for idx, s in enumerate(slots_lista[:8]):
        letra = letras[idx] if idx < len(letras) else str(idx+1)
        log(f"     [{letra}] {s['texto']}")

    # 6. Sugerencia óptima
    cand_sugerido = compatibles[0]["candidato"] if compatibles else candidatos[0]
    slot_sugerido = compatibles[0]["slot"] if compatibles else slots_lista[0]
    motivo_sug = compatibles[0]["motivo"] if compatibles else "Candidato prioritario #1"

    log(f"\n  👉 SUGERENCIA AUTOMÁTICA: Asignar Cliente [1] ({cand_sugerido['nombreCompleto']}) con Hueco [A] ({slot_sugerido['texto']})")
    log(f"     Motivo: _{motivo_sug}_")
    log("=" * 65)

    try:
        eleccion = input("  Introduce [Cliente, Hueco] o pulsa [ENTER] para auto-asignar (o 'S' para saltar): ").strip().upper()
    except Exception:
        eleccion = ""

    if eleccion == "S":
        log("  [SELECTOR] Asignación saltada por el operador.")
        return False

    c_final = cand_sugerido
    s_final = slot_sugerido

    todos_candidatos_ordenados = [item["candidato"] for item in compatibles] + [item["candidato"] for item in en_espera]
    if not todos_candidatos_ordenados:
        todos_candidatos_ordenados = candidatos

    if eleccion and "," in eleccion:
        partes = [p.strip() for p in eleccion.split(",")]
        try:
            num_c = int(partes[0])
            if 1 <= num_c <= len(todos_candidatos_ordenados):
                c_final = todos_candidatos_ordenados[num_c - 1]
            
            letra_s = partes[1].upper()
            if letra_s in letras:
                idx_s = letras.index(letra_s)
                if idx_s < len(slots_lista):
                    s_final = slots_lista[idx_s]
        except Exception as e:
            log(f"  [SELECTOR] Entrada ({e}), aplicando sugerencia óptima.")

    # Inyección en el navegador
    log(f"\n🚀 [EJECUTANDO INYECCIÓN]: Asignando a {c_final['nombreCompleto']} en el hueco '{s_final['texto']}'...")
    
    exito = False
    if "HABANA" in nombre_consulado:
        exito = inyectar_cita_habana(page, s_final, c_final, log_fn=log)
    elif "MIAMI" in nombre_consulado:
        exito = inyectar_cita_miami(page, s_final, c_final, log_fn=log)
    elif "LOS ANGELES" in nombre_consulado or "ÁNGELES" in nombre_consulado:
        exito = inyectar_cita_los_angeles(page, s_final, c_final, log_fn=log)
    elif "SAN FRANCISCO" in nombre_consulado:
        exito = inyectar_cita_san_francisco(page, s_final, c_final, log_fn=log)

    if exito:
        fecha_cita_str = f"{info_slots.get('fecha_texto', '')} {s_final.get('texto', '')}".strip()
        registrar_cita_en_workspace({
            "identificador": c_final.get("identificador"),
            "nombreCompleto": c_final.get("nombreCompleto"),
            "consulado": nombre_consulado,
            "fechaCita": fecha_cita_str,
            "detalle": f"Asignada en hueco {s_final.get('texto', '')}"
        })

        if "HABANA" in nombre_consulado:
            gestionar_cascada_ip_post_reserva(
                bot_token=config.get("TELEGRAM_BOT_TOKEN"),
                chat_id=config.get("TELEGRAM_CHAT_ID"),
                log_fn=log
            )

    return exito


# ─────────────────────────────────────────────
# MENÚ INTERACTIVO COMPLETO
# ─────────────────────────────────────────────
def mostrar_menu_interactivo():
    log("\n" + "=" * 65)
    log("  RADAR DE CITAS CONSULARES LMD — ESPAÑA (v8.0 MULTI-SEDES TOTAL)")
    log("=" * 65)
    log("  SELECCIONA EL CONSULADO A VIGILAR:\n")
    log("  [1] SAN FRANCISCO (LMD)")
    log("  [2] LA HABANA (LMD)")
    log("  [3] MIAMI (LMD)")
    log("  [4] LOS ÁNGELES (LMD)")
    log("  [5] TODOS LOS CONSULADOS (Rotación Automática Continua)")
    log("=" * 65)

    try:
        op_cons = input("  Introduce tu opción de consulado [1, 2, 3, 4 o 5] (Por defecto: 1): ").strip()
    except Exception:
        op_cons = "1"

    if op_cons == "2":
        consulados_elegidos = ["LA HABANA"]
    elif op_cons == "3":
        consulados_elegidos = ["MIAMI"]
    elif op_cons == "4":
        consulados_elegidos = ["LOS ANGELES"]
    elif op_cons == "5":
        consulados_elegidos = ["SAN FRANCISCO", "LA HABANA", "MIAMI", "LOS ANGELES"]
    else:
        consulados_elegidos = ["SAN FRANCISCO"]

    log("\n" + "=" * 65)
    log("  SELECCIONA EL MODO DE OPERACIÓN:\n")
    log("  [1] MODO RADAR INFORMATIVO (Recomendado)")
    log("      - Escanea silenciosamente sin alterar nada.")
    log("      - Alerta al instante por Telegram con Reporte Ejecutivo.")
    log("      - Deja el navegador abierto para elegir fecha con el cliente.\n")
    log("  [2] MODO ASISTIDO (Selector Rápido de 1 Tecla)")
    log("      - Cruza las preferencias con todos los meses y días abiertos.")
    log("      - Clasifica en APTOS vs EN ESPERA e inyecta con [ENTER].")
    log("=" * 65)

    try:
        op_modo = input("  Selecciona el modo [1 o 2] (Por defecto: 1): ").strip()
    except Exception:
        op_modo = "1"

    modo = 2 if op_modo == "2" else 1

    return consulados_elegidos, modo


def main():
    config = cargar_configuracion()
    consulados_elegidos, modo = mostrar_menu_interactivo()

    nombre_modo = "RADAR INFORMATIVO" if modo == 1 else "MODO ASISTIDO (SELECTOR DE 1 TECLA)"

    todos_consulados = config.get("CONSULADOS_LMD", [])
    consulados_activos = [c for c in todos_consulados if c["nombre"].upper() in consulados_elegidos]

    if not consulados_activos:
        consulados_activos = [
            {
                "nombre": "SAN FRANCISCO",
                "tramite": "Ley de Memoria Democrática (LMD)",
                "url": "https://www.citaconsular.es/es/hosteds/widgetdefault/2d7c60f44f450863fb149b64fdd4b74a1/#services"
            }
        ]

    log(f"\n[INICIANDO RADAR] Modo: {nombre_modo}")
    log(f"[CONSULADOS SELECCIONADOS]: {', '.join([c['nombre'] for c in consulados_activos])}")
    log(f"[IP DE SALIDA ACTIVA]: {obtener_ip_publica()}")

    os.makedirs(PERFIL_DIR, exist_ok=True)
    log("[CHROME] Abriendo perfil de navegación persistente...")

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
                log(f"CICLO DE ESCANEO #{ciclo} — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
                log(f"─────────────────────────────────────────────────────────────────")

                for consulado_info in consulados_activos:
                    nombre_cons = consulado_info["nombre"].upper()

                    # Despacho al controlador especializado
                    if "SAN FRANCISCO" in nombre_cons:
                        hay_citas, info_fechas, info_slots = verificar_citas_san_francisco(page, config, log_fn=log)
                    elif "HABANA" in nombre_cons:
                        hay_citas, info_fechas, info_slots = verificar_citas_habana(page, config, log_fn=log)
                    elif "MIAMI" in nombre_cons:
                        hay_citas, info_fechas, info_slots = verificar_citas_miami(page, config, log_fn=log)
                    elif "LOS ANGELES" in nombre_cons or "ÁNGELES" in nombre_cons:
                        hay_citas, info_fechas, info_slots = verificar_citas_los_angeles(page, config, log_fn=log)
                    else:
                        log(f"\n[RADAR] Consulado {nombre_cons} sin controlador.")
                        hay_citas, info_fechas, info_slots = False, "", {}

                    if hay_citas:
                        if config.get("SONIDO_ALARMA"):
                            emitir_alarma_sonora()

                        # 1. Recuperar candidatos estrictamente filtrados por este consulado
                        candidatos = obtener_candidatos_workspace(nombre_cons)
                        
                        # 2. Clasificación jerárquica con el motor de preferencias
                        compatibles, en_espera = clasificar_candidatos_con_mapa_citas(candidatos, info_slots)

                        # 3. Notificación Telegram enriquecida con REPORTE EJECUTIVO POR MESES
                        enviar_alerta_telegram(
                            config.get("TELEGRAM_BOT_TOKEN"),
                            config.get("TELEGRAM_CHAT_ID"),
                            nombre_cons,
                            info_fechas,
                            consulado_info["url"],
                            compatibles,
                            en_espera,
                            info_slots
                        )

                        # 4. Modo Asistido vs Informativo
                        if modo == 2:
                            ejecutar_selector_asistido(page, nombre_cons, candidatos, info_slots, config)
                        else:
                            log(f"\n👉 [ACCIÓN REQUERIDA]: Cita abierta en pantalla. Revisa el calendario y formaliza la reserva.")
                            time.sleep(120)

                    # Pausa estándar con Jitter aleatorio
                    p_min = config.get("PAUSA_MINIMA_SEGUNDOS", 45)
                    p_max = config.get("PAUSA_MAXIMA_SEGUNDOS", 80)
                    pausa = random.uniform(p_min, p_max)
                    pausa_con_conteo_regresivo(pausa)

                # Descanso extendido anti-fatiga cada 15 ciclos (3 a 4 minutos)
                if ciclo % 15 == 0:
                    pausa_larga = random.uniform(180, 240)
                    log(f"\n☕ [DESCANSO DE IP] Pausa extendida anti-fatiga de seguridad ({pausa_larga/60:.1f} min)...")
                    pausa_con_conteo_regresivo(pausa_larga, mensaje_prefijo="☕ [DESCANSO IP] Reanudando radar en")

                ciclo += 1

        except KeyboardInterrupt:
            log("\n[RADAR DETENIDO] Operación finalizada por el usuario.")
        finally:
            context.close()


if __name__ == "__main__":
    main()
