/* ═══════════════════════════════════════════════════════════════════════════
   azure-token.js — _AZ_TOKEN_V1 (05-oct-2026) · _GAS_SESION_V1 (31-oct-2026)
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
  /* _GAS_SESION_V1 (31-oct-2026): el backend de Google (copia de respaldo) tambien recibe la sesion firmada por Azure
     (parametro rl_token en GET, campo rl_token en el cuerpo JSON del POST). Google verifica la firma con el mismo secreto
     y, en modo obligatorio, rechaza lo que no venga de una sesion valida. Misma URL, mismo cuerpo, misma respuesta. */
  var MARCA_GAS = 'script.google.com/macros/';
  function conSesionGas(input, init, tk) {
    var url = input;
    if (!init || String(init.method || 'GET').toUpperCase() === 'GET') {
      if (/[?&]rl_token=/.test(url)) return [url, init];
      return [url + (url.indexOf('?') >= 0 ? '&' : '?') + 'rl_token=' + encodeURIComponent(tk), init];
    }
    if (typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
      try { var b = JSON.parse(init.body); if (b && typeof b === 'object' && !b.rl_token) { b.rl_token = tk; var i2 = Object.assign({}, init); i2.body = JSON.stringify(b); return [url, i2]; } } catch (e) {}
    }
    return [url, init];
  }
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (typeof input === 'string' && url.indexOf(MARCA_GAS) >= 0) {
        var tg = null; try { tg = sessionStorage.getItem('rl_token'); } catch (e) {}
        if (!tg) return fOrig.apply(this, arguments);
        var r = conSesionGas(input, init, tg);
        return fOrig.call(this, r[0], r[1]);
      }
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

/* ═══════════════════════════════════════════════════════════════════════════
   _EXPORT_AUDIT_V1 (01-nov-2026) — Registro de exportaciones a Excel
   Todas las pantallas exportan con XLSX.writeFile (SheetJS). Aqui se envuelve UNA vez y cada
   exportacion queda anotada en Azure (POST /actividad/exportacion: pantalla, archivo, filas, hojas).
   No cambia el archivo ni el flujo: si el registro falla, la exportacion sale igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlExportAuditOk) return;
  window._rlExportAuditOk = true;
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api/actividad/exportacion';
  function navegador() {
    var ua = navigator.userAgent || '', b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    return b + (/Android/.test(ua) ? ' / Android' : /iPhone|iPad/.test(ua) ? ' / iOS' : /Windows/.test(ua) ? ' / Windows' : /Mac OS/.test(ua) ? ' / Mac' : '');
  }
  function contar(wb) {
    var filas = 0, hojas = 0;
    try {
      (wb.SheetNames || []).forEach(function (n) {
        var ws = wb.Sheets[n]; if (!ws || !ws['!ref']) return; hojas++;
        var r = window.XLSX.utils.decode_range(ws['!ref']); filas += Math.max(0, r.e.r - r.s.r);   /* sin la cabecera */
      });
    } catch (e) {}
    return { filas: filas, hojas: hojas };
  }
  function anotar(wb, archivo) {
    try {
      var tk = sessionStorage.getItem('rl_token'); if (!tk) return;
      var c = contar(wb), pant = (document.title || '').replace(/\s*[-|·].*$/, '').trim() || location.pathname.split('/').pop();
      var cuerpo = { sistema: 'RR.LL.', pantalla: pant.slice(0, 120), archivo: String(archivo || '').slice(0, 200), filas: c.filas, hojas: c.hojas, navegador: navegador() };
      fetch(AZ, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo) }).catch(function () {});
      try { if (window.RLTrafico) RLTrafico.emit({ accion: 'Exportó a Excel: ' + (archivo || '') + ' (' + c.filas + ' filas)', destino: 'Descarga' }); } catch (e) {}
    } catch (e) {}
  }
  function envolver() {
    var X = window.XLSX; if (!X || X._rlAudit) return !!(X && X._rlAudit);
    ['writeFile', 'writeFileXLSX', 'writeFileAsync'].forEach(function (k) {
      if (typeof X[k] !== 'function') return;
      var orig = X[k];
      X[k] = function (wb, archivo) { try { anotar(wb, archivo); } catch (e) {} return orig.apply(this, arguments); };
    });
    X._rlAudit = true; return true;
  }
  var n = 0, it = setInterval(function () { if (envolver() || ++n > 120) clearInterval(it); }, 500);   /* XLSX se carga despues de este archivo */
})();
