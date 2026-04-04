/**
 * Módulo de Preparaciones de Recetas
 * Se integra en Mi Turno y en la vista del Líder/Manager.
 * Permite registrar preparaciones, ver countdown de vencimiento y reportar incidencias.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FlaskConical, Clock, AlertTriangle, CheckCircle2,
  Plus, XCircle, ChevronDown, ChevronUp, History
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Semaforo = "verde" | "amarillo" | "rojo" | "vencida";

const SEMAFORO_STYLES: Record<Semaforo, { bg: string; border: string; text: string; badge: string }> = {
  verde:   { bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  amarillo:{ bg: "bg-amber-50",    border: "border-amber-200",   text: "text-amber-700",   badge: "bg-amber-100 text-amber-700" },
  rojo:    { bg: "bg-red-50",      border: "border-red-300",     text: "text-red-700",     badge: "bg-red-100 text-red-700" },
  vencida: { bg: "bg-slate-100",   border: "border-slate-300",   text: "text-slate-500",   badge: "bg-slate-200 text-slate-600" },
};

const INCIDENCIA_LABELS: Record<string, string> = {
  sin_preparacion: "Sin preparación disponible",
  vencida_en_uso:  "Producto vencido en uso",
  fuera_de_tiempo: "Sin tiempo de preparar antes del cierre",
  desperdicio:     "Desperdicio (vencida sin usar)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCountdown(minutos: number): string {
  if (minutos <= 0) return "Vencida";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatHora(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface PreparacionesProps {
  sucursalId: number;
  turnoId?: number;
  empleadoId?: number;
  modo?: "turno" | "historial"; // turno = vista del empleado, historial = vista del líder
}

export default function Preparaciones({ sucursalId, turnoId, empleadoId, modo = "turno" }: PreparacionesProps) {
  const [showNueva, setShowNueva] = useState(false);
  const [showIncidencia, setShowIncidencia] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [preparacionSeleccionada, setPreparacionSeleccionada] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Form nueva preparación
  const [receta, setReceta] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [preparadaAt, setPreparadaAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  });

  // Form incidencia
  const [incidenciaTipo, setIncidenciaTipo] = useState("");
  const [incidenciaNota, setIncidenciaNota] = useState("");
  const [incidenciaReceta, setIncidenciaReceta] = useState("");

  // Queries
  const { data: catalogo = [] } = trpc.preparaciones.catalogo.useQuery();
  const { data: activas = [], refetch: refetchActivas } = trpc.preparaciones.activas.useQuery(
    { sucursalId },
    { refetchInterval: 60000 } // refrescar cada minuto para el countdown
  );
  const { data: historial = [] } = trpc.preparaciones.historial.useQuery(
    { sucursalId, soloIncidencias: false },
    { enabled: showHistorial }
  );

  // Mutations
  const crearMut = trpc.preparaciones.crear.useMutation({
    onSuccess: () => {
      toast.success("Preparación registrada");
      setShowNueva(false);
      setReceta(""); setCantidad("");
      refetchActivas();
    },
    onError: (e) => toast.error(e.message),
  });

  const consumirMut = trpc.preparaciones.marcarConsumida.useMutation({
    onSuccess: () => { toast.success("Marcada como consumida"); refetchActivas(); },
    onError: (e) => toast.error(e.message),
  });

  const incidenciaMut = trpc.preparaciones.registrarIncidencia.useMutation({
    onSuccess: () => {
      toast.success("Incidencia registrada y notificada al dueño");
      setShowIncidencia(false);
      setIncidenciaTipo(""); setIncidenciaNota(""); setIncidenciaReceta("");
      refetchActivas();
    },
    onError: (e) => toast.error(e.message),
  });

  // Receta seleccionada en el form
  const recetaConfig = useMemo(() => catalogo.find(c => c.clave === receta), [catalogo, receta]);

  // Alertas: preparaciones que están por vencer y tienen alerta activa
  const alertas = useMemo(() =>
    activas.filter((p: any) => p.alertaActiva && (p.semaforo === "rojo" || p.semaforo === "vencida")),
    [activas]
  );

  function handleNueva() {
    if (!receta || !cantidad) { toast.error("Selecciona receta y cantidad"); return; }
    crearMut.mutate({
      sucursalId,
      turnoId,
      empleadoId,
      receta: receta as any,
      cantidad,
      preparadaAt: new Date(preparadaAt),
    });
  }

  function handleIncidencia() {
    if (!incidenciaReceta || !incidenciaTipo || incidenciaNota.length < 5) {
      toast.error("Completa todos los campos"); return;
    }
    incidenciaMut.mutate({
      sucursalId,
      turnoId,
      receta: incidenciaReceta as any,
      tipo: incidenciaTipo as any,
      nota: incidenciaNota,
      preparacionId: preparacionSeleccionada ?? undefined,
    });
  }

  return (
    <div className="space-y-3">
      {/* Alertas de vencimiento */}
      {alertas.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {alertas.length === 1 ? "1 preparación por vencer" : `${alertas.length} preparaciones por vencer`}
            </p>
            {alertas.map((a: any) => (
              <p key={a.id} className="text-xs text-red-600 mt-0.5">
                {a.nombreReceta} ({a.cantidadLabel}) — {a.semaforo === "vencida" ? "¡VENCIDA!" : `vence en ${formatCountdown(a.minutosRestantes)}`}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Header del módulo */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50 border-b">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-left"
              onClick={() => setCollapsed(!collapsed)}
            >
              <FlaskConical className="w-4 h-4 text-teal-600" />
              <CardTitle className="text-sm font-semibold text-slate-700">
                Preparaciones del Turno
              </CardTitle>
              {activas.length > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">{activas.length} activa{activas.length !== 1 ? "s" : ""}</Badge>
              )}
              {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            <div className="flex gap-1.5">
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-slate-500"
                onClick={() => setShowHistorial(!showHistorial)}
              >
                <History className="w-3.5 h-3.5 mr-1" /> Historial
              </Button>
              <Button
                variant="ghost" size="sm"
                className="h-7 text-xs text-red-600 hover:text-red-700"
                onClick={() => { setPreparacionSeleccionada(null); setShowIncidencia(true); }}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Incidencia
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => setShowNueva(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
              </Button>
            </div>
          </div>
        </CardHeader>

        {!collapsed && (
          <CardContent className="p-3">
            {activas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                No hay preparaciones activas. Registra la primera del turno.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activas.map((p: any) => {
                  const s = SEMAFORO_STYLES[p.semaforo as Semaforo] ?? SEMAFORO_STYLES.verde;
                  return (
                    <div key={p.id} className={`rounded-lg border p-3 ${s.bg} ${s.border}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-bold ${s.text}`}>{p.nombreReceta}</span>
                            <Badge className={`text-xs px-1.5 py-0 ${s.badge}`}>
                              {p.cantidadLabel}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>Preparada: {formatHora(p.preparadaAt)}</span>
                            <span>·</span>
                            <span>Vence: {formatHora(p.venceAt)}</span>
                          </div>
                          {p.semaforo !== "vencida" && (
                            <div className={`mt-1.5 text-xs font-semibold ${s.text}`}>
                              {p.alertaActiva
                                ? `⏱ ${formatCountdown(p.minutosRestantes)} restantes`
                                : `Vigente — ${formatCountdown(p.minutosRestantes)} restantes`
                              }
                            </div>
                          )}
                          {p.semaforo === "vencida" && (
                            <div className="mt-1.5 text-xs font-semibold text-slate-500">⚠ Vencida</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 text-xs text-emerald-600 hover:text-emerald-700 px-2"
                            onClick={() => consumirMut.mutate({ id: p.id })}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Usada
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 text-xs text-red-500 hover:text-red-600 px-2"
                            onClick={() => {
                              setPreparacionSeleccionada(p.id);
                              setIncidenciaReceta(p.receta);
                              setShowIncidencia(true);
                            }}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Problema
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
              Historial de Preparaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {historial.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Sin registros en los últimos días</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {historial.map((p: any) => (
                  <div key={p.id} className={`flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0 ${p.incidenciaTipo ? "text-red-600" : "text-slate-600"}`}>
                    <div className="flex items-center gap-2">
                      {p.incidenciaTipo
                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      }
                      <div>
                        <span className="font-medium">{p.nombreReceta}</span>
                        <span className="text-slate-400 ml-1">({p.cantidadLabel})</span>
                        {p.incidenciaTipo && (
                          <span className="ml-1 text-red-500">— {INCIDENCIA_LABELS[p.incidenciaTipo]}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 shrink-0 ml-2">
                      {new Date(p.preparadaAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} {formatHora(p.preparadaAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Nueva Preparación */}
      <Dialog open={showNueva} onOpenChange={setShowNueva}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-teal-600" />
              Registrar Preparación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Receta preparada</Label>
              <Select value={receta} onValueChange={(v) => { setReceta(v); setCantidad(""); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecciona receta..." />
                </SelectTrigger>
                <SelectContent>
                  {catalogo.map((c: any) => (
                    <SelectItem key={c.clave} value={c.clave}>
                      {c.nombre}
                      <span className="text-slate-400 text-xs ml-1">({c.vidaUtilHoras}h)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {recetaConfig && (
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Cantidad preparada</Label>
                <Select value={cantidad} onValueChange={setCantidad}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecciona cantidad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recetaConfig.cantidades.map((c: any) => (
                      <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Fecha y hora de preparación (PEPS)
              </Label>
              <input
                type="datetime-local"
                value={preparadaAt}
                onChange={(e) => setPreparadaAt(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Registra la hora exacta para control PEPS (Primero en Entrar, Primero en Salir).
              </p>
            </div>

            {recetaConfig && (
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <p className="font-semibold mb-1">Información de la receta:</p>
                <p>⏱ Vida útil: <strong>{recetaConfig.vidaUtilHoras}h</strong></p>
                {recetaConfig.tiempoPreparacionMinutos > 0 && (
                  <p>🕐 Tiempo de preparación: <strong>{recetaConfig.tiempoPreparacionMinutos} min</strong></p>
                )}
                {recetaConfig.alertaActiva && (
                  <p>🔔 Alerta automática {recetaConfig.alertaMinutos} min antes de vencer</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNueva(false)}>Cancelar</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleNueva}
              disabled={crearMut.isPending}
            >
              {crearMut.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Registrar Incidencia */}
      <Dialog open={showIncidencia} onOpenChange={setShowIncidencia}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              Reportar Incidencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              Esta incidencia se notificará automáticamente al dueño y quedará en el historial permanente.
            </div>

            {!preparacionSeleccionada && (
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Receta afectada</Label>
                <Select value={incidenciaReceta} onValueChange={setIncidenciaReceta}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecciona receta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogo.map((c: any) => (
                      <SelectItem key={c.clave} value={c.clave}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de incidencia</Label>
              <Select value={incidenciaTipo} onValueChange={setIncidenciaTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecciona tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENCIA_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Describe qué pasó <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={incidenciaNota}
                onChange={(e) => setIncidenciaNota(e.target.value)}
                placeholder="Ej: Se terminó la tapioca a las 3pm y no había tiempo de preparar más antes del cierre..."
                className="text-sm min-h-[80px]"
              />
              <p className="text-xs text-slate-400 mt-1">{incidenciaNota.length}/5 caracteres mínimo</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncidencia(false)}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleIncidencia}
              disabled={incidenciaMut.isPending}
            >
              {incidenciaMut.isPending ? "Enviando..." : "Reportar Incidencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
