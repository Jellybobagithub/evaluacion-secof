# ESTADO.md — SECOF Snowtea
**Última actualización:** 7 de Mayo 2026  
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
- ID 1: Plaza Portal (meta $90,000/mes) — **cierra junio 2026, se reubica**
- ID 30001: Plaza Patio (meta $135,000/mes)
- ID 60001: Tienda Demo (excluida de totales dashboard)

---

## USUARIOS Y EMPLEADOS

### Usuarios activos
| userId | name | email | role | empleadoId | sucursal |
|---|---|---|---|---|---|
| 600001 | Miguel Moreno | franquicias@snowtea.com.mx | superadmin | 120001 | Patio |
| 2580048 | Emily Medina | — | leader | 150001 | Patio |
| 4380040 | Xicochi Limón | luz.echa.e@gmail.com | host | 30001 (Luz) | Patio |
| 5492137 | alma valeria | — | host | 180001 (Alma) | Patio |
| 5490902 | Penelope | — | owner | — | — |
| 4380004 | Gerencia | — | manager | — | — |

### Empleados sin cuenta de usuario (pendiente)
- Plaza Patio: Tamara (desactivada — renunció)
- Plaza Portal: Daniela (líder), Ana, Miriam (anfitriones)

### Nota importante: MiTurno usa userId para encontrar empleado
El fix del 7-May-2026 cambió la lógica: busca primero por `e.userId === user.id`.
Si un empleado no tiene userId vinculado, no verá sus actividades en Mi Turno.

---

## ESTRUCTURA OPERATIVA SNOWTEA

| Persona | Puesto | Rol SECOF |
|---|---|---|
| Miguel Moreno | Director General | Superadmin |
| Jorge Moreno | Coordinador Adm. y Finanzas | Owner |
| Sandra Lazarín | Coordinadora Control Operativo | Manager |
| Judith Torres | Auxiliar Administrativa | Manager |
| Emily Rendón | Líder Plaza Patio | Leader |
| Daniela | Líder Plaza Portal | Leader |
| Luz / Xicochi | Anfitrión Patio | Host |
| Alma | Anfitrión Patio | Host |

---

## MÓDULOS IMPLEMENTADOS ✅

### SECOF (Evaluaciones)
- Evaluaciones: nueva, completar, historial, comparativa
- Calificación por sección y categoría con puntuacionPorSeccion JSON
- Exportar PDF de evaluación
- EvaluacionDetalle: tabs Por Categoría, Por Sección, Puntos Fallidos, Áreas de Mejora

### Plan de Acción
- CRUD completo con metodología EXPLORAR·ANALIZAR·RESOLVER·SEGUIMIENTO
- **Botón 🎯 en Historial de evaluaciones** — abre dialog con puntos fallidos (respuesta=no)
  agrupados por sección, con checkboxes para seleccionar cuáles importar
- Backend: `planAccion.previewImportacion` y `planAccion.importarDesdeEvaluacion`
  usan SECCIONES de evaluacionData.ts para obtener descripciones

### Inventario
- Tablas: inv_productos, inv_almacenes, inv_conteo_fisico, inv_conteo_detalle,
  inv_teorico, inv_teorico_detalle, inv_minmax, inv_surtidos, inv_surtido_detalle
- 72 materias primas, productos de venta, recetas, subproductos
- Conteo Físico: gramos guardados, conteo pre-carga anterior, fecha bloqueada
- **Historial: muestra fecha/hora de creación (createdAt), botón eliminar conteo**
  con dialog de confirmación y alerta roja — solo superadmin/owner/manager
- Inventario Teórico: publicar y comparar vs físico
- Comparativa: tabla con alertas, exportar Excel
- Recetas: gestión de ingredientes por producto

### Pronóstico de Surtido (`/ventas/pronostico-surtido`)
- Proyección configurable: 7/10/15/21/30 días, buffer %
- **Fuente 1**: ventas de `inv_ventas_captura` × recetas (ingredientes directos)
- **Fuente 2**: `preparaciones` tabla — tapioca en gramos reales (receta='tapioca', unidad='gr')
- **Fuente 3**: `preparaciones` → subrecetas de base_snowtea/jarabe_longan/sustituto_azucar
  usando `inv_subproductos` y `inv_subproductos_receta` dinámicamente
- **Fuente 4**: Perlas Explosivas — 46g por vaso vendido, **ponderado por stock inverso**
  (sabores con menos stock reciben mayor peso de consumo proyectado)
- Historial de surtidos con confirmación que actualiza inventario bodega
- Categorías ordenadas: Jarabes, Polvos, Tés, Toppings, Desechables, Varios

### Ventas
- Importar desde Odoo (`inv_ventas_captura`)
- Evolución de ventas con gráficas
- Metas de venta por sucursal

### Mi Turno
- Turno del día con checklist de actividades de limpieza
- Preparaciones del turno (tapioca, base, longan, sustituto)
- Modal bienvenida/cierre de turno
- KPIs semana, asistencia, SECOF %
- **Fix 7-May-2026**: busca empleado por `userId` primero (no por nombre)

### Horarios (ELIMINADO 7-May-2026)
- La página `/horarios` fue eliminada del menú y rutas
- **Rotación de Áreas** (`/rotacion-areas`) se mantiene — usa `HorariosRotacion.tsx`

### Otros módulos activos
- Reporte Diario, KPIs Anfitriones/Líder/Admin
- Control de Asistencias + QR
- Preparaciones (registro de batches con vigencia)
- Supervisión de Actividades
- Cuadre de Vasos, Rentabilidad, Finanzas
- Admin: Usuarios, Preguntas SECOF, Actividades, Permisos de menú
- Avisos Generales

---

## BASE DE DATOS — TABLAS CLAVE

### Inventario
- `inv_productos`: materias primas (activo=1 para activos)
- `inv_almacenes`: Bodega e Isla por sucursal
- `inv_conteo_fisico`: conteos semanales (estado: borrador/enviado/bloqueado)
- `inv_conteo_detalle`: líneas de conteo (cantidadPiezas, cantidadGramos)
- `inv_recetas`: producto_venta → materia prima (esSubproducto=0/1)
- `inv_subproductos`: subproductos (Base Snowtea, Longan, Tapioca 200/500/700)
- `inv_subproductos_receta`: ingredientes de cada subproducto
- `inv_ventas_captura`: ventas importadas de Odoo por productoVentaId

### Preparaciones
- `preparaciones`: receta enum('tapioca','base_snowtea','jarabe_longan','sustituto_azucar')
  cantidad varchar, unidad varchar ('gr' para tapioca, 'carga' para otros)

### Horarios/Turnos
- `turnos_semana`: turnos por empleado/fecha/sucursal con rolPrincipal
- `turno_actividades`: actividades asignadas a cada turno (clave, completada, evidenciaUrl)
- `actividades_catalogo`: catálogo de actividades (D=diaria, S=semanal, B=bodega, M=mensual)

### Empleados
- `empleados`: userId FK a users (NULL si no tiene cuenta)
- **Importante**: userId debe estar vinculado para que Mi Turno funcione

---

## PRODUCTOS ESPECIALES EN INVENTARIO

### Perlas Explosivas activas (ids 30046-30055)
- `pesoNetoPorUnidad` = 1920g (peso neto drenado por bolsa)
- `unidadCompra` = "Caja 4 pza", `factorConversion` = 4
- Consumo: 46g por vaso vendido, ponderado por stock inverso por sabor

### Tapioca 2.7kg (id 30059)
- `pesoNetoPorUnidad` = 2700g, `unidadCompra` = "Caja 6 pza"
- Consumo: desde tabla `preparaciones` WHERE receta='tapioca' AND unidad='gr'

---

## PENDIENTES

### Alta prioridad
- [ ] Crear cuentas Google para Daniela (Portal), Ana (Portal), Miriam (Portal)
      y vincular a sus registros de empleados (ids 60001, 60002, 60003)
- [ ] Verificar que Alma (userId 5492137, empleadoId 180001) ya ve sus actividades en Mi Turno

### Media prioridad  
- [ ] Base Snowtea, Jarabe Longan, Sustituto Azúcar: las "cargas" se cuentan pero
      `cantidad` es string ('carga_completa', 'media_carga') no número.
      El consumo SÍ se calcula correctamente vía subrecetas.
      Pendiente: verificar que los gramos proyectados son razonables.
- [ ] Perlas Explosivas: la distribución por sabor usa stock inverso como proxy.
      Mejorar con historial de surtidos cuando haya más datos.

### Deuda técnica
- [ ] Bundle JS muy grande (~2.3MB) — considerar code splitting en vite.config
- [ ] Plaza Portal cierra junio 2026 — planear migración de datos a nueva sucursal
- [ ] Emily tiene empleado duplicado (id=1 sin userId, id=150001 activo) — considerar borrar id=1

---

## NOTAS DE DESARROLLO

### Problemas conocidos y sus fixes
1. **removeChild Chrome**: parche en main.tsx, portales eliminados de UI components
2. **MiTurno empleado**: busca por `e.userId === user.id` primero (fix 7-May-2026)
3. **SECCIONES en routers.ts**: importar `{ calcularPuntuacion, SECCIONES }` de evaluacionData
4. **VPS vs repo**: el VPS tiene archivos que no siempre están en el repo.
   Siempre hacer `git add -A && git commit && git push` tras cambios en VPS.

### Archivos solo en VPS (no en repo histórico)
- `PronosticoSurtido.tsx`, `InventarioRecetas.tsx`, `ImportarVentasOdoo.tsx`
- `Finanzas.tsx`, `HorariosRotacion.tsx`, `EvaluacionesPeriodo.tsx`
- `server/routers/asistencia.ts`, `asistente.ts`, `evaluacionesPeriodo.ts`
- `server/routers/finanzas.ts`, `rotacion.ts`
- Desde 7-May-2026 todos están en el repo ✅

### Versión automática
- `vite.config.ts` define `__APP_VERSION__` (fecha) y `__APP_BUILD__` (fecha+hora)
- Se actualiza automáticamente en cada `pnpm build`
- Visible en sidebar footer: "SECOF v2026-05-07"
