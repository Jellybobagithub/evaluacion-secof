import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, PlusCircle, MapPin, User, ClipboardList, Pencil, Phone, Lock, Unlock, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCalificacion } from "../../../shared/evaluacionData";

type FormState = {
  nombre: string; ciudad: string; estado: string;
  direccion: string; franquiciado: string; telefono: string;
};
const EMPTY_FORM: FormState = { nombre: "", ciudad: "", estado: "", direccion: "", franquiciado: "", telefono: "" };

export default function Sucursales() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = ["superadmin", "owner"].includes(user?.role ?? "");

  const [showDialog, setShowDialog]         = useState(false);
  const [editId, setEditId]                 = useState<number | null>(null);
  const [form, setForm]                     = useState<FormState>(EMPTY_FORM);
  const [cerrarId, setCerrarId]             = useState<number | null>(null);
  const [reactivarId, setReactivarId]       = useState<number | null>(null);
  const [showCerradas, setShowCerradas]     = useState(false);

  const { data: sucursales = [], refetch }      = trpc.sucursales.list.useQuery();
  const { data: todasSucursales = [], refetch: refetchTodas } = trpc.sucursales.listTodas.useQuery(undefined, { enabled: isSuperAdmin });
  const { data: evaluaciones = [] }             = trpc.evaluaciones.list.useQuery({});

  const cerradas = todasSucursales.filter((s: any) => !s.activa);

  const createMutation = trpc.sucursales.create.useMutation({
    onSuccess: () => { toast.success("Sucursal creada"); refetch(); refetchTodas(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al crear"),
  });
  const updateMutation = trpc.sucursales.update.useMutation({
    onSuccess: () => { toast.success("Sucursal actualizada"); refetch(); refetchTodas(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al actualizar"),
  });
  const cerrarMutation = trpc.sucursales.cerrarTienda.useMutation({
    onSuccess: () => { toast.success("Tienda cerrada — el historial se conserva"); refetch(); refetchTodas(); setCerrarId(null); },
    onError: () => toast.error("Error al cerrar tienda"),
  });
  const reactivarMutation = trpc.sucursales.reactivarTienda.useMutation({
    onSuccess: () => { toast.success("Tienda reactivada"); refetch(); refetchTodas(); setReactivarId(null); },
    onError: () => toast.error("Error al reactivar"),
  });

  function resetForm() { setForm(EMPTY_FORM); setEditId(null); }

  function openEdit(s: any, e: React.MouseEvent) {
    e.stopPropagation();
    setEditId(s.id);
    setForm({ nombre: s.nombre, ciudad: s.ciudad ?? "", estado: s.estado ?? "",
      direccion: s.direccion ?? "", franquiciado: s.franquiciado ?? "", telefono: s.telefono ?? "" });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    const payload = { nombre: form.nombre, ciudad: form.ciudad || undefined, estado: form.estado || undefined,
      direccion: form.direccion || undefined, franquiciado: form.franquiciado || undefined, telefono: form.telefono || undefined };
    editId ? updateMutation.mutate({ id: editId, ...payload }) : createMutation.mutate(payload);
  }

  const SucursalCard = ({ s, cerrada = false }: { s: any; cerrada?: boolean }) => {
    const evsS = evaluaciones.filter((e: any) => e.sucursalId === s.id && e.estado === "completada");
    const ultima = evsS[0];
    const calif = ultima ? getCalificacion(ultima.porcentajeGeneral ?? 0) : null;
    return (
      <Card className={`border-0 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden ${cerrada ? "opacity-70" : "cursor-pointer"}`}
        onClick={() => !cerrada && setLocation(`/sucursales/${s.id}`)}>
        <div className={`h-20 w-full flex items-center justify-center ${cerrada ? "bg-gradient-to-br from-gray-100 to-gray-200" : "bg-gradient-to-br from-blue-50 to-blue-100"}`}>
          <Building2 className={`h-10 w-10 ${cerrada ? "text-gray-300" : "text-blue-300"}`} />
        </div>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold leading-tight">{s.nombre}</h3>
              <Badge variant="outline" className={`text-xs mt-1 ${cerrada ? "text-gray-500 border-gray-300" : "text-emerald-600 border-emerald-200"}`}>
                {cerrada ? "Cerrada" : "Activa"}
              </Badge>
            </div>
            {isSuperAdmin && (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                {!cerrada && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={e => openEdit(s, e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!cerrada ? (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    title="Cerrar tienda" onClick={e => { e.stopPropagation(); setCerrarId(s.id); }}>
                    <Lock className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    title="Reactivar tienda" onClick={e => { e.stopPropagation(); setReactivarId(s.id); }}>
                    <Unlock className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {(s.ciudad || s.estado) && (
              <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span>{[s.ciudad, s.estado].filter(Boolean).join(", ")}</span></div>
            )}
            {s.franquiciado && (
              <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" /><span>{s.franquiciado}</span></div>
            )}
            {s.telefono && (
              <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{s.telefono}</span></div>
            )}
            <div className="flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5 shrink-0" /><span>{evsS.length} evaluación{evsS.length !== 1 ? "es" : ""}</span></div>
          </div>
          {calif && ultima && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Última evaluación</span>
                <span className="text-xs font-semibold" style={{ color: calif.color }}>{calif.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ultima.porcentajeGeneral ?? 0}%`, backgroundColor: calif.color }} />
                </div>
                <span className="text-sm font-bold">{(ultima.porcentajeGeneral ?? 0).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-muted-foreground mt-1">Gestiona las franquicias y puntos de venta</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
            <PlusCircle className="h-4 w-4" /> Nueva Sucursal
          </Button>
        )}
      </div>

      {sucursales.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">No hay sucursales activas</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">Agrega una sucursal para comenzar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sucursales.map((s: any) => <SucursalCard key={s.id} s={s} />)}
        </div>
      )}

      {/* Tiendas Cerradas — solo superadmin/owner */}
      {isSuperAdmin && cerradas.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-600"
            onClick={() => setShowCerradas(v => !v)}>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Tiendas Cerradas ({cerradas.length}) — historial conservado
            </div>
            {showCerradas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showCerradas && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-gray-50/50">
              {cerradas.map((s: any) => <SucursalCard key={s.id} s={s} cerrada />)}
            </div>
          )}
        </div>
      )}

      {/* Dialog crear / editar */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Sucursal" : "Nueva Sucursal"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej. Plaza Hidalgo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Ciudad</Label><Input placeholder="Querétaro" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Estado</Label><Input placeholder="Querétaro" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Dirección</Label><Input placeholder="Dirección completa" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Franquiciado</Label><Input placeholder="Nombre" value={form.franquiciado} onChange={e => setForm(f => ({ ...f, franquiciado: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Teléfono</Label><Input placeholder="442 123 4567" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar cerrar tienda */}
      {cerrarId !== null && (() => {
        const s = sucursales.find((x: any) => x.id === cerrarId);
        return (
          <Dialog open onOpenChange={() => setCerrarId(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-600"><Lock className="h-5 w-5" /> Cerrar Tienda</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm">¿Cerrar <strong>{s?.nombre}</strong>?</p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <div className="flex items-start gap-2 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>La tienda <strong>desaparecerá de todos los dashboards</strong> y selectores activos.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Todo el historial (evaluaciones, inventario, reportes) se <strong>conserva intacto</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Puedes <strong>reactivarla</strong> en cualquier momento desde esta sección.</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCerrarId(null)}>Cancelar</Button>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={cerrarMutation.isPending}
                  onClick={() => cerrarMutation.mutate({ id: cerrarId })}>
                  {cerrarMutation.isPending ? "Cerrando..." : "Sí, cerrar tienda"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Dialog confirmar reactivar */}
      {reactivarId !== null && (() => {
        const s = cerradas.find((x: any) => x.id === reactivarId);
        return (
          <Dialog open onOpenChange={() => setReactivarId(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-600"><Unlock className="h-5 w-5" /> Reactivar Tienda</DialogTitle></DialogHeader>
              <p className="text-sm py-2">¿Reactivar <strong>{s?.nombre}</strong>? Volverá a aparecer en dashboards y selectores.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReactivarId(null)}>Cancelar</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={reactivarMutation.isPending}
                  onClick={() => reactivarMutation.mutate({ id: reactivarId })}>
                  {reactivarMutation.isPending ? "Reactivando..." : "Reactivar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
