import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

async function saveBase64Photo(base64str: string, subfolder: string): Promise<string> {
  const matches = base64str.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!matches) throw new Error("Formato de imagen invalido");
  const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
  const buffer = Buffer.from(matches[2], "base64");
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dir = join(process.cwd(), "uploads", "asistencia", yearMonth, subfolder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(3).toString("hex")}.${ext}`;
  await writeFile(join(dir, filename), buffer);
  return `/uploads/asistencia/${yearMonth}/${subfolder}/${filename}`;
}

export const asistenciaRouter = router({
  registrarQr: publicProcedure
    .input(z.object({
      qrToken: z.string(),
      empleadoId: z.number(),
      tipo: z.enum(["entrada", "salida"]),
      subtipo: z.enum(["apertura_tienda", "entrada_turno", "cierre_tienda", "salida_turno"]),
      latitud: z.number().optional(),
      longitud: z.number().optional(),
      fotoBase64: z.string().optional(),
      fotoUniformeBase64: z.string().optional(),
      contadorSelladora: z.number().int().optional(),
      vasosConteo: z.number().int().optional(),
      popotesConteo: z.number().int().optional(),
      selladuroOk: z.boolean().optional(),
      motivoDiferencia: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getSucursalByQrToken, getUltimoRegistroAsistencia, getEmpleadoById, getDb } = await import("../db");
      const sucursal = await getSucursalByQrToken(input.qrToken);
      if (!sucursal) throw new TRPCError({ code: "NOT_FOUND", message: "QR invalido o expirado" });
      const empleado = await getEmpleadoById(input.empleadoId);
      if (!empleado || empleado.sucursalId !== sucursal.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Empleado no pertenece a esta sucursal" });
      const ultimo = await getUltimoRegistroAsistencia(input.empleadoId);
      if (ultimo && ultimo.tipo === input.tipo && Date.now() - ultimo.timestamp < 5 * 60 * 1000)
        throw new TRPCError({ code: "CONFLICT", message: "Ya registraste " + input.tipo + " recientemente" });
      let fotoUrl: string | undefined;
      if (input.fotoBase64) {
        try { fotoUrl = await saveBase64Photo(input.fotoBase64, `sucursal-${sucursal.id}`); }
        catch (e) { console.error("[Asistencia] Error guardando foto:", e); }
      }
      let fotoUniformeUrl: string | undefined;
      if (input.fotoUniformeBase64) {
        try { fotoUniformeUrl = await saveBase64Photo(input.fotoUniformeBase64, `uniforme-${sucursal.id}`); }
        catch (e) { console.error("[Asistencia] Error guardando foto uniforme:", e); }
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { asistencia } = await import("../../drizzle/schema");
      await db.insert(asistencia).values({
        empleadoId: input.empleadoId, sucursalId: sucursal.id,
        tipo: input.tipo, subtipo: input.subtipo,
        timestamp: Date.now(), metodo: "qr",
        latitud: input.latitud, longitud: input.longitud,
        fotoUrl: fotoUrl ?? null,
        fotoUniformeUrl: fotoUniformeUrl ?? null,
        contadorSelladora: input.contadorSelladora ?? null,
        vasosConteo: input.vasosConteo ?? null,
        popotesConteo: input.popotesConteo ?? null,
        selladuroOk: input.selladuroOk !== undefined ? (input.selladuroOk ? 1 : 0) : 1,
        motivoDiferencia: input.motivoDiferencia ?? null,
      });
      return { success: true, sucursalNombre: sucursal.nombre,
        empleadoNombre: `${empleado.nombre} ${empleado.apellido ?? ""}`.trim(), subtipo: input.subtipo };
    }),

  registrarManual: protectedProcedure
    .input(z.object({
      empleadoId: z.number(), sucursalId: z.number(),
      tipo: z.enum(["entrada", "salida"]),
      subtipo: z.enum(["apertura_tienda","entrada_turno","cierre_tienda","salida_turno"]).optional(),
      timestamp: z.number(), notas: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const { registrarAsistencia } = await import("../db");
      await registrarAsistencia({ ...input, metodo: "manual", registradoPorId: ctx.user.id });
      return { success: true };
    }),

  listBySucursal: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fechaInicio: z.number().optional(), fechaFin: z.number().optional() }))
    .query(async ({ input }) => {
      const { getAsistenciaBySucursal } = await import("../db");
      return getAsistenciaBySucursal(input.sucursalId, input.fechaInicio, input.fechaFin);
    }),

  listByEmpleado: protectedProcedure
    .input(z.object({ empleadoId: z.number(), fechaInicio: z.number().optional(), fechaFin: z.number().optional() }))
    .query(async ({ input }) => {
      const { getAsistenciaByEmpleado } = await import("../db");
      return getAsistenciaByEmpleado(input.empleadoId, input.fechaInicio, input.fechaFin);
    }),

  generarQrToken: protectedProcedure
    .input(z.object({ sucursalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const { setQrToken } = await import("../db");
      const token = randomBytes(24).toString("hex");
      await setQrToken(input.sucursalId, token);
      return { token };
    }),

  getQrToken: protectedProcedure
    .input(z.object({ sucursalId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const { getSucursalById } = await import("../db");
      const s = await getSucursalById(input.sucursalId);
      return { token: s?.qrToken ?? null };
    }),

  getUltimaApertura: publicProcedure
    .input(z.object({ sucursalId: z.number(), empleadoId: z.number(), qrToken: z.string() }))
    .query(async ({ input }) => {
      const { getSucursalByQrToken, getDb } = await import("../db");
      const sucursal = await getSucursalByQrToken(input.qrToken);
      if (!sucursal || sucursal.id !== input.sucursalId) return null;
      const db = await getDb();
      if (!db) return null;
      const { asistencia } = await import("../../drizzle/schema");
      const { eq, and, gte, desc } = await import("drizzle-orm");
      const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
      const rows = await db.select().from(asistencia)
        .where(and(eq(asistencia.sucursalId, input.sucursalId), eq(asistencia.empleadoId, input.empleadoId),
          eq(asistencia.subtipo, "apertura_tienda"), gte(asistencia.timestamp, inicioHoy.getTime())))
        .orderBy(desc(asistencia.timestamp)).limit(1);
      return rows[0] ?? null;
    }),

  getEvidencias: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fechaInicio: z.number(), fechaFin: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!["owner","superadmin","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return [];
      const { asistencia, empleados: emp } = await import("../../drizzle/schema");
      const { eq, and, between } = await import("drizzle-orm");
      return db.select({
        id: asistencia.id, tipo: asistencia.tipo, subtipo: asistencia.subtipo,
        timestamp: asistencia.timestamp, fotoUrl: asistencia.fotoUrl,
        fotoUniformeUrl: asistencia.fotoUniformeUrl,
        contadorSelladora: asistencia.contadorSelladora, vasosConteo: asistencia.vasosConteo,
        popotesConteo: asistencia.popotesConteo, selladuroOk: asistencia.selladuroOk,
        motivoDiferencia: asistencia.motivoDiferencia, latitud: asistencia.latitud,
        longitud: asistencia.longitud, metodo: asistencia.metodo, notas: asistencia.notas,
        empleadoId: asistencia.empleadoId, empleadoNombre: emp.nombre, empleadoApellido: emp.apellido,
      }).from(asistencia).leftJoin(emp, eq(asistencia.empleadoId, emp.id))
        .where(and(eq(asistencia.sucursalId, input.sucursalId),
          between(asistencia.timestamp, input.fechaInicio, input.fechaFin)))
        .orderBy(asistencia.timestamp);
    }),
});
