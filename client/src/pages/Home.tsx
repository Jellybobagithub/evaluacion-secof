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
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShieldCheck,
  Users,
  ChevronRight,
  DollarSign,
  FileText,
  BarChart3,
  Target,
  Store,
} from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";
import { hasRoleAccess } from "@/components/RoleGuard";

function getSemaforo(pct: number | null) {
  if (pct === null) return { color: "text-gray-400", bg: "bg-gray-50", dot: "bg-gray-300", label: "Sin evaluar", border: "border-gray-200" };
  if (pct >= 95) return { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", label: "Excelente", border: "border-emerald-200" };
  if (pct >= 90) return { color: "text-green-700", bg: "bg-green-50", dot: "bg-green-500", label: "Bien", border: "border-green-200" };
  if (pct >= 85) return { color: "text-lime-700", bg: "bg-lime-50", dot: "bg-lime-500", label: "Regular", border: "border-lime-200" };
  if (pct >= 80) return { color: "text-yellow-700", bg: "bg-yellow-50", dot: "bg-yellow-500", label: "Mal", border: "border-yellow-200" };
  if (pct >= 70) return { color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500", label: "Área de Oportunidad", border: "border-orange-200" };
  return { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500", label: "Acción Inmediata", border: "border-red-200" };
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";

  const isAdmin = hasRoleAccess(role, "admin");
  const isManager = hasRoleAccess(role, "manager");
  const isLeader = hasRoleAccess(role, "leader");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});
  const { data: resumenVentas } = trpc.reportesDiarios.resumen.useQuery(
    { dias: 7 },
    { enabled: hasRoleAccess(role, 'manager') }
  );
  const { data: avanceMeta = [] } = trpc.reportesDiarios.avanceMeta.useQuery(
    undefined,
    { enabled: hasRoleAccess(role, 'manager') }
  );
  const { data: sinReporte = [] } = trpc.reportesDiarios.sinReporte.useQuery(
    { dias: 2 },
    { enabled: hasRoleAccess(role, 'manager') }
  );

  const evaluacionesCompletadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");

  const promedioGeneral = evaluacionesCompletadas.length > 0
    ? evaluacionesCompletadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / evaluacionesCompletadas.length
    : 0;

  const calificacionPromedio = getCalificacion(promedioGeneral);
  const accionInmediata = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) < 70).length;
  const excelentes = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) >= 95).length;

  // Estado por sucursal para semáforo
  const sucursalesConEstado = sucursales.map(s => {
    const evsS = evaluacionesCompletadas
      .filter(e => e.sucursalId === s.id)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const ultima = evsS[0] ?? null;
    const penultima = evsS[1] ?? null;
    const pct = ultima ? (ultima.porcentajeGeneral ?? 0) : null;
    const pctAnterior = penultima ? (penultima.porcentajeGeneral ?? 0) : null;
    const tendencia = pct !== null && pctAnterior !== null ? pct - pctAnterior : null;
    const ventasSemana = resumenVentas?.reportesPorSucursal?.[s.id]?.ventas ?? null;
    return { ...s, ultima, pct, tendencia, semaforo: getSemaforo(pct), ventasSemana };
  });

  const conteoSemaforo = {
    critico: sucursalesConEstado.filter(s => s.pct !== null && s.pct < 70).length,
    atencion: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 70 && s.pct < 85).length,
    bien: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 85).length,
    sinEval: sucursalesConEstado.filter(s => s.pct === null).length,
  };

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
            <span className="text-foreground/60 capitalize">{role === "superadmin" ? "Super Admin" : role === "owner" ? "Dueño" : role === "manager" ? "Admin Tienda" : role === "leader" ? "Líder" : role}</span>
          </p>
        </div>
        {isLeader && (
          <Button onClick={() => setLocation("/evaluacion/nueva")} className="gap-2 bg-green-600 hover:bg-green-700">
            <PlusCircle className="h-4 w-4" />
            Nueva Evaluación
          </Button>
        )}
      </div>

      {/* === PILAR 1: KPIs Globales === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isManager && (
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/sucursales")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tiendas</p>
                  <p className="text-3xl font-bold mt-1">{sucursales.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sucursales.filter(s => s.activa).length} activas</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Store className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/historial")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Evaluaciones</p>
                <p className="text-3xl font-bold mt-1">{evaluacionesCompletadas.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {borradores.length > 0 ? `${borradores.length} borradores` : "Todas completadas"}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Promedio SECOF</p>
                <p className="text-3xl font-bold mt-1">{promedioGeneral.toFixed(1)}%</p>
                <p className="text-xs mt-1 font-medium" style={{ color: calificacionPromedio.color }}>
                  {calificacionPromedio.label}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isManager && resumenVentas && resumenVentas.reportesEnviados > 0 ? (
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/reporte-diario")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ventas 7 días</p>
                  <p className="text-2xl font-bold mt-1 text-green-700">
                    ${resumenVentas.totalVentas >= 1000
                      ? (resumenVentas.totalVentas / 1000).toFixed(1) + "k"
                      : resumenVentas.totalVentas.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{resumenVentas.reportesEnviados} reportes</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-green-50 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acción Inmediata</p>
                  <p className={`text-3xl font-bold mt-1 ${accionInmediata > 0 ? "text-red-600" : "text-green-600"}`}>
                    {accionInmediata}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{excelentes} excelentes</p>
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accionInmediata > 0 ? "bg-red-50" : "bg-green-50"}`}>
                  {accionInmediata > 0
                    ? <AlertTriangle className="h-5 w-5 text-red-600" />
                    : <CheckCircle2 className="h-5 w-5 text-green-600" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* === PILAR 2: Tiendas — Semáforo Integrado (SECOF + Ventas) === */}
      {isManager && sucursales.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Estado de Tiendas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">SECOF · Ventas 7 días</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {conteoSemaforo.critico > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  {conteoSemaforo.critico} crítica{conteoSemaforo.critico !== 1 ? "s" : ""}
                </span>
              )}
              {conteoSemaforo.atencion > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                  {conteoSemaforo.atencion} atención
                </span>
              )}
              {conteoSemaforo.bien > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  {conteoSemaforo.bien} bien
                </span>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setLocation("/sucursales")}>
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sucursalesConEstado.map(s => (
              <div
                key={s.id}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md bg-white hover:border-gray-300`}
                onClick={() => setLocation(`/sucursales/${s.id}`)}
              >
                <div className="flex items-center gap-3">
                  {/* Indicador */}
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

                  {/* Score SECOF */}
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

                {/* Ventas de la semana (si hay datos) */}
                {s.ventasSemana !== null && s.ventasSemana > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Ventas 7 días
                    </span>
                    <span className="text-xs font-semibold text-green-700">
                      ${s.ventasSemana.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === ALERTA: Tiendas sin reporte === */}
      {isManager && sinReporte.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Tiendas sin reporte en los últimos 2 días</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {sinReporte.map(s => s.nombre).join(" · ")}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-amber-700 hover:bg-amber-100 h-7" onClick={() => setLocation("/reporte-diario")}>
            Ver reportes
          </Button>
        </div>
      )}

      {/* === PILAR META: Avance vs Meta Mensual === */}
      {isManager && avanceMeta.length > 0 && avanceMeta.some(a => a.meta > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Avance vs Meta Mensual</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ventas acumuladas del mes actual</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setLocation("/ventas")}>
              Ver detalle <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {avanceMeta.filter(a => a.meta > 0).map(a => {
              const pct = a.porcentaje ?? 0;
              const color = pct >= 90 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
              const textColor = pct >= 90 ? "text-green-700" : pct >= 60 ? "text-yellow-700" : "text-red-700";
              return (
                <Card key={a.sucursalId} className="border-0 shadow-sm bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold truncate">{a.nombre}</p>
                      <span className={`text-sm font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>${a.ventasMes.toLocaleString('es-MX', { minimumFractionDigits: 0 })} vendido</span>
                      <span>Meta: ${a.meta.toLocaleString('es-MX', { minimumFractionDigits: 0 })}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* === PILAR 3: Resumen de Ventas (solo si hay datos) === */}
      {isManager && resumenVentas && resumenVentas.reportesEnviados > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Resumen de Ventas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 días · {resumenVentas.reportesEnviados} reportes enviados</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setLocation("/reporte-diario")}>
              Ver reportes <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ventas Totales</p>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  ${resumenVentas.totalVentas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">MXN acumulado</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Transacciones</p>
                </div>
                <p className="text-2xl font-bold text-blue-700">{resumenVentas.totalTx.toLocaleString('es-MX')}</p>
                <p className="text-xs text-muted-foreground mt-1">ventas registradas</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket Promedio</p>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  ${resumenVentas.avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">por transacción</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* === PILAR 4: Accesos Rápidos + Últimas Evaluaciones === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas evaluaciones */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Últimas Evaluaciones SECOF</CardTitle>
              {isLeader && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/historial")} className="text-xs text-muted-foreground gap-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {evaluacionesCompletadas.length === 0 ? (
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
                {evaluacionesCompletadas.slice(0, 6).map(ev => {
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
                        <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
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

        {/* Panel lateral: accesos rápidos */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Accesos Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
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
                  onClick={() => setLocation("/reporte-diario")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                    <FileText className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Reporte Diario</p>
                    <p className="text-xs text-muted-foreground">Registrar ventas del día</p>
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
                    <p className="text-sm font-medium text-foreground">Historial SECOF</p>
                    <p className="text-xs text-muted-foreground">Ver evaluaciones pasadas</p>
                  </div>
                </button>
              )}
              {isLeader && (
                <button
                  onClick={() => setLocation("/plan-accion")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 group-hover:bg-orange-200 transition-colors">
                    <Target className="h-4 w-4 text-orange-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Plan de Acción</p>
                    <p className="text-xs text-muted-foreground">Seguimiento de mejoras</p>
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
              {isManager && (
                <button
                  onClick={() => setLocation("/sucursales")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-cyan-50 transition-colors text-left group"
                >
                  <div className="h-8 w-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0 group-hover:bg-cyan-200 transition-colors">
                    <Store className="h-4 w-4 text-cyan-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Gestión de Tiendas</p>
                    <p className="text-xs text-muted-foreground">Sucursales y detalle</p>
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
                    <p className="text-sm font-medium text-foreground">Colaboradores</p>
                    <p className="text-xs text-muted-foreground">Usuarios y roles</p>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>

          {/* Mini escala SECOF */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
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
