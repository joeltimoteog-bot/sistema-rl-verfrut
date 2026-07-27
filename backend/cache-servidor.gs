/************************************************************************
 * CACHÉ DE SERVIDOR — Resumen General y Estadísticas Admin
 * ----------------------------------------------------------------------
 * Hace que las consultas pesadas (getResumenGeneral / getEstadisticasAdmin)
 * se calculen UNA vez cada 5 minutos y las demás veces salgan de memoria
 * del servidor. Así la primera carga del día y la de todos los usuarios
 * también es rápida, no solo la copia local del navegador.
 *
 * INSTALACIÓN (2 pasos, en el Apps Script del sistema RR.LL):
 *
 * 1. Pega este archivo completo como un archivo nuevo (o al final de codigo.gs).
 *
 * 2. En el switch de doPost/handle (parte alta de codigo.gs), busca estas
 *    dos líneas:
 *
 *      case 'getResumenGeneral': result = getResumenGeneral(params);break;
 *      case 'getEstadisticasAdmin': result = getEstadisticasAdmin(params); break;
 *
 *    y reemplázalas por estas dos (única diferencia: pasan por la caché):
 *
 *      case 'getResumenGeneral': result = _conCacheServidor_('resGen', params, 300, function(){ return getResumenGeneral(params); }); break;
 *      case 'getEstadisticasAdmin': result = _conCacheServidor_('estAdm', params, 300, function(){ return getEstadisticasAdmin(params); }); break;
 *
 *    Guarda → Implementar → Gestionar implementaciones → ✏️ → Nueva versión.
 *
 * Nota: los datos pueden llegar con hasta 5 minutos de retraso respecto a
 * la hoja. El botón "🔄 Actualizar" de cada módulo NO salta esta caché del
 * servidor; si algún día necesitas verla fresca al segundo, espera esos
 * 5 minutos o reduce el 300 (segundos) en las dos líneas.
 ************************************************************************/

function _conCacheServidor_(prefijo, params, segundos, fn) {
  var clave = '';
  try {
    clave = prefijo + '_' + Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(params || {}))
    ).substring(0, 24);
  } catch (e) { return fn(); }

  var cache = CacheService.getScriptCache();

  // 1) ¿Está en caché? (puede venir partida en trozos si es grande)
  try {
    var meta = cache.get(clave + '_n');
    if (meta) {
      var n = Number(meta), partes = [];
      var claves = [];
      for (var i = 0; i < n; i++) claves.push(clave + '_' + i);
      var mapa = cache.getAll(claves);
      var completo = true;
      for (var j = 0; j < n; j++) {
        if (mapa[clave + '_' + j] == null) { completo = false; break; }
        partes.push(mapa[clave + '_' + j]);
      }
      if (completo) return JSON.parse(partes.join(''));
    }
  } catch (e) { /* caché ilegible → recalcular */ }

  // 2) No está: calcular de verdad y guardar
  var resultado = fn();
  try {
    var texto = JSON.stringify(resultado);
    // CacheService admite ~100 KB por entrada → partir en trozos de 90 KB
    var TAM = 90 * 1024, trozos = [];
    for (var p = 0; p < texto.length; p += TAM) trozos.push(texto.substring(p, p + TAM));
    if (trozos.length <= 10) {              // hasta ~900 KB; más grande no se cachea
      var aGuardar = {};
      trozos.forEach(function (tz, idx) { aGuardar[clave + '_' + idx] = tz; });
      aGuardar[clave + '_n'] = String(trozos.length);
      cache.putAll(aGuardar, segundos);
    }
  } catch (e) { /* si no entra en caché, no pasa nada: se devuelve igual */ }
  return resultado;
}
