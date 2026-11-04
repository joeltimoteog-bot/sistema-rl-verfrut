/* ═════════════════════════════════════════════════════════════════════════
   vigia.js — _VIGIA_V1 (02-nov-2026) · Tiempo real para todas las páginas del Sistema RR.LL.
   Cada 15 s (pestaña visible, y al volver a ella) pide a Azure GET vigia/marcas: una marca por
   tabla (atenciones, casos, visitas, mantenimiento, fusiones, solicitudes, horas, capacitaciones,
   almuerzos, inventario, preavisos, cumplimiento, e360, supervisores, informes, bienestar…).
   Si una marca cambió, avisa a quien se haya registrado para esa clave:
       rlVigia.en('atenciones', function (info) { ... });        // una clave
       rlVigia.en(/^inv_/, function (info) { ... });             // varias claves (regex)
       window.addEventListener('rl:cambio', e => e.detail.clave) // o por evento
   Cada página registra cómo refrescar su módulo; vigia.js no conoce los módulos.
   Interruptores: localStorage.rl_vigia = 'off'  ·  localStorage.rl_vigia_seg = segundos (10–600)
   Diagnóstico: rlVigia.estado()  ·  rlVigia.revisar()
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.rlVigia && window.rlVigia._v1) return;
  var SEG = 15; try { var s = parseInt(localStorage.getItem('rl_vigia_seg') || '', 10); if (s >= 10 && s <= 600) SEG = s; } catch (e) {}
  /* _VIGIA_OFF_V1 (04-nov-2026): APAGADO para todos. Cada pestaña consultaba Azure cada 15 s y, sumado al resto,
     llenó el límite de 90 consultas simultáneas de la base (S1). El tiempo real de atenciones sigue por Firebase.
     Para volver a encenderlo: VIGIA_ACTIVO = true (o, solo en un navegador, localStorage.rl_vigia = 'on'). */
  var VIGIA_ACTIVO = false;
  var apagado = !VIGIA_ACTIVO; try { var lv = localStorage.getItem('rl_vigia'); if (lv === 'off') apagado = true; else if (lv === 'on') apagado = false; } catch (e) {}
  var BASE = (function () { try { if (typeof AZURE_FN_BASE === 'string' && AZURE_FN_BASE) return AZURE_FN_BASE; } catch (e) {} return 'https://rl-fn-verfrut.azurewebsites.net/api'; })();
  var marcas = null, pausaHasta = 0, enCurso = false, timer = null, fallos = 0, manejadores = [], ultimo = null;

  function token() { try { return sessionStorage.getItem('rl_token') || localStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function avisar(clave, info) {
    manejadores.forEach(function (m) {
      try { if ((typeof m.k === 'string' && m.k === clave) || (m.k instanceof RegExp && m.k.test(clave))) m.f(info); } catch (e) { console.warn('[_VIGIA_V1] manejador ' + clave + ':', e); }
    });
    try { window.dispatchEvent(new CustomEvent('rl:cambio', { detail: info })); } catch (e) {}
  }
  async function revisar(motivo) {
    if (apagado || enCurso || document.visibilityState !== 'visible' || Date.now() < pausaHasta) return false;
    var tk = token(); if (!tk) return false;
    enCurso = true;
    try {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, 8000);
      var r = await fetch(BASE + '/vigia/marcas', { headers: { Authorization: 'Bearer ' + tk }, signal: ctl ? ctl.signal : undefined });
      clearTimeout(reloj);
      if (r.status === 401 || r.status === 503) { pausaHasta = Date.now() + 5 * 60 * 1000; console.warn('[_VIGIA_V1] Azure ' + r.status + ' → pausa 5 min'); return false; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json(); if (!j || !j.success || !j.marcas) throw new Error('respuesta inválida');
      fallos = 0; ultimo = { ts: Date.now(), hoy: j.hoy };
      try { window.dispatchEvent(new CustomEvent('rl:vigia', { detail: j })); } catch (e) {}
      if (marcas === null) { marcas = j.marcas; console.log('[_VIGIA_V1] marcas iniciales: ' + Object.keys(marcas).length + ' tablas (' + motivo + ')'); return false; }
      var cambios = Object.keys(j.marcas).filter(function (k) { return j.marcas[k] !== marcas[k]; });
      marcas = j.marcas;
      if (!cambios.length) return false;
      console.log('[_VIGIA_V1] cambios (' + motivo + '): ' + cambios.join(', '));
      cambios.forEach(function (k) { avisar(k, { clave: k, marca: j.marcas[k], hoy: j.hoy, motivo: motivo }); });
      return true;
    } catch (e) {
      fallos++;
      if (fallos >= 3) { pausaHasta = Date.now() + 2 * 60 * 1000; fallos = 0; console.warn('[_VIGIA_V1] 3 fallos seguidos → pausa 2 min:', e && e.message); }
      return false;
    } finally { enCurso = false; }
  }
  function programar() { if (timer) clearInterval(timer); timer = setInterval(function () { revisar('reloj'); }, SEG * 1000); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(function () { revisar('al volver'); }, 300); });

  window.rlVigia = {
    _v1: true,
    en: function (clave, fn) { if (fn) manejadores.push({ k: clave, f: fn }); return window.rlVigia; },
    revisar: function () { return revisar('manual'); },
    olvidar: function () { marcas = null; },          /* tras guardar en esta misma pestaña: la próxima marca no dispara refresco */
    estado: function () { return { cadaSeg: SEG, apagado: apagado, marcas: marcas, pausaHasta: pausaHasta, ultimo: ultimo, manejadores: manejadores.length }; }
  };
  if (apagado) { console.log('[_VIGIA_V1] apagado por localStorage.rl_vigia'); return; }
  setTimeout(function () { revisar('inicio'); programar(); }, 5000);
  console.log('[_VIGIA_V1] activo: comprueba cambios en Azure cada ' + SEG + ' s (pestaña visible)');
})();
