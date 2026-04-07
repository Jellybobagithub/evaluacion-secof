import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Scale, TrendingDown, CheckCircle2, AlertTriangle, ArrowLeft, Camera, User, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";

function FotoMiniatura({ url, label }: { url?: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-slate-300" />
      </div>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
  return (
    <>
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setOpen(true)}>
        <img
          src={url}
          alt={label}
          className="w-16 h-16 rounded-lg object-cover border border-slate-200 hover:border-blue-400 transition-colors"
        />
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>
          <img src={url} alt={label} className="w-full rounded-lg object-contain max-h-[70vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CuadreVasos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [dias, setDias] = useState(30);
  const [expandedFotos, setExpandedFotos] = useState<Record<string, boolean>>({});

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  useEffect(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales]);

  const { data: cuadres = [] } = trpc.turno.getCuadresRecientes.useQuery(
    { sucursalId: sucursalId ?? 0, dias },
    { enabled: !!sucursalId }
  );

  // Calcular rango de fechas para el endpoint de fotos
  const { fechaInicio, fechaFin } = useMemo(() => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - dias);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      fechaInicio: `${inicio.getFullYear()}-${pad(inicio.getMonth() + 1)}-${pad(inicio.getDate())}`,
      fechaFin: `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`,
    };
  }, [dias]);

  const { data: registrosConFotos = [] } = trpc.turno.getRegistrosTurnoConFotos.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio, fechaFin },
    { enabled: !!sucursalId }
  );

  const isLeaderPlus = ["leader", "manager", "owner", "superadmin"].includes(user?.role ?? "");

  // Estadísticas generales
  const totalCuadres = cuadres.length;
  const cuadresOk = cuadres.filter((c: any) => (c.mermaVasos ?? 0) === 0).length;
  const cuadresConMerma = cuadres.filter((c: any) => (c.mermaVasos ?? 0) > 0).length;
  const totalMerma = cuadres.reduce((acc: number, c: any) => acc + ((c.mermaVasos ?? 0) > 0 ? (c.mermaVasos ?? 0) : 0), 0);
  const porcentajeCumplimiento = totalCuadres > 0 ? Math.round(cuadresOk / totalCuadres * 100) : 0;

  // Mapa de fotos por fecha+tipoTurno para lookup rápido
  const fotosMap: Record<string, any> = {};
  for (const r of registrosConFotos as any[]) {
    fotosMap[`${r.fecha}-${r.tipoTurno}`] = r;
  }

  const toggleFotos = (key: string) => {
    setExpandedFotos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1 as any)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Cuadre de Vasos</h1>
          <p className="text-sm text-muted-foreground">Historial de apertura vs cierre de turno</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4">
            {isLeaderPlus && (
              <div className="flex-1 min-w-[160px]">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

          {/* Lista de cuadres con fotos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Historial de cuadres y evidencia fotográfica
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
                    const diferencia = c.mermaVasos ?? 0;
                    const esOk = diferencia === 0;
                    const esMerma = diferencia > 0;
                    const fechaKey = `${c.fecha}-${c.tipoTurno}`;
                    const fotos = fotosMap[fechaKey];
                    const fotosExpanded = expandedFotos[fechaKey] ?? false;
                    const tieneFotos = fotos && (fotos.apertura?.fotoSelladoUrl || fotos.apertura?.fotoUniformeUrl || fotos.cierre?.fotoSelladoCierreUrl);

                    return (
                      <div key={c.id} className={`rounded-xl border overflow-hidden ${
                        esOk ? 'border-green-200' :
                        esMerma ? 'border-red-200' :
                        'border-blue-200'
                      }`}>
                        {/* Fila principal del cuadre */}
                        <div className={`p-4 ${esOk ? 'bg-green-50' : esMerma ? 'bg-red-50' : 'bg-blue-50'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">
                                  {new Date(c.fecha + 'T12:00:00').toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                                </span>
                                <Badge variant="outline" className="text-xs capitalize">{c.tipoTurno ?? "Turno"}</Badge>
                                {c.empleadoNombre && (
                                  <span className="text-xs text-muted-foreground">{c.empleadoNombre}</span>
                                )}
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">Apertura</p>
                                  <p className="font-semibold">{c.contadorApertura ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Cierre</p>
                                  <p className="font-semibold">{c.contadorSelladoraCierre ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Vendidos</p>
                                  <p className="font-semibold">{c.vasosVendidosSelladora ?? "—"}</p>
                                </div>
                              </div>
                              {c.novedadesTurno && (
                                <p className="text-xs text-muted-foreground mt-2 italic">📝 {c.novedadesTurno}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right flex flex-col items-end gap-1">
                              {esOk ? (
                                <>
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                  <span className="text-xs text-green-600 font-medium">Cuadrado</span>
                                </>
                              ) : esMerma ? (
                                <>
                                  <AlertTriangle className="w-5 h-5 text-red-500" />
                                  <span className="text-lg font-bold text-red-600">-{diferencia}</span>
                                  <span className="text-xs text-red-500">vasos merma</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-lg font-bold text-blue-600">+{Math.abs(diferencia)}</span>
                                  <span className="text-xs text-blue-500">sobrante</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Botón para expandir fotos */}
                          <button
                            className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            onClick={() => toggleFotos(fechaKey)}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {tieneFotos ? (
                              <>Evidencia fotográfica {fotosExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</>
                            ) : (
                              <span className="text-slate-400">Sin fotos registradas</span>
                            )}
                          </button>
                        </div>

                        {/* Panel de fotos expandible */}
                        {fotosExpanded && fotos && (
                          <div className="border-t bg-white p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Apertura */}
                              {fotos.apertura && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Apertura — {fotos.apertura.empleadoNombre}
                                  </p>
                                  <div className="flex gap-3 flex-wrap">
                                    <FotoMiniatura url={fotos.apertura.fotoUniformeUrl} label="Uniforme" />
                                    <FotoMiniatura url={fotos.apertura.fotoSelladoUrl} label="Selladora inicio" />
                                  </div>
                                  {fotos.apertura.contadorSelladora != null && (
                                    <p className="text-xs text-slate-500 mt-2">
                                      Contador apertura: <strong>{fotos.apertura.contadorSelladora}</strong>
                                    </p>
                                  )}
                                  {fotos.apertura.notas && (
                                    <p className="text-xs text-slate-400 mt-1 italic">"{fotos.apertura.notas}"</p>
                                  )}
                                </div>
                              )}
                              {/* Cierre */}
                              {fotos.cierre && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Cierre — {fotos.cierre.empleadoNombre}
                                  </p>
                                  <div className="flex gap-3 flex-wrap">
                                    <FotoMiniatura url={fotos.cierre.fotoSelladoCierreUrl} label="Selladora cierre" />
                                  </div>
                                  {fotos.cierre.contadorSelladoraCierre != null && (
                                    <p className="text-xs text-slate-500 mt-2">
                                      Contador cierre: <strong>{fotos.cierre.contadorSelladoraCierre}</strong>
                                    </p>
                                  )}
                                  {fotos.cierre.novedadesTurno && (
                                    <p className="text-xs text-slate-400 mt-1 italic">📝 "{fotos.cierre.novedadesTurno}"</p>
                                  )}
                                </div>
                              )}
                              {!fotos.apertura && !fotos.cierre && (
                                <p className="text-xs text-slate-400 col-span-2">No hay registros de apertura ni cierre para este turno.</p>
                              )}
                            </div>
                          </div>
                        )}
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
