/**
 * ModalBienvenidaTurno
 * Flujo paso a paso al registrar entrada al turno:
 * 1. Bienvenida: nombre, turno, actividades del día, avisos
 * 2. Foto uniforme
 * 3. Foto selladora + OCR
 * 4. Inventario de apertura (solo si es el primero en llegar o turno vespertino)
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, CheckCircle2, AlertTriangle, Info, Bell,
  ChevronRight, Loader2, Package, Droplets, Coffee, Leaf
} from "lucide-react";

interface Props {
  sucursalId: number;
  empleadoId: number;
  fecha: string;
  tipoTurno: "matutino" | "vespertino";
  nombreEmpleado: string;
  sucursalNombre: string;
  actividades: Array<{ id: number; nombre: string; descripcion?: string; categoria?: string }>;
  esApertura: boolean; // true si es el primero en llegar
  onComplete: () => void;
  onCancel: () => void;
}

type Paso = "bienvenida" | "uniforme" | "selladora" | "inventario" | "listo";

export default function ModalBienvenidaTurno({
  sucursalId, empleadoId, fecha, tipoTurno,
  nombreEmpleado, sucursalNombre, actividades,
  esApertura, onComplete, onCancel,
}: Props) {
  const [paso, setPaso] = useState<Paso>("bienvenida");
  const [fotoUniformeUrl, setFotoUniformeUrl] = useState<string | null>(null);
  const [fotoSelladoUrl, setFotoSelladoUrl] = useState<string | null>(null);
  const [contadorDetectado, setContadorDetectado] = useState<number | null>(null);
  const [contadorManual, setContadorManual] = useState<string>("");
  const [inventario, setInventario] = useState({
    conteoVasos: "",
    conteoPopotes: "",
    baseSnowteaKg: "",
    longanKg: "",
  });
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [detectandoOCR, setDetectandoOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avisos activos
  const { data: avisos = [] } = trpc.avisos.getActivos.useQuery({ sucursalId, fecha });

  // Mutations
  const subirFoto = trpc.turno.subirFoto.useMutation();
  const detectarContador = trpc.turno.detectarContadorSelladora.useMutation();
  const registrarApertura = trpc.turno.registrarApertura.useMutation({
    onSuccess: () => { setPaso("listo"); },
    onError: (e) => alert("Error al registrar apertura: " + e.message),
  });

  async function capturarFoto(tipo: "selladora" | "uniforme") {
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
            tipo: tipo === "selladora" ? "selladora" : "uniforme",
            sucursalId,
          });
          if (tipo === "uniforme") {
            setFotoUniformeUrl(url);
          } else {
            setFotoSelladoUrl(url);
            // Intentar OCR automático
            setDetectandoOCR(true);
            try {
              const res = await detectarContador.mutateAsync({ imageUrl: url });
              if (res.numero !== null) setContadorDetectado(res.numero);
            } catch {
              // OCR falló, el usuario ingresará manualmente
            } finally {
              setDetectandoOCR(false);
            }
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

  function guardarYContinuar() {
    const contadorFinal = contadorDetectado ?? (contadorManual ? parseInt(contadorManual) : undefined);
    registrarApertura.mutate({
      sucursalId, empleadoId, fecha, tipoTurno,
      fotoUniformeUrl: fotoUniformeUrl ?? undefined,
      fotoSelladoUrl: fotoSelladoUrl ?? undefined,
      contadorSelladora: contadorFinal,
      conteoVasos: inventario.conteoVasos ? parseInt(inventario.conteoVasos) : undefined,
      conteoPopotes: inventario.conteoPopotes ? parseInt(inventario.conteoPopotes) : undefined,
      baseSnowteaKg: inventario.baseSnowteaKg ? parseFloat(inventario.baseSnowteaKg) : undefined,
      longanKg: inventario.longanKg ? parseFloat(inventario.longanKg) : undefined,
    });
  }

  const tipoLabel = tipoTurno === "matutino" ? "Matutino" : "Vespertino";
  const tipoEmoji = tipoTurno === "matutino" ? "🌅" : "🌆";

  // ─── Paso 1: Bienvenida ────────────────────────────────────────────────────
  if (paso === "bienvenida") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">{tipoEmoji}</div>
            <h2 className="text-2xl font-bold text-white">¡Bienvenido, {nombreEmpleado.split(" ")[0]}!</h2>
            <p className="text-slate-400 text-sm mt-1">{sucursalNombre} · Turno {tipoLabel}</p>
          </div>

          {/* Avisos del dueño */}
          {avisos.length > 0 && (
            <div className="mb-5 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Avisos
              </p>
              {avisos.map((aviso: any) => (
                <div
                  key={aviso.id}
                  className={`rounded-xl p-3.5 border ${
                    aviso.tipo === "urgente"
                      ? "bg-red-500/15 border-red-500/30"
                      : aviso.tipo === "recordatorio"
                      ? "bg-amber-500/15 border-amber-500/30"
                      : "bg-blue-500/15 border-blue-500/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {aviso.tipo === "urgente" ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <p className={`text-sm font-semibold ${
                      aviso.tipo === "urgente" ? "text-red-300" :
                      aviso.tipo === "recordatorio" ? "text-amber-300" : "text-blue-300"
                    }`}>{aviso.titulo}</p>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{aviso.contenido}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actividades del turno */}
          {actividades.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Tus actividades de hoy ({actividades.length})
              </p>
              <div className="space-y-1.5">
                {actividades.slice(0, 8).map((act) => (
                  <div key={act.id} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      act.categoria === "D" ? "bg-blue-400" :
                      act.categoria === "S" ? "bg-purple-400" :
                      act.categoria === "B" ? "bg-amber-400" : "bg-rose-400"
                    }`} />
                    <p className="text-sm text-slate-200 flex-1 truncate">{act.nombre}</p>
                    <span className="text-[10px] text-slate-500">{act.categoria}</span>
                  </div>
                ))}
                {actividades.length > 8 && (
                  <p className="text-xs text-slate-500 text-center">+{actividades.length - 8} más</p>
                )}
              </div>
            </div>
          )}

          {actividades.length === 0 && (
            <div className="mb-5 bg-white/5 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-sm">No tienes actividades asignadas para este turno.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("uniforme")}
          >
            Registrar entrada <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 2: Foto uniforme ─────────────────────────────────────────────────
  if (paso === "uniforme") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">👕</div>
            <h2 className="text-xl font-bold text-white">Foto con uniforme</h2>
            <p className="text-slate-400 text-sm mt-1">Tómate una foto con tu uniforme puesto</p>
          </div>

          {fotoUniformeUrl ? (
            <div className="space-y-3">
              <img
                src={fotoUniformeUrl}
                alt="Foto uniforme"
                className="w-full max-h-64 object-cover rounded-2xl border border-white/10"
              />
              <button
                onClick={() => capturarFoto("uniforme")}
                disabled={cargandoFoto}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline text-center"
              >
                Tomar otra foto
              </button>
            </div>
          ) : (
            <button
              onClick={() => capturarFoto("uniforme")}
              disabled={cargandoFoto}
              className="w-full aspect-video bg-white/5 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-colors"
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
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso("selladora")}
            disabled={cargandoFoto}
          >
            {fotoUniformeUrl ? "Continuar" : "Continuar sin foto"} <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("bienvenida")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 3: Foto selladora ────────────────────────────────────────────────
  if (paso === "selladora") {
    const contadorFinal = contadorDetectado ?? (contadorManual ? parseInt(contadorManual) : null);
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🖨️</div>
            <h2 className="text-xl font-bold text-white">Contador de selladora</h2>
            <p className="text-slate-400 text-sm mt-1">Toma una foto del contador al inicio del turno</p>
          </div>

          {fotoSelladoUrl ? (
            <div className="space-y-3 mb-4">
              <img
                src={fotoSelladoUrl}
                alt="Foto selladora"
                className="w-full max-h-52 object-cover rounded-2xl border border-white/10"
              />
              <button
                onClick={() => { setFotoSelladoUrl(null); setContadorDetectado(null); }}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline text-center"
              >
                Tomar otra foto
              </button>
            </div>
          ) : (
            <button
              onClick={() => capturarFoto("selladora")}
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

          {/* OCR resultado */}
          {detectandoOCR && (
            <div className="flex items-center gap-2 bg-blue-500/15 border border-blue-500/30 rounded-xl px-4 py-3 mb-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <p className="text-sm text-blue-300">Detectando número automáticamente...</p>
            </div>
          )}

          {contadorDetectado !== null && !detectandoOCR && (
            <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div>
                <p className="text-sm text-green-300 font-semibold">Número detectado: {contadorDetectado}</p>
                <p className="text-xs text-slate-400">Verifica que sea correcto</p>
              </div>
            </div>
          )}

          {/* Ingreso manual */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-xs text-slate-400 block mb-2">
              {contadorDetectado !== null ? "Corregir número si es necesario" : "Ingresar número del contador"}
            </label>
            <input
              type="number"
              value={contadorManual || (contadorDetectado !== null ? String(contadorDetectado) : "")}
              onChange={(e) => { setContadorManual(e.target.value); setContadorDetectado(null); }}
              placeholder="Ej: 12450"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-lg font-mono text-center focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
            onClick={() => setPaso(esApertura ? "inventario" : "listo")}
            disabled={cargandoFoto || detectandoOCR}
          >
            {esApertura ? "Continuar al inventario" : "Finalizar registro"} <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("uniforme")}>
            Atrás
          </Button>
        </div>
      </div>
    );
  }

  // ─── Paso 4: Inventario de apertura ───────────────────────────────────────
  if (paso === "inventario") {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">📦</div>
            <h2 className="text-xl font-bold text-white">Inventario de apertura</h2>
            <p className="text-slate-400 text-sm mt-1">Conteo inicial del turno {tipoLabel}</p>
          </div>

          <div className="space-y-4">
            {[
              { key: "conteoVasos", label: "Vasos disponibles", icon: Package, placeholder: "Ej: 500", unit: "pzas" },
              { key: "conteoPopotes", label: "Popotes disponibles", icon: Droplets, placeholder: "Ej: 300", unit: "pzas" },
              { key: "baseSnowteaKg", label: "Base Snowtea en refrigerador", icon: Coffee, placeholder: "Ej: 2.5", unit: "kg", decimal: true },
              { key: "longanKg", label: "Longan disponible", icon: Leaf, placeholder: "Ej: 1.2", unit: "kg", decimal: true },
            ].map(({ key, label, icon: Icon, placeholder, unit, decimal }) => (
              <div key={key} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-teal-400" />
                  <label className="text-sm text-slate-300 font-medium">{label}</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={decimal ? "0.1" : "1"}
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
            onClick={guardarYContinuar}
            disabled={registrarApertura.isPending}
          >
            {registrarApertura.isPending ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <>Guardar y entrar al turno <ChevronRight className="w-5 h-5 ml-1" /></>
            )}
          </Button>
          <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => setPaso("selladora")}>
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
        <h2 className="text-2xl font-bold text-white mb-2">¡Turno registrado!</h2>
        <p className="text-slate-400 text-sm mb-8">
          Tu entrada al turno {tipoLabel} ha sido registrada correctamente.
        </p>
        <Button
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
          onClick={onComplete}
        >
          Ir a mis actividades
        </Button>
      </div>
    </div>
  );
}
