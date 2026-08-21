// =============================================================================
// VISTA 1: DASHBOARD EJECUTIVO Y KPIS (dashboardView.js)
// Métricas en tiempo real, Ranking de Consulados y Gráficos Chart.js
// =============================================================================

function extraerAnioExpediente(c) {
  if (!c) return '2024';
  const noExp = String(c.noExpediente || '').trim();
  const matchExp = noExp.match(/(202[2-6])/);
  if (matchExp) return matchExp[1];

  const detalle = String(c.detalle || '') + ' ' + String(c.observaciones || '');
  const matchDet = detalle.match(/(202[2-6])/);
  if (matchDet) return matchDet[1];

  const fNotif = String(c.fechaUltimaNotificacion || '');
  const matchNotif = fNotif.match(/(202[2-6])/);
  if (matchNotif) return matchNotif[1];

  return '2024';
}

function actualizarKPIsDashboard(kpis) {
  const elTotal = document.getElementById('kpi-total');
  const elResolucion = document.getElementById('kpi-resolucion');
  const elCitas = document.getElementById('kpi-citas');
  const elFavorables = document.getElementById('kpi-favorables');
  const elTermHabana = document.getElementById('term-habana-val');
  const elTermMiami = document.getElementById('term-miami-val');

  if (elTotal) elTotal.innerText = kpis.totalExpedientes || state.expedientes.length;
  if (elResolucion) elResolucion.innerText = kpis.pendientesResolucion || 0;
  if (elCitas) elCitas.innerText = (kpis.pendientesCita || 0) + (kpis.pendientesCredenciales || 0);
  if (elFavorables) elFavorables.innerText = kpis.resueltosFavorables || 0;

  if (elTermHabana) elTermHabana.innerText = kpis.termometroHabana || 'Sin registro';
  if (elTermMiami) elTermMiami.innerText = kpis.termometroMiami || 'Sin registro';

  // ─────────────────────────────────────────────
  // CÁLCULO DINÁMICO DE TASAS DE EFECTIVIDAD (DUAL)
  // ─────────────────────────────────────────────
  const expedientes = state.expedientes || [];
  let favDirectos = 0;
  let denDirectos = 0;
  let recFavorables = 0;
  let recDenegados = 0;
  let recTramite = 0;

  for (const c of expedientes) {
    const est = String(c.estado || '').trim().toUpperCase();
    if (est === 'RESUELTO FAVORABLE' || (est.includes('FAVORABLE') && !est.includes('RECURSO'))) {
      favDirectos++;
    } else if (est === 'RESUELTO DENEGADO' || (est.includes('DENEGADO') && !est.includes('RECURSO'))) {
      denDirectos++;
    } else if (est === 'RECURSO FAVORABLE') {
      recFavorables++;
    } else if (est === 'RECURSO DENEGADO') {
      recDenegados++;
    } else if (est === 'RECURSO PRESENTADO' || est.includes('RECURSO')) {
      recTramite++;
    }
  }

  if (expedientes.length === 0) {
    favDirectos = kpis.resueltosFavorables || 0;
    denDirectos = kpis.resueltosDenegados || 0;
    recTramite = kpis.recursosPresentados || 0;
  }

  // 1. Tasa 1ª Instancia (Directa)
  const totalDirectos = favDirectos + denDirectos;
  const pctDirecta = totalDirectos > 0 ? ((favDirectos / totalDirectos) * 100).toFixed(1) : (favDirectos > 0 ? '100.0' : '100.0');
  const elTasaDirectaVal = document.getElementById('tasa-directa-val');
  const elTasaDirectaSub = document.getElementById('tasa-directa-sub');
  if (elTasaDirectaVal) elTasaDirectaVal.innerText = `${pctDirecta}%`;
  if (elTasaDirectaSub) elTasaDirectaSub.innerText = `${favDirectos} Aprobados · ${denDirectos} Denegados`;

  // 2. Tasa Vía Recursos (Alzada)
  const totalRecursosConcluidos = recFavorables + recDenegados;
  let pctRecursos = '100.0';
  if (totalRecursosConcluidos > 0) {
    pctRecursos = ((recFavorables / totalRecursosConcluidos) * 100).toFixed(1) + '%';
  } else if (recFavorables === 0 && recDenegados === 0 && recTramite > 0) {
    pctRecursos = 'En Trámite';
  } else if (recFavorables > 0) {
    pctRecursos = '100.0%';
  } else {
    pctRecursos = '100.0%';
  }
  const elTasaRecursosVal = document.getElementById('tasa-recursos-val');
  const elTasaRecursosSub = document.getElementById('tasa-recursos-sub');
  if (elTasaRecursosVal) elTasaRecursosVal.innerText = pctRecursos;
  if (elTasaRecursosSub) elTasaRecursosSub.innerText = `${recFavorables} Favorables · ${recDenegados} Denegados · ${recTramite} En Curso`;

  renderizarRankingConsulados(kpis.consuladosRanking || {});
}

function renderizarRankingConsulados(rankingObj) {
  const tbody = document.getElementById('rank-consulados-body');
  if (!tbody) return;

  const total = state.expedientes.length || 1;
  const listaOrdenada = Object.entries(rankingObj).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const colores = ['#22D3EE', '#F59E0B', '#A855F7', '#10B981', '#3B82F6'];

  tbody.innerHTML = listaOrdenada.map(([consulado, conteo], idx) => {
    const pct = Math.round((conteo / total) * 100);
    const color = colores[idx % colores.length];

    return `
      <tr>
        <td style="font-weight: 600;">${escapeHTML(consulado)}</td>
        <td style="text-align: right; font-weight: 700; color: var(--text-main);">${conteo}</td>
        <td style="width: 35%;">
          <div class="rank-progress-bar">
            <div style="width: ${pct}%; background: ${color}; height: 100%; border-radius: var(--radius-full);"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarGraficos() {
  if (typeof Chart === 'undefined') return;

  const kpis = state.dashboardKPIs || {};

  // 1. Gráfico Funnel: Embudo de Expedientes (Doughnut / Embudo)
  const ctxFunnel = document.getElementById('chart-funnel-lmd') || document.getElementById('chart-funnel-fases');
  if (ctxFunnel) {
    if (state.chartFunnel) {
      state.chartFunnel.destroy();
      state.chartFunnel = null;
    }

    const valResolucion = kpis.pendientesResolucion || 0;
    const valCitas = (kpis.pendientesCita || 0) + (kpis.pendientesCredenciales || 0);
    const valFavorables = kpis.resueltosFavorables || 0;
    const total = state.expedientes.length || (valResolucion + valCitas + valFavorables);
    const valOtros = Math.max(0, total - (valResolucion + valCitas + valFavorables));

    state.chartFunnel = new Chart(ctxFunnel, {
      type: 'doughnut',
      data: {
        labels: [
          `Pendientes Resolución (${valResolucion})`,
          `Citas / Credenciales (${valCitas})`,
          `Resueltos Favorables (${valFavorables})`,
          `Otros Estados (${valOtros})`
        ],
        datasets: [{
          data: [valResolucion, valCitas, valFavorables, valOtros],
          backgroundColor: ['#22D3EE', '#A855F7', '#10B981', '#64748B'],
          borderColor: '#0F172A',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94A3B8',
              boxWidth: 12,
              padding: 12,
              font: { size: 11, family: 'Inter, system-ui, sans-serif' }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label.split(' (')[0]}: ${val} (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // 2. Gráfico Barras: Nivel por Sedes Principales
  const ctxBar = document.getElementById('chart-bar-sedes');
  if (ctxBar) {
    if (state.chartSedes) {
      state.chartSedes.destroy();
      state.chartSedes = null;
    }

    const ranking = kpis.consuladosRanking || {};
    const sedesTop = Object.entries(ranking).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const labels = sedesTop.map(s => s[0]);
    const valores = sedesTop.map(s => s[1]);

    state.chartSedes = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['La Habana', 'Miami', 'Houston', 'Buenos Aires', 'CDMX'],
        datasets: [{
          data: valores.length ? valores : [0, 0, 0, 0, 0],
          backgroundColor: ['#22D3EE', '#F59E0B', '#A855F7', '#10B981', '#3B82F6', '#EC4899'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94A3B8', font: { size: 10 } } }
        }
      }
    });
  }

  // 3. Gráfico Líneas: Resoluciones Favorables vs Recursos por Cohorte Anual (100% Dinámico)
  const ctxLine = document.getElementById('chart-line-efectividad');
  if (ctxLine) {
    if (state.chartEfectividad) {
      state.chartEfectividad.destroy();
      state.chartEfectividad = null;
    }

    const expedientes = state.expedientes || [];
    const aniosSet = new Set(['2023', '2024', '2025', '2026']);
    const favPorAnio = { '2023': 0, '2024': 0, '2025': 0, '2026': 0 };
    const recPorAnio = { '2023': 0, '2024': 0, '2025': 0, '2026': 0 };

    for (const c of expedientes) {
      const anio = extraerAnioExpediente(c);
      aniosSet.add(anio);
      if (favPorAnio[anio] === undefined) {
        favPorAnio[anio] = 0;
        recPorAnio[anio] = 0;
      }

      const est = String(c.estado || '').trim().toUpperCase();
      if (est === 'RESUELTO FAVORABLE' || (est.includes('FAVORABLE') && !est.includes('RECURSO'))) {
        favPorAnio[anio]++;
      } else if (est.includes('RECURSO')) {
        recPorAnio[anio]++;
      }
    }

    const aniosLista = Array.from(aniosSet).sort();
    const dataFav = aniosLista.map(a => favPorAnio[a] || 0);
    const dataRec = aniosLista.map(a => recPorAnio[a] || 0);

    state.chartEfectividad = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: aniosLista,
        datasets: [
          {
            label: 'Favorables (1ª Instancia)',
            data: dataFav,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10B981',
            pointRadius: 4
          },
          {
            label: 'Recursos Presentados',
            data: dataRec,
            borderColor: '#A855F7',
            backgroundColor: 'rgba(168, 85, 247, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#A855F7',
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94A3B8',
              font: { size: 10, family: 'Inter, system-ui, sans-serif' },
              boxWidth: 10
            }
          },
          tooltip: {
            callbacks: {
              title: (items) => `Año / Cohorte: ${items[0].label}`,
              label: (context) => ` ${context.dataset.label}: ${context.raw} expedientes`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 } } },
          y: { 
            grid: { color: 'rgba(255,255,255,0.04)' }, 
            ticks: { color: '#94A3B8', font: { size: 10 }, precision: 0 },
            beginAtZero: true
          }
        }
      }
    });
  }
}
