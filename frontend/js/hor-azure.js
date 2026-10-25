/* ═══════════════════════════════════════════════════════════════════════════
   _HOR_AZURE_V1 (24-oct-2026) — HORARIOS DE JORNADA (Horas / Monitor): Azure primero
   · horariosGuardar y horariosEliminar van directo a la tabla de Azure (la misma que usa el calculo
     de Horas); en 2do plano Google copia a la hoja HORARIOS JORNADA. horariosListar se lee de la tabla.
   · Engancha window.apiPost (Horas) y window.post (Monitor). Huella del envio: sin duplicados.
   · Azure apagado (503), sin sesion (401) o sin respuesta -> Google, como siempre.
   INTERRUPTOR: HOR_AZURE_PRIMERO = false  (o horAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HOR_AZURE_PRIMERO = true;
  if (!HOR_AZURE_PRIMERO || window._rlHorAzOk) return;
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api/hor/';
  var ACCIONES = { horariosListar: 1, horariosGuardar: 1, horariosEliminar: 1 };
  var apagadoHasta = 0, enCurso = {};
  function tok() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function activo() { return !!tok() && Date.now() >= apagadoHasta; }
  function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function huella(b) { var o = {}; Object.keys(b).sort().forEach(function (k) { if (k !== 'client_id') o[k] = b[k]; }); var s = JSON.stringify(o); return 'hr-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36); }
  function llamar(accion, cuerpo, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
    var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }, body: JSON.stringify(cuerpo) };
    if (ctrl) op.signal = ctrl.signal;
    return fetch(BASE + accion, op).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; }); }, function (e) { clearTimeout(reloj); throw e; });
  }
  function valida(r) { return r && r.status === 200 && r.j && (r.j.success || r.j.error); }
  function decideOtro(r) { return r && (r.status === 503 || r.status === 401 || r.status === 400 || r.status === 403 || r.status === 404); }
  function envolver(previo) {
    return function (b) {
      if (!b || !ACCIONES[b.action] || !activo()) return previo.apply(this, arguments);
      var self = this, args = arguments, lee = b.action === 'horariosListar', clave;
      try { clave = lee ? 'listar' : (b.client_id || huella(b)); } catch (e) { return previo.apply(self, args); }
      if (!lee && enCurso[clave]) return enCurso[clave];
      var p = (async function () {
        var cuerpo = {}; Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; }); if (!lee) cuerpo.client_id = clave;
        var r = null;
        for (var intento = 1; intento <= (lee ? 1 : 2); intento++) {
          try { r = await llamar(b.action, cuerpo, lee ? 10000 : 12000); } catch (e) { r = null; }
          if (valida(r) || decideOtro(r)) break;
          if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
        }
        if (valida(r)) {
          if (!lee && r.j.success) { try { Promise.resolve(previo.call(self, { action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {} }
          if (!lee) console.log('[_HOR_AZURE_V1] ' + b.action + ' en Azure' + (r.j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : '') + (r.j.success ? '' : ': ' + r.j.error));
          return r.j;
        }
        if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
        console.warn('[_HOR_AZURE_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> Google (respaldo)');
        return previo.apply(self, args);
      })();
      if (!lee) { enCurso[clave] = p; p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; }); }
      return p;
    };
  }
  var n = 0;
  if (typeof window.apiPost === 'function') { window.apiPost = envolver(window.apiPost); try { apiPost = window.apiPost; } catch (e) {} n++; }
  if (typeof window.post === 'function') { window.post = envolver(window.post); try { post = window.post; } catch (e) {} n++; }
  if (!n) return;
  window._rlHorAzOk = true;
  console.log('[_HOR_AZURE_V1] listo: horarios de jornada, Azure primero');
})();
