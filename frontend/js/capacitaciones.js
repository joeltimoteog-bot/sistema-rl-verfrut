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

/* ─────────────────────── LISTAS DESPLEGABLES ─────────────────────── */
const LISTAS_DEFAULT = {
  tema:   ['Uso correcto de EPP', 'Manejo seguro de agroquímicos', 'Seguridad e Higiene Industrial'],
  fuente: ['Normativa interna'],
  area:   ['Cosecha', 'Packing', 'Campo', 'Riego', 'Almacén', 'Administración']
};

let _listaActiva = null;

function cargarLista(tipo) {
  try {
    const raw = localStorage.getItem('cap_lista_' + tipo);
    return raw ? JSON.parse(raw) : [...LISTAS_DEFAULT[tipo]];
  } catch(e) { return [...LISTAS_DEFAULT[tipo]]; }
}

function guardarLista(tipo, items) {
  localStorage.setItem('cap_lista_' + tipo, JSON.stringify(items));
}

function poblarSelect(tipo) {
  const id = 'cap' + tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const sel = document.getElementById(id);
  if (!sel) return;
  const actual = sel.value;
  const items = cargarLista(tipo);
  const first = sel.options[0] ? sel.options[0].cloneNode(true) : null;
  sel.innerHTML = '';
  if (first) sel.appendChild(first);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item; opt.textContent = item;
    sel.appendChild(opt);
  });
  if (actual) sel.value = actual;
}

function inicializarListasCapacitaciones() {
  ['tema', 'fuente', 'area'].forEach(t => poblarSelect(t));
}

function gestionarLista(tipo) {
  _listaActiva = tipo;
  const titulos = { tema: 'Temas', fuente: 'Fuentes', area: 'Áreas' };
  const el = document.getElementById('modalListaTitulo');
  if (el) el.textContent = '✏️ Gestionar: ' + (titulos[tipo] || tipo);
  renderizarItemsLista(tipo);
  document.getElementById('modalListaOverlay').classList.add('open');
  const inp = document.getElementById('modalListaInput');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 80); }
}

function renderizarItemsLista(tipo) {
  const items = cargarLista(tipo);
  const cont = document.getElementById('modalListaItems');
  if (!cont) return;
  if (!items.length) {
    cont.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:10px 0">Sin ítems. Agrega el primero.</div>';
    return;
  }
  cont.innerHTML = items.map((item, i) => `
    <div class="modal-item-row">
      <span>${item}</span>
      <button class="btn-editar"   onclick="editarItem(${i})">✏️</button>
      <button class="btn-eliminar" onclick="eliminarItem(${i})">✕</button>
    </div>`).join('');
}

function cerrarModalLista() {
  document.getElementById('modalListaOverlay').classList.remove('open');
  _listaActiva = null;
}

function agregarItem() {
  if (!_listaActiva) return;
  const inp = document.getElementById('modalListaInput');
  const val = (inp ? inp.value : '').trim();
  if (!val) return;
  const items = cargarLista(_listaActiva);
  if (!items.includes(val)) { items.push(val); guardarLista(_listaActiva, items); }
  poblarSelect(_listaActiva);
  renderizarItemsLista(_listaActiva);
  if (inp) inp.value = '';
}

function editarItem(idx) {
  if (!_listaActiva) return;
  const items = cargarLista(_listaActiva);
  const nuevo = prompt('Editar ítem:', items[idx]);
  if (nuevo === null || !nuevo.trim()) return;
  items[idx] = nuevo.trim();
  guardarLista(_listaActiva, items);
  poblarSelect(_listaActiva);
  renderizarItemsLista(_listaActiva);
}

function eliminarItem(idx) {
  if (!_listaActiva) return;
  const items = cargarLista(_listaActiva);
  if (!confirm(`¿Eliminar "${items[idx]}"?`)) return;
  items.splice(idx, 1);
  guardarLista(_listaActiva, items);
  poblarSelect(_listaActiva);
  renderizarItemsLista(_listaActiva);
}

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

  // Poblar selects de listas
  inicializarListasCapacitaciones();

  // Auto-completar Productor al cambiar empresa
  const empSel = document.getElementById('capEmpresa');
  if (empSel) {
    const _setProductor = () => {
      const emp = empSel.value;
      const prod = emp === 'RAPEL'   ? 'SOCIEDAD AGRÍCOLA RAPEL S.A.C.' :
                   emp === 'VERFRUT' ? 'SOCIEDAD EXPORTADORA VERFRUT S.A.C.' : '';
      sv('capProductor', prod);
    };
    empSel.addEventListener('change', _setProductor);
    _setProductor(); // dispara una vez con el valor inicial
  }

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
  // Auto-actualizar contadores nH/nM/nTrab en paso 1
  const nHv = asistentes.filter(a => (a.sexo||'').toUpperCase()==='M').length;
  const nMv = asistentes.filter(a => (a.sexo||'').toUpperCase()==='F').length;
  sv('capNTrab', asistentes.length || '');
  sv('capNH', nHv || '');
  sv('capNM', nMv || '');
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
  if (!respDni || !respNombre || !respCargo) {
    alert('⚠️ Debes ingresar el DNI del responsable del registro.\n\nEl DNI debe existir en BD_Supervisores para auto-completar el nombre y cargo.');
    document.getElementById('capRespDni').focus();
    return;
  }

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
  while (partList.length < 20) partList.push({ dni: '', nombre: '', cargo: '', obs: '' });

  const btn = document.getElementById('btnPDF');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Generando PDF...';

  try {
    const { jsPDF } = window.jspdf;
    // A4 VERTICAL — UNA SOLA HOJA (210 × 297 mm)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297, MGS = 10, MGT = 5;
    const bW = W - 2 * MGS; // 190mm

    const C = {
      negro:    [0, 0, 0],
      rojo:     [217, 31, 38],
      banner:   [217, 217, 217],
      cabecera: [232, 232, 232],
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
    const sBanner  = { fillColor: C.banner, textColor: C.negro, fontStyle: 'bold', halign: 'center', fontSize: 8, minCellHeight: 5, cellPadding: 1 };
    const sCabHead = { fillColor: C.cabecera, textColor: C.negro, fontStyle: 'bold', halign: 'center', fontSize: 7.5, minCellHeight: 4 };

    // Anchos encabezado (suman 190mm)
    const COL1 = 35, COL2 = 110, COL3 = 45;

    let y = MGT;

    // ═══════════════════════════════════════════════════════
    // 1. ENCABEZADO — 2 filas; celda central dibujada manualmente
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y,
      margin: { left: MGS, right: MGS, bottom: 5 },
      body: [
        [
          { content: '', styles: { cellWidth: COL1, minCellHeight: 15, valign: 'middle' } },
          { content: '', styles: { cellWidth: COL2, minCellHeight: 15, valign: 'middle' } },
          { content: 'R-SC-01\nVersión N.° 0.0\nÚltima revisión:\n24/03/2026',
            styles: { halign: 'center', valign: 'middle', fontSize: 8,
                      textColor: C.negro, cellWidth: COL3, minCellHeight: 15, cellPadding: 1 } }
        ],
        [
          { content: `Caserío El Papayo Mz. O, Castilla,\nPiura, Piura, Perú\n${rucEmp}`,
            styles: { halign: 'center', valign: 'middle', fontSize: 7,
                      textColor: C.negro, cellWidth: COL1, minCellHeight: 8, cellPadding: 1 } },
          { content: 'Empresa dedicada al cultivo, procesamiento y comercialización de fruta fresca.',
            styles: { halign: 'center', valign: 'middle', fontStyle: 'italic', fontSize: 8,
                      textColor: C.negro, cellWidth: COL2, minCellHeight: 8, cellPadding: 1 } },
          { content: 'Frecuencia:\n_______________',
            styles: { halign: 'left', valign: 'middle', fontSize: 8,
                      textColor: C.negro, cellWidth: COL3, minCellHeight: 8, cellPadding: 2 } }
        ]
      ],
      theme: 'grid',
      styles: sBorder
    });

    // Logo encima celda izquierda fila 1 (x:10→45, y:5→20)
    if (logoB64) { try { doc.addImage(logoB64, 'JPEG', MGS + 4, y + 1, 27, 13); } catch(e) {} }

    // Texto celda central fila 1: empresa (8pt normal) + título (10pt bold)
    // Centro horizontal de COL2: x = MGS + COL1 + COL2/2 = 10+35+55 = 100mm
    const cX = MGS + COL1 + COL2 / 2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.negro);
    doc.text(nombreEmp, cX, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.negro);
    doc.text('REGISTRO DE INDUCCIÓN, CAPACITACIÓN,', cX, y + 9.5, { align: 'center' });
    doc.text('ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA', cX, y + 14, { align: 'center' });

    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 2. BANNER — DATOS DE LA ACTIVIDAD
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      body: [[{ content: 'DATOS DE LA ACTIVIDAD', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    let yA = doc.lastAutoTable.finalY;

    // ── Helpers de dibujo manual ──
    const ROW = 5;
    const _lbl = (text, x, yd) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...C.negro);
      doc.text(text, x, yd + 3.5);
    };
    const _val = (text, x, yd, maxW) => {
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...C.negro);
      doc.text(String(text||''), x, yd + 3.5, maxW ? { maxWidth: maxW } : undefined);
    };
    const _sub = (x1, y1, x2) => {
      doc.setDrawColor(...C.negro); doc.setLineWidth(0.2);
      doc.line(x1, y1, x2, y1);
    };

    // ═══════════════════════════════════════════════════════
    // 3. DATOS SIN CELDAS — texto + líneas horizontales
    // ═══════════════════════════════════════════════════════

    // TEMA
    _lbl('TEMA:', MGS + 1, yA);
    _val(v('capTema').trim(), MGS + 15, yA, bW - 16);
    _sub(MGS, yA + ROW, MGS + bW);
    yA += ROW;

    // FUENTE
    _lbl('FUENTE:', MGS + 1, yA);
    _val(v('capFuente').trim(), MGS + 20, yA, bW - 21);
    _sub(MGS, yA + ROW, MGS + bW);
    yA += ROW;

    // ═══════════════════════════════════════════════════════
    // 4. TIPO DE ACTIVIDAD — checkboxes manuales (banda gris)
    // ═══════════════════════════════════════════════════════
    const checkH = 6;
    doc.setFillColor(...C.banner);
    doc.setDrawColor(...C.negro); doc.setLineWidth(0.3);
    doc.rect(MGS, yA, bW, checkH, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...C.negro);
    doc.text('TIPO DE ACTIVIDAD:', MGS + 2, yA + 4);
    const labW2 = 38, colW2 = (bW - labW2) / tiposAll.length;
    tiposAll.forEach((t, i) => {
      const bx = MGS + labW2 + i * colW2 + 1, by = yA + 1.2;
      doc.setDrawColor(...C.negro); doc.setLineWidth(0.3);
      doc.rect(bx, by, 4, 4);
      if (tipos.includes(t)) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...C.rojo);
        doc.text('X', bx + 2, by + 3.4, { align: 'center' });
      }
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(...C.negro);
      doc.text(t, bx + 5.5, yA + 4);
    });
    yA += checkH;

    // ÁREA (mitad izq) + N° TRAB H/M (mitad der)
    const halfW = bW / 2;
    const nTrabV = v('capNTrab') || String(asistentes.length);
    const nHv    = v('capNH') || String(nH);
    const nMv    = v('capNM') || String(nM);
    _lbl('ÁREA:', MGS + 1, yA);
    _val(v('capArea').trim(), MGS + 13, yA, halfW - 14);
    _sub(MGS, yA + ROW, MGS + halfW);
    _lbl('N° TRAB:', MGS + halfW + 1, yA);
    _val(`${nTrabV}  H: ${nHv}  M: ${nMv}`, MGS + halfW + 22, yA, halfW - 23);
    _sub(MGS + halfW, yA + ROW, MGS + bW);
    yA += ROW;

    // LUGAR (65%) + FECHA (35%)
    const lugW = Math.round(bW * 0.65);
    _lbl('LUGAR:', MGS + 1, yA);
    _val(v('capLugar').trim(), MGS + 15, yA, lugW - 16);
    _sub(MGS, yA + ROW, MGS + lugW);
    _lbl('FECHA:', MGS + lugW + 1, yA);
    _val(v('capFecha'), MGS + lugW + 16, yA, bW - lugW - 17);
    _sub(MGS + lugW, yA + ROW, MGS + bW);
    yA += ROW;

    // H. INICIO + H. TÉRMINO + TOTAL HORAS (tercios)
    const segW = Math.round(bW / 3);
    _lbl('H. INICIO:', MGS + 1, yA);
    _val(v('capHoraInicio') || '', MGS + 24, yA);
    _sub(MGS, yA + ROW, MGS + segW);
    _lbl('H. TÉRMINO:', MGS + segW + 1, yA);
    _val(v('capHoraTermino') || '', MGS + segW + 28, yA);
    _sub(MGS + segW, yA + ROW, MGS + segW * 2);
    _lbl('TOTAL HORAS:', MGS + segW * 2 + 1, yA);
    _val(v('capHoras') || '—', MGS + segW * 2 + 30, yA);
    _sub(MGS + segW * 2, yA + ROW, MGS + bW);
    yA += ROW;

    // PRODUCTOR
    const prodV = v('capProductor') || nombreEmp;
    _lbl('PRODUCTOR:', MGS + 1, yA);
    _val(prodV, MGS + 27, yA, bW - 28);
    _sub(MGS, yA + ROW, MGS + bW);
    yA += ROW;

    y = yA;

    // ═══════════════════════════════════════════════════════
    // 5. CAPACITADOR
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      body: [[{ content: 'DATOS DE CAPACITADOR O ENTRENADOR', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / INSTITUCIÓN', 'FIRMA']],
      body: [['1', v('capCapDni').trim(), v('capCapNombre').trim(), v('capCapCargo').trim(), '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, fontSize: 7.5, cellPadding: 1, textColor: C.negro },
      bodyStyles: { halign: 'center', minCellHeight: 5 },
      columnStyles: { 0:{cellWidth:12}, 1:{cellWidth:25}, 2:{cellWidth:75}, 3:{cellWidth:55}, 4:{cellWidth:23} }
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 6. PARTICIPANTES — siempre 20 filas
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      body: [[{ content: 'PARTICIPANTES DE LA ACTIVIDAD', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    const filasPart = partList.map((p, i) => [
      String(i + 1), p.dni || '', p.nombre || '', p.cargo || '', '', p.obs || ''
    ]);

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA / HUELLA', 'OBS.']],
      body: filasPart,
      theme: 'grid',
      headStyles: { ...sCabHead, minCellHeight: 4 },
      styles: { ...sBorder, fontSize: 7, cellPadding: 0.7, textColor: C.negro, minCellHeight: 3.2 },
      bodyStyles: { halign: 'center' },
      columnStyles: {
        0: { cellWidth: 10 }, 1: { cellWidth: 22 },
        2: { cellWidth: 65, halign: 'left' }, 3: { cellWidth: 35, halign: 'left' },
        4: { cellWidth: 30 }, 5: { cellWidth: 28, halign: 'left' }
      },
      didParseCell: d => {
        if (d.section === 'body') {
          d.cell.styles.textColor = String(d.cell.raw || '').trim() ? C.negro : [200, 200, 200];
        }
      }
    });
    y = doc.lastAutoTable.finalY;

    // ═══════════════════════════════════════════════════════
    // 7. RESPONSABLE DEL REGISTRO
    // ═══════════════════════════════════════════════════════
    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      body: [[{ content: 'RESPONSABLE DEL REGISTRO / SEGURIDAD ALIMENTARIA', styles: sBanner }]],
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA']],
      body: [['1', respDni, respNombre, respCargo, '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, fontSize: 8, cellPadding: 1, textColor: C.negro },
      bodyStyles: { halign: 'center', minCellHeight: 7 },
      columnStyles: { 0:{cellWidth:12}, 1:{cellWidth:25}, 2:{cellWidth:75}, 3:{cellWidth:55}, 4:{cellWidth:23} }
    });

    // ── Forzar 1 sola página ──
    while (doc.internal.getNumberOfPages() > 1) doc.deletePage(doc.internal.getNumberOfPages());

    // ── Footer ──
    doc.setPage(1);
    const fechaGen = new Date().toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(140,140,140);
    doc.text(`Generado: ${fechaGen}  |  Sistema RL v3.0  |  ${USER.nombre}`, MGS, H - 4);
    doc.text('Pág. 1 de 1', W - MGS, H - 4, { align: 'right' });

    const fname = `R-SC-01_${empresa}_${v('capFecha')}_${v('capTema').trim().substring(0,20).replace(/[\s/\\:*?"<>|]+/g,'-')}.pdf`;
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
