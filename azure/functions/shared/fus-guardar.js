/* ═══════════════════════════════════════════════════════════════════════════
   _FUS_AZURE_V1 (27-set-2026) — FUSIONES DE BUSES se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica saveFusion y updateFusion del Apps Script sobre dbo.Fusiones_Buses
   (mismas celdas que escribe Google, con las reglas de la hoja es_MX). La operacion
   queda en dbo.CV_Ops con la fila literal; el Apps Script la copia a la hoja con
   el MISMO ID. El ID es el de siempre: 'FUS-' + ultima fila (y si ya existiera,
   el siguiente libre, para no repetir nunca).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['saveFusion', 'updateFusion'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const pad4 = n => { let s = String(n); while (s.length < 4) s = '0' + s; return s; };

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'fus_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* las 28 celdas que escribe saveFusion (id aparte) */
function filaNueva(id, d) {
  return [id, d.fecha, d.hora, d.usuario, d.sector, d.supervisor, d.reemplazo, d.reemplazante || '', d.reemplazado || '',
    d.cantBuses, d.rutaOrigen, d.codOrigen, d.totalTrab, d.ruta1, d.codigo1, d.personal1, d.ruta2, d.codigo2, d.personal2,
    d.ruta3, d.codigo3, d.personal3, d.motivo, d.observaciones, d.foto1 || '', d.foto2 || '', d.foto3 || '', 'Pendiente']
    .map(v => v === undefined || v === null ? '' : v);
}
/* las 24 celdas (columnas 5 a 28) que escribe updateFusion */
function valoresEdicion(d) {
  return [d.sector || '', d.supervisor || '', d.reemplazo || 'No', d.reemplazante || '', d.reemplazado || '', d.cantBuses || '',
    d.rutaOrigen || '', d.codOrigen || '', d.totalTrab || '', d.ruta1 || '', d.codigo1 || '', d.personal1 || '',
    d.ruta2 || '', d.codigo2 || '', d.personal2 || '', d.ruta3 || '', d.codigo3 || '', d.personal3 || '',
    d.motivo || '', d.observaciones || '', d.foto1 || '', d.foto2 || '', d.foto3 || '', 'Pendiente'];
}

async function ejecutar(pool, accion, b, usuario, prueba) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'fus_buses');
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'fus_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, 'fus_buses');
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de fusiones aun no cargada' } }; }
    let resp, cuerpo, celdas;
    if (accion === 'saveFusion') {
      const ids = new Set(T.filas.map(f => S(f[0]).trim()));
      let n = T.filas.length + 1, id = 'FUS-' + pad4(n);         /* = 'FUS-' + getLastRow() */
      while (ids.has(id)) { n++; id = 'FUS-' + pad4(n); }        /* nunca repetir un ID */
      const fila = filaNueva(id, b);
      celdas = fila.map(CAP.comoHoja);
      await CAP.agregarFilas(tx, 'fus_buses', [celdas]);
      resp = { success: true, id };
      cuerpo = { accion, id, fila };
    } else {
      if (!b.id) { await tx.rollback(); return { status: 200, body: { success: false, error: 'ID de fusión no proporcionado' } }; }
      const i = T.filas.findIndex(f => S(f[0]).trim() === String(b.id).trim());
      if (i < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Fusión ' + b.id + ' no encontrada' } }; }
      const valores = valoresEdicion(b);
      celdas = T.filas[i].slice();
      while (celdas.length < 28) celdas.push('');
      valores.forEach((v, k) => { celdas[4 + k] = CAP.comoHoja(v); });
      const E = TH.ESQ.fus_buses, f = TH.aFila('fus_buses', celdas), r = tx.request();
      r.input('fila', sql.Int, i + 1);
      const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
      r.input('o', sql.NVarChar(sql.MAX), f.otros);
      await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
      resp = { success: true, message: 'Fusión ' + b.id + ' actualizada' };
      cuerpo = { accion, id: String(b.id).trim(), valores };
    }
    await CAP.tocarMarcas(tx, ['fus_buses']);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'fus', @a, NULL, @u, @c, @r)");
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

/* = getFusiones del Apps Script, desde la tabla (fechas como las da JSON: ISO) */
function getFusiones(T) {
  const J = v => esD(v) ? (v.$d || null) : v;
  const data = T.filas.map(f => { const r = []; for (let i = 0; i < 28; i++) r.push(f[i] === undefined ? '' : J(f[i])); return r; })
    .filter(r => r[0]).map(r => ({
      id: r[0], fecha: r[1], hora: r[2], usuario: r[3], sector: r[4], supervisor: r[5], reemplazo: r[6],
      reemplazante: r[7], reemplazado: r[8], cantBuses: r[9], ruta_origen: r[10], codigo_origen: r[11], total_trab: r[12],
      ruta1: r[13], codigo1: r[14], personal1: r[15], ruta2: r[16], codigo2: r[17], personal2: r[18],
      ruta3: r[19], codigo3: r[20], personal3: r[21], motivo: r[22], observaciones: r[23],
      foto1: r[24], foto2: r[25], foto3: r[26], estado: r[27] }));
  return { success: true, data };
}
module.exports = { ejecutar, encendido, getFusiones, ACCIONES };
