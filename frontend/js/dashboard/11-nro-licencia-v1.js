/* dashboard.html · bloque 11 (antes en la linea 11264) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _NRO_LICENCIA_V1 (25-ago-2026) — Campo "N° de licencia"
   ---------------------------------------------------------------------------
   REGLA (definida por el area): lleva numero de licencia todo lo que sea
   MATERNIDAD, ENFERMEDAD o ACCIDENTE, y los CITT. El certificado medico
   particular (CMP) NO lleva numero, asi que ahi el campo ni se muestra.

   El campo aparece SOLO cuando el documento elegido lo requiere, y en ese caso
   es obligatorio: si falta, sale en el MISMO aviso donde ya salen el DNI, el
   nombre y el documento, para que el usuario vea de una vez todo lo que le
   falta completar.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* Palabras que obligan el numero de licencia.
   _ATENCION_V3 (25-ago-2026): por indicacion de Joel, el certificado medico
   particular (CMP) y el odontologico (COP) TAMBIEN piden numero. Antes estaban
   como excepcion; la lista de excepciones queda vacia. */
var LIC_PALABRAS  = ['CITT', 'CMP', 'ODONTOLOG', 'MATERNIDAD', 'ENFERMEDAD', 'ACCIDENTE', 'DESCANSO MEDICO'];   /* _AT_TIPO_LIC_V1: + DESCANSO MEDICO (ahora es un solo documento) */
var LIC_EXCEPCION = [];

function _norm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _licenciaObligatoria(doc) {
  try {
    var t = _norm(doc);
    if (!t) return false;
    for (var i = 0; i < LIC_EXCEPCION.length; i++) {
      if (t.indexOf(LIC_EXCEPCION[i]) >= 0) return false;
    }
    for (var j = 0; j < LIC_PALABRAS.length; j++) {
      if (t.indexOf(LIC_PALABRAS[j]) >= 0) return true;
    }
    return false;
  } catch (e) { return false; }
}
window._licenciaObligatoria = _licenciaObligatoria;

/* Crea el campo una sola vez, justo debajo del buscador de documento */
function _crearCampoLicencia() {
  if (document.getElementById('at_nlic')) return;
  var ref = document.getElementById('at_doc_wrap') || document.getElementById('at_doc_txt');
  if (!ref) return;
  var cont = ref.parentNode;
  if (!cont) return;

  var caja = document.createElement('div');
  caja.id = 'at_nlic_wrap';
  caja.className = 'fc';
  caja.style.cssText = 'display:none;margin-top:10px';
  caja.innerHTML =
    '<label>N° de licencia <span style="color:#dc2626">*</span></label>' +
    '<input type="text" id="at_nlic" placeholder="N° de la licencia / CITT" autocomplete="off">' +
    '<div id="at_nlic_ayuda" style="font-size:11.5px;color:#7c2d12;background:#fff7ed;' +
    'border:1px solid #fed7aa;border-radius:7px;padding:6px 9px;margin-top:5px;line-height:1.5">' +
    '⚠️ Este documento lleva número de licencia. Es obligatorio para poder guardar.</div>';
  cont.appendChild(caja);
}

function _refrescarCampoLicencia() {
  try {
    _crearCampoLicencia();
    var caja = document.getElementById('at_nlic_wrap');
    var inp  = document.getElementById('at_nlic');
    if (!caja || !inp) return;

    var txt = document.getElementById('at_doc_txt');
    var ocu = document.getElementById('at_doc');
    var doc = String((txt && txt.value) || (ocu && ocu.value) || '').trim();

    if (_licenciaObligatoria(doc)) {
      caja.style.display = '';
      inp.setAttribute('required', 'required');
    } else {
      caja.style.display = 'none';
      inp.removeAttribute('required');
      inp.value = '';                 // que no se cuele el numero de otro documento
    }
  } catch (e) {}
}
window._refrescarCampoLicencia = _refrescarCampoLicencia;

/* Se recalcula cada vez que se toca el documento */
var _autoOrig2 = window.autoResponsable;
if (typeof _autoOrig2 === 'function') {
  window.autoResponsable = function () {
    var r = _autoOrig2.apply(this, arguments);
    try { _refrescarCampoLicencia(); } catch (e) {}
    return r;
  };
}
['input', 'change', 'blur'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    try {
      if (e.target && (e.target.id === 'at_doc_txt' || e.target.id === 'at_doc')) _refrescarCampoLicencia();
    } catch (x) {}
  }, true);
});

/* Al abrir el formulario y tras limpiarlo */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _refrescarCampoLicencia);
} else {
  _refrescarCampoLicencia();
}
setTimeout(_refrescarCampoLicencia, 1200);
setTimeout(_refrescarCampoLicencia, 3500);

})();
