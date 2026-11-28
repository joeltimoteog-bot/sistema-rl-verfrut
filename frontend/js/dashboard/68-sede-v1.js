/* ═══════════════════════════════════════════════════════════════════
   68-sede-v1.js — _SEDE_OLMOS_V1 (01-nov-2026) — Indicador de sede: PIURA (RAPEL / VERFRUT) · OLMOS
   Todo sigue en la misma base; aqui solo se IDENTIFICA de que sede es cada registro:
   · Sede = OLMOS si la empresa es OLMOS o el fundo es uno de Olmos (BOMAREA, PIRONA, MOSQUETA, HEFEI, LEFKADA); si no, PIURA.
   · Mis Atenciones: chip de sede junto a la empresa en cada fila (y color propio para OLMOS).
   · Estadísticas (admin): el grafico "RAPEL vs VERFRUT — este mes" incluye OLMOS y, debajo, el resumen
     "Sede Piura: N · Sede Olmos: N" de atenciones del mes.
   · window.RLSede(registro) queda disponible para otros modulos.
   · _SEDE_USUARIO_V1 (20-nov-2026): tambien es OLMOS lo que registra un usuario de empresa OLMOS.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlSedeOk) return; window._rlSedeOk = true;
  var FUNDOS_OLMOS = (window.FUNDOS_OLMOS || ['BOMAREA', 'PIRONA', 'MOSQUETA', 'HEFEI', 'LEFKADA']).map(function (f) { return String(f).toUpperCase(); });
  function sede(r) {
    if (!r) return 'PIURA';
    var emp = String(r.empresa || '').toUpperCase().trim(), fundo = String(r.fundo || r.fundo_actual || r.zona_labor || '').toUpperCase().trim();
    if (emp.indexOf('OLMOS') >= 0) return 'OLMOS';
    if (fundo && FUNDOS_OLMOS.some(function (f) { return fundo.indexOf(f) >= 0; })) return 'OLMOS';
    if (esRegOlmos(r)) return 'OLMOS';   /* _SEDE_USUARIO_V1 */
    return 'PIURA';
  }
  window.RLSede = sede;

  /* _SEDE_USUARIO_V1 (20-nov-2026, decision de Joel): ademas de la empresa o el fundo del trabajador, el registro es de
     sede OLMOS si lo registro un usuario cuya empresa (Gestion de Usuarios) es OLMOS. Asi lo que registra el personal de
     Olmos sale como Olmos aunque su base de trabajadores aun no este cargada. Solo presentacion: lo guardado no cambia.
     · El usuario en sesion de empresa OLMOS se reconoce siempre; el administrador ademas lee la lista de usuarios (1 vez).
     · Apagar: localStorage.rl_sede_usuario = 'off'. */
  var NS = function (x) { return String(x || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); };
  var SEDE_USR_ON = (function () { try { return localStorage.getItem('rl_sede_usuario') !== 'off'; } catch (e) { return true; } })();
  var REG_OLMOS = [];
  function agregarRegOlmos(u) { [u && u.nombre, u && u.usuario].forEach(function (x) { var k = NS(x); if (k && REG_OLMOS.indexOf(k) < 0) REG_OLMOS.push(k); }); }
  function esRegOlmos(r) {
    if (!SEDE_USR_ON || !REG_OLMOS.length) return false;
    var k = NS(r.supervisor || r.usuario_registro || r.registrado_por || '');
    return !!k && REG_OLMOS.indexOf(k) >= 0;
  }
  function usuarioSesion() { try { return (typeof USER !== 'undefined' && USER) ? USER : null; } catch (e) { return null; } }
  function remarcar() {
    try {
      var tb = document.getElementById('tbAt');
      if (tb) Array.prototype.forEach.call(tb.querySelectorAll('tr[data-sede-ok]'), function (tr) { var c = tr.querySelector('.sede-chip'); if (c) c.remove(); delete tr.dataset.sedeOk; });
      marcarTabla();
      var ch = (typeof charts !== 'undefined' && charts) ? charts.empresa : null; if (ch) { ch._sedeOk = false; completarGrafico(); }
    } catch (e) {}
  }
  function iniciarSedeUsuario(intento) {
    if (!SEDE_USR_ON) return;
    var U = usuarioSesion();
    if (!U || !U.usuario) { if ((intento || 0) < 40) setTimeout(function () { iniciarSedeUsuario((intento || 0) + 1); }, 1500); return; }
    var antes = REG_OLMOS.length;
    if (NS(U.empresa) === 'OLMOS') agregarRegOlmos(U);
    var verTodo = /admin|coordinador|jefa/i.test(String(U.rol || ''));
    if (!verTodo) { if (REG_OLMOS.length !== antes) remarcar(); return; }
    var tk = null; try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
    if (!tk) { if (REG_OLMOS.length !== antes) remarcar(); return; }
    fetch('https://rl-fn-verfrut.azurewebsites.net/api/usuarios/lista', { headers: { Authorization: 'Bearer ' + tk } })   /* azure-token.js lo dirige a Supabase */
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var lista = (j && (j.data || j.usuarios)) || [];
        lista.forEach(function (u) { if (NS(u.empresa) === 'OLMOS') agregarRegOlmos(u); });
        if (REG_OLMOS.length !== antes) { remarcar(); console.log('[_SEDE_USUARIO_V1] usuarios de Olmos reconocidos: ' + (REG_OLMOS.length ? 'si' : 'no')); }
      }).catch(function (e) { console.warn('[_SEDE_USUARIO_V1]', e.message); if (REG_OLMOS.length !== antes) remarcar(); });
  }
  function supDeFila(nro) {
    try {
      var C = (typeof CACHE !== 'undefined' && CACHE) ? CACHE : {}, L = C.atenciones || [], k = String(nro || '').trim(); if (!k) return '';
      for (var i = 0; i < L.length; i++) if (String(L[i].nro || '').trim() === k) return L[i].supervisor || '';
    } catch (e) {}
    return '';
  }

  /* ── estilos ── */
  var css = document.createElement('style'); css.id = 'sedeCss';
  css.textContent = '.bg.bolm{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}' +
    '.sede-chip{display:inline-block;margin-left:5px;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:800;letter-spacing:.4px;vertical-align:middle;text-transform:uppercase}' +
    '.sede-chip.piura{background:#e0f2fe;color:#075985;border:1px solid #bae6fd}.sede-chip.olmos{background:#ffedd5;color:#9a3412;border:1px solid #fdba74}' +
    '#sedeResumen{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 2px;font-size:11.5px;font-weight:700}' +
    '#sedeResumen span{padding:3px 10px;border-radius:999px}#sedeResumen .p{background:#e0f2fe;color:#075985}#sedeResumen .o{background:#ffedd5;color:#9a3412}';
  document.head.appendChild(css);

  /* ── 1) Mis Atenciones: chip de sede en la celda de empresa ── */
  function marcarTabla() {
    var tb = document.getElementById('tbAt'); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.dataset.sedeOk) return;
      var tds = tr.children; if (!tds || tds.length < 9) return;
      var celEmp = tds[7], bg = celEmp && celEmp.querySelector('.bg'); if (!bg) return;
      var emp = (bg.textContent || '').trim().toUpperCase(), fundo = (tds[8].textContent || '').trim();
      var s = sede({ empresa: emp, fundo: fundo, supervisor: REG_OLMOS.length ? supDeFila((tds[0].textContent || '').trim()) : '' });   /* _SEDE_USUARIO_V1 */
      if (emp === 'OLMOS') { bg.classList.remove('bam'); bg.classList.add('bolm'); }
      var chip = document.createElement('span'); chip.className = 'sede-chip ' + (s === 'OLMOS' ? 'olmos' : 'piura'); chip.textContent = s === 'OLMOS' ? 'Olmos' : 'Piura';
      celEmp.appendChild(chip); tr.dataset.sedeOk = '1';
    });
  }
  var _renderAt = window.renderAt;
  if (typeof _renderAt === 'function') {
    window.renderAt = function () { var r = _renderAt.apply(this, arguments); try { marcarTabla(); setTimeout(marcarTabla, 300); } catch (e) {} return r; };
    try { renderAt = window.renderAt; } catch (e) {}
  }
  /* la tabla se repinta por otros caminos (filtros, refresco en vivo): se observa el tbody */
  try { var tb0 = document.getElementById('tbAt'); if (tb0) new MutationObserver(function () { setTimeout(marcarTabla, 50); }).observe(tb0, { childList: true }); } catch (e) {}

  /* ── 2) Estadisticas admin: OLMOS en el grafico de empresas + resumen por sede ── */
  function delMes(arr, campo) {
    var m = new Date().getMonth() + 1, y = new Date().getFullYear();
    return (arr || []).filter(function (r) { var f = new Date(String(r[campo] || '').substring(0, 10)); return f.getMonth() + 1 === m && f.getFullYear() === y; });
  }
  function completarGrafico() {
    try {
      var ch = (typeof charts !== 'undefined' && charts) ? charts.empresa : null; if (!ch || !ch.data || ch._sedeOk) return;
      var C = (typeof CACHE !== 'undefined' && CACHE) ? CACHE : {};
      var atMes = delMes(C.atenciones, 'fecha_atencion'), visMes = delMes(C.visitas, 'fecha_reg'), casMes = delMes(C.casos, 'fecha_reporte');
      var olm = function (arr) { return arr.filter(function (r) { return sede(r) === 'OLMOS'; }).length; };
      var dsO = ch.data.datasets.filter(function (d) { return d.label === 'OLMOS'; })[0];
      if (!dsO) ch.data.datasets.push({ label: 'OLMOS', data: [olm(atMes), olm(visMes), olm(casMes)], backgroundColor: '#f97316', borderRadius: 6 });
      else dsO.data = [olm(atMes), olm(visMes), olm(casMes)];   /* _SEDE_USUARIO_V1: se recalcula al reconocer usuarios de Olmos */
      ch._sedeOk = true; ch.update();
      var t = document.querySelector('#chartEmpresa') && document.querySelector('#chartEmpresa').closest('.gc'); var tit = t && t.querySelector('.gc-t');
      if (tit && tit.textContent.indexOf('OLMOS') < 0) tit.textContent = '🏭 RAPEL · VERFRUT · OLMOS — este mes';
      var piura = atMes.length - olm(atMes), res = document.getElementById('sedeResumen');
      if (!res && tit) { res = document.createElement('div'); res.id = 'sedeResumen'; tit.insertAdjacentElement('afterend', res); }
      if (res) res.innerHTML = '<span class="p">Sede Piura · ' + piura + ' atenciones</span><span class="o">Sede Olmos · ' + olm(atMes) + ' atenciones</span>';
    } catch (e) { console.warn('[_SEDE_OLMOS_V1]', e.message); }
  }
  var _rea = window.renderEstadisticasAdmin;
  if (typeof _rea === 'function') {
    window.renderEstadisticasAdmin = function () { var r = _rea.apply(this, arguments); setTimeout(completarGrafico, 200); return r; };
    try { renderEstadisticasAdmin = window.renderEstadisticasAdmin; } catch (e) {}
  }
  setInterval(function () { if (typeof charts !== 'undefined' && charts && charts.empresa && !charts.empresa._sedeOk) completarGrafico(); }, 3000);
  iniciarSedeUsuario(0);   /* _SEDE_USUARIO_V1 */

  /* _SEDE_TRAB_V2 (23-nov-2026, pedido de Joel): aviso cuando se busca a un trabajador de la otra sede.
     El texto lo manda el servidor ("No cuenta con acceso a la información de la sede Piura."). Maximo un aviso cada 2,5 s. */
  var _avisoSedeT = 0;
  window.RLSedeAviso = function (msg) {
    try {
      var m = String(msg || 'No cuenta con acceso a la información de la otra sede.');
      if (Date.now() - _avisoSedeT < 2500) return; _avisoSedeT = Date.now();
      console.log('[_SEDE_TRAB_V2] ' + m);
      if (typeof mostrarToast === 'function') mostrarToast('🔒 ' + m, 'error');
      else if (typeof window.appAlert === 'function') window.appAlert('🔒 ' + m);
    } catch (e) {}
  };

  /* _SEDE_GOOGLE_V1 (23-nov-2026, decision de Joel: "nadie de Olmos debe ver lo de Piura"): cuando Supabase no responde, la
     busqueda de trabajadores caia a Google (hoja con la nomina de RAPEL y VERFRUT). Para un usuario de empresa OLMOS ese
     respaldo ya no se usa: la busqueda devuelve "sin resultados" y puede reintentar. Los usuarios de Piura no cambian.
     El servidor ya filtra por sede (_SEDE_TRAB_V1); esto cierra el camino de respaldo. Apagar: localStorage.rl_sede_google = 'off'. */
  var _apiGetSede = window.apiGet;
  if (typeof _apiGetSede === 'function') {
    window.apiGet = function (p) {
      try {
        var off = false; try { off = localStorage.getItem('rl_sede_google') === 'off'; } catch (e0) {}
        var emp = ''; try { emp = String((typeof USER !== 'undefined' && USER && USER.empresa) || '').toUpperCase().trim(); } catch (e1) {}
        /* _SEDE_AT_SIN_GOOGLE_V1 (25-nov-2026): con una sede elegida (o usuario de Olmos), si Supabase responde "sin atenciones"
           NO se pide el respaldo a Google: Google no distingue sede y a un rol administrador le devolvia las atenciones de Piura
           aunque hubiera elegido Olmos (caso real del 25-nov). Se muestra el aviso en vez de la lista equivocada. */
        var vis = ''; try { vis = (window.RLSedeVista && window.RLSedeVista.get()) || ''; } catch (e2) {}
        var rolTodo = false; try { rolTodo = typeof ROLES_VER_TODO !== 'undefined' && ROLES_VER_TODO.includes(USER.rol); } catch (e3) {}
        var realU = ''; try { var gR = JSON.parse(sessionStorage.getItem('rl_sede_real') || 'null'); if (gR && gR.u === String((USER && USER.usuario) || '').toLowerCase()) realU = gR.s || ''; } catch (e4) {}
        /* _SEDE_AT_SIN_GOOGLE_V2 (27-nov-2026): tambien un ADMINISTRADOR DE PIURA sin alcance general. Desde el 23-nov la hoja de Google
           recibe copia de cada atencion (tambien las de Olmos) y ese respaldo le devolvia atenciones de Olmos. Solo quien tiene alcance
           GENERAL y eligio "Ambas sedes" conserva el respaldo (puede ver las dos). Los supervisores no cambian (Google les da solo las suyas). */
        if (!off && p && p.action === 'getAtencionesOptimizado' && (vis || (rolTodo && realU !== 'TODO'))) {
          var sedeTxt = vis ? vis : (emp === 'OLMOS' ? 'OLMOS' : 'PIURA');
          console.log('[_SEDE_AT_SIN_GOOGLE_V1] hay filtro de sede: no se usa el respaldo de atenciones en Google');
          return Promise.resolve({ success: false, sin_respaldo: true, data: [], error: 'No hay atenciones registradas en ' + (sedeTxt === 'PIURA' ? 'la sede Piura' : 'la sede Olmos') + ' para hoy.', fuente: 'sede' });
        }
        if (!off && emp === 'OLMOS' && p && p.action === 'buscarTrabajador') {
          console.log('[_SEDE_GOOGLE_V1] usuario de Olmos: no se usa la busqueda de respaldo en Google (nomina de Piura)');
          return Promise.resolve({ success: true, data: [], fuente: 'sede' });
        }
      } catch (e) {}
      return _apiGetSede.apply(this, arguments);
    };
    try { apiGet = window.apiGet; } catch (e) {}
  }
  /* _SEDE_ETIQUETA_V1 (23-nov-2026, pedido de Joel): al ingresar un usuario de empresa OLMOS, el encabezado dice "Sede Olmos"
     (junto al cargo, en la bienvenida y en la barra superior). Los usuarios de Piura no ven nada nuevo. Solo presentacion. */
  function etiquetaSede(intento) {
    try {
      var U = usuarioSesion(), avR = document.getElementById('avR');
      if (!U || !U.usuario || !avR || !avR.textContent || avR.textContent === '...') { if ((intento || 0) < 40) setTimeout(function () { etiquetaSede((intento || 0) + 1); }, 1500); return; }
      if (NS(U.empresa) !== 'OLMOS') return;
      if (!document.getElementById('sedeEtq')) { var c = document.createElement('span'); c.id = 'sedeEtq'; c.className = 'sede-chip olmos'; c.textContent = 'Sede Olmos'; avR.appendChild(c); }
      var wR = document.getElementById('wR'); if (wR && wR.textContent.indexOf('Sede Olmos') < 0) wR.textContent = wR.textContent + ' · Sede Olmos';
      var tbE = document.getElementById('tbE'); if (tbE && NS(tbE.textContent) === 'OLMOS') tbE.textContent = 'SEDE OLMOS';
    } catch (e) {}
  }
  etiquetaSede(0);

  /* _SEDE_VISTA_V1 (23-nov-2026, aprobado por Joel): selector "Sede: Ambas / Piura / Olmos" en la barra superior, SOLO para
     quien ve las dos sedes (lo dice el servidor: auth/sso -> sede TODO; se recuerda en la pestaña). Al cambiar, la pagina
     se vuelve a cargar y todo lo que el servidor filtra por sede sale de la sede elegida (sede-vista.js manda la cabecera). */
  function dibujarSelector() {
    try {
      if (document.getElementById('sedeVistaSel') || !window.RLSedeVista) return;
      var tbE = document.getElementById('tbE'); if (!tbE || !tbE.parentNode) return;
      var sel = document.createElement('select'); sel.id = 'sedeVistaSel'; sel.title = 'Sede que quieres ver';
      sel.style.cssText = 'margin-right:8px;padding:3px 8px;border-radius:999px;border:1px solid #bae6fd;background:#e0f2fe;color:#075985;font-size:11.5px;font-weight:700;cursor:pointer';
      [['', 'Sede: Ambas'], ['PIURA', 'Sede: Piura'], ['OLMOS', 'Sede: Olmos']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
      sel.value = window.RLSedeVista.get();
      if (sel.value === 'OLMOS') { sel.style.background = '#ffedd5'; sel.style.color = '#9a3412'; sel.style.borderColor = '#fdba74'; }
      sel.addEventListener('change', function () { window.RLSedeVista.set(sel.value); });
      tbE.parentNode.insertBefore(sel, tbE);
    } catch (e) {}
  }
  /* _SEDE_PREGUNTA_V1 (24-nov-2026, maqueta aprobada por Joel): quien ve las dos sedes (alcance General y jtimoteo) elige la sede
     EN CADA INGRESO: Sede Piura / Sede Olmos / Ambas sedes. Es el mismo mecanismo del selector de arriba (RLSedeVista): no abre
     nada que el servidor no permita y los modulos siguen saliendo segun "Acceso a Modulos". Quien es de una sola sede no lo ve.
     "Cada ingreso" = cada sesion nueva (se recuerda por el token de la sesion, en la pestaña). Apagar: localStorage.rl_sede_pregunta = 'off'. */
  function marcaSesion() { try { var t = String(sessionStorage.getItem('rl_token') || ''); return t ? t.slice(-24) : ''; } catch (e) { return ''; } }
  function preguntarSede() {
    try {
      var off = false; try { off = localStorage.getItem('rl_sede_pregunta') === 'off'; } catch (e0) {}
      var m = marcaSesion(); if (off || !m || !window.RLSedeVista || document.getElementById('sedePregOv')) return;
      var ya = ''; try { ya = sessionStorage.getItem('rl_sede_preg') || ''; } catch (e1) {}
      if (ya === m) return;
      var actual = window.RLSedeVista.get(), elegida = actual;
      var OPC = [['PIURA', 'Sede Piura', 'RAPEL · VERFRUT'], ['OLMOS', 'Sede Olmos', 'Bomarea · Pirona · Mosqueta · Hefei · Lefkada'], ['', 'Ambas sedes', 'Vista general: Piura y Olmos']];
      var ov = document.createElement('div'); ov.id = 'sedePregOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'sedePregT');
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,27,51,.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(580px,100%);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;background:#fff;border:1px solid #D9DFEA;border-top:5px solid #C8102E;border-radius:10px;padding:32px 40px 26px;box-shadow:0 18px 48px rgba(15,27,51,.28);color:#0F1B33;text-align:left';
      card.innerHTML =
        '<div style="display:flex;align-items:center;gap:14px"><img src="../images/logo-unifrutti.jpg" alt="Unifrutti" style="width:48px;height:48px;object-fit:contain;border:1px solid #E6EAF2;border-radius:8px" onerror="this.style.display=\'none\'">' +
        '<div><div style="font-size:11px;letter-spacing:2.2px;font-weight:700;color:#C8102E;text-transform:uppercase">Sistema de Relaciones Laborales</div><div style="font-size:12px;color:#5B6B86;margin-top:2px">Unifrutti Perú · Piura · Olmos</div></div></div>' +
        '<h2 id="sedePregT" style="margin:22px 0 6px;font-size:24px;font-weight:700;letter-spacing:.2px;color:#0F1B33">Seleccione la sede de trabajo</h2>' +
        '<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#3D4A63">Su usuario tiene alcance general. Indique con qué sede desea trabajar en esta sesión.</p>' +
        '<div id="sedePregOps" style="display:flex;flex-direction:column;gap:10px"></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #E6EAF2">' +
        '<div style="font-size:12px;line-height:1.45;color:#5B6B86;max-width:300px">Podrá cambiar de sede en cualquier momento con el selector Sede de la barra superior.</div>' +
        '<button type="button" id="sedePregOk" style="min-height:46px;padding:0 30px;border:0;border-radius:8px;background:#0F1B33;color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">Continuar</button></div>';
      ov.appendChild(card);
      var ops = card.querySelector('#sedePregOps');
      function pintar() {
        Array.prototype.forEach.call(ops.children, function (b) {
          var on = b.getAttribute('data-v') === elegida;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.background = on ? '#F3F6FC' : '#fff'; b.style.border = on ? '2px solid #0F1B33' : '1px solid #C9D1E0';
          b.firstChild.style.border = on ? '6px solid #C8102E' : '2px solid #8A97AE';
        });
      }
      OPC.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-v', o[0]);
        b.style.cssText = 'display:flex;align-items:center;gap:14px;width:100%;min-height:62px;text-align:left;padding:11px 16px;border-radius:8px;color:#0F1B33;cursor:pointer;font-family:inherit';
        var aro = document.createElement('span'); aro.style.cssText = 'width:18px;height:18px;border-radius:50%;box-sizing:border-box;background:#fff;flex:0 0 auto';
        var tx = document.createElement('span'); tx.style.cssText = 'display:flex;flex-direction:column;gap:2px';
        var t1 = document.createElement('span'); t1.style.cssText = 'font-size:16px;font-weight:700'; t1.textContent = o[1];
        var t2 = document.createElement('span'); t2.style.cssText = 'font-size:12.5px;color:#4A5872'; t2.textContent = o[2];
        tx.appendChild(t1); tx.appendChild(t2); b.appendChild(aro); b.appendChild(tx);
        b.addEventListener('click', function () { elegida = o[0]; pintar(); });
        ops.appendChild(b);
      });
      pintar();
      card.querySelector('#sedePregOk').addEventListener('click', function () {
        try { sessionStorage.setItem('rl_sede_preg', m); } catch (e2) {}
        if (elegida !== actual) { window.RLSedeVista.set(elegida); return; }   /* recarga la pagina con la sede elegida */
        ov.remove();
      });
      document.body.appendChild(ov);
      try { card.querySelector('#sedePregOk').focus(); } catch (e3) {}
    } catch (e) { console.warn('[_SEDE_PREGUNTA_V1]', e.message); }
  }
  function selectorSede(intento) {
    try {
      var U = usuarioSesion();
      if (!U || !U.usuario) { if ((intento || 0) < 40) setTimeout(function () { selectorSede((intento || 0) + 1); }, 1500); return; }
      var u = String(U.usuario).toLowerCase(), real = '';
      try { var g = JSON.parse(sessionStorage.getItem('rl_sede_real') || 'null'); if (g && g.u === u) real = g.s; } catch (e) {}
      if (real) { if (real === 'TODO') { dibujarSelector(); preguntarSede(); } else if (window.RLSedeVista && window.RLSedeVista.get()) window.RLSedeVista.set(''); return; }
      var tk = null; try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
      if (!tk) return;
      fetch('https://rl-fn-verfrut.azurewebsites.net/api/auth/sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'sesion', token: tk }) })   /* azure-token.js lo dirige a Supabase */
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var s = j && j.success && j.user && String(j.user.usuario || '').toLowerCase() === u ? String(j.user.sede || '') : '';
          if (!s) return;
          try { sessionStorage.setItem('rl_sede_real', JSON.stringify({ u: u, s: s })); } catch (e) {}
          if (s === 'TODO') { dibujarSelector(); preguntarSede(); } else if (window.RLSedeVista && window.RLSedeVista.get()) window.RLSedeVista.set('');
        }).catch(function () {});
    } catch (e) {}
  }
  selectorSede(0);
  console.log('[_SEDE_OLMOS_V1] listo: sede Piura / Olmos en atenciones y estadísticas');
})();
