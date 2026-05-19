import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const finanzasRouter = router({

  // Precios de venta
  precios: {
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`SELECT id, nombre, precio FROM fin_precios_venta WHERE activo=1 ORDER BY nombre`);
      return (rows[0] as any[]);
    }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), precio: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`UPDATE fin_precios_venta SET precio=${input.precio} WHERE id=${input.id}`);
        return { ok: true };
      }),
  },

  // Gastos
  gastos: {
    getByPeriodo: protectedProcedure
      .input(z.object({ sucursalId: z.number(), periodo: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT id, concepto, monto, tipo FROM fin_gastos
          WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo}
          ORDER BY tipo, concepto
        `);
        return (rows[0] as any[]);
      }),
    guardar: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        periodo: z.string(),
        lineas: z.array(z.object({
          id: z.number().optional(),
          concepto: z.string(),
          monto: z.number(),
          tipo: z.enum(["fijo","nomina","variable","extra_ingreso"]),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`DELETE FROM fin_gastos WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo}`);
        for (const l of input.lineas) {
          await db.execute(sql`
            INSERT INTO fin_gastos (sucursalId, periodo, concepto, monto, tipo, capturoId)
            VALUES (${input.sucursalId}, ${input.periodo}, ${l.concepto}, ${l.monto}, ${l.tipo}, ${ctx.user.id})
          `);
        }
        return { ok: true };
      }),
  },

  // Resumen financiero del periodo
  resumen: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      periodo: z.string(), // YYYY-MM
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const fechaInicio = `${input.periodo}-01`;
      const [yr, mo] = input.periodo.split("-").map(Number);
      const fechaFin = new Date(yr, mo, 0).toISOString().split("T")[0];

      // 0. Verificar si hay total oficial importado de Odoo
      const totalOficial = await db.execute(sql`
        SELECT totalVasos, totalIngresos FROM fin_ingresos_totales
        WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo} LIMIT 1
      `);
      const totalOdoo = (totalOficial[0] as any[])[0] ?? null;

      // 1. Ventas del periodo desde inv_ventas_captura
      const ventas = await db.execute(sql`
        SELECT pv.nombre, pv.sabor, SUM(vc.cantidad) as total,
               SUM(vc.cantidad * COALESCE(vc.precioUnitario, 0)) as totalPrecioReal,
               COUNT(CASE WHEN vc.precioUnitario IS NOT NULL THEN 1 END) as conPrecioReal
        FROM inv_ventas_captura vc
        JOIN inv_productos_venta pv ON pv.id = vc.productoVentaId
        WHERE vc.sucursalId = ${input.sucursalId}
          AND vc.fecha BETWEEN ${fechaInicio} AND ${fechaFin}
        GROUP BY pv.nombre, pv.sabor
      `);

      // 2. Precios
      const precios = await db.execute(sql`SELECT nombre, precio FROM fin_precios_venta WHERE activo=1`);
      const precioMap: Record<string, number> = {};
      for (const p of (precios[0] as any[])) precioMap[p.nombre] = Number(p.precio);

      // 3. Calcular ingresos por ventas
      let totalVentas = 0;
      let totalVasos = 0;
      const ventasPorProducto: { nombre: string; sabor: string; cantidad: number; precio: number; subtotal: number }[] = [];
      for (const v of (ventas[0] as any[])) {
        const cantidad = Number(v.total);
        const totalPrecioReal = Number(v.totalPrecioReal ?? 0);
        const conPrecioReal = Number(v.conPrecioReal ?? 0);
        // Usar precio real de Odoo si fue importado, sino usar precio SECOF como fallback
        const usarPrecioReal = conPrecioReal > 0 && totalPrecioReal > 0;
        const subtotal = usarPrecioReal ? totalPrecioReal : cantidad * (precioMap[v.nombre] ?? 0);
        const precio = cantidad > 0 ? Math.round(subtotal / cantidad * 100) / 100 : (precioMap[v.nombre] ?? 0);
        totalVentas += subtotal;
        totalVasos += cantidad;
        ventasPorProducto.push({ nombre: v.nombre, sabor: v.sabor, cantidad, precio, subtotal });
      }

      // Aplicar total oficial de Odoo si existe (cubre cortesías, descuentos, etc.)
      if (totalOdoo) {
        const totalCalculado = totalVentas;
        if (totalCalculado > 0 && Number(totalOdoo.totalIngresos) > 0) {
          const factor = Number(totalOdoo.totalIngresos) / totalCalculado;
          totalVentas = Number(totalOdoo.totalIngresos);
          totalVasos = Number(totalOdoo.totalVasos);
          // Ajustar subtotales por producto proporcionalmente
          for (const v of ventasPorProducto) {
            v.subtotal = Math.round(v.subtotal * factor * 100) / 100;
            v.precio = v.cantidad > 0 ? Math.round(v.subtotal / v.cantidad * 100) / 100 : v.precio;
          }
        }
      }

      // 4. Gastos del periodo
      const gastos = await db.execute(sql`
        SELECT concepto, monto, tipo FROM fin_gastos
        WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo}
      `);

      let totalGastosFijos = 0;
      let totalNomina = 0;
      let totalVariable = 0;
      let totalExtrasIngreso = 0;
      const gastosList: { concepto: string; monto: number; tipo: string }[] = [];

      for (const g of (gastos[0] as any[])) {
        const monto = Number(g.monto);
        gastosList.push({ concepto: g.concepto, monto, tipo: g.tipo });
        if (g.tipo === "fijo") totalGastosFijos += monto;
        else if (g.tipo === "nomina") totalNomina += monto;
        else if (g.tipo === "variable") totalVariable += monto;
        else if (g.tipo === "extra_ingreso") totalExtrasIngreso += monto;
      }

      const totalIngresos = totalVentas + totalExtrasIngreso;
      const totalEgresos = totalGastosFijos + totalNomina + totalVariable;
      // CMV: materia prima recetas x costos (con protección de error)
      let cmvRecetas = 0;
      let cmvExternas = 0;
      try {
        const cmvRR = await db.execute(sql`SELECT COALESCE(SUM(vc.cantidad*r.cantidad*ic.costoXGramo),0) as t FROM inv_ventas_captura vc JOIN inv_recetas r ON r.productoVentaId=vc.productoVentaId JOIN insumos_costos ic ON ic.id=r.insumoId WHERE vc.sucursalId=${input.sucursalId} AND vc.fecha BETWEEN ${fechaInicio} AND ${fechaFin}`);
        cmvRecetas = Number((cmvRR[0] as any[])[0]?.t ?? 0);
        const cmvER = await db.execute(sql`SELECT COALESCE(SUM(total),0) as t FROM compras_externas WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo}`);
        cmvExternas = Number((cmvER[0] as any[])[0]?.t ?? 0);
      } catch(e) { console.error('[Finanzas] CMV query error:', e); }
      const cmvTotal = cmvRecetas + cmvExternas;
      const utilidadBruta = totalIngresos - cmvTotal;
      const margenBruto = totalIngresos > 0 ? (utilidadBruta/totalIngresos)*100 : 0;
      const utilidad = utilidadBruta - totalEgresos;
      const margen = totalIngresos > 0 ? (utilidad/totalIngresos)*100 : 0;

      // Ticket promedio
      const ticketPromedio = totalVasos > 0 ? totalVentas / totalVasos : 0;

      return {
        periodo: input.periodo,
        fechaInicio,
        fechaFin,
        totalVentas,
        totalVasos,
        totalExtrasIngreso,
        totalIngresos,
        totalGastosFijos,
        totalNomina,
        totalVariable,
        totalEgresos,
        utilidad,
        margen,
        ticketPromedio,
        ventasPorProducto,
        gastos: gastosList,
        cmvRecetas,
        cmvExternas,
        cmvTotal,
        utilidadBruta,
        margenBruto,
      };
    }),

  comprasExternas: {
    list: protectedProcedure.input(z.object({sucursalId:z.number(),periodo:z.string()})).query(async({input})=>{const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});const r=await db.execute(sql`SELECT id,fecha,concepto,proveedor,cantidad,unidad,precioUnitario,total,notas FROM compras_externas WHERE sucursalId=${input.sucursalId} AND periodo=${input.periodo} ORDER BY fecha DESC`);return(r[0] as any[]);}),
    guardar: protectedProcedure.input(z.object({sucursalId:z.number(),periodo:z.string(),fecha:z.string(),concepto:z.string(),proveedor:z.string().default('Externo'),cantidad:z.number().default(1),unidad:z.string().default('pz'),precioUnitario:z.number(),total:z.number(),notas:z.string().optional()})).mutation(async({ctx,input})=>{const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});if(!['superadmin','owner','manager','leader'].includes(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});await db.execute(sql`INSERT INTO compras_externas(sucursalId,periodo,fecha,concepto,proveedor,cantidad,unidad,precioUnitario,total,notas,capturoId)VALUES(${input.sucursalId},${input.periodo},${input.fecha},${input.concepto},${input.proveedor},${input.cantidad},${input.unidad},${input.precioUnitario},${input.total},${input.notas??null},${ctx.user.id})`);return{ok:true};}),
    eliminarById: protectedProcedure.input(z.object({id:z.number()})).mutation(async({ctx,input})=>{const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});if(!['superadmin','owner','manager','leader'].includes(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});await db.execute(sql`DELETE FROM compras_externas WHERE id=${input.id}`);return{ok:true};}),
  },
});
