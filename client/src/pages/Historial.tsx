import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ClipboardList, Calendar, User, Trash2, Eye, TrendingUp, TrendingDown, Minus, PlayCircle, Download, Loader2, Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportEvaluacionPDF } from "@/lib/exportPDF";

export default function Historial() {
  const [, setLocation] = useLocation();
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("all");
  const [exportingId, setExportingId] = useState<number | null>(null);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: evaluaciones = [], refetch } = trpc.evaluaciones.list.useQuery(
    sucursalFiltro !== "all" ? { sucursalId: parseInt(sucursalFiltro) } : {}
  );

  const deleteMutation = trpc.evaluaciones.delete.useMutation({
    onSuccess: () => { toast.success("Evaluación eliminada"); refetch(); },
    onError: () => toast.error("Error al eliminar"),
  });

  const [evalImport, setEvalImport] = useState<{ id: number; sucursalId: number } | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const { data: previewData, isLoading: previewLoading } = trpc.planAccion.previewImportacion.useQuery(
    { sucursalId: evalImport?.sucursalId! },
    { enabled: !!evalImport }
  );

  const importarMutation = trpc.planAccion.importarDesdeEvaluacion.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.creados} acción${data.creados !== 1 ? "es" : ""} creadas en Plan de Acción`);
      setEvalImport(null);
      setSeleccionados(new Set());
    },
    onError: () => toast.error("Error al importar"),
  });

  const togglePunto = (id: string) => setSeleccionados(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleTodos = (ids: string[]) => setSeleccionados(prev => {
    const all = ids.every(id => prev.has(id));
    const next = new Set(prev); ids.forEach(id => all ? next.delete(id) : next.add(id)); return next;
  });

  // Cargar detalle de evaluación para exportar PDF
  const utils = trpc.useUtils();

  async function handleExportPDF(evId: number, sucursalId: number) {
    if (exportingId) return;
    setExportingId(evId);
    toast.info("Cargando datos para el PDF...");
    try {
      const [evDetalle, sucursal] = await Promise.all([
        utils.evaluaciones.getById.fetch({ id: evId }),
        utils.sucursales.getById.fetch({ id: sucursalId }),
      ]);
      if (!evDetalle) {
        toast.error("No se pudo cargar la evaluación");
        return;
      }
      exportEvaluacionPDF(evDetalle, sucursal ? {
        nombre: sucursal.nombre,
        ciudad: sucursal.ciudad ?? undefined,
        estado: sucursal.estado ?? undefined,
        franquiciado: sucursal.franquiciado ?? undefined,
      } : null);
    } catch {
      toast.error("Error al generar el PDF");
    } finally {
      setExportingId(null);
    }
  }

  const completadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");

  // Build trend chart data
  const trendData = completadas
    .slice()
    .reverse()
    .map(ev => ({
      fecha: new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
      porcentaje: parseFloat((ev.porcentajeGeneral ?? 0).toFixed(1)),
      sucursal: sucursales.find(s => s.id === ev.sucursalId)?.nombre ?? "Sucursal",
    }));

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial de Evaluaciones</h1>
          <p className="text-muted-foreground mt-1">Consulta y compara evaluaciones anteriores</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sucursalFiltro} onValueChange={setSucursalFiltro}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las sucursales" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {sucursales.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{completadas.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Completadas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{borradores.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Borradores</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {completadas.length > 0
                ? (completadas.reduce((s, e) => s + (e.porcentajeGeneral ?? 0), 0) / completadas.length).toFixed(1) + "%"
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      {trendData.length >= 2 && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tendencia de Calificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Calificación"]} />
                <Line type="monotone" dataKey="porcentaje" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Evaluaciones list */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Todas las Evaluaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {evaluaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No hay evaluaciones registradas</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/evaluacion/nueva")}>
                Crear evaluación
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {evaluaciones.map((ev) => {
                const sucursal = sucursales.find(s => s.id === ev.sucursalId);
                const calif = ev.estado === "completada" ? getCalificacion(ev.porcentajeGeneral ?? 0) : null;
                // Compare with previous evaluation of same sucursal
                const prevEv = completadas.filter(e => e.sucursalId === ev.sucursalId && e.id !== ev.id && new Date(e.fecha) < new Date(ev.fecha))[0];
                const diff = prevEv && ev.porcentajeGeneral != null && prevEv.porcentajeGeneral != null
                  ? (ev.porcentajeGeneral - prevEv.porcentajeGeneral)
                  : null;

                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{sucursal?.nombre ?? "Sucursal"}</p>
                          <Badge variant={ev.estado === "completada" ? "default" : "secondary"} className="text-xs">
                            {ev.estado === "completada" ? "Completada" : "Borrador"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          {ev.evaluadorNombre && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {ev.evaluadorNombre}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {calif && (
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <p className="text-sm font-bold" style={{ color: calif.color }}>{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
                            {diff !== null && (
                              <span className={`text-xs flex items-center gap-0.5 ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: calif.color }}>{calif.label}</p>
                        </div>
                      )}
                      <div className="flex gap-1">
                        {ev.estado === "completada" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Ver resultado"
                              onClick={() => setLocation(`/evaluacion/${ev.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Descargar PDF"
                              disabled={exportingId === ev.id}
                              onClick={() => handleExportPDF(ev.id, ev.sucursalId)}
                            >
                              {exportingId === ev.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                              title="Crear Plan de Acción"
                              onClick={() => { setEvalImport({ id: ev.id, sucursalId: ev.sucursalId }); setSeleccionados(new Set()); }}
                            >
                              <Target className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {ev.estado === "borrador" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Continuar evaluación"
                            onClick={() => setLocation(`/evaluacion/nueva?evaluacionId=${ev.id}`)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("¿Eliminar esta evaluación?")) deleteMutation.mutate({ id: ev.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

      {/* Dialog Plan de Acción desde evaluación */}
      <Dialog open={!!evalImport} onOpenChange={open => { if (!open) { setEvalImport(null); setSeleccionados(new Set()); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-teal-600" />
              Crear Plan de Acción desde evaluación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {previewLoading && <p className="text-sm text-muted-foreground animate-pulse">Cargando puntos fallidos...</p>}
            {!previewLoading && previewData && (
              <>
                {!previewData.evaluacion ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-amber-700">No se encontró la evaluación.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {new Date(previewData.evaluacion.fecha!).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {(previewData.evaluacion.porcentajeGeneral ?? 0).toFixed(1)}% · {previewData.evaluacion.calificacion}
                        </p>
                      </div>
                      <Badge variant="outline">{previewData.puntosFallidos.length} puntos fallidos</Badge>
                    </div>
                    {previewData.puntosFallidos.length === 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-emerald-700">Sin puntos fallidos — esta evaluación no tiene áreas de mejora.</p>
                      </div>
                    ) : (() => {
                      const porSeccion: Record<string, typeof previewData.puntosFallidos> = {};
                      for (const p of previewData.puntosFallidos) {
                        if (!porSeccion[p.seccion]) porSeccion[p.seccion] = [];
                        porSeccion[p.seccion].push(p);
                      }
                      const todasIds = previewData.puntosFallidos.map(p => p.puntoId);
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Selecciona los puntos a convertir en acciones</p>
                            <button onClick={() => toggleTodos(todasIds)} className="text-xs text-primary hover:underline">
                              {todasIds.every(id => seleccionados.has(id)) ? "Deseleccionar todos" : "Seleccionar todos"}
                            </button>
                          </div>
                          {Object.entries(porSeccion).map(([seccion, puntos]) => {
                            const idsSeccion = puntos.map(p => p.puntoId);
                            const todosSeccion = idsSeccion.every(id => seleccionados.has(id));
                            return (
                              <div key={seccion} className="rounded-lg border overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{seccion}</span>
                                  <button onClick={() => toggleTodos(idsSeccion)} className="text-xs text-primary hover:underline">
                                    {todosSeccion ? "Quitar" : "Todos"}
                                  </button>
                                </div>
                                <div className="divide-y">
                                  {puntos.map(p => (
                                    <label key={p.puntoId} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/20">
                                      <input type="checkbox" checked={seleccionados.has(p.puntoId)}
                                        onChange={() => togglePunto(p.puntoId)} className="mt-0.5 rounded" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-mono font-bold text-muted-foreground">{p.puntoId}</span>
                                          <Badge variant="outline" className="text-[10px] px-1 py-0">{p.categoria}</Badge>
                                        </div>
                                        <p className="text-sm mt-0.5">{p.descripcion}</p>
                                        {p.observacion && <p className="text-xs text-muted-foreground mt-0.5 italic">Obs: {p.observacion}</p>}
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEvalImport(null); setSeleccionados(new Set()); }}>Cancelar</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                if (!evalImport || seleccionados.size === 0) return;
                importarMutation.mutate({
                  evaluacionId: evalImport.id,
                  sucursalId: evalImport.sucursalId,
                  puntosIds: Array.from(seleccionados),
                });
              }}
              disabled={seleccionados.size === 0 || importarMutation.isPending || previewLoading}
            >
              {importarMutation.isPending ? "Creando..." : `Crear ${seleccionados.size} acción${seleccionados.size !== 1 ? "es" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
