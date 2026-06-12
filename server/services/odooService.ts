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

export interface OdooSyncResult {
  lineas: OdooLinea[];
  totalRegistros: number;
  fechaInicio: string;
  fechaFin: string;
  noMapeados: string[];
}

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
  const desde = `${fechaInicio} 00:00:00`;
  const hasta  = `${fechaFin} 23:59:59`;

  const lineasOdoo = await callModel("pos.order.line", "search_read", [[
    ["order_id.date_order", ">=", desde],
    ["order_id.date_order", "<=", hasta],
    ["order_id.state", "in", ["done", "invoiced", "paid"]],
  ]], { fields: ["product_id", "qty", "price_subtotal", "order_id"], limit: 5000 });

  const orderIds: number[] = [...new Set(lineasOdoo.map((l: any) => l.order_id[0]))];
  const ordenes = orderIds.length > 0
    ? await callModel("pos.order", "search_read", [[["id", "in", orderIds]]], { fields: ["id", "date_order"] })
    : [];

  const ordenFecha: Record<number, string> = {};
  for (const o of ordenes) ordenFecha[o.id] = (o.date_order as string).split(" ")[0];

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
      total: l.price_subtotal,
    });
  }

  return { lineas: lineasOut, totalRegistros: lineasOut.length, fechaInicio, fechaFin, noMapeados: [...noMapeados] };
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
