/* ═══════════════════════════════════════════════════════════════════════════
   usr-editar.js — _USR_EDITAR_V1 (20-nov-2026, decision de Joel)
   Boton "✏️ Editar" en Gestion de Usuarios (dashboard y usuarios.html): cambia nombre, rol, empresa y correo.
   · Solo lo ve jtimoteo; el servidor (usr/guardar/updateUsuario) vuelve a verificarlo y valida los valores.
   · Solo se envian los campos que cambiaron. Los modulos de "Acceso a Modulos" no se tocan (van por usuario).
   · La hoja Usuarios de Google recibe el mismo cambio (copia), asi la sincronizacion no lo devuelve.
   · El usuario editado ve su nuevo rol al volver a iniciar sesion.
   · Apagar: localStorage.rl_usr_editar = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlUsrEditarOk) return; window._rlUsrEditarOk = true;
  try { if (localStorage.getItem('rl_usr_editar') === 'off') return; } catch (e) {}
  var ROLES = [['administrador', 'Administrador'], ['administrador 01', 'Administrador 01 (solo ver/exportar)'], ['administrador 02', 'Administrador 02 (solo ver/exportar)'], ['supervisor', 'Supervisor']];
  var EMPRESAS = [['AMBAS', 'Todas (sede Piura)'], ['RAPEL', 'RAPEL S.A.C (sede Piura)'], ['VERFRUT', 'VERFRUT S.A.C (sede Piura)'], ['OLMOS', 'OLMOS (sede Olmos)']];
  /* _ALCANCE_V1 (21-nov-2026): cuanto ve el usuario dentro de los modulos que tiene asignados */
  var ALCANCES = [['PROPIO', 'Propio: solo lo que registra'], ['SEDE', 'Sede: todo lo de su sede (jefatura)'], ['GENERAL', 'General: las dos sedes']];
  function yo() { try { return (typeof USER !== 'undefined' && USER) ? String(USER.usuario || '').toLowerCase().trim() : ''; } catch (e) { return ''; } }
  function cache() { try { return (typeof CACHE !== 'undefined' && CACHE && Array.isArray(CACHE.usuarios)) ? CACHE.usuarios : []; } catch (e) { return []; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function aviso(m, ok) { try { if (typeof window.mostrarToast === 'function') return window.mostrarToast(m, ok ? 'success' : 'error', 5000); } catch (e) {} try { if (typeof window.appAlert === 'function') return window.appAlert(m); } catch (e) {} alert(m); }

  var css = document.createElement('style');
  css.textContent = '#ueOv{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:99990}' +
    '#ueOv .ue{background:#fff;border-radius:12px;width:min(460px,94vw);box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:inherit;overflow:hidden}' +
    '#ueOv .ue-h{background:#0F2748;color:#fff;padding:12px 16px;font-weight:700;font-size:14px}' +
    '#ueOv .ue-b{padding:14px 16px;display:grid;gap:10px}#ueOv label{font-size:11px;font-weight:700;color:#334155;display:block;margin-bottom:3px}' +
    '#ueOv input,#ueOv select{width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit}' +
    '#ueOv .ue-n{font-size:11px;color:#64748b;line-height:1.4}#ueOv .ue-f{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;background:#f8fafc}' +
    '#ueOv button{padding:8px 14px;border-radius:8px;border:none;font-weight:700;cursor:pointer;font-size:12px}#ueOv .c{background:#e2e8f0;color:#334155}#ueOv .g{background:#0F2748;color:#fff}' +
    '.btn-a.ue-btn{background:#e0e7ff;color:#1e3a8a;margin-left:4px}';
  document.head.appendChild(css);

  function abrir(usuario) {
    var u = cache().filter(function (x) { return String(x.usuario || '') === usuario; })[0];
    if (!u) { aviso('No encuentro a ' + usuario + ' en la lista. Pulsa Actualizar y vuelve a intentar.'); return; }
    var rolAct = String(u.rol || '').toLowerCase().trim(), empAct = String(u.empresa || '').toUpperCase().trim(), alcAct = String(u.alcance || 'PROPIO').toUpperCase().trim();
    var opt = function (L, v) { var hay = L.some(function (o) { return o[0] === v; }); return (hay ? '' : '<option value="' + esc(v) + '" selected>' + esc(v || '(vacío)') + '</option>') + L.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
    var dueno = usuario.toLowerCase() === 'jtimoteo';
    var ov = document.createElement('div'); ov.id = 'ueOv';
    ov.innerHTML = '<div class="ue"><div class="ue-h">✏️ Editar usuario · ' + esc(usuario) + '</div><div class="ue-b">' +
      '<div><label>Nombre completo</label><input id="ueN" value="' + esc(u.nombre || '') + '" maxlength="200"></div>' +
      '<div><label>Rol</label><select id="ueR"' + (dueno ? ' disabled' : '') + '>' + opt(ROLES, rolAct) + '</select></div>' +
      '<div><label>Empresa / sede</label><select id="ueE">' + opt(EMPRESAS, empAct) + '</select></div>' +
      '<div><label>Alcance (cuánto ve en sus módulos)</label><select id="ueA"' + (dueno ? ' disabled' : '') + '>' + opt(ALCANCES, alcAct) + '</select></div>' +
      '<div><label>Correo</label><input id="ueC" type="email" value="' + esc(u.correo || '') + '"></div>' +
      '<div class="ue-n">Los módulos asignados en Acceso a Módulos no cambian. El alcance nunca cruza de sede, salvo General. El usuario verá el cambio de rol al volver a iniciar sesión.' + (dueno ? ' La cuenta del dueño siempre es Administrador.' : '') + '</div>' +
      '</div><div class="ue-f"><button class="c" type="button" id="ueX">Cancelar</button><button class="g" type="button" id="ueG">Guardar cambios</button></div></div>';
    document.body.appendChild(ov);
    var cerrar = function () { try { ov.remove(); } catch (e) {} };
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.getElementById('ueX').onclick = cerrar;
    document.getElementById('ueG').onclick = async function () {
      var bt = this, n = document.getElementById('ueN').value.replace(/\s+/g, ' ').trim(), r = document.getElementById('ueR').value,
        em = document.getElementById('ueE').value, c = document.getElementById('ueC').value.trim();
      var cambios = {};
      if (n !== String(u.nombre || '').trim()) cambios.nombre = n;
      if (!dueno && r !== rolAct) cambios.rol = r;
      if (em !== empAct) cambios.empresa = em;
      var al = document.getElementById('ueA').value; if (!dueno && al !== alcAct) cambios.alcance = al;
      if (c && c !== String(u.correo || '').trim()) cambios.correo = c;
      if (!Object.keys(cambios).length) { cerrar(); return; }
      if (cambios.nombre === '') { aviso('El nombre no puede quedar vacío.'); return; }
      bt.disabled = true; bt.textContent = 'Guardando…';
      var res = null;
      try { res = await window.apiPost(Object.assign({ action: 'updateUsuario', usuario: usuario }, cambios)); } catch (e) { res = { success: false, error: e.message }; }
      if (!res || res.success === false) { bt.disabled = false; bt.textContent = 'Guardar cambios'; aviso('No se guardó: ' + ((res && res.error) || 'sin respuesta')); return; }
      Object.assign(u, cambios); cerrar();
      aviso('✅ Usuario ' + usuario + ' actualizado' + (cambios.rol ? ' (rol: ' + cambios.rol + ')' : '') + (cambios.alcance ? ' (alcance: ' + cambios.alcance + ')' : ''), true);
      try {
        if (typeof _renderUs === 'function') { if (typeof _usCacheSet === 'function') _usCacheSet(cache()); _renderUs(); if (typeof cargarUs === 'function') cargarUs(true); }
        else if (typeof cargarUs === 'function') { try { delete CACHE.usuarios; } catch (e) {} cargarUs(); }
      } catch (e) {}
    };
  }
  window.rlUsrEditar = abrir;

  function poner() {
    if (yo() !== 'jtimoteo') return;
    var tb = document.getElementById('tbUs'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('button[onclick^="toggleUs("]'), function (b) {
      var td = b.parentNode; if (!td || td.querySelector('.ue-btn')) return;
      var m = (b.getAttribute('onclick') || '').match(/^toggleUs\('([^']+)'/); if (!m) return;
      var e = document.createElement('button'); e.type = 'button'; e.className = 'btn-a ue-btn'; e.textContent = '✏️ Editar';
      e.onclick = function () { abrir(m[1]); };
      b.insertAdjacentElement('afterend', e);
    });
  }
  function vigilar() {
    var tb = document.getElementById('tbUs');
    if (!tb) { setTimeout(vigilar, 1500); return; }
    try { new MutationObserver(function () { setTimeout(poner, 30); }).observe(tb, { childList: true }); } catch (e) {}
    poner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar); else vigilar();
  console.log('[_USR_EDITAR_V1] listo: editar nombre, rol y empresa en Gestion de Usuarios');
})();
