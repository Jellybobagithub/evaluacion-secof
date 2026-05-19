import { fetchVentasOdoo } from "./odooService";
import { enviarReporteDiario, ReporteDiarioData } from "./emailService";

export async function syncVentasDia(fecha: string): Promise<void> {
  const { getDb } = await import("../db");
  const { sql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB no disponible");

  // ── Deduplicación: evitar reenvío si ya se procesó esta fecha hoy ────────
  const [y, m, d] = fecha.split("-");
  const hoyStr = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().split("T")[0];
  if (fecha < hoyStr) {
    // fecha pasada: solo re-sincronizar si el registro fue creado hoy
    const checkRows = await db.execute(sql`
      SELECT id, DATE(createdAt) as creado FROM reportes_diarios
      WHERE sucursalId = 30001 AND fecha = ${fecha} LIMIT 1
    `);
    const existing = (checkRows[0] as any[])[0];
    if (existing && existing.creado !== hoyStr) {
      console.log("[Sync] Fecha " + fecha + " ya procesada (" + existing.creado + "). Omitiendo re-envió.");
      return;
    }
  }

  // ── Leer sucursales activas + meta mensual actual desde BD ───────────────
  const sucRows = await db.execute(sql`
    SELECT id, nombre, COALESCE(metaVentasMensual, 135000) as meta
    FROM sucursales WHERE activa = 1 AND id = 30001
  `);
  const SUCURSALES = (sucRows[0] as any[]).map((r: any) => ({
    id: r.id as number,
    nombre: r.nombre as string,
    meta: Number(r.meta),
  }));

  const reportesData: ReporteDiarioData[] = [];

  for (const suc of SUCURSALES) {
    // 1. Traer ventas de Odoo
    const odoo = await fetchVentasOdoo(fecha, fecha);

    // 2. Cargar mapa de productos
    const prodRows = await db.execute(sql`SELECT id, nombre, sabor FROM inv_productos_venta`);
    const prodMap: Record<string, number> = {};
    for (const r of (prodRows[0] as any[])) {
      const key = r.sabor ? `${r.nombre} ${r.sabor}` : r.nombre;
      prodMap[key] = r.id;
    }

    // 3. Borrar ventas del día y reinsertar
    await db.execute(sql`
      DELETE FROM inv_ventas_captura
      WHERE sucursalId = ${suc.id} AND fecha = ${fecha}
    `);

    const agrupado: Record<string, { cantidad: number; total: number }> = {};
    for (const l of odoo.lineas) {
      if (l.fecha !== fecha) continue;
      if (!agrupado[l.productoNombre]) agrupado[l.productoNombre] = { cantidad: 0, total: 0 };
      agrupado[l.productoNombre].cantidad += l.cantidad;
      agrupado[l.productoNombre].total    += l.total;
    }

    let ventasTotales = 0;
    const topProductos: { nombre: string; cantidad: number; total: number }[] = [];

    for (const [nombre, data] of Object.entries(agrupado)) {
      ventasTotales += data.total;
      topProductos.push({ nombre, cantidad: data.cantidad, total: data.total });
      const productoId = prodMap[nombre];
      if (!productoId) continue;
      await db.execute(sql`
        INSERT INTO inv_ventas_captura (sucursalId, fecha, productoVentaId, cantidad, capturoId)
        VALUES (${suc.id}, ${fecha}, ${productoId}, ${data.cantidad}, 1)
        ON DUPLICATE KEY UPDATE cantidad = ${data.cantidad}
      `);
    }

    topProductos.sort((a, b) => b.total - a.total);

    // 4. Upsert en reportes_diarios
    const existing = await db.execute(sql`
      SELECT id FROM reportes_diarios WHERE sucursalId = ${suc.id} AND fecha = ${fecha} LIMIT 1
    `);
    const rows = existing[0] as any[];

    if (rows.length > 0) {
      await db.execute(sql`
        UPDATE reportes_diarios SET ventasTotales = ${ventasTotales}, updatedAt = NOW()
        WHERE sucursalId = ${suc.id} AND fecha = ${fecha}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO reportes_diarios (sucursalId, usuarioId, usuarioNombre, ventasTotales, fecha, estado)
        VALUES (${suc.id}, 1, 'Sistema (Odoo)', ${ventasTotales}, ${fecha}, 'enviado')
      `);
    }

    // 5. Ventas de semana pasada (mismo día)
    const d = new Date(fecha + "T12:00:00");
    d.setDate(d.getDate() - 7);
    const fechaSemanaAnterior = d.toISOString().split("T")[0];
    const semAnt = await db.execute(sql`
      SELECT COALESCE(SUM(ventasTotales), 0) as total
      FROM reportes_diarios WHERE sucursalId = ${suc.id} AND fecha = ${fechaSemanaAnterior}
    `);
    const ventasSemAnt = Number((semAnt[0] as any[])[0]?.total ?? 0);

    // 6. Ventas del mes para % meta
    const [y, m] = fecha.split("-");
    const inicioMes = `${y}-${m}-01`;
    const mesSuma = await db.execute(sql`
      SELECT COALESCE(SUM(ventasTotales), 0) as total
      FROM reportes_diarios WHERE sucursalId = ${suc.id} AND fecha >= ${inicioMes} AND fecha <= ${fecha}
    `);
    const ventasMes = Number((mesSuma[0] as any[])[0]?.total ?? 0);

    // Tickets del día desde Odoo (aproximado: total líneas únicas por orden)
    const ticketsRows = await db.execute(sql`
      SELECT COUNT(DISTINCT fecha) as cnt FROM inv_ventas_captura
      WHERE sucursalId = ${suc.id} AND fecha = ${fecha}
    `);
    const tickets = Number((ticketsRows[0] as any[])[0]?.cnt ?? 0);

    reportesData.push({
      sucursalNombre: suc.nombre,
      fecha,
      ventasTotales,
      meta: suc.meta,
      porcentajeMeta: suc.meta > 0 ? (ventasMes / suc.meta) * 100 : 0,
      topProductos,
      ventasAyer: 0,
      ventasMismoDiaSemanaPasada: ventasSemAnt,
      tickets,
    });

    console.log(`[Sync] ${suc.nombre} — ${fecha}: $${ventasTotales.toFixed(0)} MXN (${Object.keys(agrupado).length} productos)`);
  }

  // 7. Enviar correo con reporte de ambas tiendas
  if (reportesData.length > 0) {
    await enviarReporteDiario(reportesData);
    console.log(`[Sync] Reporte diario enviado a ${process.env.REPORT_EMAILS}`);
  }
}
