import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, RefreshCw, Pencil, Wand2, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AREA_CONFIG: Record<string, { label: string; color: string }> = {
  caja:              { label: "Caja",        color: "bg-blue-100 text-blue-800 border-blue-200" },
  preparacion:       { label: "Preparacion", color: "bg-green-100 text-green-800 border-green-200" },
  comodin:           { label: "Comodin",     color: "bg-purple-100 text-purple-800 border-purple-200" },
  caja_y_preparacion:{ label: "Caja+Prep",   color: "bg-orange-100 text-orange-800 border-orange-200" },
};

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon + offset * 7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const label = mon.toLocaleDateString("es-MX",{day:"2-digit",month:"short"}) + " - " + sun.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
  return { inicio: fmt(mon), fin: fmt(sun), label };
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 px-3 pr-8 text-sm rounded-lg border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

export default function HorariosRotacion() {
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editDialog, setEditDialog] = useState<{empleadoId:number;fecha:string;nombre:string;area:string;horaInicio:string;horaFin:string} | null>(null);
  const semana = getWeekRange(weekOffset);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  // Auto-seleccionar cuando el usuario solo tiene una sucursal (líder con 1 tienda)
  // Sin esto sucursalId queda null y la query nunca se ejecuta
  useMemo(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales.length]);
  const { data: rotacion = [], refetch, isLoading } = trpc.rotacion.getSemana.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: semana.inicio, fechaFin: semana.fin },
    { enabled: !!sucursalId }
  );
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 }, { enabled: !!sucursalId }
  );

  const utils = trpc.useUtils();
  const generarMut = trpc.rotacion.generarSemana.useMutation({
    onSuccess: (d) => { toast.success("Rotacion generada: " + d.generados + " asignaciones"); refetch(); },
    onError: e => toast.error(e.message),
  });
  const editarMut = trpc.rotacion.editarDia.useMutation({
    onSuccess: () => { toast.success("Area actualizada"); utils.rotacion.getSemana.invalidate(); setEditDialog(null); },
    onError: e => toast.error(e.message),
  });

  const fechasSemana = useMemo(() => {
    const fechas = [];
    const cur = new Date(semana.inicio + "T12:00:00Z");
    const end = new Date(semana.fin + "T12:00:00Z");
    while (cur <= end) { fechas.push(cur.toISOString().split("T")[0]); cur.setUTCDate(cur.getUTCDate() + 1); }
    return fechas;
  }, [semana.inicio, semana.fin]);

  const porFecha = useMemo(() => {
    const m: Record<string, typeof rotacion> = {};
    for (const r of rotacion) { if (!m[r.fecha]) m[r.fecha] = []; m[r.fecha].push(r); }
    return m;
  }, [rotacion]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Rotacion de Areas</h1>
          <p className="text-sm text-muted-foreground">Asignacion semanal de Caja, Preparacion y Comodin</p>
        </div>
        <Button onClick={() => sucursalId && generarMut.mutate({ sucursalId, fechaInicio: semana.inicio, fechaFin: semana.fin })}
          disabled={!sucursalId || generarMut.isPending} className="bg-violet-600 hover:bg-violet-700">
          <Wand2 className="w-4 h-4 mr-2" />
          {generarMut.isPending ? "Generando..." : "Sugerir rotacion"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {sucursales.length > 1 && (
          <div className="w-48">
            <NativeSelect value={sucursalId?.toString() ?? ""} onChange={v => setSucursalId(Number(v))}>
              <option value="">Sucursal...</option>
              {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </NativeSelect>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w-1)} className="p-1.5 rounded-lg border hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium min-w-52 text-center">{semana.label}</span>
          <button onClick={() => setWeekOffset(w => w+1)} className="p-1.5 rounded-lg border hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => refetch()} className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
      </div>

      {sucursalId && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : rotacion.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">Sin rotacion para esta semana.</p>
              <Button variant="outline" onClick={() => sucursalId && generarMut.mutate({ sucursalId, fechaInicio: semana.inicio, fechaFin: semana.fin })}>
                <Wand2 className="w-4 h-4 mr-2" /> Generar sugerencia
              </Button>
            </div>
          ) : (
            fechasSemana.map(fecha => {
              const asignaciones = porFecha[fecha] ?? [];
              const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
              const fechaLabel = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
              const empSinAsignar = empleados.filter(e => {
                let hp: Record<number,any> = {};
                try { const h = (e as any).horarioPersonal; hp = typeof h === "string" ? JSON.parse(h) : (h ?? {}); } catch {}
                return hp[diaSemana] !== null && hp[diaSemana] !== undefined && !asignaciones.find(a => a.empleadoId === e.id);
              });
              return (
                <div key={fecha} className="bg-card rounded-2xl border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                    <p className="font-semibold text-sm capitalize">{fechaLabel}</p>
                    <span className="text-xs text-muted-foreground">{asignaciones.length} asignacion(es)</span>
                  </div>
                  <div className="divide-y">
                    {asignaciones.map(a => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs shrink-0">
                          {(a.empleadoNombre ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{a.empleadoNombre} {a.empleadoApellido ?? ""}</p>
                          <p className="text-xs text-muted-foreground">{a.horaInicio} - {a.horaFin}{a.esManual ? " (editado)" : ""}</p>
                        </div>
                        <span className={"text-xs font-medium px-2 py-1 rounded-full border " + (AREA_CONFIG[a.area]?.color ?? "bg-gray-100")}>
                          {AREA_CONFIG[a.area]?.label ?? a.area}
                        </span>
                        <button onClick={() => setEditDialog({empleadoId:a.empleadoId,fecha,nombre:(a.empleadoNombre??"")+" "+(a.empleadoApellido??""),area:a.area,horaInicio:a.horaInicio??"",horaFin:a.horaFin??""})}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {empSinAsignar.map(e => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-3 bg-orange-50/50">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-xs shrink-0">
                          {e.nombre.charAt(0)}
                        </div>
                        <div className="flex-1"><p className="font-medium text-sm">{e.nombre}</p><p className="text-xs text-orange-500">Sin area asignada</p></div>
                        <button onClick={() => setEditDialog({empleadoId:e.id,fecha,nombre:e.nombre,area:"caja",horaInicio:"",horaFin:""})}
                          className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full hover:bg-orange-200">
                          + Asignar
                        </button>
                      </div>
                    ))}
                    {asignaciones.length === 0 && empSinAsignar.length === 0 && (
                      <div className="px-4 py-3 text-xs text-muted-foreground">Sin empleados este dia</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Dialog open={!!editDialog} onOpenChange={o => !o && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar area - {editDialog?.nombre}</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Area</label>
                <NativeSelect value={editDialog.area} onChange={v => setEditDialog(d => d ? {...d,area:v} : null)}>
                  <option value="caja">Caja</option>
                  <option value="preparacion">Preparacion</option>
                  <option value="comodin">Comodin</option>
                  <option value="caja_y_preparacion">Caja + Preparacion</option>
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Hora entrada</label>
                  <input type="time" value={editDialog.horaInicio} onChange={e => setEditDialog(d => d ? {...d,horaInicio:e.target.value} : null)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Hora salida</label>
                  <input type="time" value={editDialog.horaFin} onChange={e => setEditDialog(d => d ? {...d,horaFin:e.target.value} : null)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <Button className="w-full" disabled={editarMut.isPending}
                onClick={() => editarMut.mutate({sucursalId:sucursalId!,empleadoId:editDialog.empleadoId,fecha:editDialog.fecha,area:editDialog.area as any,horaInicio:editDialog.horaInicio||undefined,horaFin:editDialog.horaFin||undefined})}>
                {editarMut.isPending ? "Guardando..." : "Guardar cambio"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
