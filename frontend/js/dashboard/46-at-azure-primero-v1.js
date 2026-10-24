/* dashboard.html · bloque 46 (antes en la linea 16510) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _AT_AZURE_PRIMERO_V1 (26-set-2026) — NUEVA ATENCION: se guarda primero en Azure
   ---------------------------------------------------------------------------
   · saveAtencion va a Azure (/atenciones/guardar): N° al instante y sin repetir.
   · En 2do plano se pide a Google escribir la misma atencion (mismo N°) en la hoja.
   · La huella del formulario (client_id) evita duplicados por doble clic o reintento.
   · Si Azure esta apagado (503), sin sesion (401), rechaza el dato (400) o no
     contesta (2 intentos) -> se guarda por Google como siempre, con la MISMA
     huella (Google pregunta a Azure si ya entro antes de dar otro N°).
   INTERRUPTOR: AT_AZURE_PRIMERO = false  (o apagarlo desde el Apps Script con
   atAzurePrimeroApagar(), sin publicar nada).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var AT_AZURE_PRIMERO = true;
if (window._rlAtAzPrimOk || !AT_AZURE_PRIMERO) return;
window._rlAtAzPrimOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
try { if (typeof RED_SILENCIOSAS !== 'undefined' && RED_SILENCIOSAS.indexOf('saveAtencionDesdeAzure') < 0) RED_SILENCIOSAS.push('saveAtencionDesdeAzure'); } catch (e) {}

/* misma huella que _ATGUARDA_V1 */
function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function huella(b) {
  var o = {};
  Object.keys(b).sort().forEach(function (k) { if (k !== 'action' && k !== 'client_id' && k !== 'parentesco') o[k] = b[k]; });
  var s = JSON.stringify(o);
  return 'at-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36);
}
function azure(b, clave, ms) {
  var cuerpo = {};
  Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
  cuerpo.client_id = clave;
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/atenciones/guardar', op).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}
var enCurso = {}, apagadoHasta = 0;
var previo = window.apiPost;
if (typeof previo !== 'function') return;
window.apiPost = function (b) {
  var sinSesion = true;
  try { sinSesion = !sessionStorage.getItem('rl_token'); } catch (e) {}
  if (!b || b.action !== 'saveAtencion' || sinSesion || Date.now() < apagadoHasta) return previo.apply(this, arguments);
  var self = this, args = arguments, clave;
  try { clave = b.client_id || huella(b); } catch (e) { return previo.apply(self, args); }
  if (enCurso[clave]) return enCurso[clave];
  var p = (async function () {
    var r = null, _t0 = Date.now();
    for (var intento = 1; intento <= 2; intento++) {
      try { r = await azure(b, clave, 8000); } catch (e) { r = null; }   /* _GUARDAR_RAPIDO_V1 (01-oct): 8 s por intento (antes 12) */
      if (r && r.status === 200 && r.j && r.j.success && r.j.nro) break;
      if (r && (r.status === 503 || r.status === 401 || r.status === 400 || r.status === 404)) break;   // decide Google, sin reintentar
      if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
    }
    if (r && r.status === 200 && r.j && r.j.success && r.j.nro) {
      var j = r.j;
      try {
        var fila = Object.assign({}, b, { action: 'saveAtencionDesdeAzure', nro: j.nro, fecha_atencion: j.fecha_atencion || b.fecha_atencion,
          hora_inicio: j.hora_inicio || b.hora_inicio, estado: j.estado || b.estado, parentesco: j.parentesco, nro_licencia: j.nro_licencia });
        delete fila.client_id;
        Promise.resolve(previo.call(self, fila)).catch(function () {});   // la hoja, en 2do plano (la red de seguridad cubre si falla)
      } catch (e) {}
      console.log('[_AT_AZURE_PRIMERO_V1] guardada en Azure N° ' + j.nro + (j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : '') + ' en ' + (Date.now() - _t0) + ' ms');
      /* _GUARDAR_RAPIDO_V1: los guardados de mas de 2,5 s quedan en LOG_ERRORES (saludHoy muestra cuanto tarda guardar) */
      try { var _ms = Date.now() - _t0; if (_ms > 2500 && window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('guardado_lento', 'azure:atenciones/guardar', _ms, 'intentos ' + intento); } catch (e) {}
      return j;
    }
    if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
    console.warn('[_AT_AZURE_PRIMERO_V1] Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se guarda por Google (respaldo)');
    b.client_id = clave;
    return previo.apply(self, args);
  })();
  enCurso[clave] = p;
  p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
  return p;
};
console.log('[_AT_AZURE_PRIMERO_V1] listo: Nueva Atencion se guarda primero en Azure');
})();
