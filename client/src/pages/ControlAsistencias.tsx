import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Clock, UserCheck, UserX, AlertTriangle, Download, RefreshCw,
  ChevronDown, ChevronRight, Edit2, CheckCircle, Calendar,
  Camera, CameraOff, LogIn, LogOut, X
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekRange(offset = 0): { inicio: string; fin: string; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0=dom
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const label = `${mon.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} – ${sun.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`;
  return { inicio: fmt(mon), fin: fmt(sun), label };
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  presente:           { label: "Presente",    color: "bg-green-100 text-green-800",  icon: <CheckCircle className="w-3 h-3" /> },
  retardo:            { label: "Retardo",     color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="w-3 h-3" /> },
  ausente:            { label: "Ausente",     color: "bg-red-100 text-red-800",      icon: <UserX className="w-3 h-3" /> },
  ausencia_justificada: { label: "Justificada", color: "bg-blue-100 text-blue-800", icon: <UserCheck className="w-3 h-3" /> },
  descanso:           { label: "Descanso",    color: "bg-gray-100 text-gray-600",    icon: null },
  sin_horario:        { label: "Sin horario", color: "bg-gray-50 text-gray-400",     icon: null },
};

const TIPO_JUSTIFICACION_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  permiso_personal: "Permiso personal",
  emergencia_familiar: "Emergencia familiar",
  capacitacion: "Capacitación",
  vacaciones: "Vacaciones",
  error_sistema: "Error de sistema",
  otro: "Otro",
};

const DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function tsToHora(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Modal de Justificación ───────────────────────────────────────────────────

type RegistroRow = {
  id: number;
  fecha: string;
  estado: string;
  empleadoNombre: string;
  horasTrabajadas: number | null;
  minutosRetardo: number | null;
  timestampEntrada: number | null;
  timestampSalida: number | null;
  justificacion: string | null;
  tipoJustificacion: string | null;
  editadoManualmente: boolean;
};

function ModalJustificacion({
  registro,
  onClose,
  onSaved,
}: {
  registro: RegistroRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [estado, setEstado] = useState<"ausencia_justificada" | "presente" | "retardo">("ausencia_justificada");
  const [tipo, setTipo] = useState<string>("otro");
  const [justificacion, setJustificacion] = useState(registro.justificacion ?? "");
  const [horasTrabajadas, setHorasTrabajadas] = useState<string>(registro.horasTrabajadas?.toString() ?? "");
  const [minutosRetardo, setMinutosRetardo] = useState<string>(registro.minutosRetardo?.toString() ?? "0");

  const justificarMut = trpc.nomina.justificar.useMutation({
    onSuccess: () => {
      toast.success("Registro actualizado — La justificación fue guardada correctamente.");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!justificacion.trim() || justificacion.length < 5) {
      toast.error("Escribe al menos 5 caracteres en la justificación.");
      return;
    }
    justificarMut.mutate({
      id: registro.id,
      estado,
      justificacion,
      tipoJustificacion: tipo as any,
      horasTrabajadas: horasTrabajadas ? parseFloat(horasTrabajadas) : undefined,
      minutosRetardo: minutosRetardo ? parseInt(minutosRetardo) : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar registro — {registro.empleadoNombre}</DialogTitle>
          <p className="text-sm text-muted-foreground">{new Date(registro.fecha + "T12:00:00Z").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nuevo estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ausencia_justificada">Ausencia justificada</SelectItem>
                  <SelectItem value="presente">Presente</SelectItem>
                  <SelectItem value="retardo">Retardo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de justificación</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_JUSTIFICACION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {estado !== "ausencia_justificada" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Horas trabajadas</Label>
                <Input className="mt-1" type="number" step="0.5" min="0" max="24" value={horasTrabajadas} onChange={e => setHorasTrabajadas(e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <Label>Minutos de retardo</Label>
                <Input className="mt-1" type="number" min="0" max="480" value={minutosRetardo} onChange={e => setMinutosRetardo(e.target.value)} placeholder="0" />
              </div>
            </div>
          )}

          <div>
            <Label>Justificación <span className="text-red-500">*</span></Label>
            <Textarea className="mt-1" rows={3} value={justificacion} onChange={e => setJustificacion(e.target.value)} placeholder="Describe la razón de la ausencia o ajuste..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={justificarMut.isPending}>
            {justificarMut.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fila de Empleado (expandible) ───────────────────────────────────────────

function FilaEmpleado({
  resumen,
  fechas,
  canEdit,
  onEditRegistro,
}: {
  resumen: any;
  fechas: string[];
  canEdit: boolean;
  onEditRegistro: (r: RegistroRow) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  const registrosPorFecha = useMemo(() => {
    const m: Record<string, any> = {};
    for (const r of resumen.registros) m[r.fecha] = r;
    return m;
  }, [resumen.registros]);

  return (
    <>
      {/* Fila resumen */}
      <tr
        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpandido(!expandido)}
      >
        <td className="px-3 py-2 font-medium text-sm">
          <div className="flex items-center gap-1.5">
            {expandido ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <span>{resumen.empleadoNombre}</span>
            <span className="text-xs text-muted-foreground capitalize hidden sm:inline">({resumen.empleadoRol})</span>
          </div>
        </td>
        <td className="px-3 py-2 text-center text-sm font-semibold text-green-700">{resumen.diasTrabajados}</td>
        <td className="px-3 py-2 text-center text-sm text-red-600">{resumen.diasAusente}</td>
        <td className="px-3 py-2 text-center text-sm text-blue-600">{resumen.diasJustificados}</td>
        <td className="px-3 py-2 text-center text-sm text-yellow-700">{resumen.retardos}</td>
        <td className="px-3 py-2 text-center text-sm font-medium">{resumen.horasTotales.toFixed(1)}h</td>
        <td className="px-3 py-2 text-center text-sm text-muted-foreground">{resumen.minutosRetardoTotal}min</td>
        {/* Celdas por día */}
        {fechas.map(fecha => {
          const r = registrosPorFecha[fecha];
          if (!r) return <td key={fecha} className="px-1 py-2 text-center"><span className="text-xs text-gray-300">—</span></td>;
          const cfg = ESTADO_CONFIG[r.estado] ?? ESTADO_CONFIG.sin_horario;
          return (
            <td key={fecha} className="px-1 py-2 text-center">
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
                {cfg.icon}{cfg.label.slice(0, 3)}
              </span>
            </td>
          );
        })}
      </tr>
      {/* Detalle expandido */}
      {expandido && (
        <tr className="bg-muted/10">
          <td colSpan={7 + fechas.length} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {resumen.registros
                .filter((r: any) => !["descanso", "sin_horario"].includes(r.estado))
                .map((r: any) => {
                  const cfg = ESTADO_CONFIG[r.estado] ?? ESTADO_CONFIG.sin_horario;
                  return (
                    <div key={r.id} className="bg-background border rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {new Date(r.fecha + "T12:00:00Z").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                          {canEdit && (
                            <button
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => { e.stopPropagation(); onEditRegistro(r); }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Entrada: {tsToHora(r.timestampEntrada)} {r.horaEntradaEsperada ? `(esp. ${r.horaEntradaEsperada})` : ""}</div>
                        <div>Salida: {tsToHora(r.timestampSalida)} {r.horaSalidaEsperada ? `(esp. ${r.horaSalidaEsperada})` : ""}</div>
                        {r.horasTrabajadas != null && <div>Horas: <strong>{r.horasTrabajadas.toFixed(1)}h</strong></div>}
                        {r.minutosRetardo > 0 && <div className="text-yellow-700">Retardo: {r.minutosRetardo} min</div>}
                        {r.justificacion && (
                          <div className="mt-1 pt-1 border-t text-blue-700">
                            <span className="font-medium">{TIPO_JUSTIFICACION_LABELS[r.tipoJustificacion ?? "otro"]}: </span>
                            {r.justificacion}
                          </div>
                        )}
                        {r.editadoManualmente && <div className="text-xs text-purple-600 mt-0.5">✎ Editado manualmente</div>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

// ─── Pestaña Hoy ─────────────────────────────────────────────────────────────
function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const TURNO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  matutino:   { label: "Matutino",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  vespertino: { label: "Vespertino", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

function TabHoy({ sucursalId }: { sucursalId: number }) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const today = getTodayLocal();

  const aperturasQ = trpc.turno.getAperturasByFecha.useQuery(
    { sucursalId, fecha: today },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  // Turnos programados del día para saber quién debería haber entrado
  const { anio, semana } = useMemo(() => {
    const d = new Date();
    const jan4 = new Date(Date.UTC(d.getFullYear(), 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const lunes = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
    const diff = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - lunes.getTime()) / (7 * 86400000));
    const semanaNum = diff + 1;
    return { anio: d.getFullYear(), semana: semanaNum };
  }, []);

  const semanaQ = trpc.horarios.getSemana.useQuery(
    { sucursalId, anio, semana },
    { staleTime: 60_000 }
  );

  const aperturas: any[] = aperturasQ.data ?? [];
  const turnosHoy: any[] = useMemo(() => {
    if (!semanaQ.data) return [];
    return (semanaQ.data.turnos as any[]).filter(t => t.fecha === today);
  }, [semanaQ.data, today]);

  const empleadosMap = useMemo(() => {
    const m: Record<number, string> = {};
    (semanaQ.data?.empleados ?? []).forEach((e: any) => {
      m[e.id] = `${e.nombre}${e.apellido ? ' ' + e.apellido : ''}`;
    });
    return m;
  }, [semanaQ.data]);

  // Cruzar turnos programados con aperturas reales
  const statusTurnos = useMemo(() => {
    return turnosHoy.map(turno => {
      const apertura = aperturas.find(a => a.tipoTurno === turno.turno && a.empleadoId === turno.empleadoId);
      return {
        turno,
        empleadoNombre: empleadosMap[turno.empleadoId] ?? `#${turno.empleadoId}`,
        apertura: apertura ?? null,
        entro: !!apertura,
        tieneFoto: !!(apertura?.fotoUniformeUrl),
      };
    });
  }, [turnosHoy, aperturas, empleadosMap]);

  // Aperturas sin turno programado (registros manuales o extra)
  const aperturasExtra = useMemo(() => {
    const empIdsConTurno = new Set(turnosHoy.map(t => `${t.empleadoId}-${t.turno}`));
    return aperturas.filter(a => !empIdsConTurno.has(`${a.empleadoId}-${a.tipoTurno}`));
  }, [aperturas, turnosHoy]);

  const sinEntrada = statusTurnos.filter(s => !s.entro);
  const conEntrada = statusTurnos.filter(s => s.entro);
  const sinFoto = statusTurnos.filter(s => s.entro && !s.tieneFoto);

  if (aperturasQ.isLoading || semanaQ.isLoading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Cargando status del día...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Foto ampliada */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <div className="relative max-w-sm w-full">
            <button
              onClick={() => setFotoAmpliada(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg z-10"
            >
              <X className="w-4 h-4 text-gray-700" />
            </button>
            <img src={fotoAmpliada} alt="Foto uniforme" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* KPIs del día */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{conEntrada.length}</p>
          <p className="text-xs text-green-600 mt-0.5">Entraron</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{sinEntrada.length}</p>
          <p className="text-xs text-red-600 mt-0.5">Sin entrada</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{sinFoto.length}</p>
          <p className="text-xs text-amber-600 mt-0.5">Sin foto</p>
        </div>
      </div>

      {/* Alertas */}
      {sinEntrada.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <UserX className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">Sin entrada registrada</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sinEntrada.map(s => {
              const tc = TURNO_LABEL[s.turno.turno as string] ?? TURNO_LABEL.matutino;
              return (
                <span key={s.turno.id} className={`text-xs px-2 py-1 rounded-full border ${tc.bg} ${tc.color}`}>
                  {s.empleadoNombre} · {tc.label} {s.turno.horaInicio}–{s.turno.horaFin}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {sinFoto.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CameraOff className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Entraron sin foto de uniforme</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sinFoto.map(s => (
              <span key={s.turno.id} className="text-xs px-2 py-1 rounded-full border bg-amber-100 text-amber-800">
                {s.empleadoNombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Turnos con entrada */}
      {conEntrada.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <LogIn className="w-4 h-4 text-green-600" />
            Entradas registradas hoy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {conEntrada.map(s => {
              const tc = TURNO_LABEL[s.turno.turno as string] ?? TURNO_LABEL.matutino;
              const hora = s.apertura?.timestamp
                ? new Date(s.apertura.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                : "—";
              return (
                <div key={s.turno.id} className={`rounded-xl border p-3 ${tc.bg} flex items-center gap-3`}>
                  {/* Foto miniatura */}
                  {s.tieneFoto ? (
                    <button
                      onClick={() => setFotoAmpliada(s.apertura.fotoUniformeUrl)}
                      className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-sm hover:scale-105 transition-transform"
                    >
                      <img
                        src={s.apertura.fotoUniformeUrl}
                        alt="Uniforme"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="shrink-0 w-14 h-14 rounded-lg bg-white/50 border-2 border-dashed border-current/30 flex items-center justify-center">
                      <CameraOff className={`w-5 h-5 opacity-40 ${tc.color}`} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{s.empleadoNombre}</p>
                    <p className={`text-xs ${tc.color}`}>{tc.label} · {s.turno.horaInicio}–{s.turno.horaFin}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Entró: {hora}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Activo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aperturas extra (no programadas) */}
      {aperturasExtra.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Registros adicionales</h3>
          <div className="space-y-2">
            {aperturasExtra.map((a: any) => {
              const hora = new Date(a.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={a.id} className="flex items-center gap-3 bg-white border rounded-xl p-3">
                  {a.fotoUniformeUrl ? (
                    <button onClick={() => setFotoAmpliada(a.fotoUniformeUrl)} className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border shadow-sm hover:scale-105 transition-transform">
                      <img src={a.fotoUniformeUrl} alt="Uniforme" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Camera className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">Empleado #{a.empleadoId}</p>
                    <p className="text-xs text-slate-500">{TURNO_LABEL[a.tipoTurno]?.label ?? a.tipoTurno} · Entró: {hora}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {turnosHoy.length === 0 && aperturas.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin turnos programados para hoy</p>
        </div>
      )}
    </div>
  );
}

export default function ControlAsistencias() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [editando, setEditando] = useState<RegistroRow | null>(null);
  const [tab, setTab] = useState<"hoy" | "semana">("hoy");

  const semana = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const sucursalesQ = trpc.sucursales.list.useQuery();
  const sucursales = sucursalesQ.data ?? [];

  // Auto-seleccionar primera sucursal
  const sucursalSeleccionada = sucursalId ?? sucursales[0]?.id ?? null;

  const utils = trpc.useUtils();

  const resumenQ = trpc.nomina.getResumen.useQuery(
    { sucursalId: sucursalSeleccionada!, fechaInicio: semana.inicio, fechaFin: semana.fin },
    { enabled: !!sucursalSeleccionada }
  );

  const calcularMut = trpc.nomina.calcular.useMutation({
    onSuccess: () => {
      toast.success("Registros calculados — Los datos de asistencia fueron procesados.");
      utils.nomina.getResumen.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resumen = resumenQ.data ?? [];

  // Fechas de la semana (lun–dom)
  const fechasSemana = useMemo(() => {
    const fechas: string[] = [];
    const cur = new Date(semana.inicio + "T12:00:00Z");
    for (let i = 0; i < 7; i++) {
      fechas.push(cur.toISOString().split("T")[0]);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return fechas;
  }, [semana]);

  // KPIs globales
  const kpis = useMemo(() => {
    const totalDias = resumen.reduce((s, e) => s + e.diasTrabajados + e.diasAusente + e.diasJustificados + e.retardos, 0);
    const presentes = resumen.reduce((s, e) => s + e.diasTrabajados, 0);
    const ausentes = resumen.reduce((s, e) => s + e.diasAusente, 0);
    const retardos = resumen.reduce((s, e) => s + e.retardos, 0);
    const horasTotal = resumen.reduce((s, e) => s + e.horasTotales, 0);
    const puntualidad = totalDias > 0 ? Math.round(((presentes + resumen.reduce((s, e) => s + e.diasJustificados, 0)) / totalDias) * 100) : 0;
    return { presentes, ausentes, retardos, horasTotal, puntualidad };
  }, [resumen]);

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  // ─── Exportar Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    if (!resumen.length) return;
    const XLSX = await import("xlsx");
    const rows: any[] = [];
    for (const emp of resumen) {
      for (const r of emp.registros) {
        if (["descanso", "sin_horario"].includes(r.estado)) continue;
        rows.push({
          Empleado: emp.empleadoNombre,
          Rol: emp.empleadoRol,
          Fecha: r.fecha,
          "Día": new Date(r.fecha + "T12:00:00Z").toLocaleDateString("es-MX", { weekday: "long" }),
          Estado: ESTADO_CONFIG[r.estado]?.label ?? r.estado,
          "Turno esperado": r.turnoEsperado ?? "—",
          "Hora entrada esperada": r.horaEntradaEsperada ?? "—",
          "Hora salida esperada": r.horaSalidaEsperada ?? "—",
          "Hora entrada real": tsToHora(r.timestampEntrada),
          "Hora salida real": tsToHora(r.timestampSalida),
          "Horas trabajadas": r.horasTrabajadas ?? 0,
          "Minutos retardo": r.minutosRetardo ?? 0,
          "Editado manualmente": r.editadoManualmente ? "Sí" : "No",
          "Tipo justificación": r.tipoJustificacion ? TIPO_JUSTIFICACION_LABELS[r.tipoJustificacion] : "",
          Justificación: r.justificacion ?? "",
        });
      }
    }
    // Hoja de resumen
    const resumenRows = resumen.map(e => ({
      Empleado: e.empleadoNombre,
      Rol: e.empleadoRol,
      "Días trabajados": e.diasTrabajados,
      "Días ausente": e.diasAusente,
      "Ausencias justificadas": e.diasJustificados,
      Retardos: e.retardos,
      "Horas totales": e.horasTotales,
      "Minutos retardo total": e.minutosRetardoTotal,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "Resumen Nómina");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Detalle por Día");
    const sucNombre = sucursales.find(s => s.id === sucursalSeleccionada)?.nombre ?? "tienda";
    XLSX.writeFile(wb, `nomina_${sucNombre}_${semana.inicio}_${semana.fin}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Control de Asistencias</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Status en tiempo real y nómina semanal</p>
        </div>
        {sucursales.length > 1 && (
          <Select value={String(sucursalSeleccionada)} onValueChange={v => setSucursalId(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Sucursal" /></SelectTrigger>
            <SelectContent>
              {sucursales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("hoy")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "hoy" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => setTab("semana")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "semana" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Semana / Nómina
        </button>
      </div>

      {/* Contenido pestaña Hoy */}
      {tab === "hoy" && sucursalSeleccionada && (
        <TabHoy sucursalId={sucursalSeleccionada} />
      )}

      {/* Contenido pestaña Semana */}
      {tab === "semana" && (
        <>
          {/* Navegación de semana */}
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">{semana.label}</span>
            <div className="flex gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>‹ Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Esta semana</Button>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>Siguiente ›</Button>
            </div>
          </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Días presentes</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{kpis.presentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Ausencias</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{kpis.ausentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Retardos</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{kpis.retardos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Horas totales</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{kpis.horasTotal.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Puntualidad</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{kpis.puntualidad}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => sucursalSeleccionada && calcularMut.mutate({ sucursalId: sucursalSeleccionada, fechaInicio: semana.inicio, fechaFin: semana.fin })}
          disabled={calcularMut.isPending || !sucursalSeleccionada}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${calcularMut.isPending ? "animate-spin" : ""}`} />
          {calcularMut.isPending ? "Calculando..." : "Recalcular semana"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!resumen.length}>
          <Download className="w-4 h-4 mr-1.5" />
          Exportar Excel (nómina)
        </Button>
      </div>

      {/* Tabla principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumen por empleado</CardTitle>
          <p className="text-xs text-muted-foreground">Haz clic en una fila para ver el detalle día a día. Usa el ícono ✎ para justificar ausencias.</p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {resumenQ.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando registros...</div>
          ) : !resumen.length ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-muted-foreground">No hay registros para esta semana.</p>
              <Button size="sm" onClick={() => sucursalSeleccionada && calcularMut.mutate({ sucursalId: sucursalSeleccionada, fechaInicio: semana.inicio, fechaFin: semana.fin })} disabled={calcularMut.isPending}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${calcularMut.isPending ? "animate-spin" : ""}`} />
                Calcular ahora
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Empleado</th>
                  <th className="px-3 py-2 text-center font-medium text-green-700">Pres.</th>
                  <th className="px-3 py-2 text-center font-medium text-red-600">Aus.</th>
                  <th className="px-3 py-2 text-center font-medium text-blue-600">Just.</th>
                  <th className="px-3 py-2 text-center font-medium text-yellow-700">Ret.</th>
                  <th className="px-3 py-2 text-center font-medium">Horas</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Min ret.</th>
                  {fechasSemana.map((f, i) => (
                    <th key={f} className="px-1 py-2 text-center font-medium text-muted-foreground text-xs">
                      {DIAS_CORTO[i]}<br />
                      <span className="font-normal">{new Date(f + "T12:00:00Z").getUTCDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.map(emp => (
                  <FilaEmpleado
                    key={emp.empleadoId}
                    resumen={emp}
                    fechas={fechasSemana}
                    canEdit={canEdit}
                    onEditRegistro={setEditando}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal de justificación */}
      {editando && (
        <ModalJustificacion
          registro={editando}
          onClose={() => setEditando(null)}
          onSaved={() => utils.nomina.getResumen.invalidate()}
        />
      )}
        </>
      )}
    </div>
  );
}
