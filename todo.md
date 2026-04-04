# Sistema de Evaluación SECOF - TODO

## Base de Datos y Backend
- [x] Esquema DB: tablas sucursales, evaluaciones, respuestas, plan_accion
- [x] Datos semilla: 148 puntos de evaluación con secciones y categorías
- [x] tRPC: CRUD sucursales
- [x] tRPC: crear/guardar evaluación con respuestas
- [x] tRPC: calcular puntuación automática por sección y categoría
- [x] tRPC: historial de evaluaciones por sucursal
- [x] tRPC: CRUD plan de acción

## Frontend - Layout y Navegación
- [x] DashboardLayout con sidebar (Sucursales, Nueva Evaluación, Historial, Plan de Acción)
- [x] Tema profesional: colores corporativos azul/verde, tipografía limpia
- [x] Página de inicio con resumen general

## Frontend - Gestión de Sucursales
- [x] Lista de sucursales con estado y última evaluación
- [x] Formulario para crear/editar sucursal
- [x] Detalle de sucursal con historial de evaluaciones

## Frontend - Formulario de Evaluación
- [x] 10 secciones con navegación por pestañas
- [x] 148 puntos con respuesta Si/No/N/A y campo de observaciones
- [x] Cálculo en tiempo real de puntuación por sección
- [x] Barra de progreso de llenado
- [x] Guardado automático de borrador

## Frontend - Dashboard de Resultados
- [x] Calificación general con escala visual (Excelente → Acción Inmediata)
- [x] Gráfico radar por categoría (Control, Higiene, Hospitalidad, Imagen, Mantenimiento, Operación)
- [x] Tabla de puntuación por sección con porcentaje
- [x] Identificación de áreas críticas (menor desempeño)
- [x] Recomendaciones de mejora prioritarias

## Frontend - Historial y Comparativa
- [x] Lista de evaluaciones con fecha, sucursal y calificación
- [x] Gráfico de tendencia temporal
- [x] Comparativa entre dos evaluaciones (indicador +/- vs anterior)

## Frontend - Plan de Acción
- [x] Formulario EXPLORAR-ANALIZAR-RESOLVER-SEGUIMIENTO
- [x] Lista de acciones con estado de seguimiento
- [x] Filtro por sucursal y estado

## Exportación PDF
- [x] Generación de reporte PDF con calificación, secciones, puntos fallidos y análisis
- [x] Incluir observaciones generales en el reporte

## Pruebas
- [x] Tests vitest: 19 tests pasando (evaluacionData + auth.logout)

## Mejoras Futuras
- [ ] Notificaciones por correo al completar evaluación
- [ ] Comparativa entre múltiples sucursales en el mismo período
- [ ] Exportación a Excel con detalle completo
- [ ] Fotos adjuntas en observaciones de puntos
- [ ] Firma digital del evaluador

## Correcciones Solicitadas (Mar 24)
- [ ] Revisar Excel original y verificar todos los puntos de evaluación
- [ ] Completar puntos faltantes en evaluacionData.ts
- [ ] Mejorar exportación PDF: resumen Por Categoría
- [ ] Mejorar exportación PDF: resumen Por Sección
- [ ] Mejorar exportación PDF: lista completa de Puntos Fallidos con criterio
- [ ] Mejorar exportación PDF: sección de Áreas de Mejora con recomendaciones

## Comparativa y Evolución (Mar 24 - v2)
- [x] Procedimiento tRPC: obtener historial con puntuación por categoría y sección
- [x] Página Comparativa: gráfica de línea de tendencia general por sucursal
- [x] Página Comparativa: gráfica de línea por cada categoría (6 líneas)
- [x] Página Comparativa: gráfica de barras agrupadas por sección (comparar N evaluaciones)
- [x] Página Comparativa: selector de sucursal
- [x] Página Comparativa: tabla resumen de todas las evaluaciones con delta vs anterior
- [x] Página Comparativa: tarjetas de mejor y peor categoría histórica
- [x] Integrar nueva página en sidebar de navegación

## Administración de Preguntas (Mar 24 - v3)
- [x] Agregar tabla `puntos_evaluacion` al schema de Drizzle
- [x] Migrar los 111 puntos a la base de datos (seed)
- [x] Helpers DB: listar, crear, actualizar, eliminar/desactivar preguntas
- [x] Procedimientos tRPC: CRUD completo de preguntas
- [x] Página Admin Preguntas: listado por sección con búsqueda y filtros
- [x] Página Admin Preguntas: modal para editar pregunta (descripción, categoría, valor, sección)
- [x] Página Admin Preguntas: agregar nueva pregunta
- [x] Página Admin Preguntas: activar/desactivar preguntas
- [x] Página Admin Preguntas: reordenar preguntas dentro de una sección
- [x] Formulario de evaluación usa preguntas desde evaluacionData.ts (compatible con DB)
- [x] Integrar en sidebar de navegación

## Correcciones UI/UX (Mar 24 - v4)
- [x] Mostrar criterio debajo de la descripción en formulario de evaluación (sin icono I)
- [x] Arreglar continuación de evaluaciones en borrador desde historial (botón PlayCircle + carga automática)
- [x] Agregar puntos fallidos a la exportación PDF (con observaciones, áreas de mejora y resumen visual)

## Limpieza de Preguntas + Nuevas + Foto Evidencia (Mar 24 - v5)
- [x] Eliminar IM11 (duplicado de IM6)
- [x] Eliminar SC7 (duplicado de ON9)
- [x] Eliminar HO7 (duplicado de EQ6)
- [x] Eliminar EQ15 (subconjunto de ON11)
- [x] Fusionar PG3+ON1 en un solo punto (PG3 unificado)
- [x] Fusionar SC6+SC8 en un solo punto (SC6 unificado)
- [x] Actualizar criterio de PG4 (quitar referencia a uniforme)
- [x] Actualizar criterio de PG5 (delimitar a equipos, no luminarias)
- [x] Actualizar criterio de EL9 (quitar referencia a chicles)
- [x] Agregar 18 nuevas preguntas sugeridas (123 puntos activos totales)
- [x] Agregar columna foto_url en tabla respuestas_evaluacion
- [x] Backend: endpoint para subir foto a S3 y guardar URL en respuesta
- [x] Frontend: botón de cámara opcional en cada punto del formulario (máx 5MB)
- [x] Actualizar seed de puntos_evaluacion con los cambios (123 activos, 6 desactivados)

## Formulario Dinámico desde DB (Mar 24 - v6)
- [x] Endpoint tRPC: obtener puntos activos agrupados por sección desde puntos_evaluacion (reutiliza adminPreguntas.list)
- [x] Formulario NuevaEvaluacion: cargar secciones y preguntas dinámicas desde DB
- [x] Mantener compatibilidad: fallback automático a datos estáticos si la DB no responde
- [x] Cálculo de puntuación dinámico (calcularPuntuacionDinamica) compatible con datos de DB

## Limpieza de Duplicados en DB (Mar 24 - v7)
- [x] Identificar preguntas duplicadas por código en puntos_evaluacion (456 registros, 129 únicos)
- [x] Eliminar 327 registros duplicados conservando el de menor ID (original)
- [x] Verificar conteo final: 129 registros, 123 activos, 6 inactivos

## Prototipo Snowtea HQ (Mar 25, 2026)
- [ ] Pantalla: Dashboard Admin con semáforo de tiendas y KPIs
- [ ] Pantalla: Portal Líder de Tienda (vista móvil)
- [ ] Pantalla: Reporte Diario de Ventas
- [ ] Pantalla: Checklist Operativo (21 flujos)
- [ ] Pantalla: Comparativa entre tiendas
- [ ] Pantalla: Control de Personal / Horarios
- [ ] Pantalla: Integración SECOF en dashboard admin

## Prototipo HQ Accesible (Mar 25)
- [x] Crear página React /prototipo-hq que renderice el prototipo del sistema Snowtea HQ
- [x] Agregar ruta en App.tsx
- [x] Agregar enlace en sidebar

## Snowtea HQ - Reestructuración (Mar 25)
- [x] Actualizar branding: nombre "Snowtea HQ", logo, colores
- [x] Nuevo layout principal con navegación por módulos (grupos: Inicio, Franquicias, SECOF, Administración, Sistema)
- [x] Dashboard ejecutivo HQ (landing page del ecosistema)
- [x] Ampliar roles en DB: superadmin, owner, manager, leader, host
- [x] Panel de gestión de usuarios con asignación de roles (AdminUsuarios)
- [x] Panel de asignación de usuarios a sucursales (modal en AdminUsuarios)
- [x] Middleware de autorización por rol en tRPC
- [x] Guards de ruta en frontend por rol
- [x] SECOF integrado como módulo dentro del HQ
- [x] Menú lateral dinámico según rol del usuario

## Guards de Ruta y Menú Dinámico (Mar 25 - v9)
- [x] Actualizar adminProcedure para aceptar superadmin y admin
- [x] Crear componente RoleGuard para proteger rutas por rol
- [x] Actualizar DashboardLayout: menú lateral dinámico según rol del usuario
- [x] Aplicar guards en App.tsx para rutas de administración
- [x] Dashboard Ejecutivo HQ: semáforo de tiendas, KPIs globales, alertas

## Corrección Menú Dinámico (Mar 25 - v9 fix)
- [ ] Diagnosticar por qué el menú muestra SECOF y Prototipo HQ a usuarios sin ese rol
- [ ] Verificar que el rol del usuario se lee correctamente desde la DB (no solo el campo local)
- [ ] Corregir el filtrado del menú lateral

## Ajuste de Permisos (Mar 25 - v10)
- [x] Sección Configuración (Admin Preguntas): solo superadmin
- [x] Backend: adminPreguntas solo superadmin, adminUsuarios para owner/manager/superadmin
- [x] Frontend: menú y guards actualizados con nueva jerarquía

## Reestructuración de Roles (Mar 25 - v10)
- [x] Eliminar rol 'admin' del sistema (migrar a superadmin en DB)
- [x] superadmin: acceso total (Usuarios, Preguntas, SECOF, Sucursales)
- [x] owner y manager: mismos permisos (SECOF + Sucursales + dar de alta colaboradores)
- [x] leader: Nueva Evaluación, Historial, Plan de Acción
- [x] host / user: solo Dashboard
- [x] Actualizar RoleGuard.tsx con nueva jerarquía y permisos
- [x] Actualizar DashboardLayout.tsx con nuevo filtrado de menú
- [x] Actualizar App.tsx con nuevos guards de ruta
- [x] Actualizar backend: adminUsuarios accesible para superadmin, owner y manager
- [x] Actualizar schema Drizzle: remover 'admin' del enum de roles
- [x] Eliminar Prototipo HQ del menú lateral y de las rutas de la aplicación

## Autenticación con Google OAuth (Mar 25 - v11)
- [x] Configurar credenciales GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
- [x] Backend: endpoint /api/auth/google y /api/auth/google/callback
- [x] Backend: sesión JWT propia (independiente de Manus)
- [x] Frontend: botón "Continuar con Google", eliminar Manus OAuth
- [x] Configurar Authorized Redirect URI en Google Cloud Console
- [x] Migrar useAuth: compatible con sesión JWT propia (sin cambios necesarios)

## Módulos Principales (Mar 25 - v13)
- [x] Pantalla de cuenta pendiente de activación para rol 'user'
- [x] Notificación automática al superadmin cuando entra un colaborador nuevo
- [x] Módulo Evaluación SECOF: formulario de preguntas por categoría (ya implementado)
- [x] Módulo Evaluación SECOF: guardar respuestas y calcular puntaje (ya implementado)
- [x] Módulo Evaluación SECOF: historial de evaluaciones por sucursal (ya implementado)
- [x] Gestión de Sucursales: registro con nombre, ciudad, franquiciado (ya implementado)
- [x] Gestión de Sucursales: listado con estado y última evaluación (ya implementado)
- [x] Gestión de Sucursales: asignación de usuarios a sucursal (SucursalDetalle)

## Bug Fix - Hooks (Mar 25)
- [x] Corregir error "Rendered more hooks than during previous render" en DashboardLayout.tsx

## Mejoras Completas (Mar 25 - v15)
- [x] Restricción de roles: manager solo puede asignar leader/host, no owner/superadmin
- [x] Filtrar evaluaciones por sucursal asignada al usuario (leader ve solo sus tiendas)
- [x] Filtrar historial y plan de acción por sucursales asignadas al usuario
- [x] Módulo Reporte Diario: schema DB (tabla reportes_diarios)
- [x] Módulo Reporte Diario: tRPC CRUD (crear, listar, ver detalle)
- [x] Módulo Reporte Diario: formulario (ventas, incidentes, novedades del día)
- [x] Módulo Reporte Diario: listado con filtro por sucursal y fecha
- [x] Módulo Reporte Diario: ruta y entrada en sidebar para leader/manager/owner
- [x] PDF: resumen por categoría con porcentaje y barra visual (ya estaba implementado)
- [x] PDF: resumen por sección con porcentaje y barra visual (ya estaba implementado)
- [x] PDF: lista completa de puntos fallidos con criterio y observación (mejorado)
- [x] PDF: sección de áreas de mejora con recomendaciones priorizadas (ya estaba implementado)

## Mejoras v16 (Mar 25)
- [x] Dashboard HQ: KPIs de ventas del Reporte Diario (ventas totales, transacciones, ticket promedio)
- [x] Dashboard HQ: semáforo integrado SECOF + ventas por sucursal
- [x] Notificación al superadmin cuando se envía un Reporte Diario
- [x] Asignación de sucursales desde panel Usuarios y Roles (ya implementado en AdminUsuarios)
- [x] Backend: endpoint resumenVentas (7 días, ventas totales, transacciones, ticket promedio)

## Rediseño Dashboard Global (Mar 25)
- [ ] Dashboard HQ: vista ejecutiva global con dos pilares (SECOF + Ventas)
- [ ] Dashboard HQ: KPIs globales en tarjetas grandes (puntaje promedio, ventas totales, tiendas activas, reportes pendientes)
- [ ] Dashboard HQ: resumen por pilar sin semáforo detallado (solo indicadores clave)
- [ ] Sección SECOF/Historial: mover semáforo detallado por tienda aquí
- [ ] Sección SECOF: puntajes por categoría, tendencias y alertas de tiendas con bajo puntaje

## Menú Lateral + Dashboard Global (Mar 25)
- [x] Menú lateral: grupos expandibles (SECOF, Ventas, Tiendas, Configuración)
- [x] Menú lateral: sub-ítems por grupo según rol del usuario
- [x] Dashboard: vista ejecutiva global con KPIs de ventas + SECOF + semáforo de tiendas
- [x] Dashboard: sección de gestión de tiendas con estado rápido

## Módulo Ventas - Gráfica Histórica (Mar 26)
- [ ] Página Ventas: gráfica de evolución histórica (ingresos, transacciones, ticket promedio)
- [x] Página Ventas: filtros por sucursal y período (7d, 30d, 90d)
- [ ] Backend: endpoint para datos históricos de ventas por día/semana
- [ ] Dashboard: sección Ventas con tendencia propia (no SECOF)
- [ ] Ruta /ventas registrada en App.tsx y menú lateral

## Ventas + Meta + Excel (Mar 26)
- [x] Backend: endpoint historico de ventas por día con filtro por sucursal y período
- [x] Backend: campo metaVentasMensual en tabla sucursales
- [x] Página Ventas: gráfica histórica de evolución (ingresos, transacciones, ticket promedio)
- [x] Página Ventas: filtros por sucursal y período (7d, 30d, 90d)
- [x] Sucursales: campo meta de ventas mensual en formulario de alta/edición
- [ ] Dashboard: indicador de avance vs meta en tarjeta de ventas
- [x] Exportación a CSV del historial de ventas (integrado en página Ventas)
- [x] Ruta /ventas en App.tsx y menú lateral

## Mejoras v19 (Mar 26)
- [ ] Dashboard: indicador de avance vs meta mensual de ventas por sucursal
- [ ] Backend: endpoint para calcular avance vs meta del mes actual
- [ ] Alertas: notificar al superadmin cuando una sucursal lleva +2 días sin reporte
- [ ] Alertas: indicador visual en Dashboard de tiendas sin reporte reciente
- [ ] Página Ventas: gráfica comparativa de ventas entre sucursales (barras agrupadas)
- [ ] Página Ventas: selector multi-sucursal para comparativa

## Mejoras v19 (Mar 26)
- [x] Dashboard: alerta de tiendas sin reporte en últimos 2 días
- [x] Dashboard: sección avance vs meta mensual por sucursal (barra de progreso)
- [x] Ventas: comparativa entre sucursales con barras horizontales ordenadas por ventas
- [x] Backend: endpoint sinReporte (tiendas sin reporte en N días)
- [x] Backend: endpoint avanceMeta (ventas del mes vs meta por sucursal)

## Mejoras v20 (Mar 26)
- [ ] Foto de perfil en sucursales: campo foto_url en tabla sucursales
- [ ] Foto de perfil en sucursales: subida a S3 desde formulario
- [ ] Foto de perfil en sucursales: mostrar en tarjetas del Dashboard y lista de sucursales
- [ ] Reporte semanal automático: endpoint tRPC para generar resumen semanal
- [ ] Reporte semanal automático: notificación al superadmin con estado de todas las tiendas
- [ ] UX: indicador de carga mejorado en formulario de evaluación
- [ ] UX: mensaje de bienvenida personalizado en Dashboard según rol

## Mejoras v21 (Mar 26)
- [x] Eliminar foto de sucursal del formulario y del schema
- [x] Meta de ventas: mover a sección separada "Metas de Ventas" accesible solo para owner/superadmin
- [x] Gráfica de tendencia SECOF en detalle de sucursal (línea histórica de puntajes)
- [x] Exportar PDF directamente desde el listado de historial (sin entrar al detalle)

## Mejoras v22 (Mar 26 - 6 pasos)
- [x] Dashboard: tarjeta de avance vs meta mensual global (% cumplimiento + barra)
- [x] Dashboard: mejorar indicador de tiendas sin reporte (con nombre de tienda y días sin reportar)
- [x] Ventas: comparativa multi-sucursal (selector múltiple hasta 5 tiendas + gráfica de líneas)
- [x] Dashboard: mensaje de bienvenida personalizado por rol (owner, manager, leader, host)
- [x] Backend: scheduler semanal (lunes 8am) que envía notificación con resumen SECOF + ventas
- [x] Backend: resumenSemanal incluye avance vs meta del mes actual por sucursal
- [x] Ventas: exportación a CSV mejorada (incluye meta, avance %, sucursal, período, día de semana)

## Módulos Anfitriones y Líder (v23) ✔
- [x] Schema: tabla empleados (nombre, rol, sucursal, fecha ingreso, activo)
- [x] Schema: tabla checklist_plantillas (nombre, tipo: limpieza/operativo, items JSON)
- [x] Schema: tabla checklist_registros (empleado, plantilla, fecha, items_completados, firmado)
- [x] Schema: tabla asistencia (empleado, sucursal, tipo: entrada/salida, timestamp, método: qr/manual, lat/lng)
- [x] Schema: tabla observaciones_kpi (empleado, semana, tipo: servicio/preparacion/caja, valor, notas)
- [x] Backend: CRUD empleados por sucursal
- [x] Backend: CRUD plantillas de checklist
- [x] Backend: registro de checklist diario (líder firma)
- [x] Backend: endpoint QR de asistencia (público, por token de sucursal)
- [x] Backend: registro de asistencia manual
- [x] Backend: KPI observaciones de servicio (% interacciones cumplidas por tipo)
- [x] Página Empleados: listado y alta/baja por sucursal (Líder/Manager)
- [x] Página Checklist: vista diaria con ítems por turno + plantillas Snowtea LI-FR-001/002
- [x] Página Asistencia QR: página pública mobile-first para escanear QR (entrada/salida)
- [x] Página Asistencia Admin: historial del día y registro manual (Líder)
- [x] Página KPIs Anfitriones: dashboard de KPIs Nivel 1 por empleado (servicio, preparación, caja)
- [x] Navegación: grupo "Equipo" en menú lateral con 4 sub-ítems

## Módulos v24 (Mar 26) ✔
- [x] Mermas: campo mermas_monto y mermas_detalle en tabla reportes_diarios
- [x] Mermas: UI en Reporte Diario (campo de monto y descripción de mermas, con % vs ventas)
- [x] Mermas: indicador en detalle del reporte (semáforo verde <3%, rojo >3%)
- [x] Horarios: tabla horarios_semanales (empleado, sucursal, semana, turno por día)
- [x] Horarios: página Horarios con vista de calendario semanal (7 columnas, empleados en filas)
- [x] Horarios: asignación de turno por clic cíclico (M/V/MV/D/sin asignar)
- [x] Horarios: copiar semana anterior con un clic
- [x] Horarios: exportación a PDF para imprimir en tienda (ventana de impresión del navegador)
- [x] Dashboard Líder: vista /mi-turno optimizada para móvil (fondo oscuro, tarjetas grandes)
- [x] Dashboard Líder: ventas del día, checklist, asistencia, KPI semana, SECOF en una pantalla
- [x] Dashboard Líder: acciones rápidas con indicador de completado
- [x] Navegación: Horarios y Mi Turno en grupo Equipo del menú lateral

## Nivel 1 y 2 Completos - v25 (Mar 26) ✔
### Nivel 1 - KPIs Anfitriones (completo)
- [x] Schema: campo efectivo_inicial, efectivo_final, diferencia_caja en reportes_diarios
- [x] Schema: tabla bajas_empleados (empleadoId, fecha, motivo, tipo: renuncia/despido/otro)
- [x] Backend: procedimiento descuadresCaja (por sucursal, rango de fechas)
- [x] Backend: procedimiento kpiPuntualidad (incidencias de asistencia por empleado/mes)
- [x] Backend: kpiAnfitriones con 3 tipos: servicio, preparacion, caja
- [x] UI: KpiAnfitriones mejorado con pestañas: Servicio / Preparación / Puntualidad / Caja
- [x] UI: KpiAnfitriones - tabla de descuadres de caja con semáforo
- [x] UI: KpiAnfitriones - KPI de puntualidad por empleado
### Nivel 2 - KPIs Líder (completo)
- [x] Backend: procedimiento cumplimientoReportes (% reportes enviados a tiempo por mes)
- [x] Backend: procedimiento mermas (% mermas vs ventas por sucursal/mes)
- [x] Backend: procedimiento rotacionEquipo (bajas / plantilla promedio * 100, por trimestre)
- [x] UI: nueva página KpiLider con 5 KPIs: SECOF, Ventas vs Meta, Mermas, Reportes, Rotación
- [x] UI: KpiLider - semáforo por KPI (verde/amarillo/rojo según meta)
- [x] UI: KpiLider - tendencia mensual de cada KPI con gráfica de línea
- [x] UI: KpiLider - exportar resumen a PDF
- [x] Navegación: KPIs Líder (Nivel 2) en grupo Equipo del menú lateral
### Notificaciones automáticas
- [x] Scheduler: alerta al owner si no hay reporte diario a las 22:00
- [x] Scheduler: alerta al owner si mermas >3% en el reporte del día
- [x] Scheduler: alerta al owner si descuadre de caja >$50
- [x] Resumen semanal mejorado: incluye mermas, descuadres, avance vs meta
### Mi Turno mejorado
- [x] MiTurno: sección KPIs del mes (cumplimiento reportes + mermas con semáforo)
- [x] MiTurno: acceso rápido a KPIs Líder y KPIs Anfitriones
- [x] MiTurno: indicador de días pendientes de reporte en el mes

## Rediseño Dashboard + Restricciones v26 (Mar 26) ✔
- [x] Empleados: restringir creación/edición a manager/owner/superadmin (líder solo lectura)
- [x] Backend: proteger procedimiento empleados.crear con adminProcedure
- [x] Dashboard SECOF: nueva página /secof-dashboard con resumen de evaluaciones, escala, acceso rápido
- [x] Dashboard inicial: eliminar sección "Acceso Rápido" y "Escala SECOF"
- [x] Dashboard inicial: rediseñado con tarjetas críticas de todos los módulos (ventas, SECOF, equipo, reportes)
- [x] Navegación: "Resumen SECOF" en grupo SECOF del menú lateral

## Ventas por Canal + Históricas v27 (Abr 1)
- [ ] Schema: reemplazar ventasTotales/transacciones/ticketPromedio por ventasEfectivo, ventasTarjeta, ventasRappi en reportes_diarios
- [ ] Schema: nueva tabla ventas_historicas (sucursalId, anio, mes, ventasEfectivo, ventasTarjeta, ventasRappi, ventasTotales)
- [ ] Migración DB aplicada
- [ ] Backend: actualizar input de crear/editar reporte diario con nuevos campos
- [ ] Backend: CRUD ventas_historicas (listar, upsert por sucursal/año/mes)
- [ ] Backend: resumenVentas actualizado con desglose por canal
- [ ] Reporte Diario: formulario con 3 campos de canal (efectivo, tarjeta, Rappi) + total automático
- [ ] Reporte Diario: visualización con desglose por canal y % de cada uno
- [ ] Página VentasHistoricas: tabla 12 meses × tiendas, editable celda por celda
- [ ] Página VentasHistoricas: importar/pegar datos en bloque (CSV)
- [ ] Configuración: agregar "Ventas del Año Anterior" en el grupo Configuración del menú
- [ ] Dashboard: tarjeta Ventas 7 días con desglose efectivo/tarjeta/Rappi
- [ ] KPI Ventas vs Meta: usar ventas históricas del año anterior como meta base
- [ ] Ventas.tsx: gráfica con 3 líneas (efectivo, tarjeta, Rappi)

## Correcciones v27b (Apr 1) ✔
- [x] Bug: desfase de fecha en Reporte Diario (UTC vs zona horaria local México) — helpers formatLocalDate/toLocalDateString
- [x] Bug: error TS en scheduler.ts (referencia a transacciones reemplazada por efectivo/tarjeta/Rappi)

## Ventas Históricas v27c (Apr 1) ✔
- [x] Backend: router ventasHistoricas (list, upsert, delete) en routers.ts
- [x] Página VentasHistoricas: tabla 12 meses × tiendas, editable celda por celda
- [x] Página VentasHistoricas: modal con 3 campos (efectivo, tarjeta, Rappi) + total automático
- [x] Página VentasHistoricas: tarjetas de resumen anual (total, promedio mensual, tiendas con datos)
- [x] Página VentasHistoricas: exportar a CSV con todos los canales
- [x] Página VentasHistoricas: navegación entre años con flechas
- [x] Configuración: "Ventas Históricas" en grupo Configuración del menú (manager+)
- [x] App.tsx: ruta /ventas-historicas con guard minRole="manager"

## Bugs Reporte Diario v28 (Apr 1) ✔
- [x] Bug: efectivo+tarjeta+Rappi ahora suman automáticamente en campo Ventas Totales (readOnly)
- [x] Bug: fecha desfasada corregida — toLocalDateString devuelve el string YYYY-MM-DD sin convertir a Date
- [x] Bug: listado ahora muestra total en verde + desglose Ef/Tar/Rappi en gris

## Bug Fecha Persistente v29 (Apr 1)
- [x] Bug: día 31 se muestra como 30 — desfase UTC en backend/DB (no solo frontend)

## KPI Nivel 3 - Administrador v30 (Apr 1)
- [x] Schema: tabla gastos_operativos (renta, nomina, insumos, servicios, mantenimiento, marketing, otros, costoProducto)
- [x] Migración DB aplicada (gastos_operativos)
- [x] Backend: funciones getKpiCrecimiento, getKpiRentabilidad, getKpiEficiencia en db.ts
- [x] Backend: router kpiAdmin (crecimiento, rentabilidad, eficiencia) en routers.ts
- [x] Backend: router gastosOperativos (list, upsert) en routers.ts
- [x] Página KpiAdmin: pestañas Crecimiento / Rentabilidad / Eficiencia
- [x] KpiAdmin - Crecimiento: KPI % vs año anterior, gráfica de barras 6 meses, tabla detallada
- [x] KpiAdmin - Rentabilidad: margen bruto, margen neto, utilidad neta, desglose waterfall
- [x] KpiAdmin - Eficiencia: ratio gastos/ventas, gráfica horizontal por categoría, tabla desglose
- [x] Modal de registro/edición de gastos operativos por mes
- [x] Semáforo automático por KPI (verde/amarillo/rojo)
- [x] Navegación: "KPIs Admin (Nivel 3)" en grupo Equipo del menú lateral (manager+)

## KPI Líder Nivel 2 - Ventas vs Meta desde Históricas v31 (Apr 1)
- [x] Backend: endpoint kpiLider.ventasVsMeta usa ventas_historicas del año anterior como meta
- [x] Backend: si no hay registro histórico del mes, retornar flag sinMeta=true
- [x] Frontend KpiLider: mostrar meta desde ventas históricas año anterior
- [x] Frontend KpiLider: si sinMeta=true, mostrar input para ingresar meta manualmente y guardar en ventas_historicas
- [x] Eliminar "Metas de Ventas" del menú lateral (consolidado en Ventas Históricas bajo Configuración)

## Módulo Horarios v32 (Apr 4) - Rediseño completo
- [x] Schema: tabla actividades_catalogo (clave, descripcion, categoria: D/S/B/M)
- [x] Schema: tabla turnos_semana (sucursalId, empleadoId, fecha, puesto, turno, horaInicio, horaFin, rolPrincipal, comentarios, semana, anio)
- [x] Schema: tabla turno_actividades (turnoId, actividadClave, completada, completadaAt, pendienteDeturnoId)
- [x] Seed: catálogo completo de actividades D1-D13, S1-S20, B1-B4, M1-M3
- [x] Backend: CRUD turnos_semana (crear, editar, eliminar turno)
- [x] Backend: asignar/quitar actividades a un turno
- [x] Backend: sugerencia de distribución equitativa (horas/días por empleado últimas 4 semanas)
- [x] Backend: sugerencia de actividades S/B/M pendientes de la semana (rotación automática)
- [x] Backend: al cerrar turno, marcar actividades no completadas como pendientes y reasignar al siguiente turno del empleado
- [x] Backend: query horario semanal por sucursal+semana
- [x] Backend: query Mi Turno (turno del día del empleado logueado + actividades)
- [x] Página Horarios: vista semanal por día con tarjetas de turno por empleado
- [x] Página Horarios: modal agregar/editar turno con selector de empleado, puesto, turno, horario, rol principal
- [x] Página Horarios: panel de actividades asignadas al turno (multi-select con claves D/S/B/M por pestaña)
- [x] Página Horarios: sugerencia de distribución equitativa visible en banner
- [x] Página Horarios: indicador visual de actividades pendientes del turno anterior (naranja)
- [x] Mi Turno: sección "Mi turno de hoy" con checklist de actividades asignadas
- [x] Mi Turno: palomeo individual por actividad con timestamp
- [x] Mi Turno: botón "Cerrar turno" que arrastra pendientes al siguiente turno
- [x] Mi Turno: mostrar actividades pendientes de turno anterior (resaltadas en naranja)

## Descripción emergente actividades checklist v33 (Apr 4)
- [x] Mi Turno: mostrar descripción completa de cada actividad al expandir/hover en el checklist
- [x] Backend: incluir descripción del catálogo en la query miTurnoHoy

## 4 Mejoras v34 (Apr 4)
- [x] Horarios: generación automática completa del horario semanal (turnos + actividades) con distribución equitativa al abrir semana sin datos
- [x] Horarios: botón "Regenerar horario" para regenerar/sobreescribir en cualquier momento
- [x] Horarios: resumen de cumplimiento por tarjeta de turno (X/Y actividades completadas) ya existía
- [x] Notificación al owner/manager cuando empleado cierra turno con actividades pendientes (claves incluidas)
- [x] Mi Turno: foto de evidencia al expandir actividades S/B/M (subida a S3, visible en el panel expandido)

## Disponibilidad de empleados v35 (Apr 4)
- [x] Schema: agregar campo diasDisponibles (JSON array de días 0-6) y tipoContrato (fulltime/finde_ext/finde/custom) a tabla empleados
- [x] Schema: migración aplicada en DB
- [x] Backend: generarHorarioAutomatico respeta diasDisponibles por empleado
- [x] Backend: descanso variable para fulltime — rotar entre lun/mar/mié (1 día por empleado, rotación cíclica)
- [x] Backend: empleados finde_ext solo asignados vie/sáb/dom
- [x] Backend: empleados finde solo asignados sáb/dom
- [x] Frontend: selector de tipo de contrato + días personalizados en el diálogo de empleado
- [x] Frontend: badge de disponibilidad en la tarjeta de empleado (solo muestra si no es fulltime)

## Bug Fix v36 (Apr 4)
- [x] Bug: value=null en inputs de Horarios.tsx — sanitizados en openEdit() y en el useState inicial del TurnoModal

## Bug Fix v37 (Apr 4)
- [x] Bug: generador automático solo asignaba 1 empleado en sáb/dom — corregido: cada turno del día toma el siguiente empleado disponible en orden de menos horas

## Bug Fix v38 (Apr 4)
- [x] Bug: domingo muestra "2 turnos" en contador pero no renderiza las tarjetas de turno en Horarios

## Limpieza + PDF Horario v40 (Apr 4)
- [x] Eliminar Checklist Actividades del menú lateral y rutas (redundante con Horarios + Mi Turno)
- [x] Exportar horario semanal a PDF desde la página Horarios (botón Exportar PDF → ventana de impresión con tabla por día/turno/empleado/actividades)

## Bug Fix v41 (Apr 4)
- [x] Bug: referencias a /checklist en Home.tsx y MiTurno.tsx causan 404 — redirigidas a /horarios

## Módulo Preparaciones + Credibilidad v42 (Apr 4)
- [x] Schema: tabla preparaciones (id, sucursalId, turnoId, empleadoId, receta, cantidad, unidad, preparadaAt, venceAt, estado, incidenciaTipo, incidenciaAt, incidenciaNota)
- [x] Schema: tabla actividades_observacion (id, sucursalId, actividadClave, activadaPor, activadaAt, resueltaPor, resueltaAt, activa, notas)
- [x] Migración DB aplicada
- [x] Backend: CRUD preparaciones (crear, listar por turno/sucursal/fecha, marcar incidencia)
- [x] Backend: endpoint preparaciones.activas → lista con minutos restantes y semáforo
- [x] Backend: endpoint preparaciones.historialIncidencias → filtro por sucursal/fecha/tipo
- [x] Backend: lógica alerta tapioca (40 min antes, solo si hay ≥90 min antes del cierre)
- [x] Backend: lógica alerta Base Snowtea (12h antes de vencer)
- [x] Backend: scheduler — revisar cada 30 min preparaciones activas y notificar al dueño
- [x] Backend: CRUD actividades_observacion (activar, resolver, listar por sucursal)
- [x] Backend: al completar actividad bajo observación → forzar evidencia fotográfica
- [x] Frontend: sección "Preparaciones" en Mi Turno — formulario nueva preparación
- [x] Frontend: tarjetas de preparaciones activas con countdown y semáforo de tiempo
- [x] Frontend: banner/alerta en Mi Turno cuando preparación está por vencer
- [x] Frontend: modal de incidencia (sin preparación / vencida / fuera de tiempo) con nota
- [x] Frontend: página Preparaciones para líder/manager con historial + incidencias críticas
- [x] Frontend: panel "Actividades bajo observación" en KpiLider para líder/manager/dueño
- [x] Frontend: badge visual en actividades bajo observación en Mi Turno (ojo naranja)
- [x] Frontend: bloquear completar actividad bajo observación sin foto

## Mejoras v43 (Apr 4)
- [x] Comparativa: selector de rango de fechas personalizado (fecha inicio + fecha fin) en lugar de solo período fijo
