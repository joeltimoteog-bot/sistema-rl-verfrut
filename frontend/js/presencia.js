/* ============================================================================
 *  presencia.js — Sistema RL v3.0  (v2 con modo respaldo REST)
 *  Módulo de PRESENCIA EN VIVO + RECEPCIÓN DE MENSAJES DEL ADMIN
 *
 *  Se incluye UNA sola vez por página, justo antes de </body>:
 *
 *    <script src="/sistema-rl-verfrut/frontend/js/presencia.js"
 *            data-modulo="Visitas de Campo"></script>
 *
 *  - Escribe en Firebase RTDB  /presencia/{usuario}   (latido + onDisconnect)
 *  - Escucha                    /mensajes/{usuario}    y muestra avisos del admin
 *  - Si la conexión en tiempo real (WebSocket) no abre en ~6s (proxy/red
 *    corporativa), pasa SOLO a modo respaldo: escrituras y lecturas por REST
 *    (HTTP normal) cada 15-20 segundos. Funciona en cualquier red.
 *
 *  DISEÑO A PRUEBA DE FALLOS: todo en try/catch. Si algo falla, el módulo
 *  no hace nada y la página sigue funcionando igual.
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__RL_PRESENCIA_CARGADO__) return;
  window.__RL_PRESENCIA_CARGADO__ = true;

  var _thisScript = document.currentScript;

  // ── 1) Sesión ──────────────────────────────────────────────────────────
  var USER = null;
  try {
    var ud = sessionStorage.getItem('user');
    if (ud) USER = JSON.parse(ud);
  } catch (e) { USER = null; }
  if (!USER || !USER.usuario) return;

  var UKEY = String(USER.usuario).toLowerCase().replace(/[.#$/\[\]]/g, '_');

  // ── 2) Módulo/página ───────────────────────────────────────────────────
  function detectarModulo() {
    try {
      if (_thisScript && _thisScript.getAttribute('data-modulo')) {
        return _thisScript.getAttribute('data-modulo');
      }
    } catch (e) {}
    var archivo = '';
    try { archivo = (location.pathname.split('/').pop() || '').replace('.html', ''); } catch (e) {}
    if (!archivo) return 'Sistema';
    return archivo.charAt(0).toUpperCase() + archivo.slice(1);
  }
  var MODULO = detectarModulo();
  var PAGINA = '';
  try { PAGINA = location.pathname.split('/').pop() || ''; } catch (e) {}

  // ── 3) Config Firebase ─────────────────────────────────────────────────
  var DB_URL = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
  var firebaseConfig = {
    apiKey: "AIzaSyBTp4WHO5bGEoYDhTbyWZVfdQxbAQHwp4I",
    authDomain: "sistema-rl-verfrut.firebaseapp.com",
    projectId: "sistema-rl-verfrut",
    storageBucket: "sistema-rl-verfrut.firebasestorage.app",
    messagingSenderId: "769176418481",
    appId: "1:769176418481:web:53a487fcaf736b11e24a90",
    databaseURL: DB_URL
  };
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

  // ── 4) Toast de mensaje del admin ──────────────────────────────────────
  var _mostrados = {};

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
    } catch (e) {}
  }

  // Procesa el objeto de mensajes (viene del SDK o de REST) y muestra los no leídos.
  // marcarLeido(id) es la función que persiste el "leído" según el canal activo.
  function procesarMensajes(val, marcarLeido) {
    try {
      if (!val) return;
      Object.keys(val).forEach(function (id) {
        var m = val[id];
        if (!m || m.leido) return;
        if (_mostrados[id]) return;
        _mostrados[id] = true;
        mostrarMensajeAdmin(id, m);
        try { marcarLeido(id); } catch (e) {}
      });
    } catch (e) {}
  }

  // ── 5) MODO RESPALDO (REST) — funciona en cualquier red ────────────────
  var restActivo = false;
  var restTimers = [];

  function payloadREST(online) {
    return {
      usuario: USER.usuario,
      nombre:  USER.nombre || USER.usuario,
      rol:     USER.rol || '',
      empresa: USER.empresa || '',
      modulo:  MODULO,
      pagina:  PAGINA,
      online:  !!online,
      ultimo_ping: { '.sv': 'timestamp' }   // el servidor pone la hora
    };
  }

  function iniciarREST() {
    if (restActivo) return;
    restActivo = true;
    console.warn('[Presencia] Tiempo real no disponible — usando modo respaldo (REST).');

    var escribir = function () {
      try {
        fetch(DB_URL + '/presencia/' + UKEY + '.json', {
          method: 'PUT',
          body: JSON.stringify(payloadREST(!document.hidden))
        }).catch(function () {});
      } catch (e) {}
    };
    escribir();
    restTimers.push(setInterval(escribir, 20000));

    var pollMensajes = function () {
      try {
        fetch(DB_URL + '/mensajes/' + UKEY + '.json')
          .then(function (r) { return r.json(); })
          .then(function (val) {
            procesarMensajes(val, function (id) {
              fetch(DB_URL + '/mensajes/' + UKEY + '/' + id + '.json', {
                method: 'PATCH',
                body: JSON.stringify({ leido: true, leido_ts: { '.sv': 'timestamp' } })
              }).catch(function () {});
            });
          }).catch(function () {});
      } catch (e) {}
    };
    pollMensajes();
    restTimers.push(setInterval(pollMensajes, 15000));

    window.addEventListener('beforeunload', function () {
      try {
        fetch(DB_URL + '/presencia/' + UKEY + '.json', {
          method: 'PATCH',
          body: JSON.stringify({ online: false }),
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    });
  }

  function pararREST() {
    if (!restActivo) return;
    restActivo = false;
    restTimers.forEach(function (t) { try { clearInterval(t); } catch (e) {} });
    restTimers = [];
    console.log('[Presencia] Tiempo real recuperado — modo respaldo apagado.');
  }

  // ── 6) Arranque: intenta SDK (tiempo real); si no conecta → REST ────────
  (async function iniciar() {
    var appMod, dbMod;
    try {
      appMod = await import(SDK + "firebase-app.js");
      dbMod  = await import(SDK + "firebase-database.js");
    } catch (e) {
      console.warn('[Presencia] SDK Firebase no cargó — voy directo a modo respaldo.', e);
      iniciarREST();
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
      var NOMBRE_APP = 'presencia-app';
      var existente = null;
      try { existente = getApps().find(function (a) { return a.name === NOMBRE_APP; }); } catch (e) {}
      app = existente ? getApp(NOMBRE_APP) : initializeApp(firebaseConfig, NOMBRE_APP);
      db  = getDatabase(app);
    } catch (e) {
      console.warn('[Presencia] No se pudo inicializar Firebase — modo respaldo.', e);
      iniciarREST();
      return;
    }

    var rPres = ref(db, 'presencia/' + UKEY);

    function payloadSDK(online) {
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

    // ¿La conexión en tiempo real llegó a abrir? (.info/connected)
    var conectadoSDK = false;
    try {
      onValue(ref(db, '.info/connected'), function (s) {
        var ok = !!(s && s.val());
        if (ok) { conectadoSDK = true; pararREST(); }
      });
    } catch (e) {}

    // Si en 6s no abrió la conexión en tiempo real → modo respaldo
    setTimeout(function () { if (!conectadoSDK) iniciarREST(); }, 6000);

    // Escritura por SDK (queda en cola si aún no conecta; no estorba)
    try {
      set(rPres, payloadSDK(true));
      onDisconnect(rPres).update({ online: false, ultimo_ping: serverTimestamp() });
      console.log('[Presencia] Activa —', USER.usuario, '| módulo:', MODULO);
    } catch (e) {
      console.warn('[Presencia] No se pudo registrar presencia por SDK.', e);
    }

    // Latido SDK cada 20s (solo tiene efecto real cuando hay conexión)
    var HEARTBEAT_MS = 20000;
    var latido = setInterval(function () {
      if (!conectadoSDK) return;
      try { update(rPres, { online: true, modulo: MODULO, pagina: PAGINA, ultimo_ping: serverTimestamp() }); }
      catch (e) {}
    }, HEARTBEAT_MS);

    document.addEventListener('visibilitychange', function () {
      if (!conectadoSDK) return;
      try {
        update(rPres, { online: !document.hidden, modulo: MODULO, pagina: PAGINA, ultimo_ping: serverTimestamp() });
      } catch (e) {}
    });

    window.addEventListener('beforeunload', function () {
      try {
        clearInterval(latido);
        if (conectadoSDK) update(rPres, { online: false, ultimo_ping: serverTimestamp() });
      } catch (e) {}
    });

    // Mensajes por SDK (cuando hay tiempo real; en respaldo los trae el poll REST)
    try {
      var rMsg = ref(db, 'mensajes/' + UKEY);
      onValue(rMsg, function (snap) {
        procesarMensajes(snap.val(), function (id) {
          update(ref(db, 'mensajes/' + UKEY + '/' + id), { leido: true, leido_ts: serverTimestamp() });
        });
      }, function (err) {
        console.warn('[Presencia] No se pudieron leer mensajes por SDK.', err);
      });
    } catch (e) {}
  })();
})();
