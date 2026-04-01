/**
 * Scheduler de tareas automáticas del sistema.
 * Se inicializa una vez al arrancar el servidor.
 *
 * Tareas programadas:
 * - Reporte semanal:       lunes a las 8:00 AM
 * - Alerta reportes:       cada día a las 10:00 PM (detecta tiendas sin reporte del día)
 * - Alerta mermas/caja:    cada día a las 11:00 PM (detecta reportes con mermas >3% o descuadre)
 */

import { notifyOwner } from "./_core/notification";

let schedulerInitialized = false;

// ─── Resumen Semanal ──────────────────────────────────────────────────────────
async function enviarResumenSemanal() {
  try {
    const { getReportesDiarios, getSucursales, getEvaluaciones } = await import("./db");
    const [todos, sucursales, evaluaciones] = await Promise.all([
      getReportesDiarios(undefined, undefined, 1000),
      getSucursales(),
      getEvaluaciones(),
    ]);

    const ahora = new Date();
    const hace7 = new Date();
    hace7.setDate(ahora.getDate() - 7);

    const recientes = todos.filter(
      (r) => new Date(r.fecha) >= hace7 && r.estado === "enviado"
    );
    const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
    const totalEfectivo = recientes.reduce((s, r) => s + ((r as any).ventasEfectivo ?? 0), 0);
    const totalTarjeta = recientes.reduce((s, r) => s + ((r as any).ventasTarjeta ?? 0), 0);
    const totalRappi = recientes.reduce((s, r) => s + ((r as any).ventasRappi ?? 0), 0);
    const activasSuc = sucursales.filter((s) => s.activa);
    const conReporte = new Set(recientes.map((r) => r.sucursalId));
    const sinReporte = activasSuc.filter((s) => !conReporte.has(s.id));

    const evsRecientes = evaluaciones.filter(
      (e) => e.estado === "completada" && new Date(e.fecha) >= hace7
    );
    const avgSecof =
      evsRecientes.length > 0
        ? evsRecientes.reduce((s, e) => s + (e.porcentajeGeneral ?? 0), 0) /
          evsRecientes.length
        : null;

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const reportesMes = todos.filter(
      (r) => new Date(r.fecha) >= inicioMes && r.estado === "enviado"
    );
    const ventasPorSucursal: Record<number, number> = {};
    reportesMes.forEach((r) => {
      ventasPorSucursal[r.sucursalId] =
        (ventasPorSucursal[r.sucursalId] ?? 0) + (r.ventasTotales ?? 0);
    });

    const lineasMeta: string[] = [];
    for (const s of activasSuc) {
      const meta = (s as any).metaVentasMensual ?? 0;
      if (meta > 0) {
        const ventas = ventasPorSucursal[s.id] ?? 0;
        const pct = ((ventas / meta) * 100).toFixed(1);
        const emoji = parseFloat(pct) >= 90 ? "✅" : parseFloat(pct) >= 60 ? "⚠️" : "🔴";
        lineasMeta.push(`  ${emoji} ${s.nombre}: ${pct}% ($${ventas.toLocaleString("es-MX")} / $${meta.toLocaleString("es-MX")})`);
      }
    }

    // Mermas de la semana
    const totalMermas = recientes.reduce((s, r) => s + ((r as any).mermasMonto ?? 0), 0);
    const pctMermas = totalVentas > 0 ? ((totalMermas / totalVentas) * 100).toFixed(2) : "0.00";
    const diasConMermasAltas = recientes.filter(
      (r) => (r as any).mermasMonto > 0 && (r.ventasTotales ?? 0) > 0 &&
        ((r as any).mermasMonto / (r.ventasTotales ?? 1)) * 100 > 3
    ).length;

    // Descuadres de la semana
    const descuadres = recientes.filter(
      (r) => (r as any).diferenciaCaja && Math.abs((r as any).diferenciaCaja) > 0
    );
    const totalDescuadre = descuadres.reduce((s, r) => s + Math.abs((r as any).diferenciaCaja ?? 0), 0);

    const fechaInicio = hace7.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
    const fechaFin = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

    const lineas = [
      `📊 RESUMEN SEMANAL AUTOMÁTICO`,
      `Período: ${fechaInicio} al ${fechaFin}`,
      ``,
      `💰 VENTAS DE LA SEMANA`,
      `  Total: $${totalVentas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Efectivo: $${totalEfectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Tarjeta: $${totalTarjeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Rappi: $${totalRappi.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Reportes enviados: ${recientes.length}`,
      ``,
      `📋 EVALUACIONES SECOF`,
      `  Evaluaciones esta semana: ${evsRecientes.length}`,
      `  Promedio general: ${avgSecof !== null ? avgSecof.toFixed(1) + "%" : "Sin datos"}`,
      ``,
      `📦 MERMAS`,
      `  Total mermas: $${totalMermas.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (${pctMermas}% de ventas)`,
      diasConMermasAltas > 0
        ? `  ⚠️ ${diasConMermasAltas} días con mermas >3%`
        : `  ✅ Mermas dentro del rango (≤3%)`,
      ``,
      `💳 DESCUADRES DE CAJA`,
      descuadres.length > 0
        ? `  ⚠️ ${descuadres.length} reportes con descuadre · Total: $${totalDescuadre.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
        : `  ✅ Sin descuadres esta semana`,
      ``,
      `🏪 TIENDAS ACTIVAS: ${activasSuc.length}`,
      sinReporte.length > 0
        ? `  ⚠️ Sin reporte (7 días): ${sinReporte.map((s) => s.nombre).join(", ")}`
        : `  ✅ Todas las tiendas reportaron esta semana`,
      ...(lineasMeta.length > 0
        ? [``, `🎯 AVANCE VS META (mes actual)`, ...lineasMeta]
        : []),
    ];

    await notifyOwner({
      title: `Resumen Semanal — ${fechaFin}`,
      content: lineas.join("\n"),
    });

    console.log(`[Scheduler] Resumen semanal enviado: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[Scheduler] Error al enviar resumen semanal:", err);
  }
}

// ─── Alerta diaria: tiendas sin reporte ──────────────────────────────────────
async function alertaReportesTardios() {
  try {
    const { getReportesDiarios, getSucursales } = await import("./db");
    const [todos, sucursales] = await Promise.all([
      getReportesDiarios(undefined, undefined, 500),
      getSucursales(),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const reportesHoy = todos.filter((r) => {
      const fechaStr = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10);
      return fechaStr === hoy && r.estado === "enviado";
    });
    const conReporteHoy = new Set(reportesHoy.map((r) => r.sucursalId));
    const activasSuc = sucursales.filter((s) => s.activa);
    const sinReporteHoy = activasSuc.filter((s) => !conReporteHoy.has(s.id));

    if (sinReporteHoy.length === 0) {
      console.log(`[Scheduler] Alerta reportes: todas las tiendas reportaron hoy (${hoy})`);
      return;
    }

    const nombres = sinReporteHoy.map((s) => `• ${s.nombre}`).join("\n");
    await notifyOwner({
      title: `⚠️ ${sinReporteHoy.length} tienda(s) sin reporte hoy`,
      content: `Las siguientes tiendas no han enviado su reporte diario del ${hoy}:\n\n${nombres}\n\nRecuerda que el cumplimiento de reportes es un KPI de Nivel 2.`,
    });

    console.log(`[Scheduler] Alerta reportes tardíos enviada: ${sinReporteHoy.length} tiendas`);
  } catch (err) {
    console.error("[Scheduler] Error en alerta de reportes tardíos:", err);
  }
}

// ─── Alerta diaria: mermas altas y descuadres de caja ────────────────────────
async function alertaMermasYDescuadres() {
  try {
    const { getReportesDiarios, getSucursales } = await import("./db");
    const [todos, sucursales] = await Promise.all([
      getReportesDiarios(undefined, undefined, 500),
      getSucursales(),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const reportesHoy = todos.filter((r) => {
      const fechaStr = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10);
      return fechaStr === hoy && r.estado === "enviado";
    });

    const alertas: string[] = [];

    for (const r of reportesHoy) {
      const suc = sucursales.find((s) => s.id === r.sucursalId);
      const nombre = suc?.nombre ?? `Sucursal #${r.sucursalId}`;

      // Mermas altas (>3% de ventas)
      const mermas = (r as any).mermasMonto ?? 0;
      const ventasHoy = r.ventasTotales ?? 0;
      if (mermas > 0 && ventasHoy > 0) {
        const pctMermas = (mermas / ventasHoy) * 100;
        if (pctMermas > 3) {
          alertas.push(`📦 ${nombre}: Mermas ${pctMermas.toFixed(1)}% ($${mermas.toLocaleString("es-MX")}) — Meta ≤3%`);
        }
      }

      // Descuadre de caja significativo (>$50)
      const diferencia = (r as any).diferenciaCaja ?? 0;
      if (Math.abs(diferencia) > 50) {
        const signo = diferencia > 0 ? "+" : "";
        alertas.push(`💳 ${nombre}: Descuadre de caja ${signo}$${diferencia.toFixed(2)}`);
      }
    }

    if (alertas.length === 0) {
      console.log(`[Scheduler] Alerta mermas/caja: sin incidencias hoy (${hoy})`);
      return;
    }

    await notifyOwner({
      title: `🚨 ${alertas.length} incidencia(s) operativas hoy`,
      content: `Se detectaron las siguientes incidencias en los reportes del ${hoy}:\n\n${alertas.join("\n")}\n\nRevisa el detalle en el sistema.`,
    });

    console.log(`[Scheduler] Alerta mermas/descuadres enviada: ${alertas.length} incidencias`);
  } catch (err) {
    console.error("[Scheduler] Error en alerta de mermas/descuadres:", err);
  }
}

// ─── Helpers de tiempo ────────────────────────────────────────────────────────
function msHastaProximoLunes8am(): number {
  const ahora = new Date();
  const resultado = new Date(ahora);
  const diaSemana = ahora.getDay();
  const diasHastaLunes = diaSemana === 1 ? 7 : (8 - diaSemana) % 7 || 7;
  resultado.setDate(ahora.getDate() + diasHastaLunes);
  resultado.setHours(8, 0, 0, 0);
  return resultado.getTime() - ahora.getTime();
}

function msHastaHoraHoy(hora: number, minuto = 0): number {
  const ahora = new Date();
  const objetivo = new Date(ahora);
  objetivo.setHours(hora, minuto, 0, 0);
  if (objetivo <= ahora) {
    // Ya pasó hoy, programar para mañana
    objetivo.setDate(objetivo.getDate() + 1);
  }
  return objetivo.getTime() - ahora.getTime();
}

// ─── Inicialización ───────────────────────────────────────────────────────────
export function initScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // 1. Reporte semanal: próximo lunes 8:00 AM
  const msLunes = msHastaProximoLunes8am();
  const diasLunes = (msLunes / (1000 * 60 * 60 * 24)).toFixed(1);
  console.log(`[Scheduler] Reporte semanal programado en ${diasLunes} días (próximo lunes 8:00 AM)`);
  setTimeout(() => {
    enviarResumenSemanal();
    setInterval(enviarResumenSemanal, 7 * 24 * 60 * 60 * 1000);
  }, msLunes);

  // 2. Alerta reportes tardíos: cada día a las 22:00
  const msReportes = msHastaHoraHoy(22, 0);
  const hrsReportes = (msReportes / (1000 * 60 * 60)).toFixed(1);
  console.log(`[Scheduler] Alerta reportes tardíos programada en ${hrsReportes} horas (22:00 diario)`);
  setTimeout(() => {
    alertaReportesTardios();
    setInterval(alertaReportesTardios, 24 * 60 * 60 * 1000);
  }, msReportes);

  // 3. Alerta mermas y descuadres: cada día a las 23:00
  const msMermas = msHastaHoraHoy(23, 0);
  const hrsMermas = (msMermas / (1000 * 60 * 60)).toFixed(1);
  console.log(`[Scheduler] Alerta mermas/descuadres programada en ${hrsMermas} horas (23:00 diario)`);
  setTimeout(() => {
    alertaMermasYDescuadres();
    setInterval(alertaMermasYDescuadres, 24 * 60 * 60 * 1000);
  }, msMermas);
}
