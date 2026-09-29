/* ═══════════════════════════════════════════════════════════════════════════
   _CUMPL_W_V1 (27-set-2026) — CUMPLIMIENTO: las escrituras PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica del Apps Script:
     cumplJustificar          → fila en CUMPL_JUSTIF + dias/motivo de retraso del caso (dbo.Casos)
     cumplConfigGuardar       → CUMPL_CONFIG (solo lo que cambia)
     cumplRestriccionLevantar → fila en CUMPL_RESTRICC
   Cada una deja la fila del historial (CUMPL_HISTORIAL) tal cual; ese historial lo
   sigue escribiendo el Apps Script (al copiar la operacion), porque otras 8
   funciones de alla tambien escriben en el.
   Ademas: config y restricciones para el motor, calculados desde las tablas
   (= cumplConfig_ y el bloque 'restricc' de _cumplDatosAzure_).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['cumplJustificar', 'cumplConfigGuardar', 'cumplRestriccionLevantar', 'cumplAusencia'];   /* _AUSENCIAS_V1: + cumplAusencia */
const AUS_DUENOS = ['jtimoteo'];
const PLAZOS_CASO = ['plazo_investigacion', 'plazo_documentos', 'plazo_cierre'];   /* _PLAZO_VIGENTE_V1 */   /* _AUSENCIAS_V1: decision de Joel (27-set): solo el administrador del sistema */
const CLAVES = ['cumpl_justif', 'cumpl_restricc', 'cumpl_config', 'cumpl_historial'];
const ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];   /* = cumplEsAdmin_ */
const DEFAULTS = [['plazo_registro_caso', 1], ['plazo_investigacion', 5], ['plazo_documentos', 7], ['plazo_cierre', 10], ['plazo_visita_dias', 1],
  ['aviso_proximo_dias', 2], ['critico_dias', 5], ['escalar_coordinador_dias', 3], ['restricciones_activas', 'SI'],
  ['modulos_restringidos', 'correo,fusiones,calculo,mantenimiento,almuerzos,exportar'], ['correo_coordinador', ''],
  ['indice_excelente_pct', 90], ['indice_regular_pct', 70],
  ['dias_laborables', 'LUN,MAR,MIE,JUE,VIE'], ['feriados', '2026-01-01,2026-04-02,2026-04-03,2026-05-01,2026-06-07,2026-06-29,2026-07-23,2026-07-28,2026-07-29,2026-08-06,2026-08-30,2026-10-08,2026-11-01,2026-12-08,2026-12-09,2026-12-25,2027-01-01,2027-03-25,2027-03-26,2027-05-01,2027-06-07,2027-06-29,2027-07-23,2027-07-28,2027-07-29,2027-08-06,2027-08-30,2027-10-08,2027-11-01,2027-12-08,2027-12-09,2027-12-25'], ['ausencias', '[]'], ['plazos_historial', '[]']];   /* _PLAZO_VIGENTE_V1: + plazos_historial */   /* = CUMPL_DEFAULTS · _CALENDARIO_V1: + calendario · _AUSENCIAS_V1: + ausencias */
const MOTOR = require('./cumpl-motor');
const AUS_DESC = 'AUSENCIAS / REEMPLAZOS (vacaciones, descanso medico...). Se editan SOLO desde Gestion Usuarios (no a mano)';   /* _AUSENCIAS_V1 */

const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const J = v => esD(v) ? (v.$d || null) : v;
const usr = u => String(u || '').trim().toLowerCase();                                   /* cumplUsr_ */
const MESES = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const p2 = n => (n < 10 ? '0' : '') + n;
const ymdDe = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
function limaPartes(ms) { const x = new Date(ms - 5 * 3600e3); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds() }; }
const hoyYmd = ms => { const p = limaPartes(ms); return ymdDe(p.y, p.m, p.d); };            /* cumplYmd_(new Date()) */
const horaLima = ms => { const p = limaPartes(ms); return p2(p.h) + ':' + p2(p.mi) + ':' + p2(p.s); };   /* cumplHora_ */

/* cumplYmd_(_casoParse(v)) */
function ymdParse(v) {
  if (v === null || v === undefined || v === '') return '';
  if (esD(v)) { if (!v.$d) return ''; const m = String(v.$s).match(/^\w{3} (\w{3}) (\d{2}) (-?\d{4,})/); return m ? ymdDe(+m[3], MESES[m[1]], +m[2]) : ''; }
  const s = String(v).trim(); let m;
  const ok = (y, mo, d) => { const t = new Date(Date.UTC(y, mo - 1, d)); return ymdDe(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };   /* new Date(y,m,d) corrige desbordes igual */
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return ok(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ok(+m[1], +m[2], +m[3]);
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return hoyYmd(d.getTime());
}

/* _casoNombreMatch */
function nombreMatch(a, b) {
  const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim() + ' ';
  const A = norm(a), B = norm(b);
  if (A === '  ' || B === '  ') return false;
  const toks = B.trim().split(' ').filter(t => t.length >= 3);
  if (!toks.length) return false;
  const need = Math.min(2, toks.length);
  let hit = 0;
  for (const t of toks) if (A.indexOf(' ' + t + ' ') !== -1) hit++;
  return hit >= need;
}
/* cumplUsuarioPorNombreOUsuario_ (lista = bloque 'usuarios' = cumplUsuarios_) */
function usuarioPor(lista, clave) {
  const k = usr(clave);
  for (const u of lista) if (u.usuario === k || usr(u.nombre) === k) return u;
  for (const u of lista) { try { if (nombreMatch(usr(u.nombre), k) || nombreMatch(k, usr(u.nombre))) return u; } catch (e) {} }
  return null;
}

/* cumplConfig_ desde la tabla (sin completar claves: eso lo sigue haciendo el Apps Script) */
function configDe(T) {
  const cfg = {};
  T.filas.forEach(r => { const k = S(r[0] === undefined ? '' : r[0]).trim(); if (!k) return; cfg[k] = J(r[1] === undefined ? '' : r[1]); });
  DEFAULTS.forEach(d => { if (!(d[0] in cfg)) cfg[d[0]] = d[1]; });
  const num = (k, def) => { const v = parseInt(cfg[k], 10); return isNaN(v) ? def : v; };
  const si = k => { const v = String(cfg[k] == null ? '' : cfg[k]).trim().toUpperCase(); return v === 'SI' || v === 'TRUE' || v === '1'; };
  return { raw: cfg,
    plazo_registro_caso: num('plazo_registro_caso', 1), plazo_investigacion: num('plazo_investigacion', 5),
    plazo_documentos: num('plazo_documentos', 7), plazo_cierre: num('plazo_cierre', 10), plazo_visita_dias: num('plazo_visita_dias', 1),
    aviso_proximo_dias: num('aviso_proximo_dias', 2), critico_dias: num('critico_dias', 5), escalar_dias: num('escalar_coordinador_dias', 3),
    restricciones: si('restricciones_activas'),
    modulos_restringidos: String(cfg.modulos_restringidos || '').split(',').map(s => s.trim()).filter(Boolean),
    correo_coordinador: String(cfg.correo_coordinador || '').trim(),
    excelente: num('indice_excelente_pct', 90), regular: num('indice_regular_pct', 70),
    dias: MOTOR.calParseDias(cfg.dias_laborables), feriados: MOTOR.calParseFeriados(cfg.feriados) };   /* _CALENDARIO_V1 */
}
/* bloque 'restricc' de _cumplDatosAzure_ */
function restriccDe(T) {
  return T.filas.map(r => ({ usuario: S(r[2] === undefined ? '' : r[2]), tipo: S(r[3] === undefined ? '' : r[3]), por: S(r[5] === undefined ? '' : r[5]), hasta: ymdParse(r[6]) }));
}
/* lo que usa el motor: null si las tablas aun no estan cargadas */
async function paraMotor(pool) {
  const C = await TH.leer(pool, 'cumpl_config'), R = await TH.leer(pool, 'cumpl_restricc');
  if (!C || !R) return null;
  return { config: configDe(C), restricc: restriccDe(R) };
}

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'cumpl_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}
/* fila del historial (= cumplLog_) */
function filaLog(ms, usuario, actividad, caso, estAnt, estNuevo, docs, fLimite, fCumpl, retraso, justif, por, detalle) {
  return [hoyYmd(ms), horaLima(ms), usuario || '', actividad || '', caso || '', estAnt || '', estNuevo || '', docs || '', fLimite || '', fCumpl || '',
    retraso === '' || retraso == null ? '' : retraso, justif || '', por || '', detalle || ''];
}
async function cambiarFila(tx, clave, fila, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, fila);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}

async function ejecutar(pool, accion, b, usuario, rol, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  await CG.asegurarTablas(pool);
  for (const k of CLAVES) await TH.asegurar(pool, k);
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now(), ahora = new Date(ms);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'cumpl_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const rechazo = e => ({ status: 200, body: { success: false, error: e } });
    let resp, cuerpo = { accion }, tocar = [], log = null, celdasPrueba = null;

    if (accion === 'cumplJustificar') {
      const just = String(b.justificacion || '').trim();
      if (just.length < 10) { await tx.rollback(); return rechazo('La justificación debe tener al menos 10 caracteres.'); }
      const ub = await pool.request().query("SELECT datos FROM dbo.CUMPL_Datos WHERE clave = 'usuarios'");
      const lista = ub.recordset.length ? JSON.parse(ub.recordset[0].datos) : [];
      const u = usuarioPor(lista, usuario) || { usuario: usr(usuario), nombre: '' };
      const hoy = hoyYmd(ms), dias = parseInt(b.dias_retraso, 10) || 0;
      const fila = [hoy, horaLima(ms), u.usuario, u.nombre, String(b.nro || ''), String(b.actividad || ''), String(b.fecha_limite || ''), dias, just, hoy];
      await CAP.agregarFilas(tx, 'cumpl_justif', [fila.map(CAP.comoHoja)]); tocar.push('cumpl_justif');
      cuerpo.justif = fila;
      /* dias / motivo de retraso del caso (solo si no es una visita) — igual que alla: el motivo solo si estaba vacio */
      if (b.nro && String(b.actividad || '').indexOf('visita') === -1) {
        const c = await tx.request().input('n', sql.NVarChar(50), String(b.nro)).input('d', sql.Float, dias).input('m', sql.NVarChar(2000), just)
          .query(`UPDATE x SET dias_retraso = @d, motivo_retraso = CASE WHEN LTRIM(RTRIM(ISNULL(x.motivo_retraso, ''))) = '' THEN @m ELSE x.motivo_retraso END
                  FROM (SELECT TOP 1 * FROM dbo.Casos WHERE CAST(nro AS NVARCHAR(50)) = @n ORDER BY fila) x`);
        if (c.rowsAffected[0]) {
          cuerpo.caso = { nro: String(b.nro), dias, motivo: just };
          await tx.request().input('k', sql.NVarChar(40), 'tablas_casos').input('v', sql.NVarChar(400), String(Date.now()))
            .query(`MERGE dbo.CV_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
                    WHEN MATCHED THEN UPDATE SET valor = @v, actualizado = SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES (@k, @v);`);
        }
      }
      log = filaLog(ms, u.usuario, String(b.actividad || ''), String(b.nro || ''), 'FUERA DE PLAZO', 'JUSTIFICADO', '', String(b.fecha_limite || ''), hoy, dias, just, u.usuario, 'Justificacion de incumplimiento');
      resp = { success: true };
      celdasPrueba = fila.map(CAP.comoHoja);

    } else if (accion === 'cumplConfigGuardar') {
      if (ADMIN.indexOf(String(rol || '').trim().toLowerCase()) < 0) { await tx.rollback(); return rechazo('Solo un administrador o coordinador puede cambiar los plazos.'); }
      if (AUS_DUENOS.indexOf(usr(usuario)) < 0) { await tx.rollback(); return rechazo('Solo el administrador del sistema (Joel Timoteo) puede cambiar plazos y calendario.'); }   /* _PLAZO_VIGENTE_V1 */
      const T = await TH.leer(pool, 'cumpl_config');
      if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de configuracion aun no cargada' } }; }
      const antes = configDe(T).raw, cambios = b.config || {}, u = usr(usuario), filas = T.filas.map(r => r.slice()), hechos = [], logs = [];
      const hist = MOTOR.plazosHist(antes), nHist0 = hist.length;   /* _PLAZO_VIGENTE_V1 */
      const DESC = { dias_laborables: 'CALENDARIO: dias que se trabajan (LUN,MAR,MIE,JUE,VIE,SAB,DOM). Los demas NO cuentan en ningun plazo (casos, visitas, cumplimiento)',
        feriados: 'CALENDARIO: feriados que NO cuentan en ningun plazo (aaaa-mm-dd, separados por coma)' };
      for (const k of Object.keys(cambios)) {
        if (k === 'ausencias' || k === 'plazos_historial') continue;   /* _AUSENCIAS_V1 · _PLAZO_VIGENTE_V1: los maneja el sistema */
        let i = filas.findIndex(r => S(r[0] === undefined ? '' : r[0]).trim() === k);
        if (i < 0 && DESC[k]) {   /* _CALENDARIO_V1: clave nueva que la tabla aun no tiene: se agrega (Google la crea igual) */
          const d0 = DEFAULTS.find(d => d[0] === k), nuevaF = [k, d0 ? d0[1] : '', DESC[k], ahora, 'sistema'].map(CAP.comoHoja);
          await CAP.agregarFilas(tx, 'cumpl_config', [nuevaF]); filas.push(nuevaF); i = filas.length - 1; tocar.push('cumpl_config');
        }
        if (i < 0) continue;
        if (S(filas[i][1] === undefined ? '' : filas[i][1]).trim() === String(cambios[k]).trim()) continue;
        const nueva = filas[i].slice(); while (nueva.length < 5) nueva.push('');
        nueva[1] = CAP.comoHoja(cambios[k]); nueva[3] = CAP.comoHoja(ahora); nueva[4] = CAP.comoHoja(u);
        if (PLAZOS_CASO.indexOf(k) >= 0) {   /* _PLAZO_VIGENTE_V1: el valor anterior rige para los casos registrados hasta ayer */
          const ay = limaPartes(ms - 86400000);
          hist.push({ clave: k, valor: parseInt(S(filas[i][1] === undefined ? '' : filas[i][1]), 10), hasta: ymdDe(ay.y, ay.m, ay.d), cambio: hoyYmd(ms), por: u });
        }
        await cambiarFila(tx, 'cumpl_config', i + 1, nueva);
        filas[i] = nueva;
        hechos.push({ clave: k, valor: cambios[k] });
        logs.push(filaLog(ms, u, 'CONFIG', '', S(esD(antes[k]) ? antes[k] : (antes[k] === undefined ? 'undefined' : antes[k])), String(cambios[k]), '', '', '', '', '', u, 'Cambio de parametro ' + k));
      }
      if (hist.length > nHist0) {   /* _PLAZO_VIGENTE_V1: guardar el historial (fila nueva si aun no existe) */
        const json = JSON.stringify(hist);
        let ih = filas.findIndex(r => S(r[0] === undefined ? '' : r[0]).trim() === 'plazos_historial');
        if (ih < 0) {
          const nf = ['plazos_historial', '[]', 'HISTORIAL DE PLAZOS: valor anterior de cada plazo y hasta que fecha de registro rige (lo llena el sistema, no a mano)', ahora, 'sistema'].map(CAP.comoHoja);
          await CAP.agregarFilas(tx, 'cumpl_config', [nf]); filas.push(nf); ih = filas.length - 1;
        }
        const nh = filas[ih].slice(); while (nh.length < 5) nh.push('');
        nh[1] = CAP.comoHoja(json); nh[3] = CAP.comoHoja(ahora); nh[4] = CAP.comoHoja(u);
        await cambiarFila(tx, 'cumpl_config', ih + 1, nh); filas[ih] = nh;
        hechos.push({ clave: 'plazos_historial', valor: json });
      }
      if (hechos.length) tocar.push('cumpl_config');
      cuerpo.config = hechos; cuerpo.por = u; cuerpo.fecha = ahora.toISOString(); log = logs;
      resp = { success: true, cambios: hechos.filter(x => x.clave !== 'plazos_historial').length, config: configDe({ filas }).raw };

    } else if (accion === 'cumplAusencia') {   /* _AUSENCIAS_V1 */
      const u = usr(usuario);
      if (AUS_DUENOS.indexOf(u) < 0) { await tx.rollback(); return rechazo('Solo el administrador del sistema puede registrar ausencias y reemplazos.'); }
      const T = await TH.leer(pool, 'cumpl_config');
      if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de configuracion aun no cargada' } }; }
      /* lectura DIRECTA dentro del bloqueo (no la memoria por marca): dos registros seguidos nunca se pisan */
      const rr = await tx.request().query(`SELECT * FROM ${TH.ESQ.cumpl_config.tabla} ORDER BY fila`);
      const filas = rr.recordset.map(x => TH.aCeldas('cumpl_config', x));
      let i = filas.findIndex(r => S(r[0] === undefined ? '' : r[0]).trim() === 'ausencias');
      if (i < 0) {
        const nuevaF = ['ausencias', '[]', AUS_DESC, ahora, 'sistema'].map(CAP.comoHoja);
        await CAP.agregarFilas(tx, 'cumpl_config', [nuevaF]); filas.push(nuevaF); i = filas.length - 1;
      }
      const ub = await pool.request().query("SELECT datos FROM dbo.CUMPL_Datos WHERE clave = 'usuarios'");
      const lista = ub.recordset.length ? JSON.parse(ub.recordset[0].datos) : [];
      const p = limaPartes(ms);
      const r = MOTOR.ausAplicar(MOTOR.ausParse(S(filas[i][1] === undefined ? '' : filas[i][1])), Object.assign({}, b, { id_nuevo: clave || String(ms) }), lista, hoyYmd(ms), hoyYmd(ms) + ' ' + p2(p.h) + ':' + p2(p.mi), u);
      if (r.error) { await tx.rollback(); return rechazo(r.error); }
      const json = JSON.stringify(r.lista);
      const nueva = filas[i].slice(); while (nueva.length < 5) nueva.push('');
      nueva[1] = CAP.comoHoja(json); nueva[3] = CAP.comoHoja(ahora); nueva[4] = CAP.comoHoja(u);
      await cambiarFila(tx, 'cumpl_config', i + 1, nueva); tocar.push('cumpl_config');
      cuerpo.config = [{ clave: 'ausencias', valor: json }]; cuerpo.por = u; cuerpo.fecha = ahora.toISOString();
      log = filaLog(ms, r.log[0], 'AUSENCIA', '', '', r.log[1], '', r.a.hasta || '', '', '', '', u, r.log[2]);
      resp = { success: true, id: r.id, ausencias: r.lista };
      celdasPrueba = nueva;

    } else {   /* cumplRestriccionLevantar */
      if (ADMIN.indexOf(String(rol || '').trim().toLowerCase()) < 0) { await tx.rollback(); return rechazo('Solo un administrador o coordinador puede levantar restricciones.'); }
      const dias = parseInt(b.dias, 10) || 7, p = limaPartes(ms);
      const h = new Date(Date.UTC(p.y, p.m - 1, p.d + dias)), hasta = ymdDe(h.getUTCFullYear(), h.getUTCMonth() + 1, h.getUTCDate());
      const fila = [hoyYmd(ms), horaLima(ms), usr(b.objetivo), 'LEVANTADA', String(b.motivo || ''), usr(usuario), hasta];
      await CAP.agregarFilas(tx, 'cumpl_restricc', [fila.map(CAP.comoHoja)]); tocar.push('cumpl_restricc');
      cuerpo.restricc = fila;
      log = filaLog(ms, usr(b.objetivo), 'RESTRICCION', '', 'ACTIVA', 'LEVANTADA', '', '', hasta, '', String(b.motivo || ''), usr(usuario), 'Levantada por ' + dias + ' dias');
      resp = { success: true, hasta };
      celdasPrueba = fila.map(CAP.comoHoja);
    }
    cuerpo.historial = !log || !log.length ? [] : (Array.isArray(log[0]) ? log : [log]);   /* una fila, varias (config) o ninguna */
    if (tocar.length) await CAP.tocarMarcas(tx, tocar);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'cumpl', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._celdas = celdasPrueba; } else await tx.commit();
    return { status: 200, body: resp };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (clave && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}
module.exports = { ejecutar, encendido, paraMotor, configDe, restriccDe, usuarioPor, ymdParse, ACCIONES, CLAVES };
