import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Save, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SECCIONES, calcularPuntuacion, getCalificacion } from "../../../shared/evaluacionData";

type RespuestaVal = "si" | "no" | "na";
type RespuestasMap = Record<string, { respuesta: RespuestaVal; observacion: string }>;

const CATEGORY_COLORS: Record<string, string> = {
  Control: "bg-blue-100 text-blue-700",
  Higiene: "bg-emerald-100 text-emerald-700",
  Hospitalidad: "bg-purple-100 text-purple-700",
  Imagen: "bg-amber-100 text-amber-700",
  Mantenimiento: "bg-orange-100 text-orange-700",
  Operación: "bg-indigo-100 text-indigo-700",
};

export default function NuevaEvaluacion() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sucursalIdParam = params.get("sucursalId");

  const evaluacionIdParam = params.get("evaluacionId");
  const continuarId = evaluacionIdParam ? parseInt(evaluacionIdParam) : null;

  const [step, setStep] = useState<"config" | "form" | "review">("config");
  const [seccionActual, setSeccionActual] = useState(0);
  const [evaluacionId, setEvaluacionId] = useState<number | null>(continuarId);
  const [sucursalId, setSucursalId] = useState(sucursalIdParam ?? "");
  const [evaluadorNombre, setEvaluadorNombre] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [observacionesGenerales, setObservacionesGenerales] = useState("");
  const [respuestas, setRespuestas] = useState<RespuestasMap>({});

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const createMutation = trpc.evaluaciones.create.useMutation();
  const saveMutation = trpc.evaluaciones.saveRespuestas.useMutation();

  // Cargar borrador si viene con evaluacionId en la URL
  const { data: borradorData } = trpc.evaluaciones.getById.useQuery(
    { id: continuarId! },
    { enabled: !!continuarId }
  );

  useEffect(() => {
    if (!borradorData || !continuarId) return;
    // Restaurar datos del borrador
    setSucursalId(String(borradorData.sucursalId));
    setEvaluadorNombre(borradorData.evaluadorNombre ?? "");
    setFecha(new Date(borradorData.fecha).toISOString().split("T")[0]);
    setObservacionesGenerales(borradorData.observacionesGenerales ?? "");
    // Restaurar respuestas guardadas
    const respMap: RespuestasMap = {};
    for (const r of borradorData.respuestas ?? []) {
      respMap[r.puntoId] = {
        respuesta: r.respuesta as RespuestaVal,
        observacion: r.observacion ?? "",
      };
    }
    setRespuestas(respMap);
    setStep("form");
  }, [borradorData, continuarId]);

  const seccion = SECCIONES[seccionActual];
  const totalSecciones = SECCIONES.length;

  // Calculate progress
  const totalPuntos = SECCIONES.flatMap(s => s.puntos).length;
  const respondidos = Object.keys(respuestas).length;
  const progreso = (respondidos / totalPuntos) * 100;

  // Calculate current section progress
  const seccionRespondidos = seccion?.puntos.filter(p => respuestas[p.id]).length ?? 0;
  const seccionTotal = seccion?.puntos.length ?? 0;

  // Real-time scoring
  const respuestasMap: Record<string, RespuestaVal> = {};
  for (const [k, v] of Object.entries(respuestas)) {
    respuestasMap[k] = v.respuesta;
  }
  const scoring = calcularPuntuacion(respuestasMap);

  function setRespuesta(puntoId: string, respuesta: RespuestaVal) {
    setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], respuesta, observacion: prev[puntoId]?.observacion ?? "" } }));
  }

  function setObservacion(puntoId: string, observacion: string) {
    setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], observacion, respuesta: prev[puntoId]?.respuesta ?? "no" } }));
  }

  async function handleStart() {
    if (!sucursalId) { toast.error("Selecciona una sucursal"); return; }
    try {
      const result = await createMutation.mutateAsync({
        sucursalId: parseInt(sucursalId),
        evaluadorNombre,
        fecha,
      });
      setEvaluacionId(result.id);
      setStep("form");
    } catch {
      toast.error("Error al crear la evaluación");
    }
  }

  async function handleSaveDraft() {
    if (!evaluacionId) return;
    try {
      const rows = Object.entries(respuestas).map(([puntoId, v]) => ({
        puntoId,
        respuesta: v.respuesta,
        observacion: v.observacion,
        puntosObtenidos: v.respuesta === "si" ? (SECCIONES.flatMap(s => s.puntos).find(p => p.id === puntoId)?.valor ?? 0) : 0,
      }));
      await saveMutation.mutateAsync({ evaluacionId, respuestas: rows, estado: "borrador", observacionesGenerales });
      toast.success("Borrador guardado");
    } catch {
      toast.error("Error al guardar");
    }
  }

  async function handleFinish() {
    if (!evaluacionId) return;
    try {
      const rows = Object.entries(respuestas).map(([puntoId, v]) => ({
        puntoId,
        respuesta: v.respuesta,
        observacion: v.observacion,
        puntosObtenidos: v.respuesta === "si" ? (SECCIONES.flatMap(s => s.puntos).find(p => p.id === puntoId)?.valor ?? 0) : 0,
      }));
      await saveMutation.mutateAsync({ evaluacionId, respuestas: rows, estado: "completada", observacionesGenerales });
      toast.success("Evaluación completada");
      setLocation(`/evaluacion/${evaluacionId}`);
    } catch {
      toast.error("Error al completar la evaluación");
    }
  }

  if (step === "config") {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nueva Evaluación</h1>
            <p className="text-muted-foreground text-sm">Configura los datos de la evaluación</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Sucursal *</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales.filter(s => s.activa).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre} {s.ciudad ? `· ${s.ciudad}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre del Evaluador</Label>
              <Input placeholder="Nombre completo" value={evaluadorNombre} onChange={e => setEvaluadorNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de Evaluación</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Información de la evaluación</p>
              <p>Se evaluarán <strong>148 puntos</strong> organizados en <strong>10 secciones</strong>. Cada punto puede responderse como <strong>Sí</strong>, <strong>No</strong> o <strong>N/A</strong>.</p>
            </div>

            <Button className="w-full" onClick={handleStart} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando..." : "Comenzar Evaluación"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { if (seccionActual > 0) setSeccionActual(s => s - 1); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">{seccion.numero}. {seccion.nombre}</h1>
              <p className="text-xs text-muted-foreground">{seccionRespondidos}/{seccionTotal} puntos respondidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saveMutation.isPending}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Guardar borrador
            </Button>
            {seccionActual < totalSecciones - 1 ? (
              <Button size="sm" onClick={() => setSeccionActual(s => s + 1)}>
                Siguiente
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep("review")}>
                Revisar y finalizar
                <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progreso total: {respondidos}/{totalPuntos} puntos</span>
            <span className="font-semibold" style={{ color: getCalificacion(scoring.porcentajeGeneral).color }}>
              {scoring.porcentajeGeneral.toFixed(1)}% · {getCalificacion(scoring.porcentajeGeneral).label}
            </span>
          </div>
          <Progress value={progreso} className="h-2" />
        </div>

        {/* Section tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SECCIONES.map((s, i) => {
            const respondidosS = s.puntos.filter(p => respuestas[p.id]).length;
            const completa = respondidosS === s.puntos.length;
            return (
              <button
                key={s.numero}
                onClick={() => setSeccionActual(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  i === seccionActual
                    ? "bg-primary text-primary-foreground"
                    : completa
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {completa && <CheckCircle2 className="h-3 w-3" />}
                {s.numero}. {s.nombre}
              </button>
            );
          })}
        </div>

        {/* Points */}
        <div className="space-y-3">
          {seccion.puntos.map((punto, idx) => {
            const resp = respuestas[punto.id];
            return (
              <Card key={punto.id} className={`border shadow-none transition-all ${resp ? "border-border" : "border-amber-200 bg-amber-50/30"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0 w-8">{punto.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1.5">
                        <p className="text-sm font-medium flex-1">{punto.descripcion}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[punto.categoria] ?? ""}`}>
                            {punto.categoria}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{punto.valor} pts</Badge>
                        </div>
                      </div>
                      {punto.criterio && (
                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed border-l-2 border-muted pl-2">
                          {punto.criterio}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {(["si", "no", "na"] as RespuestaVal[]).map(r => (
                          <button
                            key={r}
                            onClick={() => setRespuesta(punto.id, r)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                              resp?.respuesta === r
                                ? r === "si"
                                  ? "bg-emerald-500 text-white border-emerald-500"
                                  : r === "no"
                                  ? "bg-red-500 text-white border-red-500"
                                  : "bg-slate-500 text-white border-slate-500"
                                : "bg-white text-muted-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {r === "si" ? "Sí" : r === "no" ? "No" : "N/A"}
                          </button>
                        ))}
                        {resp?.respuesta === "no" && (
                          <Input
                            placeholder="Observación (opcional)"
                            value={resp.observacion}
                            onChange={e => setObservacion(punto.id, e.target.value)}
                            className="flex-1 h-8 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navigation bottom */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => seccionActual > 0 && setSeccionActual(s => s - 1)} disabled={seccionActual === 0}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Anterior
          </Button>
          {seccionActual < totalSecciones - 1 ? (
            <Button onClick={() => setSeccionActual(s => s + 1)}>
              Siguiente
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={() => setStep("review")}>
              Revisar y finalizar
              <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Review step
  const calif = getCalificacion(scoring.porcentajeGeneral);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setStep("form")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Revisión Final</h1>
          <p className="text-muted-foreground text-sm">Verifica los resultados antes de finalizar</p>
        </div>
      </div>

      {/* Score card */}
      <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${calif.color}` }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Calificación General</p>
              <p className="text-5xl font-bold mt-1" style={{ color: calif.color }}>{scoring.porcentajeGeneral.toFixed(1)}%</p>
              <p className="text-lg font-semibold mt-1" style={{ color: calif.color }}>{calif.label}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Puntos</p>
              <p className="text-2xl font-bold">{scoring.puntosObtenidos} / {scoring.puntosMaximos}</p>
              <p className="text-sm text-muted-foreground mt-1">{respondidos}/{totalPuntos} respondidos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections summary */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen por Sección</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SECCIONES.map(s => {
              const secData = scoring.porSeccion[s.numero];
              const pct = secData && secData.maximos > 0 ? (secData.obtenidos / secData.maximos) * 100 : 0;
              const c = getCalificacion(pct);
              return (
                <div key={s.numero} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5 text-right">{s.numero}.</span>
                  <span className="text-sm flex-1 truncate">{s.nombre}</span>
                  <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                  </div>
                  <span className="text-sm font-semibold w-12 text-right" style={{ color: c.color }}>{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observaciones Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Agrega observaciones generales de la evaluación..."
            value={observacionesGenerales}
            onChange={e => setObservacionesGenerales(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={handleSaveDraft} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-1.5" />
          Guardar borrador
        </Button>
        <Button className="flex-1" onClick={handleFinish} disabled={saveMutation.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Finalizar evaluación
        </Button>
      </div>
    </div>
  );
}
