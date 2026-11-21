/* ═══════════════════════════════════════════════════════════════════════════
   shared/sede.js — _SEDE_SERVIDOR_V1 (20-nov-2026, decision de Joel)
   Cada usuario ve solo los registros de su sede; la regla se aplica en el SERVIDOR.
   · Usuario de Olmos  = su empresa en Gestion de Usuarios es OLMOS -> ve solo registros de Olmos (aunque sea administrador).
   · Usuario de Piura  = cualquier otra empresa                     -> ve solo registros de Piura.
   · VER_AMBAS (jtimoteo)                                           -> ve las dos sedes.
   · Sin token (llamadas internas del Apps Script con clave)        -> sin cambio (ve todo, como antes).
   Un registro es de Olmos si: el trabajador es de empresa OLMOS o de un fundo de Olmos, o lo registro un usuario de
   Olmos (usuario_sistema) o su "supervisor" es el nombre de un usuario de Olmos. Misma regla del chip "Olmos" (68-sede-v1.js).
   Apagar: secreto SEDE_FILTRO=off en Supabase (todo vuelve a como era).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const FUNDOS_OLMOS = ['BOMAREA', 'PIRONA', 'MOSQUETA', 'HEFEI', 'LEFKADA'];
const VER_AMBAS = ['jtimoteo'];
const TTL = 60000;
let _cache = { t: 0, usuarios: [], nombres: [] };

const N = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const activo = () => String(process.env.SEDE_FILTRO || '').toLowerCase() !== 'off';

async function olmos(pool) {
  if (Date.now() - _cache.t < TTL) return _cache;
  const r = await pool.request().query("SELECT usuario, nombre FROM dbo.usuarios WHERE UPPER(LTRIM(RTRIM(ISNULL(empresa, '')))) = 'OLMOS'");
  const filas = r.recordset || [];
  _cache = { t: Date.now(), usuarios: filas.map(x => String(x.usuario || '').trim().toLowerCase()).filter(Boolean), nombres: filas.map(x => N(x.nombre)).filter(Boolean) };
  return _cache;
}

/* 'TODO' | 'OLMOS' | 'PIURA'. Si la lista de Olmos no se puede leer: OLMOS no se reconoce -> 'PIURA' para todos menos VER_AMBAS
   (nunca se abre de mas a un usuario de Olmos: ver modoSeguro). */
async function modo(pool, authUser) {
  if (!activo()) return 'TODO';
  if (!authUser || !authUser.usuario) return 'TODO';
  const u = String(authUser.usuario).trim().toLowerCase();
  if (VER_AMBAS.indexOf(u) >= 0) return 'TODO';
  const o = await olmos(pool);
  return o.usuarios.indexOf(u) >= 0 ? 'OLMOS' : 'PIURA';
}

/* Condicion SQL "el registro es de Olmos" para tablas con empresa/fundo/usuario_sistema/supervisor.
   cols: { empresa, fundo, usuario, supervisor } (nombres de columna; omitir los que la tabla no tiene). Agrega parametros a request. */
function condOlmos(request, o, cols, pref) {
  const c = Object.assign({ empresa: 'empresa', fundo: 'fundo', usuario: 'usuario_sistema', supervisor: 'supervisor' }, cols || {});
  const p = pref || 'sd';
  const partes = [];
  if (c.empresa) partes.push(`UPPER(ISNULL(${c.empresa}, '')) LIKE '%OLMOS%'`);
  if (c.fundo) partes.push(`UPPER(LTRIM(RTRIM(ISNULL(${c.fundo}, '')))) IN (${FUNDOS_OLMOS.map(f => "'" + f + "'").join(', ')})`);
  if (c.usuario && o.usuarios.length) {
    const ks = o.usuarios.map((x, i) => { request.input(p + 'u' + i, x); return '@' + p + 'u' + i; });
    partes.push(`LOWER(LTRIM(RTRIM(ISNULL(${c.usuario}, '')))) IN (${ks.join(', ')})`);
  }
  if (c.supervisor && o.nombres.length) {
    const ks = o.nombres.map((x, i) => { request.input(p + 'n' + i, x); return '@' + p + 'n' + i; });
    partes.push(`UPPER(LTRIM(RTRIM(ISNULL(${c.supervisor}, '')))) IN (${ks.join(', ')})`);
  }
  return '(' + partes.join(' OR ') + ')';
}

/* Devuelve '' (sin filtro) o la condicion a agregar al WHERE segun el modo del usuario. */
async function filtroSQL(pool, request, authUser, cols, pref) {
  const m = await modo(pool, authUser);
  if (m === 'TODO') return { modo: m, sql: '' };
  const o = await olmos(pool);
  const cond = condOlmos(request, o, cols, pref);
  return { modo: m, sql: m === 'OLMOS' ? cond : 'NOT ' + cond };
}

/* Version JS para filas ya leidas (o para agregados por supervisor/empresa). */
function esOlmos(fila, o, cols) {
  const c = Object.assign({ empresa: 'empresa', fundo: 'fundo', usuario: 'usuario_sistema', supervisor: 'supervisor' }, cols || {});
  if (!fila) return false;
  if (c.empresa && N(fila[c.empresa]).indexOf('OLMOS') >= 0) return true;
  if (c.fundo && FUNDOS_OLMOS.indexOf(N(fila[c.fundo])) >= 0) return true;
  if (c.usuario && o.usuarios.indexOf(String(fila[c.usuario] || '').trim().toLowerCase()) >= 0) return true;
  if (c.supervisor && o.nombres.indexOf(N(fila[c.supervisor])) >= 0) return true;
  return false;
}
async function filtrarFilas(pool, authUser, filas, cols) {
  const m = await modo(pool, authUser);
  if (m === 'TODO') return filas;
  const o = await olmos(pool);
  return (filas || []).filter(f => (m === 'OLMOS') === esOlmos(f, o, cols));
}

module.exports = { modo, olmos, condOlmos, filtroSQL, esOlmos, filtrarFilas, FUNDOS_OLMOS, VER_AMBAS, _N: N, _reset: () => { _cache = { t: 0, usuarios: [], nombres: [] }; } };
