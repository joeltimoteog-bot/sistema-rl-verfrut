// ============================================================
// auth-sso — Pase SSO firmado en el SERVIDOR  (_SSO_SERVIDOR_V1, 24-set-2026)
// Sistema RL v3.0 | Verfrut / RAPEL SAC
//
// ANTES: el pase RR.LL → ETI se firmaba en el navegador con un secreto escrito
//        en el HTML publico (cualquiera podia fabricar un pase, incluso de admin).
// AHORA: lo firma este servidor con JWT_SECRET (Application settings), que
//        nunca sale de Azure.
//
// POST /api/auth/sso   body JSON { accion, ... }
//   accion:'emitir'    Header Authorization: Bearer <JWT del login RR.LL>
//                      → { success, pase }   (pase valido 90 s)
//   accion:'verificar' { pase }  → { success, user, token }  (token de sesion ETI, 8 h)
//   accion:'sesion'    { token } → { success, user }         (revalidar al recargar)
//
// Si falta JWT_SECRET responde 503 y los frontends usan su camino de siempre.
// No toca la base de datos ni ninguna otra Function.
// ============================================================
const jwt = require('jsonwebtoken');

/* _ETI_PERMISO_V1 (14-oct-2026): ¿el administrador le dio "Capacitaciones ETI (programar)"
   en Acceso a Modulos? (dbo.PermisosModulos, modulo 'navAppEti'). Si la base no responde
   en 4 s o falla, se responde false: el pase sale igual, sin el permiso. */
async function etiProg(usuario) {
  try {
    const { getPool, sql } = require('../shared/db');
    const p = await Promise.race([getPool(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))]);
    const q = p.request().input('u', sql.NVarChar(60), usuario)
      .query("IF OBJECT_ID('dbo.PermisosModulos','U') IS NULL SELECT 0 AS ok ELSE SELECT COUNT(*) AS ok FROM dbo.PermisosModulos WHERE usuario = @u AND modulo IN ('navAppEti','navProgEti') AND permitido = 1");
    const r = await Promise.race([q, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 4000))]);
    return !!(r && r.recordset && r.recordset[0] && r.recordset[0].ok > 0);
  } catch (e) { return false; }
}

/* _ACCESOS_CENTRAL_V1 (29-oct-2026) — RR.LL. como panel unico de usuarios.
   Lee de dbo.PermisosModulos las claves de los otros sistemas (las marca el administrador en
   "Acceso a Modulos"): bs_* (Bienestar), eti_acceso + navAppEti (ETI), ev_acceso (Evaluaciones).
   definido=false -> ese usuario aun no se configuro aqui y cada sistema usa su lista de siempre.
   Usuario inactivo o eliminado en RR.LL. -> activo=false (sin acceso en ningun sistema).
   Si la base no responde en 4 s devuelve null y cada sistema sigue como siempre. */
const BS_MODS = ['quejas', 'accidentes', 'hostigamiento', 'subsidios', 'rendiciones', 'panel', 'estadisticas', 'descansos', 'gestion_social', 'gs_gestantes', 'gs_canal', 'gs_condiciones', 'gs_datos', 'gs_comite', 'gs_adolescentes', 'gs_lactario', 'gs_discapacidad', 'gs_lactancia', 'auditoria'];   /* _BS_AUDITORIA_ACCESO_V1 (24-nov-2026) */   /* V6 (15-nov): cumplimiento legal · _BS_LACTANCIA_V1 (16-nov) */   /* _BS_GESTION_SOCIAL_V1 (14-nov-2026): + bs_gestion_social · V5 (15-nov): casillas separadas bs_gs_gestantes, bs_gs_canal, bs_gs_condiciones */
async function accesosDe(usuario) {
  try {
    const { getPool, sql } = require('../shared/db');
    const lim = (pr) => Promise.race([pr, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 4000))]);
    const p = await lim(getPool());
    const q = await lim(p.request().input('u', sql.NVarChar(60), usuario).query(
      "SELECT modulo, permitido FROM dbo.PermisosModulos WHERE usuario = @u AND (modulo LIKE 'bs[_]%' OR modulo LIKE 'eti[_]%' OR modulo LIKE 'ev[_]%' OR modulo = 'navAppEti');" +
      "SELECT TOP 1 activo, eliminado FROM dbo.usuarios WHERE LOWER(usuario) = @u"));
    const m = {}; let definido = false;
    (q.recordsets[0] || []).forEach(x => { m[x.modulo] = !!x.permitido; if (/^(bs|eti|ev)_/.test(x.modulo)) definido = true; });
    const u = (q.recordsets[1] || [])[0];
    const activo = !!u && !(u.eliminado === true || u.eliminado === 1) && (u.activo === true || u.activo === 1 || String(u.activo).trim().toUpperCase() === 'TRUE');
    const bs = { acceso: activo && !!m.bs_acceso, admin: activo && !!m.bs_admin, permisos: {} };
    BS_MODS.forEach(k => { bs.permisos[k] = bs.acceso && !!m['bs_' + k]; });
    /* _BS_TODOS_MODULOS_V1 (24-nov-2026): casillas nuevas para modulos que ya se usaban. Sin casilla guardada vale lo de antes (nadie pierde acceso). */
    const conDef = (k, d) => bs.acceso && (Object.prototype.hasOwnProperty.call(m, 'bs_' + k) ? !!m['bs_' + k] : !!d);
    bs.permisos.ficha = conDef('ficha', true); bs.permisos.sugerencias_acceso = conDef('sugerencias_acceso', true); bs.permisos.expediente = conDef('expediente', m.bs_estadisticas);
    /* _ETI_PANTALLAS_V1 (25-nov-2026), decision de Joel: cada pantalla de Capacitaciones ETI tiene su casilla en Acceso a Modulos (eti_p_<pantalla>).
       Sin casilla guardada la pantalla sigue como siempre (true); la casilla solo quita. */
    /* _ETI_PANTALLAS_V2 (26-nov-2026), decision de Joel: las casillas de Capacitaciones ETI DAN y QUITAN (claves etiv_<pantalla>).
       true = se le muestra aunque su rol no la tenga · false = se le quita · null = lo que diga su rol.
       Las casillas anteriores (eti_p_, solo quitaban) se respetan cuando estan APAGADAS; encendidas no dan nada. */
    const etiPant = {}; ['dashboard', 'programacion', 'registro', 'tabla', 'ranking', 'estadisticas', 'usuarios', 'mipanel'].forEach(k => { const h = x => Object.prototype.hasOwnProperty.call(m, x); etiPant[k] = h('etiv_' + k) ? !!m['etiv_' + k] : ((h('eti_p_' + k) && !m['eti_p_' + k]) ? false : null); });
    /* _EV_PANTALLAS_V1 (25-nov-2026): lo mismo para las pantallas de Evaluaciones ETI (ev_p_<pantalla>) */
    const evPant = {}; ['estadisticas', 'indicadores', 'trafico', 'evaluar', 'qr', 'encuesta', 'mis', 'cumplimiento', 'alertas', 'conectados', 'informes', 'usuarios'].forEach(k => { evPant[k] = Object.prototype.hasOwnProperty.call(m, 'ev_p_' + k) ? !!m['ev_p_' + k] : true; });
    return { definido, activo, bs, eti: { acceso: activo && (!!m.eti_acceso || !!m.navAppEti), programar: activo && !!m.navAppEti, pantallas: etiPant }, ev: { acceso: activo && !!m.ev_acceso, pantallas: evPant } };
  } catch (e) { return null; }
}

const AUD_PASE   = 'eti-sso';
const AUD_SESION = 'eti-sesion';

module.exports = async function (context, req) {
  const out = (status, body) => {
    context.res = { status, headers: { 'Content-Type': 'application/json' }, body };
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) return out(503, { success: false, error: 'SSO no configurado' });

  const body = req.body || {};
  const accion = String(body.accion || '').trim();

  try {
    if (accion === 'emitir') {
      const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
      const tk = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (!tk) return out(401, { success: false, error: 'Token requerido' });
      let s;
      try { s = jwt.verify(tk, secret); }
      catch (e) { return out(401, { success: false, error: 'Sesion invalida o vencida' }); }
      if (s.aud === AUD_PASE || !s.usuario) return out(401, { success: false, error: 'Token no valido para emitir' });

      const _u = String(s.usuario).toLowerCase().trim();
      const pase = jwt.sign({
        etiProg: await etiProg(_u),   /* _ETI_PERMISO_V1 */
        usuario: String(s.usuario).toLowerCase().trim(),
        rol:     String(s.rol || '').toLowerCase().trim(),
        empresa: String(s.empresa || ''),
        nombre:  String(body.nombre || '').slice(0, 120)   // solo para mostrar
      }, secret, { expiresIn: '90s', audience: AUD_PASE });
      return out(200, { success: true, pase });
    }

    if (accion === 'verificar') {
      let d;
      try { d = jwt.verify(String(body.pase || ''), secret, { audience: AUD_PASE }); }
      catch (e) { return out(401, { success: false, error: 'Pase invalido o vencido' }); }
      const token = jwt.sign({ usuario: d.usuario, rol: d.rol || '', empresa: d.empresa || '' },
                             secret, { expiresIn: '8h', audience: AUD_SESION });
      /* _LOGIN_AUDIT_V1 (02-nov-2026): el pase se canjeo -> el usuario entro al Sistema ETI */
      try { const { getPool } = require('../shared/db'); const AUD = require('../shared/login-audit'); getPool().then(pool => AUD.registrar(pool, req, { usuario: d.usuario, rol: d.rol, empresa: d.empresa, sistema: 'SSO-ETI', resultado: 'ok' })).catch(() => {}); } catch (e) {}
      return out(200, {
        success: true,
        user: { usuario: d.usuario, nombre: d.nombre || '', rol: d.rol || '', empresa: d.empresa || '', etiProg: !!d.etiProg, accesos: await accesosDe(String(d.usuario).toLowerCase()) },   /* _ETI_PERMISO_V1 + _ACCESOS_CENTRAL_V1 */
        token
      });
    }

    if (accion === 'sesion') {
      let d;
      try { d = jwt.verify(String(body.token || ''), secret); }
      catch (e) { return out(401, { success: false, error: 'Sesion invalida o vencida' }); }
      if (d.aud === AUD_PASE || !d.usuario) return out(401, { success: false, error: 'Token no valido' });
      /* _SSO_SEDE_V1 (23-nov-2026, decision de Joel: "nadie de Olmos debe ver lo de Piura"): la respuesta dice la sede del usuario
         (OLMOS / PIURA / TODO) para que el Apps Script de Bienestar la guarde en su sesion y cierre las acciones de datos a quien es
         de Olmos. Si la base no responde en 4 s va vacia y todo sigue como antes. */
      let sedeU = '';
      try {
        const { getPool } = require('../shared/db'); const SDS = require('../shared/sede');
        sedeU = await Promise.race([getPool().then(p => SDS.modoReal(p, { usuario: String(d.usuario).toLowerCase() })), new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 4000))]);
      } catch (e) { sedeU = ''; }
      return out(200, { success: true, user: { usuario: String(d.usuario).toLowerCase(), rol: d.rol || '', accesos: await accesosDe(String(d.usuario).toLowerCase()), sede: sedeU || '' } });   /* _ACCESOS_CENTRAL_V1 */
    }

    return out(400, { success: false, error: 'Accion no valida' });
  } catch (e) {
    context.log.error('auth-sso error:', e.message);
    return out(500, { success: false, error: 'Error interno' });
  }
};
/* _BS_PERMISOS_SERVIDOR_V1 (08-nov-2026): Bienestar (bs/ficha, bs/tabla) calcula los permisos en el servidor con esta misma funcion */
module.exports.accesosDe = accesosDe;
