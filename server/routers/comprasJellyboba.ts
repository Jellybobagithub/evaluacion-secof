import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

export const comprasJellybobaRouter = router({

  list: protectedProcedure
    .input(z.object({ sucursalId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const cond = input.sucursalId ? `WHERE c.sucursalId = ${input.sucursalId}` : "";
      const rows = await db.execute(sql`
        SELECT c.id, c.numeroOrden, c.proveedor, c.fecha,
               c.subtotal, c.iva, c.total, c.pdfUrl, c.vendedor, c.notas,
               COUNT(d.id) as numItems
        FROM compras c
        LEFT JOIN compras_detalle d ON d.compraId = c.id
        GROUP BY c.id
        ORDER BY c.fecha DESC
      `);
      const all = rows[0] as any[];
      if (input.sucursalId) return all.filter((r: any) => !r.sucursalId || Number(r.sucursalId) === input.sucursalId);
      return all;
    }),

  detalle: protectedProcedure
    .input(z.object({ compraId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT id, sku, descripcion, cantidad, unidad, precioUnitario, importe, categoria
        FROM compras_detalle WHERE compraId = ${input.compraId}
        ORDER BY categoria, descripcion
      `);
      return rows[0] as any[];
    }),

  subirPdf: protectedProcedure
    .input(z.object({
      compraId:     z.number(),
      numeroOrden:  z.string(),
      pdfBase64:    z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Escribir PDF en disco
      const dir = path.join(process.cwd(), "dist", "public", "pdfs", "compras");
      fs.mkdirSync(dir, { recursive: true });

      const filename  = `${input.numeroOrden}.pdf`;
      const filepath  = path.join(dir, filename);
      const b64data   = input.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      fs.writeFileSync(filepath, Buffer.from(b64data, "base64"));

      const pdfUrl = `/pdfs/compras/${filename}`;
      await db.execute(sql`UPDATE compras SET pdfUrl = ${pdfUrl} WHERE id = ${input.compraId}`);

      return { ok: true, pdfUrl };
    }),

  crear: protectedProcedure
    .input(z.object({
      numeroOrden:  z.string(),
      proveedor:    z.string().default("Jellyboba"),
      fecha:        z.string(),
      subtotal:     z.number(),
      iva:          z.number().default(0),
      total:        z.number(),
      sucursalId:   z.number().default(30001),
      notas:        z.string().optional(),
      pdfBase64:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Insertar orden
      await db.execute(sql`
        INSERT INTO compras (numeroOrden, proveedor, fecha, subtotal, iva, total, sucursalId, notas)
        VALUES (${input.numeroOrden}, ${input.proveedor}, ${input.fecha},
                ${input.subtotal}, ${input.iva}, ${input.total},
                ${input.sucursalId}, ${input.notas ?? null})
      `);
      const rows = await db.execute(sql`SELECT id FROM compras WHERE numeroOrden=${input.numeroOrden} LIMIT 1`);
      const compraId = (rows[0] as any[])[0]?.id as number;

      // Subir PDF si viene
      let pdfUrl: string | null = null;
      if (input.pdfBase64 && compraId) {
        try {
          const dir = path.join(process.cwd(), "dist", "public", "pdfs", "compras");
          fs.mkdirSync(dir, { recursive: true });
          const filename = `${input.numeroOrden}.pdf`;
          const b64 = input.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
          fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, "base64"));
          pdfUrl = `/pdfs/compras/${filename}`;
          await db.execute(sql`UPDATE compras SET pdfUrl=${pdfUrl} WHERE id=${compraId}`);
        } catch(e) { console.error("PDF upload error:", e); }
      }
      return { ok: true, compraId, pdfUrl };
    }),

  resumenPorCategoria: protectedProcedure
    .input(z.object({ compraId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT categoria, SUM(importe) as total, COUNT(*) as items
        FROM compras_detalle WHERE compraId = ${input.compraId}
        GROUP BY categoria ORDER BY total DESC
      `);
      return rows[0] as any[];
    }),
});
