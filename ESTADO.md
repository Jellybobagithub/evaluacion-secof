# ESTADO SECOF — 11 jun 2026

## Producción
- URL: secof.snowteatienda.com
- VPS: 216.238.81.192 | PM2 id=1 | port 5000
- DB: secof_db (MySQL 8.0)
- Repo: github.com/Jellybobagithub/evaluacion-secof

## Sucursales activas
- Plaza Patio (sucursalId=30001) — activa
- Plaza Portal (sucursalId=1) — CERRADA jun 2026

---

## Pendientes — alta prioridad 🔴

### Bugs (código)
1. ~~`puntualidadPct` hardcodeado al 95%~~ — COMPLETADO 11-jun-2026 (JOIN asistencia×turnos_semana, tolerancia 10 min)
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
9. KPI Dueños — nuevo módulo (rentabilidad, compras, gastos operativos)
10. KPI merma → KPIs Líder (Nivel 2) — conectar desde ciclo inventario
11. Scheduling Phase 2 — timeline visual por hora (Caja/Preparación) + traslapes automáticos
12. Nómina horas reales — reporte desde `ajustes_eventuales` + `turnos` para C&H
13. Rentabilidad costos reales — conectar `getKpiRentabilidad` a costos por receta
14. Quitar selectores de sucursal por módulo (ya es global desde panel inferior izq)

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

## Pendientes nuevos — 11 jun 2026

### Features operativas
17. Revisar conteo de vasos — verificar lógica y acceso correcto
18. Alerta si foto de checada no muestra cara visible — validar imagen al registrar entrada
19. Sección "consumo interno" en usuario — avisar producto tomado + surtido vasos/popotes a isla, descontar de inventario
20. Impersonar usuario como admin — ingresar a cuenta sin su mail para revisar módulos y permisos
21. Dar seguimiento a cuadre de vasos — módulo o reporte de cierre
22. Vista empleado: sus propios KPIs y áreas de mejora
23. Reporte mensual: detalle de fallos en preparaciones y servicio a cliente por empleado
