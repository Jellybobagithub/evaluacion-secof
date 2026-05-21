/**
 * Router de Inventario de Tienda
 * Gestiona: productos, almacenes, conteos físicos, inventario teórico y comparativas
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  invProductos, invAlmacenes, invMinMax,
  invConteoFisico, invConteoDetalle,
  invTeorico, invTeoricoDetalle,
  invCategoria,
} from "../../drizzle/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { fetchVentasOdoo, testConexion } from "../services/odooService";

// ─── Helpers de semana ────────────────────────────────────────────────────────
function getSemanaISO(date = new Date()): string {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  const dayOfWeek = d.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diff);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const inventarioRouter = router({

  // ── Productos ──────────────────────────────────────────────────────────────
  productos: {
    list: protectedProcedure
      .input(z.object({ soloActivos: z.boolean().default(true) }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.select().from(invProductos)
          .orderBy(invProductos.categoria, invProductos.nombre);
        return input?.soloActivos !== false ? rows.filter(r => r.activo) : rows;
      }),

    create: protectedProcedure
      .input(z.object({
        nombre: z.string().min(1).max(120),
        categoria: z.string().default("General"),
        unidadCompra: z.string().default("pieza"),
        unidadConteo: z.string().default("pieza"),
        factorConversion: z.number().default(1),
        pesoNetoPorUnidad: z.number().optional(),
        puedeAbrirse: z.boolean().default(false),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const [result] = await db.insert(invProductos).values(input);
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).max(120).optional(),
        categoria: z.string().optional(),
        unidadCompra: z.string().optional(),
        unidadConteo: z.string().optional(),
        factorConversion: z.number().optional(),
        pesoNetoPorUnidad: z.number().optional().nullable(),
        puedeAbrirse: z.boolean().optional(),
        activo: z.boolean().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (![
"superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.update(invProductos).set(data as any).where(eq(invProductos.id, id));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.update(invProductos).set({ activo: false }).where(eq(invProductos.id, input.id));
        return { ok: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number(), nuevoNombre: z.string().min(1).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const [original] = await db.select().from(invProductos).where(eq(invProductos.id, input.id));
        if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original;
        const [result] = await db.insert(invProductos).values({ ...rest, nombre: input.nuevoNombre });
        return { id: (result as any).insertId };
      }),
  },

  // ── Categorías ─────────────────────────────────────────────────────────────
  categorias: {
    list: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return db.select().from(invCategoria).orderBy(invCategoria.orden, invCategoria.nombre);
      }),

    create: protectedProcedure
      .input(z.object({
        nombre: z.string().min(1).max(80),
        descripcion: z.string().optional(),
        color: z.string().optional(),
        orden: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin", "owner", "manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const [result] = await db.insert(invCategoria).values(input);
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).max(80).optional(),
        descripcion: z.string().optional(),
        color: z.string().optional(),
        orden: z.number().optional(),
        activa: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin", "owner", "manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.update(invCategoria).set(data).where(eq(invCategoria.id, id));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin", "owner", "manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.delete(invCategoria).where(eq(invCategoria.id, input.id));
        return { ok: true };
      }),
  },
  // ── Almacenes ──────────────────────────────────────────────────────────────
  almacenes: {
    list: protectedProcedure
      .input(z.object({ sucursalId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return db.select().from(invAlmacenes)
          .where(and(eq(invAlmacenes.sucursalId, input.sucursalId), eq(invAlmacenes.activo, true)))
          .orderBy(invAlmacenes.nombre);
      }),

    create: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        nombre: z.string().min(1).max(80),
        tipo: z.enum(["piezas", "piezas_gramos"]).default("piezas"),
        consideraMinMax: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager", "leader"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const [result] = await db.insert(invAlmacenes).values(input);
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().optional(),
        tipo: z.enum(["piezas", "piezas_gramos"]).optional(),
        consideraMinMax: z.boolean().optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.update(invAlmacenes).set(data).where(eq(invAlmacenes.id, id));
        return { ok: true };
      }),

    // Mínimos y máximos de un almacén (solo bodega)
    getMinMax: protectedProcedure
      .input(z.object({ almacenId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return db.select().from(invMinMax).where(eq(invMinMax.almacenId, input.almacenId));
      }),

    setMinMax: protectedProcedure
      .input(z.object({
        almacenId: z.number(),
        productoId: z.number(),
        stockMinimo: z.number().min(0),
        stockMaximo: z.number().min(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const existing = await db.select().from(invMinMax)
          .where(and(eq(invMinMax.almacenId, input.almacenId), eq(invMinMax.productoId, input.productoId)))
          .limit(1);
        if (existing.length > 0) {
          await db.update(invMinMax).set({ stockMinimo: input.stockMinimo, stockMaximo: input.stockMaximo })
            .where(eq(invMinMax.id, existing[0].id));
        } else {
          await db.insert(invMinMax).values(input);
        }
        return { ok: true };
      }),
  },

  // ── Conteo Físico ──────────────────────────────────────────────────────────
  conteoFisico: {
    // Obtener o crear el conteo de la semana actual para un almacén
    getOrCreate: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        almacenId: z.number(),
        semana: z.string().optional(),
        fechaConteo: z.string().optional(),
        forzarNuevo: z.boolean().optional(), // true = crear nuevo aunque exista bloqueado
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const semana = input.semana ?? getSemanaISO();
        const fechaConteoUsar = input.fechaConteo ?? new Date().toISOString().split("T")[0];
        if (!input.forzarNuevo) {
          const existing = await db.select().from(invConteoFisico)
            .where(and(
              eq(invConteoFisico.sucursalId, input.sucursalId),
              eq(invConteoFisico.almacenId, input.almacenId),
              eq(invConteoFisico.semana, semana),
            )).limit(1);
          if (existing.length > 0) {
            if (input.fechaConteo && existing[0].fechaConteo !== input.fechaConteo) {
              await db.execute(sql`UPDATE inv_conteo_fisico SET fechaConteo=${input.fechaConteo} WHERE id=${existing[0].id}`);
              existing[0] = { ...existing[0], fechaConteo: input.fechaConteo } as any;
            }
            const detalles = await db.select().from(invConteoDetalle)
              .where(eq(invConteoDetalle.conteoId, existing[0].id));
            return { conteo: existing[0], detalles };
          }
        }
        // forzarNuevo=true: buscar conteo anterior para pre-cargar valores
        let detallesAnteriores: any[] = [];
        if (input.forzarNuevo) {
          const anterior = await db.execute(sql`
            SELECT id FROM inv_conteo_fisico
            WHERE sucursalId=${input.sucursalId} AND almacenId=${input.almacenId}
              AND estado IN ('bloqueado','enviado')
            ORDER BY fechaConteo DESC LIMIT 1
          `);
          const anteriorId = (anterior[0] as any[])[0]?.id;
          if (anteriorId) {
            const dets = await db.select().from(invConteoDetalle)
              .where(eq(invConteoDetalle.conteoId, anteriorId));
            detallesAnteriores = dets;
          }
        }
        // Crear nuevo conteo con la fecha seleccionada
        const [result] = await db.insert(invConteoFisico).values({
          sucursalId: input.sucursalId,
          almacenId: input.almacenId,
          semana,
          fechaConteo: fechaConteoUsar,
          liderId: ctx.user.id,
          estado: "borrador",
        });
        const conteoId = (result as any).insertId;
        const conteo = await db.select().from(invConteoFisico).where(eq(invConteoFisico.id, conteoId)).limit(1);
        // Si hay datos anteriores, copiarlos como punto de partida
        if (detallesAnteriores.length > 0) {
          for (const d of detallesAnteriores) {
            await db.insert(invConteoDetalle).values({
              conteoId,
              productoId: d.productoId,
              cantidadPiezas: d.cantidadPiezas,
              cantidadGramos: d.cantidadGramos ?? 0,
            });
          }
          const detallesCargados = await db.select().from(invConteoDetalle)
            .where(eq(invConteoDetalle.conteoId, conteoId));
          return { conteo: conteo[0], detalles: detallesCargados };
        }
        return { conteo: conteo[0], detalles: [] };
      }),

    // Guardar líneas del conteo (upsert por conteoId + productoId)
    guardarDetalle: protectedProcedure
      .input(z.object({
        conteoId: z.number(),
        lineas: z.array(z.object({
          productoId: z.number(),
          cantidadPiezas: z.number().min(0),
          cantidadGramos: z.number().min(0).optional(),
          notas: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Verificar que el conteo no esté bloqueado
        const conteo = await db.select().from(invConteoFisico)
          .where(eq(invConteoFisico.id, input.conteoId)).limit(1);
        if (!conteo.length) throw new TRPCError({ code: "NOT_FOUND" });
        if (conteo[0].estado === "bloqueado")
          throw new TRPCError({ code: "FORBIDDEN", message: "El conteo está bloqueado y no puede modificarse." });
        // Eliminar detalles anteriores y reinsertar
        await db.delete(invConteoDetalle).where(eq(invConteoDetalle.conteoId, input.conteoId));
        if (input.lineas.length > 0) {
          await db.insert(invConteoDetalle).values(
            input.lineas.map(l => ({ conteoId: input.conteoId, ...l }))
          );
        }
        return { ok: true };
      }),

    // Enviar y bloquear el conteo
    enviar: protectedProcedure
      .input(z.object({ conteoId: z.number(), notas: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const conteo = await db.select().from(invConteoFisico)
          .where(eq(invConteoFisico.id, input.conteoId)).limit(1);
        if (!conteo.length) throw new TRPCError({ code: "NOT_FOUND" });
        if (conteo[0].estado === "bloqueado")
          throw new TRPCError({ code: "FORBIDDEN", message: "El conteo ya está bloqueado." });
        await db.update(invConteoFisico).set({
          estado: "bloqueado",
          notas: input.notas,
        }).where(eq(invConteoFisico.id, input.conteoId));
        return { ok: true };
      }),

    // Historial de conteos por almacén
    historial: protectedProcedure
      .input(z.object({ sucursalId: z.number(), almacenId: z.number(), limite: z.number().default(12) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT cf.*,
                 u.name AS realizadoPorNombre
          FROM inv_conteo_fisico cf
          LEFT JOIN users u ON u.id = cf.liderId
          WHERE cf.sucursalId = ${input.sucursalId}
            AND cf.almacenId  = ${input.almacenId}
          ORDER BY cf.fechaConteo DESC, cf.id DESC
          LIMIT ${input.limite}
        `);
        return (rows[0] as any[]);
      }),

    // Obtener conteo con detalles por ID
    getById: protectedProcedure
      .input(z.object({ conteoId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const conteo = await db.select().from(invConteoFisico)
          .where(eq(invConteoFisico.id, input.conteoId)).limit(1);
        if (!conteo.length) throw new TRPCError({ code: "NOT_FOUND" });
        const detalles = await db.select().from(invConteoDetalle)
          .where(eq(invConteoDetalle.conteoId, input.conteoId));
        return { conteo: conteo[0], detalles };
      }),

    // Eliminar conteo físico (solo superadmin/owner/manager)
    eliminar: protectedProcedure
      .input(z.object({ conteoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN", message: "Sin permiso para eliminar conteos" });
        await db.delete(invConteoDetalle).where(eq(invConteoDetalle.conteoId, input.conteoId));
        await db.delete(invConteoFisico).where(eq(invConteoFisico.id, input.conteoId));
        return { ok: true };
      }),
  },

  // ── Inventario Teórico ─────────────────────────────────────────────────────
  teorico: {
    getOrCreate: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        almacenId: z.number(),
        semana: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const semana = input.semana ?? getSemanaISO();
        const existing = await db.select().from(invTeorico)
          .where(and(
            eq(invTeorico.sucursalId, input.sucursalId),
            eq(invTeorico.almacenId, input.almacenId),
            eq(invTeorico.semana, semana),
          )).limit(1);
        if (existing.length > 0) {
          const detalles = await db.select().from(invTeoricoDetalle)
            .where(eq(invTeoricoDetalle.teoricoId, existing[0].id));
          return { teorico: existing[0], detalles };
        }
        const [result] = await db.insert(invTeorico).values({
          sucursalId: input.sucursalId,
          almacenId: input.almacenId,
          semana,
          supervisorId: ctx.user.id,
          estado: "borrador",
        });
        const teoricoId = (result as any).insertId;
        const teorico = await db.select().from(invTeorico).where(eq(invTeorico.id, teoricoId)).limit(1);
        return { teorico: teorico[0], detalles: [] };
      }),

    guardarDetalle: protectedProcedure
      .input(z.object({
        teoricoId: z.number(),
        lineas: z.array(z.object({
          productoId: z.number(),
          cantidadEsperada: z.number().min(0),
          notas: z.string().optional(),
        })),
        publicar: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const role = ctx.user.role;
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.delete(invTeoricoDetalle).where(eq(invTeoricoDetalle.teoricoId, input.teoricoId));
        if (input.lineas.length > 0) {
          await db.insert(invTeoricoDetalle).values(
            input.lineas.map(l => ({ teoricoId: input.teoricoId, ...l }))
          );
        }
        if (input.publicar) {
          await db.update(invTeorico).set({ estado: "publicado" })
            .where(eq(invTeorico.id, input.teoricoId));
        }
        return { ok: true };
      }),

    historial: protectedProcedure
      .input(z.object({ sucursalId: z.number(), almacenId: z.number(), limite: z.number().default(12) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return db.select().from(invTeorico)
          .where(and(
            eq(invTeorico.sucursalId, input.sucursalId),
            eq(invTeorico.almacenId, input.almacenId),
          ))
          .orderBy(desc(invTeorico.semana))
          .limit(input.limite);
      }),
  },

  // ── Comparativa Teórico vs Físico ──────────────────────────────────────────
  comparativa: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      almacenId: z.number(),
      semana: z.string().optional(),
      fechaHasta: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const semana = input.semana ?? getSemanaISO();
      const fechaFin = input.fechaHasta ?? new Date().toISOString().split("T")[0];

      // Obtener el conteo fisico mas reciente hasta fechaFin
      const conteos = await db.execute(sql`
        SELECT * FROM inv_conteo_fisico
        WHERE sucursalId = ${input.sucursalId}
          AND almacenId = ${input.almacenId}
          AND fechaConteo <= ${fechaFin}
        ORDER BY fechaConteo DESC
        LIMIT 1
      `);
      const conteoRow = (conteos[0] as any[])[0] ?? null;
      const fechaInicio = conteoRow?.fechaConteo ?? fechaFin;

      // Obtener todos los productos activos
      const productos = await db.select().from(invProductos)
        .where(eq(invProductos.activo, true))
        .orderBy(invProductos.categoria, invProductos.nombre);

      // Detalles físico
      const detallesFisico = conteoRow
        ? await db.select().from(invConteoDetalle).where(eq(invConteoDetalle.conteoId, conteoRow.id))
        : [];

      // Calcular teórico automático desde ventas+recetas
      const ventas = await db.execute(sql`
        SELECT vc.productoVentaId, SUM(vc.cantidad) as totalVendido
        FROM inv_ventas_captura vc
        WHERE vc.sucursalId = ${input.sucursalId} AND vc.fecha BETWEEN ${fechaInicio} AND ${fechaFin}
        GROUP BY vc.productoVentaId
      `);
      const ventasMap: Record<number,number> = {};
      for (const v of (ventas[0] as any[])) ventasMap[v.productoVentaId] = Number(v.totalVendido);

      const recetasMP = await db.execute(sql`
        SELECT r.productoVentaId, r.materiasPrimaId, r.cantidadGramos, r.cantidadPiezas
        FROM inv_recetas r WHERE r.esSubproducto=0 AND r.materiasPrimaId IS NOT NULL
      `);
      const recetasSP = await db.execute(sql`
        SELECT r.productoVentaId, r.subproductoId, r.cantidadGramos as cantSP,
               sr.materiasPrimaId, sr.cantidadGramos as cantMP, sr.cantidadPiezas as pzMP, s.rendimientoGramos
        FROM inv_recetas r
        JOIN inv_subproductos s ON s.id=r.subproductoId
        JOIN inv_subproductos_receta sr ON sr.subproductoId=s.id
        WHERE r.esSubproducto=1
      `);

      const consumo: Record<number,{gramos:number;piezas:number}> = {};
      const addC = (id:number, g:number, p:number) => {
        if (!consumo[id]) consumo[id] = {gramos:0,piezas:0};
        consumo[id].gramos += g; consumo[id].piezas += p;
      };
      for (const r of (recetasMP[0] as any[])) {
        const v = ventasMap[r.productoVentaId]||0;
        if (v) addC(r.materiasPrimaId,(r.cantidadGramos||0)*v,(r.cantidadPiezas||0)*v);
      }
      for (const r of (recetasSP[0] as any[])) {
        const v = ventasMap[r.productoVentaId]||0;
        if (v && r.rendimientoGramos>0) {
          const f = (r.cantSP*v)/r.rendimientoGramos;
          addC(r.materiasPrimaId,(r.cantMP||0)*f,(r.pzMP||0)*f);
        }
      }

      // Surtidos confirmados entre fechaInicio y fechaFin — sumar como entradas
      const surtidosRows = await db.execute(sql`
        SELECT sd.productoId, SUM(sd.cantidadPiezas) as totalPiezas
        FROM inv_surtidos s
        JOIN inv_surtido_detalle sd ON sd.surtidoId = s.id
        WHERE s.sucursalId = ${input.sucursalId}
          AND s.estado = 'confirmado'
          AND s.fecha BETWEEN ${fechaInicio} AND ${fechaFin}
        GROUP BY sd.productoId
      `);
      const surtidosMap: Record<number,number> = {};
      for (const r of (surtidosRows[0] as any[])) {
        surtidosMap[r.productoId] = Number(r.totalPiezas);
      }

      // Toppings pool 46g/vaso
      const toppingRow = await db.execute(sql`SELECT id FROM inv_productos_venta WHERE nombre='Topping Extra' LIMIT 1`);
      const toppingExtraId = ((toppingRow[0] as any[])[0]?.id)??null;
      let totalVasos=0, toppingExtras=0;
      for (const [pvId,qty] of Object.entries(ventasMap)) {
        if (toppingExtraId && Number(pvId)===toppingExtraId) toppingExtras+=qty;
        else totalVasos+=qty;
      }
      if ((totalVasos+toppingExtras)*46>0) consumo[999999]={gramos:(totalVasos+toppingExtras)*46,piezas:0};

      // Construir comparativa
      const lineas = productos.map(prod => {
        const fisico = detallesFisico.find(d => d.productoId === prod.id);
        const c = consumo[prod.id];
        const cantFisica = fisico?.cantidadPiezas ?? 0;
        const cantGramos = fisico?.cantidadGramos ?? 0;
        // stockInicial: piezas*pesoNeto (cerradas) + gramos (abiertas en Isla)
        const pesoNeto = Number((prod as any).pesoNeto ?? 0);
        const gramosEnPiezas = (fisico?.cantidadPiezas ?? 0) * pesoNeto;
        const gramosAbiertos = fisico?.cantidadGramos ?? 0;
        const stockInicial = prod.puedeAbrirse ? (gramosEnPiezas + gramosAbiertos) : cantFisica;
        const surtidoEntrada = surtidosMap[prod.id] ?? 0;
        const consumoCalc = c ? (prod.puedeAbrirse ? Math.round(c.gramos*100)/100 : Math.round(c.piezas*100)/100) : 0;
        const cantTeorica = Math.max(0, stockInicial + surtidoEntrada - consumoCalc);
        const diferencia = cantFisica - cantTeorica;
        const pctVariacion = cantTeorica > 0 ? (diferencia / cantTeorica) * 100 : null;
        return {
          productoId: prod.id,
          productoNombre: prod.nombre,
          categoria: prod.categoria,
          unidadConteo: prod.unidadConteo,
          puedeAbrirse: prod.puedeAbrirse,
          cantidadFisica: cantFisica,
          cantidadGramos: cantGramos,
          cantidadTeorica: cantTeorica,
          diferencia,
          pctVariacion,
          alerta: pctVariacion !== null && Math.abs(pctVariacion) > 10, // alerta si variación >10%
        };
      });

      // Obtener min/max si el almacén es de bodega
      const minMaxRows = await db.select().from(invMinMax)
        .where(eq(invMinMax.almacenId, input.almacenId));

      const lineasConMinMax = lineas.map(l => {
        const mm = minMaxRows.find(m => m.productoId === l.productoId);
        return {
          ...l,
          stockMinimo: mm?.stockMinimo ?? null,
          stockMaximo: mm?.stockMaximo ?? null,
          bajoMinimo: mm ? l.cantidadFisica < mm.stockMinimo : false,
        };
      });

      return {
        semana,
        conteo: conteoRow ?? null,
        teorico: null,
        lineas: lineasConMinMax,
        resumen: {
          totalProductos: lineas.length,
          conAlerta: lineas.filter(l => l.alerta).length,
          bajoMinimo: lineasConMinMax.filter(l => l.bajoMinimo).length,
          hayFisico: !!conteoRow,
          hayTeorico: Object.keys(consumo).length > 0,
        },
      };
    }),

  // ── Ventas Captura ─────────────────────────────────────────────────────────
  ventas: {
    // Listar productos de venta disponibles
    listProductos: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT id, nombre, sabor FROM inv_productos_venta ORDER BY nombre, sabor
        `);
        return (rows[0] as any[]);
      }),

    // Obtener ventas de una sucursal por fecha
    getByFecha: protectedProcedure
      .input(z.object({ sucursalId: z.number(), fecha: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT vc.id, vc.productoVentaId, vc.cantidad, vc.fecha,
                 pv.nombre, pv.sabor
          FROM inv_ventas_captura vc
          JOIN inv_productos_venta pv ON pv.id = vc.productoVentaId
          WHERE vc.sucursalId = ${input.sucursalId} AND vc.fecha = ${input.fecha}
          ORDER BY pv.nombre, pv.sabor
        `);
        return (rows[0] as any[]);
      }),

    // Guardar ventas del dia (upsert por producto+fecha)
    guardar: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fecha: z.string(),
        lineas: z.array(z.object({
          productoVentaId: z.number(),
          cantidad: z.number().min(0),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        // Eliminar ventas del dia y reemplazar
        await db.execute(sql`
          DELETE FROM inv_ventas_captura
          WHERE sucursalId = ${input.sucursalId} AND fecha = ${input.fecha}
        `);
        for (const linea of input.lineas) {
          if (linea.cantidad > 0) {
            await db.execute(sql`
              INSERT INTO inv_ventas_captura (sucursalId, fecha, productoVentaId, cantidad, capturoId)
              VALUES (${input.sucursalId}, ${input.fecha}, ${linea.productoVentaId}, ${linea.cantidad}, ${ctx.user.id})
            `);
          }
        }
        return { ok: true };
      }),



    // Test de conexión con Odoo
    testOdoo: protectedProcedure
      .query(async ({ ctx }) => {
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        return testConexion();
      }),

    // Sync directo desde Odoo: trae ventas por rango de fechas y las guarda en inv_ventas_captura
    syncFromOdoo: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(), // YYYY-MM-DD
        fechaFin: z.string(),    // YYYY-MM-DD
        reemplazar: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });

        // 1. Traer datos de Odoo
        const odoo = await fetchVentasOdoo(input.fechaInicio, input.fechaFin);

        // 2. Cargar mapa de productos SECOF
        const prodRows = await db.execute(sql`SELECT id, nombre, sabor FROM inv_productos_venta`);
        const prodMap: Record<string, number> = {};
        for (const r of (prodRows[0] as any[])) {
          const key = r.sabor ? `${r.nombre} ${r.sabor}` : r.nombre;
          prodMap[key] = r.id;
        }

        // 3. Opcional: borrar el rango antes de insertar
        if (input.reemplazar) {
          await db.execute(sql`
            DELETE FROM inv_ventas_captura
            WHERE sucursalId = ${input.sucursalId}
              AND fecha >= ${input.fechaInicio}
              AND fecha <= ${input.fechaFin}
          `);
        }

        // 4. Insertar líneas
        let insertados = 0;
        const noMapeados = new Set<string>();

        // Agrupar por fecha+producto
        const agrupado: Record<string, number> = {};
        for (const l of odoo.lineas) {
          const key = `${l.fecha}|||${l.productoNombre}`;
          agrupado[key] = (agrupado[key] || 0) + l.cantidad;
        }

        for (const [key, cantidad] of Object.entries(agrupado)) {
          const [fecha, nombre] = key.split("|||");
          const productoId = prodMap[nombre];
          if (!productoId) {
            noMapeados.add(nombre);
            continue;
          }
          await db.execute(sql`
            INSERT INTO inv_ventas_captura (sucursalId, fecha, productoVentaId, cantidad, capturoId)
            VALUES (${input.sucursalId}, ${fecha}, ${productoId}, ${cantidad}, ${ctx.user.id})
            ON DUPLICATE KEY UPDATE cantidad = ${cantidad}, capturoId = ${ctx.user.id}
          `);
          insertados++;
        }

        return {
          ok: true,
          insertados,
          diasImportados: new Set(odoo.lineas.map(l => l.fecha)).size,
          noMapeados: [...noMapeados, ...odoo.noMapeados],
          totalOdoo: odoo.totalRegistros,
        };
      }),

    // Importar ventas masivas desde Excel de Odoo (con precios reales)
    importarOdooExcel: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        lineas: z.array(z.object({
          productoNombre: z.string(),
          fecha: z.string(),
          cantidad: z.number(),
          precioUnitario: z.number().optional(), // precio real de Odoo
        })),
        preciosPorFamilia: z.record(z.string(), z.number()).optional(), // familia → precio
        reemplazarRango: z.object({
          inicio: z.string(),
          fin: z.string(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });

        // Cargar mapa de productos (nombre+sabor → id)
        const prodRows = await db.execute(sql`SELECT id, nombre, sabor FROM inv_productos_venta`);
        const prodMap: Record<string, number> = {};
        for (const r of (prodRows[0] as any[])) {
          prodMap[`${r.nombre}|||${r.sabor || ""}`] = r.id;
        }

        // Función de mapeo idéntica a la del script de importación
        const SABOR_FIX: Record<string,string> = { "Lichi": "Lichie" };
        const SKIP = new Set(["Descuento Locatario"]);
        const PREFIJOS: Record<string,string> = {
          "Caliente": "Snowtea Caliente",
          "Chamoy":   "Snowtea Chamoy",
          "Clasico":  "Snowtea Clasico",
          "Yogurt":   "Snowtea Yogurt",
          "Fra-T":    "Fra-T",
          "Topping":  "Topping Extra",
          "Cortesia": "Cortesia",
        };
        function mapProducto(nombreRaw: string): number | null {
          if (SKIP.has(nombreRaw)) return null;
          const parts = nombreRaw.split(" ").slice(0, 1)[0];
          const sabor = SABOR_FIX[nombreRaw.slice(parts.length + 1)] ?? nombreRaw.slice(parts.length + 1);
          const nombreDb = PREFIJOS[parts] ?? nombreRaw;
          const saborDb = parts === "Topping" ? "" : sabor;
          return prodMap[`${nombreDb}|||${saborDb}`] ?? null;
        }

        // Si hay rango, borrar primero
        if (input.reemplazarRango) {
          await db.execute(sql`
            DELETE FROM inv_ventas_captura
            WHERE sucursalId = ${input.sucursalId}
              AND fecha BETWEEN ${input.reemplazarRango.inicio} AND ${input.reemplazarRango.fin}
          `);
        }

        // Agrupar por fecha para hacer delete+insert por día
        const porFecha: Record<string, Array<{productoId: number; cantidad: number}>> = {};
        const noMapeados = new Set<string>();

        for (const linea of input.lineas) {
          const prodId = mapProducto(linea.productoNombre);
          if (!prodId) { noMapeados.add(linea.productoNombre); continue; }
          if (!porFecha[linea.fecha]) porFecha[linea.fecha] = [];
          porFecha[linea.fecha].push({ productoId: prodId, cantidad: linea.cantidad, precioUnitario: linea.precioUnitario });
        }

        let insertados = 0;
        for (const [fecha, lineas] of Object.entries(porFecha)) {
          if (!input.reemplazarRango) {
            // Si no hay rango global, borrar día a día
            await db.execute(sql`
              DELETE FROM inv_ventas_captura
              WHERE sucursalId = ${input.sucursalId} AND fecha = ${fecha}
            `);
          }
          for (const l of lineas) {
            await db.execute(sql`
              INSERT INTO inv_ventas_captura (sucursalId, fecha, productoVentaId, cantidad, precioUnitario, capturoId)
              VALUES (${input.sucursalId}, ${fecha}, ${l.productoId}, ${l.cantidad}, ${l.precioUnitario ?? null}, ${ctx.user.id})
            `);
            insertados++;
          }
        }

        // Actualizar precios reales en fin_precios_venta
        if (input.preciosPorFamilia && Object.keys(input.preciosPorFamilia).length > 0) {
          for (const [familia, precio] of Object.entries(input.preciosPorFamilia)) {
            if (precio > 0) {
              // Verificar si existe
              const existe = await db.execute(sql`SELECT id FROM fin_precios_venta WHERE nombre=${familia} LIMIT 1`);
              if ((existe[0] as any[]).length > 0) {
                await db.execute(sql`UPDATE fin_precios_venta SET precio=${precio} WHERE nombre=${familia}`);
              } else {
                await db.execute(sql`INSERT INTO fin_precios_venta (nombre, precio) VALUES (${familia}, ${precio})`);
              }
            }
          }
        }

        return {
          ok: true,
          insertados,
          diasImportados: Object.keys(porFecha).length,
          noMapeados: Array.from(noMapeados),
          preciosActualizados: Object.keys(input.preciosPorFamilia ?? {}).length,
        };
      }),

    // Calcular consumo teorico de materias primas segun ventas de un periodo
    calcularTeorico: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // 1. Ventas en el periodo
        const ventas = await db.execute(sql`
          SELECT vc.productoVentaId, SUM(vc.cantidad) as totalVendido
          FROM inv_ventas_captura vc
          WHERE vc.sucursalId = ${input.sucursalId}
            AND vc.fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
          GROUP BY vc.productoVentaId
        `);
        const ventasMap: Record<number, number> = {};
        for (const v of (ventas[0] as any[])) {
          ventasMap[v.productoVentaId] = Number(v.totalVendido);
        }

        // 2. Recetas directas MP
        const recetasMP = await db.execute(sql`
          SELECT r.productoVentaId, r.materiasPrimaId, r.cantidadGramos, r.cantidadPiezas, p.nombre, p.unidadCompra, p.pesoNetoPorUnidad
          FROM inv_recetas r
          JOIN inv_productos p ON p.id = r.materiasPrimaId
          WHERE r.esSubproducto = 0 AND r.materiasPrimaId IS NOT NULL
        `);

        // 3. Recetas de subproductos
        const recetasSP = await db.execute(sql`
          SELECT r.productoVentaId, r.subproductoId, r.cantidadGramos as cantSubproducto,
                 sr.materiasPrimaId, sr.cantidadGramos as cantMP, sr.cantidadPiezas as piezasMP,
                 s.rendimientoGramos, p.nombre, p.unidadCompra, p.pesoNetoPorUnidad
          FROM inv_recetas r
          JOIN inv_subproductos s ON s.id = r.subproductoId
          JOIN inv_subproductos_receta sr ON sr.subproductoId = s.id
          JOIN inv_productos p ON p.id = sr.materiasPrimaId
          WHERE r.esSubproducto = 1
        `);

        // 4. Calcular consumo total por materia prima
        const consumo: Record<number, { nombre: string; unidad: string; pesoNeto: number; gramos: number; piezas: number }> = {};

        const addConsumo = (mpId: number, nombre: string, unidad: string, pesoNeto: number, g: number, p: number) => {
          if (!consumo[mpId]) consumo[mpId] = { nombre, unidad, pesoNeto: pesoNeto || 0, gramos: 0, piezas: 0 };
          consumo[mpId].gramos += g;
          consumo[mpId].piezas += p;
        };

        for (const r of (recetasMP[0] as any[])) {
          const vendido = ventasMap[r.productoVentaId] || 0;
          if (vendido === 0) continue;
          addConsumo(r.materiasPrimaId, r.nombre, r.unidadCompra, r.pesoNetoPorUnidad || 0,
            (r.cantidadGramos || 0) * vendido,
            (r.cantidadPiezas || 0) * vendido);
        }

        for (const r of (recetasSP[0] as any[])) {
          const vendido = ventasMap[r.productoVentaId] || 0;
          if (vendido === 0) continue;
          const factor = r.rendimientoGramos > 0 ? (r.cantSubproducto * vendido) / r.rendimientoGramos : 0;
          addConsumo(r.materiasPrimaId, r.nombre, r.unidadCompra, r.pesoNetoPorUnidad || 0,
            (r.cantMP || 0) * factor,
            (r.piezasMP || 0) * factor);
        }

        // 4b. Toppings pool: 46g por vaso vendido + Topping Extra
        const TOPPING_GRAMOS_POR_VASO = 46;
        const ID_TOPPING_EXTRA = await db.execute(sql`SELECT id FROM inv_productos_venta WHERE nombre='Topping Extra' LIMIT 1`);
        const idToppingExtra = ((ID_TOPPING_EXTRA[0] as any[])[0]?.id) ?? null;

        let totalVasos = 0;
        let toppingExtras = 0;
        for (const [pvId, qty] of Object.entries(ventasMap)) {
          if (idToppingExtra && Number(pvId) === idToppingExtra) {
            toppingExtras += qty;
          } else {
            totalVasos += qty;
          }
        }
        const totalToppingG = (totalVasos + toppingExtras) * TOPPING_GRAMOS_POR_VASO;

        if (totalToppingG > 0) {
          // Agregar como linea especial de toppings pool
          consumo[999999] = {
            nombre: "Toppings Pool (Isla) — Perlas + Tapioca",
            unidad: "g",
            pesoNeto: 1,
            gramos: totalToppingG,
            piezas: 0,
          };
        }

        // 5. Convertir a unidades de compra
        const resultado = Object.entries(consumo).map(([mpId, data]) => ({
          materiasPrimaId: Number(mpId),
          nombre: data.nombre,
          unidad: data.unidad,
          consumoGramos: Math.round(data.gramos * 100) / 100,
          consumoPiezas: Math.round(data.piezas * 100) / 100,
          consumoUnidades: data.pesoNeto > 0
            ? Math.round((data.gramos / data.pesoNeto) * 1000) / 1000
            : Math.round(data.piezas * 100) / 100,
        })).sort((a, b) => a.nombre.localeCompare(b.nombre));

        return resultado;
      }),


    // Pronóstico de surtido 15 días
    pronosticoSurtido: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        diasProyeccion: z.number().default(15),
        diasHistorico: z.number().default(28),
        bufferPct: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const now = new Date();
        const fechaFin = now.toISOString().split("T")[0];
        const fechaIni = new Date(now.getTime() - input.diasHistorico * 86400000).toISOString().split("T")[0];

        const ventas = await db.execute(sql`
          SELECT vc.productoVentaId, SUM(vc.cantidad) as totalVendido
          FROM inv_ventas_captura vc
          WHERE vc.sucursalId=${input.sucursalId} AND vc.fecha BETWEEN ${fechaIni} AND ${fechaFin}
          GROUP BY vc.productoVentaId
        `);
        const ventasMap: Record<number,number> = {};
        let totalVasosHist = 0;
        for (const v of (ventas[0] as any[])) {
          ventasMap[v.productoVentaId] = Number(v.totalVendido);
          totalVasosHist += Number(v.totalVendido);
        }
        const promedioDiario = totalVasosHist / input.diasHistorico;
        const factor = (input.diasProyeccion / input.diasHistorico) * (1 + input.bufferPct / 100);

        const recetasMP = await db.execute(sql`
          SELECT r.productoVentaId, r.materiasPrimaId, r.cantidadGramos, r.cantidadPiezas,
                 p.nombre, p.categoria, p.unidadConteo, p.unidadCompra, p.pesoNetoPorUnidad, p.factorConversion, p.piezasPorUnidadConteo
          FROM inv_recetas r JOIN inv_productos p ON p.id = r.materiasPrimaId
          WHERE r.esSubproducto=0 AND r.materiasPrimaId IS NOT NULL
        `);
        const recetasSP = await db.execute(sql`
          SELECT r.productoVentaId, r.subproductoId, r.cantidadGramos as cantSP,
                 sr.materiasPrimaId, sr.cantidadGramos as cantMP, sr.cantidadPiezas as pzMP,
                 s.rendimientoGramos, p.nombre, p.categoria, p.unidadConteo, p.unidadCompra, p.pesoNetoPorUnidad, p.factorConversion, p.piezasPorUnidadConteo
          FROM inv_recetas r
          JOIN inv_subproductos s ON s.id=r.subproductoId
          JOIN inv_subproductos_receta sr ON sr.subproductoId=s.id
          JOIN inv_productos p ON p.id=sr.materiasPrimaId
          WHERE r.esSubproducto=1
        `);

        const consumo: Record<number,{nombre:string;categoria:string;unidad:string;unidadCompra:string;pesoNeto:number;factorConv:number;ppc:number;gramos:number;piezas:number}> = {};
        const add = (id:number,n:string,cat:string,u:string,uc:string,pn:number,fc2:number,ppc2:number,g:number,p:number) => {
          if (!consumo[id]) consumo[id]={nombre:n,categoria:cat,unidad:u,unidadCompra:uc||u,pesoNeto:pn||0,factorConv:fc2||1,ppc:ppc2||1,gramos:0,piezas:0};
          consumo[id].gramos+=g; consumo[id].piezas+=p;
        };
        for (const r of (recetasMP[0] as any[])) {
          const v=ventasMap[r.productoVentaId]||0; if(!v) continue;
          add(r.materiasPrimaId,r.nombre,r.categoria,r.unidadConteo,r.unidadCompra,r.pesoNetoPorUnidad||0,r.factorConversion||1,r.piezasPorUnidadConteo||1,(r.cantidadGramos||0)*v,(r.cantidadPiezas||0)*v);
        }
        for (const r of (recetasSP[0] as any[])) {
          const v=ventasMap[r.productoVentaId]||0; if(!v) continue;
          const f2=r.rendimientoGramos>0?(r.cantSP*v)/r.rendimientoGramos:0;
          add(r.materiasPrimaId,r.nombre,r.categoria,r.unidadConteo,r.unidadCompra,r.pesoNetoPorUnidad||0,r.factorConversion||1,r.piezasPorUnidadConteo||1,(r.cantMP||0)*f2,(r.pzMP||0)*f2);
        }

        // ── Fuente 2: Tapioca desde tabla preparaciones (gramos reales preparados) ──
        const prepTapioca = await db.execute(sql`
          SELECT SUM(CAST(cantidad AS DECIMAL(10,2))) as totalG
          FROM preparaciones
          WHERE sucursalId=${input.sucursalId}
            AND receta='tapioca' AND unidad='gr'
            AND preparadaAt >= ${fechaIni} AND preparadaAt <= CONCAT(${fechaFin},' 23:59:59')
        `);
        const tapiocaGramos = Number((prepTapioca[0] as any[])[0]?.totalG || 0);
        if (tapiocaGramos > 0) {
          const tpRes = await db.execute(sql`
            SELECT id, nombre, categoria, unidadConteo, unidadCompra,
                   pesoNetoPorUnidad, factorConversion, piezasPorUnidadConteo
            FROM inv_productos WHERE nombre LIKE '%apioca%2.7%' AND activo=1 LIMIT 1
          `);
          const tp = (tpRes[0] as any[])[0];
          if (tp) add(Number(tp.id), tp.nombre, tp.categoria, tp.unidadConteo, tp.unidadCompra,
            Number(tp.pesoNetoPorUnidad)||0, Number(tp.factorConversion)||1, Number(tp.piezasPorUnidadConteo)||1,
            tapiocaGramos, 0);
        }

        // ── Fuente 3: Ingredientes de base_snowtea / jarabe_longan / sustituto_azucar desde preparaciones ──
        const prepCounts = await db.execute(sql`
          SELECT receta, cantidad, COUNT(*) as veces
          FROM preparaciones
          WHERE sucursalId=${input.sucursalId}
            AND receta IN ('base_snowtea','jarabe_longan','sustituto_azucar')
            AND preparadaAt >= ${fechaIni} AND preparadaAt <= CONCAT(${fechaFin},' 23:59:59')
          GROUP BY receta, cantidad
        `);

        const subpRecipes = await db.execute(sql`
          SELECT s.nombre as spNombre, sr.materiasPrimaId, sr.cantidadGramos,
                 p.nombre as mpNombre, p.categoria, p.unidadConteo, p.unidadCompra,
                 p.pesoNetoPorUnidad, p.factorConversion, p.piezasPorUnidadConteo
          FROM inv_subproductos s
          JOIN inv_subproductos_receta sr ON sr.subproductoId = s.id
          JOIN inv_productos p ON p.id = sr.materiasPrimaId
          WHERE s.nombre IN ('Base Snowtea','Base Snowtea Media Carga','Longan','Longan Media Carga','Sustituto de Azucar','Sustituto de Azucar Media Carga')
        `);

        const subpMap: Record<string, {materiasPrimaId:number;cantidadGramos:number;nombre:string;categoria:string;unidadConteo:string;unidadCompra:string;pesoNeto:number;fc:number;ppc:number}[]> = {};
        for (const r of (subpRecipes[0] as any[])) {
          if (!subpMap[r.spNombre]) subpMap[r.spNombre] = [];
          subpMap[r.spNombre].push({
            materiasPrimaId: Number(r.materiasPrimaId), cantidadGramos: Number(r.cantidadGramos),
            nombre: r.mpNombre, categoria: r.categoria, unidadConteo: r.unidadConteo,
            unidadCompra: r.unidadCompra, pesoNeto: Number(r.pesoNetoPorUnidad)||0,
            fc: Number(r.factorConversion)||1, ppc: Number(r.piezasPorUnidadConteo)||1
          });
        }

        const RECETA_TO_SP: Record<string, Record<string, string>> = {
          base_snowtea:     { carga_completa: 'Base Snowtea',             media_carga: 'Base Snowtea Media Carga' },
          jarabe_longan:    { carga_completa: 'Longan',                   media_carga: 'Longan Media Carga' },
          sustituto_azucar: { carga_completa: 'Sustituto de Azucar',      media_carga: 'Sustituto de Azucar Media Carga' },
        };

        for (const row of (prepCounts[0] as any[])) {
          const spNombre = RECETA_TO_SP[row.receta]?.[row.cantidad];
          if (!spNombre) continue;
          const ingredientes = subpMap[spNombre];
          if (!ingredientes) continue;
          for (const ing of ingredientes) {
            add(ing.materiasPrimaId, ing.nombre, ing.categoria, ing.unidadConteo, ing.unidadCompra,
              ing.pesoNeto, ing.fc, ing.ppc, ing.cantidadGramos * Number(row.veces), 0);
          }
        }

        // ── Fuente 4: Perlas Explosivas → 46g por vaso, ponderado por consumo estimado (inverso de stock) ──
        const GR_PERLAS_POR_VASO = 46;
        const gramosPerlasTotales = totalVasosHist * GR_PERLAS_POR_VASO;
        const perlasActRes = await db.execute(sql`
          SELECT p.id, p.nombre, p.categoria, p.unidadConteo, p.unidadCompra,
                 p.pesoNetoPorUnidad, p.factorConversion, p.piezasPorUnidadConteo,
                 COALESCE(cd.cantidadPiezas, 0) as stockPiezas
          FROM inv_productos p
          LEFT JOIN inv_conteo_detalle cd ON cd.productoId = p.id
            AND cd.conteoId = (
              SELECT MAX(cf2.id) FROM inv_conteo_fisico cf2
              JOIN inv_conteo_detalle cd2 ON cd2.conteoId = cf2.id
              WHERE cd2.productoId = p.id AND cf2.sucursalId=${input.sucursalId}
                AND cf2.estado IN ('enviado','bloqueado')
            )
          WHERE p.nombre LIKE '%erlas%' AND p.activo=1
        `);
        const perlasActivas2 = (perlasActRes[0] as any[]);
        if (perlasActivas2.length > 0 && gramosPerlasTotales > 0) {
          // Historial real de surtidos (90 días) para ponderar por sabor
          const surtidoHist = await db.execute(sql`
            SELECT sd.productoId, SUM(sd.cantidadPiezas) as totalSurtido
            FROM inv_surtido_detalle sd
            JOIN inv_surtidos s ON s.id = sd.surtidoId
            JOIN inv_productos p ON p.id = sd.productoId
            WHERE p.nombre LIKE '%erlas%' AND s.estado='confirmado'
              AND s.sucursalId=${input.sucursalId}
              AND s.fecha >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY sd.productoId
          `);
          const surtidoMap: Record<number,number> = {};
          for (const r of (surtidoHist[0] as any[])) surtidoMap[Number(r.productoId)] = Number(r.totalSurtido);
          const hayHistorial = Object.keys(surtidoMap).length >= 2;
          let pesos: number[];
          if (hayHistorial) {
            pesos = perlasActivas2.map((p: any) => surtidoMap[Number(p.id)] || 1);
          } else {
            const maxStock = Math.max(...perlasActivas2.map((p: any) => Number(p.stockPiezas)));
            pesos = perlasActivas2.map((p: any) => maxStock - Number(p.stockPiezas) + 1);
          }
          const sumaPesos = pesos.reduce((a: number, b: number) => a + b, 0);
          for (let i = 0; i < perlasActivas2.length; i++) {
            const p = perlasActivas2[i];
            const gSabor = gramosPerlasTotales * (pesos[i] / sumaPesos);
            add(Number(p.id), p.nombre, p.categoria, p.unidadConteo, p.unidadCompra,
              Number(p.pesoNetoPorUnidad)||0, Number(p.factorConversion)||1, Number(p.piezasPorUnidadConteo)||1,
              gSabor, 0);
          }
        }

        const getStock = async (almNombre: string) => {
          const alm = await db.execute(sql`SELECT id FROM inv_almacenes WHERE sucursalId=${input.sucursalId} AND nombre LIKE ${"%"+almNombre+"%"} AND activo=1 LIMIT 1`);
          const almId = (alm[0] as any[])[0]?.id; if(!almId) return {};
          const ct = await db.execute(sql`SELECT id FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${almId} AND estado IN ('enviado','bloqueado') ORDER BY fechaConteo DESC, id DESC LIMIT 1`);
          const ctId = (ct[0] as any[])[0]?.id; if(!ctId) return {};
          const det = await db.execute(sql`SELECT productoId, cantidadPiezas, cantidadGramos FROM inv_conteo_detalle WHERE conteoId=${ctId}`);
          const m: Record<number,{p:number;g:number}> = {};
          for (const d of (det[0] as any[])) m[d.productoId]={p:Number(d.cantidadPiezas||0),g:Number(d.cantidadGramos||0)};
          return m;
        };
        const sBodega = await getStock("odega");
        const sIsla   = await getStock("sla");

        const items = Object.entries(consumo).map(([idStr,data]) => {
          const id=Number(idStr);
          const consProyG = data.gramos * factor;
          const sb=sBodega[id]||{p:0,g:0}; const si=sIsla[id]||{p:0,g:0};
          const stockBG = sb.p*(data.pesoNeto||1)+sb.g;
          const stockIG = si.p*(data.pesoNeto||1)+si.g;
          const stockTG = stockBG+stockIG;
          const cdDia = data.gramos/input.diasHistorico;
          const diasCob = cdDia>0?Math.round(stockTG/cdDia):999;
          const necesG = Math.max(0,consProyG-stockTG);
          const necesPzas = data.pesoNeto>0?Math.ceil(necesG/data.pesoNeto*10)/10:Math.ceil(data.piezas*factor-(sb.p+si.p));
          const estado = diasCob<=7?"urgente":diasCob<=15?"surtir":"ok";
          // Determinar si es producto basado en piezas (desechables) o gramos (ingredientes)
          const isPiezas = data.gramos === 0 && data.piezas > 0;
          const fc = data.factorConv || 1;

          let stockTotal: number;
          let consumoProyectado: number;
          let consumoDiario: number;
          if (isPiezas) {
            const ppc = data.ppc || 1;
            stockTotal = (sb.p + si.p) * ppc;
            consumoDiario = data.piezas / input.diasHistorico;
            consumoProyectado = data.piezas * factor;

          } else {
            // Stock en gramos
            stockTotal = sb.p*(data.pesoNeto||1)+sb.g + si.p*(data.pesoNeto||1)+si.g;
            consumoDiario = data.gramos / input.diasHistorico;
            consumoProyectado = data.gramos * factor;
          }

          const diasCob2 = consumoDiario > 0 ? Math.round(stockTotal / consumoDiario) : 999;
          const necesidad = Math.max(0, consumoProyectado - stockTotal);

          let necesidadFinal: number;
          if (isPiezas) {
            // Convertir piezas individuales necesarias → unidades contadas → múltiplo de fc
            const necesUConteo = necesidad / fc;
            necesidadFinal = Math.ceil(necesidad / fc) * fc;
          } else {
            // Convertir gramos necesarios → unidades contadas → múltiplo de factorConversion
            const necesUConteo = data.pesoNeto > 0 ? necesidad / data.pesoNeto : necesidad;
            necesidadFinal = Math.ceil(necesUConteo / fc) * fc;
          }

          const consumoPiezasDisplay = isPiezas
            ? Math.round(consumoProyectado * 10) / 10
            : Math.round(data.pesoNeto > 0 ? consumoProyectado / data.pesoNeto * 10 : data.piezas * factor * 10) / 10;

          const estado2 = diasCob2 <= 7 ? "urgente" : diasCob2 <= 15 ? "surtir" : "ok";

          return {id,nombre:data.nombre,categoria:data.categoria||"Varios",unidad:data.unidad,unidadCompra:data.unidadCompra||data.unidad,pesoNeto:data.pesoNeto,factorConversion:data.factorConv||1,ppc:data.ppc||1,factorConversion:data.factorConv||1,
            // Mostrar stock en unidades contadas incluyendo gramos parciales
            stockBodegaPiezas: isPiezas ? sb.p : (data.pesoNeto > 0 ? Math.round((sb.p * data.pesoNeto + sb.g) / data.pesoNeto * 100) / 100 : sb.p),
            stockIslaPiezas:   isPiezas ? si.p : (data.pesoNeto > 0 ? Math.round((si.p * data.pesoNeto + si.g) / data.pesoNeto * 100) / 100 : si.p),
            stockTotalG:Math.round(stockTotal),
            consumoPiezas:consumoPiezasDisplay,
            diasCobertura:diasCob2,
            necesidadPiezas:Math.round(necesidadFinal*10)/10,
            pedirCajas: fc > 1 ? Math.ceil(necesidadFinal / fc) : Math.round(necesidadFinal*10)/10,
            estado:estado2};
        }).filter(i=>i.consumoPiezas>0||i.stockTotalG>0).sort((a,b)=>{
          const o:Record<string,number>={urgente:0,surtir:1,ok:2};
          return (o[a.estado]-o[b.estado])||a.nombre.localeCompare(b.nombre);
        });

        return { sucursalId:input.sucursalId,fechaInicio:fechaIni,fechaFin,
          diasHistorico:input.diasHistorico,diasProyeccion:input.diasProyeccion,bufferPct:input.bufferPct,
          promedioDiario:Math.round(promedioDiario*10)/10,totalVasosHistorico:totalVasosHist,items };
      }),

    // ─── Surtido / Restock ────────────────────────────────────────────────────


    // Crear o actualizar un surtido (borrador)
    surtidoGuardar: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        sucursalId: z.number(),
        fecha: z.string(),
        notas: z.string().optional(),
        items: z.array(z.object({
          productoId: z.number(),
          cantidadPiezas: z.number().default(0),
          cantidadGramos: z.number().default(0),
          notas: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });

        let surtidoId = input.id;
        if (surtidoId) {
          await db.execute(sql`
            UPDATE inv_surtidos SET fecha=${input.fecha}, notas=${input.notas??''}, updatedAt=NOW()
            WHERE id=${surtidoId} AND estado='borrador'
          `);
          await db.execute(sql`DELETE FROM inv_surtido_detalle WHERE surtidoId=${surtidoId}`);
        } else {
          const r = await db.execute(sql`
            INSERT INTO inv_surtidos (sucursalId, fecha, estado, notas, creadoPorId)
            VALUES (${input.sucursalId}, ${input.fecha}, 'borrador', ${input.notas??''}, ${ctx.user.id})
          `);
          surtidoId = (r[0] as any).insertId;
        }
        for (const item of input.items) {
          if (item.cantidadPiezas > 0 || item.cantidadGramos > 0) {
            await db.execute(sql`
              INSERT INTO inv_surtido_detalle (surtidoId, productoId, cantidadPiezas, cantidadGramos, notas)
              VALUES (${surtidoId}, ${item.productoId}, ${item.cantidadPiezas}, ${item.cantidadGramos}, ${item.notas??''})
            `);
          }
        }
        return { ok: true, id: surtidoId };
      }),

    // Confirmar surtido: actualiza stock en inv_conteo_detalle del almacen bodega
    surtidoConfirmar: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });

        // Obtener surtido
        const surtRows = await db.execute(sql`SELECT * FROM inv_surtidos WHERE id=${input.id} LIMIT 1`);
        const surt = (surtRows[0] as any[])[0];
        if (!surt) throw new TRPCError({ code: "NOT_FOUND" });
        if (surt.estado === 'confirmado') throw new TRPCError({ code: "BAD_REQUEST", message: "Ya fue confirmado" });

        // Obtener detalle
        const detalles = await db.execute(sql`SELECT * FROM inv_surtido_detalle WHERE surtidoId=${input.id}`);

        // Obtener ultimo conteo de bodega
        const almRows = await db.execute(sql`
          SELECT id FROM inv_almacenes WHERE sucursalId=${surt.sucursalId} AND nombre LIKE '%odega%' AND activo=1 LIMIT 1
        `);
        const almId = (almRows[0] as any[])[0]?.id;

        if (almId) {
          const conteoRows = await db.execute(sql`
            SELECT id FROM inv_conteo_fisico
            WHERE sucursalId=${surt.sucursalId} AND almacenId=${almId}
            ORDER BY fechaConteo DESC LIMIT 1
          `);
          const conteoId = (conteoRows[0] as any[])[0]?.id;

          if (conteoId) {
            for (const d of (detalles[0] as any[])) {
              if (d.cantidadPiezas > 0) {
                // Sumar al conteo existente
                const existe = await db.execute(sql`
                  SELECT id, cantidadPiezas FROM inv_conteo_detalle
                  WHERE conteoId=${conteoId} AND productoId=${d.productoId} LIMIT 1
                `);
                if ((existe[0] as any[]).length > 0) {
                  const actual = Number((existe[0] as any[])[0].cantidadPiezas);
                  await db.execute(sql`
                    UPDATE inv_conteo_detalle SET cantidadPiezas=${actual + d.cantidadPiezas}
                    WHERE conteoId=${conteoId} AND productoId=${d.productoId}
                  `);
                } else {
                  await db.execute(sql`
                    INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos)
                    VALUES (${conteoId}, ${d.productoId}, ${d.cantidadPiezas}, 0)
                  `);
                }
              }
            }
          }
        }

        await db.execute(sql`UPDATE inv_surtidos SET estado='confirmado', updatedAt=NOW() WHERE id=${input.id}`);
        return { ok: true };
      }),

    // Historial de surtidos
    surtidoHistorial: protectedProcedure
      .input(z.object({ sucursalId: z.number(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db.execute(sql`
          SELECT s.id, s.fecha, s.estado, s.notas, s.createdAt,
                 u.name as creadoPorNombre,
                 COUNT(sd.id) as numProductos,
                 SUM(sd.cantidadPiezas) as totalPiezas
          FROM inv_surtidos s
          LEFT JOIN users u ON u.id = s.creadoPorId
          LEFT JOIN inv_surtido_detalle sd ON sd.surtidoId = s.id
          WHERE s.sucursalId = ${input.sucursalId}
          GROUP BY s.id
          ORDER BY s.createdAt DESC
          LIMIT ${input.limit}
        `);
        return (rows[0] as any[]);
      }),

    // Detalle de un surtido
    surtidoDetalle: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const surtRows = await db.execute(sql`SELECT * FROM inv_surtidos WHERE id=${input.id} LIMIT 1`);
        const surt = (surtRows[0] as any[])[0];
        if (!surt) throw new TRPCError({ code: "NOT_FOUND" });
        const detalles = await db.execute(sql`
          SELECT sd.*, p.nombre, p.unidadCompra, p.categoria
          FROM inv_surtido_detalle sd
          JOIN inv_productos p ON p.id = sd.productoId
          WHERE sd.surtidoId = ${input.id}
          ORDER BY p.categoria, p.nombre
        `);
        return { ...surt, items: (detalles[0] as any[]) };
      }),

    // Transferir stock de bodega a isla
    surtidoIslaConfirmar: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        items: z.array(z.object({ productoId: z.number(), cantidad: z.number() })),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const getCteo = async (tipo: string) => {
          const alm = await db.execute(sql`SELECT id FROM inv_almacenes WHERE sucursalId=${input.sucursalId} AND nombre LIKE ${"%"+tipo+"%"} AND activo=1 LIMIT 1`);
          const almId = (alm[0] as any[])[0]?.id; if (!almId) return null;
          const ct = await db.execute(sql`SELECT id FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${almId} ORDER BY fechaConteo DESC, id DESC LIMIT 1`);
          return (ct[0] as any[])[0]?.id ?? null;
        };
        const bodegaId = await getCteo("odega");
        const islaId   = await getCteo("sla");
        if (!bodegaId) throw new TRPCError({ code: "NOT_FOUND", message: "Sin conteo de bodega registrado" });
        if (!islaId)   throw new TRPCError({ code: "NOT_FOUND", message: "Sin conteo de isla registrado" });

        for (const item of input.items) {
          if (item.cantidad <= 0) continue;
          // Restar de bodega
          const b = await db.execute(sql`SELECT id, cantidadPiezas FROM inv_conteo_detalle WHERE conteoId=${bodegaId} AND productoId=${item.productoId} LIMIT 1`);
          if ((b[0] as any[]).length > 0) {
            const nuevo = Math.max(0, Number((b[0] as any[])[0].cantidadPiezas) - item.cantidad);
            await db.execute(sql`UPDATE inv_conteo_detalle SET cantidadPiezas=${nuevo} WHERE conteoId=${bodegaId} AND productoId=${item.productoId}`);
          }
          // Sumar a isla
          const is = await db.execute(sql`SELECT id, cantidadPiezas FROM inv_conteo_detalle WHERE conteoId=${islaId} AND productoId=${item.productoId} LIMIT 1`);
          if ((is[0] as any[]).length > 0) {
            const nuevo = Number((is[0] as any[])[0].cantidadPiezas) + item.cantidad;
            await db.execute(sql`UPDATE inv_conteo_detalle SET cantidadPiezas=${nuevo} WHERE conteoId=${islaId} AND productoId=${item.productoId}`);
          } else {
            await db.execute(sql`INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${islaId}, ${item.productoId}, ${item.cantidad}, 0)`);
          }
        }
        // Registrar en historial de surtidos
        const fecha = new Date().toISOString().split("T")[0];
        const r = await db.execute(sql`INSERT INTO inv_surtidos (sucursalId, fecha, estado, notas, creadoPorId) VALUES (${input.sucursalId}, ${fecha}, 'confirmado', ${`[ISLA] ${input.notas ?? ''}`}, ${ctx.user.id})`);
        const sid = (r[0] as any).insertId;
        for (const i of input.items) {
          if (i.cantidad > 0) await db.execute(sql`INSERT INTO inv_surtido_detalle (surtidoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${sid}, ${i.productoId}, ${i.cantidad}, 0)`);
        }
        return { ok: true };
      }),

    // Transferir stock de bodega a isla
    surtidoIslaConfirmar: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        items: z.array(z.object({ productoId: z.number(), cantidad: z.number() })),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const getCteo = async (tipo: string) => {
          const alm = await db.execute(sql`SELECT id FROM inv_almacenes WHERE sucursalId=${input.sucursalId} AND nombre LIKE ${"%"+tipo+"%"} AND activo=1 LIMIT 1`);
          const almId = (alm[0] as any[])[0]?.id; if (!almId) return null;
          const ct = await db.execute(sql`SELECT id FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${almId} ORDER BY fechaConteo DESC, id DESC LIMIT 1`);
          return (ct[0] as any[])[0]?.id ?? null;
        };
        const bodegaId = await getCteo("odega");
        const islaId   = await getCteo("sla");
        if (!bodegaId) throw new TRPCError({ code: "NOT_FOUND", message: "Sin conteo de bodega registrado" });
        if (!islaId)   throw new TRPCError({ code: "NOT_FOUND", message: "Sin conteo de isla registrado" });

        for (const item of input.items) {
          if (item.cantidad <= 0) continue;
          // Restar de bodega
          const b = await db.execute(sql`SELECT id, cantidadPiezas FROM inv_conteo_detalle WHERE conteoId=${bodegaId} AND productoId=${item.productoId} LIMIT 1`);
          if ((b[0] as any[]).length > 0) {
            const nuevo = Math.max(0, Number((b[0] as any[])[0].cantidadPiezas) - item.cantidad);
            await db.execute(sql`UPDATE inv_conteo_detalle SET cantidadPiezas=${nuevo} WHERE conteoId=${bodegaId} AND productoId=${item.productoId}`);
          }
          // Sumar a isla
          const is = await db.execute(sql`SELECT id, cantidadPiezas FROM inv_conteo_detalle WHERE conteoId=${islaId} AND productoId=${item.productoId} LIMIT 1`);
          if ((is[0] as any[]).length > 0) {
            const nuevo = Number((is[0] as any[])[0].cantidadPiezas) + item.cantidad;
            await db.execute(sql`UPDATE inv_conteo_detalle SET cantidadPiezas=${nuevo} WHERE conteoId=${islaId} AND productoId=${item.productoId}`);
          } else {
            await db.execute(sql`INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${islaId}, ${item.productoId}, ${item.cantidad}, 0)`);
          }
        }
        // Registrar en historial de surtidos
        const fecha = new Date().toISOString().split("T")[0];
        const r = await db.execute(sql`INSERT INTO inv_surtidos (sucursalId, fecha, estado, notas, creadoPorId) VALUES (${input.sucursalId}, ${fecha}, 'confirmado', ${`[ISLA] ${input.notas ?? ''}`}, ${ctx.user.id})`);
        const sid = (r[0] as any).insertId;
        for (const i of input.items) {
          if (i.cantidad > 0) await db.execute(sql`INSERT INTO inv_surtido_detalle (surtidoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${sid}, ${i.productoId}, ${i.cantidad}, 0)`);
        }
        return { ok: true };
      }),

    // Ajustar cantidades de un surtido ya confirmado (ej: proveedor surtió de más/menos)
    surtidoAjustar: protectedProcedure
      .input(z.object({
        surtidoId: z.number(),
        items: z.array(z.object({
          productoId: z.number(),
          cantidadNueva: z.number().min(0),
        })),
        motivo: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });

        // Obtener surtido y verificar que esté confirmado
        const surtRows = await db.execute(sql`SELECT * FROM inv_surtidos WHERE id=${input.surtidoId} LIMIT 1`);
        const surt = (surtRows[0] as any[])[0];
        if (!surt) throw new TRPCError({ code: "NOT_FOUND" });
        if (surt.estado !== "confirmado")
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden ajustar surtidos confirmados" });

        // Obtener último conteo de bodega
        const almRows = await db.execute(sql`
          SELECT id FROM inv_almacenes WHERE sucursalId=${surt.sucursalId} AND nombre LIKE '%odega%' AND activo=1 LIMIT 1
        `);
        const almId = (almRows[0] as any[])[0]?.id;
        let bodegaCteoId: number | null = null;
        if (almId) {
          const ctRows = await db.execute(sql`
            SELECT id FROM inv_conteo_fisico WHERE sucursalId=${surt.sucursalId} AND almacenId=${almId}
            ORDER BY fechaConteo DESC LIMIT 1
          `);
          bodegaCteoId = (ctRows[0] as any[])[0]?.id ?? null;
        }

        for (const item of input.items) {
          // Obtener cantidad original en surtido_detalle
          const detRows = await db.execute(sql`
            SELECT id, cantidadPiezas FROM inv_surtido_detalle
            WHERE surtidoId=${input.surtidoId} AND productoId=${item.productoId} LIMIT 1
          `);
          const det = (detRows[0] as any[])[0];
          if (!det) {
            // Producto nuevo — no estaba en el surtido original, se agrega
            if (item.cantidadNueva <= 0) continue;
            await db.execute(sql`
              INSERT INTO inv_surtido_detalle (surtidoId, productoId, cantidadPiezas, cantidadGramos)
              VALUES (${input.surtidoId}, ${item.productoId}, ${item.cantidadNueva}, 0)
            `);
            if (bodegaCteoId) {
              const bNew = await db.execute(sql`SELECT id, cantidadPiezas FROM inv_conteo_detalle WHERE conteoId=${bodegaCteoId} AND productoId=${item.productoId} LIMIT 1`);
              if ((bNew[0] as any[]).length > 0) {
                const act = Number((bNew[0] as any[])[0].cantidadPiezas);
                await db.execute(sql`UPDATE inv_conteo_detalle SET cantidadPiezas=${act + item.cantidadNueva} WHERE conteoId=${bodegaCteoId} AND productoId=${item.productoId}`);
              } else {
                await db.execute(sql`INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${bodegaCteoId}, ${item.productoId}, ${item.cantidadNueva}, 0)`);
              }
            }
            continue;
          }
          const cantidadOriginal = Number(det.cantidadPiezas);
          const delta = item.cantidadNueva - cantidadOriginal;
          if (delta === 0) continue;

          // Actualizar detalle del surtido
          await db.execute(sql`
            UPDATE inv_surtido_detalle SET cantidadPiezas=${item.cantidadNueva}
            WHERE surtidoId=${input.surtidoId} AND productoId=${item.productoId}
          `);

          // Aplicar delta al conteo de bodega
          if (bodegaCteoId && delta !== 0) {
            const bdRows = await db.execute(sql`
              SELECT id, cantidadPiezas FROM inv_conteo_detalle
              WHERE conteoId=${bodegaCteoId} AND productoId=${item.productoId} LIMIT 1
            `);
            if ((bdRows[0] as any[]).length > 0) {
              const actual = Number((bdRows[0] as any[])[0].cantidadPiezas);
              const nuevo  = Math.max(0, actual + delta);
              await db.execute(sql`
                UPDATE inv_conteo_detalle SET cantidadPiezas=${nuevo}
                WHERE conteoId=${bodegaCteoId} AND productoId=${item.productoId}
              `);
            } else if (delta > 0) {
              await db.execute(sql`
                INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos)
                VALUES (${bodegaCteoId}, ${item.productoId}, ${delta}, 0)
              `);
            }
          }
        }

        // Agregar nota de ajuste al surtido
        const notaAjuste = `[AJUSTE ${new Date().toLocaleDateString("es-MX")}] ${input.motivo ?? "Sin motivo"} — por ${ctx.user.name ?? ctx.user.id}`;
        await db.execute(sql`
          UPDATE inv_surtidos SET notas=CONCAT(COALESCE(notas,''), ${" | " + notaAjuste})
          WHERE id=${input.surtidoId}
        `);
        return { ok: true };
      }),

    // Renombrar producto de venta
    renombrar: protectedProcedure
      .input(z.object({ id: z.number(), nombre: z.string(), sabor: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`UPDATE inv_productos_venta SET nombre=${input.nombre}, sabor=${input.sabor} WHERE id=${input.id}`);
        return { ok: true };
      }),



    // Eliminar producto de venta
    eliminarProducto: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`DELETE FROM inv_recetas WHERE productoVentaId = ${input.id}`);
        await db.execute(sql`DELETE FROM inv_ventas_captura WHERE productoVentaId = ${input.id}`);
        await db.execute(sql`DELETE FROM inv_productos_venta WHERE id = ${input.id}`);
        return { ok: true };
      }),

    // Crear nuevo producto de venta

    crearProducto: protectedProcedure
      .input(z.object({ nombre: z.string().min(1), sabor: z.string().default("") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`INSERT INTO inv_productos_venta (nombre, sabor) VALUES (${input.nombre}, ${input.sabor})`);
        return { ok: true };
      }),

    // Copiar receta de un producto a otro

    copiarReceta: protectedProcedure
      .input(z.object({ origenId: z.number(), destinoId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`DELETE FROM inv_recetas WHERE productoVentaId = ${input.destinoId}`);
        await db.execute(sql`
          INSERT INTO inv_recetas (productoVentaId, materiasPrimaId, subproductoId, cantidadGramos, cantidadPiezas, esSubproducto)
          SELECT ${input.destinoId}, materiasPrimaId, subproductoId, cantidadGramos, cantidadPiezas, esSubproducto
          FROM inv_recetas WHERE productoVentaId = ${input.origenId}
        `);
        return { ok: true };
      }),
  },

  // ── Recetas ────────────────────────────────────────────────────────────────
  recetas: {
    // Listar recetas de un producto de venta
    getByProducto: protectedProcedure
      .input(z.object({ productoVentaId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT r.id, r.materiasPrimaId, r.subproductoId, r.cantidadGramos, r.cantidadPiezas, r.esSubproducto,
                 p.nombre as mpNombre, s.nombre as spNombre
          FROM inv_recetas r
          LEFT JOIN inv_productos p ON p.id = r.materiasPrimaId
          LEFT JOIN inv_subproductos s ON s.id = r.subproductoId
          WHERE r.productoVentaId = ${input.productoVentaId}
          ORDER BY r.esSubproducto DESC, p.nombre
        `);
        return (rows[0] as any[]);
      }),

    // Guardar receta completa de un producto (reemplaza todo)
    guardar: protectedProcedure
      .input(z.object({
        productoVentaId: z.number(),
        lineas: z.array(z.object({
          materiasPrimaId: z.number().nullable().optional(),
          subproductoId: z.number().nullable().optional(),
          cantidadGramos: z.number().default(0),
          cantidadPiezas: z.number().default(0),
          esSubproducto: z.coerce.boolean().default(false),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`DELETE FROM inv_recetas WHERE productoVentaId = ${input.productoVentaId}`);
        for (const l of input.lineas) {
          await db.execute(sql`
            INSERT INTO inv_recetas (productoVentaId, materiasPrimaId, subproductoId, cantidadGramos, cantidadPiezas, esSubproducto)
            VALUES (${input.productoVentaId}, ${l.materiasPrimaId ?? null}, ${l.subproductoId ?? null},
                    ${l.cantidadGramos}, ${l.cantidadPiezas}, ${l.esSubproducto ? 1 : 0})
          `);
        }
        return { ok: true };
      }),

    // Listar subproductos disponibles
    listSubproductos: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`SELECT id, nombre, rendimientoGramos FROM inv_subproductos WHERE activo=1`);
        return (rows[0] as any[]);
      }),

    // Recetas de subproductos
    getSubproductoReceta: protectedProcedure
      .input(z.object({ subproductoId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const rows = await db.execute(sql`
          SELECT sr.id, sr.materiasPrimaId, sr.cantidadGramos, sr.cantidadPiezas, p.nombre as mpNombre
          FROM inv_subproductos_receta sr
          JOIN inv_productos p ON p.id = sr.materiasPrimaId
          WHERE sr.subproductoId = ${input.subproductoId}
        `);
        return (rows[0] as any[]);
      }),

    guardarSubproductoReceta: protectedProcedure
      .input(z.object({
        subproductoId: z.number(),
        rendimientoGramos: z.number(),
        lineas: z.array(z.object({
          materiasPrimaId: z.number(),
          cantidadGramos: z.number().default(0),
          cantidadPiezas: z.number().default(0),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (!["superadmin","owner","manager"].includes(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.execute(sql`UPDATE inv_subproductos SET rendimientoGramos=${input.rendimientoGramos} WHERE id=${input.subproductoId}`);
        await db.execute(sql`DELETE FROM inv_subproductos_receta WHERE subproductoId = ${input.subproductoId}`);
        for (const l of input.lineas) {
          await db.execute(sql`
            INSERT INTO inv_subproductos_receta (subproductoId, materiasPrimaId, cantidadGramos, cantidadPiezas)
            VALUES (${input.subproductoId}, ${l.materiasPrimaId}, ${l.cantidadGramos}, ${l.cantidadPiezas})
          `);
        }
        return { ok: true };
      }),
  },

  stockTeorico: protectedProcedure
    .input(z.object({ sucursalId: z.number(), dias: z.number().default(7) }))
    .query(async ({ ctx, input }) => {
      if (!['owner','superadmin','manager','leader'].includes(ctx.user.role))
        throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) return [];
      const consumoDir = await db.execute(sql`
        SELECT r.materiasPrimaId as productoId,
          SUM(vc.cantidad * r.cantidadGramos) / ${input.dias} as gpd
        FROM inv_ventas_captura vc
        JOIN inv_recetas r ON r.productoVentaId=vc.productoVentaId AND r.esSubproducto=0
        WHERE vc.sucursalId=${input.sucursalId}
          AND vc.fecha >= DATE_SUB(CURDATE(), INTERVAL ${input.dias} DAY)
        GROUP BY r.materiasPrimaId`);
      const consumoSub = await db.execute(sql`
        SELECT spr.materiasPrimaId as productoId,
          SUM(vc.cantidad * r.cantidadGramos * spr.cantidadGramos / sp.rendimientoGramos) / ${input.dias} as gpd
        FROM inv_ventas_captura vc
        JOIN inv_recetas r ON r.productoVentaId=vc.productoVentaId AND r.esSubproducto=1
        JOIN inv_subproductos sp ON sp.id=r.subproductoId
        JOIN inv_subproductos_receta spr ON spr.subproductoId=sp.id
        WHERE vc.sucursalId=${input.sucursalId}
          AND vc.fecha >= DATE_SUB(CURDATE(), INTERVAL ${input.dias} DAY)
        GROUP BY spr.materiasPrimaId`);
      const cMap: Record<number,number> = {};
      for (const r of [...(consumoDir[0] as any[]), ...(consumoSub[0] as any[])])
        cMap[r.productoId] = (cMap[r.productoId]??0) + Number(r.gpd);
      const rows = await db.execute(sql`
        SELECT cd.productoId, cd.cantidadPiezas,
          p.nombre, p.categoria, p.unidadConteo, p.pesoNetoPorUnidad,
          cf.fechaConteo,
          (cd.cantidadPiezas * p.pesoNetoPorUnidad) as gramosConteo
        FROM inv_conteo_detalle cd
        JOIN inv_conteo_fisico cf ON cf.id=cd.conteoId
        JOIN inv_productos p ON p.id=cd.productoId
        WHERE cf.id=(SELECT id FROM inv_conteo_fisico
          WHERE sucursalId=${input.sucursalId}
          ORDER BY fechaConteo DESC, id DESC LIMIT 1)`);
      const data = (rows[0] as any[]);
      if (!data.length) return [];
      const dias0 = Math.max(0, Math.floor(
        (Date.now()-new Date(data[0].fechaConteo).getTime())/86400000));
      return data.map((row: any) => {
        const gpd = cMap[row.productoId]??0;
        const gc = Number(row.gramosConteo);
        const stockG = Math.max(0, gc - gpd*dias0);
        const stockU = row.pesoNetoPorUnidad>0 ? stockG/row.pesoNetoPorUnidad : stockG;
        const dias = gpd>0 ? stockG/gpd : 99;
        const alerta = dias<2?'critico':dias<4?'bajo':dias<7?'ok':'bueno';
        return {
          productoId: row.productoId, nombre: row.nombre, categoria: row.categoria,
          unidadConteo: row.unidadConteo, fechaConteo: row.fechaConteo,
          cantidadPiezas: Number(row.cantidadPiezas),
          stockActualGramos: Math.round(stockG),
          stockUnidades: Math.round(stockU*10)/10,
          consumoPorDia: Math.round(gpd),
          diasStock: Math.min(99,Math.round(dias*10)/10),
          alerta, necesitaSurtido: dias<4,
          unidadesASurtir: gpd>0?Math.max(0,Math.ceil((gpd*7-stockG)/row.pesoNetoPorUnidad)):0,
        };
      }).sort((a:any,b:any)=>a.diasStock-b.diasStock);
    }),

});