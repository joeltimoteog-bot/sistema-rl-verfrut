/* ═══════════════════════════════════════════════════════════════════════════
   compromiso (_COMPROMISO_V1, 18-oct-2026) — compromiso de confidencialidad y uso del sistema
   POST /api/compromiso/estado   {}                      -> { success, version, aceptado, fecha }  (del usuario del token)
   POST /api/compromiso/aceptar  { version, navegador }  -> { success, fecha }                     (guarda la constancia)
   POST /api/compromiso/lista    {}                      -> { success, version, filas:[...] }     (solo administracion)
   Tabla NUEVA dbo.Usuarios_Aceptaciones (se crea sola). No toca ninguna tabla existente ni Google.
   Quien acepta sale SIEMPRE del token firmado del login, nunca del cuerpo.
   La version vigente del texto vive en la variable COMPROMISO_VERSION (por defecto '1.0'): al cambiarla,
   el sistema vuelve a pedir aceptacion a todos (solo del texto nuevo).
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const jwt = require('jsonwebtoken');

const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02', 'coordinador', 'jefa_rl'];
function version() { return String(process.env.COMPROMISO_VERSION || '1.0').trim().slice(0, 20); }
function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
async function asegurar(pool) {
  await pool.request().query(`IF OBJECT_ID('dbo.Usuarios_Aceptaciones', 'U') IS NULL CREATE TABLE dbo.Usuarios_Aceptaciones (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    usuario NVARCHAR(100) NOT NULL, nombre NVARCHAR(200) NULL, rol NVARCHAR(60) NULL, empresa NVARCHAR(40) NULL,
    version NVARCHAR(20) NOT NULL, fecha DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    navegador NVARCHAR(300) NULL, ip NVARCHAR(60) NULL,
    CONSTRAINT UQ_Usuarios_Aceptaciones UNIQUE (usuario, version));`);
}
const s = (v, n) => { v = String(v == null ? '' : v).trim(); return v ? v.slice(0, n) : null; };
function ipDe(req) { try { const h = req.headers || {}; return s(String(h['x-forwarded-for'] || h['x-client-ip'] || '').split(',')[0].replace(/:\d+$/, ''), 60); } catch (e) { return null; } }

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  if (req.method === 'OPTIONS') { context.res = { status: 204 }; return; }
  const t = token(req);
  if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
  const usuario = String(t.usuario).trim().toLowerCase();
  try {
    const pool = await getPool(); await asegurar(pool);
    const ver = version();
    if (accion === 'estado') {
      const r = await pool.request().input('u', sql.NVarChar(100), usuario).input('v', sql.NVarChar(20), ver)
        .query('SELECT TOP 1 fecha FROM dbo.Usuarios_Aceptaciones WHERE usuario = @u AND version = @v');
      const f = r.recordset[0];
      context.res = { status: 200, body: { success: true, version: ver, aceptado: !!f, fecha: f ? new Date(f.fecha).toISOString() : null } };
      return;
    }
    if (accion === 'aceptar') {
      const b = req.body || {};
      const v = s(b.version, 20) || ver;
      if (v !== ver) { context.res = { status: 200, body: { success: false, error: 'La version del texto cambio; recarga la pagina.', version: ver } }; return; }
      await pool.request().input('u', sql.NVarChar(100), usuario).input('n', sql.NVarChar(200), s(b.nombre || t.nombre, 200))
        .input('r', sql.NVarChar(60), s(t.rol, 60)).input('e', sql.NVarChar(40), s(t.empresa, 40)).input('v', sql.NVarChar(20), v)
        .input('nav', sql.NVarChar(300), s(b.navegador || (req.headers && req.headers['user-agent']), 300)).input('ip', sql.NVarChar(60), ipDe(req))
        .query(`IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios_Aceptaciones WHERE usuario = @u AND version = @v)
                INSERT INTO dbo.Usuarios_Aceptaciones (usuario, nombre, rol, empresa, version, navegador, ip) VALUES (@u, @n, @r, @e, @v, @nav, @ip);`);
      const r = await pool.request().input('u', sql.NVarChar(100), usuario).input('v', sql.NVarChar(20), v)
        .query('SELECT TOP 1 fecha FROM dbo.Usuarios_Aceptaciones WHERE usuario = @u AND version = @v');
      context.res = { status: 200, body: { success: true, version: v, fecha: new Date(r.recordset[0].fecha).toISOString() } };
      return;
    }
    const esAdm = ROLES_ADMIN.indexOf(String(t.rol || '').toLowerCase().trim()) >= 0;
    if (accion === 'lista') {
      if (!esAdm) { context.res = { status: 403, body: { success: false, error: 'Solo administracion' } }; return; }
      /* _SEG_USUARIOS_V1: + estado de la clave (fuerte / cambiada) y bloqueo por intentos */
      try { await pool.request().query("IF COL_LENGTH('dbo.usuarios','clave_fuerte') IS NULL ALTER TABLE dbo.usuarios ADD clave_fuerte BIT NULL, clave_cambiada DATETIME2(0) NULL"); } catch (e) {}
      try { await pool.request().query("IF COL_LENGTH('dbo.usuarios','clave_temporal') IS NULL ALTER TABLE dbo.usuarios ADD clave_temporal BIT NULL"); } catch (e) {}
      try { await pool.request().query(`IF OBJECT_ID('dbo.Login_Intentos','U') IS NULL CREATE TABLE dbo.Login_Intentos (usuario NVARCHAR(100) NOT NULL PRIMARY KEY, fallos INT NOT NULL DEFAULT 0, ultimo DATETIME2(0) NULL, bloqueado_hasta DATETIME2(0) NULL, ip NVARCHAR(60) NULL, bloqueos INT NOT NULL DEFAULT 0)`); } catch (e) {}
      const r = await pool.request().input('v', sql.NVarChar(20), ver)
        .query(`SELECT u.usuario, u.nombre, u.rol, u.empresa, u.activo, a.fecha, a.version, a.navegador, u.clave_fuerte, u.clave_cambiada, u.clave_temporal,
                       li.fallos, li.bloqueado_hasta, li.bloqueos, li.ultimo AS ultimo_fallo
                FROM dbo.usuarios u LEFT JOIN dbo.Usuarios_Aceptaciones a ON a.usuario = u.usuario AND a.version = @v
                LEFT JOIN dbo.Login_Intentos li ON li.usuario = LOWER(u.usuario)
                ORDER BY a.fecha DESC, u.usuario`);
      const ahora = Date.now();
      context.res = { status: 200, body: { success: true, version: ver, filas: r.recordset.map(x => ({
        usuario: x.usuario, nombre: x.nombre || '', rol: x.rol || '', empresa: x.empresa || '', activo: x.activo,
        aceptado: !!x.fecha, fecha: x.fecha ? new Date(x.fecha).toISOString() : null, navegador: x.navegador || '',
        claveFuerte: x.clave_fuerte === null || x.clave_fuerte === undefined ? null : !!x.clave_fuerte,
        claveCambiada: x.clave_cambiada ? new Date(x.clave_cambiada).toISOString() : null, claveTemporal: !!x.clave_temporal,
        fallos: x.fallos || 0, bloqueos: x.bloqueos || 0,
        bloqueadoHasta: x.bloqueado_hasta && new Date(x.bloqueado_hasta).getTime() > ahora ? new Date(x.bloqueado_hasta).toISOString() : null })) } };
      return;
    }
    if (accion === 'desbloquear') {
      if (!esAdm) { context.res = { status: 403, body: { success: false, error: 'Solo administracion' } }; return; }
      const u = s((req.body || {}).usuario, 100); if (!u) { context.res = { status: 200, body: { success: false, error: 'Falta el usuario' } }; return; }
      try { await pool.request().input('u', sql.NVarChar(100), u.toLowerCase()).query('DELETE FROM dbo.Login_Intentos WHERE usuario = @u'); } catch (e) {}
      context.log('[compromiso] ' + usuario + ' desbloqueo a ' + u);
      context.res = { status: 200, body: { success: true, usuario: u } };
      return;
    }
    context.res = { status: 404, body: { success: false, error: 'Accion desconocida: ' + accion } };
  } catch (err) {
    context.log.error('[compromiso] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
