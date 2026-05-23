import { z } from "zod";
import { asistenciaRouter } from "./routers/asistencia";
import { rotacionRouter } from "./routers/rotacion";
import { ajustesEventualesRouter } from "./routers/ajustesEventuales";
import { finanzasRouter } from "./routers/finanzas";
import { asistenteRouter } from "./routers/asistente";
import { asistenteRouter } from "./routers/asistente";
import { evaluacionesPeriodoRouter } from "./routers/evaluacionesPeriodo";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getSucursales, getSucursalById, getSucursalesTodas, createSucursal, updateSucursal, deleteSucursal,
  getEvaluaciones, getEvaluacionById, createEvaluacion, updateEvaluacion, deleteEvaluacion,
  getRespuestasByEvaluacion, upsertRespuestas,
  getPlanAccion, createPlanAccion, updatePlanAccion, deletePlanAccion,
  getHistorialComparativo,
  getPuntosEvaluacion, getPuntoById, createPunto, updatePunto, togglePuntoActivo, deletePunto,
  getSucursalesAsignadas, getEvaluacionesByUser,
} from "./db";
import { calcularPuntuacion, SECCIONES } from "../shared/evaluacionData";
import { horariosRouter } from "./routers/horarios";
import { preparacionesRouter } from "./routers/preparaciones";
import { observacionRouter } from "./routers/observacion";
import { inventarioRouter } from "./routers/inventario";
import { inventarioCicloRouter } from "./routers/inventarioCiclo";
import { nominaHorasRouter } from "./routers/nomina";
import { comprasJellybobaRouter } from "./routers/comprasJellyboba";
import { menuPermisosRouter } from "./routers/menuPermisos";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  preparaciones: preparacionesRouter,
  observacion: observacionRouter,
  inventario: inventarioRouter,
  inventarioCiclo: inventarioCicloRouter,
  comprasJellyboba: comprasJellybobaRouter,
  nominaHoras: nominaHorasRouter,
  menuPermisos: menuPermisosRouter,

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
    list: protectedProcedure.query(async ({ ctx }) => {
      // superadmin, owner, manager ven todas; leader/host solo las asignadas
      if (['superadmin', 'owner', 'manager'].includes(ctx.user.role)) {
        return getSucursales();
      }
      return getSucursalesAsignadas(ctx.user.id);
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
      metaVentasMensual: z.number().optional(),
      fotoUrl: z.string().optional(),
      telefono: z.string().optional(),
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
      metaVentasMensual: z.number().optional(),
      fotoUrl: z.string().optional(),
      telefono: z.string().optional(),
      activa: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSucursal(id, data);
      return { success: true };
    }),
    listTodas: protectedProcedure.query(async ({ ctx }) => {
      if (!['superadmin', 'owner'].includes(ctx.user.role))
        throw new TRPCError({ code: 'FORBIDDEN' });
      return getSucursalesTodas();
    }),
    cerrarTienda: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['superadmin', 'owner'].includes(ctx.user.role))
          throw new TRPCError({ code: 'FORBIDDEN' });
        await updateSucursal(input.id, { activa: false });
        return { success: true };
      }),
    reactivarTienda: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['superadmin', 'owner'].includes(ctx.user.role))
          throw new TRPCError({ code: 'FORBIDDEN' });
        await updateSucursal(input.id, { activa: true });
        return { success: true };
      }),

    uploadFoto: protectedProcedure.input(z.object({
      sucursalId: z.number(),
      base64: z.string(),  // base64 de la imagen
      mimeType: z.string().default("image/jpeg"),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType === "image/png" ? "png" : "jpg";
      const key = `sucursales/${input.sucursalId}-foto-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateSucursal(input.sucursalId, { fotoUrl: url });
      return { url };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSucursal(input.id);
      return { success: true };
    }),
  }),

  // // --- Evaluaciones ---
  evaluaciones: router({
    list: protectedProcedure.input(z.object({ sucursalId: z.number().optional() })).query(async ({ input, ctx }) => {
      return getEvaluacionesByUser(ctx.user.id, ctx.user.role, input.sucursalId);
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

    previewImportacion: protectedProcedure.input(z.object({
      sucursalId: z.number(),
    })).query(async ({ input }) => {
      const evals = await getEvaluaciones(input.sucursalId);
      const ultimaEval = evals.find((e: any) => e.estado === "completada");
      if (!ultimaEval) return { evaluacion: null, puntosFallidos: [] as any[] };
      const respuestasData = await getRespuestasByEvaluacion(ultimaEval.id);
      const fallidos = respuestasData.filter((r: any) => r.respuesta === "no");
      const puntosFallidos = fallidos.map((r: any) => {
        let descripcion = r.puntoId; let seccionNombre = ""; let categoria = "";
        for (const sec of SECCIONES) {
          const punto = sec.puntos.find((p: any) => p.id === r.puntoId);
          if (punto) { descripcion = punto.descripcion; seccionNombre = sec.nombre; categoria = punto.categoria; break; }
        }
        return { puntoId: r.puntoId, descripcion, seccion: seccionNombre, categoria, observacion: r.observacion ?? "" };
      });
      return {
        evaluacion: { id: ultimaEval.id, fecha: ultimaEval.fecha, porcentajeGeneral: ultimaEval.porcentajeGeneral, calificacion: ultimaEval.calificacion },
        puntosFallidos,
      };
    }),

    importarDesdeEvaluacion: protectedProcedure.input(z.object({
      evaluacionId: z.number(),
      sucursalId: z.number(),
      puntosIds: z.array(z.string()),
    })).mutation(async ({ input }) => {
      const evaluacion = await getEvaluacionById(input.evaluacionId);
      if (!evaluacion) throw new TRPCError({ code: "NOT_FOUND", message: "Evaluacion no encontrada" });
      const respuestasData = await getRespuestasByEvaluacion(input.evaluacionId);
      let creados = 0;
      for (const puntoId of input.puntosIds) {
        const respuesta = respuestasData.find((r: any) => r.puntoId === puntoId);
        let descripcion = puntoId; let seccionNombre = "";
        for (const sec of SECCIONES) {
          const punto = sec.puntos.find((p: any) => p.id === puntoId);
          if (punto) { descripcion = punto.descripcion; seccionNombre = sec.nombre; break; }
        }
        await createPlanAccion({
          evaluacionId: input.evaluacionId, sucursalId: input.sucursalId,
          area: seccionNombre || puntoId,
          queMalEsta: "[" + puntoId + "] " + descripcion + (respuesta?.observacion ? " — Obs: " + respuesta.observacion : ""),
          estado: "pendiente",
        });
        creados++;
      }
      return { creados };
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
  // // --- Reportes Diarios ---
  reportesDiarios: router({
    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const { getReportesDiarios } = await import('./db');
        // leader/host solo ven sus propios reportes o de sus sucursales
        if (['leader', 'host'].includes(ctx.user.role)) {
          return getReportesDiarios(input.sucursalId, ctx.user.id, input.limit ?? 30);
        }
        return getReportesDiarios(input.sucursalId, undefined, input.limit ?? 30);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getReporteDiarioById } = await import('./db');
        return getReporteDiarioById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fecha: z.string().optional(),
        ventasEfectivo: z.number().optional(),
        ventasTarjeta: z.number().optional(),
        ventasRappi: z.number().optional(),
        ventasTotales: z.number().optional(), // calculado en frontend
        apertura: z.string().optional(),
        cierre: z.string().optional(),
        personalPresente: z.number().optional(),
        incidentes: z.string().optional(),
        novedades: z.string().optional(),
        observaciones: z.string().optional(),
        estado: z.enum(['borrador', 'enviado']).optional(),
        mermasMonto: z.number().optional(),
        mermasDetalle: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { createReporteDiario, getSucursalById } = await import('./db');
        // Guardar fecha como string YYYY-MM-DD (no convertir a Date para evitar desfase UTC)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const result = await createReporteDiario({
          ...input,
          fecha: input.fecha ?? todayStr,
          usuarioId: ctx.user.id,
          usuarioNombre: ctx.user.name ?? 'Usuario',
          estado: input.estado ?? 'borrador',
        });
        // @ts-ignore
        const insertId = result[0]?.insertId ?? (result as any).insertId;
        // Notificar al superadmin cuando se envía (no en borrador)
        if (input.estado === 'enviado') {
          try {
            const { notifyOwner } = await import('./_core/notification');
            const sucursal = await getSucursalById(input.sucursalId);
            // Formatear fecha desde string YYYY-MM-DD sin convertir a Date
            const [fy, fm, fd] = (input.fecha ?? todayStr).split('-').map(Number);
            const fechaDate = new Date(fy, fm - 1, fd);
            const fecha = fechaDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            const ventas = input.ventasTotales ? `$${input.ventasTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'No registradas';
            const desglose = `Efectivo: $${(input.ventasEfectivo ?? 0).toLocaleString('es-MX')} · Tarjeta: $${(input.ventasTarjeta ?? 0).toLocaleString('es-MX')} · Rappi: $${(input.ventasRappi ?? 0).toLocaleString('es-MX')}`;
            await notifyOwner({
              title: `Reporte Diario: ${sucursal?.nombre ?? 'Sucursal'}`,
              content: `${ctx.user.name ?? 'Un colaborador'} envió el reporte del ${fecha}.\nVentas totales: ${ventas}\n${desglose}${input.incidentes ? '\n⚠️ Incidentes: ' + input.incidentes.substring(0, 120) : ''}`,
              // (legacy field removed)
            });
          } catch { /* no bloquear si falla la notificación */ }
        }
        return { id: insertId, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sucursalId: z.number().optional(),
        fecha: z.string().optional(),
        ventasEfectivo: z.number().optional(),
        ventasTarjeta: z.number().optional(),
        ventasRappi: z.number().optional(),
        ventasTotales: z.number().optional(),
        apertura: z.string().optional(),
        cierre: z.string().optional(),
        personalPresente: z.number().optional(),
        incidentes: z.string().optional(),
        novedades: z.string().optional(),
        observaciones: z.string().optional(),
        estado: z.enum(['borrador', 'enviado']).optional(),
        mermasMonto: z.number().optional(),
        mermasDetalle: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { updateReporteDiario, getReporteDiarioById, getSucursalById } = await import('./db');
        const { id, fecha, ...rest } = input;
        // Guardar fecha como string YYYY-MM-DD (no convertir a Date para evitar desfase UTC)
        await updateReporteDiario(id, { ...rest, ...(fecha ? { fecha } : {}) });
        // Notificar al superadmin cuando se cambia a enviado
        if (input.estado === 'enviado') {
          try {
            const { notifyOwner } = await import('./_core/notification');
            const reporte = await getReporteDiarioById(id);
            if (reporte) {
              const sucursal = await getSucursalById(reporte.sucursalId);
              // Formatear fecha desde string YYYY-MM-DD sin convertir a Date
              const [ry, rm, rd] = (reporte.fecha as string).split('-').map(Number);
              const fechaDate2 = new Date(ry, rm - 1, rd);
              const fecha = fechaDate2.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
              const ventas = reporte.ventasTotales ? `$${reporte.ventasTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'No registradas';
              const desglose = `Efectivo: $${(reporte.ventasEfectivo ?? 0).toLocaleString('es-MX')} · Tarjeta: $${(reporte.ventasTarjeta ?? 0).toLocaleString('es-MX')} · Rappi: $${(reporte.ventasRappi ?? 0).toLocaleString('es-MX')}`;
              await notifyOwner({
                title: `Reporte Diario: ${sucursal?.nombre ?? 'Sucursal'}`,
                content: `${ctx.user.name ?? 'Un colaborador'} envió el reporte del ${fecha}.\nVentas totales: ${ventas}\n${desglose}${reporte.incidentes ? '\n⚠️ Incidentes: ' + reporte.incidentes.substring(0, 120) : ''}`,
              // (legacy field removed)
              });
            }
          } catch { /* no bloquear si falla la notificación */ }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteReporteDiario } = await import('./db');
        await deleteReporteDiario(input.id);
        return { success: true };
      }),

    historico: protectedProcedure
      .input(z.object({
        dias: z.number().min(1).max(730).optional(),
        sucursalId: z.number().optional(),
        fechaInicio: z.string().optional(), // YYYY-MM-DD
        fechaFin: z.string().optional(),    // YYYY-MM-DD
      }))
      .query(async ({ input }) => {
        const { getReportesDiarios } = await import('./db');
        const todos = await getReportesDiarios(input.sucursalId, undefined, 2000);
        let recientes;
        if (input.fechaInicio && input.fechaFin) {
          const inicio = new Date(input.fechaInicio + 'T00:00:00');
          const fin = new Date(input.fechaFin + 'T23:59:59');
          recientes = todos.filter(r => {
            const f = new Date(r.fecha);
            return f >= inicio && f <= fin && r.estado === 'enviado';
          });
        } else {
          const dias = input.dias ?? 30;
          const corte = new Date();
          corte.setDate(corte.getDate() - dias);
          recientes = todos.filter(r => new Date(r.fecha) >= corte && r.estado === 'enviado');
        }
        // Agrupar por fecha (YYYY-MM-DD)
        const porDia: Record<string, { ventas: number; tx: number; efectivo: number; tarjeta: number; rappi: number; reportes: number }> = {};
        for (const r of recientes) {
          const dia = new Date(r.fecha).toISOString().split('T')[0];
          if (!porDia[dia]) porDia[dia] = { ventas: 0, tx: 0, efectivo: 0, tarjeta: 0, rappi: 0, reportes: 0 };
          porDia[dia].ventas += r.ventasTotales ?? 0;
          porDia[dia].efectivo += r.ventasEfectivo ?? 0;
          porDia[dia].tarjeta += r.ventasTarjeta ?? 0;
          porDia[dia].rappi += r.ventasRappi ?? 0;
          porDia[dia].reportes += 1;
        }
        // Construir serie ordenada por fecha
        const serie = Object.entries(porDia)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([fecha, d]) => ({
            fecha,
            ventas: d.ventas,
            efectivo: d.efectivo ?? 0,
            tarjeta: d.tarjeta ?? 0,
            rappi: d.rappi ?? 0,
            reportes: d.reportes,
          }));
        const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
        const totalEfectivo = recientes.reduce((s, r) => s + (r.ventasEfectivo ?? 0), 0);
        const totalTarjeta = recientes.reduce((s, r) => s + (r.ventasTarjeta ?? 0), 0);
        const totalRappi = recientes.reduce((s, r) => s + (r.ventasRappi ?? 0), 0);
        const diasUsados = (input.fechaInicio && input.fechaFin) ? undefined : (input.dias ?? 30);
        return { serie, totalVentas, totalEfectivo, totalTarjeta, totalRappi, dias: diasUsados };
      }),

    resumen: protectedProcedure
      .input(z.object({ dias: z.number().min(1).max(90).optional() }))
      .query(async ({ input, ctx }) => {
        const { getReportesDiarios } = await import('./db');
        const dias = input.dias ?? 7;
        const todos = await getReportesDiarios(undefined, undefined, 500);
        const corte = new Date();
        corte.setDate(corte.getDate() - dias);
        const recientes = todos.filter(r => new Date(r.fecha) >= corte && r.estado === 'enviado');
        const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
        const totalEfectivo = recientes.reduce((s, r) => s + (r.ventasEfectivo ?? 0), 0);
        const totalTarjeta = recientes.reduce((s, r) => s + (r.ventasTarjeta ?? 0), 0);
        const totalRappi = recientes.reduce((s, r) => s + (r.ventasRappi ?? 0), 0);
        const reportesPorSucursal: Record<number, { ventas: number; efectivo: number; tarjeta: number; rappi: number; reportes: number }> = {};
        for (const r of recientes) {
          if (!reportesPorSucursal[r.sucursalId]) reportesPorSucursal[r.sucursalId] = { ventas: 0, efectivo: 0, tarjeta: 0, rappi: 0, reportes: 0 };
          reportesPorSucursal[r.sucursalId].ventas += r.ventasTotales ?? 0;
          reportesPorSucursal[r.sucursalId].efectivo += r.ventasEfectivo ?? 0;
          reportesPorSucursal[r.sucursalId].tarjeta += r.ventasTarjeta ?? 0;
          reportesPorSucursal[r.sucursalId].rappi += r.ventasRappi ?? 0;
          reportesPorSucursal[r.sucursalId].reportes += 1;
        }
        return { totalVentas, totalEfectivo, totalTarjeta, totalRappi, reportesEnviados: recientes.length, reportesPorSucursal, dias };
      }),

    // Avance vs meta del mes actual por sucursal
    avanceMeta: protectedProcedure.query(async () => {
      const { getReportesDiarios, getSucursales } = await import('./db');
      const [todos, sucursales] = await Promise.all([
        getReportesDiarios(undefined, undefined, 1000),
        getSucursales(),
      ]);
      const ahora = new Date();
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const enviados = todos.filter(r => new Date(r.fecha) >= inicioMes && r.estado === 'enviado');
      return sucursales.filter(s => s.activa).map(s => {
        const ventasMes = enviados
          .filter(r => r.sucursalId === s.id)
          .reduce((sum, r) => sum + (r.ventasTotales ?? 0), 0);
        const meta = s.metaVentasMensual ?? 0;
        return {
          sucursalId: s.id,
          nombre: s.nombre,
          ventasMes,
          meta,
          porcentaje: meta > 0 ? Math.min(100, (ventasMes / meta) * 100) : null,
        };
      });
    }),

    // Reporte semanal: enviar resumen al superadmin manualmente
    enviarResumenSemanal: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!['superadmin', 'owner', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getReportesDiarios, getSucursales, getEvaluaciones } = await import('./db');
        const { notifyOwner } = await import('./_core/notification');
        const [todos, sucursales, evaluaciones] = await Promise.all([
          getReportesDiarios(undefined, undefined, 1000),
          getSucursales(),
          getEvaluaciones(),
        ]);
        const ahora = new Date();
        const hace7 = new Date(); hace7.setDate(ahora.getDate() - 7);
        const recientes = todos.filter(r => new Date(r.fecha) >= hace7 && r.estado === 'enviado');
        const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
        const totalEfectivo7 = recientes.reduce((s, r) => s + (r.ventasEfectivo ?? 0), 0);
        const totalTarjeta7 = recientes.reduce((s, r) => s + (r.ventasTarjeta ?? 0), 0);
        const totalRappi7 = recientes.reduce((s, r) => s + (r.ventasRappi ?? 0), 0);
        const activasSuc = sucursales.filter(s => s.activa);
        const conReporte = new Set(recientes.map(r => r.sucursalId));
        const sinReporte = activasSuc.filter(s => !conReporte.has(s.id));
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const evsRecientes = evaluaciones.filter(e => e.estado === 'completada' && new Date(e.fecha) >= hace7);
        const avgSecof = evsRecientes.length > 0
          ? evsRecientes.reduce((s, e) => s + (e.porcentajeGeneral ?? 0), 0) / evsRecientes.length
          : null;
        const lineas = [
          `📊 RESUMEN SEMANAL — ${hace7.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} al ${ahora.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`,
          ``,
          `💰 VENTAS`,
          `  Total: $${totalVentas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          `  Efectivo: $${totalEfectivo7.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          `  Tarjeta: $${totalTarjeta7.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          `  Rappi: $${totalRappi7.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          `  Reportes enviados: ${recientes.length}`,
          ``,
          `📋 SECOF`,
          `  Evaluaciones esta semana: ${evsRecientes.length}`,
          `  Promedio general: ${avgSecof !== null ? avgSecof.toFixed(1) + '%' : 'Sin datos'}`,
          ``,
          `🏪 TIENDAS (${activasSuc.length} activas)`,
          sinReporte.length > 0
            ? `  ⚠️ Sin reporte (7 días): ${sinReporte.map(s => s.nombre).join(', ')}`
            : `  ✅ Todas las tiendas reportaron esta semana`,
        ];
        await notifyOwner({
          title: `Resumen Semanal SECOF — ${ahora.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
          content: lineas.join('\n'),
        });
        return { success: true };
      }),

    // Sucursales sin reporte en los últimos N días
    sinReporte: protectedProcedure
      .input(z.object({ dias: z.number().min(1).max(30).optional() }))
      .query(async ({ input }) => {
        const { getReportesDiarios, getSucursales } = await import('./db');
        const dias = input.dias ?? 2;
        const [todos, sucursales] = await Promise.all([
          getReportesDiarios(undefined, undefined, 500),
          getSucursales(),
        ]);
        const corte = new Date();
        corte.setDate(corte.getDate() - dias);
        const conReporte = new Set(
          todos
            .filter(r => new Date(r.fecha) >= corte && r.estado === 'enviado')
            .map(r => r.sucursalId)
        );
        // Calcular días desde el último reporte por sucursal
        const ultimoReportePorSucursal: Record<number, Date> = {};
        for (const r of todos.filter(r => r.estado === 'enviado')) {
          const fechaR = new Date(r.fecha);
          if (!ultimoReportePorSucursal[r.sucursalId] || fechaR > ultimoReportePorSucursal[r.sucursalId]) {
            ultimoReportePorSucursal[r.sucursalId] = fechaR;
          }
        }
        const hoy = new Date();
        return sucursales
          .filter(s => s.activa && !conReporte.has(s.id))
          .map(s => {
            const ultimo = ultimoReportePorSucursal[s.id];
            const diasSinReporte = ultimo
              ? Math.floor((hoy.getTime() - ultimo.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            return { id: s.id, sucursalId: s.id, nombre: s.nombre, diasSinReporte };
          })
          .sort((a, b) => (b.diasSinReporte ?? 999) - (a.diasSinReporte ?? 999));
      }),
  }),

  adminUsuarios: router({
    // Listar todos los usuarios
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo administradores pueden gestionar usuarios' });
      }
      const { getAllUsers, getSucursales, getUserSucursales } = await import('./db');
      const [allUsers, allSucursales] = await Promise.all([getAllUsers(), getSucursales()]);
      // Enriquecer cada usuario con sus sucursales asignadas
      const usersWithSucursales = await Promise.all(
        allUsers.map(async (u) => {
          const asignaciones = await getUserSucursales(u.id);
          const sucursalesAsignadas = allSucursales.filter(s =>
            asignaciones.some(a => a.sucursalId === s.id)
          );
          return { ...u, sucursales: sucursalesAsignadas };
        })
      );
      return { users: usersWithSucursales, sucursales: allSucursales };
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

  // ─── Empleados ───────────────────────────────────────────────────────────
  empleados: router({
    list: protectedProcedure
      .input(z.object({ sucursalId: z.number(), soloActivos: z.boolean().optional() }))
      .query(async ({ input }) => {
        const { getEmpleadosBySucursal } = await import('./db');
        return getEmpleadosBySucursal(input.sucursalId, input.soloActivos ?? true);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getEmpleadoById } = await import('./db');
        return getEmpleadoById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        nombre: z.string().min(1),
        apellido: z.string().optional(),
        rol: z.enum(['anfitrion', 'lider', 'administrador']).default('anfitrion'),
        telefono: z.string().optional(),
        fechaIngreso: z.string().optional(), // ISO string
        notas: z.string().optional(),
        tipoContrato: z.enum(['fulltime', 'finde_ext', 'finde', 'custom']).optional(),
        diasDisponibles: z.string().optional(), // JSON array
        diaDescansoFijo: z.number().nullable().optional(),
        horarioPersonal: z.any().optional(),
        areaPreferida: z.enum(["caja","preparacion","comodin"]).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createEmpleado } = await import('./db');
        // Generar horarioPersonal base si no se proporcionó
        const _tipo = input.tipoContrato ?? 'fulltime';
        const _descanso = input.diaDescansoFijo ?? null;
        let _horarioBase: Record<string, {entrada:string;salida:string}|null> = {};
        if (input.horarioPersonal) {
          _horarioBase = typeof input.horarioPersonal === 'string'
            ? JSON.parse(input.horarioPersonal) : input.horarioPersonal;
        } else if (_tipo === 'fulltime') {
          for (let d = 0; d <= 6; d++) {
            _horarioBase[d] = _descanso === d ? null : { entrada: '10:00', salida: '18:00' };
          }
        } else if (_tipo === 'finde_ext') {
          for (let d = 0; d <= 6; d++) {
            _horarioBase[d] = [0, 5, 6].includes(d) ? { entrada: '10:00', salida: '18:00' } : null;
          }
        } else if (_tipo === 'finde') {
          for (let d = 0; d <= 6; d++) {
            _horarioBase[d] = [0, 6].includes(d) ? { entrada: '10:00', salida: '18:00' } : null;
          }
        }
        await createEmpleado({
          sucursalId: input.sucursalId,
          nombre: input.nombre,
          apellido: input.apellido,
          rol: input.rol,
          telefono: input.telefono,
          fechaIngreso: input.fechaIngreso ? new Date(input.fechaIngreso) : new Date(),
          notas: input.notas,
          tipoContrato: _tipo,
          diasDisponibles: input.diasDisponibles,
          diaDescansoFijo: _descanso,
          horarioPersonal: Object.keys(_horarioBase).length > 0 ? JSON.stringify(_horarioBase) : null,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().optional(),
        apellido: z.string().optional(),
        rol: z.enum(['anfitrion', 'lider', 'administrador']).optional(),
        telefono: z.string().optional(),
        notas: z.string().optional(),
        tipoContrato: z.enum(['fulltime', 'finde_ext', 'finde', 'custom']).optional(),
        diasDisponibles: z.string().optional(), // JSON array
        diaDescansoFijo: z.number().nullable().optional(), // 0=dom,1=lun,...,6=sáb
        horarioPersonal: z.any().optional(),
        userId: z.number().nullable().optional(), // vincular con usuario del sistema
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { updateEmpleado } = await import('./db');
        const { id, ...data } = input;
        await updateEmpleado(id, data);
        return { success: true };
      }),

    // Vincular usuario del sistema a un empleado (para que el anfitrión vea sus KPIs)
    vincularUsuario: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        userId: z.number().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { updateEmpleado } = await import('./db');
        await updateEmpleado(input.empleadoId, { userId: input.userId ?? undefined });
        return { success: true };
      }),

    darBaja: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { darBajaEmpleado } = await import('./db');
        await darBajaEmpleado(input.id);
        return { success: true };
      }),

    // Obtener el empleado vinculado al usuario actual (para anfitriones)
    miEmpleado: protectedProcedure.query(async ({ ctx }) => {
      const { getEmpleadoByUserId } = await import('./db');
      return getEmpleadoByUserId(ctx.user.id);
    }),
  }),

  // ─── Checklist Plantillas ────────────────────────────────────────────────
  checklistPlantillas: router({
    list: protectedProcedure.query(async () => {
      const { getChecklistPlantillas } = await import('./db');
      return getChecklistPlantillas();
    }),

    create: protectedProcedure
      .input(z.object({
        nombre: z.string().min(1),
        tipo: z.enum(['limpieza', 'operativo', 'apertura', 'cierre']),
        turno: z.enum(['matutino', 'vespertino', 'ambos']),
        items: z.array(z.object({
          id: z.string(),
          descripcion: z.string(),
          orden: z.number(),
          obligatorio: z.boolean().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createChecklistPlantilla } = await import('./db');
        await createChecklistPlantilla(input as any);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().optional(),
        tipo: z.enum(['limpieza', 'operativo', 'apertura', 'cierre']).optional(),
        turno: z.enum(['matutino', 'vespertino', 'ambos']).optional(),
        items: z.array(z.object({
          id: z.string(),
          descripcion: z.string(),
          orden: z.number(),
          obligatorio: z.boolean().optional(),
        })).optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { updateChecklistPlantilla } = await import('./db');
        const { id, ...data } = input;
        await updateChecklistPlantilla(id, data as any);
        return { success: true };
      }),
  }),

  // ─── Checklist Registros ─────────────────────────────────────────────────
  checklist: router({
    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string().optional(),
        fechaFin: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getChecklistRegistros } = await import('./db');
        return getChecklistRegistros(
          input.sucursalId,
          input.fechaInicio ? new Date(input.fechaInicio) : undefined,
          input.fechaFin ? new Date(input.fechaFin) : undefined,
        );
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getChecklistRegistroById } = await import('./db');
        return getChecklistRegistroById(input.id);
      }),

    save: protectedProcedure
      .input(z.object({
        id: z.number().optional(), // si existe, actualiza; si no, crea
        plantillaId: z.number(),
        sucursalId: z.number(),
        empleadoId: z.number().optional(),
        liderNombre: z.string().optional(),
        fecha: z.string(),
        turno: z.enum(['matutino', 'vespertino']),
        itemsCompletados: z.record(z.string(), z.boolean()),
        totalItems: z.number(),
        itemsOk: z.number(),
        porcentaje: z.number(),
        observaciones: z.string().optional(),
        firmado: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createChecklistRegistro, updateChecklistRegistro } = await import('./db');
        const data = {
          plantillaId: input.plantillaId,
          sucursalId: input.sucursalId,
          empleadoId: input.empleadoId,
          liderNombre: input.liderNombre ?? ctx.user.name ?? '',
          fecha: new Date(input.fecha),
          turno: input.turno,
          itemsCompletados: input.itemsCompletados,
          totalItems: input.totalItems,
          itemsOk: input.itemsOk,
          porcentaje: input.porcentaje,
          observaciones: input.observaciones,
          firmado: input.firmado ?? false,
        };
        if (input.id) {
          await updateChecklistRegistro(input.id, data as any);
        } else {
          await createChecklistRegistro(data as any);
        }
        return { success: true };
      }),
  }),

  // ─── Asistencia ──────────────────────────────────────────────────────────
  asistencia: asistenciaRouter,
  rotacion: rotacionRouter,
  ajustesEventuales: ajustesEventualesRouter,
  finanzas: finanzasRouter,
  evalPeriodos: evaluacionesPeriodoRouter,
  asistente: asistenteRouter,

    // ─── KPIs Anfitriones (Observaciones Nivel 1) ────────────────────────────
  kpiAnfitriones: router({
    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        semana: z.string().optional(), // "2026-W13"
      }))
      .query(async ({ input }) => {
        const { getObservacionesKpi } = await import('./db');
        return getObservacionesKpi(input.sucursalId, input.semana);
      }),

    listByEmpleado: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        semana: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { getObservacionesKpiByEmpleado } = await import('./db');
        return getObservacionesKpiByEmpleado(input.empleadoId, input.semana);
      }),

    registrar: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        sucursalId: z.number(),
        tipo: z.enum(['servicio', 'preparacion', 'caja']),
        detalle: z.record(z.string(), z.any()),
        cumple: z.boolean(),
        semana: z.string(), // "2026-W13"
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createObservacionKpi } = await import('./db');
        await createObservacionKpi({
          ...input,
          observadorId: ctx.user.id,
          detalle: input.detalle,
        });
        return { success: true };
      }),
  }),

  // --- Horarios Semanales (nuevo módulo con turnos + actividades) ---
  horarios: horariosRouter,

  // ─── KPI Nivel 2 (Líder) ─────────────────────────────────────────────────────
  kpiLider: router({
    // Cumplimiento de reportes diarios (% enviados a tiempo)
    cumplimientoReportes: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(), // YYYY-MM-DD
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getCumplimientoReportes } = await import('./db');
        return getCumplimientoReportes(
          input.sucursalId,
          new Date(input.fechaInicio),
          new Date(input.fechaFin)
        );
      }),

    // KPI Mermas (% mermas vs ventas)
    mermas: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getKpiMermas } = await import('./db');
        return getKpiMermas(
          input.sucursalId,
          new Date(input.fechaInicio),
          new Date(input.fechaFin)
        );
      }),

    // KPI Rotación de Equipo
    rotacion: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getKpiRotacion } = await import('./db');
        return getKpiRotacion(
          input.sucursalId,
          new Date(input.fechaInicio),
          new Date(input.fechaFin)
        );
      }),

    // KPI Puntualidad de Anfitriones
    puntualidad: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.number(), // Unix ms
        fechaFin: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getKpiPuntualidad } = await import('./db');
        return getKpiPuntualidad(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    // Descuadres de Caja
    descuadresCaja: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDescuadresCaja } = await import('./db');
        return getDescuadresCaja(
          input.sucursalId,
          new Date(input.fechaInicio),
          new Date(input.fechaFin)
        );
      }),

    // Resumen completo Nivel 2 para una sucursal
    resumenNivel2: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        mes: z.string().optional(), // 'YYYY-MM', default mes actual
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const mesStr = input.mes ?? new Date().toISOString().slice(0, 7);
        const [year, month] = mesStr.split('-').map(Number);
        const fechaInicio = new Date(year, month - 1, 1);
        // Para el mes actual: usar ayer como fecha fin (no contar días futuros)
        // Para meses pasados: usar el último día del mes
        const hoyBackend = new Date();
        const mesActualBackend = `${hoyBackend.getFullYear()}-${String(hoyBackend.getMonth() + 1).padStart(2, '0')}`;
        let fechaFin: Date;
        if (mesStr === mesActualBackend) {
          // Ayer a las 23:59:59
          const ayer = new Date(hoyBackend);
          ayer.setDate(hoyBackend.getDate() - 1);
          ayer.setHours(23, 59, 59, 999);
          fechaFin = ayer;
        } else {
          fechaFin = new Date(year, month, 0, 23, 59, 59);
        }
        const trimInicio = new Date(year, Math.floor((month - 1) / 3) * 3, 1);
        const trimFin = new Date(year, Math.floor((month - 1) / 3) * 3 + 3, 0, 23, 59, 59);

        const { getCumplimientoReportes, getKpiMermas, getKpiRotacion } = await import('./db');
        const [reportes, mermas, rotacion] = await Promise.all([
          getCumplimientoReportes(input.sucursalId, fechaInicio, fechaFin),
          getKpiMermas(input.sucursalId, fechaInicio, fechaFin),
          getKpiRotacion(input.sucursalId, trimInicio, trimFin),
        ]);

        // Última evaluación SECOF del mes
        const { getDb } = await import('./db');
        const { evaluaciones } = await import('../drizzle/schema');
        const { eq, and, gte, lte, desc } = await import('drizzle-orm');
        const db = await getDb();
        let secof = null;
        if (db) {
          const evals = await db.select().from(evaluaciones)
            .where(and(
              eq(evaluaciones.sucursalId, input.sucursalId),
              eq(evaluaciones.estado, 'completada'),
              gte(evaluaciones.fecha, fechaInicio),
              lte(evaluaciones.fecha, fechaFin)
            ))
            .orderBy(desc(evaluaciones.fecha))
            .limit(1);
          secof = evals[0] ?? null;
        }

        // Ventas del mes
        const { getDb: _db2 } = await import('./db');
        const { reportesDiarios, ventasHistoricas } = await import('../drizzle/schema');
        const db2 = await _db2();
        let ventas = { total: 0, meta: 0, porcentaje: 0, sinMeta: false, metaFuente: 'historica' as 'historica' | 'manual' };
        if (db2) {
          // Usar strings YYYY-MM-DD para comparar con columna varchar
          const fiStr = `${year}-${String(month).padStart(2,'0')}-01`;
          const diasMes = new Date(year, month, 0).getDate();
          const ffStr = `${year}-${String(month).padStart(2,'0')}-${String(diasMes).padStart(2,'0')}`;
          const reps = await db2.select().from(reportesDiarios)
            .where(and(
              eq(reportesDiarios.sucursalId, input.sucursalId),
              gte(reportesDiarios.fecha, fiStr),
              lte(reportesDiarios.fecha, ffStr),
              eq(reportesDiarios.estado, 'enviado')
            ));
          const totalVentas = reps.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);

          // Buscar meta desde ventas históricas del año anterior (mismo mes)
          const histAnio = year - 1;
          const histRows = await db2.select().from(ventasHistoricas)
            .where(and(
              eq(ventasHistoricas.sucursalId, input.sucursalId),
              eq(ventasHistoricas.anio, histAnio),
              eq(ventasHistoricas.mes, month)
            ))
            .limit(1);
          const metaHistorica = histRows[0]?.ventasTotales ?? 0;
          const sinMeta = metaHistorica === 0;

          ventas = {
            total: Math.round(totalVentas * 100) / 100,
            meta: metaHistorica,
            porcentaje: metaHistorica > 0 ? Math.round((totalVentas / metaHistorica) * 100) : 0,
            sinMeta,
            metaFuente: 'historica',
          };
        }

        return {
          mes: mesStr,
          secof: secof ? { porcentaje: secof.porcentajeGeneral, calificacion: secof.calificacion } : null,
          ventas,
          reportes,
          mermas,
          rotacion,
        };
      }),
  }),

  // ─── Bajas de Empleados ──────────────────────────────────────────────────────
  bajas: router({
    registrar: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        sucursalId: z.number(),
        tipo: z.enum(['renuncia', 'despido', 'termino_contrato', 'otro']),
        motivo: z.string().optional(),
        fechaBaja: z.string().optional(), // ISO date
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createBajaEmpleado } = await import('./db');
        const { updateEmpleado } = await import('./db');
        await createBajaEmpleado({
          empleadoId: input.empleadoId,
          sucursalId: input.sucursalId,
          tipo: input.tipo,
          motivo: input.motivo,
          fechaBaja: input.fechaBaja ? new Date(input.fechaBaja) : new Date(),
          registradoPorId: ctx.user.id,
        });
        // Marcar empleado como inactivo
        await updateEmpleado(input.empleadoId, { activo: false, fechaBaja: input.fechaBaja ? new Date(input.fechaBaja) : new Date() });
        return { success: true };
      }),

    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string().optional(),
        fechaFin: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getBajasBySucursal } = await import('./db');
        return getBajasBySucursal(
          input.sucursalId,
          input.fechaInicio ? new Date(input.fechaInicio) : undefined,
          input.fechaFin ? new Date(input.fechaFin) : undefined
        );
      }),
  }),

  // ─── Ventas Históricas (año anterior por tienda/mes) ────────────────────────────────
  ventasHistoricas: router({
    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number().optional(),
        anio: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { ventasHistoricas } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const conditions: any[] = [];
        if (input.sucursalId) conditions.push(eq(ventasHistoricas.sucursalId, input.sucursalId));
        if (input.anio) conditions.push(eq(ventasHistoricas.anio, input.anio));
        return conditions.length > 0
          ? db.select().from(ventasHistoricas).where(and(...conditions)).orderBy(ventasHistoricas.mes)
          : db.select().from(ventasHistoricas).orderBy(ventasHistoricas.anio, ventasHistoricas.mes);
      }),

    upsert: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number(),
        mes: z.number().min(1).max(12),
        ventasEfectivo: z.number().min(0).optional(),
        ventasTarjeta: z.number().min(0).optional(),
        ventasRappi: z.number().min(0).optional(),
        ventasTotales: z.number().min(0).optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { ventasHistoricas } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const efectivo = input.ventasEfectivo ?? 0;
        const tarjeta = input.ventasTarjeta ?? 0;
        const rappi = input.ventasRappi ?? 0;
        const total = input.ventasTotales ?? (efectivo + tarjeta + rappi);
        const existing = await db.select().from(ventasHistoricas)
          .where(and(
            eq(ventasHistoricas.sucursalId, input.sucursalId),
            eq(ventasHistoricas.anio, input.anio),
            eq(ventasHistoricas.mes, input.mes)
          ))
          .limit(1);
        if (existing.length > 0) {
          await db.update(ventasHistoricas)
            .set({ ventasEfectivo: efectivo, ventasTarjeta: tarjeta, ventasRappi: rappi, ventasTotales: total, notas: input.notas })
            .where(eq(ventasHistoricas.id, existing[0].id));
          return { id: existing[0].id, updated: true };
        } else {
          const [result] = await db.insert(ventasHistoricas).values({
            sucursalId: input.sucursalId, anio: input.anio, mes: input.mes,
            ventasEfectivo: efectivo, ventasTarjeta: tarjeta, ventasRappi: rappi,
            ventasTotales: total, notas: input.notas,
          });
          return { id: (result as any).insertId, updated: false };
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { ventasHistoricas } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(ventasHistoricas).where(eq(ventasHistoricas.id, input.id));
        return { success: true };
      }),
  }),

  // ─── KPI Nivel 3: Administrador ──────────────────────────────────────────────
  kpiAdmin: router({
    // Crecimiento mes vs mes (ventas actuales vs año anterior)
    crecimiento: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number().optional(),
        mes: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const ahora = new Date();
        const anio = input.anio ?? ahora.getFullYear();
        const mes = input.mes ?? (ahora.getMonth() + 1);
        const { getKpiCrecimiento } = await import('./db');
        return getKpiCrecimiento(input.sucursalId, anio, mes);
      }),

    // Rentabilidad (margen bruto y neto)
    rentabilidad: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number().optional(),
        mes: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const ahora = new Date();
        const anio = input.anio ?? ahora.getFullYear();
        const mes = input.mes ?? (ahora.getMonth() + 1);
        const { getKpiRentabilidad } = await import('./db');
        return getKpiRentabilidad(input.sucursalId, anio, mes);
      }),

    // Eficiencia operativa (gastos como % de ventas)
    eficiencia: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number().optional(),
        mes: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const ahora = new Date();
        const anio = input.anio ?? ahora.getFullYear();
        const mes = input.mes ?? (ahora.getMonth() + 1);
        const { getKpiEficiencia } = await import('./db');
        return getKpiEficiencia(input.sucursalId, anio, mes);
      }),
  }),

  // ─── Gastos Operativos ────────────────────────────────────────────────────────
  gastosOperativos: router({
    list: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number(),
        mes: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getGastosOperativos } = await import('./db');
        return getGastosOperativos(input.sucursalId, input.anio, input.mes);
      }),

    upsert: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        anio: z.number(),
        mes: z.number(),
        renta: z.number().optional(),
        nomina: z.number().optional(),
        insumos: z.number().optional(),
        servicios: z.number().optional(),
        mantenimiento: z.number().optional(),
        marketing: z.number().optional(),
        otros: z.number().optional(),
        costoProducto: z.number().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { gastosOperativos } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const renta = input.renta ?? 0;
        const nomina = input.nomina ?? 0;
        const insumos = input.insumos ?? 0;
        const servicios = input.servicios ?? 0;
        const mantenimiento = input.mantenimiento ?? 0;
        const marketing = input.marketing ?? 0;
        const otros = input.otros ?? 0;
        const totalGastos = renta + nomina + insumos + servicios + mantenimiento + marketing + otros;
        const existing = await db.select().from(gastosOperativos)
          .where(and(
            eq(gastosOperativos.sucursalId, input.sucursalId),
            eq(gastosOperativos.anio, input.anio),
            eq(gastosOperativos.mes, input.mes)
          )).limit(1);
        const data = { renta, nomina, insumos, servicios, mantenimiento, marketing, otros, totalGastos,
          costoProducto: input.costoProducto ?? 0, notas: input.notas };
        if (existing.length > 0) {
          await db.update(gastosOperativos).set(data).where(eq(gastosOperativos.id, existing[0].id));
          return { id: existing[0].id, updated: true };
        } else {
          const [result] = await db.insert(gastosOperativos).values({
            sucursalId: input.sucursalId, anio: input.anio, mes: input.mes, ...data,
          });
          return { id: (result as any).insertId, updated: false };
        }
       }),
  }),

  // ─── Turno: Apertura y Cierre ─────────────────────────────────────────────────
  turno: router({
    // Registrar apertura de turno
    registrarApertura: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        empleadoId: z.number(),
        fecha: z.string(),
        tipoTurno: z.enum(['matutino', 'vespertino']),
        conteoVasos: z.number().optional(),
        conteoPopotes: z.number().optional(),
        baseSnowteaKg: z.number().optional(),
        longanKg: z.number().optional(),
        fotoSelladoUrl: z.string().optional(),
        contadorSelladora: z.number().optional(),
        fotoUniformeUrl: z.string().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { registrarAperturaTurno } = await import('./db');
        const id = await registrarAperturaTurno({
          ...input,
          usuarioId: ctx.user.id,
          timestamp: Date.now(),
        });
        return { success: true, id };
      }),

    // Obtener apertura de hoy para una sucursal
    getAperturaHoy: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fecha: z.string(),
        tipoTurno: z.enum(['matutino', 'vespertino']).optional(),
      }))
      .query(async ({ input }) => {
        const { getAperturaHoy } = await import('./db');
        return getAperturaHoy(input.sucursalId, input.fecha, input.tipoTurno);
      }),

    // Obtener todas las aperturas de una fecha
    getAperturasByFecha: protectedProcedure
      .input(z.object({ sucursalId: z.number(), fecha: z.string() }))
      .query(async ({ input }) => {
        const { getAperturasByFecha } = await import('./db');
        return getAperturasByFecha(input.sucursalId, input.fecha);
      }),

    // Registrar cierre de turno
    registrarCierre: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        empleadoId: z.number(),
        fecha: z.string(),
        tipoTurno: z.enum(['matutino', 'vespertino']),
        conteoVasosFinal: z.number().optional(),
        conteoPopotesFinal: z.number().optional(),
        fotoSelladoCierreUrl: z.string().optional(),
        contadorSelladoraCierre: z.number().optional(),
        vasosVendidosSelladora: z.number().optional(),
        vasosVendidosReporte: z.number().optional(),
        mermaVasos: z.number().optional(),
        novedadesTurno: z.string().optional(),
        incidencias: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { registrarCierreTurno, registrarAsistencia, getUltimoRegistroAsistencia } = await import('./db');
        const now = Date.now();
        const id = await registrarCierreTurno({
          ...input,
          usuarioId: ctx.user.id,
          timestamp: now,
        });
        // Registrar salida automática en asistencia si no hay una reciente (últimas 2h)
        try {
          const ultimo = await getUltimoRegistroAsistencia(input.empleadoId);
          const dosHoras = 2 * 60 * 60 * 1000;
          if (!ultimo || ultimo.tipo !== 'salida' || (now - ultimo.timestamp) > dosHoras) {
            await registrarAsistencia({
              empleadoId: input.empleadoId,
              sucursalId: input.sucursalId,
              tipo: 'salida',
              timestamp: now,
              metodo: 'manual',
              registradoPorId: ctx.user.id,
              notas: 'Salida automática al cerrar turno',
            });
          }
        } catch (_) {
          // No bloquear el cierre si falla el registro de asistencia
        }
        
        
        // ── Cruce automático vasos Odoo ─────────────────────────────────
        try {
          const { sql: sqlOdoo } = await import("drizzle-orm");
          const { getDb } = await import("./db");
          const db2 = await getDb();
          if (db2) {
            const odooRows = await db2.execute(sqlOdoo`
              SELECT COALESCE(SUM(vc.cantidad), 0) as total
              FROM inv_ventas_captura vc
              JOIN inv_productos_venta pv ON pv.id = vc.productoVentaId
              WHERE vc.sucursalId = ${input.sucursalId}
                AND vc.fecha = ${input.fecha}
                AND pv.nombre NOT LIKE '%Topping%'
                AND pv.nombre NOT LIKE '%Cortesia%'
            `);
            const vasosOdoo = Number((odooRows[0] as any[])[0]?.total ?? 0);
            const vasosSelladoras = input.vasosVendidosSelladora ?? 0;
            const diferencia = vasosOdoo > 0 && vasosSelladoras > 0
              ? Math.abs(vasosOdoo - vasosSelladoras) : null;
            const alerta = diferencia !== null && diferencia > 5;
            await db2.execute(sqlOdoo`
              UPDATE turno_cierre SET vasosOdoo = ${vasosOdoo},
              diferenciaCuadre = ${diferencia ?? 0}, alertaCuadre = ${alerta ? 1 : 0}
              WHERE id = ${id}
            `);
            if (alerta && vasosOdoo > 0) {
              const nodemailer = await import("nodemailer");
              const transporter = nodemailer.default.createTransport({
                host:"smtp.gmail.com", port:587, secure:false,
                auth:{user:process.env.SMTP_USER, pass:process.env.SMTP_PASS}
              });
              const sucRows = await db2.execute(sqlOdoo`SELECT nombre FROM sucursales WHERE id = ${input.sucursalId}`);
              const sucNombre = (sucRows[0] as any[])[0]?.nombre ?? "Tienda";
              const turno = input.tipoTurno === "matutino" ? "Matutino" : "Vespertino";
              const fmt = (n: number) => n.toLocaleString("es-MX");
              const color = diferencia > 15 ? "#dc2626" : "#d97706";
              const emails = (process.env.REPORT_EMAILS||"").split(",").map((e:string)=>e.trim()).filter(Boolean);
              await transporter.sendMail({
                from:`"SECOF Snowtea" <${process.env.SMTP_USER}>`,
                to: emails.join(", "),
                subject:`🥤 Alerta: ${fmt(diferencia!)} vasos diferencia — ${sucNombre} ${turno} ${input.fecha}`,
                html:`<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px">
                  <h2 style="color:${color}">🥤 Cuadre de Vasos — Alerta</h2>
                  <p><b>${sucNombre}</b> · Turno ${turno} · ${input.fecha}</p>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr><td style="padding:8px;background:#f0fdf4"><b>Odoo:</b></td><td style="padding:8px">${fmt(vasosOdoo)} vasos</td></tr>
                    <tr><td style="padding:8px;background:#fef3c7"><b>Selladora:</b></td><td style="padding:8px">${fmt(vasosSelladoras)} vasos</td></tr>
                    <tr><td style="padding:8px;background:#fef2f2"><b>Diferencia:</b></td><td style="padding:8px;color:${color};font-weight:700">${fmt(diferencia!)} vasos</td></tr>
                  </table>
                  <p style="color:#991b1b">⚠️ Revisar posible merma, venta no capturada o descuadre en selladora.</p>
                </div>`
              });
              console.log(`[Cuadre] Alerta enviada: ${diferencia} vasos (${sucNombre} ${turno})`);
            } else if (vasosOdoo > 0) {
              console.log(`[Cuadre] OK: Odoo=${vasosOdoo} Selladora=${vasosSelladoras} Diff=${diferencia}`);
            }
          }
        } catch(cuadreErr) { console.error("[Cuadre] Error:", cuadreErr); }
        // ────────────────────────────────────────────────────────────────
return { success: true, id };
      }),

    // Obtener cierre de hoy
    getCierreHoy: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fecha: z.string(),
        tipoTurno: z.enum(['matutino', 'vespertino']).optional(),
      }))
      .query(async ({ input }) => {
        const { getCierreHoy } = await import('./db');
        return getCierreHoy(input.sucursalId, input.fecha, input.tipoTurno);
      }),

    // Historial de cierres para merma
    getCierresByRango: protectedProcedure
      .input(z.object({ sucursalId: z.number(), fechaInicio: z.string(), fechaFin: z.string() }))
      .query(async ({ input }) => {
        const { getCierresByRango } = await import('./db');
        return getCierresByRango(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    // Resumen de merma mensual
    getMermaResumen: protectedProcedure
      .input(z.object({ sucursalId: z.number(), anio: z.number(), mes: z.number() }))
      .query(async ({ input }) => {
        const { getMermaResumen } = await import('./db');
        return getMermaResumen(input.sucursalId, input.anio, input.mes);
      }),

    // Subir foto (selladora o uniforme) a S3 y devolver URL
    subirFoto: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string().default('image/jpeg'),
        tipo: z.enum(['selladora', 'uniforme', 'selladora_cierre']),
        sucursalId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('./storage');
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.mimeType.includes('png') ? 'png' : 'jpg';
        const key = `turnos/${input.sucursalId}/${input.tipo}-${ctx.user.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url };
      }),

    // Obtener cuadres recientes de todas las sucursales (para merma en dashboard)
    getCuadresRecientes: protectedProcedure
      .input(z.object({ dias: z.number().default(7), sucursalId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getCierresByRango, getSucursales, getSucursalesAsignadas } = await import('./db');
        const hoy = new Date();
        const inicio = new Date(hoy);
        inicio.setDate(inicio.getDate() - input.dias);
        const pad = (n: number) => String(n).padStart(2, '0');
        const fechaInicio = `${inicio.getFullYear()}-${pad(inicio.getMonth() + 1)}-${pad(inicio.getDate())}`;
        const fechaFin = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
        let sucursalesToQuery: { id: number; nombre: string }[];
        if (input.sucursalId) {
          const all = await getSucursales();
          sucursalesToQuery = all.filter((s: any) => s.id === input.sucursalId);
        } else if (['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          sucursalesToQuery = await getSucursales();
        } else {
          sucursalesToQuery = await getSucursalesAsignadas(ctx.user.id);
        }
        const resultados: any[] = [];
        for (const s of sucursalesToQuery) {
          const cierres = await getCierresByRango(s.id, fechaInicio, fechaFin);
          for (const c of cierres) {
            resultados.push({ ...c, sucursalNombre: s.nombre });
          }
        }
        return resultados;
      }),

    // Obtener registros de turno con fotos (apertura + cierre) para líder/manager/dueño
    getRegistrosTurnoConFotos: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getRegistrosTurnoConFotos } = await import('./db');
        return getRegistrosTurnoConFotos(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    // Registrar salida simple (sin proceso de cierre) cuando no es el último empleado en turno
    registrarSalidaSimple: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        sucursalId: z.number(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { registrarAsistencia, getUltimoRegistroAsistencia } = await import('./db');
        const now = Date.now();
        // Verificar que no haya una salida reciente (evitar duplicados)
        const ultimo = await getUltimoRegistroAsistencia(input.empleadoId);
        const dosHoras = 2 * 60 * 60 * 1000;
        if (ultimo && ultimo.tipo === 'salida' && (now - ultimo.timestamp) < dosHoras) {
          return { success: true, message: 'Ya se registró una salida recientemente' };
        }
        await registrarAsistencia({
          empleadoId: input.empleadoId,
          sucursalId: input.sucursalId,
          tipo: 'salida',
          timestamp: now,
          metodo: 'manual',
          registradoPorId: ctx.user.id,
          notas: input.notas ?? 'Salida sin cierre de turno',
        });
        return { success: true };
      }),
    // Detectar número en foto de selladora via LLM vision
    detectarContadorSelladora: protectedProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        const response = await invokeLLM({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url' as const,
                  image_url: { url: input.imageUrl, detail: 'high' as const },
                },
                {
                  type: 'text' as const,
                  text: 'Esta es una foto del contador de una selladora de vasos. Por favor extrae ÚNICAMENTE el número que aparece en el display o contador. Responde solo con el número entero, sin texto adicional. Si no puedes leer el número claramente, responde con "?".',
                },
              ],
            },
          ],
        });
        const rawContent = response?.choices?.[0]?.message?.content;
        const texto = (typeof rawContent === 'string' ? rawContent : '?').trim();
        const numero = parseInt(texto.replace(/[^0-9]/g, ''));
        return { texto, numero: isNaN(numero) ? null : numero };
      }),
  }),

  // ─── Avisos Generales ──────────────────────────────────────────────────────
  avisos: router({
    // Obtener avisos activos (para empleados al iniciar turno)
    getActivos: protectedProcedure
      .input(z.object({ sucursalId: z.number().optional(), fecha: z.string().optional() }))
      .query(async ({ input }) => {
        const { getAvisosActivos } = await import('./db');
        return getAvisosActivos(input.sucursalId, input.fecha);
      }),

    // Obtener todos los avisos (para admin)
    getAll: protectedProcedure
      .input(z.object({ sucursalId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getAllAvisos } = await import('./db');
        return getAllAvisos(input.sucursalId);
      }),

    // Crear aviso
    create: protectedProcedure
      .input(z.object({
        sucursalId: z.number().optional(),
        titulo: z.string().min(1),
        contenido: z.string().min(1),
        tipo: z.enum(['info', 'urgente', 'recordatorio']),
        fechaExpiracion: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createAviso } = await import('./db');
        const id = await createAviso({ ...input, creadoPorId: ctx.user.id });
        return { success: true, id };
      }),

    // Actualizar aviso
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().optional(),
        contenido: z.string().optional(),
        tipo: z.enum(['info', 'urgente', 'recordatorio']).optional(),
        activo: z.boolean().optional(),
        fechaExpiracion: z.string().nullable().optional(),
        sucursalId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { updateAviso } = await import('./db');
        const { id, ...data } = input;
        await updateAviso(id, data as any);
        return { success: true };
      }),

    // Eliminar aviso
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'manager', 'superadmin'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { deleteAviso } = await import('./db');
        await deleteAviso(input.id);
        return { success: true };
      }),
  }),

  // ─── Control de Asistencias / Nómina ────────────────────────────────────────
  nomina: router({
    // Calcular/recalcular registros de nómina para una sucursal y rango de fechas
    calcular: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { calcularRegistrosNomina } = await import('./db');
        await calcularRegistrosNomina(input.sucursalId, input.fechaInicio, input.fechaFin);
        return { success: true };
      }),

    // Obtener registros detallados por día
    getRegistros: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getRegistrosNomina } = await import('./db');
        return getRegistrosNomina(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    // Resumen semanal por empleado
    getResumen: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.string(),
        fechaFin: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getResumenNominaSemanal } = await import('./db');
        return getResumenNominaSemanal(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    // Justificar / editar un registro manualmente
    justificar: protectedProcedure
      .input(z.object({
        id: z.number(),
        estado: z.enum(['ausencia_justificada', 'presente', 'retardo']),
        justificacion: z.string().min(5),
        tipoJustificacion: z.enum(['enfermedad', 'permiso_personal', 'emergencia_familiar', 'capacitacion', 'vacaciones', 'error_sistema', 'otro']),
        fotoJustificacionUrl: z.string().optional(),
        horasTrabajadas: z.number().optional(),
        minutosRetardo: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { justificarRegistroNomina } = await import('./db');
        await justificarRegistroNomina(input.id, {
          ...input,
          editadoPorId: ctx.user.id,
        });
        return { success: true };
      }),
    // Snapshot mensual — historial de KPIs por mes
    snapshotHistorial: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        meses: z.number().default(6),
      }))
      .query(async ({ ctx, input }) => {
        if (!['owner','superadmin','manager','leader'].includes(ctx.user.role))
          throw new TRPCError({ code: 'FORBIDDEN' });
        const { getDb } = await import('./db');
        const { sql } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        const rows = await db.execute(sql`
          SELECT * FROM kpi_snapshot_mensual
          WHERE sucursalId = ${input.sucursalId} AND puesto = 'lider'
          ORDER BY mes DESC LIMIT ${input.meses}
        `);
        return (rows[0] as any[]).reverse();
      }),

    // Calcular y guardar snapshot del mes actual (llamado manual o por scheduler)
    calcularSnapshot: protectedProcedure
      .input(z.object({ sucursalId: z.number(), mes: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner','superadmin','manager'].includes(ctx.user.role))
          throw new TRPCError({ code: 'FORBIDDEN' });
        const { calcularKpiSnapshotMensual } = await import('./services/kpiService');
        return calcularKpiSnapshotMensual(input.sucursalId, input.mes);
      }),

  }),
});

export type AppRouter = typeof appRouter;

