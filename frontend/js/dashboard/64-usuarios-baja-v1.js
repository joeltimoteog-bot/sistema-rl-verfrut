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

  /* _USR_ESTILO_V1 (27-oct-2026): tabla de Gestion de Usuarios ordenada: encabezado fijo, scroll horizontal
     y vertical dentro de la tarjeta (las dos barras siempre a la vista), columna Usuario fija a la izquierda,
     avatar, rol como etiqueta y acciones compactas. Solo presentacion: no cambia datos ni botones. */
  (function () {
    if (document.getElementById('usrEstiloV1')) return;
    var st = document.createElement('style'); st.id = 'usrEstiloV1';
    st.textContent = [
      '#sec-usuarios .card .tw{max-height:calc(100vh - 250px);overflow:auto!important;border:1px solid #e2e8f0;border-radius:14px;background:#fff;scrollbar-width:thin}',
      '#sec-usuarios .card .tw::-webkit-scrollbar{height:10px;width:10px}#sec-usuarios .card .tw::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:8px}#sec-usuarios .card .tw::-webkit-scrollbar-track{background:#f1f5f9}',
      '#sec-usuarios #tbUs{font-size:12.5px}',
      '#sec-usuarios .card .tw>table{width:100%;min-width:1180px;border-collapse:separate;border-spacing:0}',
      '#sec-usuarios .card .tw>table thead th{position:sticky;top:0;z-index:3;white-space:nowrap;font-size:11px;letter-spacing:.06em;padding:11px 12px}',
      '#sec-usuarios #tbUs td{padding:10px 12px;vertical-align:middle;border-bottom:1px solid #eef2f7}',
      '#sec-usuarios #tbUs tr:nth-child(even) td{background:#fafbfd}#sec-usuarios #tbUs tr:hover td{background:#f1f6ff}',
      '#sec-usuarios .card .tw>table thead th:first-child,#sec-usuarios #tbUs td:first-child{position:sticky;left:0;z-index:2;background:inherit}',
      '#sec-usuarios #tbUs td:first-child{background:#fff;min-width:150px;box-shadow:2px 0 0 #eef2f7}',
      '#sec-usuarios .card .tw>table thead th:first-child{z-index:4}',
      '#sec-usuarios #tbUs td:nth-child(2){min-width:210px;max-width:260px;white-space:normal;font-weight:600;color:#1e293b;line-height:1.35}',
      '#sec-usuarios #tbUs td:nth-child(3),#sec-usuarios #tbUs td:nth-child(4){white-space:nowrap}',
      '#sec-usuarios #tbUs td:nth-child(5){max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-size:12px}',
      '#sec-usuarios #tbUs td:nth-child(6){min-width:180px}',
      '#sec-usuarios #tbUs td:nth-child(7){min-width:150px;max-width:220px;white-space:normal}',
      '#sec-usuarios #tbUs td:nth-child(8){min-width:250px}',
      '#sec-usuarios #tbUs td:nth-child(8) .usr-acc{display:flex;flex-wrap:wrap;gap:6px}',
      '#sec-usuarios #tbUs td:nth-child(8) button{margin:0!important;padding:6px 10px!important;font-size:11.5px!important;font-weight:700!important;border-radius:999px!important;line-height:1.1!important;white-space:nowrap}',
      '.usr-av::before{content:attr(data-ini)}.usr-av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;color:#fff;font-weight:800;font-size:11.5px;margin-right:9px;flex:0 0 30px}',
      '.usr-id{display:flex;align-items:center}.usr-id b{font-size:12.5px;color:#0f172a}',
      '.usr-rol{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800}',
      '.usr-rol.adm{background:#ede9fe;color:#5b21b6}.usr-rol.sup{background:#e0f2fe;color:#075985}.usr-rol.otr{background:#f1f5f9;color:#334155}',
      '#usBajaBar{position:sticky;left:0}'
    ].join('\n');
    document.head.appendChild(st);
  })();
  var COLORES = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0d9488', '#9333ea', '#dc2626', '#4f46e5'];
  function adorna() {
    var tb = document.getElementById('tbUs'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      var tds = tr.children; if (tds.length < 8) return;
      if (!tds[0].querySelector('.usr-id')) {
        var usr = (tds[0].textContent || '').trim(), nom = (tds[1].textContent || '').trim(); if (!usr) return;
        var ini = nom.split(/\s+/).filter(Boolean); ini = ((ini[0] || usr)[0] + ((ini[2] || ini[1] || '')[0] || '')).toUpperCase();
        var h = 0; for (var i = 0; i < usr.length; i++) h = (h * 31 + usr.charCodeAt(i)) >>> 0;
        tds[0].innerHTML = '<div class="usr-id"><span class="usr-av" data-ini="' + esc(ini) + '" style="background:' + COLORES[h % COLORES.length] + '"></span><b>' + esc(usr) + '</b></div>';
      }
      if (!tds[2].querySelector('.usr-rol')) {
        var rol = (tds[2].textContent || '').trim(), rk = rol.toLowerCase();
        var cls = rk.indexOf('admin') >= 0 || rk.indexOf('coord') >= 0 || rk.indexOf('jef') >= 0 ? 'adm' : rk.indexOf('superv') >= 0 ? 'sup' : 'otr';
        tds[2].innerHTML = '<span class="usr-rol ' + cls + '">' + esc(rol || '—') + '</span>';
      }
      if (tds[4] && !tds[4].title) tds[4].title = (tds[4].textContent || '').trim();
      var acc = tds[7];
      if (!acc.querySelector('.usr-acc')) {
        var w = document.createElement('div'); w.className = 'usr-acc';
        while (acc.firstChild) w.appendChild(acc.firstChild);
        acc.appendChild(w);
      }
    });
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
      (tds[7].querySelector('.usr-acc') || tds[7]).appendChild(b);
    });
    adorna();
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
