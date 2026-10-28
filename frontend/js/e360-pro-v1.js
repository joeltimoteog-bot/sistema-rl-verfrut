/* ═══════════════════════════════════════════════════════════════════════════
   e360-pro-v1.js — _E360_PRO_V1 (27-oct-2026)  · Evaluacion 360° (capa ADITIVA)
   · Escala con CRITERIOS (que significa cada nota), para evaluar igual a todos.
   · Panel "Evidencia objetiva del mes" del supervisor elegido: KPIs (resultados, sin formulas),
     % de cumplimiento, casos vencidos / criticos / por vencer y visitas pendientes.
   · "Aplicar sugerencias": propone la nota de las preguntas ancladas a KPIs (el evaluador decide).
   · "Insertar resumen": agrega los hechos del mes al comentario (queda en la evaluacion y el feedback).
   Solo lee. No cambia como se guarda la evaluacion. Si Azure no responde, el formulario queda igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._E360_PRO_V1) return; window._E360_PRO_V1 = true;
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api';
  var CRIT = [
    ['1 · Deficiente', 'No lo cumple; requiere intervención inmediata.'],
    ['2 · Regular', 'Lo cumple a veces o solo con recordatorios.'],
    ['3 · Bueno', 'Lo cumple de forma regular, con fallas puntuales.'],
    ['4 · Muy bueno', 'Lo cumple siempre, sin necesidad de supervisión.'],
    ['5 · Excelente', 'Lo cumple siempre y es ejemplo para los demás / propone mejoras.']
  ];
  var css = [
    '.e3p-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin:0 0 14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}',
    '.e3p-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:800;color:#0b1e45;font-size:14px;margin-bottom:10px}',
    '.e3p-h small{font-weight:600;color:#64748b;font-size:12px}',
    '.e3p-crit{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}',
    '.e3p-crit div{background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:8px 10px;font-size:12px;color:#475569;line-height:1.35}',
    '.e3p-crit b{display:block;color:#0f172a;font-size:12.5px;margin-bottom:2px}',
    '.e3p-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}',
    '.e3p-k{border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;background:#fff}',
    '.e3p-k .t{font-size:11px;font-weight:800;letter-spacing:.05em;color:#64748b;text-transform:uppercase}',
    '.e3p-k .v{font-size:22px;font-weight:800;color:#0f172a;margin:2px 0}',
    '.e3p-k .d{font-size:12px;color:#475569}',
    '.e3p-k.ok{border-left:4px solid #16a34a}.e3p-k.med{border-left:4px solid #d97706}.e3p-k.mal{border-left:4px solid #dc2626}.e3p-k.nd{border-left:4px solid #cbd5e1}',
    '.e3p-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.e3p-acts button{border:0;border-radius:10px;padding:9px 14px;font-weight:800;font-size:12.5px;cursor:pointer}',
    '.e3p-b1{background:#1e3a8a;color:#fff}.e3p-b2{background:#eef2ff;color:#1e3a8a}',
    '.e3p-nota{font-size:11.5px;color:#64748b;margin-top:8px}',
    '.e3p-chip{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:10.5px;font-weight:800;vertical-align:middle}',
    '.e3p-sug{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:10.5px;font-weight:800}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function mismaPersona(a, b) {   /* "Roberto Molero Abad" vs "MOLERO ABAD ROBERTO CARLOS": >= 2 palabras en comun */
    var A = norm(a).split(' ').filter(function (w) { return w.length > 2; }), B = ' ' + norm(b) + ' ', n = 0;
    A.forEach(function (w) { if (B.indexOf(' ' + w + ' ') >= 0) n++; });
    return n >= 2;
  }
  function post(ruta, cuerpo) {
    return fetch(AZ + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function rangoMes(fecha) {
    var f = String(fecha || '').slice(0, 7); if (!/^\d{4}-\d{2}$/.test(f)) { var d = new Date(); f = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
    var y = +f.slice(0, 4), m = +f.slice(5, 7), ult = new Date(y, m, 0).getDate();
    var hoy = new Date(), hs = hoy.getFullYear() + '-' + ('0' + (hoy.getMonth() + 1)).slice(-2) + '-' + ('0' + hoy.getDate()).slice(-2);
    var hasta = f + '-' + ('0' + ult).slice(-2); if (hasta > hs) hasta = hs;
    return { desde: f + '-01', hasta: hasta, mes: f };
  }
  function pctTxt(p) { return p == null ? '—' : Math.round(p * 100) + '%'; }
  function claseDe(p, meta) { if (p == null) return 'nd'; meta = meta || 0.9; return p >= meta ? 'ok' : p >= meta - 0.2 ? 'med' : 'mal'; }
  function notaSugerida(p) { if (p == null) return null; return p >= 0.95 ? 5 : p >= 0.85 ? 4 : p >= 0.7 ? 3 : p >= 0.5 ? 2 : 1; }

  var EVID = null, cache = {};
  function panel() {
    var cont = $('competeciasContainer'); if (!cont) return null;
    if (!$('e3pCrit')) {
      var c = document.createElement('div'); c.className = 'e3p-card'; c.id = 'e3pCrit';
      c.innerHTML = '<div class="e3p-h">📏 Cómo calificar <small>usa el mismo criterio con todos: califica conductas observadas en el mes, no a la persona</small></div><div class="e3p-crit">'
        + CRIT.map(function (x) { return '<div><b>' + x[0] + '</b>' + x[1] + '</div>'; }).join('') + '</div>';
      cont.parentNode.insertBefore(c, cont);
      var e = document.createElement('div'); e.className = 'e3p-card'; e.id = 'e3pEvid';
      e.innerHTML = '<div class="e3p-h">📊 Evidencia objetiva del mes <small>elige un supervisor y la fecha</small></div>';
      cont.parentNode.insertBefore(e, cont);
    }
    return $('e3pEvid');
  }
  function marcarPreguntas() {
    (typeof COMPETENCIAS !== 'undefined' ? COMPETENCIAS : []).forEach(function (comp, ci) {
      (comp.kpi || []).forEach(function (k, pi) {
        var r = document.querySelector('input[name="q_' + ci + '_' + pi + '"]'); if (!r) return;
        var fila = r.closest('.pregunta-row'); if (!fila || fila.querySelector('.e3p-chip')) return;
        var t = fila.querySelector('.pregunta-txt'); if (t) t.insertAdjacentHTML('beforeend', '<span class="e3p-chip">📊 ' + (k === 'CUMPL' ? 'Cumplimiento' : k === 'VENC' ? 'Atrasos' : k) + '</span>');
      });
    });
  }
  function pctDe(k) { if (!EVID) return null;
    if (k === 'CUMPL') return EVID.cumpl ? EVID.cumpl.pct : null;
    if (k === 'VENC') { var c = EVID.cumpl; if (!c) return null; var t = (c.vencidos || 0); return t === 0 ? 1 : t <= 1 ? 0.85 : t <= 3 ? 0.7 : t <= 6 ? 0.5 : 0.3; }
    var kk = (EVID.kpis || []).filter(function (x) { return x.codigo === k || (k === 'K2' && x.codigo === 'A1'); })[0];
    return kk && kk.estado === 'ok' && kk.den ? kk.num / kk.den : null;
  }
  function pintarSugerencias() {
    document.querySelectorAll('.e3p-sug').forEach(function (x) { x.remove(); });
    if (!EVID || typeof COMPETENCIAS === 'undefined') return;
    COMPETENCIAS.forEach(function (comp, ci) {
      (comp.kpi || []).forEach(function (k, pi) {
        var n = notaSugerida(pctDe(k)); if (!n) return;
        var r = document.querySelector('input[name="q_' + ci + '_' + pi + '"]'); var fila = r && r.closest('.pregunta-row'); var t = fila && fila.querySelector('.pregunta-txt');
        if (t) t.insertAdjacentHTML('beforeend', '<span class="e3p-sug" title="Según el resultado del mes">sugerido: ' + n + '</span>');
      });
    });
  }
  function aplicarSugerencias() {
    if (!EVID || typeof COMPETENCIAS === 'undefined') return;
    var n0 = 0;
    COMPETENCIAS.forEach(function (comp, ci) {
      (comp.kpi || []).forEach(function (k, pi) {
        var n = notaSugerida(pctDe(k)); if (!n) return;
        var r = document.querySelector('input[name="q_' + ci + '_' + pi + '"][value="' + n + '"]'); if (r) { r.checked = true; n0++; }
      });
    });
    try { if (typeof calcularResultado === 'function') calcularResultado(); } catch (e) {}
    try { (window.mostrarToast || alert)('✅ Se aplicaron ' + n0 + ' notas sugeridas por la evidencia. Revísalas: tú decides la nota final.'); } catch (e) {}
  }
  function resumenTexto() {
    if (!EVID) return '';
    var l = ['EVIDENCIA OBJETIVA ' + EVID.mesTxt + ':'];
    (EVID.kpis || []).forEach(function (k) { if (k.estado === 'ok' && k.den) l.push('• ' + k.corto + ': ' + k.num + ' de ' + k.den + ' ' + (k.unidad || '') + ' (' + pctTxt(k.num / k.den) + ').'); });
    var c = EVID.cumpl; if (c) {
      l.push('• Cumplimiento general: ' + (c.porcentaje != null ? c.porcentaje + '%' : '—') + '.');
      if (c.vencidos) l.push('• Atrasos a la fecha: ' + c.vencidos + ' vencido(s)' + (c.criticos ? ' (de ellos ' + c.criticos + ' crítico(s))' : '') + '.');
      if (c.por_vencer) l.push('• Por vencer: ' + c.por_vencer + '.');
      if (c.visitas_pendientes) l.push('• Visitas con informe pendiente: ' + c.visitas_pendientes + '.');
    }
    return l.join('\n');
  }
  function insertarResumen() {
    var t = $('eval_obs'), r = resumenTexto(); if (!t || !r) return;
    if (t.value.indexOf('EVIDENCIA OBJETIVA') >= 0) t.value = t.value.replace(/EVIDENCIA OBJETIVA[\s\S]*?(\n\n|$)/, r + '\n\n');
    else t.value = (t.value ? t.value.trim() + '\n\n' : '') + r;
    t.rows = Math.max(t.rows, 6); t.dispatchEvent(new Event('input'));
  }

  async function cargar() {
    var box = panel(); if (!box) return;
    marcarPreguntas();
    var sup = ($('eval_supervisor') || {}).value || '', fecha = ($('eval_fecha') || {}).value || '';
    if (!sup) { EVID = null; pintarSugerencias(); box.innerHTML = '<div class="e3p-h">📊 Evidencia objetiva del mes <small>elige un supervisor y la fecha</small></div>'; return; }
    var R = rangoMes(fecha), clave = sup + '|' + R.mes;
    box.innerHTML = '<div class="e3p-h">📊 Evidencia objetiva · ' + esc(sup) + ' <small>cargando ' + R.mes + '…</small></div>';
    if (!cache[R.mes]) cache[R.mes] = Promise.all([post('/kpi/tablero', { desde: R.desde, hasta: R.hasta }), post('/cumpl/cumplPanel', {})]);
    var res = await cache[R.mes];
    if (($('eval_supervisor') || {}).value !== sup) return;   /* cambio de supervisor mientras cargaba */
    var kp = res[0], cp = res[1];
    var per = kp && kp.personas ? kp.personas.filter(function (p) { return mismaPersona(sup, p.nombre); })[0] : null;
    var cu = cp && cp.supervisores ? cp.supervisores.filter(function (s) { return mismaPersona(sup, s.nombre || s.supervisor || s.usuario); })[0] : null;
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
    EVID = { kpis: per ? per.kpis : [], cumpl: cu ? { pct: cu.porcentaje != null && !isNaN(parseFloat(cu.porcentaje)) ? parseFloat(cu.porcentaje) / 100 : null, porcentaje: cu.porcentaje, vencidos: cu.vencidos, criticos: cu.criticos, por_vencer: cu.por_vencer, visitas_pendientes: cu.visitas_pendientes } : null,
      mesTxt: meses[+R.mes.slice(5, 7) - 1] + ' ' + R.mes.slice(0, 4) + ' (al ' + R.hasta.slice(8, 10) + ')' };
    if (!per && !cu) {
      box.innerHTML = '<div class="e3p-h">📊 Evidencia objetiva · ' + esc(sup) + '</div><div class="e3p-nota">' + (kp || cp ? 'Este supervisor no figura en los indicadores del periodo.' : 'No se pudo leer la evidencia (sin conexión o sin permiso). Puedes evaluar igual.') + '</div>';
      EVID = null; pintarSugerencias(); return;
    }
    var tarjetas = (EVID.kpis || []).filter(function (k) { return k.codigo !== 'K4' || k.estado === 'ok'; }).map(function (k) {
      var p = k.estado === 'ok' && k.den ? k.num / k.den : null;
      return '<div class="e3p-k ' + claseDe(p, k.meta) + '"><div class="t">' + esc(k.codigo + ' · ' + k.corto) + '</div><div class="v">' + (k.codigo === 'K4' && k.nota_curso != null ? k.nota_curso + '/20' : pctTxt(p)) + '</div><div class="d">'
        + (k.estado === 'ok' && k.den ? k.num + ' de ' + k.den + ' ' + esc(k.unidad || '') : 'Sin datos en el mes') + '</div></div>';
    });
    if (EVID.cumpl) {
      var c = EVID.cumpl, at = (c.vencidos || 0);
      tarjetas.push('<div class="e3p-k ' + claseDe(c.pct, 0.9) + '"><div class="t">Cumplimiento general</div><div class="v">' + (c.porcentaje != null ? c.porcentaje + '%' : '—') + '</div><div class="d">casos y visitas en plazo</div></div>');
      tarjetas.push('<div class="e3p-k ' + (at ? (c.criticos ? 'mal' : 'med') : 'ok') + '"><div class="t">Atrasos a hoy</div><div class="v">' + at + '</div><div class="d">' + 'vencidos' + (c.criticos ? ' (' + c.criticos + ' críticos)' : '') + ' · ' + (c.por_vencer || 0) + ' por vencer' + (c.visitas_pendientes ? ' · ' + c.visitas_pendientes + ' visitas sin informe' : '') + '</div></div>');
    }
    box.innerHTML = '<div class="e3p-h">📊 Evidencia objetiva · ' + esc(sup) + ' <small>' + esc(EVID.mesTxt) + '</small></div><div class="e3p-kpis">' + tarjetas.join('') + '</div>'
      + '<div class="e3p-acts"><button type="button" class="e3p-b1" id="e3pAplicar">✨ Aplicar sugerencias a las preguntas 📊</button><button type="button" class="e3p-b2" id="e3pResumen">📝 Insertar resumen en el comentario</button></div>'
      + '<div class="e3p-nota">Las sugerencias solo completan las preguntas marcadas con 📊 según el resultado del mes; las demás las calificas tú por lo observado. El supervisor verá los resultados y tus comentarios, no las fórmulas.</div>';
    $('e3pAplicar').onclick = aplicarSugerencias; $('e3pResumen').onclick = insertarResumen;
    pintarSugerencias();
  }

  function iniciar() {
    panel(); marcarPreguntas();
    ['eval_supervisor', 'eval_fecha'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { setTimeout(cargar, 50); }); });
    var gf = window.generarFormulario;
    if (typeof gf === 'function') window.generarFormulario = function () { var r = gf.apply(this, arguments); try { marcarPreguntas(); pintarSugerencias(); } catch (e) {} return r; };
    setTimeout(cargar, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else setTimeout(iniciar, 0);
})();
