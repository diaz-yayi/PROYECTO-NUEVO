// =============================================================================
// CLIENTE API SEGURO (api.js) — CONSUMO DE ENDPOINTS PROTEGIDOS POR JWT
// =============================================================================

const API = {
  BASE_URL: 'api',

  getHeaders() {
    // La sesión viaja en una cookie httpOnly gestionada automáticamente
    // por el navegador (ver credentials: 'same-origin' en request()) —
    // ya no se adjunta ningún token de sesión manualmente desde JS.
    // El valor CSRF sí es legible por JS a propósito (se entregó en el
    // body de login.php) — es la mitad "de doble envío" del patrón CSRF.
    const headers = {
      'Content-Type': 'application/json'
    };
    const csrfToken = localStorage.getItem('lmd_csrf_token');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
  },

  async request(endpoint, options = {}) {
    options.headers = {
      ...this.getHeaders(),
      ...(options.headers || {})
    };
    options.credentials = 'same-origin';

    const isLocalDev = Boolean(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    try {
      const response = await fetch(`${this.BASE_URL}/${endpoint}`, options);

      if (response.status === 401) {
        localStorage.removeItem('sesion_lmd_activa');
        if (typeof Router !== 'undefined') {
          Router.navigateToHash('#/login');
        }
        return { success: false, ok: false, error: 'Sesión expirada. Por favor, vuelve a iniciar sesión.' };
      }

      if (!response.ok) {
        if (isLocalDev) {
          return await this.fallbackLocalDevelopment(endpoint, options);
        }
        return { success: false, ok: false, error: `Error de servidor (${response.status}).` };
      }

      const text = await response.text();

      // Si se ejecuta en servidor de desarrollo estático local sin PHP
      if (text.trim().startsWith('<?php') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        if (isLocalDev) {
          return await this.fallbackLocalDevelopment(endpoint, options);
        }
        return { success: false, ok: false, error: 'Respuesta inválida del servidor.' };
      }

      const data = JSON.parse(text);
      return data;
    } catch (error) {
      if (isLocalDev) {
        return await this.fallbackLocalDevelopment(endpoint, options);
      }
      return { success: false, ok: false, error: 'Conexión de red suspendida o no disponible.' };
    }
  },

  // Fallback seguro exclusivo para desarrollo local (offline mock)
  async fallbackLocalDevelopment(endpoint, options = {}) {
    let payload = {};
    if (options.body) {
      try { payload = JSON.parse(options.body); } catch(e) {}
    }

    // ─────────────────────────────────────────────
    // GESTIÓN DE USUARIOS LOCALES (STORAGE FALLBACK)
    // ─────────────────────────────────────────────
    let localUsers = [];
    try {
      const stored = localStorage.getItem('lmd_usuarios_locales');
      if (stored) {
        localUsers = JSON.parse(stored);
      }
    } catch(e) {}

    if (!localUsers || localUsers.length === 0) {
      localUsers = [
        { id: 1, email: 'admin@estelamarina.com', password: 'EM_Admin_2026!', nombre: 'Administrador EM', rol: 'admin', estado: 'activo', ultimo_acceso: new Date().toISOString() },
        { id: 2, email: 'operador@estelamarina.com', password: 'EM_Operador_2026!', nombre: 'Gestor Consular', rol: 'operador', estado: 'activo', ultimo_acceso: new Date().toISOString() }
      ];
      localStorage.setItem('lmd_usuarios_locales', JSON.stringify(localUsers));
    }

    if (endpoint.includes('login.php')) {
      const email = (payload.email || '').toLowerCase().trim();
      const pass = payload.password || '';
      
      const found = localUsers.find(u => (u.email || '').toLowerCase() === email);
      
      if (found) {
        if (found.estado !== 'activo') {
          return { success: false, error: 'Usuario inactivo. Contacta al administrador.' };
        }
        if (found.password === pass) {
          found.ultimo_acceso = new Date().toISOString();
          localStorage.setItem('lmd_usuarios_locales', JSON.stringify(localUsers));
          return {
            success: true,
            token: 'local_dev_jwt_' + btoa(found.email),
            user: { id: found.id, email: found.email, nombre: found.nombre, rol: found.rol }
          };
        } else {
          return { success: false, error: 'Contraseña incorrecta. Por favor, verifica tus datos.' };
        }
      } else {
        return { success: false, error: 'Usuario no encontrado en la base de datos local.' };
      }
    }

    if (endpoint.includes('verify.php')) {
      return { success: true, user: state.usuarioActual || localUsers[0] };
    }

    if (endpoint.includes('users/index.php')) {
      return { success: true, users: localUsers };
    }

    if (endpoint.includes('users/create.php')) {
      const nuevoId = localUsers.length > 0 ? Math.max(...localUsers.map(u => u.id)) + 1 : 1;
      const nuevoUsr = {
        id: nuevoId,
        email: payload.email,
        password: payload.password || 'EM_Pass_2026!',
        nombre: payload.nombre || 'Nuevo Usuario',
        rol: payload.rol || 'operador',
        estado: payload.estado || 'activo',
        ultimo_acceso: new Date().toISOString()
      };
      localUsers.push(nuevoUsr);
      localStorage.setItem('lmd_usuarios_locales', JSON.stringify(localUsers));
      return { success: true, message: 'Usuario creado exitosamente.', user: nuevoUsr };
    }

    if (endpoint.includes('users/update.php')) {
      const idx = localUsers.findIndex(u => u.id === payload.id || u.email === payload.email);
      if (idx !== -1) {
        if (payload.nombre) localUsers[idx].nombre = payload.nombre;
        if (payload.email) localUsers[idx].email = payload.email;
        if (payload.rol) localUsers[idx].rol = payload.rol;
        if (payload.estado) localUsers[idx].estado = payload.estado;
        if (payload.password && payload.password.trim().length > 0) {
          localUsers[idx].password = payload.password.trim();
        }
        localStorage.setItem('lmd_usuarios_locales', JSON.stringify(localUsers));
        return { success: true, message: 'Usuario actualizado correctamente.', user: localUsers[idx] };
      }
      return { success: false, error: 'Usuario no encontrado.' };
    }

    if (endpoint.includes('users/delete.php')) {
      localUsers = localUsers.filter(u => u.id !== payload.id);
      localStorage.setItem('lmd_usuarios_locales', JSON.stringify(localUsers));
      return { success: true, message: 'Usuario eliminado.' };
    }

    if (endpoint.includes('expedientes.php')) {
      if (options.method === 'POST') {
        return { success: true, ok: true, mensaje: 'Guardado simulado local.' };
      } else {
        return {
          success: true,
          ok: true,
          expedientes: state.expedientes || [],
          dashboardKPIs: state.dashboardKPIs || {},
          configSistema: state.configSistema || {},
          modoPrueba: state.modoPrueba !== undefined ? state.modoPrueba : true
        };
      }
    } 

    if (endpoint.includes('citas.php')) {
      if (options.method === 'POST') {
        return { success: true, ok: true, mensaje: 'Cita actualizada localmente.' };
      } else {
        return {
          success: true,
          ok: true,
          candidatos: state.citas || []
        };
      }
    }

    if (endpoint.includes('automatizaciones.php')) {
      return { success: true, ok: true, mensaje: 'Proceso de automatización completado en modo local.' };
    }

    if (endpoint.includes('logs/security.php')) {
      const storedSecurityLogs = JSON.parse(localStorage.getItem('lmd_logs_seguridad_local') || '[]');
      if (storedSecurityLogs.length === 0) {
        storedSecurityLogs.push({
          id: 1,
          usuario_id: 1,
          nombre: 'Administrador EM',
          email: 'admin@lmd2022.com',
          evento: 'LOGIN_EXITOSO',
          ip_origen: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          detalles: 'Inicio de sesión con éxito en el portal administrativo',
          creado_en: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      }
      return { success: true, logs: storedSecurityLogs, total: storedSecurityLogs.length };
    }

    if (endpoint.includes('logs/operaciones.php')) {
      return { ok: true, success: true, logs: state.logsOperaciones || [], total: (state.logsOperaciones || []).length };
    }

    if (endpoint.includes('configuracion.php')) {
      return { success: true, ok: true, config: state.configSistema || {} };
    }

    return { success: true, ok: true };
  },

  // ─────────────────────────────────────────────
  // MÉTODOS PÚBLICOS
  // ─────────────────────────────────────────────
  async login(email, password) {
    const res = await this.request('auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.success) {
      // El token ya no llega en el body: el servidor lo fija como cookie
      // httpOnly. Solo guardamos una bandera no sensible ("hay sesión")
      // para que la UI (pantalla de login vs app, bloqueo por inactividad)
      // sepa qué mostrar sin poder leer nunca la cookie real.
      localStorage.setItem('sesion_lmd_activa', 'true');
      if (res.csrfToken) {
        localStorage.setItem('lmd_csrf_token', res.csrfToken);
      }
      if (res.user) {
        localStorage.setItem('lmd_user_profile', JSON.stringify(res.user));
        state.usuarioActual = res.user;
      }
    }
    return res;
  },

  async verifySession() {
    return await this.request('auth/verify.php', { method: 'GET' });
  },

  async logout() {
    try {
      await this.request('auth/logout.php', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('sesion_lmd_activa');
    localStorage.removeItem('lmd_user_profile');
    localStorage.removeItem('lmd_csrf_token');
    state.usuarioActual = null;
    state.sesionActiva = false;
    Router.navigateToHash('#/login');
  },

  // Gestión de Usuarios (RBAC)
  async getUsers() {
    return await this.request('users/index.php', { method: 'GET' });
  },

  async createUser(userData) {
    return await this.request('users/create.php', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async updateUser(userData) {
    return await this.request('users/update.php', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async deleteUser(userId) {
    return await this.request('users/delete.php', {
      method: 'POST',
      body: JSON.stringify({ id: userId })
    });
  },

  async getDashboardYExpedientes() {
    return await this.request('expedientes.php', { method: 'GET' });
  },

  async guardarExpediente(datos, accion = 'guardar_expediente_general') {
    return await this.request('expedientes.php', {
      method: 'POST',
      body: JSON.stringify({ accion, datos })
    });
  },

  async getColaCitas(consulado = '') {
    const query = consulado ? `?consulado=${encodeURIComponent(consulado)}` : '';
    return await this.request(`citas.php${query}`, { method: 'GET' });
  },

  async transferirCita(datos) {
    return await this.request('citas.php', {
      method: 'POST',
      body: JSON.stringify({ datos })
    });
  },

  async ejecutarAutomatizacion(accion, payload = {}) {
    return await this.request('automatizaciones.php', {
      method: 'POST',
      body: JSON.stringify({ accion, payload })
    });
  },

  async getConfiguracion() {
    return await this.request('configuracion.php', { method: 'GET' });
  },

  async guardarConfiguracion(datosConfig) {
    return await this.request('configuracion.php', {
      method: 'POST',
      body: JSON.stringify({ config: datosConfig })
    });
  },

  async obtenerLogsOperaciones() {
    return await this.request('logs/operaciones.php', { method: 'GET' });
  },

  async obtenerLogsSeguridad() {
    return await this.request('logs/security.php', { method: 'GET' });
  },

  async getVerificacionesHabana() {
    return await this.request('verificaciones/habana.php', { method: 'GET' });
  },

  async getVerificacionesRCC() {
    return await this.request('verificaciones/rcc.php', { method: 'GET' });
  }
};
