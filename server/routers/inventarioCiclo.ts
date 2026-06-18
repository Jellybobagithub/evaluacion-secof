import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

function getSemanaISO(date = new Date()): string {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const year = d.getUTCFullYear();
  const soy = new Date(Date.UTC(year, 0, 1));
  const wn = Math.ceil(((d.getTime() - soy.getTime()) / 86400000 + soy.getUTCDay() + 1) / 7);
  return `${year}-W${String(wn).padStart(2, "0")}`;
}

type SM = Record<number, { p: number; g: number }>;

async function getStockBase(db: any, sucursalId: number) {
  const almsR = await db.execute(sql`SELECT id, nombre FROM inv_almacenes WHERE sucursalId=${sucursalId} AND activo=1`);
  const alms = almsR[0] as any[];
  let baseDate: Date | null = null;
  const base: SM = {};
  for (const alm of alms) {
    const ctR = await db.execute(sql`SELECT id, fechaConteo FROM inv_conteo_fisico WHERE sucursalId=${sucursalId} AND almacenId=${alm.id} AND estado='bloqueado' ORDER BY fechaConteo DESC, id DESC LIMIT 1`);
    const ct = (ctR[0] as any[])[0];
    if (!ct) continue;
    const d = new Date(ct.fechaConteo + "T00:00:00");
    if (!baseDate || d < baseDate) baseDate = d;
    const detR = await db.execute(sql`SELECT productoId, cantidadPiezas, cantidadGramos FROM inv_conteo_detalle WHERE conteoId=${ct.id}`);
    for (const r of detR[0] as any[]) {
      const id = Number(r.productoId);
      if (!base[id]) base[id] = { p: 0, g: 0 };
      base[id].p += Number(r.cantidadPiezas || 0);
      base[id].g += Number(r.cantidadGramos || 0);
    }
  }
  return { baseDate, base };
}

async function calcular(db: any, sucursalId: number, fuente: string) {
  const { baseDate, base } = await getStockBase(db, sucursalId);
  if (!baseDate) return { baseDate: null, items: [], baseConteoId: null };
  const bd = baseDate.toISOString().split("T")[0];

  const entR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${sucursalId} AND tipo='entrada' AND DATE(createdAt)>=${bd} GROUP BY productoId`);
  const ent: SM = {};
  for (const r of entR[0] as any[]) ent[Number(r.productoId)] = { p: Number(r.p||0), g: Number(r.g||0) };

  const cons: SM = {};
  const tipos = fuente === "ambos" ? ["preparacion","venta_odoo"] : [fuente];
  for (const t of tipos) {
    const cR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${sucursalId} AND tipo='consumo_preparacion' AND referenciaTipo=${t} AND DATE(createdAt)>=${bd} GROUP BY productoId`);
    for (const r of cR[0] as any[]) {
      const id = Number(r.productoId);
      if (!cons[id]) cons[id] = { p: 0, g: 0 };
      cons[id].p += Number(r.p||0); cons[id].g += Number(r.g||0);
    }
  }
  // Surtidos a isla: reducen stock de bodega igual que consumo
  const islaR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${sucursalId} AND tipo='surtido_isla' AND DATE(createdAt)>=${bd} GROUP BY productoId`);
  for (const r of islaR[0] as any[]) {
    const id = Number(r.productoId);
    if (!cons[id]) cons[id] = { p: 0, g: 0 };
    cons[id].p += Number(r.p||0); cons[id].g += Number(r.g||0);
  }

  const prR = await db.execute(sql`SELECT id, nombre, categoria, unidadConteo as unidad, pesoNetoPorUnidad as pn FROM inv_productos WHERE activo=1`);
  const prods: Record<number,any> = {};
  for (const r of prR[0] as any[]) prods[Number(r.id)] = r;

  const ids = new Set([...Object.keys(base),...Object.keys(ent),...Object.keys(cons)].map(Number));
  const items: any[] = [];
  for (const id of ids) {
    const pr = prods[id]; if (!pr) continue;
    const b = base[id]||{p:0,g:0}; const e = ent[id]||{p:0,g:0}; const c = cons[id]||{p:0,g:0};
    const pn = Number(pr.pn)||0;
    const toP = (p:number,g:number) => p + (pn>0 ? g/pn : 0);
    const sb = toP(b.p,b.g), se = toP(e.p,e.g), sc = toP(c.p,c.g);
    const teo = Math.max(0, sb+se-sc);
    if (sb+se+sc === 0) continue;
    items.push({ productoId:id, nombre:pr.nombre, categoria:pr.categoria||"Varios", unidad:pr.unidad, pesoNeto:Number(pr.pn)||0,
      stockBase:Math.round(sb*100)/100, entradas:Math.round(se*100)/100,
      consumo:Math.round(sc*100)/100, stockTeorico:Math.round(teo*100)/100 });
  }
  return { baseDate: bd, baseConteoId: null,
    items: items.sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nombre.localeCompare(b.nombre)) };
}

export const inventarioCicloRouter = router({

  stockTeorico: protectedProcedure
    .input(z.object({ sucursalId:z.number(), fuenteConsumo:z.enum(["preparacion","venta_odoo","ambos"]).default("ambos") }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      return calcular(db, input.sucursalId, input.fuenteConsumo);
    }),

  comparacionPendiente: protectedProcedure
    .input(z.object({ sucursalId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const pendR = await db.execute(sql`SELECT cf.id, cf.fechaConteo, cf.semana, cf.almacenId, a.nombre as almacen, cf.notas FROM inv_conteo_fisico cf LEFT JOIN inv_almacenes a ON a.id=cf.almacenId WHERE cf.sucursalId=${input.sucursalId} AND cf.estado='enviado' ORDER BY cf.fechaConteo DESC, cf.id DESC`);
      const pend = pendR[0] as any[];
      if (!pend.length) return { pendientes:[], comparacion:[], conteoIds:[], conteoId:null, baseDate:null };
      // Agrupar todos los conteos de la fecha más reciente (todos los almacenes)
      const latestFecha = pend[0].fechaConteo;
      const latestConteos = pend.filter((p:any) => p.fechaConteo === latestFecha);
      const conteoIds = latestConteos.map((p:any) => Number(p.id));
      const almacenesNombres = [...new Set(latestConteos.map((p:any) => p.almacen))].join(' + ');
      // Stock teórico (ya suma todos los almacenes)
      const { items: tItems, baseDate } = await calcular(db, input.sucursalId, "ambos");
      const tMap: Record<number,number> = {};
      for (const t of tItems) tMap[t.productoId] = t.stockTeorico;
      // Sumar físico de TODOS los almacenes contados
      const fisMap: Record<number,{p:number;g:number;nombre:string;cat:string;unidad:string;pn:number}> = {};
      for (const ct of latestConteos) {
        const detR = await db.execute(sql`SELECT cd.productoId, cd.cantidadPiezas, cd.cantidadGramos, p.nombre, p.categoria, p.unidadConteo as unidad, p.pesoNetoPorUnidad as pn FROM inv_conteo_detalle cd JOIN inv_productos p ON p.id=cd.productoId WHERE cd.conteoId=${ct.id}`);
        for (const d of detR[0] as any[]) {
          const id = Number(d.productoId);
          if (!fisMap[id]) fisMap[id] = { p:0, g:0, nombre:d.nombre, cat:d.categoria||"Varios", unidad:d.unidad, pn:Number(d.pn)||0 };
          fisMap[id].p += Number(d.cantidadPiezas||0);
          fisMap[id].g += Number(d.cantidadGramos||0);
        }
      }
      const comp = Object.entries(fisMap).map(([pidStr, d]) => {
        const pid = Number(pidStr);
        const fis = d.p + (d.pn > 0 ? d.g / d.pn : 0);
        const teo = tMap[pid] ?? 0;
        const pct = teo > 0 ? ((teo - fis) / teo) * 100 : 0;
        return { productoId:pid, nombre:d.nombre, categoria:d.cat, unidad:d.unidad,
          fisico:Math.round(fis*100)/100, teorico:Math.round(teo*100)/100,
          delta:Math.round((fis-teo)*100)/100, pctMerma:Math.round(pct*10)/10,
          alerta:pct>5?"critico":pct>2?"atencion":"ok" };
      }).sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nombre.localeCompare(b.nombre));
      return { pendientes:pend, comparacion:comp, conteoIds, conteoId:conteoIds[0]??null, almacenes:almacenesNombres, baseDate };
    }),

  aprobarConteo: protectedProcedure
    .input(z.object({ conteoIds:z.array(z.number()).optional(), conteoId:z.number().optional(), notas:z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner"].includes(ctx.user.role)) throw new TRPCError({code:"FORBIDDEN"});
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const ids = input.conteoIds ?? (input.conteoId ? [input.conteoId] : []);
      if (!ids.length) throw new TRPCError({code:"BAD_REQUEST", message:"Sin conteos que aprobar"});
      for (const id of ids) {
        await db.execute(sql`UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id=${id} AND estado='enviado'`);
      }
      return { ok:true, aprobados:ids.length };
    }),

  historialMermas: protectedProcedure
    .input(z.object({ sucursalId:z.number(), semanas:z.number().default(6) }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const almR = await db.execute(sql`SELECT id FROM inv_almacenes WHERE sucursalId=${input.sucursalId} AND nombre LIKE '%odega%' AND activo=1 LIMIT 1`);
      const almId = (almR[0] as any[])[0]?.id;
      if (!almId) return { semanas:[] };
      const ctsR = await db.execute(sql`SELECT id, fechaConteo FROM inv_conteo_fisico WHERE sucursalId=${input.sucursalId} AND almacenId=${almId} AND estado='bloqueado' ORDER BY fechaConteo DESC, id DESC LIMIT ${input.semanas+1}`);
      const cts = ctsR[0] as any[];
      if (cts.length < 2) return { semanas:[] };
      const semanas: any[] = [];
      for (let i=0; i<cts.length-1; i++) {
        const cf=cts[i], ci=cts[i+1];
        const [fd,id2] = await Promise.all([
          db.execute(sql`SELECT cd.productoId, cd.cantidadPiezas FROM inv_conteo_detalle cd WHERE cd.conteoId=${cf.id}`),
          db.execute(sql`SELECT cd.productoId, cd.cantidadPiezas FROM inv_conteo_detalle cd WHERE cd.conteoId=${ci.id}`),
        ]);
        const fm:Record<number,number>={}, im:Record<number,number>={};
        for (const d of fd[0] as any[]) fm[d.productoId]=Number(d.cantidadPiezas||0);
        for (const d of id2[0] as any[]) im[d.productoId]=Number(d.cantidadPiezas||0);
        const entR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p FROM inv_movimientos WHERE sucursalId=${input.sucursalId} AND tipo='entrada' AND DATE(createdAt) BETWEEN ${ci.fechaConteo} AND ${cf.fechaConteo} GROUP BY productoId`);
        const em:Record<number,number>={};
        for (const e of entR[0] as any[]) em[e.productoId]=Number(e.p||0);
        const consR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p FROM inv_movimientos WHERE sucursalId=${input.sucursalId} AND tipo='consumo_preparacion' AND DATE(createdAt) BETWEEN ${ci.fechaConteo} AND ${cf.fechaConteo} GROUP BY productoId`);
        const cm:Record<number,number>={};
        for (const c of consR[0] as any[]) cm[c.productoId]=Number(c.p||0);
        const islaR2 = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p FROM inv_movimientos WHERE sucursalId=${input.sucursalId} AND tipo='surtido_isla' AND DATE(createdAt) BETWEEN ${ci.fechaConteo} AND ${cf.fechaConteo} GROUP BY productoId`);
        for (const r of islaR2[0] as any[]) cm[r.productoId]=(cm[r.productoId]||0)+Number(r.p||0);
        let totT=0, totF=0;
        const pids=new Set([...Object.keys(fm),...Object.keys(im)].map(Number));
        for (const pid of pids) {
          const t=(im[pid]||0)+(em[pid]||0)-(cm[pid]||0);
          const f=fm[pid]||0;
          if(t>0){totT+=t;totF+=f;}
        }
        const pct=totT>0?((totT-totF)/totT)*100:0;
        semanas.push({ fecha:cf.fechaConteo, conteoId:cf.id,
          totalTeorico:Math.round(totT), totalFisico:Math.round(totF),
          pctMerma:Math.round(pct*10)/10, alerta:pct>5?"critico":pct>2?"atencion":"ok" });
      }
      return { semanas };
    }),

  kpiResumen: protectedProcedure
    .input(z.object({ sucursalId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const { items, baseDate } = await calcular(db, input.sucursalId, "ambos");
      return { totalProductos:items.length, totalTeorico:Math.round(items.reduce((s,i)=>s+i.stockTeorico,0)),
        productosUrgentes:items.filter(i=>i.stockTeorico<2).length, baseDate };
    }),

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


  rechazarConteo: protectedProcedure
    .input(z.object({ conteoIds:z.array(z.number()), motivo:z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner"].includes(ctx.user.role)) throw new TRPCError({code:"FORBIDDEN"});
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      for (const id of input.conteoIds) {
        await db.execute(sql`UPDATE inv_conteo_fisico SET estado='borrador', notas=${input.motivo ?? null} WHERE id=${id} AND estado='enviado'`);
      }
      return { ok:true, devueltos:input.conteoIds.length };
    }),


  historialConteoDetalle: protectedProcedure
    .input(z.object({ conteoId:z.number() }))
    .query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      const ctR = await db.execute(sql`SELECT id, sucursalId, almacenId, fechaConteo FROM inv_conteo_fisico WHERE id=${input.conteoId}`);
      const ct = (ctR[0] as any[])[0];
      if (!ct) return { items:[] };

      // Físico actual: suma todos los detalles del conteoId
      const detR = await db.execute(sql`
        SELECT cd.productoId, SUM(cd.cantidadPiezas) as p, SUM(cd.cantidadGramos) as g,
          pr.nombre, pr.categoria, pr.unidadConteo as unidad, pr.pesoNetoPorUnidad as pn
        FROM inv_conteo_detalle cd
        JOIN inv_productos pr ON pr.id=cd.productoId
        WHERE cd.conteoId=${input.conteoId}
        GROUP BY cd.productoId, pr.nombre, pr.categoria, pr.unidadConteo, pr.pesoNetoPorUnidad`);

      // Conteo anterior bloqueado (base del ciclo) para el mismo almacén
      const prevR = await db.execute(sql`
        SELECT id, fechaConteo FROM inv_conteo_fisico
        WHERE sucursalId=${ct.sucursalId} AND almacenId=${ct.almacenId}
          AND estado='bloqueado' AND fechaConteo < ${ct.fechaConteo}
        ORDER BY fechaConteo DESC, id DESC LIMIT 1`);
      const prev = (prevR[0] as any[])[0];

      // Stock base del conteo anterior (piezas normalizadas)
      const baseMap: Record<number,{p:number;g:number}> = {};
      if (prev) {
        const baseR = await db.execute(sql`SELECT productoId, cantidadPiezas, cantidadGramos FROM inv_conteo_detalle WHERE conteoId=${prev.id}`);
        for (const r of baseR[0] as any[]) {
          const id = Number(r.productoId);
          if (!baseMap[id]) baseMap[id] = { p:0, g:0 };
          baseMap[id].p += Number(r.cantidadPiezas||0);
          baseMap[id].g += Number(r.cantidadGramos||0);
        }
      }

      // Entradas y consumo entre base y este conteo
      const fechaBase = prev?.fechaConteo ?? ct.fechaConteo;
      const entR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${ct.sucursalId} AND tipo='entrada' AND DATE(createdAt) BETWEEN ${fechaBase} AND ${ct.fechaConteo} GROUP BY productoId`);
      const entMap: Record<number,{p:number;g:number}> = {};
      for (const r of entR[0] as any[]) entMap[Number(r.productoId)] = { p:Number(r.p||0), g:Number(r.g||0) };

      const consR = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${ct.sucursalId} AND tipo='consumo_preparacion' AND DATE(createdAt) BETWEEN ${fechaBase} AND ${ct.fechaConteo} GROUP BY productoId`);
      const consMap: Record<number,{p:number;g:number}> = {};
      for (const r of consR[0] as any[]) consMap[Number(r.productoId)] = { p:Number(r.p||0), g:Number(r.g||0) };
      const islaR3 = await db.execute(sql`SELECT productoId, SUM(cantidadPiezas) as p, SUM(cantidadGramos) as g FROM inv_movimientos WHERE sucursalId=${ct.sucursalId} AND tipo='surtido_isla' AND DATE(createdAt) BETWEEN ${fechaBase} AND ${ct.fechaConteo} GROUP BY productoId`);
      for (const r of islaR3[0] as any[]) {
        const id = Number(r.productoId);
        if (!consMap[id]) consMap[id] = { p:0, g:0 };
        consMap[id].p += Number(r.p||0); consMap[id].g += Number(r.g||0);
      }

      const items = (detR[0] as any[]).map((d:any) => {
        const pn = Number(d.pn)||0;
        const toP = (p:number,g:number) => p + (pn>0 ? g/pn : 0);
        const fis = toP(Number(d.p||0), Number(d.g||0));
        const id = Number(d.productoId);
        const sb = toP(baseMap[id]?.p||0, baseMap[id]?.g||0);
        const se = toP(entMap[id]?.p||0, entMap[id]?.g||0);
        const sc = toP(consMap[id]?.p||0, consMap[id]?.g||0);
        const teo = Math.max(0, sb + se - sc);
        const pctMerma = teo > 0 ? Math.round(((teo-fis)/teo)*100*10)/10 : 0;
        return { productoId:id, nombre:d.nombre, categoria:d.categoria||'Varios', unidad:d.unidad,
          fisico:Math.round(fis*100)/100, teorico:Math.round(teo*100)/100,
          delta:Math.round((fis-teo)*100)/100, pctMerma };
      }).sort((a:any,b:any)=>a.categoria.localeCompare(b.categoria)||a.nombre.localeCompare(b.nombre));
      return { items };
    }),

});