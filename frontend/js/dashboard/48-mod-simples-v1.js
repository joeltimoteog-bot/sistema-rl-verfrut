/* dashboard.html · bloque 48 (antes en la linea 16681) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* _MOD_SIMPLES_V1 (26-set-2026) — Fusiones, Solicitudes de edicion y Motivos de casos: la consulta sale de Azure (la misma respuesta
   que Google). Los guardados siguen por Google, que actualiza Azure al guardar.
   Si Azure no responde (8 s) o da error -> Google, como siempre. INTERRUPTOR: MOD_SIMPLES_ACTIVO */
(function () {
  var MOD_SIMPLES_ACTIVO = true;
  if (!MOD_SIMPLES_ACTIVO || window._rlModSimpOk) return;
  window._rlModSimpOk = true;
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api/mod/';
  var MODULO = { getFusiones: 'fus', getSolicitudes: 'sol', getMotivosCasos: 'casosaux', getSupervisores: 'sup', getSolicitudesAcceso: 'acc', listarSolicitudesMantenimiento: 'mant', getResponsablesEnRango: 'resp' };   /* _PRELOAD_AZURE_V1: + Supervisores (antes ~22 s por Google) · _DASH_AZURE_V1 (05-oct): + accesos temporales y mantenimiento (Azure solo si es la fuente al dia; si no, Google) · _RESP_AZURE_V1 (06-oct): + lista de responsables de Consulta (Google tardaba hasta 90 s) */
  var previo = window.apiGet;
  if (typeof previo !== 'function') return;
  window.apiGet = function (p) {
    if (!p || !MODULO[p.action]) return previo.apply(this, arguments);
    var self = this, args = arguments;
    return (async function () {
      var cuerpo = {}; Object.keys(p).forEach(function (k) { if (k !== 'action') cuerpo[k] = p[k]; });
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);   /* _CAIDAS_V3 (15-oct): 8 s cortaba la consulta justo cuando Azure estaba por responder y la pantalla caia a Google (doble carga) */
      try {
        var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
        if (ctrl) op.signal = ctrl.signal;
        var r = await fetch(BASE + MODULO[p.action] + '/' + p.action, op);
        var j = await r.json();
        clearTimeout(reloj);
        if (r.status === 200 && j && (j.success || j.ok)) return j;
        console.warn('[_MOD_SIMPLES_V1] ' + p.action + ': Azure HTTP ' + r.status + ' -> Google (respaldo)');
      } catch (e) { clearTimeout(reloj); console.warn('[_MOD_SIMPLES_V1] ' + p.action + ': Azure sin respuesta -> Google (respaldo)'); }
      return previo.apply(self, args);
    })();
  };
  try { apiGet = window.apiGet; } catch (e) {}
  console.log('[_MOD_SIMPLES_V1] listo: Fusiones, Solicitudes de edicion y Motivos de casos desde Azure');
})();
