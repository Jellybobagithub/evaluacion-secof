import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ClipboardList, Plus, Eye, Trash2, TrendingUp, Users, Clock,
  DollarSign, AlertTriangle, FileText, Send, ChevronRight, Calendar,
} from "lucide-react";

type Reporte = {
  id: number;
  sucursalId: number;
  usuarioId: number;
  usuarioNombre: string | null;
  fecha: Date;
  ventasTotales: number | null;
  transacciones: number | null;
  ticketPromedio: number | null;
  apertura: string | null;
  cierre: string | null;
  personalPresente: number | null;
  incidentes: string | null;
  novedades: string | null;
  observaciones: string | null;
  estado: "borrador" | "enviado";
  createdAt: Date;
};

const EMPTY_FORM = {
  sucursalId: "",
  fecha: new Date().toISOString().slice(0, 10),
  ventasTotales: "",
  transacciones: "",
  ticketPromedio: "",
  apertura: "",
  cierre: "",
  personalPresente: "",
  incidentes: "",
  novedades: "",
  observaciones: "",
  mermasMonto: "",
  mermasDetalle: "",
};

export default function ReporteDiario() {
  const { user } = useAuth();
  const currentRole = (user as any)?.role ?? "user";
  const utils = trpc.useUtils();

  const [filterSucursal, setFilterSucursal] = useState<number | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingReporte, setViewingReporte] = useState<Reporte | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: reportes = [], isLoading } = trpc.reportesDiarios.list.useQuery({
    sucursalId: filterSucursal,
    limit: 50,
  });

  const createMutation = trpc.reportesDiarios.create.useMutation({
    onSuccess: () => {
      toast.success("Reporte guardado correctamente");
      utils.reportesDiarios.list.invalidate();
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.reportesDiarios.update.useMutation({
    onSuccess: () => {
      toast.success("Reporte actualizado");
      utils.reportesDiarios.list.invalidate();
      setShowForm(false);
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.reportesDiarios.delete.useMutation({
    onSuccess: () => {
      toast.success("Reporte eliminado");
      utils.reportesDiarios.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sucursalNombre = (id: number) =>
    (sucursales as any[]).find((s: any) => s.id === id)?.nombre ?? `Sucursal ${id}`;

  function openNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(r: Reporte) {
    setEditingId(r.id);
    setForm({
      sucursalId: String(r.sucursalId),
      fecha: new Date(r.fecha).toISOString().slice(0, 10),
      ventasTotales: r.ventasTotales != null ? String(r.ventasTotales) : "",
      transacciones: r.transacciones != null ? String(r.transacciones) : "",
      ticketPromedio: r.ticketPromedio != null ? String(r.ticketPromedio) : "",
      apertura: r.apertura ?? "",
      cierre: r.cierre ?? "",
      personalPresente: r.personalPresente != null ? String(r.personalPresente) : "",
      incidentes: r.incidentes ?? "",
      novedades: r.novedades ?? "",
      observaciones: r.observaciones ?? "",
      mermasMonto: (r as any).mermasMonto != null ? String((r as any).mermasMonto) : "",
      mermasDetalle: (r as any).mermasDetalle ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit(estado: "borrador" | "enviado") {
    if (!form.sucursalId) { toast.error("Selecciona una sucursal"); return; }
    const payload = {
      sucursalId: parseInt(form.sucursalId),
      fecha: form.fecha || undefined,
      ventasTotales: form.ventasTotales ? parseFloat(form.ventasTotales) : undefined,
      transacciones: form.transacciones ? parseInt(form.transacciones) : undefined,
      ticketPromedio: form.ticketPromedio ? parseFloat(form.ticketPromedio) : undefined,
      apertura: form.apertura || undefined,
      cierre: form.cierre || undefined,
      personalPresente: form.personalPresente ? parseInt(form.personalPresente) : undefined,
      incidentes: form.incidentes || undefined,
      novedades: form.novedades || undefined,
      observaciones: form.observaciones || undefined,
      mermasMonto: form.mermasMonto ? parseFloat(form.mermasMonto) : undefined,
      mermasDetalle: form.mermasDetalle || undefined,
      estado,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const reportesList = reportes as Reporte[];

  // KPIs del listado actual
  const kpis = useMemo(() => {
    const enviados = reportesList.filter(r => r.estado === "enviado");
    const totalVentas = enviados.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
    const totalTx = enviados.reduce((s, r) => s + (r.transacciones ?? 0), 0);
    const avgTicket = enviados.length > 0
      ? enviados.reduce((s, r) => s + (r.ticketPromedio ?? 0), 0) / enviados.length
      : 0;
    return { enviados: enviados.length, totalVentas, totalTx, avgTicket };
  }, [reportesList]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Reporte Diario
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registra ventas, operación e incidentes del día
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Reporte
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Reportes enviados", value: kpis.enviados, icon: Send, color: "text-green-600" },
            { label: "Ventas totales", value: `$${kpis.totalVentas.toLocaleString("es-MX", { minimumFractionDigits: 0 })}`, icon: DollarSign, color: "text-blue-600" },
            { label: "Transacciones", value: kpis.totalTx, icon: TrendingUp, color: "text-purple-600" },
            { label: "Ticket promedio", value: `$${kpis.avgTicket.toFixed(0)}`, icon: Users, color: "text-amber-600" },
          ].map(k => (
            <Card key={k.label} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={filterSucursal ? String(filterSucursal) : "all"}
            onValueChange={v => setFilterSucursal(v === "all" ? undefined : parseInt(v))}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Todas las sucursales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {(sucursales as any[]).map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de reportes */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {reportesList.length} reporte{reportesList.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Cargando reportes...</div>
            ) : reportesList.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No hay reportes registrados aún.</p>
                <Button onClick={openNew} variant="outline" size="sm" className="mt-3 gap-2">
                  <Plus className="w-4 h-4" />
                  Crear primer reporte
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {reportesList.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{sucursalNombre(r.sucursalId)}</span>
                        <Badge variant={r.estado === "enviado" ? "default" : "secondary"} className="text-xs">
                          {r.estado === "enviado" ? "Enviado" : "Borrador"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(r.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {r.ventasTotales != null && r.ventasTotales > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${r.ventasTotales.toLocaleString("es-MX")}
                          </span>
                        )}
                        {r.transacciones != null && r.transacciones > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {r.transacciones} tx
                          </span>
                        )}
                        {r.apertura && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {r.apertura}{r.cierre ? ` – ${r.cierre}` : ""}
                          </span>
                        )}
                        {r.incidentes && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Incidente
                          </span>
                        )}
                        <span className="text-muted-foreground/60">{r.usuarioNombre}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewingReporte(r)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {r.estado === "borrador" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                      {['superadmin', 'owner', 'manager'].includes(currentRole) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("¿Eliminar este reporte?")) deleteMutation.mutate({ id: r.id });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Formulario de Reporte */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              {editingId ? "Editar Reporte Diario" : "Nuevo Reporte Diario"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Sucursal y Fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sucursal *</Label>
                <Select value={form.sucursalId} onValueChange={v => setForm(f => ({ ...f, sucursalId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sucursales as any[]).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                />
              </div>
            </div>

            {/* Ventas */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Ventas del Día
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ventas totales ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.ventasTotales}
                    onChange={e => setForm(f => ({ ...f, ventasTotales: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Transacciones</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.transacciones}
                    onChange={e => setForm(f => ({ ...f, transacciones: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ticket promedio ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={form.ticketPromedio}
                    onChange={e => setForm(f => ({ ...f, ticketPromedio: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Operación */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Operación
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hora apertura</Label>
                  <Input
                    type="time"
                    value={form.apertura}
                    onChange={e => setForm(f => ({ ...f, apertura: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora cierre</Label>
                  <Input
                    type="time"
                    value={form.cierre}
                    onChange={e => setForm(f => ({ ...f, cierre: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Personal presente</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.personalPresente}
                    onChange={e => setForm(f => ({ ...f, personalPresente: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Incidentes y Novedades */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Incidentes y Novedades
              </h3>
              <div className="space-y-1">
                <Label className="text-xs">Incidentes del día</Label>
                <Textarea
                  placeholder="Describe cualquier incidente ocurrido durante el día..."
                  value={form.incidentes}
                  onChange={e => setForm(f => ({ ...f, incidentes: e.target.value }))}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Novedades</Label>
                <Textarea
                  placeholder="Visitas especiales, eventos, cambios de personal..."
                  value={form.novedades}
                  onChange={e => setForm(f => ({ ...f, novedades: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observaciones generales</Label>
                <Textarea
                  placeholder="Cualquier otra observación relevante del día..."
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>
              {/* Mermas */}
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Control de Mermas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monto de mermas ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.mermasMonto}
                      onChange={e => setForm(f => ({ ...f, mermasMonto: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Detalle de mermas</Label>
                    <Textarea
                      placeholder="Describe qué productos y por qué razón..."
                      value={form.mermasDetalle}
                      onChange={e => setForm(f => ({ ...f, mermasDetalle: e.target.value }))}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit("borrador")}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Guardar borrador
            </Button>
            <Button
              onClick={() => handleSubmit("enviado")}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Enviar reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver detalle de reporte */}
      <Dialog open={!!viewingReporte} onOpenChange={v => { if (!v) setViewingReporte(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Detalle del Reporte
            </DialogTitle>
          </DialogHeader>
          {viewingReporte && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{sucursalNombre(viewingReporte.sucursalId)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(viewingReporte.fecha).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <Badge variant={viewingReporte.estado === "enviado" ? "default" : "secondary"}>
                  {viewingReporte.estado === "enviado" ? "Enviado" : "Borrador"}
                </Badge>
              </div>

              {/* Ventas */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ventas", value: viewingReporte.ventasTotales != null ? `$${viewingReporte.ventasTotales.toLocaleString("es-MX")}` : "—" },
                  { label: "Transacciones", value: viewingReporte.transacciones ?? "—" },
                  { label: "Ticket prom.", value: viewingReporte.ticketPromedio != null ? `$${viewingReporte.ticketPromedio.toFixed(0)}` : "—" },
                ].map(k => (
                  <div key={k.label} className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="font-bold text-sm mt-1">{String(k.value)}</p>
                  </div>
                ))}
              </div>

              {/* Operación */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Apertura", value: viewingReporte.apertura ?? "—" },
                  { label: "Cierre", value: viewingReporte.cierre ?? "—" },
                  { label: "Personal", value: viewingReporte.personalPresente ?? "—" },
                ].map(k => (
                  <div key={k.label} className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="font-bold text-sm mt-1">{String(k.value)}</p>
                  </div>
                ))}
              </div>

              {viewingReporte.incidentes && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Incidentes
                  </p>
                  <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    {viewingReporte.incidentes}
                  </p>
                </div>
              )}

              {viewingReporte.novedades && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Novedades</p>
                  <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg">{viewingReporte.novedades}</p>
                </div>
              )}

              {viewingReporte.observaciones && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Observaciones</p>
                  <p className="text-sm text-foreground bg-muted/40 p-3 rounded-lg">{viewingReporte.observaciones}</p>
                </div>
              )}

              {/* Mermas */}
              {((viewingReporte as any).mermasMonto != null && (viewingReporte as any).mermasMonto > 0) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                    📉 Control de Mermas
                  </p>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Monto registrado</span>
                      <span className="font-bold text-red-700">${Number((viewingReporte as any).mermasMonto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {viewingReporte.ventasTotales && (viewingReporte as any).mermasMonto > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">% vs ventas del día</span>
                        <span className={`font-semibold text-xs ${ ((viewingReporte as any).mermasMonto / viewingReporte.ventasTotales * 100) > 3 ? 'text-red-600' : 'text-green-600' }`}>
                          {((viewingReporte as any).mermasMonto / viewingReporte.ventasTotales * 100).toFixed(1)}%
                          {((viewingReporte as any).mermasMonto / viewingReporte.ventasTotales * 100) > 3 ? ' ⚠️ Sobre meta' : ' ✅ Dentro de meta'}
                        </span>
                      </div>
                    )}
                    {(viewingReporte as any).mermasDetalle && (
                      <p className="text-sm text-foreground">{(viewingReporte as any).mermasDetalle}</p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                Registrado por: {viewingReporte.usuarioNombre ?? "—"}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReporte(null)}>Cerrar</Button>
            {viewingReporte?.estado === "borrador" && (
              <Button onClick={() => { openEdit(viewingReporte); setViewingReporte(null); }} className="gap-2">
                <FileText className="w-4 h-4" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
