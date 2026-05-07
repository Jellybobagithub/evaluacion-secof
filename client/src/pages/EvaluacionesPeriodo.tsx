import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClipboardCheck, Plus, Save, ChevronRight, BarChart3, User, CheckCircle, AlertTriangle, XCircle, Bot, Pencil } from "lucide-react";

const PUESTOS = [
  { value: "lider", label: "Líder de Tienda" },
  { value: "control_operativo", label: "Coordinadora de Control Operativo" },
  { value: "adm_finanzas", label: "Coordinador de Administración y Finanzas" },
  { value: "auxiliar_admin", label: "Auxiliar Administrativa" },
];

const REC_CONFIG = {
  continua: { label: "✅ Continúa", color: "bg-green-100 text-green-800", icon: CheckCircle },
  extiende: { label: "⚠️ Extiende 30 días", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
  concluye: { label: "🔴 Concluye", color: "bg-red-100 text-red-800", icon: XCircle },
};

function scoreColor(s: number) {
  if (s >= 80) return "text-green-600";
  if (s >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreRecomendacion(s: number): "continua" | "extiende" | "concluye" {
  if (s >= 80) return "continua";
  if (s >= 60) return "extiende";
  return "concluye";
}

function calcScore(kpis: any[]): number {
  if (!kpis.length) return 0;
  let totalPeso = 0, totalScore = 0;
  for (const k of kpis) {
    totalPeso += (k.peso ?? 1);
    totalScore += (k.score ?? 0) * (k.peso ?? 1);
  }
  return totalPeso > 0 ? Math.round(totalScore / totalPeso) : 0;
}

export default function EvaluacionesPeriodo() {
  const [vista, setVista] = useState<"dashboard" | "nueva" | "detalle">("dashboard");
  const [evalSelId, setEvalSelId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({
    evaluadoId: null, sucursalId: null, puesto: "",
    periodo: 1, fechaInicio: "", fechaFin: "",
    kpis: [], scoreTotal: 0, recomendacion: "continua",
    comentariosDirector: "", comentariosEmpleado: "", estado: "borrador"
  });

  const utils = trpc.useUtils();
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: usuarios = [] } = trpc.admin.listUsers.useQuery({ limit: 50 } as any);
  const { data: dashboard = [] } = trpc.evalPeriodos.dashboard.useQuery({});
  const { data: evalDetalle } = trpc.evalPeriodos.getById.useQuery(
    { id: evalSelId! }, { enabled: !!evalSelId }
  );

  const { data: kpiConfig = [] } = trpc.evalPeriodos.kpiConfig.useQuery(
    { puesto: form.puesto }, { enabled: !!form.puesto }
  );

  const { data: autoData } = trpc.evalPeriodos.calcularAutomatico.useQuery(
    { evaluadoId: form.evaluadoId, sucursalId: form.sucursalId, fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, puesto: form.puesto },
    { enabled: !!(form.puesto && form.sucursalId && form.fechaInicio && form.fechaFin) }
  );

  const guardar = trpc.evalPeriodos.guardar.useMutation({
    onSuccess: (res) => {
      toast.success("Evaluación guardada");
      utils.evalPeriodos.dashboard.invalidate();
      utils.evalPeriodos.list.invalidate();
      if (!form.id) setForm((f: any) => ({ ...f, id: res.id }));
    },
    onError: (e) => toast.error(e.message),
  });

  function initKPIs(config: any[]) {
    return config.map(k => ({
      nombre: k.nombre, meta: k.meta, frecuencia: k.frecuencia,
      esAutomatico: k.tipo === 'automatico', fuente: k.fuente,
      peso: k.peso, score: 0, valorReal: "", descripcionAuto: "", comentario: ""
    }));
  }

  function aplicarAuto() {
    if (!autoData) return;
    setForm((f: any) => ({
      ...f,
      kpis: f.kpis.map((k: any) => {
        if (!k.esAutomatico || !k.fuente) return k;
        const auto = autoData[k.fuente];
        if (!auto) return k;
        const score = auto.valor !== null ? Math.min(100, auto.valor) : k.score;
        return { ...k, descripcionAuto: auto.descripcion, score };
      })
    }));
    toast.success("Valores automáticos aplicados");
  }

  function updateKPI(i: number, key: string, val: any) {
    setForm((f: any) => {
      const kpis = f.kpis.map((k: any, idx: number) => idx === i ? { ...k, [key]: val } : k);
      const scoreTotal = calcScore(kpis);
      return { ...f, kpis, scoreTotal, recomendacion: scoreRecomendacion(scoreTotal) };
    });
  }

  function nuevaEval() {
    setForm({ evaluadoId: null, sucursalId: null, puesto: "", periodo: 1, fechaInicio: "", fechaFin: "", kpis: [], scoreTotal: 0, recomendacion: "continua", comentariosDirector: "", comentariosEmpleado: "", estado: "borrador" });
    setVista("nueva");
  }

  const scoreTotal = form.scoreTotal;
  const recActual = REC_CONFIG[form.recomendacion as keyof typeof REC_CONFIG];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Evaluaciones de Periodo</h1>
            <p className="text-sm text-muted-foreground">Periodo de prueba 3 meses — Mayo a Julio 2026</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vista !== "dashboard" && <Button variant="outline" size="sm" onClick={() => setVista("dashboard")}>← Dashboard</Button>}
          {vista === "dashboard" && <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={nuevaEval}><Plus className="w-4 h-4 mr-1" /> Nueva Evaluación</Button>}
        </div>
      </div>

      {/* DASHBOARD */}
      {vista === "dashboard" && (
        <div className="space-y-4">
          {/* Resumen por persona */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { nombre: "Sandra Lazarín", puesto: "Control Operativo", userId: null },
              { nombre: "Jorge Moreno", puesto: "Adm. y Finanzas", userId: null },
              { nombre: "Judith Torres", puesto: "Auxiliar Admin", userId: null },
              { nombre: "Emily Rendón", puesto: "Líder Plaza Patio", userId: 2580048 },
              { nombre: "Daniela", puesto: "Líder Plaza Portal", userId: null },
            ].map((p, i) => {
              const evals = (dashboard as any[]).filter(e => e.nombre === p.nombre);
              const ultimaEval = evals[evals.length - 1];
              return (
                <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{p.puesto}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-1">
                      {[1, 2, 3].map(mes => {
                        const e = evals.find((ev: any) => ev.periodo === mes);
                        return (
                          <div key={mes} className={`flex-1 rounded py-1 text-center text-xs font-medium ${e ? (e.scoreTotal >= 80 ? 'bg-green-100 text-green-700' : e.scoreTotal >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-400'}`}>
                            {e ? `M${mes}: ${e.scoreTotal}%` : `M${mes}: —`}
                          </div>
                        );
                      })}
                    </div>
                    {ultimaEval && (
                      <div className="mt-2">
                        <Badge className={REC_CONFIG[ultimaEval.recomendacion as keyof typeof REC_CONFIG]?.color + " text-xs"}>
                          {REC_CONFIG[ultimaEval.recomendacion as keyof typeof REC_CONFIG]?.label}
                        </Badge>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => { setForm((f: any) => ({ ...f, evaluadoNombre: p.nombre, puestoLabel: p.puesto })); setVista("nueva"); }}>
                      + Nueva evaluación
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Historial de evaluaciones */}
          {(dashboard as any[]).length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Historial de Evaluaciones</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-1">Persona</th>
                      <th className="text-left py-1">Puesto</th>
                      <th className="text-center py-1">Mes</th>
                      <th className="text-center py-1">Score</th>
                      <th className="text-left py-1">Resultado</th>
                      <th className="text-left py-1">Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(dashboard as any[]).map((e: any) => (
                      <tr key={e.id}>
                        <td className="py-1.5 font-medium">{e.nombre}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">{e.puesto}</td>
                        <td className="py-1.5 text-center">Mes {e.periodo}</td>
                        <td className={`py-1.5 text-center font-bold ${scoreColor(e.scoreTotal)}`}>{e.scoreTotal}%</td>
                        <td className="py-1.5"><Badge className={REC_CONFIG[e.recomendacion as keyof typeof REC_CONFIG]?.color + " text-xs"}>{REC_CONFIG[e.recomendacion as keyof typeof REC_CONFIG]?.label}</Badge></td>
                        <td className="py-1.5"><Badge variant="outline" className="text-xs">{e.estado}</Badge></td>
                        <td className="py-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEvalSelId(e.id); setVista("detalle"); }}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {(dashboard as any[]).length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay evaluaciones registradas</p>
              <p className="text-sm mt-1">Crea la primera evaluación del periodo de prueba</p>
            </div>
          )}
        </div>
      )}

      {/* NUEVA EVALUACIÓN */}
      {vista === "nueva" && (
        <div className="space-y-4">
          {/* Datos generales */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Datos de la Evaluación</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Persona evaluada</label>
                <Select value={form.evaluadoId?.toString() ?? ""} onValueChange={v => setForm((f: any) => ({ ...f, evaluadoId: Number(v) }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="item-aligned">
                    {(usuarios as any[]).map((u: any) => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sucursal</label>
                <Select value={form.sucursalId?.toString() ?? ""} onValueChange={v => setForm((f: any) => ({ ...f, sucursalId: Number(v) }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="item-aligned">
                    {(sucursales as any[]).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Puesto</label>
                <Select value={form.puesto} onValueChange={v => setForm((f: any) => ({ ...f, puesto: v, kpis: initKPIs(kpiConfig) }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent position="item-aligned">
                    {PUESTOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Mes de evaluación</label>
                <Select value={form.periodo.toString()} onValueChange={v => setForm((f: any) => ({ ...f, periodo: Number(v) }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="1">Mes 1 — Junio 2026</SelectItem>
                    <SelectItem value="2">Mes 2 — Julio 2026</SelectItem>
                    <SelectItem value="3">Mes 3 — Agosto 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha inicio</label>
                <Input type="date" value={form.fechaInicio} onChange={e => setForm((f: any) => ({ ...f, fechaInicio: e.target.value }))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha fin</label>
                <Input type="date" value={form.fechaFin} onChange={e => setForm((f: any) => ({ ...f, fechaFin: e.target.value }))} className="h-8 text-sm mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          {form.puesto && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">KPIs — {PUESTOS.find(p => p.value === form.puesto)?.label}</CardTitle>
                  <div className="flex gap-2">
                    {autoData && (
                      <Button size="sm" variant="outline" onClick={aplicarAuto}>
                        <Bot className="w-3.5 h-3.5 mr-1" /> Aplicar automáticos
                      </Button>
                    )}
                    {form.kpis.length === 0 && kpiConfig.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setForm((f: any) => ({ ...f, kpis: initKPIs(kpiConfig) }))}>
                        Cargar KPIs
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.kpis.map((k: any, i: number) => (
                  <div key={i} className={`border rounded-lg p-3 ${k.esAutomatico ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {k.esAutomatico ? <Bot className="w-3.5 h-3.5 text-blue-500" /> : <Pencil className="w-3.5 h-3.5 text-gray-400" />}
                          <p className="text-sm font-medium">{k.nombre}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Meta: {k.meta} · {k.frecuencia}</p>
                        {k.descripcionAuto && <p className="text-xs text-blue-600 mt-1">📊 {k.descripcionAuto}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-xl font-bold ${scoreColor(k.score)}`}>{k.score}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {!k.esAutomatico && (
                        <Input placeholder="Valor real / observación" value={k.valorReal} onChange={e => updateKPI(i, 'valorReal', e.target.value)} className="flex-1 h-7 text-xs" />
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Score:</span>
                        <Input type="number" min={0} max={100} value={k.score} onChange={e => updateKPI(i, 'score', Math.min(100, Math.max(0, Number(e.target.value))))} className="w-16 h-7 text-xs text-center" />
                      </div>
                    </div>
                    <Input placeholder="Comentario (opcional)" value={k.comentario ?? ""} onChange={e => updateKPI(i, 'comentario', e.target.value)} className="mt-1.5 h-7 text-xs" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Score total y recomendación */}
          {form.kpis.length > 0 && (
            <Card className={scoreTotal >= 80 ? "border-green-300" : scoreTotal >= 60 ? "border-yellow-300" : "border-red-300"}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Score total ponderado</p>
                    <p className={`text-4xl font-bold ${scoreColor(scoreTotal)}`}>{scoreTotal}<span className="text-lg">%</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Recomendación automática</p>
                    <Badge className={recActual.color + " text-sm px-3 py-1"}>{recActual.label}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ajustar recomendación</p>
                    <Select value={form.recomendacion} onValueChange={v => setForm((f: any) => ({ ...f, recomendacion: v }))}>
                      <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                      <SelectContent position="item-aligned">
                        <SelectItem value="continua">✅ Continúa</SelectItem>
                        <SelectItem value="extiende">⚠️ Extiende 30 días</SelectItem>
                        <SelectItem value="concluye">🔴 Concluye</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comentarios */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comentarios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Comentarios del Director</label>
                <Textarea value={form.comentariosDirector} onChange={e => setForm((f: any) => ({ ...f, comentariosDirector: e.target.value }))} rows={3} className="mt-1 text-sm" placeholder="Observaciones generales, logros destacados, áreas de mejora..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Comentarios del Evaluado (al momento de firmar)</label>
                <Textarea value={form.comentariosEmpleado} onChange={e => setForm((f: any) => ({ ...f, comentariosEmpleado: e.target.value }))} rows={2} className="mt-1 text-sm" placeholder="Respuesta o comentarios de la persona evaluada..." />
              </div>
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex justify-between flex-wrap gap-2">
            <Button variant="outline" onClick={() => setForm((f: any) => ({ ...f, estado: "borrador" }))}>
              Guardar como borrador
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-blue-300 text-blue-700"
                onClick={() => { setForm((f: any) => ({ ...f, estado: "finalizado" })); guardar.mutate({ ...form, estado: "finalizado" }); }}>
                <Save className="w-4 h-4 mr-1" /> Finalizar evaluación
              </Button>
              <Button className="bg-green-600 hover:bg-green-700"
                onClick={() => { setForm((f: any) => ({ ...f, estado: "firmado" })); guardar.mutate({ ...form, estado: "firmado" }); }}
                disabled={guardar.isPending}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {guardar.isPending ? "Guardando..." : "Marcar como firmado"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DETALLE */}
      {vista === "detalle" && evalDetalle && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{evalDetalle.evaluadoNombre} — Mes {evalDetalle.periodo}</CardTitle>
                <Badge className={REC_CONFIG[evalDetalle.recomendacion as keyof typeof REC_CONFIG]?.color}>
                  {REC_CONFIG[evalDetalle.recomendacion as keyof typeof REC_CONFIG]?.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4">
                <div><p className="text-xs text-muted-foreground">Sucursal</p><p className="font-medium text-sm">{evalDetalle.sucursalNombre}</p></div>
                <div><p className="text-xs text-muted-foreground">Periodo</p><p className="font-medium text-sm">{evalDetalle.fechaInicio} → {evalDetalle.fechaFin}</p></div>
                <div><p className="text-xs text-muted-foreground">Score</p><p className={`text-2xl font-bold ${scoreColor(evalDetalle.scoreTotal)}`}>{evalDetalle.scoreTotal}%</p></div>
                <div><p className="text-xs text-muted-foreground">Estado</p><Badge variant="outline">{evalDetalle.estado}</Badge></div>
              </div>
              <table className="w-full text-sm mt-3">
                <thead><tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1">KPI</th><th className="text-left py-1">Meta</th>
                  <th className="text-left py-1">Resultado</th><th className="text-center py-1">Score</th>
                </tr></thead>
                <tbody className="divide-y">
                  {(evalDetalle.kpis as any[]).map((k: any, i: number) => (
                    <tr key={i}>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1">
                          {k.esAutomatico ? <Bot className="w-3 h-3 text-blue-400" /> : <Pencil className="w-3 h-3 text-gray-300" />}
                          <span>{k.nombre}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground">{k.meta}</td>
                      <td className="py-1.5 text-xs">{k.descripcionAuto || k.valorReal || '—'}</td>
                      <td className={`py-1.5 text-center font-bold ${scoreColor(k.score)}`}>{k.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {evalDetalle.comentariosDirector && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Comentarios del Director:</p>
                  <p>{evalDetalle.comentariosDirector}</p>
                </div>
              )}
              {evalDetalle.comentariosEmpleado && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Comentarios del Evaluado:</p>
                  <p>{evalDetalle.comentariosEmpleado}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
