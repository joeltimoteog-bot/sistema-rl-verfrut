/* ═══════════════════════════════════════════════════════════════════════════
   84-at-eliminar-supabase-v1.js — _AT_ELIMINAR_SUPABASE_V1 (12-nov-2026)
   ELIMINAR ATENCION: primero y de verdad en Supabase.
   ---------------------------------------------------------------------------
   EL PROBLEMA: "eliminar" solo borraba la fila de la hoja de Google (lento: 10-30 s) y la pantalla
   OCULTABA el registro. En Supabase seguia existiendo: si Google tardaba o fallaba, la atencion
   reaparecia; y aun cuando "funcionaba", seguia contando en estadisticas y en la base de Bienestar.
   LO QUE HACE:
   · deleteAtencion va a Supabase (/atenciones/eliminar): ~1 s. El servidor guarda la copia completa
     en Atenciones_Respaldo y borra la fila. Los permisos los decide el servidor con la sesion.
   · La pantalla responde al instante. En 2do plano se pide a Google lo de siempre (copia en la
     PAPELERA + quitar la fila de la hoja); si falla se reintenta 2 veces y queda en LOG_ERRORES.
   · Sin permiso / bloqueo temporal (403) o N° repetido (409) -> se muestra el aviso, no se borra.
   · Supabase apagado (503), sin sesion (401), no esta en Supabase (404) o no contesta
     -> se elimina por Google como siempre (nada cambia para el usuario).
   No toca el nucleo ni los bloques 15/16 (motivo obligatorio y lista de eliminadas siguen igual).
   INTERRUPTOR: localStorage.rl_at_eliminar = 'off'  (o el secreto AT_ELIMINAR_SUPABASE=0 en el servidor).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
try { if (localStorage.getItem('rl_at_eliminar') === 'off') return; } catch (e) {}
if (window._rlAtElimSbOk) return; window._rlAtElimSbOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
var previo = window.apiPost;
if (typeof previo !== 'function') return;
var enCurso = {}, apagadoHasta = 0;

function supabase(cuerpo, ms) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms);
  var op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + '/atenciones/eliminar', op).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(reloj); return { status: r.status, j: j }; });
  }, function (e) { clearTimeout(reloj); throw e; });
}
/* la hoja y la PAPELERA (respaldo), en 2do plano: el usuario no espera */
function hoja(self, b, intento) {
  Promise.resolve(previo.call(self, b)).then(function (r) {
    if (r && r.success) return;
    if (r && /no encontrado/i.test(String(r.error || ''))) return;   /* la fila ya no estaba en la hoja: nada que hacer */
    throw new Error((r && r.error) || 'sin respuesta');
  }).catch(function (e) {
    if (intento < 3) { setTimeout(function () { hoja(self, b, intento + 1); }, 20000); return; }
    console.warn('[_AT_ELIMINAR_SUPABASE_V1] la hoja no tomo la eliminacion del N° ' + b.nro + ': ' + (e && e.message));
    try { if (window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('eliminacion_hoja_fallo', 'google:deleteAtencion', 0, 'N° ' + b.nro + ': ' + String(e && e.message).slice(0, 120)); } catch (e2) {}
  });
}

window.apiPost = function (b) {
  var sinSesion = true;
  try { sinSesion = !sessionStorage.getItem('rl_token'); } catch (e) {}
  if (!b || b.action !== 'deleteAtencion' || !b.nro || sinSesion || Date.now() < apagadoHasta) return previo.apply(this, arguments);
  var self = this, args = arguments, clave = 'del-' + b.nro;
  if (enCurso[clave]) return enCurso[clave];   /* doble clic -> 1 solo envio */
  var p = (async function () {
    /* el motivo y el registro los prepara el candado (bloque 15) en window._elimContexto */
    var ctx = null; try { ctx = (window._elimContexto && String(window._elimContexto.nro) === String(b.nro)) ? window._elimContexto : null; } catch (e) {}
    var reg = (ctx && ctx.registro) || b.registro || {};
    var cuerpo = { nro: b.nro, id: reg.id || undefined, dni: reg.dni || b.dni || undefined, motivo: (ctx && ctx.motivo) || b.motivo || '' };
    var r = null, _t0 = Date.now(), intento;
    for (intento = 1; intento <= 2; intento++) {
      try { r = await supabase(cuerpo, 8000); } catch (e) { r = null; }
      if (r && r.status === 200 && r.j && r.j.success) break;
      if (r && [400, 401, 403, 404, 409, 503].indexOf(r.status) >= 0) break;   // decide sin reintentar
      if (intento < 2) await new Promise(function (z) { setTimeout(z, 1500); });
    }
    var ms = Date.now() - _t0;
    if (r && r.status === 200 && r.j && r.j.success) {
      try { if (typeof window._marcarEliminada === 'function') window._marcarEliminada(b.nro); } catch (e) {}
      /* a Google va con el motivo y la copia del registro (la PAPELERA los necesita), aunque el candado ya haya soltado su contexto */
      var bh = Object.assign({}, b, { motivo: cuerpo.motivo || b.motivo || '(sin motivo indicado)', registro: reg, eliminado_por: b.eliminado_por || b.usuario || '' });
      hoja(self, bh, 1);
      console.log('[_AT_ELIMINAR_SUPABASE_V1] N° ' + b.nro + ' eliminada en Supabase en ' + ms + ' ms');
      try { if (window.RLTrafico) RLTrafico.emit({ accion: 'Eliminó atención N° ' + b.nro, destino: 'Supabase' }); } catch (e) {}
      return { success: true, nro: b.nro, fuente: 'supabase', ms: ms };
    }
    if (r && (r.status === 403 || r.status === 409)) return { success: false, error: (r.j && r.j.error) || 'No se pudo eliminar', bloqueado: !!(r.j && r.j.bloqueado) };
    if (r && r.status === 503) apagadoHasta = Date.now() + 5 * 60 * 1000;
    console.warn('[_AT_ELIMINAR_SUPABASE_V1] Supabase ' + (r ? 'HTTP ' + r.status : 'sin respuesta') + ' -> se elimina por Google (respaldo)');
    return previo.apply(self, args);
  })();
  enCurso[clave] = p;
  p.then(function () { setTimeout(function () { delete enCurso[clave]; }, 3000); }, function () { delete enCurso[clave]; });
  return p;
};
console.log('[_AT_ELIMINAR_SUPABASE_V1] listo: Eliminar atencion borra primero en Supabase');
})();
