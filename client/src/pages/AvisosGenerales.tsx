/**
 * AvisosGenerales
 * Página de configuración para que el dueño/manager gestione avisos generales
 * que aparecen en la pantalla de bienvenida al turno de todos los empleados.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Bell, Plus, Trash2, Edit3, CheckCircle2, AlertTriangle,
  Info, ChevronLeft, Loader2, X
} from "lucide-react";

type TipoAviso = "info" | "urgente" | "recordatorio";

interface FormAviso {
  titulo: string;
  contenido: string;
  tipo: TipoAviso;
  fechaExpiracion: string;
  sucursalId: string;
}

const TIPO_CONFIG = {
  info: { label: "Informativo", icon: Info, cls: "bg-blue-500/15 border-blue-500/30 text-blue-300" },
  urgente: { label: "Urgente", icon: AlertTriangle, cls: "bg-red-500/15 border-red-500/30 text-red-300" },
  recordatorio: { label: "Recordatorio", icon: Bell, cls: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
};

const FORM_INICIAL: FormAviso = {
  titulo: "",
  contenido: "",
  tipo: "info",
  fechaExpiracion: "",
  sucursalId: "",
};

export default function AvisosGenerales() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormAviso>(FORM_INICIAL);

  const utils = trpc.useUtils();

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: avisos = [], isLoading } = trpc.avisos.getAll.useQuery({});

  const createAviso = trpc.avisos.create.useMutation({
    onSuccess: () => { utils.avisos.getAll.invalidate(); setMostrarForm(false); setForm(FORM_INICIAL); },
    onError: (e) => alert("Error: " + e.message),
  });

  const updateAviso = trpc.avisos.update.useMutation({
    onSuccess: () => { utils.avisos.getAll.invalidate(); setMostrarForm(false); setEditandoId(null); setForm(FORM_INICIAL); },
    onError: (e) => alert("Error: " + e.message),
  });

  const deleteAviso = trpc.avisos.delete.useMutation({
    onSuccess: () => utils.avisos.getAll.invalidate(),
    onError: (e) => alert("Error: " + e.message),
  });

  const toggleActivo = (aviso: any) => {
    updateAviso.mutate({ id: aviso.id, activo: !aviso.activo });
  };

  function abrirEditar(aviso: any) {
    setForm({
      titulo: aviso.titulo,
      contenido: aviso.contenido,
      tipo: aviso.tipo,
      fechaExpiracion: aviso.fechaExpiracion ?? "",
      sucursalId: aviso.sucursalId ? String(aviso.sucursalId) : "",
    });
    setEditandoId(aviso.id);
    setMostrarForm(true);
  }

  function handleSubmit() {
    if (!form.titulo.trim() || !form.contenido.trim()) {
      alert("El título y el contenido son requeridos");
      return;
    }
    const payload = {
      titulo: form.titulo,
      contenido: form.contenido,
      tipo: form.tipo,
      fechaExpiracion: form.fechaExpiracion || undefined,
      sucursalId: form.sucursalId ? parseInt(form.sucursalId) : undefined,
    };
    if (editandoId) {
      updateAviso.mutate({ id: editandoId, ...payload });
    } else {
      createAviso.mutate(payload);
    }
  }

  const isPending = createAviso.isPending || updateAviso.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/mi-turno")} className="text-slate-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Avisos Generales</h1>
            <p className="text-slate-400 text-xs mt-0.5">Mensajes para el equipo al iniciar turno</p>
          </div>
        </div>

        <Button
          className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11"
          onClick={() => { setForm(FORM_INICIAL); setEditandoId(null); setMostrarForm(true); }}
        >
          <Plus className="w-4 h-4 mr-2" /> Nuevo aviso
        </Button>
      </div>

      {/* Lista de avisos */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : avisos.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No hay avisos creados</p>
            <p className="text-slate-500 text-xs mt-1">Crea un aviso para que aparezca al iniciar turno</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(avisos as any[]).map((aviso) => {
              const cfg = TIPO_CONFIG[aviso.tipo as TipoAviso] ?? TIPO_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={aviso.id}
                  className={`rounded-xl border p-4 transition-opacity ${aviso.activo ? "" : "opacity-50"} ${cfg.cls}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <p className="font-semibold text-sm">{aviso.titulo}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`text-[10px] px-1.5 py-0 ${aviso.activo ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>
                        {aviso.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{aviso.contenido}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      {aviso.sucursalId ? (
                        <span>📍 {(sucursales as any[]).find(s => s.id === aviso.sucursalId)?.nombre ?? "Sucursal"}</span>
                      ) : (
                        <span>🌐 Todas las sucursales</span>
                      )}
                      {aviso.fechaExpiracion && (
                        <span>⏰ Expira: {new Date(aviso.fechaExpiracion).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActivo(aviso)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title={aviso.activo ? "Desactivar" : "Activar"}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${aviso.activo ? "text-green-400" : ""}`} />
                      </button>
                      <button
                        onClick={() => abrirEditar(aviso)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar este aviso?")) deleteAviso.mutate({ id: aviso.id });
                        }}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editandoId ? "Editar aviso" : "Nuevo aviso"}
              </h2>
              <button onClick={() => { setMostrarForm(false); setEditandoId(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Tipo de aviso</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(TIPO_CONFIG) as [TipoAviso, typeof TIPO_CONFIG.info][]).map(([tipo, cfg]) => (
                    <button
                      key={tipo}
                      onClick={() => setForm(f => ({ ...f, tipo }))}
                      className={`rounded-xl p-3 text-center border transition-all ${
                        form.tipo === tipo ? cfg.cls : "bg-white/5 border-white/10 text-slate-400"
                      }`}
                    >
                      <cfg.icon className="w-4 h-4 mx-auto mb-1" />
                      <p className="text-xs font-medium">{cfg.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Revisión de refrigerador"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Contenido */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Mensaje</label>
                <textarea
                  value={form.contenido}
                  onChange={(e) => setForm(f => ({ ...f, contenido: e.target.value }))}
                  placeholder="Escribe el mensaje que verán los empleados al iniciar turno..."
                  rows={4}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Sucursal */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Sucursal (opcional)</label>
                <select
                  value={form.sucursalId}
                  onChange={(e) => setForm(f => ({ ...f, sucursalId: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="">Todas las sucursales</option>
                  {(sucursales as any[]).map(s => (
                    <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fecha de expiración */}
              <div>
                <label className="text-xs text-slate-400 block mb-2">Fecha de expiración (opcional)</label>
                <input
                  type="date"
                  value={form.fechaExpiracion}
                  onChange={(e) => setForm(f => ({ ...f, fechaExpiracion: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                />
                <p className="text-xs text-slate-500 mt-1">Si no se especifica, el aviso no expira automáticamente</p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-8 pt-4 border-t border-white/10 space-y-2">
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base font-semibold"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Guardando...</>
              ) : (
                editandoId ? "Guardar cambios" : "Crear aviso"
              )}
            </Button>
            <Button variant="ghost" className="w-full text-slate-400 hover:text-white" onClick={() => { setMostrarForm(false); setEditandoId(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
