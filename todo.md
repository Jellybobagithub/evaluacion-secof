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
