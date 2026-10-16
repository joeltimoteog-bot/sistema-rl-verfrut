/* ═══════════════════════════════════════════════════════════════════════════
   _ACCESO_UI_V3 (15-oct-2026) — nueva pantalla "Acceso a Módulos y Horarios"
   ---------------------------------------------------------------------------
   Reemplaza SOLO la presentacion del modal de permisos (_PERMISOS_UI_V1 + _HORARIOS_UI_V2).
   Usa exactamente las mismas acciones del servidor que antes:
     lectura:   permisosListar (todos:true), accesoHorarioListar, /usuarios/lista (Azure) o permisosUsuarios
     escritura: permisosGuardar, accesoHorarioGuardar, accesoHorarioEliminar
   Si esta pantalla no pudiera construirse, se abre la de siempre (window.permAbrir).

   Que trae:
     · Un solo panel: a la izquierda TODOS los usuarios con cuantos modulos tienen, su horario y
       su estado (buscador y filtros); a la derecha la ficha de la persona elegida.
     · Modulos agrupados por area, como tarjetas con interruptor; "copiar de otro usuario".
     · Horario con vista previa en palabras (a. m./p. m., horas de acceso, cruce de medianoche).
     · Aviso de cambios sin guardar; guardado con confirmacion visual; todo cargado UNA sola vez.
   Para desactivar: quitar la etiqueta <script src=".../acceso-ui.js"> (vuelve la pantalla anterior).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ACCESO_UI_V3) return;
  window._ACCESO_UI_V3 = true;

  var DIAS = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mié'], ['4', 'Jue'], ['5', 'Vie'], ['6', 'Sáb'], ['7', 'Dom']];
  var GEN_INI = '05:30', GEN_FIN = '17:00';
  var GRUPOS = [
    { n: 'Principal', ic: '🏠', c: ['mod_dashboard', 'navAt', 'mod_trabajadores', 'mod_consulta', 'mod_consulta-masiva', 'navMisEstadisticas'] },
    { n: 'Operación RR.LL.', ic: '🗂️', c: ['navCorreo', 'navVisitas', 'navCasos', 'navFusiones', 'mod_capacitaciones', 'navMantenimiento', 'navSolicitudes', 'navHoras', 'navAlmuerzos', 'navInventario', 'navPreaviso', 'navCalcRemu', 'navBienestar'] },
    { n: 'Análisis y gerencia', ic: '📈', c: ['navRes', 'navEstadisticas', 'navKpis', 'navEval360'] },
    { n: 'Sistema ETI', ic: '🎓', c: ['navProgEti', 'navAppEti'] },
    { n: 'Administración', ic: '🛡️', c: ['navUsr', 'navPermisos', 'navMonitor', 'navFbAlertas'] }
  ];
  var ROL_COLOR = { administrador: '#7c3aed', coordinador: '#0369a1', jefa_rl: '#0369a1', supervisor: '#15803d' };

  var S = { usuarios: [], permisos: {}, horarios: {}, sel: null, tab: 'mod', dirty: false, cat: [], filtro: '', vista: 'todos', cargado: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  function esAdmin() { var u = usr(); if (!u) return false; var r = String(u.rol || '').toLowerCase().trim(); return ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02'].indexOf(r) >= 0 || String(u.usuario).toLowerCase() === 'jtimoteo'; }
  function hTxt(h) { var m = String(h || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return h || ''; var hh = +m[1], ap = hh >= 12 ? 'p. m.' : 'a. m.'; hh = hh % 12 || 12; return hh + ':' + m[2] + ' ' + ap; }
  function hMin(h) { var m = String(h || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function ini(n) { return String(n || '?').trim().charAt(0).toUpperCase(); }
  function rolColor(r) { r = String(r || '').toLowerCase(); for (var k in ROL_COLOR) if (r.indexOf(k) === 0) return ROL_COLOR[k]; return '#475569'; }

  /* ── catalogo de modulos (del menu, igual que _PERMISOS_UI_V1) ── */
  function catalogo() {
    var cat = (typeof window.permCatalogo === 'function') ? window.permCatalogo() : [];
    var out = cat.map(function (m) {
      var ic = ''; try { var i = m.boton.querySelector('.ic'); ic = i ? i.textContent.trim() : ''; } catch (e) {}
      return { clave: m.clave, etiqueta: m.etiqueta, ic: ic || '▫️' };
    });
    var hay = {}; out.forEach(function (m) { hay[m.clave] = m; });
    if (!hay.navPermisos) out.push({ clave: 'navPermisos', etiqueta: 'Acceso a Módulos', ic: '🔐' });
    return out;
  }
  function grupos() {
    var cat = catalogo(), usado = {}, out = [];
    GRUPOS.forEach(function (g) {
      var ms = []; g.c.forEach(function (k) { cat.forEach(function (m) { if (m.clave === k && !usado[k]) { usado[k] = 1; ms.push(m); } }); });
      if (ms.length) out.push({ n: g.n, ic: g.ic, ms: ms });
    });
    var resto = cat.filter(function (m) { return !usado[m.clave]; });
    if (resto.length) out.push({ n: 'Otros', ic: '▫️', ms: resto });
    return out;
  }

  /* ── datos ── */
  async function listaUsuarios() {
    var yo = usr();
    try {
      var tk = sessionStorage.getItem('rl_token');
      if (tk && typeof AZURE_FN_BASE !== 'undefined' && window.AbortController) {
        var ctl = new AbortController(); var t = setTimeout(function () { ctl.abort(); }, 9000);
        var r = await fetch(AZURE_FN_BASE + '/usuarios/lista', { method: 'GET', signal: ctl.signal, headers: { 'Authorization': 'Bearer ' + tk } });
        clearTimeout(t);
        var j = await r.json();
        if (j && j.success && Array.isArray(j.data) && j.data.length) {
          return j.data.map(function (u) { return { usuario: String(u.usuario || '').toLowerCase(), nombre: u.nombre || '', rol: u.rol || '', empresa: u.empresa || '', activo: u.activo !== false }; });
        }
      }
    } catch (e) { console.warn('[_ACCESO_UI_V3] usuarios Azure: ' + (e && e.message) + ' -> Google'); }
    var d = await apiPost({ action: 'permisosUsuarios', usuario: yo.usuario, rol: yo.rol });
    if (!d || !d.success) { await new Promise(function (r) { setTimeout(r, 1500); }); d = await apiPost({ action: 'permisosUsuarios', usuario: yo.usuario, rol: yo.rol }); }
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo leer la lista de usuarios');
    return (d.usuarios || []).map(function (u) { return { usuario: String(u.usuario || '').toLowerCase(), nombre: u.nombre || '', rol: u.rol || '', empresa: u.empresa || '', activo: u.activo !== false }; });
  }
  async function cargarTodo(forzar) {
    if (S.cargado && !forzar) return;
    var yo = usr();
    var rU = listaUsuarios();
    var rP = apiPost({ action: 'permisosListar', usuario: yo.usuario, rol: yo.rol, todos: true }).catch(function () { return null; });
    var rH = apiPost({ action: 'accesoHorarioListar', usuario: yo.usuario, rol: yo.rol }).catch(function () { return null; });
    S.usuarios = (await rU).sort(function (a, b) { return (a.activo === b.activo ? 0 : a.activo ? -1 : 1) || String(a.nombre || a.usuario).localeCompare(String(b.nombre || b.usuario)); });
    var p = await rP, h = await rH;
    S.permisos = {}; if (p && p.success && p.permisos) Object.keys(p.permisos).forEach(function (k) { S.permisos[String(k).toLowerCase()] = p.permisos[k]; });
    S.horarios = {}; if (h && h.success) (h.horarios || []).forEach(function (x) { S.horarios[String(x.usuario || '').toLowerCase()] = x; });
    S.errP = !(p && p.success); S.errH = !(h && h.success);
    S.cargado = true;
  }
  function resumenUsuario(u) {
    var p = S.permisos[u.usuario], cat = S.cat, n = 0, tot = cat.length;
    if (p) cat.forEach(function (m) { if (p[m.clave]) n++; });
    var h = S.horarios[u.usuario];
    return { tienePerm: !!p, n: n, tot: tot, hor: h || null };
  }

  /* ── estilos ── */
  var CSS = '\
#ac3Ov{position:fixed;inset:0;background:rgba(5,12,30,.66);z-index:10200;display:none;align-items:center;justify-content:center;padding:18px;font-family:inherit}\
#ac3Ov.on{display:flex}\
#ac3{background:#f3f6fb;border-radius:18px;width:100%;max-width:1180px;height:min(92vh,860px);display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden;color:#0f172a}\
#ac3 *{box-sizing:border-box}\
#ac3 .hd{display:flex;align-items:center;gap:14px;padding:14px 20px;background:linear-gradient(100deg,#0a2463,#1e3a8a 60%,#1d4ed8);color:#fff}\
#ac3 .hd h2{margin:0;font-size:17px;font-weight:800;letter-spacing:.2px}\
#ac3 .hd .sub{font-size:12px;opacity:.85;margin-top:2px}\
#ac3 .kpis{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}\
#ac3 .kpi{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 12px;font-size:11.5px;line-height:1.2;text-align:center;min-width:74px}\
#ac3 .kpi b{display:block;font-size:17px;font-weight:800}\
#ac3 .x{background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:10px;font-size:18px;cursor:pointer}\
#ac3 .x:hover{background:rgba(255,255,255,.3)}\
#ac3 .body{flex:1;display:grid;grid-template-columns:340px 1fr;min-height:0}\
#ac3 .izq{border-right:1px solid #dbe3f0;display:flex;flex-direction:column;min-height:0;background:#fff}\
#ac3 .tools{padding:12px 12px 8px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid #e8edf5}\
#ac3 .tools input{width:100%;padding:9px 12px;border:1.5px solid #c7d2e6;border-radius:10px;font-size:13.5px;outline:none}\
#ac3 .tools input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}\
#ac3 .seg{display:flex;gap:4px;flex-wrap:wrap}\
#ac3 .seg button{border:1px solid #dbe3f0;background:#f8fafc;color:#475569;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;cursor:pointer}\
#ac3 .seg button.on{background:#0a2463;color:#fff;border-color:#0a2463}\
#ac3 .lista{flex:1;overflow:auto;padding:8px}\
#ac3 .u{display:grid;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;cursor:pointer;border:1px solid transparent;margin-bottom:4px}\
#ac3 .u:hover{background:#f1f5fb}\
#ac3 .u.sel{background:#e8f0ff;border-color:#93b4ff}\
#ac3 .u.inact{opacity:.55}\
#ac3 .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:14px}\
#ac3 .u .n{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
#ac3 .u .m{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}\
#ac3 .u .m i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;vertical-align:0}\
#ac3 .u .r{text-align:right;font-size:11px;color:#64748b;line-height:1.35;white-space:nowrap}\
#ac3 .u .r b{display:block;font-size:13px;color:#0f172a}\
#ac3 .tag{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.2px}\
#ac3 .tag.hor{background:#fef3c7;color:#92400e}#ac3 .tag.gen{background:#f1f5f9;color:#64748b}#ac3 .tag.sin{background:#fee2e2;color:#991b1b}#ac3 .tag.def{background:#dcfce7;color:#166534}\
#ac3 .der{display:flex;flex-direction:column;min-height:0}\
#ac3 .vacio{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#64748b;text-align:center;padding:30px;gap:8px}\
#ac3 .vacio .big{font-size:46px}\
#ac3 .who{display:flex;align-items:center;gap:14px;padding:14px 20px;background:#fff;border-bottom:1px solid #dbe3f0}\
#ac3 .who .av{width:48px;height:48px;font-size:18px}\
#ac3 .who .nm{font-size:16px;font-weight:800}\
#ac3 .who .mt{font-size:12px;color:#64748b;margin-top:2px}\
#ac3 .who .mt b{color:#0f172a}\
#ac3 .tabs{display:flex;gap:4px;margin-left:auto;background:#eef2f9;padding:4px;border-radius:12px}\
#ac3 .tabs button{border:none;background:transparent;padding:8px 16px;border-radius:9px;font-weight:800;font-size:13px;color:#64748b;cursor:pointer}\
#ac3 .tabs button.on{background:#fff;color:#0a2463;box-shadow:0 1px 4px rgba(0,0,0,.12)}\
#ac3 .pane{flex:1;overflow:auto;padding:16px 20px}\
#ac3 .barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}\
#ac3 .barra .cnt{font-size:12.5px;color:#475569;margin-right:auto}\
#ac3 .barra .cnt b{color:#0a2463;font-size:14px}\
#ac3 .mini{border:1px solid #dbe3f0;background:#fff;color:#334155;border-radius:9px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer}\
#ac3 .mini:hover{border-color:#2563eb;color:#1d4ed8}\
#ac3 select.mini{padding:6px 8px}\
#ac3 .grp{margin-bottom:14px}\
#ac3 .grp .gt{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:8px}\
#ac3 .grp .gt .ln{flex:1;height:1px;background:#dbe3f0}\
#ac3 .grp .gt .gc{font-weight:700;text-transform:none;letter-spacing:0;color:#64748b}\
#ac3 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}\
#ac3 .mod{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;cursor:pointer;user-select:none;transition:all .15s}\
#ac3 .mod:hover{border-color:#93b4ff}\
#ac3 .mod.on{border-color:#2563eb;background:#eef4ff}\
#ac3 .mod .mi{font-size:18px;width:26px;text-align:center}\
#ac3 .mod .mt{flex:1;font-size:13px;font-weight:700;line-height:1.2}\
#ac3 .mod .mt small{display:block;font-weight:500;color:#94a3b8;font-size:10px;font-family:monospace}\
#ac3 .sw{width:38px;height:22px;border-radius:999px;background:#cbd5e1;position:relative;flex:none;transition:background .15s}\
#ac3 .sw:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.3)}\
#ac3 .mod.on .sw{background:#2563eb}#ac3 .mod.on .sw:after{left:19px}\
#ac3 .ft{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #dbe3f0;background:#fff}\
#ac3 .ft .est{flex:1;font-size:12.5px;color:#475569;line-height:1.45}\
#ac3 .ft .dirty{color:#b45309;font-weight:700}\
#ac3 .btn{border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:800;cursor:pointer}\
#ac3 .btn.pri{background:#0a2463;color:#fff}#ac3 .btn.pri:hover{background:#1e3a8a}#ac3 .btn.pri:disabled{opacity:.55;cursor:not-allowed}\
#ac3 .btn.sec{background:#f1f5f9;color:#334155}\
#ac3 .btn.danger{background:#fee2e2;color:#b91c1c}\
#ac3 .hcard{background:#fff;border:1px solid #dbe3f0;border-radius:14px;padding:14px 16px;margin-bottom:12px}\
#ac3 .hcard .t{font-size:11.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#475569;margin-bottom:10px}\
#ac3 .estado{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;font-size:13px}\
#ac3 .estado.gen{background:#f1f5f9;color:#334155}#ac3 .estado.prop{background:#fef3c7;color:#78350f}\
#ac3 .estado .big{font-size:26px}\
#ac3 .f2{display:grid;grid-template-columns:1fr 1fr;gap:12px}\
#ac3 label.l{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px}\
#ac3 input.i{width:100%;padding:9px 11px;border:1.5px solid #c7d2e6;border-radius:10px;font-size:14px;font-family:inherit}\
#ac3 input.i:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}\
#ac3 .dias{display:flex;gap:6px;flex-wrap:wrap}\
#ac3 .dia{padding:7px 12px;border:1.5px solid #e2e8f0;border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer;background:#fff;color:#64748b;user-select:none}\
#ac3 .dia.on{background:#0a2463;color:#fff;border-color:#0a2463}\
#ac3 .prev{margin-top:10px;padding:10px 12px;border-radius:10px;background:#eef4ff;border:1px solid #bfd3ff;font-size:12.5px;line-height:1.5;color:#1e3a8a}\
#ac3 .prev.raro{background:#fef2f2;border-color:#fca5a5;color:#991b1b}\
#ac3 .toast{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .3s;pointer-events:none}\
#ac3 .toast.on{opacity:1}\
#ac3 .cargando{flex:1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:13px;gap:10px}\
#ac3 .spin{width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:#0a2463;border-radius:50%;animation:ac3spin .8s linear infinite}\
@keyframes ac3spin{to{transform:rotate(360deg)}}\
@media(max-width:900px){#ac3 .body{grid-template-columns:1fr}#ac3 .izq{display:none}#ac3 .izq.movil{display:flex}#ac3 .der.oculto{display:none}#ac3 .kpis{display:none}}';

  function construir() {
    if ($('ac3Ov')) return;
    var st = document.createElement('style'); st.id = 'ac3Css'; st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'ac3Ov';
    ov.innerHTML =
      '<div id="ac3" role="dialog" aria-label="Acceso a módulos y horarios" style="position:relative">' +
        '<div class="hd"><div><h2>🔐 Acceso a Módulos y Horarios</h2><div class="sub">Quién entra a qué módulo y en qué horario · los cambios aplican en el siguiente inicio de sesión</div></div>' +
          '<div class="kpis"><div class="kpi"><b id="ac3K1">–</b>usuarios</div><div class="kpi"><b id="ac3K2">–</b>con permisos</div><div class="kpi"><b id="ac3K3">–</b>horario propio</div><div class="kpi"><b id="ac3K4">–</b>inactivos</div></div>' +
          '<button class="x" id="ac3X" title="Cerrar">✕</button></div>' +
        '<div class="body">' +
          '<div class="izq"><div class="tools"><input id="ac3Buscar" type="search" placeholder="🔎 Buscar por nombre, usuario o rol…" autocomplete="off">' +
            '<div class="seg" id="ac3Seg"><button data-v="todos" class="on">Todos</button><button data-v="sin">Sin permisos</button><button data-v="hor">Con horario propio</button><button data-v="inact">Inactivos</button></div></div>' +
            '<div class="lista" id="ac3Lista"><div class="cargando"><span class="spin"></span>Cargando usuarios, permisos y horarios…</div></div></div>' +
          '<div class="der" id="ac3Der"><div class="vacio"><div class="big">👈</div><div style="font-weight:800;font-size:15px;color:#0f172a">Elige a una persona</div><div>Verás a qué módulos entra y su horario de acceso, y podrás cambiarlos aquí mismo.</div></div></div>' +
        '</div>' +
        '<div class="toast" id="ac3Toast"></div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    $('ac3X').onclick = cerrar;
    $('ac3Buscar').oninput = function () { S.filtro = this.value.toLowerCase().trim(); pintarLista(); };
    $('ac3Seg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; S.vista = b.getAttribute('data-v'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); pintarLista(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) cerrar(); });
  }
  function toast(msg, ms) { var t = $('ac3Toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, ms || 2600); }
  function cerrar() {
    if (S.dirty && !confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?')) return;
    var ov = $('ac3Ov'); if (ov) ov.classList.remove('on');
    S.dirty = false;
  }

  /* ── lista ── */
  function colorAv(u) { var cs = ['#0a2463', '#1d4ed8', '#0369a1', '#7c3aed', '#15803d', '#b45309', '#be123c', '#0f766e']; var h = 0; for (var i = 0; i < u.length; i++) h = (h * 31 + u.charCodeAt(i)) >>> 0; return cs[h % cs.length]; }
  function pintarKpis() {
    var conP = 0, conH = 0, inac = 0;
    S.usuarios.forEach(function (u) { if (S.permisos[u.usuario]) conP++; if (S.horarios[u.usuario]) conH++; if (!u.activo) inac++; });
    $('ac3K1').textContent = S.usuarios.length; $('ac3K2').textContent = conP; $('ac3K3').textContent = conH; $('ac3K4').textContent = inac;
  }
  function pintarLista() {
    var L = $('ac3Lista'); if (!L) return;
    var f = S.filtro, v = S.vista;
    var lista = S.usuarios.filter(function (u) {
      if (f && (u.usuario + ' ' + u.nombre + ' ' + u.rol).toLowerCase().indexOf(f) < 0) return false;
      if (v === 'sin') return !S.permisos[u.usuario];
      if (v === 'hor') return !!S.horarios[u.usuario];
      if (v === 'inact') return !u.activo;
      return true;
    });
    if (!lista.length) { L.innerHTML = '<div class="vacio" style="padding:30px 10px"><div class="big">🔍</div>Ningún usuario coincide.</div>'; return; }
    L.innerHTML = lista.map(function (u) {
      var r = resumenUsuario(u);
      var hor = r.hor ? '<span class="tag hor">⏰ ' + esc(hTxt(r.hor.horaInicio)) + '–' + esc(hTxt(r.hor.horaFin)) + '</span>' : '<span class="tag gen">horario general</span>';
      var pm = r.tienePerm ? '<b>' + r.n + '<span style="color:#94a3b8;font-weight:600"> / ' + r.tot + '</span></b>módulos' : '<span class="tag sin">sin permisos</span>';
      return '<div class="u' + (S.sel === u.usuario ? ' sel' : '') + (u.activo ? '' : ' inact') + '" data-u="' + esc(u.usuario) + '">' +
        '<div class="av" style="background:' + colorAv(u.usuario) + '">' + esc(ini(u.nombre || u.usuario)) + '</div>' +
        '<div><div class="n">' + esc(u.nombre || u.usuario) + '</div><div class="m"><i style="background:' + rolColor(u.rol) + '"></i>' + esc(u.usuario) + ' · ' + esc(u.rol || '—') + (u.activo ? '' : ' · INACTIVO') + '</div><div class="m" style="margin-top:3px">' + hor + '</div></div>' +
        '<div class="r">' + pm + '</div></div>';
    }).join('');
    L.querySelectorAll('.u').forEach(function (el) { el.onclick = function () { seleccionar(el.getAttribute('data-u')); }; });
  }

  /* ── ficha ── */
  function seleccionar(u) {
    if (S.sel === u) return;
    if (S.dirty && !confirm('Tienes cambios sin guardar en ' + S.sel + '. ¿Descartarlos?')) return;
    S.sel = u; S.dirty = false; S.edit = null;
    pintarLista(); pintarFicha();
  }
  function usuarioSel() { for (var i = 0; i < S.usuarios.length; i++) if (S.usuarios[i].usuario === S.sel) return S.usuarios[i]; return null; }
  function pintarFicha() {
    var D = $('ac3Der'), u = usuarioSel(); if (!D || !u) return;
    var r = resumenUsuario(u);
    D.innerHTML =
      '<div class="who"><div class="av" style="background:' + colorAv(u.usuario) + '">' + esc(ini(u.nombre || u.usuario)) + '</div>' +
        '<div><div class="nm">' + esc(u.nombre || u.usuario) + '</div><div class="mt"><b>' + esc(u.usuario) + '</b> · ' + esc(u.rol || '—') + (u.empresa ? ' · ' + esc(u.empresa) : '') + (u.activo ? '' : ' · <span class="tag sin">INACTIVO</span>') +
        ' · ' + (r.tienePerm ? '<span class="tag def">' + r.n + ' de ' + r.tot + ' módulos</span>' : '<span class="tag sin">sin permisos definidos</span>') + ' · ' + (r.hor ? '<span class="tag hor">horario propio</span>' : '<span class="tag gen">horario general</span>') + '</div></div>' +
        '<div class="tabs"><button data-t="mod" class="' + (S.tab === 'mod' ? 'on' : '') + '">🧩 Módulos</button><button data-t="hor" class="' + (S.tab === 'hor' ? 'on' : '') + '">⏰ Horario</button></div></div>' +
      '<div class="pane" id="ac3Pane"></div>' +
      '<div class="ft"><div class="est" id="ac3Est"></div><div id="ac3Btns"></div></div>';
    D.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { if (S.dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de pestaña y descartarlos?')) return; S.dirty = false; S.edit = null; S.tab = b.getAttribute('data-t'); pintarFicha(); }; });
    if (S.tab === 'mod') pintarModulos(u, r); else pintarHorario(u, r);
  }
  function setDirty(v) { S.dirty = v; var e = $('ac3Est'); if (e && v) e.innerHTML = '<span class="dirty">● Cambios sin guardar</span>'; }

  /* ── pestaña modulos ── */
  function pintarModulos(u, r) {
    var P = $('ac3Pane'), p = S.permisos[u.usuario] || null;
    if (!S.edit) { S.edit = {}; S.cat.forEach(function (m) { S.edit[m.clave] = p ? !!p[m.clave] : false; }); }
    var otros = S.usuarios.filter(function (x) { return x.usuario !== u.usuario && S.permisos[x.usuario]; });
    P.innerHTML =
      (p ? '' : '<div class="estado gen" style="margin-bottom:12px"><span class="big">ℹ️</span><div><b>Todavía no tiene permisos definidos.</b> ' + (u.activo ? 'Si es un usuario antiguo ve el menú de siempre; si es nuevo solo ve Mi Dashboard, Mis Atenciones y Mis Estadísticas. ' : '') + 'En cuanto guardes, mandan los interruptores de abajo.</div></div>') +
      '<div class="barra"><span class="cnt"><b id="ac3N">0</b> de ' + S.cat.length + ' módulos permitidos</span>' +
        '<button class="mini" id="ac3Todos">✔ Marcar todos</button><button class="mini" id="ac3Nada">✕ Ninguno</button>' +
        '<select class="mini" id="ac3Copiar"><option value="">📋 Copiar de otro usuario…</option>' + otros.map(function (x) { return '<option value="' + esc(x.usuario) + '">' + esc(x.nombre || x.usuario) + ' (' + esc(x.usuario) + ')</option>'; }).join('') + '</select></div>' +
      grupos().map(function (g) {
        return '<div class="grp"><div class="gt"><span>' + g.ic + ' ' + esc(g.n) + '</span><span class="ln"></span><span class="gc" data-g="' + esc(g.n) + '"></span></div><div class="grid">' +
          g.ms.map(function (m) { return '<div class="mod' + (S.edit[m.clave] ? ' on' : '') + '" data-k="' + esc(m.clave) + '" title="' + esc(m.clave) + '"><span class="mi">' + m.ic + '</span><span class="mt">' + esc(m.etiqueta) + '<small>' + esc(m.clave) + '</small></span><span class="sw"></span></div>'; }).join('') +
          '</div></div>';
      }).join('');
    function cuenta() {
      var n = 0; S.cat.forEach(function (m) { if (S.edit[m.clave]) n++; }); $('ac3N').textContent = n;
      grupos().forEach(function (g) { var k = 0; g.ms.forEach(function (m) { if (S.edit[m.clave]) k++; }); var el = P.querySelector('.gc[data-g="' + g.n.replace(/"/g, '&quot;') + '"]'); if (el) el.textContent = k + '/' + g.ms.length; });
    }
    P.querySelectorAll('.mod').forEach(function (el) { el.onclick = function () { var k = el.getAttribute('data-k'); S.edit[k] = !S.edit[k]; el.classList.toggle('on', S.edit[k]); cuenta(); setDirty(true); }; });
    $('ac3Todos').onclick = function () { S.cat.forEach(function (m) { S.edit[m.clave] = true; }); P.querySelectorAll('.mod').forEach(function (el) { el.classList.add('on'); }); cuenta(); setDirty(true); };
    $('ac3Nada').onclick = function () { S.cat.forEach(function (m) { S.edit[m.clave] = false; }); P.querySelectorAll('.mod').forEach(function (el) { el.classList.remove('on'); }); cuenta(); setDirty(true); };
    $('ac3Copiar').onchange = function () { var o = S.permisos[this.value]; if (!o) return; S.cat.forEach(function (m) { S.edit[m.clave] = !!o[m.clave]; }); P.querySelectorAll('.mod').forEach(function (el) { el.classList.toggle('on', !!S.edit[el.getAttribute('data-k')]); }); cuenta(); setDirty(true); toast('Copiado de ' + this.value + ' (aún sin guardar)'); this.value = ''; };
    cuenta();
    $('ac3Est').innerHTML = p ? '<span style="color:#15803d">✔ Permisos definidos: mandan estos interruptores.</span>' : '';
    $('ac3Btns').innerHTML = '<button class="btn pri" id="ac3Guardar">💾 Guardar módulos</button>';
    $('ac3Guardar').onclick = guardarModulos;
  }
  async function guardarModulos() {
    var u = usuarioSel(), yo = usr(), btn = $('ac3Guardar'), est = $('ac3Est'); if (!u) return;
    var mods = {}; S.cat.forEach(function (m) { mods[m.clave] = !!S.edit[m.clave]; });
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      var d = await apiPost({ action: 'permisosGuardar', usuarioObjetivo: u.usuario, modulos: mods, usuario: yo.usuario, rol: yo.rol });
      if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo guardar');
      S.permisos[u.usuario] = Object.assign({}, mods); S.dirty = false;
      est.innerHTML = '<span style="color:#15803d">✔ Guardado: ' + d.permitidos + ' de ' + d.total + ' módulos para <b>' + esc(u.usuario) + '</b>. Lo verá al volver a iniciar sesión.</span>' +
        (String(u.usuario) === String(yo.usuario).toLowerCase() ? '<br><span style="color:#b45309">Ojo: te cambiaste los permisos a ti mismo.</span>' : '');
      toast('✔ Módulos guardados para ' + (u.nombre || u.usuario));
      pintarLista(); pintarKpis();
      var who = $('ac3Der').querySelector('.who .mt'); if (who) { var r = resumenUsuario(u); who.innerHTML = '<b>' + esc(u.usuario) + '</b> · ' + esc(u.rol || '—') + ' · <span class="tag def">' + r.n + ' de ' + r.tot + ' módulos</span> · ' + (r.hor ? '<span class="tag hor">horario propio</span>' : '<span class="tag gen">horario general</span>'); }
    } catch (e) { est.innerHTML = '<span style="color:#dc2626">Error: ' + esc(e.message) + '</span>'; }
    finally { btn.disabled = false; btn.textContent = '💾 Guardar módulos'; }
  }

  /* ── pestaña horario ── */
  function pintarHorario(u, r) {
    var P = $('ac3Pane'), h = r.hor;
    var ini0 = h ? (h.horaInicio || GEN_INI) : GEN_INI, fin0 = h ? (h.horaFin || GEN_FIN) : GEN_FIN;
    var dias0 = h ? (h.dias || [1, 2, 3, 4, 5, 6]).map(Number) : [1, 2, 3, 4, 5, 6];
    P.innerHTML =
      '<div class="estado ' + (h ? 'prop' : 'gen') + '" style="margin-bottom:12px"><span class="big">' + (h ? '⏰' : '🏢') + '</span><div>' +
        (h ? '<b>Tiene horario propio:</b> entra ' + esc(hTxt(h.horaInicio)) + ' y sale ' + esc(hTxt(h.horaFin)) + (h.activo === false ? ' <span class="tag sin">INACTIVO</span>' : '') + (h.desde ? ' · desde ' + esc(h.desde) : '') + (h.hasta ? ' · hasta ' + esc(h.hasta) : '') + (h.nota ? '<br><span style="opacity:.8">📝 ' + esc(h.nota) + '</span>' : '')
           : '<b>Usa el horario general:</b> ' + hTxt(GEN_INI) + ' a ' + hTxt(GEN_FIN) + '. Si guardas uno aquí, mandará el propio.') + '</div></div>' +
      '<div class="hcard"><div class="t">🕒 Franja de acceso</div><div class="f2">' +
        '<div><label class="l">Hora de entrada</label><input class="i" id="ac3Ini" type="time" value="' + esc(ini0) + '"></div>' +
        '<div><label class="l">Hora de salida</label><input class="i" id="ac3Fin" type="time" value="' + esc(fin0) + '"></div></div>' +
        '<div class="prev" id="ac3Prev"></div></div>' +
      '<div class="hcard"><div class="t">📅 Días en que puede entrar</div><div class="dias" id="ac3Dias">' + DIAS.map(function (d) { return '<span class="dia' + (dias0.indexOf(+d[0]) >= 0 ? ' on' : '') + '" data-d="' + d[0] + '">' + d[1] + '</span>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:6px;margin-top:8px"><button class="mini" data-set="1,2,3,4,5">Lun–Vie</button><button class="mini" data-set="1,2,3,4,5,6">Lun–Sáb</button><button class="mini" data-set="1,2,3,4,5,6,7">Todos</button></div></div>' +
      '<div class="hcard"><div class="t">📆 Vigencia y nota (opcional)</div><div class="f2">' +
        '<div><label class="l">Desde</label><input class="i" id="ac3Desde" type="date" value="' + esc(h && h.desde || '') + '"></div>' +
        '<div><label class="l">Hasta</label><input class="i" id="ac3Hasta" type="date" value="' + esc(h && h.hasta || '') + '"></div></div>' +
        '<div style="margin-top:10px"><label class="l">Nota</label><input class="i" id="ac3Nota" type="text" placeholder="Ej.: turno noche campaña" value="' + esc(h && h.nota || '') + '"></div></div>';
    function prev() {
      var i = $('ac3Ini').value, f = $('ac3Fin').value, av = $('ac3Prev');
      if (!i || !f) { av.textContent = 'Indica hora de entrada y de salida.'; return; }
      var mi = hMin(i), mf = hMin(f), cruza = f <= i, dur = cruza ? (1440 - mi + mf) : (mf - mi), dh = Math.floor(dur / 60), dm = dur % 60;
      var raro = !cruza && mf < 12 * 60 && dur < 6 * 60;
      var txt = '🕒 <b>Entra ' + hTxt(i) + '</b> y <b>sale ' + hTxt(f) + (cruza ? ' del día siguiente' : '') + '</b> · ' + dh + ' h' + (dm ? ' ' + dm + ' min' : '') + ' de acceso.';
      if (raro) txt += '<br><b>⚠️ ¿La salida es en la NOCHE?</b> Está como ' + hTxt(f) + ' — si querías ' + ((+f.slice(0, 2)) % 12 || 12) + ':' + f.slice(3, 5) + ' p. m., cambia la salida a <b>p. m.</b>';
      if (cruza) txt += '<br>Este horario <b>cruza la medianoche</b>: los días marcados son los de <b>entrada</b>.';
      av.innerHTML = txt; av.classList.toggle('raro', raro);
    }
    ['ac3Ini', 'ac3Fin'].forEach(function (id) { $(id).onchange = function () { prev(); setDirty(true); }; $(id).oninput = prev; });
    ['ac3Desde', 'ac3Hasta', 'ac3Nota'].forEach(function (id) { $(id).oninput = function () { setDirty(true); }; });
    P.querySelectorAll('.dia').forEach(function (el) { el.onclick = function () { el.classList.toggle('on'); setDirty(true); }; });
    P.querySelectorAll('[data-set]').forEach(function (b) { b.onclick = function () { var s = b.getAttribute('data-set').split(','); P.querySelectorAll('.dia').forEach(function (el) { el.classList.toggle('on', s.indexOf(el.getAttribute('data-d')) >= 0); }); setDirty(true); }; });
    prev();
    $('ac3Est').innerHTML = h ? '<span style="color:#15803d">✔ Horario propio vigente.</span>' : '<span style="color:#64748b">Sin horario propio: entra con el general.</span>';
    $('ac3Btns').innerHTML = (h ? '<button class="btn danger" id="ac3Quitar" style="margin-right:8px">🗑 Quitar horario propio</button>' : '') + '<button class="btn pri" id="ac3GuardarH">💾 Guardar horario</button>';
    $('ac3GuardarH').onclick = guardarHorario;
    if ($('ac3Quitar')) $('ac3Quitar').onclick = quitarHorario;
  }
  async function guardarHorario() {
    var u = usuarioSel(), yo = usr(), btn = $('ac3GuardarH'), est = $('ac3Est'); if (!u) return;
    var dias = []; document.querySelectorAll('#ac3Dias .dia.on').forEach(function (el) { dias.push(el.getAttribute('data-d')); });
    if (!dias.length) { est.innerHTML = '<span style="color:#b45309">Marca al menos un día.</span>'; return; }
    var hi = $('ac3Ini').value, hf = $('ac3Fin').value;
    if (!hi || !hf) { est.innerHTML = '<span style="color:#b45309">Indica hora de entrada y de salida.</span>'; return; }
    if (hf > hi && hMin(hf) < 12 * 60 && (hMin(hf) - hMin(hi)) < 6 * 60 &&
        !confirm('La hora de SALIDA está en la MAÑANA: ' + hTxt(hf) + '.\n\nEl usuario solo podrá entrar de ' + hTxt(hi) + ' a ' + hTxt(hf) + '.\n\n¿Es correcto?\n(Si querías de noche, pulsa Cancelar y cambia la salida a p. m.)')) return;
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      var d = await apiPost({ action: 'accesoHorarioGuardar', usuario: yo.usuario, rol: yo.rol,
        horario: { usuario: u.usuario, horaInicio: hi, horaFin: hf, dias: dias.join(','), desde: $('ac3Desde').value, hasta: $('ac3Hasta').value, nota: $('ac3Nota').value, activo: true } });
      if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo guardar');
      S.horarios[u.usuario] = { usuario: u.usuario, horaInicio: hi, horaFin: hf, dias: dias.map(Number), desde: $('ac3Desde').value, hasta: $('ac3Hasta').value, nota: $('ac3Nota').value, activo: true };
      S.dirty = false;
      toast('✔ Horario guardado para ' + (u.nombre || u.usuario));
      pintarLista(); pintarKpis(); pintarFicha();
      $('ac3Est').innerHTML = '<span style="color:#15803d">✔ Guardado: <b>' + esc(d.horario || (hTxt(hi) + ' a ' + hTxt(hf))) + '</b>' + (d.cruzaMedianoche ? ' (cruza la medianoche)' : '') + (d.desde ? ' · desde ' + esc(d.desde) : '') + '. ' + esc(d.aviso || '') + '</span>';
    } catch (e) { est.innerHTML = '<span style="color:#dc2626">Error: ' + esc(e.message) + '</span>'; btn.disabled = false; btn.textContent = '💾 Guardar horario'; }
  }
  async function quitarHorario() {
    var u = usuarioSel(), yo = usr(), est = $('ac3Est'); if (!u) return;
    if (!confirm('¿Quitar el horario propio de ' + u.usuario + '?\n\nVolverá al horario general ' + hTxt(GEN_INI) + ' a ' + hTxt(GEN_FIN) + '.')) return;
    try {
      var d = await apiPost({ action: 'accesoHorarioEliminar', usuario: yo.usuario, rol: yo.rol, destino: u.usuario });
      if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo quitar');
      delete S.horarios[u.usuario]; S.dirty = false;
      toast('Horario propio quitado: vuelve al general');
      pintarLista(); pintarKpis(); pintarFicha();
      $('ac3Est').innerHTML = '<span style="color:#15803d">' + esc(d.aviso || 'Listo.') + '</span>';
    } catch (e) { est.innerHTML = '<span style="color:#dc2626">Error: ' + esc(e.message) + '</span>'; }
  }

  /* ── abrir ── */
  async function abrir() {
    if (!esAdmin()) { alert('Solo un administrador puede cambiar permisos.'); return; }
    construir();
    var ov = $('ac3Ov'); ov.classList.add('on');
    S.cat = catalogo();
    if (!S.cargado) {
      $('ac3Lista').innerHTML = '<div class="cargando"><span class="spin"></span>Cargando usuarios, permisos y horarios…</div>';
      try { await cargarTodo(false); }
      catch (e) { $('ac3Lista').innerHTML = '<div class="vacio" style="padding:30px 10px"><div class="big">⚠️</div><div><b>No se pudo cargar.</b><br>' + esc(e.message) + '</div><button class="mini" id="ac3Re">Reintentar</button></div>'; $('ac3Re').onclick = function () { S.cargado = false; abrir(); }; return; }
      if (S.errP) toast('⚠️ No se pudieron leer los permisos guardados (la lista puede mostrar "sin permisos")', 5000);
    } else {
      /* refresco silencioso en segundo plano para no esperar */
      cargarTodo(true).then(function () { pintarLista(); pintarKpis(); if (S.sel && !S.dirty) pintarFicha(); }).catch(function () {});
    }
    pintarKpis(); pintarLista();
    if (S.sel) pintarFicha();
    setTimeout(function () { try { $('ac3Buscar').focus(); } catch (e) {} }, 80);
  }
  window.accesoAbrir = abrir;

  /* el boton del menu (🔐 Acceso a Modulos) abre esta pantalla; si algo fallara, abre la de siempre */
  document.addEventListener('click', function (ev) {
    try {
      var t = ev.target, b = t && t.closest ? t.closest('#navPermisos') : null;
      if (!b) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      try { abrir(); } catch (e) { console.warn('[_ACCESO_UI_V3] fallo, se abre la pantalla anterior:', e); if (typeof window.permAbrir === 'function') window.permAbrir(); }
    } catch (e) {}
  }, true);
  console.log('[_ACCESO_UI_V3] listo');
})();
