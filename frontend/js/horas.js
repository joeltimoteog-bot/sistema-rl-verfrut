// _MODALES_CUSTOM_V1 (08-jun-2026): migración a appAlert/appConfirm/appPrompt
// _MOTIVO_DEVOLUCION_V5 (09-ago-2026): el motivo Devolución ahora abre los
// campos de horario y descuenta horas igual que Permiso.
// _HORAS_ENCABEZADOS_V4 (09-ago-2026): encabezados de la tabla REGISTROS en
// texto oscuro (salían en blanco sobre blanco y no se leían).
// _HORAS_REGISTRADORES_V3 (08-ago-2026): la búsqueda automática de DNI ahora
// envía 'usuario' (antes no, por eso solo funcionaba con el botón Actualizar)
// y muestra el aviso de bloqueo sola, con feedback inmediato "Consultando...".
// _HORAS_REGISTRADORES_V2 (08-ago-2026): dsanchez/lmorales/jsiancas pueden
// registrar acumulaciones; solo ven SUS registros y el saldo de SUS registros;
// si consultan un DNI que no registraron, se bloquea y se pide autorizacion.
// El administrador ve todo, y ademas quien registro cada fila.
'use strict';
/* ═══════════════════════════════════════════════════════════════════
   horas.js · Sistema RL v3.0 · Módulo Acumulación de Horas
   SPA — sin recargas entre tabs. Cache en memoria.
   ═══════════════════════════════════════════════════════════════════ */

const USUARIOS_PERMITIDOS = ['jtimoteo', 'ovilela', 'jchavez', 'dsanchez', 'lmorales', 'jsiancas'];
// Acceso BÁSICO: solo pueden ver Registrar y Resumen Individual.
// (Resumen General, Aprobaciones y Config quedan ocultos y bloqueados.)
const USUARIOS_BASICOS = ['dsanchez', 'lmorales', 'jsiancas'];
const TABS_SOLO_ADMIN  = ['general', 'aprobaciones', 'config'];

let USER = null;
let API  = '';
let ES_BASICO = false;

window.horasCache = window.horasCache || {
  motivos: [],
  trabajadorActual: null,
  resumenIndividual: null,
  resumenGeneral: null,
  aprobaciones: null,
  tabsCargados: { individual: false, general: false, aprobaciones: false, config: false }
};

/* ─────────────── INIT ─────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if (!ud || !API) { location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

  const u = (USER.usuario || '').toLowerCase().trim();
  if (!USUARIOS_PERMITIDOS.includes(u)) {
    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Barlow,sans-serif;gap:12px;color:#64748b">
      <div style="font-size:48px">🔒</div>
      <div style="font-size:18px;font-weight:700;color:#0f172a">Acceso restringido a administradores</div>
      <div style="font-size:14px">Este módulo es de uso exclusivo del equipo administrativo.</div>
      <a href="dashboard.html" style="margin-top:8px;color:#0a2463;font-weight:700;font-size:14px">← Volver al dashboard</a>
    </div>`;
    return;
  }

  // Modo básico: ocultar las pestañas de administración (además del bloqueo en showTab)
  ES_BASICO = USUARIOS_BASICOS.includes(u);
  if (ES_BASICO) {
    TABS_SOLO_ADMIN.forEach(t => {
      const b = document.querySelector('.tab-btn[data-tab="' + t + '"]');
      if (b) b.style.display = 'none';
      const tc = document.getElementById('tab-' + t);
      if (tc) tc.innerHTML = '<div class="empty">🔒 Sección reservada al equipo administrativo.</div>';
    });
  }

  const el = document.getElementById('topNombre');
  if (el) el.textContent = USER.nombre || USER.usuario || '';

  // Default fecha entrada/salida = hoy
  const hoy = new Date().toISOString().split('T')[0];
  sv('regFechaEntrada', hoy);
  sv('regFechaSalida', hoy);

  // Búsqueda instantánea de DNI con debounce + cache + spinner inline
  _setupDniAutoSearch('regDni', {
    fetch: (dni) => apiPost({ action: 'horasBuscarTrabajador', dni }),
    isFound: (d) => !!(d && d.success && d.trabajador),
    onFound: (d) => { _aplicarTrabajadorAlForm(d.trabajador); cargarSaldoTrabajador(d.trabajador.dni); },
    onNotFound: _limpiarTrabajadorEnForm,
    onClear: _limpiarTrabajadorEnForm
  });
  // _HORAS_REGISTRADORES_V3: esta búsqueda automática NO enviaba 'usuario'.
  // Sin ese dato el servidor no sabía quién preguntaba y respondía con el
  // aviso de sesión, que aquí se tomaba como "no encontrado" -> tabla vacía
  // y ningún mensaje. Por eso solo funcionaba con el botón Actualizar.
  _setupDniAutoSearch('indDni', {
    fetch: (dni) => apiPost({ action: 'horasResumenIndividual', dni, usuario: USER.usuario }),
    isFound: (d) => !!(d && d.success && Array.isArray(d.registros)),
    onFound: (d) => { window.horasCache.resumenIndividual = d; renderResumenIndividual(d); },
    onNotFound: (d) => _mostrarBloqueoIndividual(d),
    onClear:    _limpiarResumenIndividual
  });

  // Cargar motivos al inicio (cacheado)
  cargarMotivos();

  // _HORAS_ENCABEZADOS_V4: los títulos de la tabla REGISTROS del Resumen
  // Individual salían en blanco sobre fondo blanco y no se leían.
  _fijarEncabezadosIndiv();
  setTimeout(_fijarEncabezadosIndiv, 600);   // por si el tema los repinta después
});

/* Fuerza texto oscuro en los encabezados de la tabla de registros.
   Se limita a ESA tabla (la que contiene #tbIndiv): no toca ninguna otra. */
function _fijarEncabezadosIndiv() {
  try {
    const tb = document.getElementById('tbIndiv');
    if (!tb) return;
    const tabla = tb.closest ? tb.closest('table') : tb.parentElement;
    if (!tabla) return;
    tabla.querySelectorAll('thead th').forEach(th => {
      th.style.setProperty('color', '#0f172a', 'important');
      th.style.setProperty('background-color', '#e2e8f0', 'important');
      th.style.setProperty('font-weight', '700', 'important');
    });
  } catch (e) { /* nunca romper la página por un color */ }
}

/* ─────────────── DNI AUTO-SEARCH (instant + debounce + cache + spinner) ─────────────── */
function _setupDniAutoSearch(inputId, opts) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrap  = input.closest('.dni-wrap');
  const cache = {};
  let timer   = null;

  const setLoading = (b) => { if (wrap) wrap.classList.toggle('loading', !!b); };
  const setFound   = ()  => { input.classList.add('dni-ok');  input.classList.remove('dni-err'); };
  const setMissing = ()  => { input.classList.add('dni-err'); input.classList.remove('dni-ok'); };
  const setNeutral = ()  => { input.classList.remove('dni-ok','dni-err'); };

  input.addEventListener('input', (e) => {
    const cleaned = (e.target.value || '').replace(/\D/g, '').substring(0, 8);
    if (cleaned !== e.target.value) e.target.value = cleaned;
    const dni = cleaned;
    if (timer) { clearTimeout(timer); timer = null; }

    if (dni.length < 8) {
      setNeutral();
      setLoading(false);
      if (opts.onClear) opts.onClear();
      return;
    }

    if (cache[dni]) {
      setFound();
      setLoading(false);
      opts.onFound(cache[dni]);
      return;
    }

    // Aviso inmediato: el usuario ve que ya se está consultando.
    if (inputId === 'indDni' && typeof _mostrarBuscandoIndividual === 'function') _mostrarBuscandoIndividual();

    timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await opts.fetch(dni);
        setLoading(false);
        if (opts.isFound(data)) {
          cache[dni] = data;
          setFound();
          opts.onFound(data);
        } else {
          setMissing();
          if (opts.onNotFound) opts.onNotFound(data);   // <- ahora recibe la respuesta
        }
      } catch (err) {
        setLoading(false);
        console.error('[HORAS] DNI search:', err);
        if (opts.onNotFound) opts.onNotFound(null);
      }
    }, 250);
  });
}

/* ─────────────── TABS (SPA puro) ─────────────── */
function showTab(tab, btn) {
  // Los usuarios básicos NO pueden abrir las pestañas de administración
  if (ES_BASICO && TABS_SOLO_ADMIN.includes(tab)) return;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if (tc) tc.classList.add('on');
  if (btn) btn.classList.add('on');

  // Lazy-load por tab — solo al primer ingreso
  const cargados = window.horasCache.tabsCargados;
  if (tab === 'general' && !cargados.general) { cargarResumenGeneral(); cargados.general = true; }
  if (tab === 'aprobaciones' && !cargados.aprobaciones) { cargarAprobaciones(); cargados.aprobaciones = true; }
  if (tab === 'config' && !cargados.config) { renderMotivos(); cargados.config = true; }
}

/* ─────────────── MOTIVOS (cache compartido) ─────────────── */
async function cargarMotivos() {
  try {
    const d = await apiPost({ action: 'horasListarMotivos' });
    if (d && d.success && Array.isArray(d.motivos)) {
      window.horasCache.motivos = d.motivos;
      poblarSelectMotivos();
      renderMotivos();
    }
  } catch (e) { console.error('[HORAS] cargarMotivos:', e); }
}

function poblarSelectMotivos() {
  const sel = document.getElementById('regMotivo');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Seleccionar...</option>' +
    window.horasCache.motivos.map(m => `<option value="${esc(m)}">${m}</option>`).join('') +
    '<option value="__NUEVO__">+ Agregar nuevo motivo...</option>';
  if (prev && prev !== '__NUEVO__') sel.value = prev;
}

function motivoCambia() {
  const sel = document.getElementById('regMotivo');
  if (!sel) return;
  if (sel.value === '__NUEVO__') {
    sel.value = '';
    abrirModalMotivo();
    return;
  }
  const esPermiso = _esMotivoConHorario(sel.value);
  document.getElementById('grpPermInicio').style.display = esPermiso ? '' : 'none';
  document.getElementById('grpPermFin').style.display    = esPermiso ? '' : 'none';
  recalcularHoras();
}

/* _MOTIVO_DEVOLUCION_V5 (09-ago-2026)
   Motivos que abren los campos de horario y descuentan horas.
   Antes esto estaba escrito tres veces como .includes('permiso'), por eso
   "Devolución" no abría el campo de horas ni enviaba el horario al servidor.
   Ahora está en UN solo lugar: para sumar otro motivo, se agrega aquí.
   Se quitan las tildes antes de comparar, así "Devolución" y "Devolucion"
   funcionan igual. */
function _esMotivoConHorario(m) {
  const t = String(m || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');   // quita tildes
  return t.includes('permiso') || t.includes('devolucion');
}

function abrirModalMotivo() {
  sv('modalMotivoNombre', '');
  document.getElementById('modalMotivoAlert').innerHTML = '';
  document.getElementById('modalMotivo').style.display = 'flex';
  setTimeout(() => document.getElementById('modalMotivoNombre').focus(), 50);
}

function cerrarModalMotivo(e) {
  if (e && e.target !== document.getElementById('modalMotivo')) return;
  document.getElementById('modalMotivo').style.display = 'none';
}

async function confirmarNuevoMotivo() {
  const nombre = v('modalMotivoNombre').trim();
  const al = document.getElementById('modalMotivoAlert');
  if (!nombre) { al.innerHTML = '<div class="alert alert-err">El nombre es obligatorio</div>'; return; }
  try {
    const d = await apiPost({ action: 'horasAgregarMotivo', usuario: USER.usuario, nombre });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    await cargarMotivos();
    document.getElementById('modalMotivo').style.display = 'none';
    // Pre-seleccionar el motivo recién creado
    sv('regMotivo', nombre);
    motivoCambia();
  } catch (e) { al.innerHTML = `<div class="alert alert-err">❌ ${e.message}</div>`; }
}

async function agregarMotivo() {
  limpiarAlerta('alMotivos');
  const nombre = v('cfgMotivoNombre').trim();
  if (!nombre) { mostrarAlerta('alMotivos', 'err', 'El nombre es obligatorio'); return; }
  try {
    const d = await apiPost({ action: 'horasAgregarMotivo', usuario: USER.usuario, nombre });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    sv('cfgMotivoNombre', '');
    await cargarMotivos();
    mostrarAlerta('alMotivos', 'ok', `✅ Motivo "${nombre}" agregado`);
  } catch (e) { mostrarAlerta('alMotivos', 'err', '❌ ' + e.message); }
}

async function eliminarMotivo(nombre) {
  if (!await appConfirm(`¿Eliminar el motivo "${nombre}"?`)) return;
  try {
    const d = await apiPost({ action: 'horasEliminarMotivo', usuario: USER.usuario, nombre });
    if (!d.success) throw new Error(d.error || 'Error al eliminar');
    await cargarMotivos();
  } catch (e) { await appAlert('❌ ' + e.message); }
}

function renderMotivos() {
  const tb = document.getElementById('tbMotivos');
  if (!tb) return;
  const motivos = window.horasCache.motivos || [];
  if (!motivos.length) { tb.innerHTML = '<tr><td colspan="2" class="empty">Sin motivos</td></tr>'; return; }
  tb.innerHTML = motivos.map(m => `<tr>
    <td><b>${m}</b></td>
    <td style="white-space:nowrap;text-align:right">
      <button class="btn-tbl btn-del" onclick="eliminarMotivo('${esc(m)}')">🗑️ Eliminar</button>
    </td>
  </tr>`).join('');
}

/* ─────────────── TAB 1: BUSCAR + REGISTRAR ─────────────── */
function _aplicarTrabajadorAlForm(t) {
  if (!t) return;
  window.horasCache.trabajadorActual = t;
  sv('regNombre', t.nombre || '');
  sv('regEmpresa', t.empresa || '');
  sv('regCargo', t.cargo || '');
  sv('regRegimen', t.regimen || '');
  sv('regFechaInicio', formatFecha(t.fechaInicio));
  document.getElementById('cardDatos').style.display = '';
  document.getElementById('cardRegistro').style.display = '';
  recalcularHoras();
}

function _limpiarTrabajadorEnForm() {
  window.horasCache.trabajadorActual = null;
  ['regNombre','regEmpresa','regCargo','regRegimen','regFechaInicio'].forEach(id => sv(id, ''));
  document.getElementById('cardDatos').style.display = 'none';
  document.getElementById('cardRegistro').style.display = 'none';
  document.getElementById('saldoWrap').innerHTML = '';
}

/* _HORAS_REGISTRADORES_V3
   Muestra el aviso del servidor (sin autorización / sesión antigua) en la
   búsqueda automática, sin necesidad de pulsar Actualizar. */
function _mostrarBloqueoIndividual(d) {
  _limpiarResumenIndividual();
  const msg = (d && (d.mensaje || d.error)) || 'No se encontraron registros para este DNI.';
  const bloqueado = !!(d && d.bloqueado);
  document.getElementById('tbIndiv').innerHTML =
    `<tr><td colspan="9" class="empty">${bloqueado ? '🔒 Sin acceso a este DNI' : 'Sin registros'}</td></tr>`;
  document.getElementById('indComentario').innerHTML = `
    <div class="card" style="border-left:4px solid ${bloqueado ? '#f59e0b' : '#94a3b8'}">
      <div class="card-title">${bloqueado ? '🔒 Necesitas autorización' : 'ℹ️ Sin resultados'}</div>
      <div style="font-size:13px;color:#475569;line-height:1.6">${msg}</div>
    </div>`;
}

/* Aviso inmediato mientras viaja la consulta, para que no parezca colgado. */
function _mostrarBuscandoIndividual() {
  const tb = document.getElementById('tbIndiv');
  if (tb) tb.innerHTML = '<tr><td colspan="9" class="empty">⏳ Consultando...</td></tr>';
  const c = document.getElementById('indComentario');
  if (c) c.innerHTML = '';
}

function _limpiarResumenIndividual() {
  window.horasCache.resumenIndividual = null;
  document.getElementById('tbIndiv').innerHTML = '<tr><td colspan="9" class="empty">Sin datos</td></tr>';
  document.getElementById('indHeader').innerHTML = '';
  document.getElementById('indSaldos').innerHTML = '';
  document.getElementById('indComentario').innerHTML = '';
}

async function cargarSaldoTrabajador(dni) {
  try {
    const d = await apiPost({ action: 'horasResumenIndividual', dni, usuario: USER.usuario });
    // _HORAS_REGISTRADORES_V2: DNI sin registros propios -> no se muestra saldo.
    if (d && d.bloqueado) {
      document.getElementById('saldoWrap').innerHTML = `
        <div class="card" style="border-left:4px solid #f59e0b">
          <div style="font-size:13px;color:#92400e;line-height:1.5">
            🔒 <b>Saldo no disponible</b><br>${d.mensaje || ''}
          </div>
        </div>`;
      return;
    }
    if (d && d.success && d.totales) {
      renderSaldoCard(d);
    } else {
      document.getElementById('saldoWrap').innerHTML = '';
    }
  } catch (e) { console.error('[HORAS] saldo:', e); }
}

function renderSaldoCard(data) {
  const t = data.totales || {};
  const acum = Number(t.acum || 0);
  const perm = Number(t.perm || 0);
  const deuda = Number(t.deuda || 0);
  const saldo = (t.saldo !== undefined) ? Number(t.saldo) : (acum - perm - deuda);
  document.getElementById('saldoWrap').innerHTML = `
    <div class="saldo-card">
      <div class="lbl-w">📊 Saldo actual</div>
      <div class="val-w">${saldo.toFixed(2)} <span style="font-size:14px;font-weight:600;opacity:.85">horas</span></div>
      <div class="row3">
        <div class="mini">🟢 Acumuladas<b>${acum.toFixed(2)}</b></div>
        <div class="mini">🔵 Permiso<b>${perm.toFixed(2)}</b></div>
        <div class="mini">🔴 Deuda<b>${deuda.toFixed(2)}</b></div>
      </div>
    </div>`;
}

/* ─────────────── CÁLCULO EN VIVO ─────────────── */
// Réplica exacta de la fórmula del backend.
// Usa parseo TZ-local para que getDay()/getMonth() reflejen el día tipeado.
function _parseFechaLocal(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function horasCalcularJornadaUnDia(fecha) {
  const f = (fecha instanceof Date) ? fecha : _parseFechaLocal(fecha);
  if (!f || isNaN(f.getTime())) return 0;
  const mes = f.getMonth() + 1;  // 1-12
  const dia = f.getDay();         // 0=dom, 1=lun, ..., 6=sab
  if (mes <= 5) {
    // Temporada alta: enero-mayo
    return (dia >= 1 && dia <= 5) ? 9.6 : 0;
  } else {
    // Temporada baja: junio-diciembre
    if (dia >= 1 && dia <= 5) return 8.75;
    if (dia === 6) return 5.75;
    return 0;
  }
}

function horasCalcularJornadaTotal(fechaIni, fechaFin) {
  if (!fechaIni) return 0;
  if (!fechaFin) return horasCalcularJornadaUnDia(fechaIni);
  const f1 = _parseFechaLocal(fechaIni);
  const f2 = _parseFechaLocal(fechaFin);
  if (!f1 || !f2 || isNaN(f1.getTime()) || isNaN(f2.getTime())) return 0;
  let total = 0;
  const cur = new Date(f1);
  while (cur <= f2) {
    total += horasCalcularJornadaUnDia(cur);
    cur.setDate(cur.getDate() + 1);
  }
  return Math.round(total * 100) / 100;
}

function recalcularHoras() {
  const fE = v('regFechaEntrada'); const hE = v('regHoraEntrada');
  const fS = v('regFechaSalida');  const hS = v('regHoraSalida');
  const motivo = (v('regMotivo') || '').toLowerCase();

  let horasTrab = 0;
  if (fE && hE && fS && hS) {
    const ini = new Date(fE + 'T' + hE + ':00');
    const fin = new Date(fS + 'T' + hS + ':00');
    if (!isNaN(ini.getTime()) && !isNaN(fin.getTime()) && fin > ini) {
      const bruto = (fin - ini) / 36e5; // horas
      // Descontar 45min refrigerio si jornada >= 5h
      horasTrab = bruto >= 5 ? bruto - 0.75 : bruto;
    }
  }

  let horasPerm = 0;
  if (_esMotivoConHorario(motivo)) {   /* _MOTIVO_DEVOLUCION_V5 */
    const pi = v('regHoraPermInicio');
    const pf = v('regHoraPermFin');
    if (pi && pf) {
      const ini = new Date('1970-01-01T' + pi + ':00');
      const fin = new Date('1970-01-01T' + pf + ':00');
      if (!isNaN(ini.getTime()) && !isNaN(fin.getTime()) && fin > ini) {
        horasPerm = (fin - ini) / 36e5;
      }
    }
  }

  // Acumuladas: si motivo es "Acumulación", la hora trabajada se acumula tal cual.
  // Para otros motivos lo dejamos = 0 como referencia (backend dará el valor real).
  const horasAcum = motivo.includes('acumulaci') ? horasTrab : 0;

  // Jornada esperada — réplica de la fórmula backend
  const jornada = horasCalcularJornadaTotal(fE, fS);

  setText('calcTrab', horasTrab.toFixed(2));
  setText('calcAcum', horasAcum.toFixed(2));
  setText('calcPerm', horasPerm.toFixed(2));
  setText('calcJornada', jornada.toFixed(2) + ' h');
}

async function registrarHoras() {
  limpiarAlerta('alRegistro');
  const t = window.horasCache.trabajadorActual;
  if (!t) { mostrarAlerta('alRegistro', 'err', 'Busca primero un trabajador'); return; }

  const motivo = v('regMotivo');
  const fE = v('regFechaEntrada'); const hE = v('regHoraEntrada');
  const fS = v('regFechaSalida');  const hS = v('regHoraSalida');
  if (!fE || !hE || !fS || !hS) { mostrarAlerta('alRegistro', 'err', 'Completa fecha y hora de entrada y salida'); return; }
  if (!motivo || motivo === '__NUEVO__') { mostrarAlerta('alRegistro', 'err', 'Selecciona un motivo'); return; }

  const horasTrab = Number(v('calcTrab')) || 0;
  const horasPerm = Number(v('calcPerm')) || 0;

  const registro = {
    dni:             t.dni,
    nombre:          t.nombre,
    empresa:         t.empresa,
    cargo:           t.cargo,
    fechaEntrada:    fE,
    horaEntrada:     hE,
    fechaSalida:     fS,
    horaSalida:      hS,
    horasTrabajadas: horasTrab,
    horasPermiso:    horasPerm,
    motivo,
    detalle:         v('regDetalle'),
    observaciones:   v('regObservaciones')
  };
  if (_esMotivoConHorario(motivo)) {   /* _MOTIVO_DEVOLUCION_V5 */
    registro.horaInicioPermiso = v('regHoraPermInicio');
    registro.horaFinPermiso    = v('regHoraPermFin');
  }

  const btn = document.getElementById('btnRegistrar');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Guardando...';
  try {
    const d = await apiPost({ action: 'horasRegistrar', usuario: USER.usuario, registro });
    if (!d.success) throw new Error(d.error || 'Error al registrar');
    const r = d.registro || {};
    const estado = r.estado || (r.alerta ? 'pendiente' : 'aprobado');
    mostrarAlerta('alRegistro', 'ok',
      `✅ Registro guardado · Estado: <b>${estado}</b>` +
      (r.alerta ? ` · ⚠️ ${r.alerta}` : ''));
    // Limpiar formulario (excepto DNI)
    sv('regHoraEntrada', '');
    sv('regHoraSalida', '');
    sv('regHoraPermInicio', '');
    sv('regHoraPermFin', '');
    sv('regMotivo', '');
    sv('regDetalle', '');
    sv('regObservaciones', '');
    document.getElementById('grpPermInicio').style.display = 'none';
    document.getElementById('grpPermFin').style.display = 'none';
    recalcularHoras();
    // Refrescar saldo + invalidar cachés relevantes
    await cargarSaldoTrabajador(t.dni);
    window.horasCache.tabsCargados.general = false;
    window.horasCache.tabsCargados.aprobaciones = false;
  } catch (e) {
    mostrarAlerta('alRegistro', 'err', '❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '💾 Registrar';
  }
}

/* ─────────────── TAB 2: RESUMEN INDIVIDUAL ─────────────── */
async function cargarResumenIndividual() {
  limpiarAlerta('alIndiv');
  const dni = v('indDni').trim();
  if (!/^\d{8}$/.test(dni)) { mostrarAlerta('alIndiv', 'err', 'DNI inválido'); return; }
  try {
    const d = await apiPost({ action: 'horasResumenIndividual', dni, usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'Error al cargar');
    // _HORAS_REGISTRADORES_V2: DNI del que este usuario no tiene registros propios.
    if (d.bloqueado) {
      window.horasCache.resumenIndividual = null;
      _limpiarResumenIndividual();
      document.getElementById('tbIndiv').innerHTML =
        '<tr><td colspan="9" class="empty">🔒 Sin acceso a este DNI</td></tr>';
      document.getElementById('indComentario').innerHTML = `
        <div class="card" style="border-left:4px solid #f59e0b">
          <div class="card-title">🔒 Necesitas autorización</div>
          <div style="font-size:13px;color:#475569;line-height:1.6">${d.mensaje || ''}</div>
        </div>`;
      return;
    }
    window.horasCache.resumenIndividual = d;
    renderResumenIndividual(d);
  } catch (e) {
    mostrarAlerta('alIndiv', 'err', '❌ ' + e.message);
    _limpiarResumenIndividual();
  }
}

function renderResumenIndividual(d) {
  const registros = d.registros || [];
  const t = d.totales || {};
  const acum = Number(t.acum || 0);
  const perm = Number(t.perm || 0);
  const deuda = Number(t.deuda || 0);
  const saldo = (t.saldo !== undefined) ? Number(t.saldo) : (acum - perm - deuda);

  // Header con datos del trabajador (tomados del primer registro si vienen)
  const primer = registros[0] || {};
  const nombre = primer.nombre || '';
  const empresa = primer.empresa || '';
  const cargo = primer.cargo || '';
  document.getElementById('indHeader').innerHTML = nombre ? `
    <div class="card">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;color:#0a2463">${nombre}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px">DNI ${d.dni || ''} · ${empresa || ''} · ${cargo || ''}</div>
    </div>` : '';

  // Saldos con badges
  document.getElementById('indSaldos').innerHTML = `
    <div class="grid4" style="margin-bottom:14px">
      <div class="stat-card green"><div class="stat-label">🟢 Acumuladas</div><div class="stat-val">${acum.toFixed(2)}</div></div>
      <div class="stat-card blue"><div class="stat-label">🔵 Permiso</div><div class="stat-val">${perm.toFixed(2)}</div></div>
      <div class="stat-card red"><div class="stat-label">🔴 Deuda</div><div class="stat-val">${deuda.toFixed(2)}</div></div>
      <div class="stat-card ${saldo < 0 ? 'red' : 'green'}"><div class="stat-label">⚖️ Saldo final</div><div class="stat-val">${saldo.toFixed(2)}</div></div>
    </div>` + (d.parcial ? `
    <div style="font-size:12px;color:#92400e;background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:6px;margin-bottom:14px">
      ℹ️ Estos totales corresponden <b>solo a los registros que tú ingresaste</b>, no al saldo total del trabajador.
    </div>` : '');

  // Tabla
  const tb = document.getElementById('tbIndiv');
  if (!registros.length) {
    tb.innerHTML = '<tr><td colspan="9" class="empty">Sin registros para este DNI</td></tr>';
  } else {
    tb.innerHTML = registros.map(r => {
      const est = (r.estado || '').toLowerCase();
      const badgeEst = est === 'aprobado' ? '<span class="badge badge-aprob">Aprobado</span>'
                     : est === 'pendiente' ? '<span class="badge badge-pend">Pendiente</span>'
                     : `<span class="badge badge-blue">${r.estado || '-'}</span>`;
      const btnAprob = (!ES_BASICO && est === 'pendiente')
        ? `<button class="btn-tbl btn-aprob" onclick="aprobarRegistro('${esc(r.id)}', false)">✅</button>`
        : '';
      // _HORAS_REGISTRADORES_V1: editar y eliminar quedan solo para administradores.
      const btnEdit = ES_BASICO ? ''
        : `<button class="btn-tbl btn-edit" onclick="abrirEditarRegistro('${esc(r.id)}', ${JSON.stringify(r.observaciones || '').replace(/"/g, '&quot;')})">✏️</button>`;
      const btnDel = ES_BASICO ? ''
        : `<button class="btn-tbl btn-del"  onclick="eliminarRegistro('${esc(r.id)}')">🗑️</button>`;
      return `<tr>
        <td>${formatFecha(r.fechaEntrada || r.fecha)}${ES_BASICO ? '' : `<div style="font-size:11px;color:#64748b;margin-top:2px">👤 ${esc(String(r.registradoPor || '—'))}</div>`}</td>
        <td>${r.motivo || ''}</td>
        <td>${num(r.horasTrabajadas)}</td>
        <td>${num(r.horasAcum)}</td>
        <td>${num(r.horasPermiso)}</td>
        <td>${num(r.horasDeuda)}</td>
        <td>${badgeEst}</td>
        <td style="font-size:12px">${r.observaciones || ''}</td>
        <td style="white-space:nowrap">
          ${btnEdit}
          ${btnAprob}
          ${btnDel}
        </td>
      </tr>`;
    }).join('');
  }

  // Comentario del backend
  document.getElementById('indComentario').innerHTML = d.comentario
    ? `<div class="card"><div class="card-title">💬 Comentario</div><div style="font-size:13px;color:#475569">${d.comentario}</div></div>`
    : '';
}

function abrirEditarRegistro(id, observaciones) {
  sv('modalEditRegId', id);
  sv('modalEditRegObs', observaciones || '');
  document.getElementById('modalEditRegAlert').innerHTML = '';
  document.getElementById('modalEditReg').style.display = 'flex';
}

function cerrarModalEditReg(e) {
  if (e && e.target !== document.getElementById('modalEditReg')) return;
  document.getElementById('modalEditReg').style.display = 'none';
}

async function confirmarEditarRegistro() {
  const id  = v('modalEditRegId');
  const obs = v('modalEditRegObs');
  const al  = document.getElementById('modalEditRegAlert');
  try {
    const d = await apiPost({ action: 'horasEditar', usuario: USER.usuario, id, registro: { observaciones: obs } });
    if (!d.success) throw new Error(d.error || 'Error al guardar');
    document.getElementById('modalEditReg').style.display = 'none';
    await refrescarTrasMutacion();
  } catch (e) { al.innerHTML = `<div class="alert alert-err">❌ ${e.message}</div>`; }
}

async function eliminarRegistro(id) {
  if (!await appConfirm('¿Eliminar este registro? Esta acción es definitiva.')) return;
  try {
    const d = await apiPost({ action: 'horasEliminar', usuario: USER.usuario, id });
    if (!d.success) throw new Error(d.error || 'Error al eliminar');
    await refrescarTrasMutacion();
  } catch (e) { await appAlert('❌ ' + e.message); }
}

async function aprobarRegistro(id, recargarAprob) {
  if (ES_BASICO) { await appAlert('🔒 La aprobación está reservada al equipo administrativo.'); return; }
  try {
    const d = await apiPost({ action: 'horasAprobar', usuario: USER.usuario, id });
    if (!d.success) throw new Error(d.error || 'Error al aprobar');
    if (recargarAprob) await cargarAprobaciones();
    else await refrescarTrasMutacion();
  } catch (e) { await appAlert('❌ ' + e.message); }
}

async function refrescarTrasMutacion() {
  // Si hay un DNI cargado en individual, refrescarlo
  const dni = v('indDni').trim();
  if (/^\d{8}$/.test(dni)) await cargarResumenIndividual();
  // Invalidar otros tabs
  window.horasCache.tabsCargados.general = false;
  window.horasCache.tabsCargados.aprobaciones = false;
  // Si el trabajador del tab Registrar es el mismo, refrescar saldo
  const t = window.horasCache.trabajadorActual;
  if (t && t.dni) await cargarSaldoTrabajador(t.dni);
}

/* ─────────────── TAB 3: RESUMEN GENERAL ─────────────── */
async function cargarResumenGeneral() {
  const tb = document.getElementById('tbGeneral');
  if (tb) tb.innerHTML = '<tr><td colspan="8" class="empty">⏳ Cargando...</td></tr>';
  try {
    const d = await apiPost({ action: 'horasResumenGeneral' });
    if (!d.success) throw new Error(d.error || 'Error al cargar');
    window.horasCache.resumenGeneral = d.resumen || [];
    renderResumenGeneral(window.horasCache.resumenGeneral);
  } catch (e) {
    if (tb) tb.innerHTML = `<tr><td colspan="8" class="empty">❌ ${e.message}</td></tr>`;
  }
}

function renderResumenGeneral(rows) {
  const tb = document.getElementById('tbGeneral');
  if (!tb) return;
  if (!rows || !rows.length) { tb.innerHTML = '<tr><td colspan="8" class="empty">Sin trabajadores con registros</td></tr>'; return; }
  let totAcum = 0, totPerm = 0, totDeuda = 0, totSaldo = 0;
  const html = rows.map(r => {
    const acum = Number(r.acum || 0);
    const perm = Number(r.perm || 0);
    const deuda = Number(r.deuda || 0);
    const saldo = (r.saldo !== undefined) ? Number(r.saldo) : (acum - perm - deuda);
    totAcum += acum; totPerm += perm; totDeuda += deuda; totSaldo += saldo;
    let cls = '';
    if (saldo > 0) cls = 'row-green';
    else if (saldo > -4) cls = 'row-amber';
    else cls = 'row-red';
    return `<tr class="${cls}" style="cursor:pointer" onclick="abrirIndividualDesdeGeneral('${esc(r.dni)}')">
      <td>${r.dni || ''}</td>
      <td><b>${r.nombre || ''}</b></td>
      <td>${r.empresa || ''}</td>
      <td style="font-size:12px">${r.cargo || ''}</td>
      <td>${acum.toFixed(2)}</td>
      <td>${perm.toFixed(2)}</td>
      <td>${deuda.toFixed(2)}</td>
      <td style="font-weight:700">${saldo.toFixed(2)}</td>
    </tr>`;
  }).join('');
  const totalRow = `<tr class="row-totales">
    <td colspan="4" style="text-align:right">TOTALES</td>
    <td>${totAcum.toFixed(2)}</td>
    <td>${totPerm.toFixed(2)}</td>
    <td>${totDeuda.toFixed(2)}</td>
    <td>${totSaldo.toFixed(2)}</td>
  </tr>`;
  tb.innerHTML = html + totalRow;
}

function abrirIndividualDesdeGeneral(dni) {
  // Cambiar al tab individual y cargar
  const btn = document.querySelector('.tab-btn[data-tab="individual"]');
  showTab('individual', btn);
  sv('indDni', dni);
  cargarResumenIndividual();
}

/* ─────────────── TAB 4: APROBACIONES ─────────────── */
async function cargarAprobaciones() {
  const cont = document.getElementById('aprList');
  if (cont) cont.innerHTML = '<div class="empty">⏳ Cargando...</div>';
  try {
    const d = await apiPost({ action: 'horasListar', estado: 'pendiente', usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'Error al cargar');
    window.horasCache.aprobaciones = d.registros || [];
    renderAprobaciones(window.horasCache.aprobaciones);
  } catch (e) {
    if (cont) cont.innerHTML = `<div class="empty">❌ ${e.message}</div>`;
  }
}

function renderAprobaciones(registros) {
  const cont = document.getElementById('aprList');
  if (!cont) return;
  if (!registros || !registros.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-icon">✅</div>No hay registros pendientes de aprobación</div>';
    return;
  }
  cont.innerHTML = registros.map(r => `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:8px">
        <div>
          <div style="font-weight:700;color:#0a2463">${r.nombre || ''} <span style="font-weight:400;color:#64748b;font-size:12px">· DNI ${r.dni || ''}</span></div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${r.empresa || ''} · ${r.cargo || ''}</div>
        </div>
        <span class="badge badge-pend">Pendiente</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:13px;margin-bottom:10px">
        <div><b>Fecha:</b> ${formatFecha(r.fechaEntrada || r.fecha)}</div>
        <div><b>Motivo:</b> ${r.motivo || '-'}</div>
        <div><b>H. trab.:</b> ${num(r.horasTrabajadas)}</div>
        <div><b>Permiso:</b> ${num(r.horasPermiso)}</div>
      </div>
      ${r.observaciones ? `<div style="font-size:12px;color:#475569;margin-bottom:10px"><b>Obs:</b> ${r.observaciones}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-green btn-sm" onclick="aprobarRegistro('${esc(r.id)}', true)">✅ Aprobar</button>
        <button class="btn btn-red btn-sm"   onclick="rechazarRegistro('${esc(r.id)}')">❌ Rechazar</button>
      </div>
    </div>
  `).join('');
}

async function rechazarRegistro(id) {
  if (!await appConfirm('¿Rechazar (eliminar) este registro pendiente?')) return;
  try {
    const d = await apiPost({ action: 'horasEliminar', usuario: USER.usuario, id });
    if (!d.success) throw new Error(d.error || 'Error al rechazar');
    await cargarAprobaciones();
  } catch (e) { await appAlert('❌ ' + e.message); }
}

/* ─────────────── EXPORTACIONES ─────────────── */
async function _logoBase64() {
  try {
    const r = await fetch('../images/logo-unifrutti.jpg');
    const b = await r.blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}

async function exportarIndividualPDF() {
  const d = window.horasCache.resumenIndividual;
  if (!d) { await appAlert('Carga primero un DNI'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, mg = 12;
  let y = mg;
  const logo = await _logoBase64();
  doc.setFillColor(10, 36, 99); doc.rect(mg, y, W - 2*mg, 18, 'F');
  if (logo) { try { doc.addImage(logo, 'JPEG', mg+2, y+2, 24, 12); } catch(e){} }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
  doc.text('ACUMULACIÓN DE HORAS — Resumen individual', W/2, y+7, { align:'center' });
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  const primer = (d.registros && d.registros[0]) || {};
  doc.text(`${primer.nombre || ''} · DNI ${d.dni || ''} · ${primer.empresa || ''}`, W/2, y+13, { align:'center' });
  y += 22;
  const t = d.totales || {};
  doc.setTextColor(15, 23, 42); doc.setFontSize(10);
  doc.text(`Acumuladas: ${num(t.acum)}   Permiso: ${num(t.perm)}   Deuda: ${num(t.deuda)}   Saldo: ${num(t.saldo)}`, mg, y);
  y += 6;
  doc.autoTable({
    startY: y, margin: { left: mg, right: mg },
    head: [['Fecha','Motivo','H.Trab','Acum','Permiso','Deuda','Estado','Obs']],
    body: (d.registros || []).map(r => [
      formatFecha(r.fechaEntrada || r.fecha), r.motivo || '',
      num(r.horasTrabajadas), num(r.horasAcum), num(r.horasPermiso), num(r.horasDeuda),
      r.estado || '', r.observaciones || ''
    ]),
    styles: { font: 'helvetica', fontSize: 8 },
    headStyles: { fillColor: [10,36,99], textColor: 255 }
  });
  doc.save(`horas_individual_${d.dni || 'sin_dni'}.pdf`);
}

async function exportarIndividualExcel() {
  const d = window.horasCache.resumenIndividual;
  if (!d) { await appAlert('Carga primero un DNI'); return; }
  const rows = (d.registros || []).map(r => ({
    Fecha: formatFecha(r.fechaEntrada || r.fecha),
    Motivo: r.motivo || '',
    'H.Trabajadas': Number(r.horasTrabajadas || 0),
    Acumuladas: Number(r.horasAcum || 0),
    Permiso: Number(r.horasPermiso || 0),
    Deuda: Number(r.horasDeuda || 0),
    Estado: r.estado || '',
    Observaciones: r.observaciones || ''
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Registros');
  XLSX.writeFile(wb, `horas_individual_${d.dni || 'sin_dni'}.xlsx`);
}

async function exportarGeneralPDF() {
  const rows = window.horasCache.resumenGeneral;
  if (!rows || !rows.length) { await appAlert('No hay datos para exportar'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, mg = 12; let y = mg;
  const logo = await _logoBase64();
  doc.setFillColor(10, 36, 99); doc.rect(mg, y, W - 2*mg, 18, 'F');
  if (logo) { try { doc.addImage(logo, 'JPEG', mg+2, y+2, 24, 12); } catch(e){} }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
  doc.text('ACUMULACIÓN DE HORAS — Resumen general', W/2, y+9, { align: 'center' });
  y += 22;
  doc.autoTable({
    startY: y, margin: { left: mg, right: mg },
    head: [['DNI','Nombre','Empresa','Cargo','Acum','Permiso','Deuda','Saldo']],
    body: rows.map(r => {
      const acum = Number(r.acum || 0), perm = Number(r.perm || 0), deuda = Number(r.deuda || 0);
      const saldo = (r.saldo !== undefined) ? Number(r.saldo) : (acum - perm - deuda);
      return [r.dni || '', r.nombre || '', r.empresa || '', r.cargo || '',
              acum.toFixed(2), perm.toFixed(2), deuda.toFixed(2), saldo.toFixed(2)];
    }),
    styles: { font: 'helvetica', fontSize: 8 },
    headStyles: { fillColor: [10,36,99], textColor: 255 }
  });
  doc.save('horas_general.pdf');
}

async function exportarGeneralExcel() {
  const rows = window.horasCache.resumenGeneral;
  if (!rows || !rows.length) { await appAlert('No hay datos para exportar'); return; }
  const data = rows.map(r => {
    const acum = Number(r.acum || 0), perm = Number(r.perm || 0), deuda = Number(r.deuda || 0);
    const saldo = (r.saldo !== undefined) ? Number(r.saldo) : (acum - perm - deuda);
    return {
      DNI: r.dni || '', Nombre: r.nombre || '', Empresa: r.empresa || '', Cargo: r.cargo || '',
      Acumuladas: acum, Permiso: perm, Deuda: deuda, Saldo: saldo
    };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Resumen');
  XLSX.writeFile(wb, 'horas_general.xlsx');
}

/* ─────────────── HELPERS ─────────────── */
function v(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function num(x) { const n = Number(x); return isNaN(n) ? '0.00' : n.toFixed(2); }
function formatFecha(f) {
  if (!f) return '';
  if (typeof f === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.split('T')[0];
    return f;
  }
  try { const d = new Date(f); return isNaN(d.getTime()) ? String(f) : d.toISOString().split('T')[0]; }
  catch (e) { return String(f); }
}

function mostrarAlerta(wrapId, tipo, msg) {
  const el = document.getElementById(wrapId);
  if (!el) return;
  const cls = tipo === 'ok' ? 'alert-ok' : tipo === 'warn' ? 'alert-warn' : 'alert-err';
  el.innerHTML = `<div class="alert ${cls}">${msg}</div>`;
  if (tipo !== 'err') setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}
function limpiarAlerta(wrapId) { const el = document.getElementById(wrapId); if (el) el.innerHTML = ''; }

async function apiPost(b) {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify(b), headers: { 'Content-Type': 'text/plain' } });
  return r.json();
}


/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_PLANILLA_V1 (19-ago-2026) — Trabajadores que YA cobran horas en planilla
   ---------------------------------------------------------------------------
   LA TORRE GOMEZ MARCO ANTONIO (DNI 03209092, CHOFER) acumula horas aquí, pero
   ese mismo día se le pagan 2 horas en su boleta. Si nadie avisa, esas horas se
   terminan pagando dos veces.

   Esta parte hace DOS cosas, las dos en pantalla:
     1. Al digitar el DNI, sale un aviso rojo bien visible.
     2. En el cuadro de cálculo se muestra cuánto se va a acumular DE VERDAD.

   El descuento de verdad lo hace el servidor (horasRegistrarConPlanilla). Esto
   es para que quien registra vea lo mismo que va a quedar guardado, y no se
   lleve una sorpresa después.

   Todo va al final del archivo y envuelve a las funciones que ya existían, sin
   modificarlas: si algo falla, la pantalla sigue funcionando igual que antes.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Misma lista que el backend. Si agregas a alguien allá, agrégalo también aquí
   (allá manda; esto es solo el aviso en pantalla). */
var HORAS_PLANILLA_FRONT = {
  '03209092': 2      // LA TORRE GOMEZ MARCO ANTONIO — CHOFER — RAPEL
};

function _planillaPago(dni) {
  try {
    var d = String(dni == null ? '' : dni).trim();
    if (!d) return 0;
    if (HORAS_PLANILLA_FRONT[d]) return Number(HORAS_PLANILLA_FRONT[d]) || 0;
    var sin = d.replace(/^0+/, '');
    var con = ('00000000' + sin).slice(-8);
    return Number(HORAS_PLANILLA_FRONT[sin] || HORAS_PLANILLA_FRONT[con] || 0) || 0;
  } catch (e) { return 0; }
}

function _planillaQuitarAviso() {
  var el = document.getElementById('_avisoPlanilla');
  if (el && el.parentNode) el.parentNode.removeChild(el);
  var n = document.getElementById('_notaPlanilla');
  if (n && n.parentNode) n.parentNode.removeChild(n);
}

function _planillaPintarAviso(t) {
  _planillaQuitarAviso();
  if (!t) return;
  var pago = _planillaPago(t.dni);
  if (!pago) return;

  var cd = document.getElementById('cardDatos');
  if (!cd || !cd.parentNode) return;

  var nom = String(t.nombre || '').trim();
  var div = document.createElement('div');
  div.id = '_avisoPlanilla';
  div.style.cssText = 'background:#fef2f2;border:2px solid #dc2626;border-left-width:5px;' +
    'border-radius:10px;padding:13px 15px;margin:12px 0;font-size:13px;line-height:1.6;color:#7f1d1d;';
  div.innerHTML =
    '<div style="font-weight:800;color:#991b1b;margin-bottom:5px">' +
      '⚠️ ATENCIÓN — este trabajador cobra horas en planilla</div>' +
    'A <b>' + esc(nom) + '</b> (' + esc(String(t.cargo || '')) + ') se le pagan <b>' +
    pago.toFixed(2).replace('.00', '') + ' horas por día</b> en su boleta. ' +
    'El sistema va a descontar esas horas de la acumulación para que no se paguen dos veces. ' +
    'Solo se le acumula lo que pase de esas horas.';

  cd.parentNode.insertBefore(div, cd.nextSibling);
}

/* Debajo del cuadro de cálculo, mostrar lo que realmente se va a acumular. */
function _planillaAjustarCalc() {
  var n = document.getElementById('_notaPlanilla');
  if (n && n.parentNode) n.parentNode.removeChild(n);

  var t = window.horasCache && window.horasCache.trabajadorActual;
  if (!t) return;
  var pago = _planillaPago(t.dni);
  if (!pago) return;

  var motivo = String(v('regMotivo') || '').toLowerCase();
  if (motivo.indexOf('acumulaci') < 0) return;

  var elTrab = document.getElementById('calcTrab');
  var elJor  = document.getElementById('calcJornada');
  var elAcum = document.getElementById('calcAcum');
  if (!elTrab || !elJor || !elAcum) return;

  var trab = parseFloat(String(elTrab.textContent || '0').replace(',', '.')) || 0;
  var jor  = parseFloat(String(elJor.textContent  || '0').replace(',', '.')) || 0;
  if (!trab) return;

  var extra = Math.round((trab - jor) * 100) / 100;
  if (extra < 0) extra = 0;
  var desc  = Math.min(pago, extra);
  var queda = Math.round((extra - desc) * 100) / 100;
  if (queda < 0) queda = 0;

  var caja = elAcum.closest ? (elAcum.closest('.card') || elAcum.parentNode) : elAcum.parentNode;
  if (!caja) return;

  var d = document.createElement('div');
  d.id = '_notaPlanilla';
  d.style.cssText = 'background:#fff7ed;border:1.5px dashed #fb923c;border-radius:9px;' +
    'padding:11px 13px;margin-top:10px;font-size:12.5px;line-height:1.7;color:#7c2d12;';
  d.innerHTML =
    '<b>Cómo queda con el descuento de planilla</b><br>' +
    'Horas extra del período: <b>' + extra.toFixed(2) + ' h</b><br>' +
    '− Pagadas en planilla: <b style="color:#b91c1c">' + desc.toFixed(2) + ' h</b><br>' +
    'Se acumulará: <b style="color:#166534;font-size:14px">' + queda.toFixed(2) + ' h</b>';

  caja.appendChild(d);
}

/* Enganche: se envuelven las funciones existentes sin reescribirlas. */
(function () {
  try {
    var _apOrig = window._aplicarTrabajadorAlForm;
    if (typeof _apOrig === 'function') {
      window._aplicarTrabajadorAlForm = function (t) {
        var r = _apOrig.apply(this, arguments);
        try { _planillaPintarAviso(t); _planillaAjustarCalc(); } catch (e) {}
        return r;
      };
    }

    var _limOrig = window._limpiarTrabajadorEnForm;
    if (typeof _limOrig === 'function') {
      window._limpiarTrabajadorEnForm = function () {
        try { _planillaQuitarAviso(); } catch (e) {}
        return _limOrig.apply(this, arguments);
      };
    }

    var _recOrig = window.recalcularHoras;
    if (typeof _recOrig === 'function') {
      window.recalcularHoras = function () {
        var r = _recOrig.apply(this, arguments);
        try { _planillaAjustarCalc(); } catch (e) {}
        return r;
      };
    }
  } catch (e) { /* nunca romper la pantalla por el aviso */ }
})();
