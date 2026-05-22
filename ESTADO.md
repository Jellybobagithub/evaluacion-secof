# ESTADO.md — SECOF Snowtea
**Última actualización:** 21 de Mayo 2026  
**Último commit:** ver `git log --oneline -1`  
**PM2 proceso:** `secof` ID 1 — Puerto 5000  
**Dominio:** https://secof.snowteatienda.com  
**Repo:** https://github.com/Jellybobagithub/evaluacion-secof

---

## COMANDO DE DEPLOY
```bash
cd /var/www/secof && git pull origin main && pnpm build && pm2 restart secof
```

## DB
```bash
mysql -u secof_user -pSnowtea2026Secof secof_db
```

---

## STACK
- Frontend: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Express + tRPC + Drizzle ORM
- DB: MySQL 8.0 local
- Auth: Google OAuth
- Deploy: PM2 + Nginx en VPS Vultr 216.238.81.192

---

## SUCURSALES
| ID | Nombre | Meta mensual |
|---|---|---|
| 1 | Plaza Portal | $90,000 (cierra jun 2026) |
| 30001 | Plaza Patio | $175,012 |
| 60001 | Tienda Demo | — |

---

## MÓDULOS ACTIVOS
- SECOF evaluaciones de calidad
- Mi Turno + Preparaciones + Actividades de Limpieza
- Rotación de Áreas + Checador QR
- Control de Asistencias → Semana/Nómina + Exportar Excel
- KPIs Anfitriones / Líder / Admin
- Cuadre de Vasos
- Inventario (Conteo, Comparativa, Historial, Recetas, Config)
- Compras Jellyboba (historial, detalle, upload PDF, Nueva Orden, Recibir)
- Compras Externas (form independiente, accesos rápidos con inv_productoId)
- Rentabilidad (P&L: CMV Jellyboba + compras externas + gastos)
- Reporte Diario automático (9:30pm México)
- Plan de Acción + Evaluaciones Periodo de Prueba
- Supervisión de Actividades

---

## RENTABILIDAD / CMV
- CMV = compras Jellyboba del periodo (`compras`) + compras externas (`compras_externas`)
- Gastos desde `fin_gastos` (fijos, nómina, variable, ingreso extra)
- Meta desde `sucursales.metaVentasMensual`

**Abril 2026:**
- Ventas: $251,650 | CMV: $53,645 (21.3%) | Margen: 78.7% | Utilidad: $76,432 (30.4%)

---

## NÓMINA / CONTROL DE ASISTENCIAS
- Fuente de horas: registros QR (`asistencia` tabla, timestamp bigint ms)
- Cálculo: entrada → siguiente salida dentro de 14h
- Timezone: UTC-6 (México) para agrupar por fecha
- Retardos: entrada QR > hora programada + 10 min
- Ajustes eventuales: `ajustes_eventuales` tabla — override de hora esperada
- Export: Excel desde "Exportar Excel (nómina)" en Control de Asistencias
- Outsourcing: C&H (quincena día 1 y 16)

---

## COMPRAS JELLYBOBA
- 11+ órdenes cargadas, 40 SKUs mapeados en `compras_sku_mapping`
- PDFs: `/dist/public/pdfs/compras/` (persisten entre rebuilds)
- Botón "Recibir" → modal ajustable → crea inv_surtido → actualiza inventario Pronóstico
- OV09919 pendiente de recibir físicamente (viernes 22-may-2026)
- Auto-sync desde Odoo Jellyboba: PENDIENTE

---

## INVENTARIO — FLUJO AUTOMATIZADO (ciclo cerrado parcial)
- **Entradas:** Recibir OV Jellyboba → inv_surtidos ✅ | Compras Externas → inv_movimientos tipo=entrada ✅
- **Salidas:** Sync Odoo ventas × inv_recetas → inv_movimientos tipo=consumo_preparacion referenciaTipo=venta_odoo ✅
- **Salidas:** Módulo Preparaciones → inv_movimientos tipo=consumo_preparacion referenciaTipo=preparacion ✅
- **Validación:** Conteo físico semanal del líder (pendiente UI comparativa)
- Pronóstico Surtido: consumo 15d = inv_ventas_captura × inv_recetas (297 días historial)

---

## RECETAS (inv_recetas)
- 349 registros totales
- Todos los Snowtea Caliente completos (13 sabores × 3 ingredientes)
- Snowtea Clasico, Yogurt, Chamoy, Fra-T: completos
- Refresher y Yogurt Bombon: discontinuados, sin receta

---

## SCHEDULER (UTC)
| Tarea | UTC | México CDT |
|---|---|---|
| Sync Odoo + reporte diario + descuento inventario | 04:15 | 22:15 |
| Alerta reportes faltantes | 22:00 | 16:00 |
| Auto-meta mensual | 1ro mes 06:00 | — |
| Auto-horario semanal | Jueves 00:00 | Jueves 6PM |

---

## EMPLEADOS PLAZA PATIO (sucursalId=30001)
| id | Nombre | Rol | diaDescanso | horarioPersonal |
|---|---|---|---|---|
| 30001 | Luz | anfitrion | — | ✅ |
| 120001 | Tamara | anfitrion | — | ✅ |
| 150001 | Emily | lider | — | ✅ |
| 180001 | Alma Valeria | anfitrion | sábado | ✅ |
| 180005 | Daniela Miranda | anfitrion | sábado | ✅ (igual a Alma) |
| 180006 | Ana Claudia | anfitrion | — | — |

---

## FIXES ESTRUCTURALES APLICADOS
- Al crear empleado nuevo → hereda `horarioPersonal` base según `tipoContrato` y `diaDescansoFijo`
- Sync Odoo descuenta ingredientes directos de inventario por venta (referenciaTipo=venta_odoo)
- Compras Externas con acceso rápido → actualizan inv_movimientos tipo=entrada
- Lista Compras Externas muestra notas como subtítulo del concepto

---

## DEUDA TÉCNICA
1. `inventario.ts` warnings: `factorConversion` duplicado (L1281) y `surtidoIslaConfirmar` duplicado (L1452/1503) — no afectan funcionalidad
2. Módulo `Nomina.tsx` + router `nominaHoras` creados pero ocultos del menú

---

## PENDIENTES
| # | Pendiente | Prioridad |
|---|---|---|
| 7 | Consumo preparaciones en Pronóstico Surtido | 🟡 Media |
| 8 | Bugs warnings inventario.ts | 🟢 Baja |
| 11 | Módulo Inventario Automatizado ciclo cerrado (UI comparativa teórico vs físico, alerta descuadre, KPI líder precisión) | 🔴 Alta |
| 12 | Scheduler: filtrar actividades por area_compatible al generar turnos | 🟡 Media |
| 13 | OV09919 — verificar flujo Recibir el viernes 22-may | 🟡 Media |
