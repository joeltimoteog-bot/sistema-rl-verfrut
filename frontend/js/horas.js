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

/* _ADMINS_REMUNERACIONES_V1 (21-ago-2026): se agregan los tres nuevos
   administradores de Remuneraciones. ovilela y jchavez se quedan porque
   conservan el modulo de Horas, pero como usuarios basicos (ver abajo). */
const USUARIOS_PERMITIDOS = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas', 'ovilela', 'jchavez', 'dsanchez', 'lmorales', 'jsiancas'];
// Acceso BÁSICO: solo pueden ver Registrar y Resumen Individual.
// (Resumen General, Aprobaciones y Config quedan ocultos y bloqueados.)
/* _ACCESOS_REMUNERACIONES_V1 (19-ago-2026)
   Al pasar el area a Remuneraciones, la nueva jefatura pidio quitarle el
   perfil de administrador a ovilela y jchavez. Quedan como usuarios comunes,
   igual que dsanchez: solo ven Registrar y Resumen Individual, y solo sus
   propios registros. Siguen entrando al modulo de Horas con normalidad.
   ANTES: ['dsanchez', 'lmorales', 'jsiancas'] */
const USUARIOS_BASICOS = ['dsanchez', 'lmorales', 'jsiancas', 'ovilela', 'jchavez'];
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
      /* _CALCULO_REFRIGERIO_V1 (22-ago-2026) — YA NO se restan los 45 minutos.
         ANTES:  horasTrab = bruto >= 5 ? bruto - 0.75 : bruto;
         POR QUE: la jornada esperada que devuelve el backend ya trae el
         refrigerio adentro (8.75 h de lunes a viernes = 8 h de trabajo + 0.75
         de refrigerio; 5.75 el sabado). Al restar los 45 min aca ademas, se
         descontaban DOS VECES y a cada trabajador se le comian 45 minutos de
         cada acumulacion. Ahora se compara presencia contra presencia. */
      horasTrab = bruto;
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

  /* _CALCULO_REFRIGERIO_V1 — BUG GRAVE CORREGIDO.
     calcTrab y calcPerm son <div class="stat-val"> (horas.html 252-255), no
     son campos de formulario. v() lee .value, que en un <div> es undefined,
     asi que SIEMPRE se mandaba 0 al servidor. Y el servidor, al recibir el
     permiso en 0, lo reemplazaba por la jornada COMPLETA (codigo.gs 6477):
     alguien pedia 3 h de permiso y se le cobraban 8.75 h, generandole una
     deuda que nunca contrajo. Ahora se lee el texto que se ve en pantalla. */
  const horasTrab = _numCalc('calcTrab');
  const horasPerm = _numCalc('calcPerm');

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
/* _CALCULO_REFRIGERIO_V1 — lee un numero de un cuadro de calculo, sirva o no
   como campo de formulario. Acepta coma decimal y textos como "8.75 h". */
function _numCalc(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  let txt = (el.value !== undefined && el.value !== null && el.value !== '')
            ? el.value : (el.textContent || '');
  txt = String(txt).replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(txt);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}
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


/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_POR_USUARIO_V1 (19-ago-2026) — Ver los registros separados por quién
   los hizo (pestaña "Por Usuario", solo administradores)
   ---------------------------------------------------------------------------
   NO NECESITA NINGÚN CAMBIO EN APPS SCRIPT. La hoja "registros" ya guarda en
   la columna C quién hizo cada registro (REGISTRADO_POR), y horasListar ya lo
   devuelve como "registradoPor". Acá solo se agrupa y se muestra.

   La pestaña queda dentro de TABS_SOLO_ADMIN, así que dsanchez, lmorales y
   jsiancas no la ven ni la pueden abrir escribiendo la dirección.
   ═══════════════════════════════════════════════════════════════════════════ */

try { if (TABS_SOLO_ADMIN.indexOf('usuarios') < 0) TABS_SOLO_ADMIN.push('usuarios'); } catch (e) {}

window.horasCache.porUsuario   = null;
window.horasCache.usrSeleccion = null;

/* Trae TODOS los registros una sola vez y los deja en memoria. */
async function cargarPorUsuario(forzar) {
  const cont = document.getElementById('usrCards');
  if (!cont) return;
  if (window.horasCache.porUsuario && !forzar) { renderPorUsuario(); return; }

  cont.innerHTML = '<div class="empty">⏳ Cargando registros...</div>';
  try {
    const d = await apiPost({ action: 'horasListar', usuario: USER.usuario });
    if (!d.success) throw new Error(d.error || 'No se pudieron cargar los registros');
    window.horasCache.porUsuario = d.registros || [];
    renderPorUsuario();
  } catch (e) {
    cont.innerHTML = '<div class="empty">❌ ' + esc(e.message || 'Error de conexión') + '</div>';
  }
}

/* Fecha del registro en formato AAAA-MM-DD (usa la de entrada; si no, la de registro). */
function _usrFecha(r) {
  const f = formatFecha(r.fechaEntrada || r.fechaRegistro || '');
  return String(f || '').substring(0, 10);
}

function _usrEnPeriodo(r, periodo) {
  if (periodo === 'todo') return true;
  const f = _usrFecha(r);
  if (!f) return false;
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm   = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd   = String(hoy.getDate()).padStart(2, '0');
  if (periodo === 'hoy')  return f === yyyy + '-' + mm + '-' + dd;
  if (periodo === 'mes')  return f.substring(0, 7) === yyyy + '-' + mm;
  if (periodo === 'anio') return f.substring(0, 4) === String(yyyy);
  return true;
}

function _usrClave(r) {
  return String(r.registradoPor || '').trim().toLowerCase() || '(sin dato)';
}

/* Agrupa por usuario y pinta las tarjetas. */
function renderPorUsuario() {
  const cont = document.getElementById('usrCards');
  if (!cont) return;
  const todos = window.horasCache.porUsuario || [];
  const periodo = v('usrPeriodo') || 'mes';
  const lista = todos.filter(r => _usrEnPeriodo(r, periodo));

  if (!lista.length) {
    cont.innerHTML = '<div class="empty">Sin registros en el período seleccionado.</div>';
    cerrarDetalleUsuario();
    return;
  }

  const grupos = {};
  lista.forEach(r => {
    const k = _usrClave(r);
    if (!grupos[k]) grupos[k] = { usuario: k, n: 0, acum: 0, perm: 0, trab: {}, ultima: '' };
    const g = grupos[k];
    g.n++;
    g.acum += Number(r.horasAcumuladas) || 0;
    g.perm += Number(r.horasPermiso) || 0;
    if (r.dni) g.trab[String(r.dni).trim()] = 1;
    const f = _usrFecha(r);
    if (f > g.ultima) g.ultima = f;
  });

  const arr = Object.keys(grupos).map(k => grupos[k]).sort((a, b) => b.n - a.n);
  const colores = ['#7c3aed', '#0891b2', '#0d9488', '#ca8a04', '#be185d', '#4f46e5', '#64748b'];

  cont.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px">' +
    arr.map((g, i) => {
      const col = colores[i % colores.length];
      const ini = g.usuario.substring(0, 2).toUpperCase();
      const sel = window.horasCache.usrSeleccion === g.usuario;
      return '<div onclick="verDetalleUsuario(\'' + esc(g.usuario) + '\')" ' +
        'style="border:' + (sel ? '2px solid ' + col : '1px solid #e2e8f0') + ';border-radius:12px;' +
        'padding:13px;background:#fff;cursor:pointer;transition:.15s">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">' +
          '<span style="width:28px;height:28px;border-radius:50%;background:' + col + ';color:#fff;' +
          'display:inline-flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800">' + ini + '</span>' +
          '<b style="color:#0a2463;font-size:13.5px">' + esc(g.usuario) + '</b></div>' +
        '<div style="font-size:11px;color:#94a3b8;margin-bottom:9px">último registro: ' + (g.ultima || '—') + '</div>' +
        _usrLinea('Registros', g.n, '#0a2463') +
        _usrLinea('Trabajadores distintos', Object.keys(g.trab).length, '#0a2463') +
        _usrLinea('Horas acumuladas', (Math.round(g.acum * 100) / 100).toFixed(2), '#16a34a') +
        _usrLinea('Horas de permiso', (Math.round(g.perm * 100) / 100).toFixed(2), '#dc2626') +
      '</div>';
    }).join('') + '</div>' +
    '<div style="margin-top:12px;font-size:12px;color:#64748b">' +
      'Total del período: <b style="color:#0a2463">' + lista.length + '</b> registros de <b style="color:#0a2463">' +
      arr.length + '</b> usuario(s).</div>';

  if (window.horasCache.usrSeleccion) verDetalleUsuario(window.horasCache.usrSeleccion);
}

function _usrLinea(txt, val, color) {
  return '<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:2.5px 0;color:#334155">' +
    '<span>' + txt + '</span><b style="color:' + color + '">' + val + '</b></div>';
}

/* Detalle de un usuario: sus registros del período. */
function verDetalleUsuario(usuario) {
  window.horasCache.usrSeleccion = usuario;
  const card = document.getElementById('usrDetalleCard');
  const tb   = document.getElementById('tbUsrDetalle');
  const nom  = document.getElementById('usrDetalleNom');
  if (!card || !tb) return;

  const periodo = v('usrPeriodo') || 'mes';
  const lista = (window.horasCache.porUsuario || [])
    .filter(r => _usrClave(r) === usuario && _usrEnPeriodo(r, periodo))
    .sort((a, b) => String(_usrFecha(b)).localeCompare(String(_usrFecha(a))));

  if (nom) nom.textContent = usuario + ' (' + lista.length + ' registros)';
  card.style.display = '';

  tb.innerHTML = lista.length ? lista.map(r => {
    const acum = Number(r.horasAcumuladas) || 0;
    const perm = Number(r.horasPermiso) || 0;
    const est  = String(r.estado || 'aprobado');
    return '<tr>' +
      '<td>' + formatFecha(r.fechaEntrada || r.fechaRegistro) + '</td>' +
      '<td>' + esc(String(r.dni || '')) + '</td>' +
      '<td><b>' + esc(String(r.nombre || '')) + '</b></td>' +
      '<td style="font-size:12px">' + esc(String(r.cargo || '')) + '</td>' +
      '<td style="font-size:12px">' + esc(String(r.motivo || '')) + '</td>' +
      '<td style="text-align:right;font-weight:700;color:#16a34a">' + acum.toFixed(2) + '</td>' +
      '<td style="text-align:right;font-weight:700;color:#dc2626">' + perm.toFixed(2) + '</td>' +
      '<td style="font-size:12px">' + esc(est) + '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="8" class="empty">Sin registros en este período.</td></tr>';

  try { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
}

function cerrarDetalleUsuario() {
  window.horasCache.usrSeleccion = null;
  const card = document.getElementById('usrDetalleCard');
  if (card) card.style.display = 'none';
  const cont = document.getElementById('usrCards');
  if (cont && window.horasCache.porUsuario) renderPorUsuario();
}

function exportarPorUsuarioExcel() {
  const todos = window.horasCache.porUsuario || [];
  const periodo = v('usrPeriodo') || 'mes';
  const lista = todos.filter(r => _usrEnPeriodo(r, periodo));
  if (!lista.length) { mostrarAlerta('alRegistro', 'err', 'No hay datos para exportar'); return; }

  const data = lista
    .sort((a, b) => String(_usrClave(a)).localeCompare(String(_usrClave(b))))
    .map(r => ({
      'Registrado por': _usrClave(r),
      Fecha:            formatFecha(r.fechaEntrada || r.fechaRegistro),
      DNI:              String(r.dni || ''),
      Trabajador:       String(r.nombre || ''),
      Empresa:          String(r.empresa || ''),
      Cargo:            String(r.cargo || ''),
      Motivo:           String(r.motivo || ''),
      Acumuladas:       Number(r.horasAcumuladas) || 0,
      Permiso:          Number(r.horasPermiso) || 0,
      Estado:           String(r.estado || 'aprobado'),
      Observaciones:    String(r.observaciones || '')
    }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Por usuario');
  XLSX.writeFile(wb, 'horas_por_usuario_' + periodo + '.xlsx');
}

/* Enganche a showTab: carga la pestaña la primera vez que se abre. */
(function () {
  try {
    const _stOrig = window.showTab;
    if (typeof _stOrig !== 'function') return;
    window.showTab = function (tab, btn) {
      const r = _stOrig.apply(this, arguments);
      try {
        if (tab === 'usuarios' && !ES_BASICO) {
          const c = window.horasCache.tabsCargados;
          if (c && !c.usuarios) { cargarPorUsuario(); c.usuarios = true; }
          else { renderPorUsuario(); }
        }
      } catch (e) {}
      return r;
    };
  } catch (e) {}
})();


/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_PLANILLA_V3 (19-ago-2026) — Devolución de horas pagadas: aviso,
   mensaje al usuario y resumen por quincena
   ---------------------------------------------------------------------------
   CAMBIO DE ENFOQUE respecto a la versión anterior: la acumulación ya NO se
   recorta. Se registra COMPLETA (el señor entra 6:15 y sale 22:00, esas son
   sus horas), y el servidor agrega un segundo registro de "Devolución de
   horas pagadas" por las 2 h que sí se le pagan en planilla según ley.

   Acá se hacen tres cosas, todas de pantalla:
     1. El aviso al digitar el DNI, ya con el texto correcto.
     2. El mensaje explicativo a quien registra, apenas guarda.
     3. En el Resumen Individual: acumuladas / pagadas / saldo real, y el
        detalle cortado por quincena para que cuadre con planilla.

   Todo sobreescribe funciones anteriores sin borrarlas y va envuelto en
   try/catch: si algo falla, la pantalla sigue funcionando igual que antes.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ¿Es un registro de devolución de horas PAGADAS? (no un permiso común) */
function _esDevolucionPagada(r) {
  try {
    var m = String((r && r.motivo) || '').toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (m.indexOf('pagad') >= 0) return true;                       // "devolucion de horas pagadas"
    var a = String((r && r.alerta) || '').toLowerCase();
    return a.indexOf('devolucion automatica') >= 0 || a.indexOf('devolución automática') >= 0;
  } catch (e) { return false; }
}

/* Quincena a la que pertenece un registro: "2026-08 · 2ª quincena" */
function _quincenaDe(r) {
  try {
    var f = String(formatFecha(r.fechaEntrada || r.fechaRegistro) || '').substring(0, 10);
    if (f.length < 10) return '';
    var dia = parseInt(f.substring(8, 10), 10);
    if (!dia) return '';
    return f.substring(0, 7) + (dia <= 15 ? ' · 1ª quincena' : ' · 2ª quincena');
  } catch (e) { return ''; }
}

/* ── 1) Aviso al digitar el DNI — _SALUDO_DNI_V4: saluda por su nombre ── */
function _planillaNombreUsuario() {
  try {
    var n = String((USER && (USER.nombre || USER.usuario)) || '').trim().split(' ')[0];
    if (!n) return '';
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  } catch (e) { return ''; }
}

_planillaPintarAviso = function (t) {
  try {
    _planillaQuitarAviso();
    if (!t) return;
    var pago = _planillaPago(t.dni);
    if (!pago) return;
    var cd = document.getElementById('cardDatos');
    if (!cd || !cd.parentNode) return;

    var horas = pago.toFixed(2).replace('.00', '');
    var quien = _planillaNombreUsuario();

    var div = document.createElement('div');
    div.id = '_avisoPlanilla';
    div.style.cssText = 'background:#eff6ff;border:2px solid #1e40af;border-left-width:5px;' +
      'border-radius:10px;padding:14px 16px;margin:12px 0;font-size:13px;line-height:1.7;color:#1e3a5f;';
    div.innerHTML =
      '<div style="font-weight:800;color:#1e40af;font-size:14px;margin-bottom:6px">' +
        'Hola ' + esc(quien || '') + ' 👋 — ten en cuenta con este trabajador</div>' +
      '<b>' + esc(String(t.nombre || '')) + '</b> está <b>programado</b>. Por su función ' +
      '(visitas a caseríos y campo) se le registra la <b>cantidad total de horas</b> que permanece, ' +
      'pero por ley solo se le pueden pagar <b>' + horas + ' horas extras diarias</b>.<br><br>' +
      'Registra la acumulación <b>completa</b>, como siempre. El sistema genera solo el registro de ' +
      '<b>devolución de esas ' + horas + ' h que se le pagan</b> en su boleta, así su saldo queda correcto.<br><br>' +
      '📊 En el <b>Resumen Individual</b> vas a ver por separado sus <b>horas acumuladas</b> y sus ' +
      '<b>horas pagadas</b>, con el corte <b>por quincena</b>, y lo puedes exportar cuando lo necesites.';
    cd.parentNode.insertBefore(div, cd.nextSibling);
  } catch (e) {}
};

/* ── 2) Nota bajo el cálculo: cómo va a quedar ── */
_planillaAjustarCalc = function () {
  try {
    var n = document.getElementById('_notaPlanilla');
    if (n && n.parentNode) n.parentNode.removeChild(n);

    var t = window.horasCache && window.horasCache.trabajadorActual;
    if (!t) return;
    var pago = _planillaPago(t.dni);
    if (!pago) return;
    if (String(v('regMotivo') || '').toLowerCase().indexOf('acumulaci') < 0) return;

    var elTrab = document.getElementById('calcTrab');
    var elJor  = document.getElementById('calcJornada');
    var elAcum = document.getElementById('calcAcum');
    if (!elTrab || !elJor || !elAcum) return;

    var trab = parseFloat(String(elTrab.textContent || '0').replace(',', '.')) || 0;
    var jor  = parseFloat(String(elJor.textContent  || '0').replace(',', '.')) || 0;
    if (!trab) return;

    var acum = Math.round((trab - jor) * 100) / 100; if (acum < 0) acum = 0;
    var dev  = Math.min(pago, acum);
    var neto = Math.round((acum - dev) * 100) / 100; if (neto < 0) neto = 0;

    var caja = elAcum.closest ? (elAcum.closest('.card') || elAcum.parentNode) : elAcum.parentNode;
    if (!caja) return;

    var d = document.createElement('div');
    d.id = '_notaPlanilla';
    d.style.cssText = 'background:#f8fafc;border:1.5px dashed #94a3b8;border-radius:9px;' +
      'padding:11px 13px;margin-top:10px;font-size:12.5px;line-height:1.8;color:#334155;';
    d.innerHTML =
      '<b>Así van a quedar los dos registros</b><br>' +
      '1️⃣ Acumulación (completa): <b style="color:#166534">' + acum.toFixed(2) + ' h</b><br>' +
      '2️⃣ Devolución de horas pagadas: <b style="color:#b91c1c">' + dev.toFixed(2) + ' h</b><br>' +
      'Saldo a favor de este día: <b style="color:#0a2463;font-size:14px">' + neto.toFixed(2) + ' h</b>';
    caja.appendChild(d);
  } catch (e) {}
};

/* ── 3) Mensaje al usuario apenas guarda ── */
function _planillaMostrarMensaje(p) {
  try {
    if (!p || !p.mensaje) return;
    var viejo = document.getElementById('_planillaModal');
    if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);

    var nombreUsr = String((USER && (USER.nombre || USER.usuario)) || '').trim().split(' ')[0];
    if (nombreUsr) nombreUsr = nombreUsr.charAt(0).toUpperCase() + nombreUsr.slice(1).toLowerCase();

    var ov = document.createElement('div');
    ov.id = '_planillaModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,17,.55);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:20px 22px;' +
      'box-shadow:0 18px 50px rgba(0,0,0,.3);font-size:13.5px;line-height:1.7;color:#334155">' +
        '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:19px;font-weight:800;color:#0a2463;margin-bottom:4px">' +
          '📌 ' + esc(p.titulo || 'Trabajador programado') + '</div>' +
        '<div style="margin-bottom:12px;color:#0a2463;font-weight:700">Hola ' + esc(nombreUsr || '') + ' 👋</div>' +
        '<div style="white-space:pre-line;margin-bottom:14px">' + esc(p.mensaje) + '</div>' +
        '<div style="background:#f8fafc;border-radius:9px;padding:11px 13px;margin-bottom:16px;font-size:12.5px">' +
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>Acumulación registrada</span><b style="color:#166534">' + Number(p.acumulado || 0).toFixed(2) + ' h</b></div>' +
          '<div style="display:flex;justify-content:space-between;padding:2px 0"><span>Devolución por horas pagadas</span><b style="color:#b91c1c">' + Number(p.devuelto || 0).toFixed(2) + ' h</b></div>' +
          '<div style="display:flex;justify-content:space-between;padding:5px 0 0;border-top:1px solid #e2e8f0;margin-top:4px"><span><b>Le queda a favor</b></span><b style="color:#0a2463;font-size:14px">' + Number(p.saldoNeto || 0).toFixed(2) + ' h</b></div>' +
        '</div>' +
        '<div style="text-align:right"><button type="button" id="_planillaOk" class="btn btn-primary btn-sm">Entendido</button></div>' +
      '</div>';
    document.body.appendChild(ov);
    var b = document.getElementById('_planillaOk');
    if (b) b.addEventListener('click', function () { if (ov.parentNode) ov.parentNode.removeChild(ov); });
  } catch (e) {}
}

/* ── 4) Resumen Individual: tres cifras + corte por quincena ── */
function _planillaPanelResumen(d) {
  try {
    var viejo = document.getElementById('_panelPlanilla');
    if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);

    var regs = (d && d.registros) || [];
    if (!regs.length) return;

    var pagadas = 0, acum = 0, permiso = 0, deuda = 0;
    var quincenas = {};
    regs.forEach(function (r) {
      var a = Number(r.horasAcumuladas) || 0;
      var p = Number(r.horasPermiso)    || 0;
      var u = Number(r.horasDeuda)      || 0;
      acum += a; deuda += u;
      var esPag = _esDevolucionPagada(r);
      if (esPag) pagadas += p; else permiso += p;

      var q = _quincenaDe(r);
      if (!q) return;
      if (!quincenas[q]) quincenas[q] = { acum: 0, pag: 0, perm: 0 };
      quincenas[q].acum += a;
      if (esPag) quincenas[q].pag += p; else quincenas[q].perm += p;
    });

    if (pagadas <= 0) return;                    // trabajador normal: no se muestra nada

    var saldo = Math.round((acum - pagadas - permiso - deuda) * 100) / 100;
    var cont = document.getElementById('indSaldos');
    if (!cont) return;

    var claves = Object.keys(quincenas).sort().reverse().slice(0, 8);

    var box = document.createElement('div');
    box.id = '_panelPlanilla';
    box.className = 'card';
    box.style.cssText = 'border-left:4px solid #1e40af;margin-bottom:14px';
    box.innerHTML =
      '<div class="card-title" style="margin-bottom:8px">📌 Trabajador programado — horas extras pagadas</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">' +
        _planillaCifra('Acumuladas (total)', acum, '#166534') +
        _planillaCifra('Pagadas en planilla', pagadas, '#b91c1c') +
        _planillaCifra('Saldo real a favor', saldo, saldo < 0 ? '#b91c1c' : '#0a2463') +
      '</div>' +
      '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Detalle por quincena</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th>Quincena</th><th style="text-align:right">Acumuladas</th>' +
        '<th style="text-align:right">Pagadas</th><th style="text-align:right">Permiso</th>' +
        '<th style="text-align:right">Neto</th></tr></thead><tbody>' +
      claves.map(function (q) {
        var x = quincenas[q];
        var neto = Math.round((x.acum - x.pag - x.perm) * 100) / 100;
        return '<tr><td><b>' + esc(q) + '</b></td>' +
          '<td style="text-align:right;color:#166534;font-weight:700">' + x.acum.toFixed(2) + '</td>' +
          '<td style="text-align:right;color:#b91c1c;font-weight:700">' + x.pag.toFixed(2) + '</td>' +
          '<td style="text-align:right;color:#64748b">' + x.perm.toFixed(2) + '</td>' +
          '<td style="text-align:right;font-weight:800;color:#0a2463">' + neto.toFixed(2) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div style="font-size:12px;color:#64748b;margin-top:8px">' +
        'Las horas <b>pagadas</b> ya se le abonaron en su boleta, por eso no cuentan en el saldo a favor. ' +
        'Cada una tiene su registro de <i>devolución de horas pagadas</i> en la tabla de abajo.</div>';

    cont.parentNode.insertBefore(box, cont.nextSibling);
  } catch (e) {}
}

function _planillaCifra(txt, val, color) {
  return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px">' +
    '<div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px">' + txt + '</div>' +
    '<div style="font-size:19px;font-weight:800;color:' + color + ';margin-top:2px">' + Number(val || 0).toFixed(2) + '</div></div>';
}

/* ── 5) Enganches ── */
(function () {
  try {
    var _ultimaPlanilla = null;

    var _apiOrig = window.apiPost;
    if (typeof _apiOrig === 'function') {
      window.apiPost = function (b) {
        return _apiOrig.apply(this, arguments).then(function (res) {
          try { if (b && b.action === 'horasRegistrar') _ultimaPlanilla = (res && res.planilla) || null; } catch (e) {}
          return res;
        });
      };
    }

    var _regOrig = window.registrarHoras;
    if (typeof _regOrig === 'function') {
      window.registrarHoras = function () {
        _ultimaPlanilla = null;
        var p = _regOrig.apply(this, arguments);
        return Promise.resolve(p).then(function (r) {
          try { if (_ultimaPlanilla) _planillaMostrarMensaje(_ultimaPlanilla); } catch (e) {}
          return r;
        });
      };
    }

    var _rriOrig = window.renderResumenIndividual;
    if (typeof _rriOrig === 'function') {
      window.renderResumenIndividual = function (d) {
        var r = _rriOrig.apply(this, arguments);
        try { _planillaPanelResumen(d); } catch (e) {}
        return r;
      };
    }
  } catch (e) {}
})();


/* ═══════════════════════════════════════════════════════════════════════════
   _HORARIOS_UI_V1 (31-ago-2026) — administrar los horarios de jornada

   Vive en la pestaña Config, que ya es solo para administradores.

   POR QUE ASI Y NO ELIGIENDO EL HORARIO AL ENTRAR
   ---------------------------------------------------------------------------
   El horario NO se elige en cada sesion. Si dos personas eligieran horarios
   distintos el mismo dia, el mismo trabajador saldria con acumulaciones
   diferentes segun quien lo registro. Y al recalcular un registro viejo se
   usaria el horario de hoy, no el que regia entonces.

   Por eso es una regla de la empresa CON FECHA DESDE CUANDO RIGE. Se define
   una vez, vale para todos, y lo anterior queda congelado.
   ═══════════════════════════════════════════════════════════════════════════ */

function hjMin(hhmm) {
  var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59) return -1;
  return h * 60 + mi;
}

function hjNetasUI(ent, sal, ref) {
  var e = hjMin(ent), s = hjMin(sal);
  if (e < 0 || s < 0 || s <= e) return 0;
  var n = (s - e - (Number(ref) || 0)) / 60;
  return n > 0 ? Math.round(n * 100) / 100 : 0;
}

/* Muestra en vivo cuantas horas quedan mientras se escribe */
function hjPreview() {
  var el = document.getElementById('hjPreview');
  if (!el) return;
  var lv  = hjNetasUI(v('hjLvEnt'),  v('hjLvSal'),  v('hjLvRef'));
  var sab = hjNetasUI(v('hjSabEnt'), v('hjSabSal'), v('hjSabRef'));
  var sem = Math.round((lv * 5 + sab) * 100) / 100;

  if (lv <= 0) {
    el.style.background = '#fef2f2'; el.style.borderColor = '#fecaca'; el.style.color = '#991b1b';
    el.innerHTML = 'Revisa las horas de lunes a viernes: con lo que hay, la jornada queda en cero.';
    return;
  }
  var aviso = '';
  if (sem > 48.001) {
    el.style.background = '#fffbeb'; el.style.borderColor = '#fde68a'; el.style.color = '#92400e';
    aviso = ' &nbsp;·&nbsp; ⚠️ pasa de las 48 horas semanales';
  } else {
    el.style.background = '#eff6ff'; el.style.borderColor = '#bfdbfe'; el.style.color = '#1e40af';
  }
  el.innerHTML = 'Lunes a viernes <b>' + lv.toFixed(2) + ' h</b>' +
                 ' &nbsp;·&nbsp; sábado <b>' + (sab > 0 ? sab.toFixed(2) + ' h' : 'descansa') + '</b>' +
                 ' &nbsp;·&nbsp; semana <b>' + sem.toFixed(2) + ' h</b>' + aviso;
}

async function hjCargar() {
  var tb = document.getElementById('tbHorarios');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="9" class="empty">⏳ Cargando...</td></tr>';
  try {
    var d = await apiPost({ action: 'horariosListar', usuario: USER.usuario });
    if (!d.success) {
      tb.innerHTML = '<tr><td colspan="9" class="empty">' + (d.error || 'No se pudo cargar') + '</td></tr>';
      return;
    }
    window._hjLista = d.horarios || [];
    if (!window._hjLista.length) {
      tb.innerHTML = '<tr><td colspan="9" class="empty">Todavía no hay horarios cargados. Agrega el primero abajo.</td></tr>';
      return;
    }
    tb.innerHTML = window._hjLista.slice().reverse().map(function (x) {
      var lvTxt  = x.lvEntrada + ' a ' + x.lvSalida;
      var sabTxt = (x.sabEntrada && x.sabEntrada !== '—')
        ? (x.sabEntrada + ' a ' + x.sabSalida) : '<span style="color:#94a3b8">descansa</span>';
      return '<tr' + (x.vigente ? ' style="background:#f0fdf4"' : '') + '>' +
        '<td><b>' + x.desde + '</b>' +
          (x.vigente ? ' <span style="background:#16a34a;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:800">VIGENTE</span>' : '') + '</td>' +
        '<td>' + (x.hasta || '<span style="color:#94a3b8">—</span>') + '</td>' +
        '<td>' + lvTxt + '</td><td style="text-align:center;font-weight:700">' + Number(x.horasLV).toFixed(2) + '</td>' +
        '<td>' + sabTxt + '</td><td style="text-align:center;font-weight:700">' + Number(x.horasSab).toFixed(2) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + Number(x.horasSemana).toFixed(2) + '</td>' +
        '<td style="text-align:center">' + (x.accesoActivo
            ? '<span style="color:#dc2626;font-weight:700">limita entrada</span>'
            : '<span style="color:#94a3b8">no limita</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-gray"  style="padding:3px 9px;font-size:11px" onclick="hjEditar(' + x.fila + ')">✏️</button> ' +
          '<button class="btn btn-red"   style="padding:3px 9px;font-size:11px" onclick="hjEliminar(' + x.fila + ')">🗑️</button>' +
        '</td></tr>';
    }).join('');
  } catch (e) {
    tb.innerHTML = '<tr><td colspan="9" class="empty">Error de conexión</td></tr>';
  }
}

function hjLimpiarForm() {
  sv('hjFila', ''); sv('hjDesde', ''); sv('hjHasta', '');
  sv('hjLvEnt', '06:15'); sv('hjLvSal', '16:36'); sv('hjLvRef', '45');
  sv('hjSabEnt', ''); sv('hjSabSal', ''); sv('hjSabRef', '0');
  sv('hjNota', ''); sv('hjAccesoMargen', '60');
  var c = document.getElementById('hjAccesoActivo'); if (c) c.checked = false;
  var t = document.getElementById('hjFormTitulo'); if (t) t.textContent = '➕ Nuevo horario';
  hjPreview();
}

function hjEditar(fila) {
  var x = (window._hjLista || []).filter(function (h) { return h.fila === fila; })[0];
  if (!x) return;
  sv('hjFila', String(fila));
  sv('hjDesde', x.desde); sv('hjHasta', x.hasta || '');
  sv('hjLvEnt', x.lvEntrada === '—' ? '' : x.lvEntrada);
  sv('hjLvSal', x.lvSalida === '—' ? '' : x.lvSalida);
  sv('hjLvRef', String(x.lvRefrigMin));
  sv('hjSabEnt', x.sabEntrada === '—' ? '' : x.sabEntrada);
  sv('hjSabSal', x.sabSalida === '—' ? '' : x.sabSalida);
  sv('hjSabRef', String(x.sabRefrigMin));
  sv('hjNota', x.nota || ''); sv('hjAccesoMargen', String(x.accesoMargen));
  var c = document.getElementById('hjAccesoActivo'); if (c) c.checked = !!x.accesoActivo;
  var t = document.getElementById('hjFormTitulo'); if (t) t.textContent = '✏️ Editando el horario del ' + x.desde;
  hjPreview();
  var card = document.getElementById('hjFormTitulo');
  if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function hjGuardar() {
  var desde = v('hjDesde');
  if (!desde) { mostrarAlerta('alHorarios', 'err', 'Indica desde qué día rige este horario.'); return; }

  var lv = hjNetasUI(v('hjLvEnt'), v('hjLvSal'), v('hjLvRef'));
  if (lv <= 0) { mostrarAlerta('alHorarios', 'err', 'Revisa las horas de lunes a viernes: la jornada queda en cero.'); return; }

  var acceso = !!(document.getElementById('hjAccesoActivo') || {}).checked;
  if (acceso) {
    var ok = await appConfirm(
      'Vas a activar el control de entrada al sistema con este horario.\n\n' +
      'Fuera de la franja ' + v('hjLvEnt') + ' a ' + v('hjLvSal') +
      ' (más ' + (v('hjAccesoMargen') || '60') + ' minutos de tolerancia), NADIE podrá iniciar sesión.\n\n' +
      '¿Estás seguro de que el horario es correcto?');
    if (!ok) return;
  }

  var btn = document.getElementById('hjBtnGuardar');
  if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }
  try {
    var d = await apiPost({
      action: 'horariosGuardar', usuario: USER.usuario,
      horario: {
        fila: v('hjFila') || 0, desde: desde, hasta: v('hjHasta'),
        lvEntrada: v('hjLvEnt'), lvSalida: v('hjLvSal'), lvRefrigMin: v('hjLvRef'),
        sabEntrada: v('hjSabEnt'), sabSalida: v('hjSabSal'), sabRefrigMin: v('hjSabRef'),
        accesoActivo: acceso, accesoMargen: v('hjAccesoMargen'), nota: v('hjNota')
      }
    });
    if (!d.success) { mostrarAlerta('alHorarios', 'err', d.error || 'No se pudo guardar'); return; }
    mostrarAlerta('alHorarios', 'ok',
      'Horario guardado. Lunes a viernes ' + Number(d.horasLV).toFixed(2) + ' h' +
      (d.horasSab > 0 ? ', sábado ' + Number(d.horasSab).toFixed(2) + ' h' : ', sábado descansa') + '.');
    hjLimpiarForm();
    hjCargar();
  } catch (e) {
    mostrarAlerta('alHorarios', 'err', 'Error de conexión');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '💾 Guardar horario'; }
  }
}

async function hjEliminar(fila) {
  var x = (window._hjLista || []).filter(function (h) { return h.fila === fila; })[0];
  if (!x) return;
  var ok = await appConfirm('¿Eliminar el horario que rige desde el ' + x.desde + '?\n\n' +
                            'Los registros ya guardados no cambian, pero los cálculos nuevos\n' +
                            'de esas fechas pasarán a usar otro horario.');
  if (!ok) return;
  var d = await apiPost({ action: 'horariosEliminar', usuario: USER.usuario, fila: fila });
  if (!d.success) { mostrarAlerta('alHorarios', 'err', d.error || 'No se pudo eliminar'); return; }
  mostrarAlerta('alHorarios', 'ok', 'Horario eliminado.');
  hjCargar();
}

/* Se carga al abrir la pestaña Config, junto con los motivos */
(function () {
  var _showOrig = window.showTab;
  if (typeof _showOrig !== 'function') return;
  window.showTab = function (tab, btn) {
    var r = _showOrig.apply(this, arguments);
    try {
      if (tab === 'config' && !window._hjCargado) { window._hjCargado = true; hjCargar(); hjPreview(); }
    } catch (e) {}
    return r;
  };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   _DEVOLUCION_V6 (31-ago-2026) — la devolución deja de pedir horario

   QUE PASABA
   ---------------------------------------------------------------------------
   En agosto agregue "devolucion" a _esMotivoConHorario para que abriera algun
   campo. Pero el campo que abria era el HORARIO del permiso, y eso no es lo que
   hace falta: lo que hay que anotar es CUANTAS HORAS se le pagan al trabajador
   como extras en la planilla.

   Ejemplo real: Marco La Torre hizo 4 horas de mas el 30 de agosto. Por ley
   solo se le pueden pagar 2 en el dia. El usuario elige Devolucion, escribe 2,
   y le quedan 2 horas acumuladas.

   COMO QUEDA
   ---------------------------------------------------------------------------
   · Permiso  -> sigue pidiendo hora de inicio y fin, como siempre.
   · Devolucion -> pide UN numero: las horas a pagar. Tope 2 por dia.
   · Nada se genera solo. La devolucion la decide y la registra una persona.

   El tope de verdad lo hace cumplir el servidor, que es el unico que sabe si
   ese dia ya se le devolvieron horas. Aca se avisa antes, para no hacer perder
   el viaje al usuario.
   ═══════════════════════════════════════════════════════════════════════════ */

var DEVOL_TOPE_DIA = 2;   // horas maximas a pagar por dia, por ley

/* Ahora SOLO el permiso abre el horario */
function _esMotivoConHorario(m) {
  var t = String(m || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t.indexOf('permiso') >= 0;
}

function _esMotivoDevolucion(m) {
  var t = String(m || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.indexOf('pagadas') >= 0) return false;      // la fila automatica vieja
  return t.indexOf('devolucion') >= 0;
}

/* Texto de ayuda: cuanto tiene acumulado y cuanto se le puede pagar hoy */
function _devolAyuda() {
  var el = document.getElementById('devolAyuda');
  if (!el) return;
  var t = (window.horasCache && window.horasCache.trabajadorActual) || null;
  var saldo = null;
  try { saldo = window.horasCache.saldoActual; } catch (e) {}

  var pedido = parseFloat(String(v('regHorasDevol')).replace(',', '.'));
  if (isNaN(pedido)) pedido = 0;

  var partes = [];
  partes.push('Por ley solo se pueden pagar <b>' + DEVOL_TOPE_DIA.toFixed(0) +
              ' horas por día</b>.');
  if (saldo && typeof saldo.saldo === 'number') {
    partes.push('Hoy ' + (t ? (t.nombre || '') : 'el trabajador') + ' tiene <b>' +
                saldo.saldo.toFixed(2) + ' h</b> acumuladas.');
    if (pedido > 0) {
      var queda = Math.round((saldo.saldo - pedido) * 100) / 100;
      partes.push('Si le pagas ' + pedido.toFixed(2) + ' h, le quedarán <b>' +
                  queda.toFixed(2) + ' h</b>.');
    }
  }
  if (pedido > DEVOL_TOPE_DIA + 0.001) {
    partes.push('<span style="color:#dc2626">⚠️ ' + pedido.toFixed(2) +
                ' h pasa del tope. El sistema no lo va a permitir.</span>');
  }
  el.innerHTML = partes.join(' ');
}

/* Mostrar u ocultar el campo segun el motivo */
(function () {
  var _orig = window.motivoCambia;
  if (typeof _orig !== 'function') return;
  window.motivoCambia = function () {
    var r = _orig.apply(this, arguments);
    try {
      var sel = document.getElementById('regMotivo');
      var esDev = sel ? _esMotivoDevolucion(sel.value) : false;
      var g = document.getElementById('grpDevol');
      if (g) g.style.display = esDev ? '' : 'none';
      if (!esDev) { var i = document.getElementById('regHorasDevol'); if (i) i.value = ''; }
      _devolAyuda();
      if (typeof recalcularHoras === 'function') recalcularHoras();
    } catch (e) {}
    return r;
  };
})();

/* En el cuadro de calculo, las horas de la devolucion salen donde el permiso */
(function () {
  var _orig = window.recalcularHoras;
  if (typeof _orig !== 'function') return;
  window.recalcularHoras = function () {
    var r = _orig.apply(this, arguments);
    try {
      var motivo = v('regMotivo') || '';
      if (_esMotivoDevolucion(motivo)) {
        var n = parseFloat(String(v('regHorasDevol')).replace(',', '.'));
        if (isNaN(n) || n < 0) n = 0;
        setText('calcPerm', n.toFixed(2));
      }
      _devolAyuda();
    } catch (e) {}
    return r;
  };
})();

/* Avisar antes de mandar algo que el servidor va a rechazar */
(function () {
  var _orig = window.registrarHoras;
  if (typeof _orig !== 'function') return;
  window.registrarHoras = async function () {
    try {
      var motivo = v('regMotivo') || '';
      if (_esMotivoDevolucion(motivo)) {
        var n = parseFloat(String(v('regHorasDevol')).replace(',', '.'));
        if (isNaN(n) || n <= 0) {
          mostrarAlerta('alRegistro', 'err',
            'Indica cuántas horas se le van a pagar como extras.');
          var i = document.getElementById('regHorasDevol'); if (i) i.focus();
          return;
        }
        if (n > DEVOL_TOPE_DIA + 0.001) {
          mostrarAlerta('alRegistro', 'err',
            'Solo se pueden pagar ' + DEVOL_TOPE_DIA.toFixed(0) +
            ' horas por día. Escribiste ' + n.toFixed(2) + '.');
          return;
        }
      }
    } catch (e) {}
    return _orig.apply(this, arguments);
  };
})();

console.log('[_DEVOLUCION_V6] la devolucion pide horas a pagar, no horario');
