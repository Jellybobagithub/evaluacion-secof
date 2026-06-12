import { eq, desc, asc, and, inArray, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, sucursales, evaluaciones, respuestas, planAccion, puntosEvaluacion,
  userSucursales, InsertSucursal, InsertEvaluacion, InsertRespuesta, InsertPlanAccion,
  InsertPuntoEvaluacion, empleados, InsertEmpleado, checklistPlantillas, InsertChecklistPlantilla,
  checklistRegistros, InsertChecklistRegistro, asistencia, InsertAsistencia,
  observacionesKpi, InsertObservacionKpi, reportesDiarios, InsertReporteDiario,
  horariosSemanales, InsertHorarioSemanal, bajasEmpleados, InsertBajaEmpleado,
  registroNomina, InsertRegistroNomina, turnoApertura, turnoCierre
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


export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
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
  return db.select().from(sucursales).where(eq(sucursales.activa, true)).orderBy(asc(sucursales.id));
}

export async function getSucursalesTodas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sucursales).orderBy(asc(sucursales.id));
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
  return db.select().from(sucursales).where(inArray(sucursales.id, ids)).orderBy(asc(sucursales.id));
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

// Convierte Date a string YYYY-MM-DD local (sin desfase UTC)
function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export async function getCumplimientoReportes(sucursalId: number, fechaInicio: Date | string, fechaFin: Date | string) {
  const db = await getDb();
  if (!db) return { enviados: 0, esperados: 0, porcentaje: 0, diasSinReporte: [] as string[] };
  const fi = toDateStr(fechaInicio);
  const ff = toDateStr(fechaFin);
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fi),
      lte(reportesDiarios.fecha, ff),
      eq(reportesDiarios.estado, 'enviado')
    ));
  // Calcular días laborables en el rango (lunes a sábado)
  const diasLaborables: string[] = [];
  const [sy, sm, sd] = fi.split('-').map(Number);
  const [ey, em, ed] = ff.split('-').map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow !== 0) {
      diasLaborables.push(toDateStr(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const diasConReporte = new Set(reportes.map(r => r.fecha as string));
  const diasSinReporte = diasLaborables.filter(d => !diasConReporte.has(d));
  const enviados = reportes.length;
  const esperados = diasLaborables.length;
  const porcentaje = esperados > 0 ? Math.round((enviados / esperados) * 100) : 100;
  return { enviados, esperados, porcentaje, diasSinReporte };
}

// ─── KPI Mermas ──────────────────────────────────────────────────────────────

export async function getKpiMermas(sucursalId: number, fechaInicio: Date | string, fechaFin: Date | string) {
  const db = await getDb();
  if (!db) return { totalMermas: 0, totalVentas: 0, porcentaje: 0, diasConAlerta: 0 };
  const fi = toDateStr(fechaInicio);
  const ff = toDateStr(fechaFin);
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fi),
      lte(reportesDiarios.fecha, ff),
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

export async function getDescuadresCaja(sucursalId: number, fechaInicio: Date | string, fechaFin: Date | string) {
  const db = await getDb();
  if (!db) return [];
  const fi = toDateStr(fechaInicio);
  const ff = toDateStr(fechaFin);
  const reportes = await db.select().from(reportesDiarios)
    .where(and(
      eq(reportesDiarios.sucursalId, sucursalId),
      gte(reportesDiarios.fecha, fi),
      lte(reportesDiarios.fecha, ff)
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

// ─── KPI Nivel 3: Crecimiento Mes vs Mes ─────────────────────────────────────
export async function getKpiCrecimiento(sucursalId: number, anio: number, mes: number) {
  const db = await getDb();
  if (!db) return { ventasActual: 0, ventasAnterior: 0, crecimiento: 0, tendencia: [] as any[] };
  const { ventasHistoricas, reportesDiarios: rd } = await import('../drizzle/schema');
  const { eq, and, gte, lte } = await import('drizzle-orm');

  // Ventas del mes actual (desde reportes diarios)
  const fi = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const diasMes = new Date(anio, mes, 0).getDate();
  const ff = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
  const reportesMes = await db.select().from(rd)
    .where(and(eq(rd.sucursalId, sucursalId), gte(rd.fecha, fi), lte(rd.fecha, ff), eq(rd.estado, 'enviado')));
  const ventasActual = reportesMes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);

  // Ventas del mismo mes del año anterior (desde ventas históricas)
  const histAnio = anio - 1;
  const hist = await db.select().from(ventasHistoricas)
    .where(and(eq(ventasHistoricas.sucursalId, sucursalId), eq(ventasHistoricas.anio, histAnio), eq(ventasHistoricas.mes, mes)))
    .limit(1);
  const ventasAnterior = hist[0]?.ventasTotales ?? 0;
  const crecimiento = ventasAnterior > 0 ? Math.round(((ventasActual - ventasAnterior) / ventasAnterior) * 1000) / 10 : 0;

  // Tendencia de 6 meses
  const tendencia = [];
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  for (let i = 5; i >= 0; i--) {
    let m = mes - i; let y = anio;
    if (m <= 0) { m += 12; y -= 1; }
    const mStr = String(m).padStart(2, '0');
    const fii = `${y}-${mStr}-01`;
    const diasM = new Date(y, m, 0).getDate();
    const ffi = `${y}-${mStr}-${String(diasM).padStart(2, '0')}`;
    const reps = await db.select().from(rd)
      .where(and(eq(rd.sucursalId, sucursalId), gte(rd.fecha, fii), lte(rd.fecha, ffi), eq(rd.estado, 'enviado')));
    const vActual = reps.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
    const histM = await db.select().from(ventasHistoricas)
      .where(and(eq(ventasHistoricas.sucursalId, sucursalId), eq(ventasHistoricas.anio, y - 1), eq(ventasHistoricas.mes, m))).limit(1);
    const vAnterior = histM[0]?.ventasTotales ?? 0;
    tendencia.push({
      mes: `${meses[m-1]} ${y}`, actual: Math.round(vActual), anterior: Math.round(vAnterior),
      crecimiento: vAnterior > 0 ? Math.round(((vActual - vAnterior) / vAnterior) * 1000) / 10 : 0,
    });
  }
  return { ventasActual: Math.round(ventasActual*100)/100, ventasAnterior: Math.round(ventasAnterior*100)/100, crecimiento, tendencia };
}

// ─── KPI Nivel 3: Rentabilidad ────────────────────────────────────────────────
export async function getKpiRentabilidad(sucursalId: number, anio: number, mes: number) {
  const db = await getDb();
  if (!db) return { ventas: 0, costoProducto: 0, costoProductoReceta: 0, gastosTotales: 0, utilidadNeta: 0, margenBruto: 0, margenNeto: 0, desglose: {}, tieneGastos: false };
  const { gastosOperativos, reportesDiarios: rd } = await import('../drizzle/schema');
  const { sql, eq, and, gte, lte } = await import('drizzle-orm');
  const fi = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const diasMes = new Date(anio, mes, 0).getDate();
  const ff = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
  const reportesMes = await db.select().from(rd)
    .where(and(eq(rd.sucursalId, sucursalId), gte(rd.fecha, fi), lte(rd.fecha, ff), eq(rd.estado, 'enviado')));
  const ventas = reportesMes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);

  // Costo real desde recetas: SUM(cantidad_vendida × SUM(cantidadGramos × costoXGramo))
  const [[costoRow]] = await db.execute(sql`
    SELECT COALESCE(SUM(vc.cantidad * sub.costoUnitario), 0) as costoReceta
    FROM inv_ventas_captura vc
    JOIN (
      SELECT r.productoVentaId,
        SUM(r.cantidadGramos * ip.costoXGramo) as costoUnitario
      FROM inv_recetas r
      JOIN inv_productos ip ON ip.id = r.materiasPrimaId
      WHERE ip.costoXGramo > 0
      GROUP BY r.productoVentaId
    ) sub ON sub.productoVentaId = vc.productoVentaId
    WHERE vc.sucursalId = ${sucursalId}
      AND vc.fecha >= ${fi} AND vc.fecha <= ${ff}
  `) as any;
  const costoProductoReceta = Math.round(Number(costoRow?.costoReceta ?? 0) * 100) / 100;

  const gastos = await db.select().from(gastosOperativos)
    .where(and(eq(gastosOperativos.sucursalId, sucursalId), eq(gastosOperativos.anio, anio), eq(gastosOperativos.mes, mes))).limit(1);
  const g = gastos[0];
  // Usar costo de receta si disponible, fallback a manual
  const costoProducto = costoProductoReceta > 0 ? costoProductoReceta : (g?.costoProducto ?? 0);
  const renta = g?.renta ?? 0; const nomina = g?.nomina ?? 0; const insumos = g?.insumos ?? 0;
  const servicios = g?.servicios ?? 0; const mantenimiento = g?.mantenimiento ?? 0;
  const marketing = g?.marketing ?? 0; const otros = g?.otros ?? 0;
  const gastosTotales = g?.totalGastos ?? (renta + nomina + insumos + servicios + mantenimiento + marketing + otros);
  const margenBruto = ventas > 0 ? Math.round(((ventas - costoProducto) / ventas) * 1000) / 10 : 0;
  const utilidadNeta = ventas - costoProducto - gastosTotales;
  const margenNeto = ventas > 0 ? Math.round((utilidadNeta / ventas) * 1000) / 10 : 0;
  return {
    ventas: Math.round(ventas*100)/100, costoProducto: Math.round(costoProducto*100)/100,
    costoProductoReceta, costoDesdeReceta: costoProductoReceta > 0,
    gastosTotales: Math.round(gastosTotales*100)/100, utilidadNeta: Math.round(utilidadNeta*100)/100,
    margenBruto, margenNeto, tieneGastos: !!g,
    desglose: { renta, nomina, insumos, servicios, mantenimiento, marketing, otros },
  };
}

// ─── KPI Nivel 3: Eficiencia Operativa ───────────────────────────────────────
export async function getKpiEficiencia(sucursalId: number, anio: number, mes: number) {
  const db = await getDb();
  if (!db) return { ventas: 0, gastosTotales: 0, ratioEficiencia: 0, tieneGastos: false, desglosePct: {}, desgloseMonto: {} };
  const { gastosOperativos, reportesDiarios: rd } = await import('../drizzle/schema');
  const { eq, and, gte, lte } = await import('drizzle-orm');
  const fi = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const diasMes = new Date(anio, mes, 0).getDate();
  const ff = `${anio}-${String(mes).padStart(2, '0')}-${String(diasMes).padStart(2, '0')}`;
  const reportesMes = await db.select().from(rd)
    .where(and(eq(rd.sucursalId, sucursalId), gte(rd.fecha, fi), lte(rd.fecha, ff), eq(rd.estado, 'enviado')));
  const ventas = reportesMes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
  const gastos = await db.select().from(gastosOperativos)
    .where(and(eq(gastosOperativos.sucursalId, sucursalId), eq(gastosOperativos.anio, anio), eq(gastosOperativos.mes, mes))).limit(1);
  const g = gastos[0];
  const renta = g?.renta ?? 0; const nomina = g?.nomina ?? 0; const insumos = g?.insumos ?? 0;
  const servicios = g?.servicios ?? 0; const mantenimiento = g?.mantenimiento ?? 0;
  const marketing = g?.marketing ?? 0; const otros = g?.otros ?? 0;
  const gastosTotales = g?.totalGastos ?? (renta + nomina + insumos + servicios + mantenimiento + marketing + otros);
  const pct = (v: number) => ventas > 0 ? Math.round((v / ventas) * 1000) / 10 : 0;
  return {
    ventas: Math.round(ventas*100)/100, gastosTotales: Math.round(gastosTotales*100)/100,
    ratioEficiencia: ventas > 0 ? Math.round((gastosTotales / ventas) * 1000) / 10 : 0,
    tieneGastos: !!g,
    desglosePct: { renta: pct(renta), nomina: pct(nomina), insumos: pct(insumos), servicios: pct(servicios), mantenimiento: pct(mantenimiento), marketing: pct(marketing), otros: pct(otros) },
    desgloseMonto: { renta, nomina, insumos, servicios, mantenimiento, marketing, otros },
  };
}

// ─── CRUD Gastos Operativos ───────────────────────────────────────────────────
export async function getGastosOperativos(sucursalId: number, anio: number, mes?: number) {
  const db = await getDb();
  if (!db) return [];
  const { gastosOperativos } = await import('../drizzle/schema');
  const { eq, and } = await import('drizzle-orm');
  const conditions: any[] = [eq(gastosOperativos.sucursalId, sucursalId), eq(gastosOperativos.anio, anio)];
  if (mes) conditions.push(eq(gastosOperativos.mes, mes));
  return db.select().from(gastosOperativos).where(and(...conditions)).orderBy(gastosOperativos.mes);
}

// ─── Turno Apertura ───────────────────────────────────────────────────────────
export async function registrarAperturaTurno(data: {
  sucursalId: number; empleadoId: number; usuarioId: number;
  fecha: string; tipoTurno: 'matutino' | 'vespertino'; timestamp: number;
  conteoVasos?: number; conteoPopotes?: number; baseSnowteaKg?: number; longanKg?: number;
  fotoSelladoUrl?: string; contadorSelladora?: number; fotoUniformeUrl?: string; notas?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { turnoApertura } = await import('../drizzle/schema');
  const result = await db.insert(turnoApertura).values(data);
  return (result as any)[0]?.insertId ?? (result as any).insertId;
}

export async function getAperturaHoy(sucursalId: number, fecha: string, tipoTurno?: string) {
  const db = await getDb();
  if (!db) return null;
  const { turnoApertura } = await import('../drizzle/schema');
  const { eq, and } = await import('drizzle-orm');
  const conditions: any[] = [eq(turnoApertura.sucursalId, sucursalId), eq(turnoApertura.fecha, fecha)];
  if (tipoTurno) conditions.push(eq(turnoApertura.tipoTurno, tipoTurno as any));
  const rows = await db.select().from(turnoApertura).where(and(...conditions)).orderBy(turnoApertura.timestamp);
  return rows[0] ?? null;
}

export async function getAperturasByFecha(sucursalId: number, fecha: string) {
  const db = await getDb();
  if (!db) return [];
  const { turnoApertura } = await import('../drizzle/schema');
  const { eq, and } = await import('drizzle-orm');
  return db.select().from(turnoApertura)
    .where(and(eq(turnoApertura.sucursalId, sucursalId), eq(turnoApertura.fecha, fecha)))
    .orderBy(turnoApertura.timestamp);
}

// ─── Turno Cierre ─────────────────────────────────────────────────────────────
export async function registrarCierreTurno(data: {
  sucursalId: number; empleadoId: number; usuarioId: number;
  fecha: string; tipoTurno: 'matutino' | 'vespertino'; timestamp: number;
  conteoVasosFinal?: number; conteoPopotesFinal?: number;
  fotoSelladoCierreUrl?: string; contadorSelladoraCierre?: number;
  vasosVendidosSelladora?: number; vasosVendidosReporte?: number; mermaVasos?: number;
  novedadesTurno?: string; incidencias?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { turnoCierre } = await import('../drizzle/schema');
  const result = await db.insert(turnoCierre).values(data);
  return (result as any)[0]?.insertId ?? (result as any).insertId;
}

export async function getCierreHoy(sucursalId: number, fecha: string, tipoTurno?: string) {
  const db = await getDb();
  if (!db) return null;
  const { turnoCierre } = await import('../drizzle/schema');
  const { eq, and } = await import('drizzle-orm');
  const conditions: any[] = [eq(turnoCierre.sucursalId, sucursalId), eq(turnoCierre.fecha, fecha)];
  if (tipoTurno) conditions.push(eq(turnoCierre.tipoTurno, tipoTurno as any));
  const rows = await db.select().from(turnoCierre).where(and(...conditions)).orderBy(turnoCierre.timestamp);
  return rows[0] ?? null;
}

export async function getCierresByRango(sucursalId: number, fechaInicio: string, fechaFin: string) {
  const db = await getDb();
  if (!db) return [];
  const { turnoCierre, turnoApertura, empleados: empTable } = await import('../drizzle/schema');
  const { eq, and, gte, lte } = await import('drizzle-orm');
  const cierres = await db.select().from(turnoCierre)
    .where(and(eq(turnoCierre.sucursalId, sucursalId), gte(turnoCierre.fecha, fechaInicio), lte(turnoCierre.fecha, fechaFin)))
    .orderBy(turnoCierre.fecha);
  if (cierres.length === 0) return [];
  // Cargar aperturas del mismo rango para cruzar contador de apertura
  const aperturas = await db.select().from(turnoApertura)
    .where(and(eq(turnoApertura.sucursalId, sucursalId), gte(turnoApertura.fecha, fechaInicio), lte(turnoApertura.fecha, fechaFin)));
  const aperturaMap: Record<string, typeof aperturas[0]> = {};
  for (const a of aperturas) aperturaMap[`${a.fecha}-${a.tipoTurno}`] = a;
  // Cargar nombres de empleados
  const emps = await db.select({ id: empTable.id, nombre: empTable.nombre }).from(empTable);
  const empMap: Record<number, string> = {};
  for (const e of emps) empMap[e.id] = e.nombre;
  return cierres.map(c => {
    const apertura = aperturaMap[`${c.fecha}-${c.tipoTurno}`];
    return {
      ...c,
      empleadoNombre: empMap[c.empleadoId] ?? null,
      contadorApertura: apertura?.contadorSelladora ?? null,
    };
  });
}

// ─── Avisos Generales ─────────────────────────────────────────────────────────
export async function getAvisosActivos(sucursalId?: number, fecha?: string) {
  const db = await getDb();
  if (!db) return [];
  const { avisosGenerales } = await import('../drizzle/schema');
  const { eq, or, isNull, and, gte } = await import('drizzle-orm');
  const hoy = fecha ?? new Date().toISOString().split('T')[0];
  const conditions: any[] = [eq(avisosGenerales.activo, true)];
  // Filtrar por sucursal: avisos globales (sucursalId null) o de esta sucursal
  if (sucursalId) {
    conditions.push(or(isNull(avisosGenerales.sucursalId), eq(avisosGenerales.sucursalId, sucursalId)));
  }
  // No expirados
  conditions.push(or(isNull(avisosGenerales.fechaExpiracion), gte(avisosGenerales.fechaExpiracion, hoy)));
  return db.select().from(avisosGenerales).where(and(...conditions)).orderBy(avisosGenerales.createdAt);
}

export async function createAviso(data: {
  sucursalId?: number; titulo: string; contenido: string;
  tipo: 'info' | 'urgente' | 'recordatorio'; creadoPorId: number; fechaExpiracion?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { avisosGenerales } = await import('../drizzle/schema');
  const result = await db.insert(avisosGenerales).values({ ...data, activo: true });
  return (result as any)[0]?.insertId ?? (result as any).insertId;
}

export async function updateAviso(id: number, data: Partial<{ titulo: string; contenido: string; tipo: string; activo: boolean; fechaExpiracion: string | null; sucursalId: number | null }>) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { avisosGenerales } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(avisosGenerales).set(data as any).where(eq(avisosGenerales.id, id));
}

export async function deleteAviso(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const { avisosGenerales } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  await db.delete(avisosGenerales).where(eq(avisosGenerales.id, id));
}

export async function getAllAvisos(sucursalId?: number) {
  const db = await getDb();
  if (!db) return [];
  const { avisosGenerales } = await import('../drizzle/schema');
  const { eq, or, isNull, and } = await import('drizzle-orm');
  if (sucursalId) {
    return db.select().from(avisosGenerales)
      .where(and(or(isNull(avisosGenerales.sucursalId), eq(avisosGenerales.sucursalId, sucursalId))))
      .orderBy(avisosGenerales.createdAt);
  }
  return db.select().from(avisosGenerales).orderBy(avisosGenerales.createdAt);
}

// ─── Merma: resumen mensual por sucursal ─────────────────────────────────────
export async function getMermaResumen(sucursalId: number, anio: number, mes: number) {
  const db = await getDb();
  if (!db) return { totalMermaVasos: 0, registros: 0, porcentajeMerma: 0 };
  const { turnoCierre } = await import('../drizzle/schema');
  const { eq, and, like, sum, count } = await import('drizzle-orm');
  const mesStr = `${anio}-${String(mes).padStart(2, '0')}`;
  const rows = await db.select({
    totalMermaVasos: sum(turnoCierre.mermaVasos),
    totalVasosVendidosSelladora: sum(turnoCierre.vasosVendidosSelladora),
    registros: count(turnoCierre.id),
  }).from(turnoCierre)
    .where(and(eq(turnoCierre.sucursalId, sucursalId), like(turnoCierre.fecha, `${mesStr}%`)));
  const r = rows[0];
  const merma = Number(r?.totalMermaVasos ?? 0);
  const vendidos = Number(r?.totalVasosVendidosSelladora ?? 0);
  return {
    totalMermaVasos: merma,
    registros: Number(r?.registros ?? 0),
    porcentajeMerma: vendidos > 0 ? Math.round((Math.abs(merma) / vendidos) * 1000) / 10 : 0,
  };
}

// ─── Empleado por userId (para anfitriones con cuenta de usuario) ─────────────
export async function getEmpleadoByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const { empleados } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(empleados).where(eq(empleados.userId, userId)).limit(1);
  return rows[0] ?? null;
}

// ─── Registros de turno con fotos (para vista del líder/manager/dueño) ─────────
export async function getRegistrosTurnoConFotos(sucursalId: number, fechaInicio: string, fechaFin: string) {
  const db = await getDb();
  if (!db) return [];
  const { turnoApertura, turnoCierre, empleados } = await import('../drizzle/schema');
  const { eq, and, gte, lte } = await import('drizzle-orm');

  const aperturas = await db.select().from(turnoApertura)
    .where(and(eq(turnoApertura.sucursalId, sucursalId), gte(turnoApertura.fecha, fechaInicio), lte(turnoApertura.fecha, fechaFin)))
    .orderBy(turnoApertura.fecha);

  const cierres = await db.select().from(turnoCierre)
    .where(and(eq(turnoCierre.sucursalId, sucursalId), gte(turnoCierre.fecha, fechaInicio), lte(turnoCierre.fecha, fechaFin)))
    .orderBy(turnoCierre.fecha);

  // Obtener nombres de empleados
  const allEmpIds = [...aperturas.map(a => a.empleadoId), ...cierres.map(c => c.empleadoId)];
  const empIds = allEmpIds.filter((id, idx) => allEmpIds.indexOf(id) === idx);
  const empRows = empIds.length > 0 ? await db.select({ id: empleados.id, nombre: empleados.nombre, apellido: empleados.apellido }).from(empleados) : [];
  const empMap: Record<number, string> = {};
  for (const e of empRows) {
    empMap[e.id] = `${e.nombre} ${e.apellido ?? ''}`.trim();
  }

  // Combinar por fecha + tipoTurno
  const mapa: Record<string, any> = {};
  for (const a of aperturas) {
    const key = `${a.fecha}-${a.tipoTurno}`;
    mapa[key] = {
      fecha: a.fecha,
      tipoTurno: a.tipoTurno,
      apertura: {
        id: a.id,
        timestamp: a.timestamp,
        empleadoId: a.empleadoId,
        empleadoNombre: empMap[a.empleadoId] ?? `#${a.empleadoId}`,
        fotoUniformeUrl: a.fotoUniformeUrl,
        fotoSelladoUrl: a.fotoSelladoUrl,
        contadorSelladora: a.contadorSelladora,
        conteoVasos: a.conteoVasos,
        conteoPopotes: a.conteoPopotes,
        notas: a.notas,
      },
      cierre: null,
    };
  }
  for (const c of cierres) {
    const key = `${c.fecha}-${c.tipoTurno}`;
    if (!mapa[key]) {
      mapa[key] = { fecha: c.fecha, tipoTurno: c.tipoTurno, apertura: null };
    }
    mapa[key].cierre = {
      id: c.id,
      timestamp: c.timestamp,
      empleadoId: c.empleadoId,
      empleadoNombre: empMap[c.empleadoId] ?? `#${c.empleadoId}`,
      fotoSelladoCierreUrl: c.fotoSelladoCierreUrl,
      contadorSelladoraCierre: c.contadorSelladoraCierre,
      conteoVasosFinal: c.conteoVasosFinal,
      vasosVendidosSelladora: c.vasosVendidosSelladora,
      vasosVendidosReporte: c.vasosVendidosReporte,
      mermaVasos: c.mermaVasos,
      novedadesTurno: c.novedadesTurno,
    };
  }

  return Object.values(mapa).sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
}

// ─── Control de Asistencias / Nómina ─────────────────────────────────────────

// Horas de inicio/fin de turno según tipo (hora local México UTC-6)
const TURNO_HORAS: Record<string, { entrada: string; salida: string }> = {
  M: { entrada: "08:00", salida: "15:00" },
  V: { entrada: "15:00", salida: "22:00" },
  MV: { entrada: "08:00", salida: "22:00" },
};
const TOLERANCIA_RETARDO_MIN = 10; // minutos de gracia antes de marcar retardo

/** Convierte "HH:MM" + fecha YYYY-MM-DD a timestamp Unix ms en zona México (UTC-6) */
function horaFechaToTs(fecha: string, hora: string): number {
  return new Date(`${fecha}T${hora}:00-06:00`).getTime();
}

/**
 * Genera o actualiza los registros de nómina para una sucursal en un rango de fechas.
 * Cruza horario_semanal + turno_apertura + turno_cierre para calcular horas, retardos y ausencias.
 */
export async function calcularRegistrosNomina(sucursalId: number, fechaInicio: string, fechaFin: string) {
  const db = await getDb();
  if (!db) return [];

  // 1. Obtener empleados activos de la sucursal
  const emps = await db.select().from(empleados)
    .where(and(eq(empleados.sucursalId, sucursalId), eq(empleados.activo, true)));
  if (emps.length === 0) return [];

  // 1b. Obtener ajustes eventuales del periodo
  const ajustesRows = await db.execute(sql`
    SELECT empleadoId, fecha, ausente, horaEntrada, horaSalida, motivo
    FROM ajustes_eventuales
    WHERE sucursalId = ${sucursalId}
      AND fecha BETWEEN ${fechaInicio} AND ${fechaFin}
  `);
  const ajustes = ajustesRows[0] as any[];
  // 2. Obtener aperturas y cierres en el rango (turno_apertura/cierre con foto)
  const aperturas = await db.select().from(turnoApertura)
    .where(and(
      eq(turnoApertura.sucursalId, sucursalId),
      gte(turnoApertura.fecha, fechaInicio),
      lte(turnoApertura.fecha, fechaFin)
    ));
  const cierres = await db.select().from(turnoCierre)
    .where(and(
      eq(turnoCierre.sucursalId, sucursalId),
      gte(turnoCierre.fecha, fechaInicio),
      lte(turnoCierre.fecha, fechaFin)
    ));

  // 2b. Obtener registros de asistencia (QR/manual) como fuente alternativa
  // Convertir timestamps a fechas locales para comparar
  const tsInicio = new Date(fechaInicio + "T00:00:00Z").getTime();
  const tsFin = new Date(fechaFin + "T23:59:59Z").getTime();
  const asistenciaRows = await db.select().from(asistencia)
    .where(and(
      eq(asistencia.sucursalId, sucursalId),
      gte(asistencia.timestamp, tsInicio),
      lte(asistencia.timestamp, tsFin)
    ));
  // Agrupar asistencia por empleadoId y fecha (YYYY-MM-DD en UTC)
  const asistByEmpFecha = new Map<string, { entrada: number | null; salida: number | null }>();
  for (const row of asistenciaRows) {
    const fechaRow = new Date(row.timestamp - 6*3600000).toISOString().split("T")[0]; // UTC-6 México
    const key = `${row.empleadoId}|${fechaRow}`;
    if (!asistByEmpFecha.has(key)) asistByEmpFecha.set(key, { entrada: null, salida: null });
    const entry = asistByEmpFecha.get(key)!;
    if (row.tipo === "entrada") {
      // Tomar la entrada más temprana del día
      if (entry.entrada === null || row.timestamp < entry.entrada) entry.entrada = row.timestamp;
    } else if (row.tipo === "salida") {
      // Tomar la salida más tardía del día
      if (entry.salida === null || row.timestamp > entry.salida) entry.salida = row.timestamp;
    }
  }

  // 3. Obtener horarios semanales que cubran el rango
  const horarios = await db.select().from(horariosSemanales)
    .where(eq(horariosSemanales.sucursalId, sucursalId));

  // 4. Generar lista de fechas en el rango
  const fechas: string[] = [];
  const cur = new Date(fechaInicio + "T12:00:00Z");
  const end = new Date(fechaFin + "T12:00:00Z");
  while (cur <= end) {
    fechas.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const DIAS_ES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
  type DiaKey = typeof DIAS_ES[number];

  const resultados: InsertRegistroNomina[] = [];

  for (const emp of emps) {
    for (const fecha of fechas) {
      // Buscar si ya existe un registro editado manualmente — no sobreescribir
      const existente = await db.select().from(registroNomina)
        .where(and(
          eq(registroNomina.empleadoId, emp.id),
          eq(registroNomina.sucursalId, sucursalId),
          eq(registroNomina.fecha, fecha)
        )).limit(1);
      if (existente.length > 0 && existente[0].editadoManualmente) continue;

      // Día de la semana
      const diaSemana = DIAS_ES[new Date(fecha + "T12:00:00Z").getUTCDay()] as DiaKey;

      // Semana ISO para buscar horario
      const d = new Date(fecha + "T12:00:00Z");
      const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
      const semana = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;

      const horario = horarios.find(h => h.empleadoId === emp.id && h.semana === semana);
      const turnoAsignado = horario ? (horario[diaSemana] as string | null) : null;

      // Apertura y cierre del empleado en esa fecha
      // Prioridad: turno_apertura/cierre (con foto) > asistencia (QR/manual)
      const apertura = aperturas.find(a => a.empleadoId === emp.id && a.fecha === fecha);
      const cierre = cierres.find(c => c.empleadoId === emp.id && c.fecha === fecha);
      const asistKey = `${emp.id}|${fecha}`;
      const asistRow = asistByEmpFecha.get(asistKey);

      // Timestamps efectivos de entrada y salida (combinar ambas fuentes)
      // QR tiene prioridad sobre turno_apertura/cierre (más confiable)
      const tsEntradaEfectiva = asistRow?.entrada ?? apertura?.timestamp ?? null;
      const tsSalidaEfectiva = asistRow?.salida ?? cierre?.timestamp ?? null;

      let estado: InsertRegistroNomina["estado"] = "sin_horario";
      let horasTrabajadas: number | null = null;
      let minutosRetardo = 0;
      let horaEntradaEsperada: string | null = null;
      let horaSalidaEsperada: string | null = null;

      // Obtener horario del empleado desde horarioPersonal (nuevo sistema)
      const horarioEmp = (() => {
        try {
          const raw = (emp as any).horarioPersonal;
          const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
          const diaNum = new Date(fecha + "T12:00:00Z").getUTCDay();
          return parsed[diaNum] ?? parsed[String(diaNum)] ?? null;
        } catch { return null; }
      })();

      // Buscar ajuste eventual para este empleado y fecha
      const ajuste = ajustes.find((a: any) => a.empleadoId === emp.id && a.fecha === fecha);

      // Si hay ajuste con ausente=1 → justificada
      if (ajuste?.ausente) {
        const reg: InsertRegistroNomina = {
          sucursalId, empleadoId: emp.id, fecha,
          estado: "ausente", horasTrabajadas: undefined,
          editadoManualmente: false,
        };
        if (existente.length > 0) {
          await db.update(registroNomina).set(reg).where(eq(registroNomina.id, existente[0].id));
        } else {
          await db.insert(registroNomina).values(reg);
        }
        resultados.push(reg);
        continue;
      }

      if (horarioEmp === null && turnoAsignado !== "D") {
        // Dia de descanso segun horarioPersonal
        estado = "descanso";
      } else if (turnoAsignado === "D") {
        estado = "descanso";
      } else if (horarioEmp?.entrada && horarioEmp?.salida) {
        // Usar horarioPersonal del empleado
        // Si el ajuste tiene una hora antes de las 05:00, es un error de captura nocturna — ignorar y usar horarioPersonal
        const ajusteEntrada = ajuste?.horaEntrada;
        const ajusteHoraValida = ajusteEntrada && parseInt(ajusteEntrada.split(":")[0]) >= 5;
        horaEntradaEsperada = (ajusteHoraValida ? ajusteEntrada : null) ?? horarioEmp.entrada;
        horaSalidaEsperada  = ajuste?.horaSalida  ?? horarioEmp.salida;
        const tsEntradaEsperada = horaFechaToTs(fecha, horaEntradaEsperada!);

        if (!tsEntradaEfectiva) {
          estado = "ausente";
        } else {
          const retrasoMin = Math.max(0, Math.round((tsEntradaEfectiva - tsEntradaEsperada) / 60000));
          minutosRetardo = retrasoMin;
          estado = retrasoMin > TOLERANCIA_RETARDO_MIN ? "retardo" : "presente";

          if (tsSalidaEfectiva && tsSalidaEfectiva > tsEntradaEfectiva) {
            horasTrabajadas = Math.round(((tsSalidaEfectiva - tsEntradaEfectiva) / 3600000) * 100) / 100;
          }
        }
      } else if (tsEntradaEfectiva) {
        // Tiene registro de entrada pero no horario asignado — contar horas si hay salida
        estado = "presente";
        if (tsSalidaEfectiva) {
          horasTrabajadas = Math.round(((tsSalidaEfectiva - tsEntradaEfectiva) / 3600000) * 100) / 100;
        }
      }

      const registro: InsertRegistroNomina = {
        sucursalId,
        empleadoId: emp.id,
        fecha,
        turnoEsperado: turnoAsignado ?? undefined,
        horaEntradaEsperada: horaEntradaEsperada ?? undefined,
        horaSalidaEsperada: horaSalidaEsperada ?? undefined,
        timestampEntrada: tsEntradaEfectiva ?? undefined,
        timestampSalida: tsSalidaEfectiva ?? undefined,
        aperturaId: apertura?.id ?? undefined,
        cierreId: cierre?.id ?? undefined,
        horasTrabajadas: horasTrabajadas ?? undefined,
        minutosRetardo,
        estado,
        editadoManualmente: false,
      };

      if (existente.length > 0) {
        await db.update(registroNomina).set(registro).where(eq(registroNomina.id, existente[0].id));
      } else {
        await db.insert(registroNomina).values(registro);
      }
      resultados.push(registro);
    }
  }
  return resultados;
}

/** Obtiene los registros de nómina ya calculados para una sucursal y rango */
export async function getRegistrosNomina(sucursalId: number, fechaInicio: string, fechaFin: string) {
  const db = await getDb();
  if (!db) return [];
  const registros = await db.select().from(registroNomina)
    .where(and(
      eq(registroNomina.sucursalId, sucursalId),
      gte(registroNomina.fecha, fechaInicio),
      lte(registroNomina.fecha, fechaFin)
    ))
    .orderBy(registroNomina.fecha, registroNomina.empleadoId);

  // Enriquecer con nombre del empleado
  const emps = await db.select({ id: empleados.id, nombre: empleados.nombre, apellido: empleados.apellido, rol: empleados.rol })
    .from(empleados).where(eq(empleados.sucursalId, sucursalId));

  return registros.map(r => {
    const emp = emps.find(e => e.id === r.empleadoId);
    return {
      ...r,
      empleadoNombre: emp ? `${emp.nombre}${emp.apellido ? " " + emp.apellido : ""}` : "Desconocido",
      empleadoRol: emp?.rol ?? "anfitrion",
    };
  });
}

/** Actualiza un registro de nómina con justificación manual */
export async function justificarRegistroNomina(id: number, data: {
  estado: "ausencia_justificada" | "presente" | "retardo";
  justificacion: string;
  tipoJustificacion: InsertRegistroNomina["tipoJustificacion"];
  fotoJustificacionUrl?: string;
  editadoPorId: number;
  horasTrabajadas?: number;
  minutosRetardo?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(registroNomina).set({
    estado: data.estado,
    justificacion: data.justificacion,
    tipoJustificacion: data.tipoJustificacion,
    fotoJustificacionUrl: data.fotoJustificacionUrl,
    editadoPorId: data.editadoPorId,
    editadoManualmente: true,
    horasTrabajadas: data.horasTrabajadas,
    minutosRetardo: data.minutosRetardo ?? 0,
  }).where(eq(registroNomina.id, id));
}

/** Resumen de nómina por empleado para una semana */
export async function getResumenNominaSemanal(sucursalId: number, fechaInicio: string, fechaFin: string) {
  const db = await getDb();
  if (!db) return [];
  const registros = await getRegistrosNomina(sucursalId, fechaInicio, fechaFin);

  // Agrupar por empleado
  const porEmpleado = new Map<number, typeof registros>();
  for (const r of registros) {
    if (!porEmpleado.has(r.empleadoId)) porEmpleado.set(r.empleadoId, []);
    porEmpleado.get(r.empleadoId)!.push(r);
  }

  return Array.from(porEmpleado.entries()).map(([empleadoId, regs]) => {
    const diasTrabajados = regs.filter(r => r.estado === "presente" || r.estado === "retardo").length;
    const diasAusente = regs.filter(r => r.estado === "ausente").length;
    const diasJustificados = regs.filter(r => r.estado === "ausencia_justificada").length;
    const diasDescanso = regs.filter(r => r.estado === "descanso").length;
    const retardos = regs.filter(r => r.estado === "retardo").length;
    const horasTotales = regs.reduce((s, r) => s + (r.horasTrabajadas ?? 0), 0);
    const minutosRetardoTotal = regs.reduce((s, r) => s + (r.minutosRetardo ?? 0), 0);
    return {
      empleadoId,
      empleadoNombre: regs[0]?.empleadoNombre ?? "Desconocido",
      empleadoRol: regs[0]?.empleadoRol ?? "anfitrion",
      diasTrabajados,
      diasAusente,
      diasJustificados,
      diasDescanso,
      retardos,
      horasTotales: Math.round(horasTotales * 100) / 100,
      minutosRetardoTotal,
      registros: regs,
    };
  }).sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre));
}
