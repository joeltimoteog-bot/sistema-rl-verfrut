/* ════════════════════════════════════════════════════════════════════════════
   eti-informes-acceso-v1.js — _ETI_INFORMES_ACCESO_V1 (10-nov-2026)
   Programacion ETI (Sistema RR.LL.): boton "📑 Informes ETI" en la barra de pestañas.
   Abre Evaluaciones ETI en otra pestaña, YA con la sesion (mismo pase SSO que la tarjeta del
   menu principal: irAConSSO), directo en el Centro de informes, el Expediente de auditoria o el
   Cierre de ciclo o el Informe de Capacitaciones ETI (v2, 10-nov). Todo se lee de Supabase alla. SOLO agrega el boton: no cambia la programacion.
   Apagar: quitar la etiqueta <script> de programacion-eti.html.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ETI_INFORMES_ACCESO_V1) return; window._ETI_INFORMES_ACCESO_V1 = true;
  var ETI = 'https://sistemarrll.com/eti-evaluacion-verfrut/';
  var SSO_SECRETO = 'RL-SSO-VERFRUT-2026';   /* el mismo de index.html (irAConSSO) */
  var SSO_SERVIDOR_URL = 'https://rl-fn-verfrut.azurewebsites.net/api/auth/sso';   /* azure-token.js lo dirige a Supabase */
  var $ = function (id) { return document.getElementById(id); };

  function usuario() { try { var r = sessionStorage.getItem('user'); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
  async function paseLocal(u) {
    var usr = String(u.usuario || '').toLowerCase().trim(); if (!usr || !window.crypto || !crypto.subtle) return '';
    var pase = btoa(unescape(encodeURIComponent(JSON.stringify({ u: usr, n: String(u.nombre || '').trim(), r: String(u.rol || '').toLowerCase().trim(), exp: Date.now() + 90000 }))));
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pase + '|' + SSO_SECRETO));
    return 'sso=' + pase + '.' + Array.from(new Uint8Array(buf)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  async function paseServidor(u) {
    try {
      var tk = sessionStorage.getItem('rl_token'); if (!tk || !window.AbortController) return '';
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 6000);
      var r = await fetch(SSO_SERVIDOR_URL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ accion: 'emitir', nombre: String(u.nombre || '').trim() }) });
      clearTimeout(t); var j = await r.json(); return j && j.success && j.pase ? 'sso2=' + j.pase : '';
    } catch (e) { return ''; }
  }
  async function ir(abrir) {
    var w = window.open('about:blank', '_blank');   /* se abre en el clic (evita el bloqueo de ventanas) */
    var u = usuario(), destino = ETI + '?abrir=' + encodeURIComponent(abrir);
    try {
      var p = await Promise.all([paseLocal(u), paseServidor(u)]), h = p.filter(Boolean).join('&');
      if (h) destino += '#' + h;
    } catch (e) {}
    if (w) w.location.href = destino; else location.href = destino;
    cerrarPanel();
  }

  var P = null;
  function cerrarPanel() { if (P) { P.remove(); P = null; } }
  function panel(btn) {
    if (P) { cerrarPanel(); return; }
    var r = btn.getBoundingClientRect();
    P = document.createElement('div');
    P.style.cssText = 'position:fixed;z-index:3000;top:' + (r.bottom + 6) + 'px;left:' + Math.max(8, Math.min(r.left, window.innerWidth - 340)) + 'px;width:330px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.18);padding:8px;font-family:Inter,Barlow,"Segoe UI",sans-serif';
    var it = function (k, ico, t, d) { return '<button type="button" data-ab="' + k + '" style="display:flex;gap:10px;width:100%;text-align:left;border:0;background:#fff;padding:9px 10px;border-radius:9px;cursor:pointer;align-items:flex-start" onmouseover="this.style.background=\'#F1F5F9\'" onmouseout="this.style.background=\'#fff\'">' +
      '<span style="font-size:18px">' + ico + '</span><span><b style="display:block;font-size:13.5px;color:#0F172A">' + t + '</b><small style="color:#64748B;font-size:12px">' + d + '</small></span></button>'; };
    P.innerHTML = '<div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.05em;padding:4px 10px 6px">Informes ETI · se abren en Evaluaciones ETI</div>' +
      it('centro', '📑', 'Centro de informes', 'Todos los informes ETI en un solo lugar') +
      it('expediente', '🗂', 'Expediente de auditoría', 'Por sector: temas, rutas y códigos, reforzamientos') +
      it('ciclo', '📊', 'Informe de cierre de ciclo', 'Por sector y general, en Word');
    P.innerHTML += it('capacitaciones', '📘', 'Informe de Capacitaciones ETI', 'Mensual, por ciclo o cierre de año · general o por sector');
    document.body.appendChild(P);
    Array.prototype.forEach.call(P.querySelectorAll('[data-ab]'), function (b) { b.onclick = function () { ir(b.getAttribute('data-ab')); }; });
    setTimeout(function () { document.addEventListener('click', function f(e) { if (P && !P.contains(e.target) && e.target !== btn) { cerrarPanel(); document.removeEventListener('click', f); } }); }, 0);
  }
  function poner() {
    var tabs = document.querySelector('#app .bar .tabs'); if (!tabs || $('etiInfBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'etiInfBtn'; b.className = 'tab noprint'; b.textContent = '📑 Informes ETI';
    b.title = 'Centro de informes, Expediente de auditoría y Cierre de ciclo (Evaluaciones ETI)';
    b.onclick = function (e) { e.stopPropagation(); panel(b); };
    tabs.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  setTimeout(poner, 1500);
})();
