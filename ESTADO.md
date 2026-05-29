# ESTADO SECOF — 29 mayo 2026

## Producción
- URL: secof.snowteatienda.com | PM2 id=1 | Puerto 5000 | MySQL secof_db

## Sesión 29-may-2026 — Lo que se hizo

### Módulo Control Inventario (NUEVO)
- Tab Conteo Físico: líder cuenta Bodega + Isla desde /control-inventario
- Tab Aprobación: admin ve teórico vs físico sumado (Bodega+Isla), puede devolver al líder
- Tab Historial Mermas: expandible por semana con detalle de productos
- Flujo: borrador → enviado → bloqueado (nuevo ciclo base)
- Primer ciclo aprobado: base 2026-05-26

### Recetas calibradas
- Yunnan 10kg: 39g → 54g (3 cucharas × 18g) — pendiente verificar si subir a ~85g
- Frosty 10kg: 57g → 52g (2 cucharas × 26g)
- Bases Clásico/Caliente/Chamoy: 80g por bebida (confirmado por Coco 0%)
- Bases Yogurt: 71g → 40g (media carga vs carga completa)

### Bugs corregidos
- Rotación de Áreas: sucursalId:0 hardcodeado → sucursalId:sucursalId??30001
- Preparaciones incidencia: notifyOwner sin try/catch → envuelto en try/catch
- Ana Claudia: salida sábado 23-may insertada manualmente (03:00)
- sucursalId=0 en rotacion_areas limpiados (3 registros)

### Auto-cierre turnos (NUEVO scheduler)
- Corre diario a las 6:00 AM México (12:00 UTC)
- Detecta empleados con entrada sin salida del día anterior
- Inserta salida con horaFin del turno programado (default 03:00)
- Envía email a líderes/managers/admins + push al dueño

## Pendientes activos
1. Nómina — reporte horas reales desde ajustes eventuales + turnos_semana
2. Usuario Demo — Gmail para sucursalId=60001
3. Rentabilidad — conectar getKpiRentabilidad con costos reales
4. Cuadre de Vasos — definir flujo y propósito
5. Scheduling Phase 2 — timeline visual traslapes
6. KPI merma ciclo cerrado → módulo KPIs Líder (conectar)
7. Yunnan receta — confirmar con Emily si 54g es correcto o subir a ~85g
8. Frosty receta — verificar gramos reales con Emily
9. Galletas Oreo / Leche Soya / Film Sellado — registrar entradas faltantes en Recepción de Mercancía

## Notas técnicas
- inventarioCicloRouter: nuevos endpoints (almacenes, productosActivos, iniciarConteo,
  guardarConteo, enviarConteo, getConteoSemana, comparacionPendiente v2,
  aprobarConteo v2, rechazarConteo, historialConteoDetalle, historialMermas v2)
- ControlInventario.tsx: 4 tabs (Stock Teórico, Conteo Físico, Aprobación, Historial)
- Bug recurrente: Python patches escapan \${ en template literals → usar sed o fix manual
- Inventario.tsx restringido a manager+ (líderes ya no pueden entrar)
