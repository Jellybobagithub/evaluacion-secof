/**
 * Router de Actividades Bajo Observación (Sistema de Credibilidad)
 * Cuando el dueño detecta que una actividad no se realizó, la pone "bajo observación".
 * Mientras esté activa, esa actividad requiere foto de evidencia obligatoria en todos los turnos.
 * El historial queda guardado para auditoría.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";

export const observacionRouter = router({

  /** Listar actividades bajo observación de una sucursal */
  listar: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      soloActivas: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const conditions: any[] = [eq(actividadesObservacion.sucursalId, input.sucursalId)];
      if (input.soloActivas) {
        conditions.push(eq(actividadesObservacion.activa, true));
      }

      return db.select().from(actividadesObservacion)
        .where(and(...conditions))
        .orderBy(desc(actividadesObservacion.activadaAt));
    }),

  /** Listar observaciones activas de TODAS las sucursales (para el dashboard ejecutivo) */
  listarTodasSucursales: protectedProcedure
    .query(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { actividadesObservacion, sucursales } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      const rows = await db
        .select({
          id: actividadesObservacion.id,
          sucursalId: actividadesObservacion.sucursalId,
          actividadClave: actividadesObservacion.actividadClave,
          motivoActivacion: actividadesObservacion.motivoActivacion,
          activadaAt: actividadesObservacion.activadaAt,
          activa: actividadesObservacion.activa,
          sucursalNombre: sucursales.nombre,
        })
        .from(actividadesObservacion)
        .leftJoin(sucursales, eq(actividadesObservacion.sucursalId, sucursales.id))
        .where(eq(actividadesObservacion.activa, true))
        .orderBy(desc(actividadesObservacion.activadaAt));

      return rows;
    }),

  /** Verificar si una actividad específica está bajo observación */
  verificar: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      actividadClave: z.string(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { bajoObservacion: false };
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const rows = await db.select().from(actividadesObservacion)
        .where(and(
          eq(actividadesObservacion.sucursalId, input.sucursalId),
          eq(actividadesObservacion.actividadClave, input.actividadClave),
          eq(actividadesObservacion.activa, true)
        ))
        .limit(1);

      return {
        bajoObservacion: rows.length > 0,
        registro: rows[0] ?? null,
      };
    }),

  /** Verificar múltiples actividades a la vez (para cargar Mi Turno) */
  verificarMultiple: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      claves: z.array(z.string()),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return {};
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");

      if (input.claves.length === 0) return {};

      const rows = await db.select().from(actividadesObservacion)
        .where(and(
          eq(actividadesObservacion.sucursalId, input.sucursalId),
          eq(actividadesObservacion.activa, true),
          inArray(actividadesObservacion.actividadClave, input.claves)
        ));

      // Devuelve un mapa { clave: true/false }
      const resultado: Record<string, boolean> = {};
      for (const clave of input.claves) {
        resultado[clave] = rows.some(r => r.actividadClave === clave);
      }
      return resultado;
    }),

  /** Activar observación en una actividad (dueño/manager detecta incumplimiento) */
  activar: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      actividadClave: z.string(),
      motivoActivacion: z.string().min(10, "Describe qué encontraste mal (mín. 10 caracteres)"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Solo owner, manager y superadmin pueden activar observaciones
      if (!["owner", "manager", "superadmin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo el dueño o manager puede activar observaciones" });
      }

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Verificar si ya existe una observación activa para esta actividad
      const existente = await db.select().from(actividadesObservacion)
        .where(and(
          eq(actividadesObservacion.sucursalId, input.sucursalId),
          eq(actividadesObservacion.actividadClave, input.actividadClave),
          eq(actividadesObservacion.activa, true)
        ))
        .limit(1);

      if (existente.length > 0) {
        return { id: existente[0].id, yaExistia: true };
      }

      const [result] = await db.insert(actividadesObservacion).values({
        sucursalId: input.sucursalId,
        actividadClave: input.actividadClave,
        activadaPorId: ctx.user.id,
        motivoActivacion: input.motivoActivacion,
        activa: true,
      });

      const id = (result as any).insertId;

      // Notificar al equipo (líder de la tienda)
      await notifyOwner({
        title: `👁️ Actividad bajo observación: ${input.actividadClave}`,
        content: `La actividad ${input.actividadClave} ha sido puesta bajo observación en la sucursal ID ${input.sucursalId}.\n\n📋 Motivo: ${input.motivoActivacion}\n👤 Activado por: ${ctx.user.name ?? ctx.user.email}\n\nA partir de ahora, esta actividad requiere foto de evidencia diaria hasta que sea resuelta.`,
      });

      return { id, yaExistia: false };
    }),

  /** Resolver observación (dueño valida que ya está corregido) */
  resolver: protectedProcedure
    .input(z.object({
      id: z.number(),
      notaResolucion: z.string().min(5, "Describe qué validaste (mín. 5 caracteres)"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "manager", "superadmin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await db.update(actividadesObservacion).set({
        activa: false,
        resueltaPorId: ctx.user.id,
        resueltaAt: new Date(),
        notaResolucion: input.notaResolucion,
      }).where(eq(actividadesObservacion.id, input.id));

      return { ok: true };
    }),

  /** Historial completo de observaciones de una sucursal (para auditoría) */
  historial: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      return db.select().from(actividadesObservacion)
        .where(eq(actividadesObservacion.sucursalId, input.sucursalId))
        .orderBy(desc(actividadesObservacion.activadaAt));
    }),

  /** Resumen: cuántas veces cada actividad ha estado bajo observación */
  resumenPorActividad: protectedProcedure
    .input(z.object({ sucursalId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { actividadesObservacion } = await import("../../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");

      const rows = await db.select({
        actividadClave: actividadesObservacion.actividadClave,
        totalVeces: sql<number>`COUNT(*)`,
        vecesActiva: sql<number>`SUM(CASE WHEN activa = 1 THEN 1 ELSE 0 END)`,
      })
        .from(actividadesObservacion)
        .where(eq(actividadesObservacion.sucursalId, input.sucursalId))
        .groupBy(actividadesObservacion.actividadClave);

      return rows;
    }),
});
