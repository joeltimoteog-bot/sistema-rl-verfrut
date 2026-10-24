/* dashboard.html · bloque 14 (antes en la linea 11793) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */


/* ═══════════════════════════════════════════════════════════════════════════
   _ATENCION_V3 (25-ago-2026) — Mis Atenciones

   1) Campo "Autorizado por": se llena solo segun el documento.
      ESSALUD (CITT y descansos medicos) · CMP (certificado medico
      particular) · COP (odontologico). Se puede corregir a mano.
   2) Ruteo por empresa extendido a las licencias 19, 20, 21 y 34, que antes
      tenian responsable fijo. RAPEL -> Tania Vera · VERFRUT -> Leandro Morales.
   3) Boton de recordatorio por WhatsApp al celular del trabajador, solo en los
      registros EN PROCESO.

   Nada de esto reescribe funciones del sistema: se agrega al lado.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var RESP_LEANDRO_V3 = 'LEANDRO BILL MORALES YARLEQUE';
var RESP_TANIA_V3   = 'RUBI FIGUEROA FLORES';   /* _RESP_RUBI_V1 */

/* ── 1) Quien autoriza cada documento ───────────────────────────────────── */
var AUTORIZA_POR = {};
[ '01 CITT - EMPRESA VERFRUT',
  '02 CITT - EMPRESA RAPEL',
  '03 REGULARIZAR CITT - GENERAR FORMULARIO',
  '16 CONSTANCIA DE HOSPITALIZACION - GENERAR FORMULARIO / JUSTIFICAR',
  '17 ESSALUD CITA (JUSTIFICACION)',
  '21 LICENCIA POR ENFERMEDAD GRAVE VERFRUT / RAPEL',
  '23 REGULARIZAR LICENCIA POR MATERNIDAD - GENERAR FORMULARIO',
  '26 REGULARIZAR LICENCIA POR ENFERMEDAD GRAVE - GENERAR FORMULARIO',
  '34 LICENCIA POR MATERNIDAD',
  '35 DESCANSO MEDICO - ENFERMEDAD',
  '36 DESCANSO MEDICO - MATERNIDAD',
  '37 DESCANSO MEDICO - ACCIDENTE DE TRABAJO',
  '38 DESCANSO MEDICO - ACCIDENTE COMUN',
  '39 DESCANSO MEDICO - ENFERMEDAD PROFESIONAL',
  '40 DESCANSO MEDICO - PATERNIDAD',
  '41 LICENCIA POR ENFERMEDAD GRAVE O TERMINAL'
].forEach(function (k) { AUTORIZA_POR[k] = 'ESSALUD'; });

[ '04 CMP - EMPRESA VERFRUT / RAPEL',
  '05 REGULARIZAR CMP - GENERAR FORMULARIO',
  '14 FORMULARIO DE INTERCONSULTA',
  '22 RECETA MEDICA (JUSTIFICACION)',
  '29 CMP - VALIDADO POR SIS',
  '30 FORMULARIO INTERCONSULTA'
].forEach(function (k) { AUTORIZA_POR[k] = 'CMP'; });

[ '06 CERTIFICADO ODONTOLOGICO',
  '07 REGULARIZAR CERTIFICADO ODONTOLOGICO - GENERAR FORMULARIO'
].forEach(function (k) { AUTORIZA_POR[k] = 'COP'; });

window._AUTORIZA_POR = AUTORIZA_POR;

/* Si el documento no esta en la tabla, se deduce por el texto */
function _autorizaDe(doc) {
  var exacto = AUTORIZA_POR[String(doc || '').trim()];
  if (exacto) return exacto;
  var t = String(doc || '').toUpperCase()
            .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
            .replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U');
  if (!t) return '';
  if (t.indexOf('ODONTOLOG') >= 0) return 'COP';
  if (t.indexOf('CMP') >= 0 || t.indexOf('INTERCONSULTA') >= 0) return 'CMP';
  if (t.indexOf('CITT') >= 0 || t.indexOf('DESCANSO MEDICO') >= 0 ||
      t.indexOf('ESSALUD') >= 0 || t.indexOf('MATERNIDAD') >= 0) return 'ESSALUD';
  return '';
}
window._autorizaDe = _autorizaDe;

/* Crea el campo una sola vez, arriba del N° de licencia */
function _crearCampoAutoriza() {
  if (document.getElementById('at_autoriz')) return;
  var ref = document.getElementById('at_doc_wrap') || document.getElementById('at_doc_txt');
  if (!ref || !ref.parentNode) return;

  var caja = document.createElement('div');
  caja.id = 'at_autoriz_wrap';
  caja.className = 'fc';
  caja.style.cssText = 'margin-top:10px';
  caja.innerHTML =
    '<label>Autorizado por</label>' +
    '<select id="at_autoriz">' +
      '<option value="">— sin definir —</option>' +
      '<option value="ESSALUD">ESSALUD</option>' +
      '<option value="CMP">CMP</option>' +
      '<option value="COP">COP</option>' +
      '<option value="OTRO">OTRO</option>' +
    '</select>' +
    '<div id="at_autoriz_ayuda" style="font-size:11.5px;color:#334155;background:#f1f5f9;' +
    'border:1px solid #e2e8f0;border-radius:7px;padding:6px 9px;margin-top:5px;line-height:1.5">' +
    'Se llena solo segun el documento. Si hace falta, se puede cambiar a mano.</div>';

  var licBox = document.getElementById('at_nlic_wrap');
  if (licBox && licBox.parentNode === ref.parentNode) {
    ref.parentNode.insertBefore(caja, licBox);
  } else {
    ref.parentNode.appendChild(caja);
  }
}

function _refrescarAutoriza() {
  try {
    _crearCampoAutoriza();
    var sel = document.getElementById('at_autoriz');
    if (!sel) return;

    var txt = document.getElementById('at_doc_txt');
    var ocu = document.getElementById('at_doc');
    var doc = String((txt && txt.value) || (ocu && ocu.value) || '').trim();

    var quien = _autorizaDe(doc);
    /* Si el usuario ya lo cambio a mano para ESTE mismo documento, se respeta */
    if (sel.dataset && sel.dataset.docManual === doc && sel.value) return;
    sel.value = quien || '';
    var ayuda = document.getElementById('at_autoriz_ayuda');
    if (ayuda) {
      ayuda.innerHTML = quien
        ? 'Autorizado por <b>' + quien + '</b>, segun el documento elegido. Se puede cambiar a mano.'
        : 'Este documento no tiene un autorizador definido. Eligelo si corresponde.';
    }
  } catch (e) {}
}
window._refrescarAutoriza = _refrescarAutoriza;

/* Marcar cuando el usuario lo cambia a mano, para no pisarselo */
document.addEventListener('change', function (e) {
  try {
    if (e.target && e.target.id === 'at_autoriz') {
      var txt = document.getElementById('at_doc_txt');
      var ocu = document.getElementById('at_doc');
      var doc = String((txt && txt.value) || (ocu && ocu.value) || '').trim();
      if (e.target.dataset) e.target.dataset.docManual = doc;
    }
  } catch (x) {}
}, true);

['input', 'change', 'blur'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    try {
      if (e.target && (e.target.id === 'at_doc_txt' || e.target.id === 'at_doc')) _refrescarAutoriza();
    } catch (x) {}
  }, true);
});

var _autoOrig3 = window.autoResponsable;
if (typeof _autoOrig3 === 'function') {
  window.autoResponsable = function () {
    var r = _autoOrig3.apply(this, arguments);
    try { _refrescarAutoriza(); } catch (e) {}
    return r;
  };
}

/* ── 2) Ruteo por empresa para las licencias que faltaban ───────────────── */
try {
  var mapa = window._DOC_POR_EMPRESA;
  if (mapa) {
    [ '19 LICENCIA POR PATERNIDAD VERFRUT / RAPEL',
      '20 LICENCIA POR FALLECIMIENTO VERFRUT / RAPEL',
      '21 LICENCIA POR ENFERMEDAD GRAVE VERFRUT / RAPEL',
      '34 LICENCIA POR MATERNIDAD'
    ].forEach(function (doc) {
      mapa[doc] = { RAPEL: RESP_TANIA_V3, VERFRUT: RESP_LEANDRO_V3 };
    });
  }
} catch (e) {}

/* ── 3) Recordatorio por WhatsApp ───────────────────────────────────────── */
function _atPorNro(nro) {
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

function _celPeru(cel) {
  var n = String(cel || '').replace(/\D/g, '');
  if (n.length === 9  && n.charAt(0) === '9') return '51' + n;
  if (n.length === 11 && n.substring(0, 2) === '51') return n;
  if (n.length === 8) return '';                 // incompleto
  return n.length >= 9 ? n : '';
}

window.recordarWhatsApp = async function (nro) {
  var a = _atPorNro(nro);
  if (!a) { mostrarToast('No encuentro ese registro en pantalla', 'error'); return; }

  var tel = _celPeru(a.celular);
  if (!tel) { mostrarToast('El celular del registro no es valido: ' + (a.celular || '(vacio)'), 'error'); return; }

  var nombre = String(a.nombre || '').trim().split(/\s+/).slice(0, 2).join(' ');
  var texto =
    'Hola ' + (nombre || 'estimado(a)') + ', le saluda el area de Relaciones Laborales de ' +
    (a.empresa || 'la empresa') + '.\n\n' +
    'Le recordamos que tiene un documento pendiente de regularizar:\n' +
    '- ' + (a.detalle_documento || 'documento') + '\n' +
    (a.fecha_atencion ? '- Registrado el ' + String(a.fecha_atencion).substring(0, 10) + '\n' : '') +
    '\nPor favor acercarse a la oficina de Relaciones Laborales para completarlo. Gracias.';

  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Se abrira WhatsApp con este mensaje para ' + (a.nombre || '') +
                       ' (' + a.celular + '):\n\n' + texto)
    : confirm('Enviar recordatorio a ' + (a.nombre || '') + '?');
  if (!ok) return;

  window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto), '_blank');
  mostrarToast('WhatsApp abierto con el recordatorio listo para enviar');
};

/* Al abrir el formulario */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(_refrescarAutoriza, 400); });
} else {
  setTimeout(_refrescarAutoriza, 400);
}

console.log('[_ATENCION_V3] autorizado por, ruteo de licencias y recordatorio WhatsApp listos');
})();

