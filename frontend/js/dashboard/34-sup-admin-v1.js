/* dashboard.html · bloque 34 (antes en la linea 15491) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _SUP_ADMIN_V1 (23-set-2026) ══════════════════
   SUPERVISORES DE VISITAS ADMINISTRABLES — sin tocar codigo.
   · La lista del formulario "Nueva Visita" sale de la hoja BD_Supervisores.
     Si la hoja esta vacia o no responde, se usa la lista de siempre
     (SUPERVISORES_LISTA): el formulario nunca queda vacio.
   · Boton "👥 Supervisores" en Visitas de Campo (solo administradores):
     agregar, editar, dar de baja / reactivar, y "Reemplazar" (da de baja al
     que se retira y abre el alta del nuevo con el mismo sector).
   · Nadie se borra: los retirados quedan como historial y siguen apareciendo
     al EDITAR visitas antiguas, pero no para registrar nuevas.
   Todo es ADITIVO: envuelve abrirNuevaVisita y autoFillFundoReemplazo.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var LS = 'rl_sup_visitas_v1';
var S = { lista: null, cargando: null };
try { var c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && Array.isArray(c.lista)) S.lista = c.lista.filter(function (x) { return x.gestionado; }); } catch (e) {}

/* Solo estos usuarios ven y usan el boton "Supervisores". Para dar acceso a otro, agregarlo aqui y en SUP_ADMIN_USUARIOS del servidor. */
var SUP_ADMIN_USUARIOS = ['jtimoteo'];
function esAdm() { try { return SUP_ADMIN_USUARIOS.indexOf(String(USER.usuario || '').toLowerCase().trim()) >= 0; } catch (e) { return false; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

function cargar(forzar) {
  if (S.cargando) return S.cargando;
  if (!forzar && S.lista && S._fresco) return Promise.resolve(S.lista);
  S.cargando = apiGet({ action: 'getSupervisores' }).then(function (r) {
    if (r && r.success && Array.isArray(r.data)) {
      S.lista = r.data.filter(function (x) { return x.gestionado; }); S._fresco = true;   /* filas viejas sin ACTIVO no se usan hasta importarlas */
      try { localStorage.setItem(LS, JSON.stringify({ ts: Date.now(), lista: r.data })); } catch (e) {}
      sincronizarLegado();
    }
    return S.lista;
  }).catch(function () { return S.lista; }).finally(function () { S.cargando = null; });
  return S.cargando;
}
/* lista a usar: la de la hoja si tiene datos; si no, la de siempre */
function fuente() { return (S.lista && S.lista.length) ? S.lista : (typeof SUPERVISORES_LISTA !== 'undefined' ? SUPERVISORES_LISTA.map(function (s) { var o = Object.assign({}, s); o.activo = true; return o; }) : []); }
/* el PDF de la visita busca el cargo en SUPERVISORES_LISTA: se le agregan los nuevos */
function sincronizarLegado() {
  try {
    if (typeof SUPERVISORES_LISTA === 'undefined' || !S.lista) return;
    S.lista.forEach(function (s) { if (!SUPERVISORES_LISTA.some(function (x) { return norm(x.nombre) === norm(s.nombre); })) SUPERVISORES_LISTA.push({ dni: s.dni, nombre: s.nombre, cargo: s.cargo, sector: s.sector, empresa: s.empresa, correo: s.correo, reemplazo: !!s.reemplazo }); });
  } catch (e) {}
}

function llenarSelect() {
  var sel = document.getElementById('vSup'); if (!sel) return;
  var previo = sel.value;
  var L = fuente();
  while (sel.options.length > 1) sel.remove(1);
  var act = L.filter(function (s) { return s.activo !== false; });
  var fijos = act.filter(function (s) { return !s.reemplazo; }), reem = act.filter(function (s) { return s.reemplazo; });
  function opt(s, retirado) {
    var o = new Option(retirado ? s.nombre + ' (retirado)' : (s.reemplazo ? s.nombre + ' ⚠️ (Reemplazante)' : s.nombre + ' — ' + s.sector), s.nombre);
    o.dataset.dni = s.dni || ''; o.dataset.correo = s.correo || ''; o.dataset.empresa = s.empresa || '';
    o.dataset.fundo = s.sector || ''; o.dataset.reemplazo = s.reemplazo ? 'si' : 'no';
    if (retirado) o.disabled = true;
    return o;
  }
  fijos.concat(reem).forEach(function (s) { sel.appendChild(opt(s, false)); });
  var ret = L.filter(function (s) { return s.activo === false; });
  if (ret.length) { var g = document.createElement('optgroup'); g.label = 'Retirados (solo para ver visitas antiguas)'; ret.forEach(function (s) { g.appendChild(opt(s, true)); }); sel.appendChild(g); }
  if (previo) sel.value = previo;
}

/* 1) Formulario: al abrir, se usa la lista administrable */
var _abrirOrig = window.abrirNuevaVisita;
if (typeof _abrirOrig === 'function') {
  window.abrirNuevaVisita = function () {
    var r = _abrirOrig.apply(this, arguments);
    try { llenarSelect(); } catch (e) { console.warn('[_SUP_ADMIN_V1]', e); }
    cargar(false).then(function () { try { var sel = document.getElementById('vSup'); if (sel && !sel.value) llenarSelect(); } catch (e) {} });
    return r;
  };
}
/* 2) Reemplazo: el titular sugerido sale de la lista vigente */
var _fundoOrig = window.autoFillFundoReemplazo;
if (typeof _fundoOrig === 'function') {
  window.autoFillFundoReemplazo = function () {
    var r = _fundoOrig.apply(this, arguments);
    try {
      var t = titularDe((document.getElementById('vFundoReemplazo') || {}).value);
      if (t) document.getElementById('vSupTitular').value = t.nombre;
    } catch (e) {}
    return r;
  };
}
/* Titular vigente de un fundo. El sector de la hoja puede traer varios fundos
   separados por "/" o "," (ej: "Limones / El Papayo"). Se compara por palabras,
   sin tildes y sin "los/las", asi "Los Olivares" = "Olivares" pero NO
   "Olivares Bajo"; y "Planta Packing Rapel" = "Planta Rapel Packing". */
function palabras(x) { return norm(x).split(/\s+/).filter(function (w) { return w && w !== 'los' && w !== 'las'; }).sort().join(' '); }
function titularDe(fundo) {
  var f = palabras(fundo); if (!f || !S.lista || !S.lista.length) return null;
  return S.lista.filter(function (s) {
    return s.activo !== false && !s.reemplazo && String(s.sector || '').split(/[\/,]/).some(function (parte) { return palabras(parte) === f; });
  })[0] || null;
}
window._supTitularDe = titularDe;
/* 2b) Fusiones de Buses: "Supervisor responsable" sale de la lista vigente
       (si el fundo no tiene titular en la hoja, queda el de siempre) */
var _autoSupOrig = window.autoSupervisor;
if (typeof _autoSupOrig === 'function') {
  window.autoSupervisor = function () {
    var r = _autoSupOrig.apply(this, arguments);
    try {
      var t = titularDe((document.getElementById('fSector') || {}).value);
      if (t) document.getElementById('fSupervisorAuto').value = t.nombre;
    } catch (e) {}
    return r;
  };
}

/* 3) Pantalla de administracion */
function boton() {
  if (!esAdm() || document.getElementById('btnSupAdmin')) return;
  var hd = document.querySelector('#sec-visitas .sec-hd'); if (!hd) return;
  var b = document.createElement('button'); b.id = 'btnSupAdmin'; b.className = 'btn-n'; b.style.background = '#0a2463';
  b.textContent = '👥 Supervisores'; b.onclick = abrirAdmin; hd.appendChild(b);
}
function abrirAdmin() {
  var ov = document.getElementById('supAdmOv');
  if (!ov) {
    ov = document.createElement('div'); ov.id = 'supAdmOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(11,30,69,.55);z-index:9990;display:flex;align-items:flex-start;justify-content:center;padding:30px 12px;overflow:auto';
    ov.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:980px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3)"><div style="background:#0a2463;color:#fff;padding:14px 18px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center"><b>👥 Supervisores de Visitas de Campo</b><span id="supAdmX" style="cursor:pointer;font-size:20px">✕</span></div><div id="supAdmBody" style="padding:16px 18px"></div></div>';
    document.body.appendChild(ov);
    document.getElementById('supAdmX').onclick = function () { ov.style.display = 'none'; };
  }
  ov.style.display = 'flex';
  pintar('<p style="color:#64748b">Cargando…</p>');
  cargar(true).then(function () { pintarLista(); });
}
function pintar(h) { var b = document.getElementById('supAdmBody'); if (b) b.innerHTML = h; }
function pintarLista() {
  var hoja = S.lista || [];
  var h = '<p style="margin:0 0 10px;font-size:12.5px;color:#334155">Esta lista alimenta el campo <b>Supervisor</b> de Nueva Visita. Cuando alguien se retira, usa <b>Reemplazar</b>: se da de baja (queda en el historial) y registras al nuevo con el mismo sector. <b>Importante:</b> escribe el nombre <u>igual</u> que en Gestión de Usuarios para que su cumplimiento se cuente bien. Si un supervisor cubre varios fundos, sepáralos con <b>/</b> en Sector (ej: <i>Limones / El Papayo</i>): así también sale como responsable en Fusiones de Buses.</p>';
  if (!hoja.length) {
    h += '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12.5px">La hoja <b>BD_Supervisores</b> aún está vacía: el formulario usa la lista escrita en el código (' + (typeof SUPERVISORES_LISTA !== 'undefined' ? SUPERVISORES_LISTA.length : 0) + ' personas). Pásala a la hoja una sola vez para poder administrarla desde aquí.<div style="margin-top:8px"><button class="btn-n" id="supImportar">📥 Pasar la lista actual a la hoja</button></div></div>';
  }
  h += '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><label style="font-size:12px"><input type="checkbox" id="supVerRet"' + (S.verRet ? ' checked' : '') + '> Ver retirados</label><button class="btn-n" id="supNuevo"' + (hoja.length ? '' : ' disabled') + '>+ Nuevo supervisor</button></div>';
  var filas = hoja.filter(function (s) { return S.verRet || s.activo !== false; });
  h += '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#0b1e45;color:#fff"><th style="padding:7px">Nombre</th><th>DNI</th><th>Cargo</th><th>Sector</th><th>Empresa</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>' +
    (filas.length ? filas.map(function (s) {
      var i = hoja.indexOf(s), ret = s.activo === false;
      return '<tr style="border-bottom:1px solid #eef2f6' + (ret ? ';opacity:.55' : '') + '"><td style="padding:6px"><b>' + esc(s.nombre) + '</b><br><span style="color:#64748b;font-size:10.5px">' + esc(s.correo) + '</span></td><td>' + esc(s.dni) + '</td><td>' + esc(s.cargo) + '</td><td>' + esc(s.sector) + '</td><td>' + esc(s.empresa) + '</td><td>' + (s.reemplazo ? 'Reemplazante' : 'Titular') + '</td><td>' + (ret ? '⛔ Retirado ' + esc(s.fecha_baja || '') : '🟢 Activo') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn-a" style="font-size:10px" data-ed="' + i + '">✏️ Editar</button> ' + (ret ? '<button class="btn-a" style="font-size:10px" data-re="' + i + '">↩️ Reactivar</button>' : '<button class="btn-a" style="font-size:10px;background:#d97706;color:#fff" data-rp="' + i + '">🔄 Reemplazar</button> <button class="btn-a" style="font-size:10px;background:#dc2626;color:#fff" data-bj="' + i + '">Dar de baja</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:14px">' + (hoja.length ? 'Sin supervisores activos' : 'Importa la lista para empezar') + '</td></tr>') + '</tbody></table></div>';
  pintar(h);
  var b = document.getElementById('supAdmBody');
  var imp = document.getElementById('supImportar'); if (imp) imp.onclick = importar;
  document.getElementById('supVerRet').onchange = function () { S.verRet = this.checked; pintarLista(); };
  document.getElementById('supNuevo').onclick = function () { formulario(null, null); };
  b.querySelectorAll('[data-ed]').forEach(function (x) { x.onclick = function () { formulario(hoja[+x.getAttribute('data-ed')], null); }; });
  b.querySelectorAll('[data-bj]').forEach(function (x) { x.onclick = function () { baja(hoja[+x.getAttribute('data-bj')], false); }; });
  b.querySelectorAll('[data-rp]').forEach(function (x) { x.onclick = function () { baja(hoja[+x.getAttribute('data-rp')], true); }; });
  b.querySelectorAll('[data-re]').forEach(function (x) { x.onclick = function () { var s = Object.assign({}, hoja[+x.getAttribute('data-re')], { activo: true, fecha_baja: '' }); guardar([s], '✅ ' + s.nombre + ' reactivado'); }; });
}
async function importar() {
  if (typeof SUPERVISORES_LISTA === 'undefined') return;
  if (!await appConfirm('¿Pasar a la hoja los ' + SUPERVISORES_LISTA.length + ' supervisores que hoy están en el código? Después podrás editarlos desde aquí.')) return;
  guardar(SUPERVISORES_LISTA.map(function (s) { return Object.assign({}, s, { activo: true }); }), '✅ Lista importada');
}
async function baja(s, reemplazar) {
  var motivo = await appPrompt((reemplazar ? 'Reemplazar a ' : 'Dar de baja a ') + s.nombre + '.\nMotivo (ej: renuncia, cambio de área):', 'Renuncia');
  if (motivo === null || motivo === undefined) return;
  var x = Object.assign({}, s, { activo: false, observacion: String(motivo || '').trim() });
  var ok = await guardar([x], '✅ ' + s.nombre + ' dado de baja');
  if (ok && reemplazar) formulario(null, { sector: s.sector, empresa: s.empresa, cargo: s.cargo, reemplazo: s.reemplazo, observacion: 'Reemplaza a ' + s.nombre });
}
function formulario(s, base) {
  var e = s || base || {}, nuevo = !s;
  var campo = function (id, lbl, val, ph) { return '<div><label style="font-size:11px;font-weight:700;color:#334155">' + lbl + '</label><input id="' + id + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:12.5px;box-sizing:border-box"></div>'; };
  pintar('<h3 style="margin:0 0 12px;color:#0b1e45;font-size:15px">' + (nuevo ? '➕ Nuevo supervisor' : '✏️ Editar ' + esc(s.nombre)) + '</h3>' +
    (base && base.observacion ? '<p style="font-size:12px;color:#92400e;background:#fef3c7;padding:8px 10px;border-radius:8px;margin:0 0 10px">' + esc(base.observacion) + ' · sector y empresa ya cargados</p>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">' +
    campo('spDni', 'DNI *', e.dni, '8 dígitos') + campo('spNom', 'Nombre y apellidos * (igual que en Usuarios)', e.nombre) + campo('spCargo', 'Cargo', e.cargo || 'Supervisor de Gestión Humana') +
    campo('spSector', 'Sector / Fundo', e.sector, 'Ej: Santa Rosa') + '<div><label style="font-size:11px;font-weight:700;color:#334155">Empresa</label><select id="spEmp" style="width:100%;padding:8px;border:1.5px solid #e2e8f0;border-radius:7px"><option value="">(varias)</option><option' + (e.empresa === 'RAPEL' ? ' selected' : '') + '>RAPEL</option><option' + (e.empresa === 'VERFRUT' ? ' selected' : '') + '>VERFRUT</option></select></div>' +
    campo('spCorreo', 'Correo', e.correo) + '</div>' +
    '<label style="display:block;margin-top:10px;font-size:12px"><input type="checkbox" id="spReem"' + (e.reemplazo ? ' checked' : '') + '> Es reemplazante (cubre varios fundos, elige el sector al registrar)</label>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn-a" id="spCanc">Cancelar</button><button class="btn-n" id="spOk">💾 Guardar</button></div>');
  document.getElementById('spCanc').onclick = pintarLista;
  document.getElementById('spOk').onclick = function () {
    var v = function (id) { return String(document.getElementById(id).value || '').trim(); };
    var x = { dni: v('spDni'), nombre: v('spNom'), cargo: v('spCargo'), sector: v('spSector'), empresa: v('spEmp'), correo: v('spCorreo'),
              reemplazo: document.getElementById('spReem').checked, activo: true, observacion: (s && s.observacion) || (base && base.observacion) || '' };
    if (!/^\d{8}$/.test(x.dni)) { mostrarToast('❌ DNI de 8 dígitos', 'error'); return; }
    if (!x.nombre) { mostrarToast('❌ Escribe el nombre', 'error'); return; }
    if (nuevo && (S.lista || []).some(function (y) { return String(y.dni) === x.dni; })) { mostrarToast('❌ Ese DNI ya está en la lista (usa Editar o Reactivar)', 'error'); return; }
    if (s) { x.dni_original = s.dni; if (s.activo === false) { x.activo = false; x.fecha_baja = s.fecha_baja; } }
    guardar([x], '✅ ' + x.nombre + ' guardado').then(function (ok) { if (ok) pintarLista(); });
  };
}
async function guardar(lista, msg) {
  var r = await apiPost({ action: 'saveSupervisor', usuario: USER.usuario, rol: USER.rol, lista: lista });
  if (!r || !r.success) { mostrarToast('❌ ' + ((r && r.error) || 'No se pudo guardar'), 'error'); return false; }
  mostrarToast(msg);
  await cargar(true); pintarLista();
  return true;
}
window._supAdminAbrir = abrirAdmin;

(function esperar(n) {
  try { if (typeof USER !== 'undefined' && USER && USER.usuario) { boton(); cargar(false); return; } } catch (e) {}
  if (n < 40) setTimeout(function () { esperar(n + 1); }, 500);
})(0);
console.log('[_SUP_ADMIN_V1] listo');
})();
