import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Save, Copy, Pencil } from "lucide-react";

export function InventarioRecetas() {
  const [vista, setVista] = useState<"productos" | "subproductos">("productos");
  const [productoSelId, setProductoSelId] = useState<number | null>(null);
  const [subproductoSelId, setSubproductoSelId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<any[]>([]);
  const [rendimiento, setRendimiento] = useState<number>(0);
  const [busqueda, setBusqueda] = useState("");
  const [showCopiar, setShowCopiar] = useState(false);
  const [destinoCopiaId, setDestinoCopiaId] = useState<number | null>(null);
  const [showRenombrar, setShowRenombrar] = useState(false);
  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState("");
  const [nuevoProductoSabor, setNuevoProductoSabor] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoSabor, setNuevoSabor] = useState("");

  const utils = trpc.useUtils();
  const { data: productos = [] } = trpc.inventario.ventas.listProductos.useQuery();
  const { data: materiasPrimas = [] } = trpc.inventario.productos.list.useQuery({ soloActivos: true } as any);
  const { data: subproductos = [] } = trpc.inventario.recetas.listSubproductos.useQuery();

  const { data: recetaActual } = trpc.inventario.recetas.getByProducto.useQuery(
    { productoVentaId: productoSelId! }, { enabled: !!productoSelId }
  );
  const { data: recetaSubproducto } = trpc.inventario.recetas.getSubproductoReceta.useQuery(
    { subproductoId: subproductoSelId! }, { enabled: !!subproductoSelId }
  );

  useEffect(() => {
    if (recetaActual) setLineas(recetaActual.map((r: any) => ({ ...r, esSubproducto: !!r.esSubproducto })));
  }, [recetaActual]);

  useEffect(() => {
    if (recetaSubproducto) {
      setLineas(recetaSubproducto.map((r: any) => ({ ...r })));
      const sp = (subproductos as any[]).find((s: any) => s.id === subproductoSelId);
      if (sp) setRendimiento(sp.rendimientoGramos);
    }
  }, [recetaSubproducto]);

  const eliminarProductoVenta = trpc.inventario.ventas.eliminarProducto.useMutation({
    onSuccess: () => {
      toast.success("Producto eliminado");
      setProductoSelId(null);
      setLineas([]);
      utils.inventario.ventas.listProductos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const crearProducto = trpc.inventario.ventas.crearProducto.useMutation({
    onSuccess: () => {
      toast.success("Producto creado");
      setShowNuevoProducto(false);
      setNuevoProductoNombre("");
      setNuevoProductoSabor("");
      utils.inventario.ventas.listProductos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const guardarReceta = trpc.inventario.recetas.guardar.useMutation({
    onSuccess: () => { toast.success("Receta guardada"); utils.inventario.recetas.getByProducto.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const guardarSP = trpc.inventario.recetas.guardarSubproductoReceta.useMutation({
    onSuccess: () => toast.success("Receta subproducto guardada"),
    onError: (e) => toast.error(e.message),
  });

  const copiarReceta = trpc.inventario.ventas.copiarReceta.useMutation({
    onSuccess: () => { toast.success("Receta copiada"); setShowCopiar(false); setDestinoCopiaId(null); },
    onError: (e) => toast.error(e.message),
  });

  const renombrar = trpc.inventario.ventas.renombrar.useMutation({
    onSuccess: () => {
      toast.success("Producto renombrado");
      setShowRenombrar(false);
      utils.inventario.ventas.listProductos.invalidate();
      setProductoSelId(null);
      setLineas([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const addLinea = () => {
    if (vista === "productos") {
      setLineas(l => [...l, { materiasPrimaId: null, subproductoId: null, cantidadGramos: 0, cantidadPiezas: 0, esSubproducto: false }]);
    } else {
      setLineas(l => [...l, { materiasPrimaId: null, cantidadGramos: 0, cantidadPiezas: 0 }]);
    }
  };

  const removeLinea = (i: number) => setLineas(l => l.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, key: string, val: any) => setLineas(l => l.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const handleGuardar = () => {
    if (vista === "productos" && productoSelId) {
      guardarReceta.mutate({ productoVentaId: productoSelId, lineas: lineas.map(l => ({ ...l, esSubproducto: !!l.esSubproducto })) });
    } else if (vista === "subproductos" && subproductoSelId) {
      guardarSP.mutate({ subproductoId: subproductoSelId, rendimientoGramos: rendimiento, lineas });
    }
  };

  const productoActual = (productos as any[]).find((p: any) => p.id === productoSelId);
  const productosFiltrados = (productos as any[]).filter((p: any) =>
    busqueda === "" || `${p.nombre} ${p.sabor}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const mpActivas = (materiasPrimas as any[]).filter((p: any) => p.activo !== false);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={vista === "productos" ? "default" : "outline"} size="sm"
          onClick={() => { setVista("productos"); setLineas([]); setProductoSelId(null); }}>
          Productos de Venta
        </Button>
        <Button variant={vista === "subproductos" ? "default" : "outline"} size="sm"
          onClick={() => { setVista("subproductos"); setLineas([]); setSubproductoSelId(null); }}>
          Subproductos
        </Button>
      </div>

      {vista === "productos" && (
        <div className="space-y-2">
          <Input placeholder="Buscar producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNuevoProducto(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo
            </Button>
            <div className="flex-1">
              <Select value={productoSelId?.toString() ?? ""} onValueChange={v => { setProductoSelId(Number(v)); setLineas([]); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona producto + sabor" /></SelectTrigger>
                <SelectContent position="item-aligned">
                  {productosFiltrados.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}{p.sabor ? ` — ${p.sabor}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {productoSelId && (
              <>
                <Button variant="outline" size="sm" onClick={() => { setNuevoNombre(productoActual?.nombre ?? ""); setNuevoSabor(productoActual?.sabor ?? ""); setShowRenombrar(true); }}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Renombrar
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600"
                  onClick={() => { if (confirm(`¿Eliminar "${productoActual?.nombre}"?`)) eliminarProductoVenta.mutate({ id: productoSelId! }); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowCopiar(true)}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar a...
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {vista === "subproductos" && (
        <div className="space-y-2">
          <Select value={subproductoSelId?.toString() ?? ""} onValueChange={v => { setSubproductoSelId(Number(v)); setLineas([]); }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecciona subproducto" /></SelectTrigger>
            <SelectContent position="item-aligned">
              {(subproductos as any[]).map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.nombre} (rinde {s.rendimientoGramos}g)</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subproductoSelId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rendimiento por lote (g):</span>
              <Input type="number" value={rendimiento} onChange={e => setRendimiento(Number(e.target.value))} className="w-28 h-7 text-sm" />
            </div>
          )}
        </div>
      )}

      {(productoSelId || subproductoSelId) && lineas.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground mb-3">Este producto no tiene receta aún.</p>
          <Button variant="outline" size="sm" onClick={addLinea}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Crear receta
          </Button>
        </div>
      )}
      {(productoSelId || subproductoSelId) && lineas.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
            {vista === "productos" && <div className="col-span-1">Tipo</div>}
            <div className={vista === "productos" ? "col-span-5" : "col-span-6"}>Insumo</div>
            <div className="col-span-2 text-center">Gramos</div>
            <div className="col-span-2 text-center">Piezas</div>
            <div className="col-span-2"></div>
          </div>

          {lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              {vista === "productos" && (
                <div className="col-span-1">
                  <Select value={l.esSubproducto ? "sp" : "mp"} onValueChange={v => updateLinea(i, 'esSubproducto', v === "sp")}>
                    <SelectTrigger className="h-7 text-xs px-1"><SelectValue /></SelectTrigger>
                    <SelectContent position="item-aligned">
                      <SelectItem value="mp">MP</SelectItem>
                      <SelectItem value="sp">Sub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={vista === "productos" ? "col-span-5" : "col-span-6"}>
                {vista === "productos" && l.esSubproducto ? (
                  <Select value={l.subproductoId?.toString() ?? ""} onValueChange={v => updateLinea(i, 'subproductoId', Number(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Subproducto" /></SelectTrigger>
                    <SelectContent position="item-aligned">
                      {(subproductos as any[]).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={l.materiasPrimaId?.toString() ?? ""} onValueChange={v => updateLinea(i, 'materiasPrimaId', Number(v))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Materia prima" /></SelectTrigger>
                    <SelectContent position="item-aligned">
                      {mpActivas.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="col-span-2">
                <Input type="number" value={l.cantidadGramos ?? 0} onChange={e => updateLinea(i, 'cantidadGramos', Number(e.target.value))} className="h-7 text-xs text-center" min={0} step={0.01} />
              </div>
              <div className="col-span-2">
                <Input type="number" value={l.cantidadPiezas ?? 0} onChange={e => updateLinea(i, 'cantidadPiezas', Number(e.target.value))} className="h-7 text-xs text-center" min={0} step={0.01} />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeLinea(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" size="sm" onClick={addLinea}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar línea
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleGuardar}
              disabled={guardarReceta.isPending || guardarSP.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {guardarReceta.isPending || guardarSP.isPending ? "Guardando..." : "Guardar receta"}
            </Button>
          </div>
        </div>
      )}

      {/* Modal Nuevo Producto */}
      <Dialog open={showNuevoProducto} onOpenChange={v => { if (!v) setShowNuevoProducto(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo producto de venta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={nuevoProductoNombre} onChange={e => setNuevoProductoNombre(e.target.value)} placeholder="Ej: Snowtea Clasico" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sabor (dejar vacío si no aplica)</label>
              <Input value={nuevoProductoSabor} onChange={e => setNuevoProductoSabor(e.target.value)} placeholder="Ej: Blueberry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNuevoProducto(false)}>Cancelar</Button>
            <Button disabled={!nuevoProductoNombre || crearProducto.isPending}
              onClick={() => crearProducto.mutate({ nombre: nuevoProductoNombre, sabor: nuevoProductoSabor })}>
              Crear producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Copiar Receta */}
      <Dialog open={showCopiar} onOpenChange={v => { if (!v) { setShowCopiar(false); setDestinoCopiaId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Copiar receta a...</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Selecciona el producto destino. Su receta actual será reemplazada.</p>
          <Select value={destinoCopiaId?.toString() ?? ""} onValueChange={v => setDestinoCopiaId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Selecciona destino" /></SelectTrigger>
            <SelectContent position="item-aligned">
              {(productos as any[]).filter((p: any) => p.id !== productoSelId).map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}{p.sabor ? ` — ${p.sabor}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopiar(false)}>Cancelar</Button>
            <Button disabled={!destinoCopiaId || copiarReceta.isPending}
              onClick={() => productoSelId && destinoCopiaId && copiarReceta.mutate({ origenId: productoSelId, destinoId: destinoCopiaId })}>
              {copiarReceta.isPending ? "Copiando..." : "Copiar receta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Renombrar */}
      <Dialog open={showRenombrar} onOpenChange={v => { if (!v) setShowRenombrar(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renombrar producto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre del producto</label>
              <Input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sabor (dejar vacío si no aplica)</label>
              <Input value={nuevoSabor} onChange={e => setNuevoSabor(e.target.value)} placeholder="Sabor" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenombrar(false)}>Cancelar</Button>
            <Button disabled={!nuevoNombre || renombrar.isPending}
              onClick={() => productoSelId && renombrar.mutate({ id: productoSelId, nombre: nuevoNombre, sabor: nuevoSabor })}>
              {renombrar.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
