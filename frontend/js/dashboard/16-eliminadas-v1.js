/* dashboard.html · bloque 16 (antes en la linea 12136) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */


/* ═══════════════════════════════════════════════════════════════════════════
   _ELIMINADAS_V1 (26-ago-2026) — que lo eliminado no reaparezca

   EL PROBLEMA
   ---------------------------------------------------------------------------
   deleteAtencion (codigo.gs linea 463) borra la fila de la HOJA DE CALCULO.
   Nada mas. Azure SQL no se entera: reviso los 11 endpoints y NO existe
   ninguno que borre (batch, by-dni, create, list, stats, update, y los de
   login, blob, trabajadores y usuarios; ninguno elimina).

   Y la lista de Mis Atenciones se lee de Azure. Entonces: la atencion se
   borraba de verdad de la hoja, pero al primer refresco Azure la devolvia y
   volvia a aparecer en pantalla. Peor todavia, la memoria de 3 minutos que
   agregue para acelerar la devolvia al instante.

   LO QUE HACE ESTE BLOQUE
   ---------------------------------------------------------------------------
   1. Al eliminar, vacia la memoria de 3 minutos.
   2. Anota el N° eliminado en una lista y la guarda en el navegador.
   3. Filtra esa lista de todo lo que llegue de Azure, para que no reaparezca.
   4. Al abrir, le pide al servidor los N° que estan en la PAPELERA, para que
      lo que borro otro usuario tampoco le aparezca a los demas.

   El punto 4 necesita el bloque de la papelera publicado en Apps Script. Si
   no esta, el 2 y el 3 igual funcionan, pero solo en el equipo donde se borro.
   La solucion de fondo es un endpoint de borrado en Azure; esto lo sostiene
   mientras tanto.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var LS_KEY  = 'rl_at_eliminadas_v1';
var DIAS    = 60;                          // cuanto se recuerda cada N°
var _elim   = {};                          // nro -> timestamp

function _cargar() {
  try {
    var crudo = localStorage.getItem(LS_KEY);
    if (!crudo) return;
    var obj = JSON.parse(crudo) || {};
    var corte = Date.now() - DIAS * 24 * 3600 * 1000;
    Object.keys(obj).forEach(function (k) { if (Number(obj[k]) > corte) _elim[k] = Number(obj[k]); });
  } catch (e) {}
}
function _guardar() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(_elim)); } catch (e) {}
}
_cargar();

function _marcar(nro) {
  var k = String(nro || '').trim();
  if (!k) return;
  _elim[k] = Date.now();
  _guardar();
  try { if (window._azLimpiarCache) window._azLimpiarCache(); } catch (e) {}
  console.log('[_ELIMINADAS_V1] N° ' + k + ' marcado como eliminado. En memoria: ' + Object.keys(_elim).length);
}
window._marcarEliminada = _marcar;

function _filtrar(lista) {
  if (!lista || !lista.length) return lista;
  if (!Object.keys(_elim).length) return lista;
  var antes = lista.length;
  var out = lista.filter(function (a) {
    var n = String(a && a.nro).trim();
    return !(_elim[n] || _elim[n + '|' + String((a && a.dni) || '').trim()]);   /* _PAPELERA_PAR_V1 */
  });
  if (out.length !== antes) {
    console.log('[_ELIMINADAS_V1] se ocultaron ' + (antes - out.length) +
                ' registro(s) ya eliminados que Azure sigue devolviendo');
  }
  return out;
}
window._filtrarEliminadas = _filtrar;

/* ── 1) Registrar el N° cuando el borrado sale bien ── */
var _postPrev = window.apiPost;
if (typeof _postPrev === 'function') {
  window.apiPost = function (b) {
    var esBorrado = !!(b && b.action === 'deleteAtencion' && b.nro);
    var nro = esBorrado ? b.nro : null;
    return Promise.resolve(_postPrev.apply(this, arguments)).then(function (r) {
      if (esBorrado && r && r.success) _marcar(nro);
      return r;
    });
  };
}

/* ── 2) Filtrar todo lo que venga de Azure ── */
var _rangoPrev = window._azAtencionesRango;
if (typeof _rangoPrev === 'function') {
  window._azAtencionesRango = function () {
    return Promise.resolve(_rangoPrev.apply(this, arguments)).then(function (lista) {
      return lista ? _filtrar(lista) : lista;
    });
  };
}

var _fullPrev = window._consultaAzureFull;
if (typeof _fullPrev === 'function') {
  window._consultaAzureFull = function () {
    return Promise.resolve(_fullPrev.apply(this, arguments)).then(function (res) {
      if (res && res.data) {
        res.data = _filtrar(res.data);
        if (!res.data.length) return null;      // que responda la hoja
      }
      return res;
    });
  };
}

/* ── 3) Traer del servidor los N° que ya estan en la papelera ── */
async function _sincronizarPapelera() {
  try {
    if (typeof apiGet !== 'function') return;
    var r = await apiGet({ action: 'papeleraNros' });
    if (!r || !r.success || !Array.isArray(r.data)) return;
    var nuevos = 0;
    if (Array.isArray(r.pares) && r.pares.length) {
      /* _PAPELERA_PAR_V1 (25-set-2026): el servidor manda N° + DNI. Se oculta solo esa
         atencion; si otra comparte el N° (registros antiguos), ya no desaparece. */
      r.pares.forEach(function (par) {
        var k = String(par || '').trim(), n = k.split('|')[0];
        if (!k) return;
        if (_elim[n]) { delete _elim[n]; nuevos++; }
        if (!_elim[k]) { _elim[k] = Date.now(); nuevos++; }
      });
    } else r.data.forEach(function (nro) {
      var k = String(nro || '').trim();
      if (k && !_elim[k]) { _elim[k] = Date.now(); nuevos++; }
    });
    if (nuevos) {
      _guardar();
      try { if (window._azLimpiarCache) window._azLimpiarCache(); } catch (e) {}
      console.log('[_ELIMINADAS_V1] la papelera del servidor aporto ' + nuevos + ' N° mas');
    } else {
      console.log('[_ELIMINADAS_V1] papelera del servidor sin novedades (' + r.data.length + ' registros)');
    }
  } catch (e) {
    console.log('[_ELIMINADAS_V1] no se pudo leer la papelera del servidor: ' + e.message +
                ' (se sigue usando solo la lista de este equipo)');
  }
}
window._sincronizarPapelera = _sincronizarPapelera;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setTimeout(_sincronizarPapelera, 3000); });
} else {
  setTimeout(_sincronizarPapelera, 3000);
}

console.log('[_ELIMINADAS_V1] listo · ' + Object.keys(_elim).length + ' N° recordados en este equipo');
})();

