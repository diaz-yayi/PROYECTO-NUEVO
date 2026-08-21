# CHECKPOINT 40: BLINDAJE DE SEGURIDAD — ELIMINACIÓN DE BACKDOORS Y SECRETOS EXPUESTOS

**Fecha:** 20-21/08/2026
**Origen:** Auditoría completa de arquitectura, seguridad, base de datos, DevOps, QA y coherencia de código (20/08/2026).
**Estado:** Implementado y verificado en producción (parcialmente) — ver sección 5, pendientes.

---

## 1. OBJETIVO DEL CHECKPOINT

Cerrar los hallazgos **críticos** y parte de los **altos** de la auditoría de seguridad: tres backdoors de autenticación activos, secretos reales de producción hardcodeados y versionables en el repositorio, y fallbacks silenciosos que enmascaraban fallos reales de infraestructura.

---

## 2. CAMBIOS IMPLEMENTADOS Y DETALLES TÉCNICOS

### A. Higiene del repositorio
- **`.gitignore`** creado en la raíz del proyecto (no existía — el repositorio tenía 0 commits). Excluye `rcc_robot/venv/` (~1.1 GB), perfiles de Chrome (`perfil_chrome*/`, con cookies/credenciales de sesión reales), `__pycache__/`, capturas de depuración (`rcc_robot/*.png`), datos reales de clientes (`*.xlsx`), `portal_web_lmd.zip`, archivos de secretos (`config.secrets.php`) y scripts de diagnóstico temporal (`_verificar_*_temporal.php`).

### B. Eliminación de 3 backdoors de autenticación
1. **`portal_web_lmd/api/auth/login.php`** — eliminados dos bloques que permitían entrar como admin con contraseñas literales (`EM_Admin_2026!`, `Aristeo2026!`) saltándose por completo la verificación Bcrypt, incluso con la base de datos disponible.
2. **`portal_web_lmd/db/schema.sql`** — el hash Bcrypt sembrado para el usuario admin era inválido (no correspondía a ninguna contraseña real conocida, confirmado con `password_verify()`); reemplazado por un hash real, generado y auto-verificado, funcionalmente equivalente a la contraseña real ya activa en producción.
3. **`portal_web_lmd/js/api.js`** — eliminado el bypass de "contraseña mágica" (`EM_Admin_2026!`/`EM_Operador_2026!`) del simulador offline de desarrollo local (`fallbackLocalDevelopment`), que permitía entrar como admin con cualquier email desconocido.

### C. Mecanismo de secretos fuera de código
- **`portal_web_lmd/config.php`** — refactorizado con la función `env_or_secret()`: prioridad variable de entorno real → `config.secrets.php` → fallo seguro (ya no existe fallback hardcodeado con valores reales). Si faltan secretos críticos, responde `HTTP 500` genérico al cliente y registra el detalle exacto solo en el log interno del servidor.
- **`portal_web_lmd/config.secrets.php`** (nuevo, excluido de git) — contiene los secretos reales de producción; vive únicamente en el servidor, subido manualmente.
- **`portal_web_lmd/config.secrets.example.php`** (nuevo, sí versionado) — plantilla documentando las claves esperadas, sin valores reales.
- **`portal_web_lmd/.htaccess`** — bloqueo HTTP directo añadido para `config.secrets.php` y su plantilla, igual que ya protegía a `config.php`.
- Constantes `MASTER_FALLBACK_EMAIL`/`MASTER_FALLBACK_HASH` (sin ningún uso real en el código) eliminadas de `config.php`.

### D. Rotación de credenciales de producción
- **`JWT_SECRET_KEY`** rotado (21/08/2026) — invalidó todas las sesiones activas de forma controlada; sin pérdida de datos.
- **`DB_PASS`** de MySQL rotado (21/08/2026) — cambiado en cPanel para el usuario `v237734_bd_lmd` y sincronizado en `config.secrets.php`. Verificado con prueba negativa (contraseña vieja rechazada) antes de confirmar la positiva.
- **`PALABRA_SECRETA`** y **`WEB_APP_URL`** migrados de `const` hardcodeado a `PropertiesService.getScriptProperties()` en `01_Configuracion.txt` y en el Apps Script real — mismo valor que antes, sin rotar (ver pendiente D.1 en sección 5).

### E. Separación de entornos local / producción
- **`docker-compose.yml`** — `JWT_SECRET_KEY` de desarrollo local ahora es un valor exclusivo, distinto al de producción (antes eran idénticos). `GAS_WEBAPP_URL`/`GAS_SECRET_TOKEN` eliminados de este archivo versionado — Docker los toma ahora de `config.secrets.php` (no hay forma de tener valores "solo de desarrollo" para estos dos, ya que solo existe un Apps Script real).

### F. Fallbacks silenciosos corregidos
- **`portal_web_lmd/api/logs/security.php`** y **`portal_web_lmd/api/users/index.php`** — cuando MySQL no responde, ahora devuelven un error honesto (`503` sin conexión / `500` en fallo de consulta) en vez de datos inventados que aparentaban normalidad (un log de "login exitoso" falso, un usuario "admin" falso). El mensaje de la excepción ya no se expone al cliente, solo al log interno.

---

## 3. VERIFICACIÓN REALIZADA

- Cada cambio se probó primero en **aislamiento** (contenedores PHP efímeros sin variables de entorno, simulando exactamente las condiciones de SERED) antes de tocar producción.
- Regresión confirmada en el entorno Docker local tras cada cambio.
- Confirmación directa del usuario en producción real (`app.lmd2022.com`) para: login con contraseña real, invalidación de sesión tras rotar JWT, rotación de `DB_PASS`, listado de usuarios, auditoría de seguridad, y migración de `PALABRA_SECRETA`/`WEB_APP_URL`.
- Simulación de caída de MySQL (contenedor detenido y reiniciado deliberadamente) para confirmar el nuevo comportamiento de error honesto en `security.php`/`users/index.php`.

---

## 4. NOTAS Y RIESGOS ABIERTOS

1. **Versión de caché no incrementada:** se modificó `js/api.js`, pero `index.html` lo sigue sirviendo con `?v=6.5.8` (sin cambios). Navegadores con el archivo ya cacheado podrían tardar en recibir la versión corregida. Recomendado subir el número de versión de cache-busting en el próximo despliegue de frontend.
2. **Archivos de memoria de subagentes:** durante la auditoría inicial, 3 subagentes (`seguridad-auditor`, `devops-hosting`, `code-reviewer`) escribieron archivos en `.claude/agent-memory/` pese a la instrucción de solo lectura. Siguen ahí — pendiente decisión del usuario sobre conservarlos o eliminarlos.
3. Los scripts de diagnóstico temporal (`_verificar_env_temporal.php`, `_verificar_secrets_temporal.php`) fueron creados, usados y confirmados **borrados del servidor de producción** por el usuario.
4. El branding "Estela Marina / EM" presente en textos visibles y comentarios fue investigado y **confirmado como correcto e intencional** (no es residuo de plantilla) — hallazgo cerrado sin cambios.

---

## 5. PENDIENTE — NO ABORDADO EN ESTE CHECKPOINT

### Diferido a propósito (decisión del usuario)
- **Rotar el valor real de `PALABRA_SECRETA`**: ahora que vive en Properties, rotarla ya no requiere tocar código — pero se pospuso porque invalidaría enlaces de email (`enlaceBaja`) ya enviados a clientes reales que aún no los hayan abierto (`generarToken()` en `05_WebApp_Apoyo.txt` + `04_MotorEnvios.txt`).
- **Token de Telegram hardcodeado** en `rcc_robot/config_citas.json` y `config_visados.json` — se decidió dejarlo así por ahora.

### Fase 2 del plan original (Alto) — sin empezar
- Falta `requireRole()` en `api/configuracion.php`, `api/automatizaciones.php` y el POST de `api/expedientes.php` — cualquier usuario autenticado (incluido el rol `consultor`, documentado como solo-lectura) podría modificar configuración global o disparar envíos masivos.
- Auditoría de acciones rota: el código busca el autor en una clave del JWT que no existe (`usuarioEditor`/`usuarioEjecutor`) y siempre registra `'admin'`, sin trazabilidad real del usuario que hizo la acción.
- JWT guardado en `localStorage` (expuesto a XSS) + cabecera CORS `Access-Control-Allow-Origin: *` en todos los endpoints PHP.
- `portal_web_lmd/js/app.js` — archivo de 2180 líneas, código muerto (no lo carga `index.html`), con 18 `alert()` y un `state`/`setBotonCargando` duplicados. Pendiente decidir si se borra.
- Robots de La Habana/RCC (`rcc_robot/`) detectan éxito/fracaso por coincidencia de texto/HTML contra los sitios oficiales — si cambia la estructura de esos sitios, fallan silenciosamente sin alerta diferenciada.

### Fase 3 del plan original (Medio) — sin empezar
- `$e->getMessage()` todavía expuesto al cliente en `api/users/create.php`, `update.php` y `delete.php` (ya corregido hoy en `index.php` y `logs/security.php`, pero no en estos tres).
- `logs/security.php` sigue ejecutando `CREATE TABLE IF NOT EXISTS` en cada petición GET — redundante con `schema.sql`, riesgo de divergencia de esquema si se corrige en un solo sitio.
- Borrado físico de usuarios sin soft-delete ni respaldo previo (`api/users/delete.php`).
- `setBotonCargando` sigue reimplementado de forma ad-hoc en `lockScreen.js`, `loginView.js` y `configuracionView.js` en vez de usar la función compartida única.
- Lógica duplicada entre el flujo síncrono (`05_WebApp_Apoyo.txt`) y los módulos batch (`09_VerificadorConsular.txt`, `03_TrabajadorNocturno.txt`, `04_MotorEnvios.txt`).
- `portal_web_lmd.zip` se sigue manteniendo como copia manual paralela a la carpeta fuente, sin proceso de build automatizado.
- Bootstrap único de Google Sheets (todo en una sola llamada, sin paginación) — cuello de botella a medida que crezca el volumen de expedientes.
- "Modo Prueba" (`MODO_PRUEBA`) no tiene ninguna prueba automatizada que confirme que efectivamente bloquea el envío real de correos.

### Fase 4 del plan original (Bajo) — sin empezar
- Agrupar los `Modal_*.txt` sueltos en la raíz en una carpeta propia (confirmado que están en uso activo, solo es orden).
- Sin backups automatizados ni rotación de logs documentados.
- Imágenes Docker sin pin de versión exacta (`mysql:8.0`, `phpmyadmin:latest`).

---

*Este checkpoint documenta exclusivamente la ronda de blindaje de seguridad del 20-21/08/2026. Para el resto de la arquitectura y reglas del sistema, ver `ARQUITECTURA_Y_REGLAS_PORTAL_LMD.md`.*
