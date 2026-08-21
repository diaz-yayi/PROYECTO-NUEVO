# 📄 SPEC-01: Optimización Bootstrap (Single-Pass Scan) y Concurrencia de Guardado (Queue-Lock)

---

## 🎯 1. Objetivo Técnico
Reducir el tiempo de carga y sincronización de datos de **60 segundos a 2-3 segundos**, eliminando múltiples lecturas redundantes a Google Sheets y erradicando bloqueos al navegar o guardar mientras se sincroniza en segundo plano.

---

## 🏗️ 2. Arquitectura de Datos: Single-Pass Scan en Google Apps Script

### 2.1 El Problema Previo:
* Endpoint `obtener_todos_expedientes` ➔ 1 lectura de 802 filas (`getRichTextValues()`) ~ 12s.
* Endpoint `obtener_dashboard_kpis` ➔ 2da lectura de 802 filas ~ 10s.
* Endpoint `obtener_citas_candidatos` ➔ 3ra lectura de 802 filas ~ 10s.
* Petición sucesiva en cliente `main.js` ➔ Segunda llamada HTTP a `citas.php` ~ 15s.
* **Total acumulado:** ~50 - 60s.

### 2.2 La Solución (Single-Pass Scan):
En `05_WebApp_Apoyo.txt`, la función `obtener_bootstrap_sistema`:
1. Lee una sola vez `mainSheet.getDataRange().getValues()` y `mainSheet.getDataRange().getRichTextValues()`.
2. Lee una sola vez `credSheet.getDataRange().getValues()`.
3. Lee una sola vez `PropertiesService.getDocumentProperties()`.
4. En **un solo bucle lineal (`for i = 1; i < dataMain.length; i++`)**:
   - Construye el objeto `expedientes`.
   - Acumula los contadores de KPIs (`pendientesResolucion`, `pendientesCita`, `pendientesCredenciales`, `resueltosFavorables`, etc.).
   - Clasifica los candidatos de citas que cumplen el *Triple Candado*.
5. Devuelve un payload JSON unificado completo:
```json
{
  "ok": true,
  "success": true,
  "expedientes": [...],
  "consulados": [...],
  "dashboardKPIs": {...},
  "configSistema": {...},
  "citas": [...],
  "modoPrueba": true
}
```

---

## 🔄 3. Arquitectura de Concurrencia: Queue-Lock en Frontend (`main.js`)

### 3.1 Navegación No Bloqueante:
* Las auto-sincronizaciones pasivas en segundo plano (cada 90s o al recuperar foco) se ejecutan con `silencioso = true`.
* No muestran velos invasivos ni bloquean el cambio de sección mediante hash (`#/dashboard`, `#/expedientes`, `#/citas`, `#/logs`).

### 3.2 Cola de Guardado Asíncrona:
* Si el operador hace clic en "Guardar Ficha" o "Guardar Configuración" mientras hay un `cargarDatosEnVivo` activo:
  1. El guardado no falla ni se interrumpe con errores de red.
  2. Espera de forma asíncrona (`await colaSincronizacion`) a que la lectura termine de actualizar `state.expedientes`.
  3. Ejecuta la mutación `POST` con la versión más fresca de la base de datos, garantizando atomicidad e integridad.
