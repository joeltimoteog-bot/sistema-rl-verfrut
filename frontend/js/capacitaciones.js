// _MODALES_CUSTOM_V1 (07-jun-2026): migración a appAlert/appConfirm/appPrompt
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

const COOLDOWN_MS       = 3000;
const FILAS_POR_FORMATO = 12;   /* _FIRMA_HUELLA_V4: 20 -> 12 filas, para que la celda de firma sea mas alta y el formato siga entrando en UNA hoja */

/* ─── Paso previo + retroactivo ─── */
let _trabajadoresProgramados = 0;
let _totalFormatos           = 1;
let _esRetroactivo           = false;
let _fechaRetroactiva        = null;
let _motivoRetroactivo       = '';
let _capGuardada             = false; // flujo unificado guardar+PDF
let _topeEnCurso             = 0;     /* _CAP_LISTAS_TOPE_V1: busquedas de DNI en vuelo (para no pasarse del tope) */
let _topePreguntando         = false; /* _CAP_LISTAS_TOPE_V1: hay un aviso de tope abierto */

/* ─────────────────────── LISTAS DESPLEGABLES ─────────────────────── */
const LISTAS_DEFAULT = {
  labor:    [],   /* _CAP_LISTAS_TOPE_V1: el usuario arma su lista con Gestionar */
  servicio: [],   /* _CAP_LISTAS_TOPE_V1 */
  tema:   [
    'BUENAS PRÁCTICAS SOCIALES, LABORALES, COMERCIO ÉTICO Y SUSTENTABILIDAD / ÉTICA EMPRESARIAL',
    'Uso correcto de EPP', 'Manejo seguro de agroquímicos', 'Seguridad e Higiene Industrial'
  ],
  fuente: [
    'CAP-SC-09 / CAP-SC-10 / CAP-SC-13 / PROCEDIMIENTOS Y CÓDIGO DE CONDUCTA',
    'Normativa interna'
  ],
  area:   ['Cosecha', 'Packing', 'Campo', 'Riego', 'Almacén', 'Administración'],
  /* _FUNDO_CAP_V2 (28-ago-2026): fundos entregados por Joel el 28-ago.
     Tal cual me los paso. Si alguno esta mal escrito se corrige aqui o con
     el boton Gestionar de la pantalla. */
  fundo:  [
    'ALGARROBOS', 'APROA', 'EL PAPAYO', 'LIMONES', 'LOS OLIVARES',
    'OLIVARES BAJO', 'PLANTA RAPEL', 'PUNTA ARENAS', 'SAN VICENTE', 'SANTA ROSA'
  ]
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
  // Restaurar selección previa o elegir el primer ítem por defecto
  if (actual && items.includes(actual)) {
    sel.value = actual;
  } else if (tipo === 'labor' || tipo === 'servicio') {
    sel.value = '';   /* _CAP_LISTAS_TOPE_V1: Labor y Servicio arrancan en blanco (no se elige nada solo) */
  } else if (items.length > 0) {
    sel.value = items[0];
  }
}

function inicializarListasCapacitaciones() {
  ['tema', 'fuente', 'area', 'fundo', 'labor', 'servicio'].forEach(t => poblarSelect(t));   /* _CAP_LISTAS_TOPE_V1 */
}

function gestionarLista(tipo) {
  _listaActiva = tipo;
  const titulos = { tema: 'Temas', fuente: 'Fuentes', area: 'Áreas', fundo: 'Fundos', labor: 'Labores', servicio: 'Servicios o contratistas' };   /* _CAP_LISTAS_TOPE_V1 */
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

async function editarItem(idx) {
  if (!_listaActiva) return;
  const items = cargarLista(_listaActiva);
  const anterior = items[idx];
  const nuevo = await appPrompt('Editar ítem:', items[idx]);
  if (nuevo === null || !nuevo.trim()) return;
  const nuevoTexto = nuevo.trim();
  const id = 'cap' + _listaActiva.charAt(0).toUpperCase() + _listaActiva.slice(1);
  const sel = document.getElementById(id);
  // ¿el ítem que se está corrigiendo era justo el elegido en el formulario?
  const eraSeleccionado = !!(sel && sel.value === anterior);
  items[idx] = nuevoTexto;
  guardarLista(_listaActiva, items);
  poblarSelect(_listaActiva);
  // _FIX_EDICION_LISTA_V1: si era el seleccionado, forzar el texto ya corregido
  // (evita que el campo quede con un ítem distinto tras editar el actualmente elegido)
  if (eraSeleccionado && sel) sel.value = nuevoTexto;
  renderizarItemsLista(_listaActiva);
}

async function eliminarItem(idx) {
  if (!_listaActiva) return;
  const items = cargarLista(_listaActiva);
  if (!await appConfirm(`¿Eliminar "${items[idx]}"?`)) return;
  items.splice(idx, 1);
  guardarLista(_listaActiva, items);
  poblarSelect(_listaActiva);
  renderizarItemsLista(_listaActiva);
}

/* ─────────────────────── INIT ─────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* _SESION_V1 (04-set-2026): antes se exigia que sessionStorage trajera
     TAMBIEN la direccion de la API, y si faltaba se expulsaba al usuario sin
     ningun aviso. El dashboard (linea 2984) y el monitor nunca lo exigieron:
     usan una direccion de respaldo. Aqui se hace lo mismo. El candado real
     sigue siendo el usuario: sin sesion no se entra. */
  const API_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || API_URL_DEFAULT;
  if (!ud) { location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

  const el = document.getElementById('topNombre');
  if (el) el.textContent = USER.nombre || USER.usuario || '';

  // Empresa default según rol del usuario
  const emp = (USER.empresa || '').toUpperCase();
  if (emp.includes('RAPEL') && !emp.includes('VERFRUT')) sv('capEmpresa', 'RAPEL');
  else if (emp.includes('VERFRUT')) sv('capEmpresa', 'VERFRUT');

  // Fecha y hora de hoy
  const now = new Date();
  sv('capFecha', _hoyLimaCap(now));   /* _CAP_HOY_LIMA_V1: antes toISOString (UTC) -> despues de las 7 p.m. salia el dia siguiente */
  sv('capHoraInicio', now.toTimeString().slice(0, 5));

  // Feedback visual en checkboxes de tipo
  document.querySelectorAll('#capTipoGroup .check-item input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.closest('.check-item').classList.toggle('checked', cb.checked);
    });
  });

  // Rango export default: últimos 30 días
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  sv('expDesde', _hoyLimaCap(hace30));   /* _CAP_HOY_LIMA_V1 */
  sv('expHasta', _hoyLimaCap(now));

  // Mostrar paso0 al iniciar
  _mostrarPaso(0);
  _actualizarPreviewFormatos(20);

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

/* ─────────────────────── PASO 0: TRABAJADORES ─────────────────────── */
function _mostrarPaso(n) {
  ['paso0','paso1','paso2'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.display = (i === n) ? '' : 'none';
  });
  ['step0-ind','step1-ind','step2-ind'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('on','done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('on');
  });
}

function _activarTabNueva(btnId) {
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('on');
  const tc = document.getElementById('tab-nueva');
  if (tc) tc.classList.add('on');
  if (typeof detenerScanner === 'function') detenerScanner();
}

function abrirNuevaCapacitacion() {
  _esRetroactivo = false; _fechaRetroactiva = null; _motivoRetroactivo = '';
  asistentes = []; _dniCooldown = {};
  _activarTabNueva('tabBtnNueva');
  _mostrarPaso(0);
  sv('cantTrabajadores', '20');
  const sl = document.getElementById('sliderTrabajadores');
  if (sl) sl.value = 20;
  _actualizarPreviewFormatos(20);
  const br = document.getElementById('bannerRetroactivo');
  if (br) br.style.display = 'none';
}

function abrirCapacitacionRetroactiva() {
  // NUEVO UI: abre modal con formulario Desde/Hasta + boton Buscar
  _mostrarModalBusquedaCapacitaciones();
}

// Helper: normaliza una hora a formato HH:MM
// Sheets devuelve horas como "1899-12-30T11:38:36.000Z" (epoch de Sheets)
function _fmtHoraCap(h) {
  if (!h) return '';
  const s = String(h);
  // Caso epoch Sheets: 1899-12-30TXX:XX:XX
  if (s.indexOf('1899-12-30T') === 0) return s.substring(11, 16);
  // Caso ISO normal: YYYY-MM-DDTXX:XX:XX
  const m = s.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  // Caso ya en HH:MM
  if (/^\d{1,2}:\d{2}/.test(s)) return s.substring(0, 5);
  return s;
}

function _mostrarModalBusquedaCapacitaciones() {
  let overlay = document.getElementById('modalRegenOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'modalRegenOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';

  // Fecha por defecto: hoy
  const hoy = _hoyLimaCap(new Date());   /* _CAP_HOY_LIMA_V1 */

  let html = '<div style="background:white;padding:24px;border-radius:12px;max-width:760px;max-height:85vh;overflow:auto;width:100%">';
  html += '<h3 style="margin-top:0;margin-bottom:6px">📅 Regenerar formato R-SC-01</h3>';
  html += '<p style="color:#475569;margin-bottom:16px;font-size:13px">Selecciona el rango de fechas para buscar capacitaciones registradas. Por cada una podrás regenerar el formato R-SC-01.</p>';

  // Form de filtros
  html += '<div style="display:flex;gap:12px;align-items:end;margin-bottom:16px;flex-wrap:wrap;padding:12px;background:#f8fafc;border-radius:8px">';
  html += '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600">Fecha desde</label>';
  html += '<input type="date" id="regenDesde" value="' + hoy + '" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px"></div>';
  html += '<div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600">Fecha hasta</label>';
  html += '<input type="date" id="regenHasta" value="' + hoy + '" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px"></div>';
  html += '<button class="btn btn-primary" id="btnBuscarRegen" style="padding:8px 16px">🔍 Buscar</button>';
  html += '</div>';

  // Area de resultados
  html += '<div id="resultadosRegen" style="border-top:1px solid #e2e8f0;padding-top:14px;min-height:80px">';
  html += '<div style="color:#94a3b8;text-align:center;padding:20px;font-size:14px">Selecciona un rango de fechas y haz clic en Buscar</div>';
  html += '</div>';

  // Footer
  html += '<div style="margin-top:14px;text-align:right"><button class="btn btn-gray" id="btnCerrarModalRegen">✖ Cerrar</button></div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  document.getElementById('btnCerrarModalRegen').onclick = () => overlay.remove();
  document.getElementById('btnBuscarRegen').onclick = () => _ejecutarBusquedaCapacitaciones();
}

async function _ejecutarBusquedaCapacitaciones() {
  const desde = document.getElementById('regenDesde').value;
  const hasta = document.getElementById('regenHasta').value;
  const cont  = document.getElementById('resultadosRegen');

  if (!desde || !hasta) {
    cont.innerHTML = '<div style="color:#dc2626;padding:14px;background:#fef2f2;border-radius:6px">❌ Selecciona ambas fechas</div>';
    return;
  }
  if (desde > hasta) {
    cont.innerHTML = '<div style="color:#dc2626;padding:14px;background:#fef2f2;border-radius:6px">❌ La fecha desde no puede ser mayor que hasta</div>';
    return;
  }

  cont.innerHTML = '<div style="color:#64748b;padding:14px;text-align:center"><span class="spin"></span> Buscando capacitaciones...</div>';

  try {
    const r = await apiPost({
      action: 'exportarCapacitaciones',
      desde: desde,
      hasta: hasta,
      empresa: '',
      usuario: USER.usuario,
      rol: USER.rol
    });
    if (!r.success) {
      cont.innerHTML = '<div style="color:#dc2626;padding:14px;background:#fef2f2;border-radius:6px">❌ ' + (r.error || 'Error al buscar') + '</div>';
      return;
    }
    if (!r.data || !r.data.length) {
      cont.innerHTML = '<div style="color:#92400e;padding:14px;background:#fffbeb;border-radius:6px">⚠️ No se encontraron capacitaciones en ese rango</div>';
      return;
    }

    // Agrupar filas por idCapacitacion (acepta claves variadas del backend)
    const grupos = {};
    r.data.forEach(row => {
      const id = row.ID_CAPACITACION || row.idCapacitacion || row.id_capacitacion || row.ID || row.id || ('CAP-' + Object.keys(grupos).length);
      if (!grupos[id]) {
        grupos[id] = {
          id,
          empresa:           row.EMPRESA || row.empresa || '',
          fecha:             row.FECHA_CAPACITACION || row.FECHA || row.fecha || desde,
          tema:              row.TEMA || row.tema || '',
          lugar:             row.LUGAR || row.lugar || '',
          area:              row.AREA || row.area || '',
          tipo:              row.TIPO || row.tipo || '',
          horaInicio:        _fmtHoraCap(row.HORA_INICIO || row.horaInicio || ''),
          horaFin:           _fmtHoraCap(row.HORA_FIN || row.horaFin || ''),
          horas:             row.HORAS || row.horas || row.totalHoras || _calcHorasDesde(_fmtHoraCap(row.HORA_INICIO||row.horaInicio||''), _fmtHoraCap(row.HORA_FIN||row.horaFin||'')),
          capacitadorDni:    row.CAPACITADOR_DNI || row.capacitadorDni || '',
          capacitadorNombre: row.CAPACITADOR_NOMBRE || row.capacitadorNombre || '',
          capacitadorCargo:  row.CAPACITADOR_CARGO || row.capacitadorCargo || '',
          asistentes: []
        };
      }
      grupos[id].asistentes.push({
        dni:     row.DNI || row.dni || '',
        nombre:  row.APELLIDOS_Y_NOMBRES || row.NOMBRE || row.nombre || row.nombres || '',
        cargo:   row.CARGO_AREA || row.CARGO || row.cargo || '',
        sexo:    row.SEXO || row.sexo || '',
        empresa: row.EMPRESA || row.empresa || ''
      });
    });

    const lista = Object.values(grupos);

    // Render resultados
    let html = '<p style="color:#475569;margin-bottom:12px;font-size:14px">Se encontraron <b>' + lista.length + '</b> capacitación(es). Haz clic en una para regenerar el formato R-SC-01.</p>';

    lista.forEach((c, i) => {
      html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px;background:#f8fafc">';
      html += '<div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#0f172a">' + (c.tema || '(sin tema)') + '</div>';
      html += '<div style="font-size:12px;color:#64748b;margin-bottom:10px;line-height:1.6">';
      html += '📅 <b>' + (c.fecha || '—') + '</b> · 🏢 ' + (c.empresa || '—') + ' · 📍 ' + (c.lugar || '—');
      html += '<br>⏰ ' + (c.horaInicio || '—') + ' a ' + (c.horaFin || '—') + ' · 👥 <b>' + c.asistentes.length + '</b> asistentes';
      html += '</div>';
      html += '<button class="btn btn-primary" data-idx="' + i + '" style="font-size:13px;padding:8px 14px">📄 Regenerar formato R-SC-01</button>';
      /* _CAP_DUPLICAR_V1: misma nomina, otro titulo */
      html += ' <button class="btn btn-gray" data-dup="' + i + '" style="font-size:13px;padding:8px 14px" ' +
              'title="Crear otro registro con estas mismas personas y otro titulo">📋 Otro título</button>';
      html += '</div>';
    });

    cont.innerHTML = html;
    window._capacitacionesEncontradas = lista;

    cont.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        regenerarFormatoCapacitacion(window._capacitacionesEncontradas[idx]);
      };
    });
    cont.querySelectorAll('button[data-dup]').forEach(btn => {      /* _CAP_DUPLICAR_V1 */
      btn.onclick = () => capAbrirDuplicarRegen(parseInt(btn.dataset.dup));
    });
  } catch(e) {
    cont.innerHTML = '<div style="color:#dc2626;padding:14px;background:#fef2f2;border-radius:6px">❌ Error: ' + e.message + '</div>';
  }
}

function _mostrarListaCapacitacionesAntiguas(capacitaciones, fechaTxt) {
  let overlay = document.getElementById('modalRegenOverlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'modalRegenOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999';

  let html = '<div style="background:white;padding:20px;border-radius:12px;max-width:720px;max-height:80vh;overflow:auto;width:90%">';
  html += '<h3 style="margin-top:0;margin-bottom:8px">📅 Capacitaciones del ' + fechaTxt + '</h3>';
  html += '<p style="color:#475569;margin-bottom:12px;font-size:14px">Se encontraron <b>' + capacitaciones.length + '</b> capacitación(es). Selecciona para regenerar el formato R-SC-01.</p>';
  html += '<div>';

  capacitaciones.forEach((c, i) => {
    html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;background:#f8fafc">';
    html += '<div style="font-weight:600;font-size:14px;margin-bottom:4px">' + (c.tema || '(sin tema)') + '</div>';
    html += '<div style="font-size:12px;color:#64748b;margin-bottom:8px">';
    html += (c.empresa || '—') + ' · ' + (c.lugar || '—') + ' · ' + (c.horaInicio || '—') + '-' + (c.horaFin || '—') + ' · <b>' + c.asistentes.length + '</b> asistentes';
    html += '</div>';
    html += '<button class="btn btn-primary" data-idx="' + i + '" style="font-size:12px;padding:6px 12px">📄 Regenerar formato R-SC-01</button>';
    /* _CAP_DUPLICAR_V1 */
    html += ' <button class="btn btn-gray" data-dup="' + i + '" style="font-size:12px;padding:6px 12px" ' +
            'title="Crear otro registro con estas mismas personas y otro titulo">📋 Otro título</button>';
    html += '</div>';
  });

  html += '</div>';
  html += '<div style="margin-top:12px;text-align:right"><button class="btn btn-gray" id="btnCerrarModalRegen">✖ Cerrar</button></div>';
  html += '</div>';

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // Referencia global para acceso desde botones
  window._capacitacionesEncontradas = capacitaciones;

  document.getElementById('btnCerrarModalRegen').onclick = () => overlay.remove();
  overlay.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx);
      regenerarFormatoCapacitacion(window._capacitacionesEncontradas[idx]);
    };
  });
  overlay.querySelectorAll('button[data-dup]').forEach(btn => {      /* _CAP_DUPLICAR_V1 */
    btn.onclick = () => capAbrirDuplicarRegen(parseInt(btn.dataset.dup));
  });
}

// RESPONSABLE DEL REGISTRO — siempre fijo (Lucia Castillo Celi)
const _RESP_REGISTRO = {
  dni:    '71732176',
  nombre: 'CASTILLO CELI LUCIA GABRIELA',
  cargo:  'ANALISTA DE GESTION HUMANA'
};

async function regenerarFormatoCapacitacion(cap) {
  if (!cap || !cap.asistentes || !cap.asistentes.length) {
    await appAlert('❌ Esta capacitación no tiene asistentes para regenerar');
    return;
  }

  // Determinar CAPACITADOR (quien dio la capacitación)
  let capDni    = cap.capacitadorDni    || '';
  let capNombre = cap.capacitadorNombre || '';
  let capCargo  = cap.capacitadorCargo  || '';

  // Si la capacitación original no tiene datos del capacitador, pedirlos
  if (!capDni || !capNombre) {
    const dniInput = (await appPrompt('🔍 Ingresa el DNI del CAPACITADOR (quien dictó la capacitación):') || '').trim();
    if (!dniInput) return;
    if (!/^\d{7,8}$/.test(dniInput)) {
      await appAlert('❌ DNI inválido. Debe tener 7 u 8 dígitos.');
      return;
    }
    capDni = dniInput;

    // Intentar autocompletar desde BD_Supervisores (tolerante a ceros iniciales)
    let encontrado = false;
    try {
      const r = await apiGet({ action: 'getSupervisores' });
      if (r.success && Array.isArray(r.data)) {
        const dniNorm = dniInput.replace(/^0+/, '');
        const sup = r.data.find(function(s){
          const sDni = String(s.dni || '').trim().replace(/^0+/, '');
          return sDni === dniNorm;
        });
        if (sup) {
          capDni    = String(sup.dni).trim();
          capNombre = String(sup.nombre || '').trim();
          capCargo  = String(sup.cargo || '').trim();
          encontrado = true;
        }
      }
    } catch(e) {
      console.warn('Error buscando supervisor:', e);
    }

    // Si NO está en BD_Supervisores → pedir nombre y cargo manualmente
    if (!encontrado) {
      capNombre = (await appPrompt('⚠️ DNI ' + dniInput + ' no está en BD_Supervisores.\n\nIngresa el nombre completo del capacitador:') || '').trim();
      if (!capNombre) { await appAlert('❌ El nombre es obligatorio'); return; }
      capCargo = (await appPrompt('📋 Ingresa el cargo del capacitador:') || '').trim();
      if (!capCargo) { await appAlert('❌ El cargo es obligatorio'); return; }
    }
  }

  // Backup de campos DOM y asistentes globales
  const backup = {
    empresa:     v('capEmpresa'),
    fecha:       v('capFecha'),
    tema:        v('capTema'),
    lugar:       v('capLugar'),
    horaInicio:  v('capHoraInicio'),
    horaTermino: v('capHoraTermino'),
    horas:       v('capHoras'),
    capDni:      v('capCapDni'),
    capNombre:   v('capCapNombre'),
    capCargo:    v('capCapCargo'),
    respDni:     v('capRespDni'),
    respNombre:  v('capRespNombre'),
    respCargo:   v('capRespCargo'),
    area:        v('capArea'),
    fundo:       v('capFundo'),   /* _FUNDO_CAP_V1 */
    labor:       v('capLabor'), servicio: v('capServicio'),   /* _FORMATO_RSC01_2026_V1 */
    tipos:       getTipos(),
    asistentes:  asistentes.slice()
  };

  try {
    // Datos generales de la actividad
    sv('capEmpresa',     cap.empresa);
    sv('capFecha',       cap.fecha);
    sv('capTema',        cap.tema);
    sv('capLugar',       cap.lugar);
    sv('capArea', cap.area);
    if (cap.fundo) sv('capFundo', cap.fundo);   /* _FUNDO_CAP_V1 */
    sv('capLabor', ''); sv('capServicio', '');   /* _FORMATO_RSC01_2026_V1: no se guardan; al regenerar salen en blanco */
    setTipos(cap.tipo);
    sv('capHoraInicio',  cap.horaInicio);
    sv('capHoraTermino', cap.horaFin);
    sv('capHoras',       cap.horas);

    // CAPACITADOR (lo que el usuario ingresó o lo que vino de la BD)
    sv('capCapDni',     capDni);
    sv('capCapNombre',  capNombre);
    sv('capCapCargo',   capCargo);

    // RESPONSABLE DEL REGISTRO — SIEMPRE FIJO (Lucia Castillo Celi)
    sv('capRespDni',     _RESP_REGISTRO.dni);
    sv('capRespNombre',  _RESP_REGISTRO.nombre);
    sv('capRespCargo',   _RESP_REGISTRO.cargo);

    asistentes = cap.asistentes.slice();

    await generarPDFsFormatos();
  } finally {
    // Restaurar TODO al estado original
    sv('capEmpresa',     backup.empresa);
    sv('capFecha',       backup.fecha);
    sv('capTema',        backup.tema);
    sv('capLugar',       backup.lugar);
    sv('capArea', backup.area);
    sv('capFundo', backup.fundo);   /* _FUNDO_CAP_V1 */
    sv('capLabor', backup.labor); sv('capServicio', backup.servicio);   /* _FORMATO_RSC01_2026_V1 */
    setTipos((backup.tipos || []).join(','));
    sv('capHoraInicio',  backup.horaInicio);
    sv('capHoraTermino', backup.horaTermino);
    sv('capHoras',       backup.horas);
    sv('capCapDni',      backup.capDni);
    sv('capCapNombre',   backup.capNombre);
    sv('capCapCargo',    backup.capCargo);
    sv('capRespDni',     backup.respDni);
    sv('capRespNombre',  backup.respNombre);
    sv('capRespCargo',   backup.respCargo);
    asistentes = backup.asistentes;
  }
}

function sincronizarCantidad(origen) {
  const n = document.getElementById('cantTrabajadores');
  const s = document.getElementById('sliderTrabajadores');
  if (!n || !s) return;
  if (origen === 'n') {
    let val = parseInt(n.value) || 1;
    if (val < 1) val = 1; if (val > 500) val = 500;
    n.value = val;
    s.value = Math.min(val, 100);
  } else {
    n.value = parseInt(s.value) || 1;
  }
  _actualizarPreviewFormatos(parseInt(n.value) || 1);
}

function calcularFormatos() {
  _actualizarPreviewFormatos(parseInt(v('cantTrabajadores')) || 1);
}

function _actualizarPreviewFormatos(n) {
  const formatos = Math.ceil(n / FILAS_POR_FORMATO);
  _totalFormatos = formatos;
  const el = document.getElementById('paso0Preview');
  if (!el) return;
  el.textContent = formatos === 1
    ? `📋 1 formato R-SC-01 · hasta ${FILAS_POR_FORMATO} asistentes`
    : `📋 ${formatos} formatos R-SC-01 · hasta ${n} asistentes (${FILAS_POR_FORMATO} por hoja)`;
}

function cancelarCapacitacion() {
  asistentes = []; _dniCooldown = {};
  _esRetroactivo = false; _fechaRetroactiva = null; _motivoRetroactivo = '';
  showTab('registros', document.getElementById('tabBtnRegistros'));
}

async function continuarAPaso1() {
  _capGuardada = false;
  { const _bg = document.getElementById('btnGuardarGen'); if (_bg) { _bg.disabled = false; _bg.innerHTML = '💾 Guardar y generar PDF R-SC-01'; } }
  const n = parseInt(v('cantTrabajadores')) || 0;
  if (n < 1) { await appAlert('Ingresa al menos 1 trabajador'); return; }
  _trabajadoresProgramados = n;
  _totalFormatos = Math.ceil(n / FILAS_POR_FORMATO);
  _mostrarPaso(1);

  if (_esRetroactivo && _fechaRetroactiva) {
    sv('capFecha', _fechaRetroactiva);
    const capFechaEl = document.getElementById('capFecha');
    if (capFechaEl) capFechaEl.style.background = '#fef9c3';
    const br = document.getElementById('bannerRetroactivo');
    const lblF = document.getElementById('lblFechaRetro');
    const lblM = document.getElementById('lblMotivoRetro');
    if (br) br.style.display = '';
    if (lblF) { const [ay, am, ad] = _fechaRetroactiva.split('-'); lblF.textContent = `${ad}/${am}/${ay}`; }
    if (lblM) lblM.textContent = _motivoRetroactivo;
  } else {
    const capFechaEl = document.getElementById('capFecha');
    if (capFechaEl) capFechaEl.style.background = '';
    const br = document.getElementById('bannerRetroactivo');
    if (br) br.style.display = 'none';
  }
}

function actualizarProgresoAsistentes() {
  const el = document.getElementById('progresoAsistentes');
  if (!el || !_trabajadoresProgramados) { if (el) el.style.display = 'none'; return; }
  el.style.display = '';
  const n = asistentes.length;
  const total = _trabajadoresProgramados;
  const pct = Math.min(100, Math.round(n / total * 100));
  const elAct  = document.getElementById('progActual');
  const elTot  = document.getElementById('progTotal');
  const elBar  = document.getElementById('progBar');
  const elLbl  = document.getElementById('progFormLabel');
  if (elAct) elAct.textContent = n;
  if (elTot) elTot.textContent = total;
  if (elBar) {
    elBar.style.width = pct + '%';
    elBar.classList.toggle('completo', pct >= 100);
  }
  if (elLbl && _totalFormatos > 1) {
    const formato = Math.ceil(Math.max(n, 1) / FILAS_POR_FORMATO);
    const fi = (formato - 1) * FILAS_POR_FORMATO + 1;
    const ff = Math.min(formato * FILAS_POR_FORMATO, total);
    elLbl.textContent = `Formato ${Math.min(formato, _totalFormatos)} de ${_totalFormatos} (Filas ${fi}–${ff})`;
  } else if (elLbl) {
    elLbl.textContent = '';
  }
}

/* ─────────────────────── TABS ─────────────────────── */
function showTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('on');
  if (btn) btn.classList.add('on');
  if (tab !== 'nueva') detenerScanner();
  if (tab === 'registros') cargarRegistros();
  if (tab === 'exportar')  capPrepararExportPorUsuario();   /* _CAP_EXPORT_SUP_V1 */
}

/* ─────────────────────── PASO 1 → 2 ─────────────────────── */
function irPaso2() {
  const empresa = v('capEmpresa');
  const fecha   = v('capFecha');
  const tipos   = getTipos();
  const tema    = v('capTema').trim();
  const lugar   = v('capLugar').trim();

  // Recopilar todos los campos faltantes (nunca validar N°TRAB/H/M — se autocalculan)
  const faltan = [];
  if (!empresa)      faltan.push('EMPRESA');
  if (!fecha)        faltan.push('FECHA');
  if (!tipos.length) faltan.push('TIPO DE ACTIVIDAD');
  if (!tema)         faltan.push('TEMA');
  if (!lugar)        faltan.push('LUGAR');
  if (!v('capFundo').trim()) faltan.push('FUNDO');   /* _FUNDO_CAP_V1 */
  if (faltan.length) {
    mostrarFeedback('err', '❌ Faltan estos campos: ' + faltan.join(' · '));
    return;
  }

  _mostrarPaso(2);
  actualizarProgresoAsistentes();

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
  _mostrarPaso(1);
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

// _DEDUPE_ASISTENTES_V1 — 3 capas de defensa contra duplicados
async function procesarDni(dni) {
  // Normalización defensiva: siempre string limpio
  dni = String(dni || '').trim();
  if (!dni || !/^\d{7,8}$/.test(dni)) return;

  const now = Date.now();

  // CAPA 1: Cooldown de 3 segundos por DNI (anti-rebote del lector QR)
  if (_dniCooldown[dni] && (now - _dniCooldown[dni]) < COOLDOWN_MS) return;
  _dniCooldown[dni] = now;

  // CAPA 2a: ¿Ya está en la lista? (chequeo previo al await)
  if (asistentes.some(a => String(a.dni) === dni)) {
    mostrarFeedback('dup', `⚠️ DNI ${dni} ya está en la lista`);
    beep(false); vibrar([100, 50, 100]);
    return;
  }

  /* _CAP_LISTAS_TOPE_V1: tope = cantidad programada en el paso 0 */
  if (!await _capPermitirSobreTope(dni)) return;

  mostrarFeedback('ok', `🔍 Buscando DNI ${dni}...`);
  _topeEnCurso++;
  try {
    const d = await buscarTrabajadorAzure(dni);

    // CAPA 2b: Re-chequeo POST-await (race condition safe)
    // Otro escaneo del mismo DNI pudo agregarlo mientras esperábamos la API.
    if (asistentes.some(a => String(a.dni) === dni)) {
      mostrarFeedback('dup', `⚠️ DNI ${dni} ya está en la lista (race)`);
      beep(false); vibrar([100, 50, 100]);
      return;
    }

    if (d.success && d.data && d.data.length) {
      const t = d.data[0];
      agregarAsistente({ dni, nombre: t.nombre || '', empresa: t.empresa || '', cargo: t.cargo || '', sexo: t.sexo || '' });
      mostrarFeedback('ok', `✅ ${t.nombre || dni}  ·  ${t.empresa || ''}  ·  ${t.cargo || ''}` + _capAvisoTope());
    } else {
      // Registrar solo con DNI si no se encuentra en la BD de trabajadores
      agregarAsistente({ dni, nombre: '', empresa: v('capEmpresa') || '', cargo: '', sexo: '' });
      mostrarFeedback('ok', `✅ DNI ${dni} registrado (sin datos en BD — completar manualmente)` + _capAvisoTope());
    }
    beep(true); vibrar([80]);
  } catch(e) {
    mostrarFeedback('err', `❌ Error al buscar DNI ${dni}: ` + e.message);
    beep(false);
  } finally {
    _topeEnCurso = Math.max(0, _topeEnCurso - 1);   /* _CAP_LISTAS_TOPE_V1 */
  }
}

/* _CAP_LISTAS_TOPE_V1 (02-oct-2026): al llegar a la cantidad programada en el
   paso 0 se avisa; si escanean uno mas, se pregunta. Si dicen que si, la
   cantidad sube en 1 (y se crea otro formato R-SC-01 cuando haga falta). */
async function _capPermitirSobreTope(dni) {
  const tope = _trabajadoresProgramados;
  if (!tope || (asistentes.length + _topeEnCurso) < tope) return true;
  if (_topePreguntando) return false;          // ya hay un aviso abierto: se ignora este escaneo
  _topePreguntando = true;
  try {
    beep(false); vibrar([100, 50, 100]);
    const ok = await appConfirm(
      `🎯 Ya completaste los ${tope} trabajadores programados.\n\n` +
      `¿Agregar también el DNI ${dni}?\n` +
      `(La cantidad pasará a ${tope + 1}` +
      (Math.ceil((tope + 1) / FILAS_POR_FORMATO) > Math.ceil(tope / FILAS_POR_FORMATO) ? ' y se creará un formato R-SC-01 más' : '') + ')'
    );
    if (!ok) {
      delete _dniCooldown[dni];
      mostrarFeedback('dup', `⏸️ DNI ${dni} no agregado — ya se completó la cantidad programada (${tope})`);
      return false;
    }
    _trabajadoresProgramados = tope + 1;
    _totalFormatos = Math.ceil(_trabajadoresProgramados / FILAS_POR_FORMATO);
    sv('cantTrabajadores', String(_trabajadoresProgramados));
    return true;
  } finally {
    _topePreguntando = false;
  }
}

function _capAvisoTope() {
  return (_trabajadoresProgramados && asistentes.length === _trabajadoresProgramados)
    ? `  ·  🎯 Completaste los ${_trabajadoresProgramados} programados`
    : '';
}

/* ─────────────────────── DNI MANUAL ─────────────────────── */
async function buscarTrabajadorAzure(dni) {
  const d = String(dni || '').trim().replace(/\D/g, '');
  const dni8 = d.length === 7 ? '0' + d : d;
  const URL = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/buscar?dni=' + encodeURIComponent(dni8);
  try {
    const r = await fetch(URL, { method: 'GET' });
    if (!r.ok) return { success: false, data: [] };
    const j = await r.json();
    const arr = (j.trabajadores || []).map(function(t) {
      return {
        dni:     String(t.dni || dni8),
        nombre:  t.nombre_completo || '',
        empresa: t.empresa || '',
        cargo:   t.oficio || '',
        sexo:    t.sexo || ''
      };
    });
    return { success: true, data: arr };
  } catch (e) {
    return { success: false, data: [], error: String(e) };
  }
}

async function buscarDniManual() {
  const raw = (v('dniManual') || '').trim().replace(/\D/g, '');
  if (raw.length !== 8) { mostrarFeedback('err', 'El DNI debe tener exactamente 8 dígitos'); return; }
  sv('dniManual', '');
  await procesarDni(raw);
}

/* ─────────────────────── LISTA DE ASISTENTES ─────────────────────── */
function agregarAsistente(t) {
  // CAPA 3: Última red de defensa contra duplicados
  const dni = String(t && t.dni || '').trim();
  if (!dni) {
    console.warn('[agregarAsistente] DNI vacío, ignorando:', t);
    return;
  }
  if (asistentes.some(a => String(a.dni) === dni)) {
    console.warn('[agregarAsistente] Duplicado bloqueado:', dni);
    return;
  }
  asistentes.push({ n: asistentes.length + 1, ...t, dni: dni });
  renderLista();
}

async function eliminarAsistente(dni) {
  if (!await appConfirm('¿Eliminar este asistente de la lista?')) return;
  asistentes = asistentes.filter(a => String(a.dni) !== String(dni)).map((a, i) => ({ ...a, n: i + 1 }));
  renderLista();
}

function renderLista() {
  const tb = document.getElementById('tbAsistentes');
  const ct = document.getElementById('contadorAsist');
  if (ct) ct.textContent = asistentes.length;
  actualizarProgresoAsistentes();
  // Auto-actualizar contadores nH/nM/nTrab en paso 1
  const _esH = s => { const x=(s||'').toUpperCase(); return x==='M'||x==='H'||x==='MASCULINO'||x==='HOMBRE'; };
  const _esM = s => { const x=(s||'').toUpperCase(); return x==='F'||x==='MUJ'||x==='FEMENINO'||x==='MUJER'; };
  const nHv = asistentes.filter(a => _esH(a.sexo)).length;
  const nMv = asistentes.filter(a => _esM(a.sexo)).length;
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
    const d = await buscarTrabajadorAzure(dni);
    if (d.success && d.data && d.data.length) {
      const t = d.data[0];
      if (!v('capCapNombre')) sv('capCapNombre', t.nombre || '');
      if (!v('capCapCargo'))  sv('capCapCargo',  t.cargo  || '');
    }
  } catch(e) { /* silencioso */ }
}

/* ─────────────────────── AGREGAR MANUAL ─────────────────────── */
function abrirModalManual() {
  const el = document.getElementById('modalManualOverlay');
  if (!el) return;
  el.classList.add('open');
  sv('manDni', ''); sv('manNombre', ''); sv('manCargo', ''); sv('manSexo', '');
  setTimeout(() => { const f = document.getElementById('manDni'); if (f) f.focus(); }, 80);
}

function cerrarModalManual() {
  const el = document.getElementById('modalManualOverlay');
  if (el) el.classList.remove('open');
}

async function agregarAsistenteManual() {
  const dni    = (v('manDni')    || '').trim().replace(/\D/g, '');
  const nombre = (v('manNombre') || '').trim();
  const cargo  = (v('manCargo')  || '').trim();
  const sexo   = v('manSexo') || '';
  if (!dni || dni.length !== 8) { await appAlert('El DNI debe tener exactamente 8 dígitos'); return; }
  if (!nombre) { await appAlert('El nombre es obligatorio'); return; }
  if (asistentes.some(a => String(a.dni) === dni)) {
    await appAlert(`⚠️ DNI ${dni} ya está en la lista`); return;
  }
  if (!await _capPermitirSobreTope(dni)) return;   /* _CAP_LISTAS_TOPE_V1 */
  agregarAsistente({ dni, nombre, cargo, sexo, empresa: v('capEmpresa') || '' });
  cerrarModalManual();
  mostrarFeedback('ok', `✅ ${nombre} agregado manualmente` + _capAvisoTope());
}

/* ─────────────────────── CALCULAR HORAS ─────────────────────── */
function _calcHorasDesde(hi, ht) {
  if (!hi || !ht) return '';
  const a = String(hi).split(':').map(Number);
  const b = String(ht).split(':').map(Number);
  if (a.length < 2 || b.length < 2 || isNaN(a[0]) || isNaN(b[0])) return '';
  const diff = (b[0] * 60 + b[1] - (a[0] * 60 + a[1])) / 60;
  return diff > 0 ? diff.toFixed(1) : '';
}

function calcHoras() {
  const hi = v('capHoraInicio'), ht = v('capHoraTermino');
  if (!hi || !ht) return;
  const [h1, m1] = hi.split(':').map(Number);
  const [h2, m2] = ht.split(':').map(Number);
  const diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
  if (diff > 0) sv('capHoras', diff.toFixed(1));
}

/* ─────────────────────── GUARDAR ─────────────────────── */
async function guardarYGenerar() {
  const btn = document.getElementById('btnGuardarGen');
  if (_capGuardada) {            // ya guardado en BD: solo (re)generar PDF
    await generarPDFsFormatos();
    return;
  }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Guardando...'; }
  const ok = await guardarCapacitacion();   // 1) guarda en BD primero
  if (!ok) {                                 // si falla, NO genera PDF
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Guardar y generar PDF R-SC-01'; }
    return;
  }
  _capGuardada = true;
  if (btn) btn.innerHTML = '<span class="spin"></span> Generando PDF...';
  await generarPDFsFormatos();               // 2) genera PDF(s)
  if (btn) { btn.disabled = true; btn.innerHTML = '✅ Guardado y PDF generado — usa "Nueva"'; }
}

async function guardarCapacitacion() {
  // ── Pre-validación completa ──
  if (!asistentes.length) {
    mostrarFeedback('err', '❌ Debes registrar al menos 1 asistente antes de guardar');
    return;
  }
  // Capacitador (opcional pero si se ingresó DNI se requiere nombre)
  const capDni = v('capCapDni').trim(), capNom = v('capCapNombre').trim();
  if (capDni && !capNom) {
    mostrarFeedback('err', '❌ Ingresaste el DNI del capacitador pero falta el nombre — búscalo o escríbelo');
    return;
  }

  const btn = document.getElementById('btnGuardar') || {};
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Guardando...';
  let guardadoOk = false;
  try {
    const { actividad, asistentesEnvio } = await _buildBody();
    console.log('[GUARDAR CAP] Actividad a enviar:', actividad);
    console.log('[GUARDAR CAP] Asistentes:', asistentesEnvio);
    const d = await apiPost({ action: 'guardarCapacitacion', actividad, asistentes: asistentesEnvio });
    if (d.success) {
      guardadoOk = true;
      mostrarFeedback('ok', `✅ Capacitación guardada. ID: ${d.idCapacitacion || d.id || '—'} | ${d.registrosGuardados || asistentesEnvio.length} asistente(s)`);
    } else {
      mostrarFeedback('err', '❌ ' + (d.error || 'Error al guardar en el servidor'));
    }
  } catch(e) {
    mostrarFeedback('err', '❌ Error de conexión: ' + e.message);
  } finally {
    // FIX: si guardado OK, mantener boton disabled para evitar duplicados
    if (guardadoOk) {
      btn.innerHTML = '✅ Guardado — usa "Nueva" para registrar otra';
    } else {
      btn.disabled = false;
      btn.innerHTML = '💾 Guardar';
    }
  }
  return guardadoOk;
}

async function _buildBody() {
  // Objeto actividad con los nombres exactos que espera capGuardar() del backend
  const actividad = {
    idCapacitacion:    'CAP-' + Date.now(),
    empresa:           v('capEmpresa').trim(),
    fecha:             v('capFecha').trim(),
    tipo:              getTipos().join(', '),
    tema:              v('capTema').trim(),
    fuente:            v('capFuente').trim() || '—',
    area:              v('capArea').trim()   || '—',
    fundo:             v('capFundo').trim(),   /* _FUNDO_CAP_V1 */
    lugar:             v('capLugar').trim(),
    horaInicio:        v('capHoraInicio') || '',
    horaFin:           v('capHoraTermino') || '',
    totalHoras:        parseFloat(v('capHoras')) || 0,
    frecuencia:        v('capFrecuencia') || '',
    capacitadorDni:    v('capCapDni').trim(),
    capacitadorNombre: v('capCapNombre').trim(),
    capacitadorCargo:  v('capCapCargo').trim(),
    creadaPor:              USER.usuario,
    creadaPorNombre:        USER.nombre,
    esRetroactivo:          _esRetroactivo,
    motivoRetroactivo:      _esRetroactivo ? _motivoRetroactivo : '',
    trabajadoresProgramados: _trabajadoresProgramados,
    totalFormatos:          _totalFormatos
  };
  // CAPA 4: Dedupe final antes de enviar al backend
  const _vistos = new Set();
  const asistentesEnvio = asistentes.filter(a => {
    const k = String(a.dni || '').trim();
    if (!k || _vistos.has(k)) return false;
    _vistos.add(k);
    return true;
  });
  if (asistentesEnvio.length !== asistentes.length) {
    console.warn('[_buildBody] Duplicados removidos antes de enviar:',
      asistentes.length - asistentesEnvio.length);
  }
  /* _FUNDO_CAP_V1: el servidor YA escribe el fundo en la hoja de asistentes
     —en capGuardar la fila lleva  a.fundo || ''—  pero los asistentes nunca
     traian ese dato, asi que esa columna salia siempre vacia. Aqui se le pone
     a cada asistente el fundo de la actividad. Con esto NO hay que tocar el
     servidor: la columna ya existe y ya se escribe. */
  const _fundoAct = v('capFundo').trim();
  const asistentesConFundo = asistentesEnvio.map(function (a) {
    return Object.assign({}, a, { fundo: a.fundo || _fundoAct });
  });
  console.log('[_FUNDO_CAP_V1] fundo "' + _fundoAct + '" aplicado a ' +
              asistentesConFundo.length + ' asistente(s)');

  return { actividad, asistentesEnvio: asistentesConFundo };
}

/* ─────────────────────── PDF R-SC-01 ─────────────────────── */
async function generarPDFsFormatos() {
  const empresa = v('capEmpresa');
  if (!empresa) { mostrarFeedback('err', 'Selecciona la empresa antes de generar el PDF'); return; }
  const respDni = v('capRespDni').trim(), respNombre = v('capRespNombre').trim(), respCargo = v('capRespCargo').trim();
  if (!respDni || !respNombre || !respCargo) {
    await appAlert('⚠️ Debes ingresar el DNI del responsable del registro.\n\nEl DNI debe existir en BD_Supervisores para auto-completar el nombre y cargo.');
    document.getElementById('capRespDni').focus();
    return;
  }
  const n = asistentes.length;
  if (n === 0) { mostrarFeedback('err', '❌ No hay asistentes registrados'); return; }

  const totalFormatos = Math.ceil(n / FILAS_POR_FORMATO);
  if (totalFormatos > 1) {
    const ok = await appConfirm(
      `📋 Se generarán ${totalFormatos} formatos R-SC-01\n` +
      `• ${n} asistentes en total\n` +
      `• ${FILAS_POR_FORMATO} asistentes por hoja\n\n¿Continuar?`
    );
    if (!ok) return;
  }

  const btn = document.getElementById('btnPDF') || {};
  btn.disabled = true;
  try {
    for (let i = 0; i < totalFormatos; i++) {
      const inicio = i * FILAS_POR_FORMATO;
      const fin    = Math.min(inicio + FILAS_POR_FORMATO, n);
      const chunk  = asistentes.slice(inicio, fin);
      const label  = totalFormatos > 1 ? `Formato ${i + 1} de ${totalFormatos}` : '';
      btn.innerHTML = totalFormatos > 1
        ? `<span class="spin"></span> Formato ${i + 1}/${totalFormatos}...`
        : '<span class="spin"></span> Generando PDF...';
      await generarPDF(chunk, label);
    }
    mostrarFeedback('ok', totalFormatos > 1
      ? `✅ ${totalFormatos} PDFs generados (${n} asistentes)`
      : `✅ PDF generado correctamente`);
  } catch(e) {
    mostrarFeedback('err', '❌ Error al generar PDF: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📄 Generar PDF R-SC-01';
  }
}

async function generarPDF(asistentesOverride = null, formatoLabel = '') {
  // Sólo se llama desde generarPDFsFormatos (validaciones ya hechas)
  const empresa = v('capEmpresa');
  const respDni    = v('capRespDni').trim();
  const respNombre = v('capRespNombre').trim();
  const respCargo  = v('capRespCargo').trim();

  let partList = [...(asistentesOverride || asistentes)];
  while (partList.length < FILAS_POR_FORMATO) partList.push({ dni: '', nombre: '', cargo: '', obs: '' });

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
    const nH        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'M').length;
    const nM        = asistentes.filter(a => (a.sexo || '').toUpperCase() === 'F').length;
    const logoB64   = (await _getLogoBase64()) || _LOGO_UNIFRUTTI_B64_;   /* _RSC01_LOGO_FREC_V1: si la imagen no carga, usa el logo embebido */

    // ── Estilos reutilizables ──
    const sBorder  = { lineColor: C.negro, lineWidth: 0.3 };
    const sBanner  = { fillColor: C.banner, textColor: C.negro, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10, minCellHeight: 6, cellPadding: 1 };
    const sCabHead = { fillColor: C.cabecera, textColor: C.negro, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 9, minCellHeight: 6 };

    // Anchos encabezado (suman 190mm)
    const COL1 = 35, COL2 = 110, COL3 = 45;

    let y = MGT;

    // ═══════════════════════════════════════════════════════
    // 1. ENCABEZADO — 2 filas; celda central dibujada manualmente
    // ═══════════════════════════════════════════════════════
    // Fila 1 del encabezado: CON bordes (logo | título | R-SC-01)
    doc.autoTable({
      startY: y,
      margin: { left: MGS, right: MGS, bottom: 5 },
      body: [
        [
          { content: '', styles: { cellWidth: COL1, minCellHeight: 15, valign: 'middle' } },
          { content: '', styles: { cellWidth: COL2, minCellHeight: 15, valign: 'middle' } },
          { content: '', styles: { cellWidth: COL3, minCellHeight: 15 } }
        ]
      ],
      theme: 'grid',
      styles: sBorder
    });
    const yFila2 = doc.lastAutoTable.finalY;

    // Fila 2: SIN bordes (dirección | frase | Frecuencia), como el formato oficial
    doc.autoTable({
      startY: yFila2,
      margin: { left: MGS, right: MGS, bottom: 5 },
      body: [
        [
          { content: `Caserío El Papayo Mz. O,\nCastilla, Piura, Piura, Perú\n${rucEmp}`,   /* _RSC01_LOGO_FREC_V1: 3 lineas como el modelo */
            styles: { halign: 'center', valign: 'middle', fontSize: 6.5,
                      textColor: C.negro, cellWidth: COL1, minCellHeight: 8, cellPadding: 0.8 } },
          { content: 'Empresa dedicada al cultivo, procesamiento y comercialización de fruta fresca.',
            styles: { halign: 'center', valign: 'middle', fontStyle: 'normal', fontSize: 8,   /* _RSC01_LOGO_FREC_V1: sin cursiva, como el modelo */
                      textColor: C.negro, cellWidth: COL2, minCellHeight: 8, cellPadding: 1 } },
          { content: '', styles: { cellWidth: COL3, minCellHeight: 8 } }
        ]
      ],
      theme: 'plain',
      styles: { lineWidth: 0 }
    });
    // Frecuencia: etiqueta en negrita + línea (como el oficial)
    /* _RSC01_LOGO_FREC_V1: como el modelo nuevo -> "Frecuencia: Anual" a la altura de la frase y SIN linea debajo */
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.negro);
    const _yFrec = doc.lastAutoTable.finalY - (doc.lastAutoTable.finalY - yFila2) / 2 + 1.2;
    doc.text('Frecuencia:', MGS + COL1 + COL2 + 2, _yFrec);
    doc.setFont('helvetica', 'normal'); doc.text('Anual', MGS + COL1 + COL2 + 2 + doc.getTextWidth('Frecuencia: ') + 1.2, _yFrec);

    // Logo encima celda izquierda fila 1 — CUADRADO 12×12mm (el original es 225×225, 1:1)
    if (logoB64) { try { doc.addImage(logoB64, 'JPEG', MGS + (COL1 - 14) / 2, y + 0.5, 14, 14);   /* _RSC01_LOGO_FREC_V1 */ } catch(e) {} }

    // Texto celda central fila 1: empresa (8pt normal) + título (10pt bold)
    // Centro horizontal de COL2: x = MGS + COL1 + COL2/2 = 10+35+55 = 100mm
    const cX = MGS + COL1 + COL2 / 2;
    // Empresa en su propia franja, con línea divisoria que cruza hasta R-SC-01 (como el oficial)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.negro);
    doc.text(nombreEmp, cX, y + 3.7, { align: 'center' });
    doc.setDrawColor(...C.negro); doc.setLineWidth(0.3);
    doc.line(MGS + COL1, y + 5, MGS + bW, y + 5);   // divide empresa/título y R-SC-01/Versión
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('REGISTRO DE INDUCCIÓN, CAPACITACIÓN,', cX, y + 9.6, { align: 'center' });
    doc.text('ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA', cX, y + 13.8, { align: 'center' });

    // Celda derecha por compartimentos: R-SC-01 / Versión N.° 0.0 / Última revisión (como el oficial)
    const rX = MGS + COL1 + COL2, rC = rX + COL3 / 2;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.negro);
    doc.setFontSize(9);
    doc.text('R-SC-01', rC, y + 3.7, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Versión N.° 0.0', rC, y + 8.6, { align: 'center' });
    doc.line(rX, y + 10, rX + COL3, y + 10);        // divide Versión / Última revisión
    doc.setFontSize(6.5);   /* _FORMATO_RSC01_2026_V1: antes se montaban las dos lineas */
    doc.text('Última revisión:', rC, y + 12.3, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);   /* _RSC01_LOGO_FREC_V1: fecha en letra normal, como el modelo */
    doc.text('24/03/2026', rC, y + 14.8, { align: 'center' });

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
    const yDatosIni = yA;   // ⭐ inicio del marco de la sección

    // ── Helpers de dibujo manual ──
    const ROW = 7;
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

    // ── Réplica EXACTA del formato oficial R-SC-01 ──
    yA += 1.5;

    // TEMA (línea solo bajo el valor, como el oficial)
    _lbl('TEMA:', MGS + 1, yA);
    _val(v('capTema').trim(), MGS + 16, yA, bW - 17);
    _sub(MGS + 15, yA + 5, MGS + bW);
    yA += 6.5;

    // FUENTE
    _lbl('FUENTE:', MGS + 1, yA);
    _val(v('capFuente').trim(), MGS + 16, yA, bW - 17);
    _sub(MGS + 15, yA + 5, MGS + bW);
    yA += 9;

    // CHECKBOXES estilo oficial: etiqueta + recuadro grande, fondo blanco, x roja
    const tiposPDF = ['INDUCCIÓN', 'PAUTA/CHARLA', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO'];
    const tiposSel = tipos.map(t => String(t).replace(/-/g, '/'));
    const grpW = bW / tiposPDF.length;
    tiposPDF.forEach((t, i) => {
      const gx = MGS + i * grpW;
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...C.negro);
      doc.text(t, gx + 1, yA + 5);
      const tw = doc.getTextWidth(t);
      const bx = gx + 1 + tw + 2.5, by = yA;
      doc.setDrawColor(...C.negro); doc.setLineWidth(0.5);
      doc.rect(bx, by, 10, 7.5);
      if (tiposSel.includes(t)) {
        doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...C.rojo);
        doc.text('x', bx + 5, by + 5.3, { align: 'center' });
      }
    });
    yA += 12;

    // ÁREA + N° TRABAJADORES + H / M (como el oficial)
    const nTrabV = v('capNTrab') || String(asistentes.length);
    const nHv    = v('capNH') || String(nH);
    const nMv    = v('capNM') || String(nM);
    _lbl('ÁREA:', MGS + 1, yA);
    _val(v('capArea').trim(), MGS + 15, yA, 78);
    _sub(MGS + 13, yA + 5, MGS + 95);
    _lbl('N° TRABAJADORES:', MGS + 99, yA);
    _val(nTrabV, MGS + 132, yA);
    _sub(MGS + 130, yA + 5, MGS + 152);
    _lbl('H:', MGS + 158, yA);
    _val(nHv, MGS + 163, yA);
    _lbl('M:', MGS + 173, yA);
    _val(nMv, MGS + 178, yA);
    yA += 9;

    // _FORMATO_RSC01_2026_V1: LABOR + FECHA + LUGAR (formato nuevo)
    _lbl('LABOR:', MGS + 1, yA);
    _val(v('capLabor').trim(), MGS + 14, yA, 62);
    _sub(MGS + 12, yA + 5, MGS + 77);
    _lbl('FECHA:', MGS + 80, yA);
    _val(v('capFecha'), MGS + 92, yA, 32);
    _sub(MGS + 90, yA + 5, MGS + 124);
    _lbl('LUGAR:', MGS + 127, yA);
    _val(v('capLugar').trim(), MGS + 140, yA, bW - 141);
    _sub(MGS + 138, yA + 5, MGS + bW);
    yA += 10;

    // HORA DE INICIO + HORA DE TÉRMINO + TOTAL DE HORAS (etiquetas completas)
    _lbl('HORA DE INICIO:', MGS + 8, yA);
    _val(v('capHoraInicio') || '', MGS + 38, yA);
    _sub(MGS + 36, yA + 5, MGS + 72);
    _lbl('HORA DE TÉRMINO:', MGS + 80, yA);
    _val(v('capHoraTermino') || '', MGS + 114, yA);
    _sub(MGS + 112, yA + 5, MGS + 148);
    _lbl('DURACIÓN:', MGS + 152, yA);   /* _FORMATO_RSC01_2026_V1: antes "TOTAL DE HORAS" */
    _val(v('capHoras') || '', MGS + 170, yA);
    _sub(MGS + 168, yA + 5, MGS + bW);
    yA += 9;

    // PRODUCTOR
    const prodV = v('capProductor') || (esRapel ? 'Sociedad Agrícola Rapel S.A.C.' : 'Sociedad Exportadora Verfrut S.A.C.');
    /* _FORMATO_RSC01_2026_V1: RAZÓN SOCIAL + ZONA (fundo) + SERVICIO O CONTRATISTA (formato nuevo; antes "PRODUCTOR") */
    _lbl('RAZÓN SOCIAL:', MGS + 1, yA);
    _val(prodV, MGS + 22, yA, 55);
    _sub(MGS + 21, yA + 5.5, MGS + 79);
    _lbl('ZONA:', MGS + 82, yA);
    _val(v('capFundo').trim(), MGS + 91, yA, 33);
    _sub(MGS + 90, yA + 5.5, MGS + 125);
    _lbl('SERVICIO O CONTRATISTA:', MGS + 128, yA);
    { /* texto largo: se achica la letra para que quepa en una linea */
      const _sv = v('capServicio').trim() || '__', _mw = bW - 164;
      doc.setFont('helvetica','normal'); let _fs = 8; doc.setFontSize(_fs);
      while (_fs > 5 && doc.getTextWidth(_sv) > _mw) { _fs -= 0.5; doc.setFontSize(_fs); }
      doc.setTextColor(...C.negro); doc.text(doc.splitTextToSize(_sv, _mw)[0], MGS + 163, yA + 3.5);
    }
    _sub(MGS + 162, yA + 5.5, MGS + bW - 1.5);
    yA += 7;

    // ⭐ MARCO: encierra toda la sección DATOS DE LA ACTIVIDAD (como el formato oficial)
    doc.setDrawColor(...C.negro); doc.setLineWidth(0.3);
    doc.rect(MGS, yDatosIni, bW, yA - yDatosIni);

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
      styles: { ...sBorder, cellPadding: 1, textColor: C.negro },
      bodyStyles: { fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 8 },
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
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA / HUELLA', 'OBSERVACIONES']],   /* _FORMATO_RSC01_2026_V1 */
      body: filasPart,
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, cellPadding: 0.5, textColor: C.negro }, /* _FIX_RESPONSABLE_PAG1_V1 */
      bodyStyles: { fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 10 },   /* _FIRMA_HUELLA_V4: 6 -> 10 mm de alto de fila */
      columnStyles: {
        /* _FIX_FIRMA_HUELLA_ANCHO_V3: estructura ORIGINAL (6 columnas, sin dividir).
           Solo se amplia la columna combinada FIRMA / HUELLA: 27mm -> 40mm.
           Compensado achicando Nombre y Cargo (tenian espacio de sobra); N°, DNI y OBS quedan igual que el original. */
        0: { cellWidth: 8 }, 1: { cellWidth: 20 },
        2: { cellWidth: 62, halign: 'left' }, 3: { cellWidth: 30, halign: 'left' },   /* _FIRMA_HUELLA_V4: nombres 70->62, cargo 32->30 */
        4: { cellWidth: 50 }, 5: { cellWidth: 20, halign: 'left' }   /* _FIRMA_HUELLA_V4: FIRMA/HUELLA 40->50 mm. Suma: 8+20+62+30+50+20 = 190 mm = ancho util A4 */
      },
      didParseCell: d => {
        if (d.section === 'head' && d.column.index === 5) { d.cell.styles.fontSize = 5.6; d.cell.styles.cellPadding = 0.2; }   /* _FORMATO_RSC01_2026_V1: "OBSERVACIONES" cabe en 20 mm */
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
      body: [[{ content: 'RESPONSABLE DEL REGISTRO / SEGURIDAD ALIMENTARIA', styles: sBanner }]],   /* _FORMATO_RSC01_2026_V1: igual para RAPEL y VERFRUT */
      theme: 'grid', styles: sBorder
    });
    y = doc.lastAutoTable.finalY;

    doc.autoTable({
      startY: y, margin: { left: MGS, right: MGS, bottom: 5 },
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO / ÁREA', 'FIRMA']],
      body: [['1', respDni, respNombre, respCargo, '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, cellPadding: 1, textColor: C.negro },
      bodyStyles: { fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 8 },
      columnStyles: { 0:{cellWidth:12}, 1:{cellWidth:25}, 2:{cellWidth:75}, 3:{cellWidth:55}, 4:{cellWidth:23} }
    });

    // ── _FIX_RESPONSABLE_PAG1_V1: NO borrar páginas extra ──
    // El antiguo while(deletePage) borraba la fila del responsable cuando se
    // desbordaba. Con los tamaños reducidos arriba debería caber siempre en 1
    // página, pero si por algún caso edge se desborda, mejor 2 páginas que
    // un PDF roto sin responsable.

    // ── Footer eliminado: el formato oficial R-SC-01 no lleva pie de página ──

    const fmtSuffix = formatoLabel ? `_${formatoLabel.replace(/[^a-zA-Z0-9]/g,'_')}` : '';
    const fname = `R-SC-01_${empresa}_${v('capFecha')}${fmtSuffix}_${v('capTema').trim().substring(0,20).replace(/[\s/\\:*?"<>|]+/g,'-')}.pdf`;
    doc.save(fname);
  } catch(e) {
    console.error('[PDF] Error:', e);
    throw e;
  }
}

async function buscarSupervisorPorDNI() {
  const dni = v('capRespDni').trim();
  if (dni.length !== 8) return;
  const elN = document.getElementById('capRespNombre');
  if (elN) elN.placeholder = '🔍 Buscando...';
  try {
    // 1. Buscar en BD_Supervisores — _CAP_RESP_AZURE_V1: primero Azure (misma lista), Google de respaldo
    const ds = await _capSupervisoresAzure() || await apiGet({ action: 'getSupervisores' });
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
    const dt = await buscarTrabajadorAzure(dni);
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

/* _RSC01_LOGO_FREC_V1: logo Unifrutti embebido (respaldo si ../images/logo-unifrutti.jpg no carga) */
const _LOGO_UNIFRUTTI_B64_ = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEg8QDxAVEBAQFRAQEBAQFRUQFRUWFhUXGBUYHSggGR0lGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGysfHx0rLS0tLS0tLS0tLSstLSstLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0rLS0tLf/AABEIAOEA4QMBEQACEQEDEQH/xAAcAAEAAgIDAQAAAAAAAAAAAAAAAQcFBgIECAP/xABHEAABAwICBgQKBQsDBQAAAAABAAIDBBEFBgcSEyExQVFSYXEiIzI1cpGSsbLBFDNzgaEIJCU0QmJ0dYKz0VPC4RUmg4Tw/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAEFAgMEBgf/xAAvEQEAAgECBQMEAQQCAwAAAAAAAQIDBBEFEhMhMQZBURQyNFIzIkJxgSRhFSND/9oADAMBAAIRAxEAPwC8UBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAugi6gLpuF1IlAQEC6BdAUBdSIugXQEEoCAgICAgICAgICCLoF0EoF1Awma8xQ4dTmpmDjGHNbZgubuNgtmLFOSdoJ7MRlDP8ASYpK+KBkrXMjEhMjQ0WJtustmbTWxeURLWM46YY6aR0FHC2pe0lrpXuIjDhxAtvcurBw+2SN5YzZuuQsckxCgiqpWsa9+tdrL2FnEc1xZqdO2zKGxrVCRSF1A+VTOyNjpHuDGNBc57jYBo4klTHkYyjzPQzPEcVXBJI7c1jXgknsCznHaI3mEbu9W10UDNpLKyJg3FzyGi/eVhFZmdoS6+HY7SVDtSGoimcBe0bw426bLKcdq+YN2JzvnWDCWxOmjkk2rntaIw3dqgE3ue1bMGC2adoRM7JyPnKDFY5JIY5IxG8MIkte5F+SjNinHO0m+7ZwtSUoCAgICAgICAghyDRsa0p4bSVD6aV0u0jdqu1YnOAPeF049Je9eaPDGbNofi8TaX6YSdiItte2/UtfgtHJPNyp37NZwDSdh1dUMpYTLtZNbV1oyBuBPHuBW/Jpb4680oizLZlzjRYcPzicNcRcRjwnkeiFrxYb5PEJmdmCw/S3hMzxHtpIieDpY3MbfvW22iy1jfZHNDnpZ+iyYYTPNJHCZYvGQsEhJJ3W7FGl5q3J8K8yS6hp4q+SiqaiWUUDr7WIRhrb8QRzuu3NNr2rzMYVphwiMrNu97Yi7xjmDWfbjcDmVaXm0U2ow93pvJeIUEGFRzQkwUTWvOtO7eLE3J7SeS83mpeb7T5bo8MfBpZwySobTxulkc94ja4RkMJO4bzyWf0mSI32OaHwn0wYcyYwlk+u2QxHxe7WB1fesp0d4jdHM2vMeYoaGkNZIHGMam5oufDtb3rRTHNrcrKZaNiWkSkxOhr6eFkrXjD6mQmRthYMt810RpbY715vlhzKZyZisdFXQVT2lzInlzmstrG7HN3etXObBF8XLVhE91l56z1T4thVQ2GKRhikgcdqBYgv5Kuwaa2PL3ZzbeGk6Ms1Q4XVOnlje9rojH4sC973Xbq9POSu0MKzs3TSDmXDsVpKaeb6XDGJp2N2TYy7Wa1t763LguLTYcmK8xDKZ3bFoQbRCCoFI+oe3as1zUNY062rutq9i0a3m5o5mVFnBcTJKAgICAgICAgIIKgeVNJ/nar+1/2hel0c/wDHabeV8VR/7fd/Lj/bVJ/9/wDbZ7KH0XzbPFaeTkwTyHuEMhV3q682LZriWPqJ58Tri4naTTzarb8gT4I7gPcssda4Me55ZbPWRJ8JETpJGTMku0OYC2zwLkEHsusdPrIzTME12d6HGHzZcmp3uLthVU4ZflG47m/cQVqnFWmp3j3Tv2fHR0fE4n/L3fEp1URz1Kteyvgr6+pZSse1jn3s5wJAsLrpz5unTdENq0jMloYKXB3SB4hY+aQs3Ne9ziW7uxcOkrXJackpns7OjTR7U1Zir9oyKFkwc0OBLn6h32twU6vVxWeSCKtOxXzjJ/GO/uLprt0Ue6+tMHmJ/wD6/wATVS6b+dst4U7kHyMS/lNV7grXW+a/6a4YTK+EGtq4aQPEZlcWB5FwLNJ4fcujLl6WPmIjeVg5myE/CMLqXOqBPtXwNs1mraz+Zuq/BqZy5O7KY2aVkvK0mKVBp45GROEZfrPBIsO5duq1HSruxiN2xaRcsSYXQUdNJKyV23qpNZgIFiGdK5tJm6uSZZTGzcPyc/qKv7aP4Vy8S/kTRcIVazSgICAgICAgICCCoHnPTXl2Snr3VViaeo1SHgGzZALOaTy6R3q94fnia8ktVoYmbSLXuof+nlzNnqbMyBvhmO1tX/lbvo6dTnN+zv6KMAfK6prC0iGGlqGh1txlcwiwPYPesNZmiJilfkhgNHfnWj/iG/NbNTMdFEeVrflEj81pf4l3wFVvDZ2vLK6r8K80V38RR/EVZ5JjrxLGPDv6OvqcS/l7veteqmOpVMPlog88U/8AX8JTW2icSK+WV08D9Kd9Oz5rXw621E2WnoZ8zwd8nxKs1k/+2WdfCntK+WpaKvkm1TsJn7WOUDcHHeWk8jdWmiz1tTlswtDF47neuradlNPK10TLeS22tq8NbpW7Hp8dLc0InfZs+R8tTxYZiNdIwxsfh08UYcLFwLblw7OC5dVlrbLWIn3ZRHZruivzxR/au/tuW/WTHRRXyujTp5of9rF8Sq9D/Kzt4VxoCP6Tf/Du94XdxGYmrGrY/wAo3yKP06j3MXPwyf6pTd9Pycz4mr+2i+ErHiMxNyi4gq5mlSCAgICAgICAg4uUSOjiMNPMwwzCKRh4sk1SPUUjJyT2ll0rTG8Q1A6M8D19bYM431dqdX1XXR9dfbydC3xLaoaakjhNOwRRwlpYWMLWixFitHVmbc0yno2+Ja/h2QsHp5WTRQsbIx4e121O5w+9bbaq1o2mUdG3xLK5iwWhxBjWVLWStY7XaNpaziLX3HoK14800neJTOK8+0sZDkfB2QvgbDGIpHMc9u0O9zPJ59q2TqrzO+50LfEvph2TcJpxIIoo2CaPZSASHwmdHFRbVWtO8ydG3xLjhOScIpJmzwxRslYbtdtCbX3cyltVa0bTJ0bfEuxjWUcNxCXazwsnlDQ24ebho4bgUx6i1O0MbY5jzDJ4RR0tHEKeHVjjZezNYbid54rVbJNrbzLKMVtu0PtWtp5mGOXZSsPFr9Vw9RSt+XxJ0rz7S16nyPg0cm1bS0+uDcXIIB9Emy3fV3223R0b/DPVcVPLC6B5jMT2GNzLtA2ZFiN3YtMX2nfdPSv8MLhuTcIppWzQ08DJWG7Hh28GxHT0ErZbU2tG0ydK3wy+L0lJVxGGoEU0ZIJa5wtccOawrk5Z3iTpW+JdHBsuYZRybWnhghkLdXWa4X1ejis757X8ydG0e0vvjeEUFaGCpjhnDCSzXcDqk2vz7AsceWcfeJOlafaXPL+C0VIHNpIo4g4hzhGb3PK6m2Wck92M1mvmGZCxQlAQEBAQEBAQEEFB5/z09wxGo8JwGuLAOI/ZCqdReYts+gcG0+O2miZhgtq7rv8AacufqW+Vx9Lh/WEbR3Xd7Tv8qee3yj6TF+sJ2juu72nf5Tnt8n0uL4hG0d1ne07/ACnPafc+lw/rBru6zvaKc9vlP02H9YNo7rO9o/5Tnt8o+lw/rCNo7rO9opz2+T6XF+sN90PPJrJLuJ8TzJPNdmktMz3eY9Q4aUxxyxs1nOD3f9QqfCd9eeZ6AtOovaLzss+E6fHbTVmYhiNq7rv9py09S3ys/pcX6wGV3Wd7Tk6lvk+lw/rCNo7rO9op1LfKPpcP6wbR3Wd7Tk57fJ9Lh/WDaO6z/acp57fJ9Lh/WDXd1ne0U57fJ9Lh/WEtkd13+05Opb5PpcX6wsvQuSXVFyT5HEk8l3aS0z5eQ9Q460mvLGy1Au55lKAgICAgICAgIIcg8+58P6SqPTb8IVRqfvfR+B/iwwK5lyICAhsInsIhF0R7t90O/rkn2H+5dui+55X1L/HX/LW84+cKr7c/C1adR98rPg0/8WrFRMLjqtaXOP7IBJ9S1RSZWN89KfdLJw5arni7aWW3aLLbGC0+zjtxbT1nabOnV4bPD9bDJEOlzbD1rCcVo8t2LXYcv2y6xWDriYmOyETuhQdhSSs3Qr5VT/R7lYaP3eK9S/dVaoXe8qICAgICAgICAggoPPue/ONR6bfhCp9T976NwT8arArmXSFIlQClIhsgqEClDfdDv65J9iPeu7Rz3eV9S/x1/wAupiGWqisxaeNsb2MdOXOmc06gZZu8HmVN8M2yNen4nj02jiI8rSy/lalo2gRxNLrb5HDWcT3ldlcUQ83qdfm1Ft7SzYYOhbNocUzL4VVJHI0texr2kWIcARZRMRPZnTLkpO9Z2VdnzITYWGppBZjd74b7gOJLejuXDn08bbw9TwnjNpt08s+Vckqv8PZRO8boUMoApFmaFvLqP6PcrHRPFepfNVqhd7yiUBAQEBAQEBAQQUHn3PnnGo9NvwhU+p++X0fgf4tWBXMuhAQESIgQEG/aHB+eS/Yj3rv0fl5L1L/HDjjWd66mxGZokDoWTEbItaPBsN2sBfmpyZ5rfZq0nB8Wo00W95hv+XM401Y0ar2sk5xuNnA/NddMtbQodXw3LgtMTDYmuutkSrpiXVr8ShgaXSyNY0b7uICi16x5bcWnyZZ2rG6q8759+kgwU12wm4fLwLx0DsXDn1PNHLD1vCuCzSYyZfLQCuCXrKwKGQFIsvQt5dR/R7lYaJ4v1N5qtUKweTSgICAgICAgICCHIPP2fPOVR6bfhCp9V976PwP8WrALmXYgICCURshAQb9oc/XJfsR8RXfo/LyXqX+OGs5x84VP259zVo1H3ytuDfi1/wAMQDY3uQRwIJB9a0xaYWV8VLxtMO+3G6sCwqZgPTKz61vly/8AjcHnlh1qmsllIMkj5COGs4myxnJM+W3HpMeP7a7PgVjDo5S6SnyKACkWVoV8uo7mKw0bxfqbzVawVg8mlAQEBAQEBAQEEOQefs+ecaj02/CFUar730fgf4tWAXKuhEiCUQKdkTOxb7+wKYiZYWvFY3lmsNynXVHkU7w3rPAYPx3rfXTXlV5+MafF5tusPR5lCpoZnzTFlnMDQ1pub3uu3Bhmnl5Xi/FKauOWrD5n0e1k1TNPEYnNkkLw0kg2sBb8Fqy6ebTvDt4dxzHgxRjtHhpuJZfq6b66nkYOsAHt9Y+a5bYLw9Hp+KafNHazGf8A3FaZjZYVtEx2CoTvuhDYRIURIFIsrQr5dR3MVjonjPU3mq1gu95JKAgICAgICAgIIcg8/Z8841Hpt+EKo1P3vo/A/wAWrALlXQiREJCk3h38GwiarmEMLbu4l37LW9JWzFim8q/Xa6mmxzNp7rgytkWmpG6zht5TYl7wNx/dHIK0x4Iq8JreLZs89p2htrWWFlviNlTMzM7y5WUhZEOEkLXCzgCOFiAVExuyraa94loebNHUM15aYCGbjq/sO7Lcj2rmy6eJ8L7h/G8mGdrzvCpqukfE90cjSx7TZzSOHb3KsvjmsvcafU0zVi9ZfArW6t0XQ3LoJBUwx91k6Fj4yo7mKw0bxvqb+1a4VhDySUBAQEBAQEBAQQ5B5+z55yqPTb8IVRqfvl9H4H+LVgFyrmS6J3ERMuxR0j5pGxRt1pHuDQB7+4LZjpNpc2r1FcGObyvnKeXo6GARtGs8gF8nNzuf3K3w4opD5tr9bfU5OafDPNC3OFyQEBAQcHNQaXpEyq2rhMsbR9IY0kEcXtG8tPeuXPhiY3XPCeIWwZOWZ/plSzh0ix6DyVVMbS+h47xesTDiVi2IUiUhHusrQt9ZUeixWGj93jfU39q2ArCHkhAQEBAQEBAQEEOQefs++cqj02/CFUan75fR+B/i1YArmXUoRCVCJWPohwfXkkq3Dc3xcfefKPuVlpMfbmeN9Raud4xQtjVXfLySQEEoCAgIIKDg4JJ47qM0j4QKauJaLMlBkHRrX8L5H71U6rHtbd7/AIDq5y4eWfZqi5XoIQiUpCJWVoW+sqO5isNF7vG+pv7VsBWDyQgICAgICAgICCCg8/5/H6Sn9Jh9bQqjVfe+j8C/Gq19cq6lFkQm9lKJnaF86PKMRYfEOZbrntJ5q609dqQ+Z8Wyzk1Nv+m0LcrBAQEBAQEEFBW2malGxhmA3tk1b9jh/wABcWrr2ej9OZZrlmqqCqx7yEIkSESsrQsfGVHcxWOi93jfUv8AatcLveSSgICAgICAgICCHIKB0hD9Jz98fwBU+q+99F4B+NDXVzLzfcQlDuB7llDXeOz0Nk5wNDBb/Sb7ldYvsh8u4hvGot/lmwtrjSgICAgICCCg0HTC/wDMmjplauPVz/SvvT9ZnUKcKq30HYQQkIlZehZvh1B7GBWOj93jfUs96rXC73k0oCAgICAgICAgghBRulODUxFzuvEx33i4+SqdXH9b3npy++DZqK5HpIESKWMru0W14koGsv4UZLCOjo/BXGmtzUfN+N4px6iZ+W5LoVCUBAQEBBBQQSgqvTLiALoacctaVw7OA95XBrL+z1fpvBO9skq0KrntPZxQSFMIla+hintDNJ1pAPZFlZ6SvZ4X1Fk5s0QsoLsebSgICAgICAgICCHIKu0xYaLRVIG8ExHuO8Lh1dN+71PpvU7XnHKsSFWPboRMilGzcdGeOimqtm42jms034B48k+rcuzS5OWdnmuP6HqY+pHmF2awVo8H332cwiUoCAgIOJQfCqqGxsdI86rWtLiSbAAC6i1oiN2WOlr25Y93nvM2LGrqpJzeziGsvyjbwVPmvzWfSeF6SNPgiPliytC0QiQGyyrG7XkttG6+NG+H7DD4gRZzhtD3u3q3wV5avmvFs3V1E/8ATaQt6tSgICAgICAgICCCgwGdMJ+lUUsQ8rV1mn94bwtWavNXZ28Pz9HPWygHNIJB3EXBHaOKpbV2nZ9OxXi9YmHFYtohPdIPO5vcG45ELKJmJ3a8mPmrtK4NHucm1DBTTm07QAHHhIOkdqtNPni3aXguL8KthtN6R2lvocuuHn4SHIlyQEHElES+cj7bzYAcSd25PZMRzTEQqPSPnH6QTSQO8U0+Mf1z1R2dPSq7UZ9/6Yew4LwmazGa/wDpoBXA9fHaNkIClLIYFhrqqpjgH7ThrdjAfC/D3rbhpNrK7iWojDgmz0XSwhjGsG4NaGgdgCuYjaHzK9ptabT7vupYiAgICAgICAgIIKDi4JsROyjNI2CGlrHPa20U3htI4B/7Q+aqtVj5Z3h73gWu6mLknzDVFyPRiggUwTDmx5BDgS1wNwQbEHsKyraYndryYoyV2mG/5a0lPhAjqmmVosBIze7+oc124tVt5eT1/p/eebEsbC8x0lSLxTsdu4XsfUuyuatnmc2iz4p2tVlmyA8x6wtm8OaazDjJM0C5cAO0hOaExS0+IYDGs50VKDrztc7qM8Jx+4LTfPWrtwcNz5Z25VYZrz5PWXjjvBDzAJDnDtI4BcOXUzPaHrOH8Crh/qv3lqJXLM7vRxERG0IKhKEQ5BTCLTt5Wpoly+WtdWSCxeNWMEcGc3ff8lZ6XHtG7w3H9dGS/TrPhZTV2PNOaJEBAQEBAQEBAQEEEIMHmvAWV1O6J3lcWO6rxwK15Kc8bOzQ6q2nyRaPChK+jkgldDK0tkYSDutftHYVT5KTSdn0jS6muekXq6y1uyBQyEC6MeyWuINwS09LSQfwWUWmGm+Kl/MO03Falvk1Ew/8jln1bfLmnh2C39sOMuJTv8ueV3e9yiclvlnTQYa+Kw65N+PHp5rGbTLprSK+IQSoZIQQUEqTdsGTstvr59W1oG2Mj+G7qg9JXRgxc8qPi/Ea4KcsT3lfVLA1jQxo1WtAAA6FbRERG0Pn17ze3NL72UsUoCAgICAgICAgICAg4uQannTKMdczXaAyoa0hj7cR1XdIWjNgi0LXh3Er6a//AEpWuopIJDFKxzJG8WnmOkHmFU5KTWdn0DS6qmekWrLrLW7O4iBDZCIgRIiBEiIFIWQZjLeXZ66XUjbZgI15SNzB8z2LfhwzaVTxHiWPTUmN+69cAwWKjhEMTdVo4nm53MlW1KRXtD59qdTfUX57soFm50oCAgICAgICAgICAgICDiQgwOZsrU9ezVkbZ4vqyt3Oae/mFqyYa3ju7tHr8umtvWe3wp3MmVKqicdZhki5TMbcW7RxBVblwTXw9voeMYtRWIntLArn7wuYtFo7IWLLdCJLIgQApEqEe6QOQBJPIbye4LKKzLVkyVpG9p2bnlXR/PUkSTh0EPGx3PcOzoXZh00z5eb4hxymOJrj7yt3CsLhpoxFCwRsHAAfj3qwrWKxtDx+bUXzW5rzu74CzaUoCAgICAgICAgICAgICAgIIRD5SwtcLOaHA8QRdRtHuyra1Z3rLTcd0c0dQS+MOp5Olnkk9rVoyaatlxpON58PaZ3hpOJ6N66LfHqVA/dOqfUVyW0cx4eh0/qLDbtbs1upwSqjNn0s7eX1bj+IWicF4WmPienvHazqmB43bN47Cx1/csOS3w6I1eL9oSykld5MUjuwRuPyTp2+GM6zDHm0MhRZarZjZlLN3uaWD1uWyNPeXNl4xpqR5bThWi6ofYzytiHVYNY+s7lvppJnyptR6jrH2Q3vL+SqOj8Jse0k/wBSTwj93Qu2mCtXntVxTPqPuns2QNW1XOVkEoCAgICAgICAgICAgICAgICAgIIKCLIILAeV1GyYmXDYN6rfUFG0fDLqW+UiFvJoH3BTtHwib2+XIBGKVIAIhyQESICAgICAgICAgICAgICAgICAgICAgICCCoEqQQEBAQEBAQEBAQEBAQf/2Q==';

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

/* _CAP_HOY_LIMA_V1 (03-oct-2026): fecha AAAA-MM-DD en hora de Lima (no UTC) */
function _hoyLimaCap(d) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); }
  catch (e) { const x = new Date((d || new Date()).getTime() - 5 * 3600e3); return x.toISOString().slice(0, 10); }
}

/* _CAP_RESP_AZURE_V1 (03-oct-2026): lista de supervisores (BD_Supervisores) desde Azure,
   la misma que usa la carga del dashboard. Se pide una sola vez por pagina.
   Si Azure falla o tarda mas de 6 s -> null y se usa Google como siempre. */
let _capSupAzureCache = null;
async function _capSupervisoresAzure() {
  if (_capSupAzureCache) return _capSupAzureCache;
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const reloj = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} }, 6000);
  try {
    const op = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    if (ctrl) op.signal = ctrl.signal;
    const r = await fetch('https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/mod/sup/getSupervisores', op);
    const j = await r.json();
    clearTimeout(reloj);
    if (r.status === 200 && j && j.success && Array.isArray(j.data)) { _capSupAzureCache = j; return j; }
    console.warn('[_CAP_RESP_AZURE_V1] Azure HTTP ' + r.status + ' -> Google (respaldo)');
  } catch (e) { clearTimeout(reloj); console.warn('[_CAP_RESP_AZURE_V1] Azure sin respuesta -> Google (respaldo)'); }
  return null;
}

/* ─────────────────────── REGISTROS ─────────────────────── */
let _chartTendenciaCap = null;
let _chartEmpresaCap   = null;
let _chartTopSupCap    = null;

async function cargarRegistros() {
  const wrap = document.getElementById('tbRegistrosWrap');
  if (!wrap || !USER) return;
  wrap.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Cargando...</div>';
  try {
    const d = await apiPost({
      action:     'listarCapacitaciones',
      rol:        USER.rol,
      usuario:    USER.usuario,
      empresa:    v('filtroEmpReg')     || '',
      desde:      v('filtroDesdeCap')   || '',
      hasta:      v('filtroHastaCap')   || '',
      supervisor: v('filtroSupCap')     || ''
    });
    if (!d.success) throw new Error(d.error || 'Error servidor');

    const lista = d.capacitaciones || [];
    const esAdmin = !!d.esAdmin;

    // Mostrar/ocultar sección admin
    const secAdmin = document.getElementById('seccionRegistrosAdmin');
    if (secAdmin) secAdmin.style.display = esAdmin ? '' : 'none';

    // Ocultar filtro supervisor si no es admin
    const filtroSupRow = document.getElementById('filtroSupRow');
    if (filtroSupRow) filtroSupRow.style.display = esAdmin ? '' : 'none';

    if (!lista.length) {
      wrap.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>Sin registros aún</div>';
    } else {
      esAdmin ? renderizarTablaAdmin(lista) : renderizarTablaSupervisor(lista, wrap);
    }

    if (esAdmin) await cargarEstadisticas();

  } catch(e) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">❌</div>Error: ${e.message}</div>`;
  }
}

function renderizarTablaSupervisor(lista, wrap) {
  window._capRegistros = lista;          /* _CAP_DUPLICAR_V1 */
  if (!wrap) wrap = document.getElementById('tbRegistrosWrap');
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Tema</th>
        <th style="text-align:center">Asistentes</th><th></th>
      </tr></thead>
      <tbody>${lista.map((r, i) => `<tr>
        <td><span class="badge-emp ${r.empresa === 'RAPEL' ? 'badge-rap' : 'badge-vrf'}">${r.empresa || ''}</span></td>
        <td>${String(r.fecha||'').substring(0,10)}</td>
        <td style="font-size:11px;color:#475569">${r.tipo || ''}</td>
        <td style="font-size:12px">${(r.tema||'').substring(0,60)}${(r.tema||'').length>60?'…':''}</td>
        <td style="text-align:center;font-weight:700">${r.totalAsistentes || r.total_asistentes || 0}</td>
        <td><button class="btn btn-gray btn-sm" title="Usar esta misma nomina con otro titulo"
             onclick="capAbrirDuplicar(${i})">📋 Reutilizar</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
}

function renderizarTablaAdmin(lista) {
  window._capRegistros = lista;          /* _CAP_DUPLICAR_V1 */
  const wrap = document.getElementById('tbRegistrosWrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Tema</th>
        <th style="text-align:center">Asistentes</th><th>Supervisor</th><th></th>
      </tr></thead>
      <tbody>${lista.map((r, i) => `<tr>
        <td><span class="badge-emp ${r.empresa === 'RAPEL' ? 'badge-rap' : 'badge-vrf'}">${r.empresa || ''}</span></td>
        <td>${String(r.fecha||'').substring(0,10)}</td>
        <td style="font-size:11px;color:#475569">${r.tipo || ''}</td>
        <td style="font-size:12px">${(r.tema||'').substring(0,60)}${(r.tema||'').length>60?'…':''}</td>
        <td style="text-align:center;font-weight:700">${r.totalAsistentes || r.total_asistentes || 0}</td>
        <td style="font-size:11px;color:#64748b">${r.creadaPorNombre || r.creadaPor || '—'}</td>
        <td><button class="btn btn-gray btn-sm" title="Usar esta misma nomina con otro titulo"
             onclick="capAbrirDuplicar(${i})">📋 Reutilizar</button></td>
      </tr>`).join('')}</tbody>
    </table>`;
}

async function cargarEstadisticas() {
  try {
    const d = await apiPost({ action: 'estadisticasCapacitaciones', rol: USER.rol, usuario: USER.usuario });
    if (!d.success || !d.esAdmin) return;
    renderizarCards(d.stats);
    renderizarGraficoTendencia(d.stats.tendencia || []);
    renderizarGraficoEmpresa(d.stats.porEmpresa || {});
    renderizarGraficoTopSupervisores(d.stats.topSupervisores || []);
  } catch(e) { console.warn('[capStats] Error:', e); }
}

function renderizarCards(stats) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
  set('statTotal',      stats.totalCapacitaciones);
  set('statAsistentes', stats.totalAsistentes);
  set('statEsteMes',    stats.capacitacionesEsteMes);
  set('statSupActivos', stats.supervisoresActivosMes);
}

function renderizarGraficoTendencia(tendencia) {
  const canvas = document.getElementById('chartTendenciaCap');
  if (!canvas || !window.Chart) return;
  if (_chartTendenciaCap) _chartTendenciaCap.destroy();
  _chartTendenciaCap = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: tendencia.map(t => t.mes),
      datasets: [
        { label: 'Capacitaciones', data: tendencia.map(t => t.capacitaciones),
          borderColor: '#0a2463', backgroundColor: 'rgba(10,36,99,0.1)', fill: true, tension: 0.4 },
        { label: 'Asistentes', data: tendencia.map(t => t.asistentes),
          borderColor: '#D91F26', backgroundColor: 'rgba(217,31,38,0.1)', fill: false, tension: 0.4, yAxisID: 'y1' }
      ]
    },
    options: { responsive: true, scales: {
      y:  { beginAtZero: true, position: 'left' },
      y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } }
    }}
  });
}

function renderizarGraficoEmpresa(porEmpresa) {
  const canvas = document.getElementById('chartEmpresaCap');
  if (!canvas || !window.Chart) return;
  if (_chartEmpresaCap) _chartEmpresaCap.destroy();
  _chartEmpresaCap = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['RAPEL', 'VERFRUT'],
      datasets: [{ data: [porEmpresa.RAPEL || 0, porEmpresa.VERFRUT || 0],
        backgroundColor: ['#D91F26', '#0a2463'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderizarGraficoTopSupervisores(topSup) {
  const canvas = document.getElementById('chartTopSupCap');
  if (!canvas || !window.Chart) return;
  if (_chartTopSupCap) _chartTopSupCap.destroy();
  if (!topSup.length) return;
  _chartTopSupCap = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: topSup.map(s => s.nombre || s.usuario),
      datasets: [{ label: 'Asistentes capacitados', data: topSup.map(s => s.asistentes),
        backgroundColor: '#0a2463' }]
    },
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }
  });
}

function aplicarFiltrosCap() { cargarRegistros(); }
function limpiarFiltrosCap() {
  ['filtroEmpReg','filtroDesdeCap','filtroHastaCap','filtroSupCap'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  cargarRegistros();
}

/* ─────────────────────── EXPORTAR CSV ─────────────────────── */
async function exportarCSV() {
  const fb = document.getElementById('expFeedback');
  if (fb) fb.textContent = '⏳ Exportando...';
  try {
    const d = await apiPost({
      action:  'exportarCapacitaciones',
      empresa: v('expEmpresa'),
      desde:   v('expDesde'),
      hasta:   v('expHasta'),
      supervisor: v('expSupervisor'),          /* _CAP_EXPORT_SUP_V1 */
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
async function resetearFormulario() {
  if (!await appConfirm('¿Iniciar una nueva capacitación? Se perderá la lista actual de asistentes.')) return;
  asistentes = [];
  _dniCooldown = {};
  _esRetroactivo = false; _fechaRetroactiva = null; _motivoRetroactivo = '';
  _trabajadoresProgramados = 0; _totalFormatos = 1;
  renderLista();
  _mostrarPaso(0);
  sv('cantTrabajadores', '20');
  const sl = document.getElementById('sliderTrabajadores');
  if (sl) sl.value = 20;
  _actualizarPreviewFormatos(20);
  const br = document.getElementById('bannerRetroactivo');
  if (br) br.style.display = 'none';
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
function setTipos(str) {
  const wanted = (str == null ? '' : String(str))
    .split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
  document.querySelectorAll('#capTipoGroup input[type=checkbox]').forEach(cb => {
    cb.checked = wanted.indexOf(String(cb.value).trim().toUpperCase()) >= 0;
  });
}

function getTipos() {
  return [...document.querySelectorAll('#capTipoGroup input[type=checkbox]:checked')].map(cb => cb.value);
}
function v(id)       { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  val = (val == null) ? '' : val;
  // FIX area: si es <select> y el valor no existe como opcion, agregarla antes de seleccionar
  if (el.tagName === 'SELECT' && val !== '') {
    var existe = false;
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === val) { existe = true; break; }
    }
    if (!existe) {
      var opt = document.createElement('option');
      opt.value = val; opt.textContent = val;
      el.appendChild(opt);
    }
  }
  el.value = val;
}

async function apiGet(p) {
  const r = await fetch(API + '?' + new URLSearchParams(p));
  return r.json();
}
async function apiPost(b) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } });
  return r.json();
}

/* ── Exposiciones globales para onclick ── */
window.abrirNuevaCapacitacion       = abrirNuevaCapacitacion;
window.abrirCapacitacionRetroactiva = abrirCapacitacionRetroactiva;
window.calcularFormatos             = calcularFormatos;
window.sincronizarCantidad          = sincronizarCantidad;
window.cancelarCapacitacion         = cancelarCapacitacion;
window.continuarAPaso1              = continuarAPaso1;
window.actualizarProgresoAsistentes = actualizarProgresoAsistentes;
window.generarPDFsFormatos          = generarPDFsFormatos;
window.guardarYGenerar              = guardarYGenerar;
window.regenerarFormatoCapacitacion = regenerarFormatoCapacitacion;
window._mostrarModalBusquedaCapacitaciones = _mostrarModalBusquedaCapacitaciones;
window._ejecutarBusquedaCapacitaciones = _ejecutarBusquedaCapacitaciones;


/* ═══════════════════════════════════════════════════════════════════════════
   _FUNDO_CAP_V1 (27-ago-2026) — el fundo de quien registra la capacitacion

   QUE PASABA
   ---------------------------------------------------------------------------
   El fundo no se guardaba porque NUNCA SE PEDIA: la palabra "fundo" aparecia
   una sola vez en capacitaciones.html, y era dentro del texto de ejemplo del
   campo Lugar. No existia el campo.

   DE DONDE SALE AHORA
   ---------------------------------------------------------------------------
   Del propio usuario. Al iniciar sesion el sistema ya guarda en la sesion:
       USER.fundos    -> la lista de fundos de esa persona
       USER.fundoHoy  -> el que eligio al entrar
   Es el mismo dato que Mis Atenciones usa para rellenar el fundo solo
   (dashboard.html, linea 5714). Aqui se hace igual, para que los dos modulos
   se comporten de la misma forma.

   Si el usuario no tiene fundo asignado (los administradores no lo tienen),
   el campo queda para elegir a mano, y con Gestionar se pueden agregar mas.
   ═══════════════════════════════════════════════════════════════════════════ */
/* _FUNDO_CAP_V2 — a que fundo pertenece cada supervisor.
   Entregado por Joel el 28-ago-2026.

   DOS CORRECCIONES autorizadas por Joel el 28-ago:
     · "LOS OLVARES"  ->  "LOS OLIVARES"   (le faltaba la i)
     · "MARTINEZ JAUREZ" -> "MARTINEZ JUAREZ" (como figura en el sistema)
   LOS OLIVARES y OLIVARES BAJO son DOS fundos distintos.

   Pool Tamayo tiene DOS fundos: a el no se le elige uno, elige el suyo. */
var SUP_FUNDOS = {
  'POOL WILFREDO TAMAYO RODRIGUEZ':     ['EL PAPAYO', 'LIMONES'],
  'ALEXANDER TINEO RAMOS':              ['OLIVARES BAJO'],
  'FLOR DE LOS MILAGROS PULACHE VIERA': ['LOS OLIVARES'],
  'ALEX FABIAN ZAPATA JUAREZ':          ['APROA'],
  'YHANELLY GERALDINE LUZON VENEGAS':   ['SANTA ROSA'],
  'ALEXANDER MARTINEZ JUAREZ':          ['PUNTA ARENAS'],
  'SERGIO VIERA GIRON':                 ['ALGARROBOS'],
  'ELBERTH CASTRO BAYONA':              ['SAN VICENTE'],
  'ROBERTO MOLERO ABAD':                ['PLANTA RAPEL']
};

/* Limpia el nombre para poder compararlo: sin tildes, sin dobles espacios */
function _normNombre(s) {
  return String(s || '').toUpperCase()
    .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Busca al supervisor en la tabla. Primero exacto; si no, por coincidencia de
   apellidos, porque los nombres se escriben a mano y no siempre igual
   (por ejemplo MARTINEZ JUAREZ / MARTINEZ JAUREZ). */
function _fundosDeSupervisor(nombre) {
  var n = _normNombre(nombre);
  if (!n) return null;

  if (SUP_FUNDOS[n]) return { fundos: SUP_FUNDOS[n], como: 'exacto' };

  var mios = n.split(' ').filter(function (t) { return t.length >= 4; });
  var mejor = null, mejorPunt = 0;

  Object.keys(SUP_FUNDOS).forEach(function (k) {
    var suyos = _normNombre(k).split(' ').filter(function (t) { return t.length >= 4; });
    var iguales = 0;
    suyos.forEach(function (t) { if (mios.indexOf(t) >= 0) iguales++; });
    var punt = suyos.length ? (iguales / suyos.length) : 0;
    if (iguales >= 2 && punt > mejorPunt) { mejorPunt = punt; mejor = k; }
  });

  if (mejor && mejorPunt >= 0.6) {
    return { fundos: SUP_FUNDOS[mejor], como: 'parecido a "' + mejor + '"' };
  }
  return null;
}

function _fundoDelUsuario() {
  try {
    var u = USER || JSON.parse(sessionStorage.getItem('user') || '{}');
    if (u && u.fundoHoy) return String(u.fundoHoy).trim();
    if (u && Array.isArray(u.fundos) && u.fundos.length === 1) return String(u.fundos[0]).trim();
    /* _FUNDO_CAP_V2: si tiene UN solo fundo en la tabla, se elige solo.
       Si tiene dos (Pool Tamayo), se deja que el elija. */
    var t = _fundosDeSupervisor((u && (u.nombre || u.usuario)) || '');
    if (t && t.fundos.length === 1) return t.fundos[0];
    return '';
  } catch (e) { return ''; }
}

function _prepararFundo() {
  try {
    var sel = document.getElementById('capFundo');
    if (!sel) return;

    var u = USER || JSON.parse(sessionStorage.getItem('user') || '{}');
    var guardados = cargarLista('fundo');
    var suyos = (u && Array.isArray(u.fundos)) ? u.fundos : [];

    /* _FUNDO_CAP_V2: si la sesion no trae fundos, se miran los de la tabla */
    var deTabla = _fundosDeSupervisor((u && (u.nombre || u.usuario)) || '');
    if (deTabla && !suyos.length) {
      suyos = deTabla.fundos.slice();
      console.log('[_FUNDO_CAP_V2] supervisor reconocido (' + deTabla.como +
                  ') -> ' + suyos.join(' / '));
    }

    var cambio = false;
    suyos.forEach(function (f) {
      var t = String(f || '').trim();
      if (t && guardados.indexOf(t) < 0) { guardados.push(t); cambio = true; }
    });
    if (cambio) guardarLista('fundo', guardados);

    poblarSelect('fundo');

    var mio = _fundoDelUsuario();
    if (mio) {
      if (guardados.indexOf(mio) < 0) {
        guardados.push(mio);
        guardarLista('fundo', guardados);
        poblarSelect('fundo');
      }
      sel.value = mio;
    } else {
      sel.value = '';
    }

    var ayuda = document.getElementById('capFundoAyuda');
    if (ayuda) {
      ayuda.textContent = mio
        ? 'Tomado de tu usuario. Puedes cambiarlo si fue en otro fundo.'
        : 'Tu usuario no tiene fundo asignado. Eligelo de la lista o agregalo con Gestionar.';
    }

    console.log('[_FUNDO_CAP_V1] fundo del usuario: ' + (mio || '(ninguno)') +
                ' | fundos en la lista: ' + guardados.length);
  } catch (e) {
    console.warn('[_FUNDO_CAP_V1] no se pudo preparar el fundo: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  setTimeout(_prepararFundo, 300);
});


/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_DUPLICAR_V1 (01-set-2026) — reutilizar la nomina con otro titulo

   EL CASO
   ---------------------------------------------------------------------------
   El usuario registra 50 trabajadores de una ruta como "Capacitacion ETI".
   Ese mismo grupo recibe tambien un comunicado. Hoy tendria que volver a
   escanear los 50 fotochecks para emitir el segundo formato.

   POR QUE SE DUPLICA Y NO SE EDITA
   ---------------------------------------------------------------------------
   Si se editara el titulo del registro original, la capacitacion ETI
   desapareceria del historial y ante una auditoria no habria evidencia de que
   se dicto. Duplicando quedan los dos registros, cada uno con su formato y su
   misma nomina.

   El modal se crea solo, asi que este archivo es el unico que hay que subir:
   no hace falta tocar capacitaciones.html.
   ═══════════════════════════════════════════════════════════════════════════ */

function capCrearModalDuplicar() {
  if (document.getElementById('modalDupOverlay')) return;
  var d = document.createElement('div');
  d.className = 'modal-overlay';
  d.id = 'modalDupOverlay';
  /* _CAP_DUPLICAR_V1 (02-set): la ventana de Regenerar formato usa z-index 9999.
     La clase modal-overlay del CSS tiene 500, asi que sin esto la ventana se abre
     POR DEBAJO y los clics los atrapa la de arriba: se ve, pero no deja escribir. */
  d.style.zIndex = '10050';
  d.onclick = function (e) { if (e.target === d) capCerrarDuplicar(); };
  d.innerHTML =
    '<div class="modal-lista" onclick="event.stopPropagation()">' +
      '<h3>📋 Reutilizar la nómina</h3>' +
      '<div id="dupResumen" style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;' +
        'padding:10px 13px;font-size:12.5px;color:#1e40af;line-height:1.6;margin-bottom:14px"></div>' +
      '<div class="fg" style="margin-bottom:12px">' +
        '<label class="lbl">Título del nuevo registro *</label>' +
        '<input type="text" id="dupTitulo" maxlength="160" placeholder="Ej: Comunicado de seguridad">' +
      '</div>' +
      '<div class="fg" style="margin-bottom:12px">' +
        '<label class="lbl">Fecha</label>' +
        '<input type="date" id="dupFecha">' +
      '</div>' +
      '<div style="font-size:11.5px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;' +
        'border-radius:7px;padding:8px 11px;margin-bottom:14px;line-height:1.55">' +
        'El registro original <b>no se modifica</b>. Se crea uno nuevo con las mismas ' +
        'personas y el título que escribas, y de ahí sale su propio formato R-SC-01.' +
      '</div>' +
      '<div id="dupAlerta"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn btn-gray btn-sm" onclick="capCerrarDuplicar()">Cancelar</button>' +
        '<button class="btn btn-primary btn-sm" id="dupBtn" onclick="capConfirmarDuplicar()">✔ Crear el registro</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
}

function capCerrarDuplicar() {
  var o = document.getElementById('modalDupOverlay');
  if (o) o.classList.remove('open');
}

/* Desde la pantalla de Regenerar formato: los objetos vienen con otra forma */
function capAbrirDuplicarRegen(idx) {
  var lista = window._capacitacionesEncontradas || [];
  var c = lista[idx];
  if (!c) { alert('No encuentro esa capacitación. Vuelve a buscar.'); return; }
  capAbrirDuplicarObj({
    idCapacitacion:  c.id,
    tema:            c.tema,
    empresa:         c.empresa,
    fecha:           c.fecha,
    totalAsistentes: (c.asistentes || []).length,
    creadaPorNombre: c.creadaPorNombre || '',
    creadaPor:       c.creadaPor || ''
  });
}

function capAbrirDuplicar(idx) {
  var lista = window._capRegistros || [];
  var r = lista[idx];
  if (!r) { mostrarFeedback('err', 'No encuentro ese registro. Actualiza la lista.'); return; }
  capAbrirDuplicarObj(r);
}

function capAbrirDuplicarObj(r) {
  if (!r) return;
  capCrearModalDuplicar();
  window._capDupActual = r;

  var n = r.totalAsistentes || r.total_asistentes || 0;
  var fecha = String(r.fecha || '').substring(0, 10);
  var res = document.getElementById('dupResumen');
  if (res) {
    res.innerHTML =
      'Vas a crear un registro nuevo con las mismas <b>' + n + ' personas</b> de:<br>' +
      '<b>' + (r.tema || '(sin título)') + '</b><br>' +
      (r.empresa || '') + ' · ' + fecha +
      (r.creadaPorNombre || r.creadaPor ? ' · registró ' + (r.creadaPorNombre || r.creadaPor) : '');
  }
  var t = document.getElementById('dupTitulo'); if (t) t.value = '';
  var f = document.getElementById('dupFecha');  if (f) f.value = fecha;
  var a = document.getElementById('dupAlerta'); if (a) a.innerHTML = '';

  document.getElementById('modalDupOverlay').classList.add('open');
  setTimeout(function () { if (t) t.focus(); }, 120);
}

async function capConfirmarDuplicar() {
  var r = window._capDupActual;
  if (!r) return;

  var titulo = String((document.getElementById('dupTitulo') || {}).value || '').trim();
  var fecha  = String((document.getElementById('dupFecha')  || {}).value || '').trim();
  var al = document.getElementById('dupAlerta');

  function aviso(msg, ok) {
    if (!al) return;
    al.innerHTML = '<div style="background:' + (ok ? '#dcfce7' : '#fef2f2') +
      ';border:1.5px solid ' + (ok ? '#86efac' : '#fecaca') + ';color:' + (ok ? '#166534' : '#dc2626') +
      ';border-radius:8px;padding:9px 12px;font-size:12.5px;margin-bottom:12px">' + msg + '</div>';
  }

  if (!titulo)            { aviso('Escribe el título del nuevo registro.'); return; }
  if (titulo.length < 4)  { aviso('El título es muy corto. Escribe algo que se entienda.'); return; }
  if (titulo.trim().toLowerCase() === String(r.tema || '').trim().toLowerCase()) {
    aviso('Ese es el mismo título del registro original. Ponle uno distinto.'); return;
  }

  var btn = document.getElementById('dupBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Creando...'; }
  try {
    var d = await apiPost({
      action: 'duplicarCapacitacion',
      idCapacitacion: r.idCapacitacion || r.id_capacitacion || r.id,
      tituloNuevo: titulo,
      fecha: fecha,
      usuario: USER.usuario,
      rol: USER.rol
    });
    if (!d || !d.success) { aviso((d && d.error) || 'No se pudo crear el registro'); return; }

    aviso('✔ Registro creado con ' + d.asistentes + ' asistentes.', true);
    setTimeout(function () {
      capCerrarDuplicar();
      mostrarFeedback('ok', '✅ Se creó "' + titulo + '" con la misma nómina (' +
                            d.asistentes + ' personas). Ya puedes generar su formato.');
      if (typeof cargarRegistros === 'function') cargarRegistros();
    }, 900);

  } catch (e) {
    aviso('Error de conexión: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '✔ Crear el registro'; }
  }
}

window.capAbrirDuplicar      = capAbrirDuplicar;
window.capAbrirDuplicarRegen = capAbrirDuplicarRegen;
window.capAbrirDuplicarObj   = capAbrirDuplicarObj;
window.capConfirmarDuplicar = capConfirmarDuplicar;
window.capCerrarDuplicar   = capCerrarDuplicar;

console.log('[_CAP_DUPLICAR_V1] reutilizar nomina listo');


/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_EXPORT_SUP_V1 (02-set-2026) — exportar por el usuario que registro
   ---------------------------------------------------------------------------
   EL CASO
   Un administrador necesita bajar la base de UN supervisor en particular, no
   la de todos juntos. El backend capExportarV2 ya acepta el parametro
   "supervisor"; lo que faltaba era donde elegirlo en la pantalla.

   QUE HACE
   1) Al entrar a la pestana Exportar, si el usuario es administrador, agrega
      un campo "Registrado por" con la lista de quienes han registrado.
   2) Llena tambien el selector de supervisores de la pestana Registros, que
      estaba en el HTML con una sola opcion y nunca se llenaba.

   La lista sale de listarCapacitaciones, que ya devuelve creadaPor y
   creadaPorNombre, asi que NO hace falta ningun endpoint nuevo.

   A un supervisor no se le muestra el campo: capExportarV2 ya lo limita a sus
   propios registros del lado del servidor. El campo es una comodidad para el
   administrador, no el candado.
   ═══════════════════════════════════════════════════════════════════════════ */

var _capSupLista   = null;
var _capSupEsAdmin = false;

/* _EXPORT_SUP_V2 (09-set-2026) - ARREGLO DE LENTITUD
   ---------------------------------------------------------------------------
   La version anterior pedia listarCapacitaciones con desde:'' y hasta:'', o sea
   SIN rango: para un administrador eso trae toda la historia con todos los
   asistentes. Y ademas la pedia para CUALQUIER usuario que abriera la pestana
   Exportar, porque el rol recien se comprobaba despues de traer los datos.
   Es el mismo error de la consulta por DNI de agosto: pedir sin limite.

   AHORA: 1) si el usuario no es administrador no se pide nada, porque el
   selector no se le muestra igual; 2) se pide solo los ultimos 12 meses, que
   es de sobra para saber quienes han registrado; 3) el resultado se guarda en
   memoria, asi que se pide una sola vez por sesion. */
var CAP_MESES_SUP = 12;
var CAP_ROLES_ADMIN_UI = ['administrador','administrador 01','administrador 02',
                          'admin','admin01','admin02','coordinador','jefa_rl','jefe_rl'];
function capPareceAdmin() {
  var r = String((typeof USER !== 'undefined' && USER && USER.rol) || '').toLowerCase().trim();
  return CAP_ROLES_ADMIN_UI.indexOf(r) >= 0;
}
function capDesdeMeses(n) {
  var f = new Date();
  f.setMonth(f.getMonth() - n);
  return _hoyLimaCap(f);   /* _CAP_HOY_LIMA_V1 */
}

async function capCargarSupervisores() {
  if (_capSupLista) return _capSupLista;
  if (!capPareceAdmin()) { _capSupLista = []; _capSupEsAdmin = false; return _capSupLista; }
  try {
    var _t0 = (window.performance && performance.now()) || Date.now();
    var d = await apiPost({
      action:     'listarCapacitaciones',
      rol:        USER.rol,
      usuario:    USER.usuario,
      empresa:    '',
      desde:      capDesdeMeses(CAP_MESES_SUP),
      hasta:      _hoyLimaCap(new Date()),   /* _CAP_HOY_LIMA_V1 */
      supervisor: ''
    });
    try {
      var _ms = Math.round((((window.performance && performance.now()) || Date.now())) - _t0);
      console.log('[_EXPORT_SUP_V2] lista de supervisores en ' + _ms + ' ms');
    } catch (e) {}
    _capSupEsAdmin = !!(d && d.esAdmin);
    var lista = (d && d.capacitaciones) || [];
    var vistos = {};
    lista.forEach(function (c) {
      var u = String(c.creadaPor || '').toLowerCase().trim();
      if (!u || vistos[u]) return;
      vistos[u] = c.creadaPorNombre || c.creadaPor;
    });
    _capSupLista = Object.keys(vistos).sort().map(function (u) {
      return { usuario: u, nombre: vistos[u] };
    });
  } catch (e) {
    console.warn('[_CAP_EXPORT_SUP_V1] no se pudo leer la lista de supervisores:', e.message);
    _capSupLista = [];
  }
  return _capSupLista;
}

function capPintarSelectSup(sel, lista) {
  if (!sel) return;
  var actual = sel.value;
  sel.innerHTML = '<option value="">Todos los supervisores</option>';
  lista.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.usuario;
    o.textContent = s.nombre || s.usuario;
    sel.appendChild(o);
  });
  sel.value = actual;
}

async function capPrepararExportPorUsuario() {
  await capCargarSupervisores();

  /* el selector que ya existia en Registros y nunca se llenaba */
  if (_capSupEsAdmin) capPintarSelectSup(document.getElementById('filtroSupCap'), _capSupLista);

  if (!_capSupEsAdmin) return;     /* un supervisor solo exporta lo suyo */

  var ya = document.getElementById('expSupervisor');
  if (ya) { capPintarSelectSup(ya, _capSupLista); return; }

  var emp = document.getElementById('expEmpresa');
  if (!emp) return;
  var celda = (emp.closest ? emp.closest('.fg') : null) || emp.parentNode;
  if (!celda || !celda.parentNode) return;

  var nueva = document.createElement('div');
  nueva.className = 'fg';
  nueva.innerHTML = '<label class="lbl">Registrado por</label>' +
                    '<select id="expSupervisor"><option value="">Todos los supervisores</option></select>';
  celda.parentNode.insertBefore(nueva, celda.nextSibling);
  capPintarSelectSup(document.getElementById('expSupervisor'), _capSupLista);
}

window.capCargarSupervisores      = capCargarSupervisores;
window.capPrepararExportPorUsuario = capPrepararExportPorUsuario;

console.log('[_CAP_EXPORT_SUP_V1] exportar por usuario listo');
