/* ════════════════════════════════════════════════════════════════════════════
   77-filtros-equipo-v1.js — _FILTROS_EQUIPO_V1 (10-nov-2026) · v3
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
    /* v2: cualquier forma de escribir el cargo ("Supervisor GH", "Sup. de Gestion Humana", "Supervisor") vale, salvo otras areas */
    if (c) return (/SUPERV|^SUP\b/.test(c) && !/BIENESTAR|RECLUT|REMUNER|PLANILLA/.test(c)) || (/ASIST/.test(c) && /RELACIONES LABORALES|RR\.? ?LL|\bRL\b/.test(c));
    return !/admin|coordinador|jefa/.test(String(u.rol || '').toLowerCase());
  }
  var EQUIPO = null, TODOS = [], pidiendo = false;
  var SOLO_VISITA = false;
  async function cargarEquipo() {
    if (EQUIPO || pidiendo) return; pidiendo = true;
    try {
      var tk = sessionStorage.getItem('rl_token'); if (!tk) return;
      /* _PADRON_EQUIPO_V1 (10-nov-2026): la lista del equipo sale del PADRON UNICO (personas/equipo, lo lee cualquier sesion):
         supervisores de Gestion Humana y asistentes de RR.LL. vigentes, con su DNI, sector, empresa y correo. Asi lo que se
         completa en el padron llega a Visitas, Fusiones y Casos. Si el padron no responde, sigue la regla anterior
         (usuarios/lista). Apagar: localStorage.rl_equipo_padron = 'off'. */
      var delPadron = null;
      try {
        if (localStorage.getItem('rl_equipo_padron') !== 'off') {
          var rp = await fetch(URL_USR.replace('usuarios/lista', 'personas/equipo'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: '{}' });
          var jp = rp.ok ? await rp.json() : null;
          if (jp && jp.success && Array.isArray(jp.personas)) {
            delPadron = jp.personas.filter(function (p) { return p.rol_campo === 'SUPERVISOR_GH' || p.rol_campo === 'ASISTENTE_RL'; }).map(function (p) {
              return { usuario: String(p.usuario || '').toLowerCase(), nombre: (String(p.nombres || '').trim() + ' ' + String(p.apellidos || '').trim()).trim() || String(p.nombre_mostrar || '').trim(),
                cargo: String(p.cargo || (p.rol_campo === 'ASISTENTE_RL' ? 'Asistente de Relaciones Laborales' : 'Supervisor de Gestion Humana')).trim(), correo: String(p.correo || '').trim(),
                sector: String(p.sector || '').trim(), empresa: String(p.empresa || '').trim().toUpperCase(), dni: /^\d{8}$/.test(String(p.dni || '')) ? String(p.dni) : '' };
            }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
            if (!delPadron.length) delPadron = null;
          }
        }
      } catch (eP) { delPadron = null; }
      if (delPadron) console.log('[_PADRON_EQUIPO_V1] equipo desde el padron: ' + delPadron.length + ' personas');
      var r = await fetch(URL_USR, { headers: { Authorization: 'Bearer ' + tk } });
      if (!r.ok) { if (delPadron) { EQUIPO = delPadron; SOLO_VISITA = true; } else if (r.status === 403) EQUIPO = []; return; }   /* no es administrador: con padron, usa el padron; sin padron, se deja todo como esta */
      var j = await r.json();
      TODOS = (j && (j.data || j.usuarios)) || [];
      cargos();
      EQUIPO = TODOS.filter(esEquipo).map(function (u) { return { usuario: String(u.usuario || '').toLowerCase(), nombre: String(u.nombre || u.usuario || '').trim(), cargo: String(u.cargo || '').trim(), correo: String(u.correo || '').trim(), sector: String(u.sector || '').trim(), empresa: String(u.empresa || '').trim().toUpperCase() }; })
        .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
      if (delPadron) EQUIPO = delPadron;   /* _PADRON_EQUIPO_V1 */
      console.log('[_FILTROS_EQUIPO_V1] equipo vigente: ' + EQUIPO.length + ' usuarios');
    } catch (e) { console.warn('[_FILTROS_EQUIPO_V1]', e.message); if (!EQUIPO && typeof delPadron !== 'undefined' && delPadron) EQUIPO = delPadron; } finally { pidiendo = false; }
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
  /* v2 (10-nov): un usuario NUEVO creado en Gestion de Usuarios no estaba en las listas fijas del sistema:
     · "Supervisor" de Registro de Casos se llena con la hoja BD_Supervisores (otro padron) -> aqui se agregan los del equipo que falten;
     · su cargo no estaba en la tabla fija CARGOS_USUARIOS (los documentos lo ponian como "Asistente de RR.LL.") -> se completa con el cargo del padron. */
  function cargos() {
    try {
      TODOS.forEach(function (u) { var k = String(u.usuario || '').toLowerCase().trim(), c = String(u.cargo || '').trim(); if (k && c && !CARGOS_USUARIOS[k]) CARGOS_USUARIOS[k] = c; });
    } catch (e) {}
  }
  function casos() {
    var sel = $('cSupervisor'); if (!sel || sel.options.length < 2) return;
    var hay = Array.prototype.map.call(sel.options, function (o) { return o.value; }).filter(Boolean);
    EQUIPO.forEach(function (u) {
      if (hay.some(function (n) { return coincide(u, n); })) return;
      var o = document.createElement('option'); o.value = o.textContent = u.nombre.toUpperCase();
      var g = sel.querySelector('optgroup'); if (g) sel.insertBefore(o, g); else sel.appendChild(o);
    });
  }
  /* v3 (10-nov): "Nueva visita de campo" -> el desplegable Supervisor sale de la hoja BD_Supervisores; aqui se agregan los
     supervisores del equipo que aun no estan en esa hoja, con su correo, empresa y sector del padron de usuarios.
     El DNI no existe en Gestion de Usuarios: para ellos el campo DNI queda editable (se escribe una vez en la visita).
     El formulario se muestra en MAYUSCULAS (solo presentacion: lo guardado no cambia). */
  function visitaNueva() {
    var sel = $('vSup'); if (!sel || sel.options.length < 2) return;
    if (!$('fe-css')) { var st = document.createElement('style'); st.id = 'fe-css'; st.textContent = '#vSup,#vSup option,#vFundo,#vPunto,#vSupTitular,#vFundoReemplazo,#cSupervisor{text-transform:uppercase}'; document.head.appendChild(st); }
    /* el formulario rearma la lista sin quitar el grupo "Retirados" anterior: quedaba un titulo "Retirados" vacio ARRIBA y
       los supervisores activos parecian retirados. Se quitan los grupos vacios y el grupo real queda al final. */
    Array.prototype.forEach.call(sel.querySelectorAll('optgroup'), function (g) { if (!g.children.length) g.remove(); });
    var gr = sel.querySelector('optgroup'); if (gr && sel.lastElementChild !== gr) sel.appendChild(gr);
    /* _PADRON_EQUIPO_V1: a quien ya estaba en la lista pero sin DNI se le completa con el del padron */
    Array.prototype.forEach.call(sel.options, function (o) { if (!o.value || (o.dataset && o.dataset.dni)) return; EQUIPO.forEach(function (u) { if (u.dni && !o.dataset.dni && coincide(u, o.value)) o.dataset.dni = u.dni; }); });
    var hay = Array.prototype.map.call(sel.options, function (o) { return o.value; }).filter(Boolean);
    EQUIPO.forEach(function (u) {
      if (/ASIST/.test(N(u.cargo)) || hay.some(function (n) { return coincide(u, n); })) return;   /* la asistente no hace visitas de campo */
      var nom = u.nombre.toUpperCase(), o = new Option(nom + (u.sector ? ' — ' + u.sector.toUpperCase() : ''), nom);
      o.dataset.dni = u.dni || ''; o.dataset.correo = u.correo;   /* _PADRON_EQUIPO_V1: DNI del padron */ o.dataset.empresa = /^(RAPEL|VERFRUT|OLMOS)$/.test(u.empresa) ? u.empresa : '';
      o.dataset.fundo = u.sector; o.dataset.reemplazo = 'no'; o.dataset.equipo = '1';
      var g = sel.querySelector('optgroup'); if (g) sel.insertBefore(o, g); else sel.appendChild(o);
    });
  }
  document.addEventListener('change', function (ev) {
    if (!ev.target || ev.target.id !== 'vSup') return;
    var o = ev.target.options[ev.target.selectedIndex], d = $('vDNI'); if (!d) return;
    var falta = !!(o && o.dataset && o.dataset.equipo === '1' && !o.dataset.dni);
    d.readOnly = !falta; d.placeholder = falta ? 'Escriba el DNI del supervisor' : ''; d.style.background = falta ? '#fff' : '#f8fafc';
  });
  /* consola: rlFiltrosEquipo.porQue('usuario') dice si esta en el equipo y con que cargo / sector quedo guardado */
  window.rlFiltrosEquipo = { equipo: function () { return (EQUIPO || []).slice(); }, porQue: function (usr) {
    var u = TODOS.filter(function (x) { return String(x.usuario || '').toLowerCase() === String(usr || '').toLowerCase(); })[0];
    return u ? { usuario: u.usuario, nombre: u.nombre, cargo: u.cargo || '(sin cargo)', sector: u.sector || '(sin sector)', rol: u.rol, activo: u.activo, enEquipo: esEquipo(u) } : 'No esta en el padron de usuarios de Supabase'; } };
  function vuelta() {
    if (!EQUIPO) { cargarEquipo(); return; }
    if (!EQUIPO.length) return;
    /* _PADRON_EQUIPO_V1: quien no es administrador conserva sus filtros como estaban; solo se le completa "Nueva visita" (lista y DNI) */
    if (!SOLO_VISITA) { try { fusiones(); } catch (e) {} try { visitas(); } catch (e) {} try { casos(); } catch (e) {} }
    try { visitaNueva(); } catch (e) {}
  }
  setInterval(vuelta, 2500); setTimeout(vuelta, 1200);
})();
