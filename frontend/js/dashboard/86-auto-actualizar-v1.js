/* ═══════════════════════════════════════════════════════════════════════════
   86-auto-actualizar-v1.js — _AUTO_ACTUALIZAR_V1 / V2 (12-nov-2026)
   El sistema se actualiza SOLO cuando se publica una version nueva: el usuario ya no tiene
   que pulsar Ctrl + Shift + R.
   ---------------------------------------------------------------------------
   COMO SABE QUE HAY VERSION NUEVA (sin tocar nada al publicar):
   · Cada 5 minutos (pestaña visible) pregunta al sitio por la cabecera de esta misma pagina
     (peticion HEAD: unos bytes). Si cambio, baja la pagina y compara la lista de archivos
     <script src="...?v=N"> con los que ESTA pestaña tiene cargados. Si la pagina publicada
     pide algun archivo/version que aqui no esta -> hay version nueva.
   · Tambien revisa a los 30 s de abrir y al volver a la pestaña.
   CUANDO SE ACTUALIZA (nunca corta un registro a medias):
   · Solo si NO hay ningun formulario abierto, el usuario no esta escribiendo en un campo y
     lleva 45 s sin tocar la pantalla, o la pestaña esta en segundo plano.
   · Mientras tanto muestra un aviso con el boton "Actualizar ahora".
   · Lo que estuviera en la cola de envio (atenciones pendientes) no se pierde: vive en el equipo.
   SEGUROS:
   · Como maximo UNA recarga automatica por version y por pestaña (si tras recargar el navegador
     siguiera sirviendo la pagina vieja, no entra en bucle: deja el aviso con el boton).
   · Si el sitio no responde, no hace nada.
   Apagar en un equipo: localStorage.rl_auto_act = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_auto_act') === 'off') return; } catch (e) {}
  if (window._rlAutoActOk) return; window._rlAutoActOk = true;
  if (!/^https?:$/.test(location.protocol)) return;
  var PAG = location.origin + location.pathname;
  var K_HECHO = 'rl_auto_act_hecho', K_OK = 'rl_auto_act_ok';
  var etag = null, firma = '', pendiente = false, enCurso = false, ultimaActividad = Date.now(), ultimaRevision = Date.now();

  var conVersion = function (s) { return /[?&]v=[^&]+/.test(s || ''); };
  function srcsDe(doc) { return Array.prototype.slice.call(doc.querySelectorAll('script[src]')).map(function (s) { return s.getAttribute('src') || ''; }).filter(conVersion); }
  /* lo que ESTA pestaña cargo. _AUTO_ACTUALIZAR_V2 (12-nov): se toma cuando la pagina TERMINO de leerse.
     Antes se tomaba al ejecutarse este archivo, y los <script> que van DESPUES de el en la pagina todavia
     no existian: se contaban como "nuevos" y el aviso de version nueva salia siempre. */
  var mios = null;
  function tomarMios() { if (mios) return; var m = {}; srcsDe(document).forEach(function (s) { m[s] = 1; }); mios = m; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tomarMios); else tomarMios();

  function sinCache(metodo) { return fetch(PAG, { method: metodo, cache: 'no-store', credentials: 'same-origin' }); }
  async function comparar() {
    if (!mios) return false;   /* la pagina aun no termina de cargar */
    var r = await sinCache('GET'); if (!r.ok) return false;
    var e = r.headers.get('etag') || r.headers.get('last-modified'); if (e) etag = e;
    var doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    var nuevos = srcsDe(doc).filter(function (s) { return !mios[s]; });
    if (!nuevos.length) { pendiente = false; firma = ''; return false; }
    firma = nuevos.sort().join('|').slice(0, 1500); pendiente = true;
    return true;
  }
  async function revisar(motivo) {
    if (enCurso || document.visibilityState !== 'visible' && motivo !== 'inicio') return;
    enCurso = true; ultimaRevision = Date.now();
    try {
      if (motivo !== 'inicio' && etag) {           /* liviano: solo la cabecera */
        var h = await sinCache('HEAD');
        var e = h.ok ? (h.headers.get('etag') || h.headers.get('last-modified')) : null;
        if (!h.ok || (e && e === etag)) return;     /* nada cambio en el sitio */
      }
      if (await comparar()) { console.log('[_AUTO_ACTUALIZAR_V1] hay una version nueva publicada (' + motivo + ')'); avisar(); intentar(); }
    } catch (x) { /* sin conexion: se vuelve a intentar en la siguiente vuelta */ }
    finally { enCurso = false; }
  }

  /* ── cuando es seguro recargar ── */
  function ocupado() {
    try {
      if (document.querySelector('.ov.on')) return true;                                  /* hay un formulario / ventana abierta */
      var a = document.activeElement, t = a && a.tagName;
      if (a && (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || a.isContentEditable)) return true;   /* esta escribiendo */
    } catch (e) {}
    return false;
  }
  function yaIntentada() { try { return sessionStorage.getItem(K_HECHO) === firma; } catch (e) { return false; } }
  function recargar(manual) {
    try { sessionStorage.setItem(K_HECHO, firma); sessionStorage.setItem(K_OK, '1'); } catch (e) {}
    /* primero se refresca la copia de la pagina en el navegador; luego se recarga */
    var ir = function () { if (typeof window._rlAutoActRecargar === 'function') return window._rlAutoActRecargar(); location.reload(); };   /* (el gancho solo lo usan las pruebas) */
    try { fetch(PAG, { cache: 'reload', credentials: 'same-origin' }).then(ir, ir); } catch (e) { ir(); }
  }
  function intentar() {
    if (!pendiente || yaIntentada()) return;
    if (ocupado()) return;
    var quieto = Date.now() - ultimaActividad >= 45000;
    if (document.visibilityState !== 'visible' || quieto) recargar(false);
  }

  /* ── aviso ── */
  function avisar() {
    if (document.getElementById('rlAutoAct')) return;
    var d = document.createElement('div'); d.id = 'rlAutoAct'; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;right:16px;bottom:86px;z-index:99990;background:#0b1e45;color:#fff;padding:10px 14px;border-radius:12px;font:600 12.5px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28);display:flex;gap:10px;align-items:center;max-width:340px;line-height:1.35';
    var t = document.createElement('span'); t.textContent = yaIntentada() ? 'Hay una versión nueva del sistema.' : 'Hay una versión nueva del sistema. Se actualizará sola cuando no estés registrando.';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Actualizar ahora';
    b.style.cssText = 'flex:none;background:#fff;color:#0b1e45;border:0;border-radius:8px;padding:7px 10px;font:700 12px system-ui,sans-serif;cursor:pointer';
    b.onclick = function () {
      if (document.querySelector('.ov.on') && !confirm('Tienes un formulario abierto. Si actualizas ahora se cerrará sin guardar. ¿Actualizar de todos modos?')) return;
      recargar(true);
    };
    d.appendChild(t); d.appendChild(b); document.body.appendChild(d);
  }

  /* ── arranque ── */
  ['keydown', 'pointerdown', 'input', 'scroll'].forEach(function (ev) { window.addEventListener(ev, function () { ultimaActividad = Date.now(); }, { passive: true, capture: true }); });
  try {   /* recien actualizado: confirmar al usuario */
    if (sessionStorage.getItem(K_OK) === '1') { sessionStorage.removeItem(K_OK);
      setTimeout(function () { try { if (typeof mostrarToast === 'function') mostrarToast('✅ Sistema actualizado a la última versión'); } catch (e) {} }, 2500); }
  } catch (e) {}
  setTimeout(function () { revisar('inicio'); }, 30000);
  setInterval(function () { if (pendiente) intentar(); else if (Date.now() - ultimaRevision >= 5 * 60000) revisar('reloj'); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { if (!pendiente && Date.now() - ultimaRevision >= 60000) revisar('al volver'); }
    else if (pendiente) intentar();   /* se fue a otra pestaña: buen momento */
  });
  window.rlAutoActualizar = { revisar: function () { return revisar('manual'); }, estado: function () { return { pendiente: pendiente, firma: firma, etag: etag, ocupado: ocupado(), yaIntentada: pendiente && yaIntentada() }; } };
  console.log('[_AUTO_ACTUALIZAR_V1] listo: revisa cada 5 min si hay una version nueva');
})();
