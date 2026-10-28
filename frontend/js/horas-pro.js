/* _HORAS_PRO_V1 (28-oct-2026) — Banner "Horario vigente" en Acumulación de Horas.
   Lee la misma tabla de horarios que usa el cálculo (vía hor-azure.js). Solo muestra; no cambia nada. */
(function () {
  'use strict';
  function f2(n) { return (Number(n) || 0).toFixed(2); }
  function dmy(s) { s = String(s || ''); return s.length >= 10 ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function hm(h) { var m = Math.round((Number(h) || 0) * 60); return Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : ''); }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pintar(lista) {
    var tab = document.getElementById('tab-registrar'); if (!tab || !lista || !lista.length) return;
    var H = lista.slice().sort(function (a, b) { return a.desde < b.desde ? 1 : -1; }), t = hoy(), v = null;
    H.forEach(function (h) { if (!v && t >= h.desde && (!h.hasta || t <= h.hasta)) v = h; });
    var box = document.getElementById('hproHor') || document.createElement('div');
    box.id = 'hproHor'; box.className = 'hpro-hor';
    var sab = v && Number(v.horasSab) > 0;
    box.innerHTML = '<div class="hpro-ico">🕒</div><div><div class="hpro-t1">Horario vigente hoy</div>' +
      (v ? '<div class="hpro-t2">' + (sab ? 'Lunes a sábado' : 'Lunes a viernes') + ' · ' + v.lvEntrada + ' a ' + v.lvSalida + '</div>' +
        '<div class="hpro-t3">' + hm(v.horasLV) + ' por día (' + f2(v.horasLV) + ' h, refrigerio de ' + (v.lvRefrigMin || 0) + ' min ya descontado)' +
        (sab ? ' · Sábado ' + v.sabEntrada + ' a ' + v.sabSalida + ': ' + f2(v.horasSab) + ' h' : ' · Sábado y domingo descanso') + '</div>'
        : '<div class="hpro-t2">Sin horario registrado para hoy</div><div class="hpro-t3">Revisa la pestaña Config → Horarios.</div>') +
      '</div>' + (v ? '<div class="hpro-num"><b>' + f2(v.horasLV) + ' h</b><span>jornada diaria · ' + f2(v.horasSemana) + ' h/semana</span></div>' : '<div></div>') +
      '<div class="hpro-per">' + H.map(function (h) {
        var s = Number(h.horasSab) > 0;
        return '<span class="hpro-chip' + (h === v ? ' on' : '') + '">' + dmy(h.desde) + ' → ' + (h.hasta ? dmy(h.hasta) : 'sin fin') + ' · ' + (s ? 'L-S ' : 'L-V ') + f2(h.horasLV) + ' h' + (s ? ' + sáb ' + f2(h.horasSab) : '') + '</span>';
      }).join('') + '</div>';
    if (!box.parentNode) tab.insertBefore(box, tab.firstChild);
  }
  function cargar() {
    try {
      if (typeof apiPost !== 'function') return;
      apiPost({ action: 'horariosListar', usuario: (typeof USER !== 'undefined' && USER && USER.usuario) || '' })
        .then(function (d) { if (d && d.success) pintar(d.horarios || []); }).catch(function () {});
    } catch (e) {}
  }
  window.horasProRefrescar = cargar;

  /* _HORAS_PERMISO_NETO_V1 (28-oct-2026) — un permiso se cuenta en horas de TRABAJO, no de planta.
     Antes: permiso 06:15-16:36 = 10.35 h (incluía los 45 min de refrigerio) y se cobraban 10.35 h
     cuando la jornada es 9.60 h. Ahora: si el permiso dura 5 h o más se descuenta el refrigerio
     del horario de ese día, y nunca pasa de la jornada del día. En permiso las "horas en planta"
     van en 0 (el servidor ya las guarda en 0). */
  var HORL = null;
  function refrigerioDe(fecha) {
    if (!HORL || !fecha) return 45;
    var p = String(fecha).split('-'); if (p.length !== 3) return 45;
    var dow = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
    for (var i = 0; i < HORL.length; i++) {
      var h = HORL[i]; if (fecha < h.desde || (h.hasta && fecha > h.hasta)) continue;
      return Number(dow === 6 ? h.sabRefrigMin : h.lvRefrigMin) || 0;
    }
    return 45;
  }
  function num(id) { return parseFloat(String((document.getElementById(id) || {}).textContent || '0').replace(',', '.')) || 0; }
  function val(id) { return ((document.getElementById(id) || {}).value || ''); }
  function txt(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; }
  var _rec = window.recalcularHoras;
  if (typeof _rec === 'function') {
    window.recalcularHoras = function () {
      var r = _rec.apply(this, arguments);
      try {
        var m = String(val('regMotivo')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (m.indexOf('permiso') < 0) return r;
        txt('calcTrab', '0.00');
        var pi = val('regHoraPermInicio'), pf = val('regHoraPermFin');
        if (!pi || !pf) return r;
        var a = pi.split(':'), b = pf.split(':');
        var span = ((+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1])) / 60;
        if (!(span > 0)) return r;
        var neto = span >= 5 ? span - refrigerioDe(val('regFechaEntrada')) / 60 : span;
        var jor = num('calcJornada');
        if (jor > 0 && neto > jor) neto = jor;
        txt('calcPerm', (Math.round(Math.max(0, neto) * 100) / 100).toFixed(2));
      } catch (e) {}
      return r;
    };
  }
  try {
    var _cg = cargar;
    cargar = function () {
      _cg();
      try { apiPost({ action: 'horariosListar', usuario: (typeof USER !== 'undefined' && USER && USER.usuario) || '' }).then(function (d) {
        if (d && d.success) { HORL = (d.horarios || []).slice().sort(function (x, y) { return x.desde < y.desde ? 1 : -1; }); try { window.recalcularHoras(); } catch (e) {} }
      }).catch(function () {}); } catch (e) {}
    };
  } catch (e) {}
  if (document.readyState === 'complete') setTimeout(cargar, 0); else window.addEventListener('load', cargar);
})();
