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
               c.subtotal, c.iva, c.total, c.pdfUrl, c.vendedor, c.notas, c.recibida,
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
      const dir = path.join(process.cwd(), "storage", "pdfs", "compras");
      fs.mkdirSync(dir, { recursive: true });

      const filename  = `${input.numeroOrden}.pdf`;
      const filepath  = path.join(dir, filename);
      const b64data   = input.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      fs.writeFileSync(filepath, Buffer.from(b64data, "base64"));

      const pdfUrl = `/storage/pdfs/compras/${filename}`;
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
          const dir = path.join(process.cwd(), "storage", "pdfs", "compras");
          fs.mkdirSync(dir, { recursive: true });
          const filename = `${input.numeroOrden}.pdf`;
          const b64 = input.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
          fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, "base64"));
          pdfUrl = `/storage/pdfs/compras/${filename}`;
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

  // Obtener items del pedido para recepción (pre-cargados desde compras_detalle × mapping)
  obtenerItemsRecepcion: protectedProcedure
    .input(z.object({ compraId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT cd.sku, cd.descripcion, cd.cantidad as cajasCompradas,
          m.inv_productoId, m.piezasPorUnidadCompra, m.notas as mappingNota,
          p.nombre as invNombre, p.unidadConteo,
          ROUND(cd.cantidad * m.piezasPorUnidadCompra, 0) as cantidadEsperada
        FROM compras_detalle cd
        JOIN compras_sku_mapping m ON m.sku = cd.sku AND m.inv_productoId > 0
        JOIN inv_productos p ON p.id = m.inv_productoId
        WHERE cd.compraId = ${input.compraId}
        ORDER BY p.categoria, p.nombre
      `);
      // Agrupar por inv_productoId (puede haber varios SKUs del mismo producto)
      const map = new Map<number, any>();
      for (const r of (rows[0] as any[])) {
        const id = r.inv_productoId;
        if (!map.has(id)) {
          map.set(id, {
            inv_productoId: id,
            invNombre: r.invNombre,
            unidadConteo: r.unidadConteo,
            cantidadEsperada: 0,
            cantidadRecibida: 0,
            skus: [],
          });
        }
        const item = map.get(id)!;
        item.cantidadEsperada += Number(r.cantidadEsperada);
        item.cantidadRecibida += Number(r.cantidadEsperada);
        item.skus.push(r.sku);
      }
      return Array.from(map.values());
    }),

  // Confirmar recepción con cantidades reales (crea inv_surtido confirmado)
  confirmarRecepcion: protectedProcedure
    .input(z.object({
      compraId:   z.number(),
      sucursalId: z.number(),
      fecha:      z.string(),
      items: z.array(z.object({
        inv_productoId:   z.number(),
        cantidadRecibida: z.number(),
        notas:            z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verificar que no esté ya recibida
      const compra = await db.execute(sql`SELECT recibida FROM compras WHERE id=${input.compraId}`);
      if ((compra[0] as any[])[0]?.recibida) throw new TRPCError({ code: "BAD_REQUEST", message: "Ya fue recibida" });

      // 1. Crear inv_surtido confirmado
      await db.execute(sql`
        INSERT INTO inv_surtidos (sucursalId, fecha, estado, notas, creadoPorId)
        VALUES (${input.sucursalId}, ${input.fecha}, 'confirmado',
          CONCAT('Recepción OV compraId=', ${input.compraId}), ${ctx.user.id})
      `);
      const surtidoRow = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
      const surtidoId = (surtidoRow[0] as any[])[0]?.id;

      // 2. Crear detalle por cada item recibido
      for (const item of input.items.filter(i => i.cantidadRecibida > 0)) {
        await db.execute(sql`
          INSERT INTO inv_surtido_detalle (surtidoId, productoId, cantidadPiezas, cantidadGramos, notas)
          VALUES (${surtidoId}, ${item.inv_productoId}, ${item.cantidadRecibida}, 0, ${item.notas ?? null})
        `);
      }

      // 3. Marcar compra como recibida
      await db.execute(sql`
        UPDATE compras SET recibida=1, inv_surtidoId=${surtidoId} WHERE id=${input.compraId}
      `);

      return { ok: true, surtidoId };
    }),
  // Subir PDF y crear orden completa automáticamente (Claude lee el PDF)
  subirPdfYCrear: protectedProcedure
    .input(z.object({
      pdfBase64:  z.string(),
      sucursalId: z.number().default(30001),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 1. Extraer datos del PDF con Claude
      const pdfData = input.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          messages: [{ role: "user", content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfData } },
            { type: "text", text: "Extrae TODOS los datos de esta orden de compra/factura de Jellyboba. Responde SOLO con JSON valido sin markdown ni explicaciones: {\"numeroOrden\":\"\",\"fecha\":\"YYYY-MM-DD\",\"proveedor\":\"Jellyboba\",\"subtotal\":0,\"iva\":0,\"total\":0,\"items\":[{\"sku\":\"\",\"descripcion\":\"\",\"cantidad\":0,\"precioUnitario\":0,\"importe\":0}]}" }
          ]}]
        }),
      });
      const aiData = await aiResp.json();
      const rawText = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g,"").trim();
      let parsed: any;
      try { parsed = JSON.parse(rawText); }
      catch(e) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Claude no pudo extraer los datos del PDF" }); }

      // 2. Guardar PDF en disco
      let pdfUrl: string | null = null;
      try {
        const dir = path.join(process.cwd(), "storage", "pdfs", "compras");
        fs.mkdirSync(dir, { recursive: true });
        const fname = (parsed.numeroOrden ?? Date.now()).toString().replace(/[^a-zA-Z0-9_-]/g,"_") + ".pdf";
        fs.writeFileSync(path.join(dir, fname), Buffer.from(pdfData, "base64"));
        pdfUrl = `/storage/pdfs/compras/${fname}`;
      } catch(e) { console.error("PDF save error:", e); }

      // 3. Verificar si ya existe la orden
      const existe = await db.execute(sql`SELECT id, pdfUrl FROM compras WHERE numeroOrden=${parsed.numeroOrden} LIMIT 1`);
      const existeRow = (existe[0] as any[])[0];
      if (existeRow) {
        // Solo actualizar pdfUrl si no tenía
        if (!existeRow.pdfUrl && pdfUrl) {
          await db.execute(sql`UPDATE compras SET pdfUrl=${pdfUrl} WHERE id=${existeRow.id}`);
        }
        return { ok: true, compraId: existeRow.id, numeroOrden: parsed.numeroOrden, itemsInsertados: 0, total: parsed.total, duplicado: true };
      }

      // 3. Insertar compra (nueva)
      await db.execute(sql`
        INSERT INTO compras (numeroOrden, proveedor, fecha, subtotal, iva, total, sucursalId, pdfUrl)
        VALUES (${parsed.numeroOrden ?? "SIN-NUMERO"}, ${parsed.proveedor ?? "Jellyboba"},
                ${parsed.fecha ?? new Date().toISOString().split("T")[0]},
                ${parsed.subtotal ?? 0}, ${parsed.iva ?? 0}, ${parsed.total ?? 0},
                ${input.sucursalId}, ${pdfUrl})
      `);
      const compraRow = await db.execute(sql`SELECT LAST_INSERT_ID() as id`);
      const compraId = (compraRow[0] as any[])[0]?.id as number;

      // 4. Insertar detalle de productos
      const items = parsed.items ?? [];
      let itemsInsertados = 0;
      for (const item of items) {
        if (!item.sku && !item.descripcion) continue;
        try {
          await db.execute(sql`
            INSERT INTO compras_detalle (compraId, sku, descripcion, cantidad, precioUnitario, importe, unidad)
            VALUES (${compraId}, ${item.sku ?? ""}, ${item.descripcion ?? ""},
                    ${item.cantidad ?? 0}, ${item.precioUnitario ?? 0}, ${item.importe ?? 0}, "pz")
          `);
          itemsInsertados++;
        } catch(e) { console.error("detalle insert:", e); }
      }

      return { ok: true, compraId, numeroOrden: parsed.numeroOrden, itemsInsertados, total: parsed.total };
    }),

});
