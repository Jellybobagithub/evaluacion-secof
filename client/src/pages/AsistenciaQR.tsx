import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, QrCode, LogIn, LogOut,
  MapPin, Loader2, ChevronDown, Camera, Store,
  UserCheck, AlertTriangle, RefreshCw,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token") ?? "",
    sucursalId: Number(params.get("sucursalId") ?? "0"),
  };
}

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
  return <div className="text-center text-4xl font-bold tabular-nums tracking-tight">{hora}</div>;
}

function SelectorEmpleado({
  empleados, value, onChange,
}: {
  empleados: { id: number; nombre: string; apellido?: string | null }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-14 px-4 pr-10 text-base rounded-xl border border-input bg-background text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Selecciona tu nombre...</option>
        {empleados.map(e => (
          <option key={e.id} value={e.id.toString()}>
            {e.nombre} {e.apellido ?? ""}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// Captura foto desde cámara — devuelve base64
function CapturaFoto({
  label, capture, preview, onCaptura, required,
}: {
  label: string;
  capture: "environment" | "user";
  preview: string | null;
  onCaptura: (base64: string) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        onCaptura(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-1">
        <Camera className="w-4 h-4" />
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={handleFile}
      />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Evidencia" className="w-full h-40 object-cover" />
          <button
            type="button"
            onClick={() => { onCaptura(""); inputRef.current?.click(); }}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Retomar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Camera className="w-8 h-8" />
          <span className="text-sm">Tomar foto</span>
        </button>
      )}
    </div>
  );
}

function CampoNumero({
  label, value, onChange, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="w-full h-12 px-4 text-lg rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center font-bold"
      />
    </div>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Subtipo = "apertura_tienda" | "entrada_turno" | "cierre_tienda" | "salida_turno";
type Paso = "inicio" | "tipo" | "subtipo" | "datos_apertura" | "datos_cierre" | "datos_uniforme" | "confirmar";

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AsistenciaQR() {
  const { token, sucursalId } = useQueryParams();

  // Estado del wizard
  const [paso, setPaso] = useState<Paso>("inicio");
  const [empleadoId, setEmpleadoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [subtipo, setSubtipo] = useState<Subtipo>("entrada_turno");

  // Datos selladora / conteo
  const [fotoBase64, setFotoBase64] = useState<string | null>(null); // foto selladora
  const [fotoUniforme, setFotoUniforme] = useState<string | null>(null); // selfie uniforme // foto selladora
  const [contadorSelladora, setContadorSelladora] = useState("");
  const [vasosConteo, setVasosConteo] = useState("");
  const [popotesConteo, setPopotesConteo] = useState("");
  const [selladuroOk, setSelladuroOk] = useState<boolean>(true);
  const [motivoSelladora, setMotivoSelladora] = useState("");
  const [motivoDiferencia, setMotivoDiferencia] = useState("");
  const [fotoEvidencia, setFotoEvidencia] = useState<string | null>(null);

  // GPS
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicacionError, setUbicacionError] = useState(false);

  // Resultado final
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; subtipo?: Subtipo } | null>(null);

  const { data: empleados = [], isLoading: loadingEmpleados } = trpc.empleados.list.useQuery(
    { sucursalId },
    { enabled: !!sucursalId }
  );

  // Obtener última apertura del día (para cálculo de diferencias en cierre)
  const { data: ultimaApertura } = trpc.asistencia.getUltimaApertura.useQuery(
    { sucursalId, empleadoId: Number(empleadoId), qrToken: token },
    { enabled: !!empleadoId && subtipo === "cierre_tienda" && paso === "datos_cierre" }
  );

  const verificarCaraMut = trpc.turno.verificarCaraVisible.useMutation();

  const registrarMut = trpc.asistencia.registrarQr.useMutation({
    onSuccess: (data) => {
      setResultado({
        ok: true,
        mensaje: `Registrado como ${data.empleadoNombre} en ${data.sucursalNombre}`,
        subtipo: data.subtipo as Subtipo,
      });
    },
    onError: (e) => {
      setResultado({ ok: false, mensaje: e.message });
    },
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUbicacionError(true),
        { timeout: 8000 }
      );
    } else {
      setUbicacionError(true);
    }
  }, []);

  // ── Validaciones ─────────────────────────────────────────────────────────────
  function validarDatosApertura() {
    if (!fotoBase64) { toast.error("Toma la foto de la selladora"); return false; }
    if (!fotoUniforme) { toast.error("Toma la selfie con tu uniforme"); return false; }
    if (!contadorSelladora) { toast.error("Ingresa el contador de la selladora"); return false; }
    if (!vasosConteo) { toast.error("Ingresa el conteo de vasos"); return false; }
    if (!popotesConteo) { toast.error("Ingresa el conteo de popotes"); return false; }
    if (!selladuroOk && !motivoSelladora.trim()) { toast.error("Describe el problema de la selladora"); return false; }
    return true;
  }

  function validarDatosCierre() {
    if (!fotoBase64) { toast.error("Toma la foto de la selladora"); return false; }
    if (!contadorSelladora) { toast.error("Ingresa el contador final de la selladora"); return false; }
    if (!vasosConteo) { toast.error("Ingresa el conteo final de vasos"); return false; }
    if (!popotesConteo) { toast.error("Ingresa el conteo final de popotes"); return false; }

    if (ultimaApertura) {
      const diffSelladora = parseInt(contadorSelladora) - (ultimaApertura.contadorSelladora ?? 0);
      const diffVasos = (ultimaApertura.vasosConteo ?? 0) - parseInt(vasosConteo);
      const diffPopotes = (ultimaApertura.popotesConteo ?? 0) - parseInt(popotesConteo);

      if (diffSelladora < 0) {
        toast.error("El contador es menor al de apertura. Anota el motivo.");
        if (!motivoDiferencia.trim()) return false;
      }

      const hayDescuadreVasos = diffSelladora !== diffVasos;
      const hayDescuadrePopotes = diffSelladora !== diffPopotes;

      if ((hayDescuadreVasos || hayDescuadrePopotes) && !motivoDiferencia.trim()) {
        if (hayDescuadreVasos) toast.error(`Descuadre: ${Math.abs(diffVasos - diffSelladora)} vasos sin justificar`);
        else toast.error(`Descuadre: ${Math.abs(diffPopotes - diffSelladora)} popotes sin justificar`);
        return false;
      }
    }
    return true;
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!empleadoId) { toast.error("Selecciona tu nombre"); return; }

    // Verificar cara visible en selfie de uniforme (apertura)
    if (fotoUniforme && subtipo === "entrada_turno") {
      try {
        const r = await verificarCaraMut.mutateAsync({ imageUrl: fotoUniforme });
        if (!r.caraVisible) {
          toast.error("No se detectó una cara visible en la selfie. Vuelve a tomarla mostrando tu cara claramente.");
          return;
        }
      } catch {
        // fail-open: si el servicio falla, continuar
      }
    }

    // Armar motivo completo
    let motivoFinal = motivoDiferencia.trim();
    if (!selladuroOk && motivoSelladora.trim()) {
      motivoFinal = `Selladora: ${motivoSelladora.trim()}${motivoFinal ? ` | ${motivoFinal}` : ""}`;
    }

    registrarMut.mutate({
      qrToken: token,
      empleadoId: Number(empleadoId),
      tipo,
      subtipo,
      latitud: ubicacion?.lat,
      longitud: ubicacion?.lng,
      fotoBase64: fotoBase64 ?? undefined,
      fotoUniformeBase64: fotoUniforme ?? undefined,
      // fotoUniforme se guarda en notas como referencia hasta siguiente versión
      contadorSelladora: contadorSelladora ? parseInt(contadorSelladora) : undefined,
      vasosConteo: vasosConteo ? parseInt(vasosConteo) : undefined,
      popotesConteo: popotesConteo ? parseInt(popotesConteo) : undefined,
      selladuroOk: selladuroOk,
      motivoDiferencia: motivoFinal || undefined,
    });
  }

  // ── Calcular diferencias para mostrar en cierre ───────────────────────────────
  const diffSelladora = ultimaApertura && contadorSelladora
    ? parseInt(contadorSelladora) - (ultimaApertura.contadorSelladora ?? 0)
    : null;
  const diffVasos = ultimaApertura && vasosConteo
    ? (ultimaApertura.vasosConteo ?? 0) - parseInt(vasosConteo)
    : null;
  const diffPopotes = ultimaApertura && popotesConteo
    ? (ultimaApertura.popotesConteo ?? 0) - parseInt(popotesConteo)
    : null;
  const haydiscrepancia = diffSelladora !== null && diffVasos !== null &&
    (diffSelladora !== diffVasos || (diffPopotes !== null && diffSelladora !== diffPopotes));

  // ─── QR Inválido ─────────────────────────────────────────────────────────────
  if (!token || !sucursalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">QR inválido</h1>
          <p className="text-muted-foreground text-sm">Solicita un nuevo código QR al líder de tu tienda.</p>
        </div>
      </div>
    );
  }

  // ─── Pantalla de resultado ────────────────────────────────────────────────────
  if (resultado) {
    const esApertura = resultado.subtipo === "apertura_tienda";
    const esCierre = resultado.subtipo === "cierre_tienda";
    const esEntrada = resultado.subtipo === "entrada_turno";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm w-full">
          {resultado.ok ? (
            <>
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-green-600 mb-2">
                {esApertura ? "¡Tienda abierta!" : esCierre ? "¡Tienda cerrada!" : esEntrada ? "¡Buen turno!" : "¡Hasta pronto!"}
              </h1>
              <p className="text-muted-foreground text-sm">{resultado.mensaje}</p>
              <RelojActual />
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-destructive mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">No se pudo registrar</h1>
              <p className="text-muted-foreground text-sm">{resultado.mensaje}</p>
            </>
          )}
          <Button
            className="mt-6 w-full h-12"
            variant="outline"
            onClick={() => {
              setResultado(null);
              setEmpleadoId("");
              setFotoBase64(null);
              setFotoUniforme(null);
              setFotoEvidencia(null);
              setFotoUniforme(null);
              setFotoEvidencia(null);
              setContadorSelladora("");
              setVasosConteo("");
              setPopotesConteo("");
              setSelladuroOk(true);
              setMotivoSelladora("");
              setMotivoDiferencia("");
              setPaso("inicio");
            }}
          >
            Registrar otro empleado
          </Button>
        </div>
      </div>
    );
  }

  // ─── Layout base ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-violet-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold">Snowtea — Checador</h1>
          <RelojActual />
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-5 space-y-4">

          {/* PASO: inicio — seleccionar empleado */}
          {paso === "inicio" && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">¿Quién eres?</label>
                {loadingEmpleados ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                  </div>
                ) : (
                  <SelectorEmpleado empleados={empleados} value={empleadoId} onChange={setEmpleadoId} />
                )}
              </div>

              {/* GPS */}
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                ubicacion ? "bg-green-50 text-green-700" : ubicacionError ? "bg-yellow-50 text-yellow-700" : "bg-muted text-muted-foreground"
              }`}>
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {ubicacion ? "Ubicación detectada" : ubicacionError ? "Sin acceso a ubicación" : "Obteniendo ubicación..."}
              </div>

              <Button
                className="w-full h-12 text-base"
                disabled={!empleadoId}
                onClick={() => setPaso("tipo")}
              >
                Continuar
              </Button>
            </>
          )}

          {/* PASO: tipo — entrada o salida */}
          {paso === "tipo" && (
            <>
              <p className="text-sm font-medium text-center">¿Qué vas a registrar?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setTipo("entrada"); setPaso("subtipo"); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-green-500 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <LogIn className="w-8 h-8" />
                  <span className="text-sm font-semibold">Entrada</span>
                </button>
                <button
                  onClick={() => { setTipo("salida"); setPaso("subtipo"); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  <LogOut className="w-8 h-8" />
                  <span className="text-sm font-semibold">Salida</span>
                </button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("inicio")}>← Atrás</Button>
            </>
          )}

          {/* PASO: subtipo — apertura/turno */}
          {paso === "subtipo" && tipo === "entrada" && (
            <>
              <p className="text-sm font-medium text-center">¿Cómo es tu entrada?</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => { setSubtipo("apertura_tienda"); setPaso("datos_apertura"); }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-violet-500 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <Store className="w-7 h-7 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">Apertura de tienda</p>
                    <p className="text-xs opacity-75">Eres el primero en llegar hoy</p>
                  </div>
                </button>
                <button
                  onClick={() => { setSubtipo("entrada_turno"); setPaso("datos_uniforme"); }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <UserCheck className="w-7 h-7 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">Solo entrada de turno</p>
                    <p className="text-xs opacity-75">La tienda ya está abierta</p>
                  </div>
                </button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("tipo")}>← Atrás</Button>
            </>
          )}

          {paso === "subtipo" && tipo === "salida" && (
            <>
              <p className="text-sm font-medium text-center">¿Cómo es tu salida?</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => { setSubtipo("cierre_tienda"); setPaso("datos_cierre"); }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-red-500 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                >
                  <Store className="w-7 h-7 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">Cierre de tienda</p>
                    <p className="text-xs opacity-75">Eres el último en salir hoy</p>
                  </div>
                </button>
                <button
                  onClick={() => { setSubtipo("salida_turno"); handleSubmit(); }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  <LogOut className="w-7 h-7 shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">Solo salida de turno</p>
                    <p className="text-xs opacity-75">La tienda seguirá abierta</p>
                  </div>
                </button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("tipo")}>← Atrás</Button>
            </>
          )}

          {/* PASO: datos_uniforme — selfie con uniforme */}
          {paso === "datos_uniforme" && (
            <>
              <p className="text-sm font-medium text-center">Foto con uniforme</p>
              <p className="text-xs text-muted-foreground text-center">Tómate una selfie con tu uniforme puesto</p>
              <CapturaFoto
                label="Selfie con uniforme"
                capture="user"
                preview={fotoBase64}
                onCaptura={setFotoBase64}
                required
              />
              <Button
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                disabled={!fotoBase64 || registrarMut.isPending}
                onClick={() => {
                  if (!fotoBase64) { toast.error("Toma la foto con tu uniforme"); return; }
                  handleSubmit();
                }}
              >
                {registrarMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar entrada"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("subtipo")}>← Atrás</Button>
            </>
          )}

          {/* PASO: datos_apertura — foto selladora + conteos */}
          {paso === "datos_apertura" && (
            <>
              <p className="text-sm font-semibold text-center text-violet-700">Apertura de tienda</p>

              <CapturaFoto
                label="Foto de la selladora"
                capture="environment"
                preview={fotoBase64}
                onCaptura={setFotoBase64}
                required
              />

              <CampoNumero
                label="Contador de la selladora"
                value={contadorSelladora}
                onChange={setContadorSelladora}
                required
                placeholder="Número del COUNTER"
              />

              <div className="grid grid-cols-2 gap-3">
                <CampoNumero label="Vasos (inicio)" value={vasosConteo} onChange={setVasosConteo} required />
                <CampoNumero label="Popotes (inicio)" value={popotesConteo} onChange={setPopotesConteo} required />
              </div>

              {/* Selladora ok */}
              <div className="space-y-2">
                <label className="text-sm font-medium">¿Selladora funcionando correctamente?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelladuroOk(true)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      selladuroOk ? "border-green-500 bg-green-50 text-green-700" : "border-border text-muted-foreground"
                    }`}
                  >
                    ✅ Sí
                  </button>
                  <button
                    onClick={() => setSelladuroOk(false)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      !selladuroOk ? "border-red-500 bg-red-50 text-red-700" : "border-border text-muted-foreground"
                    }`}
                  >
                    ⚠️ No
                  </button>
                </div>
              </div>

              {!selladuroOk && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-red-600">Describe el problema <span className="text-destructive">*</span></label>
                  <textarea
                    value={motivoSelladora}
                    onChange={e => setMotivoSelladora(e.target.value)}
                    placeholder="Ej: La selladora no enciende, falla el sello..."
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={2}
                  />
                </div>
              )}

              <CapturaFoto
                label="Selfie con uniforme"
                capture="user"
                preview={fotoUniforme}
                onCaptura={setFotoUniforme}
                required
              />

              <Button
                className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700"
                disabled={registrarMut.isPending}
                onClick={() => {
                  if (!validarDatosApertura()) return;
                  handleSubmit();
                }}
              >
                {registrarMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar apertura"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("subtipo")}>← Atrás</Button>
            </>
          )}

          {/* PASO: datos_cierre — foto selladora + conteos finales */}
          {paso === "datos_cierre" && (
            <>
              <p className="text-sm font-semibold text-center text-red-700">Cierre de tienda</p>

              {ultimaApertura && (
                <div className="bg-muted rounded-xl p-3 text-xs space-y-1">
                  <p className="font-medium text-muted-foreground">Datos de apertura del día:</p>
                  <p>Contador selladora: <span className="font-bold">{ultimaApertura.contadorSelladora ?? "—"}</span></p>
                  <p>Vasos iniciales: <span className="font-bold">{ultimaApertura.vasosConteo ?? "—"}</span></p>
                  <p>Popotes iniciales: <span className="font-bold">{ultimaApertura.popotesConteo ?? "—"}</span></p>
                </div>
              )}

              <CapturaFoto
                label="Foto de la selladora (cierre)"
                capture="environment"
                preview={fotoBase64}
                onCaptura={setFotoBase64}
                required
              />

              <CampoNumero
                label="Contador final de la selladora"
                value={contadorSelladora}
                onChange={setContadorSelladora}
                required
                placeholder="Número del COUNTER"
              />

              <div className="grid grid-cols-2 gap-3">
                <CampoNumero label="Vasos (final)" value={vasosConteo} onChange={setVasosConteo} required />
                <CampoNumero label="Popotes (final)" value={popotesConteo} onChange={setPopotesConteo} required />
              </div>

              {/* Resumen de diferencias */}
              {ultimaApertura && contadorSelladora && vasosConteo && (
                <div className={`rounded-xl p-3 text-xs space-y-2 ${haydiscrepancia ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-semibold text-sm">Resumen del día:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Vasos usados</p>
                      <p className="font-bold text-lg">{diffVasos ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vasos sellados</p>
                      <p className="font-bold text-lg">{diffSelladora !== null && diffSelladora >= 0 ? diffSelladora : "—"}</p>
                    </div>
                  </div>
                  {haydiscrepancia && (
                    <div className="flex flex-col gap-1 text-red-700">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p className="font-medium">Hay descuadre. Explica el motivo:</p>
                      </div>
                      {diffSelladora !== diffVasos && (
                        <p className="text-xs ml-6">• Vasos: {Math.abs((diffVasos ?? 0) - (diffSelladora ?? 0))} unidad(es) de diferencia</p>
                      )}
                      {diffPopotes !== null && diffSelladora !== diffPopotes && (
                        <p className="text-xs ml-6">• Popotes: {Math.abs((diffPopotes ?? 0) - (diffSelladora ?? 0))} unidad(es) de diferencia</p>
                      )}
                    </div>
                  )}
                  {diffSelladora !== null && diffSelladora < 0 && (
                    <div className="flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>El contador es menor al de apertura. ¿Fue reseteado?</p>
                    </div>
                  )}
                </div>
              )}

              {/* Motivo diferencia */}
              {(haydiscrepancia || (diffSelladora !== null && diffSelladora < 0)) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-red-600">Motivo de la diferencia <span className="text-destructive">*</span></label>
                    <textarea
                      value={motivoDiferencia}
                      onChange={e => setMotivoDiferencia(e.target.value)}
                      placeholder="Ej: Se derramó un vaso, se reseteó el contador..."
                      className="w-full rounded-xl border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={2}
                    />
                  </div>
                  <CapturaFoto
                    label="Foto de evidencia del descuadre"
                    capture="environment"
                    preview={fotoEvidencia}
                    onCaptura={setFotoEvidencia}
                  />
                </div>
              )}

              <Button
                className="w-full h-12 text-base bg-red-600 hover:bg-red-700"
                disabled={registrarMut.isPending}
                onClick={() => {
                  if (!validarDatosCierre()) return;
                  handleSubmit();
                }}
              >
                {registrarMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar cierre"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPaso("subtipo")}>← Atrás</Button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
