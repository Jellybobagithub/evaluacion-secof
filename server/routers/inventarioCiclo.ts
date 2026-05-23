import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

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
    }),

  aprobarConteo: protectedProcedure
    .input(z.object({ conteoId:z.number(), notas:z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner"].includes(ctx.user.role)) throw new TRPCError({code:"FORBIDDEN"});
      const db = await getDb(); if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
      await db.execute(sql`UPDATE inv_conteo_fisico SET estado='bloqueado' WHERE id=${input.conteoId} AND estado='enviado'`);
      return { ok:true };
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
});
