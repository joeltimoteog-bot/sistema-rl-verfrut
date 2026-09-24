/* ═══════════════════════════════════════════════════════════════════════════
   _ANTIDOBLE_V1 (23-set-2026) — Horas e Inventario: sin registros duplicados
   ---------------------------------------------------------------------------
   Misma proteccion que el Dashboard. Envuelve el apiPost de la pagina (debe
   cargarse DESPUES de horas.js / inventario.js) y solo actua en ESCRITURAS:
     a) si ya hay en curso un envio con el mismo contenido, devuelve ese mismo
        resultado en vez de mandar otro (y hasta 3 s despues de terminar);
     b) desactiva el boton presionado mientras se guarda (maximo 30 s).
   Las lecturas pasan tal cual. Para revertir: quitar la etiqueta <script>.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var ESCRITURA = /^(save|update|delete|eliminar|add|resolver|registrar|aprobar|subir|guardar|programar|actualizar|horasRegistrar|horasEditar|horasEliminar|horasAprobar|horasAgregarMotivo|horasEliminarMotivo|inv(Agregar|Editar|Eliminar|Registrar|Guardar)|mant_|horarios(Guardar|Eliminar)|duplicar)/i;
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
    setTimeout(suelta, 30000);
    return suelta;
  } catch (e) { return null; }
}

function envolver() {
  var prev = window.apiPost;
  if (typeof prev !== 'function' || prev._antiDoble) return;
  var w = function (b) {
    var accion = b && b.action;
    if (!ESCRITURA.test(String(accion || ''))) return prev.apply(this, arguments);
    var clave;
    try { clave = JSON.stringify(b); } catch (e) { return prev.apply(this, arguments); }
    if (enCurso[clave]) { console.warn('[_ANTIDOBLE_V1] envio repetido ignorado:', accion); return enCurso[clave]; }
    var suelta = bloquear();
    var self = this, args = arguments;
    var p = Promise.resolve().then(function () { return prev.apply(self, args); });
    enCurso[clave] = p;
    p.then(function () {}, function () {}).then(function () {
      if (suelta) suelta();
      setTimeout(function () { if (enCurso[clave] === p) delete enCurso[clave]; }, 3000);
    });
    return p;
  };
  w._antiDoble = true;
  window.apiPost = w;
}
envolver();
window.addEventListener('load', envolver);
console.log('[_ANTIDOBLE_V1] activo');
})();
