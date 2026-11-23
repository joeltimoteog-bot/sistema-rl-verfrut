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
/* ═══ _MOD_SEDE_V1 (23-nov-2026, decision de Joel): Horas y Capacitaciones por sede, en el servidor ═══
   Misma regla que atenciones (shared/sede.js): un registro es de OLMOS si su empresa es de Olmos (Olmos, Bomarea, Pirona,
   Mosqueta, Hefei, Lefkada) o si lo registro un usuario de Olmos. Usuario de Olmos ve solo Olmos; usuario de Piura, solo
   Piura; alcance General (y jtimoteo) ve las dos, o la que elija en el selector de sede. Las llamadas internas (Apps
   Script, sin usuario) no se filtran. Se filtra ANTES de calcular, asi listas, saldos y cifras salen ya de la sede.
   Si la sede no se puede determinar se responde 503 (nunca se abre de mas). Apagar: secreto SEDE_FILTRO=off. */
const SD = require('../shared/sede');
const TXT = v => esDsd(v) ? v.$s : (v == null ? '' : String(v));
function esDsd(v) { return !!(v && typeof v === 'object' && typeof v.$d === 'string'); }
async function sedeMod(pool, req) {
  const u = req && req._sedeU;
  if (!u || !u.usuario) return null;
  const modo = await SD.modo(pool, { usuario: u.usuario });
  if (modo === 'TODO') return null;
  const o = await SD.olmos(pool);
  return { modo, o, firma: modo + ':' + o.usuarios.join(',') };
}
const COLS_SD = { empresa: 'empresa', fundo: null, usuario: 'usuario', supervisor: null };
const deSede = (sd, empresa, usuario) => SD.esOlmos({ empresa: TXT(empresa), usuario: TXT(usuario) }, sd.o, COLS_SD) === (sd.modo === 'OLMOS');
function colDe(enc, nombre) { for (let i = 0; i < (enc || []).length; i++) if (TXT(enc[i]).trim().toUpperCase() === nombre) return i; return -1; }
/* cabeceras de capacitaciones: [encabezado, ...filas] -> solo las filas de la sede (no toca el arreglo original, que esta en memoria compartida) */
function hdrDeSede(sd, hdr) {
  if (!sd || !hdr || hdr.length < 2) return hdr;
  const iE = colDe(hdr[0], 'EMPRESA'), iC = colDe(hdr[0], 'CREADA_POR');
  return [hdr[0]].concat(hdr.slice(1).filter(r => deSede(sd, iE >= 0 ? r[iE] : '', iC >= 0 ? r[iC] : '')));
}
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
async function desdeTablas(pool, modulo, D, sd) {
  if (modulo === 'horas') {
    const reg = await TH.leer(pool, 'horas_registros'), mot = await TH.leer(pool, 'horas_motivos');
    if (!reg || !mot) return false;
    D.registros = reg.filas.map(r => registroHoras(Array.from({ length: 23 }, (_, i) => r[i] === undefined ? '' : r[i])));
    D.motivos = mot.filas.map(r => String(esD(r[0]) ? r[0].$s : (r[0] || '')).trim()).filter(m => m).sort((a, b) => a.localeCompare(b));
    /* _HORAS_PERIODO_V1 (17-nov-2026): fecha de corte de quien reingreso (padron); si falla, sin cortes (como antes) */
    try { const HP = require('../shared/horas-periodo'); D.cortes = HP.cortes(await HP.ingresos(pool, sql), D.registros, r => r.dni, r => HP.dia(r.fechaEntrada) || HP.dia(r.fechaRegistro)); } catch (eP) { D.cortes = {}; }
    return true;
  }
  if (modulo === 'cap') {
    /* _MEMO_CAP_V1 (24-oct-2026): los asistentes (42 mil filas) YA NO se cargan en memoria (dejaban el host
       en 320 MB de 512 y Azure lo mataba). Las 3 cifras que usan las estadisticas salen de SQL. */
    const h = await TH.leer(pool, 'cap_cabeceras');
    if (!h) return false;
    const est = (await pool.request().input('k', sql.NVarChar(40), 'cap_asistentes').query('SELECT marca FROM dbo.TH_Estado WHERE clave = @k')).recordset[0];
    if (!est || !est.marca) return false;
    /* _MOD_SEDE_V1: las cifras de asistentes salen de SQL; con sede, solo los asistentes de esa sede */
    const rqA = pool.request(); let wSd = '';
    if (sd) { const cnd = SD.condOlmos(rqA, sd.o, { empresa: 'empresa', fundo: null, usuario: 'creada_por', supervisor: null }, 'sc'); wSd = ' AND ' + (sd.modo === 'OLMOS' ? cnd : 'NOT ' + cnd); }
    const r = await rqA.query(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN UPPER(ISNULL(empresa, '')) LIKE '%RAPEL%' THEN 1 ELSE 0 END) AS rapel,
        SUM(CASE WHEN UPPER(ISNULL(empresa, '')) NOT LIKE '%RAPEL%' AND UPPER(ISNULL(empresa, '')) LIKE '%VERFRUT%' THEN 1 ELSE 0 END) AS verfrut
      FROM dbo.Cap_Asistentes WHERE ISNULL(id_capacitacion, '') <> ''${wSd};
      SELECT CONVERT(varchar(7), DATEADD(hour, -5, fecha_capacitacion), 126) AS ym, COUNT(*) AS n
      FROM dbo.Cap_Asistentes WHERE ISNULL(id_capacitacion, '') <> '' AND fecha_capacitacion IS NOT NULL${wSd}
      GROUP BY CONVERT(varchar(7), DATEADD(hour, -5, fecha_capacitacion), 126);`);
    const porMes = {}; r.recordsets[1].forEach(x => { porMes[x.ym] = x.n; });
    D.hdr = hdrDeSede(sd, [h.encabezado].concat(h.filas)); D.bbdd = null;
    D.bbddAgg = { total: r.recordsets[0][0].total, rapel: r.recordsets[0][0].rapel, verfrut: r.recordsets[0][0].verfrut, porMes };
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
  cap:   { crear: require('../shared/mod-cap').crear,   acciones: { listarCapacitaciones: 'capListar', estadisticasCapacitaciones: 'capEstadisticas', exportarCapacitaciones: 'capExportar' } },   /* _CAP_EXPORT_SQL_V1: exportarCapacitaciones se atiende aparte, por SQL (ver abajo) */
  /* _MOD_SIMPLES_V1: consultas sin calculo — Azure guarda la respuesta de Google tal cual */
  fus:      { crear: require('../shared/mod-snap').crear, acciones: { getFusiones: 'getFusiones' } },
  sol:      { crear: require('../shared/mod-snap').crear, acciones: { getSolicitudes: 'getSolicitudes' } },
  casosaux: { crear: require('../shared/mod-snap').crear, acciones: { getMotivosCasos: 'getMotivosCasos' } },
  inv:      { crear: require('../shared/mod-snap').crear, acciones: { invGetAll: 'invGetAll' } },
  sup:      { crear: require('../shared/mod-snap').crear, acciones: { getSupervisores: 'getSupervisores' } },   /* _PRELOAD_AZURE_V1 (01-oct): lista de supervisores */
  /* _ESTADM_AZURE_V1: Estadisticas Admin (atenciones directo de SQL) */
  estadm:   { crear: require('../shared/mod-estadm').crear, acciones: { getEstadisticasAdmin: 'getEstadisticasAdmin' } },
  /* _DASH_AZURE_V1 (05-oct): lecturas del dashboard desde sus tablas reales (shared/mod-lecturas.js) */
  acc:      { crear: null, acciones: { getSolicitudesAcceso: 'getSolicitudesAcceso' } },
  mant:     { crear: null, acciones: { listarSolicitudesMantenimiento: 'listarSolicitudesMantenimiento' } },
  resp:     { crear: null, acciones: { getResponsablesEnRango: 'getResponsablesEnRango' } }   /* _RESP_AZURE_V1 (06-oct) */
};
/* memoria por version: cada consulta pregunta solo la hora de la ultima carga (consulta
   minima); si no cambio, reutiliza lo ya leido. Asi, apenas Google sube un cambio
   (un registro nuevo), la siguiente consulta ya lo muestra. */
const cache = {};
async function datos(modulo, sd) {
  const pool = await getPool(); await M.asegurarTablas(pool);
  const v = await pool.request().input('m', sql.NVarChar(40), modulo)
    .query("SELECT CONVERT(VARCHAR(30), MAX(actualizado), 126) AS v, COUNT(*) AS n FROM dbo.MOD_Datos WHERE modulo = @m");
  let ver = (v.recordset[0].v || '') + '#' + v.recordset[0].n;
  if (TABLAS[modulo]) ver += '#' + (await TH.marcas(pool, TABLAS[modulo]));   /* _TABLAS_HC_V1 */
  if (modulo === 'horas') ver += '#p' + Math.floor(Date.now() / 600000);   /* _HORAS_PERIODO_V1: el padron (fechas de ingreso) se relee cada 10 min */
  const kSd = modulo + (sd ? '|' + sd.modo : '');   /* _MOD_SEDE_V1: una memoria por sede */
  if (sd) ver += '#s' + sd.firma;
  const c = cache[kSd];
  if (c && c.ver === ver) return c.m;
  const r = await pool.request().input('m', sql.NVarChar(40), modulo).query("SELECT clave, datos FROM dbo.MOD_Datos WHERE modulo = @m AND NOT (modulo = 'cap' AND clave = 'bbdd')");   /* _MEMO_CAP_V1: el JSON de asistentes (15 MB) ya no se lee ni se guarda en memoria */
  const D = {}; r.recordset.forEach(x => { D[x.clave] = JSON.parse(x.datos); });
  if (TABLAS[modulo]) { try { D._tablas = await desdeTablas(pool, modulo, D, sd); } catch (e) { D._tablas = false; } }   /* si las tablas no estan listas, sigue el bloque anterior */
  if ((M.CLAVES[modulo] || []).some(k => D[k] === undefined)) return null;
  if (sd) {   /* _MOD_SEDE_V1: se filtra antes de calcular */
    if (modulo === 'horas' && Array.isArray(D.registros)) D.registros = D.registros.filter(r => deSede(sd, r.empresa, r.registradoPor));
    if (modulo === 'cap') {
      if (!D._tablas) D.hdr = hdrDeSede(sd, D.hdr);   /* con tablas ya viene filtrado */
      if (Array.isArray(D.bbdd) && D.bbdd.length > 1) { const iE = colDe(D.bbdd[0], 'EMPRESA'), iC = colDe(D.bbdd[0], 'CREADA_POR'); D.bbdd = [D.bbdd[0]].concat(D.bbdd.slice(1).filter(r => deSede(sd, iE >= 0 ? r[iE] : '', iC >= 0 ? r[iC] : ''))); }
    }
  }
  const m = HANDLERS[modulo].crear(D);
  cache[kSd] = { ver, m };
  return m;
}
/* ═══════════════════════════════════════════════════════════════════════════
   _MOD_ENCURSO_V1 (15-oct-2026) — misma consulta en camino = UNA sola lectura
   ---------------------------------------------------------------------------
   A las 8:00 varios usuarios abren el Dashboard a la vez y cada pestaña pide
   getFusiones, getSupervisores, mant, acc... Antes cada peticion identica leia
   la base por su cuenta (N lecturas iguales al mismo tiempo = base saturada y
   cortes a los 8 s). Ahora las peticiones iguales que llegan MIENTRAS una esta
   en curso esperan esa respuesta y la comparten. No hay memoria entre llamadas:
   apenas termina, la siguiente vuelve a leer (el que guarda ve su cambio igual).
   ═══════════════════════════════════════════════════════════════════════════ */
const _enCurso = new Map();
module.exports = async function (context, req) {
  /* _LECTURAS_SESION_V1 (18-oct-2026): con LECTURAS_CON_SESION=1 las lecturas exigen sesion (o clave interna del Apps Script) */
  const _uSeg = require('../shared/auth').exigirSesionLectura(context, req); if (_uSeg === null) return;
  /* _SEG_SERVIDOR_V1 (10-nov-2026): quien consulta y con que rol salen del TOKEN verificado, no del cuerpo.
     Si el cuerpo trae usuario/rol distintos a los del token se reemplazan (y se anota). En horas y cap (los unicos
     calculos que filtran por usuario/rol) se ponen siempre. La llamada interna del Apps Script (clave de funciones)
     conserva lo que envia, porque no trae token de usuario. */
  try {
    if (_uSeg && _uSeg.usuario && !_uSeg.interno) {
      /* _SEG_SERVIDOR_V2 (10-nov-2026, verificacion): un cuerpo que no es objeto plano (arreglo, texto, numero) saltaba el filtro: se trata como vacio */
      if (req.body === undefined || req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
      if (typeof req.body.usuario !== 'string' && req.body.usuario != null) req.body.usuario = '';
      if (typeof req.body.rol !== 'string' && req.body.rol != null) req.body.rol = '';
      {
        const _tu = String(_uSeg.usuario).toLowerCase().trim(), _tr = String(_uSeg.rol || '').toLowerCase().trim();
        const _bu = String(req.body.usuario == null ? '' : req.body.usuario).toLowerCase().trim(), _br = String(req.body.rol == null ? '' : req.body.rol).toLowerCase().trim();
        const _siempre = ['horas', 'cap', 'estadm'].indexOf(String(context.bindingData.modulo)) >= 0;   /* _SEDE_SERVIDOR_V1: estadm separa por sede segun el usuario del token */
        if ((_bu && _bu !== _tu) || (_br && _br !== _tr)) context.log.warn('[mod] _SEG_SERVIDOR_V1: el cuerpo decia usuario/rol "' + _bu + '"/"' + _br + '" y el token "' + _tu + '"/"' + _tr + '": se usa el token');
        if (_bu !== _tu && (_bu || _siempre)) req.body.usuario = _tu;
        if (_br !== _tr && (_br || _siempre)) req.body.rol = _tr;
      }
    }
  } catch (eSeg) { context.log.warn('[mod] _SEG_SERVIDOR_V1: ' + eSeg.message); context.res = { status: 400, body: { success: false, error: 'Solicitud invalida' } }; return; }   /* _SEG_SERVIDOR_V2: si la comprobacion falla no se continua */
  const modulo = context.bindingData.modulo, accion = context.bindingData.accion;
  req._sedeU = (_uSeg && _uSeg.usuario && !_uSeg.interno) ? { usuario: _uSeg.usuario } : null;   /* _MOD_SEDE_V1 */
  let clave = '';
  try { clave = modulo + '/' + accion + '|' + SD.vistaPedida() + '|' + JSON.stringify(req.body || {}).slice(0, 2000); } catch (e) { clave = ''; }
  if (clave && _enCurso.has(clave)) {
    try {
      const r = await _enCurso.get(clave);
      if (r) { context.res = { status: r.status, headers: Object.assign({ 'X-Compartida': '1' }, r.headers || {}), body: r.body, isRaw: r.isRaw }; return; }
    } catch (e) { /* si la compartida fallo, se calcula normal abajo */ }
  }
  let resolver;
  if (clave) _enCurso.set(clave, new Promise(function (r) { resolver = r; }));
  try {
    await atender(context, req);
    if (resolver) resolver(context.res && context.res.status === 200 ? context.res : null);
  } catch (e) {
    if (resolver) resolver(null);
    throw e;
  } finally {
    if (clave) _enCurso.delete(clave);
  }
};
async function atender(context, req) {
  const modulo = context.bindingData.modulo, accion = context.bindingData.accion;
  const h = HANDLERS[modulo], fn = h && h.acciones[accion];
  if (!fn) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
  try {
    /* _AZ_TOKEN_V1: este modulo aun no exige sesion; por ahora solo se cuenta quien llama sin ella */
    try { const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''; if (!h.startsWith('Bearer ')) require('../shared/auth').anotarSinToken(req, 'sin-token'); } catch (e) {}
    /* _MOD_SEDE_V1: sede de quien consulta (solo Horas y Capacitaciones en esta etapa) */
    let sd = null;
    if (modulo === 'horas' || modulo === 'cap') {
      try { sd = await sedeMod(await getPool(), req); }
      catch (eSd) { context.res = { status: 503, body: { success: false, error: 'No se pudo determinar tu sede en este momento. Intenta de nuevo en unos segundos.' } }; return; }
    }
    if (modulo === 'cap' && accion === 'listarCapacitaciones') {   /* _CAP_REG_V2: la lista solo necesita las cabeceras (antes cargaba tambien los ~20 mil asistentes) */
      const cab = await TH.leer(await getPool(), 'cap_cabeceras');
      if (cab) {
        const out = require('../shared/mod-cap').crear({ hdr: hdrDeSede(sd, [cab.encabezado].concat(cab.filas)) }).capListar(req.body || {});
        out.fuente = 'azure';
        context.res = { status: 200, body: out };
        return;
      }
    }
    if (modulo === 'cap' && accion === 'exportarCapacitaciones') {   /* _CAP_EXPORT_SQL_V1: sin cargar las tablas completas */
      const t0 = Date.now();
      const out = await require('../shared/mod-cap').capExportarSql(await getPool(), req.body || {});
      if (!out) { context.res = { status: 503, body: { success: false, error: 'Capacitaciones aun no cargadas en Azure' } }; return; }
      if (sd && Array.isArray(out.data)) { out.data = out.data.filter(x => deSede(sd, x.EMPRESA, x.CREADA_POR)); out.total = out.data.length; }   /* _MOD_SEDE_V1 */
      out.fuente = 'azure'; out.ms = Date.now() - t0;
      /* _CAP_EXPORT_SQL_V2: el año completo (~20 mil filas, ~15 MB) hacia caer la respuesta (HTTP 500).
         Comprimido (gzip) pesa ~10 veces menos; el navegador y Google lo descomprimen solos. */
      const txt = JSON.stringify(out), ae = String((req.headers && req.headers['accept-encoding']) || '');
      if (txt.length > 200000 && /gzip/i.test(ae)) {
        context.res = { status: 200, isRaw: true, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip' }, body: require('zlib').gzipSync(Buffer.from(txt, 'utf8')) };
      } else {
        context.res = { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: txt };
      }
      return;
    }
    if (modulo === 'acc' || modulo === 'mant' || modulo === 'resp') {   /* _DASH_AZURE_V1 · _RESP_AZURE_V1 */
      const out = await require('../shared/mod-lecturas').leer(await getPool(), modulo, req.body || {});
      if (!out) { context.res = { status: 503, body: { success: false, error: 'Azure aun no es la fuente de este modulo' } }; return; }
      out.fuente = 'azure';
      context.res = { status: 200, body: out };
      return;
    }
    const m = await datos(modulo, sd);
    if (!m) { context.res = { status: 503, body: { success: false, error: 'Modulo aun no migrado a Azure' } }; return; }
    const out = await m[fn](req.body || {});   /* _ESTADM_AZURE_V1: admite calculos async */
    out.fuente = 'azure';
    context.res = { status: 200, body: out };
  } catch (e) {
    context.log.error('[mod] ' + modulo + '/' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
