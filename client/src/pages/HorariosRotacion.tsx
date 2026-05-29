import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronDown, RefreshCw, Pencil, Wand2, ChevronLeft, ChevronRight, CalendarDays, UserX, UserCheck, Clock, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const AREA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  caja:              { label: "Caja",       color: "bg-blue-100 text-blue-800 border-blue-200",   bg: "bg-blue-400" },
  preparacion:       { label: "Prep",       color: "bg-green-100 text-green-800 border-green-200", bg: "bg-green-400" },
  comodin:           { label: "Comodín",    color: "bg-purple-100 text-purple-800 border-purple-200", bg: "bg-purple-400" },
  caja_y_preparacion:{ label: "Caja+Prep",  color: "bg-orange-100 text-orange-800 border-orange-200", bg: "bg-orange-400" },
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

function toMin(h: string) { const [hr, m] = h.split(":").map(Number); return hr * 60 + m; }

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

// ─── Timeline Visual ─────────────────────────────────────────────────────────
function TimelineDia({ bloques, empleados }: { bloques: any[]; empleados: any[] }) {
  if (!bloques.length) return null;
  const allMins = bloques.flatMap(b => [toMin(b.horaInicio), toMin(b.horaFin)]);
  const minH = Math.min(...allMins);
  const maxH = Math.max(...allMins);
  const total = maxH - minH;
  if (total <= 0) return null;

  const empIds = [...new Set(bloques.map(b => b.empleadoId))];
  const horas: number[] = [];
  for (let m = minH; m <= maxH; m += 60) horas.push(m);
  const fmt = (m: number) => `${Math.floor(m/60).toString().padStart(2,"0")}:00`;

  return (
    <div className="mt-4 rounded-xl border overflow-hidden bg-white">
      <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Timeline del día
      </div>
      <div className="p-3 overflow-x-auto">
        <div style={{ minWidth: 480 }}>
          {/* Horas */}
          <div className="flex mb-2 ml-28">
            {horas.map(h => (
              <div key={h} style={{ width: `${(60/total)*100}%` }} className="text-xs text-muted-foreground shrink-0 text-center">
                {fmt(h)}
              </div>
            ))}
          </div>
          {/* Filas por empleado */}
          {empIds.map(empId => {
            const emp = empleados.find((e: any) => e.id === empId);
            const filas = bloques.filter(b => b.empleadoId === empId);
            return (
              <div key={empId} className="flex items-center mb-1.5">
                <div className="w-28 text-xs font-medium truncate pr-2 shrink-0 text-right">
                  {emp?.nombre ?? `#${empId}`}
                </div>
                <div className="flex-1 relative h-8 bg-muted/20 rounded-lg overflow-hidden">
                  {filas.map((b, i) => {
                    const left = ((toMin(b.horaInicio) - minH) / total) * 100;
                    const width = ((toMin(b.horaFin) - toMin(b.horaInicio)) / total) * 100;
                    return (
                      <div key={i}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        className={`absolute inset-y-0.5 rounded flex items-center justify-center text-xs text-white font-medium ${AREA_CONFIG[b.area]?.bg ?? "bg-gray-400"}`}
                        title={`${AREA_CONFIG[b.area]?.label} ${b.horaInicio}–${b.horaFin}`}>
                        {width > 8 ? AREA_CONFIG[b.area]?.label : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Leyenda */}
          <div className="flex gap-3 mt-3 flex-wrap">
            {Object.entries(AREA_CONFIG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${v.bg}`} />
                <span className="text-xs text-muted-foreground">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Rotación Semanal ────────────────────────────────────────────────────
function RotacionSemanalTab({ sucursalId }: { sucursalId: number | null }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editDialog, setEditDialog] = useState<{empleadoId:number;fecha:string;nombre:string;area:string;horaInicio:string;horaFin:string}|null>(null);
  const semana = getWeekRange(weekOffset);

  const { data: rotacion = [], refetch, isLoading } = trpc.rotacion.getSemana.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: semana.inicio, fechaFin: semana.fin },
    { enabled: !!sucursalId }
  );
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 }, { enabled: !!sucursalId }
  );
  const utils = trpc.useUtils();
  const generarMut = trpc.rotacion.generarSemana.useMutation({
    onSuccess: d => { toast.success(`Rotación generada: ${d.generados} asignaciones`); refetch(); },
    onError: e => toast.error(e.message),
  });
  const editarMut = trpc.rotacion.editarDia.useMutation({
    onSuccess: () => { toast.success("Área actualizada"); utils.rotacion.getSemana.invalidate(); setEditDialog(null); },
    onError: e => toast.error(e.message),
  });

  const fechasSemana = useMemo(() => {
    const fs: string[] = [];
    const cur = new Date(semana.inicio + "T12:00:00Z");
    const end = new Date(semana.fin + "T12:00:00Z");
    while (cur <= end) { fs.push(cur.toISOString().split("T")[0]); cur.setUTCDate(cur.getUTCDate() + 1); }
    return fs;
  }, [semana.inicio, semana.fin]);

  const porFecha = useMemo(() => {
    const m: Record<string, typeof rotacion> = {};
    for (const r of rotacion) { if (!m[r.fecha]) m[r.fecha] = []; m[r.fecha].push(r); }
    return m;
  }, [rotacion]);


  // ── Generar PDF del horario semanal ──────────────────────────────────────
  const generarPDFHorario = () => {
    const semanaLabel = `Semana ${fechaInicio} — ${fechaFin}`;
    const filas = (turnos as any[]).map(t => {
      const emp = empleadosData?.find((e: any) => e.id === t.empleadoId);
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${emp?.nombre ?? '—'} ${emp?.apellido ?? ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.fecha}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${t.turno}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.horaInicio} — ${t.horaFin}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.rolPrincipal ?? '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Horario Semanal Snowtea</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
      h1 { color: #1B5E37; margin-bottom: 4px; font-size: 20px; }
      p { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead tr { background: #1B5E37; color: white; }
      thead th { padding: 10px 12px; text-align: left; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
    </style></head>
    <body>
      <h1>🗓 Horario Semanal — Plaza Patio</h1>
      <p>${semanaLabel}</p>
      <table>
        <thead><tr>
          <th>Empleado</th><th>Fecha</th><th>Turno</th><th>Horario</th><th>Rol</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="footer">Generado por SECOF · secof.snowteatienda.com · ${new Date().toLocaleDateString('es-MX')}</div>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => { win.print(); };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w-1)} className="p-1.5 rounded-lg border hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-52 text-center">{semana.label}</span>
          <button onClick={() => setWeekOffset(w => w+1)} className="p-1.5 rounded-lg border hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Button onClick={() => sucursalId && generarMut.mutate({ sucursalId, fechaInicio: semana.inicio, fechaFin: semana.fin })}
          disabled={!sucursalId || generarMut.isPending} className="bg-violet-600 hover:bg-violet-700">
          <Wand2 className="w-4 h-4 mr-2" />
          {generarMut.isPending ? "Generando..." : "Sugerir semana"}
        </Button>
        <Button variant="outline" onClick={generarPDFHorario} disabled={!sucursalId} className="gap-2">
          <Download className="w-4 h-4" />
          PDF
        </Button>
        <button onClick={() => refetch()} className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Actualizar
        </button>
      </div>

      {!sucursalId ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Selecciona una sucursal</div>
      ) : isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Cargando...</div>
      ) : rotacion.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-muted-foreground text-sm">Sin rotación para esta semana.</p>
          <Button variant="outline" onClick={() => sucursalId && generarMut.mutate({ sucursalId, fechaInicio: semana.inicio, fechaFin: semana.fin })}>
            <Wand2 className="w-4 h-4 mr-2" /> Generar sugerencia
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fechasSemana.map(fecha => {
            const asignaciones = porFecha[fecha] ?? [];
            const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
            const fechaLabel = new Date(fecha + "T12:00:00Z").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
            const empSinAsignar = empleados.filter(e => {
              let hp: Record<number,any> = {};
              try { const h = (e as any).horarioPersonal; hp = typeof h==="string"?JSON.parse(h):(h??{}); } catch {}
              return hp[diaSemana]!==null && hp[diaSemana]!==undefined && !asignaciones.find(a => a.empleadoId===e.id);
            });
            return (
              <div key={fecha} className="bg-card rounded-2xl border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <p className="font-semibold text-sm capitalize">{fechaLabel}</p>
                  <span className="text-xs text-muted-foreground">{asignaciones.length} asignación(es)</span>
                </div>
                <div className="divide-y">
                  {asignaciones.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs shrink-0">
                        {(a.empleadoNombre ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{a.empleadoNombre} {a.empleadoApellido ?? ""}</p>
                        <p className="text-xs text-muted-foreground">{a.horaInicio} – {a.horaFin}{a.esManual ? " · editado" : ""}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${AREA_CONFIG[a.area]?.color ?? "bg-gray-100"}`}>
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
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-xs shrink-0">{e.nombre.charAt(0)}</div>
                      <div className="flex-1"><p className="font-medium text-sm">{e.nombre}</p><p className="text-xs text-orange-500">Sin área asignada</p></div>
                      <button onClick={() => setEditDialog({empleadoId:e.id,fecha,nombre:e.nombre,area:"caja",horaInicio:"",horaFin:""})}
                        className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full hover:bg-orange-200">+ Asignar</button>
                    </div>
                  ))}
                  {asignaciones.length===0 && empSinAsignar.length===0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground">Sin empleados este día</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editDialog} onOpenChange={o => !o && setEditDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar área – {editDialog?.nombre}</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Área</label>
                <NativeSelect value={editDialog.area} onChange={v => setEditDialog(d => d?{...d,area:v}:null)}>
                  <option value="caja">Caja</option>
                  <option value="preparacion">Preparación</option>
                  <option value="comodin">Comodín</option>
                  <option value="caja_y_preparacion">Caja + Preparación</option>
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Hora entrada</label>
                  <input type="time" value={editDialog.horaInicio} onChange={e => setEditDialog(d => d?{...d,horaInicio:e.target.value}:null)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Hora salida</label>
                  <input type="time" value={editDialog.horaFin} onChange={e => setEditDialog(d => d?{...d,horaFin:e.target.value}:null)}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <Button className="w-full" disabled={editarMut.isPending}
                onClick={() => editarMut.mutate({sucursalId:sucursalId??30001,empleadoId:editDialog.empleadoId,fecha:editDialog.fecha,area:editDialog.area as any,horaInicio:editDialog.horaInicio||undefined,horaFin:editDialog.horaFin||undefined})}>
                {editarMut.isPending?"Guardando...":"Guardar cambio"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Ajuste Eventual ─────────────────────────────────────────────────────
function AjusteEventualTab({ sucursalId }: { sucursalId: number | null }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(hoy);
  const [timeline, setTimeline] = useState<any[]>([]);

  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 }, { enabled: !!sucursalId }
  );
  const { data: ajustesDB = [], refetch: refetchAjustes } = trpc.ajustesEventuales.getByFecha.useQuery(
    { sucursalId: sucursalId ?? 0, fecha }, { enabled: !!sucursalId }
  );

  // Estado local de ajustes (sobreescribe horarioPersonal)
  const [ajustes, setAjustes] = useState<Record<number, { ausente: boolean; entrada: string; salida: string; motivo: string }>>({});

  // Calcular qué empleados tienen turno ese día según horarioPersonal
  const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
  const empsProgramados = useMemo(() => {
    return empleados.filter((e: any) => {
      let hp: Record<number,any> = {};
      try { hp = typeof e.horarioPersonal==="string"?JSON.parse(e.horarioPersonal):(e.horarioPersonal??{}); } catch {}
      return hp[diaSemana] !== null && hp[diaSemana] !== undefined;
    }).map((e: any) => {
      let hp: Record<number,any> = {};
      try { hp = typeof e.horarioPersonal==="string"?JSON.parse(e.horarioPersonal):(e.horarioPersonal??{}); } catch {}
      const dia = hp[diaSemana];
      return { ...e, entradaFija: dia?.entrada ?? "", salidaFija: dia?.salida ?? "" };
    });
  }, [empleados, diaSemana]);

  // Cargar ajustes guardados al cambiar fecha
  useEffect(() => {
    const m: Record<number,{ausente:boolean;entrada:string;salida:string;motivo:string}> = {};
    for (const a of ajustesDB as any[]) {
      m[Number(a.empleadoId)] = { ausente: !!a.ausente, entrada: a.horaEntrada ?? "", salida: a.horaSalida ?? "", motivo: a.motivo ?? "" };
    }
    setAjustes(m);
    setTimeline([]);
  }, [ajustesDB]);

  const guardarMut = trpc.ajustesEventuales.guardar.useMutation({
    onError: e => toast.error(e.message),
  });
  const eliminarMut = trpc.ajustesEventuales.eliminar.useMutation({
    onError: e => toast.error(e.message),
  });
  const generarMut = trpc.ajustesEventuales.generarRotacionDia.useMutation({
    onSuccess: d => {
      toast.success(`✅ Rotación generada: ${d.asignaciones} asignaciones para ${d.activos} empleados`);
      setTimeline(d.bloques);
    },
    onError: e => toast.error(e.message),
  });

  const handleGuardar = async () => {
    if (!sucursalId) return;
    const todosEmps = [...empsProgramados, ...empsExtraDetalle];
    for (const emp of todosEmps) {
      const aj = ajustes[emp.id];
      if (aj) {
        await guardarMut.mutateAsync({
          sucursalId, empleadoId: emp.id, fecha,
          ausente: aj.ausente,
          horaEntrada: aj.ausente ? undefined : (aj.entrada || emp.entradaFija || "09:00"),
          horaSalida:  aj.ausente ? undefined : (aj.salida  || emp.salidaFija  || "17:00"),
          motivo: aj.motivo || undefined,
        });
      } else if (empsExtraDetalle.find((e: any) => e.id === emp.id)) {
        // Empleado extra sin ajuste configurado — guardar con horario vacío
        await guardarMut.mutateAsync({
          sucursalId, empleadoId: emp.id, fecha,
          ausente: false,
          horaEntrada: "09:00",
          horaSalida: "17:00",
          motivo: "Turno extra",
        });
      }
    }
    refetchAjustes();
    toast.success("Ajustes guardados");
  };

  // Empleados extra (no programados ese día pero agregados manualmente)
  const [empsExtra, setEmpsExtra] = useState<number[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);

  const empsNoProgram = useMemo(() =>
    empleados.filter((e: any) => !empsProgramados.find((ep: any) => ep.id === e.id)),
    [empleados, empsProgramados]
  );

  const agregarExtra = (empId: number) => {
    if (!empsExtra.includes(empId)) setEmpsExtra(prev => [...prev, empId]);
    setShowAddExtra(false);
  };

  const quitarExtra = (empId: number) => {
    setEmpsExtra(prev => prev.filter(id => id !== empId));
    setAjustes(prev => { const n = {...prev}; delete n[empId]; return n; });
  };

  const empsExtraDetalle = useMemo(() =>
    empsExtra.map(id => {
      const e = empleados.find((e: any) => e.id === id);
      return e ? { ...e, entradaFija: "", salidaFija: "" } : null;
    }).filter(Boolean),
    [empsExtra, empleados]
  );

  const setAj = (empId: number, campo: string, valor: any) => {
    setAjustes(prev => ({ ...prev, [empId]: { ausente: false, entrada: "", salida: "", motivo: "", ...prev[empId], [campo]: valor } }));
  };

  if (!sucursalId) return <div className="py-12 text-center text-muted-foreground text-sm">Selecciona una sucursal</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Fecha del ajuste:</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <span className="text-sm text-muted-foreground capitalize">
          {new Date(fecha+"T12:00:00Z").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}
        </span>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>Horario base</strong> viene del perfil de cada empleado. Aquí puedes registrar ausencias o cambios de horario para este día específico sin modificar el horario fijo.
      </div>

      {empsProgramados.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">No hay empleados programados para este día según sus horarios fijos.</div>
      ) : (
        <div className="space-y-2">
          {empsProgramados.map((emp: any) => {
            const aj = ajustes[emp.id];
            const ausente = aj?.ausente ?? false;
            return (
              <div key={emp.id} className={`rounded-xl border p-4 transition-colors ${ausente ? "bg-red-50 border-red-200" : "bg-card"}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${ausente ? "bg-red-100 text-red-600" : "bg-violet-100 text-violet-700"}`}>
                    {emp.nombre.charAt(0)}
                  </div>
                  {/* Nombre */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{emp.nombre} {emp.apellido ?? ""}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horario fijo: {emp.entradaFija} – {emp.salidaFija}
                    </p>
                  </div>
                  {/* Toggle Presente/Ausente */}
                  <button
                    onClick={() => setAj(emp.id, "ausente", !ausente)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      ausente ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}>
                    {ausente ? <><UserX className="w-3.5 h-3.5" /> Ausente</> : <><UserCheck className="w-3.5 h-3.5" /> Presente</>}
                  </button>
                </div>

                {/* Campos adicionales */}
                {!ausente && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Entrada (ajuste)</label>
                      <input type="time" value={aj?.entrada ?? emp.entradaFija}
                        onChange={e => setAj(emp.id, "entrada", e.target.value)}
                        className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Salida (ajuste)</label>
                      <input type="time" value={aj?.salida ?? emp.salidaFija}
                        onChange={e => setAj(emp.id, "salida", e.target.value)}
                        className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                    </div>
                  </div>
                )}
                {ausente && (
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground mb-1 block">Motivo (opcional)</label>
                    <input type="text" placeholder="Ej: Cita médica, permiso, etc." value={aj?.motivo ?? ""}
                      onChange={e => setAj(emp.id, "motivo", e.target.value)}
                      className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Agregar empleado extra ─────────────────────────────────────── */}
      <div className="border border-dashed border-violet-300 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-violet-700">Empleados adicionales para este día</span>
          {empsNoProgram.length > 0 && (
            <button onClick={() => setShowAddExtra(v => !v)}
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium">
              <span className="text-lg leading-none">+</span> Agregar empleado
            </button>
          )}
        </div>
        {showAddExtra && (
          <div className="mb-3 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
            {empsNoProgram.map((e: any) => (
              <button key={e.id} onClick={() => agregarExtra(e.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-violet-50 text-left text-sm border border-transparent hover:border-violet-200 transition-colors">
                <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {e.nombre.charAt(0)}
                </div>
                <span>{e.nombre} {e.apellido ?? ""}</span>
                <span className="ml-auto text-xs text-muted-foreground">{e.puesto ?? ""}</span>
              </button>
            ))}
          </div>
        )}
        {empsExtraDetalle.length === 0 && !showAddExtra && (
          <p className="text-xs text-muted-foreground">No hay empleados extra agregados para este día.</p>
        )}
        {empsExtraDetalle.map((emp: any) => {
          const aj = ajustes[emp.id];
          const ausente = aj?.ausente ?? false;
          return (
            <div key={emp.id} className={`rounded-xl border p-4 mb-2 transition-colors ${ausente ? "bg-red-50 border-red-200" : "bg-violet-50 border-violet-200"}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-9 h-9 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center font-semibold text-sm shrink-0">
                  {emp.nombre.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{emp.nombre} {emp.apellido ?? ""}</p>
                  <p className="text-xs text-violet-500">Turno extra · no programado</p>
                </div>
                <button onClick={() => setAj(emp.id, "ausente", !ausente)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    ausente ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}>
                  {ausente ? <><UserX className="w-3.5 h-3.5" /> Ausente</> : <><UserCheck className="w-3.5 h-3.5" /> Presente</>}
                </button>
                <button onClick={() => quitarExtra(emp.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">✕</button>
              </div>
              {!ausente && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Entrada</label>
                    <input type="time" value={aj?.entrada ?? "09:00"}
                      onChange={e => setAj(emp.id, "entrada", e.target.value)}
                      className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Salida</label>
                    <input type="time" value={aj?.salida ?? "17:00"}
                      onChange={e => setAj(emp.id, "salida", e.target.value)}
                      className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Acciones */}
      {(empsProgramados.length > 0 || empsExtraDetalle.length > 0) && (
        <div className="flex gap-3 flex-wrap pt-2">
          <Button variant="outline" onClick={handleGuardar} disabled={guardarMut.isPending}>
            {guardarMut.isPending ? "Guardando..." : "💾 Guardar ajustes"}
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700"
            onClick={() => sucursalId && generarMut.mutate({ sucursalId, fecha })}
            disabled={generarMut.isPending}>
            <Wand2 className="w-4 h-4 mr-2" />
            {generarMut.isPending ? "Generando..." : "Generar rotación del día"}
          </Button>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <TimelineDia bloques={timeline} empleados={empleados} />
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function HorariosRotacion() {
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();

  useEffect(() => {
    if (sucursales.length === 1 && sucursalId === null) setSucursalId(sucursales[0].id);
  }, [sucursales.length]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Horarios y Rotación de Áreas</h1>
          <p className="text-sm text-muted-foreground">Rotación semanal y ajustes eventuales por día</p>
        </div>
        {sucursales.length > 1 && (
          <div className="w-48">
            <NativeSelect value={sucursalId?.toString() ?? ""} onChange={v => setSucursalId(Number(v))}>
              <option value="">Sucursal...</option>
              {sucursales.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </NativeSelect>
          </div>
        )}
      </div>

      <Tabs defaultValue="rotacion">
        <TabsList>
          <TabsTrigger value="rotacion" className="gap-1.5">
            <Wand2 className="w-3.5 h-3.5" /> Rotación Semanal
          </TabsTrigger>
          <TabsTrigger value="ajuste" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Ajuste Eventual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rotacion" className="mt-4">
          <RotacionSemanalTab sucursalId={sucursalId} />
        </TabsContent>
        <TabsContent value="ajuste" className="mt-4">
          <AjusteEventualTab sucursalId={sucursalId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
