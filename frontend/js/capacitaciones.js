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

    // Agrupar filas por idCapacitacion (acepta claves variadas del backend) — _CAP_PDF_MASIVO_V1
    const lista = _capAgruparExport(r.data, desde);

    _capPintarRegen(cont, lista);   /* _CAP_QUIEN_REGISTRO_V1 */
  } catch(e) {
    cont.innerHTML = '<div style="color:#dc2626;padding:14px;background:#fef2f2;border-radius:6px">❌ Error: ' + e.message + '</div>';
  }
}

/* _CAP_PDF_MASIVO_V1: agrupa las filas del export (una por asistente) en capacitaciones.
   Lo usan "Regenerar formato" y "Reutilizar la nomina" (para generar su PDF al toque). */
function _capAgruparExport(data, desde) {
  const grupos = {};
  data.forEach(row => {
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
        horas:             row.TOTAL_HORAS || row.HORAS || row.horas || row.totalHoras || _calcHorasDesde(_fmtHoraCap(row.HORA_INICIO||row.horaInicio||''), _fmtHoraCap(row.HORA_FIN||row.horaFin||'')),
        /* _CAP_PDF_MASIVO_V1: la hoja de asistentes guarda el nombre del capacitador en la
           columna CAPACITADOR (no CAPACITADOR_NOMBRE) -> antes salia vacio y pedia el DNI.
           El DNI llega como numero: se le devuelve el 0 inicial. FUENTE tampoco se pasaba. */
        capacitadorDni:    _capDni8(row.CAPACITADOR_DNI || row.capacitadorDni || ''),
        capacitadorNombre: row.CAPACITADOR_NOMBRE || row.CAPACITADOR || row.capacitadorNombre || '',
        capacitadorCargo:  row.CAPACITADOR_CARGO || row.capacitadorCargo || '',
        fuente:            row.FUENTE || row.fuente || '',
        fundo:             row.FUNDO || row.fundo || '',
        creadaPor:         row.CREADA_POR || row.creadaPor || '',              /* _CAP_QUIEN_REGISTRO_V1 */
        creadaPorNombre:   row.CREADA_POR_NOMBRE || row.creadaPorNombre || '',
        fechaRegistro:     row.FECHA_REGISTRO || row.fechaRegistro || '',
        labor:             row.LABOR || row.labor || '',                       /* _CAP_EDITAR_V1 */
        servicio:          row.SERVICIO || row.servicio || '',
        asistentes: []
      };
    }
    grupos[id].asistentes.push({
      dni:     _capDni8(row.DNI || row.dni || ''),   /* _CAP_PDF_MASIVO_V1 */
      nombre:  row.APELLIDOS_Y_NOMBRES || row.NOMBRE || row.nombre || row.nombres || '',
      cargo:   row.CARGO_AREA || row.CARGO || row.cargo || '',
      sexo:    row.SEXO || row.sexo || '',
      empresa: row.EMPRESA || row.empresa || ''
    });
  });

  return Object.values(grupos);
}

/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_QUIEN_REGISTRO_V1 (07-oct-2026) — reconocer los registros de cada usuario
   · "Fecha anterior": cada tarjeta dice quien la registro y cuando, y hay un
     filtro "Registrado por" (si hay mas de un usuario en el resultado).
   · Registros: columna "Registrado por" con fecha/hora, marca "📅 fecha anterior"
     y (administradores) resumen por usuario arriba de la tabla.
   Solo pantalla: los datos ya venian del servidor.
   ═══════════════════════════════════════════════════════════════════════════ */
function _capEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
/* "2026-10-07 08:45" (Lima) o ISO UTC -> "07/10/2026 8:45 a. m." */
function _capFmtRegistro(x) {
  if (!x) return '';
  let s = String(x), y, mo, d, h, mi;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{1,2}):(\d{2})/);
  if (m) { [, y, mo, d, h, mi] = m; }
  else {
    const t = Date.parse(s); if (isNaN(t)) return s;
    const L = new Date(t - 5 * 3600e3).toISOString();   /* hora de Lima */
    y = L.slice(0, 4); mo = L.slice(5, 7); d = L.slice(8, 10); h = L.slice(11, 13); mi = L.slice(14, 16);
  }
  let hh = +h; const ap = hh >= 12 ? 'p. m.' : 'a. m.'; hh = hh % 12 || 12;
  return d + '/' + mo + '/' + y + ' ' + hh + ':' + mi + ' ' + ap;
}
function _capQuien(c) { return String(c.creadaPorNombre || c.creadaPor || '').trim(); }

function _capPintarRegen(cont, todas) {
  const sel0 = document.getElementById('regenFiltroUsr');
  const elegido = sel0 ? sel0.value : '';
  const usuarios = {};
  todas.forEach(c => { const k = String(c.creadaPor || '').toLowerCase().trim(); if (k) usuarios[k] = (usuarios[k] || { n: 0, nom: _capQuien(c) }), usuarios[k].n++; });
  const claves = Object.keys(usuarios).sort((a, b) => usuarios[a].nom.localeCompare(usuarios[b].nom));
  const lista = elegido ? todas.filter(c => String(c.creadaPor || '').toLowerCase().trim() === elegido) : todas;

  let html = '';
  if (claves.length > 1) {
    html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
      '<label style="font-size:12px;color:#64748b;font-weight:600">👤 Registrado por</label>' +
      '<select id="regenFiltroUsr" style="padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px">' +
      '<option value="">Todos (' + todas.length + ')</option>' +
      claves.map(k => '<option value="' + _capEsc(k) + '"' + (k === elegido ? ' selected' : '') + '>' + _capEsc(usuarios[k].nom) + ' (' + usuarios[k].n + ')</option>').join('') +
      '</select></div>';
  }
  html += '<p style="color:#475569;margin-bottom:12px;font-size:14px">Se encontraron <b>' + lista.length + '</b> capacitación(es). Haz clic en una para regenerar el formato R-SC-01.</p>';
  lista.forEach((c, i) => {
    const quien = _capQuien(c), cuando = _capFmtRegistro(c.fechaRegistro);
    html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px;background:#f8fafc">';
    html += '<div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#0f172a">' + _capEsc(c.tema || '(sin tema)') + '</div>';
    html += '<div style="font-size:12px;color:#64748b;margin-bottom:6px;line-height:1.6">';
    html += '📅 <b>' + _capEsc(c.fecha || '—') + '</b> · 🏢 ' + _capEsc(c.empresa || '—') + ' · 📍 ' + _capEsc(c.lugar || '—');
    html += '<br>⏰ ' + _capEsc(c.horaInicio || '—') + ' a ' + _capEsc(c.horaFin || '—') + ' · 👥 <b>' + c.asistentes.length + '</b> asistentes';
    html += '</div>';
    if (quien || cuando) {
      html += '<div style="font-size:12px;color:#1e3a8a;background:#eff6ff;border:1px solid #dbeafe;border-radius:6px;padding:5px 9px;margin-bottom:10px;display:inline-block">' +
              '👤 <b>Registrado por:</b> ' + _capEsc(quien || '—') + (cuando ? ' · 🕒 ' + _capEsc(cuando) : '') + '</div><br>';
    }
    html += '<button class="btn btn-primary" data-idx="' + i + '" style="font-size:13px;padding:8px 14px">📄 Regenerar formato R-SC-01</button>';
    html += ' <button class="btn btn-gray" data-dup="' + i + '" style="font-size:13px;padding:8px 14px" ' +
            'title="Crear otro registro con estas mismas personas y otro titulo">📋 Otro título</button>';
    if (_capPuedeEditar(c)) html += ' <button class="btn btn-gray" data-edit="' + i + '" style="font-size:13px;padding:8px 14px" title="Corregir los datos de esta capacitacion">✏️ Editar datos</button>';   /* _CAP_EDITAR_V1 */
    html += '</div>';
  });
  cont.innerHTML = html;
  cont.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.onclick = () => capAbrirEditar(window._capacitacionesEncontradas[parseInt(btn.dataset.edit)], () => _ejecutarBusquedaCapacitaciones());
  });
  window._capacitacionesEncontradas = lista;
  cont.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.onclick = () => regenerarFormatoCapacitacion(window._capacitacionesEncontradas[parseInt(btn.dataset.idx)]);
  });
  cont.querySelectorAll('button[data-dup]').forEach(btn => {
    btn.onclick = () => capAbrirDuplicarRegen(parseInt(btn.dataset.dup));
  });
  const sel = document.getElementById('regenFiltroUsr');
  if (sel) sel.onchange = () => _capPintarRegen(cont, todas);
}

/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_EDITAR_V1 (07-oct-2026) — Corregir los datos de una capacitacion ya
   registrada desde "Fecha anterior". Quien la registro o un administrador.
   Solo se envian los campos que cambiaron. La nomina no se toca aqui.
   ═══════════════════════════════════════════════════════════════════════════ */
function _capPuedeEditar(c) {
  try {
    if (typeof capPareceAdmin === 'function' && capPareceAdmin()) return true;
    return String(c.creadaPor || '').toLowerCase().trim() === String((USER && USER.usuario) || '').toLowerCase().trim();
  } catch (e) { return false; }
}
var _CAP_TIPOS_ED = ['INDUCCIÓN', 'PAUTA-CHARLA', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO'];
var _CAP_CAMPOS_ED = [   /* [clave, etiqueta, tipo de input] */
  ['tema', 'Tema', 'text'], ['fuente', 'Fuente', 'text'], ['area', 'Área', 'text'], ['fundo', 'Zona (fundo)', 'text'],
  ['lugar', 'Lugar', 'text'], ['labor', 'Labor', 'text'], ['servicio', 'Servicio o contratista', 'text'],
  ['fecha', 'Fecha', 'date'], ['horaInicio', 'Hora de inicio', 'time'], ['horaFin', 'Hora de término', 'time'], ['totalHoras', 'Total horas', 'number'],
  ['capacitadorDni', 'DNI capacitador', 'text'], ['capacitadorNombre', 'Nombre capacitador', 'text'], ['capacitadorCargo', 'Cargo capacitador', 'text']
];
function capAbrirEditar(c, alTerminar) {
  if (!c) return;
  const prev = document.getElementById('modalEditCapOverlay'); if (prev) prev.remove();
  const ini = {
    tema: c.tema || '', fuente: c.fuente || '', area: c.area || '', fundo: c.fundo || '', lugar: c.lugar || '',
    labor: c.labor || '', servicio: c.servicio || '', fecha: String(c.fecha || '').substring(0, 10),
    horaInicio: c.horaInicio || '', horaFin: c.horaFin || '', totalHoras: c.horas === '' || c.horas == null ? '' : String(c.horas),
    capacitadorDni: c.capacitadorDni || '', capacitadorNombre: c.capacitadorNombre || '', capacitadorCargo: c.capacitadorCargo || '',
    tipo: String(c.tipo || '')
  };
  const tiposIni = ini.tipo.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const d = document.createElement('div');
  d.id = 'modalEditCapOverlay';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:10060;padding:16px';
  d.innerHTML =
    '<div style="background:#fff;border-radius:12px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px">' +
      '<h3 style="margin:0 0 4px">✏️ Corregir capacitación</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:12px">' + _capEsc(c.empresa || '') + ' · ' + c.asistentes.length + ' asistentes · ID ' + _capEsc(c.id) +
        '<br>Los cambios quedan en el historial (quién, cuándo y qué cambió).</div>' +
      '<div style="margin-bottom:10px"><label style="display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px">Tipo de actividad</label>' +
        _CAP_TIPOS_ED.map(t => '<label style="display:inline-flex;gap:5px;align-items:center;margin:0 12px 4px 0;font-size:13px"><input type="checkbox" class="edTipo" value="' + t + '"' + (tiposIni.indexOf(t) >= 0 ? ' checked' : '') + '> ' + t + '</label>').join('') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">' +
        _CAP_CAMPOS_ED.map(f => '<div' + (f[0] === 'tema' || f[0] === 'fuente' ? ' style="grid-column:1/-1"' : '') + '><label style="display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:3px">' + f[1] + '</label>' +
          '<input id="ed_' + f[0] + '" type="' + f[2] + '"' + (f[2] === 'number' ? ' step="0.5" min="0"' : '') + ' value="' + _capEsc(ini[f[0]]) + '" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px"></div>').join('') +
      '</div>' +
      '<div id="edAlerta" style="margin-top:12px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
        '<button class="btn btn-gray btn-sm" id="edCancelar">Cancelar</button>' +
        '<button class="btn btn-primary btn-sm" id="edGuardar">💾 Guardar cambios</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
  const al = document.getElementById('edAlerta');
  const aviso = (m, ok) => { al.innerHTML = '<div style="background:' + (ok ? '#dcfce7' : '#fef2f2') + ';border:1.5px solid ' + (ok ? '#86efac' : '#fecaca') + ';color:' + (ok ? '#166534' : '#dc2626') + ';border-radius:8px;padding:8px 11px;font-size:12.5px">' + m + '</div>'; };
  document.getElementById('edCancelar').onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  document.getElementById('edGuardar').onclick = async () => {
    const cambios = {};
    _CAP_CAMPOS_ED.forEach(f => {
      const val = String((document.getElementById('ed_' + f[0]) || {}).value || '').trim();
      if (val !== String(ini[f[0]] || '').trim()) cambios[f[0]] = val;
    });
    const tipos = [...d.querySelectorAll('.edTipo:checked')].map(x => x.value);
    if (!tipos.length) { aviso('Marca al menos un tipo de actividad.'); return; }
    const tipoTxt = tipos.join(', ');
    if (tipoTxt.toUpperCase() !== tiposIni.join(', ')) cambios.tipo = tipoTxt;
    if (cambios.tema === '') { aviso('El tema no puede quedar vacío.'); return; }
    if (cambios.fecha === '') { aviso('La fecha no puede quedar vacía.'); return; }
    if (!Object.keys(cambios).length) { aviso('No cambiaste ningún dato.'); return; }
    const btn = document.getElementById('edGuardar'); btn.disabled = true; btn.textContent = 'Guardando...';
    try {
      const r = await apiPost({ action: 'editarCapacitacion', idCapacitacion: c.id, cambios: cambios, usuario: USER.usuario, rol: USER.rol });
      if (!r || !r.success) { aviso((r && r.error) || 'No se pudo guardar'); btn.disabled = false; btn.textContent = '💾 Guardar cambios'; return; }
      aviso('✔ Cambios guardados (' + Object.keys(cambios).length + ' dato(s)).', true);
      setTimeout(() => { d.remove(); if (typeof mostrarFeedback === 'function') mostrarFeedback('ok', '✅ Capacitación corregida. Si necesitas el PDF, usa "Regenerar formato".'); if (typeof alTerminar === 'function') alTerminar(); }, 800);
    } catch (e) {
      aviso('Error de conexión: ' + e.message); btn.disabled = false; btn.textContent = '💾 Guardar cambios';
    }
  };
}
window.capAbrirEditar = capAbrirEditar;

/* _CAP_PDF_MASIVO_V1: Azure/Sheets guardan el DNI como numero (46073509 ok, 01234567 -> 1234567) */
function _capDni8(d) {
  const s = String(d == null ? '' : d).trim().replace(/\.0+$/, '');
  return /^\d{7}$/.test(s) ? '0' + s : s;
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
  /* _CAP_PDF_MASIVO_V1: solo se pide si falta el NOMBRE (antes, si faltaba el DNI,
     aparecia el aviso; si lo cancelaban, no se generaba el documento) */
  if (!capNombre) {
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
    fuente:      v('capFuente'),   /* _CAP_PDF_MASIVO_V1 */
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
    sv('capFuente',      cap.fuente || '');   /* _CAP_PDF_MASIVO_V1: antes salia la FUENTE de otra capacitacion */
    sv('capLugar',       cap.lugar);
    sv('capArea', cap.area);
    sv('capFundo', cap.fundo || '');   /* _FUNDO_CAP_V1 · _CAP_PDF_MASIVO_V1: si no tiene, en blanco (no el de otra) */
    sv('capLabor', cap.labor || ''); sv('capServicio', cap.servicio || '');   /* _CAP_EDITAR_V1: ahora se guardan (los registros antiguos salen en blanco) */
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

    return await generarPDFsFormatos();   /* _CAP_PDF_MASIVO_V1: devuelve si se genero */
  } finally {
    // Restaurar TODO al estado original
    sv('capEmpresa',     backup.empresa);
    sv('capFecha',       backup.fecha);
    sv('capTema',        backup.tema);
    sv('capFuente',      backup.fuente);   /* _CAP_PDF_MASIVO_V1 */
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
    const ok2 = await generarPDFsFormatos();
    if (ok2 && btn) { btn.disabled = true; btn.innerHTML = '✅ Guardado y PDF generado — usa "Nueva"'; }   /* _CAP_PDF_MASIVO_V1 */
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
  const pdfOk = await generarPDFsFormatos();               // 2) genera PDF(s)
  /* _CAP_PDF_MASIVO_V1 (06-oct): antes el boton quedaba bloqueado con "PDF generado"
     aunque el PDF NO se hubiera generado (falta responsable, error, descarga bloqueada).
     Ahora, si falla, el boton queda activo para volver a generar SIN volver a guardar. */
  if (btn) {
    if (pdfOk) { btn.disabled = true; btn.innerHTML = '✅ Guardado y PDF generado — usa "Nueva"'; }
    else       { btn.disabled = false; btn.innerHTML = '📄 Ya guardado — Generar PDF R-SC-01'; }
  }
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
    labor:             v('capLabor').trim(),      /* _CAP_EDITAR_V1: ahora se guardan */
    servicio:          v('capServicio').trim(),
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
    return false;
  }
  const n = asistentes.length;
  if (n === 0) { mostrarFeedback('err', '❌ No hay asistentes registrados'); return false; }

  const totalFormatos = Math.ceil(n / FILAS_POR_FORMATO);

  /* _CAP_PDF_MASIVO_V1 (06-oct-2026): con 12 personas por hoja, un registro masivo
     (ej. 60 personas = 5 formatos) hacia 5 descargas seguidas. El navegador (sobre todo
     en celular) bloquea la 2da descarga en adelante y "no se generaba el documento".
     Ahora TODOS los formatos van en UN SOLO PDF (una hoja por formato) = una descarga. */
  const btn = document.getElementById('btnPDF') || {};
  btn.disabled = true;
  try {
    let doc = null;
    for (let i = 0; i < totalFormatos; i++) {
      const inicio = i * FILAS_POR_FORMATO;
      const fin    = Math.min(inicio + FILAS_POR_FORMATO, n);
      const chunk  = asistentes.slice(inicio, fin);
      btn.innerHTML = totalFormatos > 1
        ? `<span class="spin"></span> Formato ${i + 1}/${totalFormatos}...`
        : '<span class="spin"></span> Generando PDF...';
      doc = await generarPDF(chunk, '', doc, inicio);
    }
    const label = totalFormatos > 1 ? `${totalFormatos}_formatos` : '';
    _guardarPdfCap(doc, label);
    mostrarFeedback('ok', totalFormatos > 1
      ? `✅ PDF generado: ${totalFormatos} formatos R-SC-01 en un solo archivo (${n} asistentes)`
      : `✅ PDF generado correctamente`);
    return true;
  } catch(e) {
    console.error('[_CAP_PDF_MASIVO_V1] Error al generar PDF:', e);
    mostrarFeedback('err', '❌ Error al generar PDF: ' + e.message);
    return false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '📄 Generar PDF R-SC-01';
  }
}

/* _CAP_PDF_MASIVO_V1: guarda el PDF ya armado (una sola descarga) */
function _guardarPdfCap(doc, label) {
  const empresa = v('capEmpresa');
  const fmtSuffix = label ? `_${String(label).replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const fname = `R-SC-01_${empresa}_${v('capFecha')}${fmtSuffix}_${v('capTema').trim().substring(0, 20).replace(/[\s/\\:*?"<>|]+/g, '-')}.pdf`;
  doc.save(fname);
}

/* _CAP_PDF_MASIVO_V1: H / M con todas las formas en que llega el sexo (M, H, MASCULINO, F, MUJER...) */
function _capEsHombre(s) { const x = String(s || '').trim().toUpperCase(); return x === 'M' || x === 'H' || x === 'MASC' || x === 'MASCULINO' || x === 'HOMBRE'; }
function _capEsMujer(s)  { const x = String(s || '').trim().toUpperCase(); return x === 'F' || x === 'MUJ' || x === 'FEM' || x === 'FEMENINO' || x === 'MUJER'; }

async function generarPDF(asistentesOverride = null, formatoLabel = '', docExistente = null) {
  // Sólo se llama desde generarPDFsFormatos (validaciones ya hechas)
  /* _CAP_PDF_MASIVO_V1: si llega docExistente, el formato se agrega como hoja nueva
     del mismo PDF y NO se descarga aqui (lo descarga generarPDFsFormatos una sola vez). */
  const empresa = v('capEmpresa');
  const respDni    = v('capRespDni').trim();
  const respNombre = v('capRespNombre').trim();
  const respCargo  = v('capRespCargo').trim();

  let partList = [...(asistentesOverride || asistentes)];
  while (partList.length < FILAS_POR_FORMATO) partList.push({ dni: '', nombre: '', cargo: '', obs: '' });

  try {
    const { jsPDF } = window.jspdf;
    // A4 VERTICAL — UNA SOLA HOJA (210 × 297 mm)
    let doc;
    if (docExistente) { doc = docExistente; doc.addPage('a4', 'portrait'); }   /* _CAP_PDF_MASIVO_V1 */
    else doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
    const nH        = asistentes.filter(a => _capEsHombre(a.sexo)).length;   /* _CAP_PDF_MASIVO_V1: antes solo contaba 'M' / 'F' exactos */
    const nM        = asistentes.filter(a => _capEsMujer(a.sexo)).length;
    const logoB64   = (await _getLogoBase64()) || _LOGO_UNIFRUTTI_B64_;   /* _RSC01_LOGO_FREC_V1: si la imagen no carga, usa el logo embebido */

    // ── Estilos reutilizables ──
    const sBorder  = { lineColor: C.negro, lineWidth: 0.3 };
    const sBanner  = { fillColor: C.banner, textColor: C.negro, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10, minCellHeight: 6, cellPadding: 1 };
    const sCabHead = { fillColor: [255, 255, 255], textColor: C.negro, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8.5, minCellHeight: 6 };   /* _RSC01_IDENTICO_V1: encabezados de tabla en blanco, como el oficial */

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
    /* _RSC01_IDENTICO_V1 (07-oct-2026): como el formato oficial -> "Frecuencia:" en blanco con su linea debajo */
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.negro);
    const _yFrec = yFila2 + 3;
    doc.text('Frecuencia:', MGS + COL1 + COL2 + 1, _yFrec);
    doc.setDrawColor(...C.negro); doc.setLineWidth(0.2);
    doc.line(MGS + COL1 + COL2 + 1, _yFrec + 3.2, MGS + bW - 1, _yFrec + 3.2);

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
    /* _RSC01_IDENTICO_V1 (07-oct-2026): igual al formato oficial (imagen de Joel):
       TEMA/FUENTE en letra grande, casillas con X negra, filas compactas separadas por
       lineas completas (sin subrayado por dato), fecha dd/mm/aaaa, hora "8:00 A.M",
       duracion "02 HORAS", razon social sin punto final y ZONA en rojo. */
    const _fFecha = f => { const p = String(f || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(f || ''); };
    const _fHora = h => {
      const m = String(h || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return String(h || '');
      let hh = +m[1]; const ap = hh >= 12 ? 'P.M' : 'A.M'; hh = hh % 12 || 12;
      return hh + ':' + m[2] + ' ' + ap;
    };
    const _fDur = x => {
      const n = parseFloat(String(x || '').replace(',', '.')); if (!n || isNaN(n)) return String(x || '');
      const h = Math.floor(n), mi = Math.round((n - h) * 60), p2 = k => (k < 10 ? '0' : '') + k;
      if (!mi) return p2(h) + (h === 1 ? ' HORA' : ' HORAS');
      return p2(h) + ':' + p2(mi) + ' HORAS';
    };
    const _L = (text, x, yd, fs) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(fs || 7.5); doc.setTextColor(...C.negro); doc.text(text, x, yd); return x + doc.getTextWidth(text) + 1.5; };
    const _V = (text, x, yd, fs, maxW, color) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fs || 8); doc.setTextColor(...(color || C.negro));
      let t = String(text || '');
      if (maxW) { let f = fs || 8; while (f > 5.5 && doc.getTextWidth(t) > maxW) { f -= 0.5; doc.setFontSize(f); } t = doc.splitTextToSize(t, maxW)[0] || ''; }
      doc.text(t, x, yd); doc.setTextColor(...C.negro);
    };
    const _H = (yl) => { doc.setDrawColor(...C.negro); doc.setLineWidth(0.25); doc.line(MGS, yl, MGS + bW, yl); };
    const XC2 = MGS + 72, XC3 = MGS + 112;          // columnas 2 y 3 (FECHA / LUGAR ...)
    const FIN_LINEA = MGS + bW - 15;                // TEMA y FUENTE: la linea no llega al borde

    // TEMA
    yA += 6;
    let _x = _L('TEMA:', MGS + 1, yA, 8.5);
    _V(v('capTema').trim(), _x + 1, yA, 11, FIN_LINEA - _x - 2);
    _sub(_x, yA + 1.3, FIN_LINEA);
    yA += 6.5;

    // FUENTE
    _x = _L('FUENTE:', MGS + 1, yA, 6.5);
    _V(v('capFuente').trim(), _x + 1, yA, 10, FIN_LINEA - _x - 2);
    _sub(_x, yA + 1.3, FIN_LINEA);
    yA += 4;

    // CASILLAS: etiqueta normal + recuadro, X negra
    const tiposPDF = ['INDUCCIÓN', 'PAUTA/CHARLA', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO'];
    const tiposSel = tipos.map(t => String(t).replace(/-/g, '/'));
    const COLX = [MGS + 0.5, MGS + 34, MGS + 70, MGS + 113, MGS + 153];
    tiposPDF.forEach((t, i) => {
      const gx = COLX[i];
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.negro);
      doc.text(t, gx, yA + 4.8);
      const bx = gx + doc.getTextWidth(t) + 2, by = yA;
      doc.setDrawColor(...C.negro); doc.setLineWidth(0.5);
      doc.rect(bx, by, 10, 6.8);
      if (tiposSel.includes(t)) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.negro);
        doc.text('X', bx + 5, by + 4.7, { align: 'center' });
      }
    });
    yA += 13;

    // ÁREA + N° TRABAJADORES + H / M (sin subrayado, como el oficial)
    const nTrabV = String(asistentes.length);
    const nHv    = String(nH);
    const nMv    = String(nM);
    _x = _L('ÁREA:', MGS + 1, yA, 7.5);
    _V(v('capArea').trim(), _x + 1, yA, 9, XC3 - _x - 4);
    _x = _L('N° TRABAJADORES:', XC3, yA, 7);
    _V(nTrabV, _x + 1, yA, 8);
    _x = _L('H:', MGS + 161, yA, 7);  _V(nHv, _x + 0.5, yA, 8);
    _x = _L('M:', MGS + 175, yA, 7);  _V(nMv, _x + 0.5, yA, 8);
    yA += 2.2; _H(yA);

    // LABOR + FECHA + LUGAR
    yA += 4;
    _x = _L('LABOR:', MGS + 1, yA, 7.5);   _V(v('capLabor').trim(), _x, yA, 7.5, XC2 - _x - 2);
    _x = _L('FECHA:', XC2, yA, 7.5);       _V(_fFecha(v('capFecha')), _x, yA, 7.5);
    _x = _L('LUGAR:', XC3, yA, 7.5);       _V(v('capLugar').trim(), _x, yA, 8.5, MGS + bW - _x - 1);
    yA += 2.2; _H(yA);

    // HORA DE INICIO + HORA DE TÉRMINO + DURACIÓN
    yA += 4;
    _x = _L('HORA DE INICIO:', MGS + 1, yA, 7);     _V(_fHora(v('capHoraInicio')), _x, yA, 7.5);
    _x = _L('HORA DE TÉRMINO:', XC2, yA, 7);        _V(_fHora(v('capHoraTermino')), _x, yA, 7.5, XC3 - _x - 2);
    _x = _L('DURACIÓN:', XC3, yA, 7.5);             _V(_fDur(v('capHoras')), _x, yA, 8);
    yA += 2.2; _H(yA);

    // RAZÓN SOCIAL + ZONA (en rojo) + SERVICIO O CONTRATISTA
    yA += 4;
    const prodV = (v('capProductor') || (esRapel ? 'Sociedad Agrícola Rapel S.A.C' : 'Sociedad Exportadora Verfrut S.A.C')).replace(/\.\s*$/, '');
    _x = _L('RAZÓN SOCIAL:', MGS + 1, yA, 7.5);   _V(prodV, _x, yA, 8, XC2 - _x - 2);
    _x = _L('ZONA:', XC2, yA, 7.5);               _V(v('capFundo').trim(), _x, yA, 8.5, XC3 - _x - 2, C.rojo);
    _x = _L('SERVICIO O CONTRATISTA:', XC3, yA, 6.5);
    _V(v('capServicio').trim() || '_', _x, yA, 8, MGS + bW - _x - 1);
    yA += 2.5;

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
      head: [['N°', 'DNI', 'APELLIDOS Y NOMBRES', 'CARGO/INSTITUCIÓN', 'FIRMA']],   /* _RSC01_IDENTICO_V1 */
      body: [['1', v('capCapDni').trim(), v('capCapNombre').trim(), v('capCapCargo').trim(), '']],
      theme: 'grid',
      headStyles: { ...sCabHead },
      styles: { ...sBorder, cellPadding: 1, textColor: C.negro },
      bodyStyles: { fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 8 },   /* _RSC01_IDENTICO_V1: el cargo entra en una linea */
      columnStyles: { 0:{cellWidth:9.6}, 1:{cellWidth:20.9}, 2:{cellWidth:71.5}, 3:{cellWidth:59.2}, 4:{cellWidth:28.8} }   /* _RSC01_IDENTICO_V1: anchos del oficial (suma 190) */
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
        /* _RSC01_IDENTICO_V1: anchos del formato oficial: 9.6+20.9+71.5+32.7+26.6+28.7 = 190 mm */
        0: { cellWidth: 9.6 }, 1: { cellWidth: 20.9 },
        2: { cellWidth: 71.5, halign: 'left' }, 3: { cellWidth: 32.7, halign: 'left' },   /* _FIRMA_HUELLA_V4: nombres 70->62, cargo 32->30 */
        4: { cellWidth: 26.6 }, 5: { cellWidth: 28.7, halign: 'left' }   /* _FIRMA_HUELLA_V4: FIRMA/HUELLA 40->50 mm. Suma: 8+20+62+30+50+20 = 190 mm = ancho util A4 */
      },
      didParseCell: d => {
        if (d.section === 'head' && d.column.index === 5) { d.cell.styles.fontSize = 8; d.cell.styles.cellPadding = 0.3; }   /* _RSC01_IDENTICO_V1: ahora la columna es ancha como el oficial */   /* _FORMATO_RSC01_2026_V1: "OBSERVACIONES" cabe en 20 mm */
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
      bodyStyles: { fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 8 },   /* _RSC01_IDENTICO_V1: el cargo entra en una linea */
      columnStyles: { 0:{cellWidth:9.6}, 1:{cellWidth:20.9}, 2:{cellWidth:71.5}, 3:{cellWidth:59.2}, 4:{cellWidth:28.8} }   /* _RSC01_IDENTICO_V1: anchos del oficial (suma 190) */
    });

    // ── _FIX_RESPONSABLE_PAG1_V1: NO borrar páginas extra ──
    // El antiguo while(deletePage) borraba la fila del responsable cuando se
    // desbordaba. Con los tamaños reducidos arriba debería caber siempre en 1
    // página, pero si por algún caso edge se desborda, mejor 2 páginas que
    // un PDF roto sin responsable.

    // ── Footer eliminado: el formato oficial R-SC-01 no lleva pie de página ──

    return doc;   /* _CAP_PDF_MASIVO_V1: la descarga la hace generarPDFsFormatos (una sola vez) */
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
/* _CAP_REG_V2 (03-oct-2026) — Registros por rango de fechas.
   · Al abrir carga SOLO el mes actual (antes traia todo el historial: lento).
   · "Buscar" pide a Azure el rango y la empresa elegidos (Google de respaldo).
   · "Registrado por" (solo admin) y "Capacitador" filtran al instante lo ya cargado.
   · Indicadores y graficos se calculan sobre lo filtrado, para todos los usuarios.
     Ya no se llama a estadisticasCapacitaciones (una consulta menos). */
let _cregDatos = [];          // lo que devolvio el servidor para el rango
let _cregEsAdmin = false;
const _cregCharts = {};

function _cregNum(x) { const n = parseFloat(String(x == null ? '' : x).replace(',', '.')); return isNaN(n) ? 0 : n; }
function _cregFecha(r) { return String(r.fecha || r.fechaCapacitacion || '').substring(0, 10); }
/* _CAP_REG_POR_REGISTRO_V1: dia (Lima) en que se registro: viene como ISO UTC (Azure/Google) o "aaaa-mm-dd hh:mm" de Lima */
function _cregFechaReg(r) {
  const x = r && r.fechaRegistro; if (!x) return '';
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}[ ]\d/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s.substring(0, 10);   /* ya es hora de Lima */
  const t = Date.parse(s); if (isNaN(t)) return s.substring(0, 10);
  return new Date(t - 5 * 3600e3).toISOString().substring(0, 10);
}
function _cregFmt(n, dec) { return Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: dec || 0, minimumFractionDigits: 0 }); }
function _cregDdmm(f) { const p = String(f || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (f || ''); }
function _cregEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function _cregRangoInicial() {
  const hoy = _hoyLimaCap(new Date());
  if (!v('cregDesde')) sv('cregDesde', hoy.slice(0, 8) + '01');
  if (!v('cregHasta')) sv('cregHasta', hoy);
}

function cregRapido(que) {
  const hoy = _hoyLimaCap(new Date());
  if (que === 'mes') { sv('cregDesde', hoy.slice(0, 8) + '01'); sv('cregHasta', hoy); }
  else {
    const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1;            // mes anterior
    const yy = m === 0 ? y - 1 : y, mm = m === 0 ? 12 : m;
    const ult = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const p = String(mm).padStart(2, '0');
    sv('cregDesde', yy + '-' + p + '-01'); sv('cregHasta', yy + '-' + p + '-' + String(ult).padStart(2, '0'));
  }
  cargarRegistros();
}

async function cargarRegistros() {
  const wrap = document.getElementById('tbRegistrosWrap');
  if (!wrap || !USER) return;
  _cregRangoInicial();
  const desde = v('cregDesde'), hasta = v('cregHasta');
  if (desde && hasta && desde > hasta) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>La fecha "Desde" no puede ser mayor que "Hasta"</div>'; return; }
  wrap.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div>Cargando registros...</div>';
  const kp = document.getElementById('cregKpis'); if (kp) kp.style.opacity = '.5';
  try {
    const t0 = Date.now();
    /* _CAP_REG_POR_REGISTRO_V1 (07-oct-2026): "Buscar por fecha de registro". Antes solo se
       filtraba por la fecha DE LA CAPACITACION: lo registrado hoy con fecha 30/09 no salia en
       "Este mes" y parecia que no se habia guardado. Por registro: se traen las cabeceras sin
       rango (son pocas filas) y se filtra aqui por el dia en que se registro (hora de Lima). */
    const porReg = v('cregPor') === 'reg';
    const d = await apiPost({
      action: 'listarCapacitaciones', rol: USER.rol, usuario: USER.usuario,
      empresa: v('cregEmpresa') || '', desde: porReg ? '' : desde, hasta: porReg ? '' : hasta, supervisor: ''
    });
    if (!d.success) throw new Error(d.error || 'Error servidor');
    let _lst = (d.capacitaciones || []).slice();
    if (porReg) _lst = _lst.filter(r => { const f = _cregFechaReg(r); return f && (!desde || f >= desde) && (!hasta || f <= hasta); });
    _cregDatos = _lst.sort((a, b) => porReg ? String(b.fechaRegistro || '').localeCompare(String(a.fechaRegistro || ''))
                                            : _cregFecha(b).localeCompare(_cregFecha(a)));
    _cregEsAdmin = !!d.esAdmin;
    console.log('[_CAP_REG_V2] ' + _cregDatos.length + ' capacitaciones (' + desde + ' a ' + hasta + ') en ' + (Date.now() - t0) + ' ms · fuente ' + (d.fuente || 'google'));
    const rg = document.getElementById('cregRango');
    if (rg) rg.textContent = (porReg ? 'Registrados del ' : '') + _cregDdmm(desde) + ' — ' + _cregDdmm(hasta);   /* _CAP_REG_POR_REGISTRO_V1 */
    _cregLlenarFiltros();
    cregAplicar();
  } catch (e) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">❌</div>Error: ${_cregEsc(e.message)}</div>`;
  } finally { if (kp) kp.style.opacity = ''; }
}

/* Opciones de los filtros = lo que hay en el rango cargado (se conserva lo elegido) */
function _cregLlenarFiltros() {
  const pinta = (id, pares, txtTodos) => {
    const sel = document.getElementById(id); if (!sel) return;
    const actual = sel.value;
    sel.innerHTML = '<option value="">' + txtTodos + '</option>' +
      pares.map(p => `<option value="${_cregEsc(p[0])}">${_cregEsc(p[1])}</option>`).join('');
    if (pares.some(p => p[0] === actual)) sel.value = actual;
  };
  const sup = {}, cap = {};
  _cregDatos.forEach(r => {
    const u = String(r.creadaPor || '').toLowerCase().trim(); if (u && !sup[u]) sup[u] = r.creadaPorNombre || r.creadaPor;
    const c = String(r.capacitadorNombre || '').trim(); if (c) cap[c.toUpperCase()] = c;
  });
  const sw = document.getElementById('cregSupWrap'); if (sw) sw.style.display = _cregEsAdmin ? '' : 'none';
  pinta('cregSup', Object.keys(sup).map(u => [u, sup[u]]).sort((a, b) => String(a[1]).localeCompare(String(b[1]))), 'Todos');
  pinta('cregCap', Object.keys(cap).sort().map(k => [k, cap[k]]), 'Todos');
}

function _cregFiltrados() {
  const sup = v('cregSup'), cap = v('cregCap');
  return _cregDatos.filter(r =>
    (!sup || String(r.creadaPor || '').toLowerCase().trim() === sup) &&
    (!cap || String(r.capacitadorNombre || '').trim().toUpperCase() === cap));
}

/* _CAP_QUIEN_REGISTRO_V1: registrada DESPUES de la fecha de la capacitacion */
function _cregRetro(r) { const fc = _cregFecha(r), fr = _cregFechaReg(r); return !!(fc && fr && fr > fc); }
/* _CAP_QUIEN_REGISTRO_V1: resumen por usuario (administradores); un clic filtra */
function _cregChips() {
  const tb = document.getElementById('tbRegistrosWrap'); if (!tb || !tb.parentNode) return;
  let el = document.getElementById('cregChips');
  if (!_cregEsAdmin) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'cregChips'; el.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 10px'; tb.parentNode.insertBefore(el, tb); }
  const cap = v('cregCap'), sup = v('cregSup'), cnt = {};
  _cregDatos.filter(r => !cap || String(r.capacitadorNombre || '').trim().toUpperCase() === cap).forEach(r => {
    const k = String(r.creadaPor || '').toLowerCase().trim(); if (!k) return;
    cnt[k] = cnt[k] || { nom: r.creadaPorNombre || r.creadaPor, n: 0, p: 0 }; cnt[k].n++; cnt[k].p += _cregNum(r.totalAsistentes);
  });
  const ks = Object.keys(cnt).sort((a, b) => cnt[b].n - cnt[a].n);
  if (ks.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = '<span style="font-size:12px;color:#64748b;font-weight:600">👤 Por usuario:</span>' + ks.map(k =>
    '<button type="button" data-u="' + _cregEsc(k) + '" title="' + cnt[k].p + ' personas" style="cursor:pointer;font-size:12px;border-radius:14px;padding:3px 10px;border:1px solid ' +
    (sup === k ? '#1d4ed8;background:#1d4ed8;color:#fff' : '#cbd5e1;background:#fff;color:#334155') + '">' + _cregEsc(cnt[k].nom) + ' <b>' + cnt[k].n + '</b></button>').join('') +
    (sup ? ' <button type="button" data-u="" style="cursor:pointer;font-size:11.5px;border:0;background:none;color:#1d4ed8;text-decoration:underline">ver todos</button>' : '');
  el.querySelectorAll('button[data-u]').forEach(b => { b.onclick = () => { const u = b.getAttribute('data-u'); sv('cregSup', u === sup ? '' : u); cregAplicar(); }; });
}

function cregAplicar() {
  try { _cregChips(); } catch (e) {}
  const lista = _cregFiltrados();
  window._capRegistros = lista;          /* _CAP_DUPLICAR_V1: "Reutilizar" usa esta lista */
  _cregKpis(lista);
  _cregGraficos(lista);
  _cregTabla(lista);
}

function _cregKpis(lista) {
  const el = document.getElementById('cregKpis'); if (!el) return;
  let asis = 0, hom = 0, muj = 0, horas = 0, hh = 0;
  const sups = new Set(), caps = new Set(), dias = new Set();
  lista.forEach(r => {
    const a = _cregNum(r.totalAsistentes), t = _cregNum(r.totalHoras);
    asis += a; hom += _cregNum(r.hombres); muj += _cregNum(r.mujeres); horas += t; hh += a * t;
    if (r.creadaPor) sups.add(String(r.creadaPor).toLowerCase().trim());
    if (r.capacitadorNombre) caps.add(String(r.capacitadorNombre).trim().toUpperCase());
    dias.add(_cregFecha(r));
  });
  const n = lista.length, prom = n ? asis / n : 0;
  const pctM = (hom + muj) ? Math.round(muj * 100 / (hom + muj)) : 0;
  const tarjeta = (lbl, val, sub, ico, color, fondo) =>
    `<div class="creg-kpi" style="--k:${color};--kb:${fondo}"><div class="k-top"><span class="k-lbl">${lbl}</span><span class="k-ico">${ico}</span></div>` +
    `<div class="k-val">${val}</div><div class="k-sub">${sub}</div></div>`;
  el.innerHTML =
    tarjeta('Capacitaciones', _cregFmt(n), _cregFmt(dias.size) + ' día(s) con actividad', '📚', '#0a2463', '#e8edf8') +
    tarjeta('Personas capacitadas', _cregFmt(asis), 'H ' + _cregFmt(hom) + ' · M ' + _cregFmt(muj) + (hom + muj ? ' (' + pctM + '% mujeres)' : ''), '👥', '#D91F26', '#fdecec') +
    tarjeta('Horas-hombre', _cregFmt(hh, 1), _cregFmt(horas, 1) + ' h dictadas', '⏱️', '#0f766e', '#e6f4f2') +
    tarjeta('Promedio por sesión', _cregFmt(prom, 1), 'personas por capacitación', '📈', '#b45309', '#fdf3e4') +
    tarjeta(_cregEsAdmin ? 'Supervisores activos' : 'Capacitadores', _cregFmt(_cregEsAdmin ? sups.size : caps.size),
            _cregEsAdmin ? _cregFmt(caps.size) + ' capacitador(es) distintos' : 'personas que dictaron', '🧑‍🏫', '#6d28d9', '#f1ebfd');
}

function _cregChart(id, cfg) {
  if (_cregCharts[id]) { try { _cregCharts[id].destroy(); } catch (e) {} }
  const c = document.getElementById(id);
  if (!c || !window.Chart) return;
  _cregCharts[id] = new Chart(c.getContext('2d'), cfg);
}

function _cregGraficos(lista) {
  const box = document.getElementById('cregGraficos');
  if (!box) return;
  if (!lista.length || !window.Chart) { box.style.display = 'none'; return; }
  box.style.display = '';
  const AZ = '#0a2463', RO = '#D91F26', PAL = ['#0a2463', '#D91F26', '#0f766e', '#b45309', '#6d28d9', '#0284c7', '#be185d', '#4d7c0f'];
  Chart.defaults.font.family = "'Barlow', sans-serif"; Chart.defaults.color = '#475569';
  const grid = { color: 'rgba(148,163,184,.18)' }, sinGrid = { display: false };

  /* Evolucion: por dia si el rango es corto, por mes si es largo */
  const desde = v('cregDesde'), hasta = v('cregHasta');
  const diasRango = (Date.parse(hasta) - Date.parse(desde)) / 864e5;
  const porMes = !(diasRango <= 62);
  const llave = r => porMes ? _cregFecha(r).slice(0, 7) : _cregFecha(r);
  const ev = {};
  if (!porMes && desde && hasta) { for (let t = Date.parse(desde); t <= Date.parse(hasta); t += 864e5) ev[new Date(t).toISOString().slice(0, 10)] = { c: 0, a: 0 }; }
  lista.forEach(r => { const k = llave(r); if (!ev[k]) ev[k] = { c: 0, a: 0 }; ev[k].c++; ev[k].a += _cregNum(r.totalAsistentes); });
  const ks = Object.keys(ev).sort();
  const lbl = document.getElementById('cregEvoLbl'); if (lbl) lbl.textContent = porMes ? '· por mes' : '· por día';
  _cregChart('cregChEvo', {
    data: { labels: ks.map(k => porMes ? k.slice(5, 7) + '/' + k.slice(0, 4) : k.slice(8, 10) + '/' + k.slice(5, 7)),
      datasets: [
        { type: 'bar', label: 'Capacitaciones', data: ks.map(k => ev[k].c), backgroundColor: 'rgba(10,36,99,.85)', borderRadius: 4, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Personas capacitadas', data: ks.map(k => ev[k].a), borderColor: RO, backgroundColor: RO, pointRadius: 2.5, tension: .3, cubicInterpolationMode: 'monotone', yAxisID: 'y1', order: 1 }
      ] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, usePointStyle: true } } },
      scales: { x: { grid: sinGrid }, y: { beginAtZero: true, grid: grid, ticks: { precision: 0 }, title: { display: true, text: 'Capacitaciones' } },
                y1: { beginAtZero: true, position: 'right', grid: sinGrid, ticks: { precision: 0 }, title: { display: true, text: 'Personas' } } } }
  });

  /* Por tipo (una capacitacion puede tener varios tipos) */
  const tipos = {};
  lista.forEach(r => String(r.tipo || 'SIN TIPO').split(',').map(t => t.trim()).filter(Boolean).forEach(t => { tipos[t] = (tipos[t] || 0) + 1; }));
  const tk = Object.keys(tipos).sort((a, b) => tipos[b] - tipos[a]);
  const dona = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, padding: 10 } } } };
  _cregChart('cregChTipo', { type: 'doughnut', data: { labels: tk, datasets: [{ data: tk.map(t => tipos[t]), backgroundColor: PAL, borderWidth: 2, borderColor: '#fff' }] }, options: dona });

  /* Por empresa (personas capacitadas) */
  const emp = { RAPEL: 0, VERFRUT: 0 };
  lista.forEach(r => { const e = String(r.empresa || '').toUpperCase(); const k = e.indexOf('RAPEL') >= 0 ? 'RAPEL' : 'VERFRUT'; emp[k] += _cregNum(r.totalAsistentes); });
  _cregChart('cregChEmp', { type: 'doughnut', data: { labels: ['RAPEL', 'VERFRUT'], datasets: [{ data: [emp.RAPEL, emp.VERFRUT], backgroundColor: [RO, AZ], borderWidth: 2, borderColor: '#fff' }] }, options: dona });

  /* Supervisores (solo admin, si hay mas de uno) */
  const bs = document.getElementById('cregBoxSup');
  const sup = {};
  lista.forEach(r => { const u = r.creadaPorNombre || r.creadaPor || '—'; if (!sup[u]) sup[u] = { a: 0, c: 0 }; sup[u].a += _cregNum(r.totalAsistentes); sup[u].c++; });
  const sk = Object.keys(sup).sort((a, b) => sup[b].a - sup[a].a).slice(0, 10);
  const verSup = _cregEsAdmin && sk.length > 1;
  if (bs) bs.style.display = verSup ? '' : 'none';
  box.classList.toggle('sin-sup', !verSup);
  const barras = { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, grid: grid, ticks: { precision: 0 } }, y: { grid: sinGrid, ticks: { autoSkip: false, font: { size: 11 } } } } };
  if (verSup) _cregChart('cregChSup', { type: 'bar', data: { labels: sk.map(s => String(s).length > 28 ? String(s).slice(0, 27) + '…' : s),
    datasets: [{ label: 'Personas capacitadas', data: sk.map(s => sup[s].a), backgroundColor: 'rgba(10,36,99,.85)', borderRadius: 4 }] }, options: barras });

  /* Temas mas dictados */
  const tem = {};
  lista.forEach(r => { const t = String(r.tema || 'Sin tema').trim(); tem[t] = (tem[t] || 0) + 1; });
  const tm = Object.keys(tem).sort((a, b) => tem[b] - tem[a]).slice(0, 8);
  _cregChart('cregChTema', { type: 'bar', data: { labels: tm.map(t => t.length > 42 ? t.slice(0, 41) + '…' : t),
    datasets: [{ label: 'Capacitaciones', data: tm.map(t => tem[t]), backgroundColor: 'rgba(217,31,38,.85)', borderRadius: 4 }] }, options: barras });
}

function _cregTabla(lista) {
  const wrap = document.getElementById('tbRegistrosWrap');
  const cnt = document.getElementById('cregConteo');
  if (cnt) cnt.textContent = lista.length + ' capacitación(es)' + (lista.length !== _cregDatos.length ? ' de ' + _cregDatos.length + ' en el rango' : '');
  if (!wrap) return;
  if (!lista.length) { wrap.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>Sin capacitaciones en este rango</div>'; return; }
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Fecha</th><th>Empresa</th><th>Tipo</th><th>Tema</th><th>Capacitador</th>
        <th style="text-align:center">Personas</th><th style="text-align:center">Horas</th><th>Registrado por</th><th></th>
      </tr></thead>
      <tbody>${lista.map((r, i) => `<tr>
        <td style="white-space:nowrap">${_cregDdmm(_cregFecha(r))}${_cregRetro(r) ? '<div title="Registrada el ' + _cregEsc(_cregDdmm(_cregFechaReg(r))) + ', despues de la fecha de la capacitacion" style="margin-top:3px;display:inline-block;font-size:10.5px;font-weight:700;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:1px 7px">📅 fecha anterior</div>' : ''}</td>
        <td><span class="badge-emp ${String(r.empresa || '').toUpperCase().indexOf('RAPEL') >= 0 ? 'badge-rap' : 'badge-vrf'}">${_cregEsc(r.empresa || '')}</span></td>
        <td>${String(r.tipo || '').split(',').map(t => t.trim()).filter(Boolean).map(t => '<span class="creg-chip">' + _cregEsc(t) + '</span>').join(' ')}</td>
        <td class="creg-tema" style="font-size:12px" title="${_cregEsc(r.tema)}">${_cregEsc(String(r.tema || '').substring(0, 60))}${String(r.tema || '').length > 60 ? '…' : ''}</td>
        <td class="creg-capac" style="font-size:11.5px;color:#475569">${_cregEsc(r.capacitadorNombre || '—')}</td>
        <td style="text-align:center;font-weight:700">${_cregFmt(_cregNum(r.totalAsistentes))}</td>
        <td style="text-align:center">${_cregNum(r.totalHoras) ? _cregFmt(_cregNum(r.totalHoras), 1) : '—'}</td>
        <td style="font-size:11px;color:#334155;line-height:1.35"><b>${_cregEsc(r.creadaPorNombre || r.creadaPor || '—')}</b>${r.fechaRegistro ? '<div style="color:#64748b;font-size:10.5px">🕒 ' + _cregEsc(_capFmtRegistro(r.fechaRegistro)) + '</div>' : ''}</td>
        <td style="white-space:nowrap"><button class="btn btn-gray btn-sm creg-reu" title="Reutilizar: misma nómina con otro título" onclick="capAbrirDuplicar(${i})">📋</button>${_cregEsAdmin ? ` <button class="btn btn-sm creg-reu" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca" title="Eliminar esta capacitación (solo administradores)" onclick="capAbrirEliminar(${i})">🗑</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

/* compatibilidad con llamadas anteriores */
function aplicarFiltrosCap() { cargarRegistros(); }
function limpiarFiltrosCap() {
  sv('cregEmpresa', ''); sv('cregSup', ''); sv('cregCap', ''); sv('cregDesde', ''); sv('cregHasta', '');
  cargarRegistros();
}
window.cargarRegistros = cargarRegistros;
window.cregAplicar = cregAplicar;
window.cregRapido = cregRapido;

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
    /* _CAP_EXPORT_XLSX_V1 (08-oct-2026): antes salia un .csv con comas y el Excel en
       espanol lo mostraba todo en la columna A. Ahora sale un .xlsx real: cada dato en su
       columna, con TODOS los encabezados (incluye los que solo tienen algunas filas,
       p. ej. LABOR / SERVICIO). Si la libreria de Excel no cargo, CSV con ';' (Excel en espanol). */
    const cols = [];
    rows.forEach(r => Object.keys(r || {}).forEach(k => { if (cols.indexOf(k) < 0) cols.push(k); }));
    const celda = val => (val == null ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val)));
    const nombre = `capacitaciones_${v('expDesde') || 'inicio'}_${v('expHasta') || 'hoy'}`;
    if (typeof XLSX !== 'undefined' && XLSX.utils) {
      const aoa = [cols].concat(rows.map(r => cols.map(c => celda(r[c]))));   /* todo como texto: DNI y fechas no se deforman */
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = cols.map((c, i) => {
        let w = c.length;
        for (let k = 1; k < Math.min(aoa.length, 300); k++) w = Math.max(w, String(aoa[k][i] || '').length);
        return { wch: Math.min(Math.max(w + 2, 8), 60) };
      });
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: cols.length - 1 } }) };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Capacitaciones');
      XLSX.writeFile(wb, nombre + '.xlsx');
    } else {
      const esc = val => `"${celda(val).replace(/"/g, '""')}"`;
      const txt = 'sep=;\n' + cols.map(esc).join(';') + '\n' + rows.map(r => cols.map(c => esc(r[c])).join(';')).join('\n');
      const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nombre + '.csv' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    if (fb) fb.textContent = `✅ ${rows.length} registros exportados (${cols.length} columnas)`;
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
      '<div class="fg" style="margin-bottom:12px">' +   /* _CAP_DUP_FUENTE_V1 */
        '<label class="lbl">Fuente</label>' +
        '<input type="text" id="dupFuente" maxlength="250" placeholder="Ej: Decreto Supremo N.° 015-2026-TR.">' +
        '<div style="font-size:11px;color:#64748b;margin-top:3px">Viene la del registro original. Cámbiala si el nuevo tema tiene otra fuente.</div>' +
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
  window._capDupCompleto = c;   /* _CAP_PDF_MASIVO_V1: ya trae la nomina completa -> PDF inmediato */
  capAbrirDuplicarObj({
    idCapacitacion:  c.id,
    tema:            c.tema,
    fuente:          c.fuente || '',   /* _CAP_DUP_FUENTE_V1 */
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
  window._capDupCompleto = null;   /* _CAP_PDF_MASIVO_V1 */
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
  var fu = document.getElementById('dupFuente'); if (fu) fu.value = r.fuente || '';   /* _CAP_DUP_FUENTE_V1 */
  var a = document.getElementById('dupAlerta'); if (a) a.innerHTML = '';

  document.getElementById('modalDupOverlay').classList.add('open');
  setTimeout(function () { if (t) t.focus(); }, 120);
}

async function capConfirmarDuplicar() {
  var r = window._capDupActual;
  if (!r) return;

  var titulo = String((document.getElementById('dupTitulo') || {}).value || '').trim();
  var fecha  = String((document.getElementById('dupFecha')  || {}).value || '').trim();
  var fuente = String((document.getElementById('dupFuente') || {}).value || '').trim();   /* _CAP_DUP_FUENTE_V1 */
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
      fuenteNueva: fuente,   /* _CAP_DUP_FUENTE_V1 */
      usuario: USER.usuario,
      rol: USER.rol
    });
    if (!d || !d.success) { aviso((d && d.error) || 'No se pudo crear el registro'); return; }

    /* _CAP_PDF_MASIVO_V1 (06-oct): antes solo creaba el registro con el tema nuevo y
       NO generaba el documento (habia que buscarlo en "Regenerar"). Ahora genera el
       formato R-SC-01 del registro nuevo de inmediato. */
    aviso('✔ Registro creado con ' + d.asistentes + ' asistentes. Generando el formato R-SC-01...', true);
    /* _CAP_DUP_LISTA_YA_V1 (06-oct): la lista se actualiza YA (antes, solo al terminar el PDF;
       si Azure estaba lento, el registro nuevo tardaba en aparecer y parecia que no se guardo) */
    if (typeof cargarRegistros === 'function') { try { cargarRegistros(); } catch (eL) {} }
    var pdfOk = false;
    try {
      var capNueva = await _capArmarDuplicado(r, d.idCapacitacion, titulo, d.fecha || fecha);
      if (capNueva && fuente) capNueva.fuente = fuente;   /* _CAP_DUP_FUENTE_V1: el PDF sale con la fuente nueva */
      if (capNueva) {
        capCerrarDuplicar();
        var rg = document.getElementById('modalRegenOverlay'); if (rg) rg.style.display = 'none';
        try { pdfOk = await regenerarFormatoCapacitacion(capNueva); }
        finally { if (rg) rg.style.display = 'flex'; }
      }
    } catch (ePdf) { console.error('[_CAP_PDF_MASIVO_V1] PDF del duplicado:', ePdf); }
    capCerrarDuplicar();
    if (pdfOk) {
      mostrarFeedback('ok', '✅ Se creó "' + titulo + '" con la misma nómina (' + d.asistentes + ' personas) y se generó su formato R-SC-01.');
    } else {
      mostrarFeedback('err', '⚠️ Se creó "' + titulo + '" (' + d.asistentes + ' personas), pero el PDF no se generó. ' +
                             'Búscalo en "Regenerar formato" con la fecha ' + (d.fecha || fecha) + '.');
    }
    if (typeof cargarRegistros === 'function') cargarRegistros();

  } catch (e) {
    aviso('Error de conexión: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '✔ Crear el registro'; }
  }
}

/* _CAP_PDF_MASIVO_V1: arma la capacitacion nueva (misma nomina, tema/fecha nuevos) para su PDF */
async function _capArmarDuplicado(r, idNuevo, titulo, fechaNueva) {
  var idOrig = String(r.idCapacitacion || r.id_capacitacion || r.id || '').trim();
  var base = window._capDupCompleto;
  var fNueva = String(fechaNueva || '').substring(0, 10);
  function derivar(b) {
    return Object.assign({}, b, { id: idNuevo || b.id, tema: titulo, fecha: fNueva || b.fecha, asistentes: (b.asistentes || []).slice() });
  }
  if (base && String(base.id).trim() === idOrig && base.asistentes && base.asistentes.length) return derivar(base);

  async function buscar(id, f) {
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
    var ex = await apiPost({ action: 'exportarCapacitaciones', desde: f, hasta: f, empresa: '', usuario: USER.usuario, rol: USER.rol });
    if (!ex || !ex.success || !ex.data) return null;
    var filas = ex.data.filter(function (x) { return String(x.ID_CAPACITACION || x.idCapacitacion || x.id || '').trim() === id; });
    return filas.length ? _capAgruparExport(filas, f)[0] : null;
  }
  var nueva = await buscar(String(idNuevo || '').trim(), fNueva);          // el registro nuevo, tal cual quedo guardado
  if (nueva && nueva.asistentes.length) return nueva;
  var orig = await buscar(idOrig, String(r.fecha || '').substring(0, 10)); // o el original con el tema/fecha nuevos
  return (orig && orig.asistentes.length) ? derivar(orig) : null;
}

window.capAbrirDuplicar      = capAbrirDuplicar;
window.capAbrirDuplicarRegen = capAbrirDuplicarRegen;
window.capAbrirDuplicarObj   = capAbrirDuplicarObj;
window.capConfirmarDuplicar = capConfirmarDuplicar;
window.capCerrarDuplicar   = capCerrarDuplicar;

console.log('[_CAP_DUPLICAR_V1] reutilizar nomina listo');


/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_ELIMINAR_V1 (06-oct-2026) — ELIMINAR una capacitacion guardada
   Solo administradores (el boton solo se pinta si el servidor dice esAdmin, y
   Azure / Google lo vuelven a validar). Motivo obligatorio. Lo eliminado queda
   respaldado (Azure: dbo.Cap_Eliminados · hoja: CAPACITACIONES_ELIMINADAS).
   ═══════════════════════════════════════════════════════════════════════════ */
function capCrearModalEliminar() {
  if (document.getElementById('modalElimOverlay')) return;
  var d = document.createElement('div');
  d.className = 'modal-overlay';
  d.id = 'modalElimOverlay';
  d.style.zIndex = '10050';
  d.onclick = function (e) { if (e.target === d) capCerrarEliminar(); };
  d.innerHTML =
    '<div class="modal-lista" onclick="event.stopPropagation()">' +
      '<h3 style="color:#b91c1c">🗑 Eliminar capacitación</h3>' +
      '<div id="elimResumen" style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;' +
        'padding:10px 13px;font-size:12.5px;color:#7f1d1d;line-height:1.6;margin-bottom:14px"></div>' +
      '<div class="fg" style="margin-bottom:12px">' +
        '<label class="lbl">Motivo de la eliminación * (mínimo 10 caracteres)</label>' +
        '<textarea id="elimMotivo" maxlength="500" rows="3" style="width:100%;resize:vertical" ' +
          'placeholder="Ej: Registro duplicado por error, la nómina correcta es la del CAP-..."></textarea>' +
      '</div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#334155;margin-bottom:14px;cursor:pointer">' +
        '<input type="checkbox" id="elimConfirmo" style="margin-top:2px"> ' +
        '<span>Confirmo que quiero eliminar esta capacitación y <b>todos sus asistentes</b>. ' +
        'Dejará de aparecer en Registros, Exportar y los indicadores.</span>' +
      '</label>' +
      '<div style="font-size:11.5px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;' +
        'border-radius:7px;padding:8px 11px;margin-bottom:14px;line-height:1.55">' +
        'Queda un <b>respaldo</b> con quién, cuándo y el motivo. Si fue un error, se puede recuperar.' +
      '</div>' +
      '<div id="elimAlerta"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button class="btn btn-gray btn-sm" onclick="capCerrarEliminar()">Cancelar</button>' +
        '<button class="btn btn-sm" id="elimBtn" style="background:#dc2626;color:#fff" onclick="capConfirmarEliminar()">🗑 Eliminar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);
}

function capCerrarEliminar() {
  var o = document.getElementById('modalElimOverlay');
  if (o) o.classList.remove('open');
}

function capAbrirEliminar(idx) {
  var r = (window._capRegistros || [])[idx];
  if (!r) { mostrarFeedback('err', 'No encuentro ese registro. Actualiza la lista.'); return; }
  capCrearModalEliminar();
  window._capElimActual = r;
  var n = r.totalAsistentes || r.total_asistentes || 0;
  var fecha = String(r.fecha || '').substring(0, 10);
  var res = document.getElementById('elimResumen');
  if (res) {
    res.innerHTML =
      '<b>' + _cregEsc(r.tema || '(sin título)') + '</b><br>' +
      _cregEsc(r.empresa || '') + ' · ' + _cregEsc(fecha) + ' · <b>' + n + ' personas</b>' +
      (r.creadaPorNombre || r.creadaPor ? ' · registró ' + _cregEsc(r.creadaPorNombre || r.creadaPor) : '') +
      '<br><span style="font-size:11px;color:#991b1b">ID: ' + _cregEsc(r.idCapacitacion || r.id || '') + '</span>';
  }
  var m = document.getElementById('elimMotivo'); if (m) m.value = '';
  var c = document.getElementById('elimConfirmo'); if (c) c.checked = false;
  var a = document.getElementById('elimAlerta'); if (a) a.innerHTML = '';
  var b = document.getElementById('elimBtn'); if (b) { b.disabled = false; b.innerHTML = '🗑 Eliminar'; }
  document.getElementById('modalElimOverlay').classList.add('open');
  setTimeout(function () { if (m) m.focus(); }, 120);
}

async function capConfirmarEliminar() {
  var r = window._capElimActual;
  if (!r) return;
  var motivo = String((document.getElementById('elimMotivo') || {}).value || '').trim();
  var conf = !!(document.getElementById('elimConfirmo') || {}).checked;
  var al = document.getElementById('elimAlerta');
  function aviso(msg, ok) {
    if (!al) return;
    al.innerHTML = '<div style="background:' + (ok ? '#dcfce7' : '#fef2f2') +
      ';border:1.5px solid ' + (ok ? '#86efac' : '#fecaca') + ';color:' + (ok ? '#166534' : '#dc2626') +
      ';border-radius:8px;padding:9px 12px;font-size:12.5px;margin-bottom:12px">' + msg + '</div>';
  }
  if (motivo.length < 10) { aviso('Escribe el motivo (mínimo 10 caracteres).'); return; }
  if (!conf)              { aviso('Marca la casilla de confirmación.'); return; }

  var btn = document.getElementById('elimBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Eliminando...'; }
  var ok = false;
  try {
    var d = await apiPost({
      action: 'eliminarCapacitacion',
      idCapacitacion: r.idCapacitacion || r.id_capacitacion || r.id,
      motivo: motivo,
      usuario: USER.usuario,
      rol: USER.rol
    });
    if (!d || !d.success) { aviso((d && d.error) || 'No se pudo eliminar'); return; }
    ok = true;
    aviso('✔ Capacitación eliminada' + (d.asistentesEliminados != null ? ' (' + d.asistentesEliminados + ' asistentes)' : '') + '.', true);
    setTimeout(function () {
      capCerrarEliminar();
      mostrarFeedback('ok', '🗑 Se eliminó "' + (r.tema || '') + '". Queda respaldada por si hay que recuperarla.');
      if (typeof cargarRegistros === 'function') cargarRegistros();
    }, 800);
  } catch (e) {
    aviso('Error de conexión: ' + e.message);
  } finally {
    if (btn && !ok) { btn.disabled = false; btn.innerHTML = '🗑 Eliminar'; }
  }
}

window.capAbrirEliminar     = capAbrirEliminar;
window.capConfirmarEliminar = capConfirmarEliminar;
window.capCerrarEliminar    = capCerrarEliminar;


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
