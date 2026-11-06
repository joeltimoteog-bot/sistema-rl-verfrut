/* ═══════════════════════════════════════════════════════════════════════════
   cap-informe.js — _CAP_INFORME_V1 (05-nov-2026)
   "INFORME DE CAPACITACIONES DE BUENAS PRÁCTICAS SOCIALES" (INF-SC-GH-03) de una capacitacion
   registrada en el Sistema RR.LL. (cualquier tema: ETI, reforzamiento, cambio de horario, etc.).
   Usa el MODELO OFICIAL como plantilla (plantillas/plantilla-informe-capacitacion.docx):
   encabezado, estilos, tablas y pie identicos; solo se reemplazan los datos y las fotos.
   La razon social cambia sola: RAPEL -> Sociedad Agricola Rapel · VERFRUT -> Sociedad Exportadora Verfrut.
   Requiere JSZip. Uso: capInformeWord(datos) -> Blob (navegador) / Buffer (Node).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var xe = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  function semanaISO(iso) { var d = new Date(iso + 'T12:00:00'), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  /* _CAP_INFORME_V2 (05-nov): un informe puede cubrir varias fechas (dia, fechas programadas, rango o general) */
  function fechasTxt(fs) {
    fs = (fs || []).slice().sort(); if (!fs.length) return '';
    if (fs.length === 1) return dmy(fs[0]);
    var mismoMes = fs.every(function (x) { return x.slice(0, 7) === fs[0].slice(0, 7); });
    if (mismoMes) { var ds = fs.map(function (x) { return x.slice(8, 10); }); return ds.slice(0, -1).join(', ') + ' y ' + ds[ds.length - 1] + '/' + fs[0].slice(5, 7) + '/' + fs[0].slice(0, 4); }
    var t = fs.map(dmy); return t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1];
  }
  function verif(t) { var h = 2166136261 >>> 0; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } var x = ('00000000' + h.toString(16).toUpperCase()).slice(-8); return x.slice(0, 4) + '-' + x.slice(4); }
  function dmy(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function razon(emp) {
    return String(emp || '').toUpperCase().indexOf('RAPEL') >= 0
      ? { head: 'SOCIEDAD AGRICOLA RAPEL S.A.C', body: 'Sociedad Agricola Rapel S.A.C.' }
      : { head: 'SOCIEDAD EXPORTADORA VERFRUT S.A.C', body: 'Sociedad Exportadora Verfrut S.A.C.' };
  }
  function parrafoCon(xml, token) {
    var i = xml.indexOf(token); if (i < 0) throw new Error('Plantilla: no se encontró ' + token);
    var a = xml.lastIndexOf('<w:p ', i), a2 = xml.lastIndexOf('<w:p>', i); a = Math.max(a, a2);
    var b = xml.indexOf('</w:p>', i) + 6; return { a: a, b: b, p: xml.slice(a, b) };
  }
  /* repite el parrafo del marcador una vez por item (lista con viñetas del modelo) */
  function lista(xml, token, items, separar) {
    var q = parrafoCon(xml, token), out = '';
    var vacio = q.p.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, '').replace(/<w:r[ >][\s\S]*?<\/w:r>/g, '');
    (items || []).filter(function (x) { return String(x || '').trim(); }).forEach(function (it, i) {
      if (i && separar) out += vacio;
      out += q.p.split(token).join(xe(String(it).trim()));
    });
    return xml.slice(0, q.a) + out + xml.slice(q.b);
  }
  /* foto recortada al tamaño de la casilla del modelo (como las fotos del informe original) */
  var BOXW = 2600000, BOXH = 2110000;
  function dibujo(rid, k, w, h) {
    var A = BOXW / BOXH, a = (w || 4) / (h || 3), l = 0, t = 0;
    if (a > A) l = Math.round((1 - A / a) / 2 * 100000); else t = Math.round((1 - a / A) / 2 * 100000);
    return '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + BOXW + '" cy="' + BOXH + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="' + (9200 + k) + '" name="Foto ' + k + '"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="' + (9200 + k) + '" name="foto_' + k + '.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/>' +
      '<a:srcRect l="' + l + '" t="' + t + '" r="' + l + '" b="' + t + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + BOXW + '" cy="' + BOXH + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
  }
  async function ponerFotos(zip, doc, fotos) {
    fotos = (fotos || []).filter(function (f) { return f && f.bytes; }).slice(0, 6);
    var i0 = doc.indexOf('{{FOTO1}}'), t0 = doc.lastIndexOf('<w:tbl>', i0), t1 = doc.indexOf('</w:tbl>', i0) + 8, tbl = doc.slice(t0, t1);
    if (fotos.length > 4) {   /* fila extra (Foto 5 / Foto 6) igual a las del modelo */
      var r0 = tbl.lastIndexOf('<w:tr '), r1 = tbl.lastIndexOf('</w:tr>') + 7;
      var fila = tbl.slice(r0, r1).replace('{{FOTO3}}', '{{FOTO5}}').replace('{{FOTO4}}', '{{FOTO6}}').replace(/w14:paraId="[0-9A-F]+"/g, '');
      tbl = tbl.slice(0, r1) + fila + tbl.slice(r1);
    }
    var rels = await zip.file('word/_rels/document.xml.rels').async('string'), ct = await zip.file('[Content_Types].xml').async('string');
    if (ct.indexOf('Extension="jpeg"') < 0) ct = ct.replace('<Default Extension="rels"', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="rels"');
    for (var k = 1; k <= 6; k++) {
      var tok = '<w:t>{{FOTO' + k + '}}</w:t>'; if (tbl.indexOf(tok) < 0) continue;
      var f = fotos[k - 1];
      if (!f) { tbl = tbl.split(tok).join('<w:t></w:t>'); continue; }
      var rid = 'rIdFotoCap' + k, nom = 'media/foto_cap_' + k + '.jpeg';
      zip.file('word/' + nom, f.bytes);
      rels = rels.replace('</Relationships>', '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + nom + '"/></Relationships>');
      var q = parrafoCon(tbl, tok), p = q.p.split(tok).join(dibujo(rid, k, f.w, f.h));
      p = p.indexOf('<w:pPr>') >= 0 ? p.replace('<w:pPr>', '<w:pPr><w:jc w:val="center"/>') : p.replace(/(<w:p[ >][^>]*>|<w:p>)/, '$1<w:pPr><w:jc w:val="center"/></w:pPr>');
      tbl = tbl.slice(0, q.a) + p + tbl.slice(q.b);
    }
    /* la casilla con foto queda solo con la foto (sin los renglones vacios del modelo), y las filas no se parten entre paginas */
    tbl = tbl.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, function (tc) {
      if (tc.indexOf('<w:drawing>') < 0) return tc;
      var pr = (tc.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0], ps = tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
      return '<w:tc>' + pr + ps.filter(function (p) { return p.indexOf('<w:drawing>') >= 0; }).join('') + '</w:tc>';
    });
    tbl = tbl.replace(/<w:trPr>/g, '<w:trPr><w:cantSplit/>');
    zip.file('word/_rels/document.xml.rels', rels); zip.file('[Content_Types].xml', ct);
    doc = doc.slice(0, t0) + tbl + doc.slice(t1);
    /* "IV. EVIDENCIA:" y el renglon siguiente viajan junto con la tabla de fotos */
    var e = doc.indexOf('EVIDENCIA'), ini = Math.max(doc.lastIndexOf('<w:p ', e), doc.lastIndexOf('<w:p>', e)), fin = doc.indexOf('<w:tbl>', e);
    if (e > 0 && ini > 0 && fin > e) {
      var seg = doc.slice(ini, fin).replace(/<w:pPr>/g, '<w:pPr><w:keepNext/>');
      doc = doc.slice(0, ini) + seg + doc.slice(fin);
    }
    return doc;
  }
  /* sugerencias de texto (todas se pueden cambiar en el formulario) */
  function esEtica(d) { return /\beti\b|[ée]tica|buenas pr[aá]cticas/i.test(String(d.tema || '') + ' ' + String(d.tipo || '')); }
  var TEMAS_ETI = ['Normas y certificaciones', 'Autodeclaración de buenas prácticas sociales.', 'Legislación Laboral y beneficios sociales.', 'Licencias remuneradas.',
    'Comité de Bienestar del Trabajador.', 'Procedimiento de Atención de Sugerencias y/o Quejas.', 'Procedimiento de Prevención y Sanción al Hostigamiento Sexual.', 'Código de Conducta.',
    'Seguridad alimentaria.', 'Seguridad y Salud en el Trabajo.', 'Sustentabilidad: Medio Ambiente, Responsabilidad Social, Objetivos de desarrollo sostenible.',
    'Principios de Smart Planet.', 'Capacitación de ética empresarial y modelo de prevención de delitos.'];
  function sugerencias(d) {
    var eti = esEtica(d), n = Number(d.n) || 0;
    return {
      objetivo: eti ? 'Reforzar a los colaboradores de la empresa sobre las normas, procedimientos, políticas y deberes que deben cumplirse dentro y fuera de la empresa, así como aquellos canales de comunicación a los que tienen acceso.'
        : 'Informar y capacitar a los colaboradores de la empresa sobre: ' + String(d.tema || '').replace(/\.$/, '') + ', asegurando su adecuada comprensión y cumplimiento.',
      temas: eti ? TEMAS_ETI.slice() : [String(d.tema || '').trim()],
      conclusiones: [
        'Se reforzó en los colaboradores el conocimiento sobre ' + String(d.tema || 'el tema expuesto').replace(/\.$/, '').replace(/^./, function (c) { return c.toLowerCase(); }) + ', promoviendo su adecuada aplicación y comunicación oportuna.',
        'Se capacitó a un total de ' + n + ' colaboradores, fortaleciendo sus conocimientos sobre las normas, políticas, procedimientos y buenas prácticas que contribuyen a mantener un adecuado ambiente laboral y de convivencia.'
      ],
      adjuntos: eti ? ['Registro de asistencia.', 'CAP-SC-10. CAPACITACIÓN DE ÉTICA SOCIAL Y SUSTENTABILIDAD (generalidades).', 'CAP-SC-13 CAPACITACIÓN DE ÉTICA EMPRESARIAL Y MODELO DE PREVENCIÓN DE DELITOS.']
        : ['Registro de asistencia.']
    };
  }
  /* "ZAPATA SUAREZ ALEX FABIAN" -> "Alex Fabian Zapata Suarez" */
  function nombrePropio(n) {
    var w = String(n || '').trim().split(/\s+/).filter(Boolean), tc = function (x) { return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(); };
    if (w.length === 4) w = [w[2], w[3], w[0], w[1]]; else if (w.length === 3) w = [w[2], w[0], w[1]];
    return w.map(tc).join(' ');
  }

  async function capInformeWord(d) {
    var JZ = (typeof JSZip !== 'undefined') ? JSZip : (typeof require === 'function' ? require('jszip') : null);
    if (!JZ) throw new Error('Librería JSZip no cargada');
    var zip = await JZ.loadAsync(d.plantilla);
    var doc = await zip.file('word/document.xml').async('string'), hdr = await zip.file('word/header1.xml').async('string');
    var rz = razon(d.emp), sg = sugerencias(d), fi = d.fechaInforme;
    var fs = (Array.isArray(d.fechas) && d.fechas.length ? d.fechas : [d.fecha]).filter(Boolean).slice().sort(), fc = fs[fs.length - 1];
    var semanas = []; fs.forEach(function (x) { var w = p2(semanaISO(x)); if (semanas.indexOf(w) < 0) semanas.push(w); });
    var meses = []; fs.forEach(function (x) { var mm = MESES[+x.slice(5, 7) - 1]; if (meses.indexOf(mm) < 0) meses.push(mm); });
    var dni = String(d.firmaDni || '').trim();
    var sello = /^\d{8}$/.test(dni) ? ['FIRMADO DIGITALMENTE', 'DNI ' + dni + ' · ' + dmy(fi), 'Verif. ' + verif('informe|' + dni + '|' + fi + '|' + d.tema)] : [];
    var map = {
      EMPRESA: rz.body, TEMA: d.tema, REPORTADO: d.reportado || 'Luis Eduardo Coveñas Chero – Subgerente de personas',
      MES: meses.join(' y ') + '.', FINF: dmy(fi), SEMINF: p2(d.semInforme || semanaISO(fi)), TIPO: d.tipoInforme || 'Capacitación',
      OBJETIVO: d.objetivo || sg.objetivo, FECHA: fechasTxt(fs), SEM: '    ' + (d.sem ? p2(d.sem) : semanas.join(', ')), DUR: d.dur || '', SECTOR: d.sector || '', RESP: d.resp || '',
      N: String(d.n == null ? '' : d.n), H: String(d.h == null ? '' : d.h), M: String(d.m == null ? '' : d.m),
      FIRMANOM: '            ' + (d.firmaNom || ''), FIRMACARGO: d.firmaCargo || ''
    };
    doc = lista(doc, '{{TEMAITEM}}', d.temas && d.temas.length ? d.temas : sg.temas, false);
    doc = lista(doc, '{{CONCITEM}}', d.conclusiones && d.conclusiones.length ? d.conclusiones : sg.conclusiones, true);
    doc = lista(doc, '{{ADJITEM}}', d.adjuntos && d.adjuntos.length ? d.adjuntos : sg.adjuntos, false);
    doc = doc.replace(/\{\{([A-Z]+)\}\}/g, function (m, k) { return k in map ? xe(map[k]) : m; });
    hdr = hdr.replace('{{RAZON}}', xe(rz.head));
    doc = doc.split('<w:t>{{FIRMADIG}}</w:t>').join(sello.length ? '<w:t xml:space="preserve">' + sello.map(xe).join('</w:t><w:br/><w:t xml:space="preserve">') + '</w:t>' : '<w:t></w:t>');
    doc = await ponerFotos(zip, doc, d.fotos);
    if (/\{\{[A-Z0-9]+\}\}/.test(doc + hdr)) throw new Error('Plantilla: quedaron campos sin llenar');
    zip.file('word/document.xml', doc); zip.file('word/header1.xml', hdr);
    return zip.generateAsync({ type: (typeof window !== 'undefined' && typeof Blob !== 'undefined') ? 'blob' : 'nodebuffer', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }
  capInformeWord.sugerencias = sugerencias; capInformeWord.nombrePropio = nombrePropio; capInformeWord.semanaISO = semanaISO; capInformeWord.razon = razon; capInformeWord.version = 2; capInformeWord.fechasTxt = fechasTxt; capInformeWord.verif = verif;
  if (typeof module !== 'undefined' && module.exports) module.exports = capInformeWord; else root.capInformeWord = capInformeWord;
})(typeof window !== 'undefined' ? window : globalThis);
