# ESTADO.md — SECOF Snowtea
**Última actualización:** 19 de Mayo 2026  
**Último commit:** ver `git log --oneline -1`
**PM2 proceso:** `secof` ID 1 — Puerto 5000  
**Dominio:** https://secof.snowteatienda.com  
**Repo:** https://github.com/Jellybobagithub/evaluacion-secof

---

## COMANDO DE INICIO PM2
```bash
cd /var/www/secof && JWT_SECRET=SnowteaSECOF2026SecretKeyJellyboba VITE_APP_ID=secof-snowtea GOOGLE_CLIENT_ID=302803392762-gg4r8ckp7ejubbt843gmj7pnlae41idq.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=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 OAUTH_SERVER_URL=https://secof.snowteatienda.com OWNER_EMAIL=franquicias@snowtea.com.mx APP_URL=https://secof.snowteatienda.com NODE_ENV=production PORT=5000 DATABASE_URL="mysql://secof_user:Snowtea2026Secof@localhost:3306/secof_db" pm2 start dist/index.js --name secof
```

## DEPLOY
```bash
cd /var/www/secof && git pull origin main && pnpm build && pm2 restart secof
```

---

## STACK TÉCNICO
- Frontend: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Express + tRPC + Drizzle ORM
- DB: MySQL 8.0 — `secof_db` usuario `secof_user` contraseña `Snowtea2026Secof`
- Auth: Google OAuth
- Package manager: pnpm
- Node: 20.20.2, pnpm 10.33.0
- Nginx reverse proxy + PM2

---

## SUCURSALES
| ID | Nombre | Meta mensual |
|---|---|---|
| 1 | Plaza Portal | $90,000 (cierra jun 2026) |
| 30001 | Plaza Patio | $175,012 (auto-calc +3%) |
| 60001 | Tienda Demo | — |

## EMPLEADOS CLAVE
| Empleado | userId | Rol | Sucursal |
|---|---|---|---|
| Miguel Moreno | 600001 | superadmin | todas |
| Emily Medina | 2580048 | leader | Plaza Patio |
| Penélope Herrera | — | owner | todas |
| Jorge Moreno | — | owner | todas |
| Tienda Demo | 5495509 | manager | 60001 |
| tiendademosnowtea@gmail.com | — | — | — |

---

## MÓDULOS ACTIVOS
- SECOF (evaluaciones de calidad)
- Mi Turno + Preparaciones + Actividades de Limpieza
- Rotación de Áreas + Checador QR
- KPIs Anfitriones / Líder / Admin
- Cuadre de Vasos
- Inventario (Conteo, Comparativa, Historial, Recetas, Configuración)
- Compras Jellyboba (historial, detalle, upload PDF, nueva orden)
- Rentabilidad (P&L: CMV Jellyboba + compras externas + gastos op.)
- Plan de Acción + Evaluaciones Periodo de Prueba
- Supervisión de Actividades
- Reportes Diarios (sync Odoo 9:30pm)
- Asistente FAQ
- Horarios/Rotación + PDF horario semanal
- Avisos Generales
- Usuarios y Roles

---

## RENTABILIDAD / CMV
- CMV = compras Jellyboba del periodo (tabla `compras`) + compras externas (`compras_externas`)
- Mat. prima (recetas) eliminada del P&L — usada solo para control de mermas
- Gastos operativos desde `fin_gastos` (fijos, nómina, variable, ingreso extra)
- Meta mensual desde `sucursales.metaVentasMensual` (auto-actualiza el 1ro de cada mes)

## COMPRAS JELLYBOBA
- 11 órdenes cargadas (OV09632 al OV09882)
- Tabla `compras` + `compras_detalle` (constraint único uq_compra_sku)
- PDFs se guardan en `/dist/public/pdfs/compras/`
- Botón "Nueva Orden" para captura manual + upload PDF
- Auto-sync desde Odoo Jellyboba: PENDIENTE

---

## SCHEDULER (server/scheduler.ts)
| Tarea | Hora UTC | Hora MX |
|---|---|---|
| Sync Odoo + reporte diario | 03:30 UTC | 21:30 CDT |
| Alerta reportes faltantes | 22:00 UTC | 16:00 CDT |
| Auto-meta mensual | 1ro del mes 06:00 UTC | — |
| Auto-horario semanal | Jueves 18:00 UTC | — |
| secof-api (viejo) | DETENIDO | — |

---

## FIXES CONOCIDOS / DEUDA TÉCNICA
1. `inventario.ts` tiene 2 warnings de llaves duplicadas: `factorConversion` (línea 1281) y `surtidoIslaConfirmar` (líneas 1452/1503) — no afectan funcionalidad, pendiente limpiar
2. `alert-dialog.tsx` error TS2657 — preexistente, no afecta build
3. `asistenteRouter` importado dos veces en routers.ts — no afecta funcionalidad

## NOTAS DE DESARROLLO
- Archivos grandes transferir vía base64: `base64 archivo | tr -d '\n' > archivo.b64` → scp → `base64 -d archivo.b64 > destino`
- Python patches: usar heredoc `python3 << 'PYEOF'` directamente en VPS
- VPS timezone: UTC → México CDT = UTC-6
- `inv_recetas` tiene 349 registros pero solo para productos "Snowtea Clásico" — pendiente cargar recetas del PDF Vs032025 para todos los productos
- `preparaciones` tabla: registra lotes de producción (base_snowtea, tapioca, jarabe_longan, sustituto_azucar) — NO individual por producto

---

## PENDIENTES
| # | Pendiente | Prioridad |
|---|---|---|
| 1 | Reporte de horas reales del equipo para cálculo de nómina | 🔴 Alta |
| 2 | Auto-sync Compras Jellyboba desde Odoo Jellyboba (sale.order) | 🟡 Media |
| 3 | Revisar/cargar recetas completas desde PDF Vs032025 | 🟡 Media |
| 4 | Descuento automático inventario desde preparaciones (ver Pronóstico Surtido) | 🟡 Media |
| 5 | Bugs warnings inventario.ts (factorConversion, surtidoIslaConfirmar) | 🟢 Baja |
| 6 | Usuario Demo: verificar login Google OAuth tiendademosnowtea@gmail.com | 🟢 Baja |
