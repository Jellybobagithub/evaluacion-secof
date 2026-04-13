/**
 * Router de Permisos Extra de Menú
 * Permite al superadmin otorgar acceso a secciones adicionales del menú
 * a usuarios individuales, más allá de lo que permite su rol base.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

export const menuPermisosRouter = router({
  /** Obtener los permisos extra de un usuario específico */
  getPermisosUsuario: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { menuPermisosExtra } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return db.select().from(menuPermisosExtra).where(eq(menuPermisosExtra.userId, input.userId));
    }),

  /** Obtener todos los permisos extra (para la vista de administración) */
  getTodosPermisos: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { menuPermisosExtra, users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const permisos = await db.select().from(menuPermisosExtra);
    // Enriquecer con nombre del usuario
    const userIds = Array.from(new Set(permisos.map(p => p.userId)));
    const usersData = userIds.length > 0
      ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role })
          .from(users)
          .where((await import("drizzle-orm")).inArray(users.id, userIds))
      : [];
    const userMap = Object.fromEntries(usersData.map(u => [u.id, u]));
    return permisos.map(p => ({
      ...p,
      userName: userMap[p.userId]?.name ?? "Desconocido",
      userEmail: userMap[p.userId]?.email ?? "",
      userRole: userMap[p.userId]?.role ?? "user",
    }));
  }),

  /** Obtener los permisos extra del usuario actual (para el menú lateral) */
  getMisPermisos: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    const { menuPermisosExtra } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const permisos = await db.select().from(menuPermisosExtra).where(eq(menuPermisosExtra.userId, ctx.user.id));
    return permisos.map(p => p.menuItemId);
  }),

  /** Otorgar un permiso extra a un usuario */
  otorgarPermiso: protectedProcedure
    .input(z.object({
      userId: z.number(),
      menuItemId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { menuPermisosExtra } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Verificar si ya existe
      const existing = await db.select().from(menuPermisosExtra)
        .where(and(
          eq(menuPermisosExtra.userId, input.userId),
          eq(menuPermisosExtra.menuItemId, input.menuItemId),
        ));
      if (existing.length > 0) return { ok: true, message: "Ya tenía ese permiso" };
      await db.insert(menuPermisosExtra).values({
        userId: input.userId,
        menuItemId: input.menuItemId,
        otorgadoPor: ctx.user.id,
      });
      return { ok: true };
    }),

  /** Revocar un permiso extra de un usuario */
  revocarPermiso: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { menuPermisosExtra } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(menuPermisosExtra).where(eq(menuPermisosExtra.id, input.id));
      return { ok: true };
    }),

  /** Revocar todos los permisos de un usuario */
  revocarTodosPermisosUsuario: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { menuPermisosExtra } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(menuPermisosExtra).where(eq(menuPermisosExtra.userId, input.userId));
      return { ok: true };
    }),
});
