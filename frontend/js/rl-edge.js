/* ═══════════════════════════════════════════════════════════════════════════
   rl-edge.js — _EDGE_V1 (05-nov-2026) — Enrutador para los sistemas que llaman
   al servidor del Sistema RR.LL. (Capacitaciones ETI, Evaluacion ETI...).
   Toda llamada a https://rl-fn-verfrut.azurewebsites.net/api/... se atiende en
   Supabase (Edge Function "api", el MISMO codigo). Si Supabase no responde
   (red, 502/503/504/546 o ruta no disponible) se repite la MISMA llamada en Azure.
   Tras 3 fallas seguidas usa solo Azure por 5 minutos.
   Apagar: localStorage.rl_edge = 'off'. Cargar ANTES que los demas scripts.
   (El Sistema RR.LL. tiene la misma logica dentro de azure-token.js.)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlEdgeOk || window._rlAzTokenOk || typeof window.fetch !== 'function') return;   /* azure-token.js ya lo hace */
  window._rlEdgeOk = true;
  var fOrig = window.fetch;
  var MARCA = 'azurewebsites.net/api/';
  var EDGE = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/';
  /* _EDGE_REGION_V1 (05-nov): el servidor de Supabase se ejecuta en Sao Paulo, junto a la base (antes corria en otra region:
     cada consulta tardaba 230-1200 ms en el servidor; en Sao Paulo 6-60 ms) */
  function rg(u) { var i = u.indexOf('#'), h = i >= 0 ? u.slice(i) : ''; if (i >= 0) u = u.slice(0, i); return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'forceFunctionRegion=sa-east-1' + h; }
  /* lo que NO pasa a Supabase: rutas con llave de funcion (mantenimiento, importaciones, sync, lote) */
  var SOLO_AZURE = /^(?!)/;   /* _EDGE_TODO_SUPABASE_V1 (06-nov): como azure-token.js (fase 3), Supabase atiende TODAS las rutas, tambien mantenimiento, importaciones y sync (con la misma llave). Antes: /^(mantenimiento\/|[\w-]+-importar|trabajadores\/sync|usuarios\/sync|atenciones\/batch)/ */
  var activo = true;
  try { var me = localStorage.getItem('rl_edge'); if (me === 'off') activo = false; } catch (e) {}
  var fallas = 0;
  function pausado() { return false; /* _SIN_AZURE_V1 (10-nov-2026): Azure se apaga el 12-nov; ya no hay respaldo al que ir (igual que azure-token.js) */ }
  function pausadoViejo_() { try { return Date.now() < +(sessionStorage.getItem('rl_edge_pausa') || 0); } catch (e) { return false; } }
  function falla(m) {
    fallas++;
    try { console.warn('[_EDGE_V1] Supabase no respondio (' + m + ')'); } catch (e) {}
    if (fallas >= 3) { fallas = 0; try { sessionStorage.setItem('rl_edge_pausa', String(Date.now() + 5 * 60000)); } catch (e) {} }
  }
  window.fetch = function (input, init) {
    try {
      if (typeof input !== 'string' || input.indexOf(MARCA) < 0 || !activo || pausado()) return fOrig.apply(this, arguments);
      if (init && init.body && typeof init.body !== 'string') return fOrig.apply(this, arguments);
      var ruta = input.split(MARCA)[1] || '';
      var metodo = String((init && init.method) || 'GET').toUpperCase();
      if (SOLO_AZURE.test(ruta)) return fOrig.apply(this, arguments);   /* _EDGE_TODO_SUPABASE_V1: POST /atenciones tambien va a Supabase */
      var url = input;
      return fOrig.call(window, rg(EDGE + ruta), init).then(function (r) {
        if ([502, 503, 504, 546].indexOf(r.status) >= 0 || (r.status === 404 && r.headers.get('x-rl-edge') === 'sin-ruta')) { falla('HTTP ' + r.status); return r; }   /* _SIN_AZURE_V1: no se reintenta en Azure; la pantalla muestra su propio aviso */
        fallas = 0; return r;
      }, function (e) {
        if (init && init.signal && init.signal.aborted) throw e;
        falla(e && e.message); throw e;   /* _SIN_AZURE_V1: sin respaldo a Azure */
      });
    } catch (e) { return fOrig.apply(this, arguments); }
  };
  window.rlEdge = { activo: function () { return activo && !pausado(); }, base: EDGE };
})();
