// =============================================================================
// PUNTO DE ENTRADA PRINCIPAL (main.js) — BOOTSTRAP, SESIÓN Y EVENTOS
// =============================================================================

function mostrarSplashLoader(status = 'Iniciando sesión segura...', substatus = 'Sincronizando Workspace con Google Sheets') {
  const loader = document.getElementById('app-loading-screen');
  const text = document.getElementById('loading-status-text');
  const sub = document.getElementById('loading-substatus-text');
  if (text) text.innerText = status;
  if (sub) sub.innerText = substatus;
  if (loader) loader.classList.add('active');
}

function ocultarSplashLoader() {
  const loader = document.getElementById('app-loading-screen');
  if (loader) {
    loader.classList.remove('active');
  }
}

function inicializarAuth() {
  const token = localStorage.getItem('lmd_jwt_token');
  const sesionGuardada = localStorage.getItem('sesion_lmd_activa') === 'true';
  const profileRaw = localStorage.getItem('lmd_user_profile');

  if (profileRaw) {
    try {
      state.usuarioActual = JSON.parse(profileRaw);
    } catch(e) {}
  }

  // Comprobar estrictamente que exista un token no vacío y sesión activa
  if (token && token.trim().length > 10 && sesionGuardada) {
    state.sesionActiva = true;
    mostrarAppPrincipal();
  } else {
    state.sesionActiva = false;
    mostrarPantallaLogin();
  }

  // Inicializar componentes
  if (typeof LoginView !== 'undefined') LoginView.init();
  if (typeof LockScreen !== 'undefined') LockScreen.init();
}

function mostrarPantallaLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout = document.getElementById('app-layout');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appLayout) appLayout.style.display = 'none';
}

function mostrarAppPrincipal() {
  const loginScreen = document.getElementById('login-screen');
  const appLayout = document.getElementById('app-layout');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appLayout) {
    appLayout.style.display = 'flex';
    appLayout.style.width = '100vw';
  }

  actualizarUIUsuarioActual();
}

function actualizarUIUsuarioActual() {
  const user = state.usuarioActual || { email: 'admin@estelamarina.com', nombre: 'Administrador EM', rol: 'admin' };
  
  const userAvatar = document.querySelector('.user-avatar');
  const userName = document.querySelector('.user-profile div:nth-child(2)');

  if (userName) {
    userName.innerText = user.nombre || user.email || 'Admin EM';
  }

  if (userAvatar) {
    const iniciales = (user.nombre || 'EM').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    userAvatar.innerText = iniciales || 'EM';
  }

  // Ocultar opciones restringidas según el rol
  const rol = user.rol || 'consultor';
  
  const navAutomatizaciones = document.querySelector('.nav-item[data-view="view-automatizaciones"]');
  const navConfiguracion = document.querySelector('.nav-item[data-view="view-configuracion"]');
  const navLogs = document.getElementById('nav-logs') || document.querySelector('.nav-item[data-view="view-logs"]');
  const btnNuevoExp = document.getElementById('btn-nuevo-expediente');

  if (rol === 'consultor') {
    if (navAutomatizaciones) navAutomatizaciones.style.display = 'none';
    if (navConfiguracion) navConfiguracion.style.display = 'none';
    if (navLogs) navLogs.style.display = 'none';
    if (btnNuevoExp) btnNuevoExp.style.display = 'none';
  } else if (rol === 'operador') {
    if (navAutomatizaciones) navAutomatizaciones.style.display = 'flex';
    if (navConfiguracion) navConfiguracion.style.display = 'none';
    if (navLogs) navLogs.style.display = 'none';
    if (btnNuevoExp) btnNuevoExp.style.display = 'inline-flex';
  } else {
    if (navAutomatizaciones) navAutomatizaciones.style.display = 'flex';
    if (navConfiguracion) navConfiguracion.style.display = 'flex';
    if (navLogs) navLogs.style.display = 'flex';
    if (btnNuevoExp) btnNuevoExp.style.display = 'inline-flex';
  }

  actualizarVisibilidadCategoriasNav();
}

// Oculta un encabezado de categoría del menú (.nav-category-header) si,
// tras aplicar las reglas de rol de arriba, ninguno de los ítems que
// agrupa quedó visible. No conoce roles directamente — se auto-ajusta
// ante cualquier cambio futuro en qué ve cada rol, sin mantenimiento.
function actualizarVisibilidadCategoriasNav() {
  document.querySelectorAll('.nav-category-header').forEach(header => {
    let sibling = header.nextElementSibling;
    let hayVisible = false;
    while (sibling && !sibling.classList.contains('nav-category-header')) {
      if (sibling.classList.contains('nav-item') && getComputedStyle(sibling).display !== 'none') {
        hayVisible = true;
        break;
      }
      sibling = sibling.nextElementSibling;
    }
    header.style.display = hayVisible ? '' : 'none';
  });
}

// ─────────────────────────────────────────────
// BLINDAJE VISUAL RBAC: modo solo lectura en modales editables
// El consultor puede ver expedientes/citas pero nunca editarlos —
// esto solo evita una experiencia confusa (campo editable que el
// backend rechazaría); la protección real está en requireRole().
// ─────────────────────────────────────────────
function aplicarModoSoloLectura(formId, btnGuardarId) {
  const rol = (state.usuarioActual && state.usuarioActual.rol) || 'consultor';
  const soloLectura = rol === 'consultor';

  const form = document.getElementById(formId);
  if (form) {
    form.querySelectorAll('input, select, textarea').forEach(el => {
      el.disabled = soloLectura;
    });
  }

  const btnGuardar = document.getElementById(btnGuardarId);
  if (btnGuardar) {
    btnGuardar.style.display = soloLectura ? 'none' : '';
  }

  return soloLectura;
}

// ─────────────────────────────────────────────
// COLA DE CONCURRENCIA INTELIGENTE (QUEUE-LOCK)
// ─────────────────────────────────────────────
async function ejecutarGuardadoConLock(accionGuardado) {
  // Si hay una sincronización pasiva en segundo plano, esperar a que asiente los datos frescos
  if (state.operacionEnProgreso && !state.guardandoDatos) {
    let intentos = 0;
    while (state.operacionEnProgreso && intentos < 30) {
      await new Promise(r => setTimeout(r, 100));
      intentos++;
    }
  }

  state.guardandoDatos = true;
  try {
    return await accionGuardado();
  } finally {
    state.guardandoDatos = false;
  }
}
window.ejecutarGuardadoConLock = ejecutarGuardadoConLock;

async function cargarDatosEnVivo(silencioso = true) {
  const btnSync = document.getElementById('btn-sync-header') || document.getElementById('btn-sync-top');
  
  // 1. Si la pantalla está bloqueada por inactividad, la pestaña oculta/minimizada o sin sesión, abortar auto-sync
  const estaBloqueado = (typeof LockScreen !== 'undefined' && LockScreen.bloqueado) || Boolean(document.getElementById('modal-lock-screen')?.classList.contains('active'));
  const sinSesion = !localStorage.getItem('lmd_jwt_token') || localStorage.getItem('sesion_lmd_activa') !== 'true';

  if (estaBloqueado || document.hidden || sinSesion) {
    if (btnSync) setBotonCargando(btnSync, false, null, '🔄 Sincronizar');
    return;
  }

  // 2. Si hay un modal abierto o guardado humano en progreso, omitir auto-sincronizaciones pasivas
  const modalAbierto = Boolean(document.querySelector('.modal-backdrop.active, .modal.active'));
  if (silencioso && (state.guardandoDatos || modalAbierto)) {
    if (btnSync) setBotonCargando(btnSync, false, null, '🔄 Sincronizar');
    return;
  }

  if (btnSync) setBotonCargando(btnSync, true, 'Sincronizando...');

  if (!silencioso && !document.getElementById('app-loading-screen')?.classList.contains('active')) {
    mostrarSplashLoader('☁️ Conectando con Workspace...', 'Sincronizando expedientes y analítica...');
  }

  state.operacionEnProgreso = true;

  try {
    // 3. Petición única de alto rendimiento (Bootstrap Completo)
    const resExp = await API.getDashboardYExpedientes();

    if (resExp && (resExp.success || resExp.ok || !resExp.error)) {
      if (resExp.expedientes && resExp.expedientes.length > 0) state.expedientes = resExp.expedientes;
      if (resExp.dashboardKPIs && Object.keys(resExp.dashboardKPIs).length > 0) state.dashboardKPIs = resExp.dashboardKPIs;
      if (resExp.configSistema && Object.keys(resExp.configSistema).length > 0) state.configSistema = resExp.configSistema;
      if (resExp.citas && resExp.citas.length > 0) state.citas = resExp.citas;
      if (resExp.verificacionesHabana && resExp.verificacionesHabana.length > 0) state.verificacionesHabana = resExp.verificacionesHabana;
      if (resExp.verificacionesRCC && resExp.verificacionesRCC.length > 0) state.verificacionesRCC = resExp.verificacionesRCC;
      state.ultimoSyncTimestamp = Date.now();

      if (resExp.modoPrueba !== undefined) {
        actualizarSwitchModoPrueba(resExp.modoPrueba);
      }

      // 1. Dashboard y Gráficos
      actualizarKPIsDashboard(state.dashboardKPIs);
      renderizarGraficos();

      // 2. Expedientes y Paginación
      if (typeof actualizarOpcionesConsuladosExpedientes === 'function') {
        actualizarOpcionesConsuladosExpedientes();
      }
      aplicarFiltros();

      // 3. Cola de Citas y Paginación
      if (typeof actualizarOpcionesConsuladosCitas === 'function') {
        actualizarOpcionesConsuladosCitas();
      }
      aplicarFiltrosCitas();

      // 4. Seguimiento La Habana y Seguimiento RCC
      if (typeof aplicarFiltrosHabana === 'function') aplicarFiltrosHabana();
      if (typeof aplicarFiltrosRCC === 'function') aplicarFiltrosRCC();

      // 5. Centro de Automatizaciones (Action Cards)
      actualizarDatosTarjetasAutomatizacion();

      // 6. Configuración
      cargarConfiguracionEnFormulario();

      if (!silencioso) {
        Toast.success(`Sincronización completada (${state.expedientes.length} expedientes cargados).`);
      }
    } else {
      if (!silencioso) {
        Toast.error('Error al sincronizar datos: ' + (resExp?.error || 'Desconocido'));
      }
    }
  } catch (err) {
    if (!silencioso) {
      Toast.error('Excepción al conectar con el servidor: ' + err.message);
    }
  } finally {
    state.operacionEnProgreso = false;
    if (btnSync) setBotonCargando(btnSync, false);
    if (!silencioso) {
      setTimeout(() => ocultarSplashLoader(), 300);
    }
  }
}

function vincularEventosGlobales() {
  // Buscador universal en cabecera superior
  const inputGlobal = document.getElementById('global-search-input') || document.getElementById('search-global');
  if (inputGlobal) {
    inputGlobal.addEventListener('input', (e) => {
      const termino = e.target.value.trim();
      state.terminoBusqueda = termino;
      
      if (state.seccionActiva !== 'view-expedientes' && state.seccionActiva !== 'view-citas') {
        Router.navigateToView('view-expedientes');
      } else if (state.seccionActiva === 'view-expedientes') {
        aplicarFiltros();
      } else if (state.seccionActiva === 'view-citas') {
        aplicarFiltrosCitas();
      }
    });
  }

  // Cerrar sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      window.cerrarSesion();
    });
  }

  // Sincronizador manual en cabecera
  const btnSyncTop = document.getElementById('btn-sync-header') || document.getElementById('btn-sync-top');
  if (btnSyncTop) {
    btnSyncTop.addEventListener('click', () => {
      if (!state.operacionEnProgreso) {
        cargarDatosEnVivo(false);
      }
    });
  }

  // Switch de Modo Prueba en cabecera
  const btnSwitchModo = document.getElementById('btn-switch-modo');
  if (btnSwitchModo) {
    btnSwitchModo.addEventListener('click', () => {
      if (!state.operacionEnProgreso) {
        conmutarModoPruebaWeb();
      }
    });
  }

  // Formulario de Configuración
  const formCfg = document.getElementById('form-config-sistema') || document.getElementById('form-configuracion');
  if (formCfg) {
    formCfg.addEventListener('submit', (e) => guardarConfiguracionFormulario(e));
  }

  // Formulario de Usuarios Modal
  const formUsr = document.getElementById('form-usuario-modal');
  if (formUsr) {
    formUsr.addEventListener('submit', (e) => guardarUsuarioModal(e));
  }

  // Sincronizador Silencioso al recuperar el foco de ventana (Background Auto-Sync)
  window.addEventListener('focus', () => {
    const estaBloqueado = (typeof LockScreen !== 'undefined' && LockScreen.bloqueado) || Boolean(document.getElementById('modal-lock-screen')?.classList.contains('active'));
    if (state.sesionActiva && !estaBloqueado && !document.hidden && !state.operacionEnProgreso && (Date.now() - (state.ultimoSyncTimestamp || 0) > 30000)) {
      cargarDatosEnVivo(true);
    }
  });

  // Temporizador pasivo de refresco en segundo plano (cada 90 segundos)
  setInterval(() => {
    const estaBloqueado = (typeof LockScreen !== 'undefined' && LockScreen.bloqueado) || Boolean(document.getElementById('modal-lock-screen')?.classList.contains('active'));
    if (state.sesionActiva && !estaBloqueado && !document.hidden && !state.operacionEnProgreso) {
      cargarDatosEnVivo(true);
    }
  }, 90000);
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof ConfirmModal !== 'undefined') ConfirmModal.init();
  inicializarAuth();
  Router.init();
  vincularEventosGlobales();
  ModalExpediente.init();
  ModalAutomatizaciones.init();
  if (typeof ConfiguracionView !== 'undefined' && typeof ConfiguracionView.init === 'function') {
    ConfiguracionView.init();
  }

  if (state.sesionActiva) {
    cargarDatosEnVivo(false);
  }
});
