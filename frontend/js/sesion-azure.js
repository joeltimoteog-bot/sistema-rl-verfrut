/* ═══════════════════════════════════════════════════════════════════════════
   sesion-azure.js — _SESION_SIN_LLAVE_V1 (06-oct-2026)
   Si la persona entro por el RESPALDO de Google (p. ej. Azure estaba caido al
   iniciar sesion) o su llave de Azure (rl_token, 14 h) ya vencio, la pantalla
   manda TODO (guardar atenciones, capacitaciones, casos...) a Google, que es
   lento, aunque Azure ya este bien. Aqui solo se AVISA y se ofrece volver a
   entrar. No cambia como se guarda nada. Se revisa al abrir y cada 5 min.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlSesionLlaveOk) return;
  window._rlSesionLlaveOk = true;

  function hayUsuario() { try { return !!sessionStorage.getItem('user'); } catch (e) { return false; } }
  function estadoLlave() {
    var tk = null;
    try { tk = sessionStorage.getItem('rl_token'); } catch (e) { return 'ok'; }
    if (!tk) return 'sin';
    try {
      var p = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (p && p.exp && p.exp * 1000 < Date.now() + 60000) return 'vencida';
    } catch (e) {}
    return 'ok';
  }
  function volverAEntrar() {
    try { sessionStorage.clear(); localStorage.removeItem('rl_session'); } catch (e) {}
    var base = location.pathname.indexOf('/frontend/') >= 0 ? location.pathname.split('/frontend/')[0] : '';
    location.href = base + '/index.html';
  }
  function pintar(motivo) {
    if (document.getElementById('rlAvisoLlave')) return;
    var d = document.createElement('div');
    d.id = 'rlAvisoLlave';
    d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;max-width:min(560px,calc(100vw - 32px));' +
      'background:#fffbeb;border:1.5px solid #f59e0b;color:#78350f;border-radius:10px;padding:10px 14px;font:13px/1.45 system-ui,sans-serif;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.18);display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    d.innerHTML = '<span style="flex:1;min-width:200px">⚠️ <b>El sistema está en modo lento</b>: ' +
      (motivo === 'vencida' ? 'tu sesión rápida venció.' : 'entraste por el respaldo.') +
      ' Para que guardar sea rápido, <b>termina lo que estás haciendo</b> y vuelve a entrar.</span>' +
      '<button type="button" id="rlAvisoLlaveBtn" style="background:#d97706;color:#fff;border:0;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer">Volver a entrar</button>' +
      '<button type="button" id="rlAvisoLlaveX" title="Más tarde" style="background:transparent;border:0;color:#92400e;font-size:16px;cursor:pointer">✕</button>';
    document.body.appendChild(d);
    document.getElementById('rlAvisoLlaveBtn').onclick = function () {
      if (confirm('¿Ya guardaste lo que estabas haciendo?\n\nSe cerrará la sesión para que vuelvas a entrar.')) volverAEntrar();
    };
    document.getElementById('rlAvisoLlaveX').onclick = function () {
      d.remove();
      window._rlAvisoLlaveHasta = Date.now() + 15 * 60 * 1000;   // se vuelve a avisar en 15 min
    };
    try { if (window.rlSalud && rlSalud.registrar) rlSalud.registrar('sesion_sin_llave', motivo, null, 'modo lento (Google)'); } catch (e) {}
    console.warn('[_SESION_SIN_LLAVE_V1] sesion sin llave de Azure (' + motivo + '): todo va por Google');
  }
  function revisar() {
    if (!hayUsuario()) return;
    if (window._rlAvisoLlaveHasta && Date.now() < window._rlAvisoLlaveHasta) return;
    var e = estadoLlave();
    if (e !== 'ok') pintar(e);
  }
  function iniciar() { setTimeout(revisar, 3000); setInterval(revisar, 5 * 60 * 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
