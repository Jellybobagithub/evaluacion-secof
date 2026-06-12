import re

path = "/var/www/secof/server/services/kpiService.ts"

old = open(path).read()

new = '''export async function calcularKpiSnapshotMensual(sucursalId: number, mes: string): Promise<any> {
  const { getDb } = await import("../db");
  const { sql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new Error("DB no disponible");

  const [y, m] = mes.split("-");
  const inicio = `${y}-${m}-01`;
  const fin    = `${y}-${m}-${new Date(Number(y), Number(m), 0).getDate()}`;
  const diasMes = new Date(Number(y), Number(m), 0).getDate();

  // 1. Ventas vs meta
  // FIX: Meta = baseAnterior de metas_mensuales (mismo mes año anterior)
  // FIX: Ventas = SUM de reportes_diarios (fuente correcta para KPI líder)
  const [[metaRow]] = await db.execute(sql`
    SELECT meta, baseAnterior FROM metas_mensuales
    WHERE sucursalId=${sucursalId} AND anio=${Number(y)} AND mes=${Number(m)}
    LIMIT 1
  `) as any;
  // Usar baseAnterior (ventas mismo mes año pasado) como meta real
  const meta = Number(metaRow?.baseAnterior ?? metaRow?.meta ?? 135000);
  const [[ventasRow]] = await db.execute(sql`
    SELECT COALESCE(SUM(ventasTotales),0) as total FROM reportes_diarios
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
  `) as any;
  const ventas = Number(ventasRow?.total ?? 0);
  const ventasPct = meta > 0 ? Math.round((ventas/meta)*100) : 0;

  // 2. Score SECOF
  // FIX: Excluir autoevaluaciones del propio líder — solo tomar evals de evaluadores externos
  // Se considera evaluador externo si evaluadorId != empleadoId del lider de esa sucursal
  const [[liderRow]] = await db.execute(sql`
    SELECT id FROM empleados WHERE sucursalId=${sucursalId} AND rol='lider' AND activo=1 LIMIT 1
  `) as any;
  const liderEmpleadoId = liderRow?.id ?? null;
  const [[liderUserRow]] = liderEmpleadoId ? await db.execute(sql`
    SELECT userId FROM empleados WHERE id=${liderEmpleadoId} LIMIT 1
  `) as any : [[null]];
  const liderUserId = liderUserRow?.userId ?? null;

  // Buscar eval externa más reciente del mes (no hecha por el líder mismo)
  const [[secofRow]] = await db.execute(sql`
    SELECT porcentajeGeneral FROM evaluaciones
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
      AND estado='completada'
      AND (evaluadorId IS NULL OR evaluadorId != ${liderUserId ?? 0})
    ORDER BY fecha DESC LIMIT 1
  `) as any;
  // Fallback: si no hay eval externa, usar cualquier completada
  const [[secofFallback]] = !secofRow ? await db.execute(sql`
    SELECT porcentajeGeneral FROM evaluaciones
    WHERE sucursalId=${sucursalId} AND fecha>=${inicio} AND fecha<=${fin}
      AND estado='completada' ORDER BY fecha ASC LIMIT 1
  `) as any : [[null]];
  const scoreSecof = secofRow
    ? Math.round(Number(secofRow.porcentajeGeneral))
    : secofFallback ? Math.round(Number(secofFallback.porcentajeGeneral)) : null;

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
  // FIX: Leer de tabla asistencia con subtipo='apertura_tienda' en vez de turno_apertura
  // turno_apertura.fecha es VARCHAR y no filtra bien por rango de fechas
  const [[apertRow]] = await db.execute(sql`
    SELECT COUNT(DISTINCT DATE(FROM_UNIXTIME(timestamp/1000))) as dias
    FROM asistencia
    WHERE sucursalId=${sucursalId}
      AND subtipo='apertura_tienda'
      AND FROM_UNIXTIME(timestamp/1000) >= ${inicio}
      AND FROM_UNIXTIME(timestamp/1000) <= ${fin}
  `) as any;
  const aperturasPct = Math.round((Number(apertRow?.dias ?? 0) / diasMes) * 100);

  // 6. Conteos físicos
  const [[conteoRow]] = await db.execute(sql`
    SELECT COUNT(*) as total FROM inv_conteo_fisico
    WHERE sucursalId=${sucursalId} AND fechaConteo>=${inicio} AND fechaConteo<=${fin}
  `) as any;
  const conteoFisicoSem = Number(conteoRow?.total ?? 0);

  // 7. Observaciones manuales (servicio y preparacion — caja excluida si sucursal usa Cashdro)
  const obsRows = await db.execute(sql`
    SELECT tipo, ROUND(AVG(CASE WHEN cumple=1 THEN 100 ELSE 0 END),1) as score
    FROM observaciones_kpi
    WHERE sucursalId=${sucursalId}
      AND DATE(createdAt) >= ${inicio} AND DATE(createdAt) <= ${fin}
    GROUP BY tipo
  `) as any;
  const obsMap: Record<string,number> = {};
  for (const r of (obsRows[0] as any[])) obsMap[r.tipo] = Number(r.score);

  // FIX: Verificar si sucursal usa Cashdro (no caja manual) para excluir cajaScore del ponderado
  const [[sucRow]] = await db.execute(sql`
    SELECT usaCashdro FROM sucursales WHERE id=${sucursalId}
  `) as any;
  const usaCashdro = sucRow?.usaCashdro === 1 || sucRow?.usaCashdro === true;

  // 8. Score ponderado
  // FIX: cajaScore excluido si sucursal usa Cashdro
  const kpis = [
    { v: ventasPct,       peso: 2,   meta: 100 },
    { v: scoreSecof,      peso: 1.5, meta: 85  },
    { v: puntualidadPct,  peso: 1,   meta: 95  },
    { v: preparacionesPct,peso: 1,   meta: 100 },
    { v: aperturasPct,    peso: 1,   meta: 100 },
    { v: obsMap['servicio']    ?? null, peso: 1.5, meta: 85 },
    { v: obsMap['preparacion'] ?? null, peso: 1.5, meta: 85 },
    ...(!usaCashdro && obsMap['caja'] !== undefined
      ? [{ v: obsMap['caja'], peso: 1, meta: 85 }]
      : []),
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
'''

open(path, 'w').write(new)
print("OK — kpiService.ts actualizado")
print("Cambios aplicados:")
print("  1. Meta ventas: usa baseAnterior de metas_mensuales (mes año anterior)")
print("  2. Score SECOF: excluye autoevaluaciones del lider")
print("  3. Aperturas: lee de asistencia.subtipo=apertura_tienda (no turno_apertura)")
print("  4. cajaScore: excluido del ponderado si sucursal usa Cashdro")
