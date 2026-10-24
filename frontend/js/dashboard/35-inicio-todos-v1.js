/* dashboard.html · bloque 35 (antes en la linea 15704) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════ _INICIO_TODOS_V1 (23-set-2026) — el boton "Inicio" (volver a la pantalla de
   sistemas) lo ven TODOS los usuarios, no solo administradores. No depende de
   Acceso a Modulos ni de las restricciones del menu. ══════ */
(function () {
  function mostrar() { var b = document.getElementById('navInicio'); if (b && b.style.display === 'none') b.style.display = ''; }
  (function esperar(n) {
    var ok = false; try { ok = typeof USER !== 'undefined' && USER && USER.usuario; } catch (e) {}
    if (ok) { mostrar(); setTimeout(mostrar, 1500); setTimeout(mostrar, 5000); return; }
    if (n < 60) setTimeout(function () { esperar(n + 1); }, 250);
  })(0);
})();
