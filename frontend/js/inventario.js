'use strict';
/* ═══════════════════════════════════════════════════════════════════
   inventario.js  ·  Sistema RL v3.0
   Módulo de inventario, armado y distribución de canastas de víveres
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────── CONSTANTES ─────────────── */
const ROLES_PERMITIDOS = [
  'administrador', 'administrador 01', 'administrador 02',
  'admin', 'admin01', 'admin02'
];

const SECTORES = {
  RAPEL:   ['San Vicente', 'El Papayo', 'Limones', 'Los Olivares', 'APROA',
             'Algarrobos', 'Operaciones Campo', 'Administración', 'Planta Rapel'],
  VERFRUT: ['Olivares Bajo', 'Santa Rosa', 'Inversiones', 'Arándanos',
             'Riego', 'Departamento Técnico Verfrut', 'Punta Arenas']
};

const DIAS_ALERTA_VENC = 7;

/* ─────────────── ESTADO GLOBAL ─────────────── */
let USER = null;
let API  = '';
let DATA = null; // { receta, responsables, meta, ingresos, armadas, entregas }
let CALC = null; // { stockPorProd, totalArmadas, maxCanastas, totalEntregadas, disponibles }

/* ─────────────── INIT ─────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if (!ud || !API) { location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

  // Verificar rol de administrador
  const rol = (USER.rol || '').toLowerCase().trim();
  if (!ROLES_PERMITIDOS.includes(rol)) {
    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Barlow,sans-serif;gap:12px;color:#64748b">
      <div style="font-size:48px">🔒</div>
      <div style="font-size:18px;font-weight:700;color:#0f172a">Acceso restringido</div>
      <div style="font-size:14px">Este módulo es solo para administradores.</div>
      <a href="dashboard.html" style="margin-top:8px;color:#0a2463;font-weight:700;font-size:14px">← Volver al dashboard</a>
    </div>`;
    return;
  }

  const el = document.getElementById('topNombre');
  if (el) el.textContent = USER.nombre || USER.usuario || '';

  // Fecha default hoy en todos los inputs de fecha
  const hoy = new Date().toISOString().split('T')[0];
  ['ingFecha', 'armarFecha', 'entFecha'].forEach(id => sv(id, hoy));

  // Rango default reporte: últimos 30 días
  sv('repHasta', hoy);
  sv('repDesde', new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]);

  cargarDatos();
});

/* ─────────────── TABS ─────────────── */
function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('on');
  if (btn) btn.classList.add('on');
}

/* ─────────────── CARGAR DATOS ─────────────── */
async function cargarDatos() {
  try {
    const d = await apiGet({ action: 'invGetAll' });
    if (!d.success) throw new Error(d.error || 'Error al cargar datos');
    DATA = d.data;
    calcular();
    renderAll();
  } catch(e) {
    console.error('[INV] cargarDatos:', e);
    mostrarAlerta('alIngreso', 'err', '❌ Error al cargar datos: ' + e.message);
  }
}

/* ─────────────── CÁLCULOS ─────────────── */
function calcular() {
  if (!DATA) return;
  const { receta, ingresos, armadas, entregas } = DATA;

  // Total canastas armadas
  const totalArmadas = armadas.reduce((s, a) => s + Number(a.cantidad || 0), 0);

  // Total ingresado por producto (nombre → cantidad acumulada)
  const ingPorProd = {};
  ingresos.forEach(ing => {
    const k = ing.producto;
    ingPorProd[k] = (ingPorProd[k] || 0) + Number(ing.cantidad || 0);
  });

  // Stock por producto = ingresado − (armadas × cantidad_receta)
  const stockPorProd = {};
  receta.forEach(r => {
    const ingresado = ingPorProd[r.producto] || 0;
    const consumido = totalArmadas * Number(r.cantidad || 0);
    stockPorProd[r.producto] = Math.max(0, ingresado - consumido);
  });

  // Fecha de vencimiento más próxima por producto (mínimo entre lotes)
  const vencPorProd = {};
  ingresos.forEach(ing => {
    if (!ing.fecha_venc) return;
    const k = ing.producto;
    if (!vencPorProd[k] || ing.fecha_venc < vencPorProd[k]) vencPorProd[k] = ing.fecha_venc;
  });

  // Max canastas armables = MIN(floor(stock / cant_receta)) para todos los productos
  let maxCanastas = receta.length ? Infinity : 0;
  receta.forEach(r => {
    const stock  = stockPorProd[r.producto] || 0;
    const cant   = Number(r.cantidad) || 0;
    const posib  = cant > 0 ? Math.floor(stock / cant) : 0;
    maxCanastas  = Math.min(maxCanastas, posib);
  });
  if (maxCanastas === Infinity) maxCanastas = 0;

  // Canastas entregadas y disponibles
  const totalEntregadas = entregas.reduce((s, e) => s + Number(e.cantidad || 0), 0);
  const disponibles     = Math.max(0, totalArmadas - totalEntregadas);

  CALC = { stockPorProd, vencPorProd, totalArmadas, maxCanastas, totalEntregadas, disponibles, ingPorProd };
}

function diasParaVencer(fechaStr) {
  if (!fechaStr) return null;
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaStr + 'T00:00:00');
  return Math.round((venc - hoy) / 86400000);
}

/* ─────────────── RENDER ALL ─────────────── */
function renderAll() {
  if (!DATA || !CALC) return;
  renderResumen();
  renderStock();
  renderEntregasRecientes();
  renderIngresosHistorial();
  renderArmadosHistorial();
  renderPorSector();
  renderRecetaConfig();
  renderResponsablesConfig();
  renderSelectsProducto();
  renderSelectsResponsable();
  actualizarArmarPanel();
}

/* ─────────────── TAB RESUMEN ─────────────── */
function renderResumen() {
  const meta     = Number(DATA.meta.meta_total || 0);
  const armadas  = CALC.totalArmadas;
  const disp     = CALC.disponibles;
  const entrega  = CALC.totalEntregadas;
  const pct      = meta > 0 ? Math.min(100, Math.round((armadas / meta) * 100)) : 0;

  setText('stMeta',      meta.toLocaleString('es-PE'));
  setText('stArmadas',   armadas.toLocaleString('es-PE'));
  setText('stPct',       pct + '% de la meta');
  setText('stDisp',      disp.toLocaleString('es-PE'));
  setText('stEntregadas', entrega.toLocaleString('es-PE') + ' entregadas');
  setText('progLabel',   armadas.toLocaleString('es-PE') + ' / ' + meta.toLocaleString('es-PE'));

  const pb = document.getElementById('progBar');
  if (pb) setTimeout(() => { pb.style.width = pct + '%'; }, 80);
  if (pct >= 100 && pb) pb.style.background = '#16a34a';

  sv('cfgMeta', meta || '');
  renderAlertasVenc();
}

function renderAlertasVenc() {
  const wrap = document.getElementById('alertasVenc');
  if (!wrap || !DATA.receta.length) return;
  const alertas = [];
  DATA.receta.forEach(r => {
    const fv   = CALC.vencPorProd[r.producto];
    const dias = diasParaVencer(fv);
    if (dias === null) return;
    if (dias < 0)  alertas.push(`<div class="alert alert-err">🔴 <b>${r.producto}</b> — VENCIDO (${fv})</div>`);
    else if (dias <= DIAS_ALERTA_VENC) alertas.push(`<div class="alert alert-warn">⚠️ <b>${r.producto}</b> vence en ${dias} día${dias !== 1 ? 's' : ''} (${fv})</div>`);
  });
  wrap.innerHTML = alertas.join('');
}

function renderStock() {
  const tb = document.getElementById('tbStock');
  if (!tb || !DATA) return;
  if (!DATA.receta.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty">Sin productos en la receta. Ve a ⚙️ Configuración.</td></tr>';
    return;
  }
  tb.innerHTML = DATA.receta.map(r => {
    const stock    = CALC.stockPorProd[r.producto] || 0;
    const cant     = Number(r.cantidad);
    const cubre    = cant > 0 ? Math.floor(stock / cant) : '—';
    const fv       = CALC.vencPorProd[r.producto] || '';
    const dias     = diasParaVencer(fv);
    const vencTxt  = fv || '—';
    const estado   = dias === null ? `<span class="badge badge-blue">Sin lote</span>`
                   : dias < 0     ? `<span class="badge badge-err">VENCIDO</span>`
                   : dias <= 7    ? `<span class="badge badge-warn">Vence en ${dias}d</span>`
                   :                `<span class="badge badge-ok">OK</span>`;
    const rowCls   = dias !== null && dias < 0 ? 'row-err' : dias !== null && dias <= 7 ? 'row-warn' : '';
    return `<tr class="${rowCls}">
      <td><b>${r.producto}</b></td>
      <td>${r.cantidad} ${r.unidad}</td>
      <td>${(CALC.ingPorProd[r.producto] || 0).toLocaleString('es-PE')} ${r.unidad}</td>
      <td style="font-weight:700">${stock.toLocaleString('es-PE')} ${r.unidad}</td>
      <td style="font-weight:700;color:#0a2463">${typeof cubre === 'number' ? cubre.toLocaleString('es-PE') : cubre}</td>
      <td style="font-size:12px">${vencTxt}</td>
      <td>${estado}</td>
    </tr>`;
  }).join('');
}

function renderEntregasRecientes() {
  const tb = document.getElementById('tbEntregasRecientes');
  if (!tb) return;
  const ultimas = [...DATA.entregas].reverse().slice(0, 10);
  if (!ultimas.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">Sin entregas</td></tr>'; return; }
  tb.innerHTML = ultimas.map(e => `<tr>
    <td>${e.fecha || ''}</td>
    <td><span class="badge ${e.empresa === 'RAPEL' ? 'badge-rap' : 'badge-vrf'}">${e.empresa || ''}</span></td>
    <td>${e.sector || ''}</td>
    <td style="font-weight:700">${Number(e.cantidad).toLocaleString('es-PE')}</td>
    <td style="font-size:12px">${e.responsable || ''}</td>
  </tr>`).join('');
}

/* ─────────────── TAB INGRESO ─────────────── */
function renderIngresosHistorial() {
  const tb = document.getElementById('tbIngresos');
  if (!tb) return;
  const items = [...DATA.ingresos].reverse().slice(0, 20);
  if (!items.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">Sin ingresos registrados</td></tr>'; return; }
  tb.innerHTML = items.map(i => {
    const dias = diasParaVencer(i.fecha_venc);
    const vTag = dias === null ? i.fecha_venc || '—'
               : dias < 0     ? `<span class="badge badge-err">${i.fecha_venc} (VENCIDO)</span>`
               : dias <= 7    ? `<span class="badge badge-warn">${i.fecha_venc} (${dias}d)</span>`
               :                i.fecha_venc || '—';
    return `<tr>
      <td>${i.fecha || ''}</td>
      <td><b>${i.producto || ''}</b></td>
      <td>${Number(i.cantidad).toLocaleString('es-PE')} ${i.unidad || ''}</td>
      <td>${vTag}</td>
      <td style="font-size:12px">${i.responsable || ''}</td>
    </tr>`;
  }).join('');
}

async function registrarIngreso() {
  limpiarAlerta('alIngreso');
  const prod   = v('ingProducto');
  const cant   = parseFloat(v('ingCantidad'));
  const fvenc  = v('ingFechaVenc');
  const resp   = v('ingResponsable');
  const fecha  = v('ingFecha');

  if (!prod)         { mostrarAlerta('alIngreso', 'err', 'Selecciona el producto'); return; }
  if (!cant || cant <= 0) { mostrarAlerta('alIngreso', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (!fvenc)        { mostrarAlerta('alIngreso', 'err', 'Ingresa la fecha de vencimiento'); return; }
  if (!resp)         { mostrarAlerta('alIngreso', 'err', 'Selecciona el responsable'); return; }

  const recItem = DATA.receta.find(r => r.producto === prod);
  const btn = document.getElementById('btnIngreso');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Guardando...';

  try {
    const d = await apiPost({
      action:       'invRegistrarIngreso',
      fecha:        fecha,
      producto:     prod,
      cantidad:     cant,
      unidad:       recItem ? recItem.unidad : '',
      fecha_venc:   fvenc,
      responsable:  resp,
      usuario:      USER.usuario,
      usuario_nombre: USER.nombre
    });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    mostrarAlerta('alIngreso', 'ok', `✅ Ingreso registrado: ${cant} ${recItem?.unidad || ''} de ${prod}`);
    sv('ingCantidad', ''); sv('ingFechaVenc', '');
    await cargarDatos();
  } catch(e) {
    mostrarAlerta('alIngreso', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '✅ Registrar ingreso';
  }
}

/* ─────────────── TAB ARMAR ─────────────── */
function actualizarArmarPanel() {
  if (!CALC) return;
  const max = CALC.maxCanastas;
  setText('maxCanastas', max.toLocaleString('es-PE'));
  const btn = document.getElementById('btnConfirmarArmado');
  if (btn) btn.disabled = true;
  document.getElementById('previewArmado').style.display = 'none';
}

function renderArmadosHistorial() {
  const tb = document.getElementById('tbArmados');
  if (!tb) return;
  const items = [...DATA.armadas].reverse().slice(0, 20);
  if (!items.length) { tb.innerHTML = '<tr><td colspan="3" class="empty">Sin armados</td></tr>'; return; }
  tb.innerHTML = items.map(a => `<tr>
    <td>${a.fecha || ''}</td>
    <td style="font-weight:700">${Number(a.cantidad).toLocaleString('es-PE')}</td>
    <td style="font-size:12px">${a.usuario || ''}</td>
  </tr>`).join('');
}

function actualizarPreview(mostrar = false) {
  if (!DATA || !CALC) return;
  const cant = parseInt(v('armarCantidad'));
  const prev = document.getElementById('previewArmado');
  const btn  = document.getElementById('btnConfirmarArmado');
  limpiarAlerta('alArmar');

  if (!cant || cant <= 0) { if (prev) prev.style.display = 'none'; if (btn) btn.disabled = true; return; }
  if (cant > CALC.maxCanastas) {
    mostrarAlerta('alArmar', 'err', `❌ Stock insuficiente. Máximo armable: ${CALC.maxCanastas.toLocaleString('es-PE')}`);
    if (prev) prev.style.display = 'none'; if (btn) btn.disabled = true; return;
  }

  // Calcular preview
  const tbody = document.getElementById('tbPreviewBody');
  if (tbody) {
    tbody.innerHTML = DATA.receta.map(r => {
      const totalDesc    = cant * Number(r.cantidad);
      const stockActual  = CALC.stockPorProd[r.producto] || 0;
      const stockRestante = stockActual - totalDesc;
      return `<tr>
        <td><b>${r.producto}</b></td>
        <td>${r.cantidad} ${r.unidad}</td>
        <td style="color:#dc2626;font-weight:700">−${totalDesc.toLocaleString('es-PE')} ${r.unidad}</td>
        <td style="font-weight:700;color:${stockRestante < 0 ? '#dc2626' : '#166534'}">${stockRestante.toLocaleString('es-PE')} ${r.unidad}</td>
      </tr>`;
    }).join('');
  }

  if (mostrar || prev.style.display !== 'none') {
    if (prev) prev.style.display = '';
  }
  if (btn) btn.disabled = false;
}

async function confirmarArmado() {
  limpiarAlerta('alArmar');
  const cant  = parseInt(v('armarCantidad'));
  const fecha = v('armarFecha');

  if (!cant || cant <= 0) { mostrarAlerta('alArmar', 'err', 'Ingresa la cantidad de canastas a armar'); return; }
  if (cant > CALC.maxCanastas) { mostrarAlerta('alArmar', 'err', `Stock insuficiente. Máximo: ${CALC.maxCanastas}`); return; }

  if (!confirm(`¿Confirmar armado de ${cant.toLocaleString('es-PE')} canastas? Esta acción descontará el stock.`)) return;

  const btn = document.getElementById('btnConfirmarArmado');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Procesando...';

  try {
    const d = await apiPost({
      action:   'invRegistrarArmado',
      fecha,
      cantidad: cant,
      usuario:  USER.usuario,
      usuario_nombre: USER.nombre
    });
    if (!d.success) throw new Error(d.error || 'Error al registrar');
    mostrarAlerta('alArmar', 'ok', `✅ ${cant.toLocaleString('es-PE')} canastas armadas correctamente`);
    sv('armarCantidad', '');
    document.getElementById('previewArmado').style.display = 'none';
    await cargarDatos();
  } catch(e) {
    mostrarAlerta('alArmar', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '✓ Confirmar armado';
  }
}

/* ─────────────── TAB ENTREGAR ─────────────── */
function filtrarSectores() {
  const empresa = v('entEmpresa');
  const sel = document.getElementById('entSector');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar sector...</option>';
  if (empresa && SECTORES[empresa]) {
    SECTORES[empresa].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  }
}

function renderPorSector() {
  const tb = document.getElementById('tbPorSector');
  if (!tb) return;
  const disp = document.getElementById('dispParaEntregar');
  if (disp) disp.textContent = (CALC?.disponibles || 0).toLocaleString('es-PE');

  // Agrupar por empresa + sector
  const mapa = {};
  DATA.entregas.forEach(e => {
    const k = (e.empresa || '') + '|' + (e.sector || '');
    mapa[k] = (mapa[k] || 0) + Number(e.cantidad || 0);
  });
  const keys = Object.keys(mapa).sort();
  if (!keys.length) { tb.innerHTML = '<tr><td colspan="3" class="empty">Sin entregas</td></tr>'; return; }
  tb.innerHTML = keys.map(k => {
    const [emp, sec] = k.split('|');
    return `<tr>
      <td><span class="badge ${emp === 'RAPEL' ? 'badge-rap' : 'badge-vrf'}">${emp}</span></td>
      <td>${sec}</td>
      <td style="font-weight:700">${mapa[k].toLocaleString('es-PE')}</td>
    </tr>`;
  }).join('');
}

async function registrarEntrega() {
  limpiarAlerta('alEntregar');
  const empresa = v('entEmpresa');
  const sector  = v('entSector');
  const cant    = parseInt(v('entCantidad'));
  const resp    = v('entResponsable');
  const fecha   = v('entFecha');

  if (!empresa)          { mostrarAlerta('alEntregar', 'err', 'Selecciona la empresa'); return; }
  if (!sector)           { mostrarAlerta('alEntregar', 'err', 'Selecciona el sector'); return; }
  if (!cant || cant <= 0){ mostrarAlerta('alEntregar', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (!resp)             { mostrarAlerta('alEntregar', 'err', 'Selecciona el responsable'); return; }
  if (cant > CALC.disponibles) {
    mostrarAlerta('alEntregar', 'err', `Solo hay ${CALC.disponibles} canastas disponibles para entregar`); return;
  }

  const btn = document.getElementById('btnEntrega');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Registrando...';
  try {
    const d = await apiPost({
      action: 'invRegistrarEntrega',
      fecha, empresa, sector,
      cantidad: cant,
      responsable: resp,
      usuario: USER.usuario,
      usuario_nombre: USER.nombre
    });
    if (!d.success) throw new Error(d.error || 'Error al registrar');
    mostrarAlerta('alEntregar', 'ok', `✅ Entrega registrada: ${cant} canastas → ${sector} (${empresa})`);
    sv('entCantidad', '');
    await cargarDatos();
  } catch(e) {
    mostrarAlerta('alEntregar', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '🚚 Registrar entrega';
  }
}

/* ─────────────── TAB REPORTES ─────────────── */
async function generarPDF() {
  const tipo    = v('repTipo');
  const empresa = v('repEmpresa');
  const desde   = v('repDesde');
  const hasta   = v('repHasta');
  const fb      = document.getElementById('repFeedback');
  const btn     = document.getElementById('btnReporte');

  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Generando...';
  if (fb) fb.textContent = '';

  try {
    // Filtrar datos locales según rango y empresa
    const filtrar = (arr, campoEmp) => arr.filter(r => {
      const f = r.fecha || '';
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      if (empresa && campoEmp && r[campoEmp] !== empresa) return false;
      return true;
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, mg = 12;
    let y = mg;

    // ── Header ──
    const logoB64 = await _getLogoBase64();
    doc.setFillColor(10, 36, 99); doc.rect(mg, y, W - 2*mg, 18, 'F');
    if (logoB64) { try { doc.addImage(logoB64, 'JPEG', mg+2, y+2, 24, 12); } catch(e) {} }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('INVENTARIO CANASTAS DE VÍVERES', W/2, y+7, { align:'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(_labelReporte(tipo) + (empresa ? ' · ' + empresa : '') + ' · ' + (desde||'inicio') + ' a ' + (hasta||'hoy'), W/2, y+13, { align:'center' });
    y += 22;

    // ── Resumen general (siempre) ──
    if (DATA && CALC) {
      const meta = Number(DATA.meta.meta_total || 0);
      doc.autoTable({
        startY: y, margin: { left: mg, right: mg },
        head: [['Indicador', 'Valor']],
        body: [
          ['Meta total de canastas', meta.toLocaleString('es-PE')],
          ['Canastas armadas',       CALC.totalArmadas.toLocaleString('es-PE')],
          ['Canastas entregadas',    CALC.totalEntregadas.toLocaleString('es-PE')],
          ['Canastas disponibles',   CALC.disponibles.toLocaleString('es-PE')],
          ['% de avance',           (meta > 0 ? Math.round((CALC.totalArmadas/meta)*100) : 0) + '%']
        ],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [10,36,99], textColor:[255,255,255], fontStyle:'bold' },
        columnStyles: { 0: { fontStyle:'bold' } }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // ── Sección según tipo ──
    if (tipo === 'ingresos' || tipo === 'general') {
      const rows = filtrar(DATA.ingresos, null);
      if (rows.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(10,36,99);
        doc.text('INGRESOS DE MERCADERÍA', mg, y); y += 4;
        doc.autoTable({
          startY: y, margin: { left: mg, right: mg },
          head: [['Fecha','Producto','Cantidad','Vence','Responsable']],
          body: rows.map(r => [r.fecha||'', r.producto||'', `${r.cantidad} ${r.unidad||''}`, r.fecha_venc||'', r.responsable||'']),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30,58,138], textColor:[255,255,255], fontStyle:'bold', fontSize:7 },
          alternateRowStyles: { fillColor: [248,250,252] }
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    if (tipo === 'armados' || tipo === 'general') {
      const rows = filtrar(DATA.armadas, null);
      if (rows.length) {
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(10,36,99);
        doc.text('ARMADOS DE CANASTAS', mg, y); y += 4;
        doc.autoTable({
          startY: y, margin: { left: mg, right: mg },
          head: [['Fecha','Cantidad armada','Usuario']],
          body: rows.map(r => [r.fecha||'', Number(r.cantidad).toLocaleString('es-PE'), r.usuario||'']),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30,58,138], textColor:[255,255,255], fontStyle:'bold', fontSize:7 }
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    if (tipo === 'entregas' || tipo === 'general') {
      const rows = filtrar(DATA.entregas, 'empresa');
      if (rows.length) {
        doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(10,36,99);
        doc.text('ENTREGAS POR SECTOR', mg, y); y += 4;
        doc.autoTable({
          startY: y, margin: { left: mg, right: mg },
          head: [['Fecha','Empresa','Sector','Cantidad','Responsable']],
          body: rows.map(r => [r.fecha||'', r.empresa||'', r.sector||'', Number(r.cantidad).toLocaleString('es-PE'), r.responsable||'']),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30,58,138], textColor:[255,255,255], fontStyle:'bold', fontSize:7 },
          alternateRowStyles: { fillColor: [248,250,252] }
        });
      }
    }

    // ── Footer ──
    const totalPages = doc.internal.getNumberOfPages();
    const fechaGen = new Date().toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const pH = doc.internal.pageSize.height;
      doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(140,140,140);
      doc.text(`Generado: ${fechaGen}  |  Sistema RL v3.0  |  ${USER.nombre}`, mg, pH - 5);
      doc.text(`Pág. ${p} de ${totalPages}`, W - mg, pH - 5, { align:'right' });
    }

    const fname = `Inventario_${tipo}_${desde}_${hasta}${empresa ? '_' + empresa : ''}.pdf`;
    doc.save(fname);
    if (fb) fb.textContent = '✅ PDF descargado: ' + fname;
  } catch(e) {
    console.error('[INV PDF]', e);
    if (fb) fb.textContent = '❌ Error: ' + e.message;
  } finally {
    btn.disabled = false; btn.innerHTML = '📥 Generar y descargar PDF';
  }
}

function _labelReporte(tipo) {
  return { general:'Resumen General', ingresos:'Ingresos', armados:'Armados', entregas:'Entregas' }[tipo] || tipo;
}

async function _getLogoBase64() {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg'));
      } catch(e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = '../images/logo-unifrutti.jpg';
  });
}

/* ─────────────── TAB CONFIGURACIÓN ─────────────── */
function renderRecetaConfig() {
  const tb = document.getElementById('tbReceta');
  if (!tb) return;
  if (!DATA.receta.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">Sin productos</td></tr>'; return; }
  tb.innerHTML = DATA.receta.map(r => `<tr>
    <td><b>${r.producto}</b></td>
    <td>${r.cantidad}</td>
    <td>${r.unidad}</td>
    <td><button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;cursor:pointer" onclick="eliminarProducto('${esc(r.id || r.producto)}')">✕</button></td>
  </tr>`).join('');
}

function renderResponsablesConfig() {
  const tb = document.getElementById('tbResponsables');
  if (!tb) return;
  if (!DATA.responsables.length) { tb.innerHTML = '<tr><td class="empty">Sin responsables</td></tr>'; return; }
  tb.innerHTML = DATA.responsables.map(r => `<tr><td>${r.nombre}</td></tr>`).join('');
}

function renderSelectsProducto() {
  const sel = document.getElementById('ingProducto');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar producto...</option>';
  DATA.receta.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.producto; opt.textContent = r.producto + ' (' + r.cantidad + ' ' + r.unidad + ')';
    sel.appendChild(opt);
  });
  // Auto-fill unidad
  sel.onchange = () => {
    const rec = DATA.receta.find(r => r.producto === sel.value);
    sv('ingUnidad', rec ? rec.unidad : '');
  };
}

function renderSelectsResponsable() {
  ['ingResponsable', 'entResponsable'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    DATA.responsables.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.nombre; opt.textContent = r.nombre;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  });
}

async function guardarMeta() {
  const meta = parseInt(v('cfgMeta'));
  if (!meta || meta <= 0) { alert('Ingresa un número válido mayor a 0'); return; }
  try {
    const d = await apiPost({ action: 'invGuardarMeta', meta_total: meta, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    alert('✅ Meta guardada: ' + meta.toLocaleString('es-PE') + ' canastas');
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

async function agregarProductoReceta() {
  limpiarAlerta('alReceta');
  const prod = v('cfgProd').trim();
  const cant = parseFloat(v('cfgCant'));
  const unid = v('cfgUnid').trim();
  if (!prod) { mostrarAlerta('alReceta', 'err', 'El nombre del producto es obligatorio'); return; }
  if (!cant || cant <= 0) { mostrarAlerta('alReceta', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (!unid) { mostrarAlerta('alReceta', 'err', 'La unidad es obligatoria'); return; }
  if (DATA.receta.find(r => r.producto.toLowerCase() === prod.toLowerCase())) {
    mostrarAlerta('alReceta', 'err', 'Ya existe un producto con ese nombre en la receta'); return;
  }
  try {
    const d = await apiPost({ action: 'invAgregarReceta', producto: prod, cantidad: cant, unidad: unid, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    sv('cfgProd',''); sv('cfgCant',''); sv('cfgUnid','');
    await cargarDatos();
  } catch(e) { mostrarAlerta('alReceta', 'err', '❌ ' + e.message); }
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto de la receta? No afecta ingresos ya registrados.')) return;
  try {
    const d = await apiPost({ action: 'invEliminarReceta', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

async function agregarResponsable() {
  const nombre = v('cfgRespNombre').trim();
  if (!nombre) { alert('Ingresa el nombre del responsable'); return; }
  try {
    const d = await apiPost({ action: 'invAgregarResponsable', nombre, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    sv('cfgRespNombre', '');
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

/* ─────────────── HELPERS ─────────────── */
function v(id)       { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function esc(s)      { return String(s||'').replace(/'/g, "\\'"); }

function mostrarAlerta(wrapId, tipo, msg) {
  const el = document.getElementById(wrapId);
  if (!el) return;
  const cls = tipo === 'ok' ? 'alert-ok' : tipo === 'warn' ? 'alert-warn' : 'alert-err';
  el.innerHTML = `<div class="alert ${cls}">${msg}</div>`;
  if (tipo !== 'err') setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}
function limpiarAlerta(wrapId) { const el = document.getElementById(wrapId); if (el) el.innerHTML = ''; }

async function apiGet(p) {
  const r = await fetch(API + '?' + new URLSearchParams(p));
  return r.json();
}
async function apiPost(b) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } });
  return r.json();
}
