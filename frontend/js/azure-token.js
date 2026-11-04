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
  /* _MODO_GOOGLE_V1 (04-nov-2026) — EMERGENCIA: caida de Azure Storage en Brazil South (Microsoft).
     Con MODO_GOOGLE = true NINGUNA llamada va a Azure: falla al instante y cada modulo usa su respaldo de
     Google sin esperar los 12-14 s del reloj. Al volver Azure: MODO_GOOGLE = false (y subir ?v=).
     Prueba en un solo navegador: localStorage.rl_modo_google = 'off' (usa Azure) / 'on' (usa Google). */
  var MODO_GOOGLE = true;
  try { var mg = localStorage.getItem('rl_modo_google'); if (mg === 'off') MODO_GOOGLE = false; else if (mg === 'on') MODO_GOOGLE = true; } catch (e) {}
  if (MODO_GOOGLE) { try { console.warn('[_MODO_GOOGLE_V1] modo respaldo: Azure desactivado, todo va directo a Google'); } catch (e) {} }
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (MODO_GOOGLE && url.indexOf(MARCA) >= 0) return Promise.reject(new TypeError('Failed to fetch (modo respaldo Google)'));
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

/* ═════════════════════════════════════════════════════════════════════════
   _SESION_RENOVAR_V1 (02-nov-2026) — la sesión se renueva sola mientras el usuario trabaja
   Problema: el token dura 14 h, pero la pestaña del dashboard queda abierta días; desde entonces
   Azure respondía 401 y el sistema caía al respaldo de Google (lento y sin sesión verificable).
   · Cada 5 min (y al volver a la pestaña): si al token le quedan < 6 h, o ya venció, se pide
     POST auth/renovar con el token actual → token nuevo (mismo usuario, 14 h más). Sin clave.
   · Si Azure dice que la sesión es irrecuperable (vencida > 36 h, usuario inactivo, token inválido)
     se muestra un aviso y se vuelve a la pantalla de ingreso; al entrar, regresa a la misma página.
   · Sin token en una página de trabajo (sesión que entró por el respaldo de Google): mismo aviso.
   · Se actualiza también la copia del token que usa Bienestar (bienestarSocialAuth.rl_token).
   Interruptor: localStorage.rl_renovar = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._SESION_RENOVAR_V1) return; window._SESION_RENOVAR_V1 = true;
  try { if (localStorage.getItem('rl_renovar') === 'off') return; } catch (e) {}
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api';
  var esLogin = /\/index\.html$|\/sistema-rl-verfrut\/?$/.test(location.pathname) || location.pathname === '/';
  var RENOVAR_ANTES_MS = 6 * 3600e3, CADA_MS = 5 * 60000, enCurso = false, avisado = false;

  function tk() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function exp(t) { try { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return (p.exp || 0) * 1000; } catch (e) { return 0; } }
  function guardar(nuevo) {
    try { sessionStorage.setItem('rl_token', nuevo); } catch (e) {}
    try { var s = JSON.parse(localStorage.getItem('rl_session') || 'null'); if (s) { s.token = nuevo; s.timestamp = Date.now(); localStorage.setItem('rl_session', JSON.stringify(s)); } } catch (e) {}
    try { var b = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); if (b && b.rl_token !== undefined) { b.rl_token = nuevo; localStorage.setItem('bienestarSocialAuth', JSON.stringify(b)); } } catch (e) {}
  }
  function aviso(msg) {
    if (avisado) return; avisado = true;
    try { sessionStorage.setItem('rl_volver', location.pathname + location.search); } catch (e) {}
    var d = document.createElement('div');
    d.id = 'rlSesionVencida';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,39,72,.72);display:flex;align-items:center;justify-content:center;font-family:Inter,Segoe UI,Arial,sans-serif';
    d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:28px 30px;max-width:420px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center">' +
      '<div style="font-size:34px;margin-bottom:8px">🔐</div><div style="font-size:18px;font-weight:700;color:#0F2748;margin-bottom:8px">Tu sesión venció</div>' +
      '<div style="font-size:14px;color:#475569;line-height:1.5;margin-bottom:18px">' + msg + '</div>' +
      '<button id="rlSesionIr" style="background:#0F2748;color:#fff;border:0;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer">Volver a ingresar</button></div>';
    (document.body || document.documentElement).appendChild(d);
    document.getElementById('rlSesionIr').onclick = function () { location.href = '/sistema-rl-verfrut/index.html'; };
  }
  async function revisar(motivo) {
    if (esLogin || enCurso || avisado) return;
    var t = tk();
    var conUsuario = false; try { conUsuario = !!sessionStorage.getItem('user'); } catch (e) {}
    /* _SESION_SIN_BUCLE_V1 (04-nov-2026): si el login entró por Google (Azure no respondió) NO se bloquea la pantalla:
       volver a ingresar daría otra vez una sesión sin credencial y el aviso salía en bucle. Se trabaja con el respaldo. */
    if (!t) { if (conUsuario) console.warn('[_SESION_RENOVAR_V1] sesión sin credencial de Azure (entró por Google): se trabaja con el respaldo'); return; }
    var e = exp(t); if (!e) return;
    if (e - Date.now() > RENOVAR_ANTES_MS) return;   /* todavía le queda más de 6 h */
    enCurso = true;
    try {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (x) {} }, 10000);
      var r = await fetch(BASE + '/auth/renovar', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, signal: ctl ? ctl.signal : undefined });
      clearTimeout(reloj);
      if (r.status === 401) {
        var j = null; try { j = await r.json(); } catch (x) {}
        aviso(j && j.motivo === 'inactivo' ? 'Tu usuario fue desactivado. Comunícate con Relaciones Laborales.' : 'Por seguridad, las sesiones se renuevan cada día. Vuelve a ingresar y regresarás a esta misma pantalla.');
        return;
      }
      if (!r.ok) return;   /* Azure dormido o error: se reintenta en 5 min */
      var d = await r.json();
      if (d && d.success && d.token) { guardar(d.token); console.log('[_SESION_RENOVAR_V1] sesión renovada (' + motivo + ')'); }
    } catch (x) { /* red: se reintenta */ } finally { enCurso = false; }
  }
  setTimeout(function () { revisar('inicio'); }, 4000);
  setInterval(function () { if (document.visibilityState === 'visible') revisar('reloj'); }, CADA_MS);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(function () { revisar('al volver'); }, 500); });
  window.rlSesion = { renovar: function () { return revisar('manual'); }, vence: function () { var e = exp(tk()); return e ? new Date(e) : null; } };
})();
