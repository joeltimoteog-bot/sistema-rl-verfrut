/* dashboard.html · bloque 60 (antes en la linea 17781) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _AT_TIPO_LIC_V1 (07-oct-2026) — Campo "Tipo de licencia" en Nueva Atencion
   · Aparece en CITT, CMP, descanso medico y cualquier LICENCIA (tambien sus
     regularizaciones). Lista: Enfermedad, Maternidad, Accidente de trabajo,
     Accidente comun, Enfermedad profesional, Paternidad, Accidente de transito,
     Lic. enfermedad grave terminal, u OTRO (se escribe).
   · Obligatorio cuando aparece, salvo EN PROCESO.
   · Se guarda en Azure (dbo.Atenciones.tipo_licencia) y en la hoja (col 33),
     se ve en la tabla de Mis Atenciones y sale en el Excel.
   Si algo aqui falla, el formulario sigue como estaba.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
try {
var OPCIONES = ['ENFERMEDAD', 'MATERNIDAD', 'ACCIDENTE DE TRABAJO', 'ACCIDENTE COMUN', 'ENFERMEDAD PROFESIONAL',
                'PATERNIDAD', 'ACCIDENTE DE TRANSITO', 'LIC. ENFERMEDAD GRAVE TERMINAL'];
var OTRO = '__OTRO__';
function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function docActual() { var t = document.getElementById('at_doc_txt'), o = document.getElementById('at_doc'); return String((t && t.value) || (o && o.value) || '').trim(); }
function aplica(doc) { var t = norm(doc); return !!t && /CITT|CMP|DESCANSO MEDICO|LICENCIA/.test(t); }
function enProceso() { var e = document.getElementById('at_est'); return !!e && norm(e.value).indexOf('PROCESO') >= 0; }
/* tipo sugerido segun el documento elegido */
function sugerido(doc) {
  var t = norm(doc);
  if (t.indexOf('ENFERMEDAD GRAVE') >= 0) return 'LIC. ENFERMEDAD GRAVE TERMINAL';
  if (t.indexOf('MATERNIDAD') >= 0) return 'MATERNIDAD';
  if (t.indexOf('PATERNIDAD') >= 0) return 'PATERNIDAD';
  if (t.indexOf('ACCIDENTE DE TRABAJO') >= 0) return 'ACCIDENTE DE TRABAJO';
  if (t.indexOf('ACCIDENTE COMUN') >= 0) return 'ACCIDENTE COMUN';
  if (t.indexOf('ACCIDENTE DE TRANSITO') >= 0) return 'ACCIDENTE DE TRANSITO';
  if (t.indexOf('ENFERMEDAD PROFESIONAL') >= 0) return 'ENFERMEDAD PROFESIONAL';
  if (/DESCANSO MEDICO - ENFERMEDAD$/.test(t)) return 'ENFERMEDAD';
  return '';
}

function crear() {
  if (document.getElementById('at_tlic2')) return;
  var ref = document.getElementById('at_doc_wrap');
  if (!ref || !ref.parentNode) return;
  var caja = document.createElement('div');
  caja.id = 'at_tlic2_wrap';
  caja.className = 'fc';
  caja.style.cssText = 'display:none;margin-top:10px';
  caja.innerHTML =
    '<label>Tipo de licencia <span style="color:#dc2626">*</span></label>' +
    '<select id="at_tlic2" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box">' +
      '<option value="">— selecciona el tipo de licencia —</option>' +
      OPCIONES.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
      '<option value="' + OTRO + '">OTRO (escribir)…</option>' +
    '</select>' +
    '<input type="text" id="at_tlic2_otro" maxlength="100" placeholder="Escribe el tipo de licencia" autocomplete="off" ' +
      'style="display:none;margin-top:6px;width:100%;padding:8px 10px;border:1.5px solid #c0ceea;border-radius:8px;font-size:14px;box-sizing:border-box">';
  ref.parentNode.insertBefore(caja, ref.nextSibling);
  var sel = document.getElementById('at_tlic2'), otro = document.getElementById('at_tlic2_otro');
  sel.addEventListener('change', function () {
    otro.style.display = sel.value === OTRO ? '' : 'none';
    if (sel.value === OTRO) setTimeout(function () { otro.focus(); }, 30); else otro.value = '';
    caja.dataset.manual = '1';
    efectos();
  });
  otro.addEventListener('input', function () { caja.dataset.manual = '1'; });
  otro.addEventListener('change', efectos);
}
function efectos() {
  try { if (typeof window._refrescarCampoParentesco === 'function') window._refrescarCampoParentesco(); } catch (e) {}
  try { if (typeof window._atV4Refrescar === 'function') window._atV4Refrescar(); } catch (e) {}
}
function valor() {
  var caja = document.getElementById('at_tlic2_wrap'), sel = document.getElementById('at_tlic2'), otro = document.getElementById('at_tlic2_otro');
  if (!caja || !sel || caja.style.display === 'none') return '';
  if (sel.value === OTRO) return String((otro && otro.value) || '').trim().toUpperCase().slice(0, 100);
  return sel.value || '';
}
window._atTipoLicValor = valor;
/* pone un valor guardado (de la lista o escrito) */
function poner(v) {
  crear();
  var sel = document.getElementById('at_tlic2'), otro = document.getElementById('at_tlic2_otro');
  if (!sel) return;
  v = String(v || '').trim().toUpperCase();
  if (!v) { sel.value = ''; otro.value = ''; otro.style.display = 'none'; return; }
  if (OPCIONES.indexOf(v) >= 0) { sel.value = v; otro.value = ''; otro.style.display = 'none'; }
  else { sel.value = OTRO; otro.value = v; otro.style.display = ''; }
}
var _docUlt = null;
function refrescar() {
  crear();
  var caja = document.getElementById('at_tlic2_wrap');
  if (!caja) return;
  var doc = docActual();
  if (aplica(doc)) {
    caja.style.display = '';
    if (doc !== _docUlt) {   /* documento nuevo: sugerir el tipo si el usuario no eligio uno */
      if (!caja.dataset.manual) { var s = sugerido(doc); if (s) poner(s); }
    }
  } else if (caja.style.display !== 'none') {
    caja.style.display = 'none'; poner(''); delete caja.dataset.manual;
  }
  _docUlt = doc;
}
['input', 'change', 'blur'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var id = e.target && e.target.id;
    if (id === 'at_doc_txt' || id === 'at_doc') setTimeout(refrescar, 0);
  }, false);
});
setInterval(function () {
  try { var m = document.getElementById('mAt'); if (m && m.classList.contains('on') && docActual() !== _docUlt) refrescar(); } catch (e) {}
}, 400);

/* Nueva atencion: limpio */
var _abrir = window.abrirAt;
if (typeof _abrir === 'function') {
  window.abrirAt = function () {
    var r = _abrir.apply(this, arguments);
    try { poner(''); var c = document.getElementById('at_tlic2_wrap'); if (c) { delete c.dataset.manual; c.style.display = 'none'; } _docUlt = null; } catch (e) {}
    return r;
  };
}
/* Editar: carga lo guardado */
var _editar = window.editarAt;
if (typeof _editar === 'function') {
  window.editarAt = function (nro) {
    var r = _editar.apply(this, arguments);
    try {
      var a = (typeof atTodas !== 'undefined' ? atTodas : []).find(function (x) { return String(x.nro) === String(nro); });
      setTimeout(function () {
        var c = document.getElementById('at_tlic2_wrap');
        _docUlt = docActual();
        if (c) { c.dataset.manual = '1'; c.style.display = aplica(_docUlt) ? '' : 'none'; }
        poner(a && a.tipo_licencia || '');
        if (c && !aplica(_docUlt)) c.style.display = 'none';
      }, 120);
    } catch (e) {}
    return r;
  };
}
/* Validacion: obligatorio cuando aparece (salvo EN PROCESO) */
var _guardar = window.guardarAt;
if (typeof _guardar === 'function') {
  window.guardarAt = function () {
    try {
      refrescar();
      var c = document.getElementById('at_tlic2_wrap');
      if (c && c.style.display !== 'none' && !enProceso() && !valor()) {
        var sel = document.getElementById('at_tlic2'), otro = document.getElementById('at_tlic2_otro');
        var foco = (sel && sel.value === OTRO) ? otro : sel;
        if (foco) { foco.focus(); foco.style.borderColor = '#ef4444'; setTimeout(function () { foco.style.borderColor = '#c0ceea'; }, 2500); }
        if (typeof mostrarToast === 'function') mostrarToast('Falta completar: Tipo de licencia', 'error');
        return;
      }
    } catch (e) {}
    return _guardar.apply(this, arguments);
  };
}
/* Que el dato viaje (nueva, edicion completa y copia a Azure) */
var _api = window.apiPost;
if (typeof _api === 'function') {
  window.apiPost = function (b) {
    try {
      if (b && (b.action === 'saveAtencion' ||
                ((b.action === 'updateAtencion' || b.action === 'syncFirebaseAtencion') && b.autorizado_por !== undefined))) {
        if (b.tipo_licencia === undefined) b.tipo_licencia = valor();
        /* parentesco: que llegue a Azure desde el primer envio (antes solo llegaba por la copia de la hoja) */
        if (b.action === 'saveAtencion' && b.parentesco === undefined && typeof window._parentescoObligatorio === 'function') {
          var _ps = document.getElementById('at_parentesco');
          if (window._parentescoObligatorio(b.detalle_documento || '')) b.parentesco = String((_ps && _ps.value) || '');
        }
      }
    } catch (e) {}
    return _api.apply(this, arguments);
  };
  try { apiPost = window.apiPost; } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refrescar); else refrescar();
console.log('[_AT_TIPO_LIC_V1] campo Tipo de licencia listo');
} catch (eT) { console.warn('[_AT_TIPO_LIC_V1] no se aplico (el formulario sigue como antes):', eT); }
})();
