import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSucursal } from "@/context/SucursalContext";

const SUCURSALES_DISPONIBLES = [{ id: 30001, nombre: "Plaza Patio" }];
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

function getPeriodsOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("es-MX", { month: "long", year: "numeric" });
    options.push({ val, label });
  }
  return options;
}

const UNIDADES = ["pz", "bolsa", "caja", "kg", "litro", "bote", "rollo"];

const CONCEPTOS_RAPIDOS = [
  { concepto: "Hielos", proveedor: "Local", unidad: "bolsa", inv_productoId: 30070 },
  { concepto: "Popote PLA", proveedor: "Varios", unidad: "caja", inv_productoId: 30060 },
  { concepto: "Film Stretch", proveedor: "Varios", unidad: "rollo", inv_productoId: 30042 },
  { concepto: "Azúcar Standard", proveedor: "Varios", unidad: "kg", inv_productoId: 30061 },
  { concepto: "Leche Soya Ades", proveedor: "Superama", unidad: "pz", inv_productoId: 30056 },
  { concepto: "Galletas Oreo", proveedor: "Varios", unidad: "pz", inv_productoId: 30044 },
  { concepto: "Galletas Chai Oreo", proveedor: "Varios", unidad: "pz", inv_productoId: 30045 },
];

export default function ComprasExternas() {
  const periods = getPeriodsOptions();
  const [periodo, setPeriodo] = useState(periods[0].val);
  const { sucursalId: globalSucursalId } = useSucursal();
  const sucursalId = globalSucursalId ?? 30001;
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    concepto: "", proveedor: "Externo", fecha: new Date().toISOString().split("T")[0],
    cantidad: 1, unidad: "pz", precioUnitario: 0, total: 0, notas: "", inv_productoId: undefined as number | undefined,
  });

  const { data: compras = [], refetch } = trpc.finanzas.comprasExternas.list.useQuery(
    { sucursalId, periodo }, { enabled: !!sucursalId }
  );

  const guardar = trpc.finanzas.comprasExternas.guardar.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada");
      refetch();
      setModal(false);
      setForm({ concepto: "", proveedor: "Externo", fecha: new Date().toISOString().split("T")[0], cantidad: 1, unidad: "pz", precioUnitario: 0, total: 0, notas: "", inv_productoId: undefined });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const eliminar = trpc.finanzas.comprasExternas.eliminarById?.useMutation?.({
    onSuccess: () => { toast.success("Eliminado"); refetch(); },
  });

  const totalMes = (compras as any[]).reduce((s: number, c: any) => s + Number(c.total), 0);

  function setConceptoRapido(c: typeof CONCEPTOS_RAPIDOS[0]) {
    setForm(p => ({ ...p, concepto: c.concepto, proveedor: c.proveedor, unidad: c.unidad, inv_productoId: (c as any).inv_productoId }));
  }

  useEffect(() => {
    setForm(p => ({ ...p, total: p.cantidad * p.precioUnitario }));
  }, [form.cantidad, form.precioUnitario]);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-orange-600" />
        <h1 className="text-xl font-bold">Compras Externas</h1>
        <span className="text-sm text-muted-foreground">(hielos, film, azúcar, leche soya, etc.)</span>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map(p => <SelectItem key={p.val} value={p.val}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1 bg-orange-600 hover:bg-orange-700 ml-auto"
          onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" /> Nueva compra
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Compras del mes</p>
          <p className="text-2xl font-bold text-orange-700">{fmt(totalMes)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground">Registros</p>
          <p className="text-2xl font-bold">{(compras as any[]).length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de compras — {periods.find(p => p.val === periodo)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {(compras as any[]).length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Sin compras externas este mes.</p>
            : <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1">Fecha</th>
                    <th className="text-left">Concepto</th>
                    <th className="text-left">Proveedor</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">P.Unit</th>
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(compras as any[]).map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 text-xs">{c.fecha}</td>
                      <td className="font-medium">{c.concepto}{c.notas ? <span className="block text-xs text-muted-foreground font-normal">{c.notas}</span> : null}</td>
                      <td className="text-xs text-muted-foreground">{c.proveedor}</td>
                      <td className="text-right text-xs">{c.cantidad} {c.unidad}</td>
                      <td className="text-right text-xs">{fmt(Number(c.precioUnitario))}</td>
                      <td className="text-right font-semibold">{fmt(Number(c.total))}</td>
                      <td className="text-right">
                        {eliminar && (
                          <button onClick={() => eliminar.mutate({ id: c.id })} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td colSpan={5} className="py-1.5">TOTAL</td>
                    <td className="text-right text-orange-700">{fmt(totalMes)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
          }
        </CardContent>
      </Card>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva Compra Externa</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Accesos rápidos:</p>
              <div className="flex flex-wrap gap-1">
                {CONCEPTOS_RAPIDOS.map(c => (
                  <button key={c.concepto} onClick={() => setConceptoRapido(c)}
                    className="text-xs px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded border border-orange-200">
                    {c.concepto}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium">Concepto *</label>
                <Input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))}
                  placeholder="Hielos, film, azúcar..." className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Proveedor</label>
                <Input value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Fecha</label>
                <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Cantidad *</label>
                <Input type="number" value={form.cantidad || ""} min={1}
                  onChange={e => setForm(p => ({ ...p, cantidad: Number(e.target.value) }))}
                  className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Unidad</label>
                <Select value={form.unidad} onValueChange={v => setForm(p => ({ ...p, unidad: v }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Precio unitario $</label>
                <Input type="number" value={form.precioUnitario || ""}
                  onChange={e => setForm(p => ({ ...p, precioUnitario: Number(e.target.value) }))}
                  className="h-8 text-sm mt-1" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium">Total $</label>
                <Input type="number" value={form.total || ""}
                  onChange={e => setForm(p => ({ ...p, total: Number(e.target.value) }))}
                  className="h-8 text-sm mt-1 font-semibold" />
              </div>
            </div>
            <Input placeholder="Notas opcionales..." value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className="h-8 text-sm" />
            <Button onClick={() => {
              if (!form.concepto || form.total <= 0) { toast.error("Concepto y total requeridos"); return; }
              guardar.mutate({ ...form, sucursalId, periodo });
            }} disabled={guardar.isPending} className="w-full bg-orange-600 hover:bg-orange-700">
              {guardar.isPending ? "Guardando..." : "Registrar compra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
