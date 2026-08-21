// =============================================================================
// VISTA 2: GESTIÓN DE EXPEDIENTES LMD (expedientesView.js)
// Tabla reactiva, filtros de búsqueda, estado, consulado y paginación universal
// =============================================================================

function obtenerClaseBadgeEstado(estadoStr) {
  const estUpper = String(estadoStr || '').toUpperCase().trim();
  const defs = (typeof CONFIG_PORTAL !== 'undefined' && CONFIG_PORTAL.ESTADOS_OFICIALES) ? CONFIG_PORTAL.ESTADOS_OFICIALES : [];
  const def = defs.find(e => e.codigo === estUpper);
  return def ? def.claseBadge : 'badge-estado-resolucion';
}

function actualizarOpcionesConsuladosExpedientes() {
  const elCons = document.getElementById('filter-consulado');
  if (!elCons) return;

  const total = state.expedientes ? state.expedientes.length : 0;
  const mapaSedes = {};

  (state.expedientes || []).forEach(c => {
    const cons = String(c.consulado || 'CUBA LA HABANA').trim().toUpperCase();
    mapaSedes[cons] = (mapaSedes[cons] || 0) + 1;
  });

  const sedesEspana = [];
  const sedesInternacionales = [];

  Object.keys(mapaSedes).sort().forEach(sede => {
    if (sede.includes('ESPAÑA') || sede.startsWith('ESP ')) {
      sedesEspana.push(sede);
    } else {
      sedesInternacionales.push(sede);
    }
  });

  const valorActual = elCons.value;
  let html = `<option value="TODOS">🏛️ Todas las Sedes / Consulados (${total})</option>`;

  if (sedesEspana.length > 0) {
    html += `<optgroup label="🇪🇸 Registros Civiles (España)">`;
    sedesEspana.forEach(s => {
      html += `<option value="${escapeHTML(s)}">${escapeHTML(s)} (${mapaSedes[s]})</option>`;
    });
    html += `</optgroup>`;
  }

  if (sedesInternacionales.length > 0) {
    html += `<optgroup label="🌎 Consulados Internacionales">`;
    sedesInternacionales.forEach(s => {
      html += `<option value="${escapeHTML(s)}">${escapeHTML(s)} (${mapaSedes[s]})</option>`;
    });
    html += `</optgroup>`;
  }

  elCons.innerHTML = html;

  if (Object.keys(mapaSedes).includes(valorActual)) {
    elCons.value = valorActual;
  } else {
    elCons.value = 'TODOS';
    state.filtroConsulado = 'TODOS';
  }
}

function aplicarFiltros() {
  const elCons = document.getElementById('filter-consulado');
  const elEst = document.getElementById('filter-estado');

  state.filtroConsulado = elCons ? elCons.value : 'TODOS';
  state.filtroEstado = elEst ? elEst.value : 'TODOS';
  const termino = (state.terminoBusqueda || '').toLowerCase();
  
  state.filtrados = state.expedientes.filter(c => {
    const id = String(c.identificador || '').toLowerCase();
    const nombre = String(c.nombreCompleto || '').toLowerCase();
    const cons = String(c.consulado || '').toLowerCase();
    const estado = String(c.estado || '').toLowerCase();
    const detalle = String(c.detalle || '').toLowerCase();
    const exp = String(c.noExpediente || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();
    const correoCreado = String(c.correoCreado || '').toLowerCase();

    const coincideTexto = !termino || 
      id.includes(termino) || 
      nombre.includes(termino) || 
      cons.includes(termino) || 
      estado.includes(termino) || 
      detalle.includes(termino) || 
      exp.includes(termino) ||
      email.includes(termino) ||
      correoCreado.includes(termino);
    
    let coincideConsulado = true;
    if (state.filtroConsulado !== 'TODOS') {
      coincideConsulado = String(c.consulado || '').toUpperCase().includes(state.filtroConsulado);
    }

    let coincideEstado = true;
    if (state.filtroEstado !== 'TODOS') {
      coincideEstado = String(c.estado || '').toUpperCase() === state.filtroEstado;
    }

    return coincideTexto && coincideConsulado && coincideEstado;
  });

  const totalPaginas = Math.ceil(state.filtrados.length / state.registrosPorPagina) || 1;
  if (state.paginaActual > totalPaginas) state.paginaActual = 1;

  const badgeTotal = document.getElementById('expedientes-total-badge');
  if (badgeTotal) badgeTotal.innerText = `📋 ${state.filtrados.length} Filtrados`;

  renderizarTablaExpedientes();
  renderizarPaginacion();
}

function renderizarCeldaEstadoAviso(c) {
  const baja = String(c.baja || '').trim().toUpperCase();
  const notificado = String(c.notificado || '').trim().toUpperCase();
  const email = String(c.email || '').trim();
  const estado = String(c.estado || '').trim().toUpperCase();
  const detalle = String(c.detalle || '').trim();

  if (baja === 'SI') {
    return `<span class="badge badge-estado-desestimado" style="font-size: 0.68rem; letter-spacing: 0.02em;" title="El cliente solicitó no recibir correos">🚫 Baja</span>`;
  }

  if (!email || !email.includes('@')) {
    return `<span class="badge badge-estado-credenciales" style="font-size: 0.68rem;" title="Sin correo electrónico personal">⚠️ Sin Email</span>`;
  }

  if (notificado === 'SI') {
    const fNotif = String(c.fechaUltimaNotificacion || '').trim();
    return `
      <div>
        <span class="badge badge-estado-favorable" style="font-size: 0.68rem; letter-spacing: 0.02em;">🟢 Notificado</span>
        <div style="font-size: 0.70rem; color: var(--text-dim); margin-top: 2px; font-family: monospace;">${escapeHTML(fNotif || 'Al día')}</div>
      </div>
    `;
  }

  const carenciaDias = (state.configSistema && parseInt(state.configSistema.DIAS_CARENCIA_RESOLUCION, 10)) || 60;
  if (estado === 'PENDIENTE RESOLUCION') {
    const fechaCita = (typeof extraerFechaDetalleJS === 'function') ? extraerFechaDetalleJS(detalle) : null;
    if (fechaCita) {
      const hoy = new Date();
      const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const diasDesdeCita = Math.floor((hoyLimpio - fechaCita) / (1000 * 60 * 60 * 24));

      if (diasDesdeCita >= 0 && diasDesdeCita < carenciaDias) {
        return `
          <div>
            <span class="badge badge-estado-cita" style="font-size: 0.68rem; letter-spacing: 0.02em;" title="Dentro de los ${carenciaDias} días de carencia desde la cita">⏳ Carencia</span>
            <div style="font-size: 0.70rem; color: var(--accent-gold); margin-top: 2px; font-weight: 500;">${diasDesdeCita}/${carenciaDias} días</div>
          </div>
        `;
      }
    }
  }

  return `
    <div>
      <span class="badge badge-estado-resolucion" style="font-size: 0.68rem; letter-spacing: 0.02em;" title="Pendiente de despacho por el Motor de Envíos">🚀 Pendiente (NO)</span>
      <div style="font-size: 0.70rem; color: var(--accent-cyan); margin-top: 2px;">Listo para envío</div>
    </div>
  `;
}

function renderizarTablaExpedientes() {
  const tbody = document.getElementById('table-expedientes-body');
  if (!tbody) return;

  if (state.filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px; color: var(--text-muted);">
          🔍 No se encontraron expedientes con los criterios seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  const inicio = (state.paginaActual - 1) * state.registrosPorPagina;
  const fin = inicio + state.registrosPorPagina;
  const paginaItems = state.filtrados.slice(inicio, fin);

  tbody.innerHTML = paginaItems.map(c => {
    const badgeClase = obtenerClaseBadgeEstado(c.estado);
    const celdaAviso = renderizarCeldaEstadoAviso(c);

    return `
      <tr class="clickable-row" onclick="abrirModalExpediente('${escapeHTML(c.identificador)}')" title="Clic para abrir la ficha general de ${escapeHTML(c.nombreCompleto)}">
        <td style="font-weight: 700; color: var(--accent-cyan); width: 65px;">${escapeHTML(c.identificador)}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(c.nombreCompleto)}</div>
          <div style="font-size: 0.76rem; color: var(--text-dim);">${c.noExpediente ? 'No. ' + escapeHTML(c.noExpediente) : (escapeHTML(c.email) || 'Sin datos')}</div>
        </td>
        <td>
          <span class="badge badge-consulado">${escapeHTML(c.consulado || 'CUBA LA HABANA')}</span>
        </td>
        <td>
          <span class="badge ${badgeClase}">${escapeHTML(c.estado || 'PENDIENTE RESOLUCION')}</span>
        </td>
        <td style="text-align: center; width: 130px;">
          ${celdaAviso}
        </td>
        <td>
          <div style="font-size: 0.82rem; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-muted);" title="${escapeHTML(c.detalle || '')}">
            ${escapeHTML(c.detalle || c.observaciones || '—')}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarPaginacion() {
  const total = state.filtrados.length;
  const totalPaginas = Math.ceil(total / state.registrosPorPagina) || 1;

  const inicio = total === 0 ? 0 : (state.paginaActual - 1) * state.registrosPorPagina + 1;
  const fin = Math.min(state.paginaActual * state.registrosPorPagina, total);

  const elInfo = document.getElementById('pagination-info');
  const elIndicador = document.getElementById('page-indicator');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (elInfo) elInfo.innerText = `Mostrando ${inicio}–${fin} de ${total} expedientes`;
  if (elIndicador) elIndicador.innerText = `Página ${state.paginaActual} de ${totalPaginas}`;

  if (btnPrev) btnPrev.disabled = state.paginaActual <= 1;
  if (btnNext) btnNext.disabled = state.paginaActual >= totalPaginas;
}

function cambiarPagina(delta) {
  const totalPaginas = Math.ceil(state.filtrados.length / state.registrosPorPagina) || 1;
  const nuevaPagina = state.paginaActual + delta;

  if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
    state.paginaActual = nuevaPagina;
    renderizarTablaExpedientes();
    renderizarPaginacion();
  }
}

function cambiarRegistrosPorPagina(cantidad) {
  state.registrosPorPagina = parseInt(cantidad, 10);
  state.paginaActual = 1;
  renderizarTablaExpedientes();
  renderizarPaginacion();
}
