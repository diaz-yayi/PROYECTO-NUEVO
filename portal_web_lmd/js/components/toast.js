// =============================================================================
// COMPONENTE COMPARTIDO: NOTIFICACIONES TOAST (toast.js)
// =============================================================================

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  },

  show(mensaje, tipo = 'info', duracion = 4000) {
    this.init();

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 12px 18px;
      color: var(--text-main);
      font-size: 0.86rem;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      pointer-events: auto;
      animation: fadeIn 0.2s ease;
      max-width: 400px;
    `;

    let icono = 'ℹ️';
    if (tipo === 'success') {
      icono = '✅';
      toast.style.borderLeft = '4px solid var(--accent-emerald)';
    } else if (tipo === 'error') {
      icono = '❌';
      toast.style.borderLeft = '4px solid var(--accent-red)';
    } else if (tipo === 'warning') {
      icono = '⚠️';
      toast.style.borderLeft = '4px solid var(--accent-gold)';
    } else {
      toast.style.borderLeft = '4px solid var(--accent-cyan)';
    }

    toast.innerHTML = `<span>${icono}</span><span>${mensaje}</span>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duracion);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};
