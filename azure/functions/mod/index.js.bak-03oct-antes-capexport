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
const TH = require('../shared/tablas-hoja');   /* _TABLAS_HC_V1: Horas y Capacitaciones desde sus tablas reales */
const TABLAS = { horas: ['horas_registros', 'horas_motivos'], cap: ['cap_cabeceras', 'cap_asistentes'], fus: ['fus_buses'], sol: ['sol_edicion'] };   /* _FUS_AZURE_V1: + fus · _SOL_AZURE_V1: + sol */
const FUSG = require('../shared/fus-guardar');
const SOLG = require('../shared/sol-guardar');
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const J = v => esD(v) ? v.$d : v;
const N = v => esD(v) ? new Date(v.$d).getTime() : Number(v);
function normDni(x) { let s = String(x == null ? '' : x).replace(/\D/g, ''); if (!s) return ''; while (s.length < 8) s = '0' + s; return s; }   /* = horasNormDni */
/* igual que _modDatos_('horas') del Apps Script */
function registroHoras(r) {
  return { id: J(r[0]), fechaRegistro: J(r[1]), registradoPor: J(r[2]), dni: normDni(esD(r[3]) ? r[3].$s : r[3]),
    nombre: J(r[4]), empresa: J(r[5]), cargo: J(r[6]), fechaEntrada: J(r[7]), horaEntrada: J(r[8]), fechaSalida: J(r[9]), horaSalida: J(r[10]),
    horasTrabajadas: N(r[11]) || 0, jornadaEsperada: N(r[12]) || 0, horasAcumuladas: N(r[13]) || 0, horasAcum: N(r[13]) || 0,
    horasPermiso: N(r[14]) || 0, horasDeuda: N(r[15]) || 0, motivo: J(r[16]), detalle: J(r[17]), observaciones: J(r[18]), alerta: J(r[19]),
    estado: J(r[20]) || 'aprobado', aprobadoPor: J(r[21]), aprobadoEn: J(r[22]), _conId: !!J(r[0]), _estadoCrudo: J(r[20]) };
}
async function desdeTablas(pool, modulo, D) {
  if (modulo === 'horas') {
    const reg = await TH.leer(pool, 'horas_registros'), mot = await TH.leer(pool, 'horas_motivos');
    if (!reg || !mot) return false;
    D.registros = reg.filas.map(r => registroHoras(Array.from({ length: 23 }, (_, i) => r[i] === undefined ? '' : r[i])));
    D.motivos = mot.filas.map(r => String(esD(r[0]) ? r[0].$s : (r[0] || '')).trim()).filter(m => m).sort((a, b) => a.localeCompare(b));
    return true;
  }
  if (modulo === 'cap') {
    const h = await TH.leer(pool, 'cap_cabeceras'), b = await TH.leer(pool, 'cap_asistentes');
    if (!h || !b) return false;
    D.hdr = [h.encabezado].concat(h.filas); D.bbdd = [b.encabezado].concat(b.filas);
    return true;
  }
  if (modulo === 'fus') {   /* _FUS_AZURE_V1: Fusiones desde su tabla real (= getFusiones del Apps Script) */
    const t = await TH.leer(pool, 'fus_buses');
    if (!t) return false;
    D.getFusiones = FUSG.getFusiones(t);
    return true;
  }
  if (modulo === 'sol') {   /* _SOL_AZURE_V1: Solicitudes desde su tabla real (= getSolicitudes del Apps Script; el filtro por estado lo aplica mod-snap) */
    const t = await TH.leer(pool, 'sol_edicion');
    if (!t) return false;
    D.getSolicitudes = SOLG.getSolicitudes(t, {});
    return true;
  }
  return false;
}
const HANDLERS = {
  horas: { crear: require('../shared/mod-horas').crear, acciones: { horasListar: 'horasListar', horasResumenIndividual: 'horasResumenIndividual', horasResumenGeneral: 'horasResumenGeneral', horasListarMotivos: 'horasListarMotivos' } },
  cap:   { crear: require('../shared/mod-cap').crear,   acciones: { listarCapacitaciones: 'capListar', estadisticasCapacitaciones: 'capEstadisticas' } },
  /* _MOD_SIMPLES_V1: consultas sin calculo — Azure guarda la respuesta de Google tal cual */
  fus:      { crear: require('../shared/mod-snap').crear, acciones: { getFusiones: 'getFusiones' } },
  sol:      { crear: require('../shared/mod-snap').crear, acciones: { getSolicitudes: 'getSolicitudes' } },
  casosaux: { crear: require('../shared/mod-snap').crear, acciones: { getMotivosCasos: 'getMotivosCasos' } },
  inv:      { crear: require('../shared/mod-snap').crear, acciones: { invGetAll: 'invGetAll' } },
  sup:      { crear: require('../shared/mod-snap').crear, acciones: { getSupervisores: 'getSupervisores' } },   /* _PRELOAD_AZURE_V1 (01-oct): lista de supervisores */
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
  let ver = (v.recordset[0].v || '') + '#' + v.recordset[0].n;
  if (TABLAS[modulo]) ver += '#' + (await TH.marcas(pool, TABLAS[modulo]));   /* _TABLAS_HC_V1 */
  const c = cache[modulo];
  if (c && c.ver === ver) return c.m;
  const r = await pool.request().input('m', sql.NVarChar(40), modulo).query('SELECT clave, datos FROM dbo.MOD_Datos WHERE modulo = @m');
  const D = {}; r.recordset.forEach(x => { D[x.clave] = JSON.parse(x.datos); });
  if (TABLAS[modulo]) { try { D._tablas = await desdeTablas(pool, modulo, D); } catch (e) { D._tablas = false; } }   /* si las tablas no estan listas, sigue el bloque anterior */
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
