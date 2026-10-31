/* ═══════════════════════════════════════════════════════════════════
   prec (_PREC_AZURE_V1, 31-oct-2026) — Casos Precedentes (banco de referencia de RR.LL.)
   POST /api/prec/{listar|obtener|guardar|editar|eliminar|materias}   Authorization: Bearer <token del login>
   · 100 % Azure: tabla dbo.Casos_Precedentes con columnas propias (sin hoja de Google).
   · Lectura: cualquier usuario con sesion. Escritura/eliminacion: solo administracion (mismos roles que compromiso).
   · Eliminar es logico (activo = 0): nada se pierde.
   ═══════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const { getPool } = require('../shared/db');

const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02', 'coordinador', 'jefa_rl'];
const SANCIONES = ['Sin sancion', 'Llamada de atencion', 'Amonestacion verbal', 'Amonestacion escrita', 'Suspension sin goce de haber', 'Despido', 'Renuncia / cese', 'Otro'];
const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 4000);
let listo = null;

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
function asegurarTabla(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.Casos_Precedentes', 'U') IS NULL
      CREATE TABLE dbo.Casos_Precedentes (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Casos_Precedentes PRIMARY KEY,
        codigo NVARCHAR(20) NOT NULL CONSTRAINT UQ_Casos_Precedentes_codigo UNIQUE,
        dni NVARCHAR(20) NULL, nombre NVARCHAR(200) NULL, empresa NVARCHAR(60) NULL, fundo NVARCHAR(120) NULL, cargo NVARCHAR(120) NULL,
        caso_nro NVARCHAR(40) NULL, caso_fecha DATE NULL,
        materia NVARCHAR(120) NOT NULL, hechos NVARCHAR(MAX) NOT NULL, procedimiento NVARCHAR(MAX) NOT NULL,
        sancion NVARCHAR(80) NOT NULL, motivo_precedente NVARCHAR(MAX) NOT NULL, palabras_clave NVARCHAR(400) NULL,
        adjuntos NVARCHAR(MAX) NULL,
        creado_por NVARCHAR(100) NOT NULL, creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        actualizado_por NVARCHAR(100) NULL, actualizado DATETIME2(0) NULL,
        activo BIT NOT NULL DEFAULT 1);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Casos_Precedentes_dni') CREATE INDEX IX_Casos_Precedentes_dni ON dbo.Casos_Precedentes (dni);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Casos_Precedentes_materia') CREATE INDEX IX_Casos_Precedentes_materia ON dbo.Casos_Precedentes (materia, activo);
  `).catch(e => { listo = null; throw e; });
  return listo;
}
function fila(r) {
  let adj = []; try { adj = JSON.parse(r.adjuntos || '[]'); } catch (e) {}
  return Object.assign({}, r, { adjuntos: adj, caso_fecha: r.caso_fecha ? new Date(r.caso_fecha).toISOString().slice(0, 10) : null });
}
function validar(b) {
  const faltan = [];
  if (!s(b.materia)) faltan.push('materia');
  if (!s(b.hechos)) faltan.push('hechos');
  if (!s(b.procedimiento)) faltan.push('como se procedio');
  if (!s(b.sancion)) faltan.push('sancion');
  if (!s(b.motivo_precedente)) faltan.push('por que queda como precedente');
  return faltan;
}
function cargar(rq, b) {
  rq.input('dni', sql.NVarChar(20), s(b.dni, 20) || null).input('nombre', sql.NVarChar(200), s(b.nombre, 200) || null)
    .input('empresa', sql.NVarChar(60), s(b.empresa, 60).toUpperCase() || null).input('fundo', sql.NVarChar(120), s(b.fundo, 120) || null)
    .input('cargo', sql.NVarChar(120), s(b.cargo, 120) || null).input('caso_nro', sql.NVarChar(40), s(b.caso_nro, 40) || null)
    .input('caso_fecha', sql.Date, /^\d{4}-\d{2}-\d{2}$/.test(s(b.caso_fecha, 10)) ? s(b.caso_fecha, 10) : null)
    .input('materia', sql.NVarChar(120), s(b.materia, 120)).input('hechos', sql.NVarChar(sql.MAX), s(b.hechos, 20000))
    .input('procedimiento', sql.NVarChar(sql.MAX), s(b.procedimiento, 20000)).input('sancion', sql.NVarChar(80), s(b.sancion, 80))
    .input('motivo', sql.NVarChar(sql.MAX), s(b.motivo_precedente, 20000)).input('claves', sql.NVarChar(400), s(b.palabras_clave, 400) || null)
    .input('adjuntos', sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(b.adjuntos) ? b.adjuntos.slice(0, 20).map(a => ({ nombre: s(a.nombre, 200), url: s(a.url, 1000), tipo: s(a.tipo, 60) })) : []));
  return rq;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204 }; return; }
  const accion = context.bindingData.accion;
  const ACC = ['listar', 'obtener', 'guardar', 'editar', 'eliminar', 'materias'];
  try {
    if (ACC.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const esAdm = ROLES_ADMIN.indexOf(String(t.rol || '').toLowerCase().trim()) >= 0 || String(t.usuario).toLowerCase() === 'jtimoteo';
    const usuario = String(t.usuario).toLowerCase();
    const b = req.body || {};
    const pool = await getPool(); await asegurarTabla(pool);

    if (accion === 'materias') {
      const r = await pool.request().query('SELECT materia, COUNT(*) AS n FROM dbo.Casos_Precedentes WHERE activo = 1 GROUP BY materia ORDER BY n DESC');
      context.res = { status: 200, body: { success: true, materias: r.recordset, sanciones: SANCIONES } }; return;
    }
    if (accion === 'listar') {
      const rq = pool.request(); const w = ['activo = 1'];
      if (s(b.dni)) { w.push('dni = @dni'); rq.input('dni', sql.NVarChar(20), s(b.dni, 20)); }
      if (s(b.materia)) { w.push('materia = @materia'); rq.input('materia', sql.NVarChar(120), s(b.materia, 120)); }
      if (s(b.sancion)) { w.push('sancion = @sancion'); rq.input('sancion', sql.NVarChar(80), s(b.sancion, 80)); }
      if (s(b.empresa)) { w.push('empresa = @empresa'); rq.input('empresa', sql.NVarChar(60), s(b.empresa, 60).toUpperCase()); }
      if (/^\d{4}$/.test(s(b.anio))) { w.push('YEAR(COALESCE(caso_fecha, creado)) = @anio'); rq.input('anio', sql.Int, +s(b.anio)); }
      if (s(b.q)) { w.push('(hechos LIKE @q OR procedimiento LIKE @q OR motivo_precedente LIKE @q OR palabras_clave LIKE @q OR nombre LIKE @q OR codigo LIKE @q OR caso_nro LIKE @q)'); rq.input('q', sql.NVarChar(200), '%' + s(b.q, 150) + '%'); }
      const top = Math.min(Math.max(parseInt(b.top, 10) || 200, 1), 500);
      const r = await rq.query(`SELECT TOP (${top}) id, codigo, dni, nombre, empresa, fundo, cargo, caso_nro, caso_fecha, materia, sancion, palabras_clave,
          LEFT(hechos, 220) AS hechos, LEFT(motivo_precedente, 220) AS motivo_precedente, creado_por, creado, actualizado
        FROM dbo.Casos_Precedentes WHERE ${w.join(' AND ')} ORDER BY COALESCE(caso_fecha, creado) DESC, id DESC`);
      context.res = { status: 200, body: { success: true, data: r.recordset.map(x => Object.assign(x, { caso_fecha: x.caso_fecha ? new Date(x.caso_fecha).toISOString().slice(0, 10) : null })), total: r.recordset.length } }; return;
    }
    if (accion === 'obtener') {
      const r = await pool.request().input('id', sql.Int, parseInt(b.id, 10) || 0).query('SELECT * FROM dbo.Casos_Precedentes WHERE id = @id AND activo = 1');
      if (!r.recordset.length) { context.res = { status: 200, body: { success: false, error: 'No existe el precedente' } }; return; }
      context.res = { status: 200, body: { success: true, data: fila(r.recordset[0]) } }; return;
    }
    if (!esAdm) { context.res = { status: 403, body: { success: false, error: 'Solo administracion puede registrar o modificar precedentes' } }; return; }
    if (accion === 'guardar') {
      const faltan = validar(b);
      if (faltan.length) { context.res = { status: 200, body: { success: false, error: 'Falta: ' + faltan.join(', ') } }; return; }
      const tx = new sql.Transaction(pool); await tx.begin();
      try {
        const n = await new sql.Request(tx).query("SELECT ISNULL(MAX(CAST(SUBSTRING(codigo, 6, 10) AS INT)), 0) + 1 AS n FROM dbo.Casos_Precedentes WITH (UPDLOCK, HOLDLOCK) WHERE codigo LIKE 'PREC-%'");
        const codigo = 'PREC-' + String(n.recordset[0].n).padStart(4, '0');
        const rq = cargar(new sql.Request(tx), b).input('codigo', sql.NVarChar(20), codigo).input('u', sql.NVarChar(100), usuario);
        await rq.query(`INSERT INTO dbo.Casos_Precedentes (codigo, dni, nombre, empresa, fundo, cargo, caso_nro, caso_fecha, materia, hechos, procedimiento, sancion, motivo_precedente, palabras_clave, adjuntos, creado_por)
          VALUES (@codigo, @dni, @nombre, @empresa, @fundo, @cargo, @caso_nro, @caso_fecha, @materia, @hechos, @procedimiento, @sancion, @motivo, @claves, @adjuntos, @u)`);
        await tx.commit();
        context.log('[prec] ' + usuario + ' registro ' + codigo);
        context.res = { status: 200, body: { success: true, codigo } }; return;
      } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    }
    if (accion === 'editar') {
      const id = parseInt(b.id, 10) || 0; const faltan = validar(b);
      if (!id) { context.res = { status: 200, body: { success: false, error: 'Falta el id' } }; return; }
      if (faltan.length) { context.res = { status: 200, body: { success: false, error: 'Falta: ' + faltan.join(', ') } }; return; }
      const rq = cargar(pool.request(), b).input('id', sql.Int, id).input('u', sql.NVarChar(100), usuario);
      const r = await rq.query(`UPDATE dbo.Casos_Precedentes SET dni = @dni, nombre = @nombre, empresa = @empresa, fundo = @fundo, cargo = @cargo, caso_nro = @caso_nro, caso_fecha = @caso_fecha,
          materia = @materia, hechos = @hechos, procedimiento = @procedimiento, sancion = @sancion, motivo_precedente = @motivo, palabras_clave = @claves, adjuntos = @adjuntos,
          actualizado_por = @u, actualizado = SYSUTCDATETIME() WHERE id = @id AND activo = 1`);
      context.res = { status: 200, body: { success: r.rowsAffected[0] > 0, error: r.rowsAffected[0] ? undefined : 'No existe el precedente' } }; return;
    }
    if (accion === 'eliminar') {
      const id = parseInt(b.id, 10) || 0;
      const r = await pool.request().input('id', sql.Int, id).input('u', sql.NVarChar(100), usuario)
        .query('UPDATE dbo.Casos_Precedentes SET activo = 0, actualizado_por = @u, actualizado = SYSUTCDATETIME() WHERE id = @id AND activo = 1');
      context.log('[prec] ' + usuario + ' elimino id ' + id);
      context.res = { status: 200, body: { success: r.rowsAffected[0] > 0, error: r.rowsAffected[0] ? undefined : 'No existe el precedente' } }; return;
    }
  } catch (err) {
    context.log.error('[prec] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
