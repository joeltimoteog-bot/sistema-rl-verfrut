/* ═══════════════════════════════════════════════════════════════════════════
   _UI_PIEL_V1 (15-oct-2026) — piel moderna del dashboard: tablas, modales, Mis Atenciones y menu
   ---------------------------------------------------------------------------
   Solo presentacion. No cambia ninguna funcion de carga, guardado ni permisos:
     A) CSS: tarjetas, tablas (cabecera fija, cebra, hover), chips de estado/empresa, botones de
        accion redondos, modales con titulo y botonera fijos, campos de formulario.
     B) Mis Atenciones: barra de busqueda + filtros en una sola fila con contador; el boton "Ver"
        pasa a icono con tooltip (se envuelve renderAt: misma funcion, mismo resultado).
     C) Menu lateral: los MISMOS botones (mismos id/onclick) agrupados en secciones
        (Principal / Operacion / Analisis / Sistema ETI / Administracion), icono con fondo,
        titulo de seccion oculto si no queda ningun boton visible (respeta Acceso a Modulos),
        y modo compacto (solo iconos) recordado por usuario.
   Si algo falla, no se toca nada. Para desactivar: quitar el <script src=".../ui-piel.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._UI_PIEL_V1) return;
  window._UI_PIEL_V1 = true;
  function $(id) { return document.getElementById(id); }

  var CSS = '\
/* A) base */\
.card{border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,.04)}\
.card-h{padding:14px 18px}\
.card-t{font-size:14px;font-weight:800}\
.btn-n{border-radius:9px;padding:8px 14px;font-size:12px;box-shadow:0 4px 12px rgba(220,38,38,.25)}\
.btn-n:hover{transform:translateY(-1px)}\
.filtros{padding:10px 18px;gap:8px}\
.fi{border-radius:9px;padding:8px 12px;background:#fff}\
.fi:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}\
.tw{overflow:auto;max-height:72vh}\
.tw thead th{position:sticky;top:0;z-index:2;background:#f3f6fb;font-size:9.5px;letter-spacing:1.2px;color:#475569;border-bottom:1px solid #dbe3f0;padding:10px 12px}\
.tw tbody tr:nth-child(even) td{background:#fafbfe}\
.tw tbody tr:hover td{background:#eef4ff}\
td{padding:9px 12px;font-size:11.5px}\
.bg{padding:3px 9px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.2px;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}\
.bg:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.8}\
.btn-a{border-radius:8px;padding:5px 9px;font-size:11px;margin-right:3px;transition:transform .12s,box-shadow .12s}\
.btn-a:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(15,23,42,.15)}\
.btn-a.ui-ico{width:30px;height:28px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:13px}\
.empty{padding:36px;font-size:13px}\
/* modales: titulo y botonera siempre visibles */\
.modal{padding:0 28px 0;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.4)}\
.modal>:first-child:not(.modal-t){margin-top:24px}.modal>:last-child:not(.modal-ft){margin-bottom:24px}\
.modal-t{position:sticky;top:0;z-index:6;background:#fff;margin:0 -28px 16px;padding:18px 28px 12px;border-bottom:1px solid #e8edf5;font-size:21px;display:flex;align-items:center;gap:10px}\
.modal-t:before{content:"";width:6px;height:22px;border-radius:4px;background:linear-gradient(180deg,#0a2463,#2563eb)}\
.modal-ft{position:sticky;bottom:0;z-index:6;background:#fff;margin:20px -28px 0;padding:12px 28px 14px;border-top:1px solid #e8edf5;box-shadow:0 -8px 20px rgba(15,23,42,.04)}\
.btn-save{border-radius:10px;padding:9px 20px;background:linear-gradient(90deg,#0a2463,#1d4ed8);box-shadow:0 8px 18px rgba(30,58,138,.25)}\
.btn-save:hover{transform:translateY(-1px)}\
.btn-cancel{border-radius:10px}\
.sep{display:flex;align-items:center;gap:8px;border-bottom:1px solid #e8edf5;padding-bottom:6px}\
.sep:before{content:"";width:8px;height:8px;border-radius:50%;background:#2563eb}\
.fc input,.fc select,.fc textarea{border-radius:9px;border-width:1.5px;background:#fff}\
.fc input:focus,.fc select:focus,.fc textarea:focus{box-shadow:0 0 0 3px rgba(37,99,235,.12)}\
/* B) Mis Atenciones */\
#uiAtBar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--bd,#e2e8f0);background:#fff}\
#uiAtBar #fAQ{flex:1 1 260px;margin:0 !important;border-radius:10px !important;padding:9px 12px 9px 36px !important;background:#fff url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.4\' stroke-linecap=\'round\'><circle cx=\'11\' cy=\'11\' r=\'7\'/><line x1=\'21\' y1=\'21\' x2=\'16.5\' y2=\'16.5\'/></svg>") no-repeat 12px center !important}\
#uiAtBar .filtros{padding:0;border:0;flex:0 0 auto}\
#uiAtCount{margin-left:auto;font-size:12px;color:#475569;font-weight:700;background:#f1f5f9;border-radius:999px;padding:5px 11px;white-space:nowrap}\
#uiAtCount b{color:#0a2463}\
#sec-atenciones .ui-info{font-size:12px;color:#475569;background:#f6f8fc;border:1px solid #e6ebf4;border-radius:10px;padding:7px 12px;margin:10px 18px 0}\
/* C) menu */\
.nav .ui-g{margin-bottom:6px}\
.nav .ui-gt{font-size:10px;font-weight:800;letter-spacing:1.6px;color:rgba(255,255,255,.35);text-transform:uppercase;padding:0 10px;margin:12px 0 5px}\
.nav .ui-g.ui-vacio{display:none}\
.ni{border-radius:9px;padding:7px 9px;gap:10px}\
.ni .ic{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.08);display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex:none;transition:background .2s}\
.ni:hover .ic{background:rgba(255,255,255,.16)}\
.ni.on{background:var(--rojo);box-shadow:0 6px 16px rgba(220,38,38,.35)}\
.ni.on .ic{background:rgba(255,255,255,.22)}\
.nav .ns{display:none}\
#uiSbToggle{position:absolute;right:-13px;top:70px;width:26px;height:26px;border-radius:50%;border:2px solid var(--azul);background:#fff;color:var(--azul);font-size:12px;font-weight:800;cursor:pointer;z-index:101;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}\
body.ui-compacto{--sw:70px}\
body.ui-compacto .sb-hdr .sb-logo>div,body.ui-compacto .sb-usr>div:not(.av),body.ui-compacto .nav .ui-gt{display:none}\
body.ui-compacto .sb-hdr{padding:16px 10px}body.ui-compacto .sb-usr{justify-content:center;padding:12px 8px}\
body.ui-compacto .sb-logo img{height:28px !important}\
body.ui-compacto .ni{font-size:0 !important;justify-content:center;padding:7px 0}\
body.ui-compacto .ni .ic{font-size:15px}\
body.ui-compacto .ni span:not(.ic){display:none}\
body.ui-compacto .nav{padding:10px 6px}body.ui-compacto .sb-ft{padding:10px 6px}\
body.ui-compacto .sb-ft .logout{font-size:0;justify-content:center}body.ui-compacto .sb-ft .logout span{font-size:15px}\
@media(max-width:900px){#uiSbToggle{display:none}}';

  function css() { var st = document.createElement('style'); st.id = 'uiPielCss'; st.textContent = CSS; document.head.appendChild(st); }

  /* ── B) Mis Atenciones ── */
  function atenciones() {
    var sec = $('sec-atenciones'), q = $('fAQ'); if (!sec || !q || $('uiAtBar')) return;
    var filtros = sec.querySelector('.filtros'), card = sec.querySelector('.card');
    var info = q.previousElementSibling; if (info && /Solo se muestran/.test(info.textContent)) { info.className = 'ui-info'; info.removeAttribute('style'); }
    var bar = document.createElement('div'); bar.id = 'uiAtBar';
    q.parentNode.insertBefore(bar, q);
    bar.appendChild(q); if (filtros) bar.appendChild(filtros);
    try { q.placeholder = String(q.placeholder || '').replace(/^\s*🔍\s*/, '') || 'Buscar por DNI o nombre…'; } catch (e) {}
    var cnt = document.createElement('span'); cnt.id = 'uiAtCount'; cnt.innerHTML = '<b>–</b> atenciones'; bar.appendChild(cnt);
    if (info && card) card.insertBefore(info, bar);
    var prev = window.renderAt;
    if (typeof prev === 'function') {
      window.renderAt = function (lista) {
        var r = prev.apply(this, arguments);
        try { var n = (lista && lista.length) || 0; cnt.innerHTML = '<b>' + n + '</b> ' + (n === 1 ? 'atención' : 'atenciones'); } catch (e) {}
        setTimeout(iconos, 30);
        return r;
      };
      try { renderAt = window.renderAt; } catch (e) {}
    }
    function iconos() {
      try {
        sec.querySelectorAll('#tbAt .btn-a').forEach(function (b) {
          if (b.classList.contains('ui-ico')) return;
          var t = (b.textContent || '').trim();
          if (t === 'Ver') { b.textContent = '👁'; b.title = 'Ver detalle'; }
          else if (t === '✏️') b.title = b.title || 'Editar';
          b.classList.add('ui-ico');
        });
      } catch (e) {}
    }
    try { new MutationObserver(function () { setTimeout(iconos, 0); }).observe($('tbAt'), { childList: true }); } catch (e) {}
  }

  /* ── C) menu agrupado ── */
  var GRUPOS = [
    { n: 'Principal', c: ['mod_dashboard', 'navAt', 'mod_trabajadores', 'mod_consulta', 'mod_consulta-masiva', 'navMisEstadisticas'] },
    { n: 'Operación', c: ['navCorreo', 'navVisitas', 'navCasos', 'navFusiones', 'mod_capacitaciones', 'navMantenimiento', 'navSolicitudes', 'navHoras', 'navAlmuerzos', 'navInventario', 'navPreaviso', 'navCalcRemu', 'navBienestar'] },
    { n: 'Análisis', c: ['navRes', 'navEstadisticas', 'navKpis', 'navEval360'] },
    { n: 'Sistema ETI', c: ['navProgEti', 'navAppEti'] },
    { n: 'Administración', c: ['navUsr', 'navPermisos', 'navMonitor', 'navFbAlertas'] }
  ];
  function claveDe(b) {
    if (b.id) return b.id;
    var oc = b.getAttribute('onclick') || '', m = oc.match(/ir\('([^']+)'/) || oc.match(/location\.href='([^']+?)(\.html)?'/);
    return m ? 'mod_' + m[1].replace(/[^A-Za-z0-9_-]/g, '') : '';
  }
  var _grupos = {};
  function menu() {
    var nav = document.querySelector('#sb .nav'); if (!nav || nav.querySelector('.ui-g')) return;
    var botones = Array.prototype.slice.call(nav.querySelectorAll('button.ni'));
    var porClave = {}; botones.forEach(function (b) { porClave[claveDe(b)] = b; });
    var usados = {};
    GRUPOS.forEach(function (g) {
      var wrap = document.createElement('div'); wrap.className = 'ui-g'; wrap.setAttribute('data-g', g.n);
      wrap.innerHTML = '<div class="ui-gt">' + g.n + '</div>';
      var n = 0;
      g.c.forEach(function (k) { var b = porClave[k]; if (b && !usados[k]) { usados[k] = 1; wrap.appendChild(b); n++; } });
      if (n) { nav.appendChild(wrap); _grupos[g.n] = wrap; }
    });
    /* botones que no esten en la lista (nuevos): grupo "Otros" al final */
    var otros = botones.filter(function (b) { return !usados[claveDe(b)]; });
    if (otros.length) { var w = document.createElement('div'); w.className = 'ui-g'; w.innerHTML = '<div class="ui-gt">Otros</div>'; otros.forEach(function (b) { w.appendChild(b); }); nav.appendChild(w); _grupos.Otros = w; }
    vacios();
    try { new MutationObserver(function () { vacios(); }).observe(nav, { attributes: true, subtree: true, childList: true, attributeFilter: ['style'] }); } catch (e) {}
  }
  /* navPermisos se crea despues (1.5 s): si aparece suelto, se lleva a Administracion */
  function adoptar() {
    try {
      var nav = document.querySelector('#sb .nav'); if (!nav) return;
      Array.prototype.slice.call(nav.children).forEach(function (el) {
        if (el.tagName === 'BUTTON' && el.classList.contains('ni')) {
          var k = claveDe(el), dest = null;
          GRUPOS.forEach(function (g) { if (g.c.indexOf(k) >= 0) dest = _grupos[g.n]; });
          if (!dest) { dest = _grupos.Otros; if (!dest) { dest = document.createElement('div'); dest.className = 'ui-g'; dest.innerHTML = '<div class="ui-gt">Otros</div>'; nav.appendChild(dest); _grupos.Otros = dest; } }
          dest.appendChild(el);
        }
      });
      vacios();
    } catch (e) {}
  }
  function vacios() {
    try {
      document.querySelectorAll('#sb .nav .ui-g').forEach(function (g) {
        var hay = Array.prototype.some.call(g.querySelectorAll('button.ni'), function (b) { return b.style.display !== 'none'; });
        g.classList.toggle('ui-vacio', !hay);
      });
    } catch (e) {}
  }
  function compacto() {
    var sb = $('sb'); if (!sb || $('uiSbToggle')) return;
    var u = ''; try { u = String((JSON.parse(sessionStorage.getItem('user') || 'null') || {}).usuario || ''); } catch (e) {}
    var key = 'rl_sb_compacto_' + u;
    var b = document.createElement('button'); b.id = 'uiSbToggle'; b.type = 'button'; b.title = 'Menú compacto / completo';
    function aplicar(on) { document.body.classList.toggle('ui-compacto', !!on); b.textContent = on ? '›' : '‹'; try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) {} try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
    b.onclick = function () { aplicar(!document.body.classList.contains('ui-compacto')); };
    sb.appendChild(b);
    var prev = null; try { prev = localStorage.getItem(key); } catch (e) {}
    if (prev === '1') aplicar(true); else b.textContent = '‹';
  }

  function iniciar() {
    try { css(); } catch (e) { console.warn('[_UI_PIEL_V1] css:', e); }
    try { atenciones(); } catch (e) { console.warn('[_UI_PIEL_V1] atenciones:', e); }
    try { menu(); setTimeout(adoptar, 2000); setTimeout(adoptar, 5000); } catch (e) { console.warn('[_UI_PIEL_V1] menu:', e); }
    try { compacto(); } catch (e) {}
    console.log('[_UI_PIEL_V1] listo');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
