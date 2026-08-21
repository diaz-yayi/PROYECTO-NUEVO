# CHECKPOINT 39: DASHBOARD 100% DINÁMICO (TASAS DUALES Y COHORTES ANUALES REALES)

**Fecha:** 19/08/2026  
**Versión del Sistema:** v6.5.8  
**Estado:** Estable y Validado para Producción

---

## 1. OBJETIVO DEL CHECKPOINT

Eliminar todos los datos estáticos y simulados del Dashboard Ejecutivo, dotando a la plataforma de:
1. **Panel Dual de Efectividad:** Cálculo dinámico de la Tasa de Concesión en 1ª Instancia (Directa) excluyendo estados ambiguos como `RESUELTO`, y la Tasa de Éxito en Recursos (Alzada) con conteo de recursos en curso.
2. **Gráfico de Líneas Temporal por Cohortes Reales:** Sustitución de los puntos trimestrales simulados (T1-T4) por una línea histórica real agrupada por cohortes de año (`2023`, `2024`, `2025`, `2026`) extraídas de los expedientes.

---

## 2. CAMBIOS IMPLEMENTADOS Y DETALLES TÉCNICOS

### A. Vista Dashboard (`portal_web_lmd/index.html` y `js/views/dashboardView.js`)
1. **Panel Dual de Efectividad Jurídica:**
   - **🏛️ 1ª Instancia (Directa):**
     - Ratio: `(Favorables Directos / (Favorables Directos + Denegados Directos)) * 100`.
     - Filtros estrictos: Solo `RESUELTO FAVORABLE` vs `RESUELTO DENEGADO`. Se excluye `RESUELTO` a secas por ser un estado en transición sin dictamen confirmado.
     - Detalle en vivo: Conteo exacto de aprobados y denegados.
   - **⚖️ Vía Recursos (Alzada):**
     - Ratio: `(Recursos Favorables / (Recursos Favorables + Recursos Denegados)) * 100`.
     - Detalle en vivo: Conteo de Recursos Favorables, Denegados y en Trámite.
2. **Gráfico de Líneas por Cohortes Anuales Reales (`#chart-line-efectividad`):**
   - Agrupa en vivo los casos de la cartera por año (`2023`, `2024`, `2025`, `2026`).
   - Muestra la serie de **Favorables (1ª Instancia)** frente a **Recursos Presentados**, 100% calculados a partir de los datos en memoria.

---

### B. Control de Versiones y Despliegue
- Hoja de estilos y scripts actualizados a **`v=6.5.8`** en `index.html`.
- Paquete **`portal_web_lmd.zip`** actualizado y verificado con 44 archivos.
