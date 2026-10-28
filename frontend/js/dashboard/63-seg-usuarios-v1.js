/* ═══════════════════════════════════════════════════════════════════════════
   63-seg-usuarios-v1.js — _SEG_USUARIOS_V1 (26-oct-2026)
   Gestion de Usuarios (dentro del dashboard): estado de seguridad de cada cuenta
   debajo de Activo/Inactivo y boton "Desbloquear" cuando hay intentos fallidos.
   Lee /usuarios/lista (Azure, solo administracion). Nunca muestra claves.
   Si Azure no responde, la tabla queda exactamente como antes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window._segUsuariosV1) return; window._segUsuariosV1 = true;
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api', SEG = {}, ultimo = 0;
  function fmt(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }); }
  function pinta() {
    var tb = document.getElementById('tbUs'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      var tds = tr.children; if (tds.length < 8) return;
      var usr = (tds[0].textContent || '').trim(), g = SEG[usr.toLowerCase()]; if (!g) return;
      var v = tds[5].querySelector('.seg-info'); if (v) v.remove();
      var partes = [], bloq = !!g.bloqueado_hasta;
      if (bloq) partes.push('<span style="color:#b91c1c;font-weight:700">🔒 Bloqueado hasta ' + fmt(g.bloqueado_hasta) + '</span>');
      else if (g.fallos > 0) partes.push('<span style="color:#b45309">⚠️ ' + g.fallos + ' intento' + (g.fallos > 1 ? 's fallidos' : ' fallido') + '</span>');
      if (g.clave_temporal) partes.push('<span style="color:#1d4ed8">⏳ Clave temporal pendiente</span>');
      partes.push(g.clave_cambiada ? '<span style="color:#475569">🔑 Clave cambiada ' + fmt(g.clave_cambiada) + '</span>' : '<span style="color:#94a3b8">🔑 Sin cambio de clave registrado</span>');
      var div = document.createElement('div'); div.className = 'seg-info';
      div.style.cssText = 'font-size:11px;line-height:1.45;margin-top:4px;white-space:normal;min-width:170px';
      div.innerHTML = partes.join('<br>'); tds[5].appendChild(div);
      var bv = tds[7].querySelector('.seg-btn'); if (bv) bv.remove();
      if (bloq || g.fallos > 0) {
        var b = document.createElement('button'); b.className = 'btn-a be seg-btn'; b.textContent = '🔓 Desbloquear'; b.style.marginLeft = '4px';
        b.onclick = function () { desbloquear(usr, b); }; (tds[7].querySelector('.usr-acc') || tds[7]).appendChild(b);
      }
    });
  }
  function cargar(forzar) {
    if (!forzar && Date.now() - ultimo < 60000) { pinta(); return Promise.resolve(); }
    ultimo = Date.now();
    return fetch(BASE + '/usuarios/lista', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.success) return;
      SEG = {}; (j.data || []).forEach(function (u) { if (u.seguridad) SEG[String(u.usuario || '').trim().toLowerCase()] = u.seguridad; });
      pinta();
    }).catch(function (e) { console.warn('[_SEG_USUARIOS_V1]', e.message); });
  }
  function desbloquear(usr, btn) {
    btn.disabled = true; btn.textContent = '…';
    fetch(BASE + '/usr/guardar/desbloquearUsuario', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usr, client_id: 'desbloq-' + usr + '-' + Date.now() }) })
      .then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.success) { try { (window.toast || window.notify || alert)('🔓 ' + usr + ': bloqueo liberado'); } catch (e) {} return cargar(true); }
        throw new Error((d && d.error) || 'No se pudo desbloquear');
      }).catch(function (e) { alert('❌ ' + e.message); btn.disabled = false; btn.textContent = '🔓 Desbloquear'; });
  }
  /* engancha el dibujo de la tabla del dashboard */
  var orig = window._renderUs;
  if (typeof orig === 'function') {
    window._renderUs = function () { var r = orig.apply(this, arguments); try { cargar(false); } catch (e) {} return r; };
  }
  /* respaldo: si la tabla se redibuja por otro camino */
  document.addEventListener('DOMContentLoaded', function () {
    var tb = document.getElementById('tbUs'); if (!tb || !window.MutationObserver) return;
    var t = null; new MutationObserver(function () { if (Object.keys(SEG).length && !tb.querySelector('.seg-info')) { clearTimeout(t); t = setTimeout(pinta, 50); } })
      .observe(tb, { childList: true });
  });
  window._segUsuariosRecargar = function () { return cargar(true); };
})();
