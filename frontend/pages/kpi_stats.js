/* ═══════════════════════════════════════════════════════════════════════════
   _KPI_STATS_V1 (30-set-2026) — KPIs RR.LL.: rango de fechas, estadisticas
   (radar, sectores, distribucion, evolucion diaria, ranking, plan de accion)
   e INFORME MENSUAL (mes cerrado = foto inmutable; mes en curso = avance).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window._kpi; if (!K) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = K.esc, dmy = K.dmy;
  var CH = {}, SERIE = null, SERIE_KEY = '';
  var SER = { K1: '#2a78d6', K2: '#eb6834', K3: '#1baf7a', A1: '#eda100' };   /* orden categorico validado (paleta de referencia) */
  var NOMK = { K1: 'Conflictos ≤5 días', K2: 'Gestión documentaria', K3: 'Capacitaciones ETI', A1: 'Registro el mismo día (asistente)' };
  var META = { K1: 0.95, K2: 0.95, K3: 0.95, A1: 0.90 };
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function hoyL() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function finMes(y, m) { return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
  function p100(x) { return x == null ? '—' : (Math.round(x * 1000) / 10).toFixed(1).replace('.0', '') + '%'; }

  /* ── RANGO ── */
  function preset(r) {
    var h = hoyL(), y = +h.slice(0, 4), m = +h.slice(5, 7), mm = ('0' + m).slice(-2);
    if (r === 'periodo') return {};
    if (r === 'mes') return { desde: y + '-' + mm + '-01', hasta: finMes(y, m) };
    if (r === 'q1') return { desde: y + '-' + mm + '-01', hasta: y + '-' + mm + '-15' };
    if (r === 'q2') return { desde: y + '-' + mm + '-16', hasta: finMes(y, m) };
    if (r === '7d') { var d = new Date(Date.parse(h + 'T00:00:00Z') - 6 * 86400000).toISOString().slice(0, 10); return { desde: d, hasta: h }; }
    if (r === 'mesant') { var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return { desde: py + '-' + ('0' + pm).slice(-2) + '-01', hasta: finMes(py, pm) }; }
    return {};
  }
  function aplicar(R, boton) {
    window._kpiRango = R;
    Array.prototype.forEach.call(document.querySelectorAll('#rango .pr'), function (b) { b.classList.toggle('on', b === boton); });
    $('rDesde').value = R.desde || ''; $('rHasta').value = R.hasta || '';
    SERIE = null;
    K.cargarVisible(['Calculando ' + (R.desde ? dmy(R.desde) + ' al ' + dmy(R.hasta) : 'todo el periodo') + '…', 'Rango aplicado', 'No se pudo calcular el rango']);
  }
  Array.prototype.forEach.call(document.querySelectorAll('#rango .pr'), function (b) { b.onclick = function () { aplicar(preset(b.dataset.r), b); }; });
  $('rAplicar').onclick = function () {
    var d = $('rDesde').value, h = $('rHasta').value;
    if (!d || !h || d > h) { K.aviso('⚠️ Elige un rango válido (desde ≤ hasta).', 'av-e'); return; }
    aplicar({ desde: d, hasta: h }, null);
  };

  window._kpiTrasCargar = function () {
    var D = K.D(), R = D.rango || {};
    $('rLabel').textContent = 'Mostrando: ' + dmy(R.desde) + ' al ' + dmy(R.hasta > D.hoy ? D.hoy : R.hasta) + ' · cada registro cuenta el día en que vence';
    if (document.querySelector('#s-stats.on')) window._kpiStatsPintar();
  };

  /* ── utilidades de analisis (tambien las usa el informe) ── */
  function clasif(p) {
    if (p.cumpl == null) return 'sd';
    if (p.cumpl < 0.5 || (p.nota != null && p.nota < 2)) return 'cr';
    if (p.kpis.some(function (k) { return k.estado === 'ok' && k.nivel < 3; })) return 'des';
    return 'ok';
  }
  var ETQ = { ok: '<span class="est e-ok">✅ Al día</span>', des: '<span class="est e-des">🟠 En desfase</span>', cr: '<span class="est e-cr">🔴 Crítico</span>', sd: '<span class="est e-sd">— Sin datos</span>' };
  function equipoPorKpi(P) {
    var o = {};
    P.forEach(function (p) { p.kpis.forEach(function (k) {
      if (k.estado !== 'ok' || k.codigo === 'K4' || !k.den) return;
      var x = o[k.codigo] = o[k.codigo] || { num: 0, den: 0, personas: 0, enMeta: 0, corto: k.corto, meta: k.meta };
      x.num += k.num; x.den += k.den; x.personas++; if (k.nivel >= 3) x.enMeta++;
    }); });
    Object.keys(o).forEach(function (c) { o[c].pct = o[c].den ? o[c].num / o[c].den : null; });
    return o;
  }
  function plan(p) {
    var acc = [];
    p.kpis.forEach(function (k) {
      if (k.estado !== 'ok' || k.nivel >= 3) return;
      var no = (k.evidencia || []).filter(function (e) { return e.ok === false; });
      var ej = no.slice(0, 3).map(function (e) { return esc(e.ref) + (e.fecha ? ' (' + dmy(e.fecha) + ')' : ''); }).join('; ');
      var base = '<b>' + esc(k.corto) + '</b>: ' + p100(k.pct) + ' (' + k.num + ' de ' + k.den + ', meta ' + Math.round(k.meta * 100) + '%)' + (ej ? ' — ej.: ' + ej : '');
      var q = [];
      if (k.codigo === 'K1') q = ['Revisar juntos, cada semana, los casos abiertos y su día 5.', 'Aviso preventivo el día 3: el sistema ya avisa el día 4; acordar subir el informe antes.', 'Si la demora es por la redacción, usar la plantilla de informe y pedir revisión temprana.'];
      else if (k.codigo === 'K2' || k.codigo === 'A1') q = ['Registrar cada atención el mismo día antes de las 16:36.', 'Conversar la causa: conectividad o acceso en campo, carga de trabajo, horario de salida.', 'Si el trabajo de campo termina tarde, organizar un bloque de registro antes del cierre.'];
      else if (k.codigo === 'K3') q = ['Revisar el calendario ETI cada lunes y confirmar fechas con el administrador del fundo.', 'Registrar la ejecución en ETI el mismo día.', 'Si no se puede realizar, usar "📝 No se realizó" ANTES de que venza para pedir reprogramación.'];
      acc.push('<li>' + base + '<ul>' + q.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></li>');
    });
    var fuera = p.kpis.reduce(function (s, k) { return s + (k.fuera_horario || 0); }, 0);
    if (fuera) acc.push('<li><b>Registros fuera de horario:</b> ' + fuera + ' atención(es) registradas después de las 16:36. Por ahora no cuentan; revisar el hábito de registro.</li>');
    return acc;
  }

  /* ── ESTADISTICAS ── */
  function grafico(id, cfg) {
    if (typeof Chart === 'undefined') { $(id).parentNode.innerHTML = '<div class="sub">No se pudo cargar la librería de gráficos (revisa tu internet).</div>'; return; }
    if (CH[id]) CH[id].destroy();
    CH[id] = new Chart($(id), cfg);
  }
  var baseOpc = { responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { boxWidth: 12, font: { family: 'Barlow', size: 12 } } }, tooltip: { mode: 'nearest', intersect: false } } };

  window._kpiStatsPintar = function () {
    var D = K.D(); if (!D) return;
    var P = D.personas || [];
    var EQ = equipoPorKpi(P);
    var cl = { ok: 0, des: 0, cr: 0, sd: 0 }; P.forEach(function (p) { cl[clasif(p)]++; });
    var conC = P.filter(function (p) { return p.cumpl != null; });
    var prom = conC.length ? conC.reduce(function (s, p) { return s + p.cumpl; }, 0) / conC.length : null;
    $('stResumen').innerHTML =
      '<div class="kc"><div class="v">' + p100(prom) + '</div><div class="l">Cumplimiento promedio del equipo</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n3)">' + cl.ok + '</div><div class="l">✅ Al día</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n2)">' + cl.des + '</div><div class="l">🟠 En desfase</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n1)">' + cl.cr + '</div><div class="l">🔴 Críticos</div></div>';
    /* radar */
    var sel = $('stRadarSel'), prev = sel.value;
    sel.innerHTML = '<option value="">Equipo completo</option>' + P.map(function (p) { return '<option value="' + esc(p.usuario) + '">' + esc(p.nombre) + '</option>'; }).join('');
    sel.value = prev; sel.onchange = radar;
    radar();
    function radar() {
      var u = sel.value, codes = ['K1', 'K2', 'K3', 'A1'], vals;
      if (!u) vals = codes.map(function (c) { return EQ[c] && EQ[c].pct != null ? Math.round(EQ[c].pct * 1000) / 10 : null; });
      else { var pp = P.filter(function (x) { return x.usuario === u; })[0]; vals = codes.map(function (c) { var k = (pp.kpis || []).filter(function (x) { return x.codigo === c; })[0]; return k && k.estado === 'ok' && k.den ? Math.round(k.num / k.den * 1000) / 10 : null; }); }
      var CORTO = { K1: 'Conflictos', K2: 'Gestión doc.', K3: 'Capacitaciones', A1: 'Registro (asist.)' };
      grafico('cRadar', { type: 'radar', data: { labels: codes.map(function (c) { return CORTO[c]; }),
        datasets: [{ label: u ? 'Persona' : 'Equipo', data: vals, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,.15)', borderWidth: 2, pointRadius: 4, spanGaps: true },
                   { label: 'Meta', data: codes.map(function (c) { return META[c] * 100; }), borderColor: '#64748b', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false }] },
        options: Object.assign({}, baseOpc, { scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent' }, pointLabels: { font: { family: 'Barlow', size: 11.5, weight: '700' } } } } }) });
    }
    /* sectores */
    var S = {};
    P.forEach(function (p) { if (p.cumpl == null) return; (p.sectores || ['SIN SECTOR']).forEach(function (s) { S[s] = S[s] || []; S[s].push(p.cumpl); }); });
    var sk = Object.keys(S).sort(function (a, b) { return avg(S[b]) - avg(S[a]); });
    function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
    grafico('cSector', { type: 'bar', data: { labels: sk.map(function (s) { return s.replace(/^SECTOR /, ''); }),
      datasets: [{ label: '% de cumplimiento', data: sk.map(function (s) { return Math.round(avg(S[s]) * 1000) / 10; }), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 26 }] },
      options: Object.assign({}, baseOpc, { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + '%'; } } } },
        scales: { x: { min: 0, max: 100, grid: { color: '#eef2f7' } }, y: { grid: { display: false } } } }) });
    /* distribucion */
    var B = [['100%', 1, 1.01, '#1d4ed8'], ['90–99%', 0.9, 1, '#0d9488'], ['70–89%', 0.7, 0.9, '#d97706'], ['50–69%', 0.5, 0.7, '#ea580c'], ['< 50%', -1, 0.5, '#dc2626']];
    grafico('cDist', { type: 'bar', data: { labels: B.map(function (b) { return b[0]; }),
      datasets: [{ label: 'Personas', data: B.map(function (b) { return conC.filter(function (p) { return p.cumpl >= b[1] && p.cumpl < b[2]; }).length; }), backgroundColor: B.map(function (b) { return b[3]; }), borderRadius: 4, maxBarThickness: 48 }] },
      options: Object.assign({}, baseOpc, { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: function (c) { var b = B[c.dataIndex]; return conC.filter(function (p) { return p.cumpl >= b[1] && p.cumpl < b[2]; }).map(function (p) { return p.nombre; }).join('\n'); } } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef2f7' } }, x: { grid: { display: false } } } }) });
    /* serie diaria */
    var R = D.rango || {}, hasta = R.hasta > D.hoy ? D.hoy : R.hasta, key = R.desde + '|' + hasta;
    if (SERIE && SERIE_KEY === key) pintarSerie(SERIE);
    else K.prog(['Cargando la evolución diaria…', 'Estadísticas listas', 'No se pudo cargar la evolución diaria'], function () {
      return K.api('serie', { desde: R.desde, hasta: hasta }).then(function (j) { if (!j || !j.success) throw new Error((j && j.error) || 'Sin respuesta'); SERIE = j.serie; SERIE_KEY = key; pintarSerie(SERIE); });
    }).catch(function () {});
    /* ranking + plan */
    var orden = P.slice().sort(function (a, b) { return (a.cumpl == null ? 9 : a.cumpl) - (b.cumpl == null ? 9 : b.cumpl); });
    $('stRank').innerHTML = '<tr><th>Persona</th><th>Sector(es)</th><th class="c">% cumplimiento</th><th class="c">Nota (1–5)</th><th>Estado</th><th>KPIs bajo la meta</th></tr>' + orden.map(function (p) {
      var bajo = p.kpis.filter(function (k) { return k.estado === 'ok' && k.nivel < 3; }).map(function (k) { return esc(k.corto) + ' ' + p100(k.pct); }).join(' · ');
      return '<tr><td><b>' + esc(p.nombre) + '</b></td><td>' + esc((p.sectores || []).join(', ').replace(/SECTOR /g, '')) + '</td><td class="c"><b>' + p100(p.cumpl) + '</b></td><td class="c">' + (p.nota == null ? '—' : p.nota.toFixed(2)) + '</td><td>' + ETQ[clasif(p)] + '</td><td>' + (bajo || '—') + '</td></tr>';
    }).join('');
    var planes = orden.filter(function (p) { var c = clasif(p); return c === 'cr' || c === 'des'; });
    $('stPlan').innerHTML = planes.length ? planes.map(function (p) {
      var c = clasif(p);
      return '<div class="pa' + (c === 'cr' ? ' cr' : '') + '"><b class="t">' + esc(p.nombre) + '</b> · ' + ETQ[c] + ' · cumplimiento ' + p100(p.cumpl) +
        '<ul>' + plan(p).join('') + '<li><b>Seguimiento:</b> conversación 1 a 1 de 15 minutos esta semana para entender la causa y acordar compromisos; revisar el avance en 7 días en este mismo tablero.</li></ul></div>';
    }).join('') : '<div class="sub">✅ Nadie en desfase en este rango.</div>';
  };
  function pintarSerie(S) {
    var codes = ['K1', 'K2', 'K3', 'A1'].filter(function (c) { return S.some(function (d) { return d.equipo[c]; }); });
    grafico('cSerie', { type: 'line', data: { labels: S.map(function (d) { return dmy(d.fecha).slice(0, 5); }),
      datasets: codes.map(function (c) { return { label: NOMK[c], data: S.map(function (d) { var e = d.equipo[c]; return e && e.den ? Math.round(e.num / e.den * 1000) / 10 : null; }),
        borderColor: SER[c], backgroundColor: SER[c], borderWidth: 2, pointRadius: 3, spanGaps: false, tension: 0 }; }) },
      options: Object.assign({}, baseOpc, { interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { boxWidth: 12, font: { family: 'Barlow', size: 12 } } }, tooltip: { callbacks: { label: function (c) { var e = S[c.dataIndex].equipo[codes[c.datasetIndex]]; return c.dataset.label + ': ' + c.parsed.y + '% (' + e.num + '/' + e.den + ')'; } } } },
        scales: { y: { min: 0, max: 100, grid: { color: '#eef2f7' } }, x: { grid: { display: false } } } }) });
  }

  /* ── INFORME MENSUAL ── */
  window._kpiInfPrep = function () {
    var D = K.D(); if (!D) return;
    var h = hoyL(), cie = D.cierres || [], sel = $('infMes'), prev = sel.value, ops = [];
    var ini = (D.periodo && D.periodo.ini || '2026-09-01').slice(0, 7);
    for (var y = +ini.slice(0, 4), m = +ini.slice(5, 7); (y + '-' + ('0' + m).slice(-2)) <= h.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
      var mes = y + '-' + ('0' + m).slice(-2), c = cie.filter(function (x) { return x.mes === mes; })[0];
      ops.push('<option value="' + mes + '">' + MESES[m - 1] + ' ' + y + (c ? ' · 🔒 cerrado' : (mes === h.slice(0, 7) ? ' · en curso (avance)' : ' · por cerrar')) + '</option>');
    }
    sel.innerHTML = ops.join(''); if (prev) sel.value = prev; if (!sel.value && ops.length) sel.selectedIndex = ops.length - 1;
    function estadoBtn() {
      var mes = sel.value, c = cie.filter(function (x) { return x.mes === mes; })[0];
      var terminado = finMes(+mes.slice(0, 4), +mes.slice(5, 7)) < h;
      $('infCerrar').style.display = (D.puedeEditar && terminado && !c) ? '' : 'none';
      $('infNota').textContent = c ? 'Cerrado el ' + new Date(c.cerrado + (/Z$/.test(c.cerrado) ? '' : 'Z')).toLocaleString('es-PE') + ' por ' + c.cerrado_por + ' · foto congelada' :
        (terminado ? 'Mes terminado: se cierra solo a las 00:05 del día 1 (o ciérralo ahora).' : 'Mes en curso: el informe muestra el AVANCE a hoy.');
    }
    sel.onchange = estadoBtn; estadoBtn();
    $('infVer').onclick = function () { verInforme(); };
    $('infCerrar').onclick = async function () {
      var b = this; b.disabled = true; b.textContent = '⏳ Cerrando…';
      try {
        await K.prog(['Cerrando el mes ' + sel.value + '…', 'Mes cerrado y congelado', 'No se pudo cerrar el mes'], async function () { var j = await K.api('cerrarMes', { mes: sel.value }); if (!j.success) throw new Error(j.error); await K.cargar(); });
        window._kpiInfPrep(); verInforme(); K.aviso('🔒 Mes ' + sel.value + ' cerrado.');
      }
      catch (e) { K.aviso('⚠️ ' + esc(e.message), 'av-e'); }
      b.disabled = false; b.textContent = '🔒 Cerrar el mes';
    };
  };
  async function verInforme() {
    var mes = $('infMes').value, D = K.D(), c = (D.cierres || []).filter(function (x) { return x.mes === mes; })[0];
    $('infCuerpo').innerHTML = '<div class="sub">⏳ Preparando el informe…</div>';
    try { await K.prog(['Preparando el informe…', 'Informe listo', 'No se pudo preparar el informe'], async function () {
      var R;
      if (c) { R = await K.api('informe', { mes: mes }); if (!R.success) throw new Error(R.error); }
      else {
        var y = +mes.slice(0, 4), m = +mes.slice(5, 7), des = mes + '-01', has = finMes(y, m);
        var t = await K.api('tablero', { desde: des, hasta: has }); if (!t.success) throw new Error(t.error);
        var s = await K.api('serie', { desde: des, hasta: has > D.hoy ? D.hoy : has });
        R = t; R.serie = s && s.success ? s.serie : []; R.avance = true;
      }
      $('infCuerpo').innerHTML = informeHtml(R, mes);
      var S = R.serie || [];
      if (S.length && typeof Chart !== 'undefined') {
        var codes = ['K1', 'K2', 'K3', 'A1'].filter(function (cc) { return S.some(function (d) { return d.equipo[cc]; }); });
        if (CH.cInf) CH.cInf.destroy();
        CH.cInf = new Chart($('cInf'), { type: 'line', data: { labels: S.map(function (d) { return dmy(d.fecha).slice(0, 5); }),
          datasets: codes.map(function (cc) { return { label: NOMK[cc], data: S.map(function (d) { var e = d.equipo[cc]; return e && e.den ? Math.round(e.num / e.den * 1000) / 10 : null; }), borderColor: SER[cc], backgroundColor: SER[cc], borderWidth: 2, pointRadius: 2.5 }; }) },
          options: Object.assign({}, baseOpc, { scales: { y: { min: 0, max: 100 } } }) });
      }
    }); } catch (e) { $('infCuerpo').innerHTML = '<div class="aviso av-e">⚠️ ' + esc(e.message) + '</div>'; }
  }

  function informeHtml(R, mes) {
    var P = R.personas || [], EQ = equipoPorKpi(P), y = +mes.slice(0, 4), m = +mes.slice(5, 7);
    var conC = P.filter(function (p) { return p.cumpl != null; }), conN = P.filter(function (p) { return p.nota != null; });
    var cumplEq = conC.length ? conC.reduce(function (s, p) { return s + p.cumpl; }, 0) / conC.length : null;
    var notaEq = conN.length ? conN.reduce(function (s, p) { return s + p.nota; }, 0) / conN.length : null;
    var cl = { ok: [], des: [], cr: [], sd: [] }; P.forEach(function (p) { cl[clasif(p)].push(p); });
    var codes = ['K1', 'K2', 'K3', 'A1'].filter(function (c) { return EQ[c]; });
    var peor = codes.slice().sort(function (a, b) { return EQ[a].pct - EQ[b].pct; })[0];
    var fuera = 0, sinHora = 0, sinFecha = 0, ausentes = 0;
    P.forEach(function (p) { p.kpis.forEach(function (k) { fuera += k.fuera_horario || 0; (k.evidencia || []).forEach(function (e) {
      if (/sin hora de registro/i.test(e.ref || '')) sinHora += parseInt(e.detalle, 10) || 0;
      if (/no se puede verificar/i.test(e.detalle || '')) sinFecha++;
      if (/durante su ausencia/i.test(e.detalle || '')) ausentes++; }); }); });
    var titulo = (R.avance ? 'INFORME DE AVANCE' : 'INFORME DE CIERRE MENSUAL') + ' — ' + MESES[m - 1].toUpperCase() + ' ' + y;
    var h = '<div class="portada"><h2 style="font-size:22px">🎯 KPIs RELACIONES LABORALES · ' + titulo + '</h2>' +
      '<div class="sub">Unifrutti Perú (VERFRUT S.A.C. / RAPEL S.A.C.) · Evaluador: Joel Timoteo, Coordinador de RR.LL. · Periodo evaluado: ' + dmy(R.rango.desde) + ' al ' + dmy(R.rango.hasta > R.hoy ? R.hoy : R.rango.hasta) +
      ' · Corte: ' + dmy(R.hoy) + (R.cerrado ? ' · 🔒 Cerrado el ' + new Date(R.cerrado + (/Z$/.test(R.cerrado) ? '' : 'Z')).toLocaleString('es-PE') + ' (' + esc(R.cerrado_por) + '), no se modifica' : ' · Avance a la fecha, aún puede cambiar') + '</div></div>';
    /* 1 resumen */
    h += '<h3>1. Resumen ejecutivo</h3><div class="kpis">' +
      '<div class="kc"><div class="v">' + p100(cumplEq) + '</div><div class="l">Cumplimiento promedio del equipo</div></div>' +
      '<div class="kc"><div class="v" style="color:' + K.colorNota(notaEq) + '">' + (notaEq == null ? '—' : notaEq.toFixed(2)) + '</div><div class="l">Nota promedio (1 a 5)</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n3)">' + cl.ok.length + '</div><div class="l">✅ Al día</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n2)">' + cl.des.length + '</div><div class="l">🟠 En desfase</div></div>' +
      '<div class="kc"><div class="v" style="color:var(--n1)">' + cl.cr.length + '</div><div class="l">🔴 Críticos</div></div></div>';
    var hall = [];
    if (peor) hall.push('El KPI con menor cumplimiento del equipo es <b>' + esc(EQ[peor].corto) + '</b> (' + p100(EQ[peor].pct) + ' frente a una meta de ' + Math.round(EQ[peor].meta * 100) + '%); lo cumplen ' + EQ[peor].enMeta + ' de ' + EQ[peor].personas + ' personas.');
    if (cl.cr.length) hall.push('Requieren atención prioritaria: ' + cl.cr.map(function (p) { return '<b>' + esc(p.nombre) + '</b> (' + p100(p.cumpl) + ')'; }).join(', ') + '.');
    if (cl.ok.length) hall.push('Cumplen todas sus metas: ' + cl.ok.map(function (p) { return esc(p.nombre); }).join(', ') + '.');
    if (fuera) hall.push(fuera + ' atención(es) se registraron el mismo día pero después de las 16:36 (fuera de horario): no se contaron y quedan para evaluación.');
    h += '<p>' + hall.join('</p><p>') + '</p>';
    /* 2 por KPI */
    h += '<h3>2. Resultado por KPI (equipo)</h3><div class="tw"><table class="src"><tr><th>KPI</th><th class="c">Meta</th><th class="c">Cumplen / total</th><th class="c">% equipo</th><th class="c">Personas en meta</th></tr>' +
      codes.map(function (c) { var e = EQ[c]; return '<tr><td><b>' + esc(e.corto) + '</b></td><td class="c">' + Math.round(e.meta * 100) + '%</td><td class="c">' + e.num + ' / ' + e.den + '</td><td class="c"><b>' + p100(e.pct) + '</b></td><td class="c">' + e.enMeta + ' de ' + e.personas + '</td></tr>'; }).join('') +
      '</table></div><div class="sub">Curso de Legislación Laboral: se evalúa en diciembre. Asistente: remisión y asistencia a capacitaciones aún sin datos; consultas atendidas en evaluación.</div>';
    /* 3 ranking */
    var orden = P.slice().sort(function (a, b) { return (b.cumpl == null ? -1 : b.cumpl) - (a.cumpl == null ? -1 : a.cumpl); });
    h += '<h3>3. Semáforo por persona</h3><div class="tw"><table class="src"><tr><th>#</th><th>Persona</th><th>Sector(es)</th>' + ['K1', 'K2', 'K3'].map(function (c) { return '<th class="c">' + esc(NOMK[c]) + '</th>'; }).join('') + '<th class="c">% cumpl.</th><th class="c">Nota</th><th>Estado</th></tr>' +
      orden.map(function (p, i) {
        var celda = function (c) { var k = p.kpis.filter(function (x) { return x.codigo === c; })[0] || (c === 'K2' ? p.kpis.filter(function (x) { return x.codigo === 'A1'; })[0] : null); return '<td class="c">' + (k && k.estado === 'ok' ? p100(k.pct) + ' <small>(' + k.num + '/' + k.den + ')</small>' : '—') + '</td>'; };
        return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p.nombre) + '</b><div class="sub">' + esc(p.puesto) + '</div></td><td>' + esc((p.sectores || []).join(', ').replace(/SECTOR /g, '')) + '</td>' + celda('K1') + celda('K2') + celda('K3') +
          '<td class="c"><b>' + p100(p.cumpl) + '</b></td><td class="c">' + (p.nota == null ? '—' : p.nota.toFixed(2)) + '</td><td>' + ETQ[clasif(p)] + '</td></tr>';
      }).join('') + '</table></div><div class="sub">Para la asistente, la columna "Gestión documentaria" muestra su KPI de registro el mismo día.</div>';
    /* 4 evolucion */
    h += '<h3>4. Evolución diaria del equipo</h3><div class="cv"><canvas id="cInf"></canvas></div>';
    /* 5 criticos y desfase */
    var atn = cl.cr.concat(cl.des);
    h += '<h3 class="salto">5. Críticos y en desfase: qué pasó</h3>' + (atn.length ? atn.map(function (p) {
      var det = p.kpis.filter(function (k) { return k.estado === 'ok' && k.nivel < 3; }).map(function (k) {
        var no = (k.evidencia || []).filter(function (e) { return e.ok === false; });
        return '<li><b>' + esc(k.corto) + '</b>: ' + p100(k.pct) + ' (' + k.num + ' de ' + k.den + '). ' + no.length + ' registro(s) incumplidos' + (no.length ? ', por ejemplo:<ul>' + no.slice(0, 4).map(function (e) { return '<li>' + esc(e.ref) + ' — ' + esc(e.detalle) + '</li>'; }).join('') + '</ul>' : '.') + '</li>';
      }).join('');
      return '<div class="pa' + (clasif(p) === 'cr' ? ' cr' : '') + '"><b class="t">' + esc(p.nombre) + '</b> · ' + ETQ[clasif(p)] + ' · ' + p100(p.cumpl) + '<ul>' + det + '</ul></div>';
    }).join('') : '<p>✅ Nadie en desfase este mes.</p>');
    /* 6 plan de accion */
    h += '<h3>6. Plan de acción (mejora continua, no sanción)</h3>' + (atn.length ? '<div class="tw"><table class="src"><tr><th>Persona</th><th>Acciones acordadas</th><th>Responsables</th><th>Seguimiento</th></tr>' +
      atn.map(function (p) { return '<tr><td><b>' + esc(p.nombre) + '</b></td><td><ul style="margin-left:16px">' + plan(p).join('') + '</ul></td><td>' + esc(p.nombre) + ' y Coordinación de RR.LL.</td><td>1 a 1 esta semana; revisión en 7 días en el tablero de KPIs.</td></tr>'; }).join('') +
      '</table></div>' : '<p>Mantener el seguimiento semanal.</p>');
    /* 7 calidad de datos */
    h += '<h3>7. Calidad de datos y temas en evaluación</h3><ul class="q">' +
      '<li>Registros <b>fuera de horario</b> (mismo día, después de 16:36): <b>' + fuera + '</b> — no suman ni restan; en evaluación.</li>' +
      '<li>Atenciones sin hora de registro guardada: <b>' + sinHora + '</b> — no cuentan.</li>' +
      '<li>Informes de caso sin fecha verificable (subidos antes del registro automático): <b>' + sinFecha + '</b> — no cuentan.</li>' +
      '<li>Casos atendidos por reemplazo durante ausencias: <b>' + ausentes + '</b> — no cuentan para el titular.</li>' +
      '<li>Asistente: "Remisión el mismo día" y "Asistencia a capacitaciones" aún sin datos en el sistema; "Consultas atendidas" en evaluación.</li>' +
      '<li>Enlace de usuarios: ' + P.filter(function (p) { return p.enlace && (!p.enlace.rrll || (p.enlace.aplica_eti && !(p.enlace.eti_sectores || []).length)); }).length + ' persona(s) con enlace incompleto.</li></ul>';
    h += '<p class="sub" style="margin-top:14px">Generado automáticamente por el Sistema RR.LL. a partir de Casos, Mis Atenciones, historial de Cumplimiento y la programación de Capacitaciones ETI / Evaluaciones ETI. Cada número tiene su evidencia en el módulo KPIs RR.LL.' + (R.cerrado ? ' Este cierre es inmutable.' : '') + '</p>';
    return h;
  }
})();
