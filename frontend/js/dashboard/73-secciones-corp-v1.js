/* ═════════════════════════════════════════════════════════════════════════
   _SECC_CORP_V1 (02-nov-2026) — Tema empresarial para las secciones que tenían su propio
   estilo y no tomaban el de _PANEL_CORP_V2:
   · Registro de casos (#sec-casos): filtros, buscador, chips, periodos, KPIs y tabla.
   · Control de cumplimiento (#sec-cumplimiento, .cumpl-*): pestañas, tarjetas, KPIs, tablas.
   · Panel: comparativa mes actual vs anterior (#dashComparativa) y barra de filtro.
   Solo CSS sobre elementos existentes: ningún id, dato ni función cambia.
   Lenguaje: Inter, azul #0F2748, fondo #EEF1F5, tarjetas blancas borde #D6DEE9, radios 6-8 px,
   cabeceras de tabla gris claro en mayúscula pequeña, chips rectangulares, estados verde/ámbar/rojo.
   INTERRUPTOR: localStorage.rl_secc_corp = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._SECC_CORP_V1) return; window._SECC_CORP_V1 = true;
  try { if (localStorage.getItem('rl_secc_corp') === 'off') { console.log('[_SECC_CORP_V1] apagado por localStorage.rl_secc_corp'); return; } } catch (e) {}
  var F = 'Inter,"Segoe UI",Arial,sans-serif', AZ = '#0F2748', BD = '#D6DEE9', GR = '#5B6B82', BG = '#E6EBF2';
  var LBL = 'font-family:' + F + ';font-size:10.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:' + GR;
  var CSS = [
    /* ─────────── REGISTRO DE CASOS ─────────── */
    'body.sc1 #sec-casos{font-family:' + F + '}',
    'body.sc1 #sec-casos .sec-hd h2{font-family:' + F + ';font-size:17px;font-weight:700;color:' + AZ + ';letter-spacing:.2px}',
    'body.sc1 #sec-casos .sec-hd .btn-n{font-family:' + F + ';border-radius:6px;font-size:12px;font-weight:600;padding:8px 14px;box-shadow:none}',
    'body.sc1 #sec-casos .sec-hd .btn-n[onclick^="abrir"]{background:' + AZ + '!important;color:#fff}',
    'body.sc1 #sec-casos .sec-hd .btn-n:not([onclick^="abrir"]){background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '}',
    /* filtros */
    'body.sc1 #sec-casos .filtros{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;background:#fff}',
    'body.sc1 #sec-casos .filtros select,body.sc1 #sec-casos .filtros input,body.sc1 #sec-casos .filtros>#cBuscarWrap #cBuscar{font-family:' + F + '!important;height:38px;border:1px solid ' + BD + '!important;border-radius:6px!important;background:#fff!important;font-size:12.5px!important;color:#1F2A3C}',
    'body.sc1 #sec-casos .filtros select:focus,body.sc1 #sec-casos .filtros input:focus{border-color:' + AZ + '!important;box-shadow:0 0 0 3px rgba(15,39,72,.10)}',
    'body.sc1 #sec-casos .filtros+div{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;background:#fff}',
    'body.sc1 #sec-casos .filtros+div #cChipMotivo{font-family:' + F + '!important;border:1px solid ' + BD + '!important;border-radius:6px!important;font-weight:500!important;color:#1F2A3C}',
    /* chips de estado: rectangulares, borde fino */
    'body.sc1 #sec-casos #cChips button,body.sc1 #sec-casos #cChips>span[onclick],body.sc1 #sec-casos #cChips>div[onclick]{font-family:' + F + '!important;border-radius:6px!important;border:1px solid ' + BD + '!important;background:#fff!important;color:#1F2A3C!important;font-weight:500!important;box-shadow:none!important}',
    'body.sc1 #sec-casos #cChips button[style*="background: rgb(11, 30, 69)"],body.sc1 #sec-casos #cChips button.on,body.sc1 #sec-casos #cChips button[style*="#0b1e45"]{background:' + AZ + '!important;color:#fff!important;border-color:' + AZ + '!important}',
    'body.sc1 #cAccionesFiltro button{font-family:' + F + '!important;border-radius:6px!important;border:1px solid ' + BD + '!important;background:#fff!important;color:' + AZ + '!important;font-weight:600!important;box-shadow:none!important}',
    'body.sc1 #cBtnVerTodos{font-family:' + F + '!important;border-radius:6px!important;background:' + AZ + '!important;border-color:' + AZ + '!important}',
    /* periodos */
    'body.sc1 #cPeriodos{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;font-family:' + F + '}',
    'body.sc1 #cPeriodos .cp-t{' + LBL + ';color:' + AZ + '}',
    'body.sc1 #cPeriodos #cpAnioSel{font-family:' + F + ';border:1px solid ' + BD + ';border-radius:6px;background:#fff;font-weight:500;color:#1F2A3C}',
    'body.sc1 .cp-chip{font-family:' + F + ';border-radius:6px;border:1px solid ' + BD + ';background:#fff;font-weight:500;color:#1F2A3C}',
    'body.sc1 .cp-chip b{background:' + BG + ';color:' + AZ + ';border:1px solid ' + BD + ';border-radius:4px;font-weight:600}',
    'body.sc1 .cp-chip.on{background:' + AZ + ';border-color:' + AZ + ';color:#fff}body.sc1 .cp-chip.on b{background:#fff;color:' + AZ + ';border-color:#fff}',
    'body.sc1 #cPeriodos #cpMeses .cp-chip{border-radius:6px;font-weight:500}body.sc1 #cPeriodos #cpMeses .cp-chip.on{background:#E8EEF7;border-color:#B9C8DE;color:' + AZ + '}body.sc1 #cPeriodos #cpMeses .cp-chip.on b{color:' + AZ + '}',
    'body.sc1 #cPeriodos #cpInfo2,body.sc1 #cPeriodos #cpInfo{font-family:' + F + ';color:' + GR + '}',
    /* KPIs: tarjetas blancas, borde fino, sin barra lateral de color; cifra en Inter */
    'body.sc1 #statsCasos .cards .card{font-family:' + F + '!important;border:1px solid ' + BD + '!important;border-left:1px solid ' + BD + '!important;border-top:3px solid ' + BD + '!important;border-radius:8px!important;padding:12px 16px!important;background:#fff!important;box-shadow:none!important}',
    'body.sc1 #statsCasos .cards .card>div:last-child:not(.num){' + LBL + '}',
    'body.sc1 #statsCasos .cards .card .num{font-family:' + F + '!important;font-size:26px!important;font-weight:700!important;letter-spacing:-.5px;color:' + AZ + '!important}',
    'body.sc1 #statsCasos .cards .card:has(#cEnPlazo){border-top-color:#0F6B3A!important}body.sc1 #statsCasos .cards .card:has(#cEnPlazo) .num{color:#0F6B3A!important}',
    'body.sc1 #statsCasos .cards .card:has(#cRetrasado){border-top-color:#B42318!important}body.sc1 #statsCasos .cards .card:has(#cRetrasado) .num{color:#B42318!important}',
    'body.sc1 #statsCasos .cards .card:has(#cEstaSemana){border-top-color:#9A4A00!important}body.sc1 #statsCasos .cards .card:has(#cEstaSemana) .num{color:#9A4A00!important}',
    /* tabla */
    'body.sc1 #sec-casos .cTablaWrap,body.sc1 #sec-casos .tbl{font-family:' + F + '}',
    'body.sc1 #sec-casos .cTablaWrap{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important}',
    'body.sc1 #sec-casos .cTablaWrap thead th,body.sc1 #sec-casos .tbl thead th{background:' + BG + '!important;color:#3D4C63!important;' + LBL + ';border-bottom:1px solid ' + BD + '!important}',
    'body.sc1 #sec-casos .tbl td{font-size:12.5px;color:#1F2A3C;border-bottom:1px solid #EEF1F5}',
    'body.sc1 #sec-casos .tbl tbody tr:hover td{background:#F6F8FB}',
    /* etiquetas de estado dentro de la tabla: rectangulares */
    'body.sc1 #tbCasos span[style*="border-radius"],body.sc1 #tbCasos .bg,body.sc1 #tbCasos .tag,body.sc1 #tbCasos .badge{border-radius:4px!important;font-family:' + F + '!important;font-weight:600!important;font-size:10.5px!important;letter-spacing:.3px}',
    /* botones de acción (iconos) en la tabla */
    'body.sc1 #tbCasos button{font-family:' + F + '!important;border-radius:6px!important;border:1px solid ' + BD + '!important;background:#fff!important;box-shadow:none!important;color:' + AZ + '!important}',
    'body.sc1 #tbCasos button:hover{background:' + BG + '!important;border-color:' + AZ + '!important}',
    /* barra de avance */
    'body.sc1 #tbCasos div[style*="border-radius: 999px"],body.sc1 #tbCasos div[style*="border-radius:999px"]{border-radius:3px!important}',

    /* ─────────── CONTROL DE CUMPLIMIENTO ─────────── */
    'body.sc1 #sec-cumplimiento{font-family:' + F + '}',
    'body.sc1 #sec-cumplimiento h2{font-family:' + F + '!important;font-size:17px!important;font-weight:700!important;color:' + AZ + '!important}',
    'body.sc1 .cumpl-tabs{gap:0;border-bottom:1px solid ' + BD + ';margin:6px 0 16px}',
    'body.sc1 .cumpl-tabs button{font-family:' + F + ';border:none!important;border-bottom:2px solid transparent!important;border-radius:0!important;background:transparent!important;color:' + GR + '!important;font-weight:600!important;font-size:12.5px!important;padding:9px 14px!important;margin-bottom:-1px}',
    'body.sc1 .cumpl-tabs button:hover{color:' + AZ + '!important}',
    'body.sc1 .cumpl-tabs button.on{color:' + AZ + '!important;border-bottom-color:' + AZ + '!important}',
    'body.sc1 .cumpl-card{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;padding:16px 18px!important}',
    'body.sc1 .cumpl-kpi{background:#fff!important;border:1px solid ' + BD + '!important;border-top:3px solid ' + BD + '!important;border-radius:8px!important;padding:12px 16px!important}',
    'body.sc1 .cumpl-kpi .n{font-family:' + F + ';font-size:26px!important;font-weight:700!important;letter-spacing:-.5px}',
    'body.sc1 .cumpl-kpi .l{' + LBL + '}',
    'body.sc1 .cumpl-kpi:has(.n[style*="#16a34a"]),body.sc1 .cumpl-kpi:has(.n[style*="rgb(22, 163, 74)"]){border-top-color:#0F6B3A!important}',
    'body.sc1 .cumpl-kpi:has(.n[style*="#dc2626"]),body.sc1 .cumpl-kpi:has(.n[style*="rgb(220, 38, 38)"]){border-top-color:#B42318!important}',
    'body.sc1 .cumpl-kpi:has(.n[style*="#d97706"]),body.sc1 .cumpl-kpi:has(.n[style*="#f59e0b"]){border-top-color:#9A4A00!important}',
    'body.sc1 .cumpl-sel{font-family:' + F + '!important;height:38px;border:1px solid ' + BD + '!important;border-radius:6px!important;font-size:12.5px!important;color:#1F2A3C}',
    'body.sc1 .cumpl-tb{font-family:' + F + '}',
    'body.sc1 .cumpl-tb th{background:' + BG + '!important;color:#3D4C63!important;' + LBL + ';border-bottom:1px solid ' + BD + '!important;padding:9px 10px!important}',
    'body.sc1 .cumpl-tb td{font-size:12.5px!important;color:#1F2A3C;border-bottom:1px solid #EEF1F5!important}',
    'body.sc1 .cumpl-tb tbody tr:hover td{background:#F6F8FB}',
    'body.sc1 .cumpl-tb td span[style*="border-radius"]{border-radius:4px!important;font-weight:600!important;font-size:10.5px!important}',
    'body.sc1 #sec-cumplimiento .cumpl-btn{font-family:' + F + ';border-radius:6px!important;font-weight:600!important;letter-spacing:.2px!important;background:' + AZ + '}',
    'body.sc1 #sec-cumplimiento .cumpl-btn.rojo{background:#B42318}body.sc1 #sec-cumplimiento .cumpl-btn.gris{background:#fff;color:' + AZ + ';border:1px solid ' + BD + '}',
    'body.sc1 #sec-cumplimiento .cumpl-hd{font-family:' + F + ';font-weight:700;color:' + AZ + ';border-bottom:1px solid ' + BD + '}',
    'body.sc1 #sec-cumplimiento .cumpl-grp{' + LBL + '}',
    'body.sc1 #sec-cumplimiento .cumpl-it{border-bottom:1px solid #EEF1F5}',
    /* tarjetas internas pintadas con estilo en línea (resúmenes por supervisor) */
    'body.sc1 #cumplAdminBody div[style*="border-radius: 12px"],body.sc1 #cumplAdminBody div[style*="border-radius:12px"],body.sc1 #cumplAdminBody div[style*="border-radius: 14px"],body.sc1 #cumplAdminBody div[style*="border-radius:14px"]{border-radius:8px!important}',

    /* ─────────── PANEL: COMPARATIVA Y FILTRO ─────────── */
    'body.sc1 #dashComparativa .sc{font-family:' + F + ';background:#fff;border:1px solid ' + BD + ';border-top:3px solid ' + BD + ';border-radius:8px;box-shadow:none}',
    'body.sc1 #dashComparativa .sc *{font-family:' + F + '!important}',
    'body.sc1 #dashComparativa .sc>div:first-child,body.sc1 #dashComparativa .sc>span:first-child{' + LBL + '}',
    'body.sc1 #dashComparativa .sc b,body.sc1 #dashComparativa .sc strong,body.sc1 #dashComparativa .sc div[style*="font-size:2"],body.sc1 #dashComparativa .sc div[style*="font-size: 2"]{color:' + AZ + ';font-weight:700;letter-spacing:-.5px}',
    'body.sc1 #dashComparativa .sc span[style*="border-radius"]{border-radius:4px!important;font-size:10.5px!important;font-weight:600!important}',
    'body.sc1 #dashComparativa #dcH{border-top-color:' + AZ + '}body.sc1 #dashComparativa #dcM{border-top-color:#0F6B3A}body.sc1 #dashComparativa #dcA{border-top-color:#9A4A00}body.sc1 #dashComparativa #dcP{border-top-color:#B42318}',
    'body.sc1 #dashComparativa+div{font-family:' + F + ';border:1px solid ' + BD + '!important;border-radius:8px!important}',
    'body.sc1 #dashComparativa+div>span:first-child{' + LBL + ';color:' + AZ + '}',
    'body.sc1 #dashComparativa+div select,body.sc1 #dashComparativa+div input{font-family:' + F + '!important;height:36px;border:1px solid ' + BD + '!important;border-radius:6px!important;font-size:12.5px!important;color:#1F2A3C;background:#fff}',
    'body.sc1 #dashComparativa+div button{font-family:' + F + '!important;border-radius:6px!important;font-weight:600!important;box-shadow:none!important}',
    /* gráficos del panel (tarjetas .gc / .d2-card) */
    'body.sc1 .gc,body.sc1 .d2-card{border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;background:#fff}',
    'body.sc1 .gc h3,body.sc1 .gc .head,body.sc1 .d2-card .head,body.sc1 .gc>div:first-child>b,body.sc1 .gc>div:first-child>span:first-child{font-family:' + F + '!important;font-size:12.5px!important;font-weight:700!important;color:' + AZ + '!important}'
  ].join('\n');
  function iniciar() {
    var st = document.createElement('style'); st.id = 'seccCorpCss'; st.textContent = CSS; document.head.appendChild(st);
    document.body.classList.add('sc1');
    console.log('[_SECC_CORP_V1] tema empresarial en Casos, Cumplimiento y Comparativa activo (apagar: localStorage.rl_secc_corp = "off")');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
