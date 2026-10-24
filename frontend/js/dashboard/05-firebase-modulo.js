/* dashboard.html · bloque 5 (antes en la linea 10439) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, update, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTp4WHO5bGEoYDhTbyWZVfdQxbAQHwp4I",
  authDomain: "sistema-rl-verfrut.firebaseapp.com",
  projectId: "sistema-rl-verfrut",
  storageBucket: "sistema-rl-verfrut.firebasestorage.app",
  messagingSenderId: "769176418481",
  appId: "1:769176418481:web:53a487fcaf736b11e24a90",
  databaseURL: "https://sistema-rl-verfrut-default-rtdb.firebaseio.com"
};

let _db;
try {
  const app = initializeApp(firebaseConfig);
  _db = getDatabase(app);
  try { signInAnonymously(getAuth(app)).catch(function(e){console.warn("[Auth anon]",e&&e.code);}); } catch(e){}
  window._fbEstDb = _db; // exponer al script principal para diagnóstico
  console.log('[Firebase] Inicializado OK — RTDB:', firebaseConfig.databaseURL, '| window._fbEstDb disponible:', !!window._fbEstDb);
} catch(e) {
  console.error('[Firebase] Error al inicializar:', e);
}

// Enviar alerta con update() para no resetear leido_por si la alerta ya existe
window._fbEnviarAlerta = async function(alerta) {
  if (!_db || !alerta.id) return;
  try {
    await update(ref(_db, 'alertas/' + alerta.id), {
      tipo:     alerta.tipo,
      mensaje:  alerta.mensaje,
      fecha:    alerta.fecha,
      caso_nro: alerta.caso_nro,
      dias:     (alerta.dias !== undefined ? alerta.dias : null)
    });
  } catch(e) {
    console.error('[Firebase] Error enviando alerta:', e);
  }
};

// Escuchar nodo /alertas y filtrar ya leídas por este usuario
window._fbIniciarEscucha = function(usuarioId) {
  if (!_db) return;
  onValue(ref(_db, 'alertas'), snap => {
    const raw = snap.val() || {};
    const alertas = Object.entries(raw)
      .map(([k, v]) => ({ ...v, _fbKey: k }))
      .filter(a => !(a.leido_por && a.leido_por[usuarioId]))
      .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
    if (typeof window._fbOnAlertas === 'function') window._fbOnAlertas(alertas);
  }, e => console.error('[Firebase] Error en onValue:', e));
};

// Marcar alerta como leída para este usuario
window._fbMarcarLeida = async function(alertaId, usuarioId) {
  if (!_db || !alertaId || !usuarioId) return;
  try {
    await set(ref(_db, 'alertas/' + alertaId + '/leido_por/' + usuarioId), true);
  } catch(e) {
    console.error('[Firebase] Error marcando leída:', e);
  }
};

// Suscribir a /estadisticas en tiempo real (actualiza automáticamente cuando GAS escribe)
window._fbSuscribirEstadisticas = function(callback) {
  if (!_db) { console.warn('[Firebase] _fbSuscribirEstadisticas: _db no disponible'); callback(null); return; }
  // Cancelar listener anterior si existía para evitar listeners duplicados
  if (typeof window._fbEstUnsubscribe === 'function') {
    console.log('[Firebase] cancelando listener anterior de /estadisticas');
    window._fbEstUnsubscribe();
    window._fbEstUnsubscribe = null;
  }
  console.log('[Firebase] _fbSuscribirEstadisticas: registrando onValue en /estadisticas');
  window._fbEstUnsubscribe = onValue(ref(_db, 'estadisticas'), snap => {
    const val = snap.val();
    console.log('[Firebase] onValue /estadisticas disparado | exists:', snap.exists(), '| keys:', val ? Object.keys(val).join(',') : 'null');
    callback(val);
  }, e => {
    console.error('[Firebase] Error onValue /estadisticas:', e);
    callback(null);
  });
};
