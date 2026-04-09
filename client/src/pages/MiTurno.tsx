import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  ClipboardCheck, ClipboardList, Users, TrendingUp,
  AlertTriangle, CheckCircle2, ChevronRight, Star,
  Calendar, Clock, FileText, BarChart2, Sparkles, XCircle
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Preparaciones from "@/components/Preparaciones";
import ModalBienvenidaTurno from "@/components/ModalBienvenidaTurno";
import ModalCierreTurno from "@/components/ModalCierreTurno";

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
  // Bug fix: toISOString() usa UTC y puede dar el día incorrecto en México (UTC-6).
  // Por ejemplo, a las 7pm del domingo en México, UTC ya es lunes.
  // Usar getFullYear/getMonth/getDate para obtener la fecha local del dispositivo.
  const hoy = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

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

  // Turno del día asignado al empleado logueado
  // Buscar el empleado que corresponde al usuario actual
  const empleadoActual = useMemo(() => {
    if (!user) return null;
    // Buscar por nombre (aproximado) o el primero si solo hay uno
    return empleados.find((e: any) =>
      e.nombre?.toLowerCase().includes(user.name?.split(' ')[0]?.toLowerCase() ?? '') ||
      empleados.length === 1
    ) ?? empleados[0] ?? null;
  }, [empleados, user]);

  const { data: miTurnoData, refetch: refetchTurno } = trpc.horarios.miTurnoHoy.useQuery(
    { sucursalId: sucursalId ?? 0, empleadoId: empleadoActual?.id ?? 0, fecha: hoy },
    { enabled: !!sucursalId && !!empleadoActual?.id }
  );

  const toggleActividad = trpc.horarios.toggleActividad.useMutation({
    onSuccess: () => refetchTurno(),
    onError: (e) => console.error(e.message),
  });

  // Estado para expandir descripción de actividad y subir evidencia
  const [actividadExpandida, setActividadExpandida] = useState<number | null>(null);
  const [subiendoEvidencia, setSubiendoEvidencia] = useState<number | null>(null);

  // Estados para modales de bienvenida y cierre de turno
  const [mostrarModalBienvenida, setMostrarModalBienvenida] = useState(false);
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [tipoTurnoSeleccionado, setTipoTurnoSeleccionado] = useState<"matutino" | "vespertino">("matutino");
  const [mostrarSeleccionTurno, setMostrarSeleccionTurno] = useState(false);

  // Datos de apertura del turno actual (para cuadre al cierre)
  const { data: aperturaHoy } = trpc.turno.getAperturaHoy.useQuery(
    { sucursalId: sucursalId ?? 0, fecha: hoy },
    { enabled: !!sucursalId }
  );

  // Registrar asistencia (se hace via el flujo del modal de bienvenida)

  function handleRegistrarEntrada() {
    const h = new Date().getHours();
    if (h >= 14) {
      // Después de las 2pm: preguntar si es turno vespertino
      setMostrarSeleccionTurno(true);
    } else {
      setTipoTurnoSeleccionado("matutino");
      setMostrarModalBienvenida(true);
    }
  }

  const subirEvidencia = trpc.horarios.subirEvidencia.useMutation({
    onSuccess: () => { refetchTurno(); setSubiendoEvidencia(null); },
    onError: (e) => { alert('Error al subir foto: ' + e.message); setSubiendoEvidencia(null); },
  });

  const subirFotoMutation = trpc.horarios.subirEvidenciaBase64.useMutation({
    onSuccess: () => { refetchTurno(); setSubiendoEvidencia(null); },
    onError: (err: any) => { alert('Error al subir foto: ' + err.message); setSubiendoEvidencia(null); },
  });

  async function handleFotoEvidencia(turnoActividadId: number) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('La foto no puede superar 5 MB'); return; }
      setSubiendoEvidencia(turnoActividadId);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        subirFotoMutation.mutate({ dataUrl, mimeType: file.type, turnoActividadId: turnoActividadId });
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  }

  const cerrarTurno = trpc.horarios.cerrarTurno.useMutation({
    onSuccess: (data) => {
      refetchTurno();
      if (data.pendientesArrastradas > 0) {
        alert(`Turno cerrado. ${data.pendientesArrastradas} actividad(es) pendiente(s) se asignaron a tu próximo turno.`);
      }
    },
    onError: (e) => alert('Error al cerrar turno: ' + e.message),
  });

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

  // KPI Nivel 2: cumplimiento de reportes del mes
  // Mes local (evitar desfase UTC)
  const mes = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const mesInicio = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }, [mes]);
  const mesFin = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m, 0).toISOString().slice(0, 10);
  }, [mes]);
  const { data: cumplimientoMes } = trpc.kpiLider.cumplimientoReportes.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: mesInicio, fechaFin: mesFin },
    { enabled: !!sucursalId }
  );
  const { data: mermasMes } = trpc.kpiLider.mermas.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: mesInicio, fechaFin: mesFin },
    { enabled: !!sucursalId }
  );

  // Acciones rápidas — filtradas por rol
  const isLeaderPlus = ['leader', 'manager', 'owner', 'superadmin'].includes(user?.role ?? '');
  const accionesRapidasTodas = [
    {
      icon: FileText,
      label: reporteHoy ? "Ver reporte de hoy" : "Registrar reporte",
      sublabel: reporteHoy ? `Estado: ${reporteHoy.estado}` : "No registrado aún",
      color: reporteHoy?.estado === "enviado" ? "text-green-600" : "text-amber-600",
      bg: reporteHoy?.estado === "enviado" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
      path: "/reporte-diario",
      done: reporteHoy?.estado === "enviado",
      minRole: 'leader',
    },
    {
      icon: ClipboardList,
      label: "Horarios y Actividades",
      sublabel: "Ver turno y checklist del día",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200",
      path: "/horarios",
      done: false,
      minRole: 'leader',
    },

    {
      icon: ClipboardCheck,
      label: "Evaluación SECOF",
      sublabel: ultimaEval ? `Última: ${new Date(ultimaEval.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : "Sin evaluaciones",
      color: "text-teal-600",
      bg: "bg-teal-50 border-teal-200",
      path: "/evaluacion/nueva",
      done: false,
      minRole: 'leader',
    },
    {
      icon: BarChart2,
      label: "Mis KPIs",
      sublabel: kpiSemana != null ? `Esta semana: ${kpiSemana}%` : "Ver mis evaluaciones",
      color: "text-yellow-600",
      bg: "bg-yellow-50 border-yellow-200",
      path: "/kpi-anfitriones",
      done: false,
      minRole: 'host',
    },
  ];
  const roleLevelMap: Record<string, number> = { host: 2, leader: 3, manager: 5, owner: 5, superadmin: 6 };
  const userRoleLevel = roleLevelMap[user?.role ?? ''] ?? 0;
  const accionesRapidas = accionesRapidasTodas.filter(a => userRoleLevel >= (roleLevelMap[a.minRole] ?? 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Modales */}
      {mostrarSeleccionTurno && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center px-5">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">⏰</div>
            <h2 className="text-2xl font-bold text-white mb-2">¿Qué turno estás abriendo?</h2>
            <p className="text-slate-400 text-sm">Son más de las 2pm. Selecciona el turno.</p>
          </div>
          <div className="w-full space-y-3">
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white h-14 text-base font-semibold"
              onClick={() => { setTipoTurnoSeleccionado("vespertino"); setMostrarSeleccionTurno(false); setTimeout(() => setMostrarModalBienvenida(true), 80); }}
            >
              🌆 Turno Vespertino
            </Button>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-base font-semibold"
              onClick={() => { setTipoTurnoSeleccionado("matutino"); setMostrarSeleccionTurno(false); setTimeout(() => setMostrarModalBienvenida(true), 80); }}
            >
              🌅 Turno Matutino (continuación)
            </Button>
            <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setMostrarSeleccionTurno(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {mostrarModalBienvenida && sucursalId && empleadoActual && (
        <ModalBienvenidaTurno
          sucursalId={sucursalId}
          empleadoId={empleadoActual.id}
          fecha={hoy}
          tipoTurno={tipoTurnoSeleccionado}
          nombreEmpleado={user?.name ?? "Colaborador"}
          sucursalNombre={sucursalNombre}
          actividades={(miTurnoData?.actividades ?? []).map((a: any) => ({ id: a.id, nombre: a.descripcion ?? a.actividadClave ?? 'Actividad', descripcion: a.descripcion, categoria: a.categoria, clave: a.actividadClave }))}
          esApertura={entradas === 0}
          onComplete={() => { setMostrarModalBienvenida(false); refetchTurno(); }}
          onCancel={() => setMostrarModalBienvenida(false)}
        />
      )}

      {mostrarModalCierre && sucursalId && empleadoActual && (
        <ModalCierreTurno
          sucursalId={sucursalId}
          empleadoId={empleadoActual.id}
          fecha={hoy}
          tipoTurno={tipoTurnoSeleccionado}
          contadorApertura={(aperturaHoy as any)?.contadorSelladora ?? null}
          vasosVendidosReporte={(reporteHoy as any)?.totalVasos ?? null}
          onComplete={() => { setMostrarModalCierre(false); refetchTurno(); }}
          onCancel={() => setMostrarModalCierre(false)}
        />
      )}

      {/* Header */}
      <div className="px-4 pt-8 pb-4">
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

        {/* Botón Registrar Entrada */}
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white h-12 font-semibold"
            onClick={handleRegistrarEntrada}
          >
            ✅ Registrar entrada
          </Button>
          {(aperturaHoy || (miTurnoData?.turno && !miTurnoData.turno.cerrado)) && (
            <Button
              variant="outline"
              className="h-12 px-4 border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
              onClick={() => setMostrarModalCierre(true)}
            >
              🔒 Cerrar turno
            </Button>
          )}
        </div>

        {/* Novedades del turno anterior */}
        {(aperturaHoy as any)?.novedadesTurnoAnterior && (
          <div className="mt-3 bg-amber-500/15 border border-amber-500/30 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-300 mb-1">📝 Novedades del turno anterior</p>
            <p className="text-xs text-slate-300 leading-relaxed">{(aperturaHoy as any).novedadesTurnoAnterior}</p>
          </div>
        )}
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
                <p className="text-2xl font-bold text-white">${(reporteHoy.ventasTarjeta ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-slate-400">Tarjeta</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  ${(reporteHoy.ventasRappi ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-400">Rappi</p>
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

      {/* Turno asignado del día con checklist de actividades */}
      {miTurnoData && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Mi turno de hoy</p>
          <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
            {/* Info del turno */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-white capitalize">{miTurnoData.turno.turno}</span>
                  {miTurnoData.turno.cerrado && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Cerrado</Badge>
                  )}
                  {/* Badge de área */}
                  {miTurnoData.turno.rolPrincipal && (() => {
                    const area = (miTurnoData.turno.rolPrincipal as string).toLowerCase();
                    const areaConfig: Record<string, { label: string; cls: string }> = {
                      caja: { label: '💰 Caja', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                      barra: { label: '🥤 Barra', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                      bebidas: { label: '🥤 Barra', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
                      comodín: { label: '⚡ Comodín', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                      comodin: { label: '⚡ Comodín', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                      líder: { label: '👑 Líder', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
                      lider: { label: '👑 Líder', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
                    };
                    const cfg = areaConfig[area] ?? { label: miTurnoData.turno.rolPrincipal, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
                    return <Badge className={`text-xs border ${cfg.cls}`}>{cfg.label}</Badge>;
                  })()}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {miTurnoData.turno.horaInicio}–{miTurnoData.turno.horaFin}
                  {miTurnoData.turno.puesto && ` · ${miTurnoData.turno.puesto}`}
                </p>
                {/* Nota de hora pico */}
                {!miTurnoData.turno.cerrado && (
                  <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                    <span className="text-amber-400 text-xs mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-300 leading-relaxed">
                      <strong>Hora pico 5:00–7:00 pm</strong> — Actividades antes de las 5pm y después de las 7:30pm. Prioridad: atención al cliente.
                    </p>
                  </div>
                )}
              </div>
{!miTurnoData.turno.cerrado && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent text-xs"
                  onClick={() => setMostrarModalCierre(true)}
                >
                  🔒 Cerrar turno
                </Button>
              )}
            </div>

            {/* Checklist de actividades */}
            {miTurnoData.actividades.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {miTurnoData.actividades.filter((a: any) => a.completada).length}/{miTurnoData.actividades.length} completadas
                  </span>
                  <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-400 rounded-full transition-all"
                      style={{ width: `${(miTurnoData.actividades.filter((a: any) => a.completada).length / miTurnoData.actividades.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {miTurnoData.actividades.map((act: any) => {
                    const isExpanded = actividadExpandida === act.id;
                    const CATEGORIA_LABEL: Record<string, string> = {
                      D: 'Diaria', S: 'Semanal isla', B: 'Bodega', M: 'Mensual'
                    };
                    const catLabel = CATEGORIA_LABEL[act.categoria ?? 'D'] ?? act.categoria;
                    return (
                      <div
                        key={act.id}
                        className={`rounded-xl transition-all ${
                          act.completada ? 'bg-green-500/10' :
                          act.esPendiente ? 'bg-orange-500/10 border border-orange-500/20' :
                          'bg-white/5'
                        }`}
                      >
                        {/* Fila principal */}
                        <div className="flex items-center gap-3 p-2">
                          <Checkbox
                            checked={act.completada}
                            className="shrink-0 border-white/30"
                            onCheckedChange={() => {
                              if (!miTurnoData.turno.cerrado) {
                                toggleActividad.mutate({ turnoActividadId: act.id, completada: !act.completada });
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setActividadExpandida(isExpanded ? null : act.id)}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-bold font-mono ${
                                act.completada ? 'text-green-400 line-through' :
                                act.esPendiente ? 'text-orange-400' : 'text-teal-400'
                              }`}>{act.actividadClave}</span>
                              <span className={`text-xs truncate ${
                                act.completada ? 'text-slate-500 line-through' : 'text-slate-300'
                              }`}>{act.descripcion}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {act.esPendiente && (
                              <span className="text-[10px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full border border-orange-500/20">pendiente</span>
                            )}
                            <button
                              onClick={() => setActividadExpandida(isExpanded ? null : act.id)}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                              title="Ver descripción"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90' : ''
                              }`} />
                            </button>
                          </div>
                        </div>
                        {/* Descripción expandida */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0">
                            <div className={`rounded-lg p-3 ${
                              act.completada ? 'bg-green-500/10 border border-green-500/15' :
                              act.esPendiente ? 'bg-orange-500/10 border border-orange-500/20' :
                              'bg-white/5 border border-white/10'
                            }`}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  act.categoria === 'D' ? 'bg-blue-500/20 text-blue-300' :
                                  act.categoria === 'S' ? 'bg-purple-500/20 text-purple-300' :
                                  act.categoria === 'B' ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-rose-500/20 text-rose-300'
                                }`}>{catLabel}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{act.actividadClave}</span>
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed">{act.descripcion}</p>
                              {act.completadaAt && (
                                <p className="text-[10px] text-green-400 mt-2">
                                  ✓ Completada a las {new Date(act.completadaAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                              {/* Foto de evidencia (solo para S, B, M) */}
                              {['S', 'B', 'M'].includes(act.categoria) && !miTurnoData.turno.cerrado && (
                                <div className="mt-2.5 pt-2 border-t border-white/10">
                                  {act.evidenciaUrl ? (
                                    <div className="space-y-1.5">
                                      <img
                                        src={act.evidenciaUrl}
                                        alt="Evidencia"
                                        className="w-full max-h-32 object-cover rounded-lg border border-white/10"
                                      />
                                      <button
                                        onClick={() => handleFotoEvidencia(act.id)}
                                        disabled={subiendoEvidencia === act.id}
                                        className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                                      >
                                        {subiendoEvidencia === act.id ? 'Subiendo...' : 'Cambiar foto'}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleFotoEvidencia(act.id)}
                                      disabled={subiendoEvidencia === act.id}
                                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed text-xs transition-colors ${
                                        subiendoEvidencia === act.id
                                          ? 'border-white/20 text-slate-500 cursor-not-allowed'
                                          : 'border-teal-500/40 text-teal-400 hover:bg-teal-500/10'
                                      }`}
                                    >
                                      📷 {subiendoEvidencia === act.id ? 'Subiendo foto...' : 'Agregar foto de evidencia'}
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Ver evidencia si turno cerrado */}
                              {act.evidenciaUrl && miTurnoData.turno.cerrado && (
                                <div className="mt-2">
                                  <img
                                    src={act.evidenciaUrl}
                                    alt="Evidencia"
                                    className="w-full max-h-28 object-cover rounded-lg border border-white/10"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">Sin actividades asignadas para este turno</p>
            )}
          </div>
        </div>
      )}

      {/* Preparaciones del turno */}
      {sucursalId && (
        <div className="px-4 pb-4">
          <Preparaciones
            sucursalId={sucursalId}
            turnoId={miTurnoData?.turno?.id}
            empleadoId={empleadoActual?.id}
            modo="turno"
          />
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

      {/* KPIs del mes (Nivel 2) */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">KPIs del mes</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Cumplimiento de reportes */}
          <div className={`rounded-2xl p-3 border ${
            cumplimientoMes?.porcentaje != null
              ? cumplimientoMes.porcentaje >= 100 ? 'bg-green-500/15 border-green-500/30' :
                cumplimientoMes.porcentaje >= 70 ? 'bg-amber-500/15 border-amber-500/30' :
                'bg-red-500/15 border-red-500/30'
              : 'bg-white/10 border-white/10'
          }`}>
            <FileText className={`w-5 h-5 mb-1 ${
              cumplimientoMes?.porcentaje != null
                ? cumplimientoMes.porcentaje >= 100 ? 'text-green-400' :
                  cumplimientoMes.porcentaje >= 70 ? 'text-amber-400' : 'text-red-400'
                : 'text-slate-400'
            }`} />
            <p className="text-xl font-bold">
              {cumplimientoMes?.porcentaje != null ? `${cumplimientoMes.porcentaje}%` : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Reportes</p>
            {(cumplimientoMes?.diasSinReporte?.length ?? 0) > 0 && (
              <p className="text-xs text-red-400 mt-1">{cumplimientoMes?.diasSinReporte?.length ?? 0} días pendientes</p>
            )}
          </div>
          {/* Mermas del mes */}
          <div className={`rounded-2xl p-3 border ${
            mermasMes?.porcentaje != null
              ? mermasMes.porcentaje <= 3 ? 'bg-green-500/15 border-green-500/30' :
                mermasMes.porcentaje <= 5 ? 'bg-amber-500/15 border-amber-500/30' :
                'bg-red-500/15 border-red-500/30'
              : 'bg-white/10 border-white/10'
          }`}>
            <AlertTriangle className={`w-5 h-5 mb-1 ${
              mermasMes?.porcentaje != null
                ? mermasMes.porcentaje <= 3 ? 'text-green-400' :
                  mermasMes.porcentaje <= 5 ? 'text-amber-400' : 'text-red-400'
                : 'text-slate-400'
            }`} />
            <p className="text-xl font-bold">
              {mermasMes?.porcentaje != null ? `${mermasMes.porcentaje}%` : '—'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Mermas</p>
            <p className="text-xs text-slate-500 mt-0.5">Meta ≤3%</p>
          </div>
        </div>
      </div>

      {/* Acceso a módulos — filtrados por rol */}
      {(() => {
        const isLeaderPlus = ['leader', 'manager', 'owner', 'superadmin'].includes(user?.role ?? '');
        const modulos = [
          { icon: BarChart2, label: 'KPIs Anfitriones', path: '/kpi-anfitriones', color: 'from-yellow-600/30 to-orange-600/30', minRole: 'host' },
          { icon: TrendingUp, label: 'KPIs Líder', path: '/kpi-lider', color: 'from-teal-600/30 to-cyan-600/30', minRole: 'leader' },
          { icon: Calendar, label: 'Horarios', path: '/horarios', color: 'from-indigo-600/30 to-blue-600/30', minRole: 'leader' },
          { icon: Users, label: 'Empleados', path: '/empleados', color: 'from-purple-600/30 to-pink-600/30', minRole: 'leader' },
        ];
        const roleLevel: Record<string, number> = { host: 2, leader: 3, manager: 5, owner: 5, superadmin: 6 };
        const userLevel = roleLevel[user?.role ?? ''] ?? 0;
        const visibles = modulos.filter(m => userLevel >= (roleLevel[m.minRole] ?? 0));
        if (visibles.length === 0) return null;
        return (
          <div className="px-4 pb-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Módulos</p>
            <div className="grid grid-cols-2 gap-3">
              {visibles.map(m => (
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
        );
      })()}
    </div>
  );
}
