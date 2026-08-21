# 📄 SPEC-02: Centro de Auditoría y Bitácora del Sistema (Exclusivo Administrador)

---

## 🎯 1. Objetivo
Proveer al Administrador de la plataforma de una consola de auditoría integral y trazabilidad forense que consolide:
1. Las operaciones automáticas y robots ejecutados sobre Google Sheets (`LOGS_SISTEMA`).
2. Los eventos de seguridad, inicios de sesión y gestión de accesos de MySQL (`logs_seguridad`).

---

## 🔐 2. Control de Acceso (RBAC)
* Visible única y exclusivamente para usuarios con rol `admin`.
* El botón `🛡️ Auditoría & Logs` en el sidebar está protegido por `.admin-only`.
* El enrutador `router.js` valida `rolePermissions['admin']`. Todo intento de acceso no autorizado redirige a `#/dashboard`.

---

## 📋 3. Estructura de Pestañas y Componentes

### 3.1 Pestaña 1: Operaciones y Robots (Google Sheets)
* **Origen de Datos:** Endpoint `obtener_logs_sistema` leyendo las últimas 200 filas de la hoja `LOGS_SISTEMA`.
* **Columnas:**
  - `Fecha y Hora`: Formato `DD/MM/AAAA HH:mm:ss`.
  - `ID Expediente`: Identificador único (`I1`, `I2`...).
  - `Cliente`: Nombre y apellidos completos.
  - `Correo Electrónico`: Dirección de destino.
  - `Acción / Proceso`: Badge temático (`VERIF. LA HABANA`, `ENVIO NOTIFICACION`, `EDICION EXPEDIENTE`, `BAJA SUSCRIPCION`, etc.).
  - `Detalle de Auditoría`: Explicación técnica de la operación.

### 3.2 Pestaña 2: Seguridad y Accesos (MySQL)
* **Origen de Datos:** Endpoint `/api/logs/security.php` consultando la tabla `logs_seguridad`.
* **Columnas:**
  - `Fecha y Hora`: `creado_en`.
  - `Usuario / Operador`: `nombre` e `ID`.
  - `Email`: Correo corporativo del operador.
  - `Evento de Seguridad`: Badge (`LOGIN_EXITOSO`, `LOGIN_FALLIDO`, `USUARIO_CREADO`, `USUARIO_MODIFICADO`, `USUARIO_ELIMINADO`).
  - `IP Origen`: Dirección IP del cliente.
  - `Detalles / Dispositivo`: User-Agent y descripción del evento.

---

## 🔍 4. Herramientas Integradas
1. **Buscador en Tiempo Real:** Filtra instantáneamente por ID, cliente, operador, IP o detalle.
2. **Selector de Eventos Dinámico:** Extrae todos los tipos de eventos presentes en la bitácora activa.
3. **Paginación Inteligente:** 20 registros por página para navegación ágil y bajo consumo de memoria RAM.
4. **Exportación a CSV:** Descarga la vista filtrada en formato CSV compatible con Excel (UTF-8 con BOM).
