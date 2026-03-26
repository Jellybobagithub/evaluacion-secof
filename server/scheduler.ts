/**
 * Scheduler de tareas automáticas del sistema.
 * Se inicializa una vez al arrancar el servidor.
 *
 * Tareas programadas:
 * - Reporte semanal: lunes a las 8:00 AM (hora del servidor)
 */

import { notifyOwner } from "./_core/notification";

let schedulerInitialized = false;

/**
 * Genera y envía el resumen semanal al owner del sistema.
 */
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
    const totalTx = recientes.reduce((s, r) => s + (r.transacciones ?? 0), 0);
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

    // Calcular avance vs meta del mes actual
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
        lineasMeta.push(`  ${emoji} ${s.nombre}: ${pct}% (${ventas.toLocaleString("es-MX", { minimumFractionDigits: 0 })} / ${meta.toLocaleString("es-MX", { minimumFractionDigits: 0 })})`);
      }
    }

    const fechaInicio = hace7.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
    const fechaFin = ahora.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const lineas = [
      `📊 RESUMEN SEMANAL AUTOMÁTICO`,
      `Período: ${fechaInicio} al ${fechaFin}`,
      ``,
      `💰 VENTAS DE LA SEMANA`,
      `  Total: $${totalVentas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Transacciones: ${totalTx.toLocaleString("es-MX")}`,
      `  Ticket promedio: ${totalTx > 0 ? "$" + (totalVentas / totalTx).toFixed(2) : "N/A"}`,
      `  Reportes enviados: ${recientes.length}`,
      ``,
      `📋 EVALUACIONES SECOF`,
      `  Evaluaciones esta semana: ${evsRecientes.length}`,
      `  Promedio general: ${avgSecof !== null ? avgSecof.toFixed(1) + "%" : "Sin datos"}`,
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

/**
 * Calcula los milisegundos hasta el próximo lunes a las 8:00 AM.
 */
function msHastaProximoLunes8am(): number {
  const ahora = new Date();
  const resultado = new Date(ahora);
  // Día de la semana: 0=Dom, 1=Lun, ..., 6=Sáb
  const diaSemana = ahora.getDay();
  // Días hasta el próximo lunes
  const diasHastaLunes = diaSemana === 1 ? 7 : (8 - diaSemana) % 7 || 7;
  resultado.setDate(ahora.getDate() + diasHastaLunes);
  resultado.setHours(8, 0, 0, 0);
  return resultado.getTime() - ahora.getTime();
}

/**
 * Inicia el scheduler de tareas automáticas.
 * Solo se ejecuta una vez por proceso.
 */
export function initScheduler() {
  if (schedulerInitialized) return;
  schedulerInitialized = true;

  // Programar el reporte semanal para cada lunes a las 8:00 AM
  const msHasta = msHastaProximoLunes8am();
  const diasHasta = (msHasta / (1000 * 60 * 60 * 24)).toFixed(1);
  console.log(`[Scheduler] Reporte semanal programado en ${diasHasta} días (próximo lunes 8:00 AM)`);

  setTimeout(() => {
    // Ejecutar inmediatamente y luego cada 7 días
    enviarResumenSemanal();
    setInterval(enviarResumenSemanal, 7 * 24 * 60 * 60 * 1000);
  }, msHasta);
}
