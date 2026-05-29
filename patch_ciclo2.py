#!/usr/bin/env python3
"""Ejecutar: python3 /var/www/secof/patch_ciclo2.py"""

TARGET = "/var/www/secof/server/routers/inventarioCiclo.ts"
BACKUP = TARGET + ".bak2"

# Restaurar backup si existe
import os
if os.path.exists(BACKUP):
    with open(BACKUP, "r") as f:
        content = f.read()
    print("Restaurado desde backup")
else:
    with open(TARGET, "r") as f:
        content = f.read()

# Guardar nuevo backup
with open(BACKUP, "w") as f:
    f.write(content)

# Verificar que NO estén ya los nuevos procedimientos
if "getConteoSemana" in content:
    print("AVISO: procedimientos ya existen. Nada que hacer.")
    exit(0)

# Agregar getSemanaISO si no existe
if "getSemanaISO" not in content:
    helper = (
        "function getSemanaISO(date = new Date()): string {\n"
        "  const d = new Date(date);\n"
        "  d.setUTCHours(12, 0, 0, 0);\n"
        "  const dow = d.getUTCDay();\n"
        "  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));\n"
        "  const year = d.getUTCFullYear();\n"
        "  const soy = new Date(Date.UTC(year, 0, 1));\n"
        "  const wn = Math.ceil(((d.getTime() - soy.getTime()) / 86400000 + soy.getUTCDay() + 1) / 7);\n"
        "  return `${year}-W${String(wn).padStart(2, \"0\")}`;\n"
        "}\n\n"
    )
    content = content.replace("type SM = ", helper + "type SM = ", 1)
    print("getSemanaISO agregado")
else:
    print("getSemanaISO ya existe")

# Construir los nuevos procedimientos usando concatenacion para evitar problemas con backticks
BT = "`"  # backtick limpio

procs = (
    "\n"
    "  almacenes: protectedProcedure\n"
    "    .input(z.object({ sucursalId:z.number() }))\n"
    "    .query(async ({ input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    f"      const r = await db.execute(sql{BT}SELECT id, nombre, tipo FROM inv_almacenes WHERE sucursalId=${'{'}input.sucursalId{'}'} AND activo=1 ORDER BY nombre{BT});\n"
    "      return r[0] as any[];\n"
    "    }),\n"
    "\n"
    "  productosActivos: protectedProcedure\n"
    "    .query(async () => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    f"      const r = await db.execute(sql{BT}SELECT id, nombre, categoria, unidadConteo, puedeAbrirse, pesoNetoPorUnidad as pesoNeto FROM inv_productos WHERE activo=1 ORDER BY categoria, nombre{BT});\n"
    "      return r[0] as any[];\n"
    "    }),\n"
    "\n"
    "  iniciarConteo: protectedProcedure\n"
    "    .input(z.object({ sucursalId:z.number(), almacenId:z.number(), fechaConteo:z.string() }))\n"
    "    .mutation(async ({ ctx, input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    "      const semana = getSemanaISO(new Date(input.fechaConteo + \"T12:00:00\"));\n"
    f"      const ex = await db.execute(sql{BT}SELECT id, estado FROM inv_conteo_fisico WHERE sucursalId=${'{'}input.sucursalId{'}'} AND almacenId=${'{'}input.almacenId{'}'} AND semana=${'{'}semana{'}'} AND estado IN ('borrador','enviado') ORDER BY id DESC LIMIT 1{BT});\n"
    "      const existing = (ex[0] as any[])[0];\n"
    "      if (existing) return { conteoId: existing.id, estado: existing.estado };\n"
    f"      const ins = await db.execute(sql{BT}INSERT INTO inv_conteo_fisico (sucursalId, almacenId, semana, fechaConteo, liderId, estado) VALUES (${'{'}input.sucursalId{'}'}, ${'{'}input.almacenId{'}'}, ${'{'}semana{'}'}, ${'{'}input.fechaConteo{'}'}, ${'{'}ctx.user.id{'}'}, 'borrador'){BT});\n"
    "      return { conteoId: (ins[0] as any).insertId, estado: 'borrador' };\n"
    "    }),\n"
    "\n"
    "  guardarConteo: protectedProcedure\n"
    "    .input(z.object({ conteoId:z.number(), lineas:z.array(z.object({ productoId:z.number(), cantidadPiezas:z.number(), cantidadGramos:z.number().default(0) })) }))\n"
    "    .mutation(async ({ input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    f"      const ct = await db.execute(sql{BT}SELECT estado FROM inv_conteo_fisico WHERE id=${'{'}input.conteoId{'}'}{BT});\n"
    "      if ((ct[0] as any[])[0]?.estado !== 'borrador') throw new TRPCError({code:\"BAD_REQUEST\", message:\"Conteo no editable\"});\n"
    f"      await db.execute(sql{BT}DELETE FROM inv_conteo_detalle WHERE conteoId=${'{'}input.conteoId{'}'}{BT});\n"
    "      for (const l of input.lineas) {\n"
    f"        await db.execute(sql{BT}INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${'{'}input.conteoId{'}'}, ${'{'}l.productoId{'}'}, ${'{'}l.cantidadPiezas{'}'}, ${'{'}l.cantidadGramos{'}'} ){BT});\n"
    "      }\n"
    "      return { ok: true };\n"
    "    }),\n"
    "\n"
    "  enviarConteo: protectedProcedure\n"
    "    .input(z.object({ conteoId:z.number(), notas:z.string().optional() }))\n"
    "    .mutation(async ({ input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    f"      const r = await db.execute(sql{BT}UPDATE inv_conteo_fisico SET estado='enviado', notas=${'{'}input.notas ?? null{'}'} WHERE id=${'{'}input.conteoId{'}'} AND estado='borrador'{BT});\n"
    "      if ((r[0] as any).affectedRows === 0) throw new TRPCError({code:\"BAD_REQUEST\", message:\"No se pudo enviar\"});\n"
    "      return { ok: true };\n"
    "    }),\n"
    "\n"
    "  getConteoSemana: protectedProcedure\n"
    "    .input(z.object({ sucursalId:z.number(), almacenId:z.number() }))\n"
    "    .query(async ({ input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    "      const semana = getSemanaISO();\n"
    f"      const ctR = await db.execute(sql{BT}SELECT id, estado, fechaConteo, notas FROM inv_conteo_fisico WHERE sucursalId=${'{'}input.sucursalId{'}'} AND almacenId=${'{'}input.almacenId{'}'} AND semana=${'{'}semana{'}'} ORDER BY id DESC LIMIT 1{BT});\n"
    "      const ct = (ctR[0] as any[])[0];\n"
    "      if (!ct) return { conteo: null, detalles: [] };\n"
    f"      const detR = await db.execute(sql{BT}SELECT productoId, cantidadPiezas, cantidadGramos FROM inv_conteo_detalle WHERE conteoId=${'{'}ct.id{'}'}{BT});\n"
    "      return { conteo: ct, detalles: detR[0] as any[] };\n"
    "    }),\n"
    "\n"
)

# Insertar antes del cierre `});`
content = content.rstrip()
if not content.endswith("});"):
    print("ERROR: el archivo no termina en '});'")
    print("Ultimos 30 chars:", repr(content[-30:]))
    exit(1)

content = content[:-3] + procs + "});"

with open(TARGET, "w") as f:
    f.write(content)

print("OK - 6 procedimientos agregados")
print("Ahora corre: cd /var/www/secof && pnpm run build && pm2 restart 1")
