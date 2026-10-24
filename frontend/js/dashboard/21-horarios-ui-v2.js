/* dashboard.html · bloque 21 (antes en la linea 13077) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _HORARIOS_UI_V2 (17-set-2026) ══════════════════
   Pestana HORARIOS dentro de 🔐 Acceso a modulos.

   El administrador elige a la persona, escribe su hora de entrada y de
   salida, marca los dias y, si aplica, desde que fecha. Guarda y listo:
   surte efecto en el siguiente ingreso de esa persona, sin republicar nada.

   NO EDITA NADA DE LO EXISTENTE
   Envuelve permAbrir y, una sola vez, inyecta una barra de pestanas dentro
   del modal que ya existe. Los bloques originales del modal se muestran u
   ocultan; su codigo no se toca. Si algo aqui fallara, permAbrir sigue
   abriendo la pantalla de modulos como hoy.

   Soporta horarios que cruzan la medianoche (20:00 a 10:00 del dia siguiente):
   el backend lo resuelve; aqui solo se avisa en pantalla.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var DIAS = [['1','Lun'],['2','Mar'],['3','Mié'],['4','Jue'],['5','Vie'],['6','Sáb'],['7','Dom']];
var _horInyectado = false;

function _horEsAdmin() {
  try {
    var r = String((USER && USER.rol) || '').toLowerCase().trim();
    return ['administrador','administrador 01','administrador 02','admin','admin01','admin02']
             .indexOf(r) >= 0 || String(USER.usuario||'').toLowerCase() === 'jtimoteo';
  } catch (e) { return false; }
}

function _horPartes() {
  var ov = document.getElementById('permOverlay');
  if (!ov) return null;
  var card = ov.firstElementChild;
  if (!card) return null;
  var hijos = Array.prototype.slice.call(card.children);
  return { card: card, cabecera: hijos[0], resto: hijos.slice(1) };
}

/* ── Inyecta la barra de pestanas y el panel de horarios (una sola vez) ── */
function _horInyectar() {
  if (_horInyectado) return true;
  var p = _horPartes();
  if (!p) return false;

  var barra = document.createElement('div');
  barra.id = 'horTabs';
  barra.style.cssText = 'display:flex;gap:6px;padding:0 22px;border-bottom:1px solid #e2e8f0;background:#f8fafc';
  barra.innerHTML =
    '<button id="horTabMod" type="button" style="border:none;background:none;padding:11px 14px;font-size:13px;' +
      'font-weight:800;cursor:pointer;color:#0a2463;border-bottom:3px solid #0a2463">Módulos</button>' +
    '<button id="horTabHor" type="button" style="border:none;background:none;padding:11px 14px;font-size:13px;' +
      'font-weight:800;cursor:pointer;color:#64748b;border-bottom:3px solid transparent">Horarios</button>';
  p.cabecera.parentNode.insertBefore(barra, p.cabecera.nextSibling);

  var panel = document.createElement('div');
  panel.id = 'horPanel';
  panel.style.cssText = 'display:none;flex-direction:column;overflow-y:auto;padding:14px 22px 18px;flex:1';
  panel.innerHTML =
    '<div style="font-size:12.5px;color:#64748b;margin-bottom:12px;line-height:1.55">' +
      'El horario general del sistema es <b>05:30 a 17:00</b>. Aquí defines a quién se le cambia. ' +
      'Quien no tenga horario propio sigue con el general.</div>' +
    '<label style="font-size:12px;font-weight:700;color:#475569">Usuario</label>' +
    '<select id="horUsuario" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;border-radius:8px;' +
      'font-size:14px;margin:4px 0 12px"><option value="">Cargando…</option></select>' +
    '<div style="display:flex;gap:10px;margin-bottom:12px">' +
      '<div style="flex:1"><label style="font-size:12px;font-weight:700;color:#475569">Entrada</label>' +
        '<input id="horIni" type="time" value="05:30" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
        'border-radius:8px;font-size:14px;margin-top:4px"></div>' +
      '<div style="flex:1"><label style="font-size:12px;font-weight:700;color:#475569">Salida</label>' +
        '<input id="horFin" type="time" value="17:00" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
        'border-radius:8px;font-size:14px;margin-top:4px"></div>' +
    '</div>' +
    '<div id="horCruza" style="display:none;font-size:12px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;' +
      'border-radius:8px;padding:8px 10px;margin-bottom:12px"></div>' +
    '<label style="font-size:12px;font-weight:700;color:#475569">Días</label>' +
    '<div id="horDias" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px"></div>' +
    '<div style="display:flex;gap:10px;margin-bottom:12px">' +
      '<div style="flex:1"><label style="font-size:12px;font-weight:700;color:#475569">Desde (opcional)</label>' +
        '<input id="horDesde" type="date" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
        'border-radius:8px;font-size:14px;margin-top:4px"></div>' +
      '<div style="flex:1"><label style="font-size:12px;font-weight:700;color:#475569">Hasta (opcional)</label>' +
        '<input id="horHasta" type="date" style="width:100%;padding:8px 10px;border:1.5px solid #c0ceea;' +
        'border-radius:8px;font-size:14px;margin-top:4px"></div>' +
    '</div>' +
    '<label style="font-size:12px;font-weight:700;color:#475569">Nota (opcional)</label>' +
    '<input id="horNota" type="text" placeholder="Ej.: turno noche campaña" style="width:100%;padding:8px 10px;' +
      'border:1.5px solid #c0ceea;border-radius:8px;font-size:14px;margin:4px 0 12px">' +
    '<div id="horEstado" style="font-size:12.5px;color:#64748b;min-height:20px;margin-bottom:12px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center">' +
      '<button id="horBtnQuitar" type="button" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:7px;' +
        'padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Quitar horario propio</button>' +
      '<button id="horBtnGuardar" type="button" style="background:#0a2463;color:#fff;border:none;border-radius:7px;' +
        'padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer">Guardar horario</button>' +
    '</div>';
  p.card.appendChild(panel);

  document.getElementById('horDias').innerHTML = DIAS.map(function (d) {
    var on = d[0] !== '7';
    return '<label style="display:flex;align-items:center;gap:5px;border:1px solid #e2e8f0;border-radius:8px;' +
      'padding:6px 9px;cursor:pointer;font-size:12.5px;background:' + (on ? '#f0f7ff' : '#fff') + '">' +
      '<input type="checkbox" data-dia="' + d[0] + '"' + (on ? ' checked' : '') + '>' + d[1] + '</label>';
  }).join('');
  document.querySelectorAll('#horDias input[data-dia]').forEach(function (c) {
    c.onchange = function () { c.closest('label').style.background = c.checked ? '#f0f7ff' : '#fff'; };
  });

  document.getElementById('horTabMod').onclick = function () { _horVer('mod'); };
  document.getElementById('horTabHor').onclick = function () { _horVer('hor'); };
  document.getElementById('horBtnGuardar').onclick = horGuardar;
  document.getElementById('horBtnQuitar').onclick  = horQuitar;
  document.getElementById('horIni').onchange = _horAvisarCruce;
  document.getElementById('horFin').onchange = _horAvisarCruce;

  _horInyectado = true;
  return true;
}

function _horVer(cual) {
  var p = _horPartes(); if (!p) return;
  var panel = document.getElementById('horPanel');
  var tM = document.getElementById('horTabMod'), tH = document.getElementById('horTabHor');
  var esHor = (cual === 'hor');
  p.resto.forEach(function (el) { if (el !== panel && el.id !== 'horTabs') el.style.display = esHor ? 'none' : ''; });
  panel.style.display = esHor ? 'flex' : 'none';
  tM.style.color = esHor ? '#64748b' : '#0a2463';
  tM.style.borderBottomColor = esHor ? 'transparent' : '#0a2463';
  tH.style.color = esHor ? '#0a2463' : '#64748b';
  tH.style.borderBottomColor = esHor ? '#0a2463' : 'transparent';
  if (esHor) horCargarUsuarios();
}

/* _HOR_AMPM_V1 (07-oct-2026): la hora se escribe en formato de 12 h segun la PC; "11:30" sin
   marcar p. m. quedaba como 11:30 de la MAÑANA (paso con rmolero). Ahora se muestra el horario
   en palabras (a. m. / p. m. y cuantas horas) y se avisa si la salida parece estar en la mañana. */
function _horTxt(h) { var m = String(h || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return h || ''; var hh = +m[1], ap = hh >= 12 ? 'p. m.' : 'a. m.'; hh = hh % 12 || 12; return hh + ':' + m[2] + ' ' + ap; }
function _horMin(h) { var m = String(h || '').match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function _horAvisarCruce() {
  var i = document.getElementById('horIni').value, f = document.getElementById('horFin').value;
  var av = document.getElementById('horCruza');
  if (!i || !f) { av.style.display = 'none'; return; }
  var mi = _horMin(i), mf = _horMin(f), cruza = f <= i;
  var dur = cruza ? (1440 - mi + mf) : (mf - mi), dh = Math.floor(dur / 60), dm = dur % 60;
  var txt = '🕒 <b>Entra ' + _horTxt(i) + '</b> y <b>sale ' + _horTxt(f) + (cruza ? ' del día siguiente' : '') + '</b> · ' +
            dh + ' h' + (dm ? ' ' + dm + ' min' : '') + ' de acceso.';
  var raro = !cruza && mf < 12 * 60 && dur < 6 * 60;
  if (raro) txt += '<br><b style="color:#b91c1c">⚠️ ¿La salida es en la NOCHE?</b> Está como ' + _horTxt(f) +
                   ' — si querías ' + ((+f.slice(0, 2)) % 12 || 12) + ':' + f.slice(3, 5) + ' p. m., cambia la hora de salida a <b>p. m.</b>';
  if (cruza) txt += '<br>Este horario <b>cruza la medianoche</b>. Los días marcados son los de <b>entrada</b>.';
  av.style.display = 'block';
  av.style.borderColor = raro ? '#fca5a5' : '';
  av.style.background = raro ? '#fef2f2' : '';
  av.innerHTML = txt;
}

var _horUsuariosCargados = false;
async function horCargarUsuarios() {
  if (_horUsuariosCargados) return;
  var sel = document.getElementById('horUsuario');
  sel.innerHTML = '<option value="">Cargando…</option>';
  try {
    var d = await _permListaUsuarios();   /* _PERM_USUARIOS_AZURE_V1 */
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo leer la lista');
    sel.innerHTML = '<option value="">— elige un usuario —</option>' +
      d.usuarios.map(function (u) {
        return '<option value="' + u.usuario + '">' + (u.activo ? '' : '⚠ ') + u.usuario +
               (u.nombre ? ' · ' + u.nombre : '') + (u.rol ? '  (' + u.rol + ')' : '') + '</option>';
      }).join('');
    sel.onchange = horCargarDeUsuario;
    _horUsuariosCargados = true;
  } catch (e) {
    sel.innerHTML = '<option value="">Error: ' + e.message + '</option>';
  }
}

function _horPonerDias(lista) {
  document.querySelectorAll('#horDias input[data-dia]').forEach(function (c) {
    c.checked = lista.indexOf(Number(c.getAttribute('data-dia'))) >= 0;
    c.closest('label').style.background = c.checked ? '#f0f7ff' : '#fff';
  });
}

async function horCargarDeUsuario() {
  var u = document.getElementById('horUsuario').value;
  var est = document.getElementById('horEstado');
  if (!u) { est.textContent = ''; return; }
  est.textContent = 'Leyendo horario…';
  try {
    var d = await apiPost({ action: 'accesoHorarioListar', usuario: USER.usuario, rol: USER.rol });
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo leer');
    var reg = (d.horarios || []).filter(function (h) { return h.usuario === u; })[0];
    if (reg) {
      document.getElementById('horIni').value   = reg.horaInicio || '05:30';
      document.getElementById('horFin').value   = reg.horaFin    || '17:00';
      document.getElementById('horDesde').value = reg.desde || '';
      document.getElementById('horHasta').value = reg.hasta || '';
      document.getElementById('horNota').value  = reg.nota  || '';
      _horPonerDias(reg.dias || [1,2,3,4,5,6]);
      est.innerHTML = '<span style="color:#15803d">Ya tiene horario propio: <b>' +
                      _horTxt(reg.horaInicio) + ' a ' + _horTxt(reg.horaFin) + '</b>' +   /* _HOR_AMPM_V1 */
                      (reg.activo ? '' : ' (INACTIVO)') + '.</span>';
    } else {
      document.getElementById('horIni').value   = '05:30';
      document.getElementById('horFin').value   = '17:00';
      document.getElementById('horDesde').value = '';
      document.getElementById('horHasta').value = '';
      document.getElementById('horNota').value  = '';
      _horPonerDias([1,2,3,4,5,6]);
      est.innerHTML = '<span style="color:#b45309">Todavía no tiene horario propio: hoy entra con el general ' +
                      '05:30 a 17:00. Al guardar, manda lo de esta pantalla.</span>';
    }
    _horAvisarCruce();
  } catch (e) { est.innerHTML = '<span style="color:#dc2626">Error: ' + e.message + '</span>'; }
}

async function horGuardar() {
  var u   = document.getElementById('horUsuario').value;
  var est = document.getElementById('horEstado');
  var btn = document.getElementById('horBtnGuardar');
  if (!u) { est.innerHTML = '<span style="color:#b45309">Elige primero un usuario.</span>'; return; }
  var dias = [];
  document.querySelectorAll('#horDias input[data-dia]').forEach(function (c) { if (c.checked) dias.push(c.getAttribute('data-dia')); });
  if (!dias.length) { est.innerHTML = '<span style="color:#b45309">Marca al menos un día.</span>'; return; }

  /* _HOR_AMPM_V1: confirmar si la salida parece estar en la manana */
  var _hi = document.getElementById('horIni').value, _hf = document.getElementById('horFin').value;
  if (_hf > _hi && _horMin(_hf) < 12 * 60 && (_horMin(_hf) - _horMin(_hi)) < 6 * 60 &&
      !confirm('La hora de SALIDA está en la MAÑANA: ' + _horTxt(_hf) + '.\n\nEl usuario solo podrá entrar de ' + _horTxt(_hi) + ' a ' + _horTxt(_hf) + '.\n\n¿Es correcto?\n(Si querías de noche, pulsa Cancelar y cambia la salida a p. m.)')) return;
  var txt = btn.textContent; btn.disabled = true; btn.textContent = 'Guardando…';
  est.textContent = '';
  try {
    var d = await apiPost({
      action: 'accesoHorarioGuardar', usuario: USER.usuario, rol: USER.rol,
      horario: {
        usuario:    u,
        horaInicio: document.getElementById('horIni').value,
        horaFin:    document.getElementById('horFin').value,
        dias:       dias.join(','),
        desde:      document.getElementById('horDesde').value,
        hasta:      document.getElementById('horHasta').value,
        nota:       document.getElementById('horNota').value,
        activo:     true
      }
    });
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo guardar');
    est.innerHTML = '<span style="color:#15803d">Guardado: <b>' + d.horario + '</b>' +
      (d.cruzaMedianoche ? ' (cruza la medianoche)' : '') +
      (d.desde ? ' · desde ' + d.desde : '') + '.<br>' + d.aviso + '</span>';
  } catch (e) {
    est.innerHTML = '<span style="color:#dc2626">Error: ' + e.message + '</span>';
  } finally { btn.disabled = false; btn.textContent = txt; }
}

async function horQuitar() {
  var u   = document.getElementById('horUsuario').value;
  var est = document.getElementById('horEstado');
  if (!u) { est.innerHTML = '<span style="color:#b45309">Elige primero un usuario.</span>'; return; }
  if (!confirm('¿Quitar el horario propio de ' + u + '?\n\nVolverá al horario general 05:30 a 17:00.')) return;
  try {
    var d = await apiPost({ action: 'accesoHorarioEliminar', usuario: USER.usuario, rol: USER.rol, destino: u });
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo quitar');
    est.innerHTML = '<span style="color:#15803d">' + d.aviso + '</span>';
    horCargarDeUsuario();
  } catch (e) { est.innerHTML = '<span style="color:#dc2626">Error: ' + e.message + '</span>'; }
}

/* ── Engancharse SIN tocar nada del modulo original ──────────────────────
   CUIDADO, esto es lo que fallo en la V1: el boton del menu se crea con
       b.onclick = permAbrir;
   y eso guarda la referencia a la funcion INTERNA, no a window.permAbrir.
   Envolver window.permAbrir no servia de nada al hacer clic en el boton:
   solo funcionaba si uno la llamaba a mano desde la consola.
   La V2 no depende de eso. Vigila el DOM: cuando aparece #permOverlay,
   inyecta las pestanas, sin importar quien ni como abrio la ventana. */
function _horIntentar() {
  try {
    if (!_horEsAdmin()) return;
    if (!document.getElementById('permOverlay')) return;
    if (_horInyectar()) _horVer('mod');
  } catch (e) { console.warn('[_HORARIOS_UI_V2] no pude inyectar la pestana:', e); }
}

/* 1) Observador: reacciona a la creacion del overlay */
try {
  new MutationObserver(function () {
    if (!_horInyectado && document.getElementById('permOverlay')) _horIntentar();
  }).observe(document.body, { childList: true });
} catch (e) { console.warn('[_HORARIOS_UI_V2] observador:', e); }

/* 2) Respaldo: clic en el boton del menu (fase de captura, no interfiere) */
document.addEventListener('click', function (ev) {
  try {
    var t = ev.target;
    var b = t && t.closest ? t.closest('#navPermisos') : null;
    if (!b) return;
    setTimeout(_horIntentar, 120);
    setTimeout(_horIntentar, 600);
  } catch (e) {}
}, true);

/* 3) Y si alguien la abre desde la consola, tambien */
var _permAbrirPrevio = window.permAbrir;
if (typeof _permAbrirPrevio === 'function') {
  window.permAbrir = async function () {
    var r = await _permAbrirPrevio.apply(this, arguments);
    _horIntentar();
    return r;
  };
}

window.horGuardar = horGuardar;  window.horQuitar = horQuitar;
console.log('[_HORARIOS_UI_V2] listo');
})();
