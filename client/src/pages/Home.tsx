import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ClipboardList,
  PlusCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShieldCheck,
  Users,
  Star,
  ChevronRight,
} from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";
import { hasRoleAccess } from "@/components/RoleGuard";

// Semáforo de calificación por porcentaje
function getSemaforo(pct: number | null): { color: string; bg: string; dot: string; label: string } {
  if (pct === null) return { color: "text-gray-400", bg: "bg-gray-50", dot: "bg-gray-300", label: "Sin evaluar" };
  if (pct >= 95) return { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", label: "Excelente" };
  if (pct >= 90) return { color: "text-green-700", bg: "bg-green-50", dot: "bg-green-500", label: "Bien" };
  if (pct >= 85) return { color: "text-lime-700", bg: "bg-lime-50", dot: "bg-lime-500", label: "Regular" };
  if (pct >= 80) return { color: "text-yellow-700", bg: "bg-yellow-50", dot: "bg-yellow-500", label: "Mal" };
  if (pct >= 70) return { color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500", label: "Área de Oportunidad" };
  return { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500", label: "Acción Inmediata" };
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});
  const { data: resumenVentas } = trpc.reportesDiarios.resumen.useQuery({ dias: 7 }, { enabled: hasRoleAccess(role, 'manager') });

  const evaluacionesCompletadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");
  const ultimasEvaluaciones = evaluacionesCompletadas.slice(0, 5);

  const promedioGeneral = evaluacionesCompletadas.length > 0
    ? evaluacionesCompletadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / evaluacionesCompletadas.length
    : 0;

  const calificacionPromedio = getCalificacion(promedioGeneral);
  const accionInmediata = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) < 70).length;
  const excelentes = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) >= 95).length;

  // Calcular última evaluación por sucursal para el semáforo
  const sucursalesConEstado = sucursales.map(s => {
    const evsS = evaluacionesCompletadas
      .filter(e => e.sucursalId === s.id)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const ultima = evsS[0] ?? null;
    const penultima = evsS[1] ?? null;
    const pct = ultima ? (ultima.porcentajeGeneral ?? 0) : null;
    const pctAnterior = penultima ? (penultima.porcentajeGeneral ?? 0) : null;
    const tendencia = pct !== null && pctAnterior !== null
      ? pct - pctAnterior
      : null;
    return { ...s, ultima, pct, tendencia, semaforo: getSemaforo(pct) };
  });

  // Conteo por semáforo
  const conteoSemaforo = {
    critico: sucursalesConEstado.filter(s => s.pct !== null && s.pct < 70).length,
    atencion: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 70 && s.pct < 85).length,
    bien: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 85).length,
    sinEval: sucursalesConEstado.filter(s => s.pct === null).length,
  };

  const isAdmin = hasRoleAccess(role, "admin");
  const isManager = hasRoleAccess(role, "manager");
  const isLeader = hasRoleAccess(role, "leader");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? "Dashboard Ejecutivo" : isManager ? "Panel de Tiendas" : "Mi Panel"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bienvenido, {user?.name?.split(" ")[0] ?? "usuario"} ·{" "}
            <span className="text-foreground/70">
              {isAdmin ? "Vista completa del sistema" : isManager ? "Vista de tiendas asignadas" : "Vista de operaciones"}
            </span>
          </p>
        </div>
        {isLeader && (
          <Button onClick={() => setLocation("/evaluacion/nueva")} className="gap-2 bg-green-600 hover:bg-green-700">
            <PlusCircle className="h-4 w-4" />
            Nueva Evaluación
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isManager && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sucursales</p>
                  <p className="text-3xl font-bold mt-1">{sucursales.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sucursales.filter(s => s.activa).length} activas</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Evaluaciones</p>
                <p className="text-3xl font-bold mt-1">{evaluacionesCompletadas.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {borradores.length > 0 ? `${borradores.length} borradores` : "Sin borradores"}
                </p>
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
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Promedio SECOF</p>
                <p className="text-3xl font-bold mt-1">{promedioGeneral.toFixed(1)}%</p>
                <p className="text-xs mt-1 font-medium" style={{ color: calificacionPromedio.color }}>
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
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acción Inmediata</p>
                <p className={`text-3xl font-bold mt-1 ${accionInmediata > 0 ? "text-red-600" : "text-green-600"}`}>
                  {accionInmediata}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{excelentes} excelentes</p>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${accionInmediata > 0 ? "bg-red-50" : "bg-green-50"}`}>
                {accionInmediata > 0
                  ? <AlertTriangle className="h-6 w-6 text-red-600" />
                  : <CheckCircle2 className="h-6 w-6 text-green-600" />
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs de Ventas (solo para manager+) */}
      {isManager && resumenVentas && resumenVentas.reportesEnviados > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Ventas Últimos 7 Días</h2>
            <span className="text-xs text-muted-foreground">{resumenVentas.reportesEnviados} reporte{resumenVentas.reportesEnviados !== 1 ? 's' : ''} enviado{resumenVentas.reportesEnviados !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ventas Totales</p>
                <p className="text-2xl font-bold mt-1 text-green-700">
                  ${resumenVentas.totalVentas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">MXN acumulado</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Transacciones</p>
                <p className="text-2xl font-bold mt-1 text-blue-700">{resumenVentas.totalTx}</p>
                <p className="text-xs text-muted-foreground mt-1">ventas registradas</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Promedio</p>
                <p className="text-2xl font-bold mt-1 text-purple-700">
                  ${resumenVentas.avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">por transacción</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Semáforo de tiendas (solo para manager+) */}
      {isManager && sucursales.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Estado de Tiendas</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {conteoSemaforo.critico > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  {conteoSemaforo.critico} crítica{conteoSemaforo.critico !== 1 ? "s" : ""}
                </span>
              )}
              {conteoSemaforo.atencion > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                  {conteoSemaforo.atencion} atención
                </span>
              )}
              {conteoSemaforo.bien > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  {conteoSemaforo.bien} bien
                </span>
              )}
              {conteoSemaforo.sinEval > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-300 inline-block" />
                  {conteoSemaforo.sinEval} sin evaluar
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sucursalesConEstado.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${s.semaforo.bg} border-transparent hover:border-gray-200`}
                onClick={() => setLocation(`/sucursales/${s.id}`)}
              >
                {/* Indicador semáforo */}
                <div className="relative shrink-0">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.semaforo.bg}`}>
                    <Building2 className={`h-5 w-5 ${s.semaforo.color}`} />
                  </div>
                  <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${s.semaforo.dot}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.ciudad ?? "Sin ciudad"}</p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  {s.pct !== null ? (
                    <>
                      <p className={`text-base font-bold ${s.semaforo.color}`}>{s.pct.toFixed(0)}%</p>
                      {s.tendencia !== null && (
                        <div className="flex items-center justify-end gap-0.5">
                          {s.tendencia > 0
                            ? <ArrowUpRight className="h-3 w-3 text-green-500" />
                            : s.tendencia < 0
                            ? <ArrowDownRight className="h-3 w-3 text-red-500" />
                            : <Minus className="h-3 w-3 text-gray-400" />
                          }
                          <span className={`text-xs font-medium ${s.tendencia > 0 ? "text-green-600" : s.tendencia < 0 ? "text-red-600" : "text-gray-400"}`}>
                            {s.tendencia > 0 ? "+" : ""}{s.tendencia.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin eval.</span>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas evaluaciones */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Últimas Evaluaciones</CardTitle>
              {isLeader && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/historial")} className="text-xs text-muted-foreground gap-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {ultimasEvaluaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No hay evaluaciones completadas aún</p>
                {isLeader && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/evaluacion/nueva")}>
                    Crear primera evaluación
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {ultimasEvaluaciones.map(ev => {
                  const sucursal = sucursales.find(s => s.id === ev.sucursalId);
                  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
                  const sem = getSemaforo(ev.porcentajeGeneral ?? 0);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/evaluacion/${ev.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${sem.bg}`}>
                          <Building2 className={`h-4 w-4 ${sem.color}`} />
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
                          <p className="text-xs font-medium" style={{ color: calif.color }}>{calif.label}</p>
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

        {/* Panel lateral: accesos rápidos + escala */}
        <div className="space-y-4">
          {/* Accesos rápidos */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Accesos Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLeader && (
                <button
                  onClick={() => setLocation("/evaluacion/nueva")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-colors">
                    <PlusCircle className="h-4 w-4 text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Nueva Evaluación</p>
                    <p className="text-xs text-muted-foreground">Iniciar SECOF</p>
                  </div>
                </button>
              )}
              {isLeader && (
                <button
                  onClick={() => setLocation("/historial")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                    <Activity className="h-4 w-4 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Historial</p>
                    <p className="text-xs text-muted-foreground">Ver evaluaciones pasadas</p>
                  </div>
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => setLocation("/comparativa")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-200 transition-colors">
                    <TrendingUp className="h-4 w-4 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Comparativa</p>
                    <p className="text-xs text-muted-foreground">Evolución por tienda</p>
                  </div>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setLocation("/admin/usuarios")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-amber-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                    <Users className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Usuarios y Roles</p>
                    <p className="text-xs text-muted-foreground">Gestionar accesos</p>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>

          {/* Mini escala de calificación */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Escala SECOF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { label: "Excelente", range: "100%", color: "#16a34a" },
                { label: "Muy Bien", range: "95–99%", color: "#22c55e" },
                { label: "Bien", range: "90–94%", color: "#84cc16" },
                { label: "Regular", range: "85–89%", color: "#eab308" },
                { label: "Mal", range: "80–84%", color: "#f97316" },
                { label: "Área de Oportunidad", range: "70–79%", color: "#ef4444" },
                { label: "Acción Inmediata", range: "0–69%", color: "#991b1b" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-foreground/80 flex-1">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.range}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
