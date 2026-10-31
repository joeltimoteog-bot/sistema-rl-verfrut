/* dashboard.html · bloque 24 (antes en la linea 13624) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _STATS_AZURE_V1 (19-set-2026) ══════════════════
   Indicadores de "Mi Dashboard" (Hoy / Este mes / En proceso / Finalizados /
   Total año) con UNA sola fuente de verdad: Azure SQL (/atenciones/stats).

   POR QUE: los contadores venian de Firebase (resumen_global), que se
   actualiza por incrementos y se desfasa (mostraba 47 cuando la base tenia
   127). Los supervisores ademas pedian sus stats a Azure sin la llave (401)
   y caian a numeros globales o en blanco.

   AHORA: · admin/coordinador → Azure sin filtro (todo el año en curso)
          · cualquier otro rol → Azure filtrado por su nombre de supervisor
          · Firebase sigue alimentando ranking/tendencia, pero YA NO pisa
            estos 5 contadores.
          · Se refresca al cargar, tras cada guardado/refresco de atenciones,
            cuando Firebase avisa de un cambio y cada 3 min si la pestaña
            esta visible. Si Azure no responde, se usa el calculo anterior.
   ══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var IDS = ['sH', 'sM', 'sP', 'sF', 'sA'];
/* USER y CACHE estan declarados con let (no cuelgan de window): se leen por nombre */
function _usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : null; } catch (e) { return null; } }
var ultimo = null, agg = null, enCurso = null, reloj = null, _glob = null, _pausaHasta = 0;

function esAdmin() { try { return ROLES_VER_TODO.includes(USER.rol); } catch (e) { return false; } }

async function pedir() {
  if (typeof AZURE_FN_BASE === 'undefined' || !AZURE_FN_BASE || !_usr()) return null;
  /* Dos lecturas en paralelo: la del año en curso (contadores, por mes, por estado, por empresa)
     y la global solo para la tendencia por año. Antes una sola lectura sin filtro hacia que
     "Finalizados" y "Por estado" sumaran todos los años (57 mil) frente a un total anual de 19 mil. */
  var sup = esAdmin() ? '' : '&supervisor=' + encodeURIComponent(USER.nombre || USER.usuario);
  var base = AZURE_FN_BASE + '/atenciones/stats?_=' + Date.now() + sup;
  /* _STATS_FRENO_V2 (01-oct): la lectura global (solo tendencia por año) se pide cada 30 min, no en cada refresco */
  var pedirGlobal = !_glob || (Date.now() - _glob.ts) > 30 * 60000;
  var rr = await Promise.all([fetch(base + '&anio=' + new Date().getFullYear()), pedirGlobal ? fetch(base).catch(function () { return null; }) : Promise.resolve(null)]);
  if (!rr[0].ok) throw new Error('HTTP ' + rr[0].status);
  var j = await rr[0].json();
  if (!j || !j.success || !j.resumen_global) throw new Error('respuesta sin resumen_global');
  var jg = null; try { jg = rr[1] && rr[1].ok ? await rr[1].json() : null; } catch (e) {}
  if (jg && jg.success) _glob = { ts: Date.now(), j: jg }; else if (_glob) jg = _glob.j;
  var g = j.resumen_global;
  agg = { por_mes: j.por_mes || {}, por_anio: (jg && jg.por_anio) || j.por_anio || {}, por_estado: j.por_estado || {}, por_empresa: j.por_empresa || {} };
  return { hoy: g.hoy || 0, mes: g.este_mes || 0, anio: g.este_anio || 0,
           enProceso: g.en_proceso || 0, finalizados: g.finalizados || 0, total: g.total || 0, ts: Date.now() };
}

function pintar(s) {
  var m = { sH: s.hoy, sM: s.mes, sP: s.enProceso, sF: s.finalizados, sA: s.anio };
  Object.keys(m).forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = m[id] || 0; });
  try { CACHE.stats = Object.assign(CACHE.stats || {}, { hoy: s.hoy, mes: s.mes, anio: s.anio, enProceso: s.enProceso, finalizados: s.finalizados }); } catch (e) {}
}

async function refrescar(motivo) {
  if (enCurso) return enCurso;
  /* _STATS_FRENO_V1 (24-set): max 1 refresco por minuto por pantalla (salvo guardado propio) */
  if (ultimo && (Date.now() - ultimo.ts) < 180000 && !/guard/i.test(String(motivo || ''))) return Promise.resolve(true);   /* _STATS_FRENO_V2: 3 min (antes 1) */
  if (Date.now() < _pausaHasta && !/guard/i.test(String(motivo || ''))) return Promise.resolve(false);   /* Azure fallo hace poco: no insistir */
  enCurso = (async function () {
    try {
      var s = await pedir();
      if (s) { ultimo = s; pintar(s); try { if (!_hayFiltro()) dibujarDesdeAzure(); } catch (e) { console.warn('[_STATS_AZURE_V1] graficos:', e.message); }
        console.log('[_STATS_AZURE_V1] ' + (motivo || '') + ' → hoy ' + s.hoy + ' | mes ' + s.mes + ' | año ' + s.anio + ' | en proceso ' + s.enProceso + (esAdmin() ? ' (global)' : ' (solo ' + (USER.nombre || USER.usuario) + ')'));
        return true; }
    } catch (e) { _pausaHasta = Date.now() + 180000; console.warn('[_STATS_AZURE_V1] Azure no respondió (' + (motivo || '') + '): ' + e.message + ' — se mantiene el cálculo anterior (pausa 3 min)'); }
    return false;
  })().finally(function () { enCurso = null; });
  return enCurso;
}
function programar(motivo, ms) { if (reloj) clearTimeout(reloj); reloj = setTimeout(function () { reloj = null; refrescar(motivo); }, ms || 2000); }
window._refrescarStatsAzure = refrescar;

function _hayFiltro() {
  var a = document.getElementById('dFiltroAnio'), e = document.getElementById('dFiltroEst');
  return !!((a && a.value) || (e && e.value));
}
/* Graficos y tabla anual de "Mi Dashboard" desde los agregados de Azure
   (misma respuesta de /atenciones/stats: por_mes, por_estado, por_anio, por_empresa).
   Antes se dibujaban con la lista local, que para supervisores viene recortada a 100. */
function dibujarDesdeAzure() {
  if (!agg || typeof Chart === 'undefined') return;
  var labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var claves = [];
  for (var i = 5; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); claves.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  var lm = claves.map(function (k) { return labels[parseInt(k.split('-')[1], 10) - 1] || k; });
  var vm = claves.map(function (k) { return Number(agg.por_mes[k] || 0); });
  _destroyChart('m');
  var elM = document.getElementById('cM');
  if (elM) charts.m = new Chart(elM, { type:'bar', data:{ labels: lm, datasets:[{ label:'Atenciones', data: vm, backgroundColor:'#3b82f6', borderRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ maxTicksLimit:8 } } } } });
  var pend = Number(agg.por_estado['EN PROCESO'] || 0), fin = Number(agg.por_estado['FINALIZADO'] || 0), env = Number(agg.por_estado['ENVIADO'] || 0);
  _destroyChart('e');
  var elE = document.getElementById('cE');
  if (elE) charts.e = new Chart(elE, { type:'doughnut', data:{ labels:['En Proceso','Enviado','Finalizado'], datasets:[{ data:[pend, env, fin], backgroundColor:['#f97316','#3b82f6','#22c55e'] }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } } });
  var anios = Object.keys(agg.por_anio).filter(function (y) { return /^\d{4}$/.test(y); }).sort();
  _destroyChart('tendAnual');
  var elT = document.getElementById('cTendAnual');
  if (elT && anios.length) charts.tendAnual = new Chart(elT, { type:'line', data:{ labels: anios, datasets:[{ label:'Total anual', data: anios.map(function (y) { return Number(agg.por_anio[y] || 0); }), borderColor:'#0b1e45', backgroundColor:'rgba(11,30,69,0.1)', tension:0.4, fill:true, pointRadius:5 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x: { ticks: { autoSkip: false, maxRotation: 0, minRotation: 0, callback: function (v) { return String(this.getLabelForValue(v)); } } }, y:{ beginAtZero:true } } } });   /* _TENDANUAL_ETIQUETAS_V1 (31-oct): años completos, sin recorte */
  var tbody = document.getElementById('tbResAnualBody');
  if (tbody) {
    var esteAnio = String(new Date().getFullYear());
    tbody.innerHTML = anios.length ? anios.slice().reverse().map(function (y) {
      var actual = (y === esteAnio);
      var rapel = actual ? (agg.por_empresa['RAPEL'] || 0) : '—', verf = actual ? (agg.por_empresa['VERFRUT'] || 0) : '—';
      return '<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:7px 10px;font-weight:700">' + y + '</td>' +
        '<td style="padding:7px 10px;text-align:center;font-weight:800;color:#0b1e45">' + Number(agg.por_anio[y] || 0) + '</td>' +
        '<td style="padding:7px 10px;text-align:center;color:#64748b">' + rapel + '</td><td style="padding:7px 10px;text-align:center;color:#64748b">' + verf + '</td>' +
        '<td style="padding:7px 10px;text-align:center;color:#f97316">' + (actual ? pend : '—') + '</td><td style="padding:7px 10px;text-align:center;color:#22c55e">' + (actual ? fin : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;padding:10px;color:#64748b">Sin datos</td></tr>';
  }
}
/* 0) dibujarEstadisticasDash: sin filtros y con Azure a mano, dibujar desde Azure; con filtros, lo de siempre */
var _dibOrig = window.dibujarEstadisticasDash;
if (typeof _dibOrig === 'function') {
  window.dibujarEstadisticasDash = function (datos, esFiltro) {
    if (agg && !esFiltro && !_hayFiltro()) { try { dibujarDesdeAzure(); return; } catch (e) { console.warn('[_STATS_AZURE_V1] graficos:', e.message); } }
    return _dibOrig.apply(this, arguments);
  };
}

/* 1) cargarStats: primero Azure; si falla, lo de siempre */
var _cargarOrig = window.cargarStats;
if (typeof _cargarOrig === 'function') {
  window.cargarStats = async function () {
    var ok = await refrescar('cargarStats');
    if (ok) { try { if (typeof dibujar === 'function' && ultimo && (_hayFiltro() || !agg)) dibujar(ultimo); } catch (e) {} return; }   /* _DONA_AZURE_V1 (31-oct): sin filtro, Azure ya dibujo la dona; el dibujador antiguo la ponia en 0 con el resumen viejo de Firebase */
    return _cargarOrig.apply(this, arguments);
  };
}

/* 2) _aplicarStats: si ya hay cifras de Azure, mandan ellas */
var _aplicarOrig = window._aplicarStats;
if (typeof _aplicarOrig === 'function') {
  window._aplicarStats = function (s) {
    if (ultimo) { pintar(ultimo); return; }
    return _aplicarOrig.apply(this, arguments);
  };
}

/* 3) Firebase: que no pise los 5 contadores; y como un evento = algo cambio, se repide a Azure */
var _fbOrig = window._fbAplicarEstadisticasFirebase;
if (typeof _fbOrig === 'function') {
  window._fbAplicarEstadisticasFirebase = function () {
    var args = arguments, self = this;
    if (!ultimo) return _fbOrig.apply(self, args);
    var cu = window.countUp;
    if (typeof cu === 'function') {
      window.countUp = function (id) { if (IDS.indexOf(id) >= 0) return; return cu.apply(this, arguments); };
    }
    try { return _fbOrig.apply(self, args); }
    finally { if (typeof cu === 'function') window.countUp = cu; try { if (agg && !_hayFiltro()) dibujarDesdeAzure(); } catch (e) {} programar('firebase', 5000 + Math.floor(Math.random() * 55000)); }   /* _DONA_AZURE_V1: tras Firebase, Azure vuelve a mandar en los graficos (sin red) */   /* _STATS_FRENO_V2: cada pestaña en un momento distinto (antes todas a los 3 s) */
  };
}

/* 4) Tras refrescar atenciones (post-guardado, auto 90 s), refrescar cifras */
var _refAtOrig = window.refrescarAtencionesHoy;
if (typeof _refAtOrig === 'function') {
  window.refrescarAtencionesHoy = function () {
    return Promise.resolve(_refAtOrig.apply(this, arguments)).then(function (r) { programar('atenciones', 1500); return r; });
  };
}

/* 5) Cada 3 min con la pestaña visible */
setInterval(function () {
  try { if (document.visibilityState === 'visible' && _usr()) refrescar('auto 5min'); } catch (e) {}
}, 5 * 60 * 1000);   /* _STATS_FRENO_V2: cada 5 min (antes 3) */

/* 6) Primera carga: apenas haya usuario en sesión */
(function esperar(n) {
  if (_usr()) { refrescar('inicio'); return; }
  if (n < 40) setTimeout(function () { esperar(n + 1); }, 500);
})(0);

console.log('[_STATS_AZURE_V1] listo');
})();
