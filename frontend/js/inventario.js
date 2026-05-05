'use strict';
/* ═══════════════════════════════════════════════════════════════════
   inventario.js  ·  Sistema RL v3.0  ·  v2
   Módulo de inventario, armado y distribución de canastas de víveres
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────── CONSTANTES ─────────────── */
const ROLES_PERMITIDOS = [
  'administrador', 'administrador 01', 'administrador 02',
  'admin', 'admin01', 'admin02'
];

// Sectores y supervisores se cargan dinámicamente del backend (window.invSectores / window.invSupervisores)

const DIAS_ALERTA_VENC = 7;

/* ─────────────── ESTADO GLOBAL ─────────────── */
let USER = null;
let API  = '';
let DATA = null; // { meta, productos, receta, responsables, ingresos, armadas, entregas }
let CALC = null; // { stockPorProd, vencPorProd, ingPorProd, totalArmadas, maxCanastas, totalEntregadas, disponibles }
let _modalCtx = null; // { tipo:'ingreso'|'armado'|'entrega', id, rowData }
let _sectorEditCtx = null; // { id, nombre } para modal editar sector
window.invSectores = window.invSectores || [];
window.invSupervisores = window.invSupervisores || [];

/* ─────────────── INIT ─────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if (!ud || !API) { location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

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

  const hoy = new Date().toISOString().split('T')[0];
  ['ingFecha', 'armarFecha', 'entFecha'].forEach(id => sv(id, hoy));
  sv('repHasta', hoy);
  sv('repDesde', new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]);

  cargarSectoresInv();
  cargarSupervisoresInv();
  cargarDatos();
});

async function cargarSectoresInv() {
  try {
    const res = await fetch(`${API}?action=invListarSectores`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.sectores)) {
      window.invSectores = data.sectores;
      document.querySelectorAll(
        'select[name="sector"], #ingresoSector, #armadoSector'
      ).forEach(sel => {
        const valActual = sel.value;
        sel.innerHTML = '<option value="">Seleccionar sector...</option>' +
          data.sectores.map(s => `<option value="${esc(s.nombre)}">${s.nombre}</option>`).join('');
        if (valActual) sel.value = valActual;
      });
      renderSectoresCfg();
      renderCheckboxesSectoresEntrega();
    }
  } catch (e) {
    console.error('Error cargando sectores:', e);
  }
}

async function cargarSupervisoresInv() {
  try {
    const res = await fetch(`${API}?action=invListarSupervisores`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.supervisores)) {
      window.invSupervisores = data.supervisores;
      document.querySelectorAll(
        'select[name="supervisor"], #ingresoSupervisor, #armadoSupervisor, #entregaSupervisor'
      ).forEach(sel => {
        const valActual = sel.value;
        sel.innerHTML = '<option value="">Seleccionar supervisor...</option>' +
          data.supervisores.map(s =>
            `<option value="${esc(s.nombre)}" data-sector="${esc(s.sector || '')}" data-usuario="${esc(s.usuario || '')}">${s.nombre}</option>`
          ).join('');
        if (valActual) sel.value = valActual;
      });
    }
  } catch (e) {
    console.error('Error cargando supervisores:', e);
  }
}

/* ─────────────── TABS ─────────────── */
function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('on');
  if (btn) btn.classList.add('on');
  if (['ingreso', 'armar', 'entregar', 'config'].includes(tab)) {
    cargarSectoresInv();
    cargarSupervisoresInv();
  }
}

/* ─────────────── CARGAR DATOS ─────────────── */
async function cargarDatos() {
  try {
    const d = await apiGet({ action: 'invGetAll' });
    if (!d.success) throw new Error(d.error || 'Error al cargar datos');

    // El backend devuelve { success, data: { ... } }
    // Si d.data es undefined (backend antiguo o sin desplegar) intentar d como fallback
    DATA = (d.data && typeof d.data === 'object') ? d.data : d;

    if (!DATA || typeof DATA !== 'object') {
      throw new Error('Backend no devolvió datos válidos. Pega codigo.gs en Apps Script, ejecuta invSetup() + invSetupCatalogo() y publica una nueva versión.');
    }

    // Normalizar arrays (compatibilidad con variaciones del backend)
    DATA.ingresos     = DATA.ingresos     || DATA.historialIngresos || [];
    DATA.armados      = DATA.armados      || DATA.historialArmados  || [];
    DATA.armadas      = DATA.armadas      || DATA.armados            || [];
    DATA.entregas     = DATA.entregas     || DATA.historialEntregas || [];
    DATA.productos    = DATA.productos    || [];
    DATA.receta       = DATA.receta       || [];
    DATA.responsables = DATA.responsables || [];
    // Normalizar meta: puede venir como { total: N } o como número directo
    const _rawMeta = DATA.meta;
    DATA.meta = (_rawMeta && typeof _rawMeta === 'object')
      ? Number(_rawMeta.total || _rawMeta.meta_total || 0)
      : Number(_rawMeta || 0);

    // Normalizar campos de fecha en cada registro (camelCase → snake_case)
    // Así todas las funciones de render usan siempre snake_case sin cambios
    DATA.ingresos = DATA.ingresos.map(i => Object.assign({}, i, {
      fecha:      i.fecha      || i.fechaIngreso  || i.fechaRegistro || '',
      fecha_venc: i.fecha_venc || i.fechaVenc     || ''
    }));
    DATA.armadas = DATA.armadas.map(a => Object.assign({}, a, {
      fecha: a.fecha || a.fechaRegistro || ''
    }));
    DATA.armados = DATA.armadas; // mantener alias sincronizado
    DATA.entregas = DATA.entregas.map(e => Object.assign({}, e, {
      fecha: e.fecha || e.fechaRegistro || ''
    }));
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
  const { receta, ingresos } = DATA;
  const armadas  = DATA.armadas  || [];
  const entregas = DATA.entregas || [];

  const totalArmadas = armadas.reduce((s, a) => s + Number(a.cantidad || 0), 0);

  const ingPorProd = {};
  ingresos.forEach(ing => {
    const k = ing.producto;
    ingPorProd[k] = (ingPorProd[k] || 0) + Number(ing.cantidad || 0);
  });

  const stockPorProd = {};
  receta.forEach(r => {
    const ingresado = ingPorProd[r.producto] || 0;
    const consumido = totalArmadas * Number(r.cantidad || 0);
    stockPorProd[r.producto] = Math.max(0, ingresado - consumido);
  });

  const vencPorProd = {};
  ingresos.forEach(ing => {
    if (!ing.fecha_venc) return;
    const k = ing.producto;
    if (!vencPorProd[k] || ing.fecha_venc < vencPorProd[k]) vencPorProd[k] = ing.fecha_venc;
  });

  let maxCanastas = receta.length ? Infinity : 0;
  receta.forEach(r => {
    const stock = stockPorProd[r.producto] || 0;
    const cant  = Number(r.cantidad) || 0;
    const posib = cant > 0 ? Math.floor(stock / cant) : 0;
    maxCanastas = Math.min(maxCanastas, posib);
  });
  if (maxCanastas === Infinity) maxCanastas = 0;

  const totalEntregadas = entregas.reduce((s, e) => s + Number(e.cantidad || 0), 0);
  const disponibles     = Math.max(0, totalArmadas - totalEntregadas);

  CALC = { stockPorProd, vencPorProd, ingPorProd, totalArmadas, maxCanastas, totalEntregadas, disponibles };
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
  renderEntregasHistorial();
  renderPorSector();
  renderProductosCatalogo();
  renderRecetaConfig();
  renderResponsablesConfig();
  renderSelectsProducto();
  renderSelectsResponsable();
  renderSelectProductoReceta();
  actualizarArmarPanel();
}

/* ─────────────── TAB RESUMEN ─────────────── */
function renderResumen() {
  console.log('[ARMAR] meta total recibida:', DATA.meta);
  const metaTotal = Number(DATA.meta) || 0;
  console.log('[ARMAR] formateado:', metaTotal.toLocaleString('es-PE'));

  const meta    = metaTotal;
  const armadas = CALC.totalArmadas;
  const disp    = CALC.disponibles;
  const entrega = CALC.totalEntregadas;
  const pct     = meta > 0 ? Math.min(100, Math.round((armadas / meta) * 100)) : 0;

  setText('stMeta',       meta.toLocaleString('es-PE'));
  setText('stArmadas',    armadas.toLocaleString('es-PE'));
  setText('stPct',        pct.toFixed(2) + '% de la meta');
  setText('stDisp',       disp.toLocaleString('es-PE'));
  setText('stEntregadas', entrega.toLocaleString('es-PE') + ' entregadas');
  setText('progLabel',    armadas.toLocaleString('es-PE') + ' / ' + meta.toLocaleString('es-PE'));

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
    if (dias < 0)              alertas.push(`<div class="alert alert-err">🔴 <b>${r.producto}</b> — VENCIDO (${fv})</div>`);
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
    const stock   = CALC.stockPorProd[r.producto] || 0;
    const cant    = Number(r.cantidad);
    const cubre   = cant > 0 ? Math.floor(stock / cant) : '—';
    const fv      = CALC.vencPorProd[r.producto] || '';
    const dias    = diasParaVencer(fv);
    const vencTxt = fv || '—';
    const estado  = dias === null ? `<span class="badge badge-blue">Sin lote</span>`
                  : dias < 0     ? `<span class="badge badge-err">VENCIDO</span>`
                  : dias <= 7    ? `<span class="badge badge-warn">Vence en ${dias}d</span>`
                  :                `<span class="badge badge-ok">OK</span>`;
    const rowCls  = dias !== null && dias < 0 ? 'row-err' : dias !== null && dias <= 7 ? 'row-warn' : '';
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
  const ultimas = [...(DATA.entregas || [])].reverse().slice(0, 10);
  if (!ultimas.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">Sin entregas</td></tr>'; return; }
  tb.innerHTML = ultimas.map(e => {
    const empBadge = e.empresa === 'RAPEL' ? 'badge-rap'
                   : e.empresa === 'VERFRUT' ? 'badge-vrf'
                   : 'badge-blue';
    return `<tr>
      <td>${e.fecha || ''}</td>
      <td><span class="badge ${empBadge}">${e.empresa || ''}</span></td>
      <td>${e.sector || ''}</td>
      <td style="font-weight:700">${Number(e.cantidad).toLocaleString('es-PE')}</td>
      <td style="font-size:12px">${e.responsable || ''}</td>
    </tr>`;
  }).join('');
}

/* ─────────────── TAB INGRESO ─────────────── */
function ingProductoCambia() {
  // Sugiere unidad si el producto está en la receta
  const prod = v('ingProducto');
  const rec  = (DATA && DATA.receta || []).find(r => r.producto === prod);
  if (rec) sv('ingUnidad', rec.unidad);
}

function renderIngresosHistorial() {
  const tb = document.getElementById('tbIngresos');
  if (!tb) return;
  const items = [...(DATA.ingresos || [])].reverse().slice(0, 30);
  if (!items.length) { tb.innerHTML = '<tr><td colspan="6" class="empty">Sin ingresos registrados</td></tr>'; return; }
  tb.innerHTML = items.map(i => {
    const dias = diasParaVencer(i.fecha_venc);
    const vTag = dias === null ? (i.fecha_venc || '—')
               : dias < 0     ? `<span class="badge badge-err">${i.fecha_venc} (VENCIDO)</span>`
               : dias <= 7    ? `<span class="badge badge-warn">${i.fecha_venc} (${dias}d)</span>`
               :                (i.fecha_venc || '—');
    return `<tr>
      <td>${i.fecha || ''}</td>
      <td><b>${i.producto || ''}</b></td>
      <td>${Number(i.cantidad).toLocaleString('es-PE')} ${i.unidad || ''}</td>
      <td>${vTag}</td>
      <td style="font-size:12px">${i.responsable || ''}</td>
      <td style="font-size:12px">${i.sector || '-'}</td>
      <td style="font-size:12px">${i.supervisor || '-'}</td>
      <td style="white-space:nowrap">
        <button class="btn-tbl btn-edit" onclick="abrirEditarIngreso('${esc(i.id)}')">✏️</button>
        <button class="btn-tbl btn-del"  onclick="eliminarIngreso('${esc(i.id)}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

async function registrarIngreso() {
  limpiarAlerta('alIngreso');
  const prod  = v('ingProducto');
  const cant  = parseFloat(v('ingCantidad'));
  const fvenc = v('ingFechaVenc');
  const unid  = v('ingUnidad').trim();
  const resp  = v('ingResponsable');
  const fecha = v('ingFecha');
  const sector     = v('ingresoSector');
  const supervisor = v('ingresoSupervisor');

  if (!prod)               { mostrarAlerta('alIngreso', 'err', 'Selecciona el producto'); return; }
  if (!cant || cant <= 0)  { mostrarAlerta('alIngreso', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (!unid)               { mostrarAlerta('alIngreso', 'err', 'Ingresa la unidad (kg, L, unid...)'); return; }
  if (!fvenc)              { mostrarAlerta('alIngreso', 'err', 'Ingresa la fecha de vencimiento'); return; }
  if (!resp)               { mostrarAlerta('alIngreso', 'err', 'Selecciona el responsable'); return; }

  const btn = document.getElementById('btnIngreso');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Guardando...';

  try {
    const d = await apiPost({
      action:     'invRegistrarIngreso',
      // snake_case (backend repo) y camelCase (backend desplegado) simultáneos
      producto: prod, cantidad: cant, unidad: unid, responsable: resp,
      usuario: USER.usuario, usuario_nombre: USER.nombre,
      fecha:        fecha,  fechaIngreso: fecha,
      fecha_venc:   fvenc,  fechaVenc:    fvenc,
      ingreso: { producto: prod, cantidad: cant, unidad: unid, responsable: resp,
                 fecha: fecha, fechaIngreso: fecha,
                 fecha_venc: fvenc, fechaVenc: fvenc,
                 sector, supervisor,
                 usuario: USER.usuario }
    });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    mostrarAlerta('alIngreso', 'ok', `✅ Ingreso registrado: ${cant} ${unid} de ${prod}`);
    sv('ingCantidad', ''); sv('ingFechaVenc', ''); sv('ingUnidad', '');
    sv('ingresoSector', ''); sv('ingresoSupervisor', '');
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
  setText('maxCanastas', CALC.maxCanastas.toLocaleString('es-PE'));
  const btn = document.getElementById('btnConfirmarArmado');
  if (btn) btn.disabled = true;
  const prev = document.getElementById('previewArmado');
  if (prev) prev.style.display = 'none';
}

function renderArmadosHistorial() {
  const tb = document.getElementById('tbArmados');
  if (!tb) return;
  const armadas = DATA.armadas || [];
  const items = [...armadas].reverse().slice(0, 30);
  if (!items.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">Sin armados</td></tr>'; return; }
  tb.innerHTML = items.map(a => `<tr>
    <td>${a.fecha || ''}</td>
    <td style="font-weight:700">${Number(a.cantidad).toLocaleString('es-PE')}</td>
    <td style="font-size:12px">${a.usuario || ''}</td>
    <td style="font-size:12px">${a.sector || '-'}</td>
    <td style="font-size:12px">${a.supervisor || '-'}</td>
    <td style="white-space:nowrap">
      <button class="btn-tbl btn-edit" onclick="abrirEditarArmado('${esc(a.id)}')">✏️</button>
      <button class="btn-tbl btn-del"  onclick="eliminarArmado('${esc(a.id)}')">🗑️</button>
    </td>
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

  const tbody = document.getElementById('tbPreviewBody');
  if (tbody) {
    tbody.innerHTML = DATA.receta.map(r => {
      const totalDesc     = cant * Number(r.cantidad);
      const stockActual   = CALC.stockPorProd[r.producto] || 0;
      const stockRestante = stockActual - totalDesc;
      return `<tr>
        <td><b>${r.producto}</b></td>
        <td>${r.cantidad} ${r.unidad}</td>
        <td style="color:#dc2626;font-weight:700">−${totalDesc.toLocaleString('es-PE')} ${r.unidad}</td>
        <td style="font-weight:700;color:${stockRestante < 0 ? '#dc2626' : '#166534'}">${stockRestante.toLocaleString('es-PE')} ${r.unidad}</td>
      </tr>`;
    }).join('');
  }

  if (mostrar || (prev && prev.style.display !== 'none')) {
    if (prev) prev.style.display = '';
  }
  if (btn) btn.disabled = false;
}

async function confirmarArmado() {
  limpiarAlerta('alArmar');
  const cant   = parseInt(v('armarCantidad'));
  const fecha  = v('armarFecha');
  const sector = v('armadoSector');
  const resp   = v('armadoResponsable');

  if (!cant || cant <= 0)      { mostrarAlerta('alArmar', 'err', 'Ingresa la cantidad de canastas a armar'); return; }
  if (cant > CALC.maxCanastas) { mostrarAlerta('alArmar', 'err', `Stock insuficiente. Máximo: ${CALC.maxCanastas}`); return; }
  if (!fecha)                  { mostrarAlerta('alArmar', 'err', 'La fecha es obligatoria'); return; }
  if (!sector)                 { mostrarAlerta('alArmar', 'err', 'Selecciona el sector'); return; }
  if (!resp)                   { mostrarAlerta('alArmar', 'err', 'Selecciona el responsable'); return; }
  if (!confirm(`¿Confirmar armado de ${cant.toLocaleString('es-PE')} canastas? Esta acción descontará el stock.`)) return;

  const btn = document.getElementById('btnConfirmarArmado');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Procesando...';
  try {
    const d = await apiPost({ action: 'invRegistrarArmado',
      fecha, cantidad: cant, usuario: USER.usuario, usuario_nombre: USER.nombre,
      armado: { fecha, cantidad: cant, responsable: resp, sector, supervisor: '', usuario: USER.usuario }
    });
    if (!d.success) throw new Error(d.error || 'Error al registrar');
    mostrarAlerta('alArmar', 'ok', `✅ ${cant.toLocaleString('es-PE')} canastas armadas correctamente`);
    sv('armarCantidad', '');
    sv('armadoSector', ''); sv('armadoResponsable', '');
    document.getElementById('previewArmado').style.display = 'none';
    await cargarDatos();
  } catch(e) {
    mostrarAlerta('alArmar', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '✓ Confirmar armado';
  }
}

/* ─────────────── TAB ENTREGAR ─────────────── */
function renderCheckboxesSectoresEntrega() {
  const wrap = document.getElementById('entSectoresChecks');
  if (!wrap) return;
  const sectores = window.invSectores || [];
  if (!sectores.length) {
    wrap.innerHTML = '<div class="empty" style="grid-column:1/-1;padding:12px">No hay sectores activos. Ve a ⚙️ Configuración.</div>';
    setText('entSectoresCount', 0);
    return;
  }
  wrap.innerHTML = sectores.map(s =>
    `<label class="sector-check-lbl"><input type="checkbox" class="ent-sector-check" value="${esc(s.nombre)}" onchange="actualizarContadorSectoresEntrega()">${s.nombre}</label>`
  ).join('');
  actualizarContadorSectoresEntrega();
}

function actualizarContadorSectoresEntrega() {
  const n = document.querySelectorAll('.ent-sector-check:checked').length;
  setText('entSectoresCount', n);
}

function validarCantidadEntrega() {
  const hint = document.getElementById('entCantidadHint');
  if (!hint) return;
  const cant = parseInt(v('entCantidad'));
  const disp = (CALC && CALC.disponibles) || 0;
  if (cant && cant > disp) {
    hint.textContent = `❌ No puedes entregar más de ${disp.toLocaleString('es-PE')} canastas`;
    hint.style.display = '';
  } else {
    hint.style.display = 'none';
  }
}

function renderPorSector() {
  // Resumen agrupado por fecha + empresa (puede haber múltiples sectores en una sola fila)
  const tb = document.getElementById('tbPorSector');
  if (!tb) return;
  const disp = document.getElementById('dispParaEntregar');
  if (disp) disp.textContent = (CALC?.disponibles || 0).toLocaleString('es-PE');

  const mapa = {};
  (DATA.entregas || []).forEach(e => {
    const k = (e.fecha || '') + '|' + (e.empresa || '');
    if (!mapa[k]) mapa[k] = { fecha: e.fecha || '', empresa: e.empresa || '', sectores: new Set(), total: 0 };
    String(e.sector || '').split(',').map(s => s.trim()).filter(Boolean).forEach(s => mapa[k].sectores.add(s));
    mapa[k].total += Number(e.cantidad || 0);
  });
  const filas = Object.values(mapa).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  if (!filas.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">Sin entregas</td></tr>'; return; }
  tb.innerHTML = filas.map(f => {
    const sectores = Array.from(f.sectores).join(', ');
    const empBadge = f.empresa === 'RAPEL' ? 'badge-rap'
                   : f.empresa === 'VERFRUT' ? 'badge-vrf'
                   : 'badge-blue';
    return `<tr>
      <td>${f.fecha || ''}</td>
      <td><span class="badge ${empBadge}">${f.empresa || ''}</span></td>
      <td style="font-size:12px;max-width:320px;word-wrap:break-word">${sectores}</td>
      <td style="font-weight:700">${f.total.toLocaleString('es-PE')}</td>
    </tr>`;
  }).join('');
}

function renderEntregasHistorial() {
  const tb = document.getElementById('tbEntregas');
  if (!tb) return;
  const items = [...(DATA.entregas || [])].reverse().slice(0, 30);
  if (!items.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">Sin entregas</td></tr>'; return; }
  tb.innerHTML = items.map(e => {
    const sec = e.sector || '';
    const secCorto = sec.length > 50 ? sec.substring(0, 47) + '…' : sec;
    const empBadge = e.empresa === 'RAPEL' ? 'badge-rap'
                   : e.empresa === 'VERFRUT' ? 'badge-vrf'
                   : 'badge-blue';
    return `<tr>
      <td>${e.fecha || ''}</td>
      <td><span class="badge ${empBadge}">${e.empresa || ''}</span></td>
      <td style="font-size:12px;max-width:240px;word-wrap:break-word" title="${esc(sec)}">${secCorto}</td>
      <td style="font-weight:700">${Number(e.cantidad).toLocaleString('es-PE')}</td>
      <td style="font-size:12px">${e.responsable || ''}</td>
      <td style="font-size:12px">${e.exportadora || '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn-tbl btn-edit" onclick="abrirEditarEntrega('${esc(e.id)}')">✏️</button>
        <button class="btn-tbl btn-del"  onclick="eliminarEntrega('${esc(e.id)}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

async function registrarEntrega() {
  limpiarAlerta('alEntregar');
  const fecha       = v('entFecha');
  const empresa     = v('entEmpresa');
  const exportadora = v('entExportadora').trim();
  const resp        = v('entResponsable');
  const cant        = parseInt(v('entCantidad'));
  const observaciones = v('entObservaciones').trim();
  const sectoresSel = Array.from(document.querySelectorAll('.ent-sector-check:checked')).map(c => c.value);

  if (!fecha)                   { mostrarAlerta('alEntregar', 'err', 'La fecha es obligatoria'); return; }
  if (!empresa)                 { mostrarAlerta('alEntregar', 'err', 'Selecciona la empresa'); return; }
  if (!resp)                    { mostrarAlerta('alEntregar', 'err', 'Selecciona el responsable'); return; }
  if (sectoresSel.length === 0) { mostrarAlerta('alEntregar', 'err', 'Marca al menos un sector'); return; }
  if (!cant || cant <= 0)       { mostrarAlerta('alEntregar', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (cant > CALC.disponibles) {
    mostrarAlerta('alEntregar', 'err', `No puedes entregar más de ${CALC.disponibles.toLocaleString('es-PE')} canastas`); return;
  }

  const sectoresStr = sectoresSel.join(', ');

  const btn = document.getElementById('btnEntrega');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Registrando...';
  try {
    const d = await apiPost({ action: 'invRegistrarEntrega',
      fecha, empresa, sector: sectoresStr, cantidad: cant, responsable: resp,
      usuario: USER.usuario, usuario_nombre: USER.nombre,
      entrega: { fecha, empresa, sector: sectoresStr, cantidad: cant, responsable: resp, supervisor: '', exportadora, observaciones, usuario: USER.usuario }
    });
    if (!d.success) throw new Error(d.error || 'Error al registrar');
    mostrarAlerta('alEntregar', 'ok', `✅ Entrega registrada: ${cant.toLocaleString('es-PE')} canastas → ${sectoresStr}`);
    sv('entCantidad', '');
    sv('entObservaciones', '');
    sv('entExportadora', '');
    document.querySelectorAll('.ent-sector-check').forEach(c => c.checked = false);
    actualizarContadorSectoresEntrega();
    validarCantidadEntrega();
    await cargarDatos();
  } catch(e) {
    mostrarAlerta('alEntregar', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '🚚 Registrar entrega';
  }
}

/* ─────────────── TAB PRODUCTOS (CATÁLOGO) ─────────────── */
function renderProductosCatalogo() {
  const tb = document.getElementById('tbProductos');
  if (!tb) return;
  const prods = DATA.productos || [];
  if (!prods.length) { tb.innerHTML = '<tr><td colspan="3" class="empty">Sin productos. Ejecuta invSetupCatalogo() en Apps Script.</td></tr>'; return; }
  tb.innerHTML = prods.map(p => `<tr>
    <td><b>${p.nombre}</b></td>
    <td><span class="badge badge-ok">Activo</span></td>
    <td style="white-space:nowrap">
      <button class="btn-tbl btn-edit" onclick="abrirEditarProducto('${esc(p.id)}','${esc(p.nombre)}')">✏️</button>
      <button class="btn-tbl btn-del"  onclick="eliminarProductoCatalogo('${esc(p.id)}')">🗑️</button>
    </td>
  </tr>`).join('');
}

async function agregarProductoCatalogo() {
  limpiarAlerta('alProductos');
  const nombre = v('cfgProdNombre').trim();
  if (!nombre) { mostrarAlerta('alProductos', 'err', 'El nombre es obligatorio'); return; }
  try {
    const d = await apiPost({ action: 'invAgregarProducto', nombre, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    sv('cfgProdNombre', '');
    await cargarDatos();
    mostrarAlerta('alProductos', 'ok', `✅ Producto "${nombre}" agregado`);
  } catch(e) { mostrarAlerta('alProductos', 'err', '❌ ' + e.message); }
}

function abrirEditarProducto(id, nombre) {
  sv('modalProdId', id);
  sv('modalProdNombre', nombre);
  document.getElementById('modalProdAlert').innerHTML = '';
  document.getElementById('modalProd').style.display = 'flex';
  setTimeout(() => document.getElementById('modalProdNombre').focus(), 50);
}
function cerrarModalProd(e) {
  if (e && e.target !== document.getElementById('modalProd')) return;
  document.getElementById('modalProd').style.display = 'none';
}

async function confirmarEditarProducto() {
  const id     = v('modalProdId');
  const nombre = v('modalProdNombre').trim();
  const al     = document.getElementById('modalProdAlert');
  if (!nombre) { al.innerHTML = '<div class="alert alert-err">El nombre es obligatorio</div>'; return; }
  try {
    const d = await apiPost({ action: 'invEditarProducto', id, nombre, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    document.getElementById('modalProd').style.display = 'none';
    await cargarDatos();
  } catch(e) { al.innerHTML = `<div class="alert alert-err">❌ ${e.message}</div>`; }
}

async function eliminarProductoCatalogo(id) {
  const prod = (DATA.productos || []).find(p => p.id === id);
  if (!confirm(`¿Eliminar "${prod ? prod.nombre : id}" del catálogo?`)) return;
  try {
    const d = await apiPost({ action: 'invEliminarProducto', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
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

    const logoB64 = await _getLogoBase64();
    doc.setFillColor(10, 36, 99); doc.rect(mg, y, W - 2*mg, 18, 'F');
    if (logoB64) { try { doc.addImage(logoB64, 'JPEG', mg+2, y+2, 24, 12); } catch(e) {} }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('INVENTARIO CANASTAS DE VÍVERES', W/2, y+7, { align:'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(_labelReporte(tipo) + (empresa ? ' · ' + empresa : '') + ' · ' + (desde||'inicio') + ' a ' + (hasta||'hoy'), W/2, y+13, { align:'center' });
    y += 22;

    if (DATA && CALC) {
      const meta = Number(DATA.meta || 0);
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

    const armadas = DATA.armadas || [];
    if (tipo === 'ingresos' || tipo === 'general') {
      const rows = filtrar(DATA.ingresos || [], null);
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
      const rows = filtrar(armadas, null);
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
      const rows = filtrar(DATA.entregas || [], 'empresa');
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
function renderSelectProductoReceta() {
  const sel = document.getElementById('cfgProd');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Seleccionar del catálogo...</option>';
  const enReceta = new Set((DATA.receta || []).map(r => r.producto));
  (DATA.productos || []).forEach(p => {
    if (!enReceta.has(p.nombre)) {
      const opt = document.createElement('option');
      opt.value = p.nombre; opt.textContent = p.nombre;
      sel.appendChild(opt);
    }
  });
  if (cur) sel.value = cur;
}

function renderRecetaConfig() {
  const tb = document.getElementById('tbReceta');
  if (!tb) return;
  if (!(DATA.receta || []).length) { tb.innerHTML = '<tr><td colspan="4" class="empty">Sin productos</td></tr>'; return; }
  tb.innerHTML = DATA.receta.map(r => `<tr>
    <td><b>${r.producto}</b></td>
    <td>${r.cantidad}</td>
    <td>${r.unidad}</td>
    <td><button class="btn-tbl btn-del" onclick="eliminarProducto('${esc(r.producto)}')">✕</button></td>
  </tr>`).join('');
}

function renderResponsablesConfig() {
  const tb = document.getElementById('tbResponsables');
  if (!tb) return;
  const resp = DATA.responsables || [];
  if (!resp.length) { tb.innerHTML = '<tr><td class="empty">Sin responsables</td></tr>'; return; }
  tb.innerHTML = resp.map(r => `<tr><td>${typeof r === 'string' ? r : r.nombre}</td></tr>`).join('');
}

function renderSelectsProducto() {
  const sel = document.getElementById('ingProducto');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Seleccionar producto...</option>';
  (DATA.productos || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre; opt.textContent = p.nombre;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function renderSelectsResponsable() {
  ['ingResponsable', 'entResponsable', 'armadoResponsable'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Seleccionar...</option>';
    (DATA.responsables || []).forEach(r => {
      const nombre = typeof r === 'string' ? r : r.nombre;
      const opt = document.createElement('option');
      opt.value = nombre; opt.textContent = nombre;
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
  const prod = v('cfgProd');
  const cant = parseFloat(v('cfgCant'));
  const unid = v('cfgUnid').trim();
  if (!prod) { mostrarAlerta('alReceta', 'err', 'Selecciona un producto del catálogo'); return; }
  if (!cant || cant <= 0) { mostrarAlerta('alReceta', 'err', 'La cantidad debe ser mayor a 0'); return; }
  if (!unid) { mostrarAlerta('alReceta', 'err', 'La unidad es obligatoria'); return; }
  try {
    const d = await apiPost({ action: 'invAgregarReceta', producto: prod, cantidad: cant, unidad: unid, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    sv('cfgProd',''); sv('cfgCant',''); sv('cfgUnid','');
    await cargarDatos();
  } catch(e) { mostrarAlerta('alReceta', 'err', '❌ ' + e.message); }
}

async function eliminarProducto(prod) {
  if (!confirm('¿Eliminar este producto de la receta? No afecta ingresos ya registrados.')) return;
  try {
    const d = await apiPost({ action: 'invEliminarReceta', producto: prod, usuario: USER.usuario });
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

/* ─────────────── MODAL EDITAR (genérico) ─────────────── */
function abrirEditarIngreso(id) {
  const item = (DATA.ingresos || []).find(i => i.id === id);
  if (!item) return;
  _modalCtx = { tipo: 'ingreso', id };

  const optsResp = _optsResponsables(item.responsable);
  const optsProd = _optsCatalogo(item.producto);
  const optsSec  = _optsSectoresInv(item.sector);
  const optsSup  = _optsSupervisores(item.supervisor);

  document.getElementById('modalTitle').textContent = '✏️ Editar ingreso';
  document.getElementById('modalForm').innerHTML = `
    <div class="grid2" style="gap:12px">
      <div class="fg full"><label class="lbl">Producto</label><select id="mIngProducto">${optsProd}</select></div>
      <div class="fg"><label class="lbl">Cantidad</label><input type="number" id="mIngCantidad" value="${item.cantidad}" min="0.01" step="0.01"></div>
      <div class="fg"><label class="lbl">Unidad</label><input type="text" id="mIngUnidad" value="${item.unidad || ''}"></div>
      <div class="fg"><label class="lbl">Fecha venc.</label><input type="date" id="mIngFechaVenc" value="${item.fecha_venc || ''}"></div>
      <div class="fg"><label class="lbl">Responsable</label><select id="mIngResponsable">${optsResp}</select></div>
      <div class="fg"><label class="lbl">Fecha ingreso</label><input type="date" id="mIngFecha" value="${item.fecha || ''}"></div>
      <div class="fg"><label class="lbl">Sector</label><select id="mIngSector">${optsSec}</select></div>
      <div class="fg"><label class="lbl">Supervisor</label><select id="mIngSupervisor">${optsSup}</select></div>
    </div>`;
  document.getElementById('modalAlert').innerHTML = '';
  document.getElementById('modalEdit').style.display = 'flex';
}

function abrirEditarArmado(id) {
  const item = (DATA.armadas || []).find(a => a.id === id);
  if (!item) return;
  _modalCtx = { tipo: 'armado', id };

  const optsSec  = _optsSectoresInv(item.sector);
  const optsResp = _optsResponsables(item.responsable || item.usuario);

  document.getElementById('modalTitle').textContent = '✏️ Editar armado';
  document.getElementById('modalForm').innerHTML = `
    <div class="grid2" style="gap:12px">
      <div class="fg"><label class="lbl">Cantidad</label><input type="number" id="mArmCantidad" value="${item.cantidad}" min="1" step="1"></div>
      <div class="fg"><label class="lbl">Fecha</label><input type="date" id="mArmFecha" value="${item.fecha || ''}"></div>
      <div class="fg"><label class="lbl">Sector</label><select id="mArmSector">${optsSec}</select></div>
      <div class="fg"><label class="lbl">Responsable</label><select id="mArmResponsable"><option value="">Seleccionar...</option>${optsResp}</select></div>
    </div>
    <div class="alert alert-info" style="margin-top:12px;font-size:12px">Disponibles actuales: <b>${CALC.disponibles.toLocaleString('es-PE')}</b> · Entregadas: <b>${CALC.totalEntregadas.toLocaleString('es-PE')}</b></div>`;
  document.getElementById('modalAlert').innerHTML = '';
  document.getElementById('modalEdit').style.display = 'flex';
}

function abrirEditarEntrega(id) {
  const item = (DATA.entregas || []).find(e => e.id === id);
  if (!item) return;
  _modalCtx = { tipo: 'entrega', id };

  const optsEmp  = ['RAPEL','VERFRUT','AMBAS'].map(e => `<option value="${e}" ${e===item.empresa?'selected':''}>${e}</option>`).join('');
  const checksSec = _checksSectoresInv(item.sector);
  const optsResp = _optsResponsables(item.responsable);

  document.getElementById('modalTitle').textContent = '✏️ Editar entrega';
  document.getElementById('modalForm').innerHTML = `
    <div class="grid2" style="gap:12px">
      <div class="fg"><label class="lbl">Empresa</label><select id="mEntEmpresa">${optsEmp}</select></div>
      <div class="fg"><label class="lbl">Cantidad</label><input type="number" id="mEntCantidad" value="${item.cantidad}" min="1" step="1"></div>
      <div class="fg"><label class="lbl">Responsable</label><select id="mEntResponsable">${optsResp}</select></div>
      <div class="fg"><label class="lbl">Fecha</label><input type="date" id="mEntFecha" value="${item.fecha || ''}"></div>
      <div class="fg full"><label class="lbl">Exportadora</label><input type="text" id="mEntExportadora" value="${esc(item.exportadora || '')}" placeholder="Ej: Camposol, AgroKasma..."></div>
    </div>
    <div class="sectores-box" style="margin-top:12px">
      <div class="sectores-box-title">Sectores entregados *</div>
      <div class="sectores-grid">${checksSec}</div>
    </div>
    <div class="alert alert-info" style="margin-top:12px;font-size:12px">Disponibles actuales: <b>${CALC.disponibles.toLocaleString('es-PE')}</b></div>`;
  document.getElementById('modalAlert').innerHTML = '';
  document.getElementById('modalEdit').style.display = 'flex';
}

function cerrarModal(e) {
  if (e && e.target !== document.getElementById('modalEdit')) return;
  document.getElementById('modalEdit').style.display = 'none';
  _modalCtx = null;
}

async function confirmarEditar() {
  if (!_modalCtx) return;
  const al  = document.getElementById('modalAlert');
  const btn = document.getElementById('modalBtnGuardar');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  al.innerHTML = '';

  try {
    let body = { usuario: USER.usuario };
    const { tipo, id } = _modalCtx;
    body.id = id;

    if (tipo === 'ingreso') {
      body.action  = 'invEditarIngreso';
      body.ingreso = {
        cantidad:     parseFloat(v('mIngCantidad')),
        unidad:       v('mIngUnidad').trim(),
        fechaVenc:    v('mIngFechaVenc'),
        responsable:  v('mIngResponsable'),
        fechaIngreso: v('mIngFecha'),
        sector:       v('mIngSector'),
        supervisor:   v('mIngSupervisor')
      };
      if (!body.ingreso.cantidad || body.ingreso.cantidad <= 0) throw new Error('Cantidad obligatoria');
    } else if (tipo === 'armado') {
      body.action = 'invEditarArmado';
      body.armado = {
        cantidad:    parseInt(v('mArmCantidad')),
        fecha:       v('mArmFecha'),
        sector:      v('mArmSector'),
        responsable: v('mArmResponsable')
      };
      if (!body.armado.cantidad || body.armado.cantidad <= 0) throw new Error('Cantidad inválida');
    } else if (tipo === 'entrega') {
      body.action  = 'invEditarEntrega';
      const sectoresSel = Array.from(document.querySelectorAll('.m-ent-sector-check:checked')).map(c => c.value);
      body.entrega = {
        empresa:     v('mEntEmpresa'),
        sector:      sectoresSel.join(', '),
        cantidad:    parseInt(v('mEntCantidad')),
        responsable: v('mEntResponsable'),
        fecha:       v('mEntFecha'),
        exportadora: v('mEntExportadora').trim()
      };
      if (!body.entrega.empresa || !body.entrega.sector || !body.entrega.cantidad || body.entrega.cantidad <= 0) throw new Error('Empresa, sector(es) y cantidad son obligatorios');
    }

    const d = await apiPost(body);
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    document.getElementById('modalEdit').style.display = 'none';
    _modalCtx = null;
    await cargarDatos();
  } catch(e) {
    al.innerHTML = `<div class="alert alert-err">❌ ${e.message}</div>`;
  } finally {
    btn.disabled = false; btn.innerHTML = '💾 Guardar cambios';
  }
}

/* ─────────────── SECTORES (CONFIG) ─────────────── */
function renderSectoresCfg() {
  const tb = document.getElementById('tbSectores');
  if (!tb) return;
  const sectores = window.invSectores || [];
  if (!sectores.length) { tb.innerHTML = '<tr><td colspan="2" class="empty">Sin sectores</td></tr>'; return; }
  tb.innerHTML = sectores.map(s => `<tr>
    <td><b>${s.nombre}</b></td>
    <td style="white-space:nowrap">
      <button class="btn-tbl btn-edit" onclick="abrirEditarSector('${esc(s.id)}','${esc(s.nombre)}')">✏️</button>
      <button class="btn-tbl btn-del"  onclick="eliminarSector('${esc(s.id)}','${esc(s.nombre)}')">🗑️</button>
    </td>
  </tr>`).join('');
}

async function agregarSector() {
  limpiarAlerta('alSectores');
  const nombre = v('cfgSectorNombre').trim();
  if (!nombre) { mostrarAlerta('alSectores', 'err', 'El nombre es obligatorio'); return; }
  try {
    const d = await apiPost({ action: 'invAgregarSector', nombre, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    sv('cfgSectorNombre', '');
    await cargarSectoresInv();
    mostrarAlerta('alSectores', 'ok', `✅ Sector "${nombre}" agregado`);
  } catch(e) { mostrarAlerta('alSectores', 'err', '❌ ' + e.message); }
}

function abrirEditarSector(id, nombre) {
  _sectorEditCtx = { id, nombre };
  sv('modalSectorId', id);
  sv('modalSectorNombre', nombre);
  document.getElementById('modalSectorAlert').innerHTML = '';
  document.getElementById('modalSector').style.display = 'flex';
  setTimeout(() => document.getElementById('modalSectorNombre').focus(), 50);
}

function cerrarModalSector(e) {
  if (e && e.target !== document.getElementById('modalSector')) return;
  document.getElementById('modalSector').style.display = 'none';
  _sectorEditCtx = null;
}

async function confirmarEditarSector() {
  const id     = v('modalSectorId');
  const nombre = v('modalSectorNombre').trim();
  const al     = document.getElementById('modalSectorAlert');
  if (!nombre) { al.innerHTML = '<div class="alert alert-err">El nombre es obligatorio</div>'; return; }
  try {
    const d = await apiPost({ action: 'invEditarSector', id, nombre, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    document.getElementById('modalSector').style.display = 'none';
    _sectorEditCtx = null;
    await cargarSectoresInv();
  } catch(e) { al.innerHTML = `<div class="alert alert-err">❌ ${e.message}</div>`; }
}

async function eliminarSector(id, nombre) {
  if (!confirm(`¿Eliminar el sector "${nombre}"?`)) return;
  try {
    const d = await apiPost({ action: 'invEliminarSector', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'Error al eliminar');
    await cargarSectoresInv();
  } catch(e) { alert('❌ ' + e.message); }
}

/* ─────────────── ELIMINAR REGISTROS ─────────────── */
async function eliminarIngreso(id) {
  if (!confirm('¿Eliminar este ingreso? Afectará el cálculo de stock.')) return;
  try {
    const d = await apiPost({ action: 'invEliminarIngreso', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

async function eliminarArmado(id) {
  if (!confirm('¿Eliminar este armado? El backend validará que no queden canastas disponibles en negativo.')) return;
  try {
    const d = await apiPost({ action: 'invEliminarArmado', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

async function eliminarEntrega(id) {
  if (!confirm('¿Eliminar esta entrega?')) return;
  try {
    const d = await apiPost({ action: 'invEliminarEntrega', id, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error);
    await cargarDatos();
  } catch(e) { alert('❌ ' + e.message); }
}

/* ─────────────── HELPERS MODAL ─────────────── */
function _optsResponsables(selected) {
  return (DATA.responsables || []).map(r => {
    const n = typeof r === 'string' ? r : r.nombre;
    return `<option value="${n}" ${n === selected ? 'selected' : ''}>${n}</option>`;
  }).join('');
}

function _optsCatalogo(selected) {
  return (DATA.productos || []).map(p => {
    return `<option value="${p.nombre}" ${p.nombre === selected ? 'selected' : ''}>${p.nombre}</option>`;
  }).join('');
}

function _optsSectoresInv(selected) {
  const list = (window.invSectores || []).map(s => s.nombre || s);
  return '<option value="">Seleccionar...</option>' + list.map(s =>
    `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${s}</option>`
  ).join('');
}

function _checksSectoresInv(selected) {
  const list = (window.invSectores || []).map(s => s.nombre || s);
  const seleccionados = String(selected || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return '<div class="empty" style="grid-column:1/-1;padding:8px">Sin sectores</div>';
  return list.map(s =>
    `<label class="sector-check-lbl"><input type="checkbox" class="m-ent-sector-check" value="${esc(s)}" ${seleccionados.includes(s) ? 'checked' : ''}>${s}</label>`
  ).join('');
}

function _optsSupervisores(selected) {
  return '<option value="">Seleccionar...</option>' + (window.invSupervisores || []).map(s =>
    `<option value="${esc(s.nombre)}" ${s.nombre === selected ? 'selected' : ''}>${s.nombre}</option>`
  ).join('');
}

/* ─────────────── HELPERS ─────────────── */
function v(id)       { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function esc(s)      { return String(s||'').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

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
