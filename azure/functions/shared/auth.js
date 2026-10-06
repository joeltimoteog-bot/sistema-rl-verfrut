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

const JWT_EXP_HORAS = 14;   /* _AZ_TOKEN_V1 (05-oct): 8 h no cubria una jornada de 7 a.m. a 6 p.m. */

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
    anotarSinToken(req, 'sin-token');
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
    anotarSinToken(req, 'token-invalido');
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

/* _AZ_TOKEN_V1 (05-oct-2026): ANTES de exigir sesion hay que saber quien llama sin ella.
   Cuenta (en memoria, se guarda cada 60 s) las consultas sin sesion o con sesion vencida,
   por ruta, pagina de origen y dia, en dbo.Auth_SinToken. Solo cuenta: no bloquea nada.
   Ver:  SELECT * FROM dbo.Auth_SinToken ORDER BY dia DESC, n DESC */
const _sinTok = {}; let _sinTokReloj = null;
function anotarSinToken(req, motivo) {
  try {
    const url = String((req && (req.originalUrl || req.url)) || '');
    const ruta = (url.split('?')[0].match(/\/api\/(.*)$/) || [, url])[1].slice(0, 120);
    const h = (req && req.headers) || {};
    const origen = String(h.referer || h.origin || h['user-agent'] || '').replace(/\?.*$/, '').slice(0, 200);
    const dia = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const k = dia + '|' + ruta + '|' + origen + '|' + motivo;
    _sinTok[k] = (_sinTok[k] || 0) + 1;
    if (!_sinTokReloj) _sinTokReloj = setTimeout(guardarSinToken, 60000);
  } catch (e) {}
}
async function guardarSinToken() {
  _sinTokReloj = null;
  const lote = Object.assign({}, _sinTok); Object.keys(_sinTok).forEach(k => delete _sinTok[k]);
  const claves = Object.keys(lote); if (!claves.length) return;
  try {
    const { sql, getPool } = require('./db');
    const pool = await getPool();
    await pool.request().query("IF OBJECT_ID('dbo.Auth_SinToken','U') IS NULL CREATE TABLE dbo.Auth_SinToken (dia DATE NOT NULL, ruta NVARCHAR(120) NOT NULL, origen NVARCHAR(200) NOT NULL, motivo NVARCHAR(20) NOT NULL, n INT NOT NULL, ultimo DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), CONSTRAINT PK_Auth_SinToken PRIMARY KEY (dia, ruta, origen, motivo))");
    for (const k of claves) {
      const [dia, ruta, origen, motivo] = k.split('|');
      await pool.request().input('d', sql.Date, dia).input('r', sql.NVarChar(120), ruta).input('o', sql.NVarChar(200), origen)
        .input('m', sql.NVarChar(20), motivo).input('n', sql.Int, lote[k])
        .query('MERGE dbo.Auth_SinToken AS t USING (SELECT @d d, @r r, @o o, @m m) s ON t.dia = s.d AND t.ruta = s.r AND t.origen = s.o AND t.motivo = s.m ' +
               'WHEN MATCHED THEN UPDATE SET n = t.n + @n, ultimo = SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (dia, ruta, origen, motivo, n) VALUES (@d, @r, @o, @m, @n);');
    }
  } catch (e) { /* solo es un contador: si falla, no afecta la consulta */ }
}

module.exports = { firmarToken, verificarRequest, exigirAuth, anotarSinToken };
