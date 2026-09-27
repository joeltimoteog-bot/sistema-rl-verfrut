/* ═══════════════════════════════════════════════════════════════════════════
   _SOL_AZURE_V1 (27-set-2026) — SOLICITUDES DE EDICION: resolver PRIMERO en Azure
   ---------------------------------------------------------------------------
   resolverSolicitud (aprobar / rechazar) sobre dbo.Solicitudes_Edicion: estado,
   resuelto por, fecha de resolucion y motivo de rechazo (columnas 11-14), igual que
   el Apps Script. Por decision del 27-set YA NO escribe 'EDICION_APROBADA' en la
   visita (caia en la columna TEMPORADA y nadie la leia).
   getSolicitudes: la misma lista que el Apps Script, desde la tabla.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['resolverSolicitud'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const MESES = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const p2 = n => (n < 10 ? '0' : '') + n;
function ymd(v) {   /* r instanceof Date ? formatDate(Lima,'yyyy-MM-dd') : String(r||'').substring(0,10) */
  if (esD(v)) { const m = String(v.$s).match(/^\w{3} (\w{3}) (\d{2}) (-?\d{4,})/); return m ? m[3] + '-' + p2(MESES[m[1]]) + '-' + m[2] : ''; }
  return String(v || '').substring(0, 10);
}
const J = v => esD(v) ? (v.$d || null) : v;   /* valor crudo como lo da JSON (fechas ISO) */

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'sol_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* = getSolicitudes(p) del Apps Script (fila = posicion en la lista + 2, como alla) */
function getSolicitudes(T, p) {
  let data = T.filas.map(f => { const r = []; for (let i = 0; i < 14; i++) r.push(f[i] === undefined ? '' : f[i]); return r; })
    .filter(r => J(r[0])).map((r, i) => ({
      fila: i + 2, nro: J(r[0]), fecha: ymd(r[1]), nro_visita: J(r[2]), supervisor: S(r[3] || '').trim(), empresa: S(r[4] || ''),
      fundo: S(r[5] || ''), semana: J(r[6]), fecha_informe: ymd(r[7]), motivo: S(r[8] || ''), solicitado_por: S(r[9] || ''),
      estado: S(r[10] || ''), resuelto_por: S(r[11] || ''), motivo_rechazo: S(r[13] || '') }));
  if (p && p.estado) data = data.filter(s => s.estado === p.estado);
  return { success: true, data };
}

async function ejecutar(pool, accion, b, usuario, prueba) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'sol_edicion');
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'sol_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, 'sol_edicion');
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de solicitudes aun no cargada' } }; }
    const fila = parseInt(b.fila, 10), i = fila - 2;                       /* fila de la hoja (2 = primera solicitud) */
    if (isNaN(fila) || i < 0 || i >= T.filas.length || !J(T.filas[i][0])) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Solicitud no encontrada (fila ' + b.fila + ')' } }; }
    const ahora = new Date();
    const celdas = T.filas[i].slice(); while (celdas.length < 14) celdas.push('');
    celdas[10] = CAP.comoHoja(b.estado); celdas[11] = CAP.comoHoja(b.resuelto_por || ''); celdas[12] = CAP.comoHoja(ahora); celdas[13] = CAP.comoHoja(b.motivo_rechazo || '');
    const E = TH.ESQ.sol_edicion, f = TH.aFila('sol_edicion', celdas), r = tx.request();
    r.input('fila', sql.Int, i + 1);
    const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
    r.input('o', sql.NVarChar(sql.MAX), f.otros);
    await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
    await CAP.tocarMarcas(tx, ['sol_edicion']);
    const resp = { success: true, fuente: 'azure' };
    const cuerpo = { fila, nro: J(T.filas[i][0]), estado: b.estado === undefined ? '' : b.estado, resuelto_por: b.resuelto_por || '', fecha: ahora.toISOString(), motivo_rechazo: b.motivo_rechazo || '' };
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'sol', @a, NULL, @u, @c, @r)");
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
module.exports = { ejecutar, encendido, getSolicitudes, ACCIONES };
