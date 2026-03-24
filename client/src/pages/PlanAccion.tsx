import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlusCircle, Target, Search, Lightbulb, Wrench, CheckCircle2, Clock, Pencil, Trash2, Calendar, User, Building2 } from "lucide-react";
import { toast } from "sonner";

const ESTADO_COLORS = {
  pendiente: "bg-amber-100 text-amber-700",
  en_proceso: "bg-blue-100 text-blue-700",
  completado: "bg-emerald-100 text-emerald-700",
};

const ESTADO_LABELS = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  completado: "Completado",
};

const AREAS = [
  "Control", "Higiene", "Hospitalidad", "Imagen", "Mantenimiento", "Operación",
  "Puntos Generales", "Entrada al Local", "Producción", "Máquina de Hielo",
  "Equipo", "Operación del Negocio", "Instalaciones", "Higiene Operativa",
  "Ciclo de Servicio", "Documentación",
];

type FormData = {
  evaluacionId: string;
  sucursalId: string;
  area: string;
  queMalEsta: string;
  objetivo: string;
  causaRaiz: string;
  comoResolver: string;
  fechaCompromiso: string;
  costo: string;
  responsable: string;
  revisor: string;
};

const EMPTY_FORM: FormData = {
  evaluacionId: "",
  sucursalId: "",
  area: "",
  queMalEsta: "",
  objetivo: "",
  causaRaiz: "",
  comoResolver: "",
  fechaCompromiso: "",
  costo: "",
  responsable: "",
  revisor: "",
};

export default function PlanAccion() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const evalIdParam = params.get("evaluacionId");
  const sucursalIdParam = params.get("sucursalId");

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
    evaluacionId: evalIdParam ?? "",
    sucursalId: sucursalIdParam ?? "",
  });
  const [filtroSucursal, setFiltroSucursal] = useState<string>(sucursalIdParam ?? "all");
  const [filtroEstado, setFiltroEstado] = useState<string>("all");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({});
  const { data: planes = [], refetch } = trpc.planAccion.list.useQuery({
    sucursalId: filtroSucursal !== "all" ? parseInt(filtroSucursal) : undefined,
  });

  const createMutation = trpc.planAccion.create.useMutation({
    onSuccess: () => { toast.success("Acción creada"); refetch(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al crear"),
  });

  const updateMutation = trpc.planAccion.update.useMutation({
    onSuccess: () => { toast.success("Acción actualizada"); refetch(); setShowDialog(false); resetForm(); },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteMutation = trpc.planAccion.delete.useMutation({
    onSuccess: () => { toast.success("Acción eliminada"); refetch(); },
    onError: () => toast.error("Error al eliminar"),
  });

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
  }

  function handleSubmit() {
    if (!form.sucursalId) { toast.error("Selecciona una sucursal"); return; }
    if (!form.area) { toast.error("Selecciona un área"); return; }
    if (!form.evaluacionId) { toast.error("Selecciona una evaluación"); return; }

    const data = {
      evaluacionId: parseInt(form.evaluacionId),
      sucursalId: parseInt(form.sucursalId),
      area: form.area,
      queMalEsta: form.queMalEsta || undefined,
      objetivo: form.objetivo || undefined,
      causaRaiz: form.causaRaiz || undefined,
      comoResolver: form.comoResolver || undefined,
      fechaCompromiso: form.fechaCompromiso || undefined,
      costo: form.costo ? parseFloat(form.costo) : undefined,
      responsable: form.responsable || undefined,
      revisor: form.revisor || undefined,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  function openEdit(p: typeof planes[0]) {
    setEditId(p.id);
    setForm({
      evaluacionId: String(p.evaluacionId ?? ""),
      sucursalId: String(p.sucursalId),
      area: p.area,
      queMalEsta: p.queMalEsta ?? "",
      objetivo: p.objetivo ?? "",
      causaRaiz: p.causaRaiz ?? "",
      comoResolver: p.comoResolver ?? "",
      fechaCompromiso: p.fechaCompromiso ? new Date(p.fechaCompromiso).toISOString().split("T")[0] : "",
      costo: p.costo ? String(p.costo) : "",
      responsable: p.responsable ?? "",
      revisor: p.revisor ?? "",
    });
    setShowDialog(true);
  }

  const filteredPlanes = planes.filter(p => {
    if (filtroEstado !== "all" && p.estado !== filtroEstado) return false;
    return true;
  });

  const pendientes = planes.filter(p => p.estado === "pendiente").length;
  const enProceso = planes.filter(p => p.estado === "en_proceso").length;
  const completados = planes.filter(p => p.estado === "completado").length;

  const evalsByCurrentSucursal = evaluaciones.filter(e =>
    e.estado === "completada" && (form.sucursalId ? e.sucursalId === parseInt(form.sucursalId) : true)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Acción</h1>
          <p className="text-muted-foreground mt-1">Metodología EXPLORAR · ANALIZAR · RESOLVER · SEGUIMIENTO</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Nueva Acción
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendientes}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{enProceso}</p>
            <p className="text-xs text-muted-foreground mt-1">En Proceso</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{completados}</p>
            <p className="text-xs text-muted-foreground mt-1">Completados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filtroSucursal} onValueChange={setFiltroSucursal}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {sucursales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_proceso">En Proceso</SelectItem>
            <SelectItem value="completado">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Plan cards */}
      {filteredPlanes.length === 0 ? (
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No hay acciones registradas</p>
            <p className="text-sm text-muted-foreground mt-1">Crea un plan de acción para mejorar las áreas identificadas</p>
            <Button className="mt-4 gap-2" onClick={() => { resetForm(); setShowDialog(true); }}>
              <PlusCircle className="h-4 w-4" />
              Nueva Acción
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPlanes.map(plan => {
            const sucursal = sucursales.find(s => s.id === plan.sucursalId);
            return (
              <Card key={plan.id} className="border-0 shadow-sm bg-white">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge className={ESTADO_COLORS[plan.estado as keyof typeof ESTADO_COLORS]}>
                        {ESTADO_LABELS[plan.estado as keyof typeof ESTADO_LABELS]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{plan.area}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {plan.estado !== "completado" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: plan.id, estado: plan.estado === "pendiente" ? "en_proceso" : "completado" })}>
                          {plan.estado === "pendiente" ? "Iniciar" : "Completar"}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm("¿Eliminar esta acción?")) deleteMutation.mutate({ id: plan.id }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plan.queMalEsta && (
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Search className="h-3 w-3 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explorar</p>
                          <p className="text-sm mt-0.5">{plan.queMalEsta}</p>
                        </div>
                      </div>
                    )}
                    {plan.causaRaiz && (
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Lightbulb className="h-3 w-3 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analizar</p>
                          <p className="text-sm mt-0.5">{plan.causaRaiz}</p>
                        </div>
                      </div>
                    )}
                    {plan.comoResolver && (
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Wrench className="h-3 w-3 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resolver</p>
                          <p className="text-sm mt-0.5">{plan.comoResolver}</p>
                        </div>
                      </div>
                    )}
                    {plan.objetivo && (
                      <div className="flex gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seguimiento</p>
                          <p className="text-sm mt-0.5">{plan.objetivo}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                    {sucursal && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{sucursal.nombre}</span>}
                    {plan.responsable && <span className="flex items-center gap-1"><User className="h-3 w-3" />{plan.responsable}</span>}
                    {plan.fechaCompromiso && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(plan.fechaCompromiso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                    {plan.costo != null && <span>Costo: ${plan.costo.toLocaleString("es-MX")}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Acción" : "Nueva Acción de Mejora"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sucursal *</Label>
                <Select value={form.sucursalId} onValueChange={v => setForm(f => ({ ...f, sucursalId: v, evaluacionId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {sucursales.filter(s => s.activa).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Evaluación *</Label>
                <Select value={form.evaluacionId} onValueChange={v => setForm(f => ({ ...f, evaluacionId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {evalsByCurrentSucursal.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {new Date(e.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · {(e.porcentajeGeneral ?? 0).toFixed(1)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Área de Mejora *</Label>
              <Select value={form.area} onValueChange={v => setForm(f => ({ ...f, area: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 border rounded-lg p-4 bg-red-50/30">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />EXPLORAR — ¿Qué está mal?</p>
              <Textarea placeholder="Describe el problema identificado..." value={form.queMalEsta} onChange={e => setForm(f => ({ ...f, queMalEsta: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-1 gap-4 border rounded-lg p-4 bg-amber-50/30">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" />ANALIZAR — Causa raíz</p>
              <Textarea placeholder="¿Por qué ocurre este problema?" value={form.causaRaiz} onChange={e => setForm(f => ({ ...f, causaRaiz: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-1 gap-4 border rounded-lg p-4 bg-blue-50/30">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />RESOLVER — ¿Cómo resolverlo?</p>
              <Textarea placeholder="Acciones concretas para resolver el problema..." value={form.comoResolver} onChange={e => setForm(f => ({ ...f, comoResolver: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-1 gap-4 border rounded-lg p-4 bg-emerald-50/30">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />SEGUIMIENTO — Objetivo</p>
              <Textarea placeholder="¿Cómo verificarás que se resolvió?" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Input placeholder="Nombre del responsable" value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Revisor</Label>
                <Input placeholder="Nombre del revisor" value={form.revisor} onChange={e => setForm(f => ({ ...f, revisor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha Compromiso</Label>
                <Input type="date" value={form.fechaCompromiso} onChange={e => setForm(f => ({ ...f, fechaCompromiso: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Costo Estimado ($)</Label>
                <Input type="number" placeholder="0.00" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "Guardar cambios" : "Crear acción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
