# ESTADO SECOF — 11 jun 2026

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

## Pendientes nuevos — 12 jun 2026 (TODOS COMPLETADOS ✅)

### Features operativas
17. ~~Revisar conteo de vasos~~ — COMPLETADO 12-jun (CuadreVasos migrado a SucursalContext global)
18. ~~Alerta cara en checada~~ — COMPLETADO 12-jun (turno.verificarCaraVisible LLM vision en AsistenciaQR apertura)
19. ~~Consumo interno~~ — COMPLETADO 12-jun (ConsumoInterno.tsx + inventario.consumoInterno router → inv_movimientos)
20. ~~Impersonar usuario como admin~~ — COMPLETADO 12-jun (AdminUsuarios botón + /api/auth/impersonate + ImpersonationBanner)
21. ~~Cuadre de vasos reporte de cierre~~ — COMPLETADO 12-jun (incluido en #17, página ya tenía reporte)
22. ~~Vista empleado sus KPIs~~ — COMPLETADO 12-jun (MiKpi.tsx + miKpi.resumen endpoint, ruta /mi-kpi)
23. ~~Reporte mensual fallos~~ — COMPLETADO 12-jun (ReporteMensual.tsx + reporteMensual.fallosPorEmpleado, ruta /reporte-mensual)

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
