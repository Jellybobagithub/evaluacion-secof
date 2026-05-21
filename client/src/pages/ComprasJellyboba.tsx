import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShoppingCart, ChevronDown, ChevronRight, FileText, Upload, Package, Plus, X, Truck, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
}

const CAT_COLORS: Record<string, string> = {
  Jarabes: "bg-purple-100 text-purple-800",
  Bases: "bg-blue-100 text-blue-800",
  Polvos: "bg-yellow-100 text-yellow-800",
  Tapioca: "bg-green-100 text-green-800",
  Empaque: "bg-orange-100 text-orange-800",
  Otros: "bg-gray-100 text-gray-700",
};

function DetalleOrden({ compraId }: { compraId: number }) {
  const { data: items = [], isLoading } = trpc.comprasJellyboba.detalle.useQuery({ compraId });
  if (isLoading) return <p className="text-xs text-muted-foreground p-2">Cargando...</p>;
  const byCategoria: Record<string, any[]> = {};
  for (const item of items as any[]) {
    const cat = item.categoria || "Otros";
    if (!byCategoria[cat]) byCategoria[cat] = [];
    byCategoria[cat].push(item);
  }
  return (
    <div className="mt-2 space-y-2">
      {Object.entries(byCategoria).map(([cat, lineas]) => (
        <div key={cat}>
          <Badge className={`text-xs mb-1 ${CAT_COLORS[cat] ?? CAT_COLORS.Otros}`}>{cat}</Badge>
          <table className="w-full text-xs">
            <tbody>
              {lineas.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-0.5 pr-2 text-muted-foreground font-mono">{l.sku}</td>
                  <td className="py-0.5 flex-1">{l.descripcion}</td>
                  <td className="py-0.5 text-right tabular-nums w-12">{Number(l.cantidad)} {l.unidad}</td>
                  <td className="py-0.5 text-right tabular-nums w-20">{fmt(Number(l.precioUnitario))}</td>
                  <td className="py-0.5 text-right tabular-nums font-medium w-20">{fmt(Number(l.importe))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function OrdenRow({ orden, onPdfUploaded }: { orden: any; onPdfUploaded: () => void }) {
  const [expandida, setExpandida] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const subirPdf = trpc.comprasJellyboba.subirPdf.useMutation({
    onSuccess: (d) => { toast.success("PDF subido correctamente"); onPdfUploaded(); },
    onError: (e) => toast.error("Error al subir PDF: " + e.message),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      subirPdf.mutate({ compraId: orden.id, numeroOrden: orden.numeroOrden, pdfBase64: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 cursor-pointer"
        onClick={() => setExpandida(v => !v)}>
        <button className="text-muted-foreground">
          {expandida ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{orden.numeroOrden}</span>
            <span className="text-xs text-muted-foreground">{orden.fecha}</span>
            {orden.vendedor && <span className="text-xs text-muted-foreground">· {orden.vendedor}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground">{Number(orden.numItems)} productos</span>
            {Number(orden.iva) > 0 && (
              <span className="text-xs text-muted-foreground">IVA: {fmt(Number(orden.iva))}</span>
            )}
          </div>
        </div>
        <span className="font-bold text-green-700 tabular-nums">{fmt(Number(orden.total))}</span>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {orden.pdfUrl ? (
            <a href={orden.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <FileText className="h-3 w-3"/> PDF
              </Button>
            </a>
          ) : (
            <>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile}/>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={subirPdf.isPending}
                onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3"/>
                {subirPdf.isPending ? "Subiendo..." : "Subir PDF"}
              </Button>
            </>
          )}
          {!(orden as any).recibida ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
              onClick={()=>{setCompraRecibiendo({id:orden.id,numeroOrden:orden.numeroOrden,fecha:orden.fecha});setModalRecepcion(true);}}>
              <Truck className="h-3 w-3"/> Recibir
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3"/> Recibida
            </span>
          )}
        </div>
      </div>
      {expandida && (
        <div className="p-3 pt-1 border-t bg-slate-50">
          <DetalleOrden compraId={orden.id}/>
        </div>
      )}
    </div>
  );
}

export default function ComprasJellyboba() {
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaOrden, setNuevaOrden] = useState({
    numeroOrden: "", proveedor: "Jellyboba", fecha: new Date().toISOString().split("T")[0],
    subtotal: 0, iva: 0, total: 0, notas: "", pdfBase64: "",
  });
  const [pdfNombreNueva, setPdfNombreNueva] = useState("");
  const fileNuevaRef = useRef<HTMLInputElement>(null);

  const { data: ordenes = [], refetch, isLoading } = trpc.comprasJellyboba.list.useQuery({ sucursalId: 30001 });
  // Recepción de mercancía
  const [modalRecepcion, setModalRecepcion] = useState(false);
  const [compraRecibiendo, setCompraRecibiendo] = useState<{id:number,numeroOrden:string,fecha:string}|null>(null);
  const [itemsRecepcion, setItemsRecepcion] = useState<any[]>([]);

  const { data: itemsQuery, isLoading: loadingItems } = trpc.comprasJellyboba.obtenerItemsRecepcion.useQuery(
    { compraId: compraRecibiendo?.id ?? 0 },
    { enabled: !!compraRecibiendo }
  );
  useEffect(() => {
    if (itemsQuery && itemsQuery.length > 0) setItemsRecepcion(itemsQuery.map((i:any) => ({...i})));
  }, [itemsQuery]);

  const confirmarRecepcion = trpc.comprasJellyboba.confirmarRecepcion.useMutation({
    onSuccess: () => {
      toast.success("Recepción confirmada — inventario actualizado");
      refetch();
      setModalRecepcion(false);
      setCompraRecibiendo(null);
      setItemsRecepcion([]);
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const fileOvRef = useRef<HTMLInputElement>(null);
  const subirPdfYCrear = trpc.comprasJellyboba.subirPdfYCrear.useMutation({
    onSuccess: (data: any) => {
      setSubiendoPdf(false);
      toast.success('OV ' + data.numeroOrden + ' creada — ' + data.itemsInsertados + ' productos importados');
      refetch();
    },
    onError: (e) => { setSubiendoPdf(false); toast.error("Error: " + e.message); },
  });

  const crearOrden = trpc.comprasJellyboba.crear.useMutation({
    onSuccess: () => {
      toast.success("Orden creada correctamente");
      refetch();
      setModalNueva(false);
      setNuevaOrden({ numeroOrden:"", proveedor:"Jellyboba", fecha:new Date().toISOString().split("T")[0], subtotal:0, iva:0, total:0, notas:"", pdfBase64:"" });
      setPdfNombreNueva("");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const totalCompras = (ordenes as any[]).reduce((s, o) => s + Number(o.total), 0);
  const totalItems = (ordenes as any[]).reduce((s, o) => s + Number(o.numItems), 0);
  const ultimaOrden = (ordenes as any[])[0];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-blue-600"/>
        <h1 className="text-xl font-bold">Compras Jellyboba</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Total órdenes</p>
            <p className="text-2xl font-bold">{(ordenes as any[]).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Monto total</p>
            <p className="text-xl font-bold text-green-700">{fmt(totalCompras)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Última orden</p>
            <p className="text-sm font-bold">{ultimaOrden?.numeroOrden}</p>
            <p className="text-xs text-muted-foreground">{ultimaOrden?.fecha}</p>
          </CardContent>
        </Card>
      </div>

      {/* Modal Recepción de Mercancía */}
      <Dialog open={modalRecepcion} onOpenChange={setModalRecepcion}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600"/>
              Recibir Mercancía — {compraRecibiendo?.numeroOrden}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
              Ajusta las cantidades reales recibidas. Si un producto no llegó, pon 0. Si llegó de más, aumenta la cantidad.
            </p>
            {loadingItems && <p className="text-sm text-center py-4 text-muted-foreground">Cargando productos del pedido...</p>}
            {itemsRecepcion.length === 0 && !loadingItems && (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2"/>
                <p className="text-sm text-amber-700">No se encontraron productos mapeados en esta orden.</p>
                <p className="text-xs text-muted-foreground mt-1">Verifica que los SKUs estén en la tabla de mapeo.</p>
              </div>
            )}
            {itemsRecepcion.map((item: any, i: number) => (
              <div key={item.inv_productoId} className="flex items-center gap-3 p-2 border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.invNombre}</p>
                  <p className="text-xs text-muted-foreground">Pedido: {item.cantidadEsperada} {item.unidadConteo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:Math.max(0,n[i].cantidadRecibida-1)};setItemsRecepcion(n);}}
                    className="w-7 h-7 rounded border flex items-center justify-center text-lg font-bold hover:bg-slate-100">−</button>
                  <input type="number" min={0}
                    value={item.cantidadRecibida}
                    onChange={e=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:Number(e.target.value)};setItemsRecepcion(n);}}
                    className={`w-16 text-center border rounded h-8 text-sm font-semibold ${item.cantidadRecibida !== item.cantidadEsperada ? "border-amber-400 bg-amber-50" : "border-green-400 bg-green-50"}`}/>
                  <button onClick={()=>{const n=[...itemsRecepcion];n[i]={...n[i],cantidadRecibida:n[i].cantidadRecibida+1};setItemsRecepcion(n);}}
                    className="w-7 h-7 rounded border flex items-center justify-center text-lg font-bold hover:bg-slate-100">+</button>
                </div>
                {item.cantidadRecibida !== item.cantidadEsperada && (
                  <span className="text-xs text-amber-600 font-medium">
                    {item.cantidadRecibida < item.cantidadEsperada ? `−${item.cantidadEsperada-item.cantidadRecibida}` : `+${item.cantidadRecibida-item.cantidadEsperada}`}
                  </span>
                )}
              </div>
            ))}
            {itemsRecepcion.length > 0 && (
              <Button onClick={()=>{
                if (!compraRecibiendo) return;
                confirmarRecepcion.mutate({
                  compraId: compraRecibiendo.id,
                  sucursalId: 30001,
                  fecha: compraRecibiendo.fecha,
                  items: itemsRecepcion.map((i:any)=>({inv_productoId:i.inv_productoId,cantidadRecibida:i.cantidadRecibida})),
                });
              }} disabled={confirmarRecepcion.isPending} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <CheckCircle2 className="h-4 w-4"/>
                {confirmarRecepcion.isPending ? "Confirmando..." : "Confirmar recepción — actualizar inventario"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Orden */}
      <Dialog open={modalNueva} onOpenChange={setModalNueva}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva Orden Jellyboba</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Número de Orden</label>
                <Input value={nuevaOrden.numeroOrden} onChange={e=>setNuevaOrden(p=>({...p,numeroOrden:e.target.value}))}
                  placeholder="OV09900" className="h-8 text-sm mt-1"/>
              </div>
              <div>
                <label className="text-xs font-medium">Fecha</label>
                <Input type="date" value={nuevaOrden.fecha} onChange={e=>setNuevaOrden(p=>({...p,fecha:e.target.value}))} className="h-8 text-sm mt-1"/>
              </div>
              <div>
                <label className="text-xs font-medium">Subtotal $</label>
                <Input type="number" value={nuevaOrden.subtotal||""} placeholder="0.00"
                  onChange={e=>setNuevaOrden(p=>({...p,subtotal:Number(e.target.value)}))} className="h-8 text-sm mt-1"/>
              </div>
              <div>
                <label className="text-xs font-medium">IVA $</label>
                <Input type="number" value={nuevaOrden.iva||""} placeholder="0.00"
                  onChange={e=>setNuevaOrden(p=>({...p,iva:Number(e.target.value),total:nuevaOrden.subtotal+Number(e.target.value)}))} className="h-8 text-sm mt-1"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Total $</label>
              <Input type="number" value={nuevaOrden.total||""}
                onChange={e=>setNuevaOrden(p=>({...p,total:Number(e.target.value)}))}
                placeholder="0.00" className="h-8 text-sm mt-1 font-semibold"/>
            </div>
            <div>
              <label className="text-xs font-medium">PDF de la orden (opcional)</label>
              <div className="flex gap-2 mt-1">
                <input ref={fileNuevaRef} type="file" accept="application/pdf" className="hidden"
                  onChange={e=>{
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPdfNombreNueva(file.name);
                    const reader = new FileReader();
                    reader.onload = () => {
                      const b64 = reader.result as string;
                      setNuevaOrden(p=>({...p,pdfBase64:b64}));
                      setParsingPdf(true);
                      parsearPdf.mutate({ pdfBase64: b64 });
                    };
                    reader.readAsDataURL(file);
                  }}/>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 flex-1"
                  onClick={()=>fileNuevaRef.current?.click()}>
                  <Upload className="h-3 w-3"/>
                  {pdfNombreNueva || "Seleccionar PDF"}
                </Button>
                {pdfNombreNueva && <button onClick={()=>{setPdfNombreNueva("");setNuevaOrden(p=>({...p,pdfBase64:""}));}}><X className="h-4 w-4 text-red-400"/></button>}
              </div>
            </div>
            <Input placeholder="Notas opcionales..." value={nuevaOrden.notas}
              onChange={e=>setNuevaOrden(p=>({...p,notas:e.target.value}))} className="h-8 text-sm"/>
            <Button onClick={()=>{
              if (!nuevaOrden.numeroOrden || nuevaOrden.total<=0) { toast.error("Número de orden y total son requeridos"); return; }
              crearOrden.mutate({ ...nuevaOrden, sucursalId: 30001 });
            }} disabled={crearOrden.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
              {crearOrden.isPending ? "Guardando..." : "Crear orden"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4"/>
            Historial de órdenes
            <span className="text-sm font-normal text-muted-foreground">{totalItems} productos en total</span>
            <div className="ml-auto flex gap-2">
              <input ref={fileOvRef} type="file" accept="application/pdf" className="hidden"
                onChange={e=>{
                  const file=e.target.files?.[0];
                  if(!file) return;
                  setSubiendoPdf(true);
                  const reader=new FileReader();
                  reader.onload=()=>subirPdfYCrear.mutate({pdfBase64:reader.result as string,sucursalId:30001});
                  reader.readAsDataURL(file);
                  e.target.value="";
                }}/>
              <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                onClick={()=>fileOvRef.current?.click()} disabled={subiendoPdf}>
                <Upload className="h-3 w-3"/>
                {subiendoPdf ? "Procesando PDF..." : "Subir OV (PDF)"}
              </Button>

            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {(ordenes as any[]).map((o: any) => (
            <OrdenRow key={o.id} orden={o} onPdfUploaded={refetch}/>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Para agregar una nueva orden, sube el PDF directamente en la fila correspondiente.
        El PDF se almacena en SECOF y el detalle de productos se captura en la base de datos.
      </p>
    </div>
  );
}
