import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Eye, BarChart2,
  Award, AlertTriangle, Calendar, ChevronUp, ChevronDown,
} from "lucide-react";
import { getCalificacion, SECCIONES } from "../../../shared/evaluacionData";

const CATEGORIA_COLORS: Record<string, string> = {
  Control:       "#6366f1",
  Higiene:       "#22c55e",
  Hospitalidad:  "#f59e0b",
  Imagen:        "#3b82f6",
  Mantenimiento: "#ef4444",
  "Operación":   "#8b5cf6",
};

const CATEGORIAS = ["Control", "Higiene", "Hospitalidad", "Imagen", "Mantenimiento", "Operación"];

type EvalRow = {
  id: number;
  sucursalId: number;
  fecha: Date;
  evaluadorNombre: string | null;
  puntosObtenidos: number | null;
  puntosMaximos: number | null;
  porcentajeGeneral: number | null;
  calificacion: string | null;
  puntuacionPorCategoria: unknown;
  puntuacionPorSeccion: unknown;
};

function pct(cat: Record<string, { obtenidos: number; maximos: number }>, key: string) {
  const v = cat[key];
  if (!v || v.maximos === 0) return null;
  return Math.round((v.obtenidos / v.maximos) * 100);
}

function formatFecha(d: Date) {
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function Comparativa() {
  const [, setLocation] = useLocation();
  const [sucursalId, setSucursalId] = useState<string>("all");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: rawData = [] } = trpc.historial.comparativo.useQuery({
    sucursalId: sucursalId !== "all" ? parseInt(sucursalId) : undefined,
    limit: 30,
  });

  // Cast and sort ascending by fecha
  const data: EvalRow[] = useMemo(() =>
    [...rawData].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
    [rawData]
  );

  // ── Tendencia general ──────────────────────────────────────────────────────
  const tendenciaData = useMemo(() =>
    data.map((ev, i) => {
      const cat = (ev.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
      const row: Record<string, number | string> = {
        fecha: formatFecha(ev.fecha),
        idx: i + 1,
        General: parseFloat((ev.porcentajeGeneral ?? 0).toFixed(1)),
      };
      for (const c of CATEGORIAS) {
        const v = pct(cat, c);
        if (v !== null) row[c] = v;
      }
      return row;
    }),
    [data]
  );

  // ── Comparativa por sección (últimas 3 evaluaciones) ─────────────────────
  const last3 = data.slice(-3);
  const seccionData = useMemo(() =>
    SECCIONES.map(sec => {
      const row: Record<string, string | number> = { seccion: sec.nombre.replace(/^\d+\.\-\s*/, "").slice(0, 22) };
      last3.forEach((ev, i) => {
        const ps = (ev.puntuacionPorSeccion as Record<string, { obtenidos: number; maximos: number; nombre: string }>) ?? {};
        const v = ps[String(sec.numero)];
        row[`Eval ${i + 1}`] = v && v.maximos > 0 ? Math.round((v.obtenidos / v.maximos) * 100) : 0;
      });
      return row;
    }),
    [last3]
  );

  // ── Radar de última evaluación vs penúltima ────────────────────────────────
  const radarData = useMemo(() => {
    if (data.length < 1) return [];
    const last = data[data.length - 1];
    const prev = data.length >= 2 ? data[data.length - 2] : null;
    const catLast = (last.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
    const catPrev = prev ? (prev.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {} : {};
    return CATEGORIAS.map(c => ({
      categoria: c,
      Actual: pct(catLast, c) ?? 0,
      Anterior: prev ? (pct(catPrev, c) ?? 0) : null,
    }));
  }, [data]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (data.length === 0) return null;
    const last = data[data.length - 1];
    const prev = data.length >= 2 ? data[data.length - 2] : null;
    const delta = prev && last.porcentajeGeneral != null && prev.porcentajeGeneral != null
      ? last.porcentajeGeneral - prev.porcentajeGeneral : null;

    const avg = data.reduce((s, e) => s + (e.porcentajeGeneral ?? 0), 0) / data.length;
    const best = data.reduce((b, e) => (e.porcentajeGeneral ?? 0) > (b.porcentajeGeneral ?? 0) ? e : b, data[0]);
    const worst = data.reduce((w, e) => (e.porcentajeGeneral ?? 100) < (w.porcentajeGeneral ?? 100) ? e : w, data[0]);

    // Best and worst categories in latest eval
    const catLast = (last.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
    const catEntries = CATEGORIAS
      .map(c => ({ c, v: pct(catLast, c) ?? 0 }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v);

    return { last, prev, delta, avg, best, worst, bestCat: catEntries[0], worstCat: catEntries[catEntries.length - 1] };
  }, [data]);

  // ── Tabla resumen ─────────────────────────────────────────────────────────
  const tablaData = useMemo(() =>
    [...data].reverse().map((ev, i, arr) => {
      const prev = arr[i + 1];
      const delta = prev && ev.porcentajeGeneral != null && prev.porcentajeGeneral != null
        ? ev.porcentajeGeneral - prev.porcentajeGeneral : null;
      return { ev, delta };
    }),
    [data]
  );

  const noData = data.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comparativa y Evolución</h1>
          <p className="text-muted-foreground mt-1">Análisis de tendencias y progreso por evaluación</p>
        </div>
        <Select value={sucursalId} onValueChange={setSucursalId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {sucursales.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {noData ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-semibold text-lg">Sin evaluaciones completadas</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Completa al menos una evaluación para ver la comparativa y evolución.
            </p>
            <Button className="mt-4" onClick={() => setLocation("/evaluacion/nueva")}>
              Crear evaluación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Última calificación */}
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Última Evaluación</p>
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-bold" style={{ color: getCalificacion(kpis.last.porcentajeGeneral ?? 0).color }}>
                      {(kpis.last.porcentajeGeneral ?? 0).toFixed(1)}%
                    </p>
                    {kpis.delta !== null && (
                      <span className={`flex items-center gap-0.5 text-sm font-medium mb-1 ${kpis.delta > 0 ? "text-emerald-600" : kpis.delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {kpis.delta > 0 ? <TrendingUp className="h-4 w-4" /> : kpis.delta < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        {kpis.delta > 0 ? "+" : ""}{kpis.delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: getCalificacion(kpis.last.porcentajeGeneral ?? 0).color }}>
                    {getCalificacion(kpis.last.porcentajeGeneral ?? 0).label}
                  </p>
                </CardContent>
              </Card>

              {/* Promedio histórico */}
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Promedio Histórico</p>
                  <p className="text-3xl font-bold text-blue-600">{kpis.avg.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.length} evaluaciones</p>
                </CardContent>
              </Card>

              {/* Mejor categoría */}
              {kpis.bestCat && (
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Mejor Categoría</p>
                    <p className="text-3xl font-bold text-emerald-600">{kpis.bestCat.v}%</p>
                    <p className="text-xs text-emerald-700 mt-1 font-medium flex items-center gap-1">
                      <Award className="h-3 w-3" />{kpis.bestCat.c}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Área de oportunidad */}
              {kpis.worstCat && (
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Área de Oportunidad</p>
                    <p className="text-3xl font-bold text-red-500">{kpis.worstCat.v}%</p>
                    <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{kpis.worstCat.c}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Tendencia General */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendencia de Calificación General</CardTitle>
              <CardDescription>Evolución del porcentaje general a lo largo del tiempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={tendenciaData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`]} />
                  <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Muy Bien 95%", position: "insideTopRight", fontSize: 10, fill: "#22c55e" }} />
                  <ReferenceLine y={85} stroke="#f97316" strokeDasharray="4 4" label={{ value: "Regular 85%", position: "insideTopRight", fontSize: 10, fill: "#f97316" }} />
                  <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Oportunidad 70%", position: "insideTopRight", fontSize: 10, fill: "#ef4444" }} />
                  <Line
                    type="monotone"
                    dataKey="General"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#3b82f6" }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tendencia por Categoría */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolución por Categoría</CardTitle>
              <CardDescription>Tendencia de las 6 categorías de evaluación a lo largo del tiempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={tendenciaData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {CATEGORIAS.map(cat => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={CATEGORIA_COLORS[cat]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparativa por Sección — últimas 3 evaluaciones */}
          {last3.length >= 2 && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comparativa por Sección</CardTitle>
                <CardDescription>
                  Comparación de las últimas {last3.length} evaluaciones por sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-3 flex-wrap">
                  {last3.map((ev, i) => {
                    const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
                    return (
                      <div key={ev.id} className="flex items-center gap-2 text-xs">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ["#3b82f6", "#f59e0b", "#8b5cf6"][i] }} />
                        <span className="text-muted-foreground">Eval {i + 1}:</span>
                        <span className="font-medium">{formatFecha(ev.fecha)}</span>
                        <span className="font-bold" style={{ color: calif.color }}>{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={seccionData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="seccion" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {last3.map((_, i) => (
                      <Bar key={i} dataKey={`Eval ${i + 1}`} fill={["#3b82f6", "#f59e0b", "#8b5cf6"][i]} radius={[0, 3, 3, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar: Última vs Anterior */}
          {radarData.length > 0 && data.length >= 2 && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Radar: Última vs Evaluación Anterior</CardTitle>
                <CardDescription>Comparación de categorías entre las dos últimas evaluaciones</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Radar name="Actual" dataKey="Actual" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
                    {data.length >= 2 && (
                      <Radar name="Anterior" dataKey="Anterior" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} strokeDasharray="5 5" />
                    )}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabla Resumen */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historial Detallado</CardTitle>
              <CardDescription>Todas las evaluaciones con calificación y variación respecto a la anterior</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Fecha</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Sucursal</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase">Evaluador</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase text-right">Calificación</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs uppercase text-right">Variación</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase text-center">Nivel</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {tablaData.map(({ ev, delta }) => {
                    const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
                    const sucursal = sucursales.find(s => s.id === ev.sucursalId);
                    return (
                      <tr key={ev.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 pr-4">
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Calendar className="h-3 w-3" />
                            {formatFecha(ev.fecha)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-xs">{sucursal?.nombre ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{ev.evaluadorNombre ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <span className="font-bold text-sm" style={{ color: calif.color }}>
                            {(ev.porcentajeGeneral ?? 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {delta !== null ? (
                            <span className={`flex items-center justify-end gap-0.5 text-xs font-medium ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                              {delta > 0 ? <ChevronUp className="h-3.5 w-3.5" /> : delta < 0 ? <ChevronDown className="h-3.5 w-3.5" /> : <Minus className="h-3 w-3" />}
                              {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            className="text-xs px-2 py-0.5 font-medium"
                            style={{ background: calif.color + "20", color: calif.color, border: `1px solid ${calif.color}40` }}
                          >
                            {calif.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 pl-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLocation(`/evaluacion/${ev.id}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Análisis de progreso por categoría */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Progreso por Categoría</CardTitle>
              <CardDescription>Comparación de la primera vs última evaluación por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              {data.length >= 2 ? (
                <div className="space-y-3">
                  {CATEGORIAS.map(cat => {
                    const first = data[0];
                    const last = data[data.length - 1];
                    const catFirst = (first.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
                    const catLast = (last.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
                    const vFirst = pct(catFirst, cat);
                    const vLast = pct(catLast, cat);
                    if (vFirst === null && vLast === null) return null;
                    const diff = (vLast ?? 0) - (vFirst ?? 0);
                    const color = CATEGORIA_COLORS[cat];
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <div className="w-28 shrink-0">
                          <p className="text-xs font-medium">{cat}</p>
                        </div>
                        <div className="flex-1 relative h-6 bg-muted/30 rounded-full overflow-hidden">
                          {/* First bar */}
                          {vFirst !== null && (
                            <div
                              className="absolute top-0 left-0 h-full rounded-full opacity-30"
                              style={{ width: `${vFirst}%`, background: color }}
                            />
                          )}
                          {/* Last bar */}
                          {vLast !== null && (
                            <div
                              className="absolute top-0 left-0 h-full rounded-full"
                              style={{ width: `${vLast}%`, background: color }}
                            />
                          )}
                        </div>
                        <div className="w-16 text-right shrink-0">
                          <span className="text-sm font-bold" style={{ color }}>{vLast ?? "—"}%</span>
                        </div>
                        <div className="w-16 shrink-0">
                          {diff !== 0 ? (
                            <span className={`text-xs font-medium flex items-center gap-0.5 ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {diff > 0 ? "+" : ""}{diff}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Minus className="h-3 w-3" /> 0%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground mt-2">
                    Barra clara = primera evaluación ({formatFecha(data[0].fecha)}) · Barra sólida = última evaluación ({formatFecha(data[data.length - 1].fecha)})
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Se necesitan al menos 2 evaluaciones para comparar el progreso por categoría.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
