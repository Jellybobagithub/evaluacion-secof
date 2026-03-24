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
