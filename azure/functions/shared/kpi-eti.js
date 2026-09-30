/* ═══════════════════════════════════════════════════════════════════════════
   kpi-eti (_KPI_RRLL_V1, 30-set-2026) — copia a Azure SQL la PROGRAMACION de ETI
   (Firestore sistema-eti-verfrut): programaciones_eti, programaciones_eval y los
   registros de capacitaciones ejecutadas. Solo LEE Firestore (API REST publica que
   ya usan los ETI); en Azure deja tablas reales:
     dbo.ETI_Programaciones (id, origen, supervisor, sector, tema, fechas, fechas_ejecutadas,
                             estado, registro_id, ejecutada_en, veces_reprog, reprogramaciones, ...)
     dbo.ETI_Registros      (id, supervisor, sector, tema, fecha_ejecucion, fecha_envio, ...)
   Cada sincronizacion reemplaza el contenido en UNA transaccion (si Firestore falla,
   lo anterior queda intacto).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');

const FS = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
const KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';   /* la misma llave publica web que usan las paginas ETI */

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.ETI_Programaciones', 'U') IS NULL
      CREATE TABLE dbo.ETI_Programaciones (id NVARCHAR(60) NOT NULL PRIMARY KEY, origen NVARCHAR(10) NOT NULL,
        supervisor NVARCHAR(150) NULL, sector NVARCHAR(150) NULL, tema NVARCHAR(80) NULL,
        fechas NVARCHAR(2000) NULL, fechas_ejecutadas NVARCHAR(2000) NULL, estado NVARCHAR(30) NULL,
        registro_id NVARCHAR(60) NULL, ejecutada_en NVARCHAR(40) NULL, veces_reprog INT NOT NULL DEFAULT 0,
        reprogramaciones NVARCHAR(MAX) NULL, observaciones NVARCHAR(1000) NULL, creado_por NVARCHAR(150) NULL,
        creado_en NVARCHAR(40) NULL, fs_actualizado NVARCHAR(40) NULL, sync DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
    IF OBJECT_ID('dbo.ETI_Registros', 'U') IS NULL
      CREATE TABLE dbo.ETI_Registros (id NVARCHAR(60) NOT NULL PRIMARY KEY, supervisor NVARCHAR(150) NULL, sector NVARCHAR(150) NULL,
        tema NVARCHAR(80) NULL, fecha_ejecucion DATE NULL, fecha_envio DATE NULL, fecha_limite DATE NULL, total INT NULL,
        registrado_por NVARCHAR(150) NULL, creado_en NVARCHAR(40) NULL, sync DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
    IF COL_LENGTH('dbo.ETI_Programaciones', 'solicitudes') IS NULL ALTER TABLE dbo.ETI_Programaciones ADD solicitudes NVARCHAR(MAX) NULL;
    IF OBJECT_ID('dbo.ETI_Usuarios', 'U') IS NULL
      CREATE TABLE dbo.ETI_Usuarios (usuario NVARCHAR(60) NOT NULL, nombre NVARCHAR(150) NULL, estado NVARCHAR(20) NULL, sync DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
    IF OBJECT_ID('dbo.ETI_Supervisores', 'U') IS NULL
      CREATE TABLE dbo.ETI_Supervisores (nombre NVARCHAR(150) NOT NULL, sector NVARCHAR(150) NULL, sync DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());`)
    .catch(e => { listo = null; throw e; });
  return listo;
}

/* valor Firestore REST -> JS */
function val(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(val);
  if ('mapValue' in v) { const o = {}, f = (v.mapValue && v.mapValue.fields) || {}; Object.keys(f).forEach(k => { o[k] = val(f[k]); }); return o; }
  return null;
}
function doc(d) {
  const o = { _id: String(d.name || '').split('/').pop(), _upd: d.updateTime || '' };
  const f = d.fields || {}; Object.keys(f).forEach(k => { o[k] = val(f[k]); });
  return o;
}
async function coleccion(nombre, fetchFn) {
  const f = fetchFn || fetch, out = [];
  let tok = '', vueltas = 0;
  do {
    const url = FS + nombre + '?pageSize=300&key=' + KEY + (tok ? '&pageToken=' + encodeURIComponent(tok) : '');
    const ctrl = new AbortController(), reloj = setTimeout(() => ctrl.abort(), 20000);
    let r;
    try { r = await f(url, { signal: ctrl.signal }); } finally { clearTimeout(reloj); }
    if (!r.ok) throw new Error('Firestore ' + nombre + ' HTTP ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach(d => out.push(doc(d)));
    tok = j.nextPageToken || '';
  } while (tok && ++vueltas < 50);
  return out;
}

const txt = (v, n) => v === null || v === undefined ? null : String(v).slice(0, n);
const dia = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null; };
const lista = (a) => JSON.stringify((Array.isArray(a) ? a : []).map(x => String(x).slice(0, 10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)));

async function insertarLotes(tx, tabla, cols, filas) {
  for (let i = 0; i < filas.length; i += 80) {
    const lote = filas.slice(i, i + 80), r = tx.request(), vals = [];
    lote.forEach((f, j) => {
      vals.push('(' + cols.map((c, k) => { r.input('p' + j + '_' + k, c[1], f[k]); return '@p' + j + '_' + k; }).join(', ') + ')');
    });
    await r.query(`INSERT INTO ${tabla} (${cols.map(c => c[0]).join(', ')}) VALUES ${vals.join(', ')}`);
  }
}

/* Lee Firestore y reemplaza las tablas. Devuelve { programaciones, registros } */
async function sincronizar(pool, fetchFn) {
  await asegurarTablas(pool);
  const [pEti, pEval, regs, usus, sups] = await Promise.all([
    coleccion('programaciones_eti', fetchFn), coleccion('programaciones_eval', fetchFn).catch(() => []), coleccion('capacitaciones', fetchFn),
    coleccion('usuarios_eti', fetchFn), coleccion('supervisores_eti', fetchFn)]);
  const P = [];
  pEti.forEach(d => P.push(['eti', d])); pEval.forEach(d => P.push(['eval', d]));
  const filasP = P.map(([o, d]) => [
    txt(d._id, 60), o, txt(d.supervisor || d.sup, 150), txt(d.sector, 150), txt(d.tema || (o === 'eval' ? 'EVALUACIONES DE CHECKLIST' : ''), 80),
    lista(d.fechas), lista(d.fechasEjecutadas), txt(d.estado, 30), txt(d.registroId, 60), txt(d.ejecutadaEn, 40),
    parseInt(d.vecesReprogramada, 10) || 0, JSON.stringify((d.reprogramaciones || []).map(r => ({ motivo: r.motivo || '', detalle: r.detalle || '',
      registradoPor: r.registradoPor || r.reprogramadoPor || '', fecha: r.fecha || '', cambios: r.cambios || '',
      antes: r.fechasAnterior || r.fechasAntes || [], despues: r.fechasNueva || r.fechasDespues || [] }))).slice(0, 60000),
    txt(d.observaciones || d.obs, 1000), txt(d.creadoPor, 150), txt(d.creadoEn, 40), txt(d._upd, 40),
    JSON.stringify((Array.isArray(d.solicitudesReprog) ? d.solicitudesReprog : []).map(x => ({
      id: x.id || '', estado: x.estado || '', motivo: x.motivo || '', detalle: String(x.detalle || '').slice(0, 1000), fechas: Array.isArray(x.fechas) ? x.fechas : [],
      usuario: x.usuario || '', nombre: x.nombre || '', fecha: x.fecha || '', atendidaEn: x.atendidaEn || '', atendidaPor: x.atendidaPor || '' }))).slice(0, 60000)]);
  const colsP = [['id', sql.NVarChar(60)], ['origen', sql.NVarChar(10)], ['supervisor', sql.NVarChar(150)], ['sector', sql.NVarChar(150)], ['tema', sql.NVarChar(80)],
    ['fechas', sql.NVarChar(2000)], ['fechas_ejecutadas', sql.NVarChar(2000)], ['estado', sql.NVarChar(30)], ['registro_id', sql.NVarChar(60)], ['ejecutada_en', sql.NVarChar(40)],
    ['veces_reprog', sql.Int], ['reprogramaciones', sql.NVarChar(sql.MAX)], ['observaciones', sql.NVarChar(1000)], ['creado_por', sql.NVarChar(150)],
    ['creado_en', sql.NVarChar(40)], ['fs_actualizado', sql.NVarChar(40)], ['solicitudes', sql.NVarChar(sql.MAX)]];
  const filasR = regs.map(d => [txt(d._id, 60), txt(d.supervisor, 150), txt(d.sector, 150), txt(d.tema, 80), dia(d.fechaEjecucion), dia(d.fechaEnvio),
    dia(d.fechaLimite), parseInt(d.total, 10) || null, txt(d.registradoPor, 150), txt(d.creadoEn, 40)]);
  const colsR = [['id', sql.NVarChar(60)], ['supervisor', sql.NVarChar(150)], ['sector', sql.NVarChar(150)], ['tema', sql.NVarChar(80)], ['fecha_ejecucion', sql.Date],
    ['fecha_envio', sql.Date], ['fecha_limite', sql.Date], ['total', sql.Int], ['registrado_por', sql.NVarChar(150)], ['creado_en', sql.NVarChar(40)]];
  /* ids repetidos (misma id en eti y eval) -> se prefija */
  const vistos = {};
  filasP.forEach(f => { if (vistos[f[0]]) f[0] = (f[1] + ':' + f[0]).slice(0, 60); vistos[f[0]] = 1; });
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await tx.request().query('DELETE FROM dbo.ETI_Programaciones; DELETE FROM dbo.ETI_Registros; DELETE FROM dbo.ETI_Usuarios; DELETE FROM dbo.ETI_Supervisores;');
    await insertarLotes(tx, 'dbo.ETI_Usuarios', [['usuario', sql.NVarChar(60)], ['nombre', sql.NVarChar(150)], ['estado', sql.NVarChar(20)]],
      usus.filter(u => u.usuario).map(u => [txt(String(u.usuario).trim().toLowerCase(), 60), txt(u.supervisorNombre || u.nombre, 150), txt(u.estado || 'activo', 20)]));
    await insertarLotes(tx, 'dbo.ETI_Supervisores', [['nombre', sql.NVarChar(150)], ['sector', sql.NVarChar(150)]],
      sups.filter(x => x.nombre || x.supervisor).map(x => [txt(x.nombre || x.supervisor, 150), txt(x.sector, 150)]));
    await insertarLotes(tx, 'dbo.ETI_Programaciones', colsP, filasP);
    await insertarLotes(tx, 'dbo.ETI_Registros', colsR, filasR);
    await tx.request().query(`MERGE dbo.CV_Estado AS x USING (SELECT 'kpi_eti_sync' AS clave) AS s ON x.clave = s.clave
      WHEN MATCHED THEN UPDATE SET valor = CONVERT(NVARCHAR(19), SYSUTCDATETIME(), 126), actualizado = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES ('kpi_eti_sync', CONVERT(NVARCHAR(19), SYSUTCDATETIME(), 126));`);
    await tx.commit();
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  return { programaciones: filasP.length, registros: filasR.length, usuarios: usus.length, supervisores: sups.length };
}

/* Para el motor */
async function leer(pool) {
  await asegurarTablas(pool);
  const p = (await pool.request().query('SELECT * FROM dbo.ETI_Programaciones')).recordset;
  const r = (await pool.request().query('SELECT id, CONVERT(CHAR(10), fecha_ejecucion, 120) AS fecha_ejecucion FROM dbo.ETI_Registros')).recordset;
  const J = (s, d) => { try { return JSON.parse(s || ''); } catch (e) { return d; } };
  const registros = {}; r.forEach(x => { registros[x.id] = { fecha_ejecucion: x.fecha_ejecucion }; });
  const usuarios = {}; (await pool.request().query('SELECT usuario, nombre, estado FROM dbo.ETI_Usuarios')).recordset
    .forEach(x => { usuarios[String(x.usuario).toLowerCase()] = { nombre: x.nombre, estado: x.estado }; });
  const supervisores = (await pool.request().query('SELECT nombre, sector FROM dbo.ETI_Supervisores')).recordset;
  return { programaciones: p.map(x => ({ id: x.id, origen: x.origen, supervisor: x.supervisor, sector: x.sector, tema: x.tema,
    fechas: J(x.fechas, []), fechas_ejecutadas: J(x.fechas_ejecutadas, []), estado: x.estado, registro_id: x.registro_id,
    ejecutada_en: x.ejecutada_en, veces_reprog: x.veces_reprog, reprogramaciones: J(x.reprogramaciones, []), solicitudes: J(x.solicitudes, []) })),
    registros, usuarios, supervisores };
}

module.exports = { asegurarTablas, sincronizar, leer, _t: { val, doc, coleccion } };
