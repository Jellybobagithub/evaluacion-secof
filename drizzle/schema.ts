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
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "superadmin", "owner", "manager", "leader", "host"]).default("user").notNull(),
  activo: boolean("activo").default(true).notNull(),
  notas: text("notas"),
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
  metaVentasMensual: float("metaVentasMensual").default(0),
  fotoUrl: text("fotoUrl"),
  telefono: varchar("telefono", { length: 30 }),
  activa: boolean("activa").default(true).notNull(),
  // Token único para QR de asistencia (generado al crear la sucursal)
  qrToken: varchar("qrToken", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sucursal = typeof sucursales.$inferSelect;
export type InsertSucursal = typeof sucursales.$inferInsert;

// Empleados (Anfitriones y Líderes registrados por sucursal)
export const empleados = mysqlTable("empleados", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  apellido: varchar("apellido", { length: 255 }),
  rol: mysqlEnum("rol", ["anfitrion", "lider", "administrador"]).default("anfitrion").notNull(),
  telefono: varchar("telefono", { length: 30 }),
  fechaIngreso: timestamp("fechaIngreso").defaultNow().notNull(),
  fechaBaja: timestamp("fechaBaja"),
  activo: boolean("activo").default(true).notNull(),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Empleado = typeof empleados.$inferSelect;
export type InsertEmpleado = typeof empleados.$inferInsert;

// Plantillas de Checklist (LI-FR-001 Limpieza, LI-FR-002 Actividades Operativas)
export const checklistPlantillas = mysqlTable("checklist_plantillas", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  tipo: mysqlEnum("tipo", ["limpieza", "operativo", "apertura", "cierre"]).default("operativo").notNull(),
  turno: mysqlEnum("turno", ["matutino", "vespertino", "ambos"]).default("ambos").notNull(),
  // items: array de { id, descripcion, orden, obligatorio }
  items: json("items").notNull(),
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChecklistPlantilla = typeof checklistPlantillas.$inferSelect;
export type InsertChecklistPlantilla = typeof checklistPlantillas.$inferInsert;

// Registros de Checklist completados por turno
export const checklistRegistros = mysqlTable("checklist_registros", {
  id: int("id").autoincrement().primaryKey(),
  plantillaId: int("plantillaId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId"),           // quien lo completó (puede ser null si es el líder)
  liderNombre: varchar("liderNombre", { length: 255 }), // nombre del líder que firmó
  fecha: timestamp("fecha").defaultNow().notNull(),
  turno: mysqlEnum("turno", ["matutino", "vespertino"]).default("matutino").notNull(),
  // itemsCompletados: { itemId: boolean }
  itemsCompletados: json("itemsCompletados").notNull(),
  totalItems: int("totalItems").default(0),
  itemsOk: int("itemsOk").default(0),
  porcentaje: float("porcentaje").default(0),
  observaciones: text("observaciones"),
  firmado: boolean("firmado").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChecklistRegistro = typeof checklistRegistros.$inferSelect;
export type InsertChecklistRegistro = typeof checklistRegistros.$inferInsert;

// Registros de Asistencia (entrada/salida por QR o manual)
export const asistencia = mysqlTable("asistencia", {
  id: int("id").autoincrement().primaryKey(),
  empleadoId: int("empleadoId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "salida"]).notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(), // Unix ms UTC
  metodo: mysqlEnum("metodo", ["qr", "manual"]).default("qr").notNull(),
  latitud: float("latitud"),
  longitud: float("longitud"),
  registradoPorId: int("registradoPorId"), // userId del líder si es manual
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Asistencia = typeof asistencia.$inferSelect;
export type InsertAsistencia = typeof asistencia.$inferInsert;

// Observaciones KPI de Anfitriones (Nivel 1)
export const observacionesKpi = mysqlTable("observaciones_kpi", {
  id: int("id").autoincrement().primaryKey(),
  empleadoId: int("empleadoId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  observadorId: int("observadorId").notNull(), // userId del líder que observa
  tipo: mysqlEnum("tipo", ["servicio", "preparacion", "caja"]).notNull(),
  // Para servicio: { saludo, sonrisa, ventaSugestiva, despedida } → boolean[]
  // Para preparacion: { correcta } → boolean
  // Para caja: { descuadre, monto } → number
  detalle: json("detalle").notNull(),
  cumple: boolean("cumple").notNull(), // resultado final de la observación
  semana: varchar("semana", { length: 10 }).notNull(), // "2026-W13" formato ISO
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ObservacionKpi = typeof observacionesKpi.$inferSelect;
export type InsertObservacionKpi = typeof observacionesKpi.$inferInsert;

// Evaluaciones
export const evaluaciones = mysqlTable("evaluaciones", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  evaluadorId: int("evaluadorId"),
  evaluadorNombre: varchar("evaluadorNombre", { length: 255 }),
  fecha: timestamp("fecha").defaultNow().notNull(),
  estado: mysqlEnum("estado", ["borrador", "completada"]).default("borrador").notNull(),
  puntosObtenidos: float("puntosObtenidos").default(0),
  puntosMaximos: float("puntosMaximos").default(0),
  porcentajeGeneral: float("porcentajeGeneral").default(0),
  calificacion: varchar("calificacion", { length: 64 }),
  puntuacionPorCategoria: json("puntuacionPorCategoria"),
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
  puntoId: varchar("puntoId", { length: 20 }).notNull(),
  respuesta: mysqlEnum("respuesta", ["si", "no", "na"]).notNull(),
  puntosObtenidos: float("puntosObtenidos").default(0),
  observacion: text("observacion"),
  fotoUrl: text("fotoUrl"),
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

// Puntos de Evaluación
export const puntosEvaluacion = mysqlTable("puntos_evaluacion", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  seccionNumero: int("seccionNumero").notNull(),
  seccionNombre: varchar("seccionNombre", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }).notNull(),
  descripcion: text("descripcion").notNull(),
  criterio: text("criterio"),
  valor: float("valor").notNull().default(5),
  orden: int("orden").notNull().default(0),
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

// Reportes Diarios de Tienda
export const reportesDiarios = mysqlTable("reportes_diarios", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  usuarioNombre: varchar("usuarioNombre", { length: 255 }),
  // varchar YYYY-MM-DD para evitar desfase UTC en zonas horarias negativas (México UTC-6)
  fecha: varchar("fecha", { length: 10 }).notNull(),
  // Ventas desglosadas por canal
  ventasEfectivo: float("ventasEfectivo").default(0),
  ventasTarjeta: float("ventasTarjeta").default(0),
  ventasRappi: float("ventasRappi").default(0),
  ventasTotales: float("ventasTotales").default(0), // calculado: efectivo + tarjeta + rappi
  apertura: varchar("apertura", { length: 10 }),
  cierre: varchar("cierre", { length: 10 }),
  personalPresente: int("personalPresente").default(0),
  incidentes: text("incidentes"),
  novedades: text("novedades"),
  observaciones: text("observaciones"),
  estado: mysqlEnum("estado", ["borrador", "enviado"]).default("borrador").notNull(),
  // Mermas del día
  mermasMonto: float("mermasMonto").default(0),
  mermasDetalle: text("mermasDetalle"),
  // Control de caja
  efectivoInicial: float("efectivoInicial").default(0),
  efectivoFinal: float("efectivoFinal").default(0),
  diferenciaCaja: float("diferenciaCaja").default(0), // efectivoFinal - efectivoInicial - ventas esperadas
  notasCaja: text("notasCaja"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReporteDiario = typeof reportesDiarios.$inferSelect;
export type InsertReporteDiario = typeof reportesDiarios.$inferInsert;

// Horarios Semanales
export const horariosSemanales = mysqlTable("horarios_semanales", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId").notNull(),
  semana: varchar("semana", { length: 10 }).notNull(), // "2026-W13"
  // Turno por día: null = sin asignar, 'M' = matutino, 'V' = vespertino, 'D' = descanso, 'MV' = doble turno
  lunes: varchar("lunes", { length: 4 }),
  martes: varchar("martes", { length: 4 }),
  miercoles: varchar("miercoles", { length: 4 }),
  jueves: varchar("jueves", { length: 4 }),
  viernes: varchar("viernes", { length: 4 }),
  sabado: varchar("sabado", { length: 4 }),
  domingo: varchar("domingo", { length: 4 }),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HorarioSemanal = typeof horariosSemanales.$inferSelect;
export type InsertHorarioSemanal = typeof horariosSemanales.$inferInsert;

// Bajas de Empleados (para KPI de Rotación de Equipo)
export const bajasEmpleados = mysqlTable("bajas_empleados", {
  id: int("id").autoincrement().primaryKey(),
  empleadoId: int("empleadoId").notNull(),
  sucursalId: int("sucursalId").notNull(),
  fechaBaja: timestamp("fechaBaja").defaultNow().notNull(),
  tipo: mysqlEnum("tipo", ["renuncia", "despido", "termino_contrato", "otro"]).default("renuncia").notNull(),
  motivo: text("motivo"),
  registradoPorId: int("registradoPorId"), // userId del líder/manager
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BajaEmpleado = typeof bajasEmpleados.$inferSelect;
export type InsertBajaEmpleado = typeof bajasEmpleados.$inferInsert;

// Ventas Históricas del Año Anterior (base para KPIs y metas)
export const ventasHistoricas = mysqlTable("ventas_historicas", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  anio: int("anio").notNull(),
  mes: int("mes").notNull(), // 1-12
  ventasEfectivo: float("ventasEfectivo").default(0),
  ventasTarjeta: float("ventasTarjeta").default(0),
  ventasRappi: float("ventasRappi").default(0),
  ventasTotales: float("ventasTotales").default(0), // calculado o ingresado manualmente
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VentaHistorica = typeof ventasHistoricas.$inferSelect;
export type InsertVentaHistorica = typeof ventasHistoricas.$inferInsert;
