/* ═══════════════════════════════════════════════════════════════════════════
   mod (_MOD_AZURE_V1, 26-set-2026) — lecturas de modulos desde Azure
   POST /api/mod/horas/{horasListar|horasResumenIndividual|horasResumenGeneral|horasListarMotivos}
   POST /api/mod/cap/{listarCapacitaciones|estadisticasCapacitaciones}
   POST /api/mod/fus/getFusiones · sol/getSolicitudes · casosaux/getMotivosCasos · inv/invGetAll
   Mismo calculo que el Apps Script (shared/mod-*.js) sobre los datos que manda
   mod-importar. Sin datos -> 503 y la pantalla usa Google como siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const M = require('../shared/mod-db');
const HANDLERS = {
  horas: { crear: require('../shared/mod-horas').crear, acciones: { horasListar: 'horasListar', horasResumenIndividual: 'horasResumenIndividual', horasResumenGeneral: 'horasResumenGeneral', horasListarMotivos: 'horasListarMotivos' } },
  cap:   { crear: require('../shared/mod-cap').crear,   acciones: { listarCapacitaciones: 'capListar', estadisticasCapacitaciones: 'capEstadisticas' } },
  /* _MOD_SIMPLES_V1: consultas sin calculo — Azure guarda la respuesta de Google tal cual */
  fus:      { crear: require('../shared/mod-snap').crear, acciones: { getFusiones: 'getFusiones' } },
  sol:      { crear: require('../shared/mod-snap').crear, acciones: { getSolicitudes: 'getSolicitudes' } },
  casosaux: { crear: require('../shared/mod-snap').crear, acciones: { getMotivosCasos: 'getMotivosCasos' } },
  inv:      { crear: require('../shared/mod-snap').crear, acciones: { invGetAll: 'invGetAll' } },
  /* _ESTADM_AZURE_V1: Estadisticas Admin (atenciones directo de SQL) */
  estadm:   { crear: require('../shared/mod-estadm').crear, acciones: { getEstadisticasAdmin: 'getEstadisticasAdmin' } }
};
/* memoria por version: cada consulta pregunta solo la hora de la ultima carga (consulta
   minima); si no cambio, reutiliza lo ya leido. Asi, apenas Google sube un cambio
   (un registro nuevo), la siguiente consulta ya lo muestra. */
const cache = {};
async function datos(modulo) {
  const pool = await getPool(); await M.asegurarTablas(pool);
  const v = await pool.request().input('m', sql.NVarChar(40), modulo)
    .query("SELECT CONVERT(VARCHAR(30), MAX(actualizado), 126) AS v, COUNT(*) AS n FROM dbo.MOD_Datos WHERE modulo = @m");
  const ver = (v.recordset[0].v || '') + '#' + v.recordset[0].n;
  const c = cache[modulo];
  if (c && c.ver === ver) return c.m;
  const r = await pool.request().input('m', sql.NVarChar(40), modulo).query('SELECT clave, datos FROM dbo.MOD_Datos WHERE modulo = @m');
  const D = {}; r.recordset.forEach(x => { D[x.clave] = JSON.parse(x.datos); });
  if ((M.CLAVES[modulo] || []).some(k => D[k] === undefined)) return null;
  const m = HANDLERS[modulo].crear(D);
  cache[modulo] = { ver, m };
  return m;
}
module.exports = async function (context, req) {
  const modulo = context.bindingData.modulo, accion = context.bindingData.accion;
  const h = HANDLERS[modulo], fn = h && h.acciones[accion];
  if (!fn) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
  try {
    const m = await datos(modulo);
    if (!m) { context.res = { status: 503, body: { success: false, error: 'Modulo aun no migrado a Azure' } }; return; }
    const out = await m[fn](req.body || {});   /* _ESTADM_AZURE_V1: admite calculos async */
    out.fuente = 'azure';
    context.res = { status: 200, body: out };
  } catch (e) {
    context.log.error('[mod] ' + modulo + '/' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
