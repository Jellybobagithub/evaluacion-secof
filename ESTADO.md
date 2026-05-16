# ESTADO SECOF — Snowtea Sistema de Gestión Integral
**Última actualización:** 15 de Mayo 2026
**VPS:** 216.238.81.192 | **App:** /var/www/secof | **DB:** secof_db (MySQL) | **PM2:** secof (port 5000)
**Stack:** Node/TypeScript, React, tRPC, Drizzle ORM | **Repo:** https://github.com/Jellybobagithub/evaluacion-secof

---

## ENTORNO

| Servicio | Puerto | Estado |
|---|---|---|
| SECOF App | 5000 | ✅ PM2 id=1 |
| Nginx | 443 | ✅ secof.snowteatienda.com |
| MySQL | 3306 | ✅ secof_db |
| Odoo Snowtea | 8069 | ✅ snow.cloudpepper.site |
| MCP Snowtea | ngrok | ✅ PM2 id=9 |

**Credenciales DB:** secof_user / Snowtea2026Secof
**SMTP:** sistemas.snowtea@gmail.com / rcxlvrmzzcuvpmjd
**REPORT_EMAILS:** jorge.moreno@snowtea.com.mx, sandrasnowtea@gmail.com, miguel.moreno@jellyboba.com, emilyaylinms@gmail.com
**Odoo:** snow.cloudpepper.site, admin, f7b0100211d40de00242b1d4b2168086919291da
**POS Patio:** ID 2

---

## SUCURSALES

| ID | Nombre | Meta mensual |
|---|---|---|
| 1 | Plaza Portal | $90,000 |
| 30001 | Plaza Patio | $135,000 (auto-calc +3%) |
| 60001 | Tienda Demo | — |

## EMPLEADOS CLAVE

| Empleado | ID | userId | Rol | Sucursal |
|---|---|---|---|---|
| Emily Medina | 150001 | 2580048 | leader | Plaza Patio |
| Alma | 180001 | — | anfitrion | Plaza Patio |

---

## COMPLETADO EN SESIÓN 15-MAY-2026

### Bugs corregidos
- `asc` no importado en db.ts → sucursales vacías para Emily (Fix: agregar `asc` al import)
- `diasAlertasAsist` no definido en scheduler → 502 Bad Gateway (Fix: recalcular variable)
- `initScheduler` sin export → app no arrancaba (Fix: agregar export function + wrapper)
- `Download` icon no importado en HorariosRotacion.tsx (Fix: agregar al import)
- Modal preparaciones se abría arriba en móvil (Fix: `top-[50%] translate-y-[-50%]`)
- SelectContent bloqueado por overflow en modal (Fix: `position="popper" z-[200]`)

### Módulos nuevos
- **Cuadre automático de vasos** al registrar cierre: cruza vs Odoo, alerta si diff >5
  - Tabla: `turno_cierre.vasosOdoo`, `diferenciaCuadre`, `alertaCuadre`
- **Plan de Acción con badge vencido** — fondo rojo + alerta 9AM diaria
- **KPI Snapshot mensual** — calcula score ponderado el 1ro de cada mes 6:30AM
  - Tabla: `kpi_snapshot_mensual`
  - Service: `server/services/kpiService.ts`
- **Recordatorio SECOF mensual** — 3 niveles: jueves previo / lunes / día 10
- **Auto-horario semanal** — genera turnos automáticamente cada jueves 6PM
  - Notifica a Emily por email cuando está listo para revisar
- **Botón PDF** en Rotación Semanal para compartir por WhatsApp
- **4 KPIs nuevos** para líder: merma, rotación personal, cobertura turnos, reportes diarios
  - IDs: 33 (mermas), 34 (rotacion), 35 (cobertura), 36 (reportes)
- **Alta de empleados por líder** — Emily puede crear anfitriones en Colaboradores
- **Tab Teórico eliminado** del módulo Inventario (redundante con Pronóstico de Surtido)

### Módulo de Compras Jellyboba
- Tablas nuevas: `compras`, `compras_detalle`, `insumos_costos`
- 9 órdenes cargadas (OV09632 → OV09833) marzo-abril 2026
- 29 insumos con precio por caja y costo por gramo (`costoXGramo` en `inv_productos`)
- CMV real calculable por receta: ~22% food cost en abril
- **Pendiente:** compras externas (hielos, film, azúcar, leche soya) — agregar módulo de captura manual

### Scheduler activo (todos corriendo)
| Tarea | Hora | Estado |
|---|---|---|
| Sync Odoo | 22:15 diario | ✅ |
| Auto-meta mensual | 1ro del mes | ✅ |
| Snapshot KPI | 1ro del mes 6:30AM | ✅ |
| Check SECOF mensual | 8:00AM diario | ✅ |
| Alerta planes vencidos | 9:00AM diario | ✅ |
| Auto-horario semanal | Jueves 6PM | ✅ |
| Alerta preparaciones | cada 30 min | ✅ (notif no configurada) |
| Alertas retardos | Lunes 9AM | ✅ |

---

## PENDIENTES

### Alta prioridad
1. **Compras externas** (hielos, film de sellado, azúcar, leche soya) — formulario captura manual de precios para completar CMV
2. **Nómina** — reporte de horas reales del equipo desde ajustes eventuales y turnos_semana
3. **Usuario Demo** — crear cuenta Gmail para Tienda Demo (sucursalId=60001) y dar acceso

### Media prioridad
4. **SSH acceso directo** — bloqueado por CloudPepper, requiere pedirles apertura
5. **Rentabilidad con CMV real** — conectar `getKpiRentabilidad` con costos reales de recetas (actualmente usa costoProducto manual en gastosOperativos)
6. **Timeline visual de horarios** — Fase 2: bloques de solapamiento automático por hora del día

### Capacitación Emily (en curso)
| Sesión | Fecha | Tema |
|---|---|---|
| S1 | 19 mayo | Apertura/cierre SECOF — **CRÍTICA** |
| S2 | 26 mayo | Horarios y rotación |
| S3 | 2 junio | Inventario y conteo físico |
| S4 | 9 junio | Reportes, KPIs, SECOF |
| S5 | 16 junio | Evaluación final y certificación |

**Evaluación formal Emily:** 31 Mayo 2026 — criterios: ≥80% continúa, 60-79% extensión, <60% concluye
**Score actual Emily (abril):** 82% CUMPLE

---

## ARQUITECTURA CLAVE

### Rutas importantes
- `server/scheduler.ts` — todas las tareas automáticas (export function initScheduler)
- `server/services/kpiService.ts` — cálculo snapshot KPI mensual
- `server/services/syncService.ts` — sync Odoo
- `server/services/emailService.ts` — emails
- `server/routers/inventario.ts` — incluye stockTeorico y pronosticoSurtido
- `client/src/pages/PronosticoSurtido.tsx` — módulo principal de inventario/surtido

### Tablas nuevas en esta sesión
```sql
compras (id, numeroOrden, proveedor, fecha, subtotal, iva, total, sucursalId)
compras_detalle (id, compraId, sku, descripcion, cantidad, precioUnitario, importe, categoria)
insumos_costos (id, clave, nombre, categoria, precioCaja, contenidoCaja, precioXUnidad)
kpi_snapshot_mensual (id, sucursalId, puesto, mes, ventasPct, scoreSecof, ..., scoreTotalPct, estado)
-- Columnas agregadas:
turno_cierre: vasosOdoo, diferenciaCuadre, alertaCuadre
inv_productos: costoXGramo, insumoClave
```

### KPI config líder (eval_kpi_config)
IDs 1-10: originales | IDs 33-36: nuevos (mermas, rotación, cobertura, reportes)

### Corrección scheduler (importante)
El archivo scheduler.ts tiene `async function alertaRetardosYAusencias()` como función standalone
seguida de `export function initScheduler()`. Si se edita scheduler.ts verificar que ambas funciones
estén correctamente cerradas y exportadas.
