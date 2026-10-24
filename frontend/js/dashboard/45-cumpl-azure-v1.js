/* dashboard.html · bloque 45 (antes en la linea 16456) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CUMPL_AZURE_V1 (26-set-2026) — CONTROL DE CUMPLIMIENTO desde Azure
   ---------------------------------------------------------------------------
   · cumplPendientes (campana y bloqueo), cumplPanel (panel del coordinador) y
     getCumplimiento (aviso del dashboard) se piden a Azure: mismo calculo que
     Google, pero en milisegundos y sin gastar la cuota de Google en cada ingreso.
   · Si Azure no responde (o tarda > 8 s, o responde con error) -> Google, como antes.
   · Justificar, levantar restriccion y cambiar plazos siguen por Google, que
     actualiza Azure en el mismo guardado.
   INTERRUPTOR: CUMPL_AZURE_ACTIVO = false -> todo vuelve a Google al instante.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var CUMPL_AZURE_ACTIVO = true;
if (window._rlCumplAzOk || !CUMPL_AZURE_ACTIVO) return;
window._rlCumplAzOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
var POST = { cumplPendientes: 1, cumplPanel: 1 }, GET = { getCumplimiento: 1 };

function azure(accion, cuerpo) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);   /* _CAIDAS_V3 (15-oct): 8 s cortaba la consulta justo cuando Azure estaba por responder y la pantalla caia a Google (doble carga) */
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/cumpl/' + accion, op).then(function (r) {
    return r.json().then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}
function envolver(nombre, acciones) {
  var previo = window[nombre];
  if (typeof previo !== 'function' || previo._cumplAz) return;
  var w = function (b) {
    var accion = b && b.action;
    if (!acciones[accion]) return previo.apply(this, arguments);
    var self = this, args = arguments;
    return (async function () {
      var cuerpo = {};
      Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
      var r = null;
      try { r = await azure(accion, cuerpo); } catch (e) { r = null; }
      if (r && r.status === 200 && r.j && r.j.success) return r.j;
      console.warn('[_CUMPL_AZURE_V1] ' + accion + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se usa Google (respaldo)');
      return previo.apply(self, args);
    })();
  };
  w._cumplAz = true;
  window[nombre] = w;
}
envolver('apiPost', POST);
envolver('apiGet', GET);
console.log('[_CUMPL_AZURE_V1] listo: Control de Cumplimiento desde Azure');
})();
