/* dashboard.html · bloque 37 (antes en la linea 15810) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ATGUARDA_V1 (23-set-2026) — ninguna atencion se pierde ni se duplica
   ---------------------------------------------------------------------------
   Solo actua sobre saveAtencion (Nueva Atencion). Todo lo demas pasa igual.
   1) A cada envio le agrega client_id = huella del contenido del formulario.
      El servidor (saveAtencionIdem_) usa esa huella para no crear dos filas
      con la misma atencion (doble clic, reintento, corte a mitad).
   2) Si el envio falla por conexion, la atencion queda en este equipo
      (localStorage rl_at_pendientes) y se reenvia sola cada 45 s o cuando
      vuelve internet. Se ve un aviso "⏳ N atencion(es) pendiente(s)".
      Al enviarse: aviso ✅, sincroniza Azure y refresca la lista.
   3) El reenvio va directo al servidor con el MISMO contenido guardado
      (incluido el parentesco), sin volver a leer el formulario.
   Para revertir: borrar este bloque (el servidor sigue funcionando igual).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var COLA = 'rl_at_pendientes', FALLIDAS = 'rl_at_fallidas';

function h32(s, seed) {
  var h = seed >>> 0;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function huella(b) {
  var o = {};
  Object.keys(b).sort().forEach(function (k) { if (k !== 'action' && k !== 'client_id' && k !== 'parentesco') o[k] = b[k]; });
  var s = JSON.stringify(o);
  return 'at-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36);
}
function usuarioActual() {
  try { if (typeof USER !== 'undefined' && USER && USER.usuario) return String(USER.usuario); } catch (e) {}
  try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); if (u && u.usuario) return String(u.usuario); } catch (e) {}
  return '';
}
function leer(k) { try { return JSON.parse(localStorage.getItem(k || COLA) || '[]') || []; } catch (e) { return []; } }
function guardar(c, k) { try { localStorage.setItem(k || COLA, JSON.stringify(c)); } catch (e) {} }
function quitar(id) { if (!id) return; guardar(leer().filter(function (x) { return x.id !== id; })); pintar(); }
function encolar(b) {
  try {
    var copia = JSON.parse(JSON.stringify(b));
    var c = leer().filter(function (x) { return x.id !== copia.client_id; });
    c.push({ id: copia.client_id, u: usuarioActual(), ts: Date.now(), nombre: copia.nombre || '', body: copia });
    guardar(c);
    try { if (window.rlSalud) rlSalud.registrar('atencion_en_cola', 'saveAtencion', null, 'guardada en el equipo para reenvio'); } catch (e) {}
  } catch (e) {}
  pintar();
}

/* ── 1) Envoltorio de apiPost (solo saveAtencion) ── */
function envolver() {
  var prev = window.apiPost;
  if (typeof prev !== 'function' || prev._atGuarda || window._rlAtGuardaOk) return;   /* _FIX_CICLO_24SET: instalar UNA sola vez */
  window._rlAtGuardaOk = true;
  var w = function (b) {
    if (!b || b.action !== 'saveAtencion') return prev.apply(this, arguments);
    try { if (!b.client_id) b.client_id = huella(b); } catch (e) {}
    var self = this, args = arguments;
    var aCola = function (r) {
      encolar(b);
      return Object.assign({}, r || {}, { success: false, _enCola: true,
        error: (r && r.enCurso) ? r.error :
          'Sin conexión con el servidor. La atención quedó guardada en este equipo y se enviará sola apenas vuelva la conexión (aviso ⏳ abajo a la izquierda). No la registres de nuevo.' });
    };
    return Promise.resolve().then(function () { return prev.apply(self, args); }).then(function (r) {
      if (r && r.success) { quitar(b.client_id); return r; }
      if (r && (r._redError || r.enCurso)) return aCola(r);
      return r;
    }, function (err) { return aCola({ detalle: String(err && err.message || err) }); });
  };
  w._atGuarda = true;
  window.apiPost = w;
}
envolver();
window.addEventListener('load', envolver);

/* ── 2) Reenvio directo al servidor ── */
function urlApi() {
  try { if (typeof API !== 'undefined' && API && String(API).trim()) return API; } catch (e) {}
  try { return API_URL_DEFAULT; } catch (e) { return ''; }
}
function postDirecto(body, ms) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms || 60000);
  var op = { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' } };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(urlApi(), op)
    .then(function (r) { return r.text(); })
    .then(function (t) { clearTimeout(reloj); try { return JSON.parse(t); } catch (e) { return { _red: true }; } },
          function () { clearTimeout(reloj); return { _red: true }; });
}
var procesando = false;
function reintentar() {
  if (procesando || navigator.onLine === false) return;
  var u = usuarioActual();
  if (!u) return;
  var mios = leer().filter(function (x) { return x.u === u; });
  if (!mios.length) { pintar(); return; }
  procesando = true;
  var item = mios[0];
  pintar('⏳ Enviando atención pendiente...');
  postDirecto(item.body, 90000).then(function (r) {
    if (r && r.success) {
      quitar(item.id);
      try { mostrarToast('✅ Se envió la atención pendiente de ' + (item.nombre || 'trabajador') + (r.nro ? ' (N° ' + r.nro + ')' : '')); } catch (e) {}
      if (!r.duplicadoEvitado || r.nro) {
        var s = Object.assign({}, item.body, { action: 'syncFirebaseAtencion', nro: r.nro });
        delete s.client_id;
        if (!s.fecha_atencion) s.fecha_atencion = new Date().toISOString().slice(0, 10);
        postDirecto(s, 60000);
      }
      try { if (typeof refrescarEnBackground === 'function') setTimeout(refrescarEnBackground, 1500); } catch (e) {}
      setTimeout(reintentar, 2000);          // la siguiente, si hay
    } else if (r && (r._red || r._redError || r.enCurso)) {
      /* sigue sin conexion: se reintenta en el proximo ciclo */
    } else {
      /* el servidor la rechazo (no es problema de conexion): no se reintenta mas */
      quitar(item.id);
      var f = leer(FALLIDAS); f.push(Object.assign({}, item, { error: (r && r.error) || 'desconocido' })); guardar(f.slice(-20), FALLIDAS);
      var msg = 'No se pudo enviar la atención pendiente de ' + (item.nombre || 'trabajador') + ' (DNI ' + (item.body.dni || '') + ').\n\n' +
                'Motivo: ' + ((r && r.error) || 'desconocido') + '\n\nPor favor regístrala nuevamente.';
      try { if (typeof appAlert === 'function') appAlert(msg); else alert(msg); } catch (e) {}
      try { if (window.rlSalud) rlSalud.registrar('atencion_rechazada', 'saveAtencion', null, (r && r.error) || ''); } catch (e) {}
    }
  }).then(function () { procesando = false; pintar(); }, function () { procesando = false; pintar(); });
}

/* ── 3) Aviso visible ── */
function pintar(texto) {
  try {
    var u = usuarioActual();
    var n = leer().filter(function (x) { return x.u === u; }).length;
    var el = document.getElementById('rlAtPend');
    if (!n) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'rlAtPend';
      el.title = 'Clic para reintentar ahora';
      el.style.cssText = 'position:fixed;left:16px;bottom:16px;background:#f59e0b;color:#111;padding:9px 14px;border-radius:20px;font:700 13px system-ui,sans-serif;z-index:99997;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer';
      el.onclick = function () { reintentar(); };
      document.body.appendChild(el);
    }
    el.textContent = texto || ('⏳ ' + n + (n === 1 ? ' atención pendiente' : ' atenciones pendientes') + ' de envío · clic para reintentar');
    el.style.display = 'block';
  } catch (e) {}
}
window.addEventListener('online', function () { setTimeout(reintentar, 2000); });
setInterval(reintentar, 45000);
setTimeout(reintentar, 8000);
setTimeout(pintar, 3000);
window.rlAtPendientes = { ver: function () { return leer(); }, fallidas: function () { return leer(FALLIDAS); }, reintentar: reintentar };
console.log('[_ATGUARDA_V1] activo');
})();
