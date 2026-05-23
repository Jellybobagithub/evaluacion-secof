import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import { useSucursal } from "@/context/SucursalContext";

function getPeriods() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleString("es-MX", { month: "long", year: "numeric" });
    options.push({ val, label });
  }
  return options;
}

function DetalleOrdenSinPrecio({ compraId }: { compraId: number }) {
  const { data: items = [], isLoading } = trpc.comprasJellyboba.detalle.useQuery({ compraId });
  if (isLoading) return <p className="text-xs text-muted-foreground p-2">Cargando...</p>;
  return (
    <table className="w-full text-xs mt-2">
      <tbody>
        {(items as any[]).map((l: any) => (
          <tr key={l.id} className="border-b last:border-0">
            <td className="py-1 pr-2 text-muted-foreground font-mono w-24">{l.sku}</td>
            <td className="py-1">{l.descripcion}</td>
            <td className="py-1 text-right tabular-nums w-20 text-muted-foreground">{Number(l.cantidad)} {l.unidad}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrdenJellybobaRow({ orden, onRecibir }: { orden: any; onRecibir: () => void }) {
  const [expandida, setExpandida] = useState(false);
  return (
    <div className={`border rounded-lg mb-2 overflow-hidden ${orden.recibida ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 cursor-pointer"
        onClick={() => setExpandida(v => !v)}>
        <button className="text-muted-foreground" onClick={e => { e.stopPropagation(); setExpandida(v => !v); }}>
          {expandida ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{orden.numeroOrden}</span>
            <span className="text-xs text-muted-foreground">{orden.fecha}</span>
            {orden.vendedor && <span className="text-xs text-muted-foreground">· {orden.vendedor}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{Number(orden.numItems)} productos</p>
        </div>
        <div onClick={e => e.stopPropagation()}>
          {!orden.recibida ? (
            <Button size="sm" variant="outline"
              className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
              onClick={onRecibir}>
              <Truck className="h-3 w-3"/> Recibir
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3"/> Recibida
            </span>
          )}
        </div>
      </div>
      {expandida && (
        <div className="px-4 pb-3 border-t bg-slate-50">
          <DetalleOrdenSinPrecio compraId={orden.id}/>
        </div>
      )}
    </div>
  );
}

export default function RecepcionMercancia() {
  const { sucursalId: globalSucursalId } = useSucursal();
  const sucursalActiva = globalSucursalId ?? 30001;
  const [tab, setTab] = useState<"jellyboba"|"externas">("jellyboba");

  // ── Jellyboba ──────────────────────────────────────────────────────────────
  const [modalRecepcion, setModalRecepcion] = useState(false);
  const [compraRecibiendo, setCompraRecibiendo] = useState<{id:number;numeroOrden:string;fecha:string}|null>(null);
  const [itemsRecepcion, setItemsRecepcion] = useState<any[]>([]);

  const { data: ordenes = [], refetch: refetchJelly } = trpc.comprasJellyboba.list.useQuery({ sucursalId: sucursalActiva });
  const { data: productosInv = [] } = trpc.inventario.productos.list.useQuery({ soloActivos: true } as any);

  const { data: itemsQuery, isLoading: loadingItems } = trpc.comprasJellyboba.obtenerItemsRecepcion.useQuery(
    { compraId: compraRecibiendo?.id ?? 0 },
    { enabled: !!compraRecibiendo }
  );
  useEffect(() => {
    if (itemsQuery && itemsQuery.length > 0) setItemsRecepcion(itemsQuery.map((i:any) => ({...i})));
  }, [itemsQuery]);

  const confirmarRecepcion = trpc.comprasJellyboba.confirmarRecepcion.useMutation({
    onSuccess: () => {
      toast.success("Recepción confirmada — inventario actualizado");
      refetchJelly();
      setModalRecepcion(false);
      setCompraRecibiendo(null);
      setItemsRecepcion([]);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const pendientesJelly = (ordenes as any[]).filter(o => !o.recibida).length;

  // ── Externas ───────────────────────────────────────────────────────────────
  const periods = getPeriods();
  const [periodoExt, setPeriodoExt] = useState(periods[0].val);
  const { data: externas = [], refetch: refetchExt } = trpc.finanzas.comprasExternas.list.useQuery(
    { sucursalId: sucursalActiva, periodo: periodoExt },
    { enabled: tab === "externas" }
  );
  const recibirExterna = trpc.finanzas.comprasExternas.recibir.useMutation({
    onSuccess: () => { toast.success("Marcada como recibida"); refetchExt(); },
    onError: (e) => toast.error(e.message),
  });

  const pendientesExt = (externas as any[]).filter(c => !c.recibida_at).length;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <PackageCheck className="h-6 w-6 text-green-600"/>
        <div>
          <h1 className="text-xl font-bold">Recepción de Mercancía</h1>
          <p className="text-xs text-muted-foreground">Verifica y confirma lo que llega a la tienda</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          ["jellyboba", "🧋 Jellyboba", pendientesJelly],
          ["externas",  "🛒 Compras Externas", pendientesExt],
        ] as const).map(([k, l, count]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab===k?"border-foreground text-foreground":"border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
            {count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Jellyboba ── */}
      {tab === "jellyboba" && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            Al recibir puedes ajustar las cantidades reales. El inventario se actualiza al confirmar.
          </p>
          {(ordenes as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin órdenes registradas.</p>
          )}
          {pendientesJelly === 0 && (ordenes as any[]).length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <CheckCircle2 className="h-4 w-4"/>
              Todas las órdenes han sido recibidas
            </div>
          )}
          {(ordenes as any[]).map((o: any) => (
            <OrdenJellybobaRow key={o.id} orden={o}
              onRecibir={() => {
                setCompraRecibiendo({ id: o.id, numeroOrden: o.numeroOrden, fecha: o.fecha });
                setModalRecepcion(true);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Tab Externas ── */}
      {tab === "externas" && (
        <div className="space-y-3">
          {/* Selector de periodo */}
          <div className="flex items-center gap-3">
            <select value={periodoExt} onChange={e => setPeriodoExt(e.target.value)}
              className="h-8 px-3 text-sm rounded border border-input bg-background">
              {periods.map(p => (
                <option key={p.val} value={p.val}>{p.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">
              {(externas as any[]).filter(c => !c.recibida_at).length} pendientes de recibir
            </span>
          </div>

          {(externas as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin compras externas este periodo.</p>
          )}

          {/* Tabla sin costos */}
          {(externas as any[]).length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Fecha</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Concepto</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Proveedor</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Cantidad</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Recepción</th>
                  </tr>
                </thead>
                <tbody>
                  {(externas as any[]).map((c: any) => (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/20 ${c.recibida_at ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{c.fecha}</td>
                      <td className="px-3 py-2 font-medium">
                        {c.concepto}
                        {c.notas && <span className="block text-xs font-normal text-muted-foreground">{c.notas}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.proveedor}</td>
                      <td className="px-3 py-2 text-center text-sm">{c.cantidad} {c.unidad}</td>
                      <td className="px-3 py-2 text-center">
                        {c.recibida_at ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-green-700">
                            <CheckCircle2 className="h-3 w-3"/> Recibida
                          </span>
                        ) : (
                          <Button size="sm" variant="outline"
                            className="h-6 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            disabled={recibirExterna.isPending}
                            onClick={() => recibirExterna.mutate({ id: c.id })}>
                            <Truck className="h-3 w-3"/> Recibir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modal recepción Jellyboba ── */}
      <Dialog open={modalRecepcion} onOpenChange={setModalRecepcion}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600"/>
              Recibir — {compraRecibiendo?.numeroOrden}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
              Ajusta las cantidades reales recibidas. Si un producto no llegó, pon 0.
              Si llegó de más, aumenta la cantidad.
            </p>
            {loadingItems && <p className="text-sm text-center py-4 text-muted-foreground">Cargando productos...</p>}
            {itemsRecepcion.length === 0 && !loadingItems && (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2"/>
                <p className="text-sm text-amber-700">No se encontraron productos mapeados en esta orden.</p>
                <p className="text-xs text-muted-foreground mt-1">Verifica que los SKUs estén en la tabla de mapeo.</p>
              </div>
            )}
            {itemsRecepcion.map((item: any, i: number) => (
              <div key={item.inv_productoId} className="flex items-center gap-3 p-2 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.invNombre}</p>
                  <p className="text-xs text-muted-foreground">Pedido: {item.cantidadEsperada} {item.unidadConteo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={()=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:Math.max(0,n[i].cantidadRecibida-1)};setItemsRecepcion(n);}}
                    className="w-7 h-7 rounded border flex items-center justify-center text-lg font-bold hover:bg-slate-100">−</button>
                  <input type="number" min={0}
                    value={item.cantidadRecibida}
                    onChange={e=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:Number(e.target.value)};setItemsRecepcion(n);}}
                    className={`w-16 text-center border rounded h-8 text-sm font-semibold ${
                      item.cantidadRecibida!==item.cantidadEsperada
                        ?"border-amber-400 bg-amber-50"
                        :"border-green-400 bg-green-50"
                    }`}/>
                  <button
                    onClick={()=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:n[i].cantidadRecibida+1};setItemsRecepcion(n);}}
                    className="w-7 h-7 rounded border flex items-center justify-center text-lg font-bold hover:bg-slate-100">+</button>
                </div>
                {item.cantidadRecibida!==item.cantidadEsperada && (
                  <span className={`text-xs font-medium w-8 text-right ${item.cantidadRecibida<item.cantidadEsperada?"text-red-500":"text-emerald-600"}`}>
                    {item.cantidadRecibida<item.cantidadEsperada
                      ?`−${item.cantidadEsperada-item.cantidadRecibida}`
                      :`+${item.cantidadRecibida-item.cantidadEsperada}`}
                  </span>
                )}
              </div>
            ))}

            {/* Producto extra */}
            {(()=>{
              const [extraId, setExtraId] = React.useState(0);
              const [extraQty, setExtraQty] = React.useState(1);
              return (
                <div className="border rounded-lg p-2 bg-amber-50 border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-2">+ Producto extra (no estaba en OV)</p>
                  <div className="flex gap-2 items-center">
                    <select className="flex-1 border rounded h-8 text-xs px-2" value={extraId}
                      onChange={e=>setExtraId(Number(e.target.value))}>
                      <option value={0}>Seleccionar producto...</option>
                      {(productosInv as any[]).map((p:any)=>(
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    <input type="number" min={1} value={extraQty}
                      onChange={e=>setExtraQty(Number(e.target.value))}
                      className="w-16 border rounded h-8 text-center text-sm"/>
                    <button onClick={()=>{
                      if(!extraId) return;
                      if(itemsRecepcion.find((i:any)=>i.inv_productoId===extraId)) return;
                      const opt=(productosInv as any[]).find((p:any)=>p.id===extraId);
                      setItemsRecepcion(p=>[...p,{
                        inv_productoId:extraId,
                        invNombre:opt?.nombre??"",
                        unidadConteo:"pz",
                        cantidadEsperada:0,
                        cantidadRecibida:extraQty,
                      }]);
                      setExtraId(0);setExtraQty(1);
                    }} className="px-3 h-8 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">
                      + Agregar
                    </button>
                  </div>
                </div>
              );
            })()}

            {itemsRecepcion.length > 0 && (
              <Button
                onClick={()=>{
                  if(!compraRecibiendo) return;
                  confirmarRecepcion.mutate({
                    compraId: compraRecibiendo.id,
                    sucursalId: sucursalActiva,
                    fecha: compraRecibiendo.fecha,
                    items: itemsRecepcion.map((i:any)=>({
                      inv_productoId: i.inv_productoId,
                      cantidadRecibida: i.cantidadRecibida,
                    })),
                  });
                }}
                disabled={confirmarRecepcion.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <CheckCircle2 className="h-4 w-4"/>
                {confirmarRecepcion.isPending ? "Confirmando..." : "Confirmar recepción — actualizar inventario"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
