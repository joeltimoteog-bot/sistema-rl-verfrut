/* ═══════════════════════════════════════════════════════════════════
   68-sede-v1.js — _SEDE_OLMOS_V1 (01-nov-2026) — Indicador de sede: PIURA (RAPEL / VERFRUT) · OLMOS
   Todo sigue en la misma base; aqui solo se IDENTIFICA de que sede es cada registro:
   · Sede = OLMOS si la empresa es OLMOS o el fundo es uno de Olmos (BOMAREA, PIRONA, MOSQUETA, HEFEI, LEFKADA); si no, PIURA.
   · Mis Atenciones: chip de sede junto a la empresa en cada fila (y color propio para OLMOS).
   · Estadísticas (admin): el grafico "RAPEL vs VERFRUT — este mes" incluye OLMOS y, debajo, el resumen
     "Sede Piura: N · Sede Olmos: N" de atenciones del mes.
   · window.RLSede(registro) queda disponible para otros modulos.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlSedeOk) return; window._rlSedeOk = true;
  var FUNDOS_OLMOS = (window.FUNDOS_OLMOS || ['BOMAREA', 'PIRONA', 'MOSQUETA', 'HEFEI', 'LEFKADA']).map(function (f) { return String(f).toUpperCase(); });
  function sede(r) {
    if (!r) return 'PIURA';
    var emp = String(r.empresa || '').toUpperCase().trim(), fundo = String(r.fundo || r.fundo_actual || r.zona_labor || '').toUpperCase().trim();
    if (emp.indexOf('OLMOS') >= 0) return 'OLMOS';
    if (fundo && FUNDOS_OLMOS.some(function (f) { return fundo.indexOf(f) >= 0; })) return 'OLMOS';
    return 'PIURA';
  }
  window.RLSede = sede;

  /* ── estilos ── */
  var css = document.createElement('style'); css.id = 'sedeCss';
  css.textContent = '.bg.bolm{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}' +
    '.sede-chip{display:inline-block;margin-left:5px;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:800;letter-spacing:.4px;vertical-align:middle;text-transform:uppercase}' +
    '.sede-chip.piura{background:#e0f2fe;color:#075985;border:1px solid #bae6fd}.sede-chip.olmos{background:#ffedd5;color:#9a3412;border:1px solid #fdba74}' +
    '#sedeResumen{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 2px;font-size:11.5px;font-weight:700}' +
    '#sedeResumen span{padding:3px 10px;border-radius:999px}#sedeResumen .p{background:#e0f2fe;color:#075985}#sedeResumen .o{background:#ffedd5;color:#9a3412}';
  document.head.appendChild(css);

  /* ── 1) Mis Atenciones: chip de sede en la celda de empresa ── */
  function marcarTabla() {
    var tb = document.getElementById('tbAt'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.dataset.sedeOk) return;
      var tds = tr.children; if (!tds || tds.length < 9) return;
      var celEmp = tds[7], bg = celEmp && celEmp.querySelector('.bg'); if (!bg) return;
      var emp = (bg.textContent || '').trim().toUpperCase(), fundo = (tds[8].textContent || '').trim();
      var s = sede({ empresa: emp, fundo: fundo });
      if (emp === 'OLMOS') { bg.classList.remove('bam'); bg.classList.add('bolm'); }
      var chip = document.createElement('span'); chip.className = 'sede-chip ' + (s === 'OLMOS' ? 'olmos' : 'piura'); chip.textContent = s === 'OLMOS' ? 'Olmos' : 'Piura';
      celEmp.appendChild(chip); tr.dataset.sedeOk = '1';
    });
  }
  var _renderAt = window.renderAt;
  if (typeof _renderAt === 'function') {
    window.renderAt = function () { var r = _renderAt.apply(this, arguments); try { marcarTabla(); setTimeout(marcarTabla, 300); } catch (e) {} return r; };
    try { renderAt = window.renderAt; } catch (e) {}
  }
  /* la tabla se repinta por otros caminos (filtros, refresco en vivo): se observa el tbody */
  try { var tb0 = document.getElementById('tbAt'); if (tb0) new MutationObserver(function () { setTimeout(marcarTabla, 50); }).observe(tb0, { childList: true }); } catch (e) {}

  /* ── 2) Estadisticas admin: OLMOS en el grafico de empresas + resumen por sede ── */
  function delMes(arr, campo) {
    var m = new Date().getMonth() + 1, y = new Date().getFullYear();
    return (arr || []).filter(function (r) { var f = new Date(String(r[campo] || '').substring(0, 10)); return f.getMonth() + 1 === m && f.getFullYear() === y; });
  }
  function completarGrafico() {
    try {
      var ch = (typeof charts !== 'undefined' && charts) ? charts.empresa : null; if (!ch || !ch.data || ch._sedeOk) return;
      var C = (typeof CACHE !== 'undefined' && CACHE) ? CACHE : {};
      var atMes = delMes(C.atenciones, 'fecha_atencion'), visMes = delMes(C.visitas, 'fecha_reg'), casMes = delMes(C.casos, 'fecha_reporte');
      var olm = function (arr) { return arr.filter(function (r) { return sede(r) === 'OLMOS'; }).length; };
      if (!ch.data.datasets.some(function (d) { return d.label === 'OLMOS'; })) {
        ch.data.datasets.push({ label: 'OLMOS', data: [olm(atMes), olm(visMes), olm(casMes)], backgroundColor: '#f97316', borderRadius: 6 });
      }
      ch._sedeOk = true; ch.update();
      var t = document.querySelector('#chartEmpresa') && document.querySelector('#chartEmpresa').closest('.gc'); var tit = t && t.querySelector('.gc-t');
      if (tit && tit.textContent.indexOf('OLMOS') < 0) tit.textContent = '🏭 RAPEL · VERFRUT · OLMOS — este mes';
      var piura = atMes.length - olm(atMes), res = document.getElementById('sedeResumen');
      if (!res && tit) { res = document.createElement('div'); res.id = 'sedeResumen'; tit.insertAdjacentElement('afterend', res); }
      if (res) res.innerHTML = '<span class="p">Sede Piura · ' + piura + ' atenciones</span><span class="o">Sede Olmos · ' + olm(atMes) + ' atenciones</span>';
    } catch (e) { console.warn('[_SEDE_OLMOS_V1]', e.message); }
  }
  var _rea = window.renderEstadisticasAdmin;
  if (typeof _rea === 'function') {
    window.renderEstadisticasAdmin = function () { var r = _rea.apply(this, arguments); setTimeout(completarGrafico, 200); return r; };
    try { renderEstadisticasAdmin = window.renderEstadisticasAdmin; } catch (e) {}
  }
  setInterval(function () { if (typeof charts !== 'undefined' && charts && charts.empresa && !charts.empresa._sedeOk) completarGrafico(); }, 3000);
  console.log('[_SEDE_OLMOS_V1] listo: sede Piura / Olmos en atenciones y estadísticas');
})();
