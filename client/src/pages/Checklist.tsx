import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ClipboardList, Plus, Check, Trash2, GripVertical, ChevronDown, ChevronUp, Settings } from "lucide-react";

// Plantillas predeterminadas de Snowtea (LI-FR-001 y LI-FR-002)
const PLANTILLAS_DEFAULT = [
  {
    nombre: "Limpieza Diaria (LI-FR-001)",
    tipo: "limpieza" as const,
    turno: "ambos" as const,
    items: [
      { id: "L1", descripcion: "Limpiar y desinfectar mesas y sillas", orden: 1, obligatorio: true },
      { id: "L2", descripcion: "Barrer y trapear el piso del área de clientes", orden: 2, obligatorio: true },
      { id: "L3", descripcion: "Limpiar y desinfectar la barra de trabajo", orden: 3, obligatorio: true },
      { id: "L4", descripcion: "Lavar y sanitizar licuadoras y utensilios", orden: 4, obligatorio: true },
      { id: "L5", descripcion: "Limpiar el área de caja y pantallas", orden: 5, obligatorio: true },
      { id: "L6", descripcion: "Vaciar y limpiar botes de basura", orden: 6, obligatorio: true },
      { id: "L7", descripcion: "Limpiar refrigerador y área de insumos", orden: 7, obligatorio: false },
      { id: "L8", descripcion: "Desinfectar baños (si aplica)", orden: 8, obligatorio: false },
    ],
  },
  {
    nombre: "Actividades Operativas (LI-FR-002)",
    tipo: "operativo" as const,
    turno: "ambos" as const,
    items: [
      { id: "O1", descripcion: "Verificar inventario de insumos críticos", orden: 1, obligatorio: true },
      { id: "O2", descripcion: "Preparar bases Snowtea para el turno", orden: 2, obligatorio: true },
      { id: "O3", descripcion: "Revisar y reponer toppings en barra fría", orden: 3, obligatorio: true },
      { id: "O4", descripcion: "Verificar temperatura de refrigeración", orden: 4, obligatorio: true },
      { id: "O5", descripcion: "Asignar roles del turno (Caja, Barra Caliente, Barra Fría, Runner)", orden: 5, obligatorio: true },
      { id: "O6", descripcion: "Realizar briefing de inicio de turno", orden: 6, obligatorio: true },
      { id: "O7", descripcion: "Verificar que el equipo tenga uniforme completo", orden: 7, obligatorio: false },
      { id: "O8", descripcion: "Registrar incidencias del turno anterior", orden: 8, obligatorio: false },
    ],
  },
  {
    nombre: "Apertura de Tienda",
    tipo: "apertura" as const,
    turno: "matutino" as const,
    items: [
      { id: "A1", descripcion: "Abrir tienda a las 10:00 AM", orden: 1, obligatorio: true },
      { id: "A2", descripcion: "Encender equipos y sistemas (POS, pantallas)", orden: 2, obligatorio: true },
      { id: "A3", descripcion: "Verificar fondo de caja", orden: 3, obligatorio: true },
      { id: "A4", descripcion: "Revisar pedido del día anterior y reabastecer", orden: 4, obligatorio: true },
      { id: "A5", descripcion: "Limpiar área de trabajo antes de abrir", orden: 5, obligatorio: true },
      { id: "A6", descripcion: "Colocar señalización y menú del día", orden: 6, obligatorio: false },
    ],
  },
  {
    nombre: "Cierre de Tienda",
    tipo: "cierre" as const,
    turno: "vespertino" as const,
    items: [
      { id: "C1", descripcion: "Realizar corte de caja y cuadrar con el sistema", orden: 1, obligatorio: true },
      { id: "C2", descripcion: "Guardar y refrigerar insumos sobrantes", orden: 2, obligatorio: true },
      { id: "C3", descripcion: "Limpiar a fondo barra caliente y fría", orden: 3, obligatorio: true },
      { id: "C4", descripcion: "Registrar mermas del día", orden: 4, obligatorio: true },
      { id: "C5", descripcion: "Apagar equipos y asegurar instalaciones", orden: 5, obligatorio: true },
      { id: "C6", descripcion: "Enviar reporte diario al administrador", orden: 6, obligatorio: true },
      { id: "C7", descripcion: "Registrar novedades en bitácora", orden: 7, obligatorio: false },
    ],
  },
];

const TIPO_LABELS: Record<string, string> = {
  limpieza: "Limpieza",
  operativo: "Operativo",
  apertura: "Apertura",
  cierre: "Cierre",
};

const TIPO_COLORS: Record<string, string> = {
  limpieza: "bg-green-100 text-green-800",
  operativo: "bg-blue-100 text-blue-800",
  apertura: "bg-yellow-100 text-yellow-800",
  cierre: "bg-red-100 text-red-800",
};

export default function Checklist() {
  const { user } = useAuth();
  const [sucursalId, setSucursalId] = useState<number | null>(null);
  const [plantillaId, setPlantillaId] = useState<number | null>(null);
  const [turno, setTurno] = useState<"matutino" | "vespertino">("matutino");
  const [fecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [observaciones, setObservaciones] = useState("");
  const [firmado, setFirmado] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const { data: sucursales = [] } = trpc.sucursales.list.useQuery();
  const { data: plantillas = [], refetch: refetchPlantillas } = trpc.checklistPlantillas.list.useQuery();
  const { data: historial = [] } = trpc.checklist.list.useQuery(
    { sucursalId: sucursalId ?? 0 },
    { enabled: !!sucursalId && historialOpen }
  );
  const utils = trpc.useUtils();

  const createPlantillaMut = trpc.checklistPlantillas.create.useMutation({
    onSuccess: () => { refetchPlantillas(); toast.success("Plantilla creada"); },
    onError: (e) => toast.error(e.message),
  });

  const saveMut = trpc.checklist.save.useMutation({
    onSuccess: () => {
      utils.checklist.list.invalidate();
      toast.success(firmado ? "Checklist firmado y guardado" : "Progreso guardado");
    },
    onError: (e) => toast.error(e.message),
  });

  const plantillaActual = plantillas.find(p => p.id === plantillaId);
  const items = (plantillaActual?.items as Array<{ id: string; descripcion: string; orden: number; obligatorio?: boolean }>) ?? [];
  const totalItems = items.length;
  const itemsOk = items.filter(i => checks[i.id]).length;
  const porcentaje = totalItems > 0 ? Math.round((itemsOk / totalItems) * 100) : 0;

  const canEdit = ["owner", "superadmin", "manager", "leader"].includes(user?.role ?? "");

  async function seedPlantillas() {
    for (const p of PLANTILLAS_DEFAULT) {
      await createPlantillaMut.mutateAsync(p);
    }
    setSeedDone(true);
    toast.success("Plantillas predeterminadas cargadas");
  }

  function handleCheck(itemId: string, val: boolean) {
    setChecks(prev => ({ ...prev, [itemId]: val }));
  }

  function handleGuardar(firmar = false) {
    if (!sucursalId || !plantillaId) { toast.error("Selecciona sucursal y plantilla"); return; }
    saveMut.mutate({
      plantillaId,
      sucursalId,
      liderNombre: user?.name ?? "",
      fecha: new Date(fecha).toISOString(),
      turno,
      itemsCompletados: checks,
      totalItems,
      itemsOk,
      porcentaje,
      observaciones,
      firmado: firmar,
    });
    if (firmar) setFirmado(true);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Checklist de Actividades</h1>
            <p className="text-sm text-muted-foreground">LI-FR-001 Limpieza · LI-FR-002 Operativo</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-1">
              <Settings className="w-3.5 h-3.5" /> Plantillas
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setHistorialOpen(!historialOpen)} className="gap-1">
            {historialOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Historial
          </Button>
        </div>
      </div>

      {/* Configuración */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Sucursal</Label>
              <Select value={sucursalId?.toString() ?? ""} onValueChange={v => { setSucursalId(Number(v)); setPlantillaId(null); setChecks({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent position="item-aligned">
                  {sucursales.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Plantilla</Label>
              <Select value={plantillaId?.toString() ?? ""} onValueChange={v => { setPlantillaId(Number(v)); setChecks({}); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent position="item-aligned">
                  {plantillas.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Turno</Label>
              <Select value={turno} onValueChange={v => setTurno(v as "matutino" | "vespertino")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="item-aligned">
                  <SelectItem value="matutino">Matutino (10am - 4pm)</SelectItem>
                  <SelectItem value="vespertino">Vespertino (4pm - 9:30pm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seed de plantillas si no hay ninguna */}
      {plantillas.length === 0 && canEdit && !seedDone && (
        <Card className="border-dashed border-green-300 bg-green-50/50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">No hay plantillas configuradas. ¿Cargar las plantillas predeterminadas de Snowtea?</p>
            <Button onClick={seedPlantillas} size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Cargar plantillas LI-FR-001 y LI-FR-002
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Checklist activo */}
      {plantillaActual && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{plantillaActual.nombre}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${TIPO_COLORS[plantillaActual.tipo]}`} variant="outline">
                    {TIPO_LABELS[plantillaActual.tipo]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{fecha} · {turno}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{porcentaje}%</div>
                <div className="text-xs text-muted-foreground">{itemsOk}/{totalItems} tareas</div>
              </div>
            </div>
            {/* Barra de progreso */}
            <div className="w-full bg-muted rounded-full h-2 mt-3">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.sort((a, b) => a.orden - b.orden).map(item => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  checks[item.id] ? "bg-green-50 border-green-200" : "bg-card hover:bg-muted/50"
                }`}
                onClick={() => handleCheck(item.id, !checks[item.id])}
              >
                <Checkbox
                  checked={!!checks[item.id]}
                  onCheckedChange={v => handleCheck(item.id, !!v)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className={`text-sm ${checks[item.id] ? "line-through text-muted-foreground" : ""}`}>
                    {item.descripcion}
                  </p>
                  {item.obligatorio && !checks[item.id] && (
                    <span className="text-xs text-orange-500">Obligatorio</span>
                  )}
                </div>
                {checks[item.id] && <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
              </div>
            ))}

            <div className="pt-3 border-t space-y-3">
              <div>
                <Label className="text-sm">Observaciones del turno</Label>
                <Textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Novedades, incidencias o comentarios del turno..."
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleGuardar(false)} disabled={saveMut.isPending}>
                  Guardar progreso
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleGuardar(true)}
                  disabled={saveMut.isPending || firmado}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4" />
                  {firmado ? "Firmado" : "Firmar y cerrar turno"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      {historialOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historial de checklists</CardTitle>
          </CardHeader>
          <CardContent>
            {historial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay registros aún</p>
            ) : (
              <div className="space-y-2">
                {historial.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                    <div>
                      <p className="font-medium">{new Date(r.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.turno} · {r.liderNombre}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${r.porcentaje! >= 80 ? "text-green-600" : r.porcentaje! >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                        {r.porcentaje}%
                      </span>
                      {r.firmado ? (
                        <Badge className="bg-green-100 text-green-800 text-xs" variant="outline">Firmado</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs" variant="outline">Borrador</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de configuración de plantillas */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Plantillas de Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {plantillas.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{p.nombre}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className={`text-xs ${TIPO_COLORS[p.tipo]}`} variant="outline">{TIPO_LABELS[p.tipo]}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{p.turno}</span>
                    <span className="text-xs text-muted-foreground">{(p.items as any[]).length} ítems</span>
                  </div>
                </div>
              </div>
            ))}
            {plantillas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No hay plantillas. Carga las predeterminadas.</p>
            )}
          </div>
          <DialogFooter>
            {plantillas.length === 0 && (
              <Button onClick={seedPlantillas} size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Cargar plantillas Snowtea
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
