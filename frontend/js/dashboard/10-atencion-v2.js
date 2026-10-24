/* dashboard.html · bloque 10 (antes en la linea 11097) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ATENCION_V2 (25-ago-2026) — Estado ENVIADO · documentos nuevos · ruteo por
   empresa · los documentos de Jorge Chavez pasan a Leandro Bill
   ---------------------------------------------------------------------------
   NO NECESITA NINGUN CAMBIO EN APPS SCRIPT: updateAtencion ya escribe el estado
   (columna 26) y las observaciones (columna 25). Todo esto envuelve lo que ya
   existia, sin reescribirlo; ante cualquier error la pantalla sigue igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var RESP_LEANDRO = 'LEANDRO BILL MORALES YARLEQUE';
var RESP_TANIA   = 'RUBI FIGUEROA FLORES';   /* _RESP_RUBI_V1 (28-set-2026): los documentos de RAPEL que llevaba Tania Vera (ceso) pasan a Rubi Figueroa */

/* 1) Lo que recibia Jorge Chavez (eran documentos de Daniela Reyna, de forma
      temporal) pasa a Leandro Bill. */
try {
  Object.keys(DOC_RESP).forEach(function (k) {
    if (String(DOC_RESP[k]).toUpperCase().indexOf('JORGE') >= 0) DOC_RESP[k] = RESP_LEANDRO;
  });
} catch (e) {}

/* 2) Documentos nuevos: el responsable depende de la EMPRESA del trabajador.
      RAPEL -> Tania Vera   ·   VERFRUT -> Leandro Morales
      Para corregir un nombre o agregar otro documento, se edita SOLO esta lista. */
var DOC_NUEVOS = [
  '35 DESCANSO MEDICO - ENFERMEDAD',
  '36 DESCANSO MEDICO - MATERNIDAD',
  '37 DESCANSO MEDICO - ACCIDENTE DE TRABAJO',
  '38 DESCANSO MEDICO - ACCIDENTE COMUN',
  '39 DESCANSO MEDICO - ENFERMEDAD PROFESIONAL',
  '40 DESCANSO MEDICO - PATERNIDAD',
  '41 LICENCIA POR ENFERMEDAD GRAVE O TERMINAL'
];

var DOC_POR_EMPRESA = {};
DOC_NUEVOS.forEach(function (doc) {
  DOC_POR_EMPRESA[doc] = { RAPEL: RESP_TANIA, VERFRUT: RESP_LEANDRO };
});
try {
  DOC_NUEVOS.forEach(function (doc) { if (!(doc in DOC_RESP)) DOC_RESP[doc] = RESP_TANIA; });
} catch (e) {}
window._DOC_POR_EMPRESA = DOC_POR_EMPRESA;

function _respDe(doc, empresa) {
  var porEmp = DOC_POR_EMPRESA[String(doc || '').trim()];
  if (!porEmp) { try { return DOC_RESP[doc] || ''; } catch (e) { return ''; } }
  var e = String(empresa || '').toUpperCase();
  if (e.indexOf('RAPEL')   >= 0) return porEmp.RAPEL;
  if (e.indexOf('VERFRUT') >= 0) return porEmp.VERFRUT;
  return '';
}
window._respDe = _respDe;

/* 3) Autocompletado del responsable mirando la empresa */
function _avisoRuteo(doc, empresa, quien) {
  var cont = document.getElementById('at_resp');
  if (!cont || !cont.parentNode) return;
  _quitarAvisoRuteo();
  var box = document.createElement('div');
  box.id = '_avisoRuteo';
  box.style.cssText = 'margin-top:6px;font-size:11.5px;line-height:1.5;padding:7px 9px;border-radius:7px;' +
    (quien ? 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a5f;'
           : 'background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;');
  box.innerHTML = quien
    ? '\u{1F4CC} Documento de <b>' + String(empresa || '').toUpperCase() + '</b> · se asigna a <b>' + quien + '</b>'
    : '⚠️ Falta la empresa del trabajador. Busca primero el DNI para saber si va a Rubí o a Leandro.';
  cont.parentNode.appendChild(box);
}
function _quitarAvisoRuteo() {
  var v = document.getElementById('_avisoRuteo');
  if (v && v.parentNode) v.parentNode.removeChild(v);
}

function _aplicarRuteoEmpresa() {
  try {
    var txt = document.getElementById('at_doc_txt');
    var oculto = document.getElementById('at_doc');
    var doc = String((txt && txt.value) || (oculto && oculto.value) || '').trim();
    if (!DOC_POR_EMPRESA[doc]) { _quitarAvisoRuteo(); return; }
    var emp   = String((document.getElementById('at_emp') || {}).value || '');
    var quien = _respDe(doc, emp);
    if (typeof sv === 'function') sv('at_resp', quien);
    if (typeof _setRespMode === 'function') _setRespMode(quien ? 'auto' : 'manual');
    _avisoRuteo(doc, emp, quien);
  } catch (e) {}
}
window._aplicarRuteoEmpresa = _aplicarRuteoEmpresa;

var _autoOrig = window.autoResponsable;
if (typeof _autoOrig === 'function') {
  window.autoResponsable = function () {
    var r = _autoOrig.apply(this, arguments);
    try { _aplicarRuteoEmpresa(); } catch (e) {}
    return r;
  };
}

document.addEventListener('change', function (ev) {
  try { if (ev.target && ev.target.id === 'at_emp') _aplicarRuteoEmpresa(); } catch (e) {}
}, true);

/* 4) Estado ENVIADO en los tres lugares donde vive el estado */
function _agregarOpcion(id, valor) {
  var s = document.getElementById(id);
  if (!s) return;
  for (var i = 0; i < s.options.length; i++) {
    if (String(s.options[i].value).toUpperCase() === valor) return;
  }
  var o = document.createElement('option');
  o.value = valor; o.textContent = valor;
  s.appendChild(o);
}

function _instalarEnviado() {
  _agregarOpcion('at_est', 'ENVIADO');
  _agregarOpcion('dEst',   'ENVIADO');
  _agregarOpcion('fAE',    'ENVIADO');

  var sel = document.getElementById('dEst');
  if (!sel || document.getElementById('_btnEnviado')) return;

  var b = document.createElement('button');
  b.id = '_btnEnviado'; b.type = 'button';
  b.textContent = '\u{1F4E4} Marcar como enviado';
  b.style.cssText = 'margin-top:7px;width:100%;background:#1e40af;color:#fff;border:none;' +
    'border-radius:7px;padding:7px 10px;font-weight:700;font-size:12.5px;cursor:pointer';
  b.addEventListener('click', function () {
    try {
      sel.value = 'ENVIADO';
      var obs = document.getElementById('dObs');
      var quien = ((typeof USER !== 'undefined' && USER) ? (USER.nombre || USER.usuario) : '') || '';
      var a = new Date();
      var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
      var sello = 'ENVIADO el ' + p2(a.getDate()) + '/' + p2(a.getMonth() + 1) + '/' + a.getFullYear() +
                  ' ' + p2(a.getHours()) + ':' + p2(a.getMinutes()) + ' por ' + quien;
      if (obs && String(obs.value).indexOf('ENVIADO el ') < 0) {
        var actual = String(obs.value || '').trim();
        obs.value = actual ? (actual + ' | ' + sello) : sello;
      }
      if (typeof mostrarToast === 'function') {
        mostrarToast('\u{1F4E4} Listo. Ahora dale a Guardar para que quede registrado.', 'ok');
      }
      b.textContent = '✓ Marcado — falta guardar';
      b.style.background = '#16a34a';
      setTimeout(function () {
        b.textContent = '\u{1F4E4} Marcar como enviado';
        b.style.background = '#1e40af';
      }, 4000);
    } catch (e) {}
  });
  if (sel.parentNode) sel.parentNode.appendChild(b);
}
window._instalarEnviado = _instalarEnviado;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _instalarEnviado);
} else {
  _instalarEnviado();
}
setTimeout(_instalarEnviado, 1200);
setTimeout(_instalarEnviado, 3500);

})();
