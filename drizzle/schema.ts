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
  // Disponibilidad semanal
  // 'fulltime'  = lun-dom con 1 día de descanso rotativo entre lun-mié
  // 'finde_ext' = vie/sáb/dom
  // 'finde'     = sáb/dom
  // 'custom'    = días en diasDisponibles
  tipoContrato: mysqlEnum("tipoContrato", ["fulltime", "finde_ext", "finde", "custom"]).default("fulltime").notNull(),
  // JSON array de números 0-6 (0=dom,1=lun,2=mar,3=mié,4=jue,5=vie,6=sáb) — solo para tipo 'custom'
  diasDisponibles: text("diasDisponibles"),
  userId: int("userId"),  // Vínculo con la tabla users (opcional, para anfitriones con cuenta)
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

// Gastos Operativos Mensuales (para KPI Nivel 3: Rentabilidad y Eficiencia)
export const gastosOperativos = mysqlTable("gastos_operativos", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  anio: int("anio").notNull(),
  mes: int("mes").notNull(), // 1-12
  // Categorías de gasto
  renta: float("renta").default(0),
  nomina: float("nomina").default(0),
  insumos: float("insumos").default(0),
  servicios: float("servicios").default(0), // luz, agua, internet
  mantenimiento: float("mantenimiento").default(0),
  marketing: float("marketing").default(0),
  otros: float("otros").default(0),
  totalGastos: float("totalGastos").default(0), // suma de todos
  costoProducto: float("costoProducto").default(0), // costo de mercancía vendida
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GastoOperativo = typeof gastosOperativos.$inferSelect;
export type InsertGastoOperativo = typeof gastosOperativos.$inferInsert;

// Catálogo de Actividades de Limpieza (D1-D13, S1-S20, B1-B4, M1-M3)
export const actividadesCatalogo = mysqlTable("actividades_catalogo", {
  id: int("id").autoincrement().primaryKey(),
  clave: varchar("clave", { length: 10 }).notNull().unique(), // D1, S3, B2, M1...
  descripcion: text("descripcion").notNull(),
  categoria: mysqlEnum("categoria", ["D", "S", "B", "M"]).notNull(), // Diaria, Semanal, Bodega, Mensual
  orden: int("orden").default(0), // para ordenar dentro de la categoría
  activa: boolean("activa").default(true).notNull(),
  // Área que puede realizar esta actividad
  // 'comodin' = solo comodín (actividades pesadas o que requieren tiempo libre)
  // 'leve' = caja, barra o comodín (actividades rápidas en tiempos muertos)
  // 'todas' = cualquier área puede hacerla
  areaCompatible: varchar("area_compatible", { length: 20 }).default("todas").notNull(),
});
export type ActividadCatalogo = typeof actividadesCatalogo.$inferSelect;
export type InsertActividadCatalogo = typeof actividadesCatalogo.$inferInsert;

// Turnos del Horario Semanal (un registro por empleado por día)
export const turnosSemana = mysqlTable("turnos_semana", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId").notNull(),
  fecha: varchar("fecha", { length: 10 }).notNull(), // "2026-04-07" (YYYY-MM-DD)
  semana: int("semana").notNull(), // número de semana ISO (1-53)
  anio: int("anio").notNull(),
  puesto: varchar("puesto", { length: 100 }), // "Caja", "Barista", "Caja y barista", etc.
  turno: mysqlEnum("turno", ["matutino", "intermedio", "vespertino", "anfitrion"]).notNull(),
  horaInicio: varchar("horaInicio", { length: 5 }).notNull(), // "10:00"
  horaFin: varchar("horaFin", { length: 5 }).notNull(),       // "18:00"
  rolPrincipal: varchar("rolPrincipal", { length: 50 }), // "Caja", "Bebidas", "Botella", "Fika"
  comentarios: text("comentarios"),
  cerrado: boolean("cerrado").default(false).notNull(), // true = empleado confirmó fin de turno
  cerradoAt: timestamp("cerradoAt"),
  createdBy: int("createdBy"), // userId del líder que creó el turno
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TurnoSemana = typeof turnosSemana.$inferSelect;
export type InsertTurnoSemana = typeof turnosSemana.$inferInsert;

// Actividades asignadas a un turno específico
export const turnoActividades = mysqlTable("turno_actividades", {
  id: int("id").autoincrement().primaryKey(),
  turnoId: int("turnoId").notNull(),
  actividadClave: varchar("actividadClave", { length: 10 }).notNull(), // "D1", "S3"...
  completada: boolean("completada").default(false).notNull(),
  completadaAt: timestamp("completadaAt"),
  completadaPorId: int("completadaPorId"), // userId del empleado
  esPendiente: boolean("esPendiente").default(false).notNull(), // true = arrastrada de turno anterior
  turnoOrigenId: int("turnoOrigenId"), // turnoId donde quedó pendiente originalmente
  evidenciaUrl: text("evidenciaUrl"), // URL de foto de evidencia (S3)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TurnoActividad = typeof turnoActividades.$inferSelect;
export type InsertTurnoActividad = typeof turnoActividades.$inferInsert;

// ─── Preparaciones de Recetas por Turno ──────────────────────────────────────
export const preparaciones = mysqlTable("preparaciones", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  turnoId: int("turnoId"),
  empleadoId: int("empleadoId"),
  registradoPorId: int("registradoPorId"),
  receta: mysqlEnum("receta", ["tapioca","base_snowtea","jarabe_longan","sustituto_azucar"]).notNull(),
  cantidad: varchar("cantidad", { length: 20 }).notNull(),
  unidad: varchar("unidad", { length: 30 }).notNull(),
  preparadaAt: timestamp("preparadaAt").notNull(),
  venceAt: timestamp("venceAt").notNull(),
  estado: mysqlEnum("estado_prep", ["activa","vencida","consumida"]).default("activa").notNull(),
  incidenciaTipo: mysqlEnum("incidencia_tipo", ["sin_preparacion","vencida_en_uso","fuera_de_tiempo","desperdicio"]),
  incidenciaAt: timestamp("incidenciaAt"),
  incidenciaNota: text("incidenciaNota"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Preparacion = typeof preparaciones.$inferSelect;
export type InsertPreparacion = typeof preparaciones.$inferInsert;

// ─── Actividades Bajo Observación (Sistema de Credibilidad) ──────────────────
export const actividadesObservacion = mysqlTable("actividades_observacion", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  actividadClave: varchar("actividadClave", { length: 10 }).notNull(),
  activadaPorId: int("activadaPorId").notNull(),
  activadaAt: timestamp("activadaAt").defaultNow().notNull(),
  motivoActivacion: text("motivoActivacion"),
  activa: boolean("activa").default(true).notNull(),
  resueltaPorId: int("resueltaPorId"),
  resueltaAt: timestamp("resueltaAt"),
  notaResolucion: text("notaResolucion"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ActividadObservacion = typeof actividadesObservacion.$inferSelect;
export type InsertActividadObservacion = typeof actividadesObservacion.$inferInsert;

// ─── Apertura de Turno ────────────────────────────────────────────────────────
// Registro de inventario al abrir turno (matutino o vespertino)
export const turnoApertura = mysqlTable("turno_apertura", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId").notNull(),        // empleado que registra
  usuarioId: int("usuarioId").notNull(),           // userId del sistema
  fecha: varchar("fecha", { length: 10 }).notNull(), // YYYY-MM-DD
  tipoTurno: mysqlEnum("tipoTurno", ["matutino", "vespertino"]).notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  // Inventario inicial
  conteoVasos: int("conteoVasos"),
  conteoPopotes: int("conteoPopotes"),
  baseSnowteaKg: float("baseSnowteaKg"),          // kg de base en refrigerador
  longanKg: float("longanKg"),                     // kg de longan
  // Selladora
  fotoSelladoUrl: text("fotoSelladoUrl"),          // URL de la foto subida a S3
  contadorSelladora: int("contadorSelladora"),     // número detectado por OCR o capturado manual
  // Foto uniforme
  fotoUniformeUrl: text("fotoUniformeUrl"),
  // Notas adicionales
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TurnoApertura = typeof turnoApertura.$inferSelect;
export type InsertTurnoApertura = typeof turnoApertura.$inferInsert;

// ─── Cierre de Turno ──────────────────────────────────────────────────────────
export const turnoCierre = mysqlTable("turno_cierre", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  fecha: varchar("fecha", { length: 10 }).notNull(),
  tipoTurno: mysqlEnum("tipoTurno", ["matutino", "vespertino"]).notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  // Inventario final
  conteoVasosFinal: int("conteoVasosFinal"),
  conteoPopotesFinal: int("conteoPopotesFinal"),
  // Selladora al cierre
  fotoSelladoCierreUrl: text("fotoSelladoCierreUrl"),
  contadorSelladoraCierre: int("contadorSelladoraCierre"),
  // Cuadre calculado (vasos vendidos según selladora vs reporte de ventas)
  vasosVendidosSelladora: int("vasosVendidosSelladora"), // diferencia contador cierre - apertura
  vasosVendidosReporte: int("vasosVendidosReporte"),     // del reporte diario
  mermaVasos: int("mermaVasos"),                         // diferencia (puede ser negativa)
  // Incidencias y novedades del turno
  novedadesTurno: text("novedadesTurno"),                // para el turno siguiente
  incidencias: text("incidencias"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TurnoCierre = typeof turnoCierre.$inferSelect;
export type InsertTurnoCierre = typeof turnoCierre.$inferInsert;

// ─── Avisos Generales (del dueño/manager para todos) ─────────────────────────
export const avisosGenerales = mysqlTable("avisos_generales", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId"),                   // null = aplica a todas las sucursales
  titulo: varchar("titulo", { length: 255 }).notNull(),
  contenido: text("contenido").notNull(),
  tipo: mysqlEnum("tipo", ["info", "urgente", "recordatorio"]).default("info").notNull(),
  activo: boolean("activo").default(true).notNull(),
  creadoPorId: int("creadoPorId").notNull(),
  fechaExpiracion: varchar("fechaExpiracion", { length: 10 }), // YYYY-MM-DD, null = sin expiración
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AvisoGeneral = typeof avisosGenerales.$inferSelect;
export type InsertAvisoGeneral = typeof avisosGenerales.$inferInsert;

// ─── Registro de Nómina / Control de Asistencias ─────────────────────────────
// Una fila por empleado por día. Se genera automáticamente al cruzar turno_apertura
// y turno_cierre con el horario asignado. El líder puede editar justificaciones.
export const registroNomina = mysqlTable("registro_nomina", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  empleadoId: int("empleadoId").notNull(),
  fecha: varchar("fecha", { length: 10 }).notNull(),        // YYYY-MM-DD
  // Turno programado según horario semanal
  turnoEsperado: varchar("turnoEsperado", { length: 4 }),   // 'M', 'V', 'MV', 'D', null=sin horario
  horaEntradaEsperada: varchar("horaEntradaEsperada", { length: 5 }), // "08:00"
  horaSalidaEsperada: varchar("horaSalidaEsperada", { length: 5 }),   // "15:00"
  // Registros reales (timestamps Unix ms de turno_apertura / turno_cierre)
  timestampEntrada: bigint("timestampEntrada", { mode: "number" }),
  timestampSalida: bigint("timestampSalida", { mode: "number" }),
  aperturaId: int("aperturaId"),   // FK a turno_apertura.id
  cierreId: int("cierreId"),       // FK a turno_cierre.id
  // Cálculos automáticos
  horasTrabajadas: float("horasTrabajadas"),                // horas reales trabajadas
  minutosRetardo: int("minutosRetardo").default(0),         // minutos de retraso en entrada
  // Estado del día
  estado: mysqlEnum("estado", [
    "presente",       // entró y salió dentro del turno
    "retardo",        // entró tarde (> tolerancia)
    "ausente",        // no registró entrada
    "ausencia_justificada", // ausente pero con justificación aprobada
    "descanso",       // día de descanso según horario
    "sin_horario",    // no tiene turno asignado ese día
  ]).default("sin_horario").notNull(),
  // Edición manual por líder/manager/owner
  editadoManualmente: boolean("editadoManualmente").default(false).notNull(),
  editadoPorId: int("editadoPorId"),       // userId del líder que editó
  justificacion: text("justificacion"),    // texto de la justificación
  tipoJustificacion: mysqlEnum("tipoJustificacion", [
    "enfermedad", "permiso_personal", "emergencia_familiar",
    "capacitacion", "vacaciones", "error_sistema", "otro"
  ]),
  // Foto de evidencia de la justificación (opcional)
  fotoJustificacionUrl: text("fotoJustificacionUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RegistroNomina = typeof registroNomina.$inferSelect;
export type InsertRegistroNomina = typeof registroNomina.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO INVENTARIO DE TIENDA
// ─────────────────────────────────────────────────────────────────────────────

/** Catálogo global de productos (compartido entre todas las sucursales) */
export const invProductos = mysqlTable("inv_productos", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  categoria: varchar("categoria", { length: 80 }).notNull().default("General"),
  unidadCompra: varchar("unidadCompra", { length: 40 }).notNull().default("pieza"), // ej: caja, bolsa, kg
  unidadConteo: varchar("unidadConteo", { length: 40 }).notNull().default("pieza"), // ej: pieza, bolsa
  factorConversion: float("factorConversion").default(1),   // unidades de conteo por unidad de compra
  pesoNetoPorUnidad: float("pesoNetoPorUnidad"),             // gramos por unidad (para productos pesables)
  puedeAbrirse: boolean("puedeAbrirse").default(false).notNull(), // si puede haber unidades abiertas (pesables)
  activo: boolean("activo").default(true).notNull(),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvProducto = typeof invProductos.$inferSelect;
export type InsertInvProducto = typeof invProductos.$inferInsert;

/** Almacenes por sucursal (bodega, tienda, etc.) */
export const invAlmacenes = mysqlTable("inv_almacenes", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  nombre: varchar("nombre", { length: 80 }).notNull(),           // ej: "Bodega", "Tienda"
  tipo: mysqlEnum("tipo", ["piezas", "piezas_gramos"]).default("piezas").notNull(),
  consideraMinMax: boolean("consideraMinMax").default(false).notNull(), // solo bodega aplica
  activo: boolean("activo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InvAlmacen = typeof invAlmacenes.$inferSelect;
export type InsertInvAlmacen = typeof invAlmacenes.$inferInsert;

/** Configuración de mínimos y máximos por producto en un almacén (solo bodega) */
export const invMinMax = mysqlTable("inv_min_max", {
  id: int("id").autoincrement().primaryKey(),
  almacenId: int("almacenId").notNull(),
  productoId: int("productoId").notNull(),
  stockMinimo: float("stockMinimo").default(0).notNull(),
  stockMaximo: float("stockMaximo").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvMinMax = typeof invMinMax.$inferSelect;
export type InsertInvMinMax = typeof invMinMax.$inferInsert;

/** Encabezado de un conteo físico semanal */
export const invConteoFisico = mysqlTable("inv_conteo_fisico", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  almacenId: int("almacenId").notNull(),
  semana: varchar("semana", { length: 10 }).notNull(),   // formato "2026-W14"
  fechaConteo: varchar("fechaConteo", { length: 10 }).notNull(), // YYYY-MM-DD
  liderId: int("liderId").notNull(),                     // userId del líder
  anfitrionId: int("anfitrionId"),                       // userId del anfitrión de apoyo
  estado: mysqlEnum("estado", ["borrador", "enviado", "bloqueado"]).default("borrador").notNull(),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvConteoFisico = typeof invConteoFisico.$inferSelect;
export type InsertInvConteoFisico = typeof invConteoFisico.$inferInsert;

/** Detalle línea a línea del conteo físico */
export const invConteoDetalle = mysqlTable("inv_conteo_detalle", {
  id: int("id").autoincrement().primaryKey(),
  conteoId: int("conteoId").notNull(),
  productoId: int("productoId").notNull(),
  cantidadPiezas: float("cantidadPiezas").default(0).notNull(),  // unidades cerradas
  cantidadGramos: float("cantidadGramos").default(0),            // gramos de unidades abiertas
  notas: text("notas"),
});
export type InvConteoDetalle = typeof invConteoDetalle.$inferSelect;
export type InsertInvConteoDetalle = typeof invConteoDetalle.$inferInsert;

/** Inventario teórico capturado por el supervisor (basado en ventas Odoo) */
export const invTeorico = mysqlTable("inv_teorico", {
  id: int("id").autoincrement().primaryKey(),
  sucursalId: int("sucursalId").notNull(),
  almacenId: int("almacenId").notNull(),
  semana: varchar("semana", { length: 10 }).notNull(),   // formato "2026-W14"
  supervisorId: int("supervisorId").notNull(),           // userId del manager/owner
  estado: mysqlEnum("estado", ["borrador", "publicado"]).default("borrador").notNull(),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InvTeorico = typeof invTeorico.$inferSelect;
export type InsertInvTeorico = typeof invTeorico.$inferInsert;

/** Detalle línea a línea del inventario teórico */
export const invTeoricoDetalle = mysqlTable("inv_teorico_detalle", {
  id: int("id").autoincrement().primaryKey(),
  teoricoId: int("teoricoId").notNull(),
  productoId: int("productoId").notNull(),
  cantidadEsperada: float("cantidadEsperada").default(0).notNull(), // unidades teóricas
  notas: text("notas"),
});
export type InvTeoricoDetalle = typeof invTeoricoDetalle.$inferSelect;
export type InsertInvTeoricoDetalle = typeof invTeoricoDetalle.$inferInsert;

/** Categorías del catálogo de productos de inventario */
export const invCategoria = mysqlTable("inv_categoria", {
  id: int("id").autoincrement().primaryKey(),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  descripcion: text("descripcion"),
  color: varchar("color", { length: 20 }).default("#6b7280"),
  orden: int("orden").default(0).notNull(),
  activa: boolean("activa").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InvCategoria = typeof invCategoria.$inferSelect;
export type InsertInvCategoria = typeof invCategoria.$inferInsert;
