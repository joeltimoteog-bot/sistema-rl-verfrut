/* ═══════════════════════════════════════════════════════════════════════════
   e360-asistente-form-v1.js — _E360_ASISTENTE_V1 (08-nov-2026) · Formulario guiado, uno por uno
   ---------------------------------------------------------------------------
   Se activa con evaluacion360.html?asistente=1 (lo abre el panel). Capa ADITIVA: no cambia cómo se
   guarda la evaluación (saveEvaluacion360 → Supabase).
   · Pide a Supabase los pendientes del periodo (e360Pendientes) y toma el primero.
   · Abre el formulario, elige al supervisor (lo agrega a la lista si no estaba), espera la "Evidencia
     objetiva del mes" (e360-pro-v1.js) y aplica las sugerencias de los KPIs + inserta el resumen de
     hechos en el comentario. El evaluador revisa, ajusta y guarda.
   · Al guardar con éxito pasa al siguiente pendiente; con "Saltar" lo deja para después.
   · Barra superior: "Asistente 360° · 3 de 12 · NOMBRE" con Saltar y Salir.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._E360_ASISTENTE_FORM_V1) return; window._E360_ASISTENTE_FORM_V1 = true;
  var q = new URLSearchParams(location.search);
  if (q.get('asistente') !== '1') return;
  var EDGE = (window.RL_EDGE_URL || 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api') + '/e360/guardar/';
  var LOG = function (m) { try { console.log('[_E360_ASISTENTE_FORM_V1] ' + m); } catch (e) {} };
  var cola = [], total = 0, hechas = 0, actual = null, saltados = [], mes = '', periodo = '', arrastre = false;
  function $(id) { return document.getElementById(id); }
  function tk() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function titulo(n) { return String(n || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function misma(a, b) { var A = norm(a).split(' ').filter(function (w) { return w.length > 2; }), B = ' ' + norm(b) + ' ', n = 0; A.forEach(function (w) { if (B.indexOf(' ' + w + ' ') >= 0) n++; }); return n >= 2; }
  function espera(fn, ms, paso) { return new Promise(function (ok) { var t0 = Date.now(); (function loop() { var v = fn(); if (v) return ok(v); if (Date.now() - t0 > ms) return ok(null); setTimeout(loop, paso || 150); })(); }); }

  async function pendientes() {
    var t = tk(); if (!t) return null;
    try { var r = await fetch(EDGE + 'e360Pendientes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' }); return r.ok ? await r.json() : null; }
    catch (e) { LOG('error ' + e.message); return null; }
  }

  /* ---- barra ---- */
  function barra() {
    var b = $('e360AsisBar');
    if (!b) {
      var css = document.createElement('style');
      css.textContent = '#e360AsisBar{position:sticky;top:0;z-index:9000;background:linear-gradient(135deg,#0b1e45,#1e3a8a);color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13.5px;box-shadow:0 6px 18px -8px rgba(0,0,0,.5)}'
        + '#e360AsisBar b{font-weight:800}#e360AsisBar .prog{background:rgba(255,255,255,.18);border-radius:999px;height:8px;flex:1;min-width:120px;overflow:hidden}#e360AsisBar .prog i{display:block;height:100%;background:#4ade80;transition:width .3s}'
        + '#e360AsisBar button{border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:10px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:12.5px}#e360AsisBar button.p{background:#fff;color:#0b1e45;border-color:#fff}'
        + '#e360AsisBar .ok{background:#16a34a;color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800}';
      document.head.appendChild(css);
      b = document.createElement('div'); b.id = 'e360AsisBar'; document.body.insertBefore(b, document.body.firstChild);
    }
    var listas = hechas, pend = cola.length + (actual ? 1 : 0);
    if (!actual) {
      b.innerHTML = '<span>🧭 <b>Asistente 360° · ' + esc(mes) + '</b></span><span class="ok">✅ Sin pendientes: ' + listas + ' de ' + total + ' evaluaciones registradas' + (saltados.length ? ' · ' + saltados.length + ' saltada(s)' : '') + '</span>'
        + '<span style="flex:1"></span>' + (saltados.length ? '<button type="button" id="e360AsisRetomar">↩ Retomar saltadas</button>' : '') + '<button type="button" class="p" id="e360AsisSalir">Volver al panel</button>';
      var rt = $('e360AsisRetomar'); if (rt) rt.onclick = function () { cola = saltados.slice(); saltados = []; siguiente(); };
    } else {
      var pct = total ? Math.round(listas / total * 100) : 0;
      b.innerHTML = '<span>🧭 <b>Asistente 360° · ' + esc(mes) + '</b></span><span>Evaluando <b>' + (listas + 1) + ' de ' + total + '</b>: <b>' + esc(titulo(actual.nombre)) + '</b> <small>(' + esc(actual.empresa || '') + (actual.tipo === 'ASIST' ? ' · asistente RR.LL.' : ' · supervisor GH') + ')</small></span>'
        + '<span class="prog"><i style="width:' + pct + '%"></i></span><span>' + pend + ' pendiente(s)</span>'
        + '<button type="button" id="e360AsisSaltar">⏭ Saltar</button><button type="button" id="e360AsisSalir">Salir</button>';
      $('e360AsisSaltar').onclick = function () { saltados.push(actual); actual = null; siguiente(); };
    }
    $('e360AsisSalir').onclick = function () { location.href = 'dashboard.html'; };
  }

  /* ---- preparar el formulario para una persona ---- */
  async function preparar(p) {
    if (typeof window.mostrarFormulario === 'function') window.mostrarFormulario();
    var sel = await espera(function () { return $('eval_supervisor'); }, 4000); if (!sel) { LOG('sin select'); return; }
    /* mes anterior con pendientes: la evaluación se fecha el último día de ese mes para que caiga en su periodo */
    if (arrastre && periodo && $('eval_fecha')) { var y = +periodo.slice(0, 4), m = +periodo.slice(5, 7); $('eval_fecha').value = periodo + '-' + ('0' + new Date(y, m, 0).getDate()).slice(-2); if (typeof window.actualizarPeriodo === 'function') { try { window.actualizarPeriodo(); } catch (e) {} } }
    var opt = null;
    for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value && misma(sel.options[i].value, p.nombre)) { opt = sel.options[i]; break; } }
    if (!opt) { opt = document.createElement('option'); opt.value = p.nombre; opt.textContent = p.nombre; if (p.empresa) opt.dataset.empresa = p.empresa; sel.appendChild(opt); }
    sel.value = opt.value;
    if (p.empresa && $('eval_empresa')) $('eval_empresa').value = p.empresa;
    if (typeof window.actualizarEmpresaSup === 'function') { try { window.actualizarEmpresaSup(); } catch (e) {} }
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    /* evidencia del mes (e360-pro-v1.js) → aplicar sugerencias + resumen */
    var btn = await espera(function () { var b = $('e3pAplicar'); return b && b.closest('#e3pEvid') && (document.querySelector('#e3pEvid .e3p-kpis') ? b : null); }, 9000, 200);
    if (btn) { try { btn.click(); var r = $('e3pResumen'); if (r && !String(($('eval_obs') || {}).value || '').trim()) r.click(); LOG('sugerencias aplicadas para ' + p.nombre); } catch (e) { LOG('no se pudo aplicar: ' + e.message); } }
    else LOG('sin evidencia para ' + p.nombre + ' (se evalúa manualmente)');
    try { ($('panelFormulario') || document.body).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    if (typeof window.mostrarToast === 'function') window.mostrarToast('🧭 Evaluando a ' + titulo(p.nombre) + ' · revisa las notas sugeridas y guarda');
  }

  function siguiente() {
    actual = cola.shift() || null;
    barra();
    if (actual) preparar(actual);
    else if (typeof window.mostrarDashboard === 'function') { try { window.mostrarDashboard(); } catch (e) {} }
  }

  /* ---- tras guardar: si la persona ya no está pendiente, avanzar ---- */
  function engancharGuardar() {
    var orig = window.guardarEvaluacion;
    if (typeof orig !== 'function') return;
    window.guardarEvaluacion = async function () {
      var quien = actual;
      var r = await orig.apply(this, arguments);
      if (!quien) return r;
      var d = await pendientes();
      if (d && d.success) {
        var sigue = (d.pendientes || []).some(function (x) { return misma(x.nombre, quien.nombre); });
        if (!sigue) { hechas = d.hechas; cola = (d.pendientes || []).filter(function (x) { return !saltados.some(function (s) { return misma(s.nombre, x.nombre); }); }); actual = null; setTimeout(siguiente, 900); }
      }
      return r;
    };
  }

  async function iniciar() {
    var d = await pendientes();
    if (!d || !d.success) { LOG('sin datos de pendientes'); return; }
    if (!d.evaluador_autorizado) { LOG('no autorizado'); return; }
    mes = d.mes; periodo = d.periodo; arrastre = !!d.arrastre; total = d.total; hechas = d.hechas; cola = (d.pendientes || []).slice();
    var pref = q.get('sup'); if (pref) { var i = cola.findIndex(function (x) { return misma(x.nombre, pref); }); if (i > 0) cola.unshift(cola.splice(i, 1)[0]); }
    engancharGuardar();
    siguiente();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 1200); }); else setTimeout(iniciar, 1200);
})();
