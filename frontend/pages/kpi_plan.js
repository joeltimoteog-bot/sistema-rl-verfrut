/* kpi_plan.js — _KPI_A4_V1 (25-oct-2026): pestaña "Plan de capacitaciones" del módulo KPIs.
   Usa el puente window._kpi (api, esc, dmy) de kpis.html. Si algo falla, el resto del módulo sigue igual. */
(function () {
  'use strict';
  var PARA = { asist: 'Asistente de RR.LL.', sup: 'Supervisores GH', todos: 'Todo el equipo' };
  function $(id) { return document.getElementById(id); }
  function K() { return window._kpi || null; }
  function puedeEditar() { try { var D = K().D(); return !!(D && D.puedeEditar); } catch (e) { return false; } }
  async function cargar() {
    var k = K(); if (!k) return;
    try {
      var j = await k.api('capPlanListar', {});
      if (!j || !j.success) throw new Error((j && j.error) || 'Sin respuesta');
      var nombres = {}; (j.personas || []).forEach(function (p) { nombres[p.usuario] = p.nombre; });
      var t = $('planTabla'); var filas = '<tr><th>Fecha</th><th>Tema</th><th>Para</th><th>Registrado por</th><th></th></tr>';
      if (!(j.plan || []).length) filas += '<tr><td colspan="5" style="color:#64748b">Aún no hay capacitaciones planificadas.</td></tr>';
      (j.plan || []).forEach(function (x) {
        var para = x.personas.map(function (u) { return PARA[u] || nombres[u] || u; }).join(', ') || PARA.asist;
        filas += '<tr><td>' + k.dmy(x.fecha) + '</td><td>' + k.esc(x.tema) + '</td><td>' + k.esc(para) + '</td><td>' + k.esc(x.por || '') + '</td><td>' +
          (puedeEditar() ? '<button class="bt bt-g" style="padding:3px 8px" onclick="window._kpiPlanAnular(' + x.id + ')">Anular</button>' : '') + '</td></tr>';
      });
      t.innerHTML = filas;
      $('planForm').style.display = puedeEditar() ? 'flex' : 'none';
    } catch (e) { $('planTabla').innerHTML = '<tr><td colspan="5" style="color:#b91c1c">No se pudo cargar el plan: ' + (e.message || e) + '</td></tr>'; }
  }
  window._kpiPlanAnular = async function (id) {
    if (!confirm('¿Anular esta capacitación del plan?')) return;
    try { var j = await K().api('capPlanAnular', { id: id }); if (!j.success) throw new Error(j.error); cargar(); } catch (e) { alert('❌ ' + (e.message || e)); }
  };
  document.addEventListener('click', async function (ev) {
    if (!ev.target) return;
    if (ev.target.id === 'plGuardar') {
      ev.preventDefault();
      var f = $('plFecha').value, tema = $('plTema').value.trim(), para = $('plPara').value;
      if (!f || !tema) { alert('Indica la fecha y el tema'); return; }
      try { var j = await K().api('capPlanGuardar', { fecha: f, tema: tema, personas: para }); if (!j.success) throw new Error(j.error); $('plTema').value = ''; cargar(); }
      catch (e) { alert('❌ ' + (e.message || e)); }
    }
    var b = ev.target.closest && ev.target.closest('.tabs button[data-t="s-plan"]');
    if (b) setTimeout(cargar, 0);
  });
})();
