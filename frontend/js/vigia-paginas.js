/* ═════════════════════════════════════════════════════════════════════════
   vigia-paginas.js — _VIGIA_V1 (02-nov-2026) · Manejadores de tiempo real por página
   Se carga en todas las páginas después de vigia.js. Según la página, registra qué función
   de recarga ejecutar cuando cambia la tabla correspondiente en Azure:
     mantenimiento.html  mant_registro            → cargarAdmin() / cargarMis()
     almuerzos.html      alm_*                    → cargarLista()
     horas.html          horas_*                  → refrescarTrasMutacion() + tab abierto
     inventario.html     inv_*                    → cargarDatos()
     capacitaciones.html cap_*                    → cargarRegistros()
     preaviso.html       preav_registro           → cargarPreavisos()
     evaluacion360.html  e360_* / inf_registro    → cargarEvaluacionesAPI() / cargarInformesGuardados()
     monitor.html        acc_solicitudes/horas_*  → cargarPendientes() / cargarAccesos()
     usuarios.html       acc_solicitudes          → refrescarUs() / cargarUs()
   (dashboard.html tiene su propio módulo: 69-at-vigia-v1.js; cerebro.html ya lee Firebase en vivo).
   Mientras el usuario está escribiendo en un formulario (modal abierto / campo con foco) NO se
   recarga la lista: se espera a que termine, para no borrarle lo que escribe.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var pagina = (location.pathname.split('/').pop() || '').toLowerCase();
  var fn = function (n) { return typeof window[n] === 'function' ? window[n] : null; };
  function escribiendo() {
    try {
      var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'search') return true;
      var m = document.querySelector('.modal.open, .modal.show, .modal[style*="display: flex"], .modal[style*="display:flex"], .modal[style*="display: block"], [role="dialog"]:not([hidden])');
      if (m && getComputedStyle(m).display !== 'none') return true;
    } catch (e) {}
    return false;
  }
  var cola = {};
  function luego(clave, f) {   /* si está escribiendo, reintenta cada 5 s hasta 2 min */
    var n = 0; (function intentar() { if (!escribiendo()) { cola[clave] = null; try { var r = f(); if (r && r.catch) r.catch(function () {}); } catch (e) {} } else if (n++ < 24) cola[clave] = setTimeout(intentar, 5000); })();
  }
  function cuando(claveRe, nombre, f) {
    window.rlVigia.en(claveRe, function (info) {
      if (cola[nombre]) return;
      console.log('[_VIGIA_V1] ' + pagina + ': cambio en ' + info.clave + ' → ' + nombre);
      cola[nombre] = 1; luego(nombre, f);
      try { if (typeof mostrarToast === 'function' && localStorage.getItem('rl_vigia_toast') !== 'off') mostrarToast('🔄 Datos actualizados'); } catch (e) {}
    });
  }
  function registrar() {
    var reg = 0;
    if (/^mantenimiento/.test(pagina)) { cuando('mant_registro', 'mantenimiento', function () { var a = fn('cargarAdmin'), m = fn('cargarMis'); if (a) a(); if (m) m(); }); reg++; }
    if (/^almuerzos/.test(pagina) && fn('cargarLista')) { cuando(/^alm_/, 'almuerzos', function () { return window.cargarLista(); }); reg++; }
    if (/^horas/.test(pagina)) { cuando(/^horas_/, 'horas', function () { var r = fn('refrescarTrasMutacion'); var p = r ? r() : null;
        var tab = document.querySelector('.tab.active, .tab.on, [data-tab].active'); var id = tab ? (tab.dataset.tab || tab.id || '') : '';
        return Promise.resolve(p).then(function () { if (/general/i.test(id) && fn('cargarResumenGeneral')) return window.cargarResumenGeneral(); if (/aprob/i.test(id) && fn('cargarAprobaciones')) return window.cargarAprobaciones(); if (/usuario/i.test(id) && fn('cargarPorUsuario')) return window.cargarPorUsuario(); }); }); reg++; }
    if (/^inventario/.test(pagina) && fn('cargarDatos')) { cuando(/^inv_/, 'inventario', function () { return window.cargarDatos(); }); reg++; }
    if (/^capacitaciones/.test(pagina) && fn('cargarRegistros')) { cuando(/^cap_/, 'capacitaciones', function () { return window.cargarRegistros(); }); reg++; }
    if (/^preaviso/.test(pagina) && fn('cargarPreavisos')) { cuando('preav_registro', 'preavisos', function () { return window.cargarPreavisos(); }); reg++; }
    if (/^evaluacion360/.test(pagina)) { cuando(/^(e360_|inf_registro)/, 'evaluacion360', function () { var a = fn('cargarEvaluacionesAPI'), b = fn('cargarInformesGuardados'); if (a) a(); if (b) b(); }); reg++; }
    if (/^monitor/.test(pagina)) { cuando(/^(acc_solicitudes|horas_)/, 'monitor', function () { var a = fn('cargarPendientes'), b = fn('cargarAccesos'); if (a) a(); if (b) b(); }); reg++; }
    if (/^usuarios/.test(pagina)) { cuando('acc_solicitudes', 'usuarios', function () { var r = fn('refrescarUs') || fn('cargarUs'); if (r) return r(); }); reg++; }
    console.log('[_VIGIA_V1] ' + pagina + ': ' + reg + ' manejador(es) de tiempo real');
  }
  var n = 0; (function esperar() { if (window.rlVigia && window.rlVigia._v1 && document.readyState !== 'loading') registrar(); else if (n++ < 60) setTimeout(esperar, 250); })();
})();
