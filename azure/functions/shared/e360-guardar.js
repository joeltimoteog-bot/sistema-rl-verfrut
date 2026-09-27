/* ═══════════════════════════════════════════════════════════════════════════
   _E360_AZURE_V1 (27-set-2026) — EVALUACION 360 se guarda PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica sobre dbo.E360_Evaluaciones (hoja BB.DD-EVALUACIONES ya reparada):
     saveEvaluacion360     UPSERT por (supervisor, periodo): si ya hay una evaluacion de ese
                           supervisor en ese mes se reemplaza (conserva su ID); si no, fila nueva
     deleteEvaluacion360   solo ADMINS_EVAL360 (lo dice el login firmado, no la pantalla);
                           quita la fila. Google la archiva en Evaluaciones360_Eliminadas.
   Mismas respuestas que el Apps Script. Periodo va como TEXTO (yyyy-MM).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['saveEvaluacion360', 'deleteEvaluacion360'];
const ADMINS_EVAL360 = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
function lima(d) { const x = new Date(d.getTime() - 5 * 3600e3); return { dia: x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()), hm: p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()) }; }
/* = _e360Fecha / _e360Periodo (lo que llega del navegador nunca es Date) */
const e360Fecha = v => !v ? '' : String(v).substring(0, 10);
const e360Periodo = f => { f = e360Fecha(f); return f.length >= 7 ? f.substring(0, 7) : ''; };
function promComp(comps, nombre) {
  if (!Array.isArray(comps)) return 0;
  for (let i = 0; i < comps.length; i++) { const c = comps[i]; if (String(c.nombre || '').toLowerCase().indexOf(nombre) === 0) return Math.round((Number(c.promedio) || 0) * 100) / 100; }
  return 0;
}

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'e360_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}
function params(r, celdas) {
  const E = TH.ESQ.e360_evaluaciones, f = TH.aFila('e360_evaluaciones', celdas);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  return sets;
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraFija) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'e360_evaluaciones');
  b = b || {};
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = (clave ? 'e360:' + clave : 'e360:sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)).slice(0, 100);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  /* validaciones que no leen la hoja (mismos mensajes que el Apps Script) */
  if (accion === 'saveEvaluacion360' && !b.supervisor) return { status: 200, body: { success: false, error: 'Falta supervisor' } };
  if (accion === 'deleteEvaluacion360') {
    if (ADMINS_EVAL360.indexOf(String(usuario || '').trim().toLowerCase()) === -1) return { status: 200, body: { success: false, error: 'Sin permisos: solo administradores pueden eliminar evaluaciones' } };
    if (!b.id) return { status: 200, body: { success: false, error: 'ID de evaluación requerido' } };
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'e360_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, 'e360_evaluaciones');
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de evaluaciones aun no cargada' } }; }
    const E = TH.ESQ.e360_evaluaciones, ahora = ahoraFija ? new Date(ahoraFija) : new Date(), L = lima(ahora);
    let resp, cuerpo, celdas;
    if (accion === 'saveEvaluacion360') {
      const d = b;
      const fecha = e360Fecha(d.fecha) || L.dia;
      const periodo = d.periodo || e360Periodo(fecha);
      if (!periodo) { await tx.rollback(); return { status: 200, body: { success: false, error: 'No se pudo determinar el periodo' } }; }
      const heads = (T.encabezado || []).map(h => S(h).trim()), iP = heads.indexOf('Periodo'), iD = heads.indexOf('Detalle');
      if (iP === -1 || iD === -1) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Ejecutar eval360Setup() primero (faltan columnas Periodo/Detalle)' } }; }
      const ancho = heads.length;
      const comps = d.competencias || [];
      let total = 0;
      (Array.isArray(comps) ? comps : []).forEach(c => { (c.respuestas || []).forEach(r => { total += Number(r.valor) || 0; }); });
      const usuarioReg = d.evaluadorUser || d.usuario_registro || '';
      let detalle = ''; try { detalle = JSON.stringify(comps); } catch (e) { detalle = '[]'; }
      const sup = String(d.supervisor).trim().toLowerCase();
      const i = T.filas.findIndex(f => S(f[3]).trim().toLowerCase() === sup && S(f[iP]).trim() === periodo);
      const idExist = i >= 0 ? S(T.filas[i][0]) : '';
      const id = i >= 0 && idExist ? idExist : (d.id || ('EVA-' + ahora.getTime()));
      const fila = new Array(ancho).fill('');
      fila[0] = id; fila[1] = fecha; fila[2] = d.evaluador || usuarioReg; fila[3] = String(d.supervisor).trim(); fila[4] = d.empresa || ''; fila[5] = d.sector || '';
      fila[6] = promComp(comps, 'liderazgo'); fila[7] = promComp(comps, 'comunicaci'); fila[8] = promComp(comps, 'cumplimiento');
      fila[9] = promComp(comps, 'gesti'); fila[10] = promComp(comps, 'resoluci'); fila[11] = promComp(comps, 'planificaci');
      fila[12] = total; fila[13] = Number(d.porcentaje) || 0; fila[14] = d.clasificacion || d.nivel || '';
      fila[15] = d.obs !== undefined ? d.obs : (d.observaciones || ''); fila[16] = d.recomendaciones || ''; fila[17] = usuarioReg;
      fila[18] = L.dia + ' ' + L.hm; fila[iP] = periodo; fila[iD] = detalle;
      celdas = fila.map((v, k) => k === iP ? (typeof v === 'string' ? v : String(v)) : CAP.comoHoja(v));   /* Periodo: columna de texto */
      if (i >= 0) {
        const r = tx.request(); r.input('fila', sql.Int, i + 1);
        const sets = params(r, celdas);
        await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
      } else await CAP.agregarFilas(tx, 'e360_evaluaciones', [celdas]);
      resp = { success: true, id, accion: i >= 0 ? 'actualizada' : 'creada', periodo };
      cuerpo = { accion, id: String(id), sup: String(d.supervisor).trim(), periodo, existe: i >= 0, fila };
    } else {
      const i = T.filas.findIndex(f => S(f[0]) === String(b.id));
      if (i < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Evaluación ' + b.id + ' no encontrada' } }; }
      celdas = T.filas[i];
      await tx.request().input('fila', sql.Int, i + 1).query(`DELETE FROM ${E.tabla} WHERE fila = @fila; UPDATE ${E.tabla} SET fila = fila - 1 WHERE fila > @fila;`);
      resp = { success: true, mensaje: 'Evaluación archivada correctamente' };
      cuerpo = { accion, id: String(b.id), usuario: b.usuario, motivo: b.motivo || 'Sin motivo especificado', fecha: ahora.toISOString(), celdas };
    }
    cuerpo.clave = claveOp;
    await CAP.tocarMarcas(tx, ['e360_evaluaciones']);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'e360', @a, NULL, @u, @c, @r)");
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
module.exports = { ejecutar, encendido, ACCIONES, ADMINS_EVAL360 };
