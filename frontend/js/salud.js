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
var _recientes = [];
function registrar(tipo, accion, ms, detalle) {
  try {
    var clave = tipo + '|' + accion + '|' + String(detalle || '').slice(0, 60);
    var t = Date.now();
    if (_vistos[clave] && (t - _vistos[clave]) < 60000) return;   // mismo error en 60 s = 1 registro
    _vistos[clave] = t;
    try { _recientes.push({ h: new Date().toTimeString().slice(0, 8), t: tipo, a: String(accion || '').slice(0, 60), d: String(detalle || '').slice(0, 150) }); while (_recientes.length > 8) _recientes.shift(); } catch (e) {}
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
  d.style.cssText = 'position:fixed;right:16px;bottom:64px;max-width:340px;background:#1e3a5f;color:#fff;padding:12px 14px;border-radius:12px;font:600 13px system-ui,sans-serif;z-index:99998;box-shadow:0 6px 20px rgba(0,0,0,.3)';
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

/* ── _REPORTE_V1: pestana "🆘 Reportar" + formulario ─────────────────────── */
function moduloActual() {
  try {
    var sec = document.querySelector('.sec.on');
    if (sec) {
      var h = sec.querySelector('h1,h2,h3,.sec-title');
      return (h && h.textContent.trim().slice(0, 60)) || sec.id;
    }
    return (document.title || PAGINA).slice(0, 60);
  } catch (e) { return PAGINA; }
}
function abrirReporte() {
  if (document.getElementById('rlRepOv')) return;
  var ov = document.createElement('div');
  ov.id = 'rlRepOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:#fff;color:#0f172a;max-width:440px;width:100%;border-radius:14px;padding:18px 18px 14px;font:14px system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)">' +
    '<div style="font-size:17px;font-weight:800;margin-bottom:4px">🆘 Reportar un problema</div>' +
    '<div style="font-size:12px;color:#475569;margin-bottom:10px">Cuéntanos qué pasó. Se envía automáticamente con tu usuario, el módulo (<b id="rlRepMod"></b>) y los últimos errores de tu equipo.</div>' +
    '<textarea id="rlRepTxt" rows="5" maxlength="1000" placeholder="Ej.: Al guardar la atención de un trabajador se quedó cargando y no guardó." style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font:14px system-ui,sans-serif;resize:vertical"></textarea>' +
    '<div id="rlRepMsg" style="font-size:12px;min-height:16px;margin:6px 0"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button type="button" id="rlRepNo" style="background:#e2e8f0;color:#0f172a;border:0;border-radius:9px;padding:8px 14px;cursor:pointer;font-weight:600">Cancelar</button>' +
    '<button type="button" id="rlRepSi" style="background:#dc2626;color:#fff;border:0;border-radius:9px;padding:8px 16px;cursor:pointer;font-weight:700">Enviar reporte</button></div></div>';
  document.body.appendChild(ov);
  var mod = moduloActual();
  document.getElementById('rlRepMod').textContent = mod;
  var txt = document.getElementById('rlRepTxt'), msg = document.getElementById('rlRepMsg'), si = document.getElementById('rlRepSi');
  var cerrar = function () { try { ov.remove(); } catch (e) {} };
  document.getElementById('rlRepNo').onclick = cerrar;
  ov.addEventListener('click', function (ev) { if (ev.target === ov) cerrar(); });
  setTimeout(function () { try { txt.focus(); } catch (e) {} }, 50);
  si.onclick = function () {
    var d = String(txt.value || '').trim();
    if (d.length < 5) { msg.style.color = '#dc2626'; msg.textContent = 'Escribe brevemente qué pasó.'; return; }
    si.disabled = true; si.textContent = 'Enviando...'; msg.textContent = '';
    var body = { action: 'saludReporte', usuario: usuario(), pagina: PAGINA, modulo: mod, descripcion: d,
                 errores: _recientes.slice(), nav: navegador(), pantalla: (window.innerWidth + 'x' + window.innerHeight),
                 online: navigator.onLine !== false };
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 30000);
    var op = { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) };
    if (ctrl) op.signal = ctrl.signal;
    _f.call(window, GAS_URL, op).then(function (r) { return r.text(); }).then(function (t) {
      clearTimeout(reloj);
      var r = {}; try { r = JSON.parse(t); } catch (e) {}
      if (r.ok) {
        msg.style.color = '#16a34a'; msg.textContent = '✅ Gracias. Tu reporte N° ' + r.nro + ' fue enviado al administrador.';
        si.style.display = 'none'; document.getElementById('rlRepNo').textContent = 'Cerrar';
      } else {
        msg.style.color = '#dc2626'; msg.textContent = r.error || 'No se pudo enviar. Intenta nuevamente.';
        si.disabled = false; si.textContent = 'Enviar reporte';
      }
    }).catch(function () {
      clearTimeout(reloj);
      registrar('reporte_usuario', mod, null, d);   /* se envia con el lote de errores cuando vuelva la conexion */
      msg.style.color = '#b45309'; msg.textContent = '📡 Sin conexión: tu reporte quedó guardado y se enviará automáticamente.';
      si.style.display = 'none'; document.getElementById('rlRepNo').textContent = 'Cerrar';
    });
  };
}
function pestanaReporte() {
  try {
    if (document.getElementById('rlRepTab') || !document.body) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'rlRepTab';
    b.textContent = '🆘 Reportar';
    b.title = 'Reportar un problema del sistema';
    b.style.cssText = 'position:fixed;right:0;top:55%;transform:rotate(-90deg) translate(50%,0);transform-origin:right bottom;background:#dc2626;color:#fff;border:0;border-radius:8px 8px 0 0;padding:5px 11px;font:700 12px system-ui,sans-serif;z-index:99990;cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    b.onmouseenter = function () { b.style.opacity = '1'; };
    b.onmouseleave = function () { b.style.opacity = '.85'; };
    b.onclick = abrirReporte;
    document.body.appendChild(b);
  } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pestanaReporte); else pestanaReporte();
window.rlReportar = abrirReporte;

/* ── _VIGIA_V1 (24-set-2026): NINGUNA llamada al servidor puede quedar colgada ──
   Envuelve UNA sola vez (al terminar de cargar la pagina, despues de todos los demas)
   apiPost y apiGet. Si la respuesta no llega en 120 s (300 s para subir archivos),
   devuelve un error claro para que el boton se libere y la pantalla no quede
   "Guardando..." para siempre. Los errores normales se dejan pasar igual que antes. */
function vigia(nombre) {
  var prev = window[nombre];
  if (typeof prev !== 'function' || prev._rlVigia) return;
  var w = function (b) {
    var acc = (b && b.action) || '', ms = /^subir/i.test(acc) ? 300000 : 120000, timer;
    var p;
    try { p = Promise.resolve(prev.apply(this, arguments)); } catch (e) { p = Promise.reject(e); }
    var limite = new Promise(function (res) {
      timer = setTimeout(function () {
        registrar('colgado', acc, ms, 'sin respuesta en ' + (ms / 1000) + ' s (vigia)');
        res({ success: false, ok: false, _vigia: true, data: [],
              error: 'El servidor tardó demasiado en responder. Revisa tu conexión e intenta nuevamente (no se duplicará).' });
      }, ms);
    });
    return Promise.race([
      p.then(function (r) { clearTimeout(timer); return r; },
             function (e) { clearTimeout(timer); registrar('api_excepcion', acc, null, String((e && e.message) || e)); throw e; }),
      limite
    ]);
  };
  w._rlVigia = true;
  window[nombre] = w;
}
function instalarVigia() {
  if (window._rlVigiaOk) return;
  window._rlVigiaOk = true;
  setTimeout(function () { vigia('apiPost'); vigia('apiGet'); }, 0);
}
if (document.readyState === 'complete') instalarVigia(); else window.addEventListener('load', instalarVigia);

window.rlSalud = { registrar: registrar, enviar: enviar, cola: leerCola };
})();
