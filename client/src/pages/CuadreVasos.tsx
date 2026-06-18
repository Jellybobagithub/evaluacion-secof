import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, TrendingDown, CheckCircle2, AlertTriangle, Camera, User, ChevronDown, ChevronUp, Image as ImageIcon, TrendingUp, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function FotoMiniatura({ url, label }: { url?: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-lg bg-slate-100 border flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-slate-300" />
      </div>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
  return (
    <>
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setOpen(true)}>
        <img src={url} alt={label} className="w-14 h-14 rounded-lg object-cover border hover:border-blue-400 transition-colors" />
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">{label}</DialogTitle></DialogHeader>
          <img src={url} alt={label} className="w-full rounded-lg object-contain max-h-[70vh]" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DifBadge({ val, label }: { val: number | null | undefined; label: string }) {
  if (val == null) return <span className="text-xs text-muted-foreground">—</span>;
  if (val === 0) return <span className="text-xs text-green-600 font-medium">✓ OK</span>;
  const cls = val <= 5 ? "text-amber-600" : "text-red-600";
  return <span className={`text-xs font-bold ${cls}`}>±{val} {label}</span>;
}

// ── Tab Historial ──────────────────────────────────────────────────────────────
function HistorialTab({ sucursalId }: { sucursalId: number }) {
  const [dias, setDias] = useState(30);
  const [expandedFotos, setExpandedFotos] = useState<Record<string, boolean>>({});

  const { data: cuadres = [] } = trpc.turno.getCuadresRecientes.useQuery(
    { sucursalId, dias },
    { enabled: !!sucursalId }
  );

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
    { sucursalId, fechaInicio, fechaFin },
    { enabled: !!sucursalId }
  );

  const fotosMap: Record<string, any> = {};
  for (const r of registrosConFotos as any[]) fotosMap[`${r.fecha}-${r.tipoTurno}`] = r;

  const totalAlertas = cuadres.filter((c: any) => c.alertaCuadre).length;
  const pctOk = cuadres.length > 0 ? Math.round((1 - totalAlertas / cuadres.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Filtro + resumen */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 text-sm">
          <span className={`font-bold text-lg ${pctOk >= 90 ? 'text-green-600' : pctOk >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{pctOk}%</span>
          <span className="text-muted-foreground self-center">sin alerta · {totalAlertas} alertas de {cuadres.length} turnos</span>
        </div>
        <Select value={dias.toString()} onValueChange={v => setDias(Number(v))}>
          <SelectTrigger className="w-36 text-xs h-8"><span>{dias} días</span></SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectItem value="7">7 días</SelectItem>
            <SelectItem value="14">14 días</SelectItem>
            <SelectItem value="30">30 días</SelectItem>
            <SelectItem value="60">60 días</SelectItem>
            <SelectItem value="90">90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {cuadres.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin cuadres con datos Odoo en este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(cuadres as any[]).map((c: any) => {
            const alerta = c.alertaCuadre;
            const fechaKey = `${c.fecha}-${c.tipoTurno}`;
            const fotos = fotosMap[fechaKey];
            const expanded = expandedFotos[fechaKey] ?? false;
            const tieneFotos = fotos && (fotos.apertura?.fotoSelladoUrl || fotos.apertura?.fotoUniformeUrl || fotos.cierre?.fotoSelladoCierreUrl);

            return (
              <div key={c.id} className={`rounded-xl border overflow-hidden ${alerta ? 'border-red-200' : 'border-green-200'}`}>
                <div className={`px-4 py-3 ${alerta ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {new Date(c.fecha + 'T12:00:00').toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">{c.tipoTurno}</Badge>
                        {c.empleadoNombre && <span className="text-xs text-muted-foreground">{c.empleadoNombre}</span>}
                      </div>
                      {/* Fila de datos: apertura → odoo → esperado → cierre */}
                      <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
                        <div>
                          <p className="text-muted-foreground">Apertura</p>
                          <p className="font-semibold">{c.vasosApertura ?? c.contadorApertura ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ventas Odoo</p>
                          <p className="font-semibold">{c.vasosOdoo ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cierre real</p>
                          <p className="font-semibold">{c.conteoVasosFinal ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Selladora</p>
                          <p className="font-semibold">{c.contadorSelladoraCierre ?? '—'}</p>
                        </div>
                      </div>
                      {/* Diferencias */}
                      {(c.diferenciaFisica != null || c.diferenciaCuadre != null) && (
                        <div className="mt-1.5 flex gap-3 text-xs">
                          {c.diferenciaFisica != null && (
                            <span className={c.diferenciaFisica > 5 ? 'text-red-600 font-bold' : 'text-green-600'}>
                              Físico: {c.diferenciaFisica === 0 ? '✓ OK' : `±${c.diferenciaFisica}`}
                            </span>
                          )}
                          {c.diferenciaCuadre != null && (
                            <span className={c.diferenciaCuadre > 5 ? 'text-red-600 font-bold' : 'text-green-600'}>
                              Selladora: {c.diferenciaCuadre === 0 ? '✓ OK' : `±${c.diferenciaCuadre}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                      {alerta
                        ? <AlertTriangle className="w-5 h-5 text-red-500" />
                        : <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      <span className={`text-[10px] font-medium ${alerta ? 'text-red-600' : 'text-green-600'}`}>
                        {alerta ? 'Alerta' : 'OK'}
                      </span>
                    </div>
                  </div>

                  {/* Fotos */}
                  <button className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => setExpandedFotos(p => ({ ...p, [fechaKey]: !p[fechaKey] }))}>
                    <Camera className="w-3.5 h-3.5" />
                    {tieneFotos ? <>Evidencia {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</> : <span className="text-slate-400">Sin fotos</span>}
                  </button>
                </div>

                {expanded && fotos && (
                  <div className="border-t bg-white p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fotos.apertura && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <User className="w-3 h-3" /> Apertura — {fotos.apertura.empleadoNombre}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <FotoMiniatura url={fotos.apertura.fotoUniformeUrl} label="Uniforme" />
                            <FotoMiniatura url={fotos.apertura.fotoSelladoUrl} label="Selladora inicio" />
                          </div>
                          {fotos.apertura.contadorSelladora != null && (
                            <p className="text-xs text-slate-500 mt-1">Contador: <strong>{fotos.apertura.contadorSelladora}</strong></p>
                          )}
                        </div>
                      )}
                      {fotos.cierre && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                            <User className="w-3 h-3" /> Cierre — {fotos.cierre.empleadoNombre}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <FotoMiniatura url={fotos.cierre.fotoSelladoCierreUrl} label="Selladora cierre" />
                          </div>
                          {fotos.cierre.contadorSelladoraCierre != null && (
                            <p className="text-xs text-slate-500 mt-1">Contador: <strong>{fotos.cierre.contadorSelladoraCierre}</strong></p>
                          )}
                          {fotos.cierre.novedadesTurno && (
                            <p className="text-xs text-slate-400 mt-1 italic">📝 "{fotos.cierre.novedadesTurno}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab Seguimiento por empleado ──────────────────────────────────────────────
function SeguimientoTab({ sucursalId }: { sucursalId: number }) {
  const [dias, setDias] = useState(90);
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});

  const { data: empleados = [], isLoading } = trpc.turno.historialCuadresEmpleado.useQuery(
    { sucursalId, dias },
    { enabled: !!sucursalId }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">Cuadres con datos Odoo por colaborador</p>
        <Select value={dias.toString()} onValueChange={v => setDias(Number(v))}>
          <SelectTrigger className="w-36 text-xs h-8"><span>{dias} días</span></SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectItem value="30">30 días</SelectItem>
            <SelectItem value="60">60 días</SelectItem>
            <SelectItem value="90">90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>}

      {!isLoading && (empleados as any[]).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin datos en este período</p>
        </div>
      )}

      <div className="space-y-3">
        {(empleados as any[]).map((emp: any) => {
          const pctAlerta = emp.pctAlertas;
          const colorPct = pctAlerta === 0 ? 'text-green-600' : pctAlerta <= 25 ? 'text-amber-600' : 'text-red-600';
          const borderCls = pctAlerta === 0 ? 'border-green-200' : pctAlerta <= 25 ? 'border-amber-200' : 'border-red-200';
          const bgCls = pctAlerta === 0 ? 'bg-green-50' : pctAlerta <= 25 ? 'bg-amber-50' : 'bg-red-50';
          const isOpen = expandido[emp.empleadoId] ?? false;
          const historial: any[] = emp.historial ?? [];

          return (
            <Card key={emp.empleadoId} className={`border ${borderCls}`}>
              <button className="w-full text-left" onClick={() => setExpandido(p => ({ ...p, [emp.empleadoId]: !p[emp.empleadoId] }))}>
                <CardContent className={`py-3 px-4 ${bgCls} rounded-t-lg`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/70 border flex items-center justify-center font-bold text-sm shrink-0">
                        {emp.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{emp.nombre}</p>
                        <p className="text-xs text-muted-foreground">{emp.totalCierres} cierres · últ. {emp.ultimaFecha}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${colorPct}`}>{pctAlerta}%</p>
                        <p className="text-[10px] text-muted-foreground">alertas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{emp.totalAlertas}</p>
                        <p className="text-[10px] text-muted-foreground">de {emp.totalCierres}</p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Mini barra de progreso */}
                  <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pctAlerta === 0 ? 'bg-green-500' : pctAlerta <= 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pctAlerta}%` }} />
                  </div>

                  {/* Tags de tipo de fallo */}
                  {(emp.alertasFisicas > 0 || emp.alertasSelladora > 0) && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {emp.alertasFisicas > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          {emp.alertasFisicas}× físico
                        </span>
                      )}
                      {emp.alertasSelladora > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                          {emp.alertasSelladora}× selladora
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </button>

              {isOpen && historial.length > 0 && (
                <div className="border-t px-4 pb-3 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Últimos 10 cierres</p>
                  <div className="space-y-1">
                    {historial.slice(0, 10).map((h: any, i: number) => {
                      const hasFisica = h.diferenciaFisica != null && h.diferenciaFisica > 5;
                      const hasSell = h.diferenciaCuadre != null && h.diferenciaCuadre > 5;
                      const ok = !h.alerta;
                      return (
                        <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${ok ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className="flex items-center gap-2">
                            {ok ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" /> : <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                            <span className={ok ? 'text-green-700' : 'text-red-700'}>
                              {h.fecha} <span className="opacity-60">{h.tipoTurno?.slice(0,3)}</span>
                            </span>
                          </div>
                          <div className="flex gap-2 text-[10px]">
                            {h.vasosApertura != null && <span className="text-muted-foreground">inicio:{h.vasosApertura}</span>}
                            {h.vasosOdoo != null && <span className="text-muted-foreground">odoo:{h.vasosOdoo}</span>}
                            {h.conteoVasosFinal != null && <span className="text-muted-foreground">cierre:{h.conteoVasosFinal}</span>}
                            {hasFisica && <span className="text-red-600 font-bold">±{h.diferenciaFisica}</span>}
                            {hasSell && <span className="text-orange-600 font-bold">sell:±{h.diferenciaCuadre}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Explicación */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs font-semibold text-slate-600 mb-1.5">¿Cómo se calcula el cuadre?</p>
          <div className="space-y-0.5 text-xs text-slate-500">
            <p>• <strong>Físico:</strong> apertura_vasos − ventas_Odoo = esperado al cierre</p>
            <p>• <strong>Selladora:</strong> contador_cierre − contador_apertura = ventas_Odoo</p>
            <p>• Alerta cuando diferencia &gt; 5 vasos en cualquiera de los dos checks</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function CuadreVasos() {
  const { sucursalId } = useSucursal();

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Cuadre de Vasos</h1>
          <p className="text-sm text-muted-foreground">Físico · Selladora · Odoo</p>
        </div>
      </div>

      <Tabs defaultValue="historial">
        <TabsList className="w-full">
          <TabsTrigger value="historial" className="flex-1 gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Historial
          </TabsTrigger>
          <TabsTrigger value="seguimiento" className="flex-1 gap-1.5">
            <Users className="w-3.5 h-3.5" /> Seguimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="mt-4">
          {sucursalId ? <HistorialTab sucursalId={sucursalId} /> : null}
        </TabsContent>

        <TabsContent value="seguimiento" className="mt-4">
          {sucursalId ? <SeguimientoTab sucursalId={sucursalId} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
