// =============================================================================
// COMPONENTE: BLOQUEO POR INACTIVIDAD Y SESIÓN (lockScreen.js)
// Nivel 1: Bloqueo tras 2 horas (Preserva ruta y estado de pantalla)
// Nivel 2: Expiración total tras 48 horas (Cierre y purga completa)
// =============================================================================

const LockScreen = {
  TIEMPO_BLOQUEO_MS: 2 * 60 * 60 * 1000,    // 2 horas en milisegundos
  TIEMPO_EXPIRACION_MS: 48 * 60 * 60 * 1000, // 48 horas en milisegundos
  intervaloCheck: null,
  bloqueado: false,

  init() {
    this.registrarInteraccion();

    // Escuchar eventos globales de interacción del usuario
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(evt => {
      window.addEventListener(evt, () => {
        if (!this.bloqueado) {
          this.registrarInteraccion();
        }
      }, { passive: true });
    });

    // Iniciar monitor cada 30 segundos
    if (this.intervaloCheck) clearInterval(this.intervaloCheck);
    this.intervaloCheck = setInterval(() => this.verificarInactividad(), 30000);

    // Formulario de desbloqueo
    const formUnlock = document.getElementById('form-unlock-screen');
    if (formUnlock) {
      formUnlock.addEventListener('submit', (e) => this.handleUnlock(e));
    }
  },

  registrarInteraccion() {
    localStorage.setItem('lmd_ultima_actividad', Date.now().toString());
  },

  verificarInactividad() {
    const token = localStorage.getItem('lmd_jwt_token');
    if (!token) return;

    const ultimaActividad = parseInt(localStorage.getItem('lmd_ultima_actividad') || Date.now().toString(), 10);
    const inactivoMs = Date.now() - ultimaActividad;

    // Nivel 2: Más de 48 horas -> Cierre total de sesión
    if (inactivoMs >= this.TIEMPO_EXPIRACION_MS) {
      this.cerrarSesionExpirada();
      return;
    }

    // Nivel 1: Más de 2 horas -> Bloqueo temporal conservando ruta
    if (inactivoMs >= this.TIEMPO_BLOQUEO_MS && !this.bloqueado) {
      this.activarBloqueo();
    }
  },

  activarBloqueo() {
    this.bloqueado = true;
    state.rutaPrevia = window.location.hash || '#/dashboard';

    const modal = document.getElementById('modal-lock-screen');
    const userEmailDisplay = document.getElementById('lock-user-email');
    const userNameDisplay = document.getElementById('lock-user-name');
    const userAvatar = document.getElementById('lock-user-avatar');

    const usuario = state.usuarioActual || { email: 'admin@estelamarina.com', nombre: 'Administrador EM' };
    
    if (userEmailDisplay) userEmailDisplay.innerText = usuario.email || 'admin@estelamarina.com';
    if (userNameDisplay) userNameDisplay.innerText = usuario.nombre || 'Administrador';
    if (userAvatar) {
      const iniciales = (usuario.nombre || 'EM').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      userAvatar.innerText = iniciales;
    }

    const passInput = document.getElementById('unlock-password');
    if (passInput) passInput.value = '';

    if (modal) modal.classList.add('active');
    if (typeof Toast !== 'undefined') Toast.warning('Sesión en pausa por inactividad.');
  },

  async handleUnlock(e) {
    if (e) e.preventDefault();

    const passInput = document.getElementById('unlock-password');
    const btnUnlock = document.getElementById('btn-unlock-submit');
    const password = passInput ? passInput.value.trim() : '';

    if (!password) {
      Toast.error('Por favor, ingresa tu contraseña para desbloquear.');
      return;
    }

    if (btnUnlock) {
      btnUnlock.disabled = true;
      btnUnlock.innerHTML = '<span class="spinner-icon"></span> Validando...';
    }

    try {
      const email = (state.usuarioActual && state.usuarioActual.email) || 'admin@estelamarina.com';
      const res = await API.login(email, password);

      if (res.success && res.token) {
        this.bloqueado = false;
        this.registrarInteraccion();

        const modal = document.getElementById('modal-lock-screen');
        if (modal) modal.classList.remove('active');

        Toast.success('Sesión reactivada con éxito.');

        // Sincronización silenciosa en segundo plano
        if (typeof cargarDatosEnVivo === 'function') {
          cargarDatosEnVivo(true);
        }

        // Restaurar la vista exacta
        if (state.rutaPrevia && window.location.hash !== state.rutaPrevia) {
          Router.navigateToHash(state.rutaPrevia);
        }
      } else {
        Toast.error('Contraseña incorrecta.');
      }
    } catch (err) {
      Toast.error('Error al conectar con el servidor.');
    } finally {
      if (btnUnlock) {
        btnUnlock.disabled = false;
        btnUnlock.innerHTML = 'Desbloquear Sesión';
      }
    }
  },

  cerrarSesionExpirada() {
    this.bloqueado = false;
    localStorage.removeItem('lmd_jwt_token');
    localStorage.removeItem('sesion_lmd_activa');
    localStorage.removeItem('lmd_ultima_actividad');
    
    const modal = document.getElementById('modal-lock-screen');
    if (modal) modal.classList.remove('active');

    Toast.error('Tu sesión ha expirado por superar las 48 horas de inactividad.');
    Router.navigateToHash('#/login');
  }
};
