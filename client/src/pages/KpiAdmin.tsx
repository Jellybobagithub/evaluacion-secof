import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSucursal } from "@/context/SucursalContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  TrendingUp, DollarSign, BarChart3, Plus, Edit2,
  CheckCircle2, XCircle, AlertTriangle, Info
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getMesActual() {
  const d = new Date();
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

function semaforo(val: number, meta: number, invertir = false) {
  const ok = invertir ? val <= meta : val >= meta;
  const warn = invertir ? val <= meta * 1.5 : val >= meta * 0.7;
  if (ok) return { color: "text-green-600", bg: "bg-green-50 border-green-200", label: "Cumple", icon: CheckCircle2 };
  if (warn) return { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "En riesgo", icon: AlertTriangle };
  return { color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Crítico", icon: XCircle };
}

function fmt(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Formulario de Gastos ─────────────────────────────────────────────────────
const CAMPOS_GASTO = [
  { key: "renta", label: "Renta" },
  { key: "nomina", label: "Nómina" },
  { key: "insumos", label: "Insumos / Materias primas" },
  { key: "servicios", label: "Servicios (luz, agua, internet)" },
  { key: "mantenimiento", label: "Mantenimiento" },
  { key: "marketing", label: "Marketing / Publicidad" },
  { key: "otros", label: "Otros gastos" },
  { key: "costoProducto", label: "Costo de Producto (CMV)" },
] as const;

type GastoKey = typeof CAMPOS_GASTO[number]["key"];

const EMPTY_GASTO: Record<GastoKey, string> = {
  renta: "", nomina: "", insumos: "", servicios: "",
  mantenimiento: "", marketing: "", otros: "", costoProducto: "",
};

function GastosModal({
  open, onClose, sucursalId, anio, mes, existing,
}: {
  open: boolean;
  onClose: () => void;
  sucursalId: number;
  anio: number;
  mes: number;
  existing?: any;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<Record<GastoKey, string>>(() => {
    if (existing) {
      return Object.fromEntries(
        CAMPOS_GASTO.map(c => [c.key, existing[c.key] != null ? String(existing[c.key]) : ""])
      ) as Record<GastoKey, string>;
    }
    return { ...EMPTY_GASTO };
  });

  const upsert = trpc.gastosOperativos.upsert.useMutation({
    onSuccess: () => {
      toast.success("Gastos guardados correctamente");
      utils.gastosOperativos.list.invalidate();
      utils.kpiAdmin.rentabilidad.invalidate();
      utils.kpiAdmin.eficiencia.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    const data: Record<string, number> = {};
    for (const c of CAMPOS_GASTO) {
      data[c.key] = form[c.key] ? parseFloat(form[c.key]) : 0;
    }
    upsert.mutate({ sucursalId, anio, mes, ...data } as any);
  }

  const total = CAMPOS_GASTO
    .filter(c => c.key !== "costoProducto")
    .reduce((s, c) => s + (parseFloat(form[c.key]) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Gastos Operativos — {MESES[mes - 1]} {anio}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {CAMPOS_GASTO.map(c => (
            <div key={c.key} className="flex items-center gap-3">
              <Label className="w-48 text-sm shrink-0">{c.label}</Label>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  className="pl-7"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form[c.key]}
                  onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Total Gastos Operativos</span>
            <span className="text-lg font-bold text-foreground">{fmt(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Guardando..." : "Guardar Gastos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function KpiAdmin() {
  const { user } = useAuth();
  const currentRole = (user as any)?.role ?? "user";
  const { anio: anioActual, mes: mesActual } = getMesActual();

  const { sucursalId: globalSucursalId } = useSucursal();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(mesActual);
  const [showGastosModal, setShowGastosModal] = useState(false);

  const sucursalSeleccionada = globalSucursalId;

  const queryOpts = {
    enabled: !!sucursalSeleccionada,
  };

  const { data: crecimiento, isLoading: loadCrecimiento } = trpc.kpiAdmin.crecimiento.useQuery(
    { sucursalId: sucursalSeleccionada!, anio, mes },
    { ...queryOpts, enabled: !!sucursalSeleccionada }
  );

  const { data: rentabilidad, isLoading: loadRentabilidad } = trpc.kpiAdmin.rentabilidad.useQuery(
    { sucursalId: sucursalSeleccionada!, anio, mes },
    { ...queryOpts, enabled: !!sucursalSeleccionada }
  );

  const { data: eficiencia, isLoading: loadEficiencia } = trpc.kpiAdmin.eficiencia.useQuery(
    { sucursalId: sucursalSeleccionada!, anio, mes },
    { ...queryOpts, enabled: !!sucursalSeleccionada }
  );

  const periodoStr = `${anio}-${String(mes).padStart(2,"0")}`;
  const { data: compras = [] } = trpc.finanzas.comprasExternas.list.useQuery(
    { sucursalId: sucursalSeleccionada ?? 0, periodo: periodoStr },
    { enabled: !!sucursalSeleccionada }
  );

  const { data: gastosExisting = [] } = trpc.gastosOperativos.list.useQuery(
    { sucursalId: sucursalSeleccionada!, anio, mes },
    { enabled: !!sucursalSeleccionada }
  );

  const gastoActual = (gastosExisting as any[])[0] ?? null;

  // ─── Semáforos ───────────────────────────────────────────────────────────────
  const sCrecimiento = crecimiento != null ? semaforo(crecimiento.crecimiento, 5) : null; // meta: +5%
  const sMargenBruto = rentabilidad != null ? semaforo(rentabilidad.margenBruto, 50) : null; // meta: ≥50%
  const sMargenNeto = rentabilidad != null ? semaforo(rentabilidad.margenNeto, 15) : null; // meta: ≥15%
  const sEficiencia = eficiencia != null ? semaforo(eficiencia.ratioEficiencia, 70, true) : null; // meta: ≤70%

  // ─── Datos para gráficas ─────────────────────────────────────────────────────
  const tendenciaData = crecimiento?.tendencia ?? [];

  const desglosePctData = eficiencia?.desglosePct
    ? Object.entries(eficiencia.desglosePct)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => ({
          name: { renta: "Renta", nomina: "Nómina", insumos: "Insumos", servicios: "Servicios",
                  mantenimiento: "Mant.", marketing: "Marketing", otros: "Otros" }[k] ?? k,
          pct: v as number,
        }))
        .sort((a, b) => b.pct - a.pct)
    : [];

  const waterfall = rentabilidad
    ? [
        { name: "Ventas", valor: rentabilidad.ventas, tipo: "positivo" },
        { name: "Costo Producto", valor: -rentabilidad.costoProducto, tipo: "negativo" },
        { name: "Margen Bruto", valor: rentabilidad.ventas - rentabilidad.costoProducto, tipo: "resultado" },
        { name: "Gastos Op.", valor: -rentabilidad.gastosTotales, tipo: "negativo" },
        { name: "Utilidad Neta", valor: rentabilidad.utilidadNeta, tipo: rentabilidad.utilidadNeta >= 0 ? "resultado" : "negativo" },
      ]
    : [];

  if (!['owner', 'superadmin', 'manager'].includes(currentRole)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              KPIs Nivel 3 — Administrador
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crecimiento · Rentabilidad · Eficiencia Operativa
            </p>
          </div>
          <Button
            onClick={() => setShowGastosModal(true)}
            disabled={!sucursalSeleccionada}
            className="gap-2"
          >
            {gastoActual ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {gastoActual ? "Editar Gastos" : "Registrar Gastos"}
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Select value={String(mes)} onValueChange={v => setMes(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(anio)} onValueChange={v => setAnio(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {[anioActual - 1, anioActual, anioActual + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!gastoActual && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              Para calcular Rentabilidad y Eficiencia, registra los gastos operativos del mes seleccionado.
            </span>
          </div>
        )}

        <Tabs defaultValue="crecimiento">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="crecimiento" className="gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Crecimiento
            </TabsTrigger>
            <TabsTrigger value="rentabilidad" className="gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Rentabilidad
            </TabsTrigger>
            <TabsTrigger value="eficiencia" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Eficiencia
            </TabsTrigger>
            <TabsTrigger value="compras" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Compras
            </TabsTrigger>
          </TabsList>

          {/* ── CRECIMIENTO ── */}
          <TabsContent value="crecimiento" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* KPI Principal */}
              <Card className={`border md:col-span-1 ${sCrecimiento?.bg ?? ""}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`w-5 h-5 ${sCrecimiento?.color ?? "text-slate-500"}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Crecimiento vs Año Anterior
                    </span>
                  </div>
                  {loadCrecimiento ? (
                    <div className="h-12 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className={`text-4xl font-bold ${sCrecimiento?.color ?? "text-foreground"}`}>
                        {crecimiento?.crecimiento != null
                          ? `${crecimiento.crecimiento > 0 ? "+" : ""}${crecimiento.crecimiento}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Meta: +5% mensual</p>
                      {sCrecimiento && (
                        <Badge variant="outline" className={`mt-2 text-xs ${sCrecimiento.bg} ${sCrecimiento.color} border-current`}>
                          {crecimiento?.crecimiento != null && crecimiento.crecimiento > 0 ? "✅" : crecimiento?.crecimiento === 0 ? "⚠️" : "🔴"} {sCrecimiento.label}
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Comparativa */}
              <Card className="border md:col-span-2">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Ventas: Mes Actual vs Año Anterior
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{MESES[mes - 1]} {anio}</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {crecimiento ? fmt(crecimiento.ventasActual) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{MESES[mes - 1]} {anio - 1}</p>
                      <p className="text-2xl font-bold text-slate-500">
                        {crecimiento ? fmt(crecimiento.ventasAnterior) : "—"}
                      </p>
                      {crecimiento?.ventasAnterior === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Sin datos históricos</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráfica de tendencia */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tendencia 6 Meses — Actual vs Año Anterior</CardTitle>
              </CardHeader>
              <CardContent>
                {loadCrecimiento ? (
                  <div className="h-48 bg-muted animate-pulse rounded" />
                ) : tendenciaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={tendenciaData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="actual" name={`${anio}`} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="anterior" name={`${anio - 1}`} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8">Sin datos de tendencia</p>
                )}
              </CardContent>
            </Card>

            {/* Tabla de crecimiento por mes */}
            {tendenciaData.length > 0 && (
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Detalle por Mes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 font-medium">Mes</th>
                          <th className="text-right py-2 font-medium">Actual</th>
                          <th className="text-right py-2 font-medium">Año Anterior</th>
                          <th className="text-right py-2 font-medium">Crecimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tendenciaData.map((row: any, i: number) => {
                          const crec = row.crecimiento;
                          const color = crec > 5 ? "text-green-600" : crec > 0 ? "text-amber-600" : "text-red-600";
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 font-medium">{row.mes}</td>
                              <td className="py-2 text-right text-blue-600 font-semibold">{fmt(row.actual)}</td>
                              <td className="py-2 text-right text-slate-500">{fmt(row.anterior)}</td>
                              <td className={`py-2 text-right font-bold ${color}`}>
                                {row.anterior > 0 ? `${crec > 0 ? "+" : ""}${crec}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── RENTABILIDAD ── */}
          <TabsContent value="rentabilidad" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className={`border ${sMargenBruto?.bg ?? ""}`}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Margen Bruto</p>
                  {loadRentabilidad ? (
                    <div className="h-12 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className={`text-4xl font-bold ${sMargenBruto?.color ?? "text-foreground"}`}>
                        {rentabilidad ? `${rentabilidad.margenBruto}%` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Meta: ≥50%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        (Ventas − Costo Producto) / Ventas
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className={`border ${sMargenNeto?.bg ?? ""}`}>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Margen Neto</p>
                  {loadRentabilidad ? (
                    <div className="h-12 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className={`text-4xl font-bold ${sMargenNeto?.color ?? "text-foreground"}`}>
                        {rentabilidad ? `${rentabilidad.margenNeto}%` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Meta: ≥15%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Utilidad Neta / Ventas
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utilidad Neta</p>
                  {loadRentabilidad ? (
                    <div className="h-12 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className={`text-3xl font-bold ${rentabilidad && rentabilidad.utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {rentabilidad ? fmt(rentabilidad.utilidadNeta) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rentabilidad ? `Ventas: ${fmt(rentabilidad.ventas)}` : ""}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Waterfall / Desglose */}
            {rentabilidad && (
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Desglose de Rentabilidad — {MESES[mes - 1]} {anio}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "Ventas Totales", valor: rentabilidad.ventas, color: "bg-blue-500" },
                      { label: "Costo de Producto (CMV)", valor: -rentabilidad.costoProducto, color: "bg-red-400" },
                      { label: "= Margen Bruto", valor: rentabilidad.ventas - rentabilidad.costoProducto, color: "bg-emerald-500", bold: true },
                      { label: "Gastos Operativos", valor: -rentabilidad.gastosTotales, color: "bg-orange-400" },
                      { label: "= Utilidad Neta", valor: rentabilidad.utilidadNeta, color: rentabilidad.utilidadNeta >= 0 ? "bg-green-600" : "bg-red-600", bold: true },
                    ].map((row, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded ${row.bold ? "bg-slate-50 border" : ""}`}>
                        <span className={`text-sm ${row.bold ? "font-semibold" : "text-muted-foreground"}`}>{row.label}</span>
                        <span className={`text-sm font-bold ${row.valor >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {row.valor >= 0 ? fmt(row.valor) : `-${fmt(Math.abs(row.valor))}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {rentabilidad.desglose && Object.values(rentabilidad.desglose).some(v => (v as number) > 0) && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Desglose de Gastos Operativos</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(rentabilidad.desglose).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">{
                              { renta: "Renta", nomina: "Nómina", insumos: "Insumos", servicios: "Servicios",
                                mantenimiento: "Mant.", marketing: "Marketing", otros: "Otros" }[k] ?? k
                            }</span>
                            <span className="font-medium">{fmt(v as number)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!rentabilidad.tieneGastos && (
                    <p className="text-center text-amber-600 text-sm mt-4">
                      ⚠️ Sin gastos registrados — registra los gastos para calcular rentabilidad real
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── EFICIENCIA OPERATIVA ── */}
          <TabsContent value="eficiencia" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`border ${sEficiencia?.bg ?? ""}`}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className={`w-5 h-5 ${sEficiencia?.color ?? "text-slate-500"}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ratio de Eficiencia
                    </span>
                  </div>
                  {loadEficiencia ? (
                    <div className="h-12 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <p className={`text-4xl font-bold ${sEficiencia?.color ?? "text-foreground"}`}>
                        {eficiencia ? `${eficiencia.ratioEficiencia}%` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Gastos Totales / Ventas · Meta: ≤70%</p>
                      {sEficiencia && (
                        <Badge variant="outline" className={`mt-2 text-xs ${sEficiencia.bg} ${sEficiencia.color} border-current`}>
                          {sEficiencia.label}
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumen del Mes</p>
                  {loadEficiencia ? (
                    <div className="h-20 bg-muted animate-pulse rounded" />
                  ) : eficiencia ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ventas</span>
                        <span className="font-semibold text-blue-600">{fmt(eficiencia.ventas)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gastos Totales</span>
                        <span className="font-semibold text-red-600">{fmt(eficiencia.gastosTotales)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="font-medium">Diferencia</span>
                        <span className={`font-bold ${eficiencia.ventas - eficiencia.gastosTotales >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {fmt(eficiencia.ventas - eficiencia.gastosTotales)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Gráfica de desglose de gastos como % de ventas */}
            {desglosePctData.length > 0 && (
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Gastos como % de Ventas — {MESES[mes - 1]} {anio}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={desglosePctData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                      <ReferenceLine x={20} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "20%", position: "top", fontSize: 10 }} />
                      <Bar dataKey="pct" name="% de Ventas" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tabla de desglose */}
            {eficiencia?.desgloseMonto && Object.values(eficiencia.desgloseMonto).some(v => (v as number) > 0) && (
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Desglose Detallado de Gastos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 font-medium">Categoría</th>
                          <th className="text-right py-2 font-medium">Monto</th>
                          <th className="text-right py-2 font-medium">% de Ventas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(eficiencia.desgloseMonto)
                          .filter(([, v]) => (v as number) > 0)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([k, v]) => (
                            <tr key={k} className="border-b last:border-0">
                              <td className="py-2 capitalize">
                                {{ renta: "Renta", nomina: "Nómina", insumos: "Insumos", servicios: "Servicios",
                                   mantenimiento: "Mantenimiento", marketing: "Marketing", otros: "Otros" }[k] ?? k}
                              </td>
                              <td className="py-2 text-right font-medium">{fmt(v as number)}</td>
                              <td className="py-2 text-right text-muted-foreground">
                                {eficiencia.desglosePct[k as keyof typeof eficiencia.desglosePct]}%
                              </td>
                            </tr>
                          ))}
                        <tr className="border-t font-semibold">
                          <td className="py-2">Total Gastos</td>
                          <td className="py-2 text-right text-red-600">{fmt(eficiencia.gastosTotales)}</td>
                          <td className="py-2 text-right text-red-600">{eficiencia.ratioEficiencia}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {!eficiencia?.tieneGastos && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <Info className="w-4 h-4 shrink-0" />
                <span>Registra los gastos operativos del mes para ver el análisis de eficiencia.</span>
              </div>
            )}
          </TabsContent>

          {/* ── COMPRAS ── */}
          <TabsContent value="compras" className="space-y-4 mt-4">
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  Compras Externas — {periodoStr}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {compras.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sin compras registradas para este mes.</p>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground font-semibold mb-2 px-1">
                      <span>Total del mes</span>
                      <span className="text-slate-800 font-bold text-sm">
                        {fmt((compras as any[]).reduce((s: number, c: any) => s + Number(c.total), 0))}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {(compras as any[]).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                          <div>
                            <p className="font-medium">{c.concepto}</p>
                            <p className="text-xs text-muted-foreground">{c.fecha} · {c.proveedor}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{fmt(Number(c.total))}</p>
                            <p className="text-xs text-muted-foreground">{c.cantidad} {c.unidad}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Gastos */}
        {showGastosModal && sucursalSeleccionada && (
          <GastosModal
            open={showGastosModal}
            onClose={() => setShowGastosModal(false)}
            sucursalId={sucursalSeleccionada}
            anio={anio}
            mes={mes}
            existing={gastoActual}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
