import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

type HorarioDia = { entrada: string; salida: string } | null;
type HorarioPersonal = Record<number, HorarioDia>;

function parseHorario(raw: unknown): HorarioPersonal {
  if (!raw) return {};
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw as HorarioPersonal); }
  catch { return {}; }
}

function toMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
function deMinutos(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function generarSugerencia(
  empleados: { id: number; nombre: string; apellido: string | null; horarioPersonal: unknown }[],
  fechas: string[],
  historialPrevio: { empleadoId: number; area: string }[]
): { empleadoId: number; fecha: string; area: string; horaInicio: string | null; horaFin: string | null }[] {
  const conteo: Record<number, { caja: number; preparacion: number; comodin: number }> = {};
  for (const emp of empleados) conteo[emp.id] = { caja: 0, preparacion: 0, comodin: 0 };
  for (const h of historialPrevio) {
    if (conteo[h.empleadoId]) {
      if (h.area === "caja") conteo[h.empleadoId].caja++;
      else if (h.area === "preparacion") conteo[h.empleadoId].preparacion++;
      else if (h.area === "comodin") conteo[h.empleadoId].comodin++;
    }
  }
  const resultado: { empleadoId: number; fecha: string; area: string; horaInicio: string | null; horaFin: string | null }[] = [];
  for (const fecha of fechas) {
    const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
    const activos = empleados.filter(emp => {
      const h = parseHorario(emp.horarioPersonal);
      return h[diaSemana] !== null && h[diaSemana] !== undefined;
    }).map(emp => {
      const h = parseHorario(emp.horarioPersonal);
      const dia = h[diaSemana] as HorarioDia;
      return { ...emp, inicioMin: dia?.entrada ? toMinutos(dia.entrada) : 0, finMin: dia?.salida ? toMinutos(dia.salida) : 0, horaInicio: dia?.entrada ?? null, horaFin: dia?.salida ?? null };
    });
    if (activos.length === 0) continue;
    const eventos = new Set<number>();
    for (const emp of activos) { eventos.add(emp.inicioMin); eventos.add(emp.finMin); }
    const puntos = Array.from(eventos).sort((a, b) => a - b);
    const minutosCaja: Record<number, number> = {};
    const minutosPrep: Record<number, number> = {};
    for (const emp of activos) { minutosCaja[emp.id] = 0; minutosPrep[emp.id] = 0; }
    for (let i = 0; i < puntos.length - 1; i++) {
      const bloqueInicio = puntos[i];
      const bloqueFin = puntos[i + 1];
      const duracion = bloqueFin - bloqueInicio;
      if (duracion <= 0) continue;
      const presentes = activos.filter(emp => emp.inicioMin <= bloqueInicio && emp.finMin >= bloqueFin);
      if (presentes.length === 0) continue;
      const horaI = deMinutos(bloqueInicio);
      const horaF = deMinutos(bloqueFin);
      if (presentes.length === 1) {
        resultado.push({ empleadoId: presentes[0].id, fecha, area: "caja_y_preparacion", horaInicio: horaI, horaFin: horaF });
        minutosCaja[presentes[0].id] += duracion; minutosPrep[presentes[0].id] += duracion;
      } else if (presentes.length === 2) {
        const [a, b] = presentes;
        const scoreA = (conteo[a.id].caja * 60 + minutosCaja[a.id]) - (conteo[a.id].preparacion * 60 + minutosPrep[a.id]);
        const scoreB = (conteo[b.id].caja * 60 + minutosCaja[b.id]) - (conteo[b.id].preparacion * 60 + minutosPrep[b.id]);
        const aVaCaja = scoreA !== scoreB ? scoreA < scoreB : (bloqueInicio % 2 === 0);
        const cajero = aVaCaja ? a : b; const preparador = aVaCaja ? b : a;
        resultado.push({ empleadoId: cajero.id, fecha, area: "caja", horaInicio: horaI, horaFin: horaF });
        resultado.push({ empleadoId: preparador.id, fecha, area: "preparacion", horaInicio: horaI, horaFin: horaF });
        minutosCaja[cajero.id] += duracion; minutosPrep[preparador.id] += duracion;
      } else {
        const ordenados = [...presentes].sort((a, b) => {
          const da = (conteo[a.id].caja * 60 + minutosCaja[a.id]) - (conteo[a.id].preparacion * 60 + minutosPrep[a.id]);
          const db = (conteo[b.id].caja * 60 + minutosCaja[b.id]) - (conteo[b.id].preparacion * 60 + minutosPrep[b.id]);
          return da !== db ? da - db : a.id - b.id;
        });
        resultado.push({ empleadoId: ordenados[0].id, fecha, area: "preparacion", horaInicio: horaI, horaFin: horaF });
        resultado.push({ empleadoId: ordenados[1].id, fecha, area: "caja", horaInicio: horaI, horaFin: horaF });
        minutosPrep[ordenados[0].id] += duracion; minutosCaja[ordenados[1].id] += duracion;
        for (let j = 2; j < ordenados.length; j++) {
          resultado.push({ empleadoId: ordenados[j].id, fecha, area: "comodin", horaInicio: horaI, horaFin: horaF });
        }
      }
    }
    for (const emp of activos) {
      if (minutosCaja[emp.id] > minutosPrep[emp.id]) conteo[emp.id].caja++;
      else if (minutosPrep[emp.id] > minutosCaja[emp.id]) conteo[emp.id].preparacion++;
    }
  }
  return resultado;
}


export const rotacionRouter = router({
  getSemana: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fechaInicio: z.string(), fechaFin: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { asignaciones: [], ausentesSet: [] };
      const { rotacionAreas, empleados } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const asignaciones = await db.select({ id: rotacionAreas.id, empleadoId: rotacionAreas.empleadoId, fecha: rotacionAreas.fecha,
        area: rotacionAreas.area, horaInicio: rotacionAreas.horaInicio, horaFin: rotacionAreas.horaFin,
        esManual: rotacionAreas.esManual, notas: rotacionAreas.notas,
        empleadoNombre: empleados.nombre, empleadoApellido: empleados.apellido })
        .from(rotacionAreas).leftJoin(empleados, eq(rotacionAreas.empleadoId, empleados.id))
        .where(and(eq(rotacionAreas.sucursalId, input.sucursalId), gte(rotacionAreas.fecha, input.fechaInicio), lte(rotacionAreas.fecha, input.fechaFin)))
        .orderBy(rotacionAreas.fecha, rotacionAreas.horaInicio);
      // Ausentes eventuales de la semana para excluirlos del "Sin área asignada"
      const ausentesRows = await db.execute(sql`
        SELECT empleadoId, DATE_FORMAT(fecha,'%Y-%m-%d') as fecha FROM ajustes_eventuales
        WHERE sucursalId=${input.sucursalId} AND ausente=1 AND fecha >= ${input.fechaInicio} AND fecha <= ${input.fechaFin}
      `);
      const ausentesSet = (ausentesRows[0] as any[]).map((r: any) => `${r.empleadoId}|${r.fecha}`);
      return { asignaciones, ausentesSet };
    }),

  generarSemana: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fechaInicio: z.string(), fechaFin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { rotacionAreas, empleados } = await import("../../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");
      const emps = await db.select().from(empleados).where(and(eq(empleados.sucursalId, input.sucursalId), eq(empleados.activo, true)));
      const hace4Semanas = new Date(input.fechaInicio); hace4Semanas.setDate(hace4Semanas.getDate() - 28);
      const historial = await db.select({ empleadoId: rotacionAreas.empleadoId, area: rotacionAreas.area })
        .from(rotacionAreas).where(and(eq(rotacionAreas.sucursalId, input.sucursalId), gte(rotacionAreas.fecha, hace4Semanas.toISOString().split("T")[0]), lte(rotacionAreas.fecha, input.fechaFin)));
      const fechas: string[] = [];
      const cur = new Date(input.fechaInicio + "T12:00:00Z"); const end = new Date(input.fechaFin + "T12:00:00Z");
      while (cur <= end) { fechas.push(cur.toISOString().split("T")[0]); cur.setUTCDate(cur.getUTCDate() + 1); }
      // Leer ajustes eventuales del periodo para excluir ausentes y agregar extras
      const { sql } = await import("drizzle-orm");
      const ajustesRows = await db.execute(sql`
        SELECT empleadoId, fecha, ausente, horaEntrada, horaSalida
        FROM ajustes_eventuales
        WHERE sucursalId=${input.sucursalId} AND fecha >= ${input.fechaInicio} AND fecha <= ${input.fechaFin}
      `);
      const ajustes = ajustesRows[0] as { empleadoId: number; fecha: string; ausente: number; horaEntrada: string | null; horaSalida: string | null }[];
      const ausentesSet = new Set(ajustes.filter(a => a.ausente).map(a => `${a.empleadoId}|${a.fecha}`));

      // Para la sugerencia, excluir empleados ausentes en días específicos
      const empsConAusencias = emps.map(e => {
        // Inyectar días de descanso extra (ausencias eventuales) en horarioPersonal no es directo,
        // así que filtramos la sugerencia después
        return { ...e, apellido: e.apellido ?? null };
      });
      const sugerenciaRaw = generarSugerencia(empsConAusencias, fechas, historial.map(h => ({ empleadoId: h.empleadoId, area: h.area })));
      // Quitar entradas de ausentes eventuales
      const sugerencia = sugerenciaRaw.filter(s => !ausentesSet.has(`${s.empleadoId}|${s.fecha}`));

      await db.delete(rotacionAreas).where(and(eq(rotacionAreas.sucursalId, input.sucursalId), gte(rotacionAreas.fecha, input.fechaInicio), lte(rotacionAreas.fecha, input.fechaFin), eq(rotacionAreas.esManual, false)));
      if (sugerencia.length > 0) await db.insert(rotacionAreas).values(sugerencia.map(s => ({ sucursalId: input.sucursalId, empleadoId: s.empleadoId, fecha: s.fecha, area: s.area as any, horaInicio: s.horaInicio ?? null, horaFin: s.horaFin ?? null, esManual: 0 as any, notas: null })));

      // Insertar extras eventuales (no ausentes, con horario) que no tienen ninguna fila en rotacion_areas
      const extras = ajustes.filter(a => !a.ausente && a.horaEntrada && a.horaSalida);
      for (const ex of extras) {
        const yaExiste = await db.execute(sql`
          SELECT id FROM rotacion_areas
          WHERE sucursalId=${input.sucursalId} AND empleadoId=${ex.empleadoId} AND fecha=${ex.fecha}
          LIMIT 1
        `);
        if ((yaExiste[0] as any[]).length === 0) {
          await db.execute(sql`
            INSERT INTO rotacion_areas (sucursalId, empleadoId, fecha, area, horaInicio, horaFin, esManual, notas)
            VALUES (${input.sucursalId}, ${ex.empleadoId}, ${ex.fecha}, 'caja_y_preparacion', ${ex.horaEntrada}, ${ex.horaSalida}, 1, 'Ajuste eventual')
          `);
        }
      }

      return { success: true, generados: sugerencia.length };
    }),

  editarDia: protectedProcedure
    .input(z.object({
      id: z.number().optional(), // si se pasa, edita por id (más preciso)
      sucursalId: z.number(), empleadoId: z.number(), fecha: z.string(),
      area: z.enum(["caja","preparacion","comodin","caja_y_preparacion"]),
      horaInicio: z.string().optional(), horaFin: z.string().optional(), notas: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { rotacionAreas } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const updateData = { area: input.area, horaInicio: input.horaInicio ?? null, horaFin: input.horaFin ?? null, esManual: true, notas: input.notas ?? null };
      if (input.id) {
        // Edición precisa por id de fila
        await db.update(rotacionAreas).set(updateData).where(eq(rotacionAreas.id, input.id));
      } else {
        // Fallback: buscar primer registro del empleado en esa fecha
        const existing = await db.select().from(rotacionAreas)
          .where(and(eq(rotacionAreas.sucursalId, input.sucursalId), eq(rotacionAreas.empleadoId, input.empleadoId), eq(rotacionAreas.fecha, input.fecha))).limit(1);
        const fullData = { sucursalId: input.sucursalId, empleadoId: input.empleadoId, fecha: input.fecha, ...updateData };
        if (existing.length > 0) await db.update(rotacionAreas).set(fullData).where(eq(rotacionAreas.id, existing[0].id));
        else await db.insert(rotacionAreas).values(fullData);
      }
      return { success: true };
    }),

  eliminarDia: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { rotacionAreas } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(rotacionAreas).where(eq(rotacionAreas.id, input.id));
      return { success: true };
    }),
});
