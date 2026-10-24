/* dashboard.html · bloque 44 (antes en la linea 16396) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CV_AZURE_V1 (26-set-2026) — REGISTRO DE CASOS y VISITAS DE CAMPO desde Azure
   ---------------------------------------------------------------------------
   · getCasos / getVisitas se piden a Azure (POST /api/cv/<accion>) con los
     MISMOS parametros de siempre; Azure responde lo mismo que la hoja.
   · La carga al entrar (preload) ya no lee esas hojas: trae casos y visitas
     de Azure (_cvCompletar).
   · Si Azure no responde (o tarda > 8 s) -> la hoja, como antes.
   · Los guardados NO cambian: siguen por Google, que actualiza Azure en el acto.
   INTERRUPTOR: CV_AZURE_ACTIVO = false -> todo vuelve a la hoja al instante.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var CV_AZURE_ACTIVO = true;
if (window._rlCvAzOk || !CV_AZURE_ACTIVO) return;
window._rlCvAzOk = true;
var ACCIONES = { getCasos: 1, getVisitas: 1 };
var previo = window.apiGet;
if (typeof previo !== 'function' || typeof AZURE_FN_BASE === 'undefined') return;

function azure(p) {
  var cuerpo = {};
  try { new URLSearchParams(p).forEach(function (v, k) { if (k !== 'action') cuerpo[k] = v; }); } catch (e) {}   // mismos valores (texto) que recibe Google
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);   /* _CAIDAS_V3 (15-oct): 8 s cortaba la consulta justo cuando Azure estaba por responder y la pantalla caia a Google (doble carga) */
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/cv/' + p.action, op).then(function (r) {
    return r.json().then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}

window.apiGet = function (p) {
  if (!p || !ACCIONES[p.action]) return previo.apply(this, arguments);
  var self = this, args = arguments;
  return (async function () {
    var r = null;
    try { r = await azure(p); } catch (e) { r = null; }
    if (r && r.status === 200 && r.j && r.j.success && Array.isArray(r.j.data)) return r.j;
    console.warn('[_CV_AZURE_V1] ' + p.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se usa la hoja (respaldo)');
    return previo.apply(self, args);
  })();
};

/* completa la respuesta del preload con casos y visitas (Azure, o la hoja si falla) */
window._cvCompletar = async function (data, p) {
  try {
    var base = { usuario: p.usuario, nombre: p.nombre, rol: p.rol, empresa: p.empresa || '' };
    var r = await Promise.all([
      window.apiGet(Object.assign({ action: 'getCasos' }, base)).catch(function () { return null; }),
      window.apiGet(Object.assign({ action: 'getVisitas' }, base)).catch(function () { return null; })
    ]);
    data.casos   = (r[0] && r[0].success && Array.isArray(r[0].data)) ? r[0].data : (data.casos || []);
    data.visitas = (r[1] && r[1].success && Array.isArray(r[1].data)) ? r[1].data : (data.visitas || []);
  } catch (e) { console.warn('[_CV_AZURE_V1] no se pudieron completar casos/visitas:', e && e.message); }
};
console.log('[_CV_AZURE_V1] listo: Casos y Visitas desde Azure');
})();
