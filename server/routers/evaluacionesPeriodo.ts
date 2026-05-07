import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const evaluacionesPeriodoRouter = router({

  // Obtener config de KPIs por puesto
  kpiConfig: protectedProcedure
    .input(z.object({ puesto: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT id, nombre, meta, frecuencia, tipo, fuente, peso
        FROM eval_kpi_config WHERE puesto=${input.puesto} AND activo=1
        ORDER BY id
      `);
      return (rows[0] as any[]);
    }),

  // Calcular valores automáticos para un evaluado en un periodo
  calcularAutomatico: protectedProcedure
    .input(z.object({
      evaluadoId: z.number(),
      sucursalId: z.number(),
      fechaInicio: z.string(),
      fechaFin: z.string(),
      puesto: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const resultados: Record<string, { valor: number | null; descripcion: string }> = {};

      // VENTAS vs meta
      if (['lider','control_operativo'].includes(input.puesto)) {
        const ventas = await db.execute(sql`
          SELECT SUM(vc.cantidad * COALESCE(fp.precio, 90)) as total
          FROM inv_ventas_captura vc
          LEFT JOIN inv_productos_venta pv ON pv.id = vc.productoVentaId
          LEFT JOIN fin_precios_venta fp ON fp.nombre = pv.nombre
          WHERE vc.sucursalId = ${input.sucursalId}
            AND vc.fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
        `);
        const sucursal = await db.execute(sql`SELECT metaVentasMensual FROM sucursales WHERE id=${input.sucursalId}`);
        const meta = (sucursal[0] as any[])[0]?.metaVentasMensual ?? 90000;
        const totalVentas = Number((ventas[0] as any[])[0]?.total ?? 0);
        const pct = meta > 0 ? (totalVentas / meta) * 100 : 0;
        resultados['ventas'] = { valor: Math.round(pct), descripcion: `$${totalVentas.toLocaleString()} / $${meta.toLocaleString()} (${pct.toFixed(1)}%)` };
      }

      // PUNTUALIDAD del equipo
      const nomina = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN estado IN ('presente','retardo') THEN 1 ELSE 0 END) as presentes,
          SUM(CASE WHEN estado='ausente' THEN 1 ELSE 0 END) as ausentes
        FROM registro_nomina
        WHERE sucursalId=${input.sucursalId}
          AND fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
          AND estado != 'descanso' AND estado != 'sin_horario'
      `);
      const nomRow = (nomina[0] as any[])[0];
      const pctPuntualidad = nomRow?.total > 0 ? (nomRow.presentes / nomRow.total) * 100 : null;
      resultados['puntualidad'] = {
        valor: pctPuntualidad ? Math.round(pctPuntualidad) : null,
        descripcion: pctPuntualidad ? `${pctPuntualidad.toFixed(1)}% (${nomRow.ausentes} ausencias)` : 'Sin datos'
      };

      // VARIACIÓN INVENTARIO (promedio de conteos en el periodo)
      const conteos = await db.execute(sql`
        SELECT COUNT(*) as total FROM inv_conteo_fisico
        WHERE sucursalId=${input.sucursalId}
          AND fechaConteo BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
      `);
      const numConteos = Number((conteos[0] as any[])[0]?.total ?? 0);
      resultados['inventario'] = {
        valor: numConteos > 0 ? 100 : 0,
        descripcion: `${numConteos} conteos realizados en el periodo`
      };

      // PREPARACIONES registradas
      const preps = await db.execute(sql`
        SELECT COUNT(DISTINCT DATE(createdAt)) as dias_con_prep
        FROM preparaciones
        WHERE sucursalId=${input.sucursalId}
          AND DATE(createdAt) BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
      `);
      const diasPrep = Number((preps[0] as any[])[0]?.dias_con_prep ?? 0);
      const diasTotales = Math.ceil((new Date(input.fechaFin).getTime() - new Date(input.fechaInicio).getTime()) / 86400000) + 1;
      const pctPreps = diasTotales > 0 ? (diasPrep / diasTotales) * 100 : 0;
      resultados['preparaciones'] = {
        valor: Math.round(pctPreps),
        descripcion: `${diasPrep} / ${diasTotales} días con preparaciones (${pctPreps.toFixed(1)}%)`
      };

      // APERTURA registrada
      const aperturas = await db.execute(sql`
        SELECT COUNT(DISTINCT fecha) as dias FROM turno_apertura
        WHERE sucursalId=${input.sucursalId}
          AND fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
      `);
      const diasApertura = Number((aperturas[0] as any[])[0]?.dias ?? 0);
      const pctApertura = diasTotales > 0 ? (diasApertura / diasTotales) * 100 : 0;
      resultados['apertura'] = {
        valor: Math.round(pctApertura),
        descripcion: `${diasApertura} / ${diasTotales} días con apertura registrada`
      };

      // RENTABILIDAD (para Jorge)
      if (input.puesto === 'adm_finanzas') {
        const mes = input.fechaInicio.substring(0, 7);
        const gastos = await db.execute(sql`
          SELECT SUM(monto) as total, tipo FROM fin_gastos
          WHERE sucursalId=${input.sucursalId} AND periodo=${mes}
          GROUP BY tipo
        `);
        const ventasMes = await db.execute(sql`
          SELECT SUM(vc.cantidad * COALESCE(fp.precio, 90)) as total
          FROM inv_ventas_captura vc
          LEFT JOIN inv_productos_venta pv ON pv.id = vc.productoVentaId
          LEFT JOIN fin_precios_venta fp ON fp.nombre = pv.nombre
          WHERE vc.sucursalId=${input.sucursalId} AND vc.fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
        `);
        const ingresos = Number((ventasMes[0] as any[])[0]?.total ?? 0);
        let egresos = 0;
        for (const g of (gastos[0] as any[])) {
          if (g.tipo !== 'extra_ingreso') egresos += Number(g.total);
        }
        const margen = ingresos > 0 ? ((ingresos - egresos) / ingresos) * 100 : 0;
        resultados['rentabilidad'] = {
          valor: Math.round(margen),
          descripcion: `Margen neto: ${margen.toFixed(1)}%`
        };
      }

      // CONTEO realizado en tiempo
      resultados['conteo'] = resultados['inventario'];

      // HORARIOS en SECOF (para Judith)
      resultados['horarios'] = {
        valor: 80,
        descripcion: 'Verificación manual requerida'
      };

      return resultados;
    }),

  // Listar evaluaciones
  list: protectedProcedure
    .input(z.object({ evaluadoId: z.number().optional(), sucursalId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT e.id, e.evaluadoId, e.sucursalId, e.puesto, e.periodo, e.fechaInicio, e.fechaFin,
               e.scoreTotal, e.recomendacion, e.estado, e.createdAt,
               u.name as evaluadoNombre, s.nombre as sucursalNombre
        FROM eval_periodos e
        JOIN users u ON u.id = e.evaluadoId
        JOIN sucursales s ON s.id = e.sucursalId
        WHERE 1=1
          ${input.evaluadoId ? sql`AND e.evaluadoId = ${input.evaluadoId}` : sql``}
          ${input.sucursalId ? sql`AND e.sucursalId = ${input.sucursalId}` : sql``}
        ORDER BY e.createdAt DESC
      `);
      return (rows[0] as any[]);
    }),

  // Obtener evaluación por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT e.*, u.name as evaluadoNombre, u.email as evaluadoEmail,
               s.nombre as sucursalNombre
        FROM eval_periodos e
        JOIN users u ON u.id = e.evaluadoId
        JOIN sucursales s ON s.id = e.sucursalId
        WHERE e.id = ${input.id}
      `);
      const row = (rows[0] as any[])[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...row, kpis: typeof row.kpis === 'string' ? JSON.parse(row.kpis) : row.kpis };
    }),

  // Crear o guardar evaluación
  guardar: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      evaluadoId: z.number(),
      sucursalId: z.number(),
      puesto: z.string(),
      periodo: z.number(),
      fechaInicio: z.string(),
      fechaFin: z.string(),
      kpis: z.array(z.object({
        nombre: z.string(),
        meta: z.string(),
        frecuencia: z.string(),
        esAutomatico: z.boolean(),
        valorReal: z.string().optional(),
        descripcionAuto: z.string().optional(),
        score: z.number().min(0).max(100),
        peso: z.number().default(1),
        comentario: z.string().optional(),
      })),
      scoreTotal: z.number(),
      recomendacion: z.enum(["continua","extiende","concluye"]),
      comentariosDirector: z.string().optional(),
      comentariosEmpleado: z.string().optional(),
      estado: z.enum(["borrador","finalizado","firmado"]).default("borrador"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const kpisJson = JSON.stringify(input.kpis);
      if (input.id) {
        await db.execute(sql`
          UPDATE eval_periodos SET
            kpis=${kpisJson}, scoreTotal=${input.scoreTotal},
            recomendacion=${input.recomendacion},
            comentariosDirector=${input.comentariosDirector ?? ''},
            comentariosEmpleado=${input.comentariosEmpleado ?? ''},
            estado=${input.estado},
            updatedAt=NOW()
          WHERE id=${input.id}
        `);
        return { ok: true, id: input.id };
      }
      const result = await db.execute(sql`
        INSERT INTO eval_periodos (evaluadoId, evaluadorId, sucursalId, puesto, periodo,
          fechaInicio, fechaFin, kpis, scoreTotal, recomendacion,
          comentariosDirector, comentariosEmpleado, estado)
        VALUES (${input.evaluadoId}, ${ctx.user.id}, ${input.sucursalId}, ${input.puesto},
          ${input.periodo}, ${input.fechaInicio}, ${input.fechaFin}, ${kpisJson},
          ${input.scoreTotal}, ${input.recomendacion},
          ${input.comentariosDirector ?? ''}, ${input.comentariosEmpleado ?? ''},
          ${input.estado})
      `);
      return { ok: true, id: (result[0] as any).insertId };
    }),

  // Dashboard ejecutivo: estado actual de todos los evaluados
  dashboard: protectedProcedure
    .input(z.object({ sucursalId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT e.id, e.evaluadoId, e.puesto, e.periodo, e.scoreTotal, e.recomendacion,
               e.estado, e.fechaFin, u.name as nombre, s.nombre as sucursal
        FROM eval_periodos e
        JOIN users u ON u.id = e.evaluadoId
        JOIN sucursales s ON s.id = e.sucursalId
        WHERE e.estado != 'firmado'
        ${input.sucursalId ? sql`AND e.sucursalId = ${input.sucursalId}` : sql``}
        ORDER BY e.periodo, u.name
      `);
      return (rows[0] as any[]);
    }),
});
