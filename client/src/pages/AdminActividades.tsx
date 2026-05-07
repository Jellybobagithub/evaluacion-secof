/**
 * Página de administración del catálogo de actividades de limpieza.
 * Solo accesible para superadmin.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, EyeOff, Eye, ListChecks } from "lucide-react";

const CATEGORIA_LABEL: Record<string, string> = {
  D: "Diaria",
  S: "Semanal isla",
  B: "Bodega",
  M: "Mensual",
};

const AREA_LABEL: Record<string, string> = {
  todas: "Todas",
  caja: "Caja",
  preparacion: "Preparación",
  comodin: "Comodín",
};

const AREA_COLOR: Record<string, string> = {
  todas: "bg-slate-100 text-slate-600",
  caja: "bg-sky-100 text-sky-700",
  preparacion: "bg-emerald-100 text-emerald-700",
  comodin: "bg-violet-100 text-violet-700",
};

const CAT_COLOR: Record<string, string> = {
  D: "bg-blue-100 text-blue-700",
  S: "bg-purple-100 text-purple-700",
  B: "bg-amber-100 text-amber-700",
  M: "bg-rose-100 text-rose-700",
};

type Actividad = {
  id: number;
  clave: string;
  descripcion: string;
  categoria: string;
  orden: number | null;
  areaCompatible: string | null;
  activa: boolean;
};

type FormData = {
  id?: number;
  clave: string;
  descripcion: string;
  categoria: "D" | "S" | "B" | "M";
  orden: number;
  areaCompatible: "todas" | "caja" | "preparacion" | "comodin";
  activa: boolean;
};

const emptyForm = (): FormData => ({
  clave: "",
  descripcion: "",
  categoria: "D",
  orden: 0,
  areaCompatible: "todas",
  activa: true,
});

export default function AdminActividades() {
  const utils = trpc.useUtils();
  const { data: actividades = [], isLoading } = trpc.horarios.getCatalogoAdmin.useQuery();

  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("all");
  const [filtroActiva, setFiltroActiva] = useState<string>("activas");

  const crearMut = trpc.horarios.crearActividad.useMutation({
    onSuccess: () => {
      toast.success("Actividad creada correctamente.");
      utils.horarios.getCatalogoAdmin.invalidate();
      setShowDialog(false);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const actualizarMut = trpc.horarios.actualizarActividad.useMutation({
    onSuccess: () => {
      toast.success("Actividad actualizada.");
      utils.horarios.getCatalogoAdmin.invalidate();
      setShowDialog(false);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminarMut = trpc.horarios.eliminarActividad.useMutation({
    onSuccess: () => {
      toast.success("Actividad desactivada.");
      utils.horarios.getCatalogoAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(act: Actividad) {
    setForm({
      id: act.id,
      clave: act.clave,
      descripcion: act.descripcion,
      categoria: act.categoria as "D" | "S" | "B" | "M",
      orden: act.orden ?? 0,
      areaCompatible: (act.areaCompatible ?? "todas") as "todas" | "caja" | "preparacion" | "comodin",
      activa: act.activa,
    });
    setShowDialog(true);
  }

  function openCreate() {
    setForm(emptyForm());
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!form.descripcion.trim()) {
      toast.error("La descripción es obligatoria.");
      return;
    }
    if (form.id) {
      actualizarMut.mutate({
        id: form.id,
        descripcion: form.descripcion,
        categoria: form.categoria,
        orden: form.orden,
        areaCompatible: form.areaCompatible,
        activa: form.activa,
      });
    } else {
      if (!form.clave.trim()) {
        toast.error("La clave es obligatoria.");
        return;
      }
      crearMut.mutate({
        clave: form.clave,
        descripcion: form.descripcion,
        categoria: form.categoria,
        orden: form.orden,
        areaCompatible: form.areaCompatible,
      });
    }
  }

  const filtradas = actividades.filter((a) => {
    if (filtroCategoria !== "all" && a.categoria !== filtroCategoria) return false;
    if (filtroActiva === "activas" && !a.activa) return false;
    if (filtroActiva === "inactivas" && a.activa) return false;
    return true;
  });

  // Agrupar por categoría
  const grupos: Record<string, typeof filtradas> = {};
  for (const a of filtradas) {
    if (!grupos[a.categoria]) grupos[a.categoria] = [];
    grupos[a.categoria].push(a);
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10">
              <ListChecks className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Actividades de Limpieza</h1>
              <p className="text-sm text-slate-400">Gestión del catálogo de actividades</p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nueva Actividad
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-200">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="D">Diarias</SelectItem>
              <SelectItem value="S">Semanales isla</SelectItem>
              <SelectItem value="B">Bodega</SelectItem>
              <SelectItem value="M">Mensuales</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroActiva} onValueChange={setFiltroActiva}>
            <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              <SelectItem value="activas">Activas</SelectItem>
              <SelectItem value="inactivas">Inactivas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-400 ml-auto">
            {filtradas.length} actividad{filtradas.length !== 1 ? "es" : ""}
          </span>
        </div>

        {/* Lista agrupada */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No hay actividades con los filtros seleccionados.</div>
        ) : (
          Object.entries(grupos)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, acts]) => (
              <div key={cat} className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  {CATEGORIA_LABEL[cat] ?? cat}
                </h2>
                <div className="rounded-xl border border-slate-700 overflow-hidden divide-y divide-slate-700/50">
                  {acts.map((act) => (
                    <div
                      key={act.id}
                      className={`flex items-center gap-3 px-4 py-3 ${!act.activa ? "opacity-50" : ""}`}
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 w-10 shrink-0">{act.clave}</span>
                      <span className="flex-1 text-sm text-slate-200">{act.descripcion}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${AREA_COLOR[act.areaCompatible ?? "todas"]}`}>
                        {AREA_LABEL[act.areaCompatible ?? "todas"]}
                      </Badge>
                      <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${CAT_COLOR[act.categoria]}`}>
                        {CATEGORIA_LABEL[act.categoria]}
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                          onClick={() => openEdit(act)}
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className={`h-7 w-7 p-0 ${act.activa ? "text-slate-400 hover:text-red-400" : "text-emerald-400 hover:text-emerald-300"}`}
                          onClick={() => {
                            if (act.activa) {
                              eliminarMut.mutate({ id: act.id });
                            } else {
                              actualizarMut.mutate({
                                id: act.id,
                                descripcion: act.descripcion,
                                categoria: act.categoria as "D" | "S" | "B" | "M",
                                orden: act.orden ?? 0,
                                areaCompatible: (act.areaCompatible ?? "todas") as "todas" | "caja" | "preparacion" | "comodin",
                                activa: true,
                              });
                            }
                          }}
                          title={act.activa ? "Desactivar" : "Reactivar"}
                        >
                          {act.activa ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Dialog: Crear / Editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Actividad" : "Nueva Actividad"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!form.id && (
              <div className="space-y-1.5">
                <Label>Clave (ej: D14, S16)</Label>
                <Input
                  value={form.clave}
                  onChange={(e) => setForm({ ...form, clave: e.target.value.toUpperCase() })}
                  placeholder="D14"
                  className="font-mono"
                  maxLength={10}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Descripción de la actividad"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v as "D" | "S" | "B" | "M" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="D">Diaria</SelectItem>
                    <SelectItem value="S">Semanal isla</SelectItem>
                    <SelectItem value="B">Bodega</SelectItem>
                    <SelectItem value="M">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Área compatible</Label>
                <Select
                  value={form.areaCompatible}
                  onValueChange={(v) => setForm({ ...form, areaCompatible: v as "todas" | "caja" | "preparacion" | "comodin" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="preparacion">Preparación</SelectItem>
                    <SelectItem value="comodin">Comodín</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Orden (número para ordenar dentro de la categoría)</Label>
              <Input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            {form.id && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={form.activa}
                  onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="activa">Activa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={crearMut.isPending || actualizarMut.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {form.id ? "Guardar cambios" : "Crear actividad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
