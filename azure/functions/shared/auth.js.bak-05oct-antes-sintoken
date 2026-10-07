// ============================================================
// shared/auth.js — Firma y validación de JWT de sesión
// Sistema RL v3.0 | Verfrut / RAPEL SAC
//
// Variables de entorno (Function App → Configuration):
//   JWT_SECRET   : secreto largo y aleatorio (obligatorio para firmar)
//   JWT_REQUIRED : "1" para rechazar requests sin token válido.
//                  Ausente o "0" = modo suave (solo registra warning).
//                  Esto permite desplegar backend primero y frontend después.
// ============================================================
const jwt = require('jsonwebtoken');

const JWT_EXP_HORAS = 8;

function firmarToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, secret, { expiresIn: JWT_EXP_HORAS + 'h' });
}

/**
 * Valida el header Authorization: Bearer <token>.
 * Retorna { ok, user, error }.
 * - ok=true  → request permitido (token válido, o modo suave sin token)
 * - ok=false → responder 401 (solo ocurre con JWT_REQUIRED=1)
 */
function verificarRequest(context, req) {
  const requerido = process.env.JWT_REQUIRED === '1';
  const secret = process.env.JWT_SECRET;

  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  if (!token) {
    if (requerido) return { ok: false, user: null, error: 'Token requerido' };
    context.log.warn('[auth] Request sin token (modo suave, permitido)');
    return { ok: true, user: null, error: null };
  }

  if (!secret) {
    context.log.warn('[auth] JWT_SECRET no configurado; no se puede validar token');
    return { ok: !requerido, user: null, error: requerido ? 'Servidor sin JWT_SECRET' : null };
  }

  try {
    const user = jwt.verify(token, secret);
    return { ok: true, user, error: null };
  } catch (e) {
    if (requerido) return { ok: false, user: null, error: 'Token inválido o expirado' };
    context.log.warn('[auth] Token inválido (modo suave, permitido):', e.message);
    return { ok: true, user: null, error: null };
  }
}

/** Helper: corta el request con 401 si el token no pasa. Retorna user o null. */
function exigirAuth(context, req) {
  const r = verificarRequest(context, req);
  if (!r.ok) {
    context.res = { status: 401, body: { success: false, error: r.error } };
    return null;
  }
  return r.user || {};
}

module.exports = { firmarToken, verificarRequest, exigirAuth };
