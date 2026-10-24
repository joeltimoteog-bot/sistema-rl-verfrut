/* dashboard.html · bloque 58 (antes en la linea 17383) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _AT_TIPO_LICENCIA_V4 (06-oct-2026) — Nueva Atencion: catalogo sin empresa,
   Tipo de licencia, responsable y "Autorizado por" segun la empresa
   ---------------------------------------------------------------------------
   Definido con Joel (06-oct):
   1) Los descansos medicos (35-41) se eligen como UN documento
      "35 DESCANSO MEDICO / LICENCIA" + campo "Tipo de licencia" (obligatorio).
      Se GUARDA con el mismo texto de siempre (p. ej. "36 DESCANSO MEDICO -
      MATERNIDAD") para que reportes, N° de licencia y parentesco sigan igual.
      Nuevo tipo: "42 DESCANSO MEDICO - ACCIDENTE DE TRANSITO".
   2) Nombres sin empresa (solo registros nuevos; lo guardado no se toca):
      01 + 02 CITT -> "01 CITT"; se quita "VERFRUT / RAPEL" de 04, 08, 09, 15,
      19, 20 y 21. Los nombres viejos ya no salen en el buscador.
   3) Responsable segun la empresa del trabajador (RAPEL -> Rubi Figueroa ·
      VERFRUT -> Leandro Morales): CITT, descansos/licencias, maternidad,
      paternidad, fallecimiento y enfermedad grave.
      ARREGLO: esos dos nombres NO estaban en la lista "Responsable Recepcion",
      asi que el campo quedaba EN BLANCO. Ahora se agregan a la lista.
   4) "Autorizado por": ESSALUD · CMP · COP · Rubi (RAPEL) · Leandro (VERFRUT)
      · OTRO. Paternidad, fallecimiento y enfermedad grave/terminal (licencias
      que otorga la empresa) -> Rubi o Leandro segun la empresa.
   NO toca Azure ni Google ni la forma de guardar. Si algo aqui falla, el
   formulario sigue como estaba.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
try {

var RESP_RUBI    = 'RUBI FIGUEROA FLORES';            /* responsable (mismo texto que ya se guarda) */
var RESP_LEANDRO = 'LEANDRO BILL MORALES YARLEQUE';
var AUT_RUBI     = 'RUBI ELIZABETH FIGUEROA FLORES - EMPRESA RAPEL';
var AUT_LEANDRO  = 'LEANDRO BILL MORALES YARLEQUE - EMPRESA VERFRUT';

var DM_ETIQUETA = '35 DESCANSO MEDICO';   /* _AT_TIPO_LIC_V1: un solo documento; el tipo va en el campo general "Tipo de licencia" */
var TIPOS = [   /* [lo que ve el usuario, lo que se guarda] */
  ['ENFERMEDAD',                    '35 DESCANSO MEDICO - ENFERMEDAD'],
  ['MATERNIDAD',                    '36 DESCANSO MEDICO - MATERNIDAD'],
  ['ACCIDENTE DE TRABAJO',          '37 DESCANSO MEDICO - ACCIDENTE DE TRABAJO'],
  ['ACCIDENTE COMUN',               '38 DESCANSO MEDICO - ACCIDENTE COMUN'],
  ['ENFERMEDAD PROFESIONAL',        '39 DESCANSO MEDICO - ENFERMEDAD PROFESIONAL'],
  ['PATERNIDAD',                    '40 DESCANSO MEDICO - PATERNIDAD'],
  ['ACCIDENTE DE TRANSITO',         '42 DESCANSO MEDICO - ACCIDENTE DE TRANSITO'],
  ['ENFERMEDAD GRAVE O TERMINAL',   '41 LICENCIA POR ENFERMEDAD GRAVE O TERMINAL']
];
var GUARDA_TIPO = {}; TIPOS.forEach(function (t) { GUARDA_TIPO[t[1]] = t[0]; });

/* ── 2) Catalogo ─────────────────────────────────────────────────────────── */
var RENOMBRA = {   /* viejo -> nuevo (el viejo se oculta del buscador) */
  '01 CITT - EMPRESA VERFRUT': '01 CITT',
  '02 CITT - EMPRESA RAPEL': '01 CITT',
  '04 CMP - EMPRESA VERFRUT / RAPEL': '04 CMP',
  '08 INGRESO AL PROGRAMA DE GESTANTES VERFRUT / RAPEL': '08 INGRESO AL PROGRAMA DE GESTANTES',
  '09 INGRESO A HORAS DE LACTANCIA VERFRUT / RAPEL': '09 INGRESO A HORAS DE LACTANCIA',
  '15 HORAS DE LACTANCIA VERFRUT / RAPEL': '15 HORAS DE LACTANCIA',
  '19 LICENCIA POR PATERNIDAD VERFRUT / RAPEL': '19 LICENCIA POR PATERNIDAD',
  '20 LICENCIA POR FALLECIMIENTO VERFRUT / RAPEL': '20 LICENCIA POR FALLECIMIENTO',
  '21 LICENCIA POR ENFERMEDAD GRAVE VERFRUT / RAPEL': '21 LICENCIA POR ENFERMEDAD GRAVE'
};
var OCULTOS = {};
Object.keys(RENOMBRA).forEach(function (k) { OCULTOS[k] = 1; });
TIPOS.forEach(function (t) { OCULTOS[t[1]] = 1; });   /* los tipos se eligen desde el campo nuevo */

/* responsable de cada nombre nuevo = el que tenia el viejo */
Object.keys(RENOMBRA).forEach(function (viejo) {
  var nuevo = RENOMBRA[viejo];
  if (!(nuevo in DOC_RESP)) DOC_RESP[nuevo] = DOC_RESP[viejo] || '';
  delete DOC_RESP[viejo];
});
TIPOS.forEach(function (t) { delete DOC_RESP[t[1]]; });   /* se eligen desde "Tipo de licencia" */
DOC_RESP[DM_ETIQUETA] = RESP_RUBI;   /* lo corrige el ruteo por empresa */
/* Reordenar: el buscador muestra el catalogo en orden de numero */
(function () {
  var pares = Object.keys(DOC_RESP).map(function (k) { return [k, DOC_RESP[k]]; });
  pares.sort(function (a, b) {
    var na = parseInt(a[0], 10), nb = parseInt(b[0], 10);
    if (isNaN(na) && isNaN(nb)) return a[0].localeCompare(b[0]);
    if (isNaN(na)) return 1; if (isNaN(nb)) return -1;
    return na - nb;
  });
  Object.keys(DOC_RESP).forEach(function (k) { delete DOC_RESP[k]; });
  pares.forEach(function (p) { DOC_RESP[p[0]] = p[1]; });
})();

/* Buscador: catalogo nuevo + documentos usados antes, menos los viejos */
var _getDocListOrig = window._getDocList;
if (typeof _getDocListOrig === 'function') {
  window._getDocList = function () {
    var l = _getDocListOrig.apply(this, arguments) || [];
    return l.filter(function (d) {
      if (OCULTOS[d]) return false;
      var u = String(d).toUpperCase();
      if (/EMPRESA (VERFRUT|RAPEL)/.test(u) || u.indexOf('VERFRUT / RAPEL') >= 0) return false;
      return true;
    });
  };
  try { _atDocList = window._getDocList(); } catch (e) {}
}

/* ── 3) Responsable segun empresa ────────────────────────────────────────── */
function _opcion(sel, valor, texto) {
  if (!sel) return;
  for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === valor) return;
  var o = document.createElement('option'); o.value = valor; o.textContent = texto || valor; sel.appendChild(o);
}
function _asegurarResponsables() {
  var s = document.getElementById('at_resp');
  _opcion(s, RESP_RUBI); _opcion(s, RESP_LEANDRO);
}
var mapa = window._DOC_POR_EMPRESA;
if (mapa) {
  ['01 CITT', DM_ETIQUETA, '19 LICENCIA POR PATERNIDAD', '20 LICENCIA POR FALLECIMIENTO',
   '21 LICENCIA POR ENFERMEDAD GRAVE', '34 LICENCIA POR MATERNIDAD',
   /* _AT_REG_EMPRESA_V1 (06-oct): las REGULARIZACIONES tambien van por empresa (antes, Muriel Mechato) */
   '03 REGULARIZAR CITT - GENERAR FORMULARIO', '05 REGULARIZAR CMP - GENERAR FORMULARIO',
   '07 REGULARIZAR CERTIFICADO ODONTOLOGICO - GENERAR FORMULARIO',
   '23 REGULARIZAR LICENCIA POR MATERNIDAD - GENERAR FORMULARIO', '24 REGULARIZAR LICENCIA POR PATERNIDAD - GENERAR FORMULARIO',
   '25 REGULARIZAR LICENCIA POR DEFUNCION - GENERAR FORMULARIO', '26 REGULARIZAR LICENCIA POR ENFERMEDAD GRAVE - GENERAR FORMULARIO'
  ].concat(TIPOS.map(function (t) { return t[1]; }))
    .forEach(function (doc) { mapa[doc] = { RAPEL: RESP_RUBI, VERFRUT: RESP_LEANDRO }; });
}

/* ── 1) Campo "Tipo de licencia" ─────────────────────────────────────────── */
function _docTxt() { var t = document.getElementById('at_doc_txt'); return String((t && t.value) || '').trim(); }
function _crearTipo() {
  if (document.getElementById('at_tlic')) return;
  var ref = document.getElementById('at_doc_wrap');
  if (!ref || !ref.parentNode) return;
  var caja = document.createElement('div');
  caja.id = 'at_tlic_wrap';
  caja.className = 'fc';
  caja.style.cssText = 'display:none;margin-top:10px';
  caja.innerHTML =
    '<label>Tipo de descanso médico <span style="color:#dc2626">*</span></label>' +
    '<select id="at_tlic" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box">' +
      '<option value="">— selecciona el tipo de descanso médico —</option>' +
      TIPOS.map(function (t) { return '<option value="' + t[1] + '">' + t[0] + '</option>'; }).join('') +
    '</select>';
  ref.parentNode.insertBefore(caja, ref.nextSibling);
  document.getElementById('at_tlic').addEventListener('change', function () {
    var val = this.value;
    var txt = document.getElementById('at_doc_txt');
    if (val) {
      if (txt) txt.value = val;
      if (typeof sv === 'function') sv('at_doc', val);
    } else {
      if (txt) txt.value = DM_ETIQUETA;
      if (typeof sv === 'function') sv('at_doc', '');
    }
    try { if (typeof autoResponsable === 'function') autoResponsable(); } catch (e) {}
    try { if (txt) txt.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    _refrescar();
  });
}
function _refrescarTipo() {
  _crearTipo();
  var caja = document.getElementById('at_tlic_wrap'), sel = document.getElementById('at_tlic');
  if (!caja || !sel) return;
  caja.style.display = 'none'; return;   /* _AT_TIPO_LIC_V1: reemplazado por el campo general "Tipo de licencia" */
  var d = _docTxt();
  if (d === DM_ETIQUETA) { caja.style.display = ''; if (sel.value) sel.value = ''; }
  else if (GUARDA_TIPO[d]) { caja.style.display = ''; sel.value = d; }
  else { caja.style.display = 'none'; sel.value = ''; }
}

/* Al elegir "35 DESCANSO MEDICO / LICENCIA": el documento queda pendiente del tipo */
var _selOrig = window._selectAtDoc;
if (typeof _selOrig === 'function') {
  window._selectAtDoc = function (val) {
    var r = _selOrig.apply(this, arguments);
    try {
      if (false && val === DM_ETIQUETA) {   /* _AT_TIPO_LIC_V1: ya no hace falta */
        if (typeof sv === 'function') sv('at_doc', '');
        _refrescar();
        setTimeout(function () { var s = document.getElementById('at_tlic'); if (s) s.focus(); }, 60);
      } else { _refrescar(); }
    } catch (e) {}
    return r;
  };
}

/* Al guardar sin tipo: aviso claro (la validacion original ya frena por "Documento") */
var _guardarOrig = window.guardarAt;
if (typeof _guardarOrig === 'function') {
  window.guardarAt = function () {
    try {
      if (_docTxt() === DM_ETIQUETA && !String((document.getElementById('at_doc') || {}).value || '')) {
        var s = document.getElementById('at_tlic');
        if (s) { s.focus(); s.style.borderColor = '#ef4444'; setTimeout(function () { s.style.borderColor = ''; }, 2500); }
        if (typeof mostrarToast === 'function') mostrarToast('Falta completar: Tipo de descanso médico', 'error');
        return;
      }
    } catch (e) {}
    return _guardarOrig.apply(this, arguments);
  };
}

/* ── 4) Autorizado por ───────────────────────────────────────────────────── */
var AUT_OPCIONES = [
  ['', '— sin definir —'],
  ['ESSALUD', 'ESSALUD'],
  ['CMP', 'CMP – Certificado médico particular'],
  ['COP', 'COP – Certificado odontológico particular'],
  [AUT_RUBI, 'RUBI ELIZABETH FIGUEROA FLORES – EMPRESA RAPEL'],
  [AUT_LEANDRO, 'LEANDRO BILL MORALES YARLEQUE – EMPRESA VERFRUT'],
  ['OTRO', 'OTRO']
];
function _asegurarAutoriza() {
  var s = document.getElementById('at_autoriz');
  if (!s || s.dataset.v4) return;
  var actual = s.value;
  s.innerHTML = AUT_OPCIONES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
  s.dataset.v4 = '1';
  if (actual) { _opcion(s, actual); s.value = actual; }
}
/* licencias que otorga la empresa (no ESSALUD) */
function _esLicenciaEmpresa(doc) {
  var t = String(doc || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!t || t.indexOf('REGULARIZAR') >= 0) return false;
  /* _AT_TIPO_LIC_V1: descanso medico de paternidad o enfermedad grave = licencia de la empresa */
  try { var tl = String(window._atTipoLicValor ? window._atTipoLicValor() : '').toUpperCase(); if (t.indexOf('DESCANSO MEDICO') >= 0 && (tl.indexOf('PATERNIDAD') >= 0 || tl.indexOf('ENFERMEDAD GRAVE') >= 0)) return true; } catch (e) {}
  return t.indexOf('PATERNIDAD') >= 0 || t.indexOf('FALLECIMIENTO') >= 0 || t.indexOf('ENFERMEDAD GRAVE') >= 0;
}
function _empresa() { return String((document.getElementById('at_emp') || {}).value || '').toUpperCase(); }
function _refrescarAutorizaV4() {
  _asegurarAutoriza();
  var s = document.getElementById('at_autoriz');
  if (!s) return;
  var doc = _docTxt();
  if (s.dataset && s.dataset.docManual === doc && s.value) return;    /* lo cambio a mano: se respeta */
  var ayuda = document.getElementById('at_autoriz_ayuda');
  if (_esLicenciaEmpresa(doc)) {
    var e = _empresa(), quien = e.indexOf('RAPEL') >= 0 ? AUT_RUBI : (e.indexOf('VERFRUT') >= 0 ? AUT_LEANDRO : '');
    if (s.value !== quien) s.value = quien;
    if (ayuda) ayuda.innerHTML = quien
      ? 'Licencia otorgada por la empresa: autoriza <b>' + quien + '</b>. Se puede cambiar a mano.'
      : '⚠️ Busca primero el DNI para saber la empresa (Rubí o Leandro).';
  } else if (s.value === AUT_RUBI || s.value === AUT_LEANDRO) {
    /* venia de otro documento: que lo recalcule la regla de siempre */
    try { if (typeof window._refrescarAutoriza === 'function') window._refrescarAutoriza(); } catch (e2) {}
  }
}

/* ── _AT_REG_EN_PROCESO_V1: Regularizar -> estado EN PROCESO automatico ────
   Solo en atenciones NUEVAS y solo cuando CAMBIA el documento: si el usuario
   luego cambia el estado a mano, se respeta. Si deja de ser regularizacion y el
   estado lo habia puesto el sistema, vuelve a FINALIZADO. */
var _docEstadoUlt = null, _estadoAuto = false;
function _estadoPorDocumento() {
  var esNueva = !String((document.getElementById('at_nro_edit') || {}).value || '').trim();
  var doc = _docTxt();
  if (doc === _docEstadoUlt) return;
  _docEstadoUlt = doc;
  if (!esNueva) return;
  var est = document.getElementById('at_est');
  if (!est) return;
  var esReg = doc.toUpperCase().indexOf('REGULARIZAR') >= 0;
  var nuevo = null;
  if (esReg && est.value !== 'EN PROCESO') { nuevo = 'EN PROCESO'; _estadoAuto = true; }
  else if (!esReg && _estadoAuto) { nuevo = 'FINALIZADO'; _estadoAuto = false; }
  if (nuevo) {
    est.value = nuevo;
    try { est.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}   /* refresca el N° de licencia */
    [60, 400].forEach(function (ms) { setTimeout(function () { try { if (typeof window._refrescarCampoLicencia === 'function') window._refrescarCampoLicencia(); } catch (e) {} }, ms); });
    var aviso = document.getElementById('_avisoEstadoReg');
    if (esReg) {
      if (!aviso && est.parentNode) {
        aviso = document.createElement('div'); aviso.id = '_avisoEstadoReg';
        aviso.style.cssText = 'margin-top:5px;font-size:11.5px;line-height:1.45;padding:6px 9px;border-radius:7px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412';
        est.parentNode.appendChild(aviso);
      }
      if (aviso) aviso.innerHTML = '⏳ Documento por regularizar: el estado queda <b>EN PROCESO</b> automáticamente.';
    } else if (aviso) { aviso.remove(); }
  }
}
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'at_est' && e.isTrusted) { _estadoAuto = false; var av = document.getElementById('_avisoEstadoReg'); if (av) av.remove(); }   /* solo cambios hechos por el usuario */
}, true);

/* ── Un solo refresco, al tocar documento, empresa o DNI ─────────────────── */
var _ult = '';
function _refrescar() {
  try { _estadoPorDocumento(); } catch (e) {}
  try { _asegurarResponsables(); } catch (e) {}
  try { _refrescarTipo(); } catch (e) {}
  try { _refrescarAutorizaV4(); } catch (e) {}
  try { if (typeof window._aplicarRuteoEmpresa === 'function') window._aplicarRuteoEmpresa(); } catch (e) {}
  _ult = _docTxt() + '|' + _empresa();
}
['input', 'change', 'blur'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var id = e.target && e.target.id;
    if (id === 'at_doc_txt' || id === 'at_doc' || id === 'at_emp') setTimeout(_refrescar, 0);
  }, false);   /* despues de los avisos existentes */
});
/* la busqueda por DNI cambia la empresa sin avisar: se revisa mientras el formulario esta abierto */
setInterval(function () {
  try {
    var m = document.getElementById('mAt');
    if (!m || !m.classList.contains('on')) return;
    if (_docTxt() + '|' + _empresa() !== _ult) _refrescar();
    /* _AT_REG_EN_PROCESO_V1: EN PROCESO no pide N° de licencia -> que no quede a la vista */
    var _est = document.getElementById('at_est'), _cj = document.getElementById('at_nlic_wrap');
    if (_est && _cj && String(_est.value).toUpperCase().indexOf('PROCESO') >= 0 && _cj.style.display !== 'none' &&
        typeof window._refrescarCampoLicencia === 'function') window._refrescarCampoLicencia();
  } catch (e) {}
}, 300);

var _abrirOrig = window.abrirAt;
if (typeof _abrirOrig === 'function') {
  window.abrirAt = function () {
    var r = _abrirOrig.apply(this, arguments);
    try { var s = document.getElementById('at_autoriz'); if (s && s.dataset) delete s.dataset.docManual; } catch (e) {}
    _docEstadoUlt = null; _estadoAuto = false; try { var _av = document.getElementById('_avisoEstadoReg'); if (_av) _av.remove(); } catch (e) {}
    setTimeout(_refrescar, 50);
    return r;
  };
}
var _editarOrig = window.editarAt;
if (typeof _editarOrig === 'function') {
  window.editarAt = function () {
    var r = _editarOrig.apply(this, arguments);
    setTimeout(function () {
      _refrescar();
      /* respetar el "autorizado por" guardado (lo carga editarAt a los 80 ms) */
      setTimeout(function () { try { var s = document.getElementById('at_autoriz'); if (s && s.dataset) s.dataset.docManual = _docTxt(); } catch (e) {} }, 60);
    }, 30);
    return r;
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _refrescar); else _refrescar();
setTimeout(_refrescar, 1500);
window._atV4Refrescar = _refrescar;   /* _AT_TIPO_LIC_V1 */
console.log('[_AT_TIPO_LICENCIA_V4] tipo de licencia, catalogo sin empresa, responsable y autorizado por empresa listos');

} catch (eV4) { console.warn('[_AT_TIPO_LICENCIA_V4] no se aplico (el formulario sigue como antes):', eV4); }
})();
