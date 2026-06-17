# ESTADO SECOF — 16 jun 2026

## Producción
- URL: secof.snowteatienda.com
- VPS: 216.238.81.192 | PM2 id=2 (name "secof") | port 5000
- DB: secof_db (MySQL 8.0)
- Repo: github.com/Jellybobagithub/evaluacion-secof

## Sucursales activas
- Plaza Patio (sucursalId=30001) — activa
- Plaza Portal (sucursalId=1) — CERRADA jun 2026

---

## Pendientes — alta prioridad 🔴

### Bugs (código)
1. `puntualidadPct` hardcodeado al 95% — calcular retardos reales vs horario de turno
2. `reportes_diarios` sync incompleto — 10 productos sin mapear en `inv_productos_venta`
6. Historial detalle: teórico histórico muestra 0 — fix pendiente

### Infraestructura
15. Migrar nightly Odoo sync de `setTimeout` a cron real — gaps multi-día en `venta_odoo`

---

## Pendientes — media prioridad 🟡

### Bugs (código)
3. `metas_mensuales.baseAnterior` incorrecto — sincronizar desde `ventas_historicas`

### Datos
4. Ana Claudia (empleadoId=180006) — cambiar `tipoContrato` de `fulltime` a `finde`
5. Luz — confirmar baja formal en sistema

### Features
7. KPI frecuencia evaluaciones semanales — agregar al snapshot del líder (ej. Emily: 2/5 semanas)
8. Campo `responsable` en `plan_accion` — NULL en todos los registros, poblar y separar dueño vs líder
17. Revisar conteo de vasos — auditar flujo completo de CuadreVasos, validar que cuadre cierre correcto
18. Alerta foto checada — si la foto de uniforme no cumple (cara no visible u otro problema), notificar al líder
19. Surtido de vasos a isla — registrar cuando surten vasos desde bodega a isla y descontarlo del inventario
20. Seguimiento cuadre de vasos — historial/reporte para líder de cuadres por día (faltantes, sobrantes, tendencia)
21. Anfitriones ven sus KPIs y áreas de mejora — vista tipo MiKpi más detallada con áreas donde fallan
22. Reporte preparaciones y servicio — ver en qué rubros específicos fallaron al mes (desglose por tipo de fallo)

---

## Pendientes — baja prioridad ⚪

### Features SECOF
9. ~~KPI Dueños~~ — COMPLETADO 12-jun-2026 (tab "Compras" agregada a KpiAdmin con compras_externas del mes)
10. KPI merma → KPIs Líder — pendiente (requiere calcular teórico por ciclo, complejo; pospuesto)
11. ~~Scheduling Phase 2~~ — COMPLETADO 12-jun-2026 (traslapes automáticos + cobertura por área/hora en TimelineDia)
12. ~~Nómina horas reales~~ — COMPLETADO 12-jun-2026 (router usa registro_nomina como fuente, calcula desde ajustes_eventuales+turnos)
13. ~~Rentabilidad costos reales~~ — COMPLETADO 12-jun-2026 (getKpiRentabilidad calcula costoProducto desde inv_ventas_captura × inv_recetas × costoXGramo)
14. ~~Quitar selectores de sucursal por módulo~~ — COMPLETADO 12-jun-2026 (KpiLider, KpiAdmin, KpiAnfitriones, Nomina usan useSucursal() global)

### Infraestructura
16. ~~Cuenta demo Gmail → sucursalId=60001~~ — COMPLETADO

---

## Emily Medina — periodo de prueba (Líder Plaza Patio)
- empleadoId=150001 | userId=2580048
- Evaluación Mes 1 (mayo 2026): **72% — Riesgo**
  - Fuertes: ventas 156%, SECOF equipo 85%, puntualidad 95%
  - Críticos: apertura/cierre SECOF 0%, protocolo servicio 37%, precisión preparación 39%
- Evaluación Mes 2: ~1 julio 2026

---

## Contexto técnico clave
- Backend router imports: `from "../_core/trpc"` y `from "../db"`
- Stock físico base: `inv_conteo_fisico` (estado='bloqueado' únicamente)
- Stock teórico: último conteo bloqueado + entradas − consumo_preparacion desde esa fecha
- Conteo workflow: enviado → aprobación Control Inventario → bloqueado (nuevo ciclo base)
- Python heredocs con backticks en TS fallan en shell — usar python3 -c con /dev/stdin
- Gemini API bloqueada en Vultr — Asistente corre en modo FAQ
- SucursalContext global en localStorage — NO agregar selectores por módulo
- MCP Jellyboba: puerto 8000, ngrok crossleted-ethylic-estelle.ngrok-free.dev
- MCP Snowtea: puerto 8001, ngrok parking-harpist-overstep.ngrok-free.app
- PDFs compras: /var/www/secof/storage/pdfs/compras/ (persistente)

---

## Completados sesión 16-jun-2026

- ~~#17-23~~ — completados en sesión anterior (12-jun)
- ~~Actividades limpieza líderes~~ — líderes reciben actividades igual que anfitriones
- ~~Ajuste Eventual → Rotación Semanal sync~~ — guardar ajuste eventual upserta rotacion_areas
- ~~generarSemana respeta ajustes eventuales~~ — ausentes excluidos, extras incluidos; no duplica
- ~~Rotación Semanal oculta ausentes~~ — getSemana devuelve ausentesSet, frontend filtra
- ~~PM2 proceso correcto~~ — id=2 (name "secof"), no id=1
- ~~Catálogo actividades actualizado~~ — área_compatible correcta por tabla oficial (prep:13, caja:18)
- ~~Solo diarias se asignan por turno~~ — S y M no se asignan diariamente
- ~~Distribución equitativa por día~~ — round-robin entre empleados activos del día

## Pendientes nuevos — 16 jun 2026

### Actividades semanales/mensuales
- Semanales (S1-S14): asignar una vez por semana rotando entre empleados (pendiente implementar)
- Mensuales (M1-M3): asignar una vez por mes rotando (pendiente implementar)

# SECOF — Contexto para Claude Code

Stack: React 19 + Vite + TypeScript + Tailwind + Express + tRPC + Drizzle ORM + MySQL 8
VPS: 216.238.81.192, PM2 id=2 (name "secof"), puerto 5000, carpeta /var/www/secof
Build: pnpm build desde /var/www/secof
Restart: pm2 restart 1
Repo: github.com/Jellybobagithub/evaluacion-secof
DB: MySQL secof_db en localhost

Reglas:
- Siempre lee ESTADO.md antes de empezar
- Después de cada fix: pnpm build → pm2 restart 1 → verificar → git commit
- Actualiza ESTADO.md al terminar cada sesión
- Nunca asumir que repo y VPS están sincronizados — trabajar directo en VPS
- Python heredocs con backticks fallan en shell — usar archivos temporales
