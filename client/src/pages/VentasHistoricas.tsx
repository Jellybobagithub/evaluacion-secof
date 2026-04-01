import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  History, Save, TrendingUp, DollarSign, ChevronLeft, ChevronRight,
  Info, Download, RefreshCw,
} from "lucide-react";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type CeldaEdit = {
  sucursalId: number;
  mes: number;
  efectivo: string;
  tarjeta: string;
  rappi: string;
};

export default function VentasHistoricas() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual - 1);
  const [editando, setEditando] = useState<CeldaEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: historicas = [], refetch } = trpc.ventasHistoricas.list.useQuery({ anio });
  const upsert = trpc.ventasHistoricas.upsert.useMutation();

  // Mapa: sucursalId → mes → datos
  const mapaHistoricas = useMemo(() => {
    const m: Record<number, Record<number, typeof historicas[0]>> = {};
    for (const h of historicas) {
      if (!m[h.sucursalId]) m[h.sucursalId] = {};
      m[h.sucursalId][h.mes] = h;
    }
    return m;
  }, [historicas]);

  // Totales por mes (suma de todas las tiendas)
  const totalesPorMes = useMemo(() => {
    const t: Record<number, { efectivo: number; tarjeta: number; rappi: number; total: number }> = {};
    for (let mes = 1; mes <= 12; mes++) {
      t[mes] = { efectivo: 0, tarjeta: 0, rappi: 0, total: 0 };
      for (const s of sucursales) {
        const h = mapaHistoricas[s.id]?.[mes];
        if (h) {
          t[mes].efectivo += h.ventasEfectivo ?? 0;
          t[mes].tarjeta += h.ventasTarjeta ?? 0;
          t[mes].rappi += h.ventasRappi ?? 0;
          t[mes].total += h.ventasTotales ?? 0;
        }
      }
    }
    return t;
  }, [historicas, sucursales, mapaHistoricas]);

  const totalAnual = useMemo(() =>
    Object.values(totalesPorMes).reduce((s, m) => s + m.total, 0),
    [totalesPorMes]
  );

  function abrirEdicion(sucursalId: number, mes: number) {
    const h = mapaHistoricas[sucursalId]?.[mes];
    setEditando({
      sucursalId,
      mes,
      efectivo: h?.ventasEfectivo != null ? String(h.ventasEfectivo) : "",
      tarjeta: h?.ventasTarjeta != null ? String(h.ventasTarjeta) : "",
      rappi: h?.ventasRappi != null ? String(h.ventasRappi) : "",
    });
  }

  async function guardarCelda() {
    if (!editando) return;
    setSaving(true);
    try {
      const efectivo = parseFloat(editando.efectivo) || 0;
      const tarjeta = parseFloat(editando.tarjeta) || 0;
      const rappi = parseFloat(editando.rappi) || 0;
      await upsert.mutateAsync({
        sucursalId: editando.sucursalId,
        anio,
        mes: editando.mes,
        ventasEfectivo: efectivo,
        ventasTarjeta: tarjeta,
        ventasRappi: rappi,
        ventasTotales: efectivo + tarjeta + rappi,
      });
      toast.success("Guardado correctamente");
      setEditando(null);
      refetch();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function exportarCSV() {
    const filas: string[] = [];
    filas.push(["Sucursal", ...MESES.map(m => `${m} Efectivo`), ...MESES.map(m => `${m} Tarjeta`), ...MESES.map(m => `${m} Rappi`), ...MESES.map(m => `${m} Total`), "Total Anual"].join(","));
    for (const s of sucursales) {
      const row: string[] = [s.nombre];
      let totalAnualSuc = 0;
      for (let mes = 1; mes <= 12; mes++) {
        row.push(String(mapaHistoricas[s.id]?.[mes]?.ventasEfectivo ?? 0));
      }
      for (let mes = 1; mes <= 12; mes++) {
        row.push(String(mapaHistoricas[s.id]?.[mes]?.ventasTarjeta ?? 0));
      }
      for (let mes = 1; mes <= 12; mes++) {
        row.push(String(mapaHistoricas[s.id]?.[mes]?.ventasRappi ?? 0));
      }
      for (let mes = 1; mes <= 12; mes++) {
        const t = mapaHistoricas[s.id]?.[mes]?.ventasTotales ?? 0;
        row.push(String(t));
        totalAnualSuc += t;
      }
      row.push(String(totalAnualSuc));
      filas.push(row.join(","));
    }
    const blob = new Blob([filas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-historicas-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              Ventas Históricas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registra las ventas del año anterior por tienda y mes para calcular metas y KPIs de crecimiento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setAnio(a => a - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-lg w-16 text-center">{anio}</span>
            <Button variant="outline" size="icon" onClick={() => setAnio(a => a + 1)} disabled={anio >= anioActual}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="w-4 h-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        {/* Tarjetas de resumen anual */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Anual {anio}</p>
              <p className="text-xl font-bold text-primary">{fmt(totalAnual)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Promedio Mensual</p>
              <p className="text-xl font-bold">{fmt(totalAnual / 12)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Tiendas con datos</p>
              <p className="text-xl font-bold">
                {sucursales.filter(s => Object.keys(mapaHistoricas[s.id] ?? {}).length > 0).length}
                <span className="text-sm text-muted-foreground"> / {sucursales.length}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Meses con datos</p>
              <p className="text-xl font-bold">
                {Object.values(totalesPorMes).filter(m => m.total > 0).length}
                <span className="text-sm text-muted-foreground"> / 12</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Nota informativa */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Haz clic en cualquier celda para editar las ventas de ese mes. Los datos se usan para calcular el
            <strong> KPI de Crecimiento mes vs mes</strong> y como base para las metas del año en curso.
            El total se calcula automáticamente como la suma de efectivo + tarjeta + Rappi.
          </span>
        </div>

        {/* Tabla principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Ventas por Tienda y Mes — {anio}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 min-w-[140px]">Tienda</th>
                    {MESES.map((mes, i) => (
                      <th key={i} className="text-center p-2 font-medium min-w-[90px] whitespace-nowrap">
                        {mes.slice(0, 3)}
                      </th>
                    ))}
                    <th className="text-center p-2 font-medium min-w-[100px] bg-primary/5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sucursales.map((s) => {
                    const totalSuc = Object.values(mapaHistoricas[s.id] ?? {}).reduce(
                      (sum, h) => sum + (h.ventasTotales ?? 0), 0
                    );
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium sticky left-0 bg-background">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            <span className="truncate max-w-[120px]">{s.nombre}</span>
                          </div>
                        </td>
                        {MESES.map((_, i) => {
                          const mes = i + 1;
                          const h = mapaHistoricas[s.id]?.[mes];
                          const tieneDatos = h && (h.ventasTotales ?? 0) > 0;
                          return (
                            <td
                              key={mes}
                              className="p-1 text-center cursor-pointer hover:bg-primary/10 transition-colors rounded"
                              onClick={() => abrirEdicion(s.id, mes)}
                            >
                              {tieneDatos ? (
                                <div className="space-y-0.5">
                                  <div className="font-medium text-xs">
                                    ${(h!.ventasTotales ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                                  </div>
                                  <div className="flex gap-1 justify-center flex-wrap">
                                    {(h!.ventasEfectivo ?? 0) > 0 && (
                                      <span className="text-[10px] text-green-600 dark:text-green-400">
                                        E:{((h!.ventasEfectivo! / h!.ventasTotales!) * 100).toFixed(0)}%
                                      </span>
                                    )}
                                    {(h!.ventasTarjeta ?? 0) > 0 && (
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                                        T:{((h!.ventasTarjeta! / h!.ventasTotales!) * 100).toFixed(0)}%
                                      </span>
                                    )}
                                    {(h!.ventasRappi ?? 0) > 0 && (
                                      <span className="text-[10px] text-orange-600 dark:text-orange-400">
                                        R:{((h!.ventasRappi! / h!.ventasTotales!) * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-semibold bg-primary/5">
                          {totalSuc > 0 ? (
                            <span className="text-primary">
                              ${totalSuc.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Fila de totales */}
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="p-3 sticky left-0 bg-muted/30">Total Red</td>
                    {MESES.map((_, i) => {
                      const mes = i + 1;
                      const t = totalesPorMes[mes];
                      return (
                        <td key={mes} className="p-2 text-center">
                          {t.total > 0 ? (
                            <span className="text-xs font-semibold">
                              ${t.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-center bg-primary/10 text-primary">
                      ${totalAnual.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Leyenda de canales */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            E = Efectivo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            T = Tarjeta
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            R = Rappi
          </span>
          <span className="text-muted-foreground">Haz clic en cualquier celda para editar</span>
        </div>
      </div>

      {/* Modal de edición de celda */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">
                {sucursales.find(s => s.id === editando.sucursalId)?.nombre}
              </h3>
              <p className="text-sm text-muted-foreground">
                {MESES[editando.mes - 1]} {anio}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Ventas en Efectivo
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editando.efectivo}
                  onChange={e => setEditando(prev => prev ? { ...prev, efectivo: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Ventas con Tarjeta
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editando.tarjeta}
                  onChange={e => setEditando(prev => prev ? { ...prev, tarjeta: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1 mb-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                  Ventas por Rappi
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editando.rappi}
                  onChange={e => setEditando(prev => prev ? { ...prev, rappi: e.target.value } : null)}
                />
              </div>

              {/* Total calculado */}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total calculado</span>
                  <span className="font-bold text-primary">
                    {fmt(
                      (parseFloat(editando.efectivo) || 0) +
                      (parseFloat(editando.tarjeta) || 0) +
                      (parseFloat(editando.rappi) || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={guardarCelda} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
