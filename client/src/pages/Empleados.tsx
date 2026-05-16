import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Pencil, UserX, Phone, Calendar, ChevronDown, ChevronUp, Link2 } from "lucide-react";
const ROL_LABELS: Record<string, string> = {
  anfitrion: "Anfitrion",
  lider: "Lider",
  administrador: "Administrador",
};
const ROL_COLORS: Record<string, string> = {
  anfitrion: "bg-blue-100 text-blue-800",
  lider: "bg-purple-100 text-purple-800",
  administrador: "bg-orange-100 text-orange-800",
};

const DIAS_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const DIAS_NOMBRES_COMPLETOS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

type HorarioDia = { entrada: string; salida: string } | null;
type HorarioPersonal = Record<number, HorarioDia>;

interface EmpleadoForm {
  nombre: string;
  apellido: string;
  rol: "anfitrion" | "lider" | "administrador";
  telefono: string;
  fechaIngreso: string;
  notas: string;
  diaDescansoFijo: number | null;
  horarioPersonal: HorarioPersonal;
}

const defaultHorario: HorarioPersonal = {
  0: null,
  1: { entrada: "09:00", salida: "17:00" },
  2: { entrada: "09:00", salida: "17:00" },
  3: { entrada: "09:00", salida: "17:00" },
  4: { entrada: "09:00", salida: "17:00" },
  5: { entrada: "09:00", salida: "17:00" },
  6: { entrada: "09:00", salida: "17:00" },
};

const defaultForm: EmpleadoForm = {
  nombre: "",
  apellido: "",
  rol: "anfitrion",
  telefono: "",
  fechaIngreso: new Date().toISOString().split("T")[0],
  notas: "",
  diaDescansoFijo: null,
  horarioPersonal: { ...defaultHorario },
};

export default function Empleados() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [showInactivos, setShowInactivos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmpleadoForm>(defaultForm);
  const [bajaConfirm, setBajaConfirm] = useState<number | null>(null);
  const [vincularEmpleado, setVincularEmpleado] = useState<any | null>(null);
  const [userIdInput, setUserIdInput] = useState("");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const utils = trpc.useUtils();

  const { data: empleados = [], isLoading } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0, soloActivos: !showInactivos },
    { enabled: !!sucursalId }
  );

  const createMut = trpc.empleados.create.useMutation({
    onSuccess: () => {
      utils.empleados.list.invalidate();
      toast.success("Empleado creado");
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.empleados.update.useMutation({
    onSuccess: () => {
      utils.empleados.list.invalidate();
      toast.success("Empleado actualizado");
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const bajaMut = trpc.empleados.darBaja.useMutation({
    onSuccess: () => {
      utils.empleados.list.invalidate();
      toast.success("Empleado dado de baja");
      setBajaConfirm(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const vincularMut = trpc.empleados.vincularUsuario?.useMutation?.({
    onSuccess: () => {
      utils.empleados.list.invalidate();
      toast.success("Usuario vinculado");
      setVincularEmpleado(null);
      setUserIdInput("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(emp: any) {
    setEditId(emp.id);
    let horario: HorarioPersonal = { ...defaultHorario };
    try {
      const h = emp.horarioPersonal;
      const parsed = typeof h === "string" ? JSON.parse(h) : (h ?? {});
      // Convertir keys string a number
      for (const k of Object.keys(parsed)) {
        horario[Number(k)] = parsed[k];
      }
    } catch { }
    setForm({
      nombre: emp.nombre ?? "",
      apellido: emp.apellido ?? "",
      rol: emp.rol ?? "anfitrion",
      telefono: emp.telefono ?? "",
      fechaIngreso: emp.fechaIngreso ? new Date(emp.fechaIngreso).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      notas: emp.notas ?? "",
      diaDescansoFijo: emp.diaDescansoFijo ?? null,
      horarioPersonal: horario,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    const horarioJson = JSON.stringify(form.horarioPersonal);
    if (editId !== null) {
      updateMut.mutate({
        id: editId,
        nombre: form.nombre,
        apellido: form.apellido,
        rol: form.rol,
        telefono: form.telefono,
        notas: form.notas,
        diaDescansoFijo: form.diaDescansoFijo,
        horarioPersonal: horarioJson,
      } as any);
    } else {
      if (!sucursalId) { toast.error("Selecciona una sucursal"); return; }
      createMut.mutate({
        sucursalId,
        nombre: form.nombre,
        apellido: form.apellido,
        rol: form.rol,
        telefono: form.telefono,
        fechaIngreso: form.fechaIngreso,
        notas: form.notas,
        diaDescansoFijo: form.diaDescansoFijo,
        horarioPersonal: horarioJson,
      } as any);
    }
  }

  function toggleDescanso(dia: number) {
    setForm(f => ({
      ...f,
      horarioPersonal: {
        ...f.horarioPersonal,
        [dia]: (f.horarioPersonal[dia] === null || f.horarioPersonal[dia] === undefined)
          ? { entrada: "09:00", salida: "17:00" }
          : null,
      },
    }));
  }

  function setDiaDescansoFijo(idx: number | null) {
    setForm(f => {
      const newHorario: HorarioPersonal = { ...f.horarioPersonal };
      // Solo restaurar el dia que era descanso fijo anterior
      if (f.diaDescansoFijo !== null && f.diaDescansoFijo !== undefined && f.diaDescansoFijo !== idx) {
        newHorario[f.diaDescansoFijo] = { entrada: "09:00", salida: "17:00" };
      }
      // Marcar el nuevo dia como descanso
      if (idx !== null) {
        newHorario[idx] = null;
      }
      return { ...f, diaDescansoFijo: idx, horarioPersonal: newHorario };
    });
  }

  function setHora(dia: number, campo: "entrada" | "salida", valor: string) {
    setForm(f => ({
      ...f,
      horarioPersonal: {
        ...f.horarioPersonal,
        [dia]: {
          entrada: campo === "entrada" ? valor : ((f.horarioPersonal[dia] as any)?.entrada ?? "09:00"),
          salida: campo === "salida" ? valor : ((f.horarioPersonal[dia] as any)?.salida ?? "17:00"),
        },
      },
    }));
  }

  const liders = empleados.filter((e: any) => e.rol === "lider");
  const anfitriones = empleados.filter((e: any) => e.rol === "anfitrion");
  const admins = empleados.filter((e: any) => e.rol === "administrador");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Empleados</h1>
            <p className="text-sm text-muted-eground">Registro de anfitriones y líderes por sucursal</p>
          </div>
        </div>
        {canEdit && sucursalId && (
          <Button onClick={openCreate} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo empleado
          </Button>
        )}
      </div>

      {/* Selector sucursal */}
      <div className="flex items-center gap-4">
        <div className="w-56">
          <Select value={sucursalId?.toString() ?? ""} onValueChange={v => setSucursalId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona sucursal" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {sucursales.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {sucursalId && (
          <button onClick={() => setShowInactivos(!showInactivos)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {showInactivos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showInactivos ? "Ocultar bajas" : "Ver bajas"}
          </button>
        )}
      </div>

      {isLoading && <div className="py-12 text-center text-muted-foreground text-sm">Cargando...</div>}

      {sucursalId && !isLoading && (
        <div className="space-y-6">
          {/* Líderes */}
          {liders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Líderes ({liders.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {liders.map((emp: any) => <EmpleadoCard key={emp.id} emp={emp} canEdit={canEdit} onEdit={() => openEdit(emp)} onBaja={() => setBajaConfirm(emp.id)} onVincular={() => { setVincularEmpleado(emp); setUserIdInput(""); }} />)}
              </div>
            </div>
          )}
          {/* Anfitriones */}
          {anfitriones.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Anfitriones ({anfitriones.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {anfitriones.map((emp: any) => <EmpleadoCard key={emp.id} emp={emp} canEdit={canEdit} onEdit={() => openEdit(emp)} onBaja={() => setBajaConfirm(emp.id)} onVincular={() => { setVincularEmpleado(emp); setUserIdInput(""); }} />)}
              </div>
            </div>
          )}
          {/* Admins */}
          {admins.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Administradores ({admins.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {admins.map((emp: any) => <EmpleadoCard key={emp.id} emp={emp} canEdit={canEdit} onEdit={() => openEdit(emp)} onBaja={() => setBajaConfirm(emp.id)} onVincular={() => { setVincularEmpleado(emp); setUserIdInput(""); }} />)}
              </div>
            </div>
          )}
          {empleados.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No hay empleados registrados</div>
          )}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditId(null); setForm(defaultForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} placeholder="Apellido" />
              </div>
            </div>

            <div>
              <Label>Rol</Label>
              <Select value={form.rol} onValueChange={v => setForm(f => ({ ...f, rol: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="anfitrion">Anfitrión</SelectItem>
                  {["owner","superadmin","manager"].includes(user?.role ?? "") && <SelectItem value="lider">Líder</SelectItem>}
                  <SelectItem value="administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="55 1234 5678" />
            </div>

            <div>
              <Label>Notas internas</Label>
              <Input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Opcional" />
            </div>

            {!editId && (
              <div>
                <Label>Fecha de ingreso</Label>
                <Input type="date" value={form.fechaIngreso} onChange={e => setForm(f => ({ ...f, fechaIngreso: e.target.value }))} />
              </div>
            )}

            {/* Día de descanso fijo */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Día de descanso fijo</Label>
              <p className="text-xs text-muted-foreground">El día que siempre descansa este empleado</p>
              <div className="flex gap-1.5 flex-wrap">
                {DIAS_LABELS.map((dia, idx) => (
                  <button key={idx} type="button"
                    onClick={() => setDiaDescansoFijo(form.diaDescansoFijo === idx ? null : idx)}
                    className={"px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors " + (form.diaDescansoFijo === idx ? "bg-red-500 text-white border-red-500" : "border-input hover:bg-muted")}>
                    {dia}
                  </button>
                ))}
              </div>

            </div>

            {/* Horario por día */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-semibold">Horario por día</Label>
              <p className="text-xs text-muted-foreground">Define la hora de entrada y salida para cada día. Clic en "Descanso" para marcar día libre.</p>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 0].map(dia => {
                  const h = form.horarioPersonal[dia];
                  const esDescanso = h === null || h === undefined;
                  return (
                    <div key={dia} className="flex items-center gap-2 py-0.5">
                      <span className="text-xs font-medium w-8 shrink-0 text-muted-foreground">{DIAS_LABELS[dia]}</span>
                      {esDescanso ? (
                        <span className="text-xs text-red-400 flex-1 italic">
                          {form.diaDescansoFijo === dia ? "Descanso fijo" : "Descanso"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input type="time" value={h!.entrada}
                            onChange={e => setHora(dia, "entrada", e.target.value)}
                            className="h-7 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" style={{width:"88px"}} />                          <span className="text-xs text-muted-foreground">–</span>
                          <input type="time" value={h!.salida}
                            onChange={e => setHora(dia, "salida", e.target.value)}
                            className="h-7 text-xs rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" style={{width:"88px"}} />
                        </div>
                      )}
                      <button type="button" onClick={() => toggleDescanso(dia)}
                        className={"text-xs px-2 py-1 rounded-lg font-medium shrink-0 " + (esDescanso ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200")}>
                        {esDescanso ? "Activar" : "Descanso"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditId(null); setForm(defaultForm); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="bg-green-600 hover:bg-green-700">
              {createMut.isPending || updateMut.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar baja */}
      <Dialog open={bajaConfirm !== null} onOpenChange={o => !o && setBajaConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dar de baja</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¡Confirmas dar de baja a este empleado? Podrás reactivarlo después.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => bajaConfirm && bajaMut.mutate({ id: bajaConfirm })}
              disabled={bajaMut.isPending}>
              {bajaMut.isPending ? "..." : "Dar de baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Vincular usuario */}
      {vincularMut && (
        <Dialog open={vincularEmpleado !== null} onOpenChange={o => !o && setVincularEmpleado(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Vincular usuario — {vincularEmpleado?.nombre}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Ingresa el ID del usuario del sistema para vincularlo a este empleado.</p>
              <Input value={userIdInput} onChange={e => setUserIdInput(e.target.value)} placeholder="ID del usuario" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVincularEmpleado(null)}>Cancelar</Button>
              <Button onClick={() => vincularMut.mutate({ empleadoId: vincularEmpleado!.id, userId: Number(userIdInput) })}
                disabled={!userIdInput || vincularMut.isPending}>
                {vincularMut.isPending ? "Vinculando..." : "Vincular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EmpleadoCard({ emp, canEdit, onEdit, onBaja, onVincular }: {
  emp: any; canEdit: boolean; onEdit: () => void; onBaja: () => void; onVincular: () => void;
}) {
  return (
    <div className={"bg-card rounded-2xl border p-4 space-y-3 " + (!emp.activo ? "opacity-60" : "")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center font-bold text-violet-700">
            {emp.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{emp.nombre} {emp.apellido ?? ""}</p>
            <Badge className={"text-xs " + (ROL_COLORS[emp.rol] ?? "")}>{ROL_LABELS[emp.rol] ?? emp.rol}</Badge>
          </div>
        </div>
        {canEdit && emp.activo && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onBaja} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600">
              <UserX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {emp.telefono && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" /> {emp.telefono}
          </span>
        )}
        {emp.fechaIngreso && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Ingreso: {new Date(emp.fechaIngreso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        )}
      </div>
      {emp.diaDescansoFijo !== null && emp.diaDescansoFijo !== undefined && (
        <p className="text-xs text-red-500">Descanso: {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][emp.diaDescansoFijo]}</p>
      )}
      {canEdit && !emp.userId && emp.activo && (
        <button onClick={onVincular} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Vincular usuario del sistema
        </button>
      )}
      {emp.userId && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Vinculado (ID: {emp.userId})
        </p>
      )}
    </div>
  );
}
