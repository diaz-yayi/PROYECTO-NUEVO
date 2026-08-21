# -*- coding: utf-8 -*-
"""
=============================================================================
CONTROLADOR ESPECIALIZADO: SAN FRANCISCO LMD (v4.0 RADIOGRAFÍA & AUTO-LOGIN)
=============================================================================
Flujo:
  1. Recarga en vivo (Live Reload) de datos frescos del Consulado de San Francisco.
  2. Puerta Cloudflare Turnstile con trayectoria humana.
  3. Popup 'Welcome / Bienvenido' -> [ Aceptar ].
  4. Botón verde [ Continue / Continuar ].
  5. Pantalla de Calendario (#datetime):
     - Extracción y agrupación jerárquica de TODOS los días habilitados por MESES.
     - Extracción de franjas horarias.
  6. Inyección asistida de credenciales en #signupsecondappointment.
=============================================================================
"""

import time
import random
from motor_preferencias import parsear_fecha_texto

URL_SAN_FRANCISCO_LMD = "https://www.citaconsular.es/es/hosteds/widgetdefault/2d7c60f44f450863fb149b64fdd4b74a1/#services"


def mover_raton_humano_y_clic(page, target_x, target_y):
    """Mueve el ratón simulando trayectoria humana con zigzag y desviación suave."""
    try:
        x_inicio = random.randint(80, 250)
        y_inicio = random.randint(80, 250)
        page.mouse.move(x_inicio, y_inicio)
        time.sleep(0.06)

        pasos = random.randint(10, 15)
        for i in range(pasos):
            t = (i + 1) / pasos
            desviacion_x = random.randint(-10, 10) * (1 - t)
            desviacion_y = random.randint(-10, 10) * (1 - t)
            curr_x = x_inicio + (target_x - x_inicio) * t + desviacion_x
            curr_y = y_inicio + (target_y - y_inicio) * t + desviacion_y
            page.mouse.move(curr_x, curr_y)
            time.sleep(random.uniform(0.01, 0.02))

        page.mouse.move(target_x, target_y)
        time.sleep(random.uniform(0.2, 0.35))
        page.mouse.down()
        time.sleep(random.uniform(0.09, 0.14))
        page.mouse.up()
        return True
    except Exception:
        return False


def _superar_cloudflare(page, log_fn):
    """Supera Cloudflare Turnstile mediante detección multietapa."""
    for intento in range(4):
        content = page.content()
        titulo = page.title()

        if "Verificación de seguridad" not in content and "Un momento" not in titulo:
            return True

        log_fn(f"   [CLOUDFLARE] Intento {intento+1}/4: Localizando casilla de verificación...")
        time.sleep(random.uniform(2.0, 3.0))

        try:
            stage = page.locator("#challenge-stage, div.cf-turnstile, #turnstile-wrapper")
            if stage.count() > 0:
                box = stage.first.bounding_box()
                if box and box["width"] > 0:
                    target_x = box["x"] + 28
                    target_y = box["y"] + min(box["height"] / 2, 32)
                    mover_raton_humano_y_clic(page, target_x, target_y)
                    time.sleep(3.5)
                    if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                        log_fn("   [OK] Cloudflare resuelto automáticamente.")
                        return True
        except Exception:
            pass

        try:
            for frame in page.frames:
                if any(k in frame.url for k in ["cloudflare", "turnstile", "challenges"]):
                    frame.locator("body").click(position={"x": 28, "y": 30}, timeout=2000)
                    time.sleep(3.5)
                    if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                        log_fn("   [OK] Cloudflare resuelto automáticamente.")
                        return True
                    break
        except Exception:
            pass

    if "Verificación de seguridad" in page.content() or "Un momento" in page.title():
        log_fn("   >> [ACCIÓN REQUERIDA]: Por favor, marca la casilla 'Verifique que es un ser humano' en la ventana...")
        for _ in range(60):
            time.sleep(1.0)
            if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                log_fn("   [OK] Cloudflare superado. Sesión de confianza guardada.")
                time.sleep(2.0)
                return True
        return False

    return True


def _superar_popup_bienvenida(page, log_fn):
    """Paso 2: Detecta y hace clic en [ Aceptar ] si el popup modal está visible."""
    try:
        page.on("dialog", lambda dialog: dialog.accept())

        for _ in range(3):
            modal_aceptar = page.locator("text=Aceptar, text=Accept, button:has-text('Aceptar'), .modal button, .bkt-dialog button")
            if modal_aceptar.count() > 0 and modal_aceptar.first.is_visible():
                log_fn("   [PASO 2] Popup 'Welcome / Bienvenido' visible. Pulsando [ Aceptar ]...")
                box = modal_aceptar.first.bounding_box()
                if box:
                    mover_raton_humano_y_clic(page, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                modal_aceptar.first.click(force=True)
                time.sleep(random.uniform(2.0, 3.0))
                return True
            time.sleep(0.8)
    except Exception as e:
        log_fn(f"   [POPUP] Nota: {e}")
    return False


def _superar_pantalla_continuar(page, log_fn):
    """Paso 3: Detecta y pulsa el botón verde [ Continue / Continuar ] hasta su desaparición."""
    try:
        boton_locator = page.locator("button:has-text('Continuar'), button:has-text('Continue'), a:has-text('Continuar'), .btn-success, [class*='btn']:has-text('Continu')")

        for ciclo in range(6):
            time.sleep(1.0)
            if boton_locator.count() > 0 and boton_locator.first.is_visible():
                log_fn(f"   [PASO 3] Botón verde [ Continue / Continuar ] visible. Pulsando (Intento {ciclo+1})...")
                box = boton_locator.first.bounding_box()
                if box and box["width"] > 0:
                    mover_raton_humano_y_clic(page, box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                try:
                    boton_locator.first.dispatch_event("click")
                    boton_locator.first.click(force=True)
                except Exception:
                    pass
                time.sleep(3.0)
            else:
                return True
        return True
    except Exception as e:
        log_fn(f"   [CONTINUAR] Error: {e}")
        return False


def _extraer_radiografia_por_meses(page):
    """
    Abre el datepicker y extrae de forma agrupada por MESES todos los días habilitados.
    """
    mapa_meses = {}
    dias_totales = []

    try:
        btn_dp = page.locator("#idDivBktDatetimeDatePickerContent, #idDivBktDatetimeDatePickerText, #idDivBktDatetimeDatePickerIcon")
        if btn_dp.count() > 0:
            btn_dp.first.click(force=True)
            time.sleep(1.5)

        for _ in range(3):
            info_mes = page.evaluate("""() => {
                const mesEl = document.querySelector('.ui-datepicker-title, .ui-datepicker-month, .header-month');
                const mesTxt = mesEl ? mesEl.innerText.replace(/\\s+/g, ' ').trim() : '';

                const diasVerdes = [];
                document.querySelectorAll('.ui-datepicker-calendar td:not(.ui-datepicker-unselectable), .ui-datepicker-calendar [data-handler="selectDay"]').forEach(td => {
                    const a = td.querySelector('a');
                    const num = a ? a.innerText.trim() : td.innerText.trim();
                    if (num && !isNaN(num)) {
                        diasVerdes.push(num);
                    }
                });

                return {
                    mes_titulo: mesTxt,
                    dias: diasVerdes
                };
            }""")

            mes_titulo = info_mes.get("mes_titulo", "").upper()
            dias_mes = info_mes.get("dias", [])

            if mes_titulo:
                if dias_mes:
                    mapa_meses[mes_titulo] = {
                        "dias": dias_mes,
                        "total_dias": len(dias_mes),
                        "abierto": True
                    }
                    for dia_num in dias_mes:
                        txt_fecha = f"{dia_num} de {mes_titulo}".strip()
                        dt_obj = parsear_fecha_texto(txt_fecha)
                        dias_totales.append({
                            "dia": dia_num,
                            "mes_titulo": mes_titulo,
                            "fecha_texto": txt_fecha,
                            "fecha_dt": dt_obj
                        })
                else:
                    mapa_meses[mes_titulo] = {
                        "dias": [],
                        "total_dias": 0,
                        "abierto": False
                    }

            next_btn = page.locator("a.ui-datepicker-next:not(.ui-state-disabled)")
            if next_btn.count() > 0 and next_btn.first.is_visible():
                next_btn.first.click(force=True)
                time.sleep(0.8)
            else:
                break

    except Exception:
        pass

    return mapa_meses, dias_totales


def verificar_citas_san_francisco(page, config, log_fn=print):
    """
    Función principal de escaneo para San Francisco LMD con Radiografía Multi-Mes.
    Retorna: (hay_citas: bool, resumen_general: str, info_slots: dict)
    """
    log_fn("\n[RADAR] Escaneando: SAN FRANCISCO (LMD)...")

    try:
        if page.url.startswith("https://www.citaconsular.es"):
            log_fn("   🔄 [RECARGA VIVA] Actualizando disponibilidad del servidor consular...")
            page.reload(wait_until="domcontentloaded")
        else:
            page.goto(URL_SAN_FRANCISCO_LMD, wait_until="domcontentloaded")

        time.sleep(random.uniform(2.5, 3.5))

        # Paso 1: Superar Cloudflare Turnstile
        if not _superar_cloudflare(page, log_fn):
            log_fn("   [AVISO] San Francisco bloqueado por Cloudflare.")
            return False, "", {}

        time.sleep(random.uniform(1.5, 2.5))

        # Paso 2: Superar Popup 'Welcome / Bienvenido'
        _superar_popup_bienvenida(page, log_fn)

        # Paso 3: Superar Pantalla 'Continue / Continuar'
        _superar_pantalla_continuar(page, log_fn)

        time.sleep(random.uniform(2.5, 3.5))
        texto_visible = page.locator("body").inner_text()
        texto_lower = texto_visible.lower()

        # Paso 4: Evaluar Disponibilidad Real
        sin_citas_sf = (
            "no hay horas disponibles" in texto_lower or
            "inténtelo de nuevo dentro de unos días" in texto_lower or
            "intentelo de nuevo" in texto_lower or
            "no hay citas disponibles" in texto_lower or
            "no availability" in texto_lower or
            "agenda completa" in texto_lower
        )

        slots_visibles = page.locator("a[href*='selecttime'], .clsDivDatetimeSlot, .slot, .hour-item, [class*='slot-available']")
        num_slots = 0
        horas_detectadas = []
        elementos_slots = []
        
        if slots_visibles.count() > 0:
            for s in range(slots_visibles.count()):
                slot_el = slots_visibles.nth(s)
                if slot_el.is_visible():
                    num_slots += 1
                    txt_slot = slot_el.inner_text().replace('\n', ' ').strip()
                    if txt_slot:
                        horas_detectadas.append(txt_slot)
                        elementos_slots.append({
                            "texto": txt_slot,
                            "index": s,
                            "href": slot_el.get_attribute("href")
                        })

        if num_slots > 0 and not sin_citas_sf:
            fecha_encabezado = ""
            for linea in texto_visible.split('\n'):
                if any(m in linea.lower() for m in ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]):
                    fecha_encabezado = linea.strip()
                    break

            fecha_dt_primer_dia = parsear_fecha_texto(fecha_encabezado)

            # Radiografía Completa por Meses
            mapa_meses, todos_dias_verdes = _extraer_radiografia_por_meses(page)

            h_primero = horas_detectadas[0] if horas_detectadas else ""
            h_ultimo = horas_detectadas[-1] if horas_detectadas else ""
            franja_horaria_str = f"{h_primero} a {h_ultimo}" if (h_primero and h_ultimo and h_primero != h_ultimo) else h_primero

            resumen_general = f"{len(todos_dias_verdes)} días habilitados en {len(mapa_meses)} meses"

            info_slots = {
                "consulado": "SAN FRANCISCO",
                "fecha_texto": fecha_encabezado,
                "fecha_dt": fecha_dt_primer_dia,
                "total_slots": num_slots,
                "horas": horas_detectadas,
                "franja_horaria": franja_horaria_str,
                "slots_detalle": elementos_slots,
                "mapa_meses": mapa_meses,
                "dias_totales": todos_dias_verdes
            }

            log_fn(f"   [ALERTA CRITICA] CITAS LIBRES EN SAN FRANCISCO LMD ({len(todos_dias_verdes)} días detectados).")
            return True, resumen_general, info_slots

        if sin_citas_sf or num_slots == 0:
            log_fn("   [i] San Francisco LMD: Sin horas disponibles en este momento (Agenda completa).")
            return False, "", {}

        return False, "", {}

    except Exception as e:
        log_fn(f"   [!] Excepción al escanear San Francisco: {e}")
        return False, "", {}


def inyectar_cita_san_francisco(page, slot_info, candidato, log_fn=print):
    """Inyecta automáticamente la selección de hora y las credenciales del cliente en San Francisco."""
    try:
        log_fn(f"\n   🎯 [AUTO-ASIGNACIÓN] Seleccionando hueco: '{slot_info.get('texto')}'...")
        if slot_info.get("href"):
            page.locator(f"a[href='{slot_info['href']}']").first.click(force=True)
        else:
            page.locator("a[href*='selecttime'], .clsDivDatetimeSlot").first.click(force=True)
        
        time.sleep(3.0)

        usuario = candidato.get("usuarioConsular", "")
        password = candidato.get("passwordConsular", "")
        log_fn(f"   🔑 Inyectando credenciales de {candidato.get('nombreCompleto')} (ID: {usuario})...")

        campo_usr = page.locator("#idIptBktSignInlogin, input[name='login'], input[placeholder*='ID'], input[type='text']")
        if campo_usr.count() > 0:
            campo_usr.first.fill(usuario)

        campo_pwd = page.locator("#idIptBktSignInpassword, input[name='password'], input[type='password']")
        if campo_pwd.count() > 0:
            campo_pwd.first.fill(password)

        time.sleep(1.0)
        log_fn(f"   ✅ [LISTO] Credenciales inyectadas en pantalla para {candidato.get('nombreCompleto')} (San Francisco).")
        return True

    except Exception as e:
        log_fn(f"   [!] Error al inyectar credenciales en San Francisco: {e}")
        return False
