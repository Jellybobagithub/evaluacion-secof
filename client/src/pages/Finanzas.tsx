import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Plus, Trash2, Save, Package } from "lucide-react";

const TIPO_LABELS: Record<string,string> = { fijo:"Gasto Fijo", nomina:"Nómina", variable:"Gasto Variable", extra_ingreso:"Ingreso Extra" };
const TIPO_COLORS: Record<string,string> = { fijo:"bg-orange-100 text-orange-800", nomina:"bg-purple-100 text-purple-800", variable:"bg-red-100 text-red-800", extra_ingreso:"bg-green-100 text-green-800" };
const CONCEPTOS_EXT = ["Hielos","Film","Azúcar","Leche Soya","Servilletas","Pajillas","Vasos extras","Otro"];
const COMPRA_VACIA = { fecha: new Date().toISOString().split("T")[0], concepto:"", proveedor:"Externo", cantidad:1, unidad:"pz", precioUnitario:0, total:0, notas:"" };

function fmt(n:number){ return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0}).format(n); }
function pct(n:number){ return n.toFixed(1)+"%"; }

function RowGasto({l, idx, all, setAll, setEditado}:{l:any,idx:number,all:any[],setAll:(v:any[])=>void,setEditado:(v:boolean)=>void}){
  return (
    <div className="flex gap-2 mb-1">
      <Input value={l.concepto} placeholder="Concepto" onChange={e=>{const n=[...all];n[idx]={...n[idx],concepto:e.target.value};setAll(n);setEditado(true);}} className="flex-1 h-8 text-sm"/>
      <Input type="number" value={l.monto} onChange={e=>{const n=[...all];n[idx]={...n[idx],monto:Number(e.target.value)};setAll(n);setEditado(true);}} className="w-28 h-8 text-sm text-right"/>
      <button onClick={()=>{setAll(all.filter((_:any,i:number)=>i!==idx));setEditado(true);}}><Trash2 className="h-4 w-4 text-red-500"/></button>
    </div>
  );
}

function PrecioRow({p, onSave}:{p:any, onSave:(id:number,precio:number)=>void}){
  const [editando,setEditando]=useState(false);
  const [val,setVal]=useState(Number(p.precio));
  return (
    <tr className="border-b last:border-0">
      <td className="py-1">{p.nombre}</td>
      <td className="py-1 text-right">{editando?<Input type="number" value={val} onChange={e=>setVal(Number(e.target.value))} className="h-7 w-24 text-right inline-block"/>:<span className="tabular-nums">{fmt(p.precio)}</span>}</td>
      <td className="py-1 text-right">{editando?<button onClick={()=>{onSave(p.id,val);setEditando(false);}} className="text-green-600 text-xs ml-2"><Save className="h-3 w-3 inline"/></button>:<button onClick={()=>setEditando(true)} className="text-blue-500 text-xs ml-2 hover:underline">Editar</button>}</td>
    </tr>
  );
}

export default function Finanzas(){
  const hoy=new Date();
  const [periodo,setPeriodo]=useState(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`);
  const [sucursalId,setSucursalId]=useState<number|null>(null);
  const [tab,setTab]=useState<"resumen"|"gastos"|"compras"|"precios">("resumen");
  const [lineasGasto,setLineasGasto]=useState<any[]>([]);
  const [gastosEditado,setGastosEditado]=useState(false);
  const [compraForm,setCompraForm]=useState({...COMPRA_VACIA});

  const {data:sucursales=[]}=trpc.sucursales.list.useQuery();
  const utils=trpc.useUtils();
  const {data:resumen,isLoading:loadingResumen}=trpc.finanzas.resumen.useQuery(
    {sucursalId:sucursalId!,periodo},{enabled:!!sucursalId}
  );
  const {data:gastos=[]}=trpc.finanzas.gastos.getByPeriodo.useQuery(
    {sucursalId:sucursalId!,periodo},{enabled:!!sucursalId}
  );
  useEffect(()=>{if(gastos.length>0 && !gastosEditado) setLineasGasto(gastos as any[]);},[gastos]);
  const {data:precios=[]}=trpc.finanzas.precios.list.useQuery();
  const {data:comprasExt=[],refetch:refetchCompras}=trpc.finanzas.comprasExternas.list.useQuery(
    {sucursalId:sucursalId!,periodo},{enabled:!!sucursalId}
  );

  const guardarGastos=trpc.finanzas.gastos.guardar.useMutation({onSuccess:()=>{
    setGastosEditado(false);utils.finanzas.gastos.getByPeriodo.invalidate();
    utils.finanzas.resumen.invalidate();toast.success("Gastos guardados");
  }});
  const actualizarPrecio=trpc.finanzas.precios.update.useMutation({
    onSuccess:()=>{utils.finanzas.precios.list.invalidate();toast.success("Precio actualizado");}
  });
  const guardarCompra=trpc.finanzas.comprasExternas.guardar.useMutation({onSuccess:()=>{
    refetchCompras();utils.finanzas.resumen.invalidate();
    setCompraForm({...COMPRA_VACIA});toast.success("Compra registrada");
  }});
  const eliminarCompra=trpc.finanzas.comprasExternas.eliminarById.useMutation({onSuccess:()=>{
    refetchCompras();utils.finanzas.resumen.invalidate();toast.success("Eliminado");
  }});

  const semaforo=!resumen?"gray":resumen.margen>=20?"green":resumen.margen>=10?"yellow":"red";
  const semaforoLabel:{[k:string]:string}={green:"✅ Rentable",yellow:"⚠️ Margen ajustado",red:"🔴 En riesgo",gray:"Sin datos"};
  const TABS=[
    {id:"resumen",label:"📊 Resumen"},{id:"gastos",label:"💸 Gastos"},
    {id:"compras",label:"📦 Compras Ext."},{id:"precios",label:"🏷️ Precios"}
  ] as const;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-green-600"/>
        <h1 className="text-xl font-bold">Rentabilidad de Tienda</h1>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Select onValueChange={v=>setSucursalId(Number(v))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Sucursal"/></SelectTrigger>
          <SelectContent>
            {(sucursales as any[]).filter((s:any)=>s.activa).map((s:any)=>(
              <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)} className="w-40"/>
      </div>

      {!sucursalId && (
        <div className="py-12 text-center text-muted-foreground">
          Selecciona una sucursal para ver su rentabilidad.
        </div>
      )}

      {sucursalId && (
        <div className="space-y-4">
          <div className="flex border-b gap-1">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={"px-4 py-2 text-sm font-medium border-b-2 transition-colors "+
                  (tab===t.id?"border-green-600 text-green-600":"border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          {tab==="resumen" && (
            <div className="space-y-4">
              {loadingResumen && <p className="text-sm text-muted-foreground p-4">Cargando...</p>}
              {!loadingResumen && !resumen && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Sin datos para este período. Verifica que haya ventas sincronizadas desde Odoo.
                </div>
              )}
              {resumen && (
                <>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Margen neto</p>
                          <p className="text-3xl font-bold">{pct(resumen.margen)}</p>
                          <Badge className="mt-1">{semaforoLabel[semaforo]}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Utilidad neta</p>
                          <p className={`text-2xl font-bold ${resumen.utilidad>=0?"text-green-600":"text-red-600"}`}>{fmt(resumen.utilidad)}</p>
                          <p className="text-xs text-muted-foreground">{(resumen as any).fechaInicio} → {(resumen as any).fechaFin}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Estado de Resultados</CardTitle></CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="font-semibold text-green-700 border-b">
                            <td className="py-1">💰 Ingresos totales</td>
                            <td className="text-right py-1">{fmt(resumen.totalIngresos)}</td>
                            <td className="text-right py-1 text-muted-foreground">100%</td>
                          </tr>
                          <tr className="text-muted-foreground text-xs">
                            <td className="pl-4 py-0.5">Ventas ({resumen.totalVasos} vasos)</td>
                            <td className="text-right">{fmt(resumen.totalVentas)}</td><td/>
                          </tr>
                          {resumen.totalExtrasIngreso>0 && (
                            <tr className="text-muted-foreground text-xs">
                              <td className="pl-4 py-0.5">Ingresos extra</td>
                              <td className="text-right">{fmt(resumen.totalExtrasIngreso)}</td><td/>
                            </tr>
                          )}
                          <tr className="font-semibold text-orange-700 border-t">
                            <td className="py-1">📦 CMV (Costo de Mercancía Vendida)</td>
                            <td className="text-right py-1 text-orange-700">-{fmt((resumen as any).cmvTotal??0)}</td>
                            <td className="text-right py-1 text-muted-foreground">
                              {resumen.totalIngresos>0?pct(((resumen as any).cmvTotal??0)/resumen.totalIngresos*100):"—"}
                            </td>
                          </tr>
                          <tr className="text-muted-foreground text-xs">
                            <td className="pl-4 py-0.5">Mat. prima (recetas)</td>
                            <td className="text-right">
                              {((resumen as any).cmvRecetas??0)>0
                                ? fmt((resumen as any).cmvRecetas)
                                : <span className="text-amber-500">Sin costos cargados</span>}
                            </td><td/>
                          </tr>
                          <tr className="text-muted-foreground text-xs">
                            <td className="pl-4 py-0.5">Compras Jellyboba</td>
                            <td className="text-right font-medium">{(resumen as any).cmvJellyboba>0?fmt((resumen as any).cmvJellyboba):<span className="text-amber-500 text-xs">Sin órdenes en periodo</span>}</td><td/>
                          </tr>
                          <tr className="text-muted-foreground text-xs">
                            <td className="pl-4 py-0.5">Compras externas (hielos, etc.)</td>
                            <td className="text-right">{fmt((resumen as any).cmvExternas??0)}</td><td/>
                          </tr>
                          <tr className="font-semibold border-t border-b">
                            <td className="py-1">= Margen Bruto</td>
                            <td className="text-right py-1">{fmt((resumen as any).utilidadBruta??resumen.totalIngresos)}</td>
                            <td className="text-right py-1 text-muted-foreground">{pct((resumen as any).margenBruto??100)}</td>
                          </tr>
                          <tr className="font-semibold text-red-700">
                            <td className="py-1">💸 Gastos Operativos</td>
                            <td className="text-right py-1 text-red-700">-{fmt(resumen.totalEgresos)}</td>
                            <td className="text-right py-1 text-muted-foreground">
                              {resumen.totalIngresos>0?pct(resumen.totalEgresos/resumen.totalIngresos*100):"—"}
                            </td>
                          </tr>
                          {resumen.totalGastosFijos>0 && <tr className="text-muted-foreground text-xs"><td className="pl-4 py-0.5">Gastos fijos</td><td className="text-right">{fmt(resumen.totalGastosFijos)}</td><td/></tr>}
                          {resumen.totalNomina>0 && <tr className="text-muted-foreground text-xs"><td className="pl-4 py-0.5">Nómina</td><td className="text-right">{fmt(resumen.totalNomina)}</td><td/></tr>}
                          {resumen.totalVariable>0 && <tr className="text-muted-foreground text-xs"><td className="pl-4 py-0.5">Variables</td><td className="text-right">{fmt(resumen.totalVariable)}</td><td/></tr>}
                          <tr className={`font-bold border-t text-base ${resumen.utilidad>=0?"text-green-700":"text-red-700"}`}>
                            <td className="py-2">= Utilidad Neta</td>
                            <td className="text-right py-2">{fmt(resumen.utilidad)}</td>
                            <td className="text-right py-2">{pct(resumen.margen)}</td>
                          </tr>
                        </tbody>
                      </table>
                      {((resumen as any).cmvRecetas??0)===0 && (
                        <p className="text-xs text-amber-600 mt-3 p-2 bg-amber-50 rounded">
                          ⚠️ CMV de recetas en $0 — carga costoXGramo en Inventario → Insumos.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Ventas por producto</CardTitle></CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left py-1">Producto</th>
                          <th className="text-right">Uds</th><th className="text-right">Total</th>
                        </tr></thead>
                        <tbody>
                          {[...(resumen.ventasPorProducto as any[])].sort((a,b)=>b.subtotal-a.subtotal).map((v:any,i:number)=>(
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1">{v.nombre}{v.sabor?` ${v.sabor}`:""}</td>
                              <td className="text-right py-1 tabular-nums">{v.cantidad}</td>
                              <td className="text-right py-1 tabular-nums font-medium">{fmt(v.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {tab==="gastos" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gastos del periodo</CardTitle>
                <p className="text-sm text-muted-foreground">Captura los gastos del mes y presiona "Guardar".</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {gastosEditado && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                    ⚠️ Cambios sin guardar
                  </div>
                )}
                {(["fijo","nomina","variable","extra_ingreso"] as const).map(tipo=>(
                  <div key={tipo}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={TIPO_COLORS[tipo]}>{TIPO_LABELS[tipo]}</Badge>
                      <button onClick={()=>{setLineasGasto(p=>[...p,{concepto:"",monto:0,tipo}]);setGastosEditado(true);}}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Plus className="h-3 w-3"/>Agregar
                      </button>
                    </div>
                    {lineasGasto.map((l,i)=>l.tipo!==tipo?null:(
                      <RowGasto key={i} l={l} idx={i} all={lineasGasto} setAll={setLineasGasto} setEditado={setGastosEditado}/>
                    ))}
                  </div>
                ))}
                {gastosEditado && (
                  <Button onClick={()=>guardarGastos.mutate({sucursalId:sucursalId!,periodo,lineas:lineasGasto})}
                    disabled={guardarGastos.isPending} className="w-full">
                    <Save className="h-4 w-4 mr-2"/>
                    {guardarGastos.isPending?"Guardando...":"Guardar gastos"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {tab==="compras" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4"/>Registrar compra externa
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Hielos, film, azúcar, leche soya y otros insumos no Jellyboba.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Concepto</label>
                      <Select value={compraForm.concepto} onValueChange={v=>setCompraForm(p=>({...p,concepto:v}))}>
                        <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Selecciona"/></SelectTrigger>
                        <SelectContent>{CONCEPTOS_EXT.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Fecha</label>
                      <Input type="date" value={compraForm.fecha} onChange={e=>setCompraForm(p=>({...p,fecha:e.target.value}))} className="h-8 text-sm mt-1"/>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Proveedor</label>
                      <Input value={compraForm.proveedor} onChange={e=>setCompraForm(p=>({...p,proveedor:e.target.value}))} className="h-8 text-sm mt-1"/>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Total $</label>
                      <Input type="number" value={compraForm.total||""} placeholder="0.00"
                        onChange={e=>setCompraForm(p=>({...p,total:Number(e.target.value),precioUnitario:Number(e.target.value)}))}
                        className="h-8 text-sm mt-1"/>
                    </div>
                  </div>
                  <Input placeholder="Notas opcionales..." value={compraForm.notas}
                    onChange={e=>setCompraForm(p=>({...p,notas:e.target.value}))} className="h-8 text-sm"/>
                  <Button onClick={()=>{
                    if(!compraForm.concepto||compraForm.total<=0){toast.error("Concepto y total requeridos");return;}
                    guardarCompra.mutate({sucursalId:sucursalId!,periodo,...compraForm});
                  }} disabled={guardarCompra.isPending} className="w-full bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2"/>
                    {guardarCompra.isPending?"Guardando...":"Registrar compra"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Compras — {periodo}
                    <span className="ml-2 text-green-700 font-bold text-sm">
                      {fmt((comprasExt as any[]).reduce((s:number,c:any)=>s+Number(c.total),0))}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(comprasExt as any[]).length===0
                    ? <p className="text-sm text-muted-foreground text-center py-4">Sin compras externas este mes.</p>
                    : <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left py-1">Fecha</th><th className="text-left">Concepto</th>
                          <th className="text-left">Proveedor</th><th className="text-right">Total</th><th/>
                        </tr></thead>
                        <tbody>
                          {(comprasExt as any[]).map((c:any)=>(
                            <tr key={c.id} className="border-b last:border-0">
                              <td className="py-1 text-muted-foreground text-xs">{c.fecha}</td>
                              <td className="py-1 font-medium">{c.concepto}</td>
                              <td className="py-1 text-muted-foreground text-xs">{c.proveedor}</td>
                              <td className="py-1 text-right tabular-nums">{fmt(Number(c.total))}</td>
                              <td className="py-1 text-right">
                                <button onClick={()=>eliminarCompra.mutate({id:c.id})}>
                                  <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600"/>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  }
                </CardContent>
              </Card>
            </div>
          )}

          {tab==="precios" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Precios de venta</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1">Producto</th>
                    <th className="text-right">Precio</th><th/>
                  </tr></thead>
                  <tbody>
                    {(precios as any[]).map((p:any)=>(
                      <PrecioRow key={p.id} p={p} onSave={(id,precio)=>actualizarPrecio.mutate({id,precio})}/>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
