import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getSucursales, getSucursalById, createSucursal, updateSucursal, deleteSucursal,
  getEvaluaciones, getEvaluacionById, createEvaluacion, updateEvaluacion, deleteEvaluacion,
  getRespuestasByEvaluacion, upsertRespuestas,
  getPlanAccion, createPlanAccion, updatePlanAccion, deletePlanAccion,
  getHistorialComparativo,
  getPuntosEvaluacion, getPuntoById, createPunto, updatePunto, togglePuntoActivo, deletePunto,
} from "./db";
import { calcularPuntuacion } from "../shared/evaluacionData";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // // --- Sucursales ---
  sucursales: router({
    list: publicProcedure.query(async () => {
      return getSucursales();
    }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getSucursalById(input.id);
    }),

    create: protectedProcedure.input(z.object({
      nombre: z.string().min(1),
      ciudad: z.string().optional(),
      estado: z.string().optional(),
      direccion: z.string().optional(),
      franquiciado: z.string().optional(),
    })).mutation(async ({ input }) => {
      await createSucursal(input);
      return { success: true };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      nombre: z.string().min(1).optional(),
      ciudad: z.string().optional(),
      estado: z.string().optional(),
      direccion: z.string().optional(),
      franquiciado: z.string().optional(),
      activa: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSucursal(id, data);
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSucursal(input.id);
      return { success: true };
    }),
  }),

  // // --- Evaluaciones ---
  evaluaciones: router({
    list: publicProcedure.input(z.object({ sucursalId: z.number().optional() })).query(async ({ input }) => {
      return getEvaluaciones(input.sucursalId);
    }),

    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const evaluacion = await getEvaluacionById(input.id);
      if (!evaluacion) return null;
      const respuestasData = await getRespuestasByEvaluacion(input.id);
      return { ...evaluacion, respuestas: respuestasData };
    }),

    create: protectedProcedure.input(z.object({
      sucursalId: z.number(),
      evaluadorNombre: z.string().optional(),
      fecha: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const fecha = input.fecha ? new Date(input.fecha) : new Date();
      const result = await createEvaluacion({
        sucursalId: input.sucursalId,
        evaluadorId: ctx.user.id,
        evaluadorNombre: input.evaluadorNombre ?? ctx.user.name ?? "Evaluador",
        fecha,
        estado: "borrador",
      });
      // @ts-ignore
      const insertId = result[0]?.insertId ?? (result as any).insertId;
      return { id: insertId, success: true };
    }),

    saveRespuestas: protectedProcedure.input(z.object({
      evaluacionId: z.number(),
      respuestas: z.array(z.object({
        puntoId: z.string(),
        respuesta: z.enum(["si", "no", "na"]),
        observacion: z.string().optional(),
        puntosObtenidos: z.number().optional(),
      })),
      estado: z.enum(["borrador", "completada"]).optional(),
      observacionesGenerales: z.string().optional(),
    })).mutation(async ({ input }) => {
      // Build respuestas map for scoring
      const respuestasMap: Record<string, "si" | "no" | "na"> = {};
      for (const r of input.respuestas) {
        respuestasMap[r.puntoId] = r.respuesta;
      }

      // Calculate scores
      const scoring = calcularPuntuacion(respuestasMap);

      // Save respuestas
      await upsertRespuestas(input.evaluacionId, input.respuestas.map(r => ({
        puntoId: r.puntoId,
        respuesta: r.respuesta,
        observacion: r.observacion,
        puntosObtenidos: r.respuesta === "si" ? (r.puntosObtenidos ?? 0) : 0,
      })));

      // Update evaluacion with scores
      await updateEvaluacion(input.evaluacionId, {
        puntosObtenidos: scoring.puntosObtenidos,
        puntosMaximos: scoring.puntosMaximos,
        porcentajeGeneral: scoring.porcentajeGeneral,
        calificacion: scoring.calificacion.label,
        puntuacionPorCategoria: scoring.porCategoria as any,
        puntuacionPorSeccion: scoring.porSeccion as any,
        estado: input.estado ?? "borrador",
        observacionesGenerales: input.observacionesGenerales,
      });

      return { success: true, scoring };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteEvaluacion(input.id);
      return { success: true };
    }),
  }),

  // // --- Historial Comparativo ---
  historial: router({
    comparativo: publicProcedure
      .input(z.object({
        sucursalId: z.number().optional(),
        limit: z.number().min(1).max(50).optional(),
      }))
      .query(async ({ input }) => {
        return getHistorialComparativo(input.sucursalId, input.limit ?? 20);
      }),
  }),

  // // --- Plan de Acción ---
  planAccion: router({
    list: publicProcedure.input(z.object({
      sucursalId: z.number().optional(),
      evaluacionId: z.number().optional(),
    })).query(async ({ input }) => {
      return getPlanAccion(input.sucursalId, input.evaluacionId);
    }),

    create: protectedProcedure.input(z.object({
      evaluacionId: z.number(),
      sucursalId: z.number(),
      area: z.string().min(1),
      queMalEsta: z.string().optional(),
      objetivo: z.string().optional(),
      causaRaiz: z.string().optional(),
      comoResolver: z.string().optional(),
      fechaCompromiso: z.string().optional(),
      costo: z.number().optional(),
      responsable: z.string().optional(),
      revisor: z.string().optional(),
    })).mutation(async ({ input }) => {
      await createPlanAccion({
        ...input,
        fechaCompromiso: input.fechaCompromiso ? new Date(input.fechaCompromiso) : undefined,
        estado: "pendiente",
      });
      return { success: true };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      area: z.string().optional(),
      queMalEsta: z.string().optional(),
      objetivo: z.string().optional(),
      causaRaiz: z.string().optional(),
      comoResolver: z.string().optional(),
      fechaCompromiso: z.string().optional(),
      costo: z.number().optional(),
      responsable: z.string().optional(),
      revisor: z.string().optional(),
      estado: z.enum(["pendiente", "en_proceso", "completado"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, fechaCompromiso, ...rest } = input;
      await updatePlanAccion(id, {
        ...rest,
        fechaCompromiso: fechaCompromiso ? new Date(fechaCompromiso) : undefined,
      });
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deletePlanAccion(input.id);
      return { success: true };
    }),
  }),

  // // --- Admin: Preguntas de Evaluación ---
  adminPreguntas: router({
    list: publicProcedure
      .input(z.object({ soloActivos: z.boolean().optional() }))
      .query(async ({ input }) => {
        return getPuntosEvaluacion(input.soloActivos ?? false);
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getPuntoById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        codigo: z.string().min(1).max(20),
        seccionNumero: z.number().int().min(1).max(20),
        seccionNombre: z.string().min(1),
        categoria: z.enum(["Control", "Higiene", "Hospitalidad", "Imagen", "Mantenimiento", "Operación"]),
        descripcion: z.string().min(1),
        criterio: z.string().optional(),
        valor: z.number().min(0).max(100),
        orden: z.number().int().min(0).optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await createPunto({ ...input, orden: input.orden ?? 0, activo: input.activo ?? true });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        codigo: z.string().min(1).max(20).optional(),
        seccionNumero: z.number().int().min(1).max(20).optional(),
        seccionNombre: z.string().min(1).optional(),
        categoria: z.enum(["Control", "Higiene", "Hospitalidad", "Imagen", "Mantenimiento", "Operación"]).optional(),
        descripcion: z.string().min(1).optional(),
        criterio: z.string().optional(),
        valor: z.number().min(0).max(100).optional(),
        orden: z.number().int().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePunto(id, data);
        return { success: true };
      }),

    toggleActivo: protectedProcedure
      .input(z.object({ id: z.number(), activo: z.boolean() }))
      .mutation(async ({ input }) => {
        await togglePuntoActivo(input.id, input.activo);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePunto(input.id);
        return { success: true };
      }),
  }),

  // // --- Upload foto evidencia ---
  evidencia: router({
    upload: protectedProcedure
      .input(z.object({
        evaluacionId: z.number(),
        puntoId: z.string(),
        // Base64 data URL: "data:image/jpeg;base64,..."
        dataUrl: z.string().min(10),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input, ctx }) => {
        // Decode base64
        const base64 = input.dataUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const ext = input.mimeType === "image/png" ? "png" : "jpg";
        const key = `evidencias/${input.evaluacionId}/${input.puntoId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Update the respuesta row with the foto URL
        const { getDb } = await import("./db");
        const { respuestas } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          await db.update(respuestas)
            .set({ fotoUrl: url })
            .where(and(
              eq(respuestas.evaluacionId, input.evaluacionId),
              eq(respuestas.puntoId, input.puntoId)
            ));
        }
        return { url };
      }),
    delete: protectedProcedure
      .input(z.object({ evaluacionId: z.number(), puntoId: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { respuestas } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          await db.update(respuestas)
            .set({ fotoUrl: null })
            .where(and(
              eq(respuestas.evaluacionId, input.evaluacionId),
              eq(respuestas.puntoId, input.puntoId)
            ));
        }
        return { success: true };
      }),
  }),
  adminUsuarios: router({
    // Listar todos los usuarios
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar usuarios' });
      }
      const { getAllUsers, getSucursales } = await import('./db');
      const [allUsers, allSucursales] = await Promise.all([getAllUsers(), getSucursales()]);
      return { users: allUsers, sucursales: allSucursales };
    }),

    // Actualizar rol y notas de un usuario
    updateRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'superadmin', 'owner', 'manager', 'leader', 'host']),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { updateUserRole } = await import('./db');
        await updateUserRole(input.userId, input.role, input.notas);
        return { success: true };
      }),

    // Activar / desactivar usuario
    toggleActivo: protectedProcedure
      .input(z.object({ userId: z.number(), activo: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { toggleUserActivo } = await import('./db');
        await toggleUserActivo(input.userId, input.activo);
        return { success: true };
      }),

    // Obtener sucursales asignadas a un usuario
    getSucursales: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getUserSucursales } = await import('./db');
        return getUserSucursales(input.userId);
      }),

    // Asignar sucursal a usuario
    assignSucursal: protectedProcedure
      .input(z.object({ userId: z.number(), sucursalId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { assignUserSucursal } = await import('./db');
        await assignUserSucursal(input.userId, input.sucursalId);
        return { success: true };
      }),

    // Quitar sucursal de usuario
    removeSucursal: protectedProcedure
      .input(z.object({ userId: z.number(), sucursalId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { removeUserSucursal } = await import('./db');
        await removeUserSucursal(input.userId, input.sucursalId);
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
