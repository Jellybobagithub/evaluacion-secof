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
        ventasTotales: z.number().optional(),
        transacciones: z.number().optional(),
        ticketPromedio: z.number().optional(),
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
        const result = await createReporteDiario({
          ...input,
          fecha: input.fecha ? new Date(input.fecha) : new Date(),
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
            const fecha = input.fecha ? new Date(input.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            const ventas = input.ventasTotales ? `$${input.ventasTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'No registradas';
            await notifyOwner({
              title: `Reporte Diario: ${sucursal?.nombre ?? 'Sucursal'}`,
              content: `${ctx.user.name ?? 'Un colaborador'} envió el reporte del ${fecha}.\nVentas: ${ventas} · Transacciones: ${input.transacciones ?? 0} · Ticket: ${input.ticketPromedio ? '$' + input.ticketPromedio.toFixed(2) : 'N/A'}${input.incidentes ? '\n⚠️ Incidentes: ' + input.incidentes.substring(0, 120) : ''}`,
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
        ventasTotales: z.number().optional(),
        transacciones: z.number().optional(),
        ticketPromedio: z.number().optional(),
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
        await updateReporteDiario(id, { ...rest, ...(fecha ? { fecha: new Date(fecha) } : {}) });
        // Notificar al superadmin cuando se cambia a enviado
        if (input.estado === 'enviado') {
          try {
            const { notifyOwner } = await import('./_core/notification');
            const reporte = await getReporteDiarioById(id);
            if (reporte) {
              const sucursal = await getSucursalById(reporte.sucursalId);
              const fecha = new Date(reporte.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
              const ventas = reporte.ventasTotales ? `$${reporte.ventasTotales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'No registradas';
              await notifyOwner({
                title: `Reporte Diario: ${sucursal?.nombre ?? 'Sucursal'}`,
                content: `${ctx.user.name ?? 'Un colaborador'} envió el reporte del ${fecha}.\nVentas: ${ventas} · Transacciones: ${reporte.transacciones ?? 0} · Ticket: ${reporte.ticketPromedio ? '$' + Number(reporte.ticketPromedio).toFixed(2) : 'N/A'}${reporte.incidentes ? '\n⚠️ Incidentes: ' + reporte.incidentes.substring(0, 120) : ''}`,
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
        const porDia: Record<string, { ventas: number; tx: number; reportes: number }> = {};
        for (const r of recientes) {
          const dia = new Date(r.fecha).toISOString().split('T')[0];
          if (!porDia[dia]) porDia[dia] = { ventas: 0, tx: 0, reportes: 0 };
          porDia[dia].ventas += r.ventasTotales ?? 0;
          porDia[dia].tx += r.transacciones ?? 0;
          porDia[dia].reportes += 1;
        }
        // Construir serie ordenada por fecha
        const serie = Object.entries(porDia)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([fecha, d]) => ({
            fecha,
            ventas: d.ventas,
            transacciones: d.tx,
            ticketPromedio: d.tx > 0 ? d.ventas / d.tx : 0,
            reportes: d.reportes,
          }));
        const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
        const totalTx = recientes.reduce((s, r) => s + (r.transacciones ?? 0), 0);
        return { serie, totalVentas, totalTx, avgTicket: totalTx > 0 ? totalVentas / totalTx : 0, dias };
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
        const totalTx = recientes.reduce((s, r) => s + (r.transacciones ?? 0), 0);
        const avgTicket = totalTx > 0 ? totalVentas / totalTx : 0;
        const reportesPorSucursal: Record<number, { ventas: number; tx: number; reportes: number }> = {};
        for (const r of recientes) {
          if (!reportesPorSucursal[r.sucursalId]) reportesPorSucursal[r.sucursalId] = { ventas: 0, tx: 0, reportes: 0 };
          reportesPorSucursal[r.sucursalId].ventas += r.ventasTotales ?? 0;
          reportesPorSucursal[r.sucursalId].tx += r.transacciones ?? 0;
          reportesPorSucursal[r.sucursalId].reportes += 1;
        }
        return { totalVentas, totalTx, avgTicket, reportesEnviados: recientes.length, reportesPorSucursal, dias };
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
        const totalTx = recientes.reduce((s, r) => s + (r.transacciones ?? 0), 0);
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
          `  Transacciones: ${totalTx}`,
          `  Ticket promedio: ${totalTx > 0 ? '$' + (totalVentas / totalTx).toFixed(2) : 'N/A'}`,
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

  // --- Horarios Semanales ---
  horarios: router({
    list: protectedProcedure
      .input(z.object({ sucursalId: z.number(), semana: z.string() }))
      .query(async ({ input }) => {
        const { getDb } = await import('./db');
        const { horariosSemanales } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return [];
        return db.select().from(horariosSemanales)
          .where(and(eq(horariosSemanales.sucursalId, input.sucursalId), eq(horariosSemanales.semana, input.semana)));
      }),

    upsert: protectedProcedure
      .input(z.object({
        sucursalId: z.number(),
        empleadoId: z.number(),
        semana: z.string(),
        lunes: z.string().nullable().optional(),
        martes: z.string().nullable().optional(),
        miercoles: z.string().nullable().optional(),
        jueves: z.string().nullable().optional(),
        viernes: z.string().nullable().optional(),
        sabado: z.string().nullable().optional(),
        domingo: z.string().nullable().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const { horariosSemanales } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        // Buscar si ya existe
        const existing = await db.select().from(horariosSemanales)
          .where(and(
            eq(horariosSemanales.sucursalId, input.sucursalId),
            eq(horariosSemanales.empleadoId, input.empleadoId),
            eq(horariosSemanales.semana, input.semana)
          ));
        if (existing.length > 0) {
          await db.update(horariosSemanales)
            .set({ lunes: input.lunes ?? null, martes: input.martes ?? null, miercoles: input.miercoles ?? null, jueves: input.jueves ?? null, viernes: input.viernes ?? null, sabado: input.sabado ?? null, domingo: input.domingo ?? null, notas: input.notas })
            .where(eq(horariosSemanales.id, existing[0].id));
        } else {
          await db.insert(horariosSemanales).values({ ...input });
        }
        return { success: true };
      }),

    copyFromPrevious: protectedProcedure
      .input(z.object({ sucursalId: z.number(), semana: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!['owner', 'superadmin', 'manager', 'leader'].includes(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { getDb } = await import('./db');
        const { horariosSemanales } = await import('../drizzle/schema');
        const { eq, and } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB no disponible' });
        // Calcular semana anterior
        const [year, wStr] = input.semana.split('-W');
        const w = Number(wStr);
        const prevSemana = w > 1 ? `${year}-W${String(w - 1).padStart(2, '0')}` : `${Number(year) - 1}-W52`;
        const prevRows = await db.select().from(horariosSemanales)
          .where(and(eq(horariosSemanales.sucursalId, input.sucursalId), eq(horariosSemanales.semana, prevSemana)));
        for (const row of prevRows) {
          const exists = await db.select().from(horariosSemanales)
            .where(and(eq(horariosSemanales.sucursalId, input.sucursalId), eq(horariosSemanales.empleadoId, row.empleadoId), eq(horariosSemanales.semana, input.semana)));
          if (exists.length === 0) {
            await db.insert(horariosSemanales).values({ sucursalId: input.sucursalId, empleadoId: row.empleadoId, semana: input.semana, lunes: row.lunes, martes: row.martes, miercoles: row.miercoles, jueves: row.jueves, viernes: row.viernes, sabado: row.sabado, domingo: row.domingo });
          }
        }
        return { success: true, copiados: prevRows.length };
      }),
  }),
});
export type AppRouter = typeof appRouter;
