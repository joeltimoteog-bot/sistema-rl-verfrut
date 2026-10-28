/* ═══════════════════════════════════════════════════════════════════════════
   e360-pdf-v1.js — _E360_PDF_V1 (27-oct-2026) · Informe Integral de Desempeño (PDF) moderno
   Reemplaza el diseño del PDF (mismos datos del informe + evidencia de KPIs del mes):
   cabecera, ficha, calificación global, barras por competencia, evidencia objetiva,
   fortalezas / oportunidades, feedback, plan de mejora, conclusión y CONFORMIDAD (firmas y descargos).
   Si algo falla al armarlo, usa el PDF anterior (no se pierde la funcion).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._E360_PDF_V1) return; window._E360_PDF_V1 = true;
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api';
  var NAVY = [11, 30, 69], AZUL = [37, 99, 235], GRIS = [100, 116, 139], TX = [15, 23, 42], LINEA = [226, 232, 240];
  function strip(h) { return String(h == null ? '' : h).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/≤/g, 'hasta ').replace(/≥/g, 'mín. ').replace(/[^\x00-\xFF•–—]/g, '').trim(); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function misma(a, b) { var A = norm(a).split(' ').filter(function (w) { return w.length > 2; }), B = ' ' + norm(b) + ' ', n = 0; A.forEach(function (w) { if (B.indexOf(' ' + w + ' ') >= 0) n++; }); return n >= 2; }
  function colNivel(p) { return p >= 85 ? [22, 163, 74] : p >= 70 ? [37, 99, 235] : p >= 55 ? [217, 119, 6] : [220, 38, 38]; }
  function post(ruta, cuerpo) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, 9000);
    return fetch(AZ + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(t); return r.ok ? r.json() : null; }).catch(function () { clearTimeout(t); return null; });
  }
  async function evidencia(sup, periodo) {
    var f = /^\d{4}-\d{2}/.test(String(periodo || '')) ? String(periodo).slice(0, 7) : new Date().toISOString().slice(0, 7);
    var y = +f.slice(0, 4), m = +f.slice(5, 7), ult = new Date(y, m, 0).getDate(), hoy = new Date().toISOString().slice(0, 10);
    var hasta = f + '-' + ('0' + ult).slice(-2); if (hasta > hoy) hasta = hoy;
    var kp = await post('/kpi/tablero', { desde: f + '-01', hasta: hasta });
    var per = kp && kp.personas ? kp.personas.filter(function (p) { return misma(sup, p.nombre); })[0] : null;
    return per ? (per.kpis || []).filter(function (k) { return k.estado === 'ok' && k.den; }) : [];
  }

  async function exportarModerno() {
    var I = typeof _infInformeTxt !== 'undefined' ? _infInformeTxt : null; if (!I) return;
    var D = typeof _infDatos !== 'undefined' ? _infDatos : null;
    var comps = D && D.ev && D.ev.competencias ? D.ev.competencias.map(function (c) { return { n: c.nombre, p: Number(c.promedio) || 0 }; }) : [];
    var evaluador = (D && D.ev && (D.ev.evaluador || D.ev.evaluadorUser)) || (typeof USER !== 'undefined' && USER ? USER.nombre || USER.usuario : '');
    var kpis = await evidencia(I.sup, I.periodo);
    var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var W = 210, H = 297, MG = 14, bW = W - 2 * MG, y = 0;
    var salto = function (need) { if (y + need > H - 18) { doc.addPage(); y = 16; } };
    var seccion = function (n, t) {
      salto(14); doc.setFillColor.apply(doc, AZUL); doc.roundedRect(MG, y, 7, 7, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.text(String(n), MG + 3.5, y + 4.9, { align: 'center' });
      doc.setFontSize(11.5); doc.setTextColor.apply(doc, NAVY); doc.text(t, MG + 10, y + 5.2); y += 11;
    };
    var parrafo = function (t, opt) {
      opt = opt || {}; doc.setFont('helvetica', opt.bold ? 'bold' : 'normal'); doc.setFontSize(opt.size || 9.3); doc.setTextColor.apply(doc, opt.color || TX);
      var x = MG + (opt.indent || 0), lines = doc.splitTextToSize((opt.bullet ? '•  ' : '') + strip(t), bW - (opt.indent || 0));
      lines.forEach(function (l, i) { salto(5); doc.text(l, x + (opt.bullet && i ? 3.2 : 0), y); y += 4.4; }); y += (opt.after == null ? 1.6 : opt.after);
    };

    /* ── cabecera ── */
    doc.setFillColor.apply(doc, NAVY); doc.rect(0, 0, W, 34, 'F');
    doc.setFillColor(220, 38, 38); doc.rect(0, 34, W, 1.2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(8.5);
    doc.text('UNIFRUTTI PERÚ  ·  COORDINACIÓN DE RELACIONES LABORALES', MG, 11);
    doc.setFontSize(17); doc.text('Informe de Desempeño y Feedback 360°', MG, 21);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(203, 213, 225);
    doc.text('Documento confidencial · uso exclusivo del evaluado y la Coordinación', MG, 28);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text('Periodo ' + (I.periodo || '-'), W - MG, 21, { align: 'right' });
    y = 43;

    /* ── ficha + calificacion ── */
    doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(248, 250, 252); doc.roundedRect(MG, y, bW * 0.62, 30, 3, 3, 'FD');
    var fx = MG + 5, fy = y + 7;
    [['Evaluado', I.sup], ['Evaluador', evaluador || '-'], ['Fecha de emisión', new Date().toLocaleDateString('es-PE')]].forEach(function (r, i) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS); doc.text(r[0].toUpperCase(), fx, fy + i * 8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, TX); doc.text(doc.splitTextToSize(strip(r[1]), bW * 0.62 - 12)[0], fx, fy + 3.8 + i * 8);
    });
    var gx = MG + bW * 0.62 + 4, gw = bW * 0.38 - 4, c = colNivel(Number(I.global) || 0);
    doc.setFillColor.apply(doc, c); doc.roundedRect(gx, y, gw, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('CALIFICACIÓN GLOBAL', gx + gw / 2, y + 7, { align: 'center' });
    doc.setFontSize(24); doc.text(String(I.global) + '/100', gx + gw / 2, y + 18, { align: 'center' });
    doc.setFontSize(10); doc.text(String(I.nivel || '').toUpperCase(), gx + gw / 2, y + 25.5, { align: 'center' });
    y += 36;
    if (I.datosLinea) parrafo(I.datosLinea, { size: 8.3, color: GRIS, after: 3 });

    /* ── 1. competencias ── */
    if (comps.length) {
      seccion(1, 'Resultado por competencia (Evaluación 360°)');
      comps.forEach(function (k) {
        salto(9); var pct = Math.max(0, Math.min(1, k.p / 5));
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, TX); doc.text(strip(k.n), MG, y + 3.5);
        var bx = MG + 78, bwid = bW - 78 - 18;
        doc.setFillColor(241, 245, 249); doc.roundedRect(bx, y, bwid, 4.6, 2.3, 2.3, 'F');
        doc.setFillColor.apply(doc, colNivel(pct * 100)); if (pct > 0) doc.roundedRect(bx, y, Math.max(4.6, bwid * pct), 4.6, 2.3, 2.3, 'F');
        doc.setFont('helvetica', 'bold'); doc.text(k.p.toFixed(2) + ' / 5', W - MG, y + 3.6, { align: 'right' });
        y += 7.5;
      });
      y += 2;
    }
    /* ── 2. evidencia objetiva ── */
    var n = comps.length ? 2 : 1;
    if (kpis.length) {
      seccion(n++, 'Evidencia objetiva del mes (indicadores)');
      doc.autoTable({ startY: y, margin: { left: MG, right: MG }, theme: 'plain',
        head: [['Indicador', 'Resultado', 'Detalle']],
        body: kpis.map(function (k) { var p = Math.round(k.num / k.den * 100); return [k.codigo + ' · ' + strip(k.corto), p + '%', k.num + ' de ' + k.den + ' ' + strip(k.unidad || '')]; }),
        headStyles: { fillColor: [241, 245, 249], textColor: GRIS, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 9, cellPadding: 2.2, textColor: TX, lineColor: LINEA, lineWidth: { bottom: 0.2 } },
        columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 26, fontStyle: 'bold', halign: 'center' } },
        didParseCell: function (h) { if (h.section === 'body' && h.column.index === 1) { var v = parseInt(h.cell.raw, 10); h.cell.styles.textColor = colNivel(v); } } });
      y = doc.lastAutoTable.finalY + 5;
    }
    /* ── fortalezas / oportunidades ── */
    seccion(n++, 'Fortalezas identificadas');
    (I.F || []).forEach(function (f) { parrafo(f, { bullet: true }); });
    seccion(n++, 'Oportunidades de mejora');
    (I.O || []).forEach(function (o) { parrafo((o.asp ? o.asp.charAt(0).toUpperCase() + o.asp.slice(1) + ': ' : '') + (o.det || ''), { bullet: true }); });
    if (I.percepTxt || I.admBloque) { seccion(n++, 'Percepción del administrador de fundo'); parrafo('Percepción general: ' + (I.percepTxt || '-') + '. ' + (I.admBloque || '')); }
    if (I.consist) { seccion(n++, 'Análisis de consistencia'); parrafo(I.consist); }
    seccion(n++, 'Feedback personalizado');
    (I.FB || []).forEach(function (f) { parrafo(f, { bullet: true }); });
    if (I.plan && I.plan.length) {
      seccion(n++, 'Plan de mejora acordado');
      doc.autoTable({ startY: y, margin: { left: MG, right: MG }, theme: 'grid',
        head: [['Aspecto', 'Acción', 'Responsable', 'Plazo', 'Indicador']],
        body: I.plan.map(function (p) { return [strip(p.asp), strip(p.acc), strip(p.resp), strip(p.plazo), strip(p.ind)]; }),
        headStyles: { fillColor: NAVY, fontSize: 8, textColor: 255 }, styles: { fontSize: 8, cellPadding: 1.8, textColor: TX, lineColor: LINEA },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { cellWidth: 20 }, 4: { cellWidth: 36 } } });
      y = doc.lastAutoTable.finalY + 5;
    }
    seccion(n++, 'Conclusión');
    parrafo('Nivel de desempeño: ' + (I.nivel || '-') + ' (' + I.global + '/100). Recomendación: ' + (Number(I.global) >= 70 ? 'continuidad de la gestión con ejecución del plan de mejora.' : 'continuidad condicionada al cumplimiento del plan de mejora.'));

    /* ── conformidad ── */
    salto(66); y += 2;
    doc.setDrawColor.apply(doc, LINEA); doc.setFillColor(248, 250, 252); doc.roundedRect(MG, y, bW, 62, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor.apply(doc, NAVY); doc.text('Constancia de entrega del feedback', MG + 5, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor.apply(doc, GRIS);
    doc.text(doc.splitTextToSize('El evaluado declara haber recibido y conversado este informe. Su firma no implica conformidad con el resultado; puede dejar sus comentarios o descargos a continuación.', bW - 10), MG + 5, y + 12);
    doc.setTextColor.apply(doc, TX); doc.setFontSize(8.5); doc.text('Comentarios / descargos del evaluado:', MG + 5, y + 22);
    doc.setDrawColor(203, 213, 225); [27, 33, 39].forEach(function (d) { doc.line(MG + 5, y + d, MG + bW - 5, y + d); });
    var fy2 = y + 54, cw = (bW - 20) / 2;
    doc.line(MG + 5, fy2, MG + 5 + cw, fy2); doc.line(MG + 15 + cw, fy2, MG + 15 + 2 * cw, fy2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text(strip(evaluador || 'Evaluador'), MG + 5 + cw / 2, fy2 + 4, { align: 'center' }); doc.text(strip(I.sup), MG + 15 + cw * 1.5, fy2 + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRIS);
    doc.text('Evaluador · fecha', MG + 5 + cw / 2, fy2 + 7.5, { align: 'center' }); doc.text('Evaluado · fecha', MG + 15 + cw * 1.5, fy2 + 7.5, { align: 'center' });

    /* ── pie en todas las paginas ── */
    var tp = doc.getNumberOfPages();
    for (var i = 1; i <= tp; i++) {
      doc.setPage(i); doc.setDrawColor.apply(doc, LINEA); doc.line(MG, H - 12, W - MG, H - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3); doc.setTextColor.apply(doc, GRIS);
      doc.text('Confidencial · contiene datos personales (Ley 29733) · Sistema RR.LL. Unifrutti', MG, H - 7.5);
      doc.text('Página ' + i + ' de ' + tp, W - MG, H - 7.5, { align: 'right' });
    }
    doc.save('Informe_Desempeno_360_' + String(I.sup).replace(/\s+/g, '_') + '_' + (I.periodo || '') + '.pdf');
  }

  var anterior = window.exportarInformePDF;
  window.exportarInformePDF = function () {
    var self = this, args = arguments;
    return exportarModerno().catch(function (e) {
      console.warn('[_E360_PDF_V1] se usa el PDF anterior:', e && e.message);
      if (typeof anterior === 'function') return anterior.apply(self, args);
    });
  };
})();
