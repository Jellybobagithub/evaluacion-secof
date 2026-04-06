import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, ClipboardList, AlertTriangle, CheckCircle2, Activity,
  ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, Users, ChevronRight,
  DollarSign, FileText, BarChart3, Target, Store, UserCheck, ClipboardCheck,
  TrendingDown, Calendar, PlusCircle, Eye,
} from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";
import { hasRoleAccess } from "@/components/RoleGuard";
import { toast } from "sonner";
import { useMemo } from "react";

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

  // Redirigir al Anfitrión directamente a Mi Turno
  if (role === "host") {
    setLocation("/mi-turno");
    return null;
  }

  const isAdmin = hasRoleAccess(role, "admin");
  const isManager = hasRoleAccess(role, "manager");
  const isLeader = hasRoleAccess(role, "leader");

  const resumenSemanalMutation = trpc.reportesDiarios.enviarResumenSemanal.useMutation({
    onSuccess: () => toast.success("Resumen semanal enviado a tus notificaciones"),
    onError: () => toast.error("Error al enviar el resumen"),
  });

  // ─── Datos de todos los módulos ───────────────────────────────────────────
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});
  const { data: resumenVentas } = trpc.reportesDiarios.resumen.useQuery(
    { dias: 7 },
    { enabled: isManager }
  );
  const { data: avanceMeta = [] } = trpc.reportesDiarios.avanceMeta.useQuery(
    undefined,
    { enabled: isManager }
  );
  const { data: sinReporte = [] } = trpc.reportesDiarios.sinReporte.useQuery(
    { dias: 2 },
    { enabled: isManager }
  );
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: 0, soloActivos: true },
    { enabled: false } // desactivado — usamos conteo global por sucursal
  );
  // Observaciones activas en todas las sucursales (solo leader+)
  const { data: observacionesActivas = [] } = trpc.observacion.listarTodasSucursales.useQuery(
    undefined,
    { enabled: isLeader }
  );

  // KPI Nivel 2 — mermas y cumplimiento de reportes (solo manager+)
  const hoy = useMemo(() => new Date(), []);
  const mesActual = useMemo(() => ({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }), [hoy]);
  // Mermas y reportes se consultan por sucursal — usamos la primera sucursal activa como referencia global
  // Los valores globales se calculan en el scheduler; aquí mostramos indicadores del mes
  // (los endpoints requieren sucursalId, así que los desactivamos en el dashboard global)
  // En su lugar, derivamos de resumenVentas y sinReporte que ya están disponibles
  const kpiMermas = null; // Placeholder — ver KPI Líder para detalle por sucursal
  const kpiReportes = null; // Placeholder — ver KPI Líder para detalle por sucursal

  // ─── Cálculos derivados ───────────────────────────────────────────────────
  const evaluacionesCompletadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");

  const promedioGeneral = evaluacionesCompletadas.length > 0
    ? evaluacionesCompletadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / evaluacionesCompletadas.length
    : 0;

  const calificacionPromedio = getCalificacion(promedioGeneral);
  const accionInmediata = evaluacionesCompletadas.filter(e => (e.porcentajeGeneral ?? 0) < 70).length;

  const sucursalesConEstado = useMemo(() => sucursales.map(s => {
    const evsS = evaluacionesCompletadas
      .filter(e => e.sucursalId === s.id)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const ultima = evsS[0] ?? null;
    const penultima = evsS[1] ?? null;
    const pct = ultima ? (ultima.porcentajeGeneral ?? 0) : null;
    const pctAnterior = penultima ? (penultima.porcentajeGeneral ?? 0) : null;
    const tendencia = pct !== null && pctAnterior !== null ? pct - pctAnterior : null;
    const ventasSemana = resumenVentas?.reportesPorSucursal?.[s.id]?.ventas ?? null;
    const avance = avanceMeta.find(a => a.sucursalId === s.id);
    return { ...s, ultima, pct, tendencia, semaforo: getSemaforo(pct), ventasSemana, avance };
  }), [sucursales, evaluacionesCompletadas, resumenVentas, avanceMeta]);

  const conteoSemaforo = useMemo(() => ({
    critico: sucursalesConEstado.filter(s => s.pct !== null && s.pct < 70).length,
    atencion: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 70 && s.pct < 85).length,
    bien: sucursalesConEstado.filter(s => s.pct !== null && s.pct >= 85).length,
    sinEval: sucursalesConEstado.filter(s => s.pct === null).length,
  }), [sucursalesConEstado]);

  // Mermas globales — derivadas del resumen de ventas (7 días)
  const mermasPct = null; // Detalle disponible en KPI Líder por sucursal

  // Cuadres de inventario recientes (descuadres de vasos)
  const { data: cuadresRecientes = [] } = trpc.turno.getCuadresRecientes.useQuery(
    { dias: 7 },
    { enabled: isManager }
  );
  const totalMermaVasos = useMemo(() => {
    return (cuadresRecientes as any[]).reduce((sum: number, c: any) => sum + (c.mermaVasos ?? 0), 0);
  }, [cuadresRecientes]);
  const cuadresConDescuadre = useMemo(() => {
    return (cuadresRecientes as any[]).filter((c: any) => (c.mermaVasos ?? 0) > 0);
  }, [cuadresRecientes]);
  const reportesCumplimiento = useMemo(() => {
    if (!resumenVentas || !sucursales.length) return null;
    // Aproximación: tiendas sin reporte / total tiendas activas
    const activas = sucursales.filter((s: any) => s.activa).length;
    if (activas === 0) return null;
    const sinRep = (sinReporte as any[]).length;
    return Math.round(((activas - sinRep) / activas) * 100);
  }, [resumenVentas, sucursales, sinReporte]);

  const nombre = user?.name?.split(" ")[0] ?? "usuario";

  return (
    <div className="space-y-6 p-1">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAdmin ? "Dashboard Ejecutivo" : isManager ? "Panel de Tiendas" : isLeader ? "Mi Panel Operativo" : "Mi Panel"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {role === "superadmin" && `Hola ${nombre} — Vista completa del sistema`}
            {role === "owner" && `Bienvenido, ${nombre} — Resumen ejecutivo de tus tiendas`}
            {role === "manager" && `Hola ${nombre} — Estado operativo de tu tienda`}
            {role === "leader" && `Hola ${nombre} — Tus evaluaciones y reportes del día`}
            {role === "host" && `Hola ${nombre} — Bienvenido al sistema`}
            {!(["superadmin","owner","manager","leader","host"].includes(role)) && `Bienvenido, ${nombre}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isManager && (
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => resumenSemanalMutation.mutate()}
              disabled={resumenSemanalMutation.isPending}
            >
              <FileText className="h-3.5 w-3.5" />
              {resumenSemanalMutation.isPending ? "Enviando..." : "Resumen Semanal"}
            </Button>
          )}
          {isLeader && (
            <Button onClick={() => setLocation("/evaluacion/nueva")} className="gap-2 bg-green-600 hover:bg-green-700">
              <PlusCircle className="h-4 w-4" /> Nueva Evaluación
            </Button>
          )}
        </div>
      </div>

      {/* ── FILA 1: KPIs Globales ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tiendas */}
        {isManager && (
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/sucursales")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tiendas</p>
                  <p className="text-3xl font-bold mt-1">{sucursales.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sucursales.filter((s: any) => s.activa).length} activas</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Store className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Promedio SECOF */}
        <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/secof-dashboard")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Promedio SECOF</p>
                <p className="text-3xl font-bold mt-1">{promedioGeneral.toFixed(1)}%</p>
                <p className="text-xs mt-1 font-medium" style={{ color: calificacionPromedio.color }}>
                  {calificacionPromedio.label}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ventas 7 días */}
        {isManager && resumenVentas && resumenVentas.reportesEnviados > 0 ? (
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/ventas")}>
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
        )}

        {/* Alerta crítica: tiendas en acción inmediata o sin reporte */}
        <Card className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${(accionInmediata > 0 || sinReporte.length > 0) ? "bg-red-50" : "bg-white"}`}
          onClick={() => setLocation(accionInmediata > 0 ? "/secof-dashboard" : "/reporte-diario")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alertas</p>
                <p className={`text-3xl font-bold mt-1 ${(accionInmediata + sinReporte.length) > 0 ? "text-red-600" : "text-green-600"}`}>
                  {accionInmediata + sinReporte.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accionInmediata > 0 ? `${accionInmediata} SECOF crítico` : sinReporte.length > 0 ? `${sinReporte.length} sin reporte` : "Todo en orden"}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${(accionInmediata + sinReporte.length) > 0 ? "bg-red-100" : "bg-green-50"}`}>
                {(accionInmediata + sinReporte.length) > 0
                  ? <AlertTriangle className="h-5 w-5 text-red-600" />
                  : <CheckCircle2 className="h-5 w-5 text-green-600" />
                }
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FILA 1.5: Alerta de merma de vasos (si hay descuadres recientes) —————— */}
      {isManager && cuadresConDescuadre.length > 0 && (
        <div
          className="rounded-xl border border-orange-200 bg-orange-50 p-4 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => setLocation("/kpi-lider")}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-800">⚠️ Merma de vasos detectada (7 días)</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  {totalMermaVasos} vasos de diferencia en {cuadresConDescuadre.length} cierre{cuadresConDescuadre.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-orange-700">{totalMermaVasos}</p>
              <p className="text-xs text-orange-500">vasos</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cuadresConDescuadre.slice(0, 3).map((c: any, i: number) => (
              <span key={i} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                {c.sucursalNombre ?? 'Sucursal'}: {c.mermaVasos} vasos • {new Date(c.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── FILA 2: KPIs Nivel 2 (mermas + cumplimiento reportes) ——————————— */}
      {isManager && (mermasPct !== null || reportesCumplimiento !== null) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Mermas del mes — acceso directo a KPI Líder */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/kpi-lider")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mermas del mes</p>
                  <p className="text-sm font-semibold mt-2 text-muted-foreground">Ver por tienda</p>
                  <p className="text-xs text-muted-foreground mt-1">Meta: &lt;3% de ventas</p>
                </div>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-orange-50">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cumplimiento de reportes */}
          {reportesCumplimiento !== null && (
            <Card className={`border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${reportesCumplimiento < 80 ? "bg-amber-50" : "bg-white"}`}
              onClick={() => setLocation("/kpi-lider")}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Reportes a tiempo</p>
                    <p className={`text-3xl font-bold mt-1 ${reportesCumplimiento >= 90 ? "text-green-600" : reportesCumplimiento >= 70 ? "text-amber-600" : "text-red-600"}`}>
                      {reportesCumplimiento.toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Meta: 100% del mes</p>
                  </div>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${reportesCumplimiento >= 90 ? "bg-green-50" : reportesCumplimiento >= 70 ? "bg-amber-50" : "bg-red-100"}`}>
                    <FileText className={`h-5 w-5 ${reportesCumplimiento >= 90 ? "text-green-600" : reportesCumplimiento >= 70 ? "text-amber-600" : "text-red-600"}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rappi + Tarjeta */}
          {resumenVentas && resumenVentas.reportesEnviados > 0 && (
            <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/ventas")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Rappi 7 días</p>
                    <p className="text-2xl font-bold mt-1 text-purple-700">
                      ${(resumenVentas.totalRappi ?? 0) >= 1000
                        ? ((resumenVentas.totalRappi ?? 0) / 1000).toFixed(1) + 'k'
                        : (resumenVentas.totalRappi ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${(resumenVentas.totalTarjeta ?? 0) >= 1000
                        ? ((resumenVentas.totalTarjeta ?? 0) / 1000).toFixed(1) + 'k'
                        : (resumenVentas.totalTarjeta ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })} tarjeta
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-purple-50 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evaluaciones completadas */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/historial")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Evaluaciones</p>
                  <p className="text-3xl font-bold mt-1">{evaluacionesCompletadas.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accionInmediata > 0 ? <span className="text-red-600 font-medium">{accionInmediata} críticas</span> : "Sin críticas"}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}      {/* ── ALERTA: Actividades bajo observación ────────────────────────────────────────────── */}
      {isLeader && (observacionesActivas as any[]).length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">
                {(observacionesActivas as any[]).length} actividad{(observacionesActivas as any[]).length !== 1 ? "es" : ""} bajo observación
              </p>
              <p className="text-xs text-orange-700 mt-1">Requieren evidencia fotográfica diaria hasta ser resueltas</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-orange-700 hover:bg-orange-100 h-7" onClick={() => setLocation("/kpi-lider")}>
              Ver detalles
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(observacionesActivas as any[]).map((obs: any) => (
              <div key={obs.id} className="flex items-center gap-1.5 bg-orange-100 text-orange-800 rounded-lg px-3 py-1.5 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                <span className="font-bold">{obs.actividadClave}</span>
                {obs.sucursalNombre && <span className="text-orange-600">· {obs.sucursalNombre}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALERTA: Tiendas sin reporte ──────────────────────────────────────────────────────────────────── */}
      {isManager && sinReporte.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {sinReporte.length} tienda{sinReporte.length !== 1 ? "s" : ""} sin reporte en los últimos 2 días
              </p>
              <p className="text-xs text-amber-700 mt-1">Haz clic en una tienda para ir a reportes</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-amber-700 hover:bg-amber-100 h-7" onClick={() => setLocation("/reporte-diario")}>
              Ver reportes
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(sinReporte as any[]).map((s: any) => (
              <button
                key={s.id}
                onClick={() => setLocation(`/sucursales/${s.id}`)}
                className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Building2 className="h-3 w-3" />
                {s.nombre}
                {s.diasSinReporte != null && (
                  <span className="bg-amber-300 text-amber-900 rounded px-1 py-0.5 text-xs font-bold ml-1">
                    {s.diasSinReporte}d
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FILA 3: Estado de Tiendas (SECOF + Ventas + Meta) ─────────────── */}
      {isManager && sucursales.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Estado de Tiendas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">SECOF · Ventas · Avance vs meta</p>
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
                className="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md bg-white hover:border-gray-300"
                onClick={() => setLocation(`/sucursales/${s.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.semaforo.bg}`}>
                      <Building2 className={`h-5 w-5 ${s.semaforo.color}`} />
                    </div>
                    <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${s.semaforo.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.nombre}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.ciudad ?? "Sin ciudad"}</p>
                  </div>
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

                {/* Ventas + avance vs meta */}
                {(s.ventasSemana !== null && s.ventasSemana > 0) || s.avance ? (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {s.ventasSemana !== null && s.ventasSemana > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Ventas 7 días
                        </span>
                        <span className="font-semibold text-green-700">
                          ${s.ventasSemana.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {s.avance && s.avance.meta > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Meta del mes</span>
                          <span className={`font-semibold ${(s.avance.porcentaje ?? 0) >= 90 ? "text-green-700" : (s.avance.porcentaje ?? 0) >= 60 ? "text-amber-700" : "text-red-700"}`}>
                            {(s.avance.porcentaje ?? 0).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(s.avance.porcentaje ?? 0) >= 90 ? "bg-green-500" : (s.avance.porcentaje ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, s.avance.porcentaje ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FILA 4: Panel de módulos críticos (2 columnas) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas Evaluaciones SECOF */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                Últimas Evaluaciones SECOF
              </CardTitle>
              {isLeader && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/secof-dashboard")} className="text-xs text-muted-foreground gap-1">
                  Ver resumen <ChevronRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {evaluacionesCompletadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
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
                {evaluacionesCompletadas.slice(0, 5).map(ev => {
                  const sucursal = sucursales.find((s: any) => s.id === ev.sucursalId);
                  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
                  const sem = getSemaforo(ev.porcentajeGeneral ?? 0);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/evaluacion/${ev.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${sem.bg}`}>
                          <Building2 className={`h-4 w-4 ${sem.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sucursal?.nombre ?? "Sucursal"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                            {ev.evaluadorNombre && ` · ${ev.evaluadorNombre}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
                        <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${ev.porcentajeGeneral ?? 0}%`, backgroundColor: calif.color }} />
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de módulos: Equipo + Checklist + Reportes */}
        <div className="space-y-4">
          {/* Equipo */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/empleados")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Equipo</p>
                  <p className="text-xs text-muted-foreground">Empleados · Horarios · Asistencia</p>
                </div>
                <div className="text-right shrink-0">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                    Ver <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horarios (reemplaza Checklist) */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/horarios")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Horarios y Actividades</p>
                  <p className="text-xs text-muted-foreground">Turnos · Limpieza · Checklist</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 shrink-0">
                  Ver <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/kpi-anfitriones")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">KPIs del Equipo</p>
                  <p className="text-xs text-muted-foreground">Servicio · Puntualidad · Caja</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 shrink-0">
                  Ver <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Plan de Acción */}
          <Card className="border-0 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/plan-accion")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Plan de Acción</p>
                  <p className="text-xs text-muted-foreground">Seguimiento de mejoras SECOF</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 shrink-0">
                  Ver <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── FILA 5: Avance vs Meta Mensual (solo si hay metas configuradas) ── */}
      {isManager && avanceMeta.length > 0 && avanceMeta.some((a: any) => a.meta > 0) && (
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
            {avanceMeta.filter((a: any) => a.meta > 0).map((a: any) => {
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
    </div>
  );
}
