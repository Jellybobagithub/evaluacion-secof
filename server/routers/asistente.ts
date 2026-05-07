import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const asistenteRouter = router({

  preguntar: protectedProcedure
    .input(z.object({ pregunta: z.string().min(3).max(500) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pregNorm = input.pregunta.toLowerCase().trim();
      const palabras = pregNorm.split(' ').filter((w: string) => w.length > 2).slice(0, 5);

      // Buscar en cache FAQ con cualquiera de las palabras clave
      let cachedRow: any = null;
      for (const palabra of palabras) {
        const cached = await db.execute(sql`
          SELECT id, respuesta, usosCount FROM asistente_faq
          WHERE activo=1 AND pregunta_normalizada LIKE ${`%${palabra}%`}
          ORDER BY usosCount DESC LIMIT 1
        `);
        const row = (cached[0] as any[])[0];
        if (row) { cachedRow = row; break; }
      }

      if (cachedRow) {
        await db.execute(sql`UPDATE asistente_faq SET usosCount=usosCount+1 WHERE id=${cachedRow.id}`);
        return { respuesta: cachedRow.respuesta, fuenteCache: true };
      }

      // No hay FAQ — respuesta por defecto
      const respuestaDefault = [
        "No tengo información específica sobre esa pregunta en los documentos disponibles.",
        "",
        "Puedo ayudarte con:",
        "• Reglamento Interior — retardos, faltas, vacaciones, disciplina",
        "• Protocolos operativos — apertura, cierre, preparaciones, inventario",
        "• KPIs por puesto — metas y frecuencias de medición",
        "• Módulos SECOF — cómo usar cada sección del sistema",
        "• Nómina y prestaciones — pagos, IMSS, finiquito",
        "",
        "Intenta con una pregunta más específica o consulta con Miguel Moreno (Director General)."
      ].join("\n");

      return { respuesta: respuestaDefault, fuenteCache: false };
    }),

  sugeridas: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.user.role;
    const sugerencias: Record<string, string[]> = {
      host: [
        "¿Cuántos minutos de tolerancia hay para llegar?",
        "¿Cómo registro mi entrada en SECOF?",
        "¿Qué debo hacer en la apertura de tienda?",
      ],
      leader: [
        "¿Cómo se arma el horario de la semana?",
        "¿Cómo aplico una amonestación a un anfitrión?",
        "¿Cómo hago el conteo físico de inventario?",
        "¿Qué hago si un empleado falta sin avisar?",
        "¿Cuáles son mis KPIs como líder de tienda?",
      ],
      manager: [
        "¿Cómo funciona el módulo de rentabilidad?",
        "¿Qué pasa si la variación de inventario supera el 5%?",
        "¿Cómo evalúo el periodo de prueba de un empleado?",
        "¿Cuándo se entrega el reporte mensual al contador?",
        "¿Cuáles son los KPIs de la Coordinadora de Control Operativo?",
      ],
      owner: [
        "¿Cómo ver la rentabilidad del mes?",
        "¿Cuál es la meta de ventas de cada tienda?",
        "¿Cómo interpretar el score SECOF?",
      ],
      superadmin: [
        "¿Cómo funciona el sistema de evaluaciones de periodo?",
        "¿Cuál es la estructura del equipo Snowtea?",
        "¿Cómo se calcula el inventario teórico?",
        "¿Cuáles son los módulos disponibles en SECOF?",
      ],
    };
    return sugerencias[role] ?? sugerencias.leader;
  }),
});
