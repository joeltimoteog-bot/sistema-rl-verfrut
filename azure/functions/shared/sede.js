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
/* _ALCANCE_V1 (21-nov-2026, decision de Joel): Bomarea, Pirona, Mosqueta, Hefei y Lefkada son EMPRESAS de la sede Olmos
   (como Rapel y Verfrut lo son de Piura). Un registro es de Olmos si su empresa contiene OLMOS o alguno de esos nombres.
   Alcance de cada usuario (columna usuarios.alcance): PROPIO = solo lo suyo · SEDE = todo lo de su sede · GENERAL = las dos sedes.
   El alcance nunca cruza de sede salvo GENERAL; jtimoteo es siempre GENERAL. Sin dato o valor raro = PROPIO (lo mas cerrado). */
const EMPRESAS_OLMOS = ['OLMOS'].concat(FUNDOS_OLMOS);
const ALCANCES = ['PROPIO', 'SEDE', 'GENERAL'];
const VER_AMBAS = ['jtimoteo'];
const TTL = 60000;
let _cache = { t: 0, usuarios: [], nombres: [], todos: [] };

const N = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const activo = () => String(process.env.SEDE_FILTRO || '').toLowerCase() !== 'off';

async function olmos(pool) {
  if (Date.now() - _cache.t < TTL) return _cache;
  let rs;
  try { rs = (await pool.request().query('SELECT usuario, nombre, empresa, alcance FROM dbo.usuarios')).recordset || []; }
  catch (e) { rs = ((await pool.request().query('SELECT usuario, nombre, empresa FROM dbo.usuarios')).recordset || []); }   /* sin la columna alcance: todos PROPIO */
  const todos = rs.map(x => ({ usuario: String(x.usuario || '').trim().toLowerCase(), nombre: N(x.nombre), olmos: EMPRESAS_OLMOS.indexOf(N(x.empresa)) >= 0,
    alcance: ALCANCES.indexOf(N(x.alcance)) >= 0 ? N(x.alcance) : 'PROPIO' })).filter(x => x.usuario);
  const filas = todos.filter(x => x.olmos);
  _cache = { t: Date.now(), usuarios: filas.map(x => x.usuario), nombres: filas.map(x => x.nombre).filter(Boolean), todos };
  return _cache;
}

/* 'TODO' | 'OLMOS' | 'PIURA'. Si la lista de Olmos no se puede leer: OLMOS no se reconoce -> 'PIURA' para todos menos VER_AMBAS
   (nunca se abre de mas a un usuario de Olmos: ver modoSeguro). */
async function modoReal(pool, authUser) {
  if (!activo()) return 'TODO';
  if (!authUser || !authUser.usuario) return 'TODO';
  const u = String(authUser.usuario).trim().toLowerCase();
  if (VER_AMBAS.indexOf(u) >= 0) return 'TODO';
  const o = await olmos(pool);
  const yo = o.todos.filter(x => x.usuario === u)[0];
  if (yo && yo.alcance === 'GENERAL') return 'TODO';   /* _ALCANCE_V1 */
  return o.usuarios.indexOf(u) >= 0 ? 'OLMOS' : 'PIURA';
}
/* _SEDE_VISTA_V1 (23-nov-2026, aprobado por Joel): selector de sede para quien ve las dos (jtimoteo y alcance GENERAL).
   La pantalla manda la cabecera x-rl-sede = PIURA | OLMOS; el adaptador del servidor envuelve la llamada con conVista() y,
   SOLO si el modo real del usuario es TODO, modo() responde esa sede: todo lo que ya filtra por sede se angosta solo.
   A un usuario de Piura o de Olmos la cabecera no le cambia nada (su modo real manda). modoReal() = la sede verdadera
   (la usan auth/sso y bs/permisos para decirle a la pantalla si corresponde mostrar el selector). */
let _als = null;
try { _als = new (require('node:async_hooks').AsyncLocalStorage)(); } catch (e) { _als = null; }
function conVista(vista, fn) {
  const v = String(vista || '').trim().toUpperCase();
  if (!_als || (v !== 'PIURA' && v !== 'OLMOS')) return fn();
  return _als.run({ vista: v }, fn);
}
function vistaPedida() {
  try { const s = _als && _als.getStore(); return s && (s.vista === 'PIURA' || s.vista === 'OLMOS') ? s.vista : ''; } catch (e) { return ''; }
}
async function modo(pool, authUser) {
  const m = await modoReal(pool, authUser);
  if (m !== 'TODO' || !activo() || !authUser || !authUser.usuario) return m;
  return vistaPedida() || 'TODO';
}
/* _ALCANCE_V1: { alcance, sede, companeros:[[usuario, nombre], ...] } — companeros = los usuarios de su misma sede (solo con alcance SEDE). */
async function alcanceDe(pool, usuario) {
  const u = String(usuario || '').trim().toLowerCase();
  if (!u) return { alcance: 'PROPIO', sede: 'PIURA', companeros: [] };
  if (VER_AMBAS.indexOf(u) >= 0) return { alcance: 'GENERAL', sede: 'TODO', companeros: [] };
  if (!activo()) return { alcance: 'PROPIO', sede: 'PIURA', companeros: [] };
  const o = await olmos(pool);
  const yo = o.todos.filter(x => x.usuario === u)[0];
  if (!yo) return { alcance: 'PROPIO', sede: 'PIURA', companeros: [] };
  const sede = yo.olmos ? 'OLMOS' : 'PIURA';
  if (yo.alcance === 'GENERAL') return { alcance: 'GENERAL', sede: 'TODO', companeros: [] };
  if (yo.alcance !== 'SEDE') return { alcance: 'PROPIO', sede, companeros: [] };
  return { alcance: 'SEDE', sede, companeros: o.todos.filter(x => x.olmos === yo.olmos && x.usuario !== u).map(x => [x.usuario, x.nombre.toLowerCase()]) };
}

/* Condicion SQL "el registro es de Olmos" para tablas con empresa/fundo/usuario_sistema/supervisor.
   cols: { empresa, fundo, usuario, supervisor } (nombres de columna; omitir los que la tabla no tiene). Agrega parametros a request. */
function condOlmos(request, o, cols, pref) {
  const c = Object.assign({ empresa: 'empresa', fundo: 'fundo', usuario: 'usuario_sistema', supervisor: 'supervisor' }, cols || {});
  const p = pref || 'sd';
  const partes = [];
  if (c.empresa) EMPRESAS_OLMOS.forEach(e => partes.push(`UPPER(ISNULL(${c.empresa}, '')) LIKE '%${e}%'`));   /* _ALCANCE_V1: las 5 empresas de Olmos */
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
  if (c.empresa) { const em = N(fila[c.empresa]); if (EMPRESAS_OLMOS.some(e => em.indexOf(e) >= 0)) return true; }
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

/* _SEDE_ESCRITURA_V1 (21-nov-2026): nadie modifica ni elimina una atencion de la otra sede (aunque conozca su numero).
   true = puede · false = es de otra sede. Si la atencion no existe devuelve true (la ruta responde su 404 de siempre). */
async function permiteAtencion(pool, authUser, id) {
  const m = await modo(pool, authUser);
  if (m === 'TODO') return true;
  const r = await pool.request().input('sdid', Number(id) || 0).query('SELECT empresa, fundo, usuario_sistema, supervisor FROM dbo.Atenciones WHERE id = @sdid');
  const f = (r.recordset || [])[0]; if (!f) return true;
  return esOlmos(f, await olmos(pool), null) === (m === 'OLMOS');
}
const MSG_OTRA_SEDE = 'Este registro pertenece a otra sede. No se puede modificar desde tu usuario.';
module.exports = { permiteAtencion, MSG_OTRA_SEDE, modo, modoReal, conVista, vistaPedida, olmos, condOlmos, filtroSQL, esOlmos, filtrarFilas, alcanceDe, FUNDOS_OLMOS, EMPRESAS_OLMOS, ALCANCES, VER_AMBAS, _N: N, _reset: () => { _cache = { t: 0, usuarios: [], nombres: [], todos: [] }; } };
