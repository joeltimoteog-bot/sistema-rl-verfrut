/* dashboard.html · bloque 6 (antes en la linea 11002) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

// ── Service Worker (_SW_SIN_TRABA_V1, 05-oct-2026) ──────────────
/* ANTES: cada vez que se instalaba una version nueva del SW salia el aviso
   "Nueva version disponible · Recargar". Como el SW ya se activa solo
   (skipWaiting en sw.js), el boton "Recargar" le hablaba a un SW que ya estaba
   activo y NO hacia nada -> el usuario se quedaba ahi. Ademas se buscaba
   version nueva cada 60 s en cada pestana abierta.
   AHORA: sin aviso que bloquee. Si llega una version nueva, la pagina se
   recarga sola UNA vez (nunca en bucle: maximo 1 recarga cada 2 min por
   pestana) y solo si el usuario no esta escribiendo; si esta escribiendo,
   se muestra un aviso chico cuyo boton recarga de verdad. Revisa version
   nueva cada 30 min. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sistema-rl-verfrut/sw.js')
      .then(registration => {
        console.log('[SW] Registrado:', registration.scope);
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              try { if (window.rlSalud && window.rlSalud.registrar) window.rlSalud.registrar('sw_nuevo', location.pathname, 0, ''); } catch (e) {}
            }
          });
        });
        setInterval(() => { try { registration.update(); } catch (e) {} }, 30 * 60 * 1000);
      })
      .catch(err => console.error('[SW] Error registro:', err));

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      let ult = 0;
      try { ult = Number(sessionStorage.getItem('rl_sw_recarga') || 0); } catch (e) {}
      if (Date.now() - ult < 120000) { console.log('[SW] version nueva activa (sin recargar otra vez)'); return; }
      const ae = document.activeElement;
      const escribiendo = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && String(ae.value || '').length > 0;
      if (escribiendo) { mostrarToastActualizacion(); return; }
      try { sessionStorage.setItem('rl_sw_recarga', String(Date.now())); } catch (e) {}
      window.location.reload();
    });
  });
}

function mostrarToastActualizacion() {
  if (document.getElementById('toast-update')) return;
  const toast = document.createElement('div');
  toast.id = 'toast-update';
  toast.innerHTML = '<div style="position:fixed;bottom:20px;left:20px;background:#0a2463;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.25);z-index:99999;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;font-size:13px;max-width:340px">' +
    '<span>🔄 Hay una versión nueva del sistema.</span>' +
    '<button id="btnReloadUpdate" style="background:#fff;color:#0a2463;border:none;padding:6px 10px;border-radius:7px;font-weight:700;cursor:pointer">Actualizar</button>' +
    '<button id="btnCloseUpdate" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);padding:6px 8px;border-radius:7px;cursor:pointer">Luego</button></div>';
  document.body.appendChild(toast);
  document.getElementById('btnReloadUpdate').onclick = () => {
    try { sessionStorage.setItem('rl_sw_recarga', String(Date.now())); } catch (e) {}
    window.location.reload();
  };
  document.getElementById('btnCloseUpdate').onclick = () => { toast.remove(); };
}
