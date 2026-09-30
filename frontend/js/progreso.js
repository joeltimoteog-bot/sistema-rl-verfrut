/* ═══════════════════════════════════════════════════════════════════════════
   _PROGRESO_V1 (27-set-2026) — "Guardando… / Eliminando…" y ✓ en TODOS los módulos
   ---------------------------------------------------------------------------
   Cada vez que la pantalla envia un guardado, edicion o eliminacion (a Google o a
   Azure) aparece un circulo girando con el texto de la accion; al terminar, ✓ verde
   ("Guardado", "Actualizado", "Eliminado") o ✗ rojo con el motivo.
   · Si Azure no responde y la pantalla reintenta por Google, el circulo sigue hasta
     el resultado final (no muestra un error intermedio).
   · Las copias en 2do plano (hoja, Firebase, registros internos) no muestran nada.
   · Solo mira; no cambia lo que se envia ni la respuesta.
   INTERRUPTOR: window.RL_PROGRESO = false  (antes de cargar este archivo)
   _PROGRESO_V2 (30-set-2026): tambien para CARGAS y EXPORTACIONES que la pagina pida:
     RLProgreso.accion(['Calculando…', 'Listo', 'No se pudo calcular'], function () { return promesa; })
   Muestra el circulo, luego ✓ (o ✗ con el motivo) y devuelve el mismo resultado.
   _PROGRESO_V3 (30-set-2026), en TODOS los modulos que cargan este archivo, sin tocarlos:
   · CARGAS pedidas con un boton/filtro (lecturas a Google o Azure que empiezan hasta
     1,5 s despues del clic): "Cargando…" y ✓ "Listo". Si responde en menos de 0,2 s no
     muestra nada (no parpadea). Las lecturas automaticas (sin clic) no muestran nada.
   · DESCARGAS Excel (XLSX.writeFile) y PDF (jsPDF .save / html2pdf .save):
     "Generando el Excel/PDF…" y ✓ "Excel/PDF descargado".
   Solo mira: no cambia lo que se envia, lo que responde ni los errores de la pagina.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlProgOk || window.RL_PROGRESO === false || typeof window.fetch !== 'function') return;
  window._rlProgOk = true;

  var ESCRITURA = /^(save|update|delete|eliminar|add|resolver|registrar|aprobar|subir|guardar|programar|actualizar|cumplConfigGuardar|cumplRestriccionLevantar|horas(Registrar|Editar|Eliminar|Aprobar|AgregarMotivo|EliminarMotivo)|inv(Agregar|Editar|Eliminar|Registrar|Guardar|Armar)|mant_|permisosGuardar|accesoHorario(Guardar|Eliminar)|horarios(Guardar|Eliminar)|duplicar)/i;
  /* en 2do plano: no se muestran */
  var SILENCIO = /^(saveAtencionDesdeAzure|syncAtencionAzure|syncFirebaseAtencion|registrarArchivoAzure|subirArchivoAzure|saludLog|saludReporte|cumplJustificar|registrarEnvioAlmuerzos|guardarCacheLS|updateUltimaAlerta)$/i;

  function textos(a) {
    if (/elimin|delete|borrar/i.test(a)) return ['Eliminando…', 'Eliminado'];
    if (/^(update|actualizar)|editar|Aprobar|aprobar|resolver|ConfigGuardar|permisosGuardar|Levantar/i.test(a)) return ['Actualizando…', 'Actualizado'];
    return ['Guardando…', 'Guardado'];
  }
  /* que accion es (o null si no es una escritura visible) y si su respuesta es definitiva */
  function clasificar(url, init) {
    try {
      var u = String(url && url.url ? url.url : url || ''), m;
      if (/azurewebsites\.net/.test(u)) {
        if (init && String(init.method || 'GET').toUpperCase() === 'OPTIONS') return null;
        if ((m = u.match(/\/api\/[a-z]+\/guardar\/([A-Za-z]+)/))) return { a: m[1], azure: true };
        if (/\/api\/atenciones\/guardar/.test(u)) return { a: 'saveAtencion', azure: true };
        if ((m = u.match(/\/api\/acceso\/(accesoHorarioGuardar|accesoHorarioEliminar|permisosGuardar)/))) return { a: m[1], azure: true };
        return null;
      }
      if (!/script\.google(usercontent)?\.com/.test(u)) return null;
      var a = '';
      if (init && typeof init.body === 'string') { m = init.body.match(/"action"\s*:\s*"([^"]+)"/); if (m) a = m[1]; }
      if (!a && (m = u.match(/[?&]action=([^&]+)/))) a = decodeURIComponent(m[1]);
      if (!a || SILENCIO.test(a) || !ESCRITURA.test(a)) return null;
      return { a: a, azure: false };
    } catch (e) { return null; }
  }

  /* ── la ventanita ── */
  var css = '#rlProg{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.28)}' +
    '#rlProg .c{background:#fff;color:#0f172a;border-radius:16px;padding:22px 30px;min-width:190px;max-width:86vw;box-shadow:0 18px 50px rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;gap:12px;font:600 15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center}' +
    '#rlProg .g{width:46px;height:46px;border-radius:50%;border:5px solid #e2e8f0;border-top-color:#2563eb;animation:rlGira .8s linear infinite}' +
    '#rlProg .ok,#rlProg .no{width:46px;height:46px;border-radius:50%;display:none;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:800}' +
    '#rlProg .ok{background:#16a34a}#rlProg .no{background:#dc2626}#rlProg .d{font-weight:500;font-size:13px;color:#b91c1c;display:none}' +
    '#rlProg.fin-ok{pointer-events:none;background:transparent}#rlProg.fin-ok .g,#rlProg.fin-no .g{display:none}#rlProg.fin-ok .ok{display:flex;animation:rlSalta .35s ease}#rlProg.fin-no .no{display:flex}#rlProg.fin-no .d{display:block}' +
    '@keyframes rlGira{to{transform:rotate(360deg)}}@keyframes rlSalta{0%{transform:scale(.4)}70%{transform:scale(1.12)}100%{transform:scale(1)}}' +
    '@media print{#rlProg{display:none!important}}' +
    '@media (prefers-color-scheme:dark){#rlProg .c{background:#1e293b;color:#f1f5f9}#rlProg .g{border-color:#334155;border-top-color:#60a5fa}}';
  var caja = null;
  function asegurarCaja() {
    if (caja || !document.body) return caja;
    var st = document.createElement('style'); st.textContent = css; (document.head || document.body).appendChild(st);
    caja = document.createElement('div'); caja.id = 'rlProg';
    caja.innerHTML = '<div class="c" role="status" aria-live="polite"><div class="g"></div><div class="ok">✓</div><div class="no">✕</div><div class="t"></div><div class="d"></div></div>';
    caja.addEventListener('click', function () { if (caja.classList.contains('fin-no')) ocultar(); });
    document.body.appendChild(caja);
    return caja;
  }
  var vis = false, giroVisto = false, pendLect = 0, tGesto = 0;
  var pend = 0, etiqueta = null, huboOk = false, error = '', tMostrar = null, tFin = null, tOcultar = null, tMax = null;
  function mostrar() {
    if (!asegurarCaja()) return;
    caja.classList.remove('fin-ok', 'fin-no');
    caja.querySelector('.t').textContent = etiqueta[0];
    caja.style.display = 'flex';
    giroVisto = true;
  }
  function ocultar() { if (caja) { caja.style.display = 'none'; caja.classList.remove('fin-ok', 'fin-no'); } }
  function terminar() {
    clearTimeout(tMostrar); clearTimeout(tMax);
    if (!asegurarCaja()) return;
    if (huboOk && !vis && !giroVisto && !error) ocultar();   /* _PROGRESO_V3: carga rapida, sin parpadeo */
    else if (huboOk) {
      caja.classList.remove('fin-no'); caja.classList.add('fin-ok');
      caja.querySelector('.t').textContent = etiqueta[1];
      caja.style.display = 'flex';
      tOcultar = setTimeout(ocultar, 1100);
    } else if (error) {
      caja.classList.remove('fin-ok'); caja.classList.add('fin-no');
      caja.querySelector('.t').textContent = etiqueta[2] || 'No se pudo ' + (/Elimin/.test(etiqueta[0]) ? 'eliminar' : /Actualiz/.test(etiqueta[0]) ? 'actualizar' : 'guardar');
      caja.querySelector('.d').textContent = String(error).slice(0, 180);
      caja.style.display = 'flex';
      tOcultar = setTimeout(ocultar, 3500);
    } else ocultar();
    etiqueta = null; huboOk = false; error = ''; vis = false; giroVisto = false;
  }
  function inicio(c) {
    clearTimeout(tFin); clearTimeout(tOcultar);
    if (!pend && !etiqueta) { etiqueta = c.t || (c.lectura ? T_CARGA : textos(c.a)); huboOk = false; error = ''; vis = false; giroVisto = false; }
    if (!c.lectura) vis = true;
    pend++;
    if (!caja || caja.style.display !== 'flex' || caja.classList.contains('fin-ok') || caja.classList.contains('fin-no')) { clearTimeout(tMostrar); tMostrar = setTimeout(mostrar, 180); }
    clearTimeout(tMax); tMax = setTimeout(function () { pend = 0; terminar(); }, 60000);
  }
  function fin(ok, err, definitivo) {
    pend = Math.max(0, pend - 1);
    if (ok) huboOk = true; else if (definitivo && err) error = err;
    if (!pend) { clearTimeout(tFin); tFin = setTimeout(function () { if (!pend) terminar(); }, ok || definitivo ? 350 : 1600); }   /* espera: puede venir el reintento por Google */
  }

  /* _PROGRESO_V2: acciones explicitas de la pagina (cargar, exportar, informe) */
  window.RLProgreso = {
    accion: function (t, fn) {
      try { inicio({ a: '', t: [t[0], t[1], t[2] || 'No se pudo completar'] }); } catch (e) {}
      enganchar();
      var p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
      return p.then(function (r) { fin(true); return r; },
        function (e) { fin(false, (e && e.message) || String(e || 'Error'), true); throw e; });
    }
  };

  /* _PROGRESO_V3: cargas pedidas por el usuario y descargas Excel/PDF */
  var T_CARGA = ['Cargando…', 'Listo', 'No se pudo cargar'];
  var T_XLS = ['Generando el Excel…', 'Excel descargado', 'No se pudo generar el Excel'];
  var T_PDF = ['Generando el PDF…', 'PDF descargado', 'No se pudo generar el PDF'];
  var LECT_SILENCIO = /^(accesoHorarioDeUsuario|saludLog|saludReporte|ping|version)$/i;
  function gesto(ev) {
    try {
      var t = ev.target;
      if (ev.type === 'change' ? (t && /^(SELECT|INPUT)$/.test(t.tagName)) : (t && t.closest && t.closest('button,a,[onclick],[role=button],input[type=button],input[type=submit],.btn,.tab'))) tGesto = Date.now();
      enganchar();
    } catch (e) {}
  }
  document.addEventListener('click', gesto, true);
  document.addEventListener('change', gesto, true);
  function lecturaPedida(url, init) {
    try {
      if (!(pendLect > 0 || Date.now() - tGesto < 1500)) return null;
      var u = String(url && url.url ? url.url : url || ''), m;
      if (/azurewebsites\.net\/api\//.test(u)) {
        if (init && String(init.method || 'GET').toUpperCase() === 'OPTIONS') return null;
        if (/\/api\/kpi\//.test(u)) return null;   /* KPIs ya lo muestra con su propio texto */
        return { a: '', lectura: true, azure: true };
      }
      if (!/script\.google(usercontent)?\.com/.test(u)) return null;
      var a = '';
      if (init && typeof init.body === 'string') { m = init.body.match(/"action"\s*:\s*"([^"]+)"/); if (m) a = m[1]; }
      if (!a && (m = u.match(/[?&]action=([^&]+)/))) a = decodeURIComponent(m[1]);
      if (a && (SILENCIO.test(a) || LECT_SILENCIO.test(a))) return null;
      return { a: a, lectura: true, azure: false };
    } catch (e) { return null; }
  }
  function envolver(obj, nombre, t) {
    var o = obj && obj[nombre];
    if (typeof o !== 'function' || o._rlProg) return;
    var w = function () {
      try { inicio({ a: '', t: t }); } catch (e) {}
      var r;
      try { r = o.apply(this, arguments); } catch (e) { fin(false, (e && e.message) || 'Error', true); throw e; }
      if (r && typeof r.then === 'function') {
        try { Promise.resolve(r).then(function () { fin(true); }, function (e) { fin(false, (e && e.message) || 'Error', true); }); } catch (e) { fin(true); }
      } else fin(true);
      return r;
    };
    w._rlProg = 1;
    try { obj[nombre] = w; } catch (e) {}
  }
  function enganchar() {
    try {
      if (window.XLSX) { envolver(window.XLSX, 'writeFile', T_XLS); envolver(window.XLSX, 'writeFileXLSX', T_XLS); }
      var J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (J && J.API && Array.isArray(J.API.events) && !J._rlProg) {   /* jsPDF crea .save en cada documento */
        J._rlProg = 1;
        J.API.events.push(['initialized', function () { try { envolver(this, 'save', T_PDF); } catch (e) {} }]);
      }
      if (window.html2pdf && window.html2pdf.Worker && window.html2pdf.Worker.prototype) envolver(window.html2pdf.Worker.prototype, 'save', T_PDF);
    } catch (e) {}
  }
  enganchar();
  document.addEventListener('DOMContentLoaded', enganchar);
  window.addEventListener('load', enganchar);

  var fetchOriginal = window.fetch;
  window.fetch = function (url, init) {
    var c = clasificar(url, init);
    if (!c) c = lecturaPedida(url, init);   /* _PROGRESO_V3 */
    var p = fetchOriginal.apply(this, arguments);
    if (!c) return p;
    if (c.lectura) {
      try { inicio(c); pendLect++; } catch (e) {}
      p.then(function (resp) {
        pendLect = Math.max(0, pendLect - 1);
        if (!resp.ok) fin(false, 'HTTP ' + resp.status, !c.azure);
        else resp.clone().text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (j && (j.success === false || j.ok === false)) fin(false, null, true);   /* la pagina muestra su propio aviso: se cierra sin ✓ ni ✗ */
          else fin(true);
        }, function () { fin(true); });
      }, function () { pendLect = Math.max(0, pendLect - 1); fin(false, 'Sin conexion', !c.azure); });
      return p;
    }
    try { inicio(c); } catch (e) {}
    p.then(function (resp) {
      var definitivo = !c.azure || resp.status === 200;
      if (!resp.ok) { fin(false, 'HTTP ' + resp.status, definitivo); return; }
      resp.clone().text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (j && (j.success === false || j.ok === false || j.error)) fin(false, j.error || j.msg || j.mensaje || 'No se completo', definitivo);   /* Mantenimiento responde {ok, msg} */
        else fin(true);
      }, function () { fin(true); });
    }, function (e) { fin(false, 'Sin conexion', !c.azure); });
    return p;
  };
})();
