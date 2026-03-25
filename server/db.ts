import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sucursales, evaluaciones, respuestas, planAccion, puntosEvaluacion, userSucursales, InsertSucursal, InsertEvaluacion, InsertRespuesta, InsertPlanAccion, InsertPuntoEvaluacion } from "../drizzle/schema";
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
