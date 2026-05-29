#!/usr/bin/env python3
"""
Ejecutar en el VPS: python3 patch_ciclo.py
Agrega los 6 nuevos procedimientos a inventarioCicloRouter.ts
"""

import os

TARGET = "/var/www/secof/server/routers/inventarioCiclo.ts"
BACKUP = TARGET + ".bak2"

with open(TARGET, "r") as f:
    content = f.read()

# Guardar backup
with open(BACKUP, "w") as f:
    f.write(content)
print(f"Backup guardado en {BACKUP}")

# Verificar que ya tiene getSemanaISO (del patch anterior)
if "getSemanaISO" not in content:
    # Agregar helper antes de `type SM`
    helper = '''function getSemanaISO(date = new Date()): string {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const year = d.getUTCFullYear();
  const soy = new Date(Date.UTC(year, 0, 1));
  const wn = Math.ceil(((d.getTime() - soy.getTime()) / 86400000 + soy.getUTCDay() + 1) / 7);
  return `${year}-W${String(wn).padStart(2, "0")}`;
}

'''
    content = content.replace("type SM = ", helper + "type SM = ", 1)
    print("getSemanaISO agregado")
else:
    print("getSemanaISO ya existe — OK")

# Verificar que NO están ya los nuevos procedimientos
if "getConteoSemana" in content:
    print("AVISO: los procedimientos ya existen, no se volverán a agregar.")
    exit(0)

new_procs = r"""
  almacenes: protectedProcedure
    .input(z.object({ sucursalId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const r = await db.execute(sql`SELECT id, nombre, tipo FROM inv_almacenes WHERE sucursalId=${input.sucursalId} AND activo=1 ORDER BY nombre`);
      return r[0] as any[];
    }),

  productosActivos: protectedProcedure
    .query(async () => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const r = await db.execute(sql`SELECT id, nombre, categoria, unidadConteo, puedeAbrirse, pesoNetoPorUnidad as pesoNeto FROM inv_productos WHERE activo=1 ORDER BY categoria, nombre`);
      return r[0] as any[];
    }),

  iniciarConteo: protectedProcedure
    .input(z.object({ sucursalId:z.number(), almacenId:z.number(), fechaConteo:z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const semana = getSemanaISO(new Date(input.fechaConteo + "T12:00:00"));
      const ex = await db.execute(sql`SELECT id, estado FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${input.almacenId} AND semana=${semana} AND estado IN ('borrador','enviado') ORDER BY id DESC LIMIT 1`);
      const existing = (ex[0] as any[])[0];
      if (existing) return { conteoId: existing.id, estado: existing.estado };
      const ins = await db.execute(sql`INSERT INTO inv_conteo_fisico (sucursalId, almacenId, semana, fechaConteo, liderId, estado) VALUES (${input.sucursalId}, ${input.almacenId}, ${semana}, ${input.fechaConteo}, ${ctx.user.id}, 'borrador')`);
      return { conteoId: (ins[0] as any).insertId, estado: 'borrador' };
    }),

  guardarConteo: protectedProcedure
    .input(z.object({ conteoId:z.number(), lineas:z.array(z.object({ productoId:z.number(), cantidadPiezas:z.number(), cantidadGramos:z.number().default(0) })) }))
    .mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const ct = await db.execute(sql`SELECT estado FROM inv_conteo_fisico WHERE id=${input.conteoId}`);
      if ((ct[0] as any[])[0]?.estado !== 'borrador') throw new TRPCError({code:"BAD_REQUEST", message:"Conteo no editable"});
      await db.execute(sql`DELETE FROM inv_conteo_detalle WHERE conteoId=${input.conteoId}`);
      for (const l of input.lineas) {
        await db.execute(sql`INSERT INTO inv_conteo_detalle (conteoId, productoId, cantidadPiezas, cantidadGramos) VALUES (${input.conteoId}, ${l.productoId}, ${l.cantidadPiezas}, ${l.cantidadGramos})`);
      }
      return { ok: true };
    }),

  enviarConteo: protectedProcedure
    .input(z.object({ conteoId:z.number(), notas:z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const r = await db.execute(sql`UPDATE inv_conteo_fisico SET estado='enviado', notas=${input.notas ?? null} WHERE id=${input.conteoId} AND estado='borrador'`);
      if ((r[0] as any).affectedRows === 0) throw new TRPCError({code:"BAD_REQUEST", message:"No se pudo enviar"});
      return { ok: true };
    }),

  getConteoSemana: protectedProcedure
    .input(z.object({ sucursalId:z.number(), almacenId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const semana = getSemanaISO();
      const ctR = await db.execute(sql`SELECT id, estado, fechaConteo, notas FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${input.almacenId} AND semana=${semana} ORDER BY id DESC LIMIT 1`);
      const ct = (ctR[0] as any[])[0];
      if (!ct) return { conteo: null, detalles: [] };
      const detR = await db.execute(sql`SELECT productoId, cantidadPiezas, cantidadGramos FROM inv_conteo_detalle WHERE conteoId=${ct.id}`);
      return { conteo: ct, detalles: detR[0] as any[] };
    }),

"""

# Insertar antes del cierre `});`
content = content.rstrip()
assert content.endswith("});"), f"ERROR: el archivo no termina en '}}};', termina en: {repr(content[-20:])}"
content = content[:-3] + new_procs + "});"

with open(TARGET, "w") as f:
    f.write(content)

print("✅ 6 procedimientos agregados correctamente")
print("Ahora corre: cd /var/www/secof && pnpm run build && pm2 restart 1")
