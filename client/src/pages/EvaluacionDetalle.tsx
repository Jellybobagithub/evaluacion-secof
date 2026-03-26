import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Calendar, User, Download, Target, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { getCalificacion, SECCIONES, TODOS_LOS_PUNTOS } from "../../../shared/evaluacionData";
import { exportEvaluacionPDF } from "@/lib/exportPDF";
import { toast } from "sonner";

export default function EvaluacionDetalle() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();

  const { data: evaluacion } = trpc.evaluaciones.getById.useQuery({ id });
  const { data: sucursal } = trpc.sucursales.getById.useQuery(
    { id: evaluacion?.sucursalId ?? 0 },
    { enabled: !!evaluacion?.sucursalId }
  );

  if (!evaluacion || evaluacion === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando evaluación...</p>
      </div>
    );
  }

  const ev = evaluacion;
  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
  const porCategoria = (ev.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
  const porSeccion = (ev.puntuacionPorSeccion as Record<string, { obtenidos: number; maximos: number; nombre: string }>) ?? {};

  // Radar data
  const radarData = Object.entries(porCategoria)
    .filter(([, v]) => v.maximos > 0)
    .map(([cat, v]) => ({
      categoria: cat,
      porcentaje: Math.round((v.obtenidos / v.maximos) * 100),
      fullMark: 100,
    }));

  // Bar data for sections
  const barData = SECCIONES.map(s => {
    const data = porSeccion[s.numero];
    const pct = data && data.maximos > 0 ? Math.round((data.obtenidos / data.maximos) * 100) : 0;
    return { nombre: `${s.numero}. ${s.nombre.split(" ").slice(0, 2).join(" ")}`, porcentaje: pct, color: getCalificacion(pct).color };
  });

  // Critical areas
  const criticalAreas = Object.entries(porCategoria)
    .filter(([, v]) => v.maximos > 0)
    .map(([cat, v]) => ({ cat, pct: (v.obtenidos / v.maximos) * 100, obtenidos: v.obtenidos, maximos: v.maximos }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  // Points that failed
  const respuestasMap: Record<string, string> = {};
  for (const r of ev.respuestas ?? []) {
    respuestasMap[r.puntoId] = r.respuesta;
  }
  const puntosNoAprobados = TODOS_LOS_PUNTOS.filter(p => respuestasMap[p.id] === "no");

  function handleExportPDF() {
    toast.info("Generando PDF...");
    exportEvaluacionPDF(ev, sucursal ? {
      nombre: sucursal.nombre,
      ciudad: sucursal.ciudad ?? undefined,
      estado: sucursal.estado ?? undefined,
      franquiciado: sucursal.franquiciado ?? undefined,
    } : null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/historial")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Resultado de Evaluación</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {sucursal && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{sucursal.nombre}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</span>
              {ev.evaluadorNombre && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{ev.evaluadorNombre}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Score hero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 border-0 shadow-sm" style={{ borderLeft: `4px solid ${calif.color}` }}>
          <CardContent className="p-5 text-center">
            <p className="text-5xl font-bold" style={{ color: calif.color }}>{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
            <p className="font-semibold mt-1" style={{ color: calif.color }}>{calif.label}</p>
            <p className="text-sm text-muted-foreground mt-2">{ev.puntosObtenidos ?? 0} / {ev.puntosMaximos ?? 0} pts</p>
          </CardContent>
        </Card>

        {criticalAreas.map(area => (
          <Card key={area.cat} className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-muted-foreground">{area.cat}</p>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold" style={{ color: getCalificacion(area.pct).color }}>{area.pct.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{area.obtenidos}/{area.maximos} pts · {getCalificacion(area.pct).label}</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${area.pct}%`, backgroundColor: getCalificacion(area.pct).color }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="categorias">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="categorias">Por Categoría</TabsTrigger>
          <TabsTrigger value="secciones">Por Sección</TabsTrigger>
          <TabsTrigger value="detalle">Puntos Fallidos</TabsTrigger>
          <TabsTrigger value="mejoras">Áreas de Mejora</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Radar por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Radar name="Porcentaje" dataKey="porcentaje" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalle por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(porCategoria)
                    .filter(([, v]) => v.maximos > 0)
                    .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
                    .map(([cat, v]) => {
                      const pct = (v.obtenidos / v.maximos) * 100;
                      const c = getCalificacion(pct);
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm font-medium w-28 shrink-0">{cat}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                          </div>
                          <span className="text-sm font-bold w-12 text-right" style={{ color: c.color }}>{pct.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground w-16 text-right">{v.obtenidos}/{v.maximos}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="secciones" className="mt-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultados por Sección</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} layout="vertical" margin={{ left: 120, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Porcentaje"]} />
                  <Bar dataKey="porcentaje" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalle" className="mt-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Puntos No Aprobados ({puntosNoAprobados.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {puntosNoAprobados.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-semibold">¡Todos los puntos aprobados!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {puntosNoAprobados.map(p => {
                    const seccion = SECCIONES.find(s => s.numero === p.seccion);
                    const resp = ev.respuestas?.find(r => r.puntoId === p.id);
                    return (
                      <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-100 bg-red-50/30">
                        <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5 w-8">{p.id}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p.descripcion}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{seccion?.nombre}</p>
                          {resp?.observacion && <p className="text-xs text-muted-foreground mt-1 italic">"{resp.observacion}"</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-xs text-red-600 border-red-200">{p.categoria}</Badge>
                          <Badge variant="secondary" className="text-xs">{p.valor} pts</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mejoras" className="mt-4">
          <div className="space-y-4">
            {Object.entries(porCategoria)
              .filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.85)
              .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
              .map(([cat, v]) => {
                const pct = (v.obtenidos / v.maximos) * 100;
                const c = getCalificacion(pct);
                const puntosCategoria = puntosNoAprobados.filter(p => p.categoria === cat);
                return (
                  <Card key={cat} className="border-0 shadow-sm bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" style={{ color: c.color }} />
                          <h3 className="font-semibold">{cat}</h3>
                          <Badge variant="outline" style={{ color: c.color, borderColor: c.color }}>{pct.toFixed(1)}% · {c.label}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">{v.obtenidos}/{v.maximos} pts</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                      {puntosCategoria.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Puntos a mejorar:</p>
                          <ul className="space-y-1">
                            {puntosCategoria.slice(0, 5).map(p => (
                              <li key={p.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-red-400 shrink-0">•</span>
                                <span><strong>{p.id}</strong>: {p.descripcion}</span>
                              </li>
                            ))}
                            {puntosCategoria.length > 5 && (
                              <li className="text-xs text-muted-foreground">+{puntosCategoria.length - 5} más...</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            {Object.entries(porCategoria).filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.85).length === 0 && (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="flex flex-col items-center py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-semibold">¡Excelente desempeño!</p>
                  <p className="text-sm text-muted-foreground mt-1">Todas las categorías superan el 85%</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan de acción CTA */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">¿Listo para mejorar?</h3>
            <p className="text-blue-100 text-sm mt-1">Crea un plan de acción para las áreas identificadas</p>
          </div>
          <Button variant="secondary" onClick={() => setLocation(`/plan-accion?evaluacionId=${id}&sucursalId=${ev.sucursalId}`)}>
            Crear Plan de Acción
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
