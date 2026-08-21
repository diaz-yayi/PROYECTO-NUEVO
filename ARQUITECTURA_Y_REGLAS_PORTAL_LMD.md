# 🏛️ MANUAL MAESTRO DE ARQUITECTURA, REGLAS Y COMPONENTES COMPARTIDOS
## Portal Web Ejecutivo LMD & Radar Consular (app.lmd2022.com)

---

## 🛑 0. PROTOCOLO OBLIGATORIO DE DESARROLLO (CERO SUPOSICIONES Y CERO REGRESIONES)

1. **Fase 1 — Escaneo Previo Exhaustivo (Pre-Flight Scan):**
   - Antes de modificar cualquier archivo, es OBLIGATORIO escanear la cadena completa de dependencias:
     1. Estado Global (`state.js`): variables, valores iniciales y tipos.
     2. Enrutador y Controladores (`router.js` y `views/*.js`).
     3. Backend PHP (`api/*.php` y helpers `gas_gateway.php`, `db.php`).
     4. Backend Google Apps Script (`05_WebApp_Apoyo.txt`).
     5. Marcado HTML y CSS (`index.html` y `styles.css`).
   - Queda terminantemente prohibido codificar basándose en memoria o suposiciones sin haber leído los archivos activos previamente.

2. **Fase 2 — Ejecución Quirúrgica y Reutilización de Componentes:**
   - Todo nuevo módulo o ajuste debe utilizar estrictamente los componentes compartidos ya diseñados (Componentes 1, 2, 3, 7, 8, 11, 12, 13).
   - Prohibido crear estructuras HTML ad-hoc o clases CSS duplicadas que rompan la simetría visual.

3. **Fase 3 — Verificación Integral Post-Modificación (Post-Flight Check):**
   - Antes de entregar cualquier versión, verificar que el flujo completo de datos funcione (Frontend ➔ PHP ➔ Google Sheets / MySQL ➔ Renderizado DOM).
   - Validar que no existan advertencias de consola, desalineaciones geométricas ni variables indefinidas.

---

## 📌 1. REGLAS FUNDAMENTALES E INVARIANTES DEL SISTEMA

1. **El ID del Expediente es INTOCABLE (`=ROW()-1`):**
   - El identificador único (`I1`, `I2`, `I3`...) se calcula mediante fórmula en la columna I de la hoja `EXPEDIENTES LMD`.
   - **Bajo ninguna circunstancia** se debe sobrescribir o alterar con texto fijo, para evitar la ruptura de referencias cruzadas y fórmulas vinculadas.

2. **La Bóveda de Configuración es VIVA (`PropertiesService`):**
   - Toda configuración (`MODO_PRUEBA`, `EMAIL_PRUEBA`, `DIAS_CARENCIA_RESOLUCION`, `DIAS_CICLO_SEGUIMIENTO`, `DIAS_CICLO_TRAMITES`, `COLOR_ORO`, `COLOR_FONDO`, `COLOR_TEXTO`, `URL_LOGO_PUBLICO`) reside exclusivamente en `PropertiesService.getDocumentProperties()`.
   - El objeto `DEFAULTS` en código solo opera como mecanismo de paracaídas y auto-reparación si la propiedad estuviese ausente.
   - Cualquier cambio en la Web o en Sheets actualiza la bóveda y dispara `onOpen()` de inmediato.

3. **Compatibilidad 100% con el Entorno de Google Sheets:**
   - La hoja de cálculo debe seguir funcionando como estación de trabajo autónoma (menús personalizados, disparadores y validaciones nativas de Sheets intactos).

4. **Auto-Registro de Sedes Consulares (`Data_Mapping`):**
   - Si un usuario ingresa una nueva sede consular que no figura en la lista estándar, el backend de Google Apps Script la registra automáticamente en la hoja de mapeos sin corromper la tabla principal.

5. **Doble Capa de Seguridad en la API Web:**
   - Toda petición entrante (GET y POST) debe validar `PALABRA_SECRETA`, extrayéndola tanto de los parámetros de consulta (`e.parameter.key`) como del cuerpo del paquete JSON (`e.postData.contents`).

---

## 🎨 2. COMPONENTES COMPARTIDOS DE DISEÑO Y UX (ESTÁNDAR SAAS)

Todos los módulos presentes y futuros deben construirse reutilizando obligatoriamente los siguientes componentes:

### 🧩 Componente 1: Cabecera Homogénea de Módulo (`.module-header-container`)
Estructura simétrica de 2 niveles:
* **Nivel 1 (Título y Acción Principal):**
  - Izquierda: Título del Módulo (`h2`) y subtítulo descriptivo.
  - Derecha: Botón de Acción Primaria (`.btn-primary` o `.btn-secondary`).
* **Nivel 2 (Barra de Filtros y Búsqueda):**
  - Izquierda: Selectores de filtro (`.form-select`) con altura estandarizada de 38px e iconos temáticos.
  - Derecha: Contador de registros o métrica rápida.

```html
<div class="module-header-container">
  <!-- Nivel 1 -->
  <div class="module-header-top">
    <div>
      <h2 class="module-title">Nombre del Módulo</h2>
      <div class="module-subtitle">Descripción de la funcionalidad</div>
    </div>
    <div class="module-actions">
      <button class="btn btn-primary">➕ Acción Principal</button>
    </div>
  </div>

  <!-- Nivel 2 -->
  <div class="module-filters-bar">
    <div class="filters-group">
      <select class="form-select">...</select>
      <select class="form-select">...</select>
    </div>
    <div class="filters-summary">
      <span>Mostrando resultados filtrados</span>
    </div>
  </div>
</div>
```

---

### 🧩 Componente 2: Contenedor con Scroll Autónomo (`.table-scroll-container`)
* La cabecera del módulo se mantiene fija.
* El scroll vertical ocurre **únicamente dentro del contenedor de la tabla**.
* Los encabezados de columna (`.modern-table th`) tienen `position: sticky; top: 0; background: #111C30; z-index: 10;`, impidiendo que el operador pierda la referencia de las columnas al desplazarse.

```html
<div class="table-container">
  <div class="table-scroll-container">
    <table class="modern-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Cliente</th>
          <th>Consulado</th>
          <th>Estado</th>
          <th>Detalles</th>
        </tr>
      </thead>
      <tbody id="table-body">...</tbody>
    </table>
  </div>
</div>
```

---

### 🧩 Componente 3: Paginador Universal Compartido (`.pagination-bar`)
* Barra de navegación inferior simétrica presente en todas las tablas:
  - Izquierda: Contador reactivo (`Mostrando X–Y de Z registros`) + Selector de 15, 30 o 50 registros por página.
  - Derecha: Botones reactivos `◀ Anterior` y `Siguiente ▶` con indicador central `Página X de Y`.

---

### 🧩 Componente 4: Patrón `isDirty` con Snapshot Inteligente
* Todos los formularios (Ficha de Expediente, Gestión de Citas, Panel de Configuración, etc.):
  1. Al abrir o cargar datos, capturan un `snapshot` en memoria del estado inicial.
  2. El botón de guardado inicia en estado **deshabilitado y atenuado** (`disabled`, `opacity: 0.35`).
  3. Al detectar cualquier cambio en cualquier campo (`input`, `change`), se habilita inmediatamente.
  4. Si los valores vuelven a ser idénticos al snapshot inicial, el botón se deshabilita automáticamente.
  5. Tras un guardado exitoso, se toma un nuevo snapshot y el botón regresa al reposo.

---

### 🧩 Componente 5: Conmutador Switch Toggle (`.switch-toggle`)
* Utilizado para banderas booleanas (como `MODO_PRUEBA`).
* Estilo interactivo iOS/Mac con indicador textual reactivo (`Simulacro Activo` / `Producción Real`).

---

### 🧩 Componente 6: Asistencia Poka-Yoke en Formularios
* Al cambiar el selector de `Estado Oficial`, se actualizan dinámicamente las píldoras de sugerencias rápidas autocompletables para estandarizar las fechas y formatos de observaciones.

---

### 🧩 Componente 7: Botón Asíncrono con Spinner Unificado (`setBotonCargando`)
* **Regla Estricta:** Ningún botón debe implementar animaciones de carga ad-hoc o duplicadas.
* Se debe utilizar exclusivamente la función global compartida:
  ```javascript
  setBotonCargando(btnElemento, estaCargando, textoCargando, textoOriginal)
  ```
* Al estar activo (`estaCargando = true`):
  - Inyecta un icono spinner CSS animado (`.spinner-icon` con rotación suave `@keyframes spin`).
  - Deshabilita el botón (`disabled = true`) para prevenir doble clic accidental.
* Al finalizar (`estaCargando = false`):
  - Restaura el texto/icono original y rehabilita el botón.
* **Módulos que lo aplican obligatoriamente:**
  - Conmutador de Modo del Header (`#btn-switch-modo`).
  - Botón de Sincronización Global (`#btn-sync-top`).
  - Botones de Guardado en Formularios (`#btn-guardar-expediente`, `#btn-guardar-citas`, `#btn-guardar-config`).
  - Botones de Ejecución de Automatizaciones (`#btn-ejecutar-auditor`, `#btn-ejecutar-envios`, `#btn-consultar-habana-ind`, `#btn-habana-batch-iniciar`).

---

### 🧩 Componente 8: Dark UI Scrollbar Universal y Geometría Simétrica
* **Regla Estricta:** Queda terminantemente prohibido el uso de la barra de scroll gris/blanca nativa del navegador.
* Toda área desplazable (`html`, `body`, `.table-scroll-container`, consolas de terminal, modales) debe utilizar las reglas CSS globales compartidas:
  ```css
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.16); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-cyan); }
  ```
* **Simetría Geométrica:** La cabecera del módulo (`.module-header-container`), la tabla (`.table-container`) y el paginador (`.pagination-bar`) deben compartir milimétricamente el mismo ancho y alineación derecha en todas las pantallas (Dashboard, Expedientes, Citas, Automatizaciones y Configuración).

---

### 🧩 Componente 9: Tarjeta de Reporte Ejecutivo Compartida (`renderReporteEjecutivo`)
* **Regla Estricta:** Prohibido mostrar salidas crudas en formato JSON en las respuestas de automatizaciones.
* Se debe utilizar la función compartida:
  ```javascript
  renderReporteEjecutivo(contenedorId, { titulo, estado, esPrueba, metricas, mensajePie })
  ```
* Debe renderizar en espejo con el estándar de Google Sheets:
  - Badge de Estado con color temático.
  - Indicador de Entorno (`🟡 Modo Prueba (Simulacro)` o `🟢 Modo Producción Real`).
  - Cuadrícula de métricas clave (Expedientes Auditados, Citas Alcanzadas, Notificaciones Habilitadas, Tiempo).
  - Nota de auditoría vinculada a `LOGS_SISTEMA`.

---

### 🧩 Componente 10: Banner Reactivo de Modo Prueba (`actualizarBannersModoPrueba`)
* Todos los modales de ejecución deben incluir un contenedor `.modo-alerta-banner`.
* Al abrirse o al conmutar el modo:
  - En **Modo Prueba:** Despliega una alerta ámbar explicando que es un simulacro seguro, que ningún cliente recibirá correos y que la tabla principal *EXPEDIENTES LMD* permanece blindada.
  - En **Modo Producción:** Despliega una alerta de precaución indicando que los correos saldrán directamente a los clientes reales.

---

### 🧩 Componente 11: Modal Flotante de Confirmación Global (`ConfirmModal.js`)
* **Regla Estricta:** Queda prohibido el uso de `alert()`, `confirm()` o cuadros de diálogo nativos del navegador.
* Todas las advertencias destructivas (cambio de sección con formulario dirty, baja de usuarios, confirmación de acciones) deben invocar exclusivamente:
  ```javascript
  const confirmado = await ConfirmModal.mostrar({
    icono: '⚠️',
    titulo: '¿Descartar cambios no guardados?',
    mensaje: 'Has realizado modificaciones en la ficha. Si sales ahora, los cambios se perderán.',
    btnConfirmarTexto: 'Descartar Cambios',
    btnCancelarTexto: 'Continuar Editando',
    colorConfirmar: '#ef4444'
  });
  ```
* **No Intrusión en Segundo Plano:** El evento `beforeunload` solo debe alertar ante mutaciones activas de guardado (`state.guardandoDatos === true`) o modales abiertos con cambios dirty. Las sincronizaciones pasivas de lectura en segundo plano nunca deben bloquear al usuario ni disparar advertencias del navegador.

---

### 🧩 Componente 12: Sistema de Notificaciones Toast Universal (`Toast.js`)
* Mensajes visuales no bloqueantes en la esquina superior derecha con autocierre en 4 segundos:
  - `Toast.success(mensaje)` ➔ Verde esmeralda con icono de confirmación.
  - `Toast.error(mensaje)` ➔ Rojo carmesí con icono de alerta.
  - `Toast.warning(mensaje)` ➔ Ámbar dorado con icono de precaución.
  - `Toast.info(mensaje)` ➔ Azul cian con icono informativo.

---

### 🧩 Componente 13: Bloqueo de Sesión por Inactividad (`LockScreen.js`)
* **Nivel 1 (Pausa tras 2 horas de inactividad):** Despliega el modal de bloqueo con desenfoque de fondo (*Backdrop Blur*), preservando la ruta y el estado exacto de la pantalla.
* **Nivel 2 (Expiración tras 48 horas):** Purga total de tokens JWT y redirección limpia a `#/login`.
* **Congelación de Red:** Mientras la pantalla esté bloqueada por inactividad (`LockScreen.bloqueado === true`) o la pestaña esté en segundo plano (`document.hidden === true`), se pausan inmediatamente todas las peticiones de red y auto-sincronizaciones para ahorrar memoria y ancho de banda.

---

### 🧩 Componente 14: Panel de Diagnóstico Dinámico de Notificaciones y Carencia Legal
* En la Ficha de Expediente (`modalExpediente.js`), el operador dispone de 3 controles interactivos:
  1. `Estado de Notificación` (`SI` / `NO`).
  2. `Fecha Último Envío` (Editable manualmente para reintentos o pruebas).
  3. `Suscripción Cliente` (`Activo` / `Baja`).
* **Diagnóstico Contextual Poka-Yoke (Sin datos hardcodeados):**
  - Si los días transcurridos desde la cita son menores a `DIAS_CARENCIA_RESOLUCION` (60 días): Muestra el estado **"En Periodo de Carencia Legal (Día X de 60)"**.
  - Si el periodo de carencia venció y no ha sido notificado: Muestra **"Listo para Primer Envío"**.
  - Si ya fue notificado y está en ciclo de seguimiento: Muestra **"Notificado Activo (Día X de 30)"**.
  - Si se dio de baja: Muestra **"Cliente Desuscrito (Baja de Notificaciones)"**.

---

## 🔐 4. ARQUITECTURA DE SEGURIDAD Y BLINDAJE DE DATOS (RBAC & SERVIDOR)

1. **Autenticación Basada en Roles (RBAC):**
   - **Administrador (`admin`):** Acceso total (Dashboard, Expedientes, Citas, Automatizaciones, Configuración, Auditoría & Logs y Gestión de Usuarios).
   - **Operador (`operador`):** Dashboard, Expedientes (creación/edición) y Cola de Citas. Módulos de configuración, automatizaciones masivas y logs ocultos.
   - **Consultor (`consultor`):** Dashboard, Expedientes y Citas en modo solo lectura.

2. **Cero Exposición de Credenciales en el Frontend (*No Client-Side Secrets*):**
   - El archivo JavaScript del cliente (`config.js`) **nunca contiene ni la URL de Google Apps Script ni la clave secreta**.
   - Toda comunicación con Google Apps Script se canaliza a través de los endpoints PHP del servidor (`api/*.php`) utilizando la pasarela segura cURL server-to-server (`gas_gateway.php` y `config.php`).
   - Las contraseñas se almacenan con algoritmo de hash unidireccional **Bcrypt (Cost 12)** en la base de datos MySQL `v237734_lmd_db`.
   - Las sesiones utilizan tokens de seguridad criptográficos **JWT (JSON Web Tokens)** con expiración estricta.

---

## ⚡ 5. ARQUITECTURA DE RENDIMIENTO Y CONCURRENCIA

1. **Carga Única en Memoria (*Single-Pass Bootstrap*):**
   - Para evitar retardos de 60 segundos por múltiples consultas sucesivas a Google, el endpoint `obtener_bootstrap_sistema` en Google Apps Script realiza una sola lectura de la hoja `EXPEDIENTES LMD` (802 filas) y en **un solo bucle lineal de memoria** construye los expedientes, calcula los KPIs del Dashboard y extrae las citas.
   - Tiempo de respuesta reducido de 60s a **2-3 segundos**.

2. **Fidelidad del Velo de Carga (*Splash Loader*):**
   - El velo de carga (`#app-loading-screen`) posee `z-index: 100001` y permanece visible **exactamente el tiempo necesario hasta que los datos reales estén 100% renderizados en el DOM**, desapareciendo con una transición suave. No se utilizan temporizadores ciegos que puedan mostrar pantallas en blanco o en cero.

3. **Cola de Guardado Concurrente Inteligente (*Queue-Lock*):**
   - Durante las auto-sincronizaciones pasivas en segundo plano, el usuario puede navegar libremente entre módulos sin interrupciones.
   - Si el usuario ejecuta un guardado mientras se realiza una auto-sincronización, el sistema espera de forma asíncrona a que termine la lectura y aplica el guardado inmediatamente sobre el estado más fresco de la base de datos.

---

## 🛡️ 6. MÓDULO 6: CENTRO DE AUDITORÍA Y BITÁCORA DEL SISTEMA (EXCLUSIVO ADMIN)

* **Pestaña 1: Operaciones y Robots (Google Sheets):** Consulta las últimas 200 filas de la hoja `LOGS_SISTEMA` (verificaciones de La Habana, envíos masivos, ediciones de expedientes y registros de robots de citas).
* **Pestaña 2: Seguridad y Accesos (MySQL):** Consulta la tabla `logs_seguridad` (inicios de sesión exitosos/fallidos, altas/bajas de operadores, IPs de origen y huellas de navegador).
* **Herramientas Integradas:**
  - Buscador instantáneo reactivo multi-campo.
  - Filtro dinámico por tipo de evento.
  - Paginación ágil de 20 registros por página.
  - Exportador directo a formato CSV con codificación UTF-8 para Excel.

---

## 🏛️ 7. ESTRUCTURA MODULAR DE NAVEGACIÓN Y SEGUIMIENTO POR PROCEDIMIENTOS

El portal organiza sus flujos en **3 Bloques Categóricos** para una experiencia enterprise limpia y segmentada:

### 📊 Bloque 1: Gestión General
1. **`📊 Dashboard General` (`view-dashboard`):** Métricas consolidadas, embudo de resolución, analítica y termómetros consulares.
2. **`📁 Expedientes LMD` (`view-expedientes`):** Base maestra unificada con filtros de España (Registros Civiles) y Consulados Internacionales, buscador multi-campo y ficha Poka-Yoke.

### 🛰️ Bloque 2: Seguimiento & Radar
3. **`🇨🇺 Seguimiento La Habana` (`view-habana`):** Trazabilidad directa de la API oficial del Consulado de España en La Habana (`cgelahabana.es`), alimentada por la hoja `VERIFICACION_CONSULAR` con fechas de resolución, inscripción y datos registrales (Tomo/Página).
4. **`🇪🇸 Seguimiento RCC` (`view-rcc`):** Trazabilidad directa de las verificaciones automáticas en el Registro Civil Central de España (Ministerio de Justicia / Robot Playwright), alimentada por la hoja `VERIFICACION_RCC`.
5. **`🔑 Radar de Citas` (`view-citas`):** Cola activa y dinámica de expedientes en el exterior con credenciales consulares, excluyendo automáticamente citas ya fijadas y consulados sin candidatos activos.

### ⚡ Bloque 3: Operaciones & Control
6. **`⚡ Automatizaciones` (`view-automatizaciones`):** Centro de disparadores de correos masivos, auditor nocturno y verificaciones batch.
7. **`⚙️ Configuración` (`view-configuracion`):** Bóveda viva de parámetros (`PropertiesService`), días de carencia y gestión RBAC de usuarios.
8. **`🛡️ Auditoría & Bitácora` (`view-logs`):** Trazabilidad cruzada de Google Sheets (`LOGS_SISTEMA`) y MySQL (`logs_seguridad`).

---

## ⚖️ 8. REGLAS DE RESOLUCIÓN Y NOTIFICACIÓN AUTOMÁTICA: LA HABANA VS RCC ESPAÑA

1. **Procedimiento La Habana (Resolución Explícita en API):**
   * Al recibir `FAVORABLE` con inscripción: Transiciona a `RESUELTO FAVORABLE` con Tomo/Página en Detalle.
   * Al recibir `DENEGADO / DESFAVORABLE`: Transiciona a `RESUELTO DENEGADO`.
   * Columnas K y L se limpian para despachar la plantilla correspondiente.

2. **Procedimiento Registro Civil Central España (Resolución Discreta):**
   * En la Sede del Ministerio, todo trámite finalizado figura textualmente como **`"El expediente está concluido"`** (sin revelar públicamente si fue favorable o denegado).
   * **Transición Automática Segura:**
     - **Columna F (`Estado`):** Pasa a **`RESUELTO`** (estado neutro de trámite finalizado).
     - **Columna G (`Detalle`):** Escribe el texto literal ministerial: **`"El expediente está concluido"`**.
     - **Columna H (`Observaciones`):** `Verificado RCC: dd/MM/yyyy HH:mm:ss`.
     - **Columnas K y L:** Se limpian (`clearContent()`) para habilitar el despacho de la plantilla de aviso `RESUELTO`.
   * **Cierre del Ciclo:** El cliente recibe la comunicación oficial informándole de la conclusión de su trámite y solicitándole aportar la resolución física/electrónica. Una vez recibida, el operador actualiza manualmente la ficha a `RESUELTO FAVORABLE` o `RESUELTO DENEGADO`.

---

*Este documento es la Fuente Única de Verdad (SSOT) de obligada observancia en todo desarrollo del proyecto.*
