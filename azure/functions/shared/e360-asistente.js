/* ═══════════════════════════════════════════════════════════════════════════
   _E360_ASISTENTE_V1 (08-nov-2026) — Evaluación 360° MENSUAL guiada, uno por uno
   ---------------------------------------------------------------------------
   · Programación (CV_Estado): e360_dia_inicio (día del mes desde el que toca evaluar, por defecto 16),
     e360_evaluadores (usuarios autorizados, por defecto los ADMINS_EVAL360). Frecuencia: mensual.
   · pendientes(): a quién falta evaluar en el periodo vigente. Personas = KPI_Personas activas de tipo
     SUP (supervisores GH) y ASIST (asistentes RR.LL.). Bienestar/Reclutamiento no están ahí.
     Del 1 al (dia_inicio-1) se revisa el MES ANTERIOR (lo que quedó sin evaluar sigue pendiente);
     desde dia_inicio, el mes en curso. Igual que el recordatorio del panel.
   Todo se lee y guarda en Supabase (E360_Evaluaciones, KPI_Personas, CV_Estado).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const KPI = require('./kpi-db');
const { ADMINS_EVAL360, misma } = require('./e360-guardar');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const p2 = n => (n < 10 ? '0' : '') + n;
const S = v => (v && typeof v === 'object' && typeof v.$d === 'string') ? (v.$s || v.$d) : String(v == null ? '' : v);
function hoyLima() { const d = new Date(Date.now() - 5 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), ymd: d.toISOString().slice(0, 10) }; }

async function leerEstado(pool, clave) {
  try { const r = await pool.request().input('k', sql.NVarChar(100), clave).query('SELECT valor FROM dbo.CV_Estado WHERE clave = @k'); return r.recordset.length ? String(r.recordset[0].valor || '') : ''; } catch (e) { return ''; }
}
async function ponerEstado(pool, clave, valor) {
  await pool.request().input('k', sql.NVarChar(100), clave).input('v', sql.NVarChar(sql.MAX), String(valor))
    .query(`MERGE dbo.CV_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave WHEN MATCHED THEN UPDATE SET valor = @v WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES (@k, @v);`);
}
async function programa(pool) {
  const dia = parseInt(await leerEstado(pool, 'e360_dia_inicio'), 10);
  const ev = (await leerEstado(pool, 'e360_evaluadores')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return { frecuencia: 'mensual', dia_inicio: dia >= 1 && dia <= 28 ? dia : 16, evaluadores: ev.length ? ev : ADMINS_EVAL360.slice() };
}
async function guardarPrograma(pool, b, usuario) {
  if (String(usuario || '').toLowerCase() !== 'jtimoteo') return { status: 403, body: { success: false, error: 'Solo el coordinador cambia la programación.' } };
  if (b.dia_inicio !== undefined) { const d = parseInt(b.dia_inicio, 10); if (!(d >= 1 && d <= 28)) return { status: 400, body: { success: false, error: 'dia_inicio debe estar entre 1 y 28.' } }; await ponerEstado(pool, 'e360_dia_inicio', d); }
  if (b.evaluadores !== undefined) { const lista = (Array.isArray(b.evaluadores) ? b.evaluadores : String(b.evaluadores).split(',')).map(s => String(s).trim().toLowerCase()).filter(Boolean); if (lista.indexOf('jtimoteo') < 0) lista.unshift('jtimoteo'); await ponerEstado(pool, 'e360_evaluadores', lista.join(',')); }
  return { status: 200, body: Object.assign({ success: true }, await programa(pool)) };
}

/* evaluaciones del periodo yyyy-MM (desde la tabla, por encabezado) */
async function evaluacionesDe(pool, periodo) {
  const T = await TH.leer(pool, 'e360_evaluaciones'); if (!T) return [];
  const heads = (T.encabezado || []).map(h => S(h).trim()), iP = heads.indexOf('Periodo');
  const out = [];
  (T.filas || []).forEach(r => {
    if (!r || !S(r[0])) return;
    let per = iP >= 0 ? S(r[iP]).trim() : '';
    if (!per) { const f = r[1]; const d = (f && typeof f === 'object' && f.$d) ? new Date(new Date(f.$d).getTime() - 5 * 3600e3) : new Date(S(f)); per = isNaN(d) ? S(f).slice(0, 7) : d.toISOString().slice(0, 7); }
    if (per !== periodo) return;
    const iD = heads.indexOf('Detalle'), iK = heads.indexOf('KPIs');
    let comps = []; if (iD >= 0 && S(r[iD])) { try { comps = JSON.parse(S(r[iD])); } catch (e) { comps = []; } }
    if (!Array.isArray(comps) || !comps.length) comps = [['Liderazgo', r[6]], ['Comunicación', r[7]], ['Cumplimiento', r[8]], ['Gestión de Equipo', r[9]], ['Resolución de Problemas', r[10]], ['Planificación', r[11]]].map(pc => ({ nombre: pc[0], promedio: Number(S(pc[1])) || 0 }));
    let kpis = null; if (iK >= 0 && S(r[iK])) { try { kpis = JSON.parse(S(r[iK])); } catch (e) { kpis = null; } }
    out.push({ id: S(r[0]), supervisor: S(r[3]).trim(), evaluador: S(r[2]), empresa: S(r[4]), sector: S(r[5]), porcentaje: Number(S(r[13])) || 0, total: Number(S(r[12])) || 0, nivel: S(r[14]),
      observaciones: S(r[15]), recomendaciones: S(r[16]), competencias: comps.map(c => ({ nombre: c.nombre, promedio: Math.round((Number(c.promedio) || 0) * 100) / 100 })), kpis });
  });
  return out;
}
async function pendientes(pool, usuario) {
  const prog = await programa(pool), h = hoyLima();
  const arrastre = h.d < prog.dia_inicio;
  const ref = arrastre ? new Date(Date.UTC(h.y, h.m - 1, 1)) : new Date(Date.UTC(h.y, h.m, 1));
  const periodo = ref.getUTCFullYear() + '-' + p2(ref.getUTCMonth() + 1);
  const ultimo = new Date(Date.UTC(h.y, h.m + 1, 0)).getUTCDate();
  const personas = (await KPI.personas(pool)).filter(p => p.activo && (p.tipo === 'SUP' || p.tipo === 'ASIST'));
  const hechas = await evaluacionesDe(pool, periodo);
  const pend = personas.filter(p => !hechas.some(e => misma(e.supervisor, p.nombre) || (p.alias || []).some(a => misma(e.supervisor, a))))
    .map(p => ({ usuario: p.usuario, nombre: String(p.nombre || '').toUpperCase(), empresa: p.empresa || '', tipo: p.tipo, puesto: p.puesto || '' }));
  const yo = String(usuario || '').toLowerCase();
  return { success: true, frecuencia: 'mensual', periodo, mes: MESES[ref.getUTCMonth()] + ' ' + ref.getUTCFullYear(), arrastre, dia_inicio: prog.dia_inicio,
    en_periodo: true, dias_restantes: arrastre ? -1 : (ultimo - h.d), hoy: h.ymd,
    total: personas.length, hechas: hechas.length, pendientes: pend, evaluador_autorizado: prog.evaluadores.indexOf(yo) >= 0, evaluadores: prog.evaluadores, fuente: 'supabase' };
}
/* plan de acción sugerido por competencia con brecha (mejora continua); el evaluador lo ajusta con el supervisor */
const PLAN = [
  [/cumplimiento/i, 'Revisión semanal de casos abiertos y plazos con el coordinador; checklist de informes (5 días hábiles) y documentación al cierre de cada caso.'],
  [/comunicaci/i, 'Reporte breve diario por el canal oficial; reunión quincenal de coordinación con jefes de fundo y RR.LL.'],
  [/liderazgo/i, 'Acompañamiento en campo del coordinador (2 visitas al mes) con retroalimentación inmediata; taller de liderazgo y trato al personal.'],
  [/gesti/i, 'Plan de trabajo mensual del equipo a cargo con responsables y fechas; seguimiento de ausentismo y rotación del sector.'],
  [/resoluci/i, 'Aplicar el protocolo de atención de conflictos (escucha, registro, solución, seguimiento); revisión mensual de casos reincidentes.'],
  [/planificaci/i, 'Programación mensual de visitas y capacitaciones ETI cargada al inicio de mes; proponer una mejora por mes en su sector.']
];
function planDe(nombre) { for (const x of PLAN) if (x[0].test(nombre)) return nombre + ': ' + x[1]; return nombre + ': definir una acción de mejora con el coordinador y hacer seguimiento mensual.'; }
/* ---- INFORME GERENCIAL del periodo (yyyy-MM): equipo, ranking, competencias, KPIs vs meta, brechas y plan de mejora ---- */
const periodoAnterior = p => { const y = +p.slice(0, 4), m = +p.slice(5, 7); const d = new Date(Date.UTC(y, m - 2, 1)); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1); };
const prom = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
async function reporte(pool, periodoPedido) {
  const h = hoyLima(), periodo = /^\d{4}-\d{2}$/.test(String(periodoPedido || '')) ? String(periodoPedido) : (h.y + '-' + p2(h.m + 1));
  const ant = periodoAnterior(periodo);
  const [evs, evsAnt, personas] = await Promise.all([evaluacionesDe(pool, periodo), evaluacionesDe(pool, ant), KPI.personas(pool)]);
  const equipo = personas.filter(p => p.activo && (p.tipo === 'SUP' || p.tipo === 'ASIST'));
  const buscaEv = (lista, p) => lista.find(e => misma(e.supervisor, p.nombre) || (p.alias || []).some(a => misma(e.supervisor, a)));
  const filas = equipo.map(p => {
    const e = buscaEv(evs, p), a = buscaEv(evsAnt, p);
    if (!e) return { usuario: p.usuario, nombre: String(p.nombre).toUpperCase(), empresa: p.empresa || '', tipo: p.tipo, puesto: p.puesto || '', evaluado: false };
    const brechas = (e.competencias || []).filter(c => c.promedio > 0 && c.promedio < 3).map(c => c.nombre);
    const fuertes = (e.competencias || []).filter(c => c.promedio >= 4.5).map(c => c.nombre);
    const kp = (e.kpis && e.kpis.kpis) ? e.kpis.kpis.filter(k => k.estado === 'ok' && k.den).map(k => ({ codigo: k.codigo, corto: k.corto, pct: k.pct != null ? k.pct : (k.den ? k.num / k.den : null), meta: k.meta, bajo_meta: k.meta != null && k.pct != null && k.pct < k.meta })) : [];
    return { usuario: p.usuario, nombre: String(p.nombre).toUpperCase(), empresa: e.empresa || p.empresa || '', tipo: p.tipo, puesto: p.puesto || '', evaluado: true, id: e.id, evaluador: e.evaluador,
      porcentaje: e.porcentaje, nivel: e.nivel, competencias: e.competencias, kpis: kp, kpis_bajo_meta: kp.filter(k => k.bajo_meta).length,
      anterior: a ? a.porcentaje : null, delta: a ? Math.round((e.porcentaje - a.porcentaje) * 10) / 10 : null,
      brechas, fuertes, observaciones: e.observaciones, recomendaciones: e.recomendaciones };
  });
  const evaluados = filas.filter(f => f.evaluado).sort((x, y) => y.porcentaje - x.porcentaje);
  evaluados.forEach((f, i) => { f.puesto_ranking = i + 1; });
  const niveles = {}; evaluados.forEach(f => { const n = f.nivel || 'Sin nivel'; niveles[n] = (niveles[n] || 0) + 1; });
  const porEmpresa = {}; evaluados.forEach(f => { const k = f.empresa || '—'; (porEmpresa[k] = porEmpresa[k] || []).push(f.porcentaje); });
  const compNombres = []; evaluados.forEach(f => (f.competencias || []).forEach(c => { if (compNombres.indexOf(c.nombre) < 0) compNombres.push(c.nombre); }));
  const competencias = compNombres.map(n => ({ nombre: n, promedio: prom(evaluados.map(f => (f.competencias.find(c => c.nombre === n) || {}).promedio).filter(v => v > 0)), bajos: evaluados.filter(f => ((f.competencias.find(c => c.nombre === n) || {}).promedio || 0) > 0 && (f.competencias.find(c => c.nombre === n) || {}).promedio < 3).length }));
  const promAnt = prom(evsAnt.map(e => e.porcentaje));
  const plan = evaluados.filter(f => f.brechas.length || f.kpis_bajo_meta || (f.recomendaciones || '').trim()).map(f => ({ nombre: f.nombre, empresa: f.empresa, porcentaje: f.porcentaje, nivel: f.nivel, brechas: f.brechas, kpis_bajo_meta: f.kpis.filter(k => k.bajo_meta).map(k => k.corto + ' ' + Math.round(k.pct * 100) + '% (meta ' + Math.round(k.meta * 100) + '%)'), acciones: f.brechas.map(b => planDe(b)), recomendaciones: f.recomendaciones, observaciones: f.observaciones }));
  return { success: true, periodo, mes: MESES[+periodo.slice(5, 7) - 1] + ' ' + periodo.slice(0, 4), periodo_anterior: ant, generado: new Date().toISOString(), fuente: 'supabase',
    resumen: { equipo: equipo.length, evaluados: evaluados.length, pendientes: filas.filter(f => !f.evaluado).map(f => f.nombre), promedio: prom(evaluados.map(f => f.porcentaje)), promedio_anterior: promAnt,
      niveles, porEmpresa: Object.keys(porEmpresa).map(k => ({ empresa: k, promedio: prom(porEmpresa[k]), n: porEmpresa[k].length })),
      mejor: evaluados[0] ? { nombre: evaluados[0].nombre, porcentaje: evaluados[0].porcentaje } : null, menor: evaluados.length ? { nombre: evaluados[evaluados.length - 1].nombre, porcentaje: evaluados[evaluados.length - 1].porcentaje } : null,
      con_brechas: evaluados.filter(f => f.brechas.length).length, kpis_bajo_meta: evaluados.reduce((s, f) => s + f.kpis_bajo_meta, 0) },
    competencias, ranking: evaluados, plan_mejora: plan, pendientes: filas.filter(f => !f.evaluado) };
}
module.exports = { programa, guardarPrograma, pendientes, reporte, misma };
