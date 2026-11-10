/* ════════════════════════════════════════════════════════════════════════════
   eti-informes-acceso-v1.js — _ETI_INFORMES_ACCESO_V1 (10-nov-2026) · v5 (Informe de Evaluaciones ETI; avisos visibles 5 s)
   Programacion ETI (Sistema RR.LL.): boton "📑 Informes ETI" en la barra de pestañas.
   v3: los informes se abren AQUI MISMO, en un cuadro sobre Programacion ETI (no abre otra pagina).
     Carga una sola vez, desde el mismo sitio (sistemarrll.com), los modulos de informes de Evaluaciones ETI
     (15 encuesta · 16 alertas · 17 cierre de ciclo · 19 centro/expediente · 20 capacitaciones) y los usa
     con la sesion del Sistema RR.LL. Todo se lee de Supabase (eti/consultar). Solo lee: no cambia nada.
   Apagar: quitar la etiqueta <script> de programacion-eti.html.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._ETI_INFORMES_ACCESO_V1) return; window._ETI_INFORMES_ACCESO_V1 = true;
  var ETI = 'https://sistemarrll.com/eti-evaluacion-verfrut/';
  var MODULOS = ['js/15-encuesta-sat-v1.js?v=1', 'js/16-alertas-ref-v1.js?v=3', 'js/17-informe-ciclo-v1.js?v=5', 'js/19-centro-informes-v1.js?v=9', 'js/20-informe-capacitaciones-v1.js?v=2', 'js/21-informe-evaluaciones-v1.js?v=3'];
  var WORD = ['lib/docx.iife.js?v=951', 'lib/eti-informe-ciclo.js?v=2'];
  var LOGO = 'https://sistemarrll.com/sistema-rl-verfrut/frontend/img/unifrutti-logo.png';
  var XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  var $ = function (id) { return document.getElementById(id); };
  var avisar = function (m) { try { if (typeof toast === 'function') toast(m, 5000); else alert(m); } catch (e) {} };

  function usuario() { try { var r = sessionStorage.getItem('user'); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
  function cargar(src) { return new Promise(function (ok, no) { var e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = function () { no(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(e); }); }
  /* sesion: la misma del Sistema RR.LL. (el servidor eti/* valida este mismo token) */
  function prepararSesion() {
    var u = usuario(), tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    if (!u.usuario || !tk) throw new Error('Tu sesión del Sistema RR.LL. venció. Vuelve a ingresar.');
    try { sessionStorage.setItem('eti_token', tk); } catch (e) {}
    if (typeof window.SESSION === 'undefined') window.SESSION = { user: String(u.usuario).toLowerCase().trim(), nom: String(u.nombre || u.usuario).trim(), rol: /admin/i.test(String(u.rol || '')) ? 'admin' : 'supervisor' };
    window._ETI_EN_RL = true;
    /* v4: los informes llaman toast(mensaje, 'e'|'s'|'i'); el toast de esta pagina espera milisegundos -> el aviso se borraba al instante */
    if (typeof window.toast === 'function' && !window.toast._etiRL) { var t0 = window.toast; window.toast = function (m, ms) { return t0(m, typeof ms === 'string' ? 5000 : ms); }; window.toast._etiRL = true; }
  }
  async function logo() {
    if (getComputedStyle(document.documentElement).getPropertyValue('--logo')) return;
    try { var b = await (await fetch(LOGO)).blob(), d = await new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(b); });
      document.documentElement.style.setProperty('--logo', 'url("' + d + '")'); } catch (e) {}
  }
  var listo = null, word = null;
  function preparar() {
    if (listo) return listo;
    listo = (async function () {
      prepararSesion();
      await logo();
      if (!window.XLSX) await cargar(XLSX_URL);
      for (var i = 0; i < MODULOS.length; i++) await cargar(ETI + MODULOS[i]);   /* en orden: 19 y 20 usan 16 y 17 */
      if (!window.etiCentroInformes || !window.etiInformeCap || !window.etiInformeCicloUI) throw new Error('No cargaron los módulos de informes');
    })();
    listo.catch(function () { listo = null; });
    return listo;
  }
  function prepararWord() {   /* cierre de ciclo en Word: sus librerias vienen de Evaluaciones ETI */
    if (word) return word;
    word = (async function () { if (typeof window.docx === 'undefined') await cargar(ETI + WORD[0]); if (typeof window.etiInformeCiclo !== 'function') await cargar(ETI + WORD[1]); })();
    word.catch(function () { word = null; });
    return word;
  }
  async function abrir(que, btn) {
    cerrarPanel();
    var txt = btn ? btn.textContent : ''; if (btn) btn.textContent = '⏳ Cargando informes…';
    try {
      await preparar(); prepararWord();
      if (que === 'expediente') window.etiCentroInformes.expediente();
      else if (que === 'capacitaciones') window.etiInformeCap.abrir();
      else if (que === 'evaluaciones') window.etiInformeEval.abrir();
      else if (que === 'ciclo') { await prepararWord(); window.etiInformeCicloUI.abrir(); }
      else window.etiCentroInformes.abrir();
    } catch (e) { console.error('[_ETI_INFORMES_ACCESO_V1]', e); avisar('No se pudieron abrir los informes: ' + e.message); }
    finally { if (btn) btn.textContent = txt; }
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
    P.innerHTML = '<div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.05em;padding:4px 10px 6px">Informes ETI · se abren aquí mismo</div>' +
      it('centro', '📑', 'Centro de informes', 'Todos los informes ETI en un solo lugar') +
      it('capacitaciones', '📘', 'Informe de Capacitaciones ETI', 'Mensual, por ciclo o cierre de año · general o por sector') +
      it('evaluaciones', '📗', 'Informe de Evaluaciones ETI', 'Mensual, por ciclo o cierre de año · general o por sector') +
      it('expediente', '🗂', 'Expediente de auditoría', 'Por sector: temas, rutas y códigos, reforzamientos') +
      it('ciclo', '📊', 'Informe de cierre de ciclo', 'Por sector y general, en Word');
    document.body.appendChild(P);
    Array.prototype.forEach.call(P.querySelectorAll('[data-ab]'), function (b) { b.onclick = function () { abrir(b.getAttribute('data-ab'), btn); }; });
    setTimeout(function () { document.addEventListener('click', function f(e) { if (P && !P.contains(e.target) && e.target !== btn) { cerrarPanel(); document.removeEventListener('click', f); } }); }, 0);
  }
  function poner() {
    var tabs = document.querySelector('#app .bar .tabs'); if (!tabs || $('etiInfBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'etiInfBtn'; b.className = 'tab noprint'; b.textContent = '📑 Informes ETI';
    b.title = 'Centro de informes, Informe de Capacitaciones ETI, Expediente de auditoría y Cierre de ciclo';
    b.onclick = function (e) { e.stopPropagation(); panel(b); };
    tabs.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  setTimeout(poner, 1500);
})();
