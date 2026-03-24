import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, PlusCircle, ClipboardList, MapPin, User, Calendar } from "lucide-react";
import { getCalificacion } from "../../../shared/evaluacionData";

export default function SucursalDetalle() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();

  const { data: sucursal } = trpc.sucursales.getById.useQuery({ id });
  const { data: evaluaciones = [] } = trpc.evaluaciones.list.useQuery({ sucursalId: id });

  const completadas = evaluaciones.filter(e => e.estado === "completada");
  const borradores = evaluaciones.filter(e => e.estado === "borrador");

  const promedioGeneral = completadas.length > 0
    ? completadas.reduce((sum, e) => sum + (e.porcentajeGeneral ?? 0), 0) / completadas.length
    : 0;

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
    </div>
  );
}
