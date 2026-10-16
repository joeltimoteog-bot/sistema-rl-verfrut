/* ═══════════════════════════════════════════════════════════════════════════
   _UI_TOAST_V1 (15-oct-2026) — avisos (toasts) unificados + esqueletos de carga
   ---------------------------------------------------------------------------
   1) mostrarToast(msg, tipo): misma firma de siempre (tipo: ok|success|info|error|warn).
      Ahora: apilados abajo a la derecha, icono y color por tipo, barra de tiempo, clic
      para cerrar, y se traducen con rlTraducir (salud.js) si esta disponible.
      Si la pagina NO tenia mostrarToast, se crea; si lo tenia, se reemplaza SOLO la
      presentacion (misma funcion, mismos parametros, mismo nombre).
   2) Esqueletos: toda celda/caja que diga "⏳ Cargando…" muestra barras animadas
      mientras llega la informacion (el texto original queda, solo se tapa).
   Si algo falla, queda la funcion anterior. Para desactivar: quitar el <script>.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._UI_TOAST_V1) return;
  window._UI_TOAST_V1 = true;

  var CSS = '\
#uiToasts{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;max-width:min(380px,calc(100vw - 32px));pointer-events:none}\
.ui-toast{--a:#16a34a;--bg:#f0fdf4;--bd:#bbf7d0;--tx:#14532d;pointer-events:auto;display:flex;align-items:flex-start;gap:10px;background:#fff;border:1px solid var(--bd);border-left:4px solid var(--a);border-radius:12px;padding:11px 12px 12px 12px;box-shadow:0 12px 32px rgba(15,23,42,.18);font:600 13px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a;position:relative;overflow:hidden;animation:uiTin .28s cubic-bezier(.2,.9,.3,1.2);cursor:pointer}\
.ui-toast.out{animation:uiTout .25s forwards}\
@keyframes uiTin{from{opacity:0;transform:translateX(24px) scale(.97)}to{opacity:1;transform:none}}\
@keyframes uiTout{to{opacity:0;transform:translateX(24px)}}\
.ui-toast .ic{flex:none;width:26px;height:26px;border-radius:50%;background:var(--bg);color:var(--a);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}\
.ui-toast .tx{flex:1;min-width:0;line-height:1.4;padding-top:3px;word-break:break-word}\
.ui-toast .x{flex:none;border:none;background:transparent;color:#94a3b8;font-size:15px;cursor:pointer;padding:0 2px;line-height:1}\
.ui-toast .x:hover{color:#0f172a}\
.ui-toast .bar{position:absolute;left:0;bottom:0;height:3px;background:var(--a);opacity:.55;width:100%;transform-origin:left;animation:uiTbar linear forwards}\
@keyframes uiTbar{from{transform:scaleX(1)}to{transform:scaleX(0)}}\
.ui-toast.ok,.ui-toast.success{--a:#16a34a;--bg:#dcfce7;--bd:#bbf7d0}\
.ui-toast.error{--a:#dc2626;--bg:#fee2e2;--bd:#fecaca}\
.ui-toast.warn,.ui-toast.warning{--a:#d97706;--bg:#fef3c7;--bd:#fde68a}\
.ui-toast.info{--a:#2563eb;--bg:#dbeafe;--bd:#bfdbfe}\
@media(max-width:600px){#uiToasts{right:10px;left:10px;bottom:12px;max-width:none}}\
.ui-skel{position:relative;min-height:38px}\
.ui-skel>*{visibility:hidden}\
.ui-skel:before,.ui-skel:after{content:"";position:absolute;left:12px;right:12px;height:10px;border-radius:999px;background:linear-gradient(90deg,#e9eef6 25%,#f6f8fc 50%,#e9eef6 75%);background-size:200% 100%;animation:uiSk 1.2s infinite}\
.ui-skel:before{top:9px;right:30%}.ui-skel:after{top:25px;right:55%}\
@keyframes uiSk{from{background-position:200% 0}to{background-position:-200% 0}}';
  try { var st = document.createElement('style'); st.id = 'uiToastCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  var ICO = { ok: '✓', success: '✓', error: '!', warn: '⚠', warning: '⚠', info: 'i' };
  function tipoNorm(t, msg) {
    t = String(t || '').toLowerCase();
    if (ICO[t]) return t;
    var s = String(msg || '');
    if (/❌|error|no se pudo|fall/i.test(s)) return 'error';
    if (/⚠|aviso|atenci/i.test(s)) return 'warn';
    if (/ℹ|info/i.test(s)) return 'info';
    return 'ok';
  }
  function cont() { var c = document.getElementById('uiToasts'); if (!c) { c = document.createElement('div'); c.id = 'uiToasts'; (document.body || document.documentElement).appendChild(c); } return c; }
  function toast(msg, tipo, ms) {
    try {
      var t = tipoNorm(tipo, msg);
      var texto = String(msg == null ? '' : msg);
      try { if (typeof window.rlTraducir === 'function') texto = window.rlTraducir(texto); } catch (e) {}
      texto = texto.replace(/^\s*(✅|❌|⚠️|ℹ️|⏳|🔒|📡|🆕)\s*/, '');
      var dur = ms || (t === 'error' ? 6500 : t === 'warn' ? 5000 : 3200);
      var c = cont(), el = document.createElement('div');
      el.className = 'ui-toast ' + t; el.setAttribute('role', t === 'error' ? 'alert' : 'status');
      el.innerHTML = '<span class="ic">' + ICO[t] + '</span><div class="tx"></div><button type="button" class="x" aria-label="Cerrar">✕</button><span class="bar" style="animation-duration:' + dur + 'ms"></span>';
      el.querySelector('.tx').textContent = texto;
      var cerrar = function () { if (el._out) return; el._out = true; el.classList.add('out'); setTimeout(function () { try { el.remove(); } catch (e) {} }, 260); };
      el.onclick = cerrar;
      el._t = setTimeout(cerrar, dur);
      el.onmouseenter = function () { clearTimeout(el._t); el.querySelector('.bar').style.animationPlayState = 'paused'; };
      el.onmouseleave = function () { el.querySelector('.bar').style.animationPlayState = 'running'; el._t = setTimeout(cerrar, 1500); };
      c.appendChild(el);
      while (c.children.length > 4) { try { c.firstChild.remove(); } catch (e) { break; } }
      return el;
    } catch (e) { try { if (previo) return previo.apply(window, arguments); } catch (e2) {} }
  }
  var previo = (typeof window.mostrarToast === 'function') ? window.mostrarToast : null;
  window.mostrarToast = toast;
  window.uiToast = toast;
  /* por si la pagina define mostrarToast DESPUES de este script (function hoisting en otro <script>) */
  window.addEventListener('load', function () { try { if (window.mostrarToast !== toast && !(window.mostrarToast && window.mostrarToast._rlTrad)) { previo = window.mostrarToast; window.mostrarToast = toast; } } catch (e) {} });

  /* ── esqueletos de carga ── */
  var RE = /^\s*⏳?\s*Cargando/i;
  function marcar(raiz) {
    try {
      var cand = (raiz.querySelectorAll ? raiz.querySelectorAll('td[colspan], .empty, .cargando, .loading, tbody > tr:only-child > td') : []);
      Array.prototype.forEach.call(cand, function (el) {
        if (el.classList.contains('ui-skel')) return;
        if (el.children.length > 1) return;
        if (RE.test(el.textContent || '')) { el.innerHTML = '<span>' + el.innerHTML + '</span>'; el.classList.add('ui-skel'); }
      });
    } catch (e) {}
  }
  function iniciarSkel() {
    try {
      marcar(document);
      new MutationObserver(function (ms) {
        try { document.querySelectorAll('.ui-skel').forEach(function (el) { if (!RE.test(el.textContent || '')) el.classList.remove('ui-skel'); }); } catch (e) {}
        ms.forEach(function (m) { m.addedNodes && m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { marcar(n); if (n.matches && n.matches('td[colspan]')) marcar(n.parentNode); } if (n.nodeType === 3 && n.parentNode && n.parentNode.matches && n.parentNode.matches('td[colspan]')) marcar(n.parentNode.parentNode); }); }); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarSkel); else iniciarSkel();
  console.log('[_UI_TOAST_V1] listo');
})();
