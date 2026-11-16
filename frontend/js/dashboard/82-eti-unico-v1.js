/* ═════════════════════════════════════════════════════════════════
   82-eti-unico-v1.js — _ETI_UNICO_V1 (15-nov-2026) · SOLO PRESENTACION
   En el menu habia dos botones que abren la MISMA pagina (programacion-eti.html):
     "Programación ETI" (navProgEti) y "Capacitaciones ETI (programar)" (navAppEti).
   Cuando el usuario tiene los dos, se muestra UNO solo ("Programación ETI") y el otro se oculta.
   No se toca ningun permiso ni onclick: Acceso a Modulos sigue igual (navAppEti es el que da el
   permiso de programar en el Sistema ETI; por eso, si ambos estan, se conserva ese y se le pone el
   nombre corto). Si solo hay uno visible, no cambia nada.
   INTERRUPTOR: localStorage.setItem('rl_eti_doble','on') y recargar (vuelven los dos).
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ETI_UNICO_V1) return; window._ETI_UNICO_V1 = true;
  try { if (localStorage.getItem('rl_eti_doble') === 'on') return; } catch (e) {}
  function visible(b) { return b && b.style.display !== 'none' && getComputedStyle(b).display !== 'none'; }
  function aplicar() {
    var a = document.getElementById('navProgEti'), b = document.getElementById('navAppEti');
    if (!a || !b || !visible(a) || !visible(b)) return;
    a.style.display = 'none'; a.dataset.etiUnico = 'oculto';
    var ic = b.querySelector('.ic');
    b.innerHTML = ''; if (ic) b.appendChild(ic); b.appendChild(document.createTextNode('Programación ETI'));
    b.title = 'Programación y capacitaciones ETI';
    try { console.log('[_ETI_UNICO_V1] un solo acceso ETI en el menu'); } catch (e) {}
  }
  function arrancar() {
    aplicar();
    var nav = document.querySelector('#sb .nav') || document.body;
    try { new MutationObserver(function () { aplicar(); }).observe(nav, { attributes: true, attributeFilter: ['style', 'class'], subtree: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
