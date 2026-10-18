/* ═══════════════════════════════════════════════════════════════════════════
   _SEGURIDAD_UI_V1 (18-oct-2026) — Compromiso de confidencialidad + "Mi cuenta"
   ---------------------------------------------------------------------------
   1) COMPROMISO: tras iniciar sesión, si el usuario no ha aceptado la versión vigente
      del "Compromiso de confidencialidad y uso del Sistema RR.LL." se muestra una
      ventana que no se puede cerrar hasta aceptar (dos casillas). La aceptación se
      guarda en Azure (POST /compromiso/aceptar: usuario del token, versión, fecha,
      navegador) como constancia. "No acepto" cierra la sesión.
      Si Azure no responde, NO se bloquea al usuario: se vuelve a intentar en el
      siguiente ingreso (y una aceptación pendiente de enviar se reenvía sola).
   2) MI CUENTA (Dashboard): ítem al final del menú con datos de la sesión, estado
      del compromiso, módulos asignados, últimos ingresos (Firebase tráfico) y, para
      administración, la lista de aceptaciones de todos con descarga CSV.
   Se incluye en index.html (hub) y dashboard.html. Reversible: quitar el <script>.
   Versión del texto: COMPROMISO_VERSION en Azure debe coincidir con VERSION de abajo.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._SEGURIDAD_UI_V1) return;
  window._SEGURIDAD_UI_V1 = true;

  var VERSION = '1.0';
  var FECHA_TEXTO = '18-oct-2026';
  var AZ = (function () { try { if (typeof AZURE_FN_BASE === 'string' && AZURE_FN_BASE) return AZURE_FN_BASE; } catch (e) {} return 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api'; })();
  var ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02', 'coordinador', 'jefa_rl'];

  var PUNTOS = [
    ['1. Datos personales.', 'El Sistema RR.LL., creado y administrado por la Coordinación de Relaciones Laborales, contiene datos personales de trabajadores de RAPEL S.A.C. y VERFRUT S.A.C. (DNI, nombre, celular, cargo, fundo) y datos sensibles (salud: descansos médicos y licencias; situación familiar; procesos disciplinarios), protegidos por la Ley N.° 29733 de Protección de Datos Personales y su Reglamento.'],
    ['2. Uso exclusivo.', 'Usaré el sistema únicamente para las funciones de mi cargo. No copiaré, fotografiaré, exportaré ni compartiré información con personas no autorizadas, ni por WhatsApp, correo personal u otros medios.'],
    ['3. Cuenta personal.', 'Mi usuario y contraseña son personales e intransferibles. No los prestaré ni los dejaré escritos. Cerraré sesión al terminar y avisaré de inmediato a Coordinación RR.LL. si sospecho un uso indebido.'],
    ['4. Trazabilidad.', 'Entiendo que el sistema registra quién consulta, registra y modifica cada dato, y que esa información puede ser revisada por la empresa.'],
    ['5. Vigencia.', 'Este compromiso rige mientras tenga acceso al sistema y después de cesar en mis funciones, respecto de la información conocida.']
  ];
  var PIE = 'Versión ' + VERSION + ' · ' + FECHA_TEXTO + ' · Sistema RL v3.0 · Elaborado por Joel Timoteo Gonza, creador y administrador del sistema · Coordinación de Relaciones Laborales.';

  function $(id) { return document.getElementById(id); }
  function usuario() { try { return JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  function token() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function esAdmin(u) { return !!u && ROLES_ADMIN.indexOf(String(u.rol || '').toLowerCase().trim()) >= 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fecha(iso) { try { var d = new Date(iso); if (isNaN(d)) return String(iso || ''); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return ''; } }
  function navegador() {
    var ua = navigator.userAgent || '', b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    var so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    return b + (so ? ' / ' + so : '');
  }
  function post(accion, cuerpo, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, ms || 12000);
    var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: JSON.stringify(cuerpo || {}) };
    if (ctrl) op.signal = ctrl.signal;
    return fetch(AZ + '/compromiso/' + accion, op).then(function (r) { clearTimeout(reloj); return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); }, function (e) { clearTimeout(reloj); throw e; });
  }

  var CSS = '\
#segOv{position:fixed;inset:0;background:linear-gradient(160deg,rgba(10,36,99,.92),rgba(30,58,138,.92));z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:16px;font:14px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a}\
#segOv .md{background:#fff;border-radius:18px;width:min(660px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);animation:segIn .3s cubic-bezier(.2,.9,.3,1.1)}\
@keyframes segIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}\
#segOv .h{padding:16px 22px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:center}\
#segOv .h .ic{width:44px;height:44px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}\
#segOv .h b{font-size:16px;color:#0a2463;display:block}#segOv .h small{color:#64748b;font-size:12px}\
#segOv .b{padding:14px 22px;overflow:auto}\
#segOv .txt{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12.6px;line-height:1.55;max-height:220px;overflow:auto;background:#f8fafc;color:#334155}\
#segOv .txt p{margin:0 0 10px}#segOv .txt b{color:#0a2463}#segOv .txt i{color:#64748b;font-size:11.5px}\
#segOv label.chk{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;font-size:13px;line-height:1.4;cursor:pointer}\
#segOv label.chk input{width:18px;height:18px;margin:1px 0 0;accent-color:#0a2463;flex:none}\
#segOv .firma{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}\
#segOv .firma div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;font-size:12px}\
#segOv .firma span{display:block;font-size:10px;color:#64748b;text-transform:uppercase;font-weight:800}\
#segOv .f{padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;gap:10px;align-items:center;background:#f8fafc;flex-wrap:wrap}\
#segOv .f small{flex:1 1 240px;color:#64748b;font-size:11.5px}\
#segOv .btn{border:none;border-radius:10px;padding:10px 18px;font:800 13px Barlow,"Segoe UI",system-ui,sans-serif;color:#fff;background:#0a2463;cursor:pointer}\
#segOv .btn.g{background:#16a34a}#segOv .btn.s{background:#e2e8f0;color:#334155}#segOv .btn:disabled{opacity:.45;cursor:not-allowed}\
#segOv .err{color:#b91c1c;font-size:12px;font-weight:700;width:100%}\
@media(max-width:600px){#segOv .firma{grid-template-columns:1fr}#segOv .md{border-radius:12px}}\
/* Mi cuenta */\
#navMiCuenta{display:flex;align-items:center;gap:8px}\
#mcOv{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1300;display:none;align-items:center;justify-content:center;padding:16px;font:14px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a}\
#mcOv.on{display:flex}\
#mcOv .md{background:#fff;border-radius:18px;width:min(720px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(2,6,23,.45)}\
#mcOv .h{padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:center;background:linear-gradient(135deg,#0a2463,#1e40af);color:#fff}\
#mcOv .h .mc-av{width:42px;height:42px;border-radius:50%;background:#fff;color:#0a2463;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px}\
#mcOv .h b{font-size:15px;display:block}#mcOv .h small{opacity:.85;font-size:12px}\
#mcOv .x{margin-left:auto;border:none;background:rgba(255,255,255,.16);color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:15px}\
#mcOv .b{padding:16px 20px;overflow:auto}\
#mcOv .kv{display:grid;grid-template-columns:1fr 1fr;gap:10px}\
#mcOv .kv div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.4}\
#mcOv .kv span{display:block;font-size:10px;color:#64748b;text-transform:uppercase;font-weight:800;margin-bottom:2px}\
#mcOv .kv a{color:#2563eb;font-weight:700;cursor:pointer}\
#mcOv h4{margin:16px 0 8px;font-size:12px;text-transform:uppercase;color:#475569;letter-spacing:.4px}\
#mcOv .ses{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}\
#mcOv .ses div{display:flex;gap:10px;padding:9px 12px;font-size:12.5px;border-bottom:1px solid #f1f5f9;align-items:center}\
#mcOv .ses div:last-child{border:none}#mcOv .ses .ok{color:#16a34a;font-weight:800}\
#mcOv .ses .mc-avisar{margin-left:auto;color:#b45309;font-weight:700;cursor:pointer;font-size:11.5px;white-space:nowrap;background:none;width:auto;height:auto;border-radius:0}\
#mcOv table{width:100%;border-collapse:collapse;font-size:12.5px}\
#mcOv td,#mcOv th{padding:7px 10px;border-bottom:1px solid #eef2f7;text-align:left}\
#mcOv th{background:#f8fafc;font-size:10.5px;text-transform:uppercase;color:#475569;position:sticky;top:0}\
#mcOv .pill{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;background:#dcfce7;color:#166534;white-space:nowrap}#mcOv .pill.p{background:#fef3c7;color:#92400e}\
#mcOv .btn{border:none;border-radius:9px;padding:8px 14px;font:800 12px Barlow,"Segoe UI",system-ui,sans-serif;color:#fff;background:#0a2463;cursor:pointer}\
#mcOv .btn.s{background:#e2e8f0;color:#334155}\
#mcOv .pie{padding:10px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;background:#f8fafc;text-align:center}\
@media(max-width:600px){#mcOv .kv{grid-template-columns:1fr}}\
/* cambio de contraseña */\
#pwOv{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:2147483050;display:none;align-items:center;justify-content:center;padding:16px;font:14px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a}\
#pwOv.on{display:flex}\
#pwOv .md{background:#fff;border-radius:18px;width:min(520px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(2,6,23,.45);animation:segIn .3s cubic-bezier(.2,.9,.3,1.1)}\
#pwOv .h{padding:16px 22px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:center}\
#pwOv .h .ic{width:44px;height:44px;border-radius:12px;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none}\
#pwOv .h b{font-size:16px;color:#0a2463;display:block}#pwOv .h small{color:#64748b;font-size:12px}\
#pwOv .b{padding:14px 22px;overflow:auto}\
#pwOv label{display:block;font-size:10.5px;font-weight:800;color:#475569;text-transform:uppercase;margin:10px 0 4px}\
#pwOv input{width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font:500 14px Barlow,"Segoe UI",system-ui,sans-serif;color:#0f172a}\
#pwOv input:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}\
#pwOv .bar{height:6px;border-radius:999px;background:#e2e8f0;margin-top:6px;overflow:hidden}#pwOv .bar i{display:block;height:100%;width:0;background:#dc2626;transition:width .25s,background .25s}\
#pwOv .req{font-size:11.5px;color:#475569;margin-top:6px;line-height:1.7}#pwOv .req span{margin-right:10px;white-space:nowrap}#pwOv .req .ok{color:#16a34a;font-weight:800}#pwOv .req .no{color:#94a3b8}\
#pwOv .f{padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;gap:10px;align-items:center;background:#f8fafc;flex-wrap:wrap}\
#pwOv .f small{flex:1 1 200px;color:#64748b;font-size:11.5px}\
#pwOv .btn{border:none;border-radius:10px;padding:10px 18px;font:800 13px Barlow,"Segoe UI",system-ui,sans-serif;color:#fff;background:#0a2463;cursor:pointer}\
#pwOv .btn.s{background:#e2e8f0;color:#334155}#pwOv .btn:disabled{opacity:.45;cursor:not-allowed}\
#pwOv .err{color:#b91c1c;font-size:12px;font-weight:700;width:100%}';
  try { var st = document.createElement('style'); st.id = 'segCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); } catch (e) {}

  function textoHtml() {
    return PUNTOS.map(function (p) { return '<p><b>' + esc(p[0]) + '</b> ' + esc(p[1]) + '</p>'; }).join('') + '<i>' + esc(PIE) + '</i>';
  }

  /* ── 1) Compromiso ── */
  var estadoCache = null;   /* {aceptado, fecha, version} */
  function claveOk() { var u = usuario(); return 'rl_comp_ok_' + VERSION + '_' + String((u && u.usuario) || '').toLowerCase(); }
  function clavePend() { var u = usuario(); return 'rl_comp_pend_' + VERSION + '_' + String((u && u.usuario) || '').toLowerCase(); }

  function mostrarCompromiso() {
    if ($('segOv')) return;
    var u = usuario() || {};
    var ov = document.createElement('div'); ov.id = 'segOv'; ov.className = 'ov on'; /* 'ov on': el actualizador y el aviso de novedades esperan mientras esté abierta */ ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="md"><div class="h"><div class="ic">🔐</div><div><b>Compromiso de confidencialidad y uso del Sistema RR.LL.</b><small>Antes de continuar, lee y acepta. Toma 1 minuto y se registra una sola vez.</small></div></div>' +
      '<div class="b"><div class="txt">' + textoHtml() + '</div>' +
      '<label class="chk"><input type="checkbox" id="segC1"><span>He leído y <b>acepto</b> el compromiso de confidencialidad y uso del sistema.</span></label>' +
      '<label class="chk"><input type="checkbox" id="segC2"><span>Entiendo que mis acciones en el sistema quedan registradas con mi usuario, fecha y hora.</span></label>' +
      '<div class="firma"><div><span>Usuario</span>' + esc(u.usuario || '') + ' · ' + esc(u.nombre || '') + '</div><div><span>Fecha y hora</span>' + esc(fecha(new Date().toISOString())) + ' · desde ' + esc(navegador()) + '</div></div></div>' +
      '<div class="f"><small>Al pulsar "Acepto y continuar" se guarda tu aceptación (usuario, versión del texto, fecha, hora y equipo) como constancia. Si no aceptas, se cerrará tu sesión; consulta con Coordinación RR.LL.</small>' +
      '<button type="button" class="btn s" id="segNo">No acepto</button><button type="button" class="btn g" id="segSi" disabled>✓ Acepto y continuar</button><div class="err" id="segErr"></div></div></div>';
    document.body.appendChild(ov);
    var c1 = $('segC1'), c2 = $('segC2'), si = $('segSi');
    function habil() { si.disabled = !(c1.checked && c2.checked); }
    c1.onchange = habil; c2.onchange = habil;
    $('segNo').onclick = function () {
      if (!confirm('Si no aceptas el compromiso no puedes usar el sistema y se cerrará tu sesión.\n\n¿Confirmas que NO aceptas?')) return;
      try { sessionStorage.clear(); localStorage.removeItem('rl_session'); } catch (e) {}
      var raiz = /\/frontend\/pages\//.test(location.pathname) ? '../../index.html' : 'index.html';
      location.href = raiz + '?sin_compromiso=1';
    };
    si.onclick = function () {
      si.disabled = true; si.textContent = 'Guardando…'; $('segErr').textContent = '';
      post('aceptar', { version: VERSION, nombre: u.nombre || '', navegador: navegador() }, 15000).then(function (j) {
        if (j && j.success) { aceptado(j.fecha || new Date().toISOString()); return; }
        if (j && j._status === 401) { $('segErr').textContent = 'Tu sesión no es válida. Cierra sesión y vuelve a entrar.'; si.textContent = '✓ Acepto y continuar'; si.disabled = false; return; }
        throw new Error((j && j.error) || 'Azure no respondió');
      }).catch(function (e) {
        /* sin servidor: queda pendiente y se reenvía sola en el siguiente ingreso; no se bloquea al usuario */
        try { localStorage.setItem(clavePend(), JSON.stringify({ version: VERSION, nombre: u.nombre || '', navegador: navegador(), ts: Date.now() })); } catch (e2) {}
        console.warn('[_SEGURIDAD_UI_V1] aceptación pendiente de enviar:', e && e.message);
        aceptado(new Date().toISOString(), true);
      });
    };
  }
  function aceptado(f, pendiente) {
    estadoCache = { aceptado: true, fecha: f, version: VERSION, pendiente: !!pendiente };
    try { sessionStorage.setItem(claveOk(), f); } catch (e) {}
    var ov = $('segOv'); if (ov) { ov.style.transition = 'opacity .25s'; ov.style.opacity = '0'; setTimeout(function () { try { ov.remove(); } catch (e) {} }, 260); }
    try { if (typeof window.mostrarToast === 'function') window.mostrarToast(pendiente ? '✅ Compromiso aceptado (se registrará en cuanto el servidor responda)' : '✅ Compromiso aceptado y registrado', 'ok'); } catch (e) {}
    try { if (window.RLTrafico && window.RLTrafico.emit) window.RLTrafico.emit({ accion: 'Aceptó compromiso de confidencialidad', destino: 'Azure SQL', tipo: 'ok' }); } catch (e) {}
    pintarCuenta();
    setTimeout(revisarClave, 600);
  }
  function reenviarPendiente() {
    var p = null; try { p = JSON.parse(localStorage.getItem(clavePend()) || 'null'); } catch (e) {}
    if (!p) return Promise.resolve(false);
    return post('aceptar', p, 12000).then(function (j) { if (j && j.success) { try { localStorage.removeItem(clavePend()); } catch (e) {} return true; } return false; }).catch(function () { return false; });
  }
  var revisando = false, noAntesDe = 0;
  function revisar() {
    var u = usuario(); if (!u || !u.usuario || !token() || revisando || Date.now() < noAntesDe) return;
    try { if (sessionStorage.getItem(claveOk())) { estadoCache = estadoCache || { aceptado: true, fecha: sessionStorage.getItem(claveOk()), version: VERSION }; return; } } catch (e) {}
    revisando = true;
    reenviarPendiente().then(function () { return post('estado', {}, 12000); }).then(function (j) {
      revisando = false;
      if (!j || !j.success) { if (j && j._status === 401) { noAntesDe = Date.now() + 600000; return; } throw new Error((j && j.error) || 'sin respuesta'); }
      var ver = String(j.version || VERSION);
      if (ver !== VERSION) console.warn('[_SEGURIDAD_UI_V1] versión del servidor ' + ver + ' ≠ ' + VERSION + ' (se usa la del servidor)');
      if (j.aceptado) { estadoCache = { aceptado: true, fecha: j.fecha, version: ver }; try { sessionStorage.setItem(claveOk(), j.fecha || '1'); } catch (e) {} pintarCuenta(); return; }
      estadoCache = { aceptado: false, version: ver };
      mostrarCompromiso();
    }).catch(function (e) {
      revisando = false; noAntesDe = Date.now() + 90000;   /* reintento como mucho cada 90 s */
      /* Azure no respondió: no se bloquea; se vuelve a preguntar en el siguiente ingreso */
      console.warn('[_SEGURIDAD_UI_V1] no se pudo consultar el compromiso:', e && e.message);
    });
  }

  /* ── 2) Mi cuenta (solo Dashboard) ── */
  function crearMiCuenta() {
    var btnOut = document.querySelector('button.logout'); if (!btnOut || $('navMiCuenta')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'navMiCuenta'; b.className = btnOut.className;
    b.innerHTML = '<span>👤</span>Mi cuenta'; b.title = 'Tu sesión, tu compromiso de confidencialidad y tus últimos ingresos';
    b.onclick = abrirCuenta;
    btnOut.parentNode.insertBefore(b, btnOut);
  }
  function ventanaCuenta() {
    var ov = $('mcOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'mcOv'; ov.className = 'ov';
    ov.innerHTML = '<div class="md" role="dialog" aria-modal="true"><div class="h"><div class="mc-av" id="mcAv"></div><div><b id="mcNom"></b><small id="mcSub"></small></div><button type="button" class="x" aria-label="Cerrar">✕</button></div><div class="b" id="mcBody"></div><div class="pie">Sistema RL v3.0 · Creado y administrado por Joel Timoteo Gonza · Coordinación de Relaciones Laborales</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.x').onclick = function () { ov.classList.remove('on'); };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('on'); });
    return ov;
  }
  function abrirCuenta() { var ov = ventanaCuenta(); ov.classList.add('on'); pintarCuenta(); ingresos(); }
  function pintarCuenta() {
    var ov = $('mcOv'); if (!ov || !ov.classList.contains('on')) return;
    var u = usuario() || {};
    var ini = String(u.nombre || u.usuario || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
    $('mcAv').textContent = ini; $('mcNom').textContent = u.nombre || u.usuario || ''; $('mcSub').textContent = (u.usuario || '') + ' · ' + (u.rol || '') + (u.empresa ? ' · ' + u.empresa : '');
    var mods = 0; try { document.querySelectorAll('nav button.ni').forEach(function (b) { if (b.style.display !== 'none' && getComputedStyle(b).display !== 'none' && b.id !== 'navInicio') mods++; }); } catch (e) {}
    var comp = estadoCache && estadoCache.aceptado ? ('Aceptado el ' + fecha(estadoCache.fecha) + ' (v' + (estadoCache.version || VERSION) + ')' + (estadoCache.pendiente ? ' · pendiente de registrar' : '')) : (estadoCache ? 'Pendiente de aceptar' : 'Consultando…');
    var html = '<div class="kv">' +
      '<div><span>Usuario</span>' + esc(u.usuario || '') + ' · ' + esc(u.rol || '') + (u.empresa ? ' · ' + esc(u.empresa) : '') + '</div>' +
      '<div><span>Compromiso de confidencialidad</span>' + esc(comp) + ' · <a id="mcVerTxt">ver texto</a></div>' +
      '<div><span>Contraseña</span>' + (sessionStorage.getItem(claveClaveOk()) ? 'Actualizada en esta sesión' : (claveDebil() ? '<b style="color:#b45309">Débil: conviene cambiarla</b>' : 'Cumple la regla mínima')) + ' · <a id="mcCambiarPw">cambiar</a></div>' +
      '<div><span>Sesión</span>Dura 14 horas · iniciada en este navegador (' + esc(navegador()) + ')</div>' +
      '<div><span>Módulos asignados</span>' + mods + ' en tu menú</div></div>' +
      '<h4>Últimos ingresos</h4><div class="ses" id="mcSes"><div style="color:#64748b">Consultando…</div></div>' +
      (esAdmin(u) ? '<h4>Administración</h4><button type="button" class="btn" id="mcLista">📋 Aceptaciones de todos los usuarios</button> <span id="mcListaRes" style="font-size:12px;color:#64748b"></span><div id="mcTabla" style="margin-top:10px;max-height:300px;overflow:auto"></div>' : '');
    $('mcBody').innerHTML = html;
    $('mcVerTxt').onclick = function () { var d = document.createElement('div'); d.className = 'txt'; d.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.55;background:#f8fafc;margin-top:10px'; d.innerHTML = textoHtml(); $('mcBody').insertBefore(d, $('mcBody').children[1]); this.remove(); };
    if (esAdmin(u)) $('mcLista').onclick = listaAdmin;
    var cp = $('mcCambiarPw'); if (cp) cp.onclick = function () { mostrarClave(false, true); };
  }
  function ingresos() {
    var c = $('mcSes'); if (!c) return;
    var u = usuario() || {}; var yo = String(u.usuario || '').toLowerCase();
    var db = null; try { db = (window.RLTrafico && window.RLTrafico.DB) || null; } catch (e) {}
    var url = (typeof db === 'string' && db ? db.replace(/\/$/, '') : 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com') + '/trafico.json?orderBy=%22$key%22&limitToLast=3000';
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var arr = Object.values(j || {}).filter(function (e) { return e && String(e.u || '').toLowerCase() === yo && /Inició sesión|Entró al dashboard/.test(String(e.accion || '')); });
      arr.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      var vistos = {}, filas = [];
      arr.forEach(function (e) { var k = Math.floor((e.ts || 0) / 600000); if (vistos[k] || filas.length >= 6) return; vistos[k] = 1; filas.push(e); });
      if (!filas.length) { c.innerHTML = '<div style="color:#64748b">Sin registros recientes</div>'; return; }
      c.innerHTML = filas.map(function (e, i) { return '<div><span class="ok">●</span> ' + esc(fecha(new Date(e.ts).toISOString())) + ' · ' + esc(e.accion || '') + (i === 0 ? ' · <b>más reciente</b>' : '') + (i > 0 ? '<span class="mc-avisar" data-ts="' + e.ts + '">¿no fuiste tú? avisar</span>' : '') + '</div>'; }).join('');
      c.querySelectorAll('.mc-avisar').forEach(function (a) { a.onclick = function () { try { if (typeof window.rlReportar === 'function') { window.rlReportar(); } else { var b = $('_rlChatBtn'); if (b) b.click(); } } catch (e) {} try { if (typeof window.mostrarToast === 'function') window.mostrarToast('Cuéntale a Coordinación el ingreso que no reconoces (fecha ' + fecha(new Date(+a.getAttribute('data-ts')).toISOString()) + ')', 'warn'); } catch (e) {} }; });
    }).catch(function () { c.innerHTML = '<div style="color:#64748b">No se pudo consultar</div>'; });
  }
  function listaAdmin() {
    var res = $('mcListaRes'), t = $('mcTabla'); if (!t) return;
    res.textContent = 'Consultando…'; t.innerHTML = '';
    post('lista', {}, 15000).then(function (j) {
      if (!j || !j.success) { res.textContent = (j && j.error) || 'No se pudo consultar'; return; }
      var f = (j.filas || []).filter(function (x) { return x.activo !== false; });
      var ok = f.filter(function (x) { return x.aceptado; }).length;
      res.textContent = ok + ' de ' + f.length + ' usuarios activos aceptaron la v' + j.version + '. ';
      var a = document.createElement('a'); a.textContent = '⬇️ Descargar CSV'; a.style.cssText = 'color:#2563eb;font-weight:700;cursor:pointer';
      a.onclick = function () {
        var csv = 'usuario,nombre,rol,empresa,aceptado,fecha,version,navegador\n' + f.map(function (x) { return [x.usuario, x.nombre, x.rol, x.empresa, x.aceptado ? 'SI' : 'NO', x.fecha ? fecha(x.fecha) : '', x.aceptado ? j.version : '', x.navegador].map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        var b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); var l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'aceptaciones_compromiso_v' + j.version + '_' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(l); l.click(); l.remove();
      };
      res.appendChild(a);
      t.innerHTML = '<table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Compromiso</th><th>Fecha</th><th>Equipo</th></tr></thead><tbody>' +
        f.map(function (x) { return '<tr><td>' + esc(x.usuario) + '</td><td>' + esc(x.nombre) + '</td><td>' + esc(x.rol) + '</td><td>' + (x.aceptado ? '<span class="pill">Aceptado</span>' : '<span class="pill p">Pendiente</span>') + '</td><td>' + (x.fecha ? esc(fecha(x.fecha)) : '—') + '</td><td>' + esc(x.navegador || '') + '</td></tr>'; }).join('') + '</tbody></table>';
    }).catch(function (e) { res.textContent = 'No se pudo consultar: ' + (e && e.message); });
  }
  /* ── 3) Contraseña: regla mínima, aviso si es débil (viene en el token) y cambio por el propio usuario ── */
  function tokenPayload() { try { var t = token(); if (!t) return {}; var p = t.split('.')[1]; p = p.replace(/-/g, '+').replace(/_/g, '/'); while (p.length % 4) p += '='; return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(p), function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''))); } catch (e) { return {}; } }
  function claveDebil() { var p = tokenPayload(); return p.cd === 1; }
  function cambioObligatorio() { var p = tokenPayload(); return p.co === 1; }
  function claveClaveOk() { var u = usuario(); return 'rl_clave_ok_' + String((u && u.usuario) || '').toLowerCase(); }
  function evaluarClave(c, u) {   /* misma regla que shared/clave-politica.js */
    c = String(c || ''); u = String(u || '').trim().toLowerCase(); var cl = c.toLowerCase();
    var r = { largo: c.length >= 8, mayus: /[A-ZÁÉÍÓÚÑ]/.test(c), minus: /[a-záéíóúñ]/.test(c), num: /\d/.test(c), usuario: !(u && u.length >= 3 && cl.indexOf(u) >= 0) };
    var comunes = ['123456', '12345678', 'password', 'contrasena', 'contraseña', 'qwerty', 'abc123', 'verfrut', 'rapel', 'unifrutti', 'admin'];
    r.comun = !comunes.some(function (x) { return cl === x || cl === x + '2025' || cl === x + '2026'; });
    r.ok = r.largo && r.mayus && r.minus && r.num && r.usuario && r.comun;
    return r;
  }
  var pwPospuesta = false;
  function ventanaClave() {
    var ov = $('pwOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'pwOv'; ov.className = 'ov';
    ov.innerHTML = '<div class="md" role="dialog" aria-modal="true"><div class="h"><div class="ic">🔑</div><div><b id="pwTit">Actualiza tu contraseña</b><small id="pwSub">Tu contraseña actual es fácil de adivinar. Elige una nueva que solo tú conozcas.</small></div></div>' +
      '<div class="b"><label>Contraseña actual</label><input type="password" id="pwActual" autocomplete="current-password">' +
      '<label>Nueva contraseña</label><input type="password" id="pwNueva" autocomplete="new-password"><div class="bar"><i id="pwBar"></i></div><div class="req" id="pwReq"></div>' +
      '<label>Repetir nueva contraseña</label><input type="password" id="pwRep" autocomplete="new-password"></div>' +
      '<div class="f"><small>Se guarda cifrada; nadie, ni Coordinación, podrá verla. Si la olvidas, Coordinación te asigna una nueva.</small><button type="button" class="btn s" id="pwLuego">Más tarde</button><button type="button" class="btn" id="pwGuardar" disabled>💾 Guardar nueva contraseña</button><div class="err" id="pwErr"></div></div></div>';
    document.body.appendChild(ov);
    var u = usuario() || {};
    function pintar(sinError) {
      var n = $('pwNueva').value, r = evaluarClave(n, u.usuario), pts = [r.largo, r.mayus, r.minus, r.num, r.usuario, r.comun].filter(Boolean).length;
      $('pwBar').style.width = (pts / 6 * 100) + '%'; $('pwBar').style.background = pts <= 2 ? '#dc2626' : pts <= 4 ? '#f59e0b' : '#16a34a';
      $('pwReq').innerHTML = [['largo', 'Mínimo 8 caracteres'], ['mayus', 'Una mayúscula'], ['minus', 'Una minúscula'], ['num', 'Un número'], ['usuario', 'Sin tu usuario'], ['comun', 'No común']].map(function (x) { return '<span class="' + (r[x[0]] ? 'ok' : 'no') + '">' + (r[x[0]] ? '✓' : '○') + ' ' + x[1] + '</span>'; }).join('');
      var igual = n && n === $('pwRep').value, distinta = n !== $('pwActual').value;
      $('pwGuardar').disabled = !(r.ok && igual && distinta && $('pwActual').value);
      if (sinError !== true) $('pwErr').textContent = (n && $('pwRep').value && !igual) ? 'Las dos contraseñas nuevas no coinciden.' : (n && !distinta ? 'La nueva debe ser distinta a la actual.' : '');
    }
    ['pwActual', 'pwNueva', 'pwRep'].forEach(function (id) { $(id).addEventListener('input', function () { pintar(); }); });
    $('pwLuego').onclick = function () { pwPospuesta = true; ov.classList.remove('on'); };
    $('pwGuardar').onclick = function () {
      var b = $('pwGuardar'); b.disabled = true; b.textContent = 'Guardando…'; $('pwErr').textContent = '';
      var cuerpo = { actual: $('pwActual').value, nueva: $('pwNueva').value, client_id: 'pw-' + Date.now().toString(36) };
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null; var reloj = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 15000);
      var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }, body: JSON.stringify(cuerpo) }; if (ctrl) op.signal = ctrl.signal;
      fetch(AZ + '/usr/guardar/cambiarMiClave', op).then(function (r) { clearTimeout(reloj); return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); }).then(function (j) {
        if (j && j.success) {
          try { sessionStorage.setItem(claveClaveOk(), '1'); } catch (e) {}
          try { var ses = JSON.parse(localStorage.getItem('rl_session') || 'null'); if (ses) { ses.claveCambiada = Date.now(); localStorage.setItem('rl_session', JSON.stringify(ses)); } } catch (e) {}
          ov.classList.remove('on'); $('pwActual').value = ''; $('pwNueva').value = ''; $('pwRep').value = ''; pintar();
          try { if (typeof window.mostrarToast === 'function') window.mostrarToast('✅ Contraseña actualizada. Úsala en tu próximo ingreso.', 'ok'); else alert('Contraseña actualizada.'); } catch (e) {}
          try { if (window.RLTrafico && window.RLTrafico.emit) window.RLTrafico.emit({ accion: 'Cambió su contraseña', destino: 'Azure SQL', tipo: 'ok' }); } catch (e) {}
          pintarCuenta(); return;
        }
        $('pwErr').textContent = (j && j.error) || (j && j._status === 503 ? 'El servidor está en mantenimiento; intenta en unos minutos.' : 'No se pudo guardar. Intenta de nuevo.');
      }).catch(function () { clearTimeout(reloj); $('pwErr').textContent = 'Sin conexión con el servidor. Intenta de nuevo en un momento.'; })
        .then(function () { b.textContent = '💾 Guardar nueva contraseña'; pintar(true); });
    };
    return ov;
  }
  function mostrarClave(obligatorio, desdeCuenta) {
    var ov = ventanaClave();
    $('pwTit').textContent = desdeCuenta ? 'Cambiar mi contraseña' : 'Actualiza tu contraseña';
    $('pwSub').textContent = desdeCuenta ? 'Elige una nueva contraseña que solo tú conozcas.' : 'Tu contraseña actual es fácil de adivinar. Elige una nueva que solo tú conozcas.';
    $('pwLuego').style.display = (obligatorio && !desdeCuenta) ? 'none' : '';
    $('pwLuego').textContent = desdeCuenta ? 'Cancelar' : 'Más tarde';
    ov.classList.add('on'); setTimeout(function () { try { $('pwActual').focus(); } catch (e) {} }, 60);
  }
  function revisarClave() {
    try {
      if (!usuario() || !token() || pwPospuesta) return;
      if (sessionStorage.getItem(claveClaveOk())) return;
      if (!claveDebil()) return;
      if ($('segOv') || ($('pwOv') && $('pwOv').classList.contains('on'))) return;   /* primero el compromiso */
      mostrarClave(cambioObligatorio(), false);
    } catch (e) {}
  }
  window.rlSeguridad = { revisar: revisar, mostrar: mostrarCompromiso, miCuenta: abrirCuenta, version: VERSION, cambiarClave: function () { mostrarClave(false, true); }, evaluarClave: evaluarClave };

  /* ── arranque: espera a que exista la sesión (en el hub se crea tras el login) ── */
  function iniciar() {
    crearMiCuenta();
    var n = 0, t = setInterval(function () { crearMiCuenta(); if (usuario() && token()) { revisar(); revisarClave(); } if (++n > 240) clearInterval(t); }, 1500);
    revisar();
    console.log('[_SEGURIDAD_UI_V1] listo (compromiso v' + VERSION + ')');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
