/* ═════════════════════════════════════════════════════════════════════════
   _ENCAB_CORP_V1 (02-nov-2026) — Encabezados de sección ordenados y serios en TODO el Panel
   (Visitas de campo, Registro de casos, Solicitudes, Fusiones, Atenciones, Trabajadores, etc.)
   Solo CSS sobre elementos existentes: ningún id, dato ni función cambia.
   · .sec-hd: banda blanca con borde fino; título Inter a la izquierda, botones a la derecha,
     subtítulo debajo del título (ya no se cruza con los botones). Sin cuadros de color ni emojis
     como icono del título.
   · Banda "Semana actual" (#v2Sem): azul corporativo plano, píldoras rectangulares.
   · Etiquetas SEM / estado / empresa rectangulares; barra de avance fina.
   · Botones de acción de las tablas: blancos con borde, icono en gris (color al pasar el cursor).
   · Chips de filtro (Ambas / RAPEL / VERFRUT) rectangulares.
   INTERRUPTOR: localStorage.rl_encab_corp = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ENCAB_CORP_V1) return; window._ENCAB_CORP_V1 = true;
  try { if (localStorage.getItem('rl_encab_corp') === 'off') { console.log('[_ENCAB_CORP_V1] apagado por localStorage.rl_encab_corp'); return; } } catch (e) {}
  var F = 'Inter,"Segoe UI",Arial,sans-serif', AZ = '#0F2748', BD = '#D6DEE9', GR = '#5B6B82', TX = '#1F2A3C';
  var B = 'body.ec1 ';
  var CSS = [
    /* ── banda de encabezado de sección ── */
    B + '.sec-hd{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:8px!important;background:#fff;border:1px solid ' + BD + ';border-radius:8px;padding:12px 16px!important;margin:0 0 12px!important}',
    B + '.sec-hd h2{font-family:' + F + '!important;font-size:16px!important;font-weight:700!important;color:' + AZ + '!important;text-transform:none!important;letter-spacing:.1px!important;margin:0 auto 0 0!important;display:flex;align-items:center;gap:8px}',
    B + '.sec-hd h2 .v2ic,' + B + '.sec-hd h2>span[class$="ic"],' + B + '.sec-hd h2>span[style*="background"]{display:none!important}',
    B + '.sec-hd .v2sub,' + B + '.sec-hd .sub,' + B + '.sec-hd small{order:9;flex-basis:100%!important;margin:2px 0 0!important;font-family:' + F + ';font-size:12px;color:' + GR + '}',
    B + '.sec-hd .btn-n,' + B + '.sec-hd button{font-family:' + F + '!important;height:36px;padding:0 14px!important;font-size:12.5px!important;font-weight:600!important;border-radius:6px!important;box-shadow:none!important;letter-spacing:.1px!important;text-transform:none!important}',
    B + '.sec-hd .btn-n[onclick^="abrir"],' + B + '.sec-hd .btn-n[onclick^="nuev"]{background:' + AZ + '!important;color:#fff!important;border:1px solid ' + AZ + '!important}',
    B + '.sec-hd .btn-n:not([onclick^="abrir"]):not([onclick^="nuev"]),' + B + '.sec-hd button:not(.btn-n){background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '!important}',
    B + '.sec-hd .btn-n:not([onclick^="abrir"]):hover{background:#F3F5F8!important;border-color:' + AZ + '!important}',
    /* ── filtros de la sección ── */
    B + '.sec .filtros{background:#fff;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;padding:10px 14px!important}',
    B + '.sec .filtros select,' + B + '.sec .filtros input{height:38px!important;border:1px solid ' + BD + '!important;border-radius:6px!important;font-family:' + F + '!important;font-size:12.5px!important;background:#fff!important}',
    B + '#v2Chips{display:inline-flex;gap:0;border:1px solid ' + BD + ';border-radius:6px;overflow:hidden}',
    B + '#v2Chips span{font-family:' + F + '!important;border-radius:0!important;border:none!important;border-right:1px solid ' + BD + '!important;background:#fff!important;color:' + TX + '!important;font-weight:500!important;padding:8px 14px!important;font-size:12.5px!important;box-shadow:none!important}',
    B + '#v2Chips span:last-child{border-right:none!important}',
    B + '#v2Chips span.on{background:' + AZ + '!important;color:#fff!important}',
    B + '#v2Cnt{font-family:' + F + ';border:1px solid ' + BD + ';border-radius:6px;padding:7px 12px;font-size:12px;color:' + GR + ';background:#F3F5F8}' + B + '#v2Cnt b{color:' + AZ + '}',
    /* ── banda de la semana ── */
    B + '#v2Sem{background:' + AZ + '!important;background-image:none!important;border-radius:8px!important;box-shadow:none!important;font-family:' + F + '}',
    B + '#v2Sem .big{font-family:' + F + '!important;font-size:24px!important;font-weight:700!important;letter-spacing:-.5px}',
    B + '#v2Sem .lb{font-size:10.5px!important;letter-spacing:.6px!important;font-weight:600;opacity:.75}',
    B + '#v2Sem .pill{border-radius:4px!important;font-weight:600!important;font-size:11px!important;background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.22)!important}',
    B + '#v2Sem .pill.warn{background:rgba(255,241,222,.22)!important;border-color:rgba(255,200,120,.55)!important}' + B + '#v2Sem .pill.ok{background:rgba(228,244,234,.2)!important;border-color:rgba(120,220,160,.55)!important}',
    B + '#v2Sem .bar i,' + B + '#v2Sem .bar i b{border-radius:2px!important}',
    /* ── etiquetas en tablas ── */
    B + '.v2wk,' + B + '.sem-tag,' + B + '.tbl td span[style*="border-radius"]{border-radius:4px!important;font-family:' + F + '!important;font-weight:600!important;font-size:10.5px!important;letter-spacing:.3px}',
    B + '.v2wk{background:#E6EBF2!important;color:' + AZ + '!important}',
    B + '.v2st{border-radius:4px!important;font-weight:600!important;font-family:' + F + '!important;text-transform:uppercase;letter-spacing:.3px}',
    B + '.v2st.ok{background:#E4F4EA!important;color:#0F6B3A!important}' + B + '.v2st.rt{background:#FEE2E2!important;color:#991B1B!important}' + B + '.v2st.ot{background:#EEF1F5!important;color:' + GR + '!important}',
    B + '.v2av{border-radius:4px!important;font-family:' + F + '!important;font-weight:600!important;background:#E6EBF2!important;color:' + AZ + '!important}',
    B + '.v2pr i,' + B + '.v2pr i b{border-radius:2px!important}' + B + '.v2pr i{height:5px!important}' + B + '.v2pr span{font-family:' + F + ';font-weight:600!important;color:' + TX + '}',
    /* ── botones de acción de las tablas (iconos) ── */
    B + '.tbl td button,' + B + '.tbl td button.v2ic{background:#fff!important;background-image:none!important;border:1px solid ' + BD + '!important;border-radius:6px!important;color:' + AZ + '!important;box-shadow:none!important;filter:grayscale(1);opacity:.8;transition:opacity .12s,border-color .12s!important}',
    B + '.tbl td button:hover,' + B + '.tbl td button.v2ic:hover{filter:none;opacity:1;border-color:' + AZ + '!important;transform:none!important;box-shadow:none!important}',
    /* ── tarjetas de avisos de la parte superior (cumplimiento de informes) ── */
    B + '.sec>.card:first-child,' + B + '.sec>div[style*="border-radius: 14px"],' + B + '.sec>div[style*="border-radius:14px"]{border-radius:8px!important;box-shadow:none!important;border:1px solid ' + BD + '!important}',
    B + '.sec span[style*="border-radius: 999px"],' + B + '.sec span[style*="border-radius:999px"],' + B + '.sec span[style*="border-radius: 20px"],' + B + '.sec span[style*="border-radius:20px"]{border-radius:4px!important;font-weight:600!important}',
    /* ── KPIs de sección (stats) ── */
    B + '.sec .cards .card{border:1px solid ' + BD + '!important;border-top:3px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;font-family:' + F + ';transform:none!important}',
    B + '.sec .cards .card>div:first-child{font-family:' + F + '!important;font-weight:700!important;letter-spacing:-.5px}',
    B + '.sec .cards .card>div:last-child:not(:first-child){font-size:10.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:' + GR + '}'
  ].join('\n');
  function iniciar() {
    var st = document.createElement('style'); st.id = 'encabCorpCss'; st.textContent = CSS; document.head.appendChild(st);
    document.body.classList.add('ec1');
    console.log('[_ENCAB_CORP_V1] encabezados de sección empresariales activos (apagar: localStorage.rl_encab_corp = "off")');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
