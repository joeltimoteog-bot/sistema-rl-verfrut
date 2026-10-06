/* ═══════════════════════════════════════════════════════════════════════════
   azure-token.js — _AZ_TOKEN_V1 (05-oct-2026)
   Toda consulta a Azure lleva la sesion del usuario (Authorization: Bearer).
   Hasta hoy varias pantallas consultaban Azure SIN sesion (busqueda de DNI,
   capacitaciones, supervisores...) y Azure las dejaba pasar ("modo suave").
   Este archivo se carga PRIMERO en cada pagina y solo AGREGA la sesion si la
   llamada no la trae. No cambia nada mas: misma URL, mismo cuerpo, misma respuesta.
   Sin sesion guardada (pantalla de login) no hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlAzTokenOk || typeof window.fetch !== 'function') return;
  window._rlAzTokenOk = true;
  var fOrig = window.fetch;
  var MARCA = 'azurewebsites.net/api/';
  function tieneAuth(h) {
    try {
      if (!h) return false;
      if (typeof Headers !== 'undefined' && h instanceof Headers) return h.has('Authorization');
      if (Array.isArray(h)) return h.some(function (p) { return String(p[0]).toLowerCase() === 'authorization'; });
      return Object.keys(h).some(function (k) { return k.toLowerCase() === 'authorization'; });
    } catch (e) { return true; }
  }
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (url.indexOf(MARCA) < 0 || typeof input !== 'string') return fOrig.apply(this, arguments);
      if (/\/api\/auth\//.test(url)) return fOrig.apply(this, arguments);          /* login: sin sesion todavia */
      var tk = null;
      try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
      if (!tk || (init && tieneAuth(init.headers))) return fOrig.apply(this, arguments);
      var i2 = Object.assign({}, init || {});
      var h = i2.headers;
      if (typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('Authorization', 'Bearer ' + tk); }
      else if (Array.isArray(h)) { h = h.concat([['Authorization', 'Bearer ' + tk]]); }
      else { h = Object.assign({}, h || {}, { Authorization: 'Bearer ' + tk }); }
      i2.headers = h;
      return fOrig.call(this, input, i2);
    } catch (e) { return fOrig.apply(this, arguments); }
  };
})();
