/* ═══════════════════════════════════════════════════════════════════════════
   64-usuarios-baja-v1.js — _USR_BAJA_V1 (27-oct-2026)
   Gestion de Usuarios: contadores Activos / Inactivos / Eliminados + buscador,
   boton "Eliminar" (= dar de baja con motivo; no borra registros) y vista
   "Eliminados" con "Restaurar". Azure: /usr/guardar/eliminarUsuario | restaurarUsuario.
   Si Azure no responde, la tabla se ve exactamente como antes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window._usrBajaV1) return; window._usrBajaV1 = true;
  var BASE = 'https://rl-fn-verfrut.azurewebsites.net/api', DUENOS = ['jtimoteo'];
  var ELIM = {}, cargado = false, vista = 'activos', busca = '', ultimoData = null;
  function k(u) { return String(u || '').trim().toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function yo() { try { return k((typeof USER !== 'undefined' && USER && USER.usuario) || JSON.parse(sessionStorage.getItem('user') || '{}').usuario); } catch (e) { return ''; } }
  function aviso(m, t) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, t); } catch (e) {} alert(m); }

  function cargarElim() {
    return fetch(BASE + '/usuarios/lista?incluirEliminados=1', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (!j || !j.success) return; ELIM = {}; (j.data || []).forEach(function (u) { if (u.eliminado) ELIM[k(u.usuario)] = u; }); cargado = true; })
      .catch(function (e) { console.warn('[_USR_BAJA_V1]', e.message); });
  }

  /* barra: contadores + buscador */
  function barra(base) {
    var tb = document.getElementById('tbUs'); if (!tb) return;
    var card = tb.closest('.card'); if (!card) return;
    var bar = document.getElementById('usBajaBar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'usBajaBar';
      bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 12px';
      var tw = card.querySelector('.tw'); card.insertBefore(bar, tw);
    }
    var vivos = base.filter(function (u) { return !ELIM[k(u.usuario)]; });
    var nAct = vivos.filter(function (u) { return u.activo; }).length, nIna = vivos.length - nAct, nEli = Object.keys(ELIM).length;
    function chip(id, txt, n, col) {
      var on = vista === id;
      return '<button type="button" data-v="' + id + '" style="border:1.5px solid ' + col + ';background:' + (on ? col : '#fff') + ';color:' + (on ? '#fff' : col) + ';border-radius:999px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer">' + txt + ' <span style="opacity:.85">' + n + '</span></button>';
    }
    bar.innerHTML = chip('activos', '✅ Activos', nAct, '#15803d') + chip('inactivos', '⏸️ Inactivos', nIna, '#b45309') + chip('eliminados', '🗑️ Eliminados', nEli, '#b91c1c') + chip('todos', 'Todos', vivos.length, '#334155')
      + '<input id="usBajaBusca" type="search" placeholder="🔍 Buscar usuario o nombre…" value="' + esc(busca) + '" style="margin-left:auto;min-width:220px;padding:7px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13px">';
    Array.prototype.forEach.call(bar.querySelectorAll('button[data-v]'), function (b) { b.onclick = function () { vista = b.getAttribute('data-v'); redibujar(); }; });
    var inp = document.getElementById('usBajaBusca');
    inp.oninput = function () { busca = inp.value; redibujar(true); };
  }
  function filtrar(base) {
    var q = k(busca), lista;
    if (vista === 'eliminados') lista = Object.keys(ELIM).map(function (x) { return ELIM[x]; });
    else {
      lista = base.filter(function (u) { return !ELIM[k(u.usuario)]; });
      if (vista === 'activos') lista = lista.filter(function (u) { return u.activo; });
      if (vista === 'inactivos') lista = lista.filter(function (u) { return !u.activo; });
    }
    if (q) lista = lista.filter(function (u) { return k(u.usuario).indexOf(q) >= 0 || k(u.nombre).indexOf(q) >= 0; });
    return lista;
  }
  /* botones por fila */
  function botones() {
    var tb = document.getElementById('tbUs'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      var tds = tr.children; if (tds.length < 8) return;
      var usr = (tds[0].textContent || '').trim(), uk = k(usr); if (!usr) return;
      var v = tds[7].querySelector('.baja-btn'); if (v) v.remove();
      var b = document.createElement('button'); b.className = 'btn-a baja-btn'; b.style.marginLeft = '4px';
      if (ELIM[uk]) {
        var e = ELIM[uk].baja || {};
        tds[5].innerHTML = '<span class="bg binac" style="background:#fee2e2;color:#b91c1c">Eliminado</span><div style="font-size:11px;color:#64748b;margin-top:4px;white-space:normal">' + esc(fmt(e.en)) + (e.por ? ' · por ' + esc(e.por) : '') + (e.motivo ? '<br>' + esc(e.motivo) : '') + '</div>';
        Array.prototype.forEach.call(tds[7].querySelectorAll('button'), function (x) { x.style.display = 'none'; });
        b.textContent = '♻️ Restaurar'; b.style.cssText += ';background:#dcfce7;color:#166534;display:inline-block';
        b.onclick = function () { restaurar(usr, b); };
      } else {
        if (DUENOS.indexOf(uk) >= 0 || uk === yo()) return;
        b.textContent = '🗑️ Eliminar'; b.style.cssText += ';background:#fee2e2;color:#b91c1c';
        b.onclick = function () { eliminar(usr, (tds[1].textContent || '').trim(), b); };
      }
      tds[7].appendChild(b);
    });
  }
  function redibujar(soloTabla) {
    if (!ultimoData || typeof orig !== 'function') return;
    orig.call(window, filtrar(ultimoData));
    if (!soloTabla) barra(ultimoData); else barra(ultimoData), (function () { var i = document.getElementById('usBajaBusca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } })();
    botones();
  }

  /* confirmacion con motivo */
  function pedirMotivo(usr, nombre) {
    return new Promise(function (res) {
      var fondo = document.createElement('div');
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
      fondo.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:inherit">'
        + '<div style="font-size:17px;font-weight:800;color:#b91c1c;margin-bottom:6px">🗑️ Eliminar usuario</div>'
        + '<div style="font-size:13.5px;color:#334155;line-height:1.5"><b>' + esc(usr) + '</b> — ' + esc(nombre) + '<br>No podrá entrar a RR.LL., Capacitaciones ETI, Evaluaciones ETI ni Bienestar, y dejará de aparecer en las listas. <b>Sus registros (atenciones, casos, visitas, capacitaciones) se conservan.</b> Puedes restaurarlo cuando quieras.</div>'
        + '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin:14px 0 4px">Motivo (opcional)</label>'
        + '<input id="bajaMotivo" maxlength="300" placeholder="Ej.: cese 25/10/2026, término de contrato" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px">'
        + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button id="bajaNo" style="padding:9px 16px;border-radius:10px;border:1.5px solid #cbd5e1;background:#fff;font-weight:700;cursor:pointer">Cancelar</button>'
        + '<button id="bajaSi" style="padding:9px 16px;border-radius:10px;border:0;background:#dc2626;color:#fff;font-weight:800;cursor:pointer">Eliminar</button></div></div>';
      document.body.appendChild(fondo);
      var fin = function (v) { fondo.remove(); res(v); };
      fondo.querySelector('#bajaNo').onclick = function () { fin(null); };
      fondo.querySelector('#bajaSi').onclick = function () { fin({ motivo: fondo.querySelector('#bajaMotivo').value || '' }); };
      fondo.onclick = function (e) { if (e.target === fondo) fin(null); };
      setTimeout(function () { var i = fondo.querySelector('#bajaMotivo'); if (i) i.focus(); }, 50);
    });
  }
  function enviar(accion, cuerpo) {
    return fetch(BASE + '/usr/guardar/' + accion, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ client_id: accion + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) }, cuerpo)) })
      .then(function (r) { return r.json(); });
  }
  function recargar() {
    return cargarElim().then(function () { try { delete CACHE.usuarios; } catch (e) {} if (typeof cargarUs === 'function') return cargarUs(); });
  }
  async function eliminar(usr, nombre, btn) {
    var r = await pedirMotivo(usr, nombre); if (!r) return;
    btn.disabled = true; btn.textContent = '…';
    try {
      var d = await enviar('eliminarUsuario', { usuario: usr, motivo: r.motivo });
      if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo eliminar');
      aviso('🗑️ ' + usr + ' eliminado. Sus registros se conservan.');
      await recargar();
    } catch (e) { aviso('❌ ' + e.message, 'error'); btn.disabled = false; btn.textContent = '🗑️ Eliminar'; }
  }
  async function restaurar(usr, btn) {
    btn.disabled = true; btn.textContent = '…';
    try {
      var d = await enviar('restaurarUsuario', { usuario: usr });
      if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo restaurar');
      aviso('♻️ ' + usr + ' restaurado y activo.');
      await recargar();
    } catch (e) { aviso('❌ ' + e.message, 'error'); btn.disabled = false; btn.textContent = '♻️ Restaurar'; }
  }

  /* engancha el dibujo (encima del modulo de seguridad 63) */
  var orig = window._renderUs;
  if (typeof orig !== 'function') return;
  var primera = true;
  window._renderUs = function (data) {
    ultimoData = Array.isArray(data) ? data : (ultimoData || []);
    var r = orig.call(this, filtrar(ultimoData));
    try { barra(ultimoData); botones(); } catch (e) {}
    if (primera) { primera = false; cargarElim().then(function () { redibujar(); }); }
    return r;
  };
  window._usrBajaRecargar = recargar;
})();
