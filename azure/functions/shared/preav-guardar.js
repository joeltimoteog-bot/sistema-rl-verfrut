/* ═══════════════════════════════════════════════════════════════════════════
   _PREAV_AZURE_V1 (21-oct-2026) — CARTAS DE PREAVISO se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica las versiones VIGENTES del Apps Script (las ultimas definidas) sobre la tabla
   real dbo.Preavisos (= hoja BD_Preavisos, 17 columnas A..Q):
     savePreaviso                 N° = ultima fila de la hoja (sin repetir nunca)
     updatePreavisoDesenlace      M desenlace, N observacion, P fecha desenlace
     registrarApelacionPreaviso   L nueva fecha limite (+3 dias), N se anexa, Q apelado
     getPreavisos                 lista como la da Google (mas reciente primero)
   Permiso: solo PREAVISO_ADMINS (aqui se toma el usuario del LOGIN FIRMADO, no del cuerpo).
   La operacion queda en dbo.CV_Ops (tipo 'preav'); el Apps Script la copia a la hoja con
   el MISMO N° y, en la apelacion, envia el mismo correo de siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const CLAVE = 'preav_registro';
const ACCIONES = ['savePreaviso', 'updatePreavisoDesenlace', 'registrarApelacionPreaviso'];
const ADMINS = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas'];   /* = PREAVISO_ADMINS del Apps Script */
const ANCHO = 17;
const SIN_PERMISO = {
  savePreaviso: 'Sin permisos: solo administradores pueden registrar preavisos',
  updatePreavisoDesenlace: 'Sin permisos: solo administradores pueden registrar el desenlace',
  registrarApelacionPreaviso: 'Sin permisos: solo administradores pueden registrar apelaciones',
  getPreavisos: 'Sin permisos: solo administradores pueden ver preavisos'
};
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const lima = ms => new Date(ms - 5 * 3600e3);
const dmyLima = ms => { const x = lima(ms); return p2(x.getUTCDate()) + '/' + p2(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear(); };
const ymdLima = ms => { const x = lima(ms); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); };
const esAdmin = u => ADMINS.indexOf(String(u || '').toLowerCase().trim()) >= 0;

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'preav_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

async function actualizarFila(tx, i, celdas) {
  const E = TH.ESQ[CLAVE], f = TH.aFila(CLAVE, celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  if (!esAdmin(usuario)) return { status: 200, body: { success: false, error: SIN_PERMISO[accion] } };
  b = b || {};
  await CG.asegurarTablas(pool); await TH.asegurar(pool, CLAVE);
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
    await tx.request().query("EXEC sp_getapplock @Resource = 'preav_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, CLAVE);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de preavisos aun no cargada' } }; }
    let resp, cuerpo, celdas;
    if (accion === 'savePreaviso') {
      const p = (b.preaviso && typeof b.preaviso === 'object') ? b.preaviso : b;
      const usados = new Set(T.filas.map(f => S(f[0]).trim()));
      let nro = T.filas.length + 1;                     /* = ws.getLastRow() antes de agregar */
      while (usados.has(String(nro))) nro++;            /* nunca repetir un N° */
      const fila = [nro, null, p.dni || '', p.nombre || '', p.empresa || '', p.cargo || '', p.sector || '',
        p.tipo_falta || '', p.hechos || '', p.fecha_emision || '', p.plazo || 6, p.fecha_limite || '',
        '', '', p.registrado_por || '', ''];
      celdas = fila.map((v, k) => k === 1 ? CAP.comoHoja(ahora) : CAP.comoHoja(v));
      while (celdas.length < ANCHO) celdas.push('');
      await CAP.agregarFilas(tx, CLAVE, [celdas]);
      resp = { success: true, nro };
      cuerpo = { accion, nro, fila, registroMs: ms };
    } else {
      const i = T.filas.findIndex(f => S(f[0]).trim() === String(b.nro).trim());
      if (i < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Preaviso no encontrado: ' + b.nro } }; }
      celdas = T.filas[i].slice(); while (celdas.length < ANCHO) celdas.push('');
      if (accion === 'updatePreavisoDesenlace') {
        celdas[12] = CAP.comoHoja(b.desenlace || ''); celdas[13] = CAP.comoHoja(b.observacion || ''); celdas[15] = CAP.comoHoja(ahora);
        resp = { success: true };
        cuerpo = { accion, nro: S(T.filas[i][0]).trim(), desenlace: b.desenlace || '', observacion: b.observacion || '', ms };
      } else {
        const f = T.filas[i], nuevaMs = ms + 3 * 86400e3;
        const hoyTxt = dmyLima(ms), nuevaTxt = dmyLima(nuevaMs), obsPrevia = S(f[13]);
        const obs = (obsPrevia ? obsPrevia + ' | ' : '') + 'Apelación con descargo registrada el ' + hoyTxt + '. Plazo extendido +3 días hasta ' + nuevaTxt + '.';
        celdas[11] = CAP.comoHoja(new Date(nuevaMs)); celdas[13] = obs; celdas[16] = CAP.comoHoja(ahora);
        resp = { success: true, nueva_fecha_limite: nuevaTxt };
        cuerpo = { accion, nro: S(f[0]).trim(), ms, nuevaMs, obs, hoyTxt, nuevaTxt, nombre: S(f[3]), dni: S(f[2]), empresa: S(f[4]), usuario: String(usuario || '') };
      }
      await actualizarFila(tx, i, celdas);
    }
    await CAP.tocarMarcas(tx, [CLAVE]);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'preav', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._celdas = celdas; } else await tx.commit();
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

/* = getPreavisos vigente del Apps Script (con 'apelado'), desde la tabla */
function getPreavisos(T, usuario) {
  if (!esAdmin(usuario)) return { success: false, error: SIN_PERMISO.getPreavisos, preavisos: [] };
  const fmt = v => esD(v) ? (v.$d ? ymdLima(new Date(v.$d).getTime()) : '') : String(v || '');
  const sv = v => esD(v) ? v.$s : String(v || '');
  const lista = T.filas.filter(r => r[0] !== '' && r[0] !== null && r[0] !== undefined).map(r => ({
    nro: r[0], fecha_registro: fmt(r[1]), dni: sv(r[2]), nombre: sv(r[3]),
    empresa: sv(r[4]), cargo: sv(r[5]), sector: sv(r[6]),
    tipo_falta: sv(r[7]), hechos: sv(r[8]), fecha_emision: fmt(r[9]),
    plazo: (r[10] === '' || r[10] === null || r[10] === undefined || r[10] === 0) ? 6 : (esD(r[10]) ? r[10].$s : r[10]),
    fecha_limite: fmt(r[11]), desenlace: sv(r[12]),
    observacion: sv(r[13]), registrado_por: sv(r[14]),
    fecha_desenlace: fmt(r[15]), apelado: fmt(r[16])
  }));
  lista.reverse();
  return { success: true, preavisos: lista, fuente: 'azure' };
}

module.exports = { ejecutar, encendido, getPreavisos, ACCIONES, CLAVE, esAdmin };
