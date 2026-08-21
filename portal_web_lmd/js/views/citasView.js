// =============================================================================
// VISTA 3: GESTIÓN DE COLA DE CITAS LMD (citasView.js)
// Radar de citas, urgencias, credenciales y paginación
// =============================================================================

function actualizarOpcionesConsuladosCitas() {
  const elCons = document.getElementById('filter-citas-consulado');
  if (!elCons) return;

  const elAlcance = document.getElementById('filter-citas-alcance');
  const alcance = elAlcance ? elAlcance.value : (state.filtroCitasAlcance || 'ROBOT_LISTOS');

  // Determinar base según el alcance
  let base = [];
  if (alcance === 'ROBOT_LISTOS') {
    base = state.expedientes.filter(c => {
      const est = String(c.estado || '').toUpperCase();
      const det = String(c.detalle || '').toUpperCase();
      const estCita = String(c.estadoCita || '').toUpperCase();
      const tieneCita = det.includes('CITA PROGRAMADA') || estCita.includes('PROGRAMADA');
      const tieneCreds = Boolean(c.usuarioConsular && c.usuarioConsular.trim().length > 0);
      return est === 'PENDIENTE DE CITA' && !tieneCita && tieneCreds;
    });
  } else {
    base = state.expedientes.filter(c => {
      const est = String(c.estado || '').toUpperCase();
      const det = String(c.detalle || '').toUpperCase();
      const tieneCita = det.includes('CITA PROGRAMADA');
      return (est.includes('CITA') || est.includes('CREDENCIAL')) && !tieneCita;
    });
  }

  // Contar expedientes por consulado (excluyendo sedes de España ya que citas aplican al exterior)
  const mapaConsulados = {};
  base.forEach(c => {
    const cons = String(c.consulado || 'CUBA LA HABANA').trim().toUpperCase();
    if (!cons.includes('ESPAÑA') && !cons.startsWith('ESP ')) {
      mapaConsulados[cons] = (mapaConsulados[cons] || 0) + 1;
    }
  });

  const consuladosOrdenados = Object.keys(mapaConsulados).sort();
  const valorActual = elCons.value;

  let html = `<option value="TODOS">🏛️ Todos los Consulados (${base.length})</option>`;
  consuladosOrdenados.forEach(cons => {
    const conteo = mapaConsulados[cons];
    html += `<option value="${escapeHTML(cons)}">${escapeHTML(cons)} (${conteo})</option>`;
  });

  elCons.innerHTML = html;

  if (consuladosOrdenados.includes(valorActual)) {
    elCons.value = valorActual;
  } else {
    elCons.value = 'TODOS';
    state.filtroCitasConsulado = 'TODOS';
  }
}

function cambiarAlcanceCitas(alcance) {
  state.filtroCitasAlcance = alcance;
  state.citasPaginaActual = 1;
  actualizarOpcionesConsuladosCitas();
  aplicarFiltrosCitas();
}

function aplicarFiltrosCitas() {
  const elAlcance = document.getElementById('filter-citas-alcance');
  const elCons = document.getElementById('filter-citas-consulado');
  const elUrg = document.getElementById('filter-citas-urgencia');
  const elCred = document.getElementById('filter-citas-credenciales');

  state.filtroCitasAlcance = elAlcance ? elAlcance.value : 'ROBOT_LISTOS';
  state.filtroCitasConsulado = elCons ? elCons.value : 'TODOS';
  state.filtroCitasUrgencia = elUrg ? elUrg.value : 'TODAS';
  state.filtroCitasCredenciales = elCred ? elCred.value : 'TODAS';

  const termino = (state.terminoBusqueda || '').toLowerCase();
  
  // Base de citas según el alcance seleccionado
  let baseCitas = [];
  if (state.filtroCitasAlcance === 'ROBOT_LISTOS') {
    baseCitas = state.expedientes.filter(c => {
      const est = String(c.estado || '').toUpperCase();
      const det = String(c.detalle || '').toUpperCase();
      const estCita = String(c.estadoCita || '').toUpperCase();
      const tieneCita = det.includes('CITA PROGRAMADA') || estCita.includes('PROGRAMADA');
      const tieneCreds = Boolean(c.usuarioConsular && c.usuarioConsular.trim().length > 0);
      return est === 'PENDIENTE DE CITA' && !tieneCita && tieneCreds;
    });
  } else {
    baseCitas = state.expedientes.filter(c => {
      const est = String(c.estado || '').toUpperCase();
      const det = String(c.detalle || '').toUpperCase();
      const tieneCita = det.includes('CITA PROGRAMADA');
      return (est.includes('CITA') || est.includes('CREDENCIAL')) && !tieneCita;
    });
  }

  state.citasFiltradas = baseCitas.filter(c => {
    const id = String(c.identificador || '').toLowerCase();
    const nombre = String(c.nombreCompleto || '').toLowerCase();
    const cons = String(c.consulado || '').toLowerCase();
    const pref = String(c.preferencia || '').toLowerCase();
    const user = String(c.usuarioConsular || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();
    const correoCreado = String(c.correoCreado || '').toLowerCase();

    const coincideTexto = !termino || 
      id.includes(termino) || 
      nombre.includes(termino) || 
      cons.includes(termino) || 
      pref.includes(termino) || 
      user.includes(termino) ||
      email.includes(termino) ||
      correoCreado.includes(termino);

    let coincideConsulado = true;
    if (state.filtroCitasConsulado !== 'TODOS') {
      coincideConsulado = String(c.consulado || '').toUpperCase().includes(state.filtroCitasConsulado);
    }

    let coincideUrgencia = true;
    if (state.filtroCitasUrgencia !== 'TODAS') {
      coincideUrgencia = String(c.urgencia || '').toUpperCase().includes(state.filtroCitasUrgencia);
    }

    let coincideCredenciales = true;
    if (state.filtroCitasCredenciales === 'CON_CREDENCIALES') {
      coincideCredenciales = Boolean(c.usuarioConsular && c.usuarioConsular.trim().length > 0);
    } else if (state.filtroCitasCredenciales === 'SIN_CREDENCIALES') {
      coincideCredenciales = !c.usuarioConsular || c.usuarioConsular.trim().length === 0;
    }

    return coincideTexto && coincideConsulado && coincideUrgencia && coincideCredenciales;
  });

  const totalPaginas = Math.ceil(state.citasFiltradas.length / state.citasRegistrosPorPagina) || 1;
  if (state.citasPaginaActual > totalPaginas) state.citasPaginaActual = 1;

  const badgeCitas = document.getElementById('citas-total-badge');
  if (badgeCitas) badgeCitas.innerText = `⚡ ${state.citasFiltradas.length} Candidatos`;

  renderizarTablaCitas();
}

function renderizarTablaCitas() {
  const tbody = document.getElementById('table-citas-body');
  if (!tbody) return;

  const lista = state.citasFiltradas || [];

  if (lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 36px; color: var(--text-muted);">
          🔍 No se encontraron candidatos de citas con los filtros seleccionados.
        </td>
      </tr>
    `;
    renderizarPaginacionCitas(0);
    return;
  }

  const inicio = (state.citasPaginaActual - 1) * state.citasRegistrosPorPagina;
  const fin = inicio + state.citasRegistrosPorPagina;
  const paginaItems = lista.slice(inicio, fin);

  tbody.innerHTML = paginaItems.map(c => {
    let badgeUrg = 'badge-urgencia-media';
    const urg = String(c.urgencia || '');
    if (urg.includes('1.') || urg.includes('ALTA')) badgeUrg = 'badge-urgencia-alta';
    else if (urg.includes('3.') || urg.includes('BAJA')) badgeUrg = 'badge-urgencia-baja';

    return `
      <tr class="clickable-row" onclick="abrirModalRadarCitas('${c.identificador}')" title="Clic para gestionar citas y credenciales de ${c.nombreCompleto}">
        <td style="font-weight: 700; color: var(--accent-gold);">${c.identificador}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${c.nombreCompleto}</div>
          <div style="font-size: 0.76rem; color: var(--text-dim);">${c.email || 'Sin correo'}</div>
        </td>
        <td>
          <span class="badge badge-consulado">${c.consulado || 'CUBA LA HABANA'}</span>
        </td>
        <td>
          <span class="badge ${badgeUrg}">${c.urgencia || '2. MEDIA / NORMAL'}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;">
            <div style="font-size: 0.82rem; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">
              🗓️ ${c.preferencia || 'CUALQUIER FECHA'}
            </div>
            <span style="font-family: monospace; font-size: 0.78rem; color: var(--text-muted); flex-shrink: 0;">${c.usuarioConsular ? '🔑 ' + c.usuarioConsular : '⚠️ Sin credenciales'}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderizarPaginacionCitas(lista.length);
}

function renderizarPaginacionCitas(total) {
  const totalPaginas = Math.ceil(total / state.citasRegistrosPorPagina) || 1;
  const inicio = total === 0 ? 0 : (state.citasPaginaActual - 1) * state.citasRegistrosPorPagina + 1;
  const fin = Math.min(state.citasPaginaActual * state.citasRegistrosPorPagina, total);

  const elInfo = document.getElementById('citas-pagination-info');
  const elIndicador = document.getElementById('citas-page-indicator');
  const btnPrev = document.getElementById('btn-citas-prev-page');
  const btnNext = document.getElementById('btn-citas-next-page');

  if (elInfo) elInfo.innerText = `Mostrando ${inicio}–${fin} de ${total} candidatos`;
  if (elIndicador) elIndicador.innerText = `Página ${state.citasPaginaActual} de ${totalPaginas}`;

  if (btnPrev) btnPrev.disabled = state.citasPaginaActual <= 1;
  if (btnNext) btnNext.disabled = state.citasPaginaActual >= totalPaginas;
}

function cambiarPaginaCitas(delta) {
  const totalPaginas = Math.ceil(state.citasFiltradas.length / state.citasRegistrosPorPagina) || 1;
  const nuevaPagina = state.citasPaginaActual + delta;

  if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
    state.citasPaginaActual = nuevaPagina;
    renderizarTablaCitas();
  }
}

function cambiarRegistrosPorPaginaCitas(cantidad) {
  state.citasRegistrosPorPagina = parseInt(cantidad, 10);
  state.citasPaginaActual = 1;
  renderizarTablaCitas();
}
