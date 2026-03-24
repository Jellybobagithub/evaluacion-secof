import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Filter, ChevronDown, ChevronRight,
  Eye, EyeOff, AlertTriangle,
} from "lucide-react";

const CATEGORIAS = ["Control", "Higiene", "Hospitalidad", "Imagen", "Mantenimiento", "Operación"] as const;
type Categoria = typeof CATEGORIAS[number];

const CATEGORIA_COLORS: Record<string, string> = {
  Control: "bg-blue-100 text-blue-800",
  Higiene: "bg-green-100 text-green-800",
  Hospitalidad: "bg-purple-100 text-purple-800",
  Imagen: "bg-orange-100 text-orange-800",
  Mantenimiento: "bg-yellow-100 text-yellow-800",
  "Operación": "bg-red-100 text-red-800",
};

type Punto = {
  id: number;
  codigo: string;
  seccionNumero: number;
  seccionNombre: string;
  categoria: string;
  descripcion: string;
  criterio: string | null;
  valor: number;
  orden: number;
  activo: boolean;
};

type FormData = {
  codigo: string;
  seccionNumero: number;
  seccionNombre: string;
  categoria: Categoria;
  descripcion: string;
  criterio: string;
  valor: number;
  orden: number;
  activo: boolean;
};

const EMPTY_FORM: FormData = {
  codigo: "",
  seccionNumero: 1,
  seccionNombre: "Puntos Generales",
  categoria: "Control",
  descripcion: "",
  criterio: "",
  valor: 5,
  orden: 0,
  activo: true,
};

const SECCIONES_NOMBRES: Record<number, string> = {
  1: "Puntos Generales",
  2: "Entrada al Local o Llegada a la Isla",
  3: "Producción",
  4: "Máquina de Hielo / Hielera",
  5: "Equipo",
  6: "Operación del Negocio",
  7: "Instalaciones y Mobiliario",
  8: "Higiene Operativa",
  9: "Ciclo de Servicio",
  10: "Documentación y Legales",
};

export default function AdminPreguntas() {
  const utils = trpc.useUtils();

  // Queries
  const { data: puntos = [], isLoading } = trpc.adminPreguntas.list.useQuery({ soloActivos: false });

  // Mutations
  const createMut = trpc.adminPreguntas.create.useMutation({
    onSuccess: () => { utils.adminPreguntas.list.invalidate(); toast.success("Pregunta creada"); setModalOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.adminPreguntas.update.useMutation({
    onSuccess: () => { utils.adminPreguntas.list.invalidate(); toast.success("Pregunta actualizada"); setModalOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = trpc.adminPreguntas.toggleActivo.useMutation({
    onSuccess: () => { utils.adminPreguntas.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.adminPreguntas.delete.useMutation({
    onSuccess: () => { utils.adminPreguntas.list.invalidate(); toast.success("Pregunta eliminada"); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  // UI state
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterSeccion, setFilterSeccion] = useState<string>("todas");
  const [filterActivo, setFilterActivo] = useState<string>("todas");
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([1]));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Filtered & grouped puntos
  const filtered = useMemo(() => {
    return (puntos as Punto[]).filter(p => {
      const matchSearch = !search || p.descripcion.toLowerCase().includes(search.toLowerCase()) || p.codigo.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategoria === "todas" || p.categoria === filterCategoria;
      const matchSec = filterSeccion === "todas" || p.seccionNumero === Number(filterSeccion);
      const matchActivo = filterActivo === "todas" || (filterActivo === "activos" ? p.activo : !p.activo);
      return matchSearch && matchCat && matchSec && matchActivo;
    });
  }, [puntos, search, filterCategoria, filterSeccion, filterActivo]);

  const grouped = useMemo(() => {
    const map = new Map<number, { nombre: string; puntos: Punto[] }>();
    for (const p of filtered) {
      if (!map.has(p.seccionNumero)) {
        map.set(p.seccionNumero, { nombre: p.seccionNombre, puntos: [] });
      }
      map.get(p.seccionNumero)!.puntos.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const stats = useMemo(() => {
    const all = puntos as Punto[];
    return {
      total: all.length,
      activos: all.filter(p => p.activo).length,
      inactivos: all.filter(p => !p.activo).length,
      secciones: new Set(all.map(p => p.seccionNumero)).size,
    };
  }, [puntos]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: Punto) {
    setEditingId(p.id);
    setForm({
      codigo: p.codigo,
      seccionNumero: p.seccionNumero,
      seccionNombre: p.seccionNombre,
      categoria: p.categoria as Categoria,
      descripcion: p.descripcion,
      criterio: p.criterio ?? "",
      valor: p.valor,
      orden: p.orden,
      activo: p.activo,
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!form.codigo || !form.descripcion) {
      toast.error("Código y descripción son obligatorios");
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  function toggleSection(num: number) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  function expandAll() {
    setExpandedSections(new Set(grouped.map(([n]) => n)));
  }
  function collapseAll() {
    setExpandedSections(new Set());
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administración de Preguntas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona los puntos de evaluación: edita descripciones, criterios, valores y activa/desactiva ítems.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Pregunta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Preguntas", value: stats.total, color: "text-gray-900" },
            { label: "Activas", value: stats.activos, color: "text-green-600" },
            { label: "Inactivas", value: stats.inactivos, color: "text-red-500" },
            { label: "Secciones", value: stats.secciones, color: "text-blue-600" },
          ].map(s => (
            <Card key={s.label} className="text-center py-4">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por código o descripción..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSeccion} onValueChange={setFilterSeccion}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Sección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las secciones</SelectItem>
                  {Object.entries(SECCIONES_NOMBRES).map(([n, nombre]) => (
                    <SelectItem key={n} value={n}>{n}. {nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterActivo} onValueChange={setFilterActivo}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  <SelectItem value="activos">Solo activos</SelectItem>
                  <SelectItem value="inactivos">Solo inactivos</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={expandAll}>Expandir todo</Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar todo</Button>
              </div>
            </div>
            {filtered.length !== (puntos as Punto[]).length && (
              <p className="text-xs text-gray-400 mt-2">
                Mostrando {filtered.length} de {(puntos as Punto[]).length} preguntas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Grouped Table */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Cargando preguntas...</div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No se encontraron preguntas con los filtros aplicados.</div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([secNum, { nombre, puntos: pts }]) => (
              <Card key={secNum} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  onClick={() => toggleSection(secNum)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSections.has(secNum)
                      ? <ChevronDown className="h-4 w-4 text-gray-500" />
                      : <ChevronRight className="h-4 w-4 text-gray-500" />
                    }
                    <span className="font-semibold text-gray-800">
                      {secNum}. {nombre}
                    </span>
                    <Badge variant="secondary" className="text-xs">{pts.length} preguntas</Badge>
                    <span className="text-xs text-gray-400">
                      {pts.filter(p => !p.activo).length > 0 && (
                        <span className="text-red-400">{pts.filter(p => !p.activo).length} inactivas</span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Valor total: {pts.filter(p => p.activo).reduce((s, p) => s + p.valor, 0)} pts
                  </div>
                </button>

                {expandedSections.has(secNum) && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50/50">
                          <TableHead className="w-20">Código</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-32">Categoría</TableHead>
                          <TableHead className="w-20 text-center">Valor</TableHead>
                          <TableHead className="w-20 text-center">Estado</TableHead>
                          <TableHead className="w-24 text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pts.map(p => (
                          <TableRow key={p.id} className={!p.activo ? "opacity-50 bg-gray-50" : ""}>
                            <TableCell className="font-mono text-sm font-medium text-blue-700">
                              {p.codigo}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-800">{p.descripcion}</div>
                              {p.criterio && (
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.criterio}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORIA_COLORS[p.categoria] ?? "bg-gray-100 text-gray-700"}`}>
                                {p.categoria}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-gray-700">{p.valor}</span>
                              <span className="text-xs text-gray-400"> pts</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={p.activo}
                                onCheckedChange={(val) => toggleMut.mutate({ id: p.id, activo: val })}
                                disabled={toggleMut.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openEdit(p)}
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteId(p.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Pregunta" : "Nueva Pregunta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Código <span className="text-red-500">*</span></Label>
                <Input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  placeholder="Ej: PG7, EL19..."
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (puntos) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sección <span className="text-red-500">*</span></Label>
                <Select
                  value={String(form.seccionNumero)}
                  onValueChange={val => setForm(f => ({
                    ...f,
                    seccionNumero: Number(val),
                    seccionNombre: SECCIONES_NOMBRES[Number(val)] ?? f.seccionNombre,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECCIONES_NOMBRES).map(([n, nombre]) => (
                      <SelectItem key={n} value={n}>{n}. {nombre}</SelectItem>
                    ))}
                    <SelectItem value="99">Otra sección...</SelectItem>
                  </SelectContent>
                </Select>
                {form.seccionNumero === 99 && (
                  <Input
                    placeholder="Nombre de la nueva sección"
                    value={form.seccionNombre}
                    onChange={e => setForm(f => ({ ...f, seccionNombre: e.target.value }))}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Categoría <span className="text-red-500">*</span></Label>
                <Select
                  value={form.categoria}
                  onValueChange={val => setForm(f => ({ ...f, categoria: val as Categoria }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="¿Qué se evalúa en este punto?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Criterio de evaluación</Label>
              <Textarea
                value={form.criterio}
                onChange={e => setForm(f => ({ ...f, criterio: e.target.value }))}
                placeholder="¿Cómo se determina si cumple o no cumple?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Orden dentro de la sección</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.orden}
                  onChange={e => setForm(f => ({ ...f, orden: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.activo}
                  onCheckedChange={val => setForm(f => ({ ...f, activo: val }))}
                />
                <Label>{form.activo ? "Activo" : "Inactivo"}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editingId ? "Guardar cambios" : "Crear pregunta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar eliminación
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas eliminar esta pregunta? Esta acción no se puede deshacer.
            Si la pregunta ya fue usada en evaluaciones anteriores, considera <strong>desactivarla</strong> en lugar de eliminarla.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
              disabled={deleteMut.isPending}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
