import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Building2, PlusCircle, ClipboardList, MapPin, User,
  Users, UserPlus, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
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

  // Datos para la gráfica de tendencia SECOF
  const trendData = completadas
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .map((ev, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const delta = prev ? (ev.porcentajeGeneral ?? 0) - (prev.porcentajeGeneral ?? 0) : null;
      return {
        fecha: new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
        porcentaje: parseFloat((ev.porcentajeGeneral ?? 0).toFixed(1)),
        calificacion: getCalificacion(ev.porcentajeGeneral ?? 0).label,
        delta,
        id: ev.id,
      };
    });

  // Usuarios asignados a esta sucursal
  const usuariosAsignados = (adminData?.users ?? []).filter((u: any) =>
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

  // Tooltip personalizado para la gráfica
  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const val = payload[0].value as number;
    const calif = getCalificacion(val);
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-muted-foreground mb-1">{label}</p>
        <p className="font-bold text-lg" style={{ color: calif.color }}>{val}%</p>
        <p className="text-xs" style={{ color: calif.color }}>{calif.label}</p>
      </div>
    );
  }

  if (!sucursal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Última evaluación y delta
  const ultima = completadas[0];
  const penultima = completadas[1];
  const deltaUltima = ultima && penultima
    ? (ultima.porcentajeGeneral ?? 0) - (penultima.porcentajeGeneral ?? 0)
    : null;

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
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[sucursal.ciudad, sucursal.estado].filter(Boolean).join(", ")}
              </span>
            )}
            {sucursal.franquiciado && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {sucursal.franquiciado}
              </span>
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
            <p className="text-2xl font-bold">
              {promedioGeneral > 0
                ? <span style={{ color: getCalificacion(promedioGeneral).color }}>{promedioGeneral.toFixed(1)}%</span>
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Promedio SECOF</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            {ultima ? (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-2xl font-bold" style={{ color: getCalificacion(ultima.porcentajeGeneral ?? 0).color }}>
                    {(ultima.porcentajeGeneral ?? 0).toFixed(1)}%
                  </p>
                  {deltaUltima !== null && (
                    <span className={`text-sm flex items-center gap-0.5 ${deltaUltima > 0 ? "text-emerald-600" : deltaUltima < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {deltaUltima > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : deltaUltima < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      {deltaUltima > 0 ? "+" : ""}{deltaUltima.toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Última evaluación</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-muted-foreground">{borradores.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Borradores</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfica de tendencia SECOF */}
      {trendData.length >= 2 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Tendencia SECOF</CardTitle>
              <Badge variant="outline" className="text-xs">
                {trendData.length} evaluaciones
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={[
                    (dataMin: number) => Math.max(0, Math.floor(dataMin / 10) * 10 - 10),
                    100
                  ]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Líneas de referencia por nivel */}
                <ReferenceLine y={95} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Excelente", position: "right", fontSize: 10, fill: "#16a34a" }} />
                <ReferenceLine y={90} stroke="#2563eb" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Muy Bien", position: "right", fontSize: 10, fill: "#2563eb" }} />
                <ReferenceLine y={80} stroke="#ea580c" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Regular", position: "right", fontSize: 10, fill: "#ea580c" }} />
                <Line
                  type="monotone"
                  dataKey="porcentaje"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const color = getCalificacion(payload.porcentaje).color;
                    return (
                      <circle
                        key={`dot-${payload.id}`}
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={color}
                        stroke="white"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                        onClick={() => setLocation(`/evaluacion/${payload.id}`)}
                      />
                    );
                  }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Haz clic en un punto para ver el detalle de esa evaluación
            </p>
          </CardContent>
        </Card>
      )}

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
