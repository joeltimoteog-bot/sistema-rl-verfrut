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

  // ── 3b) Notificaciones del navegador (avisos con la pestaña en 2.º plano) ──
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      var _pedirPermisoNotif = function () {
        try { Notification.requestPermission().then(function(){})['catch'](function () {}); }
        catch (e) { try { Notification.requestPermission(function () {}); } catch (e2) {} }
        document.removeEventListener('click', _pedirPermisoNotif, true);
      };
      document.addEventListener('click', _pedirPermisoNotif, true);
    }
  } catch (e) {}
  function _notifNav(titulo, cuerpo) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (!document.hidden) return;   // solo cuando la pestaña NO está visible
      var n = new Notification(titulo, {
        body: String(cuerpo || '').slice(0, 180),
        icon: '/sistema-rl-verfrut/frontend/images/icon-192.png'
      });
      n.onclick = function () { try { window.focus(); n.close(); } catch (e) {} };
      setTimeout(function () { try { n.close(); } catch (e) {} }, 12000);
    } catch (e) {}
  }

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
  var ES_ADMIN = ['jtimoteo'].indexOf(String(USER.usuario).toLowerCase()) !== -1;
  if (!ES_ADMIN) {
    crearBotonChat();
  }

  // ── 4b) ADMIN: aviso cuando un usuario se conecta (RR.LL o Evaluaciones ETI) ──
  // Vigila /presencia (donde escriben TODOS los sistemas, incluido el Sistema de
  // Evaluaciones ETI) y muestra una tarjeta cuando alguien pasa a estar en línea.
  var _presVistos = null;   // null = primera carga (línea base, sin avisos)

  function _wrapAvisos() {
    var wrap = document.getElementById('_rlMsgWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = '_rlMsgWrap';
      wrap.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;' +
        'display:flex;flex-direction:column;gap:10px;max-width:340px;font-family:inherit;';
      document.body.appendChild(wrap);
    }
    if (!document.getElementById('_rlMsgKeyframes')) {
      var st = document.createElement('style');
      st.id = '_rlMsgKeyframes';
      st.textContent = '@keyframes _rlIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}';
      document.head.appendChild(st);
    }
    return wrap;
  }

  function _tarjetaIngreso(nombre, sistemaTxt) {
    try {
      var wrap = _wrapAvisos();
      var card = document.createElement('div');
      card.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #22c55e;' +
        'border-radius:12px;padding:12px 14px;box-shadow:0 12px 34px rgba(0,0,0,.35);' +
        'animation:_rlIn .35s ease;font-size:13px;line-height:1.5;';
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#4ade80;margin-bottom:4px;">' +
        '<span>🟢</span><span>Usuario conectado</span></div>' +
        '<div>' + _esc(nombre) + ' está en ' + _esc(sistemaTxt) + '.</div>';
      _notifNav('🟢 ' + nombre, 'Está en ' + sistemaTxt);
      wrap.appendChild(card);
      setTimeout(function () {
        card.style.transition = 'opacity .4s'; card.style.opacity = '0';
        setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 400);
      }, 12000);
    } catch (e) {}
  }

  function procesarPresenciaAdmin(val) {
    try {
      if (!val) return;
      var activos = {};
      Object.keys(val).forEach(function (k) {
        var p = val[k] || {};
        if (String(p.usuario || '').toLowerCase() === String(USER.usuario).toLowerCase()) return;
        var fresco = p.online && (Date.now() - Number(p.ultimo_ping || 0)) < 130000;
        if (fresco) activos[k] = p;
      });
      if (_presVistos === null) { _presVistos = activos; return; }   // primera carga: solo línea base
      Object.keys(activos).forEach(function (k) {
        if (!_presVistos[k]) {
          var p = activos[k];
          var sis = p.modulo === 'Evaluaciones ETI'
            ? 'el Sistema de Evaluaciones (ETI)'
            : p.modulo === 'Sistema ETI · Capacitaciones'
              ? 'el Sistema ETI (Capacitaciones)'
              : 'el Sistema RR.LL' + (p.modulo ? ' — ' + p.modulo : '');
          _tarjetaIngreso(p.nombre || p.usuario || k, sis);
        }
      });
      _presVistos = activos;
    } catch (e) {}
  }

  // ── 4c) ALERTA FLOTANTE DE PENDIENTES — seguimiento de gestión ──────────
  // Junta dos fuentes: capacitaciones de Ética Social programadas (Firestore
  // del Sistema ETI · Capacitaciones) y pendientes RR.LL (informes de visitas
  // y casos sin informe/reporte, vía GAS getCumplimiento — la misma fuente del
  // Monitor). Muestra una tarjeta flotante que NO se puede cerrar: solo
  // minimizar. Desaparece únicamente cuando el usuario ya no tiene pendientes.
  var PEND_GAS = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
  var PEND_FS = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
  var PEND_FS_KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
  var PEND_REFRESCO_MS = 10 * 60 * 1000;    // re-verificar cada 10 min
  var PEND_REABRIR_MS = 30 * 60 * 1000;     // si la minimizan, reabrir a los 30 min

  function _pNorm(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function _pCoincide(a, b) {
    a = _pNorm(a); b = _pNorm(b);
    if (!a || !b) return false;
    if (a === b) return true;
    var A = a.split(' ').filter(function (w) { return w.length > 2; });
    var Bw = b.split(' ').filter(function (w) { return w.length > 2; });
    // Palabra en común = igual, o una es prefijo de la otra (ALEX ~ ALEXANDER, VENEGA ~ VENEGAS)
    var igual = function (x, y) {
      if (x === y) return true;
      if (x.length >= 4 && y.length >= 4) return x.indexOf(y) === 0 || y.indexOf(x) === 0;
      return false;
    };
    var c = A.filter(function (w) { return Bw.some(function (v) { return igual(w, v); }); }).length;
    return c >= 3 || (c >= 2 && (A.length <= 2 || Bw.length <= 2));
  }
  function _fsVal(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.arrayValue) return (v.arrayValue.values || []).map(_fsVal);
    if (v.mapValue) {
      var o = {}, f = v.mapValue.fields || {};
      Object.keys(f).forEach(function (k) { o[k] = _fsVal(f[k]); });
      return o;
    }
    return null;
  }
  function _fsDocs(json) {
    return (json && json.documents || []).map(function (d) {
      var o = {}, f = d.fields || {};
      Object.keys(f).forEach(function (k) { o[k] = _fsVal(f[k]); });
      return o;
    });
  }
  function _fsGet(col) {
    return fetch(PEND_FS + col + '?pageSize=300&key=' + PEND_FS_KEY)
      .then(function (r) { return r.json(); }).then(_fsDocs);
  }
  function _pHoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _pFmt(iso) {
    try {
      var d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    } catch (e) { return iso || ''; }
  }

  // Capacitaciones ETI programadas pendientes para este usuario
  function _pCargarCapacitaciones() {
    return Promise.all([_fsGet('usuarios_eti').catch(function () { return []; }),
                        _fsGet('programaciones_eti').catch(function () { return []; })])
      .then(function (res) {
        var cuentas = res[0], progs = res[1];
        var miNombre = USER.nombre || USER.usuario;
        var cta = cuentas.find(function (c) { return String(c.usuario || '').toLowerCase() === String(USER.usuario).toLowerCase(); });
        var nombreSup = (cta && cta.supervisorNombre) || miNombre;
        var hoy = _pHoyISO();
        var lista = [];
        progs.forEach(function (p) {
          if (p.estado === 'ejecutada') return;
          if (!_pCoincide(p.supervisor || '', nombreSup) && !_pCoincide(p.supervisor || '', miNombre)) return;
          var fechas = (p.fechas && p.fechas.length ? p.fechas.slice().sort() : [p.fechaProgramada, p.fechaFin || p.fechaProgramada].filter(Boolean).sort());
          if (!fechas.length) return;
          var ini = fechas[0], fin = fechas[fechas.length - 1];
          var estado, dias;
          if (hoy > fin) {
            dias = Math.round((new Date(hoy) - new Date(fin)) / 86400000);
            estado = 'VENCIDA — ' + dias + ' día(s) de atraso';
          } else if (hoy >= ini) {
            estado = (ini === fin) ? 'programada para HOY' : 'EN CURSO';
          } else {
            dias = Math.round((new Date(ini) - new Date(hoy)) / 86400000);
            if (dias > 7) return;   // avisar desde 7 días antes
            estado = 'próxima — en ' + dias + ' día(s)';
          }
          lista.push({ tema: p.tema || 'Capacitación ETI', sector: p.sector || '',
                       fechasTxt: ini === fin ? _pFmt(ini) : _pFmt(ini) + ' al ' + _pFmt(fin),
                       estado: estado, vencida: hoy > fin });
        });
        return lista;
      });
  }

  // Evaluaciones de Ética Social programadas pendientes para este usuario
  function _pCargarEvaluaciones() {
    return _fsGet('programaciones_eval').catch(function () { return []; }).then(function (progs) {
      var hoy = _pHoyISO(), lista = [];
      var miNombre = USER.nombre || USER.usuario;
      progs.forEach(function (p) {
        if (p.estado === 'ejecutada') return;
        if (!_pCoincide(p.sup || '', miNombre)) return;
        var ejec = p.fechasEjecutadas || [];
        var pend = (p.fechas || []).filter(function (f) { return ejec.indexOf(f) < 0; }).sort();
        if (!pend.length) return;
        var venc = pend.filter(function (f) { return f < hoy; });
        var prox = pend.filter(function (f) { return f >= hoy; });
        if (!venc.length) {
          if (!prox.length) return;
          var d = Math.round((new Date(prox[0]) - new Date(hoy)) / 86400000);
          if (d > 7) return;
          lista.push({ fechasTxt: pend.map(_pFmt).join(' · '), vencida: false,
                       estado: d === 0 ? 'programada para HOY' : 'próxima — en ' + d + ' día(s)' });
        } else {
          lista.push({ fechasTxt: pend.map(_pFmt).join(' · '), vencida: true,
                       estado: 'VENCIDA — la fecha programada ya pasó y aún no registras' });
        }
      });
      return lista;
    });
  }

  // Pendientes RR.LL (visitas y casos) para este usuario
  function _pCargarRRLL() {
    return fetch(PEND_GAS + '?' + new URLSearchParams({ action: 'getCumplimiento', usuario: USER.usuario || '' }))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.success) return { visitas: [], casos: 0 };
        var miNombre = USER.nombre || USER.usuario;
        var visitas = (res.pendientesVisitas || [])
          .filter(function (p) { return _pCoincide(p.nombre, miNombre); })
          .map(function (p) { return p.estado || 'vencido'; });
        var casos = (res.casosPendientes || [])
          .filter(function (p) { return _pCoincide(p.nombre_mostrar, miNombre); }).length;
        return { visitas: visitas, casos: casos };
      })
      .catch(function () { return { visitas: [], casos: 0 }; });
  }

  var _pendMin = false, _pendReabrirT = null;

  function _pNombrePila() {
    var n = ((USER.nombre || USER.usuario) || '').toString().trim().split(' ')[0] || 'colega';
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  }

  function _pQuitarUI() {
    ['_rlPendCard', '_rlPendPill'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function _pRenderPill(total) {
    _pQuitarUI();
    var pill = document.createElement('button');
    pill.id = '_rlPendPill'; pill.type = 'button';
    pill.innerHTML = '⏰ ' + total + ' pendiente(s)';
    pill.style.cssText = 'position:fixed;bottom:130px;left:20px;z-index:2147482000;background:#f59e0b;color:#451a03;' +
      'border:none;border-radius:999px;padding:9px 16px;font-weight:800;font-size:12.5px;cursor:pointer;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.45);animation:_rlPulso 1.6s infinite;font-family:inherit;';
    pill.title = 'Ver mis pendientes';
    pill.addEventListener('click', function () { _pendMin = false; _pActualizar(); });
    document.body.appendChild(pill);
    if (!document.getElementById('_rlPendKf')) {
      var st = document.createElement('style');
      st.id = '_rlPendKf';
      st.textContent = '@keyframes _rlPulso{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}';
      document.head.appendChild(st);
    }
    clearTimeout(_pendReabrirT);
    _pendReabrirT = setTimeout(function () { _pendMin = false; _pActualizar(); }, PEND_REABRIR_MS);
  }

  function _pRenderCard(caps, evals, rrll) {
    _pQuitarUI();
    var items = '';
    caps.forEach(function (c) {
      items += '<div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.3);border-radius:10px;padding:9px 11px;margin-top:8px;">' +
        '🎓 <b>Capacitación de Ética Social programada:</b> ' + _esc(c.tema) +
        (c.sector ? ' · ' + _esc(c.sector) : '') +
        '<br>Fechas designadas: <b>' + _esc(c.fechasTxt) + '</b> — <b style="color:' + (c.vencida ? '#f87171' : '#7dd3fc') + '">' + _esc(c.estado) + '</b>' +
        '<br><span style="opacity:.85">' + (c.vencida ? 'Aún no la registras en el módulo de Capacitaciones ETI y la fecha programada ya venció. ' : '') +
        'Recuerda realizarla y registrarla según el correo enviado por el coordinador Joel Timoteo.</span></div>';
    });
    evals.forEach(function (ev) {
      items += '<div style="background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.35);border-radius:10px;padding:9px 11px;margin-top:8px;">' +
        '⭐ <b>Evaluación de Ética Social programada:</b> fechas <b>' + _esc(ev.fechasTxt) + '</b> — <b style="color:' + (ev.vencida ? '#f87171' : '#fde047') + '">' + _esc(ev.estado) + '</b>' +
        '<br><span style="opacity:.85">' + (ev.vencida ? 'Todavía no registras tus evaluaciones en el Sistema de Evaluaciones ETI. Por favor regístralas o coordina tu reprogramación.' : 'Recuerda registrar tus evaluaciones en el Sistema de Evaluaciones ETI en las fechas programadas.') + '</span></div>';
    });
    rrll.visitas.forEach(function (est) {
      items += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:9px 11px;margin-top:8px;">' +
        '📋 <b>Informe de visitas ' + (est === 'plazo_hoy' ? '(el plazo vence HOY)' : '(VENCIDO)') + ':</b> ' +
        (est === 'plazo_hoy' ? 'recuerda que hoy vence el plazo para subir tu informe de visitas.' : 'tienes vencido el informe de visitas de la semana pasada. Por favor regularízalo hoy.') + '</div>';
    });
    if (rrll.casos) {
      items += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:9px 11px;margin-top:8px;">' +
        '📁 <b>' + rrll.casos + ' caso(s) por vencer:</b> registrados sin informe ni reporte subido en Registro de Casos. Por favor regularízalos antes de que venzan.</div>';
    }
    var card = document.createElement('div');
    card.id = '_rlPendCard';
    card.style.cssText = 'position:fixed;bottom:130px;left:20px;z-index:2147482000;width:340px;max-width:calc(100vw - 40px);' +
      'max-height:calc(100vh - 190px);overflow-y:auto;background:#0f172a;color:#f1f5f9;border-left:4px solid #f59e0b;' +
      'border-radius:14px;padding:14px 16px;box-shadow:0 14px 40px rgba(0,0,0,.5);font-size:13px;line-height:1.5;font-family:inherit;';
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">' +
      '<div style="font-weight:800;color:#fbbf24;">⏰ Seguimiento de tu gestión</div>' +
      '<button type="button" id="_rlPendMin" title="Minimizar (la alerta seguirá activa)" style="background:#334155;color:#f1f5f9;border:none;border-radius:8px;padding:3px 10px;font-weight:800;cursor:pointer;">—</button></div>' +
      '<div>Hola, <b>' + _esc(_pNombrePila()) + '</b> 👋 — tienes pendientes que requieren tu atención:</div>' +
      items +
      '<div style="margin-top:10px;font-size:12px;opacity:.85;border-top:1px solid #334155;padding-top:8px;">' +
      'Esta alerta es parte del <b>seguimiento de tu gestión</b> y se cerrará automáticamente cuando registres tus pendientes. ' +
      'Si no podrás cumplir en las fechas programadas, comunícate con el coordinador <b>Joel Timoteo</b> para reprogramar y ponerte al día en los tiempos prudentes dispuestos por tu jefatura.</div>';
    document.body.appendChild(card);
    card.querySelector('#_rlPendMin').addEventListener('click', function () {
      _pendMin = true;
      _pRenderPill(caps.length + evals.length + rrll.visitas.length + (rrll.casos ? 1 : 0));
    });
  }

  var _pTeniaPend = false;
  function _pActualizar() {
    Promise.all([_pCargarCapacitaciones().catch(function () { return []; }),
                 _pCargarEvaluaciones().catch(function () { return []; }),
                 _pCargarRRLL()])
      .then(function (res) {
        var caps = res[0] || [], evals = res[1] || [], rrll = res[2] || { visitas: [], casos: 0 };
        var total = caps.length + evals.length + rrll.visitas.length + (rrll.casos ? 1 : 0);
        if (!total) {
          _pQuitarUI();
          if (_pTeniaPend) {
            _pTeniaPend = false;
            try {
              var wrap = _wrapAvisos();
              var okCard = document.createElement('div');
              okCard.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #22c55e;' +
                'border-radius:12px;padding:12px 14px;box-shadow:0 12px 34px rgba(0,0,0,.35);' +
                'animation:_rlIn .35s ease;font-size:13px;line-height:1.5;';
              okCard.innerHTML = '<b style="color:#4ade80">✅ ¡Ya estás al día, ' + _esc(_pNombrePila()) + '!</b><br>' +
                'Gracias por cumplir con lo programado. Seguimos con el seguimiento de tu gestión.';
              wrap.appendChild(okCard);
              setTimeout(function () { if (okCard.parentNode) okCard.parentNode.removeChild(okCard); }, 10000);
            } catch (e) {}
          }
          return;
        }
        _pTeniaPend = true;
        if (_pendMin) _pRenderPill(total);
        else _pRenderCard(caps, evals, rrll);
      }).catch(function () {});
  }

  function iniciarAlertaPendientes() {
    try {
      _pActualizar();
      setInterval(_pActualizar, PEND_REFRESCO_MS);
    } catch (e) {}
  }
  if (!ES_ADMIN) iniciarAlertaPendientes();

  // ── 4d) RESUMEN DE SEGUIMIENTO DEL EQUIPO (solo administrador) ──────────
  // Tarjeta compacta con los vencidos de todo el equipo: capacitaciones,
  // evaluaciones, informes de visitas y casos sin cerrar. Minimizable (se
  // recuerda por sesión). Se actualiza cada 10 minutos.
  var _raMin = false, _raDatos = null;
  try { _raMin = sessionStorage.getItem('_rlResMin') === '1'; } catch (e) {}
  function _raSetMin(v) { _raMin = v; try { sessionStorage.setItem('_rlResMin', v ? '1' : '0'); } catch (e) {} }
  function _raNomCorto(n) { return String(n || '').trim().split(/\s+/).slice(0, 2).join(' '); }
  function _raQuitar() {
    ['_rlResCard', '_rlResPill'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function _raCargar() {
    var hoy = _pHoyISO();
    return Promise.all([
      _fsGet('programaciones_eti')['catch'](function () { return []; }),
      _fsGet('programaciones_eval')['catch'](function () { return []; }),
      fetch(PEND_GAS + '?' + new URLSearchParams({ action: 'getCumplimiento', usuario: USER.usuario || '' }))
        .then(function (r) { return r.json(); })['catch'](function () { return null; })
    ]).then(function (res) {
      var caps = [], evals = [], visitas = [], casos = [];
      (res[0] || []).forEach(function (p) {
        if (p.estado === 'ejecutada') return;
        var fechas = (p.fechas && p.fechas.length ? p.fechas.slice().sort() : [p.fechaProgramada, p.fechaFin || p.fechaProgramada].filter(Boolean).sort());
        if (!fechas.length) return;
        var fin = fechas[fechas.length - 1];
        if (hoy > fin) caps.push({ sup: p.supervisor || '?', dias: Math.round((new Date(hoy) - new Date(fin)) / 86400000) });
      });
      (res[1] || []).forEach(function (p) {
        if (p.estado === 'ejecutada') return;
        var ejec = p.fechasEjecutadas || [];
        var pend = (p.fechas || []).filter(function (f) { return ejec.indexOf(f) < 0; }).sort();
        var venc = pend.filter(function (f) { return f < hoy; });
        if (venc.length) evals.push({ sup: p.sup || '?', dias: Math.round((new Date(hoy) - new Date(venc[0])) / 86400000) });
      });
      var c = res[2];
      if (c && c.success) {
        (c.pendientesVisitas || []).forEach(function (p) { visitas.push({ nom: p.nombre || '?', est: p.estado || 'vencido' }); });
        var porNom = {};
        (c.casosPendientes || []).forEach(function (p) { var n = p.nombre_mostrar || '?'; porNom[n] = (porNom[n] || 0) + 1; });
        Object.keys(porNom).forEach(function (n) { casos.push({ nom: n, n: porNom[n] }); });
      }
      return { caps: caps, evals: evals, visitas: visitas, casos: casos };
    });
  }

  function _raPill(total) {
    _raQuitar();
    var pill = document.createElement('button');
    pill.id = '_rlResPill'; pill.type = 'button';
    pill.innerHTML = '👁️ Equipo: ' + total + ' pendiente(s)';
    pill.style.cssText = 'position:fixed;bottom:130px;left:20px;z-index:2147481900;background:#334155;color:#f1f5f9;' +
      'border:1px solid #475569;border-radius:999px;padding:8px 14px;font-weight:800;font-size:12px;cursor:pointer;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.4);font-family:inherit;';
    pill.title = 'Ver el resumen de seguimiento del equipo';
    pill.addEventListener('click', function () { _raSetMin(false); _raRender(_raDatos); });
    document.body.appendChild(pill);
  }

  function _raRender(d) {
    _raDatos = d;
    if (!d) return;
    var total = d.caps.length + d.evals.length + d.visitas.length + d.casos.length;
    if (!total) { _raQuitar(); return; }
    if (_raMin) { _raPill(total); return; }
    _raQuitar();
    var sec = function (t, arr, fmt) {
      if (!arr.length) return '';
      return '<div style="margin-top:7px;"><b>' + t + ' (' + arr.length + ')</b><br><span style="opacity:.85">' + arr.map(fmt).join(' · ') + '</span></div>';
    };
    var card = document.createElement('div');
    card.id = '_rlResCard';
    card.style.cssText = 'position:fixed;bottom:130px;left:20px;z-index:2147481900;width:330px;max-width:calc(100vw - 40px);' +
      'max-height:calc(100vh - 190px);overflow-y:auto;background:#0f172a;color:#f1f5f9;border-left:4px solid #38bdf8;' +
      'border-radius:14px;padding:13px 15px;box-shadow:0 14px 40px rgba(0,0,0,.5);font-size:12.5px;line-height:1.5;font-family:inherit;';
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
      '<div style="font-weight:800;color:#7dd3fc;">👁️ Seguimiento del equipo</div>' +
      '<button type="button" id="_rlResMinB" title="Minimizar" style="background:#334155;color:#f1f5f9;border:none;border-radius:8px;padding:2px 9px;font-weight:800;cursor:pointer;">—</button></div>' +
      sec('🎓 Capacitaciones vencidas', d.caps, function (x) { return _esc(_raNomCorto(x.sup)) + ' (' + x.dias + 'd)'; }) +
      sec('⭐ Evaluaciones vencidas', d.evals, function (x) { return _esc(_raNomCorto(x.sup)) + ' (' + x.dias + 'd)'; }) +
      sec('📋 Informes de visitas', d.visitas, function (x) { return _esc(_raNomCorto(x.nom)) + (x.est === 'plazo_hoy' ? ' (hoy)' : ' (vencido)'); }) +
      sec('📁 Casos sin cerrar', d.casos, function (x) { return _esc(_raNomCorto(x.nom)) + ' (' + x.n + ')'; }) +
      '<div style="margin-top:8px;font-size:11px;opacity:.7;">Se actualiza cada 10 min · Detalle completo en el Monitor.</div>';
    document.body.appendChild(card);
    card.querySelector('#_rlResMinB').addEventListener('click', function () {
      _raSetMin(true);
      _raPill(total);
    });
  }

  function iniciarResumenAdmin() {
    var tick = function () { _raCargar().then(_raRender)['catch'](function () {}); };
    tick();
    setInterval(tick, PEND_REFRESCO_MS);
  }
  if (ES_ADMIN) iniciarResumenAdmin();

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

  // ── CIERRE AUTOMÁTICO DE SESIÓN POR HORARIO ────────────────────────────
  // Replica la misma regla del login (verificarHorarioLogin del portal):
  // supervisores solo de 05:30 a 17:00, Lun-Vie (baja) / Lun-Sáb (alta desde
  // el 27-jun). Fuera de horario: aviso con cuenta regresiva de 5 minutos y
  // cierre forzado de sesión, registrando el evento en /historial (visible
  // para el administrador en el Monitor). Respeta sin_restriccion, los roles
  // exentos y los accesos temporales otorgados vía GAS.
  var AC_GAS = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
  var AC_ROLES_EXENTOS = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];
  var _acCard = null, _acCuentaT = null, _acExtUsada = false, _acCerrando = false, _acPosponerHasta = 0;

  function acFueraDeHorario() {
    try {
      var rol = String(USER.rol || '').toLowerCase().trim();
      if (USER.sin_restriccion) return false;
      if (AC_ROLES_EXENTOS.indexOf(rol) >= 0) return false;
      if (ES_ADMIN) return false;
      if (rol !== 'supervisor') return false;
      var a = new Date();
      var mes = a.getMonth() + 1, dia = a.getDate(), dow = a.getDay();
      var h = a.getHours() + a.getMinutes() / 60;
      var esAlta = mes > 6 || (mes === 6 && dia >= 27);
      if (!esAlta) {
        if (dow === 0 || dow === 6) return true;
      } else {
        if (dow === 0) return true;
      }
      return (h < 5.5 || h >= 17);
    } catch (e) { return false; }
  }

  function acCerrarSesion() {
    if (_acCerrando) return;
    _acCerrando = true;
    try {
      fetch(DB_URL + '/historial/' + UKEY + '.json', {
        method: 'POST', keepalive: true,
        body: JSON.stringify({ ts: { '.sv': 'timestamp' }, evento: 'cierre_automatico', pagina: PAGINA, modulo: MODULO })
      })['catch'](function () {});
    } catch (e) {}
    try {
      fetch(DB_URL + '/presencia/' + UKEY + '.json', {
        method: 'PATCH', keepalive: true, body: JSON.stringify({ online: false })
      })['catch'](function () {});
    } catch (e) {}
    setTimeout(function () {
      try { if (typeof window.logout === 'function') { window.logout(); return; } } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      try { location.href = '../../index.html'; } catch (e) {}
    }, 500);
  }

  function acQuitarCard() {
    clearInterval(_acCuentaT); _acCuentaT = null;
    if (_acCard && _acCard.parentNode) _acCard.parentNode.removeChild(_acCard);
    _acCard = null;
  }

  function acMostrarCuentaRegresiva() {
    if (_acCard || _acCerrando) return;
    var wrap = _wrapAvisos();
    var seg = 5 * 60;
    _acCard = document.createElement('div');
    _acCard.style.cssText = 'background:#0f172a;color:#f1f5f9;border-left:4px solid #ef4444;' +
      'border-radius:12px;padding:14px 16px;box-shadow:0 12px 34px rgba(0,0,0,.45);' +
      'animation:_rlIn .35s ease;font-size:13.5px;line-height:1.55;';
    var nom = ((USER.nombre || USER.usuario) || '').toString().trim().split(' ')[0] || 'colega';
    _acCard.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:800;color:#f87171;">' +
      '<span style="font-size:16px;">🔒</span><span>Fin de jornada — cierre automático</span></div>' +
      '<div style="margin-bottom:10px;">Estimado(a) <b>' + _esc(nom) + '</b>: tu horario permitido en el Sistema RR.LL ya finalizó ' +
      '(<b>05:30 a 17:00</b>). Por seguridad, el sistema cerrará tu sesión automáticamente en ' +
      '<b id="_acCuenta" style="color:#fbbf24;font-size:15px;">5:00</b> y el cierre quedará registrado para Coordinación.<br>' +
      '<span style="opacity:.85">Guarda lo que estés haciendo. Si necesitas trabajar fuera de horario, solicita un acceso temporal al coordinador Joel Timoteo.</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button type="button" data-acc="cerrar" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-weight:800;font-size:12.5px;cursor:pointer;">🚪 Guardar y cerrar ahora</button>' +
      (!_acExtUsada ? '<button type="button" data-acc="ext" style="background:#334155;color:#f1f5f9;border:none;border-radius:8px;padding:6px 14px;font-weight:800;font-size:12.5px;cursor:pointer;">🕒 Necesito 10 min más (única vez)</button>' : '') +
      '</div>';
    wrap.appendChild(_acCard);
    _acCard.querySelector('[data-acc="cerrar"]').addEventListener('click', acCerrarSesion);
    var extBtn = _acCard.querySelector('[data-acc="ext"]');
    if (extBtn) extBtn.addEventListener('click', function () {
      _acExtUsada = true;
      _acPosponerHasta = Date.now() + 10 * 60 * 1000;
      acQuitarCard();
    });
    _acCuentaT = setInterval(function () {
      seg--;
      var el = document.getElementById('_acCuenta');
      if (el) el.textContent = Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
      if (seg <= 0) { acQuitarCard(); acCerrarSesion(); }
    }, 1000);
  }

  function acVerificar() {
    if (_acCerrando || _acCard) return;
    if (Date.now() < _acPosponerHasta) return;
    if (!acFueraDeHorario()) return;
    // Respetar accesos temporales otorgados por el administrador (GAS)
    fetch(AC_GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'verificarAccesoTemporal', usuario: USER.usuario }) })
      .then(function (r) { return r.json(); })['catch'](function () { return null; })
      .then(function (d) {
        if (d && d.success && d.tieneAcceso) { _acPosponerHasta = Date.now() + 30 * 60 * 1000; return; }
        acMostrarCuentaRegresiva();
      });
  }
  setTimeout(acVerificar, 15000);
  setInterval(acVerificar, 60000);

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
      _notifNav('📌 Mensaje de ' + de, texto);
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

    // Admin: vigilar presencia por REST (avisos de ingreso ETI / RR.LL)
    if (ES_ADMIN) {
      var pollPres = function () {
        try {
          fetch(DB_URL + '/presencia.json?nc=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(procesarPresenciaAdmin).catch(function () {});
        } catch (e) {}
      };
      pollPres();
      restTimers.push(setInterval(pollPres, 20000));
    }

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

    // Admin: vigilar presencia en tiempo real (avisos de ingreso ETI / RR.LL)
    if (ES_ADMIN) {
      try {
        onValue(ref(db, 'presencia'), function (snap) {
          procesarPresenciaAdmin(snap.val());
        }, function (err) {
          console.warn('[Presencia] No se pudo vigilar presencia (admin).', err);
        });
      } catch (e) {}
    }
  })();
})();
