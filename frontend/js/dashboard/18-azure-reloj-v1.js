/* dashboard.html · bloque 18 (antes en la linea 12387) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _AZURE_RELOJ_V1 (12-set-2026) — que la consulta deje de quedarse colgada
   ---------------------------------------------------------------------------
   EL PROBLEMA (medido, no supuesto)
   Azure se duerme cuando nadie lo usa. Medimos: la primera llamada tarda
   7 segundos en despertar, las siguientes 335 milisegundos.

   Y de las llamadas a Azure que hay en el dashboard, SOLO UNA tenia reloj:
   la de consulta por rango (_azFetch, 25 s). Las otras cuatro no tenian
   ninguno:
       buscarTrabajadorPorDniAzure   <- Consulta de Trabajador
       _consultaDNIAzure             <- Mis Atenciones por DNI
       /atenciones/stats             <- estadisticas por supervisor
       /atenciones/update            <- marcar como finalizado

   Un fetch sin reloj espera lo que el navegador quiera: 30 segundos, a veces
   dos minutos. Y RECIEN AHI empieza el respaldo por hoja de calculo, que
   arrastra sus propios 2 segundos de peaje mas la consulta. Por eso el
   usuario siente que la pantalla se colgo: no espera su consulta, espera a
   un servidor dormido sin que nadie le ponga limite.

   QUE HACE ESTE BLOQUE
   1) Le pone reloj de 6 segundos a TODA llamada a Azure que no traiga el
      suyo. Al cumplirse, corta y el codigo de siempre se va al respaldo,
      que es justo lo que ya sabe hacer. No se reescribe ninguna funcion.
   2) Despierta a Azure al cargar la pagina, sin esperar respuesta. Asi los
      7 segundos del arranque en frio se los come el sistema mientras el
      usuario mira la pantalla, y no cuando hace clic en consultar.

   POR QUE ASI Y NO EDITANDO CADA LLAMADA
   Porque envolver fetch aplica a las cuatro de una vez, respeta la que ya
   tiene su propio reloj, y sobrevive a futuros cambios del archivo. Para
   revertir, se borra este bloque.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* Por que 9 s y no menos: Azure DESPIERTO contesta en 335 ms, pero en FRIO
   tarda unos 7 s. Si el reloj fuera de 6 s, cada arranque en frio se iria al
   respaldo por hoja de calculo, que es MAS lento todavia. 9 s deja pasar el
   frio y aun asi corta de golpe cuando Azure esta caido de verdad — hoy esos
   casos se quedan colgados 30 segundos o dos minutos. */
var AZ_RELOJ_MS = 14000;   /* _CAIDAS_V4 (17-oct): 9 s cortaba /atenciones/stats en horas punta (LOG_ERRORES 16-oct: 32 cortes a los 9-10 s) y la pantalla caia a Google; mismo criterio que _CAIDAS_V3 (14 s) */
var AZ_MARCA    = 'azurewebsites.net/api';

var _fetchPrevio = window.fetch;
if (typeof _fetchPrevio !== 'function') return;

window.fetch = function (recurso, opciones) {
  var u = '';
  try { u = (typeof recurso === 'string') ? recurso : (recurso && recurso.url) || ''; } catch (e) {}

  // no es Azure, o ya trae su propio reloj -> se deja tal cual
  if (u.indexOf(AZ_MARCA) < 0) return _fetchPrevio.apply(this, arguments);
  if (opciones && opciones.signal)  return _fetchPrevio.apply(this, arguments);
  if (typeof AbortController === 'undefined') return _fetchPrevio.apply(this, arguments);

  var ctrl = new AbortController();
  var t0   = (window.performance && performance.now()) || Date.now();
  var reloj = setTimeout(function () {
    try { ctrl.abort(); } catch (e) {}
    console.warn('[_AZURE_RELOJ_V1] Azure no contesto en ' + AZ_RELOJ_MS +
                 ' ms, se pasa al respaldo ->', u.split('?')[0]);
  }, AZ_RELOJ_MS);

  var op = Object.assign({}, opciones || {}, { signal: ctrl.signal });
  return _fetchPrevio.call(this, recurso, op).then(function (r) {
    clearTimeout(reloj);
    try {
      var ms = Math.round((((window.performance && performance.now()) || Date.now())) - t0);
      if (ms > 2000) console.warn('[_AZURE_RELOJ_V1] Azure tardo ' + ms + ' ms ->', u.split('?')[0]);
    } catch (e) {}
    return r;
  }, function (err) {
    clearTimeout(reloj);
    throw err;
  });
};

/* ── Despertador: una llamada suelta al cargar, sin esperar respuesta ── */
function _despertarAzure() {
  try {
    if (typeof AZURE_FN_BASE === 'undefined' || !AZURE_FN_BASE) return;
    var t0 = (window.performance && performance.now()) || Date.now();
    /* _DESPERTAR_LIVIANO (24-set): antes /atenciones/stats = 7 recorridos de la tabla en cada carga.
       _DESPERTAR_200 (18-oct): antes trabajadores/buscar?dni=00000000, que respondia 404 y Chrome lo pintaba en rojo en la consola;
       ahora mod/sup/getSupervisores (200, ~380 ms, lista corta) que ademas calienta la misma funcion 'mod' que usa el Dashboard. */
    _fetchPrevio(AZURE_FN_BASE + '/mod/sup/getSupervisores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function () {
        var ms = Math.round((((window.performance && performance.now()) || Date.now())) - t0);
        console.log('[_AZURE_RELOJ_V1] Azure despierto en ' + ms + ' ms');
      })
      .catch(function () { /* da igual el resultado: solo queriamos despertarlo */ });
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _despertarAzure);
} else {
  _despertarAzure();
}

console.log('[_AZURE_RELOJ_V1] reloj de ' + AZ_RELOJ_MS + ' ms activo sobre las llamadas a Azure');
})();
