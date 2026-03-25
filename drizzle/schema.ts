import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin", "owner", "manager", "leader", "host"]).default("user").notNull(),
  activo: boolean("activo").default(true).notNull(),
  notas: text("notas"),  // notas internas del admin sobre el usuario
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Sucursales / Franquicias
export const sucursales = mysqlTable("sucursales", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  ciudad: varchar("ciudad", { length: 255 }),
  estado: varchar("estado", { length: 255 }),
  direccion: text("direccion"),
  franquiciado: varchar("franquiciado", { length: 255 }),
  activa: boolean("activa").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sucursal = typeof sucursales.$inferSelect;
export type InsertSucursal = typeof sucursales.$inferInsert;

// Evaluaciones
export const evaluaciones = mysqlTable("evaluaciones", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  evaluadorId: int("evaluadorId"),
  evaluadorNombre: varchar("evaluadorNombre", { length: 255 }),
  fecha: timestamp("fecha").defaultNow().notNull(),
  estado: mysqlEnum("estado", ["borrador", "completada"]).default("borrador").notNull(),
  // Puntuación general
  puntosObtenidos: float("puntosObtenidos").default(0),
  puntosMaximos: float("puntosMaximos").default(0),
  porcentajeGeneral: float("porcentajeGeneral").default(0),
  calificacion: varchar("calificacion", { length: 64 }),
  // Puntuación por categoría (JSON)
  puntuacionPorCategoria: json("puntuacionPorCategoria"),
  // Puntuación por sección (JSON)
  puntuacionPorSeccion: json("puntuacionPorSeccion"),
  observacionesGenerales: text("observacionesGenerales"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Evaluacion = typeof evaluaciones.$inferSelect;
export type InsertEvaluacion = typeof evaluaciones.$inferInsert;

// Respuestas individuales de evaluación
export const respuestas = mysqlTable("respuestas", {
  id: int("id").autoincrement().primaryKey(),
  evaluacionId: int("evaluacionId").notNull(),
  puntoId: varchar("puntoId", { length: 20 }).notNull(), // e.g. "PG1", "EL3"
  respuesta: mysqlEnum("respuesta", ["si", "no", "na"]).notNull(),
  puntosObtenidos: float("puntosObtenidos").default(0),
  observacion: text("observacion"),
  fotoUrl: text("fotoUrl"),  // URL de S3 de la foto de evidencia (opcional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Respuesta = typeof respuestas.$inferSelect;
export type InsertRespuesta = typeof respuestas.$inferInsert;

// Plan de Acción
export const planAccion = mysqlTable("plan_accion", {
  id: int("id").autoincrement().primaryKey(),
  evaluacionId: int("evaluacionId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  area: varchar("area", { length: 255 }).notNull(),
  queMalEsta: text("queMalEsta"),
  objetivo: text("objetivo"),
  causaRaiz: text("causaRaiz"),
  comoResolver: text("comoResolver"),
  fechaCompromiso: timestamp("fechaCompromiso"),
  costo: float("costo").default(0),
  responsable: varchar("responsable", { length: 255 }),
  revisor: varchar("revisor", { length: 255 }),
  estado: mysqlEnum("estado", ["pendiente", "en_proceso", "completado"]).default("pendiente").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlanAccion = typeof planAccion.$inferSelect;
export type InsertPlanAccion = typeof planAccion.$inferInsert;

// Puntos de Evaluación (editables por el administrador)
export const puntosEvaluacion = mysqlTable("puntos_evaluacion", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),       // e.g. "PG1", "EL3"
  seccionNumero: int("seccionNumero").notNull(),              // 1-10
  seccionNombre: varchar("seccionNombre", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(), // Control, Higiene, etc.
  descripcion: text("descripcion").notNull(),
  criterio: text("criterio"),                                // criterio de evaluación detallado
  valor: float("valor").notNull().default(5),                // puntos máximos
  orden: int("orden").notNull().default(0),                  // orden dentro de la sección
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PuntoEvaluacion = typeof puntosEvaluacion.$inferSelect;
export type InsertPuntoEvaluacion = typeof puntosEvaluacion.$inferInsert;

// Asignacion de usuarios a sucursales
export const userSucursales = mysqlTable("user_sucursales", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSucursal = typeof userSucursales.$inferSelect;
export type InsertUserSucursal = typeof userSucursales.$inferInsert;
