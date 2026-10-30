/* dashboard.html · bloque 19 (antes en la linea 12494) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _PERMISOS_UI_V1 (13-set-2026) — administrar el acceso a los modulos
   ---------------------------------------------------------------------------
   QUE RESUELVE
   Hoy el acceso a cada modulo se decide con listas de usuarios escritas a
   mano dentro del codigo. Dar de alta a alguien obliga a editar y publicar.
   Con esto, el administrador marca casillas y guarda.

   COMO NO ROMPE NADA — leelo, porque es el corazon del asunto
   El aplicador solo actua sobre usuarios que TIENEN permisos definidos en la
   hoja. Si un usuario no tiene ninguna fila, no se le toca: el menu le queda
   exactamente como hoy, con las reglas de siempre. Asi se migra de a uno,
   empezando por los usuarios nuevos, sin arriesgar a los que ya trabajan.

   Ademas, si la consulta al servidor falla por lo que sea, no se oculta nada.
   El error nunca deja a nadie sin acceso.

   EL CATALOGO NO ESTA ESCRITO A MANO
   Los modulos se leen del propio menu al cargar la pagina. Si manana agregas
   un boton nuevo al menu, aparece solo en la pantalla de permisos.

   POR QUE UN OBSERVADOR Y NO UN INTERVALO
   En el dashboard hay un setInterval que cada 2 segundos vuelve a encender
   Acumulacion de Horas para tres usuarios. Si yo aplicara los permisos una
   sola vez, esa regla los volveria a encender despues. Se usa un observador
   del menu: cuando algo cambia la visibilidad de un boton, se vuelve a
   aplicar el permiso. Sin pelear con relojes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var PERM_ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02',
                        'admin', 'admin01', 'admin02'];
var _permMios   = null;    // permisos del usuario actual (null = no aplicar)
var _permObs    = null;
var _permCatalogo = null;

/* _PERM_VELO_V1 (23-set-2026): el menu y el contenido quedan tapados hasta saber
   que modulos tiene el usuario (maximo 8 s). Si ya se conocen de la vez anterior
   (memoria del navegador) se aplican al instante, sin esperar al servidor. */
var _PERM_LS = null, _permVeloT = null;
function _permQuitarVelo() { try { var v = document.getElementById('permVelo'); if (v) v.remove(); if (_permVeloT) { clearTimeout(_permVeloT); _permVeloT = null; } } catch (e) {} }
(function () {
  try {
    var u = JSON.parse(sessionStorage.getItem('user') || 'null');
    if (!u || !u.usuario) return;
    var r = String(u.rol || '').toLowerCase().trim();
    /* _PERM_VELO_ADMIN_V1 (15-oct-2026): antes el velo no se aplicaba a los administradores, y a uno con
       modulos recortados (p. ej. lcastillo) se le veia TODO el menu y el dashboard por un instante antes de
       ocultarse. Ahora el velo aplica a todos salvo jtimoteo. Si los permisos fallan, el administrador
       sigue viendo su menu completo (como hoy). */
    if (String(u.usuario).toLowerCase().trim() === 'jtimoteo') return;
    if (['coordinador','jefa_rl'].indexOf(r) >= 0) return;
    _PERM_LS = 'rl_perm_' + String(u.usuario).toLowerCase().trim();
    var prev = null; try { prev = localStorage.getItem(_PERM_LS); } catch (e) {}
    if (prev === '"__vacio__"') return;   // usuario antiguo sin permisos: menu de siempre, sin velo
    var st = document.createElement('style'); st.id = 'permVelo';
    st.textContent = '#sb .nav, .content{visibility:hidden !important}';
    (document.head || document.documentElement).appendChild(st);
    _permVeloT = setTimeout(function () {   /* _PERM_BLINDAJE_V1: si tarda, NO se abre el menu completo */
      if (typeof window._permFallo === 'function' && !_permMios) window._permFallo('lento'); else _permQuitarVelo();
    }, 8000);
    var c = null; try { c = JSON.parse(prev || 'null'); } catch (e) {}
    if (c && typeof c === 'object') {
      var aplicarYa = function () { _permMios = c; permAplicar(); permObservar(); _permQuitarVelo(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarYa); else aplicarYa();
    }
  } catch (e) { _permQuitarVelo(); }
})();
function _permGuardarLS(m) { try { if (_PERM_LS) { localStorage.setItem(_PERM_LS, JSON.stringify(m || '__vacio__')); } } catch (e) {} }
/* Si "Mi Dashboard" no esta permitido: se oculta y se abre el primer modulo permitido */
function _permIrPermitido() {
  try {
    if (!_permMios || _permMios['mod_dashboard'] !== false) return;
    var sec = document.getElementById('sec-dashboard');
    var enDash = sec && sec.classList.contains('on');
    if (!enDash) return;
    var cat = permCatalogo(), destino = null;
    for (var i = 0; i < cat.length; i++) {
      if (_permMios[cat[i].clave] && /ir\('/.test(cat[i].boton.getAttribute('onclick') || '')) { destino = cat[i].boton; break; }
    }
    if (destino) { destino.click(); return; }
    sec.classList.remove('on');
    var msg = document.getElementById('permSinDash');
    if (!msg) {
      msg = document.createElement('div'); msg.id = 'permSinDash'; msg.className = 'sec on';
      msg.innerHTML = '<div style="padding:40px;text-align:center;color:#475569;font-size:14px">Elige un módulo en el menú de la izquierda.</div>';
      sec.parentNode.insertBefore(msg, sec);
    }
  } catch (e) {}
}

function _permEsAdmin() {
  try {
    var r = String((USER && USER.rol) || '').toLowerCase().trim();
    return PERM_ROLES_ADMIN.indexOf(r) >= 0;
  } catch (e) { return false; }
}

/* ── El catalogo sale del menu, no de una lista escrita a mano ── */
function permCatalogo() {
  if (_permCatalogo) return _permCatalogo;
  var out = [];
  try {
    document.querySelectorAll('nav button.ni').forEach(function (b) {
      var oc = b.getAttribute('onclick') || '';
      var clave = b.id;
      if (!clave) {
        var m = oc.match(/ir\('([^']+)'/) || oc.match(/location\.href='([^']+?)(\.html)?'/);
        clave = m ? ('mod_' + m[1].replace(/[^A-Za-z0-9_-]/g, '')) : '';
      }
      if (!clave) return;
      if (clave === 'navInicio') return;              // volver al hub: no se restringe
      var texto = (b.textContent || '').replace(/\s+/g, ' ').trim()
                   .replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').replace(/\d+$/, '').trim();
      out.push({ clave: clave, etiqueta: texto || clave, boton: b });
    });
  } catch (e) { console.warn('[_PERMISOS_UI_V1] catalogo:', e); }
  _permCatalogo = out;
  return out;
}

/* ── Aplicar los permisos del usuario actual al menu ── */
function permAplicar() {
  if (!_permMios) return;                    // sin permisos definidos -> no se toca nada
  /* _PERM_PAGINA_V1 (29-oct-2026): se guardan en la sesion de la pestana para que cada pagina respete lo asignado */
  try { sessionStorage.setItem('rl_perm_mios', JSON.stringify(_permMios)); } catch (e) {}
  permCatalogo().forEach(function (m) {
    if (!(m.clave in _permMios)) return;     // modulo sin definir -> se respeta lo de hoy
    var deseado = _permMios[m.clave] ? '' : 'none';
    if (m.boton.style.display !== deseado) m.boton.style.display = deseado;
  });
  _permIrPermitido();   /* _PERM_VELO_V1 */
  /* _PERM_SOLO_ASIGNADO_V1: el boton Acceso a Modulos se crea aparte; si se lo quitaron, se oculta */
  try { var _bp = document.getElementById('navPermisos'), _yo2 = String((USER && USER.usuario) || '').toLowerCase().trim();
        if (_bp && _yo2 !== 'jtimoteo' && _permMios.navPermisos === false) _bp.style.display = 'none'; } catch (e) {}
}

function permObservar() {
  if (_permObs || !_permMios) return;
  var nav = document.querySelector('nav');
  if (!nav || typeof MutationObserver === 'undefined') return;
  _permObs = new MutationObserver(function () { permAplicar(); });
  _permObs.observe(nav, { attributes: true, subtree: true, attributeFilter: ['style'] });
}

/* ── Al iniciar sesion: preguntar por los permisos propios ── */
async function permCargarMios() {
  try {
    if (typeof USER === 'undefined' || !USER || !USER.usuario) return;
    var d = await apiPost({ action: 'permisosListar', usuario: USER.usuario, rol: USER.rol });
    if (d && d.success && d.porDefecto) {   /* _PERM_DEFECTO_V1: usuario nuevo sin permisos asignados */
      var _ok = d.permitidos || [];
      _permMios = {};
      permCatalogo().forEach(function (m) { _permMios[m.clave] = _ok.indexOf(m.clave) >= 0; });
      console.log('[_PERMISOS_UI_V1] ' + USER.usuario + ' es nuevo y aun no tiene modulos asignados: solo ' + _ok.join(', '));
      permAplicar();
      permObservar();
      _permGuardarLS(_permMios); _permQuitarVelo();
      return;
    }
    if ((!d || !d.success) && typeof window._permFallo === 'function') { window._permFallo('error'); return; }   /* _PERM_BLINDAJE_V1 */
    if (!d || !d.success || d.vacio) {
      if (typeof window._permRestaurar === 'function') window._permRestaurar();   /* _PERM_BLINDAJE_V1 */
      console.log('[_PERMISOS_UI_V1] sin permisos definidos para ' + USER.usuario +
                  ' -> el menu queda como siempre');
      if (d && d.success && d.vacio) _permGuardarLS(null);
      _permQuitarVelo();
      return;
    }
    _permMios = d.permisos || null;
    var n = Object.keys(_permMios || {}).length;
    console.log('[_PERMISOS_UI_V1] ' + n + ' modulos definidos para ' + USER.usuario);
    permAplicar();
    permObservar();
    _permGuardarLS(_permMios); _permQuitarVelo();
  } catch (e) {
    console.warn('[_PERMISOS_UI_V1] no se pudieron leer los permisos:', e);
    if (typeof window._permFallo === 'function') window._permFallo('error'); else _permQuitarVelo();   /* _PERM_BLINDAJE_V1 */
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANTALLA DE ADMINISTRACION
   ═══════════════════════════════════════════════════════════════════════════ */
function permCrearModal() {
  if (document.getElementById('permOverlay')) return;
  var d = document.createElement('div');
  d.id = 'permOverlay';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,40,.62);z-index:10200;' +
                    'display:none;align-items:center;justify-content:center;padding:20px';
  d.onclick = function (e) { if (e.target === d) permCerrar(); };
  d.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:620px;max-height:88vh;' +
      'display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.35)" onclick="event.stopPropagation()">' +
      '<div style="padding:18px 22px 14px;border-bottom:1px solid #e2e8f0">' +
        '<div style="font-size:17px;font-weight:800;color:#0a2463">🔐 Acceso a módulos</div>' +
        '<div style="font-size:12.5px;color:#64748b;margin-top:3px">' +
          'Marca los módulos a los que esta persona puede entrar. Se guarda al instante y ' +
          'aplica la próxima vez que inicie sesión.</div>' +
      '</div>' +
      '<div style="padding:14px 22px 0">' +
        '<label style="font-size:12px;font-weight:700;color:#475569">Usuario</label>' +
        '<select id="permUsuario" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
          'border-radius:8px;font-size:14px;margin-top:4px"><option value="">Cargando…</option></select>' +
        '<div id="permEstado" style="font-size:12px;margin-top:8px;color:#64748b"></div>' +
      '</div>' +
      '<div id="permLista" style="flex:1;overflow-y:auto;padding:12px 22px 4px"></div>' +
      '<div style="padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;gap:8px;' +
        'justify-content:space-between;align-items:center">' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm" style="background:#f1f5f9;border:none;border-radius:7px;' +
            'padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer" onclick="permTodos(true)">Marcar todos</button>' +
          '<button class="btn btn-sm" style="background:#f1f5f9;border:none;border-radius:7px;' +
            'padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer" onclick="permTodos(false)">Ninguno</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm" style="background:#f1f5f9;border:none;border-radius:7px;' +
            'padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer" onclick="permCerrar()">Cerrar</button>' +
          '<button id="permBtnGuardar" class="btn btn-sm" style="background:#0a2463;color:#fff;border:none;' +
            'border-radius:7px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer" ' +
            'onclick="permGuardar()">Guardar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
}

function permCerrar() {
  var o = document.getElementById('permOverlay');
  if (o) o.style.display = 'none';
}


/* _PERM_USUARIOS_AZURE_V1 (15-oct-2026): la lista de usuarios para Acceso a Modulos sale primero de
   AZURE (/usuarios/lista, con el login firmado); Google queda de respaldo. Antes solo iba a Google y
   si Google respondia mal (p. ej. "Accion no reconocida: undefined" bajo carga) la lista quedaba vacia. */
async function _permListaUsuarios() {
  try {
    var tk = sessionStorage.getItem('rl_token');
    if (tk && typeof AZURE_FN_BASE !== 'undefined' && window.AbortController) {
      var ctl = new AbortController(); var t = setTimeout(function () { ctl.abort(); }, 8000);
      var r = await fetch(AZURE_FN_BASE + '/usuarios/lista', { method: 'GET', signal: ctl.signal, headers: { 'Authorization': 'Bearer ' + tk } });
      clearTimeout(t);
      var j = await r.json();
      if (j && j.success && Array.isArray(j.data) && j.data.length) {
        return { success: true, fuente: 'azure', usuarios: j.data.map(function (u) { return { usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo !== false }; })
          .sort(function (a, b) { return String(a.usuario).localeCompare(String(b.usuario)); }) };
      }
    }
  } catch (e) { console.warn('[_PERM_USUARIOS_AZURE_V1] Azure: ' + (e && e.message) + ' -> Google'); }
  var d = await apiPost({ action: 'permisosUsuarios', usuario: USER.usuario, rol: USER.rol });
  if ((!d || !d.success) ) {   /* Google respondio mal: un reintento */
    await new Promise(function (r) { setTimeout(r, 1500); });
    d = await apiPost({ action: 'permisosUsuarios', usuario: USER.usuario, rol: USER.rol });
  }
  return d;
}
async function permAbrir() {
  if (!_permEsAdmin()) { alert('Solo un administrador puede cambiar permisos.'); return; }
  permCrearModal();
  document.getElementById('permOverlay').style.display = 'flex';
  permPintarLista({});
  var sel = document.getElementById('permUsuario');
  sel.innerHTML = '<option value="">Cargando…</option>';
  try {
    var d = await _permListaUsuarios();   /* _PERM_USUARIOS_AZURE_V1 */
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo leer la lista');
    sel.innerHTML = '<option value="">— elige un usuario —</option>' +
      d.usuarios.map(function (u) {
        return '<option value="' + u.usuario + '">' + (u.activo ? '' : '⚠ ') + u.usuario +
               (u.nombre ? ' · ' + u.nombre : '') + (u.rol ? '  (' + u.rol + ')' : '') +
               (u.activo ? '' : '  — INACTIVO') + '</option>';
      }).join('');
    sel.onchange = permCargarDeUsuario;
  } catch (e) {
    sel.innerHTML = '<option value="">Error: ' + e.message + '</option>';
  }
}

function permPintarLista(marcados, hayFilas) {
  var cont = document.getElementById('permLista');
  if (!cont) return;
  var cat = permCatalogo();
  if (!cat.length) { cont.innerHTML = '<div style="color:#b45309">No encontré módulos en el menú.</div>'; return; }
  cont.innerHTML = cat.map(function (m) {
    var on = !!marcados[m.clave];
    return '<label style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid #e2e8f0;' +
      'border-radius:9px;margin-bottom:6px;cursor:pointer;background:' + (on ? '#f0f7ff' : '#fff') + '">' +
      '<input type="checkbox" data-perm="' + m.clave + '"' + (on ? ' checked' : '') +
        ' style="width:17px;height:17px;cursor:pointer">' +
      '<span style="flex:1;font-size:13.5px;color:#0f172a">' + m.etiqueta + '</span>' +
      '<span style="font-size:10.5px;color:#94a3b8;font-family:monospace">' + m.clave + '</span></label>';
  }).join('');
  cont.querySelectorAll('input[data-perm]').forEach(function (c) {
    c.onchange = function () { c.closest('label').style.background = c.checked ? '#f0f7ff' : '#fff'; };
  });
}

async function permCargarDeUsuario() {
  var u = document.getElementById('permUsuario').value;
  var est = document.getElementById('permEstado');
  if (!u) { permPintarLista({}); est.textContent = ''; return; }
  est.textContent = 'Leyendo permisos…';
  try {
    var d = await apiPost({ action: 'permisosListar', usuario: USER.usuario, rol: USER.rol, todos: true });
    var todos = (d && d.permisos) || {};
    var mios = todos[u] || null;
    permPintarLista(mios || {});
    est.innerHTML = mios
      ? '<span style="color:#15803d">Este usuario ya tiene permisos definidos: mandan estas casillas.</span>'
      : '<span style="color:#b45309">Todavía no tiene permisos definidos. Si es un usuario antiguo, ve el menú de siempre; si es NUEVO, solo ve Mi Dashboard, Mis Atenciones y Mis Estadísticas. ' +
        'En cuanto guardes, mandan estas casillas.</span>';
  } catch (e) {
    est.textContent = 'Error: ' + e.message;
  }
}

function permTodos(v) {
  document.querySelectorAll('#permLista input[data-perm]').forEach(function (c) {
    c.checked = v; c.closest('label').style.background = v ? '#f0f7ff' : '#fff';
  });
}

async function permGuardar() {
  var u = document.getElementById('permUsuario').value;
  var est = document.getElementById('permEstado');
  if (!u) { est.innerHTML = '<span style="color:#dc2626">Elige un usuario primero.</span>'; return; }

  var mods = {};
  document.querySelectorAll('#permLista input[data-perm]').forEach(function (c) {
    mods[c.getAttribute('data-perm')] = c.checked;
  });

  var btn = document.getElementById('permBtnGuardar');
  var txt = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando…';
  est.textContent = '';
  try {
    var d = await apiPost({ action: 'permisosGuardar', usuarioObjetivo: u, modulos: mods,
                            usuario: USER.usuario, rol: USER.rol });
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo guardar');
    est.innerHTML = '<span style="color:#15803d">✔ Guardado: ' + d.permitidos + ' de ' +
                    d.total + ' módulos permitidos para ' + u +
                    '. Lo verá al volver a iniciar sesión.</span>' +
      '<br><span style="color:#64748b;font-size:11.5px">Los permisos son inmediatos. Si ' +
      'acabas de crear a esta persona, además tiene que llegar a Azure para poder entrar: ' +
      'la sincronización corre sola cada hora, o se adelanta ejecutando ' +
      'syncUsuariosAAzure desde Apps Script.</span>';
    if (String(u).toLowerCase() === String(USER.usuario).toLowerCase()) {
      est.innerHTML += '<br><span style="color:#b45309">Ojo: te cambiaste los permisos a ti mismo.</span>';
    }
  } catch (e) {
    est.innerHTML = '<span style="color:#dc2626">Error: ' + e.message + '</span>';
  } finally {
    btn.disabled = false; btn.textContent = txt;
  }
}

/* ── Boton en el menu, solo para administradores ── */
function permAgregarBoton() {
  try {
    if (!_permEsAdmin() || document.getElementById('navPermisos')) return;
    /* _PERM_SOLO_ASIGNADO_V1 (15-oct-2026): "Acceso a Modulos" lo ve jtimoteo siempre; otro administrador
       solo si no se lo quitaron en sus permisos (navPermisos = false lo oculta) */
    try { var _yo = String((USER && USER.usuario) || '').toLowerCase().trim(); if (_yo !== 'jtimoteo' && _permMios && _permMios.navPermisos === false) return; } catch (e) {}
    var ref = document.getElementById('navUsr');            // junto a Gestion Usuarios
    if (!ref || !ref.parentNode) return;
    var b = document.createElement('button');
    b.className = 'ni'; b.id = 'navPermisos';
    b.innerHTML = '<span class="ic">🔐</span>Acceso a Módulos';
    b.onclick = permAbrir;
    ref.parentNode.insertBefore(b, ref.nextSibling);
  } catch (e) { console.warn('[_PERMISOS_UI_V1] boton:', e); }
}

window.permAbrir = permAbrir;  window.permCerrar = permCerrar;
window.permGuardar = permGuardar;  window.permTodos = permTodos;
window.permCatalogo = permCatalogo;

function permIniciar() {
  /* _PERM_VELO_V1: se pregunta apenas exista la sesion (USER se arma en window.onload) */
  (function esperar(n) {
    var listo = false; try { listo = typeof USER !== 'undefined' && USER && USER.usuario; } catch (e) {}
    if (listo) { permCargarMios(); return; }
    if (n < 60) setTimeout(function () { esperar(n + 1); }, 150); else _permQuitarVelo();
  })(0);
  setTimeout(function () { permAgregarBoton(); }, 1500);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', permIniciar);
else permIniciar();

/* ═══════════════════════════════════════════════════════════════════════════
   _PERM_BLINDAJE_V1 (26-set-2026) — los permisos de modulos ya no se "abren"
   ANTES: si la consulta de permisos fallaba o tardaba (Google lento), el menu
   quedaba COMPLETO y cualquiera podia entrar a cualquier modulo; y ocultar el
   boton no impedia abrir el modulo por otro camino.
   AHORA: 1) si falla o tarda -> ultimos permisos conocidos de esa persona; si no
   hay, solo lo basico (Mi Dashboard, Mis Atenciones, Mis Estadisticas) y se
   reintenta cada 15 s;  2) candado en ir(): un modulo no permitido no se abre.
   Administradores y usuarios antiguos sin permisos guardados: sin cambios.
   ═══════════════════════════════════════════════════════════════════════════ */
var _PERM_BASICOS = ['mod_dashboard', 'navAt', 'navMisEstadisticas'];
var _permTemporal = null, _permReint = 0;
window._permFallo = function (motivo) {
  try {
    if (typeof USER === 'undefined' || !USER || _permEsAdmin()) { _permQuitarVelo(); return; }
    var cache = null;
    try { cache = JSON.parse(localStorage.getItem(_PERM_LS) || 'null'); } catch (e) {}
    if (cache === '__vacio__') { _permQuitarVelo(); return; }          // usuario antiguo sin permisos: menu de siempre
    if (cache && typeof cache === 'object') {
      _permMios = cache;
      console.warn('[_PERM_BLINDAJE_V1] permisos no disponibles (' + motivo + '): se usan los ultimos conocidos');
    } else if (!_permMios) {
      var tmp = {}, ocultos = [];
      permCatalogo().forEach(function (m) {
        tmp[m.clave] = _PERM_BASICOS.indexOf(m.clave) >= 0;
        if (!tmp[m.clave] && m.boton.style.display !== 'none') ocultos.push(m.boton);
      });
      _permTemporal = ocultos;
      _permMios = tmp;
      console.warn('[_PERM_BLINDAJE_V1] permisos no disponibles (' + motivo + '): solo modulos basicos hasta leerlos');
    }
    permAplicar(); permObservar(); _permQuitarVelo();
    if (motivo !== 'lento' && ++_permReint <= 8) setTimeout(function () { try { permCargarMios(); } catch (e) {} }, 15000);
  } catch (e) { try { _permQuitarVelo(); } catch (e2) {} }
};
/* llego "vacio" (usuario antiguo) despues de haber puesto solo lo basico: se devuelve su menu */
window._permRestaurar = function () {
  try {
    if (!_permTemporal) return;
    _permMios = null;
    if (_permObs) { _permObs.disconnect(); _permObs = null; }
    _permTemporal.forEach(function (b) { b.style.display = ''; });
    _permTemporal = null;
  } catch (e) {}
};
/* candado: un modulo no permitido no se abre por ningun camino */
(function () {
  if (window._rlPermCandadoOk) return;
  var irPrevio = window.ir;
  if (typeof irPrevio !== 'function') return;
  window._rlPermCandadoOk = true;
  window.ir = function (id) {
    try {
      if (_permMios) {
        var cat = permCatalogo();
        for (var i = 0; i < cat.length; i++) {
          var oc = cat[i].boton.getAttribute('onclick') || '';
          if (oc.indexOf("ir('" + id + "'") >= 0 && _permMios[cat[i].clave] === false) {
            try { mostrarToast('🔒 No tienes acceso a este módulo. Si lo necesitas, pídelo a Coordinación.', 'error'); } catch (e) {}
            console.warn('[_PERM_BLINDAJE_V1] bloqueado: ' + id);
            return;
          }
        }
      }
    } catch (e) {}
    return irPrevio.apply(this, arguments);
  };
})();

console.log('[_PERMISOS_UI_V1] listo');
})();
