/* ═════════════════════════════════════════════════════════════════════════
   _AT_HOJA_V1 (02-nov-2026) — "Nueva atención" como hoja única corporativa
   ---------------------------------------------------------------------------
   El formulario de atención (modal #mAt) pasa a verse como UNA sola hoja a pantalla completa:
   encabezado, A · Trabajador (6 columnas), B · Datos de la atención, C · Cierre con validación en
   vivo y botones. NO cambia ningún id, función ni regla: los módulos 11, 12, 14, 17, 23, 58, 60
   siguen operando igual; solo cambia la presentación (CSS + textos de sección + barra de validación).
   INTERRUPTOR: localStorage.rl_at_hoja = 'off' → vuelve al modal de siempre sin publicar nada.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._AT_HOJA_V1) return; window._AT_HOJA_V1 = true;
  try { if (localStorage.getItem('rl_at_hoja') === 'off') { console.log('[_AT_HOJA_V1] apagado por localStorage.rl_at_hoja'); return; } } catch (e) {}

  var CSS = [
    '#mAt.hoja{background:#EEF1F5;align-items:flex-start;justify-content:center;overflow-y:auto;padding:22px 24px}',
    '#mAt.hoja .modal{width:100%;max-width:1376px;max-height:none;padding:0;border-radius:10px;border:1px solid #D6DEE9;animation:none;box-shadow:0 10px 30px rgba(15,39,72,.10);font-family:Inter,"Segoe UI",Arial,sans-serif}',
    '#mAt.hoja .modal-t{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0;padding:16px 24px;border-bottom:1px solid #E6EBF2;font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:19px;font-weight:700;color:#0F2748}',
    '#mAt.hoja .hoja-sub{font-size:12.5px;font-weight:400;color:#5B6B82;flex-basis:100%;margin-top:-6px}',
    '#mAt.hoja .hoja-dcha{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600}',
    '#mAt.hoja .hoja-nro{font-family:Consolas,"Courier New",monospace;font-size:13px;font-weight:700;color:#0F2748;background:#F3F5F8;border:1px solid #D6DEE9;padding:5px 10px;border-radius:6px}',
    '#mAt.hoja .hoja-est{color:#0F6B3A;background:#E4F4EA;padding:5px 10px;border-radius:6px}',
    '#mAt.hoja .sep{display:flex;align-items:center;gap:10px;margin:14px 24px 2px;padding:0;border:0;font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.8px;color:#0F2748;text-transform:uppercase}',
    '#mAt.hoja .sep::after{content:"";flex:1;height:1px;background:#E6EBF2}',
    '#mAt.hoja .sep .hoja-tag{font-size:11px;font-weight:600;color:#1E4E8C;background:#E8F0FB;padding:3px 8px;border-radius:4px;letter-spacing:0;text-transform:none}',
    '#mAt.hoja .fg3{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 14px;padding:10px 24px 14px}',
    '#mAt.hoja .fg1{padding:0 24px 16px;margin-top:0!important}',
    '#mAt.hoja .fc label{font-size:11px;font-weight:700;color:#5B6B82;letter-spacing:.4px;text-transform:uppercase;font-family:Inter,"Segoe UI",Arial,sans-serif}',
    '#mAt.hoja .fc input,#mAt.hoja .fc select,#mAt.hoja .fc textarea{height:40px;padding:0 10px;border:1.5px solid #B8C4D6;border-radius:6px;font-size:14px;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#1F2937;background:#fff;box-sizing:border-box}',
    '#mAt.hoja .fc textarea{height:auto;min-height:78px;padding:10px}',
    '#mAt.hoja .fc input:focus,#mAt.hoja .fc select:focus,#mAt.hoja .fc textarea:focus{border-color:#0F2748;box-shadow:0 0 0 3px rgba(15,39,72,.10)}',
    '#mAt.hoja .fc input.hoja-padron{background:#F3F5F8;border-color:#D6DEE9}',
    '#mAt.hoja #at_dni{font-size:15px;font-weight:600;letter-spacing:1px;border-color:#0F2748}',
    '#mAt.hoja #at_resp{height:40px!important;padding:0 10px!important;border:1.5px solid #D6DEE9!important;border-radius:6px!important;font-size:14px!important;background:#F3F5F8!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important}',
    '#mAt.hoja .hoja-doc{grid-column:span 6;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px 14px;align-items:start}',
    '#mAt.hoja .hoja-doc > label,#mAt.hoja .hoja-doc > #at_doc_wrap,#mAt.hoja .hoja-doc > #at_doc_manual_btn,#mAt.hoja .hoja-doc > #at_cg_panel,#mAt.hoja .hoja-doc > #at_doc_manual_form{grid-column:span 6}',
    '#mAt.hoja .hoja-doc > .fc{grid-column:span 2;margin-top:0!important}',
    '#mAt.hoja .hoja-doc > .fc select,#mAt.hoja .hoja-doc > .fc input{width:100%}',
    '#mAt.hoja #at_doc_txt{height:40px;border:1.5px solid #0F2748;font-weight:600}',
    '#mAt.hoja .modal-ft{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0;padding:14px 24px;border-top:1px solid #E6EBF2;background:#F8FAFC;border-radius:0 0 10px 10px;position:sticky;bottom:0}',
    '#mAt.hoja #atHojaVal{display:flex;gap:8px;flex-wrap:wrap;font-size:12.5px;margin:0;padding:0;list-style:none}',
    '#mAt.hoja #atHojaVal li{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;font-weight:600}',
    '#mAt.hoja #atHojaVal li.ok{color:#0F6B3A;background:#E4F4EA}#mAt.hoja #atHojaVal li.falta{color:#9A4A00;background:#FFF1DE}',
    '#mAt.hoja .hoja-quien{margin-left:auto;font-size:11.5px;color:#5B6B82}',
    '#mAt.hoja .modal-ft .btn-save{height:42px;padding:0 22px;border:0;border-radius:6px;background:#0F2748;color:#fff;font-size:14px;font-weight:700;font-family:Inter,"Segoe UI",Arial,sans-serif;cursor:pointer}',
    '#mAt.hoja .modal-ft .btn-cancel{height:42px;padding:0 16px;border:1.5px solid #B8C4D6;border-radius:6px;background:#fff;color:#5B6B82;font-size:13px;font-weight:600;font-family:Inter,"Segoe UI",Arial,sans-serif;cursor:pointer}',
    '#mAt.hoja #trabRes{margin-top:6px}#mAt.hoja #historialDniAlerta{margin-top:8px}',
    '#mAt.hoja #atSuccessMsg{margin:0 24px 12px!important}',
    '@media (max-width:1100px){#mAt.hoja .fg3,#mAt.hoja .hoja-doc{grid-template-columns:repeat(3,minmax(0,1fr))}#mAt.hoja .fg3>.fc{grid-column:span 1!important}#mAt.hoja .hoja-doc{grid-column:span 3}#mAt.hoja .hoja-doc>label,#mAt.hoja .hoja-doc>#at_doc_wrap,#mAt.hoja .hoja-doc>#at_doc_manual_btn,#mAt.hoja .hoja-doc>#at_cg_panel,#mAt.hoja .hoja-doc>#at_doc_manual_form{grid-column:span 3}#mAt.hoja .hoja-doc>.fc{grid-column:span 1}}',
    '@media (max-width:700px){#mAt.hoja{padding:0}#mAt.hoja .modal{border-radius:0}#mAt.hoja .fg3,#mAt.hoja .hoja-doc{grid-template-columns:1fr!important}#mAt.hoja .fg3>.fc,#mAt.hoja .hoja-doc,#mAt.hoja .hoja-doc>*{grid-column:span 1!important}}'
  ].join('\n');

  function $(id) { return document.getElementById(id); }
  function fcDe(id) { var el = $(id); return el ? el.closest('.fc') : null; }
  function span(id, n) { var c = fcDe(id); if (c) c.style.gridColumn = 'span ' + n; }
  function v(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; }
  function visible(el) { return !!(el && el.offsetParent !== null && el.style.display !== 'none'); }
  var PADRON = ['at_nom', 'at_fip', 'at_ftp', 'at_fundo', 'at_cargo', 'at_ruta', 'at_cod'];

  function armar() {
    var m = $('mAt'); if (!m || m.dataset.hoja) return; m.dataset.hoja = '1';
    var st = document.createElement('style'); st.id = 'atHojaCss'; st.textContent = CSS; document.head.appendChild(st);
    m.classList.add('hoja');
    /* encabezado */
    var t = m.querySelector('.modal-t');
    if (t && !t.querySelector('.hoja-dcha')) {
      var d = document.createElement('div'); d.className = 'hoja-dcha';
      d.innerHTML = '<span class="hoja-nro" id="atHojaNro">N° se asigna al guardar</span><span class="hoja-est" id="atHojaEstado">Borrador · sin guardar</span>';
      t.appendChild(d);
      var sub = document.createElement('div'); sub.className = 'hoja-sub'; sub.textContent = 'Una sola hoja: trabajador, atención y cierre. Se guarda en Supabase al instante; la copia en Google se genera sola.';
      t.appendChild(sub);
    }
    /* secciones */
    var seps = m.querySelectorAll('.sep');
    if (seps[0]) { seps[0].textContent = 'A · Trabajador'; var tag = document.createElement('span'); tag.className = 'hoja-tag'; tag.textContent = 'Datos del padrón · Supabase'; seps[0].appendChild(tag); }
    if (seps[1]) seps[1].textContent = 'B · Datos de la atención';
    /* distribución en 6 columnas */
    span('at_dni', 2); span('at_nom', 2); span('at_emp', 1); span('at_sex', 1);
    span('at_fip', 1); span('at_ftp', 1); span('at_fundo', 2); span('at_cargo', 2);
    span('at_ruta', 1); span('at_cod', 1); span('at_fac', 1); span('at_cel', 1);
    span('at_fec', 1); span('at_hi', 1); span('at_ht', 1);
    var doc = fcDe('at_doc_txt'); if (doc) { doc.classList.add('hoja-doc'); doc.style.gridColumn = 'span 6'; }
    span('at_fid', 1); span('at_ftd', 1); span('at_dias', 1); span('at_resp', 2); span('at_est', 1);
    PADRON.forEach(function (id) { var el = $(id); if (el) el.classList.add('hoja-padron'); });
    /* cierre: validación en vivo + quién registra */
    var ft = m.querySelector('.modal-ft');
    if (ft && !$('atHojaVal')) {
      var ul = document.createElement('ul'); ul.id = 'atHojaVal'; ul.setAttribute('aria-label', 'Validación');
      ft.insertBefore(ul, ft.firstChild);
      var q = document.createElement('span'); q.className = 'hoja-quien';
      var u = (window.USER && (USER.usuario || USER.nombre)) || ''; q.textContent = u ? 'Registra ' + u : '';
      ft.insertBefore(q, ul.nextSibling);
    }
    m.addEventListener('input', validar); m.addEventListener('change', validar);
    validar();
    console.log('[_AT_HOJA_V1] formulario de atención en hoja única (apagar: localStorage.rl_at_hoja = "off")');
  }

  var OK = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 13l4 4L19 7"></path></svg>';
  var AT = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16h.01"></path></svg>';
  function validar() {
    var ul = $('atHojaVal'); if (!ul) return;
    var docTxt = v('at_doc_txt') || v('at_doc'), enProceso = /PROCESO/i.test(v('at_est'));
    var items = [
      ['Trabajador', /^\d{8}$/.test(v('at_dni')) && !!v('at_nom')],
      ['Documento', !!v('at_doc')]
    ];
    var tl = $('at_tlic2_wrap'); if (visible(tl)) items.push(['Tipo de licencia', !!v('at_tlic2') && (v('at_tlic2') !== '__OTRO__' || !!v('at_tlic2_otro'))]);
    var nl = $('at_nlic_wrap'); var licOblig = false; try { licOblig = typeof window._licenciaObligatoria === 'function' && !enProceso && window._licenciaObligatoria(docTxt); } catch (e) {}
    if (visible(nl) || licOblig) items.push(['N° de licencia', !!v('at_nlic') || enProceso]);
    var pa = $('at_parentesco_wrap'); if (visible(pa)) items.push(['Parentesco', !!v('at_parentesco')]);
    items.push(['Responsable', !!v('at_resp')]);
    ul.innerHTML = items.map(function (it) { return '<li class="' + (it[1] ? 'ok' : 'falta') + '">' + (it[1] ? OK : AT) + (it[1] ? '' : 'Falta ') + it[0] + '</li>'; }).join('');
    var est = $('atHojaEstado'); if (est) { var nro = v('at_nro_edit'); est.textContent = nro ? 'Editando N° ' + nro : 'Borrador · sin guardar'; var n = $('atHojaNro'); if (n) n.textContent = nro ? 'N° ' + nro : 'N° se asigna al guardar'; }
  }
  /* al abrir el modal (abrirAt / editar) se vuelve a validar y se sube al inicio de la hoja */
  var obs = new MutationObserver(function () { var m = $('mAt'); if (m && m.classList.contains('on')) { setTimeout(validar, 60); try { m.scrollTop = 0; } catch (e) {} } });
  function iniciar() { var m = $('mAt'); if (!m) return; armar(); obs.observe(m, { attributes: true, attributeFilter: ['class'] }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
