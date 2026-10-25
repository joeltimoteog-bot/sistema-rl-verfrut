/* ═══════════════════════════════════════════════════════════════════════════
   _PREAV_AZURE_V1 (21-oct-2026) — CARTAS DE PREAVISO se guardan primero en Azure
   · Registrar, desenlace y apelacion van directo a la tabla de Azure (N° al instante,
     sin repetir). En 2do plano Google copia la operacion a BD_Preavisos (mismo N°) y,
     en la apelacion, envia el correo de siempre.
   · La lista se lee de Azure (mas rapido); si Azure no responde, de Google.
   · Huella del formulario (client_id): doble clic o reintento no duplican.
   · Azure apagado (503), sin sesion (401) o sin respuesta -> Google, como siempre.
   INTERRUPTOR: PREAV_AZURE_PRIMERO = false  (o preavAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PREAV_AZURE_PRIMERO = true;
  if (window.rlPreavAzure) return;
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api/preav/';
  var ESCRIBE = { savePreaviso: 1, updatePreavisoDesenlace: 1, registrarApelacionPreaviso: 1 };
  var apagadoHasta = 0, enCurso = {};
  function tok() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function activo() { return PREAV_AZURE_PRIMERO && !!tok() && Date.now() >= apagadoHasta; }
  function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function huella(b) {
    var o = {}; Object.keys(b).sort().forEach(function (k) { if (k !== 'client_id') o[k] = b[k]; });
    var s = JSON.stringify(o); return 'pv-' + h32(s, 2166136261) + h32(s, 5381) + '-' + s.length.toString(36);
  }
  function llamar(accion, cuerpo, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
    var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
    if (ctrl) op.signal = ctrl.signal;
    return fetch(BASE + accion, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
    }, function (e) { clearTimeout(reloj); throw e; });
  }
  function decideGoogle(r) { return r && (r.status === 503 || r.status === 401 || r.status === 400 || r.status === 403 || r.status === 404); }

  async function post(b, google) {
    if (!b || !ESCRIBE[b.action] || !activo()) return google(b);
    var clave; try { clave = b.client_id || huella(b); } catch (e) { return google(b); }
    if (enCurso[clave]) return enCurso[clave];
    var p = (async function () {
      var cuerpo = {}; Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; }); cuerpo.client_id = clave;
      var r = null;
      for (var intento = 1; intento <= 2; intento++) {
        try { r = await llamar(b.action, cuerpo, 12000); } catch (e) { r = null; }
        if (r && r.status === 200 && r.j && (r.j.success || r.j.error)) break;   /* respuesta valida (tambien "sin permisos" / "no encontrado") */
        if (decideGoogle(r)) break;
        if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
      }
      if (r && r.status === 200 && r.j && (r.j.success || r.j.error)) {
        if (r.j.success) { try { Promise.resolve(google({ action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {} }   /* la hoja y el correo, en 2do plano */
        console.log('[_PREAV_AZURE_V1] ' + b.action + ' en Azure' + (r.j.nro ? ' N° ' + r.j.nro : '') + (r.j.duplicadoEvitado ? ' (envio repetido, no se duplico)' : '') + (r.j.success ? '' : ': ' + r.j.error));
        return r.j;
      }
      if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
      console.warn('[_PREAV_AZURE_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se guarda por Google (respaldo)');
      return google(b);
    })();
    enCurso[clave] = p;
    p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
    return p;
  }

  async function get(p, google) {
    if (!p || p.action !== 'getPreavisos' || !activo()) return google(p);
    var r = null;
    try { r = await llamar('getPreavisos', {}, 10000); } catch (e) { r = null; }
    if (r && r.status === 200 && r.j && (r.j.success || r.j.error)) return r.j;
    if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
    console.warn('[_PREAV_AZURE_V1] lista: Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se lee de Google');
    return google(p);
  }
  window.rlPreavAzure = { post: post, get: get };
})();
