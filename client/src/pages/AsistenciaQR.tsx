import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, QrCode, LogIn, LogOut, MapPin, Loader2, ChevronDown } from "lucide-react";

// Parsear query params
function useQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token") ?? "",
    sucursalId: Number(params.get("sucursalId") ?? "0"),
  };
}

// Reloj que se actualiza cada segundo usando un interval — NO llama new Date() en render
function RelojActual() {
  const [hora, setHora] = useState(() =>
    new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setHora(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="text-center text-3xl font-bold tabular-nums">{hora}</div>;
}

// Selector nativo de empleado — evita el portal de Radix Select que causa removeChild en móvil
interface SelectorEmpleadoProps {
  empleados: { id: number; nombre: string; apellido?: string | null }[];
  value: string;
  onChange: (v: string) => void;
}
function SelectorEmpleado({ empleados, value, onChange }: SelectorEmpleadoProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 px-3 pr-10 text-base rounded-md border border-input bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="">Selecciona tu nombre...</option>
        {empleados.map(e => (
          <option key={e.id} value={e.id.toString()}>
            {e.nombre} {e.apellido ?? ""}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

export default function AsistenciaQR() {
  const { token, sucursalId } = useQueryParams();
  const [empleadoId, setEmpleadoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicacionError, setUbicacionError] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);

  const { data: empleados = [], isLoading: loadingEmpleados } = trpc.empleados.list.useQuery(
    { sucursalId },
    { enabled: !!sucursalId }
  );

  const registrarMut = trpc.asistencia.registrarQr.useMutation({
    onSuccess: (data) => {
      setResultado({ ok: true, mensaje: `${tipo === "entrada" ? "Entrada" : "Salida"} registrada para ${data.empleadoNombre} en ${data.sucursalNombre}` });
    },
    onError: (e) => {
      setResultado({ ok: false, mensaje: e.message });
    },
  });

  // Solicitar ubicación al cargar
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUbicacionError(true),
        { timeout: 5000 }
      );
    } else {
      setUbicacionError(true);
    }
  }, []);

  function handleRegistrar() {
    if (!empleadoId) { toast.error("Selecciona tu nombre"); return; }
    registrarMut.mutate({
      qrToken: token,
      empleadoId: Number(empleadoId),
      tipo,
      latitud: ubicacion?.lat,
      longitud: ubicacion?.lng,
    });
  }

  if (!token || !sucursalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">QR inválido</h1>
          <p className="text-muted-foreground text-sm">Este código QR no es válido o ha expirado. Solicita uno nuevo al líder de tu tienda.</p>
        </div>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          {resultado.ok ? (
            <>
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-green-600 mb-2">
                {tipo === "entrada" ? "¡Buen turno!" : "¡Hasta pronto!"}
              </h1>
              <p className="text-muted-foreground">{resultado.mensaje}</p>
              <p className="text-sm text-muted-foreground mt-2">
                <RelojActual />
              </p>
              <Button
                className="mt-6 w-full"
                variant="outline"
                onClick={() => { setResultado(null); setEmpleadoId(""); }}
              >
                Registrar otro empleado
              </Button>
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-destructive mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">No se pudo registrar</h1>
              <p className="text-muted-foreground text-sm">{resultado.mensaje}</p>
              <Button className="mt-6 w-full" onClick={() => setResultado(null)}>
                Intentar de nuevo
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Registro de Asistencia</h1>
          <p className="text-muted-foreground text-sm mt-1">Snowtea — Tienda #{sucursalId}</p>
        </div>

        {/* Card de registro */}
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-5">
          {/* Tipo entrada/salida */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipo("entrada")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                tipo === "entrada"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <LogIn className="w-6 h-6" />
              <span className="text-sm font-semibold">Entrada</span>
            </button>
            <button
              onClick={() => setTipo("salida")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                tipo === "salida"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <LogOut className="w-6 h-6" />
              <span className="text-sm font-semibold">Salida</span>
            </button>
          </div>

          {/* Selector de empleado — usa <select> nativo para evitar crash de portal Radix en móvil */}
          <div>
            <label className="text-sm font-medium mb-2 block">¿Quién eres?</label>
            {loadingEmpleados ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            ) : (
              <SelectorEmpleado
                empleados={empleados}
                value={empleadoId}
                onChange={setEmpleadoId}
              />
            )}
          </div>

          {/* Indicador de ubicación */}
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            ubicacion ? "bg-green-50 text-green-700" : ubicacionError ? "bg-yellow-50 text-yellow-700" : "bg-muted text-muted-foreground"
          }`}>
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {ubicacion
              ? "Ubicación detectada"
              : ubicacionError
              ? "Sin acceso a ubicación (se registrará sin coordenadas)"
              : "Obteniendo ubicación..."}
          </div>

          {/* Reloj actual — estabilizado con useEffect para no causar re-renders infinitos */}
          <RelojActual />

          {/* Botón registrar */}
          <Button
            className={`w-full h-14 text-base font-semibold rounded-xl ${
              tipo === "entrada"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
            onClick={handleRegistrar}
            disabled={registrarMut.isPending || !empleadoId}
          >
            {registrarMut.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {tipo === "entrada" ? <LogIn className="w-5 h-5 mr-2" /> : <LogOut className="w-5 h-5 mr-2" />}
                Registrar {tipo === "entrada" ? "entrada" : "salida"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
