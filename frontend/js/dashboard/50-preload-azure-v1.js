/* dashboard.html · bloque 50 (antes en la linea 16750) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _PRELOAD_AZURE_V1 (01-oct-2026) — CARGA AL ENTRAR desde Azure (antes ~18 s por Google)
   ---------------------------------------------------------------------------
   getPreloadOptimizado se arma en la pantalla con 4 consultas a Azure en paralelo,
   con el mismo formato que devolvia Google:
     · cifras (admin): /atenciones/stats  (supervisor: sus cifras las trae preloadData)
     · fusiones /mod/fus · supervisores /mod/sup · solicitudes /mod/sol (admin)
     · visitas y casos: los completa _CV_AZURE_V1 (cvAzure=1), como ya hacia.
   · usuarios (solo administrador): /usuarios/lista. Si esa pieza falla no frena la entrada
     (Gestion de usuarios la pide al abrirse). getUsuarios tambien sale de Azure (Google = respaldo).
   Si CUALQUIER pieza falla o tarda mas de 8 s -> la carga completa va por Google, como siempre.
   INTERRUPTOR: PRELOAD_AZURE_ACTIVO = false
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var PRELOAD_AZURE_ACTIVO = true;
if (!PRELOAD_AZURE_ACTIVO || window._rlPreAzOk) return;
window._rlPreAzOk = true;
if (typeof AZURE_FN_BASE === 'undefined') return;
var previo = window.apiGet;
if (typeof previo !== 'function') return;
var ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];

function pedir(ruta, cuerpo) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 14000);   /* _CAIDAS_V3 (15-oct): 8 s cortaba la consulta justo cuando Azure estaba por responder y la pantalla caia a Google (doble carga) */
  var op = cuerpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) } : { method: 'GET' };
  if (ctrl) op.signal = ctrl.signal;
  return fetch(AZURE_FN_BASE + ruta, op).then(function (r) {
    return r.json().then(function (j) { clearTimeout(reloj); if (r.status !== 200 || !j) throw new Error(ruta + ' HTTP ' + r.status); return j; });
  }, function (e) { clearTimeout(reloj); throw new Error(ruta + ' sin respuesta'); });
}
function lista(j) { if (!j || !j.success || !Array.isArray(j.data)) throw new Error('sin datos'); return j.data; }
/* = _statsAzureToFrontend_ del Apps Script */
function cifras(az) {
  if (!az || !az.success || !az.resumen_global) throw new Error('cifras sin datos');
  var g = az.resumen_global;
  return { hoy: g.hoy || 0, mes: g.este_mes || 0, anio: g.este_anio || g.total || 0, total: g.total || 0,
           enProceso: g.en_proceso || 0, finalizados: g.finalizados || 0,
           porMes: az.por_mes || {}, porTipo: az.por_tipo || {}, porEstado: az.por_estado || {} };
}
window.apiGet = function (p) {
  var sinSesion = true;
  try { sinSesion = !sessionStorage.getItem('rl_token'); } catch (e) {}
  if (p && p.action === 'getUsuarios' && !sinSesion) {   /* Gestion de usuarios: lista desde Azure (sin contraseñas) */
    var selfU = this, argsU = arguments;
    return pedir('/usuarios/lista').then(function (j) { lista(j); return j; }).catch(function (e) {
      console.warn('[_PRELOAD_AZURE_V1] getUsuarios: ' + (e && e.message) + ' -> Google (respaldo)');
      return previo.apply(selfU, argsU);
    });
  }
  if (!p || p.action !== 'getPreloadOptimizado' || sinSesion || String(p.cvAzure || '') !== '1') return previo.apply(this, arguments);
  var rol = String(p.rol || '').trim().toLowerCase(), esAdmin = ADMIN.indexOf(rol) >= 0;
  if (!esAdmin && String(p.atAzure || '') !== '1') return previo.apply(this, arguments);   // supervisor sin atenciones de Azure: como antes
  var self = this, args = arguments, t0 = Date.now();
  return (async function () {
    try {
      var emp = String(p.empresa || '').trim().toUpperCase();
      var qs = (emp && emp !== 'TODAS' && emp !== 'AMBAS') ? '?empresa=' + encodeURIComponent(emp) : '';
      var r = await Promise.all([
        pedir('/mod/fus/getFusiones', {}).then(lista),
        /* _PRELOAD_OPCIONAL_V1 (05-oct-2026): supervisores y solicitudes ya NO mandan toda la carga a
           Google si Azure tarda (eso hacia la entrada lentisima). Si fallan, se usa lo ultimo guardado. */
        pedir('/mod/sup/getSupervisores', {}).then(lista).catch(function (e) { console.warn('[_PRELOAD_OPCIONAL_V1] supervisores: ' + (e && e.message) + ' -> se usa lo guardado'); return (typeof CACHE !== 'undefined' && Array.isArray(CACHE.supervisores)) ? CACHE.supervisores : []; }),
        esAdmin ? pedir('/mod/sol/getSolicitudes', {}).then(lista).catch(function (e) { console.warn('[_PRELOAD_OPCIONAL_V1] solicitudes: ' + (e && e.message) + ' -> se usa lo guardado'); return (typeof CACHE !== 'undefined' && Array.isArray(CACHE.solicitudes)) ? CACHE.solicitudes : []; }) : Promise.resolve([]),
        esAdmin ? pedir('/atenciones/stats' + qs).then(cifras) : Promise.resolve({ _sinStatsSupervisor: true }),
        rol === 'administrador' ? pedir('/usuarios/lista').then(lista).catch(function () { return null; }) : Promise.resolve(null)   // opcional
      ]);
      var ms = Date.now() - t0;
      var data = { atenciones: [], stats: r[3], visitas: [], casos: [], fusiones: r[0], solicitudes: r[2], estadisticasAdmin: null,
                   supervisores: r[1], timestamp: Date.now(), _ts: Date.now(), fuente_atenciones: 'AZURE', fuente: 'azure', tiempo_total_ms: ms };
      if (r[4]) data.usuarios = r[4];   /* sin lista -> no se manda 'usuarios' (Gestion de usuarios la pide al abrirse) */
      console.log('[_PRELOAD_AZURE_V1] carga al entrar desde Azure en ' + ms + ' ms');
      try { if (ms > 4000 && window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('carga_lenta', 'azure:preload', ms, rol); } catch (e) {}
      return { success: true, data: data, fuente: 'azure' };
    } catch (e) {
      console.warn('[_PRELOAD_AZURE_V1] ' + (e && e.message) + ' -> carga por Google (respaldo)');
      return previo.apply(self, args);
    }
  })();
};
try { apiGet = window.apiGet; } catch (e) {}
console.log('[_PRELOAD_AZURE_V1] listo: la carga al entrar sale de Azure');
})();
