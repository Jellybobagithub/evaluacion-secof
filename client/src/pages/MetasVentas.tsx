import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Target, Pencil, Check, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function MetasVentas() {
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const { data: sucursales = [], refetch } = trpc.sucursales.list.useQuery();
  const { data: avanceMeta = [] } = trpc.reportesDiarios.avanceMeta.useQuery();

  const updateMutation = trpc.sucursales.update.useMutation({
    onSuccess: () => {
      toast.success("Meta actualizada correctamente");
      refetch();
      setEditId(null);
      setEditValue("");
    },
    onError: () => toast.error("Error al actualizar la meta"),
  });

  function startEdit(s: { id: number; metaVentasMensual?: number | null }) {
    setEditId(s.id);
    setEditValue(s.metaVentasMensual ? String(s.metaVentasMensual) : "");
  }

  function cancelEdit() {
    setEditId(null);
    setEditValue("");
  }

  function saveEdit(id: number) {
    const meta = parseFloat(editValue);
    if (isNaN(meta) || meta < 0) {
      toast.error("Ingresa un valor válido mayor o igual a 0");
      return;
    }
    updateMutation.mutate({ id, metaVentasMensual: meta });
  }

  const activasSucursales = sucursales.filter(s => s.activa);

  // Calcular totales
  const totalMeta = activasSucursales.reduce((sum, s) => sum + (s.metaVentasMensual ?? 0), 0);
  const avanceMap = new Map(avanceMeta.map((a: any) => [a.sucursalId, a]));
  const totalVentasMes = (avanceMeta as any[]).reduce((sum: number, a: any) => sum + (a.ventasMes ?? 0), 0);
  const porcentajeGlobal = totalMeta > 0 ? Math.min(100, (totalVentasMes / totalMeta) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Metas de Ventas</h1>
        <p className="text-muted-foreground mt-1">
          Define y ajusta la meta mensual de ventas para cada sucursal
        </p>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activasSucursales.length}</p>
                <p className="text-xs text-muted-foreground">Sucursales activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {totalMeta > 0
                    ? `$${totalMeta.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Meta total del mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {porcentajeGlobal !== null ? `${porcentajeGlobal.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avance global del mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de metas por sucursal */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Meta por Sucursal — Mes Actual</CardTitle>
        </CardHeader>
        <CardContent>
          {activasSucursales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No hay sucursales activas registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activasSucursales.map(s => {
                const avance = avanceMap.get(s.id) as any;
                const meta = s.metaVentasMensual ?? 0;
                const ventasMes = avance?.ventasMes ?? 0;
                const pct = meta > 0 ? Math.min(100, (ventasMes / meta) * 100) : null;
                const barColor = pct === null ? "#9ca3af"
                  : pct >= 100 ? "#16a34a"
                  : pct >= 80 ? "#2563eb"
                  : pct >= 60 ? "#d97706"
                  : "#dc2626";

                return (
                  <div key={s.id} className="p-4 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.nombre}</p>
                          {s.ciudad && (
                            <p className="text-xs text-muted-foreground">{s.ciudad}{s.estado ? `, ${s.estado}` : ""}</p>
                          )}
                        </div>
                      </div>

                      {/* Meta editable */}
                      <div className="flex items-center gap-2 shrink-0">
                        {editId === s.id ? (
                          <>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input
                                type="number"
                                className="w-36 pl-7 h-8 text-sm"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveEdit(s.id); if (e.key === "Escape") cancelEdit(); }}
                                autoFocus
                                placeholder="0"
                              />
                            </div>
                            <Button
                              size="icon"
                              className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => saveEdit(s.id)}
                              disabled={updateMutation.isPending}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {meta > 0
                                  ? `$${meta.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                                  : <span className="text-muted-foreground text-xs">Sin meta</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">meta mensual</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(s)}
                              title="Editar meta"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Barra de avance */}
                    {meta > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            Ventas del mes: <strong>${ventasMes.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</strong>
                          </span>
                          <div className="flex items-center gap-2">
                            {pct !== null && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ color: barColor, borderColor: barColor }}
                              >
                                {pct.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct ?? 0}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Las metas se aplican al mes calendario actual. El avance se calcula con los reportes diarios enviados.
      </p>
    </div>
  );
}
