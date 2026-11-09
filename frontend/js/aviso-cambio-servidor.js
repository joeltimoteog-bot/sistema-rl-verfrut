/* ═══════════════════════════════════════════════════════════════════════════
   _AVISO_SUPABASE_V1 (08-nov-2026) — Aviso de bienvenida, UNA sola vez por usuario
   ---------------------------------------------------------------------------
   Al entrar al panel del Sistema RR.LL. saluda al usuario por su nombre y le informa
   que, tras el percance con el servidor anterior (Azure), el sistema pasó a Supabase.
   Se muestra una vez por usuario en este navegador (marca en localStorage) y desaparece.
   Para volver a mostrarlo a todos: subir el número de AVISO_VERSION.
   Carga: frontend/pages/dashboard.html, después de 04-nucleo-dashboard.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var AVISO_VERSION = 1;
  var u; try { u = JSON.parse(sessionStorage.getItem('user') || '{}'); } catch (e) { u = {}; }
  var usuario = String(u.usuario || u.email || u.nombre || '').toLowerCase().trim();
  if (!usuario) return;
  var LLAVE = 'rl_aviso_supabase_v' + AVISO_VERSION + '_' + usuario;
  try { if (localStorage.getItem(LLAVE)) return; } catch (e) { return; }

  function primerNombre() {
    var n = String(u.nombre || '').trim();
    if (!n) return '';
    var p = n.split(/\s+/);
    /* los nombres suelen venir "APELLIDO APELLIDO NOMBRE" o "Nombre Apellido": si todo está en mayúsculas y hay 3+ palabras, el nombre es la 3.ª */
    var pal = (p.length >= 3 && n === n.toUpperCase()) ? p[2] : p[0];
    pal = pal.toLowerCase(); return pal.charAt(0).toUpperCase() + pal.slice(1);
  }
  function saludoHora() { var h = new Date().getHours(); return h < 12 ? 'buenos días' : h < 19 ? 'buenas tardes' : 'buenas noches'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function mostrar() {
    if (document.getElementById('rlAvisoSupabase')) return;
    var nombre = primerNombre();
    var css = document.createElement('style');
    css.textContent = '#rlAvisoSupabase{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
      '#rlAvisoSupabase .rlav-card{background:#fff;color:#0f172a;max-width:520px;width:100%;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden;animation:rlavIn .25s ease-out}' +
      '@keyframes rlavIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}' +
      '#rlAvisoSupabase .rlav-top{background:linear-gradient(135deg,#166534,#16a34a);color:#fff;padding:20px 24px}' +
      '#rlAvisoSupabase .rlav-top h2{margin:0;font-size:20px;font-weight:800;letter-spacing:.2px}' +
      '#rlAvisoSupabase .rlav-top p{margin:6px 0 0;font-size:13px;opacity:.92}' +
      '#rlAvisoSupabase .rlav-body{padding:20px 24px;font-size:14.5px;line-height:1.55}' +
      '#rlAvisoSupabase .rlav-body p{margin:0 0 12px}' +
      '#rlAvisoSupabase .rlav-nota{background:#f0fdf4;border-left:4px solid #16a34a;border-radius:8px;padding:10px 12px;font-size:13.5px}' +
      '#rlAvisoSupabase .rlav-foot{padding:0 24px 20px;display:flex;justify-content:flex-end}' +
      '#rlAvisoSupabase button{background:#16a34a;color:#fff;border:0;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer}' +
      '#rlAvisoSupabase button:hover{background:#15803d}';
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'rlAvisoSupabase'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="rlav-card">' +
        '<div class="rlav-top"><h2>👋 Hola' + (nombre ? ' ' + esc(nombre) : '') + ', ¡' + saludoHora() + '!</h2>' +
        '<p>Bienvenido al Sistema de Relaciones Laborales, que integra Bienestar Social, Capacitaciones ETI y Evaluaciones ETI.</p></div>' +
        '<div class="rlav-body">' +
          '<p>Queremos contarte un cambio importante: hace unos días tuvimos un percance con el servidor anterior (Azure). Por seguridad, y para que el sistema sea más estable y rápido para todos, <strong>el sistema se trasladó al servidor Supabase</strong>.</p>' +
          '<div class="rlav-nota">Tu usuario y tu clave son los mismos: con la misma cuenta del Sistema RR.LL. entras a Bienestar Social, Capacitaciones ETI y Evaluaciones ETI. No necesitas hacer nada más.</div>' +
          '<p style="margin-top:12px;font-size:13px;color:#475569">Si notas algo distinto o algo no carga, avísale al Coordinador de Relaciones Laborales. ¡Gracias por tu trabajo!</p>' +
        '</div>' +
        '<div class="rlav-foot"><button type="button" id="rlAvisoSupabaseOk">Entendido, continuar</button></div>' +
      '</div>';
    document.body.appendChild(d);
    document.getElementById('rlAvisoSupabaseOk').onclick = function () { try { localStorage.setItem(LLAVE, new Date().toISOString()); } catch (e) {} d.remove(); };
    try { document.getElementById('rlAvisoSupabaseOk').focus(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mostrar, 600); });
  else setTimeout(mostrar, 600);
})();
