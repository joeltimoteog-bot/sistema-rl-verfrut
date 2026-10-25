/* dashboard.html · bloque 56 (antes en la linea 17175) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* (copia del bloque de frontend/pages/usuarios.html, para la seccion Gestion Usuarios del dashboard) */
/* ═══════════════════════════════════════════════════════════════════════════
   _AUSENCIAS_V1 (27-set-2026) — AUSENCIA / REEMPLAZO temporal (vacaciones, descanso medico, accidente, licencia)
   · Solo jtimoteo registra, edita, reincorpora o anula (Azure lo verifica con el login firmado).
   · Guarda primero en Azure (/api/cumpl/guardar/cumplAusencia); sin Azure -> Google (cumplAusencia).
   · Mientras dure: casos, visitas semanales y alertas del titular pasan a su reemplazo; al volver regresan solos.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api/cumpl/';
  function esDueno() { try { return String((USER && USER.usuario) || '').trim().toLowerCase() === 'jtimoteo'; } catch (e) { return false; } }   /* se evalua al usarse: USER puede cargarse despues */
  var TIPO = { 'VACACIONES': '🏖️ Vacaciones', 'DESCANSO MEDICO': '🏥 Descanso médico', 'ACCIDENTE': '🚑 Accidente', 'LICENCIA': '📄 Licencia', 'OTRO': '📌 Otro' };
  var A = { lista: [], hoy: '', cargado: false, titular: null, editId: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dmy(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function hoyL() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function tk() { try { return sessionStorage.getItem('rl_token'); } catch (e) { return null; } }
  function vig(a, s) { return !a.anulada && a.desde <= s && (!a.hasta || s <= a.hasta); }
  function estado(a) { var h = A.hoy || hoyL(); return a.anulada ? 'ANULADA' : vig(a, h) ? 'VIGENTE' : a.desde > h ? 'PROGRAMADA' : 'TERMINADA'; }
  function nombreDe(u) { var x = (CACHE.usuarios || []).find(function (y) { return String(y.usuario).toLowerCase() === String(u).toLowerCase(); }); return x ? x.nombre : u; }
  async function azure(ruta, cuerpo) {
    var t = tk(); if (!t) return null;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 20000);
    try { var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t }, body: JSON.stringify(cuerpo || {}) }; if (ctrl) op.signal = ctrl.signal;
      var r = await fetch(AZ + ruta, op); return { status: r.status, j: await r.json().catch(function () { return null; }) }; }
    catch (e) { return null; } finally { clearTimeout(reloj); }
  }
  async function cargar() {
    var r = await azure('cumplAusencias', { usuario: USER.usuario });
    var j = r && r.status === 200 && r.j && r.j.success ? r.j : null;
    if (!j) { try { j = await apiPost({ action: 'cumplAusencias', usuario: USER.usuario, rol: USER.rol }); } catch (e) { j = null; } }
    if (j && j.success) { A.lista = j.ausencias || []; A.hoy = j.hoy || hoyL(); A.cargado = true; try { window._ausPublicarEti && window._ausPublicarEti(A.lista); } catch (e) {} }   /* _COBERTURAS_ETI_V1 */
    pintarCard(); try { if (CACHE.usuarios) _renderUs(CACHE.usuarios); } catch (e) {}
    if (document.getElementById('mAus').classList.contains('on') && A.titular) pintarModal();
  }
  window._ausRecargar = cargar;
  window._ausCelda = function (u) {
    if (!A.cargado) return '';
    var us = String(u.usuario || '').toLowerCase(), out = [];
    A.lista.forEach(function (a) {
      var e = estado(a); if (e !== 'VIGENTE' && e !== 'PROGRAMADA') return;
      if (String(a.usuario).toLowerCase() === us) out.push('<span class="bg" style="background:' + (e === 'VIGENTE' ? '#fef3c7;color:#92400e' : '#e0f2fe;color:#075985') + ';display:inline-block;margin:1px 0">' + esc(TIPO[a.tipo] || a.tipo) + (e === 'PROGRAMADA' ? ' desde ' + dmy(a.desde) : '') + (a.hasta ? ' hasta ' + dmy(a.hasta) : '') + '</span><br><span style="font-size:11px;color:#64748b">reemplazo: ' + esc(a.reemplazo_nombre || nombreDe(a.reemplazo)) + '</span>');
      if (String(a.reemplazo).toLowerCase() === us) out.push('<span class="bg" style="background:#ede9fe;color:#5b21b6;display:inline-block;margin:1px 0">🔄 ' + (e === 'VIGENTE' ? 'Cubre a ' : 'Cubrirá a ') + esc(a.nombre || nombreDe(a.usuario)) + '</span>');
    });
    return out.join('<br>');
  };
  window._ausBtn = function (u) { return esDueno() ? '<button class="btn-a" style="background:#ede9fe;color:#5b21b6" onclick="_ausAbrir(\'' + esc(u.usuario) + '\')">🔄 Ausencia</button>' : ''; };
  function pintarCard() {
    var card = document.getElementById('ausCard'), tb = document.getElementById('tbAus'); if (!card || !tb) return;
    var h = A.hoy || hoyL(), lim = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    var ls = A.lista.filter(function (a) { var e = estado(a); return e === 'VIGENTE' || e === 'PROGRAMADA' || (e === 'TERMINADA' && (a.hasta || '') >= lim); })
      .sort(function (x, y) { var o = { VIGENTE: 0, PROGRAMADA: 1, TERMINADA: 2 }; return (o[estado(x)] - o[estado(y)]) || String(x.desde).localeCompare(String(y.desde)); });
    card.style.display = ls.length || esDueno() ? 'block' : 'none';
    tb.innerHTML = ls.length ? ls.map(function (a) {
      var e = estado(a), col = e === 'VIGENTE' ? '#d1fae5;color:#065f46' : e === 'PROGRAMADA' ? '#e0f2fe;color:#075985' : '#f1f5f9;color:#64748b';
      return '<tr><td><b>' + esc(a.nombre || nombreDe(a.usuario)) + '</b></td><td>' + esc(TIPO[a.tipo] || a.tipo) + (a.obs ? '<br><span style="font-size:11px;color:#64748b">' + esc(a.obs) + '</span>' : '') + '</td><td>' + dmy(a.desde) + '</td><td>' + (a.hasta ? dmy(a.hasta) : '<i style="color:#64748b">sin fecha</i>') + '</td><td>' + esc(a.reemplazo_nombre || nombreDe(a.reemplazo)) + '</td><td><span class="bg" style="background:' + col + '">' + e + '</span></td><td>' + (esDueno() ? '<button class="btn-a be" onclick="_ausAbrir(\'' + esc(a.usuario) + '\')">Gestionar</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">Nadie ausente. Para registrar una ausencia usa el botón 🔄 Ausencia en la fila del usuario.</td></tr>';
  }
  window._ausAbrir = function (usuario) {
    if (!esDueno()) return;
    A.titular = String(usuario).toLowerCase(); A.editId = null;
    document.getElementById('ausTit').textContent = 'Ausencia / Reemplazo — ' + nombreDe(usuario);
    ['aus_desde', 'aus_hasta', 'aus_obs'].forEach(function (id) { sv(id, ''); }); sv('aus_tipo', '');
    var sel = document.getElementById('aus_reemp');
    sel.innerHTML = '<option value="">— Elige quién lo cubre —</option>' + (CACHE.usuarios || []).filter(function (x) { return x.activo && String(x.usuario).toLowerCase() !== A.titular; })
      .sort(function (a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'); })
      .map(function (x) { return '<option value="' + esc(x.usuario) + '">' + esc(x.nombre) + ' (' + esc(x.usuario) + ')</option>'; }).join('');
    document.getElementById('ausBtnG').textContent = '💾 Registrar ausencia';
    pintarModal(); abrir('mAus');
  };
  function pintarModal() {
    var box = document.getElementById('ausLista');
    var ls = A.lista.filter(function (a) { return String(a.usuario).toLowerCase() === A.titular && !a.anulada; }).sort(function (x, y) { return String(y.desde).localeCompare(String(x.desde)); });
    box.innerHTML = ls.length ? '<div style="font-size:11px;font-weight:700;color:#0a2463;letter-spacing:1px;margin-bottom:6px">AUSENCIAS REGISTRADAS</div>' + ls.map(function (a) {
      var e = estado(a);
      return '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:220px;font-size:12.5px"><b>' + esc(TIPO[a.tipo] || a.tipo) + '</b> · ' + dmy(a.desde) + ' → ' + (a.hasta ? dmy(a.hasta) : 'sin fecha fin') + ' · reemplazo: <b>' + esc(a.reemplazo_nombre) + '</b> <span class="bg" style="background:#f1f5f9;color:#334155">' + e + '</span></span>' +
        (e !== 'TERMINADA' ? '<button class="btn-a be" onclick="_ausEditar(\'' + a.id + '\')">✏️ Editar</button><button class="btn-a" style="background:#d1fae5;color:#065f46" onclick="_ausReincorporar(\'' + a.id + '\')">✅ Se reincorporó</button>' : '') +
        '<button class="btn-a" style="background:#fee2e2;color:#991b1b" onclick="_ausAnular(\'' + a.id + '\')">🗑️ Anular</button></div>';
    }).join('') : '';
  }
  window._ausEditar = function (id) {
    var a = A.lista.find(function (x) { return x.id === id; }); if (!a) return;
    A.editId = id; sv('aus_tipo', a.tipo); sv('aus_reemp', a.reemplazo); sv('aus_desde', a.desde); sv('aus_hasta', a.hasta || ''); sv('aus_obs', a.obs || '');
    document.getElementById('ausBtnG').textContent = '💾 Guardar cambios';
  };
  function huella(b) { var s = JSON.stringify(b), h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'aus-' + (h >>> 0).toString(36) + '-' + Date.now().toString(36); }
  var ocupado = false;
  async function guardar(b, msgOk) {
    if (ocupado) return; ocupado = true;
    b.client_id = huella(b);
    var btn = document.getElementById('ausBtnG'); if (btn) btn.disabled = true;
    try {
      var r = await azure('guardar/cumplAusencia', b), j = null;
      if (r && r.status === 200 && r.j) { j = r.j; if (j.success) { try { Promise.resolve(apiPost({ action: 'cvAplicarDesdeAzure' })).catch(function () {}); } catch (e) {} } }
      else { try { j = await apiPost(Object.assign({ action: 'cumplAusencia', usuario: USER.usuario, rol: USER.rol }, b)); } catch (e) { j = { success: false, error: 'Sin conexión' }; } }
      if (j && j.success) { A.lista = j.ausencias || A.lista; A.cargado = true; try { window._ausPublicarEti && window._ausPublicarEti(A.lista); } catch (e) {} mostrarToast('✅ ' + msgOk); A.editId = null; pintarCard(); pintarModal(); try { if (CACHE.usuarios) _renderUs(CACHE.usuarios); } catch (e) {} return true; }
      mostrarToast('❌ ' + ((j && j.error) || 'No se pudo guardar'), 'error'); return false;
    } finally { ocupado = false; if (btn) btn.disabled = false; }
  }
  window._ausGuardarForm = async function () {
    var b = { tipo: v('aus_tipo'), reemplazo: v('aus_reemp'), desde: v('aus_desde'), hasta: v('aus_hasta'), obs: v('aus_obs').trim() };
    if (!b.tipo) { mostrarToast('❌ Elige el motivo', 'error'); return; }
    if (!b.reemplazo) { mostrarToast('❌ Elige quién lo reemplaza', 'error'); return; }
    if (!b.desde) { mostrarToast('❌ Indica la fecha de inicio', 'error'); return; }
    if (b.hasta && b.hasta < b.desde) { mostrarToast('❌ La fecha fin es anterior al inicio', 'error'); return; }
    if (A.editId) { b.op = 'editar'; b.id = A.editId; } else { b.op = 'registrar'; b.titular = A.titular; }
    var ok = await guardar(b, A.editId ? 'Ausencia actualizada' : 'Ausencia registrada: sus pendientes pasan a ' + nombreDe(b.reemplazo));
    if (ok) { ['aus_desde', 'aus_hasta', 'aus_obs'].forEach(function (id) { sv(id, ''); }); sv('aus_tipo', ''); sv('aus_reemp', ''); document.getElementById('ausBtnG').textContent = '💾 Registrar ausencia'; }
  };
  window._ausReincorporar = async function (id) {
    var a = A.lista.find(function (x) { return x.id === id; }); if (!a) return;
    var f = window.prompt('¿Qué día regresó (o regresa) ' + a.nombre + '? (aaaa-mm-dd)\nDesde ese día vuelve a responder por sus casos y visitas.', A.hoy || hoyL());
    if (!f) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.trim())) { mostrarToast('❌ Usa el formato aaaa-mm-dd', 'error'); return; }
    await guardar({ op: 'reincorporar', id: id, regreso: f.trim() }, 'Reincorporación registrada');
  };
  window._ausAnular = async function (id) {
    var a = A.lista.find(function (x) { return x.id === id; }); if (!a) return;
    var ok = typeof appConfirm === 'function' ? await appConfirm('¿Anular la ausencia de ' + a.nombre + ' (' + dmy(a.desde) + ')? Se usa si se registró por error: todo vuelve a quedar a su nombre.') : window.confirm('¿Anular?');
    if (!ok) return;
    await guardar({ op: 'anular', id: id }, 'Ausencia anulada');
  };
  /* en el dashboard: al abrir Gestion Usuarios tambien se cargan las ausencias */
  var cargarUsPrevio = window.cargarUs;
  if (typeof cargarUsPrevio === 'function') {
    window.cargarUs = async function () { var r = await cargarUsPrevio.apply(this, arguments); cargar(); return r; };
    try { cargarUs = window.cargarUs; } catch (e) {}
  }
})();
