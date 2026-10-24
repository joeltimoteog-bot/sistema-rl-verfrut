/* dashboard.html · bloque 25 (antes en la linea 13813) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function () {
'use strict';
if (window._rlHoyDiaOk) return; window._rlHoyDiaOk = true;
function dia() { try { return hoy(); } catch (e) { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); } }
function diaDeTs(ts) { return ts ? new Date(Number(ts) - 5 * 3600000).toISOString().slice(0, 10) : ''; }
function tk() { try { return sessionStorage.getItem('rl_token'); } catch (e) { return null; } }
function tkVencido() {
  var t = tk(); if (!t) return true;
  try { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return !!(p.exp && p.exp * 1000 < Date.now()); } catch (e) { return false; }
}
function cache() { try { return (typeof CACHE !== 'undefined' && CACHE) ? CACHE : null; } catch (e) { return null; } }
/* atenciones de HOY en la lista local (supervisor: las suyas; admin: todas las cargadas) */
function contarHoyLocal() {
  var c = cache(), d = dia(), lista = (c && Array.isArray(c.atenciones)) ? c.atenciones : [];
  var vistos = {};
  return lista.filter(function (a) {
    if (!a || String(a.fecha_atencion || '').slice(0, 10) !== d) return false;
    var k = a.nro != null ? 'n' + a.nro : null; if (k) { if (vistos[k]) return false; vistos[k] = 1; }
    return true;
  }).length;
}
function ponerHoy(n, motivo) {
  var el = document.getElementById('sH'); if (el) el.textContent = n;
  var c = cache(); if (c) { c.stats = c.stats || {}; c.stats.hoy = n; }
  console.log('[_HOY_DIA_V1] Hoy = ' + n + ' (' + motivo + ')');
}
function aviso(mostrar) {
  var id = 'rlHoyAviso', el = document.getElementById(id);
  if (!mostrar) { if (el) el.remove(); return; }
  if (el) return;
  var ref = document.getElementById('sH'); ref = ref && ref.closest('.sc'); ref = ref && ref.parentElement;
  if (!ref || !ref.parentElement) return;
  el = document.createElement('div'); el.id = id;
  el.style.cssText = 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:600;margin:0 0 10px';
  el.innerHTML = '🔒 Tu sesión de Azure venció (dura 8 horas): "Atenciones hoy" se está calculando con la lista del día. ' +
    'Para ver todas las cifras exactas, <a href="#" style="color:#b45309;text-decoration:underline">vuelve a entrar</a>.';
  el.querySelector('a').onclick = function (e) { e.preventDefault(); try { logout(); } catch (x) { location.reload(); } };
  ref.parentElement.insertBefore(el, ref);
}

/* 1) Al abrir con datos guardados de OTRO día: el "Hoy" guardado no vale */
var _cargarLSOrig = window.cargarCacheLS;
if (typeof _cargarLSOrig === 'function') {
  window.cargarCacheLS = function () {
    var r = _cargarLSOrig.apply(this, arguments);
    try {
      var c = cache(), ts = (typeof CACHE_TS !== 'undefined') ? CACHE_TS : 0;
      if (r && c && c.stats && diaDeTs(ts) && diaDeTs(ts) !== dia()) {
        console.log('[_HOY_DIA_V1] datos guardados del ' + diaDeTs(ts) + ' → "Hoy" se reinicia');
        c.stats.hoy = 0;
      }
    } catch (e) {}
    return r;
  };
}

/* 2) Vigilar el cambio de día y la sesión (cada 30 s y al volver a la pestaña) */
var diaVisto = dia(), ocupado = false, ultimaVisible = Date.now();
async function revisar(motivo) {
  if (ocupado) return; ocupado = true;
  try {
    var d = dia(), cambioDia = d !== diaVisto;
    if (cambioDia) {
      diaVisto = d;
      ponerHoy(contarHoyLocal(), 'cambio de día a ' + d);
      try { if (typeof refrescarAtencionesHoy === 'function') await refrescarAtencionesHoy('cambio de día'); } catch (e) {}
    }
    var vencida = tkVencido();
    aviso(vencida);
    if (cambioDia || motivo === 'visible') {
      var ok = false;
      if (!vencida && typeof window._refrescarStatsAzure === 'function') {
        try { ok = await window._refrescarStatsAzure(cambioDia ? 'guardia cambio de día' : 'volvió a la pestaña'); } catch (e) { ok = false; }
      }
      if (!ok && cambioDia) ponerHoy(contarHoyLocal(), vencida ? 'sesión vencida: lista local' : 'Azure no respondió: lista local');
    }
  } finally { ocupado = false; }
}
setInterval(function () { revisar('reloj'); }, 30000);
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') { ultimaVisible = Date.now(); return; }
  var ausente = Date.now() - ultimaVisible;
  if (ausente > 60000 || dia() !== diaVisto) revisar('visible');
});
console.log('[_HOY_DIA_V1] listo · día ' + diaVisto);
})();
