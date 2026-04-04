import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  Sparkles, AlertTriangle, CheckCircle2, Clock, Users
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSemanaISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { anio: d.getFullYear(), semana: weekNum };
}

function getLunesDeSemana(anio: number, semana: number): Date {
  const jan4 = new Date(Date.UTC(anio, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  return new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000 + (semana - 1) * 7 * 86400000);
}

function semanaLabel(anio: number, semana: number) {
  const lunes = getLunesDeSemana(anio, semana);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  return `${lunes.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${domingo.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`;
}

function navSemana(anio: number, semana: number, delta: number): { anio: number; semana: number } {
  const lunes = getLunesDeSemana(anio, semana);
  lunes.setUTCDate(lunes.getUTCDate() + delta * 7);
  return getSemanaISO(lunes);
}

function getDiasFecha(anio: number, semana: number): { fecha: string; dia: string; label: string }[] {
  const lunes = getLunesDeSemana(anio, semana);
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return dias.map((label, i) => {
    const d = new Date(lunes.getTime() + i * 86400000);
    const fecha = d.toISOString().slice(0, 10);
    return { fecha, dia: label, label };
  });
}

const TURNO_CONFIG: Record<string, { label: string; color: string; bg: string; textColor: string }> = {
  matutino:   { label: "Matutino",   color: "border-blue-300",   bg: "bg-blue-50",   textColor: "text-blue-700" },
  intermedio: { label: "Intermedio", color: "border-teal-300",   bg: "bg-teal-50",   textColor: "text-teal-700" },
  vespertino: { label: "Vespertino", color: "border-purple-300", bg: "bg-purple-50", textColor: "text-purple-700" },
  anfitrion:  { label: "Anfitrión",  color: "border-amber-300",  bg: "bg-amber-50",  textColor: "text-amber-700" },
};

const CAT_LABELS: Record<string, { label: string; color: string }> = {
  D: { label: "Diaria",   color: "bg-blue-100 text-blue-700" },
  S: { label: "Semanal Isla", color: "bg-green-100 text-green-700" },
  B: { label: "Bodega",   color: "bg-amber-100 text-amber-700" },
  M: { label: "Mensual",  color: "bg-rose-100 text-rose-700" },
};

// ─── Modal de turno ───────────────────────────────────────────────────────────

interface TurnoFormData {
  empleadoId: number;
  fecha: string;
  puesto: string;
  turno: "matutino" | "intermedio" | "vespertino" | "anfitrion";
  horaInicio: string;
  horaFin: string;
  rolPrincipal: string;
  comentarios: string;
  actividades: string[];
}

const EMPTY_FORM: TurnoFormData = {
  empleadoId: 0,
  fecha: "",
  puesto: "",
  turno: "intermedio",
  horaInicio: "12:30",
  horaFin: "20:30",
  rolPrincipal: "Caja",
  comentarios: "",
  actividades: [],
};

interface TurnoModalProps {
  open: boolean;
  onClose: () => void;
  sucursalId: number;
  empleados: { id: number; nombre: string; apellido?: string | null }[];
  catalogo: { clave: string; descripcion: string; categoria: string }[];
  editTurno?: { id: number } & TurnoFormData;
  fechaDefault?: string;
  sugerenciaActividades?: string[];
  onSaved: () => void;
}

function TurnoModal({ open, onClose, sucursalId, empleados, catalogo, editTurno, fechaDefault, sugerenciaActividades, onSaved }: TurnoModalProps) {
  const [form, setForm] = useState<TurnoFormData>(() =>
    editTurno ? { ...editTurno } : { ...EMPTY_FORM, fecha: fechaDefault ?? "", actividades: sugerenciaActividades ?? [] }
  );

  const crear = trpc.horarios.crearTurno.useMutation({
    onSuccess: () => { toast.success("Turno creado"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.horarios.actualizarTurno.useMutation({
    onSuccess: () => { toast.success("Turno actualizado"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  // Agrupar catálogo por categoría
  const catalogoAgrupado = useMemo(() => {
    const grupos: Record<string, typeof catalogo> = { D: [], S: [], B: [], M: [] };
    for (const a of catalogo) grupos[a.categoria]?.push(a);
    return grupos;
  }, [catalogo]);

  function toggleActividad(clave: string) {
    setForm(f => ({
      ...f,
      actividades: f.actividades.includes(clave)
        ? f.actividades.filter(a => a !== clave)
        : [...f.actividades, clave],
    }));
  }

  function selectCategoria(cat: string, select: boolean) {
    const claves = catalogoAgrupado[cat]?.map(a => a.clave) ?? [];
    setForm(f => ({
      ...f,
      actividades: select
        ? Array.from(new Set([...f.actividades, ...claves]))
        : f.actividades.filter(a => !claves.includes(a)),
    }));
  }

  function handleSubmit() {
    if (!form.empleadoId) { toast.error("Selecciona un empleado"); return; }
    if (!form.fecha) { toast.error("Selecciona una fecha"); return; }
    if (editTurno) {
      actualizar.mutate({ id: editTurno.id, ...form });
    } else {
      crear.mutate({ sucursalId, ...form });
    }
  }

  const isPending = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTurno ? "Editar turno" : "Agregar turno"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* Empleado */}
          <div className="col-span-2">
            <Label className="text-xs">Empleado</Label>
            <Select value={String(form.empleadoId || "")} onValueChange={v => setForm(f => ({ ...f, empleadoId: Number(v) }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
              <SelectContent>
                {empleados.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nombre} {e.apellido ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha */}
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </div>

          {/* Turno */}
          <div>
            <Label className="text-xs">Turno</Label>
            <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TURNO_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hora inicio */}
          <div>
            <Label className="text-xs">Hora inicio</Label>
            <Input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} />
          </div>

          {/* Hora fin */}
          <div>
            <Label className="text-xs">Hora fin</Label>
            <Input type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} />
          </div>

          {/* Puesto */}
          <div>
            <Label className="text-xs">Puesto</Label>
            <Select value={form.puesto} onValueChange={v => setForm(f => ({ ...f, puesto: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {["Caja", "Barista", "Caja y barista", "Barista y Caja", "Comodín y Barista", "Comodín y Caja", "Comodín"].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rol principal */}
          <div>
            <Label className="text-xs">Rol principal</Label>
            <Select value={form.rolPrincipal} onValueChange={v => setForm(f => ({ ...f, rolPrincipal: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {["Caja", "Cajera", "Bebidas", "Botella", "Fika"].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comentarios */}
          <div className="col-span-2">
            <Label className="text-xs">Comentarios</Label>
            <Input value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} placeholder="Ej. Fumigación 9:00 pm" />
          </div>
        </div>

        {/* Actividades */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold">Actividades de limpieza</Label>
            <span className="text-xs text-slate-500">{form.actividades.length} seleccionadas</span>
          </div>

          {sugerenciaActividades && sugerenciaActividades.length > 0 && !editTurno && (
            <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded p-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Sugerencia: actividades S/B pendientes de la semana preseleccionadas</span>
            </div>
          )}

          <Tabs defaultValue="D">
            <TabsList className="w-full">
              {Object.entries(CAT_LABELS).map(([cat, { label }]) => {
                const count = form.actividades.filter(a => a.startsWith(cat)).length;
                return (
                  <TabsTrigger key={cat} value={cat} className="flex-1 text-xs">
                    {label} {count > 0 && <span className="ml-1 bg-teal-500 text-white rounded-full px-1.5 text-[10px]">{count}</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(catalogoAgrupado).map(([cat, items]) => {
              const allSelected = items.every(a => form.actividades.includes(a.clave));
              return (
                <TabsContent key={cat} value={cat} className="mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={v => selectCategoria(cat, !!v)}
                      id={`sel-all-${cat}`}
                    />
                    <label htmlFor={`sel-all-${cat}`} className="text-xs text-slate-500 cursor-pointer">
                      Seleccionar todas
                    </label>
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {items.map(a => (
                      <div key={a.clave} className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-slate-50 ${form.actividades.includes(a.clave) ? "bg-teal-50 border border-teal-200" : ""}`}
                        onClick={() => toggleActividad(a.clave)}>
                        <Checkbox
                          checked={form.actividades.includes(a.clave)}
                          onCheckedChange={() => toggleActividad(a.clave)}
                          className="mt-0.5 shrink-0"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-700">{a.clave}</span>
                          <span className="text-xs text-slate-600 ml-1.5">{a.descripcion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Guardando..." : editTurno ? "Actualizar" : "Crear turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Horarios() {
  const { user } = useAuth();
  const [{ anio, semana }, setSemana] = useState(() => getSemanaISO());
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTurno, setEditTurno] = useState<any>(null);
  const [fechaDefault, setFechaDefault] = useState<string | undefined>();

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const activeSucursalId = sucursalId ?? sucursales[0]?.id ?? null;

  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: activeSucursalId ?? 0 },
    { enabled: !!activeSucursalId }
  );

  const { data: semanaData, refetch } = trpc.horarios.getSemana.useQuery(
    { sucursalId: activeSucursalId ?? 0, anio, semana },
    { enabled: !!activeSucursalId }
  );

  const { data: catalogo = [] } = trpc.horarios.getCatalogo.useQuery();

  const { data: sugerencia } = trpc.horarios.sugerirDistribucion.useQuery(
    { sucursalId: activeSucursalId ?? 0, anio, semana },
    { enabled: !!activeSucursalId }
  );

  const utils = trpc.useUtils();

  const eliminar = trpc.horarios.eliminarTurno.useMutation({
    onSuccess: () => { toast.success("Turno eliminado"); utils.horarios.getSemana.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  // Días de la semana con fechas
  const diasFecha = useMemo(() => getDiasFecha(anio, semana), [anio, semana]);

  // Agrupar turnos por fecha
  const turnosPorFecha = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!semanaData) return map;
    for (const t of (semanaData as any).turnos ?? []) {
      if (!map[t.fecha]) map[t.fecha] = [];
      map[t.fecha].push(t);
    }
    return map;
  }, [semanaData]);

  // Actividades por turnoId
  const actividadesPorTurno = useMemo(() => {
    const map: Record<number, any[]> = {};
    if (!semanaData) return map;
    for (const a of (semanaData as any).actividades ?? []) {
      if (!map[a.turnoId]) map[a.turnoId] = [];
      map[a.turnoId].push(a);
    }
    return map;
  }, [semanaData]);

  // Empleados map
  const empleadosMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const e of (semanaData?.empleados ?? [])) {
      m[e.id] = `${e.nombre} ${e.apellido ?? ""}`.trim();
    }
    return m;
  }, [semanaData]);

  function openNew(fecha?: string) {
    setEditTurno(null);
    setFechaDefault(fecha);
    setShowModal(true);
  }

  function openEdit(turno: any) {
    const acts = (actividadesPorTurno[turno.id] ?? []).map((a: any) => a.actividadClave);
    setEditTurno({ ...turno, actividades: acts });
    setFechaDefault(undefined);
    setShowModal(true);
  }

  function handleSaved() {
    utils.horarios.getSemana.invalidate();
    utils.horarios.sugerirDistribucion.invalidate();
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-600" />
            Horario Semanal
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Asigna turnos y actividades de limpieza por empleado</p>
        </div>
        <div className="flex items-center gap-2">
          {sucursales.length > 1 && (
            <Select value={String(activeSucursalId ?? "")} onValueChange={v => setSucursalId(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Sucursal" /></SelectTrigger>
              <SelectContent>
                {sucursales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Button onClick={() => openNew()} className="bg-teal-600 hover:bg-teal-700 text-white gap-1">
              <Plus className="w-4 h-4" /> Agregar turno
            </Button>
          )}
        </div>
      </div>

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

      {/* Sugerencia de distribución */}
      {sugerencia && sugerencia.ranking.length > 0 && (
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-teal-800 mb-1">Sugerencia de distribución equitativa</p>
                <div className="flex flex-wrap gap-2">
                  {sugerencia.ranking.map(r => (
                    <div key={r.empleadoId} className="text-xs bg-white rounded border border-teal-200 px-2 py-1">
                      <span className="font-medium text-slate-700">{r.nombre}</span>
                      <span className="text-slate-500 ml-1">· {r.diasUltimas4Semanas} días / {Math.round(r.horasUltimas4Semanas)}h (últ. 4 sem.)</span>
                    </div>
                  ))}
                </div>
                {sugerencia.actividadesPendientesSB.length > 0 && (
                  <p className="text-xs text-teal-700 mt-1.5">
                    <span className="font-medium">Actividades S/B pendientes de asignar:</span>{" "}
                    {sugerencia.actividadesPendientesSB.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid semanal */}
      <div className="space-y-3">
        {diasFecha.map(({ fecha, label }) => {
          const turnosDelDia = turnosPorFecha[fecha] ?? [];
          return (
            <Card key={fecha} className="overflow-hidden">
              <CardHeader className="py-2 px-4 bg-slate-50 border-b flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <span className="text-xs text-slate-400">{new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                  {turnosDelDia.length > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">{turnosDelDia.length} turno{turnosDelDia.length > 1 ? "s" : ""}</Badge>
                  )}
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-teal-600 hover:text-teal-700" onClick={() => openNew(fecha)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Turno
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-3">
                {turnosDelDia.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">Sin turnos asignados</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {turnosDelDia.map((t: any) => {
                      const tc = TURNO_CONFIG[t.turno as string] ?? TURNO_CONFIG.intermedio;
                      const acts: any[] = actividadesPorTurno[t.id] ?? [];
                      const completadas = acts.filter((a: any) => a.completada).length;
                      const pendientes = acts.filter((a: any) => a.esPendiente).length;
                      const nombreEmp = empleadosMap[t.empleadoId] ?? `Empleado #${t.empleadoId}`;
                      return (
                        <div key={t.id} className={`border rounded-lg p-3 ${tc.bg} ${tc.color}`}>
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-bold ${tc.textColor}`}>{tc.label}</span>
                                <span className="text-xs text-slate-600 font-medium truncate">{nombreEmp}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                {t.horaInicio}–{t.horaFin}
                                {t.puesto && <span className="ml-1 text-slate-400">· {t.puesto}</span>}
                              </div>
                              {t.rolPrincipal && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1">{t.rolPrincipal}</Badge>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEdit(t)} className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => { if (confirm("¿Eliminar este turno?")) eliminar.mutate({ id: t.id }); }}
                                  className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Actividades */}
                          {acts.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-slate-500 font-medium">Actividades ({acts.length})</span>
                                <span className="text-[10px] text-slate-500">{completadas}/{acts.length} ✓</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {acts.map(a => (
                                  <span key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    a.completada ? "bg-green-100 text-green-700 line-through" :
                                    a.esPendiente ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300" :
                                    "bg-white/70 text-slate-600"
                                  }`}>
                                    {a.actividadClave}
                                  </span>
                                ))}
                              </div>
                              {pendientes > 0 && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  {pendientes} pendiente{pendientes > 1 ? "s" : ""} del turno anterior
                                </div>
                              )}
                              {t.cerrado && (
                                <div className="flex items-center gap-1 mt-1 text-[10px] text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Turno cerrado
                                </div>
                              )}
                            </div>
                          )}

                          {t.comentarios && (
                            <p className="text-[10px] text-slate-500 mt-1.5 italic">{t.comentarios}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumen de empleados */}
      {sugerencia && sugerencia.ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Resumen de carga — Semana {semana}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sugerencia.ranking.map(r => {
                const turnosEstaSemana = (semanaData?.turnos ?? []).filter(t => t.empleadoId === r.empleadoId).length;
                return (
                  <div key={r.empleadoId} className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-sm font-semibold text-slate-700">{r.nombre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Esta semana: <strong>{turnosEstaSemana}</strong> turno{turnosEstaSemana !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-slate-400">Últ. 4 sem.: {r.diasUltimas4Semanas} días · {Math.round(r.horasUltimas4Semanas)}h</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {showModal && activeSucursalId && (
        <TurnoModal
          open={showModal}
          onClose={() => setShowModal(false)}
          sucursalId={activeSucursalId}
          empleados={empleados}
          catalogo={catalogo}
          editTurno={editTurno}
          fechaDefault={fechaDefault}
          sugerenciaActividades={!editTurno ? (sugerencia?.actividadesPendientesSB ?? []) : undefined}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
