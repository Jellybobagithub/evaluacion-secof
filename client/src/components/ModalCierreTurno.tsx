/**
 * ModalCierreTurno
 * Flujo de cierre de turno:
 * 1. Confirmación de cierre
 * 2. Foto selladora al cierre + OCR
 * 3. Conteo final de inventario
 * 4. Cuadre de vasos (selladora vs reporte)
 * 5. Novedades para el siguiente turno
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Camera, CheckCircle2, AlertTriangle, ChevronRight,
  Loader2, Package, Droplets, MessageSquare, Scale
} from "lucide-react";

interface Props {
  sucursalId: number;
  empleadoId: number;
  fecha: string;
  tipoTurno: "matutino" | "vespertino";
  contadorApertura?: number | null;   // contador al inicio del turno
  vasosVendidosReporte?: number | null; // del reporte diario
  onComplete: () => void;
  onCancel: () => void;
}

type Paso = "confirmar" | "selladora" | "inventario" | "cuadre" | "novedades" | "listo";

export default function ModalCierreTurno({
  sucursalId, empleadoId, fecha, tipoTurno,
  contadorApertura, vasosVendidosReporte,
  onComplete, onCancel,
}: Props) {
  const [paso, setPaso] = useState<Paso>("confirmar");
  const [fotoSelladoCierreUrl, setFotoSelladoCierreUrl] = useState<string | null>(null);
  const [contadorDetectado, setContadorDetectado] = useState<number | null>(null);
  const [contadorManual, setContadorManual] = useState<string>("");
  const [inventario, setInventario] = useState({ conteoVasosFinal: "", conteoPopotesFinal: "" });
  const [novedades, setNovedades] = useState("");
  const [incidencias, setIncidencias] = useState("");
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [detectandoOCR, setDetectandoOCR] = useState(false);

  const subirFoto = trpc.turno.subirFoto.useMutation();
  const detectarContador = trpc.turno.detectarContadorSelladora.useMutation();
  const registrarCierre = trpc.turno.registrarCierre.useMutation({
    onSuccess: () => setPaso("listo"),
    onError: (e) => alert("Error al registrar cierre: " + e.message),
  });

  const contadorCierre = contadorDetectado ?? (contadorManual ? parseInt(contadorManual) : null);
  const vasosVendidosSelladora = contadorCierre !== null && contadorApertura !== null && contadorApertura !== undefined
    ? contadorCierre - contadorApertura
    : null;
  const mermaVasos = vasosVendidosSelladora !== null && vasosVendidosReporte !== null && vasosVendidosReporte !== undefined
    ? vasosVendidosReporte - vasosVendidosSelladora
    : null;

  async function capturarFotoSelladora() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { alert("La foto no puede superar 8 MB"); return; }
      setCargandoFoto(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        try {
          const { url } = await subirFoto.mutateAsync({
            base64, mimeType: file.type,
            tipo: "selladora_cierre",
            sucursalId,
          });
          setFotoSelladoCierreUrl(url);
          setDetectandoOCR(true);
          try {
            const res = await detectarContador.mutateAsync({ imageUrl: url });
            if (res.numero !== null) setContadorDetectado(res.numero);
          } catch {
            // OCR falló, usuario ingresará manualmente
          } finally {
            setDetectandoOCR(false);
          }
        } catch (e: any) {
          alert("Error al subir foto: " + e.message);
        } finally {
          setCargandoFoto(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function guardarCierre() {
    registrarCierre.mutate({
      sucursalId, empleadoId, fecha, tipoTurno,
      fotoSelladoCierreUrl: fotoSelladoCierreUrl ?? undefined,
      contadorSelladoraCierre: contadorCierre ?? undefined,
      conteoVasosFinal: inventario.conteoVasosFinal ? parseInt(inventario.conteoVasosFinal) : undefined,
      conteoPopotesFinal: inventario.conteoPopotesFinal ? parseInt(inventario.conteoPopotesFinal) : undefined,
      vasosVendidosSelladora: vasosVendidosSelladora ?? undefined,
      vasosVendidosReporte: vasosVendidosReporte ?? undefined,
      mermaVasos: mermaVasos ?? undefined,
      novedadesTurno: novedades || undefined,
      incidencias: incidencias || undefined,
    });
  }

  const tipoLabel = tipoTurno === "matutino" ? "Matutino" : "Vespertino";

  // ─── Paso 1: Confirmar cierre ──────────────────────────────────────────────
  if (paso === "confirmar") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center px-5">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🌙</div>
          <h2 className="text-2xl font-bold text-white mb-2">¿Cerrar turno {tipoLabel}?</h2>
          <p className="text-slate-400 text-sm">
            Se registrará el inventario final y las novedades para el siguiente turno.
          </p>
        </div>
        <div className="w-full space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("selladora")}
          >
            Sí, cerrar turno <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 2: Foto selladora al cierre ─────────────────────────────────────
  if (paso === "selladora") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🖨️</div>
            <h2 className="text-xl font-bold text-white">Contador al cierre</h2>
            <p className="text-slate-400 text-sm mt-1">
              Toma foto del contador de la selladora al cerrar
              {contadorApertura != null && (
                <span className="block text-teal-400 mt-1">Apertura: {contadorApertura}</span>
              )}
            </p>
          </div>

          {fotoSelladoCierreUrl ? (
            <div className="space-y-3 mb-4">
              <img
                src={fotoSelladoCierreUrl}
                alt="Foto selladora cierre"
                className="w-full max-h-52 object-cover rounded-2xl border border-white/10"
              />
              <button
                onClick={() => { setFotoSelladoCierreUrl(null); setContadorDetectado(null); }}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline text-center"
              >
                Tomar otra foto
              </button>
            </div>
          ) : (
            <button
              onClick={capturarFotoSelladora}
              disabled={cargandoFoto}
              className="w-full aspect-video bg-white/5 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-colors mb-4"
            >
              {cargandoFoto ? (
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              ) : (
                <>
                  <Camera className="w-10 h-10 text-slate-400" />
                  <p className="text-slate-400 text-sm">Toca para tomar foto</p>
                </>
              )}
            </button>
          )}

          {detectandoOCR && (
            <div className="flex items-center gap-2 bg-blue-500/15 border border-blue-500/30 rounded-xl px-4 py-3 mb-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <p className="text-sm text-blue-300">Detectando número...</p>
            </div>
          )}

          {contadorDetectado !== null && !detectandoOCR && (
            <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div>
                <p className="text-sm text-green-300 font-semibold">Número detectado: {contadorDetectado}</p>
                {contadorApertura != null && (
                  <p className="text-xs text-teal-300">
                    Vasos sellados este turno: {contadorDetectado - contadorApertura}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-xs text-slate-400 block mb-2">
              {contadorDetectado !== null ? "Corregir si es necesario" : "Ingresar número del contador"}
            </label>
            <input
              type="number"
              value={contadorManual || (contadorDetectado !== null ? String(contadorDetectado) : "")}
              onChange={(e) => { setContadorManual(e.target.value); setContadorDetectado(null); }}
              placeholder="Ej: 12850"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-lg font-mono text-center focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("inventario")}
            disabled={cargandoFoto || detectandoOCR}
          >
            Continuar <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("confirmar")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 3: Inventario final ──────────────────────────────────────────────
  if (paso === "inventario") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📦</div>
            <h2 className="text-xl font-bold text-white">Inventario final</h2>
            <p className="text-slate-400 text-sm mt-1">Conteo al cierre del turno</p>
          </div>

          <div className="space-y-4">
            {[
              { key: "conteoVasosFinal", label: "Vasos restantes", icon: Package, placeholder: "Ej: 320", unit: "pzas" },
              { key: "conteoPopotesFinal", label: "Popotes restantes", icon: Droplets, placeholder: "Ej: 180", unit: "pzas" },
            ].map(({ key, label, icon: Icon, placeholder, unit }) => (
              <div key={key} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-teal-400" />
                  <label className="text-sm text-slate-300 font-medium">{label}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inventario[key as keyof typeof inventario]}
                    onChange={(e) => setInventario(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-base font-mono focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-slate-400 text-sm w-10 text-right">{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("cuadre")}
          >
            Continuar al cuadre <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("selladora")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 4: Cuadre de vasos ───────────────────────────────────────────────
  if (paso === "cuadre") {
    const hayCuadre = vasosVendidosSelladora !== null;
    const hayDescuadre = mermaVasos !== null && mermaVasos !== 0;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">⚖️</div>
            <h2 className="text-xl font-bold text-white">Cuadre de vasos</h2>
            <p className="text-slate-400 text-sm mt-1">Comparación selladora vs ventas reportadas</p>
          </div>

          {hayCuadre ? (
            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Vasos sellados</p>
                  <p className="text-2xl font-bold text-teal-300">{vasosVendidosSelladora}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Según selladora</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Vasos vendidos</p>
                  <p className="text-2xl font-bold text-blue-300">{vasosVendidosReporte ?? "—"}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Según reporte</p>
                </div>
              </div>

              {mermaVasos !== null && (
                <div className={`rounded-xl p-4 border ${
                  mermaVasos === 0
                    ? "bg-green-500/15 border-green-500/30"
                    : Math.abs(mermaVasos) <= 3
                    ? "bg-amber-500/15 border-amber-500/30"
                    : "bg-red-500/15 border-red-500/30"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {mermaVasos === 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                    <p className={`font-semibold ${
                      mermaVasos === 0 ? "text-green-300" :
                      Math.abs(mermaVasos) <= 3 ? "text-amber-300" : "text-red-300"
                    }`}>
                      {mermaVasos === 0
                        ? "¡Cuadre perfecto!"
                        : mermaVasos > 0
                        ? `Faltante: ${mermaVasos} vasos`
                        : `Sobrante: ${Math.abs(mermaVasos)} vasos`}
                    </p>
                  </div>
                  {mermaVasos !== 0 && (
                    <p className="text-xs text-slate-400">
                      {Math.abs(mermaVasos) > 3
                        ? "Descuadre significativo — se reportará al dueño"
                        : "Descuadre menor — dentro del rango aceptable"}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 rounded-xl p-4 text-center mb-6">
              <Scale className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                No hay datos suficientes para calcular el cuadre.
                <br />
                <span className="text-xs text-slate-500 mt-1 block">
                  Se necesita el contador de apertura y el reporte de ventas.
                </span>
              </p>
            </div>
          )}

          {/* Incidencias */}
          {hayDescuadre && (
            <div className="bg-white/5 rounded-xl p-4 mb-4">
              <label className="text-sm text-slate-300 font-medium block mb-2">
                <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-400" />
                Explica el descuadre (requerido)
              </label>
              <textarea
                value={incidencias}
                onChange={(e) => setIncidencias(e.target.value)}
                placeholder="Ej: Se rompió un vaso, se hicieron pruebas de selladora..."
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          )}
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("novedades")}
            disabled={hayDescuadre && !incidencias.trim()}
          >
            Continuar <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("inventario")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 5: Novedades del turno ───────────────────────────────────────────
  if (paso === "novedades") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📝</div>
            <h2 className="text-xl font-bold text-white">Novedades del turno</h2>
            <p className="text-slate-400 text-sm mt-1">
              Deja un mensaje para el siguiente turno
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-teal-400" />
              <label className="text-sm text-slate-300 font-medium">Novedades para el siguiente turno</label>
            </div>
            <textarea
              value={novedades}
              onChange={(e) => setNovedades(e.target.value)}
              placeholder="Ej: El refrigerador no está enfriando bien, falta reponer jarabe de fresa, el cliente de la mesa 3 dejó un objeto olvidado..."
              rows={5}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Opcional — pero muy útil para el equipo que sigue
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-300 leading-relaxed">
              💡 Reporta cualquier situación que el siguiente turno deba saber: equipos con fallas, 
              insumos por agotarse, situaciones con clientes, o cualquier incidencia del turno.
            </p>
          </div>
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={guardarCierre}
            disabled={registrarCierre.isPending}
          >
            {registrarCierre.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <>Cerrar turno definitivamente</>
            )}
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("cuadre")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso final: Listo ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center px-5">
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">¡Turno cerrado!</h2>
        <p className="text-slate-400 text-sm mb-8">
          El cierre del turno {tipoLabel} ha sido registrado correctamente.
          {mermaVasos !== null && mermaVasos !== 0 && (
            <span className="block mt-2 text-amber-400">
              Se notificó el descuadre de {Math.abs(mermaVasos)} vasos al dueño.
            </span>
          )}
        </p>
        <Button
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
          onClick={onComplete}
        >
          Listo
        </Button>
      </div>
    </div>
  );
}
