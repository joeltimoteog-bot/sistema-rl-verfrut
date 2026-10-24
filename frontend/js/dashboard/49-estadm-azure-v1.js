/* dashboard.html · bloque 49 (antes en la linea 16716) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* _ESTADM_AZURE_V1 (26-set-2026) — Estadisticas Admin (getEstadisticasAdmin) calculadas en Azure: mismos filtros y
   mismo formato. Atenciones salen de la base de Azure (sin las copias que Google contaba dos veces).
   Si Azure no responde (8 s) o da error -> Google, como siempre. INTERRUPTOR: ESTADM_AZURE_ACTIVO */
(function () {
  var ESTADM_AZURE_ACTIVO = true;
  if (!ESTADM_AZURE_ACTIVO || window._rlEstAdmOk) return;
  window._rlEstAdmOk = true;
  var URL_AZ = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/mod/estadm/getEstadisticasAdmin';
  var previo = window.apiGet;
  if (typeof previo !== 'function') return;
  window.apiGet = function (p) {
    if (!p || p.action !== 'getEstadisticasAdmin') return previo.apply(this, arguments);
    var self = this, args = arguments;
    return (async function () {
      var cuerpo = {}; Object.keys(p).forEach(function (k) { if (k !== 'action') cuerpo[k] = p[k]; });
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);   /* _CAIDAS_V3 (15-oct): 8 s cortaba la consulta justo cuando Azure estaba por responder y la pantalla caia a Google (doble carga) */
      try {
        var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
        if (ctrl) op.signal = ctrl.signal;
        var r = await fetch(URL_AZ, op);
        var j = await r.json();
        clearTimeout(reloj);
        if (r.status === 200 && j && j.success && j.data) return j;
        console.warn('[_ESTADM_AZURE_V1] Azure HTTP ' + r.status + ' -> Google (respaldo)');
      } catch (e) { clearTimeout(reloj); console.warn('[_ESTADM_AZURE_V1] Azure sin respuesta -> Google (respaldo)'); }
      return previo.apply(self, args);
    })();
  };
  try { apiGet = window.apiGet; } catch (e) {}
  console.log('[_ESTADM_AZURE_V1] listo: Estadisticas Admin desde Azure');
})();
