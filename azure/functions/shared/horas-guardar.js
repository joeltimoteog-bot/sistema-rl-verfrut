/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_AZURE_PRIMERO_V1 (27-set-2026) — ACUMULACION DE HORAS se guarda PRIMERO en Azure
   ---------------------------------------------------------------------------
   Registrar, editar, eliminar, aprobar y los motivos van directo a las tablas
   dbo.Horas_Registros / Horas_Motivos / Horas_Pagadas / Horas_Auditoria, con las
   MISMAS reglas del Apps Script (horas-escritura.js, verificado con simulador:
   80 000 casos identicos). La operacion queda en dbo.CV_Ops con las filas
   literales; el Apps Script las copia a la hoja tal cual (mismo ID, mismos valores).
   Los horarios (HORARIOS JORNADA) se siguen editando en la hoja y se sincronizan.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');
const HE = require('./horas-escritura');

/* = HORAS_ADMINS y HORAS_REG_V7 del Apps Script (si cambian alla, cambiar aqui) */
const ADMINS = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas', 'ovilela', 'jchavez'];
const REGISTRADORES = ['dsanchez', 'lmorales', 'jsiancas'];
const ACCIONES = ['horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horasAgregarMotivo', 'horasEliminarMotivo'];
const CLAVES = ['horas_registros', 'horas_motivos', 'horas_horarios', 'horas_pagadas', 'horas_auditoria'];

const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const crudo = v => v instanceof Date ? { $f: v.toISOString() } : v;          /* para el Apps Script: fecha = {$f} */
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'horas_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* reescribe una fila completa (celdas de hoja) */
async function cambiarFila(tx, clave, fila, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, fila);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  const n = await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
  if (!n.rowsAffected[0]) throw new Error('No se encontro la fila ' + fila + ' en ' + E.tabla);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  await CG.asegurarTablas(pool);
  for (const k of CLAVES) await TH.asegurar(pool, k);
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const body = JSON.parse(JSON.stringify(b)); delete body.client_id; delete body.action;
  body.usuario = usuario;                                           /* el usuario sale del token, no de la pantalla */

  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'horas_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const R = await TH.leer(pool, 'horas_registros'), Mo = await TH.leer(pool, 'horas_motivos'), Ho = await TH.leer(pool, 'horas_horarios');
    if (!R || !Mo || !Ho) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tablas de horas aun no cargadas' } }; }
    let ahora = new Date(prueba && ahoraMs ? +ahoraMs : Date.now());
    const ids = new Set(R.filas.map(f => S(f[0])));
    while (ids.has('H' + ahora.getTime()) || ids.has('HC' + ahora.getTime())) ahora = new Date(ahora.getTime() + 1);   /* ID unico */
    const M = HE.crear({ registros: R.filas, motivos: Mo.filas, horarios: Ho.filas, ahora, admins: ADMINS, registradores: REGISTRADORES });
    const o = M.ejecutar(accion, body), resp = o.res;
    if (!resp || !resp.success) { await tx.rollback(); return { status: 200, body: resp || { success: false, error: 'Sin respuesta' } }; }

    const tocar = new Set(), borrarNombres = [];
    if (o.nuevas.length) { await CAP.agregarFilas(tx, 'horas_registros', o.nuevas.map(f => f.map(CAP.comoHoja))); tocar.add('horas_registros'); }
    const porFila = {};
    o.cambios.forEach(([id, col, val]) => {
      const i = R.filas.findIndex(f => f[0] === id);
      if (i < 0) throw new Error('Registro ' + id + ' no esta en la tabla');
      const c = porFila[i] || (porFila[i] = R.filas[i].slice());
      while (c.length < col) c.push('');
      c[col - 1] = CAP.comoHoja(val);
    });
    for (const i of Object.keys(porFila)) { await cambiarFila(tx, 'horas_registros', +i + 1, porFila[i]); tocar.add('horas_registros'); }
    if (o.pagadas) { await CAP.agregarFilas(tx, 'horas_pagadas', [o.pagadas.map(CAP.comoHoja)]); tocar.add('horas_pagadas'); }
    if (o.motivoNuevo.length) { await CAP.agregarFilas(tx, 'horas_motivos', o.motivoNuevo.map(f => f.map(CAP.comoHoja))); tocar.add('horas_motivos'); }
    for (const i of o.motivoBorrar) {
      borrarNombres.push(S(Mo.filas[i][0]).trim());
      await tx.request().input('f', sql.Int, i + 1).query(`DELETE FROM dbo.Horas_Motivos WHERE fila = @f; UPDATE dbo.Horas_Motivos SET fila = fila - 1 WHERE fila > @f;`);
      tocar.add('horas_motivos');
    }
    if (o.logs.length) { await CAP.agregarFilas(tx, 'horas_auditoria', o.logs.map(f => f.map(CAP.comoHoja))); tocar.add('horas_auditoria'); }
    await CAP.tocarMarcas(tx, Array.from(tocar));

    resp.fuente = 'azure';
    const cuerpo = { id: resp.id || body.id || '', nuevas: o.nuevas.map(f => f.map(crudo)), cambios: o.cambios.map(([id, col, v]) => [id, col, crudo(v)]),
      pagadas: o.pagadas ? o.pagadas.map(crudo) : null, motivoNuevo: o.motivoNuevo, motivoBorrar: borrarNombres, logs: o.logs.map(f => f.map(crudo)) };
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'horas', @a, NULL, @u, @c, @r)");
    if (prueba) {
      await tx.rollback();
      resp.prueba = true; resp._ahora = ahora.getTime();
      resp._op = cuerpo;
      resp._celdas = { nuevas: o.nuevas.map(f => f.map(CAP.comoHoja)), pagadas: o.pagadas ? o.pagadas.map(CAP.comoHoja) : null };
    } else await tx.commit();
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
module.exports = { ejecutar, encendido, ACCIONES };
