/* dashboard.html · bloque 42 (antes en la linea 16311) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _EDIT_AZURE_V1 (25-set-2026) — al editar una atencion, Azure se actualiza
   en segundo plano (accion 'syncAtencionAzure'). El usuario no espera nada:
   la edicion ya quedo en la hoja. Si falla, el servidor lo reintenta solo.
   Se instala UNA sola vez (bandera global) para no encadenar envoltorios.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
if (window._rlEditAzOk) return;
window._rlEditAzOk = true;
try { if (typeof RED_SILENCIOSAS !== 'undefined' && RED_SILENCIOSAS.indexOf('syncAtencionAzure') < 0) RED_SILENCIOSAS.push('syncAtencionAzure'); } catch (e) {}
var previo = window.apiPost;
if (typeof previo !== 'function') return;
window.apiPost = function (b) {
  var pr = previo.apply(this, arguments);
  try {
    if (b && b.action === 'updateAtencion' && b.nro) {
      var nro = b.nro;
      Promise.resolve(pr).then(function (r) {
        if (r && r.success) setTimeout(function () {
          try { Promise.resolve(previo.call(window, { action: 'syncAtencionAzure', nro: nro })).catch(function () {}); } catch (e) {}
        }, 300);
      }, function () {});
    }
  } catch (e) {}
  return pr;
};
console.log('[_EDIT_AZURE_V1] listo');
})();
