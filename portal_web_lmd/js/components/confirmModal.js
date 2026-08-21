/**
 * =============================================================================
 * COMPONENTE COMPARTIDO: ConfirmModal (confirmModal.js)
 * Escudo de Confirmación y Protección de Integridad (Máxima Profundidad: z-index: 999999)
 * Previene el descarte involuntario de cambios o la interrupción de robots en ejecución.
 * =============================================================================
 */

const ConfirmModal = {
  _resolver: null,

  init() {
    this._crearModalDOM();
    this._vincularEventos();
    this._vincularProteccionSalidaGlobal();
  },

  _crearModalDOM() {
    if (document.getElementById('modal-confirmacion-global')) return;

    const modalHtml = `
      <div id="modal-confirmacion-global" class="modal-backdrop modal-confirm-backdrop" style="position: fixed; inset: 0; z-index: 999999; background: rgba(5, 7, 12, 0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; pointer-events: none; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
        <div class="modal-dialog modal-confirm-dialog" style="width: 100%; max-width: 480px; background: #121824; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px; box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8); overflow: hidden; transform: translateY(20px) scale(0.95); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="modal-body" style="padding: 28px 24px; text-align: center;">
            <div id="confirm-modal-icono" style="font-size: 3rem; margin-bottom: 16px; line-height: 1;">⚠️</div>
            <h3 id="confirm-modal-titulo" style="font-family: var(--font-display, sans-serif); font-size: 1.25rem; font-weight: 700; color: #ffffff; margin-bottom: 10px; line-height: 1.3;">
              ¿Descartar cambios sin guardar?
            </h3>
            <p id="confirm-modal-mensaje" style="font-size: 0.92rem; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
              Has realizado modificaciones que no se han guardado. Si sales ahora, la información se perderá.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="btn-confirm-cancelar" type="button" class="btn btn-secondary" style="flex: 1; padding: 12px 18px; font-weight: 600; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.05); color: #e2e8f0; cursor: pointer; transition: background 0.2s;">
                Continuar Editando
              </button>
              <button id="btn-confirm-aceptar" type="button" class="btn" style="flex: 1; padding: 12px 18px; font-weight: 600; border-radius: 10px; background: #ef4444; color: #ffffff; border: none; cursor: pointer; transition: opacity 0.2s;">
                Descartar y Salir
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  _vincularEventos() {
    const btnCancelar = document.getElementById('btn-confirm-cancelar');
    const btnAceptar = document.getElementById('btn-confirm-aceptar');
    const backdrop = document.getElementById('modal-confirmacion-global');

    if (btnCancelar) {
      btnCancelar.addEventListener('click', () => this._cerrar(false));
    }
    if (btnAceptar) {
      btnAceptar.addEventListener('click', () => this._cerrar(true));
    }

    // Cerrar con Escape devuelve false (permanecer / cancelar acción destructiva)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop && backdrop.classList.contains('active')) {
        e.stopPropagation();
        e.preventDefault();
        this._cerrar(false);
      }
    }, true);
  },

  _vincularProteccionSalidaGlobal() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hayPeligroActivo()) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios no guardados o una automatización en curso. ¿Seguro que deseas salir?';
        return e.returnValue;
      }
    });
  },

  hayPeligroActivo() {
    // Solo alertar si el usuario está activamente guardando cambios críticos
    if (typeof state !== 'undefined' && state.guardandoDatos) return true;
    
    // Verificar si el modal de expediente está abierto y dirty
    const modalExp = document.getElementById('modal-expediente-general');
    if (modalExp && modalExp.classList.contains('active')) {
      if (typeof formExpedienteIsDirty === 'function' && formExpedienteIsDirty()) return true;
    }

    // Verificar si el modal de citas está abierto y dirty
    const modalCitas = document.getElementById('modal-citas-radar');
    if (modalCitas && modalCitas.classList.contains('active')) {
      if (typeof formCitasIsDirty === 'function' && formCitasIsDirty()) return true;
    }

    // Verificar si el modal de usuario está abierto y dirty
    const modalUsr = document.getElementById('modal-usuario');
    if (modalUsr && modalUsr.classList.contains('active')) {
      if (typeof formUsuarioIsDirty === 'function' && formUsuarioIsDirty()) return true;
    }

    // Verificar si el formulario de configuración tiene cambios sin guardar solo si está en esa vista
    if (typeof state !== 'undefined' && state.seccionActiva === 'view-configuracion') {
      if (typeof formConfigIsDirty === 'function' && formConfigIsDirty()) return true;
    }

    return false;
  },

  mostrar({ icono = '⚠️', titulo, mensaje, btnConfirmarTexto = 'Aceptar', btnCancelarTexto = 'Cancelar', colorConfirmar = '#ef4444' }) {
    this._crearModalDOM();

    const iconoEl = document.getElementById('confirm-modal-icono');
    const tituloEl = document.getElementById('confirm-modal-titulo');
    const mensajeEl = document.getElementById('confirm-modal-mensaje');
    const btnCancelar = document.getElementById('btn-confirm-cancelar');
    const btnAceptar = document.getElementById('btn-confirm-aceptar');
    const backdrop = document.getElementById('modal-confirmacion-global');

    if (iconoEl) iconoEl.innerHTML = icono;
    if (tituloEl) tituloEl.innerText = titulo;
    if (mensajeEl) mensajeEl.innerText = mensaje;
    if (btnCancelar) btnCancelar.innerText = btnCancelarTexto;
    if (btnAceptar) {
      btnAceptar.innerText = btnConfirmarTexto;
      btnAceptar.style.background = colorConfirmar;
    }

    if (backdrop) {
      backdrop.style.opacity = '1';
      backdrop.style.pointerEvents = 'auto';
      backdrop.classList.add('active');
      const dialog = backdrop.querySelector('.modal-dialog');
      if (dialog) {
        dialog.style.transform = 'translateY(0) scale(1)';
      }
    }

    return new Promise((resolve) => {
      this._resolver = resolve;
    });
  },

  _cerrar(resultado) {
    const backdrop = document.getElementById('modal-confirmacion-global');
    if (backdrop) {
      backdrop.style.opacity = '0';
      backdrop.style.pointerEvents = 'none';
      backdrop.classList.remove('active');
      const dialog = backdrop.querySelector('.modal-dialog');
      if (dialog) {
        dialog.style.transform = 'translateY(20px) scale(0.95)';
      }
    }
    if (this._resolver) {
      this._resolver(resultado);
      this._resolver = null;
    }
  },

  // Atajo 1: Descartar cambios sin guardar
  async descartarCambios(contexto = 'este expediente') {
    return await this.mostrar({
      icono: '⚠️',
      titulo: '¿Descartar cambios sin guardar?',
      mensaje: `Has realizado modificaciones en ${contexto} que aún no se han guardado en Google Sheets. Si sales ahora, se perderán.`,
      btnConfirmarTexto: 'Descartar y Salir',
      btnCancelarTexto: 'Continuar Editando',
      colorConfirmar: '#f59e0b'
    });
  },

  // Atajo 2: Alerta de proceso / robot en ejecución
  async procesoEnEjecucion(nombreProceso = 'La automatización') {
    return await this.mostrar({
      icono: '⛔',
      titulo: 'Proceso en Ejecución Activa',
      mensaje: `${nombreProceso} se encuentra procesando datos en este momento. Si cierras la ventana, la ejecución se interrumpirá.`,
      btnConfirmarTexto: 'Detener y Cerrar',
      btnCancelarTexto: 'Esperar a que termine',
      colorConfirmar: '#ef4444'
    });
  }
};

window.ConfirmModal = ConfirmModal;
