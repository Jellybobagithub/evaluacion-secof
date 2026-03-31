import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, Cell
} from "recharts";
import {
  ClipboardCheck, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, Star, Target, FileText, ChevronRight, BarChart2,
  Calendar, Award
} from "lucide-react";

const CALIFICACION_COLOR: Record<string, string> = {
  "Excelente": "text-emerald-600",
  "Muy Bien": "text-green-600",
  "Bien": "text-blue-600",
  "Regular": "text-amber-600",
  "Deficiente": "text-orange-600",
  "Acción Inmediata": "text-red-600",
};

const CALIFICACION_BG: Record<string, string> = {
  "Excelente": "bg-emerald-50 border-emerald-200",
  "Muy Bien": "bg-green-50 border-green-200",
  "Bien": "bg-blue-50 border-blue-200",
  "Regular": "bg-amber-50 border-amber-200",
  "Deficiente": "bg-orange-50 border-orange-200",
  "Acción Inmediata": "bg-red-50 border-red-200",
};

const CATEGORIA_COLORS: Record<string, string> = {
  "Control": "#6366f1",
  "Higiene": "#22c55e",
  "Hospitalidad": "#f59e0b",
  "Imagen": "#ec4899",
  "Mantenimiento": "#8b5cf6",
  "Operación": "#14b8a6",
};

export default function DashboardSecof() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [sucursalId, setSucursalId] = useState<number | null>(null);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  // Todas las sucursales disponibles (el filtrado por rol ya lo hace el backend)
  const sucursalesDisponibles = sucursales;

  // Historial comparativo de la sucursal seleccionada
  const { data: historial = [] } = trpc.historial.comparativo.useQuery(
    { sucursalId: sucursalId ?? undefined, limit: 12 },
    { enabled: true }
  );

  // Todas las evaluaciones para resumen global
  const { data: todasEvaluaciones = [] } = trpc.evaluaciones.list.useQuery({});

  // Plan de acción pendiente
  const { data: planAccion = [] } = trpc.planAccion.list.useQuery(
    { sucursalId: sucursalId ?? undefined },
    { enabled: true }
  );

  // Métricas calculadas
  const evaluacionesFiltradas = useMemo(() => {
    if (!sucursalId) return historial;
    return historial.filter((e: any) => e.sucursalId === sucursalId);
  }, [historial, sucursalId]);

  const ultimaEval = evaluacionesFiltradas[0];
  const penultimaEval = evaluacionesFiltradas[1];

  const delta = useMemo(() => {
    if (!ultimaEval || !penultimaEval) return null;
    return (ultimaEval.porcentajeGeneral ?? 0) - (penultimaEval.porcentajeGeneral ?? 0);
  }, [ultimaEval, penultimaEval]);

  // Resumen por sucursal (global)
  const resumenPorSucursal = useMemo(() => {
    const map: Record<number, { nombre: string; ultima: any; count: number }> = {};
    for (const ev of historial) {
      if (!map[ev.sucursalId]) {
        const suc = sucursales.find((s: any) => s.id === ev.sucursalId);
        map[ev.sucursalId] = { nombre: suc?.nombre ?? `Tienda ${ev.sucursalId}`, ultima: ev, count: 0 };
      }
      map[ev.sucursalId].count++;
    }
    return Object.values(map).sort((a, b) => (b.ultima?.porcentajeGeneral ?? 0) - (a.ultima?.porcentajeGeneral ?? 0));
  }, [historial, sucursales]);

  // Tendencia para gráfica
  const tendenciaData = useMemo(() => {
    return [...evaluacionesFiltradas].reverse().slice(-10).map((ev: any) => ({
      fecha: new Date(ev.fecha).toLocaleDateString("es-MX", { month: "short", day: "numeric" }),
      puntaje: ev.porcentajeGeneral ?? 0,
      calificacion: ev.calificacion ?? "",
    }));
  }, [evaluacionesFiltradas]);

  // Radar de categorías de la última evaluación
  const radarData = useMemo(() => {
    if (!ultimaEval?.puntuacionPorCategoria) return [];
    const cats = typeof ultimaEval.puntuacionPorCategoria === "string"
      ? JSON.parse(ultimaEval.puntuacionPorCategoria)
      : ultimaEval.puntuacionPorCategoria;
    return Object.entries(cats).map(([cat, data]: [string, any]) => ({
      categoria: cat,
      puntaje: data.porcentaje ?? 0,
    }));
  }, [ultimaEval]);

  // Acciones pendientes
  const accionesPendientes = planAccion.filter((a: any) => a.estado !== "completado");
  const accionesCompletadas = planAccion.filter((a: any) => a.estado === "completado");

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Resumen SECOF</h1>
            <p className="text-sm text-muted-foreground">Evaluaciones de calidad operativa por tienda</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={sucursalId?.toString() ?? "all"} onValueChange={(v) => setSucursalId(v === "all" ? null : Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las tiendas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tiendas</SelectItem>
              {sucursalesDisponibles.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/nueva-evaluacion")} className="gap-2">
            <ClipboardCheck className="w-4 h-4" /> Nueva evaluación
          </Button>
        </div>
      </div>

      {/* Resumen global por sucursal (cuando no hay filtro) */}
      {!sucursalId && resumenPorSucursal.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Estado por tienda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumenPorSucursal.map((item) => {
              const pct = item.ultima?.porcentajeGeneral ?? 0;
              const cal = item.ultima?.calificacion ?? "Sin evaluar";
              const colorText = CALIFICACION_COLOR[cal] ?? "text-gray-500";
              const colorBg = CALIFICACION_BG[cal] ?? "bg-gray-50 border-gray-200";
              return (
                <Card
                  key={item.nombre}
                  className={`cursor-pointer hover:shadow-md transition-shadow border ${colorBg}`}
                  onClick={() => {
                    const suc = sucursales.find((s: any) => s.nombre === item.nombre);
                    if (suc) setSucursalId((suc as any).id);
                  }}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{item.nombre}</p>
                      <Badge className={`text-xs ${colorText}`} variant="outline">{cal}</Badge>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-bold ${colorText}`}>{pct.toFixed(0)}%</span>
                      <span className="text-xs text-muted-foreground mb-1">{item.count} evaluación{item.count !== 1 ? "es" : ""}</span>
                    </div>
                    {/* Mini barra */}
                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Última: {item.ultima?.fecha ? new Date(item.ultima.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista detallada de una sucursal */}
      {sucursalId && (
        <>
          {/* KPIs principales */}
          {ultimaEval ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Puntaje actual */}
              <Card className={`border ${CALIFICACION_BG[ultimaEval.calificacion ?? ""] ?? "bg-gray-50 border-gray-200"}`}>
                <CardContent className="pt-4 pb-4 text-center">
                  <Award className={`w-6 h-6 mx-auto mb-1 ${CALIFICACION_COLOR[ultimaEval.calificacion ?? ""] ?? "text-gray-500"}`} />
                  <p className={`text-3xl font-bold ${CALIFICACION_COLOR[ultimaEval.calificacion ?? ""] ?? "text-gray-700"}`}>
                    {(ultimaEval.porcentajeGeneral ?? 0).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Última evaluación</p>
                  <Badge className="mt-1 text-xs" variant="outline">{ultimaEval.calificacion}</Badge>
                </CardContent>
              </Card>

              {/* Tendencia */}
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  {delta === null ? (
                    <Minus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                  ) : delta > 0 ? (
                    <TrendingUp className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                  ) : delta < 0 ? (
                    <TrendingDown className="w-6 h-6 mx-auto mb-1 text-red-500" />
                  ) : (
                    <Minus className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                  )}
                  <p className={`text-3xl font-bold ${delta === null ? "text-gray-400" : delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-gray-500"}`}>
                    {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">vs evaluación anterior</p>
                </CardContent>
              </Card>

              {/* Total evaluaciones */}
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <BarChart2 className="w-6 h-6 mx-auto mb-1 text-indigo-500" />
                  <p className="text-3xl font-bold text-indigo-600">{evaluacionesFiltradas.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Evaluaciones totales</p>
                </CardContent>
              </Card>

              {/* Acciones pendientes */}
              <Card className={accionesPendientes.length > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
                <CardContent className="pt-4 pb-4 text-center">
                  {accionesPendientes.length > 0
                    ? <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-amber-500" />
                    : <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-500" />
                  }
                  <p className={`text-3xl font-bold ${accionesPendientes.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {accionesPendientes.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Acciones pendientes</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin evaluaciones registradas</p>
                <p className="text-sm mt-1">Realiza la primera evaluación SECOF de esta tienda</p>
                <Button className="mt-4" onClick={() => navigate("/nueva-evaluacion")}>
                  Iniciar evaluación
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Gráficas */}
          {evaluacionesFiltradas.length >= 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tendencia histórica */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Tendencia histórica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={tendenciaData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "SECOF"]} />
                      <Line
                        type="monotone"
                        dataKey="puntaje"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#6366f1" }}
                        activeDot={{ r: 6 }}
                      />
                      {/* Línea de referencia 85% */}
                      <Line type="monotone" dataKey={() => 85} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Meta 85%" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Radar de categorías */}
              {radarData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Categorías — última evaluación
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                        <Radar dataKey="puntaje" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Historial reciente */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Historial de evaluaciones
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/historial")}>
                  Ver todo <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {evaluacionesFiltradas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin evaluaciones para esta tienda</p>
              ) : (
                <div className="space-y-2">
                  {evaluacionesFiltradas.slice(0, 6).map((ev: any, idx: number) => {
                    const prev = evaluacionesFiltradas[idx + 1];
                    const d = prev ? (ev.porcentajeGeneral ?? 0) - (prev.porcentajeGeneral ?? 0) : null;
                    const colorText = CALIFICACION_COLOR[ev.calificacion ?? ""] ?? "text-gray-500";
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/evaluacion/${ev.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${(ev.porcentajeGeneral ?? 0) >= 90 ? "bg-emerald-500" : (ev.porcentajeGeneral ?? 0) >= 75 ? "bg-green-500" : (ev.porcentajeGeneral ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`} />
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(ev.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground">{ev.evaluadorNombre ?? "Evaluador"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {d !== null && (
                            <span className={`text-xs font-medium ${d > 0 ? "text-emerald-600" : d < 0 ? "text-red-500" : "text-gray-400"}`}>
                              {d > 0 ? "▲" : d < 0 ? "▼" : "—"} {Math.abs(d).toFixed(1)}%
                            </span>
                          )}
                          <span className={`text-sm font-bold ${colorText}`}>
                            {(ev.porcentajeGeneral ?? 0).toFixed(0)}%
                          </span>
                          <Badge className={`text-xs ${colorText}`} variant="outline">{ev.calificacion}</Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acciones del plan */}
          {planAccion.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-500" />
                    Plan de acción ({accionesPendientes.length} pendientes, {accionesCompletadas.length} completadas)
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/plan-accion")}>
                    Ver todo <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {accionesPendientes.slice(0, 4).map((acc: any) => (
                    <div key={acc.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acc.area}</p>
                        {acc.fechaCompromiso && (
                          <p className="text-xs text-muted-foreground">
                            Compromiso: {new Date(acc.fechaCompromiso).toLocaleDateString("es-MX")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {acc.estado === "en_proceso" ? "En proceso" : "Pendiente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Escala de referencia SECOF */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Escala de calificación SECOF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Excelente", rango: "95–100%", color: "bg-emerald-100 border-emerald-300 text-emerald-800" },
              { label: "Muy Bien", rango: "85–94%", color: "bg-green-100 border-green-300 text-green-800" },
              { label: "Bien", rango: "75–84%", color: "bg-blue-100 border-blue-300 text-blue-800" },
              { label: "Regular", rango: "60–74%", color: "bg-amber-100 border-amber-300 text-amber-800" },
              { label: "Deficiente", rango: "45–59%", color: "bg-orange-100 border-orange-300 text-orange-800" },
              { label: "Acción Inmediata", rango: "<45%", color: "bg-red-100 border-red-300 text-red-800" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 text-center ${item.color}`}>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-xs mt-0.5 opacity-80">{item.rango}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
