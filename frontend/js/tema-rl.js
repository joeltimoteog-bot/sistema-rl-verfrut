/* ═══════════════════════════════════════════════════════════════════════════
   _TEMA_RL_V1 (16-oct-2026) — piel moderna COMÚN para los módulos secundarios del Sistema RL
   (Horas, Capacitaciones, Mantenimiento, Inventario, Almuerzos, Preaviso, Cálculo remunerativo,
    Consulta masiva, Estadísticas, Estadísticas de atenciones, Resumen, Evaluación 360, KPIs,
    Informe gerencial, Gestión usuarios)
   ---------------------------------------------------------------------------
   SOLO PRESENTACION. No cambia ningún id, flujo, consulta ni guardado:
     · Mismas clases que ya usan las páginas (.topbar/.top, .card, .card-title/.card-h, .kpi,
       .stat-val, .btn*, table, inputs, .modal/.ov, .bdg/.badge/.bg) con colores, radios, sombras,
       cabecera de tabla fija, filas cebra y foco de campos unificados con el Dashboard.
     · Gráficos (Chart.js): degradados, barras redondeadas, dona con total al centro, tooltips.
       Misma mejora que Mi Dashboard; los datos no se tocan.
     · Entrada suave de la página. Nada se mueve de lugar: el usuario trabaja igual que siempre.
   Si algo falla, no se aplica nada. Para desactivar: quitar el <script src=".../tema-rl.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._TEMA_RL_V1) return;
  window._TEMA_RL_V1 = true;

  var CSS = '\
:root{--rl-navy:#0a2463;--rl-navy2:#1e3a8a;--rl-blue:#2563eb;--rl-bd:#e3e9f3;--rl-mut:#64748b;--rl-bg:#eef2f8}\
body{animation:rlFade .35s ease}\
@keyframes rlFade{from{opacity:0}to{opacity:1}}\
/* cabecera */\
.rl-hdr-dark{background:linear-gradient(110deg,#07173f,#0a2463 50%,#1d4ed8) !important;box-shadow:0 8px 24px rgba(10,36,99,.25)}\
.rl-hdr-light{box-shadow:0 4px 18px rgba(10,36,99,.08);border-bottom:0 !important;background-image:linear-gradient(90deg,#dc2626 0 30%,#0a2463 30% 70%,#2563eb 70%) !important;background-size:100% 3px !important;background-repeat:no-repeat !important;background-position:bottom !important}\
/* tarjetas */\
.card{border-radius:16px !important;border:1px solid var(--rl-bd);box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px -16px rgba(10,36,99,.18);transition:box-shadow .2s}\
.card-title,.card-t,.card-h .card-t,.card h2,.card h3{color:var(--rl-navy)}\
.card-title,.card-t{font-weight:800}\
.card-h{border-radius:16px 16px 0 0}\
/* indicadores */\
.kpi,.stat,.kpi-card,.stat-card{border-radius:16px !important;transition:transform .18s,box-shadow .18s}\
.kpi:hover,.stat:hover,.kpi-card:hover,.stat-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(10,36,99,.14)}\
.kpi-value,.stat-val,.kpi .v,.kpi b,.kpi-num,.stat-num{font-variant-numeric:tabular-nums;letter-spacing:-.3px}\
/* tablas */\
table thead th,table tr:first-child th{font-size:10px;letter-spacing:1.1px;text-transform:uppercase;position:sticky;top:0;z-index:2}\
table tbody tr:nth-child(even) td{background:rgba(248,250,254,.9)}\
table tbody tr:hover td{background:#eef4ff}\
/* campos */\
input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),select,textarea{border-radius:9px}\
input:not([type=checkbox]):not([type=radio]):focus,select:focus,textarea:focus{outline:none;border-color:var(--rl-blue) !important;box-shadow:0 0 0 3px rgba(37,99,235,.13)}\
/* botones */\
.btn,[class^="btn-"],[class*=" btn-"]{border-radius:10px;transition:transform .12s,box-shadow .12s,filter .12s}\
.btn:hover,[class^="btn-"]:hover,[class*=" btn-"]:hover{transform:translateY(-1px);filter:brightness(1.04)}\
.btn:disabled,[class^="btn-"]:disabled,[class*=" btn-"]:disabled{transform:none;filter:none}\
.btn-primary,.btn-pri,.btn-blue,.btn-az,.btn-save,.btn-n,.btn.bp,.btn-green,.btn.verde{box-shadow:0 6px 16px -6px rgba(10,36,99,.45)}\
/* etiquetas */\
.bdg,.badge,.bg{border-radius:999px}\
/* modales */\
.ov .modal,.modal .box,.modal-content{border-radius:18px}\
.ov .modal,.modal .box,.modal-content{box-shadow:0 30px 80px rgba(0,0,0,.4)}\
/* avisos vacíos */\
.empty,.vacio,.sin-datos{color:var(--rl-mut)}\
/* scrollbar fino */\
*::-webkit-scrollbar{width:9px;height:9px}*::-webkit-scrollbar-thumb{background:#c7d2e6;border-radius:999px;border:2px solid transparent;background-clip:padding-box}*::-webkit-scrollbar-thumb:hover{background:#94a3b8;background-clip:padding-box}\
@media print{body{animation:none}table thead th{position:static}}';

  try { var st = document.createElement('style'); st.id = 'rlTemaCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  /* ── Chart.js: misma mejora que Mi Dashboard, para TODOS los gráficos de la página ── */
  function charts() {
    if (window._TEMA_CHARTS_V1 || window._DASH_CHARTS_V2 || typeof window.Chart !== 'function') return;
    window._TEMA_CHARTS_V1 = true;
    var Orig = window.Chart;
    function hex2rgb(h) { var m = String(h || '').match(/^#([0-9a-f]{6})$/i); if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function rgba(h, a) { var c = hex2rgb(h); return c ? 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')' : h; }
    function fmt(v) { v = Number(v) || 0; return Number.isInteger(v) && Math.abs(v) >= 1000 ? v.toLocaleString('es-PE') : String(Math.round(v * 100) / 100); }
    function grad(base, vertical) { return function (ctx) { try { var ch = ctx.chart, area = ch.chartArea; if (!area) return base; var g = ch.ctx.createLinearGradient(0, area.top, 0, area.bottom); g.addColorStop(0, base); g.addColorStop(1, rgba(base, vertical ? 0.55 : 0.05)); return g; } catch (e) { return base; } }; }
    var centro = { id: 'rlCentro', afterDraw: function (ch) { try { if (ch.config.type !== 'doughnut') return; var ds = ch.data.datasets[0]; if (!ds) return; var tot = (ds.data || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); var x = (ch.chartArea.left + ch.chartArea.right) / 2, y = (ch.chartArea.top + ch.chartArea.bottom) / 2; var c = ch.ctx; c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 20px "Barlow Condensed",Barlow,sans-serif'; c.fillStyle = '#0a2463'; c.fillText(fmt(tot), x, y - 5); c.font = '600 10px Barlow,sans-serif'; c.fillStyle = '#64748b'; var i = Number(ch.$rlHover), sub = 'total'; if (!isNaN(i) && ds.data[i] != null && tot) sub = String(ch.data.labels[i]).slice(0, 18) + ' · ' + Math.round(ds.data[i] / tot * 100) + '%'; c.fillText(sub, x, y + 11); c.restore(); } catch (e) {} },
      afterEvent: function (ch, args) { try { var els = ch.getElementsAtEventForMode(args.event, 'nearest', { intersect: true }, false); ch.$rlHover = els.length ? els[0].index : undefined; } catch (e) {} } };
    var valores = { id: 'rlValores', afterDatasetsDraw: function (ch) { try { if (ch.config.type !== 'bar') return; var n = (ch.data.labels || []).length; if (!n || n > 14 || ch.data.datasets.length > 3) return; var horiz = ch.options && ch.options.indexAxis === 'y'; if (horiz) return; var c = ch.ctx; c.save(); c.font = '700 10px Barlow,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#334155'; ch.data.datasets.forEach(function (ds, di) { var meta = ch.getDatasetMeta(di); if (!meta || meta.hidden) return; meta.data.forEach(function (bar, i) { var v = ds.data[i]; if (v == null || !Number(v)) return; c.fillText(fmt(v), bar.x, bar.y - 4); }); }); c.restore(); } catch (e) {} } };
    function mejorar(cfg) {
      var t = cfg.type, o = cfg.options = cfg.options || {}, p = o.plugins = o.plugins || {};
      if (o.animation === undefined) o.animation = { duration: 800, easing: 'easeOutQuart' };
      p.tooltip = Object.assign({ backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#e2e8f0', padding: 10, cornerRadius: 10, boxPadding: 4, titleFont: { family: 'Barlow', weight: '800', size: 12 }, bodyFont: { family: 'Barlow', size: 12 } }, p.tooltip || {});
      if (p.legend && p.legend.display !== false) p.legend.labels = Object.assign({ usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12, font: { family: 'Barlow', weight: '700', size: 11 }, color: '#475569' }, p.legend.labels || {});
      if (t === 'bar' || t === 'line') {
        o.scales = o.scales || {}; o.scales.x = o.scales.x || {}; o.scales.y = o.scales.y || {};
        var horiz = o.indexAxis === 'y', cat = horiz ? o.scales.y : o.scales.x, val = horiz ? o.scales.x : o.scales.y;
        cat.grid = Object.assign({ display: false }, cat.grid || {}); cat.border = Object.assign({ display: false }, cat.border || {});
        cat.ticks = Object.assign({ font: { family: 'Barlow', weight: '700', size: 11 }, color: '#64748b' }, cat.ticks || {});
        val.grid = Object.assign({ color: 'rgba(100,116,139,.12)', drawTicks: false }, val.grid || {}); val.border = Object.assign({ display: false, dash: [4, 4] }, val.border || {});
        val.ticks = Object.assign({ font: { family: 'Barlow', size: 10.5 }, color: '#94a3b8', padding: 6 }, val.ticks || {});
      }
      (cfg.data && cfg.data.datasets || []).forEach(function (ds) {
        if (t === 'bar' && typeof ds.backgroundColor === 'string' && ds.backgroundColor.charAt(0) === '#') { var base = ds.backgroundColor; ds.backgroundColor = grad(base, true); ds.hoverBackgroundColor = base; if (ds.borderRadius === undefined || typeof ds.borderRadius === 'number') ds.borderRadius = 8; ds.borderSkipped = false; if (!ds.maxBarThickness) ds.maxBarThickness = 54; }
        if (t === 'line') { var bc = ds.borderColor || '#0a2463'; if (ds.borderWidth === undefined) ds.borderWidth = 3; if (ds.tension === undefined) ds.tension = 0.4; if (ds.pointRadius === undefined) ds.pointRadius = 4; ds.pointHoverRadius = 7; ds.pointBackgroundColor = ds.pointBackgroundColor || '#fff'; ds.pointBorderColor = ds.pointBorderColor || bc; ds.pointBorderWidth = ds.pointBorderWidth || 2.5; if (ds.fill && typeof bc === 'string' && bc.charAt(0) === '#') ds.backgroundColor = grad(bc, false); }
        if (t === 'doughnut' || t === 'pie') { ds.borderWidth = 3; ds.borderColor = '#fff'; ds.hoverOffset = 10; if (t === 'doughnut') ds.borderRadius = 4; }
      });
      if (t === 'doughnut') { if (o.cutout === undefined) o.cutout = '68%'; cfg.plugins = (cfg.plugins || []).concat([centro]); }
      if (t === 'bar') cfg.plugins = (cfg.plugins || []).concat([valores]);
      return cfg;
    }
    function Wrap(el, cfg) { try { if (cfg) cfg = mejorar(cfg); } catch (e) {} return new Orig(el, cfg); }
    Object.setPrototypeOf(Wrap, Orig); Wrap.prototype = Orig.prototype;
    try { Object.getOwnPropertyNames(Orig).forEach(function (k) { if (!(k in Wrap)) { try { Wrap[k] = Orig[k]; } catch (e) {} } }); } catch (e) {}
    try { Orig.defaults.font.family = 'Barlow, "Segoe UI", sans-serif'; Orig.defaults.color = '#64748b'; } catch (e) {}
    window.Chart = Wrap;
  }
  /* cabecera: degradado solo si ya era oscura; si era blanca, solo una linea de acento y sombra */
  function cabeceras() {
    try {
      document.querySelectorAll('.topbar, .top, header').forEach(function (h) {
        if (h.closest('.card') || h.classList.contains('rl-hdr-dark') || h.classList.contains('rl-hdr-light')) return;
        var bg = getComputedStyle(h).backgroundColor || '', m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return;
        var lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
        h.classList.add(lum < 0.5 ? 'rl-hdr-dark' : 'rl-hdr-light');
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cabeceras); else cabeceras();
  charts();
  /* si Chart.js carga después de este archivo */
  if (typeof window.Chart !== 'function') { var n = 0; var t = setInterval(function () { if (typeof window.Chart === 'function') { clearInterval(t); charts(); } else if (++n > 40) clearInterval(t); }, 250); }

  console.log('[_TEMA_RL_V1] listo');
})();
