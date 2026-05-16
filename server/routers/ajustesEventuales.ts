import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

function toMin(h: string) { const [hr, m] = h.split(":").map(Number); return hr * 60 + m; }
function deMin(m: number) { return `${Math.floor(m/60).toString().padStart(2,"0")}:${(m%60).toString().padStart(2,"0")}`; }

export const ajustesEventualesRouter = router({

  getByFecha: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fecha: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.execute(sql`
        SELECT ae.*, e.nombre, e.apellido, e.horarioPersonal
        FROM ajustes_eventuales ae
        JOIN empleados e ON e.id = ae.empleadoId
        WHERE ae.sucursalId = ${input.sucursalId} AND ae.fecha = ${input.fecha}
      `);
      return (rows[0] as any[]);
    }),

  guardar: protectedProcedure
    .input(z.object({
      sucursalId:  z.number(),
      empleadoId:  z.number(),
      fecha:       z.string(),
      ausente:     z.boolean().default(false),
      horaEntrada: z.string().optional(),
      horaSalida:  z.string().optional(),
      motivo:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(sql`
        INSERT INTO ajustes_eventuales
          (sucursalId, empleadoId, fecha, ausente, horaEntrada, horaSalida, motivo, creadoPorId)
        VALUES
          (${input.sucursalId}, ${input.empleadoId}, ${input.fecha},
           ${input.ausente ? 1 : 0}, ${input.horaEntrada ?? null},
           ${input.horaSalida ?? null}, ${input.motivo ?? null}, ${ctx.user.id})
        ON DUPLICATE KEY UPDATE
          ausente     = ${input.ausente ? 1 : 0},
          horaEntrada = ${input.horaEntrada ?? null},
          horaSalida  = ${input.horaSalida ?? null},
          motivo      = ${input.motivo ?? null},
          creadoPorId = ${ctx.user.id},
          updatedAt   = NOW()
      `);

      // Auto-crear turnosSemana si no existe, para que aparezca en Mi Turno
      if (!input.ausente && input.horaEntrada && input.horaSalida) {
        const existeTurno = await db.execute(sql`
          SELECT id FROM turnos_semana
          WHERE sucursalId=${input.sucursalId} AND empleadoId=${input.empleadoId} AND fecha=${input.fecha}
          LIMIT 1
        `);
        if ((existeTurno[0] as any[]).length === 0) {
          const h = parseInt(input.horaEntrada.split(":")[0]);
          const tipo = h < 11 ? "matutino" : h < 14 ? "intermedio" : "vespertino";
          const d = new Date(input.fecha + "T12:00:00Z");
          const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const sem = Math.ceil(((d.getTime()-jan1.getTime())/86400000 + jan1.getUTCDay()+1)/7);
          const res = await db.execute(sql`
            INSERT INTO turnos_semana
              (sucursalId, empleadoId, fecha, semana, anio, turno, horaInicio, horaFin, rolPrincipal, createdBy)
            VALUES
              (${input.sucursalId}, ${input.empleadoId}, ${input.fecha},
               ${sem}, ${d.getUTCFullYear()}, ${tipo},
               ${input.horaEntrada}, ${input.horaSalida}, 'Ajuste eventual', ${ctx.user.id})
          `);
          const turnoId = (res[0] as any).insertId;
          const catRows = await db.execute(sql`SELECT clave FROM actividades_catalogo WHERE activa=1`);
          for (const r of (catRows[0] as any[])) {
            await db.execute(sql`
              INSERT IGNORE INTO turno_actividades (turnoId, actividadClave, esPendiente)
              VALUES (${turnoId}, ${r.clave}, 0)
            `);
          }
        } else {
          // Actualizar horario del turno existente
          await db.execute(sql`
            UPDATE turnos_semana SET horaInicio=${input.horaEntrada}, horaFin=${input.horaSalida}
            WHERE sucursalId=${input.sucursalId} AND empleadoId=${input.empleadoId} AND fecha=${input.fecha}
          `);
        }
      }
      return { ok: true };
    }),

  eliminar: protectedProcedure
    .input(z.object({ empleadoId: z.number(), fecha: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.execute(sql`
        DELETE FROM ajustes_eventuales
        WHERE empleadoId = ${input.empleadoId} AND fecha = ${input.fecha}
      `);
      return { ok: true };
    }),

  generarRotacionDia: protectedProcedure
    .input(z.object({ sucursalId: z.number(), fecha: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!["superadmin","owner","manager","leader"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const diaSemana = new Date(input.fecha + "T12:00:00Z").getUTCDay();

      const empsRows = await db.execute(sql`
        SELECT id, nombre, apellido, horarioPersonal
        FROM empleados WHERE sucursalId=${input.sucursalId} AND activo=1
      `);
      const emps = (empsRows[0] as any[]);

      const ajustesRows = await db.execute(sql`
        SELECT * FROM ajustes_eventuales
        WHERE sucursalId=${input.sucursalId} AND fecha=${input.fecha}
      `);
      const ajustes: Record<number,any> = {};
      for (const a of (ajustesRows[0] as any[])) ajustes[Number(a.empleadoId)] = a;

      const hace28 = new Date(input.fecha + "T12:00:00Z");
      hace28.setUTCDate(hace28.getUTCDate() - 28);
      const histRows = await db.execute(sql`
        SELECT empleadoId, area FROM rotacion_areas
        WHERE sucursalId=${input.sucursalId}
          AND fecha >= ${hace28.toISOString().split("T")[0]}
          AND fecha < ${input.fecha}
      `);
      const historial = (histRows[0] as any[]);

      // Construir empleados activos con su horario efectivo
      type EmpActivo = { id:number; nombre:string; apellido:string|null; inicioMin:number; finMin:number; horaInicio:string; horaFin:string };
      const activos: EmpActivo[] = [];
      for (const emp of emps) {
        const aj = ajustes[Number(emp.id)];
        if (aj?.ausente) continue;
        let entrada: string|null = null, salida: string|null = null;
        if (aj?.horaEntrada && aj?.horaSalida) {
          entrada = aj.horaEntrada; salida = aj.horaSalida;
        } else {
          let hp: Record<number,{entrada:string;salida:string}|null> = {};
          try { hp = typeof emp.horarioPersonal==="string" ? JSON.parse(emp.horarioPersonal) : (emp.horarioPersonal??{}); } catch {}
          const dia = hp[diaSemana];
          if (!dia) continue;
          entrada = dia.entrada; salida = dia.salida;
        }
        if (!entrada || !salida) continue;
        activos.push({ id:Number(emp.id), nombre:emp.nombre, apellido:emp.apellido??null,
          inicioMin:toMin(entrada), finMin:toMin(salida), horaInicio:entrada, horaFin:salida });
      }

      // Historial de rotación para balanceo
      const conteo: Record<number,{caja:number;preparacion:number;comodin:number}> = {};
      for (const e of activos) conteo[e.id] = {caja:0,preparacion:0,comodin:0};
      for (const h of historial) {
        if (conteo[Number(h.empleadoId)]) {
          if (h.area==="caja") conteo[Number(h.empleadoId)].caja++;
          else if (h.area==="preparacion") conteo[Number(h.empleadoId)].preparacion++;
          else if (h.area==="comodin") conteo[Number(h.empleadoId)].comodin++;
        }
      }

      // Generar overlap por bloques de tiempo
      const resultado: {empleadoId:number;area:string;horaInicio:string;horaFin:string}[] = [];
      const mCaja: Record<number,number> = {}; const mPrep: Record<number,number> = {};
      for (const e of activos) { mCaja[e.id]=0; mPrep[e.id]=0; }

      const eventos = new Set<number>();
      for (const e of activos) { eventos.add(e.inicioMin); eventos.add(e.finMin); }
      const puntos = Array.from(eventos).sort((a,b)=>a-b);

      for (let i=0; i<puntos.length-1; i++) {
        const bi=puntos[i], bf=puntos[i+1], dur=bf-bi;
        if (dur<=0) continue;
        const presentes = activos.filter(e=>e.inicioMin<=bi && e.finMin>=bf);
        if (!presentes.length) continue;
        const hI=deMin(bi), hF=deMin(bf);
        if (presentes.length===1) {
          resultado.push({empleadoId:presentes[0].id,area:"caja_y_preparacion",horaInicio:hI,horaFin:hF});
          mCaja[presentes[0].id]+=dur; mPrep[presentes[0].id]+=dur;
        } else if (presentes.length===2) {
          const [a,b]=presentes;
          const sA=(conteo[a.id].caja*60+mCaja[a.id])-(conteo[a.id].preparacion*60+mPrep[a.id]);
          const sB=(conteo[b.id].caja*60+mCaja[b.id])-(conteo[b.id].preparacion*60+mPrep[b.id]);
          const aVaCaja=sA!==sB?sA<sB:(bi%2===0);
          const caj=aVaCaja?a:b, prep=aVaCaja?b:a;
          resultado.push({empleadoId:caj.id,area:"caja",horaInicio:hI,horaFin:hF});
          resultado.push({empleadoId:prep.id,area:"preparacion",horaInicio:hI,horaFin:hF});
          mCaja[caj.id]+=dur; mPrep[prep.id]+=dur;
        } else {
          const ord=[...presentes].sort((a,b)=>{
            const da=(conteo[a.id].caja*60+mCaja[a.id])-(conteo[a.id].preparacion*60+mPrep[a.id]);
            const db2=(conteo[b.id].caja*60+mCaja[b.id])-(conteo[b.id].preparacion*60+mPrep[b.id]);
            return da!==db2?da-db2:a.id-b.id;
          });
          resultado.push({empleadoId:ord[0].id,area:"preparacion",horaInicio:hI,horaFin:hF});
          resultado.push({empleadoId:ord[1].id,area:"caja",horaInicio:hI,horaFin:hF});
          mPrep[ord[0].id]+=dur; mCaja[ord[1].id]+=dur;
          for (let j=2;j<ord.length;j++) resultado.push({empleadoId:ord[j].id,area:"comodin",horaInicio:hI,horaFin:hF});
        }
      }

      // Guardar en rotacion_areas (reemplaza no-manuales del día)
      await db.execute(sql`
        DELETE FROM rotacion_areas
        WHERE sucursalId=${input.sucursalId} AND fecha=${input.fecha} AND esManual=0
      `);
      for (const r of resultado) {
        await db.execute(sql`
          INSERT INTO rotacion_areas (sucursalId,empleadoId,fecha,area,horaInicio,horaFin,esManual,notas)
          VALUES (${input.sucursalId},${r.empleadoId},${input.fecha},${r.area},${r.horaInicio},${r.horaFin},0,NULL)
        `);
      }
      return { ok:true, asignaciones:resultado.length, activos:activos.length, bloques:resultado };
    }),
});
