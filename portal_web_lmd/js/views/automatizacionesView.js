// =============================================================================
// VISTA 4: CENTRO DE AUTOMATIZACIONES (automatizacionesView.js)
// Actualización de contadores y diagnóstico transparente en las 4 Action Cards
// =============================================================================

function extraerFechaDetalleJS(texto) {
  if (!texto) return null;
  if (texto instanceof Date) return texto;
  const str = String(texto).trim();
  const matchDma = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchDma) {
    const dia = parseInt(matchDma[1], 10);
    const mes = parseInt(matchDma[2], 10) - 1;
    const anio = parseInt(matchDma[3], 10);
    const d = new Date(anio, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function calcularMetricasEnviosDetalladas(expedientes = []) {
  const hoy = new Date();
  const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const carenciaDias = (state.configSistema && parseInt(state.configSistema.DIAS_CARENCIA_RESOLUCION, 10)) || 60;

  let notificadosAlDia = 0;
  let enCarenciaLegal = 0;
  let listosDespachoHoy = 0;
  let descartadosBajaEmail = 0;

  for (const c of expedientes) {
    const email = String(c.email || '').trim();
    const baja = String(c.baja || '').trim().toUpperCase();
    const notificado = String(c.notificado || '').trim().toUpperCase();
    const estado = String(c.estado || '').trim().toUpperCase();
    const detalle = String(c.detalle || '').trim();

    // 1. Descartados por baja o falta de email
    if (!email.includes('@') || baja === 'SI') {
      descartadosBajaEmail++;
      continue;
    }

    // 2. Notificados Activos (Columna K = SI)
    if (notificado === 'SI') {
      notificadosAlDia++;
      continue;
    }

    // 3. Si NOTIFICADO === 'NO', evaluamos si está dentro de los 60 días de carencia
    if (estado === 'PENDIENTE RESOLUCION') {
      const fechaCita = extraerFechaDetalleJS(detalle);
      if (fechaCita) {
        const diasDesdeCita = Math.floor((hoyLimpio - fechaCita) / (1000 * 60 * 60 * 24));
        if (diasDesdeCita < carenciaDias) {
          enCarenciaLegal++;
          continue;
        }
      }
    }

    // 4. Elegibles listos para ser enviados hoy
    listosDespachoHoy++;
  }

  return {
    totalCartera: expedientes.length,
    notificadosAlDia,
    enCarenciaLegal,
    listosDespachoHoy,
    descartadosBajaEmail,
    carenciaDias
  };
}

function actualizarDatosTarjetasAutomatizacion() {
  const elNotifActivas = document.getElementById('auto-notif-activas');
  const elPendientesEnvio = document.getElementById('auto-pendientes-envio');
  const elEnviosNotificados = document.getElementById('auto-envios-notificados');
  const elEnviosCarencia = document.getElementById('auto-envios-carencia');
  const elEnviosCarenciaSub = document.getElementById('auto-envios-carencia-sub');
  const elEnviosDescartados = document.getElementById('auto-envios-descartados');
  const elCandidatosCola = document.getElementById('auto-candidatos-cola');
  const elHabanaTotal = document.getElementById('auto-habana-total');

  const expedientes = state.expedientes || [];
  const kpis = state.dashboardKPIs || {};

  // 1. Cálculo Detallado de Envíos (Diagnóstico Pre-Flight y Bajas)
  const metricasEnvios = calcularMetricasEnviosDetalladas(expedientes);
  const notifActivas = metricasEnvios.notificadosAlDia;

  // 3. Candidatos en Cola de Citas
  let candidatosCola = 0;
  if (kpis.pendientesCita !== undefined || kpis.pendientesCredenciales !== undefined) {
    candidatosCola = (kpis.pendientesCita || 0) + (kpis.pendientesCredenciales || 0);
  }
  if (!candidatosCola && expedientes.length > 0) {
    candidatosCola = expedientes.filter(c => {
      const est = String(c.estado || '').toUpperCase();
      return est.includes('CITA') || est.includes('CREDENCIAL');
    }).length;
  }

  // 4. En Resolución La Habana
  let habanaTotal = kpis.habanaPendientes !== undefined ? kpis.habanaPendientes : 0;
  if (!habanaTotal && expedientes.length > 0) {
    habanaTotal = expedientes.filter(c => {
      const cons = String(c.consulado || '').toUpperCase();
      const est = String(c.estado || '').toUpperCase();
      return cons.includes('HABANA') && est === 'PENDIENTE RESOLUCION';
    }).length;
  }

  if (elNotifActivas) elNotifActivas.innerText = notifActivas;
  if (elPendientesEnvio) elPendientesEnvio.innerText = metricasEnvios.listosDespachoHoy;
  if (elEnviosNotificados) elEnviosNotificados.innerText = metricasEnvios.notificadosAlDia;
  if (elEnviosCarencia) elEnviosCarencia.innerText = metricasEnvios.enCarenciaLegal;
  if (elEnviosCarenciaSub) elEnviosCarenciaSub.innerText = `< ${metricasEnvios.carenciaDias} Días Cita`;
  if (elEnviosDescartados) elEnviosDescartados.innerText = metricasEnvios.descartadosBajaEmail;
  if (elCandidatosCola) elCandidatosCola.innerText = candidatosCola;
  if (elHabanaTotal) elHabanaTotal.innerText = habanaTotal;
}
