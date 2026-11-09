/* ═══════════════════════════════════════════════════════════════════════════
   64-e360-asistente-v1.js — _E360_ASISTENTE_V1 (08-nov-2026) · Evaluación 360° MENSUAL guiada
   ---------------------------------------------------------------------------
   Para los evaluadores autorizados (programación en Supabase: e360Programa), al entrar al panel
   en periodo de evaluación (desde el día de inicio del mes; del 1 al día anterior se revisa el mes
   previo con pendientes) se abre una ventana con los supervisores GH y asistentes RR.LL. que faltan
   evaluar y el botón "Evaluar ahora": lleva al formulario en modo asistente, que los recorre
   uno por uno con sus KPIs ya cargados (e360-asistente-form-v1.js).
   Reemplaza al recordatorio anterior (65-e360-recordatorio-v1.js), que queda apagado.
   Lee: POST e360/guardar/e360Pendientes (Supabase). Si algo falla, no muestra nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._E360_ASISTENTE_V1) return; window._E360_ASISTENTE_V1 = true;
  window._E360_RECORDATORIO_V1 = true;   /* apaga el aviso antiguo: este lo sustituye */
  var EDGE = (window.RL_EDGE_URL || 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api') + '/e360/guardar/';
  var LOG = function (m) { try { console.log('[_E360_ASISTENTE_V1] ' + m); } catch (e) {} };
  function tk() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function titulo(n) { return String(n || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function primerNombre() { try { var u = JSON.parse(sessionStorage.getItem('user') || '{}'), n = String(u.nombre || '').trim().split(/\s+/); if (!n[0]) return ''; var p = (n.length >= 3 && n.join(' ') === n.join(' ').toUpperCase()) ? n[2] : n[0]; return titulo(p); } catch (e) { return ''; } }

  async function pendientes() {
    var t = tk(); if (!t) return null;
    try {
      var r = await fetch(EDGE + 'e360Pendientes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' });
      if (!r.ok) { LOG('HTTP ' + r.status); return null; }
      return await r.json();
    } catch (e) { LOG('error ' + e.message); return null; }
  }

  async function revisar() {
    var d = await pendientes();
    if (!d || !d.success) return;
    if (!d.evaluador_autorizado) { LOG('no es evaluador autorizado'); return; }
    if (!d.pendientes || !d.pendientes.length) { LOG('sin pendientes en ' + d.periodo); return; }
    var claveOcultar = 'e360_asis_oculto_' + d.periodo + '_' + d.hoy;
    try { if (localStorage.getItem(claveOcultar)) { chip(d); return; } } catch (e) {}
    pintar(d, claveOcultar);
  }

  /* pastilla discreta para retomar cuando se pidió "Más tarde" */
  function chip(d) {
    var sec = document.getElementById('sec-dashboard'); if (!sec || document.getElementById('e360Chip')) return;
    var c = document.createElement('div'); c.id = 'e360Chip';
    c.style.cssText = 'margin:0 0 12px;display:inline-flex;align-items:center;gap:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer';
    c.innerHTML = '🧭 Evaluación 360° de ' + esc(d.mes) + ': faltan <b>' + d.pendientes.length + '</b> · Evaluar ahora →';
    c.onclick = function () { location.href = 'evaluacion360.html?asistente=1'; };
    sec.insertBefore(c, sec.firstChild);
  }

  function pintar(d, claveOcultar) {
    if (document.getElementById('e360Asis')) return;
    var css = document.createElement('style');
    css.textContent = '#e360Asis{position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
      + '#e360Asis .ea-card{background:#fff;color:#0f172a;max-width:560px;width:100%;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden;animation:eaIn .25s ease-out}'
      + '@keyframes eaIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}'
      + '#e360Asis .ea-top{background:linear-gradient(135deg,#0b1e45,#1e3a8a 60%,#2563eb);color:#fff;padding:20px 24px}'
      + '#e360Asis .ea-top h2{margin:0;font-size:19px;font-weight:800}#e360Asis .ea-top p{margin:6px 0 0;font-size:13px;opacity:.92}'
      + '#e360Asis .ea-body{padding:18px 24px;font-size:14px;line-height:1.5}'
      + '#e360Asis .ea-list{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}#e360Asis .ea-list span{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:700;color:#1e293b}'
      + '#e360Asis .ea-list span small{color:#64748b;font-weight:600}'
      + '#e360Asis .ea-foot{padding:0 24px 20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}'
      + '#e360Asis .ea-b1{background:#1e3a8a;color:#fff;border:0;border-radius:12px;padding:11px 20px;font-size:14px;font-weight:800;cursor:pointer}#e360Asis .ea-b1:hover{background:#172e6e}'
      + '#e360Asis .ea-b2{background:#fff;color:#1e3a8a;border:1px solid #cbd5e1;border-radius:12px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer}';
    document.head.appendChild(css);
    var nom = primerNombre(), n = d.pendientes.length;
    var box = document.createElement('div'); box.id = 'e360Asis'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="ea-card"><div class="ea-top"><h2>🧭 ' + (nom ? esc(nom) + ', ' : '') + (d.arrastre ? 'la Evaluación 360° de ' + esc(d.mes) + ' tiene pendientes' : 'te toca la Evaluación 360° de ' + esc(d.mes)) + '</h2>'
      + '<p>Evaluación mensual de supervisores de Gestión Humana y asistentes de RR.LL. · ' + (d.arrastre ? '<b>el mes ya cerró</b>: regulariza los pendientes' : 'quedan <b>' + d.dias_restantes + ' día(s)</b> del mes') + '</p></div>'
      + '<div class="ea-body">Faltan <b>' + n + ' de ' + d.total + '</b> (' + d.hechas + ' ya registradas). El asistente te los presenta <b>uno por uno</b> con sus indicadores del mes ya cargados; tú confirmas o ajustas cada nota y agregas tus observaciones.'
      + '<div class="ea-list">' + d.pendientes.map(function (p) { return '<span>' + esc(titulo(p.nombre)) + ' <small>· ' + esc(p.empresa || '') + (p.tipo === 'ASIST' ? ' · asistente' : '') + '</small></span>'; }).join('') + '</div></div>'
      + '<div class="ea-foot"><button type="button" class="ea-b2" id="e360AsisLuego">Más tarde</button><button type="button" class="ea-b1" id="e360AsisIr">Evaluar ahora (' + n + ')</button></div></div>';
    document.body.appendChild(box);
    document.getElementById('e360AsisIr').onclick = function () { location.href = 'evaluacion360.html?asistente=1'; };
    document.getElementById('e360AsisLuego').onclick = function () { try { localStorage.setItem(claveOcultar, '1'); } catch (e) {} box.remove(); chip(d); };
  }
  setTimeout(function () { revisar().catch(function (e) { LOG(e && e.message); }); }, 2500);
})();
