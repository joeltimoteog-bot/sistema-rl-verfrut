/* ═══════════════════════════════════════════════════════════════════════════
   _FB_LLAVE_V1 (18-oct-2026) — llave anónima de Firebase para las llamadas REST
   ---------------------------------------------------------------------------
   Hoy presencia, mensajes, tráfico e historial se leen/escriben por REST
   (…firebaseio.com/xxx.json) sin ninguna llave, porque las reglas los dejan
   abiertos. Para poder cerrarlos (".read/.write": "auth != null") sin tocar las
   decenas de llamadas existentes, este archivo:
     1) obtiene UNA llave anónima de Firebase Auth por navegador (REST, sin SDK),
        la renueva sola cada hora con su refresh token y la guarda en localStorage;
     2) envuelve fetch: a toda URL de la base RL (sistema-rl-verfrut-default-rtdb)
        que no traiga "auth=" le agrega "&auth=<llave>". Nada más cambia.
   Costo: cero (Firebase Auth anónimo es gratis en el plan Spark; es el mismo
   proveedor que ya usan presencia.js y el Dashboard con el SDK).
   Debe cargarse ANTES que trafico.js / presencia.js (primer script de la página).
   Si la llave no se puede obtener, las llamadas salen como hoy (sin auth).
   Para desactivar: quitar la etiqueta <script src=".../firebase-llave.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._FB_LLAVE_V1 || typeof window.fetch !== 'function') return;
  window._FB_LLAVE_V1 = true;

  var API_KEY = 'AIzaSyBTp4WHO5bGEoYDhTbyWZVfdQxbAQHwp4I';          /* clave web pública del proyecto sistema-rl-verfrut */
  var DB_HOST = 'sistema-rl-verfrut-default-rtdb.firebaseio.com';
  var LS = 'rl_fb_llave_v1';
  var MARGEN_MS = 5 * 60 * 1000;                                      /* se renueva 5 min antes de vencer */
  var fetchReal = window.fetch;
  var estado = null;      /* { idToken, refreshToken, exp } */
  var enCurso = null;     /* promesa de obtención/renovación en curso */

  function leer() { try { var j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j && j.idToken && j.refreshToken && j.exp) estado = j; } catch (e) {} }
  function guardar() { try { localStorage.setItem(LS, JSON.stringify(estado)); } catch (e) {} }
  function vigente() { return !!(estado && estado.idToken && Date.now() < estado.exp - MARGEN_MS); }

  function pedir(url, body) {
    return fetchReal(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); });
  }
  function nueva() {
    return pedir('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, { returnSecureToken: true })
      .then(function (j) { if (!j || !j.idToken) throw new Error('sin idToken'); estado = { idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000 }; guardar(); return estado.idToken; });
  }
  function renovar() {
    return fetchReal('https://securetoken.googleapis.com/v1/token?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(estado.refreshToken) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.id_token) throw new Error('refresh'); estado = { idToken: j.id_token, refreshToken: j.refresh_token || estado.refreshToken, exp: Date.now() + (parseInt(j.expires_in, 10) || 3600) * 1000 }; guardar(); return estado.idToken; }); })
      .catch(function () { estado = null; try { localStorage.removeItem(LS); } catch (e) {} return nueva(); });
  }
  /* devuelve la llave (promesa); null si no se pudo */
  var noAntesDe = 0;   /* tras un fallo, no se insiste por 60 s */
  function llave() {
    if (vigente()) return Promise.resolve(estado.idToken);
    if (enCurso) return enCurso;
    if (Date.now() < noAntesDe) return Promise.resolve(null);
    enCurso = (estado && estado.refreshToken ? renovar() : nueva())
      .catch(function (e) { noAntesDe = Date.now() + 60000; console.warn('[_FB_LLAVE_V1] sin llave de Firebase (se sigue sin auth):', e && e.message); return null; })
      .then(function (t) { enCurso = null; return t; });
    return enCurso;
  }
  window.rlFirebaseLlave = { token: llave, estado: function () { return { vigente: vigente(), vence: estado && new Date(estado.exp).toISOString() }; } };

  function esDb(u) { return typeof u === 'string' && u.indexOf(DB_HOST) >= 0 && u.indexOf('auth=') < 0; }
  function conLlave(u, t) { return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'auth=' + encodeURIComponent(t); }

  window.fetch = function (recurso, opciones) {
    var self = this, args = arguments;
    try {
      var u = (typeof recurso === 'string') ? recurso : (recurso && recurso.url) || '';
      if (!esDb(u) || typeof recurso !== 'string') return fetchReal.apply(self, args);
      if (vigente()) return fetchReal.call(self, conLlave(u, estado.idToken), opciones);
      return llave().then(function (t) { return fetchReal.call(self, t ? conLlave(u, t) : u, opciones); });
    } catch (e) { return fetchReal.apply(self, args); }
  };

  leer();
  /* se pide la llave al cargar, para que la primera escritura de presencia ya salga con ella */
  llave();
  /* renovación silenciosa cada 10 min (si la pestaña sigue abierta) */
  setInterval(function () { if (!vigente()) llave(); }, 10 * 60 * 1000);
})();
