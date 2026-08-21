# CHECKPOINT 38: COLUMNA ESTADO AVISO EN EXPEDIENTES Y MARCADO AUTOMÁTICO "NO" EN GOOGLE SHEETS

**Fecha:** 19/08/2026  
**Versión del Sistema:** v6.5.7  
**Estado:** Estable y Validado para Producción

---

## 1. OBJETIVO DEL CHECKPOINT

1. Proporcionar visibilidad inmediata del estado de notificación de cada cliente en la tabla de **Expedientes LMD** del Portal Web sin necesidad de abrir modal por modal.
2. Eliminar la ambigüedad de celdas vacías en la **Columna K (NOTIFICADO)** de Google Sheets, asegurando que tanto el **Auditor de Vencimientos** como las rutinas de cambio de estado estampen un `"NO"` explícito para los expedientes calificados para envío.

---

## 2. CAMBIOS IMPLEMENTADOS Y DETALLES TÉCNICOS

### A. Vista Expedientes LMD (`index.html` y `js/views/expedientesView.js`)
1. **Nueva Columna de Cabecera:**
   - Incorporada la columna `<th>Estado Aviso</th>` con ancho óptimo (15%) en la tabla principal de Expedientes.
2. **Función `renderizarCeldaEstadoAviso(c)`:**
   - Renderiza un diagnóstico compacto de dos niveles:
     - 🚫 **Baja:** Badge rojo para desuscritos.
     - ⚠️ **Sin Email:** Badge de advertencia si no tiene correo.
     - 🟢 **Notificado + Fecha:** Badge verde con la fecha del último envío debajo (`SI`).
     - ⏳ **Carencia + Días:** Badge ámbar con el progreso de días (`días transcurridos / carencia legal`).
     - 🚀 **Pendiente (NO):** Badge azul/cian `Listo para envío` para expedientes terminales o con carencia superada listos para despacho.

---

### B. Google Apps Script Backend (`03_TrabajadorNocturno.txt` y `05_WebApp_Apoyo.txt`)
1. **Auditor de Vencimientos (`03_TrabajadorNocturno.txt`):**
   - Cuando la Columna K no tiene `"SI"` (vacía o sin notificar) y el expediente es elegible (estados terminales como `RESUELTO FAVORABLE`, o trámites con carencia superada): estampa explícitamente `"NO"` en la Columna K (`sheet.getRange(i + 1, 11).setValue("NO")`), dejando la hoja perfectamente documentada para operadores humanos.
2. **Cambio de Estado en Portal (`05_WebApp_Apoyo.txt`):**
   - Al registrar una transición de estado en `guardarExpedienteGeneralDesdePortal`, se estampa `"NO"` en la Columna K en lugar de dejar la celda en blanco.

---

### C. Control de Versiones y Despliegue
- Hoja de estilos y scripts actualizados a **`v=6.5.7`** en `index.html`.
- Paquete **`portal_web_lmd.zip`** actualizado y verificado.
