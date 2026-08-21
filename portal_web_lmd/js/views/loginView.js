// =============================================================================
// VISTA: LOGIN DEDICADO (loginView.js) — RUTA #/login
// Identidad Oficial: EM • Portal de acceso — Centro de mando
// =============================================================================

const LoginView = {
  
  init() {
    const form = document.getElementById('login-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleLogin(e));
    }
  },

  async handleLogin(e) {
    if (e) e.preventDefault();

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const btnSubmit = document.getElementById('btn-login-submit');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!email || !password) {
      Toast.error('Por favor, ingresa tu correo electrónico y contraseña.');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.dataset.defaultHtml = btnSubmit.innerHTML;
      btnSubmit.innerHTML = '<span class="spinner-icon"></span> Verificando credenciales...';
    }

    if (typeof mostrarSplashLoader === 'function') {
      mostrarSplashLoader('🔐 Verificando credenciales...', 'Iniciando sesión en Portal EM');
    }

    try {
      const res = await API.login(email, password);

      if (res.success && res.token) {
        state.usuarioActual = res.user || { email, rol: 'admin', nombre: 'Usuario EM' };
        state.sesionActiva = true;
        localStorage.setItem('lmd_ultimo_acceso_ts', Date.now().toString());

        // 1. Abrir la app principal de inmediato para no retener la tarjeta de login
        mostrarAppPrincipal();
        const destino = state.rutaPrevia && state.rutaPrevia !== '#/login' ? state.rutaPrevia : '#/dashboard';
        state.rutaPrevia = null;
        Router.navigateToHash(destino);

        // 2. Activar velo de carga elegante mientras descarga los datos en 3s
        if (typeof mostrarSplashLoader === 'function') {
          mostrarSplashLoader('☁️ Conectando con Workspace...', 'Sincronizando expedientes y analítica...');
        }

        // 3. Sincronización ultra-rápida unificada
        if (typeof cargarDatosEnVivo === 'function') {
          await cargarDatosEnVivo(false);
        }

        Toast.success(`¡Bienvenido, ${state.usuarioActual.nombre || 'Administrador'}!`);

        if (typeof ocultarSplashLoader === 'function') {
          setTimeout(() => ocultarSplashLoader(), 350);
        }
      } else {
        if (typeof ocultarSplashLoader === 'function') ocultarSplashLoader();
        Toast.error(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch (err) {
      if (typeof ocultarSplashLoader === 'function') ocultarSplashLoader();
      Toast.error('Error de conexión con el servidor de autenticación.');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = btnSubmit.dataset.defaultHtml || '<span>Ingresar al Portal Seguro</span> ➔';
      }
    }
  }
};

function toggleLoginPasswordVisibility() {
  const input = document.getElementById('login-password');
  const btn = document.getElementById('btn-toggle-password');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerText = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.innerText = '👁️';
  }
}
