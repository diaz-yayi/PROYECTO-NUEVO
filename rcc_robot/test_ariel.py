# -*- coding: utf-8 -*-
import os, sys, io, time, re, tempfile, urllib.request, subprocess

if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

import imageio_ffmpeg
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

from playwright.sync_api import sync_playwright
import speech_recognition as sr

def log(msg):
    print(msg, flush=True)

URL_RCC = "https://sede.mjusticia.gob.es/eConsultas/inicioSegRcCentral?lang=es_es&idpagina=1215197884559&idtramite=1214483963064"

def transcribir_audio(wav_file):
    r = sr.Recognizer()
    with sr.AudioFile(wav_file) as source:
        audio_data = r.record(source)
    for lang in ["es-ES", "en-US"]:
        try:
            txt = r.recognize_google(audio_data, language=lang)
            if txt: return txt
        except Exception:
            pass
    return None

log("[TEST] Probando consulta oficial para ARIEL BAÑO GARCIA (0055698/2024)...")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    log("[1] Navegando a la Sede del Ministerio...")
    page.goto(URL_RCC, wait_until="domcontentloaded")
    page.wait_for_selector("#numero_expediente", timeout=15000)

    log("[2] Rellenando campos iniciales...")
    page.locator("#numero_expediente").fill("0055698")
    page.locator("#anio_expediente").fill("2024")
    page.locator("#tipo_expediente").select_option("P0E")
    page.locator("#nombreInteresado").fill("ARIEL")
    page.locator("#apellidoInteresado").fill("BAÑO")

    log("[3] Localizando y resolviendo reCAPTCHA...")
    time.sleep(2)

    anchor_frame = page.frame_locator('iframe[src*="recaptcha/api2/anchor"]')
    anchor_checkbox = anchor_frame.locator("#recaptcha-anchor")
    anchor_checkbox.click()
    time.sleep(3)

    if "recaptcha-checkbox-checked" in (anchor_checkbox.get_attribute("class") or ""):
        log("    [OK] reCAPTCHA aprobado con 1-clic!")
    else:
        log("    Resolviendo reto de audio...")
        bframe = page.frame_locator('iframe[src*="recaptcha/api2/bframe"]')
        audio_btn = bframe.locator("#recaptcha-audio-button")
        if audio_btn.is_visible():
            audio_btn.click()
            time.sleep(2)

            audio_src = bframe.locator("#audio-source").get_attribute("src")
            log(f"    URL del audio de desafio: {audio_src}")
            if audio_src:
                temp_dir = tempfile.gettempdir()
                mp3_file = os.path.join(temp_dir, "captcha_audio.mp3")
                wav_file = os.path.join(temp_dir, "captcha_audio.wav")

                # Descargar usando page.request para pasar cookies y session
                resp = page.request.get(audio_src)
                with open(mp3_file, "wb") as f:
                    f.write(resp.body())
                
                log(f"    Archivo MP3 descargado: {len(resp.body())} bytes")

                # Convertir a WAV con ffmpeg
                res_ffmpeg = subprocess.run([FFMPEG_EXE, "-y", "-i", mp3_file, "-ac", "1", "-ar", "16000", wav_file], capture_output=True, text=True)
                if not os.path.exists(wav_file):
                    log(f"    [!] Error en ffmpeg: {res_ffmpeg.stderr}")
                else:
                    texto = transcribir_audio(wav_file)
                    log(f"    Audio resuelto: [{texto}]")
                    if texto:
                        bframe.locator("#audio-response").fill(texto)
                        bframe.locator("#recaptcha-verify-button").click()
                        time.sleep(3)

    # Asegurar que los campos sigan llenos antes de enviar
    log("[4] Verificando campos antes de enviar...")
    page.locator("#nombreInteresado").fill("ARIEL")
    page.locator("#apellidoInteresado").fill("BAÑO")
    time.sleep(1)

    log("[5] Enviando formulario a la Sede...")
    page.locator("#submitRRCC").click()
    page.wait_for_load_state("domcontentloaded", timeout=15000)
    time.sleep(4)

    log("[6] Analizando respuesta oficial de la Sede...")
    content = page.content()
    page.screenshot(path=os.path.join(os.path.dirname(__file__), "captura_resultado_rcc.png"))
    log("    Captura de pantalla guardada.")

    lineas_limpias = []
    for l in content.splitlines():
        txt = re.sub(r'<[^>]+>', ' ', l).strip()
        if txt and len(txt) > 3 and "function" not in txt and "{" not in txt:
            lineas_limpias.append(txt)

    log("\n=================================================================")
    log("RESPUESTA OFICIAL DEL REGISTRO CIVIL CENTRAL:")
    log("=================================================================")
    for line in lineas_limpias:
        if any(w in line.lower() for w in ["estado", "expediente", "tramitación", "concedid", "calificaci", "requeri", "inscrit", "resoluci", "datos", "interesado", "asunto", "errores", "apellido", "no se ha encontrado"]):
            log(f" > {line}")

    browser.close()

log("\n[FIN] Prueba completada.")
