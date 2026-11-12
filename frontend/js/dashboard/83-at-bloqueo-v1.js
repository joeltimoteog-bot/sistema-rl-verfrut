/* ═══════════════════════════════════════════════════════════════════════════
   83-at-bloqueo-v1.js — _AT_BLOQUEO_V1 (12-nov-2026)
   Bloqueo TEMPORAL del Registro de Atenciones (cierre de quincena / cierre de mes), mientras
   el area de Bienestar descarga la base de atenciones para validar los registros.
   ---------------------------------------------------------------------------
   · ADMINISTRADOR (administrador, coordinador, jefatura, creador del sistema): boton
     "Bloqueo" en Mis Atenciones -> programa fecha, hora de inicio, hora de fin y el mensaje;
     ve la lista de bloqueos y puede cancelar cualquiera (si estaba activo, se abre al instante).
     Tambien "Bloquear ahora 30 min".
   · SUPERVISOR: 10 minutos antes ve un aviso. Durante el bloqueo ve el mensaje con la cuenta
     regresiva y no puede abrir "Nueva Atencion". Consultar sigue disponible. Se abre solo.
   · La regla de verdad esta en el SERVIDOR (atenciones/guardar y atenciones/editar) y en el
     Apps Script: aunque esta pantalla no se haya actualizado, durante el bloqueo no se guarda.
     Una atencion enviada en ese rato NO se pierde: queda en la cola del equipo (_ATGUARDA_V1)
     y se envia sola cuando el registro se abre.
   · No toca el nucleo: solo agrega un boton, un aviso y envuelve abrirAt().
   Apagar solo esta pantalla: localStorage.rl_at_bloqueo = 'off' (el servidor sigue mandando).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_at_bloqueo') === 'off') return; } catch (e) {}
  if (window._rlAtBloqueoOk) return; window._rlAtBloqueoOk = true;
  if (typeof AZURE_FN_BASE === 'undefined') return;
  var AZ = AZURE_FN_BASE + '/at-bloqueo/';
  var bloqueos = [], desfase = 0, activoId = null, avisadoFin = false, mensajeDef = '', cargando = false;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var U = function () { try { return (typeof USER !== 'undefined' && USER) ? USER : {}; } catch (e) { return {}; } };
  var exento = function () { var u = U(), r = String(u.rol || '').toLowerCase().trim(); return String(u.usuario || '').toLowerCase() === 'jtimoteo' || /^admin/.test(r) || ['coordinador', 'jefa_rl', 'jefe_rl'].indexOf(r) >= 0; };
  var toast = function (m, t) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, t || 'ok'); } catch (e) {} };
  var ahora = function () { return Date.now() + desfase; };   /* reloj del servidor: no depende de la hora del equipo */
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var hora = function (ms) { var d = new Date(ms - 5 * 3600000); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
  var dia = function (ms) { var d = new Date(ms - 5 * 3600000); return p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(); };
  var hoyLima = function () { var d = new Date(ahora() - 5 * 3600000); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };

  async function api(accion, cuerpo) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    var r = await fetch(AZ + accion, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    if (r.status === 403) throw new Error(j.error || 'Sin permiso');
    if (!r.ok) throw new Error(j.error || ('Servidor ' + r.status));
    return j;
  }
  /* estado: liviano, sin sesion; si falla no pasa nada (el servidor igual decide al guardar) */
  function leerEstado() {
    if (cargando) return; cargando = true;
    fetch(AZ + 'estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.success) { bloqueos = j.bloqueos || []; if (j.ahoraMs) desfase = j.ahoraMs - Date.now(); pintar(); } })
      .catch(function () {}).then(function () { cargando = false; });
  }
  var activo = function () { var a = ahora(); return bloqueos.filter(function (b) { return b.desdeMs <= a && a < b.hastaMs; })[0] || null; };
  var proximo = function () { var a = ahora(); return bloqueos.filter(function (b) { return b.desdeMs > a && b.desdeMs - a <= 10 * 60000; })[0] || null; };

  /* ── estilos ── */
  var css = document.createElement('style'); css.id = 'atBloqCss';
  css.textContent = '\
  #atBloqAviso{margin:0 0 12px 0;border-radius:10px;padding:16px 18px;font-size:13.5px;line-height:1.55}\
  #atBloqAviso.act{background:#fff7ed;border:1.5px solid #c2410c;color:#7c2d12}\
  #atBloqAviso.pre{background:#eff6ff;border:1.5px solid #1d4ed8;color:#1e3a8a}\
  #atBloqAviso.adm{background:#f1f5f9;border:1.5px solid #64748b;color:#0f172a}\
  #atBloqAviso b.t{display:block;font-size:15px;margin-bottom:4px}\
  #atBloqAviso .cta{font-size:22px;font-weight:800;margin-top:8px;font-variant-numeric:tabular-nums}\
  #mAtBloq .modal{max-width:820px;width:96vw;padding:0}\
  .atb-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 22px;background:#EDF1F6;color:#0F2748;border-bottom:1px solid #D6DEE9;border-radius:8px 8px 0 0}\
  .atb-head h3{margin:0;font-size:16px;font-weight:700;color:#0F2748!important;background:transparent!important;border:0!important;padding:0!important}\
  .atb-head small{display:block;font-size:11.5px;color:#5B6B82;font-weight:400;margin-top:2px}\
  .atb-body{padding:16px 22px 22px}\
  .atb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 14px}\
  .atb-grid .full{grid-column:1/-1}\
  .atb-grid label{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}\
  .atb-grid input,.atb-grid select,.atb-grid textarea{width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit}\
  .atb-grid textarea{min-height:84px;resize:vertical}\
  .atb-btn{padding:9px 16px;border:none;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer}\
  .atb-btn.p{background:#0b1e45;color:#fff}.atb-btn.n{background:#e2e8f0;color:#334155}.atb-btn.r{background:#dc2626;color:#fff}.atb-btn.sm{padding:5px 10px;font-size:11.5px}\
  .atb-btn:disabled{opacity:.55;cursor:not-allowed}\
  .atb-tbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:14px}\
  .atb-tbl th{background:#f1f5f9;color:#334155;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase}\
  .atb-tbl td{padding:8px 10px;border-bottom:1px solid #eef2f7}\
  .atb-nota{font-size:12px;color:#475569;margin-top:12px;line-height:1.5}\
  @media(max-width:700px){.atb-grid{grid-template-columns:1fr 1fr}}';
  document.head.appendChild(css);

  /* ── aviso dentro de Mis Atenciones ── */
  function cajaAviso() {
    var el = $('atBloqAviso'); if (el) return el;
    var sec = $('sec-atenciones'); if (!sec) return null;
    el = document.createElement('div'); el.id = 'atBloqAviso'; el.setAttribute('role', 'status'); el.style.display = 'none';
    sec.insertBefore(el, sec.firstChild);
    return el;
  }
  function falta(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return p2(m) + ':' + p2(s % 60); }
  function pintar() {
    var el = cajaAviso(), a = activo(), px = proximo(), btn = $('btnNuevaAt'), ex = exento();
    if (btn) { var cerrar = !!a && !ex; btn.disabled = cerrar; btn.style.opacity = cerrar ? '.5' : ''; btn.title = cerrar ? 'Registro bloqueado temporalmente hasta las ' + hora(a.hastaMs) : ''; }
    if (a) { activoId = a.id; avisadoFin = false; }
    else if (activoId !== null && !avisadoFin) {   /* acaba de terminar (o lo cancelaron): se abre solo */
      avisadoFin = true; activoId = null;
      if (!ex) toast('✅ El registro de atenciones ya está abierto');
      try { if (window.rlAtPendientes && typeof window.rlAtPendientes.reintentar === 'function') setTimeout(window.rlAtPendientes.reintentar, 1500); } catch (e) {}
    }
    if (!el) return;
    if (a && !ex) {
      el.className = 'act'; el.style.display = 'block';
      el.innerHTML = '<b class="t">🔒 Registro de atenciones bloqueado temporalmente</b>' + esc(a.mensaje) +
        '<div class="cta">Se abre a las ' + hora(a.hastaMs) + ' · faltan ' + falta(a.hastaMs - ahora()) + '</div>' +
        '<div style="font-size:12px;margin-top:6px">' + esc(a.motivo) + ' · ' + dia(a.desdeMs) + ' · de ' + hora(a.desdeMs) + ' a ' + hora(a.hastaMs) +
        '. Puedes seguir consultando tus atenciones. La pantalla se desbloquea sola.</div>';
    } else if (a && ex) {
      el.className = 'adm'; el.style.display = 'block';
      el.innerHTML = '<b class="t">🔒 Bloqueo activo para los supervisores hasta las ' + hora(a.hastaMs) + ' (faltan ' + falta(a.hastaMs - ahora()) + ')</b>' +
        esc(a.motivo) + '. Tú sí puedes registrar y editar. <button class="atb-btn r sm" style="margin-left:8px" onclick="ATBLOQ.cancelar(' + a.id + ')">Abrir ahora</button>';
    } else if (px && !ex) {
      el.className = 'pre'; el.style.display = 'block';
      el.innerHTML = '<b class="t">⏳ A las ' + hora(px.desdeMs) + ' se bloqueará el registro de atenciones</b>' + esc(px.motivo) + ': estará cerrado de ' + hora(px.desdeMs) + ' a ' + hora(px.hastaMs) +
        ' mientras Bienestar descarga la base para validar. Termina de guardar lo que tengas abierto.';
    } else { el.style.display = 'none'; el.innerHTML = ''; }
  }

  /* ── Nueva Atencion no se abre durante el bloqueo ── */
  function envolverAbrir() {
    var prev = window.abrirAt;
    if (typeof prev !== 'function' || prev._atBloq) return;
    var w = function () {
      var a = activo();
      if (a && !exento()) {
        var m = a.mensaje + '\n\nSe abre a las ' + hora(a.hastaMs) + '.';
        try { if (typeof appAlert === 'function') appAlert(m); else alert(m); } catch (e) { alert(m); }
        return;
      }
      return prev.apply(this, arguments);
    };
    w._atBloq = true; window.abrirAt = w;
  }

  /* ── panel del administrador ── */
  function montar() {
    if ($('mAtBloq')) return;
    var d = document.createElement('div'); d.className = 'ov'; d.id = 'mAtBloq';
    d.innerHTML = '<div class="modal">\
      <div class="atb-head"><div><h3>Bloqueo temporal del Registro de Atenciones</h3><small>Para el cierre de quincena o de mes, mientras Bienestar descarga la base y valida los registros</small></div>\
        <button class="atb-btn n" onclick="cerrar(\'mAtBloq\')">✕ Cerrar</button></div>\
      <div class="atb-body">\
        <div class="atb-grid">\
          <div><label for="atbMotivo">Motivo</label><select id="atbMotivo"><option>Cierre de quincena</option><option>Cierre de mes</option><option>Otro</option></select></div>\
          <div><label for="atbFecha">Fecha</label><input type="date" id="atbFecha"></div>\
          <div><label for="atbDesde">Desde</label><input type="time" id="atbDesde" value="09:30"></div>\
          <div><label for="atbHasta">Hasta (se abre solo)</label><input type="time" id="atbHasta" value="10:00"></div>\
          <div class="full"><label for="atbMsg">Mensaje que verán los usuarios (la hora de apertura se agrega sola)</label><textarea id="atbMsg" maxlength="600"></textarea></div>\
        </div>\
        <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap">\
          <span style="font-size:12px;color:#475569">Máximo 2 horas por bloqueo. Administradores, coordinador y jefatura no se bloquean.</span>\
          <span style="display:flex;gap:8px"><button class="atb-btn n" id="atbBtnAhora" onclick="ATBLOQ.ahora()">Bloquear ahora 30 min</button>\
          <button class="atb-btn p" id="atbBtnProg" onclick="ATBLOQ.programar()">Programar bloqueo</button></span></div>\
        <div style="overflow-x:auto"><table class="atb-tbl"><thead><tr><th>Fecha</th><th>Horario</th><th>Motivo</th><th>Estado</th><th>Programó</th><th></th></tr></thead>\
          <tbody id="atbTb"><tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">Cargando…</td></tr></tbody></table></div>\
        <div class="atb-nota">Durante el bloqueo los supervisores pueden <b>consultar</b>, pero no registrar ni editar atenciones. Si alguno envía una atención en ese rato, <b>no se pierde</b>: queda guardada en su equipo y entra sola cuando el registro se abre. A la hora de fin se abre solo.</div>\
      </div></div>';
    document.body.appendChild(d);
  }
  async function listar() {
    var tb = $('atbTb'); if (!tb) return;
    try {
      var j = await api('listar', {});
      if (j.ahoraMs) desfase = j.ahoraMs - Date.now();
      mensajeDef = j.mensajePorDefecto || mensajeDef;
      if ($('atbMsg') && !$('atbMsg').value) $('atbMsg').value = mensajeDef;
      var d = j.data || [];
      if (!d.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">Todavía no hay bloqueos programados.</td></tr>'; return; }
      tb.innerHTML = d.map(function (x) {
        var vivo = x.estado === 'Programado' || x.estado === 'Activo';
        return '<tr><td>' + dia(x.desdeMs) + '</td><td>' + hora(x.desdeMs) + ' a ' + hora(x.hastaMs) + '</td><td>' + esc(x.motivo) + '</td>' +
          '<td>' + (vivo ? '<b>' + esc(x.estado) + '</b>' : esc(x.estado)) + (x.cancelado_por ? '<br><span style="font-size:11px;color:#64748b">por ' + esc(x.cancelado_por) + '</span>' : '') + '</td>' +
          '<td>' + esc(x.creado_por) + '</td><td>' + (vivo ? '<button class="atb-btn r sm" onclick="ATBLOQ.cancelar(' + x.id + ')">' + (x.estado === 'Activo' ? 'Abrir ahora' : 'Cancelar') + '</button>' : '') + '</td></tr>';
      }).join('');
    } catch (e) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#b91c1c;padding:18px">❌ ' + esc(e.message) + '</td></tr>'; }
  }
  async function enviar(cuerpo, btnId, texto) {
    var btn = $(btnId), ant = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = '⏳ ' + texto; }
    try {
      var j = await api('programar', cuerpo); if (!j.success) throw new Error(j.error || 'No se pudo programar');
      toast('🔒 Bloqueo programado: ' + dia(j.desdeMs) + ' de ' + hora(j.desdeMs) + ' a ' + hora(j.hastaMs));
      try { if (window.RLTrafico) RLTrafico.emit({ accion: 'Programó bloqueo de atenciones ' + dia(j.desdeMs) + ' ' + hora(j.desdeMs) + '-' + hora(j.hastaMs), destino: 'Supabase' }); } catch (e) {}
      listar(); leerEstado();
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = ant; } }
  }
  var ATBLOQ = {
    abrir: function () {
      if (!exento()) return toast('🔒 Solo el administrador programa el bloqueo', 'error');
      montar(); if (!$('atbFecha').value) $('atbFecha').value = hoyLima(); $('atbFecha').min = hoyLima();
      try { abrir('mAtBloq'); } catch (e) { $('mAtBloq').style.display = 'flex'; }
      listar();
    },
    programar: function () {
      var f = $('atbFecha').value, d = $('atbDesde').value, h = $('atbHasta').value;
      if (!f || !d || !h) return toast('❌ Indica la fecha, la hora de inicio y la hora de fin', 'error');
      if (h <= d) return toast('❌ La hora de fin debe ser posterior a la de inicio', 'error');
      enviar({ motivo: $('atbMotivo').value, fecha: f, desde: d, hasta: h, mensaje: $('atbMsg').value.trim() }, 'atbBtnProg', 'Programando…');
    },
    ahora: async function () {
      var ok = false, t = 'Se bloqueará AHORA el registro de atenciones por 30 minutos para todos los supervisores. ¿Continuar?';
      try { ok = (typeof appConfirm === 'function') ? await appConfirm(t) : confirm(t); } catch (e) { ok = confirm(t); }
      if (!ok) return;
      enviar({ motivo: $('atbMotivo') ? $('atbMotivo').value : 'Cierre de quincena', ahora: true, minutos: 30, mensaje: $('atbMsg') ? $('atbMsg').value.trim() : '' }, 'atbBtnAhora', 'Bloqueando…');
    },
    cancelar: async function (id) {
      var ok = false, t = '¿Cancelar este bloqueo? Si está activo, el registro se abre de inmediato.';
      try { ok = (typeof appConfirm === 'function') ? await appConfirm(t) : confirm(t); } catch (e) { ok = confirm(t); }
      if (!ok) return;
      try { var j = await api('cancelar', { id: id }); if (!j.success) throw new Error(j.error || 'No se pudo cancelar'); toast('✅ Bloqueo cancelado'); listar(); leerEstado(); }
      catch (e) { toast('❌ ' + e.message, 'error'); }
    },
    estado: function () { return { bloqueos: bloqueos, activo: activo(), exento: exento() }; }
  };
  window.ATBLOQ = ATBLOQ;

  /* ── boton del administrador en el encabezado de Mis Atenciones ── */
  function inyectarBoton() {
    if ($('btnAtBloqueo')) return true;
    var ancla = $('btnNuevaAt'); if (!ancla || !ancla.parentNode) return false;
    if (!U().usuario) return false;          /* todavia no cargo la sesion */
    if (!exento()) return true;              /* no es administrador: no hay boton */
    var b = document.createElement('button'); b.className = 'btn-n'; b.id = 'btnAtBloqueo'; b.textContent = '🔒 Bloqueo';
    b.title = 'Programar el bloqueo temporal por cierre de quincena o de mes'; b.style.cssText = 'background:#0b1e45';
    b.onclick = function () { ATBLOQ.abrir(); };
    ancla.parentNode.appendChild(b);
    return true;
  }

  /* ── arranque ── */
  envolverAbrir(); window.addEventListener('load', envolverAbrir);
  if (!inyectarBoton()) { var n = 0, it = setInterval(function () { if (inyectarBoton() || ++n > 60) clearInterval(it); }, 500); }
  setTimeout(leerEstado, 3000);
  /* consulta liviana: cada 5 min; cada 1 min solo si hay un bloqueo activo o por empezar (para enterarse si lo cancelan).
     Los bloqueos programados ya vienen con su hora, asi que empiezan y terminan exactos sin preguntar de nuevo. */
  var ultima = 0;
  setInterval(function () { var cerca = !!activo() || !!proximo(); if (Date.now() - ultima >= (cerca ? 60000 : 300000)) { ultima = Date.now(); leerEstado(); } }, 15000);
  setInterval(function () { if (bloqueos.length) pintar(); }, 1000);          /* cuenta regresiva y apertura sola */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) leerEstado(); });
  console.log('[_AT_BLOQUEO_V1] listo');
})();
