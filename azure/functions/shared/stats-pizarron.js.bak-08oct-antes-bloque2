/* ═══════════════════════════════════════════════════════════════════════════
   _STATS_PIZARRON_V1 (01-oct-2026) — "pizarrón" de las cifras de Mi Dashboard
   ---------------------------------------------------------------------------
   ANTES: cada usuario (y cada supervisor con su filtro) hacia que la base
   recorriera la tabla Atenciones 7 veces. Con ~18 personas y rafagas, la base
   S1 se saturaba en horario de trabajo.
   AHORA: la base se lee UNA vez por minuto con 2 consultas agrupadas
   (totales por supervisor/empresa/estado/año/mes y por tipo de documento).
   Ese resumen (pocos cientos/miles de filas) queda en memoria y de ahi se
   arman las cifras de CUALQUIER usuario al instante, sin tocar la base.
   · Mismas reglas que el calculo original (hoy/mes/año en hora de Lima,
     filtros anio = , empresa = , supervisor LIKE '%x%').
   · Al guardar una atencion se invalida (atenciones-guardar) → la siguiente
     lectura ya la incluye.
   · Peticiones simultaneas esperan UNA sola lectura.
   ═══════════════════════════════════════════════════════════════════════════ */
const TTL_MS = 60000;
let _agg = null, _enCurso = null, _gen = 0;

const HOY = "CONVERT(date, SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00'))";
const AHORA = "SWITCHOFFSET(SYSDATETIMEOFFSET(), '-05:00')";
const Q_BASE = `
  SELECT supervisor, empresa, estado, anio, mes,
    SUM(CASE WHEN CONVERT(date, fecha_atencion) = ${HOY} THEN 1 ELSE 0 END) AS hoy,
    SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(${AHORA}) AND MONTH(fecha_atencion) = MONTH(${AHORA}) THEN 1 ELSE 0 END) AS este_mes,
    SUM(CASE WHEN YEAR(fecha_atencion) = YEAR(${AHORA}) THEN 1 ELSE 0 END) AS este_anio,
    COUNT(*) AS n
  FROM Atenciones WITH (NOLOCK)
  GROUP BY supervisor, empresa, estado, anio, mes`;
const Q_TIPO = `
  SELECT detalle_documento AS tipo, supervisor, empresa, anio, COUNT(*) AS n
  FROM Atenciones WITH (NOLOCK)
  WHERE detalle_documento IS NOT NULL AND detalle_documento != ''
  GROUP BY detalle_documento, supervisor, empresa, anio`;

function invalidar() { _gen++; _agg = null; }

async function leer(pool) {
  if (_agg && Date.now() - _agg.ts < TTL_MS) return _agg;
  if (_enCurso) return _enCurso;
  const gen = _gen;
  _enCurso = (async () => {
    const t0 = Date.now();
    const [b, t] = await Promise.all([pool.request().query(Q_BASE), pool.request().query(Q_TIPO)]);
    const a = { ts: Date.now(), ms: Date.now() - t0, base: b.recordset, tipo: t.recordset };
    if (gen === _gen) _agg = a;   /* si se guardo algo mientras se leia, no se fija (la proxima lectura sera nueva) */
    return a;
  })().finally(() => { _enCurso = null; });
  return _enCurso;
}

/* comparaciones como SQL Server (intercalacion sin distincion de mayusculas, espacios finales ignorados) */
const nrm = v => (v == null ? null : String(v).replace(/\s+$/, '').toUpperCase());
function pasaFiltro(r, f) {
  if (f.anio != null && Number(r.anio) !== f.anio) return false;
  if (f.empresa != null && nrm(r.empresa) !== f.empresa) return false;
  if (f.supervisor != null && (r.supervisor == null || String(r.supervisor).toUpperCase().indexOf(f.supervisor) < 0)) return false;
  return true;
}
function sumarPor(filas, clave, valido) {
  const m = new Map();
  filas.forEach(r => {
    const v = r[clave];
    if (!valido(v)) return;
    const k = nrm(v);
    const x = m.get(k) || { label: v, n: 0 };
    x.n += Number(r.n) || 0; m.set(k, x);
  });
  return [...m.values()];
}
const noVacio = v => v != null && String(v) !== '';

/* arma la MISMA respuesta que calcularOriginal */
function armar(agg, q) {
  const f = {
    anio: q.anio ? parseInt(q.anio, 10) : null,
    empresa: q.empresa ? nrm(q.empresa) : null,
    supervisor: q.supervisor ? String(q.supervisor).toUpperCase() : null
  };
  const B = agg.base.filter(r => pasaFiltro(r, f));
  const g = { total: 0, hoy: 0, este_mes: 0, este_anio: 0, en_proceso: 0, finalizados: 0 };
  B.forEach(r => {
    const n = Number(r.n) || 0, e = nrm(r.estado);
    g.total += n; g.hoy += Number(r.hoy) || 0; g.este_mes += Number(r.este_mes) || 0; g.este_anio += Number(r.este_anio) || 0;
    if (e === 'EN PROCESO') g.en_proceso += n; else if (e === 'FINALIZADO') g.finalizados += n;
  });
  const mesMap = new Map(), anioMap = new Map();
  B.forEach(r => {
    const n = Number(r.n) || 0;
    if (r.anio != null) anioMap.set(Number(r.anio), (anioMap.get(Number(r.anio)) || 0) + n);
    if (r.anio != null && r.mes != null) {
      const k = r.anio + '-' + String(r.mes).padStart(2, '0').slice(-2);
      mesMap.set(k, (mesMap.get(k) || 0) + n);
    }
  });
  const por_mes = {}; [...mesMap.keys()].sort().reverse().forEach(k => { por_mes[k] = mesMap.get(k); });
  const por_anio = {}; [...anioMap.keys()].sort((a, b) => b - a).forEach(k => { por_anio[k] = anioMap.get(k); });
  const desc = arr => arr.sort((a, b) => b.n - a.n);
  const por_empresa = {}; desc(sumarPor(B, 'empresa', noVacio)).forEach(x => { por_empresa[x.label] = x.n; });
  const por_estado = {}; desc(sumarPor(B, 'estado', noVacio)).forEach(x => { por_estado[x.label] = x.n; });
  const por_supervisor = {}; desc(sumarPor(B, 'supervisor', noVacio)).slice(0, 20).forEach(x => { por_supervisor[x.label] = x.n; });
  const por_tipo = {}; desc(sumarPor(agg.tipo.filter(r => pasaFiltro(r, f)), 'tipo', noVacio)).forEach(x => { por_tipo[x.label] = x.n; });
  return { success: true, resumen_global: g, por_mes, por_anio, por_empresa, por_estado, por_tipo, por_supervisor, fuente: 'AZURE_SQL', pizarron: true };
}

module.exports = { leer, armar, invalidar, TTL_MS, _Q: { Q_BASE, Q_TIPO } };
