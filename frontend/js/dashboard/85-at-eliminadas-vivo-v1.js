/* ═══════════════════════════════════════════════════════════════════════════
   85-at-eliminadas-vivo-v1.js — _AT_ELIMINADAS_VIVO_V1 (12-nov-2026)
   Lo que UN usuario elimina desaparece tambien de la pantalla de LOS DEMAS.
   ---------------------------------------------------------------------------
   EL PROBLEMA: al eliminar una atencion, quien la eliminaba dejaba de verla, pero los demas la seguian
   viendo hasta recargar la pagina. La actualizacion en vivo solo traia altas y cambios (se fusiona por
   N°: agrega o actualiza), nunca bajas; y la copia guardada en el equipo la volvia a mostrar.
   LO QUE HACE:
   · El servidor publica una marca de bajas (vigia 'at_eliminadas') y la lista corta de lo eliminado en
     los ultimos 45 dias (/atenciones/eliminadas: solo id, N° y DNI).
   · Cuando la marca cambia (se revisa cada 60 s con la pestaña visible), al abrir el sistema y al volver
     a la pestaña, esta pantalla quita esas atenciones de sus listas y de su copia local, y repinta.
   · Tambien las anota en la lista de eliminadas del equipo (_ELIMINADAS_V1), por N° + DNI.
   No toca el nucleo. Si el servidor no responde, no pasa nada (queda como antes).
   Apagar: localStorage.rl_at_elim_vivo = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_at_elim_vivo') === 'off') return; } catch (e) {}
  if (window._rlAtElimVivoOk) return; window._rlAtElimVivoOk = true;
  if (typeof AZURE_FN_BASE === 'undefined') return;
  var enCurso = false, ultima = 0, anotadas = {};
  var sinCeros = function (d) { return String(d == null ? '' : d).trim().replace(/^0+/, ''); };

  function quitarDe(lista, ids, pares) {
    if (!Array.isArray(lista) || !lista.length) return lista;
    return lista.filter(function (a) {
      if (!a) return true;
      if (a.id != null && ids[String(a.id)]) return false;
      return !pares[String(a.nro) + '|' + sinCeros(a.dni)];
    });
  }
  function aplicar(elim) {
    var ids = {}, pares = {}, n = 0;
    (elim || []).forEach(function (x) {
      if (x.id != null) ids[String(x.id)] = 1;
      if (x.nro != null && x.dni) {
        pares[String(x.nro) + '|' + sinCeros(x.dni)] = 1;
        /* lista de eliminadas del equipo: clave N°|DNI tal como llega en las atenciones (asi no oculta otro registro con el mismo N°) */
        var k = String(x.nro) + '|' + String(x.dni).trim();
        if (!anotadas[k]) { anotadas[k] = 1; try { if (typeof window._marcarEliminadaSilencio === 'function') window._marcarEliminadaSilencio(k); } catch (e) {} }
      }
    });
    if (!Object.keys(ids).length && !Object.keys(pares).length) return 0;
    var cuenta = function (antes, despues) { if (Array.isArray(antes) && Array.isArray(despues)) n += antes.length - despues.length; return despues; };
    try { if (typeof atTodas !== 'undefined' && Array.isArray(atTodas)) atTodas = cuenta(atTodas, quitarDe(atTodas, ids, pares)); } catch (e) {}
    try { if (typeof CACHE !== 'undefined' && CACHE) {
      if (Array.isArray(CACHE.atenciones)) CACHE.atenciones = quitarDe(CACHE.atenciones, ids, pares);
      if (Array.isArray(CACHE.historialAtenciones)) CACHE.historialAtenciones = quitarDe(CACHE.historialAtenciones, ids, pares);
    } } catch (e) {}
    try { if (Array.isArray(window._atFiltradas)) window._atFiltradas = quitarDe(window._atFiltradas, ids, pares); } catch (e) {}
    if (n > 0) {
      try { if (typeof renderAt === 'function' && typeof atTodas !== 'undefined') renderAt(atTodas); } catch (e) {}
      try { if (typeof cargarStats === 'function') cargarStats(); } catch (e) {}
      try { if (typeof guardarCacheLS === 'function') guardarCacheLS(); } catch (e) {}
      try { if (typeof mostrarToast === 'function') mostrarToast('🔄 Se quit' + (n === 1 ? 'ó 1 atención eliminada' : 'aron ' + n + ' atenciones eliminadas') + ' por otro usuario'); } catch (e) {}
      console.log('[_AT_ELIMINADAS_VIVO_V1] ' + n + ' atencion(es) eliminada(s) por otro usuario se quitaron de esta pantalla');
    }
    return n;
  }
  function revisar(motivo) {
    if (enCurso) return; var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    if (!tk) return;
    enCurso = true; ultima = Date.now();
    fetch(AZURE_FN_BASE + '/atenciones/eliminadas', { headers: { Authorization: 'Bearer ' + tk } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.success) aplicar(j.eliminadas); })
      .catch(function () {}).then(function () { enCurso = false; });
  }
  window.rlAtEliminadasVivo = { revisar: function () { revisar('manual'); }, aplicar: aplicar };

  /* anotar en la lista del equipo sin vaciar memorias ni escribir en consola por cada una */
  try {
    var LS = 'rl_at_eliminadas_v1';
    window._marcarEliminadaSilencio = function (k) {
      try { var o = JSON.parse(localStorage.getItem(LS) || '{}') || {}; if (o[k]) return; o[k] = Date.now(); localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {}
    };
  } catch (e) {}

  /* cuando el vigia ve que cambio la marca de bajas */
  var n = 0; (function esperar() {
    if (window.rlVigia && window.rlVigia._v1) { window.rlVigia.en('at_eliminadas', function () { revisar('vigia'); }); return; }
    if (n++ < 40) setTimeout(esperar, 250);
  })();
  setTimeout(function () { revisar('inicio'); }, 7000);                         /* al abrir: limpia la copia guardada en el equipo */
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - ultima > 120000) revisar('al volver'); });
  /* las listas se cargan tarde o se recargan desde la copia local: una pasada mas, ya con todo en memoria */
  setTimeout(function () { revisar('carga'); }, 25000);
  console.log('[_AT_ELIMINADAS_VIVO_V1] listo');
})();
