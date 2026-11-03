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
  var B = 'body.cg1 ';
  var CSS = [
    '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");',
    B + ',' + B + 'button,' + B + 'input,' + B + 'select,' + B + 'textarea,' + B + 'table{font-family:' + F + '}',
    B + '{background:#EEF1F5;color:' + TX + ';animation:none}',
    B + 'h1,' + B + 'h2,' + B + 'h3,' + B + 'h4{font-family:' + F + ';color:' + AZ + ';letter-spacing:.2px}',
    /* ── Encabezados de página ── */
    B + '.topbar,' + B + '.top,' + B + 'header:not(.card-h):not(.modal-h){background:' + HDR + '!important;background-image:none!important;border-bottom:1px solid ' + BD + '!important;box-shadow:none!important;color:' + AZ + '}',
    B + '.topbar.rl-hdr-dark,' + B + '.top.rl-hdr-dark,' + B + 'header.rl-hdr-dark,' + B + '.rl-hdr-dark{background:' + AZ + '!important;background-image:none!important;box-shadow:none!important;border-bottom:0!important;color:#fff}',
    B + '.rl-hdr-light{background-image:none!important;box-shadow:none!important;border-bottom:1px solid ' + BD + '!important}',
    B + '.topbar .topbar-title,' + B + '.topbar h1,' + B + '.top h1,' + B + '.topbar-t,' + B + '#tbT,' + B + '#tituloPagina{font-family:' + F + '!important;font-size:15px!important;font-weight:700!important;letter-spacing:.3px!important}',
    B + '.topbar:not(.rl-hdr-dark) .topbar-title,' + B + '.topbar:not(.rl-hdr-dark) h1,' + B + '.top:not(.rl-hdr-dark) h1{color:' + AZ + '!important}',
    B + '.topbar .topbar-user,' + B + '.topbar-user,' + B + '.top .usr{font-family:' + F + ';font-size:12px;color:' + GR + '}',
    B + '.topbar .btn-back,' + B + '.btn-back{background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '!important;border-radius:6px!important;font-weight:600!important;box-shadow:none!important}',
    B + '.rl-hdr-dark .btn-back{background:rgba(255,255,255,.12)!important;color:#fff!important;border-color:rgba(255,255,255,.25)!important}',
    /* enlaces, usuario y mini-KPIs dentro de encabezados claros (antes eran blancos sobre azul) */
    B + '.topbar:not(.rl-hdr-dark) a,' + B + '.top:not(.rl-hdr-dark) a,' + B + 'header:not(.rl-hdr-dark) a{color:' + AZ + '!important;font-family:' + F + ';font-weight:600;font-size:12.5px;text-decoration:none;border:1px solid ' + BD + ';border-radius:6px;padding:7px 12px;background:#fff}',
    B + '.topbar:not(.rl-hdr-dark) a:hover,' + B + '.top:not(.rl-hdr-dark) a:hover{background:#F3F5F8;border-color:' + AZ + '}',
    B + '.topbar:not(.rl-hdr-dark) .u,' + B + '.topbar:not(.rl-hdr-dark) .usr,' + B + '.topbar:not(.rl-hdr-dark)>span,' + B + '.top:not(.rl-hdr-dark) .u,' + B + '.top:not(.rl-hdr-dark)>span{color:' + GR + '!important;font-family:' + F + ';font-size:12px;font-weight:500}',
    B + '.topbar:not(.rl-hdr-dark) .kpi,' + B + '.top:not(.rl-hdr-dark) .kpi,' + B + '.topbar:not(.rl-hdr-dark) .kpis>div,' + B + '.top:not(.rl-hdr-dark) .kpis>div{background:#fff!important;border:1px solid ' + BD + '!important;border-top:3px solid ' + BD + '!important;border-radius:6px!important;color:' + TX + '!important;box-shadow:none!important}',
    B + '.topbar:not(.rl-hdr-dark) .kpi b,' + B + '.top:not(.rl-hdr-dark) .kpi b,' + B + '.topbar:not(.rl-hdr-dark) .kpis>div b{color:' + AZ + '!important;font-family:' + F + '!important;font-weight:700!important}',
    B + '.topbar:not(.rl-hdr-dark) .kpi span,' + B + '.top:not(.rl-hdr-dark) .kpi span,' + B + '.topbar:not(.rl-hdr-dark) .kpis>div span{color:' + GR + '!important;font-size:10px!important;font-weight:600!important;letter-spacing:.4px!important;text-transform:uppercase}',
    B + '.topbar:not(.rl-hdr-dark) .kpi.rojo,' + B + '.top:not(.rl-hdr-dark) .kpi.rojo{border-top-color:' + ROJO + '!important}' + B + '.topbar:not(.rl-hdr-dark) .kpi.rojo b,' + B + '.top:not(.rl-hdr-dark) .kpi.rojo b{color:' + ROJO + '!important}',
    B + '.topbar:not(.rl-hdr-dark) .kpi.amar,' + B + '.top:not(.rl-hdr-dark) .kpi.amar{border-top-color:#9A4A00!important}' + B + '.topbar:not(.rl-hdr-dark) .kpi.amar b,' + B + '.top:not(.rl-hdr-dark) .kpi.amar b{color:#9A4A00!important}',
    B + '.topbar:not(.rl-hdr-dark) .kpi.verde b,' + B + '.top:not(.rl-hdr-dark) .kpi.verde b,' + B + '.topbar:not(.rl-hdr-dark) .kpi.ok b{color:#0F6B3A!important}',
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
  function iniciar() {
    try {
      var st = document.createElement('style'); st.id = 'temaCorpGlobalCss'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
      document.body.classList.add('cg1');
      console.log('[_TEMA_CORP_GLOBAL_V1] identidad empresarial activa en esta página (apagar: localStorage.rl_corp_global = "off")');
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
