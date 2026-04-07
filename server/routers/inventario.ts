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
} from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

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
        if (!["superadmin", "owner", "manager"].includes(role))
          throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.update(invProductos).set(data as any).where(eq(invProductos.id, id));
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
        semana: z.string().optional(), // "2026-W14", default = semana actual
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const semana = input.semana ?? getSemanaISO();
        const existing = await db.select().from(invConteoFisico)
          .where(and(
            eq(invConteoFisico.sucursalId, input.sucursalId),
            eq(invConteoFisico.almacenId, input.almacenId),
            eq(invConteoFisico.semana, semana),
          )).limit(1);
        if (existing.length > 0) {
          // Obtener detalles
          const detalles = await db.select().from(invConteoDetalle)
            .where(eq(invConteoDetalle.conteoId, existing[0].id));
          return { conteo: existing[0], detalles };
        }
        // Crear nuevo conteo
        const hoy = new Date().toISOString().split("T")[0];
        const [result] = await db.insert(invConteoFisico).values({
          sucursalId: input.sucursalId,
          almacenId: input.almacenId,
          semana,
          fechaConteo: hoy,
          liderId: ctx.user.id,
          estado: "borrador",
        });
        const conteoId = (result as any).insertId;
        const conteo = await db.select().from(invConteoFisico).where(eq(invConteoFisico.id, conteoId)).limit(1);
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
        return db.select().from(invConteoFisico)
          .where(and(
            eq(invConteoFisico.sucursalId, input.sucursalId),
            eq(invConteoFisico.almacenId, input.almacenId),
          ))
          .orderBy(desc(invConteoFisico.semana))
          .limit(input.limite);
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
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const semana = input.semana ?? getSemanaISO();

      // Obtener conteo físico
      const conteos = await db.select().from(invConteoFisico)
        .where(and(
          eq(invConteoFisico.sucursalId, input.sucursalId),
          eq(invConteoFisico.almacenId, input.almacenId),
          eq(invConteoFisico.semana, semana),
        )).limit(1);

      // Obtener teórico publicado
      const teoricos = await db.select().from(invTeorico)
        .where(and(
          eq(invTeorico.sucursalId, input.sucursalId),
          eq(invTeorico.almacenId, input.almacenId),
          eq(invTeorico.semana, semana),
        )).limit(1);

      // Obtener todos los productos activos
      const productos = await db.select().from(invProductos)
        .where(eq(invProductos.activo, true))
        .orderBy(invProductos.categoria, invProductos.nombre);

      // Obtener detalles
      const detallesFisico = conteos.length > 0
        ? await db.select().from(invConteoDetalle).where(eq(invConteoDetalle.conteoId, conteos[0].id))
        : [];
      const detallesTeorico = teoricos.length > 0
        ? await db.select().from(invTeoricoDetalle).where(eq(invTeoricoDetalle.teoricoId, teoricos[0].id))
        : [];

      // Construir comparativa
      const lineas = productos.map(prod => {
        const fisico = detallesFisico.find(d => d.productoId === prod.id);
        const teorico = detallesTeorico.find(d => d.productoId === prod.id);
        const cantFisica = fisico?.cantidadPiezas ?? 0;
        const cantGramos = fisico?.cantidadGramos ?? 0;
        const cantTeorica = teorico?.cantidadEsperada ?? 0;
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
        conteo: conteos[0] ?? null,
        teorico: teoricos[0] ?? null,
        lineas: lineasConMinMax,
        resumen: {
          totalProductos: lineas.length,
          conAlerta: lineas.filter(l => l.alerta).length,
          bajoMinimo: lineasConMinMax.filter(l => l.bajoMinimo).length,
          hayFisico: conteos.length > 0,
          hayTeorico: teoricos.length > 0,
        },
      };
    }),
});
