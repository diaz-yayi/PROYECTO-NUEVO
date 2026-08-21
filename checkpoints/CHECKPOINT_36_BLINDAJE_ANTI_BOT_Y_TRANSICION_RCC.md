# 📌 CHECKPOINT 36: Blindaje Anti-Bot en Playwright y Transición Automática RCC a RESUELTO
**Fecha de Aplicación:** 19 de Agosto de 2026  
**Versión de Despliegue:** `v=6.5.1`  
**Entorno Objetivo:** `app.lmd2022.com` (Sered cPanel / Google Apps Script / Robot Python Playwright)

---

## 🛠️ Resumen de Mejoras y Ajustes Realizados

### 1. Escudo Anti-Bot para Google reCAPTCHA (`verificador_rcc.py`)
* Inyección en tiempo real de `context.add_init_script` eliminando la propiedad `navigator.webdriver = undefined` y emulando el entorno nativo de Google Chrome.
* Evita la aparición de desafíos de verificación cruzada con Códigos QR y minimiza los bloqueos de audio.

### 2. Candado Estricto de Modo Asistido (`consultar_modo_asistido`)
* Mientras el formulario (`#numero_expediente`) y el botón `Consultar` (`#submitRRCC`) permanezcan visibles en pantalla, el robot permanece en espera pasiva sin evaluar resultados de forma prematura.
* Solo evalúa la respuesta tras la pulsación de *Consultar* y el cambio a la pantalla de resultados del Ministerio.

### 3. Detección Binaria de Resultados Oficiales del Ministerio
* **Recuadro Verde (`.bloqueCampoTextoExito` / `siguiente estado:`):** Extrae el estado oficial delimitado entre `"siguiente estado:"` y `"La información que el Ministerio..."` de forma fidedigna y literal (ej: `"El expediente está concluido"`).
* **Recuadro Rojo (`.bloqueInformativoRojo` / `No se ha obtenido ningún resultado...`):** Detecta la variante fallida en 0.5s, recarga automáticamente el formulario y prepara la siguiente variante sin intervención manual del operador.

### 4. Modo 3: Consulta Individual e Interactiva
* Carga automáticamente todos los candidatos aptos desde Google Workspace y despliega un menú numerado para seleccionar clientes uno a uno (`1`, `2`, `I332`, etc.).
* Mantiene la sesión del navegador abierta permanentemente entre consultas individuales para agilizar el proceso y no cerrar Chrome.

### 5. Automatización del Cierre de Ciclo en `EXPEDIENTES LMD` (`10_VerificadorRCC.txt`)
* Cuando el RCC devuelva un estado concluido/concedido (`"El expediente está concluido"`):
  - **Columna F (`Estado`):** Transiciona automáticamente a **`RESUELTO`** (sin asumir Favorable o Denegado).
  - **Columna G (`Detalle`):** Escribe el texto literal ministerial: **`"El expediente está concluido"`**.
  - **Columna H (`Observaciones`):** `Verificado RCC: dd/MM/yyyy HH:mm:ss`.
  - **Columnas K y L (`Notificado` y `Fecha`):** Se limpian (`clearContent()`) para que el Motor de Envíos Masivos despache la plantilla de aviso `RESUELTO`.
  - **Auditoría en `LOGS_SISTEMA`:** Registro de la transición con trazabilidad completa.
  - **Protección Sandbox:** Respeto estricto del parámetro `MODO_PRUEBA`.

### 6. Auto-Limpieza de Notificaciones y Auditoría en Cambio de Estado (Portal Web y Backend)
* **Regla OnEdit Replicada en Web:** Cuando el estado de un expediente cambia desde el modal web o mediante la API:
  - **Columnas K y L:** Se limpian automáticamente (`Notificado: NO` y `Fecha: vacía`) para habilitar el despacho de la nueva plantilla de notificación correspondiente al nuevo estado.
  - **Auditoría Caja Negra en `LOGS_SISTEMA`:** Registro inmediato del evento:  
    `"Transición: De [ESTADO_ANTERIOR] a [ESTADO_NUEVO]. Notificación reiniciada automáticamente."`

### 7. Optimización UI/UX, Carga Instantánea de Memoria y Desacoplamiento de Modal (v6.5.3)
1. **Desacoplamiento de Footer en Modales:** `.modal-footer` movido fuera de `.modal-body` como hijo directo de `.modal-dialog` con `z-index: 50`, eliminando superposiciones sobre botones y restaurando el clic en 100% de la superficie del botón Guardar.
2. **Entrega de Verificaciones en Bootstrap:** `api/expedientes.php` ahora transmite `verificacionesHabana` y `verificacionesRCC` en la carga inicial, permitiendo navegación instantánea (0 ms) a los módulos de seguimiento.
3. **Badges Compactos para RCC España:** Presentación de badges limpios (`CONCLUIDO`, `EN TRÁMITE`, `FAVORABLE`, `DENEGADO`, `NO ENCONTRADO`) manteniendo el texto literal completo del Ministerio en la columna de Detalle Oficial y tooltip.
4. **Protección de Datos en Cambio de Pestaña:** `main.js` protege el estado en memoria para que sincronizaciones pasivas en segundo plano nunca vacíen las tablas.
5. **Animación CSS `.spinner`:** Creada definición CSS corporativa con gradiente rotativo cian/dorado para micro-cargas en tablas.
* **Versión Web:** Incrementada a `v=6.5.3` y empaquetada en `portal_web_lmd.zip`.
