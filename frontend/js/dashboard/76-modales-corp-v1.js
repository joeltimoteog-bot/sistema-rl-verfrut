/* ═══════════════════════════════════════════════════════════════════════════
   76-modales-corp-v1.js — _MODALES_CORP_V1 (04-nov-2026)
   Formularios emergentes del panel con la misma identidad empresarial que
   Nueva atención y Nueva visita: cabecera clara, títulos sin emoji, botones
   y cajas en la paleta corporativa. SOLO estilos: no cambia campos, ids,
   validaciones ni guardado.
   Alcanza: Registro de caso, Fusión de buses, Solicitar edición, Detalle de
   caso, Detalle de fusión, Reenviar informe, ¿Qué tipo de caso es? y los
   demás .ov del panel que usan la cabecera azul antigua.
   Apagar: localStorage.rl_modales_corp = 'off'
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._MODALES_CORP_V1) return; window._MODALES_CORP_V1 = true;
  try { if (localStorage.getItem('rl_modales_corp') === 'off') return; } catch (e) {}

  var AZ = '#0F2748', BAND = '#EDF1F6', BD = '#D6DEE9', GR = '#5B6B82', TX = '#1F2A3C', F = 'Inter,"Segoe UI",Arial,sans-serif';
  var B = 'body.cg1 ';
  /* cabecera azul antigua (inline): primer div del .modal con esquinas 14px */
  var H = B + '.ov:not(#mVisita):not(#mAt) > .modal > div:first-child[style*="14px 14px 0 0"]';

  var css = [
    /* 1) cabecera clara, igual a Nueva atención / Nueva visita */
    H + '{background:' + BAND + '!important;background-image:none!important;color:' + AZ + '!important;border-bottom:1px solid ' + BD + '!important;border-radius:8px 8px 0 0!important;padding:14px 22px!important}',
    H + ' > span:first-child{color:' + AZ + '!important;font-family:' + F + '!important;font-size:15px!important;font-weight:700!important;letter-spacing:.2px}',
    H + ' span[onclick]{color:' + GR + '!important;opacity:1!important;font-size:18px!important}',
    H + ' span[onclick]:hover{color:' + AZ + '!important}',

    /* 2) ¿Qué tipo de caso es?: tarjetas sobrias en vez de bloques de color */
    B + '#mTipoCaso button[onclick*="abrirCasoInvestigacion"],' + B + '#mTipoCaso button[onclick*="abrirCasoConcluido"]{background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '!important;border-radius:8px!important;box-shadow:none!important;text-align:left!important}',
    B + '#mTipoCaso button[onclick*="abrirCasoInvestigacion"]{border-left:4px solid #1D4ED8!important}',
    B + '#mTipoCaso button[onclick*="abrirCasoConcluido"]{border-left:4px solid #15803D!important}',
    B + '#mTipoCaso button[onclick*="abrirCaso"] *{color:inherit!important;opacity:1!important}',
    B + '#mTipoCaso button[onclick*="abrirCaso"] div + div,' + B + '#mTipoCaso button[onclick*="abrirCaso"] span + span{color:' + GR + '!important;font-weight:400!important}',
    B + '#mTipoCaso button[onclick*="abrirCaso"]:hover{background:' + BAND + '!important}',

    /* 3) Reenviar informe: botón y acentos morados -> azul corporativo */
    B + '#mReenvioVisita [style*="#7c3aed"]{background:' + AZ + '!important;border-color:' + AZ + '!important}',

    /* 4) cajas de color (naranja, verde, lila) -> gris neutro con acento azul */
    B + '#mFusion [style*="#fff7ed"],' + B + '#mFusion [style*="#f0fdf4"],' + B + '#mCaso [style*="#fffbeb"],' + B + '#mCaso [style*="#fef9c3"]{background:#F8FAFC!important;border-color:' + BD + '!important}',
    B + '#mFusion [style*="#9a3412"],' + B + '#mFusion [style*="#166534"],' + B + '#mCaso [style*="#92400e"],' + B + '#mCaso [style*="#854d0e"]{color:' + AZ + '!important}',
    B + '#mFusion button[style*="#e0e7ff"]{background:#fff!important;color:' + AZ + '!important;border:1px solid ' + BD + '!important}',

    /* 5) selector de archivo con estilo del sistema */
    B + '.ov input[type="file"]{font-family:' + F + ';font-size:12.5px;color:' + GR + '}',
    B + '.ov input[type="file"]::file-selector-button{font-family:' + F + ';font-size:12.5px;font-weight:600;color:' + AZ + ';background:#fff;border:1px solid ' + BD + ';border-radius:6px;padding:6px 12px;margin-right:10px;cursor:pointer}',
    B + '.ov input[type="file"]::file-selector-button:hover{background:' + BAND + '}',

    /* 6) el globo "¿Dudas? Pregúntame" no tapa los botones de un formulario abierto */
    'body:has(.ov.on) .asis-globo{display:none!important}'
  ].join('\n');

  var st = document.createElement('style'); st.id = 'modalesCorpCss'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* títulos sin emoji (mismo criterio que las cabeceras de página) */
  var EMO = /^[\s‍️←-⯿☀-➿\u{1f000}-\u{1faff}]+/u;
  function limpiar(el) {
    try {
      if (!el) return;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { var v = n.nodeValue.replace(EMO, ''); if (v !== n.nodeValue) n.nodeValue = v; return; }
      }
    } catch (e) {}
  }
  function titulos() {
    try {
      document.querySelectorAll('.ov:not(#mVisita):not(#mAt) > .modal > div:first-child[style*="14px 14px 0 0"] > span:first-child').forEach(limpiar);
      limpiar(document.querySelector('#mTipoCaso .modal > div:first-child'));
    } catch (e) {}
  }
  function iniciar() {
    if (!document.body || !document.body.classList.contains('cg1')) { setTimeout(iniciar, 400); return; }
    titulos();
    /* el título de Registro de caso cambia por JS (investigación / concluido): se limpia cada vez */
    try {
      var t = document.getElementById('mCasoTitulo');
      if (t && window.MutationObserver) new MutationObserver(function () { limpiar(t); }).observe(t, { childList: true, characterData: true, subtree: true });
    } catch (e) {}
    console.log('[_MODALES_CORP_V1] formularios emergentes con identidad empresarial (apagar: localStorage.rl_modales_corp = "off")');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
