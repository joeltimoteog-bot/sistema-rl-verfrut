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
const { ADMINS_EVAL360 } = require('./e360-guardar');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const p2 = n => (n < 10 ? '0' : '') + n;
const S = v => (v && typeof v === 'object' && typeof v.$d === 'string') ? (v.$s || v.$d) : String(v == null ? '' : v);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
/* misma persona si comparten ≥ 2 palabras (apellidos / nombres), como el recordatorio del panel */
function misma(a, b) { const A = norm(a).split(' ').filter(w => w.length > 2), B = ' ' + norm(b) + ' '; let n = 0; A.forEach(w => { if (B.indexOf(' ' + w + ' ') >= 0) n++; }); return n >= 2; }
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
    if (per === periodo) out.push({ id: S(r[0]), supervisor: S(r[3]).trim(), evaluador: S(r[2]), porcentaje: Number(S(r[13])) || 0, nivel: S(r[14]) });
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
module.exports = { programa, guardarPrograma, pendientes, misma };
