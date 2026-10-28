/* ═══════════════════════════════════════════════════════════════════════════
   usuarios-lista (_PRELOAD_AZURE_V1, 01-oct-2026)
   GET /api/usuarios/lista   (la pantalla, con el token del login)
   = getUsuarios del Apps Script, pero desde dbo.usuarios (la tabla del login):
     mismas columnas, SIN contraseña, activo como true/false, empresa en mayusculas,
     rol en minusculas y 'fundos' de cada supervisor.
   Solo roles de administracion (token). Otro rol -> 403 y la pantalla usa Google.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool } = require('../shared/db');

const ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];
/* = FUNDOS_SUPERVISOR del Apps Script (Código.js) — si cambia alla, cambiar aqui */
const FUNDOS_SUPERVISOR = {
  ptamayo: ['El Papayo', 'Limones'], atineo: ['Olivares Bajo'], fpulache: ['Los Olivares'], yluzon: ['Santa Rosa'],
  sviera: ['Algarrobos'], ecastro: ['San Vicente'], almartinez: ['Punta Arenas'], fzapata: ['Aproa'],
  rmolero: ['Planta Rapel'], mmechato: []
};

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
const txt = v => typeof v === 'string' ? v.trim() : v;

module.exports = async function (context, req) {
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    if (ADMIN.indexOf(String(t.rol || '').trim().toLowerCase()) < 0) { context.res = { status: 403, body: { success: false, error: 'Solo administracion' } }; return; }
    {   /* sin memoria: tras crear o editar un usuario la lista se ve al instante (son pocas filas) */
      const pool = await getPool();
      /* _SEG_USUARIOS_V1 (26-oct-2026): ademas del listado, el estado de seguridad de cada cuenta
         (ultimo cambio de clave, clave temporal pendiente, intentos fallidos y bloqueo). Nunca la clave.
         Si las columnas/tabla aun no existen, cae a la consulta de siempre. */
      let r;
      /* _USR_BAJA_V1: columnas de baja (se crean una vez) */
      try { await pool.request().query("IF COL_LENGTH('dbo.usuarios','eliminado') IS NULL ALTER TABLE dbo.usuarios ADD eliminado BIT NULL, eliminado_en DATETIME2(0) NULL, eliminado_por NVARCHAR(100) NULL, motivo_baja NVARCHAR(300) NULL"); } catch (e0) {}
      const incluirElim = String((req.query && req.query.incluirEliminados) || '') === '1';
      try {
        r = await pool.request().query(`SELECT u.id_sistema, u.usuario, u.nombre, u.rol, u.empresa, u.activo, u.fecha_creacion, u.correo, u.cargo, u.sector,
                                               u.clave_cambiada, u.clave_temporal, u.clave_fuerte, u.eliminado, u.eliminado_en, u.eliminado_por, u.motivo_baja, li.fallos, li.bloqueado_hasta, li.ultimo AS ultimo_intento, li.bloqueos
                                        FROM dbo.usuarios u LEFT JOIN dbo.Login_Intentos li ON li.usuario = LOWER(LTRIM(RTRIM(u.usuario)))
                                        ORDER BY u.id_sistema`);
      } catch (e1) {
        context.log.warn('[usuarios-lista] sin columnas de seguridad: ' + e1.message);
        r = await pool.request().query(`SELECT id_sistema, usuario, nombre, rol, empresa, activo, fecha_creacion, correo, cargo, sector
                                            FROM dbo.usuarios ORDER BY id_sistema`);
      }
      const data = r.recordset.filter(u => u.id_sistema && (incluirElim || !(u.eliminado === true || u.eliminado === 1))).map(u => {   /* _USR_BAJA_V1 */
        const o = {};
        Object.keys(u).forEach(k => { o[k] = txt(u[k]); });
        o.activo = u.activo === true || u.activo === 1 || String(u.activo).trim().toUpperCase() === 'TRUE';
        o.empresa = String(u.empresa || '').trim().toUpperCase();
        o.rol = String(u.rol || '').trim().toLowerCase();
        o.fecha_creacion = u.fecha_creacion instanceof Date ? u.fecha_creacion.toISOString() : (u.fecha_creacion || '');
        o.fundos = FUNDOS_SUPERVISOR[o.usuario] || [];
        /* _SEG_USUARIOS_V1 */
        const fechaIso = v => v instanceof Date ? v.toISOString() : (v ? String(v) : '');
        o.eliminado = u.eliminado === true || u.eliminado === 1;   /* _USR_BAJA_V1 */
        if (o.eliminado) o.baja = { en: u.eliminado_en instanceof Date ? u.eliminado_en.toISOString() : '', por: u.eliminado_por || '', motivo: u.motivo_baja || '' };
        o.seguridad = {
          clave_cambiada: fechaIso(u.clave_cambiada), clave_temporal: u.clave_temporal === true || u.clave_temporal === 1,
          clave_fuerte: u.clave_fuerte === true || u.clave_fuerte === 1 ? true : (u.clave_fuerte === null || u.clave_fuerte === undefined ? null : false),
          fallos: Number(u.fallos || 0), bloqueos: Number(u.bloqueos || 0), ultimo_intento: fechaIso(u.ultimo_intento),
          bloqueado_hasta: (u.bloqueado_hasta instanceof Date && u.bloqueado_hasta.getTime() > Date.now()) ? u.bloqueado_hasta.toISOString() : ''
        };
        return o;
      });
      context.res = { status: 200, body: { success: true, data, fuente: 'azure' } };
    }
  } catch (err) {
    context.log.error('[usuarios-lista] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
