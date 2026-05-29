import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useSucursal } from "@/context/SucursalContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RefreshCw, CheckCircle2, TrendingDown, ClipboardCheck,
  BarChart3, Save, Send, AlertTriangle, MessageSquare
} from "lucide-react";

const CATS = ["Jarabes","Polvos","Tes","Toppings","Desechables","Varios","Insumos"];

function badge(a: string) {
  if (a === "critico")  return <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-800">Crítico</span>;
  if (a === "atencion") return <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">Atención</span>;
  return <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-800">OK</span>;
}

// ─── TAB: STOCK TEÓRICO ───────────────────────────────────────────────────────
function StockTab({ sid }: { sid: number }) {
  const [fuente, setFuente] = useState<"preparacion" | "venta_odoo" | "ambos">("ambos");
  const [unidadVista, setUnidadVista] = useState<"piezas" | "gramos">("piezas");
  const { data, isLoading, refetch } = trpc.inventarioCiclo.stockTeorico.useQuery({ sucursalId: sid, fuenteConsumo: fuente });
  const byCat: Record<string, any[]> = {};
  for (const i of data?.items ?? []) { const c = i.categoria || "Varios"; if (!byCat[c]) byCat[c] = []; byCat[c].push(i); }
  const cats = CATS.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !CATS.includes(c)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={fuente} onChange={e => setFuente(e.target.value as any)}
          className="h-8 px-2 text-sm rounded border border-input bg-background">
          <option value="ambos">Ambas fuentes</option>
          <option value="preparacion">Preparaciones reales</option>
          <option value="venta_odoo">Ventas × recetas</option>
        </select>
        {data?.baseDate && <span className="text-xs text-muted-foreground">Base: {data.baseDate}</span>}
        <div className="flex items-center gap-1 border rounded-md overflow-hidden text-xs ml-auto">
          <button onClick={() => setUnidadVista("piezas")}
            className={"px-2.5 py-1.5 transition-colors " + (unidadVista === "piezas" ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted")}>Piezas</button>
          <button onClick={() => setUnidadVista("gramos")}
            className={"px-2.5 py-1.5 transition-colors " + (unidadVista === "gramos" ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted")}>Gramos</button>
        </div>
        <button onClick={() => refetch()} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>
      {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Calculando...</div>}
      {!data?.baseDate && !isLoading && (
        <div className="py-10 text-center text-sm text-muted-foreground">Sin conteo base confirmado.</div>
      )}
      {cats.map(cat => {
        const items = byCat[cat]; if (!items?.length) return null;
        return (
          <div key={cat} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <span className="text-xs text-muted-foreground">{items.length} productos</span>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Producto</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">Base</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">+Entradas</th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground">-Consumo</th>
                <th className="text-center px-2 py-2 text-xs font-bold text-teal-700">={unidadVista === 'gramos' ? 'g' : 'pzas'} Teórico</th>
              </tr></thead>
              <tbody>
                {items.map((i: any) => (
                  <tr key={i.productoId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{i.nombre}</td>
                    <td className="px-2 py-2.5 text-center text-muted-foreground">
                      {unidadVista === "gramos" ? (i.stockBase * (i.pesoNeto || 1)).toFixed(0) + "g" : i.stockBase}
                      <span className="text-xs"> {unidadVista === "gramos" ? "g" : i.unidad}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-emerald-700">+{unidadVista === "gramos" ? (i.entradas * (i.pesoNeto || 1)).toFixed(0) : i.entradas}</td>
                    <td className="px-2 py-2.5 text-center text-red-600">-{unidadVista === "gramos" ? (i.consumo * (i.pesoNeto || 1)).toFixed(0) : i.consumo}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-teal-700">
                      {unidadVista === "gramos" ? (i.stockTeorico * (i.pesoNeto || 1)).toFixed(0) : i.stockTeorico}
                      <span className="text-xs font-normal"> {unidadVista === "gramos" ? "g" : i.unidad}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: CONTEO FÍSICO (NUEVO) ───────────────────────────────────────────────
function ConteoFisicoTab({ sid }: { sid: number }) {
  const [almacenId, setAlmacenId] = useState<number | null>(null);
  const [fechaConteo] = useState(new Date().toISOString().split("T")[0]);
  const [conteoId, setConteoId] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Record<number, { piezas: string; gramos: string }>>({});
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<"borrador" | "enviado" | null>(null);
  const [iniciado, setIniciado] = useState(false);

  const { data: almacenes = [] } = trpc.inventarioCiclo.almacenes.useQuery({ sucursalId: sid });
  const { data: productos = [] } = trpc.inventarioCiclo.productosActivos.useQuery();
  const almacenActual = (almacenes as any[]).find((a: any) => a.id === almacenId);

  // Auto-seleccionar primer almacén
  useEffect(() => {
    if ((almacenes as any[]).length > 0 && !almacenId) {
      setAlmacenId((almacenes as any[])[0].id);
    }
  }, [almacenes]);

  // Cargar conteo de la semana actual
  const { data: conteoData, refetch: refetchConteo } = trpc.inventarioCiclo.getConteoSemana.useQuery(
    { sucursalId: sid, almacenId: almacenId! },
    { enabled: !!almacenId }
  );

  useEffect(() => {
    if (!conteoData) return;
    if (conteoData.conteo) {
      setConteoId(conteoData.conteo.id);
      setEstado(conteoData.conteo.estado as any);
      setNotas(conteoData.conteo.notas ?? "");
      const m: Record<number, { piezas: string; gramos: string }> = {};
      for (const d of conteoData.detalles as any[]) {
        m[d.productoId] = { piezas: String(d.cantidadPiezas), gramos: String(d.cantidadGramos ?? 0) };
      }
      setLineas(m);
      setIniciado(true);
    } else {
      setIniciado(false);
      setConteoId(null);
      setLineas({});
      setEstado(null);
    }
  }, [conteoData]);

  const iniciar = trpc.inventarioCiclo.iniciarConteo.useMutation({
    onSuccess: (d) => { setConteoId(d.conteoId); setEstado(d.estado as any); setIniciado(true); refetchConteo(); },
    onError: e => toast.error(e.message),
  });
  const guardar = trpc.inventarioCiclo.guardarConteo.useMutation({
    onSuccess: () => toast.success("Borrador guardado"),
    onError: e => toast.error(e.message),
  });
  const enviar = trpc.inventarioCiclo.enviarConteo.useMutation({
    onSuccess: () => { setEstado("enviado"); toast.success("Conteo enviado para revisión"); refetchConteo(); },
    onError: e => toast.error(e.message),
  });

  const lineasData = () => (productos as any[])
    .filter((p: any) => lineas[p.id]?.piezas !== undefined && lineas[p.id].piezas !== "")
    .map((p: any) => ({
      productoId: p.id,
      cantidadPiezas: parseFloat(lineas[p.id]?.piezas ?? "0") || 0,
      cantidadGramos: parseFloat(lineas[p.id]?.gramos ?? "0") || 0,
    }));

  const handleGuardar = () => {
    if (!conteoId) return;
    guardar.mutate({ conteoId, lineas: lineasData() });
  };

  const handleEnviar = async () => {
    if (!conteoId) return;
    await guardar.mutateAsync({ conteoId, lineas: lineasData() });
    enviar.mutate({ conteoId, notas });
  };

  const cats = [...new Set((productos as any[]).map((p: any) => p.categoria))].sort() as string[];
  const esEnviado = estado === "enviado";
  const esBloqueado = estado === "bloqueado" as any;
  const editable = estado === "borrador";

  if (!almacenId && (almacenes as any[]).length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Sin almacenes configurados.</div>;
  }

  if (!iniciado) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
          <div>
            <p className="font-medium">Conteo Físico — Semana actual</p>
            <div className="flex justify-center gap-2 mt-2">
              {(almacenes as any[]).map((a: any) => (
                <button key={a.id}
                  onClick={() => setAlmacenId(a.id)}
                  className={"px-3 py-1.5 rounded-lg border text-sm transition-colors " + (almacenId === a.id ? "bg-teal-600 text-white border-teal-600" : "border-input hover:bg-muted")}>
                  {a.nombre}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => iniciar.mutate({ sucursalId: sid, almacenId: almacenId!, fechaConteo })}
            disabled={iniciar.isPending} className="bg-teal-600 hover:bg-teal-700">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            {iniciar.isPending ? "Iniciando..." : "Iniciar conteo"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: selector almacén + estado + botones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(almacenes as any[]).map((a: any) => (
              <button key={a.id}
                onClick={() => { setAlmacenId(a.id); setIniciado(false); }}
                className={"px-3 py-1.5 rounded-lg border text-sm transition-colors " + (almacenId === a.id ? "bg-teal-600 text-white border-teal-600" : "border-input hover:bg-muted")}>
                {a.nombre}
              </button>
            ))}
          </div>
          {esEnviado && <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">Enviado — pendiente revisión</span>}
          {editable && <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-800">En progreso</span>}
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGuardar} disabled={guardar.isPending}>
              <Save className="w-4 h-4 mr-1" /> Guardar borrador
            </Button>
            <Button size="sm" onClick={handleEnviar}
              disabled={enviar.isPending || guardar.isPending}
              className="bg-teal-600 hover:bg-teal-700">
              <Send className="w-4 h-4 mr-1" />
              {enviar.isPending ? "Enviando..." : "Enviar para revisión"}
            </Button>
          </div>
        )}
      </div>

      {/* Banner si ya fue enviado */}
      {esEnviado && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800">Conteo enviado y en espera de revisión. El administrador lo comparará con el teórico.</span>
        </div>
      )}

      {/* Tabla de productos por categoría */}
      {cats.map(cat => {
        const prods = (productos as any[]).filter((p: any) => p.categoria === cat);
        if (!prods.length) return null;
        const tienePesables = prods.some((p: any) => p.puedeAbrirse) && almacenActual?.tipo === "piezas_gramos";
        return (
          <div key={cat} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
              <span className="text-sm font-medium">{cat}</span>
              <span className="text-xs text-muted-foreground">{prods.length} productos</span>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/10">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Producto</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Piezas cerradas</th>
                {tienePesables && <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Gramos abiertos</th>}
              </tr></thead>
              <tbody>
                {prods.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sm">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">{p.unidadConteo}</div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number" min="0" step="0.5"
                        value={lineas[p.id]?.piezas ?? ""}
                        onChange={e => setLineas(prev => ({ ...prev, [p.id]: { ...prev[p.id], piezas: e.target.value, gramos: prev[p.id]?.gramos ?? "" } }))}
                        disabled={!editable}
                        placeholder="0"
                        className="w-20 mx-auto block text-center h-8 rounded border border-input bg-background px-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                    {tienePesables && (
                      <td className="px-3 py-2 text-center">
                        {p.puedeAbrirse ? (
                          <input
                            type="number" min="0" step="1"
                            value={lineas[p.id]?.gramos ?? ""}
                            onChange={e => setLineas(prev => ({ ...prev, [p.id]: { ...prev[p.id], gramos: e.target.value, piezas: prev[p.id]?.piezas ?? "" } }))}
                            disabled={!editable}
                            placeholder="0"
                            className="w-20 mx-auto block text-center h-8 rounded border border-input bg-background px-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Notas */}
      {editable && (
        <div className="border rounded-lg p-4 space-y-1">
          <label className="text-sm font-medium">Notas del conteo</label>
          <textarea
            value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Observaciones, diferencias encontradas..."
            className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      )}
    </div>
  );
}

// ─── TAB: APROBACIÓN / COMPARACIÓN ───────────────────────────────────────────
function AprobTab({ sid }: { sid: number }) {
  const { user } = useAuth();
  const isOwner = ["superadmin", "owner"].includes(user?.role ?? "");
  const [notas, setNotas] = useState("");
  const [cuestionando, setCuestionando] = useState<number | null>(null);
  const [textoCuestion, setTextoCuestion] = useState("");
  const { data, isLoading, refetch } = trpc.inventarioCiclo.comparacionPendiente.useQuery({ sucursalId: sid });
  const aprobar = trpc.inventarioCiclo.aprobarConteo.useMutation({
    onSuccess: () => { toast.success("Conteo aprobado — nuevo ciclo iniciado"); refetch(); },
    onError: e => toast.error(e.message),
  });
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const rechazar = trpc.inventarioCiclo.rechazarConteo.useMutation({
    onSuccess: (d) => { toast.success(`Conteo devuelto al líder (${d.devueltos} almacén/es)`); setMostrarRechazo(false); setMotivoRechazo(""); refetch(); },
    onError: e => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>;
  if (!data?.pendientes?.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>Sin conteos pendientes de revisión.</p>
      <p className="text-xs mt-1 text-muted-foreground/60">El líder debe enviar su conteo desde la tab "Conteo Físico".</p>
    </div>
  );

  const comp = data.comparacion;
  const criticos = comp.filter((c: any) => c.alerta === "critico").length;
  const atencion = comp.filter((c: any) => c.alerta === "atencion").length;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Conteos del {data.pendientes[0]?.fechaConteo} — {(data as any).almacenes ?? data.pendientes.map((p:any)=>p.almacen).join(" + ")}</span>
        {criticos > 0 && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">{criticos} crítico(s)</span>}
        {atencion > 0 && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">{atencion} atención</span>}
      </div>

      {/* Tabla comparativa */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/30">
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Producto</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-teal-700">Teórico</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Físico</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Delta</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">% Merma</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Estado</th>
            {isOwner && <th className="w-10 px-2"></th>}
          </tr></thead>
          <tbody>
            {comp.map((i: any) => (
              <tr key={i.productoId}
                className={`border-b last:border-0 ${i.alerta === "critico" ? "bg-red-50/50" : i.alerta === "atencion" ? "bg-amber-50/30" : ""}`}>
                <td className="px-3 py-2 font-medium">{i.nombre}</td>
                <td className="px-3 py-2 text-center text-teal-700 font-semibold">{i.teorico} <span className="text-xs font-normal">{i.unidad}</span></td>
                <td className="px-3 py-2 text-center">{i.fisico} <span className="text-xs text-muted-foreground">{i.unidad}</span></td>
                <td className={`px-3 py-2 text-center text-xs font-medium ${i.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {i.delta >= 0 ? "+" : ""}{i.delta}
                </td>
                <td className={`px-3 py-2 text-center font-semibold ${i.pctMerma > 5 ? "text-red-700" : i.pctMerma > 2 ? "text-amber-700" : "text-emerald-700"}`}>
                  {i.pctMerma}%
                </td>
                <td className="px-3 py-2 text-center">{badge(i.alerta)}</td>
                {isOwner && (
                  <td className="px-2 py-2 text-center">
                    {i.alerta !== "ok" && (
                      <button title="Cuestionar"
                        onClick={() => { setCuestionando(i.productoId); setTextoCuestion(""); }}
                        className="p-1 rounded hover:bg-amber-100 text-muted-foreground hover:text-amber-700 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel cuestionar */}
      {cuestionando !== null && isOwner && (() => {
        const prod = comp.find((c: any) => c.productoId === cuestionando);
        return (
          <div className="border border-amber-300 rounded-lg p-4 space-y-2 bg-amber-50/50">
            <p className="text-sm font-medium text-amber-900">
              Cuestionando: <strong>{prod?.nombre}</strong> — teórico {prod?.teorico} vs físico {prod?.fisico} ({prod?.pctMerma}% merma)
            </p>
            <textarea value={textoCuestion} onChange={e => setTextoCuestion(e.target.value)} rows={2}
              placeholder="¿Por qué hay diferencia? Escribe la pregunta para el líder..."
              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCuestionando(null)}>Cancelar</Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => { toast.success("Observación registrada (por implementar en bitácora)"); setCuestionando(null); }}>
                Registrar observación
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Aprobar */}
      {isOwner && (
        <div className="space-y-3">
          {/* Panel aprobar */}
          <div className="border border-teal-200 rounded-lg p-4 space-y-3 bg-teal-50/30">
            <p className="text-sm font-medium">Aprobar como nueva base del ciclo</p>
            <p className="text-xs text-muted-foreground">Al aprobar, este conteo se convierte en la nueva base para calcular el stock teórico. Los datos <strong>no modifican</strong> el inventario real.</p>
            <input type="text" placeholder="Notas opcionales..." value={notas} onChange={e => setNotas(e.target.value)}
              className="w-full h-8 px-3 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
            <div className="flex items-center justify-between">
              <button onClick={() => setMostrarRechazo(!mostrarRechazo)}
                className="text-xs text-amber-600 hover:text-amber-800 underline underline-offset-2">
                Devolver al líder para corrección
              </button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                disabled={aprobar.isPending}
                onClick={() => aprobar.mutate({ conteoIds: (data as any).conteoIds ?? [data.conteoId!], notas })}>
                <CheckCircle2 className="w-4 h-4" />
                {aprobar.isPending ? "Aprobando..." : "Aprobar conteo"}
              </Button>
            </div>
          </div>
          {/* Panel devolver */}
          {mostrarRechazo && (
            <div className="border border-amber-300 rounded-lg p-4 space-y-3 bg-amber-50/50">
              <p className="text-sm font-medium text-amber-900">Devolver conteo al líder</p>
              <p className="text-xs text-amber-700">El conteo volverá a estado borrador. El líder podrá corregirlo y reenviarlo.</p>
              <input type="text" placeholder="Motivo o instrucción para el líder (opcional)..."
                value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                className="w-full h-8 px-3 text-sm rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setMostrarRechazo(false)}>Cancelar</Button>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={rechazar.isPending}
                  onClick={() => rechazar.mutate({ conteoIds: (data as any).conteoIds ?? [data.conteoId!], motivo: motivoRechazo || undefined })}>
                  {rechazar.isPending ? "Devolviendo..." : "Devolver al líder"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB: HISTORIAL MERMAS ────────────────────────────────────────────────────
function HistTab({ sid }: { sid: number }) {
  const [expandido, setExpandido] = useState<number | null>(null);
  const { data, isLoading } = trpc.inventarioCiclo.historialMermas.useQuery({ sucursalId: sid, semanas: 12 });
  const { data: detalle, isLoading: loadingDet } = trpc.inventarioCiclo.historialConteoDetalle.useQuery(
    { conteoId: expandido! }, { enabled: !!expandido }
  );
  const sem = data?.semanas ?? [];
  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Calculando...</div>;
  if (!sem.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
      Necesitas al menos 2 conteos aprobados.
    </div>
  );
  const maxM = Math.max(...sem.map((s: any) => s.pctMerma), 5);
  const prom = (sem.reduce((s: number, w: any) => s + w.pctMerma, 0) / sem.length).toFixed(1);
  const CATS = ["Jarabes","Polvos","Tes","Toppings","Desechables","Varios","Insumos"];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["Promedio merma", prom + "%", "text-teal-700"], ["Semanas críticas", sem.filter((s: any) => s.alerta === "critico").length, "text-red-700"], ["Semanas OK", sem.filter((s: any) => s.alerta === "ok").length, "text-emerald-700"]].map(([l, v, c]) => (
          <div key={String(l)} className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={"text-2xl font-bold " + c}>{v}</p>
          </div>
        ))}
      </div>
      <div className="border rounded-lg divide-y overflow-hidden">
        {[...sem].reverse().map((s: any) => (
          <div key={s.conteoId}>
            <button
              onClick={() => setExpandido(expandido === s.conteoId ? null : s.conteoId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
              <span className="text-sm text-muted-foreground w-24 shrink-0">{s.fecha}</span>
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                <div className={"h-full rounded transition-all " + (s.alerta === "critico" ? "bg-red-400" : s.alerta === "atencion" ? "bg-amber-400" : "bg-emerald-400")}
                  style={{ width: Math.min(100, (s.pctMerma / maxM) * 100) + "%" }} />
              </div>
              <span className={"text-sm font-semibold w-12 text-right " + (s.alerta === "critico" ? "text-red-700" : s.alerta === "atencion" ? "text-amber-700" : "text-emerald-700")}>{s.pctMerma}%</span>
              {badge(s.alerta)}
              <span className="text-xs text-muted-foreground ml-1">{expandido === s.conteoId ? "▲" : "▼"}</span>
            </button>
            {expandido === s.conteoId && (
              <div className="px-4 pb-4 bg-muted/10">
                {loadingDet ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">Cargando detalle...</div>
                ) : !detalle?.items?.length ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">Sin detalle disponible</div>
                ) : (
                  <div className="space-y-3 pt-3">
                    <div className="flex gap-4 text-xs text-muted-foreground pb-1 border-b">
                      <span>Conteo del {s.fecha}</span>
                      <span>{detalle.items.length} productos</span>
                      <span className="ml-auto">Teórico {Math.round(detalle.items.reduce((a:number,i:any)=>a+i.teorico,0))} u · Físico {Math.round(detalle.items.reduce((a:number,i:any)=>a+i.fisico,0))} u</span>
                    </div>
                    {CATS.concat(["Otros"]).map(cat => {
                      const items = (detalle.items as any[]).filter((i:any) => (cat === "Otros" ? !CATS.includes(i.categoria) : i.categoria === cat));
                      if (!items.length) return null;
                      return (
                        <div key={cat} className="border rounded overflow-hidden">
                          <div className="px-3 py-1.5 bg-muted/40 text-xs font-medium text-muted-foreground">{cat}</div>
                          <table className="w-full text-xs">
                            <thead><tr className="border-b">
                              <th className="text-left px-3 py-1.5 text-muted-foreground">Producto</th>
                              <th className="text-center px-2 py-1.5 text-teal-700">Teórico</th>
                              <th className="text-center px-2 py-1.5 text-muted-foreground">Físico</th>
                              <th className="text-center px-2 py-1.5 text-muted-foreground">Delta</th>
                              <th className="text-center px-2 py-1.5 text-muted-foreground">% Merma</th>
                            </tr></thead>
                            <tbody>
                              {items.map((i:any) => (
                                <tr key={i.productoId} className={`border-b last:border-0 ${i.pctMerma>5?"bg-red-50/40":i.pctMerma>2?"bg-amber-50/30":""}`}>
                                  <td className="px-3 py-1.5">{i.nombre}</td>
                                  <td className="px-2 py-1.5 text-center text-teal-700">{i.teorico} <span className="text-muted-foreground">{i.unidad}</span></td>
                                  <td className="px-2 py-1.5 text-center">{i.fisico} <span className="text-muted-foreground">{i.unidad}</span></td>
                                  <td className={`px-2 py-1.5 text-center font-medium ${i.delta<0?"text-red-600":i.delta>0?"text-emerald-600":"text-muted-foreground"}`}>{i.delta>0?"+":""}{i.delta}</td>
                                  <td className={`px-2 py-1.5 text-center font-semibold ${i.pctMerma>5?"text-red-700":i.pctMerma>2?"text-amber-700":"text-emerald-700"}`}>{i.pctMerma}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground px-4 py-2">OK: &lt;2% · Atención: 2–5% · Crítico: &gt;5% · Click en una semana para ver el detalle</p>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function ControlInventario() {
  const { sucursalId: gId } = useSucursal();
  const sid = gId ?? 30001;
  const { user } = useAuth();
  const isOwner = ["superadmin", "owner"].includes(user?.role ?? "");
  const isLider = ["superadmin", "owner", "manager", "leader"].includes(user?.role ?? "");
  const [tab, setTab] = useState<"stock" | "conteo" | "aprobacion" | "historial">("stock");

  const { data: kpi } = trpc.inventarioCiclo.kpiResumen.useQuery({ sucursalId: sid });
  const { data: cmp } = trpc.inventarioCiclo.comparacionPendiente.useQuery({ sucursalId: sid });
  const pend = cmp?.pendientes?.length ?? 0;

  type TabKey = "stock" | "conteo" | "aprobacion" | "historial";
  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: "stock",      label: "Stock Teórico",                                    show: true },
    { key: "conteo",     label: "Conteo Físico",                                    show: isLider },
    { key: "aprobacion", label: isOwner ? `Aprobación${pend > 0 ? ` (${pend})` : ""}` : "Comparación", show: isOwner },
    { key: "historial",  label: "Historial Mermas",                                  show: isOwner },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-1">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-teal-600" /> Control Inventario — Ciclo Cerrado
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stock teórico vs físico · Mermas · Aprobación</p>
        </div>
        {kpi?.baseDate && (
          <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
            Base: <span className="font-medium">{kpi.baseDate}</span>
          </div>
        )}
      </div>

      {/* KPIs resumen */}
      {kpi && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Productos", kpi.totalProductos, "text-teal-700"],
            ["Stock total", kpi.totalTeorico + " u", "text-blue-700"],
            ["Bajo stock", kpi.productosUrgentes, kpi.productosUrgentes > 0 ? "text-red-700" : "text-emerald-700"],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="bg-secondary rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className={"text-xl font-bold " + c}>{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock"      && <StockTab sid={sid} />}
      {tab === "conteo"     && <ConteoFisicoTab sid={sid} />}
      {tab === "aprobacion" && <AprobTab sid={sid} />}
      {tab === "historial"  && <HistTab sid={sid} />}
    </div>
  );
}
