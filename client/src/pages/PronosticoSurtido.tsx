import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, PackagePlus, History, CheckCircle2, Pencil, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";

const CATEGORIAS_ORDEN = ["Jarabes","Polvos","Tes","Toppings","Desechables","Varios","Insumos"];

function badgeEstado(estado: string) {
  if (estado === "urgente") return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded" style={{background:"#FCEBEB",color:"#A32D2D"}}>Urgente</span>;
  if (estado === "surtir")  return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded" style={{background:"#FAEEDA",color:"#854F0B"}}>Surtir</span>;
  return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded" style={{background:"#EAF3DE",color:"#3B6D11"}}>OK</span>;
}

export default function PronosticoSurtido() {
  const [tab, setTab] = useState<"pronostico"|"historial"|"isla">("pronostico");
  const [editIsla, setEditIsla] = useState<Record<number,number>>({});
  const [notasIsla, setNotasIsla] = useState("");
  const [sucursalId, setSucursalId] = useState<number|null>(null);
  const [dias, setDias] = useState(15);
  const [buffer, setBuffer] = useState(20);
  const [editItems, setEditItems] = useState<Record<number,number>>({});
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [surtidoAbierto, setSurtidoAbierto] = useState<number|null>(null);
  const [notasSurtido, setNotasSurtido] = useState("");
  const [ajustandoId, setAjustandoId] = useState<number|null>(null);
  const [ajusteItems, setAjusteItems] = useState<Record<number,number>>({});
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [catOpen, setCatOpen] = useState<Record<string,boolean>>({});

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const sucursalEfectiva = sucursalId ?? sucursales[0]?.id ?? null;

  const { data: pronostico, isLoading, refetch } = trpc.inventario.ventas.pronosticoSurtido.useQuery(
    { sucursalId: sucursalEfectiva!, diasProyeccion: dias, bufferPct: buffer },
    { enabled: !!sucursalEfectiva }
  );
  const { data: historial = [], refetch: refetchHist } = trpc.inventario.ventas.surtidoHistorial.useQuery(
    { sucursalId: sucursalEfectiva!, limit: 30 },
    { enabled: !!sucursalEfectiva && tab === "historial" }
  );
  const { data: detalleSurtido } = trpc.inventario.ventas.surtidoDetalle.useQuery(
    { id: surtidoAbierto! }, { enabled: !!surtidoAbierto }
  );

  const ajustarMut = trpc.inventario.ventas.surtidoAjustar.useMutation({
    onSuccess: () => {
      toast.success("Ajuste guardado — inventario de bodega actualizado");
      setAjustandoId(null);
      setAjusteItems({});
      setAjusteMotivo("");
      refetchHist();
    },
    onError: e => toast.error(e.message),
  });

  const guardarMut = trpc.inventario.ventas.surtidoGuardar.useMutation({
    onSuccess: (res) => {
      toast.success("Surtido guardado como borrador");
      setTab("historial");
      refetchHist();
    },
    onError: e => toast.error(e.message),
  });
  const confirmarMut = trpc.inventario.ventas.surtidoConfirmar.useMutation({
    onSuccess: () => {
      toast.success("Surtido confirmado — inventario actualizado");
      setSurtidoAbierto(null);
      refetchHist();
    },
    onError: e => toast.error(e.message),
  });

  const items = pronostico?.items ?? [];
  const itemsActivos = soloUrgentes ? items.filter(i => i.estado !== "ok") : items;

  const porCategoria = useMemo(() => {
    const m: Record<string, typeof items> = {};
    for (const item of itemsActivos) {
      const cat = item.categoria || "Varios";
      if (!m[cat]) m[cat] = [];
      m[cat].push(item);
    }
    return m;
  }, [itemsActivos]);

  const categoriasOrdenadas = CATEGORIAS_ORDEN.filter(c => porCategoria[c]);
  const categoriasExtra = Object.keys(porCategoria).filter(c => !CATEGORIAS_ORDEN.includes(c));

  function getCantidad(item: any) {
    if (editItems[item.id] !== undefined) return editItems[item.id];
    return (item.pedirCajas ?? item.necesidadPiezas) > 0 ? Math.ceil(item.pedirCajas ?? item.necesidadPiezas) : 0;
  }

  function handleCrearSurtido() {
    if (!sucursalEfectiva || !pronostico) return;
    const itemsConCantidad = items
      .filter(i => getCantidad(i) > 0)
      .map(i => ({ productoId: i.id, cantidadPiezas: getCantidad(i), cantidadGramos: 0 }));
    if (!itemsConCantidad.length) { toast.error("No hay productos con cantidad > 0"); return; }
    guardarMut.mutate({
      sucursalId: sucursalEfectiva,
      fecha: new Date().toISOString().split("T")[0],
      notas: notasSurtido,
      items: itemsConCantidad,
    });
  }

  const confirmarIslaMut = trpc.inventario.ventas.surtidoIslaConfirmar.useMutation({
    onSuccess: () => { toast.success("✅ Surtido a isla confirmado — inventario actualizado"); setEditIsla({}); refetch(); },
    onError: e => toast.error(e.message),
  });

  // Calcular items para surtido a isla
  const diasHist = pronostico?.diasHistorico ?? 28;
  const islaItems = useMemo(() => {
    // consumoPiezas = consumo proyectado para diasProyeccion días (no diasHistorico)
    const diasProyec = pronostico?.diasProyeccion ?? 15;

    const base = (pronostico?.items ?? [])
      .filter(i => i.consumoPiezas > 0)
      .map(i => {
        const ppc = (i as any).ppc || 1;
        const fc  = (i as any).factorConversion || 1;
        const nombreL = i.nombre.toLowerCase();
        const isVaso   = nombreL.includes('vaso');
        const isPopote = nombreL.includes('popote');

        // Tasa diaria en piezas individuales (consumoPiezas ya está proyectado a diasProyec días)
        const cdPcs    = i.consumoPiezas / diasProyec;
        const need7Pcs = cdPcs * 7;
        // Stock en piezas individuales (ppc=1 para vasos/popotes contados en pzas)
        const islaPcs    = i.stockIslaPiezas  * ppc;
        const bodegaPcs  = i.stockBodegaPiezas * ppc;
        const deficitPcs = Math.max(0, need7Pcs - islaPcs);

        // Unidad de paquete para mostrar y redondear
        const paqSize    = isVaso ? 50 : isPopote ? 300 : (ppc > 1 ? ppc : fc);
        const transferirPcs = deficitPcs > 0 ? Math.ceil(deficitPcs / paqSize) * paqSize : 0;
        const estado = islaPcs < cdPcs * 3 ? 'urgente' : deficitPcs > 0 ? 'surtir' : 'ok';

        return {
          ...i, isVaso, isPopote, ppc, fc, paqSize,
          cdPcs:        Math.round(cdPcs*10)/10,
          need7Pcs:     Math.round(need7Pcs*10)/10,
          minRecPcs:    Math.round(cdPcs*5*10)/10,
          maxRecPcs:    Math.round(cdPcs*10*10)/10,
          deficitPcs:   Math.round(deficitPcs*10)/10,
          transferirPcs, islaPcs, bodegaPcs,
          bodegaOK:     bodegaPcs >= transferirPcs,
          estado,
        };
      })
      .filter(i => i.cdPcs > 0);

    // ── Regla de paridad vasos ↔ popotes ─────────────────────────────────────
    // Isla siempre debe tener la misma cantidad individual de vasos y popotes.
    // Surtir el máximo que necesite cualquiera de los dos, en múltiplos de 300
    // (LCM de 50 y 300), para que ambos queden en paquetes enteros.
    const vIdx = base.findIndex(i => i.isVaso);
    const pIdx = base.findIndex(i => i.isPopote);
    if (vIdx >= 0 && pIdx >= 0) {
      const maxNeed = Math.max(base[vIdx].transferirPcs, base[pIdx].transferirPcs);
      const paridad = maxNeed > 0 ? Math.ceil(maxNeed / 300) * 300 : 0;
      base[vIdx] = { ...base[vIdx], transferirPcs: paridad, bodegaOK: base[vIdx].bodegaPcs >= paridad, paridad: true };
      base[pIdx] = { ...base[pIdx], transferirPcs: paridad, bodegaOK: base[pIdx].bodegaPcs >= paridad, paridad: true };
    }

    return base.sort((a,b) =>
      ({urgente:0,surtir:1,ok:2}[a.estado]||2) - ({urgente:0,surtir:1,ok:2}[b.estado]||2)
      || a.nombre.localeCompare(b.nombre)
    );
  }, [pronostico]);

  const urgentesCount = items.filter(i => i.estado === "urgente").length;
  const surtirCount   = items.filter(i => i.estado === "surtir").length;

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-1">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            Pronóstico de Surtido
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Consumo proyectado vs stock actual — ciclo de {dias} días</p>
        </div>
        <div className="flex gap-2">
          <select value={sucursalId ?? ""} onChange={e => setSucursalId(Number(e.target.value) || null)}
            className="h-9 px-3 text-sm rounded-lg border border-input bg-background">
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {[["pronostico","Pronóstico Proveedor"],["isla","🏪 Surtido a Isla"],["historial","Historial"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "pronostico" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Proyección:</span>
              <select value={dias} onChange={e => setDias(Number(e.target.value))}
                className="h-8 px-2 text-sm rounded border border-input bg-background">
                {[7,10,15,21,30].map(d => <option key={d} value={d}>{d} días</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Buffer:</span>
              <select value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                className="h-8 px-2 text-sm rounded border border-input bg-background">
                {[0,10,15,20,25,30].map(b => <option key={b} value={b}>{b}%</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={soloUrgentes} onChange={e => setSoloUrgentes(e.target.checked)} className="rounded" />
              <span className="text-muted-foreground">Solo urgentes/surtir</span>
            </label>
            <button onClick={() => refetch()} className="ml-auto text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>

          {pronostico && (
            <div className="grid grid-cols-4 gap-3">
              {[
                ["Promedio diario", `${pronostico.promedioDiario} vasos`, "text-teal-700"],
                ["Proyectado", `${Math.round(pronostico.promedioDiario * dias)} vasos`, "text-blue-700"],
                [`Urgentes`, urgentesCount, "text-red-700"],
                [`A surtir`, surtirCount, "text-amber-700"],
              ].map(([l,v,c]) => (
                <div key={String(l)} className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{l}</p>
                  <p className={`text-xl font-medium ${c}`}>{v}</p>
                </div>
              ))}
            </div>
          )}

          {isLoading && <div className="py-12 text-center text-muted-foreground text-sm">Calculando pronóstico...</div>}

          {!isLoading && pronostico && (
            <>
              {[...categoriasOrdenadas, ...categoriasExtra].map(cat => {
                const catItems = porCategoria[cat];
                if (!catItems?.length) return null;
                const isOpen = catOpen[cat] !== false;
                const urgCat = catItems.filter(i => i.estado==="urgente").length;
                return (
                  <Card key={cat} className="overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 border-b hover:bg-muted/50 transition-colors"
                      onClick={() => setCatOpen(p => ({...p,[cat]:!isOpen}))}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat}</span>
                        <span className="text-xs text-muted-foreground">{catItems.length} productos</span>
                        {urgCat > 0 && <span className="text-xs px-1.5 py-0.5 rounded" style={{background:"#FCEBEB",color:"#A32D2D"}}>{urgCat} urgente{urgCat>1?"s":""}</span>}
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Insumo</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Bodega</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Isla</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Consumo {dias}d</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Cobertura</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Pedir</th>
                              <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catItems.map(item => (
                              <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/20 ${item.estado==="urgente"?"bg-red-50/30":item.estado==="surtir"?"bg-amber-50/20":""}`}>
                                <td className="px-4 py-2.5 font-medium">{item.nombre}</td>
                                <td className="px-2 py-2.5 text-center text-muted-foreground">{item.stockBodegaPiezas} <span className="text-xs">{item.unidad}</span></td>
                                <td className="px-2 py-2.5 text-center text-muted-foreground">{item.stockIslaPiezas} <span className="text-xs">{item.unidad}</span></td>
                                <td className="px-2 py-2.5 text-center text-muted-foreground">{item.consumoPiezas} <span className="text-xs">{item.unidad}</span></td>
                                <td className="px-2 py-2.5 text-center">
                                  <span className={item.diasCobertura <= 7 ? "text-red-700 font-medium" : item.diasCobertura <= 15 ? "text-amber-700 font-medium" : "text-muted-foreground"}>
                                    {item.diasCobertura >= 999 ? "∞" : `${item.diasCobertura}d`}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <input type="number" min="0" step="1"
                                      value={editItems[item.id] !== undefined ? editItems[item.id] : (item.estado !== "ok" ? ((item as any).pedirCajas ?? 0) : 0)}
                                      onChange={e => setEditItems(p => ({...p,[item.id]:Number(e.target.value)}))}
                                      className={`w-14 h-7 text-center text-sm rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring ${item.estado === "ok" && (editItems[item.id] === undefined || editItems[item.id] === 0) ? "border-dashed border-muted-foreground/30 text-muted-foreground/50" : "border-input"}`}
                                    />
                                    <span className="text-[10px] text-muted-foreground">{(item as any).unidadCompra || item.unidad}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2.5 text-center">{badgeEstado(item.estado)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}

              <Card className="border-teal-200">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">Crear pedido de surtido</p>
                  <textarea value={notasSurtido} onChange={e => setNotasSurtido(e.target.value)}
                    placeholder="Notas opcionales (proveedor, fecha de entrega esperada...)"
                    className="w-full h-16 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Se incluirán {items.filter(i => getCantidad(i) > 0).length} productos con cantidad &gt; 0
                    </p>
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                      onClick={handleCrearSurtido} disabled={guardarMut.isPending}>
                      <PackagePlus className="w-4 h-4" />
                      {guardarMut.isPending ? "Guardando..." : "Guardar como pedido"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "isla" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>Surtido Bodega → Isla:</strong> Calcula cuánto mover de bodega a isla para tener <strong>7 días</strong> de stock.
            Vasos en múltiplos de 50 · Popotes en múltiplos de 300 · Demás productos por caja/paquete.
          </div>

          {isLoading && <div className="py-8 text-center text-muted-foreground text-sm">Calculando...</div>}

          {!isLoading && islaItems.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Urgentes (isla)", islaItems.filter(i=>i.estado==="urgente").length, "text-red-700"],
                  ["A surtir",        islaItems.filter(i=>i.estado==="surtir").length,  "text-amber-700"],
                  ["OK",              islaItems.filter(i=>i.estado==="ok").length,      "text-emerald-700"],
                ].map(([l,v,cl]) => (
                  <div key={String(l)} className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{l}</p>
                    <p className={`text-xl font-medium ${cl}`}>{v}</p>
                  </div>
                ))}
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Producto</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Isla actual</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Necesidad 7d</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Min↔Max rec.</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Bodega</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Transferir</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {islaItems.map(item => {
                        const paqSize = (item as any).paqSize || 1;
                        const rawVal  = editIsla[item.id] !== undefined ? editIsla[item.id] : (item as any).transferirPcs;
                        const paqCount = paqSize > 1 ? Math.round(rawVal / paqSize) : null;
                        const islaShow   = paqSize > 1 ? `${Math.round((item as any).islaPcs / paqSize)} paq` : `${(item as any).islaPcs}`;
                        const need7Show  = paqSize > 1 ? `${Math.round((item as any).need7Pcs / paqSize)} paq` : `${(item as any).need7Pcs}`;
                        const minShow    = paqSize > 1 ? `${Math.round((item as any).minRecPcs / paqSize)}` : `${(item as any).minRecPcs}`;
                        const maxShow    = paqSize > 1 ? `${Math.round((item as any).maxRecPcs / paqSize)}` : `${(item as any).maxRecPcs}`;
                        const bodegaShow = paqSize > 1 ? `${Math.round((item as any).bodegaPcs / paqSize)} paq` : `${(item as any).bodegaPcs}`;
                        return (
                          <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/20 ${item.estado==="urgente"?"bg-red-50/30":item.estado==="surtir"?"bg-amber-50/20":""}`}>
                            <td className="px-3 py-2.5">
                              <div className="font-medium">{item.nombre}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {paqSize > 1 ? `paq de ${paqSize} pzas` : item.unidad}
                                {(item as any).paridad && <span className="text-blue-500">🔗 paridad vasos/popotes</span>}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <span className={(item as any).islaPcs < (item as any).minRecPcs ? "text-red-600 font-medium" : "text-muted-foreground"}>
                                {islaShow}
                              </span>
                              {paqSize > 1 && <div className="text-xs text-muted-foreground">{(item as any).islaPcs} pzas</div>}
                            </td>
                            <td className="px-2 py-2.5 text-center text-muted-foreground">
                              {need7Show}
                              {paqSize > 1 && <div className="text-xs">{(item as any).need7Pcs} pzas</div>}
                            </td>
                            <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                              <span className="text-amber-600">{minShow}</span>
                              <span className="mx-1">↔</span>
                              <span className="text-emerald-600">{maxShow}</span>
                              {paqSize > 1 && <div className="text-muted-foreground/60">paq</div>}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <span className={!(item as any).bodegaOK && rawVal > 0 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                                {bodegaShow}
                              </span>
                              {!(item as any).bodegaOK && rawVal > 0 && <div className="text-xs text-red-500">insuficiente</div>}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              {item.estado !== "ok" || rawVal > 0 ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <input type="number" min="0" step={paqSize}
                                    value={rawVal}
                                    onChange={e => setEditIsla(p => ({...p,[item.id]:Number(e.target.value)}))}
                                    className="w-16 h-7 text-center text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                                  {paqCount !== null
                                    ? <span className="text-[10px] text-muted-foreground">{paqCount} paq × {paqSize}</span>
                                    : <span className="text-[10px] text-muted-foreground">{item.unidad}</span>}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-2 py-2.5 text-center">{badgeEstado(item.estado)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="border-teal-200">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">Confirmar surtido a isla</p>
                  <textarea value={notasIsla} onChange={e => setNotasIsla(e.target.value)}
                    placeholder="Notas opcionales..."
                    className="w-full h-14 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {islaItems.filter(i => (editIsla[i.id]??((i as any).transferirPcs??0))>0).length} productos a transferir
                    </p>
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                      disabled={confirmarIslaMut.isPending || islaItems.filter(i=>(editIsla[i.id]??i.transferir)>0).length===0}
                      onClick={() => {
                        if (!sucursalEfectiva) return;
                        const items = islaItems
                          .filter(i => (editIsla[i.id]??i.transferir)>0)
                          .map(i => ({ productoId: i.id, cantidad: editIsla[i.id]??((i as any).transferirPcs??0) }));
                        confirmarIslaMut.mutate({ sucursalId: sucursalEfectiva, items, notas: notasIsla });
                      }}>
                      <PackagePlus className="w-4 h-4" />
                      {confirmarIslaMut.isPending ? "Confirmando..." : "Confirmar transferencia"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {!isLoading && islaItems.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">Sin datos de consumo disponibles. Importa ventas primero.</div>
          )}
        </div>
      )}

      {tab === "historial" && (
        <div className="space-y-4">
          {historial.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              Sin surtidos registrados aún
            </div>
          )}
          {historial.map((s: any) => (
            <Card key={s.id} className={s.estado==="confirmado"?"border-green-200":""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{new Date(s.fecha+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"long",year:"numeric"})}</span>
                      {s.estado==="confirmado"
                        ? <span className="text-xs px-2 py-0.5 rounded" style={{background:"#EAF3DE",color:"#3B6D11"}}>Confirmado</span>
                        : <span className="text-xs px-2 py-0.5 rounded" style={{background:"#FAEEDA",color:"#854F0B"}}>Borrador</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.numProductos} productos · {s.totalPiezas} piezas totales
                      {s.creadoPorNombre && ` · ${s.creadoPorNombre}`}
                    </p>
                    {s.notas && <p className="text-xs text-muted-foreground mt-1 italic">{s.notas}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSurtidoAbierto(surtidoAbierto===s.id?null:s.id)}>
                    {surtidoAbierto===s.id ? "Cerrar" : "Ver detalle"}
                  </Button>
                </div>

                {surtidoAbierto === s.id && detalleSurtido && (
                  <div className="mt-4 space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-muted/30 border-b">
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Producto</th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Categoría</th>
                            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                              {ajustandoId === s.id ? "Cantidad real" : "Cantidad"}
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Unidad</th>
                            {ajustandoId === s.id && <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Δ</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {detalleSurtido.items.map((item: any) => {
                            const editVal = ajusteItems[item.productoId] ?? item.cantidadPiezas;
                            const delta = editVal - item.cantidadPiezas;
                            return (
                              <tr key={item.id} className={`border-b last:border-0 ${ajustandoId === s.id && delta !== 0 ? "bg-amber-50/40" : ""}`}>
                                <td className="px-3 py-2 font-medium">{item.nombre}</td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">{item.categoria}</td>
                                <td className="px-3 py-2 text-center">
                                  {ajustandoId === s.id ? (
                                    <input type="number" min="0" step="1"
                                      value={editVal}
                                      onChange={e => setAjusteItems(p => ({...p,[item.productoId]:Number(e.target.value)}))}
                                      className="w-16 h-7 text-center text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  ) : (
                                    <span className="font-medium">{item.cantidadPiezas}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">{item.unidadCompra}</td>
                                {ajustandoId === s.id && (
                                  <td className="px-3 py-2 text-center text-xs font-medium">
                                    {delta !== 0 ? (
                                      <span className={delta > 0 ? "text-emerald-600" : "text-red-600"}>
                                        {delta > 0 ? "+" : ""}{delta}
                                      </span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Modo ajuste */}
                    {ajustandoId === s.id && (
                      <div className="space-y-2 pt-2 border-t">
                        <input type="text" placeholder="Motivo del ajuste (ej: proveedor entregó menos, error de captura...)"
                          value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)}
                          className="w-full h-8 px-3 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setAjustandoId(null); setAjusteItems({}); setAjusteMotivo(""); }}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                            disabled={ajustarMut.isPending}
                            onClick={() => ajustarMut.mutate({
                              surtidoId: s.id,
                              items: detalleSurtido.items.map((i: any) => ({
                                productoId: i.productoId,
                                cantidadNueva: ajusteItems[i.productoId] ?? i.cantidadPiezas,
                              })),
                              motivo: ajusteMotivo || undefined,
                            })}>
                            {ajustarMut.isPending ? "Guardando..." : "Guardar ajuste"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Acciones normales */}
                    {detalleSurtido.estado === "borrador" && ajustandoId !== s.id && (
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground flex-1 self-center">Al confirmar, se sumará al inventario de bodega</p>
                        <Button className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          onClick={() => confirmarMut.mutate({ id: s.id })}
                          disabled={confirmarMut.isPending}>
                          <CheckCircle2 className="w-4 h-4" />
                          {confirmarMut.isPending ? "Confirmando..." : "Confirmar surtido"}
                        </Button>
                      </div>
                    )}
                    {detalleSurtido.estado === "confirmado" && ajustandoId !== s.id && (
                      <div className="flex justify-end pt-2 border-t">
                        <Button variant="outline" size="sm"
                          onClick={() => { setAjustandoId(s.id); setAjusteItems({}); setAjusteMotivo(""); }}>
                          ✏️ Ajustar cantidades
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
