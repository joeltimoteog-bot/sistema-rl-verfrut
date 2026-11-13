/* ═══════════════════════════════════════════════════════════════════════════
   87-at-fecha-pasada-aviso-v1.js — _AT_FECHA_PASADA_AVISO_V1 (12-nov-2026, decision de Joel)
   En "Nueva Atención": si la fecha de atención es de un día ANTERIOR, avisa (sin impedir guardar)
   que en el KPI contará como registrada fuera de fecha.
   ---------------------------------------------------------------------------
   Usa la MISMA regla del KPI (kpi-motor · K2 / A1 "registro el mismo día"):
   · La atención se registra el mismo día.
   · Si se atendió en sábado o domingo, o después de las 16:36, vale hasta el siguiente día hábil.
   · Solo avisa cuando HOY ya pasó ese límite. (Los feriados no se conocen en esta pantalla:
     por eso el texto dice "contará" solo cuando el día límite ya quedó atrás en días de semana.)
   No cambia lo que se guarda, no bloquea nada y no aparece al EDITAR una atención.
   Apagar en un equipo: localStorage.rl_at_fecha_aviso = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_at_fecha_aviso') === 'off') return; } catch (e) {}
  if (window._atFechaAvisoOk) return; window._atFechaAvisoOk = true;
  var HORA_CIERRE = '16:36', ID = 'atFechaAviso';
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); };
  var aFecha = function (s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  var finde = function (d) { var w = d.getDay(); return w === 0 || w === 6; };
  function sigHabil(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); while (finde(x)) x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1); return x; }
  function hoyS() { return ymd(typeof window._atFechaAvisoHoy === 'function' ? window._atFechaAvisoHoy() : new Date()); }   /* (el gancho solo lo usan las pruebas) */

  /* devuelve null (no avisar) o { fecha:'dd/mm', limite:'dd/mm' } */
  function evaluar(fecha, horaIni, hoy) {
    var f = aFecha(fecha); if (!f || !hoy) return null;
    if (fecha >= hoy) return null;                                   /* hoy o futura: nada que avisar */
    var tarde = /^\d{2}:\d{2}/.test(String(horaIni || '')) && String(horaIni).slice(0, 5) > HORA_CIERRE;
    var limite = (finde(f) || tarde) ? ymd(sigHabil(f)) : fecha;
    if (hoy <= limite) return null;                                  /* todavia dentro del plazo */
    var dm = function (s) { return s.slice(8, 10) + '/' + s.slice(5, 7); };
    return { fecha: dm(fecha), limite: dm(limite) };
  }

  function caja() {
    var el = document.getElementById(ID); if (el) return el;
    var campo = document.getElementById('at_fec'); if (!campo) return null;
    el = document.createElement('div'); el.id = ID; el.setAttribute('role', 'status');
    el.style.cssText = 'display:none;margin-top:6px;padding:8px 10px;border-radius:8px;background:#fffbeb;border:1px solid #f59e0b;color:#78350f;font:600 11.5px/1.4 system-ui,sans-serif';
    var donde = campo.parentNode;
    if (donde) donde.insertBefore(el, campo.nextSibling);
    return el;
  }
  function revisar() {
    try {
      var campo = document.getElementById('at_fec'); if (!campo) return;
      var el = caja(); if (!el) return;
      var editando = !!String((document.getElementById('at_nro_edit') || {}).value || '').trim();
      var r = editando ? null : evaluar(campo.value, (document.getElementById('at_hi') || {}).value, hoyS());
      if (!r) { el.style.display = 'none'; el.textContent = ''; return; }
      el.textContent = '⚠️ Estás registrando con una fecha anterior (' + r.fecha + '). En el KPI contará como registrada fuera de fecha: ' +
        'la atención debía registrarse hasta el ' + r.limite + ' a las ' + HORA_CIERRE + '. Si la fecha es correcta, puedes guardar.';
      el.style.display = 'block';
    } catch (e) {}
  }

  ['input', 'change'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { var t = e.target; if (t && (t.id === 'at_fec' || t.id === 'at_hi')) revisar(); }, true);
  });
  /* al abrir "Nueva Atención" o "Editar" los campos se llenan por codigo (sin evento): se revisa justo despues */
  ['abrirAt', 'editarAt'].forEach(function (n) {
    var orig = window[n]; if (typeof orig !== 'function') return;
    window[n] = function () { var r = orig.apply(this, arguments); setTimeout(revisar, 0); setTimeout(revisar, 400); return r; };
  });
  window._atFechaAviso = { evaluar: evaluar, revisar: revisar };
  console.log('[_AT_FECHA_PASADA_AVISO_V1] listo: avisa si la atencion se registra con fecha de un dia anterior');
})();
