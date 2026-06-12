import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Clock, Star, TrendingUp, Calendar } from "lucide-react";

function getMesActual() { return new Date().toISOString().slice(0, 7); }

function semaforo(val: number, meta: number, invertir = false) {
  const ok = invertir ? val <= meta : val >= meta;
  const warn = invertir ? val <= meta * 1.5 : val >= meta * 0.6;
  if (ok) return "text-green-600 bg-green-50 border-green-200";
  if (warn) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default function MiKpi() {
  const [mes, setMes] = useState(getMesActual());
  const { data, isLoading } = trpc.miKpi.resumen.useQuery({ mes }, { retry: false });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Cargando tus KPIs...</div>;
  if (!data) return (
    <div className="p-6 text-center text-muted-foreground">
      <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="font-medium">No hay datos de KPI para tu usuario.</p>
      <p className="text-xs mt-1">Asegúrate de tener un empleado vinculado.</p>
    </div>
  );

  const [y, m] = mes.split("-").map(Number);
  const mesLabel = `${MESES[m]} ${y}`;
  const { asistencia: a, observaciones: obs } = data;

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

      {/* Observaciones */}
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
              const ico = tipo === "servicio" ? "🛎️" : tipo === "preparacion" ? "🧋" : "💰";
              const label = tipo === "servicio" ? "Servicio al cliente" : tipo === "preparacion" ? "Preparaciones" : "Caja";
              return (
                <div key={tipo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{ico} {label}</span>
                    <span className={`text-sm font-bold ${o.score >= 85 ? "text-green-600" : o.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {o.score.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${o.score >= 85 ? "bg-green-500" : o.score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${o.score}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.total} evaluacion{o.total !== 1 ? "es" : ""}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Detalle asistencia */}
      {data.detalleNomina.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" /> Detalle diario
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
