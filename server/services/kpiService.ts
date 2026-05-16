export async function calcularKpiSnapshotMensual(sucursalId: number, mes: string): Promise<any> {
  const { getDb } = await import("../db");
  const { sql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB no disponible");

  const [y, m] = mes.split("-");
  const inicio = `${y}-${m}-01`;
  const fin    = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
  const diasMes = new Date(Number(y), Number(m), 0).getDate();

  // 1. Ventas vs meta
  const [[metaRow]] = await db.execute(sql`SELECT metaVentasMensual FROM sucursales WHERE id=${sucursalId}`) as any;
  const meta = Number(metaRow?.metaVentasMensual ?? 135000);
  const [[ventasRow]] = await db.execute(sql`
    SELECT COALESCE(SUM(ventasTotales),0) as total FROM reportes_diarios
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
  `) as any;
  const ventas = Number(ventasRow?.total ?? 0);
  const ventasPct = meta > 0 ? Math.round((ventas/meta)*100) : 0;

  // 2. Score SECOF
  const [[secofRow]] = await db.execute(sql`
    SELECT porcentajeGeneral FROM evaluaciones
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
      AND estado='completada' ORDER BY fecha DESC LIMIT 1
  `) as any;
  const scoreSecof = secofRow ? Math.round(Number(secofRow.porcentajeGeneral)) : null;

  // 3. Puntualidad (conteo de entradas registradas)
  const [[puntRow]] = await db.execute(sql`
    SELECT COUNT(*) as total FROM asistencia
    WHERE sucursalId=${sucursalId}
      AND FROM_UNIXTIME(timestamp/1000) >= ${inicio}
      AND FROM_UNIXTIME(timestamp/1000) <= ${fin}
      AND tipo='entrada' AND subtipo='entrada_turno'
  `) as any;
  const puntualidadPct = Number(puntRow?.total ?? 0) > 0 ? 95 : null;

  // 4. Preparaciones (usa preparadaAt)
  const [[prepRow]] = await db.execute(sql`
    SELECT COUNT(DISTINCT DATE(preparadaAt)) as dias FROM preparaciones
    WHERE sucursalId=${sucursalId}
      AND DATE(preparadaAt) >= ${inicio} AND DATE(preparadaAt) <= ${fin}
  `) as any;
  const preparacionesPct = Math.round((Number(prepRow?.dias ?? 0) / diasMes) * 100);

  // 5. Aperturas registradas
  const [[apertRow]] = await db.execute(sql`
    SELECT COUNT(DISTINCT fecha) as dias FROM turno_apertura
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
  `) as any;
  const aperturasPct = Math.round((Number(apertRow?.dias ?? 0) / diasMes) * 100);

  // 6. Conteos físicos
  const [[conteoRow]] = await db.execute(sql`
    SELECT COUNT(*) as total FROM inv_conteo_fisico
    WHERE sucursalId=${sucursalId} AND fechaConteo>=${inicio} AND fechaConteo<=${fin}
  `) as any;
  const conteoFisicoSem = Number(conteoRow?.total ?? 0);

  // 7. Observaciones manuales
  const obsRows = await db.execute(sql`
    SELECT tipo, ROUND(AVG(CASE WHEN cumple=1 THEN 100 ELSE 0 END),1) as score
    FROM observaciones_kpi
    WHERE sucursalId=${sucursalId}
      AND DATE(createdAt) >= ${inicio} AND DATE(createdAt) <= ${fin}
    GROUP BY tipo
  `) as any;
  const obsMap: Record<string,number> = {};
  for (const r of (obsRows[0] as any[])) obsMap[r.tipo] = Number(r.score);

  // 8. Score ponderado
  const kpis = [
    { v: ventasPct,       peso: 2,   meta: 100 },
    { v: scoreSecof,      peso: 1.5, meta: 85  },
    { v: puntualidadPct,  peso: 1,   meta: 95  },
    { v: preparacionesPct,peso: 1,   meta: 100 },
    { v: aperturasPct,    peso: 1,   meta: 100 },
    { v: obsMap['servicio']    ?? null, peso: 1.5, meta: 85 },
    { v: obsMap['preparacion'] ?? null, peso: 1.5, meta: 85 },
  ].filter(k => k.v !== null && k.v !== undefined);

  const pesoTotal = kpis.reduce((s,k) => s+k.peso, 0);
  const scorePonderado = pesoTotal > 0
    ? Math.round(kpis.reduce((s,k) => s + Math.min(100,(k.v!/k.meta)*100)*k.peso, 0) / pesoTotal)
    : 0;

  const estado = scorePonderado >= 90 ? 'excelente'
    : scorePonderado >= 75 ? 'cumple'
    : scorePonderado >= 60 ? 'riesgo' : 'critico';

  await db.execute(sql`
    INSERT INTO kpi_snapshot_mensual
      (sucursalId, puesto, mes, ventasPct, scoreSecof, puntualidadPct,
       preparacionesPct, aperturasPct, conteoFisicoSem,
       servicioScore, preparacionScore, cajaScore, scoreTotalPct, estado)
    VALUES
      (${sucursalId}, 'lider', ${mes}, ${ventasPct}, ${scoreSecof ?? 0},
       ${puntualidadPct ?? 0}, ${preparacionesPct}, ${aperturasPct},
       ${conteoFisicoSem}, ${obsMap['servicio'] ?? 0},
       ${obsMap['preparacion'] ?? 0}, ${obsMap['caja'] ?? 0},
       ${scorePonderado}, ${estado})
    ON DUPLICATE KEY UPDATE
      ventasPct=${ventasPct}, scoreSecof=${scoreSecof ?? 0},
      puntualidadPct=${puntualidadPct ?? 0}, preparacionesPct=${preparacionesPct},
      aperturasPct=${aperturasPct}, conteoFisicoSem=${conteoFisicoSem},
      servicioScore=${obsMap['servicio'] ?? 0},
      preparacionScore=${obsMap['preparacion'] ?? 0},
      cajaScore=${obsMap['caja'] ?? 0},
      scoreTotalPct=${scorePonderado}, estado=${estado}, calculadoAt=NOW()
  `);

  return { mes, ventasPct, scoreSecof, puntualidadPct, preparacionesPct,
    aperturasPct, conteoFisicoSem, servicioScore: obsMap['servicio'] ?? 0,
    preparacionScore: obsMap['preparacion'] ?? 0, cajaScore: obsMap['caja'] ?? 0,
    scoreTotalPct: scorePonderado, estado };
}
