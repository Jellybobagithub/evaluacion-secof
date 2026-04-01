import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  DollarSign, TrendingUp, BarChart3, ShoppingCart, Download, Building2, X, Check,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const PERIODOS = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
];

// Paleta de colores para multi-sucursal
const COLORES = [
  "#16a34a", "#2563eb", "#7c3aed", "#dc2626", "#ea580c",
  "#0891b2", "#65a30d", "#9333ea", "#db2777", "#0d9488",
];

function formatMXN(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function formatFecha(fecha: string, dias: number) {
  const d = new Date(fecha + "T12:00:00");
  if (dias <= 30) return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground truncate">{p.name}:</span>
          <span className="font-medium ml-auto">
            {typeof p.value === "number"
              ? p.dataKey?.includes("ventas") || p.dataKey?.includes("Ventas")
                ? formatMXN(p.value)
                : p.dataKey?.includes("ticket") || p.dataKey?.includes("Ticket")
                ? `$${p.value.toFixed(2)}`
                : p.value.toLocaleString("es-MX")
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Ventas() {
  const { user } = useAuth();
  const [dias, setDias] = useState(30);
  const [sucursalId, setSucursalId] = useState<number | undefined>(undefined);
  const [metrica, setMetrica] = useState<"ventas" | "efectivo" | "tarjeta" | "rappi">("ventas");
  // Multi-sucursal comparativa
  const [sucursalesSeleccionadas, setSucursalesSeleccionadas] = useState<number[]>([]);
  const [modoComparativa, setModoComparativa] = useState(false);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: historico, isLoading } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId },
    {}
  );
  const { data: avanceMeta = [] } = trpc.reportesDiarios.avanceMeta.useQuery(
    undefined,
    { enabled: !sucursalId }
  );

  // Cargar histórico por cada sucursal seleccionada para comparativa
  const { data: historicoComp1 } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId: sucursalesSeleccionadas[0] },
    { enabled: modoComparativa && sucursalesSeleccionadas.length >= 1 }
  );
  const { data: historicoComp2 } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId: sucursalesSeleccionadas[1] },
    { enabled: modoComparativa && sucursalesSeleccionadas.length >= 2 }
  );
  const { data: historicoComp3 } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId: sucursalesSeleccionadas[2] },
    { enabled: modoComparativa && sucursalesSeleccionadas.length >= 3 }
  );
  const { data: historicoComp4 } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId: sucursalesSeleccionadas[3] },
    { enabled: modoComparativa && sucursalesSeleccionadas.length >= 4 }
  );
  const { data: historicoComp5 } = trpc.reportesDiarios.historico.useQuery(
    { dias, sucursalId: sucursalesSeleccionadas[4] },
    { enabled: modoComparativa && sucursalesSeleccionadas.length >= 5 }
  );

  const historicosPorSucursal = [
    historicoComp1, historicoComp2, historicoComp3, historicoComp4, historicoComp5
  ].slice(0, sucursalesSeleccionadas.length);

  // Construir serie comparativa multi-sucursal
  const serieComparativa = useMemo(() => {
    if (!modoComparativa || sucursalesSeleccionadas.length === 0) return [];
    // Unir todas las fechas
    const todasFechas = new Set<string>();
    historicosPorSucursal.forEach(h => h?.serie?.forEach(d => todasFechas.add(d.fecha)));
    const fechasOrdenadas = Array.from(todasFechas).sort();
    return fechasOrdenadas.map(fecha => {
      const row: any = { fecha, fechaLabel: formatFecha(fecha, dias) };
      sucursalesSeleccionadas.forEach((sId, idx) => {
        const h = historicosPorSucursal[idx];
        const punto = h?.serie?.find(d => d.fecha === fecha);
        const nombre = sucursales.find(s => s.id === sId)?.nombre ?? `Tienda ${sId}`;
        row[`ventas_${nombre}`] = punto?.ventas ?? 0;
        row[`efectivo_${nombre}`] = punto?.efectivo ?? 0;
        row[`tarjeta_${nombre}`] = punto?.tarjeta ?? 0;
        row[`rappi_${nombre}`] = punto?.rappi ?? 0;
      });
      return row;
    });
  }, [modoComparativa, sucursalesSeleccionadas, historicosPorSucursal, dias, sucursales]);

  const serie = useMemo(() => {
    if (!historico?.serie) return [];
    return historico.serie.map(d => ({
      ...d,
      fechaLabel: formatFecha(d.fecha, dias),
    }));
  }, [historico, dias]);

  const tendencia = useMemo(() => {
    if (serie.length < 4) return null;
    const mid = Math.floor(serie.length / 2);
    const primera = serie.slice(0, mid).reduce((s, d) => s + d.ventas, 0) / mid;
    const segunda = serie.slice(mid).reduce((s, d) => s + d.ventas, 0) / (serie.length - mid);
    return segunda > primera ? "up" : segunda < primera ? "down" : "flat";
  }, [serie]);

  const promedioVentas = useMemo(() => {
    if (!serie.length) return 0;
    return serie.reduce((s, d) => s + d.ventas, 0) / serie.length;
  }, [serie]);

  function toggleSucursal(id: number) {
    setSucursalesSeleccionadas(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : prev.length < 5 ? [...prev, id] : prev
    );
  }

  // Exportación Excel mejorada (CSV con más columnas)
  const exportarExcel = () => {
    const sucursalNombre = sucursalId
      ? sucursales.find(s => s.id === sucursalId)?.nombre ?? "todas"
      : "todas";

    if (modoComparativa && sucursalesSeleccionadas.length > 0) {
      // Exportar comparativa multi-sucursal
      const nombresSelec = sucursalesSeleccionadas.map(id => sucursales.find(s => s.id === id)?.nombre ?? `Tienda ${id}`);
      const headers = ["Fecha", ...nombresSelec.flatMap(n => [`Ventas ${n}`, `Transacciones ${n}`])];
      const rows = serieComparativa.map(d => [
        d.fecha,
        ...nombresSelec.flatMap(n => [
          (d[`ventas_${n}`] ?? 0).toFixed(2),
          (d[`tx_${n}`] ?? 0),
        ]),
      ]);
      const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparativa_ventas_${dias}d_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Exportar serie individual con meta y avance
      const metaSucursal = avanceMeta.find(a => a.sucursalId === sucursalId)?.meta ?? 0;
      const ventasMes = avanceMeta.find(a => a.sucursalId === sucursalId)?.ventasMes ?? 0;
      const avancePct = metaSucursal > 0 ? ((ventasMes / metaSucursal) * 100).toFixed(1) : "N/A";

      const headers = [
        "Fecha",
        "Día de la semana",
        "Ventas (MXN)",
        "Efectivo (MXN)",
        "Tarjeta (MXN)",
        "Rappi (MXN)",
        "Reportes del día",
        "Sucursal",
        "Período (días)",
        "Meta mensual",
        "Avance vs meta",
      ];
      const rows = [...serie].reverse().map(d => {
        const fecha = new Date(d.fecha + "T12:00:00");
        return [
          d.fecha,
          fecha.toLocaleDateString("es-MX", { weekday: "long" }),
          d.ventas.toFixed(2),
          d.efectivo.toFixed(2),
          d.tarjeta.toFixed(2),
          d.rappi.toFixed(2),
          d.reportes,
          sucursalNombre,
          dias,
          metaSucursal > 0 ? metaSucursal.toFixed(2) : "",
          metaSucursal > 0 ? avancePct + "%" : "",
        ];
      });
      const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas_${sucursalNombre}_${dias}d_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const metricas = [
    { key: "ventas" as const, label: "Total", color: "#16a34a", icon: DollarSign },
    { key: "efectivo" as const, label: "Efectivo", color: "#2563eb", icon: ShoppingCart },
    { key: "tarjeta" as const, label: "Tarjeta", color: "#7c3aed", icon: TrendingUp },
    { key: "rappi" as const, label: "Rappi", color: "#ea580c", icon: BarChart3 },
  ];
  const metricaActual = metricas.find(m => m.key === metrica)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evolución de Ventas</h1>
          <p className="text-muted-foreground mt-1 text-sm">Histórico de desempeño comercial por período y sucursal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={modoComparativa ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              setModoComparativa(!modoComparativa);
              if (!modoComparativa) setSucursalId(undefined);
            }}
          >
            <BarChart3 className="h-4 w-4" />
            {modoComparativa ? "Modo individual" : "Comparar tiendas"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={exportarExcel}
            disabled={modoComparativa ? sucursalesSeleccionadas.length === 0 : !serie.length}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(dias)} onValueChange={v => setDias(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map(p => (
              <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!modoComparativa && (
          <Select
            value={sucursalId ? String(sucursalId) : "todas"}
            onValueChange={v => setSucursalId(v === "todas" ? undefined : Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las tiendas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las tiendas</SelectItem>
              {sucursales.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Selector multi-sucursal para comparativa */}
      {modoComparativa && (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Selecciona hasta 5 tiendas para comparar:</p>
            <div className="flex flex-wrap gap-2">
              {sucursales.map((s, idx) => {
                const selIdx = sucursalesSeleccionadas.indexOf(s.id);
                const isSelected = selIdx !== -1;
                const color = isSelected ? COLORES[selIdx % COLORES.length] : undefined;
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSucursal(s.id)}
                    disabled={!isSelected && sucursalesSeleccionadas.length >= 5}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? "text-white border-transparent"
                        : "bg-white border-gray-200 text-muted-foreground hover:border-gray-400 disabled:opacity-40"
                    }`}
                    style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    {isSelected ? <Check className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    {s.nombre}
                  </button>
                );
              })}
            </div>
            {sucursalesSeleccionadas.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">{sucursalesSeleccionadas.length} seleccionada{sucursalesSeleccionadas.length !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => setSucursalesSeleccionadas([])}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpiar
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPIs de resumen (modo individual) */}
      {!modoComparativa && historico && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ventas Totales</p>
                  <p className="text-xl font-bold text-green-700">{formatMXN(historico.totalVentas)}</p>
                  <p className="text-xs text-muted-foreground">en {dias} días</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Efectivo</p>
                  <p className="text-xl font-bold text-blue-700">{historico.totalEfectivo ? `$${historico.totalEfectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "$0.00"}</p>
                  <p className="text-xs text-muted-foreground">canal efectivo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rappi</p>
                  <p className="text-xl font-bold text-purple-700">{historico.totalRappi ? `$${historico.totalRappi.toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "$0.00"}</p>
                  <p className="text-xs text-muted-foreground">
                    {tendencia === "up" && <span className="text-green-600">↑ Tendencia al alza</span>}
                    {tendencia === "down" && <span className="text-red-600">↓ Tendencia a la baja</span>}
                    {tendencia === "flat" && <span className="text-gray-500">→ Estable</span>}
                    {tendencia === null && "por transacción"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === GRÁFICA COMPARATIVA MULTI-SUCURSAL === */}
      {modoComparativa && sucursalesSeleccionadas.length > 0 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold">
                Comparativa de Ventas — Últimos {dias} días
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {[
                  { key: "ventas", label: "Total" },
                  { key: "efectivo", label: "Efectivo" },
                  { key: "tarjeta", label: "Tarjeta" },
                  { key: "rappi", label: "Rappi" },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMetrica(m.key as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      metrica === m.key
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {serieComparativa.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No hay datos en este período para las tiendas seleccionadas</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={serieComparativa} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="fechaLabel"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={dias <= 14 ? 0 : dias <= 30 ? 2 : 6}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => metrica === "ventas" ? formatMXN(v) : v.toLocaleString("es-MX")}
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" iconSize={8} />
                  {sucursalesSeleccionadas.map((sId, idx) => {
                    const nombre = sucursales.find(s => s.id === sId)?.nombre ?? `Tienda ${sId}`;
                    const dataKey = metrica === "ventas" ? `ventas_${nombre}` : `tx_${nombre}`;
                    return (
                      <Line
                        key={sId}
                        type="monotone"
                        dataKey={dataKey}
                        name={nombre}
                        stroke={COLORES[idx % COLORES.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: COLORES[idx % COLORES.length] }}
                        activeDot={{ r: 5 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPIs comparativos por sucursal seleccionada */}
      {modoComparativa && sucursalesSeleccionadas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sucursalesSeleccionadas.map((sId, idx) => {
            const h = historicosPorSucursal[idx];
            const nombre = sucursales.find(s => s.id === sId)?.nombre ?? `Tienda ${sId}`;
            const color = COLORES[idx % COLORES.length];
            const meta = avanceMeta.find(a => a.sucursalId === sId);
            return (
              <Card key={sId} className="border-0 shadow-sm bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <p className="text-sm font-semibold truncate">{nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Ventas {dias}d</p>
                      <p className="font-bold text-green-700">{h ? formatMXN(h.totalVentas) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Efectivo</p>
                      <p className="font-bold text-blue-700">{h ? formatMXN(h.totalEfectivo ?? 0) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rappi</p>
                      <p className="font-bold text-purple-700">{h ? formatMXN(h.totalRappi ?? 0) : "—"}</p>
                    </div>
                    {meta && meta.meta > 0 && (
                      <div>
                        <p className="text-muted-foreground">Avance meta</p>
                        <p className={`font-bold ${(meta.porcentaje ?? 0) >= 90 ? "text-green-700" : (meta.porcentaje ?? 0) >= 60 ? "text-yellow-700" : "text-red-700"}`}>
                          {(meta.porcentaje ?? 0).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Gráfica principal (modo individual) */}
      {!modoComparativa && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base font-semibold">
                {metricaActual.label} — Últimos {dias} días
                {sucursalId && sucursales.find(s => s.id === sucursalId) && (
                  <span className="text-muted-foreground font-normal text-sm ml-2">
                    · {sucursales.find(s => s.id === sucursalId)?.nombre}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {metricas.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMetrica(m.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      metrica === m.key
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : serie.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No hay reportes enviados en este período</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Los datos aparecen cuando los líderes envían sus reportes diarios</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serie} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="fechaLabel"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={dias <= 14 ? 0 : dias <= 30 ? 2 : 6}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v =>
                      metrica === "ventas" || metrica === "efectivo" || metrica === "tarjeta" || metrica === "rappi" ? formatMXN(v) :
                      v.toLocaleString("es-MX")
                    }
                    width={55}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {metrica === "ventas" && promedioVentas > 0 && (
                    <ReferenceLine
                      y={promedioVentas}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: "Prom.", position: "right", fontSize: 10, fill: "#94a3b8" }}
                    />
                  )}
                  <Bar
                    dataKey={metrica}
                    name={metricaActual.label}
                    fill={metricaActual.color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfica de línea comparativa ventas vs ticket (modo individual) */}
      {!modoComparativa && serie.length > 0 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ventas vs Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={serie} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="fechaLabel"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  interval={dias <= 14 ? 0 : dias <= 30 ? 2 : 6}
                />
                <YAxis
                  yAxisId="ventas"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => formatMXN(v)}
                  width={55}
                />
                <YAxis
                  yAxisId="ticket"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" iconSize={8} />
                <Line yAxisId="ventas" type="monotone" dataKey="ventas" name="Ventas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3, fill: "#16a34a" }} activeDot={{ r: 5 }} />
                <Line yAxisId="ticket" type="monotone" dataKey="rappi" name="Rappi" stroke="#ea580c" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: "#ea580c" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabla de datos (modo individual) */}
      {!modoComparativa && serie.length > 0 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Detalle por Día</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={exportarExcel}>
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ventas</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Efectivo</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarjeta</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Rappi</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Reportes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...serie].reverse().map((d, i) => (
                    <tr key={d.fecha} className={`border-b border-gray-50 hover:bg-muted/30 transition-colors ${i === 0 ? "font-medium" : ""}`}>
                      <td className="py-2.5 px-3 text-foreground">
                        {new Date(d.fecha + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-green-700 font-medium">
                        ${d.ventas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-blue-700">${d.efectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right text-purple-700">${d.tarjeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right text-orange-600">${d.rappi.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{d.reportes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === COMPARATIVA ENTRE SUCURSALES (modo individual, mes actual) === */}
      {!modoComparativa && !sucursalId && avanceMeta.length > 1 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Comparativa entre Sucursales — Mes Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...avanceMeta]
                .sort((a, b) => b.ventasMes - a.ventasMes)
                .map((a) => {
                  const pct = a.meta > 0 ? Math.min(100, (a.ventasMes / a.meta) * 100) : null;
                  const barColor = pct === null ? "bg-blue-400" : pct >= 90 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
                  const textColor = pct === null ? "text-blue-700" : pct >= 90 ? "text-green-700" : pct >= 60 ? "text-yellow-700" : "text-red-700";
                  const maxVentas = Math.max(...avanceMeta.map(x => x.ventasMes));
                  const barWidth = maxVentas > 0 ? (a.ventasMes / maxVentas) * 100 : 0;
                  return (
                    <div key={a.sucursalId} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-36 shrink-0">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium truncate">{a.nombre}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden relative">
                          <div className={`h-full rounded-lg transition-all ${barColor} opacity-80`} style={{ width: `${barWidth}%` }} />
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-foreground">
                            {formatMXN(a.ventasMes)}
                          </span>
                        </div>
                        {pct !== null && (
                          <span className={`text-xs font-bold w-12 text-right shrink-0 ${textColor}`}>{pct.toFixed(0)}%</span>
                        )}
                        {a.meta > 0 && (
                          <span className="text-xs text-muted-foreground w-24 text-right shrink-0">meta: {formatMXN(a.meta)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            {avanceMeta.every(a => a.meta === 0) && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Configura la meta mensual en la sección "Metas de Ventas" para ver el avance porcentual
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
