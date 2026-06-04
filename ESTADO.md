# ESTADO SECOF — 04 junio 2026

## Producción
- URL: secof.snowteatienda.com | PM2 id=1 | Puerto 5000 | MySQL secof_db

## Sesión 04-jun-2026 — Lo que se hizo

### Actividades de Limpieza (CORREGIDO)
- Scheduler semanal ahora asigna solo 18 actividades `todas` por turno
- `generarRotacionDia` agrega actividades por área al empleado dominante (más minutos)
- Lógica área dominante: caja_y_preparacion split 50/50, gana quien tenga más minutos totales
- DELETE+INSERT al regenerar (no INSERT IGNORE) para recalcular limpio
- UNIQUE constraint en turno_actividades(turnoId, actividadClave)

### Control Inventario — Ciclo Jun-04
- Movimientos venta_odoo faltantes May 27-Jun 3 insertados manualmente (216 registros)
- Conteo Isla Jun-04 insertado vía SQL (no se guardó desde la UI)
- Ciclo aprobado: nueva base 2026-06-04 (Bodega id=56 + Isla id=57, ambos bloqueados)
- Conteo Jun-01 Isla descartado (quedó huérfano sin Bodega par)

### Otros fixes
- Email Emily en REPORT_EMAILS: emilyaylinms@gmail.com → lider.patio.snowtea@gmail.com
- PDF Rotación de Áreas: rediseñado como grid semanal (empleados × días con colores por área)
- Rotación de Áreas: sucursalId:0 → sucursalId:sucursalId??30001 en editarDia
- Preparaciones incidencia: notifyOwner envuelto en try/catch
- Ana Claudia: salida sábado 23-may insertada manualmente

### Problema recurrente identificado
- Sync nocturno Odoo no corrió May 27-Jun 3 (8 días) — proceso reiniciado 23+ veces
- Causa: setTimeout se resetea con cada restart de PM2
- Solución pendiente: migrar a cron job real

## Pendientes activos
1. Nómina — reporte horas reales desde ajustes eventuales + turnos_semana
2. Rentabilidad — conectar getKpiRentabilidad con costos reales de recetas
3. Cuadre de Vasos — definir flujo y propósito
4. Scheduling Phase 2 — timeline visual traslapes
5. KPI merma ciclo cerrado → módulo KPIs Líder
6. Historial detalle: teórico histórico muestra 0
7. Quitar selector de sucursal en módulos individuales

## Notas técnicas
- inv_conteo_fisico: columnas liderId, anfitrionId (NO creadoPorId)
- turno_actividades: UNIQUE KEY uq_turno_clave (turnoId, actividadClave)
- Sync nocturno: syncVentasDia corre vía setTimeout — vulnerable a reinicios PM2
- Isla almacenId=2 (piezas_gramos), Bodega almacenId=1 (piezas)
- REPORT_EMAILS en .env (no en DB) — requiere restart para cambios
