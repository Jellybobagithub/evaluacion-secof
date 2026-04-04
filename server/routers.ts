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
  getSucursalesAsignadas, getEvaluacionesByUser,
} from "./db";
import { calcularPuntuacion } from "../shared/evaluacionData";
import { horariosRouter } from "./routers/horarios";
import { preparacionesRouter } from "./routers/preparaciones";
import { observacionRouter } from "./routers/observacion";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  preparaciones: preparacionesRouter,
  observacion: observacionRouter,

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
        dias: z.number().min(7).max(365).optional(),
        sucursalId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getReportesDiarios } = await import('./db');
        const dias = input.dias ?? 30;
        const todos = await getReportesDiarios(input.sucursalId, undefined, 1000);
        const corte = new Date();
        corte.setDate(corte.getDate() - dias);
        const recientes = todos.filter(r => new Date(r.fecha) >= corte && r.estado === 'enviado');
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
        return { serie, totalVentas, totalEfectivo, totalTarjeta, totalRappi, dias };
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { createEmpleado } = await import('./db');
        await createEmpleado({
          sucursalId: input.sucursalId,
          nombre: input.nombre,
          apellido: input.apellido,
          rol: input.rol,
          telefono: input.telefono,
          fechaIngreso: input.fechaIngreso ? new Date(input.fechaIngreso) : new Date(),
          notas: input.notas,
          tipoContrato: input.tipoContrato ?? 'fulltime',
          diasDisponibles: input.diasDisponibles,
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
  asistencia: router({
    // Endpoint público para registro por QR (desde celular sin login)
    registrarQr: publicProcedure
      .input(z.object({
        qrToken: z.string(),
        empleadoId: z.number(),
        tipo: z.enum(['entrada', 'salida']),
        latitud: z.number().optional(),
        longitud: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getSucursalByQrToken, registrarAsistencia, getUltimoRegistroAsistencia } = await import('./db');
        const sucursal = await getSucursalByQrToken(input.qrToken);
        if (!sucursal) throw new TRPCError({ code: 'NOT_FOUND', message: 'QR inválido o expirado' });
        // Validar que el empleado pertenece a la sucursal
        const { getEmpleadoById } = await import('./db');
        const empleado = await getEmpleadoById(input.empleadoId);
        if (!empleado || empleado.sucursalId !== sucursal.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Empleado no pertenece a esta sucursal' });
        }
        // Evitar doble entrada/salida en menos de 5 minutos
        const ultimo = await getUltimoRegistroAsistencia(input.empleadoId);
        if (ultimo && ultimo.tipo === input.tipo && Date.now() - ultimo.timestamp < 5 * 60 * 1000) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ya registraste ' + input.tipo + ' recientemente' });
        }
        await registrarAsistencia({
          empleadoId: input.empleadoId,
          sucursalId: sucursal.id,
          tipo: input.tipo,
          timestamp: Date.now(),
          metodo: 'qr',
          latitud: input.latitud,
          longitud: input.longitud,
        });
        return { success: true, sucursalNombre: sucursal.nombre, empleadoNombre: empleado.nombre };
      }),

    // Registro manual por el líder
    registrarManual: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        sucursalId: z.number(),
        tipo: z.enum(['entrada', 'salida']),
        timestamp: z.number(), // Unix ms
        notas: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { registrarAsistencia } = await import('./db');
        await registrarAsistencia({
          ...input,
          metodo: 'manual',
          registradoPorId: ctx.user.id,
        });
        return { success: true };
      }),

    listBySucursal: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        fechaInicio: z.number().optional(),
        fechaFin: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getAsistenciaBySucursal } = await import('./db');
        return getAsistenciaBySucursal(input.sucursalId, input.fechaInicio, input.fechaFin);
      }),

    listByEmpleado: protectedProcedure
      .input(z.object({
        empleadoId: z.number(),
        fechaInicio: z.number().optional(),
        fechaFin: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getAsistenciaByEmpleado } = await import('./db');
        return getAsistenciaByEmpleado(input.empleadoId, input.fechaInicio, input.fechaFin);
      }),

    // Generar/regenerar QR token para una sucursal
    generarQrToken: protectedProcedure
      .input(z.object({ sucursalId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { setQrToken } = await import('./db');
        const crypto = await import('crypto');
        const token = crypto.randomBytes(24).toString('hex');
        await setQrToken(input.sucursalId, token);
        return { token };
      }),

    // Obtener el QR token actual de una sucursal
    getQrToken: protectedProcedure
      .input(z.object({ sucursalId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getSucursalById } = await import('./db');
        const s = await getSucursalById(input.sucursalId);
        return { token: s?.qrToken ?? null };
      }),
  }),

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
        const fechaFin = new Date(year, month, 0, 23, 59, 59);
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
});
export type AppRouter = typeof appRouter;
