/* ════════════════════════════════════════════════════════════════════════════
   78-ux-base-v1.js — _UX_BASE_V1 (10-nov-2026) · reglas comunes de presentacion (solo CSS, no cambia logica)
   1) Nada flotante encima de un formulario abierto: los botones de ayuda / WhatsApp y el aviso de
      "version nueva" se ocultan mientras hay una ventana abierta (tapaban Guardar en el celular).
   2) Las ventanas que no son "hoja" miden su alto con la pantalla REAL del celular (dvh): antes, con la
      barra de direcciones visible, la parte de abajo (los botones) quedaba fuera de la pantalla.
   Apagar: localStorage.rl_ux_base = 'off' (y recargar).
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._UX_BASE_V1) return; window._UX_BASE_V1 = true;
  try { if (localStorage.getItem('rl_ux_base') === 'off') return; } catch (e) {}
  var css = [
    'body:has(.ov.on) #rlFabCol, body:has(.ov.on) #toast-update{display:none!important}',
    '@supports (height:1dvh){.ov:not(.hoja):not(.hoja2) > .modal{max-height:95dvh!important}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'ux-base-v1'; st.textContent = css; document.head.appendChild(st);
})();
