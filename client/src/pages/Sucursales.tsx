import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, PlusCircle, MapPin, User, ClipboardList, Pencil, Trash2, Camera, Phone } from "lucide-react";
import { toast } from "sonner";
import { getCalificacion } from "../../../shared/evaluacionData";

type FormState = {
  nombre: string;
  ciudad: string;
  estado: string;
  direccion: string;
  franquiciado: string;
  metaVentasMensual: string;
  telefono: string;
  fotoUrl: string;
};

const EMPTY_FORM: FormState = {
  nombre: "", ciudad: "", estado: "", direccion: "",
  franquiciado: "", metaVentasMensual: "", telefono: "", fotoUrl: "",
};

export default function Sucursales() {
  const [, setLocation] = useLocation();
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: sucursales = [], refetch } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});

  const createMutation = trpc.sucursales.create.useMutation({
    onSuccess: () => { toast.success("Sucursal creada correctamente"); refetch(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al crear la sucursal"),
  });

  const updateMutation = trpc.sucursales.update.useMutation({
    onSuccess: () => { toast.success("Sucursal actualizada"); refetch(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteMutation = trpc.sucursales.delete.useMutation({
    onSuccess: () => { toast.success("Sucursal desactivada"); refetch(); },
    onError: () => toast.error("Error al desactivar"),
  });

  const uploadFotoMutation = trpc.sucursales.uploadFoto.useMutation({
    onSuccess: ({ url }) => {
      setForm(f => ({ ...f, fotoUrl: url }));
      utils.sucursales.list.invalidate();
      toast.success("Foto subida correctamente");
      setUploading(false);
    },
    onError: () => { toast.error("Error al subir la foto"); setUploading(false); },
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
  }

  function openEdit(s: typeof sucursales[0]) {
    setEditId(s.id);
    setForm({
      nombre: s.nombre,
      ciudad: s.ciudad ?? "",
      estado: s.estado ?? "",
      direccion: s.direccion ?? "",
      franquiciado: s.franquiciado ?? "",
      metaVentasMensual: s.metaVentasMensual ? String(s.metaVentasMensual) : "",
      telefono: (s as any).telefono ?? "",
      fotoUrl: (s as any).fotoUrl ?? "",
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    const payload = {
      nombre: form.nombre,
      ciudad: form.ciudad || undefined,
      estado: form.estado || undefined,
      direccion: form.direccion || undefined,
      franquiciado: form.franquiciado || undefined,
      telefono: form.telefono || undefined,
      fotoUrl: form.fotoUrl || undefined,
      metaVentasMensual: form.metaVentasMensual ? parseFloat(form.metaVentasMensual) : undefined,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editId) {
      // Si no hay editId, necesitamos crear primero
      if (!editId) {
        toast.info("Guarda la sucursal primero para poder subir la foto");
        return;
      }
      return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("La foto no debe superar 5MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadFotoMutation.mutate({ sucursalId: editId, base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const activasSucursales = sucursales.filter(s => s.activa);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-muted-foreground mt-1">Gestiona las franquicias y puntos de venta</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Nueva Sucursal
        </Button>
      </div>

      {activasSucursales.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">No hay sucursales registradas</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">Agrega tu primera sucursal para comenzar a realizar evaluaciones.</p>
            <Button className="mt-4 gap-2" onClick={() => { resetForm(); setShowDialog(true); }}>
              <PlusCircle className="h-4 w-4" />
              Agregar Sucursal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activasSucursales.map(s => {
            const evsS = evaluaciones.filter(e => e.sucursalId === s.id && e.estado === "completada");
            const ultima = evsS[0];
            const calif = ultima ? getCalificacion(ultima.porcentajeGeneral ?? 0) : null;
            const fotoUrl = (s as any).fotoUrl as string | undefined;
            return (
              <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white overflow-hidden" onClick={() => setLocation(`/sucursales/${s.id}`)}>
                {/* Foto de portada */}
                {fotoUrl ? (
                  <div className="h-32 w-full overflow-hidden bg-muted">
                    <img src={fotoUrl} alt={s.nombre} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-24 w-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-blue-300" />
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold leading-tight">{s.nombre}</h3>
                      <Badge variant="outline" className="text-xs mt-1 text-emerald-600 border-emerald-200">Activa</Badge>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: s.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {(s.ciudad || s.estado) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{[s.ciudad, s.estado].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {s.franquiciado && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span>{s.franquiciado}</span>
                      </div>
                    )}
                    {(s as any).telefono && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{(s as any).telefono}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      <span>{evsS.length} evaluación{evsS.length !== 1 ? "es" : ""}</span>
                    </div>
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
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Sucursal" : "Nueva Sucursal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Foto */}
            {editId && (
              <div className="space-y-2">
                <Label>Foto de la Sucursal</Label>
                <div className="flex items-center gap-3">
                  {form.fotoUrl ? (
                    <img src={form.fotoUrl} alt="Foto" className="h-20 w-28 object-cover rounded-lg border" />
                  ) : (
                    <div className="h-20 w-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                      <Camera className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      <Camera className="h-3.5 w-3.5" />
                      {uploading ? "Subiendo..." : form.fotoUrl ? "Cambiar foto" : "Subir foto"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG o PNG, máx. 5MB</p>
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFotoChange} />
                </div>
              </div>
            )}
            {!editId && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                Podrás subir la foto de la sucursal después de crearla.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" placeholder="Ej. Plaza Hidalgo" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" placeholder="Ej. Querétaro" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" placeholder="Ej. Querétaro" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" placeholder="Dirección completa" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="franquiciado">Franquiciado</Label>
                <Input id="franquiciado" placeholder="Nombre del franquiciado" value={form.franquiciado} onChange={e => setForm(f => ({ ...f, franquiciado: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="Ej. 442 123 4567" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metaVentasMensual">Meta de Ventas Mensual (MXN)</Label>
              <Input id="metaVentasMensual" type="number" placeholder="Ej. 150000" value={form.metaVentasMensual} onChange={e => setForm(f => ({ ...f, metaVentasMensual: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || uploading}>
              {editId ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
