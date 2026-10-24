/* dashboard.html · bloque 57 (antes en la linea 17342) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function () {
  'use strict';
  if (window._casosUi3Listo) return; window._casosUi3Listo = true;
  function armar() {
    try {
      var sec = document.getElementById('sec-casos'); if (!sec || document.getElementById('cPanel3')) return;
      var filtros = sec.querySelector('.filtros'), buscar = document.getElementById('cBuscar');
      var bWrap = buscar && buscar.closest('div[style*="margin-bottom:10px"]');
      var emp = document.getElementById('cFiltroEmp'), motViejo = document.getElementById('cFiltroMotivo'), sup = document.getElementById('cFiltroSup');
      var mot = document.getElementById('cChipMotivo'), chips = document.getElementById('cChips'), verT = document.getElementById('cBtnVerTodos');
      if (!filtros || !bWrap || !emp || !sup || !mot || !chips) return;   /* algo distinto: no se toca nada */
      var exp = filtros.querySelector('button.btn-a'), limp = filtros.querySelector('button[title="Limpiar todos los filtros"]');
      var p = document.createElement('div'); p.id = 'cPanel3'; p.className = 'cp3';
      p.innerHTML = '<div class="cp3-tit">🔎 Buscar y filtrar <small>los filtros se combinan entre sí</small></div>' +
        '<div class="cp3-search"></div><div class="cp3-grid">' +
        '<div class="cp3-f" data-c="emp"><label>Empresa</label></div><div class="cp3-f" data-c="mot"><label>Motivo</label></div>' +
        '<div class="cp3-f" data-c="sup"><label>Supervisor</label></div><div class="cp3-acc"></div></div><div class="cp3-chips"></div>' +
        '<span style="display:none" data-c="oculto"></span>';
      filtros.parentNode.insertBefore(p, filtros);
      var q = function (s) { return p.querySelector(s); };
      q('.cp3-search').appendChild(buscar.parentNode);              /* caja de busqueda con su lupa y su ✕ */
      q('[data-c="emp"]').appendChild(emp);
      q('[data-c="mot"]').appendChild(mot);
      q('[data-c="sup"]').appendChild(sup);
      if (motViejo) q('[data-c="oculto"]').appendChild(motViejo);
      var acc = q('.cp3-acc');
      if (verT) acc.appendChild(verT);
      if (exp) acc.appendChild(exp);
      if (limp) {
        limp.classList.add('cp3-limpiar'); acc.appendChild(limp);
        limp.addEventListener('click', function () { try { if (typeof verTodosLosCasos === 'function') verTodosLosCasos(); } catch (e) {} });
      }
      q('.cp3-chips').appendChild(chips);
      filtros.style.display = 'none'; bWrap.style.display = 'none';   /* quedan vacios */
      if (sup.placeholder) sup.placeholder = 'Nombre del supervisor…';
    } catch (e) { console.warn('[_CASOS_UI_V3] no se pudo ordenar el panel:', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armar); else armar();
})();
