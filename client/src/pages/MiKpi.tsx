import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Star, TrendingUp, Calendar, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

function getMesActual() { return new Date().toISOString().slice(0, 7); }

function semaforo(val: number, meta: number) {
  if (val >= meta) return "text-green-600 bg-green-50 border-green-200";
  if (val >= meta * 0.7) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const TIPO_CONFIG: Record<string, { label: string; emoji: string; criterios: Record<string, string> }> = {
  servicio:    { label: "Servicio al cliente", emoji: "🛎️", criterios: { saludo: "Saludo al cliente", sonrisa: "Sonrisa y actitud", uniforme: "Uniforme correcto", despedida: "Despedida cordial", venta_sug: "Venta sugerida" }},
  preparacion: { label: "Preparaciones",       emoji: "🧋", criterios: { receta: "Siguió la receta", tiempo: "Tiempo de preparación", temperatura: "Entrega la bebida en su punto (No muy espesa, No Aguada)", presentacion: "Presentación del producto" }},
  caja:        { label: "Caja",                emoji: "💰", criterios: { cambio: "Cambio correcto", ticket: "Entregó ticket", descuadre: "Sin descuadre", cobro_correcto: "Cobro correcto" }},
};

function CriterioBar({ label, fallos, total }: { label: string; fallos: number; total: number }) {
  const pctFallo = total > 0 ? Math.round((fallos / total) * 100) : 0;
  const color = pctFallo === 0 ? "bg-green-500" : pctFallo <= 30 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${pctFallo === 0 ? "text-green-600" : pctFallo <= 30 ? "text-amber-600" : "text-red-600"}`}>
          {pctFallo === 0 ? "✓ Sin fallos" : `${fallos}/${total} fallos`}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctFallo}%` }} />
      </div>
    </div>
  );
}

export default function MiKpi() {
  const [mes, setMes] = useState(getMesActual());
  const [expandido, setExpandido] = useState<string | null>(null);
  const { data, isLoading } = trpc.miKpi.resumen.useQuery({ mes }, { retry: false });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Cargando tus KPIs...</div>;
  if (!data) return (
    <div className="p-6 text-center text-muted-foreground">
      <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="font-medium">No hay datos de KPI para tu usuario.</p>
      <p className="text-xs mt-1">Asegúrate de tener un empleado vinculado.</p>
    </div>
  );

  // El backend puede devolver un mes diferente si el pedido no tiene datos
  const mesReal = (data as any).mes ?? mes;
  const [y, m] = mesReal.split("-").map(Number);
  const mesLabel = `${MESES[m]} ${y}`;
  const { asistencia: a, observaciones: obs, criteriosFallo = {}, notasMes = [] } = data as any;

  // Determinar áreas de mejora (criterios con >0% fallo)
  const areasMejora: { tipo: string; criterio: string; label: string; fallos: number; total: number }[] = [];
  for (const [tipo, criterios] of Object.entries(criteriosFallo as Record<string, Record<string, { fallos: number; total: number }>>)) {
    for (const [k, v] of Object.entries(criterios)) {
      if (v.fallos > 0) {
        areasMejora.push({ tipo, criterio: k, label: TIPO_CONFIG[tipo]?.criterios[k] ?? k, fallos: v.fallos, total: v.total });
      }
    }
  }
  areasMejora.sort((a, b) => (b.fallos / b.total) - (a.fallos / a.total));

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mis KPIs</h1>
          <p className="text-sm text-muted-foreground">{data.nombre} · {data.puesto ?? "Colaborador"}</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm" />
      </div>
      {mesReal !== mes && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Sin evaluaciones en el mes seleccionado — mostrando {mesLabel}
        </div>
      )}

      {/* Asistencia */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" /> Asistencia — {mesLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{a.diasPresente}</p>
            <p className="text-xs text-muted-foreground">Días presente</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${a.diasAusente > 0 ? "text-red-600" : "text-slate-400"}`}>{a.diasAusente}</p>
            <p className="text-xs text-muted-foreground">Ausencias</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${a.retardos > 0 ? "text-amber-600" : "text-slate-400"}`}>{a.retardos}</p>
            <p className="text-xs text-muted-foreground">Retardos</p>
          </div>
        </CardContent>
      </Card>

      {/* Puntualidad */}
      {a.puntualidadPct !== null && (
        <Card className={`border ${semaforo(a.puntualidadPct, 90)}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Puntualidad</span>
              </div>
              <Badge variant="outline" className={`text-xs ${semaforo(a.puntualidadPct, 90)}`}>
                {a.puntualidadPct >= 90 ? "✅ Cumple" : a.puntualidadPct >= 70 ? "⚠️ Mejorar" : "🔴 Crítico"}
              </Badge>
            </div>
            <p className="text-3xl font-bold">{a.puntualidadPct}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Meta: ≥90% · {a.minRetardoTotal} min total de retardos</p>
            <div className="mt-2 h-2 bg-white/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-current transition-all" style={{ width: `${a.puntualidadPct}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Áreas de mejora — resumen rápido */}
      {areasMejora.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-4 h-4" /> Áreas de mejora
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {areasMejora.slice(0, 4).map(a => (
              <div key={`${a.tipo}-${a.criterio}`} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{TIPO_CONFIG[a.tipo]?.emoji} {a.label}</span>
                <span className="font-medium text-red-600">{Math.round((a.fallos/a.total)*100)}% fallo</span>
              </div>
            ))}
            {areasMejora.length > 4 && (
              <p className="text-xs text-amber-600 pt-1">+{areasMejora.length - 4} más — ver detalle abajo</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evaluaciones por tipo con desglose de criterios */}
      {Object.keys(obs).length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Evaluaciones del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["servicio","preparacion","caja"] as const).map(tipo => {
              const o = obs[tipo];
              if (!o) return null;
              const cfg = TIPO_CONFIG[tipo];
              const abierto = expandido === tipo;
              const criterios = criteriosFallo[tipo] ?? {};
              return (
                <div key={tipo} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandido(abierto ? null : tipo)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cfg.emoji}</span>
                      <span className="text-sm font-medium">{cfg.label}</span>
                      <span className="text-xs text-muted-foreground">({o.total} eval.)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${o.score >= 85 ? "text-green-600" : o.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {o.score.toFixed(0)}%
                      </span>
                      {abierto ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  <div className="px-3 pb-0.5">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${o.score >= 85 ? "bg-green-500" : o.score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${o.score}%` }} />
                    </div>
                  </div>
                  {abierto && (
                    <div className="px-3 py-3 border-t bg-muted/20 space-y-2">
                      {Object.entries(cfg.criterios).map(([k, label]) => {
                        const c = criterios[k] ?? { fallos: 0, total: o.total };
                        return <CriterioBar key={k} label={label} fallos={c.fallos} total={c.total} />;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Notas del evaluador */}
      {notasMes.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" /> Comentarios del líder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notasMes.map((n: any, i: number) => (
              <div key={i} className="text-xs bg-muted/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span>{TIPO_CONFIG[n.tipo]?.emoji}</span>
                  <span className="font-medium text-muted-foreground">{TIPO_CONFIG[n.tipo]?.label}</span>
                  <span className="text-muted-foreground/60 ml-auto">{n.fecha}</span>
                </div>
                <p className="text-foreground">{n.notas}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detalle asistencia */}
      {data.detalleNomina.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" /> Detalle diario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.detalleNomina.map((d: any) => (
              <div key={d.fecha} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <span className="text-muted-foreground w-20">{d.fecha}</span>
                {d.horaEntrada ? (
                  <>
                    <span className="font-medium">{d.horaEntrada.substring(0,5)}</span>
                    {d.minutosRetardo > 0
                      ? <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">+{d.minutosRetardo}min</Badge>
                      : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  </>
                ) : (
                  <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Ausente</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
