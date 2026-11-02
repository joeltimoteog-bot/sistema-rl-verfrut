/* ═══════════════════════════════════════════════════════════════════
   tema-corporativo.js — _TEMA_CORP_V1 (01-nov-2026) — Tema corporativo del Sistema RR.LL.
   SOLO presentacion: no cambia ninguna funcion, consulta, guardado ni permiso.
   · Paleta institucional (azul marino #0F2748, grises, rojo Unifrutti solo como acento).
   · Menu: emojis -> iconos de linea monocromos; nombres formales (Panel de gestion, Atenciones...).
   · Titulos, tarjetas, botones y chips sin emojis; estados con punto de color + texto.
   · Observa el DOM: lo que se pinta despues (modales, tablas, tarjetas) tambien queda limpio.
   INTERRUPTOR: TEMA_CORP = false (o localStorage 'rl_tema_corp' = 'off') -> no hace nada.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var TEMA_CORP = true;
  var off = false; try { off = localStorage.getItem('rl_tema_corp') === 'off'; } catch (e) {}
  if (!TEMA_CORP || off || window._TEMA_CORP_V1) return; window._TEMA_CORP_V1 = true;

  /* ── 1) CSS ── */
  var css = document.createElement('style'); css.id = 'temaCorpCss';
  css.textContent = '\
:root{--azul:#0F2748;--navy2:#163567;--rojo:#C8102E;--bg:#F4F6F9;--bd:#E2E8F0;--gr:#64748B;--tx:#1F2937}\
body.tc{background:#F4F6F9;color:#1F2937}\
body.tc .sb{background:#0F2748}\
body.tc .sb-ic{background:#fff;color:#C8102E;border-radius:8px}\
body.tc .sb-t{letter-spacing:.5px;font-weight:800}body.tc .sb-s{color:#9FB3D1;font-size:11px}\
body.tc .sb-usr{background:transparent}\
body.tc .ni{color:#D6E0EF;font-weight:500;border-radius:6px;font-size:13.5px!important;padding:8px 10px}\
body.tc .ni:hover{background:rgba(255,255,255,.07);color:#fff}\
body.tc .ni.on{background:rgba(255,255,255,.09);color:#fff;border-left:3px solid #C8102E;padding-left:7px}\
body.tc .ni .ic{background:transparent!important;width:22px;height:22px;border-radius:0;font-size:0!important;color:#C5D2E6;opacity:.9}\
body.tc .ni .ic svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}\
body.tc .ni.on .ic{color:#fff}\
body.tc .sb h6,body.tc .sb .sb-grp,body.tc .sb .grp{color:#7F93B4;letter-spacing:1.6px;font-size:10px}\
body.tc .topbar{background:#fff;border-bottom:1px solid #E2E8F0}\
body.tc .tb-t{color:#0F2748;letter-spacing:.6px;text-transform:uppercase;font-size:18px}\
body.tc .card,body.tc .gc{border:1px solid #E2E8F0;border-radius:8px;box-shadow:none}\
body.tc .card-t,body.tc .gc-t{color:#0F2748;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700}\
body.tc .cards .card{border-radius:8px}body.tc .cards .card .num{font-family:"Barlow Condensed",Barlow,sans-serif;color:#0F2748!important;font-weight:800}\
body.tc .cards .card{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:700}\
body.tc .sec-hd h2{font-family:"Barlow Condensed",Barlow,sans-serif;color:#0F2748;text-transform:uppercase;letter-spacing:.5px;font-weight:800}\
body.tc .btn-n{background:#0F2748;border-radius:6px;letter-spacing:.4px;font-size:11.5px;padding:8px 14px}\
body.tc .btn-n:hover{background:#163567}\
body.tc .btn-n[style*="background"]{background:#fff!important;color:#0F2748!important;border:1px solid #E2E8F0!important}\
body.tc .btn-a{border-radius:5px;font-weight:600}\
body.tc .btn-a.bv{background:#fff;color:#0F2748;border:1px solid #E2E8F0}body.tc .btn-a.be{background:#fff;color:#0F2748;border:1px solid #E2E8F0}\
body.tc .bg{border-radius:4px;font-size:10.5px;letter-spacing:.4px;text-transform:uppercase;background:#fff;color:#1F2937;border:1px solid #E2E8F0;padding:3px 8px;display:inline-flex;align-items:center;gap:6px}\
body.tc .bg::before{content:"";width:6px;height:6px;border-radius:50%;background:#94A3B8;flex:none}\
body.tc .bg.brap::before{background:#2E7D32}body.tc .bg.bver::before{background:#1D4ED8}body.tc .bg.bolm::before{background:#C2410C}body.tc .bg.bam::before{background:#6D28D9}\
body.tc .bg.bpr::before{background:#B45309}body.tc .bg.brs::before{background:#2E7D32}body.tc .bg.bp::before{background:#1D4ED8}\
body.tc .brap,body.tc .bver,body.tc .bolm,body.tc .bam,body.tc .bpr,body.tc .brs,body.tc .bp{background:#fff!important;color:#1F2937!important;border-color:#E2E8F0!important}\
body.tc .tbl th{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;background:#FAFBFC;border-bottom:2px solid #E2E8F0}\
body.tc .tbl td{font-size:12.5px;border-bottom:1px solid #EEF2F7}\
body.tc .tbl tr:hover td{background:#F8FAFC}\
body.tc .modal{border-radius:10px;border:1px solid #E2E8F0}body.tc .modal-t{color:#0F2748;text-transform:uppercase;letter-spacing:.5px}\
body.tc .ov{background:rgba(15,39,72,.55)}\
body.tc input,body.tc select,body.tc textarea{border-radius:6px}\
body.tc .alert-cumpl{background:#FFF8E6!important;border:1px solid #F5D08A!important;border-left:4px solid #B45309!important;border-radius:8px!important}\
body.tc .sede-chip{border-radius:3px;text-transform:uppercase;letter-spacing:.5px}\
body.tc .prec-head{background:#0F2748}\
body.tc .d2-lema{margin:8px 0 0;font-size:12.5px;color:#C5D2E6;letter-spacing:.2px}\
body.tc .d2-acc button,body.tc .d2-acc button.ghost{background:#fff!important;border:1px solid #fff!important;color:#0F2748!important;border-radius:6px;font-weight:700;opacity:1!important;cursor:pointer;letter-spacing:.2px;box-shadow:0 2px 6px rgba(0,0,0,.18)}\
body.tc .d2-acc button:hover{background:#EEF2F7!important}\
body.tc .d2-hola{letter-spacing:1.5px;color:#C5D2E6;font-size:11px}\
body.tc #d2Nom{letter-spacing:.3px}\
body.tc .d2-pill{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);border-radius:4px;text-transform:uppercase;letter-spacing:.6px;font-size:10px}\
body.tc .d2-kpi{border-radius:8px;border:1px solid #E2E8F0;box-shadow:none;border-top:3px solid #0F2748}\
body.tc .d2-kpi .ic{background:#F1F5F9!important;color:#0F2748!important;filter:grayscale(1);border-radius:8px}\
body.tc .d2-kpi .v,body.tc .d2-kpi b{color:#0F2748}\
body.tc .d2-kpi .bar,body.tc .d2-kpi .lin{background:#0F2748!important}\
body.tc .d2-card{border:1px solid #E2E8F0;border-radius:8px;box-shadow:none}\
body.tc .d2-card .t{font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#0F2748}\
body.tc .d2-live i{background:#2E7D32}\
body.tc .d2-feed .dot,body.tc #d2Feed .dot{background:#0F2748}\
body.tc .d2-ok,body.tc #d2Seg .ok{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px}\
body.tc .d2-ok .ic,body.tc #d2Seg .ok .ic{filter:grayscale(1)}\
body.tc .d2-stat .up{color:#2E7D32}body.tc .d2-stat .dn{color:#B91C1C}\
body.tc #d2Nom #wN,body.tc #wN{text-transform:none!important;letter-spacing:.2px;font-family:"Barlow Condensed",Barlow,sans-serif;font-size:30px}\
body.tc #d2Hero .d2-reloj .d{font-size:12px;opacity:.85}\
body.tc .tc-cumpl{background:#fff;border:1px solid #E2E8F0;border-left:4px solid #B45309;border-radius:8px;padding:12px 16px;margin-bottom:14px}\
body.tc .tc-cumpl h5{margin:0 0 8px;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#B45309}\
body.tc .tc-cumpl table{width:100%;border-collapse:collapse;font-size:12.5px}body.tc .tc-cumpl td{padding:6px 8px;border-bottom:1px solid #EEF2F7;vertical-align:top}\
body.tc .tc-cumpl td.k{white-space:normal;font-weight:700;color:#0F2748;width:300px;min-width:300px}body.tc .tc-cumpl td.v{padding-left:12px}body.tc .tc-cumpl .n{display:inline-block;width:280px;box-sizing:border-box;margin:3px 8px 3px 0;padding:4px 10px;border-radius:4px;background:#F8FAFC;border:1px solid #E2E8F0;font-weight:600;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:top}\
body.tc .tc-cumpl .n i{font-style:normal;color:#B91C1C;font-size:10.5px;margin-left:4px}\
body.tc .tc-foot{margin:26px 24px 18px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}\
body.tc #rlRepTab{background:#334155!important;opacity:.9!important;font-weight:700;letter-spacing:.5px}\
body.tc #e360Rec .chip,body.tc #e360Rec span[style*="border-radius:999px"]{display:inline-block;width:230px;box-sizing:border-box;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:4px!important}\
body.tc .ni .badge,body.tc .ni [id^="badge"]{background:#C8102E!important;animation:none!important;border-radius:999px;font-weight:800}';
  document.head.appendChild(css);

  /* ── 2) Iconos de linea (por emoji del menu) ── */
  var P = function (d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; };
  var ICON = {
    '📊': P('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
    '📋': P('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
    '👷': P('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>'),
    '🔍': P('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    '📑': P('<path d="M4 19V5a2 2 0 012-2h12v18H6a2 2 0 01-2-2z"/><path d="M8 7h8M8 11h8"/>'),
    '📈': P('<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
    '📧': P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    '🏕️': P('<path d="M3 21l9-18 9 18z"/><path d="M12 13v4"/>'), '🏕': P('<path d="M3 21l9-18 9 18z"/><path d="M12 13v4"/>'),
    '⚖️': P('<path d="M12 3v18M3 7h18M5 7l-2 6h6l-2-6M19 7l-2 6h6l-2-6"/>'), '⚖': P('<path d="M12 3v18M3 7h18M5 7l-2 6h6l-2-6M19 7l-2 6h6l-2-6"/>'),
    '🚌': P('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 18v2M17 18v2M3 12h18"/>'),
    '📚': P('<path d="M4 19V5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/>'),
    '🍽️': P('<path d="M7 3v18M4 3v5a3 3 0 006 0V3M17 3v18M17 3c-2 0-3 3-3 6s1 4 3 4"/>'), '🍽': P('<path d="M7 3v18M4 3v5a3 3 0 006 0V3M17 3v18"/>'),
    '📦': P('<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>'),
    '⏱️': P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'), '⏱': P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/>'),
    '🧮': P('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2"/>'),
    '🔄': P('<path d="M21 12a9 9 0 01-15.5 6.3M3 12a9 9 0 0115.5-6.3"/><path d="M21 4v5h-5M3 20v-5h5"/>'),
    '🔔': P('<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>'),
    '⚡': P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    '🛰️': P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'), '🛰': P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    '🎯': P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    '🔧': P('<path d="M14 7l3 3-8 8H6v-3z"/>'), '🧠': P('<path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 006 0V4zM15 4a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-6 0V4z"/>'),
    '🏠': P('<path d="M3 11l9-8 9 8v10H3z"/><path d="M9 21v-6h6v6"/>'), '👤': P('<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>'),
    '🚪': P('<path d="M9 21H4V3h5M16 17l5-5-5-5M21 12H9"/>'), '🛡️': P('<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/>'), '🛡': P('<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/>')
  };
  var GEN = P('<circle cx="12" cy="12" r="3"/>');

  /* ── 3) Nombres formales del menu (solo el texto visible) ── */
  var NOMBRES = { 'Mi Dashboard': 'Panel de gestión', 'Mis Atenciones': 'Atenciones', 'Buscar Trabajador': 'Trabajadores', 'Consulta por DNI': 'Consulta por DNI',
    'Consulta Masiva (Excel)': 'Consulta masiva', 'Resumen General': 'Resumen general', 'Enviar Reporte': 'Reportes por correo', 'Visitas de Campo': 'Visitas de campo',
    'Registro de Casos': 'Registro de casos', 'Control de Cumplimiento': 'Control de cumplimiento', 'Fusiones de Buses': 'Fusiones de buses', 'Cartas de Preaviso': 'Cartas de preaviso',
    'Programador de Almuerzos': 'Programación de almuerzos', 'Inventario Canastas': 'Inventario de canastas', 'Acumulación de Horas': 'Acumulación de horas', 'Cálculo Remunerativo': 'Cálculo remunerativo',
    'Estadísticas Admin': 'Estadísticas generales', 'Mis Estadísticas': 'Estadísticas', 'Evaluación 360°': 'Evaluación 360°', 'Alertas Sistema': 'Alertas del sistema', 'Monitor en Vivo': 'Monitor en vivo',
    'Actividad de Usuarios': 'Actividad de usuarios', 'KPIs RR.LL.': 'Indicadores KPI', 'Solicitud de Mantenimiento': 'Solicitudes de mantenimiento' };

  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu;
  function limpiar(el) {
    if (!el || el.dataset.tc === '1') return;
    Array.prototype.forEach.call(el.childNodes, function (n) {
      if (n.nodeType === 3 && EMOJI.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(EMOJI, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
    });
    el.dataset.tc = '1';
  }
  function menu() {
    Array.prototype.forEach.call(document.querySelectorAll('.ni'), function (b) {
      var ic = b.querySelector('.ic');
      if (ic && !ic.dataset.tc) { var e = (ic.textContent || '').trim(); ic.innerHTML = ICON[e] || ICON[e.replace(/️/g, '')] || GEN; ic.dataset.tc = '1'; }
      Array.prototype.forEach.call(b.childNodes, function (n) {
        if (n.nodeType !== 3) return; var t = n.nodeValue.replace(EMOJI, '').trim(); if (!t) return;
        var nuevo = NOMBRES[t] || t; if (n.nodeValue.trim() !== nuevo) n.nodeValue = nuevo;
      });
    });
  }
  var SEL = '.sec-hd h2, .gc-t, .card-t, .modal-t, .tb-t, .btn-n, .cards .card, .modal h2, .modal h3, .card-h h3, .alert-cumpl b, .topbar h1, #tituloPagina, .sec-hd .btn-n, .d2-pill, .d2-card .t, .d2-acc button, .d2-kpi small';
  function aplicar() {
    document.body.classList.add('tc');
    menu();
    Array.prototype.forEach.call(document.querySelectorAll(SEL), limpiar);
    /* _PIURA_OLMOS_V1: lema institucional en el banner de bienvenida del panel */
    var pills = document.getElementById('d2Pills');
    if (pills && !document.getElementById('d2Lema')) { var lm = document.createElement('div'); lm.id = 'd2Lema'; lm.className = 'd2-lema'; lm.textContent = 'Piura y Olmos, una sola Gestión Humana · mismos procesos, mismos estándares, un solo equipo'; pills.insertAdjacentElement('afterend', lm); }
    /* _PANEL_FORMAL_V1: nombre completo con formato de titulo, saludo con fecha larga, reloj unico, alerta en tabla, pie y soporte */
    try {
      var U0 = (typeof USER !== 'undefined' && USER) ? USER : {};
      var wN = document.getElementById('wN');
      if (wN && !wN.dataset.tc2 && U0.nombre) { wN.dataset.tc2 = '1'; wN.textContent = String(U0.nombre).toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
      var hola = document.getElementById('d2Hola'), rd = document.querySelector('#d2Hero .d2-reloj .d');
      if (hola && rd && !hola.dataset.tc2 && rd.textContent) { hola.dataset.tc2 = '1'; var sal = (hola.textContent.split('·')[1] || '').trim(); var f = new Date(); var DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre']; var sem = (rd.textContent.match(/Semana \d+/) || [''])[0]; hola.textContent = (sal ? sal + ' · ' : '') + DIAS[f.getDay()] + ' ' + f.getDate() + ' de ' + MES[f.getMonth()] + ' de ' + f.getFullYear() + (sem ? ' · ' + sem : ''); rd.textContent = sem || rd.textContent; }
      var rep = document.getElementById('rlRepTab'); if (rep && rep.textContent !== 'Soporte') rep.textContent = 'Soporte';
      var adm = /^(administrador|coordinador|jefa)/i.test(String(U0.rol || '')) || String(U0.usuario || '').toLowerCase() === 'jtimoteo';
      Array.prototype.forEach.call(document.querySelectorAll('.d2-card .t'), function (el) { var n = el.firstChild; if (n && n.nodeType === 3 && /Actividad reciente/i.test(n.nodeValue) && !adm) n.nodeValue = n.nodeValue.replace(/Actividad reciente/i, 'Mi actividad'); });
      var main = document.querySelector('.main'); if (main && !document.getElementById('tcFoot')) { var ft = document.createElement('div'); ft.id = 'tcFoot'; ft.className = 'tc-foot'; ft.innerHTML = '<span>Sistema de Relaciones Laborales · Unifrutti Perú · Piura y Olmos</span><span>Creado por Joel A. Timoteo Gonza · Coordinación de Relaciones Laborales · v3.0</span>'; main.appendChild(ft); }
      var ab = document.getElementById('alertCumplBanner'), at = document.getElementById('alertCumplTexto');
      if (ab && at && ab.style.display !== 'none' && at.textContent && at.dataset.tcTxt !== at.textContent) {
        at.dataset.tcTxt = at.textContent;
        var filas = []; at.innerHTML.split(/<br\s*\/?>/i).forEach(function (h) { var tx = h.replace(/<[^>]+>/g, '').replace(EMOJI, '').trim(); var m = tx.match(/^(.*?)\s*(?:\((\d+)\))?\s*:\s*(.+)$/); if (m && m[3] && !/^Cumplimiento pendiente/i.test(tx)) filas.push({ k: m[1].replace(/\s+/g, ' ').trim(), n: m[2] || '', v: m[3] }); });
        if (filas.length) {
          var old = document.getElementById('tcCumpl'); if (old) old.remove();
          var box = document.createElement('div'); box.id = 'tcCumpl'; box.className = 'tc-cumpl';
          box.innerHTML = '<h5>Pendientes de cumplimiento</h5><table>' + filas.map(function (f) { return '<tr><td class="k">' + f.k + (f.n ? ' <span style="color:#64748B;font-weight:600">(' + f.n + ')</span>' : '') + '</td><td class="v">' + f.v.split(/,\s*(?=[A-ZÁÉÍÓÚÑ])/).map(function (x) { var mm = x.match(/^(.*?)\s*\((.*?)\)\s*$/); var tt = function (q) { return String(q).toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }; return '<span class="n" title="' + (mm ? mm[1].trim() : x.trim()) + '">' + (mm ? tt(mm[1].trim()) + '<i>' + mm[2] + '</i>' : tt(x.trim())) + '</span>'; }).join('') + '</td></tr>'; }).join('') + '</table>';
          ab.insertAdjacentElement('afterend', box); ab.style.display = 'none';
        }
      }
    } catch (e) {}
    /* titulo del topbar: "MI DASHBOARD" -> "PANEL DE GESTION" */
    var t = document.querySelector('.tb-t'); if (t && /MI DASHBOARD/i.test(t.textContent)) t.textContent = 'Panel de gestión';
    /* textos formales del panel */
    Array.prototype.forEach.call(document.querySelectorAll('.d2-card .t'), function (el) { var n = el.firstChild; if (n && n.nodeType === 3) { var v = n.nodeValue.replace(/Seguimiento de tu gestión/i, 'Seguimiento de gestión'); if (v !== n.nodeValue) n.nodeValue = v; } });
    var sub = document.getElementById('wR'); if (sub && /Sistema RL v3\.0/.test(sub.textContent)) sub.textContent = sub.textContent.replace('Sistema RL v3.0', 'Sistema de Relaciones Laborales');
  }
  /* v1.1: la limpieza corre en el mismo instante en que algo se pinta (antes del repintado) -> sin pestañeo */
  var ocupado = false, obs = null;
  function alCambiar() {
    if (ocupado) return; ocupado = true;
    try { aplicar(); } catch (e) {}
    try { if (obs) obs.takeRecords(); } catch (e) {}   /* descarta las mutaciones que provoco la propia limpieza */
    ocupado = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
  try { obs = new MutationObserver(alCambiar); obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  console.log('[_TEMA_CORP_V1] tema corporativo activo (apagar: localStorage.rl_tema_corp = "off")');
})();
