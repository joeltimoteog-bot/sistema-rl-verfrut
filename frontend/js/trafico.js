/* ══════ _TRAFICO_V1 (20-set-2026) · _TRAFICO_V2 (28-set-2026) — emisor de eventos de tráfico ══════
   Uso manual: RLTrafico.emit({ accion:'Guardó atención', destino:'Azure SQL', detalle:'N° 19720', tipo:'ok' })
   Escribe un evento liviano en Firebase RTDB /trafico/<ts>_<azar> con el usuario de la sesión.
   Es "dispara y olvida": si Firebase no responde, no pasa nada.

   _TRAFICO_V2: antes solo se veian las acciones que pasaban por el apiPost "viejo" (Google); desde que
   atenciones, casos, visitas, horas, capacitaciones, cumplimiento, usuarios, mantenimiento y 360 guardan
   PRIMERO EN AZURE, esas acciones ya no llegaban al Monitor. Ahora se escucha a nivel de fetch:
     · Azure  /api/<modulo>/guardar/<accion>, /api/atenciones/guardar|update  → destino "Azure SQL"
     · Google (Apps Script) acciones de escritura (save/update/eliminar/registrar...) → "Google Sheets"
     · subida de archivos a Azure Blob → "Azure Blob"
     · busquedas por DNI (trabajadores / atenciones por DNI) → consulta (azul)
     · al abrir cada modulo → "Abrió <modulo>"
   Solo acciones de negocio: nunca datos del trabajador (solo N° de registro). Se incluye en TODAS las paginas. */
window.RLTrafico = window.RLTrafico || (function () {
  var DB = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
  var SIS = 'RR.LL';
  var ultimo = {};
  var nativo = (typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
  function user() {
    try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); if (u && u.usuario) return { u: u.usuario, n: u.nombre || u.usuario, rol: u.rol || '' }; } catch (e) {}
    try { var s = JSON.parse(sessionStorage.getItem('eti_session') || 'null'); if (s && s.user) return { u: s.user, n: s.nom || s.user, rol: s.rol || '' }; } catch (e) {}
    try { if (window.usuarioActual && usuarioActual.usuario) return { u: usuarioActual.usuario, n: usuarioActual.nombre || usuarioActual.usuario, rol: usuarioActual.rol || '' }; } catch (e) {}
    return null;
  }
  function emit(o) {
    try {
      o = o || {};
      var us = o.user || user(); if (!us) return;
      var clave = us.u + '|' + o.accion + '|' + (o.detalle || '');
      var ventana = o.tipo === 'consulta' ? 8000 : 1500;
      if (ultimo[clave] && Date.now() - ultimo[clave] < ventana) return;   // anti-duplicado
      ultimo[clave] = Date.now();
      var id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      var body = { ts: Date.now(), u: String(us.u).toLowerCase().slice(0, 60), n: String(us.n).slice(0, 120), rol: String(us.rol || '').slice(0, 40),
        sis: String(o.sis || SIS).slice(0, 40), accion: String(o.accion || '').slice(0, 80), destino: String(o.destino || '').slice(0, 40),
        detalle: String(o.detalle || '').slice(0, 160), tipo: String(o.tipo || 'ok').slice(0, 12) };
      var f = nativo || window.fetch;
      f(DB + '/trafico/' + id + '.json', { method: 'PUT', body: JSON.stringify(body), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  return { emit: emit, setSistema: function (s) { SIS = s; }, user: user, DB: DB };
})();

/* ── _TRAFICO_V2: escucha automatica de las acciones de negocio ── */
(function () {
  if (window._rlTrfV2 || typeof window.fetch !== 'function') return;
  window._rlTrfV2 = true;
  var T = window.RLTrafico;
  T.auto = true;
  var NOMBRES = {
    saveAtencion: 'Guardó atención', updateAtencion: 'Actualizó atención', deleteAtencion: 'Eliminó atención', guardar: 'Guardó atención', update: 'Actualizó atención',
    saveCaso: 'Registró caso', updateCaso: 'Actualizó caso', eliminarCaso: 'Eliminó caso', deleteCaso: 'Eliminó caso',
    saveVisita: 'Registró visita de campo', updateVisita: 'Actualizó visita de campo', eliminarVisita: 'Eliminó visita de campo',
    cumplJustificar: 'Justificó incumplimiento', cumplConfigGuardar: 'Cambió plazos de cumplimiento', cumplRestriccionLevantar: 'Levantó restricción',
    cumplAusencia: 'Registró ausencia / reemplazo', saveUsuario: 'Creó usuario', updateUsuario: 'Actualizó usuario', saveSolicitudAcceso: 'Pidió acceso temporal',
    resolverAccesoTemporal: 'Resolvió acceso temporal', aprobarAccesoTemporal: 'Resolvió acceso temporal',
    horasRegistrar: 'Registró horas', horasEditar: 'Editó horas', horasEliminar: 'Eliminó horas', horasAprobar: 'Aprobó horas',
    guardarCapacitacion: 'Registró capacitación', duplicarCapacitacion: 'Duplicó capacitación',
    guardarSolicitudMantenimiento: 'Pidió mantenimiento', programarMantenimiento: 'Programó mantenimiento', actualizarEstadoMantenimiento: 'Actualizó mantenimiento',
    saveEvaluacion360: 'Guardó evaluación 360', deleteEvaluacion360: 'Eliminó evaluación 360', savePreaviso: 'Registró preaviso',
    addAlmuerzo: 'Registró almuerzo', updateAlmuerzo: 'Actualizó almuerzo', permisosGuardar: 'Cambió permisos', accesoHorarioGuardar: 'Cambió horario de acceso'
  };
  var NO = /^(cvAplicarDesdeAzure|salud|presencia|ping|keepwarm)/i;
  var ESCRITURA = /^(save|update|delete|eliminar|add|resolver|registrar|aprobar|subir|guardar|programar|actualizar|cumplJustificar|cumplConfigGuardar|cumplRestriccionLevantar|cumplAusencia$|horas(Registrar|Editar|Eliminar|Aprobar)|inv(Agregar|Editar|Eliminar|Registrar|Guardar)|mant_|permisosGuardar|accesoHorario(Guardar|Eliminar)|horarios(Guardar|Eliminar)|duplicar)/i;
  var VERBOS = { save: 'Guardó', guardar: 'Guardó', update: 'Actualizó', actualizar: 'Actualizó', delete: 'Eliminó', eliminar: 'Eliminó', add: 'Agregó', registrar: 'Registró',
    aprobar: 'Aprobó', resolver: 'Resolvió', subir: 'Subió', programar: 'Programó', duplicar: 'Duplicó' };
  function humano(a) {
    if (NOMBRES[a]) return NOMBRES[a];
    var p = String(a).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    var v = VERBOS[String(p[0]).toLowerCase()];
    return v ? v + ' ' + p.slice(1).join(' ').toLowerCase() : String(a);
  }
  function cuerpo(opts) {
    try { var b = opts && opts.body; if (typeof b === 'string' && b.charAt(0) === '{') return JSON.parse(b); } catch (e) {}
    return null;
  }
  function clasificar(url, opts) {
    var m, met = String((opts && opts.method) || 'GET').toUpperCase();
    if (url.indexOf('firebaseio.com') >= 0) return null;
    if (url.indexOf('.blob.core.windows.net') >= 0 && met === 'PUT') return { accion: 'Subió documento', destino: 'Azure Blob', sinJson: true };
    if (url.indexOf('azurewebsites.net/api/') >= 0) {
      var ruta = url.split('/api/')[1].split('?')[0];
      if ((m = ruta.match(/^[\w-]+\/guardar\/(\w+)/))) return { accion: humano(m[1]), destino: 'Azure SQL' };
      if (ruta === 'atenciones/guardar') return { accion: 'Guardó atención', destino: 'Azure SQL' };
      if (ruta === 'atenciones/update') return { accion: 'Actualizó atención', destino: 'Azure SQL' };
      if (ruta === 'atenciones' && met === 'POST') return { accion: 'Sincronizó atención', destino: 'Azure SQL' };
      if (ruta.indexOf('trabajadores/buscar') === 0) return { accion: 'Buscó trabajador', destino: 'Azure SQL', tipo: 'consulta', sinJson: true };
      if (ruta.indexOf('atenciones/by-dni') === 0) return { accion: 'Consultó historial por DNI', destino: 'Azure SQL', tipo: 'consulta', sinJson: true };
      return null;
    }
    if (url.indexOf('script.google.com/macros/') >= 0) {
      var b = cuerpo(opts), a = b && b.action;
      if (!a) { m = url.match(/[?&]action=([^&]+)/); a = m ? decodeURIComponent(m[1]) : ''; }
      if (!a || NO.test(a) || !ESCRITURA.test(a)) return null;
      return { accion: humano(a), destino: 'Google Sheets' };
    }
    return null;
  }
  var previo = window.fetch;
  window.fetch = function (recurso, opts) {
    var p = previo.apply(this, arguments);
    try {
      var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      var c = clasificar(url, opts);
      if (c) p.then(function (resp) {
        try {
          if (!resp || !resp.ok) return;   /* 503/401/red: la pantalla reintenta por Google y ese sí se registra */
          if (c.sinJson) { T.emit({ accion: c.accion, destino: c.destino, tipo: c.tipo || 'ok' }); return; }
          resp.clone().json().then(function (j) {
            if (!j || j.duplicadoEvitado) return;
            var ok = j.success === true || j.ok === true || (j.success === undefined && !j.error);
            var nro = j.nro || j.id || '';
            if (ok) T.emit({ accion: c.accion, destino: c.destino, detalle: nro ? 'N° ' + nro : '', tipo: c.tipo || 'ok' });
            else if (j.error || j.msg) T.emit({ accion: 'No pudo: ' + c.accion.toLowerCase(), destino: c.destino, detalle: String(j.error || j.msg).slice(0, 80), tipo: 'error' });
          }).catch(function () {});
        } catch (e) {}
      }, function () {});
    } catch (e) {}
    return p;
  };
  /* "Abrió <modulo>" una vez por sesion y pagina */
  try {
    var pag = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
    var NOMP = { dashboard: 'Dashboard', horas: 'Horas', capacitaciones: 'Capacitaciones', mantenimiento: 'Mantenimiento', evaluacion360: 'Evaluación 360', almuerzos: 'Almuerzos',
      preaviso: 'Preavisos', inventario: 'Inventario', 'calculo-remunerativo': 'Cálculo remunerativo', 'consulta-masiva': 'Consulta masiva', estadisticas: 'Estadísticas',
      'estadisticas-atenciones': 'Estadísticas de atenciones', resumen: 'Resumen general', usuarios: 'Gestión usuarios', 'informe-gerencial': 'Informe gerencial' };
    if (NOMP[pag] && pag !== 'dashboard') {
      var k = '_trf_pag_' + pag;
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); setTimeout(function () { T.emit({ accion: 'Abrió ' + NOMP[pag], destino: 'Firebase' }); }, 1500); }
    }
  } catch (e) {}
})();
