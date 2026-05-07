import { useState, useMemo, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, RefreshCw, Download, ChevronDown } from "lucide-react";

const HOY_INICIO = () => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); };
const HOY_FIN   = () => { const d = new Date(); d.setHours(23,59,59,999); return d.getTime(); };

function NativeSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 pr-9 text-sm rounded-md border border-input bg-background appearance-none focus:outline-none focus:ring-2 focus:ring-ring">
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function formatHora(ts: number) {
  return new Date(ts).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function subtipoLabel(subtipo?: string) {
  if (!subtipo) return "";
  const map: Record<string,string> = {
    apertura_tienda: "Apertura",
    entrada_turno:   "Turno",
    cierre_tienda:   "Cierre",
    salida_turno:    "Salida",
  };
  return map[subtipo] ?? subtipo;
}

export default function Asistencia() {
  const [sucursalId, setSucursalId]   = useState<number | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [hoyInicio] = useState(() => HOY_INICIO());
  const [hoyFin]    = useState(() => HOY_FIN());

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  // Auto-seleccionar sucursal cuando el usuario solo tiene una asignada (lider 1 tienda)
  useMemo(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales.length]);
  useEffect(() => {
    if (sucursales.length === 1 && sucursalId === null) setSucursalId(sucursales[0].id);
  }, [sucursales]);

  const { data: qrData, refetch: refetchQr } = trpc.asistencia.getQrToken.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId && qrDialogOpen }
  );
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalId ?? 0 }, { enabled: !!sucursalId }
  );
  const { data: registros = [], refetch: refetchRegistros } = trpc.asistencia.listBySucursal.useQuery(
    { sucursalId: sucursalId ?? 0, fechaInicio: hoyInicio, fechaFin: hoyFin },
    { enabled: !!sucursalId, refetchInterval: 30000 }
  );

  const generarQrMut = trpc.asistencia.generarQrToken.useMutation({
    onSuccess: () => { refetchQr(); toast.success("QR regenerado"); },
    onError: e => toast.error(e.message),
  });

  const qrUrl = qrData?.token
    ? `${window.location.origin}/asistencia-qr?token=${qrData.token}&sucursalId=${sucursalId}`
    : null;

  // Lista de todos los registros individuales del día con nombre del empleado
  const registrosConNombre = useMemo(() => {
    return [...registros]
      .sort((a, b) => b.timestamp - a.timestamp) // más recientes primero
      .map(r => {
        const emp = empleados.find(e => e.id === r.empleadoId);
        return {
          ...r,
          nombre: emp ? `${emp.nombre} ${emp.apellido ?? ""}`.trim() : `Empleado #${r.empleadoId}`,
          subtipo: (r as any).subtipo as string | undefined,
        };
      });
  }, [registros, empleados]);

  // Para los KPIs seguimos agrupando por empleado
  const porEmpleado = useMemo(() => {
    const mapa: Record<number, { entrada: boolean; salida: boolean }> = {};
    for (const r of registros) {
      if (!mapa[r.empleadoId]) mapa[r.empleadoId] = { entrada: false, salida: false };
      if (r.tipo === "entrada") mapa[r.empleadoId].entrada = true;
      if (r.tipo === "salida") mapa[r.empleadoId].salida = true;
    }
    return mapa;
  }, [registros]);

  const enTurno     = Object.values(porEmpleado).filter(e => e.entrada && !e.salida).length;
  const salieron    = Object.values(porEmpleado).filter(e => e.salida).length;
  const sinRegistro = empleados.filter(e => !porEmpleado[e.id]).length;

  function descargarQr() {
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-checador-${sucursalId}.svg`;
    a.click();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Asistencia</h1>
            <p className="text-sm text-muted-foreground">Registro por QR desde celular</p>
          </div>
        </div>
        <Button onClick={() => setQrDialogOpen(true)} className="bg-violet-600 hover:bg-violet-700">
          <QrCode className="w-4 h-4 mr-2" /> Ver QR
        </Button>
      </div>

      {sucursales.length > 1 && (
        <div className="max-w-xs">
          <label className="text-sm font-medium mb-1.5 block">Sucursal</label>
          <NativeSelect value={sucursalId?.toString() ?? ""} onChange={v => setSucursalId(Number(v))}>
            <option value="">Selecciona...</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </NativeSelect>
        </div>
      )}

      {sucursalId && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl border p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{enTurno}</p>
              <p className="text-sm text-muted-foreground mt-1">En turno ahora</p>
            </div>
            <div className="bg-card rounded-2xl border p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{salieron}</p>
              <p className="text-sm text-muted-foreground mt-1">Salieron hoy</p>
            </div>
            <div className="bg-card rounded-2xl border p-4 text-center">
              <p className="text-3xl font-bold text-orange-500">{sinRegistro}</p>
              <p className="text-sm text-muted-foreground mt-1">Sin registrar hoy</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">Registros de hoy</h2>
              <button onClick={() => refetchRegistros()}
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
                <RefreshCw className="w-3 h-3" /> Actualizar
              </button>
            </div>
            {registrosConNombre.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Ningún empleado ha registrado asistencia hoy
              </div>
            ) : (
              <div className="divide-y">
                {registrosConNombre.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                      r.tipo === "entrada" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"
                    }`}>
                      {r.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatHora(r.timestamp)} · {subtipoLabel(r.subtipo)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.tipo === "salida"
                        ? "bg-orange-100 text-orange-600"
                        : (r.subtipo === "apertura_tienda" ? "bg-violet-100 text-violet-700" : "bg-green-100 text-green-700")
                    }`}>
                      {r.tipo === "salida" ? (r.subtipo === "cierre_tienda" ? "Cierre" : "Salida") :
                       r.subtipo === "apertura_tienda" ? "Apertura" : "Entrada"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {sinRegistro > 0 && (
              <div className="px-5 py-3 border-t bg-orange-50/50">
                <p className="text-xs text-orange-600 font-medium mb-2">Sin registrar hoy:</p>
                <div className="flex flex-wrap gap-1.5">
                  {empleados
                    .filter(e => !registrosConNombre.find(r => r.empleadoId === e.id))
                    .map(e => (
                      <span key={e.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        {e.nombre}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR de Asistencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              El empleado escanea este código con su celular para registrar su asistencia.
            </p>
            {qrUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-2xl border shadow-sm">
                  <QRCodeSVG id="qr-svg" value={qrUrl} size={220} level="M" />
                </div>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" onClick={descargarQr}>
                    <Download className="w-4 h-4 mr-2" /> Descargar
                  </Button>
                  <Button variant="outline" className="flex-1"
                    onClick={() => generarQrMut.mutate({ sucursalId: sucursalId! })}
                    disabled={generarQrMut.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${generarQrMut.isPending ? "animate-spin" : ""}`} />
                    Regenerar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-muted-foreground">Esta sucursal no tiene QR aún.</p>
                <Button onClick={() => generarQrMut.mutate({ sucursalId: sucursalId! })}
                  disabled={generarQrMut.isPending}>
                  {generarQrMut.isPending ? "Generando..." : "Generar QR"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
