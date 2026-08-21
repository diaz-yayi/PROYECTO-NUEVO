// =============================================================================
// ESTADO REACTIVO GLOBAL DEL PORTAL (state.js) — EM
// =============================================================================

// Utilidades globales compartidas
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatFecha(fechaStr) {
  if (!fechaStr) return '—';
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return String(fechaStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch(e) {
    return String(fechaStr);
  }
}

const state = {
  // Datos Maestros
  expedientes: [],
  filtrados: [],
  citas: [],
  citasFiltradas: [],
  dashboardKPIs: null,
  configSistema: null,
  
  // Usuario y Sesión
  usuarioActual: null,
  sesionActiva: false,
  rutaPrevia: null,
  usuariosSistema: [],
  
  // Control de Modo y Bloqueo de Red Anti-Colisión
  modoPrueba: true,
  seccionActiva: 'view-dashboard',
  cargando: false,
  operacionEnProgreso: false,

  // Filtros Expedientes
  filtroConsulado: 'TODOS',
  filtroEstado: 'TODOS',
  terminoBusqueda: '',

  // Paginación Tabla Expedientes
  paginaActual: 1,
  registrosPorPagina: 15,

  // Filtros y Paginación Cola de Citas
  filtroCitasConsulado: 'TODOS',
  filtroCitasUrgencia: 'TODAS',
  filtroCitasCredenciales: 'TODAS',
  citasPaginaActual: 1,
  citasRegistrosPorPagina: 15,

  // Filtros y Paginación Seguimiento La Habana
  verificacionesHabana: [],
  habanaFiltrados: [],
  habanaPaginaActual: 1,
  habanaPorPagina: 15,
  filtroHabanaEstado: 'TODOS',
  terminoBusquedaHabana: '',

  // Filtros y Paginación Seguimiento RCC España
  verificacionesRCC: [],
  rccFiltrados: [],
  rccPaginaActual: 1,
  rccPorPagina: 15,
  filtroRccEstado: 'TODOS',
  terminoBusquedaRcc: '',

  // Filtros y Paginación Módulo Auditoría y Logs
  logsOperaciones: [],
  logsSeguridad: [],
  logsFiltrados: [],
  logsTabActivo: 'operaciones',
  logsPaginaActual: 1,
  logsPorPagina: 15,
  filtroLogsEvento: 'TODOS',
  terminoBusquedaLogs: '',

  // Snapshots para Detección de Cambios (isDirty)
  snapshotExpediente: null,
  snapshotCitas: null,
  snapshotConfig: null,

  // Instancias de Gráficos Chart.js
  chartFunnel: null,
  chartSedes: null,
  chartEfectividad: null
};

// Grupos de Consulados Homogéneos
const GRUPOS_CONSULADOS = {
  "🇨🇺 Cuba": [
    { codigo: "CUBA LA HABANA", nombre: "La Habana" }
  ],
  "🇦🇷 Argentina": [
    { codigo: "ARG BUENOS AIRES", nombre: "Buenos Aires" },
    { codigo: "ARG BAHIA BLANCA", nombre: "Bahía Blanca" },
    { codigo: "ARG CORDOBA", nombre: "Córdoba" },
    { codigo: "ARG MENDOZA", nombre: "Mendoza" },
    { codigo: "ARG ROSARIO", nombre: "Rosario" }
  ],
  "🇲🇽 México": [
    { codigo: "MEX GUADALAJARA", nombre: "Guadalajara" },
    { codigo: "MEX MONTERREY", nombre: "Monterrey" },
    { codigo: "MEX CIUDAD DE MEXICO", nombre: "Ciudad de México" }
  ],
  "🇺🇸 Estados Unidos": [
    { codigo: "USA MIAMI", nombre: "Miami" },
    { codigo: "USA WASHINGTON", nombre: "Washington" },
    { codigo: "USA NUEVA YORK", nombre: "Nueva York" },
    { codigo: "USA BOSTON", nombre: "Boston" },
    { codigo: "USA CHICAGO", nombre: "Chicago" },
    { codigo: "USA HOUSTON", nombre: "Houston" },
    { codigo: "USA LOS ANGELES", nombre: "Los Ángeles" },
    { codigo: "USA SAN FRANCISCO", nombre: "San Francisco" }
  ],
  "🇻🇪 Venezuela": [
    { codigo: "VEN CARACAS", nombre: "Caracas" }
  ],
  "🇺🇾 Uruguay": [
    { codigo: "URY MONTEVIDEO", nombre: "Montevideo" }
  ],
  "🇧🇷 Brasil": [
    { codigo: "BRA SAO PAULO", nombre: "São Paulo" },
    { codigo: "BRA RIO DE JANEIRO", nombre: "Río de Janeiro" },
    { codigo: "BRA BRASILIA", nombre: "Brasilia" },
    { codigo: "BRA PORTO ALEGRE", nombre: "Porto Alegre" },
    { codigo: "BRA SALVADOR DE BAHIA", nombre: "Salvador de Bahía" }
  ],
  "🇨🇱 Chile": [
    { codigo: "CHL SANTIAGO", nombre: "Santiago de Chile" }
  ],
  "🇪🇸 España (Registro Central)": [
    { codigo: "ESP MADRID RCENTRAL", nombre: "Madrid (Registro Central)" }
  ]
};
