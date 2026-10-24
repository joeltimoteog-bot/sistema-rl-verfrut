/* dashboard.html · bloque 15 (antes en la linea 12028) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */


/* ═══════════════════════════════════════════════════════════════════════════
   _CANDADO_ELIMINAR_V1 (25-ago-2026) — proteger el boton de eliminar

   El boton sigue disponible PARA TODOS, como pidio Joel. Lo que se agrega es
   que borrar deje de ser un clic distraido:

     1. La confirmacion muestra el registro completo (DNI, trabajador, empresa,
        documento, estado y quien lo registro), no solo el numero.
     2. Pide un MOTIVO escrito. Sin motivo no se elimina.
     3. Antes de borrar, el servidor guarda una copia en la hoja PAPELERA.
        Si esa copia no se puede guardar, NO se borra nada.

   No se reescribe eliminarAt: se le pone esta capa encima y despues se llama
   a la de siempre, que es la que hace el trabajo y limpia la pantalla.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var MIN_MOTIVO = 6;

function _buscarAt(nro) {
  /* _ALCANCE_V1 (26-ago-2026): atTodas, CACHE y USER estan declarados con "let"
     en la linea 1290. Un "let" de nivel superior NO se cuelga de window: por eso
     window.atTodas y window.CACHE salian vacios y no encontraba la fila. Hay que
     nombrarlos directo. */
  var listas = [];
  try { if (typeof atTodas !== 'undefined' && atTodas) listas.push(atTodas); } catch (e) {}
  try { if (window._atFiltradas) listas.push(window._atFiltradas); } catch (e) {}
  try { if (typeof CACHE !== 'undefined' && CACHE && CACHE.atenciones) listas.push(CACHE.atenciones); } catch (e) {}
  try { if (typeof CACHE !== 'undefined' && CACHE && CACHE.historialAtenciones) listas.push(CACHE.historialAtenciones); } catch (e) {}
  for (var i = 0; i < listas.length; i++) {
    var L = listas[i];
    if (!L || !L.length) continue;
    for (var j = 0; j < L.length; j++) {
      if (String(L[j].nro) === String(nro)) return L[j];
    }
  }
  return null;
}

/* ── 1) apiPost envuelto: le adjunta el motivo y la copia al deleteAtencion ── */
var _postOrig = window.apiPost;
if (typeof _postOrig === 'function') {
  window.apiPost = function (b) {
    try {
      if (b && b.action === 'deleteAtencion' && window._elimContexto &&
          String(window._elimContexto.nro) === String(b.nro)) {
        b.motivo        = window._elimContexto.motivo;
        b.registro      = window._elimContexto.registro;
        b.eliminado_por = ((typeof USER !== 'undefined' && USER && USER.usuario) || '');
      }
    } catch (e) {}
    return _postOrig.apply(this, arguments);
  };
}

/* ── 2) eliminarAt envuelto: datos a la vista + motivo obligatorio ── */
var _elimOrig = window.eliminarAt;
if (typeof _elimOrig === 'function') {
  window.eliminarAt = async function (nro) {
    var a = _buscarAt(nro);
    if (!a) {
      mostrarToast('No encuentro ese registro en pantalla. Recarga y vuelve a intentar.', 'error');
      return;
    }

    var detalle =
      'Vas a ELIMINAR esta atencion:\n\n' +
      'N° de atencion :  ' + (a.nro || '') + '\n' +
      'Fecha          :  ' + String(a.fecha_atencion || '').substring(0, 10) + '\n' +
      'DNI            :  ' + (a.dni || '') + '\n' +
      'Trabajador     :  ' + (a.nombre || '') + '\n' +
      'Empresa        :  ' + (a.empresa || '') + '\n' +
      'Documento      :  ' + (a.detalle_documento || '') + '\n' +
      'Estado         :  ' + (a.estado || '') + '\n' +
      'Lo registro    :  ' + (a.supervisor || a.usuario_sistema || '') + '\n\n' +
      'Se guardara una copia en la PAPELERA antes de borrarlo.';

    if (!(await appConfirm(detalle))) return;

    var motivo = await appPrompt('¿Por que se elimina? (obligatorio)');
    motivo = String(motivo == null ? '' : motivo).trim();
    if (!motivo) {
      mostrarToast('No se elimino nada: falta el motivo', 'error');
      return;
    }
    if (motivo.length < MIN_MOTIVO) {
      mostrarToast('Escribe un motivo mas claro (minimo ' + MIN_MOTIVO + ' letras)', 'error');
      return;
    }

    window._elimContexto = { nro: a.nro, motivo: motivo, registro: a };
    console.log('[candado] eliminando ' + a.nro + ' | motivo: ' + motivo +
                ' | por: ' + ((typeof USER !== 'undefined' && USER && USER.usuario) || ''));
    try {
      return await _elimOrig(nro);
    } finally {
      window._elimContexto = null;
    }
  };
}

console.log('[_CANDADO_ELIMINAR_V1] eliminar pide motivo y deja copia en papelera');
})();

