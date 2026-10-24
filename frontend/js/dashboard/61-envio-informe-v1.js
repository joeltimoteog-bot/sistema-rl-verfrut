/* dashboard.html · bloque 61 (antes en la linea 17962) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ENVIO_INFORME_V1 (09-oct-2026) — Registro de Casos: FECHA EN QUE SE ENVIO
   EL INFORME POR CORREO
   · Al subir el informe se pide la fecha en que el supervisor lo envio por correo.
   · El plazo (5 dias habiles, el vigente) se cuenta entre la FECHA DEL REPORTE y
     esa fecha, aunque el informe se suba al sistema dias despues.
   · Si supera el plazo -> OBSERVADO POR RETRASO y se pide el motivo (como siempre).
   · No puede ser anterior al reporte ni posterior a hoy. Se guarda en Azure
     (dbo.Casos.fecha_envio_informe) y en la hoja (col 34).
   Si algo aqui falla, el formulario sigue como antes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
try {
  var ID = 'cFechaEnvioInf';
  function hoyYmd() { var h = new Date(); return h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2) + '-' + ('0' + h.getDate()).slice(-2); }
  function dmy(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; }
  function val(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function caja() { return document.getElementById('cEnvioInfWrap'); }

  function crear() {
    if (document.getElementById(ID)) return;
    var panel = document.getElementById('panelAdjuntosCaso');
    if (!panel) return;
    var d = document.createElement('div');
    d.id = 'cEnvioInfWrap';
    d.style.cssText = 'margin-top:10px;padding:10px 12px;border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:8px';
    d.innerHTML =
      '<label for="' + ID + '" style="font-size:11px;font-weight:700;color:#1e3a8a;display:block;margin-bottom:4px">📅 Fecha en que enviaste el informe por correo <span style="color:#dc2626">*</span></label>' +
      '<input type="date" id="' + ID + '" style="width:220px;max-width:100%;padding:7px 10px;border:2px solid #c0ceea;border-radius:6px;font-size:12px">' +
      '<div id="cEnvioInfRes" style="font-size:12px;font-weight:700;margin-top:6px"></div>' +
      '<div style="font-size:11px;color:#1e40af;margin-top:6px;line-height:1.45">⚠️ <b>Ten en cuenta:</b> si estás registrando el informe ya completo, primero verifica la <b>fecha del reporte</b> del caso y luego registra la <b>fecha en que enviaste el informe por correo</b>. ' +
      'El plazo de 5 días hábiles se cuenta entre esas dos fechas. Si la fecha del informe supera los 5 días hábiles, el caso queda en <b>estado de retraso</b>.</div>';
    panel.appendChild(d);
    var inp = document.getElementById(ID);
    inp.max = hoyYmd();
    inp.addEventListener('change', function () { refrescar(true); });
    var fr = document.getElementById('cFechaReporte');
    if (fr) fr.addEventListener('change', function () { setTimeout(function () { refrescar(false); }, 0); });
  }

  /* informe que se esta subiendo ahora o que ya esta subido */
  function hayInformeNuevo() { var f = document.getElementById('cInforme'); return !!(f && f.files && f.files[0]); }
  function hayInformeGuardado() { return !!((window._casoEditUrls || {}).informe); }

  function validar() {
    var fe = val(ID), fr = val('cFechaReporte');
    if (!fe) return '';
    if (fr && fe < fr) return 'La fecha de envío no puede ser anterior a la fecha del reporte (' + dmy(fr) + ').';
    if (fe > hoyYmd()) return 'La fecha de envío no puede ser posterior a hoy.';
    return '';
  }

  /* resultado en vivo + estado del caso con la fecha de envio */
  function refrescar(avisar) {
    crear();
    var res = document.getElementById('cEnvioInfRes'); if (!res) return;
    var fe = val(ID), fr = val('cFechaReporte'), fl = val('cFechaLimite');
    var err = validar();
    if (!fe || !fr || !fl) { res.textContent = ''; return; }
    if (err) { res.style.color = '#dc2626'; res.textContent = '❌ ' + err; if (avisar && typeof mostrarToast === 'function') mostrarToast('❌ ' + err, 'error'); return; }
    var dias = 0, plazo = 0;
    try { dias = calcularDiasHabilesTranscurridos(new Date(fr + 'T00:00:00'), new Date(fe + 'T00:00:00')); plazo = calcularDiasHabilesTranscurridos(new Date(fr + 'T00:00:00'), new Date(fl + 'T00:00:00')); } catch (e) {}
    if (fe <= fl) { res.style.color = '#15803d'; res.textContent = '✅ Dentro del plazo (' + dias + ' de ' + plazo + ' días hábiles)'; }
    else { res.style.color = '#dc2626'; res.textContent = '🔴 Fuera de plazo (' + dias + ' días hábiles; el plazo vencía el ' + dmy(fl) + '): quedará en retraso'; }
    try { if (typeof calcularEstadoCaso === 'function' && fl) calcularEstadoCaso(fl); } catch (e) {}
  }

  /* calcularEstadoCaso: si el caso se concluye con fecha de envio, el retraso se mide a ESA fecha (no a hoy) */
  var _calc = window.calcularEstadoCaso;
  if (typeof _calc === 'function') {
    window.calcularEstadoCaso = function (fl) {
      var r = _calc.apply(this, arguments);
      try {
        var fe = val(ID);
        if (!fl || !fe || validar() || typeof _modoCaso === 'undefined' || _modoCaso !== 'concluido') return r;
        var dr = calcularRetraso(fl, new Date(fe + 'T00:00:00')), pct = calcularAvance(dr);
        var ok = dr === 0, color = ok ? '#16a34a' : '#dc2626';
        var est = ok ? 'CONCLUIDO_DENTRO_PLAZO' : 'CONCLUIDO_CON_RETRASO';
        var etq = ok ? '✅ CONCLUIDO DENTRO DEL PLAZO (informe enviado el ' + dmy(fe) + ')' : '⛔ OBSERVADO POR RETRASO — informe enviado el ' + dmy(fe) + ', ' + dr + ' día(s) hábil(es) de retraso';
        var g = function (id) { return document.getElementById(id); };
        g('cEstadoCaso').value = est; g('cEstadoCaso').style.color = color;
        g('cEstadoLabel').textContent = etq;
        g('cPorcentaje').textContent = pct + '%'; g('cPorcentaje').style.color = color;
        g('cBarraAvance').style.width = pct + '%'; g('cBarraAvance').style.background = color;
        var p = g('panelAvanceCaso'); p.style.background = ok ? '#f0fdf4' : '#fef2f2'; p.style.borderColor = ok ? '#bbf7d0' : '#fecaca';
        g('panelMotivoCaso').style.display = ok ? 'none' : 'block';
        var flEl = g('cFechaLimite'); flEl.dataset.diasRetraso = dr; flEl.dataset.pct = pct; flEl.dataset.estadoPlazo = est;
      } catch (e) {}
      return r;
    };
    try { calcularEstadoCaso = window.calcularEstadoCaso; } catch (e) {}
  }

  /* Guardar: obligatorio al subir un informe nuevo (si el caso aun no tiene fecha de envio) */
  var _pendiente = '';
  var _guardar = window.guardarCaso;
  if (typeof _guardar === 'function') {
    window.guardarCaso = function () {
      _pendiente = '';
      try {
        crear();
        var fe = val(ID), err = validar();
        var c = null;
        try { c = (typeof _editandoCasoNro !== 'undefined' && _editandoCasoNro) ? (casosData || []).find(function (x) { return String(x.nro) === String(_editandoCasoNro); }) : null; } catch (e) {}
        var yaTiene = !!(c && c.fecha_envio_informe);
        var exige = typeof _modoCaso !== 'undefined' && _modoCaso === 'concluido' && hayInformeNuevo() && !yaTiene;
        if (exige && !fe) {
          var i = document.getElementById(ID); if (i) { i.focus(); i.style.borderColor = '#ef4444'; setTimeout(function () { i.style.borderColor = '#c0ceea'; }, 2500); }
          if (typeof mostrarToast === 'function') mostrarToast('❌ Indica la fecha en que enviaste el informe por correo', 'error');
          return;
        }
        if (fe && err) { if (typeof mostrarToast === 'function') mostrarToast('❌ ' + err, 'error'); return; }
        if (fe) { refrescar(false); _pendiente = fe; }
      } catch (e) {}
      return _guardar.apply(this, arguments);
    };
    try { guardarCaso = window.guardarCaso; } catch (e) {}
  }
  /* que la fecha viaje con el caso (Azure y hoja) */
  var _api = window.apiPost;
  if (typeof _api === 'function') {
    window.apiPost = function (b) {
      try { if (_pendiente && b && (b.action === 'saveCaso' || b.action === 'updateCaso') && b.fecha_envio_informe === undefined) { b.fecha_envio_informe = _pendiente; _pendiente = ''; } } catch (e) {}
      return _api.apply(this, arguments);
    };
    try { apiPost = window.apiPost; } catch (e) {}
  }

  /* Editar: carga lo guardado · Nuevo: limpio */
  var _editar = window.editarCaso;
  if (typeof _editar === 'function') {
    window.editarCaso = function (idx) {
      var r = _editar.apply(this, arguments);
      try {
        crear();
        var c = (casosData || [])[idx], i = document.getElementById(ID);
        if (i) { i.value = (c && c.fecha_envio_informe) ? String(c.fecha_envio_informe).slice(0, 10) : ''; i.max = hoyYmd(); }
        refrescar(false);
      } catch (e) {}
      return r;
    };
    try { editarCaso = window.editarCaso; } catch (e) {}
  }
  var _limpiar = window.limpiarFormCaso;
  if (typeof _limpiar === 'function') {
    window.limpiarFormCaso = function () {
      var r = _limpiar.apply(this, arguments);
      try { crear(); var i = document.getElementById(ID); if (i) { i.value = ''; i.max = hoyYmd(); } var res = document.getElementById('cEnvioInfRes'); if (res) res.textContent = ''; _pendiente = ''; } catch (e) {}
      return r;
    };
    try { limpiarFormCaso = window.limpiarFormCaso; } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crear); else crear();
  console.log('[_ENVIO_INFORME_V1] fecha de envio del informe lista');
} catch (eEI) { console.warn('[_ENVIO_INFORME_V1] no se aplico (el formulario sigue como antes):', eEI); }
})();
