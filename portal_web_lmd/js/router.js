// =============================================================================
// ENRUTADOR SPA POR HASH CON GUARDIÁN DE AUTENTICACIÓN Y ROLES (router.js)
// =============================================================================

// Puente global de compatibilidad inmediato para llamadas onclick en el HTML
window.cambiarSeccion = function(viewId) {
  if (typeof Router !== 'undefined' && typeof Router.navigateToView === 'function') {
    Router.navigateToView(viewId);
  } else {
    const routeMap = {
      'view-login': '#/login',
      'view-dashboard': '#/dashboard',
      'view-expedientes': '#/expedientes',
      'view-habana': '#/habana',
      'view-rcc': '#/rcc',
      'view-citas': '#/citas',
      'view-automatizaciones': '#/automatizaciones',
      'view-configuracion': '#/configuracion',
      'view-logs': '#/logs'
    };
    window.location.hash = routeMap[viewId] || '#/dashboard';
  }
};

const Router = {
  
  routes: {
    '': 'view-dashboard',
    '#': 'view-dashboard',
    '#/login': 'view-login',
    '#/dashboard': 'view-dashboard',
    '#/expedientes': 'view-expedientes',
    '#/habana': 'view-habana',
    '#/rcc': 'view-rcc',
    '#/citas': 'view-citas',
    '#/automatizaciones': 'view-automatizaciones',
    '#/configuracion': 'view-configuracion',
    '#/logs': 'view-logs'
  },

  // Permisos por Rol
  rolePermissions: {
    'admin': ['view-dashboard', 'view-expedientes', 'view-habana', 'view-rcc', 'view-citas', 'view-automatizaciones', 'view-configuracion', 'view-logs'],
    'operador': ['view-dashboard', 'view-expedientes', 'view-habana', 'view-rcc', 'view-citas'],
    'consultor': ['view-dashboard', 'view-expedientes', 'view-habana', 'view-rcc', 'view-citas']
  },

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Manejar clics en elementos con data-view
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = item.dataset.view;
        this.navigateToView(viewId);
      });
    });

    this.handleRoute();
  },

  handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    // El JWT vive en cookie httpOnly (no legible desde JS); esta bandera
    // no sensible indica si hay sesión — la validez real la confirma el
    // servidor en la primera petición real.
    const sesionActiva = localStorage.getItem('sesion_lmd_activa') === 'true';

    // 1. Guardián de Autenticación: Si no hay sesión, forzar #/login
    if (!sesionActiva) {
      if (hash !== '#/login') {
        state.rutaPrevia = hash;
        window.location.hash = '#/login';
        return;
      }
      this.renderView('view-login');
      return;
    }

    // 2. Si ya está autenticado e intenta ir a #/login, redirigir al Dashboard
    if (hash === '#/login' && (token || sesionActiva)) {
      window.location.hash = '#/dashboard';
      return;
    }

    const viewId = this.routes[hash] || 'view-dashboard';

    // 3. Guardián de Roles RBAC
    const user = state.usuarioActual || JSON.parse(localStorage.getItem('lmd_user_profile') || '{"rol":"admin"}');
    const userRole = user.rol || 'consultor';
    const allowedViews = this.rolePermissions[userRole] || this.rolePermissions['consultor'];

    if (!allowedViews.includes(viewId)) {
      if (typeof Toast !== 'undefined') {
        Toast.warning('Acceso restringido. Tu nivel de acceso no tiene permisos para esta sección.');
      }
      window.location.hash = '#/dashboard';
      return;
    }

    this.renderView(viewId);
  },

  async navigateToView(viewId) {
    if (!viewId) return;
    if (state.seccionActiva === viewId) return;

    // 1. Advertir solo si hay un robot/automatización masiva en ejecución activa
    if (state.automatizacionActiva && typeof ConfirmModal !== 'undefined') {
      const forzar = await ConfirmModal.procesoEnEjecucion('Hay un proceso o automatización');
      if (!forzar) return;
      state.automatizacionActiva = false;
    }

    // 2. Si está en configuración con cambios sin guardar
    if (state.seccionActiva === 'view-configuracion' && typeof formConfigIsDirty === 'function' && formConfigIsDirty() && typeof ConfirmModal !== 'undefined') {
      const confirmar = await ConfirmModal.descartarCambios('los parámetros del sistema');
      if (!confirmar) return;
      state.snapshotConfig = null;
    }

    const route = Object.keys(this.routes).find(key => this.routes[key] === viewId && key.startsWith('#/')) || '#/dashboard';
    window.location.hash = route;
  },

  navigateToHash(hash) {
    window.location.hash = hash;
  },

  renderView(viewId) {
    // Si se cambia de vista, limpiar el buscador global para no arrastrar filtros antiguos
    if (state.seccionActiva !== viewId) {
      const inputGlobal = document.getElementById('global-search-input');
      if (inputGlobal && inputGlobal.value !== '') {
        inputGlobal.value = '';
      }
      state.terminoBusqueda = '';
    }

    state.seccionActiva = viewId;

    const loginScreen = document.getElementById('login-screen');
    const appLayout = document.getElementById('app-layout');

    if (viewId === 'view-login') {
      if (loginScreen) loginScreen.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
      return;
    }

    // Si es una vista autenticada
    if (loginScreen) loginScreen.style.display = 'none';
    if (appLayout) {
      appLayout.style.display = 'flex';
      appLayout.style.width = '100vw';
    }

    // Actualizar items de la barra lateral
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Mostrar sección correspondiente
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === viewId);
    });

    // Triggers específicos por vista
    if (viewId === 'view-dashboard') {
      if (typeof renderizarGraficos === 'function') setTimeout(() => renderizarGraficos(), 60);
    } else if (viewId === 'view-expedientes') {
      if (typeof actualizarOpcionesConsuladosExpedientes === 'function') actualizarOpcionesConsuladosExpedientes();
      if (typeof aplicarFiltros === 'function') aplicarFiltros();
    } else if (viewId === 'view-habana') {
      if (typeof cargarHabanaEnVista === 'function') cargarHabanaEnVista();
    } else if (viewId === 'view-rcc') {
      if (typeof cargarRCCEnVista === 'function') cargarRCCEnVista();
    } else if (viewId === 'view-citas') {
      if (typeof actualizarOpcionesConsuladosCitas === 'function') actualizarOpcionesConsuladosCitas();
      if (typeof aplicarFiltrosCitas === 'function') aplicarFiltrosCitas();
    } else if (viewId === 'view-automatizaciones') {
      if (typeof actualizarDatosTarjetasAutomatizacion === 'function') actualizarDatosTarjetasAutomatizacion();
    } else if (viewId === 'view-configuracion') {
      if (typeof cargarConfiguracionEnFormulario === 'function') cargarConfiguracionEnFormulario();
      if (typeof cargarUsuariosEnTabla === 'function') cargarUsuariosEnTabla();
    } else if (viewId === 'view-logs') {
      if (typeof cargarLogsEnVista === 'function') cargarLogsEnVista();
    }
  }
};
