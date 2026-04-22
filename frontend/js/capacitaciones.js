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
  // ── Validaciones previas ──
  const empresa = v('capEmpresa');
  if (!empresa) { mostrarFeedback('err', 'Selecciona la empresa antes de generar el PDF'); return; }

  const respDni    = v('capRespDni').trim();
  const respNombre = v('capRespNombre').trim();
  const respCargo  = v('capRespCargo').trim();
  if (!respNombre) { mostrarFeedback('err', '⚠️ Ingresa el DNI del responsable del registro para generar el PDF'); return; }

  // ── Truncar a 20 participantes con aviso ──
  let partList = [...asistentes];
  if (partList.length > 20) {
    const ok = confirm(
      `⚠️ El formato oficial R-SC-01 tiene solo 20 filas.\n\n` +
      `Tienes ${partList.length} participantes.\n` +
      `Solo se incluirán los primeros 20 en el PDF.\n\n¿Deseas continuar?`
    );
    if (!ok) return;
    partList = partList.slice(0, 20);
  }
  // Rellenar hasta exactamente 20 filas
  while (partList.length < 20) partList.push({ dni: '', nombre: '', cargo: '', obs: '' });

  const btn = document.getElementById('btnPDF');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Generando PDF...';

  try {
    const { jsPDF } = window.jspdf;
    // A4 HORIZONTAL — UNA SOLA HOJA (297 × 210 mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210, MGS = 10, MGT = 6; // margen lateral 10, superior 6
    const bW = W - 2 * MGS; // 277mm

    const C = {
      negro:    [0, 0, 0],
      rojo:     [217, 31, 38],
      banner:   [217, 217, 217],  // #D9D9D9
      cabecera: [232, 232, 232],  // #E8E8E8
    };

    const esRapel   = empresa === 'RAPEL';
    const nombreEmp = esRapel ? 'SOCIEDAD AGRÍCOLA RAPEL S.A.C.' : 'SOCIEDAD EXPORTADORA VERFRUT S.A.C.';
    const rucEmp    = esRapel ? 'RUC 20451779711' : 'RUC 20601438586';
    const tipos     = getTipos();
    const tiposAll  = ['INDUCCIÓN', 'PAUTA-CHARLA', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO'];
    const nH        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'M').length;
    const nM        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'F').length;
    const logoB64   = await _getLogoBase64();

    // ── Estilos reutilizables ──
    const sBorder  = { lineColor: C.negro, lineWidth: 0.3 };
    const sData    = { ...sBorder, textColor: C.negro, cellPadding: 1, minCellHeight: 4.5 };
    const sBanner  = { fillColor: C.banner, textColor: C.negro, fontStyle: 'bold', halign: 'center', fontSize: 8.5, minCellHeight: 5, cellPadding: 1 };
    const sCabHead = { fillColor: C.cabecera, textColor: C.negro, fontStyle: 'bold', halign: 'center', fontSize: 7.5, minCellHeight: 4 };
    const sLabel   = { fontStyle: 'bold', fontSize: 7, textColor: C.negro };
    const sValor   = { fontSize: 8, textColor: C.negro };

    // Anchos columnas encabezado (suman 277mm exacto)
    const COL1 = 45, COL2 = 172, COL3 = 60;

    let y = MGT; // empieza en 6mm desde arriba

    // ═══════════════════════════════════════════════════════
    // 1. ENCABEZADO — 2 FILAS con 3 columnas cada una
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y,
      margin: { left: MGS, right: MGS, bottom: 6 },
      body: [
        // ── Fila 1: Logo | Nombre empresa + Título | Código ──
        [
          { content: '', styles: { cellWidth: COL1, minCellHeight: 16, valign: 'middle' } },
          { content: `${nombreEmp}\nREGISTRO DE INDUCCIÓN, CAPACITACIÓN,\nENTRENAMIENTO Y SIMULACROS DE EMERGENCIA`,
            styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10,
                      textColor: C.negro, cellWidth: COL2, minCellHeight: 16, cellPadding: 1.5 } },
          { content: 'R-SC-01\nVersión N.° 0.0\nÚltima revisión:\n24/03/2026',
            styles: { halign: 'center', valign: 'middle', fontSize: 9,
                      textColor: C.negro, cellWidth: COL3, minCellHeight: 16, cellPadding: 1 } }
        ],
        // ── Fila 2: Dirección/RUC | Lema | Frecuencia ──
        [
          { content: `Caserío El Papayo Mz. O, Castilla,\nPiura, Piura, Perú\n${rucEmp}`,
            styles: { halign: 'center', valign: 'middle', fontSize: 8,
                      textColor: C.negro, cellWidth: COL1, minCellHeight: 9, cellPadding: 1 } },
          { content: 'Empresa dedicada al cultivo, procesamiento y comercialización de fruta fresca.',
            styles: { halign: 'center', valign: 'middle', fontStyle: 'italic', fontSize: 8.5,
                      textColor: C.negro, cellWidth: COL2, minCellHeight: 9, cellPadding: 1 } },
          { content: 'Frecuencia:\n_______________',
            styles: { halign: 'left', valign: 'middle', fontSize: 9,
                      textColor: C.negro, cellWidth: COL3, minCellHeight: 9, cellPadding: 2 } }
        ]
      ],
      theme: 'grid',
      styles: sBorder
    });
    // Logo sobre la celda superior-izquierda (fila 1, col 1: x=10..55, y=6..22)
    if (logoB64) { try { doc.addImage(logoB64, 'JPEG', MGS + 6.5, y + 1, 32, 14); } catch(e) {} }
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 2. BANNER — DATOS DE LA ACTIVIDAD
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[{ content: 'DATOS DE LA ACTIVIDAD', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 3. CAMPOS DE ACTIVIDAD
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[
        { content: 'TEMA:', styles: { ...sLabel, cellWidth: 20 } },
        { content: v('capTema').trim(), styles: sValor }
      ]],
      theme: 'grid', styles: sData
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[
        { content: 'FUENTE:', styles: { ...sLabel, cellWidth: 20 } },
        { content: v('capFuente').trim(), styles: { ...sValor, cellWidth: 116 } },
        { content: 'ÁREA:', styles: { ...sLabel, cellWidth: 16 } },
        { content: v('capArea').trim(), styles: sValor }
      ]],
      theme: 'grid', styles: sData
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 4. TIPO DE ACTIVIDAD — checkboxes manuales
    // ═══════════════════════════════════════════════════════
    const checkH = 6;
    doc.setFillColor(...C.banner);
    doc.setDrawColor(...C.negro);
    doc.setLineWidth(0.3);
    doc.rect(MGS, y, bW, checkH, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.negro);
    doc.text('TIPO DE ACTIVIDAD:', MGS + 2, y + 4);
    const labW2 = 50, colW2 = (bW - labW2) / tiposAll.length;
    tiposAll.forEach((t, i) => {
      const bx = MGS + labW2 + i * colW2 + 1, by = y + 1.2;
      doc.setDrawColor(...C.negro); doc.setLineWidth(0.3);
      doc.rect(bx, by, 4, 4);
      if (tipos.includes(t)) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.rojo);
        doc.text('X', bx + 2, by + 3.4, { align: 'center' });
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.negro);
      doc.text(t, bx + 5.5, y + 4);
    });
    y += checkH;

    // ═══════════════════════════════════════════════════════
    // 5. LUGAR/FECHA — HORAS — PRODUCTOR
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[
        { content: 'LUGAR:', styles: { ...sLabel, cellWidth: 20 } },
        { content: v('capLugar').trim(), styles: { ...sValor, cellWidth: 135 } },
        { content: 'FECHA:', styles: { ...sLabel, cellWidth: 20 } },
        { content: v('capFecha'), styles: sValor }
      ]],
      theme: 'grid', styles: sData
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[
        { content: 'H. INICIO:', styles: { ...sLabel, cellWidth: 24 } },
        { content: v('capHoraInicio') || '', styles: { ...sValor, cellWidth: 38 } },
        { content: 'H. TÉRMINO:', styles: { ...sLabel, cellWidth: 28 } },
        { content: v('capHoraTermino') || '', styles: { ...sValor, cellWidth: 38 } },
        { content: 'TOTAL HORAS:', styles: { ...sLabel, cellWidth: 30 } },
        { content: v('capHoras') || '—', styles: { ...sValor, cellWidth: 50 } },
        { content: 'H / M:', styles: { ...sLabel, cellWidth: 18 } },
        { content: `${nH} / ${nM}`, styles: sValor }
      ]],
      theme: 'grid', styles: sData
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[
        { content: 'PRODUCTOR:', styles: { ...sLabel, cellWidth: 28 } },
        { content: nombreEmp, styles: sValor }
      ]],
      theme: 'grid', styles: sData
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 6. CAPACITADOR
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[{ content: 'DATOS DE CAPACITADOR O ENTRENADOR', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / INSTITUCIÓN', 'FIRMA']],
      body: [['1', v('capCapDni').trim(), v('capCapNombre').trim(), v('capCapCargo').trim(), '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, fontSize: 7.5, cellPadding: 1, textColor: C.negro },
      bodyStyles: { halign: 'center', minCellHeight: 5 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 28 }, 2: { cellWidth: 110 }, 3: { cellWidth: 82 }, 4: { cellWidth: 45 } }
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 7. PARTICIPANTES — siempre 20 filas
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[{ content: 'PARTICIPANTES DE LA ACTIVIDAD', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    const filasPart = partList.map((p, i) => [
      String(i + 1), p.dni || '', p.nombre || '', p.cargo || '', '', p.obs || ''
    ]);

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA / HUELLA', 'OBSERVACIONES']],
      body: filasPart,
      theme: 'grid',
      headStyles: { ...sCabHead, minCellHeight: 4 },
      styles: { ...sBorder, fontSize: 7, cellPadding: 0.8, textColor: C.negro, minCellHeight: 3.5 },
      bodyStyles: { halign: 'center' },
      columnStyles: {
        0: { cellWidth: 12 }, 1: { cellWidth: 28 },
        2: { cellWidth: 100, halign: 'left' }, 3: { cellWidth: 50, halign: 'left' },
        4: { cellWidth: 47 }, 5: { cellWidth: 40, halign: 'left' }
      },
      didParseCell: d => {
        if (d.section === 'body') {
          d.cell.styles.textColor = String(d.cell.raw || '').trim() ? C.negro : [200, 200, 200];
        }
      }
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 8. RESPONSABLE DEL REGISTRO
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      body: [[{ content: 'RESPONSABLE DEL REGISTRO / SEGURIDAD ALIMENTARIA', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 6 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA']],
      body: [['1', respDni, respNombre, respCargo, '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, fontSize: 7.5, cellPadding: 1, textColor: C.negro },
      bodyStyles: { halign: 'center', minCellHeight: 5 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 28 }, 2: { cellWidth: 110 }, 3: { cellWidth: 82 }, 4: { cellWidth: 45 } }
    });

    // ── Forzar 1 sola página (eliminar excedentes) ──
    const paginas = doc.internal.getNumberOfPages();
    if (paginas > 1) {
      console.error('[PDF R-SC-01] ❌ Generó ' + paginas + ' páginas, eliminando excedentes');
      while (doc.internal.getNumberOfPages() > 1) doc.deletePage(doc.internal.getNumberOfPages());
    }

    // ── Footer ──
    doc.setPage(1);
    const fechaGen = new Date().toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(140, 140, 140);
    doc.text(`Generado: ${fechaGen}  |  Sistema RL v3.0  |  ${USER.nombre}`, MGS, H - 3);
    doc.text('Pág. 1 de 1', W - MGS, H - 3, { align: 'right' });

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

async function buscarSupervisorPorDNI() {
  const dni = v('capRespDni').trim();
  if (dni.length !== 8) return;
  const elN = document.getElementById('capRespNombre');
  if (elN) elN.placeholder = '🔍 Buscando...';
  try {
    // 1. Buscar en BD_Supervisores
    const ds = await apiGet({ action: 'getSupervisores' });
    if (ds.success && ds.data) {
      const sup = ds.data.find(s => String(s.dni).trim() === dni);
      if (sup) {
        sv('capRespNombre', sup.nombre || '');
        sv('capRespCargo',  sup.cargo  || '');
        if (elN) elN.placeholder = 'Auto-completado';
        return;
      }
    }
    // 2. Fallback: buscar en BD_Trabajadores
    const dt = await apiGet({ action: 'buscarTrabajador', q: dni, empresa: 'AMBAS' });
    if (dt.success && dt.data && dt.data.length) {
      sv('capRespNombre', dt.data[0].nombre || '');
      sv('capRespCargo',  dt.data[0].cargo  || '');
      if (elN) elN.placeholder = 'Auto-completado';
    }
  } catch(e) { /* silencioso */ }
}

// Encabezado de sección (banda gris oscuro con texto blanco, reset a negro al terminar)
function _secHeader(doc, mg, y, W, texto) {
  doc.setFillColor(127, 127, 127);
  doc.rect(mg, y, W - 2 * mg, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text(texto, mg + 4, y + 4.2);
  doc.setTextColor(0, 0, 0); // reset a negro
}

// Campo de datos: etiqueta en negro negrita, valor en rojo Unifrutti, reset a negro al terminar
function _campo(doc, x, y, w, h, label, valor, sombreado) {
  doc.setFillColor(sombreado ? 240 : 255, sombreado ? 244 : 255, sombreado ? 248 : 255);
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0, 0, 0);
  doc.text(label, x + 1.5, y + 2.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(217, 31, 38);
  doc.text(String(valor || ''), x + 1.5, y + 5.8, { maxWidth: w - 3 });
  doc.setTextColor(0, 0, 0); // reset a negro
}

// Cargar logo Unifrutti como base64 (Image.onload con canvas — evita CORS de fetch)
function _getLogoBase64() {
  const RUTAS = [
    '../images/logo-unifrutti.jpg',
    '/sistema-rl-verfrut/frontend/images/logo-unifrutti.jpg',
    'https://joeltimoteog-bot.github.io/sistema-rl-verfrut/frontend/images/logo-unifrutti.jpg'
  ];
  return new Promise(resolve => {
    let idx = 0;
    function intentar() {
      if (idx >= RUTAS.length) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = this.naturalWidth  || this.width;
          canvas.height = this.naturalHeight || this.height;
          canvas.getContext('2d').drawImage(this, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch(e) { idx++; intentar(); }
      };
      img.onerror = () => { idx++; intentar(); };
      img.src = RUTAS[idx];
    }
    intentar();
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
