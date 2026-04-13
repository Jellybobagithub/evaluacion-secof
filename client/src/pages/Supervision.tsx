import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, Users, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Helpers de semana ISO ────────────────────────────────────────────────────
function getSemanaISO(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { anio: d.getUTCFullYear(), semana: weekNum };
}

function getLunesDeSemana(anio: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  return new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000 + (semana - 1) * 7 * 86400000);
}

function navSemana(anio: number, semana: number, delta: number) {
  const lunes = getLunesDeSemana(anio, semana);
  lunes.setUTCDate(lunes.getUTCDate() + delta * 7);
  return getSemanaISO(lunes);
}

function semanaLabel(anio: number, semana: number) {
  const lunes = getLunesDeSemana(anio, semana);
  const dom = new Date(lunes.getTime() + 6 * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(lunes)} – ${fmt(dom)}`;
}

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TURNO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  matutino:   { label: "Matutino",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  intermedio: { label: "Intermedio", color: "text-teal-700",   bg: "bg-teal-50 border-teal-200" },
  vespertino: { label: "Vespertino", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  anfitrion:  { label: "Anfitrión",  color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
};

export default function Supervision() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [{ anio, semana }, setSemana] = useState(() => getSemanaISO());
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => getTodayISO());

  // Sucursales disponibles
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  // Auto-seleccionar primera sucursal
  useMemo(() => {
    if (!sucursalId && sucursales.length > 0) {
      setSucursalId((sucursales[0] as any).id);
    }
  }, [sucursales, sucursalId]);

  // Datos de la semana
  const { data: semanaData, refetch } = trpc.horarios.getSemana.useQuery(
    { sucursalId: sucursalId ?? 0, anio, semana },
    { enabled: !!sucursalId, staleTime: 30_000 }
  );

  const utils = trpc.useUtils();
  const toggleAct = trpc.horarios.toggleActividad.useMutation({
    onSuccess: () => { refetch(); },
    onError: () => toast.error("Error al actualizar actividad"),
  });

  // Días de la semana
  const diasSemana = useMemo(() => {
    const lunes = getLunesDeSemana(anio, semana);
    return ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label, i) => {
      const d = new Date(lunes.getTime() + i * 86400000);
      const fecha = d.toISOString().slice(0, 10);
      return { fecha, label };
    });
  }, [anio, semana]);

  // Turnos del día seleccionado
  const turnosHoy = useMemo(() => {
    if (!semanaData) return [];
    return (semanaData.turnos as any[]).filter(t => t.fecha === diaSeleccionado);
  }, [semanaData, diaSeleccionado]);

  // Mapa empleados
  const empleadosMap = useMemo(() => {
    const m: Record<number, string> = {};
    (semanaData?.empleados ?? []).forEach((e: any) => { m[e.id] = `${e.nombre}${e.apellido ? " " + e.apellido : ""}`; });
    return m;
  }, [semanaData]);

  // Actividades por turno
  const actPorTurno = useMemo(() => {
    const m: Record<number, any[]> = {};
    (semanaData?.actividades ?? []).forEach((a: any) => {
      if (!m[a.turnoId]) m[a.turnoId] = [];
      m[a.turnoId].push(a);
    });
    return m;
  }, [semanaData]);

  const today = getTodayISO();

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Supervisión de Actividades</h1>
          <p className="text-sm text-muted-foreground">Marca las actividades completadas por cada empleado</p>
        </div>
      </div>

      {/* Selector de sucursal */}
      {sucursales.length > 1 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal</label>
          <select
            value={sucursalId ?? ""}
            onChange={e => setSucursalId(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
          >
            {sucursales.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navegación de semana */}
      <div className="flex items-center justify-between bg-white border rounded-lg px-4 py-2.5 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => setSemana(navSemana(anio, semana, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Semana {semana}</p>
          <p className="text-xs text-slate-500">{semanaLabel(anio, semana)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSemana(navSemana(anio, semana, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Selector de día */}
      <div className="grid grid-cols-7 gap-1">
        {diasSemana.map(({ fecha, label }) => {
          const turnosEnDia = (semanaData?.turnos as any[] ?? []).filter(t => t.fecha === fecha);
          const actsEnDia = turnosEnDia.flatMap(t => actPorTurno[t.id] ?? []);
          const completadas = actsEnDia.filter(a => a.completada).length;
          const total = actsEnDia.length;
          const isToday = fecha === today;
          const isSelected = fecha === diaSeleccionado;
          return (
            <button
              key={fecha}
              onClick={() => setDiaSeleccionado(fecha)}
              className={`rounded-xl p-2 text-center transition-all border ${
                isSelected
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : isToday
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
              }`}
            >
              <p className="text-[10px] font-medium">{label}</p>
              <p className={`text-base font-bold ${isSelected ? "text-white" : ""}`}>
                {new Date(fecha + "T12:00:00").getDate()}
              </p>
              {total > 0 && (
                <p className={`text-[9px] mt-0.5 ${isSelected ? "text-indigo-200" : completadas === total ? "text-green-600" : "text-amber-600"}`}>
                  {completadas}/{total}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Turnos del día */}
      <div className="space-y-4">
        {turnosHoy.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin turnos asignados para este día</p>
          </div>
        ) : (
          turnosHoy.map((turno: any) => {
            const tc = TURNO_CONFIG[turno.turno as string] ?? TURNO_CONFIG.intermedio;
            const acts: any[] = actPorTurno[turno.id] ?? [];
            const completadas = acts.filter(a => a.completada).length;
            const pendientes = acts.filter(a => a.esPendiente).length;
            const nombreEmp = empleadosMap[turno.empleadoId] ?? `Empleado #${turno.empleadoId}`;
            const progreso = acts.length > 0 ? Math.round((completadas / acts.length) * 100) : 0;

            return (
              <Card key={turno.id} className={`border-2 ${tc.bg}`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${tc.color} border-current`}>
                          {tc.label}
                        </Badge>
                        <span className="font-semibold text-slate-800">{nombreEmp}</span>
                        {turno.puesto && (
                          <span className="text-xs text-slate-500">· {turno.puesto}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {turno.horaInicio} – {turno.horaFin}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-700">{progreso}%</p>
                      <p className="text-xs text-slate-500">{completadas}/{acts.length} actividades</p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  {acts.length > 0 && (
                    <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progreso === 100 ? "bg-green-500" : "bg-indigo-500"}`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  )}
                </CardHeader>

                <CardContent className="px-4 pb-4">
                  {acts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">Sin actividades asignadas</p>
                  ) : (
                    <div className="space-y-2">
                      {pendientes > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{pendientes} actividad{pendientes > 1 ? "es" : ""} pendiente{pendientes > 1 ? "s" : ""} del turno anterior</span>
                        </div>
                      )}
                      {acts.map((act: any) => (
                        <button
                          key={act.id}
                          onClick={() => toggleAct.mutate({ turnoActividadId: act.id, completada: !act.completada })}
                          disabled={toggleAct.isPending}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                            act.completada
                              ? "bg-green-50 border-green-200"
                              : act.esPendiente
                              ? "bg-orange-50 border-orange-200"
                              : "bg-white border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {act.completada ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <Circle className={`w-5 h-5 shrink-0 ${act.esPendiente ? "text-orange-400" : "text-slate-300"}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {act.areaCompatible && act.areaCompatible !== 'todas' && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  act.areaCompatible === 'caja' ? 'bg-sky-100 text-sky-700' :
                                  act.areaCompatible === 'preparacion' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-violet-100 text-violet-700'
                                }`}>
                                  {act.areaCompatible === 'caja' ? 'Caja' : act.areaCompatible === 'preparacion' ? 'Prep.' : 'Comodín'}
                                </span>
                              )}
                              <span className={`text-sm ${act.completada ? "text-green-800 line-through" : "text-slate-700"}`}>
                                {act.descripcion ?? act.actividadClave}
                              </span>
                            </div>
                            {act.completada && act.completadaAt && (
                              <p className="text-[10px] text-green-600 mt-0.5">
                                ✓ {new Date(act.completadaAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
