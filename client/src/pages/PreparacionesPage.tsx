/**
 * Página dedicada de Preparaciones
 * Accesible desde el menú lateral para Anfitrión (host) y roles superiores.
 * Muestra el registro de preparaciones del turno actual + historial de la sucursal.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";
import Preparaciones from "@/components/Preparaciones";

function fechaLocalHoy() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PreparacionesPage() {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";
  const isHost = role === "host";

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  // Auto-seleccionar sucursal cuando el usuario solo tiene una asignada (lider 1 tienda)
  useMemo(() => {
    if (sucursales.length === 1 && sucursalId === null) {
      setSucursalId(sucursales[0].id);
    }
  }, [sucursales.length]);

  // Para el host: usar la primera sucursal disponible automáticamente
  const sucursalEfectiva = useMemo(() => {
    if (sucursalId) return sucursalId;
    if (sucursales.length > 0) return (sucursales[0] as any).id as number;
    return null;
  }, [sucursalId, sucursales]);

  const hoy = fechaLocalHoy();

  // Obtener empleados de la sucursal para identificar al empleado actual
  const { data: empleados = [] } = trpc.empleados.list.useQuery(
    { sucursalId: sucursalEfectiva ?? 0 },
    { enabled: !!sucursalEfectiva }
  );

  const empleadoActual = useMemo(() => {
    if (!user) return null;
    return (empleados as any[]).find((e: any) =>
      e.email === (user as any).email ||
      e.nombre?.toLowerCase() === (user as any).name?.toLowerCase()
    ) ?? null;
  }, [empleados, user]);

  // Obtener turno del día usando miTurnoHoy
  const { data: miTurnoData } = trpc.horarios.miTurnoHoy.useQuery(
    {
      sucursalId: sucursalEfectiva ?? 0,
      empleadoId: empleadoActual?.id ?? 0,
      fecha: hoy,
    },
    { enabled: !!sucursalEfectiva && !!empleadoActual?.id }
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Preparaciones</h1>
            <p className="text-sm text-muted-foreground">
              Registro de recetas · PEPS · Alertas de vencimiento
            </p>
          </div>
        </div>

        {/* Selector de sucursal solo para roles superiores al host */}
        {!isHost && sucursales.length > 1 && (
          <Select
            value={sucursalId ? String(sucursalId) : ""}
            onValueChange={(v) => setSucursalId(Number(v))}
          >
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Selecciona tienda" />
            </SelectTrigger>
            <SelectContent position="item-aligned">
              {(sucursales as any[]).map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Para el host: mostrar la sucursal asignada */}
        {isHost && sucursales.length > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            {(sucursales[0] as any)?.nombre ?? "Mi tienda"}
          </Badge>
        )}
      </div>

      {/* Contenido principal */}
      {!sucursalEfectiva ? (
        <div className="text-center py-16 text-muted-foreground">
          <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Selecciona una tienda para ver las preparaciones</p>
        </div>
      ) : (
        <Preparaciones
          sucursalId={sucursalEfectiva}
          turnoId={(miTurnoData as any)?.turno?.id}
          empleadoId={empleadoActual?.id}
          modo={isHost ? "turno" : "historial"}
        />
      )}
    </div>
  );
}
