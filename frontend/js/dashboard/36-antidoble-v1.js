/* dashboard.html · bloque 36 (antes en la linea 15718) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ANTIDOBLE_V1 (23-set-2026) — evitar registros duplicados por doble clic
   ---------------------------------------------------------------------------
   Cuando el servidor va lento, el usuario vuelve a hacer clic en "Guardar" y se
   crean dos registros. Este bloque envuelve el apiPost FINAL (despues de todos
   los envoltorios anteriores) y solo actua en ESCRITURAS:
     a) si ya hay en curso un envio con el mismo contenido, devuelve ese mismo
        resultado en vez de mandar otro (y 3 s despues de terminar);
     b) desactiva el boton que se presiono mientras se guarda (maximo 30 s).
   Las lecturas pasan tal cual. Ademas conecta el registro local de errores de
   red (_redRegistrar) con la hoja LOG_ERRORES (_SALUD_V1).
   Para revertir: borrar este bloque.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
/* misma regla de escritura que el servidor (ESTAB_ESCRITURA_RE_) */
var ESCRITURA = /^(save|update|delete|eliminar|add|resolver|registrar|aprobar|subir|guardar|programar|actualizar|cumplJustificar|cumplConfigGuardar|cumplRestriccionLevantar|horasRegistrar|horasEditar|horasEliminar|horasAprobar|inv(Agregar|Editar|Eliminar|Registrar|Guardar)|mant_|permisosGuardar|accesoHorario(Guardar|Eliminar)|horarios(Guardar|Eliminar)|duplicar)/i;
var enCurso = {};
var ultimoBoton = null;

document.addEventListener('click', function (ev) {
  try {
    var b = ev.target && ev.target.closest && ev.target.closest('button, input[type=submit], input[type=button]');
    if (b) ultimoBoton = { el: b, t: Date.now() };
  } catch (e) {}
}, true);

function bloquear() {
  try {
    if (!ultimoBoton || (Date.now() - ultimoBoton.t) > 1500) return null;
    var el = ultimoBoton.el;
    if (!el || el.disabled) return null;
    el.disabled = true;
    el.setAttribute('data-rl-ocupado', '1');
    var op = el.style.opacity; el.style.opacity = '0.6';
    var suelta = function () {
      try {
        if (el.getAttribute('data-rl-ocupado') === '1') {
          el.removeAttribute('data-rl-ocupado'); el.disabled = false; el.style.opacity = op;
        }
      } catch (e) {}
    };
    setTimeout(suelta, 30000);   /* seguro: nunca queda bloqueado mas de 30 s */
    return suelta;
  } catch (e) { return null; }
}

function envolver() {
  var prev = window.apiPost;
  if (typeof prev !== 'function' || prev._antiDoble || window._rlAntiDobleOk) return;   /* _FIX_CICLO_24SET: instalar UNA sola vez */
  window._rlAntiDobleOk = true;
  var w = function (b) {
    var accion = b && b.action;
    if (!ESCRITURA.test(String(accion || ''))) return prev.apply(this, arguments);
    var clave;
    try { clave = JSON.stringify(b); } catch (e) { return prev.apply(this, arguments); }
    if (enCurso[clave]) {
      console.warn('[_ANTIDOBLE_V1] envio repetido ignorado:', accion);
      return enCurso[clave];
    }
    var suelta = bloquear();
    var p = Promise.resolve().then(function () { return prev.call(window, b); });
    enCurso[clave] = p;
    p.then(function () {}, function () {}).then(function () {
      if (suelta) suelta();
      setTimeout(function () { if (enCurso[clave] === p) delete enCurso[clave]; }, 3000);
    });
    return p;
  };
  w._antiDoble = true;
  window.apiPost = w;
  try { apiPost = w; } catch (e) {}
}
envolver();
window.addEventListener('load', envolver);

/* errores de red ya detectados por _redLlamar -> tambien a LOG_ERRORES */
try {
  var _regPrevio = window._redRegistrar;
  if (typeof _regPrevio === 'function' && !_regPrevio._salud) {
    var r2 = function (accion, err) {
      try { if (window.rlSalud) rlSalud.registrar('google_error', accion, null, (err && err.message) || String(err || '')); } catch (e) {}
      return _regPrevio.apply(this, arguments);
    };
    r2._salud = true;
    window._redRegistrar = r2;
  }
} catch (e) {}
console.log('[_ANTIDOBLE_V1] activo');
})();
