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
                               + _MANT_UNIDADES_V1: el catalogo de unidades
     unidades       (admin)    _MANT_UNIDADES_V1: catalogo de unidades (rl.mant_unidades) con quien tiene cada una
     unidad_guardar (admin)    crea o edita UNA unidad; si alguien la tiene, sus datos de unidad se actualizan (y la hoja)
   _MANT_UNIDADES_V1 en guardar: al asignar un codigo interno se toman marca/modelo/anio/motor/chasis del catalogo;
   si otra persona tiene esa unidad, NO se guarda salvo que la pantalla confirme (transferir = ese codigo): entonces
   a la otra persona se le quita la unidad (y a la hoja). Nunca dos personas con la misma unidad por esta via.
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
        creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), aplicado DATETIME2(0) NULL, error NVARCHAR(500) NULL);
    IF OBJECT_ID('dbo.Mant_Unidades', 'U') IS NULL
      CREATE TABLE dbo.Mant_Unidades (cod_interno NVARCHAR(60) NOT NULL CONSTRAINT PK_Mant_Unidades PRIMARY KEY,
        marca NVARCHAR(100) NULL, modelo NVARCHAR(100) NULL, anio NVARCHAR(10) NULL, cod_sist NVARCHAR(60) NULL,
        n_motor NVARCHAR(80) NULL, n_chasis NVARCHAR(80) NULL, estado NVARCHAR(20) NULL, obs NVARCHAR(300) NULL,
        actualizado NVARCHAR(20) NULL, por NVARCHAR(60) NULL);`)
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
  /* _MANT_UNIDADES_V1: asignar un codigo interno = tomar la unidad del catalogo (si el catalogo existe) */
  let quitarA = [], crearUnidad = null;
  const cCod = cambios.find(c => c.col === 'cod_interno');
  if (cCod && cCod.v) {
    cCod.v = codigo(cCod.v);
    if (!cCod.v) return { status: 200, body: { ok: false, msg: 'Código interno inválido (letras, números y guion).' } };
    let un = null, hayCatalogo = true;
    try { un = await unidadDe(p, cCod.v); } catch (e) { hayCatalogo = false; }
    if (hayCatalogo) {
      if (un && un.estado && un.estado !== 'OPERATIVA')
        return { status: 200, body: { ok: false, msg: 'La unidad ' + cCod.v + ' está ' + (un.estado === 'DE BAJA' ? 'de baja' : 'en taller') + ': no se puede asignar.' } };
      if (un) {   /* el catalogo manda en los datos de la unidad */
        UN_CAMPOS.forEach(f => { if (f[0] === 'cod_interno' || !un[f[0]]) return;
          const v = valor(f[0], un[f[0]], f[2]), x = cambios.find(c => c.col === f[0]);
          if (x) x.v = v; else cambios.push({ col: f[0], v, n: f[2], idx: CAMPOS.findIndex(y => y[0] === f[0]) }); });
      } else crearUnidad = cCod.v;
      const todos = (await p.request().query('SELECT dni, nombre, cod_interno FROM dbo.Mant_Responsables')).recordset;
      const yaLaTiene = todos.some(r => String(r.dni) === dni && codigo(r.cod_interno) === cCod.v);   /* la misma unidad de antes: no es traspaso */
      const otros = yaLaTiene ? [] : todos.filter(r => String(r.dni) !== dni && codigo(r.cod_interno) === cCod.v);
      if (otros.length && codigo(b.transferir) !== cCod.v)
        return { status: 200, body: { ok: false, ocupada: true, de: otros.map(o => o.nombre || ''),
          msg: 'La unidad ' + cCod.v + ' está asignada a ' + otros.map(o => o.nombre || 'otra persona').join(' y ') + '.' } };
      quitarA = otros.map(o => String(o.dni));
    }
  }
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
    /* _MANT_UNIDADES_V1: traspaso confirmado -> a la otra persona se le quita la unidad (tabla + hoja) */
    for (const d2 of quitarA) await ponerUnidad(tx, d2, null, sello, por);
    if (crearUnidad) {
      const v = {}; UN_CAMPOS.forEach(f => { const x = cambios.find(c => c.col === f[0]); v[f[0]] = x ? x.v : ''; });
      v.cod_interno = crearUnidad;
      await tx.request().input('c', sql.NVarChar(60), crearUnidad).input('ma', sql.NVarChar(100), v.marca).input('mo', sql.NVarChar(100), v.modelo)
        .input('an', sql.NVarChar(10), v.anio).input('cs', sql.NVarChar(60), v.cod_sist).input('nm', sql.NVarChar(80), v.n_motor)
        .input('nc', sql.NVarChar(80), v.n_chasis).input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), por)
        .query(`MERGE dbo.Mant_Unidades AS x USING (SELECT @c AS cod_interno) AS s ON x.cod_interno = s.cod_interno
          WHEN NOT MATCHED THEN INSERT (cod_interno, marca, modelo, anio, cod_sist, n_motor, n_chasis, estado, actualizado, por)
                                VALUES (@c, @ma, @mo, @an, @cs, @nm, @nc, 'OPERATIVA', @s, @por);`);
    }
    await tx.commit();
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  const r = await p.request().input('d', sql.NVarChar(15), dni).query('SELECT * FROM dbo.Mant_Responsables WHERE dni = @d');
  let quitados = [];
  if (quitarA.length) { const q = await p.request().query('SELECT * FROM dbo.Mant_Responsables');
    quitados = q.recordset.filter(x => quitarA.indexOf(String(x.dni)) >= 0).map(aItem); }
  return { status: 200, body: { ok: true, item: r.recordset.length ? aItem(r.recordset[0]) : null, quitados, fuente: 'supabase' } };
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
  let unidades = null;   /* si el catalogo aun no existe, la Ficha funciona igual (sin lista de unidades) */
  try { unidades = await catalogo(p, items, usr(t.usuario)); } catch (e) { unidades = null; }
  return { status: 200, body: { ok: true, items, usuarios, unidades, fuente: 'supabase' } };
}

/* ── _MANT_UNIDADES_V1 (17-nov-2026): catalogo de unidades ──
   campos de la unidad: [columna, campo de la pantalla, largo]; los 7 primeros son tambien columnas de la hoja */
const UN_CAMPOS = [['cod_interno', 'codInterno', 60], ['marca', 'marca', 100], ['modelo', 'modelo', 100], ['anio', 'anio', 10],
  ['cod_sist', 'codSist', 60], ['n_motor', 'nMotor', 80], ['n_chasis', 'nChasis', 80]];
const ESTADOS = ['OPERATIVA', 'EN TALLER', 'DE BAJA'];
function codigo(v) { const s = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ' ').trim(); return /^[A-Z0-9][A-Z0-9 \-\/.]{0,29}$/.test(s) ? s : ''; }
async function unidadDe(p, cod) {
  const r = await p.request().input('c', sql.NVarChar(60), cod).query('SELECT * FROM dbo.Mant_Unidades WHERE cod_interno = @c');
  if (!r.recordset.length) return null;
  const u = r.recordset[0]; u.estado = String(u.estado || 'OPERATIVA').toUpperCase(); return u;
}
/* pone (o quita, con un = null) los datos de unidad de UNA persona, en la tabla y en la hoja (CV_Ops) */
async function ponerUnidad(tx, dni, un, sello, por) {
  const rq = tx.request().input('dni', sql.NVarChar(15), dni).input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), por);
  const celdas = { 0: dni };
  UN_CAMPOS.forEach((f, k) => { const v = un ? valor(f[0], un[f[0]], f[2]) : ''; rq.input('v' + k, sql.NVarChar(f[2]), v);
    celdas[CAMPOS.findIndex(c => c[0] === f[0])] = v; });
  await rq.query('UPDATE dbo.Mant_Responsables SET ' + UN_CAMPOS.map((f, k) => f[0] + ' = @v' + k).join(', ') + ', actualizado = @s, por = @por WHERE dni = @dni');
  const clave = ('resp:' + dni + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 7)).slice(0, 100);
  await tx.request().input('k', sql.NVarChar(100), clave).input('u', sql.NVarChar(100), por)
    .input('c', sql.NVarChar(sql.MAX), JSON.stringify({ accion: 'guardarResponsable', dni, celdas, por, sello })).input('r', sql.NVarChar(sql.MAX), JSON.stringify({ ok: true }))
    .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'resp', 'guardarResponsable', NULL, @u, @c, @r)");
}
function aUnidad(u, items) {
  const o = {}; UN_CAMPOS.forEach(f => { o[f[1]] = u[f[0]] == null ? '' : String(u[f[0]]); });
  o.estado = String(u.estado || 'OPERATIVA').toUpperCase(); o.obs = u.obs || ''; o.actualizado = u.actualizado || ''; o.por = u.por || '';
  o.asignados = items.filter(i => codigo(i.codInterno) === codigo(o.codInterno)).map(i => ({ dni: i.dni, nombre: i.usuario }));
  o.situacion = o.estado !== 'OPERATIVA' ? o.estado : (o.asignados.length ? 'ASIGNADA' : 'DISPONIBLE');
  return o;
}
/* catalogo completo; los codigos que ya usan las personas y aun no estan, se agregan solos (nunca se pisa nada) */
async function catalogo(p, items, quien) {
  let r = (await p.request().query('SELECT * FROM dbo.Mant_Unidades')).recordset;
  const ya = new Set(r.map(u => codigo(u.cod_interno)));
  const faltan = {};
  items.forEach(i => { const c = codigo(i.codInterno); if (!c || ya.has(c)) return;
    const f = faltan[c] || (faltan[c] = {}); UN_CAMPOS.forEach(x => { if (!f[x[0]] && i[x[1]]) f[x[0]] = i[x[1]]; }); });
  const ks = Object.keys(faltan);
  if (ks.length) {
    const sello = limaSello();
    for (const c of ks) {
      const f = faltan[c], rq = p.request().input('c', sql.NVarChar(60), c).input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), 'auto:' + (quien || ''));
      UN_CAMPOS.slice(1).forEach((x, k) => rq.input('v' + k, sql.NVarChar(x[2]), txt(f[x[0]], x[2]) || null));
      try { await rq.query(`INSERT INTO dbo.Mant_Unidades (cod_interno, ${UN_CAMPOS.slice(1).map(x => x[0]).join(', ')}, estado, actualizado, por)
        VALUES (@c, ${UN_CAMPOS.slice(1).map((x, k) => '@v' + k).join(', ')}, 'OPERATIVA', @s, @por);`); }
      catch (e) { if (!/duplicate|PK_Mant_Unidades|unique/i.test(e.message || '')) throw e; }
    }
    r = (await p.request().query('SELECT * FROM dbo.Mant_Unidades')).recordset;
  }
  return r.map(u => aUnidad(u, items)).sort((a, b) => a.codInterno.localeCompare(b.codInterno, 'es', { numeric: true }));
}
async function unidades(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador puede ver las unidades.' } };
  const p = await pool();
  const items = (await p.request().query('SELECT * FROM dbo.Mant_Responsables')).recordset.map(aItem);
  return { status: 200, body: { ok: true, unidades: await catalogo(p, items, usr(t.usuario)), fuente: 'supabase' } };
}
async function unidadGuardar(b, t) {
  if (!esAdmin(t)) return { status: 403, body: { ok: false, msg: 'Solo un administrador puede editar unidades.' } };
  const cod = codigo(b.codInterno);
  if (!cod) return { status: 200, body: { ok: false, msg: 'Código interno inválido (letras, números y guion; hasta 30).' } };
  const d = b.campos || {};
  const estado = Object.prototype.hasOwnProperty.call(d, 'estado') ? String(d.estado || '').toUpperCase().trim() : null;
  if (estado !== null && ESTADOS.indexOf(estado) < 0) return { status: 200, body: { ok: false, msg: 'Estado inválido.' } };
  const p = await pool(), sello = limaSello(), por = usr(t.usuario);
  const ant = await unidadDe(p, cod);
  if (b.nuevo && ant) return { status: 200, body: { ok: false, existe: true, msg: 'Ya existe una unidad con el código ' + cod + '.' } };
  if (!b.nuevo && !ant) return { status: 200, body: { ok: false, msg: 'La unidad ' + cod + ' ya no existe. Actualiza la lista.' } };
  const resp = (await p.request().query('SELECT * FROM dbo.Mant_Responsables')).recordset.map(aItem);
  const duenos = resp.filter(i => codigo(i.codInterno) === cod);
  if (estado === 'DE BAJA' && duenos.length)
    return { status: 200, body: { ok: false, msg: 'Antes de dar de baja la unidad, quítasela a ' + duenos.map(x => x.usuario).join(' y ') + '.' } };
  const nuevo = {}; UN_CAMPOS.slice(1).forEach(f => { nuevo[f[0]] = Object.prototype.hasOwnProperty.call(d, f[1]) ? valor(f[0], d[f[1]], f[2]) : (ant ? txt(ant[f[0]], f[2]) : ''); });
  const est = estado !== null ? estado : (ant ? String(ant.estado || 'OPERATIVA').toUpperCase() : 'OPERATIVA');
  const obs = Object.prototype.hasOwnProperty.call(d, 'obs') ? txt(d.obs, 300) : (ant ? txt(ant.obs, 300) : '');
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const rq = tx.request().input('c', sql.NVarChar(60), cod).input('e', sql.NVarChar(20), est).input('o', sql.NVarChar(300), obs)
      .input('s', sql.NVarChar(20), sello).input('por', sql.NVarChar(60), por);
    UN_CAMPOS.slice(1).forEach((f, k) => rq.input('v' + k, sql.NVarChar(f[2]), nuevo[f[0]]));
    await rq.query(`MERGE dbo.Mant_Unidades AS x USING (SELECT @c AS cod_interno) AS s ON x.cod_interno = s.cod_interno
      WHEN MATCHED THEN UPDATE SET ${UN_CAMPOS.slice(1).map((f, k) => f[0] + ' = @v' + k).join(', ')}, estado = @e, obs = @o, actualizado = @s, por = @por
      WHEN NOT MATCHED THEN INSERT (cod_interno, ${UN_CAMPOS.slice(1).map(f => f[0]).join(', ')}, estado, obs, actualizado, por)
                            VALUES (@c, ${UN_CAMPOS.slice(1).map((f, k) => '@v' + k).join(', ')}, @e, @o, @s, @por);`);
    /* quien tenga la unidad recibe los datos corregidos (solo si cambiaron), tambien en la hoja */
    const un = Object.assign({ cod_interno: cod }, nuevo);
    for (const x of duenos) {
      const igual = UN_CAMPOS.every(f => String(x[f[1]] || '') === String(f[0] === 'cod_interno' ? x.codInterno : un[f[0]] || ''));
      if (!igual) await ponerUnidad(tx, String(x.dni), un, sello, por);
    }
    await tx.commit();
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  const resp2 = (await p.request().query('SELECT * FROM dbo.Mant_Responsables')).recordset.map(aItem);
  return { status: 200, body: { ok: true, unidades: await catalogo(p, resp2, por), items: resp2, fuente: 'supabase' } };
}

const ACCIONES = { listar, buscar, guardar, sembrar, ficha, unidades, unidad_guardar: unidadGuardar };
module.exports = { ACCIONES, CAMPOS, esAdmin, dniOk, fecha, asegurarTablas, aItem };
