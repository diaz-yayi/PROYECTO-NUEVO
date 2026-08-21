# -*- coding: utf-8 -*-
"""
=============================================================================
MOTOR UNIVERSAL DE PREFERENCIAS DE FECHAS Y HORAS LMD (v4.0 CLASIFICACIÓN JERÁRQUICA)
=============================================================================
Analiza cadenas de texto en lenguaje natural y formatos estructurados
para determinar la compatibilidad con todas las fechas y horas disponibles.
=============================================================================
"""

import re
from datetime import datetime

DIAS_SEMANA_MAP = {
    'LUNES': 0, 'LUN': 0,
    'MARTES': 1, 'MAR': 1,
    'MIERCOLES': 2, 'MIÉRCOLES': 2, 'MIE': 2, 'MIÉ': 2,
    'JUEVES': 3, 'JUE': 3,
    'VIERNES': 4, 'VIE': 4,
    'SABADO': 5, 'SÁBADO': 5, 'SAB': 5,
    'DOMINGO': 6, 'DOM': 6
}

MESES_MAP = {
    'ENERO': 1, 'FEB': 2, 'FEBRERO': 2, 'MARZO': 3, 'MAR': 3,
    'ABRIL': 4, 'ABR': 4, 'MAYO': 5, 'MAY': 5, 'JUNIO': 6, 'JUN': 6,
    'JULIO': 7, 'JUL': 7, 'AGOSTO': 8, 'AGO': 8, 'SEPTIEMBRE': 9, 'SEP': 9, 'SET': 9,
    'OCTUBRE': 10, 'OCT': 10, 'NOVIEMBRE': 11, 'NOV': 11, 'DICIEMBRE': 12, 'DIC': 12
}


def _limpiar_texto(txt):
    if not txt:
        return ""
    t = txt.upper().strip()
    t = re.sub(r'\s+', ' ', t)
    return t


def parsear_hora_minutos(hora_str):
    """Convierte cadenas como '13:20', '09:00', '14.00' a minutos desde las 00:00."""
    if not hora_str:
        return None
    m = re.search(r'(\d{1,2})[:.](\d{2})', str(hora_str))
    if m:
        h = int(m.group(1))
        mins = int(m.group(2))
        return h * 60 + mins
    return None


def parsear_fecha_texto(fecha_texto):
    """
    Convierte una fecha en texto a un objeto datetime.
    Soporta: '16/09/2026', '16-11-2026', '16 de Septiembre 2026', 'Miércoles 16 de Septiembre de 2026'
    """
    if not fecha_texto:
        return None
    
    txt = _limpiar_texto(fecha_texto)
    
    # 1. Formato numérico DD/MM/YYYY o DD-MM-YYYY
    m_num = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})', txt)
    if m_num:
        dia = int(m_num.group(1))
        mes = int(m_num.group(2))
        anio = int(m_num.group(3))
        if anio < 100:
            anio += 2000
        try:
            return datetime(anio, mes, dia)
        except Exception:
            pass

    # 2. Formato natural: '16 DE SEPTIEMBRE DE 2026' o '16 DE SEPTIEMBRE'
    for nombre_mes, num_mes in MESES_MAP.items():
        if nombre_mes in txt:
            m_dia = re.search(r'(\d{1,2})\s+(?:DE\s+)?' + nombre_mes, txt)
            if m_dia:
                dia = int(m_dia.group(1))
                m_anio = re.search(r'(202\d)', txt)
                anio = int(m_anio.group(1)) if m_anio else datetime.now().year
                try:
                    return datetime(anio, num_mes, dia)
                except Exception:
                    pass
    return None


def coincide_preferencia(fecha_dt, hora_str, texto_preferencia):
    """
    Evalúa si una fecha y hora consular coinciden con la preferencia del cliente.
    """
    pref = _limpiar_texto(texto_preferencia)
    
    # 1. Caso genérico / Abierto
    if not pref or pref in ["CUALQUIER FECHA", "CUALQUIERA", "LO ANTES POSIBLE", "ASAP", "INMEDIATA", "DEFAULT"]:
        return True

    # 2. Evaluación de Fecha Específica Exacta (ej: '16/11/2026 09:00 - 10:00')
    m_fecha_exacta = re.search(r'(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})', pref)
    if m_fecha_exacta and fecha_dt:
        fecha_obj_pref = parsear_fecha_texto(m_fecha_exacta.group(1))
        if fecha_obj_pref and (fecha_dt.year != fecha_obj_pref.year or fecha_dt.month != fecha_obj_pref.month or fecha_dt.day != fecha_obj_pref.day):
            return False

    # 3. Evaluación de Días de la Semana (ej: 'LUNES - MIÉRCOLES', 'SOLO VIERNES')
    m_rango_dias = re.search(r'(LUNES|MARTES|MIÉRCOLES|MIERCOLES|JUEVES|VIERNES)\s*[-A]\s*(LUNES|MARTES|MIÉRCOLES|MIERCOLES|JUEVES|VIERNES)', pref)
    if m_rango_dias and fecha_dt:
        d_inicio = DIAS_SEMANA_MAP.get(m_rango_dias.group(1), 0)
        d_fin = DIAS_SEMANA_MAP.get(m_rango_dias.group(2), 4)
        if d_inicio <= d_fin:
            if not (d_inicio <= fecha_dt.weekday() <= d_fin):
                return False
        else:
            if not (fecha_dt.weekday() >= d_inicio or fecha_dt.weekday() <= d_fin):
                return False
    else:
        dias_mencionados = [d_idx for d_name, d_idx in DIAS_SEMANA_MAP.items() if re.search(r'\b' + d_name + r'\b', pref)]
        if dias_mencionados and fecha_dt:
            if fecha_dt.weekday() not in dias_mencionados:
                return False

    # 4. Evaluación de Meses y Rangos
    if fecha_dt and not m_fecha_exacta:
        m_rango_fechas = re.findall(r'(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})', pref)
        if len(m_rango_fechas) >= 2:
            f_ini = parsear_fecha_texto(m_rango_fechas[0])
            f_fin = parsear_fecha_texto(m_rango_fechas[1])
            if f_ini and f_fin:
                if not (f_ini <= fecha_dt <= f_fin):
                    return False

        if "A PARTIR DE" in pref or "DESPUES DE" in pref or "DESPUÉS DE" in pref or "A PARTIR DEL" in pref:
            for m_nombre, m_num in MESES_MAP.items():
                if m_nombre in pref and fecha_dt.month < m_num:
                    return False
            m_fmin = re.search(r'(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})', pref)
            if m_fmin:
                f_min_dt = parsear_fecha_texto(m_fmin.group(1))
                if f_min_dt and fecha_dt < f_min_dt:
                    return False
        else:
            meses_mencionados = [m_num for m_name, m_num in MESES_MAP.items() if re.search(r'\b' + m_name + r'\b', pref) and "A PARTIR" not in pref]
            if meses_mencionados and fecha_dt.month not in meses_mencionados:
                return False

    # 5. Evaluación de Horarios y Franjas
    if hora_str:
        mins_slot = parsear_hora_minutos(hora_str)
        if mins_slot is not None:
            if "MAÑANA" in pref or "MAÑANAS" in pref or "MANANA" in pref:
                if mins_slot >= 720:
                    return False
            
            if "TARDE" in pref or "TARDES" in pref:
                if mins_slot < 720:
                    return False

            m_rango_horas = re.search(r'(\d{1,2}[:.]\d{2})\s*(?:-|A|HASTA)\s*(\d{1,2}[:.]\d{2})', pref)
            if m_rango_horas:
                h_ini = parsear_hora_minutos(m_rango_horas.group(1))
                h_fin = parsear_hora_minutos(m_rango_horas.group(2))
                if h_ini is not None and h_fin is not None:
                    if not (h_ini <= mins_slot <= h_fin):
                        return False

    return True


def clasificar_candidatos_con_mapa_citas(candidatos, info_slots):
    """
    Cruza la lista de candidatos con TODAS las fechas y meses detectados en el consulado.
    """
    compatibles = []
    en_espera = []

    mapa_meses = info_slots.get("mapa_meses", {}) if isinstance(info_slots, dict) else {}
    dias_totales = info_slots.get("dias_totales", []) if isinstance(info_slots, dict) else []
    fecha_dt_primer_dia = info_slots.get("fecha_dt") if isinstance(info_slots, dict) else None
    fecha_texto_primer_dia = info_slots.get("fecha_texto", "")
    slots_primer_dia = info_slots.get("slots_detalle", []) if isinstance(info_slots, dict) else []
    if not slots_primer_dia and isinstance(info_slots, dict):
        slots_primer_dia = [{"texto": h, "href": ""} for h in info_slots.get("horas", [])]

    # Meses abiertos limpios (ej: 'Septiembre, Octubre')
    meses_abiertos = [m.title() for m, datos in mapa_meses.items() if datos.get("abierto", True)]
    if not meses_abiertos:
        meses_abiertos = [fecha_texto_primer_dia] if fecha_texto_primer_dia else ["este ciclo"]
    
    meses_abiertos_str = " y ".join(meses_abiertos) if len(meses_abiertos) <= 2 else (", ".join(meses_abiertos[:-1]) + " y " + meses_abiertos[-1])

    for c in candidatos:
        pref = c.get('preferencia', 'CUALQUIER FECHA')
        match_encontrado = False
        dia_coincidente = None
        slot_elegido = None

        # 1. Comprobar con la vista del primer día
        for s in slots_primer_dia:
            hora_str = s.get("texto", "")
            if coincide_preferencia(fecha_dt_primer_dia, hora_str, pref):
                match_encontrado = True
                dia_coincidente = fecha_texto_primer_dia
                slot_elegido = s
                break

        # 2. Si no coincide con el primer día, evaluar contra todos los días del calendario
        if not match_encontrado and dias_totales:
            for d in dias_totales:
                f_dt = d.get("fecha_dt")
                if f_dt and coincide_preferencia(f_dt, "", pref):
                    match_encontrado = True
                    dia_coincidente = d["fecha_texto"]
                    slot_elegido = {"texto": f"Cita del {d['fecha_texto']}", "href": ""}
                    break

        if match_encontrado:
            if pref in ["CUALQUIER FECHA", "CUALQUIERA", "LO ANTES POSIBLE", "ASAP"]:
                motivo = f"Acepta cualquier fecha (Apto para {meses_abiertos_str})"
            else:
                motivo = f"Coincide con: '{pref}' en {dia_coincidente}"

            compatibles.append({
                "candidato": c,
                "slot": slot_elegido or (slots_primer_dia[0] if slots_primer_dia else {"texto": "Primer hueco", "href": ""}),
                "motivo": motivo
            })
        else:
            motivo_no = f"Pide: '{pref}' (Agenda no abierta aún; Consulado tiene citas para {meses_abiertos_str})"
            en_espera.append({
                "candidato": c,
                "motivo": motivo_no
            })

    return compatibles, en_espera
