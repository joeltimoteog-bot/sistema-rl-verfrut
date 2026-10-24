/* dashboard.html · bloque 38 (antes en la linea 15965) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _NOVEDADES_V1 (23-set-2026) — ventanita "Qué hay de nuevo"
   ---------------------------------------------------------------------------
   Se muestra UNA sola vez por usuario y por version de novedades.
   PARA PUBLICAR NOVEDADES NUEVAS: cambia NOVEDADES.id (ej. '2026-10-05') y
   la lista de items. Todos la veran una vez al entrar.
   Para desactivar: pon NOVEDADES.activo = false.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var NOVEDADES = {
  activo: true,
  id: '2026-09-23',
  titulo: '🎉 Mejoras en el Sistema RR.LL.',
  items: [
    '⚡ <b>Búsqueda de trabajadores más rápida</b>, por DNI y por nombre.',
    '🛡️ <b>Tus atenciones ya no se pierden:</b> si se corta internet, quedan guardadas en tu equipo y se envían solas.',
    '🚫 <b>Sin registros duplicados</b> por doble clic en Guardar.',
    '💬 <b>Mensajes más claros</b> cuando algo tarda o falla.',
    '🏠 <b>Botón Inicio</b> disponible para todos.',
    '🆘 <b>Nuevo: Reportar problema</b> — la pestaña roja a la derecha de la pantalla. Cuéntanos qué pasó y llega directo al administrador.',
    '🆕 Te avisaremos cuando haya una <b>versión nueva</b> del sistema.'
  ]
};
if (!NOVEDADES.activo) return;

function usuario() {
  try { if (typeof USER !== 'undefined' && USER && USER.usuario) return String(USER.usuario).toLowerCase(); } catch (e) {}
  try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); if (u && u.usuario) return String(u.usuario).toLowerCase(); } catch (e) {}
  return '';
}
function clave(u) { return 'rl_nov_' + NOVEDADES.id + '_' + u; }
function visto(u) { try { return localStorage.getItem(clave(u)) === '1'; } catch (e) { return true; } }
function marcar(u) { try { localStorage.setItem(clave(u), '1'); } catch (e) {} }

function mostrar(u) {
  if (document.getElementById('rlNovOv')) return;
  var ov = document.createElement('div');
  ov.id = 'rlNovOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:99995;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:#fff;color:#0f172a;max-width:460px;width:100%;border-radius:16px;padding:20px 20px 16px;font:14px system-ui,sans-serif;box-shadow:0 14px 44px rgba(0,0,0,.35);max-height:90vh;overflow:auto">' +
    '<div style="font-size:18px;font-weight:800;margin-bottom:10px">' + NOVEDADES.titulo + '</div>' +
    '<ul style="margin:0;padding-left:4px;list-style:none;line-height:1.5">' +
    NOVEDADES.items.map(function (t) { return '<li style="margin:0 0 8px">' + t + '</li>'; }).join('') +
    '</ul><div style="text-align:right;margin-top:10px">' +
    '<button type="button" id="rlNovOk" style="background:#1e3a5f;color:#fff;border:0;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer">Entendido 👍</button></div></div>';
  document.body.appendChild(ov);
  var cerrar = function () { marcar(u); try { ov.remove(); } catch (e) {} };
  document.getElementById('rlNovOk').onclick = cerrar;
  ov.addEventListener('click', function (ev) { if (ev.target === ov) cerrar(); });
}

(function esperar(n) {
  var u = usuario();
  var velo = document.getElementById('permVelo');     /* no mostrar mientras se cargan los permisos */
  if (u && !velo) {
    if (!visto(u)) setTimeout(function () { mostrar(u); }, 2500);
    return;
  }
  if (n < 80) setTimeout(function () { esperar(n + 1); }, 250);
})(0);
})();
