/* ═══════════════════════════════════════════════════════════════════════════
   _NOVEDADES_V1 (18-oct-2026) — aviso flotante "Qué cambió" (una sola vez por usuario)
   ---------------------------------------------------------------------------
   Al entrar al Dashboard después de la actualización del 18-oct, cada usuario ve
   UNA vez una tarjeta flotante que le dice dónde quedaron los módulos que se
   movieron, con un botón "Ver" que lo lleva al lugar exacto y hace parpadear el
   botón del menú. Se recuerda en localStorage (rl_novedades_<version>_<usuario>).
   Solo muestra las novedades de los módulos que el usuario tiene permitidos.
   Para una próxima actualización: cambiar VERSION y la lista NOVEDADES.
   Para desactivar: quitar la etiqueta <script src=".../novedades.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._NOVEDADES_V1) return;
  window._NOVEDADES_V1 = true;
  var VERSION = '18oct2026';
  function $(id) { return document.getElementById(id); }
  function nav(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function visible(b) { try { return !!b && b.style.display !== 'none'; } catch (e) { return false; } }
  function usuario() { try { var u = JSON.parse(sessionStorage.getItem('user') || '{}'); return String(u.usuario || '').toLowerCase().trim(); } catch (e) { return ''; } }
  function esAdmin() { try { var u = JSON.parse(sessionStorage.getItem('user') || '{}'); return /admin|coordinador|jefa/i.test(String(u.rol || '')); } catch (e) { return false; } }

  /* cada novedad: texto, condición para mostrarla y qué hacer al pulsar "Ver" */
  var NOVEDADES = [
    { ic: '👷', t: '<b>Buscar Trabajador</b> y <b>Consulta por DNI</b> ahora son un solo módulo: <b>Trabajadores</b>.',
      d: 'Busca una vez y verás dos pestañas: Datos del trabajador e Historial de atenciones.',
      ok: function () { return visible(nav('nav button.ni[onclick*="ir(\'trabajadores\'"]')) || visible(nav('nav button.ni[onclick*="ir(\'consulta\'"]')); },
      ver: function () { var b = nav('nav button.ni[onclick*="ir(\'trabajadores\'"]'); if (b) { b.click(); pulsar(b); } } },
    { ic: '📧', t: '<b>Enviar Reporte</b> ya no está en el menú: ahora es el botón naranja dentro de <b>Mis Atenciones</b>.',
      d: 'Mismo formulario de siempre (fechas, responsable, correo, vista previa).',
      ok: function () { return visible($('navCorreo')); },
      ver: function () { var a = $('navAt'); if (a) { a.click(); pulsar(a); } setTimeout(function () { var b = $('msEnviarRep'); if (b) { pulsar(b); try { b.scrollIntoView({ block: 'center' }); } catch (e) {} } }, 400); } },
    { ic: '📊', t: '<b>Resumen General</b> se retiró del menú: sus cifras están en <b>Estadísticas Admin</b> (tabla por supervisor, Excel y PDF).',
      d: 'Solo administradores.',
      ok: function () { return esAdmin() && visible($('navEstadisticas')); },
      ver: function () { var b = $('navEstadisticas'); if (b) pulsar(b); } }
  ];

  var CSS = '\
#rlNov{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147482000;width:min(560px,calc(100vw - 32px));background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(2,6,23,.35);border:1px solid #e2e8f0;overflow:hidden;font:13px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a;animation:rlNovIn .35s cubic-bezier(.2,.9,.3,1.1)}\
@keyframes rlNovIn{from{opacity:0;transform:translate(-50%,18px)}to{opacity:1;transform:translate(-50%,0)}}\
#rlNov.out{transition:opacity .25s,transform .25s;opacity:0;transform:translate(-50%,18px)}\
#rlNov .h{display:flex;align-items:center;gap:10px;padding:12px 16px;background:linear-gradient(135deg,#0a2463,#1e40af);color:#fff}\
#rlNov .h .ic{width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:16px}\
#rlNov .h b{font-size:14px;display:block}#rlNov .h small{opacity:.85;font-size:11.5px}\
#rlNov .h .x{margin-left:auto;border:none;background:rgba(255,255,255,.15);color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px}\
#rlNov .b{padding:6px 10px}\
#rlNov .it{display:flex;gap:10px;align-items:flex-start;padding:9px 8px;border-radius:10px}\
#rlNov .it+.it{border-top:1px solid #f1f5f9}\
#rlNov .it .i{flex:none;width:30px;height:30px;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:15px}\
#rlNov .it .tx{flex:1;line-height:1.35}#rlNov .it .tx small{display:block;color:#64748b;margin-top:2px;font-size:11.5px}\
#rlNov .it button{flex:none;border:none;background:#eff6ff;color:#1d4ed8;font:800 11.5px Barlow,"Segoe UI",system-ui,sans-serif;border-radius:8px;padding:7px 11px;cursor:pointer;margin-top:2px}\
#rlNov .it button:hover{background:#dbeafe}\
#rlNov .f{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #e2e8f0;background:#f8fafc}\
#rlNov .f small{color:#64748b;flex:1}\
#rlNov .f .ok{border:none;background:#0a2463;color:#fff;font:800 12.5px Barlow,"Segoe UI",system-ui,sans-serif;border-radius:9px;padding:9px 16px;cursor:pointer}\
.rl-pulso{animation:rlPulso 1.1s ease-in-out 3 !important;outline:2px solid #fbbf24 !important;outline-offset:2px;border-radius:8px}\
@keyframes rlPulso{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.9)}50%{box-shadow:0 0 0 10px rgba(251,191,36,0)}}\
@media(max-width:600px){#rlNov{bottom:10px}}';
  try { var st = document.createElement('style'); st.id = 'rlNovCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  function pulsar(el) { try { el.classList.remove('rl-pulso'); void el.offsetWidth; el.classList.add('rl-pulso'); setTimeout(function () { el.classList.remove('rl-pulso'); }, 3500); } catch (e) {} }
  function clave() { return 'rl_novedades_' + VERSION + '_' + (usuario() || 'anon'); }
  function yaVisto() { try { return !!localStorage.getItem(clave()); } catch (e) { return true; } }
  function marcar() { try { localStorage.setItem(clave(), String(Date.now())); } catch (e) {} }
  function cerrar() { var c = $('rlNov'); if (!c) return; marcar(); c.classList.add('out'); setTimeout(function () { try { c.remove(); } catch (e) {} }, 300); }

  function mostrar() {
    if ($('rlNov') || yaVisto() || !usuario()) return;
    var items = NOVEDADES.filter(function (n) { try { return n.ok(); } catch (e) { return false; } });
    if (!items.length) { marcar(); return; }
    var c = document.createElement('div'); c.id = 'rlNov'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Novedades del sistema');
    c.innerHTML = '<div class="h"><div class="ic">🆕</div><div><b>El sistema se actualizó: así quedó el menú</b><small>Menos clics y los módulos agrupados. Nada de tu información cambió.</small></div><button type="button" class="x" aria-label="Cerrar">✕</button></div>' +
      '<div class="b"></div>' +
      '<div class="f"><small>Este aviso se muestra una sola vez.</small><button type="button" class="ok">Entendido</button></div>';
    var b = c.querySelector('.b');
    items.forEach(function (n) {
      var it = document.createElement('div'); it.className = 'it';
      it.innerHTML = '<div class="i">' + n.ic + '</div><div class="tx">' + n.t + '<small>' + n.d + '</small></div><button type="button">Ver</button>';
      it.querySelector('button').onclick = function () { try { n.ver(); } catch (e) {} };
      b.appendChild(it);
    });
    c.querySelector('.x').onclick = cerrar;
    c.querySelector('.ok').onclick = cerrar;
    document.body.appendChild(c);
    /* si no lo cierra, se guarda como visto a los 2 min para no insistir en cada entrada */
    setTimeout(function () { if ($('rlNov')) marcar(); }, 120000);
  }

  /* se muestra 4 s después de cargar, cuando el menú ya aplicó permisos y no hay modales abiertos */
  function intentar(n) {
    n = n || 0;
    if (yaVisto()) return;
    var ocupado = false; try { ocupado = !!document.querySelector('.ov.on, .appmsys-overlay, #permOverlay[style*="flex"]'); } catch (e) {}
    if (ocupado && n < 30) { setTimeout(function () { intentar(n + 1); }, 2000); return; }
    mostrar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(intentar, 4000); }); else setTimeout(intentar, 4000);
  window.rlNovedades = { mostrar: function () { try { localStorage.removeItem(clave()); } catch (e) {} mostrar(); }, cerrar: cerrar };
})();
