import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Building2, PlusCircle, ClipboardList, MapPin, User, Users, UserPlus } from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasRoleAccess } from "@/components/RoleGuard";

export default function SucursalDetalle() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";
  const canManageUsers = hasRoleAccess(role, "owner");

  const [showAsignar, setShowAsignar] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const { data: sucursal } = trpc.sucursales.getById.useQuery({ id });
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({ sucursalId: id });
  const { data: adminData, refetch: refetchAdmin } = trpc.adminUsuarios.list.useQuery(undefined, { enabled: canManageUsers });

  const completadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");

  const promedioGeneral = completadas.length > 0
    ? completadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / completadas.length
    : 0;

  // Usuarios asignados a esta sucursal
  const usuariosAsignados = (adminData?.users ?? []).filter((u: any) =>
    (adminData?.sucursales ?? []).some((s: any) => s.id === id) &&
    u.sucursales?.some((s: any) => s.id === id)
  );

  // Todos los usuarios disponibles para asignar
  const todosUsuarios = (adminData?.users ?? []).filter((u: any) =>
    ["leader", "host", "owner", "manager"].includes(u.role)
  );

  const assignMutation = trpc.adminUsuarios.assignSucursal.useMutation({
    onSuccess: () => { toast.success("Colaborador asignado"); refetchAdmin(); },
    onError: () => toast.error("Error al asignar"),
  });

  const removeMutation = trpc.adminUsuarios.removeSucursal.useMutation({
    onSuccess: () => { toast.success("Colaborador removido"); refetchAdmin(); },
    onError: () => toast.error("Error al remover"),
  });

  function openAsignar() {
    const asignadosIds = usuariosAsignados.map((u: any) => u.id);
    setSelectedUsers(asignadosIds);
    setShowAsignar(true);
  }

  async function handleGuardarAsignacion() {
    const asignadosIds = usuariosAsignados.map((u: any) => u.id);
    const agregar = selectedUsers.filter((uid: number) => !asignadosIds.includes(uid));
    const quitar = asignadosIds.filter((uid: number) => !selectedUsers.includes(uid));
    await Promise.all([
      ...agregar.map(uid => assignMutation.mutateAsync({ userId: uid, sucursalId: id })),
      ...quitar.map((uid: number) => removeMutation.mutateAsync({ userId: uid, sucursalId: id })),
    ]);
    setShowAsignar(false);
  }

  if (!sucursal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/sucursales")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{sucursal.nombre}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {(sucursal.ciudad || sucursal.estado) && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[sucursal.ciudad, sucursal.estado].filter(Boolean).join(", ")}</span>
            )}
            {sucursal.franquiciado && (
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{sucursal.franquiciado}</span>
            )}
          </div>
        </div>
        <Button onClick={() => setLocation(`/evaluacion/nueva?sucursalId=${id}`)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Nueva Evaluación
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{completadas.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Evaluaciones</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{promedioGeneral.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Promedio</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{borradores.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Borradores</p>
          </CardContent>
        </Card>
      </div>

      {/* Colaboradores asignados */}
      {canManageUsers && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Colaboradores Asignados
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openAsignar}>
                <UserPlus className="h-3.5 w-3.5" />
                Gestionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {usuariosAsignados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No hay colaboradores asignados</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openAsignar}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Asignar colaboradores
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usuariosAsignados.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-green-100 text-green-700">
                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.name ?? u.email}</span>
                    <Badge variant="outline" className="text-xs">{u.role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evaluaciones */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Historial de Evaluaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {evaluaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No hay evaluaciones para esta sucursal</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation(`/evaluacion/nueva?sucursalId=${id}`)}>
                Crear evaluación
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {evaluaciones.map(ev => {
                const calif = ev.estado === "completada" ? getCalificacion(ev.porcentajeGeneral ?? 0) : null;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border"
                    onClick={() => setLocation(`/evaluacion/${ev.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
                          </p>
                          <Badge variant={ev.estado === "completada" ? "default" : "secondary"} className="text-xs">
                            {ev.estado === "completada" ? "Completada" : "Borrador"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ev.evaluadorNombre && `Evaluador: ${ev.evaluadorNombre}`}
                        </p>
                      </div>
                    </div>
                    {calif && (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold">{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
                          <p className="text-xs" style={{ color: calif.color }}>{calif.label}</p>
                        </div>
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${ev.porcentajeGeneral ?? 0}%`, backgroundColor: calif.color }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog asignar colaboradores */}
      <Dialog open={showAsignar} onOpenChange={setShowAsignar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gestionar Colaboradores — {sucursal.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto py-2">
            {todosUsuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay colaboradores disponibles para asignar.</p>
            ) : (
              todosUsuarios.map((u: any) => (
                <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={selectedUsers.includes(u.id)}
                    onCheckedChange={checked => {
                      setSelectedUsers((prev: number[]) =>
                        checked ? [...prev, u.id] : prev.filter((uid: number) => uid !== u.id)
                      );
                    }}
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-green-100 text-green-700">
                      {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name ?? u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{u.role}</Badge>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAsignar(false)}>Cancelar</Button>
            <Button onClick={handleGuardarAsignacion} disabled={assignMutation.isPending || removeMutation.isPending}>
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
