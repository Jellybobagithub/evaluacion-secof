import { useState, useMemo, useEffect } from "react";
import { InventarioRecetas } from "./InventarioRecetas";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package, Warehouse, ClipboardList, BarChart3, History, ShoppingCart, Trash2, BookOpen,
  Plus, Save, Send, AlertTriangle, CheckCircle, Settings,
  ChevronDown, ChevronUp, Download, Edit, Trash2, Copy, Tag
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Helpers ────────────────────────────────────────────────────────────────
function getSemanaISO(date = new Date()): string {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  const dayOfWeek = d.getUTCDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diff);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function formatSemana(semana: string): string {
  const [year, week] = semana.split("-W");
  return `Semana ${week} / ${year}`;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Producto = {
  id: number; nombre: string; categoria: string;
  unidadCompra: string; unidadConteo: string;
  factorConversion: number | null; pesoNetoPorUnidad: number | null;
  puedeAbrirse: boolean; activo: boolean; notas: string | null;
};

type Almacen = {
  id: number; sucursalId: number; nombre: string;
  tipo: "piezas" | "piezas_gramos"; consideraMinMax: boolean; activo: boolean;
};

// ─── Componente Principal ────────────────────────────────────────────────────
export default function Inventario() {
  const { user } = useAuth();
  const role = user?.role ?? "host";
  const isSupervisor = ["superadmin", "owner", "manager"].includes(role);
  const isLiderOrAbove = ["superadmin", "owner", "manager", "leader"].includes(role);

  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [almacenId, setAlmacenId] = useState<number | null>(null);
  const [semana] = useState(() => getSemanaISO());
  const [activeTab, setActiveTab] = useState("conteo");

  // Sucursales disponibles
  const { data: sucursales } = trpc.sucursales.list.useQuery();
  const sucursalesDisponibles = useMemo(() => sucursales ?? [], [sucursales]);

  // Almacenes de la sucursal seleccionada
  const { data: almacenes, refetch: refetchAlmacenes } = trpc.inventario.almacenes.list.useQuery(
    { sucursalId: sucursalId! },
    { enabled: !!sucursalId }
  );

  // Productos
  const { data: productos, refetch: refetchProductos } = trpc.inventario.productos.list.useQuery();

  // Selección automática de primera sucursal
  useMemo(() => {
    if (sucursalesDisponibles.length > 0 && !sucursalId) {
      setSucursalId(sucursalesDisponibles[0].id);
    }
  }, [sucursalesDisponibles, sucursalId]);

  useMemo(() => {
    if (almacenes && almacenes.length > 0 && !almacenId) {
      setAlmacenId(almacenes[0].id);
    }
  }, [almacenes, almacenId]);

  if (!isLiderOrAbove) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No tienes permisos para acceder al módulo de inventario.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-500" />
            Inventario de Tienda
          </h1>
          <p className="text-sm text-muted-foreground">Control semanal de existencias</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Selector de sucursal */}
          <Select value={sucursalId?.toString() ?? ""} onValueChange={v => { setSucursalId(Number(v)); setAlmacenId(null); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {sucursalesDisponibles.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Selector de almacén */}
          {almacenes && almacenes.length > 0 && (
            <Select value={almacenId?.toString() ?? ""} onValueChange={v => setAlmacenId(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Almacén" />
              </SelectTrigger>
              <SelectContent position="item-aligned">
                {almacenes.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Sin almacenes configurados — mostrar aviso pero dejar acceso a Configuración */}
      {sucursalId && almacenes && almacenes.length === 0 && activeTab !== "config" && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <Warehouse className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Esta sucursal no tiene almacenes configurados.</p>
            {isSupervisor && (
              <Button variant="outline" onClick={() => setActiveTab("config")}>
                <Plus className="w-4 h-4 mr-2" /> Configurar almacenes
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {/* Tabs principales */}
      {sucursalId && (almacenId || isSupervisor) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="conteo" className="gap-1">
              <ClipboardList className="w-4 h-4" /> Conteo Físico
            </TabsTrigger>
            {isSupervisor && (
              <TabsTrigger value="teorico" className="gap-1">
                <BarChart3 className="w-4 h-4" /> Teórico
              </TabsTrigger>
            )}

            <TabsTrigger value="comparativa" className="gap-1">
              <BarChart3 className="w-4 h-4" /> Comparativa
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-1">
              <History className="w-4 h-4" /> Historial
            </TabsTrigger>
            {isSupervisor && (
              <TabsTrigger value="recetas" className="gap-1">
                <BookOpen className="w-4 h-4" /> Recetas
              </TabsTrigger>
            )}
            {isSupervisor && (
              <TabsTrigger value="config" className="gap-1">
                <Settings className="w-4 h-4" /> Configuración
              </TabsTrigger>
            )}
          </TabsList>

          {/* Conteo Físico */}
          <TabsContent value="conteo">
            {almacenId ? <ConteoFisicoTab
              sucursalId={sucursalId}
              almacenId={almacenId}
              almacen={almacenes?.find(a => a.id === almacenId)}
              productos={productos ?? []}
              semana={semana}
            /> : <div className="py-10 text-center text-muted-foreground">Selecciona o crea un almacén en la tab Configuración.</div>}
          </TabsContent>
          {/* Teórico (solo supervisores) */}
          {isSupervisor && (
            <TabsContent value="teorico">
              {almacenId ? <TeoricoTab
                sucursalId={sucursalId}
                almacenId={almacenId}
                productos={productos ?? []}
                semana={semana}
              /> : <div className="py-10 text-center text-muted-foreground">Selecciona o crea un almacén en la tab Configuración.</div>}
            </TabsContent>
          )}
          {/* Tab Ventas eliminada — usar Importar Ventas Odoo */}
          <TabsContent value="comparativa">
            {almacenId && <ComparativaTab
              sucursalId={sucursalId}
              almacenId={almacenId}
              semana={semana}
            />}
          </TabsContent>
          {/* Historial */}
          <TabsContent value="historial">
            {almacenId && <HistorialTab
              sucursalId={sucursalId}
              almacenId={almacenId}
            />}
          </TabsContent>

          {/* Recetas */}
          {isSupervisor && (
            <TabsContent value="recetas">
              <InventarioRecetas />
            </TabsContent>
          )}
          {/* Configuración */}
          {isSupervisor && (
            <TabsContent value="config">
              <ConfigTab
                sucursalId={sucursalId}
                almacenes={almacenes ?? []}
                productos={productos ?? []}
                refetchAlmacenes={refetchAlmacenes}
                refetchProductos={refetchProductos}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

// ─── Tab: Conteo Físico ───────────────────────────────────────────────────────
function ConteoFisicoTab({
  sucursalId, almacenId, almacen, productos, semana
}: {
  sucursalId: number; almacenId: number; almacen?: Almacen;
  productos: Producto[]; semana: string;
}) {
  const [fechaConteo, setFechaConteo] = useState(new Date().toISOString().split("T")[0]);
  const [conteoId, setConteoId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Record<number, { piezas: string; gramos: string }>>({});
  const [notas, setNotas] = useState("");
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [iniciado, setIniciado] = useState(false);

  const getOrCreate = trpc.inventario.conteoFisico.getOrCreate.useMutation({
    onSuccess: (data) => {
      setConteoId(data.conteo.id);
      setBloqueado(data.conteo.estado === "bloqueado");
      setNotas(data.conteo.notas ?? "");
      // Cargar detalles existentes
      const lineasExistentes: Record<number, { piezas: string; gramos: string }> = {};
      data.detalles.forEach(d => {
        lineasExistentes[d.productoId] = {
          piezas: d.cantidadPiezas.toString(),
          gramos: (d.cantidadGramos ?? 0).toString(),
        };
      });
      setLineas(lineasExistentes);
      setIniciado(true);
    },
    onError: () => toast.error("Error al iniciar el conteo"),
  });

  const guardar = trpc.inventario.conteoFisico.guardarDetalle.useMutation({
    onSuccess: () => toast.success("Conteo guardado"),
    onError: (e) => toast.error(e.message),
  });

  const enviar = trpc.inventario.conteoFisico.enviar.useMutation({
    onSuccess: () => { setBloqueado(true); toast.success("Conteo enviado y bloqueado"); },
    onError: (e) => toast.error(e.message),
  });

  const [forzarNuevo, setForzarNuevo] = useState(false);
  const handleIniciar = (forzar = false) => {
    getOrCreate.mutate({ sucursalId, almacenId, semana, fechaConteo, forzarNuevo: forzar } as any);
  };

  const handleGuardar = async () => {
    if (!conteoId) return;
    setCargando(true);
    const lineasData = productos
      .filter(p => lineas[p.id]?.piezas && parseFloat(lineas[p.id].piezas) >= 0)
      .map(p => ({
        productoId: p.id,
        cantidadPiezas: parseFloat(lineas[p.id]?.piezas ?? "0") || 0,
        cantidadGramos: parseFloat(lineas[p.id]?.gramos ?? "0") || 0,
      }));
    await guardar.mutateAsync({ conteoId, lineas: lineasData });
    setCargando(false);
  };

  const handleEnviar = async () => {
    if (!conteoId) return;
    await handleGuardar();
    enviar.mutate({ conteoId, notas });
  };

  const categorias = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria));
    return Array.from(cats).sort();
  }, [productos]);

  if (!iniciado) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">Conteo Físico — {formatSemana(semana)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Almacén: <strong>{almacen?.nombre}</strong> ({almacen?.tipo === "piezas_gramos" ? "Piezas + Gramos" : "Solo Piezas"})
            </p>
          </div>
          <div className="flex flex-col gap-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fecha del conteo:</span>
              <Input type="date" value={fechaConteo}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => setFechaConteo(e.target.value)}
                className="w-40 h-8 text-sm" />
            </div>
            {fechaConteo > new Date().toISOString().split("T")[0] && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                ⚠️ La fecha es futura — el pronóstico usará este conteo sobre otros más recientes
              </p>
            )}
          </div>
          <Button onClick={() => handleIniciar(forzarNuevo)} disabled={getOrCreate.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            <ClipboardList className="w-4 h-4 mr-2" />
            {getOrCreate.isPending ? "Iniciando..." : "Iniciar Conteo"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estado */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={bloqueado ? "secondary" : "default"} className={bloqueado ? "bg-gray-500" : "bg-emerald-600"}>
            {bloqueado ? "Bloqueado" : "En progreso"}
          </Badge>
          <span className="text-sm text-muted-foreground">{formatSemana(semana)}</span>
        </div>
        {!bloqueado && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGuardar} disabled={cargando}>
              <Save className="w-4 h-4 mr-1" /> Guardar borrador
            </Button>
            <Button size="sm" onClick={handleEnviar} disabled={cargando} className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4 mr-1" /> Enviar y bloquear
            </Button>
          </div>
        )}
      </div>

      {bloqueado && (
        <div className="flex items-center justify-between gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-gray-500" />
            <span className="text-muted-foreground">Este conteo está bloqueado y no puede modificarse.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            setIniciado(false);
            setConteoId(null);
            setLineas({});
            setBloqueado(false);
            setForzarNuevo(true);
            setFechaConteo(new Date().toISOString().split("T")[0]);
          }}>
            + Nuevo conteo
          </Button>
        </div>
      )}

      {/* Tabla de conteo por categoría */}
      {categorias.map(cat => {
        const prods = productos.filter(p => p.categoria === cat && p.activo);
        if (prods.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-28 text-center">Piezas cerradas</TableHead>
                    {almacen?.tipo === "piezas_gramos" && (
                      <TableHead className="w-28 text-center">Gramos abiertos</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prods.map(prod => (
                    <TableRow key={prod.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{prod.nombre}</div>
                        <div className="text-xs text-muted-foreground">{prod.unidadConteo}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          className="w-20 mx-auto text-center h-8"
                          value={lineas[prod.id]?.piezas ?? ""}
                          onChange={e => setLineas(prev => ({
                            ...prev,
                            [prod.id]: { ...prev[prod.id], piezas: e.target.value }
                          }))}
                          disabled={bloqueado}
                        />
                      </TableCell>
                      {almacen?.tipo === "piezas_gramos" && (
                        <TableCell className="text-center">
                          {prod.puedeAbrirse ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              className="w-20 mx-auto text-center h-8"
                              value={lineas[prod.id]?.gramos ?? ""}
                              onChange={e => setLineas(prev => ({
                                ...prev,
                                [prod.id]: { piezas: prev[prod.id]?.piezas ?? "0", ...prev[prod.id], gramos: e.target.value }
                              }))}
                              disabled={bloqueado}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Notas */}
      {!bloqueado && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-sm">Notas del conteo</Label>
            <Textarea
              className="mt-1"
              placeholder="Observaciones, diferencias encontradas, etc."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Inventario Teórico ──────────────────────────────────────────────────
function TeoricoTab({
  sucursalId, almacenId, productos, semana
}: {
  sucursalId: number; almacenId: number; productos: Producto[]; semana: string;
}) {
  const hoy = new Date().toISOString().split("T")[0];
  const lunes = (() => {
    const d = new Date(); const dia = d.getDay();
    d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
    return d.toISOString().split("T")[0];
  })();
  const [fechaInicio, setFechaInicio] = useState(lunes);
  const [fechaFin, setFechaFin] = useState(hoy);

  const { data: teorico = [], isLoading, refetch } = trpc.inventario.ventas.calcularTeorico.useQuery(
    { sucursalId, fechaInicio, fechaFin },
    { enabled: !!sucursalId }
  );

  const totalVasos = (() => {
    // No hay forma directa, pero mostramos el total de gramos de toppings
    const t = (teorico as any[]).find(r => r.nombre?.includes('Toppings Pool'));
    return t ? Math.round(t.consumoGramos / 46) : 0;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Del:</span>
          <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Al:</span>
          <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <BarChart3 className="w-3.5 h-3.5 mr-1" /> Calcular
        </Button>
        {totalVasos > 0 && <span className="text-sm text-muted-foreground">~{totalVasos} vasos vendidos</span>}
      </div>

      {isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Calculando...</div>}

      {!isLoading && (teorico as any[]).length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No hay ventas registradas en este período.
        </div>
      )}

      {!isLoading && (teorico as any[]).length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs">
                <th className="text-left px-3 py-2">Materia Prima</th>
                <th className="text-right px-3 py-2">Consumo (g)</th>
                <th className="text-right px-3 py-2">Consumo (pzas)</th>
                <th className="text-right px-3 py-2">Unidades</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(teorico as any[]).map((r: any, i: number) => (
                <tr key={i} className={r.nombre?.includes('Toppings Pool') ? 'bg-orange-50 dark:bg-orange-950 font-medium' : ''}>
                  <td className="px-3 py-2">{r.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.consumoGramos > 0 ? r.consumoGramos.toFixed(1) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.consumoPiezas > 0 ? r.consumoPiezas.toFixed(2) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{r.consumoUnidades > 0 ? r.consumoUnidades.toFixed(3) : '—'} {r.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ─── Tab: Comparativa ─────────────────────────────────────────────────────────
function ComparativaTab({ sucursalId, almacenId, semana }: { sucursalId: number; almacenId: number; semana: string }) {
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split("T")[0]);
  const { data, isLoading, refetch } = trpc.inventario.comparativa.useQuery(
    { sucursalId, almacenId, semana, fechaHasta },
    { enabled: !!sucursalId && !!almacenId }
  );

  const exportarExcel = () => {
    if (!data) return;
    const rows = data.lineas.map(l => ({
      Producto: l.productoNombre,
      Categoría: l.categoria,
      Unidad: l.unidadConteo,
      "Cantidad Física": l.cantidadFisica,
      "Gramos Abiertos": l.cantidadGramos > 0 ? l.cantidadGramos : "",
      "Cantidad Teórica": l.cantidadTeorica,
      "Diferencia": l.diferencia,
      "% Variación": l.pctVariacion !== null ? `${l.pctVariacion.toFixed(1)}%` : "N/A",
      "Stock Mínimo": l.stockMinimo ?? "",
      "Stock Máximo": l.stockMaximo ?? "",
      "Alerta": l.alerta ? "SÍ" : "",
      "Bajo Mínimo": l.bajoMinimo ? "SÍ" : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativa");
    XLSX.writeFile(wb, `inventario-comparativa-${fechaHasta}.xlsx`);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando comparativa...</div>;
  if (!data) return null;

  const { resumen, lineas } = data;
  const categorias = Array.from(new Set(lineas.map(l => l.categoria))).sort();

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Teórico al día:</span>
          <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        {data?.conteo && (
          <span className="text-xs text-muted-foreground">
            Conteo físico base: {(data.conteo as any).fechaConteo}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total productos</div>
          <div className="text-2xl font-bold">{resumen.totalProductos}</div>
        </Card>
        <Card className={`p-3 ${resumen.conAlerta > 0 ? "border-orange-400" : ""}`}>
          <div className="text-xs text-muted-foreground">Con alerta (&gt;10%)</div>
          <div className={`text-2xl font-bold ${resumen.conAlerta > 0 ? "text-orange-500" : ""}`}>{resumen.conAlerta}</div>
        </Card>
        <Card className={`p-3 ${resumen.bajoMinimo > 0 ? "border-red-400" : ""}`}>
          <div className="text-xs text-muted-foreground">Bajo mínimo</div>
          <div className={`text-2xl font-bold ${resumen.bajoMinimo > 0 ? "text-red-500" : ""}`}>{resumen.bajoMinimo}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Estado</div>
          <div className="text-sm font-medium mt-1">
            {resumen.hayFisico ? "✅ Físico" : "⏳ Sin físico"} / {resumen.hayTeorico ? "✅ Teórico" : "⏳ Sin teórico"}
          </div>
        </Card>
      </div>

      {/* Avisos */}
      {!resumen.hayFisico && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
          <span>No hay conteo físico para esta semana. El líder debe realizarlo primero.</span>
        </div>
      )}


      {/* Botón exportar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarExcel}>
          <Download className="w-4 h-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      {/* Tabla por categoría */}
      {categorias.map(cat => {
        const prods = lineas.filter(l => l.categoria === cat);
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Físico</TableHead>
                    <TableHead className="text-center">Teórico</TableHead>
                    <TableHead className="text-center">Diferencia</TableHead>
                    <TableHead className="text-center">% Var.</TableHead>
                    <TableHead className="text-center">Min/Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prods.map(l => (
                    <TableRow key={l.productoId} className={l.alerta ? "bg-orange-50 dark:bg-orange-950/20" : l.bajoMinimo ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <TableCell>
                        <div className="font-medium text-sm">{l.productoNombre}</div>
                        {l.cantidadGramos > 0 && <div className="text-xs text-muted-foreground">{l.cantidadGramos}g abiertos</div>}
                      </TableCell>
                      <TableCell className="text-center font-mono">{l.cantidadFisica}</TableCell>
                      <TableCell className="text-center font-mono text-muted-foreground">{l.cantidadTeorica}</TableCell>
                      <TableCell className="text-center font-mono">
                        <span className={l.diferencia < 0 ? "text-red-500" : l.diferencia > 0 ? "text-green-600" : ""}>
                          {l.diferencia > 0 ? "+" : ""}{l.diferencia}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {l.pctVariacion !== null ? (
                          <Badge variant="outline" className={Math.abs(l.pctVariacion) > 10 ? "border-orange-400 text-orange-600" : ""}>
                            {l.pctVariacion.toFixed(1)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {l.stockMinimo !== null ? (
                          <span className={l.bajoMinimo ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {l.stockMinimo}–{l.stockMaximo}
                            {l.bajoMinimo && " ⚠️"}
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Tab: Historial ───────────────────────────────────────────────────────────
function HistorialTab({ sucursalId, almacenId }: { sucursalId: number; almacenId: number }) {
  const { data: historial } = trpc.inventario.conteoFisico.historial.useQuery({ sucursalId, almacenId });
  const [expandido, setExpandido] = useState<number | null>(null);
  const { data: conteoDetalle } = trpc.inventario.conteoFisico.getById.useQuery(
    { conteoId: expandido! },
    { enabled: !!expandido }
  );
  const { data: productos } = trpc.inventario.productos.list.useQuery();

  if (!historial || historial.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2" />
          <p>No hay conteos registrados aún.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {historial.map(conteo => (
        <Card key={conteo.id} className="overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            onClick={() => setExpandido(expandido === conteo.id ? null : conteo.id)}
          >
            <div className="flex items-center gap-3">
              <Badge variant={conteo.estado === "bloqueado" ? "secondary" : "outline"}>
                {conteo.estado === "bloqueado" ? "Bloqueado" : conteo.estado === "enviado" ? "Enviado" : "Borrador"}
              </Badge>
              <span className="font-medium">{formatSemana(conteo.semana)}</span>
              <span className="text-sm text-muted-foreground">{conteo.fechaConteo}</span>
            </div>
            {expandido === conteo.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandido === conteo.id && conteoDetalle && (
            <CardContent className="pt-0 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Piezas</TableHead>
                    <TableHead className="text-center">Gramos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conteoDetalle.detalles.map(d => {
                    const prod = productos?.find(p => p.id === d.productoId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{prod?.nombre ?? `Producto #${d.productoId}`}</TableCell>
                        <TableCell className="text-center font-mono">{d.cantidadPiezas}</TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {d.cantidadGramos ? `${d.cantidadGramos}g` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {conteoDetalle.conteo.notas && (
                <p className="text-sm text-muted-foreground mt-2 px-2">📝 {conteoDetalle.conteo.notas}</p>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── Tab: Configuración ───────────────────────────────────────────────────────
function ConfigTab({
  sucursalId, almacenes, productos, refetchAlmacenes, refetchProductos
}: {
  sucursalId: number; almacenes: Almacen[]; productos: Producto[];
  refetchAlmacenes: () => void; refetchProductos: () => void;
}) {
  const [showNuevoAlmacen, setShowNuevoAlmacen] = useState(false);
  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [editProducto, setEditProducto] = useState<Producto | null>(null);
  // Duplicar producto
  const [duplicarProducto, setDuplicarProducto] = useState<Producto | null>(null);
  const [nombreDuplicado, setNombreDuplicado] = useState("");
  const eliminarProducto = trpc.inventario.productos.delete.useMutation({
    onSuccess: () => { refetchProductos(); toast.success("Producto eliminado"); },
    onError: (e) => toast.error(e.message),
  });

  const eliminarProducto_confirm = (id: number, nombre: string) => {
    if (confirm(`¿Eliminar "${nombre}"? Esta acción lo desactivará del catálogo.`)) {
      eliminarProducto.mutate({ id });
    }
  };

  const duplicar = trpc.inventario.productos.duplicate.useMutation({
    onSuccess: () => { refetchProductos(); setDuplicarProducto(null); setNombreDuplicado(""); toast.success("Producto duplicado"); },
    onError: (e) => toast.error(e.message),
  });
  // Categorías
  const { data: categoriasDB, refetch: refetchCategorias } = trpc.inventario.categorias.list.useQuery();
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [editCategoria, setEditCategoria] = useState<{ id: number; nombre: string; descripcion?: string | null; color?: string | null; orden: number } | null>(null);
  const [formCat, setFormCat] = useState({ nombre: "", descripcion: "", color: "#6b7280", orden: 0 });
  const crearCategoria = trpc.inventario.categorias.create.useMutation({
    onSuccess: () => { refetchCategorias(); setShowNuevaCategoria(false); setFormCat({ nombre: "", descripcion: "", color: "#6b7280", orden: 0 }); toast.success("Categoría creada"); },
    onError: (e) => toast.error(e.message),
  });
  const actualizarCategoria = trpc.inventario.categorias.update.useMutation({
    onSuccess: () => { refetchCategorias(); setEditCategoria(null); toast.success("Categoría actualizada"); },
    onError: (e) => toast.error(e.message),
  });
  const eliminarCategoria = trpc.inventario.categorias.delete.useMutation({
    onSuccess: () => { refetchCategorias(); toast.success("Categoría eliminada"); },
    onError: (e) => toast.error(e.message),
  });

  // Nuevo almacén
  const [nuevoAlmacen, setNuevoAlmacen] = useState({ nombre: "", tipo: "piezas" as "piezas" | "piezas_gramos", consideraMinMax: false });
  const crearAlmacen = trpc.inventario.almacenes.create.useMutation({
    onSuccess: () => { refetchAlmacenes(); setShowNuevoAlmacen(false); setNuevoAlmacen({ nombre: "", tipo: "piezas", consideraMinMax: false }); toast.success("Almacén creado"); },
    onError: (e) => toast.error(e.message),
  });

  // Nuevo / editar producto
  const [formProd, setFormProd] = useState({ nombre: "", categoria: "General", unidadCompra: "pieza", unidadConteo: "pieza", factorConversion: "1", pesoNetoPorUnidad: "", puedeAbrirse: false, notas: "" });
  const crearProducto = trpc.inventario.productos.create.useMutation({
    onSuccess: () => { refetchProductos(); setShowNuevoProducto(false); toast.success("Producto creado"); },
    onError: (e) => toast.error(e.message),
  });
  const actualizarProducto = trpc.inventario.productos.update.useMutation({
    onSuccess: () => { refetchProductos(); setEditProducto(null); toast.success("Producto actualizado"); },
    onError: (e) => toast.error(e.message),
  });

  const handleGuardarProducto = () => {
    const data = {
      nombre: formProd.nombre,
      categoria: formProd.categoria,
      unidadCompra: formProd.unidadCompra,
      unidadConteo: formProd.unidadConteo,
      factorConversion: parseFloat(formProd.factorConversion) || 1,
      pesoNetoPorUnidad: formProd.pesoNetoPorUnidad ? parseFloat(formProd.pesoNetoPorUnidad) : undefined,
      puedeAbrirse: formProd.puedeAbrirse,
      notas: formProd.notas || undefined,
    };
    if (editProducto) {
      actualizarProducto.mutate({ id: editProducto.id, ...data });
    } else {
      crearProducto.mutate(data);
    }
  };

  const abrirEditar = (p: Producto) => {
    setFormProd({
      nombre: p.nombre, categoria: p.categoria,
      unidadCompra: p.unidadCompra, unidadConteo: p.unidadConteo,
      factorConversion: (p.factorConversion ?? 1).toString(),
      pesoNetoPorUnidad: p.pesoNetoPorUnidad?.toString() ?? "",
      puedeAbrirse: p.puedeAbrirse, notas: p.notas ?? "",
    });
    setEditProducto(p);
  };

  return (
    <div className="space-y-6">
      {/* Almacenes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Warehouse className="w-4 h-4" /> Almacenes</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowNuevoAlmacen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          {almacenes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin almacenes configurados</p>
          ) : (
            <div className="space-y-2">
              {almacenes.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{a.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.tipo === "piezas_gramos" ? "Piezas + Gramos" : "Solo Piezas"}
                      {a.consideraMinMax && " · Aplica Min/Max"}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Activo</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Catálogo de Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> Catálogo de Productos</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setFormProd({ nombre: "", categoria: "General", unidadCompra: "pieza", unidadConteo: "pieza", factorConversion: "1", pesoNetoPorUnidad: "", puedeAbrirse: false, notas: "" }); setShowNuevoProducto(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {productos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin productos en el catálogo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Unidad</TableHead>
                  <TableHead className="text-center">Pesable</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.categoria}</TableCell>
                    <TableCell className="text-center text-sm">{p.unidadConteo}</TableCell>
                    <TableCell className="text-center">{p.puedeAbrirse ? "✅" : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => abrirEditar(p)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" title="Eliminar" onClick={() => eliminarProducto_confirm(p.id, p.nombre)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Duplicar" onClick={() => { setDuplicarProducto(p); setNombreDuplicado(p.nombre + " (copia)"); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sección: Categorías */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Tag className="w-4 h-4" /> Categorías del Catálogo</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setFormCat({ nombre: "", descripcion: "", color: "#6b7280", orden: 0 }); setShowNuevaCategoria(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nueva
          </Button>
        </CardHeader>
        <CardContent>
          {!categoriasDB || categoriasDB.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin categorías. Crea una para organizar el catálogo.</p>
          ) : (
            <div className="space-y-2">
              {categoriasDB.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color ?? "#6b7280" }} />
                    <span className="text-sm font-medium">{cat.nombre}</span>
                    {cat.descripcion && <span className="text-xs text-muted-foreground">{cat.descripcion}</span>}
                    {!cat.activa && <Badge variant="secondary" className="text-xs">Inactiva</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditCategoria(cat)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => eliminarCategoria.mutate({ id: cat.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Modal: Nueva / Editar Categoría */}
      <Dialog open={showNuevaCategoria || !!editCategoria} onOpenChange={v => { if (!v) { setShowNuevaCategoria(false); setEditCategoria(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCategoria ? "Editar Categoría" : "Nueva Categoría"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={editCategoria ? editCategoria.nombre : formCat.nombre}
                onChange={e => editCategoria ? setEditCategoria(p => p ? { ...p, nombre: e.target.value } : p) : setFormCat(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Bebidas, Insumos, Empaque" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Input value={editCategoria ? (editCategoria.descripcion ?? "") : formCat.descripcion}
                onChange={e => editCategoria ? setEditCategoria(p => p ? { ...p, descripcion: e.target.value } : p) : setFormCat(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Descripción breve" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editCategoria ? (editCategoria.color ?? "#6b7280") : formCat.color}
                    onChange={e => editCategoria ? setEditCategoria(p => p ? { ...p, color: e.target.value } : p) : setFormCat(p => ({ ...p, color: e.target.value }))}
                    className="h-9 w-14 rounded border cursor-pointer" />
                  <span className="text-sm text-muted-foreground">{editCategoria ? editCategoria.color : formCat.color}</span>
                </div>
              </div>
              <div>
                <Label>Orden</Label>
                <Input type="number" value={editCategoria ? editCategoria.orden : formCat.orden}
                  onChange={e => editCategoria ? setEditCategoria(p => p ? { ...p, orden: parseInt(e.target.value) || 0 } : p) : setFormCat(p => ({ ...p, orden: parseInt(e.target.value) || 0 }))}
                  placeholder="0" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNuevaCategoria(false); setEditCategoria(null); }}>Cancelar</Button>
            <Button
              onClick={() => editCategoria
                ? actualizarCategoria.mutate({ id: editCategoria.id, nombre: editCategoria.nombre, descripcion: editCategoria.descripcion ?? undefined, color: editCategoria.color ?? undefined, orden: editCategoria.orden })
                : crearCategoria.mutate(formCat)
              }
              disabled={!(editCategoria ? editCategoria.nombre : formCat.nombre) || crearCategoria.isPending || actualizarCategoria.isPending}>
              {editCategoria ? "Guardar" : "Crear Categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal: Duplicar Producto */}
      <Dialog open={!!duplicarProducto} onOpenChange={v => { if (!v) setDuplicarProducto(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duplicar Producto</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Se copiará <strong>{duplicarProducto?.nombre}</strong> con todos sus parámetros. Solo cambia el nombre.</p>
          <div>
            <Label>Nombre del nuevo producto</Label>
            <Input value={nombreDuplicado} onChange={e => setNombreDuplicado(e.target.value)} placeholder="Nombre" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicarProducto(null)}>Cancelar</Button>
            <Button onClick={() => duplicarProducto && duplicar.mutate({ id: duplicarProducto.id, nuevoNombre: nombreDuplicado })} disabled={!nombreDuplicado || duplicar.isPending}>
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal: Nuevo Almacén */}
      <Dialog open={showNuevoAlmacen} onOpenChange={setShowNuevoAlmacen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Almacén</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={nuevoAlmacen.nombre} onChange={e => setNuevoAlmacen(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Bodega, Tienda" />
            </div>
            <div>
              <Label>Tipo de conteo</Label>
              <Select value={nuevoAlmacen.tipo} onValueChange={v => setNuevoAlmacen(p => ({ ...p, tipo: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="piezas">Solo Piezas (bodega)</SelectItem>
                  <SelectItem value="piezas_gramos">Piezas + Gramos (tienda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="minmax" checked={nuevoAlmacen.consideraMinMax}
                onChange={e => setNuevoAlmacen(p => ({ ...p, consideraMinMax: e.target.checked }))} />
              <Label htmlFor="minmax">Aplica mínimos y máximos (para pedidos)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevoAlmacen(false)}>Cancelar</Button>
            <Button onClick={() => crearAlmacen.mutate({ sucursalId, ...nuevoAlmacen })} disabled={!nuevoAlmacen.nombre || crearAlmacen.isPending}>
              Crear Almacén
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Nuevo / Editar Producto */}
      <Dialog open={showNuevoProducto || !!editProducto} onOpenChange={v => { if (!v) { setShowNuevoProducto(false); setEditProducto(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editProducto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={formProd.nombre} onChange={e => setFormProd(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del producto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                {categoriasDB && categoriasDB.length > 0 ? (
                  <Select value={formProd.categoria} onValueChange={v => setFormProd(p => ({ ...p, categoria: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
                    <SelectContent position="item-aligned">
                      {categoriasDB.filter(c => c.activa).map(c => (
                        <SelectItem key={c.id} value={c.nombre}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color ?? "#6b7280" }} />
                            {c.nombre}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formProd.categoria} onChange={e => setFormProd(p => ({ ...p, categoria: e.target.value }))} placeholder="General" />
                )}
              </div>
              <div>
                <Label>Unidad de conteo</Label>
                <Input value={formProd.unidadConteo} onChange={e => setFormProd(p => ({ ...p, unidadConteo: e.target.value }))} placeholder="pieza, bolsa..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidad de compra</Label>
                <Input value={formProd.unidadCompra} onChange={e => setFormProd(p => ({ ...p, unidadCompra: e.target.value }))} placeholder="caja, kg..." />
              </div>
              <div>
                <Label>Factor conversión</Label>
                <Input type="number" value={formProd.factorConversion} onChange={e => setFormProd(p => ({ ...p, factorConversion: e.target.value }))} placeholder="1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pesable" checked={formProd.puedeAbrirse}
                onChange={e => setFormProd(p => ({ ...p, puedeAbrirse: e.target.checked }))} />
              <Label htmlFor="pesable">Puede tener unidades abiertas (pesable en gramos)</Label>
            </div>
            {formProd.puedeAbrirse && (
              <div>
                <Label>Peso neto por unidad (gramos)</Label>
                <Input type="number" value={formProd.pesoNetoPorUnidad} onChange={e => setFormProd(p => ({ ...p, pesoNetoPorUnidad: e.target.value }))} placeholder="Ej: 500" />
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Textarea value={formProd.notas} onChange={e => setFormProd(p => ({ ...p, notas: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNuevoProducto(false); setEditProducto(null); }}>Cancelar</Button>
            <Button onClick={handleGuardarProducto} disabled={!formProd.nombre || crearProducto.isPending || actualizarProducto.isPending}>
              {editProducto ? "Guardar cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente Captura de Ventas ─────────────────────────────────────────────
function VentasCaptura({ sucursalId }: { sucursalId: number }) {
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [busqueda, setBusqueda] = useState("");
  const utils = trpc.useUtils();

  const { data: productos = [] } = trpc.inventario.ventas.listProductos.useQuery();
  const { data: ventasGuardadas = [] } = trpc.inventario.ventas.getByFecha.useQuery(
    { sucursalId, fecha }, { enabled: !!sucursalId && !!fecha }
  );

  // Cargar cantidades guardadas
  useEffect(() => {
    const map: Record<number, number> = {};
    for (const v of ventasGuardadas) map[v.productoVentaId] = v.cantidad;
    setCantidades(map);
  }, [ventasGuardadas]);

  const guardar = trpc.inventario.ventas.guardar.useMutation({
    onSuccess: () => { toast.success("Ventas guardadas"); utils.inventario.ventas.getByFecha.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const productosFiltrados = productos.filter((p: any) =>
    busqueda === "" || `${p.nombre} ${p.sabor}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Agrupar por nombre de producto
  const grupos = productosFiltrados.reduce((acc: any, p: any) => {
    if (!acc[p.nombre]) acc[p.nombre] = [];
    acc[p.nombre].push(p);
    return acc;
  }, {});

  const total = Object.values(cantidades).reduce((a: number, b) => a + (b || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm">Captura de Ventas</h3>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-40 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total: <strong>{total}</strong> bebidas</span>
          <Button size="sm" className="bg-green-600 hover:bg-green-700"
            onClick={() => guardar.mutate({ sucursalId, fecha, lineas: Object.entries(cantidades).map(([id, cantidad]) => ({ productoVentaId: Number(id), cantidad: cantidad || 0 })) })}
            disabled={guardar.isPending}>
            {guardar.isPending ? "Guardando..." : "Guardar ventas"}
          </Button>
        </div>
      </div>

      <Input placeholder="Buscar producto o sabor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="h-8 text-sm" />

      <div className="space-y-4">
        {Object.entries(grupos).map(([nombre, items]: [string, any]) => (
          <div key={nombre} className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{nombre}</div>
            <div className="divide-y">
              {items.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{p.sabor || p.nombre}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCantidades(c => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-sm font-bold">−</button>
                    <input type="number" min="0" value={cantidades[p.id] || 0}
                      onChange={e => setCantidades(c => ({ ...c, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-14 h-7 text-center text-sm border rounded" />
                    <button onClick={() => setCantidades(c => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}
                      className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-sm font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
