/**
 * Página de administración de permisos extra de menú.
 * Solo accesible para superadmin.
 * Permite otorgar acceso a secciones adicionales del menú a usuarios individuales.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, User } from "lucide-react";

// Opciones de secciones del menú que se pueden otorgar como acceso extra
const MENU_ITEMS_OTORGABLES = [
  // Grupo: SECOF
  { id: "secof", label: "Grupo: SECOF (acceso completo)", grupo: "SECOF" },
  { id: "/secof-dashboard", label: "Resumen SECOF", grupo: "SECOF" },
  { id: "/evaluacion/nueva", label: "Nueva Evaluación", grupo: "SECOF" },
  { id: "/historial", label: "Historial de Evaluaciones", grupo: "SECOF" },
  { id: "/comparativa", label: "Comparativa", grupo: "SECOF" },
  { id: "/plan-accion", label: "Plan de Acción", grupo: "SECOF" },
  // Grupo: Ventas
  { id: "ventas", label: "Grupo: Ventas (acceso completo)", grupo: "Ventas" },
  { id: "/reporte-diario", label: "Reporte Diario", grupo: "Ventas" },
  { id: "/ventas", label: "Evolución de Ventas", grupo: "Ventas" },
  // Grupo: Equipo
  { id: "equipo", label: "Grupo: Equipo (acceso completo)", grupo: "Equipo" },
  { id: "/empleados", label: "Empleados", grupo: "Equipo" },
  { id: "/horarios", label: "Horarios Semanales", grupo: "Equipo" },
  { id: "/control-asistencias", label: "Control de Asistencias", grupo: "Equipo" },
  { id: "/kpi-anfitriones", label: "KPIs Anfitriones", grupo: "Equipo" },
  { id: "/kpi-lider", label: "KPIs Líder (Nivel 2)", grupo: "Equipo" },
  { id: "/kpi-admin", label: "KPIs Admin (Nivel 3)", grupo: "Equipo" },
  { id: "/cuadre-vasos", label: "Cuadre de Vasos", grupo: "Equipo" },
  { id: "/inventario", label: "Inventario", grupo: "Equipo" },
  { id: "/supervision", label: "Supervisión de Actividades", grupo: "Equipo" },
  // Grupo: Tiendas
  { id: "tiendas", label: "Grupo: Tiendas (acceso completo)", grupo: "Tiendas" },
  { id: "/sucursales", label: "Lista de Sucursales", grupo: "Tiendas" },
  // Grupo: Colaboradores
  { id: "colaboradores", label: "Grupo: Colaboradores (acceso completo)", grupo: "Colaboradores" },
  { id: "/admin/usuarios", label: "Usuarios y Roles", grupo: "Colaboradores" },
  // Grupo: Configuración
  { id: "configuracion", label: "Grupo: Configuración (acceso completo)", grupo: "Configuración" },
  { id: "/ventas-historicas", label: "Ventas Históricas", grupo: "Configuración" },
  { id: "/avisos-generales", label: "Avisos Generales", grupo: "Configuración" },
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  owner: "Dueño",
  manager: "Admin Tienda",
  leader: "Líder",
  host: "Anfitrión",
  user: "Usuario",
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700",
  owner: "bg-amber-100 text-amber-700",
  manager: "bg-green-100 text-green-700",
  leader: "bg-teal-100 text-teal-700",
  host: "bg-slate-100 text-slate-600",
  user: "bg-gray-100 text-gray-600",
};

export default function AdminMenuPermisos() {
  const utils = trpc.useUtils();
  const { data: permisos = [], isLoading } = trpc.menuPermisos.getTodosPermisos.useQuery();
  const { data: usuariosData } = trpc.adminUsuarios.list.useQuery();
  const usuarios = usuariosData?.users ?? [];

  const [showDialog, setShowDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [filtroUsuario, setFiltroUsuario] = useState<string>("all");

  const otorgarMut = trpc.menuPermisos.otorgarPermiso.useMutation({
    onSuccess: () => {
      toast.success("Permiso otorgado correctamente.");
      utils.menuPermisos.getTodosPermisos.invalidate();
      setShowDialog(false);
      setSelectedUserId("");
      setSelectedMenuItemId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const revocarMut = trpc.menuPermisos.revocarPermiso.useMutation({
    onSuccess: () => {
      toast.success("Permiso revocado.");
      utils.menuPermisos.getTodosPermisos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleOtorgar() {
    if (!selectedUserId || !selectedMenuItemId) {
      toast.error("Selecciona un usuario y una sección.");
      return;
    }
    otorgarMut.mutate({
      userId: parseInt(selectedUserId),
      menuItemId: selectedMenuItemId,
    });
  }

  const getMenuLabel = (id: string) =>
    MENU_ITEMS_OTORGABLES.find(m => m.id === id)?.label ?? id;

  // Agrupar permisos por usuario
  const permisosFiltered = filtroUsuario === "all"
    ? permisos
    : permisos.filter(p => p.userId === parseInt(filtroUsuario));

  const permisosAgrupados: Record<number, typeof permisos> = {};
  for (const p of permisosFiltered) {
    if (!permisosAgrupados[p.userId]) permisosAgrupados[p.userId] = [];
    permisosAgrupados[p.userId].push(p);
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Permisos de Menú</h1>
              <p className="text-sm text-slate-400">Acceso extra a secciones del menú por usuario</p>
            </div>
          </div>
          <Button
            onClick={() => setShowDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Otorgar Permiso
          </Button>
        </div>

        {/* Filtro por usuario */}
        <div className="flex items-center gap-3">
          <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
            <SelectTrigger className="w-64 bg-slate-800 border-slate-700 text-slate-200">
              <SelectValue placeholder="Filtrar por usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {Object.entries(permisosAgrupados).map(([uid, ps]) => (
                <SelectItem key={uid} value={uid}>
                  {ps[0]?.userName ?? `Usuario #${uid}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-400 ml-auto">
            {permisosFiltered.length} permiso{permisosFiltered.length !== 1 ? "s" : ""} activo{permisosFiltered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Lista de permisos agrupados por usuario */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : Object.keys(permisosAgrupados).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No hay permisos extra configurados.</p>
              <p className="text-slate-500 text-sm mt-1">
                Los usuarios solo ven las secciones que permite su rol base.
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(permisosAgrupados).map(([uid, ps]) => {
            const p0 = ps[0];
            return (
              <Card key={uid} className="border-slate-700">
                <CardHeader className="py-3 px-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold text-slate-200">
                        {p0?.userName ?? `Usuario #${uid}`}
                      </CardTitle>
                      <p className="text-xs text-slate-400">{p0?.userEmail}</p>
                    </div>
                    <Badge className={`text-xs ${ROLE_COLORS[p0?.userRole ?? "user"]}`}>
                      {ROLE_LABELS[p0?.userRole ?? "user"] ?? p0?.userRole}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    {ps.map(perm => (
                      <div key={perm.id} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
                        <span className="flex-1 text-sm text-slate-300">{getMenuLabel(perm.menuItemId)}</span>
                        <Badge className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0">
                          {perm.menuItemId}
                        </Badge>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                          onClick={() => revocarMut.mutate({ id: perm.id })}
                          title="Revocar permiso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog: Otorgar Permiso */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
              Otorgar Permiso Extra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Usuario</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario..." />
                </SelectTrigger>
                <SelectContent>
                  {(usuarios as any[]).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name ?? u.email ?? `#${u.id}`}
                      {u.role && (
                        <span className="ml-2 text-xs text-slate-400">
                          ({ROLE_LABELS[u.role] ?? u.role})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sección del menú</Label>
              <Select value={selectedMenuItemId} onValueChange={setSelectedMenuItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sección..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    MENU_ITEMS_OTORGABLES.reduce((acc, item) => {
                      if (!acc[item.grupo]) acc[item.grupo] = [];
                      acc[item.grupo].push(item);
                      return acc;
                    }, {} as Record<string, typeof MENU_ITEMS_OTORGABLES>)
                  ).map(([grupo, items]) => (
                    <div key={grupo}>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {grupo}
                      </div>
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs text-purple-700">
              <strong>Nota:</strong> Este permiso da acceso <em>adicional</em> al usuario, más allá de lo que permite su rol base. No reemplaza el rol.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleOtorgar}
              disabled={otorgarMut.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Otorgar acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
