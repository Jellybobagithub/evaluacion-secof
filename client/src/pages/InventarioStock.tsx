import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Package, TrendingDown, CheckCircle2, RefreshCw } from "lucide-react";

const ALERTA_CONFIG = {
  critico: { color: "bg-red-50 border-red-300", badge: "bg-red-100 text-red-800", icon: "🚨", label: "Crítico" },
  bajo:    { color: "bg-amber-50 border-amber-300", badge: "bg-amber-100 text-amber-800", icon: "⚠️", label: "Bajo" },
  ok:      { color: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", icon: "📦", label: "OK" },
  bueno:   { color: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700", icon: "✅", label: "Bien" },
};

function StockBar({ diasStock }: { diasStock: number }) {
  const pct = Math.min(100, (diasStock / 14) * 100);
  const color = diasStock < 2 ? "bg-red-500" : diasStock < 4 ? "bg-amber-500" : diasStock < 7 ? "bg-blue-500" : "bg-green-500";
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function InventarioStock() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState(30001);
  const [dias, setDias] = useState(7);
  const [categoria, setCategoria] = useState("todas");

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: stock = [], isLoading, refetch } = trpc.inventario.stockTeorico.useQuery(
    { sucursalId, dias },
    { refetchInterval: 5 * 60 * 1000 } // auto-refresh cada 5 min
  );

  const categorias = ["todas", ...Array.from(new Set((stock as any[]).map((s: any) => s.categoria)))];
  const filtrado = categoria === "todas" ? stock as any[] : (stock as any[]).filter((s: any) => s.categoria === categoria);

  const criticos = (stock as any[]).filter((s: any) => s.alerta === "critico").length;
  const bajos = (stock as any[]).filter((s: any) => s.alerta === "bajo").length;
  const necesitan = (stock as any[]).filter((s: any) => s.necesitaSurtido);

  const fechaConteo = (stock as any[])[0]?.fechaConteo;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">📦 Inventario Teórico</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Calculado a partir de ventas Odoo + recetas
            {fechaConteo && ` · Base: conteo del ${new Date(fechaConteo).toLocaleDateString("es-MX")}`}
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg border hover:bg-slate-50">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(sucursales as any[]).length > 1 && (
          <Select value={String(sucursalId)} onValueChange={v => setSucursalId(Number(v))}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(sucursales as any[]).map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={String(dias)} onValueChange={v => setDias(Number(v))}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Promedio 7 días</SelectItem>
            <SelectItem value="14">Promedio 14 días</SelectItem>
            <SelectItem value="30">Promedio 30 días</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categorias.map(c => <SelectItem key={c} value={c}>{c === "todas" ? "Todas" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Resumen alertas */}
      {(criticos > 0 || bajos > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {criticos > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-bold text-red-800">{criticos} insumo{criticos>1?"s":""} crítico{criticos>1?"s":""}</p>
                  <p className="text-xs text-red-600">Menos de 2 días de stock</p>
                </div>
              </CardContent>
            </Card>
          )}
          {bajos > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-3 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-800">{bajos} insumo{bajos>1?"s":""} bajo{bajos>1?"s":""}</p>
                  <p className="text-xs text-amber-600">2-4 días de stock</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Orden de surtido */}
      {necesitan.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              🛒 Orden de surtido recomendada
              <Badge className="bg-slate-100 text-slate-600 text-xs">{necesitan.length} productos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {necesitan.map((s: any) => (
                <div key={s.productoId} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                  <span className={`font-medium ${s.alerta === 'critico' ? 'text-red-700' : 'text-amber-700'}`}>
                    {s.alerta === 'critico' ? '🚨' : '⚠️'} {s.nombre}
                  </span>
                  <span className="text-slate-500">
                    Stock: <b>{s.stockUnidades} {s.unidadConteo}</b>
                    {s.unidadesASurtir > 0 && <span className="ml-2 text-blue-600">→ pedir {s.unidadesASurtir} {s.unidadConteo}</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de productos */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Calculando inventario...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtrado.map((s: any) => {
            const cfg = ALERTA_CONFIG[s.alerta as keyof typeof ALERTA_CONFIG];
            return (
              <div key={s.productoId} className={`rounded-xl border p-3 ${cfg.color}`}>
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{s.nombre}</p>
                    <p className="text-xs text-slate-500">{s.categoria}</p>
                  </div>
                  <Badge className={`text-xs ml-2 shrink-0 ${cfg.badge}`}>
                    {cfg.icon} {s.diasStock < 99 ? `${s.diasStock}d` : "∞"}
                  </Badge>
                </div>
                <StockBar diasStock={s.diasStock} />
                <div className="flex justify-between mt-1.5 text-xs text-slate-600">
                  <span>Stock: <b>{s.stockUnidades} {s.unidadConteo}</b></span>
                  <span className="text-slate-400">{s.consumoPorDia > 0 ? `${Math.round(s.consumoPorDia)}g/día` : "sin consumo"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
