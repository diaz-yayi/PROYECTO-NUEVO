// =============================================================================
// VISTA 5: CONFIGURACIÓN DEL DESPACHO Y GESTIÓN DE USUARIOS (configuracionView.js)
// Gestión de tiempos, modo prueba, identidad EM y Usuarios RBAC (Bcrypt)
// =============================================================================

function actualizarSwitchModoPrueba(modo) {
  if (modo !== undefined) {
    state.modoPrueba = (modo === true || modo === "true");
  }
  actualizarUIModoPrueba();
}

function actualizarUIModoPrueba() {
  const esPrueba = (state.modoPrueba === true || state.modoPrueba === "true");

  // 1. Botón en Cabecera Superior (Top Bar)
  const btnSwitch = document.getElementById('btn-switch-modo');
  if (btnSwitch) {
    if (esPrueba) {
      btnSwitch.className = 'modo-badge-btn prueba';
      btnSwitch.innerHTML = '🟡 Modo: PRUEBA';
      btnSwitch.title = 'Modo Prueba Activo (Simulacro Seguro). Clic para alternar a PRODUCCIÓN REAL.';
    } else {
      btnSwitch.className = 'modo-badge-btn produccion';
      btnSwitch.innerHTML = '🟢 Modo: PRODUCCIÓN';
      btnSwitch.title = 'Modo Producción Real Activo. Clic para alternar a MODO PRUEBA.';
    }
  }

  // 2. Switch en Módulo de Configuración
  const chkModoPrueba = document.getElementById('cfg-modo-prueba');
  const txtModoPrueba = document.getElementById('cfg-modo-prueba-texto');
  if (chkModoPrueba) chkModoPrueba.checked = esPrueba;
  if (txtModoPrueba) txtModoPrueba.innerText = esPrueba ? 'Simulacro Activo (Prueba)' : 'Producción Real';

  // 3. Email de pruebas destino
  const emailDestino = escapeHTML((state.configSistema && state.configSistema.EMAIL_PRUEBA)
    || (document.getElementById('cfg-email-prueba') ? document.getElementById('cfg-email-prueba').value.trim() : '')
    || 'tu email de prueba');

  // 4. Banners Reactivos de Modales de Automatizaciones
  const bannerVenc = document.getElementById('banner-modo-vencimientos');
  const bannerEnvios = document.getElementById('banner-modo-envios');
  const bannerHabana = document.getElementById('banner-modo-habana');
  const bannerCitasSync = document.getElementById('banner-modo-sincronizador-citas');

  const htmlBanner = esPrueba
    ? `<div style="font-size: 1.15rem; line-height: 1;">🟡</div>
       <div>
         <strong>MODO PRUEBA (SIMULACRO SEGURO) ACTIVO:</strong><br>
         <span>Las operaciones evalúan en tiempo real pero la base <em>EXPEDIENTES LMD</em> permanece protegida sin alteraciones y los correos se desvían exclusivamente a <strong>${emailDestino}</strong>.</span>
       </div>`
    : `<div style="font-size: 1.15rem; line-height: 1;">🟢</div>
       <div>
         <strong>MODO PRODUCCIÓN REAL:</strong><br>
         <span>¡Precaución! Las acciones enviarán notificaciones oficiales directamente a los correos de los clientes y actualizarán los estados de la base de datos.</span>
       </div>`;

  const claseBanner = esPrueba ? 'modo-alerta-banner prueba' : 'modo-alerta-banner produccion';

  if (bannerVenc) {
    bannerVenc.className = claseBanner;
    bannerVenc.innerHTML = htmlBanner;
  }
  if (bannerEnvios) {
    bannerEnvios.className = claseBanner;
    bannerEnvios.innerHTML = htmlBanner;
  }
  if (bannerHabana) {
    bannerHabana.className = claseBanner;
    bannerHabana.innerHTML = htmlBanner;
  }
  if (bannerCitasSync) {
    bannerCitasSync.className = claseBanner;
    bannerCitasSync.innerHTML = htmlBanner;
  }
}

async function conmutarModoPruebaWeb() {
  const btnSwitch = document.getElementById('btn-switch-modo');
  setBotonCargando(btnSwitch, true, 'Conmutando...');

  try {
    const nuevoModo = !state.modoPrueba;
    const res = await API.guardarConfiguracion({
      ...(state.configSistema || {}),
      MODO_PRUEBA: nuevoModo
    });

    if (res.ok || res.success) {
      state.modoPrueba = nuevoModo;
      if (state.configSistema) state.configSistema.MODO_PRUEBA = nuevoModo;
      actualizarUIModoPrueba();
      evaluarDirtyConfig();
      Toast.success(`Modo cambiado a: ${nuevoModo ? '🟡 MODO PRUEBA (Simulacro)' : '🟢 PRODUCCIÓN REAL'}`);
    } else {
      Toast.error('Error al conmutar modo: ' + (res.error || 'Desconocido'));
      actualizarUIModoPrueba();
    }
  } catch (err) {
    Toast.error('Excepción al conmutar modo: ' + err.message);
    actualizarUIModoPrueba();
  } finally {
    setBotonCargando(btnSwitch, false);
    actualizarUIModoPrueba();
  }
}

function tomarSnapshotConfig() {
  state.snapshotConfig = {
    MODO_PRUEBA: document.getElementById('cfg-modo-prueba') ? document.getElementById('cfg-modo-prueba').checked : true,
    EMAIL_PRUEBA: document.getElementById('cfg-email-prueba') ? document.getElementById('cfg-email-prueba').value.trim() : '',
    DIAS_CARENCIA_RESOLUCION: parseInt(document.getElementById('cfg-dias-carencia')?.value, 10) || 60,
    DIAS_CICLO_SEGUIMIENTO: parseInt(document.getElementById('cfg-dias-seguimiento')?.value, 10) || 30,
    DIAS_CICLO_TRAMITES: parseInt(document.getElementById('cfg-dias-tramites')?.value, 10) || 30,
    COLOR_ORO: document.getElementById('cfg-color-oro')?.value.trim() || '#D4AF37',
    COLOR_FONDO: document.getElementById('cfg-color-fondo')?.value.trim() || '#FFFFFF',
    COLOR_TEXTO: document.getElementById('cfg-color-texto')?.value.trim() || '#333333',
    URL_LOGO_PUBLICO: document.getElementById('cfg-url-logo')?.value.trim() || ''
  };

  const btnGuardar = document.getElementById('btn-guardar-config');
  if (btnGuardar) btnGuardar.disabled = true;
}

function formConfigIsDirty() {
  if (!state.snapshotConfig) return false;

  const actual = {
    MODO_PRUEBA: document.getElementById('cfg-modo-prueba') ? document.getElementById('cfg-modo-prueba').checked : true,
    EMAIL_PRUEBA: document.getElementById('cfg-email-prueba') ? document.getElementById('cfg-email-prueba').value.trim() : '',
    DIAS_CARENCIA_RESOLUCION: parseInt(document.getElementById('cfg-dias-carencia')?.value, 10) || 60,
    DIAS_CICLO_SEGUIMIENTO: parseInt(document.getElementById('cfg-dias-seguimiento')?.value, 10) || 30,
    DIAS_CICLO_TRAMITES: parseInt(document.getElementById('cfg-dias-tramites')?.value, 10) || 30,
    COLOR_ORO: document.getElementById('cfg-color-oro')?.value.trim() || '#D4AF37',
    COLOR_FONDO: document.getElementById('cfg-color-fondo')?.value.trim() || '#FFFFFF',
    COLOR_TEXTO: document.getElementById('cfg-color-texto')?.value.trim() || '#333333',
    URL_LOGO_PUBLICO: document.getElementById('cfg-url-logo')?.value.trim() || ''
  };

  return JSON.stringify(state.snapshotConfig) !== JSON.stringify(actual);
}

function evaluarDirtyConfig() {
  const isDirty = formConfigIsDirty();
  const btnGuardar = document.getElementById('btn-guardar-config');
  if (btnGuardar) btnGuardar.disabled = !isDirty;
}

window.formConfigIsDirty = formConfigIsDirty;

function cargarConfiguracionEnFormulario() {
  const cfg = state.configSistema;
  if (!cfg) return;

  const inEmail = document.getElementById('cfg-email-prueba');
  const inCarencia = document.getElementById('cfg-dias-carencia');
  const inSeguimiento = document.getElementById('cfg-dias-seguimiento');
  const inTramites = document.getElementById('cfg-dias-tramites');
  const inColorOro = document.getElementById('cfg-color-oro');
  const pickerColorOro = document.getElementById('cfg-color-oro-picker');
  const inColorFondo = document.getElementById('cfg-color-fondo');
  const pickerColorFondo = document.getElementById('cfg-color-fondo-picker');
  const inColorTexto = document.getElementById('cfg-color-texto');
  const pickerColorTexto = document.getElementById('cfg-color-texto-picker');
  const inUrlLogo = document.getElementById('cfg-url-logo');
  const chkModoPrueba = document.getElementById('cfg-modo-prueba');
  const txtModoPrueba = document.getElementById('cfg-modo-prueba-texto');

  const esPrueba = (cfg.MODO_PRUEBA === true || cfg.MODO_PRUEBA === "true");
  if (chkModoPrueba) chkModoPrueba.checked = esPrueba;
  if (txtModoPrueba) txtModoPrueba.innerText = esPrueba ? 'Simulacro Activo (Prueba)' : 'Producción Real';

  if (inEmail) inEmail.value = cfg.EMAIL_PRUEBA || 'yanglienlc@gmail.com';
  if (inCarencia) inCarencia.value = cfg.DIAS_CARENCIA_RESOLUCION || 60;
  if (inSeguimiento) inSeguimiento.value = cfg.DIAS_CICLO_SEGUIMIENTO || 30;
  if (inTramites) inTramites.value = cfg.DIAS_CICLO_TRAMITES || 30;
  if (inColorOro) inColorOro.value = cfg.COLOR_ORO || '#D4AF37';
  if (pickerColorOro) pickerColorOro.value = cfg.COLOR_ORO || '#D4AF37';
  if (inColorFondo) inColorFondo.value = cfg.COLOR_FONDO || '#FFFFFF';
  if (pickerColorFondo) pickerColorFondo.value = cfg.COLOR_FONDO || '#FFFFFF';
  if (inColorTexto) inColorTexto.value = cfg.COLOR_TEXTO || '#333333';
  if (pickerColorTexto) pickerColorTexto.value = cfg.COLOR_TEXTO || '#333333';
  if (inUrlLogo) inUrlLogo.value = cfg.URL_LOGO_PUBLICO || '';

  tomarSnapshotConfig();
}

async function guardarConfiguracionFormulario(e) {
  if (e) e.preventDefault();

  const btn = document.getElementById('btn-guardar-config');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '💾 Guardando en Sheets...';
  }

  const esPruebaChecked = document.getElementById('cfg-modo-prueba').checked;

  const datosConfig = {
    MODO_PRUEBA: esPruebaChecked,
    EMAIL_PRUEBA: document.getElementById('cfg-email-prueba').value.trim(),
    DIAS_CARENCIA_RESOLUCION: parseInt(document.getElementById('cfg-dias-carencia').value, 10),
    DIAS_CICLO_SEGUIMIENTO: parseInt(document.getElementById('cfg-dias-seguimiento').value, 10),
    DIAS_CICLO_TRAMITES: parseInt(document.getElementById('cfg-dias-tramites').value, 10),
    COLOR_ORO: document.getElementById('cfg-color-oro').value.trim(),
    COLOR_FONDO: document.getElementById('cfg-color-fondo').value.trim(),
    COLOR_TEXTO: document.getElementById('cfg-color-texto').value.trim(),
    URL_LOGO_PUBLICO: document.getElementById('cfg-url-logo').value.trim()
  };

  try {
    const res = await API.guardarConfiguracion(datosConfig);
    if (res.ok || res.success) {
      Toast.success('Configuración del despacho guardada exitosamente en Google Sheets.');
      actualizarSwitchModoPrueba(esPruebaChecked);
      tomarSnapshotConfig();
      if (typeof cargarDatosEnVivo === 'function') cargarDatosEnVivo();
    } else {
      Toast.error('Error al guardar: ' + (res.error || 'Desconocido'));
    }
  } catch (err) {
    Toast.error('Excepción: ' + err.message);
  } finally {
    if (btn) {
      btn.innerText = '💾 Guardar Configuración en Google Sheets';
      evaluarDirtyConfig();
    }
  }
}

// ─────────────────────────────────────────────
// GESTIÓN DE USUARIOS Y ROLES (RBAC)
// ─────────────────────────────────────────────

async function cargarUsuariosEnTabla() {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-dim);">Cargando usuarios del sistema...</td></tr>`;

  try {
    const res = await API.getUsers();
    if (res.success && Array.isArray(res.users)) {
      state.usuariosSistema = res.users;
      renderizarTablaUsuarios(res.users);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--accent-red);">No se pudieron cargar los usuarios: ${res.error || 'Error'}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--accent-red);">Error al conectar con la base de datos de usuarios.</td></tr>`;
  }
}

function renderizarTablaUsuarios(users) {
  const tbody = document.getElementById('tabla-usuarios-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay usuarios registrados.</td></tr>`;
    return;
  }

  const roleBadges = {
    'admin': '<span class="badge" style="background: rgba(212, 175, 55, 0.15); color: #D4AF37; border: 1px solid rgba(212, 175, 55, 0.3);">👑 Administrador</span>',
    'operador': '<span class="badge" style="background: rgba(34, 211, 238, 0.15); color: #22D3EE; border: 1px solid rgba(34, 211, 238, 0.3);">⚡ Operador</span>',
    'consultor': '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.3);">👁️ Consultor</span>'
  };

  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="font-weight: 700; color: #FFFFFF;">${escapeHTML(u.nombre || '—')}</td>
      <td style="color: var(--text-dim); font-family: monospace;">${escapeHTML(u.email)}</td>
      <td>${roleBadges[u.rol] || u.rol}</td>
      <td>
        <span class="badge ${u.estado === 'activo' ? 'badge-concedido' : 'badge-desestimado'}">
          ${u.estado === 'activo' ? '🟢 Activo' : '🔴 Inactivo'}
        </span>
      </td>
      <td style="font-size: 0.76rem; color: var(--text-muted);">
        ${u.ultimo_acceso ? formatFecha(u.ultimo_acceso) : 'Sin accesos'}
      </td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-ghost" onclick="abrirModalUsuario(${u.id})" title="Editar Usuario" style="padding: 4px 8px; font-size: 0.75rem;">
          ✏️ Editar
        </button>
        <button class="btn btn-sm btn-ghost" onclick="eliminarUsuarioConfirmado(${u.id})" title="Eliminar Usuario" style="padding: 4px 8px; font-size: 0.75rem; color: var(--accent-red);">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function tomarSnapshotUsuario() {
  state.snapshotUsuario = {
    id: document.getElementById('usr-id')?.value || '',
    nombre: document.getElementById('usr-nombre')?.value.trim() || '',
    email: document.getElementById('usr-email')?.value.trim() || '',
    password: document.getElementById('usr-password')?.value.trim() || '',
    rol: document.getElementById('usr-rol')?.value || 'operador',
    estado: document.getElementById('usr-estado')?.value || 'activo'
  };
  evaluarDirtyUsuario();
}

function formUsuarioIsDirty() {
  if (!state.snapshotUsuario) return false;
  const actual = {
    id: document.getElementById('usr-id')?.value || '',
    nombre: document.getElementById('usr-nombre')?.value.trim() || '',
    email: document.getElementById('usr-email')?.value.trim() || '',
    password: document.getElementById('usr-password')?.value.trim() || '',
    rol: document.getElementById('usr-rol')?.value || 'operador',
    estado: document.getElementById('usr-estado')?.value || 'activo'
  };
  return JSON.stringify(state.snapshotUsuario) !== JSON.stringify(actual);
}
window.formUsuarioIsDirty = formUsuarioIsDirty;

function evaluarDirtyUsuario() {
  const isDirty = formUsuarioIsDirty();
  const btnGuardar = document.getElementById('btn-guardar-usuario');
  if (btnGuardar) btnGuardar.disabled = !isDirty;
}
window.evaluarDirtyUsuario = evaluarDirtyUsuario;

function abrirModalUsuario(userId = null) {
  const modal = document.getElementById('modal-usuario');
  const title = document.getElementById('modal-usuario-title');
  const passHelp = document.getElementById('modal-usuario-pass-help');

  const inId = document.getElementById('usr-id');
  const inNombre = document.getElementById('usr-nombre');
  const inEmail = document.getElementById('usr-email');
  const inPass = document.getElementById('usr-password');
  const inRol = document.getElementById('usr-rol');
  const inEstado = document.getElementById('usr-estado');

  if (userId) {
    const user = (state.usuariosSistema || []).find(u => u.id === userId);
    if (!user) return;

    if (title) title.innerText = 'Editar Usuario del Sistema';
    if (inId) inId.value = user.id;
    if (inNombre) inNombre.value = user.nombre || '';
    if (inEmail) inEmail.value = user.email || '';
    if (inPass) {
      inPass.value = '';
      inPass.required = false;
      inPass.placeholder = '•••••••• (Dejar en blanco para conservar actual)';
    }
    if (passHelp) passHelp.innerText = 'Deja el campo en blanco si no deseas cambiar la contraseña actual.';
    if (inRol) inRol.value = user.rol || 'operador';
    if (inEstado) inEstado.value = user.estado || 'activo';
  } else {
    if (title) title.innerText = 'Crear Nuevo Usuario';
    if (inId) inId.value = '';
    if (inNombre) inNombre.value = '';
    if (inEmail) inEmail.value = '';
    if (inPass) {
      inPass.value = '';
      inPass.required = true;
      inPass.placeholder = 'Ingresa al menos 8 caracteres';
    }
    if (passHelp) passHelp.innerText = 'Contraseña cifrada con Bcrypt (coste 12). Mínimo 8 caracteres.';
    if (inRol) inRol.value = 'operador';
    if (inEstado) inEstado.value = 'activo';
  }

  tomarSnapshotUsuario();
  if (modal) modal.classList.add('active');
}

async function cerrarModalUsuario(forzar = false) {
  if (!forzar && formUsuarioIsDirty()) {
    const nombre = document.getElementById('usr-nombre')?.value.trim() || 'este usuario';
    const confirmar = await ConfirmModal.descartarCambios(`los datos de ${nombre}`);
    if (!confirmar) return; // Continuar editando
  }

  const modal = document.getElementById('modal-usuario');
  if (modal) modal.classList.remove('active');
  state.snapshotUsuario = null;
}

async function guardarUsuarioModal(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('usr-id')?.value;
  const nombre = document.getElementById('usr-nombre')?.value.trim();
  const email = document.getElementById('usr-email')?.value.trim();
  const password = document.getElementById('usr-password')?.value.trim();
  const rol = document.getElementById('usr-rol')?.value;
  const estado = document.getElementById('usr-estado')?.value;

  if (!nombre || !email) {
    Toast.error('El nombre y correo electrónico son obligatorios.');
    return;
  }

  if (!id && (!password || password.length < 8)) {
    Toast.error('La contraseña para nuevos usuarios debe tener al menos 8 caracteres.');
    return;
  }

  const btnSubmit = document.getElementById('btn-guardar-usuario');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-icon"></span> Guardando...';
  }

  try {
    let res;
    if (id) {
      const payload = { id: parseInt(id, 10), nombre, email, rol, estado };
      if (password) payload.password = password;
      res = await API.updateUser(payload);
    } else {
      res = await API.createUser({ nombre, email, password, rol, estado });
    }

    if (res.success) {
      Toast.success(id ? 'Usuario actualizado correctamente.' : 'Usuario creado exitosamente.');
      tomarSnapshotUsuario();
      cerrarModalUsuario(true);
      cargarUsuariosEnTabla();
    } else {
      Toast.error(res.error || 'Error al guardar el usuario.');
    }
  } catch (err) {
    Toast.error('Excepción: ' + err.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Guardar Usuario';
      evaluarDirtyUsuario();
    }
  }
}

async function eliminarUsuarioConfirmado(userId) {
  const user = (state.usuariosSistema || []).find(u => u.id === userId);
  const nombreUser = user ? user.nombre : 'este usuario';

  const confirmar = await ConfirmModal.mostrar({
    icono: '🗑️',
    titulo: '¿Eliminar Usuario del Sistema?',
    mensaje: `¿Estás seguro de que deseas eliminar a "${nombreUser}"? Perderá el acceso de inmediato y esta acción no se puede deshacer.`,
    btnConfirmarTexto: 'Eliminar Usuario',
    btnCancelarTexto: 'Cancelar',
    colorConfirmar: '#ef4444'
  });

  if (!confirmar) return;

  try {
    const res = await API.deleteUser(userId);
    if (res.success) {
      Toast.success('Usuario eliminado del sistema.');
      cargarUsuariosEnTabla();
    } else {
      Toast.error(res.error || 'No se pudo eliminar el usuario.');
    }
  } catch (err) {
    Toast.error('Error al conectar con el servidor: ' + err.message);
  }
}

const ConfiguracionView = {
  init() {
    const formConfig = document.getElementById('form-config-sistema');
    if (formConfig) {
      formConfig.addEventListener('submit', guardarConfiguracionFormulario);
      formConfig.addEventListener('input', evaluarDirtyConfig);
      formConfig.addEventListener('change', evaluarDirtyConfig);
    }

    const formUsuario = document.getElementById('form-usuario-modal');
    if (formUsuario) {
      formUsuario.addEventListener('submit', guardarUsuarioModal);
      formUsuario.addEventListener('input', evaluarDirtyUsuario);
      formUsuario.addEventListener('change', evaluarDirtyUsuario);
    }

    // Sincronización Pickers de Color
    const inColorOro = document.getElementById('cfg-color-oro');
    const pickerColorOro = document.getElementById('cfg-color-oro-picker');
    if (pickerColorOro && inColorOro) {
      pickerColorOro.addEventListener('input', (e) => { inColorOro.value = e.target.value; evaluarDirtyConfig(); });
      inColorOro.addEventListener('input', (e) => { pickerColorOro.value = e.target.value; evaluarDirtyConfig(); });
    }

    const inColorFondo = document.getElementById('cfg-color-fondo');
    const pickerColorFondo = document.getElementById('cfg-color-fondo-picker');
    if (pickerColorFondo && inColorFondo) {
      pickerColorFondo.addEventListener('input', (e) => { inColorFondo.value = e.target.value; evaluarDirtyConfig(); });
      inColorFondo.addEventListener('input', (e) => { pickerColorFondo.value = e.target.value; evaluarDirtyConfig(); });
    }

    const inColorTexto = document.getElementById('cfg-color-texto');
    const pickerColorTexto = document.getElementById('cfg-color-texto-picker');
    if (pickerColorTexto && inColorTexto) {
      pickerColorTexto.addEventListener('input', (e) => { inColorTexto.value = e.target.value; evaluarDirtyConfig(); });
      inColorTexto.addEventListener('input', (e) => { pickerColorTexto.value = e.target.value; evaluarDirtyConfig(); });
    }

    const chkModoPrueba = document.getElementById('cfg-modo-prueba');
    const txtModoPrueba = document.getElementById('cfg-modo-prueba-texto');
    if (chkModoPrueba) {
      chkModoPrueba.addEventListener('change', (e) => {
        if (txtModoPrueba) txtModoPrueba.innerText = e.target.checked ? 'Simulacro Activo (Prueba)' : 'Producción Real';
        evaluarDirtyConfig();
      });
    }

    cargarConfiguracionEnFormulario();
  }
};

window.ConfiguracionView = ConfiguracionView;
window.abrirModalUsuario = abrirModalUsuario;
window.abrirModalCrearUsuario = abrirModalUsuario;
window.abrirModalEditarUsuario = abrirModalUsuario;
window.cerrarModalUsuario = cerrarModalUsuario;
window.guardarUsuarioModal = guardarUsuarioModal;
window.eliminarUsuarioConfirmado = eliminarUsuarioConfirmado;
