/* kpi-reloj (_KPI_RRLL_V1, 30-set-2026) — cada 15 minutos (_KPI_LIVIANO_V1, 01-oct: antes 5, cargaba la base):
   1) copia la programacion de ETI (Firestore) a Azure SQL,
   2) recalcula los KPIs del equipo de RR.LL.,
   3) guarda la foto del dia y registra en la bitacora las alertas NUEVAS
      (el correo lo envia el Apps Script en su vuelta de 5 minutos).
   Si Firestore no responde, se calcula con la ultima copia (no se pierde nada). */
const { getPool } = require('../shared/db');
const KDB = require('../shared/kpi-db');
const ETI = require('../shared/kpi-eti');

module.exports = async function (context) {
  const t0 = Date.now();
  try {
    const pool = await getPool();
    await KDB.asegurarTablas(pool);
    let eti;
    try { eti = await ETI.sincronizar(pool); } catch (e) { eti = { error: e.message }; context.log.warn('[kpi-reloj] ETI: ' + e.message); }
    const d = await KDB.calcular(pool);
    const r = await KDB.registrar(pool, d);
    try { const c = await KDB.cierreAutomatico(pool); if (c) context.log('[kpi-reloj] cierre mensual: ' + JSON.stringify(c)); }   /* el mes anterior se congela solo */
    catch (eC) { context.log.error('[kpi-reloj] cierre mensual: ' + eC.message); }
    context.log('[kpi-reloj] OK en ' + (Date.now() - t0) + ' ms · ETI ' + JSON.stringify(eti) + ' · ' + JSON.stringify(r));
  } catch (e) {
    context.log.error('[kpi-reloj] ' + e.message);
  }
};
