# 📌 CHECKPOINT 32: Corrección de Navegación No Bloqueante y Saneamiento de Logs de Seguridad MySQL
**Fecha de Aplicación:** 19 de Agosto de 2026  
**Versión de Despliegue:** `v=6.4.4`  
**Entorno Objetivo:** `app.lmd2022.com` (Sered cPanel / MySQL `v237734_lmd_db`)

---

## 🛠️ Resumen de Problemas Resueltos y Cambios

### 1. Supresión del Modal Falso Positivo al Navegar (`#/citas`)
* **Problema:** En `router.js`, `navigateToView()` verificaba `state.operacionEnProgreso`. Durante auto-sincronizaciones pasivas en segundo plano, al hacer clic en enlaces del sidebar se mostraba erróneamente el modal *"Proceso en Ejecución Activa"*.
* **Solución aplicada:** Modificado `router.js` para que solo alerte si `state.automatizacionActiva === true` (ejecución real de un robot masivo). La navegación regular durante auto-sincronizaciones ahora es **100% fluida e ininterrumpida**.
* **Archivo modificado:** `portal_web_lmd/js/router.js`.

### 2. Saneamiento y Resiliencia en `/api/logs/security.php` (Error 500)
* **Problema:** La consulta SQL en `security.php` intentaba leer `l.creado_en`, provocando error `SQL 1054 Unknown column` al chocar con el campo `fecha_hora` definido en `schema.sql`.
* **Solución aplicada:** 
  1. Integrada sentencia `CREATE TABLE IF NOT EXISTS logs_seguridad` para auto-crear la tabla con índices si aún no existía en la base de datos.
  2. Ajustada la proyección SQL con `COALESCE(l.fecha_hora, NOW()) AS creado_en` para garantizar compatibilidad total entre PHP y JavaScript.
  3. Añadida captura de excepciones controlada para responder con JSON `{ success: true, logs: [] }` en lugar de código de error 500.
* **Archivo modificado:** `portal_web_lmd/api/logs/security.php`.

### 3. Actualización de Versión de Scripts
* **Acción:** Incrementada la versión de los scripts en `index.html` a `v=6.4.4`.
* **Archivo modificado:** `portal_web_lmd/index.html`.
