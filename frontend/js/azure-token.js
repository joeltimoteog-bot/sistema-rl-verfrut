/* ═══════════════════════════════════════════════════════════════════════════
   azure-token.js — _AZ_TOKEN_V1 (05-oct-2026) · _GAS_SESION_V1 (31-oct-2026)
   Toda consulta a Azure lleva la sesion del usuario (Authorization: Bearer).
   Hasta hoy varias pantallas consultaban Azure SIN sesion (busqueda de DNI,
   capacitaciones, supervisores...) y Azure las dejaba pasar ("modo suave").
   Este archivo se carga PRIMERO en cada pagina y solo AGREGA la sesion si la
   llamada no la trae. No cambia nada mas: misma URL, mismo cuerpo, misma respuesta.
   Sin sesion guardada (pantalla de login) no hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlAzTokenOk || typeof window.fetch !== 'function') return;
  window._rlAzTokenOk = true;
  var fOrig = window.fetch;
  var MARCA = 'azurewebsites.net/api/';
  function tieneAuth(h) {
    try {
      if (!h) return false;
      if (typeof Headers !== 'undefined' && h instanceof Headers) return h.has('Authorization');
      if (Array.isArray(h)) return h.some(function (p) { return String(p[0]).toLowerCase() === 'authorization'; });
      return Object.keys(h).some(function (k) { return k.toLowerCase() === 'authorization'; });
    } catch (e) { return true; }
  }
  /* _GAS_SESION_V1 (31-oct-2026): el backend de Google (copia de respaldo) tambien recibe la sesion firmada por Azure
     (parametro rl_token en GET, campo rl_token en el cuerpo JSON del POST). Google verifica la firma con el mismo secreto
     y, en modo obligatorio, rechaza lo que no venga de una sesion valida. Misma URL, mismo cuerpo, misma respuesta. */
  var MARCA_GAS = 'script.google.com/macros/';
  function conSesionGas(input, init, tk) {
    var url = input;
    if (!init || String(init.method || 'GET').toUpperCase() === 'GET') {
      if (/[?&]rl_token=/.test(url)) return [url, init];
      return [url + (url.indexOf('?') >= 0 ? '&' : '?') + 'rl_token=' + encodeURIComponent(tk), init];
    }
    if (typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
      try { var b = JSON.parse(init.body); if (b && typeof b === 'object' && !b.rl_token) { b.rl_token = tk; var i2 = Object.assign({}, init); i2.body = JSON.stringify(b); return [url, i2]; } } catch (e) {}
    }
    return [url, init];
  }
  /* _SEG_FASE1_V1 (17-nov-2026): si una llamada a Google sale SIN llave se agrega rl_sin = motivo|pagina, para que la hoja
     SESION_LOG diga POR QUE (ingreso por Google, llave borrada por 401, pantalla sin ingreso). Solo diagnostico: no da acceso. */
  function motivoSinLlave() {
    var m = '';
    try { m = sessionStorage.getItem('rl_sin') || ''; } catch (e) {}
    if (!m) { var u = null; try { u = sessionStorage.getItem('user'); } catch (e) {} m = u ? 'ingreso-sin-llave' : 'sin-ingreso'; }
    var pg = ''; try { pg = (location.pathname.split('/').pop() || 'inicio').replace(/\.html$/, ''); } catch (e) {}
    return (m + '|' + pg).slice(0, 80);
  }
  function conMotivoGas(input, init) {
    try {
      var mo = motivoSinLlave(), url = input;
      if (!init || String(init.method || 'GET').toUpperCase() === 'GET') {
        if (/[?&]rl_sin=/.test(url)) return [url, init];
        return [url + (url.indexOf('?') >= 0 ? '&' : '?') + 'rl_sin=' + encodeURIComponent(mo), init];
      }
      if (typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
        var b = JSON.parse(init.body); if (b && typeof b === 'object' && !b.rl_sin && !b.rl_token) { b.rl_sin = mo; var i2 = Object.assign({}, init); i2.body = JSON.stringify(b); return [url, i2]; }
      }
    } catch (e) {}
    return [input, init];
  }
  /* _SEG_FASE3_V1 (20-nov-2026): si Supabase RECHAZO la llave (401: vencida hace mas de 36 h o invalida) la pantalla ya NO
     sigue trabajando por Google (lento, sin sesion y con datos que solo quedaban en la hoja): se muestra el aviso de volver a
     ingresar y las llamadas al Apps Script del Sistema RR.LL. responden { success:false, sesion_vencida:true } sin salir.
     No toca: el ingreso por Google cuando Supabase no respondia (rl_sin = login-google), la pantalla de ingreso, el monitoreo
     (ping, saludLog) ni otros Apps Script (Bienestar). Apagar: localStorage.rl_sin_llave = 'off' (el mismo de la fase 2). */
  var GAS_RRLL = 'AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA';
  var LIBRES_SIN_LLAVE = { ping: 1, saludLog: 1 };
  function accionGas(url, init) {
    try {
      if (init && typeof init.body === 'string' && /^\s*\{/.test(init.body)) { var b = JSON.parse(init.body); if (b && b.action) return String(b.action); }
      var m = /[?&]action=([^&#]+)/.exec(url); return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }
  /* ═══ _SIN_GOOGLE_V1 (23-nov-2026, decision de Joel: "todo debe ir con Supabase", Olmos y Piura a la vez) ═══
     Las acciones de la lista SG_CERRADAS ya salen de Supabase y Google era solo su respaldo: para ellas la consulta a Google
     no sale y la pantalla recibe "el servidor no respondio, intenta de nuevo".
     (La hoja de Google no conoce las sedes y sus datos ya no son los vigentes.)
     Ademas se MIDE todo lo que todavia va a Google (accion por usuario y dia, en Actividad: sistema "google-rrll"),
     para saber que falta pasar a Supabase. La lista crece conforme se confirma cada modulo.
     Apagar el cierre: localStorage.rl_sin_google = 'off' · apagar la medicion: localStorage.rl_mide_google = 'off'. */
  /* 23-nov (noche), primer cierre: 15 lecturas que ya salen de Supabase y donde Google era solo respaldo. Se eligieron con dos
     evidencias: (1) la prueba automatica muestra que solo iban a Google con Supabase caido; (2) la medicion real del 23-nov
     (15 usuarios, de 12:30 a 20:30) no registro NINGUNA de ellas yendo a Google.
     NO se cierran todavia (la pantalla aun depende de Google por si sola o no esta confirmado): listarSolicitudesMantenimiento
     (Mantenimiento confirma su lista con Google y saca de ahi el correo y el historial), invGetAll (Inventario, por confirmar)
     y las lecturas que la medicion SI vio ir a Google: getAtencionesOptimizado, getUsuarios, getPreloadOptimizado,
     horariosListar, getVisitas, permisosListar, cumplPendientes. */
  var SG_CERRADAS = { buscarTrabajador: 1, horasListar: 1, horasResumenIndividual: 1, horasResumenGeneral: 1, horasListarMotivos: 1,
    listarCapacitaciones: 1, estadisticasCapacitaciones: 1, exportarCapacitaciones: 1, getFusiones: 1, getSolicitudes: 1, getMotivosCasos: 1,
    getSupervisores: 1, getEstadisticasAdmin: 1, getSolicitudesAcceso: 1, getResponsablesEnRango: 1 };
  var SG_MSG = 'El servidor no respondió. Revisa tu conexión e intenta de nuevo en unos segundos.';
  function sgMedir(accion, cerrada) {
    try {
      if (!accion || localStorage.getItem('rl_mide_google') === 'off') return;
      var tk = sessionStorage.getItem('rl_token'); if (!tk) return;
      var k = accion + (cerrada ? ' (cerrada)' : ''), m = {};
      try { m = JSON.parse(sessionStorage.getItem('rl_sg_m') || '{}') || {}; } catch (e) { m = {}; }
      if (Date.now() - (m[k] || 0) < 600000) return;   /* una anotacion por accion cada 10 minutos */
      m[k] = Date.now(); try { sessionStorage.setItem('rl_sg_m', JSON.stringify(m)); } catch (e) {}
      fOrig.call(window, rg(EDGE + 'actividad/ingreso'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
        body: JSON.stringify({ sistema: 'google-rrll', modulo: k.slice(0, 80) }) }).catch(function () {});
    } catch (e) {}
  }
  function cierreGoogle(url, init) {
    try {
      if (url.indexOf(GAS_RRLL) < 0) return null;
      var a = accionGas(url, init), cerrar = false;
      try { cerrar = !!SG_CERRADAS[a] && !MODO_GOOGLE && localStorage.getItem('rl_sin_google') !== 'off'; } catch (e) { cerrar = false; }
      sgMedir(a, cerrar);
      if (!cerrar) return null;
      try { console.warn('[_SIN_GOOGLE_V1] ' + a + ': el respaldo en Google esta cerrado (todo va con Supabase)'); } catch (e) {}
      var cuerpo = JSON.stringify({ success: false, sin_respaldo: true, error: SG_MSG, message: SG_MSG });
      try { return new Response(cuerpo, { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (e) { return null; }
    } catch (e) { return null; }
  }
  function bloqueoSinLlave(url, init) {
    try {
      if (url.indexOf(GAS_RRLL) < 0) return false;
      if (/\/index\.html$|\/sistema-rl-verfrut\/?$/.test(location.pathname) || location.pathname === '/') return false;
      if (localStorage.getItem('rl_sin_llave') === 'off') return false;
      var m = sessionStorage.getItem('rl_sin') || '';
      if (m !== 'borrada-401' && m !== 'renovar-401') return false;
      if (!sessionStorage.getItem('user')) return false;
      if (LIBRES_SIN_LLAVE[accionGas(url, init)]) return false;
      if (!window.rlSesion || typeof window.rlSesion.vencida !== 'function') return false;   /* sin aviso disponible: como antes */
      try { window.rlSesion.vencida('Por seguridad, las sesiones se renuevan cada día. Vuelve a ingresar y regresarás a esta misma pantalla.'); } catch (e) {}
      try { console.warn('[_SEG_FASE3_V1] llave rechazada por Supabase: no se consulta Google (' + accionGas(url, init) + ')'); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function respuestaSinLlave() {
    var cuerpo = JSON.stringify({ success: false, sesion_vencida: true, error: 'Tu sesión venció. Vuelve a ingresar.', message: 'Tu sesión venció. Vuelve a ingresar.' });
    try { return new Response(cuerpo, { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (e) { return { ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(cuerpo)); }, text: function () { return Promise.resolve(cuerpo); }, clone: function () { return this; } }; }
  }
  /* _MODO_GOOGLE_V1 (04-nov-2026) — EMERGENCIA: caida de Azure Storage en Brazil South (Microsoft).
     Con MODO_GOOGLE = true NINGUNA llamada va a Azure: falla al instante y cada modulo usa su respaldo de
     Google sin esperar los 12-14 s del reloj. Al volver Azure: MODO_GOOGLE = false (y subir ?v=).
     Prueba en un solo navegador: localStorage.rl_modo_google = 'off' (usa Azure) / 'on' (usa Google). */
  var MODO_GOOGLE = false;
  try { var mg = localStorage.getItem('rl_modo_google'); if (mg === 'off') MODO_GOOGLE = false; else if (mg === 'on') MODO_GOOGLE = true; } catch (e) {}
  if (MODO_GOOGLE) { try { console.warn('[_MODO_GOOGLE_V1] modo respaldo: Supabase desactivado, todo va directo a Google'); } catch (e) {} }
  /* _EDGE_V1 (05-nov-2026) — Fase 1 de "todo en Supabase": las rutas de abajo se atienden en Supabase
     (Edge Function "api", el MISMO codigo que Azure). Si Supabase no responde (red, 502/503/504/546 o ruta
     no disponible) la MISMA llamada se repite en Azure: el usuario no nota nada. Tras 3 fallas seguidas
     se usa solo Azure por 5 minutos. Apagar: localStorage.rl_edge = 'off' (o EDGE_ACTIVO = false + subir ?v=). */
  var EDGE_ACTIVO = true;
  var EDGE = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/';
  /* _EDGE_REGION_V1 (05-nov): el servidor de Supabase se ejecuta en Sao Paulo, junto a la base (antes corria en otra region:
     cada consulta tardaba 230-1200 ms en el servidor; en Sao Paulo 6-60 ms) */
  function rg(u) { var i = u.indexOf('#'), h = i >= 0 ? u.slice(i) : ''; if (i >= 0) u = u.slice(0, i); return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'forceFunctionRegion=sa-east-1' + h; }
  /* _EDGE_V2 (05-nov): fase 2 — TODO pasa a Supabase salvo las rutas con llave de funcion (mantenimiento, importaciones, sync, lote) */
  var SOLO_AZURE = /^(?!)/;   /* _EDGE_V3 (05-nov): fase 3 — Supabase ya atiende tambien mantenimiento, importaciones y sync (con la misma llave) */
  try { var me = localStorage.getItem('rl_edge'); if (me === 'off') EDGE_ACTIVO = false; else if (me === 'on') EDGE_ACTIVO = true; } catch (e) {}
  var edgeFallas = 0;
  function edgePausado() { return false; /* _SIN_AZURE_V1: ya no hay respaldo al que ir */ }
  function edgePausadoViejo_() { try { return Date.now() < +(sessionStorage.getItem('rl_edge_pausa') || 0); } catch (e) { return false; } }
  function edgeFalla(motivo) {
    edgeFallas++;
    try { console.warn('[_EDGE_V1] Supabase no respondio (' + motivo + '): revisa la conexion de este equipo (no hay respaldo en Azure)'); } catch (e) {}
    if (edgeFallas >= 3) { edgeFallas = 0; try { sessionStorage.setItem('rl_edge_pausa', String(Date.now() + 5 * 60000)); } catch (e) {} }
  }
  /* _REINTENTO_LECTURA_V1 (19-nov-2026): LOG_ERRORES mostro que casi todas las "fallas de Supabase" son cortes de senal del
     equipo en campo (Google falla en el mismo milisegundo). Saltar a Google no ayuda y es lento: una LECTURA (GET) que falla
     por red o 502/503/504 se reintenta UNA vez contra Supabase a los 1,5 s. Los guardados (POST) NO se reintentan aqui
     (no se duplica nada). Apagar: localStorage.rl_reintento = 'off' */
  var REINTENTO_ON = true; try { if (localStorage.getItem('rl_reintento') === 'off') REINTENTO_ON = false; } catch (e) {}
  function reintentar(url, init) {
    return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () {
      if (init && init.signal && init.signal.aborted) { var eA = new Error('cancelado'); eA.name = 'AbortError'; throw eA; }
      try { console.warn('[_REINTENTO_LECTURA_V1] reintento a Supabase: ' + (url.split(MARCA)[1] || '').split('?')[0]); } catch (e) {}
      return enviar(url, init, 1);
    });
  }
  function enviar(url, init, intento) {
    var metodo = String((init && init.method) || 'GET').toUpperCase();
    var ruta = url.split(MARCA)[1] || '';
    if (!EDGE_ACTIVO || edgePausado() || SOLO_AZURE.test(ruta) || (init && init.body && typeof init.body !== 'string')) return fOrig.call(window, url, init);
    var puedeReintentar = REINTENTO_ON && !intento && metodo === 'GET';
    /* _EDGE_V3: POST /atenciones (crear, con llave) tambien va a Supabase */
    return fOrig.call(window, rg(EDGE + ruta), init).then(function (r) {
      /* _SIN_AZURE_V1 (08-nov-2026): Azure se apaga el 12-nov. Si Supabase responde 5xx ya NO se reintenta contra Azure:
         se anota la falla y se devuelve la respuesta tal cual (la pantalla muestra su propio aviso de error). */
      if ([502, 503, 504, 546].indexOf(r.status) >= 0 || (r.status === 404 && r.headers.get('x-rl-edge') === 'sin-ruta')) {
        if (puedeReintentar && r.status !== 404) return reintentar(url, init);   /* _REINTENTO_LECTURA_V1 */
        edgeFalla('HTTP ' + r.status); return r;
      }
      /* _SEG_401_V1 (08-nov-2026): con el servidor en modo estricto, un 401 en una ruta de datos significa sesion vencida o
         sin credencial: se avisa de inmediato y se vuelve a ingresar (antes la pantalla quedaba vacia hasta el siguiente reloj). */
      if (r.status === 401 && !/\/api\/auth\//.test(url)) {
        /* _SEG_401_V2: el token rechazado se descarta en todas sus copias, para que el siguiente ingreso sea limpio */
        try { sessionStorage.removeItem('rl_token'); sessionStorage.setItem('rl_sin', 'borrada-401'); } catch (e) {}   /* _SEG_FASE1_V1 */
        try { localStorage.removeItem('rl_session'); } catch (e) {}
        try { var bA = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); if (bA && bA.rl_token) { delete bA.rl_token; localStorage.setItem('bienestarSocialAuth', JSON.stringify(bA)); } } catch (e) {}
        if (window.rlSesion && typeof window.rlSesion.vencida === 'function') { try { window.rlSesion.vencida('Por seguridad, las sesiones se renuevan cada día. Vuelve a ingresar y regresarás a esta misma página.'); } catch (e) {} }
      }
      edgeFallas = 0; return r;
    }, function (e) {
      if (init && init.signal && init.signal.aborted) throw e;   /* la pantalla cancelo: no reintentar */
      if (puedeReintentar) return reintentar(url, init);   /* _REINTENTO_LECTURA_V1 */
      edgeFalla(e && e.message); throw e;   /* _SIN_AZURE_V1: sin respaldo a Azure */
    });
  }
  window.rlEdge = { activo: function () { return EDGE_ACTIVO && !edgePausado(); }, base: EDGE };
  /* _SESION_PREVIA_V1 (17-nov-2026): al abrir la pagina con la llave vencida (la PC quedo de un dia para otro), las primeras
     consultas salian ANTES de la renovacion (4 s), recibian 401 y ese 401 BORRABA la llave: ya no se podia renovar y el
     usuario terminaba en el respaldo de Google (lento) todo el dia. Ahora, si la llave vencio o vence en < 2 min, se
     renueva UNA vez (todas las consultas esperan la misma renovacion) y la consulta sale con la llave nueva.
     Sin red o si la renovacion falla, la consulta sale igual que antes (sin bucles). Apagar: localStorage.rl_previa = 'off' */
  var PREVIA = true; try { if (localStorage.getItem('rl_previa') === 'off') PREVIA = false; } catch (e) {}
  var previaEnCurso = null, previaFalloTk = '', previaFalloHasta = 0;
  function expDe(t) { try { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return (p.exp || 0) * 1000; } catch (e) { return 0; } }
  function guardarTk(nuevo) {
    try { sessionStorage.setItem('rl_token', nuevo); sessionStorage.removeItem('rl_sin'); } catch (e) {}
    try { var s = JSON.parse(localStorage.getItem('rl_session') || 'null'); if (s) { s.token = nuevo; s.timestamp = Date.now(); localStorage.setItem('rl_session', JSON.stringify(s)); } } catch (e) {}
    try { var b = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); if (b && b.rl_token !== undefined) { b.rl_token = nuevo; localStorage.setItem('bienestarSocialAuth', JSON.stringify(b)); } } catch (e) {}
  }
  function renovarPrevia(viejo) {
    if (previaEnCurso) return previaEnCurso;
    previaEnCurso = new Promise(function (listo) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (x) {} }, 10000);
      fOrig.call(window, rg(EDGE + 'auth/renovar'), { method: 'POST', headers: { Authorization: 'Bearer ' + viejo }, signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { st: r.status, j: j }; }); })
        .then(function (x) {
          if (x.st === 200 && x.j && x.j.success && x.j.token) { guardarTk(x.j.token); try { console.log('[_SESION_PREVIA_V1] llave renovada antes de consultar'); } catch (e) {} listo(x.j.token); }
          else { previaFalloTk = viejo; previaFalloHasta = Date.now() + 30000; listo(null); }   /* 401 (> 36 h) u otro: sigue el flujo de siempre */
        }, function () { previaFalloTk = viejo; previaFalloHasta = Date.now() + 30000; listo(null); })   /* sin red: se reintenta en 30 s */
        .then(function () { clearTimeout(reloj); previaEnCurso = null; });
    });
    return previaEnCurso;
  }
  function necesitaPrevia(url, init) {
    if (!PREVIA || /\/api\/auth\//.test(url)) return '';
    var t = ''; try { t = sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; }
    if (!t) return '';
    var e = expDe(t); if (!e || e > Date.now() + 120000) return '';
    if (t === previaFalloTk && Date.now() < previaFalloHasta) return '';
    if (init && tieneAuth(init.headers)) {   /* la pantalla puso su propia llave: solo si es esta misma (vencida) */
      var h = init.headers, v = '';
      try { v = (typeof Headers !== 'undefined' && h instanceof Headers) ? (h.get('Authorization') || '') : Array.isArray(h) ? ((h.filter(function (p) { return String(p[0]).toLowerCase() === 'authorization'; })[0] || [])[1] || '') : (h[Object.keys(h).filter(function (k) { return k.toLowerCase() === 'authorization'; })[0]] || ''); } catch (x) {}
      if (String(v).indexOf(t) < 0) return '';
    }
    return t;
  }
  function cambiarLlave(init, viejo, nuevo) {
    if (!init || !init.headers || !tieneAuth(init.headers)) return init;
    var i3 = Object.assign({}, init), h = i3.headers;
    if (typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('Authorization', 'Bearer ' + nuevo); }
    else if (Array.isArray(h)) { h = h.map(function (p) { return String(p[0]).toLowerCase() === 'authorization' ? [p[0], 'Bearer ' + nuevo] : p; }); }
    else { h = Object.assign({}, h); Object.keys(h).forEach(function (k) { if (k.toLowerCase() === 'authorization') h[k] = 'Bearer ' + nuevo; }); }
    i3.headers = h; return i3;
  }
  var envoltura = function (input, init) {
    try {
      var uP = (typeof input === 'string') ? input : '';
      if (uP && (uP.indexOf(MARCA) >= 0 || uP.indexOf(MARCA_GAS) >= 0)) {   /* _SEG_FASE1_V1: Google tambien recibe la llave renovada (antes salia vencida) */
        var viejoP = necesitaPrevia(uP, init);
        if (viejoP) { var selfP = this; return renovarPrevia(viejoP).then(function (nuevoP) { return envoltura.call(selfP, input, nuevoP ? cambiarLlave(init, viejoP, nuevoP) : init); }); }
      }
    } catch (e) {}
    return envolturaBase.apply(this, arguments);
  };
  var envolturaBase = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      /* _EDGE_MODOGOOGLE_V1 (05-nov): con Supabase activo el modo Google de emergencia (de la caida de Azure del 04-nov) ya no bloquea:
         las llamadas van a Supabase y, si fallan, el enrutador usa Azure. Solo bloquea si Supabase esta apagado (rl_edge=off). */
      if (MODO_GOOGLE && !(EDGE_ACTIVO && !edgePausado()) && url.indexOf(MARCA) >= 0) return Promise.reject(new TypeError('Failed to fetch (modo respaldo Google)'));
      /* _FASE4_DIRECTO_V1 (05-nov): las fotos y PDF (action subirArchivoAzure) se suben DIRECTO a Supabase Storage
         con la sesion del usuario, sin pasar por Apps Script. Misma respuesta { success, enlace, url }.
         Si Supabase falla, la MISMA llamada sigue a Apps Script como siempre. */
      if (typeof input === 'string' && url.indexOf(MARCA_GAS) >= 0) { var cSG = cierreGoogle(url, init); if (cSG) return Promise.resolve(cSG); }   /* _SIN_GOOGLE_V1 */
      if (typeof input === 'string' && url.indexOf(MARCA_GAS) >= 0 && EDGE_ACTIVO && !edgePausado() && init && !init._rlSinEdge && typeof init.body === 'string' && init.body.indexOf('subirArchivoAzure') >= 0) {
        var tkS = null; try { tkS = sessionStorage.getItem('rl_token'); } catch (e) {}
        var cuerpoS = null; try { cuerpoS = JSON.parse(init.body); } catch (e) {}
        if (tkS && cuerpoS && cuerpoS.action === 'subirArchivoAzure') {
          var self = this, initGas = Object.assign({}, init, { _rlSinEdge: true });   /* el respaldo no vuelve a intentar Supabase */
          return fOrig.call(window, rg(EDGE + 'archivos/subir'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tkS }, body: init.body, signal: init.signal })
            .then(function (r) { return r.ok ? r.clone().json().then(function (j) { if (j && j.success && j.url) return r; throw new Error('respuesta sin url'); }) : Promise.reject(new Error('HTTP ' + r.status)); })
            .catch(function (e) { if (init.signal && init.signal.aborted) throw e; try { console.warn('[_FASE4_DIRECTO_V1] subida directa fallo (' + (e && e.message) + '): va por Apps Script'); } catch (x) {} return window.fetch.call(self, input, initGas); });
        }
      }
      if (typeof input === 'string' && url.indexOf(MARCA_GAS) >= 0) {
        var tg = null; try { tg = sessionStorage.getItem('rl_token'); } catch (e) {}
        if (!tg && bloqueoSinLlave(url, init)) return Promise.resolve(respuestaSinLlave());   /* _SEG_FASE3_V1 */
        if (!tg) { var rS = conMotivoGas(input, init); return fOrig.call(this, rS[0], rS[1]); }   /* _SEG_FASE1_V1 */
        var r = conSesionGas(input, init, tg);
        return fOrig.call(this, r[0], r[1]);
      }
      if (url.indexOf(MARCA) < 0 || typeof input !== 'string') return fOrig.apply(this, arguments);
      if (/\/api\/auth\//.test(url)) return (typeof input === 'string') ? enviar(url, init) : fOrig.apply(this, arguments);          /* login: sin sesion todavia */
      var tk = null;
      try { tk = sessionStorage.getItem('rl_token'); } catch (e) {}
      if (!tk || (init && tieneAuth(init.headers))) return enviar(url, init);
      var i2 = Object.assign({}, init || {});
      var h = i2.headers;
      if (typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('Authorization', 'Bearer ' + tk); }
      else if (Array.isArray(h)) { h = h.concat([['Authorization', 'Bearer ' + tk]]); }
      else { h = Object.assign({}, h || {}, { Authorization: 'Bearer ' + tk }); }
      i2.headers = h;
      return enviar(url, i2);
    } catch (e) { return fOrig.apply(this, arguments); }
  };
  window.fetch = envoltura;   /* _SESION_PREVIA_V1 */
})();

/* ═══════════════════════════════════════════════════════════════════════════
   _EXPORT_AUDIT_V1 (01-nov-2026) — Registro de exportaciones a Excel
   Todas las pantallas exportan con XLSX.writeFile (SheetJS). Aqui se envuelve UNA vez y cada
   exportacion queda anotada en Azure (POST /actividad/exportacion: pantalla, archivo, filas, hojas).
   No cambia el archivo ni el flujo: si el registro falla, la exportacion sale igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlExportAuditOk) return;
  window._rlExportAuditOk = true;
  var AZ = 'https://rl-fn-verfrut.azurewebsites.net/api/actividad/exportacion';
  function navegador() {
    var ua = navigator.userAgent || '', b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    return b + (/Android/.test(ua) ? ' / Android' : /iPhone|iPad/.test(ua) ? ' / iOS' : /Windows/.test(ua) ? ' / Windows' : /Mac OS/.test(ua) ? ' / Mac' : '');
  }
  function contar(wb) {
    var filas = 0, hojas = 0;
    try {
      (wb.SheetNames || []).forEach(function (n) {
        var ws = wb.Sheets[n]; if (!ws || !ws['!ref']) return; hojas++;
        var r = window.XLSX.utils.decode_range(ws['!ref']); filas += Math.max(0, r.e.r - r.s.r);   /* sin la cabecera */
      });
    } catch (e) {}
    return { filas: filas, hojas: hojas };
  }
  function anotar(wb, archivo) {
    try {
      var tk = sessionStorage.getItem('rl_token'); if (!tk) return;
      var c = contar(wb), pant = (document.title || '').replace(/\s*[-|·].*$/, '').trim() || location.pathname.split('/').pop();
      var cuerpo = { sistema: 'RR.LL.', pantalla: pant.slice(0, 120), archivo: String(archivo || '').slice(0, 200), filas: c.filas, hojas: c.hojas, navegador: navegador() };
      fetch(AZ, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo) }).catch(function () {});
      try { if (window.RLTrafico) RLTrafico.emit({ accion: 'Exportó a Excel: ' + (archivo || '') + ' (' + c.filas + ' filas)', destino: 'Descarga' }); } catch (e) {}
    } catch (e) {}
  }
  function envolver() {
    var X = window.XLSX; if (!X || X._rlAudit) return !!(X && X._rlAudit);
    ['writeFile', 'writeFileXLSX', 'writeFileAsync'].forEach(function (k) {
      if (typeof X[k] !== 'function') return;
      var orig = X[k];
      X[k] = function (wb, archivo) { try { anotar(wb, archivo); } catch (e) {} return orig.apply(this, arguments); };
    });
    X._rlAudit = true; return true;
  }
  var n = 0, it = setInterval(function () { if (envolver() || ++n > 120) clearInterval(it); }, 500);   /* XLSX se carga despues de este archivo */
})();

/* ═════════════════════════════════════════════════════════════════════════
   _SESION_RENOVAR_V1 (02-nov-2026) — la sesión se renueva sola mientras el usuario trabaja
   Problema: el token dura 14 h, pero la pestaña del dashboard queda abierta días; desde entonces
   Azure respondía 401 y el sistema caía al respaldo de Google (lento y sin sesión verificable).
   · Cada 5 min (y al volver a la pestaña): si al token le quedan < 6 h, o ya venció, se pide
     POST auth/renovar con el token actual → token nuevo (mismo usuario, 14 h más). Sin clave.
   · Si Azure dice que la sesión es irrecuperable (vencida > 36 h, usuario inactivo, token inválido)
     se muestra un aviso y se vuelve a la pantalla de ingreso; al entrar, regresa a la misma página.
   · Sin token en una página de trabajo (sesión que entró por el respaldo de Google): mismo aviso.
   · Se actualiza también la copia del token que usa Bienestar (bienestarSocialAuth.rl_token).
   Interruptor: localStorage.rl_renovar = 'off'
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._SESION_RENOVAR_V1) return; window._SESION_RENOVAR_V1 = true;
  try { if (localStorage.getItem('rl_renovar') === 'off') return; } catch (e) {}
  var BASE = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api';   /* _SIN_AZURE_V1: antes azurewebsites (lo reescribia el enrutador) */
  var esLogin = /\/index\.html$|\/sistema-rl-verfrut\/?$/.test(location.pathname) || location.pathname === '/';
  var RENOVAR_ANTES_MS = 6 * 3600e3, CADA_MS = 5 * 60000, enCurso = false, avisado = false;

  function tk() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function exp(t) { try { var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return (p.exp || 0) * 1000; } catch (e) { return 0; } }
  function guardar(nuevo) {
    try { sessionStorage.setItem('rl_token', nuevo); } catch (e) {}
    try { var s = JSON.parse(localStorage.getItem('rl_session') || 'null'); if (s) { s.token = nuevo; s.timestamp = Date.now(); localStorage.setItem('rl_session', JSON.stringify(s)); } } catch (e) {}
    try { var b = JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); if (b && b.rl_token !== undefined) { b.rl_token = nuevo; localStorage.setItem('bienestarSocialAuth', JSON.stringify(b)); } } catch (e) {}
  }
  function aviso(msg) {
    if (avisado) return; avisado = true;
    try { sessionStorage.setItem('rl_volver', location.pathname + location.search); } catch (e) {}
    var d = document.createElement('div');
    d.id = 'rlSesionVencida';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,39,72,.72);display:flex;align-items:center;justify-content:center;font-family:Inter,Segoe UI,Arial,sans-serif';
    d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:28px 30px;max-width:420px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center">' +
      '<div style="font-size:34px;margin-bottom:8px">🔐</div><div style="font-size:18px;font-weight:700;color:#0F2748;margin-bottom:8px">Tu sesión venció</div>' +
      '<div style="font-size:14px;color:#475569;line-height:1.5;margin-bottom:18px">' + msg + '</div>' +
      '<button id="rlSesionIr" style="background:#0F2748;color:#fff;border:0;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer">Volver a ingresar</button></div>';
    (document.body || document.documentElement).appendChild(d);
    document.getElementById('rlSesionIr').onclick = function () { try { sessionStorage.clear(); } catch (e) {} try { localStorage.removeItem('rl_session'); } catch (e) {} location.href = '/sistema-rl-verfrut/index.html'; };   /* _SEG_401_V2: ingreso limpio */
  }
  async function revisar(motivo) {
    if (esLogin || enCurso || avisado) return;
    var t = tk();
    var conUsuario = false; try { conUsuario = !!sessionStorage.getItem('user'); } catch (e) {}
    /* _SESION_SIN_BUCLE_V1 (04-nov-2026): si el login entró por Google (Azure no respondió) NO se bloquea la pantalla:
       volver a ingresar daría otra vez una sesión sin credencial y el aviso salía en bucle. Se trabaja con el respaldo. */
    /* _SEG_FASE2_V1 (18-nov-2026): una pantalla de trabajo SIN llave (la llave vencida se borro y la persona apreto F5 en el aviso)
       seguia funcionando todo el dia por Google, lento y sin seguridad. Ahora pide volver a ingresar y regresa a la misma pagina.
       Excepcion: si el ingreso fue validado por Google porque Supabase no respondia (rl_sin = login-google), se trabaja con el
       respaldo como antes, para no crear un bucle. Apagar: localStorage.rl_sin_llave = 'off' */
    if (!t) {
      if (!conUsuario) return;
      var mSin = ''; try { mSin = sessionStorage.getItem('rl_sin') || ''; } catch (x) {}
      var apagado = false; try { apagado = localStorage.getItem('rl_sin_llave') === 'off'; } catch (x) {}
      if (mSin === 'login-google' || apagado) { console.warn('[_SESION_RENOVAR_V1] sesión sin credencial de Supabase (entró por Google): se trabaja con el respaldo'); return; }
      aviso('Por seguridad, vuelve a ingresar. Regresar\u00e1s a esta misma pantalla.');
      return;
    }
    var e = exp(t); if (!e) return;
    if (e - Date.now() > RENOVAR_ANTES_MS) return;   /* todavía le queda más de 6 h */
    enCurso = true;
    try {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, reloj = setTimeout(function () { try { ctl && ctl.abort(); } catch (x) {} }, 10000);
      var r = await fetch(BASE + '/auth/renovar', { method: 'POST', headers: { Authorization: 'Bearer ' + t }, signal: ctl ? ctl.signal : undefined });
      clearTimeout(reloj);
      if (r.status === 401) {
        try { sessionStorage.removeItem('rl_token'); sessionStorage.setItem('rl_sin', 'renovar-401'); localStorage.removeItem('rl_session'); } catch (x) {}   /* _SEG_401_V2 · _SEG_FASE1_V1 */
        var j = null; try { j = await r.json(); } catch (x) {}
        aviso(j && j.motivo === 'inactivo' ? 'Tu usuario fue desactivado. Comunícate con Relaciones Laborales.' : 'Por seguridad, las sesiones se renuevan cada día. Vuelve a ingresar y regresarás a esta misma pantalla.');
        return;
      }
      if (!r.ok) return;   /* Azure dormido o error: se reintenta en 5 min */
      var d = await r.json();
      if (d && d.success && d.token) { guardar(d.token); console.log('[_SESION_RENOVAR_V1] sesión renovada (' + motivo + ')'); }
    } catch (x) { /* red: se reintenta */ } finally { enCurso = false; }
  }
  setTimeout(function () { revisar('inicio'); }, 4000);
  /* _SEG_FASE3_V1: si la llave ya fue rechazada (401) el aviso sale al cargar, no a los 4 s (antes la pantalla alcanzaba a
     pedir todo a Google antes del aviso) */
  try {
    var _m3 = sessionStorage.getItem('rl_sin') || '';
    if (!tk() && (_m3 === 'borrada-401' || _m3 === 'renovar-401') && localStorage.getItem('rl_sin_llave') !== 'off') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { revisar('llave rechazada'); }); else revisar('llave rechazada');
    }
  } catch (e) {}
  setInterval(function () { if (document.visibilityState === 'visible') revisar('reloj'); }, CADA_MS);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(function () { revisar('al volver'); }, 500); });
  window.addEventListener('online', function () { setTimeout(function () { revisar('volvio internet'); }, 1500); });   /* _SESION_PREVIA_V1 */
  window.rlSesion = { renovar: function () { return revisar('manual'); }, vence: function () { var e = exp(tk()); return e ? new Date(e) : null; }, vencida: function (msg) { if (!esLogin) aviso(msg || 'Vuelve a ingresar para continuar.'); } };   /* _SEG_401_V1: aviso disponible para el enrutador */
})();
