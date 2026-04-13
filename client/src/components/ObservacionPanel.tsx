/**
 * Panel de Actividades bajo Observación (Sistema de Credibilidad)
 * Usado por el dueño/manager para activar/resolver observaciones.
 * Usado por el líder para ver qué actividades requieren evidencia forzada.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Eye, EyeOff, CheckCircle2, AlertTriangle, History,
  ChevronDown, ChevronUp, Plus
} from "lucide-react";

// Catálogo de actividades (claves comunes del sistema)
const ACTIVIDADES_CATALOGO = [
  // Diarias
  { clave: 'D1',  nombre: 'Limpieza de barras de cocina y tarja' },
  { clave: 'D2',  nombre: 'Limpieza de área de calientes y caja' },
  { clave: 'D3',  nombre: 'Limpieza de motores y pantalla de cocina' },
  { clave: 'D4',  nombre: 'Limpieza de jarabes y todo lo que hay dentro de la jardinera' },
  { clave: 'D5',  nombre: 'Limpieza de selladora' },
  { clave: 'D6',  nombre: 'Limpieza de electrónicos de caja' },
  { clave: 'D7',  nombre: 'Limpieza de acrílicos' },
  { clave: 'D8',  nombre: 'Limpieza de instant pot' },
  { clave: 'D9',  nombre: 'Limpieza de trapos con jabón' },
  { clave: 'D10', nombre: 'Tirar la basura en los contenedores de la plaza' },
  { clave: 'D11', nombre: 'Armar shoots limpios' },
  { clave: 'D12', nombre: 'Hacer corte de caja y bitácora' },
  { clave: 'D13', nombre: 'Barrer y trapear' },
  { clave: 'D14', nombre: 'Lavar y acomodar los trastes' },
  { clave: 'D15', nombre: 'Lavar, secar y rellenar contenedores de polvo, tés y jarabes' },
  { clave: 'D16', nombre: 'Lavar tapones de los shoots' },
  { clave: 'D17', nombre: 'Limpiar estructura de popotes, vasos, toppings, servilletero y cajas de área de cobro' },
  { clave: 'D18', nombre: 'Limpiar el carrito' },
  // Semanales isla
  { clave: 'S1',  nombre: 'Tallar el piso' },
  { clave: 'S2',  nombre: 'Limpiar paredes de la isla' },
  { clave: 'S3',  nombre: 'Limpiar televisores' },
  { clave: 'S4',  nombre: 'Limpieza de barras por dentro (2 veces a la semana)' },
  { clave: 'S5',  nombre: 'Lavar cafetera con ácido cítrico' },
  { clave: 'S6',  nombre: 'Lavar máquina de hielos y filtros' },
  { clave: 'S7',  nombre: 'Lavar tapetes de secado de trastes' },
  { clave: 'S8',  nombre: 'Lavar red wash' },
  { clave: 'S9',  nombre: 'Lavar trapeador y recogedor' },
  { clave: 'S10', nombre: 'Lavar botes de basura (2 veces a la semana)' },
  { clave: 'S11', nombre: 'Lavar llave de contenedor de la base (2 veces a la semana)' },
  { clave: 'S12', nombre: 'Limpiar sillas' },
  { clave: 'S13', nombre: 'Lavar refrigerador' },
  { clave: 'S14', nombre: 'Barrer y trapear bodega' },
  { clave: 'S15', nombre: 'Limpiar isla por fuera' },
  // Mensuales
  { clave: 'M1',  nombre: 'Limpiar parte superior de la estructura de la isla' },
  { clave: 'M2',  nombre: 'Limpiar selladora de vaso por dentro' },
  { clave: 'M3',  nombre: 'Limpiar cajas de bodega' },
  { clave: 'M4',  nombre: 'Lavar el contenedor de yunnan de bodega' },
];

interface ObservacionPanelProps {
  sucursalId: number;
}

export default function ObservacionPanel({ sucursalId }: ObservacionPanelProps) {
  const { user } = useAuth();
  const canManage = ["owner", "manager", "superadmin"].includes(user?.role ?? "");

  const [showActivar, setShowActivar] = useState(false);
  const [showResolver, setShowResolver] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [actividadClave, setActividadClave] = useState("");
  const [motivoActivacion, setMotivoActivacion] = useState("");
  const [notaResolucion, setNotaResolucion] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Queries
  const { data: activas = [], refetch } = trpc.observacion.listar.useQuery(
    { sucursalId, soloActivas: true }
  );
  const { data: historialData = [] } = trpc.observacion.historial.useQuery(
    { sucursalId },
    { enabled: showHistorial }
  );
  const { data: resumen = [] } = trpc.observacion.resumenPorActividad.useQuery(
    { sucursalId }
  );

  // Mutations
  const activarMut = trpc.observacion.activar.useMutation({
    onSuccess: () => {
      toast.success("Actividad puesta bajo observación. El equipo fue notificado.");
      setShowActivar(false);
      setActividadClave(""); setMotivoActivacion("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const resolverMut = trpc.observacion.resolver.useMutation({
    onSuccess: () => {
      toast.success("Observación resuelta. Ya no se pedirá evidencia forzada.");
      setShowResolver(false);
      setNotaResolucion(""); setSelectedId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function getNombreActividad(clave: string): string {
    return ACTIVIDADES_CATALOGO.find(a => a.clave === clave)?.nombre ?? clave;
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-left"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Eye className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-sm font-semibold text-amber-800">
                Actividades bajo Observación
              </CardTitle>
              {activas.length > 0 && (
                <Badge className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0">
                  {activas.length} activa{activas.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-amber-500" /> : <ChevronUp className="w-3.5 h-3.5 text-amber-500" />}
            </button>
            <div className="flex gap-1.5">
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={() => setShowHistorial(!showHistorial)}
              >
                <History className="w-3.5 h-3.5 mr-1" /> Historial
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowActivar(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Activar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {!collapsed && (
          <CardContent className="p-3">
            {activas.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">Sin observaciones activas</p>
                <p className="text-xs text-slate-400 mt-1">
                  Todas las actividades tienen credibilidad normal.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activas.map((obs: any) => (
                  <div key={obs.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-sm font-semibold text-amber-800">
                            {getNombreActividad(obs.actividadClave)}
                          </span>
                          <Badge className="bg-amber-200 text-amber-700 text-xs px-1.5 py-0">
                            {obs.actividadClave}
                          </Badge>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          📋 {obs.motivoActivacion}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Activada el {new Date(obs.activadaAt).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </p>
                        <div className="mt-2 rounded-md bg-white border border-amber-200 px-2 py-1.5 text-xs text-amber-800">
                          🔒 <strong>Evidencia fotográfica obligatoria</strong> en todos los turnos hasta que se resuelva.
                        </div>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700 shrink-0"
                          onClick={() => { setSelectedId(obs.id); setShowResolver(true); }}
                        >
                          <EyeOff className="w-3.5 h-3.5 mr-1" /> Resolver
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resumen de actividades problemáticas */}
            {resumen.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2">Actividades con más observaciones históricas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {resumen
                    .filter((r: any) => r.totalVeces > 1)
                    .sort((a: any, b: any) => b.totalVeces - a.totalVeces)
                    .slice(0, 5)
                    .map((r: any) => (
                      <div key={r.actividadClave} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <span className="text-xs text-slate-600">{getNombreActividad(r.actividadClave)}</span>
                        <Badge className="bg-slate-200 text-slate-600 text-xs px-1 py-0">{r.totalVeces}x</Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Historial */}
      {showHistorial && (
        <Card>
          <CardHeader className="py-2 px-4 border-b">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Historial de Observaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {historialData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sin historial</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {historialData.map((obs: any) => (
                  <div key={obs.id} className={`flex items-start gap-2 text-xs py-2 border-b border-slate-100 last:border-0`}>
                    {obs.activa
                      ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-700">{getNombreActividad(obs.actividadClave)}</span>
                        <Badge className={`text-xs px-1.5 py-0 ${obs.activa ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {obs.activa ? "Activa" : "Resuelta"}
                        </Badge>
                      </div>
                      <p className="text-slate-500 mt-0.5">{obs.motivoActivacion}</p>
                      {obs.notaResolucion && (
                        <p className="text-emerald-600 mt-0.5">✓ {obs.notaResolucion}</p>
                      )}
                    </div>
                    <span className="text-slate-400 shrink-0">
                      {new Date(obs.activadaAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Activar Observación */}
      <Dialog open={showActivar} onOpenChange={setShowActivar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <Eye className="w-4 h-4" />
              Poner Actividad bajo Observación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              A partir de ahora, esta actividad requerirá <strong>foto de evidencia diaria</strong> en todos los turnos hasta que la resuelvas.
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Actividad</Label>
              <Select value={actividadClave} onValueChange={setActividadClave}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecciona actividad..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVIDADES_CATALOGO.map((a) => (
                    <SelectItem key={a.clave} value={a.clave}>
                      <span className="font-mono text-xs text-slate-400 mr-2">{a.clave}</span>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                ¿Qué encontraste mal? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={motivoActivacion}
                onChange={(e) => setMotivoActivacion(e.target.value)}
                placeholder="Ej: Los acrílicos tenían manchas visibles durante la visita del 4 de abril..."
                className="text-sm min-h-[80px]"
              />
              <p className="text-xs text-slate-400 mt-1">{motivoActivacion.length}/10 caracteres mínimo</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivar(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => activarMut.mutate({ sucursalId, actividadClave, motivoActivacion })}
              disabled={activarMut.isPending || !actividadClave || motivoActivacion.length < 10}
            >
              {activarMut.isPending ? "Activando..." : "Activar Observación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Resolver Observación */}
      <Dialog open={showResolver} onOpenChange={setShowResolver}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Resolver Observación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              Al resolver, se desactiva la evidencia fotográfica obligatoria para esta actividad.
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                ¿Qué validaste en la visita? <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={notaResolucion}
                onChange={(e) => setNotaResolucion(e.target.value)}
                placeholder="Ej: Revisé los acrílicos en persona, están limpios y el equipo demostró el proceso correcto..."
                className="text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolver(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => selectedId && resolverMut.mutate({ id: selectedId, notaResolucion })}
              disabled={resolverMut.isPending || notaResolucion.length < 5}
            >
              {resolverMut.isPending ? "Resolviendo..." : "Marcar como Resuelto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
