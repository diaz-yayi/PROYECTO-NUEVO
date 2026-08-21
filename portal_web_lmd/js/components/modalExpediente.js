// =============================================================================
// COMPONENTE: MODAL DE EXPEDIENTES CRUD (modalExpediente.js)
// Gestión de alta/edición, ID bloqueado (=ROW()-1), Poka-Yoke e isDirty
// =============================================================================

function poblarSelectConsulados() {
  const select = document.getElementById('exp-consulado-select');
  if (!select) return;

  let html = '';
  for (const [pais, lista] of Object.entries(GRUPOS_CONSULADOS)) {
    html += `<optgroup label="${pais}">`;
    for (const c of lista) {
      html += `<option value="${c.codigo}">${c.nombre}</option>`;
    }
    html += `</optgroup>`;
  }
  html += `
    <optgroup label="✏️ Personalizado">
      <option value="__OTRO__">✏️ [ Escribir otro consulado a mano ]</option>
    </optgroup>
  `;

  select.innerHTML = html;
}

function gestionarCambioConsulado(valor) {
  const wrapperOtro = document.getElementById('wrapper-consulado-otro');
  const inputManual = document.getElementById('exp-consulado-manual');

  if (valor === '__OTRO__') {
    wrapperOtro.style.display = 'block';
    if (inputManual) inputManual.focus();
  } else {
    wrapperOtro.style.display = 'none';
  }
  evaluarDirtyExpediente();
}

function actualizarSugerenciaDetalle(estado) {
  const inputDetalle = document.getElementById('exp-detalle');
  const contenedorPildoras = document.getElementById('contenedor-pildoras-sugerencias');
  const textoGuia = document.getElementById('guia-explicacion-detalle');

  const sugerenciasMap = (typeof CONFIG_PORTAL !== 'undefined' && CONFIG_PORTAL.SUGERENCIAS_DETALLE) ? CONFIG_PORTAL.SUGERENCIAS_DETALLE : {};
  const regla = sugerenciasMap[estado] || {
    placeholder: "Escribe los detalles del trámite",
    sugerencias: [],
    explicacion: "Detalles adicionales del expediente"
  };

  if (inputDetalle) inputDetalle.placeholder = regla.placeholder;

  if (contenedorPildoras) {
    if (regla.sugerencias && regla.sugerencias.length > 0) {
      contenedorPildoras.innerHTML = regla.sugerencias.map(sug => `
        <button type="button" class="pildora-sugerencia" onclick="aplicarTextoDetalle('${sug}')" title="Clic para autocompletar este formato">
          💡 ${sug}
        </button>
      `).join('');
    } else {
      contenedorPildoras.innerHTML = '';
    }
  }

  if (textoGuia) textoGuia.innerText = regla.explicacion;

  // REGLA POKA-YOKE / ONEDIT: Si se cambia el estado del expediente, reiniciar automáticamente los campos de notificación
  if (state.snapshotExpediente && state.snapshotExpediente.estado && estado !== state.snapshotExpediente.estado) {
    const selNotif = document.getElementById('exp-notificado-select');
    if (selNotif) selNotif.value = 'NO';
    const inFechaNotif = document.getElementById('exp-fecha-notif-input');
    if (inFechaNotif) inFechaNotif.value = '';

    actualizarDiagnosticoNotificacionesExpediente({
      notificado: 'NO',
      fechaUltimaNotificacion: '',
      baja: document.getElementById('exp-baja-select') ? document.getElementById('exp-baja-select').value : 'NO',
      email: document.getElementById('exp-email-personal') ? document.getElementById('exp-email-personal').value.trim() : '',
      detalle: inputDetalle ? inputDetalle.value.trim() : '',
      estado: estado
    });
  }

  evaluarDirtyExpediente();
}

function aplicarTextoDetalle(texto) {
  const inputDetalle = document.getElementById('exp-detalle');
  if (inputDetalle) {
    inputDetalle.value = texto;
    inputDetalle.focus();
    evaluarDirtyExpediente();
  }
}

function actualizarDiagnosticoNotificacionesExpediente(candidatoContext = null) {
  const badgeEl = document.getElementById('exp-diagnostico-badge');
  const explicacionEl = document.getElementById('exp-diagnostico-explicacion');
  const selectNotif = document.getElementById('exp-notificado-select');
  const inputFecha = document.getElementById('exp-fecha-notif-input');
  const selectBaja = document.getElementById('exp-baja-select');

  if (!badgeEl || !explicacionEl) return;

  const notificado = selectNotif ? selectNotif.value : ((candidatoContext && candidatoContext.notificado === 'SI') ? 'SI' : 'NO');
  const fechaNotif = inputFecha ? inputFecha.value.trim() : ((candidatoContext && candidatoContext.fechaUltimaNotificacion) || '');
  const baja = selectBaja ? selectBaja.value : ((candidatoContext && candidatoContext.baja === 'SI') ? 'SI' : 'NO');
  const email = (document.getElementById('exp-email-personal')?.value || (candidatoContext && candidatoContext.email) || '').trim();
  const detalle = (document.getElementById('exp-detalle')?.value || (candidatoContext && candidatoContext.detalle) || '').trim();
  const estado = (document.getElementById('exp-estado')?.value || (candidatoContext && candidatoContext.estado) || '').trim().toUpperCase();

  const carenciaDias = (state.configSistema && parseInt(state.configSistema.DIAS_CARENCIA_RESOLUCION, 10)) || 60;
  const cicloSeguimiento = (state.configSistema && parseInt(state.configSistema.DIAS_CICLO_SEGUIMIENTO, 10)) || 30;

  if (baja === 'SI') {
    badgeEl.className = 'badge badge-estado-desestimado';
    badgeEl.innerText = '🚫 Desuscrito por el Cliente';
    explicacionEl.innerHTML = '🚫 <strong>Baja Registrada:</strong> El cliente solicitó deshabilitar el envío de notificaciones oficiales a su correo.';
    return;
  }

  if (!email || !email.includes('@')) {
    badgeEl.className = 'badge badge-estado-credenciales';
    badgeEl.innerText = '⚠️ Sin Email Personal';
    explicacionEl.innerHTML = '⚠️ <strong>Sin Destinatario:</strong> Se requiere ingresar un correo electrónico personal válido para poder despachar notificaciones.';
    return;
  }

  if (notificado === 'SI') {
    badgeEl.className = 'badge badge-estado-favorable';
    badgeEl.innerText = '🟢 Notificado Activo';
    explicacionEl.innerHTML = `🟢 <strong>Ciclo de Seguimiento:</strong> Última notificación registrada el <strong>${fechaNotif || 'recientemente'}</strong>. El próximo aviso se evaluará tras ${cicloSeguimiento} días.`;
    return;
  }

  const fechaCita = (typeof extraerFechaDetalleJS === 'function') ? extraerFechaDetalleJS(detalle) : null;
  if (fechaCita && estado === 'PENDIENTE RESOLUCION') {
    const hoy = new Date();
    const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diasDesdeCita = Math.floor((hoyLimpio - fechaCita) / (1000 * 60 * 60 * 24));

    if (diasDesdeCita >= 0 && diasDesdeCita < carenciaDias) {
      const diasRestantes = carenciaDias - diasDesdeCita;
      badgeEl.className = 'badge badge-estado-cita';
      badgeEl.innerText = `⏳ En Carencia Legal (${diasDesdeCita} de ${carenciaDias}d)`;
      explicacionEl.innerHTML = `⏳ <strong>Periodo de Gracia Activo:</strong> La cita consular fue el <strong>${fechaCita.toLocaleDateString()}</strong> (hace ${diasDesdeCita} días). No recibe envíos porque está dentro de los <strong>${carenciaDias} días de carencia legal</strong> configurados. Quedan <strong>${diasRestantes} días</strong> para su primer aviso automático.`;
      return;
    }
  }

  badgeEl.className = 'badge badge-estado-resolucion';
  badgeEl.innerText = '🚀 Listo para Primer Envío';
  explicacionEl.innerHTML = `🚀 <strong>Pendiente de Despacho:</strong> El expediente superó el periodo de carencia (o no requiere espera) y calificará automáticamente en la próxima ejecución del Motor de Envíos Masivos.`;
}

function tomarSnapshotExpediente() {
  const selectCons = document.getElementById('exp-consulado-select');
  let consVal = selectCons ? selectCons.value : '';
  if (consVal === '__OTRO__') {
    consVal = document.getElementById('exp-consulado-manual').value.trim();
  }

  state.snapshotExpediente = {
    nombre: document.getElementById('exp-nombre') ? document.getElementById('exp-nombre').value.trim() : '',
    apellidos: document.getElementById('exp-apellidos') ? document.getElementById('exp-apellidos').value.trim() : '',
    consulado: consVal,
    noExpediente: document.getElementById('exp-no-expediente') ? document.getElementById('exp-no-expediente').value.trim() : '',
    estado: document.getElementById('exp-estado') ? document.getElementById('exp-estado').value : '',
    detalle: document.getElementById('exp-detalle') ? document.getElementById('exp-detalle').value.trim() : '',
    observaciones: document.getElementById('exp-observaciones') ? document.getElementById('exp-observaciones').value.trim() : '',
    correoCreado: document.getElementById('exp-correo-creado') ? document.getElementById('exp-correo-creado').value.trim() : '',
    email: document.getElementById('exp-email-personal') ? document.getElementById('exp-email-personal').value.trim() : '',
    notificado: document.getElementById('exp-notificado-select') ? document.getElementById('exp-notificado-select').value : 'NO',
    fechaUltimaNotificacion: document.getElementById('exp-fecha-notif-input') ? document.getElementById('exp-fecha-notif-input').value.trim() : '',
    baja: document.getElementById('exp-baja-select') ? document.getElementById('exp-baja-select').value : 'NO'
  };

  const btnGuardar = document.getElementById('btn-guardar-exp');
  if (btnGuardar) btnGuardar.disabled = true;
}

function formExpedienteIsDirty() {
  if (!state.snapshotExpediente) return false;

  const selectCons = document.getElementById('exp-consulado-select');
  let consVal = selectCons ? selectCons.value : '';
  if (consVal === '__OTRO__') {
    consVal = document.getElementById('exp-consulado-manual').value.trim();
  }

  const actual = {
    nombre: document.getElementById('exp-nombre') ? document.getElementById('exp-nombre').value.trim() : '',
    apellidos: document.getElementById('exp-apellidos') ? document.getElementById('exp-apellidos').value.trim() : '',
    consulado: consVal,
    noExpediente: document.getElementById('exp-no-expediente') ? document.getElementById('exp-no-expediente').value.trim() : '',
    estado: document.getElementById('exp-estado') ? document.getElementById('exp-estado').value : '',
    detalle: document.getElementById('exp-detalle') ? document.getElementById('exp-detalle').value.trim() : '',
    observaciones: document.getElementById('exp-observaciones') ? document.getElementById('exp-observaciones').value.trim() : '',
    correoCreado: document.getElementById('exp-correo-creado') ? document.getElementById('exp-correo-creado').value.trim() : '',
    email: document.getElementById('exp-email-personal') ? document.getElementById('exp-email-personal').value.trim() : '',
    notificado: document.getElementById('exp-notificado-select') ? document.getElementById('exp-notificado-select').value : 'NO',
    fechaUltimaNotificacion: document.getElementById('exp-fecha-notif-input') ? document.getElementById('exp-fecha-notif-input').value.trim() : '',
    baja: document.getElementById('exp-baja-select') ? document.getElementById('exp-baja-select').value : 'NO'
  };

  return JSON.stringify(state.snapshotExpediente) !== JSON.stringify(actual);
}

function evaluarDirtyExpediente() {
  actualizarDiagnosticoNotificacionesExpediente();
  const isDirty = formExpedienteIsDirty();
  const btnGuardar = document.getElementById('btn-guardar-exp');
  if (btnGuardar) btnGuardar.disabled = !isDirty;
}

function abrirModalNuevo() {
  document.getElementById('modal-exp-titulo').innerText = '➕ Alta de Nuevo Expediente';
  document.getElementById('exp-id-display').innerText = 'AUTOGENERADO (=ROW()-1)';
  document.getElementById('exp-id-val').value = '';
  document.getElementById('exp-nombre').value = '';
  document.getElementById('exp-apellidos').value = '';
  
  const selectCons = document.getElementById('exp-consulado-select');
  if (selectCons) selectCons.value = 'CUBA LA HABANA';
  gestionarCambioConsulado('CUBA LA HABANA');

  document.getElementById('exp-no-expediente').value = '';
  
  const selectEstado = document.getElementById('exp-estado');
  selectEstado.value = 'PENDIENTE RESOLUCION';
  actualizarSugerenciaDetalle('PENDIENTE RESOLUCION');

  document.getElementById('exp-detalle').value = '';
  document.getElementById('exp-observaciones').value = '';
  document.getElementById('exp-correo-creado').value = '';
  document.getElementById('exp-email-personal').value = '';

  const selNotif = document.getElementById('exp-notificado-select');
  if (selNotif) selNotif.value = 'NO';
  const inFechaNotif = document.getElementById('exp-fecha-notif-input');
  if (inFechaNotif) inFechaNotif.value = '';
  const selBaja = document.getElementById('exp-baja-select');
  if (selBaja) selBaja.value = 'NO';

  actualizarDiagnosticoNotificacionesExpediente({
    notificado: 'NO',
    fechaUltimaNotificacion: '',
    baja: 'NO',
    email: '',
    detalle: '',
    estado: 'PENDIENTE RESOLUCION'
  });

  tomarSnapshotExpediente();
  document.getElementById('modal-expediente-general').classList.add('active');
}

function abrirModalExpediente(id) {
  const candidato = state.expedientes.find(c => String(c.identificador) === String(id));
  if (!candidato) return;

  document.getElementById('modal-exp-titulo').innerText = `📄 Ficha del Expediente: ${candidato.identificador}`;
  document.getElementById('exp-id-display').innerText = candidato.identificador;
  document.getElementById('exp-id-val').value = candidato.identificador;
  document.getElementById('exp-nombre').value = candidato.nombre || '';
  document.getElementById('exp-apellidos').value = candidato.apellidos || '';
  
  const consuladoReal = (candidato.consulado || 'CUBA LA HABANA').trim().toUpperCase();
  const selectCons = document.getElementById('exp-consulado-select');
  const inputManual = document.getElementById('exp-consulado-manual');
  
  let existeEnSelect = false;
  if (selectCons) {
    for (let opt of selectCons.options) {
      if (opt.value === consuladoReal) {
        selectCons.value = consuladoReal;
        existeEnSelect = true;
        break;
      }
    }
    if (!existeEnSelect) {
      selectCons.value = '__OTRO__';
      inputManual.value = consuladoReal;
    }
  }
  gestionarCambioConsulado(selectCons ? selectCons.value : '');

  document.getElementById('exp-no-expediente').value = candidato.noExpediente || '';
  
  const estadoFinal = candidato.estado || 'PENDIENTE RESOLUCION';
  const selectEstado = document.getElementById('exp-estado');
  selectEstado.value = estadoFinal;
  actualizarSugerenciaDetalle(estadoFinal);

  document.getElementById('exp-detalle').value = candidato.detalle || '';
  document.getElementById('exp-observaciones').value = candidato.observaciones || '';
  document.getElementById('exp-correo-creado').value = candidato.correoCreado || '';
  document.getElementById('exp-email-personal').value = candidato.email || '';

  const selNotif = document.getElementById('exp-notificado-select');
  if (selNotif) selNotif.value = candidato.notificado === 'SI' ? 'SI' : 'NO';

  const inFechaNotif = document.getElementById('exp-fecha-notif-input');
  if (inFechaNotif) inFechaNotif.value = candidato.fechaUltimaNotificacion || '';

  const selBaja = document.getElementById('exp-baja-select');
  if (selBaja) selBaja.value = candidato.baja === 'SI' ? 'SI' : 'NO';

  actualizarDiagnosticoNotificacionesExpediente(candidato);
  actualizarTarjetaVerificacionExpediente(candidato);

  tomarSnapshotExpediente();
  document.getElementById('modal-expediente-general').classList.add('active');
}

function actualizarTarjetaVerificacionExpediente(candidato) {
  const cont = document.getElementById('exp-verificacion-card-container');
  if (!cont) return;

  if (candidato && candidato.verificacionHabana) {
    const vHab = candidato.verificacionHabana;
    cont.style.display = 'block';
    cont.innerHTML = `
      <div style="background: rgba(34, 211, 238, 0.05); border: 1px solid rgba(34, 211, 238, 0.25); border-radius: var(--radius-md); padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent-cyan);">🇨🇺 Bitácora Oficial La Habana (API cgelahabana.es)</span>
          <span class="badge badge-estado-favorable" style="font-size: 0.70rem;">${escapeHTML(vHab.estadoConsulado)}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-main); display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>Resolución:</strong> ${escapeHTML(vHab.fechaResolucion || '—')}</div>
          <div><strong>Inscripción:</strong> ${escapeHTML(vHab.fechaInscripcion || '—')}</div>
          <div><strong>Datos Registrales:</strong> <span style="color: var(--accent-cyan); font-family: monospace;">${escapeHTML(vHab.datosRegistrales || '—')}</span></div>
          <div><strong>Último Chequeo:</strong> <span style="color: var(--text-muted); font-size: 0.74rem;">${escapeHTML(vHab.ultimaVerificacion || '—')}</span></div>
        </div>
      </div>
    `;
  } else if (candidato && candidato.verificacionRCC) {
    const vRcc = candidato.verificacionRCC;
    cont.style.display = 'block';
    cont.innerHTML = `
      <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-md); padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.76rem; font-weight: 700; color: var(--accent-gold);">🇪🇸 Bitácora Oficial RCC España (Ministerio de Justicia)</span>
          <span class="badge badge-estado-favorable" style="font-size: 0.70rem;">${escapeHTML(vRcc.estadoRCC)}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-main); display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div><strong>No. Expediente:</strong> <span style="color: var(--accent-gold); font-family: monospace;">${escapeHTML(vRcc.numeroExpediente)}/${escapeHTML(vRcc.anioExpediente)}</span></div>
          <div><strong>Resultado:</strong> <span class="badge badge-estado-favorable" style="font-size: 0.68rem;">${escapeHTML(vRcc.resultado || 'OK')}</span></div>
          <div style="grid-column: 1 / -1;"><strong>Dictamen Oficial:</strong> <span style="color: var(--text-muted); font-size: 0.76rem;">${escapeHTML(vRcc.detalleOficial || '—')}</span></div>
          <div style="grid-column: 1 / -1; font-size: 0.72rem; color: var(--text-dim);"><strong>Última Verificación:</strong> ${escapeHTML(vRcc.ultimaVerificacion || '—')}</div>
        </div>
      </div>
    `;
  } else {
    cont.style.display = 'none';
    cont.innerHTML = '';
  }
}

async function cerrarModalExpediente(forzar = false) {
  if (!forzar && formExpedienteIsDirty()) {
    const id = document.getElementById('exp-id-val')?.value || 'este expediente';
    const confirmar = await ConfirmModal.descartarCambios(`la ficha del expediente ${id}`);
    if (!confirmar) return; // Continuar editando
  }

  const modal = document.getElementById('modal-expediente-general');
  if (modal) modal.classList.remove('active');
  state.snapshotExpediente = null;
}

async function guardarExpedienteFormulario(e) {
  if (e) e.preventDefault();
  
  const selectCons = document.getElementById('exp-consulado-select');
  let consuladoFinal = selectCons.value;
  if (consuladoFinal === '__OTRO__') {
    consuladoFinal = document.getElementById('exp-consulado-manual').value.trim().toUpperCase();
  }

  if (!consuladoFinal) {
    Toast.error('Por favor, selecciona o escribe un Consulado.');
    return;
  }

  const datos = {
    identificador: document.getElementById('exp-id-val').value.trim(),
    nombre: document.getElementById('exp-nombre').value.trim(),
    apellidos: document.getElementById('exp-apellidos').value.trim(),
    consulado: consuladoFinal,
    noExpediente: document.getElementById('exp-no-expediente').value.trim(),
    estado: document.getElementById('exp-estado').value,
    detalle: document.getElementById('exp-detalle').value.trim(),
    observaciones: document.getElementById('exp-observaciones').value.trim(),
    correoCreado: document.getElementById('exp-correo-creado').value.trim(),
    email: document.getElementById('exp-email-personal').value.trim(),
    notificado: document.getElementById('exp-notificado-select') ? document.getElementById('exp-notificado-select').value : 'NO',
    fechaUltimaNotificacion: document.getElementById('exp-fecha-notif-input') ? document.getElementById('exp-fecha-notif-input').value.trim() : '',
    baja: document.getElementById('exp-baja-select') ? document.getElementById('exp-baja-select').value : 'NO',
    snapshot: state.snapshotExpediente || {}
  };

  if (!datos.nombre || !datos.apellidos) {
    Toast.error('Por favor, ingresa al menos Nombre y Apellidos.');
    return;
  }

  const btnGuardar = document.getElementById('btn-guardar-exp');
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerText = '💾 Guardando en Workspace...';
  }

  state.operacionEnProgreso = true;

  try {
    const res = await API.guardarExpediente(datos, 'guardar_expediente_general');
    if (res.ok || res.success) {
      // 1. Actualización reactiva instantánea en memoria local
      if (datos.identificador) {
        const idx = state.expedientes.findIndex(c => String(c.identificador) === String(datos.identificador));
        if (idx !== -1) {
          state.expedientes[idx] = {
            ...state.expedientes[idx],
            nombre: datos.nombre,
            apellidos: datos.apellidos,
            nombreCompleto: `${datos.nombre} ${datos.apellidos}`.trim(),
            consulado: datos.consulado,
            correoCreado: datos.correoCreado,
            noExpediente: datos.noExpediente,
            estado: datos.estado,
            detalle: datos.detalle,
            observaciones: datos.observaciones,
            email: datos.email,
            notificado: datos.notificado,
            fechaUltimaNotificacion: datos.fechaUltimaNotificacion,
            baja: datos.baja
          };
        }
      }

      Toast.success('Expediente guardado exitosamente en Google Sheets.');
      tomarSnapshotExpediente();
      cerrarModalExpediente(true);
      
      // 2. Refresco reactivo local inmediato (tabla y filtros) sin saturar la red
      if (typeof aplicarFiltros === 'function') aplicarFiltros();
    } else {
      Toast.error('Error al guardar: ' + (res.error || 'Desconocido'));
    }
  } catch (error) {
    Toast.error('Excepción al conectar con el servidor: ' + error.message);
  } finally {
    state.operacionEnProgreso = false;
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerText = '💾 Guardar en Workspace';
      evaluarDirtyExpediente();
    }
  }
}

const ModalExpediente = {
  init() {
    poblarSelectConsulados();
    const form = document.getElementById('form-expediente');
    if (form) {
      form.addEventListener('submit', guardarExpedienteFormulario);
      form.addEventListener('input', evaluarDirtyExpediente);
      form.addEventListener('change', evaluarDirtyExpediente);
    }
    const select = document.getElementById('exp-consulado-select');
    if (select) {
      select.addEventListener('change', (e) => gestionarCambioConsulado(e.target.value));
    }
    const selectEstado = document.getElementById('exp-estado');
    if (selectEstado) {
      selectEstado.addEventListener('change', (e) => actualizarSugerenciaDetalle(e.target.value));
    }
  },
  abrir: abrirModalExpediente,
  cerrar: cerrarModalExpediente,
  nuevo: abrirModalNuevo
};

window.abrirModalExpediente = abrirModalExpediente;
window.abrirModalNuevo = abrirModalNuevo;
window.abrirModalNuevoExpediente = abrirModalNuevo;
window.cerrarModalExpediente = cerrarModalExpediente;
window.guardarExpedienteFormulario = guardarExpedienteFormulario;

