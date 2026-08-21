// =============================================================================
// CONFIGURACIÓN CENTRAL DEL PORTAL WEB LMD (app.lmd2022.com) — v4.3 EXACT DATA
// =============================================================================

const CONFIG_PORTAL = {
  NOMBRE_SISTEMA: "Portal Consular LMD — Aristeo",
  VERSION: "6.4.1",
  
  // LOS 10 ESTADOS OFICIALES EXACTOS DE GOOGLE SHEETS
  ESTADOS_OFICIALES: [
    { codigo: "PENDIENTE RESOLUCION", etiqueta: "⏳ Pendiente Resolución", claseBadge: "badge-estado-resolucion" },
    { codigo: "PENDIENTE DE CREDENCIALES", etiqueta: "🔑 Pendiente de Credenciales", claseBadge: "badge-estado-credenciales" },
    { codigo: "PENDIENTE DE CITA", etiqueta: "📅 Pendiente de Cita", claseBadge: "badge-estado-cita" },
    { codigo: "RESUELTO FAVORABLE", etiqueta: "🎉 Resuelto Favorable", claseBadge: "badge-estado-favorable" },
    { codigo: "RESUELTO DENEGADO", etiqueta: "❌ Resuelto Denegado", claseBadge: "badge-estado-denegado" },
    { codigo: "RESUELTO", etiqueta: "✅ Resuelto", claseBadge: "badge-estado-resuelto" },
    { codigo: "NO PRESENTADO", etiqueta: "🚫 No Presentado", claseBadge: "badge-estado-nopresentado" },
    { codigo: "RECURSO PRESENTADO", etiqueta: "📑 Recurso Presentado", claseBadge: "badge-estado-recurso" },
    { codigo: "RECURSO FAVORABLE", etiqueta: "🌟 Recurso Favorable", claseBadge: "badge-estado-recurso-favorable" },
    { codigo: "RECURSO DENEGADO", etiqueta: "🛑 Recurso Denegado", claseBadge: "badge-estado-recurso-denegado" }
  ],

  // ASISTENCIA DINÁMICA POKA-YOKE CON VALORES EXACTOS ESCANEADOS DE TU HOJA MAESTRA
  SUGERENCIAS_DETALLE: {
    "RESUELTO FAVORABLE": {
      placeholder: "Ej: RESUELTO CON LNE DICIREG o RESUELTO CON DATOS REGISTRALES",
      sugerencias: ["RESUELTO CON LNE DICIREG", "RESUELTO CON DATOS REGISTRALES"],
      explicacion: "Resolución aprobada por DICIREG o con inscripción registral"
    },
    "PENDIENTE DE CITA": {
      placeholder: "Ej: CITA PENDIENTE o CITA PROGRAMADA DD/MM/AAAA",
      sugerencias: ["CITA PENDIENTE", "CITA PROGRAMADA DD/MM/AAAA"],
      explicacion: "Selecciona si está en cola de búsqueda o si ya tiene fecha asignada"
    },
    "PENDIENTE DE CREDENCIALES": {
      placeholder: "Ej: SOLICITADAS 21/08/2025",
      sugerencias: ["SOLICITADAS DD/MM/AAAA"],
      explicacion: "Fecha de solicitud que alimenta el Termómetro Consular"
    },
    "PENDIENTE RESOLUCION": {
      placeholder: "Ej: CITA 21-07-2026",
      sugerencias: ["CITA DD-MM-AAAA"],
      explicacion: "Fecha de presentación del expediente en el Consulado"
    },
    "RECURSO PRESENTADO": {
      placeholder: "Ej: RECURSO PRESENTADO 12/03/2026",
      sugerencias: ["RECURSO PRESENTADO DD/MM/AAAA"],
      explicacion: "Fecha de interposición del recurso de alzada"
    },
    "RESUELTO DENEGADO": {
      placeholder: "Ej: DENEGADO",
      sugerencias: ["DENEGADO"],
      explicacion: "Expediente con resolución denegatoria"
    },
    "RESUELTO": {
      placeholder: "Ej: Pendiente de Inscripción",
      sugerencias: ["Pendiente de Inscripción"],
      explicacion: "Trámite resuelto en espera de registro o concluido"
    },
    "NO PRESENTADO": {
      placeholder: "Ej: NO SE PRESENTÓ AL CONSULADO",
      sugerencias: ["NO SE PRESENTÓ AL CONSULADO"],
      explicacion: "El solicitante no compareció a su cita"
    },
    "RECURSO FAVORABLE": {
      placeholder: "Ej: RECURSO ESTIMADO FAVORABLE",
      sugerencias: ["RECURSO ESTIMADO FAVORABLE"],
      explicacion: "Recurso concedido por la Dirección General"
    },
    "RECURSO DENEGADO": {
      placeholder: "Ej: RECURSO DESESTIMADO",
      sugerencias: ["RECURSO DESESTIMADO"],
      explicacion: "Recurso desestimado o confirmado desfavorable"
    }
  },

  NIVELES_URGENCIA: [
    "1. ALTA / URGENTE",
    "2. MEDIA / NORMAL",
    "3. BAJA"
  ]
};
