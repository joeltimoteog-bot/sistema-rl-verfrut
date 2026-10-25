/* 62-remitir-v1.js — _KPI_A2_V1 (25-oct-2026): "Remitido a" en Mis Atenciones.
   Cada atención registrada se remite a su área (Planillas, Bienestar, SST, Jefatura...). Se guarda en Azure
   (dbo.Atenciones: remitido_a, remitido_en hora de Lima, remitido_por) y alimenta el KPI A2 de la asistente
   (remisión el mismo día hábil, hasta las 16:36). Si este archivo falla, Mis Atenciones sigue igual. */
(function () {
  'use strict';
  var AREAS = ['PLANILLAS', 'BIENESTAR SOCIAL', 'SEGURIDAD Y SALUD (SST)', 'JEFATURA RR.LL.', 'GERENCIA', 'SUPERVISOR GH', 'OTRO'];
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dmyhm(v) { var s = String(v || ''); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/); return m ? m[3] + '/' + m[2] + ' ' + m[4] + ':' + m[5] : s.slice(0, 10); }
  window._remitirBoton = function (a) {
    var tit = a.remitido_a ? 'Remitida a ' + a.remitido_a + ' el ' + dmyhm(a.remitido_en) + (a.remitido_por ? ' por ' + a.remitido_por : '') + ' (clic para cambiar)' : 'Marcar a qué área se remitió este documento';
    var txt = a.remitido_a ? '📤 ' + esc(String(a.remitido_a).split(' ')[0]) : '📤 Remitir';
    var st = a.remitido_a ? 'background:#0f766e;color:#fff;border-color:#0f766e' : 'background:#fff7ed;color:#9a3412;border-color:#fdba74';
    return '<button class="btn-a" id="rmt-' + a.id + '" style="' + st + '" title="' + esc(tit) + '" onclick="_remitirAt(' + a.id + ',\'' + esc(a.nro) + '\')">' + txt + '</button>';
  };
  window._remitirAt = function (id, nro) {
    var old = document.getElementById('rmt-overlay'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'rmt-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = '<div style="background:#fff;border-radius:12px;padding:18px 20px;width:min(420px,92vw);box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:inherit">' +
      '<div style="font-weight:800;font-size:15px;margin-bottom:4px">📤 Remitir atención N° ' + esc(nro) + '</div>' +
      '<div style="font-size:12px;color:#475569;margin-bottom:12px">¿A qué área se remitió la documentación? Se guarda la fecha y hora de este momento.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + AREAS.map(function (x) { return '<button type="button" data-area="' + esc(x) + '" style="padding:9px 10px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:700;font-size:12px;cursor:pointer">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<div style="text-align:right;margin-top:12px"><button type="button" data-cerrar="1" style="padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer">Cancelar</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', async function (ev) {
      var b = ev.target.closest('button'); if (!b) { if (ev.target === ov) ov.remove(); return; }
      if (b.dataset.cerrar) { ov.remove(); return; }
      var area = b.dataset.area; if (!area) return;
      Array.prototype.forEach.call(ov.querySelectorAll('button'), function (x) { x.disabled = true; });
      try {
        var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
        var r = await fetch(AZURE_FN_BASE + '/atenciones/update', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
          body: JSON.stringify({ id: id, remitido_a: area, usuario_actualiza: (window.USER || {}).usuario || '' }) });
        var j = await r.json();
        if (!j || !j.success) throw new Error((j && j.error) || 'HTTP ' + r.status);
        var a = { id: id, nro: nro, remitido_a: j.remitido_a, remitido_en: j.remitido_en, remitido_por: j.remitido_por };
        try { (typeof atTodas !== 'undefined' ? atTodas : []).forEach(function (x) { if (String(x.id) === String(id)) { x.remitido_a = a.remitido_a; x.remitido_en = a.remitido_en; x.remitido_por = a.remitido_por; } }); } catch (e) {}
        var btn = document.getElementById('rmt-' + id); if (btn) btn.outerHTML = window._remitirBoton(a);
        if (typeof mostrarToast === 'function') mostrarToast('📤 Remitida a ' + area + ' (' + dmyhm(j.remitido_en) + ')');
        ov.remove();
      } catch (e) {
        Array.prototype.forEach.call(ov.querySelectorAll('button'), function (x) { x.disabled = false; });
        if (typeof mostrarToast === 'function') mostrarToast('❌ No se pudo remitir: ' + (e.message || e), 'error');
      }
    });
  };
  console.log('[_KPI_A2_V1] remitir listo');
})();
