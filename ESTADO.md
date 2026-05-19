# ESTADO.md — SECOF Snowtea
**Última actualización:** 19 de Mayo 2026  
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
- Compras Jellyboba (historial, detalle, upload PDF, Nueva Orden)
- Rentabilidad (P&L: CMV Jellyboba + compras externas + gastos)
- Reporte Diario automático (9:30pm México)
- Plan de Acción + Evaluaciones Periodo de Prueba
- Supervisión de Actividades

---

## RENTABILIDAD / CMV
- CMV = compras Jellyboba del periodo (`compras`) + compras externas (`compras_externas`)
- Mat. prima (recetas) eliminada del P&L
- Gastos desde `fin_gastos` (fijos, nómina, variable, ingreso extra)
- Meta desde `sucursales.metaVentasMensual`

**Abril 2026:**
- Ventas: $251,650 | CMV: $53,645 (21.3%) | Margen: 78.7% | Utilidad: $76,432 (30.4%)

---

## NÓMINA / CONTROL DE ASISTENCIAS
- Fuente de horas: registros QR (`asistencia` tabla, 160+ registros, timestamp bigint ms)
- Cálculo: entrada → siguiente salida dentro de 14h
- Timezone: UTC-6 (México) para agrupar por fecha
- Retardos: entrada QR > hora programada + 10 min
- Ajustes eventuales: `ajustes_eventuales` tabla (14 registros) — override de hora esperada
- Ausencias: día con horario programado sin registro QR
- Export: Excel desde "Exportar Excel (nómina)" en Control de Asistencias
- Outsourcing: C&H (quincena día 1 y 16)

**Fixes aplicados 19-may-2026:**
- Timezone: agrupación UTC→México evita horas negativas
- Salida < entrada: validación antes de calcular horas
- QR tiene prioridad sobre turno_apertura/cierre
- Ajustes eventuales aplican en cálculo de retardos

---

## COMPRAS JELLYBOBA
- 11 órdenes cargadas (OV09632–OV09882), total $155,429.78
- Tablas: `compras` + `compras_detalle` (constraint único uq_compra_sku)
- PDFs: `/dist/public/pdfs/compras/`
- Botón "Nueva Orden" en UI para captura manual + upload PDF
- Auto-sync desde Odoo Jellyboba: PENDIENTE

---

## SCHEDULER (UTC)
| Tarea | UTC | México CDT |
|---|---|---|
| Sync Odoo + reporte diario | 03:30 | 21:30 |
| Alerta reportes faltantes | 22:00 | 16:00 |
| Auto-meta mensual | 1ro mes 06:00 | — |
| secof-api | DETENIDO | — |

---

## EMPLEADOS CON QR ACTIVO (Plaza Patio)
| empleadoId | Nombre | Registros |
|---|---|---|
| 30001 | Luz | 24 |
| 120001 | Tamara | 23 |
| 150001 | Emily | 50 |
| 180001 | Alma Valeria | 43 |
| 180005 | (nuevo) | 5 |
| 180006 | Ana Claudia | 4 |

---

## DEUDA TÉCNICA
1. `inventario.ts` warnings: `factorConversion` duplicado (L1281) y `surtidoIslaConfirmar` duplicado (L1452/1503) — no afectan funcionalidad
2. Módulo `Nomina.tsx` + router `nominaHoras` creados pero ocultos del menú (duplica Control de Asistencias)

---

## PENDIENTES
| # | Pendiente | Prioridad |
|---|---|---|
| 1 | Auto-sync Compras Jellyboba desde Odoo (sale.order) | 🟡 Media |
| 2 | Revisar/cargar recetas completas desde PDF Vs032025 | 🟡 Media |
| 3 | Descuento automático inventario desde preparaciones | 🟡 Media |
| 4 | Bugs warnings inventario.ts | 🟢 Baja |
| 5 | Verificar login Demo tiendademosnowtea@gmail.com | 🟢 Baja |
| 6 | Expandir SECOF a franquicias | 🔵 Futuro |
