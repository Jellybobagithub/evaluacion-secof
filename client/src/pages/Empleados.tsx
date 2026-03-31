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
import { Users, Plus, Pencil, UserX, Phone, Calendar, ChevronDown, ChevronUp } from "lucide-react";

const ROL_LABELS: Record<string, string> = {
  anfitrion: "Anfitrión",
  lider: "Líder",
  administrador: "Administrador",
};

const ROL_COLORS: Record<string, string> = {
  anfitrion: "bg-blue-100 text-blue-800",
  lider: "bg-purple-100 text-purple-800",
  administrador: "bg-orange-100 text-orange-800",
};

interface EmpleadoForm {
  nombre: string;
  apellido: string;
  rol: "anfitrion" | "lider" | "administrador";
  telefono: string;
  fechaIngreso: string;
  notas: string;
}

const defaultForm: EmpleadoForm = {
  nombre: "",
  apellido: "",
  rol: "anfitrion",
  telefono: "",
  fechaIngreso: new Date().toISOString().split("T")[0],
  notas: "",
};

export default function Empleados() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [showInactivos, setShowInactivos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmpleadoForm>(defaultForm);
  const [bajaConfirm, setBajaConfirm] = useState<number | null>(null);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const utils = trpc.useUtils();

  const { data: empleados = [], isLoading } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0, soloActivos: !showInactivos },
    { enabled: !!sucursalId }
  );

  const createMut = trpc.empleados.create.useMutation({
    onSuccess: () => {
      utils.empleados.list.invalidate();
      toast.success("Empleado registrado correctamente");
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

  // Solo manager/owner/superadmin pueden crear o editar empleados; el líder solo puede ver
  const canEdit = ["owner", "superadmin", "manager"].includes(user?.role ?? "");

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(emp: typeof empleados[0]) {
    setEditId(emp.id);
    setForm({
      nombre: emp.nombre,
      apellido: emp.apellido ?? "",
      rol: emp.rol,
      telefono: emp.telefono ?? "",
      fechaIngreso: emp.fechaIngreso
        ? new Date(emp.fechaIngreso).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      notas: emp.notas ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    if (!sucursalId) { toast.error("Selecciona una sucursal"); return; }
    if (editId) {
      updateMut.mutate({ id: editId, nombre: form.nombre, apellido: form.apellido, rol: form.rol, telefono: form.telefono, notas: form.notas });
    } else {
      createMut.mutate({ sucursalId, nombre: form.nombre, apellido: form.apellido, rol: form.rol, telefono: form.telefono, fechaIngreso: form.fechaIngreso, notas: form.notas });
    }
  }

  const activos = empleados.filter(e => e.activo);
  const inactivos = empleados.filter(e => !e.activo);
  const porRol = {
    lider: activos.filter(e => e.rol === "lider"),
    anfitrion: activos.filter(e => e.rol === "anfitrion"),
    administrador: activos.filter(e => e.rol === "administrador"),
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Empleados</h1>
            <p className="text-sm text-muted-foreground">Registro de anfitriones y líderes por sucursal</p>
          </div>
        </div>
        {canEdit && sucursalId && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Nuevo empleado
          </Button>
        )}
      </div>

      {/* Selector de sucursal */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Sucursal</Label>
              <Select
                value={sucursalId?.toString() ?? ""}
                onValueChange={(v) => setSucursalId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sucursal..." />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sucursalId && (
              <div className="flex items-center gap-2 mt-5">
                <button
                  onClick={() => setShowInactivos(!showInactivos)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showInactivos ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showInactivos ? "Ocultar bajas" : "Ver bajas"}
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!sucursalId && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona una sucursal para ver su equipo</p>
        </div>
      )}

      {sucursalId && isLoading && (
        <div className="text-center py-8 text-muted-foreground">Cargando empleados...</div>
      )}

      {sucursalId && !isLoading && activos.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay empleados registrados</p>
          {canEdit
            ? <p className="text-sm mt-1">Agrega el primer empleado con el botón de arriba</p>
            : <p className="text-sm mt-1">Contacta a tu administrador para registrar empleados</p>
          }
        </div>
      )}

      {/* Tarjetas por rol */}
      {sucursalId && !isLoading && (
        <div className="space-y-6">
          {(["lider", "anfitrion", "administrador"] as const).map((rol) => {
            const lista = porRol[rol];
            if (lista.length === 0) return null;
            return (
              <div key={rol}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {ROL_LABELS[rol]}s ({lista.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lista.map((emp) => (
                    <Card key={emp.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold">{emp.nombre} {emp.apellido}</p>
                            <Badge className={`text-xs mt-1 ${ROL_COLORS[emp.rol]}`} variant="outline">
                              {ROL_LABELS[emp.rol]}
                            </Badge>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(emp)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setBajaConfirm(emp.id)}>
                                <UserX className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {emp.telefono && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{emp.telefono}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Ingreso: {new Date(emp.fechaIngreso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        {emp.notas && (
                          <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">{emp.notas}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Bajas */}
          {showInactivos && inactivos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Bajas ({inactivos.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactivos.map((emp) => (
                  <Card key={emp.id} className="opacity-60 border-dashed">
                    <CardContent className="pt-4 pb-4">
                      <p className="font-semibold line-through text-muted-foreground">{emp.nombre} {emp.apellido}</p>
                      <Badge className="text-xs mt-1 bg-gray-100 text-gray-500" variant="outline">
                        Baja {emp.fechaBaja ? new Date(emp.fechaBaja).toLocaleDateString("es-MX") : ""}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} placeholder="Apellido" />
              </div>
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={form.rol} onValueChange={v => setForm(f => ({ ...f, rol: v as EmpleadoForm["rol"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anfitrion">Anfitrión</SelectItem>
                  <SelectItem value="lider">Líder</SelectItem>
                  <SelectItem value="administrador">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="55 1234 5678" />
              </div>
              {!editId && (
                <div>
                  <Label>Fecha de ingreso</Label>
                  <Input type="date" value={form.fechaIngreso} onChange={e => setForm(f => ({ ...f, fechaIngreso: e.target.value }))} />
                </div>
              )}
            </div>
            <div>
              <Label>Notas internas</Label>
              <Input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? "Guardar cambios" : "Registrar empleado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar baja */}
      <Dialog open={!!bajaConfirm} onOpenChange={() => setBajaConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Dar de baja al empleado?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El empleado quedará inactivo. Puedes verlo en "Ver bajas" pero ya no aparecerá en los registros activos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => bajaConfirm && bajaMut.mutate({ id: bajaConfirm })} disabled={bajaMut.isPending}>
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
