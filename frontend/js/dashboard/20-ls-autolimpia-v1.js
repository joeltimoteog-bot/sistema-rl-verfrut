/* dashboard.html · bloque 20 (antes en la linea 12958) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _LS_AUTOLIMPIA_V1 ══════════════════
   Problema: cada usuario que entra en una PC deja su propia clave
   rl_cache_<usuario> en el almacenamiento local, y nadie las borra nunca.
   Con ~18 usuarios se llenan los 5 M de caracteres que permite el navegador
   y sale el aviso "Almacenamiento local lleno".
   Medido el 13-set en una PC real: 9.94 MB en 73 claves, de las cuales
   8.32 MB eran 18 claves rl_cache_* (17 de usuarios que ya no usan esa PC).

   Que hace este bloque:
     1. Al cargar, borra las rl_cache_ que NO son del usuario conectado.
     2. Envuelve guardarCacheLS: si se llena la cuota, barre las ajenas
        y reintenta antes de rendirse.
     3. Deja window.lsDiagnostico() para revisar el estado desde la consola.

   Que NO toca: rl_session, eti_*, at_historial, cap_lista_*, inv_*,
   eval360_*, bsDraft:*, motivosCasos_v1, rl_filtros_*, rl_at_eliminadas_v1,
   rl_resumen_cache, rl_theme, ni ninguna otra clave.
   Las rl_cache_ son cache pura: cargarCacheLS() devuelve false si no existen
   y preloadData() vuelve a pedir los datos al servidor.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PREFIJO  = 'rl_cache_';
  var _ultimo  = 0;          // throttle: no barrer mas de una vez por minuto
  var ESPERA   = 60000;

  function _usuarioActual() {
    try {
      if (typeof USER !== 'undefined' && USER && USER.usuario) return USER.usuario;
    } catch (e) {}
    try {
      var u = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (u && u.usuario) return u.usuario;
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem('rl_session') || '{}');
      if (s && s.user && s.user.usuario) return s.user.usuario;
    } catch (e) {}
    return null;
  }

  /* Barre las cache de otros usuarios. Devuelve cuantas borro.
     Si no identifica al usuario conectado devuelve -1 y NO borra nada. */
  function _barrerAjenas() {
    var yo = _usuarioActual();
    if (!yo) return -1;
    var mia = PREFIJO + yo, fuera = [], i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf(PREFIJO) === 0 && k !== mia) fuera.push(k);
      }
      for (i = 0; i < fuera.length; i++) localStorage.removeItem(fuera[i]);
    } catch (e) { return -1; }
    if (fuera.length) console.log('[_LS_AUTOLIMPIA_V1] cache ajenas borradas: ' + fuera.length, fuera);
    return fuera.length;
  }

  function _barrerConEspera() {
    var ahora = Date.now();
    if (ahora - _ultimo < ESPERA) return 0;
    _ultimo = ahora;
    return _barrerAjenas();
  }

  /* ── Reintento al llenarse la cuota ── */
  var _guardarPrev = window.guardarCacheLS;
  if (typeof _guardarPrev === 'function') {
    window.guardarCacheLS = function () {
      var yo = _usuarioActual();
      if (yo) {
        try {
          // Sonda barata: si la cuota esta llena esto lanza excepcion.
          localStorage.setItem('_rl_sonda', '1');
          localStorage.removeItem('_rl_sonda');
        } catch (e) {
          _barrerConEspera();               // hacer sitio y seguir
        }
      }
      return _guardarPrev.apply(this, arguments);
    };
  }

  /* ── Diagnostico manual desde la consola: lsDiagnostico() ── */
  window.lsDiagnostico = function () {
    var filas = [], t = 0, i, k, b;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      b = (k.length + (localStorage.getItem(k) || '').length) * 2;
      t += b; filas.push([k, b]);
    }
    filas.sort(function (a, c) { return c[1] - a[1]; });
    var r = '=== ALMACENAMIENTO LOCAL DE ' + location.host + ' ===\n';
    r += 'TOTAL: ' + (t / 1048576).toFixed(2) + ' MB de ~10 MB  |  claves: ' + filas.length + '\n';
    r += 'Usuario conectado: ' + (_usuarioActual() || '(no identificado)') + '\n';
    r += '------------------------------------------------\n';
    filas.forEach(function (f) {
      r += (Math.round(f[1] / 1024) + ' KB') + '   ' + f[0] + '\n';
    });
    return r;
  };
  window.lsLimpiarAjenas = _barrerAjenas;

  /* ── Barrido al cargar ── */
  function _iniciar() {
    setTimeout(function () {
      var n = _barrerAjenas();
      if (n === -1) setTimeout(_barrerAjenas, 4000);   // USER aun no listo: reintento
    }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _iniciar);
  else _iniciar();

  console.log('[_LS_AUTOLIMPIA_V1] listo');
})();
