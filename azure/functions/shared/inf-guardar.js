/* ═══════════════════════════════════════════════════════════════════════════
   _INF_AZURE_V1 (24-oct-2026) — INFORMES INTEGRALES (Evaluacion 360) se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica las versiones vigentes del Apps Script sobre dbo.Informes_Integrales (15 cols):
     saveInformeIntegral      id = 'INF-yyyyMMdd-HHmmss' (hora de Lima), fecha_creacion = fecha_actualizacion = ahora
     updateInformeIntegral    por id: fecha_actualizacion + los campos que vengan definidos
     getInformesIntegrales    objetos por nombre de columna (mas recientes primero), filtro p.supervisor
   La operacion queda en dbo.CV_Ops (tipo 'inf'); el Apps Script la copia a la hoja.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const CLAVE = 'inf_registro';
const ACCIONES = ['saveInformeIntegral', 'updateInformeIntegral'];
const LECTURAS = ['getInformesIntegrales'];
const CAMPOS = ['supervisor', 'periodo', 'percepcion', 'com_colaboradores', 'com_jefaturas', 'com_supervisores', 'com_administrador', 'com_visitas', 'observaciones', 'calificacion_global', 'nivel', 'generado_por'];
const ANCHO = 15;
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const lima = ms => new Date(ms - 5 * 3600e3);
const idLima = ms => { const x = lima(ms); return 'INF-' + x.getUTCFullYear() + p2(x.getUTCMonth() + 1) + p2(x.getUTCDate()) + '-' + p2(x.getUTCHours()) + p2(x.getUTCMinutes()) + p2(x.getUTCSeconds()); };
const ahoraTxt = ms => { const x = lima(ms); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()) + ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()) + ':' + p2(x.getUTCSeconds()); };

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'inf_azure_primero'");
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
  b = b || {};
  if (accion === 'updateInformeIntegral' && !b.id) return { status: 200, body: { success: false, error: 'Falta id' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, CLAVE);
  const huella = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = huella ? accion + ':' + huella : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (huella && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'inf_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, CLAVE);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de informes aun no cargada' } }; }
    const cab = (T.encabezado || []).map(x => S(x).trim());
    const col = n => cab.indexOf(n);
    let resp, cuerpo, nuevas = [], cambiadas = [];
    if (accion === 'saveInformeIntegral') {
      const id = idLima(ms), ahora = ahoraTxt(ms);
      const fila = [id, ahora, ahora, b.supervisor || '', b.periodo || '', b.percepcion || '', b.com_colaboradores || '', b.com_jefaturas || '', b.com_supervisores || '',
        b.com_administrador || '', b.com_visitas || '', b.observaciones || '', b.calificacion_global || '', b.nivel || '', b.generado_por || ''];
      const celdas = fila.map(v => CAP.comoHoja(v));
      nuevas.push(celdas); await CAP.agregarFilas(tx, CLAVE, nuevas);
      resp = { success: true, id };
      cuerpo = { accion, fila, ms };
    } else {
      const i = T.filas.findIndex(f => S(f[0]).trim() === String(b.id).trim());
      if (i < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Informe no encontrado: ' + b.id } }; }
      const celdas = T.filas[i].slice(); while (celdas.length < Math.max(ANCHO, cab.length)) celdas.push('');
      const cambios = {};
      const set = (campo, valor) => { const k = col(campo); if (k >= 0 && valor !== undefined) { celdas[k] = CAP.comoHoja(valor); cambios[campo] = valor; } };
      set('fecha_actualizacion', ahoraTxt(ms));
      CAMPOS.forEach(c => set(c, b[c]));
      await actualizarFila(tx, i, celdas); cambiadas.push({ fila: i + 2, celdas });
      resp = { success: true, id: b.id };
      cuerpo = { accion, id: String(b.id), cambios, ms };
    }
    await CAP.tocarMarcas(tx, [CLAVE]);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'inf', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._nuevas = nuevas; resp._cambiadas = cambiadas; } else await tx.commit();
    return { status: 200, body: resp };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (huella && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}

/* = getInformesIntegrales del Apps Script: objeto por cabecera; las fechas como las entrega Google en JSON (ISO) */
function getInformesIntegrales(T, p) {
  p = p || {};
  const cab = (T.encabezado || []).map(x => S(x).trim());
  const val = v => esD(v) ? (v.$d || '') : (v === null || v === undefined ? '' : v);
  const out = [];
  T.filas.forEach(r => {
    const o = {}; cab.forEach((c, k) => { o[c] = val(r[k]); });
    if (p.supervisor && String(o.supervisor).toUpperCase().indexOf(String(p.supervisor).toUpperCase()) === -1) return;
    out.push(o);
  });
  out.reverse();
  return { success: true, data: out, fuente: 'azure' };
}

module.exports = { ejecutar, encendido, getInformesIntegrales, ACCIONES, LECTURAS, CLAVE };
