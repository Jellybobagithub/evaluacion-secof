import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileBarChart2, AlertCircle } from "lucide-react";

function getMesActual() { return new Date().toISOString().slice(0, 7); }
const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const TIPO_LABELS: Record<string, string> = {
  servicio: "🛎️ Servicio",
  preparacion: "🧋 Preparaciones",
  caja: "💰 Caja",
};

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 85 ? "bg-green-100 text-green-700 border-green-200"
    : score >= 60 ? "bg-amber-100 text-amber-700 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  return <Badge variant="outline" className={`text-xs ${cls}`}>{score.toFixed(0)}%</Badge>;
}

export default function ReporteMensual() {
  const { sucursalId } = useSucursal();
  const [mes, setMes] = useState(getMesActual());
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});

  const { data = [], isLoading } = trpc.reporteMensual.fallosPorEmpleado.useQuery(
    { sucursalId: sucursalId ?? 0, mes },
    { enabled: !!sucursalId }
  );

  const [y, m] = mes.split("-").map(Number);
  const mesLabel = `${MESES[m]} ${y}`;

  const toggle = (id: number) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FileBarChart2 className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Reporte Mensual</h1>
            <p className="text-sm text-muted-foreground">Fallos en preparaciones y servicio — {mesLabel}</p>
          </div>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm" />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground p-4">Cargando...</div>}

      {!isLoading && data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Sin evaluaciones en {mesLabel}</p>
        </div>
      )}

      {(data as any[]).map((emp: any) => {
        const totalFallos = Object.values(emp.tipos).reduce((s: number, t: any) => s + t.fallos, 0) as number;
        const totalEvals = Object.values(emp.tipos).reduce((s: number, t: any) => s + t.total, 0) as number;
        const isOpen = expandido[emp.empleadoId] ?? false;
        return (
          <Card key={emp.empleadoId} className={`border ${totalFallos > 0 ? "border-red-200" : "border-green-200"}`}>
            <button className="w-full text-left" onClick={() => toggle(emp.empleadoId)}>
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{emp.nombre}</CardTitle>
                  <div className="flex items-center gap-2">
                    {totalFallos > 0
                      ? <Badge variant="destructive" className="text-xs">{totalFallos} fallo{totalFallos !== 1 ? "s" : ""}</Badge>
                      : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Sin fallos</Badge>
                    }
                    <span className="text-xs text-muted-foreground">{totalEvals} eval{totalEvals !== 1 ? "s" : ""}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
            </button>
            {isOpen && (
              <CardContent className="pt-0 space-y-3">
                {(["servicio","preparacion","caja"] as const).map(tipo => {
                  const t = emp.tipos[tipo];
                  if (!t) return null;
                  return (
                    <div key={tipo} className={`rounded-lg p-3 ${t.fallos > 0 ? "bg-red-50 border border-red-100" : "bg-green-50 border border-green-100"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{TIPO_LABELS[tipo]}</span>
                        <div className="flex items-center gap-2">
                          <ScoreBadge score={t.score} />
                          <span className="text-xs text-muted-foreground">{t.fallos}/{t.total} fallos</span>
                        </div>
                      </div>
                      {t.notasFallos.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {t.notasFallos.map((nota: string, i: number) => (
                            <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                              <span className="mt-0.5 shrink-0">•</span>
                              <span>{nota}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
