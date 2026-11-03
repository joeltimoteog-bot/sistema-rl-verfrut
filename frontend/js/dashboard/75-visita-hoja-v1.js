/* ═════════════════════════════════════════════════════════════════════════
   _VISITA_HOJA_V1 (02-nov-2026) — "Nueva visita de campo" como hoja única corporativa,
   calcada del modelo de "Nueva atención" (_AT_HOJA_V1).
   · El asistente por pasos de visitas-ui.js (#v2Steps / Anterior / Siguiente) deja de mostrarse:
     las cuatro secciones quedan visibles a la vez en una sola hoja a pantalla completa.
   · Secciones renombradas: A · Supervisor, B · Datos de la visita, C · Contenido del informe,
     D · Evidencias fotográficas. Rejilla de 6 columnas, campos de 40 px, etiquetas en mayúscula.
   · Barra de validación (#vHojaVal) con los mismos campos obligatorios que usa el sistema;
     el botón "Generar informe" y todas las funciones (autoFillVisita, calcularSemanaVisita,
     previewFotos, generarInformeVisita) siguen siendo las de siempre.
   Solo presentación: ningún id, flujo ni guardado cambia.
   INTERRUPTOR: localStorage.rl_visita_hoja = 'off' → vuelve al asistente por pasos.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._VISITA_HOJA_V1) return; window._VISITA_HOJA_V1 = true;
  try { if (localStorage.getItem('rl_visita_hoja') === 'off') { console.log('[_VISITA_HOJA_V1] apagado por localStorage.rl_visita_hoja'); return; } } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var F = 'Inter,"Segoe UI",Arial,sans-serif', M = '#mVisita.hoja ';
  var CSS = [
    M + '{background:#EEF1F5!important;align-items:flex-start!important;justify-content:center!important;overflow-y:auto!important;padding:22px 24px!important}',
    M + '> .modal{width:100%!important;max-width:1376px!important;max-height:none!important;padding:0!important;border-radius:10px!important;border:1px solid #D6DEE9!important;animation:none!important;box-shadow:0 10px 30px rgba(15,39,72,.10)!important;font-family:' + F + ';overflow:visible!important}',
    /* cabecera del formulario: blanca, título azul, subtítulo */
    M + '> .modal > div:first-child{background:#fff!important;color:#0F2748!important;border-radius:10px 10px 0 0!important;border-bottom:1px solid #E6EBF2;padding:16px 24px!important;position:static!important;flex-wrap:wrap;gap:14px}',
    M + '> .modal > div:first-child > span:first-child{font-family:' + F + ';font-size:19px!important;font-weight:700!important;color:#0F2748}',
    M + '> .modal > div:first-child > span[onclick]{color:#5B6B82!important;opacity:1!important;font-size:18px!important}',
    M + '.hoja-sub{flex-basis:100%;font-size:12.5px;font-weight:400;color:#5B6B82;margin-top:-6px;font-family:' + F + '}',
    /* todas las secciones visibles; asistente oculto */
    M + '.v2sec,' + M + '.v2pasos .v2sec{display:block!important}',
    M + '#v2Steps,' + M + '#v2Ant,' + M + '#v2Sig,' + M + '#v2Foot .pg{display:none!important}',
    M + '> .modal > div:not(:first-child){padding:0!important}',
    /* títulos de sección */
    M + '.sep{display:flex;align-items:center;gap:10px;margin:16px 24px 2px;padding:0;border:0;font-family:' + F + ';font-size:12px;font-weight:700;letter-spacing:.8px;color:#0F2748;text-transform:uppercase;background:transparent}',
    M + '.sep::after{content:"";flex:1;height:1px;background:#E6EBF2}',
    M + '.sep .hoja-tag{font-size:11px;font-weight:600;color:#1E4E8C;background:#E8F0FB;padding:3px 8px;border-radius:4px;letter-spacing:0;text-transform:none}',
    /* rejilla de 6 columnas */
    M + '.v2sec .fg{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 14px;padding:10px 24px 6px;margin:0}',
    M + '.v2sec .fg .fc{grid-column:span 2;margin:0}',
    M + '.v2sec .fg .fc[style*="1/-1"]{grid-column:span 6!important}',
    M + '.v2sec .fg .fc[style*="span 2"]{grid-column:span 4!important}',
    M + '.v2sec > div[style]{margin:10px 24px!important}',
    M + '#v2Auto{padding:0 24px 6px}',
    M + '.fc label{font-size:11px;font-weight:700;color:#5B6B82;letter-spacing:.4px;text-transform:uppercase;font-family:' + F + ';margin-bottom:5px;display:block}',
    M + '.fc input,' + M + '.fc select,' + M + '.fc textarea{width:100%;height:40px;padding:0 10px;border:1.5px solid #B8C4D6;border-radius:6px;font-size:14px;font-family:' + F + ';color:#1F2937;background:#fff;box-sizing:border-box}',
    M + '.fc textarea{height:auto;min-height:78px;padding:10px}',
    M + '.fc input[readonly]{background:#F3F5F8;border-color:#D6DEE9}',
    M + '.fc input:focus,' + M + '.fc select:focus,' + M + '.fc textarea:focus{outline:none;border-color:#0F2748;box-shadow:0 0 0 3px rgba(15,39,72,.10)}',
    M + '#vSup{border-color:#0F2748;font-weight:600}',
    M + '#reemplazoDivVisita{background:#FFF1DE!important;border:1px solid #F5CB8E!important;border-radius:6px!important}' + M + '#reemplazoDivVisita>div:first-child{color:#9A4A00!important;font-family:' + F + '}',
    M + '#motivoRetrasoDiv{background:#FEE2E2!important;border:1px solid #FCA5A5!important;border-radius:6px!important}' + M + '#motivoRetrasoDiv label{color:#991B1B!important;font-family:' + F + ';font-size:11px;text-transform:uppercase;letter-spacing:.4px}' + M + '#motivoRetrasoDiv textarea{width:100%;min-height:70px;border:1.5px solid #FCA5A5;border-radius:6px;padding:10px;font-family:' + F + ';font-size:14px;box-sizing:border-box}',
    /* evidencias */
    M + '#vFotos{height:auto;padding:10px;border:1.5px dashed #B8C4D6;border-radius:6px;width:100%;background:#F8FAFC;font-family:' + F + '}',
    M + '#vFotosCount{font-family:' + F + '}' + M + '#vFotosPreview img{border-radius:6px;border:1px solid #D6DEE9}',
    /* pie fijo con validación */
    M + '#v2Foot{display:flex!important;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0 0!important;padding:14px 24px!important;border-top:1px solid #E6EBF2!important;background:#F8FAFC!important;border-radius:0 0 10px 10px;position:sticky;bottom:0;z-index:9}',
    M + '#vHojaVal{display:flex;gap:8px;flex-wrap:wrap;font-size:12.5px;margin:0;padding:0;list-style:none;flex:1;font-family:' + F + '}',
    M + '#vHojaVal li{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;font-weight:600}',
    M + '#vHojaVal li.ok{color:#0F6B3A;background:#E4F4EA}' + M + '#vHojaVal li.falta{color:#9A4A00;background:#FFF1DE}',
    M + '#v2Foot button[onclick*="generarInformeVisita"]{height:42px!important;padding:0 22px!important;border:0!important;border-radius:6px!important;background:#0F2748!important;color:#fff!important;font-size:14px!important;font-weight:700!important;font-family:' + F + '!important;cursor:pointer}',
    M + '#v2Foot button[onclick*="cerrar"]{height:42px!important;padding:0 16px!important;border:1.5px solid #B8C4D6!important;border-radius:6px!important;background:#fff!important;color:#5B6B82!important;font-size:13px!important;font-weight:600!important;font-family:' + F + '!important;cursor:pointer}',
    '@media (max-width:1100px){' + M + '.v2sec .fg{grid-template-columns:repeat(3,minmax(0,1fr))}' + M + '.v2sec .fg .fc{grid-column:span 1}' + M + '.v2sec .fg .fc[style*="1/-1"],' + M + '.v2sec .fg .fc[style*="span 2"]{grid-column:span 3!important}}',
    '@media (max-width:700px){' + M + '{padding:0!important}' + M + '> .modal{border-radius:0!important;border:0!important}' + M + '.v2sec .fg{grid-template-columns:1fr}' + M + '.v2sec .fg .fc,' + M + '.v2sec .fg .fc[style*="1/-1"],' + M + '.v2sec .fg .fc[style*="span 2"]{grid-column:span 1!important}}'
  ].join('\n');
  var OBLIG = [['vSup', 'Supervisor'], ['vEmp', 'Empresa'], ['vFundo', 'Fundo / sector'], ['vPunto', 'Punto / zona'], ['vFI', 'Fecha inicio'], ['vFF', 'Fecha fin'], ['vFechaInforme', 'Fecha informe'], ['vPara', 'Destinatario'], ['vAsunto', 'Asunto'], ['vDesarrollo', 'Actividades'], ['vRutas', 'Rutas'], ['vAcciones', 'Acciones correctivas'], ['vObservaciones', 'Observaciones'], ['vFotos', 'Evidencias']];
  var OK = '<span aria-hidden="true">&#10003;</span>', AT = '<span aria-hidden="true">&#9679;</span>';
  function lleno(id) { var el = $(id); if (!el) return true; if (el.type === 'file') return !!(el.files && el.files.length) || !!(window._visitaEditando || (typeof window.editandoVisita !== 'undefined' && window.editandoVisita)); return String(el.value || '').trim() !== ''; }
  function validar() {
    var ul = $('vHojaVal'); if (!ul) return;
    var items = OBLIG.slice();
    var rd = $('reemplazoDivVisita'); if (rd && rd.style.display !== 'none') items.push(['vFundoReemplazo', 'Sector reasignado'], ['vSupTitular', 'Supervisor titular']);
    var mr = $('motivoRetrasoDiv'); if (mr && mr.style.display !== 'none') items.push(['vMotivoRetraso', 'Motivo del retraso']);
    ul.innerHTML = items.map(function (it) { var ok = lleno(it[0]); return '<li class="' + (ok ? 'ok' : 'falta') + '">' + (ok ? OK : AT) + (ok ? '' : 'Falta ') + it[1] + '</li>'; }).join('');
  }
  function armar() {
    var m = $('mVisita'); if (!m || m.classList.contains('hoja')) return;
    var modal = m.querySelector('.modal'); if (!modal) return;
    var st = document.createElement('style'); st.id = 'visitaHojaCss'; st.textContent = CSS; document.head.appendChild(st);
    m.classList.add('hoja');
    /* cabecera: texto sin emoji + subtítulo */
    var hd = modal.children[0], tit = hd && hd.querySelector('span');
    if (tit) { tit.textContent = tit.textContent.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').replace(/Nueva Visita de Campo/i, 'Nueva visita de campo'); }
    if (hd && !hd.querySelector('.hoja-sub')) { var sub = document.createElement('div'); sub.className = 'hoja-sub'; sub.textContent = 'Una sola hoja: supervisor, visita, informe y evidencias. Al generar el informe se registra y se envía al destinatario.'; hd.appendChild(sub); }
    /* nombres de sección */
    var seps = m.querySelectorAll('.sep'), nombres = ['A · Supervisor', 'B · Datos de la visita', 'C · Contenido del informe', 'D · Evidencias fotográficas'];
    Array.prototype.forEach.call(seps, function (s, i) { if (nombres[i]) s.textContent = nombres[i]; if (i === 0) { var tag = document.createElement('span'); tag.className = 'hoja-tag'; tag.textContent = 'DNI y correo se completan solos'; s.appendChild(tag); } if (i === 1) { var t2 = document.createElement('span'); t2.className = 'hoja-tag'; t2.textContent = 'La semana se calcula con las fechas'; s.appendChild(t2); } });
    /* validación en el pie */
    var ft = $('v2Foot') || modal.querySelector('[onclick*="generarInformeVisita"]') && modal.querySelector('[onclick*="generarInformeVisita"]').parentNode;
    if (ft && !$('vHojaVal')) { var ul = document.createElement('ul'); ul.id = 'vHojaVal'; ul.setAttribute('aria-label', 'Validación'); ft.insertBefore(ul, ft.firstChild); }
    m.addEventListener('input', validar); m.addEventListener('change', validar);
    validar();
    new MutationObserver(function () { if (m.classList.contains('on')) { setTimeout(validar, 80); try { m.scrollTop = 0; } catch (e) {} } }).observe(m, { attributes: true, attributeFilter: ['class'] });
    console.log('[_VISITA_HOJA_V1] Nueva visita como hoja única activa (apagar: localStorage.rl_visita_hoja = "off")');
  }
  /* visitas-ui.js arma el asistente al cargar; esta hoja se monta después (reintenta hasta encontrar el pie) */
  function iniciar() { var n = 0; var t = setInterval(function () { var m = $('mVisita'); if (m && ($('v2Foot') || n > 12)) { clearInterval(t); armar(); } else if (++n > 40) clearInterval(t); }, 150); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
