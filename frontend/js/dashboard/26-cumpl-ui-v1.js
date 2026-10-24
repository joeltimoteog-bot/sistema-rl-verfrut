/* dashboard.html · bloque 26 (antes en la linea 13902) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════════════════ _CUMPL_UI_V1 (19-set-2026) ══════════════════
   CONTROL DE CUMPLIMIENTO — capa visual sobre el motor cumpl* del backend.
   Todo es ADITIVO: no modifica ninguna funcion existente, solo las envuelve.
     · Campana de notificaciones en la barra superior (agrupadas por gravedad).
     · Pantalla obligatoria al entrar cuando hay vencidos; saludo con pendientes.
     · Semaforo en la tabla de casos y aviso en Visitas.
     · Justificacion obligatoria al cerrar fuera de plazo (se guarda en CUMPL_JUSTIF).
     · Restricciones progresivas (solo modulos no ligados a regularizar).
     · Indice de Cumplimiento (supervisor) y panel "Control de Cumplimiento" (admin)
       con configuracion de plazos, justificaciones e historial.
   Si el backend no responde, nada de esto aparece y el sistema sigue igual.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var EST = {
  EN_PLAZO:  { txt: 'EN PLAZO',            ico: '🟢', bg: '#dcfce7', fg: '#15803d', nivel: 'Informativa' },
  PROXIMO:   { txt: 'PRÓXIMO A VENCER',    ico: '🟡', bg: '#fef9c3', fg: '#a16207', nivel: 'Advertencia' },
  VENCE_HOY: { txt: 'VENCE HOY',           ico: '🟠', bg: '#ffedd5', fg: '#c2410c', nivel: 'Urgente' },
  VENCIDO:   { txt: 'VENCIDO',             ico: '🔴', bg: '#fee2e2', fg: '#b91c1c', nivel: 'Incumplimiento' },
  CRITICO:   { txt: 'INCUMPLIMIENTO CRÍTICO', ico: '⚫', bg: '#e2e8f0', fg: '#0f172a', nivel: 'Incumplimiento' }
};
var NAV_MOD = { correo: 'navCorreo', fusiones: 'navFusiones', calculo: 'navCalcRemu', mantenimiento: 'navMantenimiento', almuerzos: 'navAlmuerzos', inventario: 'navInventario', horas: 'navHoras' };
var D = { data: null, ts: 0, cargando: null, panel: null };

function usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : null; } catch (e) { return null; } }
function esAdmin() { try { return ROLES_VER_TODO.includes(USER.rol); } catch (e) { return false; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function dmy(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (s || ''); }
function badge(est, extra) { var e = EST[est] || EST.EN_PLAZO; return '<span class="cumpl-bd" style="background:' + e.bg + ';color:' + e.fg + '">' + e.ico + ' ' + e.txt + (extra ? ' · ' + extra : '') + '</span>'; }
function plazoTxt(a) { return a.dias_retraso > 0 ? a.dias_retraso + ' día(s) de retraso' : a.dias_restantes === 0 ? 'vence hoy' : 'faltan ' + a.dias_restantes + ' día(s)'; }
function saludo() { var h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

/* ── estilos ── */
var css = document.createElement('style');
css.textContent = [
  '.cumpl-bd{display:inline-block;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.3px;white-space:nowrap}',
  '#cumplBell{position:relative;background:transparent;border:none;cursor:pointer;font-size:19px;padding:4px 8px;margin-right:6px;line-height:1}',
  '#cumplBellN{position:absolute;top:-2px;right:0;background:#dc2626;color:#fff;border-radius:10px;font-size:10px;font-weight:800;min-width:17px;height:17px;line-height:17px;text-align:center;padding:0 4px;display:none}',
  '#cumplPanel{position:fixed;top:56px;right:14px;width:400px;max-width:calc(100vw - 20px);max-height:78vh;overflow:auto;background:#fff;border:1px solid var(--bd);border-radius:14px;box-shadow:0 16px 48px rgba(2,6,23,.22);z-index:9000;display:none;font-family:Barlow,sans-serif}',
  'html.dark #cumplPanel{background:#1e293b;color:#f1f5f9}',
  '.cumpl-hd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bd);font-weight:800;font-size:13px;color:#0b1e45}',
  'html.dark .cumpl-hd{color:#f1f5f9}',
  '.cumpl-grp{padding:8px 14px 4px;font-size:10px;font-weight:800;letter-spacing:.6px;color:#64748b;text-transform:uppercase}',
  '.cumpl-it{padding:10px 14px;border-bottom:1px solid var(--bd);display:flex;gap:10px;align-items:flex-start}',
  '.cumpl-it .t{font-size:12px;font-weight:700;color:#0f172a}html.dark .cumpl-it .t{color:#f1f5f9}',
  '.cumpl-it .s{font-size:11px;color:#64748b;margin-top:2px;line-height:1.4}',
  '.cumpl-btn{display:inline-block;margin-top:6px;padding:5px 11px;border:none;border-radius:7px;font-size:10.5px;font-weight:800;cursor:pointer;color:#fff;background:#0a2463;letter-spacing:.3px}',
  '.cumpl-btn.rojo{background:#dc2626}.cumpl-btn.gris{background:#64748b}',
  '.cumpl-ov{position:fixed;inset:0;background:rgba(10,30,69,.62);z-index:99990;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}',
  '.cumpl-mod{background:#fff;border-radius:16px;max-width:760px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden;font-family:Barlow,sans-serif;color:#0f172a}',
  '.cumpl-mod .hd{padding:18px 22px;color:#fff;background:linear-gradient(135deg,#7f1d1d,#dc2626);font-size:17px;font-weight:900}',
  '.cumpl-mod .hd.am{background:linear-gradient(135deg,#0a2463,#1e3a8a)}',
  '.cumpl-mod .bd{padding:18px 22px}',
  '.cumpl-tb{width:100%;border-collapse:collapse;font-size:12px}.cumpl-tb th{background:#0b1e45;color:#fff;padding:7px 9px;text-align:left;font-size:10.5px;letter-spacing:.4px}.cumpl-tb td{padding:7px 9px;border-bottom:1px solid #eef2f6;vertical-align:top}',
  '.cumpl-kpi{flex:1;min-width:120px;background:#f8fafc;border:1px solid var(--bd);border-radius:12px;padding:12px 14px}html.dark .cumpl-kpi{background:#0f172a}',
  '.cumpl-kpi .n{font-size:22px;font-weight:900;color:#0b1e45}html.dark .cumpl-kpi .n{color:#f1f5f9}.cumpl-kpi .l{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;font-weight:700}',
  '.cumpl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}.cumpl-tabs button{padding:7px 13px;border-radius:8px;border:1.5px solid var(--bd);background:#fff;font-size:12px;font-weight:700;cursor:pointer;color:#0b1e45}.cumpl-tabs button.on{background:#0a2463;color:#fff;border-color:#0a2463}',
  '.cumpl-card{background:#fff;border:1px solid var(--bd);border-radius:16px;padding:16px 18px;margin-bottom:16px;box-shadow:0 1px 2px rgba(15,23,42,.05)}html.dark .cumpl-card{background:#1e293b}',
  '.cumpl-sel{padding:7px 10px;border:1.5px solid var(--bd);border-radius:7px;font-size:12px;font-family:Barlow,sans-serif;background:#fff}',
  '@media(max-width:640px){#cumplPanel{right:6px;left:6px;width:auto}}'
].join('');
document.head.appendChild(css);

/* ── datos ── */
async function cargar(motivo, forzar) {
  var u = usr(); if (!u) return null;
  if (!forzar && D.data && (Date.now() - D.ts) < 120000) return D.data;
  if (D.cargando) return D.cargando;
  D.cargando = (async function () {
    try {
      var r = await apiPost({ action: 'cumplPendientes', usuario: u.usuario, rol: u.rol });
      if (r && r.success) { try { if (r.config && r.config.calendario) rlCalFijar(r.config.calendario); if (r.config && r.config.plazos) rlPlazosFijar(r.config.plazos); } catch (eCal) {}   /* _CALENDARIO_V1 · _PLAZO_VIGENTE_V1 */
        D.data = r; D.ts = Date.now(); pintarTodo(); console.log('[_CUMPL_UI_V1] ' + (motivo || '') + ' → ' + JSON.stringify(r.resumen)); return r; }
      console.warn('[_CUMPL_UI_V1] backend:', r && r.error);
    } catch (e) { console.warn('[_CUMPL_UI_V1]', e.message); }
    return null;
  })().finally(function () { D.cargando = null; });
  return D.cargando;
}
window._cumplRecargar = function (m) { return cargar(m || 'manual', true); };
function actDe(nro) { if (!D.data) return null; return (D.data.actividades || []).filter(function (a) { return a.tipo === 'CASO' && String(a.caso) === String(nro); })[0] || null; }
function propias() { if (!D.data) return []; var u = usr(); if (!D.data.esAdmin) return D.data.actividades; return D.data.actividades.filter(function (a) { return a.tipo === 'CASO' && (String(a.responsable || '').toLowerCase() === String(u.nombre || '').toLowerCase() || String(a.responsable || '').toLowerCase() === String(u.usuario || '').toLowerCase()); }); }

/* ── navegacion a la actividad ── */
window._cumplIrA = function (tipo, nro) {
  cerrarPanel();
  if (tipo === 'VISITA') { var bv = document.getElementById('navVisitas'); if (bv) bv.click(); else ir('visitas'); return; }
  var bc = document.getElementById('navCasos'); if (bc) bc.click(); else ir('casos');
  var intentos = 0;
  (function abrir() {
    var lista = (typeof casosData !== 'undefined' && casosData) || [];
    var idx = -1; for (var i = 0; i < lista.length; i++) if (String(lista[i].nro) === String(nro)) { idx = i; break; }
    if (idx >= 0) { try { editarCaso(idx); } catch (e) { try { verDetalleCaso(idx); } catch (e2) {} } return; }
    if (++intentos < 20) setTimeout(abrir, 400);
    else mostrarToast('Caso N° ' + nro + ' no está en tu lista actual. Usa el buscador del módulo.', 'error');
  })();
};

/* ── campana ── */
function crearCampana() {
  if (document.getElementById('cumplBell')) return;
  var tbr = document.querySelector('.tb-r'); if (!tbr) return;
  var b = document.createElement('button'); b.id = 'cumplBell'; b.title = 'Centro de notificaciones'; b.innerHTML = '🔔<span id="cumplBellN"></span>';
  b.onclick = function (ev) { ev.stopPropagation(); togglePanel(); };
  tbr.insertBefore(b, tbr.firstChild);
  var p = document.createElement('div'); p.id = 'cumplPanel'; document.body.appendChild(p);
  document.addEventListener('click', function (ev) { if (p.style.display !== 'none' && !p.contains(ev.target)) cerrarPanel(); });
}
function cerrarPanel() { var p = document.getElementById('cumplPanel'); if (p) p.style.display = 'none'; }
function togglePanel() { var p = document.getElementById('cumplPanel'); if (!p) return; if (p.style.display === 'block') { cerrarPanel(); return; } pintarPanel(); p.style.display = 'block'; cargar('campana'); }
function pintarCampana() {
  var n = document.getElementById('cumplBellN'); if (!n || !D.data) return;
  var r = D.data.resumen, tot = r.VENCIDO + r.CRITICO + r.VENCE_HOY + r.PROXIMO;
  n.textContent = tot; n.style.display = tot ? 'inline-block' : 'none';
  n.style.background = (r.VENCIDO + r.CRITICO) ? '#dc2626' : r.VENCE_HOY ? '#ea580c' : '#ca8a04';
}
function itemHtml(a) {
  var e = EST[a.estado], esCaso = a.tipo === 'CASO';
  var titulo = esCaso ? 'Caso N° ' + a.caso + ' — ' + esc(a.trabajador) : esc(a.actividad) + ' (' + esc(a.caso) + ')';
  var sub = esc(a.actividad) + ' · Límite ' + dmy(a.fecha_limite) + ' · ' + plazoTxt(a) + (a.documentos_pendientes && a.documentos_pendientes.length ? '<br>Pendiente: ' + esc(a.documentos_pendientes.join(', ')) : '') + (D.data.esAdmin ? '<br>Responsable: ' + esc(a.responsable) : '') +
    (a.cubre_a ? '<br><span style="color:#5b21b6">🔄 ' + (D.data.esAdmin ? 'Cubre a ' : 'Cubres a ') + esc(a.cubre_a) + (a.ausencia_hasta ? ' hasta el ' + dmy(a.ausencia_hasta) : ' mientras dure su ausencia') + '</span>' : '');   /* _AUSENCIAS_V1 */
  var btn = a.dias_retraso > 0 ? '<button class="cumpl-btn rojo" onclick="_cumplIrA(\'' + a.tipo + '\',\'' + esc(a.caso) + '\')">REGULARIZAR AHORA</button>' : '<button class="cumpl-btn" onclick="_cumplIrA(\'' + a.tipo + '\',\'' + esc(a.caso) + '\')">' + (esCaso ? 'REVISAR CASO' : 'REGISTRAR VISITA') + '</button>';
  return '<div class="cumpl-it"><div style="font-size:18px">' + e.ico + '</div><div style="flex:1"><div class="t">' + titulo + '</div><div class="s">' + sub + '</div>' + btn + '</div></div>';
}
function pintarPanel() {
  var p = document.getElementById('cumplPanel'); if (!p) return;
  if (!D.data) { p.innerHTML = '<div class="cumpl-hd">🔔 Notificaciones</div><div style="padding:18px;color:#64748b;font-size:12px">Cargando…</div>'; return; }
  var r = D.data.resumen, acts = D.data.actividades || [];
  var grupos = [['Incumplimiento', ['CRITICO', 'VENCIDO']], ['Urgente', ['VENCE_HOY']], ['Advertencia', ['PROXIMO']], ['Informativa', ['EN_PLAZO']]];
  var html = '<div class="cumpl-hd"><span>🔔 Centro de notificaciones</span><span style="font-size:11px;color:#64748b;font-weight:600">🔴 ' + (r.VENCIDO + r.CRITICO) + ' vencidos · 🟠 ' + r.VENCE_HOY + ' hoy · 🟡 ' + r.PROXIMO + ' próximos</span></div>';
  if (D.data.restriccion && D.data.restriccion.activa) html += '<div style="margin:10px 14px;padding:10px 12px;background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;font-size:11.5px;color:#7f1d1d"><b>⛔ Restricción activa.</b> ' + esc(D.data.restriccion.motivo) + '. Regulariza tus pendientes para recuperar el acceso completo.</div>';
  var alguno = false;
  grupos.forEach(function (g) {
    var lst = acts.filter(function (a) { return g[1].indexOf(a.estado) >= 0; });
    if (!lst.length) return; alguno = true;
    html += '<div class="cumpl-grp">' + g[0] + ' (' + lst.length + ')</div>' + lst.slice(0, g[0] === 'Informativa' ? 5 : 30).map(itemHtml).join('');
    if (g[0] === 'Informativa' && lst.length > 5) html += '<div style="padding:6px 14px;font-size:11px;color:#64748b">… y ' + (lst.length - 5) + ' más en plazo</div>';
  });
  if (!alguno) html += '<div style="padding:22px;text-align:center;color:#16a34a;font-weight:700;font-size:13px">✅ Sin pendientes. ¡Todo al día!</div>';
  html += '<div style="padding:10px 14px;font-size:10.5px;color:#94a3b8">Las notificaciones desaparecen solo cuando la actividad queda regularizada.</div>';
  p.innerHTML = html;
}

/* ── pantalla obligatoria al entrar + saludo ── */
function pantallaEntrada() {
  if (!D.data || D.data.esAdmin) return;
  var r = D.data.resumen, venc = r.VENCIDO + r.CRITICO, hoyK = '_cumpl_gate_' + (D.data.hoy || '') + '_' + D.data.usuario;
  var u = usr();
  if (venc > 0) {
    var ya = false; try { ya = sessionStorage.getItem(hoyK) === '1'; } catch (e) {}
    if (ya) return;
    var lst = D.data.actividades.filter(function (a) { return a.dias_retraso > 0; });
    var ov = document.createElement('div'); ov.className = 'cumpl-ov'; ov.id = 'cumplGate';
    /* _AVISO_ESCALAR_V1 (27-set-2026): mensaje claro de que el retraso se reporta al administrador y a Eduardo Coveñas */
    var escD = (D.data.config && D.data.config.escalar_dias) || 3;
    var yaEsc = lst.filter(function (a) { return a.dias_retraso >= escD; }).length;
    var nomU = esc(((u && (u.nombre || u.usuario)) || '').split(' ')[0]);
    ov.innerHTML = '<div class="cumpl-mod"><div class="hd">⚠️ TIENES ' + (venc === 1 ? 'UN CASO / ACTIVIDAD RETRASADA' : venc + ' CASOS / ACTIVIDADES RETRASADAS') + '</div><div class="bd">' +
      '<p style="margin:0 0 10px;font-size:13.5px;line-height:1.5">' + (nomU ? 'Hola <b>' + nomU + '</b>, t' : 'T') + 'ienes <b>' + venc + '</b> actividad(es) que <b>superaron el plazo establecido</b>. Debes cumplirlas a la brevedad (subir el informe, cargar los documentos o cerrar el caso).</p>' +
      '<div style="margin:0 0 12px;font-size:13px;line-height:1.5;background:#fff7ed;border:1.5px solid #f97316;border-radius:8px;padding:9px 12px;color:#7c2d12">📣 <b>Importante:</b> si una actividad llega a <b>' + escD + ' días hábiles de retraso</b>, el sistema enviará automáticamente una <b>alerta al administrador del sistema, Joel Timoteo, y a Eduardo Coveñas</b> con el detalle de los retrasos del caso. ' +
      (yaEsc ? '<b>' + yaEsc + ' de tus actividades ya superaron ese límite y están siendo reportadas.</b> ' : '') + 'Por favor, cumple con este proceso.</div>' +
      '<div style="max-height:40vh;overflow:auto"><table class="cumpl-tb"><thead><tr><th>Caso</th><th>Actividad</th><th>Fecha límite</th><th>Retraso</th><th>Acción pendiente</th></tr></thead><tbody>' +
      lst.map(function (a) { return '<tr><td><b>' + esc(a.caso) + '</b>' + (a.trabajador ? '<br><span style="color:#64748b">' + esc(a.trabajador) + '</span>' : '') + '</td><td>' + esc(a.actividad) + '</td><td>' + dmy(a.fecha_limite) + '</td><td style="color:#b91c1c;font-weight:800">' + a.dias_retraso + ' día(s) háb.' + (a.estado === 'CRITICO' ? '<br>⚫ CRÍTICO' : '') + '</td><td>' + esc(a.accion) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      (D.data.restriccion && D.data.restriccion.activa ? '<p style="margin:12px 0 0;font-size:12px;color:#7f1d1d;background:#fee2e2;padding:8px 10px;border-radius:8px">⛔ Por incumplimiento crítico, algunas funciones administrativas quedan restringidas hasta que regularices. Puedes consultar, abrir tus casos, subir documentos y cerrarlos con normalidad.</p>' : '') +
      '<p style="margin:12px 0 0;font-size:11.5px;color:#64748b">La demora queda registrada en tu indicador de cumplimiento.</p>' +
      '<div style="text-align:right;margin-top:14px"><button class="cumpl-btn rojo" style="font-size:13px;padding:10px 18px" id="cumplGateBtn">REVISAR MIS PENDIENTES</button></div></div></div>';
    document.body.appendChild(ov);
    document.getElementById('cumplGateBtn').onclick = function () { try { sessionStorage.setItem(hoyK, '1'); } catch (e) {} ov.remove(); var a = lst[0]; if (a) _cumplIrA(a.tipo, a.caso); };
    return;
  }
  if (r.VENCE_HOY + r.PROXIMO > 0) {
    var k2 = hoyK + '_saludo'; var ya2 = false; try { ya2 = sessionStorage.getItem(k2) === '1'; } catch (e) {}
    if (ya2) return;
    try { sessionStorage.setItem(k2, '1'); } catch (e) {}
    var ov2 = document.createElement('div'); ov2.className = 'cumpl-ov';
    ov2.innerHTML = '<div class="cumpl-mod" style="max-width:520px"><div class="hd am">' + saludo() + ', ' + esc((u.nombre || u.usuario).split(' ')[0]) + '</div><div class="bd">' +
      '<p style="margin:0 0 10px;font-size:13.5px">Tienes actividades que requieren tu atención:</p>' +
      '<div style="font-size:14px;line-height:1.9">' + (r.VENCE_HOY ? '🟠 <b>' + r.VENCE_HOY + '</b> vence(n) hoy<br>' : '') + (r.PROXIMO ? '🟡 <b>' + r.PROXIMO + '</b> próxima(s) a vencer<br>' : '') + '</div>' +
      '<p style="margin:10px 0 0;font-size:12.5px;color:#0b1e45;font-weight:700">Prioriza tus pendientes para mantener actualizado tu cumplimiento.</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="cumpl-btn gris" id="cumplSalCerrar">Más tarde</button><button class="cumpl-btn" id="cumplSalVer">VER MIS PENDIENTES</button></div></div></div>';
    document.body.appendChild(ov2);
    document.getElementById('cumplSalCerrar').onclick = function () { ov2.remove(); };
    document.getElementById('cumplSalVer').onclick = function () { ov2.remove(); togglePanel(); };
  }
}

/* ── semaforo en tabla de casos ── */
var _renderOrig = window.renderTablaCasos;
if (typeof _renderOrig === 'function') {
  window.renderTablaCasos = function (data) {
    var r = _renderOrig.apply(this, arguments);
    try { decorarCasos(data); } catch (e) { console.warn('[_CUMPL_UI_V1] decorar:', e.message); }
    return r;
  };
}
function decorarCasos(data) {
  if (!D.data || !data || !data.length) return;
  var tb = document.getElementById('tbCasos'); if (!tb) return;
  var filas = tb.querySelectorAll('tr');
  for (var i = 0; i < filas.length && i < data.length; i++) {
    var a = actDe(data[i].nro); if (!a) continue;
    var celdas = filas[i].querySelectorAll('td'); if (celdas.length < 7) continue;
    var c = celdas[6]; if (c.querySelector('.cumpl-bd')) continue;
    c.innerHTML = badge(a.estado, plazoTxt(a)) + (a.documentos_pendientes.length ? '<div style="font-size:10px;color:#64748b;margin-top:3px">Pendiente: ' + esc(a.documentos_pendientes.join(', ')) + '</div>' : '');
  }
}
function decorarVisitas() {
  var sec = document.getElementById('sec-visitas'); if (!sec || !D.data) return;
  var v = D.data.actividades.filter(function (a) { return a.tipo === 'VISITA' && (!D.data.esAdmin || true); });
  var old = document.getElementById('cumplVisitasAviso'); if (old) old.remove();
  if (!v.length) return;
  var box = document.createElement('div'); box.id = 'cumplVisitasAviso'; box.className = 'cumpl-card';
  box.innerHTML = '<div style="font-weight:800;color:#0b1e45;margin-bottom:6px">📋 Cumplimiento de informes de visita</div>' +
    v.slice(0, 15).map(function (a) { return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 0;border-bottom:1px solid var(--bd);font-size:12px">' + badge(a.estado, plazoTxt(a)) + '<span><b>' + esc(a.responsable) + '</b> — ' + esc(a.documentos_pendientes[0] || a.actividad) + ' · límite ' + dmy(a.fecha_limite) + '</span></div>'; }).join('');
  sec.insertBefore(box, sec.firstChild);
}

/* ── restricciones progresivas ── */
function aplicarRestricciones() {
  var rs = D.data && D.data.restriccion; var activa = !!(rs && rs.activa) && !D.data.esAdmin;
  Object.keys(NAV_MOD).forEach(function (k) {
    var b = document.getElementById(NAV_MOD[k]); if (!b) return;
    var restr = activa && rs.modulos.indexOf(k) >= 0;
    if (restr && !b._cumplRestr) {
      b._cumplRestr = function (ev) { ev.preventDefault(); ev.stopImmediatePropagation(); modalRestriccion(k); };
      b.addEventListener('click', b._cumplRestr, true); b.style.opacity = '.55'; b.title = 'Restringido temporalmente por incumplimiento';
      if (!b.querySelector('.cumpl-lock')) b.insertAdjacentHTML('beforeend', '<span class="cumpl-lock" style="margin-left:auto;font-size:11px">🔒</span>');
    } else if (!restr && b._cumplRestr) {
      b.removeEventListener('click', b._cumplRestr, true); b._cumplRestr = null; b.style.opacity = ''; b.title = ''; var l = b.querySelector('.cumpl-lock'); if (l) l.remove();
    }
  });
  window._cumplExportRestringido = activa && rs.modulos.indexOf('exportar') >= 0;
}
var _expOrig = window.exportarExcelGen;
if (typeof _expOrig === 'function') {
  window.exportarExcelGen = function () { if (window._cumplExportRestringido) { modalRestriccion('exportar'); return; } return _expOrig.apply(this, arguments); };
}
function modalRestriccion(k) {
  var ov = document.createElement('div'); ov.className = 'cumpl-ov';
  ov.innerHTML = '<div class="cumpl-mod" style="max-width:520px"><div class="hd">⛔ FUNCIÓN TEMPORALMENTE RESTRINGIDA</div><div class="bd">' +
    '<p style="margin:0 0 10px;font-size:13.5px;line-height:1.5">Esta función queda restringida mientras tengas <b>incumplimientos críticos</b> (' + esc(D.data.restriccion.motivo) + ').</p>' +
    '<p style="margin:0 0 10px;font-size:12.5px;color:#334155">Sigues pudiendo consultar información, abrir tus casos pendientes, subir documentos y cerrarlos. Al regularizar, el acceso se restablece solo. El coordinador también puede levantar la restricción.</p>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="cumpl-btn gris" id="cumplRsC">Cerrar</button><button class="cumpl-btn rojo" id="cumplRsV">VER MIS PENDIENTES</button></div></div></div>';
  document.body.appendChild(ov);
  document.getElementById('cumplRsC').onclick = function () { ov.remove(); };
  document.getElementById('cumplRsV').onclick = function () { ov.remove(); togglePanel(); };
}

/* ── justificacion obligatoria + recarga tras guardar ── */
function pedirJustificacion(nro, a) {
  return new Promise(function (resolve) {
    var ov = document.createElement('div'); ov.className = 'cumpl-ov';
    ov.innerHTML = '<div class="cumpl-mod" style="max-width:560px"><div class="hd">📝 MOTIVO DEL INCUMPLIMIENTO DEL PLAZO</div><div class="bd">' +
      '<p style="margin:0 0 8px;font-size:13px">Caso <b>N° ' + esc(nro) + '</b>' + (a ? ' · ' + esc(a.actividad) + ' · límite ' + dmy(a.fecha_limite) + ' · <b style="color:#b91c1c">' + a.dias_retraso + ' día(s) de retraso</b>' : '') + '</p>' +
      '<label style="font-size:12px;font-weight:700;color:#334155">Explique el motivo por el cual la actividad no fue atendida dentro del plazo establecido <span style="color:#dc2626">*</span></label>' +
      '<textarea id="cumplJustTxt" rows="4" style="width:100%;margin-top:6px;padding:9px 11px;border:2px solid #dc2626;border-radius:8px;font-size:13px;font-family:Barlow,sans-serif;box-sizing:border-box" placeholder="Mínimo 10 caracteres…"></textarea>' +
      '<p style="margin:8px 0 0;font-size:11px;color:#64748b">Queda registrado con usuario, fecha, hora, caso y días de retraso, disponible para el coordinador.</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="cumpl-btn gris" id="cumplJC">Cancelar</button><button class="cumpl-btn rojo" id="cumplJO">REGISTRAR Y CONTINUAR</button></div></div></div>';
    document.body.appendChild(ov);
    document.getElementById('cumplJC').onclick = function () { ov.remove(); resolve(null); };
    document.getElementById('cumplJO').onclick = function () { var t = document.getElementById('cumplJustTxt').value.trim(); if (t.length < 10) { mostrarToast('La justificación debe tener al menos 10 caracteres', 'error'); return; } ov.remove(); resolve(t); };
    setTimeout(function () { try { document.getElementById('cumplJustTxt').focus(); } catch (e) {} }, 50);
  });
}
/* _CUMPL_JUST_FIX_V1 (27-set-2026): este envoltorio se instala AL FINAL de la carga, por FUERA de todos los
   demas (Casos en Azure, etc.). Antes quedaba por dentro y, con Casos en Azure, cerrar un caso fuera de plazo
   no pedia la justificacion ni la registraba. */
var _postPrev = null;
function _cumplInstalarJustif() {
_postPrev = window.apiPost;
if (typeof _postPrev === 'function' && !_postPrev._cumplJustOk) {
  window.apiPost = async function (b) {
    var self = this, args = arguments;
    try {
      if (b && b.action === 'updateCaso' && b.estado_gestion && ['CERRADO', 'CONCLUIDO', 'RESUELTO', 'FINALIZADO'].some(function (s) { return String(b.estado_gestion).toUpperCase().indexOf(s) >= 0; })) {
        var a = actDe(b.nro);
        var lim = b.fecha_limite ? new Date(String(b.fecha_limite).slice(0, 10) + 'T00:00:00') : null;
        var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        var retraso = a ? a.dias_retraso : (lim ? Math.max(0, Math.round((hoy - lim) / 86400000)) : 0);
        if (retraso > 0) {
          var just = String(b.motivo_retraso || '').trim();
          if (just.length < 10) { just = await pedirJustificacion(b.nro, a); if (!just) return { success: false, error: 'Debes registrar el motivo del incumplimiento para cerrar el caso.' }; b.motivo_retraso = just; }
          b._cumplJust = { nro: b.nro, actividad: a ? a.actividad : 'Cierre del caso', fecha_limite: a ? a.fecha_limite : (b.fecha_limite || ''), dias_retraso: retraso, justificacion: just };
        }
      }
    } catch (e) { console.warn('[_CUMPL_UI_V1] justif:', e.message); }
    var r = await _postPrev.apply(self, args);
    try {
      if (r && r.success && b) {
        if (b._cumplJust) { var j = b._cumplJust; _postPrev.call(self, { action: 'cumplJustificar', usuario: USER.usuario, nro: j.nro, actividad: j.actividad, fecha_limite: j.fecha_limite, dias_retraso: j.dias_retraso, justificacion: j.justificacion }).catch(function () {}); }
        if (['saveCaso', 'updateCaso', 'saveVisita', 'deleteCaso'].indexOf(b.action) >= 0) setTimeout(function () { cargar('tras ' + b.action, true); }, 1500);
      }
    } catch (e) {}
    return r;
  };
  window.apiPost._cumplJustOk = true;
  try { apiPost = window.apiPost; } catch (e) {}
}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _cumplInstalarJustif); else _cumplInstalarJustif();

/* ── indice de cumplimiento (supervisor) ── */
function pintarIndice() {
  if (!D.data || D.data.esAdmin || !D.data.indice) return;
  var ix = D.data.indice, cfg = D.data.config;
  var _sd = ix.porcentaje === null || ix.porcentaje === undefined || ix.nivel === 'SIN DATOS';   /* _IND_FIX_V1: aun sin nada que evaluar este mes */
  var col = _sd ? '#64748b' : ix.nivel === 'EXCELENTE' ? '#16a34a' : ix.nivel === 'REGULAR' ? '#d97706' : '#dc2626';
  var ico = _sd ? '⚪ Sin datos aún este mes' : ix.nivel === 'EXCELENTE' ? '🟢 Excelente cumplimiento' : ix.nivel === 'REGULAR' ? '🟡 Cumplimiento regular' : '🔴 Cumplimiento bajo';
  var host = document.getElementById('cumplIndiceCard');
  if (!host) {
    var sec = document.getElementById('sec-dashboard'); if (!sec) return;
    var ref = sec.querySelector('.sg') || sec.querySelector('#alertCumplBanner') || sec.firstElementChild;
    host = document.createElement('div'); host.id = 'cumplIndiceCard'; host.className = 'cumpl-card';
    if (ref && ref.parentNode === sec) sec.insertBefore(host, ref.nextSibling); else sec.appendChild(host);
  }
  var kpi = function (n, l) { return '<div class="cumpl-kpi"><div class="n">' + n + '</div><div class="l">' + l + '</div></div>'; };
  host.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
    '<div><div style="font-size:11px;font-weight:800;letter-spacing:.6px;color:#64748b;text-transform:uppercase">Índice de Cumplimiento · ' + esc(ix.mes) + '</div><div style="font-size:34px;font-weight:900;color:' + col + ';line-height:1.1">' + (_sd ? '—' : ix.porcentaje + '%') + '</div><div style="font-size:12.5px;font-weight:700;color:' + col + '">' + ico + '</div></div>' +
    '<div style="flex:1;min-width:180px;max-width:360px"><div style="height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden"><div style="height:100%;width:' + (_sd ? 0 : ix.porcentaje) + '%;background:' + col + ';transition:width .8s"></div></div><div style="font-size:10.5px;color:#64748b;margin-top:4px">Excelente ≥ ' + cfg.excelente + '% · Regular ≥ ' + cfg.regular + '%</div></div>' +
    '<button class="cumpl-btn" onclick="document.getElementById(\'cumplBell\').click()">VER MIS PENDIENTES</button></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' + kpi(ix.visitas_programadas, 'Visitas programadas') + kpi(ix.visitas_realizadas, 'Visitas realizadas') + (ix.visitas_fuera_plazo ? kpi(ix.visitas_fuera_plazo, 'Visitas subidas tarde') : '') + kpi(ix.visitas_pendientes, 'Visitas pendientes')   /* _VISITA_PLAZO_V1 */  +
    kpi(ix.casos_asignados, 'Casos del mes') + kpi(ix.casos_en_plazo, 'Cerrados en plazo') + kpi(ix.casos_fuera_plazo, 'Cerrados fuera de plazo') + kpi(ix.casos_vencidos, 'Casos vencidos') +
    kpi(ix.casos_en_investigacion, 'En investigación') + kpi(ix.documentos_pendientes, 'Documentos pendientes') + kpi(ix.promedio_dias_cierre, 'Días prom. de cierre') + '</div>' +
    (ix.detalle_vencidos && ix.detalle_vencidos.length ? '<div style="margin-top:12px;font-size:12px"><b style="color:#b91c1c">Casos que afectan tu indicador:</b> ' + ix.detalle_vencidos.map(function (v) { return '<span style="display:inline-block;margin:3px 4px 0 0;padding:3px 8px;background:#fee2e2;border-radius:8px;color:#7f1d1d">N° ' + esc(v.caso) + ' · ' + esc(v.trabajador) + ' · ' + v.dias_retraso + ' d</span>'; }).join('') + '</div>' : '');
}

/* ── panel del coordinador ── */
function crearNavAdmin() {
  if (!esAdmin() || document.getElementById('navCumpl')) return;
  var ref = document.getElementById('navCasos'); if (!ref) return;
  var b = document.createElement('button'); b.className = 'ni'; b.id = 'navCumpl'; b.style.position = 'relative';
  b.innerHTML = '<span class="ic">🎯</span>Control de Cumplimiento<span id="cumplNavN" style="display:none;background:#dc2626;color:#fff;border-radius:10px;font-size:10px;font-weight:700;min-width:17px;height:17px;line-height:17px;text-align:center;padding:0 4px;margin-left:auto"></span>';
  b.onclick = function () { ir('cumplimiento', b); cargarPanelAdmin(false); };
  ref.parentNode.insertBefore(b, ref.nextSibling);
  var content = document.querySelector('.content'); if (!content) return;
  var sec = document.createElement('div'); sec.className = 'sec'; sec.id = 'sec-cumplimiento';
  sec.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px"><h2 style="margin:0;font-size:18px;color:#0b1e45">🎯 Control de Cumplimiento — Supervisores GH</h2><button class="cumpl-btn" onclick="_cumplPanelAdmin(true)">🔄 Actualizar</button></div>' +
    '<div class="cumpl-tabs"><button class="on" data-t="tabla">Resumen por supervisor</button><button data-t="acts">Actividades</button><button data-t="just">Justificaciones</button><button data-t="hist">Historial</button><button data-t="cfg">⚙️ Plazos y reglas</button></div>' +
    '<div id="cumplAdminBody" class="cumpl-card"><p style="color:#64748b">Cargando…</p></div>';
  content.appendChild(sec);
  sec.querySelectorAll('.cumpl-tabs button').forEach(function (t) { t.onclick = function () { sec.querySelectorAll('.cumpl-tabs button').forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); D.tab = t.getAttribute('data-t'); pintarAdmin(); }; });
  D.tab = 'tabla';
}
window._cumplPanelAdmin = cargarPanelAdmin;
/* _AUSENCIAS_V1: insignias de ausencia / reemplazo en la tabla del coordinador */
function _ausInsignias(s) {
  var T = { 'VACACIONES': '🏖️ Vacaciones', 'DESCANSO MEDICO': '🏥 Descanso médico', 'ACCIDENTE': '🚑 Accidente', 'LICENCIA': '📄 Licencia', 'OTRO': '📌 Ausente' }, h = '';
  if (s.ausencia) h += '<br><span class="cumpl-bd" style="background:#fef3c7;color:#92400e;display:inline-block;margin-top:3px">' + (T[s.ausencia.tipo] || '📌 Ausente') + (s.ausencia.hasta ? ' hasta ' + dmy(s.ausencia.hasta) : '') + '</span>' + (s.ausencia.reemplazo ? '<br><span style="font-size:10.5px;color:#64748b">lo cubre ' + esc(s.ausencia.reemplazo) + '</span>' : '');
  (s.cubriendo || []).forEach(function (c) { h += '<br><span class="cumpl-bd" style="background:#ede9fe;color:#5b21b6;display:inline-block;margin-top:3px">🔄 Cubre a ' + esc(c.nombre) + (c.hasta ? ' hasta ' + dmy(c.hasta) : '') + '</span>'; });
  return h;
}
async function cargarPanelAdmin(forzar) {
  if (!esAdmin()) return;
  if (D.panel && !forzar && (Date.now() - D.panelTs) < 120000) { pintarAdmin(); return; }
  var body = document.getElementById('cumplAdminBody'); if (body && !D.panel) body.innerHTML = '<p style="color:#64748b">Cargando…</p>';
  try {
    var r = await apiPost({ action: 'cumplPanel', usuario: USER.usuario, rol: USER.rol });
    if (r && r.success) { D.panel = r; D.panelTs = Date.now(); var n = document.getElementById('cumplNavN'); if (n) { var tot = r.supervisores.reduce(function (s, x) { return s + x.vencidos; }, 0); n.textContent = tot; n.style.display = tot ? 'inline-block' : 'none'; } }
    else if (body) body.innerHTML = '<p style="color:#dc2626">' + esc((r && r.error) || 'Error') + '</p>';
  } catch (e) { if (body) body.innerHTML = '<p style="color:#dc2626">' + esc(e.message) + '</p>'; }
  pintarAdmin();
}
function pintarAdmin() {
  var body = document.getElementById('cumplAdminBody'); if (!body || !D.panel) return;
  var t = D.tab || 'tabla', P = D.panel;
  if (t === 'tabla') {
    var f = D.f = D.f || {};
    var sectores = {}; P.supervisores.forEach(function (s) { if (s.sector) sectores[s.sector] = 1; });
    var filas = P.supervisores.filter(function (s) { return (!f.sup || s.usuario === f.sup) && (!f.sector || s.sector === f.sector) && (!f.nivel || s.nivel === f.nivel) && (!f.est || (f.est === 'critico' ? s.criticos > 0 : f.est === 'vencido' ? s.vencidos > 0 : f.est === 'porvencer' ? s.por_vencer > 0 : true)); });
    var kpi = function (n, l, c) { return '<div class="cumpl-kpi"><div class="n" style="color:' + (c || '#0b1e45') + '">' + n + '</div><div class="l">' + l + '</div></div>'; };
    var sum = function (k) { return P.supervisores.reduce(function (s, x) { return s + (x[k] || 0); }, 0); };
    body.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + kpi(P.supervisores.length, 'Supervisores') + kpi(sum('en_plazo'), 'En plazo', '#16a34a') + kpi(sum('por_vencer'), 'Por vencer', '#d97706') + kpi(sum('vencidos'), 'Vencidos', '#dc2626') + kpi(sum('criticos'), 'Críticos', '#0f172a') + kpi(P.supervisores.filter(function (s) { return s.restriccion; }).length, 'Restringidos', '#7f1d1d') + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<select class="cumpl-sel" id="cfSup"><option value="">Todos los supervisores</option>' + P.supervisores.map(function (s) { return '<option value="' + esc(s.usuario) + '"' + (f.sup === s.usuario ? ' selected' : '') + '>' + esc(s.nombre) + '</option>'; }).join('') + '</select>' +
      '<select class="cumpl-sel" id="cfSector"><option value="">Todos los sectores</option>' + Object.keys(sectores).sort().map(function (s) { return '<option' + (f.sector === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      '<select class="cumpl-sel" id="cfEst"><option value="">Cualquier estado</option><option value="porvencer"' + (f.est === 'porvencer' ? ' selected' : '') + '>Con actividades por vencer</option><option value="vencido"' + (f.est === 'vencido' ? ' selected' : '') + '>Con vencidos</option><option value="critico"' + (f.est === 'critico' ? ' selected' : '') + '>Con incumplimiento crítico</option></select>' +
      '<select class="cumpl-sel" id="cfNivel"><option value="">Cualquier nivel</option>' + ['EXCELENTE', 'REGULAR', 'BAJO', 'SIN DATOS'].map(function (n) { return '<option' + (f.nivel === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
      '<div style="overflow:auto"><table class="cumpl-tb"><thead><tr><th>Supervisor</th><th>Sector</th><th style="text-align:right">Visitas pend.</th><th style="text-align:right">Casos</th><th style="text-align:right">En plazo</th><th style="text-align:right">Por vencer</th><th style="text-align:right">Vencidos</th><th style="text-align:right">% Cumplimiento</th><th>Restricción</th></tr></thead><tbody>' +
      (filas.length ? filas.map(function (s) {
        var _sd = s.porcentaje === null || s.porcentaje === undefined || s.nivel === 'SIN DATOS';   /* _IND_FIX_V1 */
        var col = _sd ? '#94a3b8' : s.nivel === 'EXCELENTE' ? '#16a34a' : s.nivel === 'REGULAR' ? '#d97706' : '#dc2626';
        return '<tr><td><b>' + esc(s.nombre) + '</b><br><span style="color:#64748b;font-size:10.5px">' + esc(s.empresa) + '</span>' + _ausInsignias(s) + '</td><td>' + esc(s.sector) + '</td><td style="text-align:right">' + s.visitas_pendientes + '</td><td style="text-align:right">' + s.casos_abiertos + '</td><td style="text-align:right;color:#16a34a;font-weight:700">' + s.en_plazo + '</td><td style="text-align:right;color:#d97706;font-weight:700">' + s.por_vencer + '</td><td style="text-align:right;color:#dc2626;font-weight:800">' + s.vencidos + (s.criticos ? ' <span title="críticos">⚫' + s.criticos + '</span>' : '') + '</td>' +
          '<td style="text-align:right"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:70px;height:7px;background:#eef2f6;border-radius:5px;overflow:hidden"><div style="height:100%;width:' + (_sd ? 0 : s.porcentaje) + '%;background:' + col + '"></div></div><b style="color:' + col + '" title="' + (_sd ? 'Aún sin casos ni semanas de visita que evaluar este mes' : '') + '">' + (_sd ? 'Sin datos' : s.porcentaje + '%') + '</b></div></td>' +
          '<td>' + (s.restriccion ? '<span class="cumpl-bd" style="background:#fee2e2;color:#7f1d1d">⛔ ACTIVA</span> <button class="cumpl-btn gris" style="margin:0;padding:3px 8px" onclick="_cumplLevantar(\'' + esc(s.usuario) + '\',\'' + esc(s.nombre) + '\')">Levantar</button>' : s.exonerado_hasta ? '<span style="font-size:10.5px;color:#64748b">levantada hasta ' + dmy(s.exonerado_hasta) + '</span>' : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:14px">Sin supervisores para ese filtro</td></tr>') + '</tbody></table></div>';
    ['cfSup', 'cfSector', 'cfEst', 'cfNivel'].forEach(function (id) { var el = document.getElementById(id); if (el) el.onchange = function () { D.f = { sup: document.getElementById('cfSup').value, sector: document.getElementById('cfSector').value, est: document.getElementById('cfEst').value, nivel: document.getElementById('cfNivel').value }; pintarAdmin(); }; });
  } else if (t === 'acts') {
    var g = D.g = D.g || {};
    var acts = P.actividades.filter(function (a) { return (!g.tipo || a.tipo === g.tipo) && (!g.est || a.estado === g.est) && (!g.sup || a.usuario === g.sup) && (!g.mes || String(a.fecha_limite || '').slice(0, 7) === g.mes || String(a.fecha_registro || '').slice(0, 7) === g.mes); });
    var meses = {}; P.actividades.forEach(function (a) { var m = String(a.fecha_limite || '').slice(0, 7); if (m) meses[m] = 1; });
    body.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<select class="cumpl-sel" id="cgTipo"><option value="">Casos y visitas</option><option value="CASO"' + (g.tipo === 'CASO' ? ' selected' : '') + '>Solo casos</option><option value="VISITA"' + (g.tipo === 'VISITA' ? ' selected' : '') + '>Solo visitas</option></select>' +
      '<select class="cumpl-sel" id="cgEst"><option value="">Todos los estados</option>' + Object.keys(EST).map(function (k) { return '<option value="' + k + '"' + (g.est === k ? ' selected' : '') + '>' + EST[k].ico + ' ' + EST[k].txt + '</option>'; }).join('') + '</select>' +
      '<select class="cumpl-sel" id="cgSup"><option value="">Todos los supervisores</option>' + P.supervisores.map(function (s) { return '<option value="' + esc(s.usuario) + '"' + (g.sup === s.usuario ? ' selected' : '') + '>' + esc(s.nombre) + '</option>'; }).join('') + '</select>' +
      '<select class="cumpl-sel" id="cgMes"><option value="">Todos los meses</option>' + Object.keys(meses).sort().reverse().map(function (m) { return '<option' + (g.mes === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
      '<span style="align-self:center;font-size:12px;color:#64748b">' + acts.length + ' actividad(es)</span></div>' +
      '<div style="overflow:auto"><table class="cumpl-tb"><thead><tr><th>Estado</th><th>Responsable</th><th>Caso</th><th>Actividad</th><th>Registro</th><th>Límite</th><th>Días</th><th>Pendiente</th><th></th></tr></thead><tbody>' +
      (acts.length ? acts.map(function (a) { return '<tr><td>' + badge(a.estado) + '</td><td>' + esc(a.responsable) + (a.cubre_a ? '<br><span style="color:#5b21b6;font-size:10.5px">🔄 cubre a ' + esc(a.cubre_a) + '</span>' : '') + '</td><td><b>' + esc(a.caso) + '</b>' + (a.trabajador ? '<br><span style="color:#64748b;font-size:10.5px">' + esc(a.trabajador) + '</span>' : '') + '</td><td>' + esc(a.actividad) + (a.motivo ? '<br><span style="color:#64748b;font-size:10.5px">' + esc(a.motivo) + '</span>' : '') + '</td><td>' + dmy(a.fecha_registro) + '</td><td>' + dmy(a.fecha_limite) + '</td><td style="font-weight:700;color:' + (a.dias_retraso > 0 ? '#dc2626' : '#16a34a') + '">' + (a.dias_retraso > 0 ? '+' + a.dias_retraso : a.dias_restantes) + '</td><td style="font-size:11px">' + esc((a.documentos_pendientes || []).join(', ')) + '</td><td>' + (a.tipo === 'CASO' ? '<button class="cumpl-btn" style="margin:0;padding:3px 8px" onclick="_cumplIrA(\'CASO\',\'' + esc(a.caso) + '\')">Abrir</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="9" style="text-align:center;color:#64748b;padding:14px">Sin actividades</td></tr>') + '</tbody></table></div>';
    ['cgTipo', 'cgEst', 'cgSup', 'cgMes'].forEach(function (id) { var el = document.getElementById(id); if (el) el.onchange = function () { D.g = { tipo: document.getElementById('cgTipo').value, est: document.getElementById('cgEst').value, sup: document.getElementById('cgSup').value, mes: document.getElementById('cgMes').value }; pintarAdmin(); }; });
  } else if (t === 'just') {
    body.innerHTML = '<p style="color:#64748b">Cargando…</p>';
    apiPost({ action: 'cumplJustificaciones', usuario: USER.usuario, rol: USER.rol }).then(function (r) {
      if (!r || !r.success) { body.innerHTML = '<p style="color:#dc2626">' + esc((r && r.error) || 'Error') + '</p>'; return; }
      body.innerHTML = '<div style="overflow:auto"><table class="cumpl-tb"><thead><tr><th>Fecha</th><th>Hora</th><th>Supervisor</th><th>Caso</th><th>Actividad</th><th>Límite</th><th>Retraso</th><th>Justificación</th></tr></thead><tbody>' +
        (r.data.length ? r.data.map(function (j) { return '<tr><td>' + dmy(j.fecha) + '</td><td>' + esc(j.hora) + '</td><td>' + esc(j.nombre || j.usuario) + '</td><td><b>' + esc(j.caso) + '</b></td><td>' + esc(j.actividad) + '</td><td>' + dmy(j.fecha_limite) + '</td><td style="color:#dc2626;font-weight:700">' + esc(j.dias_retraso) + ' d</td><td style="white-space:normal;min-width:220px">' + esc(j.justificacion) + '</td></tr>'; }).join('') : '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:14px">Aún no hay justificaciones registradas</td></tr>') + '</tbody></table></div>';
    });
  } else if (t === 'hist') {
    body.innerHTML = '<p style="color:#64748b">Cargando…</p>';
    apiPost({ action: 'cumplHistorial', usuario: USER.usuario, rol: USER.rol, limite: 400 }).then(function (r) {
      if (!r || !r.success) { body.innerHTML = '<p style="color:#dc2626">' + esc((r && r.error) || 'Error') + '</p>'; return; }
      body.innerHTML = '<div style="overflow:auto"><table class="cumpl-tb"><thead><tr><th>Fecha</th><th>Hora</th><th>Usuario</th><th>Actividad</th><th>Caso</th><th>Antes</th><th>Después</th><th>Docs</th><th>Límite</th><th>Cumplido</th><th>Retraso</th><th>Detalle</th></tr></thead><tbody>' +
        (r.data.length ? r.data.map(function (h) { return '<tr><td>' + dmy(h.fecha) + '</td><td>' + esc(h.hora) + '</td><td>' + esc(h.usuario) + '</td><td>' + esc(h.actividad) + '</td><td>' + esc(h.caso) + '</td><td>' + esc(h.estado_anterior) + '</td><td><b>' + esc(h.estado_nuevo) + '</b></td><td>' + esc(h.documentos) + '</td><td>' + dmy(h.fecha_limite) + '</td><td>' + dmy(h.fecha_cumplimiento) + '</td><td style="color:' + (Number(h.dias_retraso) > 0 ? '#dc2626' : '#16a34a') + ';font-weight:700">' + esc(h.dias_retraso) + '</td><td style="white-space:normal;min-width:180px;font-size:11px">' + esc(h.justificacion || h.detalle) + '</td></tr>'; }).join('') : '<tr><td colspan="12" style="text-align:center;color:#64748b;padding:14px">Sin movimientos aún</td></tr>') + '</tbody></table></div>';
    });
  } else if (t === 'cfg') {
    body.innerHTML = '<p style="color:#64748b">Cargando…</p>';
    apiPost({ action: 'cumplConfigListar', usuario: USER.usuario, rol: USER.rol }).then(function (r) {
      if (!r || !r.success) { body.innerHTML = '<p style="color:#dc2626">' + esc((r && r.error) || 'Error') + '</p>'; return; }
      body.innerHTML = '<p style="margin:0 0 10px;font-size:12.5px;color:#334155">Los plazos se cuentan en <b>días hábiles</b> según el <b>calendario laboral</b> (días laborables y feriados, al final de la tabla): se aplica a casos, visitas, alertas y cumplimiento. Los cambios aplican de inmediato y quedan en el historial.</p>' +
        '<table class="cumpl-tb"><thead><tr><th>Parámetro</th><th>Valor</th><th>Descripción</th><th>Actualizado</th></tr></thead><tbody>' +
        r.filas.filter(function (f) { return f.clave !== 'ausencias' && f.clave !== 'plazos_historial'; }).map(function (f) {   /* _AUSENCIAS_V1: se gestionan en Gestion Usuarios */
          var celda;   /* _CALENDARIO_V1: dias con casillas y feriados en un cuadro */
          if (f.clave === 'dias_laborables') {
            var sel = String(f.valor || '').toUpperCase();
            celda = '<span data-k="dias_laborables" data-tipo="dias">' + ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map(function (dd) { return '<label style="margin-right:8px;white-space:nowrap"><input type="checkbox" value="' + dd + '"' + (sel.indexOf(dd) >= 0 ? ' checked' : '') + '> ' + dd + '</label>'; }).join('') + '</span>';
          } else if (f.clave === 'feriados') {
            var lista = String(f.valor || '').split(/[,;\s]+/).filter(Boolean);
            celda = '<textarea class="cumpl-sel" data-k="feriados" data-tipo="feriados" rows="6" style="width:320px;font-family:monospace;font-size:11.5px" placeholder="aaaa-mm-dd, uno por linea">' + esc(lista.join('\n')) + '</textarea>';
          } else {
            var ancho = String(f.valor).length > 12 ? '320px' : '90px';
            celda = '<input class="cumpl-sel" data-k="' + esc(f.clave) + '" value="' + esc(f.valor) + '" style="width:' + ancho + '">';
          }
          return '<tr><td><code style="font-size:11px">' + esc(f.clave) + '</code></td><td>' + celda + '</td><td style="white-space:normal;font-size:11.5px">' + esc(f.descripcion) + '</td><td style="font-size:11px;color:#64748b">' + dmy(f.actualizado) + (f.por ? '<br>' + esc(f.por) : '') + '</td></tr>'; }).join('') +
        '</tbody></table><div style="text-align:right;margin-top:12px"><button class="cumpl-btn" id="cumplCfgGuardar">💾 Guardar cambios</button></div>';
      /* _PLAZO_VIGENTE_V1: solo jtimoteo cambia plazos y calendario; los demas la ven */
      (function () {
        var nota = document.createElement('p');
        nota.style.cssText = 'margin:10px 0 0;font-size:12.5px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 10px';
        nota.innerHTML = '📌 <b>Cambio de plazos:</b> aplica a los casos que se <b>registren desde hoy</b>. Los casos ya registrados conservan el plazo que tenían (queda en el historial).';
        body.insertBefore(nota, body.querySelector('table'));
        if (String((USER && USER.usuario) || '').toLowerCase() !== 'jtimoteo') {
          body.querySelectorAll('input,textarea,select').forEach(function (x) { x.disabled = true; });
          var bg = document.getElementById('cumplCfgGuardar'); if (bg) bg.style.display = 'none';
          var ro = document.createElement('p'); ro.style.cssText = 'margin:8px 0 0;font-size:12px;color:#64748b'; ro.textContent = '🔒 Solo el administrador del sistema (Joel Timoteo) puede modificar plazos y calendario.';
          body.appendChild(ro);
        }
      })();
      document.getElementById('cumplCfgGuardar').onclick = async function () {
        var cambios = {}; body.querySelectorAll('input[data-k]').forEach(function (i) { cambios[i.getAttribute('data-k')] = i.value.trim(); });
        /* _CALENDARIO_V1 */
        var sd = body.querySelector('[data-tipo="dias"]');
        if (sd) { var dd = Array.prototype.map.call(sd.querySelectorAll('input:checked'), function (c) { return c.value; }); if (!dd.length) { mostrarToast('❌ Marca al menos un día laborable', 'error'); return; } cambios.dias_laborables = dd.join(','); }
        var tf = body.querySelector('[data-tipo="feriados"]');
        if (tf) {
          var malos = [], fer = [];
          tf.value.split(/[,;\s]+/).filter(Boolean).forEach(function (t) { var m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || null, m2 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            var y, mo, da; if (m) { y = +m[1]; mo = +m[2]; da = +m[3]; } else if (m2) { y = +m2[3]; mo = +m2[2]; da = +m2[1]; } else { malos.push(t); return; }
            var x = new Date(y, mo - 1, da); if (x.getFullYear() !== y || x.getMonth() !== mo - 1 || x.getDate() !== da) { malos.push(t); return; }
            var k = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2); if (fer.indexOf(k) < 0) fer.push(k); });
          if (malos.length) { mostrarToast('❌ Feriados con fecha no valida: ' + malos.slice(0, 3).join(', ') + ' (usa aaaa-mm-dd)', 'error'); return; }
          cambios.feriados = fer.sort().join(',');
        }
        var ok = await apiPost({ action: 'cumplConfigGuardar', usuario: USER.usuario, rol: USER.rol, config: cambios });
        if (ok && ok.success) { mostrarToast('✅ Configuración guardada (' + ok.cambios + ' parámetros)'); D.panel = null; D.data = null; cargar('cfg', true); cargarPanelAdmin(true); }
        else mostrarToast('❌ ' + ((ok && ok.error) || 'No se pudo guardar'), 'error');
      };
    });
  }
}
window._cumplLevantar = async function (usuario, nombre) {
  var motivo = await appPrompt('Motivo para levantar la restricción de ' + nombre + ' (7 días):', '');
  if (motivo === null || motivo === undefined) return;
  var r = await apiPost({ action: 'cumplRestriccionLevantar', usuario: USER.usuario, rol: USER.rol, objetivo: usuario, dias: 7, motivo: motivo || 'Levantada por el coordinador' });
  if (r && r.success) { mostrarToast('✅ Restricción levantada hasta ' + dmy(r.hasta)); cargarPanelAdmin(true); } else mostrarToast('❌ ' + ((r && r.error) || 'Error'), 'error');
};

/* ── orquestacion ── */
function pintarTodo() {
  try { pintarCampana(); } catch (e) {}
  try { if (document.getElementById('cumplPanel') && document.getElementById('cumplPanel').style.display === 'block') pintarPanel(); } catch (e) {}
  try { pintarIndice(); } catch (e) {}
  try { aplicarRestricciones(); } catch (e) {}
  try { decorarVisitas(); } catch (e) {}
  try { if (typeof casosData !== 'undefined' && casosData && casosData.length) decorarCasos(casosData); } catch (e) {}
  try { if (!D.gateHecho) { D.gateHecho = true; pantallaEntrada(); } } catch (e) {}
}
(function esperar(n) {
  if (usr()) { crearCampana(); crearNavAdmin(); cargar('inicio'); if (esAdmin()) setTimeout(function () { cargarPanelAdmin(false); }, 4000); return; }
  if (n < 60) setTimeout(function () { esperar(n + 1); }, 500);
})(0);
setInterval(function () { try { if (document.visibilityState === 'visible' && usr()) cargar('auto 5min', true); } catch (e) {} }, 5 * 60 * 1000);
console.log('[_CUMPL_UI_V1] listo');
})();
