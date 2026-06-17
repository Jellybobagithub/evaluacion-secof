import { useState, useMemo, useCallback, useEffect } from "react";
import { KPI_TIPOS as TIPO_LABELS } from "@/lib/kpiTipos";
import { useSucursal } from "@/context/SucursalContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BarChart2, Plus, Star, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Clock, DollarSign, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Obtener semana ISO (ej: "2026-W13")
function getSemanaISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function semanaLabel(semana: string) {
  const [year, wStr] = semana.split("-W");
  const w = Number(wStr);
  // Calcular lunes de esa semana
  const jan4 = new Date(Number(year), 0, 4);
  const lunes = new Date(jan4.getTime() + (w - 1) * 7 * 86400000 - ((jan4.getDay() + 6) % 7) * 86400000);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  return `${lunes.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${domingo.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
}

function navSemana(semana: string, delta: number) {
  const [year, wStr] = semana.split("-W");
  const w = Number(wStr);
  const jan4 = new Date(Number(year), 0, 4);
  const lunes = new Date(jan4.getTime() + (w - 1) * 7 * 86400000 - ((jan4.getDay() + 6) % 7) * 86400000);
  lunes.setDate(lunes.getDate() + delta * 7);
  return getSemanaISO(lunes);
}

// Criterios de evaluación por tipo de KPI (basados en documentos Snowtea)
const CRITERIOS_SERVICIO = [
  { id: "saludo", label: "Saluda al cliente al entrar ('¡Bienvenido a Snowtea!')" },
  { id: "sonrisa", label: "Mantiene actitud positiva y sonrisa durante el servicio" },
  { id: "venta_sug", label: "Realiza venta sugestiva (ofrece topping, tamaño mayor, combo)" },
  { id: "despedida", label: "Se despide del cliente al salir" },
  { id: "uniforme", label: "Porta uniforme completo y limpio" },
];

const CRITERIOS_PREPARACION = [
  { id: "receta", label: "Sigue la receta estándar sin modificaciones" },
  { id: "temperatura", label: "Verifica temperatura de bebidas calientes/frías" },
  { id: "presentacion", label: "Presentación del producto cumple estándar visual" },
  { id: "tiempo", label: "Tiempo de preparación dentro del estándar (≤3 min)" },
  { id: "limpieza_barra", label: "Mantiene barra limpia durante la preparación" },
];

const CRITERIOS_CAJA = [
  { id: "cobro_correcto", label: "Cobra el monto correcto sin errores" },
  { id: "cambio", label: "Entrega cambio exacto y verifica con cliente" },
  { id: "ticket", label: "Entrega ticket al cliente" },
  { id: "descuadre", label: "Sin descuadres de caja al cierre (≤$20 tolerancia)" },
];

const TIPO_CONFIG: Record<string, { label: string; criterios: typeof CRITERIOS_SERVICIO; color: string; icon: string }> = {
  servicio: { label: "Calidad de Servicio", criterios: CRITERIOS_SERVICIO, color: "bg-blue-100 text-blue-800", icon: "⭐" },
  preparacion: { label: "Precisión en Preparación", criterios: CRITERIOS_PREPARACION, color: "bg-green-100 text-green-800", icon: "🧋" },
  caja: { label: "Manejo de Caja", criterios: CRITERIOS_CAJA, color: "bg-orange-100 text-orange-800", icon: "💰" },
};

// ─── Sub-componentes de tabs para evitar conflictos de variables en el bundle ──

function LimpiezaTabContent({ data, mes, onMesChange }: { data: any[]; mes: string; onMesChange: (m: string) => void }) {
  const [abierto, setAbierto] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Mes:</label>
        <input type="month" value={mes} onChange={e => onMesChange(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
      </div>
      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin turnos cerrados este mes</p>
          <p className="text-sm mt-1">Las actividades aparecen cuando se cierra el turno</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((emp: any) => {
            const open = abierto[emp.empleadoId] ?? false;
            const borderCls = emp.pct >= 90 ? 'border-green-200' : emp.pct >= 70 ? 'border-amber-200' : 'border-red-200';
            const textCls = emp.pct >= 90 ? 'text-green-600' : emp.pct >= 70 ? 'text-amber-600' : 'text-red-600';
            const bgCls = emp.pct >= 90 ? 'bg-green-50' : emp.pct >= 70 ? 'bg-amber-50' : 'bg-red-50';
            const barCls = emp.pct >= 90 ? 'bg-green-500' : emp.pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
            const incompletos = emp.dias.filter((d: any) => d.completadas < d.total);
            return (
              <Card key={emp.empleadoId} className={`border ${borderCls}`}>
                <button className="w-full text-left" onClick={() => setAbierto(p => ({ ...p, [emp.empleadoId]: !p[emp.empleadoId] }))}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${bgCls} ${textCls}`}>
                          {emp.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{emp.nombre}</p>
                          <p className="text-xs text-muted-foreground">{emp.diasCompletos}/{emp.diasCerrados} días completos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold px-2 py-0.5 rounded border ${bgCls} ${textCls}`}>{emp.pct}%</span>
                        {incompletos.length > 0 && (
                          <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">{incompletos.length} día{incompletos.length !== 1 ? 's' : ''} incompleto{incompletos.length !== 1 ? 's' : ''}</span>
                        )}
                        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barCls}`} style={{ width: `${emp.pct}%` }} />
                    </div>
                  </CardContent>
                </button>
                {open && (
                  <div className="border-t px-4 py-3 space-y-1.5">
                    {emp.dias.map((d: any) => {
                      const cumplido = d.completadas >= d.total;
                      return (
                        <div key={d.fecha} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${cumplido ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className="flex items-center gap-2">
                            {cumplido ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            <span className={cumplido ? 'text-green-700' : 'text-red-700'}>
                              {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <span className={`font-medium ${cumplido ? 'text-green-700' : 'text-red-700'}`}>{d.completadas}/{d.total} tareas</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultadosTabContent({ data, mes, onMesChange }: { data: any[]; mes: string; onMesChange: (m: string) => void }) {
  const [abiertoEmp, setAbiertoEmp] = useState<Record<number, boolean>>({});
  const [abiertoTipo, setAbiertoTipo] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Mes:</label>
        <input type="month" value={mes} onChange={e => onMesChange(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
      </div>
      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin evaluaciones este mes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((emp: any) => {
            const totalFallos = Object.values(emp.tipos).reduce((s: number, t: any) => s + t.fallos, 0) as number;
            const empOpen = abiertoEmp[emp.empleadoId] ?? false;
            const empBorderCls = totalFallos > 0 ? 'border-red-200' : 'border-green-200';
            return (
              <Card key={emp.empleadoId} className={`border ${empBorderCls}`}>
                <button className="w-full text-left" onClick={() => setAbiertoEmp(p => ({ ...p, [emp.empleadoId]: !p[emp.empleadoId] }))}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0">
                          {emp.nombre.charAt(0)}
                        </div>
                        <p className="font-medium text-sm">{emp.nombre}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {totalFallos > 0
                          ? <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">{totalFallos} fallo{totalFallos !== 1 ? 's' : ''}</span>
                          : <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">✓ Sin fallos</span>
                        }
                        {empOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {!empOpen && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(["servicio","preparacion","caja"] as const).map(tipo => {
                          const tipoData = emp.tipos[tipo];
                          if (!tipoData) return null;
                          const scoreCls = tipoData.score >= 85 ? 'text-green-700 bg-green-50 border-green-200' : tipoData.score >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
                          return <span key={tipo} className={`text-xs px-2 py-0.5 rounded border ${scoreCls}`}>{TIPO_LABELS[tipo].emoji} {tipoData.score.toFixed(0)}%</span>;
                        })}
                      </div>
                    )}
                  </CardContent>
                </button>
                {empOpen && (
                  <div className="border-t px-4 pb-4 pt-2 space-y-2">
                    {(["servicio","preparacion","caja"] as const).map(tipo => {
                      const tipoData = emp.tipos[tipo];
                      if (!tipoData) return null;
                      const cfg = TIPO_LABELS[tipo];
                      const tKey = `${emp.empleadoId}-${tipo}`;
                      const tipoOpen = abiertoTipo[tKey] ?? (tipoData.fallos > 0);
                      const conFallo = Object.entries(tipoData.criterios as Record<string, { fallos: number; total: number }>)
                        .filter(([, v]) => v.fallos > 0).sort(([, a], [, b]) => b.fallos - a.fallos);
                      const sinFallo = Object.entries(tipoData.criterios as Record<string, { fallos: number; total: number }>)
                        .filter(([, v]) => v.fallos === 0);
                      const tipoBorderCls = tipoData.fallos > 0 ? 'border-red-200' : 'border-green-200';
                      const tipoBgCls = tipoData.fallos > 0 ? 'bg-red-50' : 'bg-green-50';
                      const tipoScoreCls = tipoData.score >= 85 ? 'text-green-700' : tipoData.score >= 60 ? 'text-amber-700' : 'text-red-700';
                      return (
                        <div key={tipo} className={`rounded-lg border overflow-hidden ${tipoBorderCls}`}>
                          <button className={`w-full flex items-center justify-between px-3 py-2 ${tipoBgCls}`}
                            onClick={() => setAbiertoTipo(p => ({ ...p, [tKey]: !p[tKey] }))}>
                            <span className="text-sm font-medium">{cfg.emoji} {cfg.label}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${tipoScoreCls}`}>{tipoData.score.toFixed(0)}%</span>
                              <span className="text-xs text-muted-foreground">{tipoData.fallos}/{tipoData.total}</span>
                              {tipoOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                          </button>
                          {tipoOpen && (
                            <div className="px-3 py-2 bg-white space-y-1.5">
                              {conFallo.map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-xs">
                                  <span className="text-red-700">⚠ {cfg.criterios[k] ?? k}</span>
                                  <span className="font-medium text-red-600 shrink-0 ml-2">{v.fallos}/{v.total} ({Math.round(v.fallos/v.total*100)}%)</span>
                                </div>
                              ))}
                              {sinFallo.map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>✓ {cfg.criterios[k] ?? k}</span>
                                  <span>{v.total} eval.</span>
                                </div>
                              ))}
                              {tipoData.notasFallos?.length > 0 && (
                                <div className="pt-1 border-t space-y-1">
                                  {tipoData.notasFallos.map((n: string, i: number) => (
                                    <p key={i} className="text-xs text-muted-foreground italic">"{n}"</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KpiAnfitriones() {
  const { user } = useAuth();
  const { sucursalId } = useSucursal();
  const [semana, setSemana] = useState(() => getSemanaISO());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoObs, setTipoObs] = useState<"servicio" | "preparacion" | "caja">("servicio");
  const [empleadoSelId, setEmpleadoSelId] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState("");

  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const isHost = user?.role === "host";
  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId }
  );
  const { data: observaciones = [], refetch } = trpc.kpiAnfitriones.list.useQuery(
    { sucursalId: sucursalId ?? 0, semana },
    { enabled: !!sucursalId }
  );
  const utils = trpc.useUtils();

  // Incidencias de preparaciones por empleado (30 días)
  const { data: incidenciasPrep = [] } = trpc.preparaciones.incidenciasPorEmpleado.useQuery(
    { sucursalId: sucursalId ?? 0, dias: 30 },
    { enabled: !!sucursalId }
  );

  // KPI Puntualidad del mes
  const mesInicio = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m - 1, 1).getTime();
  }, [mes]);
  const mesFin = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m, 0, 23, 59, 59).getTime();
  }, [mes]);
  const mesInicioStr = useMemo(() => new Date(mesInicio).toISOString().slice(0, 10), [mesInicio]);
  const mesFinStr = useMemo(() => new Date(mesFin).toISOString().slice(0, 10), [mesFin]);

  const { data: puntualidad = [] } = trpc.kpiLider.puntualidad.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: mesInicio, fechaFin: mesFin },
    { enabled: !!sucursalId }
  );
  const { data: descuadres = [] } = trpc.kpiLider.descuadresCaja.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: mesInicioStr, fechaFin: mesFinStr },
    { enabled: !!sucursalId }
  );

  // Cumplimiento de limpieza diaria
  const { data: cumplimientoLimpieza = [] } = trpc.kpiAnfitriones.cumplimientoLimpieza.useQuery(
    { sucursalId: sucursalId ?? 0, mes },
    { enabled: !!sucursalId }
  );

  // Resultados mensuales por criterio (solo líderes)
  const { data: resultadosMes = [] } = trpc.reporteMensual.fallosPorEmpleado.useQuery(
    { sucursalId: sucursalId ?? 0, mes },
    { enabled: !!sucursalId && canEdit }
  );

  const registrarMut = trpc.kpiAnfitriones.registrar.useMutation({
    onSuccess: () => {
      utils.kpiAnfitriones.list.invalidate();
      toast.success("Observación registrada");
      setDialogOpen(false);
      setChecks({});
      setNotas("");
    },
    onError: (e) => toast.error(e.message),
  });

  // Para anfitriones: obtener su propio registro de empleado
  const { data: miEmpleado } = trpc.empleados.miEmpleado.useQuery(
    undefined,
    { enabled: isHost }
  );

  // Para anfitriones: cargar solo sus propias observaciones usando listByEmpleado
  const { data: misObservaciones = [] } = trpc.kpiAnfitriones.listByEmpleado.useQuery(
    { empleadoId: miEmpleado?.id ?? 0, semana },
    { enabled: isHost && !!miEmpleado?.id }
  );

  // Usar las observaciones correctas según el rol
  const obsActivas = isHost ? misObservaciones : observaciones;

  // Calcular resumen por empleado
  const resumenPorEmpleado = useMemo(() => {
    const mapa: Record<number, { nombre: string; total: number; cumple: number; tipos: Record<string, number> }> = {};
    for (const obs of obsActivas) {
      if (!mapa[obs.empleadoId]) {
        const emp = empleados.find(e => e.id === obs.empleadoId);
        mapa[obs.empleadoId] = { nombre: emp ? `${emp.nombre} ${emp.apellido ?? ""}`.trim() : `#${obs.empleadoId}`, total: 0, cumple: 0, tipos: {} };
      }
      mapa[obs.empleadoId].total++;
      if (obs.cumple) mapa[obs.empleadoId].cumple++;
      mapa[obs.empleadoId].tipos[obs.tipo] = (mapa[obs.empleadoId].tipos[obs.tipo] ?? 0) + 1;
    }
    return Object.entries(mapa).map(([id, v]) => ({ empleadoId: Number(id), ...v, pct: v.total > 0 ? Math.round(v.cumple / v.total * 100) : 0 }));
  }, [observaciones, empleados]);

  function abrirDialog(tipo: "servicio" | "preparacion" | "caja") {
    setTipoObs(tipo);
    setChecks({});
    setNotas("");
    setEmpleadoSelId("");
    setDialogOpen(true);
  }

  function handleRegistrar() {
    if (!empleadoSelId || !sucursalId) { toast.error("Selecciona un empleado"); return; }
    const criterios = TIPO_CONFIG[tipoObs].criterios;
    const cumple = criterios.every(c => checks[c.id]);
    registrarMut.mutate({
      empleadoId: Number(empleadoSelId),
      sucursalId,
      tipo: tipoObs,
      detalle: checks,
      cumple,
      semana,
      notas,
    });
  }

  const criteriosActuales = TIPO_CONFIG[tipoObs].criterios;
  const cumpleActual = criteriosActuales.every(c => checks[c.id]);
  const pctActual = criteriosActuales.length > 0 ? Math.round(Object.values(checks).filter(Boolean).length / criteriosActuales.length * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">KPIs Anfitriones</h1>
            <p className="text-sm text-muted-foreground">Nivel 1 — Calidad de servicio, preparación y caja</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Semana</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSemana(s => navSemana(s, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-36 text-center">{semanaLabel(semana)}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSemana(s => navSemana(s, 1))} disabled={semana >= getSemanaISO()}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!sucursalId && (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona una sucursal para ver los KPIs de anfitriones</p>
        </div>
      )}

      {/* Mensaje para anfitriones sin empleado vinculado */}
      {isHost && sucursalId && !miEmpleado && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <p className="font-medium">Tu perfil de empleado no está vinculado</p>
          <p className="text-sm mt-1">Pide a tu líder que vincule tu cuenta de usuario a tu registro de empleado para ver tus evaluaciones.</p>
        </div>
      )}

      {sucursalId && (!isHost || miEmpleado) && (
        <>
          <Tabs defaultValue="servicio">
            <TabsList className={`grid w-full max-w-2xl ${canEdit ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <TabsTrigger value="servicio">⭐ Servicio</TabsTrigger>
              <TabsTrigger value="puntualidad">🕐 Puntualidad</TabsTrigger>
              <TabsTrigger value="caja">💰 Caja</TabsTrigger>
              <TabsTrigger value="limpieza">🧹 Limpieza</TabsTrigger>
              {canEdit && <TabsTrigger value="resultados">📊 Resultados</TabsTrigger>}
            </TabsList>

          <TabsContent value="servicio" className="mt-4 space-y-4">
          {/* Botones de registro por tipo */}
          {canEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["servicio", "preparacion", "caja"] as const).map(tipo => (
                <button
                  key={tipo}
                  onClick={() => abrirDialog(tipo)}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-2xl">{TIPO_CONFIG[tipo].icon}</span>
                  <div>
                    <p className="font-medium text-sm">{TIPO_CONFIG[tipo].label}</p>
                    <p className="text-xs text-muted-foreground">+ Registrar observación</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Resumen por empleado */}
          {resumenPorEmpleado.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin observaciones esta semana</p>
              <p className="text-sm mt-1">Registra la primera observación usando los botones de arriba</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resumen de la semana — {resumenPorEmpleado.length} empleados evaluados
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resumenPorEmpleado.sort((a, b) => b.pct - a.pct).map(emp => (
                  <Card key={emp.empleadoId}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{emp.nombre}</p>
                          <p className="text-xs text-muted-foreground">{emp.total} observaciones · {emp.cumple} cumplidas</p>
                        </div>
                        <div className={`text-2xl font-bold ${emp.pct >= 80 ? "text-green-600" : emp.pct >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                          {emp.pct}%
                        </div>
                      </div>
                      {/* Barra */}
                      <div className="w-full bg-muted rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all ${emp.pct >= 80 ? "bg-green-500" : emp.pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${emp.pct}%` }}
                        />
                      </div>
                      {/* Tipos evaluados */}
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(emp.tipos).map(([tipo, count]) => (
                          <Badge key={tipo} className={`text-xs ${TIPO_CONFIG[tipo]?.color ?? ""}`} variant="outline">
                            {TIPO_CONFIG[tipo]?.icon} {TIPO_CONFIG[tipo]?.label} ({count})
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Detalle de observaciones */}
          {obsActivas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detalle de observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {obsActivas.map((obs, i) => {
                    const emp = empleados.find(e => e.id === obs.empleadoId);
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div className="flex items-center gap-3">
                          {obs.cumple ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{emp ? `${emp.nombre} ${emp.apellido ?? ""}`.trim() : `#${obs.empleadoId}`}</p>
                            {obs.notas && <p className="text-xs text-muted-foreground italic">{obs.notas}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${TIPO_CONFIG[obs.tipo]?.color ?? ""}`} variant="outline">
                            {TIPO_CONFIG[obs.tipo]?.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(obs.createdAt!).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Incidencias de Preparaciones por Empleado */}
          {incidenciasPrep.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="w-4 h-4" />
                  Incidencias de Preparaciones — últimos 30 días
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incidenciasPrep.map((inc: any) => {
                    const emp = empleados.find((e: any) => e.id === inc.empleadoId);
                    const nombre = emp ? `${emp.nombre} ${emp.apellido ?? ''}`.trim() : `Empleado #${inc.empleadoId}`;
                    return (
                      <div key={inc.empleadoId} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs shrink-0">
                            {nombre.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{nombre}</p>
                            <div className="flex gap-1.5 mt-0.5 flex-wrap">
                              {inc.sinPrep > 0 && <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">{inc.sinPrep} sin preparar</span>}
                              {inc.vencida > 0 && <span className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">{inc.vencida} vencida en uso</span>}
                              {inc.fueraTiempo > 0 && <span className="text-xs bg-orange-100 text-orange-700 rounded px-1.5 py-0.5">{inc.fueraTiempo} fuera de tiempo</span>}
                            </div>
                          </div>
                        </div>
                        <div className={`text-xl font-bold ${inc.total >= 5 ? 'text-red-600' : inc.total >= 2 ? 'text-amber-600' : 'text-orange-500'}`}>
                          {inc.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-orange-600 mt-3 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Rojo = 5+ incidencias (crítico) · Amarillo = 2-4 · Naranja = 1
                </p>
              </CardContent>
            </Card>
          )}
          </TabsContent>

          {/* Tab Puntualidad */}
          <TabsContent value="puntualidad" className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Mes:</label>
              <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
            </div>
            {puntualidad.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin registros de asistencia este mes</p>
                <p className="text-sm mt-1">Los registros aparecen cuando los empleados usan el QR de entrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(puntualidad as any[]).map(emp => (
                  <Card key={emp.empleadoId}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                          {emp.nombre.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{emp.nombre}</p>
                          <p className="text-xs text-muted-foreground">{emp.totalEntradas} entradas · {emp.tardias} tardías</p>
                        </div>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded border ${
                          emp.porcentajePuntualidad >= 90 ? 'bg-green-50 text-green-700 border-green-200' :
                          emp.porcentajePuntualidad >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>{emp.porcentajePuntualidad}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          emp.porcentajePuntualidad >= 90 ? 'bg-green-500' :
                          emp.porcentajePuntualidad >= 70 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${emp.porcentajePuntualidad}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Descuadres de Caja */}
          <TabsContent value="caja" className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Mes:</label>
              <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm" />
            </div>
            {descuadres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin descuadres de caja este mes</p>
                <p className="text-sm mt-1">Los descuadres aparecen cuando hay diferencia entre efectivo y ventas en el reporte diario</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(descuadres as any[]).map(d => (
                  <Card key={d.id} className={`border-l-4 ${Math.abs(d.diferenciaCaja) > 200 ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {new Date(d.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">Por: {d.usuarioNombre ?? '—'}</p>
                          {d.notasCaja && <p className="text-xs italic mt-1">"{d.notasCaja}"</p>}
                        </div>
                        <div className="text-right">
                          <span className={`text-base font-bold ${d.diferenciaCaja > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {d.diferenciaCaja > 0 ? '+' : ''}${Math.abs(d.diferenciaCaja).toFixed(2)}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">diferencia</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                        <span>Inicial: ${(d.efectivoInicial ?? 0).toFixed(2)}</span>
                        <span>Final: ${(d.efectivoFinal ?? 0).toFixed(2)}</span>
                        <span>Ventas: ${(d.ventasTotales ?? 0).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab Limpieza */}
          <TabsContent value="limpieza" className="mt-4">
            <LimpiezaTabContent data={cumplimientoLimpieza as any[]} mes={mes} onMesChange={setMes} />
          </TabsContent>

          {/* Tab Resultados — solo líderes */}
          {canEdit && (
          <TabsContent value="resultados" className="mt-4">
            <ResultadosTabContent data={resultadosMes as any[]} mes={mes} onMesChange={setMes} />
          </TabsContent>
          )}

          </Tabs>
        </>
      )}

      {/* Dialog de registro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {TIPO_CONFIG[tipoObs].icon} Observación — {TIPO_CONFIG[tipoObs].label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empleado observado</Label>
              <Select value={empleadoSelId} onValueChange={setEmpleadoSelId}>
                <SelectTrigger><SelectValue placeholder="Selecciona empleado..." /></SelectTrigger>
                <SelectContent position="item-aligned">
                  {empleados.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.nombre} {e.apellido ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Criterios de evaluación</Label>
              {criteriosActuales.map(c => (
                <div
                  key={c.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checks[c.id] ? "bg-green-50 border-green-200" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setChecks(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  <Checkbox
                    checked={!!checks[c.id]}
                    onCheckedChange={v => setChecks(prev => ({ ...prev, [c.id]: !!v }))}
                    className="mt-0.5"
                  />
                  <span className="text-sm">{c.label}</span>
                </div>
              ))}
            </div>

            {/* Resultado */}
            <div className={`flex items-center gap-2 p-3 rounded-lg ${cumpleActual ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {cumpleActual ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {pctActual}% — {cumpleActual ? "Cumple el estándar" : "No cumple el estándar"}
              </span>
            </div>

            <div>
              <Label>Notas adicionales</Label>
              <Textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones específicas, contexto..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegistrar} disabled={registrarMut.isPending}>
              Guardar observación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
