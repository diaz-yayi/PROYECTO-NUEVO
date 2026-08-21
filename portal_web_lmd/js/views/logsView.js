// =============================================================================
// VISTA: AUDITORÍA Y BITÁCORA DEL SISTEMA (logsView.js) — EM (Exclusivo Administradores)
// =============================================================================

async function cargarLogsEnVista(forzar = false) {
  // Guardia de seguridad: solo rol admin
  if (!state.usuarioActual || state.usuarioActual.rol !== 'admin') {
    Toast.error('Acceso denegado. Este módulo es exclusivo para administradores.');
    Router.navigateToView('view-dashboard');
    return;
  }

  const tbody = document.getElementById('table-logs-body');
  if (tbody && (!state.logsOperaciones.length && !state.logsSeguridad.length)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          <span>Cargando registros de auditoría y bitácora...</span>
        </td>
      </tr>
    `;
  }

  try {
    if (state.logsTabActivo === 'operaciones') {
      if (forzar || state.logsOperaciones.length === 0) {
        const res = await API.obtenerLogsOperaciones();
        if (res && res.logs) {
          state.logsOperaciones = res.logs;
        } else {
          state.logsOperaciones = [];
        }
      }
    } else {
      if (forzar || state.logsSeguridad.length === 0) {
        const res = await API.obtenerLogsSeguridad();
        if (res && (res.logs || res.success)) {
          state.logsSeguridad = res.logs || [];
        } else {
          state.logsSeguridad = [];
        }
      }
    }

    actualizarOpcionesEventosLogs();
    aplicarFiltrosLogs();
  } catch (error) {
    console.error('Error al cargar logs:', error);
    Toast.error('No se pudieron obtener los registros de auditoría: ' + error.message);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--accent-red);">
            ⚠️ Error al conectar con el servidor de auditoría. Por favor, reintenta.
          </td>
        </tr>
      `;
    }
  }
}

function cambiarTabLogs(tab) {
  state.logsTabActivo = tab;
  state.logsPaginaActual = 1;
  state.filtroLogsEvento = 'TODOS';
  state.terminoBusquedaLogs = '';

  const inSearch = document.getElementById('filter-logs-search');
  if (inSearch) inSearch.value = '';

  const btnTabOp = document.getElementById('tab-logs-operaciones');
  const btnTabSeg = document.getElementById('tab-logs-seguridad');

  if (btnTabOp) btnTabOp.classList.toggle('active', tab === 'operaciones');
  if (btnTabSeg) btnTabSeg.classList.toggle('active', tab === 'seguridad');

  // Actualizar cabeceras de la tabla
  const thead = document.getElementById('table-logs-head');
  if (thead) {
    if (tab === 'operaciones') {
      thead.innerHTML = `
        <tr>
          <th style="width: 140px;">Fecha y Hora</th>
          <th style="width: 100px;">ID Expediente</th>
          <th style="width: 180px;">Cliente</th>
          <th style="width: 180px;">Correo Electrónico</th>
          <th style="width: 160px;">Acción / Proceso</th>
          <th>Detalle de Auditoría</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr>
          <th style="width: 140px;">Fecha y Hora</th>
          <th style="width: 160px;">Usuario / Operador</th>
          <th style="width: 180px;">Email</th>
          <th style="width: 160px;">Evento de Seguridad</th>
          <th style="width: 130px;">IP Origen</th>
          <th>Detalles y Dispositivo</th>
        </tr>
      `;
    }
  }

  cargarLogsEnVista(false);
}

function actualizarOpcionesEventosLogs() {
  const selectEvento = document.getElementById('filter-logs-evento');
  if (!selectEvento) return;

  const fuente = (state.logsTabActivo === 'operaciones') ? state.logsOperaciones : state.logsSeguridad;
  const campoEvento = (state.logsTabActivo === 'operaciones') ? 'accion' : 'evento';

  const eventosUnicos = new Set();
  fuente.forEach(item => {
    const ev = String(item[campoEvento] || '').trim();
    if (ev) eventosUnicos.add(ev);
  });

  const valorPrevio = selectEvento.value;
  selectEvento.innerHTML = '<option value="TODOS">Todos los Eventos</option>';

  Array.from(eventosUnicos).sort().forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev;
    opt.innerText = ev;
    selectEvento.appendChild(opt);
  });

  if (Array.from(eventosUnicos).includes(valorPrevio)) {
    selectEvento.value = valorPrevio;
  } else {
    selectEvento.value = 'TODOS';
  }
}

function aplicarFiltrosLogs() {
  const inSearch = document.getElementById('filter-logs-search');
  const selEvento = document.getElementById('filter-logs-evento');

  state.terminoBusquedaLogs = (inSearch ? inSearch.value : '').trim().toLowerCase();
  state.filtroLogsEvento = selEvento ? selEvento.value : 'TODOS';

  const fuente = (state.logsTabActivo === 'operaciones') ? state.logsOperaciones : state.logsSeguridad;
  const termino = state.terminoBusquedaLogs;

  state.logsFiltrados = fuente.filter(item => {
    let coincideTexto = true;
    if (termino) {
      const valores = Object.values(item).map(v => String(v || '').toLowerCase()).join(' ');
      coincideTexto = valores.includes(termino);
    }

    let coincideEvento = true;
    if (state.filtroLogsEvento !== 'TODOS') {
      const ev = (state.logsTabActivo === 'operaciones') ? String(item.accion || '') : String(item.evento || '');
      coincideEvento = (ev.toUpperCase() === state.filtroLogsEvento.toUpperCase());
    }

    return coincideTexto && coincideEvento;
  });

  const totalPaginas = Math.ceil(state.logsFiltrados.length / state.logsPorPagina) || 1;
  if (state.logsPaginaActual > totalPaginas) state.logsPaginaActual = 1;

  const badgeTotal = document.getElementById('logs-total-badge');
  if (badgeTotal) badgeTotal.innerText = `🛡️ ${state.logsFiltrados.length} Registros`;

  renderizarTablaLogs();
  renderizarPaginacionLogs();
}

function renderizarTablaLogs() {
  const tbody = document.getElementById('table-logs-body');
  if (!tbody) return;

  if (state.logsFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-dim);">
          No se encontraron registros de auditoría que coincidan con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  const inicio = (state.logsPaginaActual - 1) * state.logsPorPagina;
  const fin = inicio + state.logsPorPagina;
  const paginaItems = state.logsFiltrados.slice(inicio, fin);

  let html = '';

  if (state.logsTabActivo === 'operaciones') {
    paginaItems.forEach(log => {
      const accion = String(log.accion || 'GENERAL').toUpperCase();
      let badgeClase = 'badge-estado-resolucion';
      
      if (accion.includes('HABANA') || accion.includes('VERIFIC')) {
        badgeClase = 'badge-estado-favorable';
      } else if (accion.includes('ENVIO') || accion.includes('NOTIF')) {
        badgeClase = 'badge-estado-cita';
      } else if (accion.includes('EDIT') || accion.includes('GUARDAR')) {
        badgeClase = 'badge-estado-credenciales';
      } else if (accion.includes('ERROR') || accion.includes('FALL')) {
        badgeClase = 'badge-estado-desestimado';
      }

      html += `
        <tr>
          <td style="font-size: 0.78rem; color: var(--text-dim); white-space: nowrap;">${escapeHTML(log.fecha)}</td>
          <td><strong style="color: var(--accent-cyan); font-family: monospace; font-size: 0.84rem;">${escapeHTML(log.identificador)}</strong></td>
          <td style="font-weight: 600; font-size: 0.82rem; color: var(--text-main);">${escapeHTML(log.cliente)}</td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${escapeHTML(log.email)}</td>
          <td><span class="badge ${badgeClase}" style="font-size: 0.72rem;">${escapeHTML(log.accion)}</span></td>
          <td style="font-size: 0.80rem; color: var(--text-muted); line-height: 1.3;">${escapeHTML(log.detalle)}</td>
        </tr>
      `;
    });
  } else {
    // Seguridad y Accesos
    paginaItems.forEach(log => {
      const evento = String(log.evento || 'EVENTO').toUpperCase();
      let badgeClase = 'badge-estado-resolucion';

      if (evento.includes('EXITOSO') || evento.includes('CREADO')) {
        badgeClase = 'badge-estado-favorable';
      } else if (evento.includes('FALLIDO') || evento.includes('ELIMINADO')) {
        badgeClase = 'badge-estado-desestimado';
      } else if (evento.includes('ACTUALIZADO') || evento.includes('PASSWORD')) {
        badgeClase = 'badge-estado-credenciales';
      }

      html += `
        <tr>
          <td style="font-size: 0.78rem; color: var(--text-dim); white-space: nowrap;">${escapeHTML(log.creado_en)}</td>
          <td style="font-weight: 600; font-size: 0.82rem; color: var(--text-main);">${escapeHTML(log.nombre || log.email)}</td>
          <td style="font-size: 0.78rem; color: var(--text-dim);">${escapeHTML(log.email)}</td>
          <td><span class="badge ${badgeClase}" style="font-size: 0.72rem;">${escapeHTML(log.evento)}</span></td>
          <td style="font-size: 0.78rem; font-family: monospace; color: var(--accent-cyan);">${escapeHTML(log.ip_origen || '127.0.0.1')}</td>
          <td style="font-size: 0.80rem; color: var(--text-muted); line-height: 1.3;">
            <div>${escapeHTML(log.detalles || '—')}</div>
            ${log.user_agent ? `<div style="font-size: 0.70rem; color: var(--text-dim); margin-top: 2px;">${escapeHTML(log.user_agent.substring(0, 70))}...</div>` : ''}
          </td>
        </tr>
      `;
    });
  }

  tbody.innerHTML = html;
}

function renderizarPaginacionLogs() {
  const elInfo = document.getElementById('logs-pagination-info');
  const btnPrev = document.getElementById('btn-prev-page-logs');
  const btnNext = document.getElementById('btn-next-page-logs');
  const pageIndicator = document.getElementById('page-indicator-logs');
  const pageSizeSelect = document.getElementById('logs-page-size-select');

  const total = state.logsFiltrados.length;
  const porPag = state.logsPorPagina || 15;
  const totalPags = Math.ceil(total / porPag) || 1;
  const actual = state.logsPaginaActual || 1;

  const desde = total === 0 ? 0 : (actual - 1) * porPag + 1;
  const hasta = Math.min(actual * porPag, total);

  if (elInfo) {
    elInfo.innerText = `Mostrando ${desde}–${hasta} de ${total} registros`;
  }

  if (pageSizeSelect) {
    pageSizeSelect.value = String(porPag);
  }

  if (pageIndicator) {
    pageIndicator.innerText = `Página ${actual} de ${totalPags}`;
  }

  if (btnPrev) {
    btnPrev.disabled = actual <= 1;
  }

  if (btnNext) {
    btnNext.disabled = actual >= totalPags;
  }
}

function cambiarPaginaLogs(delta) {
  const totalPags = Math.ceil(state.logsFiltrados.length / state.logsPorPagina) || 1;
  const nueva = state.logsPaginaActual + delta;
  if (nueva < 1 || nueva > totalPags) return;
  state.logsPaginaActual = nueva;
  renderizarTablaLogs();
  renderizarPaginacionLogs();
}

function cambiarRegistrosPorPaginaLogs(tamano) {
  const n = parseInt(tamano, 10);
  if (isNaN(n) || n <= 0) return;
  state.logsPorPagina = n;
  state.logsPaginaActual = 1;
  renderizarTablaLogs();
  renderizarPaginacionLogs();
}

function exportarLogsCSV() {
  if (!state.logsFiltrados || state.logsFiltrados.length === 0) {
    Toast.warning('No hay registros de auditoría para exportar.');
    return;
  }

  const esOperaciones = state.logsTabActivo === 'operaciones';
  let headers = esOperaciones
    ? ['Fecha y Hora', 'ID Expediente', 'Cliente', 'Email', 'Accion', 'Detalle']
    : ['Fecha y Hora', 'Usuario', 'Email', 'Evento', 'IP Origen', 'Detalles', 'User Agent'];

  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers.join(';') + '\n';

  state.logsFiltrados.forEach(row => {
    let line = [];
    if (esOperaciones) {
      line = [
        `"${(row.fecha || '').replace(/"/g, '""')}"`,
        `"${(row.identificador || '').replace(/"/g, '""')}"`,
        `"${(row.cliente || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${(row.accion || '').replace(/"/g, '""')}"`,
        `"${(row.detalle || '').replace(/"/g, '""')}"`
      ];
    } else {
      line = [
        `"${(row.creado_en || '').replace(/"/g, '""')}"`,
        `"${(row.nombre || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${(row.evento || '').replace(/"/g, '""')}"`,
        `"${(row.ip_origen || '').replace(/"/g, '""')}"`,
        `"${(row.detalles || '').replace(/"/g, '""')}"`,
        `"${(row.user_agent || '').replace(/"/g, '""')}"`
      ];
    }
    csvContent += line.join(';') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().substring(0, 10);
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `auditoria_logs_${state.logsTabActivo}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Toast.success(`Bitácora de ${state.logsTabActivo} exportada en CSV exitosamente.`);
}
