import { getCalificacion, SECCIONES, TODOS_LOS_PUNTOS } from "../../../shared/evaluacionData";

/**
 * Genera y abre el PDF de una evaluación SECOF.
 * Puede usarse tanto desde el detalle como desde el listado de historial.
 *
 * @param ev  - Objeto evaluación (debe incluir respuestas si se quiere detalle de puntos fallidos)
 * @param sucursal - Objeto sucursal (puede ser null si no está disponible)
 */
export function exportEvaluacionPDF(
  ev: {
    id: number;
    fecha: Date | string;
    evaluadorNombre?: string | null;
    porcentajeGeneral?: number | null;
    puntosObtenidos?: number | null;
    puntosMaximos?: number | null;
    puntuacionPorCategoria?: unknown;
    puntuacionPorSeccion?: unknown;
    observacionesGenerales?: string | null;
    respuestas?: Array<{
      puntoId: string;
      respuesta: string;
      observacion?: string | null;
      fotoUrl?: string | null;
    }>;
  },
  sucursal?: {
    nombre?: string;
    ciudad?: string;
    estado?: string;
    franquiciado?: string;
  } | null
) {
  const calif = getCalificacion(ev.porcentajeGeneral ?? 0);
  const porCategoria = (ev.puntuacionPorCategoria as Record<string, { obtenidos: number; maximos: number }>) ?? {};
  const porSeccion = (ev.puntuacionPorSeccion as Record<string, { obtenidos: number; maximos: number; nombre: string }>) ?? {};

  const respuestasMap: Record<string, string> = {};
  for (const r of ev.respuestas ?? []) {
    respuestasMap[r.puntoId] = r.respuesta;
  }
  const puntosNoAprobados = TODOS_LOS_PUNTOS.filter(p => respuestasMap[p.id] === "no");

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
    .bar-wrap { background: #e5e7eb; border-radius: 4px; height: 10px; width: 100%; }
    .bar-fill { height: 10px; border-radius: 4px; }
    .cat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
    .cat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .cat-pct { font-size: 24px; font-weight: bold; }
    .mejora-card { border: 1px solid #fecaca; background: #fff7f7; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .mejora-title { font-weight: bold; color: #991b1b; font-size: 13px; }
    .mejora-items { margin-top: 6px; font-size: 12px; color: #374151; }
    .page-break { page-break-before: always; }
    @media print { body { margin: 0; } .page-break { page-break-before: always; } }
  </style>
</head>
<body>
  <h1>Evaluación SECOF — Sistema de Autoevaluación y Control de Franquicias</h1>
  <div class="header">
    <div>
      <p><strong>Sucursal:</strong> ${sucursal?.nombre ?? "N/A"}</p>
      <p><strong>Ciudad:</strong> ${sucursal?.ciudad ?? "N/A"}${sucursal?.estado ? `, ${sucursal.estado}` : ""}</p>
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

  <div class="cat-grid">
    ${Object.entries(porCategoria).filter(([, v]) => v.maximos > 0)
      .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
      .map(([cat, v]) => {
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
        return `<div style="border:1px solid #fecaca;background:#fff7f7;border-radius:8px;padding:12px;margin-bottom:8px;">
          <span style="font-weight:bold;color:#991b1b;font-size:13px">[${p.id}] ${p.descripcion}</span>
          <span style="margin-left:8px;background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:bold">${p.categoria}</span>
          <span style="margin-left:4px;color:#9ca3af;font-size:11px">${p.valor} pts</span>
          ${p.criterio ? `<div style="margin-top:6px;font-size:11px;color:#374151;"><strong>Criterio:</strong> ${p.criterio}</div>` : ''}
          ${obs ? `<div style="margin-top:4px;background:#fef9c3;border-left:3px solid #f59e0b;padding:4px 8px;font-size:11px;color:#78350f;border-radius:0 4px 4px 0"><strong>Observación:</strong> ${obs}</div>` : ''}
          ${fotoUrl ? `<div style="margin-top:4px"><img src="${fotoUrl}" style="max-width:200px;max-height:120px;border-radius:4px;border:1px solid #e5e7eb" /></div>` : ''}
        </div>`;
      }).join("")}

  <h2>Áreas de Mejora Prioritarias</h2>
  ${(() => {
    const catsSorted = Object.entries(porCategoria)
      .filter(([, v]) => v.maximos > 0 && (v.obtenidos / v.maximos) < 0.95)
      .sort((a, b) => (a[1].obtenidos / a[1].maximos) - (b[1].obtenidos / b[1].maximos))
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

  <p style="margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px">
    Sistema de Evaluación SECOF · Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
  </p>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}
