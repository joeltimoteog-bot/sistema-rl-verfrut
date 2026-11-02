/* ═════════════════════════════════════════════════════════════════════════
   _PANEL_CORP_V2 (02-nov-2026) — Tema empresarial del Panel de gestión y de los listados
   (según las maquetas aprobadas: "Panel de gestión", "Mis atenciones", "Registro de casos")
   Solo CSS sobre los elementos que ya existen: ningún id, dato ni función cambia.
   · Bienvenida: tarjeta blanca con nombre en azul, píldoras claras y acciones (1 sólida + resto
     con borde) en lugar del banner azul con degradado.
   · KPIs: tarjetas blancas, cifra grande en Inter, sin icono de color; borde superior ámbar en
     "En proceso" y verde en "Finalizados".
   · Tarjetas de gráficos, listados y tablas: bordes finos, cabeceras grises en mayúscula pequeña,
     etiquetas de estado rectangulares (verde / ámbar), botones azul corporativo.
   INTERRUPTOR: localStorage.rl_panel_corp = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._PANEL_CORP_V2) return; window._PANEL_CORP_V2 = true;
  try { if (localStorage.getItem('rl_panel_corp') === 'off') { console.log('[_PANEL_CORP_V2] apagado por localStorage.rl_panel_corp'); return; } } catch (e) {}
  var F = 'Inter,"Segoe UI",Arial,sans-serif', AZ = '#0F2748';
  var CSS = [
    '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");',
    'body.pc2 .main,body.pc2 .content{background:#EEF1F5}',
    /* bienvenida */
    'body.pc2 #d2Hero{background:#FFFFFF!important;color:#1F2937!important;border:1px solid #D6DEE9;border-radius:10px!important;box-shadow:none!important;padding:18px 22px!important}',
    'body.pc2 #d2Hero::before,body.pc2 #d2Hero::after{display:none!important}',
    'body.pc2 #d2Hero .d2-hola{color:#5B6B82!important;opacity:1!important;font-family:' + F + ';font-size:11px!important;letter-spacing:1px!important}',
    'body.pc2 #d2Hero #d2Nom{color:' + AZ + '!important;font-family:' + F + '!important;font-size:22px!important;font-weight:700!important;letter-spacing:0!important}',
    'body.pc2 #d2Hero #d2Rol,body.pc2 #d2Hero .d2-lema,body.pc2 #d2Hero p{color:#5B6B82!important;opacity:1!important}',
    'body.pc2 #d2Hero .d2-pill,body.pc2 #d2Hero #fbBadgeDash{background:#E8F0FB!important;border:1px solid #C7D7F0!important;color:' + AZ + '!important;border-radius:6px!important;font-family:' + F + ';font-weight:600!important}',
    'body.pc2 #d2Hero .d2-pill.warn{background:#FFF1DE!important;border-color:#F5D9B0!important;color:#9A4A00!important}',
    'body.pc2 #d2Hero .d2-acc button{height:40px;padding:0 16px!important;border-radius:6px!important;border:1.5px solid ' + AZ + '!important;background:#FFFFFF!important;color:' + AZ + '!important;font-family:' + F + '!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important;transform:none!important}',
    'body.pc2 #d2Hero .d2-acc button:first-child{background:' + AZ + '!important;color:#FFFFFF!important;font-weight:700!important}',
    'body.pc2 #d2Hero .d2-acc button.ghost{opacity:1!important}',
    'body.pc2 #d2Hero .d2-reloj .h{color:' + AZ + '!important;font-family:' + F + '!important;font-weight:700!important;font-size:34px!important}',
    'body.pc2 #d2Hero .d2-reloj .d{color:#5B6B82!important;opacity:1!important}',
    'body.pc2 #d2Hero .d2-reloj img{background:#F3F5F8!important;border:1px solid #D6DEE9}',
    /* KPIs */
    'body.pc2 .sg{gap:14px}',
    'body.pc2 .sc{display:block;border-radius:10px;border:1px solid #D6DEE9;padding:16px 18px 14px;box-shadow:none}',
    'body.pc2 .sc .sc-ic{display:none}',
    'body.pc2 .sc .sc-n{font-family:' + F + ';font-size:30px;font-weight:700;color:' + AZ + ';letter-spacing:0}',
    'body.pc2 .sc .sc-l{font-family:' + F + ';font-size:11px;color:#5B6B82;letter-spacing:.6px;order:-1}',
    'body.pc2 .sc > div:not(.sc-ic){display:flex;flex-direction:column}',
    'body.pc2 .sc:has(#sP){border-top:3px solid #B45309}body.pc2 .sc:has(#sP) .sc-n{color:#B45309}',
    'body.pc2 .sc:has(#sF){border-top:3px solid #0F6B3A}body.pc2 .sc:has(#sF) .sc-n{color:#0F6B3A}',
    'body.pc2 .sc [id$="-prog"]{display:none}',
    /* tarjetas, gráficos, listados */
    'body.pc2 .gc,body.pc2 .card,body.pc2 .tc-card,body.pc2 #tcCumpl,body.pc2 #dashComparativa .sc{border-radius:10px;border:1px solid #D6DEE9;box-shadow:none}',
    'body.pc2 .gc-t,body.pc2 .card-t,body.pc2 .tc-card-t{font-family:' + F + ';font-size:13px;font-weight:700;color:' + AZ + ';letter-spacing:.6px;text-transform:uppercase}',
    'body.pc2 .card-h{padding:14px 18px;border-bottom:1px solid #E6EBF2}',
    'body.pc2 .btn-n{height:38px;padding:0 16px;border-radius:6px;background:' + AZ + ';color:#FFFFFF;font-family:' + F + ';font-size:13px;font-weight:700;border:0}',
    'body.pc2 .btn-n:not([onclick^="abrir"]){background:#FFFFFF;color:' + AZ + ';border:1.5px solid ' + AZ + ';font-weight:600}',   /* solo "+ Nuevo/a …" (abrir…) queda sólido; Excel, indicadores, etc. con borde */
    'body.pc2 .btn-n:hover{transform:none;opacity:.92}',
    'body.pc2 .fi{height:38px;padding:0 10px;border:1.5px solid #B8C4D6;border-radius:6px;background:#FFFFFF;font-family:' + F + ';font-size:13px;color:#1F2937}',
    'body.pc2 .fi:focus{outline:none;border-color:' + AZ + ';box-shadow:0 0 0 3px rgba(15,39,72,.10)}',
    /* tablas */
    'body.pc2 .tbl thead th,body.pc2 .card table thead th,body.pc2 .tc-cumpl th{background:#F8FAFC;color:#5B6B82;font-family:' + F + ';font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid #E6EBF2}',
    'body.pc2 .tbl tbody td,body.pc2 .card table tbody td{font-family:' + F + ';font-size:13px;padding:10px 12px;border-top:1px solid #E6EBF2;color:#1F2937}',
    'body.pc2 .tbl tbody tr:hover td{background:#F8FAFC}',
    'body.pc2 .bg{border-radius:4px;font-family:' + F + ';font-size:11px;font-weight:700;padding:3px 8px;letter-spacing:.2px}',
    'body.pc2 .bg.bpr{background:#FFF1DE!important;color:#9A4A00!important}body.pc2 .bg.brs{background:#E4F4EA!important;color:#0F6B3A!important}body.pc2 .bg.bp{background:#F1F5F9!important;color:#475569!important}',
    'body.pc2 .bg.brap{background:#E8F0FB!important;color:' + AZ + '!important}body.pc2 .bg.bver{background:#EEF1F5!important;color:#1F2937!important;border:1px solid #D6DEE9}body.pc2 .bg.bam{background:#F1F5F9!important;color:#475569!important}',
    'body.pc2 .btn-a{border-radius:5px;font-family:' + F + ';font-size:11.5px;font-weight:600;padding:5px 10px}',
    /* cabecera de contenido */
    'body.pc2 #tbT,body.pc2 .topbar-t{font-family:' + F + '!important;font-size:15px!important;font-weight:700!important;color:' + AZ + '!important;letter-spacing:.3px!important}',
    /* menú lateral */
    'body.pc2 .ni{font-family:' + F + ';font-size:13px!important;border-radius:6px;color:#DCE4F0}body.pc2 .ni.on{background:rgba(255,255,255,.14);color:#FFFFFF;font-weight:600}',
    'body.pc2 .ni .bdg,body.pc2 .ni .badge,body.pc2 .ni span[style*="background"]{background:#D9292B!important;color:#FFFFFF!important;border-radius:10px!important;font-size:10px!important;font-weight:700!important;padding:2px 7px!important}'
  ].join('\n');
  function iniciar() {
    var st = document.createElement('style'); st.id = 'panelCorpCss'; st.textContent = CSS; document.head.appendChild(st);
    document.body.classList.add('pc2');
    console.log('[_PANEL_CORP_V2] tema empresarial del panel y listados activo (apagar: localStorage.rl_panel_corp = "off")');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
