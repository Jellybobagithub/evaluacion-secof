import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Package, History, PlusCircle } from "lucide-react";

export default function ConsumoInterno() {
  const { sucursalId } = useSucursal();
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");

  const { data: productos = [] } = trpc.inventario.productos.list.useQuery(undefined, {
    select: (d: any[]) => d.filter((p: any) => p.activo !== false),
  });

  const { data: historial = [], refetch } = trpc.inventario.consumoInterno.historial.useQuery(
    { sucursalId: sucursalId ?? 0, dias: 7 },
    { enabled: !!sucursalId }
  );

  const registrar = trpc.inventario.consumoInterno.registrar.useMutation({
    onSuccess: () => {
      toast.success("Consumo registrado");
      setProductoId(""); setCantidad("1"); setMotivo("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!productoId || !sucursalId) return toast.error("Selecciona un producto");
    const cant = parseFloat(cantidad);
    if (!cant || cant <= 0) return toast.error("Ingresa una cantidad válida");
    registrar.mutate({
      sucursalId,
      productoId: Number(productoId),
      cantidadPiezas: cant,
      cantidadGramos: 0,
      motivo: motivo.trim() || undefined,
    });
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Consumo Interno</h1>
          <p className="text-sm text-muted-foreground">Reportar producto tomado o surtido</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-orange-500" /> Registrar consumo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Producto</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona producto..." />
              </SelectTrigger>
              <SelectContent>
                {(productos as any[]).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Cantidad (piezas)</Label>
            <Input type="number" min="0.1" step="0.1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Motivo (opcional)</Label>
            <Input placeholder="ej. muestra, prueba de calidad, vasos isla..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={registrar.isPending || !productoId}>
            {registrar.isPending ? "Registrando..." : "Registrar consumo"}
          </Button>
        </CardContent>
      </Card>

      {historial.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(historial as any[]).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                <div>
                  <span className="font-medium">{h.producto}</span>
                  {h.notas && <span className="text-muted-foreground ml-1">— {h.notas.replace('Consumo interno: ','').replace('Consumo interno','')}</span>}
                  <p className="text-muted-foreground">{h.empleado} · {new Date(h.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="font-semibold text-orange-600">-{Math.abs(Number(h.cantidadPiezas))} {h.unidadConteo}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
