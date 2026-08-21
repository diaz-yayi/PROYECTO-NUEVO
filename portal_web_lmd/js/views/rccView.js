// =============================================================================
// VISTA: SEGUIMIENTO RCC ESPAÑA (rccView.js)
// Trazabilidad de Verificaciones Playwright / Registro Civil Central (Ministerio de Justicia)
// =============================================================================

async function cargarRCCEnVista(forzar = false) {
  const tbody = document.getElementById('table-rcc-body');

  // Si ya tenemos datos en memoria y no es forzado, renderizar de inmediato (0 ms)
  if (state.verificacionesRCC && state.verificacionesRCC.length > 0 && !forzar) {
    actualizarOpcionesEstadosRCC();
    aplicarFiltrosRCC();
    return;
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">
          <div class="spinner spinner-gold" style="margin: 0 auto 12px;"></div>
          <div>Consultando verificaciones del Registro Civil Central de España...</div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await API.getVerificacionesRCC();
    if (res && res.verificaciones && res.verificaciones.length > 0) {
      state.verificacionesRCC = res.verificaciones;
    }

    actualizarOpcionesEstadosRCC();
    aplicarFiltrosRCC();
  } catch (error) {
    console.error('Error al cargar verificaciones de RCC:', error);
    Toast.error('No se pudieron obtener los datos del RCC: ' + error.message);
    if (tbody && (!state.verificacionesRCC || state.verificacionesRCC.length === 0)) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--accent-red);">
            ⚠️ Error al conectar con el servidor de RCC. Por favor, reintenta.
          </td>
        </tr>
      `;
    }
  }
}

function normalizarEstadoRCC(estadoRaw) {
  const est = String(estadoRaw || '').toUpperCase().trim();
  if (est.includes('CONCLUIDO') || est.includes('CONCLUÍD')) {
    return { texto: 'CONCLUIDO', clase: 'badge-estado-favorable' };
  }
  if (est.includes('NO ENCONTRADO')) {
    return { texto: 'NO ENCONTRADO', clase: 'badge-estado-denegado' };
  }
  return { texto: 'EN TRÁMITE', clase: 'badge-estado-resolucion' };
}

function actualizarOpcionesEstadosRCC() {
  const selectEstado = document.getElementById('filter-rcc-estado');
  if (!selectEstado) return;

  const fuente = state.verificacionesRCC || [];
  const estadosUnicos = new Set();

  fuente.forEach(item => {
    const norm = normalizarEstadoRCC(item.estadoRCC).texto;
    estadosUnicos.add(norm);
  });

  const valorPrevio = selectEstado.value;
  selectEstado.innerHTML = '<option value="TODOS">⚡ Todos los Estados RCC</option>';

  const ordenEstados = ['EN TRÁMITE', 'CONCLUIDO', 'NO ENCONTRADO'];
  ordenEstados.forEach(est => {
    if (estadosUnicos.has(est)) {
      const opt = document.createElement('option');
      opt.value = est;
      opt.innerText = est;
      selectEstado.appendChild(opt);
    }
  });

  if (Array.from(estadosUnicos).includes(valorPrevio)) {
    selectEstado.value = valorPrevio;
  } else {
    selectEstado.value = 'TODOS';
  }
}

function aplicarFiltrosRCC() {
  const inSearch = document.getElementById('filter-rcc-search');
  const selEstado = document.getElementById('filter-rcc-estado');

  state.terminoBusquedaRcc = (inSearch ? inSearch.value : '').trim().toLowerCase();
  state.filtroRccEstado = selEstado ? selEstado.value : 'TODOS';

  const fuente = state.verificacionesRCC || [];
  const termino = state.terminoBusquedaRcc;

  state.rccFiltrados = fuente.filter(item => {
    let coincideTexto = true;
    if (termino) {
      const valores = Object.values(item).map(v => String(v || '').toLowerCase()).join(' ');
      const norm = normalizarEstadoRCC(item.estadoRCC).texto.toLowerCase();
      coincideTexto = valores.includes(termino) || norm.includes(termino);
    }

    let coincideEstado = true;
    if (state.filtroRccEstado !== 'TODOS') {
      const norm = normalizarEstadoRCC(item.estadoRCC).texto;
      coincideEstado = (norm.toUpperCase() === state.filtroRccEstado.toUpperCase());
    }

    return coincideTexto && coincideEstado;
  });

  const totalPaginas = Math.ceil(state.rccFiltrados.length / state.rccPorPagina) || 1;
  if (state.rccPaginaActual > totalPaginas) state.rccPaginaActual = 1;

  const badgeTotal = document.getElementById('rcc-total-badge');
  if (badgeTotal) badgeTotal.innerText = `🇪🇸 ${state.rccFiltrados.length} Verificados`;

  renderizarTablaRCC();
  renderizarPaginacionRCC();
}

function renderizarTablaRCC() {
  const tbody = document.getElementById('table-rcc-body');
  if (!tbody) return;

  if (state.rccFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">
          No se encontraron verificaciones del RCC que coincidan con los filtros.
        </td>
      </tr>
    `;
    return;
  }

  const inicio = (state.rccPaginaActual - 1) * state.rccPorPagina;
  const fin = inicio + state.rccPorPagina;
  const paginaItems = state.rccFiltrados.slice(inicio, fin);

  tbody.innerHTML = paginaItems.map(item => {
    const estadoNorm = normalizarEstadoRCC(item.estadoRCC);
    const badgeClase = estadoNorm.clase;
    const badgeTexto = estadoNorm.texto;

    return `
      <tr class="clickable-row" onclick="abrirModalExpediente('${escapeHTML(item.identificador)}')" title="Clic para abrir la ficha general de ${escapeHTML(item.nombreCompleto)}">
        <td style="font-weight: 700; color: var(--accent-cyan); font-family: monospace; width: 65px;">${escapeHTML(item.identificador)}</td>
        <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis;">
          <div style="font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(item.nombreCompleto)}</div>
          <div style="font-size: 0.76rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Sistema: ${escapeHTML(item.nombreSistema || '—')}</div>
        </td>
        <td style="white-space: nowrap; width: 140px;">
          <strong style="color: var(--accent-gold); font-family: monospace; font-size: 0.84rem;">${escapeHTML(item.numeroExpediente || '—')}</strong>
          <span style="font-size: 0.76rem; color: var(--text-dim);">/${escapeHTML(item.anioExpediente || '—')}</span>
        </td>
        <td style="width: 130px; text-align: center;">
          <span class="badge ${badgeClase}" style="font-size: 0.72rem; letter-spacing: 0.03em;" title="${escapeHTML(item.estadoRCC || '')}">
            ${escapeHTML(badgeTexto)}
          </span>
        </td>
        <td style="font-size: 0.80rem; color: var(--text-muted); line-height: 1.3;" title="${escapeHTML(item.detalleOficial || '')}">
          ${escapeHTML(item.detalleOficial || '—')}
        </td>
        <td style="font-size: 0.78rem; text-align: center; width: 85px;">
          <span class="badge ${item.resultado === 'OK' ? 'badge-estado-favorable' : 'badge-estado-desestimado'}" style="font-size: 0.70rem;">
            ${escapeHTML(item.resultado || 'OK')}
          </span>
        </td>
        <td style="font-size: 0.76rem; color: var(--text-muted); white-space: nowrap; width: 135px; text-align: right;">
          ${escapeHTML(item.ultimaVerificacion || '—')}
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarPaginacionRCC() {
  const elInfo = document.getElementById('rcc-pagination-info');
  const btnPrev = document.getElementById('btn-prev-page-rcc');
  const btnNext = document.getElementById('btn-next-page-rcc');
  const pageIndicator = document.getElementById('page-indicator-rcc');
  const pageSizeSelect = document.getElementById('rcc-page-size-select');

  const total = state.rccFiltrados.length;
  const porPag = state.rccPorPagina || 15;
  const totalPags = Math.ceil(total / porPag) || 1;
  const actual = state.rccPaginaActual || 1;

  const desde = total === 0 ? 0 : (actual - 1) * porPag + 1;
  const hasta = Math.min(actual * porPag, total);

  if (elInfo) elInfo.innerText = `Mostrando ${desde}–${hasta} de ${total} registros`;
  if (pageSizeSelect) pageSizeSelect.value = String(porPag);
  if (pageIndicator) pageIndicator.innerText = `Página ${actual} de ${totalPags}`;
  if (btnPrev) btnPrev.disabled = actual <= 1;
  if (btnNext) btnNext.disabled = actual >= totalPags;
}

function cambiarPaginaRCC(delta) {
  const totalPags = Math.ceil(state.rccFiltrados.length / state.rccPorPagina) || 1;
  const nueva = state.rccPaginaActual + delta;
  if (nueva < 1 || nueva > totalPags) return;
  state.rccPaginaActual = nueva;
  renderizarTablaRCC();
  renderizarPaginacionRCC();
}

function cambiarRegistrosPorPaginaRCC(tamano) {
  const n = parseInt(tamano, 10);
  if (isNaN(n) || n <= 0) return;
  state.rccPorPagina = n;
  state.rccPaginaActual = 1;
  renderizarTablaRCC();
  renderizarPaginacionRCC();
}

function exportarRccCSV() {
  if (!state.rccFiltrados || state.rccFiltrados.length === 0) {
    Toast.warning('No hay registros del RCC para exportar.');
    return;
  }

  const headers = ['Identificador', 'Cliente', 'Numero Expediente', 'Anio', 'Estado RCC', 'Nombre en Sistema', 'Detalle Oficial', 'Resultado', 'Ultima Verificacion'];
  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers.join(';') + '\n';

  state.rccFiltrados.forEach(row => {
    const line = [
      `"${(row.identificador || '').replace(/"/g, '""')}"`,
      `"${(row.nombreCompleto || '').replace(/"/g, '""')}"`,
      `"${(row.numeroExpediente || '').replace(/"/g, '""')}"`,
      `"${(row.anioExpediente || '').replace(/"/g, '""')}"`,
      `"${(row.estadoRCC || '').replace(/"/g, '""')}"`,
      `"${(row.nombreSistema || '').replace(/"/g, '""')}"`,
      `"${(row.detalleOficial || '').replace(/"/g, '""')}"`,
      `"${(row.resultado || '').replace(/"/g, '""')}"`,
      `"${(row.ultimaVerificacion || '').replace(/"/g, '""')}"`
    ];
    csvContent += line.join(';') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().substring(0, 10);
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `verificacion_rcc_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Toast.success('Bitácora de RCC exportada en CSV exitosamente.');
}
