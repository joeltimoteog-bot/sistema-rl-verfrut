/* ════════════════════════════════════════════════════════════════════════════
   77-filtros-equipo-v1.js — _FILTROS_EQUIPO_V1 (10-nov-2026)
   Visitas a Campo y Fusiones de Buses: el filtro de supervisor muestra al EQUIPO VIGENTE
   (supervisores de Gestion Humana y asistentes de Relaciones Laborales), tomado del padron de
   usuarios del sistema (usuarios/lista, Supabase). Un usuario nuevo con ese cargo aparece solo.
     · Fusiones de Buses: el desplegable lista primero al equipo; quienes tienen registros pero ya no
       pertenecen al equipo quedan abajo, en "Otros con registros" (para poder consultar lo antiguo).
     · Visitas a Campo: la caja "Buscar supervisor…" pasa a ser un desplegable con el mismo criterio.
   SOLO PRESENTACION: no cambia como se filtra ni lo que se guarda. Solo administradores (los demas
   ven su propia informacion, como siempre). Apagar: localStorage.rl_filtros_equipo = 'off'.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._FILTROS_EQUIPO_V1) return; window._FILTROS_EQUIPO_V1 = true;
  try { if (localStorage.getItem('rl_filtros_equipo') === 'off') return; } catch (e) {}
  var URL_USR = 'https://rl-fn-verfrut.azurewebsites.net/api/usuarios/lista';   /* azure-token.js lo dirige a Supabase */
  var FUERA_USR = ['jsiancas', 'mmechato', 'jchavez', 'dsanchez', 'jcarranza', 'jfernandez', 'ovilela'];   /* = _EQUIPO_RRLL_V1 del servidor */
  var FUERA_SECTOR = ['BIENESTAR SOCIAL', 'RECLUTAMIENTO'];
  var $ = function (id) { return document.getElementById(id); };
  var N = function (s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); };

  /* equipo = activo, no eliminado, y cargo de Supervisor de Gestion Humana o Asistente de Relaciones Laborales.
     Si el usuario aun no tiene cargo cargado, vale la regla del equipo RR.LL. (no admin, no excluido, sector propio). */
  function esEquipo(u) {
    if (!u || !u.activo || u.eliminado === true || u.eliminado === 1) return false;
    var c = N(u.cargo), usr = String(u.usuario || '').toLowerCase().trim();
    if (FUERA_USR.indexOf(usr) >= 0 || FUERA_SECTOR.indexOf(N(u.sector)) >= 0) return false;
    if (c) return (/SUPERVISOR/.test(c) && /GESTION HUMANA|GH\b/.test(c)) || (/ASISTENTE/.test(c) && /RELACIONES LABORALES|RR\.?LL/.test(c));
    return !/admin|coordinador|jefa/.test(String(u.rol || '').toLowerCase());
  }
  var EQUIPO = null, pidiendo = false;
  async function cargarEquipo() {
    if (EQUIPO || pidiendo) return; pidiendo = true;
    try {
      var tk = sessionStorage.getItem('rl_token'); if (!tk) return;
      var r = await fetch(URL_USR, { headers: { Authorization: 'Bearer ' + tk } });
      if (!r.ok) { if (r.status === 403) EQUIPO = []; return; }   /* no es administrador: se deja todo como esta */
      var j = await r.json();
      EQUIPO = ((j && (j.data || j.usuarios)) || []).filter(esEquipo).map(function (u) { return { usuario: String(u.usuario || '').toLowerCase(), nombre: String(u.nombre || u.usuario || '').trim(), cargo: String(u.cargo || '').trim() }; })
        .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
      console.log('[_FILTROS_EQUIPO_V1] equipo vigente: ' + EQUIPO.length + ' usuarios');
    } catch (e) { console.warn('[_FILTROS_EQUIPO_V1]', e.message); } finally { pidiendo = false; }
  }
  /* mismo nombre aunque este escrito mas corto ("POOL TAMAYO" = "POOL WILFREDO TAMAYO RODRIGUEZ") o sea el usuario */
  function coincide(u, nombreDato) {
    var a = N(u.nombre), b = N(nombreDato); if (!b) return false;
    if (a === b || N(u.usuario) === b) return true;
    var ta = a.split(' '), tb = b.split(' '), corto = ta.length <= tb.length ? ta : tb, largo = ta.length <= tb.length ? tb : ta;
    return corto.length >= 2 && corto.every(function (t) { return largo.indexOf(t) >= 0; });
  }
  function opciones(sel, nombresDatos, primera) {
    var previo = sel.value, usados = {}, frag = document.createDocumentFragment();
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = primera; frag.appendChild(o0);
    var g1 = document.createElement('optgroup'); g1.label = 'Equipo vigente (Supervisores GH y Asistentes RR.LL.)';
    EQUIPO.forEach(function (u) {
      var enDatos = nombresDatos.filter(function (n) { return coincide(u, n); });
      enDatos.forEach(function (n) { usados[n] = 1; });
      var o = document.createElement('option'); o.value = enDatos[0] || u.nombre; o.textContent = u.nombre.toUpperCase(); g1.appendChild(o);
    });
    frag.appendChild(g1);
    var otros = nombresDatos.filter(function (n) { return !usados[n]; }).sort();
    if (otros.length) { var g2 = document.createElement('optgroup'); g2.label = 'Otros con registros';
      otros.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = String(n).toUpperCase(); g2.appendChild(o); }); frag.appendChild(g2); }
    sel.innerHTML = ''; sel.appendChild(frag);
    if (previo && Array.prototype.some.call(sel.options, function (o) { return o.value === previo; })) sel.value = previo;
  }
  var unicos = function (L, campo) { var m = {}; (L || []).forEach(function (r) { var v = String((r && r[campo]) || '').trim(); if (v) m[v] = 1; }); return Object.keys(m); };

  var firmaF = '', firmaV = '';
  function fusiones() {
    var sel = $('fFusionSup'); if (!sel) return;
    var datos = []; try { datos = unicos(_fusionesData, 'supervisor'); } catch (e) {}
    var f = EQUIPO.length + '|' + datos.join('|'); if (f === firmaF && sel.querySelector('optgroup')) return; firmaF = f;
    opciones(sel, datos, sel.options.length ? sel.options[0].textContent : 'Todos los supervisores');
  }
  function visitas() {
    var el = $('vFiltroSup'); if (!el) return;
    if (el.tagName !== 'SELECT') {   /* la caja de texto pasa a desplegable (mismo id: el filtro de siempre lo lee igual) */
      var s = document.createElement('select'); s.id = 'vFiltroSup'; s.style.cssText = el.style.cssText; s.style.width = '240px';
      s.onchange = function () { if (typeof cargarVisitas === 'function') cargarVisitas(); };
      el.parentNode.replaceChild(s, el); el = s; firmaV = '';
    }
    var datos = []; try { datos = unicos(CACHE.visitas, 'supervisor'); } catch (e) {}
    var f = EQUIPO.length + '|' + datos.join('|'); if (f === firmaV) return; firmaV = f;
    opciones(el, datos, 'Todos los supervisores');
  }
  function vuelta() {
    if (!EQUIPO) { cargarEquipo(); return; }
    if (!EQUIPO.length) return;
    try { fusiones(); } catch (e) {} try { visitas(); } catch (e) {}
  }
  setInterval(vuelta, 2500); setTimeout(vuelta, 1200);
})();
