/* ═══════════════════════════════════════════════════════════════════════════
   plataforma-gh.js — _PLATAFORMA_GH_V1 (05-nov-2026) · imagen institucional comun
   Plataforma de Gestion Humana de Unifrutti Peru: Evaluacion ETI y Capacitaciones ETI
   (y luego el Sistema RR.LL.) con la MISMA barra superior, colores y menu.
   SOLO PRESENTACION: no cambia ids, flujos, consultas, guardados ni permisos.
     - Barra institucional fija arriba (logo, nombre, cambio de sistema, estado del servidor).
     - Menu lateral claro con el sistema de colores Unifrutti (azul #18428A, rojo #E4032D).
     - Solo se activa con la sesion iniciada (la pantalla de ingreso no cambia).
   Apagar en un navegador:  localStorage.gh_tema = 'off'  (y recargar)
   Apagar para todos: quitar la etiqueta <script src=".../plataforma-gh.js"> de la pagina.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._PLATAFORMA_GH_V1) return;
  window._PLATAFORMA_GH_V1 = true;
  try { if (localStorage.getItem('gh_tema') === 'off') return; } catch (e) {}

  var BASE = 'https://sistemarrll.com/sistema-rl-verfrut/frontend/';
  var LOGO = BASE + 'img/unifrutti-logo.png';
  var SALUD = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/salud?forceFunctionRegion=sa-east-1';
  var ruta = String(location.pathname || '').toLowerCase();
  var SIS = /eti-evaluacion|evaluacion/.test(ruta) ? 'eval' : (/sistema-eti/.test(ruta) ? 'cap' : 'otro');
  /* en la carpeta local de pruebas el sistema se reconoce por su estructura */
  function sistema() {
    if (SIS !== 'otro') return SIS;
    if (document.getElementById('appPage')) return 'cap';
    if (document.getElementById('eti-side') || document.getElementById('slogin')) return 'eval';
    return 'otro';
  }

  var AZ = '#18428A', NAVY = '#0E2A5C', ROJO = '#E4032D';
  var CSS = [
    /* ── barra institucional ── */
    '#gh-barra{display:none;position:fixed;top:0;left:0;right:0;height:52px;z-index:1400;background:' + NAVY + ';color:#fff;',
    '  align-items:center;gap:22px;padding:0 18px;font-family:Inter,Barlow,"Segoe UI",sans-serif;box-shadow:0 2px 10px rgba(5,20,50,.25)}',
    'html.gh-on #gh-barra{display:flex}',
    '#gh-barra .gh-marca{display:flex;align-items:center;gap:10px;flex:0 0 auto;text-decoration:none;color:#fff}',
    '#gh-barra .gh-logo{width:34px;height:38px;border-radius:7px;background:#fff url(' + LOGO + ') center/22px auto no-repeat;flex:0 0 auto}',
    '#gh-barra .gh-nom{display:flex;flex-direction:column;line-height:1.15}',
    '#gh-barra .gh-nom b{font:700 14px Barlow,Inter,sans-serif;letter-spacing:.06em}',
    '#gh-barra .gh-nom small{font-size:11px;color:#B9C6DE}',
    '#gh-barra nav{display:flex;align-items:stretch;gap:2px;height:52px;flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}',
    '#gh-barra nav::-webkit-scrollbar{display:none}',
    '#gh-barra nav a{display:flex;align-items:center;padding:0 14px;color:#C9D4E8;text-decoration:none;font-size:13.5px;font-weight:500;white-space:nowrap;border-bottom:3px solid transparent;border-top:3px solid transparent;cursor:pointer}',
    '#gh-barra nav a:hover{color:#fff;background:rgba(255,255,255,.06)}',
    '#gh-barra nav a.on{color:#fff;font-weight:600;border-bottom-color:' + ROJO + '}',
    '#gh-barra .gh-estado{display:flex;align-items:center;gap:7px;font-size:12px;color:#D5E0F2;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);padding:5px 11px;border-radius:999px;white-space:nowrap;flex:0 0 auto}',
    '#gh-barra .gh-estado i{width:8px;height:8px;border-radius:50%;background:#34D399}',
    '#gh-barra .gh-estado.mal i{background:#FBBF24}',
    '#gh-barra .gh-c{display:none}',
    '@media(max-width:900px){#gh-barra .gh-l{display:none}#gh-barra .gh-c{display:inline}}',
    '@media(max-width:900px){#gh-barra{gap:10px;padding:0 10px}#gh-barra .gh-nom,#gh-barra .gh-estado span{display:none}#gh-barra .gh-estado{padding:6px}#gh-barra nav a{padding:0 10px;font-size:12.5px}}',

    /* ── Evaluacion ETI: correr el armazon 52 px hacia abajo ── */
    'html.gh-on.gh-eval #eti-side{top:52px}',
    'html.gh-on.gh-eval #eti-top{top:52px}',
    'html.gh-on.gh-eval body.shell-on .screen{padding-top:116px}',
    'html.gh-on.gh-eval body.shell-on .stbar{top:116px}',
    /* menu lateral claro */
    'html.gh-on.gh-eval #eti-side{background:#fff!important;color:#0F172A!important;border-right:1px solid #E2E8F0;box-shadow:none}',
    'html.gh-on.gh-eval .es-brand,html.gh-on.gh-eval .es-user{border-bottom-color:#EEF2F6!important}',
    'html.gh-on.gh-eval .es-brand .logo-uni{background-color:#F4F6FA}',
    'html.gh-on.gh-eval .es-brand b{color:' + NAVY + '}',
    'html.gh-on.gh-eval .es-brand small,html.gh-on.gh-eval .es-user small{color:#5B6B82;opacity:1}',
    'html.gh-on.gh-eval .es-user b{color:#0F172A}',
    'html.gh-on.gh-eval .es-av{background:' + AZ + ';box-shadow:none;color:#fff}',
    'html.gh-on.gh-eval .es-sec{color:#5B6B82}',
    'html.gh-on.gh-eval #es-nav .es-it,html.gh-on.gh-eval #es-nav .btn{color:#334155!important;background:transparent!important;box-shadow:none!important}',
    'html.gh-on.gh-eval #es-nav .es-it:hover,html.gh-on.gh-eval #es-nav .btn:hover{background:#EEF2F8!important;color:' + NAVY + '!important}',
    'html.gh-on.gh-eval #es-nav .es-it.on,html.gh-on.gh-eval #es-nav .btn.bpri{background:#E8EFFB!important;color:' + AZ + '!important;font-weight:600!important;box-shadow:inset 3px 0 0 ' + AZ + '!important}',
    'html.gh-on.gh-eval #es-nav{scrollbar-color:#CBD5E1 transparent}',
    'html.gh-on.gh-eval .es-foot{border-top-color:#EEF2F6}',
    'html.gh-on.gh-eval .es-foot button{color:#334155}',
    'html.gh-on.gh-eval .es-foot button:hover{background:#EEF2F8;color:' + NAVY + '}',
    'html.gh-on.gh-eval .es-foot button.es-home{background:#E8EFFB;color:' + AZ + '}',
    'html.gh-on.gh-eval #eti-top .logo-uni{display:none}',
    'html.gh-on.gh-eval #es-tit{color:' + NAVY + '}',
    'html.gh-on.gh-eval .es-badge{background:' + AZ + '}',

    /* ── Capacitaciones ETI: correr el armazon 52 px hacia abajo ── */
    'html.gh-on.gh-cap .main-area{padding-top:52px}',
    'html.gh-on.gh-cap .topbar{top:52px}',
    '@media(min-width:901px){html.gh-on.gh-cap .sidebar{top:52px}}',
    /* menu lateral claro (tambien la barra inferior del celular) */
    'html.gh-on.gh-cap aside.sidebar,html.gh-on.gh-cap .sidebar{background:#fff!important;color:#0F172A;border-right:1px solid #E2E8F0;box-shadow:none!important}',
    'html.gh-on.gh-cap .sidebar-brand,html.gh-on.gh-cap .sidebar-foot{border-color:#EEF2F6}',
    'html.gh-on.gh-cap .sidebar-brand img{background:#F4F6FA}',
    'html.gh-on.gh-cap .sb-title{color:' + NAVY + '}',
    'html.gh-on.gh-cap .sb-sub,html.gh-on.gh-cap .sf-rol{color:#5B6B82}',
    'html.gh-on.gh-cap .nav-label{color:#5B6B82}',
    'html.gh-on.gh-cap .tab-btn{color:#334155!important}',
    'html.gh-on.gh-cap .tab-btn:hover{background:#EEF2F8!important;color:' + NAVY + '!important}',
    'html.gh-on.gh-cap .tab-btn.active{background:#E8EFFB!important;color:' + AZ + '!important}',
    'html.gh-on.gh-cap .tab-btn.active::before{background:' + AZ + '!important;box-shadow:none!important}',
    'html.gh-on.gh-cap .sf-nombre{color:#0F172A}',
    'html.gh-on.gh-cap .sf-avatar{background:' + AZ + ';color:#fff}',
    'html.gh-on.gh-cap .sidebar .btn-rrll{background:#E8EFFB;color:' + AZ + ';border-color:#C7D6F0}',
    'html.gh-on.gh-cap .sidebar .btn-rrll:hover{background:' + AZ + ';color:#fff}',
    'html.gh-on.gh-cap .btn-logout{background:#FFF1F3;color:#B4122C;border-color:#F5C2C9}',
    'html.gh-on.gh-cap .btn-logout:hover{background:' + ROJO + ';color:#fff}',
    '@media(max-width:900px){html.gh-on.gh-cap .sidebar{border-right:0;border-top:1px solid #E2E8F0}}'
  , '#gh-barra .gh-sede{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:#E0EAFB;color:#18428A;border:1px solid #BFD3F5;white-space:nowrap}'
  , '#gh-barra .gh-sede.ol{background:#FFEDD5;color:#9A3412;border-color:#FDBA74}'
  ].join('\n');

  function css() {
    if (document.getElementById('gh-css')) return;
    var st = document.createElement('style'); st.id = 'gh-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function irRRLL(ev) {
    ev.preventDefault();
    try { if (typeof window.volverRRLL === 'function') { window.volverRRLL(); return; } } catch (e) {}
    var l = document.getElementById('linkRRLL') || document.getElementById('linkRRLLTop');
    if (l && l.getAttribute('href') && l.getAttribute('href') !== '#') { location.href = l.href; return; }
    if (l) { l.click(); return; }
    location.href = 'https://sistemarrll.com/sistema-rl-verfrut/index.html';
  }

  function barra() {
    if (document.getElementById('gh-barra') || !document.body) return;
    var s = sistema();
    var b = document.createElement('div'); b.id = 'gh-barra'; b.setAttribute('role', 'banner');
    b.innerHTML =
      '<span class="gh-marca"><span class="gh-logo" role="img" aria-label="Unifrutti"></span>' +
      '<span class="gh-nom"><b>UNIFRUTTI PERÚ</b><small>Plataforma de Gestión Humana</small></span></span>' +
      '<nav aria-label="Sistemas de la plataforma">' +
      '<a href="#" data-gh="rrll"><span class="gh-l">Relaciones Laborales</span><span class="gh-c">RR.LL.</span></a>' +
      '<a href="https://sistemarrll.com/eti-evaluacion-verfrut/"' + (s === 'eval' ? ' class="on" aria-current="page"' : '') + '><span class="gh-l">Evaluación ETI</span><span class="gh-c">Evaluación</span></a>' +
      '<a href="https://sistemarrll.com/sistema-eti/"' + (s === 'cap' ? ' class="on" aria-current="page"' : '') + '><span class="gh-l">Capacitaciones ETI</span><span class="gh-c">Capacitación</span></a>' +
      '</nav>' +
      '<span class="gh-sede" id="gh-sede" style="display:none" title="Sede con la que trabaja en este sistema"></span>' +   /* _GH_SEDE_V1 */
      '<span class="gh-estado" id="gh-estado" title="Estado del servidor"><i></i><span>Servidor en línea</span></span>';
    document.body.appendChild(b);
    b.querySelector('[data-gh="rrll"]').addEventListener('click', irRRLL);
    /* el sistema activo no navega (evita volver a la pantalla de ingreso) */
    Array.prototype.forEach.call(b.querySelectorAll('nav a.on'), function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  }

  /* _GH_SEDE_V1 (26-nov-2026, pedido de Joel): en Evaluacion ETI y Capacitaciones ETI la barra dice a que sede ingreso el usuario
     (Sede Olmos / Sede Piura / Piura y Olmos), igual que la tarjeta de bienvenida del Sistema RR.LL. La sede la dice el servidor
     (auth/sso, accion sesion) con el token de la sesion; si no responde, la barra sigue sin la etiqueta. Solo informa: no filtra nada. */
  var sedeVista = '', sedeReintento = 0;
  function sede() {
    var el = document.getElementById('gh-sede'); if (!el) return;
    var tk = ''; try { tk = sessionStorage.getItem(sistema() === 'cap' ? 'eti_rl_token' : 'eti_token') || ''; } catch (e) {}
    if (!tk || tk === sedeVista || Date.now() < sedeReintento) return; sedeVista = tk;
    try {
      fetch('https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/auth/sso?forceFunctionRegion=sa-east-1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'sesion', token: tk }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var s = j && j.success && j.user ? String(j.user.sede || '') : '';
          var t = s === 'OLMOS' ? 'Sede Olmos' : s === 'PIURA' ? 'Sede Piura' : s === 'TODO' ? 'Piura y Olmos' : '';
          if (!t) { sedeVista = ''; sedeReintento = Date.now() + 30000; return; }
          if (s === 'TODO' && !elegirOff()) { esGeneral = true; pintarChip(); if (!vistaValida()) preguntar(); return; }   /* _GH_SEDE_ELEGIR_V1 */
          el.textContent = t; el.className = 'gh-sede' + (s === 'OLMOS' ? ' ol' : ''); el.style.display = '';
        }).catch(function () { sedeVista = ''; sedeReintento = Date.now() + 30000; });
    } catch (e) { sedeVista = ''; sedeReintento = Date.now() + 30000; }
  }

  /* ══ _GH_SEDE_ELEGIR_V1 (27-nov-2026, decision de Joel): en Capacitaciones ETI y Evaluacion ETI, quien tiene alcance GENERAL
     elige la sede EN CADA INGRESO (Sede Piura / Sede Olmos / Ambas sedes), con el mismo cuadro del Sistema RR.LL. La eleccion se
     manda al servidor en la cabecera x-rl-sede (el mismo mecanismo del RR.LL.): el servidor entrega solo esa sede. Quien es de una
     sola sede no ve el cuadro y el servidor lo deja en la suya. Los modulos siguen saliendo segun Acceso a Modulos.
     Cambiar: tocar la sede en la barra superior. Apagar en este navegador: localStorage.eti_sede_pregunta = 'off'. ══ */
  var esGeneral = false;
  function elegirOff() { try { return localStorage.getItem('eti_sede_pregunta') === 'off'; } catch (e) { return false; } }
  function tokenSis() { try { return sessionStorage.getItem(sistema() === 'cap' ? 'eti_rl_token' : 'eti_token') || ''; } catch (e) { return ''; } }
  function marca() { var t = tokenSis(); return t ? t.slice(-24) : ''; }
  function leerVista() { try { var x = JSON.parse(sessionStorage.getItem('eti_sede_vista') || 'null'); return (x && x.m && x.m === marca()) ? x : null; } catch (e) { return null; } }
  function vistaValida() { return !!leerVista(); }
  function vistaSede() { var x = leerVista(); return x && (x.v === 'PIURA' || x.v === 'OLMOS') ? x.v : ''; }
  function pintarChip() {
    var el = document.getElementById('gh-sede'); if (!el) return;
    var v = vistaSede(), t = v === 'OLMOS' ? 'Sede Olmos' : v === 'PIURA' ? 'Sede Piura' : 'Piura y Olmos';
    el.textContent = t + ' ▾'; el.className = 'gh-sede' + (v === 'OLMOS' ? ' ol' : ''); el.style.display = ''; el.style.cursor = 'pointer';
    el.title = 'Cambiar de sede'; el.setAttribute('role', 'button'); el.tabIndex = 0;
    if (!el._ghElegir) { el._ghElegir = true; el.addEventListener('click', function () { if (esGeneral) preguntar(true); }); el.addEventListener('keydown', function (e) { if (esGeneral && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); preguntar(true); } }); }
  }
  function aplicarVista(antes) {
    pintarChip();
    if (vistaSede() === antes) return;
    if (sistema() === 'eval') { location.reload(); return; }   /* Evaluacion ETI conserva la sesion al recargar */
    /* Capacitaciones ETI no conserva la sesion al recargar: se vuelven a pedir los datos (las escuchas consultan al "volver a la pestaña") */
    try { document.dispatchEvent(new Event('visibilitychange')); } catch (e) {}
    try { window.dispatchEvent(new Event('eti-sede')); } catch (e) {}
  }
  function preguntar(cambiar) {
    try {
      if (document.getElementById('ghSedeOv') || !marca()) return;
      var actual = vistaSede(), elegida = vistaValida() ? actual : '';
      var NOMS = sistema() === 'cap' ? 'Capacitaciones ETI' : 'Evaluación ETI';
      var OPC = [['PIURA', 'Sede Piura', 'RAPEL · VERFRUT'], ['OLMOS', 'Sede Olmos', 'Bomarea · Pirona · Mosqueta · Hefei · Lefkada'], ['', 'Ambas sedes', 'Vista general: Piura y Olmos']];
      var ov = document.createElement('div'); ov.id = 'ghSedeOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ghSedeT');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,27,51,.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(580px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#fff;border:1px solid #D9DFEA;border-top:5px solid #C8102E;border-radius:10px;padding:32px 40px 26px;box-shadow:0 18px 48px rgba(15,27,51,.28);color:#0F1B33;text-align:left';
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:14px"><img src="https://sistemarrll.com/sistema-rl-verfrut/frontend/images/logo-unifrutti.jpg" alt="Unifrutti" style="width:48px;height:48px;object-fit:contain;border:1px solid #E6EAF2;border-radius:8px" onerror="this.style.display=\'none\'">' +
        '<div><div style="font-size:11px;letter-spacing:2.2px;font-weight:700;color:#C8102E;text-transform:uppercase">' + NOMS + '</div><div style="font-size:12px;color:#5B6B86;margin-top:2px">Unifrutti Perú · Piura · Olmos</div></div></div>' +
        '<h2 id="ghSedeT" style="margin:22px 0 6px;font-size:24px;font-weight:700;letter-spacing:.2px;color:#0F1B33">Seleccione la sede de trabajo</h2>' +
        '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#3D4A63">Su usuario tiene alcance general. Indique con qué sede desea trabajar en esta sesión.</p>' +
        '<div id="ghSedeOps" style="display:flex;flex-direction:column;gap:10px"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #E6EAF2">' +
        '<div style="font-size:12px;line-height:1.45;color:#5B6B86;max-width:300px">Podrá cambiar de sede en cualquier momento tocando la sede en la barra superior.</div>' +
        '<button type="button" id="ghSedeOk" style="min-height:46px;padding:0 30px;border:0;border-radius:8px;background:#0F1B33;color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">Continuar</button></div>';
      ov.appendChild(card);
      var ops = card.querySelector('#ghSedeOps');
      function pintar() {
        Array.prototype.forEach.call(ops.children, function (b) {
          var on = b.getAttribute('data-v') === elegida;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.background = on ? '#F3F6FC' : '#fff'; b.style.border = on ? '2px solid #0F1B33' : '1px solid #C9D1E0';
          b.firstChild.style.border = on ? '6px solid #C8102E' : '2px solid #8A97AE';
        });
      }
      OPC.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-v', o[0]);
        b.style.cssText = 'display:flex;align-items:center;gap:14px;width:100%;min-height:62px;text-align:left;padding:11px 16px;border-radius:8px;color:#0F1B33;cursor:pointer;font-family:inherit';
        var aro = document.createElement('span'); aro.style.cssText = 'width:18px;height:18px;border-radius:50%;box-sizing:border-box;background:#fff;flex:0 0 auto';
        var tx = document.createElement('span'); tx.style.cssText = 'display:flex;flex-direction:column;gap:2px';
        var t1 = document.createElement('span'); t1.style.cssText = 'font-size:16px;font-weight:700'; t1.textContent = o[1];
        var t2 = document.createElement('span'); t2.style.cssText = 'font-size:12.5px;color:#4A5872'; t2.textContent = o[2];
        tx.appendChild(t1); tx.appendChild(t2); b.appendChild(aro); b.appendChild(tx);
        b.addEventListener('click', function () { elegida = o[0]; pintar(); });
        ops.appendChild(b);
      });
      pintar();
      card.querySelector('#ghSedeOk').addEventListener('click', function () {
        try { sessionStorage.setItem('eti_sede_vista', JSON.stringify({ m: marca(), v: elegida })); } catch (e2) {}
        ov.remove(); aplicarVista(actual);
        try { console.log('[_GH_SEDE_ELEGIR_V1] sede elegida: ' + (elegida || 'AMBAS')); } catch (e4) {}
      });
      document.body.appendChild(ov);
      try { card.querySelector('#ghSedeOk').focus(); } catch (e3) {}
    } catch (e) { console.warn('[_GH_SEDE_ELEGIR_V1]', e.message); }
  }
  /* cada llamada al servidor de la plataforma lleva la sede elegida (si es Piura u Olmos); "Ambas" no manda nada */
  (function () {
    if (typeof window.fetch !== 'function' || window._ghSedeFetch) return; window._ghSedeFetch = true;
    var fo = window.fetch;
    window.fetch = function (input, init) {
      try {
        var v = elegirOff() ? '' : vistaSede();
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (v && /supabase\.co\/functions\/v1\/api\/|azurewebsites\.net\/api\//.test(url)) {
          if (typeof input !== 'string' && input && input.headers && !(init && init.headers)) { var rq = new Request(input); rq.headers.set('x-rl-sede', v); return fo.call(this, rq, init); }
          init = Object.assign({}, init || {});
          var h = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || {});
          h.set('x-rl-sede', v); init.headers = h;
        }
      } catch (e) {}
      return fo.call(this, input, init);
    };
  })();

  var tSalud = null;
  function salud() {
    var el = document.getElementById('gh-estado'); if (!el || document.hidden) return;
    var ok = function (v) { el.classList.toggle('mal', !v); var t = el.querySelector('span'); if (t) t.textContent = v ? 'Servidor en línea' : 'Sin conexión al servidor'; };
    try {
      var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
      fetch(SALUD, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(to); ok(r.ok); }, function () { clearTimeout(to); ok(false); });
    } catch (e) {}
  }

  /* activo solo con la sesion iniciada */
  function conSesion() {
    var s = sistema();
    if (s === 'eval') return !!(document.body && document.body.classList.contains('shell-on'));
    if (s === 'cap') { var a = document.getElementById('appPage'); return !!(a && a.style.display !== 'none'); }
    return false;
  }
  function revisar() {
    try {
      var on = conSesion(), h = document.documentElement, s = sistema();
      if (on) { css(); barra(); h.classList.add('gh-' + s); sede(); }
      if (h.classList.contains('gh-on') !== on) {
        h.classList.toggle('gh-on', on);
        if (on && !tSalud) { salud(); tSalud = setInterval(salud, 60000); }
      }
    } catch (e) {}
  }
  function iniciar() {
    revisar();
    setInterval(revisar, 700);
    try { new MutationObserver(revisar).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    try { console.log('[_PLATAFORMA_GH_V1] listo (' + sistema() + ')'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
