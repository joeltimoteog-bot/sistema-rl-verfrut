/* ══════ _TRAFICO_V1 (20-set-2026) — emisor de eventos de tráfico ══════
   Uso:  RLTrafico.emit({ accion:'Guardó atención', destino:'Azure SQL', detalle:'N° 19720', tipo:'ok' })
   Escribe un evento liviano en Firebase RTDB /trafico/<ts>_<azar> con el usuario
   de la sesión (RR.LL: sessionStorage.user · ETI: sessionStorage.eti_session).
   Es "dispara y olvida": si Firebase no responde, no pasa nada.
   El Monitor en Vivo (pestaña Tráfico) lo dibuja como un paquete que viaja
   usuario → sistema → destino. Solo acciones de negocio, nunca datos sensibles. */
window.RLTrafico = (function () {
  var DB = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
  var SIS = 'RR.LL';
  var ultimo = {};
  function user() {
    try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); if (u && u.usuario) return { u: u.usuario, n: u.nombre || u.usuario, rol: u.rol || '' }; } catch (e) {}
    try { var s = JSON.parse(sessionStorage.getItem('eti_session') || 'null'); if (s && s.user) return { u: s.user, n: s.nom || s.user, rol: s.rol || '' }; } catch (e) {}
    try { if (window.usuarioActual && usuarioActual.usuario) return { u: usuarioActual.usuario, n: usuarioActual.nombre || usuarioActual.usuario, rol: usuarioActual.rol || '' }; } catch (e) {}
    return null;
  }
  function emit(o) {
    try {
      o = o || {};
      var us = o.user || user(); if (!us) return;
      var clave = us.u + '|' + o.accion + '|' + (o.detalle || '');
      if (ultimo[clave] && Date.now() - ultimo[clave] < 1500) return;   // anti-duplicado
      ultimo[clave] = Date.now();
      var id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      var body = { ts: Date.now(), u: String(us.u).toLowerCase().slice(0, 60), n: String(us.n).slice(0, 120), rol: String(us.rol || '').slice(0, 40),
        sis: String(o.sis || SIS).slice(0, 40), accion: String(o.accion || '').slice(0, 80), destino: String(o.destino || '').slice(0, 40),
        detalle: String(o.detalle || '').slice(0, 160), tipo: String(o.tipo || 'ok').slice(0, 12) };
      fetch(DB + '/trafico/' + id + '.json', { method: 'PUT', body: JSON.stringify(body), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  return { emit: emit, setSistema: function (s) { SIS = s; }, user: user, DB: DB };
})();
