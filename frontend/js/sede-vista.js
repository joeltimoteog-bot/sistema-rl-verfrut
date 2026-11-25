/* ═══════════════════════════════════════════════════════════════════
   sede-vista.js — _SEDE_VISTA_V1 (23-nov-2026, aprobado por Joel) — selector de sede para quien ve las dos sedes
   Quien tiene alcance General (y jtimoteo) puede elegir, dentro del sistema, ver: Ambas · Piura · Olmos.
   · La eleccion vive en la pestaña (sessionStorage.rl_sede_vista = PIURA | OLMOS; vacio = Ambas).
   · Con una sede elegida, cada consulta al servidor lleva la cabecera x-rl-sede y el servidor responde solo esa sede.
     El servidor la obedece UNICAMENTE si el usuario de verdad ve las dos sedes: a un usuario de Piura o de Olmos
     esta cabecera no le cambia nada (no sirve para abrir la otra sede).
   · Sin eleccion (todos los demas usuarios, siempre) este archivo no toca ninguna consulta.
   El selector se dibuja en 68-sede-v1.js. Debe cargarse justo despues de azure-token.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlSedeVista) return; window._rlSedeVista = true;
  var K = 'rl_sede_vista';
  function vista() { try { var v = String(sessionStorage.getItem(K) || '').toUpperCase(); return (v === 'PIURA' || v === 'OLMOS') ? v : ''; } catch (e) { return ''; } }
  /* _SEDE_AT_SEGUN_SEDE_V1 (24-nov-2026, decision final de Joel, opcion A): las ATENCIONES tambien salen de la sede elegida
     (Olmos -> solo Olmos, Piura -> solo Piura, Ambas -> las dos). Lo de "siempre generales" (_SEDE_AT_GENERAL_V1, publicado
     unas horas) queda apagado; solo se enciende a mano en un navegador con localStorage.rl_sede_at_general = 'on'. */
  var SIEMPRE_GENERAL = (function () { var on = false; try { on = localStorage.getItem('rl_sede_at_general') === 'on'; } catch (e) {} return on ? /\/api\/atenciones(\/|\?|$)/ : /^$/; })();
  var f = window.fetch;
  if (typeof f === 'function') {
    var envuelto = function (input, init) {
      try {
        var v = vista();
        if (v && typeof input === 'string' && (input.indexOf('azurewebsites.net/api/') >= 0 || input.indexOf('supabase.co/functions/v1/api') >= 0) && !/\/api\/auth\//.test(input) && !SIEMPRE_GENERAL.test(input)) {
          var i2 = Object.assign({}, init || {}), h = i2.headers;
          if (typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('x-rl-sede', v); }
          else if (Array.isArray(h)) { h = h.concat([['x-rl-sede', v]]); }
          else { h = Object.assign({}, h || {}, { 'x-rl-sede': v }); }
          i2.headers = h;
          return f.call(this, input, i2);
        }
      } catch (e) {}
      return f.apply(this, arguments);
    };
    window.fetch = envuelto;
  }
  window.RLSedeVista = {
    get: vista,
    set: function (v) {
      v = String(v || '').toUpperCase();
      try { if (v === 'PIURA' || v === 'OLMOS') sessionStorage.setItem(K, v); else sessionStorage.removeItem(K); } catch (e) {}
      try { location.reload(); } catch (e) {}
    }
  };
})();
