/* ═══════════════════════════════════════════════════════════════════════════
   informe-gh (_INFORME_GENERAL_GH_V1, 10-nov-2026) — Informe General de Gestión Humana
   POST /api/informe-gh/datos   { desde:'aaaa-mm-dd', hasta:'aaaa-mm-dd', empresa:'RAPEL'|'VERFRUT'|'', sector:'' }
   SOLO el creador del sistema (jtimoteo). Quien llama sale del token de sesion del Sistema RR.LL.
   (Authorization: Bearer, validado con shared/auth.verificarSoloRL, igual que kpi y usuarios-lista).
   Nada del cuerpo ni de la URL identifica al usuario: sin token valido -> 401; otro usuario -> 403.
   Solo LEE (ningun INSERT / UPDATE / DELETE propio). Cada bloque es independiente: si su tabla no
   existe o falla, el bloque sale { ok:false, motivo } y los demas siguen.
   Fuentes (todas en Supabase):
     rl.atenciones · rl.casos y rl.visitas (shared/tablas-cv) · rl.fusiones_buses · rl.horas_registros
     rl.eti_evaluaciones (shared/eti-eval) · rl.bs_* (shared/tablas-hoja) · KPIs (shared/kpi-db + kpi-motor)
     eti.capacitaciones y eti.programaciones_eti (id, datos jsonb)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const AUTH = require('../shared/auth');

const SOLO_USUARIO = 'jtimoteo';          /* creador del sistema: unico que puede pedir este informe */
const MAX_DIAS = 366;                     /* rango maximo: un año */
const META_ETI = 0.95;

/* sector -> empresa y alias de sector: la misma tabla que usan los informes ETI
   (Sistema - Evaluacion Eti/js/16-alertas-ref-v1.js EMP_SECTOR y 20-informe-capacitaciones-v1.js ALIAS) */
const EMP_SECTOR = { 'EL PAPAYO': 'RAPEL', 'LIMONES': 'RAPEL', 'LOS OLIVARES': 'RAPEL', 'APROA': 'RAPEL', 'ALGARROBOS': 'RAPEL',
  'SAN VICENTE': 'RAPEL', 'PLANTA RAPEL': 'RAPEL', 'OLIVARES BAJO': 'VERFRUT', 'SANTA ROSA': 'VERFRUT', 'PUNTA ARENAS': 'VERFRUT', 'SAN RAFAEL': 'VERFRUT' };
const ALIAS = { 'PAPAYO': 'EL PAPAYO', 'OLIVARES APROA': 'APROA', 'PLANTA': 'PLANTA RAPEL', 'SANTA ROSA I': 'SANTA ROSA', 'SANTA ROSA II': 'SANTA ROSA',
  'SANTA ROSA 1': 'SANTA ROSA', 'SANTA ROSA 2': 'SANTA ROSA' };

const p2 = n => (n < 10 ? '0' : '') + n;
const U = s => String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
const sinTilde = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const secKey = s => { const x = sinTilde(U(s)).replace(/^SECTOR\s+/, ''); return ALIAS[x] || x; };
const empKey = e => { const x = U(e); return /RAPEL/.test(x) ? 'RAPEL' : /VERFRUT/.test(x) ? 'VERFRUT' : x.replace(/\s*S\.?\s*A\.?\s*C\.?$/, ''); };
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
const r2 = n => Math.round(n * 100) / 100;
const fechaOk = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T00:00:00Z'))) ? String(s) : null;
const masDias = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const hoyLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

/* fecha de la base -> dia de Lima 'aaaa-mm-dd'. Una fecha guardada a medianoche UTC es "solo fecha" y se toma tal cual. */
function diaLima(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    if (isNaN(v)) return '';
    const iso = v.toISOString();
    return iso.slice(11, 19) === '00:00:00' ? iso.slice(0, 10) : new Date(v.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/);
  if (m) {
    if (m[4] && m[4] !== '00:00:00' && /(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const d = new Date(s); if (!isNaN(d)) return diaLima(d); }
    return m[1] + '-' + m[2] + '-' + m[3];
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + p2(+m[2]) + '-' + p2(+m[1]);
  return '';
}
/* celda de shared/tablas-hoja ({ $d, $s }) -> valor plano; fechas a 'aaaa-mm-dd' de Lima (= plano() de bs/index.js) */
const MES3 = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
function plano(c) {
  if (c && typeof c === 'object' && ('$d' in c || '$s' in c)) {
    const m = String(c.$s || '').match(/^\w{3} (\w{3}) (\d{2}) (\d{4})/);
    if (m && MES3[m[1]]) return m[3] + '-' + MES3[m[1]] + '-' + m[2];
    if (c.$d) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
    return '';
  }
  return c == null ? '' : c;
}
const anulado = o => { const a = o.anulado; return a === true || /^(s|si|sí|true|1)(\b|$)/i.test(String(a || '').trim()); };   /* = bs/index.js */

/* contador por clave -> lista ordenada [{ k, n, ... }] */
function Cuenta() { this.m = {}; }
Cuenta.prototype.mas = function (k, n, extra) {
  k = String(k == null ? '' : k).trim() || '(Sin dato)';
  const o = this.m[k] || (this.m[k] = { k: k, n: 0 });
  o.n += (n === undefined ? 1 : n);
  if (extra) Object.keys(extra).forEach(x => { o[x] = (o[x] || 0) + extra[x]; });
  return o;
};
Cuenta.prototype.lista = function (tope) {
  const L = Object.keys(this.m).map(k => this.m[k]).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  if (!tope || L.length <= tope) return L;
  const resto = L.slice(tope), o = { k: 'Otros (' + resto.length + ')', n: 0 };
  resto.forEach(x => { Object.keys(x).forEach(c => { if (c !== 'k') o[c] = (o[c] || 0) + x[c]; }); });
  return L.slice(0, tope).concat([o]);
};

/* ¿el registro entra en el alcance pedido?  A = { empresa, sector } (ya normalizados; '' = sin filtro) */
function enAlcance(A, empresa, sector, sectorPrimero) {
  if (A.sector) return secKey(sector) === A.sector;
  if (!A.empresa) return true;
  const porSector = EMP_SECTOR[secKey(sector)] || '', porEmpresa = empresa ? empKey(empresa) : '';
  return (sectorPrimero ? (porSector || porEmpresa) : (porEmpresa || porSector)) === A.empresa;
}

function sesion(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return AUTH.verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}

/* ───────────────────────── BLOQUES ───────────────────────── */

/* 1) Atenciones al trabajador — rl.atenciones (columnas comprobadas en atenciones-create/index.js y atenciones-stats/index.js) */
async function bAtenciones(pool, P, A) {
  const r = await pool.request().input('d', sql.Date, P.desde).input('h', sql.Date, masDias(P.hasta, 1)).query(`
    SELECT anio, mes, empresa, fundo, supervisor, detalle_documento, estado, COUNT(*) AS n
    FROM dbo.Atenciones
    WHERE fecha_atencion >= @d AND fecha_atencion < @h
    GROUP BY anio, mes, empresa, fundo, supervisor, detalle_documento, estado`);
  const tipo = new Cuenta(), resp = new Cuenta(), emp = new Cuenta(), est = new Cuenta(), mes = new Cuenta(), sec = new Cuenta();
  let total = 0;
  r.recordset.forEach(x => {
    if (!enAlcance(A, x.empresa, x.fundo, false)) return;
    const n = Number(x.n) || 0; total += n;
    tipo.mas(x.detalle_documento, n); resp.mas(x.supervisor, n); emp.mas(empKey(x.empresa), n); est.mas(U(x.estado), n); sec.mas(x.fundo, n);
    if (x.anio && x.mes) mes.mas(x.anio + '-' + p2(Number(x.mes)), n);
  });
  const E = est.m, fin = ((E.FINALIZADO || {}).n || 0) + ((E.ENVIADO || {}).n || 0);   /* ENVIADO = atendido (atenciones-stats) */
  return { total, finalizadas: fin, enProceso: (E['EN PROCESO'] || {}).n || 0, porTipo: tipo.lista(25), porResponsable: resp.lista(40), porEmpresa: emp.lista(),
    porEstado: est.lista(), porSector: sec.lista(25), porMes: mes.lista().sort((a, b) => a.k.localeCompare(b.k)) };
}

/* 2) Visitas a campo y 4) Casos — rl.visitas / rl.casos por shared/tablas-cv.leerCV (misma lectura de las pantallas) */
async function leerCV(pool) {
  const TC = require('../shared/tablas-cv');
  const d = await TC.leerCV(pool);
  if (!d) throw new Error('Las tablas de Casos y Visitas aún no tienen marca de carga (CV_Estado)');
  return d;
}
async function bVisitas(pool, P, A, cv) {
  const d = await cv;
  const sup = new Cuenta(), sec = new Cuenta(), est = new Cuenta(), emp = new Cuenta();
  let total = 0, conInforme = 0, conRetraso = 0;
  d.visitas.forEach(v => {
    const f = diaLima(v.fecha_inicio) || diaLima(v.fecha_reg);
    if (!(f >= P.desde && f <= P.hasta) || !enAlcance(A, v.empresa, v.fundo, false)) return;
    const inf = /^https?:/i.test(String(v.enlace_informe || '')) ? 1 : 0, ret = (Number(v.dias_retraso) || 0) > 0 ? 1 : 0;
    total++; conInforme += inf; conRetraso += ret;
    sup.mas(v.supervisor, 1, { conInforme: inf, conRetraso: ret }); sec.mas(v.fundo); est.mas(U(v.estado)); emp.mas(empKey(v.empresa));
  });
  return { total, conInforme, conRetraso, porSupervisor: sup.lista(40), porSector: sec.lista(25), porEstado: est.lista(), porEmpresa: emp.lista() };
}
async function bCasos(pool, P, A, cv) {
  const d = await cv;
  const sup = new Cuenta(), est = new Cuenta(), ges = new Cuenta(), gra = new Cuenta(), mot = new Cuenta(), sec = new Cuenta(), emp = new Cuenta();
  let total = 0, conInforme = 0, conRetraso = 0;
  d.casos.forEach(c => {
    const f = diaLima(c.fecha_reg);
    if (!c.nro || !(f >= P.desde && f <= P.hasta) || !enAlcance(A, c.empresa, c.sector, false)) return;
    const inf = /^https?:/i.test(String(c.enlace_informe || '')) ? 1 : 0, ret = (Number(c.dias_retraso) || 0) > 0 ? 1 : 0;
    total++; conInforme += inf; conRetraso += ret;
    sup.mas(c.supervisor, 1, { conInforme: inf, conRetraso: ret }); est.mas(U(c.estado)); ges.mas(U(c.estado_gestion)); gra.mas(U(c.gravedad));
    mot.mas(c.motivo); sec.mas(c.sector); emp.mas(empKey(c.empresa));
  });
  return { total, conInforme, conRetraso, pctInforme: total ? conInforme / total : null, porSupervisor: sup.lista(40), porEstado: est.lista(), porGestion: ges.lista(),
    porGravedad: gra.lista(), porMotivo: mot.lista(15), porSector: sec.lista(25), porEmpresa: emp.lista() };
}

/* 3) Fusiones de buses — rl.fusiones_buses (columnas: shared/tablas-hoja ESQ.fus_buses). No tiene empresa: sale del sector. */
async function bFusiones(pool, P, A) {
  const r = await pool.request().input('d', sql.DateTime2, new Date(masDias(P.desde, -1) + 'T00:00:00Z')).input('h', sql.DateTime2, new Date(masDias(P.hasta, 2) + 'T00:00:00Z')).query(`
    SELECT fecha, sector, supervisor, cant_buses, total_trab, motivo, estado
    FROM dbo.Fusiones_Buses WHERE fecha >= @d AND fecha < @h`);
  const sup = new Cuenta(), sec = new Cuenta(), mot = new Cuenta(), est = new Cuenta();
  let total = 0, buses = 0, trab = 0;
  r.recordset.forEach(x => {
    const f = diaLima(x.fecha);
    if (!(f >= P.desde && f <= P.hasta) || !enAlcance(A, '', x.sector, true)) return;
    total++; buses += num(x.cant_buses); trab += num(x.total_trab);
    sup.mas(x.supervisor, 1, { trab: num(x.total_trab) }); sec.mas(x.sector, 1, { trab: num(x.total_trab) }); mot.mas(x.motivo); est.mas(x.estado);
  });
  return { total, buses, trabajadores: trab, porSupervisor: sup.lista(40), porSector: sec.lista(25), porMotivo: mot.lista(12), porEstado: est.lista() };
}

/* 5) Capacitaciones ETI — eti.capacitaciones + eti.programaciones_eti (id, datos jsonb; ver eti/index.js).
      Misma regla del Informe de Capacitaciones ETI: una fecha esta ejecutada si figura en fechasEjecutadas o la
      programacion esta "ejecutada"; cumplimiento = ejecutadas / (ejecutadas + vencidas); meta 95 %. */
async function bCapEti(P, A) {
  const db = require('../shared/db');
  if (typeof db.pgDirecto !== 'function') throw new Error('Este bloque solo funciona con Supabase');
  const pg = db.pgDirecto();
  const [qc, qp] = await Promise.all([
    pg.query(`SELECT id, datos FROM eti.capacitaciones WHERE (datos->>'fechaEjecucion') >= $1 AND (datos->>'fechaEjecucion') < $2`, [P.desde, masDias(P.hasta, 1)]),
    pg.query(`SELECT id, datos FROM eti.programaciones_eti`)]);
  const hoy = hoyLima();
  const CAP = qc.rows.map(x => x.datos || {}).filter(x => !(x.eliminado || x.anulado || x.eliminada) && enAlcance(A, x.empresa, x.sector, true));
  const PRG = qp.rows.map(x => x.datos || {}).filter(x => /CAPACITACI/i.test(x.tema || '') && enAlcance(A, x.empresa, x.sector, true)).map(x => {
    const f = (Array.isArray(x.fechas) && x.fechas.length ? x.fechas.slice() : [x.fechaProgramada, x.fechaFin || x.fechaProgramada].filter(Boolean));
    return { sector: x.sector, supervisor: x.supervisor, estado: x.estado, fechas: f.map(v => String(v).slice(0, 10)).sort(),
      ejecutadas: (Array.isArray(x.fechasEjecutadas) ? x.fechasEjecutadas : []).map(v => String(v).slice(0, 10)), reprog: Array.isArray(x.reprogramaciones) ? x.reprogramaciones : [] };
  });
  const cumpl = L => {
    const c = { prog: 0, ejec: 0, venc: 0, fut: 0 };
    L.forEach(p => p.fechas.filter(f => f >= P.desde && f <= P.hasta).forEach(f => {
      const ok = p.estado === 'ejecutada' || p.ejecutadas.indexOf(f) >= 0; c.prog++; c[ok ? 'ejec' : f < hoy ? 'venc' : 'fut']++; }));
    c.pct = c.ejec + c.venc ? c.ejec / (c.ejec + c.venc) : null; return c;
  };
  const tot = { sesiones: CAP.length, capacitados: 0, hombres: 0, mujeres: 0, actasPlazo: 0, actasFuera: 0, sinActa: 0 };
  const porSec = {}, tema = new Cuenta();
  const secNom = s => { const k = secKey(s); return k ? k.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase()) : '(Sin sector)'; };
  CAP.forEach(x => {
    const t = Number(x.total) || ((Number(x.varones) || 0) + (Number(x.mujeres) || 0)), k = secNom(x.sector);
    const acta = x.fechaEnvio ? (x.fechaLimite && String(x.fechaEnvio).slice(0, 10) > String(x.fechaLimite).slice(0, 10) ? 'actasFuera' : 'actasPlazo') : 'sinActa';
    tot.capacitados += t; tot.hombres += Number(x.varones) || 0; tot.mujeres += Number(x.mujeres) || 0; tot[acta]++;
    const s = porSec[k] || (porSec[k] = { sector: k, sesiones: 0, capacitados: 0, lista: [] }); s.sesiones++; s.capacitados += t;
    tema.mas(x.tema, 1, { capacitados: t });
  });
  PRG.forEach(p => { const k = secNom(p.sector); (porSec[k] || (porSec[k] = { sector: k, sesiones: 0, capacitados: 0, lista: [] })).lista.push(p); });
  const sectores = Object.keys(porSec).sort().map(k => { const s = porSec[k], c = cumpl(s.lista);
    return { sector: k, empresa: EMP_SECTOR[secKey(k)] || '', sesiones: s.sesiones, capacitados: s.capacitados, c }; }).filter(s => s.sesiones || s.c.prog);
  let reprog = 0;
  PRG.forEach(p => p.reprog.forEach(r => { const ant = String(r.fechaAnteriorIni || (r.fechasAnterior || [])[0] || '').slice(0, 10); if (ant >= P.desde && ant <= P.hasta) reprog++; }));
  return { meta: META_ETI, cumpl: cumpl(PRG), tot, sectores, porTema: tema.lista(15), reprogramaciones: reprog };
}

/* 6) Evaluaciones ETI — rl.eti_evaluaciones por shared/eti-eval.stats (la misma consulta de /api/etieval/stats) */
async function bEvalEti(pool, P, A) {
  const E = require('../shared/eti-eval');
  const filas = await E.stats(pool, { desde: P.desde, hasta: P.hasta });
  const sec = {}, mod = new Cuenta();
  let n = 0, sr = 0, apr = 0, regs = 0;
  filas.forEach(f => {
    if (!enAlcance(A, f.empresa, f.sector, false)) return;
    n += f.n; sr += f.sr; apr += f.apr; regs += f.regs; mod.mas(f.modalidad, f.n);
    const k = secKey(f.sector) || '(SIN SECTOR)', s = sec[k] || (sec[k] = { sector: k, empresa: empKey(f.empresa) || EMP_SECTOR[k] || '', n: 0, sr: 0, apr: 0, rutas: {} });
    s.n += f.n; s.sr += f.sr; s.apr += f.apr; if (f.ruta || f.codigo) s.rutas[(f.codigo || '') + '|' + (f.ruta || '')] = 1;
  });
  return { evaluados: n, registros: regs, promedio: n ? sr / n : null, aprobados: apr, pctAprobados: n ? apr / n : null, minimo: 0.7, porModalidad: mod.lista(),
    porSector: Object.keys(sec).sort().map(k => ({ sector: sec[k].sector, empresa: sec[k].empresa, evaluados: sec[k].n, promedio: sec[k].n ? sec[k].sr / sec[k].n : null,
      aprobados: sec[k].apr, rutas: Object.keys(sec[k].rutas).length })) };
}

/* 7) Bienestar Social — tablas rl.bs_* por shared/tablas-hoja.leer (como bs/index.js). Solo conteos: sin nombres ni DNI. */
async function bBienestar(pool, P, A) {
  const H = require('../shared/tablas-hoja');
  const objetos = async (clave) => {
    try {
      const d = await H.leer(pool, clave); if (!d) return null;
      const enc = d.encabezado.map(plano).map(String);
      return d.filas.map(f => { const o = {}; enc.forEach((k, i) => { if (k) o[k] = plano(f[i]); }); return o; }).filter(o => !anulado(o));
    } catch (e) { return null; }
  };
  const en = (f) => { const d = diaLima(f); return d >= P.desde && d <= P.hasta; };
  const [acc, des, sub, que, hos] = await Promise.all(['bs_accidentes_casos', 'bs_descansos', 'bs_subsidios', 'bs_quejas', 'bs_hostigamiento'].map(objetos));
  const out = { accidentes: null, descansos: null, subsidios: null, quejas: null, hostigamiento: null };
  if (acc) { const L = acc.filter(o => en(o.dia_accidente) && enAlcance(A, o.empresa, o.fundo, false)), t = new Cuenta(), e = new Cuenta();
    L.forEach(o => { t.mas(o.tipo_accidente); e.mas(o.estado_caso); });
    out.accidentes = { total: L.length, abiertos: L.filter(o => !/cerrad|finaliz/i.test(String(o.estado_caso || ''))).length, porTipo: t.lista(10), porEstado: e.lista() }; }
  if (des) { const L = des.filter(o => en(o.fecha_inicio) && enAlcance(A, o.empresa, o.sector, false)), t = new Cuenta(); let dias = 0;
    L.forEach(o => { dias += num(o.dias); t.mas(o.tipo, 1, { dias: num(o.dias) }); });
    out.descansos = { total: L.length, dias, porTipo: t.lista(10) }; }
  if (sub && !A.sector) { const L = sub.filter(o => en(o.inicio) && enAlcance(A, o.empresa, '', false)), e = new Cuenta(); let dias = 0;   /* subsidios no tiene sector */
    L.forEach(o => { dias += num(o.dias); e.mas(o.estado_general, 1, { dias: num(o.dias) }); });
    out.subsidios = { total: L.length, dias, porEstado: e.lista(10) }; }
  if (que) { const L = que.filter(o => en(o.fecha_recepcion) && enAlcance(A, o.empresa, o.sector, false)), c = new Cuenta(), g = new Cuenta();
    L.forEach(o => { c.mas(o.clasificacion); g.mas(o.categoria); });
    out.quejas = { total: L.length, porClasificacion: c.lista(10), porCategoria: g.lista(10) }; }
  if (hos) { const L = hos.filter(o => en(o.fecha_denuncia) && enAlcance(A, o.empresa, o.fundo, false)), e = new Cuenta();
    L.forEach(o => e.mas(o.status));
    out.hostigamiento = { total: L.length, porEstado: e.lista() }; }
  if (!acc && !des && !sub && !que && !hos) throw new Error('Las tablas de Bienestar Social aún no están cargadas en la base');
  return out;
}

/* 8) Acumulación de horas — rl.horas_registros (columnas: shared/tablas-hoja ESQ.horas_registros). No tiene sector. */
async function bHoras(pool, P, A) {
  if (A.sector) return { ok: false, motivo: 'El registro de horas no guarda el sector del trabajador: este cuadro solo sale en el alcance general o por empresa.' };
  const r = await pool.request().input('d', sql.DateTime2, new Date(masDias(P.desde, -1) + 'T00:00:00Z')).input('h', sql.DateTime2, new Date(masDias(P.hasta, 2) + 'T00:00:00Z')).query(`
    SELECT fecha_registro, registrado_por, empresa, motivo, estado, horas_acumuladas, horas_permiso, horas_deuda
    FROM dbo.Horas_Registros WHERE fecha_registro >= @d AND fecha_registro < @h`);
  const mot = new Cuenta(), reg = new Cuenta(), emp = new Cuenta();
  let n = 0, acum = 0, perm = 0, deuda = 0, rech = 0;
  r.recordset.forEach(x => {
    const f = diaLima(x.fecha_registro);
    if (!(f >= P.desde && f <= P.hasta) || !enAlcance(A, x.empresa, '', false)) return;
    if (String(x.estado || '').toLowerCase() === 'rechazado') { rech++; return; }   /* igual que el saldo de mod-horas: los rechazados no suman */
    const a = num(x.horas_acumuladas), p = num(x.horas_permiso), d = num(x.horas_deuda);
    n++; acum += a; perm += p; deuda += d;
    mot.mas(x.motivo, 1, { acum: a, perm: p, deuda: d }); reg.mas(String(x.registrado_por || '').toLowerCase(), 1); emp.mas(empKey(x.empresa), 1, { acum: a, perm: p, deuda: d });
  });
  return { registros: n, rechazados: rech, acumuladas: r2(acum), permiso: r2(perm), deuda: r2(deuda), saldo: r2(acum - perm - deuda),
    porMotivo: mot.lista(15), porRegistrador: reg.lista(30), porEmpresa: emp.lista() };
}

/* 9) Desempeño por supervisor / sector — KPIs oficiales (shared/kpi-db.cargar + kpi-motor.calcular, lo mismo que /api/kpi/tablero).
      Aqui NO se vuelve a copiar la programacion ETI: se usa la ultima copia que dejo el modulo de KPIs. */
async function bKpis(pool, P, A) {
  const KDB = require('../shared/kpi-db'), K = require('../shared/kpi-motor');
  if (P.hasta < K.PERIODO.ini) return { ok: false, motivo: 'La medición de KPIs del equipo inicia el ' + K.PERIODO.ini.split('-').reverse().join('/') + ': el periodo pedido es anterior.' };
  const B = await KDB.cargar(pool);
  const d = KDB.calcularCon(B, KDB.hoyLima(), P.desde < K.PERIODO.ini ? K.PERIODO.ini : P.desde, P.hasta);
  const personas = (d.personas || []).filter(p => {
    if (A.sector) return (p.sectores || []).some(s => secKey(s) === A.sector);
    if (A.empresa) return empKey(p.empresa) === A.empresa;
    return true;
  }).map(p => ({ usuario: p.usuario, nombre: p.nombre, tipo: p.tipo, puesto: p.puesto, empresa: empKey(p.empresa), sectores: p.sectores || [], nota: p.nota, cumpl: p.cumpl,
    kpis: (p.kpis || []).map(k => ({ codigo: k.codigo, corto: k.corto, meta: k.meta, estado: k.estado, num: k.num, den: k.den, pct: k.pct == null ? null : k.pct, nivel: k.nivel || null })) }));
  return { desde: d.rango && d.rango.desde ? d.rango.desde : (P.desde < K.PERIODO.ini ? K.PERIODO.ini : P.desde), inicioMedicion: K.PERIODO.ini, copiaEti: d.eti_sync || null, personas };
}

/* ───────────────────────── ENTRADA ───────────────────────── */
module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const res = (status, body) => { context.res = { status, headers: { 'Cache-Control': 'no-store' }, body }; };
  try {
    /* 1. quien llama: SOLO el token firmado (nunca el cuerpo ni la URL) */
    const t = sesion(req);
    if (!t || !t.usuario) return res(401, { success: false, error: 'Sin sesion valida' });
    if (String(t.usuario).trim().toLowerCase() !== SOLO_USUARIO) return res(403, { success: false, error: 'Este informe es solo para el creador del sistema' });
    if (accion !== 'datos') return res(404, { success: false, error: 'Accion desconocida: ' + accion });

    /* 2. filtros del informe (no identifican a nadie) */
    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const P = { desde: fechaOk(b.desde), hasta: fechaOk(b.hasta) };
    if (!P.desde || !P.hasta || P.desde > P.hasta) return res(400, { success: false, error: 'Indica el periodo (desde y hasta, aaaa-mm-dd)' });
    if ((Date.parse(P.hasta) - Date.parse(P.desde)) / 86400000 > MAX_DIAS) return res(400, { success: false, error: 'El periodo máximo es de un año' });
    const empresa = ['RAPEL', 'VERFRUT'].indexOf(U(b.empresa)) >= 0 ? U(b.empresa) : '';
    const sector = b.sector ? secKey(String(b.sector).slice(0, 80)) : '';
    const A = { empresa: sector ? '' : empresa, sector };

    const pool = await getPool();
    const B = async (fn) => { const t0 = Date.now();
      try { const r = await fn(); return Object.assign({ ok: true }, r, { ms: Date.now() - t0 }); }
      catch (e) { context.log.warn('[informe-gh] bloque: ' + e.message); return { ok: false, motivo: 'No se pudo leer de la base: ' + String(e.message || e).slice(0, 200), ms: Date.now() - t0 }; } };
    const cv = leerCV(pool); cv.catch(() => {});
    const [atenciones, visitas, fusiones, casos, capEti, evalEti, bienestar, horas, kpis] = await Promise.all([
      B(() => bAtenciones(pool, P, A)), B(() => bVisitas(pool, P, A, cv)), B(() => bFusiones(pool, P, A)), B(() => bCasos(pool, P, A, cv)),
      B(() => bCapEti(P, A)), B(() => bEvalEti(pool, P, A)), B(() => bBienestar(pool, P, A)), B(() => bHoras(pool, P, A)), B(() => bKpis(pool, P, A))]);

    return res(200, { success: true, version: 1, generado: new Date().toISOString(), hoy: hoyLima(), emitidoPor: SOLO_USUARIO,
      periodo: P, alcance: { empresa: A.empresa, sector: A.sector, empresaDelSector: A.sector ? (EMP_SECTOR[A.sector] || '') : '' },
      bloques: { atenciones, visitas, fusiones, casos, capEti, evalEti, bienestar, horas, kpis } });
  } catch (err) {
    context.log.error('[informe-gh] ' + accion + ': ' + err.message);
    return res(500, { success: false, error: err.message });
  }
};
module.exports._t = { diaLima, secKey, empKey, enAlcance, Cuenta, plano };
