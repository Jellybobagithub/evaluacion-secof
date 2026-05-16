import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Calendar, BarChart3, Tag, RefreshCw, Wifi, WifiOff } from "lucide-react";
import * as XLSX from "xlsx";

const MESES: Record<string,string> = {
  ene:"01",feb:"02",mar:"03",abr:"04",may:"05",jun:"06",
  jul:"07",ago:"08",sep:"09",oct:"10",nov:"11",dic:"12"
};

function parseFecha(s: string): string {
  const parts = s.trim().split(" ");
  return `${parts[2]}-${MESES[parts[1].toLowerCase()]}-${parts[0].padStart(2,"0")}`;
}

interface Linea { productoNombre: string; fecha: string; cantidad: number; precioUnitario?: number; }
interface ParseResult {
  lineas: Linea[];
  fechaInicio: string; fechaFin: string; dias: string[];
  productos: string[]; totalVasos: number; totalIngresos: number;
  noMapeados: string[];
  preciosPorFamilia: Record<string, number>;
}

const SKIP = new Set(["Descuento Locatario"]);
const NEGATIVOS = new Set(["Cortesia Colaborador", "Cortesia"]); // precio negativo = descuento
const PREFIJOS: Record<string,string> = {
  "Caliente":"Snowtea Caliente","Chamoy":"Snowtea Chamoy",
  "Clasico":"Snowtea Clasico","Yogurt":"Snowtea Yogurt",
  "Fra-T":"Fra-T","Topping":"Topping Extra","Cortesia":"Cortesia",
};
const SABOR_FIX: Record<string,string> = { "Lichi":"Lichie" };

function getFamilia(nombreRaw: string): string | null {
  const base = nombreRaw.split(" ")[0];
  return PREFIJOS[base] ?? null;
}

function mapNombre(raw: string): string | null {
  if (SKIP.has(raw)) return null;
  const base = raw.split(" ")[0];
  const saborRaw = raw.slice(base.length + 1);
  const sabor = SABOR_FIX[saborRaw] ?? saborRaw;
  const nombre = PREFIJOS[base];
  return nombre ? `${nombre}|${base === "Topping" ? "" : sabor}` : null;
}

function parseExcelOdoo(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  // Detectar si el Excel tiene columna de precio (par cantidad+precio por dia)
  // Fila 3: si dice "Precio total" entonces tiene precios
  const tienePrecios = rows[3] && (rows[3] as any[]).some(v => String(v || "").toLowerCase().includes("precio"));

  // Fila 2: fechas — cada fecha ocupa 1 col (solo cantidad) o 2 cols (cantidad+precio)
  const colsPorDia = tienePrecios ? 2 : 1;
  const fechas: string[] = [];
  let col = 1;
  while (col < (rows[2] as any[]).length) {
    const v = (rows[2] as any[])[col];
    if (!v) break;
    fechas.push(parseFecha(String(v)));
    col += colsPorDia;
  }

  const lineas: Linea[] = [];
  const noMapeados = new Set<string>();
  const productosSet = new Set<string>();

  // Acumular totales por familia para calcular precio promedio
  const familiaTotales: Record<string, { pesos: number; vasos: number }> = {};

  for (let i = 5; i < rows.length; i++) {
    const row = rows[i] as any[];
    if (!row[0]) continue;
    const nombreRaw = String(row[0]).trim();

    // Saltar negativos (cortesías = descuentos en Odoo)
    if (NEGATIVOS.has(nombreRaw)) continue;
    if (SKIP.has(nombreRaw)) continue;

    const mapped = mapNombre(nombreRaw);
    if (!mapped) { noMapeados.add(nombreRaw); continue; }
    productosSet.add(nombreRaw);

    const familia = getFamilia(nombreRaw);

    for (let j = 0; j < fechas.length; j++) {
      const cantCol = 1 + j * colsPorDia;
      const precioCol = tienePrecios ? 2 + j * colsPorDia : null;

      const cant = Number(row[cantCol] ?? 0);
      const precioTotal = precioCol ? Number(row[precioCol] ?? 0) : 0;

      if (cant > 0) {
        const precioUnitario = cant > 0 && precioTotal > 0 ? precioTotal / cant : undefined;
        lineas.push({ productoNombre: nombreRaw, fecha: fechas[j], cantidad: cant, precioUnitario });

        // Acumular para precio por familia
        if (familia && precioTotal > 0 && cant > 0) {
          if (!familiaTotales[familia]) familiaTotales[familia] = { pesos: 0, vasos: 0 };
          familiaTotales[familia].pesos += precioTotal;
          familiaTotales[familia].vasos += cant;
        }
      }
    }
  }

  // Calcular precio promedio por familia (redondeado a 2 decimales)
  const preciosPorFamilia: Record<string, number> = {};
  for (const [familia, totales] of Object.entries(familiaTotales)) {
    if (totales.vasos > 0) {
      preciosPorFamilia[familia] = Math.round((totales.pesos / totales.vasos) * 100) / 100;
    }
  }

  const fechasOrdenadas = [...fechas].sort();

  // Leer totales directamente de la fila Total del Excel (cols finales = total oficial Odoo)
  // La fila Total (rows[4]) tiene al final: [..., totalQty, totalPrecio]
  let totalVasos = 0;
  let totalIngresos = 0;
  try {
    const totalRow = (rows[4] as any[]) || [];
    // Los últimos dos valores numéricos son qty y precio total
    const numerics = totalRow.filter(v => typeof v === "number" && v > 0);
    if (numerics.length >= 2) {
      totalVasos = numerics[numerics.length - 2];    // penúltimo = vasos totales
      totalIngresos = numerics[numerics.length - 1];  // último = precio total
    }
    // Fallback: calcular desde líneas si no se pudo leer
    if (!totalVasos || !totalIngresos) {
      totalVasos = lineas.reduce((s, l) => s + l.cantidad, 0);
      totalIngresos = lineas.reduce((s, l) => s + l.cantidad * (l.precioUnitario ?? 0), 0);
    }
  } catch {
    totalVasos = lineas.reduce((s, l) => s + l.cantidad, 0);
    totalIngresos = lineas.reduce((s, l) => s + l.cantidad * (l.precioUnitario ?? 0), 0);
  }

  return {
    lineas, fechaInicio: fechasOrdenadas[0], fechaFin: fechasOrdenadas[fechasOrdenadas.length - 1],
    dias: fechasOrdenadas, productos: Array.from(productosSet),
    totalVasos, totalIngresos, noMapeados: Array.from(noMapeados), preciosPorFamilia,
  };
}

export default function ImportarVentasOdoo() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const [sucursalId, setSucursalId] = useState<number | null>(null);

  const importarMut = trpc.inventario.ventas.importarOdooExcel.useMutation({
    onSuccess: (res) => {
      setResultado(res);
      toast.success(`${res.insertados} registros importados en ${res.diasImportados} dias`);
      if (res.preciosActualizados > 0) toast.success(`${res.preciosActualizados} precios actualizados en SECOF`);
      if (res.noMapeados?.length > 0) toast.warning(`${res.noMapeados.length} productos sin mapeo`);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  // ─── Sync directo desde Odoo ──────────────────────────────────────────────
  const [fechaInicioSync, setFechaInicioSync] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [fechaFinSync, setFechaFinSync] = useState(new Date().toISOString().split("T")[0]);
  const [resultadoSync, setResultadoSync] = useState<{insertados:number;diasImportados:number;noMapeados:string[]} | null>(null);
  const [sucursalIdSync, setSucursalIdSync] = useState<number | null>(null);

  const { data: statusOdoo } = trpc.inventario.ventas.testOdoo.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const syncMut = trpc.inventario.ventas.syncFromOdoo.useMutation({
    onSuccess: (res) => {
      setResultadoSync({ insertados: res.insertados, diasImportados: res.diasImportados, noMapeados: res.noMapeados });
      toast.success(`✅ ${res.insertados} productos sincronizados en ${res.diasImportados} días`);
      if (res.noMapeados.length > 0) toast.warning(`⚠️ ${res.noMapeados.length} sin mapeo: ${res.noMapeados.slice(0,3).join(", ")}`);
    },
    onError: (e) => toast.error("Error sync: " + e.message),
  });

  const handleSync = () => {
    const sid = sucursalIdSync ?? sucursales[0]?.id;
    if (!sid) return toast.error("Selecciona una sucursal");
    syncMut.mutate({ sucursalId: sid, fechaInicio: fechaInicioSync, fechaFin: fechaFinSync, reemplazar: true });
  };

  const procesarArchivo = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { toast.error("Solo .xlsx o .xls"); return; }
    setArchivo(file); setResultado(null);
    try { setParsed(parseExcelOdoo(await file.arrayBuffer())); }
    catch (e) { toast.error("Error al leer el Excel"); console.error(e); }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) procesarArchivo(f);
  }, [procesarArchivo]);

  const resetear = () => { setArchivo(null); setParsed(null); setResultado(null); };

  const resumenDias = parsed ? parsed.dias.reduce((acc, fecha) => {
    acc[fecha] = parsed.lineas.filter(l => l.fecha === fecha).reduce((s, l) => s + l.cantidad, 0);
    return acc;
  }, {} as Record<string, number>) : {};

  const tienePrecios = parsed && parsed.totalIngresos > 0;

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* ── Panel Sync Directo Odoo ─────────────────────────────────────────── */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-800">
            {statusOdoo?.ok
              ? <><Wifi className="h-5 w-5 text-green-600" /> Sincronizar desde Odoo</>
              : <><WifiOff className="h-5 w-5 text-red-500" /> Conexión Odoo</>
            }
            {statusOdoo?.ok && (
              <span className="ml-2 text-xs font-normal bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                Conectado ✓
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusOdoo?.ok === false ? (
            <p className="text-sm text-red-600">No se puede conectar con Odoo. Verifica el servidor.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Sucursal</label>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={sucursalIdSync ?? ""}
                    onChange={e => setSucursalIdSync(Number(e.target.value))}
                  >
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div />
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Desde</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={fechaInicioSync} onChange={e => setFechaInicioSync(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Hasta</label>
                  <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
                    value={fechaFinSync} onChange={e => setFechaFinSync(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSync} disabled={syncMut.isPending}
                className="w-full bg-green-700 hover:bg-green-800 text-white gap-2">
                <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
                {syncMut.isPending ? "Sincronizando..." : "Sincronizar Ventas"}
              </Button>
              {resultadoSync && (
                <div className="bg-white border border-green-200 rounded p-3 text-sm space-y-1">
                  <p className="font-medium text-green-800">✅ Sincronización completada</p>
                  <p className="text-gray-600">{resultadoSync.insertados} productos · {resultadoSync.diasImportados} días</p>
                  {resultadoSync.noMapeados.length > 0 && (
                    <p className="text-amber-600 text-xs">Sin mapeo: {resultadoSync.noMapeados.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── XLSX Manual (abajo, como opción alternativa) ──────────────────── */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-teal-600" />
          Importar Ventas desde Odoo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el reporte de Odoo con <strong>cantidad y precio total</strong> para actualizar ventas y precios automaticamente.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium mb-2 block">Sucursal destino</label>
          <select value={sucursalId ?? ""} onChange={e => setSucursalId(Number(e.target.value))}
            className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Selecciona sucursal...</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </CardContent>
      </Card>

      {!parsed && (
        <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${dragging ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-slate-50 hover:border-teal-400"}`}
          onClick={() => document.getElementById("file-input-odoo")?.click()}>
          <input id="file-input-odoo" type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); }} />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? "text-teal-600" : "text-slate-400"}`} />
          <p className="text-sm font-medium text-slate-600">{dragging ? "Suelta aqui" : "Arrastra el Excel de Odoo aqui"}</p>
          <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
          <div className="mt-4 inline-flex flex-col gap-2 text-xs text-slate-500">
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
              Reporte: <strong>Analisis de Punto de Venta</strong> → Tabla dinamica
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-700">
              Con columnas de <strong>Cantidad y Precio total</strong> por dia para actualizar precios
            </div>
          </div>
        </div>
      )}

      {parsed && !resultado && (
        <div className="space-y-4">
          {/* Info archivo */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-800">{archivo?.name}</p>
                    <p className="text-xs text-teal-600 mt-0.5">
                      {parsed.dias.length} dias · {parsed.productos.length} productos · {parsed.totalVasos.toLocaleString()} vasos
                      {tienePrecios && ` · $${parsed.totalIngresos.toLocaleString("es-MX", {maximumFractionDigits:0})} ingresos`}
                    </p>
                    <p className="text-xs text-teal-700 mt-1 font-medium">
                      <Calendar className="w-3 h-3 inline mr-1" />{parsed.fechaInicio} → {parsed.fechaFin}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetear}><X className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {/* Precios detectados */}
          {tienePrecios && Object.keys(parsed.preciosPorFamilia).length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="py-3 px-4 border-b border-blue-200">
                <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Precios detectados — se actualizaran en SECOF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(parsed.preciosPorFamilia).map(([familia, precio]) => (
                    <div key={familia} className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                      <p className="text-xs text-slate-500 truncate">{familia}</p>
                      <p className="text-sm font-bold text-blue-700">${precio.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No mapeados */}
          {parsed.noMapeados.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Sin mapeo ({parsed.noMapeados.length}) — se omitiran:</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parsed.noMapeados.map(n => <span key={n} className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{n}</span>)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumen por dia */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-500" />Resumen por dia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-64 overflow-y-auto">
                {parsed.dias.sort().map(fecha => {
                  const total = resumenDias[fecha] ?? 0;
                  const max = Math.max(...Object.values(resumenDias));
                  const pct = max > 0 ? (total / max) * 100 : 0;
                  const d = new Date(fecha + "T12:00:00");
                  return (
                    <div key={fecha} className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">{d.toLocaleDateString("es-MX",{weekday:"short"})}</p>
                      <p className="text-[10px] text-slate-400">{d.getDate()}/{d.getMonth()+1}</p>
                      <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{width:`${pct}%`}} />
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-1">{total}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            <strong>Atencion:</strong> Se borraran todas las ventas de la sucursal del <strong>{parsed.fechaInicio}</strong> al <strong>{parsed.fechaFin}</strong> y se reemplazaran con los datos del Excel.
            {tienePrecios && " Los precios en SECOF se actualizaran segun los precios de Odoo."}
          </div>

          <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 font-semibold"
            onClick={() => { if (!parsed || !sucursalId) return;
              importarMut.mutate({
                sucursalId, lineas: parsed.lineas,
                preciosPorFamilia: parsed.preciosPorFamilia,
                reemplazarRango: { inicio: parsed.fechaInicio, fin: parsed.fechaFin },
              });
            }}
            disabled={!sucursalId || importarMut.isPending}>
            {importarMut.isPending
              ? `Importando...`
              : `Importar ${parsed.totalVasos.toLocaleString()} vasos${tienePrecios ? " y actualizar precios" : ""}`}
          </Button>
          {!sucursalId && <p className="text-xs text-red-500 text-center -mt-2">Selecciona una sucursal primero</p>}
        </div>
      )}

      {resultado && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-green-800">Importacion exitosa</p>
            <div className="text-sm text-green-700 mt-2 space-y-1">
              <p>{resultado.insertados?.toLocaleString()} registros en {resultado.diasImportados} dias</p>
              {resultado.preciosActualizados > 0 && <p>{resultado.preciosActualizados} precios actualizados</p>}
            </div>
            <Button variant="outline" className="mt-4" onClick={resetear}>Importar otro archivo</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">Como obtener el reporte correcto de Odoo:</p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Punto de Venta → Reportes → <strong>Analisis de Punto de Venta</strong></li>
            <li>Filtra por sucursal y rango de fechas</li>
            <li>Vista de <strong>Tabla dinamica</strong></li>
            <li>Filas: <strong>Producto</strong> · Columnas: <strong>Fecha de la Orden</strong></li>
            <li>Medidas: activar <strong>Cantidad de producto</strong> Y <strong>Precio total</strong></li>
            <li>Exportar como <strong>XLSX</strong></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
