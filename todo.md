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
