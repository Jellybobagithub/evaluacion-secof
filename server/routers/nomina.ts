import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const nominaHorasRouter = router({

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

      // Usar registro_nomina como fuente principal (calcula desde ajustes_eventuales + turnos)
      const rows = await db.execute(sql`
        SELECT
          rn.empleadoId,
          e.nombre,
          e.puesto,
          rn.fecha,
          rn.horaEntradaEsperada,
          rn.minutosRetardo,
          TIME(CONVERT_TZ(FROM_UNIXTIME(rn.timestampEntrada/1000), '+00:00', '-06:00')) as horaEntrada,
          TIME(CONVERT_TZ(FROM_UNIXTIME(rn.timestampSalida/1000),  '+00:00', '-06:00')) as horaSalida,
          CASE
            WHEN rn.timestampEntrada IS NOT NULL AND rn.timestampSalida IS NOT NULL
              THEN ROUND((rn.timestampSalida - rn.timestampEntrada) / 3600000, 2)
            WHEN rn.timestampEntrada IS NOT NULL
              THEN NULL
            ELSE NULL
          END as horasTrabajadas,
          CASE WHEN rn.timestampEntrada IS NULL AND rn.horaEntradaEsperada IS NOT NULL THEN 1 ELSE 0 END as ausente,
          CASE WHEN rn.timestampEntrada IS NOT NULL AND rn.timestampSalida IS NULL THEN 1 ELSE 0 END as sinSalida
        FROM registro_nomina rn
        JOIN empleados e ON e.id = rn.empleadoId
        WHERE rn.sucursalId = ${input.sucursalId}
          AND rn.fecha BETWEEN ${input.fechaInicio} AND ${input.fechaFin}
          AND rn.horaEntradaEsperada IS NOT NULL
        ORDER BY e.nombre, rn.fecha
      `);

      const allRows = rows[0] as any[];
      const empIds = [...new Set(allRows.map((r: any) => r.empleadoId))];

      const resultado = empIds.map(empId => {
        const mis = allRows.filter((r: any) => r.empleadoId === empId);
        const emp = mis[0];
        const presentes = mis.filter((r: any) => !r.ausente);
        const totalHoras = presentes.reduce((s: number, r: any) => s + (r.horasTrabajadas != null ? Number(r.horasTrabajadas) : 0), 0);
        const retardos = mis.filter((r: any) => r.minutosRetardo > 0).map((r: any) => ({ fecha: r.fecha, minutosRetardo: r.minutosRetardo }));
        const ausencias = mis.filter((r: any) => r.ausente).map((r: any) => r.fecha);

        return {
          empleadoId:     empId,
          nombre:         emp.nombre,
          puesto:         emp.puesto,
          diasTrabajados: presentes.length,
          totalHoras:     Math.round(totalHoras * 100) / 100,
          retardos,
          ausencias,
          detalles: mis.map((r: any) => ({
            fecha:        r.fecha,
            horaEntrada:  r.horaEntrada?.substring(0,5) ?? (r.ausente ? "Ausente" : "—"),
            horaSalida:   r.horaSalida?.substring(0,5)  ?? (r.sinSalida ? "Sin salida" : "—"),
            horas:        r.horasTrabajadas != null ? Number(r.horasTrabajadas) : 0,
            sinSalida:    !!r.sinSalida,
            minutosRetardo: r.minutosRetardo ?? 0,
            horaEsperada: r.horaEntradaEsperada,
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
