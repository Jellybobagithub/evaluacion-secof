import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const nominaRouter = router({

  reporte: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      fechaInicio: z.string(), // YYYY-MM-DD
      fechaFin:   z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const tsInicio = new Date(input.fechaInicio + "T00:00:00").getTime();
      const tsFin    = new Date(input.fechaFin   + "T23:59:59").getTime();

      // 1. Pares entrada→salida por empleado
      const pares = await db.execute(sql`
        SELECT
          ent.empleadoId,
          DATE(CONVERT_TZ(FROM_UNIXTIME(ent.timestamp/1000), '+00:00', '-06:00')) as fecha,
          TIME(CONVERT_TZ(FROM_UNIXTIME(ent.timestamp/1000), '+00:00', '-06:00')) as horaEntrada,
          TIME(CONVERT_TZ(FROM_UNIXTIME(sal.timestamp/1000), '+00:00', '-06:00')) as horaSalida,
          ROUND((COALESCE(sal.timestamp, ent.timestamp) - ent.timestamp) / 3600000, 2) as horasTrabajadas,
          CASE WHEN sal.id IS NULL THEN 1 ELSE 0 END as sinSalida
        FROM asistencia ent
        LEFT JOIN asistencia sal ON
          sal.empleadoId = ent.empleadoId AND
          sal.tipo = 'salida' AND
          sal.timestamp > ent.timestamp AND
          sal.timestamp <= ent.timestamp + (14 * 3600000) AND
          sal.id = (
            SELECT MIN(a2.id) FROM asistencia a2
            WHERE a2.empleadoId = ent.empleadoId
              AND a2.tipo = 'salida'
              AND a2.timestamp > ent.timestamp
              AND a2.timestamp <= ent.timestamp + (14 * 3600000)
          )
        WHERE ent.tipo = 'entrada'
          AND ent.sucursalId = ${input.sucursalId}
          AND ent.timestamp >= ${tsInicio}
          AND ent.timestamp <= ${tsFin}
        ORDER BY ent.empleadoId, ent.timestamp
      `);

      // 2. Horario programado (rotacion_areas) para detectar retardos y ausencias
      const programado = await db.execute(sql`
        SELECT
          ra.empleadoId,
          ra.fecha,
          MIN(ra.horaInicio) as horaProgInicio,
          MAX(ra.horaFin)    as horaProgFin
        FROM rotacion_areas ra
        WHERE ra.sucursalId = ${input.sucursalId}
          AND ra.fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
        GROUP BY ra.empleadoId, ra.fecha
        ORDER BY ra.empleadoId, ra.fecha
      `);

      // 3. Empleados con registro en el periodo
      const empRows = await db.execute(sql`
        SELECT DISTINCT e.id, e.nombre, e.puesto
        FROM empleados e
        WHERE e.id IN (
          SELECT DISTINCT empleadoId FROM asistencia
          WHERE sucursalId = ${input.sucursalId}
            AND timestamp >= ${tsInicio} AND timestamp <= ${tsFin}
        ) OR e.id IN (
          SELECT DISTINCT empleadoId FROM rotacion_areas
          WHERE sucursalId = ${input.sucursalId}
            AND fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
        )
        ORDER BY e.nombre
      `);

      const empleados = empRows[0] as any[];
      const paresData = pares[0] as any[];
      const progData  = programado[0] as any[];

      // 4. Estructurar por empleado
      const resultado = empleados.map((emp: any) => {
        const misPares    = paresData.filter((p:any) => p.empleadoId === emp.id);
        const miPrograma  = progData.filter((p:any) => p.empleadoId === emp.id);

        // Dias trabajados (con al menos una entrada)
        const diasConRegistro = new Set(misPares.map((p:any) => p.fecha));

        // Calcular horas por dia
        const horasPorDia: Record<string, number> = {};
        for (const p of misPares) {
          horasPorDia[p.fecha] = (horasPorDia[p.fecha] ?? 0) + Number(p.horasTrabajadas);
        }

        // Detectar retardos: entrada real > hora programada + 10 min
        const retardos: { fecha: string; minutosRetardo: number }[] = [];
        for (const prog of miPrograma) {
          const parDia = misPares.find((p:any) => p.fecha === prog.fecha);
          if (parDia && prog.horaProgInicio) {
            const [ph, pm] = prog.horaProgInicio.split(":").map(Number);
            const [eh, em] = (parDia.horaEntrada ?? "00:00").split(":").map(Number);
            const minProg  = ph * 60 + pm;
            const minReal  = eh * 60 + em;
            const diff     = minReal - minProg;
            if (diff > 10) retardos.push({ fecha: prog.fecha, minutosRetardo: diff });
          }
        }

        // Ausencias: días en programa sin registro QR
        const ausencias = miPrograma
          .filter((p:any) => !diasConRegistro.has(p.fecha))
          .map((p:any) => p.fecha);

        const totalHoras = Object.values(horasPorDia).reduce((s, h) => s + h, 0);

        return {
          empleadoId:     emp.id,
          nombre:         emp.nombre,
          puesto:         emp.puesto,
          diasTrabajados: diasConRegistro.size,
          totalHoras:     Math.round(totalHoras * 100) / 100,
          retardos,
          ausencias,
          detalles: misPares.map((p:any) => ({
            fecha:           p.fecha,
            horaEntrada:     p.horaEntrada?.substring(0,5) ?? "—",
            horaSalida:      p.horaSalida?.substring(0,5)  ?? "Sin salida",
            horas:           Number(p.horasTrabajadas),
            sinSalida:       !!p.sinSalida,
          })),
        };
      });

      return {
        fechaInicio:  input.fechaInicio,
        fechaFin:     input.fechaFin,
        empleados:    resultado,
        totalHorasGlobal: resultado.reduce((s, e) => s + e.totalHoras, 0),
      };
    }),
});
