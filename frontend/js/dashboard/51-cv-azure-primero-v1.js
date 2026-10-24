/* dashboard.html · bloque 51 (antes en la linea 16836) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CV_AZURE_PRIMERO_V1 (26-set-2026) — CASOS y VISITAS se guardan primero en Azure
   · Registrar, editar y eliminar casos y visitas va directo a las tablas de Azure
     (N° al instante, sin repetir). En 2do plano Google copia la operacion a la hoja
     (mismo N°): cumplimiento, contadores, alertas y correos siguen igual.
   · Huella del formulario (client_id): doble clic o reintento no duplican nada.
   · Azure apagado (503), sin sesion (401), no encuentra el registro (404) o no
     contesta (2 intentos) -> se guarda por Google como siempre.
   INTERRUPTOR: CV_AZURE_PRIMERO = false  (o cvAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var CV_AZURE_PRIMERO = true;
if (window._rlCvAzPrimOk || !CV_AZURE_PRIMERO) return;
window._rlCvAzPrimOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
try { if (typeof RED_SILENCIOSAS !== 'undefined' && RED_SILENCIOSAS.indexOf('cvAplicarDesdeAzure') < 0) RED_SILENCIOSAS.push('cvAplicarDesdeAzure'); } catch (e) {}
var ACCIONES = { saveCaso: 1, updateCaso: 1, eliminarCaso: 1, saveVisita: 1, updateVisita: 1, eliminarVisita: 1 };
function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function huella(b) {
  var o = {};
  Object.keys(b).sort().forEach(function (k) { if (k !== 'client_id') o[k] = b[k]; });
  var s = JSON.stringify(o);
  return 'cv-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36);
}
function azure(b, clave, ms) {
  var cuerpo = {};
  Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
  cuerpo.client_id = clave;
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/cv/guardar/' + b.action, op).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}
var enCurso = {}, apagadoHasta = 0;
var previo = window.apiPost;
if (typeof previo !== 'function') return;
window.apiPost = function (b) {
  var sinSesion = true;
  try { sinSesion = !sessionStorage.getItem('rl_token'); } catch (e) {}
  if (!b || !ACCIONES[b.action] || sinSesion || Date.now() < apagadoHasta) return previo.apply(this, arguments);
  var self = this, args = arguments, clave;
  try { clave = b.client_id || huella(b); } catch (e) { return previo.apply(self, args); }
  if (enCurso[clave]) return enCurso[clave];
  var p = (async function () {
    var r = null;
    for (var intento = 1; intento <= 2; intento++) {
      try { r = await azure(b, clave, 12000); } catch (e) { r = null; }
      if (r && r.status === 200 && r.j && r.j.success) break;
      if (r && (r.status === 503 || r.status === 401 || r.status === 400 || r.status === 403 || r.status === 404)) break;   // decide Google, sin reintentar
      if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
    }
    if (r && r.status === 200 && r.j && r.j.success) {
      try { Promise.resolve(previo.call(self, { action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {}   // la hoja, en 2do plano
      console.log('[_CV_AZURE_PRIMERO_V1] ' + b.action + ' guardado en Azure' + (r.j.nro ? ' N° ' + r.j.nro : '') + (r.j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : ''));
      return r.j;
    }
    if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
    console.warn('[_CV_AZURE_PRIMERO_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se guarda por Google (respaldo)');
    return previo.apply(self, args);
  })();
  enCurso[clave] = p;
  p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
  return p;
};
try { apiPost = window.apiPost; } catch (e) {}
console.log('[_CV_AZURE_PRIMERO_V1] listo: Casos y Visitas se guardan primero en Azure');
})();
