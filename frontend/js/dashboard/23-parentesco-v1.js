/* dashboard.html · bloque 23 (antes en la linea 13454) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _PARENTESCO_V1 (18-set-2026) ══════════════════
   Campo "Parentesco" en el formulario de Nueva Atencion.

   POR QUE: en las licencias por fallecimiento/defuncion y por enfermedad
   grave o terminal, el descanso se otorga por un familiar, y hasta hoy no
   se registraba de quien se trataba.

   CUANDO APARECE: solo si el documento elegido contiene DEFUNCION,
   FALLECIMIENTO o ENFERMEDAD GRAVE. Verificado contra el catalogo real:
       20 LICENCIA POR FALLECIMIENTO VERFRUT / RAPEL
       25 REGULARIZAR LICENCIA POR DEFUNCION - GENERAR FORMULARIO
       21 LICENCIA POR ENFERMEDAD GRAVE VERFRUT / RAPEL
       26 REGULARIZAR LICENCIA POR ENFERMEDAD GRAVE - GENERAR FORMULARIO
       41 LICENCIA POR ENFERMEDAD GRAVE O TERMINAL
   NO se activa con "35 DESCANSO MEDICO - ENFERMEDAD" ni con
   "39 DESCANSO MEDICO - ENFERMEDAD PROFESIONAL", que son del propio
   trabajador y no llevan parentesco.

   COMO SE GUARDA: viaja al backend como el campo "parentesco", igual que
   viajan el DNI o el nombre. No se toca el armado del formulario: se agrega
   al mensaje justo antes de enviarlo.

   NO TOCA NADA DE LO EXISTENTE: mismo patron que el N° de licencia. Si algo
   aqui fallara, el formulario sigue funcionando como hoy.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var PAR_PALABRAS = ['DEFUNCION', 'FALLECIMIENTO', 'ENFERMEDAD GRAVE'];
var PAR_OPCIONES = ['PADRE', 'MADRE', 'HERMANO(A)', 'HIJO(A)', 'ESPOSA(O)', 'CONYUGE', 'CONVIVIENTE'];

function _parNorm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _parentescoObligatorio(doc) {
  try {
    var t = _parNorm(doc);
    if (!t) return false;
    /* _AT_TIPO_LIC_V1: descanso medico con tipo "enfermedad grave terminal" tambien pide parentesco */
    try { var _tl = _parNorm(window._atTipoLicValor ? window._atTipoLicValor() : ''); if (_tl.indexOf('ENFERMEDAD GRAVE') >= 0) return true; } catch (eTl) {}
    for (var i = 0; i < PAR_PALABRAS.length; i++) {
      if (t.indexOf(PAR_PALABRAS[i]) >= 0) return true;
    }
    return false;
  } catch (e) { return false; }
}
window._parentescoObligatorio = _parentescoObligatorio;

function _parDocActual() {
  var txt = document.getElementById('at_doc_txt');
  var ocu = document.getElementById('at_doc');
  return String((txt && txt.value) || (ocu && ocu.value) || '').trim();
}

/* Crea el campo una sola vez, debajo del de N° de licencia */
function _parCrear() {
  if (document.getElementById('at_parentesco')) return;
  var ref = document.getElementById('at_nlic_wrap') ||
            document.getElementById('at_doc_wrap')  ||
            document.getElementById('at_doc_txt');
  if (!ref || !ref.parentNode) return;

  var caja = document.createElement('div');
  caja.id = 'at_parentesco_wrap';
  caja.className = 'fc';
  caja.style.cssText = 'display:none;margin-top:10px';
  caja.innerHTML =
    '<label>Parentesco <span style="color:#dc2626">*</span></label>' +
    '<select id="at_parentesco" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
      'border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box">' +
      '<option value="">— selecciona el parentesco —</option>' +
      PAR_OPCIONES.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
    '</select>' +
    '<div style="font-size:11.5px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;' +
      'border-radius:7px;padding:6px 9px;margin-top:5px;line-height:1.5">' +
      '⚠️ Esta licencia se otorga por un familiar. Indica el parentesco: es obligatorio para poder guardar.</div>';

  /* despues del bloque de licencia, no dentro de el */
  if (ref.id === 'at_nlic_wrap') ref.parentNode.insertBefore(caja, ref.nextSibling);
  else ref.parentNode.appendChild(caja);
}

function _parRefrescar() {
  try {
    _parCrear();
    var caja = document.getElementById('at_parentesco_wrap');
    var sel  = document.getElementById('at_parentesco');
    if (!caja || !sel) return;
    if (_parentescoObligatorio(_parDocActual())) {
      caja.style.display = '';
      sel.setAttribute('required', 'required');
    } else {
      caja.style.display = 'none';
      sel.removeAttribute('required');
      sel.value = '';          // que no se cuele el parentesco de otro documento
    }
  } catch (e) {}
}
window._refrescarCampoParentesco = _parRefrescar;

/* ── Se recalcula cuando se toca el documento (mismo enganche que la licencia) ── */
var _autoPrev = window.autoResponsable;
if (typeof _autoPrev === 'function') {
  window.autoResponsable = function () {
    var r = _autoPrev.apply(this, arguments);
    try { _parRefrescar(); } catch (e) {}
    return r;
  };
}
['input', 'change', 'blur'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    try {
      if (e.target && (e.target.id === 'at_doc_txt' || e.target.id === 'at_doc')) _parRefrescar();
    } catch (x) {}
  }, true);
});

/* ── Validacion: no dejar guardar sin parentesco cuando corresponde ──
   Se envuelve guardarAt y se revisa ANTES de todo lo demas, para que el
   usuario vea lo que falta antes de que le pregunten si esta finalizado. */
var _guardarPrevio = window.guardarAt;
if (typeof _guardarPrevio === 'function') {
  window.guardarAt = function () {
    try {
      if (_parentescoObligatorio(_parDocActual())) {
        _parRefrescar();                       // por si estaba oculto
        var sel = document.getElementById('at_parentesco');
        if (sel && !String(sel.value || '').trim()) {
          try { sel.focus(); } catch (e1) {}
          sel.style.borderColor = '#ef4444';
          setTimeout(function () { sel.style.borderColor = ''; }, 2500);
          if (typeof mostrarToast === 'function') {
            mostrarToast('Falta completar: Parentesco', 'error');
          }
          return;                              // no se guarda
        }
      }
    } catch (e) { /* si esto falla, que guarde como siempre */ }
    return _guardarPrevio.apply(this, arguments);
  };
}

/* ── Que el dato viaje al backend, sin tocar el armado del formulario ── */
var _apiPostPrevio = window.apiPost;
if (typeof _apiPostPrevio === 'function') {
  window.apiPost = function (b) {
    try {
      if (b && (b.action === 'saveAtencion' || b.action === 'updateAtencion' ||
                b.action === 'syncFirebaseAtencion')) {
        var sel = document.getElementById('at_parentesco');
        var doc = b.detalle_documento || _parDocActual();
        b.parentesco = _parentescoObligatorio(doc) ? String((sel && sel.value) || '') : '';
      }
    } catch (e) {}
    return _apiPostPrevio.apply(this, arguments);
  };
}

/* ── Al abrir el formulario y tras limpiarlo ── */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _parRefrescar);
else _parRefrescar();
setTimeout(_parRefrescar, 1200);
setTimeout(_parRefrescar, 3500);

console.log('[_PARENTESCO_V1] listo');
})();
