/* ═══════════════════════════════════════════════════════════════════════════
   _SUP_AZURE_V1 (24-oct-2026) — SUPERVISORES y MOTIVOS DE CASOS: Azure primero
   · saveSupervisor y addMotivoCaso se guardan directo en la tabla de Azure; en 2do plano
     Google copia la operacion a la hoja y refresca la copia JSON.
   · getSupervisores y getMotivosCasos se leen de la tabla (al instante tras guardar).
   · Huella del envio (client_id): doble clic o reintento no duplican.
   · Azure apagado (503), sin sesion (401) o sin respuesta -> camino de siempre
     (copia JSON mod/… o Google). INTERRUPTOR: SUP_AZURE_PRIMERO = false
     (o supAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SUP_AZURE_PRIMERO = true;
  if (!SUP_AZURE_PRIMERO || window._rlSupAzOk) return;
  var BASE = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/sup/';
  var ESCRIBE = { saveSupervisor: 1, addMotivoCaso: 1 }, LEE = { getSupervisores: 1, getMotivosCasos: 1 };
  var apagadoHasta = 0, enCurso = {};
  function tok() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function activo() { return !!tok() && Date.now() >= apagadoHasta; }
  function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function huella(b) {
    var o = {}; Object.keys(b).sort().forEach(function (k) { if (k !== 'client_id') o[k] = b[k]; });
    var s = JSON.stringify(o); return 'sp-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36);
  }
  function llamar(accion, cuerpo, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
    var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }, body: JSON.stringify(cuerpo) };
    if (ctrl) op.signal = ctrl.signal;
    return fetch(BASE + accion, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
    }, function (e) { clearTimeout(reloj); throw e; });
  }
  function valida(r) { return r && r.status === 200 && r.j && (r.j.success || r.j.error); }
  function decideOtro(r) { return r && (r.status === 503 || r.status === 401 || r.status === 400 || r.status === 403 || r.status === 404); }

  var postPrevio = window.apiPost, getPrevio = window.apiGet;
  if (typeof postPrevio !== 'function' || typeof getPrevio !== 'function') return;
  window._rlSupAzOk = true;

  window.apiPost = function (b) {
    if (!b || !ESCRIBE[b.action] || !activo()) return postPrevio.apply(this, arguments);
    var self = this, args = arguments, clave;
    try { clave = b.client_id || huella(b); } catch (e) { return postPrevio.apply(self, args); }
    if (enCurso[clave]) return enCurso[clave];
    var p = (async function () {
      var cuerpo = {}; Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; }); cuerpo.client_id = clave;
      var r = null;
      for (var intento = 1; intento <= 2; intento++) {
        try { r = await llamar(b.action, cuerpo, 12000); } catch (e) { r = null; }
        if (valida(r) || decideOtro(r)) break;
        if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
      }
      if (valida(r)) {
        if (r.j.success) { try { Promise.resolve(postPrevio.call(self, { action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {} }   /* la hoja y la copia JSON, en 2do plano */
        console.log('[_SUP_AZURE_V1] ' + b.action + ' en Azure' + (r.j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : '') + (r.j.success ? '' : ': ' + r.j.error));
        return r.j;
      }
      if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
      console.warn('[_SUP_AZURE_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se guarda por Google (respaldo)');
      return postPrevio.apply(self, args);
    })();
    enCurso[clave] = p;
    p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
    return p;
  };
  window.apiGet = function (p) {
    if (!p || !LEE[p.action] || !activo()) return getPrevio.apply(this, arguments);
    var self = this, args = arguments;
    return (async function () {
      var r = null;
      try { r = await llamar(p.action, {}, 10000); } catch (e) { r = null; }
      if (valida(r)) return r.j;
      if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
      console.warn('[_SUP_AZURE_V1] ' + p.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> camino de siempre');
      return getPrevio.apply(self, args);
    })();
  };
  try { apiPost = window.apiPost; apiGet = window.apiGet; } catch (e) {}
  console.log('[_SUP_AZURE_V1] listo: supervisores y motivos de casos, Azure primero');
})();
