import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Scale, TrendingDown, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function CuadreVasos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [dias, setDias] = useState(30);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  // Auto-seleccionar sucursal si solo hay una
  useEffect(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales]);

  const { data: cuadres = [] } = trpc.turno.getCuadresRecientes.useQuery(
    { sucursalId: sucursalId ?? 0, dias },
    { enabled: !!sucursalId }
  );

  const isLeaderPlus = ["leader", "manager", "owner", "superadmin"].includes(user?.role ?? "");

  // Estadísticas generales
  const totalCuadres = cuadres.length;
  const cuadresOk = cuadres.filter((c: any) => c.diferencia === 0).length;
  const cuadresConMerma = cuadres.filter((c: any) => c.diferencia > 0).length;
  const totalMerma = cuadres.reduce((acc: number, c: any) => acc + (c.diferencia > 0 ? c.diferencia : 0), 0);
  const porcentajeCumplimiento = totalCuadres > 0 ? Math.round(cuadresOk / totalCuadres * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1 as any)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cuadre de Vasos</h1>
          <p className="text-sm text-muted-foreground">Historial de apertura vs cierre de turno</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4">
            {isLeaderPlus && (
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Sucursal</Label>
                <Select value={sucursalId?.toString() ?? ""} onValueChange={v => setSucursalId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona sucursal..." /></SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Período</Label>
              <Select value={dias.toString()} onValueChange={v => setDias(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="14">Últimos 14 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="60">Últimos 60 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!sucursalId ? (
        <div className="text-center py-16 text-muted-foreground">
          <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona una sucursal para ver el historial de cuadres</p>
        </div>
      ) : (
        <>
          {/* KPIs resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{totalCuadres}</div>
                <div className="text-xs text-muted-foreground mt-1">Turnos cerrados</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`text-3xl font-bold ${porcentajeCumplimiento >= 90 ? 'text-green-600' : porcentajeCumplimiento >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                  {porcentajeCumplimiento}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Sin merma</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`text-3xl font-bold ${cuadresConMerma === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cuadresConMerma}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Con merma</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`text-3xl font-bold ${totalMerma === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalMerma}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Vasos merma total</div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de cuadres */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Historial de cuadres
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cuadres.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay cuadres registrados en este período</p>
                  <p className="text-xs mt-1">Los cuadres se generan al cerrar turno con inventario</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cuadres.map((c: any) => {
                    const diferencia = c.diferencia ?? 0;
                    const esOk = diferencia === 0;
                    const esMerma = diferencia > 0;
                    return (
                      <div key={c.id} className={`rounded-xl border p-4 ${
                        esOk ? 'border-green-200 bg-green-50' :
                        esMerma ? 'border-red-200 bg-red-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {new Date(c.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                              </span>
                              <Badge variant="outline" className="text-xs capitalize">{c.tipoTurno ?? "Turno"}</Badge>
                              {c.empleadoNombre && (
                                <span className="text-xs text-muted-foreground">{c.empleadoNombre}</span>
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Apertura (selladora)</p>
                                <p className="font-semibold">{c.contadorApertura ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Cierre (selladora)</p>
                                <p className="font-semibold">{c.contadorCierre ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Vasos vendidos</p>
                                <p className="font-semibold">{c.vasosVendidos ?? "—"}</p>
                              </div>
                            </div>
                            {c.novedades && (
                              <p className="text-xs text-muted-foreground mt-2 italic">📝 {c.novedades}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            {esOk ? (
                              <div className="flex flex-col items-end gap-1">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <span className="text-xs text-green-600 font-medium">Cuadrado</span>
                              </div>
                            ) : esMerma ? (
                              <div className="flex flex-col items-end gap-1">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <span className="text-lg font-bold text-red-600">-{diferencia}</span>
                                <span className="text-xs text-red-500">vasos merma</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-lg font-bold text-blue-600">+{Math.abs(diferencia)}</span>
                                <span className="text-xs text-blue-500">vasos sobrante</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Explicación del cuadre */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">¿Cómo funciona el cuadre?</p>
              <div className="space-y-1 text-xs text-slate-500">
                <p>• <strong>Selladora apertura</strong>: número que marca la selladora al inicio del turno</p>
                <p>• <strong>Selladora cierre</strong>: número al cerrar turno</p>
                <p>• <strong>Vasos producidos</strong> = Cierre − Apertura (vasos sellados en el turno)</p>
                <p>• <strong>Merma</strong> = Vasos producidos − Vasos vendidos (reportados)</p>
                <p>• Si hay merma, el equipo debe reportar la causa (rotura, muestra, error de cobro)</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
