/* dashboard.html · bloque 59 (antes en la linea 17722) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _AT_AVISO_REGULARIZAR_V1 (06-oct-2026) — Recordatorio al registrar una
   atencion "por regularizar" documentacion (CITT, CMP, odontologico,
   maternidad, paternidad, defuncion, enfermedad grave: los "REGULARIZAR ...
   - GENERAR FORMULARIO").
   · Sale DESPUES de que el servidor confirma el guardado (no lo frena ni lo
     cambia). Se cierra solo a los 9 s o con un clic.
   · Solo en atenciones NUEVAS (saveAtencion), no al editar.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
try {
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function esRegularizar(doc) {
    return String(doc || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf('REGULARIZAR') >= 0;
  }
  function mostrar(b) {
    var viejo = document.getElementById('rlAvisoRegularizar');
    if (viejo) viejo.remove();
    var d = document.createElement('div');
    d.id = 'rlAvisoRegularizar';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:100000;width:min(520px,calc(100vw - 32px));' +
      'background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.22);' +
      'padding:14px 16px 12px;font:13.5px/1.5 system-ui,sans-serif;color:#78350f;cursor:pointer';
    var resp = String(b.responsable_recepcion || '').trim();
    d.innerHTML =
      '<div style="font-weight:800;font-size:14.5px;margin-bottom:4px">📝 ¡No te olvides!</div>' +
      'Registraste la atención de <b>' + esc(b.nombre || '') + '</b>' + (b.dni ? ' (DNI ' + esc(b.dni) + ')' : '') +
      ' <b>por regularizar documentación</b>:<br><span style="color:#92400e">' + esc(b.detalle_documento || '') + '</span>.' +
      '<div style="margin-top:6px">Tienes que <b>emitir el formulario correspondiente</b> para que se pueda proceder' +
      (resp ? ' (va dirigido a <b>' + esc(resp) + '</b>' + (b.empresa ? ' · ' + esc(b.empresa) : '') + ')' : '') + '.</div>' +
      '<div style="height:3px;background:#fde68a;border-radius:2px;margin-top:10px;overflow:hidden">' +
        '<div id="rlAvisoRegBarra" style="height:100%;width:100%;background:#f59e0b;transition:width 9s linear"></div></div>' +
      '<div style="font-size:11px;color:#a16207;margin-top:4px;text-align:right">La atención ya quedó guardada · se cierra solo</div>';
    d.onclick = function () { d.remove(); };
    document.body.appendChild(d);
    setTimeout(function () { var br = document.getElementById('rlAvisoRegBarra'); if (br) br.style.width = '0%'; }, 30);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 9000);
  }
  var previo = window.apiPost;
  if (typeof previo !== 'function') return;
  window.apiPost = function (b) {
    var p = previo.apply(this, arguments);
    try {
      if (b && b.action === 'saveAtencion' && esRegularizar(b.detalle_documento)) {
        var copia = { nombre: b.nombre, dni: b.dni, detalle_documento: b.detalle_documento, responsable_recepcion: b.responsable_recepcion, empresa: b.empresa };
        Promise.resolve(p).then(function (r) { if (r && r.success) mostrar(copia); }, function () {});
      }
    } catch (e) {}
    return p;
  };
  try { apiPost = window.apiPost; } catch (e) {}
  window._rlAvisoRegularizar = mostrar;   /* para probarlo desde la consola */
  console.log('[_AT_AVISO_REGULARIZAR_V1] listo');
} catch (eR) { console.warn('[_AT_AVISO_REGULARIZAR_V1] no se aplico:', eR); }
})();
