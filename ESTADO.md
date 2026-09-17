# ESTADO SECOF — 17 sep 2026

## ✅ RESUELTO 2026-09-17 — ecosystem.config.cjs fuera de git + 3 secretos rotados
`ecosystem.config.cjs` (con `DATABASE_URL`/`JWT_SECRET`/`GOOGLE_CLIENT_SECRET`
en texto plano) estaba trackeado en git desde mayo — se sacó del tracking
(`.gitignore` + `ecosystem.config.example.cjs` sin secretos, commit local
`faac7b5`, sin pushear). Se rotaron los 3 secretos y ahora viven SOLO en
`.env` (`ecosystem.config.cjs` ya no carga ninguno). **Gotcha real
encontrado**: `pm2 restart --update-env` NO limpia env vars quitadas del
archivo (solo agrega/actualiza, nunca borra) — quedó sirviendo el password
viejo hasta hacer `pm2 delete secof && pm2 start ecosystem.config.cjs` (arranque
limpio). **Bug latente destapado** por rotar `JWT_SECRET` (forzó
re-login a todos): `VITE_APP_ID` nunca estuvo seteado → `appId` del JWT
siempre vacío → `verifySession` lo rechazaba → login válido pero rebotaba a
inicio. Fix: `VITE_APP_ID=secof` agregado a `.env`. Login real probado y
confirmado por Miguel end-to-end. Pendiente: deshabilitar en Google Cloud
Console el secreto viejo `****LYwh` (el nuevo ya está en uso) — Miguel debe
hacerlo desde la consola.

## 🔴 INCIDENTE RESUELTO 2026-09-16 — nadie podía entrar (login con Google regresaba a inicio)
Causa: `DATABASE_URL` vivía en **3 lugares distintos y desincronizados** —
`.env` (correcto, password rotado 15-sep), el env cacheado del proceso PM2 vivo
(password viejo + host `localhost`, de un `pm2 save`/resurrect anterior), y
`ecosystem.config.cjs` en disco (un tercer password, aún más viejo). El proceso
vivo usaba el cacheado (el peor de los 3) → cada login fallaba en el paso de
crear/leer el usuario en MySQL tras el OAuth de Google, con "Access denied for
user 'secof_user'@'localhost'" en el log.
**Fix**: `ecosystem.config.cjs` corregido con el password real (el de `.env`,
verificado por CLI), `pm2 restart ecosystem.config.cjs --only secof --update-env`
+ `pm2 save` para que quede persistido. Verificado: 0 errores desde el restart
(19:20 UTC) y el sync nocturno volvió a escribir en BD sin problema.
**Pendiente de seguridad, no bloqueante**: `ecosystem.config.cjs` tiene
`DATABASE_URL`/`JWT_SECRET`/`GOOGLE_CLIENT_SECRET` en texto plano y está
**trackeado en git** (commit `dfd3245`, mayo 2026) — mismo patrón de riesgo que
el incidente de la key "secofpdf". Recomendación: mover estos valores a `.env`
(que si está gitignored) y quitar `ecosystem.config.cjs` del tracking, o al
menos rotar estos 3 secretos si el repo es público/compartido. Backup del
archivo previo al fix en `ecosystem.config.cjs.bak-20260916-*`.
También nota: hay un `/var/log/pm2/secof-error.log` viejo (abril 2026, no se
actualiza) que quedó de una config de logs que `ecosystem.config.cjs` declara
pero PM2 nunca aplicó sobre el proceso ya existente — no confundir con el log
real (`/root/.pm2/logs/secof-error.log`).

## Producción
- URL: secof.snowteatienda.com
- VPS: 216.238.81.192 | PM2 id=2 (name "secof") | port 5000
- DB: secof_db (MySQL 8.0)
- Repo: github.com/Jellybobagithub/evaluacion-secof

## Sucursales activas
- Plaza Patio (sucursalId=30001) — activa
- Plaza Portal (sucursalId=1) — CERRADA jun 2026

---

## Completados sesión 27-ago-2026

- ~~Correo diario sin desglose de medios de pago (reincidente)~~ — CAUSA RAÍZ
  encontrada: NO era un bug del código nuevo. Había un **script zombie
  duplicado** en `/opt/secof-sync-diario.mjs` (del 14-may-2026, previo a que
  el sync se integrara al scheduler interno de la app) corriendo TODAS LAS
  NOCHES a las 22:15 UTC vía crontab de root:
  `15 22 * * * node --env-file=/opt/secof-sync.env /opt/secof-sync-diario.mjs`
  - Ese script usa `price_subtotal` (sin IVA, no `price_subtotal_incl`), no
    tiene el ajuste de timezone UTC→CDT (fix del 19-ago), y nunca tuvo el
    desglose de medios de pago. Cada noche sobreescribía el total correcto
    que el scheduler interno ya había calculado a las 03:30 UTC, y mandaba
    su propio correo duplicado con plantilla vieja (de ahí el "🏆 Top 5
    productos" y "(X% meta)" en el asunto que no existen en
    `emailService.ts`).
  - **Cron deshabilitado** (comentado, no borrado, en crontab de root) —
    2026-08-27.
  - **Datos corregidos**: el patrón (`updatedAt` a las 22:15:0X UTC en
    reportes_diarios) mostraba que TODOS los días del 10 al 25-ago habían
    sido sobreescritos por el script viejo cada noche desde que empezó el
    patrón. Se borraron y resincronizaron esos 16 días vía el pipeline
    correcto (`syncVentasDia`, sin reenviar correo). Totales corregidos
    (antes → después), todos con IVA real:
    10-ago $6,599→$5,510 · 11 $5,526→$7,115 · 12 $4,267→$6,595 · 13
    $6,306→$4,320 · 14 $6,000→$9,495 · 15 $9,225→$13,670 · 16
    $15,259→$25,190 · 17 $15,263→$5,715 · 18 $3,897→$4,145 · 19
    $5,224→$6,780 · 20 $4,729→$6,115 · 21 $8,569→$11,025 · 22
    $8,910→$11,685 · 23 $14,871→$16,075 (sin cambio real) · 24
    $7,151→$4,695 (coincide con el validado manualmente el 24-ago en la
    sesión anterior) · 25 $3,737→$6,635.
  - **Impacto**: esto afectaba "Avance meta del mes" en la app y en los
    correos desde que empezó el patrón (10-ago en adelante, posiblemente
    desde antes — no se auditó 1-9 ago, ver pendiente abajo).
  - Verificadas las 16 filas antes de borrar: 0 datos manuales (apertura,
    cierre, incidentes, etc. todo NULL) — son 100% generadas por Odoo, no
    se perdió captura de nadie.

### ✅ RESUELTO 2026-09-15 — `.env` DATABASE_URL tenía password desactualizado
El password que tenía `/var/www/secof/.env` daba "Access denied" real
(confirmado con mysql CLI directo, dos veces) — coincidía con el que tenía
hardcodeado el script viejo `/opt/secof-sync-diario.mjs`, que ya tampoco es
válido. Password corregido en el `.env` real. **Se probó el escenario de
riesgo exacto**: `pm2 restart secof` con Miguel presente — levantó limpio,
0 errores, conexión a MySQL verificada tras el restart (CLI directo + la
propia app). Backup del `.env` viejo en
`/var/www/secof/.env.bak-password-fix-20260915` (también tiene el password
viejo, mismo tratamiento — no exponerlo).

### ✅ ROTADO 2026-09-15 — password de `secof_user` cambiado por uno nuevo
A petición de Miguel, se generó un password nuevo (aleatorio, 28 caracteres)
y se rotó en MySQL para **ambas cuentas** `secof_user@127.0.0.1` y
`secof_user@localhost` (existían dos cuentas separadas con el mismo nombre —
la app usa la de `@127.0.0.1` vía `DATABASE_URL`; se sincronizaron ambas
para no repetir el mismo lío). `.env` actualizado, `pm2 restart secof`
probado y verificado limpio. El password viejo (`Snowtea2026Secof`) ya NO
conecta — confirmado. **El valor del password nuevo NUNCA se escribe aquí**
— vive solo en `/var/www/secof/.env` (no en git) y se le dio a Miguel por
chat una sola vez para que lo guarde en su gestor de contraseñas. Backup
del `.env` previo a la rotación en
`/var/www/secof/.env.bak-password-rotate-20260915`.
- ~~**Auditar agosto 1-9**~~ — **RESUELTO 2026-09-15.** Confirmado: los 9 días
  tenían el mismo bug del script zombie (cifras redondas, todos modificados
  al mismo segundo 2026-08-10 22:33:13). Verificado primero que los 9
  registros no tenían NADA de captura manual (apertura/cierre/incidentes/
  caja todo NULL/0) — mismo chequeo que se hizo con los 16 días de la
  sesión anterior. Borrados y resincronizados vía `syncVentasDia` (el
  pipeline real, con IVA y timezone correctos), con permiso explícito de
  Miguel antes de tocar datos de producción. Totales corregidos (antes →
  después): 1-ago $11,080→$13,445 · 2 $18,755→$21,570 · 3 $11,125→$5,355 ·
  4 $6,390→$6,090 · 5 $5,400→$6,030 · 6 $7,125→$6,870 · 7 $8,315→$8,230 · 8
  $9,775→$11,195 · 9 $13,280→$13,190.

---

## Completados sesión 25-ago-2026

- ~~Reporte diario email: desglose por medio de pago~~ — nuevo bloque
  "Medios de pago" (Efectivo vs Tarjeta/otros, con % del día y tabla por
  método individual: CashDro, Tarjeta Debito, Tarjeta Credito, Uber Eats,
  Rappi). Clasificación usa `is_cash_count` de `pos.payment.method` en Odoo
  (no nombres hardcodeados) → robusto si se agrega/renombra un método.
  - `odooService.fetchVentasOdoo` ahora también trae `pagos: OdooPago[]`
    (fecha, metodo, esEfectivo, monto) vía `pos.payment` filtrado por las
    mismas órdenes que ya se usaban para las líneas de venta.
  - `syncService.ts` agrega `efectivo`, `tarjetaOtro`, `desglosePagos[]` a
    `ReporteDiarioData`.
  - `emailService.ts` renderiza el bloque nuevo entre "Avance meta" y "Top 5
    productos".
  - Validado con datos reales 24-ago-2026: $2,760 efectivo + $1,935
    tarjeta = $4,695 (== ventasTotales exacto). Build (`npm run build`) +
    `pm2 restart secof` hechos, servicio online.
  - CONFIRMADO 27-ago-2026: el correo del sync nocturno (03:30 UTC) sí trae
    el desglose bien formateado. El correo sin desglose que Miguel vio el
    26-ago era del cron duplicado en /opt/secof-sync-diario.mjs, ya
    deshabilitado (ver seccion 27-ago arriba).

## Completados sesión 19-ago-2026

- ~~puntualidad timezone UTC→CDT~~ — kpiService.ts usa CONVERT_TZ para TIMESTAMPDIFF correcto (commit bf2a061)
- ~~Email reportes diarios: emails duplicados~~ — backfill pasa `enviarEmail=false` (commit aa13bee)
- ~~Email reportes diarios: ventas incorrectas~~ — timezone fix en odooService.ts, filtra solo POS Patio (config_id=2), usa price_subtotal_incl (commit 18789c4)
- ~~Email reportes diarios: meta incorrecta~~ — usa metas_mensuales en lugar de sucursales.metaVentasMensual (commit 18789c4)
- ~~Reenvío correos 15-19 ago~~ — 5 reportes corregidos enviados a supervisor (script manual)
- ~~PDF Emily Mes 2~~ — 74.3% RIESGO, puntualidad 5.1%, SECOF 84.7% (storage/pdfs/emily_eval_mes2_jun2026.pdf)
- ~~OV10085 marcada recibida~~ — sin afectar inventario (sin inv_surtidoId, solo recibida=1)
- ~~guardarGastos not defined~~ — Finanzas.tsx tenía mutation faltante + monto como string
- ~~Finanzas sucursal selector~~ — usa useSucursal() global como los demás módulos
- ~~CMV query column names~~ — finanzas.ts: cantidadGramos, materiasPrimaId, precioXUnidad
- ~~Gastos abril-julio cargados~~ — copiar mes anterior funciona para todos los gastos

---

## Pendientes — alta prioridad 🔴

### Bugs (código)
1. ~~`puntualidadPct` hardcodeado al 95%~~ — COMPLETADO 11-jun-2026 (JOIN asistencia×turnos_semana, tolerancia 10 min)
2. ~~`reportes_diarios` sync incompleto — 10 productos sin mapear~~ — COMPLETADO 12-jun-2026 (9 productos insertados en inv_productos_venta + "2 x 140 Refresher" al SKIP de odooService)
6. ~~Historial detalle: teórico histórico muestra 0~~ — COMPLETADO 12-jun-2026 (historialConteoDetalle calcula teo desde conteo anterior bloqueado + entradas/consumo del ciclo)

### Infraestructura
15. ~~Migrar nightly Odoo sync de setTimeout a cron real~~ — COMPLETADO 12-jun-2026 (programarSyncNocturno apunta 03:30 UTC exacto + backfill de 7 días al arranque)

---

## Pendientes — media prioridad 🟡

### Bugs (código)
3. `metas_mensuales.baseAnterior` incorrecto — sincronizar desde `ventas_historicas`

### Datos
4. ~~Ana Claudia (empleadoId=180006) — cambiar `tipoContrato` de `fulltime` a `finde`~~ —
   **RESUELTO, verificado 2026-09-15 en BD**: ya es `finde` (y además `activo=0`).
5. ~~Luz — confirmar baja formal en sistema~~ — **RESUELTO, verificado 2026-09-15
   en BD**: ya `activo=0`.

### Features
7. KPI frecuencia evaluaciones semanales — agregar al snapshot del líder (ej. Emily: 2/5 semanas)
8. ~~Campo `responsable` en `plan_accion` — NULL en todos los registros~~ —
   **RESUELTO, verificado 2026-09-15 en BD**: 0 de 17 registros con `responsable`
   NULL, todos poblados. (Separar dueño vs líder, si sigue haciendo falta, es
   un pendiente distinto — no verificado.)

---

## Pendientes — baja prioridad ⚪

### QA / Playwright (2026-08-25)
- SECOF es 100% Google OAuth (confirmado en código: cero bcrypt/password en
  todo `server/_core`), sin login de email/contraseña en absoluto — un
  usuario se auto-crea (`upsertUser`) la primera vez que entra con su cuenta
  de Gmail, y un admin le asigna rol/sucursal después desde
  `AdminUsuarios.tsx` (`adminUsuarios.updateRole`/`assignSucursal`). No hay
  `crear` en ese router por diseño (no por feature faltante).
- El QA de Playwright para SECOF NO puede ser un simple usuario+contraseña
  como PULSO/MANTTO/jellyboba-web — necesita una cuenta de Gmail real. Plan
  acordado con Miguel (sin implementar, sin urgencia, NO tocar hasta que le
  toque el turno):
  1. Miguel decide entre (a) Gmail nuevo dedicado (ej. `secof-qa@gmail.com`)
     o (b) reusar la cuenta demo de `sucursalId=60001` que ya existe.
  2. Miguel se loguea manualmente UNA vez con esa cuenta en SECOF.
  3. Se guarda esa sesión/cookie (`storageState` de Playwright) y las
     corridas la reutilizan en vez de automatizar el login de Google cada
     vez — evita que Google marque los logins repetidos como bot.
  - **Explícitamente descartado**: quitar Google OAuth de SECOF en
    producción para facilitar pruebas.

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
