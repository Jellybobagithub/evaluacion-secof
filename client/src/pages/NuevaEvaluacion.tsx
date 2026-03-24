import { useState, useEffect, useRef, useMemo } from "react";
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
import { ArrowLeft, ArrowRight, Save, CheckCircle2, ChevronRight, Camera, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SECCIONES as SECCIONES_STATIC, getCalificacion } from "../../../shared/evaluacionData";

type RespuestaVal = "si" | "no" | "na";
type RespuestasMap = Record<string, { respuesta: RespuestaVal; observacion: string; fotoUrl?: string; fotoDataUrl?: string }>;

// Tipo que representa un punto de evaluación (desde DB o estático)
type PuntoEval = {
  id: string;        // código, ej. "PG1"
  descripcion: string;
  criterio?: string;
  categoria: string;
  valor: number;
};

type SeccionEval = {
  numero: number;
  nombre: string;
  puntos: PuntoEval[];
};

const CATEGORY_COLORS: Record<string, string> = {
  Control: "bg-blue-100 text-blue-700",
  Higiene: "bg-emerald-100 text-emerald-700",
  Hospitalidad: "bg-purple-100 text-purple-700",
  Imagen: "bg-amber-100 text-amber-700",
  Mantenimiento: "bg-orange-100 text-orange-700",
  "Operación": "bg-indigo-100 text-indigo-700",
};

/** Construye secciones a partir de los puntos de la DB */
function buildSecciones(puntos: Array<{
  id: number; codigo: string; seccionNumero: number; seccionNombre: string;
  categoria: string; descripcion: string; criterio?: string | null; valor: number; orden: number;
}>): SeccionEval[] {
  const map = new Map<number, SeccionEval>();
  for (const p of puntos) {
    if (!map.has(p.seccionNumero)) {
      map.set(p.seccionNumero, { numero: p.seccionNumero, nombre: p.seccionNombre, puntos: [] });
    }
    map.get(p.seccionNumero)!.puntos.push({
      id: p.codigo,
      descripcion: p.descripcion,
      criterio: p.criterio ?? undefined,
      categoria: p.categoria,
      valor: p.valor,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.numero - b.numero);
}

/** Calcula puntuación dinámica a partir de las secciones y respuestas */
function calcularPuntuacionDinamica(
  secciones: SeccionEval[],
  respuestasMap: Record<string, RespuestaVal>
) {
  let puntosObtenidos = 0;
  let puntosMaximos = 0;
  const porSeccion: Record<number, { obtenidos: number; maximos: number }> = {};
  const porCategoria: Record<string, { obtenidos: number; maximos: number }> = {};

  for (const seccion of secciones) {
    let secObt = 0, secMax = 0;
    for (const punto of seccion.puntos) {
      const resp = respuestasMap[punto.id];
      if (resp === "na") continue; // excluir del cálculo
      secMax += punto.valor;
      puntosMaximos += punto.valor;
      if (!porCategoria[punto.categoria]) porCategoria[punto.categoria] = { obtenidos: 0, maximos: 0 };
      porCategoria[punto.categoria].maximos += punto.valor;
      if (resp === "si") {
        secObt += punto.valor;
        puntosObtenidos += punto.valor;
        porCategoria[punto.categoria].obtenidos += punto.valor;
      }
    }
    porSeccion[seccion.numero] = { obtenidos: secObt, maximos: secMax };
  }

  const porcentajeGeneral = puntosMaximos > 0 ? (puntosObtenidos / puntosMaximos) * 100 : 0;
  return { puntosObtenidos, puntosMaximos, porcentajeGeneral, porSeccion, porCategoria };
}

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
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Cargar puntos desde la DB ─────────────────────────────────────────────
  const { data: puntosDB, isLoading: loadingPuntos } = trpc.adminPreguntas.list.useQuery(
    { soloActivos: true },
    { staleTime: 5 * 60 * 1000 } // cache 5 min
  );

  // Construir secciones dinámicas; si la DB no responde, usar datos estáticos como fallback
  const SECCIONES: SeccionEval[] = useMemo(() => {
    if (puntosDB && puntosDB.length > 0) {
      return buildSecciones(puntosDB as any[]);
    }
    // Fallback a datos estáticos
    return SECCIONES_STATIC.map(s => ({
      numero: s.numero,
      nombre: s.nombre,
      puntos: s.puntos.map(p => ({
        id: p.id,
        descripcion: p.descripcion,
        criterio: p.criterio,
        categoria: p.categoria,
        valor: p.valor,
      })),
    }));
  }, [puntosDB]);

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
    setSucursalId(String(borradorData.sucursalId));
    setEvaluadorNombre(borradorData.evaluadorNombre ?? "");
    setFecha(new Date(borradorData.fecha).toISOString().split("T")[0]);
    setObservacionesGenerales(borradorData.observacionesGenerales ?? "");
    const respMap: RespuestasMap = {};
    for (const r of borradorData.respuestas ?? []) {
      respMap[r.puntoId] = {
        respuesta: r.respuesta as RespuestaVal,
        observacion: r.observacion ?? "",
        fotoUrl: (r as any).fotoUrl ?? undefined,
      };
    }
    setRespuestas(respMap);
    setStep("form");
  }, [borradorData, continuarId]);

  const seccion = SECCIONES[seccionActual];
  const totalSecciones = SECCIONES.length;

  // Progreso
  const allPuntos = useMemo(() => SECCIONES.flatMap(s => s.puntos), [SECCIONES]);
  const totalPuntos = allPuntos.length;
  const respondidos = Object.keys(respuestas).length;
  const progreso = totalPuntos > 0 ? (respondidos / totalPuntos) * 100 : 0;
  const seccionRespondidos = seccion?.puntos.filter(p => respuestas[p.id]).length ?? 0;
  const seccionTotal = seccion?.puntos.length ?? 0;

  // Puntuación en tiempo real
  const respuestasMap: Record<string, RespuestaVal> = {};
  for (const [k, v] of Object.entries(respuestas)) {
    respuestasMap[k] = v.respuesta;
  }
  const scoring = calcularPuntuacionDinamica(SECCIONES, respuestasMap);

  function setRespuesta(puntoId: string, respuesta: RespuestaVal) {
    setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], respuesta, observacion: prev[puntoId]?.observacion ?? "" } }));
  }

  function setObservacion(puntoId: string, observacion: string) {
    setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], observacion, respuesta: prev[puntoId]?.respuesta ?? "no" } }));
  }

  const uploadFotoMutation = trpc.evidencia.upload.useMutation();
  const deleteFotoMutation = trpc.evidencia.delete.useMutation();

  async function handleFotoChange(puntoId: string, file: File) {
    if (!evaluacionId) { toast.error("Guarda la evaluación primero"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("La foto no debe superar 5 MB"); return; }
    setUploadingFoto(puntoId);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], fotoDataUrl: dataUrl, respuesta: prev[puntoId]?.respuesta ?? "no" } }));
        try {
          const { url } = await uploadFotoMutation.mutateAsync({ evaluacionId, puntoId, dataUrl, mimeType: file.type || "image/jpeg" });
          setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], fotoUrl: url, fotoDataUrl: undefined } }));
          toast.success("Foto guardada");
        } catch {
          setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], fotoDataUrl: undefined } }));
          toast.error("Error al subir la foto");
        } finally { setUploadingFoto(null); }
      };
      reader.readAsDataURL(file);
    } catch { setUploadingFoto(null); toast.error("Error al leer la foto"); }
  }

  async function handleRemoveFoto(puntoId: string) {
    if (!evaluacionId) return;
    setRespuestas(prev => ({ ...prev, [puntoId]: { ...prev[puntoId], fotoUrl: undefined, fotoDataUrl: undefined } }));
    try { await deleteFotoMutation.mutateAsync({ evaluacionId, puntoId }); } catch { /* silent */ }
  }

  async function handleStart() {
    if (!sucursalId) { toast.error("Selecciona una sucursal"); return; }
    try {
      const result = await createMutation.mutateAsync({ sucursalId: parseInt(sucursalId), evaluadorNombre, fecha });
      setEvaluacionId(result.id);
      setStep("form");
    } catch { toast.error("Error al crear la evaluación"); }
  }

  async function handleSaveDraft() {
    if (!evaluacionId) return;
    try {
      const rows = Object.entries(respuestas).map(([puntoId, v]) => ({
        puntoId,
        respuesta: v.respuesta,
        observacion: v.observacion,
        puntosObtenidos: v.respuesta === "si" ? (allPuntos.find(p => p.id === puntoId)?.valor ?? 0) : 0,
      }));
      await saveMutation.mutateAsync({ evaluacionId, respuestas: rows, estado: "borrador", observacionesGenerales });
      toast.success("Borrador guardado");
    } catch { toast.error("Error al guardar"); }
  }

  async function handleFinish() {
    if (!evaluacionId) return;
    try {
      const rows = Object.entries(respuestas).map(([puntoId, v]) => ({
        puntoId,
        respuesta: v.respuesta,
        observacion: v.observacion,
        puntosObtenidos: v.respuesta === "si" ? (allPuntos.find(p => p.id === puntoId)?.valor ?? 0) : 0,
      }));
      await saveMutation.mutateAsync({ evaluacionId, respuestas: rows, estado: "completada", observacionesGenerales });
      toast.success("Evaluación completada");
      setLocation(`/evaluacion/${evaluacionId}`);
    } catch { toast.error("Error al completar la evaluación"); }
  }

  // ── Pantalla de configuración ─────────────────────────────────────────────
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
              {loadingPuntos ? (
                <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando preguntas...</p>
              ) : (
                <p>Se evaluarán <strong>{totalPuntos} puntos</strong> organizados en <strong>{totalSecciones} secciones</strong>. Cada punto puede responderse como <strong>Sí</strong>, <strong>No</strong> o <strong>N/A</strong>.</p>
              )}
            </div>

            <Button className="w-full" onClick={handleStart} disabled={createMutation.isPending || loadingPuntos}>
              {createMutation.isPending ? "Creando..." : "Comenzar Evaluación"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Formulario de evaluación ──────────────────────────────────────────────
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
              <h1 className="text-lg font-bold">{seccion?.numero}. {seccion?.nombre}</h1>
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
                Siguiente <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep("review")}>
                Revisar y finalizar <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progreso total: {respondidos}/{totalPuntos} puntos</span>
            <span className="font-semibold" style={{ color: getCalificacion(scoring.porcentajeGeneral).color }}>
              {scoring.porcentajeGeneral.toFixed(1)}% · {getCalificacion(scoring.porcentajeGeneral).label}
            </span>
          </div>
          <Progress value={progreso} className="h-2" />
        </div>

        {/* Tabs de secciones */}
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

        {/* Puntos de la sección */}
        <div className="space-y-3">
          {seccion?.puntos.map((punto) => {
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
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {/* Foto opcional de evidencia */}
                        {resp && resp.respuesta !== "na" && (
                          <div className="flex items-center gap-1.5">
                            {resp.fotoUrl || resp.fotoDataUrl ? (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={resp.fotoUrl || resp.fotoDataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  Ver foto
                                </a>
                                <button
                                  onClick={() => handleRemoveFoto(punto.id)}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                  title="Eliminar foto"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  ref={el => { fileInputRefs.current[punto.id] = el; }}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFotoChange(punto.id, file);
                                    e.target.value = "";
                                  }}
                                />
                                <button
                                  onClick={() => fileInputRefs.current[punto.id]?.click()}
                                  disabled={uploadingFoto === punto.id}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50"
                                  title="Agregar foto de evidencia (opcional)"
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                  {uploadingFoto === punto.id ? "Subiendo..." : "Foto"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Navegación inferior */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => seccionActual > 0 && setSeccionActual(s => s - 1)} disabled={seccionActual === 0}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Anterior
          </Button>
          {seccionActual < totalSecciones - 1 ? (
            <Button onClick={() => setSeccionActual(s => s + 1)}>
              Siguiente <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={() => setStep("review")}>
              Revisar y finalizar <ChevronRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Revisión final ────────────────────────────────────────────────────────
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

      {/* Tarjeta de calificación */}
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

      {/* Resumen por sección */}
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

      {/* Observaciones generales */}
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
