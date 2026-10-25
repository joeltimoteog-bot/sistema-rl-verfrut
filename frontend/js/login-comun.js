/* ═══════════════════════════════════════════════════════════════════════════
   _LOGIN_COMUN_V1 (18-oct-2026) — una sola contraseña para RR.LL., Capacitaciones ETI y Evaluaciones ETI
   ---------------------------------------------------------------------------
   Valida usuario y contraseña EXACTAMENTE como el login del Sistema RR.LL.:
     1) Azure auth/login (principal, 12 s).
     2) Si Azure no responde o responde mal (caída, arranque en frío, página de error sin CORS),
        se prueba el login de Google (respaldo, 25 s). Si Azure RECHAZÓ la clave o bloqueó por
        intentos, NO se prueba Google (así el límite de 5 intentos no se puede saltar).
   Devuelve siempre un objeto, nunca lanza error:
     { ok, user, token, via, rechazado, bloqueado, minutos, intentosRestantes, sinServidor, error }
   Uso: const r = await rlLoginComun(usuario, clave);
   Para desactivar: quitar la etiqueta <script src=".../login-comun.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.rlLoginComun) return;
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api/auth/login';
  var GAS = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';

  function conReloj(url, op, ms) {
    var c = (typeof AbortController === 'function') ? new AbortController() : null, t = null;
    if (c) { op.signal = c.signal; t = setTimeout(function () { try { c.abort(); } catch (e) {} }, ms); }
    return fetch(url, op).then(function (r) { if (t) clearTimeout(t); return r; }, function (e) { if (t) clearTimeout(t); throw e; });
  }
  function jsonSeguro(r) { return r.text().then(function (s) { try { return JSON.parse(s); } catch (e) { return null; } }); }

  window.rlLoginComun = async function (usuario, clave) {
    var u = String(usuario || '').trim(), p = String(clave || '');
    if (!u || !p) return { ok: false, error: 'Ingresa tu usuario y contraseña.' };
    var d = null, st = 0;
    /* 1) Azure */
    try {
      var r = await conReloj(AZ, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: u, password: p }) }, 12000);
      st = r.status; d = await jsonSeguro(r);
    } catch (eAz) { try { console.warn('[_LOGIN_COMUN_V1] Azure no respondió:', eAz && (eAz.name || eAz.message)); } catch (e) {} }
    if (d && d.success && d.user) return { ok: true, user: d.user, token: d.token || null, via: 'azure', claveTemporal: !!d.claveTemporal, cambioObligatorio: !!d.cambioObligatorio };
    if (d && (d.rechazado || d.bloqueado || st === 429)) {
      return { ok: false, rechazado: true, bloqueado: !!(d.bloqueado || st === 429), minutos: d.minutos || 0,
        intentosRestantes: (typeof d.intentosRestantes === 'number') ? d.intentosRestantes : null, error: d.error || 'Usuario o contraseña incorrectos.' };
    }
    /* 2) Google (respaldo): Azure no contestó, contestó mal o no conoce al usuario */
    var g = null;
    try {
      var rg = await conReloj(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'login', usuario: u, password: p }) }, 25000);
      g = await jsonSeguro(rg);
    } catch (eG) { try { console.warn('[_LOGIN_COMUN_V1] Google no respondió:', eG && (eG.name || eG.message)); } catch (e) {} }
    if (g && g.success && g.user) return { ok: true, user: g.user, token: g.token || null, via: 'google' };
    if (!d && !g) return { ok: false, sinServidor: true, error: 'No hay conexión con el servidor en este momento. Intenta de nuevo en unos segundos.' };
    var m = (g && (g.error || g.message)) || (d && d.error) || 'Usuario o contraseña incorrectos.';
    return { ok: false, rechazado: true, bloqueado: /demasiados intentos|bloquead/i.test(m), error: m };
  };
})();
