/**
 * Scheduler de tareas automáticas del sistema.
 * Se inicializa una vez al arrancar el servidor.
 *
 * Tareas programadas:
 * - Reporte semanal:       lunes a las 8:00 AM
 * - Alerta reportes:       cada día a las 10:00 PM (detecta tiendas sin reporte del día)
 * - Alerta mermas/caja:    cada día a las 11:00 PM (detecta reportes con mermas >3% o descuadre)
 */

import { notifyOwner } from "./_core/notification";

let schedulerInitialized = false;

// ─── Resumen Semanal ──────────────────────────────────────────────────────────
async function enviarResumenSemanal() {
  try {
    const { getReportesDiarios, getSucursales, getEvaluaciones } = await import("./db");
    const [todos, sucursales, evaluaciones] = await Promise.all([
      getReportesDiarios(undefined, undefined, 1000),
      getSucursales(),
      getEvaluaciones(),
    ]);

    const ahora = new Date();
    const hace7 = new Date();
    hace7.setDate(ahora.getDate() - 7);

    const recientes = todos.filter(
      (r) => new Date(r.fecha) >= hace7 && r.estado === "enviado"
    );
    const totalVentas = recientes.reduce((s, r) => s + (r.ventasTotales ?? 0), 0);
    const totalEfectivo = recientes.reduce((s, r) => s + ((r as any).ventasEfectivo ?? 0), 0);
    const totalTarjeta = recientes.reduce((s, r) => s + ((r as any).ventasTarjeta ?? 0), 0);
    const totalRappi = recientes.reduce((s, r) => s + ((r as any).ventasRappi ?? 0), 0);
    const activasSuc = sucursales.filter((s) => s.activa);
    const conReporte = new Set(recientes.map((r) => r.sucursalId));
    const sinReporte = activasSuc.filter((s) => !conReporte.has(s.id));

    const evsRecientes = evaluaciones.filter(
      (e) => e.estado === "completada" && new Date(e.fecha) >= hace7
    );
    const avgSecof =
      evsRecientes.length > 0
        ? evsRecientes.reduce((s, e) => s + (e.porcentajeGeneral ?? 0), 0) /
          evsRecientes.length
        : null;

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const reportesMes = todos.filter(
      (r) => new Date(r.fecha) >= inicioMes && r.estado === "enviado"
    );
    const ventasPorSucursal: Record<number, number> = {};
    reportesMes.forEach((r) => {
      ventasPorSucursal[r.sucursalId] =
        (ventasPorSucursal[r.sucursalId] ?? 0) + (r.ventasTotales ?? 0);
    });

    const lineasMeta: string[] = [];
    for (const s of activasSuc) {
      const meta = (s as any).metaVentasMensual ?? 0;
      if (meta > 0) {
        const ventas = ventasPorSucursal[s.id] ?? 0;
        const pct = ((ventas / meta) * 100).toFixed(1);
        const emoji = parseFloat(pct) >= 90 ? "✅" : parseFloat(pct) >= 60 ? "⚠️" : "🔴";
        lineasMeta.push(`  ${emoji} ${s.nombre}: ${pct}% ($${ventas.toLocaleString("es-MX")} / $${meta.toLocaleString("es-MX")})`);
      }
    }

    // Mermas de la semana
    const totalMermas = recientes.reduce((s, r) => s + ((r as any).mermasMonto ?? 0), 0);
    const pctMermas = totalVentas > 0 ? ((totalMermas / totalVentas) * 100).toFixed(2) : "0.00";
    const diasConMermasAltas = recientes.filter(
      (r) => (r as any).mermasMonto > 0 && (r.ventasTotales ?? 0) > 0 &&
        ((r as any).mermasMonto / (r.ventasTotales ?? 1)) * 100 > 3
    ).length;

    // Descuadres de la semana
    const descuadres = recientes.filter(
      (r) => (r as any).diferenciaCaja && Math.abs((r as any).diferenciaCaja) > 0
    );
    const totalDescuadre = descuadres.reduce((s, r) => s + Math.abs((r as any).diferenciaCaja ?? 0), 0);

    const fechaInicio = hace7.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
    const fechaFin = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

    const lineas = [
      `📊 RESUMEN SEMANAL AUTOMÁTICO`,
      `Período: ${fechaInicio} al ${fechaFin}`,
      ``,
      `💰 VENTAS DE LA SEMANA`,
      `  Total: $${totalVentas.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Efectivo: $${totalEfectivo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Tarjeta: $${totalTarjeta.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Rappi: $${totalRappi.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      `  Reportes enviados: ${recientes.length}`,
      ``,
      `📋 EVALUACIONES SECOF`,
      `  Evaluaciones esta semana: ${evsRecientes.length}`,
      `  Promedio general: ${avgSecof !== null ? avgSecof.toFixed(1) + "%" : "Sin datos"}`,
      ``,
      `📦 MERMAS`,
      `  Total mermas: $${totalMermas.toLocaleString("es-MX", { minimumFractionDigits: 2 })} (${pctMermas}% de ventas)`,
      diasConMermasAltas > 0
        ? `  ⚠️ ${diasConMermasAltas} días con mermas >3%`
        : `  ✅ Mermas dentro del rango (≤3%)`,
      ``,
      `💳 DESCUADRES DE CAJA`,
      descuadres.length > 0
        ? `  ⚠️ ${descuadres.length} reportes con descuadre · Total: $${totalDescuadre.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
        : `  ✅ Sin descuadres esta semana`,
      ``,
      `🏪 TIENDAS ACTIVAS: ${activasSuc.length}`,
      sinReporte.length > 0
        ? `  ⚠️ Sin reporte (7 días): ${sinReporte.map((s) => s.nombre).join(", ")}`
        : `  ✅ Todas las tiendas reportaron esta semana`,
      ...(lineasMeta.length > 0
        ? [``, `🎯 AVANCE VS META (mes actual)`, ...lineasMeta]
        : []),
    ];

    await notifyOwner({
      title: `Resumen Semanal — ${fechaFin}`,
      content: lineas.join("\n"),
    });

    console.log(`[Scheduler] Resumen semanal enviado: ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[Scheduler] Error al enviar resumen semanal:", err);
  }
}

// ─── Alerta diaria: tiendas sin reporte ──────────────────────────────────────
async function alertaReportesTardios() {
  try {
    const { getReportesDiarios, getSucursales } = await import("./db");
    const [todos, sucursales] = await Promise.all([
      getReportesDiarios(undefined, undefined, 500),
      getSucursales(),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const reportesHoy = todos.filter((r) => {
      const fechaStr = String(r.fecha).slice(0, 10);
      return fechaStr === hoy && r.estado === "enviado";
    });
    const conReporteHoy = new Set(reportesHoy.map((r) => r.sucursalId));
    const activasSuc = sucursales.filter((s) => s.activa);
    const sinReporteHoy = activasSuc.filter((s) => !conReporteHoy.has(s.id));

    if (sinReporteHoy.length === 0) {
      console.log(`[Scheduler] Alerta reportes: todas las tiendas reportaron hoy (${hoy})`);
      return;
    }

    const nombres = sinReporteHoy.map((s) => `• ${s.nombre}`).join("\n");
    await notifyOwner({
      title: `⚠️ ${sinReporteHoy.length} tienda(s) sin reporte hoy`,
      content: `Las siguientes tiendas no han enviado su reporte diario del ${hoy}:\n\n${nombres}\n\nRecuerda que el cumplimiento de reportes es un KPI de Nivel 2.`,
    });

    console.log(`[Scheduler] Alerta reportes tardíos enviada: ${sinReporteHoy.length} tiendas`);
  } catch (err) {
    console.error("[Scheduler] Error en alerta de reportes tardíos:", err);
  }
}

// ─── Alerta diaria: mermas altas y descuadres de caja ────────────────────────
async function alertaMermasYDescuadres() {
  try {
    const { getReportesDiarios, getSucursales } = await import("./db");
    const [todos, sucursales] = await Promise.all([
      getReportesDiarios(undefined, undefined, 500),
      getSucursales(),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const reportesHoy = todos.filter((r) => {
      const fechaStr = String(r.fecha).slice(0, 10);
      return fechaStr === hoy && r.estado === "enviado";
    });

    const alertas: string[] = [];

    for (const r of reportesHoy) {
      const suc = sucursales.find((s) => s.id === r.sucursalId);
      const nombre = suc?.nombre ?? `Sucursal #${r.sucursalId}`;

      // Mermas altas (>3% de ventas)
      const mermas = (r as any).mermasMonto ?? 0;
      const ventasHoy = r.ventasTotales ?? 0;
      if (mermas > 0 && ventasHoy > 0) {
        const pctMermas = (mermas / ventasHoy) * 100;
        if (pctMermas > 3) {
          alertas.push(`📦 ${nombre}: Mermas ${pctMermas.toFixed(1)}% ($${mermas.toLocaleString("es-MX")}) — Meta ≤3%`);
        }
      }

      // Descuadre de caja significativo (>$50)
      const diferencia = (r as any).diferenciaCaja ?? 0;
      if (Math.abs(diferencia) > 50) {
        const signo = diferencia > 0 ? "+" : "";
        alertas.push(`💳 ${nombre}: Descuadre de caja ${signo}$${diferencia.toFixed(2)}`);
      }
    }

    if (alertas.length === 0) {
      console.log(`[Scheduler] Alerta mermas/caja: sin incidencias hoy (${hoy})`);
      return;
    }

    await notifyOwner({
      title: `🚨 ${alertas.length} incidencia(s) operativas hoy`,
      content: `Se detectaron las siguientes incidencias en los reportes del ${hoy}:\n\n${alertas.join("\n")}\n\nRevisa el detalle en el sistema.`,
    });

    console.log(`[Scheduler] Alerta mermas/descuadres enviada: ${alertas.length} incidencias`);
  } catch (err) {
    console.error("[Scheduler] Error en alerta de mermas/descuadres:", err);
  }
}

// ─── Cálculo Nocturno de Nómina ─────────────────────────────────────────────────────────────────────
async function calcularNominaAutomatica() {
  try {
    const { getDb, calcularRegistrosNomina } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const { sucursales } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const todasSucursales = await db.select({ id: sucursales.id, nombre: sucursales.nombre })
      .from(sucursales).where(eq(sucursales.activa, true));
    const hoy = new Date().toISOString().split("T")[0];
    // Calcular la semana actual (lunes a hoy)
    const d = new Date();
    const diaSemana = d.getDay(); // 0=dom, 1=lun...
    const diasDesdelunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - diasDesdelunes);
    const fechaInicio = lunes.toISOString().split("T")[0];
    let totalRegistros = 0;
    for (const suc of todasSucursales) {
      const regs = await calcularRegistrosNomina(suc.id, fechaInicio, hoy);
      totalRegistros += regs.length;
    }
    console.log(`[Scheduler] Nómina automática calculada: ${totalRegistros} registros en ${todasSucursales.length} sucursales (${fechaInicio} → ${hoy})`);
  } catch (err) {
    console.error("[Scheduler] Error en cálculo nocturno de nómina:", err);
  }
}

// ─── Alertas de Retardos y Ausencias ────────────────────────────────────────────────────────────────
async function alertaRetardosYAusencias() {
  try {
    const { getDb, getResumenNominaSemanal } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const { sucursales, userSucursales, users } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const todasSucursales = await db.select({ id: sucursales.id, nombre: sucursales.nombre })
      .from(sucursales).where(eq(sucursales.activa, true));
    // Calcular semana actual
    const d = new Date();
    const diaSemana = d.getDay();
    const diasDesdelunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - diasDesdelunes);
    const fechaInicio = lunes.toISOString().split("T")[0];
    const hoy = d.toISOString().split("T")[0];
    const UMBRAL_RETARDOS = 3;
    const UMBRAL_AUSENCIAS = 2;
    for (const suc of todasSucursales) {
      const resumen = await getResumenNominaSemanal(suc.id, fechaInicio, hoy);
      const alertasEmp: string[] = [];
      for (const emp of resumen) {
        if (emp.retardos >= UMBRAL_RETARDOS) {
          alertasEmp.push(`⏰ ${emp.empleadoNombre}: ${emp.retardos} retardos esta semana`);
        }
        if (emp.diasAusente >= UMBRAL_AUSENCIAS) {
          alertasEmp.push(`🚫 ${emp.empleadoNombre}: ${emp.diasAusente} ausencias injustificadas esta semana`);
        }
      }
      if (alertasEmp.length > 0) {
        // Notificar a los líderes asignados a esta sucursal
        const lideresAsignados = await db.select({ userId: userSucursales.userId })
          .from(userSucursales)
          .where(eq(userSucursales.sucursalId, suc.id));
        const userIds = lideresAsignados.map(l => l.userId);
        if (userIds.length > 0) {
          const lideres = await db.select({ id: users.id, email: users.email, name: users.name })
            .from(users)
            .where(eq(users.role, 'leader'));
          const lideresEnSucursal = lideres.filter(l => userIds.includes(l.id));
          console.log(`[Scheduler] Alertas asistencia ${suc.nombre}: ${alertasEmp.length} empleados con incidencias. Líderes: ${lideresEnSucursal.length}`);
        }
        // Notificar al dueño
        await notifyOwner({
          title: `⚠️ Incidencias de asistencia — ${suc.nombre}`,
          content: `Se detectaron las siguientes incidencias de asistencia en la semana (${fechaInicio} al ${hoy}):\n\n${alertasEmp.join("\n")}\n\nRevisa el módulo Control de Asistencias para tomar acción o justificar ausencias.`,
        });
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error en alertas de retardos/ausencias:", err);
  }
}


// ─── Auto-cierre de turnos sin salida ────────────────────────────────────────
async function autoCierreTurnos() {
  try {
    const { getDb } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;

    // Ayer en hora México (UTC-6)
    const ahora = new Date();
    const ayerMX = new Date(ahora.getTime() - 6 * 3600000);
    ayerMX.setDate(ayerMX.getDate() - 1);
    const fechaAyer = ayerMX.toISOString().split("T")[0];

    // Rango timestamp: ayer 12:00 MX → hoy 12:00 MX (cubre turnos nocturnos)
    const inicioMs = new Date(fechaAyer + "T18:00:00Z").getTime(); // 12:00 MX
    const finMs    = inicioMs + 24 * 3600000;

    // Sucursales activas
    const sucsR = await db.execute(sql`SELECT id, nombre FROM sucursales WHERE activa=1`);
    const sucursales = sucsR[0] as any[];

    for (const suc of sucursales) {
      // Empleados con entrada ayer pero sin salida posterior
      const abiertosR = await db.execute(sql`
        SELECT DISTINCT a.empleadoId, e.nombre, e.apellido
        FROM asistencia a
        JOIN empleados e ON e.id = a.empleadoId
        WHERE a.sucursalId = ${suc.id}
          AND a.tipo = 'entrada'
          AND a.timestamp >= ${inicioMs}
          AND a.timestamp < ${finMs}
          AND NOT EXISTS (
            SELECT 1 FROM asistencia s
            WHERE s.empleadoId = a.empleadoId
              AND s.sucursalId = a.sucursalId
              AND s.tipo = 'salida'
              AND s.timestamp > a.timestamp
              AND s.timestamp < ${finMs + 6 * 3600000}
          )
      `);
      const abiertos = abiertosR[0] as any[];
      if (!abiertos.length) continue;

      const alertas: string[] = [];

      for (const emp of abiertos) {
        // Buscar horaFin en turnos_semana
        const turnoR = await db.execute(sql`
          SELECT horaFin FROM turnos_semana
          WHERE empleadoId = ${emp.empleadoId}
            AND sucursalId = ${suc.id}
            AND fecha = ${fechaAyer}
          LIMIT 1
        `);
        const turno = (turnoR[0] as any[])[0];
        const horaFin = turno?.horaFin ?? "03:00"; // default cierre tienda

        // Construir timestamp de salida
        const [hh, mm] = horaFin.split(":").map(Number);
        const salidaDate = new Date(fechaAyer + "T00:00:00-06:00");
        salidaDate.setHours(hh, mm, 0, 0);
        // Si horaFin < 12 asumimos que es madrugada del día siguiente
        if (hh < 12) salidaDate.setDate(salidaDate.getDate() + 1);
        const salidaMs = salidaDate.getTime();

        // Insertar salida automática
        await db.execute(sql`
          INSERT INTO asistencia (empleadoId, sucursalId, tipo, subtipo, timestamp, metodo, notas)
          VALUES (
            ${emp.empleadoId}, ${suc.id}, 'salida', 'salida_turno',
            ${salidaMs}, 'manual',
            ${`Auto-cierre sistema — ${fechaAyer} — no se registró salida. Hora programada: ${horaFin}`}
          )
        `);

        alertas.push(`👤 ${emp.nombre} ${emp.apellido ?? ""} — cierre automático a las ${horaFin}`);
        console.log(`[AutoCierre] ${suc.nombre} | ${emp.nombre}: salida insertada a las ${horaFin}`);
      }

      // Enviar alerta por email a líderes y administradores
      if (alertas.length > 0) {
        try {
          const { enviarReporteDiario } = await import("./services/emailService");
          const destinatariosR = await db.execute(sql`
            SELECT DISTINCT u.email, u.name
            FROM users u
            JOIN user_sucursales us ON us.userId = u.id
            WHERE us.sucursalId = ${suc.id}
              AND u.role IN ('leader','manager','owner','superadmin')
              AND u.email IS NOT NULL
          `);
          const emails = (destinatariosR[0] as any[]).map((r: any) => r.email).filter(Boolean);

          const transporter = (await import("nodemailer")).default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });

          if (emails.length > 0) {
            await transporter.sendMail({
              from: process.env.SMTP_USER,
              to: emails.join(", "),
              subject: `⚠️ Auto-cierre de turnos — ${suc.nombre} — ${fechaAyer}`,
              text: [
                `SECOF detectó empleados que no registraron su salida el ${fechaAyer}.`,
                `Se realizó cierre automático con la hora programada de cada turno:`,
                ``,
                ...alertas,
                ``,
                `Por favor verifica en Control de Asistencias si la hora es correcta y ajusta si es necesario.`,
              ].join("\n"),
            });
            console.log(`[AutoCierre] Email enviado a: ${emails.join(", ")}`);
          }
        } catch (emailErr) {
          console.warn("[AutoCierre] Error enviando email:", emailErr);
        }

        // Notificación push al dueño
        try {
          await notifyOwner({
            title: `⚠️ Auto-cierre turnos — ${suc.nombre}`,
            content: `${alertas.length} empleado(s) sin salida el ${fechaAyer}. Se cerró automáticamente:\n\n${alertas.join("\n")}`,
          });
        } catch {}
      }
    }
  } catch (err) {
    console.error("[AutoCierre] Error:", err);
  }
}

export function initScheduler() {
  // ── Sync nocturno Odoo + reporte diario por correo (03:30 UTC = 21:30 MX) ─
  const ahora = new Date();
  const horasParaSync = (() => {
    const target = new Date();
    target.setUTCHours(3, 30, 0, 0);
    if (target <= ahora) target.setDate(target.getDate() + 1);
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function syncNocturno() {
    try {
      const { syncVentasDia } = await import("./services/syncService");
      const mxNow = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const fecha = mxNow.toISOString().split("T")[0]; // fecha México CDT (UTC-6)
      console.log(`[Scheduler] Iniciando sync nocturno Odoo para ${fecha}...`);
      await syncVentasDia(fecha);
      console.log(`[Scheduler] Sync nocturno completado.`);
    } catch (e) {
      console.error("[Scheduler] Error en sync nocturno:", e);
    }
    // Repetir cada 24h
    setTimeout(syncNocturno, 24 * 60 * 60 * 1000);
  }, horasParaSync * 3600000);


  // ── Auto-meta mensual: actualiza metaVentasMensual el 1ro de cada mes ────
  const horasParaMeta = (() => {
    const ahora = new Date();
    const target = new Date(ahora.getFullYear(), ahora.getMonth()+1, 1, 6, 0, 0); // 1ro del mes siguiente a las 6am
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function actualizarMeta() {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      const ahora = new Date();
      const anio = ahora.getFullYear();
      const mes  = ahora.getMonth() + 1;

      // Buscar meta precalculada
      const rows = await db.execute(sql`
        SELECT meta FROM metas_mensuales
        WHERE sucursalId = 30001 AND anio = ${anio} AND mes = ${mes}
      `);
      const metaRows = rows[0] as any[];

      let meta: number;
      if (metaRows.length > 0) {
        meta = metaRows[0].meta;
      } else {
        // Calcular: mismo mes año anterior + 3%
        const mesStr = String(mes).padStart(2,'0');
        const inicioAnt = `\${anio-1}-\${mesStr}-01`;
        const finAnt    = `\${anio-1}-\${mesStr}-\${new Date(anio-1, mes, 0).getDate()}`;
        const ventasRows = await db.execute(sql`
          SELECT COALESCE(SUM(ventasTotales),0) as total
          FROM reportes_diarios WHERE sucursalId=30001 AND fecha>=\${inicioAnt} AND fecha<=\${finAnt}
        `);
        const totalAnt = Number((ventasRows[0] as any[])[0]?.total ?? 0);
        meta = totalAnt > 0 ? Math.round(totalAnt * 1.03) : 135000;

        await db.execute(sql`
          INSERT INTO metas_mensuales (sucursalId, anio, mes, meta, baseAnterior)
          VALUES (30001, \${anio}, \${mes}, \${meta}, \${totalAnt})
          ON DUPLICATE KEY UPDATE meta=\${meta}
        `);
      }

      await db.execute(sql`UPDATE sucursales SET metaVentasMensual=\${meta} WHERE id=30001`);
      console.log(`[Scheduler] Meta Plaza Patio \${mes}/\${anio} actualizada: $\${meta.toFixed(0)} MXN`);
    } catch(e) {
      console.error('[Scheduler] Error auto-meta:', e);
    }
    setTimeout(actualizarMeta, 30 * 24 * 60 * 60 * 1000); // repetir cada 30 días aprox
  }, horasParaMeta * 3600000);


  // ── Alerta planes de acción vencidos (9:00 AM diario) ───────────────────
  const horasParaPlanes = (() => {
    const ahora = new Date();
    const target = new Date();
    target.setHours(9, 0, 0, 0);
    if (target <= ahora) target.setDate(target.getDate() + 1);
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function alertaPlanes() {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      const hoy = new Date().toISOString().split("T")[0];
      const vencidos = await db.execute(sql`
        SELECT pa.id, pa.area, pa.objetivo, pa.responsable, pa.fechaCompromiso,
               pa.estado, s.nombre as sucursalNombre
        FROM plan_accion pa
        JOIN sucursales s ON s.id = pa.sucursalId
        WHERE pa.estado != 'completado'
          AND pa.fechaCompromiso IS NOT NULL
          AND DATE(pa.fechaCompromiso) < ${hoy}
        ORDER BY pa.fechaCompromiso ASC
      `);

      const planes = (vencidos[0] as any[]);
      if (planes.length === 0) return;

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      const fmt = (d: string) => new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
      const rows = planes.map((p: any, i: number) => `
        <tr style="border-bottom:1px solid #f3f4f6;background:${i%2===0?'#fff':'#fafafa'}">
          <td style="padding:8px 12px;font-size:13px;color:#dc2626;font-weight:600">${p.sucursalNombre}</td>
          <td style="padding:8px 12px;font-size:13px">${p.area}</td>
          <td style="padding:8px 12px;font-size:13px;max-width:200px">${p.objetivo || p.area}</td>
          <td style="padding:8px 12px;font-size:13px">${p.responsable || '—'}</td>
          <td style="padding:8px 12px;font-size:13px;color:#dc2626;font-weight:600">${fmt(p.fechaCompromiso)}</td>
          <td style="padding:8px 12px"><span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${p.estado === 'pendiente' ? 'Pendiente' : 'En proceso'}</span></td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,sans-serif">
<div style="max-width:650px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="margin:0;font-size:20px;color:#dc2626">⚠️ Planes de Acción Vencidos</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0">SECOF Snowtea · ${new Date().toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <p style="margin:0 0 16px;font-size:14px;color:#374151">Los siguientes <strong>${planes.length} planes de acción</strong> están vencidos y sin cerrar. Por favor tomar acción inmediata:</p>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#fee2e2">
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Tienda</th>
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Área</th>
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Objetivo</th>
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Responsable</th>
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Vencía</th>
        <th style="padding:8px 12px;text-align:left;color:#7f1d1d;font-size:12px">Estado</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;border:1px solid #fde68a">
      <p style="margin:0;font-size:13px;color:#92400e">
        👉 Accede a <a href="https://secof.snowteatienda.com/plan-accion" style="color:#d97706;font-weight:600">SECOF → Plan de Acción</a> para actualizar o cerrar estos planes.
      </p>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">SECOF · secof.snowteatienda.com</p>
</div></body></html>`;

      const emails = (process.env.REPORT_EMAILS || "").split(",").map((e: string) => e.trim()).filter(Boolean);
      await transporter.sendMail({
        from: `"SECOF Snowtea" <${process.env.SMTP_USER}>`,
        to: emails.join(", "),
        subject: `⚠️ ${planes.length} plan${planes.length > 1 ? 'es' : ''} de acción vencido${planes.length > 1 ? 's' : ''} sin cerrar — SECOF`,
        html
      });
      console.log(`[Scheduler] Alerta planes vencidos enviada: ${planes.length} planes`);
    } catch(e) {
      console.error("[Scheduler] Error alerta planes:", e);
    }
    setTimeout(alertaPlanes, 24 * 60 * 60 * 1000);
  }, horasParaPlanes * 3600000);
  console.log(`[Scheduler] Alerta planes vencidos programada en ${horasParaPlanes.toFixed(1)} horas (9:00 AM diario)`);

  // ── Recordatorio y alerta evaluación SECOF mensual ───────────────────────
  // Corre diario a las 8:00 AM y decide qué hacer según la fecha
  const horasParaSecofCheck = (() => {
    const ahora = new Date();
    const target = new Date();
    target.setHours(8, 0, 0, 0);
    if (target <= ahora) target.setDate(target.getDate() + 1);
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function checkSecofMensual() {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      const ahora = new Date();
      const dia = ahora.getDate();
      const mes = ahora.getMonth();
      const anio = ahora.getFullYear();

      // Calcular primer lunes del mes actual
      const primerDia = new Date(anio, mes, 1);
      const diaSemana = primerDia.getDay(); // 0=dom,1=lun
      const primerLunes = new Date(anio, mes, 1 + (diaSemana === 1 ? 0 : (8 - diaSemana) % 7));
      const diaLunes = primerLunes.getDate();
      const diaRecordatorio = diaLunes - 4; // jueves previo

      // Función para verificar si se hizo la evaluación este mes
      const inicioMes = `${anio}-${String(mes+1).padStart(2,'0')}-01`;
      const finMes = `${anio}-${String(mes+1).padStart(2,'0')}-${new Date(anio, mes+1, 0).getDate()}`;
      const evalRows = await db.execute(sql`
        SELECT COUNT(*) as total FROM evaluaciones
        WHERE sucursalId = 30001
          AND fecha >= ${inicioMes} AND fecha <= ${finMes}
          AND estado = 'completada'
      `);
      const evalCount = Number((evalRows[0] as any[])[0]?.total ?? 0);
      const seHizoEsteMes = evalCount > 0;

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: "smtp.gmail.com", port: 587, secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      const emails = (process.env.REPORT_EMAILS || "").split(",").map((e: string) => e.trim()).filter(Boolean);
      const fechaTexto = ahora.toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

      // CASO 1: Recordatorio (jueves previo al primer lunes)
      if (dia === diaRecordatorio && !seHizoEsteMes) {
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="margin:0;font-size:20px;color:#1B5E37">📋 Recordatorio: Evaluación SECOF</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0">SECOF Snowtea · ${fechaTexto}</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <p style="font-size:15px;color:#111827;margin:0 0 16px">Hola,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 16px">
      Este es un recordatorio de que la <strong>evaluación SECOF mensual de Plaza Patio</strong> debe realizarse el próximo 
      <strong>lunes ${diaLunes} de ${ahora.toLocaleDateString("es-MX",{month:"long"})}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="margin:0;font-size:13px;color:#166534">
        ✅ <strong>¿Quién realiza la evaluación?</strong> Sandra Lazarin (Control Operativo)<br>
        📅 <strong>Fecha límite:</strong> Lunes ${diaLunes} de ${ahora.toLocaleDateString("es-MX",{month:"long"})}<br>
        ⏰ <strong>Extensión máxima:</strong> Hasta el día 10 del mes
      </p>
    </div>
    <div style="text-align:center">
      <a href="https://secof.snowteatienda.com/evaluacion/nueva" 
         style="display:inline-block;background:#1B5E37;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Ir a realizar evaluación SECOF →
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">SECOF · secof.snowteatienda.com</p>
</div></body></html>`;
        await transporter.sendMail({
          from: `"SECOF Snowtea" <${process.env.SMTP_USER}>`,
          to: emails.join(", "),
          subject: `📋 Recordatorio: Evaluación SECOF mensual — Plaza Patio (lunes ${diaLunes})`,
          html
        });
        console.log(`[Scheduler] Recordatorio SECOF mensual enviado (lunes ${diaLunes})`);
      }

      // CASO 2: Alerta el mismo lunes — no se realizó
      if (dia === diaLunes && !seHizoEsteMes) {
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="margin:0;font-size:20px;color:#d97706">⚠️ Evaluación SECOF No Realizada</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0">SECOF Snowtea · ${fechaTexto}</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <p style="font-size:14px;color:#374151;margin:0 0 16px">
      La evaluación SECOF mensual de <strong>Plaza Patio</strong> <strong>no fue realizada</strong> el día de hoy (primer lunes del mes).
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="margin:0;font-size:13px;color:#92400e">
        ⏰ <strong>Aún puedes realizarla.</strong> Tienes hasta el <strong>día 10 de ${ahora.toLocaleDateString("es-MX",{month:"long"})}</strong> para completarla sin penalización.
      </p>
    </div>
    <div style="text-align:center">
      <a href="https://secof.snowteatienda.com/evaluacion/nueva"
         style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Realizar evaluación ahora →
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">SECOF · secof.snowteatienda.com</p>
</div></body></html>`;
        await transporter.sendMail({
          from: `"SECOF Snowtea" <${process.env.SMTP_USER}>`,
          to: emails.join(", "),
          subject: `⚠️ Evaluación SECOF no realizada — tienes hasta el día 10`,
          html
        });
        console.log(`[Scheduler] Alerta SECOF no realizado (día ${dia})`);
      }

      // CASO 3: Día 10 — vencido definitivo
      if (dia === 10 && !seHizoEsteMes) {
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="margin:0;font-size:20px;color:#dc2626">🚨 Evaluación SECOF Vencida</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0">SECOF Snowtea · ${fechaTexto}</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <p style="font-size:14px;color:#374151;margin:0 0 16px">
      La evaluación SECOF mensual de <strong>Plaza Patio</strong> está <strong style="color:#dc2626">VENCIDA</strong>. 
      No fue realizada en el período establecido (del ${diaLunes} al 10 de ${ahora.toLocaleDateString("es-MX",{month:"long"})}).
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px">
      <p style="margin:0;font-size:13px;color:#991b1b">
        🚨 <strong>Acción requerida:</strong> Realizar la evaluación SECOF de inmediato y notificar al Director General.<br>
        📊 Este incumplimiento afecta el <strong>KPI de cumplimiento operativo</strong> de Sandra.
      </p>
    </div>
    <div style="text-align:center">
      <a href="https://secof.snowteatienda.com/evaluacion/nueva"
         style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        Realizar evaluación urgente →
      </a>
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px">SECOF · secof.snowteatienda.com</p>
</div></body></html>`;
        await transporter.sendMail({
          from: `"SECOF Snowtea" <${process.env.SMTP_USER}>`,
          to: emails.join(", "),
          subject: `🚨 URGENTE: Evaluación SECOF vencida — Plaza Patio`,
          html
        });
        console.log(`[Scheduler] Alerta SECOF vencido definitivo (día 10)`);
      }
    } catch(e) {
      console.error("[Scheduler] Error check SECOF mensual:", e);
    }
    setTimeout(checkSecofMensual, 24 * 60 * 60 * 1000);
  }, horasParaSecofCheck * 3600000);


  // ── Snapshot KPIs mensual (1ro del mes 6:30 AM) ──────────────────────────
  const horasParaKpiSnapshot = (() => {
    const ahora = new Date();
    const target = new Date(ahora.getFullYear(), ahora.getMonth()+1, 1, 6, 30, 0);
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function calcularSnapshotMensual() {
    try {
      const mesAnterior = new Date();
      mesAnterior.setDate(0); // último día del mes anterior
      const mes = mesAnterior.toISOString().slice(0,7);
      const { calcularKpiSnapshotMensual } = await import("./services/kpiService");
      const resultado = await calcularKpiSnapshotMensual(30001, mes);
      console.log(`[Scheduler] Snapshot KPI ${mes}: score=${resultado.scoreTotalPct}% estado=${resultado.estado}`);

      // Enviar correo con resumen a los dueños
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host:"smtp.gmail.com", port:587, secure:false,
        auth:{user:process.env.SMTP_USER, pass:process.env.SMTP_PASS}
      });
      const [y,m] = mes.split("-");
      const mesNombre = new Date(Number(y), Number(m)-1).toLocaleDateString("es-MX",{month:"long",year:"numeric"});
      const color = resultado.estado==="excelente"?"#16a34a":resultado.estado==="cumple"?"#2563eb":resultado.estado==="riesgo"?"#d97706":"#dc2626";
      const emoji = resultado.estado==="excelente"?"🌟":resultado.estado==="cumple"?"✅":resultado.estado==="riesgo"?"⚠️":"🚨";
      const fmt = (v: number|null, sfx="") => v !== null && v !== undefined ? `${v}${sfx}` : "—";

      const html = `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;margin-bottom:20px">
    <h1 style="margin:0;font-size:22px;color:#111827">${emoji} Reporte KPI Mensual — Líder</h1>
    <p style="color:#6b7280;font-size:14px;margin:4px 0 0">Plaza Patio · ${mesNombre}</p>
  </div>
  <div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:16px">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:11px;color:#6b7280;font-weight:700;letter-spacing:.05em;margin-bottom:8px">SCORE TOTAL PONDERADO</div>
      <div style="font-size:52px;font-weight:900;color:${color};line-height:1">${resultado.scoreTotalPct}%</div>
      <div style="display:inline-block;background:${color}22;color:${color};padding:4px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-top:8px;text-transform:uppercase">${resultado.estado}</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280">KPI</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">Resultado</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">Meta</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">Estado</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 12px;font-size:13px">💰 Ventas vs meta</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.ventasPct,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥100%</td><td style="padding:8px 12px;text-align:center">${(resultado.ventasPct||0)>=100?'✅':resultado.ventasPct>=80?'⚠️':'🔴'}</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa"><td style="padding:8px 12px;font-size:13px">📋 Score SECOF</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.scoreSecof,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥85%</td><td style="padding:8px 12px;text-align:center">${(resultado.scoreSecof||0)>=85?'✅':(resultado.scoreSecof||0)>=70?'⚠️':'🔴'}</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 12px;font-size:13px">⏰ Puntualidad equipo</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.puntualidadPct,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥95%</td><td style="padding:8px 12px;text-align:center">${(resultado.puntualidadPct||0)>=95?'✅':(resultado.puntualidadPct||0)>=80?'⚠️':'🔴'}</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa"><td style="padding:8px 12px;font-size:13px">🧪 Preparaciones</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.preparacionesPct,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥90%</td><td style="padding:8px 12px;text-align:center">${(resultado.preparacionesPct||0)>=90?'✅':(resultado.preparacionesPct||0)>=70?'⚠️':'🔴'}</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 12px;font-size:13px">🔐 Aperturas/cierres</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.aperturasPct,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥90%</td><td style="padding:8px 12px;text-align:center">${(resultado.aperturasPct||0)>=90?'✅':(resultado.aperturasPct||0)>=70?'⚠️':'🔴'}</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa"><td style="padding:8px 12px;font-size:13px">😊 Servicio al cliente</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.servicioScore,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥85%</td><td style="padding:8px 12px;text-align:center">${(resultado.servicioScore||0)>=85?'✅':(resultado.servicioScore||0)>=70?'⚠️':'🔴'}</td></tr>
        <tr><td style="padding:8px 12px;font-size:13px">🥤 Precisión preparación</td><td style="padding:8px 12px;text-align:center;font-weight:600">${fmt(resultado.preparacionScore,'%')}</td><td style="padding:8px 12px;text-align:center;color:#6b7280">≥85%</td><td style="padding:8px 12px;text-align:center">${(resultado.preparacionScore||0)>=85?'✅':(resultado.preparacionScore||0)>=70?'⚠️':'🔴'}</td></tr>
      </tbody>
    </table>
  </div>
  <div style="text-align:center;margin-bottom:16px">
    <a href="https://secof.snowteatienda.com/kpi-lider" style="display:inline-block;background:#1B5E37;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver KPIs completos en SECOF →</a>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin:0">SECOF · secof.snowteatienda.com</p>
</div></body></html>`;

      const emails = (process.env.REPORT_EMAILS||"").split(",").map((e:string)=>e.trim()).filter(Boolean);
      await transporter.sendMail({
        from:`"SECOF Snowtea" <${process.env.SMTP_USER}>`,
        to: emails.join(", "),
        subject:`${emoji} KPI Mensual Líder — Plaza Patio ${mesNombre}: ${resultado.scoreTotalPct}% (${resultado.estado})`,
        html
      });
      console.log(`[Scheduler] Reporte KPI mensual enviado: ${resultado.scoreTotalPct}% ${resultado.estado}`);
    } catch(e) { console.error("[Scheduler] Error snapshot KPI:", e); }
    setTimeout(calcularSnapshotMensual, 30*24*60*60*1000);
  }, horasParaKpiSnapshot * 3600000);


  // ── Auto-generación de horario semanal (jueves 6:00 PM) ─────────────────
  const horasParaAutoHorario = (() => {
    const ahora = new Date();
    // Próximo jueves a las 18:00
    const target = new Date(ahora);
    const diaSemana = ahora.getDay(); // 0=dom,1=lun,...,4=jue
    const diasHastaJueves = (4 - diaSemana + 7) % 7 || 7;
    target.setDate(ahora.getDate() + diasHastaJueves);
    target.setHours(18, 0, 0, 0);
    if (target <= ahora) target.setDate(target.getDate() + 7);
    return (target.getTime() - ahora.getTime()) / 3600000;
  })();

  setTimeout(async function autoHorarioSemanal() {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      // Calcular rango de la semana siguiente (lunes a domingo)
      const ahora = new Date();
      const diaSemana = ahora.getDay();
      const diasHastaLunes = (8 - diaSemana) % 7 || 7;
      const lunes = new Date(ahora);
      lunes.setDate(ahora.getDate() + diasHastaLunes);
      lunes.setHours(0,0,0,0);

      const semanaFechas: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        semanaFechas.push(d.toISOString().split('T')[0]);
      }

      const semana = Math.ceil((lunes.getTime() - new Date(lunes.getFullYear(),0,1).getTime()) / (7*86400000));
      const anio = lunes.getFullYear();

      console.log(`[Scheduler] Auto-horario semana ${semana}/${anio}: ${semanaFechas[0]} → ${semanaFechas[6]}`);

      // Obtener empleados activos de Plaza Patio con horarioPersonal
      const empRows = await db.execute(sql`
        SELECT id, nombre, horarioPersonal, areaPreferida FROM empleados
        WHERE sucursalId = 30001 AND activo = 1 AND horarioPersonal IS NOT NULL
      `);
      const empleados = (empRows[0] as any[]);

      // Obtener catálogo de actividades
      const catRows = await db.execute(sql`SELECT clave, area_compatible FROM actividades_catalogo WHERE activa=1`);
      const todasActs = (catRows[0] as any[]);

      let creados = 0;
      for (const emp of empleados) {
        const claves = todasActs.filter((a: any) => a.area_compatible === 'todas').map((a: any) => a.clave);



        let hp: Record<number,any> = {};
        try { hp = typeof emp.horarioPersonal==='string' ? JSON.parse(emp.horarioPersonal) : (emp.horarioPersonal??{}); } catch {}

        for (let i = 0; i < 7; i++) {
          const diaSem = (i + 1) % 7; // lunes=1,...,domingo=0
          const turnoConfig = hp[diaSem];
          if (!turnoConfig) continue; // no trabaja ese día

          const fecha = semanaFechas[i];

          // Verificar si ya existe turno
          const existeRows = await db.execute(sql`
            SELECT id FROM turnos_semana
            WHERE sucursalId=30001 AND empleadoId=${emp.id} AND fecha=${fecha}
            LIMIT 1
          `);
          if ((existeRows[0] as any[]).length > 0) continue;

          const entrada = turnoConfig.entrada ?? '09:00';
          const salida  = turnoConfig.salida  ?? '17:00';
          const horaH = parseInt(entrada.split(':')[0]);
          const tipo = horaH < 12 ? 'matutino' : horaH < 15 ? 'intermedio' : 'vespertino';

          const res = await db.execute(sql`
            INSERT INTO turnos_semana
              (sucursalId, empleadoId, fecha, semana, anio, turno, horaInicio, horaFin, rolPrincipal, createdBy)
            VALUES
              (30001, ${emp.id}, ${fecha}, ${semana}, ${anio}, ${tipo}, ${entrada}, ${salida}, 'Auto-generado', 1)
          `);
          const turnoId = (res[0] as any).insertId;

          // Asignar actividades del catálogo
          for (const clave of claves) {
            await db.execute(sql`
              INSERT IGNORE INTO turno_actividades (turnoId, actividadClave, esPendiente)
              VALUES (${turnoId}, ${clave}, 0)
            `);
          }
          creados++;
        }
      }

      console.log(`[Scheduler] Auto-horario generado: ${creados} turnos para semana ${semana}`);

      // Notificar a Emily que el horario está listo para revisar
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host:"smtp.gmail.com", port:587, secure:false,
        auth:{user:process.env.SMTP_USER, pass:process.env.SMTP_PASS}
      });
      await transporter.sendMail({
        from:`"SECOF Snowtea" <${process.env.SMTP_USER}>`,
        to: "lider.patio.snowtea@gmail.com," + (process.env.REPORT_EMAILS||""),
        subject:`📅 Horario semana ${semana} generado automáticamente — Plaza Patio`,
        html:`<div style="font-family:sans-serif;max-width:500px;margin:auto;padding:20px;background:#f3f4f6">
          <div style="background:#fff;border-radius:12px;padding:24px">
            <h2 style="color:#1B5E37;margin:0 0 12px">📅 Horario Semanal Generado</h2>
            <p style="color:#374151">El horario de la semana <strong>${semanaFechas[0]} al ${semanaFechas[6]}</strong> ha sido generado automáticamente en SECOF con base en los horarios fijos del equipo.</p>
            <p style="color:#374151"><strong>${creados} turnos</strong> creados con actividades asignadas.</p>
            <div style="background:#fef3c7;border-radius:8px;padding:12px;margin:16px 0">
              <p style="margin:0;color:#92400e;font-size:13px">⚠️ Revisa y ajusta si hay cambios antes del <strong>viernes 4:00 PM</strong>. Usa Ajuste Eventual para modificaciones.</p>
            </div>
            <a href="https://secof.snowteatienda.com/rotacion-areas" style="display:inline-block;background:#1B5E37;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver horario en SECOF →</a>
          </div>
        </div>`
      });
      console.log(`[Scheduler] Notificación auto-horario enviada`);
    } catch(e) { console.error("[Scheduler] Error auto-horario:", e); }
    setTimeout(autoHorarioSemanal, 7*24*60*60*1000); // repetir cada semana
  }, horasParaAutoHorario * 3600000);

  console.log(`[Scheduler] Auto-horario semanal programado en ${horasParaAutoHorario.toFixed(1)} horas (próximo jueves 6:00 PM)`);

  console.log(`[Scheduler] Snapshot KPI mensual programado en ${horasParaKpiSnapshot.toFixed(1)} horas (1ro del mes 6:30 AM)`);

  console.log(`[Scheduler] Check SECOF mensual programado en ${horasParaSecofCheck.toFixed(1)} horas (8:00 AM diario)`);

  console.log(`[Scheduler] Alerta planes vencidos programada en ${horasParaPlanes.toFixed(1)} horas (9:00 AM diario)`);

  console.log(`[Scheduler] Auto-meta mensual programada en ${horasParaMeta.toFixed(1)} horas (1ro del mes)`);

  console.log(`[Scheduler] Sync nocturno Odoo programado en ${horasParaSync.toFixed(1)} horas (22:15 diario)`);

  // Calcular próximo lunes 9:00 AM para alertas de retardos
  const msAlertasAsistencia = (() => {
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const diasHastaLunes = (8 - diaSemana) % 7 || 7;
    const proximoLunes = new Date(ahora);
    proximoLunes.setDate(ahora.getDate() + diasHastaLunes);
    proximoLunes.setHours(9, 0, 0, 0);
    return proximoLunes.getTime() - ahora.getTime();
  })();
  const diasAlertasAsist = (msAlertasAsistencia / (24*60*60*1000)).toFixed(1);
  console.log(`[Scheduler] Alertas retardos/ausencias programadas en ${diasAlertasAsist} días (próximo lunes 9:00 AM)`);

  // ── Auto-cierre turnos sin salida (6:00 AM diario hora México) ────────────
  const horasParaAutoCierre = (() => {
    const target = new Date();
    target.setUTCHours(12, 0, 0, 0);
    if (target <= new Date()) target.setDate(target.getDate() + 1);
    const h = (target.getTime() - new Date().getTime()) / 3600000;
    return h;
  })();
  setTimeout(async function runAutoCierre() {
    console.log("[Scheduler] Auto-cierre turnos programado en " + horasParaAutoCierre.toFixed(1) + " horas (6:00 AM diario)");
    await autoCierreTurnos();
    setTimeout(runAutoCierre, 24 * 60 * 60 * 1000);
  }, horasParaAutoCierre * 3600000);
  console.log(`[Scheduler] Auto-cierre turnos programado en ${horasParaAutoCierre.toFixed(1)} horas (6:00 AM diario)`);
  setTimeout(() => {
    alertaRetardosYAusencias();
    setInterval(alertaRetardosYAusencias, 7 * 24 * 60 * 60 * 1000);
  }, msAlertasAsistencia);
}