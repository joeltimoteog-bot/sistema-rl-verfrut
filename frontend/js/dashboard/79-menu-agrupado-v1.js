/* ════════════════════════════════════════════════════════════════════════════
   79-menu-agrupado-v1.js — _MENU_AGRUPADO_V1 (10-nov-2026) · marcador _LISTAS_V2
   Menu lateral del dashboard ordenado por temas. SOLO PRESENTACION.
     · No quita, no renombra y no mueve ningun boton: cada uno conserva su id, su onclick y su
       lugar en el documento. Solo se cambia el ORDEN VISUAL (CSS order) y se insertan titulos.
     · Convive con el agrupado anterior de ui-piel.js (cajas .ui-g): esas cajas pasan a
       display:contents y sus titulos se ocultan; si ui-piel.js no esta, funciona igual.
     · Respeta permisos: un boton oculto (por rol, Acceso a Modulos, sector, cumplimiento o CSS)
       sigue oculto, y un grupo sin botones visibles no muestra su titulo.
     · Botones que aparezcan despues (Control de Cumplimiento, Acceso a Modulos, Seguridad de
       usuarios, Cerebro…) se ubican solos; uno que no este en la tabla cae en "Otros".
     · Observador sin bucles: escucha style/class/hijos del menu; este modulo solo escribe
       data-mgo en los botones (no observado) y la clase de SUS titulos (solo si cambia).
   INTERRUPTOR (menu exactamente como antes): localStorage.setItem('rl_menu_clasico','on') y recargar.
   Para volver al agrupado: localStorage.removeItem('rl_menu_clasico') y recargar.
   Diagnostico en consola: rlMenuAgrupado.tabla()
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._MENU_AGRUPADO_V1) return; window._MENU_AGRUPADO_V1 = true;
  try { if (localStorage.getItem('rl_menu_clasico') === 'on') { console.log('[_MENU_AGRUPADO_V1] apagado (rl_menu_clasico=on): menu clasico'); return; } } catch (e) {}

  /* clave de cada boton: su id; si no tiene, "mod_" + destino de su onclick (misma regla que ui-piel.js) */
  var GRUPOS = [
    { n: 'Inicio',                     c: ['mod_dashboard'] },
    { n: 'Atención al trabajador',     c: ['navAt', 'mod_trabajadores', 'mod_consulta', 'mod_consulta-masiva', 'navCorreo', 'navSolicitudes', 'navHoras', 'navCalcRemu'] },
    { n: 'Campo y transporte',         c: ['navVisitas', 'navFusiones', 'navAlmuerzos', 'navMantenimiento'] },
    { n: 'Casos y cumplimiento',       c: ['navCasos', 'navCumpl', 'navPreaviso'] },
    { n: 'Capacitación y evaluación',  c: ['mod_capacitaciones', 'navProgEti', 'navAppEti', 'navEval360'] },
    { n: 'Bienestar',                  c: ['navBienestar', 'navInventario'] },
    { n: 'Reportes',                   c: ['navMisEstadisticas', 'navEstadisticas', 'navKpis', 'navInformeGH', 'navRes'] },
    { n: 'Administración',             c: ['navUsr', 'navPadron', 'navPermisos', 'navSegUsuarios', 'navActividad', 'navMonitor', 'navFbAlertas', 'navCerebro'] }
  ];
  var OTROS = 'Otros';

  function claveDe(b) {
    if (b.id) return b.id;
    var oc = b.getAttribute('onclick') || '', m = oc.match(/ir\('([^']+)'/) || oc.match(/location\.href='([^']+?)(\.html)?'/);
    return m ? 'mod_' + m[1].replace(/[^A-Za-z0-9_-]/g, '') : '';
  }
  function lugarDe(k) {   /* -> { g: indice de grupo, i: posicion dentro del grupo } */
    for (var g = 0; g < GRUPOS.length; g++) { var i = GRUPOS[g].c.indexOf(k); if (i >= 0) return { g: g, i: i }; }
    return { g: GRUPOS.length, i: -1 };
  }
  function nombreGrupo(g) { return g < GRUPOS.length ? GRUPOS[g].n : OTROS; }

  var hoja = null, reglas = {};
  function css() {
    if (hoja) return;
    hoja = document.createElement('style'); hoja.id = 'mgCss';
    hoja.textContent =
      'body.mg-on #sb .nav{display:flex;flex-direction:column}' +
      'body.mg-on #sb .nav>*{flex:0 0 auto}' +
      'body.mg-on #sb .nav .ui-g{display:contents}' +
      'body.mg-on #sb .nav .ui-gt,body.mg-on #sb .nav .ns{display:none!important}' +
      'body.mg-on #sb .nav .mg-t{font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.5);padding:9px 10px 0;margin:9px 0 5px;border-top:1px solid rgba(255,255,255,.09);line-height:1.25;user-select:none}' +
      'body.mg-on #sb .nav .mg-t.mg-primero{border-top:0;margin-top:0;padding-top:2px}' +
      'body.mg-on #sb .nav .mg-t.mg-oculto{display:none}' +
      'body.mg-on.ui-compacto #sb .nav .mg-t{font-size:0;padding:0;margin:7px 10px;height:1px;border-top:1px solid rgba(255,255,255,.16)}' +
      'body.mg-on.ui-compacto #sb .nav .mg-t.mg-primero{display:none}' +
      '@media(max-width:768px){body.mg-on #sb .nav .mg-t{font-size:11.5px;padding-top:11px;margin-top:11px}}';
    document.head.appendChild(hoja);
  }
  function reglaOrden(n) {   /* una regla CSS por numero de orden usado; no se escribe style en los botones */
    if (reglas[n]) return; reglas[n] = 1;
    hoja.appendChild(document.createTextNode('body.mg-on #sb .nav [data-mgo="' + n + '"]{order:' + n + '}'));
  }

  var titulos = {};   /* indice de grupo -> div del titulo */
  function tituloDe(nav, g) {
    var t = titulos[g];
    if (t && t.parentNode === nav) return t;
    t = document.createElement('div'); t.className = 'mg-t mg-oculto'; t.setAttribute('data-mg-titulo', nombreGrupo(g));
    t.setAttribute('data-mgo', String(g * 100)); t.textContent = nombreGrupo(g);
    reglaOrden(g * 100);
    nav.appendChild(t); titulos[g] = t;
    return t;
  }

  function visible(b) { try { return getComputedStyle(b).display !== 'none'; } catch (e) { return b.style.display !== 'none'; } }

  function aplicar() {
    var nav = document.querySelector('#sb .nav'); if (!nav) return;
    css();
    if (!document.body.classList.contains('mg-on')) document.body.classList.add('mg-on');
    var hay = {}, extra = 0, primero = -1;
    Array.prototype.forEach.call(nav.querySelectorAll('button.ni'), function (b) {
      var L = lugarDe(claveDe(b));
      var o = L.g * 100 + 1 + (L.i >= 0 ? L.i : 60 + Math.min(extra++, 35));
      reglaOrden(o);
      if (b.getAttribute('data-mgo') !== String(o)) b.setAttribute('data-mgo', String(o));
      if (visible(b)) hay[L.g] = true;
    });
    for (var g = 0; g <= GRUPOS.length; g++) {
      if (!hay[g] && !titulos[g]) continue;          /* "Otros" y grupos vacios: no se crea titulo si nunca hizo falta */
      var t = tituloDe(nav, g), oculto = !hay[g];
      if (t.classList.contains('mg-oculto') !== oculto) t.classList.toggle('mg-oculto', oculto);
      if (!oculto && primero < 0) primero = g;
    }
    Object.keys(titulos).forEach(function (k) {
      var es = Number(k) === primero, t = titulos[k];
      if (t.classList.contains('mg-primero') !== es) t.classList.toggle('mg-primero', es);
    });
  }

  var pend = null;
  function pedir() { if (pend) return; pend = setTimeout(function () { pend = null; try { aplicar(); } catch (e) { console.warn('[_MENU_AGRUPADO_V1]', e && e.message); } }, 80); }

  function iniciar() {
    var nav = document.querySelector('#sb .nav'); if (!nav) return;
    try { aplicar(); } catch (e) { console.warn('[_MENU_AGRUPADO_V1]', e && e.message); return; }
    try { new MutationObserver(pedir).observe(nav, { attributes: true, attributeFilter: ['style', 'class'], subtree: true, childList: true }); } catch (e) {}
    /* repasos: reglas que ocultan por hoja de estilos (no las ve el observador) y botones que llegan tarde */
    [600, 1800, 3500, 6500, 12000].forEach(function (ms) { setTimeout(pedir, ms); });
    window.addEventListener('load', pedir);
    console.log('[_MENU_AGRUPADO_V1] listo (apagar: localStorage.rl_menu_clasico = "on")');
  }

  /* diagnostico: boton -> grupo, visible o no, y destinos repetidos */
  window.rlMenuAgrupado = {
    grupos: GRUPOS,
    aplicar: aplicar,
    tabla: function () {
      var nav = document.querySelector('#sb .nav'), filas = [], dest = {};
      if (!nav) return filas;
      Array.prototype.forEach.call(nav.querySelectorAll('button.ni'), function (b) {
        var k = claveDe(b), L = lugarDe(k), oc = b.getAttribute('onclick') || '', d = (oc.match(/[\w-]+\.html/) || oc.match(/ir\('[^']+'/) || [''])[0];
        var txt = ''; Array.prototype.forEach.call(b.childNodes, function (n) { if (n.nodeType === 3) txt += n.nodeValue; });
        var f = { boton: txt.trim(), clave: k, grupo: nombreGrupo(L.g), visible: visible(b), destino: d };
        filas.push(f); if (d) (dest[d] = dest[d] || []).push(f.boton);
      });
      try { console.table(filas); Object.keys(dest).forEach(function (d) { if (dest[d].length > 1) console.log('[duplicado] ' + d + ' <- ' + dest[d].join(' | ')); }); } catch (e) {}
      return filas;
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
