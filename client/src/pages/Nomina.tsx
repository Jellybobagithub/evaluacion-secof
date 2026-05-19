import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Clock, AlertTriangle, UserX, Users, Download } from "lucide-react";

function fmt2(n: number) { return n.toFixed(2); }

function getQuincenas(year: number, month: number) {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return [
    { label: `1-15 ${m}/${year}`, inicio: `${year}-${m}-01`, fin: `${year}-${m}-15` },
    { label: `16-${lastDay} ${m}/${year}`, inicio: `${year}-${m}-16`, fin: `${year}-${m}-${lastDay}` },
  ];
}

function EmpleadoRow({ emp }: { emp: any }) {
  const [open, setOpen] = useState(false);
  const hasIssues = emp.retardos.length > 0 || emp.ausencias.length > 0;

  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      <div className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 ${hasIssues ? "border-l-4 border-l-amber-400" : ""}`}
        onClick={() => setOpen(v => !v)}>
        <button className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{emp.nombre}</span>
            {emp.puesto && <span className="text-xs text-muted-foreground">· {emp.puesto}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />{fmt2(emp.totalHoras)} hrs totales
            </span>
            <span className="text-xs text-muted-foreground">{emp.diasTrabajados} días trabajados</span>
          </div>
        </div>
        <div className="flex gap-1">
          {emp.retardos.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />{emp.retardos.length} retardo{emp.retardos.length > 1 ? "s" : ""}
            </Badge>
          )}
          {emp.ausencias.length > 0 && (
            <Badge className="bg-red-100 text-red-800 text-xs gap-1">
              <UserX className="h-3 w-3" />{emp.ausencias.length} ausencia{emp.ausencias.length > 1 ? "s" : ""}
            </Badge>
          )}
          {!hasIssues && emp.diasTrabajados > 0 && (
            <Badge className="bg-green-100 text-green-800 text-xs">✓ Sin incidencias</Badge>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t bg-slate-50 p-3">
          {/* Ausencias */}
          {emp.ausencias.length > 0 && (
            <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-700">
              <span className="font-semibold">Ausencias: </span>
              {emp.ausencias.join(", ")}
            </div>
          )}
          {/* Detalle de días */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1">Fecha</th>
                <th className="text-right">Entrada</th>
                <th className="text-right">Salida</th>
                <th className="text-right">Horas</th>
                <th className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {emp.detalles.map((d: any, i: number) => {
                const retardo = emp.retardos.find((r: any) => r.fecha === d.fecha);
                return (
                  <tr key={i} className={`border-b last:border-0 ${retardo ? "bg-amber-50" : ""}`}>
                    <td className="py-1">{d.fecha}</td>
                    <td className="text-right tabular-nums">{d.horaEntrada}</td>
                    <td className={`text-right tabular-nums ${d.sinSalida ? "text-amber-600 font-medium" : ""}`}>
                      {d.horaSalida}
                    </td>
                    <td className="text-right tabular-nums font-medium">{fmt2(d.horas)}</td>
                    <td className="text-right">
                      {retardo ? (
                        <span className="text-amber-600">+{retardo.minutosRetardo} min</span>
                      ) : d.sinSalida ? (
                        <span className="text-amber-500">Sin salida</span>
                      ) : (
                        <span className="text-green-600">✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t">
                <td colSpan={3} className="py-1">TOTAL</td>
                <td className="text-right tabular-nums">{fmt2(emp.totalHoras)} hrs</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Nomina() {
  const hoy = new Date();
  const quincenas = getQuincenas(hoy.getFullYear(), hoy.getMonth() + 1);
  const prevQuincenas = getQuincenas(
    hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear(),
    hoy.getMonth() === 0 ? 12 : hoy.getMonth()
  );
  const todasQuincenas = [...prevQuincenas, ...quincenas];

  const [periodoIdx, setPeriodoIdx] = useState(hoy.getDate() <= 15 ? 2 : 3);
  const periodo = todasQuincenas[periodoIdx];

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const [sucursalId, setSucursalId] = useState<number>(30001);

  const { data: reporte, isLoading } = trpc.nominaHoras.reporte.useQuery(
    { sucursalId, fechaInicio: periodo.inicio, fechaFin: periodo.fin },
    { enabled: !!sucursalId }
  );

  const totalRetardos = reporte?.empleados.reduce((s, e) => s + e.retardos.length, 0) ?? 0;
  const totalAusencias = reporte?.empleados.reduce((s, e) => s + e.ausencias.length, 0) ?? 0;

  function exportarCSV() {
    if (!reporte) return;
    const rows = ["Empleado,Fecha,Entrada,Salida,Horas,Retardo,Ausencia"];
    for (const emp of reporte.empleados) {
      for (const d of emp.detalles) {
        const ret = emp.retardos.find((r: any) => r.fecha === d.fecha);
        rows.push(`${emp.nombre},${d.fecha},${d.horaEntrada},${d.horaSalida},${d.horas},${ret ? ret.minutosRetardo + "min" : ""},`);
      }
      for (const aus of emp.ausencias) {
        rows.push(`${emp.nombre},${aus},,,0,,Ausencia`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nomina_${periodo.inicio}_${periodo.fin}.csv`;
    a.click();
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-purple-600" />
        <h1 className="text-xl font-bold">Reporte de Horas — Nómina</h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={String(sucursalId)} onValueChange={v => setSucursalId(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(sucursales as any[]).filter((s: any) => s.activa).map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {todasQuincenas.map((q, i) => (
            <Button key={i} size="sm" variant={periodoIdx === i ? "default" : "outline"}
              className="h-8 text-xs" onClick={() => setPeriodoIdx(i)}>
              {q.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1 ml-auto"
          onClick={exportarCSV} disabled={!reporte}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Empleados</p>
          <p className="text-2xl font-bold">{reporte?.empleados.length ?? "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Horas totales</p>
          <p className="text-2xl font-bold text-purple-700">{reporte ? fmt2(reporte.totalHorasGlobal) : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" />Retardos</p>
          <p className={`text-2xl font-bold ${totalRetardos > 0 ? "text-amber-600" : "text-green-600"}`}>{totalRetardos}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><UserX className="h-3 w-3 text-red-500" />Ausencias</p>
          <p className={`text-2xl font-bold ${totalAusencias > 0 ? "text-red-600" : "text-green-600"}`}>{totalAusencias}</p>
        </CardContent></Card>
      </div>

      {/* Lista empleados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Detalle por empleado — {periodo.inicio} al {periodo.fin}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Calculando horas...</p>}
          {reporte?.empleados.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin registros en este periodo.</p>
          )}
          {reporte?.empleados.map((emp: any) => (
            <EmpleadoRow key={emp.empleadoId} emp={emp} />
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Horas calculadas desde registros QR. Retardo = entrada {'>'} hora programada + 10 min.
        Exporta CSV para enviar a C&H.
      </p>
    </div>
  );
}
