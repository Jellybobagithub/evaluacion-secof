import { eq, desc, and, inArray, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, sucursales, evaluaciones, respuestas, planAccion, puntosEvaluacion,
  userSucursales, InsertSucursal, InsertEvaluacion, InsertRespuesta, InsertPlanAccion,
  InsertPuntoEvaluacion, empleados, InsertEmpleado, checklistPlantillas, InsertChecklistPlantilla,
  checklistRegistros, InsertChecklistRegistro, asistencia, InsertAsistencia,
  observacionesKpi, InsertObservacionKpi, reportesDiarios, InsertReporteDiario,
  horariosSemanales, InsertHorarioSemanal, bajasEmpleados, InsertBajaEmpleado
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'superadmin'; updateSet.role = 'superadmin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function isNewUser(openId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
  return result.length === 0;
}

// ─── Sucursales ───────────────────────────────────────────────────────────────

export async function getSucursales() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sucursales).orderBy(desc(sucursales.createdAt));
}

export async function getSucursalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sucursales).where(eq(sucursales.id, id)).limit(1);
  return result[0];
}

export async function createSucursal(data: InsertSucursal) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(sucursales).values(data);
  return result;
}

export async function updateSucursal(id: number, data: Partial<InsertSucursal>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(sucursales).set(data).where(eq(sucursales.id, id));
}

export async function deleteSucursal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(sucursales).set({ activa: false }).where(eq(sucursales.id, id));
}

// ─── Evaluaciones ─────────────────────────────────────────────────────────────

export async function getEvaluaciones(sucursalId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sucursalId) {
    return db.select().from(evaluaciones).where(eq(evaluaciones.sucursalId, sucursalId)).orderBy(desc(evaluaciones.fecha));
  }
  return db.select().from(evaluaciones).orderBy(desc(evaluaciones.fecha));
}

export async function getEvaluacionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(evaluaciones).where(eq(evaluaciones.id, id)).limit(1);
  return result[0];
}

export async function createEvaluacion(data: InsertEvaluacion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(evaluaciones).values(data);
  return result;
}

export async function updateEvaluacion(id: number, data: Partial<InsertEvaluacion>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(evaluaciones).set(data).where(eq(evaluaciones.id, id));
}

export async function deleteEvaluacion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(evaluaciones).where(eq(evaluaciones.id, id));
}

// ─── Respuestas ───────────────────────────────────────────────────────────────

export async function getRespuestasByEvaluacion(evaluacionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(respuestas).where(eq(respuestas.evaluacionId, evaluacionId));
}

export async function upsertRespuestas(evaluacionId: number, data: Omit<InsertRespuesta, "evaluacionId">[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete existing and re-insert
  await db.delete(respuestas).where(eq(respuestas.evaluacionId, evaluacionId));
  if (data.length === 0) return;
  const rows = data.map(r => ({ ...r, evaluacionId }));
  return db.insert(respuestas).values(rows);
}

// ─── Plan de Acción ───────────────────────────────────────────────────────────

export async function getPlanAccion(sucursalId?: number, evaluacionId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sucursalId && evaluacionId) {
    return db.select().from(planAccion).where(and(eq(planAccion.sucursalId, sucursalId), eq(planAccion.evaluacionId, evaluacionId))).orderBy(desc(planAccion.createdAt));
  }
  if (sucursalId) {
    return db.select().from(planAccion).where(eq(planAccion.sucursalId, sucursalId)).orderBy(desc(planAccion.createdAt));
  }
  return db.select().from(planAccion).orderBy(desc(planAccion.createdAt));
}

export async function createPlanAccion(data: InsertPlanAccion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(planAccion).values(data);
}

export async function updatePlanAccion(id: number, data: Partial<InsertPlanAccion>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(planAccion).set(data).where(eq(planAccion.id, id));
}

export async function deletePlanAccion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(planAccion).where(eq(planAccion.id, id));
}

// ─── Historial Comparativo ────────────────────────────────────────────────────

// ─── Puntos de Evaluación (Admin) ──────────────────────────────────────────────────

export async function getPuntosEvaluacion(soloActivos = false) {
  const db = await getDb();
  if (!db) return [];
  if (soloActivos) {
    return db.select().from(puntosEvaluacion)
      .where(eq(puntosEvaluacion.activo, true))
      .orderBy(puntosEvaluacion.seccionNumero, puntosEvaluacion.orden);
  }
  return db.select().from(puntosEvaluacion)
    .orderBy(puntosEvaluacion.seccionNumero, puntosEvaluacion.orden);
}

export async function getPuntoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(puntosEvaluacion).where(eq(puntosEvaluacion.id, id)).limit(1);
  return result[0];
}

export async function createPunto(data: InsertPuntoEvaluacion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(puntosEvaluacion).values(data);
}

export async function updatePunto(id: number, data: Partial<InsertPuntoEvaluacion>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(puntosEvaluacion).set(data).where(eq(puntosEvaluacion.id, id));
}

export async function togglePuntoActivo(id: number, activo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(puntosEvaluacion).set({ activo }).where(eq(puntosEvaluacion.id, id));
}

export async function deletePunto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(puntosEvaluacion).where(eq(puntosEvaluacion.id, id));
}

// ─── Historial Comparativo ──────────────────────────────────────────────────

export async function getHistorialComparativo(sucursalId?: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  let query = db
    .select({
      id: evaluaciones.id,
      sucursalId: evaluaciones.sucursalId,
      fecha: evaluaciones.fecha,
      evaluadorNombre: evaluaciones.evaluadorNombre,
      puntosObtenidos: evaluaciones.puntosObtenidos,
      puntosMaximos: evaluaciones.puntosMaximos,
      porcentajeGeneral: evaluaciones.porcentajeGeneral,
      calificacion: evaluaciones.calificacion,
      puntuacionPorCategoria: evaluaciones.puntuacionPorCategoria,
      puntuacionPorSeccion: evaluaciones.puntuacionPorSeccion,
    })
    .from(evaluaciones)
    .where(
      sucursalId
        ? and(eq(evaluaciones.estado, "completada"), eq(evaluaciones.sucursalId, sucursalId))
        : eq(evaluaciones.estado, "completada")
    )
    .orderBy(evaluaciones.fecha)
    .limit(limit);
  return query;
}

// ─── Reportes Diarios ────────────────────────────────────────────────────────────────────────────────────

export async function getReportesDiarios(sucursalId?: number, userId?: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  const { reportesDiarios } = await import('../drizzle/schema');
  let q = db.select().from(reportesDiarios).$dynamic();
  if (sucursalId) q = q.where(eq(reportesDiarios.sucursalId, sucursalId));
  else if (userId) q = q.where(eq(reportesDiarios.usuarioId, userId));
  return q.orderBy(desc(reportesDiarios.fecha)).limit(limit);
}

export async function getReporteDiarioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const { reportesDiarios } = await import('../drizzle/schema');
  const result = await db.select().from(reportesDiarios).where(eq(reportesDiarios.id, id)).limit(1);
  return result[0];
}

export async function createReporteDiario(data: import('../drizzle/schema').InsertReporteDiario) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { reportesDiarios } = await import('../drizzle/schema');
  return db.insert(reportesDiarios).values(data);
}

export async function updateReporteDiario(id: number, data: Partial<import('../drizzle/schema').InsertReporteDiario>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { reportesDiarios } = await import('../drizzle/schema');
  return db.update(reportesDiarios).set(data).where(eq(reportesDiarios.id, id));
}

export async function deleteReporteDiario(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { reportesDiarios } = await import('../drizzle/schema');
  return db.delete(reportesDiarios).where(eq(reportesDiarios.id, id));
}

// ─── Sucursales asignadas al usuario ────────────────────────────────────────

export async function getSucursalesAsignadas(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const asignaciones = await db.select().from(userSucursales).where(eq(userSucursales.userId, userId));
  if (asignaciones.length === 0) return [];
  const ids = asignaciones.map(a => a.sucursalId);
  return db.select().from(sucursales).where(inArray(sucursales.id, ids)).orderBy(desc(sucursales.createdAt));
}

export async function getEvaluacionesByUser(userId: number, userRole: string, sucursalId?: number) {
  const db = await getDb();
  if (!db) return [];
  // superadmin, owner, manager ven todas las evaluaciones
  if (['superadmin', 'owner', 'manager'].includes(userRole)) {
    return getEvaluaciones(sucursalId);
  }
  // leader y host solo ven las de sus sucursales asignadas
  const asignaciones = await db.select().from(userSucursales).where(eq(userSucursales.userId, userId));
  if (asignaciones.length === 0) return [];
  const ids = asignaciones.map(a => a.sucursalId);
  if (sucursalId && !ids.includes(sucursalId)) return [];
  const filterIds = sucursalId ? [sucursalId] : ids;
  return db.select().from(evaluaciones)
    .where(inArray(evaluaciones.sucursalId, filterIds))
    .orderBy(desc(evaluaciones.fecha));
}

// ─── Admin: Gestión de Usuarios ──────────────────────────────────────────────

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.createdAt);
}

export async function updateUserRole(userId: number, role: string, notas?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { role };
  if (notas !== undefined) updateData.notas = notas;
  await db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function toggleUserActivo(userId: number, activo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ activo }).where(eq(users.id, userId));
}

// ─── Admin: Asignación Usuario-Sucursal ──────────────────────────────────────

export async function getUserSucursales(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userSucursales).where(eq(userSucursales.userId, userId));
}

export async function assignUserSucursal(userId: number, sucursalId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Evitar duplicados
  const existing = await db.select().from(userSucursales)
    .where(and(eq(userSucursales.userId, userId), eq(userSucursales.sucursalId, sucursalId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(userSucursales).values({ userId, sucursalId });
}

export async function removeUserSucursal(userId: number, sucursalId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(userSucursales)
    .where(and(eq(userSucursales.userId, userId), eq(userSucursales.sucursalId, sucursalId)));
}

// // ─── Empleados ──────────────────────────────────────────────────────-orm";

export async function getEmpleadosBySucursal(sucursalId: number, soloActivos = true) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(empleados.sucursalId, sucursalId)];
  if (soloActivos) conds.push(eq(empleados.activo, true));
  return db.select().from(empleados).where(and(...conds)).orderBy(empleados.nombre);
}

export async function getEmpleadoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(empleados).where(eq(empleados.id, id)).limit(1);
  return rows[0];
}

export async function createEmpleado(data: InsertEmpleado) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(empleados).values(data);
}

export async function updateEmpleado(id: number, data: Partial<InsertEmpleado>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(empleados).set(data).where(eq(empleados.id, id));
}

export async function darBajaEmpleado(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(empleados).set({ activo: false, fechaBaja: new Date() }).where(eq(empleados.id, id));
}

// ─── Checklist Plantillas ────────────────────────────────────────────────────

export async function getChecklistPlantillas(soloActivas = true) {
  const db = await getDb();
  if (!db) return [];
  const conds = soloActivas ? [eq(checklistPlantillas.activo, true)] : [];
  return db.select().from(checklistPlantillas)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(checklistPlantillas.nombre);
}

export async function getChecklistPlantillaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(checklistPlantillas).where(eq(checklistPlantillas.id, id)).limit(1);
  return rows[0];
}

export async function createChecklistPlantilla(data: InsertChecklistPlantilla) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(checklistPlantillas).values(data);
  return result;
}

export async function updateChecklistPlantilla(id: number, data: Partial<InsertChecklistPlantilla>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(checklistPlantillas).set(data).where(eq(checklistPlantillas.id, id));
}

// ─── Checklist Registros ─────────────────────────────────────────────────────

export async function getChecklistRegistros(sucursalId: number, fechaInicio?: Date, fechaFin?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(checklistRegistros.sucursalId, sucursalId)];
  if (fechaInicio) conds.push(gte(checklistRegistros.fecha, fechaInicio));
  if (fechaFin) conds.push(lte(checklistRegistros.fecha, fechaFin));
  return db.select().from(checklistRegistros)
    .where(and(...conds))
    .orderBy(desc(checklistRegistros.fecha));
}

export async function getChecklistRegistroById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(checklistRegistros).where(eq(checklistRegistros.id, id)).limit(1);
  return rows[0];
}

export async function createChecklistRegistro(data: InsertChecklistRegistro) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(checklistRegistros).values(data);
  return result;
}

export async function updateChecklistRegistro(id: number, data: Partial<InsertChecklistRegistro>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(checklistRegistros).set(data).where(eq(checklistRegistros.id, id));
}

// ─── Asistencia ──────────────────────────────────────────────────────────────

export async function getAsistenciaBySucursal(sucursalId: number, fechaInicio?: number, fechaFin?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(asistencia.sucursalId, sucursalId)];
  if (fechaInicio) conds.push(gte(asistencia.timestamp, fechaInicio));
  if (fechaFin) conds.push(lte(asistencia.timestamp, fechaFin));
  return db.select().from(asistencia).where(and(...conds)).orderBy(desc(asistencia.timestamp));
}

export async function getAsistenciaByEmpleado(empleadoId: number, fechaInicio?: number, fechaFin?: number) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(asistencia.empleadoId, empleadoId)];
  if (fechaInicio) conds.push(gte(asistencia.timestamp, fechaInicio));
  if (fechaFin) conds.push(lte(asistencia.timestamp, fechaFin));
  return db.select().from(asistencia).where(and(...conds)).orderBy(desc(asistencia.timestamp));
}

export async function registrarAsistencia(data: InsertAsistencia) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(asistencia).values(data);
}

export async function getUltimoRegistroAsistencia(empleadoId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(asistencia)
    .where(eq(asistencia.empleadoId, empleadoId))
    .orderBy(desc(asistencia.timestamp))
    .limit(1);
  return rows[0];
}

// ─── Observaciones KPI ───────────────────────────────────────────────────────

export async function getObservacionesKpi(sucursalId: number, semana?: string) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(observacionesKpi.sucursalId, sucursalId)];
  if (semana) conds.push(eq(observacionesKpi.semana, semana));
  return db.select().from(observacionesKpi).where(and(...conds)).orderBy(desc(observacionesKpi.createdAt));
}

export async function getObservacionesKpiByEmpleado(empleadoId: number, semana?: string) {
  const db = await getDb();
  if (!db) return [];
  const conds = [eq(observacionesKpi.empleadoId, empleadoId)];
  if (semana) conds.push(eq(observacionesKpi.semana, semana));
  return db.select().from(observacionesKpi).where(and(...conds)).orderBy(desc(observacionesKpi.createdAt));
}

export async function createObservacionKpi(data: InsertObservacionKpi) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(observacionesKpi).values(data);
}

// ─── QR Token de Sucursal ────────────────────────────────────────────────────

export async function getSucursalByQrToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(sucursales).where(eq(sucursales.qrToken, token)).limit(1);
  return rows[0];
}

export async function setQrToken(sucursalId: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(sucursales).set({ qrToken: token }).where(eq(sucursales.id, sucursalId));
}

// ─── Bajas de Empleados ──────────────────────────────────────────────────────
// (bajasEmpleados, reportesDiarios, empleados, asistencia ya importados desde schema)

export async function createBajaEmpleado(data: InsertBajaEmpleado) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(bajasEmpleados).values(data);
}

export async function getBajasBySucursal(sucursalId: number, fechaInicio?: Date, fechaFin?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conds: any[] = [eq(bajasEmpleados.sucursalId, sucursalId)];
  if (fechaInicio) conds.push(gte(bajasEmpleados.fechaBaja, fechaInicio));
  if (fechaFin) conds.push(lte(bajasEmpleados.fechaBaja, fechaFin));
  return db.select().from(bajasEmpleados).where(and(...conds)).orderBy(desc(bajasEmpleados.fechaBaja));
}

// KPI Rotación de Equipo: (bajas en el trimestre / promedio de plantilla) * 100
export async function getKpiRotacion(sucursalId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { bajas: 0, plantillaPromedio: 0, porcentaje: 0 };
  const bajas = await db.select().from(bajasEmpleados)
    .where(and(
      eq(bajasEmpleados.sucursalId, sucursalId),
      gte(bajasEmpleados.fechaBaja, fechaInicio),
      lte(bajasEmpleados.fechaBaja, fechaFin)
    ));
  const totalEmpleados = await db.select().from(empleados)
    .where(eq(empleados.sucursalId, sucursalId));
  const activos = totalEmpleados.filter(e => e.activo).length;
  const plantillaPromedio = activos + Math.floor(bajas.length / 2); // estimado
  const porcentaje = plantillaPromedio > 0 ? (bajas.length / plantillaPromedio) * 100 : 0;
  return { bajas: bajas.length, plantillaPromedio, porcentaje: Math.round(porcentaje * 10) / 10 };
}

// ─── Cumplimiento de Reportes ────────────────────────────────────────────────

export async function getCumplimientoReportes(sucursalId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { enviados: 0, esperados: 0, porcentaje: 0, diasSinReporte: [] as string[] };
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fechaInicio),
      lte(reportesDiarios.fecha, fechaFin),
      eq(reportesDiarios.estado, 'enviado')
    ));
  // Calcular días laborables en el rango (lunes a sábado)
  const diasLaborables: string[] = [];
  const cursor = new Date(fechaInicio);
  while (cursor <= fechaFin) {
    const dow = cursor.getDay(); // 0=dom, 6=sab
    if (dow !== 0) { // excluir domingos
      diasLaborables.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const diasConReporte = new Set(reportes.map(r => new Date(r.fecha).toISOString().slice(0, 10)));
  const diasSinReporte = diasLaborables.filter(d => !diasConReporte.has(d));
  const enviados = reportes.length;
  const esperados = diasLaborables.length;
  const porcentaje = esperados > 0 ? Math.round((enviados / esperados) * 100) : 100;
  return { enviados, esperados, porcentaje, diasSinReporte };
}

// ─── KPI Mermas ──────────────────────────────────────────────────────────────

export async function getKpiMermas(sucursalId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return { totalMermas: 0, totalVentas: 0, porcentaje: 0, diasConAlerta: 0 };
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fechaInicio),
      lte(reportesDiarios.fecha, fechaFin),
      eq(reportesDiarios.estado, 'enviado')
    ));
  const totalMermas = reportes.reduce((s, r) => s + (r.mermasMonto ?? 0), 0);
  const totalVentas = reportes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
  const porcentaje = totalVentas > 0 ? (totalMermas / totalVentas) * 100 : 0;
  const diasConAlerta = reportes.filter(r => r.ventasTotales && r.mermasMonto && (r.mermasMonto / r.ventasTotales) > 0.03).length;
  return {
    totalMermas: Math.round(totalMermas * 100) / 100,
    totalVentas: Math.round(totalVentas * 100) / 100,
    porcentaje: Math.round(porcentaje * 10) / 10,
    diasConAlerta
  };
}

// ─── KPI Puntualidad ─────────────────────────────────────────────────────────

export async function getKpiPuntualidad(sucursalId: number, fechaInicio: number, fechaFin: number) {
  const db = await getDb();
  if (!db) return [];
  // Obtener empleados de la sucursal
  const emps = await db.select().from(empleados)
    .where(and(eq(empleados.sucursalId, sucursalId), eq(empleados.activo, true)));
  const result = [];
  for (const emp of emps) {
    const registros = await db.select().from(asistencia)
      .where(and(
        eq(asistencia.empleadoId, emp.id),
        gte(asistencia.timestamp, fechaInicio),
        lte(asistencia.timestamp, fechaFin),
        eq(asistencia.tipo, 'entrada')
      )).orderBy(asistencia.timestamp);
    // Contar entradas tardías (después de las 8:00 matutino o 14:00 vespertino)
    let tardias = 0;
    for (const reg of registros) {
      const hora = new Date(reg.timestamp).getHours();
      const minuto = new Date(reg.timestamp).getMinutes();
      const minutosDesdeMedianoche = hora * 60 + minuto;
      // Tardanza: matutino si llega después de 8:10, vespertino si llega después de 14:10
      if ((minutosDesdeMedianoche > 490 && minutosDesdeMedianoche < 840) ||
          (minutosDesdeMedianoche > 850)) {
        tardias++;
      }
    }
    result.push({
      empleadoId: emp.id,
      nombre: emp.nombre + (emp.apellido ? ' ' + emp.apellido : ''),
      rol: emp.rol,
      totalEntradas: registros.length,
      tardias,
      porcentajePuntualidad: registros.length > 0 ? Math.round(((registros.length - tardias) / registros.length) * 100) : 100
    });
  }
  return result;
}

// ─── Descuadres de Caja ──────────────────────────────────────────────────────

export async function getDescuadresCaja(sucursalId: number, fechaInicio: Date, fechaFin: Date) {
  const db = await getDb();
  if (!db) return [];
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fechaInicio),
      lte(reportesDiarios.fecha, fechaFin)
    )).orderBy(desc(reportesDiarios.fecha));
  return reportes
    .filter(r => r.diferenciaCaja !== null && r.diferenciaCaja !== 0)
    .map(r => ({
      id: r.id,
      fecha: r.fecha,
      diferenciaCaja: r.diferenciaCaja ?? 0,
      efectivoInicial: r.efectivoInicial ?? 0,
      efectivoFinal: r.efectivoFinal ?? 0,
      ventasTotales: r.ventasTotales ?? 0,
      notasCaja: r.notasCaja,
      usuarioNombre: r.usuarioNombre,
    }));
}
