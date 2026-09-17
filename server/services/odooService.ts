const ODOO_URL  = process.env.ODOO_URL  || "http://snow.cloudpepper.site";
const ODOO_DB   = process.env.ODOO_DB   || "snow.cloudpepper.site";
const ODOO_USER = process.env.ODOO_USER || "admin";
const ODOO_PASS = process.env.ODOO_PASS || "";

let _uid: number | null = null;

async function jsonRpc(service: string, method: string, args: any[]): Promise<any> {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service, method, args } }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Odoo: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function getUid(): Promise<number> {
  if (_uid) return _uid;
  _uid = await jsonRpc("common", "authenticate", [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
  if (!_uid) throw new Error("Odoo auth failed");
  return _uid;
}

async function callModel(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const uid = await getUid();
  return jsonRpc("object", "execute_kw", [ODOO_DB, uid, ODOO_PASS, model, method, args, kwargs]);
}

export interface OdooLinea {
  productoNombre: string;
  fecha: string;
  cantidad: number;
  total: number;
}

export interface OdooPago {
  fecha: string;
  metodo: string;
  esEfectivo: boolean;
  monto: number;
}

export interface OdooSyncResult {
  lineas: OdooLinea[];
  pagos: OdooPago[];
  totalRegistros: number;
  fechaInicio: string;
  fechaFin: string;
  noMapeados: string[];
}

// El Odoo compartido tiene varios puntos de venta (POS Pruebas, POS GLT,
// Tienda de ropa, ademas de este). Sin filtrar por config_id, fetchVentasOdoo
// sumaba TODOS los POS del sistema a la unica sucursal que reporta secof
// (Plaza Patio, id 30001) - ej. julio 2026 mostraba $319,231 en vez de los
// $243,495 reales de Patio, porque incluia los ~$73,076 de POS GLT.
const ODOO_POS_CONFIG_ID = 2; // "POS Patio Queretaro"

const SKIP = new Set(["Descuento Locatario", "Redondeo", "Envio", "2 x 140 Clasico / Yogurt", "2 x 140 Refresher"]);
const SABOR_FIX: Record<string, string> = { "Lichi": "Lichie" };
const PREFIJOS: Record<string, string> = {
  "Caliente": "Snowtea Caliente",
  "Chamoy":   "Snowtea Chamoy",
  "Clasico":  "Snowtea Clasico",
  "Yogurt":   "Snowtea Yogurt",
  "Fra-T":    "Fra-T",
  "Refresher": "Refresher",
  "Topping":  "Topping Extra",
  "Cortesia": "Cortesia",
};

function mapNombre(raw: string): string | null {
  if (SKIP.has(raw)) return null;
  const partes = raw.split(" ");
  const prefijo = partes[0];
  const saborRaw = partes.slice(1).join(" ");
  const sabor = SABOR_FIX[saborRaw] ?? saborRaw;
  const base = PREFIJOS[prefijo];
  if (!base) return null;
  if (prefijo === "Topping") return base;
  if (!sabor) return null;
  return `${base} ${sabor}`;
}

export async function fetchVentasOdoo(fechaInicio: string, fechaFin: string): Promise<OdooSyncResult> {
  // date_order se guarda en UTC; México CDT = UTC-5 → offset +5h para capturar el día local completo
  const desde = `${fechaInicio} 05:00:00`;
  // fin = siguiente día 04:59:59 UTC (= 23:59:59 CDT del día fechaFin)
  const finD = new Date(fechaFin + "T05:00:00Z");
  finD.setDate(finD.getDate() + 1);
  finD.setSeconds(finD.getSeconds() - 1);
  const hasta = finD.toISOString().replace("T", " ").substring(0, 19);

  const lineasOdoo = await callModel("pos.order.line", "search_read", [[
    ["order_id.date_order", ">=", desde],
    ["order_id.date_order", "<=", hasta],
    ["order_id.state", "in", ["done", "invoiced", "paid"]],
    ["order_id.config_id", "=", ODOO_POS_CONFIG_ID],
  ]], { fields: ["product_id", "qty", "price_subtotal_incl", "order_id"], limit: 5000 });

  const orderIds: number[] = [...new Set(lineasOdoo.map((l: any) => l.order_id[0]))];
  const ordenes = orderIds.length > 0
    ? await callModel("pos.order", "search_read", [[["id", "in", orderIds]]], { fields: ["id", "date_order"] })
    : [];

  const ordenFecha: Record<number, string> = {};
  for (const o of ordenes) {
    // Convertir date_order UTC → fecha local CDT (UTC-5)
    const utc = new Date((o.date_order as string).replace(" ", "T") + "Z");
    utc.setHours(utc.getHours() - 5);
    ordenFecha[o.id] = utc.toISOString().split("T")[0];
  }

  const lineasOut: OdooLinea[] = [];
  const noMapeados = new Set<string>();

  for (const l of lineasOdoo) {
    const nombreRaw: string = l.product_id[1];
    const nombreMapeado = mapNombre(nombreRaw);
    if (!nombreMapeado) {
      if (!SKIP.has(nombreRaw)) noMapeados.add(nombreRaw);
      continue;
    }
    lineasOut.push({
      productoNombre: nombreMapeado,
      fecha: ordenFecha[l.order_id[0]] ?? fechaInicio,
      cantidad: Math.round(l.qty),
      // price_subtotal_incl (con IVA) en vez de price_subtotal (neto) para
      // que ventasTotales coincida con lo que se ve directamente en Odoo -
      // ver ODOO_POS_CONFIG_ID arriba para el otro ajuste relacionado.
      total: l.price_subtotal_incl,
    });
  }

  // Desglose por medio de pago (pos.payment) para las mismas órdenes.
  // is_cash_count en pos.payment.method distingue efectivo (CashDro) de
  // tarjeta/otros (Tarjeta Debito/Credito, Uber Eats, Rappi) sin hardcodear
  // nombres — si se agrega/renombra un método en Odoo, sigue clasificando bien.
  const pagos: OdooPago[] = [];
  if (orderIds.length > 0) {
    const pagosOdoo = await callModel("pos.payment", "search_read", [[
      ["pos_order_id", "in", orderIds],
    ]], { fields: ["pos_order_id", "payment_method_id", "amount"], limit: 5000 });

    const metodoIds: number[] = [...new Set(pagosOdoo.map((p: any) => p.payment_method_id[0]))];
    const metodos = metodoIds.length > 0
      ? await callModel("pos.payment.method", "search_read", [[["id", "in", metodoIds]]], { fields: ["id", "name", "is_cash_count"] })
      : [];
    const metodoMap: Record<number, { nombre: string; esEfectivo: boolean }> = {};
    for (const m of metodos) metodoMap[m.id] = { nombre: m.name, esEfectivo: m.is_cash_count };

    for (const p of pagosOdoo) {
      const metodoId = p.payment_method_id[0];
      pagos.push({
        fecha: ordenFecha[p.pos_order_id[0]] ?? fechaInicio,
        metodo: metodoMap[metodoId]?.nombre ?? p.payment_method_id[1],
        esEfectivo: metodoMap[metodoId]?.esEfectivo ?? false,
        monto: p.amount,
      });
    }
  }

  return { lineas: lineasOut, pagos, totalRegistros: lineasOut.length, fechaInicio, fechaFin, noMapeados: [...noMapeados] };
}

export async function testConexion(): Promise<{ ok: boolean; uid: number | null; error?: string }> {
  try {
    _uid = null; // reset cache para test fresco
    const uid = await getUid();
    return { ok: true, uid };
  } catch (e: any) {
    return { ok: false, uid: null, error: e.message };
  }
}
