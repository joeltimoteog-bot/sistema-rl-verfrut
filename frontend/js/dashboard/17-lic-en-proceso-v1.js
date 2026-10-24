/* dashboard.html · bloque 17 (antes en la linea 12296) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ===========================================================================
   _LIC_EN_PROCESO_V1 (04-set-2026) - el N de licencia no se pide EN PROCESO
   ---------------------------------------------------------------------------
   OBSERVACION DEL AREA
   Si la atencion se registra EN PROCESO, el trabajador todavia no regularizo
   el documento: no existe aun un numero de licencia que escribir. Hoy el campo
   aparece igual y ademas es obligatorio, asi que el usuario no puede guardar,
   o se inventa un dato - que es peor, porque ensucia el registro.

   QUE HACE
   Mientras el estado diga EN PROCESO, el campo se oculta y deja de ser
   obligatorio. Al volver a FINALIZADO reaparece y se vuelve a exigir.

   EL CASO DEL DIALOGO "ya enviaste el documento?"
   Ese dialogo (_CONFIRMA_ENVIO_V1) fija el estado JUSTO ANTES de llamar a
   guardarAt, y la validacion de campos faltantes vive DENTRO de guardarAt.
   Entonces, si alguien pone EN PROCESO para saltarse el numero y despues
   responde "si, ya lo envie", el estado pasa a ENVIADO y la validacion vuelve
   a exigir la licencia. Eso ya funcionaba solo: el dato no se cuela.
   El problema era otro y mas feo: el campo seguia OCULTO, asi que al usuario
   le salia "Falta completar: N de licencia" sin ver ningun campo donde
   escribirlo, y sin entender que hacer.
   Por eso el punto 3: cuando la validacion pregunta si la licencia es
   obligatoria y la respuesta es que si, el campo se vuelve a mostrar antes de
   que salga el aviso. El usuario ve el aviso Y ve donde escribir.
   =========================================================================== */
(function () {
'use strict';

function _estadoEnProceso() {
  try {
    var s = document.getElementById('at_est');
    return !!s && String(s.value || '').toUpperCase().indexOf('PROCESO') >= 0;
  } catch (e) { return false; }
}

function _mostrarCampoLicencia() {
  try {
    var caja = document.getElementById('at_nlic_wrap');
    var inp  = document.getElementById('at_nlic');
    if (caja) caja.style.display = '';
    if (inp) inp.setAttribute('required', 'required');
  } catch (e) {}
}

function _ocultarCampoLicencia() {
  try {
    var caja = document.getElementById('at_nlic_wrap');
    var inp  = document.getElementById('at_nlic');
    if (caja) caja.style.display = 'none';
    if (inp) { inp.removeAttribute('required'); inp.value = ''; }
  } catch (e) {}
}

/* 1) y 3) La validacion deja de exigir el numero EN PROCESO; y si en cambio
      resulta obligatorio, se asegura de que el campo este a la vista. */
var _licOrig = window._licenciaObligatoria;
if (typeof _licOrig === 'function') {
  window._licenciaObligatoria = function () {
    if (_estadoEnProceso()) return false;
    var r = _licOrig.apply(this, arguments);
    if (r) _mostrarCampoLicencia();
    return r;
  };
}

/* 2) El campo se esconde en pantalla mientras siga EN PROCESO */
var _refOrig = window._refrescarCampoLicencia;
if (typeof _refOrig === 'function') {
  window._refrescarCampoLicencia = function () {
    var r = _refOrig.apply(this, arguments);
    if (_estadoEnProceso()) _ocultarCampoLicencia();
    return r;
  };
}

/* Se recalcula al cambiar el estado, no solo al cambiar el documento */
document.addEventListener('change', function (e) {
  try {
    if (e.target && e.target.id === 'at_est' &&
        typeof window._refrescarCampoLicencia === 'function') {
      window._refrescarCampoLicencia();
    }
  } catch (x) {}
}, true);

console.log('[_LIC_EN_PROCESO_V1] el N de licencia no se pide cuando esta EN PROCESO');
})();
