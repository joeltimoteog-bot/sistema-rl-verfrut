/* ═══════════════════════════════════════════════════════════════════════════
   _ACTUALIZAR_V3 (15-oct-2026) — aviso y actualizacion automatica del sistema (unico)
   ---------------------------------------------------------------------------
   Antes convivian 3 mecanismos (sw controllerchange que recargaba solo, salud.js con HEAD
   y presencia.js con version.json que nunca cambiaba) y el boton "Actualizar" solo hacia
   location.reload(): a veces quedaba la version vieja (copias del Service Worker) o la
   pagina se recargaba sola a mitad de un trabajo. Ahora hay UNO solo:

   1) FUENTE DE VERDAD: version.json (la publicacion lo genera sola con cada git push).
      Se consulta cada 3 min y al volver a la pestaña. Nunca falla la pagina si no existe.
   2) AVISO: barra abajo al centro "Nueva version disponible" con [Actualizar ahora] [Mas tarde].
   3) AUTOMATICO: en el login/hub se aplica sola al instante; en las pantallas de trabajo se
      aplica sola cuando es SEGURO: sin formulario abierto, sin texto a medio escribir y
      5 min sin actividad (muestra cuenta regresiva de 10 s que se puede cancelar).
   4) APLICAR BIEN: borra las copias del Service Worker, pide el SW nuevo, marca la version y
      recarga. Una sola vez por version (sin bucles). Si la red esta lenta, es una carga normal.
   Los avisos antiguos (salud.js / presencia.js / toast del SW) quedan neutralizados aqui.
   Para desactivar: quitar el <script src=".../actualizar.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ACTUALIZAR_V3) return;
  window._ACTUALIZAR_V3 = true;
  window.__RL_ACTUALIZACION_V1__ = true;   /* apaga el aviso de presencia.js (si carga despues) */

  var BASE = '/sistema-rl-verfrut', URL_VERSION = BASE + '/version.json';
  var CADA_MS = 3 * 60000, POSPONER_MS = 20 * 60000, INACTIVO_MS = 5 * 60000, CUENTA_S = 10;
  var K_CARGADA = 'rl_ver_cargada', K_INTENTO = 'rl_ver_intento';
  var esLogin = /\/index\.html$|\/sistema-rl-verfrut\/?$/.test(location.pathname) || location.pathname === '/';
  var nueva = null, pospuestoHasta = 0, ultActividad = Date.now(), cuentaT = null, aplicando = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* ── neutralizar mecanismos antiguos ── */
  function neutralizar() {
    try { ss('rl_sw_recarga', String(Date.now())); } catch (e) {}   /* el controllerchange viejo no recarga solo */
    try {
      ['rlAvisoVersion', '_rlAvisoActualizacion', 'toast-update'].forEach(function (id) { var el = document.getElementById(id); if (el) { el.remove(); revisar(); } });
    } catch (e) {}
  }
  setInterval(neutralizar, 60000);
  try { new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes; for (var j = 0; j < a.length; j++) { var n = a[j]; if (n.nodeType === 1 && /^(rlAvisoVersion|_rlAvisoActualizacion|toast-update)$/.test(n.id || '')) { n.remove(); revisar(); } } } }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}

  /* ── estilos ── */
  var CSS = '\
#rlUpd{position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:2147483600;background:#0f172a;color:#f1f5f9;border:1px solid rgba(255,255,255,.12);border-left:4px solid #22c55e;border-radius:14px;padding:12px 14px 12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 16px 40px rgba(0,0,0,.45);font:600 13px Barlow,"Segoe UI",system-ui,sans-serif;max-width:min(560px,calc(100vw - 24px));transition:opacity .3s,transform .3s}\
#rlUpd.on{opacity:1;transform:translateX(-50%) translateY(0)}\
#rlUpd .ic{width:34px;height:34px;border-radius:10px;background:rgba(34,197,94,.18);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}\
#rlUpd .tx{flex:1;min-width:0;line-height:1.35}\
#rlUpd .tx b{color:#86efac}\
#rlUpd .tx small{display:block;color:#94a3b8;font-weight:500;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#rlUpd button{border:none;border-radius:9px;padding:8px 13px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap}\
#rlUpd .ya{background:#22c55e;color:#052e16}#rlUpd .ya:hover{background:#4ade80}\
#rlUpd .luego{background:#334155;color:#f1f5f9}\
#rlUpd .bar{position:absolute;left:0;bottom:0;height:3px;background:#22c55e;width:0;border-radius:0 0 0 14px;transition:width 1s linear}\
#rlUpdVelo{position:fixed;inset:0;z-index:2147483601;background:rgba(5,12,30,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;color:#fff;font:700 15px Barlow,"Segoe UI",sans-serif;flex-direction:column;gap:12px}\
#rlUpdVelo .sp{width:34px;height:34px;border:4px solid rgba(255,255,255,.2);border-top-color:#22c55e;border-radius:50%;animation:rlUpdSpin .8s linear infinite}\
@keyframes rlUpdSpin{to{transform:rotate(360deg)}}\
@media(max-width:520px){#rlUpd{flex-wrap:wrap}#rlUpd .tx{flex-basis:100%}}';
  try { var st = document.createElement('style'); st.id = 'rlUpdCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  /* ── leer version ── */
  function leer() {
    return fetch(URL_VERSION + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  var revisando = false;
  function revisar() {
    if (revisando || aplicando) return;
    revisando = true;
    leer().then(function (info) {
      revisando = false;
      if (!info || !info.version) return;
      var v = String(info.version), cargada = ss(K_CARGADA);
      if (!cargada) { ss(K_CARGADA, v); return; }          /* primera lectura en esta pestaña = la version que tengo */
      if (cargada === v) { if (nueva) { nueva = null; ocultar(); } return; }
      if (ss(K_INTENTO) === v) return;                      /* ya se aplico esta version en esta pestaña: no insistir */
      nueva = info;
      decidir();
    }).catch(function () { revisando = false; });
  }

  /* ── seguro para recargar? ── */
  function escribiendo() {
    try { var ae = document.activeElement; return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && String(ae.value || '').length > 0 && ae.type !== 'search'); } catch (e) { return false; }
  }
  function formularioAbierto() {
    try {
      if (document.querySelector('.ov.on, .appmsys-overlay, #permOverlay[style*="flex"], #ac3Ov.on')) return true;
      var hay = false;
      document.querySelectorAll('input:not([type=hidden]):not([type=search]):not([readonly]), textarea').forEach(function (i) { if (!hay && i.offsetParent !== null && String(i.value || '').trim() && !i.closest('.filtros, #uiAtBar, .tools')) hay = true; });
      return hay;
    } catch (e) { return false; }
  }
  function seguro() { return !escribiendo() && !formularioAbierto() && (Date.now() - ultActividad) > INACTIVO_MS; }
  ['keydown', 'mousedown', 'touchstart', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { ultActividad = Date.now(); }, { passive: true, capture: true }); });

  function decidir() {
    if (!nueva) return;
    if (esLogin && !escribiendo()) { aplicar('login'); return; }
    mostrar();
    if (Date.now() < pospuestoHasta) return;
    if (seguro()) cuentaRegresiva();
  }
  setInterval(function () { if (nueva && !aplicando && !cuentaT && Date.now() >= pospuestoHasta && seguro()) cuentaRegresiva(); }, 30000);

  /* ── aviso ── */
  function mostrar() {
    var el = document.getElementById('rlUpd');
    if (!el) {
      el = document.createElement('div'); el.id = 'rlUpd';
      el.innerHTML = '<div class="ic">🔄</div><div class="tx"><span id="rlUpdT"></span><small id="rlUpdS"></small></div><button class="ya" id="rlUpdYa">Actualizar ahora</button><button class="luego" id="rlUpdLuego">Más tarde</button><span class="bar" id="rlUpdBar"></span>';
      (document.body || document.documentElement).appendChild(el);
      el.querySelector('#rlUpdYa').onclick = function () { aplicar('boton'); };
      el.querySelector('#rlUpdLuego').onclick = function () { pospuestoHasta = Date.now() + POSPONER_MS; cancelarCuenta(); ocultar(); };
      requestAnimationFrame(function () { el.classList.add('on'); });
    } else el.classList.add('on');
    var t = document.getElementById('rlUpdT'), s = document.getElementById('rlUpdS');
    if (t) t.innerHTML = '<b>Nueva versión disponible</b> · ' + esc(nueva.version) + (nueva.fecha ? ' · ' + esc(nueva.fecha) : '');
    if (s) s.textContent = nueva.titulo || nueva.notas || 'Se aplicará sola cuando no estés escribiendo, o pulsa Actualizar ahora.';
  }
  function ocultar() { var el = document.getElementById('rlUpd'); if (el) el.classList.remove('on'); }
  function cuentaRegresiva() {
    if (cuentaT || aplicando) return;
    mostrar();
    var n = CUENTA_S, s = document.getElementById('rlUpdS'), bar = document.getElementById('rlUpdBar');
    function tick() {
      if (!seguro() || Date.now() < pospuestoHasta) { cancelarCuenta(); if (s) s.textContent = nueva && (nueva.titulo || '') || ''; return; }
      if (s) s.textContent = 'Se actualiza en ' + n + ' s… (mueve el mouse o pulsa "Más tarde" para esperar)';
      if (bar) bar.style.width = Math.round((CUENTA_S - n) / CUENTA_S * 100) + '%';
      if (n-- <= 0) { cancelarCuenta(); aplicar('auto'); return; }
      cuentaT = setTimeout(tick, 1000);
    }
    tick();
  }
  function cancelarCuenta() { if (cuentaT) { clearTimeout(cuentaT); cuentaT = null; } var bar = document.getElementById('rlUpdBar'); if (bar) bar.style.width = '0'; }

  /* ── aplicar la actualizacion de verdad ── */
  function aplicar(motivo) {
    if (aplicando) return;
    aplicando = true; cancelarCuenta();
    var v = nueva ? String(nueva.version) : String(Date.now());
    ss(K_INTENTO, v); ss(K_CARGADA, v); ss('rl_sw_recarga', String(Date.now()));
    try { var velo = document.createElement('div'); velo.id = 'rlUpdVelo'; velo.innerHTML = '<div class="sp"></div><div>Actualizando el sistema…</div><div style="font-weight:500;font-size:12.5px;opacity:.8">Versión ' + esc(v) + '</div>'; document.body.appendChild(velo); } catch (e) {}
    var pasos = [];
    /* 1) borrar copias del Service Worker (asi no puede volver la version vieja) */
    pasos.push(new Promise(function (res) { try { if (!('caches' in window)) return res(); caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /^sistema-rl-/.test(k); }).map(function (k) { return caches.delete(k); })); }).then(res, res); } catch (e) { res(); } }));
    /* 2) pedir el SW nuevo y activarlo */
    pasos.push(new Promise(function (res) { try { if (!('serviceWorker' in navigator)) return res(); navigator.serviceWorker.getRegistration(BASE + '/').then(function (reg) { if (!reg) return res(); var p = reg.update().catch(function () {}); setTimeout(function () { try { if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {} res(); }, 800); }, res); } catch (e) { res(); } }));
    var limite = new Promise(function (res) { setTimeout(res, 4000); });
    Promise.race([Promise.all(pasos), limite]).then(function () {
      try { console.log('[_ACTUALIZAR_V3] recargando (' + motivo + ') -> ' + v); } catch (e) {}
      try { var u = new URL(location.href); u.searchParams.set('v', v); location.replace(u.toString()); }
      catch (e) { location.reload(); }
    });
  }

  /* ── arranque ── */
  function iniciar() {
    neutralizar();
    setTimeout(revisar, esLogin ? 1500 : 6000);
    setInterval(revisar, CADA_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) revisar(); });
    /* si llega un SW nuevo (sw.js cambio), tambien revisamos la version */
    try { if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', function () { ss('rl_sw_recarga', String(Date.now())); setTimeout(revisar, 1500); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.rlActualizar = { revisar: revisar, aplicar: function () { if (!nueva) nueva = { version: 'manual' }; aplicar('manual'); }, estado: function () { return { cargada: ss(K_CARGADA), nueva: nueva, segura: seguro() }; } };
  console.log('[_ACTUALIZAR_V3] listo');
})();
