/* dashboard.html · bloque 43 (antes en la linea 16342) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ACCESO_AZURE_V1 (26-set-2026) — "ACCESO A MODULOS" funciona desde AZURE
   ---------------------------------------------------------------------------
   Permisos por modulo y horarios de acceso se leen y se guardan en Azure
   (POST /api/acceso/<accion>). Google queda solo como RESPALDO:
     · Lecturas: Azure. Si Azure no responde (o tarda > 8 s) -> la hoja, como antes.
     · Guardados: primero Azure (principal) y despues una copia a la hoja.
       Si Azure no acepta (sin sesion firmada, caido...) -> se guarda en la hoja
       como antes y el servidor de Google lo sube a Azure.
   INTERRUPTOR: ACCESO_AZURE_ACTIVO = false  -> todo vuelve a la hoja al instante.
   Se instala UNA sola vez (bandera global) para no encadenar envoltorios.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var ACCESO_AZURE_ACTIVO = true;
if (window._rlAccesoAzOk || !ACCESO_AZURE_ACTIVO) return;
window._rlAccesoAzOk = true;
var LECTURAS  = { permisosListar: 1, accesoHorarioListar: 1, accesoHorarioDeUsuario: 1 };
var ESCRITURAS = { permisosGuardar: 1, accesoHorarioGuardar: 1, accesoHorarioEliminar: 1 };
var previo = window.apiPost;
if (typeof previo !== 'function' || typeof AZURE_FN_BASE === 'undefined') return;

function azure(b) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 8000);
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/acceso/' + b.action, op).then(function (r) {
    return r.json().then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}

window.apiPost = function (b) {
  var accion = b && b.action;
  if (!LECTURAS[accion] && !ESCRITURAS[accion]) return previo.apply(this, arguments);
  var self = this, args = arguments;
  return (async function () {
    var r = null;
    try { r = await azure(b); } catch (e) { r = null; }
    if (r && r.status === 200 && r.j && (r.j.success === true || r.j.success === false)) {
      if (ESCRITURAS[accion] && r.j.success) {
        /* copia de respaldo en la hoja (no se espera, no molesta si falla) */
        try { Promise.resolve(previo.call(window, Object.assign({}, b, { _desdeAzure: 1 }))).catch(function () {}); } catch (e) {}
      }
      return r.j;
    }
    console.warn('[_ACCESO_AZURE_V1] ' + accion + ': Azure ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se usa la hoja (respaldo)');
    return previo.apply(self, args);
  })();
};
console.log('[_ACCESO_AZURE_V1] listo: Acceso a Modulos desde Azure');
})();
