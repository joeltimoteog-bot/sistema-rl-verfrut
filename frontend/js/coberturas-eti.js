/* ═══════════════════════════════════════════════════════════════════════════
   _COBERTURAS_ETI_V1 (18-oct-2026) — Reemplazos del RR.LL. hacia Evaluaciones ETI y Capacitaciones ETI
   ---------------------------------------------------------------------------
   Las ausencias (vacaciones, descanso médico, licencia…) y su reemplazo se siguen registrando en UN solo
   lugar: Sistema RR.LL. › Gestión de usuarios › 🔄 Ausencia (solo jtimoteo).
   Este archivo publica una copia MÍNIMA en la nube de los sistemas ETI (Firestore sistema-eti-verfrut,
   documento config_eti/coberturas) para que allá:
     · las evaluaciones / capacitaciones del sector queden a nombre del reemplazo "en reemplazo de …",
     · las fechas programadas del titular pasen al reemplazo y el titular no figure atrasado.
   Se publica: id, titular (login y nombre), motivo, desde, hasta, reemplazo (login y nombre).
   NO se publican observaciones. Las anuladas no se publican.
   Se dispara al cargar o guardar ausencias, y una vez al día al entrar el administrador.
   Para desactivar: quitar la etiqueta <script> de este archivo.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._COBERTURAS_ETI_V1) return; window._COBERTURAS_ETI_V1 = true;
  var DOC = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/config_eti/coberturas?key=AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
  var LS = 'rl_cob_eti_pub';
  function hoyL() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function usuario() { try { return JSON.parse(sessionStorage.getItem('user') || 'null') || {}; } catch (e) { return {}; } }
  var ultimo = '';
  window._ausPublicarEti = function (lista) {
    try {
      var lim = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
      var cob = (lista || []).filter(function (a) { return a && !a.anulada && a.usuario && a.reemplazo && a.desde && (!a.hasta || a.hasta >= lim); })
        .map(function (a) { return { id: a.id || '', titular: String(a.usuario).toLowerCase(), titular_nombre: a.nombre || '', tipo: a.tipo || '', desde: a.desde, hasta: a.hasta || '', reemplazo: String(a.reemplazo).toLowerCase(), reemplazo_nombre: a.reemplazo_nombre || '' }; })
        .sort(function (x, y) { return String(x.desde).localeCompare(String(y.desde)); });
      var json = JSON.stringify(cob);
      if (json === ultimo) return Promise.resolve(true);
      var cuerpo = { fields: { json: { stringValue: json }, actualizado: { stringValue: new Date().toISOString() }, por: { stringValue: usuario().usuario || '' }, fuente: { stringValue: 'Sistema RR.LL. · Ausencias' } } };
      return fetch(DOC, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
        .then(function (r) { if (r.ok) { ultimo = json; try { localStorage.setItem(LS, hoyL()); } catch (e) {} } else console.warn('[_COBERTURAS_ETI_V1] no se publicó:', r.status); return r.ok; })
        .catch(function (e) { console.warn('[_COBERTURAS_ETI_V1]', e && e.message); return false; });
    } catch (e) { return Promise.resolve(false); }
  };
  /* una vez al día, al entrar el administrador, se refrescan las ausencias (y con eso la copia ETI) */
  setTimeout(function () {
    try {
      if (String(usuario().usuario || '').toLowerCase() !== 'jtimoteo') return;
      var ya = ''; try { ya = localStorage.getItem(LS) || ''; } catch (e) {}
      if (ya === hoyL()) return;
      if (typeof window._ausRecargar === 'function') window._ausRecargar();
    } catch (e) {}
  }, 9000);
})();
