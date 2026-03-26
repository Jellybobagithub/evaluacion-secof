import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  ClipboardCheck, ClipboardList, Users, TrendingUp,
  AlertTriangle, CheckCircle2, ChevronRight, Star,
  Calendar, Clock, FileText, BarChart2
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSemanaISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function horaActual() {
  return new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function fechaHoy() {
  return new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MiTurno() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [hora, setHora] = useState(horaActual);

  // Actualizar hora cada minuto
  useState(() => {
    const interval = setInterval(() => setHora(horaActual()), 60000);
    return () => clearInterval(interval);
  });

  const semana = getSemanaISO();
  const hoy = new Date().toISOString().slice(0, 10);

  // Obtener sucursales del usuario
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const sucursalId = sucursales[0]?.id ?? null;

  // Reporte diario de hoy
  const { data: reportesHoy = [] } = trpc.reportesDiarios.list.useQuery(
    { sucursalId: sucursalId ?? undefined, limit: 5 },
    { enabled: !!sucursalId }
  );
  const reporteHoy = useMemo(() => {
    return reportesHoy.find(r => new Date(r.fecha).toISOString().slice(0, 10) === hoy);
  }, [reportesHoy, hoy]);

  // Checklist de hoy
  // Checklist de hoy: usar fechaInicio y fechaFin del día de hoy
  const { data: registrosChecklist = [] } = trpc.checklist.list.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: hoy, fechaFin: hoy },
    { enabled: !!sucursalId }
  );

  // Asistencia de hoy: timestamp inicio y fin del día
  const hoyInicio = useMemo(() => new Date(hoy + 'T00:00:00').getTime(), [hoy]);
  const hoyFin = useMemo(() => new Date(hoy + 'T23:59:59').getTime(), [hoy]);
  const { data: asistenciaHoy = [] } = trpc.asistencia.listBySucursal.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: hoyInicio, fechaFin: hoyFin },
    { enabled: !!sucursalId }
  );

  // KPIs de la semana
  const { data: kpisSemanales = [] } = trpc.kpiAnfitriones.list.useQuery(
    { sucursalId: sucursalId ?? 0, semana },
    { enabled: !!sucursalId }
  );

  // Última evaluación SECOF
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery(
    { sucursalId: sucursalId ?? undefined },
    { enabled: !!sucursalId }
  );
  const ultimaEval = evaluaciones[0];

  // Empleados de la sucursal
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId }
  );

  // Calcular KPI de la semana
  const kpiSemana = useMemo(() => {
    if (kpisSemanales.length === 0) return null;
    const cumplidos = kpisSemanales.filter((k: any) => k.cumple).length;
    return Math.round(cumplidos / kpisSemanales.length * 100);
  }, [kpisSemanales]);

  // Asistencia: cuántos entraron hoy
  const entradas = asistenciaHoy.filter((a: any) => a.tipo === "entrada").length;

  // Checklist: cuántos completados
  const checklistCompletados = registrosChecklist.filter((r: any) => r.firmado).length;

  const sucursalNombre = sucursales[0]?.nombre ?? "Mi Tienda";

  const turnoActual = () => {
    const h = new Date().getHours();
    if (h >= 7 && h < 14) return "Matutino";
    if (h >= 14 && h < 21) return "Vespertino";
    return "Fuera de turno";
  };

  // Acciones rápidas
  const accionesRapidas = [
    {
      icon: FileText,
      label: reporteHoy ? "Ver reporte de hoy" : "Registrar reporte",
      sublabel: reporteHoy ? `Estado: ${reporteHoy.estado}` : "No registrado aún",
      color: reporteHoy?.estado === "enviado" ? "text-green-600" : "text-amber-600",
      bg: reporteHoy?.estado === "enviado" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
      path: "/reporte-diario",
      done: reporteHoy?.estado === "enviado",
    },
    {
      icon: ClipboardList,
      label: "Checklist del día",
      sublabel: checklistCompletados > 0 ? `${checklistCompletados} completados` : "Pendiente",
      color: checklistCompletados > 0 ? "text-green-600" : "text-blue-600",
      bg: checklistCompletados > 0 ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200",
      path: "/checklist",
      done: checklistCompletados > 0,
    },
    {
      icon: Users,
      label: "Asistencia",
      sublabel: entradas > 0 ? `${entradas} registros hoy` : "Sin registros",
      color: entradas > 0 ? "text-green-600" : "text-purple-600",
      bg: entradas > 0 ? "bg-green-50 border-green-200" : "bg-purple-50 border-purple-200",
      path: "/asistencia",
      done: entradas > 0,
    },
    {
      icon: ClipboardCheck,
      label: "Evaluación SECOF",
      sublabel: ultimaEval ? `Última: ${new Date(ultimaEval.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : "Sin evaluaciones",
      color: "text-teal-600",
      bg: "bg-teal-50 border-teal-200",
      path: "/evaluacion/nueva",
      done: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="px-4 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm capitalize">{fechaHoy()}</p>
            <h1 className="text-3xl font-bold mt-1">{hora}</h1>
            <p className="text-slate-300 text-sm mt-1">{sucursalNombre}</p>
          </div>
          <div className="text-right">
            <Badge className="bg-white/10 text-white border-white/20 text-xs">{turnoActual()}</Badge>
            <p className="text-slate-400 text-xs mt-2">Hola, {user?.name?.split(" ")[0] ?? "Líder"}</p>
          </div>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Asistencia",
              value: `${entradas}/${empleados.length}`,
              icon: Users,
              ok: entradas >= empleados.length * 0.8,
            },
            {
              label: "KPI semana",
              value: kpiSemana != null ? `${kpiSemana}%` : "—",
              icon: Star,
              ok: kpiSemana != null && kpiSemana >= 80,
            },
            {
              label: "SECOF",
              value: ultimaEval ? `${Math.round((ultimaEval as any).puntuacionTotal ?? 0)}%` : "—",
              icon: ClipboardCheck,
              ok: ultimaEval ? (ultimaEval as any).puntuacionTotal >= 80 : false,
            },
          ].map(k => (
            <div key={k.label} className="bg-white/10 rounded-2xl p-3 text-center backdrop-blur-sm">
              <k.icon className={`w-5 h-5 mx-auto mb-1 ${k.ok ? "text-green-400" : "text-amber-400"}`} />
              <p className="text-xl font-bold">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ventas de hoy */}
      {reporteHoy && (
        <div className="px-4 pb-4">
          <div className="bg-gradient-to-r from-emerald-600/30 to-teal-600/30 rounded-2xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-emerald-300">Ventas de hoy</span>
              <Badge className={`text-xs ${reporteHoy.estado === "enviado" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                {reporteHoy.estado === "enviado" ? "✓ Enviado" : "Borrador"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-300">
                  ${(reporteHoy.ventasTotales ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-400">Ventas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{reporteHoy.transacciones ?? 0}</p>
                <p className="text-xs text-slate-400">Transacc.</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  ${(reporteHoy.ticketPromedio ?? 0).toFixed(0)}
                </p>
                <p className="text-xs text-slate-400">Ticket</p>
              </div>
            </div>
            {/* Mermas */}
            {(reporteHoy as any).mermasMonto > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Mermas del día</span>
                <span className={`text-sm font-semibold ${
                  reporteHoy.ventasTotales && (reporteHoy as any).mermasMonto / reporteHoy.ventasTotales > 0.03
                    ? "text-red-400" : "text-green-400"
                }`}>
                  ${Number((reporteHoy as any).mermasMonto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  {reporteHoy.ventasTotales && ` (${((reporteHoy as any).mermasMonto / reporteHoy.ventasTotales * 100).toFixed(1)}%)`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Tareas del día</p>
        <div className="space-y-2">
          {accionesRapidas.map(accion => (
            <button
              key={accion.path}
              onClick={() => navigate(accion.path)}
              className="w-full flex items-center gap-4 bg-white/10 hover:bg-white/15 active:bg-white/20 rounded-2xl p-4 transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accion.done ? "bg-green-500/20" : "bg-white/10"}`}>
                {accion.done
                  ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                  : <accion.icon className="w-5 h-5 text-slate-300" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{accion.label}</p>
                <p className={`text-xs mt-0.5 ${accion.done ? "text-green-400" : "text-slate-400"}`}>{accion.sublabel}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Acceso a módulos */}
      <div className="px-4 pb-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Módulos</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: BarChart2, label: "KPIs Anfitriones", path: "/kpi-anfitriones", color: "from-yellow-600/30 to-orange-600/30" },
            { icon: Calendar, label: "Horarios", path: "/horarios", color: "from-indigo-600/30 to-blue-600/30" },
            { icon: Users, label: "Empleados", path: "/empleados", color: "from-purple-600/30 to-pink-600/30" },
            { icon: TrendingUp, label: "Historial SECOF", path: "/historial", color: "from-teal-600/30 to-cyan-600/30" },
          ].map(m => (
            <button
              key={m.path}
              onClick={() => navigate(m.path)}
              className={`bg-gradient-to-br ${m.color} rounded-2xl p-4 text-left border border-white/10 hover:border-white/20 transition-all`}
            >
              <m.icon className="w-6 h-6 text-white mb-2" />
              <p className="text-sm font-medium text-white">{m.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
