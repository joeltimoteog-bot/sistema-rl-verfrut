/* ════════════════════════════════════════════════════════════════════════
   auth-renovar — _SESION_RENOVAR_V1 (02-nov-2026)
   Renueva la sesión (JWT) mientras el usuario sigue trabajando, sin pedirle la clave.
   POST auth/renovar   Authorization: Bearer <token>
   · Acepta un token vigente o vencido hace menos de GRACIA_H horas (el dashboard suele quedar
     abierto de un día para otro). Más viejo → 401: hay que volver a ingresar.
   · Vuelve a leer dbo.usuarios: si el usuario fue desactivado, no renueva (revocación real).
   · Devuelve un token nuevo con los mismos datos (sub, usuario, rol, empresa) y 14 h más.
   Lo usa frontend/js/azure-token.js (bloque _SESION_RENOVAR_V1) en las 22 páginas.
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../shared/db');
const { firmarToken } = require('../shared/auth');

const GRACIA_H = 36;

module.exports = async function (context, req) {
  const res = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res(401, { success: false, error: 'Sin token' });
  const secret = process.env.JWT_SECRET;
  if (!secret) return res(500, { success: false, error: 'Servidor sin JWT_SECRET' });
  let p;
  try { p = jwt.verify(token, secret, { ignoreExpiration: true }); } catch (e) { return res(401, { success: false, error: 'Token inválido', motivo: 'invalido' }); }
  const exp = (p.exp || 0) * 1000, ahora = Date.now();
  if (exp && ahora - exp > GRACIA_H * 3600e3) return res(401, { success: false, error: 'Sesión vencida: vuelve a ingresar', motivo: 'vencido' });
  if (!p.usuario) return res(401, { success: false, error: 'Token sin usuario', motivo: 'invalido' });
  try {
    const pool = await getPool();
    const r = await pool.request().input('u', sql.NVarChar, String(p.usuario)).query('SELECT TOP 1 id_sistema, usuario, rol, empresa FROM dbo.usuarios WHERE usuario = @u AND activo = 1');
    const u = r.recordset[0];
    if (!u) return res(401, { success: false, error: 'Usuario inactivo', motivo: 'inactivo' });
    const nuevo = firmarToken({ sub: u.id_sistema, usuario: u.usuario, rol: String(u.rol || '').trim().toLowerCase(), empresa: String(u.empresa || '').trim().toUpperCase(), cd: p.cd || 0, co: 0, ct: 0, rn: 1 });
    context.log('auth/renovar: ' + u.usuario + (exp < ahora ? ' (estaba vencido ' + Math.round((ahora - exp) / 36e5) + ' h)' : ''));
    return res(200, { success: true, token: nuevo, usuario: u.usuario, rol: String(u.rol || '').trim().toLowerCase(), renovado_en: new Date(ahora).toISOString() });
  } catch (e) {
    context.log.error('auth/renovar: ' + e.message);
    return res(500, { success: false, error: e.message });
  }
};
