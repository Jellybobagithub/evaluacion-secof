import { useState } from "react";
import { KPI_TIPOS as TIPO_CONFIG } from "@/lib/kpiTipos";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileBarChart2, AlertCircle } from "lucide-react";

function getMesActual() { return new Date().toISOString().slice(0, 7); }
const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

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
  const [tipoAbierto, setTipoAbierto] = useState<Record<string, boolean>>({});

  const { data = [], isLoading } = trpc.reporteMensual.fallosPorEmpleado.useQuery(
    { sucursalId: sucursalId ?? 0, mes },
    { enabled: !!sucursalId }
  );

  const [y, m] = mes.split("-").map(Number);
  const mesLabel = `${MESES[m]} ${y}`;

  const toggleEmp = (id: number) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTipo = (key: string) => setTipoAbierto(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <FileBarChart2 className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Reporte Mensual</h1>
            <p className="text-sm text-muted-foreground">Fallos por criterio — {mesLabel}</p>
          </div>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm" />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground p-4">Cargando...</div>}

      {!isLoading && (data as any[]).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Sin evaluaciones en {mesLabel}</p>
        </div>
      )}

      {(data as any[]).map((emp: any) => {
        const totalFallos = Object.values(emp.tipos).reduce((s: number, t: any) => s + t.fallos, 0) as number;
        const totalEvals  = Object.values(emp.tipos).reduce((s: number, t: any) => s + t.total,  0) as number;
        const isOpen = expandido[emp.empleadoId] ?? false;

        return (
          <Card key={emp.empleadoId} className={`border ${totalFallos > 0 ? "border-red-200" : "border-green-200"}`}>
            {/* Cabecera empleado */}
            <button className="w-full text-left" onClick={() => toggleEmp(emp.empleadoId)}>
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{emp.nombre}</CardTitle>
                  <div className="flex items-center gap-2">
                    {totalFallos > 0
                      ? <Badge variant="destructive" className="text-xs">{totalFallos} fallo{totalFallos !== 1 ? "s" : ""}</Badge>
                      : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">✓ Sin fallos</Badge>
                    }
                    <span className="text-xs text-muted-foreground">{totalEvals} eval.</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
            </button>

            {isOpen && (
              <CardContent className="pt-0 space-y-2">
                {(["servicio","preparacion","caja"] as const).map(tipo => {
                  const t = emp.tipos[tipo];
                  if (!t) return null;
                  const cfg = TIPO_CONFIG[tipo];
                  const tKey = `${emp.empleadoId}-${tipo}`;
                  const tipoOpen = tipoAbierto[tKey] ?? (t.fallos > 0);
                  const criteriosConFallo = Object.entries(t.criterios as Record<string, { fallos: number; total: number }>)
                    .filter(([, v]) => v.fallos > 0)
                    .sort(([, a], [, b]) => b.fallos - a.fallos);

                  return (
                    <div key={tipo} className={`rounded-lg border overflow-hidden ${t.fallos > 0 ? "border-red-200" : "border-green-200"}`}>
                      {/* Cabecera tipo */}
                      <button className={`w-full flex items-center justify-between px-3 py-2 ${t.fallos > 0 ? "bg-red-50" : "bg-green-50"}`}
                        onClick={() => toggleTipo(tKey)}>
                        <span className="text-sm font-medium">{cfg.emoji} {cfg.label}</span>
                        <div className="flex items-center gap-2">
                          <ScoreBadge score={t.score} />
                          <span className="text-xs text-muted-foreground">{t.fallos}/{t.total}</span>
                          {tipoOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </button>

                      {tipoOpen && (
                        <div className="px-3 py-2 space-y-2 bg-white">
                          {/* Criterios con fallo */}
                          {criteriosConFallo.length > 0 && (
                            <div className="space-y-1.5">
                              {criteriosConFallo.map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-xs">
                                  <span className="text-red-700">⚠ {cfg.criterios[k] ?? k}</span>
                                  <span className="font-medium text-red-600 shrink-0 ml-2">
                                    {v.fallos}/{v.total} ({Math.round(v.fallos/v.total*100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Criterios sin fallo */}
                          <div className="space-y-1">
                            {Object.entries(t.criterios as Record<string, { fallos: number; total: number }>)
                              .filter(([, v]) => v.fallos === 0)
                              .map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>✓ {cfg.criterios[k] ?? k}</span>
                                  <span>{v.total} eval.</span>
                                </div>
                              ))
                            }
                          </div>

                          {/* Notas del evaluador */}
                          {t.notasFallos.length > 0 && (
                            <div className="pt-1 border-t space-y-1">
                              {t.notasFallos.map((nota: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground italic">"{nota}"</p>
                              ))}
                            </div>
                          )}
                        </div>
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
