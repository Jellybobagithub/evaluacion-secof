import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ClipboardList, PlusCircle, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});

  const evaluacionesCompletadas = evaluaciones.filter(e => e.estado === "completada");
  const ultimasEvaluaciones = evaluacionesCompletadas.slice(0, 5);

  const promedioGeneral = evaluacionesCompletadas.length > 0
    ? evaluacionesCompletadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / evaluacionesCompletadas.length
    : 0;

  const calificacionPromedio = getCalificacion(promedioGeneral);

  const accionInmediata = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) < 70).length;
  const excelentes = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) >= 95).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Panel de Control</h1>
          <p className="text-muted-foreground mt-1">Sistema de Evaluación y Control de Franquicias Snowtea</p>
        </div>
        <Button onClick={() => setLocation("/evaluacion/nueva")} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Nueva Evaluación
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Sucursales</p>
                <p className="text-3xl font-bold mt-1">{sucursales.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{sucursales.filter(s => s.activa).length} activas</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Evaluaciones</p>
                <p className="text-3xl font-bold mt-1">{evaluacionesCompletadas.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{evaluaciones.filter(e => e.estado === "borrador").length} borradores</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Promedio General</p>
                <p className="text-3xl font-bold mt-1">{promedioGeneral.toFixed(1)}%</p>
                <p className="text-xs mt-1" style={{ color: calificacionPromedio.color }}>
                  {calificacionPromedio.label}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Acción Inmediata</p>
                <p className="text-3xl font-bold mt-1 text-red-600">{accionInmediata}</p>
                <p className="text-xs text-muted-foreground mt-1">{excelentes} excelentes</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas evaluaciones */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Últimas Evaluaciones</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/historial")} className="text-xs text-muted-foreground">
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {ultimasEvaluaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay evaluaciones completadas aún</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/evaluacion/nueva")}>
                  Crear primera evaluación
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {ultimasEvaluaciones.map(ev => {
                  const sucursal = sucursales.find(s => s.id === ev.sucursalId);
                  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/evaluacion/${ev.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sucursal?.nombre ?? "Sucursal"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                            {ev.evaluadorNombre && ` · ${ev.evaluadorNombre}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold">{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
                          <p className="text-xs" style={{ color: calif.color }}>{calif.label}</p>
                        </div>
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${ev.porcentajeGeneral ?? 0}%`, backgroundColor: calif.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sucursales */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Sucursales</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/sucursales")} className="text-xs text-muted-foreground">
                Gestionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sucursales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay sucursales registradas</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/sucursales")}>
                  Agregar sucursal
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sucursales.slice(0, 6).map(s => {
                  const evsS = evaluacionesCompletadas.filter(e => e.sucursalId === s.id);
                  const ultima = evsS[0];
                  const calif = ultima ? getCalificacion(ultima.porcentajeGeneral ?? 0) : null;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/sucursales/${s.id}`)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{s.nombre}</p>
                          <p className="text-xs text-muted-foreground">{s.ciudad ?? "Sin ciudad"}</p>
                        </div>
                      </div>
                      {calif ? (
                        <Badge variant="outline" style={{ color: calif.color, borderColor: calif.color }} className="text-xs">
                          {(ultima?.porcentajeGeneral ?? 0).toFixed(0)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Sin eval.</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Escala de calificación */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Escala de Calificación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Excelente", range: "100%", color: "#16a34a" },
              { label: "Muy Bien", range: "95-99%", color: "#22c55e" },
              { label: "Bien", range: "90-94%", color: "#84cc16" },
              { label: "Regular", range: "85-89%", color: "#eab308" },
              { label: "Mal", range: "80-84%", color: "#f97316" },
              { label: "Área de Oportunidad", range: "70-79%", color: "#ef4444" },
              { label: "Acción Inmediata", range: "0-69%", color: "#991b1b" },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center p-3 rounded-lg border text-center gap-1" style={{ borderColor: item.color + "40", backgroundColor: item.color + "08" }}>
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="text-xs font-semibold leading-tight" style={{ color: item.color }}>{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
