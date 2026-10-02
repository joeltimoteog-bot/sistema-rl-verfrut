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
      const r = await pool.request().query(`SELECT id_sistema, usuario, nombre, rol, empresa, activo, fecha_creacion, correo, cargo, sector
                                            FROM dbo.usuarios ORDER BY id_sistema`);
      const data = r.recordset.filter(u => u.id_sistema).map(u => {
        const o = {};
        Object.keys(u).forEach(k => { o[k] = txt(u[k]); });
        o.activo = u.activo === true || u.activo === 1 || String(u.activo).trim().toUpperCase() === 'TRUE';
        o.empresa = String(u.empresa || '').trim().toUpperCase();
        o.rol = String(u.rol || '').trim().toLowerCase();
        o.fecha_creacion = u.fecha_creacion instanceof Date ? u.fecha_creacion.toISOString() : (u.fecha_creacion || '');
        o.fundos = FUNDOS_SUPERVISOR[o.usuario] || [];
        return o;
      });
      context.res = { status: 200, body: { success: true, data, fuente: 'azure' } };
    }
  } catch (err) {
    context.log.error('[usuarios-lista] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
