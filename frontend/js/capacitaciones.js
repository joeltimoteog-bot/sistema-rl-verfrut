'use strict';
/* ═══════════════════════════════════════════════════════════════════
   capacitaciones.js  ·  Sistema RL v3.0
   Módulo de registro de capacitaciones con lector QR de fotochecks
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────── ESTADO GLOBAL ─────────────────────── */
let USER = null;
let API  = '';
let scanner    = null;
let escaneando = false;
let asistentes = []; // [{ n, dni, nombre, empresa, cargo, sexo }]
let _dniCooldown = {}; // { dni: timestamp } — anti-duplicado 3s

const COOLDOWN_MS = 3000;

/* ─────────────────────── INIT ─────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if (!ud || !API) { location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

  const el = document.getElementById('topNombre');
  if (el) el.textContent = USER.nombre || USER.usuario || '';

  // Empresa default según rol del usuario
  const emp = (USER.empresa || '').toUpperCase();
  if (emp.includes('RAPEL') && !emp.includes('VERFRUT')) sv('capEmpresa', 'RAPEL');
  else if (emp.includes('VERFRUT')) sv('capEmpresa', 'VERFRUT');

  // Fecha y hora de hoy
  const now = new Date();
  sv('capFecha', now.toISOString().split('T')[0]);
  sv('capHoraInicio', now.toTimeString().slice(0, 5));

  // Feedback visual en checkboxes de tipo
  document.querySelectorAll('#capTipoGroup .check-item input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.check-item').classList.toggle('checked', cb.checked);
    });
  });

  // Rango export default: últimos 30 días
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  sv('expDesde', hace30.toISOString().split('T')[0]);
  sv('expHasta', now.toISOString().split('T')[0]);

  cargarRegistros();
});

/* ─────────────────────── TABS ─────────────────────── */
function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('on');
  if (btn) btn.classList.add('on');
  if (tab !== 'nueva') detenerScanner();
  if (tab === 'registros') cargarRegistros();
}

/* ─────────────────────── PASO 1 → 2 ─────────────────────── */
function irPaso2() {
  const empresa = v('capEmpresa');
  const tema    = v('capTema').trim();
  const lugar   = v('capLugar').trim();
  const fecha   = v('capFecha');
  const tipos   = getTipos();

  if (!empresa) { mostrarFeedback('err', 'Selecciona la empresa (RAPEL o VERFRUT)'); return; }
  if (!tipos.length) { mostrarFeedback('err', 'Selecciona al menos un tipo de actividad'); return; }
  if (!tema)    { mostrarFeedback('err', 'El tema de la actividad es obligatorio'); return; }
  if (!lugar)   { mostrarFeedback('err', 'El lugar es obligatorio'); return; }
  if (!fecha)   { mostrarFeedback('err', 'La fecha es obligatoria'); return; }

  document.getElementById('paso1').style.display = 'none';
  document.getElementById('paso2').style.display = '';
  document.getElementById('step1-ind').classList.remove('on');
  document.getElementById('step1-ind').classList.add('done');
  document.getElementById('step2-ind').classList.add('on');

  // Mostrar resumen de la actividad
  const horaI = v('capHoraInicio'), horaT = v('capHoraTermino'), horas = v('capHoras');
  const resEl = document.getElementById('cap-resumen');
  if (resEl) {
    resEl.innerHTML =
      `<b style="color:#0a2463">${empresa}</b> · <b>${tipos.join(', ')}</b> · ${tema}<br>` +
      `📅 ${fecha}  📍 ${lugar}` +
      (horaI ? `  ⏰ ${horaI}${horaT ? ' – ' + horaT : ''}` : '') +
      (horas ? `  <b>(${horas}h)</b>` : '');
  }

  ocultarFeedback();
}

function volverPaso1() {
  detenerScanner();
  document.getElementById('paso1').style.display = '';
  document.getElementById('paso2').style.display = 'none';
  document.getElementById('step1-ind').classList.add('on');
  document.getElementById('step1-ind').classList.remove('done');
  document.getElementById('step2-ind').classList.remove('on');
}

/* ─────────────────────── QR SCANNER ─────────────────────── */
function iniciarScanner() {
  if (escaneando) return;
  document.getElementById('btnIniciarQR').style.display = 'none';
  document.getElementById('btnDetenerQR').style.display = '';

  scanner = new Html5Qrcode('qr-reader');
  Html5Qrcode.getCameras()
    .then(cameras => {
      if (!cameras.length) { mostrarFeedback('err', 'No se encontró cámara disponible'); _resetBtnsScanner(); return; }
      // Priorizar cámara trasera (environment)
      const cam = cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
      return scanner.start(
        cam.id,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        texto => procesarQR(texto),
        () => {}
      );
    })
    .then(() => { escaneando = true; })
    .catch(e => { mostrarFeedback('err', 'Error al iniciar cámara: ' + (e.message || e)); _resetBtnsScanner(); });
}

function detenerScanner() {
  if (scanner && escaneando) {
    scanner.stop().catch(() => {}).finally(() => { scanner = null; escaneando = false; _resetBtnsScanner(); });
  }
}

function _resetBtnsScanner() {
  const bi = document.getElementById('btnIniciarQR'), bd = document.getElementById('btnDetenerQR');
  if (bi) bi.style.display = '';
  if (bd) bd.style.display = 'none';
  escaneando = false;
}

/* ─────────────────────── PROCESAR QR ─────────────────────── */
async function procesarQR(texto) {
  // Extraer DNI: primer grupo de exactamente 8 dígitos en el texto
  const match = texto.match(/\b(\d{8})\b/);
  if (!match) {
    mostrarFeedback('dup', '⚠️ QR sin DNI de 8 dígitos: ' + texto.substring(0, 40));
    return;
  }
  await procesarDni(match[1]);
}

async function procesarDni(dni) {
  const now = Date.now();

  // Anti-duplicado: cooldown de 3 segundos por DNI
  if (_dniCooldown[dni] && (now - _dniCooldown[dni]) < COOLDOWN_MS) return;
  _dniCooldown[dni] = now;

  // Ya está en la lista
  if (asistentes.find(a => a.dni === dni)) {
    mostrarFeedback('dup', `⚠️ DNI ${dni} ya está en la lista`);
    beep(false); vibrar([100, 50, 100]);
    return;
  }

  mostrarFeedback('ok', `🔍 Buscando DNI ${dni}...`);
  try {
    const d = await apiGet({ action: 'buscarTrabajador', q: dni, empresa: 'AMBAS' });
    if (d.success && d.data && d.data.length) {
      const t = d.data[0];
      agregarAsistente({ dni, nombre: t.nombre || '', empresa: t.empresa || '', cargo: t.cargo || '', sexo: t.sexo || '' });
      mostrarFeedback('ok', `✅ ${t.nombre || dni}  ·  ${t.empresa || ''}  ·  ${t.cargo || ''}`);
    } else {
      // Registrar solo con DNI si no se encuentra en la BD de trabajadores
      agregarAsistente({ dni, nombre: '', empresa: v('capEmpresa') || '', cargo: '', sexo: '' });
      mostrarFeedback('ok', `✅ DNI ${dni} registrado (sin datos en BD — completar manualmente)`);
    }
    beep(true); vibrar([80]);
  } catch(e) {
    mostrarFeedback('err', `❌ Error al buscar DNI ${dni}: ` + e.message);
    beep(false);
  }
}

/* ─────────────────────── DNI MANUAL ─────────────────────── */
async function buscarDniManual() {
  const raw = (v('dniManual') || '').trim().replace(/\D/g, '');
  if (raw.length !== 8) { mostrarFeedback('err', 'El DNI debe tener exactamente 8 dígitos'); return; }
  sv('dniManual', '');
  await procesarDni(raw);
}

/* ─────────────────────── LISTA DE ASISTENTES ─────────────────────── */
function agregarAsistente(t) {
  asistentes.push({ n: asistentes.length + 1, ...t });
  renderLista();
}

function eliminarAsistente(dni) {
  asistentes = asistentes.filter(a => a.dni !== dni).map((a, i) => ({ ...a, n: i + 1 }));
  renderLista();
}

function renderLista() {
  const tb = document.getElementById('tbAsistentes');
  const ct = document.getElementById('contadorAsist');
  if (ct) ct.textContent = asistentes.length;
  if (!tb) return;

  if (!asistentes.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty">Sin asistentes registrados</td></tr>';
    return;
  }

  tb.innerHTML = asistentes.map(a => `
    <tr>
      <td style="font-weight:700;color:#64748b;width:34px">${a.n}</td>
      <td><code style="font-size:12px">${a.dni}</code></td>
      <td>${a.nombre || '<span style="color:#94a3b8;font-style:italic">Sin nombre</span>'}</td>
      <td>${a.empresa ? `<span class="badge-emp ${a.empresa.includes('RAPEL') ? 'badge-rap' : 'badge-vrf'}">${a.empresa}</span>` : ''}</td>
      <td style="font-size:12px;color:#475569">${a.cargo || '—'}</td>
      <td><button onclick="eliminarAsistente('${a.dni}')" style="background:#fee2e2;color:#dc2626;border:none;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:11px;font-weight:700">✕</button></td>
    </tr>`).join('');
}

/* ─────────────────────── BUSCAR CAPACITADOR (autofill) ─────────────────────── */
async function buscarCapacitador(dni) {
  if ((dni || '').length !== 8) return;
  try {
    const d = await apiGet({ action: 'buscarTrabajador', q: dni, empresa: 'AMBAS' });
    if (d.success && d.data && d.data.length) {
      const t = d.data[0];
      if (!v('capCapNombre')) sv('capCapNombre', t.nombre || '');
      if (!v('capCapCargo'))  sv('capCapCargo',  t.cargo  || '');
    }
  } catch(e) { /* silencioso */ }
}

/* ─────────────────────── CALCULAR HORAS ─────────────────────── */
function calcHoras() {
  const hi = v('capHoraInicio'), ht = v('capHoraTermino');
  if (!hi || !ht) return;
  const [h1, m1] = hi.split(':').map(Number);
  const [h2, m2] = ht.split(':').map(Number);
  const diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  if (diff > 0) sv('capHoras', diff.toFixed(1));
}

/* ─────────────────────── GUARDAR ─────────────────────── */
async function guardarCapacitacion() {
  if (!asistentes.length) { mostrarFeedback('err', 'Registra al menos un asistente antes de guardar'); return; }
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Guardando...';
  try {
    const body = _buildBody();
    const d = await apiPost({ action: 'guardarCapacitacion', ...body });
    if (d.success) {
      mostrarFeedback('ok', `✅ Capacitación guardada correctamente. ID: ${d.id || '—'}`);
    } else {
      mostrarFeedback('err', '❌ ' + (d.error || 'Error al guardar en el servidor'));
    }
  } catch(e) {
    mostrarFeedback('err', '❌ Error de conexión: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 Guardar';
  }
}

function _buildBody() {
  return {
    empresa:        v('capEmpresa'),
    fecha:          v('capFecha'),
    tipo:           getTipos().join(', '),
    tema:           v('capTema').trim(),
    fuente:         v('capFuente').trim(),
    area:           v('capArea').trim(),
    lugar:          v('capLugar').trim(),
    hora_inicio:    v('capHoraInicio'),
    hora_termino:   v('capHoraTermino'),
    total_horas:    parseFloat(v('capHoras')) || 0,
    cap_dni:        v('capCapDni').trim(),
    cap_nombre:     v('capCapNombre').trim(),
    cap_cargo:      v('capCapCargo').trim(),
    n_hombres:      asistentes.filter(a => (a.sexo || '').toUpperCase() === 'M').length,
    n_mujeres:      asistentes.filter(a => (a.sexo || '').toUpperCase() === 'F').length,
    asistentes:     asistentes,
    usuario:        USER.usuario,
    usuario_nombre: USER.nombre
  };
}

/* ─────────────────────── PDF R-SC-01 ─────────────────────── */
async function generarPDF() {
  const empresa = v('capEmpresa');
  if (!empresa) { mostrarFeedback('err', 'Selecciona la empresa antes de generar el PDF'); return; }

  const btn = document.getElementById('btnPDF');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Generando PDF...';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, mg = 11, bW = W - 2 * mg; // bW = 188mm

    // ── Paleta oficial ──
    const ROJO       = [217, 31, 38];
    const GRIS       = [127, 127, 127];
    const GRIS_CLARO = [242, 242, 242];
    const NEGRO      = [0, 0, 0];
    const BLANCO     = [255, 255, 255];

    const esRapel   = empresa === 'RAPEL';
    const nombreEmp = esRapel ? 'SOCIEDAD AGRÍCOLA RAPEL S.A.C.' : 'SOCIEDAD EXPORTADORA VERFRUT S.A.C.';
    const rucEmp    = esRapel ? '20451779711' : '20601438586';
    const tipos     = getTipos();
    const tiposAll  = ['INDUCCIÓN', 'PAUTA-CHARLA', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO'];
    const nH        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'M').length;
    const nM        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'F').length;
    const logoB64   = await _getLogoBase64();

    const TOTAL_POR_HOJA = 20;
    const totalHojas = Math.max(1, Math.ceil(asistentes.length / TOTAL_POR_HOJA));

    // ── Helper: dibuja header completo, devuelve nueva y ──
    function dibujarHeader(y) {
      const hdrH = 30, logoColW = 50, codeColW = 42;
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
      doc.rect(mg, y, bW, hdrH);

      // Logo proporcional 45×15mm (ratio 3:1)
      if (logoB64) { try { doc.addImage(logoB64, 'JPEG', mg + 2.5, y + 7.5, 45, 15); } catch(e) {} }
      doc.setDrawColor(180, 180, 180);
      doc.line(mg + logoColW, y, mg + logoColW, y + hdrH);

      // Centro
      const cx = mg + logoColW, midW = bW - logoColW - codeColW;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...NEGRO);
      doc.text(nombreEmp, cx + midW / 2, y + 7, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(50, 50, 50);
      doc.text('REGISTRO DE INDUCCIÓN, CAPACITACIÓN,', cx + midW / 2, y + 14, { align: 'center' });
      doc.text('ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA', cx + midW / 2, y + 19, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(80, 80, 80);
      doc.text('Caserío El Papayo Mz. O, Castilla, Piura', cx + midW / 2, y + 24, { align: 'center' });
      doc.text('RUC: ' + rucEmp, cx + midW / 2, y + 28, { align: 'center' });

      // Derecha: código en rojo
      const rx = W - mg - codeColW;
      doc.line(rx, y, rx, y + hdrH);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...ROJO);
      doc.text('R-SC-01', rx + codeColW / 2, y + 10, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...ROJO);
      doc.text('Versión N.° 0.0', rx + codeColW / 2, y + 17, { align: 'center' });
      doc.text('Última revisión: 24/03/2026', rx + codeColW / 2, y + 22, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(60, 60, 60);
      doc.text('Frecuencia: Cada actividad', rx + codeColW / 2, y + 27, { align: 'center' });

      return y + hdrH + 2;
    }

    // ── Helper: datos de la actividad, devuelve nueva y ──
    function dibujarDatosActividad(y) {
      _secHeader(doc, mg, y, W, 'DATOS DE LA ACTIVIDAD');
      y += 6;
      const fH = 6;

      _campo(doc, mg, y, bW, fH, 'TEMA DE LA ACTIVIDAD', v('capTema').trim(), true); y += fH;
      _campo(doc, mg,          y, bW / 2, fH, 'FUENTE', v('capFuente').trim(), false);
      _campo(doc, mg + bW / 2, y, bW / 2, fH, 'ÁREA',  v('capArea').trim(),   false);
      y += fH;

      // Checkboxes con X roja
      const tipoH = 8;
      doc.setFillColor(...GRIS_CLARO); doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
      doc.rect(mg, y, bW, tipoH, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...NEGRO);
      doc.text('TIPO DE ACTIVIDAD:', mg + 2, y + 3.5);
      const labW = 32, checkSpacing = (bW - labW - 4) / tiposAll.length;
      tiposAll.forEach((t, i) => {
        const bx = mg + labW + i * checkSpacing, by = y + 2.2;
        doc.setDrawColor(...NEGRO); doc.setLineWidth(0.3);
        doc.rect(bx, by, 3.5, 3.5);
        if (tipos.includes(t)) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ROJO);
          doc.text('X', bx + 1.75, by + 3, { align: 'center' });
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...NEGRO);
        doc.text(t, bx + 4.5, by + 3);
      });
      y += tipoH;

      _campo(doc, mg,            y, bW * 0.6, fH, 'LUGAR', v('capLugar').trim(), true);
      _campo(doc, mg + bW * 0.6, y, bW * 0.4, fH, 'FECHA', v('capFecha'), true);
      y += fH;

      const q = bW / 4;
      _campo(doc, mg,       y, q, fH, 'HORA INICIO',    v('capHoraInicio')  || '', false);
      _campo(doc, mg + q,   y, q, fH, 'HORA TÉRMINO',   v('capHoraTermino') || '', false);
      _campo(doc, mg + 2*q, y, q, fH, 'TOTAL HORAS',    v('capHoras') || '—', false);
      _campo(doc, mg + 3*q, y, q, fH, 'N° TRAB. H / M', `H: ${nH}  M: ${nM}`, false);
      y += fH;

      _campo(doc, mg, y, bW, fH, 'PRODUCTOR', nombreEmp, true);
      y += fH + 3;
      return y;
    }

    // ── Helper: capacitador, devuelve nueva y ──
    function dibujarCapacitador(y) {
      _secHeader(doc, mg, y, W, 'DATOS DE CAPACITADOR O ENTRENADOR');
      y += 6;
      doc.autoTable({
        startY: y, margin: { left: mg, right: mg },
        head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / INSTITUCIÓN', 'FIRMA']],
        body: [['1', v('capCapDni').trim() || '', v('capCapNombre').trim() || '', v('capCapCargo').trim() || '', '']],
        styles:     { fontSize: 7, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: GRIS, textColor: BLANCO, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 55 }, 3: { cellWidth: 58 } },
        didParseCell: d => {
          if (d.section === 'body') {
            if ([1, 2, 3].includes(d.column.index)) d.cell.styles.textColor = ROJO;
            if (d.column.index === 4) d.cell.styles.minCellHeight = 10;
          }
        }
      });
      return doc.lastAutoTable.finalY + 3;
    }

    // ── Helper: tabla de participantes, siempre 20 filas ──
    function dibujarParticipantes(y, grupo, offset) {
      _secHeader(doc, mg, y, W, 'PARTICIPANTES DE LA ACTIVIDAD');
      y += 6;
      const filas = [];
      for (let i = 0; i < 20; i++) {
        const a = grupo[i];
        filas.push(a
          ? [offset + i + 1, a.dni || '', a.nombre || '', a.cargo || '', '', '']
          : [offset + i + 1, '', '', '', '', '']
        );
      }
      doc.autoTable({
        startY: y, margin: { left: mg, right: mg },
        head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA / HUELLA', 'OBS.']],
        body: filas,
        styles:     { fontSize: 6, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.2, minCellHeight: 7 },
        headStyles: { fillColor: GRIS, textColor: BLANCO, fontStyle: 'bold', fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 8  }, 1: { cellWidth: 22 },
          2: { cellWidth: 58 }, 3: { cellWidth: 36 },
          4: { cellWidth: 38 }, 5: { cellWidth: 26 }
        },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        didParseCell: d => {
          if (d.section === 'body' && [1, 2, 3].includes(d.column.index)) {
            const val = String(d.cell.raw || '').trim();
            d.cell.styles.textColor = val ? ROJO : [220, 220, 220];
          }
        }
      });
      return doc.lastAutoTable.finalY + 3;
    }

    // ── Helper: sección responsable del registro ──
    function dibujarResponsable(y) {
      _secHeader(doc, mg, y, W, 'RESPONSABLE DEL REGISTRO / SEGURIDAD ALIMENTARIA');
      y += 6;
      doc.autoTable({
        startY: y, margin: { left: mg, right: mg },
        head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA']],
        body: [['1', '', USER.nombre || '', USER.cargo || USER.rol || '', '']],
        styles:     { fontSize: 7, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        headStyles: { fillColor: GRIS, textColor: BLANCO, fontStyle: 'bold', fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 2: { cellWidth: 55 }, 3: { cellWidth: 58 } },
        didParseCell: d => {
          if (d.section === 'body') {
            if ([1, 2, 3].includes(d.column.index)) d.cell.styles.textColor = ROJO;
            if (d.column.index === 4) d.cell.styles.minCellHeight = 10;
          }
        }
      });
    }

    // ════════════════════ GENERAR PÁGINAS ════════════════════
    for (let hoja = 0; hoja < totalHojas; hoja++) {
      if (hoja > 0) doc.addPage();
      let y = mg;
      y = dibujarHeader(y);
      y = dibujarDatosActividad(y);
      y = dibujarCapacitador(y);
      const inicio = hoja * TOTAL_POR_HOJA;
      y = dibujarParticipantes(y, asistentes.slice(inicio, inicio + TOTAL_POR_HOJA), inicio);
      if (hoja === totalHojas - 1) dibujarResponsable(y);
    }

    // ════════════════════ FOOTER ════════════════════
    const totalPages = doc.internal.getNumberOfPages();
    const fechaGen = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const pH = doc.internal.pageSize.height;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(140, 140, 140);
      doc.text(`Generado: ${fechaGen}  |  Sistema RL v3.0  |  ${USER.nombre}`, mg, pH - 4);
      doc.text(`Pág. ${p} de ${totalPages}`, W - mg, pH - 4, { align: 'right' });
    }

    const fname = `R-SC-01_${empresa}_${v('capFecha')}_${v('capTema').trim().substring(0, 20).replace(/[\s/\\:*?"<>|]+/g, '-')}.pdf`;
    doc.save(fname);
    mostrarFeedback('ok', `✅ PDF generado: ${fname}`);
  } catch(e) {
    console.error('[PDF] Error:', e);
    mostrarFeedback('err', '❌ Error al generar PDF: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📄 Generar PDF R-SC-01';
  }
}

// Encabezado de sección (banda gris oscuro con texto blanco)
function _secHeader(doc, mg, y, W, texto) {
  doc.setFillColor(127, 127, 127);
  doc.rect(mg, y, W - 2 * mg, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text(texto, mg + 4, y + 4.2);
}

// Campo de datos: etiqueta en negro negrita, valor en rojo Unifrutti
function _campo(doc, x, y, w, h, label, valor, sombreado) {
  doc.setFillColor(sombreado ? 240 : 255, sombreado ? 244 : 255, sombreado ? 248 : 255);
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
  doc.text(label, x + 1.5, y + 2.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(217, 31, 38);
  doc.text(String(valor || ''), x + 1.5, y + 5.8, { maxWidth: w - 3 });
}

// Cargar logo como base64 desde la imagen local
async function _getLogoBase64() {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg'));
      } catch(e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '../images/logo-unifrutti.jpg';
  });
}

/* ─────────────────────── REGISTROS ─────────────────────── */
async function cargarRegistros() {
  const wrap = document.getElementById('tbRegistrosWrap');
  if (!wrap || !USER) return;
  wrap.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Cargando...</div>';
  try {
    const empresa = v('filtroEmpReg');
    const d = await apiGet({ action: 'listarCapacitaciones', empresa, usuario: USER.usuario, rol: USER.rol });
    if (!d.success) throw new Error(d.error || 'Error servidor');
    if (!d.data || !d.data.length) {
      wrap.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>Sin registros aún</div>';
      return;
    }
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Tema</th>
          <th style="text-align:center">Asistentes</th><th>Registrado por</th>
        </tr></thead>
        <tbody>${d.data.map(r => `<tr>
          <td><span class="badge-emp ${r.empresa === 'RAPEL' ? 'badge-rap' : 'badge-vrf'}">${r.empresa || ''}</span></td>
          <td>${r.fecha || ''}</td>
          <td style="font-size:11px;color:#475569">${r.tipo || ''}</td>
          <td>${r.tema || ''}</td>
          <td style="text-align:center;font-weight:700">${r.total_asistentes || 0}</td>
          <td style="font-size:11px;color:#64748b">${r.usuario_nombre || r.usuario || ''}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  } catch(e) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">❌</div>Error: ${e.message}</div>`;
  }
}

/* ─────────────────────── EXPORTAR CSV ─────────────────────── */
async function exportarCSV() {
  const fb = document.getElementById('expFeedback');
  if (fb) fb.textContent = '⏳ Exportando...';
  try {
    const d = await apiGet({
      action:  'exportarCapacitaciones',
      empresa: v('expEmpresa'),
      desde:   v('expDesde'),
      hasta:   v('expHasta'),
      usuario: USER.usuario,
      rol:     USER.rol
    });
    if (!d.success) throw new Error(d.error || 'Error servidor');
    if (!d.data || !d.data.length) { if (fb) fb.textContent = '⚠️ Sin datos para ese rango'; return; }

    const rows   = d.data;
    const header = Object.keys(rows[0]).join(',');
    const body   = rows.map(r =>
      Object.values(r).map(val => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `capacitaciones_${v('expDesde')}_${v('expHasta')}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
    if (fb) fb.textContent = `✅ ${rows.length} registros exportados`;
  } catch(e) {
    if (fb) fb.textContent = '❌ Error: ' + e.message;
  }
}

/* ─────────────────────── RESET ─────────────────────── */
function resetearFormulario() {
  if (!confirm('¿Iniciar una nueva capacitación? Se perderá la lista actual de asistentes.')) return;
  asistentes = [];
  _dniCooldown = {};
  renderLista();
  volverPaso1();
  ocultarFeedback();
}

/* ─────────────────────── FEEDBACK ─────────────────────── */
let _fbTimer;
function mostrarFeedback(tipo, msg) {
  clearTimeout(_fbTimer);
  const el = document.getElementById('cap-feedback');
  if (!el) return;
  el.className = 'fb-' + tipo;
  el.textContent = msg;
  el.style.display = 'block';
  if (tipo !== 'err') _fbTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}
function ocultarFeedback() {
  const el = document.getElementById('cap-feedback');
  if (el) el.style.display = 'none';
}

/* ─────────────────────── AUDIO + VIBRACIÓN ─────────────────────── */
function beep(ok) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 330;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.15 : 0.35));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.35));
  } catch(e) {}
}

function vibrar(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
}

/* ─────────────────────── HELPERS ─────────────────────── */
function getTipos() {
  return [...document.querySelectorAll('#capTipoGroup input[type=checkbox]:checked')].map(cb => cb.value);
}
function v(id)       { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

async function apiGet(p) {
  const r = await fetch(API + '?' + new URLSearchParams(p));
  return r.json();
}
async function apiPost(b) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } });
  return r.json();
}
