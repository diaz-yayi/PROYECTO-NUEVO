// =============================================================================
// COMPONENTE COMPARTIDO: ModalManager (modalManager.js)
// Cierre por tecla Escape para cualquier modal activo, reutilizando el mismo
// botón "×" (y por tanto el mismo cerrarModalX() con su guardia de isDirty /
// proceso en ejecución ya incorporada). Sin cierre por clic fuera del modal.
// =============================================================================

const ModalManager = {
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;

      // El propio ConfirmModal ya gestionó este Escape (marca preventDefault
      // en su propio listener, registrado antes que este). No duplicar el cierre.
      if (e.defaultPrevented) return;

      // Por si acaso el ConfirmModal está activo pero aún no procesó el evento.
      if (document.getElementById('modal-confirmacion-global')?.classList.contains('active')) return;

      // La pantalla de bloqueo por inactividad nunca se cierra con Escape.
      const modalActivo = document.querySelector('.modal-backdrop.active:not(#modal-lock-screen)');
      if (!modalActivo) return;

      e.stopPropagation();
      e.preventDefault();
      modalActivo.querySelector('.modal-close')?.click();
    }, true);
  }
};

window.ModalManager = ModalManager;
