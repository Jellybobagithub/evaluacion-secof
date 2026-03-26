import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Calendar, User, Download, Target, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { getCalificacion, SECCIONES, TODOS_LOS_PUNTOS } from "../../../shared/evaluacionData";
import { toast } from "sonner";

export default function EvaluacionDetalle() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();

  const { data: evaluacion } = trpc.evaluaciones.getById.useQuery({ id });
  const { data: sucursal } = trpc.sucursales.getById.useQuery(
    { id: evaluacion?.sucursalId ?? 0 },
    { enabled: !!evaluacion?.sucursalId }
  );

  if (!evaluacion || evaluacion === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando evaluación...</p>
      </div>
    );
  }

  const ev = evaluacion;
  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
  const porCategoria = (ev.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
  const porSeccion = (ev.puntuacionPorSeccion as Record<string, { obtenidos: number; maximos: number; nombre: string }>) ?? {};

  // Radar data
  const radarData = Object.entries(porCategoria)
    .filter(([, v]) => v.maximos > 0)
    .map(([cat, v]) => ({
      categoria: cat,
      porcentaje: Math.round((v.obtenidos / v.maximos) * 100),
      fullMark: 100,
    }));

  // Bar data for sections
  const barData = SECCIONES.map(s => {
    const data = porSeccion[s.numero];
    const pct = data && data.maximos > 0 ? Math.round((data.obtenidos / data.maximos) * 100) : 0;
    return { nombre: `${s.numero}. ${s.nombre.split(" ").slice(0, 2).join(" ")}`, porcentaje: pct, color: getCalificacion(pct).color };
  });

  // Critical areas
  const criticalAreas = Object.entries(porCategoria)
    .filter(([, v]) => v.maximos > 0)
    .map(([cat, v]) => ({ cat, pct: (v.obtenidos / v.maximos) * 100, obtenidos: v.obtenidos, maximos: v.maximos }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  // Points that failed
  const respuestasMap: Record<string, string> = {};
  for (const r of ev.respuestas ?? []) {
    respuestasMap[r.puntoId] = r.respuesta;
  }
  const puntosNoAprobados = TODOS_LOS_PUNTOS.filter(p => respuestasMap[p.id] === "no");

  function handleExportPDF() {
    toast.info("Generando PDF...");
    // Build a printable version
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Evaluación SECOF - ${sucursal?.nombre ?? ""}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1a1a2e; }
    h1 { color: #1e3a5f; font-size: 22px; }
    h2 { color: #1e3a5f; font-size: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin-top: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .score-box { text-align: center; padding: 16px; border: 2px solid ${calif.color}; border-radius: 8px; }
    .score { font-size: 48px; font-weight: bold; color: ${calif.color}; }
    .label { font-size: 14px; color: ${calif.color}; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { background: #1e3a5f; color: white; padding: 8px; text-align: left; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .si { background: #dcfce7; color: #166534; }
    .no { background: #fee2e2; color: #991b1b; }
    .na { background: #f3f4f6; color: #6b7280; }
    .bar-wrap { background: #e5e7eb; border-radius: 4px; height: 10px; width: 100%; }
    .bar-fill { height: 10px; border-radius: 4px; }
    .cat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
    .cat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .cat-pct { font-size: 24px; font-weight: bold; }
    .obs-box { background: #fef9c3; border-left: 3px solid #f59e0b; padding: 6px 10px; margin-top: 4px; font-size: 11px; color: #78350f; border-radius: 0 4px 4px 0; }
    .mejora-card { border: 1px solid #fecaca; background: #fff7f7; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .mejora-title { font-weight: bold; color: #991b1b; font-size: 13px; }
    .mejora-items { margin-top: 6px; font-size: 12px; color: #374151; }
    .page-break { page-break-before: always; }
    @media print { body { margin: 0; } .page-break { page-break-before: always; } }
  </style>
</head>
<body>
  <h1>Evaluación SECOF - Sistema de Autoevaluación y Control de Franquicias</h1>
  <div class="header">
    <div>
      <p><strong>Sucursal:</strong> ${sucursal?.nombre ?? "N/A"}</p>
      <p><strong>Ciudad:</strong> ${sucursal?.ciudad ?? "N/A"} ${sucursal?.estado ? `, ${sucursal.estado}` : ""}</p>
      <p><strong>Franquiciado:</strong> ${sucursal?.franquiciado ?? "N/A"}</p>
      <p><strong>Evaluador:</strong> ${ev.evaluadorNombre ?? "N/A"}</p>
      <p><strong>Fecha:</strong> ${new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>
    </div>
    <div class="score-box">
      <div class="score">${(ev.porcentajeGeneral ?? 0).toFixed(1)}%</div>
      <div class="label">${calif.label}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:4px">${ev.puntosObtenidos ?? 0} / ${ev.puntosMaximos ?? 0} pts</div>
    </div>
  </div>

  <h2>Resultados por Categoría</h2>
  <table>
    <tr><th>Categoría</th><th>Puntos Obtenidos</th><th>Puntos Máximos</th><th>Porcentaje</th></tr>
    ${Object.entries(porCategoria).filter(([, v]) => v.maximos > 0).map(([cat, v]) => {
      const pct = ((v.obtenidos / v.maximos) * 100).toFixed(1);
      return `<tr><td>${cat}</td><td>${v.obtenidos}</td><td>${v.maximos}</td><td><strong>${pct}%</strong></td></tr>`;
    }).join("")}
  </table>

  <h2>Resultados por Sección</h2>
  <table>
    <tr><th>Sección</th><th>Puntos Obtenidos</th><th>Puntos Máximos</th><th>Porcentaje</th></tr>
    ${SECCIONES.map(s => {
      const d = porSeccion[s.numero];
      const pct = d && d.maximos > 0 ? ((d.obtenidos / d.maximos) * 100).toFixed(1) : "0.0";
      return `<tr><td>${s.numero}. ${s.nombre}</td><td>${d?.obtenidos ?? 0}</td><td>${d?.maximos ?? 0}</td><td><strong>${pct}%</strong></td></tr>`;
    }).join("")}
  </table>

  <div class="cat-grid">
    ${Object.entries(porCategoria).filter(([, v]) => v.maximos > 0).sort((a, b) => (a[1].obtenidos/a[1].maximos) - (b[1].obtenidos/b[1].maximos)).map(([cat, v]) => {
      const pct = Math.round((v.obtenidos / v.maximos) * 100);
      const color = pct >= 95 ? '#16a34a' : pct >= 90 ? '#2563eb' : pct >= 85 ? '#d97706' : pct >= 80 ? '#ea580c' : '#dc2626';
      return `<div class="cat-card"><div style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${cat}</div><div class="cat-pct" style="color:${color}">${pct}%</div><div style="font-size:11px;color:#9ca3af">${v.obtenidos}/${v.maximos} pts</div><div class="bar-wrap" style="margin-top:6px"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
    }).join("")}
  </div>

  <h2>Resultados por Sección</h2>
  <table>
    <tr><th>Sección</th><th>Obtenidos</th><th>Máximos</th><th>%</th><th>Estado</th></tr>
    ${SECCIONES.map(s => {
      const d = porSeccion[s.numero];
      const pct = d && d.maximos > 0 ? (d.obtenidos / d.maximos) * 100 : 0;
      const color = pct >= 95 ? '#16a34a' : pct >= 90 ? '#2563eb' : pct >= 85 ? '#d97706' : pct >= 80 ? '#ea580c' : '#dc2626';
      const label = pct >= 95 ? 'Excelente' : pct >= 90 ? 'Muy Bien' : pct >= 85 ? 'Bien' : pct >= 80 ? 'Regular' : pct >= 70 ? 'Área de Oportunidad' : 'Acción Inmediata';
      return `<tr><td>${s.numero}. ${s.nombre}</td><td>${d?.obtenidos ?? 0}</td><td>${d?.maximos ?? 0}</td><td><strong style="color:${color}">${pct.toFixed(1)}%</strong></td><td><span style="color:${color}">${label}</span></td></tr>`;
    }).join("")}
  </table>

  <div class="page-break"></div>
  <h2>Puntos No Aprobados (${puntosNoAprobados.length})</h2>
    ${puntosNoAprobados.length === 0
    ? '<p style="color:#16a34a;font-weight:bold">¡Todos los puntos evaluados fueron aprobados!</p>'
    : puntosNoAprobados.map(p => {
      const obs = (ev.respuestas ?? []).find(r => r.puntoId === p.id)?.observacion ?? "";
      const fotoUrl = (ev.respuestas ?? []).find(r => r.puntoId === p.id)?.fotoUrl ?? "";
      const color = '#dc2626';
      return `<div style="border:1px solid #fecaca;background:#fff7f7;border-radius:8px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1">
            <span style="font-weight:bold;color:#991b1b;font-size:13px">[${p.id}] ${p.descripcion}</span>
            <span style="margin-left:8px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:bold">${p.categoria}</span>
            <span style="margin-left:4px;color:#9ca3af;font-size:11px">${p.valor} pts</span>
          </div>
        </div>
        ${p.criterio ? `<div style="margin-top:6px;font-size:11px;color:#374151;"><strong>Criterio:</strong> ${p.criterio}</div>` : ''}
        ${obs ? `<div style="margin-top:4px;background:#fef9c3;border-left:3px solid #f59e0b;padding:4px 8px;font-size:11px;color:#78350f;border-radius:0 4px 4px 0"><strong>Observación:</strong> ${obs}</div>` : ''}
        ${fotoUrl ? `<div style="margin-top:4px"><img src="${fotoUrl}" style="max-width:200px;max-height:120px;border-radius:4px;border:1px solid #e5e7eb" /></div>` : ''}
      </div>`;
    }).join("")}

  <h2>Áreas de Mejora Prioritarias</h2>
  ${(() => {
    const catsSorted = Object.entries(porCategoria)
      .filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.95)
      .sort((a, b) => (a[1].obtenidos/a[1].maximos) - (b[1].obtenidos/b[1].maximos))
      .slice(0, 4);
    if (catsSorted.length === 0) return '<p style="color:#16a34a">No se identificaron áreas críticas de mejora.</p>';
    return catsSorted.map(([cat, v]) => {
      const pct = Math.round((v.obtenidos / v.maximos) * 100);
      const puntosFallidos = puntosNoAprobados.filter(p => p.categoria === cat).slice(0, 5);
      const color = pct >= 85 ? '#d97706' : pct >= 70 ? '#ea580c' : '#dc2626';
      return `<div class="mejora-card"><div class="mejora-title" style="color:${color}">${cat} — ${pct}% (${v.obtenidos}/${v.maximos} pts)</div><div class="mejora-items"><strong>Puntos a atender:</strong><ul>${puntosFallidos.map(p => `<li>[${p.id}] ${p.descripcion}</li>`).join("")}</ul></div></div>`;
    }).join("");
  })()}

  ${ev.observacionesGenerales ? `<h2>Observaciones Generales</h2><p style="background:#f0f9ff;border-left:3px solid #3b82f6;padding:10px;border-radius:0 6px 6px 0">${ev.observacionesGenerales}</p>` : ""}

  <p style="margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px">Sistema de Evaluación SECOF · Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/historial")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Resultado de Evaluación</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {sucursal && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{sucursal.nombre}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(ev.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</span>
              {ev.evaluadorNombre && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{ev.evaluadorNombre}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Score hero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 border-0 shadow-sm" style={{ borderLeft: `4px solid ${calif.color}` }}>
          <CardContent className="p-5 text-center">
            <p className="text-5xl font-bold" style={{ color: calif.color }}>{(ev.porcentajeGeneral ?? 0).toFixed(1)}%</p>
            <p className="font-semibold mt-1" style={{ color: calif.color }}>{calif.label}</p>
            <p className="text-sm text-muted-foreground mt-2">{ev.puntosObtenidos ?? 0} / {ev.puntosMaximos ?? 0} pts</p>
          </CardContent>
        </Card>

        {criticalAreas.map(area => (
          <Card key={area.cat} className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-muted-foreground">{area.cat}</p>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold" style={{ color: getCalificacion(area.pct).color }}>{area.pct.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1">{area.obtenidos}/{area.maximos} pts · {getCalificacion(area.pct).label}</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${area.pct}%`, backgroundColor: getCalificacion(area.pct).color }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="categorias">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="categorias">Por Categoría</TabsTrigger>
          <TabsTrigger value="secciones">Por Sección</TabsTrigger>
          <TabsTrigger value="detalle">Puntos Fallidos</TabsTrigger>
          <TabsTrigger value="mejoras">Áreas de Mejora</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Radar por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Radar name="Porcentaje" dataKey="porcentaje" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalle por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(porCategoria)
                    .filter(([, v]) => v.maximos > 0)
                    .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
                    .map(([cat, v]) => {
                      const pct = (v.obtenidos / v.maximos) * 100;
                      const c = getCalificacion(pct);
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm font-medium w-28 shrink-0">{cat}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                          </div>
                          <span className="text-sm font-bold w-12 text-right" style={{ color: c.color }}>{pct.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground w-16 text-right">{v.obtenidos}/{v.maximos}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="secciones" className="mt-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultados por Sección</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} layout="vertical" margin={{ left: 120, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Porcentaje"]} />
                  <Bar dataKey="porcentaje" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalle" className="mt-4">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Puntos No Aprobados ({puntosNoAprobados.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {puntosNoAprobados.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-semibold">¡Todos los puntos aprobados!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {puntosNoAprobados.map(p => {
                    const seccion = SECCIONES.find(s => s.numero === p.seccion);
                    const resp = ev.respuestas?.find(r => r.puntoId === p.id);
                    return (
                      <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-100 bg-red-50/30">
                        <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5 w-8">{p.id}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p.descripcion}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{seccion?.nombre}</p>
                          {resp?.observacion && <p className="text-xs text-muted-foreground mt-1 italic">"{resp.observacion}"</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-xs text-red-600 border-red-200">{p.categoria}</Badge>
                          <Badge variant="secondary" className="text-xs">{p.valor} pts</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mejoras" className="mt-4">
          <div className="space-y-4">
            {Object.entries(porCategoria)
              .filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.85)
              .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
              .map(([cat, v]) => {
                const pct = (v.obtenidos / v.maximos) * 100;
                const c = getCalificacion(pct);
                const puntosCategoria = puntosNoAprobados.filter(p => p.categoria === cat);
                return (
                  <Card key={cat} className="border-0 shadow-sm bg-white">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" style={{ color: c.color }} />
                          <h3 className="font-semibold">{cat}</h3>
                          <Badge variant="outline" style={{ color: c.color, borderColor: c.color }}>{pct.toFixed(1)}% · {c.label}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">{v.obtenidos}/{v.maximos} pts</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                      {puntosCategoria.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Puntos a mejorar:</p>
                          <ul className="space-y-1">
                            {puntosCategoria.slice(0, 5).map(p => (
                              <li key={p.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-red-400 shrink-0">•</span>
                                <span><strong>{p.id}</strong>: {p.descripcion}</span>
                              </li>
                            ))}
                            {puntosCategoria.length > 5 && (
                              <li className="text-xs text-muted-foreground">+{puntosCategoria.length - 5} más...</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            {Object.entries(porCategoria).filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.85).length === 0 && (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="flex flex-col items-center py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                  <p className="font-semibold">¡Excelente desempeño!</p>
                  <p className="text-sm text-muted-foreground mt-1">Todas las categorías superan el 85%</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan de acción CTA */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">¿Listo para mejorar?</h3>
            <p className="text-blue-100 text-sm mt-1">Crea un plan de acción para las áreas identificadas</p>
          </div>
          <Button variant="secondary" onClick={() => setLocation(`/plan-accion?evaluacionId=${id}&sucursalId=${ev.sucursalId}`)}>
            Crear Plan de Acción
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
