# 📌 CHECKPOINT 35: Reorganización de Navegación por Procedimientos y Módulos de Seguimiento La Habana & RCC
**Fecha de Aplicación:** 19 de Agosto de 2026  
**Versión de Despliegue:** `v=6.5.0`  
**Entorno Objetivo:** `app.lmd2022.com` (Sered cPanel / Google Apps Script)

---

## 🛠️ Resumen de Mejoras y Nuevos Módulos

### 1. Reorganización de la Barra Lateral por Procedimientos
* **📊 GESTIÓN GENERAL:**
  - `📊 Dashboard General`
  - `📁 Expedientes LMD`
* **🛰️ SEGUIMIENTO & RADAR:**
  - `🇨🇺 Seguimiento La Habana`
  - `🇪🇸 Seguimiento RCC`
  - `🔑 Radar de Citas`
* **⚡ OPERACIONES & CONTROL:**
  - `⚡ Automatizaciones`
  - `⚙️ Configuración`
  - `🛡️ Auditoría & Bitácora`

### 2. Módulo de Seguimiento La Habana (`view-habana` / `habanaView.js`)
* Conectado a la hoja `VERIFICACION_CONSULAR` con las 13 columnas completas de la API de La Habana (`cgelahabana.es`).
* Filtros por Estado Consular y Buscador Reactivo.
* Exportación a CSV con codificación UTF-8.

### 3. Módulo de Seguimiento RCC España (`view-rcc` / `rccView.js`)
* Conectado a la hoja `VERIFICACION_RCC` con los resultados del robot Playwright del Ministerio de Justicia.
* Filtros por Estado Oficial de Resolución y Buscador Reactivo.
* Exportación a CSV con codificación UTF-8.

### 4. Tarjetas de Diagnóstico en la Ficha del Expediente (`modalExpediente.js`)
* Al abrir cualquier expediente, si cuenta con registros en `VERIFICACION_CONSULAR` o `VERIFICACION_RCC`, se despliega una tarjeta con los datos oficiales (fechas de resolución/inscripción, tomo/página o dictamen del Ministerio).

### 5. Backend GAS Optimizado (`05_WebApp_Apoyo.txt`)
* Inyección de `verificacionesHabana` y `verificacionesRCC` en el Bootstrap Unificado (0 peticiones adicionales).
* Endpoints dedicados `obtener_verificacion_habana` y `obtener_verificacion_rcc`.

### 6. Blindaje del Robot Playwright RCC (`rcc_robot/verificador_rcc.py`)
* **Extracción Fidedigna por Delimitadores:** El estado se extrae de forma literal entre *"siguiente estado:"* y *"La información que el Ministerio..."*, conservando exactamente el texto oficial (ej: *"El expediente está concluido"*).
* **Detección Inmediata del Recuadro Rojo (`bloqueInformativoRojo`):** Detección inmediata de *"No se ha obtenido ningún resultado..."*. En Modo Asistido, recarga automáticamente y prepara la siguiente variante sin intervención del operador.
* **Enfriamiento Inteligente (Modo Autónomo):** Ante bloqueo de audio por Google, pausa de 65–85s con reintentos (hasta 3) sobre el mismo cliente antes de avanzar.
