# ESTADO SECOF — 23 Mayo 2026

## Stack
- Frontend: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Express + tRPC + Drizzle ORM + MySQL 8.0
- Auth: Google OAuth
- Deploy: PM2 id=1, puerto 5000, Nginx, Vultr 216.238.81.192
- Dominio: secof.snowteatienda.com
- Repo: Jellybobagithub/evaluacion-secof (main)

## Sucursales
- Plaza Portal: id=1, activa=0 (cerrando ~jun 2026)
- Plaza Patio:  id=30001, activa=1, meta $135,000/mes
- Tienda Demo:  id=60001, activa=1 (pruebas)

## Módulos activos (resumen)

### Inventario — Ciclo Cerrado ✅ NUEVO (23-may-2026)
- Página: `/control-inventario`, minRole=leader
- Router backend: `server/routers/inventarioCiclo.ts`
- Endpoints: stockTeorico, comparacionPendiente, aprobarConteo, historialMermas, kpiResumen
- Flujo: conteo físico (enviado) → comparación vs teórico → aprobación owner (bloqueado) → nueva base
- Fórmula: base_conteo + entradas(inv_movimientos) - consumo(consumo_preparacion) = stock teórico
- Toggle vista piezas/gramos
- Fuente consumo seleccionable: preparaciones reales / ventas×recetas / ambas
- Umbrales merma: OK <2%, Atención 2-5%, Crítico >5%

### Pronóstico de Surtido ✅ MODIFICADO
- Botón "Guardar como pedido" → ahora genera PDF para imprimir sin tocar inventario
- Muestra productos con stock aunque no tengan ventas (tiendas sin historial)

### Recepción de Mercancía ✅ NUEVO
- Página: `/recepcion-mercancia`, minRole=leader
- Tab Jellyboba: lista OVs sin costos + modal recibir completo
- Tab Compras Externas: historial por periodo sin costos + botón recibir
- Al confirmar recepción: actualiza inv_conteo_detalle del último conteo bloqueado + inv_movimientos

### Compras Jellyboba ✅ MODIFICADO
- Botón borrar OV (solo pendientes, no recibidas)
- Selector global de tienda vía SucursalContext
- Al confirmar recepción: actualiza inv_conteo_fisico + inv_movimientos automáticamente

### Compras Externas ✅ MODIFICADO
- Campo inv_productoId añadido a tabla compras_externas
- Al recibir: actualiza inv_conteo_detalle + inv_movimientos
- Conceptos rápidos: Hielos, Film, Azúcar, Leche Soya, Galletas Oreo, Galletas Chai Oreo, Popote PLA

### Selector Global de Tienda ✅ NUEVO
- Contexto: `client/src/context/SucursalContext.tsx`
- Persiste en localStorage
- Aparece en sidebar inferior izquierdo ("Tienda Activa")
- Módulos que lo consumen: ComprasJellyboba, ComprasExternas, RecepcionMercancia, ControlInventario

## Acceso por rol

### Leader ve:
- SECOF: Resumen, Nueva Evaluación, Historial, Plan de Acción
- Ventas: Reporte Diario
- Equipo: Mi Turno, Preparaciones, Rotación, Checador QR, Control Asistencias, KPIs Anfitriones, KPIs Líder, Cuadre de Vasos, Inventario, Recepción de Mercancía, Control Inventario, Supervisión
- Colaboradores: Empleados, Usuarios y Roles

### Manager ve todo lo anterior + :
- Pronóstico de Surtido, Compras Jellyboba, Compras Extras, Rentabilidad, Evolución de Ventas, Importar Ventas, KPIs Admin, Evaluaciones, Sucursales, Empleados, Avisos

## Mapeos SKU Jellyboba (compras_sku_mapping)
Completos: JAR07→30036, TAP04→30059, PEX08→30052, PEX10→30053, POL05→30058, POL-FROSTY→30043, POL01→30063, POL03→30062, POL04→30038, TAPC01/02→30059, JARC01-13→jarabes, PEXC01-09→perlas, VAS01/VASO20→30067, YUN01/YUNNAN→30068, POPOTE→30060, AZUCAR→30061

## DB — Cambios recientes
- compras_externas: + inv_productoId INT NULL, + recibida_at DATETIME NULL
- inv_conteo_detalle: se actualiza automáticamente al recibir OVs y compras externas

## Servicios PM2
- id=0: secof-api (deprecada, stopped)
- id=1: secof (activo, puerto 5000)
- id=2: noche-fotos
- id=3: snowtea-mcp (puerto 8001, ngrok parking-harpist-overstep)
- id=4: snowtea-ngrok

## Pendientes
1. **Nómina** — reporte horas reales del equipo para C&H (ajustes eventuales + turnos_semana)
2. **Usuario Demo** — crear Gmail, vincular a sucursalId=60001
3. **Rentabilidad** — conectar getKpiRentabilidad con costos reales de recetas
4. **Cuadre de Vasos** — analizar para qué sirve, revisar nivel de acceso
5. **Scheduling Phase 2** — timeline visual de traslape de turnos
6. **KPI Merma → KPIs Líder** — conectar % merma del ciclo cerrado al módulo KPIs Nivel 2

## Notas técnicas importantes
- getStock() en inventario.ts: usa solo estado='bloqueado' como base del pronóstico
- SucursalContext: contexto React global para tienda activa, persiste en localStorage
- confirmarRecepcion (comprasJellyboba): actualiza inv_conteo_detalle del último conteo bloqueado
- Drizzle ORM: imports faltantes causan queries vacías sin error
- inventarioCiclo.ts: imports desde "../_core/trpc" y "../db" (no "../_core/db")
- Scheduler/cron: frágil, restaurar como standalone antes de envolver con initScheduler
