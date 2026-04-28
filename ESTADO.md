# ESTADO.md — SECOF Snowtea
**Última actualización:** 27 de Abril 2026  
**PM2 proceso:** `secof` ID 20 — Puerto 5000  
**Dominio:** https://secof.snowteatienda.com  
**Repo:** https://github.com/Jellybobagithub/evaluacion-secof

---

## COMANDO DE INICIO PM2
```bash
cd /var/www/secof && JWT_SECRET=SnowteaSECOF2026SecretKeyJellyboba VITE_APP_ID=secof-snowtea GOOGLE_CLIENT_ID=302803392762-gg4r8ckp7ejubbt843gmj7pnlae41idq.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=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 OAUTH_SERVER_URL=https://secof.snowteatienda.com OWNER_EMAIL=franquicias@snowtea.com.mx APP_URL=https://secof.snowteatienda.com NODE_ENV=production PORT=5000 DATABASE_URL="mysql://secof_user:Snowtea2026Secof@localhost:3306/secof_db" pm2 start dist/index.js --name secof
```

---

## STACK TÉCNICO
- Frontend: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Express + tRPC + Drizzle ORM
- DB: MySQL 8.0 — `secof_db` usuario `secof_user`
- Auth: Google OAuth
- Package manager: pnpm
- Node: 20.20.2, pnpm 10.33.0
- Nginx reverse proxy + PM2

---

## SUCURSALES
- ID 1: Plaza Portal (meta $90,000/mes) — **cierra junio 2026, se reubica**
- ID 30001: Plaza Patio (meta $135,000/mes)
- ID 60001: Tienda Demo

## USUARIOS CLAVE
- Miguel Moreno: superadmin / ID 600001
- Emily Rendón: leader / ID 2580048 — Líder Plaza Patio
- Gerencia: manager / ID 4380004
- Luz: host / ID 4380040
- Penelope: owner / ID 5490902

## EMPLEADOS PLAZA PATIO
- Emily (Líder, descanso Miércoles)
- Luz (Anfitrión, descanso Martes)
- Alma (sin vincular a usuario)

---

## ESTRUCTURA EMPRESARIAL SNOWTEA (formalizada Abril 2026)

| Persona | Puesto | Rol SECOF |
|---|---|---|
| Miguel Moreno | Director General | Superadmin |
| Jorge Moreno | Coordinador Adm. y Finanzas | Owner |
| Sandra Lazarín | Coordinadora Control Operativo | Manager |
| Judith Torres | Auxiliar Administrativa (medio tiempo) | Manager |
| Emily Rendón | Líder Plaza Patio | Leader |
| Daniela | Líder Plaza Portal | Leader |
| 2 Anfitriones Patio | Anfitriones | Host |
| 2 Anfitriones Portal | Anfitriones | Host |

**Cartas de ofrecimiento firmadas:** Mayo 2026, periodo de prueba 3 meses (Mayo-Julio 2026)  
**Documentos en proyecto:** REG-RH-001-1 (Reglamento), RH-002-1 (Cartas)

---

## MÓDULOS IMPLEMENTADOS ✅

### Empleados
- Editor horario personal por día (entrada/salida) guardado como JSON
- Día de descanso fijo, botones días libres adicionales
- Fix: `horarioPersonal: z.any().optional()`, `darBaja` en frontend

### Rotación de Áreas — Fase 2
- Algoritmo bloques por solapamiento automático
- **Fix crítico:** `esManual: 0 as any` (Drizzle no acepta boolean false)
- **Fix:** DROP INDEX `uq_empleado_fecha_area` (impedía múltiples bloques)
- Router: `/var/www/secof/server/routers/rotacion.ts`

### Inventario — Módulo Completo
- Tablas: `inv_productos_venta`, `inv_recetas`, `inv_subproductos`, `inv_subproductos_receta`, `inv_ventas_captura`
- 72 materias primas, 73 productos de venta, 527 líneas de recetas, 6 subproductos
- Precios: Snowtea Clásico/Yogurt/Chamoy=$90, Fra-T=$95, Topping Extra=$15
- Comparativa: stock teórico vs físico con selector de fecha
- Frontend: `/var/www/secof/client/src/pages/Inventario.tsx`
- Frontend recetas: `/var/www/secof/client/src/pages/InventarioRecetas.tsx`

### Finanzas/Rentabilidad
- Ruta: `/finanzas`, menú: Equipo → Rentabilidad (minRole: manager)
- Tablas: `fin_precios_venta`, `fin_gastos`
- Tabs: Resumen (KPIs), Gastos (manual), Precios
- Semáforo: ≥20%=verde, ≥10%=amarillo, <10%=rojo
- Frontend: `/var/www/secof/client/src/pages/Finanzas.tsx`

### Evaluaciones Periodo de Prueba ✅ (NUEVO - Abril 2026)
- Ruta: `/evaluaciones-periodo`, menú: Configuración → Evaluaciones (minRole: manager)
- Tablas: `eval_periodos`, `eval_kpi_config`
- **32 KPIs configurados** por puesto: lider(10), control_operativo(8), adm_finanzas(7), auxiliar_admin(7)
- Tipos: automático (ventas, puntualidad, inventario, preparaciones, apertura) y manual
- Flujo: Dashboard → Nueva evaluación → Cargar KPIs → Aplicar automáticos → Score ponderado → Recomendación
- Recomendaciones: continua(>80%), extiende 30días(60-80%), concluye(<60%)
- Frontend: `/var/www/secof/client/src/pages/EvaluacionesPeriodo.tsx`
- Router: `/var/www/secof/server/routers/evaluacionesPeriodo.ts`

### Asistente SECOF ✅ (NUEVO - Abril 2026)
- Botón flotante verde en Home.tsx (dashboard principal solamente)
- Componente: `/var/www/secof/client/src/components/AsistenteSecof.tsx`
- Router: `/var/www/secof/server/routers/asistente.ts`
- BD: tabla `asistente_faq` con **44 FAQs precargadas**
- Lógica: busca en FAQ por palabras clave → si no encuentra → mensaje de ayuda
- **GEMINI BLOQUEADO:** El VPS no puede conectar a `generativelanguage.googleapis.com` (proxy de red)
- La llamada a Gemini está en el frontend como fallback pero tampoco conecta
- Gemini API Key: `AIzaSyBHXE9J60OObxS0u4x9wWTjx2MEjF6GW_g`
- **PENDIENTE:** Mejorar búsqueda de FAQs (actualmente por palabras simples, mejorar relevancia)

### Dashboard Home.tsx ✅ (ACTUALIZADO)
- Sección Rentabilidad del mes (Plaza Patio + Portal) — datos de `fin_gastos` y ventas
- Sección Evaluaciones Periodo de Prueba — 5 tarjetas con score por persona
- Asistente SECOF flotante (solo en dashboard)

### calcularRegistrosNomina
- Usa `horarioPersonal` del empleado en lugar de `TURNO_HORAS` fijo
- Ubicación: `/var/www/secof/server/db.ts`

---

## ARCHIVOS CLAVE
```
/var/www/secof/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx                    — Dashboard principal
│   │   ├── Empleados.tsx               — Gestión empleados + horarios
│   │   ├── Inventario.tsx              — Conteo físico, ventas, comparativa
│   │   ├── InventarioRecetas.tsx       — Recetas por producto
│   │   ├── Finanzas.tsx                — Rentabilidad por tienda
│   │   └── EvaluacionesPeriodo.tsx     — Evaluaciones 3 meses ✅ NUEVO
│   └── components/
│       ├── DashboardLayout.tsx         — Menú lateral, layout
│       └── AsistenteSecof.tsx          — Chat flotante ✅ NUEVO
├── server/
│   ├── routers.ts                      — Router principal (registra todos)
│   ├── db.ts                           — Helpers BD + calcularRegistrosNomina
│   └── routers/
│       ├── rotacion.ts                 — Rotación de áreas
│       ├── inventario.ts               — Módulo inventario completo
│       ├── finanzas.ts                 — Rentabilidad
│       ├── evaluacionesPeriodo.ts      — Evaluaciones periodo prueba ✅ NUEVO
│       └── asistente.ts               — FAQ + Asistente SECOF ✅ NUEVO
└── drizzle/schema.ts                   — Schema completo BD
```

---

## TABLAS BD RELEVANTES
```sql
-- Inventario
inv_productos_venta, inv_recetas, inv_subproductos, inv_subproductos_receta
inv_ventas_captura, inv_conteo_fisico

-- Finanzas
fin_precios_venta, fin_gastos

-- Evaluaciones periodo de prueba
eval_periodos, eval_kpi_config (32 KPIs configurados)

-- Asistente
asistente_faq (44 FAQs precargadas)

-- Empleados/Rotación
empleados, rotacion_areas, registro_nomina, turno_apertura
```

---

## BUGS CONOCIDOS / PENDIENTES

### Alta prioridad:
1. **Asistente SECOF — Gemini bloqueado:** El VPS no puede conectar a Gemini. Solución pendiente: abrir el dominio `generativelanguage.googleapis.com` en el proxy de red del VPS, o usar un proxy intermedio.
2. **Búsqueda FAQ mejorada:** La búsqueda actual es por palabras simples. Mejorar con búsqueda por similitud o FULLTEXT MySQL.
3. **Cash-dro / Caja:** Módulo pendiente — fondeo, arqueo, conciliación diaria
4. **Recepción de Producto:** Entradas a bodega con foto
5. **Pedidos/Compras:** Sandy captura órdenes, descuenta del inventario

### Media prioridad:
6. **Conciliación de ventas:** Tarjeta vs efectivo vs plataformas
7. **Dashboard ejecutivo simplificado:** Para Jorge y Sandy
8. **Usuarios faltantes:** Crear usuarios para Sandy, Jorge, Daniela en SECOF

### Baja prioridad:
9. **GitHub Actions:** Verificar que el workflow apunte al PM2 ID correcto (actualmente ID 20)
10. **Módulo Capacitación**
11. **Integración Odoo:** MCP en `https://crossleted-ethylic-estelle.ngrok-free.dev/sse`

---

## NEGOCIO SNOWTEA
- 2 tiendas propias + 12 franquiciatarios
- Marca Snowtea es propiedad de Miguel Moreno (Jellyboba S. de R.L. de C.V.)
- Jellyboba es proveedor principal de materia prima para todas las tiendas
- Plaza Portal cierra junio 2026 (contrato renta vence, ~$8K libres/mes no es atractivo)
- Plan: reubicar Portal a mejor ubicación después de junio
- Jorge y Sandy (padres de Miguel) en proceso de semi-retiro, se busca estructura que no dependa de ellos
- SECOF se planea implementar en las 12 tiendas franquicia a futuro
