import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface ReporteDiarioData {
  sucursalNombre: string;
  fecha: string;
  ventasTotales: number;
  meta: number;
  porcentajeMeta: number;
  topProductos: { nombre: string; cantidad: number; total: number }[];
  ventasAyer: number;
  ventasMismoDiaSemanaPasada: number;
  tickets: number;
}

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function colorMeta(pct: number) {
  if (pct >= 100) return "#16a34a";
  if (pct >= 80)  return "#d97706";
  return "#dc2626";
}

function barMeta(pct: number) {
  const fill = Math.min(pct, 100);
  const color = colorMeta(pct);
  return `<div style="background:#e5e7eb;border-radius:6px;height:12px;width:100%;margin:6px 0">
    <div style="background:${color};width:${fill}%;height:12px;border-radius:6px"></div>
  </div>`;
}

export function buildReporteHtml(data: ReporteDiarioData[]): string {
  const fecha = data[0]?.fecha ?? new Date().toISOString().split("T")[0];
  const [y, m, d] = fecha.split("-");
  const fechaTexto = `${d}/${m}/${y}`;

  const bloques = data.map(s => {
    const pct = Math.round(s.porcentajeMeta);
    const delta = s.ventasMismoDiaSemanaPasada > 0
      ? Math.round(((s.ventasTotales - s.ventasMismoDiaSemanaPasada) / s.ventasMismoDiaSemanaPasada) * 100)
      : null;
    const deltaStr = delta !== null
      ? `<span style="color:${delta >= 0 ? "#16a34a" : "#dc2626"};font-weight:600">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs semana pasada</span>`
      : "";

    const topRows = s.topProductos.slice(0, 5).map((p, i) =>
      `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:6px 8px;color:#6b7280">${i + 1}</td>
        <td style="padding:6px 8px;font-size:13px">${p.nombre}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:500">${p.cantidad} uds</td>
        <td style="padding:6px 8px;text-align:right;color:#16a34a;font-weight:500">${formatMXN(p.total)}</td>
      </tr>`
    ).join("");

    return `
    <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
      <h2 style="margin:0 0 4px;font-size:18px;color:#111827">${s.sucursalNombre}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Meta mensual: ${formatMXN(s.meta)}</p>

      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;background:#f0fdf4;border-radius:8px;padding:14px">
          <div style="font-size:11px;color:#16a34a;font-weight:600;text-transform:uppercase;margin-bottom:4px">Ventas del día</div>
          <div style="font-size:24px;font-weight:700;color:#111827">${formatMXN(s.ventasTotales)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${s.tickets} tickets · ${deltaStr}</div>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;margin-bottom:4px">Avance meta</div>
          <div style="font-size:24px;font-weight:700;color:${colorMeta(pct)}">${pct}%</div>
          ${barMeta(pct)}
        </div>
      </div>

      <h3 style="margin:0 0 8px;font-size:14px;color:#374151">Top 5 productos</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:6px 8px;text-align:left;color:#9ca3af;font-weight:500">#</th>
            <th style="padding:6px 8px;text-align:left;color:#9ca3af;font-weight:500">Producto</th>
            <th style="padding:6px 8px;text-align:right;color:#9ca3af;font-weight:500">Uds</th>
            <th style="padding:6px 8px;text-align:right;color:#9ca3af;font-weight:500">Total</th>
          </tr>
        </thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="margin:0;font-size:22px;color:#111827">📊 Reporte Diario Snowtea</h1>
      <p style="margin:4px 0 0;color:#6b7280;font-size:14px">${fechaTexto}</p>
    </div>
    ${bloques}
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:8px">
      Generado automáticamente por SECOF · secof.snowteatienda.com
    </p>
  </div>
</body></html>`;
}

export async function enviarReporteDiario(data: ReporteDiarioData[]): Promise<void> {
  const emails = (process.env.REPORT_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
  if (!emails.length) throw new Error("No hay destinatarios configurados");

  const fecha = data[0]?.fecha ?? new Date().toISOString().split("T")[0];
  const [y, m, d] = fecha.split("-");

  await transporter.sendMail({
    from: `"SECOF Snowtea" <${process.env.SMTP_FROM}>`,
    to: emails.join(", "),
    subject: `📊 Ventas ${d}/${m}/${y} — ${data.map(s => `${s.sucursalNombre}: ${formatMXN(s.ventasTotales)}`).join(" | ")}`,
    html: buildReporteHtml(data),
  });
}
