/* ══════════════════ _MILES_COMA_V1 (27-nov-2026, pedido de Joel) ══════════════════
   Panel de Gestión: las cifras de 1,000 o más llevan coma de miles (28,048).
   · Tarjetas: Hoy, Este mes, En proceso, Finalizados, Todo el año.
   · Resumen por año (Total, RAPEL, VERFRUT, En proceso, Finalizado); la columna Año no se toca.
   · Ranking de supervisores (inicio y Estadísticas).
   · Tendencia anual: muestra el total de cada año sobre su punto (2024, 2025, 2026).
   Solo presentación: no cambia consultas ni datos. Las animaciones de conteo siguen funcionando
   (se les quita la coma antes de leer el número).
   · Apagar en este navegador: localStorage.rl_miles_coma = 'off' y recargar.
   ══════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_miles_coma') === 'off') return; } catch (e) {}
  if (window._MILES_COMA_V1) return;
  window._MILES_COMA_V1 = true;

  function f(n) { n = Number(n) || 0; return n.toLocaleString('es-PE', { maximumFractionDigits: 0 }); }

  /* Tarjetas: el texto entero es la cifra */
  var TARJETAS = ['sH', 'sM', 'sP', 'sF', 'sA'];
  /* Tablas por año: todas las celdas menos la primera (el año) */
  var TABLAS = ['tbResAnualBody', 'tbResAnualBodyAdmin'];
  /* Listas: cifras sueltas dentro del texto (ej. "1234 at · 5 vis") */
  var LISTAS = ['fbRankingLista', 'estRankingBody'];

  function entero(t) { var s = String(t || '').trim(); return /^\d{4,}$/.test(s) ? f(s) : null; }
  function enTexto(t) { return String(t).replace(/(^|[^\d.,#])(\d{4,})(?![\d.,])/g, function (m, a, d) { return a + f(d); }); }

  function nodosTexto(el, cb) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, l = [];
    while ((n = w.nextNode())) l.push(n);
    l.forEach(cb);
  }
  function arreglar(el, modo) {
    if (modo === 'tarjeta') { var v = entero(el.textContent); if (v !== null && el.textContent !== v) el.textContent = v; return; }
    if (modo === 'tabla') {
      Array.prototype.forEach.call(el.querySelectorAll('tr'), function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) {
          if (i === 0) return;
          nodosTexto(td, function (n) { var v = entero(n.nodeValue); if (v !== null && n.nodeValue.trim() !== v) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), v); });
        });
      });
      return;
    }
    nodosTexto(el, function (n) { var v = enTexto(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }

  var vigilados = typeof WeakSet === 'function' ? new WeakSet() : null;
  function vigilar(id, modo) {
    var el = document.getElementById(id); if (!el || (vigilados && vigilados.has(el))) return;
    if (vigilados) vigilados.add(el);
    var pend = false;
    var ob = new MutationObserver(function () {
      if (pend) return; pend = true;
      Promise.resolve().then(function () { pend = false; ob.disconnect(); try { arreglar(el, modo); } catch (e) {} ob.observe(el, { childList: true, subtree: true, characterData: true }); });
    });
    try { arreglar(el, modo); } catch (e) {}
    ob.observe(el, { childList: true, subtree: true, characterData: true });
  }
  function todo() {
    TARJETAS.forEach(function (id) { vigilar(id, 'tarjeta'); });
    TABLAS.forEach(function (id) { vigilar(id, 'tabla'); });
    LISTAS.forEach(function (id) { vigilar(id, 'lista'); });
  }

  /* Conteo animado: lee el número sin comas (si no, "28,048" se leería como 28) */
  function envolverConteo() {
    var cu = window.countUp;
    if (typeof cu !== 'function' || cu._milesComa) return;
    var w = function (id) {
      try { var el = document.getElementById(id); if (el && /,/.test(el.textContent)) el.textContent = el.textContent.replace(/,/g, ''); } catch (e) {}
      return cu.apply(this, arguments);
    };
    w._milesComa = true;
    window.countUp = w;
  }

  /* Tendencia anual: total de cada año encima de su punto */
  function registrarTendencia() {
    var C = window.Chart; if (!C || typeof C.register !== 'function' || C._milesTend) return;
    C._milesTend = true;
    try {
      C.register({ id: 'rlTendAnualValores', beforeUpdate: function (ch) {
        try { if (ch.canvas && ch.canvas.id === 'cTendAnual') { var o = ch.config.options = ch.config.options || {}; o.layout = o.layout || {}; o.layout.padding = { top: 22, right: 6, left: 6, bottom: 0 }; } } catch (e) {}
      }, afterDatasetsDraw: function (ch) {
        try {
          if (!ch.canvas || ch.canvas.id !== 'cTendAnual') return;
          var ds = ch.data.datasets[0], meta = ch.getDatasetMeta(0); if (!ds || !meta || meta.hidden) return;
          var c = ch.ctx, top = ch.chartArea ? ch.chartArea.top : 0;
          c.save(); c.font = '800 11.5px "Barlow Condensed",Barlow,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#0a2463';
          meta.data.forEach(function (p, i) {
            var v = ds.data[i]; if (v == null || isNaN(Number(v))) return;
            var n = meta.data.length;
            c.textBaseline = 'bottom';
            c.textAlign = n > 1 && i === 0 ? 'left' : (n > 1 && i === n - 1 ? 'right' : 'center');
            c.fillText(f(v), p.x + (c.textAlign === 'left' ? -4 : c.textAlign === 'right' ? 4 : 0), Math.max(p.y - 9, top - 4));
          });
          c.restore();
        } catch (e) {}
      } });
    } catch (e) { console.warn('[_MILES_COMA_V1] tendencia:', e.message); }
  }

  function iniciar() {
    todo(); envolverConteo(); registrarTendencia();
    try { var _t = window.Chart && window.Chart.getChart && window.Chart.getChart('cTendAnual'); if (_t) _t.update('none'); } catch (e) {}
    setInterval(function () { todo(); envolverConteo(); }, 3000);
    console.log('[_MILES_COMA_V1] listo');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
