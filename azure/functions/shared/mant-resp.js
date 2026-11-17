/* ═══════════════════════════════════════════════════════════════════════════
   _MANT_RESP_V1 (17-nov-2026) — RESPONSABLES DE UNIDADES (Mantenimiento) en Supabase
   ---------------------------------------------------------------------------
   Tabla dbo.Mant_Responsables (rl.mant_responsables): una fila por persona (DNI) con las
   MISMAS columnas que la hoja "BB.DD. RESPONSABLES" (A-V), mas usuario del sistema y quien edito.
   Supabase manda. Cada cambio deja una operacion en dbo.CV_Ops (tipo 'resp') y el Apps Script
   la copia a la hoja (solo las columnas que cambiaron), porque la hoja la siguen usando:
   la busqueda por DNI de Google, el correo al solicitante y la alerta diaria de licencias.
   Acciones:
     listar   (admin)          todos los responsables
     buscar   (con sesion)     uno por DNI, con la forma de buscarResponsableMantenimiento
     guardar  (admin)          crea o actualiza UNA persona (solo los campos enviados)
     sembrar  (admin)          agrega desde la hoja los DNI que aun no estan (nunca pisa nada)
     ficha    (admin)          _MANT_TODOS_V2: TODO en una sola respuesta: responsables + usuarios activos del sistema
                               + el DNI de cada usuario segun el padron (busqueda por nombre; solo si hay UN DNI)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('./db');
const EMP = require('./empresas');

/* columnas de la hoja en orden A..V: [campo de la tabla, campo de la pantalla, largo] */
const CAMPOS = [
  ['dni', 'dni', 15], ['nombre', 'usuario', 200], ['correo', 'correo', 200], ['cargo', 'cargo', 150],
  ['modelo', 'modelo', 100], ['marca', 'marca', 100], ['cod_interno', 'codInterno', 60], ['cod_sist', 'codSist', 60],
  ['n_motor', 'nMotor', 80], ['n_chasis', 'nChasis', 80], ['anio', 'anio', 10], ['estatus', 'estatus', 60],
  ['zona_recorrido', 'zonaRecorrido', 150], ['n_licencia', 'numLicencia', 120], ['f_expedicion', 'fExpedicion', 20],
  ['f_revalidacion', 'fRevalidacion', 20], ['empresa', 'empresa', 20], ['zona_abastecimiento', 'zonaAbastecimiento', 150],
  ['municipalidad', 'municipalidad', 150], ['n_licencia_carro', 'numLicenciaCarro', 120],
  ['f_expedicion_carro', 'fExpedicionCarro', 20], ['f_revalidacion_carro', 'fRevalidacionCarro', 20]
];
const EXTRA = [['usuario_sistema', 'usuarioSistema', 60]];
const ROLES_ADMIN = ['administrador', 'admin', 'administrador 01', 'administrador 02', 'admin01', 'admin02'];

const usr = (u) => String(u == null ? '' : u).toLowerCase().trim();
const txt = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const esAdmin = (t) => !!t && (usr(t.usuario) === 'jtimoteo' || ROLES_ADMIN.indexOf(usr(t.rol)) >= 0);
function dniOk(v) { const d = String(v == null ? '' : v).replace(/\D/g, ''); return (d.length >= 7 && d.length <= 12) ? d : ''; }
/* fechas como las muestra la hoja: dd/mm/aaaa; acepta tambien aaaa-mm-dd */
function fecha(v) {
  const s = String(v == null ? '' : v).trim(); if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return ('0' + m[3]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[1];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4,5})$/); if (m) return ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3];
  return s.slice(0, 20);
}
const ES_FECHA = { f_expedicion: 1, f_revalidacion: 1, f_expedicion_carro: 1, f_revalidacion_carro: 1 };
function valor(col, v, n) { return ES_FECHA[col] ? fecha(v) : txt(v, n); }
function limaSello() { const x = new Date(Date.now() - 5 * 3600e3), p = (k) => ('0' + k).slice(-2); return p(x.getUTCDate()) + '/' + p(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear() + ' ' + p(x.getUTCHours()) + ':' + p(x.getUTCMinutes()); }

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.Mant_Responsables', 'U') IS NULL
      CREATE TABLE dbo.Mant_Responsables (
        dni NVARCHAR(15) NOT NULL CONSTRAINT PK_Mant_Responsables PRIMARY KEY,
        ${CAMPOS.slice(1).map(c => c[0] + ' NVARCHAR(' + c[2] + ') NULL').join(', ')},
        usuario_sistema NVARCHAR(60) NULL, actualizado NVARCHAR(20) NULL, por NVARCHAR(60) NULL);
    IF OBJECT_ID('dbo.CV_Ops', 'U') IS NULL
      CREATE TABLE dbo.CV_Ops (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, clave NVARCHAR(100) NOT NULL CONSTRAINT UQ_CV_Ops_clave UNIQUE,
        tipo NVARCHAR(20) NOT NULL, accion NVARCHAR(30) NOT NULL, nro INT NULL, usuario NVARCHAR(100) NULL,
        cuerpo NVARCHAR(MAX) NOT NULL, respuesta NVARCHAR(MAX) NULL, en_hoja BIT NOT NULL DEFAULT 0,
        creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), aplicado DATETIME2(0) NULL, error NVARCHAR(500) NULL);`)
    .catch(e => { listo = null; throw e; });
  return listo;
}
async function pool() { const p = await getPool(); await asegurarTablas(p); return p; }

/* fila de la tabla -> objeto con la forma de listaConductores (+ campos extra) */
function aItem(r) {
  const o = {};
  CAMPOS.concat(EXTRA).forEach(c => { o[c[1]] = r[c[0]] == null ? '' : String(r[c[0]]); });
  o.actualizado = r.actualizado || ''; o.por = r.por || '';
  return o;
}

async function listar(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador puede ver la lista de responsables.' } };
  const p = await pool();
  const r = await p.request().query('SELECT * FROM dbo.Mant_Responsables ORDER BY nombre');
  return { status: 200, body: { ok: true, items: r.recordset.map(aItem), fuente: 'supabase' } };
}

async function buscar(b) {
  const dni = dniOk(b.dni);
  if (!dni) return { status: 200, body: { ok: false, msg: 'DNI inválido' } };
  const p = await pool();
  const r = await p.request().input('d', sql.NVarChar(15), dni).query('SELECT * FROM dbo.Mant_Responsables WHERE dni = @d');
  if (!r.recordset.length) return { status: 200, body: { ok: false, noEsta: true, msg: 'DNI no encontrado en responsables' } };
  const i = aItem(r.recordset[0]);
  return { status: 200, body: { ok: true, fuente: 'supabase', data: {
    nombre: i.usuario, correo: i.correo, cargo: i.cargo, modelo: i.modelo, marca: i.marca, codInterno: i.codInterno,
    numLicencia: i.numLicencia, fExpedicion: i.fExpedicion, fRevalidacion: i.fRevalidacion, empresa: i.empresa } } };
}

async function guardar(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador puede asignar unidades.' } };
  const dni = dniOk(b.dni);
  if (!dni) return { status: 200, body: { ok: false, msg: 'DNI inválido (7 a 12 dígitos).' } };
  const d = b.campos || {};
  /* solo los campos enviados; el DNI no se cambia por aqui */
  const cambios = CAMPOS.concat(EXTRA).filter(c => c[0] !== 'dni' && Object.prototype.hasOwnProperty.call(d, c[1]))
    .map(c => ({ col: c[0], v: valor(c[0], d[c[1]], c[2]), n: c[2], idx: CAMPOS.findIndex(x => x[0] === c[0]) }));
  if (!cambios.length) return { status: 200, body: { ok: false, msg: 'No hay datos para guardar.' } };
  const p = await pool(), sello = limaSello(), por = usr(t.usuario);
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const rq = tx.request().input('dni', sql.NVarChar(15), dni).input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), por);
    cambios.forEach((c, k) => rq.input('v' + k, sql.NVarChar(c.n), c.v));
    const sets = cambios.map((c, k) => c.col + ' = @v' + k).join(', ');
    await rq.query(`MERGE dbo.Mant_Responsables AS x USING (SELECT @dni AS dni) AS s ON x.dni = s.dni
      WHEN MATCHED THEN UPDATE SET ${sets}, actualizado = @s, por = @por
      WHEN NOT MATCHED THEN INSERT (dni, ${cambios.map(c => c.col).join(', ')}, actualizado, por)
                            VALUES (@dni, ${cambios.map((c, k) => '@v' + k).join(', ')}, @s, @por);`);
    /* copia a la hoja: indice de columna (0 = A) -> valor; solo columnas de la hoja */
    const celdas = {}; celdas[0] = dni;
    cambios.forEach(c => { if (c.idx >= 0) celdas[c.idx] = c.v; });
    const clave = ('resp:' + dni + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 7)).slice(0, 100);
    const cuerpo = { accion: 'guardarResponsable', dni, celdas, por, sello };
    await tx.request().input('k', sql.NVarChar(100), clave).input('u', sql.NVarChar(100), por)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify({ ok: true }))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'resp', 'guardarResponsable', NULL, @u, @c, @r)");
    await tx.commit();
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  const r = await p.request().input('d', sql.NVarChar(15), dni).query('SELECT * FROM dbo.Mant_Responsables WHERE dni = @d');
  return { status: 200, body: { ok: true, item: r.recordset.length ? aItem(r.recordset[0]) : null, fuente: 'supabase' } };
}

async function sembrar(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador.' } };
  const items = Array.isArray(b.items) ? b.items.slice(0, 2000) : [];
  const p = await pool();
  const ya = new Set((await p.request().query('SELECT dni FROM dbo.Mant_Responsables')).recordset.map(x => String(x.dni)));
  let agregados = 0, invalidos = 0;
  const sello = limaSello(), por = 'hoja:' + usr(t.usuario);
  for (const it of items) {
    const dni = dniOk(it && it.dni);
    if (!dni) { invalidos++; continue; }
    if (ya.has(dni)) continue;
    const rq = p.request().input('dni', sql.NVarChar(15), dni).input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), por);
    const cols = CAMPOS.slice(1);
    cols.forEach((c, k) => rq.input('v' + k, sql.NVarChar(c[2]), valor(c[0], it[c[1]], c[2]) || null));
    try {
      await rq.query(`INSERT INTO dbo.Mant_Responsables (dni, ${cols.map(c => c[0]).join(', ')}, actualizado, por)
        VALUES (@dni, ${cols.map((c, k) => '@v' + k).join(', ')}, @s, @por);`);
      agregados++;
    } catch (e) { if (!/duplicate|PK_Mant_Responsables|unique/i.test(e.message || '')) throw e; }   /* otro admin lo agrego a la vez */
    ya.add(dni);
  }
  return { status: 200, body: { ok: true, recibidos: items.length, agregados, invalidos, total: ya.size } };
}

/* ── _MANT_TODOS_V2 (17-nov-2026): la Ficha completa en UNA consulta del navegador ── */
const sinTilde = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const CACHE_PADRON = new Map();          /* nombre normalizado -> { v, t }  (10 min) */
async function dniDelPadron(p, tablas, nombre) {
  const q = sinTilde(nombre).toUpperCase();
  const palabras = q.split(/\s+/).filter(w => w.length >= 2).slice(0, 5);
  if (palabras.length < 2 || !tablas.length) return null;
  const c = CACHE_PADRON.get(q); if (c && Date.now() - c.t < 600000) return c.v;
  const rq = p.request();
  const conds = palabras.map((w, i) => { rq.input('w' + i, sql.NVarChar(120), '%' + w + '%'); return 'nombre_completo LIKE @w' + i; }).join(' AND ');
  const r = await rq.query(tablas.map(t => `(SELECT TOP 30 dni, nombre_completo FROM dbo.${t} WHERE ${conds})`).join(' UNION ALL '));
  const d = {};
  (r.recordset || []).forEach(x => { const k = String(x.dni == null ? '' : x.dni).replace(/\D/g, ''); if (k) d[k] = String(x.nombre_completo || '').toUpperCase().trim(); });
  const ks = Object.keys(d), v = ks.length === 1 ? { dni: ks[0], nombre: d[ks[0]] } : null;
  CACHE_PADRON.set(q, { v, t: Date.now() });
  return v;
}
async function ficha(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador puede ver la ficha de conductores.' } };
  const p = await pool();
  const items = (await p.request().query('SELECT * FROM dbo.Mant_Responsables ORDER BY nombre')).recordset.map(aItem);
  let us;
  try { us = (await p.request().query('SELECT usuario, nombre, rol, empresa, activo, correo, cargo, eliminado FROM dbo.usuarios')).recordset; }
  catch (e) { us = (await p.request().query('SELECT usuario, nombre, rol, empresa, activo, correo, cargo FROM dbo.usuarios')).recordset; }
  const activos = us.filter(u => u.usuario && u.activo !== false && u.activo !== 0 && !(u.eliminado === true || u.eliminado === 1));
  let tablas = [];
  try { tablas = Array.from(await EMP.tablasExistentes(p, sql)); } catch (e) {}
  const usuarios = [];
  let i = 0;
  async function trabajador() {
    while (i < activos.length) {
      const u = activos[i++];
      let pd = null; try { pd = await dniDelPadron(p, tablas, u.nombre); } catch (e) { pd = null; }
      usuarios.push({ usuario: usr(u.usuario), nombre: u.nombre || '', rol: u.rol || '', empresa: u.empresa || '', correo: u.correo || '', cargo: u.cargo || '',
                      dni: pd ? pd.dni : '', nombreCompleto: pd ? pd.nombre : '' });
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
  usuarios.sort((a, b2) => String(a.nombre).localeCompare(String(b2.nombre)));
  return { status: 200, body: { ok: true, items, usuarios, fuente: 'supabase' } };
}

const ACCIONES = { listar, buscar, guardar, sembrar, ficha };
module.exports = { ACCIONES, CAMPOS, esAdmin, dniOk, fecha, asegurarTablas, aItem };
