#!/usr/bin/env python3
"""python3 /var/www/secof/fix_comparacion.py"""

ROUTER = "/var/www/secof/server/routers/inventarioCiclo.ts"

with open(ROUTER, "r") as f:
    content = f.read()

# ── Reemplazar comparacionPendiente completo ──────────────────────────────────
OLD_COMP = """  comparacionPendiente: protectedProcedure
    .input(z.object({ sucursalId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const pendR = await db.execute(sql`SELECT cf.id, cf.fechaConteo, cf.almacenId, a.nombre as almacen, cf.notas FROM inv_conteo_fisico cf LEFT JOIN inv_almacenes a ON a.id=cf.almacenId LEFT JOIN users u ON u.id=cf.supervisorId WHERE cf.sucursalId=${input.sucursalId} AND cf.estado='enviado' ORDER BY cf.fechaConteo DESC, cf.id DESC`);
      const pend = pendR[0] as any[];
      if (!pend.length) return { pendientes:[], comparacion:[], conteoId:null, baseDate:null };
      const { items: tItems, baseDate } = await calcular(db, input.sucursalId, "ambos");
      const tMap: Record<number,number> = {};
      for (const t of tItems) tMap[t.productoId] = t.stockTeorico;
      const latest = pend[0];
      const detR = await db.execute(sql`SELECT cd.productoId, cd.cantidadPiezas, cd.cantidadGramos, p.nombre, p.categoria, p.unidadConteo as unidad, p.pesoNetoPorUnidad as pn FROM inv_conteo_detalle cd JOIN inv_productos p ON p.id=cd.productoId WHERE cd.conteoId=${latest.id} ORDER BY p.categoria, p.nombre`);
      const comp = (detR[0] as any[]).map((d:any) => {
        const pn = Number(d.pn)||0;
        const fis = Number(d.cantidadPiezas||0) + (pn>0?Number(d.cantidadGramos||0)/pn:0);
        const teo = tMap[d.productoId]??0;
        const pct = teo>0?((teo-fis)/teo)*100:0;
        return { productoId:d.productoId, nombre:d.nombre, categoria:d.categoria||"Varios", unidad:d.unidad,
          fisico:Math.round(fis*100)/100, teorico:Math.round(teo*100)/100,
          delta:Math.round((fis-teo)*100)/100, pctMerma:Math.round(pct*10)/10,
          alerta:pct>5?"critico":pct>2?"atencion":"ok" };
      });
      return { pendientes:pend, comparacion:comp, conteoId:latest.id, baseDate };
    }),"""

BT = "`"
NEW_COMP = (
    "  comparacionPendiente: protectedProcedure\n"
    "    .input(z.object({ sucursalId:z.number() }))\n"
    "    .query(async ({ input }) => {\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    f"      const pendR = await db.execute(sql{BT}SELECT cf.id, cf.fechaConteo, cf.semana, cf.almacenId, a.nombre as almacen, cf.notas FROM inv_conteo_fisico cf LEFT JOIN inv_almacenes a ON a.id=cf.almacenId WHERE cf.sucursalId=${'{'}input.sucursalId{'}'} AND cf.estado='enviado' ORDER BY cf.fechaConteo DESC, cf.id DESC{BT});\n"
    "      const pend = pendR[0] as any[];\n"
    "      if (!pend.length) return { pendientes:[], comparacion:[], conteoIds:[], conteoId:null, baseDate:null };\n"
    "      // Agrupar todos los conteos de la fecha más reciente (todos los almacenes)\n"
    "      const latestFecha = pend[0].fechaConteo;\n"
    "      const latestConteos = pend.filter((p:any) => p.fechaConteo === latestFecha);\n"
    "      const conteoIds = latestConteos.map((p:any) => Number(p.id));\n"
    "      const almacenesNombres = [...new Set(latestConteos.map((p:any) => p.almacen))].join(' + ');\n"
    "      // Stock teórico (ya suma todos los almacenes)\n"
    "      const { items: tItems, baseDate } = await calcular(db, input.sucursalId, \"ambos\");\n"
    "      const tMap: Record<number,number> = {};\n"
    "      for (const t of tItems) tMap[t.productoId] = t.stockTeorico;\n"
    "      // Sumar físico de TODOS los almacenes contados\n"
    "      const fisMap: Record<number,{p:number;g:number;nombre:string;cat:string;unidad:string;pn:number}> = {};\n"
    "      for (const ct of latestConteos) {\n"
    f"        const detR = await db.execute(sql{BT}SELECT cd.productoId, cd.cantidadPiezas, cd.cantidadGramos, p.nombre, p.categoria, p.unidadConteo as unidad, p.pesoNetoPorUnidad as pn FROM inv_conteo_detalle cd JOIN inv_productos p ON p.id=cd.productoId WHERE cd.conteoId=${'{'}ct.id{'}'}{BT});\n"
    "        for (const d of detR[0] as any[]) {\n"
    "          const id = Number(d.productoId);\n"
    "          if (!fisMap[id]) fisMap[id] = { p:0, g:0, nombre:d.nombre, cat:d.categoria||\"Varios\", unidad:d.unidad, pn:Number(d.pn)||0 };\n"
    "          fisMap[id].p += Number(d.cantidadPiezas||0);\n"
    "          fisMap[id].g += Number(d.cantidadGramos||0);\n"
    "        }\n"
    "      }\n"
    "      const comp = Object.entries(fisMap).map(([pidStr, d]) => {\n"
    "        const pid = Number(pidStr);\n"
    "        const fis = d.p + (d.pn > 0 ? d.g / d.pn : 0);\n"
    "        const teo = tMap[pid] ?? 0;\n"
    "        const pct = teo > 0 ? ((teo - fis) / teo) * 100 : 0;\n"
    "        return { productoId:pid, nombre:d.nombre, categoria:d.cat, unidad:d.unidad,\n"
    "          fisico:Math.round(fis*100)/100, teorico:Math.round(teo*100)/100,\n"
    "          delta:Math.round((fis-teo)*100)/100, pctMerma:Math.round(pct*10)/10,\n"
    "          alerta:pct>5?\"critico\":pct>2?\"atencion\":\"ok\" };\n"
    "      }).sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nombre.localeCompare(b.nombre));\n"
    "      return { pendientes:pend, comparacion:comp, conteoIds, conteoId:conteoIds[0]??null, almacenes:almacenesNombres, baseDate };\n"
    "    }),"
)

# ── Reemplazar aprobarConteo para aceptar array de IDs ───────────────────────
OLD_APROB = """  aprobarConteo: protectedProcedure
    .input(z.object({ conteoId:z.number(), notas:z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner"].includes(ctx.user.role)) throw new TRPCError({code:"FORBIDDEN"});
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      await db.execute(sql`UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id=${input.conteoId} AND estado='enviado'`);
      return { ok:true };
    }),"""

NEW_APROB = (
    "  aprobarConteo: protectedProcedure\n"
    "    .input(z.object({ conteoIds:z.array(z.number()).optional(), conteoId:z.number().optional(), notas:z.string().optional() }))\n"
    "    .mutation(async ({ ctx, input }) => {\n"
    "      if (![\"superadmin\",\"owner\"].includes(ctx.user.role)) throw new TRPCError({code:\"FORBIDDEN\"});\n"
    "      const db = await getDb(); if (!db) throw new TRPCError({code:\"INTERNAL_SERVER_ERROR\"});\n"
    "      const ids = input.conteoIds ?? (input.conteoId ? [input.conteoId] : []);\n"
    "      if (!ids.length) throw new TRPCError({code:\"BAD_REQUEST\", message:\"Sin conteos que aprobar\"});\n"
    "      for (const id of ids) {\n"
    f"        await db.execute(sql{BT}UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id={'{'}id{'}'} AND estado='enviado'{BT});\n"
    "      }\n"
    "      return { ok:true, aprobados:ids.length };\n"
    "    }),"
)

changed = False

if OLD_COMP in content:
    content = content.replace(OLD_COMP, NEW_COMP)
    print("✅ comparacionPendiente actualizado — suma Bodega + Isla")
    changed = True
else:
    print("❌ No se encontró comparacionPendiente exacto")
    # Buscar variante sin el JOIN de supervisorId (ya corregido antes)
    OLD_COMP_ALT = OLD_COMP.replace(" LEFT JOIN users u ON u.id=cf.supervisorId", "")
    if OLD_COMP_ALT in content:
        content = content.replace(OLD_COMP_ALT, NEW_COMP)
        print("✅ comparacionPendiente actualizado (variante sin supervisorId)")
        changed = True
    else:
        print("   Buscando por fragmento clave...")
        if "comparacionPendiente" in content:
            idx = content.index("comparacionPendiente")
            print(f"   Encontrado en posición {idx}, contexto:")
            print(repr(content[idx:idx+200]))

if OLD_APROB in content:
    content = content.replace(OLD_APROB, NEW_APROB)
    print("✅ aprobarConteo actualizado — acepta array de IDs")
    changed = True
else:
    print("❌ No se encontró aprobarConteo exacto")
    OLD_APROB_ALT = OLD_APROB.replace("sql`UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id=${input.conteoId} AND estado='enviado'`", 
                                       "sql`UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id=${input.conteoId} AND estado='enviado'`")
    if "aprobarConteo" in content:
        idx = content.index("aprobarConteo")
        print(f"   aprobarConteo encontrado, contexto:")
        print(repr(content[idx:idx+300]))

if changed:
    with open(ROUTER, "w") as f:
        f.write(content)
    print("\n✅ Router guardado")
else:
    print("\n⚠️  No se guardó nada — revisar output arriba")

print("\nCorre: cd /var/www/secof && pnpm run build && pm2 restart 1")
