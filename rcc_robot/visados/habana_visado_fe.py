# -*- coding: utf-8 -*-
"""
=============================================================================
CONTROLADOR ESPECIALIZADO: LA HABANA — VISADO FAMILIAR DE ESPAÑOL / UE (V5)
=============================================================================
Flujo:
  1. Recarga en vivo (Live Reload) de datos frescos del Consulado de La Habana (Visados).
  2. Puerta Cloudflare Turnstile con trayectoria humana.
  3. Botón verde [ Continue / Continuar ].
  4. Evaluación de Disponibilidad:
     - Si indica 'No hay horas disponibles', lo reporta limpiamente.
     - Si abre Calendario (#datetime), extrae la Radiografía Multi-Mes y franjas horarias.
  5. Inyección asistida de credenciales y formalización de cita.
=============================================================================
"""

import time
import random
from motor_preferencias import parsear_fecha_texto

URL_HABANA_VISADO_FE = "https://www.citaconsular.es/es/hosteds/widgetdefault/2686d3b68dc9e0db0ba3c6a20437e9cc7"


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
    """Supera Cloudflare Turnstile mediante detección multietapa protegida."""
    for intento in range(4):
        try:
            content = page.content()
            titulo = page.title()
        except Exception:
            time.sleep(1.5)
            try:
                content = page.content()
                titulo = page.title()
            except Exception:
                content = ""
                titulo = ""

        if content and "Verificación de seguridad" not in content and "Un momento" not in titulo:
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
                    try:
                        if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                            log_fn("   [OK] Cloudflare resuelto automáticamente.")
                            return True
                    except Exception:
                        pass
        except Exception:
            pass

        try:
            for frame in page.frames:
                if any(k in frame.url for k in ["cloudflare", "turnstile", "challenges"]):
                    frame.locator("body").click(position={"x": 28, "y": 30}, timeout=2000)
                    time.sleep(3.5)
                    try:
                        if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                            log_fn("   [OK] Cloudflare resuelto automáticamente.")
                            return True
                    except Exception:
                        pass
                    break
        except Exception:
            pass

    try:
        if "Verificación de seguridad" in page.content() or "Un momento" in page.title():
            log_fn("   >> [ACCIÓN REQUERIDA]: Por favor, marca la casilla 'Verifique que es un ser humano' en la ventana...")
            for _ in range(60):
                time.sleep(1.0)
                try:
                    if "Verificación de seguridad" not in page.content() and "Un momento" not in page.title():
                        log_fn("   [OK] Cloudflare superado. Sesión de confianza guardada.")
                        time.sleep(2.0)
                        return True
                except Exception:
                    pass
            return False
    except Exception:
        pass

    return True


def _superar_pantalla_continuar(page, log_fn):
    """Detecta y hace clic en el botón verde [ Continue / Continuar ] hasta que desaparezca."""
    try:
        boton_locator = page.locator("button:has-text('Continuar'), button:has-text('Continue'), a:has-text('Continuar'), .btn-success, [class*='btn']:has-text('Continu')")

        for ciclo in range(6):
            time.sleep(1.0)
            if boton_locator.count() > 0 and boton_locator.first.is_visible():
                log_fn(f"   [PASO 2] Botón verde [ Continue / Continuar ] visible. Pulsando (Intento {ciclo+1})...")
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
        log_fn(f"   [CONTINUAR] Nota: {e}")
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


def verificar_citas_habana_visado_fe(page, config, log_fn=print):
    """
    Función principal de escaneo para La Habana (Visado Familiar de Español - V5).
    Retorna: (hay_citas: bool, resumen_general: str, info_slots: dict)
    """
    log_fn("\n[RADAR VISADOS] Escaneando: LA HABANA (Visado Familiar Español V5)...")

    try:
        if page.url.startswith("https://www.citaconsular.es"):
            log_fn("   🔄 [RECARGA VIVA] Actualizando disponibilidad del Consulado de La Habana (Visados)...")
            page.reload(wait_until="domcontentloaded")
        else:
            page.goto(URL_HABANA_VISADO_FE, wait_until="domcontentloaded")

        time.sleep(random.uniform(2.5, 3.5))

        # Paso 1: Superar Cloudflare Turnstile
        if not _superar_cloudflare(page, log_fn):
            log_fn("   [AVISO] La Habana (Visados) bloqueado por Cloudflare.")
            return False, "", {}

        time.sleep(random.uniform(1.5, 2.5))

        # Paso 2: Superar Pantalla [ Continue / Continuar ]
        _superar_pantalla_continuar(page, log_fn)

        time.sleep(random.uniform(2.5, 3.5))
        try:
            texto_visible = page.locator("body").inner_text()
        except Exception:
            time.sleep(1.0)
            texto_visible = page.locator("body").inner_text()

        texto_lower = texto_visible.lower()

        # Paso 3: Evaluar Disponibilidad Real
        sin_citas_visados = (
            "no hay horas disponibles" in texto_lower or
            "no hay citas disponibles" in texto_lower or
            "agenda completa" in texto_lower or
            "no availability" in texto_lower
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

        if num_slots > 0 and not sin_citas_visados:
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
                "consulado": "LA HABANA (VISADO FAMILIAR ESPAÑOL V5)",
                "fecha_texto": fecha_encabezado,
                "fecha_dt": fecha_dt_primer_dia,
                "total_slots": num_slots,
                "horas": horas_detectadas,
                "franja_horaria": franja_horaria_str,
                "slots_detalle": elementos_slots,
                "mapa_meses": mapa_meses,
                "dias_totales": todos_dias_verdes
            }

            log_fn(f"   [ALERTA CRITICA] CITAS LIBRES EN LA HABANA (VISADO V5) ({len(todos_dias_verdes)} días detectados).")
            return True, resumen_general, info_slots

        if sin_citas_visados or num_slots == 0:
            log_fn("   [i] La Habana (Visado Familiar UE - V5): Sin horas disponibles en este momento (Agenda completa).")
            return False, "", {}

        return False, "", {}

    except Exception as e:
        log_fn(f"   [!] Excepción al escanear Visados La Habana: {e}")
        return False, "", {}


def inyectar_cita_habana_visados(page, slot_info, log_fn=print):
    """Selecciona la hora de la cita para el trámite de Visados."""
    try:
        log_fn(f"\n   🎯 [AUTO-ASIGNACIÓN] Seleccionando hueco: '{slot_info.get('texto')}'...")
        if slot_info.get("href"):
            page.locator(f"a[href='{slot_info['href']}']").first.click(force=True)
        else:
            page.locator("a[href*='selecttime'], .clsDivDatetimeSlot").first.click(force=True)
        
        time.sleep(3.0)
        log_fn("   ✅ [LISTO] Hora seleccionada en pantalla para Visado Familiar.")
        return True

    except Exception as e:
        log_fn(f"   [!] Error al seleccionar hora en Visados: {e}")
        return False
