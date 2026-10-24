/* dashboard.html · bloque 13 (antes en la linea 11523) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CONSULTA_AZURE_V1 (27-ago-2026) — Consulta por DNI y por rango contra Azure
   ---------------------------------------------------------------------------
   POR QUE
   El modulo consultaba la hoja de calculo salvo en un caso muy puntual, y por
   eso un rango de dos meses demoraba 15-20 minutos. Azure ya tiene el endpoint
   con los filtros exactos que hacen falta —dni, desde, hasta, supervisor— sobre
   base SQL con indices, y responde en menos de un segundo.

   COMO SE COMPORTA
   · Azure primero, SIEMPRE (por DNI, por rango, por responsable o combinados).
   · Si Azure falla, tarda demasiado o devuelve vacio, cae solo a la hoja de
     calculo, igual que antes. Nunca se queda sin responder.
   · Trae TODAS las paginas: el endpoint devuelve de a 1000, asi que si hay mas
     las va pidiendo hasta completar, con tope de seguridad.
   · Debajo del resultado se ve de donde salio y cuanto demoro.

   ANTES DE CONFIAR DEL TODO
   En la consola del navegador esta  compararFuentes('2026-08-01','2026-08-24')
   que hace la MISMA consulta contra Azure y contra la hoja, y muestra los dos
   totales. Si coinciden, Azure tiene todo. Es la comprobacion que conviene
   correr una vez antes de dar el modulo por bueno.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var AZ_LIMITE   = 1000;   // maximo que acepta el endpoint por pagina
var AZ_MAX_PAG  = 12;     // tope de seguridad: hasta 12.000 registros
var AZ_TIMEOUT  = 25000;  // 25 s y se pasa a la hoja de calculo

function _azFecha(v) { return v ? String(v).slice(0, 10) : ''; }

function _azNormalizar(a) {
  ['fecha_atencion', 'fecha_inicio_doc', 'fecha_termino_doc', 'fecha_inicio_periodo',
   'fecha_termino_periodo', 'fecha_registro', 'fecha_creacion']
    .forEach(function (c) { if (a[c]) a[c] = _azFecha(a[c]); });
  return a;
}

function _azUrl(params, pagina) {
  var u = AZURE_FN_BASE + '/atenciones?limit=' + AZ_LIMITE + '&page=' + pagina;
  /* CONSULTA_AZURE_V2 (25-ago-2026): el endpoint /atenciones esta protegido con
     llave de funcion (authLevel: function). Sin este &code= el propio Azure
     devuelve 401 antes de ejecutar nada. Es la misma llave que ya usa
     cargarAtenciones para los administradores. */
  if (typeof AZURE_FN_KEY_ATLIST !== 'undefined' && AZURE_FN_KEY_ATLIST) {
    u += '&code=' + encodeURIComponent(AZURE_FN_KEY_ATLIST);
  }
  if (params.dni)        u += '&dni='        + encodeURIComponent(String(params.dni).trim());
  if (params.fechaDesde) u += '&desde='      + encodeURIComponent(params.fechaDesde);
  if (params.fechaHasta) u += '&hasta='      + encodeURIComponent(params.fechaHasta);
  if (params.supervisor) u += '&supervisor=' + encodeURIComponent(params.supervisor);
  return u;
}

function _azFetch(url) {
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var to = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, AZ_TIMEOUT);
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
    .then(function (r) {
      clearTimeout(to);
      if (r.status === 401) throw new Error('HTTP 401 - Azure rechazo la llave de acceso');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .catch(function (e) { clearTimeout(to); throw e; });
}

/* ATENCIONES_RANGO_V1: fecha de hace N dias, en formato yyyy-mm-dd */
function _azHaceDias(dias) {
  var f = new Date();
  f.setDate(f.getDate() - (Number(dias) || 0));
  var y = f.getFullYear(), m = f.getMonth() + 1, x = f.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x;
}

/* ATENCIONES_RANGO_V2 (25-ago-2026) - la V1 demoraba demasiado.
   DOS MOTIVOS, LOS DOS CORREGIDOS AQUI:
   1) Pedia las paginas UNA DETRAS DE OTRA. Con 12 paginas eran 12 esperas
      seguidas. Ahora se pide la 1 (que dice cuantas faltan) y el resto SE
      PIDEN TODAS JUNTAS.
   2) Cada evento de Firebase disparaba una recarga completa del ano. Ahora
      el resultado se guarda 3 minutos y, si ya hay un pedido en camino, se
      reutiliza en vez de lanzar otro. */
var AZ_CACHE_MS   = 3 * 60 * 1000;
var _azRangoCache = {};
var _azRangoCurso = {};
/* _ELIMINADAS_V1: para poder vaciarla cuando se elimina una atencion */
window._azLimpiarCache = function () { _azRangoCache = {}; _azRangoCurso = {}; };

async function _azAtencionesRango(desde) {
  var c = _azRangoCache[desde];
  if (c && (Date.now() - c.t) < AZ_CACHE_MS) {
    console.log('[_azAtencionesRango] ' + c.datos.length + ' registros desde memoria (sin pedir nada a Azure)');
    return c.datos;
  }
  if (_azRangoCurso[desde]) {
    console.log('[_azAtencionesRango] ya hay un pedido en camino, se reutiliza');
    return _azRangoCurso[desde];
  }
  var pr = _azRangoPedir(desde).then(function (datos) {
    delete _azRangoCurso[desde];
    if (datos) _azRangoCache[desde] = { t: Date.now(), datos: datos };
    return datos;
  }, function (e) {
    delete _azRangoCurso[desde];
    throw e;
  });
  _azRangoCurso[desde] = pr;
  return pr;
}

/* Devuelve el arreglo, o null si Azure no respondio (ahi entra la hoja). */
async function _azRangoPedir(desde) {
  var t0 = Date.now();
  var params = { fechaDesde: desde };

  var j = await _azFetch(_azUrl(params, 1));
  if (!j || !j.success) return null;

  var lista = (j.data || []).slice();
  var total = Number(j.total || lista.length);
  var paginas = Math.ceil(total / AZ_LIMITE);
  var truncado = false;
  if (paginas > AZ_MAX_PAG) { paginas = AZ_MAX_PAG; truncado = true; }

  if (paginas > 1) {
    /* _CAIDAS_V2 (15-oct-2026): de 3 en 3 (antes las 11 juntas). Con varios usuarios a la vez,
       11 consultas grandes simultaneas por persona saturaban la base. Sigue siendo rapido. */
    var res = [], _pags = [];
    for (var p = 2; p <= paginas; p++) _pags.push(p);
    for (var _i = 0; _i < _pags.length; _i += 3) {
      var _lote = await Promise.all(_pags.slice(_i, _i + 3).map(function (pg) { return _azFetch(_azUrl(params, pg)).catch(function () { return null; }); }));
      res = res.concat(_lote);
    }
    res.forEach(function (jp) {
      if (jp && jp.success) lista = lista.concat(jp.data || []);
    });
  }

  console.log('[_azAtencionesRango] desde ' + desde + ': ' + lista.length + ' de ' +
              total + ' registros en ' + (Date.now() - t0) + ' ms' +
              (truncado ? ' (hay mas, se corto)' : ''));
  return lista;
}
window._azHaceDias        = _azHaceDias;
window._azAtencionesRango = _azAtencionesRango;

/* Trae todas las paginas que haga falta */
async function _consultaAzureFull(params) {
  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  window._azVacio = false;

  var j = await _azFetch(_azUrl(params, 1));
  if (!j || !j.success) throw new Error((j && j.error) || 'respuesta invalida');

  var lista = (j.data || []).slice();
  var total = Number(j.total || lista.length);

  var paginas = Math.ceil(total / AZ_LIMITE);
  var truncado = false;
  if (paginas > AZ_MAX_PAG) { paginas = AZ_MAX_PAG; truncado = true; }

  /* CONSULTA_AZURE_V3 (25-ago-2026): ANTES las paginas se pedian una detras de
     otra, con un await por vuelta. Con 12 paginas eran 12 esperas seguidas y
     por eso la consulta demoraba. Ahora se piden TODAS JUNTAS. */
  if (paginas > 1) {
    var pend = [];
    for (var p = 2; p <= paginas; p++) {
      pend.push(_azFetch(_azUrl(params, p)).catch(function () { return null; }));
    }
    var res = await Promise.all(pend);
    res.forEach(function (jp) { if (jp && jp.success) lista = lista.concat(jp.data || []); });
  }

  if (!lista.length) {
    /* CONSULTA_AZURE_V3: Azure SI respondio, solo que sin resultados. Se marca
       para que la pantalla NO se vaya sola a la hoja de calculo, que demora
       varios minutos. Que lo decida el usuario. */
    window._azVacio = true;
    console.log('[consultarDNI] Azure respondio en ' +
                Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0) +
                ' ms sin resultados para ese filtro.');
    return null;
  }

  lista.forEach(_azNormalizar);
  lista.sort(function (a, b) {
    return String(b.fecha_atencion || '').localeCompare(String(a.fecha_atencion || ''));
  });

  /* Ficha del trabajador, igual que antes */
  var trabajador = null;
  if (params.dni) {
    try {
      var tr = await buscarTrabajadorPorDniAzure(String(params.dni).trim(), '');
      if (tr) trabajador = _mapTrabajadorAzureALegado(tr);
    } catch (e) {}
    if (!trabajador) {
      trabajador = { dni: String(params.dni), nombre: lista[0].nombre || '',
                     empresa: lista[0].empresa || '', cargo: lista[0].cargo || '',
                     fundo: lista[0].fundo || '' };
    }
  }

  var ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
  console.log('[consultarDNI] Azure:', lista.length, 'de', total, 'registros (' + ms + ' ms)');
  _azSello(lista.length, total, ms, truncado);

  return { success: true, data: lista, trabajador: trabajador, total: total, _fuente: 'azure' };
}
window._consultaAzureFull = _consultaAzureFull;

/* Sello con el origen y el tiempo, debajo del resultado */
function _azSello(mostrados, total, ms, truncado) {
  try {
    setTimeout(function () {
      var cont = document.getElementById('consultaResult');
      if (!cont) return;
      var v = document.getElementById('_azSello');
      if (v && v.parentNode) v.parentNode.removeChild(v);
      var s = document.createElement('div');
      s.id = '_azSello';
      s.style.cssText = 'margin-top:10px;font-size:11.5px;color:#475569;background:#f8fafc;' +
        'border:1px solid #e2e8f0;border-radius:7px;padding:6px 10px;display:inline-block';
      s.innerHTML = '⚡ Consultado en Azure · <b>' + mostrados + '</b> de ' + total +
                    ' registros · ' + (ms < 1000 ? ms + ' ms' : (Math.round(ms / 100) / 10) + ' s') +
                    (truncado ? ' · <b style="color:#b45309">hay más: acorta el rango</b>' : '');
      cont.appendChild(s);
    }, 80);
  } catch (e) {}
}

/* ── Comprobacion de cobertura: Azure contra la hoja de calculo ── */
window.compararFuentes = async function (desde, hasta, dni) {
  var params = {};
  if (dni)   params.dni = dni;
  if (desde) params.fechaDesde = desde;
  if (hasta) params.fechaHasta = hasta;

  console.log('%c── Comparando fuentes ──', 'font-weight:bold');
  console.log('   filtro:', JSON.stringify(params));

  var tA = Date.now(), az = null, errA = null;
  try { az = await _consultaAzureFull(params); } catch (e) { errA = e.message; }
  var msA = Date.now() - tA;

  var tG = Date.now(), gas = null, errG = null;
  try {
    gas = await apiGet(Object.assign({ action: 'consultaDNI', rol: ((typeof USER !== 'undefined' && USER && USER.rol) || '') }, params));
  } catch (e) { errG = e.message; }
  var msG = Date.now() - tG;

  var nA = az && az.data ? az.data.length : 0;
  var nG = gas && gas.data ? gas.data.length : 0;

  console.log('   AZURE           :', errA ? ('ERROR ' + errA) : (nA + ' registros en ' + msA + ' ms'));
  console.log('   HOJA DE CALCULO :', errG ? ('ERROR ' + errG) : (nG + ' registros en ' + msG + ' ms'));
  if (!errA && !errG) {
    if (nA === nG) console.log('%c   ✔ COINCIDEN: Azure tiene todo lo de este filtro.', 'color:#166534;font-weight:bold');
    else console.log('%c   ✘ NO COINCIDEN: diferencia de ' + Math.abs(nA - nG) +
                     ' registros. Avisale a Claude antes de confiar en Azure.', 'color:#b91c1c;font-weight:bold');
    if (msG > 0) console.log('   Azure es ~' + Math.max(1, Math.round(msG / Math.max(msA, 1))) + ' veces mas rapido');
  }
  return { azure: nA, hoja: nG, msAzure: msA, msHoja: msG };
};

})();
