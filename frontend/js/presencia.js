/* ============================================================================
 *  presencia.js — Sistema RL v3.0  (v3: submódulos automáticos + respaldo REST)
 *  Módulo de PRESENCIA EN VIVO + RECEPCIÓN DE MENSAJES DEL ADMIN
 *
 *  Se incluye UNA sola vez por página, justo antes de </body>:
 *
 *    <script src="/sistema-rl-verfrut/frontend/js/presencia.js"
 *            data-modulo="Visitas de Campo"></script>
 *
 *  - Escribe en Firebase RTDB  /presencia/{usuario}   (latido + onDisconnect)
 *  - Escucha                    /mensajes/{usuario}    y muestra avisos del admin
 *  - DETECCIÓN AUTOMÁTICA DE SUBMÓDULO: si el usuario navega por el menú
 *    lateral (botones .ni — como en dashboard.html), el módulo reportado se
 *    actualiza solo ("Visitas de Campo", "Registro de Casos", "Bienestar
 *    Social", ...). También hay API manual: RLPresencia.setModulo('X · Y')
 *  - Si el tiempo real (WebSocket) no abre en ~6s, pasa SOLO a modo respaldo
 *    REST (HTTP normal). Funciona en cualquier red.
 *
 *  A PRUEBA DE FALLOS: todo en try/catch — si algo falla, el módulo no hace
 *  nada y la página sigue funcionando igual.
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

  // Función que "empuja" el estado al canal activo (SDK o REST). La asigna
  // cada modo al arrancar; setModulo la usa para reflejar el cambio al instante.
  var _flushPresencia = null;

  // ── 2b) API pública + detección automática de submódulo ────────────────
  window.RLPresencia = {
    setModulo: function (m) {
      try {
        if (!m) return;
        MODULO = String(m).slice(0, 78);
        if (_flushPresencia) _flushPresencia();
      } catch (e) {}
    },
    getModulo: function () { return MODULO; }
  };

  // Clic en botones del menú lateral (.ni): toma el texto del botón como
  // nombre de submódulo. Cubre dashboard.html sin tocar su código.
  document.addEventListener('click', function (ev) {
    try {
      var t = ev.target;
      var btn = t && t.closest ? t.closest('.ni') : null;
      if (!btn) return;
      if (btn.id === 'navMonitor') return;
      var txt = btn.textContent || '';
      var ic = btn.querySelector ? btn.querySelector('.ic') : null;
      if (ic && ic.textContent) txt = txt.replace(ic.textContent, '');
      txt = txt.replace(/[0-9]+\s*$/, '').trim();
      if (!txt) return;
      if (/cerrar sesi/i.test(txt)) return;
      if (/^inicio$/i.test(txt)) return;
      window.RLPresencia.setModulo(txt);
    } catch (e) {}
  }, true);

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

  // Envía la respuesta del usuario a su propia conversación (vía REST — funciona
  // en cualquier red; el monitor la detecta como respuesta y la marca 💬)
  function enviarRespuesta(texto, cb) {
    try {
      fetch(DB_URL + '/mensajes/' + UKEY + '.json', {
        method: 'POST',
        body: JSON.stringify({
          texto: String(texto).slice(0, 990),
          de: USER.nombre || USER.usuario,
          de_usuario: USER.usuario,
          ts: { '.sv': 'timestamp' },
          leido: false
        })
      }).then(function (r) { cb(!!(r && r.ok)); }).catch(function () { cb(false); });
    } catch (e) { cb(false); }
  }

  // ── Botón flotante "💬 Coordinación": el usuario inicia conversación ────
  function crearBotonChat() {
    try {
      if (document.getElementById('_rlChatBtn')) return;
      var b = document.createElement('button');
      b.id = '_rlChatBtn'; b.type = 'button'; b.title = 'Escribir a Coordinación RR.LL.';
      b.textContent = '💬';
      b.style.cssText = 'position:fixed;bottom:94px;right:24px;z-index:2147483000;width:46px;height:46px;' +
        'border-radius:50%;border:none;background:#0ea5e9;color:#fff;font-size:20px;cursor:pointer;' +
        'box-shadow:0 6px 18px rgba(0,0,0,.3);';
      b.addEventListener('click', togglePanelChat);
      document.body.appendChild(b);
    } catch (e) {}
  }

  function togglePanelChat() {
    try {
      var p = document.getElementById('_rlChatPanel');
      if (p) { p.parentNode.removeChild(p); return; }
      p = document.createElement('div'); p.id = '_rlChatPanel';
      p.style.cssText = 'position:fixed;bottom:150px;right:24px;z-index:2147483001;width:280px;background:#0f172a;' +
        'color:#f1f5f9;border-radius:14px;padding:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);font-size:13px;' +
        'font-family:inherit;';
      p.innerHTML =
        '<div style="font-weight:700;color:#7dd3fc;margin-bottom:8px;">💬 Mensaje a Coordinación RR.LL.</div>' +
        '<textarea placeholder="Escribe tu mensaje…" style="width:100%;box-sizing:border-box;background:#1e293b;' +
        'color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px;min-height:60px;font-family:inherit;' +
        'font-size:12.5px;resize:vertical;margin-bottom:8px;"></textarea>' +
        '<button type="button" style="background:#22c55e;color:#052e16;border:none;border-radius:8px;' +
        'padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Enviar</button>';
      p.querySelector('button').addEventListener('click', function () {
        var ta = p.querySelector('textarea');
        var txt = ((ta && ta.value) || '').trim();
        if (!txt) { if (ta) ta.focus(); return; }
        var b2 = this; b2.disabled = true; b2.textContent = 'Enviando…';
        enviarRespuesta(txt, function (ok) {
          if (ok) {
            b2.textContent = '✓ Enviado';
            setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 900);
          } else {
            b2.disabled = false; b2.textContent = 'Enviar';
            b2.style.background = '#ef4444';
            setTimeout(function () { b2.style.background = '#22c55e'; }, 1500);
          }
        });
      });
      document.body.appendChild(p);
    } catch (e) {}
  }

  // El admin no necesita escribirse a sí mismo
  if (String(USER.usuario).toLowerCase() !== 'jtimoteo') {
    crearBotonChat();
  }

  // ── Historial de conexiones: 1 registro por sesión de navegador ─────────
  try {
    if (!sessionStorage.getItem('_rl_hist_ok')) {
      sessionStorage.setItem('_rl_hist_ok', '1');
      fetch(DB_URL + '/historial/' + UKEY + '.json', {
        method: 'POST',
        body: JSON.stringify({ ts: { '.sv': 'timestamp' }, evento: 'ingreso', pagina: PAGINA, modulo: MODULO })
      }).catch(function () {});
    }
  } catch (e) {}

  // ── Alerta automática por sesión abierta (inactividad / fin de jornada) ─
  // Propuesta Joel Timoteo: recordar cerrar sesión tras inactividad prolongada
  // o al finalizar la jornada, si la sesión sigue abierta. 100% cliente: no
  // usa Firebase ni GAS, así que no consume el contador de deploys ni puede
  // afectar la seguridad ya reforzada.
  try {
    var IDLE_LIMITE_MS = 45 * 60 * 1000;        // 45 min de inactividad
    var JORNADA_FIN_HORA = 18;                  // 6:00 pm — fin de jornada
    var RECORDATORIO_CADA_MS = 30 * 60 * 1000;  // si sigue abierta, repite cada 30 min

    var _ultimaActividadRL = Date.now();
    var _avisoSesionActivo = false;
    var _ultimoAvisoSesionTs = 0;

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { _ultimaActividadRL = Date.now(); }, { passive: true });
    });

    function _cerrarSesionRL() {
      try {
        if (typeof window.logout === 'function') { window.logout(); return; }
      } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try { location.href = '../../index.html'; } catch (e) {}
    }

    function _nombrePilaRL() {
      var n = ((USER.nombre || USER.usuario) || '').toString().trim();
      if (!n) return 'usuario';
      return n.split(' ')[0];
    }

    function mostrarAvisoSesion() {
      try {
        if (_avisoSesionActivo) return;
        _avisoSesionActivo = true;
        _ultimoAvisoSesionTs = Date.now();
        var wrap = document.getElementById('_rlMsgWrap');
        if (!wrap) {
          wrap = document.createElement('div');
          wrap.id = '_rlMsgWrap';
          wrap.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;' +
            'display:flex;flex-direction:column;gap:10px;max-width:340px;font-family:inherit;';
          document.body.appendChild(wrap);
        }
        var card = document.createElement('div');
        card.id = '_rlAvisoSesion';
        card.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #f59e0b;' +
          'border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.35);' +
          'animation:_rlIn .35s ease;font-size:13.5px;line-height:1.5;';
        var texto = 'Estimado(a) ' + _esc(_nombrePilaRL()) + ':\n\n' +
          'Se ha detectado que su sesión en el Sistema de Relaciones Laborales continúa abierta. ' +
          'Si ha finalizado sus actividades, le solicitamos cerrar su sesión para mantener la seguridad ' +
          'de la información y asegurar el correcto funcionamiento del sistema.\n\n' +
          'Gracias por su colaboración.';
        card.innerHTML =
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700;color:#fbbf24;">' +
          '<span style="font-size:16px;">⏰</span><span>Sesión abierta</span></div>' +
          '<div style="margin-bottom:10px;white-space:pre-wrap;">' + texto + '</div>' +
          '<div style="display:flex;gap:8px;">' +
          '<button type="button" data-acc="cerrar" style="background:#f59e0b;color:#1c1917;border:none;' +
          'border-radius:8px;padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">🚪 Cerrar sesión</button>' +
          '<button type="button" data-acc="seguir" style="background:#334155;color:#f1f5f9;border:none;' +
          'border-radius:8px;padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Sigo trabajando</button>' +
          '</div>';
        var _quitarAvisoSesion = function () {
          card.style.transition = 'opacity .3s'; card.style.opacity = '0';
          setTimeout(function () {
            if (card.parentNode) card.parentNode.removeChild(card);
            _avisoSesionActivo = false;
          }, 300);
        };
        card.querySelector('[data-acc="cerrar"]').addEventListener('click', _cerrarSesionRL);
        card.querySelector('[data-acc="seguir"]').addEventListener('click', function () {
          _ultimaActividadRL = Date.now();
          _quitarAvisoSesion();
        });
        wrap.appendChild(card);

        if (!document.getElementById('_rlMsgKeyframes')) {
          var st = document.createElement('style');
          st.id = '_rlMsgKeyframes';
          st.textContent = '@keyframes _rlIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';
          document.head.appendChild(st);
        }
      } catch (e) { _avisoSesionActivo = false; }
    }

    setInterval(function () {
      try {
        if (_avisoSesionActivo) return;
        var yaToca = (Date.now() - _ultimoAvisoSesionTs) >= RECORDATORIO_CADA_MS;
        if (!yaToca) return;
        var inactivoMs = Date.now() - _ultimaActividadRL;
        var finJornada = new Date().getHours() >= JORNADA_FIN_HORA;
        if (inactivoMs >= IDLE_LIMITE_MS || finJornada) {
          mostrarAvisoSesion();
        }
      } catch (e) {}
    }, 60000);
  } catch (e) {}

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
        '<textarea placeholder="Escribe tu respuesta…" style="width:100%;box-sizing:border-box;background:#1e293b;' +
        'color:#f1f5f9;border:1px solid #334155;border-radius:8px;padding:8px;font-size:12.5px;font-family:inherit;' +
        'min-height:52px;resize:vertical;margin-bottom:8px;"></textarea>' +
        '<div style="display:flex;gap:8px;">' +
        '<button type="button" data-acc="resp" style="background:#22c55e;color:#052e16;border:none;border-radius:8px;' +
        'padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">↩️ Responder</button>' +
        '<button type="button" data-acc="ok" style="background:#38bdf8;color:#0f172a;border:none;border-radius:8px;' +
        'padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer;">Entendido</button>' +
        '</div>';
      var cerrar = function () {
        card.style.transition = 'opacity .3s'; card.style.opacity = '0';
        setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 300);
      };
      card.querySelector('[data-acc="ok"]').addEventListener('click', cerrar);
      card.querySelector('[data-acc="resp"]').addEventListener('click', function () {
        var ta = card.querySelector('textarea');
        var rTxt = ((ta && ta.value) || '').trim();
        if (!rTxt) { if (ta) ta.focus(); return; }
        var b = this; b.disabled = true; b.textContent = 'Enviando…';
        enviarRespuesta(rTxt, function (ok) {
          if (ok) {
            b.textContent = '✓ Enviada';
            setTimeout(cerrar, 900);
          } else {
            b.disabled = false; b.textContent = '↩️ Responder';
            b.style.background = '#ef4444';
            setTimeout(function () { b.style.background = '#22c55e'; }, 1500);
          }
        });
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

  function procesarMensajes(val, marcarLeido) {
    try {
      if (!val) return;
      Object.keys(val).forEach(function (id) {
        var m = val[id];
        if (!m || m.leido) return;
        // No mostrar mis propias respuestas (las lee el admin, no yo)
        if (m.de_usuario && String(m.de_usuario) === String(USER.usuario)) return;
        if (_mostrados[id]) return;
        _mostrados[id] = true;
        mostrarMensajeAdmin(id, m);
        try { marcarLeido(id); } catch (e) {}
      });
    } catch (e) {}
  }

  // ── 5) MODO RESPALDO (REST) ────────────────────────────────────────────
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
      ultimo_ping: { '.sv': 'timestamp' }
    };
  }

  function escribirREST() {
    try {
      fetch(DB_URL + '/presencia/' + UKEY + '.json', {
        method: 'PUT',
        body: JSON.stringify(payloadREST(!document.hidden))
      }).catch(function () {});
    } catch (e) {}
  }

  function iniciarREST() {
    if (restActivo) return;
    restActivo = true;
    _flushPresencia = escribirREST;
    console.warn('[Presencia] Tiempo real no disponible — usando modo respaldo (REST).');

    escribirREST();
    restTimers.push(setInterval(escribirREST, 20000));

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
      // Autenticación anónima (Fase 2) — necesaria cuando las reglas exigen auth.
      // Si el proveedor Anónimo no está activo aún, falla en silencio y sigue igual.
      try {
        var authMod = await import(SDK + "firebase-auth.js");
        authMod.signInAnonymously(authMod.getAuth(app)).catch(function (e) {
          console.warn('[Presencia] Auth anónima:', e && e.code);
        });
      } catch (e) {}
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

    var conectadoSDK = false;

    function flushSDK() {
      if (!conectadoSDK) return;
      try { update(rPres, { online: true, modulo: MODULO, pagina: PAGINA, ultimo_ping: serverTimestamp() }); }
      catch (e) {}
    }

    try {
      onValue(ref(db, '.info/connected'), function (s) {
        var ok = !!(s && s.val());
        if (ok) {
          conectadoSDK = true;
          pararREST();
          _flushPresencia = flushSDK;
          flushSDK();
        }
      });
    } catch (e) {}

    setTimeout(function () { if (!conectadoSDK) iniciarREST(); }, 6000);

    try {
      set(rPres, payloadSDK(true));
      onDisconnect(rPres).update({ online: false, ultimo_ping: serverTimestamp() });
      console.log('[Presencia] Activa —', USER.usuario, '| módulo:', MODULO);
    } catch (e) {
      console.warn('[Presencia] No se pudo registrar presencia por SDK.', e);
    }

    var HEARTBEAT_MS = 20000;
    var latido = setInterval(flushSDK, HEARTBEAT_MS);

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
