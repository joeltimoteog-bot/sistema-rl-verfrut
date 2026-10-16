/* ═══════════════════════════════════════════════════════════════════════════
   _DASH_UI_V2 (15-oct-2026) — "Mi Dashboard" modernizado (misma informacion, nueva piel)
   ---------------------------------------------------------------------------
   NO cambia el flujo ni las consultas: los mismos elementos (#wN, #wR, #sH..#sA, #cM, #cE,
   #cTendAnual, #tbResAnualBody, #fbDashWidgets, filtros) siguen siendo alimentados por el
   codigo de siempre. Este archivo solo:
     1) arma una cabecera "hero" (saludo, reloj, fecha, rol/empresa, accesos rapidos) y MUEVE
        dentro los nodos #wN / #wR / #fbBadgeDash (no los recrea);
     2) agrega una fila nueva: "⏰ Seguimiento de tu gestion" (espejo de la alerta flotante que
        ya arma presencia.js) y "⚡ Actividad reciente" (eventos /trafico de Firebase: los
        mismos que ve el Monitor; solo lectura, cada 60 s y solo con la pantalla visible);
     3) aplica estilos (tarjetas, hover, graficos) por CSS.
   Si algo falla, no se toca nada y la pantalla queda como estaba.
   Para desactivar: quitar la etiqueta <script src=".../dash-ui.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._DASH_UI_V2) return;
  window._DASH_UI_V2 = true;

  var CSS = '\
#sec-dashboard .welcome{display:none !important}\
#d2Hero{position:relative;overflow:hidden;border-radius:18px;padding:20px 24px;color:#fff;background:linear-gradient(110deg,#07173f 0%,#0a2463 45%,#1d4ed8 100%);display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;box-shadow:0 14px 34px rgba(10,36,99,.28);margin-bottom:18px}\
#d2Hero:before{content:"";position:absolute;right:-80px;top:-120px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,.35),transparent 65%)}\
#d2Hero:after{content:"";position:absolute;left:40%;bottom:-150px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.3),transparent 65%)}\
#d2Hero>*{position:relative}\
#d2Hero .d2-hola{font-size:11.5px;letter-spacing:.8px;text-transform:uppercase;opacity:.8;font-weight:700}\
#d2Hero #wN{font-family:"Barlow Condensed",Barlow,sans-serif;font-size:26px;font-weight:800;margin:4px 0 6px;letter-spacing:.6px;color:#fff}\
#d2Hero #wR{font-size:12.5px;color:rgba(255,255,255,.85);margin:0 0 8px}\
#d2Hero .d2-pills{display:flex;gap:7px;flex-wrap:wrap;align-items:center}\
#d2Hero .d2-pill,#d2Hero #fbBadgeDash{display:inline-flex !important;align-items:center;gap:6px;background:rgba(255,255,255,.14) !important;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 11px;font-weight:700;font-size:11.5px;color:#fff !important}\
#d2Hero #fbBadgeDash[style*="display: none"]{display:none !important}\
#d2Hero .d2-pill.warn{background:rgba(251,191,36,.2) !important;border-color:rgba(251,191,36,.5)}\
#d2Hero .d2-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}\
#d2Hero .d2-acc button{display:inline-flex;align-items:center;gap:7px;background:#fff;color:#0a2463;border:none;border-radius:11px;padding:9px 14px;font-weight:800;font-size:12.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);transition:transform .15s;font-family:inherit}\
#d2Hero .d2-acc button:hover{transform:translateY(-2px)}\
#d2Hero .d2-acc button.ghost{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.3);box-shadow:none}\
#d2Hero .d2-reloj{text-align:right;min-width:150px}\
#d2Hero .d2-reloj .h{font-family:"Barlow Condensed",Barlow,sans-serif;font-size:40px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}\
#d2Hero .d2-reloj .d{font-size:12.5px;opacity:.85;margin-top:4px}\
#d2Hero .d2-reloj img{height:34px;border-radius:6px;object-fit:contain;background:#fff;padding:2px 6px;margin-top:10px}\
#sec-dashboard .sg{gap:12px}\
#sec-dashboard .sc{border-radius:16px;cursor:default}\
#sec-dashboard .sc:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(10,36,99,.14)}\
#d2Fila{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-bottom:16px}\
.d2-card{background:#fff;border:1px solid var(--bd,#e3e9f3);border-radius:16px;padding:14px 16px;min-width:0}\
.d2-card .t{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;color:#0a2463;margin-bottom:10px}\
.d2-card .t .r{margin-left:auto;font-size:11px;font-weight:700;color:#64748b}\
.d2-live{display:inline-flex;align-items:center;gap:5px;background:#dcfce7;color:#166534;border-radius:999px;padding:3px 9px;font-size:10.5px;font-weight:800}\
.d2-live i{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:d2p 1.8s infinite}\
@keyframes d2p{0%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}\
#d2Seg .it{display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border-radius:11px;border:1px solid #e3e9f3;background:#fbfcfe;font-size:12.5px;line-height:1.45;margin-bottom:7px;color:#0f172a}\
#d2Seg .it.rojo{background:#fff5f5;border-color:#fecaca}#d2Seg .it.amar{background:#fffbeb;border-color:#fde68a}#d2Seg .it.ok{background:#f0fdf4;border-color:#bbf7d0}\
#d2Seg .it b{color:#0f172a}\
#d2Seg .ok-all{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-weight:700}\
#d2Seg .ok-all .big{font-size:28px}\
#d2Feed .e{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed #e3e9f3;font-size:12.5px}\
#d2Feed .e:last-child{border:0}\
#d2Feed .dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex:none}\
#d2Feed .tx{flex:1;min-width:0}#d2Feed .tx b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#d2Feed .tx span{color:#64748b;font-size:11.5px}\
#d2Feed .h{color:#64748b;font-size:11px;white-space:nowrap}\
#d2Feed .vacio{color:#64748b;font-size:12.5px;padding:10px 0}\
#sec-dashboard .gc{border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,.04)}\
#sec-dashboard .gc-t{font-size:12.5px;font-weight:800}\
#sec-dashboard #fbRankingLista > div{border-radius:9px}\
@media(max-width:1000px){#d2Hero{grid-template-columns:1fr}#d2Hero .d2-reloj{text-align:left}#d2Fila{grid-template-columns:1fr}}';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function semanaISO(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); }
  function saludo(h) { return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

  /* ── 1) HERO ── */
  function hero() {
    var sec = $('sec-dashboard'), w = sec && sec.querySelector('.welcome');
    if (!sec || !w || $('d2Hero')) return;
    var wN = $('wN'), wR = $('wR'), badge = $('fbBadgeDash'), logo = w.querySelector('img');
    var u = usr() || {};
    var h = document.createElement('div'); h.id = 'd2Hero';
    h.innerHTML =
      '<div><div class="d2-hola" id="d2Hola"></div><div id="d2Nom"></div>' +
        '<div class="d2-pills" id="d2Pills"><span class="d2-pill">👤 ' + esc((u.rol || 'usuario').replace(/_/g, ' ')) + (u.empresa ? ' · ' + esc(u.empresa) : '') + '</span></div>' +
        '<div class="d2-acc" id="d2Acc"></div></div>' +
      '<div class="d2-reloj"><div class="h" id="d2Hora">--:--</div><div class="d" id="d2Fecha"></div>' + (logo ? '<img src="' + esc(logo.getAttribute('src')) + '" alt="Unifrutti" onerror="this.style.display=\'none\'">' : '') + '</div>';
    w.parentNode.insertBefore(h, w);
    var nom = $('d2Nom');
    if (wN) nom.appendChild(wN); if (wR) nom.appendChild(wR);
    if (badge) $('d2Pills').insertBefore(badge, $('d2Pills').firstChild);
    reloj(); setInterval(reloj, 20000);
    accionesRapidas(); var n = 0; var t = setInterval(function () { accionesRapidas(); if (++n > 12) clearInterval(t); }, 2500);
  }
  function reloj() {
    var d = new Date(), hh = ('0' + d.getHours()).slice(-2), mm = ('0' + d.getMinutes()).slice(-2);
    var el = $('d2Hora'); if (el) el.textContent = hh + ':' + mm;
    var f = $('d2Fecha'); if (f) f.textContent = 'Semana ' + semanaISO(d) + ' · ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
    var ho = $('d2Hola'); if (ho) ho.textContent = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' · ' + saludo(d.getHours());
  }
  /* accesos rapidos = botones del menu que el usuario SI tiene visibles (respeta permisos) */
  var ACC = [
    { ic: '➕', t: 'Nueva atención', nav: 'navAt', fn: function () { if (typeof window.abrirAt === 'function') { try { $('navAt').click(); } catch (e) {} setTimeout(function () { try { window.abrirAt(); } catch (e) {} }, 150); } else $('navAt').click(); } },
    { ic: '🔍', t: 'Buscar por DNI', sel: 'nav button.ni[onclick*="ir(\'trabajadores\'"]' },
    { ic: '⚖️', t: 'Registrar caso', nav: 'navCasos', ghost: true },
    { ic: '🏕️', t: 'Visita de campo', nav: 'navVisitas', ghost: true },
    { ic: '📧', t: 'Enviar reporte', nav: 'navCorreo', ghost: true },
    { ic: '📚', t: 'Capacitaciones', sel: 'nav button.ni[onclick*="capacitaciones.html"]', ghost: true }
  ];
  function visible(b) { try { return !!b && b.style.display !== 'none' && getComputedStyle(b).display !== 'none'; } catch (e) { return !!b && b.style.display !== 'none'; } }
  function accionesRapidas() {
    var c = $('d2Acc'); if (!c) return;
    var html = '';
    ACC.forEach(function (a, i) {
      var b = a.nav ? $(a.nav) : document.querySelector(a.sel);
      if (!visible(b)) return;
      html += '<button type="button" class="' + (a.ghost ? 'ghost' : '') + '" data-i="' + i + '">' + a.ic + ' ' + esc(a.t) + '</button>';
    });
    if (c.innerHTML !== html) {
      c.innerHTML = html;
      c.querySelectorAll('button').forEach(function (btn) {
        btn.onclick = function () { var a = ACC[+btn.getAttribute('data-i')]; try { if (a.fn) a.fn(); else { var b = a.nav ? $(a.nav) : document.querySelector(a.sel); if (b) b.click(); } } catch (e) {} };
      });
    }
  }

  /* ── 2) Fila nueva: Seguimiento + Actividad ── */
  function fila() {
    var sec = $('sec-dashboard'), sg = sec && sec.querySelector('.sg');
    if (!sec || !sg || $('d2Fila')) return;
    var f = document.createElement('div'); f.id = 'd2Fila';
    f.innerHTML =
      '<div class="d2-card"><div class="t">⏰ Seguimiento de tu gestión <span class="r" id="d2SegR"></span></div><div id="d2Seg"><div class="vacio" style="color:#64748b;font-size:12.5px">Revisando tus pendientes…</div></div></div>' +
      '<div class="d2-card"><div class="t">⚡ Actividad reciente <span class="d2-live" style="margin-left:auto"><i></i> en vivo</span></div><div id="d2Feed"><div class="vacio">Cargando movimientos…</div></div></div>';
    sg.parentNode.insertBefore(f, sg.nextSibling);
    seguimientoEspejo();
    try { new MutationObserver(function () { seguimientoEspejo(); }).observe(document.body, { childList: true }); } catch (e) {}
    setTimeout(function () { if ($('d2Seg') && /Revisando/.test($('d2Seg').textContent)) seguimientoEspejo(true); }, 20000);
    feed(); setInterval(function () { if (!document.hidden && sec.classList.contains('on')) feed(); }, 60000);
  }
  /* espejo de la alerta flotante #_rlPendCard (presencia.js) — misma informacion, dentro del dashboard */
  function seguimientoEspejo(final) {
    var box = $('d2Seg'); if (!box) return;
    var card = $('_rlPendCard'), pill = $('_rlPendPill');
    if (card) {
      var items = Array.prototype.slice.call(card.children).filter(function (el) { return el.tagName === 'DIV' && el.querySelector && !el.querySelector('#_rlPendMin') && /border-radius/.test(el.getAttribute('style') || ''); });
      if (items.length) {
        box.innerHTML = items.map(function (el) {
          var st = el.getAttribute('style') || '', cls = /239,68,68/.test(st) ? 'rojo' : /250,204,21|251,191,36|245,158,11/.test(st) ? 'amar' : 'ok';
          return '<div class="it ' + cls + '">' + el.innerHTML + '</div>';
        }).join('');
        var r = $('d2SegR'); if (r) r.textContent = items.length + ' pendiente(s)';
        return;
      }
    }
    if (pill) return;   /* minimizada: se conserva lo ultimo copiado */
    if (final || (usr() && String(usr().usuario).toLowerCase() === 'jtimoteo')) {
      box.innerHTML = '<div class="ok-all"><span class="big">✅</span><div>Sin pendientes por ahora.<br><span style="font-weight:500;font-size:12px">Informes de visitas, casos y capacitaciones ETI al día.</span></div></div>';
      var r2 = $('d2SegR'); if (r2) r2.textContent = 'al día';
    }
  }
  /* actividad reciente: eventos /trafico (los mismos del Monitor); supervisor ve lo suyo, admin ve a todos */
  var COLOR = { ok: '#16a34a', nav: '#2563eb', consulta: '#7c3aed', error: '#dc2626' };
  function hace(ts) { var s = Math.max(0, Math.round((Date.now() - ts) / 1000)); if (s < 60) return 'hace ' + s + ' s'; var m = Math.round(s / 60); if (m < 60) return 'hace ' + m + ' min'; var h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h'; return 'ayer'; }
  function feed() {
    var box = $('d2Feed'), u = usr(); if (!box || !u) return;
    var DB = (window.RLTrafico && RLTrafico.DB) || 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
    var desde = Date.now() - 24 * 3600 * 1000, yo = String(u.usuario).toLowerCase(), admin = yo === 'jtimoteo' || /^(administrador|coordinador|jefa)/i.test(String(u.rol || ''));
    fetch(DB + '/trafico.json?orderBy="$key"&startAt="' + desde + '"&limitToLast=200', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var ev = Object.keys(j || {}).map(function (k) { return j[k]; }).filter(function (e) { return e && e.ts; });
      ev = ev.filter(function (e) { var t = String(e.tipo || 'ok'); if (t === 'consulta') return false; if (admin) return t !== 'nav' || String(e.u) === yo; return String(e.u) === yo; });
      ev.sort(function (a, b) { return b.ts - a.ts; }); ev = ev.slice(0, 8);
      if (!ev.length) { box.innerHTML = '<div class="vacio">Todavía no hay movimientos hoy. Lo que registres aparecerá aquí.</div>'; return; }
      box.innerHTML = ev.map(function (e) {
        var t = String(e.tipo || 'ok'); if (t !== 'error' && t !== 'nav' && t !== 'consulta') t = 'ok';
        var quien = String(e.u) === yo ? 'Tú' : String(e.n || e.u).split(' ').slice(0, 2).join(' ');
        var acc = String(e.accion || ''); if (quien === 'Tú') acc = acc.replace(/^Guardó/, 'Guardaste').replace(/^Registró/, 'Registraste').replace(/^Actualizó/, 'Actualizaste').replace(/^Eliminó/, 'Eliminaste').replace(/^Entró/, 'Entraste').replace(/^Subió/, 'Subiste').replace(/^Cerró/, 'Cerraste').replace(/^Inició/, 'Iniciaste');
        return '<div class="e"><span class="dot" style="background:' + COLOR[t] + '"></span><div class="tx"><b>' + (quien === 'Tú' ? '' : esc(quien) + ' · ') + esc(acc) + (e.detalle ? ' ' + esc(e.detalle) : '') + '</b><span>' + esc(e.destino || '') + (String(e.sis || '').indexOf('RR') < 0 && e.sis ? ' · ' + esc(e.sis) : '') + '</span></div><span class="h">' + hace(e.ts) + '</span></div>';
      }).join('');
    }).catch(function () { if (/Cargando/.test(box.textContent)) box.innerHTML = '<div class="vacio">Sin conexión con el registro de actividad.</div>'; });
  }

  function iniciar() {
    try {
      var st = document.createElement('style'); st.id = 'd2Css'; st.textContent = CSS; document.head.appendChild(st);
      hero(); fila();
      console.log('[_DASH_UI_V2] listo');
    } catch (e) { console.warn('[_DASH_UI_V2] no se aplico:', e); try { var s = $('d2Css'); if (s) s.remove(); var h = $('d2Hero'); if (h) h.remove(); } catch (e2) {} }
  }
  /* espera a que exista la sesion (USER se arma en window.onload) */
  (function esperar(n) {
    var ok = false; try { ok = !!(usr() && $('sec-dashboard')); } catch (e) {}
    if (ok && document.readyState !== 'loading') { iniciar(); return; }
    if (n < 80) setTimeout(function () { esperar(n + 1); }, 150);
  })(0);
})();
