/* ═══════════════════════════════════════════════════════════════════════════
   eti-eval-stats (_ETI_EVAL_AZURE_V1, 30-set-2026)
   GET /api/etieval/stats?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&empresa=&sector=&modalidad=QR|MANUAL
   Devuelve filas agregadas (dia, empresa, supervisor, sector, ruta, codigo, modalidad) con
   evaluados, suma de resultados, aprobados y % por tema. La pagina arma los indicadores.
   Datos anonimos: no hay DNI ni nombres de trabajadores.
   ═══════════════════════════════════════════════════════════════════════════ */
const { getPool } = require('../shared/db');
const E = require('../shared/eti-eval');

function sesion(req) {
  try {
    const a = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || ''), k = process.env.JWT_SECRET || '';
    if (!a.startsWith('Bearer ') || !k) return null;
    const p = require('jsonwebtoken').verify(a.slice(7).trim(), k);
    if (!p || !p.usuario || (p.aud && p.aud !== 'eti-sesion')) return null;   /* mismas sesiones validas que /api/eti */
    return p;
  } catch (e) { return null; }
}

module.exports = async function (context, req) {
  try {
    const pool = await getPool(); await E.asegurarTablas(pool);
    let filas = await E.stats(pool, req.query || {});
    /* _ETI_STATS_SEDE_V1 (21-nov-2026): con sesion, los indicadores salen solo de la sede del usuario (misma regla de /api/eti).
       Sin sesion sigue respondiendo como antes, salvo que el secreto ETI_STATS_SESION=on la exija (se activa cuando todas las
       pantallas ya envian su sesion). jtimoteo, alcance GENERAL y lcastillo ven las dos sedes. Apagar el filtro: SEDE_FILTRO=off. */
    const u = sesion(req);
    if (!u && String(process.env.ETI_STATS_SESION || '').toLowerCase() === 'on') { context.res = { status: 401, body: { success: false, error: 'Sesion requerida' } }; return; }
    if (u && ['lcastillo'].indexOf(String(u.usuario).trim().toLowerCase()) < 0) {
      const S = require('../shared/sede'), m = await S.modo(pool, u);
      if (m !== 'TODO') { const re = new RegExp('(' + S.EMPRESAS_OLMOS.join('|') + ')'); filas = (filas || []).filter(f => re.test(S._N((f.empresa || '') + ' ' + (f.sector || ''))) === (m === 'OLMOS')); }
    }
    context.res = { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { success: true, filas, generado: new Date().toISOString() } };
  } catch (err) {
    context.log.error('[eti-eval-stats] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
