/* ═══════════════════════════════════════════════════════════════════
   67-cumpl-lecturas-azure-v1.js — _CUMPL_LECTURAS_AZURE_V1 (31-oct-2026)
   Las dos ultimas lecturas que iban a Google de frente ahora salen de Azure (misma respuesta):
     · getCumplimiento       -> banner "⏰ Cumplimiento pendiente" al entrar      -> POST /api/cumpl/getCumplimiento
     · getCumplimientoCasos  -> modal "📊 Indicadores de Cumplimiento — Casos"   -> POST /api/cumpl/getCumplimientoCasos
   Si Azure no responde (14 s), devuelve error o aun no esta migrado (503) -> Google, como siempre.
   Mismo patron que 48-mod-simples. INTERRUPTOR: CUMPL_LECTURAS_AZURE
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var CUMPL_LECTURAS_AZURE = true;
  if (!CUMPL_LECTURAS_AZURE || window._rlCumplLectOk) return;
  window._rlCumplLectOk = true;
  var BASE = (typeof AZURE_FN_BASE !== 'undefined' ? AZURE_FN_BASE : 'https://rl-fn-verfrut.azurewebsites.net/api') + '/cumpl/';
  var ACCIONES = { getCumplimiento: 1, getCumplimientoCasos: 1 };
  var previo = window.apiGet;
  if (typeof previo !== 'function') return;
  window.apiGet = function (p) {
    if (!p || !ACCIONES[p.action]) return previo.apply(this, arguments);
    var self = this, args = arguments;
    return (async function () {
      var cuerpo = {}; Object.keys(p).forEach(function (k) { if (k !== 'action') cuerpo[k] = p[k]; });
      var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);
      try {
        var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo) };
        if (ctrl) op.signal = ctrl.signal;
        var r = await fetch(BASE + p.action, op);
        var j = await r.json().catch(function () { return null; });
        clearTimeout(reloj);
        if (r.status === 200 && j && j.success) return j;
        console.warn('[_CUMPL_LECTURAS_AZURE_V1] ' + p.action + ': Azure HTTP ' + r.status + ((j && j.error) ? ' (' + j.error + ')' : '') + ' -> Google (respaldo)');
      } catch (e) { clearTimeout(reloj); console.warn('[_CUMPL_LECTURAS_AZURE_V1] ' + p.action + ': Azure sin respuesta -> Google (respaldo)'); }
      return previo.apply(self, args);
    })();
  };
  try { apiGet = window.apiGet; } catch (e) {}
  console.log('[_CUMPL_LECTURAS_AZURE_V1] listo: banner y Indicadores de Cumplimiento desde Azure');
})();
