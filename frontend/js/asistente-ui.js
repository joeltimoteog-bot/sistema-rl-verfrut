/* ═══════════════════════════════════════════════════════════════════════════
   _ASIS_UI_V1 (18-oct-2026) — Asistente RR.LL. (🤖) modernizado · solo presentación
   ---------------------------------------------------------------------------
   El guion, las respuestas, los permisos por usuario, "Mis datos", el modo
   administrador, "Hablar con Joel" y la búsqueda por palabras NO cambian: viven en
   dashboard.html (_ASISTENTE_RL_V1 / _ASISTENTE_ADMIN_V1 / _ASISTENTE_DATOS_V1).
   Este archivo solo decora el panel existente (#rlAsisPanel) con CSS y un
   observador del cuerpo del chat:
     · panel más amplio, cabecera con avatar + "En línea", burbujas con hora,
       fondo punteado, animaciones suaves, móvil a pantalla completa;
     · "escribiendo…" de ~0,5 s antes de cada respuesta del bot (solo visual);
     · el menú principal (lista de módulos) se muestra como tarjetas en cuadrícula;
     · sugerencias rápidas sobre el cuadro de texto según la pantalla en que estás;
     · globito "¿Dudas? Pregúntame" en el botón flotante la primera vez (10 s).
   Para desactivar: quitar la etiqueta <script src=".../asistente-ui.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ASIS_UI_V1) return;
  window._ASIS_UI_V1 = true;
  function $(id) { return document.getElementById(id); }
  var TYPING_MS = 480;

  var CSS = '\
#rlAsisPanel{width:400px !important;height:580px !important;max-height:calc(100vh - 40px) !important;border-radius:20px !important;box-shadow:0 24px 70px rgba(2,6,23,.3) !important;animation:asisIn .25s cubic-bezier(.2,.9,.3,1.1)}\
@keyframes asisIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}\
#rlAsisHead{padding:14px 16px !important;gap:12px !important;background:linear-gradient(135deg,#0a2463 0%,#1e40af 70%,#2563eb 100%) !important;position:relative}\
#rlAsisHead .av{width:42px !important;height:42px !important;border-radius:14px !important;background:rgba(255,255,255,.16) !important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2);position:relative;font-size:22px !important}\
#rlAsisHead .av:after{content:"";position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #1e40af}\
#rlAsisHead b{font-size:15px !important;letter-spacing:.2px}\
#rlAsisHead small{display:flex !important;align-items:center;gap:5px;font-size:11.5px !important}\
#rlAsisHead small:before{content:"";width:6px;height:6px;border-radius:50%;background:#4ade80;flex:none}\
#rlAsisHead button{width:32px;height:32px;border-radius:10px !important;padding:0 !important;display:flex;align-items:center;justify-content:center;font-size:14px !important;transition:background .15s}\
#rlAsisHead button:hover{background:rgba(255,255,255,.26) !important}\
#rlAsisHead #rlAsisMenu{margin-left:auto !important}#rlAsisHead #rlAsisClose{margin-left:6px !important}\
#rlAsisBody{padding:14px !important;gap:10px !important;background:#f6f8fc !important;background-image:radial-gradient(#e2e8f0 .8px,transparent .8px) !important;background-size:14px 14px !important;scroll-behavior:smooth}\
.rlm{padding:10px 13px !important;border-radius:16px !important;font-size:12.8px !important;animation:asisMsg .22s ease-out}\
@keyframes asisMsg{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}\
.rlm.bot{border-bottom-left-radius:5px !important;box-shadow:0 2px 8px rgba(15,23,42,.05)}\
.rlm.usr{background:linear-gradient(135deg,#1e40af,#2563eb) !important;border-bottom-right-radius:5px !important;box-shadow:0 4px 12px rgba(37,99,235,.25)}\
.rlm .asis-hora{display:block;font-size:10px;color:#94a3b8;margin-top:4px;white-space:nowrap}\
.rlm.usr .asis-hora{color:rgba(255,255,255,.72);text-align:right}\
.asis-pend{display:none !important}\
.asis-typing{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:16px;border-bottom-left-radius:5px;padding:10px 14px;display:flex;gap:4px;box-shadow:0 2px 8px rgba(15,23,42,.05)}\
.asis-typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:asisTp 1.1s infinite}\
.asis-typing i:nth-child(2){animation-delay:.18s}.asis-typing i:nth-child(3){animation-delay:.36s}\
@keyframes asisTp{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}\
.rlopts{gap:6px !important}\
.rlopts button{border-radius:999px !important;padding:7px 12px !important;font-weight:700 !important;border-color:#c7d2fe !important;box-shadow:0 1px 3px rgba(15,23,42,.05);transition:transform .12s,background .15s,color .15s}\
.rlopts button:hover{transform:translateY(-1px)}\
.rlopts button.sec{border-color:#e2e8f0 !important;color:#64748b !important;background:#f8fafc !important}\
.rlopts button.sec:hover{background:#475569 !important;color:#fff !important}\
.rlopts button.go{background:#16a34a !important;border-color:#16a34a !important;color:#fff !important}\
.rlopts.asis-grid{display:grid !important;grid-template-columns:1fr 1fr;gap:8px !important;width:100%;max-width:100% !important}\
.rlopts.asis-grid button{border-radius:12px !important;padding:10px 11px !important;background:#fff !important;border:1px solid #e2e8f0 !important;color:#0a2463 !important;text-align:left;display:flex;align-items:center;gap:8px;font-size:12px !important;box-shadow:0 2px 6px rgba(15,23,42,.04);line-height:1.25}\
.rlopts.asis-grid button:hover{border-color:#93c5fd !important;background:#eff6ff !important;transform:none}\
.rlopts.asis-grid button .asis-ic{width:28px;height:28px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:15px;flex:none}\
.rlopts.asis-grid button.go{grid-column:1/-1;background:linear-gradient(135deg,#16a34a,#15803d) !important;border:none !important;color:#fff !important}\
.rlopts.asis-grid button.go .asis-ic{background:rgba(255,255,255,.2)}\
.rlopts.asis-grid button.sec{color:#64748b !important;background:#f8fafc !important}\
#asisSug{display:flex;gap:6px;padding:8px 12px 0;overflow:auto;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none}\
#asisSug::-webkit-scrollbar{display:none}\
#asisSug button{flex:none;border:none;font:700 11px Barlow,"Segoe UI",system-ui,sans-serif;color:#475569;background:#f1f5f9;border-radius:999px;padding:5px 10px;cursor:pointer;white-space:nowrap}\
#asisSug button:hover{background:#dbeafe;color:#1e40af}\
#rlAsisFoot{border-top:none !important;padding:10px 12px 12px !important;gap:8px !important;align-items:center}\
#rlAsisFoot input{border:1.5px solid #e2e8f0 !important;border-radius:999px !important;padding:10px 14px !important;background:#f8fafc}\
#rlAsisFoot input:focus{border-color:#2563eb !important;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}\
#rlAsisFoot button{width:40px;height:40px;border-radius:50% !important;padding:0 !important;background:linear-gradient(135deg,#1e40af,#2563eb) !important;box-shadow:0 4px 12px rgba(37,99,235,.35);display:flex;align-items:center;justify-content:center;font-size:15px}\
#rlAsisBtn .asis-globo{position:absolute;right:64px;top:50%;transform:translateY(-50%);background:#0a2463;color:#fff;font:700 11.5px Barlow,"Segoe UI",system-ui,sans-serif;padding:7px 11px;border-radius:999px;white-space:nowrap;box-shadow:0 8px 20px rgba(2,6,23,.3);animation:asisGlobo .4s ease-out;pointer-events:none}\
#rlAsisBtn .asis-globo:after{content:"";position:absolute;right:-6px;top:50%;transform:translateY(-50%);border:6px solid transparent;border-left-color:#0a2463;border-right:0}\
@keyframes asisGlobo{from{opacity:0;transform:translate(8px,-50%)}to{opacity:1;transform:translate(0,-50%)}}\
@media(max-width:640px){#rlAsisPanel{left:0 !important;right:0 !important;bottom:0 !important;top:0 !important;width:100vw !important;height:100vh !important;max-height:100vh !important;border-radius:0 !important}#rlAsisBtn .asis-globo{display:none}}';
  try { var st = document.createElement('style'); st.id = 'asisUiCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  function hora() { var d = new Date(); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
  function marcarHora(m) { if (m.querySelector('.asis-hora')) return; var s = document.createElement('small'); s.className = 'asis-hora'; s.textContent = hora(); m.appendChild(s); }
  function esMenuModulos(w) {
    var bs = w.querySelectorAll('button'); if (bs.length < 5) return false;
    for (var i = 0; i < bs.length; i++) { var t = bs[i].textContent.trim(); if (/^(🏠|↩️|➡️)/.test(t)) return false; }
    return true;
  }
  function decorarOpts(w) {
    if (w._asisDec) return; w._asisDec = true;
    if (!esMenuModulos(w)) return;
    w.classList.add('asis-grid');
    w.querySelectorAll('button').forEach(function (b) {
      var t = b.textContent.trim(); var m = t.match(/^(\p{Extended_Pictographic}(?:️)?)\s*(.*)$/u);
      if (!m) return;
      b.textContent = ''; var ic = document.createElement('span'); ic.className = 'asis-ic'; ic.textContent = m[1]; b.appendChild(ic); b.appendChild(document.createTextNode(m[2]));
    });
  }
  var body = null, lote = [], relojLote = null, typing = null;
  function scrollAbajo() { try { body.scrollTop = body.scrollHeight; } catch (e) {} }
  function mostrarLote() {
    var nodos = lote; lote = []; relojLote = null;
    if (typing) { try { typing.remove(); } catch (e) {} typing = null; }
    nodos.forEach(function (n) { n.classList.remove('asis-pend'); });
    scrollAbajo();
  }
  function procesar(nodos) {
    var hayBot = false;
    nodos.forEach(function (n) {
      if (n.nodeType !== 1 || n.classList.contains('asis-typing')) return;
      if (n.classList.contains('rlm')) { marcarHora(n); if (n.classList.contains('bot')) hayBot = true; }
      if (n.classList.contains('rlopts')) decorarOpts(n);
    });
    if (!hayBot) { scrollAbajo(); return; }
    /* "escribiendo…": el bloque completo (burbujas + opciones) se muestra junto, medio segundo después */
    nodos.forEach(function (n) { if (n.nodeType === 1 && !n.classList.contains('asis-typing')) { n.classList.add('asis-pend'); lote.push(n); } });
    if (!typing) { typing = document.createElement('div'); typing.className = 'asis-typing'; typing.innerHTML = '<i></i><i></i><i></i>'; }
    body.appendChild(typing); scrollAbajo();
    clearTimeout(relojLote); relojLote = setTimeout(mostrarLote, TYPING_MS);
  }

  /* ── sugerencias rápidas según la pantalla actual ── */
  var SUG = {
    dashboard: ['¿Qué cambió en el menú?', 'Mis pendientes', '¿Qué es el índice de cumplimiento?'],
    atenciones: ['¿Cómo registro una atención?', '¿Dónde está Enviar reporte?', 'Guardé y no aparece'],
    trabajadores: ['¿Cómo busco a un trabajador?', '¿Dónde quedó Consulta por DNI?', 'No encuentro al trabajador'],
    visitas: ['¿Cómo registro una visita?', '¿Cada cuánto registro visitas?'],
    casos: ['¿Cómo cierro un caso?', '¿Cuáles son las etapas y plazos?', 'Me pide una justificación'],
    fusiones: ['¿Cómo registro una fusión?', 'No puedo entrar a Fusiones'],
    usuarios: ['¿Cómo asigno módulos a un usuario?', '¿Cómo van los usuarios?'],
    _: ['¿Qué cambió en el menú?', 'Mis pendientes', '¿Cómo reporto un problema?']
  };
  function seccion() { try { var s = document.querySelector('.sec.on'); return s ? s.id.replace('sec-', '') : '_'; } catch (e) { return '_'; } }
  function sugerencias() {
    var foot = $('rlAsisFoot'), p = $('rlAsisPanel'); if (!foot || !p) return;
    var bar = $('asisSug');
    if (!bar) { bar = document.createElement('div'); bar.id = 'asisSug'; p.insertBefore(bar, foot); }
    var lista = SUG[seccion()] || SUG._; var clave = lista.join('|');
    if (bar._clave === clave) return; bar._clave = clave;
    bar.innerHTML = '';
    lista.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      b.onclick = function () { try { var i = $('rlAsisInp'), s = $('rlAsisSend'); if (i && s) { i.value = t; s.click(); } } catch (e) {} };
      bar.appendChild(b);
    });
  }

  function cabecera() {
    var h = $('rlAsisHead'); if (!h || h._asisDec) return; h._asisDec = true;
    try { var sm = h.querySelector('small'); if (sm) sm.textContent = 'En línea · responde al instante'; } catch (e) {}
    try { var m = $('rlAsisMenu'); if (m) { m.textContent = '🏠'; m.title = 'Menú principal'; } var x = $('rlAsisClose'); if (x) { x.textContent = '✕'; x.title = 'Cerrar'; } } catch (e) {}
  }
  function globo() {
    try {
      var b = $('rlAsisBtn'); if (!b || b.querySelector('.asis-globo')) return;
      var u = ''; try { u = String((JSON.parse(sessionStorage.getItem('user') || '{}')).usuario || '').toLowerCase(); } catch (e) {}
      var k = 'rl_asis_globo_' + u; if (localStorage.getItem(k)) return;
      var g = document.createElement('span'); g.className = 'asis-globo'; g.textContent = '¿Dudas? Pregúntame 👋'; b.appendChild(g);
      localStorage.setItem(k, '1');
      setTimeout(function () { try { g.remove(); } catch (e) {} }, 10000);
      b.addEventListener('click', function () { try { g.remove(); } catch (e) {} }, { once: true });
    } catch (e) {}
  }

  function enganchar() {
    var p = $('rlAsisPanel'); if (!p || p._asisUi) return !!p;
    p._asisUi = true;
    body = $('rlAsisBody'); if (!body) return false;
    cabecera(); sugerencias();
    /* lo que ya estaba en el cuerpo (si el panel se abrió antes de este archivo) */
    try { var ya = Array.prototype.slice.call(body.children); if (ya.length) procesar(ya); } catch (e) {}
    try { new MutationObserver(function (ms) { var add = []; ms.forEach(function (m) { m.addedNodes && m.addedNodes.forEach(function (n) { add.push(n); }); }); if (add.length) procesar(add); }).observe(body, { childList: true }); } catch (e) {}
    /* las sugerencias siguen la pantalla en la que está el usuario */
    try { new MutationObserver(function () { sugerencias(); }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] }); } catch (e) {}
    return true;
  }
  function iniciar() {
    globo();
    /* el panel se crea la primera vez que se abre: se vigila el body hasta que exista */
    if (enganchar()) return;
    try { var mo = new MutationObserver(function () { if (enganchar()) mo.disconnect(); }); mo.observe(document.body, { childList: true }); } catch (e) {}
    var n = 0, t = setInterval(function () { if (enganchar() || ++n > 120) clearInterval(t); }, 1000);
    console.log('[_ASIS_UI_V1] listo');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 1500); }); else setTimeout(iniciar, 1500);
})();
