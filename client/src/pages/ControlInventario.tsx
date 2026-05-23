import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, TrendingDown, ClipboardCheck, BarChart3 } from "lucide-react";

const CATS = ["Jarabes","Polvos","Tes","Toppings","Desechables","Varios","Insumos"];
function badge(a: string) {
  if (a==="critico")  return <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-800">Critico</span>;
  if (a==="atencion") return <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">Atencion</span>;
  return <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800">OK</span>;
}

function StockTab({ sid }: { sid: number }) {
  const [fuente, setFuente] = useState<"preparacion"|"venta_odoo"|"ambos">("ambos");
  const [unidadVista, setUnidadVista] = useState<"piezas"|"gramos">("piezas");
  const { data, isLoading, refetch } = trpc.inventarioCiclo.stockTeorico.useQuery({ sucursalId: sid, fuenteConsumo: fuente });
  const byCat: Record<string,any[]> = {};
  for (const i of data?.items??[]) { const c=i.categoria||"Varios"; if(!byCat[c]) byCat[c]=[]; byCat[c].push(i); }
  const cats = CATS.filter(c=>byCat[c]).concat(Object.keys(byCat).filter(c=>!CATS.includes(c)));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={fuente} onChange={e=>setFuente(e.target.value as any)} className="h-8 px-2 text-sm rounded border border-input bg-background">
          <option value="ambos">Ambas fuentes</option>
          <option value="preparacion">Preparaciones reales</option>
          <option value="venta_odoo">Ventas x recetas</option>
        </select>
        {data?.baseDate && <span className="text-xs text-muted-foreground">Base: {data.baseDate}</span>}
        <div className="flex items-center gap-1 border rounded-md overflow-hidden text-xs ml-auto">
          <button onClick={()=>setUnidadVista("piezas")} className={"px-2.5 py-1.5 transition-colors "+(unidadVista==="piezas"?"bg-teal-600 text-white":"text-muted-foreground hover:bg-muted")}>Piezas</button>
          <button onClick={()=>setUnidadVista("gramos")} className={"px-2.5 py-1.5 transition-colors "+(unidadVista==="gramos"?"bg-teal-600 text-white":"text-muted-foreground hover:bg-muted")}>Gramos</button>
        </div>
        <button onClick={()=>refetch()} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"><RefreshCw className="w-3.5 h-3.5"/> Actualizar</button>
      </div>
      {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Calculando...</div>}
      {!data?.baseDate && !isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Sin conteo base confirmado por dueno.</div>}
      {cats.map(cat => {
        const items = byCat[cat]; if(!items?.length) return null;
        return (
          <div key={cat} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <span className="text-xs text-muted-foreground">{items.length} productos</span>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Producto</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Base</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">+Entradas</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">-Consumo</th>
                <th className="text-center px-2 py-2 text-xs font-bold text-teal-700">={unidadVista==='gramos'?'g':'pzas'} Teorico</th>
              </tr></thead>
              <tbody>
                {items.map((i:any) => (
                  <tr key={i.productoId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{i.nombre}</td>
                    <td className="px-2 py-2.5 text-center text-muted-foreground">{unidadVista==="gramos"?(i.stockBase*(i.pesoNeto||1)).toFixed(0)+"g":i.stockBase} <span className="text-xs">{unidadVista==="gramos"?"g":i.unidad}</span></td>
                    <td className="px-2 py-2.5 text-center text-emerald-700">+{unidadVista==="gramos"?(i.entradas*(i.pesoNeto||1)).toFixed(0):i.entradas}</td>
                    <td className="px-2 py-2.5 text-center text-red-600">-{unidadVista==="gramos"?(i.consumo*(i.pesoNeto||1)).toFixed(0):i.consumo}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-teal-700">{unidadVista==="gramos"?(i.stockTeorico*(i.pesoNeto||1)).toFixed(0):i.stockTeorico} <span className="text-xs font-normal">{unidadVista==="gramos"?"g":i.unidad}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function AprobTab({ sid }: { sid: number }) {
  const { user } = useAuth();
  const isOwner = ["superadmin","owner"].includes(user?.role??"");
  const [notas, setNotas] = useState("");
  const { data, isLoading, refetch } = trpc.inventarioCiclo.comparacionPendiente.useQuery({ sucursalId: sid });
  const aprobar = trpc.inventarioCiclo.aprobarConteo.useMutation({
    onSuccess: () => { toast.success("Conteo aprobado"); refetch(); },
    onError: e => toast.error(e.message),
  });
  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>;
  if (!data?.pendientes?.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30"/>
      Sin conteos pendientes de aprobacion
    </div>
  );
  const comp = data.comparacion;
  const criticos = comp.filter((c:any)=>c.alerta==="critico").length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Conteo del {data.pendientes[0]?.fechaConteo}</span>
        {criticos>0 && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">{criticos} critico(s)</span>}
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Producto</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Teorico</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Fisico</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Delta</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">% Merma</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Estado</th>
          </tr></thead>
          <tbody>
            {comp.map((i:any) => (
              <tr key={i.productoId} className={`border-b last:border-0 ${i.alerta==="critico"?"bg-red-50/40":i.alerta==="atencion"?"bg-amber-50/30":""}`}>
                <td className="px-3 py-2 font-medium">{i.nombre}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{i.teorico} {i.unidad}</td>
                <td className="px-3 py-2 text-center">{i.fisico} {i.unidad}</td>
                <td className={`px-3 py-2 text-center text-xs font-medium ${i.delta>=0?"text-emerald-600":"text-red-600"}`}>{i.delta>=0?"+":""}{i.delta}</td>
                <td className={`px-3 py-2 text-center font-semibold ${i.pctMerma>5?"text-red-700":i.pctMerma>2?"text-amber-700":"text-emerald-700"}`}>{i.pctMerma}%</td>
                <td className="px-3 py-2 text-center">{badge(i.alerta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOwner && (
        <div className="border border-teal-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Aprobar como nueva base del ciclo</p>
          <input type="text" placeholder="Notas opcionales..." value={notas} onChange={e=>setNotas(e.target.value)}
            className="w-full h-8 px-3 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"/>
          <div className="flex justify-end">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2" disabled={aprobar.isPending}
              onClick={()=>aprobar.mutate({ conteoId: data.conteoId, notas })}>
              <CheckCircle2 className="w-4 h-4"/>
              {aprobar.isPending?"Aprobando...":"Aprobar conteo"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistTab({ sid }: { sid: number }) {
  const { data, isLoading } = trpc.inventarioCiclo.historialMermas.useQuery({ sucursalId: sid, semanas: 8 });
  const sem = data?.semanas ?? [];
  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Calculando...</div>;
  if (!sem.length) return <div className="py-10 text-center text-sm text-muted-foreground"><BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30"/>Necesitas al menos 2 conteos aprobados.</div>;
  const maxM = Math.max(...sem.map((s:any)=>s.pctMerma),5);
  const prom = (sem.reduce((s:number,w:any)=>s+w.pctMerma,0)/sem.length).toFixed(1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["Promedio",prom+"%","text-teal-700"],["Criticas",sem.filter((s:any)=>s.alerta==="critico").length,"text-red-700"],["OK",sem.filter((s:any)=>s.alerta==="ok").length,"text-emerald-700"]].map(([l,v,c])=>(
          <div key={String(l)} className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={"text-2xl font-bold "+c}>{v}</p>
          </div>
        ))}
      </div>
      <div className="border rounded-lg p-4 space-y-2">
        {[...sem].reverse().map((s:any)=>(
          <div key={s.conteoId} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-24 shrink-0">{s.fecha}</span>
            <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
              <div className={"h-full rounded "+(s.alerta==="critico"?"bg-red-400":s.alerta==="atencion"?"bg-amber-400":"bg-emerald-400")} style={{width:Math.min(100,(s.pctMerma/maxM)*100)+"%"}}/>
            </div>
            <span className={"text-sm font-semibold w-12 text-right "+(s.alerta==="critico"?"text-red-700":s.alerta==="atencion"?"text-amber-700":"text-emerald-700")}>{s.pctMerma}%</span>
            {badge(s.alerta)}
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2 border-t">OK: &lt;2% · Atencion: 2-5% · Critico: &gt;5%</p>
      </div>
    </div>
  );
}

export default function ControlInventario() {
  const { sucursalId: gId } = useSucursal();
  const sid = gId ?? 30001;
  const { user } = useAuth();
  const isOwner = ["superadmin","owner"].includes(user?.role??"");
  const [tab, setTab] = useState<"stock"|"aprobacion"|"historial">("stock");
  const { data: kpi } = trpc.inventarioCiclo.kpiResumen.useQuery({ sucursalId: sid });
  const { data: cmp } = trpc.inventarioCiclo.comparacionPendiente.useQuery({ sucursalId: sid });
  const pend = cmp?.pendientes?.length ?? 0;
  const tabs: [string,string][] = [["stock","Stock Teorico"],["aprobacion",isOwner?`Aprobacion${pend>0?` (${pend})`:""}` :"Comparacion"],["historial","Historial Mermas"]];
  return (
    <div className="max-w-5xl mx-auto space-y-5 p-1">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><TrendingDown className="w-5 h-5 text-teal-600"/> Control Inventario — Ciclo Cerrado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stock teorico vs fisico · Mermas · Aprobacion</p>
        </div>
        {kpi?.baseDate && <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">Base: <span className="font-medium">{kpi.baseDate}</span></div>}
      </div>
      {kpi && (
        <div className="grid grid-cols-3 gap-3">
          {[["Productos",kpi.totalProductos,"text-teal-700"],["Stock total",kpi.totalTeorico+" u","text-blue-700"],["Bajo stock",kpi.productosUrgentes,kpi.productosUrgentes>0?"text-red-700":"text-emerald-700"]].map(([l,v,c])=>(
            <div key={String(l)} className="bg-secondary rounded-lg p-3"><p className="text-xs text-muted-foreground">{l}</p><p className={"text-xl font-bold "+c}>{v}</p></div>
          ))}
        </div>
      )}
      <div className="flex gap-1 border-b">
        {tabs.map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)} className={"px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors "+(tab===k?"border-foreground text-foreground":"border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {tab==="stock"      && <StockTab sid={sid}/>}
      {tab==="aprobacion" && <AprobTab sid={sid}/>}
      {tab==="historial"  && <HistTab  sid={sid}/>}
    </div>
  );
}
