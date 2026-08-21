# 📌 CHECKPOINT 34: Dinamización de Sedes, Filtros de España y Depuración del Radar de Citas
**Fecha de Aplicación:** 19 de Agosto de 2026  
**Versión de Despliegue:** `v=6.4.7`  
**Entorno Objetivo:** `app.lmd2022.com` (Sered cPanel / Google Apps Script)

---

## 🛠️ Resumen de Mejoras y Ajustes Realizados

### 1. Depuración del Radar de Citas Consulares (`view-citas`)
* **Corrección Conceptual de Etiquetas:**
  - Se corrigió la opción del selector de alcance de `⚡ Listos para Robot RCC (9 casos)` a `⚡ Listos para Robot de Citas (Con credenciales)`.
* **Cero Hardcoding en Selector de Consulados:**
  - Se eliminaron las opciones estáticas del HTML. Ahora la función `actualizarOpcionesConsuladosCitas()` genera dinámicamente las opciones basándose exclusivamente en los consulados con candidatos activos (> 0 casos) en espera de cita.
* **Exclusión de Citas ya Programadas:**
  - Se protegió tanto en el frontend (`citasView.js`) como en el backend de GAS (`05_WebApp_Apoyo.txt`) para que cualquier expediente con `"CITA PROGRAMADA"` o fecha asignada quede excluido de la cola de búsqueda del robot.

### 2. Dinamización y Agrupación de Sedes en Expedientes (`view-expedientes`)
* **Clasificación Estructurada (`Data_Mapping` y `Data_prep`):**
  - La función `actualizarOpcionesConsuladosExpedientes()` agrupa de forma dinámica y elegante:
    1. `🇪🇸 Registros Civiles (España)` (conteo real > 0 de sedes en territorio español).
    2. `🌎 Consulados Internacionales` (conteo real > 0 de sedes consulares en el exterior).

### 3. Sincronización Automática en Rutas (`router.js` y `main.js`)
* Al cambiar de vista o sincronizar datos con Google Workspace, los selectores de sedes y consulados se recalculan automáticamente sin requerir recargas de página.
