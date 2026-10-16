/* ═══════════════════════════════════════════════════════════════════════════
   _VISITAS_UI_V2 (16-oct-2026) — Visitas de Campo modernizado (misma información, nueva piel)
   ---------------------------------------------------------------------------
   NO cambia cargarVisitas, el cálculo de % de avance, el guardado ni los permisos.
     1) Cabecera con ícono y regla del plazo; filtros en una barra (lupa, chips Ambas/RAPEL/VERFRUT
        que mueven el select #vFiltroEmp de siempre, contador).
     2) Banda "Semana actual": informe de la semana del usuario (pendiente/enviado), cumplimiento
        del año y fundo asignado. Admin: cuántos supervisores informaron esta semana. Sale de los
        mismos datos ya cargados (CACHE.visitas) — sin consultas nuevas.
     3) Tabla: envuelve renderVisitas y, sin tocar su HTML, convierte en cada fila el supervisor en
        avatar+nombre, la semana en etiqueta, el estado en chip con punto, el % en barra y los botones
        en íconos con tooltip (mismos onclick).
     4) Formulario #mVisita: pasos arriba (Supervisor → Datos → Contenido → Evidencias) que solo
        muestran/ocultan las secciones existentes; cabecera y botonera fijas; chips automáticos de
        semana y fecha límite del informe; contador de obligatorios. Mismos ids y mismo botón Guardar.
   Si algo falla, se deja la pantalla como estaba. Para desactivar: quitar el <script>.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._VISITAS_UI_V2) return;
  window._VISITAS_UI_V2 = true;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  function esAdmin() { try { var u = usr(); return !!(u && ((typeof ROLES_ADMIN !== 'undefined' && ROLES_ADMIN.includes(u.rol)) || (typeof ROLES_ADMIN2 !== 'undefined' && ROLES_ADMIN2.includes(u.rol)))); } catch (e) { return false; } }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function semISO(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); }
  function dmy(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); }
  var DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function colorAv(u) { var cs = ['#0a2463', '#1d4ed8', '#0369a1', '#7c3aed', '#15803d', '#b45309', '#be123c', '#0f766e']; var h = 0; u = String(u || ''); for (var i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0; return cs[h % cs.length]; }

  var CSS = '\
#sec-visitas .sec-hd{align-items:center;gap:12px;flex-wrap:wrap}\
#sec-visitas .sec-hd h2{display:flex;align-items:center;gap:10px}\
#sec-visitas .sec-hd h2 .v2ic{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#16a34a,#15803d);display:inline-flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 8px 18px rgba(22,163,74,.3)}\
#sec-visitas .sec-hd .v2sub{flex-basis:100%;font-size:12px;color:#64748b;margin-top:-6px}\
#v2Sem{background:linear-gradient(110deg,#07173f,#0a2463 60%,#1d4ed8);color:#fff;border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 14px;box-shadow:0 12px 30px rgba(10,36,99,.22)}\
#v2Sem .big{font-family:"Barlow Condensed",Barlow,sans-serif;font-size:28px;font-weight:800;line-height:1}\
#v2Sem .lb{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;opacity:.8}\
#v2Sem .pill{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 11px;font-weight:700;font-size:12px;display:inline-block;margin-top:3px}\
#v2Sem .pill.warn{background:rgba(251,191,36,.2);border-color:rgba(251,191,36,.5)}#v2Sem .pill.ok{background:rgba(74,222,128,.18);border-color:rgba(74,222,128,.45)}\
#v2Sem .bar{flex:1;min-width:170px}#v2Sem .bar .t{font-size:11px;opacity:.9;margin-bottom:4px;display:flex;justify-content:space-between;gap:8px}\
#v2Sem .bar i{display:block;height:8px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden}#v2Sem .bar i b{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#22c55e);border-radius:999px;transition:width .6s}\
#sec-visitas .filtros{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--bd,#e2e8f0);border-radius:14px;padding:10px 14px}\
#sec-visitas .filtros #vFiltroSup{flex:1 1 220px !important;width:auto !important;border-radius:10px !important;padding:9px 12px 9px 34px !important;background:#fff url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.4\' stroke-linecap=\'round\'><circle cx=\'11\' cy=\'11\' r=\'7\'/><line x1=\'21\' y1=\'21\' x2=\'16.5\' y2=\'16.5\'/></svg>") no-repeat 11px center !important;border-width:1.5px !important}\
#sec-visitas .filtros select{border-radius:10px;padding:8px 12px;font-weight:600}\
#sec-visitas .filtros #vFiltroEmp{display:none}\
#v2Chips{display:flex;gap:6px}\
#v2Chips span{border:1.5px solid var(--bd,#e2e8f0);border-radius:999px;padding:6px 12px;font-weight:800;font-size:12px;cursor:pointer;background:#fff;color:#334155}\
#v2Chips span.on{background:#0a2463;color:#fff;border-color:#0a2463}\
#v2Cnt{margin-left:auto;font-size:12px;color:#475569;font-weight:700;background:#f1f5f9;border-radius:999px;padding:5px 11px;white-space:nowrap}#v2Cnt b{color:#0a2463}\
#statsVisitas .card{border-radius:16px;padding:14px 16px;position:relative;transition:transform .15s}#statsVisitas .card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(10,36,99,.12)}\
#statsVisitas .card>div:first-child{font-family:"Barlow Condensed",Barlow,sans-serif;font-size:30px !important;line-height:1}\
#statsVisitas .card>div:last-child{font-size:11.5px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}\
#statsVisitas .card .v2d{position:absolute;right:12px;top:12px;font-size:11px;font-weight:800;border-radius:999px;padding:3px 8px;background:#f1f5f9;color:#475569}\
#sec-visitas .tbl thead th{position:sticky;top:0;background:#f3f6fb;font-size:10px;letter-spacing:1.1px}\
#sec-visitas .tbl tbody tr:nth-child(even) td{background:#fafbfe}#sec-visitas .tbl tbody tr:hover td{background:#eef4ff}\
.v2av{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11.5px;margin-right:7px;vertical-align:middle}\
.v2wk{display:inline-block;background:#0a2463;color:#fff;border-radius:6px;padding:2px 8px;font-weight:800;font-size:11px}\
.v2st{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:800}.v2st:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}\
.v2st.ok{background:#dcfce7;color:#166534}.v2st.rt{background:#fee2e2;color:#991b1b}.v2st.ot{background:#f1f5f9;color:#475569}\
.v2pr{display:flex;align-items:center;gap:8px;min-width:110px}.v2pr i{flex:1;height:7px;border-radius:999px;background:#eef2f8;overflow:hidden}.v2pr i b{display:block;height:100%;border-radius:999px}.v2pr span{font-weight:800;width:38px;text-align:right;font-variant-numeric:tabular-nums}\
#sec-visitas .tbl td button.v2ic{width:30px;height:28px;padding:0 !important;border-radius:8px !important;font-size:13px !important;display:inline-flex;align-items:center;justify-content:center;transition:transform .12s,box-shadow .12s}\
#sec-visitas .tbl td button.v2ic:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,23,42,.2)}\
#sec-visitas .tbl td:last-child{gap:4px !important}\
/* formulario */\
#mVisita .modal>div:first-child{background:linear-gradient(110deg,#07173f,#0a2463 60%,#1d4ed8) !important;border-radius:18px 18px 0 0}\
#v2Steps{display:flex;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;position:sticky;top:48px;z-index:9}\
#v2Steps .st{flex:1;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer;white-space:nowrap}\
#v2Steps .st i{width:24px;height:24px;border-radius:50%;background:#e2e8f0;color:#475569;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:900;flex:none}\
#v2Steps .st.done i{background:#22c55e;color:#fff}#v2Steps .st.on{color:#0a2463}#v2Steps .st.on i{background:#0a2463;color:#fff}\
#v2Steps .st:after{content:"";flex:1;height:2px;background:#e2e8f0;margin:0 8px}#v2Steps .st:last-child:after{display:none}\
#mVisita.v2pasos .v2sec{display:none}#mVisita.v2pasos .v2sec.v2on{display:block}\
#v2Auto{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px}#v2Auto span{background:#eef4ff;border:1px solid #bfd3ff;color:#1e3a8a;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:700}#v2Auto span.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}\
#v2Foot{position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0;margin:0 -20px -20px;padding:12px 20px;display:flex;align-items:center;gap:10px;z-index:9}\
#v2Foot .pg{flex:1;font-size:12px;color:#64748b;font-weight:700;min-width:140px}#v2Foot .pg i{display:block;height:6px;background:#eef2f8;border-radius:999px;margin-top:5px;overflow:hidden}#v2Foot .pg i b{display:block;height:100%;background:linear-gradient(90deg,#0a2463,#2563eb);transition:width .3s}\
#v2Foot .nav{border:none;border-radius:10px;padding:9px 14px;font:800 12.5px Barlow,sans-serif;cursor:pointer;background:#f1f5f9;color:#334155}#v2Foot .nav.p{background:#0a2463;color:#fff}\
@media(max-width:700px){#v2Steps .st span{display:none}#v2Steps .st:after{margin:0 4px}}';

  /* ── 1) cabecera + filtros ── */
  function cabecera() {
    var sec = $('sec-visitas'), hd = sec && sec.querySelector('.sec-hd'); if (!hd || hd.querySelector('.v2ic')) return;
    var h2 = hd.querySelector('h2'); if (h2) h2.innerHTML = '<span class="v2ic">🏕️</span>' + h2.textContent.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '');
    var sub = document.createElement('div'); sub.className = 'v2sub'; sub.textContent = 'Informe semanal de visita · se sube el lunes siguiente (o el primer día hábil)'; hd.appendChild(sub);
    var f = sec.querySelector('.filtros'), emp = $('vFiltroEmp'), sup = $('vFiltroSup');
    if (f && emp && !$('v2Chips')) {
      var ch = document.createElement('div'); ch.id = 'v2Chips';
      ch.innerHTML = '<span data-v="" class="on">Ambas</span><span data-v="RAPEL">RAPEL</span><span data-v="VERFRUT">VERFRUT</span>';
      f.insertBefore(ch, emp);
      if (sup) f.insertBefore(sup, ch);
      ch.onclick = function (e) { var s = e.target.closest('span'); if (!s) return; emp.value = s.getAttribute('data-v'); sincChips(); try { emp.onchange ? emp.onchange() : emp.dispatchEvent(new Event('change')); } catch (er) {} };
      var cnt = document.createElement('span'); cnt.id = 'v2Cnt'; cnt.innerHTML = '<b>–</b> visitas'; f.appendChild(cnt);
      emp.addEventListener('change', sincChips);
    }
  }
  function sincChips() { var emp = $('vFiltroEmp'); if (!emp) return; document.querySelectorAll('#v2Chips span').forEach(function (s) { s.classList.toggle('on', s.getAttribute('data-v') === emp.value); }); }

  /* ── 2) banda de la semana ── */
  function banda() {
    var sec = $('sec-visitas'); if (!sec) return;
    var todas = (window.CACHE && Array.isArray(CACHE.visitas)) ? CACHE.visitas : (window._visitasData || []);
    if (!todas.length) return;
    var u = usr() || {}, admin = esAdmin(), hoy = new Date(), semHoy = semISO(hoy), anio = hoy.getFullYear();
    var el = $('v2Sem'); if (!el) { el = document.createElement('div'); el.id = 'v2Sem'; var f = sec.querySelector('.filtros'); (f && f.parentNode) ? f.parentNode.insertBefore(el, f.nextSibling) : sec.appendChild(el); }
    /* lunes siguiente = plazo del informe de esta semana */
    var lim = new Date(hoy); do { lim.setDate(lim.getDate() + 1); } while (lim.getDay() !== 1);
    var mias = admin ? todas : todas.filter(function (v) { var s = norm(v.supervisor), r = norm(v.registrado_por), me = norm(u.usuario), p = norm(u.nombre || u.usuario).split(' ')[0]; return s === me || s.indexOf(p) >= 0 || r === me || r.indexOf(p) >= 0; });
    var semanaDe = function (v) { var w = parseInt(v.semana, 10); if (w) return w; var f = String(v.fecha_fin || v.fecha_reg || v.fecha || '').slice(0, 10); var d = new Date(f + 'T12:00:00'); return isNaN(d) ? 0 : semISO(d); };
    var anioDe = function (v) { var f = String(v.fecha_fin || v.fecha_reg || v.fecha || '').slice(0, 10); return +f.slice(0, 4); };
    var esteAnio = mias.filter(function (v) { return anioDe(v) === anio; });
    var semanasConInforme = new Set(esteAnio.map(semanaDe).filter(Boolean));
    var hayEsta = semanasConInforme.has(semHoy) || semanasConInforme.has(semHoy - 1) && false;
    var h = '<div><div class="lb">Semana actual</div><div class="big">SEM ' + semHoy + '</div></div>';
    if (!admin) {
      var fundo = ''; esteAnio.slice().sort(function (a, b) { return String(b.fecha_reg || b.fecha || '').localeCompare(String(a.fecha_reg || a.fecha || '')); }).some(function (v) { fundo = v.sector || v.fundo || ''; return !!fundo; });
      var pct = Math.min(100, Math.round(semanasConInforme.size / Math.max(1, semHoy) * 100));
      var mesF = $('vFiltroMes') && $('vFiltroMes').value;   /* con filtro de mes solo hay un mes cargado: no se muestra el % del año */
      h += '<div><div class="lb">Tu informe de esta semana</div>' + (hayEsta ? '<span class="pill ok">✅ Registrado</span>' : '<span class="pill warn">⏳ Pendiente · se sube el ' + DIAS[lim.getDay()] + ' ' + dmy(lim) + '</span>') + '</div>'
        + (!mesF ? '<div class="bar"><div class="t"><span>Semanas con informe en ' + anio + '</span><b>' + semanasConInforme.size + ' de ' + semHoy + ' · ' + pct + ' %</b></div><i><b style="width:' + pct + '%"></b></i></div>' : '')
        + (fundo ? '<span class="pill">📍 Último fundo: ' + esc(fundo) + '</span>' : '');
    } else {
      var sups = {}; esteAnio.forEach(function (v) { if (semanaDe(v) === semHoy) sups[norm(v.supervisor)] = 1; });
      var supsTot = {}; esteAnio.forEach(function (v) { if (v.supervisor) supsTot[norm(v.supervisor)] = 1; });
      var n = Object.keys(sups).length, t = Object.keys(supsTot).length, pct2 = t ? Math.round(n / t * 100) : 0;
      h += '<div><div class="lb">Informaron esta semana</div><span class="pill ' + (pct2 >= 80 ? 'ok' : 'warn') + '">' + n + ' de ' + t + ' supervisores</span></div>'
        + '<div class="bar"><div class="t"><span>Avance de la semana</span><b>' + pct2 + ' %</b></div><i><b style="width:' + pct2 + '%"></b></i></div>'
        + '<span class="pill">⏱ Plazo: ' + DIAS[lim.getDay()] + ' ' + dmy(lim) + '</span>';
    }
    el.innerHTML = h;
  }

  /* ── 3) tabla: decorar filas que pinta renderVisitas (mismos onclick) ── */
  function decorar() {
    var sec = $('sec-visitas'), tb = $('tbVisitas'); if (!tb) return;
    var rows = tb.querySelectorAll('tr'); if (!rows.length || rows[0].querySelector('.empty')) { var c0 = $('v2Cnt'); if (c0) c0.innerHTML = '<b>0</b> visitas'; return; }
    var ths = sec.querySelectorAll('.tbl thead th'), idx = {}; ths.forEach(function (th, i) { idx[norm(th.textContent)] = i; });
    var iSup = idx['supervisor'], iSem = idx['semana'], iEst = idx['estado'], iAv = idx['% avance'], iAcc = idx['acciones'];
    rows.forEach(function (tr) {
      if (tr.getAttribute('data-v2')) return; tr.setAttribute('data-v2', '1');
      var td = tr.children; if (td.length < 7) return;
      if (iSup != null && td[iSup] && !td[iSup].querySelector('.v2av')) { var n = td[iSup].textContent.trim(); if (n && n !== '—') td[iSup].innerHTML = '<span class="v2av" style="background:' + colorAv(n) + '">' + esc(n.charAt(0).toUpperCase()) + '</span>' + esc(n.split(' ').slice(0, 2).join(' ')); }
      if (iSem != null && td[iSem]) { var w = td[iSem].textContent.trim(); if (w && w !== '—') td[iSem].innerHTML = '<span class="v2wk">SEM ' + esc(w) + '</span>'; }
      if (iEst != null && td[iEst]) { var e = td[iEst].textContent.trim().toUpperCase(); var k = /RETRAS/.test(e) ? 'rt' : /PLAZO/.test(e) ? 'ok' : 'ot'; td[iEst].innerHTML = '<span class="v2st ' + k + '">' + esc(e || '—') + '</span>'; }
      if (iAv != null && td[iAv]) { var p = parseInt(td[iAv].textContent, 10); if (!isNaN(p)) { var col = p >= 100 ? '#16a34a' : p >= 50 ? '#d97706' : '#dc2626'; td[iAv].innerHTML = '<div class="v2pr"><i><b style="width:' + Math.min(100, p) + '%;background:' + col + '"></b></i><span>' + p + '%</span></div>'; td[iAv].style.color = ''; } }
      if (iAcc != null && td[iAcc]) td[iAcc].querySelectorAll('button').forEach(function (b) { var t = b.textContent.trim(); var m = t.match(/^(\S+)\s*(.*)$/); if (!m) return; b.title = b.title || m[2] || t; b.textContent = m[1]; b.classList.add('v2ic'); });
    });
    var c = $('v2Cnt'); if (c) c.innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'visita' : 'visitas');
  }
  function kpis() {
    try {
      var d = window._visitasData || []; if (!d.length) return;
      var tot = d.length, ret = d.filter(function (v) { return /RETRAS/i.test(v.estado || ''); }).length, ok = tot - ret;
      var p = function (id, txt) { var el = $(id); if (!el) return; var card = el.closest('.card'); if (!card) return; var b = card.querySelector('.v2d'); if (!b) { b = document.createElement('span'); b.className = 'v2d'; card.appendChild(b); } b.textContent = txt; };
      p('vTotalReg', String(new Date().getFullYear())); p('vEnPlazo', Math.round(ok / tot * 100) + ' %'); p('vRetrasado', Math.round(ret / tot * 100) + ' %');
      var sups = {}; d.forEach(function (v) { if (v.supervisor) sups[norm(v.supervisor)] = 1; }); p('vSemActual', 'de ' + Object.keys(sups).length + ' sup.');
    } catch (e) {}
  }
  function envolverRender() {
    var prev = window.renderVisitas; if (typeof prev !== 'function' || prev._v2) return;
    var w = function (data) { var r = prev.apply(this, arguments); setTimeout(function () { decorar(); banda(); kpis(); }, 30); return r; };
    w._v2 = true; window.renderVisitas = w; try { renderVisitas = w; } catch (e) {}
    try { new MutationObserver(function () { setTimeout(decorar, 0); }).observe($('tbVisitas'), { childList: true }); } catch (e) {}
  }

  /* ── 4) formulario por pasos ── */
  var PASOS = [['Supervisor', 'Datos del Supervisor'], ['Datos de la visita', 'Datos de la Visita'], ['Contenido del informe', 'Contenido del Informe'], ['Evidencias', 'Evidencias Fotográficas']];
  var OBLIG = ['vSup', 'vEmp', 'vFundo', 'vPunto', 'vFI', 'vFF', 'vFechaInforme', 'vPara', 'vAsunto', 'vDesarrollo', 'vRutas', 'vAcciones', 'vObservaciones'];
  var paso = 0;
  function formulario() {
    var m = $('mVisita'); if (!m || $('v2Steps')) return;
    var modal = m.querySelector('.modal'), cuerpo = modal && modal.children[1]; if (!cuerpo) return;
    /* agrupar: cada .sep y lo que sigue hasta el siguiente .sep → seccion */
    var hijos = Array.prototype.slice.call(cuerpo.children), secs = [], cur = null, botones = null;
    hijos.forEach(function (el) {
      if (el.classList.contains('sep')) { cur = document.createElement('div'); cur.className = 'v2sec'; cur.setAttribute('data-t', el.textContent.trim()); cuerpo.insertBefore(cur, el); cur.appendChild(el); secs.push(cur); return; }
      if (!cur) return;
      if (el.querySelector && el.querySelector('[onclick*="generarInformeVisita"]')) { botones = el; return; }
      cur.appendChild(el);
    });
    if (secs.length < 3) return;
    /* el bloque de motivo de retraso va con "Contenido"; el de reemplazo con "Supervisor" (ya quedan por orden) */
    var steps = document.createElement('div'); steps.id = 'v2Steps';
    steps.innerHTML = PASOS.map(function (p, i) { return '<div class="st" data-i="' + i + '"><i>' + (i + 1) + '</i><span>' + p[0] + '</span></div>'; }).join('');
    modal.insertBefore(steps, cuerpo);
    steps.onclick = function (e) { var s = e.target.closest('.st'); if (s) ir(+s.getAttribute('data-i')); };
    /* chips automaticos (semana / plazo) debajo de las fechas */
    var auto = document.createElement('div'); auto.id = 'v2Auto'; var ff = $('vFF'); if (ff) { var fg = ff.closest('.fg'); if (fg && fg.parentNode) fg.parentNode.insertBefore(auto, fg.nextSibling); }
    ['vFI', 'vFF'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', autoChips); });
    /* pie fijo */
    if (botones) {
      botones.id = 'v2Foot'; botones.removeAttribute('style');
      var pg = document.createElement('div'); pg.className = 'pg'; pg.innerHTML = '<span id="v2PgTxt">Campos obligatorios</span><i><b id="v2PgBar" style="width:0"></b></i>';
      var ant = document.createElement('button'); ant.type = 'button'; ant.className = 'nav'; ant.id = 'v2Ant'; ant.textContent = '← Anterior'; ant.onclick = function () { ir(paso - 1); };
      var sig = document.createElement('button'); sig.type = 'button'; sig.className = 'nav p'; sig.id = 'v2Sig'; sig.textContent = 'Siguiente →'; sig.onclick = function () { ir(paso + 1); };
      botones.insertBefore(pg, botones.firstChild); botones.insertBefore(ant, botones.children[2] || null); botones.insertBefore(sig, botones.children[3] || null);
    }
    m.classList.add('v2pasos');
    cuerpo.addEventListener('input', progreso); cuerpo.addEventListener('change', progreso);
    /* al abrir (nuevo o editar) empezar en el paso 1 */
    try { new MutationObserver(function () { if (m.classList.contains('on')) { ir(0); autoChips(); progreso(); } }).observe(m, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    ir(0);
  }
  function ir(i) {
    var secs = document.querySelectorAll('#mVisita .v2sec'); if (!secs.length) return;
    paso = Math.max(0, Math.min(secs.length - 1, i));
    secs.forEach(function (s, k) { s.classList.toggle('v2on', k === paso); });
    document.querySelectorAll('#v2Steps .st').forEach(function (s, k) { s.classList.toggle('on', k === paso); s.classList.toggle('done', k < paso); });
    var ant = $('v2Ant'), sig = $('v2Sig'), gen = document.querySelector('#v2Foot [onclick*="generarInformeVisita"]');
    if (ant) ant.style.display = paso === 0 ? 'none' : ''; if (sig) sig.style.display = paso === secs.length - 1 ? 'none' : '';
    if (gen) gen.style.display = paso === secs.length - 1 ? '' : 'none';
    try { var mo = document.querySelector('#mVisita .modal'); if (mo) mo.scrollTop = 0; } catch (e) {}
  }
  function autoChips() {
    var a = $('v2Auto'); if (!a) return; var fi = $('vFI') && $('vFI').value, ff = $('vFF') && $('vFF').value; var h = '';
    if (fi) { var d = new Date(fi + 'T12:00:00'); if (!isNaN(d)) h += '<span>📆 Semana ' + semISO(d) + ' (calculada)</span>'; }
    if (ff) { var f = new Date(ff + 'T00:00:00'); if (!isNaN(f)) { var lim = (typeof fechaLimiteInforme === 'function') ? fechaLimiteInforme(f) : null; if (lim) { h += '<span>⏱ Plazo del informe: hasta el ' + DIAS[lim.getDay()] + ' ' + dmy(lim) + '</span>'; var hoy = new Date(); hoy.setHours(0, 0, 0, 0); if (hoy > lim) h += '<span class="warn">⚠️ Ya pasó el plazo: el % de avance quedará reducido y deberás indicar el motivo</span>'; } } }
    a.innerHTML = h;
  }
  function progreso() {
    var ok = 0, tot = 0; OBLIG.forEach(function (id) { var el = $(id); if (!el) return; tot++; if (String(el.value || '').trim()) ok++; });
    var t = $('v2PgTxt'), b = $('v2PgBar'); if (t) t.textContent = 'Campos obligatorios: ' + ok + ' de ' + tot + ' completos'; if (b) b.style.width = Math.round(ok / Math.max(1, tot) * 100) + '%';
  }

  /* antes de generar: si falta un obligatorio, ir al paso donde esta (la validacion de siempre sigue despues) */
  function envolverGenerar() {
    var prev = window.generarInformeVisita; if (typeof prev !== 'function' || prev._v2) return;
    var w = function () {
      try {
        var m = $('mVisita'); if (m && m.classList.contains('v2pasos')) {
          var falta = null; OBLIG.some(function (id) { var el = $(id); if (el && !String(el.value || '').trim()) { falta = el; return true; } return false; });
          var mot = $('motivoRetrasoDiv'); if (!falta && mot && mot.style.display !== 'none' && $('vMotivoRetraso') && !String($('vMotivoRetraso').value || '').trim()) falta = $('vMotivoRetraso');
          if (falta) { var sec = falta.closest('.v2sec'); var secs = Array.prototype.slice.call(document.querySelectorAll('#mVisita .v2sec')); var i = secs.indexOf(sec); if (i >= 0) ir(i); try { falta.focus(); falta.style.boxShadow = '0 0 0 3px rgba(220,38,38,.25)'; setTimeout(function () { falta.style.boxShadow = ''; }, 2500); } catch (e) {} }
        }
      } catch (e) {}
      return prev.apply(this, arguments);
    };
    w._v2 = true; window.generarInformeVisita = w; try { generarInformeVisita = w; } catch (e) {}
  }
  function iniciar() {
    try { envolverGenerar(); } catch (e) {}
    try { var st = document.createElement('style'); st.id = 'v2VisCss'; st.textContent = CSS; document.head.appendChild(st); } catch (e) {}
    try { cabecera(); } catch (e) { console.warn('[_VISITAS_UI_V2] cabecera', e); }
    try { envolverRender(); decorar(); banda(); } catch (e) { console.warn('[_VISITAS_UI_V2] tabla', e); }
    try { formulario(); } catch (e) { console.warn('[_VISITAS_UI_V2] formulario', e); }
    console.log('[_VISITAS_UI_V2] listo');
  }
  (function esperar(n) { var ok = false; try { ok = !!(usr() && $('sec-visitas')); } catch (e) {} if (ok && document.readyState !== 'loading') { iniciar(); return; } if (n < 80) setTimeout(function () { esperar(n + 1); }, 150); })(0);
})();
