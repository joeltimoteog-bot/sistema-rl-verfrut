/* ═════════════════════════════════════════════════════════════════════════
   _FORM_HOJA_V1 (02-nov-2026) — Los demás formularios del dashboard con la misma hoja corporativa
   Registro de casos (#mCaso), Visita de campo (#mVisita), Fusión de buses (#mFusion), Solicitud de
   edición (#mSolicitud), Usuarios (#mUs) y Ausencia/Reemplazo (#mAus) pasan a verse como hoja única
   a pantalla ancha, con la misma tipografía, campos de 40 px, secciones con línea y barra de botones
   que "Nueva atención" (_AT_HOJA_V1). Solo CSS + clase en el contenedor: ningún id, función ni regla
   cambia. INTERRUPTOR: localStorage.rl_form_hoja = 'off'.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._FORM_HOJA_V1) return; window._FORM_HOJA_V1 = true;
  try { if (localStorage.getItem('rl_form_hoja') === 'off') { console.log('[_FORM_HOJA_V1] apagado por localStorage.rl_form_hoja'); return; } } catch (e) {}
  var IDS = ['mCaso', 'mVisita', 'mFusion', 'mSolicitud', 'mUs', 'mAus'];
  var F = 'Inter,"Segoe UI",Arial,sans-serif';
  var CSS = [
    '.ov.hoja2{background:#EEF1F5;align-items:flex-start;justify-content:center;overflow-y:auto;padding:22px 24px}',
    '.ov.hoja2 > .modal{width:100%!important;max-width:1376px!important;max-height:none!important;border-radius:10px!important;border:1px solid #D6DEE9;animation:none;box-shadow:0 10px 30px rgba(15,39,72,.10);font-family:' + F + ';overflow:visible!important}',
    /* cabeceras azules inline de casos / fusiones / solicitudes */
    '.ov.hoja2 > .modal > div[style*="background:var(--azul)"]{border-radius:10px 10px 0 0!important;padding:16px 24px!important;font-family:' + F + '}',
    '.ov.hoja2 > .modal > div[style*="background:var(--azul)"] span{font-size:17px!important;font-weight:700!important}',
    /* títulos de modal clásico (visitas, usuarios, ausencias) */
    '.ov.hoja2 .modal-t{margin:0 0 6px;padding:16px 24px;border-bottom:1px solid #E6EBF2;font-family:' + F + ';font-size:19px;font-weight:700;color:#0F2748}',
    '.ov.hoja2 > .modal{padding:0!important}',
    '.ov.hoja2 > .modal > div[style*="padding:20px"]{padding:14px 24px 18px!important}',
    '.ov.hoja2 > .modal > .sep,.ov.hoja2 > .modal > .fg,.ov.hoja2 > .modal > .fg1,.ov.hoja2 > .modal > .fg3,.ov.hoja2 > .modal > input,.ov.hoja2 > .modal > p,.ov.hoja2 > .modal > div:not([style*="background:var(--azul)"]):not(.modal-ft):not(.modal-t){margin-left:24px;margin-right:24px}',
    '.ov.hoja2 .sep{display:flex;align-items:center;gap:10px;margin-top:14px;margin-bottom:4px;padding:0;border:0;font-family:' + F + ';font-size:12px;font-weight:700;letter-spacing:.8px;color:#0F2748;text-transform:uppercase}',
    '.ov.hoja2 .sep::after{content:"";flex:1;height:1px;background:#E6EBF2}',
    '.ov.hoja2 .fg{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 14px;margin-top:8px;margin-bottom:8px}',
    '.ov.hoja2 .fg > .fc{grid-column:span 2}.ov.hoja2 .fg > .fc[style*="span 2"]{grid-column:span 4}.ov.hoja2 .fg > .fc:has(textarea){grid-column:span 6}',
    '.ov.hoja2 .fg3{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 14px}.ov.hoja2 .fg3 > .fc{grid-column:span 2}',
    '.ov.hoja2 div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px 14px!important}',
    '.ov.hoja2 div[style*="grid-template-columns:1fr 1fr 1fr"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}',
    '.ov.hoja2 label,.ov.hoja2 .lbl,.ov.hoja2 .fc label{font-size:11px!important;font-weight:700!important;color:#5B6B82!important;letter-spacing:.4px!important;text-transform:uppercase;font-family:' + F + '}',
    '.ov.hoja2 input:not([type=checkbox]):not([type=radio]):not([type=file]),.ov.hoja2 select{height:40px!important;padding:0 10px!important;border:1.5px solid #B8C4D6!important;border-radius:6px!important;font-size:14px!important;font-family:' + F + '!important;color:#1F2937;background:#fff;box-sizing:border-box}',
    '.ov.hoja2 textarea{padding:10px!important;border:1.5px solid #B8C4D6!important;border-radius:6px!important;font-size:14px!important;font-family:' + F + '!important;color:#1F2937;min-height:78px;box-sizing:border-box}',
    '.ov.hoja2 input:focus,.ov.hoja2 select:focus,.ov.hoja2 textarea:focus{outline:none;border-color:#0F2748!important;box-shadow:0 0 0 3px rgba(15,39,72,.10)}',
    '.ov.hoja2 input[readonly],.ov.hoja2 input[disabled],.ov.hoja2 select[disabled]{background:#F3F5F8!important;border-color:#D6DEE9!important}',
    '.ov.hoja2 .modal-ft,.ov.hoja2 .modal > div[style*="justify-content:flex-end"]{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin:8px 0 0!important;padding:14px 24px!important;border-top:1px solid #E6EBF2;background:#F8FAFC;border-radius:0 0 10px 10px;position:sticky;bottom:0}',
    '.ov.hoja2 .btn-save,.ov.hoja2 button[style*="background:var(--azul)"],.ov.hoja2 button[style*="background:#16a34a"]{height:42px!important;padding:0 22px!important;border:0!important;border-radius:6px!important;background:#0F2748!important;color:#fff!important;font-size:14px!important;font-weight:700!important;font-family:' + F + '!important;cursor:pointer}',
    '.ov.hoja2 .btn-cancel{height:42px!important;padding:0 16px!important;border:1.5px solid #B8C4D6!important;border-radius:6px!important;background:#fff!important;color:#5B6B82!important;font-size:13px!important;font-weight:600!important;font-family:' + F + '!important;cursor:pointer}',
    '@media (max-width:1100px){.ov.hoja2 .fg,.ov.hoja2 .fg3{grid-template-columns:repeat(3,minmax(0,1fr))}.ov.hoja2 .fg > .fc,.ov.hoja2 .fg3 > .fc{grid-column:span 1}.ov.hoja2 .fg > .fc:has(textarea){grid-column:span 3}.ov.hoja2 div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
    '@media (max-width:700px){.ov.hoja2{padding:0}.ov.hoja2 > .modal{border-radius:0!important}.ov.hoja2 .fg,.ov.hoja2 .fg3,.ov.hoja2 div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:1fr!important}.ov.hoja2 .fg > .fc,.ov.hoja2 .fg3 > .fc{grid-column:span 1!important}}'
  ].join('\n');
  function iniciar() {
    var st = document.createElement('style'); st.id = 'formHojaCss'; st.textContent = CSS; document.head.appendChild(st);
    var n = 0; IDS.forEach(function (id) { var el = document.getElementById(id); if (el) { el.classList.add('hoja2'); n++; } });
    console.log('[_FORM_HOJA_V1] ' + n + ' formularios en hoja corporativa (apagar: localStorage.rl_form_hoja = "off")');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
