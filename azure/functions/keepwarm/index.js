/* keepwarm — _DNI_RESPALDO_V1 (23-set-2026)
   Azure Functions en plan Consumo "se duerme" si nadie lo usa y la primera
   consulta tarda 7-10 s en despertar. Eso hacia que la busqueda por DNI de
   Nueva Atencion se cortara ("signal is aborted without reason").
   Esta funcion corre sola cada 4 minutos, hace un SELECT 1 y mantiene
   despiertos la app y la conexion a SQL. Costo: ~11 000 ejecuciones/mes,
   dentro del millon gratis del plan Consumo. No lee ni escribe datos. */
const { getPool } = require('../shared/db');

module.exports = async function (context, reloj) {
  const t0 = Date.now();
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    context.log('[keepwarm] OK en ' + (Date.now() - t0) + ' ms');
  } catch (e) {
    context.log.warn('[keepwarm] SQL no respondio: ' + e.message);
  }
};
