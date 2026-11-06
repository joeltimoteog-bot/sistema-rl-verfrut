/* _ESTADM_AZURE_V1 (26-set-2026) — ESTADISTICAS ADMIN (getEstadisticasAdmin) calculadas en Azure.
   · Atenciones: directo de la tabla Atenciones (SQL agrupado, sin duplicados; memoria 60 s).
   · Visitas, Casos y Fusiones: filas minimas que manda el Apps Script (mod-importar, clave 'filas'),
     extraidas con las MISMAS columnas que getEstadisticasAdmin.
   Mismos filtros, mismos contadores, mismo formato de respuesta que Google.
   ─────────────────────────────────────────────────────────────────────────────────────────────
   _ESTADM_V2 (06-nov-2026), verificado con datos reales (tablas = copia de Google, mes a mes):
   · Visitas y Casos salen de sus TABLAS reales (al minuto). La copia de Google queda de respaldo y para Fusiones.
   · Empresa: un registro sin empresa ya NO cuenta en RAPEL y en VERFRUT a la vez; se informa como "sin empresa".
   · Atenciones sin fecha o con fecha imposible: se informan aparte (sinFecha) para que los meses cuadren con el total.
   · Ranking por supervisor: "Roberto Molero Abad" = "ROBERTO MOLERO ABAD" (una sola fila).
   · Comparativa justa: del dia 1 al dia de hoy de este mes vs el mismo tramo del mes anterior (comparativa).
   · fuente: de donde salen los datos y hasta cuando (se muestra en pantalla). */
'use strict';
const { getPool } = require('./db');
const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const limaHoy = () => new Date(Date.now() - 5 * 3600e3);
let atCache = null;   // { t, d, filas, ultimo }
async function atencionesAgrupadas() {
  const dia = limaHoy().getUTCDate();
  if (atCache && atCache.d === dia && Date.now() - atCache.t < 60000) return atCache;
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT supervisor AS s, UPPER(ISNULL(empresa, '')) AS e, UPPER(ISNULL(estado, '')) AS st,
           ISNULL(YEAR(fecha_atencion), 0) AS a, ISNULL(MONTH(fecha_atencion), 0) AS m, COUNT(*) AS n,
           SUM(CASE WHEN DAY(fecha_atencion) <= ${dia} THEN 1 ELSE 0 END) AS nd
    FROM dbo.Atenciones
    GROUP BY supervisor, UPPER(ISNULL(empresa, '')), UPPER(ISNULL(estado, '')), ISNULL(YEAR(fecha_atencion), 0), ISNULL(MONTH(fecha_atencion), 0);
    SELECT CONVERT(VARCHAR(19), MAX(fecha_registro), 126) AS u FROM dbo.Atenciones;`);
  const filas = r.recordsets[0].map(x => ({ supervisor: String(x.s || '').trim(), empresa: x.e, estado: x.st, mes: x.m, anio: x.a, n: x.n, nd: x.nd || 0 }));
  atCache = { t: Date.now(), d: dia, filas, ultimo: (r.recordsets[1][0] || {}).u || null };
  return atCache;
}
/* Visitas y Casos desde sus tablas (mismas columnas que _estAdmFilas_ del Apps Script: supervisor, empresa, estado, mes/anio de fecha_reg) */
let tbCache = null;
async function tablasVisCas() {
  const dia = limaHoy().getUTCDate();
  if (tbCache && tbCache.d === dia && Date.now() - tbCache.t < 60000) return tbCache;
  const pool = await getPool();
  const q = (t) => `SELECT supervisor AS s, UPPER(ISNULL(empresa, '')) AS e, UPPER(ISNULL(estado, '')) AS st,
      ISNULL(YEAR(fecha_reg), 0) AS a, ISNULL(MONTH(fecha_reg), 0) AS m, COUNT(*) AS n, SUM(CASE WHEN DAY(fecha_reg) <= ${dia} THEN 1 ELSE 0 END) AS nd
    FROM dbo.${t} GROUP BY supervisor, UPPER(ISNULL(empresa, '')), UPPER(ISNULL(estado, '')), ISNULL(YEAR(fecha_reg), 0), ISNULL(MONTH(fecha_reg), 0)`;
  const r = await pool.request().query(q('Visitas') + ';' + q('Casos') + ';');
  const map = (rs) => rs.map(x => ({ supervisor: String(x.s || '').trim(), empresa: x.e, estado: x.st, mes: x.m, anio: x.a, n: x.n, nd: x.nd || 0 }));
  tbCache = { t: Date.now(), d: dia, vis: map(r.recordsets[0]), cas: map(r.recordsets[1]) };
  return tbCache;
}

function crear(D) {
  const F = D.filas || {};
  const visG = (F.vis || []).map(x => ({ supervisor: x[0], empresa: x[1], estado: x[2], mes: x[3], anio: x[4], n: 1, nd: null }));
  const casG = (F.cas || []).map(x => ({ supervisor: x[0], empresa: x[1], estado: x[2], mes: x[3], anio: x[4], n: 1, nd: null }));
  const fus = (F.fus || []).map(x => ({ supervisor: x[0], empresa: '', estado: x[1], totalTrab: x[2] === null ? NaN : x[2], mes: x[3], anio: x[4], n: 1, nd: null }));

  async function getEstadisticasAdmin(p) {
    p = p || {};
    const lima = limaHoy();
    const mesActual = lima.getUTCMonth() + 1, anioActual = lima.getUTCFullYear(), diaHoy = lima.getUTCDate();
    const filtroEmp = String(p.empresa || '').toUpperCase();
    const filtroSup = String(p.supervisor || '').toLowerCase();
    const filtroMes = p.mes ? parseInt(p.mes) : 0;
    const filtroAnio = p.anio ? parseInt(p.anio) : 0;
    const conEmp = !!filtroEmp && filtroEmp !== 'AMBAS';
    /* _ESTADM_V2: sin empresa ya no cuenta en las dos; fusiones no tienen empresa y se mantienen */
    const filtrarBase = (arr, sinEmpOk) => arr.filter(x => (!conEmp || x.empresa === filtroEmp || (sinEmpOk && x.empresa === ''))
      && (!filtroSup || x.supervisor.toLowerCase().indexOf(filtroSup) !== -1));
    const filtrarFecha = (arr) => arr.filter(x => (!filtroAnio || x.anio === filtroAnio) && (!filtroMes || x.mes === filtroMes));
    const cuenta = (arr, f) => arr.reduce((s, x) => s + (f(x) ? x.n : 0), 0);
    const AT = await atencionesAgrupadas();
    let TB = null, fuenteVC = 'tablas';
    try { TB = await tablasVisCas(); } catch (e) { fuenteVC = 'copia de Google'; }
    const baseAt = filtrarBase(AT.filas, false), baseVi = filtrarBase(TB ? TB.vis : visG, false), baseCa = filtrarBase(TB ? TB.cas : casG, false), baseFu = filtrarBase(fus, true);
    const at = filtrarFecha(baseAt), vi = filtrarFecha(baseVi), ca = filtrarFecha(baseCa), fu = filtrarFecha(baseFu);
    const refAnio = filtroAnio || anioActual;
    const esteMes = x => x.mes === mesActual && x.anio === refAnio;
    const fin = x => x.estado === 'FINALIZADO' || x.estado === 'RESUELTO' || x.estado === 'ENVIADO';   /* _IND_ENVIADO_V1: ENVIADO = atendido */
    const ret = x => x.estado.indexOf('RETRAS') !== -1;
    const sinFecha = x => !x.anio || x.anio < 2015 || x.anio > anioActual + 1;
    const stats = {
      atenciones: { total: cuenta(at, () => true), enProceso: cuenta(at, x => x.estado === 'EN PROCESO'), finalizados: cuenta(at, fin), esteMes: cuenta(at, esteMes),
        sinFecha: cuenta(at, sinFecha), sinEmpresa: conEmp ? 0 : cuenta(at, x => x.empresa === '') },
      visitas: { total: cuenta(vi, () => true), enPlazo: cuenta(vi, x => !ret(x)), retrasadas: cuenta(vi, ret), esteMes: cuenta(vi, esteMes) },
      casos: { total: cuenta(ca, () => true), enPlazo: cuenta(ca, x => !ret(x)), retrasados: cuenta(ca, ret), esteMes: cuenta(ca, esteMes) },
      fusiones: { total: fu.length, pendientes: cuenta(fu, x => x.estado === 'PENDIENTE'), validados: cuenta(fu, x => x.estado === 'VALIDADO'),
        trabajadores: fu.reduce((s, x) => s + (isFinite(x.totalTrab) ? x.totalTrab : 0), 0), esteMes: cuenta(fu, esteMes) }
    };
    /* _ESTADM_V2: una fila por persona aunque el nombre este escrito con otras mayusculas/tildes/espacios */
    const porSupervisor = {}, clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const mejorNombre = (a, b) => { const mix = s => s !== s.toUpperCase(); return !a ? b : (!mix(a) && mix(b) ? b : a); };
    function acumSup(arr, modulo) {
      arr.forEach(x => {
        const k = clave(x.supervisor) || 'sin asignar', s = x.supervisor || 'Sin asignar';
        if (!porSupervisor[k]) porSupervisor[k] = { nombre: s, atenciones: 0, atEnProceso: 0, atFinalizados: 0, visitas: 0, viRetrasadas: 0, casos: 0, caRetrasados: 0, fusiones: 0 };
        const o = porSupervisor[k]; o.nombre = mejorNombre(o.nombre, s);
        if (modulo === 'at') { o.atenciones += x.n; if (x.estado === 'EN PROCESO') o.atEnProceso += x.n; if (fin(x)) o.atFinalizados += x.n; }
        if (modulo === 'vis') { o.visitas += x.n; if (ret(x)) o.viRetrasadas += x.n; }
        if (modulo === 'cas') { o.casos += x.n; if (ret(x)) o.caRetrasados += x.n; }
        if (modulo === 'fus') o.fusiones++;
      });
    }
    acumSup(at, 'at'); acumSup(vi, 'vis'); acumSup(ca, 'cas'); acumSup(fu, 'fus');
    const porSup = {}; Object.keys(porSupervisor).forEach(k => { porSup[porSupervisor[k].nombre] = porSupervisor[k]; });
    /* tendencia: ultimos 6 meses del ano consultado; el filtro de MES no la vacia (solo afecta las tarjetas) */
    const tendencia = [];
    for (let t = 5; t >= 0; t--) {
      const td = new Date(Date.UTC(anioActual, lima.getUTCMonth() - t, 1));
      const tMes = td.getUTCMonth() + 1;
      const tAnio = filtroAnio ? (filtroAnio + (td.getUTCFullYear() - anioActual)) : td.getUTCFullYear();
      const del = x => x.mes === tMes && x.anio === tAnio;
      tendencia.push({ label: LABELS[tMes - 1], atenciones: cuenta(baseAt, del), visitas: cuenta(baseVi, del), casos: cuenta(baseCa, del), fusiones: cuenta(baseFu, del) });
    }
    /* comparativa justa: dia 1..hoy de este mes vs el mismo tramo del mes anterior */
    const ant = new Date(Date.UTC(anioActual, lima.getUTCMonth() - 1, 1)), mA = ant.getUTCMonth() + 1, aA = ant.getUTCFullYear();
    const tramo = (arr, mm, aa) => arr.reduce((s, x) => s + (x.mes === mm && x.anio === aa ? (x.nd == null ? x.n : x.nd) : 0), 0);
    const comparativa = { dia: diaHoy, actual: { label: LABELS[mesActual - 1], anio: anioActual }, anterior: { label: LABELS[mA - 1], anio: aA },
      atenciones: [tramo(baseAt, mesActual, anioActual), tramo(baseAt, mA, aA)],
      visitas: TB ? [tramo(baseVi, mesActual, anioActual), tramo(baseVi, mA, aA)] : null,
      casos: TB ? [tramo(baseCa, mesActual, anioActual), tramo(baseCa, mA, aA)] : null };
    const fuente = { origen: 'Supabase', atencionesHasta: AT.ultimo, visitasCasos: fuenteVC, fusiones: 'copia de Google', calculado: new Date().toISOString() };
    return { success: true, data: { stats, porSupervisor: porSup, tendencia, comparativa, fuente, filtros: { anio: filtroAnio || '', mes: filtroMes || '' } } };
  }
  return { getEstadisticasAdmin };
}
module.exports = { crear };
