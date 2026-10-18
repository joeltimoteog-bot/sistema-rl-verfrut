/* ═══════════════════════════════════════════════════════════════════════════
   _TRAB_UI_V1 (18-oct-2026) — "Trabajadores": Buscar Trabajador + Consulta por DNI
   en UNA pantalla con dos pestañas (Datos del trabajador · Historial de atenciones)
   ---------------------------------------------------------------------------
   Base: tráfico real de Firebase (6 → 18 oct): 88 + 74 aperturas, los mismos 16
   usuarios. Un módulo trae los DATOS del trabajador (BD) y el otro su HISTORIAL
   de atenciones: son las dos caras de la misma consulta.
   Qué hace (todo aditivo, ningún id ni función se cambia):
     · Dentro de #sec-trabajadores crea las pestañas y MUEVE el bloque de
       #sec-consulta (filtros + #consultaResult) a la pestaña Historial.
     · Una sola búsqueda: Buscar llama a buscarTrab() como siempre y, si lo escrito
       es un DNI de 7-8 dígitos, copia el DNI a #cDNI y llama a consultarDNI().
     · Ficha-resumen cuando la búsqueda da un solo trabajador (se lee de la tabla).
     · Botón "📋 Historial" en cada fila de la tabla de trabajadores.
     · ir('consulta') abre Trabajadores con la pestaña Historial; el botón del menú
       "Consulta por DNI" se oculta por CSS y "Buscar Trabajador" pasa a llamarse
       "Trabajadores". Los permisos por usuario (style.display de esos botones) se
       respetan: sin permiso de Consulta no hay pestaña Historial; sin permiso de
       Buscar Trabajador se abre directo en Historial.
   Para desactivar: quitar la etiqueta <script src=".../trabajadores-ui.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._TRAB_UI_V1) return;
  window._TRAB_UI_V1 = true;
  function $(id) { return document.getElementById(id); }
  function navDe(sec) { try { return document.querySelector('nav button.ni[onclick*="ir(\'' + sec + '\'"]'); } catch (e) { return null; } }
  function permitido(sec) { var b = navDe(sec); return !!b && b.style.display !== 'none'; }

  var CSS = '\
nav button.ni[onclick*="ir(\'consulta\'"]{display:none !important}\
#sec-trabajadores .card-h .card-t:after{content:" · datos del trabajador e historial de atenciones";font-weight:500;color:#64748b;font-size:12px}\
#tuTabs{display:flex;gap:4px;padding:10px 18px 0;border-bottom:1px solid var(--bd,#e2e8f0);background:#fff}\
#tuTabs button{appearance:none;border:1px solid transparent;border-bottom:none;background:transparent;padding:10px 16px;border-radius:10px 10px 0 0;font:700 13px Barlow,"Segoe UI",system-ui,sans-serif;color:#64748b;cursor:pointer;display:flex;gap:8px;align-items:center}\
#tuTabs button .n{font-size:10.5px;background:#e2e8f0;color:#334155;border-radius:999px;padding:1px 7px;min-width:14px;text-align:center}\
#tuTabs button.on{color:#0a2463;border-color:var(--bd,#e2e8f0);position:relative;top:1px;background:#fff;box-shadow:inset 0 3px 0 #d9292b}\
#tuTabs button.on .n{background:#0a2463;color:#fff}\
#tuTabs button:hover:not(.on){color:#0a2463;background:#f8fafc}\
.tu-pane{display:none}.tu-pane.on{display:block}\
#tuHist>.card{border:none;box-shadow:none;border-radius:0;margin:0}\
#tuHist>.card>.card-h{display:none}\
#tuAvz{margin:12px 18px 0;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;overflow:hidden}\
#tuAvz>summary{list-style:none;cursor:pointer;padding:10px 14px;font:800 12px Barlow,"Segoe UI",system-ui,sans-serif;color:#475569;display:flex;gap:8px;align-items:center}\
#tuAvz>summary::-webkit-details-marker{display:none}\
#tuAvz>summary:after{content:"mostrar ▾";margin-left:auto;color:#2563eb}\
#tuAvz[open]>summary:after{content:"ocultar ▴"}\
#tuAvz .filtros{padding:0 14px 12px !important;border:none !important;background:transparent !important}\
#tuFicha{display:none;margin:14px 18px 0;background:linear-gradient(135deg,#0a2463,#1e40af);color:#fff;border-radius:14px;padding:14px 18px;grid-template-columns:60px 1fr auto;gap:14px;align-items:center}\
#tuFicha.on{display:grid}\
#tuFicha .av{width:60px;height:60px;border-radius:50%;background:#fff;color:#0a2463;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:21px}\
#tuFicha b{font-size:16px;display:block;line-height:1.2}#tuFicha small{opacity:.85;font-size:12px}\
#tuFicha .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}\
#tuFicha .chip{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.18)}\
#tuFicha .acts{display:flex;flex-direction:column;gap:6px}\
#tuFicha .acts button{border:none;border-radius:9px;padding:8px 12px;font:800 12px Barlow,"Segoe UI",system-ui,sans-serif;cursor:pointer}\
#tuFicha .acts .a{background:#d9292b;color:#fff}#tuFicha .acts .b{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.35)}\
.tu-hist{margin-left:4px;background:#475569 !important;color:#fff !important;border:none;border-radius:7px;padding:5px 9px;font:700 11px Barlow,"Segoe UI",system-ui,sans-serif;cursor:pointer;white-space:nowrap}\
#tuKpi{display:none;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 18px 0}\
#tuKpi.on{display:grid}\
#tuKpi div{background:#f8fafc;border:1px solid var(--bd,#e2e8f0);border-radius:12px;padding:9px 12px}\
#tuKpi b{display:block;font-size:19px;color:#0a2463}#tuKpi span{font-size:10.5px;color:#64748b;text-transform:uppercase;font-weight:700}\
@media(max-width:700px){#tuFicha{grid-template-columns:1fr}#tuFicha .av{display:none}#tuKpi{grid-template-columns:1fr 1fr}}';
  try { var st = document.createElement('style'); st.id = 'tuCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  var armado = false, tabActiva = 'datos';
  function esDni(s) { return /^\d{7,8}$/.test(String(s || '').trim()); }

  /* ── 1) estructura: pestañas dentro de #sec-trabajadores, bloque de consulta movido ── */
  function armar() {
    if (armado) return true;
    var secT = $('sec-trabajadores'), secC = $('sec-consulta');
    if (!secT || !secC) return false;
    var card = secT.querySelector('.card'); if (!card) return false;
    var tw = card.querySelector('.tw'); if (!tw) return false;
    var cardC = secC.querySelector('.card'), res = $('consultaResult');
    if (!cardC || !res) return false;

    var tabs = document.createElement('div'); tabs.id = 'tuTabs';
    tabs.innerHTML = '<button type="button" data-t="datos" id="tuTabDatos">👤 Datos del trabajador <span class="n" id="tuNDatos">–</span></button>' +
                     '<button type="button" data-t="hist" id="tuTabHist">📋 Historial de atenciones <span class="n" id="tuNHist">–</span></button>';
    tabs.querySelectorAll('button').forEach(function (b) { b.onclick = function () { mostrar(b.getAttribute('data-t')); }; });

    var paneD = document.createElement('div'); paneD.id = 'tuDatos'; paneD.className = 'tu-pane on';
    var ficha = document.createElement('div'); ficha.id = 'tuFicha';
    paneD.appendChild(ficha);
    try { var ct = card.querySelector('.card-h .card-t'); if (ct && /Buscar Trabajador/i.test(ct.textContent)) ct.textContent = 'Trabajadores'; } catch (e) {}
    card.insertBefore(tabs, tw);
    card.insertBefore(paneD, tw);
    paneD.appendChild(tw);                       /* la tabla de hoy, tal cual, dentro de la pestaña Datos */

    var paneH = document.createElement('div'); paneH.id = 'tuHist'; paneH.className = 'tu-pane';
    var kpi = document.createElement('div'); kpi.id = 'tuKpi';
    var avz = document.createElement('details'); avz.id = 'tuAvz';
    avz.innerHTML = '<summary>⚙️ Búsqueda avanzada: DNI, fechas, responsable de recepción y año</summary>';
    avz.appendChild(cardC);                      /* filtros originales (cDNI, fechas, responsable, Consultar, Excel) */
    paneH.appendChild(kpi); paneH.appendChild(avz); paneH.appendChild(res);
    card.appendChild(paneH);

    /* buscar: Enter en el campo ya llama a buscarTrab(); el boton tambien. Se envuelve buscarTrab para la busqueda doble */
    armado = true;
    observarTabla(); observarHistorial();
    renombrarMenu();
    return true;
  }

  function mostrar(t) {
    if (t === 'hist' && !permitido('consulta')) t = 'datos';
    if (t === 'datos' && !permitido('trabajadores') && permitido('consulta')) t = 'hist';
    tabActiva = t;
    var bd = $('tuTabDatos'), bh = $('tuTabHist');
    if (bd) bd.classList.toggle('on', t === 'datos');
    if (bh) bh.classList.toggle('on', t === 'hist');
    var pd = $('tuDatos'), ph = $('tuHist');
    if (pd) pd.classList.toggle('on', t === 'datos');
    if (ph) ph.classList.toggle('on', t === 'hist');
    if (t === 'hist') { try { var a = $('tuAvz'), rs = $('consultaResult'); if (a && (!rs || !rs.children.length)) a.open = true; } catch (e) {} }
  }
  function permisos() {
    var bh = $('tuTabHist'), bd = $('tuTabDatos');
    if (bh) bh.style.display = permitido('consulta') ? '' : 'none';
    if (bd) bd.style.display = permitido('trabajadores') ? '' : 'none';
    if (tabActiva === 'hist' && !permitido('consulta')) mostrar('datos');
    if (tabActiva === 'datos' && !permitido('trabajadores') && permitido('consulta')) mostrar('hist');
  }

  /* ── 2) menú: "Buscar Trabajador" → "Trabajadores"; "Consulta por DNI" oculto por CSS ── */
  function renombrarMenu() {
    try {
      var b = navDe('trabajadores'); if (!b || b._tuNombre) return;
      for (var i = 0; i < b.childNodes.length; i++) { var n = b.childNodes[i]; if (n.nodeType === 3 && /Buscar Trabajador/i.test(n.nodeValue)) { n.nodeValue = n.nodeValue.replace(/Buscar Trabajador/i, 'Trabajadores'); b._tuNombre = true; } }
    } catch (e) {}
  }

  /* ── 3) una sola búsqueda: buscarTrab() + consultarDNI() si es DNI ── */
  function envolverBuscar() {
    var previo = window.buscarTrab;
    if (typeof previo !== 'function' || previo._tuWrap) return;
    var w = function () {
      var r = previo.apply(this, arguments);
      try {
        var q = String((($('fTQ') || {}).value) || '').trim();
        if (esDni(q) && permitido('consulta') && typeof window.consultarDNI === 'function') {
          var c = $('cDNI'); if (c) c.value = q;
          setTimeout(function () { try { window.consultarDNI(); } catch (e) {} }, 60);
        }
        if (tabActiva !== 'datos' && permitido('trabajadores')) mostrar('datos');
      } catch (e) {}
      return r;
    };
    w._tuWrap = true;
    window.buscarTrab = w; try { buscarTrab = w; } catch (e) {}
  }
  function verHistorial(dni) {
    try {
      var c = $('cDNI'); if (c) c.value = dni;
      mostrar('hist');
      if (typeof window.consultarDNI === 'function') window.consultarDNI();
    } catch (e) {}
  }
  window.rlTrabajadores = { mostrar: mostrar, verHistorial: verHistorial };

  /* ── 4) tabla de trabajadores: contador, boton Historial por fila y ficha-resumen ── */
  function filasDatos() {
    var tb = $('tbTrab'); if (!tb) return [];
    return Array.prototype.filter.call(tb.querySelectorAll('tr'), function (tr) { return tr.children.length >= 10 && !tr.querySelector('td.empty, td[colspan]'); });
  }
  function decorarTabla() {
    var filas = filasDatos();
    var n = $('tuNDatos'); if (n) n.textContent = filas.length ? String(filas.length) : '–';
    if (permitido('consulta')) filas.forEach(function (tr) {
      var td = tr.lastElementChild; if (!td || td.querySelector('.tu-hist')) return;
      var dni = (tr.children[0].textContent || '').trim(); if (!/^\d{7,8}$/.test(dni)) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tu-hist'; b.textContent = '📋 Historial'; b.title = 'Ver historial de atenciones de este trabajador';
      b.onclick = function (ev) { ev.stopPropagation(); verHistorial(dni); };
      td.appendChild(b);
    });
    ficha(filas);
  }
  function txt(tr, i) { try { return (tr.children[i].textContent || '').trim(); } catch (e) { return ''; } }
  function ficha(filas) {
    var f = $('tuFicha'); if (!f) return;
    if (filas.length !== 1) { f.classList.remove('on'); f.innerHTML = ''; return; }
    var tr = filas[0];
    var dni = txt(tr, 0), nom = txt(tr, 1), sexo = txt(tr, 2), emp = txt(tr, 3), cargo = txt(tr, 4), fundo = txt(tr, 5), fundoAct = txt(tr, 6), ruta = txt(tr, 7), cod = txt(tr, 8), cumple = txt(tr, 9), reg = txt(tr, 10), fi = txt(tr, 11), ft = txt(tr, 12);
    var ini = nom.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase() || '👤';
    var chips = [];
    if (ruta && ruta !== '-' && ruta !== '—') chips.push('🚌 Ruta ' + ruta);
    if (cod && cod !== '-' && cod !== '—') chips.push('🪪 Cód. ' + cod);
    if (reg && reg !== '-' && reg !== '—') chips.push(reg);
    if (fi || ft) chips.push('📅 Periodo ' + (fi || '…') + ' → ' + (ft || '…'));
    if (cumple && cumple !== '-' && cumple !== '—') chips.push('🎂 ' + cumple);
    if (sexo) chips.push(sexo === 'F' || /^fem/i.test(sexo) ? '♀ Femenino' : (sexo === 'M' || /^mas/i.test(sexo) ? '♂ Masculino' : sexo));
    f.innerHTML = '<div class="av"></div><div><b></b><small></small><div class="chips"></div></div><div class="acts"></div>';
    f.querySelector('.av').textContent = ini;
    f.querySelector('b').textContent = nom;
    f.querySelector('small').textContent = 'DNI ' + dni + (emp ? ' · ' + emp : '') + (cargo ? ' · ' + cargo : '') + (fundo ? ' · ' + fundo : '') + (fundoAct && fundoAct !== fundo ? ' (actual: ' + fundoAct + ')' : '');
    var ch = f.querySelector('.chips'); chips.forEach(function (c) { var s = document.createElement('span'); s.className = 'chip'; s.textContent = c; ch.appendChild(s); });
    var acts = f.querySelector('.acts');
    var bAt = tr.querySelector('button[onclick^="regAt"]');
    if (bAt) { var a = document.createElement('button'); a.className = 'a'; a.textContent = '➕ Nueva atención'; a.onclick = function () { try { bAt.click(); } catch (e) {} }; acts.appendChild(a); }
    if (permitido('consulta')) { var h = document.createElement('button'); h.className = 'b'; h.textContent = '📋 Ver historial'; h.onclick = function () { verHistorial(dni); }; acts.appendChild(h); }
    f.classList.add('on');
  }
  function observarTabla() {
    var tb = $('tbTrab'); if (!tb) return;
    decorarTabla();
    try { new MutationObserver(function () { decorarTabla(); }).observe(tb, { childList: true, subtree: true }); } catch (e) {}
  }

  /* ── 5) historial: contador en la pestaña + 4 cifras (solo lectura del resultado) ── */
  function resumenHistorial() {
    var res = $('consultaResult'), n = $('tuNHist'), k = $('tuKpi'); if (!res || !n || !k) return;
    var filas = Array.prototype.filter.call(res.querySelectorAll('tbody tr'), function (tr) { return tr.children.length >= 4 && !tr.querySelector('td[colspan]'); });
    if (!filas.length) { n.textContent = res.textContent.trim() && !/Consultando/.test(res.textContent) ? '0' : '–'; k.classList.remove('on'); k.innerHTML = ''; return; }
    n.textContent = String(filas.length);
    var proc = 0, fin = 0, ult = '';
    filas.forEach(function (tr) {
      var t = Array.prototype.map.call(tr.children, function (c) { return (c.textContent || '').trim(); }).join(' | ');
      if (/EN PROCESO/i.test(t)) proc++; else if (/FINALIZAD/i.test(t)) fin++;
      var m = t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/); if (m) { var iso = m[3] + m[2] + m[1]; if (iso > (ult || '')) ult = iso; }
    });
    var ultTxt = ult ? ult.slice(6, 8) + '/' + ult.slice(4, 6) + '/' + ult.slice(0, 4) : '—';
    k.innerHTML = '<div><b>' + filas.length + '</b><span>Atenciones</span></div><div><b>' + proc + '</b><span>En proceso</span></div><div><b>' + fin + '</b><span>Finalizadas</span></div><div><b style="font-size:15px">' + ultTxt + '</b><span>Más reciente</span></div>';
    k.classList.add('on');
  }
  function observarHistorial() {
    var res = $('consultaResult'); if (!res) return;
    resumenHistorial();
    try { new MutationObserver(function () { resumenHistorial(); }).observe(res, { childList: true, subtree: true }); } catch (e) {}
  }

  /* ── 6) ir('consulta') → Trabajadores con la pestaña Historial; título de la barra ── */
  function envolverIr() {
    var previo = window.ir;
    if (typeof previo !== 'function' || previo._tuWrap) return;
    var w = function (id, btn) {
      if (id === 'consulta' && armado) {
        try { var k = '_trf_sec_consulta', ult = Number(sessionStorage.getItem(k) || 0);
          if ((Date.now() - ult) > 45000 && window.RLTrafico && window.RLTrafico.emit) { sessionStorage.setItem(k, String(Date.now())); window.RLTrafico.emit({ accion: 'Abrió Consulta por DNI', destino: 'Firebase', tipo: 'nav' }); } } catch (e) {}
        var r = previo.call(this, 'trabajadores', navDe('trabajadores') || btn);
        setTimeout(function () { mostrar('hist'); titulo(); }, 0);
        return r;
      }
      var r2 = previo.apply(this, arguments);
      if (id === 'trabajadores') setTimeout(function () { permisos(); titulo(); if (!permitido('trabajadores') && permitido('consulta')) mostrar('hist'); }, 0);
      return r2;
    };
    w._tuWrap = true;
    window.ir = w; try { ir = w; } catch (e) {}
  }
  function titulo() { try { var t = $('tbT'); if (t && /BUSCAR TRABAJADOR|CONSULTA POR DNI/.test(t.textContent)) t.textContent = 'TRABAJADORES'; } catch (e) {} }

  function iniciar() {
    if (!armar()) return;
    envolverBuscar(); envolverIr(); permisos(); titulo();
    try {
      var bt = navDe('trabajadores'), bc = navDe('consulta');
      [bt, bc].forEach(function (b) { if (b) new MutationObserver(function () { permisos(); decorarTabla(); }).observe(b, { attributes: true, attributeFilter: ['style'] }); });
    } catch (e) {}
    var n = 0, t = setInterval(function () { envolverBuscar(); envolverIr(); renombrarMenu(); permisos(); if (++n > 20) clearInterval(t); }, 1500);
    console.log('[_TRAB_UI_V1] listo: Trabajadores = datos + historial en una pantalla');
  }
  function arrancar() { if (!iniciarUnaVez()) { var n = 0, t = setInterval(function () { if (iniciarUnaVez() || ++n > 20) clearInterval(t); }, 500); } }
  var _ini = false; function iniciarUnaVez() { if (_ini) return true; if (!$('sec-trabajadores') || !$('sec-consulta')) return false; _ini = true; iniciar(); return true; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
