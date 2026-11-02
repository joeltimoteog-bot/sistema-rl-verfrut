/* ═════════════════════════════════════════════════════════════════════════
   _AT_VIGIA_V1 (02-nov-2026) — Tiempo real en el dashboard (usa ../js/vigia.js)
   ---------------------------------------------------------------------------
   Problema: cuando otro usuario registraba algo, las pantallas no se actualizaban hasta recargar.
   El aviso de atenciones dependía de Firebase ← Apps Script con 3–30 s de retardo, y los demás
   módulos no tenían aviso alguno. Ahora vigia.js detecta en ≤15 s cualquier cambio en Azure y
   este módulo refresca SOLO lo que cambió:
     atenciones            → refrescarAtencionesHoy (trae solo lo que cambió) + contador "hoy" exacto
     tablas_casos/visitas  → refrescarEnBackground + re-render de la sección si está abierta
     sol_edicion / acc_solicitudes → lista de solicitudes (si está abierta) + badge
     fus_buses             → fusiones (si está abierta)
     mant_registro         → badge de mantenimiento
     cumpl_* / e360        → banner de cumplimiento y recordatorio 360
   Firebase sigue avisando por si llega antes. INTERRUPTOR: localStorage.rl_vigia = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlAtVigiaOk) return; window._rlAtVigiaOk = true;
  function listo() { return window.rlVigia && window.rlVigia._v1; }
  function abierta(id) { var s = document.getElementById('sec-' + id); return !!(s && s.classList.contains('on')); }
  function toast(m) { try { if (typeof mostrarToast === 'function' && localStorage.getItem('rl_vigia_toast') !== 'off') mostrarToast(m); } catch (e) {} }
  var _bg = null;
  function fondo() { if (_bg) return _bg; _bg = Promise.resolve(typeof refrescarEnBackground === 'function' ? refrescarEnBackground() : null).catch(function () {}).then(function () { _bg = null; }); return _bg; }

  function registrar() {
    var V = window.rlVigia;
    /* contador "Atenciones hoy" siempre exacto (las estadísticas de Azure se cachean 5 min) */
    window.addEventListener('rl:vigia', function (e) {
      try { var eH = document.getElementById('sH'), h = e.detail && e.detail.hoy; if (eH && h != null && String(eH.textContent).trim() !== String(h)) eH.textContent = h; } catch (x) {}
    });
    V.en('atenciones', async function () {
      try {
        if (typeof refrescarAtencionesHoy === 'function') { var r = await refrescarAtencionesHoy('vigia'); if (r !== false) toast('🔄 Atenciones actualizadas'); }
        else if (typeof cargarAtenciones === 'function') await cargarAtenciones(true);
      } catch (e) { console.warn('[_AT_VIGIA_V1] atenciones:', e); }
    });
    V.en(/^tablas_(casos|visitas)$/, async function (info) {
      try {
        await fondo();
        if (info.clave === 'tablas_casos' && abierta('casos') && typeof cargarCasosSilencioso === 'function') { await cargarCasosSilencioso(); toast('🔄 Casos actualizados'); }
        if (info.clave === 'tablas_visitas' && abierta('visitas')) { try { CACHE.visitas = null; } catch (e) {} if (typeof cargarVisitas === 'function') { await cargarVisitas(); toast('🔄 Visitas actualizadas'); } }
      } catch (e) { console.warn('[_AT_VIGIA_V1] ' + info.clave + ':', e); }
    });
    V.en(/^(sol_edicion|acc_solicitudes)$/, async function () {
      try { if (typeof cargarBadgeSolicitudes === 'function') cargarBadgeSolicitudes(); if (abierta('solicitudes') && typeof cargarSolicitudes === 'function') { await cargarSolicitudes(); toast('🔄 Solicitudes actualizadas'); } } catch (e) {}
    });
    V.en('fus_buses', async function () {
      try { if (abierta('fusiones') && typeof cargarFusiones === 'function') { await cargarFusiones(true); toast('🔄 Fusiones actualizadas'); } } catch (e) {}
    });
    V.en('mant_registro', function () { try { if (typeof cargarBadgeMantenimiento === 'function') cargarBadgeMantenimiento(); } catch (e) {} });
    V.en(/^(cumpl_|e360_)/, function () {
      try { if (typeof cargarAlertaCumplimiento === 'function') cargarAlertaCumplimiento(); } catch (e) {}
      try { if (window._cumplUiRefrescar) window._cumplUiRefrescar('vigia'); } catch (e) {}
    });
    V.en(/^(usuarios|acc_solicitudes)$/, function () { try { if (abierta('usuarios') && typeof cargarUs === 'function') cargarUs(); } catch (e) {} });
    /* lo guardado en esta misma pestaña ya está en pantalla: no hace falta re-pedirlo */
    var previo = window.apiPost;
    if (typeof previo === 'function') {
      window.apiPost = function (b) {
        var p = previo.apply(this, arguments);
        try { if (b && /^(save|update|delete|eliminar|guardar|crear|anular)/i.test(b.action || '')) Promise.resolve(p).then(function () { setTimeout(function () { V.olvidar(); V.revisar(); }, 2500); }).catch(function () {}); } catch (e) {}
        return p;
      };
    }
    console.log('[_AT_VIGIA_V1] manejadores del dashboard registrados');
  }
  var n = 0; (function esperar() { if (listo()) registrar(); else if (n++ < 40) setTimeout(esperar, 250); else console.warn('[_AT_VIGIA_V1] vigia.js no cargó'); })();
})();
