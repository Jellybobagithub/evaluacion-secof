import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Plus, Trash2, Save, Settings } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  fijo: "Gasto Fijo",
  nomina: "Nómina",
  variable: "Gasto Variable",
  extra_ingreso: "Ingreso Extra",
};
const TIPO_COLORS: Record<string, string> = {
  fijo: "bg-orange-100 text-orange-800",
  nomina: "bg-purple-100 text-purple-800",
  variable: "bg-red-100 text-red-800",
  extra_ingreso: "bg-green-100 text-green-800",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
}

export default function Finanzas() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [tab, setTab] = useState<"resumen" | "gastos" | "precios">("resumen");
  const [lineasGasto, setLineasGasto] = useState<any[]>([]);
  const [gastosEditado, setGastosEditado] = useState(false);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const utils = trpc.useUtils();

  const { data: resumen, isLoading: loadingResumen } = trpc.finanzas.resumen.useQuery(
    { sucursalId: sucursalId!, periodo },
    { enabled: !!sucursalId }
  );

  const { data: gastos = [] } = trpc.finanzas.gastos.getByPeriodo.useQuery(
    { sucursalId: sucursalId!, periodo },
    {
      enabled: !!sucursalId,
      onSuccess: (data: any[]) => { setLineasGasto(data.map(g => ({ ...g }))); setGastosEditado(false); },
    } as any
  );

  const { data: precios = [] } = trpc.finanzas.precios.list.useQuery();
  const [preciosEdit, setPreciosEdit] = useState<Record<number, string>>({});

  const guardarGastos = trpc.finanzas.gastos.guardar.useMutation({
    onSuccess: () => {
      toast.success("Gastos guardados");
      utils.finanzas.gastos.getByPeriodo.invalidate();
      utils.finanzas.resumen.invalidate();
      setGastosEditado(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePrecio = trpc.finanzas.precios.update.useMutation({
    onSuccess: () => { toast.success("Precio actualizado"); utils.finanzas.precios.list.invalidate(); utils.finanzas.resumen.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function addLinea(tipo: string) {
    setLineasGasto(l => [...l, { concepto: "", monto: 0, tipo }]);
    setGastosEditado(true);
  }

  function removeLinea(i: number) {
    setLineasGasto(l => l.filter((_, idx) => idx !== i));
    setGastosEditado(true);
  }

  function updateLinea(i: number, key: string, val: any) {
    setLineasGasto(l => l.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
    setGastosEditado(true);
  }

  const semaforo = useMemo(() => {
    if (!resumen) return "gray";
    if (resumen.margen >= 20) return "green";
    if (resumen.margen >= 10) return "yellow";
    return "red";
  }, [resumen]);

  const semaforoColor = { green: "text-green-600", yellow: "text-yellow-600", red: "text-red-600", gray: "text-gray-400" }[semaforo];
  const semaforoLabel = { green: "✅ Rentable", yellow: "⚠️ Margen ajustado", red: "🔴 En riesgo", gray: "Sin datos" }[semaforo];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Rentabilidad de Tienda</h1>
            <p className="text-sm text-muted-foreground">Estado financiero por sucursal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sucursalId?.toString() ?? ""} onValueChange={v => setSucursalId(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Sucursal" /></SelectTrigger>
            <SelectContent position="item-aligned">
              {(sucursales as any[]).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className="w-36 h-9" />
        </div>
      </div>

      {!sucursalId && (
        <div className="py-12 text-center text-muted-foreground">Selecciona una sucursal para ver su rentabilidad.</div>
      )}

      {sucursalId && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {(["resumen","gastos","precios"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={"px-4 py-2 text-sm font-medium border-b-2 transition-colors " + (tab === t ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t === "resumen" ? "📊 Resumen" : t === "gastos" ? "💸 Gastos" : "🏷️ Precios"}
              </button>
            ))}
          </div>

          {/* TAB: RESUMEN */}
          {tab === "resumen" && (
            <div className="space-y-4">
              {loadingResumen && <div className="py-8 text-center text-muted-foreground text-sm">Calculando...</div>}
              {resumen && (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Ingresos totales</p>
                        <p className="text-xl font-bold text-green-600">{fmt(resumen.totalIngresos)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{resumen.totalVasos} vasos • {fmt(resumen.ticketPromedio)}/vaso</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Egresos totales</p>
                        <p className="text-xl font-bold text-red-600">{fmt(resumen.totalEgresos)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Fijos + Nómina + Variable</p>
                      </CardContent>
                    </Card>
                    <Card className={resumen.utilidad >= 0 ? "border-green-200" : "border-red-200"}>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Utilidad neta</p>
                        <p className={`text-xl font-bold ${resumen.utilidad >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(resumen.utilidad)}</p>
                        <p className={`text-xs font-medium mt-1 ${semaforoColor}`}>{semaforoLabel}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Margen neto</p>
                        <p className={`text-xl font-bold ${semaforoColor}`}>{resumen.margen.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Sobre ingresos totales</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Desglose ingresos */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Desglose de Ingresos</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ventas ({resumen.totalVasos} vasos)</span>
                        <span className="font-medium text-green-600">{fmt(resumen.totalVentas)}</span>
                      </div>
                      {resumen.totalExtrasIngreso > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Ingresos extra</span>
                          <span className="font-medium text-green-600">{fmt(resumen.totalExtrasIngreso)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold border-t pt-1">
                        <span>Total ingresos</span>
                        <span className="text-green-600">{fmt(resumen.totalIngresos)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Desglose egresos */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Desglose de Egresos</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {resumen.totalGastosFijos > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gastos fijos</span>
                          <span className="font-medium text-red-600">{fmt(resumen.totalGastosFijos)}</span>
                        </div>
                      )}
                      {resumen.totalNomina > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Nómina</span>
                          <span className="font-medium text-purple-600">{fmt(resumen.totalNomina)}</span>
                        </div>
                      )}
                      {resumen.totalVariable > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gastos variables</span>
                          <span className="font-medium text-orange-600">{fmt(resumen.totalVariable)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-semibold border-t pt-1">
                        <span>Total egresos</span>
                        <span className="text-red-600">{fmt(resumen.totalEgresos)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ventas por producto */}
                  {resumen.ventasPorProducto.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Ventas por Producto</CardTitle></CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="text-left pb-1">Producto</th>
                              <th className="text-right pb-1">Cant.</th>
                              <th className="text-right pb-1">Precio</th>
                              <th className="text-right pb-1">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {resumen.ventasPorProducto.sort((a, b) => b.subtotal - a.subtotal).map((v, i) => (
                              <tr key={i}>
                                <td className="py-1">{v.nombre}{v.sabor ? ` — ${v.sabor}` : ""}</td>
                                <td className="py-1 text-right tabular-nums">{v.cantidad}</td>
                                <td className="py-1 text-right tabular-nums">{fmt(v.precio)}</td>
                                <td className="py-1 text-right tabular-nums font-medium">{fmt(v.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
              {!loadingResumen && !resumen && (
                <div className="py-8 text-center text-muted-foreground text-sm">No hay datos para este período.</div>
              )}
            </div>
          )}

          {/* TAB: GASTOS */}
          {tab === "gastos" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Captura los gastos del mes. Los cambios se guardan al presionar "Guardar".</p>
                {gastosEditado && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => guardarGastos.mutate({ sucursalId: sucursalId!, periodo, lineas: lineasGasto })}
                    disabled={guardarGastos.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {guardarGastos.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                )}
              </div>

              {(["fijo","nomina","variable","extra_ingreso"] as const).map(tipo => {
                const lineasTipo = lineasGasto.filter(l => l.tipo === tipo);
                const total = lineasTipo.reduce((a, l) => a + (Number(l.monto) || 0), 0);
                return (
                  <Card key={tipo}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm">{TIPO_LABELS[tipo]}</CardTitle>
                          {total > 0 && <span className="text-xs font-medium text-muted-foreground">{fmt(total)}</span>}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addLinea(tipo)}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lineasTipo.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Sin {TIPO_LABELS[tipo].toLowerCase()}s registrados.</p>
                      )}
                      {lineasGasto.map((l, i) => l.tipo !== tipo ? null : (
                        <div key={i} className="flex items-center gap-2">
                          <Input value={l.concepto} onChange={e => updateLinea(i, 'concepto', e.target.value)}
                            placeholder={tipo === "extra_ingreso" ? "Concepto del ingreso" : "Concepto del gasto"}
                            className="flex-1 h-8 text-sm" />
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input type="number" value={l.monto} onChange={e => updateLinea(i, 'monto', Number(e.target.value))}
                              className="w-28 h-8 text-sm pl-5" min={0} step={100} />
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeLinea(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}

              {gastosEditado && (
                <div className="flex justify-end">
                  <Button className="bg-green-600 hover:bg-green-700"
                    onClick={() => guardarGastos.mutate({ sucursalId: sucursalId!, periodo, lineas: lineasGasto })}
                    disabled={guardarGastos.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    {guardarGastos.isPending ? "Guardando..." : "Guardar todos los gastos"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB: PRECIOS */}
          {tab === "precios" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Precios de Venta</CardTitle>
                <p className="text-xs text-muted-foreground">Estos precios se usan para calcular los ingresos por ventas.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {(precios as any[]).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-sm flex-1">{p.nombre}</span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <Input type="number" defaultValue={p.precio}
                        value={preciosEdit[p.id] ?? p.precio}
                        onChange={e => setPreciosEdit(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="h-8 text-sm pl-5" min={0} step={1} />
                    </div>
                    <Button size="sm" variant="outline"
                      onClick={() => updatePrecio.mutate({ id: p.id, precio: Number(preciosEdit[p.id] ?? p.precio) })}>
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
