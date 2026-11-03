/* ═════════════════════════════════════════════════════════════════════════
   _TEMA_CORP_GLOBAL_V1 (02-nov-2026) — Identidad empresarial ÚNICA para TODOS los módulos
   del Sistema RR.LL. (Panel, Casos, Cumplimiento, Mantenimiento, Horas, Capacitaciones,
   Inventario, Almuerzos, Preaviso, Evaluación 360, Usuarios, Estadísticas, KPIs, Resumen,
   Cerebro, Monitor, Actividad, Consulta masiva, Cálculo remunerativo, Informe gerencial…).
   SOLO PRESENTACIÓN: no cambia ningún id, flujo, consulta ni guardado.
   Reglas de la marca:
     · Tipografía Inter en todo (títulos, botones, campos, tablas).
     · Encabezados de página: blanco-gris #F3F5F8 con línea inferior; los oscuros en azul
       corporativo plano #0F2748 (sin degradados ni sombras).
     · Encabezados de tarjetas, formularios y modales: banda gris #EDF1F6 con título azul.
     · Cabeceras de tabla: gris #E6EBF2, texto #3D4C63 en mayúscula pequeña.
     · Botones: primario azul #0F2748; secundario blanco con borde; peligro rojo #B42318;
       radio 6 px, sin sombras ni "saltos" al pasar el cursor.
     · Campos 40 px, borde #D6DEE9, radio 6 px, foco azul; etiquetas en mayúscula pequeña.
     · Etiquetas de estado rectangulares (4 px). Modales con radio 8 px.
   INTERRUPTOR: localStorage.rl_corp_global = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._TEMA_CORP_GLOBAL_V1) return; window._TEMA_CORP_GLOBAL_V1 = true;
  try { if (localStorage.getItem('rl_corp_global') === 'off') { console.log('[_TEMA_CORP_GLOBAL_V1] apagado por localStorage.rl_corp_global'); return; } } catch (e) {}
  var F = 'Inter,"Segoe UI",Arial,sans-serif', AZ = '#0F2748', AZ2 = '#1C3A66', BD = '#D6DEE9', GR = '#5B6B82', TX = '#1F2A3C';
  var HDR = '#F3F5F8', BAND = '#EDF1F6', TH = '#E6EBF2', THTX = '#3D4C63', ROJO = '#B42318';
  var LBL = 'font-family:' + F + '!important;font-size:10.5px!important;font-weight:600!important;letter-spacing:.6px!important;text-transform:uppercase!important;color:' + GR + '!important';
  var B = 'body.cg1 ', H = 'html body.cg1 .cg-hdr';
  var CSS = [
    '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");',
    B + ',' + B + 'button,' + B + 'input,' + B + 'select,' + B + 'textarea,' + B + 'table{font-family:' + F + '}',
    B + '{background:#EEF1F5;color:' + TX + ';animation:none}',
    B + 'h1,' + B + 'h2,' + B + 'h3,' + B + 'h4{font-family:' + F + ';color:' + AZ + ';letter-spacing:.2px}',
    /* ── Encabezados de página: SIEMPRE claros, texto y botones siempre oscuros (clase .cg-hdr puesta por JS) ── */
    H + '{background:' + HDR + '!important;background-image:none!important;border-bottom:1px solid ' + BD + '!important;box-shadow:none!important;color:' + AZ + '!important;font-family:' + F + '}',
    H + ' h1,' + H + ' h2,' + H + ' .topbar-title,' + H + ' .topbar-t,' + H + ' #tbT,' + H + ' #tituloPagina,' + H + ' .brand b,' + H + ' .brand strong,' + H + ' .t,' + H + ' .ttl,' + H + ' .title{font-family:' + F + '!important;font-size:15px!important;font-weight:700!important;letter-spacing:.3px!important;color:' + AZ + '!important;text-shadow:none!important;opacity:1!important}',
    H + ' .brand,' + H + ' .logo,' + H + ' .brand *{color:' + AZ + '!important;opacity:1!important}',
    H + ' .brand small,' + H + ' .brand span,' + H + ' .sub,' + H + ' .u,' + H + ' .usr,' + H + ' .topbar-user,' + H + ' .user,' + H + ' small,' + H + ' .fecha,' + H + ' .hora,' + H + ' .top-s,' + H + ' .s{color:' + GR + '!important;font-family:' + F + '!important;font-weight:500!important;opacity:1!important}',
    H + ' .brand{background:#fff!important;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important}',
    H + ' img{filter:none!important;opacity:1!important}',
    /* enlaces y botones de la cabecera (Volver, Excel, acciones): blancos con borde, texto azul */
    H + ' a,' + H + ' button,' + H + ' .btn-back,' + H + ' .vol,' + H + ' .btn-volver,' + H + ' .bt,' + H + ' .btnGhost,' + H + ' .btn{background:#fff!important;background-image:none!important;color:' + AZ + '!important;border:1px solid #B9C4D3!important;border-radius:6px!important;padding:7px 12px!important;font-family:' + F + '!important;font-size:12.5px!important;font-weight:600!important;text-decoration:none!important;box-shadow:none!important;opacity:1!important;text-shadow:none!important;line-height:1.2!important;height:auto!important}',
    H + ' a:hover,' + H + ' button:hover{background:#E6EBF2!important;border-color:' + AZ + '!important;transform:none!important}',
    H + ' a.brand,' + H + ' a.logo{border:1px solid ' + BD + '!important;padding:6px 12px!important}',
    /* mini-KPIs dentro de la cabecera */
    H + ' .kpi,' + H + ' .kpis>div{background:#fff!important;border:1px solid ' + BD + '!important;border-top:3px solid ' + BD + '!important;border-radius:6px!important;color:' + TX + '!important;box-shadow:none!important}',
    H + ' .kpi b,' + H + ' .kpis>div b{color:' + AZ + '!important;font-family:' + F + '!important;font-weight:700!important}',
    H + ' .kpi span,' + H + ' .kpis>div span{color:' + GR + '!important;font-size:10px!important;font-weight:600!important;letter-spacing:.4px!important;text-transform:uppercase}',
    H + ' .kpi.rojo{border-top-color:' + ROJO + '!important}' + H + ' .kpi.rojo b{color:' + ROJO + '!important}',
    H + ' .kpi.amar,' + H + ' .kpi.ambar{border-top-color:#9A4A00!important}' + H + ' .kpi.amar b,' + H + ' .kpi.ambar b{color:#9A4A00!important}',
    H + ' .kpi.verde b,' + H + ' .kpi.ok b{color:#0F6B3A!important}',
    /* botón Volver agregado donde la página no lo tenía + títulos uniformes */
    H + ' .cg-volver{display:inline-flex!important;align-items:center;gap:6px;margin-right:12px;flex:none;white-space:nowrap}',
    H + ' h1,' + H + ' .topbar-title,' + H + ' .topbar-t{text-transform:uppercase!important;letter-spacing:.5px!important}',
    /* insignias / contadores de la cabecera (campana, empresa) se conservan con su color */
    H + ' .badge,' + H + ' .bdg,' + H + ' .bg,' + H + ' .pill{opacity:1!important}',
    /* ── Encabezados de sección / tarjeta / formulario ── */
    B + '.sec-hd h2,' + B + '.card-title,' + B + '.card-t,' + B + '.gc-t,' + B + '.tb-t,' + B + '.card h2,' + B + '.card h3,' + B + '.card-h h3,' + B + '.card-h .card-t,' + B + '.fic-t,' + B + '.d2-card .t{font-family:' + F + '!important;font-weight:700!important;color:' + AZ + '!important;letter-spacing:.2px}',
    B + '.card-h,' + B + '.fic-h,' + B + '.card>.card-title:first-child,' + B + '.card>h3:first-child{background:' + BAND + '!important;border-bottom:1px solid ' + BD + '!important;border-radius:8px 8px 0 0!important}',
    B + '.card>.card-title:first-child,' + B + '.card>h3:first-child{margin:-1px -1px 12px!important;padding:10px 16px!important;font-size:12.5px!important}',
    B + '.card-h{padding:10px 16px!important}',
    /* ── Tarjetas / KPIs ── */
    B + '.card,' + B + '.kpi,' + B + '.stat,' + B + '.kpi-card,' + B + '.stat-card,' + B + '.box,' + B + '.ficha,' + B + '.fic-card,' + B + '.gc,' + B + '.d2-card{background:#fff;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;transition:none!important}',
    B + '.kpi,' + B + '.stat,' + B + '.kpi-card,' + B + '.stat-card,' + B + '.sc{border-top:3px solid ' + BD + '!important}',
    B + '.kpi:hover,' + B + '.stat:hover,' + B + '.kpi-card:hover,' + B + '.stat-card:hover,' + B + '.card:hover,' + B + '.sc:hover{transform:none!important;box-shadow:none!important}',
    B + '.kpi-value,' + B + '.stat-val,' + B + '.kpi .v,' + B + '.kpi b,' + B + '.kpi-num,' + B + '.stat-num,' + B + '.kpi .n,' + B + '.card .num{font-family:' + F + '!important;font-weight:700!important;letter-spacing:-.5px!important;font-variant-numeric:tabular-nums}',
    B + '.kpi-label,' + B + '.stat-label,' + B + '.kpi .l,' + B + '.kpi small,' + B + '.stat-sub{' + LBL + '}',
    /* ── Tablas ── */
    B + 'table thead th,' + B + 'table tr:first-child th,' + B + '.tbl th,' + B + '.tbl thead th{background:' + TH + '!important;color:' + THTX + '!important;' + LBL + ';border-bottom:1px solid ' + BD + '!important;padding:9px 10px!important}',
    B + 'table td,' + B + '.tbl td{font-size:12.5px;color:' + TX + ';border-bottom:1px solid #EEF1F5!important}',
    B + 'table tbody tr:nth-child(even) td{background:#FAFBFD!important}',
    B + 'table tbody tr:hover td{background:#F1F4F8!important}',
    B + '.tbl-wrap,' + B + '.fic-tablewrap,' + B + '.cTablaWrap{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important}',
    /* ── Campos y etiquetas ── */
    B + 'label,' + B + '.lbl,' + B + '.fi label,' + B + '.fc label,' + B + '.field label,' + B + '.cp-lbl{' + LBL + '}',
    B + 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),' + B + 'select,' + B + 'textarea{font-family:' + F + '!important;border:1px solid ' + BD + '!important;border-radius:6px!important;background:#fff!important;color:' + TX + '!important;font-size:13px!important;min-height:38px;box-shadow:none!important}',
    B + 'textarea{min-height:80px}',
    B + 'input:not([type=checkbox]):not([type=radio]):focus,' + B + 'select:focus,' + B + 'textarea:focus{outline:none!important;border-color:' + AZ + '!important;box-shadow:0 0 0 3px rgba(15,39,72,.10)!important}',
    B + 'input::placeholder,' + B + 'textarea::placeholder{color:#94A3B8}',
    B + 'input:disabled,' + B + 'select:disabled,' + B + 'textarea:disabled{background:#F3F5F8!important;color:' + GR + '!important}',
    /* ── Botones ── */
    B + 'button,' + B + '.btn,' + B + '[class^="btn-"],' + B + '[class*=" btn-"],' + B + '.btnGhost{font-family:' + F + '!important;border-radius:6px!important;font-weight:600!important;font-size:12.5px!important;letter-spacing:.2px;box-shadow:none!important;transition:background .12s,border-color .12s!important;background-image:none!important}',
    B + 'button:hover,' + B + '.btn:hover,' + B + '[class^="btn-"]:hover,' + B + '[class*=" btn-"]:hover{transform:none!important;filter:none!important}',
    /* primario */
    B + '.btn-primary,' + B + '.btn-pri,' + B + '.btn-blue,' + B + '.btn-az,' + B + '.btn-save,' + B + '.btn-n,' + B + '.btn.bp,' + B + '.btn-green,' + B + '.btn.verde,' + B + '.btn-ok,' + B + '.btn.primary,' + B + 'button[type=submit],' + B + '.cumpl-btn,' + B + '.fic-b{background:' + AZ + '!important;color:#fff!important;border:1px solid ' + AZ + '!important}',
    B + '.btn-primary:hover,' + B + '.btn-blue:hover,' + B + '.btn-save:hover,' + B + '.btn-n:hover,' + B + '.btn.bp:hover,' + B + 'button[type=submit]:hover{background:' + AZ2 + '!important;border-color:' + AZ2 + '!important}',
    /* secundario */
    B + '.btn-a,' + B + '.btn-sec,' + B + '.btn-secondary,' + B + '.btn-cancel,' + B + '.btn-gris,' + B + '.btn.gris,' + B + '.btn-ghost,' + B + '.btnGhost,' + B + '.btn.sec,' + B + '.btn-back,' + B + '.btn-out,' + B + '.cumpl-btn.gris{background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '!important}',
    B + '.btn-a:hover,' + B + '.btn-cancel:hover,' + B + '.btnGhost:hover,' + B + '.btn-sec:hover{background:#F3F5F8!important;border-color:' + AZ + '!important}',
    /* peligro */
    B + '.btn-danger,' + B + '.btn-del,' + B + '.btn-rojo,' + B + '.btn.rojo,' + B + '.btn-red,' + B + '.btn.danger,' + B + '.cumpl-btn.rojo{background:' + ROJO + '!important;color:#fff!important;border:1px solid ' + ROJO + '!important}',
    /* pestañas */
    B + '.tabs{gap:0!important;border-bottom:1px solid ' + BD + ';background:transparent!important;padding:0!important;border-radius:0!important}',
    B + '.tab-btn,' + B + '.tabs button,' + B + '.tabs .tab{font-family:' + F + '!important;background:transparent!important;border:none!important;border-bottom:2px solid transparent!important;border-radius:0!important;color:' + GR + '!important;font-weight:600!important;font-size:12.5px!important;padding:9px 14px!important;margin-bottom:-1px;box-shadow:none!important}',
    B + '.tab-btn:hover,' + B + '.tabs button:hover{color:' + AZ + '!important}',
    B + '.tab-btn.on,' + B + '.tab-btn.active,' + B + '.tabs button.on,' + B + '.tabs button.active,' + B + '.tabs .tab.on,' + B + '.tabs .tab.active{color:' + AZ + '!important;border-bottom-color:' + AZ + '!important;background:transparent!important}',
    /* chips de filtro */
    B + '.chip,' + B + '.cp-chip,' + B + '.chips button,' + B + '.filt button,' + B + '.fil button{font-family:' + F + '!important;border-radius:6px!important;border:1px solid ' + BD + '!important;background:#fff!important;color:' + TX + '!important;font-weight:500!important;box-shadow:none!important}',
    B + '.chip.on,' + B + '.chip.active,' + B + '.cp-chip.on,' + B + '.chips button.on,' + B + '.filt button.on{background:' + AZ + '!important;border-color:' + AZ + '!important;color:#fff!important}',
    /* etiquetas de estado */
    B + '.bdg,' + B + '.badge,' + B + '.bg,' + B + '.tag,' + B + '.estado,' + B + '.pill{border-radius:4px!important;font-family:' + F + '!important;font-weight:600!important;font-size:10.5px!important;letter-spacing:.3px!important;text-transform:uppercase}',
    /* filtros */
    B + '.filtros,' + B + '.filt,' + B + '.fil,' + B + '.fila{background:#fff;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important}',
    /* ── Modales / formularios emergentes ── */
    B + '.ov,' + B + '.overlay,' + B + '.modal-overlay,' + B + '.fic-ov{background:rgba(15,39,72,.55)!important;backdrop-filter:blur(2px)}',
    B + '.ov .modal,' + B + '.overlay .modal,' + B + '.modal .box,' + B + '.modal-content,' + B + '.modal-box,' + B + '.modal-lista,' + B + '.fic-card,' + B + '.mdl,' + B + '.ms-box{background:#fff!important;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:0 20px 50px rgba(15,39,72,.25)!important;font-family:' + F + '}',
    B + '.modal-t,' + B + '.modal-title,' + B + '.modal h2,' + B + '.modal h3,' + B + '.modal-box h2,' + B + '.modal-box h3,' + B + '.modal-h,' + B + '.fic-h,' + B + '.cumpl-mod .hd,' + B + '.ms-hd{background:' + BAND + '!important;background-image:none!important;color:' + AZ + '!important;border-bottom:1px solid ' + BD + '!important;font-family:' + F + '!important;font-size:14px!important;font-weight:700!important;letter-spacing:.2px;border-radius:8px 8px 0 0!important}',
    B + '.modal-ft,' + B + '.modal-actions,' + B + '.modal-foot,' + B + '.ms-ft{background:#F8FAFC!important;border-top:1px solid ' + BD + '!important;border-radius:0 0 8px 8px!important}',
    B + '.fic-x,' + B + '.modal .close,' + B + '.modal-close,' + B + '.ms-x{color:' + GR + '!important;background:transparent!important;border:none!important}',
    /* ── Avisos ── */
    B + '.alert,' + B + '.aviso,' + B + '.msg,' + B + '.alert-cumpl{border-radius:6px!important;border:1px solid ' + BD + '!important;font-family:' + F + '}',
    /* ── Menú lateral ── */
    B + '.sb,' + B + 'aside.sb,' + B + '.sidebar{background:' + AZ + '!important;background-image:none!important}',
    B + '.ni{font-family:' + F + '!important;font-size:13px!important;border-radius:6px!important;color:#DCE4F0}' + B + '.ni.on{background:rgba(255,255,255,.14)!important;color:#fff!important;font-weight:600}',
    /* ── Pie / scroll ── */
    B + '::-webkit-scrollbar-thumb{background:#C5CFDD;border-radius:4px}',
    '@media print{' + B + '*{box-shadow:none!important}}'
  ].join('\n');
  /* cabecera clara u oscura según el color REAL que pinta la página (no según el nombre de la clase) */
  function lum(c) { var m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (!m) return 1; if (m[4] !== undefined && +m[4] === 0) return 1; return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; }
  function clasificar() {
    try {
      document.querySelectorAll('.topbar, .top, header, .hdr, .barra').forEach(function (h) {
        if (h.closest('.card') && !h.classList.contains('top')) return;
        if (h.closest('.modal, .ov, .sb, aside')) return;
        h.classList.remove('cg-dark'); h.classList.add('cg-hdr');
      });
    } catch (e) {}
  }
  /* botón o enlace con texto claro sobre fondo transparente (su color venía de un degradado): se le da fondo blanco y borde */
  function reparar() {
    try {
      document.querySelectorAll('button, a.btn, a[class*="btn"], .btn').forEach(function (b) {
        if (b.classList.contains('cg-fix') || b.closest('.sb') || b.closest('.ni') || b.closest('.cg-hdr')) return;
        var cs = getComputedStyle(b); if (cs.display === 'none') return;
        var bg = cs.backgroundColor, col = cs.color;
        var bgc = rgbDe(bg); if (bgc && bgc[3] >= 0.5 && lum(bg) >= 0.98 && lum(col) >= 0.85 && (cs.backgroundImage === 'none' || !cs.backgroundImage) && !b.closest('[style*="gradient"]')) b.classList.add('cg-fix');
      });
    } catch (e) {}
  }
  /* ── Corrector automático de contraste ──
     Mide cada texto visible contra el fondo REAL que tiene detrás. Si no se lee (contraste < 3:1):
       · texto claro sobre fondo claro → se oscurece conservando su tono (verde sigue verde, rojo sigue rojo);
         si era blanco/gris neutro pasa al azul corporativo.
       · texto oscuro sobre fondo oscuro → se aclara.
     Se aplica con estilo en línea !important (gana a cualquier CSS de la página) y se revisa también lo que
     se pinta después (tablas, modales, avisos) mediante MutationObserver. No toca el menú lateral. */
  function rgbDe(c) { var m = String(c || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; }
  function lumRel(c) { var a = c.slice(0, 3).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
  function contr(a, b) { var l1 = lumRel(a), l2 = lumRel(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
  function grad(bi) { var m = String(bi).match(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi); if (!m) return null; var cs = m.map(function (x) { if (x[0] === '#') { var n = parseInt(x.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; } return rgbDe(x); }).filter(function (c) { return c && c[3] > .35; }); if (!cs.length) return null; var r = [0, 0, 0]; cs.forEach(function (c) { r[0] += c[0]; r[1] += c[1]; r[2] += c[2]; }); return [Math.round(r[0] / cs.length), Math.round(r[1] / cs.length), Math.round(r[2] / cs.length), 1]; }
  function fondo(el) { while (el && el !== document.documentElement) { var cs = getComputedStyle(el), c = rgbDe(cs.backgroundColor); if (c && c[3] > .35) return c; if (cs.backgroundImage && cs.backgroundImage !== 'none') { if (/url\(/.test(cs.backgroundImage)) return null; var g = grad(cs.backgroundImage); if (g) return g; } el = el.parentElement; } var b = rgbDe(getComputedStyle(document.body).backgroundColor); return b && b[3] > .35 ? b : [238, 241, 245, 1]; }
  function hsl(c) { var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function ajustar(el) {
    try {
      if (el.nodeType !== 1 || el.closest('.sb,aside,.ni,script,style,svg,canvas')) return;
      var t = ''; for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].nodeValue; if (!t.trim()) return;
      var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var col = rgbDe(cs.color), bg = fondo(el); if (!col || !bg) return;
      if (contr(col, bg) >= 3) return;
      var oscuroFondo = lumRel(bg) < .35, hh = hsl(col), nuevo;
      if (!oscuroFondo) nuevo = hh[1] > .25 ? 'hsl(' + Math.round(hh[0]) + ',' + Math.round(Math.min(hh[1], .75) * 100) + '%,28%)' : AZ;
      else nuevo = hh[1] > .25 ? 'hsl(' + Math.round(hh[0]) + ',' + Math.round(Math.min(hh[1], .8) * 100) + '%,78%)' : '#E6EBF2';
      el.style.setProperty('color', nuevo, 'important'); el.setAttribute('data-cg-c', '1');
    } catch (e) {}
  }
  function contraste(raiz) { try { var r = raiz || document.body; if (!r || !r.querySelectorAll) return; if (r.nodeType === 1) ajustar(r); var l = r.querySelectorAll('*'); for (var i = 0; i < l.length && i < 6000; i++) ajustar(l[i]); } catch (e) {} }
  var pend = [], tmr = null;
  function vigilar() {
    try {
      new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes && m.addedNodes.forEach(function (n) { if (n.nodeType === 1) pend.push(n); }); if (m.type === 'attributes' && m.target.nodeType === 1 && !m.target.hasAttribute('data-cg-c')) pend.push(m.target); }); if (!tmr) tmr = setTimeout(function () { var l = pend.splice(0, 400); tmr = null; l.forEach(function (n) { if (n.isConnected) contraste(n); }); }, 350); })
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    } catch (e) {}
  }
  /* ── Navegación: volver siempre visible y al mismo punto de partida ── */
  var PAG = (location.pathname.split('/').pop() || '').toLowerCase(), EN_PANEL = PAG === 'dashboard.html';
  var EMO = /^[\s←-⇿⌀-➿⬀-⯿\u{1F000}-\u{1FAFF}️‍]+/u;
  function sinEmoji(el) { try { for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3) { if (!n.nodeValue.trim()) continue; n.nodeValue = n.nodeValue.replace(EMO, ''); return; } if (n.nodeType === 1 && !n.matches('img,svg,input,select,b,strong')) { if (EMO.test(n.textContent) && n.textContent.replace(EMO, '').trim() === '') { n.style.display = 'none'; continue; } return; } } } catch (e) {} }
  function ordenarTitulos() {
    try {
      document.querySelectorAll('.cg-hdr h1, .cg-hdr .topbar-title, .cg-hdr .topbar-t, .tabs .tab-btn, .tabs > button, .sec-hd h2').forEach(sinEmoji);
    } catch (e) {}
  }
  function esVolver(el) { var t = (el.textContent || '').trim(), h = (el.getAttribute('href') || '') + ' ' + (el.getAttribute('onclick') || ''); return /volver|dashboard|ir al panel/i.test(t) || /dashboard\.html|mostrarDashboard/.test(h); }
  function ponerVolver() {
    if (EN_PANEL || /index\.html|diagnostico\.html/.test(PAG) || !PAG) return;
    try {
      var h = document.querySelector('.cg-hdr'); if (!h || h.querySelector('.cg-volver')) return;
      var hay = Array.prototype.some.call(h.querySelectorAll('a,button'), function (b) { return esVolver(b) && b.getBoundingClientRect().width > 0; });
      if (hay) return;
      var a = document.createElement('a'); a.className = 'cg-volver'; a.href = 'dashboard.html'; a.textContent = '← Volver al panel';
      h.insertBefore(a, h.firstChild);
    } catch (e) {}
  }
  /* al pulsar cualquier "volver" hacia el Panel, se recuerda la sección de donde vino el usuario */
  function marcarRegreso() {
    if (EN_PANEL) return;
    document.addEventListener('click', function (e) {
      try { var b = e.target.closest && e.target.closest('a,button'); if (!b) return; var h = (b.getAttribute('href') || '') + ' ' + (b.getAttribute('onclick') || ''); if (/dashboard\.html/.test(h)) { var u = sessionStorage.getItem('rl_ult_sec'); if (u) sessionStorage.setItem('rl_volver_sec', u); } } catch (er) {}
    }, true);
  }
  /* en el Panel: se guarda la sección abierta y, al regresar, se reabre la misma con su desplazamiento */
  function panelRecordar() {
    if (!EN_PANEL) return;
    function envolver() { try { var orig = window.ir; if (typeof orig !== 'function' || orig._cgVolver) return; var w = function (id) { try { if (id) { sessionStorage.setItem('rl_ult_sec', id); sessionStorage.setItem('rl_ult_scroll', '0'); } } catch (e) {} return orig.apply(this, arguments); }; w._cgVolver = true; window.ir = w; } catch (e) {} }
    setTimeout(envolver, 800); setTimeout(envolver, 2500);
    window.addEventListener('pagehide', function () { try { sessionStorage.setItem('rl_ult_scroll', String(window.scrollY || document.documentElement.scrollTop || 0)); } catch (e) {} });
    var sec = null; try { sec = sessionStorage.getItem('rl_volver_sec'); sessionStorage.removeItem('rl_volver_sec'); } catch (e) {}
    if (!sec || sec === 'dashboard') return;
    var y = +(sessionStorage.getItem('rl_ult_scroll') || 0), n = 0;
    var t = setInterval(function () {
      try {
        var btn = document.querySelector('.ni[onclick*="ir(\'' + sec + '\'"]');
        if ((btn && btn.offsetParent !== null) || ++n > 25) {
          clearInterval(t);
          if (btn && btn.offsetParent !== null) btn.click(); else if (typeof window.ir === 'function') window.ir(sec);
          if (y > 0) setTimeout(function () { try { window.scrollTo(0, y); } catch (e) {} }, 700);
        }
      } catch (e) { clearInterval(t); }
    }, 200);
  }
  function iniciar() {
    try {
      var st = document.createElement('style'); st.id = 'temaCorpGlobalCss'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
      document.body.classList.add('cg1');
      clasificar(); setTimeout(clasificar, 1200); setTimeout(reparar, 300); setTimeout(reparar, 1500); setTimeout(reparar, 4000);
      setTimeout(function () { contraste(); vigilar(); }, 900); setTimeout(function () { contraste(); }, 3500);
      marcarRegreso(); panelRecordar(); setTimeout(function () { ponerVolver(); ordenarTitulos(); }, 1300); setTimeout(function () { ponerVolver(); ordenarTitulos(); }, 4000);
      console.log('[_TEMA_CORP_GLOBAL_V1] identidad empresarial activa en esta página (apagar: localStorage.rl_corp_global = "off")');
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
