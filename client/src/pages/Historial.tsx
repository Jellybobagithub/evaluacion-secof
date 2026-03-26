import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ClipboardList, Calendar, User, Trash2, Eye, TrendingUp, TrendingDown, Minus, PlayCircle, Download, Loader2 } from "lucide-react";
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
            <SelectContent>
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
  );
}
