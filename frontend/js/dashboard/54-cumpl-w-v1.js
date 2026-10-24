/* dashboard.html · bloque 54 (antes en la linea 17031) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CUMPL_W_V1 (27-set-2026) — CUMPLIMIENTO: justificar, cambiar plazos y levantar restriccion primero en Azure
   · Van directo a las tablas de Azure (usuario y rol salen del login firmado). En 2do plano
     Google copia a la hoja (justificaciones, restricciones, plazos, historial y el caso).
   · Azure manda: su respuesta (tambien un "no") es la definitiva.
   · Huella del formulario (client_id): doble clic o reintento no duplican.
   · Azure apagado (503), sin sesion (401) o sin respuesta -> Google, como siempre.
   INTERRUPTOR: CUMPL_AZURE_PRIMERO = false  (o cumplAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var CUMPL_AZURE_PRIMERO = true;
  if (!CUMPL_AZURE_PRIMERO || window._rlCumplWOk) return;
  window._rlCumplWOk = true;
  var BASE = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/cumpl/guardar/';
  var ACCIONES = { cumplJustificar: 1, cumplConfigGuardar: 1, cumplRestriccionLevantar: 1 };
  function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function huella(b) { var s = JSON.stringify(b); return 'cw-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36); }
  var previo = window.apiPost, enCurso = {}, apagadoHasta = 0;
  if (typeof previo !== 'function') return;
  window.apiPost = function (b) {
    var tk = null;
    try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
    if (!b || !ACCIONES[b.action] || !tk || Date.now() < apagadoHasta) return previo.apply(this, arguments);
    var self = this, args = arguments, clave;
    try { clave = huella(b); } catch (e) { return previo.apply(self, args); }
    if (enCurso[clave]) return enCurso[clave];
    var p = (async function () {
      var cuerpo = {}; Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
      cuerpo.client_id = clave;
      var r = null;
      for (var intento = 1; intento <= 2; intento++) {
        var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 20000);
        try {
          var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo) };
          if (ctrl) op.signal = ctrl.signal;
          var resp = await fetch(BASE + b.action, op);
          r = { status: resp.status, j: await resp.json().catch(function () { return null; }) };
        } catch (e) { r = null; }
        clearTimeout(reloj);
        if (r && r.status === 200 && r.j) break;
        if (r && [400, 401, 403, 404, 503].indexOf(r.status) >= 0) break;
        if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
      }
      if (r && r.status === 200 && r.j) {
        if (r.j.success) { try { Promise.resolve(previo.call(self, { action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {} }
        console.log('[_CUMPL_W_V1] ' + b.action + ' en Azure: ' + (r.j.success ? 'guardado' : 'rechazado (' + r.j.error + ')') + (r.j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : ''));
        return r.j;
      }
      if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
      console.warn('[_CUMPL_W_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se guarda por Google (respaldo)');
      return previo.apply(self, args);
    })();
    enCurso[clave] = p;
    p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
    return p;
  };
  try { apiPost = window.apiPost; } catch (e) {}
  console.log('[_CUMPL_W_V1] listo: escrituras de Cumplimiento primero en Azure');
})();
