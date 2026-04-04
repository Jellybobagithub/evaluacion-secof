/**
 * Router de Horarios Semanales
 * - CRUD de turnos (un turno = un empleado en un día)
 * - Asignación de actividades de limpieza por turno
 * - Sugerencias de distribución equitativa
 * - Lógica de tareas pendientes (arrastre al siguiente turno)
 * - Catálogo de actividades
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Número de semana ISO (lunes = inicio) */
function getISOWeek(dateStr: string): { semana: number; anio: number } {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay() || 7; // 1=lunes ... 7=domingo
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { semana, anio: d.getUTCFullYear() };
}

/** Rango de fechas de la semana ISO (lunes a domingo) */
function getWeekRange(anio: number, semana: number): { inicio: string; fin: string } {
  // Primer jueves del año → semana 1
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const lunes = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000 + (semana - 1) * 7 * 86400000);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  return {
    inicio: lunes.toISOString().slice(0, 10),
    fin: domingo.toISOString().slice(0, 10),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const horariosRouter = router({

  /** Catálogo completo de actividades */
  getCatalogo: protectedProcedure.query(async () => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { actividadesCatalogo } = await import("../../drizzle/schema");
    const { asc } = await import("drizzle-orm");
    return db.select().from(actividadesCatalogo)
      .where((await import("drizzle-orm")).eq(actividadesCatalogo.activa, true))
      .orderBy(actividadesCatalogo.categoria, asc(actividadesCatalogo.orden));
  }),

  /** Horario de una semana para una sucursal (todos los turnos con sus actividades) */
  getSemana: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      anio: z.number(),
      semana: z.number(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades, empleados } = await import("../../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");

      const turnos = await db.select().from(turnosSemana)
        .where(and(
          eq(turnosSemana.sucursalId, input.sucursalId),
          eq(turnosSemana.anio, input.anio),
          eq(turnosSemana.semana, input.semana),
        ))
        .orderBy(turnosSemana.fecha, turnosSemana.horaInicio);

      if (turnos.length === 0) return { turnos: [], actividades: [], empleados: [] };

      const turnoIds = turnos.map(t => t.id);
      const actividades = await db.select().from(turnoActividades)
        .where(inArray(turnoActividades.turnoId, turnoIds));

      const empleadoIds = Array.from(new Set(turnos.map(t => t.empleadoId)));
      const emps = await db.select().from(empleados)
        .where(inArray(empleados.id, empleadoIds));

      const rango = getWeekRange(input.anio, input.semana);

      return { turnos, actividades, empleados: emps, rango };
    }),

  /** Crear un turno */
  crearTurno: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      empleadoId: z.number(),
      fecha: z.string(), // "2026-04-07"
      puesto: z.string().optional(),
      turno: z.enum(["matutino", "intermedio", "vespertino", "anfitrion"]),
      horaInicio: z.string(),
      horaFin: z.string(),
      rolPrincipal: z.string().optional(),
      comentarios: z.string().optional(),
      actividades: z.array(z.string()).default([]), // claves: ["D1","D2","S3"]
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "superadmin", "manager", "leader"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades } = await import("../../drizzle/schema");

      const { semana, anio } = getISOWeek(input.fecha);

      const [result] = await db.insert(turnosSemana).values({
        sucursalId: input.sucursalId,
        empleadoId: input.empleadoId,
        fecha: input.fecha,
        semana,
        anio,
        puesto: input.puesto,
        turno: input.turno,
        horaInicio: input.horaInicio,
        horaFin: input.horaFin,
        rolPrincipal: input.rolPrincipal,
        comentarios: input.comentarios,
        createdBy: ctx.user.id,
      });
      const turnoId = (result as any).insertId as number;

      // Insertar actividades asignadas
      if (input.actividades.length > 0) {
        await db.insert(turnoActividades).values(
          input.actividades.map(clave => ({
            turnoId,
            actividadClave: clave,
            esPendiente: false,
          }))
        );
      }

      return { id: turnoId, semana, anio };
    }),

  /** Actualizar un turno (datos + actividades) */
  actualizarTurno: protectedProcedure
    .input(z.object({
      id: z.number(),
      puesto: z.string().optional(),
      turno: z.enum(["matutino", "intermedio", "vespertino", "anfitrion"]).optional(),
      horaInicio: z.string().optional(),
      horaFin: z.string().optional(),
      rolPrincipal: z.string().optional(),
      comentarios: z.string().optional(),
      actividades: z.array(z.string()).optional(), // si se pasa, reemplaza todas
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "superadmin", "manager", "leader"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const updateData: Record<string, any> = {};
      if (input.puesto !== undefined) updateData.puesto = input.puesto;
      if (input.turno !== undefined) updateData.turno = input.turno;
      if (input.horaInicio !== undefined) updateData.horaInicio = input.horaInicio;
      if (input.horaFin !== undefined) updateData.horaFin = input.horaFin;
      if (input.rolPrincipal !== undefined) updateData.rolPrincipal = input.rolPrincipal;
      if (input.comentarios !== undefined) updateData.comentarios = input.comentarios;

      if (Object.keys(updateData).length > 0) {
        await db.update(turnosSemana).set(updateData).where(eq(turnosSemana.id, input.id));
      }

      // Reemplazar actividades si se proporcionan
      if (input.actividades !== undefined) {
        // Eliminar solo las no completadas (conservar las ya palomeadas)
        const existentes = await db.select().from(turnoActividades)
          .where(and(eq(turnoActividades.turnoId, input.id), eq(turnoActividades.completada, false)));
        if (existentes.length > 0) {
          const { inArray } = await import("drizzle-orm");
          await db.delete(turnoActividades)
            .where(inArray(turnoActividades.id, existentes.map(e => e.id)));
        }
        if (input.actividades.length > 0) {
          await db.insert(turnoActividades).values(
            input.actividades.map(clave => ({
              turnoId: input.id,
              actividadClave: clave,
              esPendiente: false,
            }))
          );
        }
      }

      return { ok: true };
    }),

  /** Eliminar un turno y sus actividades */
  eliminarTurno: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "superadmin", "manager", "leader"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await db.delete(turnoActividades).where(eq(turnoActividades.turnoId, input.id));
      await db.delete(turnosSemana).where(eq(turnosSemana.id, input.id));
      return { ok: true };
    }),

  /** Palomear / despalomear una actividad */
  toggleActividad: protectedProcedure
    .input(z.object({
      turnoActividadId: z.number(),
      completada: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnoActividades } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      await db.update(turnoActividades).set({
        completada: input.completada,
        completadaAt: input.completada ? new Date() : null,
        completadaPorId: input.completada ? ctx.user.id : null,
      }).where(eq(turnoActividades.id, input.turnoActividadId));

      return { ok: true };
    }),

  /** Cerrar turno: marca pendientes y las arrastra al siguiente turno del empleado */
  cerrarTurno: protectedProcedure
    .input(z.object({ turnoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades } = await import("../../drizzle/schema");
      const { eq, and, gt } = await import("drizzle-orm");

      // Obtener el turno
      const [turno] = await db.select().from(turnosSemana).where(eq(turnosSemana.id, input.turnoId)).limit(1);
      if (!turno) throw new TRPCError({ code: "NOT_FOUND" });

      // Marcar turno como cerrado
      await db.update(turnosSemana).set({ cerrado: true, cerradoAt: new Date() })
        .where(eq(turnosSemana.id, input.turnoId));

      // Obtener actividades no completadas (solo diarias D - las S/B/M se arrastran siempre)
      const pendientes = await db.select().from(turnoActividades)
        .where(and(
          eq(turnoActividades.turnoId, input.turnoId),
          eq(turnoActividades.completada, false),
        ));

      if (pendientes.length === 0) return { ok: true, pendientesArrastradas: 0 };

      // Buscar el próximo turno del mismo empleado (fecha > hoy)
      const proximosTurnos = await db.select().from(turnosSemana)
        .where(and(
          eq(turnosSemana.empleadoId, turno.empleadoId),
          eq(turnosSemana.sucursalId, turno.sucursalId),
          gt(turnosSemana.fecha, turno.fecha),
          eq(turnosSemana.cerrado, false),
        ))
        .orderBy(turnosSemana.fecha, turnosSemana.horaInicio)
        .limit(1);

      if (proximosTurnos.length > 0) {
        const proximoTurnoId = proximosTurnos[0].id;
        // Insertar pendientes en el próximo turno
        await db.insert(turnoActividades).values(
          pendientes.map(p => ({
            turnoId: proximoTurnoId,
            actividadClave: p.actividadClave,
            esPendiente: true,
            turnoOrigenId: input.turnoId,
          }))
        );
      }

      // Notificar al líder/manager si hay pendientes
      if (pendientes.length > 0) {
        try {
          const { notifyOwner } = await import("../_core/notification");
          const clavesStr = pendientes.map(p => p.actividadClave).join(", ");
          await notifyOwner({
            title: `⚠️ Turno cerrado con ${pendientes.length} actividad(es) pendiente(s)`,
            content: `El empleado cerró su turno del ${turno.fecha} (${turno.turno}) con las siguientes actividades sin completar: ${clavesStr}. Estas han sido asignadas a su próximo turno.`,
          });
        } catch (_) { /* notificación no crítica */ }
      }

      return { ok: true, pendientesArrastradas: pendientes.length };
    }),

  /** Mi turno del día (para el empleado logueado) */
  miTurnoHoy: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      empleadoId: z.number(),
      fecha: z.string(), // "2026-04-07"
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const turnos = await db.select().from(turnosSemana)
        .where(and(
          eq(turnosSemana.sucursalId, input.sucursalId),
          eq(turnosSemana.empleadoId, input.empleadoId),
          eq(turnosSemana.fecha, input.fecha),
        ))
        .orderBy(turnosSemana.horaInicio);

      if (turnos.length === 0) return null;

      const turno = turnos[0];
      const actividades = await db.select().from(turnoActividades)
        .where(eq(turnoActividades.turnoId, turno.id))
        .orderBy(turnoActividades.esPendiente, turnoActividades.actividadClave);

      // Enriquecer con descripción del catálogo
      const { actividadesCatalogo } = await import("../../drizzle/schema");
      const catalogo = await db.select().from(actividadesCatalogo);
      const catalogoMap: Record<string, { descripcion: string; categoria: string }> = {};
      for (const c of catalogo) {
        catalogoMap[c.clave] = { descripcion: c.descripcion, categoria: c.categoria };
      }

      const actividadesEnriquecidas = actividades.map(a => ({
        ...a,
        descripcion: catalogoMap[a.actividadClave]?.descripcion ?? a.actividadClave,
        categoria: catalogoMap[a.actividadClave]?.categoria ?? 'D',
      }));

      return { turno, actividades: actividadesEnriquecidas };
    }),

  /** Subir foto de evidencia para una actividad (URL directa) */
  subirEvidencia: protectedProcedure
    .input(z.object({
      turnoActividadId: z.number(),
      evidenciaUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnoActividades } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(turnoActividades)
        .set({ evidenciaUrl: input.evidenciaUrl })
        .where(eq(turnoActividades.id, input.turnoActividadId));
      return { ok: true };
    }),

  /** Subir foto de evidencia en base64 y guardar en S3 */
  subirEvidenciaBase64: protectedProcedure
    .input(z.object({
      turnoActividadId: z.number(),
      dataUrl: z.string().min(10), // "data:image/jpeg;base64,..."
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { storagePut } = await import("../storage");
      const base64 = input.dataUrl.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const ext = input.mimeType === "image/png" ? "png" : "jpg";
      const key = `evidencias-turno/${input.turnoActividadId}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const { turnoActividades } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(turnoActividades)
        .set({ evidenciaUrl: url })
        .where(eq(turnoActividades.id, input.turnoActividadId));
      return { ok: true, url };
    }),

  /** Generar horario automático completo para una semana */
  generarHorarioAutomatico: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      anio: z.number(),
      semana: z.number(),
      sobreescribir: z.boolean().default(false), // si true, borra y regenera
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner", "superadmin", "manager", "leader"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, turnoActividades, empleados, actividadesCatalogo } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, inArray } = await import("drizzle-orm");

      // Si sobreescribir, eliminar turnos existentes de la semana
      if (input.sobreescribir) {
        const turnosExistentes = await db.select({ id: turnosSemana.id })
          .from(turnosSemana)
          .where(and(
            eq(turnosSemana.sucursalId, input.sucursalId),
            eq(turnosSemana.anio, input.anio),
            eq(turnosSemana.semana, input.semana),
          ));
        if (turnosExistentes.length > 0) {
          const ids = turnosExistentes.map(t => t.id);
          await db.delete(turnoActividades).where(inArray(turnoActividades.turnoId, ids));
          await db.delete(turnosSemana).where(inArray(turnosSemana.id, ids));
        }
      } else {
        // Verificar si ya hay turnos
        const existentes = await db.select({ id: turnosSemana.id })
          .from(turnosSemana)
          .where(and(
            eq(turnosSemana.sucursalId, input.sucursalId),
            eq(turnosSemana.anio, input.anio),
            eq(turnosSemana.semana, input.semana),
          ));
        if (existentes.length > 0) {
          return { ok: true, turnosCreados: 0, mensaje: "Ya existe horario para esta semana. Usa sobreescribir=true para regenerar." };
        }
      }

      // Obtener empleados activos
      const emps = await db.select().from(empleados)
        .where(and(eq(empleados.sucursalId, input.sucursalId), eq(empleados.activo, true)));
      if (emps.length === 0) return { ok: false, turnosCreados: 0, mensaje: "No hay empleados activos en esta sucursal." };

      // ── Disponibilidad por empleado ──────────────────────────────────────────
      // Mapear tipo de contrato a días disponibles (0=dom, 1=lun, 2=mar, 3=mié, 4=jue, 5=vie, 6=sáb)
      function getDiasDisponibles(emp: typeof emps[0]): number[] {
        switch (emp.tipoContrato) {
          case "finde_ext": return [5, 6, 0]; // vie, sáb, dom
          case "finde":     return [6, 0];    // sáb, dom
          case "custom": {
            try { return JSON.parse(emp.diasDisponibles ?? "[]") as number[]; } catch { return [1,2,3,4,5]; }
          }
          case "fulltime":
          default:          return [1, 2, 3, 4, 5, 6, 0]; // todos los días
        }
      }

      // Para fulltime: rastrear cuándo fue su último descanso (lun/mar/mié)
      // para rotar equitativamente
      const diasDescansoRotativo = [1, 2, 3]; // lun, mar, mié
      const ultimoDescanso: Record<number, number> = {}; // empleadoId -> semana del último descanso
      const turnosDescanso = await db.select({ empleadoId: turnosSemana.empleadoId, fecha: turnosSemana.fecha })
        .from(turnosSemana)
        .where(and(
          eq(turnosSemana.sucursalId, input.sucursalId),
          gte(turnosSemana.semana, input.semana - 8),
          lte(turnosSemana.semana, input.semana - 1),
        ));
      // Detectar días trabajados (si no hay turno un lun/mar/mié = fue descanso)
      // Simplificación: contar cuántas semanas lleva sin descanso entre lun-mié
      const semanasTrabajadasSinDescanso: Record<number, number> = {};
      for (const e of emps) semanasTrabajadasSinDescanso[e.id] = 0;
      // Ordenar por empleado que más tiempo lleva sin descanso lun-mié para asignarle el descanso primero
      const descansoAsignado: Record<number, number | null> = {}; // empleadoId -> día de semana (1,2,3) asignado para descanso
      const fulltimeEmps = emps.filter(e => e.tipoContrato === "fulltime");
      // Rotar: asignar descanso a cada fulltime en orden, usando los 3 días disponibles
      fulltimeEmps.forEach((e, idx) => {
        descansoAsignado[e.id] = diasDescansoRotativo[idx % diasDescansoRotativo.length];
      });

      // Calcular horas trabajadas en las últimas 4 semanas para distribución equitativa
      const semanaInicio = input.semana - 4;
      const horasPorEmpleado: Record<number, number> = {};
      for (const e of emps) horasPorEmpleado[e.id] = 0;

      const turnosRecientes = await db.select().from(turnosSemana)
        .where(and(
          eq(turnosSemana.sucursalId, input.sucursalId),
          eq(turnosSemana.anio, input.anio),
          gte(turnosSemana.semana, semanaInicio),
          lte(turnosSemana.semana, input.semana - 1),
        ));

      for (const t of turnosRecientes) {
        if (horasPorEmpleado[t.empleadoId] === undefined) horasPorEmpleado[t.empleadoId] = 0;
        const [hi, mi] = t.horaInicio.split(":").map(Number);
        const [hf, mf] = t.horaFin.split(":").map(Number);
        horasPorEmpleado[t.empleadoId] += (hf * 60 + mf - hi * 60 - mi) / 60;
      }

      // Obtener actividades pendientes S/B de semanas anteriores
      const turnosRecientesIds = turnosRecientes.map(t => t.id);
      let actividadesCompletadasSB: string[] = [];
      if (turnosRecientesIds.length > 0) {
        const completadas = await db.select({ clave: turnoActividades.actividadClave })
          .from(turnoActividades)
          .where(and(
            inArray(turnoActividades.turnoId, turnosRecientesIds),
            eq(turnoActividades.completada, true),
          ));
        actividadesCompletadasSB = completadas.map(a => a.clave);
      }

      // Obtener catálogo completo
      const catalogo = await db.select().from(actividadesCatalogo)
        .where(eq(actividadesCatalogo.activa, true));
      const actividadesD = catalogo.filter(a => a.categoria === "D").map(a => a.clave);
      const actividadesSB = catalogo
        .filter(a => ["S", "B"].includes(a.categoria) && !actividadesCompletadasSB.includes(a.clave))
        .map(a => a.clave);
      const actividadesM = catalogo.filter(a => a.categoria === "M").map(a => a.clave);

      // Calcular rango de fechas de la semana
      const rango = getWeekRange(input.anio, input.semana);
      const fechas: string[] = [];
      const d = new Date(rango.inicio + "T00:00:00Z");
      for (let i = 0; i < 7; i++) {
        fechas.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
      }

      // Configuración de turnos por día
      // Lunes-Viernes: matutino + vespertino; Sábado-Domingo: matutino + intermedio
      const TURNOS_SEMANA = [
        { turno: "matutino" as const, horaInicio: "09:00", horaFin: "15:00" },
        { turno: "vespertino" as const, horaInicio: "15:00", horaFin: "21:00" },
      ];
      const TURNOS_FIN_SEMANA = [
        { turno: "matutino" as const, horaInicio: "09:00", horaFin: "15:00" },
        { turno: "intermedio" as const, horaInicio: "13:00", horaFin: "21:00" },
      ];

      // Ordenar empleados por menos horas (para asignar más a quien tiene menos)
      const empOrdenados = [...emps].sort((a, b) =>
        (horasPorEmpleado[a.id] ?? 0) - (horasPorEmpleado[b.id] ?? 0)
      );

      let turnosCreados = 0;
      let empIdx = 0;
      const actividadesSBPorDia = Math.ceil(actividadesSB.length / Math.max(fechas.length, 1));
      let sbOffset = 0;
      // Actividades M: solo el primer día de la semana
      const asignarM = actividadesM.length > 0;

      for (let dIdx = 0; dIdx < fechas.length; dIdx++) {
        const fecha = fechas[dIdx];
        // día de semana JS: 0=dom, 1=lun, ..., 6=sáb
        const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
        const esFinde = diaSemana === 0 || diaSemana === 6;
        const turnosDia = esFinde ? TURNOS_FIN_SEMANA : TURNOS_SEMANA;

        // Empleados disponibles este día (respetando tipoContrato y descanso fulltime)
        const empsDisponiblesHoy = empOrdenados.filter(emp => {
          const dias = getDiasDisponibles(emp);
          if (!dias.includes(diaSemana)) return false;
          // Si es fulltime y tiene descanso asignado hoy, saltarlo
          if (emp.tipoContrato === "fulltime" && descansoAsignado[emp.id] === diaSemana) return false;
          return true;
        });

        if (empsDisponiblesHoy.length === 0) continue;

        for (const turnoConfig of turnosDia) {
          const emp = empsDisponiblesHoy[empIdx % empsDisponiblesHoy.length];
          empIdx++;

          // Calcular actividades para este turno
          const actsTurno: string[] = [...actividadesD];

          // Distribuir S/B equitativamente entre los días
          const sbSlice = actividadesSB.slice(sbOffset, sbOffset + actividadesSBPorDia);
          actsTurno.push(...sbSlice);
          sbOffset += sbSlice.length;

          // Actividades M solo el primer turno del lunes
          if (dIdx === 0 && turnoConfig.turno === "matutino" && asignarM) {
            actsTurno.push(...actividadesM);
          }

          // Crear el turno
          const { semana: semanaNum, anio: anioNum } = getISOWeek(fecha);
          const [result] = await db.insert(turnosSemana).values({
            sucursalId: input.sucursalId,
            empleadoId: emp.id,
            fecha,
            semana: semanaNum,
            anio: anioNum,
            turno: turnoConfig.turno,
            horaInicio: turnoConfig.horaInicio,
            horaFin: turnoConfig.horaFin,
            puesto: emp.rol === "lider" ? "Líder" : "Barista",
            rolPrincipal: turnoConfig.turno === "matutino" ? "Caja" : "Bebidas",
            createdBy: ctx.user.id,
          });
          const turnoId = (result as any).insertId as number;

          // Insertar actividades
          if (actsTurno.length > 0) {
            await db.insert(turnoActividades).values(
              actsTurno.map(clave => ({ turnoId, actividadClave: clave, esPendiente: false }))
            );
          }
          turnosCreados++;

          // Actualizar horas del empleado para siguiente iteración
          const [hi, mi] = turnoConfig.horaInicio.split(":").map(Number);
          const [hf, mf] = turnoConfig.horaFin.split(":").map(Number);
          horasPorEmpleado[emp.id] = (horasPorEmpleado[emp.id] ?? 0) + (hf * 60 + mf - hi * 60 - mi) / 60;
          // Re-ordenar para siguiente asignación
          empOrdenados.sort((a, b) => (horasPorEmpleado[a.id] ?? 0) - (horasPorEmpleado[b.id] ?? 0));
          empIdx = 0;
        }
      }

      return { ok: true, turnosCreados, mensaje: `Horario generado: ${turnosCreados} turnos creados con actividades asignadas.` };
    }),

  /** Sugerencia de distribución equitativa para la próxima semana */
  sugerirDistribucion: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      anio: z.number(),
      semana: z.number(), // semana a planificar
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { turnosSemana, empleados } = await import("../../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");

      // Obtener empleados activos de la sucursal
      const emps = await db.select().from(empleados)
        .where(and(eq(empleados.sucursalId, input.sucursalId), eq(empleados.activo, true)));

      // Calcular horas trabajadas en las últimas 4 semanas
      const semanaActual = input.semana;
      const semanaInicio = semanaActual - 4;
      const horasPorEmpleado: Record<number, number> = {};
      const diasPorEmpleado: Record<number, number> = {};

      for (const emp of emps) {
        horasPorEmpleado[emp.id] = 0;
        diasPorEmpleado[emp.id] = 0;
      }

      const turnosRecientes = await db.select().from(turnosSemana)
        .where(and(
          eq(turnosSemana.sucursalId, input.sucursalId),
          eq(turnosSemana.anio, input.anio),
          gte(turnosSemana.semana, semanaInicio),
          lte(turnosSemana.semana, semanaActual - 1),
        ));

      for (const t of turnosRecientes) {
        if (!horasPorEmpleado[t.empleadoId]) horasPorEmpleado[t.empleadoId] = 0;
        if (!diasPorEmpleado[t.empleadoId]) diasPorEmpleado[t.empleadoId] = 0;
        // Calcular horas del turno
        const [hi, mi] = t.horaInicio.split(":").map(Number);
        const [hf, mf] = t.horaFin.split(":").map(Number);
        const horas = (hf * 60 + mf - hi * 60 - mi) / 60;
        horasPorEmpleado[t.empleadoId] += horas;
        diasPorEmpleado[t.empleadoId] += 1;
      }

      // Ordenar empleados por menos horas trabajadas (para sugerir más días)
      const ranking = emps
        .map(e => ({
          empleadoId: e.id,
          nombre: `${e.nombre} ${e.apellido ?? ""}`.trim(),
          horasUltimas4Semanas: horasPorEmpleado[e.id] ?? 0,
          diasUltimas4Semanas: diasPorEmpleado[e.id] ?? 0,
        }))
        .sort((a, b) => a.horasUltimas4Semanas - b.horasUltimas4Semanas);

      // Sugerir actividades S/B/M pendientes de la semana
      // (las que no se han completado en las últimas 2 semanas)
      const { turnoActividades } = await import("../../drizzle/schema");
      const turnosRecientesIds = turnosRecientes.map(t => t.id);
      let actividadesCompletadas: string[] = [];
      if (turnosRecientesIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        const completadas = await db.select({ clave: turnoActividades.actividadClave })
          .from(turnoActividades)
          .where(and(
            inArray(turnoActividades.turnoId, turnosRecientesIds),
            eq(turnoActividades.completada, true),
          ));
        actividadesCompletadas = completadas.map(a => a.clave);
      }

      // Actividades S y B que no se han hecho en las últimas 2 semanas
      const { actividadesCatalogo } = await import("../../drizzle/schema");
      const { inArray: inArr } = await import("drizzle-orm");
      const todasSB = await db.select().from(actividadesCatalogo)
        .where(inArr(actividadesCatalogo.categoria, ["S", "B"]));

      const pendientesSB = todasSB.filter(a => !actividadesCompletadas.includes(a.clave));

      return {
        ranking,
        actividadesPendientesSB: pendientesSB.map(a => a.clave),
        totalEmpleados: emps.length,
      };
    }),
});
