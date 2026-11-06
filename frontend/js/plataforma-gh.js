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
      '<span class="gh-estado" id="gh-estado" title="Estado del servidor"><i></i><span>Servidor en línea</span></span>';
    document.body.appendChild(b);
    b.querySelector('[data-gh="rrll"]').addEventListener('click', irRRLL);
    /* el sistema activo no navega (evita volver a la pantalla de ingreso) */
    Array.prototype.forEach.call(b.querySelectorAll('nav a.on'), function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  }

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
      if (on) { css(); barra(); h.classList.add('gh-' + s); }
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
