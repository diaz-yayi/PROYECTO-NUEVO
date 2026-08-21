# -*- coding: utf-8 -*-
"""
=============================================================================
ROBOT VERIFICADOR DE EXPEDIENTES - REGISTRO CIVIL CENTRAL DE ESPAÑA (v3.2 DUAL)
=============================================================================
MODOS DE EJECUCIÓN DISPONIBLES:
  [1] MODO AUTÓNOMO 100% (Desatendido con Whisper local + Reintentos)
  [2] MODO ASISTIDO (Relleno automático instantáneo + Clic manual del captcha)

REGLAS INAMOVIBLES:
  - NUNCA se lee ni escribe el archivo Excel local.
  - NUNCA se insertan casos de prueba ficticios.
  - Fuente exclusiva de datos: Google Workspace vía WebApp segura.
  - Los apellidos originales de la fuente se preservan siempre intactos.
  - La columna G (Nombre en Sistema) guarda el nombre oficial del Ministerio.
=============================================================================
"""

import os
import re
import sys
import io
import time
import random
import urllib.parse
import tempfile
import subprocess
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

# Configurar decodificador ffmpeg integrado
try:
    import imageio_ffmpeg
    FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
    os.environ["PATH"] = os.path.dirname(FFMPEG_EXE) + os.pathsep + os.environ.get("PATH", "")
except Exception:
    FFMPEG_EXE = "ffmpeg"

# ─────────────────────────────────────────────
# SALIDA UTF-8 SEGURA PARA WINDOWS
# ─────────────────────────────────────────────
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# ─────────────────────────────────────────────
# CONFIGURACIÓN GENERAL
# ─────────────────────────────────────────────
ROBOT_DIR         = os.path.dirname(os.path.abspath(__file__))
PERFIL_CHROME_DIR = os.path.join(ROBOT_DIR, "perfil_chrome")

PALABRA_SECRETA   = "Aristeo_Seguridad_2026_LMD!"
WEB_APP_URL       = "https://script.google.com/macros/s/AKfycbz7IrFci86-mzRwl1ty9KcI53P89kQ6Zh7NEyAxLlguqBL0fFdZuASX1e3Hmnars-eZgQ/exec"
URL_RCC           = "https://sede.mjusticia.gob.es/eConsultas/inicioSegRcCentral?lang=es_es&idpagina=1215197884559&idtramite=1214483963064"

MAX_INTENTOS_POR_RONDA = 2
MAX_REINTENTOS_CAPTCHA = 2

# ─────────────────────────────────────────────
# MOTOR DE TRANSCRIPCIÓN (WHISPER LOCAL + RESPALDO)
# ─────────────────────────────────────────────
WHISPER_DISPONIBLE = False
_whisper_modelo = None


def log(msg):
    print(msg, flush=True)


def _cargar_whisper():
    """Carga el modelo Whisper 'tiny' en memoria para transcripción offline."""
    global WHISPER_DISPONIBLE, _whisper_modelo
    if _whisper_modelo is not None:
        return True
    try:
        import whisper
        _whisper_modelo = whisper.load_model("tiny")
        WHISPER_DISPONIBLE = True
        log("[WHISPER] Modelo 'tiny' cargado en memoria.")
        return True
    except Exception as e:
        log(f"[WHISPER] No disponible ({e}), se usará SpeechRecognition como respaldo.")
        return False


def transcribir_audio_whisper(wav_file):
    """Transcripción local rápida sin conexión a internet."""
    try:
        import whisper
        resultado = _whisper_modelo.transcribe(wav_file, language="es", fp16=False)
        texto = resultado.get("text", "").strip()
        if texto:
            log(f"   [WHISPER] Transcrito: [{texto}]")
            return texto
    except Exception as e:
        log(f"   [WHISPER] Error: {e}")
    return None


def transcribir_audio_speechrecognition(wav_file):
    """Transcripción de respaldo vía Google Speech Recognition."""
    try:
        import speech_recognition as sr
        r = sr.Recognizer()
        with sr.AudioFile(wav_file) as source:
            audio_data = r.record(source)
        for lang in ["es-ES", "en-US"]:
            try:
                txt = r.recognize_google(audio_data, language=lang)
                if txt:
                    log(f"   [SR] Transcrito ({lang}): [{txt}]")
                    return txt
            except Exception:
                pass
    except Exception as e:
        log(f"   [SR] Error: {e}")
    return None


def transcribir_audio(wav_file):
    """Selecciona el mejor motor de transcripción disponible."""
    if WHISPER_DISPONIBLE and _whisper_modelo is not None:
        res = transcribir_audio_whisper(wav_file)
        if res:
            return res
    return transcribir_audio_speechrecognition(wav_file)


# ─────────────────────────────────────────────
# NORMALIZACIÓN Y VARIANTES DE APELLIDOS
# ─────────────────────────────────────────────
def normalizar_apellido(texto):
    """Elimina tildes y sustituye Ñ por N. No altera el original."""
    sust = {
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Ñ': 'N', 'ñ': 'n', 'Ü': 'U', 'ü': 'u'
    }
    r = texto
    for k, v in sust.items():
        r = r.replace(k, v)
    return r


def generar_variantes_apellido(apellidos_original):
    """
    Genera variantes de búsqueda ordenadas por probabilidad de éxito:
      1. Primer apellido normalizado (sin Ñ ni tildes)   → CASTOSA / BANOS
      2. Ambos apellidos completos normalizados         → CASTOSA SENGES / BANOS GARCIA
      3. Primer apellido con ajuste de 'S'              → CASTOSAS / BANOS
      4. Primer apellido original                       → BAÑOS (último recurso)
      5. Apellidos completos originales                → BAÑOS GARCIA
    """
    partes = apellidos_original.split()
    p1 = partes[0] if partes else apellidos_original

    v1 = normalizar_apellido(p1).upper()
    v2 = normalizar_apellido(apellidos_original).upper()
    v3 = (v1 + "S") if not v1.endswith("S") else (v1[:-1] if len(v1) > 3 else v1)
    v4 = p1.upper()
    v5 = apellidos_original.upper()

    variantes = []
    for v in [v1, v2, v3, v4, v5]:
        v_clean = v.strip()
        if v_clean and v_clean not in variantes:
            variantes.append(v_clean)
    return variantes


def escribir_como_humano(locator, texto):
    """Escribe carácter por carácter con cadencia variable (Human Typing)."""
    locator.click()
    time.sleep(random.uniform(0.15, 0.30))
    locator.fill("")
    for char in str(texto):
        locator.type(char, delay=random.randint(65, 150))
        if random.random() < 0.07:
            time.sleep(random.uniform(0.10, 0.25))


# ─────────────────────────────────────────────
# COMUNICACIÓN SEGURA CON GOOGLE WORKSPACE
# ─────────────────────────────────────────────
def obtener_candidatos_workspace():
    """Obtiene los expedientes PENDIENTE RESOLUCION de ESPAÑA desde Google Workspace."""
    try:
        url = f"{WEB_APP_URL}?accion=obtener_rcc&key={urllib.parse.quote(PALABRA_SECRETA)}"
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and "candidatos" in data:
                log(f"[WORKSPACE] Conectado. Candidatos recibidos: {len(data['candidatos'])}")
                return data["candidatos"]
            else:
                log(f"[ERROR] Workspace respondió: {data.get('error', 'desconocido')}")
        else:
            log(f"[ERROR] Workspace devolvió HTTP {resp.status_code}")
    except Exception as e:
        log(f"[ERROR] No se pudo conectar con Google Workspace: {e}")
    return None


def guardar_resultado_workspace(candidato, resultado):
    """Escribe el resultado verificado en la hoja VERIFICACION_RCC de Google Workspace."""
    try:
        url = f"{WEB_APP_URL}?accion=guardar_rcc&key={urllib.parse.quote(PALABRA_SECRETA)}"
        payload = {
            "candidato": {
                "identificador":    candidato.get("identificador", ""),
                "nombre":           candidato.get("nombre", ""),
                "apellidos":        candidato.get("apellidos", ""),      # ORIGINAL intacto
                "numeroExpediente": candidato.get("numeroExpediente", ""),
                "anioExpediente":   candidato.get("anioExpediente", "")
            },
            "resultado": {
                "estado":        resultado.get("estado", ""),
                "nombreSistema": resultado.get("nombreSistema", ""),    # Col G: nombre oficial
                "detalle":       resultado.get("detalle", ""),
                "resultado":     resultado.get("resultado", "NO_ENCONTRADO")
            }
        }
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            log("   [NUBE] Resultado guardado en Google Workspace (VERIFICACION_RCC).")
            return True
        else:
            log(f"   [!] Error HTTP {resp.status_code} al guardar en Workspace.")
    except Exception as e:
        log(f"   [!] Excepción al guardar en Google Workspace: {e}")
    return False


# ─────────────────────────────────────────────
# RESOLUCIÓN DESATENDIDA DE RECAPTCHA (MODO 1)
# ─────────────────────────────────────────────
def _obtener_y_transcribir_audio(page_request, audio_src):
    """Descarga el MP3, convierte a WAV y transcribe."""
    temp_dir = tempfile.gettempdir()
    mp3_file = os.path.join(temp_dir, f"cap_{random.randint(1000, 9999)}.mp3")
    wav_file = os.path.join(temp_dir, f"cap_{random.randint(1000, 9999)}.wav")

    try:
        resp_audio = page_request.get(audio_src)
        with open(mp3_file, "wb") as fh:
            fh.write(resp_audio.body())

        subprocess.run(
            [FFMPEG_EXE, "-y", "-i", mp3_file, "-ac", "1", "-ar", "16000", wav_file],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )

        if not os.path.exists(wav_file):
            return None

        return transcribir_audio(wav_file)

    finally:
        for fh in [mp3_file, wav_file]:
            try:
                if os.path.exists(fh):
                    os.remove(fh)
            except Exception:
                pass


def resolver_audio_recaptcha_autonomo(page):
    """Resuelve reCAPTCHA de forma 100% autónoma con Whisper."""
    try:
        anchor_frame = page.frame_locator('iframe[src*="recaptcha/api2/anchor"]')
        checkbox = anchor_frame.locator("#recaptcha-anchor")

        checkbox.hover()
        time.sleep(random.uniform(0.3, 0.6))
        checkbox.click()
        time.sleep(random.uniform(2.0, 2.8))

        if "recaptcha-checkbox-checked" in (checkbox.get_attribute("class") or ""):
            log("   [OK] reCAPTCHA aprobado con 1-clic.")
            return True

        log("   [i] Abriendo desafío de audio...")
        bframe = page.frame_locator('iframe[src*="recaptcha/api2/bframe"]')
        audio_btn = bframe.locator("#recaptcha-audio-button")

        if not audio_btn.is_visible():
            log("   [!] Desafío de audio no disponible (posible bloqueo por tarjetas).")
            return False

        audio_btn.click()
        time.sleep(random.uniform(1.2, 1.8))

        for intento in range(1, MAX_REINTENTOS_CAPTCHA + 1):
            log(f"   [CAPTCHA] Intento de audio {intento}/{MAX_REINTENTOS_CAPTCHA}")
            audio_src = bframe.locator("#audio-source").get_attribute("src")

            if not audio_src:
                break

            texto = _obtener_y_transcribir_audio(page.request, audio_src)

            if not texto:
                try:
                    reload_btn = bframe.locator("#recaptcha-reload-button")
                    if reload_btn.is_visible():
                        reload_btn.click()
                        time.sleep(random.uniform(1.5, 2.2))
                        continue
                except Exception:
                    pass
                break

            response_input = bframe.locator("#audio-response")
            response_input.fill(texto)
            time.sleep(random.uniform(0.3, 0.6))
            bframe.locator("#recaptcha-verify-button").click()
            time.sleep(random.uniform(2.0, 2.8))

            try:
                clase = anchor_frame.locator("#recaptcha-anchor").get_attribute("class") or ""
                if "recaptcha-checkbox-checked" in clase:
                    log("   [OK] reCAPTCHA resuelto con éxito por audio.")
                    return True
            except Exception:
                pass

            try:
                reload_btn = bframe.locator("#recaptcha-reload-button")
                if reload_btn.is_visible():
                    reload_btn.click()
                    time.sleep(random.uniform(1.5, 2.2))
            except Exception:
                break

        return False

    except Exception as e:
        log(f"   [ERROR] reCAPTCHA: {e}")
        return False


# ─────────────────────────────────────────────
# DETECCIÓN Y PARSER OFICIAL DEL MINISTERIO DE JUSTICIA
# ─────────────────────────────────────────────
def es_resultado_no_encontrado(content):
    """Detecta si la sede electrónica devolvió el recuadro rojo de no encontrado/error."""
    lower = content.lower()
    indicadores = [
        "no se ha obtenido ningún resultado",
        "no se ha obtenido ningun resultado",
        "no se han obtenido resultados",
        "revise la información introducida",
        "revise la informacion introducida",
        "bloqueinformativorojo",
        "no se ha encontrado",
        "no se han encontrado datos",
        "no existe ningún expediente",
        "no existe ningun expediente",
        "criterios de búsqueda introducidos",
        "criterios de busqueda introducidos",
        "los datos introducidos no corresponden"
    ]
    return any(ind in lower for ind in indicadores)


def parsear_respuesta_rcc(content):
    """
    Extrae el estado oficial literal y el nombre reconocido por el Ministerio
    mediante delimitadores invariables del HTML de la Sede Electrónica.
    """
    estado_oficial    = ""
    nombre_en_sistema = ""
    detalle_completo  = ""

    # 1. Nombre completo tal como figura en el Ministerio (Columna G)
    m_nombre = re.search(r'correspondiente a D\./D[ªa]\s*([^,<\n]+)', content, re.IGNORECASE)
    if m_nombre:
        nombre_limpio = re.sub(r'<[^>]+>', ' ', m_nombre.group(1))
        nombre_en_sistema = re.sub(r'\s+', ' ', nombre_limpio).strip()

    # 2. Extracción Delimitada del Estado Oficial
    # Límite inicial: "siguiente estado:"
    # Límite final: "La información que el Ministerio" o cierre de bloque
    if "siguiente estado:" in content:
        parte_posterior = content.split("siguiente estado:")[1]
        
        # Cortar antes del aviso legal de notificación
        if "La información que el Ministerio" in parte_posterior:
            bloque_estado = parte_posterior.split("La información que el Ministerio")[0]
        elif "La informacion que el Ministerio" in parte_posterior:
            bloque_estado = parte_posterior.split("La informacion que el Ministerio")[0]
        elif "ofrece en esta página no tiene carácter" in parte_posterior:
            bloque_estado = parte_posterior.split("ofrece en esta página no tiene carácter")[0]
        else:
            bloque_estado = parte_posterior.split("</div>")[0]
        
        # Limpiar etiquetas HTML y espacios múltiples
        estado_limpio = re.sub(r'<[^>]+>', ' ', bloque_estado)
        estado_limpio = re.sub(r'\s+', ' ', estado_limpio).strip()
        
        if estado_limpio:
            estado_oficial = estado_limpio

    # Respaldo si no se encontró por delimitadores
    if not estado_oficial:
        m_estado = re.search(r'siguiente estado:\s*(?:<[^>]+>\s*)*([^<\n]{4,200})', content, re.IGNORECASE)
        if m_estado:
            estado_oficial = re.sub(r'<[^>]+>', ' ', m_estado.group(1)).strip()

    # 3. Párrafo completo oficial (Detalle)
    m_bloque = re.search(
        r'(El expediente \d+.*?del año \d+.*?)(?=La información que el Ministerio|La informacion que el Ministerio|<div class="footer|$)',
        content, re.DOTALL | re.IGNORECASE
    )
    if m_bloque:
        detalle_completo = re.sub(r'<[^>]+>', ' ', m_bloque.group(1))
        detalle_completo = re.sub(r'\s+', ' ', detalle_completo).strip()

    return {
        "estado":        estado_oficial or "El expediente está pendiente de tramitar",
        "nombreSistema": nombre_en_sistema,
        "detalle":       detalle_completo or "Expediente localizado en Registro Civil Central"
    }


# ─────────────────────────────────────────────
# EJECUCIÓN POR MODO (AUTÓNOMO VS ASISTIDO)
# ─────────────────────────────────────────────
def consultar_modo_asistido(page, candidato):
    """
    MODO ASISTIDO CON CASCADA DE VARIANTES Y DETECCIÓN AUTOMÁTICA DE ERROR:
    Rellena los campos al instante y espera a que el operador resuelva el captcha.
    Si el Ministerio indica 'No se ha obtenido ningún resultado', el robot detecta
    el recuadro rojo, recarga la página de inmediato y prepara la siguiente variante.
    """
    nombre    = candidato.get("nombre", "")
    numero    = candidato.get("numeroExpediente", "")
    anio      = candidato.get("anioExpediente", "")
    variantes = candidato.get("_variantes", [])
    if not variantes:
        variantes = [candidato.get("apellidos", "")]

    try:
        for idx_var, variante in enumerate(variantes, start=1):
            log(f"\n[ASISTIDO] Preparando variante {idx_var}/{len(variantes)}: {numero}/{anio} — {nombre} [{variante}]...")

            # Siempre asegurar que estamos en el formulario con inputs disponibles
            page.goto(URL_RCC, wait_until="domcontentloaded")
            page.wait_for_selector("#numero_expediente", timeout=15000)
            time.sleep(0.5)

            # Relleno de campos instantáneo
            page.locator("#numero_expediente").fill(numero)
            page.locator("#anio_expediente").fill(anio)
            page.locator("#tipo_expediente").select_option("P0E")
            page.locator("#nombreInteresado").fill(nombre)
            page.locator("#apellidoInteresado").fill(variante)

            log(f"   👉 [ACCIÓN REQUERIDA]: Resuelve el Captcha en pantalla y pulsa 'Consultar' (Variante {idx_var}/{len(variantes)})...")

            # Esperar activamente a que el usuario resuelva el captcha y envie el formulario
            inicio_espera = time.time()
            resultado_intento = None

            while time.time() - inicio_espera < 180:
                try:
                    # CANDADO INQUEBRANTABLE: Mientras los inputs o el botón Consultar sigan en pantalla,
                    # significa que el operador está resolviendo el captcha. NO evaluar resultados aún.
                    if page.locator("#submitRRCC").is_visible() or page.locator("#numero_expediente").is_visible():
                        time.sleep(1.0)
                        continue

                    # Si el botón Consultar ya desapareció, el formulario fue enviado y estamos en la pantalla de resultados
                    time.sleep(1.0)
                    content = page.content()

                    # Caso 1: Expediente Localizado (Recuadro Verde)
                    if "siguiente estado:" in content or "correspondiente a D./D" in content or "bloqueCampoTextoExito" in content or "formatoVerde" in content:
                        time.sleep(1.0)
                        content = page.content()
                        datos = parsear_respuesta_rcc(content)
                        log(f"   [OK] ¡Expediente Localizado con Éxito!")
                        log(f"        Estado Oficial: [{datos['estado']}]")
                        log(f"        Nombre en Sistema: [{datos['nombreSistema']}]")
                        return {
                            "ok":            True,
                            "resultado":     "OK",
                            "estado":        datos["estado"],
                            "nombreSistema": datos["nombreSistema"],
                            "detalle":       datos["detalle"]
                        }

                    # Caso 2: No encontrado (Recuadro Rojo)
                    if es_resultado_no_encontrado(content) or page.locator(".bloqueInformativoRojo").is_visible():
                        log(f"   [!] No encontrado con la variante [{variante}].")
                        if idx_var < len(variantes):
                            log(f"   🔄 Recargando automáticamente y preparando variante {idx_var+1}/{len(variantes)}...")
                        resultado_intento = "NO_ENCONTRADO"
                        break

                except Exception:
                    pass

                time.sleep(1.0)

            if resultado_intento == "NO_ENCONTRADO":
                continue

        log("   [FIN VARIANTES] No se encontró tras probar todas las variantes de apellidos.")
        return {
            "ok":            False,
            "resultado":     "NO_ENCONTRADO",
            "estado":        "No encontrado en Sede",
            "nombreSistema": "",
            "detalle":       f"No se ha obtenido ningún resultado tras verificar {len(variantes)} variantes de apellidos"
        }

    except Exception as e:
        log(f"   [EXCEPCIÓN EN ASISTIDO] {e}")
        return None


def intentar_consulta_autonoma(page, numero, anio, nombre, variante_apellido):
    """Intento de consulta autónomo con escritura humana y resolución Whisper."""
    try:
        page.goto(URL_RCC, wait_until="domcontentloaded")
        page.wait_for_selector("#numero_expediente", timeout=15000)
        time.sleep(random.uniform(0.5, 1.0))

        escribir_como_humano(page.locator("#numero_expediente"), numero)
        time.sleep(random.uniform(0.2, 0.4))
        escribir_como_humano(page.locator("#anio_expediente"), anio)
        time.sleep(random.uniform(0.2, 0.4))
        page.locator("#tipo_expediente").select_option("P0E")
        time.sleep(random.uniform(0.3, 0.6))
        escribir_como_humano(page.locator("#nombreInteresado"), nombre)
        time.sleep(random.uniform(0.2, 0.5))
        escribir_como_humano(page.locator("#apellidoInteresado"), variante_apellido)
        time.sleep(random.uniform(0.6, 1.1))

        if not resolver_audio_recaptcha_autonomo(page):
            return "ERROR_CAPTCHA", None

        page.locator("#nombreInteresado").fill(nombre)
        page.locator("#apellidoInteresado").fill(variante_apellido)
        time.sleep(random.uniform(0.4, 0.7))

        page.locator("#submitRRCC").click()
        page.wait_for_load_state("domcontentloaded", timeout=15000)
        time.sleep(random.uniform(2.5, 3.5))

        content = page.content()

        if es_resultado_no_encontrado(content):
            return "NO_ENCONTRADO", None

        if "siguiente estado:" in content or "correspondiente a D./D" in content or "bloqueCampoTextoExito" in content or "formatoVerde" in content:
            datos = parsear_respuesta_rcc(content)
            log(f"   [OK] Estado Oficial: {datos['estado']}")
            log(f"   [OK] Nombre en Sistema: {datos['nombreSistema']}")
            return "ENCONTRADO", datos

    except Exception as e:
        log(f"   [EXCEPCION] {e}")

    return "ERROR", None


def consultar_modo_autonomo(page, candidato, variantes):
    """Gestión de intentos autónomos en Modo 1 con enfriamiento ampliado por bloqueo de Captcha."""
    nombre = candidato.get("nombre", "")
    numero = candidato.get("numeroExpediente", "")
    anio   = candidato.get("anioExpediente", "")

    for idx, variante in enumerate(variantes):
        if idx >= MAX_INTENTOS_POR_RONDA:
            return None

        # Reintentos con el mismo cliente ante bloqueo de Captcha (hasta 3 reintentos)
        reintentos_captcha = 0
        max_reintentos_captcha = 3

        while reintentos_captcha < max_reintentos_captcha:
            log(f"\n   [>] Intento variante {idx+1}/{MAX_INTENTOS_POR_RONDA} (Prueba {reintentos_captcha+1}/{max_reintentos_captcha}): {numero}/{anio} — {nombre} [{variante}]")
            estado, datos = intentar_consulta_autonoma(page, numero, anio, nombre, variante)

            if estado == "ENCONTRADO":
                return {
                    "ok":            True,
                    "resultado":     "OK",
                    "estado":        datos["estado"],
                    "nombreSistema": datos["nombreSistema"],
                    "detalle":       datos["detalle"]
                }
            elif estado == "ERROR_CAPTCHA":
                reintentos_captcha += 1
                if reintentos_captcha < max_reintentos_captcha:
                    pausa_enfriamiento = random.randint(65, 85)
                    log(f"   ⏳ [BLOQUEO TEMPORAL GOOGLE] Pausa de enfriamiento de {pausa_enfriamiento}s antes de reintentar con este cliente...")
                    for s_restante in range(pausa_enfriamiento, 0, -10):
                        log(f"      ... esperando {s_restante}s para liberar limitación de IP...")
                        time.sleep(min(10, s_restante))
                else:
                    log("   [!] Límite de reintentos por Captcha alcanzado para este cliente. Avanzando...")
                    return None
            else:
                # Estado NO_ENCONTRADO u otro error
                break

        time.sleep(random.uniform(5.0, 8.0))

    return None


# ─────────────────────────────────────────────
# MENÚ INTERACTIVO Y BUCLE PRINCIPAL
# ─────────────────────────────────────────────
def mostrar_menu_seleccion():
    """Muestra el menú interactivo para seleccionar el modo de ejecución."""
    log("\n" + "=" * 65)
    log("  VERIFICADOR REGISTRO CIVIL CENTRAL (ESPAÑA v3.3)")
    log("=" * 65)
    log("  [1] MODO AUTÓNOMO 100% (Lote completo desatendido con Whisper)")
    log("      - Intenta resolver el reCAPTCHA por audio automáticamente.")
    log("      - Pausa de enfriamiento inteligente ante bloqueos de IP.\n")
    log("  [2] MODO ASISTIDO POR LOTES (Secuencia completa asistida)")
    log("      - Rellena todos los campos de cada cliente secuencialmente.")
    log("      - Espera a que resuelvas el captcha y pulses Consultar.\n")
    log("  [3] MODO INDIVIDUAL / INTERACTIVO (Seleccionar cliente de la lista)")
    log("      - Muestra el menú de candidatos disponibles para elegir uno a uno.")
    log("      - Mantiene el navegador abierto entre consultas individuales.")
    log("=" * 65)

    try:
        eleccion = input("  Selecciona el modo [1, 2 o 3] (Por defecto: 3): ").strip()
    except Exception:
        eleccion = "3"

    if eleccion == "1":
        return 1
    elif eleccion == "2":
        return 2
    else:
        return 3


def ejecutar_modo_individual_interactivo(candidatos):
    """Permite al operador seleccionar candidatos de forma interactiva uno a uno, abriendo el navegador bajo demanda."""
    p_inst = None
    context = None
    page = None

    try:
        while True:
            log("\n" + "=" * 65)
            log("  SELECCIÓN INTERACTIVA DE CANDIDATOS (RCC ESPAÑA)")
            log("=" * 65)
            for i, c in enumerate(candidatos, start=1):
                id_txt = c.get("identificador", "").ljust(6)
                nom_txt = f"{c.get('nombre', '')} {c.get('apellidos', '')}".strip()[:30].ljust(30)
                exp_txt = f"{c.get('numeroExpediente', '')}/{c.get('anioExpediente', '')}"
                log(f"  [{i:2d}] {id_txt} — {nom_txt} (Exp: {exp_txt})")
            log("  [ 0] Salir / Finalizar sesión")
            log("=" * 65)

            try:
                opcion = input("  👉 Selecciona el Nº del cliente o introduce su ID (ej: 3 o I332): ").strip()
            except Exception:
                break

            if opcion in ["0", "q", "Q", "exit", "salir"]:
                log("  [INFO] Finalizando modo interactivo...")
                break

            # Buscar candidato por número de lista o por identificador
            cand_elegido = None
            if opcion.isdigit():
                idx_num = int(opcion)
                if 1 <= idx_num <= len(candidatos):
                    cand_elegido = candidatos[idx_num - 1]
            else:
                # Buscar por ID (ej: I332) o coincidencia de nombre
                opcion_upper = opcion.upper()
                for c in candidatos:
                    if c.get("identificador", "").upper() == opcion_upper or opcion_upper in f"{c.get('nombre', '')} {c.get('apellidos', '')}".upper():
                        cand_elegido = c
                        break

            if not cand_elegido:
                log(f"  [!] No se encontró ningún candidato coincidente con: '{opcion}'. Intenta de nuevo.")
                time.sleep(1.0)
                continue

            # Abrir el navegador únicamente al seleccionar un cliente
            if page is None:
                os.makedirs(PERFIL_CHROME_DIR, exist_ok=True)
                log("\n[INFO] Iniciando navegador Chrome para la consulta...")
                p_inst = sync_playwright().start()
                context = p_inst.chromium.launch_persistent_context(
                    user_data_dir=PERFIL_CHROME_DIR,
                    headless=False,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-infobars"
                    ],
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                )
                context.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    window.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en'] });
                """)
                page = context.new_page()

            log(f"\n=================================================================")
            log(f"  CONSULTANDO: {cand_elegido.get('identificador', '')} — {cand_elegido.get('nombre', '')} {cand_elegido.get('apellidos', '')}")
            log(f"  Expediente: {cand_elegido.get('numeroExpediente', '')}/{cand_elegido.get('anioExpediente', '')}")
            log(f"=================================================================")

            res = consultar_modo_asistido(page, cand_elegido)
            if res:
                guardar_resultado_workspace(cand_elegido, res)
                log(f"  ✅ [ÉXITO] Consulta de {cand_elegido.get('identificador', '')} completada y registrada.")
            else:
                log(f"  [!] No se completó la verificación para este expediente.")

            log("\n  Navegador listo para la siguiente consulta...")
            time.sleep(1.5)

    finally:
        if context:
            try: context.close()
            except Exception: pass
        if p_inst:
            try: p_inst.stop()
            except Exception: pass


def main():
    modo = mostrar_menu_seleccion()
    if modo == 1:
        nombre_modo = "AUTÓNOMO 100%"
    elif modo == 2:
        nombre_modo = "ASISTIDO POR LOTES"
    else:
        nombre_modo = "INDIVIDUAL / INTERACTIVO"
    log(f"\n[MODO ACTIVO]: {nombre_modo}")

    if modo == 1:
        _cargar_whisper()

    # 1. Obtener candidatos desde Google Workspace
    candidatos = obtener_candidatos_workspace()
    if candidatos is None:
        log("\n[DETENIDO] No se pudo conectar con Google Workspace.")
        log("           Verifica tu conexión y el despliegue de la WebApp.")
        return

    if len(candidatos) == 0:
        log("\n[INFO] No hay expedientes de ESPAÑA en PENDIENTE RESOLUCIÓN. Finalizado.")
        return

    log(f"\n[INFO] Total a verificar: {len(candidatos)} expedientes (ESPAÑA / PENDIENTE RESOLUCIÓN)")

    for c in candidatos:
        c["_variantes"] = generar_variantes_apellido(c.get("apellidos", ""))

    # 2. Ejecutar según modo seleccionado
    if modo == 3:
        # MODO 3: INDIVIDUAL / INTERACTIVO (Abre navegador solo tras elegir candidato)
        ejecutar_modo_individual_interactivo(candidatos)
    else:
        # MODOS POR LOTES (1 o 2)
        os.makedirs(PERFIL_CHROME_DIR, exist_ok=True)
        log("[INFO] Iniciando navegador...")

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=PERFIL_CHROME_DIR,
                headless=False,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-infobars"
                ],
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            
            context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en'] });
            """)

            page = context.new_page()

            if modo == 2:
                # MODO 2: ASISTIDO POR LOTES
                for idx, cand in enumerate(candidatos, start=1):
                    log(f"\n=================================================================")
                    log(f"[{idx}/{len(candidatos)}] {cand.get('identificador','')} — {cand.get('nombre','')} {cand.get('apellidos','')}")
                    log(f"=================================================================")

                    res = consultar_modo_asistido(page, cand)
                    if res:
                        guardar_resultado_workspace(cand, res)
                    else:
                        log("   [SALTADO] No se guardó resultado para este expediente.")
                    time.sleep(2.0)
            else:
                # MODO 1: AUTÓNOMO 100%
                for idx, cand in enumerate(candidatos, start=1):
                    log(f"\n=================================================================")
                    log(f"[{idx}/{len(candidatos)}] {cand.get('identificador','')} — {cand.get('nombre','')} {cand.get('apellidos','')}")
                    log(f"=================================================================")

                    res = consultar_modo_autonomo(page, cand, cand["_variantes"][:MAX_INTENTOS_POR_RONDA])
                    if res:
                        guardar_resultado_workspace(cand, res)
                    pausa = random.uniform(12.0, 20.0)
                    log(f"[PAUSA] {pausa:.1f}s de enfriamiento...")
                    time.sleep(pausa)

            context.close()

    log("\n" + "=" * 65)
    log("[FIN] SESIÓN DE VERIFICACIÓN RCC FINALIZADA.")
    log("      Resultados sincronizados en Google Workspace (VERIFICACION_RCC).")
    log("=" * 65)


if __name__ == "__main__":
    main()
