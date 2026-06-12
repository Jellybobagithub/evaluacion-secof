import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Users,
  Search,
  ShieldCheck,
  Building2,
  Edit2,
  UserCheck,
  UserX,
  Crown,
  Store,
  User,
  LogIn,
} from "lucide-react";

const ROLES = [
  { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Crown, desc: "Acceso total: configuración, usuarios, SECOF, sucursales" },
  { value: "owner", label: "Dueño", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Crown, desc: "SECOF, sucursales y dar de alta colaboradores" },
  { value: "manager", label: "Administrador de Tienda", color: "bg-green-100 text-green-700 border-green-200", icon: Store, desc: "SECOF, sucursales y dar de alta colaboradores" },
  { value: "leader", label: "Líder de Tienda", color: "bg-teal-100 text-teal-700 border-teal-200", icon: UserCheck, desc: "Nueva evaluación, historial y plan de acción" },
  { value: "host", label: "Anfitrión", color: "bg-gray-100 text-gray-700 border-gray-200", icon: User, desc: "Solo acceso al dashboard" },
  { value: "user", label: "Usuario", color: "bg-gray-100 text-gray-500 border-gray-200", icon: User, desc: "Solo acceso al dashboard" },
];

const getRoleInfo = (role: string) =>
  ROLES.find(r => r.value === role) ?? ROLES[ROLES.length - 1];

type SucursalRow = { id: number; nombre: string; ciudad: string | null };

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  activo: boolean;
  notas: string | null;
  lastSignedIn: Date;
  createdAt: Date;
  sucursales?: SucursalRow[];
};

export default function AdminUsuarios() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [assigningUser, setAssigningUser] = useState<UserRow | null>(null);
  // IDs de sucursales seleccionadas en el modal (estado local antes de guardar)
  const [selectedSucursalIds, setSelectedSucursalIds] = useState<number[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  const { user: currentUser } = useAuth();
  const currentRole = (currentUser as any)?.role ?? "user";
  const [, navigate] = useLocation();

  // Roles que puede asignar según el rol del usuario actual
  const rolesAsignables = currentRole === "superadmin"
    ? ROLES
    : ROLES.filter(r => ["leader", "host", "user"].includes(r.value));

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.adminUsuarios.list.useQuery();

  const updateRole = trpc.adminUsuarios.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado correctamente");
      utils.adminUsuarios.list.invalidate();
      setEditingUser(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActivo = trpc.adminUsuarios.toggleActivo.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.activo ? "Usuario activado" : "Usuario desactivado");
      utils.adminUsuarios.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const assignSucursal = trpc.adminUsuarios.assignSucursal.useMutation();
  const removeSucursal = trpc.adminUsuarios.removeSucursal.useMutation();

  const users: UserRow[] = (data?.users ?? []) as UserRow[];
  const sucursales: SucursalRow[] = (data?.sucursales ?? []) as SucursalRow[];

  const filtered = users.filter(u => {
    const matchSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditNotas(u.notas ?? "");
  };

  // Abrir modal de asignación con las sucursales ya asignadas preseleccionadas
  const openAssign = (u: UserRow) => {
    const asignadasIds = (u.sucursales ?? []).map(s => s.id);
    setSelectedSucursalIds(asignadasIds);
    setAssigningUser(u);
  };

  // Guardar cambios de asignación: diff entre estado anterior y nuevo
  const handleGuardarAsignacion = async () => {
    if (!assigningUser) return;
    setSavingAssign(true);
    try {
      const anteriores = (assigningUser.sucursales ?? []).map(s => s.id);
      const agregar = selectedSucursalIds.filter(id => !anteriores.includes(id));
      const quitar = anteriores.filter(id => !selectedSucursalIds.includes(id));
      await Promise.all([
        ...agregar.map(sucursalId =>
          assignSucursal.mutateAsync({ userId: assigningUser.id, sucursalId })
        ),
        ...quitar.map(sucursalId =>
          removeSucursal.mutateAsync({ userId: assigningUser.id, sucursalId })
        ),
      ]);
      await utils.adminUsuarios.list.invalidate();
      toast.success("Sucursales asignadas correctamente");
      setAssigningUser(null);
    } catch {
      toast.error("Error al guardar las asignaciones");
    } finally {
      setSavingAssign(false);
    }
  };

  const toggleSucursalSelection = (sucursalId: number) => {
    setSelectedSucursalIds(prev =>
      prev.includes(sucursalId)
        ? prev.filter(id => id !== sucursalId)
        : [...prev, sucursalId]
    );
  };

  // Stats
  const totalActivos = users.filter(u => u.activo).length;
  const byRole = ROLES.slice(0, 5).map(r => ({
    ...r,
    count: users.filter(u => u.role === r.value).length,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Usuarios y Roles
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona los accesos y permisos del equipo Snowtea HQ
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {byRole.map(r => (
            <Card key={r.value} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{r.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              <SelectItem value="all">Todos los roles</SelectItem>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Users table */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {filtered.length} usuario{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              {" "}· {totalActivos} activo{totalActivos !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Cargando usuarios...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No se encontraron usuarios con los filtros actuales.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(u => {
                  const roleInfo = getRoleInfo(u.role);
                  const RoleIcon = roleInfo.icon;
                  const sucursalesAsignadas = u.sucursales ?? [];
                  return (
                    <div
                      key={u.id}
                      className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors ${!u.activo ? "opacity-50" : ""}`}
                    >
                      {/* Avatar */}
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                          {u.name?.charAt(0).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">
                            {u.name ?? "Sin nombre"}
                          </span>
                          {!u.activo && (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email ?? "Sin correo"} <span className="text-[10px] text-muted-foreground/60 font-mono">(ID: {u.id})</span></p>
                        {/* Sucursales asignadas */}
                        {sucursalesAsignadas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sucursalesAsignadas.map(s => (
                              <span key={s.id} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                <Building2 className="w-2.5 h-2.5" />
                                {s.nombre}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Role badge */}
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${roleInfo.color}`}>
                          <RoleIcon className="w-3 h-3" />
                          {roleInfo.label}
                        </span>
                      </div>

                      {/* Last sign in */}
                      <div className="hidden md:block text-xs text-muted-foreground shrink-0 w-28 text-right">
                        {new Date(u.lastSignedIn).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openAssign(u)}
                          title="Asignar sucursales"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(u)}
                          title="Editar rol"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-8 p-0 ${u.activo ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                          onClick={() => toggleActivo.mutate({ userId: u.id, activo: !u.activo })}
                          title={u.activo ? "Desactivar usuario" : "Activar usuario"}
                        >
                          {u.activo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </Button>
                        {currentRole === "superadmin" && u.id !== (currentUser as any)?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-700"
                            title="Ingresar como este usuario"
                            onClick={async () => {
                              const prev = document.cookie;
                              localStorage.setItem("secof_prev_session", prev);
                              localStorage.setItem("secof_impersonating", JSON.stringify({ nombre: u.name, email: u.email, role: u.role }));
                              const r = await fetch("/api/auth/impersonate", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: u.id }),
                                credentials: "include",
                              });
                              if (r.ok) {
                                window.location.href = "/";
                              } else {
                                toast.error("No se pudo impersonar");
                              }
                            }}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Roles legend */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Descripción de Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.slice(0, 6).map(r => (
                <div key={r.value} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium shrink-0 ${r.color}`}>
                    <r.icon className="w-3 h-3" />
                    {r.label}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal: Editar rol */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Editar Rol de Usuario
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {editingUser.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{editingUser.name ?? "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{editingUser.email ?? "Sin correo"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rol asignado</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {rolesAsignables.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-xs text-muted-foreground">{r.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas internas (opcional)</Label>
                <Textarea
                  placeholder="Ej: Administrador de la tienda Monterrey Centro..."
                  value={editNotas}
                  onChange={e => setEditNotas(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editingUser) return;
                updateRole.mutate({ userId: editingUser.id, role: editRole as any, notas: editNotas });
              }}
              disabled={updateRole.isPending}
            >
              {updateRole.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar sucursales */}
      <Dialog open={!!assigningUser} onOpenChange={() => setAssigningUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Asignar Sucursales
            </DialogTitle>
          </DialogHeader>
          {assigningUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {assigningUser.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{assigningUser.name ?? "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{getRoleInfo(assigningUser.role).label}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Sucursales disponibles
                  {selectedSucursalIds.length > 0 && (
                    <span className="ml-2 text-xs text-primary font-normal">
                      ({selectedSucursalIds.length} seleccionada{selectedSucursalIds.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </Label>
                {sucursales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay sucursales registradas.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {sucursales.map(s => {
                      const isChecked = selectedSucursalIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? "bg-primary/5 border-primary/30" : "hover:bg-muted/30"}`}
                          onClick={() => toggleSucursalSelection(s.id)}
                        >
                          <Checkbox
                            id={`s-${s.id}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleSucursalSelection(s.id)}
                          />
                          <label htmlFor={`s-${s.id}`} className="flex-1 cursor-pointer">
                            <p className="text-sm font-medium">{s.nombre}</p>
                            {s.ciudad && <p className="text-xs text-muted-foreground">{s.ciudad}</p>}
                          </label>
                          {isChecked && (
                            <span className="text-xs text-primary font-medium">✓ Asignada</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona las sucursales y presiona Guardar para aplicar los cambios.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssigningUser(null)} disabled={savingAssign}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarAsignacion} disabled={savingAssign}>
              {savingAssign ? "Guardando..." : "Guardar asignación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
