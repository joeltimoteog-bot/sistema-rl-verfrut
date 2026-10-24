/* dashboard.html · bloque 22 (antes en la linea 13393) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _BUSCAR_AT_V1 (18-set-2026) ══════════════════
   La busqueda de Mis Atenciones se sentia trabada al escribir.

   EL MOTIVO, medido en el codigo: el campo #fAQ tiene DOS enganches a la
   vez —onkeyup y oninput— asi que filtrarAt() corre DOS VECES por cada
   tecla. Y cada corrida filtra el arreglo completo en memoria y vuelve a
   dibujar hasta 500 filas de la tabla. Escribir un DNI de 8 digitos son
   16 corridas y 16 reconstrucciones de la tabla.

   LA CORRECCION: un solo enganche, y esperar 250 ms a que la persona deje
   de escribir antes de filtrar. Escribir el mismo DNI pasa a ser UNA sola
   corrida. No cambia en nada el resultado de la busqueda: se sigue llamando
   a la misma funcion filtrarAt() de siempre, solo que una vez.

   Los otros filtros (estado, empresa, mes) no se tocan: esos son onchange,
   disparan una sola vez y no tenian el problema.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ESPERA = 250;

  function instalar() {
    try {
      var caja = document.getElementById('fAQ');
      if (!caja || caja._buscarAtV1) return !!caja;
      if (typeof window.filtrarAt !== 'function') return false;

      caja._buscarAtV1 = true;
      caja.onkeyup = null;              // fuera el enganche duplicado
      caja.oninput = null;

      var reloj = null;
      caja.addEventListener('input', function () {
        if (reloj) clearTimeout(reloj);
        reloj = setTimeout(function () { reloj = null; window.filtrarAt(); }, ESPERA);
      });
      // Enter busca al instante, sin esperar
      caja.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          if (reloj) { clearTimeout(reloj); reloj = null; }
          window.filtrarAt();
        }
      });
      console.log('[_BUSCAR_AT_V1] busqueda con espera de ' + ESPERA + ' ms');
      return true;
    } catch (e) { console.warn('[_BUSCAR_AT_V1]', e); return false; }
  }

  function arrancar() {
    if (instalar()) return;
    var intentos = 0;
    var t = setInterval(function () {
      if (instalar() || ++intentos > 20) clearInterval(t);
    }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
