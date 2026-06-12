import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, FileText, Package, Users, Star,
  CheckCircle2, XCircle, AlertTriangle, ChevronRight, Info, Pencil
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import ObservacionPanel from "@/components/ObservacionPanel";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMesActual() {
  return new Date().toISOString().slice(0, 7);
}

function semaforo(val: number, meta: number, invertir = false) {
  const ok = invertir ? val <= meta : val >= meta;
  const warn = invertir ? val <= meta * 1.5 : val >= meta * 0.7;
  if (ok) return { color: "text-green-600", bg: "bg-green-50 border-green-200", label: "Cumple", icon: "✅" };
  if (warn) return { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "En riesgo", icon: "⚠️" };
  return { color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Crítico", icon: "🔴" };
}

// ─── Tarjeta KPI ──────────────────────────────────────────────────────────────
function KpiCard({
  titulo, valor, meta, unidad, descripcion, invertir = false, icon: Icon,
}: {
  titulo: string;
  valor: number | null;
  meta: number;
  unidad: string;
  descripcion: string;
  invertir?: boolean;
  icon: any;
}) {
  const s = valor != null ? semaforo(valor, meta, invertir) : null;
  const pct = valor != null ? Math.min(100, invertir ? Math.max(0, 100 - (valor / meta) * 100) : (valor / meta) * 100) : 0;

  return (
    <Card className={`border ${s?.bg ?? ""}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s?.bg ?? "bg-slate-100"}`}>
              <Icon className={`w-4 h-4 ${s?.color ?? "text-slate-500"}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{titulo}</p>
            </div>
          </div>
          {s && (
            <Badge variant="outline" className={`text-xs ${s.bg} ${s.color} border-current`}>
              {s.icon} {s.label}
            </Badge>
          )}
        </div>

        {valor != null ? (
          <>
            <p className={`text-3xl font-bold ${s?.color ?? "text-slate-800"}`}>
              {valor}{unidad}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Meta: {meta}{unidad}</p>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  s?.color === "text-green-600" ? "bg-green-500" :
                  s?.color === "text-amber-600" ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{descripcion}</p>
          </>
        ) : (
          <div className="py-4 text-center text-slate-400 text-sm">Sin datos este mes</div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function KpiLider() {
  const { user } = useAuth();
  const [mes, setMes] = useState(getMesActual());
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaManualEfectivo, setMetaManualEfectivo] = useState("");
  const [metaManualTarjeta, setMetaManualTarjeta] = useState("");
  const [metaManualRappi, setMetaManualRappi] = useState("");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  // Auto-seleccionar sucursal cuando el usuario solo tiene una asignada (lider 1 tienda)
  useMemo(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales.length]);
  const activeSucursalId = sucursalId ?? sucursales[0]?.id ?? null;

  const mesRango = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    const inicio = `${y}-${String(m).padStart(2, "0")}-01`;
    const ultimoDiaMes = new Date(y, m, 0).toISOString().slice(0, 10);
    // Para el mes actual: usar ayer como fecha fin (no contar días futuros)
    // Para meses pasados: usar el último día del mes
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`;
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const fin = mes === mesActual ? ayerStr : ultimoDiaMes;
    const trimInicio = new Date(y, Math.floor((m - 1) / 3) * 3, 1).toISOString().slice(0, 10);
    const trimFin = new Date(y, Math.floor((m - 1) / 3) * 3 + 3, 0).toISOString().slice(0, 10);
    return { inicio, fin, trimInicio, trimFin };
  }, [mes]);

  const { data: resumen, isLoading } = trpc.kpiLider.resumenNivel2.useQuery(
    { sucursalId: activeSucursalId ?? 0, mes },
    { enabled: !!activeSucursalId }
  );

  const { data: cumplimiento } = trpc.kpiLider.cumplimientoReportes.useQuery(
    { sucursalId: activeSucursalId ?? 0, fechaInicio: mesRango.inicio, fechaFin: mesRango.fin },
    { enabled: !!activeSucursalId }
  );

  const { data: mermas } = trpc.kpiLider.mermas.useQuery(
    { sucursalId: activeSucursalId ?? 0, fechaInicio: mesRango.inicio, fechaFin: mesRango.fin },
    { enabled: !!activeSucursalId }
  );

  const { data: rotacion } = trpc.kpiLider.rotacion.useQuery(
    { sucursalId: activeSucursalId ?? 0, fechaInicio: mesRango.trimInicio, fechaFin: mesRango.trimFin },
    { enabled: !!activeSucursalId }
  );

  const utils = trpc.useUtils();
  const upsertMeta = trpc.ventasHistoricas.upsert.useMutation({
    onSuccess: () => {
      toast.success("Meta del mes guardada correctamente");
      utils.kpiLider.resumenNivel2.invalidate();
      setShowMetaModal(false);
      setMetaManualEfectivo("");
      setMetaManualTarjeta("");
      setMetaManualRappi("");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleGuardarMeta() {
    if (!activeSucursalId) return;
    const [y, m] = mes.split("-").map(Number);
    const efectivo = parseFloat(metaManualEfectivo) || 0;
    const tarjeta = parseFloat(metaManualTarjeta) || 0;
    const rappi = parseFloat(metaManualRappi) || 0;
    const total = efectivo + tarjeta + rappi;
    if (total <= 0) { toast.error("Ingresa al menos un monto mayor a 0"); return; }
    // Guardar en ventas_historicas del año anterior al mes seleccionado
    upsertMeta.mutate({
      sucursalId: activeSucursalId,
      anio: y - 1,
      mes: m,
      ventasEfectivo: efectivo,
      ventasTarjeta: tarjeta,
      ventasRappi: rappi,
      ventasTotales: total,
    });
  }

  // Datos para el radar de KPIs
  const radarData = useMemo(() => {
    if (!resumen) return [];
    return [
      {
        kpi: "SECOF",
        valor: resumen.secof?.porcentaje ?? 0,
        meta: 80,
        fullMark: 100,
      },
      {
        kpi: "Ventas",
        valor: resumen.ventas?.porcentaje ?? 0,
        meta: 100,
        fullMark: 100,
      },
      {
        kpi: "Reportes",
        valor: cumplimiento?.porcentaje ?? 0,
        meta: 100,
        fullMark: 100,
      },
      {
        kpi: "Mermas",
        valor: mermas ? Math.max(0, 100 - ((mermas.porcentaje ?? 0) / 3) * 100) : 0,
        meta: 100,
        fullMark: 100,
      },
      {
        kpi: "Rotación",
        valor: rotacion ? Math.max(0, 100 - ((rotacion.porcentaje ?? 0) / 15) * 100) : 0,
        meta: 85,
        fullMark: 100,
      },
    ];
  }, [resumen, cumplimiento, mermas, rotacion]);

  // Historial de meses para gráfica de barras
  const mesesHistorial = useMemo(() => {
    const result = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
      result.push(dd.toISOString().slice(0, 7));
    }
    return result;
  }, []);

  const canView = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  if (!canView) {
    return (
      <div className="p-6 text-center text-slate-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No tienes permisos para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">KPIs Líder — Nivel 2</h1>
          <p className="text-slate-500 text-sm mt-1">SECOF · Ventas · Reportes · Mermas · Rotación de Equipo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sucursales.length > 1 && (
            <Select value={String(activeSucursalId ?? "")} onValueChange={v => setSucursalId(Number(v))}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Sucursal..." /></SelectTrigger>
              <SelectContent position="item-aligned">
                {sucursales.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Panel de Actividades bajo Observación */}
      {activeSucursalId && (
        <ObservacionPanel sucursalId={activeSucursalId} />
      )}

      {!activeSucursalId ? (
        <div className="text-center py-16 text-slate-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Selecciona una sucursal para ver los KPIs</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-32 pt-4" /></Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="resumen">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="radar">Radar</TabsTrigger>
          </TabsList>

          {/* Tab: Resumen con 5 tarjetas */}
          <TabsContent value="resumen" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* SECOF */}
              <Card className={`border ${resumen?.secof ? semaforo(resumen.secof.porcentaje ?? 0, 80).bg : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-teal-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SECOF</span>
                    </div>
                    {resumen?.secof && (
                      <Badge variant="outline" className={`text-xs ${semaforo(resumen.secof.porcentaje ?? 0, 80).bg} ${semaforo(resumen.secof.porcentaje ?? 0, 80).color}`}>
                        {semaforo(resumen.secof.porcentaje ?? 0, 80).label}
                      </Badge>
                    )}
                  </div>
                  {resumen?.secof ? (
                    <>
                      <p className={`text-3xl font-bold ${semaforo(resumen.secof.porcentaje ?? 0, 80).color}`}>
                        {resumen.secof.porcentaje ?? 0}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Calificación: {resumen.secof.calificacion}</p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(resumen.secof.porcentaje ?? 0) >= 80 ? "bg-teal-500" : (resumen.secof.porcentaje ?? 0) >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${resumen.secof.porcentaje ?? 0}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Meta: 80% mínimo</p>
                    </>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-sm">
                      <Link href="/evaluaciones" className="text-teal-600 hover:underline flex items-center justify-center gap-1">
                        Registrar evaluación <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                  {resumen?.frecuenciaEval && resumen.frecuenciaEval.de > 0 && (
                    <p className="text-xs text-slate-500 mt-2 border-t pt-2">
                      Evaluaciones: <span className={`font-semibold ${resumen.frecuenciaEval.semanas >= resumen.frecuenciaEval.de ? "text-green-600" : resumen.frecuenciaEval.semanas >= resumen.frecuenciaEval.de * 0.5 ? "text-amber-600" : "text-red-600"}`}>
                        {resumen.frecuenciaEval.semanas}/{resumen.frecuenciaEval.de} semanas
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Ventas vs Meta */}
              <Card className={`border ${
                resumen?.ventas && !resumen.ventas.sinMeta
                  ? semaforo(resumen.ventas.porcentaje, 100).bg
                  : "border-amber-200 bg-amber-50"
              }`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventas vs Meta</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {resumen?.ventas && !resumen.ventas.sinMeta && (
                        <Badge variant="outline" className={`text-xs ${semaforo(resumen.ventas.porcentaje, 100).bg} ${semaforo(resumen.ventas.porcentaje, 100).color}`}>
                          {semaforo(resumen.ventas.porcentaje, 100).label}
                        </Badge>
                      )}
                      <button
                        onClick={() => setShowMetaModal(true)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        title="Registrar meta del año anterior"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {resumen?.ventas?.sinMeta ? (
                    <div className="py-2">
                      <div className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded p-2 mb-2">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">
                          No hay registro de ventas del año anterior para <strong>{mes.slice(5, 7)}/{parseInt(mes.slice(0, 4)) - 1}</strong>.
                          Ingresa el dato para calcular el KPI.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setShowMetaModal(true)}>
                        + Registrar ventas {mes.slice(5, 7)}/{parseInt(mes.slice(0, 4)) - 1}
                      </Button>
                      {resumen.ventas.total > 0 && (
                        <p className="text-xs text-slate-500 mt-2">Ventas actuales: ${resumen.ventas.total.toLocaleString("es-MX")}</p>
                      )}
                    </div>
                  ) : resumen?.ventas ? (
                    <>
                      <p className={`text-3xl font-bold ${semaforo(resumen.ventas.porcentaje, 100).color}`}>
                        {resumen.ventas.porcentaje}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ${resumen.ventas.total.toLocaleString("es-MX")} / ${resumen.ventas.meta.toLocaleString("es-MX")}
                      </p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          semaforo(resumen.ventas.porcentaje, 100).color === "text-green-600" ? "bg-green-500"
                          : semaforo(resumen.ventas.porcentaje, 100).color === "text-amber-600" ? "bg-amber-500"
                          : "bg-red-500"
                        }`} style={{ width: `${Math.min(100, resumen.ventas.porcentaje)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">vs mismo mes año anterior</p>
                    </>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-sm">Sin reportes este mes</div>
                  )}
                </CardContent>
              </Card>

              {/* Cumplimiento de Reportes */}
              <Card className={`border ${cumplimiento ? semaforo(cumplimiento.porcentaje, 100).bg : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reportes</span>
                    </div>
                    {cumplimiento && (
                      <Badge variant="outline" className={`text-xs ${semaforo(cumplimiento.porcentaje, 100).bg} ${semaforo(cumplimiento.porcentaje, 100).color}`}>
                        {semaforo(cumplimiento.porcentaje, 100).label}
                      </Badge>
                    )}
                  </div>
                  {cumplimiento ? (
                    <>
                      <p className={`text-3xl font-bold ${semaforo(cumplimiento.porcentaje, 100).color}`}>
                        {cumplimiento.porcentaje}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cumplimiento.enviados}/{cumplimiento.esperados} días reportados
                      </p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cumplimiento.porcentaje >= 100 ? "bg-green-500" : cumplimiento.porcentaje >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${cumplimiento.porcentaje}%` }} />
                      </div>
                      {cumplimiento.diasSinReporte.length > 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          {cumplimiento.diasSinReporte.length} días sin reporte
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-sm">Sin datos</div>
                  )}
                </CardContent>
              </Card>

              {/* Mermas */}
              <Card className={`border ${mermas ? semaforo(mermas.porcentaje, 3, true).bg : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-orange-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mermas</span>
                    </div>
                    {mermas && (
                      <Badge variant="outline" className={`text-xs ${semaforo(mermas.porcentaje, 3, true).bg} ${semaforo(mermas.porcentaje, 3, true).color}`}>
                        {semaforo(mermas.porcentaje, 3, true).label}
                      </Badge>
                    )}
                  </div>
                  {mermas ? (
                    <>
                      <p className={`text-3xl font-bold ${semaforo(mermas.porcentaje, 3, true).color}`}>
                        {mermas.porcentaje}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ${mermas.totalMermas.toLocaleString("es-MX")} de mermas
                      </p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${mermas.porcentaje <= 3 ? "bg-green-500" : mermas.porcentaje <= 5 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, (mermas.porcentaje / 6) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Meta: ≤3% de ventas · {mermas.diasConAlerta} días con alerta</p>
                    </>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-sm">Sin datos de mermas</div>
                  )}
                </CardContent>
              </Card>

              {/* Rotación de Equipo */}
              <Card className={`border ${rotacion ? semaforo(rotacion.porcentaje, 15, true).bg : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rotación</span>
                    </div>
                    {rotacion && (
                      <Badge variant="outline" className={`text-xs ${semaforo(rotacion.porcentaje, 15, true).bg} ${semaforo(rotacion.porcentaje, 15, true).color}`}>
                        {semaforo(rotacion.porcentaje, 15, true).label}
                      </Badge>
                    )}
                  </div>
                  {rotacion ? (
                    <>
                      <p className={`text-3xl font-bold ${semaforo(rotacion.porcentaje, 15, true).color}`}>
                        {rotacion.porcentaje}%
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {rotacion.bajas} bajas en el trimestre
                      </p>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rotacion.porcentaje <= 15 ? "bg-green-500" : rotacion.porcentaje <= 25 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, (rotacion.porcentaje / 30) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Meta: ≤15% trimestral · Plantilla: {rotacion.plantillaPromedio}</p>
                    </>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-sm">
                      <Link href="/empleados" className="text-purple-600 hover:underline flex items-center justify-center gap-1">
                        Registrar empleados <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Acceso rápido a KPIs Anfitriones */}
              <Card className="border-dashed border-2 border-slate-200 bg-slate-50">
                <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center h-full text-center gap-2">
                  <Star className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">KPIs Anfitriones</p>
                  <p className="text-xs text-slate-400">Servicio, puntualidad y caja</p>
                  <Link href="/kpi-anfitriones">
                    <span className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-1">
                      Ver Nivel 1 <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Detalle */}
          <TabsContent value="detalle" className="mt-4 space-y-4">
            {/* Días sin reporte */}
            {cumplimiento && cumplimiento.diasSinReporte.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Días sin reporte este mes ({cumplimiento.diasSinReporte.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {cumplimiento.diasSinReporte.map(d => (
                      <Badge key={d} variant="outline" className="bg-white border-amber-300 text-amber-700 text-xs">
                        {new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mermas por día con alerta */}
            {mermas && mermas.diasConAlerta > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {mermas.diasConAlerta} días con mermas &gt;3% este mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-700">
                    Total de mermas: <strong>${mermas.totalMermas.toLocaleString("es-MX")}</strong> sobre{" "}
                    <strong>${mermas.totalVentas.toLocaleString("es-MX")}</strong> en ventas ({mermas.porcentaje}%)
                  </p>
                  <Link href="/reporte-diario">
                    <span className="text-xs text-orange-600 hover:underline flex items-center gap-1 mt-2">
                      Ver reportes diarios <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Rotación: bajas del trimestre */}
            {rotacion && rotacion.bajas > 0 && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Rotación de equipo — Trimestre actual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-purple-700">
                    <strong>{rotacion.bajas} bajas</strong> registradas de una plantilla promedio de{" "}
                    <strong>{rotacion.plantillaPromedio} personas</strong> ({rotacion.porcentaje}% de rotación)
                  </p>
                  <p className="text-xs text-purple-500 mt-1">Meta: ≤15% trimestral</p>
                  <Link href="/empleados">
                    <span className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-2">
                      Ver empleados <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Estado general */}
            {!cumplimiento?.diasSinReporte.length && !mermas?.diasConAlerta && !rotacion?.bajas && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
                <p className="font-medium text-green-700">Sin alertas este mes</p>
                <p className="text-sm mt-1">Todos los KPIs están dentro de los rangos esperados</p>
              </div>
            )}
          </TabsContent>

          {/* Tab: Radar */}
          <TabsContent value="radar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Radar de KPIs — Nivel 2</CardTitle>
                <p className="text-xs text-slate-500">Cada eje representa el % de cumplimiento de la meta (100% = meta alcanzada)</p>
              </CardHeader>
              <CardContent>
                {radarData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">Sin datos suficientes</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Cumplimiento"
                        dataKey="valor"
                        stroke="#0d9488"
                        fill="#0d9488"
                        fillOpacity={0.3}
                      />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal: Registrar meta del año anterior */}
      <Dialog open={showMetaModal} onOpenChange={setShowMetaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar ventas del año anterior</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm text-slate-500 mb-2">
            <p>
              Ingresa las ventas de <strong>{mes.slice(5, 7)}/{parseInt(mes.slice(0, 4)) - 1}</strong> para la sucursal seleccionada.
              Estos datos se usarán como meta de comparación.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Ventas Efectivo ($)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={metaManualEfectivo}
                onChange={e => setMetaManualEfectivo(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ventas Tarjeta ($)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={metaManualTarjeta}
                onChange={e => setMetaManualTarjeta(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ventas Rappi ($)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0.00"
                value={metaManualRappi}
                onChange={e => setMetaManualRappi(e.target.value)}
              />
            </div>
            <div className="bg-slate-50 rounded p-2 text-sm">
              <span className="text-slate-500">Total: </span>
              <strong className="text-slate-800">
                ${((parseFloat(metaManualEfectivo) || 0) + (parseFloat(metaManualTarjeta) || 0) + (parseFloat(metaManualRappi) || 0)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowMetaModal(false)}>Cancelar</Button>
            <Button onClick={handleGuardarMeta} disabled={upsertMeta.isPending}>
              {upsertMeta.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
