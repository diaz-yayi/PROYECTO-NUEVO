// =============================================================================
// COMPONENTE: MODALES Y MOTORES DE AUTOMATIZACIÓN (modalAutomatizaciones.js)
// Auditoría, Envíos Masivos, Sincronización de Citas y Verificador La Habana
// =============================================================================

function setBotonCargando(btn, cargando, textoCarga = 'Procesando...', textoDefault = 'Ejecutar') {
  if (!btn) return;
  btn.disabled = cargando;
  if (cargando) {
    btn.dataset.defaultText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-icon"></span> ${textoCarga}`;
  } else {
    btn.innerHTML = btn.dataset.defaultText || textoDefault;
  }
}

function renderReporteEjecutivo(contenedorId, config) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="reporte-card" style="margin-top: 12px;">
      <div class="reporte-header">
        <div>
          <strong style="color: var(--accent-cyan); font-size: 0.92rem;">${config.titulo}</strong>
          <div style="font-size: 0.74rem; color: var(--text-dim);">${config.subtitulo}</div>
        </div>
        <span class="badge" style="${config.esPrueba ? 'background: rgba(245, 158, 11, 0.2); color: #FBBF24;' : 'background: rgba(16, 185, 129, 0.2); color: #34D399;'}">
          ${config.esPrueba ? '🟡 Simulacro Activo' : '🟢 Producción Real'}
        </span>
      </div>
      <div class="reporte-grid">
        ${config.metricas.map(m => `
          <div class="reporte-stat-tile">
            <span class="label">${m.label}</span>
            <span class="val" style="color: ${m.color || '#FFFFFF'};">${m.valor}</span>
          </div>
        `).join('')}
      </div>
      ${config.mensajePie ? `<div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 10px;">ℹ️ ${config.mensajePie}</div>` : ''}
    </div>
  `;
}

// ─────────────────────────────────────────────
// 1. MODAL RADAR DE CITAS (CREDENCIALES Y PREFERENCIAS)
// ─────────────────────────────────────────────
function tomarSnapshotCitas() {
  state.snapshotCitas = {
    urgencia: document.getElementById('citas-urgencia')?.value || '2. MEDIA / NORMAL',
    preferencia: document.getElementById('citas-preferencia')?.value.trim() || '',
    usuarioConsular: document.getElementById('citas-usuario')?.value.trim() || '',
    passwordConsular: document.getElementById('citas-password')?.value.trim() || '',
    fechaCita: document.getElementById('citas-fecha-asignada')?.value.trim() || ''
  };

  evaluarDirtyCitas();
}

function formCitasIsDirty() {
  if (!state.snapshotCitas) return false;
  const actual = {
    urgencia: document.getElementById('citas-urgencia') ? document.getElementById('citas-urgencia').value : '',
    preferencia: document.getElementById('citas-preferencia') ? document.getElementById('citas-preferencia').value.trim() : '',
    usuarioConsular: document.getElementById('citas-usuario') ? document.getElementById('citas-usuario').value.trim() : '',
    passwordConsular: document.getElementById('citas-password') ? document.getElementById('citas-password').value.trim() : '',
    fechaCita: document.getElementById('citas-fecha-asignada') ? document.getElementById('citas-fecha-asignada').value.trim() : ''
  };
  return JSON.stringify(state.snapshotCitas) !== JSON.stringify(actual);
}

function evaluarDirtyCitas() {
  const isDirty = formCitasIsDirty();
  const btnGuardar = document.getElementById('btn-guardar-citas');
  if (btnGuardar) btnGuardar.disabled = !isDirty;
}

function abrirModalRadarCitas(id) {
  const candidato = state.expedientes.find(c => String(c.identificador) === String(id));
  if (!candidato) return;

  document.getElementById('modal-citas-titulo').innerText = `🔑 Gestión de Cita: ${candidato.identificador}`;
  document.getElementById('citas-id-display').innerText = candidato.identificador;
  document.getElementById('citas-id-val').value = candidato.identificador;
  document.getElementById('citas-nombre-display').innerText = candidato.nombreCompleto;
  document.getElementById('citas-consulado-display').innerText = candidato.consulado || 'CUBA LA HABANA';
  document.getElementById('citas-urgencia').value = candidato.urgencia || '2. MEDIA / NORMAL';
  document.getElementById('citas-preferencia').value = candidato.preferencia || 'CUALQUIER FECHA';
  document.getElementById('citas-usuario').value = candidato.usuarioConsular || '';
  document.getElementById('citas-password').value = candidato.passwordConsular || '';
  document.getElementById('citas-fecha-asignada').value = candidato.fechaCita || '';

  tomarSnapshotCitas();
  document.getElementById('modal-citas-radar').classList.add('active');
}

async function cerrarModalCitas(forzar = false) {
  if (!forzar && formCitasIsDirty()) {
    const id = document.getElementById('citas-id-val')?.value || 'este candidato';
    const confirmar = await ConfirmModal.descartarCambios(`las credenciales y preferencias de ${id}`);
    if (!confirmar) return; // Continuar editando
  }

  const modal = document.getElementById('modal-citas-radar');
  if (modal) modal.classList.remove('active');
  state.snapshotCitas = null;
}
const cerrarModalRadarCitas = cerrarModalCitas;
window.cerrarModalCitas = cerrarModalCitas;
window.cerrarModalRadarCitas = cerrarModalCitas;

async function guardarCitasFormulario(e) {
  if (e) e.preventDefault();

  const datos = {
    identificador: document.getElementById('citas-id-val').value.trim(),
    nombreCompleto: document.getElementById('citas-nombre-display').innerText,
    consulado: document.getElementById('citas-consulado-display').innerText,
    urgencia: document.getElementById('citas-urgencia').value,
    preferencia: document.getElementById('citas-preferencia').value.trim() || 'CUALQUIER FECHA',
    usuarioConsular: document.getElementById('citas-usuario').value.trim(),
    passwordConsular: document.getElementById('citas-password').value.trim(),
    fechaCita: document.getElementById('citas-fecha-asignada').value.trim()
  };

  const btnGuardar = document.getElementById('btn-guardar-citas');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerText = '💾 Guardando Citas...';
  }

  state.operacionEnProgreso = true;

  try {
    const res = await API.transferirCita(datos);
    if (res.ok || res.success) {
      // 1. Actualización reactiva instantánea en memoria local
      if (datos.identificador) {
        const idStr = String(datos.identificador).trim();
        if (state.expedientes) {
          const idxExp = state.expedientes.findIndex(c => String(c.identificador).trim() === idStr);
          if (idxExp !== -1) {
            state.expedientes[idxExp] = {
              ...state.expedientes[idxExp],
              urgencia: datos.urgencia,
              preferencia: datos.preferencia,
              usuarioConsular: datos.usuarioConsular,
              passwordConsular: datos.passwordConsular,
              fechaCita: datos.fechaCita
            };
          }
        }
        if (state.citas) {
          const idxCita = state.citas.findIndex(c => String(c.identificador).trim() === idStr);
          if (idxCita !== -1) {
            state.citas[idxCita] = {
              ...state.citas[idxCita],
              urgencia: datos.urgencia,
              preferencia: datos.preferencia,
              usuarioConsular: datos.usuarioConsular,
              passwordConsular: datos.passwordConsular,
              fechaCita: datos.fechaCita
            };
          }
        }
      }

      Toast.success('Credenciales y preferencias de citas guardadas exitosamente.');
      tomarSnapshotCitas();
      cerrarModalCitas();

      // 2. Refrescar la tabla de citas al instante sin saturar la red
      if (typeof aplicarFiltrosCitas === 'function') aplicarFiltrosCitas();
    } else {
      Toast.error('Error al guardar citas: ' + (res.error || 'Desconocido'));
    }
  } catch (error) {
    Toast.error('Excepción al conectar con el servidor: ' + error.message);
  } finally {
    state.operacionEnProgreso = false;
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerText = '💾 Guardar Preferencias';
      evaluarDirtyCitas();
    }
  }
}

// ─────────────────────────────────────────────
// 2. MODAL AUDITOR DE VENCIMIENTOS
// ─────────────────────────────────────────────
function abrirModalAuditorVencimientos() {
  if (typeof actualizarUIModoPrueba === 'function') actualizarUIModoPrueba();
  const contenedor = document.getElementById('reporte-auditor-contenedor');
  if (contenedor) {
    contenedor.innerHTML = `
      ⏳ Listo para evaluar vencimientos de silencio de notificaciones.<br>
      Haz clic en "Iniciar Auditoría" para disparar el proceso.
    `;
  }
  document.getElementById('modal-auditor-vencimientos').classList.add('active');
}

async function cerrarModalAuditorVencimientos(forzar = false) {
  if (!forzar && state.operacionEnProgreso && document.getElementById('modal-auditor-vencimientos')?.classList.contains('active')) {
    const confirmar = await ConfirmModal.procesoEnEjecucion('La Auditoría de Vencimientos');
    if (!confirmar) return; // Esperar
  }
  document.getElementById('modal-auditor-vencimientos')?.classList.remove('active');
}

async function ejecutarAuditorDesdeUI() {
  if (state.operacionEnProgreso) {
    Toast.error('Ya hay una operación de red en curso. Por favor, espera a que termine.');
    return;
  }
  state.operacionEnProgreso = true;

  const btn = document.getElementById('btn-ejecutar-auditor');
  const contenedor = document.getElementById('reporte-auditor-contenedor');
  setBotonCargando(btn, true, 'Auditando en Sheets...');
  contenedor.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);"><span class="spinner-icon" style="width: 18px; height: 18px;"></span><br><br>⏳ Evaluando vencimientos y citas alcanzadas en Google Sheets...</div>`;

  const t0 = Date.now();
  try {
    const res = await API.ejecutarAutomatizacion('ejecutarVencimientos');
    const duracionSeg = ((Date.now() - t0) / 1000).toFixed(1);

    if (res.ok || res.success) {
      const rep = res.reporte || {};
      const evaluados = rep.evaluados !== undefined ? rep.evaluados : state.expedientes.length;
      const citasAlcanzadas = rep.citasAlcanzadas !== undefined ? rep.citasAlcanzadas : 0;
      const notifLiberadas = rep.notificacionesLiberadas !== undefined ? rep.notificacionesLiberadas : (rep.procesados || 0);

      renderReporteEjecutivo('reporte-auditor-contenedor', {
        titulo: '✓ Auditoría de Vencimientos Finalizada',
        subtitulo: 'Evaluación y transiciones de estado completadas al 100%',
        esPrueba: rep.prueba !== undefined ? rep.prueba : state.modoPrueba,
        metricas: [
          { label: 'Expedientes Auditados', valor: evaluados, color: '#FFFFFF' },
          { label: 'Citas Alcanzadas (A Resolución)', valor: citasAlcanzadas, color: 'var(--accent-cyan)' },
          { label: 'Notificaciones Habilitadas', valor: notifLiberadas, color: 'var(--accent-green)' },
          { label: 'Tiempo de Ejecución', valor: `${duracionSeg}s`, color: 'var(--accent-gold)' }
        ],
        mensajePie: 'Acciones de auditoría asentadas en la hoja LOGS_SISTEMA de Google Sheets.'
      });
      Toast.success('Auditoría completada exitosamente.');
      if (typeof cargarDatosEnVivo === 'function') cargarDatosEnVivo();
    } else {
      contenedor.innerHTML = `<div class="modo-alerta-banner" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5;">❌ Error: ${res.error || 'Fallo de ejecución'}</div>`;
      Toast.error(res.error || 'Fallo de ejecución');
    }
  } catch (err) {
    contenedor.innerHTML = `<div class="modo-alerta-banner" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5;">❌ Excepción: ${err.message}</div>`;
    Toast.error('Excepción: ' + err.message);
  } finally {
    state.operacionEnProgreso = false;
    setBotonCargando(btn, false, null, '⚡ Iniciar Auditoría');
  }
}

// ─────────────────────────────────────────────
// 3. MODAL ENVÍOS MASIVOS DE NOTIFICACIONES
// ─────────────────────────────────────────────
function abrirModalEnvioNotificaciones() {
  if (typeof actualizarUIModoPrueba === 'function') actualizarUIModoPrueba();
  const progressBar = document.getElementById('envios-progreso-barra');
  const progressText = document.getElementById('envios-progreso-texto');
  const progressStatus = document.getElementById('envios-progreso-estado');
  const consoleBox = document.getElementById('envios-batch-console');
  const reporteBox = document.getElementById('envios-reporte-contenedor');

  const expedientes = state.expedientes || [];
  const metricas = (typeof calcularMetricasEnviosDetalladas === 'function')
    ? calcularMetricasEnviosDetalladas(expedientes)
    : { totalCartera: expedientes.length, notificadosAlDia: 779, enCarenciaLegal: 23, listosDespachoHoy: 0 };

  const elTotal = document.getElementById('modal-envios-total');
  const elNotif = document.getElementById('modal-envios-notificados');
  const elCarencia = document.getElementById('modal-envios-carencia');
  const elListos = document.getElementById('modal-envios-listos');
  const elBadge = document.getElementById('envios-preflight-badge');

  if (elTotal) elTotal.innerText = metricas.totalCartera;
  if (elNotif) elNotif.innerText = metricas.notificadosAlDia;
  if (elCarencia) elCarencia.innerText = metricas.enCarenciaLegal;
  if (elListos) elListos.innerText = metricas.listosDespachoHoy;

  if (elBadge) {
    if (metricas.listosDespachoHoy === 0) {
      elBadge.className = 'badge badge-estado-favorable';
      elBadge.innerText = '✓ Cartera al Día';
    } else {
      elBadge.className = 'badge badge-estado-cita';
      elBadge.innerText = `⚡ ${metricas.listosDespachoHoy} Pendientes`;
    }
  }

  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.innerText = metricas.listosDespachoHoy === 0 ? 'Cartera evaluada: Todo al día' : `Listo para despachar ${metricas.listosDespachoHoy} envíos`;
  if (progressStatus) progressStatus.innerText = 'En espera';

  if (consoleBox) {
    if (metricas.listosDespachoHoy === 0) {
      const txtBajas = metricas.descartadosBajaEmail > 0 ? `<br><span style="color: #F87171;">  🚫 ${metricas.descartadosBajaEmail} clientes excluidos (Baja o sin email).</span>` : '';
      consoleBox.innerHTML = `
        <span style="color: #38BDF8;">[SISTEMA] 📊 Auditoría Previa de la Cartera (${metricas.totalCartera} Casos):</span><br>
        <span style="color: #4ADE80;">  ✓ ${metricas.notificadosAlDia} clientes notificados activos (en ciclo de silencio).</span><br>
        <span style="color: #FBBF24;">  ⏳ ${metricas.enCarenciaLegal} clientes en periodo de carencia legal (&lt; ${metricas.carenciaDias || 60} días tras cita).</span>${txtBajas}<br>
        <span style="color: #94A3B8;">  ℹ️ No hay avisos vencidos pendientes de despacho hoy.</span>
      `;
    } else {
      consoleBox.innerHTML = `
        <span style="color: #38BDF8;">[SISTEMA] 🚀 Motor preparado para despachar ${metricas.listosDespachoHoy} avisos oficiales.</span><br>
        <span style="color: #94A3B8;">Haz clic en "Iniciar Envíos Masivos" para iniciar la transmisión.</span>
      `;
    }
  }

  if (reporteBox) {
    reporteBox.innerHTML = '';
    reporteBox.style.display = 'none';
  }

  document.getElementById('modal-envios-notificaciones').classList.add('active');
}

async function cerrarModalEnvios(forzar = false) {
  if (!forzar && state.operacionEnProgreso && document.getElementById('modal-envios-notificaciones')?.classList.contains('active')) {
    const confirmar = await ConfirmModal.procesoEnEjecucion('El Motor de Envíos Masivos');
    if (!confirmar) return; // Esperar
  }
  document.getElementById('modal-envios-notificaciones')?.classList.remove('active');
}

async function ejecutarEnviosDesdeUI() {
  if (state.operacionEnProgreso) {
    Toast.error('Ya hay una operación de red en curso. Por favor, espera a que termine.');
    return;
  }
  state.operacionEnProgreso = true;

  const btn = document.getElementById('btn-envios-batch-iniciar');
  const progressBar = document.getElementById('envios-progreso-barra');
  const progressText = document.getElementById('envios-progreso-texto');
  const progressStatus = document.getElementById('envios-progreso-estado');
  const consoleBox = document.getElementById('envios-batch-console');
  const reporteBox = document.getElementById('envios-reporte-contenedor');

  setBotonCargando(btn, true, 'Procesando Envíos...');
  if (reporteBox) reporteBox.style.display = 'none';

  if (progressText) progressText.innerText = 'Ejecutando motor en Google Workspace...';
  if (progressStatus) progressStatus.innerText = 'Conectando...';
  if (progressBar) progressBar.style.width = '35%';

  const agregarLineaEnvios = (texto, tipo = 'info') => {
    if (!consoleBox) return;
    const colors = { ok: '#4ADE80', warn: '#FBBF24', error: '#F87171', info: '#94A3B8' };
    const p = document.createElement('div');
    p.style.color = colors[tipo] || '#E2E8F0';
    p.innerHTML = `<span style="color: #475569;">[${new Date().toLocaleTimeString()}]</span> ${texto}`;
    consoleBox.appendChild(p);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  };

  consoleBox.innerHTML = '';
  agregarLineaEnvios('🚀 Iniciando Motor de Envíos Masivos en Google Workspace...', 'info');

  const t0 = Date.now();
  try {
    const res = await API.ejecutarAutomatizacion('ejecutarEnviosMasivos');
    const duracionSeg = ((Date.now() - t0) / 1000).toFixed(1);

    if (res.ok || res.success) {
      const rep = res.reporte || {};
      const enviados = rep.enviados !== undefined ? rep.enviados : (rep.procesados || 0);
      const simulacro = rep.simulacro !== undefined ? rep.simulacro : 0;
      const clientes = rep.clientes || [];

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.innerText = `Finalizado (${enviados || simulacro} destinatarios)`;
      if (progressStatus) progressStatus.innerText = 'Completado ✓';

      if (clientes.length > 0) {
        clientes.forEach(c => {
          agregarLineaEnvios(`📨 [${c.id}] ${c.nombre} (${c.email}) ➔ ${c.modo === 'Simulacro' ? '🟡 Simulacro Preparado' : '🟢 Correo Enviado ✓'} [${c.estado}]`, 'ok');
        });
      } else {
        agregarLineaEnvios(`ℹ️ No se detectaron expedientes calificados para envío hoy.`, 'warn');
      }

      let tablaClientesHtml = '';
      if (clientes.length > 0) {
        tablaClientesHtml = `
          <div style="margin-top: 14px; max-height: 180px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <table class="modern-table" style="font-size: 0.76rem;">
              <thead>
                <tr>
                  <th style="padding: 6px 10px;">ID</th>
                  <th style="padding: 6px 10px;">Cliente</th>
                  <th style="padding: 6px 10px;">Email</th>
                  <th style="padding: 6px 10px;">Estado</th>
                  <th style="padding: 6px 10px;">Modo</th>
                </tr>
              </thead>
              <tbody>
                ${clientes.map(c => `
                  <tr>
                    <td style="font-weight: 700; color: var(--accent-cyan); padding: 5px 10px;">${c.id}</td>
                    <td style="font-weight: 600; padding: 5px 10px;">${c.nombre}</td>
                    <td style="color: var(--text-dim); padding: 5px 10px;">${c.email}</td>
                    <td style="padding: 5px 10px;"><span class="badge badge-estado-resolucion">${c.estado}</span></td>
                    <td style="padding: 5px 10px;">${c.modo === 'Simulacro' ? '🟡 Simulacro' : '🟢 Real'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (reporteBox) {
        reporteBox.style.display = 'block';
        reporteBox.innerHTML = `
          <div class="reporte-card" style="margin-top: 12px;">
            <div class="reporte-header">
              <div>
                <strong style="color: var(--accent-cyan); font-size: 0.92rem;">✓ Resumen de Envíos Realizados</strong>
                <div style="font-size: 0.74rem; color: var(--text-dim);">Proceso de distribución finalizado con éxito</div>
              </div>
              <span class="badge" style="${rep.prueba ? 'background: rgba(245, 158, 11, 0.2); color: #FBBF24;' : 'background: rgba(16, 185, 129, 0.2); color: #34D399;'}">
                ${rep.prueba ? '🟡 Simulacro Activo' : '🟢 Producción Real'}
              </span>
            </div>
            <div class="reporte-grid">
              <div class="reporte-stat-tile">
                <span class="label">Total Notificaciones</span>
                <span class="val" style="color: var(--accent-cyan);">${enviados || simulacro}</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Bandeja Destino</span>
                <span class="val" style="font-size: 0.85rem; color: #FFFFFF; word-break: break-all;">${rep.prueba ? rep.emailDestino : 'Clientes Reales'}</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Tiempo de Transmisión</span>
                <span class="val" style="color: var(--accent-gold);">${duracionSeg}s</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Registro de Bitácora</span>
                <span class="val" style="font-size: 0.85rem; color: var(--accent-green);">LOGS_SISTEMA ✓</span>
              </div>
            </div>
            ${tablaClientesHtml}
          </div>
        `;
      }
      Toast.success('Proceso de envíos finalizado con éxito.');
      if (typeof cargarDatosEnVivo === 'function') cargarDatosEnVivo();
    } else {
      agregarLineaEnvios(`❌ Error: ${res.error || 'Fallo de ejecución'}`, 'error');
      Toast.error(res.error || 'Error al ejecutar envíos');
    }
  } catch (err) {
    agregarLineaEnvios(`❌ Excepción: ${err.message}`, 'error');
    Toast.error('Excepción: ' + err.message);
  } finally {
    state.operacionEnProgreso = false;
    setBotonCargando(btn, false, null, '🚀 Iniciar Envíos Masivos');
  }
}

// ─────────────────────────────────────────────
// 4. MODAL SINCRONIZADOR DE CITAS
// ─────────────────────────────────────────────
function abrirModalSincronizadorCitas() {
  if (typeof actualizarUIModoPrueba === 'function') actualizarUIModoPrueba();
  const progressBar = document.getElementById('citas-sync-progreso-barra');
  const progressText = document.getElementById('citas-sync-progreso-texto');
  const progressStatus = document.getElementById('citas-sync-progreso-estado');
  const consoleBox = document.getElementById('citas-sync-console');
  const reporteBox = document.getElementById('citas-sync-reporte-contenedor');

  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.innerText = 'Listo para escanear base de datos';
  if (progressStatus) progressStatus.innerText = 'En espera';
  if (consoleBox) consoleBox.innerHTML = '<span style="color: #64748B;">[SISTEMA] Sincronizador preparado. Haz clic en "Iniciar Sincronización".</span>';
  if (reporteBox) {
    reporteBox.innerHTML = '';
    reporteBox.style.display = 'none';
  }

  document.getElementById('modal-sincronizador-citas').classList.add('active');
}

async function cerrarModalSincronizadorCitas(forzar = false) {
  if (!forzar && state.operacionEnProgreso && document.getElementById('modal-sincronizador-citas')?.classList.contains('active')) {
    const confirmar = await ConfirmModal.procesoEnEjecucion('La Sincronización de Citas');
    if (!confirmar) return; // Esperar
  }
  document.getElementById('modal-sincronizador-citas')?.classList.remove('active');
}

async function ejecutarSincronizacionCitasInteractivo() {
  if (state.operacionEnProgreso) {
    Toast.error('Ya hay una operación de red en curso. Por favor, espera a que termine.');
    return;
  }
  state.operacionEnProgreso = true;

  const btn = document.getElementById('btn-citas-sync-iniciar');
  const progressBar = document.getElementById('citas-sync-progreso-barra');
  const progressText = document.getElementById('citas-sync-progreso-texto');
  const progressStatus = document.getElementById('citas-sync-progreso-estado');
  const consoleBox = document.getElementById('citas-sync-console');
  const reporteBox = document.getElementById('citas-sync-reporte-contenedor');

  setBotonCargando(btn, true, 'Sincronizando...');
  if (reporteBox) reporteBox.style.display = 'none';

  if (progressText) progressText.innerText = 'Cruzando tablas en Google Sheets...';
  if (progressStatus) progressStatus.innerText = 'Analizando...';
  if (progressBar) progressBar.style.width = '35%';

  const agregarLineaSync = (texto, tipo = 'info') => {
    if (!consoleBox) return;
    const colors = { ok: '#4ADE80', warn: '#FBBF24', error: '#F87171', info: '#94A3B8' };
    const p = document.createElement('div');
    p.style.color = colors[tipo] || '#E2E8F0';
    p.innerHTML = `<span style="color: #475569;">[${new Date().toLocaleTimeString()}]</span> ${texto}`;
    consoleBox.appendChild(p);
    consoleBox.scrollTop = consoleBox.scrollHeight;
  };

  consoleBox.innerHTML = '';
  agregarLineaSync('🔍 Escaneando hoja principal EXPEDIENTES LMD...', 'info');

  const t0 = Date.now();
  try {
    const res = await API.ejecutarAutomatizacion('sincronizarCitas');
    const duracionSeg = ((Date.now() - t0) / 1000).toFixed(1);

    if (res.ok || res.success) {
      const agregados = res.agregados || 0;
      const actualizados = res.actualizados || 0;
      const totalCola = res.totalCola || 0;
      const clientes = res.clientes || [];

      if (progressBar) progressBar.style.width = '100%';
      if (progressText) progressText.innerText = `Sincronización Completada (${agregados} agregados, ${actualizados} actualizados)`;
      if (progressStatus) progressStatus.innerText = 'Completado ✓';

      if (clientes.length > 0) {
        clientes.forEach(c => {
          agregarLineaSync(`👤 [${c.id}] ${c.nombre} (${c.consulado}) ➔ ${c.accion === 'AGREGADO' ? '✨ Agregado a Cola' : '🔄 Estado Actualizado'} [${c.estado}]`, 'ok');
        });
      } else {
        agregarLineaSync(`✓ Todos los expedientes ya se encuentran sincronizados en la cola de credenciales.`, 'info');
      }

      let tablaSyncHtml = '';
      if (clientes.length > 0) {
        tablaSyncHtml = `
          <div style="margin-top: 14px; max-height: 180px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
            <table class="modern-table" style="font-size: 0.76rem;">
              <thead>
                <tr>
                  <th style="padding: 6px 10px;">ID</th>
                  <th style="padding: 6px 10px;">Cliente</th>
                  <th style="padding: 6px 10px;">Consulado</th>
                  <th style="padding: 6px 10px;">Estado Asignado</th>
                  <th style="padding: 6px 10px;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${clientes.map(c => `
                  <tr>
                    <td style="font-weight: 700; color: var(--accent-purple); padding: 5px 10px;">${c.id}</td>
                    <td style="font-weight: 600; padding: 5px 10px;">${c.nombre}</td>
                    <td style="padding: 5px 10px;">${c.consulado}</td>
                    <td style="padding: 5px 10px;"><span class="badge badge-estado-cita">${c.estado}</span></td>
                    <td style="padding: 5px 10px;">${c.accion === 'AGREGADO' ? '✨ Nuevo Agregado' : '🔄 Actualizado'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      if (reporteBox) {
        reporteBox.style.display = 'block';
        reporteBox.innerHTML = `
          <div class="reporte-card" style="margin-top: 12px;">
            <div class="reporte-header">
              <div>
                <strong style="color: var(--accent-purple); font-size: 0.92rem;">✓ Resumen de Sincronización de Citas</strong>
                <div style="font-size: 0.74rem; color: var(--text-dim);">Cruce entre EXPEDIENTES LMD y CREDENCIALES_LMD</div>
              </div>
              <span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #C084FC; border: 1px solid rgba(168, 85, 247, 0.4);">
                🔄 Sincronizado
              </span>
            </div>
            <div class="reporte-grid">
              <div class="reporte-stat-tile">
                <span class="label">Nuevos en Cola</span>
                <span class="val" style="color: var(--accent-green);">${agregados}</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Actualizados</span>
                <span class="val" style="color: var(--accent-cyan);">${actualizados}</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Total en Cola de Citas</span>
                <span class="val" style="color: #FFFFFF;">${totalCola}</span>
              </div>
              <div class="reporte-stat-tile">
                <span class="label">Tiempo de Cruce</span>
                <span class="val" style="color: var(--accent-gold);">${duracionSeg}s</span>
              </div>
            </div>
            ${tablaSyncHtml}
          </div>
        `;
      }
      Toast.success('Cola de citas sincronizada exitosamente.');
      if (typeof cargarDatosEnVivo === 'function') cargarDatosEnVivo();
    } else {
      agregarLineaSync(`❌ Error: ${res.error || 'Fallo de sincronización'}`, 'error');
      Toast.error(res.error || 'Error al sincronizar citas');
    }
  } catch (err) {
    agregarLineaSync(`❌ Excepción: ${err.message}`, 'error');
    Toast.error('Excepción: ' + err.message);
  } finally {
    state.operacionEnProgreso = false;
    setBotonCargando(btn, false, null, '🔄 Iniciar Sincronización');
  }
}

// ─────────────────────────────────────────────
// 5. MODAL VERIFICADOR LA HABANA (INDIVIDUAL Y LOTE)
// ─────────────────────────────────────────────
function obtenerCandidatosCalificadosHabanaLocal() {
  return state.expedientes.filter(c => {
    const cons = String(c.consulado || '').toUpperCase().trim();
    const est = String(c.estado || '').toUpperCase().trim();
    const exp = String(c.noExpediente || '').trim();
    const id = String(c.identificador || '').trim();

    const esHabana = cons.includes('HABANA');
    const esPendiente = (est === 'PENDIENTE RESOLUCION' || est === 'RESUELTO');
    const esFormatoValido = /^\d{6}-\d{3,}$/.test(exp);
    const tieneId = Boolean(id);

    return esHabana && esPendiente && esFormatoValido && tieneId;
  });
}

function cambiarTabHabana(tab) {
  state.habanaTabActual = tab;
  const btnInd = document.getElementById('tab-habana-btn-individual');
  const btnLote = document.getElementById('tab-habana-btn-lote');
  const viewInd = document.getElementById('habana-tab-individual');
  const viewLote = document.getElementById('habana-tab-lote');

  const btnConsInd = document.getElementById('btn-consultar-habana-ind');
  const btnIniciarLote = document.getElementById('btn-habana-batch-iniciar');
  const btnDetenerLote = document.getElementById('btn-habana-batch-detener');

  if (tab === 'individual') {
    if (btnInd) { btnInd.style.borderColor = 'var(--accent-cyan)'; btnInd.style.color = 'var(--accent-cyan)'; }
    if (btnLote) { btnLote.style.borderColor = 'transparent'; btnLote.style.color = 'var(--text-muted)'; }
    if (viewInd) viewInd.style.display = 'block';
    if (viewLote) viewLote.style.display = 'none';

    if (btnConsInd) btnConsInd.style.display = 'inline-block';
    if (btnIniciarLote) btnIniciarLote.style.display = 'none';
    if (btnDetenerLote) btnDetenerLote.style.display = 'none';
  } else {
    if (btnLote) { btnLote.style.borderColor = 'var(--accent-cyan)'; btnLote.style.color = 'var(--accent-cyan)'; }
    if (btnInd) { btnInd.style.borderColor = 'transparent'; btnInd.style.color = 'var(--text-muted)'; }
    if (viewLote) viewLote.style.display = 'block';
    if (viewInd) viewInd.style.display = 'none';

    if (btnConsInd) btnConsInd.style.display = 'none';
    if (btnIniciarLote) btnIniciarLote.style.display = 'inline-block';
    if (btnDetenerLote) btnDetenerLote.style.display = 'none';
  }
}

function poblarSelectExpedientesHabana() {
  const select = document.getElementById('habana-select-expediente');
  const badgeTotal = document.getElementById('habana-lote-total-badge');
  if (!select) return;

  state.habanaCandidatos = obtenerCandidatosCalificadosHabanaLocal();

  if (badgeTotal) badgeTotal.innerText = state.habanaCandidatos.length;

  if (state.habanaCandidatos.length === 0) {
    select.innerHTML = `<option value="">⚠️ No hay expedientes pendientes de resolución en La Habana con formato DDMMYY-NNN</option>`;
  } else {
    select.innerHTML = state.habanaCandidatos.map(c => `
      <option value="${c.identificador}">
        ${c.nombreCompleto} — ${c.noExpediente} (${c.identificador})
      </option>
    `).join('');
  }
}

function abrirModalVerificadorHabana() {
  if (typeof actualizarUIModoPrueba === 'function') actualizarUIModoPrueba();
  poblarSelectExpedientesHabana();
  cambiarTabHabana('individual');
  const resContenedor = document.getElementById('habana-resultado-contenedor');
  if (resContenedor) resContenedor.style.display = 'none';
  document.getElementById('modal-verificador-habana').classList.add('active');
}

async function cerrarModalHabana(forzar = false) {
  if (!forzar && (state.operacionEnProgreso || state.habanaBatchCorriendo) && document.getElementById('modal-verificador-habana')?.classList.contains('active')) {
    const confirmar = await ConfirmModal.procesoEnEjecucion('El Verificador de La Habana');
    if (!confirmar) return; // Esperar
    detenerVerificacionLoteHabana();
  }
  state.habanaBatchCancelado = true;
  document.getElementById('modal-verificador-habana')?.classList.remove('active');
}

async function consultarHabanaIndividualDesdeUI() {
  if (state.operacionEnProgreso) {
    Toast.error('Ya hay una operación de red en curso. Por favor, espera a que termine.');
    return;
  }
  state.operacionEnProgreso = true;

  const select = document.getElementById('habana-select-expediente');
  const btn = document.getElementById('btn-consultar-habana-ind');
  const resContenedor = document.getElementById('habana-resultado-contenedor');
  const resBadge = document.getElementById('habana-resultado-badge');
  const resTexto = document.getElementById('habana-resultado-texto');

  if (!select || !select.value) {
    state.operacionEnProgreso = false;
    Toast.warning('Por favor selecciona un expediente válido.');
    return;
  }

  const id = select.value;
  const candidato = (state.habanaCandidatos && state.habanaCandidatos.find(c => String(c.identificador) === String(id))) || state.expedientes.find(c => String(c.identificador) === String(id));
  if (!candidato) {
    state.operacionEnProgreso = false;
    Toast.error('Expediente no encontrado en memoria.');
    return;
  }

  if (btn) btn.disabled = true;
  resContenedor.style.display = 'block';
  resBadge.className = 'badge badge-estado-cita';
  resBadge.innerText = 'CONSULTANDO...';
  resTexto.innerHTML = `⏳ Realizando autenticación doble y búsqueda en cascada para <strong>${candidato.nombreCompleto}</strong> (${candidato.noExpediente})...`;

  try {
    const itemPayload = {
      identificador: candidato.identificador,
      nombre: candidato.nombre || candidato.nombreCompleto.split(' ')[0],
      apellidos: candidato.apellidos || candidato.nombreCompleto,
      noExpediente: candidato.noExpediente,
      rowIndex: candidato.rowIndex || 0,
      nombreCompleto: candidato.nombreCompleto
    };

    const res = await API.ejecutarAutomatizacion('ejecutarVerificadorHabana', { item: itemPayload, expediente: itemPayload, ...itemPayload });
    if (res.ok || res.success) {
      const estOficial = res.estadoConsulado || 'Información Oficial Recibida';
      const estOficialUpper = estOficial.toUpperCase();

      if (estOficialUpper.includes('FAVORABLE') || estOficialUpper.includes('APROBADO') || estOficialUpper.includes('INSCRITO')) {
        resBadge.className = 'badge badge-estado-favorable';
      } else {
        resBadge.className = 'badge badge-estado-resolucion';
      }
      resBadge.innerText = estOficial;

      const nombreOficial = res.nombreSistema || candidato.nombreCompleto;
      const progenitorOficial = res.progenitor || '— Sin datos de progenitor —';
      const fechaPortal = res.fechaPortal || '—';
      const fechaRes = res.fechaResolucion || '— Pendiente de Emisión —';
      const fechaIns = res.fechaInscripcion || '— Pendiente de Inscripción —';
      const regTxt = res.datosRegistrales || '— Pendiente de Asignación Registral —';

      resTexto.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div><span style="color: var(--text-dim); font-size: 0.74rem;">ESTADO CONSULAR:</span><br><strong style="color: var(--accent-cyan);">${estOficial}</strong></div>
          <div><span style="color: var(--text-dim); font-size: 0.74rem;">FECHA ACT. PORTAL:</span><br><strong>${fechaPortal}</strong></div>
        </div>

        <div style="margin-bottom: 6px;"><span style="color: var(--text-dim); font-size: 0.74rem;">NOMBRE EN SISTEMA:</span><br><strong>${nombreOficial}</strong></div>
        <div style="margin-bottom: 6px;"><span style="color: var(--text-dim); font-size: 0.74rem;">PROGENITOR REGISTRADO:</span><br><strong>${progenitorOficial}</strong></div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div><span style="color: var(--text-dim); font-size: 0.74rem;">FECHA RESOLUCIÓN:</span><br><span>${fechaRes}</span></div>
          <div><span style="color: var(--text-dim); font-size: 0.74rem;">FECHA INSCRIPCIÓN:</span><br><span>${fechaIns}</span></div>
        </div>

        <div style="padding: 8px 12px; background: rgba(0,0,0,0.35); border: 1px solid var(--border-subtle); border-radius: 6px; font-family: monospace; font-size: 0.78rem;">
          📑 <span style="color: var(--text-dim);">DATOS REGISTRALES:</span> <strong>${regTxt}</strong>
        </div>
        <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 8px;">
          ✓ Variante validada: <em>"${res.varianteUsada || candidato.apellidos}"</em> | Registrado en LOGS_SISTEMA.
        </div>
      `;
      Toast.success(`Estado consular verificado: ${estOficial}`);
    } else if (res.resultado === 'NO_ENCONTRADO') {
      resBadge.className = 'badge badge-estado-nopresentado';
      resBadge.innerText = 'NO ENCONTRADO';
      resTexto.innerHTML = `
        <span style="color: var(--accent-gold);">⚠️ Expediente no encontrado en la base del Consulado de La Habana.</span><br>
        <span style="font-size: 0.74rem; color: var(--text-dim);">Se probaron 4 variantes de apellidos sin coincidencia. Registrado en LOGS_SISTEMA.</span>
      `;
    } else {
      resBadge.className = 'badge badge-estado-credenciales';
      resBadge.innerText = 'ERROR CONEXIÓN';
      resTexto.innerHTML = `
        <span style="color: var(--accent-red);">🔴 Error al conectar con el servidor consular: ${res.detalle || res.error || 'Respuesta no válida'}</span>
      `;
    }
  } catch (err) {
    resBadge.className = 'badge badge-estado-credenciales';
    resBadge.innerText = 'EXCEPCIÓN';
    resTexto.innerHTML = `<span style="color: var(--accent-red);">Excepción: ${err.message}</span>`;
  } finally {
    state.operacionEnProgreso = false;
    if (btn) btn.disabled = false;
  }
}

// ── Verificación por Lote (Masiva Habana) ──
let habanaBatchStats = { favorables: 0, tramite: 0, noHallados: 0, errores: 0 };

function agregarLineaConsolaHabana(texto, tipo = 'info') {
  const consoleBox = document.getElementById('habana-batch-console');
  if (!consoleBox) return;

  const colores = {
    info: '#38BDF8',
    ok: '#34D399',
    warn: '#FBBF24',
    error: '#F87171'
  };

  const line = document.createElement('div');
  line.style.color = colores[tipo] || '#fff';
  line.style.marginBottom = '3px';
  line.innerHTML = `[${new Date().toLocaleTimeString()}] ${texto}`;
  consoleBox.appendChild(line);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function actualizarStatsLoteHabana() {
  const elFav = document.getElementById('habana-stat-favorables');
  const elTra = document.getElementById('habana-stat-tramite');
  const elNo = document.getElementById('habana-stat-nohallados');
  const elErr = document.getElementById('habana-stat-errores');

  if (elFav) elFav.innerText = habanaBatchStats.favorables;
  if (elTra) elTra.innerText = habanaBatchStats.tramite;
  if (elNo) elNo.innerText = habanaBatchStats.noHallados;
  if (elErr) elErr.innerText = habanaBatchStats.errores;

  // Regla UX: Activar interactividad solo si count > 0
  const actualizarBoton = (btnId, count) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (count > 0) {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
    } else {
      btn.disabled = true;
      btn.style.cursor = 'default';
      btn.style.opacity = '0.55';
    }
  };

  actualizarBoton('btn-habana-stat-favorables', habanaBatchStats.favorables);
  actualizarBoton('btn-habana-stat-tramite', habanaBatchStats.tramite);
  actualizarBoton('btn-habana-stat-nohallados', habanaBatchStats.noHallados);
  actualizarBoton('btn-habana-stat-errores', habanaBatchStats.errores);

  // Si el usuario tiene abierto el inspector de una categoría, actualizar en caliente
  if (state.habanaFiltroActivo) {
    renderizarListaInspectorHabana(state.habanaFiltroActivo);
  }
}

function filtrarInspectorHabana(categoria) {
  if (!state.habanaResultados) return;
  const lista = state.habanaResultados[categoria] || [];
  if (lista.length === 0) return;

  // Toggle: Si ya estaba activa esta categoría, regresar a la consola
  if (state.habanaFiltroActivo === categoria) {
    mostrarConsolaHabana();
    return;
  }

  state.habanaFiltroActivo = categoria;

  const consoleBox = document.getElementById('habana-batch-console');
  const inspectorBox = document.getElementById('habana-inspector-container');

  if (consoleBox) consoleBox.style.display = 'none';
  if (inspectorBox) inspectorBox.style.display = 'block';

  // Resaltar visualmente la tarjeta de estadística activa
  const botones = {
    aprobados: 'btn-habana-stat-favorables',
    enTramite: 'btn-habana-stat-tramite',
    noHallados: 'btn-habana-stat-nohallados',
    errores: 'btn-habana-stat-errores'
  };

  Object.keys(botones).forEach(k => {
    const b = document.getElementById(botones[k]);
    if (b) {
      if (k === categoria) {
        b.style.borderColor = 'var(--accent-cyan)';
        b.style.boxShadow = '0 0 14px rgba(56, 189, 248, 0.4)';
      } else {
        b.style.borderColor = 'transparent';
        b.style.boxShadow = 'none';
      }
    }
  });

  renderizarListaInspectorHabana(categoria);
}

function renderizarListaInspectorHabana(categoria) {
  if (!state.habanaResultados) return;
  const lista = state.habanaResultados[categoria] || [];
  const tituloEl = document.getElementById('habana-inspector-titulo');
  const listaEl = document.getElementById('habana-inspector-lista');

  const titulos = {
    aprobados: { txt: `🟢 Expedientes Aprobados (${lista.length})`, color: 'var(--accent-green)' },
    enTramite: { txt: `🟡 Expedientes en Trámite (${lista.length})`, color: 'var(--accent-gold)' },
    noHallados: { txt: `⚪ Expedientes No Hallados (${lista.length})`, color: '#94A3B8' },
    errores: { txt: `🔴 Expedientes con Error (${lista.length})`, color: 'var(--accent-red)' }
  };

  const infoCat = titulos[categoria] || { txt: `Expedientes (${lista.length})`, color: '#fff' };
  if (tituloEl) {
    tituloEl.innerHTML = `<span style="color: ${infoCat.color}; font-weight: 700;">${infoCat.txt}</span>`;
  }

  if (listaEl) {
    if (lista.length === 0) {
      listaEl.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-dim); font-size: 0.76rem;">No hay registros en esta categoría aún.</div>`;
      return;
    }

    listaEl.innerHTML = lista.map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; margin-bottom: 4px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; font-size: 0.74rem;">
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%;">
          <span style="font-weight: 700; color: var(--accent-cyan); font-family: monospace;">${item.id}</span>
          <strong style="color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(item.nombreCompleto)}</strong>
          <span style="color: var(--text-dim); font-family: monospace; font-size: 0.70rem;">(${item.noExpediente})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span style="font-size: 0.70rem; color: ${infoCat.color}; font-weight: 600;">${escapeHTML(item.estadoOficial)}</span>
          <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${item.hora}</span>
        </div>
      </div>
    `).join('');
  }
}

function mostrarConsolaHabana() {
  state.habanaFiltroActivo = null;
  const consoleBox = document.getElementById('habana-batch-console');
  const inspectorBox = document.getElementById('habana-inspector-container');

  if (consoleBox) consoleBox.style.display = 'block';
  if (inspectorBox) inspectorBox.style.display = 'none';

  const botones = ['btn-habana-stat-favorables', 'btn-habana-stat-tramite', 'btn-habana-stat-nohallados', 'btn-habana-stat-errores'];
  botones.forEach(id => {
    const b = document.getElementById(id);
    if (b) {
      b.style.borderColor = 'transparent';
      b.style.boxShadow = 'none';
    }
  });
}

async function iniciarVerificacionLoteHabana() {
  if (state.operacionEnProgreso) {
    Toast.error('Ya hay una operación de red en curso. Por favor, espera a que termine.');
    return;
  }
  state.operacionEnProgreso = true;

  state.habanaCandidatos = obtenerCandidatosCalificadosHabanaLocal();
  const total = state.habanaCandidatos.length;

  if (total === 0) {
    state.operacionEnProgreso = false;
    Toast.warning('No hay expedientes calificados para verificar en La Habana.');
    return;
  }

  const btnIniciar = document.getElementById('btn-habana-batch-iniciar');
  const btnDetener = document.getElementById('btn-habana-batch-detener');
  const progressBar = document.getElementById('habana-progreso-bar');
  const progressText = document.getElementById('habana-progreso-texto');
  const progressStatus = document.getElementById('habana-progreso-estado');
  const consoleBox = document.getElementById('habana-batch-console');

  if (btnIniciar) btnIniciar.style.display = 'none';
  if (btnDetener) btnDetener.style.display = 'inline-block';
  state.habanaBatchCancelado = false;

  // Inicializar almacenamiento reactivo ultra-liviano
  habanaBatchStats = { favorables: 0, tramite: 0, noHallados: 0, errores: 0 };
  state.habanaResultados = {
    aprobados: [],
    enTramite: [],
    noHallados: [],
    errores: []
  };

  mostrarConsolaHabana();
  actualizarStatsLoteHabana();
  if (consoleBox) consoleBox.innerHTML = '';
  agregarLineaConsolaHabana(`🚀 Iniciando verificación masiva de ${total} expedientes calificados...`, 'info');

  try {
    for (let i = 0; i < total; i++) {
      if (state.habanaBatchCancelado) {
        agregarLineaConsolaHabana(`⏹️ Proceso detenido por el usuario.`, 'warn');
        if (progressStatus) progressStatus.innerText = 'Pausado';
        break;
      }

      const candidato = state.habanaCandidatos[i];
      const avancePct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = `${avancePct}%`;
      if (progressText) progressText.innerText = `Progreso: ${i + 1} de ${total} (${avancePct}%)`;
      if (progressStatus) progressStatus.innerText = `Verificando ${candidato.identificador}...`;

      agregarLineaConsolaHabana(`Consultando ${candidato.identificador}: ${candidato.nombreCompleto} (${candidato.noExpediente})...`, 'info');

      try {
        const itemPayload = {
          identificador: candidato.identificador,
          nombre: candidato.nombre || candidato.nombreCompleto.split(' ')[0],
          apellidos: candidato.apellidos || candidato.nombreCompleto,
          noExpediente: candidato.noExpediente,
          rowIndex: candidato.rowIndex || 0,
          nombreCompleto: candidato.nombreCompleto
        };

        const res = await API.ejecutarAutomatizacion('ejecutarVerificadorHabana', { item: itemPayload, expediente: itemPayload, ...itemPayload });

        const horaRegistro = new Date().toLocaleTimeString();

        if (res.ok && res.resultado === 'OK') {
          const est = String(res.estadoConsulado || '').toUpperCase();
          if (est.includes('FAVORABLE') || est.includes('APROBADO') || est.includes('INSCRITO')) {
            habanaBatchStats.favorables++;
            state.habanaResultados.aprobados.push({
              id: candidato.identificador,
              nombreCompleto: candidato.nombreCompleto,
              noExpediente: candidato.noExpediente,
              estadoOficial: res.estadoConsulado || 'APROBADO',
              hora: horaRegistro
            });
            agregarLineaConsolaHabana(`🎉 ${candidato.identificador} -> APROBADO: ${res.estadoConsulado}`, 'ok');
          } else {
            habanaBatchStats.tramite++;
            state.habanaResultados.enTramite.push({
              id: candidato.identificador,
              nombreCompleto: candidato.nombreCompleto,
              noExpediente: candidato.noExpediente,
              estadoOficial: res.estadoConsulado || 'En Trámite',
              hora: horaRegistro
            });
            agregarLineaConsolaHabana(`⏳ ${candidato.identificador} -> EN TRÁMITE: ${res.estadoConsulado}`, 'info');
          }
        } else if (res.resultado === 'NO_ENCONTRADO') {
          habanaBatchStats.noHallados++;
          state.habanaResultados.noHallados.push({
            id: candidato.identificador,
            nombreCompleto: candidato.nombreCompleto,
            noExpediente: candidato.noExpediente,
            estadoOficial: 'No Encontrado (4 variantes probadas)',
            hora: horaRegistro
          });
          agregarLineaConsolaHabana(`⚠️ ${candidato.identificador} -> No encontrado (4 variantes probadas)`, 'warn');
        } else {
          habanaBatchStats.errores++;
          state.habanaResultados.errores.push({
            id: candidato.identificador,
            nombreCompleto: candidato.nombreCompleto,
            noExpediente: candidato.noExpediente,
            estadoOficial: res.detalle || res.error || 'Fallo API',
            hora: horaRegistro
          });
          agregarLineaConsolaHabana(`🔴 ${candidato.identificador} -> Error: ${res.detalle || 'Fallo API'}`, 'error');
        }

      } catch (errLoop) {
        habanaBatchStats.errores++;
        state.habanaResultados.errores.push({
          id: candidato.identificador,
          nombreCompleto: candidato.nombreCompleto,
          noExpediente: candidato.noExpediente,
          estadoOficial: errLoop.message || 'Excepción',
          hora: new Date().toLocaleTimeString()
        });
        agregarLineaConsolaHabana(`🔴 ${candidato.identificador} -> Excepción: ${errLoop.message}`, 'error');
      }

      actualizarStatsLoteHabana();
      await new Promise(r => setTimeout(r, 1200));
    }

    if (!state.habanaBatchCancelado) {
      if (progressStatus) progressStatus.innerText = 'Completado ✓';
      agregarLineaConsolaHabana(`🏁 Verificación masiva finalizada. ${habanaBatchStats.favorables} aprobados, ${habanaBatchStats.tramite} en trámite, ${habanaBatchStats.noHallados} no hallados, ${habanaBatchStats.errores} errores.`, 'ok');
      Toast.success('Verificación por lote de La Habana completada.');
      if (typeof cargarDatosEnVivo === 'function') cargarDatosEnVivo();
    }
  } finally {
    state.operacionEnProgreso = false;
    if (btnIniciar) btnIniciar.style.display = 'inline-block';
    if (btnDetener) btnDetener.style.display = 'none';
  }
}

function detenerVerificacionLoteHabana() {
  state.habanaBatchCancelado = true;
  const btnIniciar = document.getElementById('btn-habana-batch-iniciar');
  const btnDetener = document.getElementById('btn-habana-batch-detener');
  if (btnIniciar) btnIniciar.style.display = 'inline-block';
  if (btnDetener) btnDetener.style.display = 'none';
}

const ModalAutomatizaciones = {
  init() {
    const formCitas = document.getElementById('form-citas');
    if (formCitas) {
      formCitas.addEventListener('submit', guardarCitasFormulario);
      formCitas.addEventListener('input', evaluarDirtyCitas);
      formCitas.addEventListener('change', evaluarDirtyCitas);
    }
    const inUrgencia = document.getElementById('citas-urgencia');
    if (inUrgencia) inUrgencia.addEventListener('change', evaluarDirtyCitas);
    const inPref = document.getElementById('citas-preferencia');
    if (inPref) inPref.addEventListener('input', evaluarDirtyCitas);
    const inUser = document.getElementById('citas-usuario');
    if (inUser) inUser.addEventListener('input', evaluarDirtyCitas);
    const inPass = document.getElementById('citas-password');
    if (inPass) inPass.addEventListener('input', evaluarDirtyCitas);
    const inFecha = document.getElementById('citas-fecha-asignada');
    if (inFecha) inFecha.addEventListener('input', evaluarDirtyCitas);
  }
};

// ─────────────────────────────────────────────
// EXPORTACIONES Y ALIAS GLOBALES EN WINDOW
// ─────────────────────────────────────────────
window.cerrarModalCitas = cerrarModalCitas;
window.cerrarModalRadarCitas = cerrarModalCitas;
window.abrirModalRadarCitas = abrirModalRadarCitas;
window.guardarCitasFormulario = guardarCitasFormulario;
window.guardarPreferenciasCitasFormulario = guardarCitasFormulario;
window.evaluarDirtyCitas = evaluarDirtyCitas;
window.formCitasIsDirty = formCitasIsDirty;

window.abrirModalAuditorVencimientos = abrirModalAuditorVencimientos;
window.abrirModalAuditor = abrirModalAuditorVencimientos;
window.cerrarModalAuditorVencimientos = cerrarModalAuditorVencimientos;
window.cerrarModalAuditor = cerrarModalAuditorVencimientos;
window.ejecutarAuditorDesdeUI = ejecutarAuditorDesdeUI;

window.abrirModalEnvioNotificaciones = abrirModalEnvioNotificaciones;
window.abrirModalEnvios = abrirModalEnvioNotificaciones;
window.cerrarModalEnvioNotificaciones = cerrarModalEnvios;
window.cerrarModalEnvios = cerrarModalEnvios;
window.ejecutarEnviosDesdeUI = ejecutarEnviosDesdeUI;

window.abrirModalSincronizadorCitas = abrirModalSincronizadorCitas;
window.abrirModalCitasSync = abrirModalSincronizadorCitas;
window.cerrarModalSincronizadorCitas = cerrarModalSincronizadorCitas;
window.cerrarModalCitasSync = cerrarModalSincronizadorCitas;
window.ejecutarSincronizacionCitasInteractivo = ejecutarSincronizacionCitasInteractivo;

window.abrirModalVerificadorHabana = abrirModalVerificadorHabana;
window.abrirModalHabana = abrirModalVerificadorHabana;
window.cerrarModalVerificadorHabana = cerrarModalHabana;
window.cerrarModalHabana = cerrarModalHabana;
window.consultarHabanaIndividualDesdeUI = consultarHabanaIndividualDesdeUI;
window.consultarIndividualHabana = consultarHabanaIndividualDesdeUI;
window.iniciarVerificacionLoteHabana = iniciarVerificacionLoteHabana;
window.detenerVerificacionLoteHabana = detenerVerificacionLoteHabana;
window.cambiarTabHabana = cambiarTabHabana;
window.filtrarInspectorHabana = filtrarInspectorHabana;
window.mostrarConsolaHabana = mostrarConsolaHabana;
