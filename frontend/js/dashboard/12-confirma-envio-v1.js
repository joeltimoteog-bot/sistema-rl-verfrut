/* dashboard.html · bloque 12 (antes en la linea 11379) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CONFIRMA_ENVIO_V1 (26-ago-2026) — Preguntar al guardar si el documento
   ya está finalizado
   ---------------------------------------------------------------------------
   Al dar Guardar en una atención NUEVA sale la pregunta:
        ¿El documento está finalizado?
        SÍ  -> se guarda como ENVIADO
        NO  -> se guarda como EN PROCESO

   ORDEN IMPORTANTE: primero se revisa que el formulario esté completo. Si falta
   el DNI, el nombre, el documento o el N° de licencia, NO se pregunta nada: se
   deja que salga el aviso de siempre con todo lo que falta, para que el usuario
   no conteste la pregunta y recién ahí descubra que le faltaban campos.

   En modo EDICIÓN no pregunta: ahí ya está el botón "Marcar como enviado" del
   modal. Y no se toca nada de las observaciones: su aviso sigue igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* Las mismas cuatro reglas que valida el formulario */
function _formularioCompleto() {
  try {
    var dni = String((document.getElementById('at_dni') || {}).value || '').trim();
    var nom = String((document.getElementById('at_nom') || {}).value || '').trim();
    var doc = String((document.getElementById('at_doc') || {}).value ||
                     (document.getElementById('at_doc_txt') || {}).value || '').trim();
    if (!/^\d{8}$/.test(dni)) return false;
    if (!nom) return false;
    if (!doc) return false;
    if (typeof window._licenciaObligatoria === 'function' && window._licenciaObligatoria(doc)) {
      var lic = String((document.getElementById('at_nlic') || {}).value || '').trim();
      if (!lic) return false;
    }
    return true;
  } catch (e) { return true; }   // ante la duda, que decida la validación original
}

function _preguntarFinalizado() {
  return new Promise(function (resolver) {
    try {
      var viejo = document.getElementById('_confEnvio');
      if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);

      var doc = String((document.getElementById('at_doc') || {}).value ||
                       (document.getElementById('at_doc_txt') || {}).value || '');
      var nom = String((document.getElementById('at_nom') || {}).value || '');

      var ov = document.createElement('div');
      ov.id = '_confEnvio';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,17,.55);z-index:99999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px';
      ov.innerHTML =
        '<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:22px 24px;' +
        'box-shadow:0 18px 50px rgba(0,0,0,.32);font-family:Barlow,system-ui,sans-serif;color:#334155">' +
          '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:21px;font-weight:800;' +
          'color:#0b1e45;margin-bottom:6px">¿El documento está finalizado?</div>' +
          '<div style="font-size:13.5px;line-height:1.65;margin-bottom:6px">' +
            (nom ? '<b>' + nom + '</b><br>' : '') +
            (doc ? '<span style="color:#64748b">' + doc + '</span>' : '') + '</div>' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:11px 13px;' +
          'font-size:12.5px;line-height:1.7;margin:12px 0 16px">' +
            '<b style="color:#166534">SÍ</b> — el documento ya se envió: se guarda como <b>ENVIADO</b>.<br>' +
            '<b style="color:#b45309">NO</b> — todavía falta enviarlo: se guarda como <b>EN PROCESO</b>.' +
          '</div>' +
          '<div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap">' +
            '<button type="button" id="_ceCancelar" style="background:#fff;color:#64748b;border:1.5px solid #cbd5e1;' +
            'border-radius:8px;padding:8px 15px;font-weight:700;font-size:13px;cursor:pointer">Cancelar</button>' +
            '<button type="button" id="_ceNo" style="background:#b45309;color:#fff;border:none;' +
            'border-radius:8px;padding:8px 20px;font-weight:800;font-size:13px;cursor:pointer">NO</button>' +
            '<button type="button" id="_ceSi" style="background:#166534;color:#fff;border:none;' +
            'border-radius:8px;padding:8px 22px;font-weight:800;font-size:13px;cursor:pointer">SÍ</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);

      var cerrado = false;
      function cerrar(valor) {
        if (cerrado) return;
        cerrado = true;
        try { document.removeEventListener('keydown', porTecla, true); } catch (e) {}
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        resolver(valor);
      }
      function porTecla(ev) { if (ev.key === 'Escape') cerrar('cancelar'); }

      document.getElementById('_ceSi').addEventListener('click', function () { cerrar('si'); });
      document.getElementById('_ceNo').addEventListener('click', function () { cerrar('no'); });
      document.getElementById('_ceCancelar').addEventListener('click', function () { cerrar('cancelar'); });
      ov.addEventListener('click', function (ev) { if (ev.target === ov) cerrar('cancelar'); });
      document.addEventListener('keydown', porTecla, true);
      try { document.getElementById('_ceSi').focus(); } catch (e) {}

    } catch (e) { resolver('no'); }   // si el diálogo falla, se guarda EN PROCESO
  });
}
window._preguntarFinalizado = _preguntarFinalizado;

var _guardarOrig = window.guardarAt;
if (typeof _guardarOrig === 'function') {
  window.guardarAt = function () {
    var args = arguments, self = this;
    try {
      if (window._savingAt) return;                       // respeta el candado anti doble clic

      var esEdicion = String((document.getElementById('at_nro_edit') || {}).value || '').trim() !== '';
      if (esEdicion || !_formularioCompleto()) {
        return _guardarOrig.apply(self, args);            // que salga el aviso de siempre
      }
      /* _AT_REG_EN_PROCESO_V1 (06-oct-2026): las REGULARIZACIONES no preguntan: su estado
         ya lo puso el formulario (EN PROCESO automatico al elegir el documento). */
      var _docReg = String((document.getElementById('at_doc') || {}).value ||
                           (document.getElementById('at_doc_txt') || {}).value || '');
      if (_docReg.toUpperCase().indexOf('REGULARIZAR') >= 0) {
        return _guardarOrig.apply(self, args);
      }

      return _preguntarFinalizado().then(function (r) {
        if (r === 'cancelar') return;                     // no guarda nada
        var sel = document.getElementById('at_est');
        if (sel) {
          var valor = (r === 'si') ? 'ENVIADO' : 'EN PROCESO';
          var existe = false;
          for (var i = 0; i < sel.options.length; i++) {
            if (String(sel.options[i].value).toUpperCase() === valor) { existe = true; break; }
          }
          if (!existe) {
            var o = document.createElement('option');
            o.value = valor; o.textContent = valor; sel.appendChild(o);
          }
          sel.value = valor;
        }
        return _guardarOrig.apply(self, args);
      });
    } catch (e) {
      return _guardarOrig.apply(self, args);
    }
  };
}

})();
