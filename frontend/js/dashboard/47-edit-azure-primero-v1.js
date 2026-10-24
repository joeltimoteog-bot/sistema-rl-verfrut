/* dashboard.html · bloque 47 (antes en la linea 16594) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _EDIT_AZURE_PRIMERO_V1 (01-oct-2026) — EDITAR ATENCION: primero en Azure
   ---------------------------------------------------------------------------
   · updateAtencion va a Azure (/atenciones/editar): ~1 s en vez de ~18 s por Google.
   · En 2do plano se copia el mismo cambio a la hoja ('updateAtencionDesdeAzure');
     si falla se reintenta 2 veces y queda en LOG_ERRORES ('edicion_hoja_fallo').
   · Sin permiso (403 de Azure) -> se muestra el aviso, igual que Google.
   · Azure apagado (503), sin sesion (401), no esta en Azure (404), N° ambiguo (409),
     dato malo (400) o no contesta (2 intentos de 8 s) -> se edita por Google como siempre.
   INTERRUPTOR: EDIT_AZURE_PRIMERO = false  (o AtConfig 'azure_editar' = '0' en Azure).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var EDIT_AZURE_PRIMERO = true;
if (window._rlEditAzPrimOk || !EDIT_AZURE_PRIMERO) return;
window._rlEditAzPrimOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
try { if (typeof RED_SILENCIOSAS !== 'undefined' && RED_SILENCIOSAS.indexOf('updateAtencionDesdeAzure') < 0) RED_SILENCIOSAS.push('updateAtencionDesdeAzure'); } catch (e) {}
var previo = window.apiPost;
if (typeof previo !== 'function') return;
var enCurso = {}, apagadoHasta = 0;

function azure(cuerpo, ms) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/atenciones/editar', op).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}
/* copia a la hoja (respaldo), en 2do plano: el usuario no espera */
function hoja(b, intento) {
  var fila = Object.assign({}, b, { action: 'updateAtencionDesdeAzure' });
  Promise.resolve(previo.call(window, fila)).then(function (r) {
    if (!(r && r.success)) throw new Error((r && r.error) || 'sin respuesta');
  }).catch(function (e) {
    if (intento < 3) { setTimeout(function () { hoja(b, intento + 1); }, 20000); return; }
    console.warn('[_EDIT_AZURE_PRIMERO_V1] la hoja no tomo la edicion del N° ' + b.nro + ': ' + (e && e.message));
    try { if (window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('edicion_hoja_fallo', 'google:updateAtencionDesdeAzure', 0, 'N° ' + b.nro + ': ' + String(e && e.message).slice(0, 120)); } catch (e2) {}
  });
}

window.apiPost = function (b) {
  var sinSesion = true;
  try { sinSesion = !sessionStorage.getItem('rl_token'); } catch (e) {}
  if (!b || b.action !== 'updateAtencion' || !b.nro || sinSesion || Date.now() < apagadoHasta) return previo.apply(this, arguments);
  var self = this, args = arguments, clave;
  /* parentesco: misma regla que el envoltorio del formulario (solo el formulario completo lo trae) */
  if (b.autorizado_por !== undefined) {
    try {
      var sel = document.getElementById('at_parentesco');
      var obl = typeof window._parentescoObligatorio === 'function' && window._parentescoObligatorio(b.detalle_documento || '');
      b.parentesco = obl ? String((sel && sel.value) || '') : '';
    } catch (e) {}
  }
  try { clave = JSON.stringify(b); } catch (e) { return previo.apply(self, args); }
  if (enCurso[clave]) return enCurso[clave];   /* doble clic -> 1 solo envio */
  var p = (async function () {
    var cuerpo = {}, r = null, _t0 = Date.now(), intento;
    Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
    for (intento = 1; intento <= 2; intento++) {
      try { r = await azure(cuerpo, 8000); } catch (e) { r = null; }
      if (r && r.status === 200 && r.j && r.j.success) break;
      if (r && [400, 401, 403, 404, 409, 503].indexOf(r.status) >= 0) break;   // decide sin reintentar
      if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
    }
    var ms = Date.now() - _t0;
    if (r && r.status === 200 && r.j && r.j.success) {
      hoja(b, 1);
      console.log('[_EDIT_AZURE_PRIMERO_V1] N° ' + b.nro + ' editada en Azure en ' + ms + ' ms');
      try { if (ms > 2500 && window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('guardado_lento', 'azure:atenciones/editar', ms, 'intentos ' + intento); } catch (e) {}
      return { success: true, nro: b.nro, fuente: 'azure', ms: ms };
    }
    if (r && r.status === 403 && r.j && /permiso/i.test(String(r.j.error || ''))) return { success: false, error: r.j.error };
    if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
    console.warn('[_EDIT_AZURE_PRIMERO_V1] Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se edita por Google (respaldo)');
    return previo.apply(self, args);
  })();
  enCurso[clave] = p;
  p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
  return p;
};
console.log('[_EDIT_AZURE_PRIMERO_V1] listo: Editar atencion va primero a Azure');
})();
