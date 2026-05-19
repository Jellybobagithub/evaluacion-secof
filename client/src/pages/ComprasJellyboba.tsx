import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShoppingCart, ChevronDown, ChevronRight, FileText, Upload, Package } from "lucide-react";

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
  const { data: ordenes = [], refetch, isLoading } = trpc.comprasJellyboba.list.useQuery({ sucursalId: 30001 });

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

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4"/>
            Historial de órdenes
            <span className="ml-auto text-sm font-normal text-muted-foreground">{totalItems} productos en total</span>
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
