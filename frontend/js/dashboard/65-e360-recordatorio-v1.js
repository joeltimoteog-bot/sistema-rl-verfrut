/* ═══════════════════════════════════════════════════════════════════════════
   65-e360-recordatorio-v1.js — _E360_RECORDATORIO_V1 (27-oct-2026)
   Solo para el dueño del sistema (jtimoteo): desde el dia 16 de cada mes, en el inicio del
   dashboard aparece "Joel, en esta quincena te toca la Evaluacion 360°" con la lista de
   supervisores que AUN no tienen evaluacion en el mes y un boton para ir a evaluar.
   Lee: /kpi/tablero (personas) + getEvaluaciones360. Si algo falla, no muestra nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._E360_RECORDATORIO_V1) return; window._E360_RECORDATORIO_V1 = true;
  var DUENO = 'jtimoteo', DIA_INICIO = 16, AZ = 'https://rl-fn-verfrut.azurewebsites.net/api';
  function yo() { try { return String((typeof USER !== 'undefined' && USER && USER.usuario) || JSON.parse(sessionStorage.getItem('user') || '{}').usuario || '').toLowerCase(); } catch (e) { return ''; } }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function misma(a, b) { var A = norm(a).split(' ').filter(function (w) { return w.length > 2; }), B = ' ' + norm(b) + ' ', n = 0; A.forEach(function (w) { if (B.indexOf(' ' + w + ' ') >= 0) n++; }); return n >= 2; }
  function titulo(n) { return String(n || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  async function revisar() {
    if (yo() !== DUENO) return;
    var hoy = new Date(); if (hoy.getDate() < DIA_INICIO) return;
    var mes = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2);
    var claveOcultar = 'e360_rec_oculto_' + mes + '_' + hoy.getDate();
    try { if (localStorage.getItem(claveOcultar)) return; } catch (e) {}
    var kp = await fetch(AZ + '/kpi/tablero', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    if (!kp || !kp.personas) return;
    var personas = kp.personas.filter(function (p) { return p.tipo === 'SUP' || p.tipo === 'ASIST'; });
    var ev = null; try { ev = typeof apiGet === 'function' ? await apiGet({ action: 'getEvaluaciones360' }) : null; } catch (e) { ev = null; }
    if (!ev || !ev.success) return;
    var hechas = (ev.data || []).filter(function (e) { return String(e.periodo || String(e.fecha || '').slice(0, 7)) === mes; });
    var faltan = personas.filter(function (p) { return !hechas.some(function (e) { return misma(e.supervisor, p.nombre); }); });
    if (!faltan.length) return;
    var ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), quedan = ult - hoy.getDate();
    pintar(faltan, personas.length, quedan, claveOcultar);
  }
  function pintar(faltan, total, quedan, claveOcultar) {
    var sec = document.getElementById('sec-dashboard'); if (!sec || document.getElementById('e360Rec')) return;
    var d = document.createElement('div'); d.id = 'e360Rec';
    d.style.cssText = 'margin:0 0 16px;border-radius:18px;padding:16px 18px;background:linear-gradient(135deg,#0b1e45,#1e3a8a 60%,#2563eb);color:#fff;box-shadow:0 14px 30px -14px rgba(30,58,138,.6);display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap';
    d.innerHTML = '<div style="font-size:30px;line-height:1">🧭</div><div style="flex:1;min-width:240px">'
      + '<div style="font-weight:800;font-size:15.5px">Joel, en esta quincena te toca la Evaluación 360°</div>'
      + '<div style="font-size:13px;opacity:.9;margin:3px 0 10px">Faltan <b>' + faltan.length + ' de ' + total + '</b> · quedan <b>' + quedan + ' día' + (quedan === 1 ? '' : 's') + '</b> para cerrar el mes. Evalúa con la evidencia de KPIs y dales su feedback.</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + faltan.map(function (p) { return '<span style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700">' + esc(titulo(p.nombre)) + '</span>'; }).join('') + '</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:8px"><button type="button" id="e360RecIr" style="border:0;border-radius:12px;padding:10px 16px;background:#fff;color:#0b1e45;font-weight:800;cursor:pointer">Ir a evaluar →</button>'
      + '<button type="button" id="e360RecOc" style="border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:8px 14px;background:transparent;color:#fff;font-weight:700;cursor:pointer;font-size:12.5px">Recordar mañana</button></div>';
    sec.insertBefore(d, sec.firstChild);
    document.getElementById('e360RecIr').onclick = function () { location.href = 'evaluacion360.html'; };
    document.getElementById('e360RecOc').onclick = function () { try { localStorage.setItem(claveOcultar, '1'); } catch (e) {} d.remove(); };
  }
  setTimeout(function () { revisar().catch(function (e) { console.warn('[_E360_RECORDATORIO_V1]', e && e.message); }); }, 4000);
})();
