import { useState, useMemo, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { QrCode, RefreshCw, Clock, Download, UserCheck, UserX, Plus, Calendar } from "lucide-react";

const HOY_INICIO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const HOY_FIN = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

export default function Asistencia() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ empleadoId: "", tipo: "entrada" as "entrada" | "salida", hora: new Date().toTimeString().slice(0, 5) });
  const [fechaFiltro] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  // Auto-seleccionar sucursal si el usuario solo tiene una asignada (evita el Select con 1 opción que causa error DOM)
  useEffect(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales]);
  const { data: qrData, refetch: refetchQr } = trpc.asistencia.getQrToken.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId && qrDialogOpen }
  );
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId }
  );
  const { data: registros = [], refetch: refetchRegistros } = trpc.asistencia.listBySucursal.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: HOY_INICIO(), fechaFin: HOY_FIN() },
    { enabled: !!sucursalId }
  );

  const utils = trpc.useUtils();

  const generarQrMut = trpc.asistencia.generarQrToken.useMutation({
    onSuccess: () => {
      refetchQr();
      toast.success("QR regenerado correctamente");
    },
    onError: (e) => toast.error(e.message),
  });

  const manualMut = trpc.asistencia.registrarManual.useMutation({
    onSuccess: () => {
      utils.asistencia.listBySucursal.invalidate();
      toast.success("Asistencia registrada manualmente");
      setManualDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  // URL pública para el QR (página de registro desde celular)
  const qrUrl = qrData?.token
    ? `${window.location.origin}/asistencia-qr?token=${qrData.token}&sucursalId=${sucursalId}`
    : null;

  // Agrupar registros por empleado para mostrar entrada/salida
  const resumenEmpleados = useMemo(() => {
    const mapa: Record<number, { empleadoId: number; nombre: string; entrada?: number; salida?: number }> = {};
    for (const r of registros) {
      if (!mapa[r.empleadoId]) {
        const emp = empleados.find(e => e.id === r.empleadoId);
        mapa[r.empleadoId] = { empleadoId: r.empleadoId, nombre: emp ? `${emp.nombre} ${emp.apellido ?? ""}`.trim() : `Empleado #${r.empleadoId}` };
      }
      if (r.tipo === "entrada" && (!mapa[r.empleadoId].entrada || r.timestamp < mapa[r.empleadoId].entrada!)) {
        mapa[r.empleadoId].entrada = r.timestamp;
      }
      if (r.tipo === "salida" && (!mapa[r.empleadoId].salida || r.timestamp > mapa[r.empleadoId].salida!)) {
        mapa[r.empleadoId].salida = r.timestamp;
      }
    }
    return Object.values(mapa).sort((a, b) => (a.entrada ?? 0) - (b.entrada ?? 0));
  }, [registros, empleados]);

  function formatHora(ts: number) {
    return new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  function handleManualSubmit() {
    if (!manualForm.empleadoId || !sucursalId) { toast.error("Selecciona un empleado"); return; }
    const [h, m] = manualForm.hora.split(":").map(Number);
    const ts = new Date();
    ts.setHours(h, m, 0, 0);
    manualMut.mutate({
      empleadoId: Number(manualForm.empleadoId),
      sucursalId,
      tipo: manualForm.tipo,
      timestamp: ts.getTime(),
    });
  }

  function descargarQr() {
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-asistencia-${sucursalId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sucursalActual = sucursales.find(s => s.id === sucursalId);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Asistencia</h1>
            <p className="text-sm text-muted-foreground">Registro por QR desde celular o manual</p>
          </div>
        </div>
        {canEdit && sucursalId && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualDialogOpen(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Manual
            </Button>
            <Button size="sm" onClick={() => setQrDialogOpen(true)} className="gap-1">
              <QrCode className="w-3.5 h-3.5" /> Ver QR
            </Button>
          </div>
        )}
      </div>

      {/* Selector de sucursal */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Sucursal</Label>
              <Select value={sucursalId?.toString() ?? ""} onValueChange={v => setSucursalId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Selecciona una sucursal..." /></SelectTrigger>
                <SelectContent>
                  {sucursales.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {sucursalId && (
              <div className="flex items-center gap-2 mt-5 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!sucursalId && (
        <div className="text-center py-16 text-muted-foreground">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecciona una sucursal para ver la asistencia del día</p>
        </div>
      )}

      {sucursalId && (
        <>
          {/* Resumen del día */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-violet-600">{resumenEmpleados.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Empleados presentes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-green-600">{resumenEmpleados.filter(e => e.entrada).length}</div>
                <div className="text-xs text-muted-foreground mt-1">Con entrada registrada</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{empleados.length - resumenEmpleados.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Sin registrar hoy</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de asistencia del día */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Registros de hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resumenEmpleados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserX className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aún no hay registros de asistencia hoy</p>
                  <p className="text-xs mt-1">Los empleados pueden escanear el QR para registrar su entrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {resumenEmpleados.map(emp => (
                    <div key={emp.empleadoId} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-sm">
                          {emp.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm">{emp.nombre}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-green-500" />
                          <span className={emp.entrada ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {emp.entrada ? formatHora(emp.entrada) : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <UserX className="w-3.5 h-3.5 text-orange-500" />
                          <span className={emp.salida ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                            {emp.salida ? formatHora(emp.salida) : "—"}
                          </span>
                        </div>
                        {emp.entrada && emp.salida && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs" variant="outline">
                            {Math.round((emp.salida - emp.entrada) / 3600000 * 10) / 10}h
                          </Badge>
                        )}
                        {emp.entrada && !emp.salida && (
                          <Badge className="bg-green-100 text-green-800 text-xs" variant="outline">En turno</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empleados sin registro */}
              {empleados.filter(e => !resumenEmpleados.find(r => r.empleadoId === e.id)).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Sin registro hoy:</p>
                  <div className="flex flex-wrap gap-2">
                    {empleados
                      .filter(e => !resumenEmpleados.find(r => r.empleadoId === e.id))
                      .map(e => (
                        <Badge key={e.id} variant="outline" className="text-xs text-muted-foreground">
                          {e.nombre} {e.apellido ?? ""}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog QR */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR de Asistencia — {sucursalActual?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrUrl ? (
              <>
                <div className="p-4 bg-white rounded-xl border-2 border-violet-200">
                  <QRCodeSVG
                    id="qr-svg"
                    value={qrUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Los empleados escanean este QR con su celular para registrar entrada o salida
                </p>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={descargarQr}>
                    <Download className="w-3.5 h-3.5" /> Descargar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => generarQrMut.mutate({ sucursalId: sucursalId! })}>
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerar
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No hay QR generado para esta sucursal</p>
                <Button onClick={() => generarQrMut.mutate({ sucursalId: sucursalId! })} disabled={generarQrMut.isPending}>
                  Generar QR
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog registro manual */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registro manual de asistencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empleado</Label>
              <Select value={manualForm.empleadoId} onValueChange={v => setManualForm(f => ({ ...f, empleadoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona empleado..." /></SelectTrigger>
                <SelectContent>
                  {empleados.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nombre} {e.apellido ?? ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={manualForm.tipo} onValueChange={v => setManualForm(f => ({ ...f, tipo: v as "entrada" | "salida" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="salida">Salida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={manualForm.hora} onChange={e => setManualForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualSubmit} disabled={manualMut.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
