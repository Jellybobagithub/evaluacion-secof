import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Copy, Printer, Users } from "lucide-react";

// ─── Helpers de semana ISO ────────────────────────────────────────────────────
function getSemanaISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getLunesDeSemana(semana: string): Date {
  const [year, wStr] = semana.split("-W");
  const w = Number(wStr);
  const jan4 = new Date(Number(year), 0, 4);
  const lunes = new Date(jan4.getTime() + (w - 1) * 7 * 86400000 - ((jan4.getDay() + 6) % 7) * 86400000);
  return lunes;
}

function semanaLabel(semana: string) {
  const lunes = getLunesDeSemana(semana);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  return `${lunes.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${domingo.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`;
}

function navSemana(semana: string, delta: number) {
  const lunes = getLunesDeSemana(semana);
  lunes.setDate(lunes.getDate() + delta * 7);
  return getSemanaISO(lunes);
}

// ─── Configuración de turnos ──────────────────────────────────────────────────
const TURNOS: Record<string, { label: string; short: string; color: string; bg: string }> = {
  M:  { label: "Matutino",     short: "M",  color: "text-blue-700",  bg: "bg-blue-100 border-blue-300" },
  V:  { label: "Vespertino",   short: "V",  color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
  MV: { label: "Doble turno",  short: "MV", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  D:  { label: "Descanso",     short: "D",  color: "text-gray-500",  bg: "bg-gray-100 border-gray-300" },
};

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
type Dia = typeof DIAS[number];

const DIA_LABELS: Record<Dia, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié",
  jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Horarios() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [semana, setSemana] = useState(() => getSemanaISO());

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId }
  );
  const { data: horarios = [], refetch } = trpc.horarios.list.useQuery(
    { sucursalId: sucursalId ?? 0, semana },
    { enabled: !!sucursalId }
  );
  const utils = trpc.useUtils();

  const upsertMut = trpc.horarios.upsert.useMutation({
    onSuccess: () => utils.horarios.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const copyMut = trpc.horarios.copyFromPrevious.useMutation({
    onSuccess: (data) => {
      utils.horarios.list.invalidate();
      toast.success(`${data.copiados} empleados copiados de la semana anterior`);
    },
    onError: (e) => toast.error(e.message),
  });

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  // Mapa empleadoId → horario
  const horarioMap = useMemo(() => {
    const m: Record<number, Record<Dia, string | null>> = {};
    for (const h of horarios) {
      m[h.empleadoId] = {
        lunes: h.lunes ?? null,
        martes: h.martes ?? null,
        miercoles: h.miercoles ?? null,
        jueves: h.jueves ?? null,
        viernes: h.viernes ?? null,
        sabado: h.sabado ?? null,
        domingo: h.domingo ?? null,
      };
    }
    return m;
  }, [horarios]);

  function getTurno(empleadoId: number, dia: Dia): string | null {
    return horarioMap[empleadoId]?.[dia] ?? null;
  }

  function cycleTurno(empleadoId: number, dia: Dia) {
    if (!canEdit || !sucursalId) return;
    const current = getTurno(empleadoId, dia);
    const opciones = [null, "M", "V", "MV", "D"];
    const idx = opciones.indexOf(current);
    const next = opciones[(idx + 1) % opciones.length];
    const currentHorario = horarioMap[empleadoId] ?? { lunes: null, martes: null, miercoles: null, jueves: null, viernes: null, sabado: null, domingo: null };
    upsertMut.mutate({
      sucursalId,
      empleadoId,
      semana,
      ...currentHorario,
      [dia]: next,
    });
  }

  // Calcular horas/días por empleado
  function calcularDias(empleadoId: number) {
    let dias = 0;
    for (const dia of DIAS) {
      const t = getTurno(empleadoId, dia);
      if (t && t !== "D") dias++;
    }
    return dias;
  }

  // Contar cuántos trabajan cada día
  function contarPorDia(dia: Dia) {
    return empleados.filter(e => {
      const t = getTurno(e.id, dia);
      return t && t !== "D";
    }).length;
  }

  // Exportar a PDF usando la ventana de impresión del navegador
  function exportarPDF() {
    const sucursal = sucursales.find(s => s.id === sucursalId);
    const lunes = getLunesDeSemana(semana);

    const filas = empleados.map(emp => {
      const dias = DIAS.map(dia => {
        const t = getTurno(emp.id, dia);
        return `<td style="text-align:center;padding:6px 4px;border:1px solid #e2e8f0;font-size:12px;background:${t === "D" ? "#f1f5f9" : t ? "#eff6ff" : "#fff"};color:${t === "D" ? "#94a3b8" : t ? "#1d4ed8" : "#94a3b8"}">${t ?? "—"}</td>`;
      }).join("");
      return `<tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;font-weight:500">${emp.nombre} ${emp.apellido ?? ""}</td><td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;color:#64748b">${emp.rol}</td>${dias}<td style="text-align:center;padding:6px 4px;border:1px solid #e2e8f0;font-size:12px;font-weight:600">${calcularDias(emp.id)}d</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Horario Semanal</title>
    <style>body{font-family:Arial,sans-serif;margin:20px}h1{font-size:16px;margin-bottom:4px}p{font-size:12px;color:#64748b;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:white;padding:8px 4px;font-size:12px;border:1px solid #1e3a5f}@media print{button{display:none}}</style>
    </head><body>
    <h1>Horario Semanal — ${sucursal?.nombre ?? "Sucursal"}</h1>
    <p>${semanaLabel(semana)}</p>
    <table>
      <thead><tr>
        <th style="text-align:left;min-width:140px">Empleado</th>
        <th>Rol</th>
        ${DIAS.map(d => `<th>${DIA_LABELS[d]}<br><span style="font-size:10px;font-weight:normal">${new Date(lunes.getTime() + DIAS.indexOf(d) * 86400000).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></th>`).join("")}
        <th>Días</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="margin-top:16px;font-size:10px;color:#94a3b8">M = Matutino · V = Vespertino · MV = Doble turno · D = Descanso</p>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  const sucursalActual = sucursales.find(s => s.id === sucursalId);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Horarios Semanales</h1>
            <p className="text-sm text-muted-foreground">Asigna turnos por empleado — clic en celda para cambiar</p>
          </div>
        </div>
        {sucursalId && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyMut.mutate({ sucursalId, semana })}
              disabled={copyMut.isPending}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar semana anterior
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPDF} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Sucursal</Label>
              <Select value={sucursalId?.toString() ?? ""} onValueChange={v => setSucursalId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecciona una sucursal..." /></SelectTrigger>
                <SelectContent>
                  {sucursales.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Semana</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSemana(s => navSemana(s, -1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-52 text-center">{semanaLabel(semana)}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSemana(s => navSemana(s, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!sucursalId && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Selecciona una sucursal para ver el horario</p>
          <p className="text-sm mt-1">Puedes asignar turnos haciendo clic en cada celda</p>
        </div>
      )}

      {sucursalId && empleados.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay empleados registrados en esta sucursal</p>
          <p className="text-sm mt-1">Agrega empleados desde la sección Equipo → Empleados</p>
        </div>
      )}

      {sucursalId && empleados.length > 0 && (
        <>
          {/* Leyenda */}
          <div className="flex gap-3 flex-wrap text-sm">
            {Object.entries(TURNOS).map(([key, cfg]) => (
              <div key={key} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${cfg.bg}`}>
                <span className={`font-bold text-xs ${cfg.color}`}>{cfg.short}</span>
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 bg-white">
              <span className="font-bold text-xs text-gray-400">—</span>
              <span className="text-xs text-muted-foreground">Sin asignar</span>
            </div>
            {canEdit && <span className="text-xs text-muted-foreground self-center ml-2">Clic en celda para cambiar turno</span>}
          </div>

          {/* Tabla de horarios */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-40">Empleado</th>
                    <th className="text-center px-2 py-3 font-semibold text-muted-foreground text-xs min-w-16">Rol</th>
                    {DIAS.map((dia, i) => {
                      const fecha = new Date(getLunesDeSemana(semana).getTime() + i * 86400000);
                      const esHoy = fecha.toDateString() === new Date().toDateString();
                      return (
                        <th key={dia} className={`text-center px-2 py-3 min-w-20 ${esHoy ? "bg-indigo-50 text-indigo-700" : "text-muted-foreground"}`}>
                          <div className="font-semibold text-xs">{DIA_LABELS[dia]}</div>
                          <div className={`text-xs font-normal ${esHoy ? "text-indigo-500" : "text-muted-foreground/70"}`}>
                            {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs min-w-16">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((emp, idx) => (
                    <tr key={emp.id} className={`border-b hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{emp.nombre} {emp.apellido ?? ""}</div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <Badge variant="outline" className="text-xs capitalize">{emp.rol}</Badge>
                      </td>
                      {DIAS.map(dia => {
                        const turno = getTurno(emp.id, dia);
                        const cfg = turno ? TURNOS[turno] : null;
                        return (
                          <td key={dia} className="px-1 py-2 text-center">
                            <button
                              onClick={() => cycleTurno(emp.id, dia)}
                              disabled={!canEdit || upsertMut.isPending}
                              className={`w-full min-h-10 rounded-lg border text-xs font-bold transition-all ${
                                cfg
                                  ? `${cfg.bg} ${cfg.color} hover:opacity-80`
                                  : "border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-indigo-400 hover:text-indigo-400"
                              } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {turno ?? "—"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-sm ${calcularDias(emp.id) >= 5 ? "text-green-600" : calcularDias(emp.id) >= 3 ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {calcularDias(emp.id)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Fila de totales */}
                <tfoot>
                  <tr className="bg-muted/30 border-t-2">
                    <td className="px-4 py-2 text-xs font-semibold text-muted-foreground" colSpan={2}>
                      Personal por día
                    </td>
                    {DIAS.map(dia => (
                      <td key={dia} className="px-1 py-2 text-center">
                        <span className={`text-xs font-bold ${contarPorDia(dia) === 0 ? "text-red-500" : contarPorDia(dia) < 2 ? "text-yellow-600" : "text-green-600"}`}>
                          {contarPorDia(dia)}
                        </span>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                      {empleados.reduce((s, e) => s + calcularDias(e.id), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Empleados activos", value: empleados.length, icon: "👥" },
              { label: "Turnos asignados", value: horarios.reduce((s, h) => s + DIAS.filter(d => h[d] && h[d] !== "D").length, 0), icon: "📋" },
              { label: "Días de descanso", value: horarios.reduce((s, h) => s + DIAS.filter(d => h[d] === "D").length, 0), icon: "😴" },
              { label: "Sin asignar", value: empleados.length * 7 - horarios.reduce((s, h) => s + DIAS.filter(d => h[d] != null).length, 0), icon: "⬜" },
            ].map(k => (
              <Card key={k.label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <div className="text-2xl mb-1">{k.icon}</div>
                  <div className="text-2xl font-bold">{k.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
