// =============================================================================
// VISTA: SEGUIMIENTO LA HABANA (habanaView.js)
// Trazabilidad de Verificaciones API Consulado de España en La Habana (cgelahabana.es)
// =============================================================================

async function cargarHabanaEnVista(forzar = false) {
  const tbody = document.getElementById('table-habana-body');

  // Si ya tenemos datos en memoria y no es forzado, renderizar de inmediato (0 ms)
  if (state.verificacionesHabana && state.verificacionesHabana.length > 0 && !forzar) {
    actualizarOpcionesEstadosHabana();
    aplicarFiltrosHabana();
    return;
  }

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          <div>Consultando verificaciones consulares de La Habana...</div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await API.getVerificacionesHabana();
    if (res && res.verificaciones && res.verificaciones.length > 0) {
      state.verificacionesHabana = res.verificaciones;
    }

    actualizarOpcionesEstadosHabana();
    aplicarFiltrosHabana();
  } catch (error) {
    console.error('Error al cargar verificaciones de La Habana:', error);
    Toast.error('No se pudieron obtener los datos consulares de La Habana: ' + error.message);
    if (tbody && (!state.verificacionesHabana || state.verificacionesHabana.length === 0)) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--accent-red);">
            ⚠️ Error al conectar con el servidor consular. Por favor, reintenta.
          </td>
        </tr>
      `;
    }
  }
}

function actualizarOpcionesEstadosHabana() {
  const selectEstado = document.getElementById('filter-habana-estado');
  if (!selectEstado) return;

  const fuente = state.verificacionesHabana || [];
  const estadosUnicos = new Set();

  fuente.forEach(item => {
    const est = String(item.estadoConsulado || '').trim();
    if (est) estadosUnicos.add(est);
  });

  const valorPrevio = selectEstado.value;
  selectEstado.innerHTML = '<option value="TODOS">⚡ Todos los Estados Consulares</option>';

  Array.from(estadosUnicos).sort().forEach(est => {
    const opt = document.createElement('option');
    opt.value = est;
    opt.innerText = est;
    selectEstado.appendChild(opt);
  });

  if (Array.from(estadosUnicos).includes(valorPrevio)) {
    selectEstado.value = valorPrevio;
  } else {
    selectEstado.value = 'TODOS';
  }
}

function aplicarFiltrosHabana() {
  const inSearch = document.getElementById('filter-habana-search');
  const selEstado = document.getElementById('filter-habana-estado');

  state.terminoBusquedaHabana = (inSearch ? inSearch.value : '').trim().toLowerCase();
  state.filtroHabanaEstado = selEstado ? selEstado.value : 'TODOS';

  const fuente = state.verificacionesHabana || [];
  const termino = state.terminoBusquedaHabana;

  state.habanaFiltrados = fuente.filter(item => {
    let coincideTexto = true;
    if (termino) {
      const valores = Object.values(item).map(v => String(v || '').toLowerCase()).join(' ');
      coincideTexto = valores.includes(termino);
    }

    let coincideEstado = true;
    if (state.filtroHabanaEstado !== 'TODOS') {
      const est = String(item.estadoConsulado || '');
      coincideEstado = (est.toUpperCase() === state.filtroHabanaEstado.toUpperCase());
    }

    return coincideTexto && coincideEstado;
  });

  const totalPaginas = Math.ceil(state.habanaFiltrados.length / state.habanaPorPagina) || 1;
  if (state.habanaPaginaActual > totalPaginas) state.habanaPaginaActual = 1;

  const badgeTotal = document.getElementById('habana-total-badge');
  if (badgeTotal) badgeTotal.innerText = `🇨🇺 ${state.habanaFiltrados.length} Verificaciones`;

  renderizarTablaHabana();
  renderizarPaginacionHabana();
}

function renderizarTablaHabana() {
  const tbody = document.getElementById('table-habana-body');
  if (!tbody) return;

  if (state.habanaFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">
          No se encontraron verificaciones consulares que coincidan con los filtros.
        </td>
      </tr>
    `;
    return;
  }

  const inicio = (state.habanaPaginaActual - 1) * state.habanaPorPagina;
  const fin = inicio + state.habanaPorPagina;
  const paginaItems = state.habanaFiltrados.slice(inicio, fin);

  tbody.innerHTML = paginaItems.map(item => {
    const est = String(item.estadoConsulado || '').toUpperCase();
    let badgeClase = 'badge-estado-resolucion';

    if (est.includes('FAVORABLE') || est.includes('INSCRITO') || est.includes('CONCEDIDO')) {
      badgeClase = 'badge-estado-favorable';
    } else if (est.includes('DENEGADO') || est.includes('DESESTIMADO')) {
      badgeClase = 'badge-estado-desestimado';
    } else if (est.includes('REQUERIDO') || est.includes('SUBSANACION') || est.includes('PENDIENTE')) {
      badgeClase = 'badge-estado-credenciales';
    }

    return `
      <tr class="clickable-row" onclick="abrirModalExpediente('${escapeHTML(item.identificador)}')" title="Clic para abrir la ficha general de ${escapeHTML(item.nombreCompleto)}">
        <td style="font-weight: 700; color: var(--accent-cyan); font-family: monospace;">${escapeHTML(item.identificador)}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHTML(item.nombreCompleto)}</div>
          <div style="font-size: 0.76rem; color: var(--text-dim);">Prog: ${escapeHTML(item.progenitor || '—')}</div>
        </td>
        <td>
          <strong style="color: var(--accent-gold); font-family: monospace; font-size: 0.84rem;">${escapeHTML(item.numeroExpediente || '—')}</strong>
        </td>
        <td>
          <span class="badge ${badgeClase}" style="font-size: 0.72rem;">${escapeHTML(item.estadoConsulado)}</span>
        </td>
        <td style="font-size: 0.78rem; color: var(--text-main);">
          <div>Res: ${escapeHTML(item.fechaResolucion || '—')}</div>
          <div style="color: var(--text-dim); font-size: 0.74rem;">Insc: ${escapeHTML(item.fechaInscripcion || '—')}</div>
        </td>
        <td style="font-size: 0.78rem; font-family: monospace; color: var(--accent-cyan);">
          ${escapeHTML(item.datosRegistrales || '—')}
        </td>
        <td style="font-size: 0.76rem; color: var(--text-muted); white-space: nowrap;">
          ${escapeHTML(item.ultimaVerificacion || '—')}
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarPaginacionHabana() {
  const elInfo = document.getElementById('habana-pagination-info');
  const btnPrev = document.getElementById('btn-prev-page-habana');
  const btnNext = document.getElementById('btn-next-page-habana');
  const pageIndicator = document.getElementById('page-indicator-habana');
  const pageSizeSelect = document.getElementById('habana-page-size-select');

  const total = state.habanaFiltrados.length;
  const porPag = state.habanaPorPagina || 15;
  const totalPags = Math.ceil(total / porPag) || 1;
  const actual = state.habanaPaginaActual || 1;

  const desde = total === 0 ? 0 : (actual - 1) * porPag + 1;
  const hasta = Math.min(actual * porPag, total);

  if (elInfo) elInfo.innerText = `Mostrando ${desde}–${hasta} de ${total} registros`;
  if (pageSizeSelect) pageSizeSelect.value = String(porPag);
  if (pageIndicator) pageIndicator.innerText = `Página ${actual} de ${totalPags}`;
  if (btnPrev) btnPrev.disabled = actual <= 1;
  if (btnNext) btnNext.disabled = actual >= totalPags;
}

function cambiarPaginaHabana(delta) {
  const totalPags = Math.ceil(state.habanaFiltrados.length / state.habanaPorPagina) || 1;
  const nueva = state.habanaPaginaActual + delta;
  if (nueva < 1 || nueva > totalPags) return;
  state.habanaPaginaActual = nueva;
  renderizarTablaHabana();
  renderizarPaginacionHabana();
}

function cambiarRegistrosPorPaginaHabana(tamano) {
  const n = parseInt(tamano, 10);
  if (isNaN(n) || n <= 0) return;
  state.habanaPorPagina = n;
  state.habanaPaginaActual = 1;
  renderizarTablaHabana();
  renderizarPaginacionHabana();
}

function exportarHabanaCSV() {
  if (!state.habanaFiltrados || state.habanaFiltrados.length === 0) {
    Toast.warning('No hay registros consulares de La Habana para exportar.');
    return;
  }

  const headers = ['Identificador', 'Cliente', 'Numero Expediente', 'Estado Consulado', 'Progenitor', 'Fecha Resolucion', 'Fecha Inscripcion', 'Datos Registrales', 'Resultado', 'Ultima Verificacion'];
  let csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers.join(';') + '\n';

  state.habanaFiltrados.forEach(row => {
    const line = [
      `"${(row.identificador || '').replace(/"/g, '""')}"`,
      `"${(row.nombreCompleto || '').replace(/"/g, '""')}"`,
      `"${(row.numeroExpediente || '').replace(/"/g, '""')}"`,
      `"${(row.estadoConsulado || '').replace(/"/g, '""')}"`,
      `"${(row.progenitor || '').replace(/"/g, '""')}"`,
      `"${(row.fechaResolucion || '').replace(/"/g, '""')}"`,
      `"${(row.fechaInscripcion || '').replace(/"/g, '""')}"`,
      `"${(row.datosRegistrales || '').replace(/"/g, '""')}"`,
      `"${(row.resultado || '').replace(/"/g, '""')}"`,
      `"${(row.ultimaVerificacion || '').replace(/"/g, '""')}"`
    ];
    csvContent += line.join(';') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().substring(0, 10);
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `verificacion_habana_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Toast.success('Bitácora de La Habana exportada en CSV exitosamente.');
}
