/* ═══════════════════════════════════════════════════════════════════════════
   _MENU_SIMPLE_V1 (18-oct-2026) — menú más liviano, sin tocar funciones
   ---------------------------------------------------------------------------
   Decisión tomada con el tráfico real de Firebase (6 → 18 oct, 18 usuarios):
   1) "Enviar Reporte" (42 aperturas, 12 supervisores) SALE del menú lateral y pasa
      a ser un botón "📧 Enviar reporte" en la cabecera de Mis Atenciones (205
      aperturas, el módulo más usado). Al pulsarlo se abre el MISMO formulario de
      siempre (#sec-correo: cFI, cFF, cEmp, cRespMulti, cPara, cCC, generarCorreo,
      vista previa) dentro de una ventana. No se cambia ningún id ni función.
   2) "Resumen General" (4 aperturas, solo jtimoteo; duplica a Estadísticas y hace
      2 lecturas pesadas a Google) se OCULTA del menú. resumen.html queda intacto.
   Respeta lo que ya existe:
     · Permisos por usuario (_PERMISOS_UI_V1 escribe style.display en #navCorreo):
       el botón nuevo se muestra solo si el usuario tiene permitido Enviar Reporte.
     · Restricción por cumplimiento (aplicarRestricciones pone 🔒 en #navCorreo y
       bloquea el clic): el botón nuevo hereda el candado y el mismo aviso, porque
       el clic se delega al botón del menú (oculto) y de ahí sigue el flujo normal.
     · Tráfico (Monitor en vivo): se sigue anotando "Abrió Enviar Reporte".
     · Acceso rápido del Dashboard y búsqueda del Asistente: siguen abriendo el
       formulario (ahora en ventana).
   Para desactivar: quitar la etiqueta <script src=".../menu-simple.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._MENU_SIMPLE_V1) return;
  window._MENU_SIMPLE_V1 = true;
  function $(id) { return document.getElementById(id); }

  var CSS = '\
#navCorreo,#navRes{display:none !important}\
#sec-atenciones .card-h{justify-content:flex-start;gap:10px}\
#sec-atenciones .card-h .card-t{flex:1 1 auto}\
#msEnviarRep{background:linear-gradient(135deg,#d97706,#b45309);color:#fff;border:none;border-radius:9px;padding:8px 13px;font:700 12px Barlow,"Segoe UI",system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(217,119,6,.28);position:relative}\
#msEnviarRep:hover{filter:brightness(1.07)}\
#msEnviarRep.ms-lock{opacity:.6}\
#msEnviarRep .ms-new{position:absolute;top:-8px;right:-6px;background:#fbbf24;color:#422006;font-size:8px;font-weight:900;padding:1px 5px;border-radius:999px;letter-spacing:.4px}\
#msOv{z-index:1200}\
#msOv .ms-d{background:#fff;border-radius:16px;width:min(820px,calc(100vw - 32px));max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(2,6,23,.45);overflow:hidden;animation:msIn .22s cubic-bezier(.2,.9,.3,1.1)}\
@keyframes msIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}\
#msOv .ms-h{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#fff}\
#msOv .ms-h .ic{width:36px;height:36px;border-radius:10px;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none}\
#msOv .ms-h b{font:800 15px Barlow,"Segoe UI",system-ui,sans-serif;color:#0a2463;display:block}\
#msOv .ms-h small{display:block;color:#64748b;font-size:11.5px;margin-top:1px}\
#msOv .ms-x{margin-left:auto;border:none;background:#f1f5f9;color:#475569;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:15px;flex:none}\
#msOv .ms-x:hover{background:#e2e8f0;color:#0f172a}\
#msOv .ms-b{overflow:auto;padding:4px 18px 18px}\
#msOv .ms-b .correo-box{border:none;padding:10px 0 0;margin-top:0;border-radius:0;box-shadow:none}\
#msOv .ms-b .correo-t{display:none}\
@media(max-width:640px){#msOv .ms-d{width:100vw;max-height:100vh;border-radius:0}}';
  try { var st = document.createElement('style'); st.id = 'msCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  var ov = null, cajaOrigen = null;
  function ventana() {
    if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'msOv'; ov.className = 'ov';
    ov.innerHTML = '<div class="ms-d" role="dialog" aria-modal="true" aria-labelledby="msTit">' +
      '<div class="ms-h"><div class="ic">📧</div><div><b id="msTit">Enviar reporte por correo</b><small>Excel de atenciones del periodo · se abre tu correo con el archivo listo para enviar</small></div>' +
      '<button type="button" class="ms-x" aria-label="Cerrar" title="Cerrar">✕</button></div>' +
      '<div class="ms-b" id="msBody"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ms-x').onclick = cerrar;
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    return ov;
  }
  function abrir() {
    try {
      var sec = $('sec-correo'); if (!sec) return false;
      var v = ventana(), body = $('msBody');
      var caja = sec.querySelector('.correo-box') || sec.firstElementChild;
      if (caja && caja.parentNode !== body) { cajaOrigen = cajaOrigen || sec; body.appendChild(caja); }
      v.classList.add('on');
      /* la lista de correos (Para) se adelanta igual que al abrir el modulo por el menu */
      try { if (typeof window.cargarUsuarios === 'function') setTimeout(function () { try { window.cargarUsuarios(); } catch (e) {} }, 300); } catch (e) {}
      setTimeout(function () { try { var f = $('cFI'); if (f && !f.value) f.focus(); } catch (e) {} }, 60);
      return true;
    } catch (e) { return false; }
  }
  function cerrar() { try { if (ov) ov.classList.remove('on'); } catch (e) {} }
  window.rlEnviarReporte = { abrir: abrir, cerrar: cerrar };

  /* ── ir('correo') abre la ventana en vez de cambiar de seccion (lo demas sigue igual) ── */
  function envolverIr() {
    var previo = window.ir;
    if (typeof previo !== 'function' || previo._msWrap) return;
    var w = function (id, btn) {
      if (id === 'correo') {
        /* tráfico: mismo aviso que registraba el menu (con el freno de 45 s de _TRAFICO_V3) */
        try {
          var k = '_trf_sec_correo', ult = Number(sessionStorage.getItem(k) || 0);
          if ((Date.now() - ult) > 45000 && window.RLTrafico && window.RLTrafico.emit) { sessionStorage.setItem(k, String(Date.now())); window.RLTrafico.emit({ accion: 'Abrió Enviar Reporte', destino: 'Firebase', tipo: 'nav' }); }
        } catch (e) {}
        if (abrir()) return;
      }
      return previo.apply(this, arguments);
    };
    w._msWrap = true;
    window.ir = w; try { ir = w; } catch (e) {}
  }

  /* ── botón en la cabecera de Mis Atenciones; hereda permiso y candado del menú ── */
  function boton() {
    var sec = $('sec-atenciones'), nav = $('navCorreo');
    if (!sec || !nav) return;
    var h = sec.querySelector('.card-h'); if (!h) return;
    var b = $('msEnviarRep');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'msEnviarRep';
      b.innerHTML = '📧 Enviar reporte<span class="ms-new">NUEVO</span>';
      b.title = 'Enviar por correo el Excel de atenciones del periodo';
      var ref = $('btnNuevaAt') || h.querySelector('button');
      if (ref) h.insertBefore(b, ref); else h.appendChild(b);
      b.onclick = function () { try { nav.click(); } catch (e) { abrir(); } };   /* pasa por el menu: permisos, candado y flujo de siempre */
      try { if (localStorage.getItem('rl_ms_visto')) b.querySelector('.ms-new').remove(); else setTimeout(function () { try { localStorage.setItem('rl_ms_visto', '1'); } catch (e) {} }, 15000); } catch (e) {}
    }
    /* permiso: _PERMISOS_UI_V1 escribe style.display en el boton del menu */
    var permitido = nav.style.display !== 'none';
    b.style.display = permitido ? '' : 'none';
    /* candado de cumplimiento */
    var lock = !!nav._cumplRestr;
    b.classList.toggle('ms-lock', lock);
    b.title = lock ? (nav.title || 'Restringido temporalmente por incumplimiento') : 'Enviar por correo el Excel de atenciones del periodo';
    var l = b.querySelector('.ms-lk');
    if (lock && !l) b.insertAdjacentHTML('beforeend', '<span class="ms-lk" style="margin-left:2px">🔒</span>');
    if (!lock && l) l.remove();
  }

  function iniciar() {
    envolverIr(); boton();
    try {
      var nav = $('navCorreo');
      if (nav) new MutationObserver(boton).observe(nav, { attributes: true, attributeFilter: ['style', 'title'], childList: true });
    } catch (e) {}
    var n = 0, t = setInterval(function () { envolverIr(); boton(); if (++n > 20) clearInterval(t); }, 1500);
    console.log('[_MENU_SIMPLE_V1] listo: Enviar reporte en Mis Atenciones; Resumen General fuera del menú');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
