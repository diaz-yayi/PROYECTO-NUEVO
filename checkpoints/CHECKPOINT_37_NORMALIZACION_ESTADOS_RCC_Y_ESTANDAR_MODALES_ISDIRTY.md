# CHECKPOINT 37: NORMALIZACIÓN DE ESTADOS RCC Y ESTANDARIZACIÓN UNIVERSAL DE MODALES CON ISDIRTY

**Fecha:** 19/08/2026  
**Versión del Sistema:** v6.5.6  
**Estado:** Estable y Validado para Producción

---

## 1. OBJETIVO DEL CHECKPOINT

Resolver la disparidad en los estados mostrados en la vista de **Seguimiento RCC (España)**, implementar la normalización binaria oficial (`CONCLUIDO` vs `EN TRÁMITE`), corregir el comportamiento de detección de cambios (`isDirty`) en el **Modal de Gestión de Usuarios**, y asegurar la homogeneidad estructural de todos los modales del portal tomando como estándar de oro el **Modal de Expedientes**.

---

## 2. CAMBIOS IMPLEMENTADOS Y DETALLES TÉCNICOS

### A. Vista Seguimiento RCC (`js/views/rccView.js`)
1. **Función `normalizarEstadoRCC(estadoRaw)`:**
   - Si el estado contiene `CONCLUIDO` o `CONCLUÍD` $\rightarrow$ `{ texto: 'CONCLUIDO', clase: 'badge-estado-favorable' }` (Verde).
   - Si el estado contiene `NO ENCONTRADO` $\rightarrow$ `{ texto: 'NO ENCONTRADO', clase: 'badge-estado-denegado' }` (Rojo).
   - Para cualquier otra variante (ej. `"El expediente está en trámite"`, `"PENDIENTE"`, etc.) $\rightarrow$ `{ texto: 'EN TRÁMITE', clase: 'badge-estado-resolucion' }` (Dorado).
2. **Selector de Filtros de Estados RCC (`actualizarOpcionesEstadosRCC`):**
   - Agrupa limpiamente las categorías únicas normalizadas (`TODOS`, `EN TRÁMITE`, `CONCLUIDO`, `NO ENCONTRADO`), eliminando textos dispersos o redundantes.
3. **Motor de Filtros (`aplicarFiltrosRCC`):**
   - Compara y busca con base en el estado normalizado y valores de texto del expediente.

---

### B. Gestión de Usuarios y Ciclo `isDirty` (`js/views/configuracionView.js` e `index.html`)
1. **Control de Modificación (`isDirty`):**
   - Implementada la función `evaluarDirtyUsuario()` y su comprobación `formUsuarioIsDirty()`.
   - `tomarSnapshotUsuario()` ahora ejecuta inmediatamente `evaluarDirtyUsuario()`, dejando el botón `#btn-guardar-usuario` deshabilitado al abrir el modal con datos existentes.
   - Vinculados los eventos `input` y `change` en `form-usuario-modal` dentro de `ConfiguracionView.init()`.
2. **Estructura HTML (`index.html`):**
   - El `<div class="modal-footer">` del modal de usuario (`#modal-usuario`) se desacopló del cuerpo del `<form>`, situándose directamente bajo `<div class="modal-dialog">`, idéntico a `#modal-expediente-general`.

---

### C. Modal Radar de Citas (`js/components/modalAutomatizaciones.js`)
1. **Control `isDirty`:**
   - `tomarSnapshotCitas()` ejecuta `evaluarDirtyCitas()` para iniciar con el botón deshabilitado hasta que el usuario realice modificaciones en credenciales o preferencias.
2. **Exportaciones y Enlaces:**
   - Garantizado el alias `window.guardarPreferenciasCitasFormulario = guardarCitasFormulario;`.

---

### D. Control de Versiones y Despliegue
1. **Busting de Caché en `index.html`:**
   - Todos los scripts modulares y la hoja de estilos se actualizaron a **`v=6.5.6`** para forzar la actualización instantánea en el navegador del cliente.
2. **Empaquetado:**
   - Generado el archivo comprimido integral **`portal_web_lmd.zip`** listo para despliegue en hosting cPanel / Apache.

---

## 3. AUDITORÍA DE ARCHIVOS MODIFICADOS
- `portal_web_lmd/js/views/rccView.js`
- `portal_web_lmd/js/views/configuracionView.js`
- `portal_web_lmd/js/components/modalAutomatizaciones.js`
- `portal_web_lmd/index.html`
- `portal_web_lmd.zip`
