/* ═══════════════════════════════════════════════════════════════════════════
   _SALUD_V1 (23-set-2026) — Salud del sistema en el navegador
   ---------------------------------------------------------------------------
   1) REGISTRO DE ERRORES: cada falla, corte o demora (> 10 s) de una llamada a
      Google o Azure, y cada error de JavaScript, se anota en una cola local y
      se envia en lote cada ~60 s a la hoja LOG_ERRORES (accion saludLog).
      Si el servidor esta caido, la cola espera y se envia despues: asi queda
      registrada tambien la caida. NO se envian datos del trabajador (ni DNI,
      ni cuerpo de la consulta): solo usuario, pagina, accion, tiempo y error.
   2) MENSAJES EN ESPANOL: traduce "signal is aborted without reason",
      "Failed to fetch", "Unexpected token <", etc. en los avisos al usuario.
   3) AVISO DE VERSION NUEVA: si se publica una version mientras la pagina
      esta abierta, muestra un aviso con boton "Actualizar" (no recarga solo,
      para no perder un formulario a medio llenar).
   Para desactivar: quitar la etiqueta <script src=".../salud.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
if (window._SALUD_V1) return;
window._SALUD_V1 = true;

var GAS_URL   = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
var COLA_KEY  = 'rl_salud_cola';
var MAX_COLA  = 100;      // tope local
var POR_ENVIO = 40;       // registros por envio
var LENTO_MS  = 10000;    // mas de 10 s = lento
var PAGINA    = (location.pathname.split('/').pop() || 'index.html');
var _f        = window.fetch;   // fetch original: el envio del log no se mide a si mismo
if (typeof _f !== 'function') return;

function ahora() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

function usuario() {
  try {
    if (window.USER && USER.usuario) return String(USER.usuario);
    var u = JSON.parse(sessionStorage.getItem('user') || 'null');
    if (u && u.usuario) return String(u.usuario);
    var inp = document.getElementById('usuario');
    if (inp && inp.value) return String(inp.value).trim().toLowerCase();
  } catch (e) {}
  return '';
}

function navegador() {
  var ua = navigator.userAgent || '', m;
  var mov = /Android|iPhone|iPad|Mobile/i.test(ua) ? ' movil' : '';
  if ((m = ua.match(/Edg\/(\d+)/)))     return 'Edge ' + m[1] + mov;
  if ((m = ua.match(/OPR\/(\d+)/)))     return 'Opera ' + m[1] + mov;
  if ((m = ua.match(/Chrome\/(\d+)/)))  return 'Chrome ' + m[1] + mov;
  if ((m = ua.match(/Firefox\/(\d+)/))) return 'Firefox ' + m[1] + mov;
  if ((m = ua.match(/Version\/(\d+).*Safari/))) return 'Safari ' + m[1] + mov;
  return ua.slice(0, 60);
}

/* ── Cola local ─────────────────────────────────────────────────────────── */
function leerCola() { try { return JSON.parse(localStorage.getItem(COLA_KEY) || '[]') || []; } catch (e) { return []; } }
function guardarCola(c) {
  try { while (c.length > MAX_COLA) c.shift(); localStorage.setItem(COLA_KEY, JSON.stringify(c)); } catch (e) {}
}
var _vistos = {};
function registrar(tipo, accion, ms, detalle) {
  try {
    var clave = tipo + '|' + accion + '|' + String(detalle || '').slice(0, 60);
    var t = Date.now();
    if (_vistos[clave] && (t - _vistos[clave]) < 60000) return;   // mismo error en 60 s = 1 registro
    _vistos[clave] = t;
    var c = leerCola();
    c.push({ f: new Date().toISOString(), u: usuario(), p: PAGINA, t: tipo,
             a: String(accion || '').slice(0, 60), ms: (ms == null ? '' : Math.round(ms)),
             d: String(detalle || '').slice(0, 300), on: navigator.onLine !== false, nav: navegador() });
    guardarCola(c);
  } catch (e) {}
}

/* ── Envio en lote ──────────────────────────────────────────────────────── */
var _enviando = false;
function enviar(keepalive) {
  try {
    if (_enviando || navigator.onLine === false) return;
    var c = leerCola();
    if (!c.length) return;
    var lote = c.slice(0, POR_ENVIO);
    var op = { method: 'POST', headers: { 'Content-Type': 'text/plain' },
               body: JSON.stringify({ action: 'saludLog', registros: lote }) };
    if (keepalive) op.keepalive = true;
    _enviando = true;
    _f.call(window, GAS_URL, op)
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var ok = false;
        try { ok = JSON.parse(txt).ok === true; } catch (e) {}
        if (ok) guardarCola(leerCola().slice(lote.length));
      })
      .catch(function () {})
      .then(function () { _enviando = false; });
  } catch (e) { _enviando = false; }
}
setTimeout(enviar, 15000 + Math.random() * 10000);            // lo pendiente de la sesion anterior
setInterval(enviar, 60000 + Math.round(Math.random() * 15000));
window.addEventListener('pagehide', function () { enviar(true); });

/* ── Medicion de llamadas a Google y Azure ──────────────────────────────── */
function accionDe(u, op, esGas) {
  try {
    if (esGas) {
      var m = u.match(/[?&]action=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
      var b = op && op.body;
      if (typeof b === 'string') { var mb = b.match(/"action"\s*:\s*"([^"]{1,60})"/); if (mb) return mb[1]; }
      return 'gas';
    }
    var p = u.split('?')[0].split('/api/');
    return 'azure:' + (p[1] || p[0]);
  } catch (e) { return '?'; }
}
window.fetch = function (recurso, opciones) {
  var u = '';
  try { u = (typeof recurso === 'string') ? recurso : (recurso && recurso.url) || ''; } catch (e) {}
  var esGas = u.indexOf('script.google.com') >= 0, esAz = u.indexOf('azurewebsites.net') >= 0;
  if (!esGas && !esAz) return _f.apply(this, arguments);
  var accion = accionDe(u, opciones, esGas), t0 = ahora(), pre = esGas ? 'google' : 'azure';
  return _f.apply(this, arguments).then(function (r) {
    try {
      var ms = ahora() - t0;
      if (r && r.status >= 500)  registrar(pre + '_http', accion, ms, 'HTTP ' + r.status);
      else if (ms > LENTO_MS)    registrar(pre + '_lento', accion, ms, 'respuesta lenta');
    } catch (e) {}
    return r;
  }, function (err) {
    try { registrar(pre + '_falla', accion, ahora() - t0, err && err.name ? (err.name + ': ' + err.message) : String(err)); } catch (e) {}
    throw err;
  });
};

/* ── Errores de JavaScript ──────────────────────────────────────────────── */
var _nJs = 0;
window.addEventListener('error', function (ev) {
  try {
    if (!ev || !ev.message || ev.message === 'Script error.' || _nJs++ > 10) return;
    registrar('js', String(ev.filename || '').split('/').pop().split('?')[0] + ':' + (ev.lineno || ''), null, ev.message);
  } catch (e) {}
});
window.addEventListener('unhandledrejection', function (ev) {
  try {
    var r = ev && ev.reason;
    if (!r || (r.name === 'AbortError') || _nJs++ > 10) return;   // los cortes ya se registran arriba
    registrar('js_promesa', '', null, r.message || String(r));
  } catch (e) {}
});

/* ── Mensajes en espanol ────────────────────────────────────────────────── */
function traducirBase(txt) {
  if (typeof txt !== 'string' || !txt) return txt;
  return txt
    .replace(/(AbortError:\s*)?(signal is aborted without reason|The user aborted a request\.?|The operation was aborted\.?|This operation was aborted\.?)/gi,
             'la consulta tardó demasiado y se canceló. Intenta nuevamente en unos segundos')
    .replace(/(TypeError:\s*)?(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)/gi,
             'no se pudo conectar con el servidor. Revisa tu internet e intenta nuevamente');
}
function traducir(txt) {
  txt = traducirBase(txt);
  if (typeof txt === 'string' && /Unexpected token|is not valid JSON|JSON\.parse:|Unexpected end of JSON/i.test(txt)) {
    var i = txt.search(/(SyntaxError:\s*)?(Unexpected|JSON\.parse|\S*\s*is not valid JSON)/i);
    txt = txt.slice(0, i < 0 ? 0 : i) + 'el servidor respondió con un error momentáneo. Intenta nuevamente';
  }
  return txt;
}
window.rlMsgError = function (e) { return traducir((e && e.message) ? e.message : String(e == null ? '' : e)); };
window.rlTraducir = traducir;

function envolver(nombre) {
  try {
    var orig = window[nombre];
    if (typeof orig !== 'function' || orig._rlTrad) return;
    var w = function () {
      var a = Array.prototype.slice.call(arguments);
      if (typeof a[0] === 'string') a[0] = traducir(a[0]);
      return orig.apply(this || window, a);
    };
    w._rlTrad = true;
    window[nombre] = w;
  } catch (e) {}
}
function envolverTodos() { ['mostrarToast', 'appAlert', 'showToast', 'toast', 'alert'].forEach(envolver); }
envolverTodos();
document.addEventListener('DOMContentLoaded', envolverTodos);
window.addEventListener('load', envolverTodos);

/* ── Aviso de version nueva ─────────────────────────────────────────────── */
var _verBase = null, _verNueva = null, _posponerHasta = 0;
function revisarVersion() {
  try {
    if (document.hidden || Date.now() < _posponerHasta) return;
    _f.call(window, location.href.split('#')[0], { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        if (!r || !r.ok) return;
        var v = r.headers.get('last-modified') || r.headers.get('etag');
        if (!v) return;
        if (_verBase === null) { _verBase = v; return; }
        if (v === _verBase) { _verNueva = null; return; }
        if (_verNueva === v) avisoVersion();     // 2 revisiones seguidas con la misma version nueva
        _verNueva = v;
      })
      .catch(function () {});
  } catch (e) {}
}
function avisoVersion() {
  if (document.getElementById('rlAvisoVersion')) return;
  var d = document.createElement('div');
  d.id = 'rlAvisoVersion';
  d.style.cssText = 'position:fixed;right:16px;bottom:16px;max-width:340px;background:#1e3a5f;color:#fff;padding:12px 14px;border-radius:12px;font:600 13px system-ui,sans-serif;z-index:99998;box-shadow:0 6px 20px rgba(0,0,0,.3)';
  d.innerHTML = '🆕 Hay una versión nueva del sistema.<br><span style="font-weight:400;font-size:12px">Guarda lo que estés haciendo y actualiza.</span>' +
    '<div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">' +
    '<button type="button" id="rlVerLuego" style="background:transparent;color:#fff;border:1px solid #fff8;border-radius:8px;padding:5px 10px;cursor:pointer">Después</button>' +
    '<button type="button" id="rlVerYa" style="background:#22c55e;color:#fff;border:0;border-radius:8px;padding:5px 12px;cursor:pointer;font-weight:700">Actualizar</button></div>';
  document.body.appendChild(d);
  document.getElementById('rlVerYa').onclick = function () { location.reload(); };
  document.getElementById('rlVerLuego').onclick = function () { d.remove(); _posponerHasta = Date.now() + 30 * 60000; };
}
setTimeout(revisarVersion, 3000);
setInterval(revisarVersion, 5 * 60000);

window.rlSalud = { registrar: registrar, enviar: enviar, cola: leerCola };
})();
