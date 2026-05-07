/**
 * Router de Preparaciones de Recetas
 * Registra cada preparación realizada en turno: qué, cuánto, cuándo.
 * Calcula automáticamente la hora de vencimiento según la receta.
 * Gestiona incidencias críticas (sin preparación, vencida, fuera de tiempo).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "../_core/notification";

// ─── Configuración de recetas ─────────────────────────────────────────────────
export const RECETAS_CONFIG = {
  tapioca: {
    nombre: "Tapioca",
    vidaUtilHoras: 8,
    alertaMinutos: 40,
    tiempoPreparacionMinutos: 90, // 1.5 horas
    cantidades: [
      { valor: "200", etiqueta: "200 gr", unidad: "gr" },
      { valor: "500", etiqueta: "500 gr", unidad: "gr" },
      { valor: "700", etiqueta: "700 gr", unidad: "gr" },
    ],
    alertaActiva: true,
    // Solo alertar si hay tiempo de preparar antes del cierre (cierre = 21:00)
    horaCierreTienda: 21,
  },
  base_snowtea: {
    nombre: "Base Snowtea",
    vidaUtilHoras: 72, // 3 días
    alertaMinutos: 720, // 12 horas antes
    tiempoPreparacionMinutos: 0,
    cantidades: [
      { valor: "media_carga", etiqueta: "½ carga (~18 vasos)", unidad: "carga" },
      { valor: "carga_completa", etiqueta: "1 carga completa (~37 vasos)", unidad: "carga" },
    ],
    alertaActiva: true,
    horaCierreTienda: null,
  },
  jarabe_longan: {
    nombre: "Jarabe Longan",
    vidaUtilHoras: 8,
    alertaMinutos: 0,
    tiempoPreparacionMinutos: 0,
    cantidades: [
      { valor: "media_carga",    etiqueta: "½ carga (rinde 1 kg tapioca)", unidad: "carga" },
      { valor: "carga_completa", etiqueta: "1 carga (rinde 2 kg tapioca)", unidad: "carga" },
    ],
    alertaActiva: false, // Solo informativo
    horaCierreTienda: null,
  },
  sustituto_azucar: {
    nombre: "Sustituto de Azúcar",
    vidaUtilHoras: 72, // 3 días
    alertaMinutos: 0,
    tiempoPreparacionMinutos: 0,
    cantidades: [
      { valor: "media_carga", etiqueta: "½ carga", unidad: "carga" },
      { valor: "carga_completa", etiqueta: "1 carga completa", unidad: "carga" },
    ],
    alertaActiva: false, // Solo informativo
    horaCierreTienda: null,
  },
} as const;

export type RecetaClave = keyof typeof RECETAS_CONFIG;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcularVencimiento(receta: RecetaClave, preparadaAt: Date): Date {
  const config = RECETAS_CONFIG[receta];
  return new Date(preparadaAt.getTime() + config.vidaUtilHoras * 60 * 60 * 1000);
}

function minutosRestantes(venceAt: Date): number {
  return Math.floor((venceAt.getTime() - Date.now()) / 60000);
}

function semaforoTiempo(minutos: number, receta: RecetaClave): "verde" | "amarillo" | "rojo" | "vencida" {
  if (minutos <= 0) return "vencida";
  const config = RECETAS_CONFIG[receta];
  const alertaMin = config.alertaMinutos;
  if (alertaMin > 0 && minutos <= alertaMin) return "rojo";
  if (minutos <= alertaMin * 2) return "amarillo";
  return "verde";
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const preparacionesRouter = router({

  /** Catálogo de recetas con opciones de cantidad */
  catalogo: protectedProcedure.query(() => {
    return Object.entries(RECETAS_CONFIG).map(([clave, cfg]) => ({
      clave,
      nombre: cfg.nombre,
      vidaUtilHoras: cfg.vidaUtilHoras,
      alertaActiva: cfg.alertaActiva,
      alertaMinutos: cfg.alertaMinutos,
      tiempoPreparacionMinutos: cfg.tiempoPreparacionMinutos,
      cantidades: cfg.cantidades,
    }));
  }),

  /** Registrar una nueva preparación */
  crear: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      turnoId: z.number().optional(),
      empleadoId: z.number().optional(),
      receta: z.enum(["tapioca", "base_snowtea", "jarabe_longan", "sustituto_azucar"]),
      cantidad: z.string(),
      preparadaAt: z.date().optional(), // si no se pasa, se usa la hora actual
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { preparaciones } = await import("../../drizzle/schema");

      const preparadaAt = input.preparadaAt ?? new Date();
      const venceAt = calcularVencimiento(input.receta, preparadaAt);
      const config = RECETAS_CONFIG[input.receta];
      const unidad = config.cantidades.find(c => c.valor === input.cantidad)?.unidad ?? "gr";

      const [result] = await db.insert(preparaciones).values({
        sucursalId: input.sucursalId,
        turnoId: input.turnoId ?? null,
        empleadoId: input.empleadoId ?? null,
        registradoPorId: ctx.user.id,
        receta: input.receta,
        cantidad: input.cantidad,
        unidad,
        preparadaAt,
        venceAt,
        estado: "activa",
      });

      const prepId = (result as any).insertId;
      // Descontar insumos del inventario automáticamente
      void descontarInventarioPorPreparacion({
        sucursalId: input.sucursalId,
        receta: input.receta,
        cantidad: input.cantidad,
        preparacionId: prepId,
        registradoPorId: ctx.user.id,
      });
      return { id: prepId, venceAt };
    }),

  /** Preparaciones activas de una sucursal (con countdown) */
  activas: protectedProcedure
    .input(z.object({ sucursalId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq, and, or, gte } = await import("drizzle-orm");

      // Preparaciones activas o que vencieron en las últimas 2 horas (para mostrar como "vencida")
      const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const rows = await db.select().from(preparaciones)
        .where(and(
          eq(preparaciones.sucursalId, input.sucursalId),
          or(
            eq(preparaciones.estado, "activa"),
            and(eq(preparaciones.estado, "vencida"), gte(preparaciones.venceAt, hace2h))
          )
        ))
        .orderBy(preparaciones.preparadaAt);

      return rows.map(r => {
        const minutos = minutosRestantes(r.venceAt);
        const semaforo = semaforoTiempo(minutos, r.receta as RecetaClave);
        const config = RECETAS_CONFIG[r.receta as RecetaClave];
        const cantidadLabel = config.cantidades.find(c => c.valor === r.cantidad)?.etiqueta ?? r.cantidad;
        return {
          ...r,
          minutosRestantes: minutos,
          semaforo,
          cantidadLabel,
          nombreReceta: config.nombre,
          alertaActiva: config.alertaActiva,
        };
      });
    }),

  /** Marcar preparación como consumida */
  marcarConsumida: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(preparaciones).set({ estado: "consumida" }).where(eq(preparaciones.id, input.id));
      return { ok: true };
    }),

  /** Registrar incidencia crítica */
  registrarIncidencia: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      turnoId: z.number().optional(),
      receta: z.enum(["tapioca", "base_snowtea", "jarabe_longan", "sustituto_azucar"]),
      tipo: z.enum(["sin_preparacion", "vencida_en_uso", "fuera_de_tiempo", "desperdicio"]),
      nota: z.string().min(5, "Describe brevemente qué pasó"),
      preparacionId: z.number().optional(), // si aplica a una preparación existente
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const ahora = new Date();
      const config = RECETAS_CONFIG[input.receta];

      if (input.preparacionId) {
        // Actualizar preparación existente con la incidencia
        await db.update(preparaciones).set({
          incidenciaTipo: input.tipo,
          incidenciaAt: ahora,
          incidenciaNota: input.nota,
          estado: input.tipo === "desperdicio" || input.tipo === "vencida_en_uso" ? "vencida" : "activa",
        }).where(eq(preparaciones.id, input.preparacionId));
      } else {
        // Crear registro de incidencia sin preparación previa (tipo: sin_preparacion)
        await db.insert(preparaciones).values({
          sucursalId: input.sucursalId,
          turnoId: input.turnoId ?? null,
          registradoPorId: ctx.user.id,
          receta: input.receta,
          cantidad: "0",
          unidad: "gr",
          preparadaAt: ahora,
          venceAt: ahora, // no aplica
          estado: "vencida",
          incidenciaTipo: input.tipo,
          incidenciaAt: ahora,
          incidenciaNota: input.nota,
        });
      }

      // Notificar al dueño de incidencias críticas
      const tiposLabel: Record<string, string> = {
        sin_preparacion: "Sin preparación disponible",
        vencida_en_uso: "Producto vencido en uso",
        fuera_de_tiempo: "Sin tiempo de preparar antes del cierre",
        desperdicio: "Producto desperdiciado (vencido sin usar)",
      };

      await notifyOwner({
        title: `⚠️ Incidencia: ${config.nombre} — ${tiposLabel[input.tipo]}`,
        content: `Se registró una incidencia crítica en preparaciones:\n\n📍 Sucursal ID: ${input.sucursalId}\n🧪 Producto: ${config.nombre}\n🚨 Tipo: ${tiposLabel[input.tipo]}\n📝 Nota: ${input.nota}\n⏰ Hora: ${ahora.toLocaleTimeString("es-MX")}\n\nRevisa el historial de preparaciones en el sistema.`,
      });

      return { ok: true };
    }),

  /** Historial de preparaciones con filtros */
  historial: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      fechaInicio: z.string().optional(), // YYYY-MM-DD
      fechaFin: z.string().optional(),
      soloIncidencias: z.boolean().optional(),
      receta: z.enum(["tapioca", "base_snowtea", "jarabe_longan", "sustituto_azucar"]).optional(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq, and, gte, lte, isNotNull, desc } = await import("drizzle-orm");

      const conditions: any[] = [eq(preparaciones.sucursalId, input.sucursalId)];

      if (input.fechaInicio) {
        conditions.push(gte(preparaciones.preparadaAt, new Date(input.fechaInicio + "T00:00:00")));
      }
      if (input.fechaFin) {
        conditions.push(lte(preparaciones.preparadaAt, new Date(input.fechaFin + "T23:59:59")));
      }
      if (input.soloIncidencias) {
        conditions.push(isNotNull(preparaciones.incidenciaTipo));
      }
      if (input.receta) {
        conditions.push(eq(preparaciones.receta, input.receta));
      }

      const { users, empleados } = await import("../../drizzle/schema");

      const rows = await db.select({
        id: preparaciones.id,
        sucursalId: preparaciones.sucursalId,
        turnoId: preparaciones.turnoId,
        empleadoId: preparaciones.empleadoId,
        registradoPorId: preparaciones.registradoPorId,
        receta: preparaciones.receta,
        cantidad: preparaciones.cantidad,
        unidad: preparaciones.unidad,
        preparadaAt: preparaciones.preparadaAt,
        venceAt: preparaciones.venceAt,
        estado: preparaciones.estado,
        incidenciaTipo: preparaciones.incidenciaTipo,
        incidenciaAt: preparaciones.incidenciaAt,
        incidenciaNota: preparaciones.incidenciaNota,
        createdAt: preparaciones.createdAt,
        updatedAt: preparaciones.updatedAt,
        registradoPorNombre: users.name,
        empleadoNombre: empleados.nombre,
      })
        .from(preparaciones)
        .leftJoin(users, eq(users.id, preparaciones.registradoPorId))
        .leftJoin(empleados, eq(empleados.id, preparaciones.empleadoId))
        .where(and(...conditions))
        .orderBy(desc(preparaciones.preparadaAt))
        .limit(200);

      return rows.map(r => {
        const config = RECETAS_CONFIG[r.receta as RecetaClave];
        const cantidadLabel = config.cantidades.find(c => c.valor === r.cantidad)?.etiqueta ?? r.cantidad;
        return { ...r, nombreReceta: config.nombre, cantidadLabel };
      });
    }),

  /** Resumen de incidencias por período (para dashboard) */
  resumenIncidencias: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      dias: z.number().default(30),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return { total: 0, porReceta: {}, porTipo: {} };
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq, and, gte, isNotNull } = await import("drizzle-orm");

      const desde = new Date(Date.now() - input.dias * 24 * 60 * 60 * 1000);
      const rows = await db.select().from(preparaciones)
        .where(and(
          eq(preparaciones.sucursalId, input.sucursalId),
          gte(preparaciones.preparadaAt, desde),
          isNotNull(preparaciones.incidenciaTipo)
        ));

      const porReceta: Record<string, number> = {};
      const porTipo: Record<string, number> = {};
      for (const r of rows) {
        porReceta[r.receta] = (porReceta[r.receta] ?? 0) + 1;
        if (r.incidenciaTipo) porTipo[r.incidenciaTipo] = (porTipo[r.incidenciaTipo] ?? 0) + 1;
      }

      return { total: rows.length, porReceta, porTipo };
    }),

  /** Incidencias de preparaciones agrupadas por empleado (para KPIs Anfitriones) */
  incidenciasPorEmpleado: protectedProcedure
    .input(z.object({
      sucursalId: z.number(),
      dias: z.number().default(30),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { preparaciones } = await import("../../drizzle/schema");
      const { eq, and, gte, isNotNull } = await import("drizzle-orm");

      const desde = new Date(Date.now() - input.dias * 24 * 60 * 60 * 1000);
      const rows = await db.select().from(preparaciones)
        .where(and(
          eq(preparaciones.sucursalId, input.sucursalId),
          gte(preparaciones.preparadaAt, desde),
          isNotNull(preparaciones.incidenciaTipo)
        ));

      // Agrupar por empleado
      const porEmpleado: Record<number, { empleadoId: number; total: number; sinPrep: number; vencida: number; fueraTiempo: number; recetas: Record<string, number> }> = {};
      for (const r of rows) {
        const eid = r.empleadoId ?? 0;
        if (!porEmpleado[eid]) {
          porEmpleado[eid] = { empleadoId: eid, total: 0, sinPrep: 0, vencida: 0, fueraTiempo: 0, recetas: {} };
        }
        const e = porEmpleado[eid];
        e.total++;
        if (r.incidenciaTipo === 'sin_preparacion') e.sinPrep++;
        else if (r.incidenciaTipo === 'vencida_en_uso') e.vencida++;
        else if (r.incidenciaTipo === 'fuera_de_tiempo') e.fueraTiempo++;
        e.recetas[r.receta] = (e.recetas[r.receta] ?? 0) + 1;
      }

      return Object.values(porEmpleado).sort((a, b) => b.total - a.total);
    }),
});

// ─── Mapa receta+cantidad → subproductoId ────────────────────────────────────
// Cada clave apunta al subproducto exacto en inv_subproductos
const PREP_SUBPRODUCTO_MAP: Record<string, { subproductoId: number }> = {
  "tapioca|200":                     { subproductoId: 3 },
  "tapioca|500":                     { subproductoId: 4 },
  "tapioca|700":                     { subproductoId: 5 },
  "base_snowtea|media_carga":        { subproductoId: 7 },
  "base_snowtea|carga_completa":     { subproductoId: 1 },
  "jarabe_longan|media_carga":       { subproductoId: 8 },
  "jarabe_longan|carga_completa":    { subproductoId: 2 },
  "sustituto_azucar|media_carga":    { subproductoId: 9 },
  "sustituto_azucar|carga_completa": { subproductoId: 6 },
};

/**
 * Descuenta insumos del almacen Isla al registrar una preparación.
 * Usa la receta del subproducto correspondiente.
 * Falla silenciosamente para no bloquear el registro.
 */
async function descontarInventarioPorPreparacion(params: {
  sucursalId: number;
  receta: string;
  cantidad: string;
  preparacionId: number;
  registradoPorId: number;
}) {
  const key = `${params.receta}|${params.cantidad}`;
  const mapping = PREP_SUBPRODUCTO_MAP[key];
  if (!mapping) return;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;
    const { sql } = await import("drizzle-orm");

    const almRows = await db.execute(sql`
      SELECT id FROM inv_almacenes
      WHERE sucursalId = ${params.sucursalId}
        AND nombre = 'Isla' AND activo = 1 LIMIT 1
    `);
    const almacenId = (almRows[0] as any[])[0]?.id ?? null;

    const recRows = await db.execute(sql`
      SELECT materiasPrimaId, cantidadGramos, cantidadPiezas
      FROM inv_subproductos_receta
      WHERE subproductoId = ${mapping.subproductoId}
    `);
    const lineas = recRows[0] as any[];
    if (!lineas?.length) return;

    for (const linea of lineas) {
      const gramos = Number(linea.cantidadGramos ?? 0);
      const piezas = Number(linea.cantidadPiezas ?? 0);
      if (gramos === 0 && piezas === 0) continue;
      await db.execute(sql`
        INSERT INTO inv_movimientos
          (sucursalId, almacenId, productoId, tipo,
           cantidadGramos, cantidadPiezas,
           referenciaId, referenciaTipo, notas, registradoPorId)
        VALUES (
          ${params.sucursalId}, ${almacenId}, ${linea.materiasPrimaId},
          'consumo_preparacion',
          ${gramos}, ${piezas},
          ${params.preparacionId}, 'preparacion',
          ${`${params.receta} ${params.cantidad}`},
          ${params.registradoPorId}
        )
      `);
    }
  } catch (e) {
    console.error("[inv] Error descontando inventario preparacion:", e);
  }
}
