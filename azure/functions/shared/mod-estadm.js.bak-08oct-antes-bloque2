/* _ESTADM_AZURE_V1 (26-set-2026) — ESTADISTICAS ADMIN (getEstadisticasAdmin) calculadas en Azure.
   · Atenciones: directo de la tabla Atenciones (SQL agrupado, sin duplicados; memoria 60 s).
   · Visitas, Casos y Fusiones: filas minimas que manda el Apps Script (mod-importar, clave 'filas'),
     extraidas con las MISMAS columnas que getEstadisticasAdmin.
   Mismos filtros, mismos contadores, mismo formato de respuesta que Google. */
'use strict';
const { getPool } = require('./db');
const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

let atCache = null;   // { t, filas }
async function atencionesAgrupadas() {
  if (atCache && Date.now() - atCache.t < 60000) return atCache.filas;
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT supervisor COLLATE Latin1_General_BIN2 AS s, UPPER(ISNULL(empresa, '')) AS e, UPPER(ISNULL(estado, '')) AS st,
           ISNULL(YEAR(fecha_atencion), 0) AS a, ISNULL(MONTH(fecha_atencion), 0) AS m, COUNT(*) AS n
    FROM dbo.Atenciones WITH (NOLOCK)
    GROUP BY supervisor COLLATE Latin1_General_BIN2, UPPER(ISNULL(empresa, '')), UPPER(ISNULL(estado, '')),
             ISNULL(YEAR(fecha_atencion), 0), ISNULL(MONTH(fecha_atencion), 0)`);
  const filas = r.recordset.map(x => ({ supervisor: String(x.s || '').trim(), empresa: x.e, estado: x.st, mes: x.m, anio: x.a, n: x.n }));
  atCache = { t: Date.now(), filas };
  return filas;
}

function crear(D) {
  const F = D.filas || {};
  const vis = (F.vis || []).map(x => ({ supervisor: x[0], empresa: x[1], estado: x[2], mes: x[3], anio: x[4], n: 1 }));
  const cas = (F.cas || []).map(x => ({ supervisor: x[0], empresa: x[1], estado: x[2], mes: x[3], anio: x[4], n: 1 }));
  const fus = (F.fus || []).map(x => ({ supervisor: x[0], empresa: '', estado: x[1], totalTrab: x[2] === null ? NaN : x[2], mes: x[3], anio: x[4], n: 1 }));

  async function getEstadisticasAdmin(p) {
    p = p || {};
    const lima = new Date(Date.now() - 5 * 3600e3);
    const mesActual = lima.getUTCMonth() + 1, anioActual = lima.getUTCFullYear();
    const filtroEmp = String(p.empresa || '').toUpperCase();
    const filtroSup = String(p.supervisor || '').toLowerCase();
    const filtroMes = p.mes ? parseInt(p.mes) : 0;
    const filtroAnio = p.anio ? parseInt(p.anio) : 0;
    function applyFilters(arr) {
      let out = arr;
      if (filtroEmp && filtroEmp !== 'AMBAS') out = out.filter(x => x.empresa === filtroEmp || x.empresa === '');
      if (filtroSup) out = out.filter(x => x.supervisor.toLowerCase().indexOf(filtroSup) !== -1);
      if (filtroAnio) out = out.filter(x => x.anio === filtroAnio);
      if (filtroMes) out = out.filter(x => x.mes === filtroMes);
      return out;
    }
    const cuenta = (arr, f) => arr.reduce((s, x) => s + (f(x) ? x.n : 0), 0);
    const at = applyFilters(await atencionesAgrupadas()), vi = applyFilters(vis), ca = applyFilters(cas), fu = applyFilters(fus);
    const refAnio = filtroAnio || anioActual;
    const esteMes = x => x.mes === mesActual && x.anio === refAnio;
    const fin = x => x.estado === 'FINALIZADO' || x.estado === 'RESUELTO';
    const ret = x => x.estado.indexOf('RETRAS') !== -1;
    const stats = {
      atenciones: { total: cuenta(at, () => true), enProceso: cuenta(at, x => x.estado === 'EN PROCESO'), finalizados: cuenta(at, fin), esteMes: cuenta(at, esteMes) },
      visitas: { total: vi.length, enPlazo: cuenta(vi, x => !ret(x)), retrasadas: cuenta(vi, ret), esteMes: cuenta(vi, esteMes) },
      casos: { total: ca.length, enPlazo: cuenta(ca, x => !ret(x)), retrasados: cuenta(ca, ret), esteMes: cuenta(ca, esteMes) },
      fusiones: { total: fu.length, pendientes: cuenta(fu, x => x.estado === 'PENDIENTE'), validados: cuenta(fu, x => x.estado === 'VALIDADO'),
        trabajadores: fu.reduce((s, x) => s + x.totalTrab, 0), esteMes: cuenta(fu, esteMes) }
    };
    const porSupervisor = {};
    function acumSup(arr, modulo) {
      arr.forEach(x => {
        const s = x.supervisor || 'Sin asignar';
        if (!porSupervisor[s]) porSupervisor[s] = { nombre: s, atenciones: 0, atEnProceso: 0, atFinalizados: 0, visitas: 0, viRetrasadas: 0, casos: 0, caRetrasados: 0, fusiones: 0 };
        const o = porSupervisor[s];
        if (modulo === 'at') { o.atenciones += x.n; if (x.estado === 'EN PROCESO') o.atEnProceso += x.n; if (fin(x)) o.atFinalizados += x.n; }
        if (modulo === 'vis') { o.visitas++; if (ret(x)) o.viRetrasadas++; }
        if (modulo === 'cas') { o.casos++; if (ret(x)) o.caRetrasados++; }
        if (modulo === 'fus') o.fusiones++;
      });
    }
    acumSup(at, 'at'); acumSup(vi, 'vis'); acumSup(ca, 'cas'); acumSup(fu, 'fus');
    const tendencia = [];
    for (let t = 5; t >= 0; t--) {
      const td = new Date(Date.UTC(anioActual, lima.getUTCMonth() - t, 1));
      const tMes = td.getUTCMonth() + 1;
      const tAnio = filtroAnio ? (filtroAnio + (td.getUTCFullYear() - anioActual)) : td.getUTCFullYear();
      const del = x => x.mes === tMes && x.anio === tAnio;
      tendencia.push({ label: LABELS[tMes - 1], atenciones: cuenta(at, del), visitas: cuenta(vi, del), casos: cuenta(ca, del), fusiones: cuenta(fu, del) });
    }
    return { success: true, data: { stats, porSupervisor, tendencia, filtros: { anio: filtroAnio || '', mes: filtroMes || '' } } };
  }
  return { getEstadisticasAdmin };
}
module.exports = { crear };
