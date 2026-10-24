/* dashboard.html · bloque 55 (antes en la linea 17093) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _USR_AZURE_V1 (27-set-2026) — USUARIOS y ACCESOS TEMPORALES primero en Azure
   · Crear usuario, activar/desactivar y aprobar/rechazar accesos temporales van a Azure,
     que verifica quien opera con el login firmado (solo jtimoteo). Contraseña cifrada.
   · Al guardar, espera a que Google copie a la hoja (asi la lista que se recarga ya lo muestra).
   · Azure apagado (503), sin sesion (401) o sin respuesta -> Google, como siempre.
   INTERRUPTOR: USR_AZURE_PRIMERO = false  (o usrAzurePrimeroApagar() en el Apps Script).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var USR_AZURE_PRIMERO = true;
  if (!USR_AZURE_PRIMERO || window._rlUsrAzOk) return;
  window._rlUsrAzOk = true;
  var BASE = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/usr/guardar/';
  var ACCIONES = { saveUsuario: 1, updateUsuario: 1, resolverAccesoTemporal: 1, aprobarAccesoTemporal: 1 };
  function h32(s, seed) { var h = seed >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function huella(b) { var s = JSON.stringify(b); return 'usr-' + h32(s, 2166136261) + h32(s, 5381) + '-' + Date.now().toString(36); }
  var previo = window.apiPost, enCurso = {}, apagadoHasta = 0;
  if (typeof previo !== 'function') return;
  /* _USR_SESION_V1 (29-set-2026): si Azure no pudo y Google la rechaza ("ahora se hace desde Azure"),
     se muestra el motivo real (sesion vencida, sin sesion, Azure sin respuesta...) en vez del mensaje generico. */
  function tkVencido(tk) { try { var p = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return !!(p.exp && p.exp * 1000 < Date.now()); } catch (e) { return false; } }
  function motivo(tk, r) {
    if (!tk) return '🔒 Esta pestaña no tiene sesión de Azure. Cierra sesión, vuelve a entrar y repite la acción.';
    if ((r && r.status === 401) || tkVencido(tk)) return '🔒 Tu sesión venció (dura 8 horas). Cierra sesión, vuelve a entrar y repite la acción.';
    if (!r) return '📡 Azure no respondió (internet lento o sin conexión). Espera unos segundos y repite la acción.';
    return '⚠️ Azure respondió ' + r.status + ((r.j && r.j.error) ? ': ' + r.j.error : '') + '. Repite en unos segundos; si sigue, avisa al administrador.';
  }
  function respaldo(self, args, tk, r) {
    return Promise.resolve(previo.apply(self, args)).then(function (g) {
      if (g && g.success === false && /ahora se hace desde Azure/i.test(String(g.error || ''))) {
        var m = motivo(tk, r); console.warn('[_USR_SESION_V1] ' + m); return { success: false, error: m, azureStatus: r ? r.status : null };
      }
      return g;
    });
  }
  window.apiPost = function (b) {
    var tk = null;
    try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
    if (!b || !ACCIONES[b.action]) return previo.apply(this, arguments);
    if (!tk || tkVencido(tk)) return respaldo(this, arguments, tk, tk ? { status: 401, j: null } : null);
    if (Date.now() < apagadoHasta) return respaldo(this, arguments, tk, { status: 503, j: { error: 'Azure en pausa unos minutos' } });
    var self = this, args = arguments, igual, clave;
    try { igual = JSON.stringify(b); clave = huella(b); } catch (e) { return respaldo(self, args, tk, null); }
    if (enCurso[igual]) return enCurso[igual];
    var p = (async function () {
      var cuerpo = {}; Object.keys(b).forEach(function (k) { if (k !== 'action') cuerpo[k] = b[k]; });
      cuerpo.client_id = clave;
      var r = null;
      for (var intento = 1; intento <= 4; intento++) {   /* _USR_REINTENTOS_V1: red inestable (ERR_NETWORK_CHANGED) -> 4 intentos; Google no puede hacer esta accion */
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
        if (intento < 4) await new Promise(function (z) { setTimeout(z, [1500, 2000, 2500][intento - 1]); });
      }
      if (r && r.status === 200 && r.j) {
        if (r.j.success) {   /* esperar la copia a la hoja (max 15 s): la lista se recarga de Google */
          try { await Promise.race([Promise.resolve(previo.call(self, { action: 'cvAplicarDesdeAzure' })).catch(function () {}), new Promise(function (z) { setTimeout(z, 15000); })]); } catch (e) {}
        }
        console.log('[_USR_AZURE_V1] ' + b.action + ' en Azure: ' + (r.j.success ? 'guardado' : 'rechazado (' + r.j.error + ')'));
        return r.j;
      }
      if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
      console.warn('[_USR_AZURE_V1] ' + b.action + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> Google (respaldo)');
      return respaldo(self, args, tk, r);
    })();
    enCurso[igual] = p;
    p.then(function () { setTimeout(function () { delete enCurso[igual]; }, 3000); }, function () { delete enCurso[igual]; });
    return p;
  };
  try { apiPost = window.apiPost; } catch (e) {}
  console.log('[_USR_AZURE_V1] listo: usuarios y accesos temporales primero en Azure');
})();
