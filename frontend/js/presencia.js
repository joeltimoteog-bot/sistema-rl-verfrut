/* ============================================================================
 *  presencia.js — Sistema RL v3.0
 *  Módulo de PRESENCIA EN VIVO + RECEPCIÓN DE MENSAJES DEL ADMIN
 *
 *  Se incluye UNA sola vez por página, justo antes de </body>:
 *
 *    <script src="/sistema-rl-verfrut/frontend/js/presencia.js"
 *            data-modulo="Visitas de Campo"></script>
 *
 *  - Escribe en Firebase RTDB  /presencia/{usuario}   (con latido + onDisconnect)
 *  - Escucha                    /mensajes/{usuario}    y muestra avisos del admin
 *
 *  DISEÑO A PRUEBA DE FALLOS: todo va envuelto en try/catch. Si no hay sesión,
 *  si Firebase no carga o si algo falla, el módulo simplemente NO hace nada y
 *  la página sigue funcionando igual. Nunca lanza errores que rompan el sistema.
 * ========================================================================== */
(function () {
  'use strict';

  // Evita doble carga si por error se incluye dos veces
  if (window.__RL_PRESENCIA_CARGADO__) return;
  window.__RL_PRESENCIA_CARGADO__ = true;

  // Captura la etiqueta <script> actual para leer sus data-* (antes de que corra async)
  var _thisScript = document.currentScript;

  // ── 1) Sesión ──────────────────────────────────────────────────────────
  var USER = null;
  try {
    var ud = sessionStorage.getItem('user');
    if (ud) USER = JSON.parse(ud);
  } catch (e) { USER = null; }

  // Sin sesión válida → no hacemos nada (la propia página ya redirige al login)
  if (!USER || !USER.usuario) return;

  // Firebase no admite . # $ [ ] / en las claves → sanitizamos el usuario
  var UKEY = String(USER.usuario).toLowerCase().replace(/[.#$/\[\]]/g, '_');

  // ── 2) Nombre del módulo/página ────────────────────────────────────────
  function detectarModulo() {
    try {
      if (_thisScript && _thisScript.getAttribute('data-modulo')) {
        return _thisScript.getAttribute('data-modulo');
      }
    } catch (e) {}
    // Fallback: nombre del archivo → "dashboard.html" → "Dashboard"
    var archivo = '';
    try { archivo = (location.pathname.split('/').pop() || '').replace('.html', ''); } catch (e) {}
    if (!archivo) return 'Sistema';
    return archivo.charAt(0).toUpperCase() + archivo.slice(1);
  }
  var MODULO = detectarModulo();
  var PAGINA = '';
  try { PAGINA = location.pathname.split('/').pop() || ''; } catch (e) {}

  // ── 3) Config Firebase (idéntica a la del resto del sistema) ────────────
  var firebaseConfig = {
    apiKey: "AIzaSyBTp4WHO5bGEoYDhTbyWZVfdQxbAQHwp4I",
    authDomain: "sistema-rl-verfrut.firebaseapp.com",
    projectId: "sistema-rl-verfrut",
    storageBucket: "sistema-rl-verfrut.firebasestorage.app",
    messagingSenderId: "769176418481",
    appId: "1:769176418481:web:53a487fcaf736b11e24a90",
    databaseURL: "https://sistema-rl-verfrut-default-rtdb.firebaseio.com"
  };

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

  // ── 4) Toast de mensaje del admin (autocontenido, sin depender del CSS) ─
  var _mostrados = {}; // ids ya mostrados en esta sesión (evita repetir)

  function mostrarMensajeAdmin(id, msg) {
    try {
      var wrap = document.getElementById('_rlMsgWrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = '_rlMsgWrap';
        wrap.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;' +
          'display:flex;flex-direction:column;gap:10px;max-width:340px;font-family:inherit;';
        document.body.appendChild(wrap);
      }
      var card = document.createElement('div');
      card.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #38bdf8;' +
        'border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.35);' +
        'animation:_rlIn .35s ease;font-size:13.5px;line-height:1.5;';
      var de = (msg && msg.de) ? String(msg.de) : 'Coordinación RR.LL.';
      var texto = (msg && msg.texto) ? String(msg.texto) : '';
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700;color:#7dd3fc;">' +
        '<span style="font-size:16px;">📌</span><span>Mensaje de ' + _esc(de) + '</span></div>' +
        '<div style="margin-bottom:10px;white-space:pre-wrap;">' + _esc(texto) + '</div>' +
        '<button type="button" style="background:#38bdf8;color:#0f172a;border:none;border-radius:8px;' +
        'padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Entendido</button>';
      var btn = card.querySelector('button');
      btn.addEventListener('click', function () {
        card.style.transition = 'opacity .3s'; card.style.opacity = '0';
        setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 300);
      });
      wrap.appendChild(card);

      if (!document.getElementById('_rlMsgKeyframes')) {
        var st = document.createElement('style');
        st.id = '_rlMsgKeyframes';
        st.textContent = '@keyframes _rlIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';
        document.head.appendChild(st);
      }
    } catch (e) { /* jamás rompemos la página */ }
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── 5) Arranque de Firebase (import dinámico de los módulos ESM) ────────
  (async function iniciar() {
    var appMod, dbMod;
    try {
      appMod = await import(SDK + "firebase-app.js");
      dbMod  = await import(SDK + "firebase-database.js");
    } catch (e) {
      console.warn('[Presencia] Firebase no disponible, presencia desactivada.', e);
      return;
    }

    var initializeApp   = appMod.initializeApp;
    var getApps         = appMod.getApps;
    var getApp          = appMod.getApp;
    var getDatabase     = dbMod.getDatabase;
    var ref             = dbMod.ref;
    var set             = dbMod.set;
    var update          = dbMod.update;
    var onValue         = dbMod.onValue;
    var onDisconnect    = dbMod.onDisconnect;
    var serverTimestamp = dbMod.serverTimestamp;

    var app, db;
    try {
      // App con nombre propio para no chocar con 'resumen-app', 'default', etc.
      var NOMBRE_APP = 'presencia-app';
      var existente = null;
      try { existente = getApps().find(function (a) { return a.name === NOMBRE_APP; }); } catch (e) {}
      app = existente ? getApp(NOMBRE_APP) : initializeApp(firebaseConfig, NOMBRE_APP);
      db  = getDatabase(app);
    } catch (e) {
      console.warn('[Presencia] No se pudo inicializar Firebase.', e);
      return;
    }

    var rPres = ref(db, 'presencia/' + UKEY);

    // Datos base de presencia
    function payload(online) {
      return {
        usuario: USER.usuario,
        nombre:  USER.nombre || USER.usuario,
        rol:     USER.rol || '',
        empresa: USER.empresa || '',
        modulo:  MODULO,
        pagina:  PAGINA,
        online:  !!online,
        ultimo_ping: serverTimestamp()
      };
    }

    // Escribe estado ONLINE y programa el OFFLINE automático al desconectarse
    try {
      await set(rPres, payload(true));
      // Cuando el navegador se cae / cierra pestaña, Firebase marca offline solo:
      onDisconnect(rPres).update({ online: false, ultimo_ping: serverTimestamp() });
      console.log('[Presencia] Activa —', USER.usuario, '| módulo:', MODULO);
    } catch (e) {
      console.warn('[Presencia] No se pudo registrar presencia (¿reglas de Firebase?).', e);
      // seguimos: aunque falle la escritura, no rompemos la página
    }

    // ── Latido cada 20s: mantiene "ultimo_ping" fresco ──
    var HEARTBEAT_MS = 20000;
    var latido = setInterval(function () {
      try { update(rPres, { online: true, modulo: MODULO, pagina: PAGINA, ultimo_ping: serverTimestamp() }); }
      catch (e) {}
    }, HEARTBEAT_MS);

    // Al volver a la pestaña, refresca de inmediato
    document.addEventListener('visibilitychange', function () {
      try {
        update(rPres, {
          online: !document.hidden,
          modulo: MODULO, pagina: PAGINA,
          ultimo_ping: serverTimestamp()
        });
      } catch (e) {}
    });

    // Al cerrar/recargar, intenta marcar offline (onDisconnect es el respaldo real)
    window.addEventListener('beforeunload', function () {
      try {
        clearInterval(latido);
        update(rPres, { online: false, ultimo_ping: serverTimestamp() });
      } catch (e) {}
    });

    // ── Escucha de mensajes del admin dirigidos a este usuario ──
    try {
      var rMsg = ref(db, 'mensajes/' + UKEY);
      onValue(rMsg, function (snap) {
        try {
          var val = snap.val();
          if (!val) return;
          Object.keys(val).forEach(function (id) {
            var m = val[id];
            if (!m || m.leido) return;          // ya leído → no mostrar
            if (_mostrados[id]) return;          // ya mostrado en esta sesión
            _mostrados[id] = true;
            mostrarMensajeAdmin(id, m);
            // Marca como leído para que no reaparezca al recargar
            try { update(ref(db, 'mensajes/' + UKEY + '/' + id), { leido: true, leido_ts: serverTimestamp() }); }
            catch (e) {}
          });
        } catch (e) {}
      }, function (err) {
        console.warn('[Presencia] No se pudieron leer mensajes.', err);
      });
    } catch (e) {}
  })();
})();
