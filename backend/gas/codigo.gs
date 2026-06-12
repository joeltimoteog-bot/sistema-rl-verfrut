// ============================================================
// SISTEMA RL v3.0 - VERFRUT & RAPEL // v3
// Google Apps Script - API completa
// ============================================================

const SPREADSHEET_ID = '1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw';
// â­ Whitelist de administradores autorizados a eliminar visitas
// IMPORTANTE: Mantener sincronizado con dashboard.html
const ADMINS_ELIMINAR_VISITA = ['jtimoteo', 'ovilela', 'jchavez'];
// â­ Whitelist de administradores autorizados a eliminar casos (mover a hoja Casos_Eliminados)
const ADMINS_ELIMINAR_CASO = ['jtimoteo', 'ovilela', 'jchavez'];
// Fundos por supervisor
const FUNDOS_SUPERVISOR = {
  'ptamayo':    ['El Papayo', 'Limones'],
  'atineo':     ['Olivares Bajo'],
  'fpulache':   ['Los Olivares'],
  'yluzon':     ['Santa Rosa'],
  'sviera':     ['Algarrobos'],
  'ecastro':    ['San Vicente'],
  'almartinez': ['Punta Arenas'],
  'fzapata':    ['Aproa'],
  'rmolero':    ['Planta Rapel'],
  'mmechato':   []
};
// Supervisores que eligen fundo al iniciar sesion
const SUP_MULTI = ['ptamayo', 'mmechato', 'rmolero'];

function doGet(e)  { return handle(e); }
function doPost(e) { return handle(e); }
 
function handle(e) {
  const params = e.parameter || {};
  const body   = e.postData ? JSON.parse(e.postData.contents) : {};
  const action = params.action || body.action;
  let result;
  try {
    switch(action) {
      case 'login':             result = login(body);              break;
      case 'getPreload':        result = getPreload(params);        break;
      case 'getPreloadOptimizado': result = getPreloadOptimizado(params); break;  
      case 'getAtenciones':     result = getAtenciones(params);    break;
       case 'getAtencionesOptimizado': result = getAtencionesOptimizado(params); break;
      case 'saveAtencion':      result = saveAtencion(body);       break;
      case 'syncFirebaseAtencion': result = syncFirebaseAtencion(body); break;
      case 'updateAtencion':    result = updateAtencion(body);     break;
      case 'deleteAtencion':    result = deleteAtencion(body);     break;
      case 'buscarTrabajador':  result = buscarTrabajador(params); break;
      case 'getResponsablesEnRango': result = getResponsablesEnRango(params); break;   // â† NUEVA LÃNEA
      case 'consultaDNI':       result = consultaDNI(params);      break;
      case 'getUsuarios':       result = getUsuarios();            break;
      case 'saveUsuario':       result = saveUsuario(body);        break;
      case 'updateUsuario':     result = updateUsuario(body);      break;
      case 'getEstadisticas':   result = getEstadisticas(params);  break;
      case 'getResumenGeneral': result = getResumenGeneral(params);break;
      case 'getReporteCorreo':  result = getReporteCorreo(params); break;
      case 'limpiarCache':       result = limpiarCache();           break;
      case 'diagnostico':        result = diagnostico();            break;
      case 'saveVisita':         result = saveVisita(body);         break;
      case 'getVisitas':         result = getVisitas(params);       break;
      case 'getSupervisores':    result = getSupervisores();        break;
      case 'saveSupervisor':     result = saveSupervisor(body);     break;
      case 'registrarArchivoAzure': result = registrarArchivoAzure(body); break;
      case 'saveCaso':          result = saveCaso(body);          break;
      case 'getCasos':          result = getCasos(params);        break;
      case 'saveFusion':        result = saveFusion(body);        break;
      case 'updateFusion': result = updateFusion(body); break;
      case 'getFusiones':       result = getFusiones(params);     break;
      case 'saveSolicitud':      result = saveSolicitud(body);      break;
      case 'getSolicitudes':     result = getSolicitudes(params);   break;
      case 'resolverSolicitud':  result = resolverSolicitud(body);  break;
      case 'getEstadisticasAdmin': result = getEstadisticasAdmin(params); break;
      case 'getEvaluaciones360':  result = getEvaluaciones360(params);   break;
      case 'saveEvaluacion360':   result = saveEvaluacion360(body);      break;
      case 'getSupervisoresEval': result = getSupervisoresEval();        break;
      case 'saveSupervisorEval':  result = saveSupervisorEval(body);     break;
      case 'updateVisita':        result = updateVisita(body);           break;
      case 'eliminarVisita':    result = eliminarVisita(body);   break;
      case 'eliminarCaso':      result = eliminarCaso(body);     break;
      case 'updateCaso':          result = updateCaso(body);             break;
      case 'recalcularEstadisticasCompletas': result = recalcularEstadisticasCompletas(); break;
      case 'saveSolicitudAcceso':     result = saveSolicitudAcceso(body);       break;
      case 'aprobarAccesoTemporal':   result = aprobarAccesoTemporal(body);     break;
      case 'verificarAccesoTemporal': result = verificarAccesoTemporal(Object.assign({}, params, body)); break;
      case 'getSolicitudesAcceso':    result = getSolicitudesAcceso(params);    break;
      case 'resolverAccesoTemporal':  result = aprobarAccesoTemporal(body);     break;
      case 'subirArchivoAzure':       result = subirArchivoAzure(body);         break;
      case 'invListarSectores':       result = invListarSectores(); break;
      case 'invAgregarSector':        result = invAgregarSector(Object.assign({}, params, body)); break;
      case 'invEditarSector':         result = invEditarSector(Object.assign({}, params, body)); break;
      case 'invEliminarSector':       result = invEliminarSector(Object.assign({}, params, body)); break;
      case 'invListarSupervisores':   result = invListarSupervisores(); break;
      case 'buscarResponsableMantenimiento': result = buscarResponsableMantenimiento(params); break;
      case 'guardarSolicitudMantenimiento':  result = guardarSolicitudMantenimiento(body);    break;
      case 'listarSolicitudesMantenimiento': result = listarSolicitudesMantenimiento(params); break;
      case 'programarMantenimiento':         result = programarMantenimiento(body);           break;
      case 'getResponsablesEnRango':  result = getResponsablesEnRango(params); break;
      case 'listaConductores': result = listaConductores(); break;
      case 'deleteEvaluacion360': result = deleteEvaluacion360(body); break;

 
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• MÃ“DULO CAPACITACIONES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      case 'guardarCapacitacion':          result = capGuardar(body);          break;
      case 'listarCapacitaciones':         result = capListar(body);           break;
      case 'exportarCapacitaciones':       result = capExportar(body);         break;
      case 'estadisticasCapacitaciones':   result = capEstadisticas(body);     break;
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• MÃ“DULO INVENTARIO â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      case 'invGetAll':                 result = invGetAll();                  break;
      case 'invGuardarMeta':            result = invGuardarMeta(body);         break;
      case 'invAgregarReceta':          result = invAgregarReceta(body);       break;
      case 'invEliminarReceta':         result = invEliminarReceta(body);      break;
      case 'invAgregarResponsable':     result = invAgregarResponsable(body);  break;
      case 'invEliminarResponsable':    result = invEliminarResponsable(body); break;
      case 'invRegistrarIngreso':       result = invRegistrarIngreso(body);    break;
      case 'invRegistrarArmado':        result = invRegistrarArmado(body);     break;
      case 'invRegistrarEntrega':       result = invRegistrarEntrega(body);    break;
      case 'invDatosReporte':           result = invDatosReporte(body);        break;
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• MÃ“DULO INVENTARIO V2 â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      case 'invListarProductos':    result = invListarProductos();        break;
      case 'invAgregarProducto':    result = invAgregarProducto(body);    break;
      case 'invEditarProducto':     result = invEditarProducto(body);     break;
      case 'invEliminarProducto':   result = invEliminarProducto(body);   break;
      case 'invEditarIngreso':      result = invEditarIngreso(body);      break;
      case 'invEliminarIngreso':    result = invEliminarIngreso(body);    break;
      case 'invEditarArmado':       result = invEditarArmado(body);       break;
      case 'invEliminarArmado':     result = invEliminarArmado(body);     break;
      case 'invEditarEntrega':      result = invEditarEntrega(body);      break;
      case 'invEliminarEntrega':    result = invEliminarEntrega(body);    break;
      case 'horasBuscarTrabajador':   result = horasBuscarTrabajador(Object.assign({}, params, body)); break;
      case 'horasRegistrar':          result = horasRegistrar(Object.assign({}, params, body)); break;
      case 'horasListar':             result = horasListar(Object.assign({}, params, body)); break;
      case 'horasEditar':             result = horasEditar(Object.assign({}, params, body)); break;
      case 'horasEliminar':           result = horasEliminar(Object.assign({}, params, body)); break;
      case 'horasAprobar':            result = horasAprobar(Object.assign({}, params, body)); break;
      case 'horasResumenIndividual':  result = horasResumenIndividual(Object.assign({}, params, body)); break;
      case 'horasResumenGeneral':     result = horasResumenGeneral(); break;
      case 'horasListarMotivos':      result = horasListarMotivos(); break;
      case 'horasAgregarMotivo':      result = horasAgregarMotivo(Object.assign({}, params, body)); break;
      case 'horasEliminarMotivo':     result = horasEliminarMotivo(Object.assign({}, params, body)); break;
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     case 'resumenEjecutivo': result = resumenEjecutivoCached(body); break;
    case 'getInformesIntegrales': result = getInformesIntegrales(params); break;
     case 'saveInformeIntegral':   result = saveInformeIntegral(body);     break;
     case 'updateInformeIntegral': result = updateInformeIntegral(body);   break;
     case 'actualizarEstadoMantenimiento': result = actualizarEstadoMantenimiento(body); break;
      case 'getEstadosMantenimiento':       result = getEstadosMantenimiento();           break;
      case 'getSupervisoresCasos': result = getSupervisoresCasos(); break;
      default: result = { error: 'Accion no reconocida: ' + action };
    }
  } catch(err) {
    result = { error: err.toString() };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// LOGIN
// ============================================================
function login(d) {
  // Cache de hoja Usuarios para mÃºltiples logins simultÃ¡neos
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'usuarios_hoja_v1';
  var rows;

  var cached = cache.get(cacheKey);
  if (cached) {
    try { rows = JSON.parse(cached); } catch(e) { rows = null; }
  }

  if (!rows) {
    rows = getSheet('Usuarios').getDataRange().getValues();
    try { cache.put(cacheKey, JSON.stringify(rows), 300); } catch(e) {}
  }

  // Lectura en dos etapas: primeras 50 filas primero
  var encontrado = null;
  var buscar = function(desde, hasta) {
    for (var i = desde; i < Math.min(hasta, rows.length); i++) {
      var r = rows[i];
      var usuario  = String(r[1]).trim();
      var password = String(r[2]).trim();
      var activo   = String(r[6]).trim().toUpperCase();
      if (usuario === String(d.usuario).trim() && password === String(d.password).trim()) {
        if (activo !== 'TRUE') return { success: false, error: 'Usuario inactivo. Contacta al administrador.' };
        var fundos = FUNDOS_SUPERVISOR[usuario] || [];
        var necesitaElegirFundo = SUP_MULTI.includes(usuario);
        return {
          success: true,
          user: {
            id:                 String(r[0]).trim(),
            usuario:            usuario,
            nombre:             String(r[3]).trim(),
            rol:                String(r[4]).trim().toLowerCase(),
            empresa:            String(r[5]).trim().toUpperCase(),
            correo:             String(r[8] || '').trim(),
            cargo:              String(r[9] || '').trim(),  // LINEA NUEVA 
            fundos:             fundos,
            necesitaElegirFundo: necesitaElegirFundo
          }
        };
      }
    }
    return null;
  };

  // Buscar en primeras 50 filas (mÃ¡s rÃ¡pido)
  encontrado = buscar(1, 51);
  // Si no encontrÃ³, buscar el resto
  if (!encontrado) encontrado = buscar(51, rows.length);

  return encontrado || { success: false, error: 'Usuario o contrasena incorrectos.' };
}

// ============================================================
// COLUMNAS ATENCIONES (28)
// ============================================================
const COLS = [
  'nro','fecha_atencion','hora_inicio','hora_termino',
  'nro_semana','mes','anio','dni','nombre','sexo',
  'fecha_inicio_periodo','empresa','fundo','cargo','ruta',
  'codigo','fundo_actual','celular','supervisor','detalle_documento',
  'fecha_inicio_doc','fecha_termino_doc','dias_transcurridos',
  'responsable_recepcion','observaciones','estado',
  'fecha_registro','usuario_sistema'
];

// â”€â”€ Lectura optimizada: Ãºltimas N filas de una hoja â”€â”€
// Evita leer miles de filas histÃ³ricas innecesariamente
function getRowsOptimized(sheet, maxRows) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];          // solo header
  const startRow = Math.max(2, lastRow - maxRows + 1);
  const numRows  = lastRow - startRow + 1;
  return sheet.getRange(startRow, 1, numRows, lastCol).getValues();
}

// Lectura del aÃ±o actual: lee desde atrÃ¡s hasta encontrar filas del aÃ±o anterior
function getRowsCurrentYear(sheet, maxRows, colFecha) {
  const lastRow  = sheet.getLastRow();
  const lastCol  = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  const anioActual = new Date().getFullYear();
  // Leer en bloques de 500 desde el final
  const bloque = Math.min(maxRows, lastRow - 1);
  const startRow = Math.max(2, lastRow - bloque + 1);
  const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  // Filtrar solo aÃ±o actual (o sin fecha = incluir)
  return rows.filter(r => {
    if (!r[0]) return false;
    const fecha = r[colFecha];
    if (!fecha) return true;
    const d = (fecha instanceof Date) ? fecha : new Date(fecha);
    return isNaN(d.getTime()) || d.getFullYear() >= anioActual - 1; // aÃ±o actual y anterior
  });
}

// ============================================================
// ATENCIONES - GET
// ============================================================
function getAtenciones(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anio = new Date().getFullYear();
  const rol = p.rol || '';
  let rows = [];

  if (rol === 'supervisor') {
    const ws = ss.getSheetByName('BB. DE REGISTROS ' + anio) || ss.getSheetByName('BB. DE REGISTROS');
    if (!ws) return { success: true, data: [] };
    rows = p.historial ? ws.getDataRange().getValues().slice(1) : getRowsCurrentYear(ws, 1000, 1);
  } else {
    const hojas = ['BB. DE REGISTROS 2024','BB. DE REGISTROS 2025','BB. DE REGISTROS ' + anio,'BB. DE REGISTROS'];
    const vistos = new Set();
    hojas.forEach(n => {
      const ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(r => {
        const k = n + '_' + String(r[0]);
        if (!k || vistos.has(k)) return;
        vistos.add(k); rows.push(r);
      });
    });
  }

  if (!rows.length) return { success: true, data: [] };

  let lista = rows.filter(r => r[0] || r[7]).map((r, i) => {
    let o = {}; COLS.forEach((h, j) => o[h] = r[j]);
    if (o.fecha_atencion instanceof Date) o.fecha_atencion = fmt(o.fecha_atencion,'yyyy-MM-dd');
    o._fila = i + 2;
    return o;
  });

  if (rol === 'supervisor') {
    const buscar = String(p.usuario||'').trim().toLowerCase();
    const nombre = String(p.nombre||'').trim().toLowerCase();
    lista = lista.filter(a => {
      const sup = String(a.supervisor||'').trim().toLowerCase();
      return sup === buscar || sup === nombre;
    });
  }
  if (p.empresa && p.empresa !== 'AMBAS') lista = lista.filter(a => String(a.empresa).toUpperCase() === p.empresa);
  if (p.estado) lista = lista.filter(a => String(a.estado).toUpperCase() === p.estado.toUpperCase());
  if (p.mes)    lista = lista.filter(a => String(a.mes) === String(p.mes));
  if (p.anio)   lista = lista.filter(a => String(a.anio) === String(p.anio));
  if (p.q) { const q = p.q.toLowerCase(); lista = lista.filter(a => String(a.dni).includes(q) || String(a.nombre).toLowerCase().includes(q)); }
  lista.sort((a, b) => String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)));
  return { success: true, data: lista };
}

// ============================================================
// ATENCIONES - SAVE
// ============================================================
function saveAtencion(d) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const nombreHoja = 'BB. DE REGISTROS ' + anioActual;
  let sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = ss.insertSheet(nombreHoja);
    const base = ss.getSheetByName('BB. DE REGISTROS');
    if (base) {
      const hdrs = base.getRange(1,1,1,base.getLastColumn()).getValues();
      sheet.getRange(1,1,1,hdrs[0].length).setValues(hdrs);
    }
  }
  const nro    = sheet.getLastRow();
  const ahora  = new Date();
  const fechaAt = d.fecha_atencion ? new Date(d.fecha_atencion + 'T12:00:00') : ahora;
  sheet.appendRow([
    nro,
    d.fecha_atencion || fmt(ahora, 'yyyy-MM-dd'),
    d.hora_inicio    || fmt(ahora, 'HH:mm'),
    d.hora_termino   || '',
    getSemana(fechaAt),
    fechaAt.getMonth() + 1,
    fechaAt.getFullYear(),
    d.dni || '', d.nombre || '', d.sexo || '',
    d.fecha_inicio_periodo || '',
    d.empresa || '', d.fundo || '', d.cargo || '',
    d.ruta || '', d.codigo || '', d.fundo_actual || '',
    d.celular || '', d.supervisor || '',
    d.detalle_documento || '',
    d.fecha_inicio_doc || '', d.fecha_termino_doc || '',
    d.dias_transcurridos || '',
    d.responsable_recepcion || '',
    d.observaciones || '',
    d.estado || 'EN PROCESO',
    new Date(),
    d.usuario_sistema || ''
  ]);

  // Actualizar Firebase en tiempo real
// Actualizar Firebase en tiempo real
 // try { actualizarFirebaseRapido(d); } catch(e) { Logger.log('Firebase rapid error: ' + e); }
 // Firebase se actualiza en 2do plano via accion 'syncFirebaseAtencion' (no bloquea el guardado)
  
  // â­ NUEVO: Guardar tambiÃ©n en Azure SQL (no bloquea si falla)
  let azureResult = null;
  try {
    // Preparar datos con campos calculados (mes, anio, nro_semana)
    const dataAzure = Object.assign({}, d, {
      nro: nro,
      mes: fechaAt.getMonth() + 1,
      anio: fechaAt.getFullYear(),
      nro_semana: getSemana(fechaAt)
    });
    azureResult = saveAtencionAzure(dataAzure);
  } catch(e) { 
    Logger.log('Azure SQL error: ' + e); 
  }
  
  return { 
    success: true, 
    nro: nro, 
    hoja: nombreHoja,
    azure: azureResult ? { synced: azureResult.success, id: azureResult.azureId } : null
  };
}
  function syncFirebaseAtencion(d) {
  try { actualizarFirebaseRapido(d); return { success: true }; }
  catch(e) { return { success: false, error: String(e) }; }
}

// ============================================================
// ATENCIONES - UPDATE
// ============================================================
function updateAtencion(d) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const candidatos = [];

  // Buscar en hojas por aÃ±o primero, luego base
  const sheetAnio = ss.getSheetByName('BB. DE REGISTROS ' + anioActual);
  if (sheetAnio) candidatos.push(sheetAnio);
  for (let y = anioActual - 1; y >= anioActual - 3; y--) {
    const ws = ss.getSheetByName('BB. DE REGISTROS ' + y);
    if (ws) candidatos.push(ws);
  }
  const base = ss.getSheetByName('BB. DE REGISTROS');
  if (base) candidatos.push(base);

  for (const sheet of candidatos) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(d.nro)) {
        // Verificar permisos: cross-supervisor permitido SOLO si unicamente cambia estado
           const _camposEdit = Object.keys(d).filter(function(k){
             return ['action','nro','rol','usuario','estado'].indexOf(k) === -1;
           });
           const _esSoloEstado = _camposEdit.length === 0;
           const _esCrossSupervisor = d.rol === 'supervisor' && String(rows[i][27]).trim() !== String(d.usuario).trim();
           if (_esCrossSupervisor && !_esSoloEstado) {
             return { success: false, error: 'No tienes permiso para editar este registro.' };
           }
           if (_esCrossSupervisor && _esSoloEstado) {
             Logger.log('[updateAtencion] Cross-supervisor estado change: nro=' + d.nro + ' por=' + d.usuario + ' (original=' + rows[i][27] + ') estado=' + d.estado);
           }
        const r = i + 1;
        if (d.fecha_atencion      !== undefined) sheet.getRange(r, 2).setValue(d.fecha_atencion);
        if (d.hora_inicio         !== undefined) sheet.getRange(r, 3).setValue(d.hora_inicio);
        if (d.hora_termino        !== undefined) sheet.getRange(r, 4).setValue(d.hora_termino);
        if (d.fecha_inicio_periodo!== undefined) sheet.getRange(r, 11).setValue(d.fecha_inicio_periodo);
        if (d.empresa             !== undefined) sheet.getRange(r, 12).setValue(d.empresa);
        if (d.fundo               !== undefined) sheet.getRange(r, 13).setValue(d.fundo);
        if (d.cargo               !== undefined) sheet.getRange(r, 14).setValue(d.cargo);
        if (d.ruta                !== undefined) sheet.getRange(r, 15).setValue(d.ruta);
        if (d.fundo_actual        !== undefined) sheet.getRange(r, 17).setValue(d.fundo_actual);
        if (d.celular             !== undefined) sheet.getRange(r, 18).setValue(d.celular);
        if (d.detalle_documento   !== undefined) sheet.getRange(r, 20).setValue(d.detalle_documento);
        if (d.fecha_inicio_doc    !== undefined) sheet.getRange(r, 21).setValue(d.fecha_inicio_doc);
        if (d.fecha_termino_doc   !== undefined) sheet.getRange(r, 22).setValue(d.fecha_termino_doc);
        if (d.dias_transcurridos  !== undefined) sheet.getRange(r, 23).setValue(d.dias_transcurridos);
        if (d.responsable_recepcion !== undefined) sheet.getRange(r, 24).setValue(d.responsable_recepcion);
        if (d.observaciones       !== undefined) sheet.getRange(r, 25).setValue(d.observaciones);
        if (d.estado              !== undefined) sheet.getRange(r, 26).setValue(d.estado);
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
        return { success: true };
      }
    }
  }
  return { success: false, error: 'Registro no encontrado.' };
}

// ============================================================
// ATENCIONES - DELETE
// ============================================================
function deleteAtencion(d) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const candidatos = [];
  
  // Buscar en hoja del aÃ±o actual primero
  const sheetAnio = ss.getSheetByName('BB. DE REGISTROS ' + anioActual);
  if (sheetAnio) candidatos.push(sheetAnio);
  
  // AÃ±os anteriores
  for (let y = anioActual - 1; y >= anioActual - 3; y--) {
    const ws = ss.getSheetByName('BB. DE REGISTROS ' + y);
    if (ws) candidatos.push(ws);
  }
  
  // Hoja base como respaldo
  const base = ss.getSheetByName('BB. DE REGISTROS');
  if (base) candidatos.push(base);

  for (const sheet of candidatos) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(d.nro)) {
        if (d.rol === 'supervisor' && 
            String(rows[i][18]).trim().toLowerCase() !== String(d.usuario).trim().toLowerCase() &&
            String(rows[i][27]).trim().toLowerCase() !== String(d.usuario).trim().toLowerCase()) {
          return { success: false, error: 'No tienes permiso para eliminar este registro.' };
        }
        sheet.deleteRow(i + 1);
         try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
        return { success: true };
      }
    }
  }
  return { success: false, error: 'Registro no encontrado.' };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  4) consultaDNI â€” acepta fechaDesde, fechaHasta, supervisor
//     DNI ahora es opcional si hay otros filtros
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function consultaDNI(p) {
  const dni        = String(p.dni        || '').trim();
  const fechaDesde = String(p.fechaDesde || '').trim();
  const fechaHasta = String(p.fechaHasta || '').trim();
  const supervisor = String(p.supervisor || '').trim().toLowerCase();
 
  if (!dni && !fechaDesde && !fechaHasta && !supervisor) {
    return { success: false, error: 'Ingresa un DNI o un rango de fechas para buscar' };
  }
  if (dni && dni.length < 7) {
    return { success: false, error: 'DNI invÃ¡lido (mÃ­nimo 7 dÃ­gitos)' };
  }
 
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anio = new Date().getFullYear();
  const hojas = [
    'BB. DE REGISTROS 2024',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS ' + anio,
    'BB. DE REGISTROS'
  ];
 
  let lista = [];
  let trabajador = null;
  const vistos = new Set();
 
  hojas.forEach(function(nombreHoja) {
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return;
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) return;
 
    for (let i = 1; i < rows.length; i++) {
      if (dni && String(rows[i][7]).trim() !== dni) continue;
 
      let fechaAt = '';
      if (rows[i][1] instanceof Date) {
        fechaAt = Utilities.formatDate(rows[i][1], 'GMT-5', 'yyyy-MM-dd');
      } else {
        fechaAt = String(rows[i][1] || '').substring(0, 10);
      }
      if (fechaDesde && fechaAt && fechaAt < fechaDesde) continue;
      if (fechaHasta && fechaAt && fechaAt > fechaHasta) continue;
 
      if (supervisor) {
        const sup = String(rows[i][18] || '').trim().toLowerCase();
        const matchExacto   = sup === supervisor;
        const matchContiene = sup && (sup.indexOf(supervisor) !== -1 || supervisor.indexOf(sup) !== -1);
        if (!matchExacto && !matchContiene) continue;
      }
 
      const k = String(rows[i][0]) + '_' + nombreHoja;
      if (vistos.has(k)) continue;
      vistos.add(k);
 
      let o = {};
      COLS.forEach(function(h, j) { o[h] = rows[i][j]; });
      o.fecha_atencion = fechaAt;
      lista.push(o);
 
      if (!trabajador && dni) {
        trabajador = {
          dni:     rows[i][7],
          nombre:  rows[i][8],
          empresa: rows[i][11],
          cargo:   rows[i][13],
          fundo:   rows[i][12]
        };
      }
    }
  });
 
  lista.sort(function(a, b) {
    return String(b.fecha_atencion).localeCompare(String(a.fecha_atencion));
  });
 
  // Enriquecer con ruta/codigo/cumpleanos
  if (lista.length) {
    try {
      let mapTrab = {};
      const trabsR = getDatosCached('Trabajadores_RAPEL')   || cargarDatosTrabajadores('Trabajadores_RAPEL');
      const trabsV = getDatosCached('Trabajadores_VERFRUT') || cargarDatosTrabajadores('Trabajadores_VERFRUT');
      [trabsR, trabsV].forEach(function(arr) {
        arr.forEach(function(t) {
          if (t[0]) mapTrab[String(t[0]).trim()] = { ruta: t[6], codigo: t[7], cumpleanos: t[11] };
        });
      });
      lista = lista.map(function(o) {
        const t = mapTrab[String(o.dni || '').trim()] || {};
        if (!o.ruta)   o.ruta   = t.ruta   || '';
        if (!o.codigo) o.codigo = t.codigo || '';
        o.cumpleanos = t.cumpleanos || '';
        return o;
      });
    } catch(e) { Logger.log('Enriquecer consultaDNI: ' + e); }
  }
 
  console.log('consultaDNI ' + (dni||'(sin DNI)') + ' [' + (fechaDesde||'') + '/' + (fechaHasta||'') + '] sup=' + (supervisor||'') + ': ' + lista.length + ' atenciones');
  return { success: true, data: lista, trabajador: trabajador };
}
// ============================================================
// BUSCAR TRABAJADOR - con cache para mejor rendimiento
// A=DNI(0), F=fecha_inicio_periodo(5), G=sexo(6), H=cargo(7),
// K=zona/fundo(10), N=empresa(13), O=nombre(14), P=ruta(15), Q=codigo(16)
// ============================================================
function cargarDatosTrabajadores(hoja) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(hoja);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  // Lee 19 cols para incluir fecha_nacimiento (col 19 = idx 18)
  const rows = sh.getRange(2, 1, lastRow - 1, 19).getValues();
  const datos = [];
  for (let i = 0; i < rows.length; i++) {
    const r   = rows[i];
    const dni = String(r[0] || '').trim().replace(/\.0$/, '');
    const nom = String(r[14] || '').trim();
    if (!dni && !nom) continue;
    datos.push([
      dni,                                    // 0: DNI
      nom,                                    // 1: Nombre
      String(r[6]  || '').trim(),             // 2: Sexo
      r[5] instanceof Date ? Utilities.formatDate(r[5],'GMT-5','yyyy-MM-dd') : String(r[5]||'').trim(), // 3: FIP
      String(r[10] || '').trim(),             // 4: Fundo
      String(r[7]  || '').trim(),             // 5: Cargo
      String(r[15] || '').trim(),             // 6: Ruta
      String(r[16] || '').trim(),             // 7: Codigo
      r[17] instanceof Date ? Utilities.formatDate(r[17],'GMT-5','yyyy-MM-dd') : String(r[17]||'').trim(), // 8: FTP
      String(r[13] || '').trim(),             // 9: Empresa
      String(r[8]  || '').trim(),             // 10: Regimen
      r[18] instanceof Date ? Utilities.formatDate(r[18],'GMT-5','yyyy-MM-dd') : String(r[18]||'').trim()  // 11: CumpleaÃ±os NUEVO
    ]);
  }
  return datos;
}
function getCacheKey(hoja) { return 'v3_' + hoja; }

function getDatosCached(hoja) {
  const cache = CacheService.getScriptCache();
  const key   = getCacheKey(hoja);
  const meta  = cache.get(key + '_meta');
  if (!meta) return null;
  const { chunks } = JSON.parse(meta);
  let json = '';
  for (let i = 0; i < chunks; i++) {
    const part = cache.get(key + '_' + i);
    if (!part) return null;
    json += part;
  }
  return JSON.parse(json);
}

function setDatosCached(hoja, datos) {
  const cache  = CacheService.getScriptCache();
  const key    = getCacheKey(hoja);
  const json   = JSON.stringify(datos);
  const size   = 90000;
  const chunks = Math.ceil(json.length / size);
  for (let i = 0; i < chunks; i++) {
   cache.put(key + '_' + i, json.substring(i * size, (i + 1) * size), 21600);
  }
  cache.put(key + '_meta', JSON.stringify({ chunks }), 21600);
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  3) buscarTrabajador â€” devuelve cumpleaÃ±os
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buscarTrabajador(p) {
  const q      = (p.q || '').toLowerCase().trim();
  const empUp  = (p.empresa || '').toUpperCase();
  const empNorm = (empUp.indexOf('RAPEL') !== -1 && empUp.indexOf('VERFRUT') === -1) ? 'RAPEL'
                : (empUp.indexOf('VERFRUT') !== -1) ? 'VERFRUT'
                : 'AMBAS';
  if (!q || q.length < 2) return { success: true, data: [] };
  const esDNI = /^[0-9]+$/.test(q);
  let res = [];
  const buscar = (hoja, empresa) => {
    try {
      let datos = getDatosCached(hoja);
      if (!datos) { datos = cargarDatosTrabajadores(hoja); setDatosCached(hoja, datos); }
      for (let i = 0; i < datos.length && res.length < 20; i++) {
        const [dniRaw, nombre, sexo, fip, fundo, cargo, ruta, codigo, ftp, empSheet, regimen, cumpleanos] = datos[i];
        const dni   = esDNI && dniRaw.length === 7 ? '0' + dniRaw : dniRaw;
        const qNorm = esDNI && q.length === 8 && q.startsWith('0') ? q.substring(1) : q;
        const coincide = esDNI
          ? dni === q || dniRaw === q || dniRaw === qNorm
          : nombre.toLowerCase().includes(q);
        if (coincide) {
          res.push({
            dni, nombre, sexo,
            fecha_inicio_periodo:  fip||'',
            fecha_termino_periodo: ftp||'',
            empresa: empSheet || empresa,
            fundo, cargo, ruta, codigo,
            cumpleanos: cumpleanos || '',
            regimen: regimen||'',
            fundo_actual: fundo,
            celular: ''
          });
        }
      }
    } catch(e) { Logger.log('buscarTrabajador error ' + hoja + ': ' + e.toString()); }
  };
  if (empNorm === 'RAPEL'   || empNorm === 'AMBAS') buscar('Trabajadores_RAPEL',   'RAPEL');
  if (empNorm === 'VERFRUT' || empNorm === 'AMBAS') buscar('Trabajadores_VERFRUT', 'VERFRUT');
  return { success: true, data: res };
}
// Limpiar cache manualmente (llamar cuando se actualice la base de trabajadores)
function limpiarCache(p) {
  try {
    const scriptCache = CacheService.getScriptCache();
    // Limpiar cache de trabajadores
    for (let i = 0; i < 20; i++) {
      scriptCache.remove('v2_Trabajadores_RAPEL_' + i);
      scriptCache.remove('v2_Trabajadores_VERFRUT_' + i);
    }
    scriptCache.remove('v2_Trabajadores_RAPEL_meta');
    scriptCache.remove('v2_Trabajadores_VERFRUT_meta');
    scriptCache.remove('preload_global');
    // Limpiar cache de usuario
    if (p && p.usuario) {
      const userCache = CacheService.getUserCache();
      const roles = ['supervisor','administrador','coordinador','jefa_rl'];
      roles.forEach(rol => {
        try { userCache.remove('preload_' + p.usuario + '_' + rol); } catch(e){}
      });
    }
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function limpiarCacheTrabajadores() {
  const cache = CacheService.getScriptCache();
  for (let i = 0; i < 20; i++) {
    cache.remove('v2_Trabajadores_RAPEL_' + i);
    cache.remove('v2_Trabajadores_VERFRUT_' + i);
  }
  cache.remove('v2_Trabajadores_RAPEL_meta');
  cache.remove('v2_Trabajadores_VERFRUT_meta');
  Logger.log('Cache trabajadores limpiado OK');
}

// ============================================================
// ESTADISTICAS
// ============================================================
function getEstadisticas(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anio = new Date().getFullYear();
  const rol = p.rol || '';
  let rows = [];

  if (rol === 'supervisor') {
    // Supervisores: solo aÃ±o actual
    const ws = ss.getSheetByName('BB. DE REGISTROS ' + anio) || ss.getSheetByName('BB. DE REGISTROS');
    if (ws) rows = getRowsCurrentYear(ws, 1000, 1);
  } else {
    // Admins: combinar 2024 + 2025 + 2026 + base
    const hojas = ['BB. DE REGISTROS 2024','BB. DE REGISTROS 2025','BB. DE REGISTROS ' + anio,'BB. DE REGISTROS'];
    const vistos = new Set();
    hojas.forEach(n => {
      const ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(r => {
        const k = n + '_' + String(r[0]);
        if (!k || vistos.has(k)) return;
        vistos.add(k); rows.push(r);
      });
    });
  }

  if (!rows.length) return { success:true, data:{hoy:0,mes:0,anio:0,total:0,pendientes:0,porMes:{},porTipo:{},porEstado:{}} };

  const mesN = new Date().getMonth() + 1;
  const aniN = new Date().getFullYear();
  const hoyStr = fmt(new Date(), 'yyyy-MM-dd');
  let lista = [];

  rows.forEach(r => {
    if (!r[0] && !r[7]) return;
    let o = {}; COLS.forEach((h, j) => o[h] = r[j]);
    if (o.fecha_atencion instanceof Date) {
      o.fecha_atencion = fmt(o.fecha_atencion, 'yyyy-MM-dd');
    } else {
      o.fecha_atencion = String(o.fecha_atencion || '').substring(0, 10);
    }
    o.mes  = parseInt(o.mes)  || 0;
    o.anio = parseInt(o.anio) || 0;
    if (!o.mes && o.fecha_atencion.length >= 7) {
      const parts = o.fecha_atencion.split('-');
      o.anio = parseInt(parts[0]) || 0;
      o.mes  = parseInt(parts[1]) || 0;
    }
    lista.push(o);
  });

  if (rol === 'supervisor') {
    const buscar = String(p.usuario||'').trim().toLowerCase();
    const nombre = String(p.nombre||'').trim().toLowerCase();
    lista = lista.filter(a => {
      const sup = String(a.supervisor||'').trim().toLowerCase();
      return sup === buscar || sup === nombre;
    });
  }
  if (p.empresa && p.empresa !== 'AMBAS') {
    lista = lista.filter(a => String(a.empresa).toUpperCase() === String(p.empresa).toUpperCase());
  }

  const porMes = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    porMes[fmt(d, 'yyyy-MM')] = 0;
  }
  lista.forEach(a => {
    const f = String(a.fecha_atencion || '');
    if (f.length >= 7 && porMes.hasOwnProperty(f.substring(0, 7))) porMes[f.substring(0, 7)]++;
  });

  const porTipo = {};
  lista.forEach(a => { const t = a.detalle_documento || 'Sin especificar'; porTipo[t] = (porTipo[t] || 0) + 1; });

  const porEstado = { 'EN PROCESO': 0, 'FINALIZADO': 0 };
lista.forEach(a => { const e = String(a.estado || 'EN PROCESO').toUpperCase(); if (porEstado.hasOwnProperty(e)) porEstado[e]++; });
  return { success:true, data:{
    hoy:        lista.filter(a => a.fecha_atencion === hoyStr).length,
    mes:        lista.filter(a => a.mes === mesN && a.anio === aniN).length,
    anio:       lista.filter(a => a.anio === aniN).length,
    total:      lista.length,
    pendientes: lista.filter(a => String(a.estado || '').toUpperCase() === 'PENDIENTE').length,
    porMes, porTipo, porEstado
  }};
}
/**
 * ============================================================
 *  getResumenGeneral (FIX - versiÃ³n sÃ¡bado)
 * ============================================================
 *  Cambios respecto a la versiÃ³n anterior:
 *  [A] FIX:   lee las 4 hojas anuales con deduplicaciÃ³n
 *             (antes solo leÃ­a la hoja del aÃ±o actual)
 *  [B] FIX:   devuelve campo `total` separado del slice
 *             (antes el slice(0, 500) era el conteo total)
 *  [C] FIX:   acepta RESUELTO y FINALIZADO como sinÃ³nimos
 *             (frontend usa FINALIZADO, backend contaba RESUELTO)
 * ============================================================
 */
function getResumenGeneral(p) {
  const ss3 = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
 
  // === FIX [A]: leer las 4 hojas con dedup (antes leÃ­a solo 1) ===
  const hojas = [
    'BB. DE REGISTROS 2024',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS ' + anioActual,
    'BB. DE REGISTROS'
  ];
  const vistos = new Set();
  let lista = [];
  hojas.forEach(function(nombreHoja) {
    const ws = ss3.getSheetByName(nombreHoja);
    if (!ws) return;
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) return;
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i][0] && !rows[i][7]) continue;
      const k = nombreHoja + '_' + String(rows[i][0]);
      if (vistos.has(k)) continue;
      vistos.add(k);
      let o = {};
      COLS.forEach((h, j) => o[h] = rows[i][j]);
      lista.push(o);
    }
  });
 
  // Filtros (igual que antes)
  if (p.empresa && p.empresa !== 'AMBAS') {
    lista = lista.filter(a => String(a.empresa).toUpperCase() === p.empresa);
  }
  if (p.mes)  lista = lista.filter(a => String(a.mes)  === p.mes);
  if (p.anio) lista = lista.filter(a => String(a.anio) === p.anio);
 
  // === FIX [C]: RESUELTO y FINALIZADO cuentan ambos como "resuelto" ===
  const ps = {};
  lista.forEach(a => {
    const s = String(a.supervisor || 'Sin asignar').trim();
    if (!ps[s]) ps[s] = { nombre:s, total:0, pendientes:0, resueltos:0, enProceso:0 };
    ps[s].total++;
    const e = String(a.estado || '').toUpperCase();
    if (e === 'PENDIENTE')                       ps[s].pendientes++;
    if (e === 'RESUELTO' || e === 'FINALIZADO')  ps[s].resueltos++;
    if (e === 'EN PROCESO')                      ps[s].enProceso++;
  });
 
  lista.sort((a, b) => String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)));
 
  // === FIX [B]: total real separado del slice ===
  return {
    success: true,
    data: {
      total: lista.length,           // NUEVO: total real sin cap
      lista: lista.slice(0, 1000),   // tabla preview (subido de 500 a 1000)
      porSupervisor: ps
    }
  };
}

// ============================================================
// REPORTE CORREO
// ============================================================
function getReporteCorreo(p) {
  const fi = p.fecha_inicio, ff = p.fecha_fin;
  if (!fi || !ff) return { success:false, error:'Ingresa rango de fechas.' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let lista = [];
  const hojasInfo = [];

  // Leer de hojas por aÃ±o: 2026, 2025, 2024
  const hojas = [
    'BB. DE REGISTROS 2026',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS 2024'
  ];

  hojas.forEach(nombreHoja => {
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) { hojasInfo.push({hoja: nombreHoja, encontrados: 0, motivo: 'no existe'}); return; }
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) { hojasInfo.push({hoja: nombreHoja, encontrados: 0, motivo: 'vacÃ­a'}); return; }
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      // Columna A=nro(0), B=fecha_atencion(1)
      if (!rows[i][0] && !rows[i][1]) continue;
      let o = {};
      COLS.forEach((h, j) => o[h] = rows[i][j]);
      // Normalizar fecha columna B (Ã­ndice 1)
      const f = o.fecha_atencion instanceof Date
        ? Utilities.formatDate(o.fecha_atencion, 'GMT-5', 'yyyy-MM-dd')
        : String(o.fecha_atencion || '').replace(/T.*/, '').substring(0, 10);
      if (f >= fi && f <= ff) {
        o.fecha_atencion = f;
        lista.push(o);
        count++;
      }
    }
    hojasInfo.push({hoja: nombreHoja, encontrados: count});
    Logger.log(nombreHoja + ': ' + count + ' registros en rango ' + fi + ' al ' + ff);
  });

  // Deduplicar por nro
  const vistos = new Set();
  lista = lista.filter(o => {
    const k = String(o.nro);
    if (vistos.has(k)) return false;
    vistos.add(k); return true;
  });

  // Filtrar por supervisor/usuario para supervisores
  if (p.rol === 'supervisor') {
    lista = lista.filter(a => {
      const sup = String(a.supervisor || '').toLowerCase().trim();
      const usr = String(p.usuario || '').toLowerCase().trim();
      const nom = String(p.nombre  || '').toLowerCase().trim();
      const usrSis = String(a.usuario_sistema || '').toLowerCase().trim();
      return sup.includes(usr) || sup.includes(nom) ||
             usr.includes(sup) || nom.includes(sup) ||
             usrSis === usr;
    });
  }

  // Filtrar por empresa
  if (p.empresa && p.empresa !== 'AMBAS') {
    lista = lista.filter(a => String(a.empresa).toUpperCase() === p.empresa);
  }

  // Resumen por tipo y responsable
  const resumenMap = {};
  lista.forEach(a => {
    const key = (a.empresa||'')+'||'+(a.detalle_documento||'')+'||'+(a.responsable_recepcion||'');
    if (!resumenMap[key]) resumenMap[key] = {
      empresa: a.empresa||'',
      tipo: a.detalle_documento||'',
      responsable: a.responsable_recepcion||'',
      cantidad: 0
    };
    resumenMap[key].cantidad++;
  });

  const resumen = Object.values(resumenMap).sort((a,b) => b.cantidad - a.cantidad);
  lista.sort((a,b) => String(a.fecha_atencion).localeCompare(String(b.fecha_atencion)));

  return { success:true, data:lista, resumen, total:lista.length, hojasInfo };
}

// ============================================================
// USUARIOS
// ============================================================
function getUsuarios() {
  const rows = getSheet('Usuarios').getDataRange().getValues();
  const hdrs = rows[0].map(h => String(h).trim().toLowerCase());
  let lista = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    let o = {};
    hdrs.forEach((h, j) => o[h] = typeof rows[i][j] === 'string' ? rows[i][j].trim() : rows[i][j]);
    o.activo  = String(o.activo).trim().toUpperCase() === 'TRUE';
    o.empresa = String(o.empresa || '').trim().toUpperCase();
    o.rol     = String(o.rol || '').trim().toLowerCase();
    o.fundos  = FUNDOS_SUPERVISOR[o.usuario] || [];
    delete o.password;
    lista.push(o);
  }
  return { success:true, data:lista };
}

function saveUsuario(d) {
  getSheet('Usuarios').appendRow([
    'US-' + Math.floor(Math.random() * 90000 + 10000),
    String(d.usuario||'').trim(),
    String(d.password||'').trim(),
    String(d.nombre||'').trim(),
    String(d.rol||'supervisor').trim().toLowerCase(),
    String(d.empresa||'AMBAS').trim().toUpperCase(),
    true,
    new Date().toISOString(),
    String(d.correo||'').trim()
  ]);
  return { success:true };
}

function updateUsuario(d) {
  const sheet = getSheet('Usuarios');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).trim() === String(d.usuario).trim()) {
      if (d.activo   !== undefined) sheet.getRange(i+1, 7).setValue(d.activo);
      if (d.password) sheet.getRange(i+1, 3).setValue(d.password);
      if (d.correo)   sheet.getRange(i+1, 9).setValue(d.correo);
      return { success:true };
    }
  }
  return { success:false, error:'Usuario no encontrado.' };
}

// ============================================================
// DIAGNOSTICO
// ============================================================
function diagnostico() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shR = ss.getSheetByName('Trabajadores_RAPEL');
  const shV = ss.getSheetByName('Trabajadores_VERFRUT');
  const resR = shR ? {
    lastRow: shR.getLastRow(),
    lastCol: shR.getLastColumn(),
    fila1: shR.getRange(1, 1, 1, shR.getLastColumn()).getValues()[0],
    fila2: shR.getRange(2, 1, 1, shR.getLastColumn()).getValues()[0]
  } : 'HOJA NO ENCONTRADA';
  const resV = shV ? {
    lastRow: shV.getLastRow(),
    lastCol: shV.getLastColumn(),
    fila1: shV.getRange(1, 1, 1, shV.getLastColumn()).getValues()[0],
    fila2: shV.getRange(2, 1, 1, shV.getLastColumn()).getValues()[0]
  } : 'HOJA NO ENCONTRADA';
  return { success: true, rapel: resR, verfrut: resV };
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(n) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(n);
  if (!sh) throw new Error('Hoja no encontrada: ' + n);
  return sh;
}
function fmt(d, f) { return Utilities.formatDate(d, 'GMT-5', f); }
function getSemana(f) {
  const ini = new Date(f.getFullYear(), 0, 1);
  return Math.ceil((Math.floor((f - ini) / 86400000) + ini.getDay() + 1) / 7);
}

// ============================================================
// MÃ“DULO VISITAS DE CAMPO
// ============================================================
function saveVisita(d) {
  try {
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) {
      ws = ss.insertSheet('Visitas_Campo');
      ws.appendRow([
        'NÂ°','Fecha Registro','Empresa','Supervisor','DNI','Correo',
        'Fundo','Punto','Fecha Inicio','Fecha Fin','Semana',
        'Fecha Informe','Para','Asunto','Desarrollo','Rutas',
        'Acciones','Compromisos','Observaciones','Motivo Retraso',
        'NÂ° Fotos','Estado','Registrado Por',
        'Temporada','DÃ­as Transcurridos','DÃ­as Permitidos','DÃ­as Retraso','% Avance','% Retraso'
      ]);
    }
    const lastRow = ws.getLastRow();
    const nro     = lastRow; // NÂ° correlativo

    // Calcular dÃ­as hÃ¡biles y estado
    let estado = 'EN PLAZO';
    if (d.fecha_fin) {
      const ff  = new Date(d.fecha_fin + 'T12:00:00');
      const hoy  = new Date();
      let dias = 0, cur = new Date(ff);
      cur.setDate(cur.getDate() + 1);
      while (cur <= hoy) {
        if (cur.getDay() !== 0) dias++;
        cur.setDate(cur.getDate() + 1);
      }
      if (dias > 7) estado = 'RETRASADO';
    }

    ws.appendRow([
      nro,
      new Date(),
      d.empresa || '',
      d.supervisor || '',
      d.dni || '',
      d.correo || '',
      d.fundo || '',
      d.punto || '',
      d.fecha_inicio || '',
      d.fecha_fin || '',
      d.semana || '',
      d.fecha_informe || '',
      d.para || '',
      d.asunto || '',
      d.desarrollo || '',
      d.rutas || '',
      d.acciones || '',
      d.compromisos || '',
      d.observaciones || '',
      d.motivo || '',
      d.fotos || 0,
      estado,
      d.registrado_por || '',
      d.temporada || '',
      d.dias_transcurridos || 0,
      d.dias_permitidos || 1,
      d.dias_retraso || 0,
      d.pct_avance || '0.00',
      d.pct_retraso || '0.00'
    ]);
     try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
    return { success: true, nro: nro, estado: estado };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getVisitas(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) return { success: true, data: [], debug: 'hoja no encontrada' };
    const allRows = ws.getDataRange().getValues();
    const rawRows = allRows.slice(1).filter(function(r){ return r[0] !== '' && r[0] !== null && r[0] !== undefined; });
    if (!rawRows.length) return { success: true, data: [], debug: 'sin datos, total filas: ' + allRows.length };
    var data = rawRows.map(function(r) {
      return {
        // IdentificaciÃ³n
        nro:            r[0],
        fecha_reg:      r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd HH:mm') : String(r[1]||'').substring(0,16),
        
        // Datos del supervisor
        empresa:        String(r[2]||''),
        supervisor:     String(r[3]||'').trim(),
        dni:            r[4],
        correo:         String(r[5]||''),
        
        // UbicaciÃ³n
        fundo:          String(r[6]||''),
        sector:         String(r[6]||''),
        punto:          String(r[7]||''),
        
        // Fechas
        fecha_inicio:   r[8] instanceof Date ? Utilities.formatDate(r[8],'America/Lima','yyyy-MM-dd') : String(r[8]||'').substring(0,10),
        fecha_fin:      r[9] instanceof Date ? Utilities.formatDate(r[9],'America/Lima','yyyy-MM-dd') : String(r[9]||'').substring(0,10),
        semana:         r[10],
        fecha_informe:  r[11] instanceof Date ? Utilities.formatDate(r[11],'America/Lima','yyyy-MM-dd') : String(r[11]||'').substring(0,10),
        
        // Contenido del informe
        para:           String(r[12]||''),
        asunto:         String(r[13]||''),
        desarrollo:     String(r[14]||''),
        rutas:          String(r[15]||''),
        acciones:       String(r[16]||''),
        compromisos:    String(r[17]||''),
        observaciones:  String(r[18]||''),
        motivo:         String(r[19]||''),
        fotos:          parseInt(r[20]) || 0,
        
        // Estado y metadata
        estado:         String(r[21]||''),
        registrado_por: String(r[22]||''),
        enlace_informe: String(r[23]||''),
        
        // MÃ©tricas (columnas 24-29 si existen)
        temporada:           String(r[24]||''),
        dias_transcurridos:  parseInt(r[25]) || 0,
        dias_permitidos:     parseInt(r[26]) || 1,
        dias_retraso:        parseInt(r[27]) || 0,
        pct_avance:          String(r[28]||'0.00'),
        pct_retraso:         String(r[29]||'0.00')
      };
    });
    if (p.empresa && p.empresa !== 'AMBAS') data = data.filter(function(v){ return v.empresa === p.empresa; });
    if (p.mes) data = data.filter(function(v){ return v.fecha_reg && new Date(v.fecha_reg).getMonth()+1 == p.mes; });
    if (p.supervisor) {
      var normStr = function(s) {
        return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      };
      var supBuscar = normStr(p.supervisor);
      data = data.filter(function(v){ return normStr(v.supervisor).indexOf(supBuscar) !== -1; });
    }
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MÃ“DULO SUPERVISORES (compartido entre mÃ³dulos)
// ============================================================
function getSupervisores() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BD_Supervisores');
    if (!ws) return { success: true, data: [] };
    const rows = ws.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const data = rows.slice(1).filter(r => r[0]).map(r => ({
      dni:      r[0].toString(),
      nombre:   r[1],
      cargo:    r[2],
      sector:   r[3],
      empresa:  r[4],
      correo:   r[5],
      reemplazo: r[6] === 'SI' || r[6] === true
    }));
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function saveSupervisor(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BD_Supervisores');
    if (!ws) {
      ws = ss.insertSheet('BD_Supervisores');
      ws.appendRow(['DNI','NOMBRE Y APELLIDOS','CARGO','SECTOR','EMPRESA','CORREO','REEMPLAZO']);
    }
    // Verificar si ya existe (mismo DNI + sector)
    const rows = ws.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0].toString() === d.dni && rows[i][3] === d.sector) {
        // Actualizar fila existente
        ws.getRange(i+1, 1, 1, 7).setValues([[
          d.dni, d.nombre, d.cargo, d.sector, d.empresa, d.correo,
          d.reemplazo ? 'SI' : 'NO'
        ]]);
        return { success: true, action: 'updated' };
      }
    }
    // Agregar nueva fila
    ws.appendRow([d.dni, d.nombre, d.cargo, d.sector, d.empresa, d.correo,
      d.reemplazo ? 'SI' : 'NO']);
    return { success: true, action: 'created' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}



// ============================================================
// AZURE BLOB STORAGE â€” Registro de archivos subidos
// ============================================================
var AZURE_LOG_SHEET = 'Archivos_Azure';

function registrarArchivoAzure(d) {
  try {
    if (!d.urlArchivo)    return { success: false, error: 'urlArchivo requerido' };
    if (!d.nombreArchivo) return { success: false, error: 'nombreArchivo requerido' };
    if (!d.modulo)        return { success: false, error: 'modulo requerido' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName(AZURE_LOG_SHEET);
    if (!ws) {
      ws = ss.insertSheet(AZURE_LOG_SHEET);
      ws.appendRow([
        'Fecha', 'MÃ³dulo', 'Empresa', 'Usuario',
        'Nombre Archivo', 'Tipo', 'TamaÃ±o (bytes)', 'TamaÃ±o (MB)',
        'URL Azure', 'Contenedor', 'Referencia', 'Observaciones'
      ]);
      ws.getRange(1, 1, 1, 12).setFontWeight('bold');
    }

    var fecha    = new Date();
    var tamanoMb = d.tamanoArchivo ? (d.tamanoArchivo / (1024 * 1024)).toFixed(2) : '';
    var ref      = d.casoId ? 'Caso #' + d.casoId
                 : d.visitaId ? 'Visita #' + d.visitaId : '';

    ws.appendRow([
      fecha,
      d.modulo        || '',
      d.empresa       || '',
      d.usuario       || '',
      d.nombreArchivo || '',
      d.tipoArchivo   || '',
      d.tamanoArchivo || '',
      tamanoMb,
      d.urlArchivo    || '',
      d.contenedor    || '',
      ref,
      ''
    ]);

    return { success: true, url: d.urlArchivo, nombre: d.nombreArchivo };
  } catch(e) {
    return { success: false, error: 'registrarArchivoAzure: ' + e.toString() };
  }
}
// ============================================================
// MÃ“DULO CASOS
// ============================================================
function saveCaso(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BD_Casos');
    if (!ws) {
      ws = ss.insertSheet('BD_Casos');
      ws.appendRow([
        'NÂ°','Fecha Registro','DNI','Nombre','Empresa','Cargo','Sector',
        'Ingreso','TÃ©rmino','Supervisor','Motivo','Motivo Extra',
        'Fecha Reporte','Fecha LÃ­mite','Temporada','Estado','% Avance',
        'DÃ­as Retraso','Motivo Retraso','RedacciÃ³n',
        'Informe','Enlace Informe','Reporte','Enlace Reporte','Registrado Por',
        'Gravedad','Estado Gestion',
        'Tipo Sancion','Sancion Fecha Inicio','Sancion Fecha Fin','Sancion Dias'
      ]);
    }
    const nro = ws.getLastRow();
    ws.appendRow([
      nro,
      new Date(),
      d.dni || '',
      d.nombre || '',
      d.empresa || '',
      d.cargo || '',
      d.sector || '',
      d.ingreso || '',
      d.termino || '',
      d.supervisor || '',
      d.motivo || '',
      d.motivo_extra || '',
      d.fecha_reporte || '',
      d.fecha_limite || '',
      d.temporada || '',
      d.estado_caso || d.estado_plazo || d.estado || '',
      d.porcentaje !== undefined ? d.porcentaje : (d.porcentaje_avance || 0),
      d.dias_retraso !== undefined ? d.dias_retraso : (d.dias_habiles_transcurridos || 0),
      d.motivo_retraso || '',
      d.redaccion || '',
      d.nombre_informe || '',
      d.enlace_informe || '',
      d.nombre_reporte || '',
      d.enlace_reporte || '',
      d.registrado_por || '',
      d.gravedad || 'BAJO',
      d.estado_gestion || 'PENDIENTE',
      d.tipo_sancion || '',
      d.sancion_fecha_inicio || '',
      d.sancion_fecha_fin || '',
      d.sancion_dias || 0
    ]);
     try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
    return { success: true, nro: nro };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getCasos(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('BD_Casos');
    if (!ws) return { success: true, data: [] };
    const rows = p.historial
      ? ws.getDataRange().getValues()
      : [['hdr'], ...getRowsCurrentYear(ws, 500, 1)];
    if (rows.length <= 1) return { success: true, data: [] };
    let data = rows.slice(1).map(r => ({
  nro:            r[0],
  fecha_reg:      r[1] ? Utilities.formatDate(new Date(r[1]),'America/Lima','yyyy-MM-dd') : '',
  dni:            r[2],
  nombre:         r[3],
  empresa:        r[4],
  cargo:          r[5],
  sector:         r[6],
  ingreso:        r[7],
  termino:        r[8],
  supervisor:     r[9],
  motivo:         r[10],
  motivo_extra:   r[11],
  fecha_reporte:  r[12]||'',
  fecha_limite:   r[13]||'',
  temporada:      r[14],
  estado:         r[15],
  porcentaje:     r[16]||0,
  dias_retraso:   r[17]||0,
  motivo_retraso: r[18],
  redaccion:      r[19],
  nombre_informe: String(r[20]||''),
  enlace_informe: String(r[21]||''),
  nombre_reporte: String(r[22]||''),
  enlace_reporte: String(r[23]||''),
  registrado_por: String(r[24]||''),
  gravedad:       String(r[25]||'BAJO'),
  estado_gestion: String(r[26]||'PENDIENTE'),
  tipo_sancion:         String(r[27]||''),
  sancion_fecha_inicio: r[28] instanceof Date ? Utilities.formatDate(r[28],'America/Lima','yyyy-MM-dd') : String(r[28]||''),
  sancion_fecha_fin:    r[29] instanceof Date ? Utilities.formatDate(r[29],'America/Lima','yyyy-MM-dd') : String(r[29]||''),
  sancion_dias:         Number(r[30])||0
}));
    // Filtrar por rol: supervisor solo ve sus registros
    var ROLES_ADMIN_CASOS = ['administrador','administrador 01','administrador 02','coordinador','jefa_rl'];
var rolNorm = String(p.rol||'').trim().toLowerCase();
var esAdmin = ROLES_ADMIN_CASOS.indexOf(rolNorm) >= 0;

if (!esAdmin) {
  var usuarioNorm = String(p.usuario||'').trim().toLowerCase();
  var nombreNorm  = String(p.nombre ||'').trim().toLowerCase();

  data = data.filter(function(c){
    var sup = String(c.supervisor    ||'').trim().toLowerCase();
    var reg = String(c.registrado_por||'').trim().toLowerCase();
    if (!sup && !reg) return false;

    return reg === usuarioNorm
        || reg === nombreNorm
        || sup === usuarioNorm
        || sup === nombreNorm
        || (sup && usuarioNorm && sup.indexOf(usuarioNorm) >= 0)
        || (sup && nombreNorm  && sup.indexOf(nombreNorm)  >= 0);
  });
}
    if (p.empresa)    data = data.filter(c => c.empresa === p.empresa);
    if (p.motivo)     data = data.filter(c => c.motivo === p.motivo);
    if (p.supervisor) data = data.filter(c => c.supervisor.toLowerCase().includes(p.supervisor.toLowerCase()));
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MÃ“DULO SOLICITUDES DE EDICIÃ“N
// ============================================================
function saveSolicitud(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('Solicitudes_Edicion');
    if (!ws) {
      ws = ss.insertSheet('Solicitudes_Edicion');
      ws.appendRow([
        'NÂ°','Fecha Solicitud','NÂ° Visita','Supervisor','Empresa',
        'Fundo','Semana','Fecha Informe','Motivo','Solicitado Por',
        'Estado','Resuelto Por','Fecha ResoluciÃ³n','Motivo Rechazo'
      ]);
      ws.getRange(1,1,1,14).setFontWeight('bold');
    }
    const nro = ws.getLastRow();
    ws.appendRow([
      nro,
      new Date(),
      d.nro_visita || '',
      d.supervisor || '',
      d.empresa    || '',
      d.fundo      || '',
      d.semana     || '',
      d.fecha_informe || '',
      d.motivo     || '',
      d.solicitado_por || '',
      'PENDIENTE',
      '', '', ''
    ]);
    return { success: true, nro: nro };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getSolicitudes(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Solicitudes_Edicion');
    if (!ws) return { success: true, data: [] };
    const rows = ws.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    let data = rows.slice(1).filter(r => r[0]).map((r, i) => ({
      fila:           i + 2,
      nro:            r[0],
      fecha:          r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd') : String(r[1]||'').substring(0,10),
      nro_visita:     r[2],
      supervisor:     String(r[3]||'').trim(),
      empresa:        String(r[4]||''),
      fundo:          String(r[5]||''),
      semana:         r[6],
      fecha_informe:  r[7] instanceof Date ? Utilities.formatDate(r[7],'America/Lima','yyyy-MM-dd') : String(r[7]||'').substring(0,10),
      motivo:         String(r[8]||''),
      solicitado_por: String(r[9]||''),
      estado:         String(r[10]||''),
      resuelto_por:   String(r[11]||''),
      motivo_rechazo: String(r[13]||'')
    }));
    if (p.estado) data = data.filter(s => s.estado === p.estado);
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function resolverSolicitud(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Solicitudes_Edicion');
    if (!ws) return { success: false, error: 'Hoja no encontrada' };
    const fila = parseInt(d.fila);
    ws.getRange(fila, 11).setValue(d.estado);
    ws.getRange(fila, 12).setValue(d.resuelto_por || '');
    ws.getRange(fila, 13).setValue(new Date());
    ws.getRange(fila, 14).setValue(d.motivo_rechazo || '');
    // Si aprobada, marcar visita como editable
    if (d.estado === 'APROBADA') {
      const wsV = ss.getSheetByName('Visitas_Campo');
      if (wsV) {
        const nroVisita = ws.getRange(fila, 3).getValue();
        const rowsV = wsV.getDataRange().getValues();
        for (let i = 1; i < rowsV.length; i++) {
          if (rowsV[i][0] == nroVisita) {
            wsV.getRange(i+1, 24).setValue('EDICION_APROBADA');
            break;
          }
        }
      }
    }
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FUSIONES DE BUSES â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function saveFusion(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let hoja = ss.getSheetByName('Fusiones_Buses');
    if(!hoja) {
      hoja = ss.insertSheet('Fusiones_Buses');
      hoja.appendRow([
        'ID','Fecha','Hora','Usuario','Sector','Supervisor Responsable',
        'Reemplazo','Supervisor Reemplazante','Supervisor Reemplazado',
        'Cantidad Buses','Ruta Original','CÃ³digo Ruta Original','Total Trabajadores',
        'Ruta Destino 1','CÃ³digo Ruta 1','Personal Ruta 1',
        'Ruta Destino 2','CÃ³digo Ruta 2','Personal Ruta 2',
        'Ruta Destino 3','CÃ³digo Ruta 3','Personal Ruta 3',
        'Motivo','Observaciones','Evidencia Foto 1','Evidencia Foto 2','Evidencia Foto 3','Estado'
      ]);
    }
    const lastRow = hoja.getLastRow();
    const id = 'FUS-' + String(lastRow).padStart(4,'0');
    hoja.appendRow([
      id, data.fecha, data.hora, data.usuario,
      data.sector, data.supervisor, data.reemplazo,
      data.reemplazante || '', data.reemplazado || '',
      data.cantBuses, data.rutaOrigen, data.codOrigen, data.totalTrab,
      data.ruta1, data.codigo1, data.personal1,
      data.ruta2, data.codigo2, data.personal2,
      data.ruta3, data.codigo3, data.personal3,
      data.motivo, data.observaciones,
      data.foto1 || '', data.foto2 || '', data.foto3 || '',
      'Pendiente'
    ]);
    try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
    return {success:true, id};
  } catch(e) {
    return {success:false, error:e.message};
  }
}

function getFusiones(params) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoja = ss.getSheetByName('Fusiones_Buses');
    if(!hoja || hoja.getLastRow() < 2) return {success:true, data:[]};
    const rows = hoja.getRange(2, 1, hoja.getLastRow()-1, 28).getValues();
    const data = rows.filter(r => r[0]).map(r => ({
      id: r[0], fecha: r[1], hora: r[2], usuario: r[3],
      sector: r[4], supervisor: r[5], reemplazo: r[6],
      reemplazante: r[7], reemplazado: r[8],
      cantBuses: r[9], ruta_origen: r[10], codigo_origen: r[11], total_trab: r[12],
      ruta1: r[13], codigo1: r[14], personal1: r[15],
      ruta2: r[16], codigo2: r[17], personal2: r[18],
      ruta3: r[19], codigo3: r[20], personal3: r[21],
      motivo: r[22], observaciones: r[23],
      foto1: r[24], foto2: r[25], foto3: r[26], estado: r[27]
    }));
    return {success:true, data};
  } catch(e) {
    return {success:false, error:e.message};
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ESTADÃSTICAS ADMIN CONSOLIDADAS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Normalizar fecha a {mes, anio} â€” funciÃ³n global (fuera de getEstadisticasAdmin)
function normalizarFecha(val) {
  if (!val) return { mes: 0, anio: 0 };
  var d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return { mes: 0, anio: 0 };
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

function getEstadisticasAdmin(p) {
  try {
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoy         = new Date();
    var mesActual   = hoy.getMonth() + 1;
    var anioActual  = hoy.getFullYear();
    var filtroEmp   = (p.empresa   || '').toUpperCase();
    var filtroSup   = (p.supervisor|| '').toLowerCase();
    var filtroMes   = p.mes ? parseInt(p.mes) : 0;

    // â”€â”€ ATENCIONES: combinar 2024+2025+2026+base â”€â”€
    var hojas = ['BB. DE REGISTROS 2024','BB. DE REGISTROS 2025','BB. DE REGISTROS ' + anioActual,'BB. DE REGISTROS'];
    var vistosAt = new Set();
    var rawAt = [];
    hojas.forEach(function(n) {
      var ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        var k = n + '_' + String(r[0]);
        if (!k || vistosAt.has(k)) return;
        vistosAt.add(k); rawAt.push(r);
      });
    });

    var atenciones = [];
    for (var i = 0; i < rawAt.length; i++) {
      var r = rawAt[i];
      if (!r[0] && !r[7]) continue;
      var ma = normalizarFecha(r[1]);
      atenciones.push({
        supervisor: String(r[18] || '').trim(),
        empresa:    String(r[11] || '').toUpperCase(),
        estado:     String(r[25] || '').toUpperCase(),
        mes:        ma.mes,
        anio:       ma.anio
      });
    }

    // â”€â”€ VISITAS â”€â”€
    var wsVis  = ss.getSheetByName('Visitas_Campo');
    var rawVis = wsVis ? wsVis.getDataRange().getValues().slice(1) : [];
    var visitas = [];
    for (var j = 0; j < rawVis.length; j++) {
      var rv = rawVis[j];
      if (!rv[0]) continue;
      var mv = normalizarFecha(rv[1]);
      visitas.push({
        supervisor: String(rv[3]  || '').trim(),
        empresa:    String(rv[2]  || '').toUpperCase(),
        estado:     String(rv[21] || '').toUpperCase(),
        mes:        mv.mes,
        anio:       mv.anio
      });
    }

    // â”€â”€ CASOS â”€â”€
    var wsCas  = ss.getSheetByName('BD_Casos');
    var rawCas = wsCas ? wsCas.getDataRange().getValues().slice(1) : [];
    var casos  = [];
    for (var k = 0; k < rawCas.length; k++) {
      var rc = rawCas[k];
      if (!rc[0]) continue;
      var mc = normalizarFecha(rc[1]);
      casos.push({
        supervisor: String(rc[9]  || '').trim(),
        empresa:    String(rc[4]  || '').toUpperCase(),
        estado:     String(rc[15] || '').toUpperCase(),
        mes:        mc.mes,
        anio:       mc.anio
      });
    }

    // â”€â”€ FUSIONES â”€â”€
    var wsFus  = ss.getSheetByName('Fusiones_Buses');
    var rawFus = wsFus ? getRowsCurrentYear(wsFus, 300, 1) : [];
    var fusiones = [];
    for (var f = 0; f < rawFus.length; f++) {
      var rf = rawFus[f];
      if (!rf[0]) continue;
      var mf = normalizarFecha(rf[1]);
      fusiones.push({
        supervisor: String(rf[5]  || '').trim(),
        estado:     String(rf[27] || '').toUpperCase(),
        totalTrab:  parseInt(rf[12] || 0),
        mes:        mf.mes,
        anio:       mf.anio
      });
    }

    // â”€â”€ Filtros â”€â”€
    function applyFilters(arr) {
      var out = arr;
      if (filtroEmp && filtroEmp !== 'AMBAS') {
        out = out.filter(function(x){ return x.empresa === filtroEmp; });
      }
      if (filtroSup) {
        out = out.filter(function(x){ return x.supervisor.toLowerCase().indexOf(filtroSup) !== -1; });
      }
      if (filtroMes) {
        out = out.filter(function(x){ return x.mes === filtroMes; });
      }
      return out;
    }
    atenciones = applyFilters(atenciones);
    visitas    = applyFilters(visitas);
    casos      = applyFilters(casos);
    fusiones   = applyFilters(fusiones);

    // â”€â”€ STATS GLOBALES â”€â”€
    var stats = {
      atenciones: {
        total:       atenciones.length,
        enProceso:   atenciones.filter(function(x){ return x.estado === 'EN PROCESO'; }).length,
        finalizados: atenciones.filter(function(x){ return x.estado === 'FINALIZADO'; }).length,
        esteMes:     atenciones.filter(function(x){ return x.mes === mesActual && x.anio === anioActual; }).length
      },
      visitas: {
        total:      visitas.length,
        enPlazo:    visitas.filter(function(x){ return x.estado.indexOf('RETRAS') === -1; }).length,
        retrasadas: visitas.filter(function(x){ return x.estado.indexOf('RETRAS') !== -1; }).length,
        esteMes:    visitas.filter(function(x){ return x.mes === mesActual && x.anio === anioActual; }).length
      },
      casos: {
        total:      casos.length,
        enPlazo:    casos.filter(function(x){ return x.estado.indexOf('RETRAS') === -1; }).length,
        retrasados: casos.filter(function(x){ return x.estado.indexOf('RETRAS') !== -1; }).length,
        esteMes:    casos.filter(function(x){ return x.mes === mesActual && x.anio === anioActual; }).length
      },
      fusiones: {
        total:        fusiones.length,
        pendientes:   fusiones.filter(function(x){ return x.estado === 'PENDIENTE'; }).length,
        validados:    fusiones.filter(function(x){ return x.estado === 'VALIDADO'; }).length,
        trabajadores: fusiones.reduce(function(s,x){ return s + x.totalTrab; }, 0),
        esteMes:      fusiones.filter(function(x){ return x.mes === mesActual && x.anio === anioActual; }).length
      }
    };

    // â”€â”€ POR SUPERVISOR â”€â”€
    var porSupervisor = {};
    function acumSup(arr, modulo) {
      for (var n = 0; n < arr.length; n++) {
        var x = arr[n];
        var s = x.supervisor || 'Sin asignar';
        if (!porSupervisor[s]) {
          porSupervisor[s] = {
            nombre: s,
            atenciones:0, atEnProceso:0, atFinalizados:0,
            visitas:0, viRetrasadas:0,
            casos:0, caRetrasados:0,
            fusiones:0
          };
        }
        if (modulo === 'at') {
          porSupervisor[s].atenciones++;
          if (x.estado === 'EN PROCESO') porSupervisor[s].atEnProceso++;
          if (x.estado === 'FINALIZADO') porSupervisor[s].atFinalizados++;
        }
        if (modulo === 'vis') {
          porSupervisor[s].visitas++;
          if (x.estado.indexOf('RETRAS') !== -1) porSupervisor[s].viRetrasadas++;
        }
        if (modulo === 'cas') {
          porSupervisor[s].casos++;
          if (x.estado.indexOf('RETRAS') !== -1) porSupervisor[s].caRetrasados++;
        }
        if (modulo === 'fus') porSupervisor[s].fusiones++;
      }
    }
    acumSup(atenciones, 'at');
    acumSup(visitas,    'vis');
    acumSup(casos,      'cas');
    acumSup(fusiones,   'fus');

    // â”€â”€ TENDENCIA Ãºltimos 6 meses â”€â”€
    var tendencia = [];
    for (var t = 5; t >= 0; t--) {
      var td   = new Date(hoy.getFullYear(), hoy.getMonth() - t, 1);
      var tMes  = td.getMonth() + 1;
      var tAnio = td.getFullYear();
      var labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      tendencia.push({
        label:      labels[tMes - 1],
        atenciones: atenciones.filter(function(x){ return x.mes === tMes && x.anio === tAnio; }).length,
        visitas:    visitas.filter(function(x){    return x.mes === tMes && x.anio === tAnio; }).length,
        casos:      casos.filter(function(x){      return x.mes === tMes && x.anio === tAnio; }).length,
        fusiones:   fusiones.filter(function(x){   return x.mes === tMes && x.anio === tAnio; }).length
      });
    }

    return { success: true, data: { stats: stats, porSupervisor: porSupervisor, tendencia: tendencia } };

  } catch(e) {
    return { success: false, error: 'getEstadisticasAdmin: ' + e.toString() };
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• PRELOAD - CARGA INICIAL COMPLETA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Trae todos los datos en UNA sola llamada al momento del login
function getPreload(p) {
  try {
    const cache    = CacheService.getUserCache();
    const cacheKey = 'preload_' + (p.usuario||'') + '_' + (p.rol||'');
    const cached   = cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed._ts && (Date.now() - parsed._ts) < 10 * 60 * 1000) {
          return { success: true, data: parsed, fromCache: true };
        }
      } catch(eCached) {}
    }

    const rol     = p.rol || '';
    const usuario = p.usuario || '';
    const empresa = p.empresa || '';
    const esAdmin = ['administrador','administrador 01','administrador 02','coordinador','jefa_rl'].includes(rol);

    // â”€â”€ Atenciones: solo para supervisores en preload â”€â”€
    // Admins cargan atenciones lazy (cuando abren el mÃ³dulo)
    let atenciones = [];
    if (!esAdmin) {
      try { const d = getAtenciones(p); if (d.success) atenciones = d.data; } catch(e){}
    }

    // â”€â”€ Stats dashboard (siempre, para todos) â”€â”€
    let stats = { hoy:0, mes:0, anio:0, total:0, enProceso:0, finalizados:0, porMes:{}, porTipo:{}, porEstado:{} };
    try { const d = getEstadisticas(p); if (d.success) stats = d.data; } catch(e){}

    // â”€â”€ Visitas â”€â”€
    let visitas = [];
    try { const d = getVisitas(p); if (d.success) visitas = d.data; } catch(e){}

    // â”€â”€ Casos â”€â”€
    let casos = [];
    try { const d = getCasos(p); if (d.success) casos = d.data; } catch(e){}

    // â”€â”€ Fusiones â”€â”€
    let fusiones = [];
    try { const d = getFusiones(p); if (d.success) fusiones = d.data; } catch(e){}

    // â”€â”€ Solicitudes (solo admins) â”€â”€
    let solicitudes = [];
    try { if (esAdmin) { const d = getSolicitudes(p); if (d.success) solicitudes = d.data; } } catch(e){}

    // â”€â”€ EstadÃ­sticas admin: carga bajo demanda â”€â”€
    let estadisticasAdmin = null;

    // â”€â”€ Supervisores â”€â”€
    let supervisores = [];
    try { const d = getSupervisores(); if (d.success) supervisores = d.data; } catch(e){}

    // â”€â”€ Usuarios (solo admin puro) â”€â”€
    let usuarios = [];
    try { if (rol === 'administrador') { const d = getUsuarios(p); if (d.success) usuarios = d.data; } } catch(e){}

    const result = {
      atenciones, stats, visitas, casos, fusiones,
      solicitudes, estadisticasAdmin, usuarios, supervisores,
      timestamp: new Date().getTime(),
      _ts: Date.now()
    };

    // Guardar en cache por 5 minutos
    try { cache.put(cacheKey, JSON.stringify(result), 600); } catch(ePut){}

    return { success: true, data: result };

  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
function getEvaluaciones360(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BB.DD-EVALUACIONES');
    if (!ws) return { success: true, data: [] };
    const rows = ws.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    let data = rows.slice(1).filter(r => r[0]).map(r => ({
      id: r[0],
      fecha: r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd') : String(r[1]||''),
      evaluador: r[2], supervisor: r[3], empresa: r[4], sector: r[5],
      liderazgo: r[6], comunicacion: r[7], cumplimiento: r[8],
      gestion_equipo: r[9], resolucion: r[10], planificacion: r[11],
      total: r[12], porcentaje: r[13], nivel: r[14],
      observaciones: r[15], recomendaciones: r[16], usuario_registro: r[17]
    }));
    if (p.empresa && p.empresa !== 'AMBAS') data = data.filter(e => e.empresa === p.empresa);
    if (p.supervisor) data = data.filter(e => e.supervisor.toLowerCase().includes(p.supervisor.toLowerCase()));
    return { success: true, data: data };
  } catch(e) { return { success: false, error: e.toString() }; }
}function updateVisita(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) return { success: false, error: 'Hoja no encontrada' };
    const rows = ws.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(d.nro)) {
        const r = i + 1;
        ws.getRange(r, 3).setValue(d.empresa||'');
        ws.getRange(r, 7).setValue(d.fundo||'');
        ws.getRange(r, 8).setValue(d.punto||'');
        ws.getRange(r, 9).setValue(d.fecha_inicio||'');
        ws.getRange(r, 10).setValue(d.fecha_fin||'');
        ws.getRange(r, 11).setValue(d.semana||'');
        ws.getRange(r, 12).setValue(d.fecha_informe||'');
        ws.getRange(r, 15).setValue(d.desarrollo||'');
        ws.getRange(r, 16).setValue(d.rutas||'');
        ws.getRange(r, 17).setValue(d.acciones||'');
        ws.getRange(r, 18).setValue(d.compromisos||'');
        ws.getRange(r, 19).setValue(d.observaciones||'');
        ws.getRange(r, 20).setValue(d.motivo||'');
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
        return { success: true };
      }
    }
    return { success: false, error: 'Visita no encontrada.' };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function updateCaso(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('BD_Casos');
    if (!ws) return { success: false, error: 'Hoja no encontrada' };
    const rows = ws.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(d.nro)) {
        const r = i + 1;
        if (d.motivo         !== undefined) ws.getRange(r, 11).setValue(d.motivo);
        if (d.motivo_extra   !== undefined) ws.getRange(r, 12).setValue(d.motivo_extra);
        if (d.fecha_reporte  !== undefined) ws.getRange(r, 13).setValue(d.fecha_reporte);
        if (d.fecha_limite   !== undefined) ws.getRange(r, 14).setValue(d.fecha_limite);
        if (d.temporada      !== undefined) ws.getRange(r, 15).setValue(d.temporada);
        if (d.estado_caso    !== undefined) ws.getRange(r, 16).setValue(d.estado_caso);
          else if (d.estado_plazo !== undefined) ws.getRange(r, 16).setValue(d.estado_plazo);
          else if (d.estado       !== undefined) ws.getRange(r, 16).setValue(d.estado);
        if (d.porcentaje !== undefined) ws.getRange(r, 17).setValue(d.porcentaje);
          else if (d.porcentaje_avance !== undefined) ws.getRange(r, 17).setValue(d.porcentaje_avance);
        if (d.dias_retraso !== undefined) ws.getRange(r, 18).setValue(d.dias_retraso);
          else if (d.dias_habiles_transcurridos !== undefined) ws.getRange(r, 18).setValue(d.dias_habiles_transcurridos);
        if (d.motivo_retraso !== undefined) ws.getRange(r, 19).setValue(d.motivo_retraso);
        if (d.redaccion      !== undefined) ws.getRange(r, 20).setValue(d.redaccion);
        if (d.nombre_informe !== undefined) ws.getRange(r, 21).setValue(d.nombre_informe);
        if (d.enlace_informe !== undefined) ws.getRange(r, 22).setValue(d.enlace_informe);
        if (d.nombre_reporte !== undefined) ws.getRange(r, 23).setValue(d.nombre_reporte);
        if (d.enlace_reporte !== undefined) ws.getRange(r, 24).setValue(d.enlace_reporte);
        if (d.gravedad       !== undefined) ws.getRange(r, 26).setValue(d.gravedad);
        if (d.estado_gestion !== undefined) ws.getRange(r, 27).setValue(d.estado_gestion);
        if (d.tipo_sancion         !== undefined) ws.getRange(r, 28).setValue(d.tipo_sancion);
        if (d.sancion_fecha_inicio !== undefined) ws.getRange(r, 29).setValue(d.sancion_fecha_inicio);
        if (d.sancion_fecha_fin    !== undefined) ws.getRange(r, 30).setValue(d.sancion_fecha_fin);
        if (d.sancion_dias         !== undefined) ws.getRange(r, 31).setValue(d.sancion_dias);
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
        return { success: true };
      }
    }
    return { success: false, error: 'Caso no encontrado.' };
  } catch(e) { return { success: false, error: e.toString() }; }
  }
function saveEvaluacion360(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BB.DD-EVALUACIONES');
    if (!ws) {
      ws = ss.insertSheet('BB.DD-EVALUACIONES');
      ws.appendRow(['ID','Fecha EvaluaciÃ³n','Evaluador','Supervisor Evaluado',
        'Empresa','Fundo/Sector','Puntaje Liderazgo','Puntaje ComunicaciÃ³n',
        'Puntaje Cumplimiento','Puntaje GestiÃ³n Equipo','Puntaje ResoluciÃ³n',
        'Puntaje PlanificaciÃ³n','Puntaje Total','% Cumplimiento','Nivel',
        'Observaciones','Recomendaciones','Usuario Registro','Fecha Registro']);
    }
    ws.appendRow([
      d.id||'EVA-'+Date.now(), new Date(), d.evaluador||'', d.supervisor||'',
      d.empresa||'', d.sector||'',
      d.liderazgo||0, d.comunicacion||0, d.cumplimiento||0,
      d.gestion_equipo||0, d.resolucion||0, d.planificacion||0,
      d.total||0, d.porcentaje||0, d.nivel||'',
      d.observaciones||'', d.recomendaciones||'', d.usuario_registro||''
    ]);
    return { success: true };
  } catch(e) { return { success: false, error: e.toString() }; }
}
function getSupervisoresEval() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('SUPERVISORES_EVAL');
    if (!ws) return { success: true, data: [] };
    const rows = ws.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const data = rows.slice(1).filter(r => r[0]).map(r => ({
      id: r[0], nombre: r[1], empresa: r[2], sector: r[3],
      correo: r[4], estado: r[5]
    }));
    return { success: true, data: data };
  } catch(e) { return { success: false, error: e.toString() }; }
}
function saveSupervisorEval(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('SUPERVISORES_EVAL');
    if (!ws) {
      ws = ss.insertSheet('SUPERVISORES_EVAL');
      ws.appendRow(['ID Supervisor','Nombre Completo','Empresa','Sector','Correo','Estado']);
    }
    const id = 'SUP-' + String(ws.getLastRow()).padStart(3,'0');
    ws.appendRow([id, d.nombre||'', d.empresa||'', d.sector||'', d.correo||'', 'Activo']);
    return { success: true, id: id };
  } catch(e) { return { success: false, error: e.toString() }; }
}
function testBuscar() {
  const cache = CacheService.getScriptCache();
  for (let i = 0; i < 20; i++) {
    cache.remove('v2_Trabajadores_RAPEL_' + i);
    cache.remove('v2_Trabajadores_VERFRUT_' + i);
  }
  cache.remove('v2_Trabajadores_RAPEL_meta');
  cache.remove('v2_Trabajadores_VERFRUT_meta');
  
  const datos = cargarDatosTrabajadores('Trabajadores_RAPEL');
  Logger.log('Total RAPEL: ' + datos.length);
  
  const q = '46073509';
  const encontrado = datos.filter(function(d){ return d[0] === q; });
  Logger.log('Buscando ' + q + ': ' + encontrado.length);
  
  const datosV = cargarDatosTrabajadores('Trabajadores_VERFRUT');
  Logger.log('Total VERFRUT: ' + datosV.length);
  const encontradoV = datosV.filter(function(d){ return d[0] === q; });
  Logger.log('Buscando en VERFRUT ' + q + ': ' + encontradoV.length);
}
function testBuscarWeb() {
  const resultado = buscarTrabajador({q: '46073509', empresa: 'AMBAS'});
  Logger.log(JSON.stringify(resultado));
}
function testVisitas2() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hojas = ss.getSheets().map(s => s.getName());
    Logger.log('Hojas: ' + hojas.join(', '));
  } catch(e) {
    Logger.log('Error: ' + e.toString());
  }
}
function testVisitas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ws = ss.getSheetByName('Visitas_Campo');
  Logger.log('Filas totales: ' + ws.getLastRow());
  const rows = ws.getDataRange().getValues().slice(1);
  Logger.log('Filas con datos: ' + rows.filter(r => r[0]).length);
  if (rows.length > 0) {
    Logger.log('Col A fila 2: ' + rows[0][0]);
    Logger.log('Col B fila 2: ' + rows[0][1]);
  }
}
function testGetVisitas() {
  const resultado = getVisitas({empresa: 'AMBAS'});
  Logger.log('Total: ' + resultado.data.length);
}
function testVisitas3() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ws = ss.getSheetByName('Visitas_Campo');
  const rows = ws.getDataRange().getValues().slice(1);
  Logger.log('Fila 1 r[0]: ' + rows[0][0] + ' tipo: ' + typeof rows[0][0]);
  Logger.log('Boolean r[0]: ' + Boolean(rows[0][0]));
  const filtradas = rows.filter(r => r[0]);
  Logger.log('Filtradas: ' + filtradas.length);
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FIREBASE ESTADÃSTICAS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _fbPatchEstadisticas(data) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('âš ï¸ FIREBASE_DB_SECRET no configurado en propiedades del script');
      return;
    }
    const url = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com/estadisticas.json?auth=' + secret;
    UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    });
    Logger.log('Firebase actualizado OK');
  } catch(e) {
    Logger.log('Firebase error: ' + e.toString());
  }
}

function actualizarEstadisticasFirebase() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const anio = new Date().getFullYear();
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;

    // Leer hojas 2026 + 2025
    const hojas = ['BB. DE REGISTROS ' + anio, 'BB. DE REGISTROS ' + (anio-1)];
    const vistos = new Set();
    let rows = [];
    hojas.forEach(n => {
      const ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(r => {
        const k = n + '_' + String(r[0]);
        if (!k || vistos.has(k)) return;
        vistos.add(k); rows.push(r);
      });
    });

    // Calcular stats
    let total = 0, hoyN = 0, esteMes = 0, enProceso = 0, finalizados = 0;
    const porSupervisor = {};
    const porMes = {};
    const porEmpresa = { RAPEL: {total:0,este_mes:0,en_proceso:0}, VERFRUT: {total:0,este_mes:0,en_proceso:0} };
    const hoyStr = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM-dd');

    rows.forEach(r => {
      if (!r[0] && !r[7]) return;
      total++;
      const fecha = r[1] instanceof Date ? Utilities.formatDate(r[1],'GMT-5','yyyy-MM-dd') : String(r[1]||'').substring(0,10);
      const mes = fecha.substring(0,4) + '_' + fecha.substring(5,7);
      const mesNum = parseInt(fecha.substring(5,7)) || 0;
      const anioNum = parseInt(fecha.substring(0,4)) || 0;
      const estado = String(r[25]||'').toUpperCase();
      const sup = String(r[18]||'').trim();
      const emp = String(r[11]||'').toUpperCase();

      if (fecha === hoyStr) hoyN++;
      if (mesNum === mesActual && anioNum === anio) esteMes++;
      if (estado === 'EN PROCESO') enProceso++;
      if (estado === 'FINALIZADO') finalizados++;

      // Por mes
      if (!porMes[mes]) porMes[mes] = {total:0, rapel:0, verfrut:0};
      porMes[mes].total++;
      if (emp.indexOf('RAPEL') !== -1) porMes[mes].rapel++;
      if (emp.indexOf('VERFRUT') !== -1) porMes[mes].verfrut++;

      // Por supervisor
      if (sup) {
        if (!porSupervisor[sup]) porSupervisor[sup] = {nombre:sup, total:0, este_mes:0, en_proceso:0, finalizados:0};
        porSupervisor[sup].total++;
        if (mesNum === mesActual && anioNum === anio) porSupervisor[sup].este_mes++;
        if (estado === 'EN PROCESO') porSupervisor[sup].en_proceso++;
        if (estado === 'FINALIZADO') porSupervisor[sup].finalizados++;
      }

      // Por empresa
      if (emp.indexOf('RAPEL') !== -1) {
        porEmpresa.RAPEL.total++;
        if (mesNum === mesActual && anioNum === anio) porEmpresa.RAPEL.este_mes++;
        if (estado === 'EN PROCESO') porEmpresa.RAPEL.en_proceso++;
      }
      if (emp.indexOf('VERFRUT') !== -1) {
        porEmpresa.VERFRUT.total++;
        if (mesNum === mesActual && anioNum === anio) porEmpresa.VERFRUT.este_mes++;
        if (estado === 'EN PROCESO') porEmpresa.VERFRUT.en_proceso++;
      }
    });

    _fbPatchEstadisticas({
      resumen_global: { total, hoy: hoyN, este_mes: esteMes, en_proceso: enProceso, finalizados, ultima_actualizacion: Date.now() },
      por_supervisor: porSupervisor,
      por_mes: porMes,
      por_empresa: porEmpresa
    });

    Logger.log('EstadÃ­sticas Firebase actualizadas: ' + total + ' registros');
  } catch(e) {
    Logger.log('actualizarEstadisticasFirebase error: ' + e.toString());
  }
}

function recalcularEstadisticasCompletas() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // â¬‡ï¸ FIX: usar 'America/Lima' para todo (consistente con la fecha local)
    const hoyStr = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    const mesActualStr = hoyStr.substring(0, 7);
    const anio = parseInt(hoyStr.substring(0, 4));
    const mesActual = parseInt(hoyStr.substring(5, 7));
    
    Logger.log('â•â•â• Calculando: HOY=' + hoyStr + ' | MES=' + mesActualStr + ' | AÃ‘O=' + anio + ' â•â•â•');

    const hojas = [
      'BB. DE REGISTROS 2024',
      'BB. DE REGISTROS 2025',
      'BB. DE REGISTROS ' + anio
    ];

    let rows = [];
    hojas.forEach(n => {
      const ws = ss.getSheetByName(n);
      if (!ws) { Logger.log('No existe: ' + n); return; }
      const wsRows = ws.getDataRange().getValues().slice(1)
        .filter(r => r[0] || r[1]);
      rows = rows.concat(wsRows);
      Logger.log(n + ': ' + wsRows.length + ' filas');
    });

    Logger.log('Total SIN deduplicar: ' + rows.length);

    let total = 0, hoyN = 0, esteMes = 0, enProceso = 0, finalizados = 0;
    const porSupervisor = {};
    const porMes = {};
    const porAnio = {};
    const porEmpresa = {
      RAPEL:   {total:0, este_mes:0, en_proceso:0, finalizados:0},
      VERFRUT: {total:0, este_mes:0, en_proceso:0, finalizados:0}
    };

    rows.forEach(r => {
      total++;
      
      // â¬‡ï¸ FIX: usar 'America/Lima' (no 'GMT-5') para consistencia con hoyStr
      let fecha = '';
      if (r[1] instanceof Date) {
        fecha = Utilities.formatDate(r[1], 'America/Lima', 'yyyy-MM-dd');
      } else {
        fecha = String(r[1]||'').substring(0, 10);
      }

      let mesNum  = parseInt(r[5]) || 0;
      let anioNum = parseInt(r[6]) || 0;
      if (!mesNum && fecha.length >= 7) {
        mesNum  = parseInt(fecha.substring(5, 7)) || 0;
        anioNum = parseInt(fecha.substring(0, 4)) || 0;
      }
      
      // â¬‡ï¸ FIX: si fecha existe, derivar mes/anio desde fecha (mÃ¡s confiable que cols 5/6)
      if (fecha.length >= 10) {
        const mesDeFecha = parseInt(fecha.substring(5, 7));
        const anioDeFecha = parseInt(fecha.substring(0, 4));
        if (mesDeFecha > 0 && anioDeFecha > 0) {
          mesNum = mesDeFecha;
          anioNum = anioDeFecha;
        }
      }

      const emp    = String(r[11]||'').toUpperCase();
      const estado = String(r[25]||'').toUpperCase();
      const sup    = String(r[18]||'').trim();
      const mesKey = anioNum > 0 && mesNum > 0
        ? anioNum + '_' + String(mesNum).padStart(2,'0') : '';

      if (fecha === hoyStr) hoyN++;
      if (mesNum === mesActual && anioNum === anio) esteMes++;
      if (estado === 'EN PROCESO') enProceso++;
      if (estado === 'FINALIZADO') finalizados++;

      if (mesKey) {
        if (!porMes[mesKey]) porMes[mesKey] = {total:0, rapel:0, verfrut:0, en_proceso:0, finalizados:0};
        porMes[mesKey].total++;
        if (emp.indexOf('RAPEL') !== -1 && emp.indexOf('VERFRUT') === -1) porMes[mesKey].rapel++;
        if (emp.indexOf('VERFRUT') !== -1) porMes[mesKey].verfrut++;
        if (estado === 'EN PROCESO') porMes[mesKey].en_proceso++;
        if (estado === 'FINALIZADO') porMes[mesKey].finalizados++;
      }

      if (anioNum > 0) {
        const anioKey = 'a' + anioNum;
        if (!porAnio[anioKey]) porAnio[anioKey] = {anio:anioNum, total:0, rapel:0, verfrut:0, en_proceso:0, finalizados:0};
        porAnio[anioKey].total++;
        if (emp.indexOf('RAPEL') !== -1 && emp.indexOf('VERFRUT') === -1) porAnio[anioKey].rapel++;
        if (emp.indexOf('VERFRUT') !== -1) porAnio[anioKey].verfrut++;
        if (estado === 'EN PROCESO') porAnio[anioKey].en_proceso++;
        if (estado === 'FINALIZADO') porAnio[anioKey].finalizados++;
      }

      if (sup) {
        const supKey = sup.replace(/[.#$\[\]\/]/g, '_');
        if (!porSupervisor[supKey]) porSupervisor[supKey] = {
          nombre:sup, total:0, este_mes:0, en_proceso:0, finalizados:0
        };
        porSupervisor[supKey].total++;
        if (mesNum === mesActual && anioNum === anio) porSupervisor[supKey].este_mes++;
        if (estado === 'EN PROCESO') porSupervisor[supKey].en_proceso++;
        if (estado === 'FINALIZADO') porSupervisor[supKey].finalizados++;
      }

      if (emp.indexOf('RAPEL') !== -1 && emp.indexOf('VERFRUT') === -1) {
        porEmpresa.RAPEL.total++;
        if (mesNum === mesActual && anioNum === anio) porEmpresa.RAPEL.este_mes++;
        if (estado === 'EN PROCESO') porEmpresa.RAPEL.en_proceso++;
        if (estado === 'FINALIZADO') porEmpresa.RAPEL.finalizados++;
      }
      if (emp.indexOf('VERFRUT') !== -1) {
        porEmpresa.VERFRUT.total++;
        if (mesNum === mesActual && anioNum === anio) porEmpresa.VERFRUT.este_mes++;
        if (estado === 'EN PROCESO') porEmpresa.VERFRUT.en_proceso++;
        if (estado === 'FINALIZADO') porEmpresa.VERFRUT.finalizados++;
      }
    });

    _fbPatchEstadisticas({
      resumen_global: {
        total, hoy: hoyN, este_mes: esteMes,
        en_proceso: enProceso, finalizados,
        ultima_actualizacion: Date.now(),
        fecha_ultima_actualizacion: hoyStr
      },
      por_supervisor: porSupervisor,
      por_mes: porMes,
      por_anio: porAnio,
      por_empresa: porEmpresa
    });

    Logger.log('âœ… Total: ' + total);
    Logger.log('HOY: ' + hoyN + ' | MES: ' + esteMes + ' | EN PROCESO: ' + enProceso + ' | FINALIZADOS: ' + finalizados);
    Logger.log('RAPEL: ' + porEmpresa.RAPEL.total + ' (este mes: ' + porEmpresa.RAPEL.este_mes + ') | VERFRUT: ' + porEmpresa.VERFRUT.total + ' (este mes: ' + porEmpresa.VERFRUT.este_mes + ')');
    return { success: true, total: total };
  } catch(e) {
    Logger.log('Error: ' + e.toString());
    return { success: false, error: e.toString() };
  }
}
function testFirebase() {
  const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
  Logger.log('Secret existe: ' + (secret ? 'SI' : 'NO'));
  Logger.log('Secret longitud: ' + (secret ? secret.length : 0));
  
  const url = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com/test.json?auth=' + secret;
  const resp = UrlFetchApp.fetch(url, {
    method: 'PUT',
    contentType: 'application/json',
    payload: JSON.stringify({mensaje: 'prueba', ts: Date.now()}),
    muteHttpExceptions: true
  });
  Logger.log('Status: ' + resp.getResponseCode());
  Logger.log('Respuesta: ' + resp.getContentText());
}
// ============================================================
// PERMISOS TEMPORALES DE ACCESO
// ============================================================
function saveSolicitudAcceso(d) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) {
      ws = ss.insertSheet('Solicitudes_Acceso');
      ws.appendRow(['NÂ°','Fecha','Usuario','Nombre','Motivo',
        'Horas Solicitadas','Estado','Aprobado Por',
        'Hora Inicio','Hora Fin','Fecha ResoluciÃ³n']);
      ws.getRange(1,1,1,11).setFontWeight('bold');
    }
    var nro = ws.getLastRow();
    ws.appendRow([
      nro, new Date(),
      d.usuario || '', d.nombre || '', d.motivo || '',
      d.horas || 1, 'PENDIENTE', '', '', '', ''
    ]);
    return { success: true, nro: nro };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function aprobarAccesoTemporal(d) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: false, error: 'Hoja Solicitudes_Acceso no encontrada' };

    var rows = ws.getDataRange().getValues();
    if (!rows.length) return { success: false, error: 'Sin datos' };

    var tieneHeader = typeof rows[0][0] === 'string' && isNaN(rows[0][0]);
    var startIndex = tieneHeader ? 1 : 0;

    // Horas: desde d.horas o d.horas_aprobadas
    var horasAprobadas = parseInt(d.horas || d.horas_aprobadas) || 0;

    // Admin: desde d.aprobado_por o d.admin
    var aprobadoPor = String(d.aprobado_por || d.admin || '').trim();

    // Priorizar d.fila si fue enviado (1-based del sheet)
    var filaObjetivo = -1;
    if (d.fila) {
      var idxArray = parseInt(d.fila) - 1;
      if (idxArray >= 0 && idxArray < rows.length) {
        var rT = rows[idxArray];
        if (String(rT[2]).trim() === String(d.usuario).trim() &&
            String(rT[6]).toUpperCase().trim() === 'PENDIENTE') {
          filaObjetivo = idxArray;
        }
      }
    }
    if (filaObjetivo === -1) {
      for (var j = startIndex; j < rows.length; j++) {
        if (String(rows[j][2]).trim() === String(d.usuario).trim() &&
            String(rows[j][6]).toUpperCase().trim() === 'PENDIENTE') {
          filaObjetivo = j;
          break;
        }
      }
    }
    if (filaObjetivo !== -1) {
      var i = filaObjetivo;

      // Si admin no especificÃ³ horas, usar las solicitadas
      if (!horasAprobadas) horasAprobadas = parseInt(rows[i][5]) || 1;

      var ahora = new Date();
      var hastaMillis = ahora.getTime() + (horasAprobadas * 60 * 60 * 1000);
      var horaFin = new Date(hastaMillis);

      var filaSheet = i + 1;
      ws.getRange(filaSheet, 7).setValue(d.decision || 'APROBADO');
      ws.getRange(filaSheet, 8).setValue(aprobadoPor);
      ws.getRange(filaSheet, 9).setValue(Utilities.formatDate(ahora, 'America/Lima', 'HH:mm'));
      ws.getRange(filaSheet, 10).setValue(Utilities.formatDate(horaFin, 'America/Lima', 'HH:mm'));
      ws.getRange(filaSheet, 11).setValue(ahora);
      ws.getRange(filaSheet, 12).setValue(hastaMillis);
      ws.getRange(filaSheet, 6).setValue(horasAprobadas);

      return {
        success: true,
        hastaHora: Utilities.formatDate(horaFin, 'America/Lima', 'HH:mm'),
        hastaFecha: Utilities.formatDate(horaFin, 'America/Lima', 'dd/MM/yyyy HH:mm'),
        horasAprobadas: horasAprobadas,
        expiraEn: hastaMillis,
        decision: d.decision || 'APROBADO'
      };
    }
    return { success: false, error: 'Solicitud pendiente no encontrada para: ' + d.usuario };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
function verificarAccesoTemporal(p) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: true, tieneAcceso: false, motivo: 'sin hoja' };

    var rows = ws.getDataRange().getValues();
    if (!rows.length) return { success: true, tieneAcceso: false, motivo: 'sin filas' };

    var ahoraMillis = new Date().getTime();

    // Recorrer DESDE EL FINAL (mÃ¡s reciente primero)
    for (var i = rows.length - 1; i >= 1; i--) {
      var usuarioFila = String(rows[i][2] || '').trim();
      var estadoFila  = String(rows[i][6] || '').toUpperCase().trim();

      // Solo filas APROBADAS del usuario
      if (usuarioFila !== String(p.usuario).trim()) continue;
      if (estadoFila !== 'APROBADO') continue;

      // âœ… FIX: Leer timestamp expiraciÃ³n desde columna 12 (r[11])
      // NO hacer split() sobre hora_fin porque si es Date da "Sat Dec 30 1899..."
      var expiraEn = rows[i][11];
      var expiraMillis = 0;

      if (expiraEn) {
        if (expiraEn instanceof Date) {
          expiraMillis = expiraEn.getTime();
        } else if (typeof expiraEn === 'number') {
          expiraMillis = expiraEn;
        } else {
          expiraMillis = parseInt(expiraEn) || 0;
        }
      }

      // Fallback para solicitudes antiguas sin timestamp en columna 12:
      // calcular desde fecha_aprobacion (col 11) + horas
      if (!expiraMillis) {
        var fechaAprobacion = rows[i][10];
        var horasAprob = parseInt(rows[i][5]) || 1;
        if (fechaAprobacion instanceof Date) {
          expiraMillis = fechaAprobacion.getTime() + (horasAprob * 60 * 60 * 1000);
        }
      }

      if (!expiraMillis) continue;

      // Verificar si sigue vigente
      if (ahoraMillis < expiraMillis) {
        var fechaExp = new Date(expiraMillis);
        var horaFin = Utilities.formatDate(fechaExp, 'America/Lima', 'HH:mm');
        var fechaFin = Utilities.formatDate(fechaExp, 'America/Lima', 'dd/MM/yyyy');
        var minutosRestantes = Math.floor((expiraMillis - ahoraMillis) / (60 * 1000));

        return {
          success: true,
          tieneAcceso: true,
          hastaHora: horaFin,
          hastaFecha: fechaFin,
          minutosRestantes: minutosRestantes,
          expiraEn: expiraMillis
        };
      }
      // Si expirÃ³, seguir buscando por si hay otra aprobaciÃ³n mÃ¡s nueva
    }

    return { success: true, tieneAcceso: false, motivo: 'sin aprobaciÃ³n vigente' };
  } catch(e) {
    return { success: false, tieneAcceso: false, error: e.toString() };
  }
}
 

function getSolicitudesAcceso(p) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: true, data: [] };
    var rows = ws.getDataRange().getValues();
    if (!rows.length) return { success: true, data: [] };

    var tieneHeader = typeof rows[0][0] === 'string' && isNaN(rows[0][0]);
    var dataRows = tieneHeader ? rows.slice(1) : rows;

    var data = dataRows.filter(function(r){ return r[0] !== '' && r[0] !== null; })
      .map(function(r, i) {
        // Leer timestamp de expiraciÃ³n (columna 12)
        var expiraMs = 0;
        if (r[11]) {
          if (r[11] instanceof Date) expiraMs = r[11].getTime();
          else expiraMs = parseInt(r[11]) || 0;
        }

        // Formatear hora_fin correctamente (evita "Dec 30 1899")
        var horaFinStr = '';
        if (r[9]) {
          if (r[9] instanceof Date) {
            horaFinStr = Utilities.formatDate(r[9], 'America/Lima', 'HH:mm');
          } else {
            horaFinStr = String(r[9]);
          }
        }

        // Formatear hora_inicio correctamente
        var horaIniStr = '';
        if (r[8]) {
          if (r[8] instanceof Date) {
            horaIniStr = Utilities.formatDate(r[8], 'America/Lima', 'HH:mm');
          } else {
            horaIniStr = String(r[8]);
          }
        }

        return {
          fila:         (tieneHeader ? i + 2 : i + 1),
          nro:          r[0],
          fecha:        r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','dd/MM/yyyy HH:mm') : String(r[1]||''),
          usuario:      String(r[2]||''),
          nombre:       String(r[3]||''),
          motivo:       String(r[4]||''),
          horas:        parseInt(r[5]) || 0,
          horas_solicitadas: parseInt(r[5]) || 0,
          estado:       String(r[6]||'').trim(),
          aprobado_por: String(r[7]||''),
          hora_inicio:  horaIniStr,
          hora_fin:     horaFinStr,
          expira_ms:    expiraMs,
          expira_fecha: expiraMs ? Utilities.formatDate(new Date(expiraMs), 'America/Lima', 'dd/MM/yyyy HH:mm') : ''
        };
      });

    if (p && p.estado) data = data.filter(function(s){ return s.estado === p.estado; });
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• AZURE BLOB STORAGE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function subirArchivoAzure(d) {
  try {
    const props = PropertiesService.getScriptProperties();
    const account  = props.getProperty('AZURE_STORAGE_ACCOUNT') || 'sistemarlverfrut';
    const carpeta  = d.carpeta || 'casos-rl';
    
    // Seleccionar SAS token segÃºn contenedor
    let sasToken, container;
    if (carpeta === 'Visitas_Campo' || carpeta === 'visitas-campo') {
      sasToken  = props.getProperty('AZURE_SAS_VISITAS_CAMPO') || props.getProperty('AZURE_SAS_TOKEN');
      container = props.getProperty('AZURE_CONTAINER_VISITAS') || 'visitas-campo';
    } else {
      sasToken  = props.getProperty('AZURE_SAS_CASOS_RL') || props.getProperty('AZURE_SAS_TOKEN');
      container = props.getProperty('AZURE_CONTAINER_CASOS') || 'casos-rl';
    }

    if (!sasToken) return { success: false, error: 'SAS Token no configurado' };

    // Limpiar base64 â€” eliminar prefijo data:...;base64,
    let b64 = d.base64 || d.datos || '';
    if (!b64) return { success: false, error: 'base64 vacÃ­o' };
    if (b64.indexOf(',') !== -1) b64 = b64.split(',')[1];
    b64 = b64.replace(/\s/g, ''); // eliminar espacios y saltos de lÃ­nea

    const bytes  = Utilities.base64Decode(b64);
    const mime   = d.mimeType || d.tipo || 'application/pdf';
    const nombre = (d.nombre || ('archivo_' + Date.now() + '.pdf'))
                   .replace(/[^a-zA-Z0-9._-]/g, '_'); // limpiar nombre

    const url = 'https://' + account + '.blob.core.windows.net/' 
              + container + '/' + nombre + '?' + sasToken;

    const response = UrlFetchApp.fetch(url, {
      method: 'PUT',
      contentType: mime,
      payload: bytes,
      headers: { 'x-ms-blob-type': 'BlockBlob' },
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    Logger.log('Azure response: ' + code);

    if (code === 201 || code === 200) {
      const urlPublica = 'https://' + account + '.blob.core.windows.net/' 
                       + container + '/' + nombre + '?' + sasToken;
      return { success: true, enlace: urlPublica, url: urlPublica };
    } else {
      Logger.log('Azure error: ' + response.getContentText());
      return { success: false, error: 'Azure HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
    }
  } catch(e) {
    return { success: false, error: 'subirArchivoAzure: ' + e.toString() };
  }
}
function testAzure() {
  const resultado = subirArchivoAzure({
    base64: 'JVBERi0xLjQ=',
    nombre: 'test_' + Date.now() + '.pdf',
    mimeType: 'application/pdf',
    carpeta: 'casos-rl'
  });
  Logger.log(JSON.stringify(resultado));
}
function testConteo() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hojas = ['BB. DE REGISTROS 2024', 'BB. DE REGISTROS 2025', 'BB. DE REGISTROS 2026'];
  hojas.forEach(n => {
    const ws = ss.getSheetByName(n);
    if (!ws) { Logger.log(n + ': NO EXISTE'); return; }
    const rows = ws.getDataRange().getValues().slice(1).filter(r => r[0] || r[1]);
    // Contar estados
    let enProceso = 0, finalizado = 0, otros = 0;
    rows.forEach(r => {
      const estado = String(r[25]||'').toUpperCase();
      if (estado === 'EN PROCESO') enProceso++;
      else if (estado === 'FINALIZADO') finalizado++;
      else otros++;
    });
    Logger.log(n + ': ' + rows.length + ' filas | EN PROCESO: ' + enProceso + ' | FINALIZADO: ' + finalizado + ' | OTROS: ' + otros);
  });
}
function testNros() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h24 = ss.getSheetByName('BB. DE REGISTROS 2024');
  const h25 = ss.getSheetByName('BB. DE REGISTROS 2025');
  const h26 = ss.getSheetByName('BB. DE REGISTROS 2026');
  
  // Ver primeros 3 nros de cada hoja
  Logger.log('2024 nros: ' + h24.getRange(2,1,3,1).getValues().flat().join(', '));
  Logger.log('2025 nros: ' + h25.getRange(2,1,3,1).getValues().flat().join(', '));
  Logger.log('2026 nros: ' + h26.getRange(2,1,3,1).getValues().flat().join(', '));
}
/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  MÃ“DULO CAPACITACIONES â€” Backend Apps Script
 *  Sistema RR.LL. v3.0 â€” Verfrut / Rapel
 *
 *  IMPORTANTE: Estas funciones retornan OBJETOS planos (no
 *  ContentService), porque handle(e) ya se encarga del JSON.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â• CONFIGURACIÃ“N â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const CAP_SHEET_BBDD = 'BD_Capacitaciones';      // Hoja de asistentes
const CAP_SHEET_HDR  = 'CAPACITACIONES_HDR';     // Hoja de cabeceras
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SETUP INICIAL â€” Ejecutar UNA VEZ desde el editor
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capSetupInicial() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
 
  let hdr = ss.getSheetByName(CAP_SHEET_HDR);
  if (!hdr) {
    hdr = ss.insertSheet(CAP_SHEET_HDR);
    hdr.appendRow([
      'ID_CAPACITACION', 'FECHA_REGISTRO', 'EMPRESA', 'TIPO', 'TEMA', 'FUENTE',
      'AREA', 'LUGAR', 'FECHA', 'HORA_INICIO', 'HORA_FIN', 'TOTAL_HORAS', 'FRECUENCIA',
      'CAPACITADOR_DNI', 'CAPACITADOR_NOMBRE', 'CAPACITADOR_CARGO',
      'TOTAL_ASISTENTES', 'HOMBRES', 'MUJERES',
      'CREADA_POR', 'CREADA_POR_NOMBRE'
    ]);
    hdr.getRange('A1:U1')
       .setFontWeight('bold')
       .setBackground('#0a2463')
       .setFontColor('white')
       .setHorizontalAlignment('center');
    hdr.setFrozenRows(1);
    hdr.setColumnWidth(1, 180);
    hdr.setColumnWidth(5, 300);
    Logger.log('âœ“ Hoja creada: ' + CAP_SHEET_HDR);
  } else {
    Logger.log('â€¢ Hoja ya existe: ' + CAP_SHEET_HDR);
  }
 
  let bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
  if (!bbdd) {
    bbdd = ss.insertSheet(CAP_SHEET_BBDD);
    bbdd.appendRow([
      'ID_CAPACITACION', 'FECHA_REGISTRO', 'EMPRESA', 'TIPO', 'TEMA',
      'FECHA_CAPACITACION', 'HORA_INICIO', 'HORA_FIN',
      'N_ORDEN', 'DNI', 'APELLIDOS_Y_NOMBRES', 'CARGO_AREA', 'SEXO',
      'FUNDO', 'AREA', 'LUGAR', 'CAPACITADOR', 'CREADA_POR'
    ]);
    bbdd.getRange('A1:R1')
        .setFontWeight('bold')
        .setBackground('#0a2463')
        .setFontColor('white')
        .setHorizontalAlignment('center');
    bbdd.setFrozenRows(1);
    bbdd.setColumnWidth(1, 180);
    bbdd.setColumnWidth(5, 300);
    bbdd.setColumnWidth(11, 240);
    Logger.log('âœ“ Hoja creada: ' + CAP_SHEET_BBDD);
  } else {
    Logger.log('â€¢ Hoja ya existe: ' + CAP_SHEET_BBDD);
  }
 
  Logger.log('â•â•â• Setup completado â•â•â•');
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  GUARDAR CAPACITACIÃ“N (cabecera + asistentes en batch)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capGuardar(body) {
  try {
    const actividad  = body.actividad;
    const asistentes = body.asistentes || [];
 
    if (!actividad || !actividad.idCapacitacion) {
      return { success: false, error: 'Faltan datos de la actividad' };
    }
    if (asistentes.length === 0) {
      return { success: false, error: 'No hay asistentes para guardar' };
    }
 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let hdr  = ss.getSheetByName(CAP_SHEET_HDR);
    let bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
    if (!hdr || !bbdd) {
      capSetupInicial();
      hdr  = ss.getSheetByName(CAP_SHEET_HDR);
      bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
    }
 
    const fechaReg = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    const H = asistentes.filter(a => /^m(asc)?$|^h$|masculino|hombre/i.test(a.sexo || '')).length;
    const M = asistentes.filter(a => /^f$|^muj?$|femenino|mujer/i.test(a.sexo || '')).length;
 
    // Cabecera
    hdr.appendRow([
      actividad.idCapacitacion, fechaReg, actividad.empresa, actividad.tipo,
      actividad.tema, actividad.fuente || '', actividad.area, actividad.lugar,
      actividad.fecha, actividad.horaInicio, actividad.horaFin,
      actividad.totalHoras || '', actividad.frecuencia || '',
      actividad.capacitadorDni, actividad.capacitadorNombre, actividad.capacitadorCargo || '',
      asistentes.length, H, M,
      actividad.creadaPor || 'sistema', actividad.creadaPorNombre || '',
    ]);
 
    // Asistentes en batch
    const filas = asistentes.map((a, i) => [
      actividad.idCapacitacion, fechaReg, actividad.empresa, actividad.tipo,
      actividad.tema, actividad.fecha, actividad.horaInicio, actividad.horaFin,
      i + 1, a.dni, a.nombres || a.nombre || '', a.cargo || a.area || '',
      a.sexo || '', a.fundo || '', actividad.area, actividad.lugar,
      actividad.capacitadorNombre, actividad.creadaPor || 'sistema',
    ]);
    bbdd.getRange(bbdd.getLastRow() + 1, 1, filas.length, filas[0].length)
        .setValues(filas);
 try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
    return {
      success: true,
      idCapacitacion: actividad.idCapacitacion,
      registrosGuardados: asistentes.length,
      mensaje: 'CapacitaciÃ³n guardada correctamente'
    };
 
  } catch (err) {
    Logger.log('ERROR capGuardar: ' + err.message);
    return { success: false, error: err.message };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  LISTAR CAPACITACIONES con filtros opcionales
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capListar(body) {
  try {
    const filtros    = body || {};
    const rolesAdmin = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];
    const rol        = String(filtros.rol || '').toLowerCase().trim();
    const esAdmin    = rolesAdmin.includes(rol);
    const usuario    = String(filtros.usuario || '').toLowerCase().trim();
    const supervisor = String(filtros.supervisor || '').toLowerCase().trim();

    const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hdr = ss.getSheetByName(CAP_SHEET_HDR);
    if (!hdr) return { success: true, capacitaciones: [], total: 0, esAdmin: esAdmin };

    const datos = hdr.getDataRange().getValues();
    if (datos.length < 2) return { success: true, capacitaciones: [], total: 0, esAdmin: esAdmin };

    const headers = datos[0];
    const desde   = filtros.desde   || '';
    const hasta   = filtros.hasta   || '';
    const empresa = filtros.empresa || '';

    const resultado = [];
    for (let r = 1; r < datos.length; r++) {
      const obj = {};
      headers.forEach((h, i) => obj[capToCamel(h)] = datos[r][i]);

      const f = (obj.fecha || '').toString().split('T')[0];
      if (desde   && f < desde) continue;
      if (hasta   && f > hasta) continue;
      if (empresa && empresa !== 'AMBAS' && obj.empresa !== empresa) continue;

      // Supervisor solo ve sus propias capacitaciones
      if (!esAdmin && usuario) {
        if (String(obj.creadaPor || '').toLowerCase().trim() !== usuario) continue;
      }
      // Admin puede filtrar por supervisor especÃ­fico
      if (esAdmin && supervisor) {
        if (String(obj.creadaPor || '').toLowerCase().trim() !== supervisor) continue;
      }

      resultado.push(obj);
    }

    resultado.sort((a, b) => {
      const fa = (a.fechaRegistro || a.fecha || '').toString();
      const fb = (b.fechaRegistro || b.fecha || '').toString();
      return fb.localeCompare(fa);
    });

    return { success: true, capacitaciones: resultado, total: resultado.length, esAdmin: esAdmin };

  } catch (err) {
    Logger.log('ERROR capListar: ' + err.message);
    return { success: false, error: err.message };
  }
}

function capEstadisticas(body) {
  try {
    const filtros    = body || {};
    const rolesAdmin = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];
    const rol        = String(filtros.rol || '').toLowerCase().trim();
    const esAdmin    = rolesAdmin.includes(rol);
    if (!esAdmin) return { success: true, esAdmin: false, stats: {} };

    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hdr  = ss.getSheetByName(CAP_SHEET_HDR);
    const bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
    if (!hdr || !bbdd) return { success: true, esAdmin: true, stats: {} };

    const filasHdr  = hdr.getDataRange().getValues().slice(1).filter(function(r){ return r[0]; });
    const filasBdd  = bbdd.getDataRange().getValues().slice(1).filter(function(r){ return r[0]; });
    const hoy       = new Date();
    const mesActStr = Utilities.formatDate(hoy, 'America/Lima', 'yyyy-MM');

    // Cabecera: ID[0] FECHA_REG[1] EMPRESA[2] TIPO[3] TEMA[4] FUENTE[5] AREA[6]
    //           LUGAR[7] FECHA[8] HORA_INI[9] HORA_FIN[10] TOTAL_HORAS[11] FRECUENCIA[12]
    //           CAP_DNI[13] CAP_NOMBRE[14] CAP_CARGO[15] TOTAL_ASIST[16] H[17] M[18]
    //           CREADA_POR[19] CREADA_POR_NOMBRE[20]

    const esteMes = filasHdr.filter(function(r){
      return String(r[8] || '').substring(0, 7) === mesActStr;
    });
    const asistentesEsteMes = filasBdd.filter(function(r){
      return String(r[5] || '').substring(0, 7) === mesActStr;
    }).length;

    // Por empresa (asistentes)
    const porEmpresa = { RAPEL: 0, VERFRUT: 0 };
    filasBdd.forEach(function(r){
      const emp = String(r[2] || '').toUpperCase();
      if (emp.indexOf('RAPEL') !== -1) porEmpresa.RAPEL++;
      else if (emp.indexOf('VERFRUT') !== -1) porEmpresa.VERFRUT++;
    });

    // Top supervisores del mes
    const porSupervisor = {};
    esteMes.forEach(function(r){
      const sup = String(r[19] || 'sin_asignar');
      if (!porSupervisor[sup]) porSupervisor[sup] = { nombre: String(r[20] || r[19] || sup), capacitaciones: 0, asistentes: 0 };
      porSupervisor[sup].capacitaciones++;
      porSupervisor[sup].asistentes += parseInt(r[16]) || 0;
    });
    const topSupervisores = Object.keys(porSupervisor)
      .sort(function(a, b){ return porSupervisor[b].asistentes - porSupervisor[a].asistentes; })
      .slice(0, 5)
      .map(function(u){ return { usuario: u, nombre: porSupervisor[u].nombre, capacitaciones: porSupervisor[u].capacitaciones, asistentes: porSupervisor[u].asistentes }; });

    // Tendencia Ãºltimos 6 meses
    const tendenciaMeses = {};
    for (var i = 5; i >= 0; i--) {
      var d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      var key = Utilities.formatDate(d, 'America/Lima', 'yyyy-MM');
      tendenciaMeses[key] = { capacitaciones: 0, asistentes: 0 };
    }
    filasHdr.forEach(function(r){
      var f = String(r[8] || '').substring(0, 7);
      if (tendenciaMeses[f]) {
        tendenciaMeses[f].capacitaciones++;
        tendenciaMeses[f].asistentes += parseInt(r[16]) || 0;
      }
    });
    const tendencia = Object.keys(tendenciaMeses).map(function(mes){
      return { mes: mes, capacitaciones: tendenciaMeses[mes].capacitaciones, asistentes: tendenciaMeses[mes].asistentes };
    });

    // Top temas
    const porTema = {};
    filasHdr.forEach(function(r){
      var t = String(r[4] || 'Sin especificar').substring(0, 60);
      porTema[t] = (porTema[t] || 0) + 1;
    });
    const topTemas = Object.keys(porTema)
      .sort(function(a, b){ return porTema[b] - porTema[a]; })
      .slice(0, 5)
      .map(function(t){ return { tema: t, count: porTema[t] }; });

    const supervisoresActivos = new Set();
    esteMes.forEach(function(r){ if (r[19]) supervisoresActivos.add(String(r[19])); });

    return {
      success: true, esAdmin: true,
      stats: {
        totalCapacitaciones:    filasHdr.length,
        totalAsistentes:        filasBdd.length,
        capacitacionesEsteMes:  esteMes.length,
        asistentesEsteMes:      asistentesEsteMes,
        supervisoresActivosMes: supervisoresActivos.size,
        porEmpresa:             porEmpresa,
        topSupervisores:        topSupervisores,
        tendencia:              tendencia,
        topTemas:               topTemas
      }
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXPORTAR ASISTENTES POR RANGO DE FECHAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capExportar(body) {
  try {
    const filtros = body || {};
    const desde   = filtros.desde;
    const hasta   = filtros.hasta;
    const empresa = filtros.empresa;
 
    if (!desde || !hasta) {
      return { success: false, error: 'Falta el rango de fechas' };
    }
 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
    if (!bbdd) return { success: true, data: [] };
 
    const datos = bbdd.getDataRange().getValues();
    if (datos.length < 2) return { success: true, data: [] };
 
    const headers = datos[0];
    const data = [];
 
    for (let r = 1; r < datos.length; r++) {
      const obj = {};
      headers.forEach((h, i) => obj[h] = datos[r][i]);
 
      // FIX: normalizar fecha (Date o string) a yyyy-MM-dd
      let fechaCap = obj['FECHA_CAPACITACION'];
      if (fechaCap instanceof Date) {
        fechaCap = Utilities.formatDate(fechaCap, 'America/Lima', 'yyyy-MM-dd');
      } else {
        fechaCap = String(fechaCap || '').substring(0, 10);
      }
 
      if (!fechaCap) continue;
      if (fechaCap < desde || fechaCap > hasta) continue;
      if (empresa && obj['EMPRESA'] !== empresa) continue;
 
      // Devolver fecha normalizada al frontend
      obj['FECHA_CAPACITACION'] = fechaCap;
 // FIX horas: Sheets devuelve la hora como Date (epoch 1899) en UTC â†’
      // formatear a HH:mm en zona Lima para evitar el corrimiento de +5h.
      ['HORA_INICIO', 'HORA_FIN'].forEach(function(col) {
        const hv = obj[col];
        if (hv instanceof Date) {
          obj[col] = Utilities.formatDate(hv, 'America/Lima', 'HH:mm');
        } else {
          obj[col] = String(hv || '').trim();
        }
      });

      data.push(obj);
    }
    return { success: true, data: data, total: data.length };
  } catch (err) {
    Logger.log('ERROR capExportar: ' + err.message);
    return { success: false, error: err.message };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capToCamel(s) {
  return s.toString().toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  UTILIDADES DE DEBUG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function capVerificarHojas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hdr  = ss.getSheetByName(CAP_SHEET_HDR);
  const bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
 
  Logger.log('â•â• Estado de hojas â•â•');
  Logger.log(CAP_SHEET_HDR + ': ' + (hdr ? 'âœ“ existe (' + hdr.getLastRow() + ' filas)' : 'âœ— NO EXISTE'));
  Logger.log(CAP_SHEET_BBDD + ': ' + (bbdd ? 'âœ“ existe (' + bbdd.getLastRow() + ' filas)' : 'âœ— NO EXISTE'));
}
 
function capTestGuardado() {
  const body = {
    actividad: {
      idCapacitacion: 'TEST-' + Date.now(),
      empresa: 'RAPEL',
      tipo: 'CAPACITACIÃ“N',
      tema: 'PRUEBA - Uso de EPP',
      fuente: 'CAP-SC-09',
      area: 'Campo - Labores Varias',
      lugar: 'Zona de capacitaciones',
      fecha: Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd'),
      horaInicio: '08:30',
      horaFin: '10:00',
      totalHoras: '1h 30min',
      frecuencia: 'Mensual',
      capacitadorDni: '12345678',
      capacitadorNombre: 'TIMOTEO GONZA, JOEL',
      capacitadorCargo: 'Coordinador RL',
      creadaPor: 'jtimoteo',
      creadaPorNombre: 'Joel Timoteo',
    },
    asistentes: [
      { dni: '72345678', nombres: 'GARCÃA LÃ“PEZ, PEDRO', cargo: 'Aplicador', sexo: 'M', fundo: 'F1' },
      { dni: '72345679', nombres: 'MENDOZA RÃOS, ANA',   cargo: 'Packing',   sexo: 'F', fundo: 'F2' },
    ]
  };
 
  const resp = capGuardar(body);
  Logger.log('Respuesta: ' + JSON.stringify(resp));
}
/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  MÃ“DULO INVENTARIO DE CANASTAS â€” Backend Apps Script
 *  Sistema RR.LL. v3.0 â€” Verfrut / Rapel
 *
 *  IMPORTANTE: Estas funciones retornan OBJETOS planos (no
 *  ContentService), porque handle(e) ya se encarga del JSON.
 *
 *  PDF: Se genera y descarga directamente desde el navegador del
 *  usuario, NO se sube a Drive.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â• CONFIGURACIÃ“N â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const INV_SH_RECETA       = 'INV_Receta';
const INV_SH_RESPONSABLES = 'INV_Responsables';
const INV_SH_META         = 'INV_Meta';
const INV_SH_INGRESOS     = 'INV_Ingresos';
const INV_SH_ARMADOS      = 'INV_Canastas_Armadas';
const INV_SH_ENTREGAS     = 'INV_Entregas';
 
const INV_RESPONSABLES_INICIALES = [
  'Jaime Siancas',
  'Deysi Quispe',
  'Joel Timoteo Gonza',
  'Olga Vilela LudeÃ±a',
  'Jorge ChÃ¡vez CÃ³rdova',
  'Alex Tineo Ramos',
  'Yhanelly Luzon Venegas'
];
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SETUP â€” Ejecutar UNA VEZ desde el editor
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
 
  // RECETA
  let h = ss.getSheetByName(INV_SH_RECETA);
  if (!h) {
    h = ss.insertSheet(INV_SH_RECETA);
    h.appendRow(['ID', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'CREADO', 'CREADO_POR']);
    h.getRange('A1:F1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('âœ“ ' + INV_SH_RECETA);
  }
 
  // RESPONSABLES
  h = ss.getSheetByName(INV_SH_RESPONSABLES);
  if (!h) {
    h = ss.insertSheet(INV_SH_RESPONSABLES);
    h.appendRow(['ID', 'NOMBRE', 'CREADO']);
    h.getRange('A1:C1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    INV_RESPONSABLES_INICIALES.forEach(n => {
      h.appendRow(['R' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), n, new Date()]);
    });
    Logger.log('âœ“ ' + INV_SH_RESPONSABLES + ' con ' + INV_RESPONSABLES_INICIALES.length + ' iniciales');
  }
 
  // META
  h = ss.getSheetByName(INV_SH_META);
  if (!h) {
    h = ss.insertSheet(INV_SH_META);
    h.appendRow(['CAMPO', 'VALOR', 'ACTUALIZADO']);
    h.getRange('A1:C1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    h.appendRow(['total', 0, new Date()]);
    h.appendRow(['descripcion', '', new Date()]);
    Logger.log('âœ“ ' + INV_SH_META);
  }
 
  // INGRESOS
  h = ss.getSheetByName(INV_SH_INGRESOS);
  if (!h) {
    h = ss.insertSheet(INV_SH_INGRESOS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'PRODUCTO', 'CANTIDAD', 'UNIDAD', 'FECHA_INGRESO', 'FECHA_VENC', 'LOTE', 'RESPONSABLE', 'PROVEEDOR', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:L1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('âœ“ ' + INV_SH_INGRESOS);
  }
 
  // ARMADOS
  h = ss.getSheetByName(INV_SH_ARMADOS);
  if (!h) {
    h = ss.insertSheet(INV_SH_ARMADOS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'FECHA_ARMADO', 'CANTIDAD', 'RESPONSABLE', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:G1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('âœ“ ' + INV_SH_ARMADOS);
  }
 
  // ENTREGAS
  h = ss.getSheetByName(INV_SH_ENTREGAS);
  if (!h) {
    h = ss.insertSheet(INV_SH_ENTREGAS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'FECHA_ENTREGA', 'EMPRESA', 'SECTOR', 'CANTIDAD', 'RESPONSABLE', 'DOCUMENTO', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:J1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('âœ“ ' + INV_SH_ENTREGAS);
  }
 
  Logger.log('â•â•â• Setup inventario completado â•â•â•');
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  GET ALL â€” Carga inicial (todo en una sola llamada)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invGetAll() {
  try {
    const productos = (invListarProductos().productos) || [];
    const receta = invLeerReceta();
    const responsables = invLeerResponsables();
    const meta = invLeerMeta();
    const stock = invCalcularStock(receta);
    const armados = invLeerArmados();
    const entregas = invLeerEntregas();
    const ingresos = invLeerIngresos();

    const canastasArmadas = armados.reduce((s, a) => s + Number(a.cantidad || 0), 0);
    const canastasEntregadas = entregas.reduce((s, e) => s + Number(e.cantidad || 0), 0);

    return {
      success: true,
      productos,
      receta, responsables, meta, stock,
      canastasArmadas, canastasEntregadas,
      historialArmados: armados,
      historialEntregas: entregas,
      historialIngresos: ingresos,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RECETA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invLeerReceta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_RECETA);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 6).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], producto: r[1], unidad: r[2], cantidad: Number(r[3]) || 0
  }));
}
 
function invAgregarReceta(body) {
  try {
    // Acepta formato anidado (body.item.*) o plano (body.*)
    const producto = String(body.item?.producto ?? body.producto ?? '').trim();
    const unidad   = String(body.item?.unidad   ?? body.unidad   ?? '').trim();
    const cantidad = Number(body.item?.cantidad ?? body.cantidad ?? 0);

    if (!producto) return { success: false, error: 'Falta el producto' };
    if (!unidad)   return { success: false, error: 'Falta la unidad' };
    if (!cantidad || cantidad <= 0) {
  return { success: false, error: 'Cantidad invÃ¡lida' };
}
// NUEVO: advertir si cantidad es muy pequeÃ±a (posible error)
if (cantidad < 0.1 && cantidad !== 0.05) {
  return { 
    success: false, 
    error: 'Cantidad muy pequeÃ±a (' + cantidad + '). Â¿Seguro que es correcto? Ejemplo: 1 kg por canasta, no 0.01 kg.' 
  };
}

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h  = ss.getSheetByName(INV_SH_RECETA);
    if (!h) return { success: false, error: 'Hoja INV_Receta no encontrada. Ejecutar invSetup()' };

    const id = 'R' + Date.now();
    h.appendRow([id, producto, unidad, cantidad, new Date(), body.usuario || '']);

    return {
      success: true,
      item: { id: id, producto: producto, unidad: unidad, cantidad: cantidad }
    };
  } catch (e) {
    return { success: false, error: e.message || e.toString() };
  }
}
 
function invEliminarReceta(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_RECETA);
    if (!h) return { success: false, error: 'Hoja INV_Receta no encontrada' };
    
    const datos = h.getDataRange().getValues();
    
    // Aceptar bÃºsqueda por ID o por nombre de producto
    const buscarId       = body.id ? String(body.id) : '';
    const buscarProducto = body.producto ? String(body.producto).trim().toLowerCase() : '';
    
    if (!buscarId && !buscarProducto) {
      return { success: false, error: 'Falta id o producto' };
    }
    
    Logger.log('[ELIMINAR RECETA] Buscando id=' + buscarId + ' | producto=' + buscarProducto);
    
    for (let r = datos.length - 1; r >= 1; r--) {
      const filaId       = String(datos[r][0] || '');
      const filaProducto = String(datos[r][1] || '').trim().toLowerCase();
      
      // Coincide por ID exacto
      if (buscarId && filaId === buscarId) {
        h.deleteRow(r + 1);
        Logger.log('[ELIMINAR RECETA] âœ“ Eliminado por ID: ' + filaId);
        return { success: true, eliminado: datos[r][1], por: 'id' };
      }
      
      // Coincide por nombre de producto
      if (buscarProducto && filaProducto === buscarProducto) {
        h.deleteRow(r + 1);
        Logger.log('[ELIMINAR RECETA] âœ“ Eliminado por producto: ' + datos[r][1]);
        return { success: true, eliminado: datos[r][1], por: 'producto' };
      }
    }
    
    return { success: false, error: 'No se encontrÃ³ el producto en la receta' };
  } catch (e) {
    return { success: false, error: e.message || e.toString() };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RESPONSABLES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invLeerResponsables() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_RESPONSABLES);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 3).getValues();
  return datos.filter(r => r[0]).map(r => ({ id: r[0], nombre: r[1] }));
}
 
function invAgregarResponsable(body) {
  try {
    if (!body.nombre || !body.nombre.trim()) {
      return { success: false, error: 'Nombre vacÃ­o' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_RESPONSABLES);
    const id = 'R' + Date.now();
    h.appendRow([id, body.nombre.trim(), new Date()]);
    return { success: true, item: { id, nombre: body.nombre.trim() } };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEliminarResponsable(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_RESPONSABLES);
    if (!h) return { success: false, error: 'Hoja no encontrada' };
    
    const datos = h.getDataRange().getValues();
    const buscarId     = body.id ? String(body.id) : '';
    const buscarNombre = body.nombre ? String(body.nombre).trim().toLowerCase() : '';
    
    if (!buscarId && !buscarNombre) {
      return { success: false, error: 'Falta id o nombre' };
    }
    
    for (let r = datos.length - 1; r >= 1; r--) {
      const filaId     = String(datos[r][0] || '');
      const filaNombre = String(datos[r][1] || '').trim().toLowerCase();
      
      if (buscarId && filaId === buscarId) {
        h.deleteRow(r + 1);
        return { success: true, eliminado: datos[r][1] };
      }
      if (buscarNombre && filaNombre === buscarNombre) {
        h.deleteRow(r + 1);
        return { success: true, eliminado: datos[r][1] };
      }
    }
    
    return { success: false, error: 'No encontrado' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  META
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invLeerMeta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_META);
  if (!h || h.getLastRow() < 2) return { total: 0, descripcion: '' };
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
  const meta = { total: 0, descripcion: '' };
  datos.forEach(r => {
    if (r[0] === 'total')       meta.total = Number(r[1]) || 0;
    if (r[0] === 'descripcion') meta.descripcion = r[1] || '';
  });
  return meta;
}
 
function invGuardarMeta(body) {
  try {
    // Acepta formato anidado (body.meta.total) o plano (body.meta_total)
    const total       = parseInt(body.meta?.total ?? body.meta_total ?? body.total) || 0;
    const descripcion = String(body.meta?.descripcion ?? body.descripcion ?? '');

    if (total < 0) {
      return { success: false, error: 'La meta debe ser mayor o igual a 0' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h  = ss.getSheetByName(INV_SH_META);
    if (!h) return { success: false, error: 'Hoja INV_Meta no encontrada. Ejecutar invSetup()' };

    const datos = h.getDataRange().getValues();
    let rowTotal = -1, rowDesc = -1;
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === 'total')       rowTotal = r + 1;
      if (datos[r][0] === 'descripcion') rowDesc  = r + 1;
    }

    if (rowTotal === -1) {
      h.appendRow(['total', total, new Date()]);
    } else {
      h.getRange(rowTotal, 2).setValue(total);
      h.getRange(rowTotal, 3).setValue(new Date());
    }

    if (rowDesc === -1) {
      h.appendRow(['descripcion', descripcion, new Date()]);
    } else {
      h.getRange(rowDesc, 2).setValue(descripcion);
      h.getRange(rowDesc, 3).setValue(new Date());
    }

    return {
      success: true,
      meta: { total: total, descripcion: descripcion },
      mensaje: 'Meta guardada correctamente'
    };
  } catch (e) {
    return { success: false, error: e.message || e.toString() };
  }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  INGRESOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invRegistrarIngreso(body) {
  try {
    const i = body.ingreso;
    if (!i || !i.producto || !i.cantidad || !i.fechaIngreso || !i.fechaVenc) {
      return { success: false, error: 'Datos incompletos' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_INGRESOS);
    const id = 'I' + Date.now();
    h.appendRow([
      id, new Date(), i.producto, Number(i.cantidad), i.unidad || '',
      i.fechaIngreso, i.fechaVenc, i.lote || '', i.responsable, i.proveedor || '',
      i.observaciones || '', i.usuario || '',
      i.sector || '', i.supervisor || ''
    ]);
    return { success: true, id };
  } catch (e) { return { success: false, error: e.message }; }
}

function invRegistrarArmado(body) {
  try {
    const a = body.armado;
    if (!a || !a.cantidad || !a.fecha || !a.responsable) {
      return { success: false, error: 'Datos incompletos' };
    }
    const receta = invLeerReceta();
    const stock = invCalcularStock(receta);
    for (const r of receta) {
      const s = stock.find(x => x.producto === r.producto);
      const stockActual = s ? s.stock : 0;
      const necesario = a.cantidad * r.cantidad;
      if (stockActual < necesario) {
        return { success: false, error: 'Stock insuficiente de ' + r.producto + ': tienes ' + stockActual + ' ' + r.unidad + ', necesitas ' + necesario };
      }
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ARMADOS);
    const id = 'A' + Date.now();
    h.appendRow([
      id, new Date(), a.fecha, Number(a.cantidad), a.responsable,
      a.observaciones || '', a.usuario || '',
      a.sector || '', a.supervisor || ''
    ]);
    return { success: true, id };
  } catch (e) { return { success: false, error: e.message }; }
}

function invRegistrarEntrega(body) {
  try {
    const e = body.entrega;
    if (!e || !e.empresa || !e.sector || !e.cantidad || !e.fecha || !e.responsable) {
      return { success: false, error: 'Datos incompletos' };
    }
    const armados = invLeerArmados();
    const entregas = invLeerEntregas();
    const armadasTotal = armados.reduce((s, a) => s + Number(a.cantidad || 0), 0);
    const entregadasTotal = entregas.reduce((s, x) => s + Number(x.cantidad || 0), 0);
    const disponibles = armadasTotal - entregadasTotal;
    if (e.cantidad > disponibles) {
      return { success: false, error: 'Solo hay ' + disponibles + ' canastas disponibles' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ENTREGAS);
    
    // Auto-asegurar columna EXPORTADORA
    const lastCol = h.getLastColumn();
    const headRow = h.getRange(1, 1, 1, lastCol).getValues()[0];
    const tieneExp = headRow.some(c => String(c).toUpperCase() === 'EXPORTADORA');
    if (!tieneExp) {
      h.getRange(1, lastCol + 1).setValue('EXPORTADORA');
      h.getRange(1, lastCol + 1).setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    }
    
    const id = 'E' + Date.now();
    h.appendRow([
      id, new Date(), e.fecha, e.empresa, e.sector, Number(e.cantidad),
      e.responsable, e.documento || '', e.observaciones || '', e.usuario || '',
      e.supervisor || '', e.exportadora || ''
    ]);
    return { success: true, id };
  } catch (err) { return { success: false, error: err.message }; }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ARMADOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invRegistrarArmado(body) {
  try {
    const a = body.armado;
    if (!a || !a.cantidad || !a.fecha || !a.responsable) {
      return { success: false, error: 'Datos incompletos' };
    }
 
    // Validar stock antes de armar
    const receta = invLeerReceta();
    const stock = invCalcularStock(receta);
    for (const r of receta) {
      const s = stock.find(x => x.producto === r.producto);
      const stockActual = s ? s.stock : 0;
      const necesario = a.cantidad * r.cantidad;
      if (stockActual < necesario) {
        return { success: false, error: `Stock insuficiente de ${r.producto}: tienes ${stockActual} ${r.unidad}, necesitas ${necesario}` };
      }
    }
 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ARMADOS);
    const id = 'A' + Date.now();
    h.appendRow([id, new Date(), a.fecha, Number(a.cantidad), a.responsable, a.observaciones || '', a.usuario || '']);
    return { success: true, id };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invLeerArmados() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_ARMADOS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 9).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], cantidad: Number(r[3]) || 0,
    responsable: r[4], observaciones: r[5], usuario: r[6],
    sector: r[7] || '', supervisor: r[8] || ''
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ENTREGAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invRegistrarEntrega(body) {
  try {
    const e = body.entrega;
    if (!e || !e.empresa || !e.sector || !e.cantidad || !e.fecha || !e.responsable) {
      return { success: false, error: 'Datos incompletos' };
    }
 
    // Validar disponibles
    const armados = invLeerArmados();
    const entregas = invLeerEntregas();
    const armadasTotal = armados.reduce((s, a) => s + Number(a.cantidad || 0), 0);
    const entregadasTotal = entregas.reduce((s, x) => s + Number(x.cantidad || 0), 0);
    const disponibles = armadasTotal - entregadasTotal;
    if (e.cantidad > disponibles) {
      return { success: false, error: `Solo hay ${disponibles} canastas disponibles` };
    }
 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ENTREGAS);
    const id = 'E' + Date.now();
    h.appendRow([id, new Date(), e.fecha, e.empresa, e.sector, Number(e.cantidad), e.responsable, e.documento || '', e.observaciones || '', e.usuario || '']);
    return { success: true, id };
  } catch (err) { return { success: false, error: err.message }; }
}
 
function invLeerEntregas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_ENTREGAS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 11).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], empresa: r[3], sector: r[4],
    cantidad: Number(r[5]) || 0, responsable: r[6], documento: r[7],
    observaciones: r[8], usuario: r[9], supervisor: r[10] || ''
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CÃLCULO DE STOCK (clave del sistema)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invCalcularStock(receta) {
  const ingresos = invLeerIngresos();
  const armados = invLeerArmados();
  const totalCanastas = armados.reduce((s, a) => s + Number(a.cantidad || 0), 0);
 
  const stock = [];
  receta.forEach(r => {
    const ingProducto = ingresos.filter(i => (i.producto || '').toLowerCase() === r.producto.toLowerCase());
    const totalIngresado = ingProducto.reduce((s, i) => s + Number(i.cantidad || 0), 0);
    const usadoEnCanastas = totalCanastas * r.cantidad;
    const stockActual = totalIngresado - usadoEnCanastas;
 
    // Fecha de vencimiento mÃ¡s prÃ³xima
    const vencimientos = ingProducto
      .map(i => i.fechaVenc ? new Date(i.fechaVenc) : null)
      .filter(d => d && !isNaN(d));
    let fechaVenc = null, diasRestantes = null;
    if (vencimientos.length > 0) {
      const proxima = new Date(Math.min(...vencimientos.map(d => d.getTime())));
      fechaVenc = Utilities.formatDate(proxima, 'America/Lima', 'yyyy-MM-dd');
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      proxima.setHours(0, 0, 0, 0);
      diasRestantes = Math.floor((proxima - hoy) / (1000 * 60 * 60 * 24));
    }
 
    stock.push({
      producto: r.producto,
      unidad: r.unidad,
      stock: Math.max(0, stockActual),
      fecha_venc: fechaVenc,
      dias_restantes: diasRestantes
    });
  });
 
  return stock;
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  REPORTES (devuelven datos para que el frontend genere PDF)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invDatosReporte(body) {
  try {
    const tipo = body.tipo;
    const desde = body.desde;
    const hasta = body.hasta;
    const empresa = body.empresa;
 
    const datos = {};
 
    if (tipo === 'stock' || tipo === 'completo') {
      const receta = invLeerReceta();
      datos.stock = invCalcularStock(receta);
    }
 
    if (tipo === 'canastas' || tipo === 'completo') {
      const meta = invLeerMeta();
      const armados = invLeerArmados();
      const entregas = invLeerEntregas();
      datos.canastas = {
        meta: meta.total,
        armadas: armados.reduce((s, a) => s + Number(a.cantidad || 0), 0),
        entregadas: entregas.reduce((s, e) => s + Number(e.cantidad || 0), 0),
      };
    }
 
    if (tipo === 'entregas' || tipo === 'completo') {
      let entregas = invLeerEntregas();
      if (desde) entregas = entregas.filter(e => (e.fecha || '').toString().split('T')[0] >= desde);
      if (hasta) entregas = entregas.filter(e => (e.fecha || '').toString().split('T')[0] <= hasta);
      if (empresa) entregas = entregas.filter(e => e.empresa === empresa);
      datos.entregas = entregas.map(e => ({
        ...e,
        fecha: e.fecha instanceof Date ? Utilities.formatDate(e.fecha, 'America/Lima', 'yyyy-MM-dd') : e.fecha
      }));
    }
 
    return { success: true, datos };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DEBUG
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invDebug() {
  const r = invGetAll();
  Logger.log(JSON.stringify(r, null, 2));
}
 /**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  MÃ“DULO INVENTARIO V2 â€” CatÃ¡logo productos + Editar/Eliminar
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */
 
const INV_SH_PRODUCTOS = 'INV_Productos';
 
const INV_PRODUCTOS_INICIALES = [
  'Arroz',
  'Menestra',
  'AzÃºcar',
  'Gaseosa',
  'Galleta',
  'Chocolate',
  'PanetÃ³n',
  'Fideo',
  'Fideo canuto',
  'Avena',
  'Leche',
  'Aceite',
  'Galleta vainilla'
];
 
 
// SETUP CATÃLOGO â€” Ejecutar UNA VEZ desde el editor
function invSetupCatalogo() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let h = ss.getSheetByName(INV_SH_PRODUCTOS);
  if (!h) {
    h = ss.insertSheet(INV_SH_PRODUCTOS);
    h.appendRow(['ID', 'NOMBRE', 'ACTIVO', 'CREADO', 'CREADO_POR']);
    h.getRange('A1:E1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
 
    INV_PRODUCTOS_INICIALES.forEach((nombre, idx) => {
      const id = 'P' + (Date.now() + idx);
      h.appendRow([id, nombre, true, new Date(), 'sistema']);
    });
    Logger.log('âœ“ ' + INV_SH_PRODUCTOS + ' creado con ' + INV_PRODUCTOS_INICIALES.length + ' productos');
  } else {
    Logger.log('â€¢ ' + INV_SH_PRODUCTOS + ' ya existe');
  }
  Logger.log('â•â•â• CatÃ¡logo de productos completado â•â•â•');
}
 
 
// CRUD PRODUCTOS
function invListarProductos() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_PRODUCTOS);
    if (!h || h.getLastRow() < 2) return { success: true, productos: [] };
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 5).getValues();
    const productos = datos
      .filter(r => r[0] && r[2] === true)
      .map(r => ({ id: r[0], nombre: r[1], activo: r[2] }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { success: true, productos };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
 
function invAgregarProducto(body) {
  try {
    const nombre = (body.nombre || '').trim();
    if (!nombre) return { success: false, error: 'Nombre vacÃ­o' };
 
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_PRODUCTOS);
 
    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if ((datos[r][1] || '').toString().toLowerCase() === nombre.toLowerCase() && datos[r][2] === true) {
        return { success: false, error: 'Ya existe un producto con ese nombre' };
      }
    }
 
    const id = 'P' + Date.now();
    h.appendRow([id, nombre, true, new Date(), body.usuario || '']);
    return { success: true, item: { id, nombre, activo: true } };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEditarProducto(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_PRODUCTOS);
    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        if (body.nombre) h.getRange(r + 1, 2).setValue(body.nombre.trim());
        return { success: true };
      }
    }
    return { success: false, error: 'Producto no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEliminarProducto(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_PRODUCTOS);
    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        h.getRange(r + 1, 3).setValue(false);
        return { success: true };
      }
    }
    return { success: false, error: 'Producto no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// EDITAR / ELIMINAR INGRESOS
function invEditarIngreso(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_INGRESOS);
    const datos = h.getDataRange().getValues();
    const i = body.ingreso || {};
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        if (i.cantidad !== undefined)      h.getRange(r + 1, 4).setValue(Number(i.cantidad));
        if (i.unidad !== undefined)        h.getRange(r + 1, 5).setValue(i.unidad);
        if (i.fechaIngreso !== undefined)  h.getRange(r + 1, 6).setValue(i.fechaIngreso);
        if (i.fechaVenc !== undefined)     h.getRange(r + 1, 7).setValue(i.fechaVenc);
        if (i.lote !== undefined)          h.getRange(r + 1, 8).setValue(i.lote);
        if (i.responsable !== undefined)   h.getRange(r + 1, 9).setValue(i.responsable);
        if (i.proveedor !== undefined)     h.getRange(r + 1, 10).setValue(i.proveedor);
        if (i.observaciones !== undefined) h.getRange(r + 1, 11).setValue(i.observaciones);
         if (i.sector !== undefined)        h.getRange(r + 1, 13).setValue(i.sector);
        if (i.supervisor !== undefined)    h.getRange(r + 1, 14).setValue(i.supervisor);
        return { success: true };
      }
    }
    return { success: false, error: 'Ingreso no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEliminarIngreso(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_INGRESOS);
    const datos = h.getDataRange().getValues();
    for (let r = datos.length - 1; r >= 1; r--) {
      if (datos[r][0] === body.id) {
        h.deleteRow(r + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Ingreso no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// EDITAR / ELIMINAR ARMADOS
function invEditarArmado(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ARMADOS);
    const datos = h.getDataRange().getValues();
    const a = body.armado || {};
 
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
 
        if (a.cantidad !== undefined) {
          const cantOriginal = Number(datos[r][3]) || 0;
          const cantNueva = Number(a.cantidad);
          const diff = cantNueva - cantOriginal;
 
          if (diff > 0) {
            const receta = invLeerReceta();
            const ingresos = invLeerIngresos();
            const armados = invLeerArmados();
            for (const rec of receta) {
              const ingProd = ingresos.filter(ii => (ii.producto || '').toLowerCase() === rec.producto.toLowerCase());
              const totalIng = ingProd.reduce((s, ii) => s + Number(ii.cantidad || 0), 0);
              const totalArmadas = armados.reduce((s, x) => s + Number(x.cantidad || 0), 0);
              const usado = totalArmadas * rec.cantidad;
              const disponible = totalIng - usado;
              const necesarioExtra = diff * rec.cantidad;
              if (disponible < necesarioExtra) {
                return { success: false, error: 'No hay stock suficiente de ' + rec.producto + ' para aumentar a ' + cantNueva + ' canastas' };
              }
            }
          }
 
          if (diff < 0) {
            const armados = invLeerArmados();
            const entregas = invLeerEntregas();
            const totalArmadasNuevo = armados.reduce((s, x) => s + Number(x.cantidad || 0), 0) + diff;
            const totalEntregadas = entregas.reduce((s, x) => s + Number(x.cantidad || 0), 0);
            if (totalArmadasNuevo < totalEntregadas) {
              return { success: false, error: 'No puedes reducir: ya hay ' + totalEntregadas + ' canastas entregadas' };
            }
          }
 
          h.getRange(r + 1, 4).setValue(cantNueva);
        }
 
        if (a.fecha !== undefined)         h.getRange(r + 1, 3).setValue(a.fecha);
        if (a.responsable !== undefined)   h.getRange(r + 1, 5).setValue(a.responsable);
        if (a.observaciones !== undefined) h.getRange(r + 1, 6).setValue(a.observaciones);
        if (a.sector !== undefined)        h.getRange(r + 1, 8).setValue(a.sector);
        if (a.supervisor !== undefined)    h.getRange(r + 1, 9).setValue(a.supervisor);
        return { success: true };
      }
    }
    return { success: false, error: 'Armado no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEliminarArmado(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ARMADOS);
    const datos = h.getDataRange().getValues();
 
    let cantElim = 0;
    let filaElim = -1;
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        cantElim = Number(datos[r][3]) || 0;
        filaElim = r + 1;
        break;
      }
    }
    if (filaElim === -1) return { success: false, error: 'Armado no encontrado' };
 
    const armados = invLeerArmados();
    const entregas = invLeerEntregas();
    const totalArmadas = armados.reduce((s, x) => s + Number(x.cantidad || 0), 0);
    const totalEntregadas = entregas.reduce((s, x) => s + Number(x.cantidad || 0), 0);
    if ((totalArmadas - cantElim) < totalEntregadas) {
      return { success: false, error: 'No puedes eliminar: ya hay ' + totalEntregadas + ' canastas entregadas y solo quedarÃ­an ' + (totalArmadas - cantElim) };
    }
 
    h.deleteRow(filaElim);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// EDITAR / ELIMINAR ENTREGAS
function invEditarEntrega(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ENTREGAS);
    const datos = h.getDataRange().getValues();
    const e = body.entrega || {};
 
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
 
        if (e.cantidad !== undefined) {
          const cantOriginal = Number(datos[r][5]) || 0;
          const cantNueva = Number(e.cantidad);
          const diff = cantNueva - cantOriginal;
 
          if (diff > 0) {
            const armados = invLeerArmados();
            const entregas = invLeerEntregas();
            const totalArmadas = armados.reduce((s, x) => s + Number(x.cantidad || 0), 0);
            const totalEntregadas = entregas.reduce((s, x) => s + Number(x.cantidad || 0), 0);
            const disponibles = totalArmadas - totalEntregadas;
            if (disponibles < diff) {
              return { success: false, error: 'Solo hay ' + disponibles + ' canastas disponibles para aumentar' };
            }
          }
          h.getRange(r + 1, 6).setValue(cantNueva);
        }
 
        if (e.fecha !== undefined)         h.getRange(r + 1, 3).setValue(e.fecha);
        if (e.empresa !== undefined)       h.getRange(r + 1, 4).setValue(e.empresa);
        if (e.sector !== undefined)        h.getRange(r + 1, 5).setValue(e.sector);
        if (e.responsable !== undefined)   h.getRange(r + 1, 7).setValue(e.responsable);
        if (e.documento !== undefined)     h.getRange(r + 1, 8).setValue(e.documento);
        if (e.observaciones !== undefined) h.getRange(r + 1, 9).setValue(e.observaciones);
         if (e.supervisor !== undefined)    h.getRange(r + 1, 11).setValue(e.supervisor);
        return { success: true };
      }
    }
    return { success: false, error: 'Entrega no encontrada' };
  } catch (err) { return { success: false, error: err.message }; }
}
 
function invEliminarEntrega(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_ENTREGAS);
    const datos = h.getDataRange().getValues();
    for (let r = datos.length - 1; r >= 1; r--) {
      if (datos[r][0] === body.id) {
        h.deleteRow(r + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Entrega no encontrada' };
  } catch (e) { return { success: false, error: e.message }; }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  FIREBASE TIEMPO REAL â€” ActualizaciÃ³n rÃ¡pida al guardar atenciÃ³n
//  Se llama desde saveAtencion para actualizar SOLO contadores
//  necesarios. RÃ¡pido (~1-2 segundos) y no bloquea el guardado.
//  El trigger cada 5 min recalcula todo como respaldo.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 
function actualizarFirebaseRapido(d) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('âš ï¸ FIREBASE_DB_SECRET no configurado');
      return;
    }
 
    const urlBase   = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
    const hoy       = new Date();
    const hoyStr    = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM-dd');
    const mesActual = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM');
 
    const fechaAt   = (d.fecha_atencion || hoyStr).substring(0, 10);
    const esHoy     = fechaAt === hoyStr;
    const esEsteMes = fechaAt.substring(0, 7) === mesActual;
    const estado    = (d.estado || 'EN PROCESO').toUpperCase();
    const empresa   = (d.empresa || '').toUpperCase();
    const supervisor = String(d.supervisor || '').trim();
 
    // â”€â”€ 1. Leer resumen_global actual y actualizar â”€â”€
    const urlGlobal  = urlBase + '/estadisticas/resumen_global.json?auth=' + secret;
    const respGlobal = UrlFetchApp.fetch(urlGlobal, {muteHttpExceptions: true});
    let global = {};
    try { global = JSON.parse(respGlobal.getContentText()) || {}; } catch(e) { global = {}; }
 
    global.total = (global.total || 0) + 1;
    if (esHoy)                    global.hoy         = (global.hoy         || 0) + 1;
    if (esEsteMes)                global.este_mes    = (global.este_mes    || 0) + 1;
    if (estado === 'EN PROCESO')  global.en_proceso  = (global.en_proceso  || 0) + 1;
    if (estado === 'FINALIZADO')  global.finalizados = (global.finalizados || 0) + 1;
    global.ultima_actualizacion = Date.now();
    global.fecha_ultima_actualizacion = hoyStr; // NUEVO: para watchdog Firebase 

    UrlFetchApp.fetch(urlGlobal, {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify(global),
      muteHttpExceptions: true
    });
 
    // â”€â”€ 2. Actualizar contadores del supervisor especÃ­fico â”€â”€
    if (supervisor) {
      const supKey = supervisor.replace(/[.#$\[\]\/\s]/g, '_');
      const urlSup = urlBase + '/estadisticas/por_supervisor/' + supKey + '.json?auth=' + secret;
 
      const respSup = UrlFetchApp.fetch(urlSup, {muteHttpExceptions: true});
      let sup = {};
      try { sup = JSON.parse(respSup.getContentText()) || {}; } catch(e) { sup = {}; }
 
      sup.nombre = supervisor;
      sup.total  = (sup.total || 0) + 1;
      if (esEsteMes)                sup.este_mes    = (sup.este_mes    || 0) + 1;
      if (estado === 'EN PROCESO')  sup.en_proceso  = (sup.en_proceso  || 0) + 1;
      if (estado === 'FINALIZADO')  sup.finalizados = (sup.finalizados || 0) + 1;
 
      UrlFetchApp.fetch(urlSup, {
        method: 'PUT',
        contentType: 'application/json',
        payload: JSON.stringify(sup),
        muteHttpExceptions: true
      });
    }
 
    // â”€â”€ 3. Actualizar por empresa â”€â”€
    let empKey = '';
    if (empresa.indexOf('RAPEL') !== -1 && empresa.indexOf('VERFRUT') === -1) empKey = 'RAPEL';
    else if (empresa.indexOf('VERFRUT') !== -1) empKey = 'VERFRUT';
 
    if (empKey) {
      const urlEmp  = urlBase + '/estadisticas/por_empresa/' + empKey + '.json?auth=' + secret;
      const respEmp = UrlFetchApp.fetch(urlEmp, {muteHttpExceptions: true});
      let emp = {};
      try { emp = JSON.parse(respEmp.getContentText()) || {}; } catch(e) { emp = {}; }
 
      emp.total = (emp.total || 0) + 1;
      if (esEsteMes)                emp.este_mes    = (emp.este_mes    || 0) + 1;
      if (estado === 'EN PROCESO')  emp.en_proceso  = (emp.en_proceso  || 0) + 1;
      if (estado === 'FINALIZADO')  emp.finalizados = (emp.finalizados || 0) + 1;
 
      UrlFetchApp.fetch(urlEmp, {
        method: 'PUT',
        contentType: 'application/json',
        payload: JSON.stringify(emp),
        muteHttpExceptions: true
      });
    }
 
    Logger.log('âœ“ Firebase rÃ¡pido actualizado OK');
  } catch(e) {
    Logger.log('actualizarFirebaseRapido error: ' + e.toString());
  }
}
function debugAccesosTemporales() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName('Solicitudes_Acceso');
  if (!ws) { Logger.log('Hoja no existe'); return; }

  var rows = ws.getDataRange().getValues();
  var ahora = new Date();
  var ahoraMs = ahora.getTime();

  Logger.log('=== DEBUG ACCESOS TEMPORALES ===');
  Logger.log('Fecha actual: ' + Utilities.formatDate(ahora, 'GMT-5', 'dd/MM/yyyy HH:mm:ss'));
  Logger.log('Total filas: ' + rows.length);

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    Logger.log('--- Fila ' + (i+1) + ' ---');
    Logger.log('Usuario: ' + r[2] + ' | Estado: ' + r[6] + ' | Horas: ' + r[5]);
    Logger.log('Hora inicio: ' + r[8] + ' | Hora fin: ' + r[9]);
    Logger.log('Expira timestamp (col 12): ' + r[11]);

    if (r[11]) {
      var expMs = r[11] instanceof Date ? r[11].getTime() : parseInt(r[11]);
      var diff = expMs - ahoraMs;
      var horasRest = (diff / (60 * 60 * 1000)).toFixed(2);
      Logger.log('Horas restantes: ' + horasRest + ' | Vigente: ' + (diff > 0 ? 'SI' : 'NO'));
    }
  }
}

function testVerificarAccesoRmolero() {
  var resultado = verificarAccesoTemporal({ usuario: 'rmolero' });
  Logger.log(JSON.stringify(resultado, null, 2));
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ACTUALIZAR FIREBASE MÃ“DULOS (tiempo real)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function normalizarFechaStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'GMT-5', 'yyyy-MM-dd');
  return String(val).substring(0, 10).replace(/T.*/, '');
}

function actualizarFirebaseModulos() {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('âš ï¸ FIREBASE_DB_SECRET no configurado');
      return;
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const urlBase = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
    const hoy = new Date();
    const mesActStr = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM');

    // VISITAS
    const wsV = ss.getSheetByName('Visitas_Campo');
    const vis = { total: 0, en_plazo: 0, retrasadas: 0, este_mes: 0 };
    if (wsV && wsV.getLastRow() > 1) {
      wsV.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        vis.total++;
        const est = String(r[21] || '').toUpperCase();
        if (est === 'EN PLAZO') vis.en_plazo++;
        else if (est === 'RETRASADO') vis.retrasadas++;
        if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) vis.este_mes++;
      });
    }

    // CASOS
    const wsC = ss.getSheetByName('BD_Casos');
    const cas = { total: 0, en_plazo: 0, retrasados: 0, este_mes: 0 };
    if (wsC && wsC.getLastRow() > 1) {
      wsC.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        cas.total++;
        const est = String(r[15] || '').toUpperCase();
        if (est === 'EN PLAZO' || est === 'EN PROCESO') cas.en_plazo++;
        else if (est === 'RETRASADO') cas.retrasados++;
        if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) cas.este_mes++;
      });
    }

    // FUSIONES
    const wsF = ss.getSheetByName('Fusiones_Buses');
    const fus = { total: 0, pendientes: 0, validados: 0, este_mes: 0, trabajadores: 0 };
    if (wsF && wsF.getLastRow() > 1) {
      wsF.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        fus.total++;
        const est = String(r[27] || '').toLowerCase();
        if (est === 'pendiente') fus.pendientes++;
        else if (est === 'validado') fus.validados++;
        if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) fus.este_mes++;
        fus.trabajadores += parseInt(r[12]) || 0;
      });
    }

    // CAPACITACIONES
    const wsK = ss.getSheetByName('CAPACITACIONES_HDR');
    const cap = { total: 0, este_mes: 0, total_asistentes: 0 };
    if (wsK && wsK.getLastRow() > 1) {
      wsK.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        cap.total++;
        if (normalizarFechaStr(r[8]).substring(0, 7) === mesActStr) cap.este_mes++;
        cap.total_asistentes += parseInt(r[16]) || 0;
      });
    }

    // Escribir estadÃ­sticas_modulos a Firebase
    const url = urlBase + '/estadisticas_modulos.json?auth=' + secret;
    const payload = {
      visitas: vis,
      casos: cas,
      fusiones: fus,
      capacitaciones: cap,
      ultima_actualizacion: hoy.getTime()
    };

    UrlFetchApp.fetch(url, {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log('âœ“ Firebase mÃ³dulos OK');

    // â•â•â• ALERTAS EN TIEMPO REAL â•â•â•
    const alertas = [];
    
    if (cas.retrasados > 0) {
      alertas.push({ 
        tipo: 'critico', 
        icon: 'ðŸ”´', 
        msg: cas.retrasados + ' casos retrasados requieren atenciÃ³n',
        modulo: 'casos'
      });
    }
    
    if (vis.retrasadas > 0) {
      alertas.push({ 
        tipo: 'advertencia', 
        icon: 'ðŸŸ¡', 
        msg: vis.retrasadas + ' visitas retrasadas',
        modulo: 'visitas'
      });
    }
    
    if (fus.pendientes > 0) {
      alertas.push({ 
        tipo: 'info', 
        icon: 'ðŸŸ ', 
        msg: fus.pendientes + ' fusiones pendientes de validaciÃ³n',
        modulo: 'fusiones'
      });
    }
    
    if (cap.este_mes === 0) {
      alertas.push({ 
        tipo: 'critico', 
        icon: 'ðŸ”´', 
        msg: 'Sin capacitaciones registradas este mes',
        modulo: 'capacitaciones'
      });
    } else if (cap.este_mes < 5) {
      alertas.push({ 
        tipo: 'advertencia', 
        icon: 'ðŸŸ¡', 
        msg: 'Solo ' + cap.este_mes + ' capacitaciones este mes',
        modulo: 'capacitaciones'
      });
    }
    
    // Escribir alertas a Firebase
    const urlAlertas = urlBase + '/alertas.json?auth=' + secret;
    UrlFetchApp.fetch(urlAlertas, {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify({
        items: alertas,
        total: alertas.length,
        criticas: alertas.filter(function(a){ return a.tipo === 'critico'; }).length,
        advertencias: alertas.filter(function(a){ return a.tipo === 'advertencia'; }).length,
        info: alertas.filter(function(a){ return a.tipo === 'info'; }).length,
        ultima_actualizacion: hoy.getTime()
      }),
      muteHttpExceptions: true
    });
    Logger.log('âœ“ Alertas Firebase: ' + alertas.length + ' alertas activas');

  } catch(e) {
    Logger.log('actualizarFirebaseModulos error: ' + e.toString());
  }
}
/**
 * ============================================================
 *  resumenEjecutivo (FIX - versiÃ³n sÃ¡bado)
 * ============================================================
 *  Cambios respecto a la versiÃ³n anterior:
 *  [1] NUEVO: procesa atenciones de 4 hojas con deduplicaciÃ³n (antes ignoradas)
 *  [2] FIX:   casos lee col 27 (estado_gestion) para EN PROCESO/FINALIZADO
 *             (antes leÃ­a col 15 estado_caso que no contiene esos valores)
 *  [3] NUEVO: campo casos.finalizados (frontend lo esperaba)
 *  [4] FIX:   capacitaciones devuelve total_asistentes (antes era asistentes)
 *  [5] FIX:   comparativa RAPEL/VERFRUT detecta columna empresa por hoja
 *             (antes hardcodeaba col 2 - rompÃ­a Fusiones)
 *  [6] NUEVO: comparativa incluye atenciones
 *  [7] NUEVO: tendencia 6 meses incluye atenciones
 * ============================================================
 */
function resumenEjecutivo(body) {
  try {
    const filtros = body || {};
    const empresa = String(filtros.empresa || 'AMBAS').toUpperCase();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActStr = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM');
    const hoyStr    = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM-dd');
 
    // === FIX [5]: detecciÃ³n dinÃ¡mica de columna empresa por hoja ===
    const colEmpCache = {};
    function getColEmpresa(ws) {
      if (!ws) return -1;
      const nombre = ws.getName();
      if (colEmpCache[nombre] !== undefined) return colEmpCache[nombre];
      const headers = ws.getRange(1, 1, 1, ws.getLastColumn()).getValues()[0];
      const exactos = ['EMPRESA', 'COMPANIA', 'COMPAÃ‘IA'];
      let idx = -1;
      // Match exacto primero
      for (let i = 0; i < headers.length; i++) {
        const h = String(headers[i] || '').toUpperCase().trim();
        if (exactos.indexOf(h) !== -1) { idx = i; break; }
      }
      // Si no, contiene "EMPRESA"
      if (idx < 0) {
        for (let i = 0; i < headers.length; i++) {
          const h = String(headers[i] || '').toUpperCase().trim();
          if (h.indexOf('EMPRESA') !== -1) { idx = i; break; }
        }
      }
      colEmpCache[nombre] = idx;
      return idx;
    }
 
    function filtrarPorEmpresa(rows, colEmp) {
      if (empresa === 'AMBAS' || colEmp < 0) return rows;
      return rows.filter(function(r) {
        return String(r[colEmp] || '').toUpperCase().indexOf(empresa) !== -1;
      });
    }
 
    // ============================================================
    // [1] MÃ“DULO ATENCIONES (NUEVO - antes no se procesaba)
    // ============================================================
    let at = { total: 0, hoy: 0, este_mes: 0, en_proceso: 0, finalizados: 0 };
    const hojasAt = [
      'BB. DE REGISTROS 2024',
      'BB. DE REGISTROS 2025',
      'BB. DE REGISTROS ' + anioActual,
      'BB. DE REGISTROS'
    ];
    // Columnas en BB. DE REGISTROS (confirmado por getEstadisticasAdmin):
    //   col 1  = fecha_atencion
    //   col 11 = empresa
    //   col 25 = estado
    const COL_AT_FECHA = 1, COL_AT_EMP = 11, COL_AT_ESTADO = 25;
    const vistosAt = new Set();
 
    hojasAt.forEach(function(nombreHoja) {
      const ws = ss.getSheetByName(nombreHoja);
      if (!ws || ws.getLastRow() < 2) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0] && !r[7]) return;
        // Dedup con clave nombreHoja + nro (mismo patrÃ³n que getEstadisticasAdmin)
        const k = nombreHoja + '_' + String(r[0]);
        if (vistosAt.has(k)) return;
        vistosAt.add(k);
 
        // Filtro empresa
        if (empresa !== 'AMBAS') {
          const empReg = String(r[COL_AT_EMP] || '').toUpperCase();
          if (empReg.indexOf(empresa) === -1) return;
        }
 
        at.total++;
 
        // Fecha
        const fechaStr = r[COL_AT_FECHA] instanceof Date
          ? Utilities.formatDate(r[COL_AT_FECHA], 'GMT-5', 'yyyy-MM-dd')
          : String(r[COL_AT_FECHA] || '').substring(0, 10);
        if (fechaStr === hoyStr) at.hoy++;
        if (fechaStr.substring(0, 7) === mesActStr) at.este_mes++;
 
        // Estado
        const est = String(r[COL_AT_ESTADO] || '').toUpperCase();
        if (est === 'EN PROCESO') at.en_proceso++;
        else if (est === 'FINALIZADO' || est === 'RESUELTO') at.finalizados++;
      });
    });
 
    // ============================================================
    // MÃ“DULO VISITAS (igual que antes, ahora con col empresa dinÃ¡mica)
    // ============================================================
    const wsV = ss.getSheetByName('Visitas_Campo');
    const colEmpV = getColEmpresa(wsV);
    let vis = { total: 0, en_plazo: 0, retrasadas: 0, este_mes: 0, hoy: 0, sin_cerrar: 0 };
    if (wsV && wsV.getLastRow() > 1) {
      let rowsV = wsV.getDataRange().getValues().slice(1).filter(function(r) { return r[0]; });
      rowsV = filtrarPorEmpresa(rowsV, colEmpV);
      rowsV.forEach(function(r) {
        vis.total++;
        const est = String(r[21] || '').toUpperCase();
        if (est === 'EN PLAZO')        vis.en_plazo++;
        else if (est === 'RETRASADO')  vis.retrasadas++;
        const fecha = String(r[1] || '').substring(0, 10);
        if (fecha.substring(0, 7) === mesActStr) vis.este_mes++;
        if (fecha === hoyStr) vis.hoy++;
        if (est !== 'CERRADO' && est !== 'FINALIZADO') vis.sin_cerrar++;
      });
    }
 
    // ============================================================
    // [2][3] MÃ“DULO CASOS - FIX: lee col 27 (estado_gestion) + agrega finalizados
    // ============================================================
    const wsC = ss.getSheetByName('BD_Casos');
    const colEmpC = getColEmpresa(wsC);
    let cas = { total: 0, en_plazo: 0, retrasados: 0, este_mes: 0, hoy: 0, en_proceso: 0, finalizados: 0 };
    if (wsC && wsC.getLastRow() > 1) {
      let rowsC = wsC.getDataRange().getValues().slice(1).filter(function(r) { return r[0]; });
      rowsC = filtrarPorEmpresa(rowsC, colEmpC);
      rowsC.forEach(function(r) {
        cas.total++;
        // Dos ejes: estado_caso (col 15: EN PLAZO/RETRASADO) y estado_gestion (col 27: EN PROCESO/CONCLUIDO)
        const estCaso = String(r[15] || '').toUpperCase();
        const estGes  = String(r[27] || '').toUpperCase();
        if (estCaso === 'EN PLAZO')        cas.en_plazo++;
        else if (estCaso === 'RETRASADO')  cas.retrasados++;
        // FIX: leer estado_gestion (col 27) para En Proceso / Finalizado
        if (estGes.indexOf('PROCESO') !== -1) cas.en_proceso++;
        else if (estGes.indexOf('CONCLUIDO') !== -1 || estGes.indexOf('FINALIZADO') !== -1 || estGes.indexOf('CERRADO') !== -1) cas.finalizados++;
        const fecha = String(r[1] || '').substring(0, 10);
        if (fecha.substring(0, 7) === mesActStr) cas.este_mes++;
        if (fecha === hoyStr) cas.hoy++;
      });
    }
 
    // ============================================================
    // MÃ“DULO FUSIONES (igual que antes, col empresa dinÃ¡mica)
    // ============================================================
    const wsF = ss.getSheetByName('Fusiones_Buses');
    const colEmpF = getColEmpresa(wsF);
    let fus = { total: 0, pendientes: 0, validados: 0, este_mes: 0, trabajadores: 0 };
    if (wsF && wsF.getLastRow() > 1) {
      let rowsF = wsF.getDataRange().getValues().slice(1).filter(function(r) { return r[0]; });
      rowsF = filtrarPorEmpresa(rowsF, colEmpF);
      rowsF.forEach(function(r) {
        fus.total++;
        const est = String(r[27] || '').toLowerCase();
        if (est === 'pendiente')      fus.pendientes++;
        else if (est === 'validado')  fus.validados++;
        const fecha = String(r[1] || '').substring(0, 10);
        if (fecha.substring(0, 7) === mesActStr) fus.este_mes++;
        fus.trabajadores += parseInt(r[12]) || 0;
      });
    }
 
    // ============================================================
    // [4] MÃ“DULO CAPACITACIONES - FIX: agrega total_asistentes
    // ============================================================
    const wsK = ss.getSheetByName('CAPACITACIONES_HDR');
    const colEmpK = getColEmpresa(wsK);
    let cap = {
      total: 0, asistentes: 0, total_asistentes: 0,
      este_mes: 0, asistentes_mes: 0,
      top_supervisor: '-', top_sup_count: 0
    };
    if (wsK && wsK.getLastRow() > 1) {
      let rowsK = wsK.getDataRange().getValues().slice(1).filter(function(r) { return r[0]; });
      rowsK = filtrarPorEmpresa(rowsK, colEmpK);
      const porSup = {};
      rowsK.forEach(function(r) {
        cap.total++;
        const asis = parseInt(r[16]) || 0;
        cap.asistentes += asis;
        const fecha = String(r[8] || '').substring(0, 10);
        if (fecha.substring(0, 7) === mesActStr) {
          cap.este_mes++;
          cap.asistentes_mes += asis;
          const sup = r[19] || '';
          const nombre = r[20] || sup;
          if (sup) porSup[sup] = {
            count: (porSup[sup] ? porSup[sup].count : 0) + asis,
            nombre: nombre
          };
        }
      });
      cap.total_asistentes = cap.asistentes;  // FIX: alias para frontend
      const top = Object.keys(porSup).sort(function(a, b) {
        return porSup[b].count - porSup[a].count;
      })[0];
      if (top) {
        cap.top_supervisor = porSup[top].nombre;
        cap.top_sup_count = porSup[top].count;
      }
    }
 
    // ============================================================
    // [5][6] COMPARATIVA RAPEL vs VERFRUT - FIX: columna dinÃ¡mica + atenciones
    // ============================================================
    const comparativa = {
      atenciones:     { RAPEL: 0, VERFRUT: 0 },
      visitas:        { RAPEL: 0, VERFRUT: 0 },
      casos:          { RAPEL: 0, VERFRUT: 0 },
      fusiones:       { RAPEL: 0, VERFRUT: 0 },
      capacitaciones: { RAPEL: 0, VERFRUT: 0 }
    };
 
    // Atenciones con dedup
    const vistosCompAt = new Set();
    hojasAt.forEach(function(nombreHoja) {
      const ws = ss.getSheetByName(nombreHoja);
      if (!ws || ws.getLastRow() < 2) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0] && !r[7]) return;
        const k = nombreHoja + '_' + String(r[0]);
        if (vistosCompAt.has(k)) return;
        vistosCompAt.add(k);
        const emp = String(r[COL_AT_EMP] || '').toUpperCase();
        if (emp.indexOf('RAPEL') !== -1)        comparativa.atenciones.RAPEL++;
        else if (emp.indexOf('VERFRUT') !== -1) comparativa.atenciones.VERFRUT++;
      });
    });
 
    // Resto: columna empresa dinÃ¡mica por hoja
    const mapaHojas = [
      { nombre: 'Visitas_Campo',      key: 'visitas',        col: colEmpV },
      { nombre: 'BD_Casos',           key: 'casos',          col: colEmpC },
      { nombre: 'Fusiones_Buses',     key: 'fusiones',       col: colEmpF },
      { nombre: 'CAPACITACIONES_HDR', key: 'capacitaciones', col: colEmpK }
    ];
    mapaHojas.forEach(function(h) {
      const ws = ss.getSheetByName(h.nombre);
      if (!ws || ws.getLastRow() < 2 || h.col < 0) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        const emp = String(r[h.col] || '').toUpperCase();
        if (emp.indexOf('RAPEL') !== -1)        comparativa[h.key].RAPEL++;
        else if (emp.indexOf('VERFRUT') !== -1) comparativa[h.key].VERFRUT++;
      });
    });
 
    // ============================================================
    // ALERTAS (igual que antes)
    // ============================================================
    const alertas = [];
    if (cas.retrasados > 0) {
      alertas.push({ tipo: 'critico', icon: 'ðŸ”´', msg: cas.retrasados + ' casos retrasados requieren atenciÃ³n' });
    }
    if (vis.sin_cerrar > 10) {
      alertas.push({ tipo: 'advertencia', icon: 'ðŸŸ¡', msg: vis.sin_cerrar + ' visitas sin cerrar' });
    }
    if (fus.pendientes > 0) {
      alertas.push({ tipo: 'info', icon: 'ðŸŸ ', msg: fus.pendientes + ' fusiones pendientes de validaciÃ³n' });
    }
    if (cap.este_mes === 0) {
      alertas.push({ tipo: 'critico', icon: 'ðŸ”´', msg: 'Sin capacitaciones registradas este mes' });
    } else if (cap.este_mes < 5) {
      alertas.push({ tipo: 'advertencia', icon: 'ðŸŸ¡', msg: 'Solo ' + cap.este_mes + ' capacitaciones este mes (meta: 10)' });
    }
 
    // ============================================================
    // [7] TENDENCIA 6 MESES - NUEVO: incluye atenciones
    // ============================================================
    const tendencia = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = Utilities.formatDate(d, 'GMT-5', 'yyyy-MM');
      tendencia[key] = { atenciones: 0, visitas: 0, casos: 0, fusiones: 0, capacitaciones: 0 };
    }
 
    // Atenciones en tendencia (con dedup)
    const vistosTendAt = new Set();
    hojasAt.forEach(function(nombreHoja) {
      const ws = ss.getSheetByName(nombreHoja);
      if (!ws || ws.getLastRow() < 2) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0] && !r[7]) return;
        const k = nombreHoja + '_' + String(r[0]);
        if (vistosTendAt.has(k)) return;
        vistosTendAt.add(k);
        if (empresa !== 'AMBAS') {
          const empReg = String(r[COL_AT_EMP] || '').toUpperCase();
          if (empReg.indexOf(empresa) === -1) return;
        }
        const fechaMes = r[COL_AT_FECHA] instanceof Date
          ? Utilities.formatDate(r[COL_AT_FECHA], 'GMT-5', 'yyyy-MM')
          : String(r[COL_AT_FECHA] || '').substring(0, 7);
        if (tendencia[fechaMes]) tendencia[fechaMes].atenciones++;
      });
    });
 
    function procesarTendencia(ws, tipo, colFecha, colEmp) {
      if (!ws || ws.getLastRow() < 2) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        if (!r[0]) return;
        if (empresa !== 'AMBAS' && colEmp >= 0) {
          const emp = String(r[colEmp] || '').toUpperCase();
          if (emp.indexOf(empresa) === -1) return;
        }
        const f = String(r[colFecha] || '').substring(0, 7);
        if (tendencia[f]) tendencia[f][tipo]++;
      });
    }
    procesarTendencia(wsV, 'visitas',        1, colEmpV);
    procesarTendencia(wsC, 'casos',          1, colEmpC);
    procesarTendencia(wsF, 'fusiones',       1, colEmpF);
    procesarTendencia(wsK, 'capacitaciones', 8, colEmpK);
 
    // ============================================================
    // RESPUESTA
    // ============================================================
    return {
      success: true,
      atenciones: at,           // NUEVO
      visitas: vis,
      casos: cas,
      fusiones: fus,
      capacitaciones: cap,
      comparativa: comparativa, // ahora incluye atenciones
      tendencia: Object.keys(tendencia).map(function(k){return {mes:k,atenciones:tendencia[k].atenciones,visitas:tendencia[k].visitas,casos:tendencia[k].casos,fusiones:tendencia[k].fusiones,capacitaciones:tendencia[k].capacitaciones};}),
      alertas: alertas,
      timestamp: new Date().toISOString()
    };
 
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function testStockReal() {
  const receta = invLeerReceta();
  const ingresos = invLeerIngresos();
  const armados = invLeerArmados();
  const stock = invCalcularStock(receta);
  
  Logger.log('â•â•â•â•â•â•â•â• RECETA â•â•â•â•â•â•â•â•');
  receta.forEach(r => {
    Logger.log('  ' + r.producto + ' â†’ ' + r.cantidad + ' ' + r.unidad + ' por canasta');
  });
  
  Logger.log('\nâ•â•â•â•â•â•â•â• INGRESOS â•â•â•â•â•â•â•â•');
  if (ingresos.length === 0) Logger.log('  (vacÃ­o)');
  ingresos.forEach(i => {
    Logger.log('  ' + i.producto + ' â†’ ingresado: ' + i.cantidad + ' ' + i.unidad);
  });
  
  Logger.log('\nâ•â•â•â•â•â•â•â• ARMADOS â•â•â•â•â•â•â•â•');
  Logger.log('  Total canastas armadas: ' + armados.reduce((s,a) => s + Number(a.cantidad||0), 0));
  
  Logger.log('\nâ•â•â•â•â•â•â•â• STOCK CALCULADO â•â•â•â•â•â•â•â•');
  stock.forEach(s => {
    Logger.log('  ' + s.producto + 
               ' | stock: ' + s.stock + 
               ' | receta necesita: ' + (receta.find(r => r.producto === s.producto)?.cantidad || '?') + 
               ' por canasta | canastas posibles: ' + Math.floor(s.stock / (receta.find(r => r.producto === s.producto)?.cantidad || 1)));
  });
  
  // Calcular el mÃ¡ximo real
  const maxArmables = stock.map(s => {
    const r = receta.find(x => x.producto === s.producto);
    const porCanasta = r ? Number(r.cantidad) : 1;
    return Math.floor(s.stock / porCanasta);
  });
  
  Logger.log('\nâ•â•â•â•â•â•â•â• RESULTADO FINAL â•â•â•â•â•â•â•â•');
  Logger.log('  Canastas mÃ¡ximas armables: ' + Math.min(...maxArmables));
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ðŸš€ INTEGRACIÃ“N AZURE SQL - Sistema RL v3.0
// Funciones para sincronizar atenciones con Azure SQL Database
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * EnvÃ­a una atenciÃ³n a Azure SQL Database vÃ­a Azure Functions
 * Esta funciÃ³n es NO BLOQUEANTE: si falla, no afecta el flujo principal
 * El sistema sigue funcionando con Sheets como antes
 * 
 * @param {Object} atencionData - Datos de la atenciÃ³n
 * @returns {Object} - { success: bool, azureId: int, error: string }
 */
function saveAtencionAzure(atencionData) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('AZURE_API_URL');
    const apiKey = props.getProperty('AZURE_API_KEY');
    
    // ValidaciÃ³n: si no hay configuraciÃ³n, saltar silenciosamente
    if (!apiUrl || !apiKey) {
      console.log('âš ï¸ Azure API no configurada en propiedades, saltando...');
      return { success: false, skipped: true };
    }
    
    // Preparar payload con valores por defecto
    const payload = {
      nro: atencionData.nro || null,
      fecha_atencion: atencionData.fecha_atencion || null,
      hora_inicio: atencionData.hora_inicio || '',
      hora_termino: atencionData.hora_termino || '',
      nro_semana: atencionData.nro_semana || null,
      mes: atencionData.mes || null,
      anio: atencionData.anio || null,
      dni: atencionData.dni || '',
      nombre: atencionData.nombre || '',
      sexo: atencionData.sexo || '',
      fecha_inicio_periodo: atencionData.fecha_inicio_periodo || null,
      empresa: atencionData.empresa || '',
      fundo: atencionData.fundo || '',
      cargo: atencionData.cargo || '',
      ruta: atencionData.ruta || '',
      codigo: atencionData.codigo || '',
      fundo_actual: atencionData.fundo_actual || '',
      celular: atencionData.celular || '',
      supervisor: atencionData.supervisor || '',
      detalle_documento: atencionData.detalle_documento || '',
      fecha_inicio_doc: atencionData.fecha_inicio_doc || null,
      fecha_termino_doc: atencionData.fecha_termino_doc || null,
      dias_transcurridos: atencionData.dias_transcurridos || 0,
      responsable_recepcion: atencionData.responsable_recepcion || '',
      observaciones: atencionData.observaciones || '',
      estado: atencionData.estado || 'EN PROCESO',
      usuario_sistema: atencionData.usuario_sistema || ''
    };
    
    // ValidaciÃ³n mÃ­nima
    if (!payload.dni || !payload.nombre) {
      console.error('âš ï¸ Faltan campos requeridos: dni o nombre');
      return { success: false, error: 'Faltan campos requeridos' };
    }
    
    // Llamar a la API de Azure
    const url = apiUrl + '/atenciones';
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-functions-key': apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    console.log('ðŸš€ Enviando atenciÃ³n a Azure SQL para DNI:', payload.dni);
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(url, options);
    const elapsed = new Date().getTime() - startTime;
    
    const code = response.getResponseCode();
    const text = response.getContentText();
    
    if (code === 201 || code === 200) {
      const body = JSON.parse(text);
      console.log('âœ… Azure SQL OK - ID:', body.id, '- Tiempo:', elapsed + 'ms');
      return { success: true, azureId: body.id, elapsed: elapsed };
    } else {
      console.error('âš ï¸ Azure respondiÃ³ con cÃ³digo:', code, '- Respuesta:', text);
      return { success: false, error: 'HTTP ' + code, body: text };
    }
  } catch (e) {
    console.error('âŒ ExcepciÃ³n al llamar Azure:', e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Lista atenciones desde Azure SQL (mÃ¡s rÃ¡pido que Sheets)
 * @param {Object} filtros - { supervisor, empresa, desde, hasta, dni, estado, limite, pagina }
 * @returns {Object} - { success, data, total }
 */
function listAtencionesAzure(filtros) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('AZURE_API_URL');
    const apiKey = props.getProperty('AZURE_API_KEY');
    
    if (!apiUrl || !apiKey) {
      return { success: false, error: 'Azure no configurado' };
    }
    
    // Construir query string
    const params = [];
    if (filtros) {
      if (filtros.supervisor) params.push('supervisor=' + encodeURIComponent(filtros.supervisor));
      if (filtros.empresa)    params.push('empresa=' + encodeURIComponent(filtros.empresa));
      if (filtros.desde)      params.push('desde=' + encodeURIComponent(filtros.desde));
      if (filtros.hasta)      params.push('hasta=' + encodeURIComponent(filtros.hasta));
      if (filtros.dni)        params.push('dni=' + encodeURIComponent(filtros.dni));
      if (filtros.estado)     params.push('estado=' + encodeURIComponent(filtros.estado));
      if (filtros.limite)     params.push('limite=' + filtros.limite);
      if (filtros.pagina)     params.push('pagina=' + filtros.pagina);
    }
    
    const queryString = params.length > 0 ? '?' + params.join('&') : '';
    const url = apiUrl + '/atenciones' + queryString;
    
    const options = {
      method: 'get',
      headers: { 'x-functions-key': apiKey },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      console.error('âš ï¸ Azure GET fallÃ³ con cÃ³digo:', code);
      return { success: false, error: 'HTTP ' + code };
    }
  } catch (e) {
    console.error('âŒ ExcepciÃ³n al consultar Azure:', e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * ðŸ§ª FUNCIÃ“N DE PRUEBA - Verifica que la integraciÃ³n con Azure funcione
 * Ejecutar manualmente desde el editor de Apps Script
 */
function testAzureIntegration() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª TEST DE INTEGRACIÃ“N AZURE SQL');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  // Test 1: Verificar propiedades
  console.log('\nðŸ“‹ Test 1: Verificar configuraciÃ³n');
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('AZURE_API_URL');
  const apiKey = props.getProperty('AZURE_API_KEY');
  console.log('AZURE_API_URL:', apiUrl ? 'âœ… OK' : 'âŒ MISSING');
  console.log('AZURE_API_KEY:', apiKey ? 'âœ… OK (length=' + apiKey.length + ')' : 'âŒ MISSING');
  
  if (!apiUrl || !apiKey) {
    console.error('âŒ FAIL: Configurar propiedades primero');
    return;
  }
  
  // Test 2: GET (listar atenciones existentes)
  console.log('\nðŸ“‹ Test 2: GET /api/atenciones (listar)');
  const listResult = listAtencionesAzure({ limite: 5 });
  console.log('Resultado:', JSON.stringify(listResult, null, 2));
  
  if (!listResult.success) {
    console.error('âŒ FAIL: GET no funcionÃ³');
    return;
  }
  console.log('âœ… GET OK - Total atenciones en Azure:', listResult.total);
  
  // Test 3: POST (crear atenciÃ³n de prueba)
  console.log('\nðŸ“‹ Test 3: POST /api/atenciones (crear)');
  const testAtencion = {
    dni: '88888888',
    nombre: 'TEST APPS SCRIPT - ' + new Date().toISOString(),
    empresa: 'VERFRUT',
    supervisor: 'jtimoteo',
    estado: 'EN PROCESO',
    fecha_atencion: Utilities.formatDate(new Date(), 'GMT-5', 'yyyy-MM-dd'),
    detalle_documento: 'Test desde Apps Script',
    observaciones: 'VerificaciÃ³n de integraciÃ³n Azure'
  };
  
  const createResult = saveAtencionAzure(testAtencion);
  console.log('Resultado:', JSON.stringify(createResult, null, 2));
  
  if (!createResult.success) {
    console.error('âŒ FAIL: POST no funcionÃ³');
    return;
  }
  console.log('âœ… POST OK - Azure ID:', createResult.azureId);
  
  // Resumen
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸŽ‰ INTEGRACIÃ“N AZURE SQL: FUNCIONANDO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('âœ… ConfiguraciÃ³n OK');
  console.log('âœ… GET funciona');
  console.log('âœ… POST funciona');
  console.log('\nListo para integrar con saveAtencion() principal');
}
/**
 * ðŸ§ª TEST: Probar saveAtencion completo (Sheets + Firebase + Azure)
 */
function testSaveAtencionCompleto() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª TEST: saveAtencion COMPLETO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  const testData = {
    dni: '77777777',
    nombre: 'TEST INTEGRACION COMPLETA - ' + Utilities.formatDate(new Date(), 'GMT-5', 'HH:mm:ss'),
    sexo: 'M',
    empresa: 'VERFRUT',
    fundo: 'TEST',
    cargo: 'TEST',
    supervisor: 'jtimoteo',
    detalle_documento: 'Test integracion Sheets + Firebase + Azure',
    observaciones: 'Si todo funciona, este registro debe estar en los 3 lugares',
    estado: 'EN PROCESO',
    usuario_sistema: 'jtimoteo'
  };
  
  console.log('ðŸ“¤ Enviando atenciÃ³n de prueba...');
  const result = saveAtencion(testData);
  
  console.log('\nðŸ“¥ Resultado:');
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\nðŸ“Š VerificaciÃ³n:');
  console.log('âœ… Sheets - Fila #' + result.nro + ' en hoja "' + result.hoja + '"');
  console.log('âœ… Firebase - actualizado (ver consola Firebase)');
  
  if (result.azure && result.azure.synced) {
    console.log('âœ… Azure SQL - ID: ' + result.azure.id);
    console.log('\nðŸŽ‰ INTEGRACIÃ“N 100% FUNCIONAL');
  } else {
    console.log('âš ï¸ Azure SQL - NO se sincronizÃ³');
    console.log('   Verificar logs anteriores para ver el error');
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ðŸš€ MIGRACIÃ“N MASIVA DE HISTÃ“RICOS A AZURE SQL
// Migra atenciones desde Google Sheets a Azure SQL en lotes
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const MESES_TEXTO_A_NUMERO = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
  'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
  'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

/**
 * Convierte texto del mes a nÃºmero
 */
function convertirMes(mesTexto) {
  if (!mesTexto) return null;
  if (typeof mesTexto === 'number') return mesTexto;
  const texto = String(mesTexto).toLowerCase().trim();
  return MESES_TEXTO_A_NUMERO[texto] || null;
}

/**
 * Convierte una fecha a formato YYYY-MM-DD
 */
function fechaParaAzure(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return Utilities.formatDate(valor, 'GMT-5', 'yyyy-MM-dd');
  }
  if (typeof valor === 'string') {
    const trimmed = valor.trim();
    if (!trimmed) return null;
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }
  }
  return null;
}

/**
 * Convierte una hora a string HH:mm
 */
function horaParaAzure(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, 'GMT-5', 'HH:mm');
  }
  if (typeof valor === 'string') {
    return valor.trim().substring(0, 8);
  }
  return String(valor);
}

/**
 * Convierte una fila del Sheet a objeto Azure
 */
function filaAObjetoAzure(fila) {
  return {
    nro: parseInt(fila[0]) || null,
    fecha_atencion: fechaParaAzure(fila[1]),
    hora_inicio: horaParaAzure(fila[2]),
    hora_termino: horaParaAzure(fila[3]),
    nro_semana: parseInt(fila[4]) || null,
    mes: convertirMes(fila[5]),
    anio: parseInt(fila[6]) || null,
    dni: String(fila[7] || '').trim(),
    nombre: String(fila[8] || '').trim(),
    sexo: String(fila[9] || '').trim(),
    fecha_inicio_periodo: fechaParaAzure(fila[10]),
    empresa: String(fila[11] || '').trim(),
    fundo: String(fila[12] || '').trim(),
    cargo: String(fila[13] || '').trim(),
    ruta: String(fila[14] || '').trim(),
    codigo: String(fila[15] || '').trim(),
    fundo_actual: String(fila[16] || '').trim(),
    celular: String(fila[17] || '').trim(),
    supervisor: String(fila[18] || '').trim(),
    detalle_documento: String(fila[19] || '').trim(),
    fecha_inicio_doc: fechaParaAzure(fila[20]),
    fecha_termino_doc: fechaParaAzure(fila[21]),
    dias_transcurridos: parseInt(fila[22]) || 0,
    responsable_recepcion: String(fila[23] || '').trim(),
    observaciones: String(fila[24] || '').trim(),
    estado: String(fila[25] || 'EN PROCESO').trim(),
    usuario_sistema: String(fila[27] || '').trim()
  };
}

/**
 * EnvÃ­a un lote a Azure
 */
function enviarLoteAzure(atenciones) {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('AZURE_API_URL');
  const apiKey = props.getProperty('AZURE_API_KEY');
  
  const url = apiUrl + '/atenciones/batch';
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-functions-key': apiKey },
    payload: JSON.stringify({ atenciones: atenciones }),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      return { success: false, error: 'HTTP ' + code, body: response.getContentText() };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * ðŸš€ MIGRA UN AÃ‘O COMPLETO desde Sheets a Azure SQL
 * Maneja timeouts de Apps Script (6 min) con reanudaciÃ³n automÃ¡tica
 */
function migrarAnio(anio, fechaTope) {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸš€ MIGRACIÃ“N AÃ‘O ' + anio);
  if (fechaTope) console.log('   Hasta antes de: ' + fechaTope);
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('BB. DE REGISTROS ' + anio);
  
  if (!sheet) {
    console.error('âŒ No existe hoja "BB. DE REGISTROS ' + anio + '"');
    return;
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(28, sheet.getLastColumn());
  const totalDataRows = lastRow - 1;
  
  console.log('ðŸ“Š Hoja: BB. DE REGISTROS ' + anio);
  console.log('   Total filas datos: ' + totalDataRows);
  
  if (totalDataRows === 0) {
    console.log('âš ï¸ Hoja vacÃ­a, nada que migrar');
    return;
  }
  
  const props = PropertiesService.getScriptProperties();
  const progresoKey = 'MIGRACION_' + anio;
  const progresoStr = props.getProperty(progresoKey);
  let progreso = progresoStr ? JSON.parse(progresoStr) : {
    total: totalDataRows,
    procesadas: 0,
    insertadas: 0,
    fallidas: 0,
    omitidas: 0,
    ultimaFila: 1,
    completado: false,
    fechaTope: fechaTope || null,
    iniciado: new Date().toISOString()
  };
  
  if (progreso.completado) {
    console.log('âœ… AÃ±o ' + anio + ' YA estÃ¡ migrado');
    console.log('   Insertadas: ' + progreso.insertadas);
    console.log('   Si quieres re-migrar: resetearProgresoMigracion(' + anio + ')');
    return;
  }
  
  console.log('   Progreso previo:');
  console.log('   - Procesadas: ' + progreso.procesadas + '/' + progreso.total);
  console.log('   - Insertadas: ' + progreso.insertadas);
  console.log('   - Ãšltima fila: ' + progreso.ultimaFila);
  
  const startTime = new Date().getTime();
  const TIMEOUT_MARGIN = 4.5 * 60 * 1000;
  const LOTE_SIZE = 50;
  
  let filaActual = progreso.ultimaFila + 1;
  
  while (filaActual <= lastRow) {
    const elapsed = new Date().getTime() - startTime;
    if (elapsed > TIMEOUT_MARGIN) {
      console.log('\nâ±ï¸ TIMEOUT cercano, guardando progreso...');
      progreso.ultimaFila = filaActual - 1;
      props.setProperty(progresoKey, JSON.stringify(progreso));
      console.log('ðŸ’¾ Progreso guardado en fila: ' + progreso.ultimaFila);
      console.log('ðŸ”„ EJECUTAR DE NUEVO migrar' + anio + '() para continuar');
      return;
    }
    
    const numFilas = Math.min(LOTE_SIZE, lastRow - filaActual + 1);
    const datos = sheet.getRange(filaActual, 1, numFilas, lastCol).getValues();
    
    const atenciones = [];
    let omitidasLote = 0;
    for (const fila of datos) {
      const obj = filaAObjetoAzure(fila);
      
      if (fechaTope && obj.fecha_atencion && obj.fecha_atencion >= fechaTope) {
        omitidasLote++;
        continue;
      }
      
      if (!obj.dni || !obj.nombre) {
        omitidasLote++;
        continue;
      }
      atenciones.push(obj);
    }
    
    if (atenciones.length > 0) {
      const result = enviarLoteAzure(atenciones);
      
      if (result.success) {
        progreso.insertadas += result.inserted || 0;
        progreso.fallidas += result.failed || 0;
        if (result.errors && result.errors.length > 0) {
          console.log('âš ï¸ Errores en lote (filas ' + filaActual + '-' + (filaActual + numFilas - 1) + '):');
          result.errors.slice(0, 3).forEach(e => console.log('   ' + JSON.stringify(e)));
        }
      } else {
        console.error('âŒ FALLO en lote (filas ' + filaActual + '-' + (filaActual + numFilas - 1) + '):');
        console.error(JSON.stringify(result));
        progreso.fallidas += atenciones.length;
      }
    }
    
    progreso.omitidas += omitidasLote;
    progreso.procesadas += numFilas;
    filaActual += numFilas;
    
    if (progreso.procesadas % 250 === 0 || filaActual > lastRow) {
      const pct = Math.round(progreso.procesadas / progreso.total * 100);
      console.log('ðŸ“Š ' + pct + '% - Procesadas: ' + progreso.procesadas + '/' + progreso.total + ' | Insertadas: ' + progreso.insertadas + ' | Tiempo: ' + Math.round((new Date().getTime() - startTime) / 1000) + 's');
    }
    
    if (progreso.procesadas % 500 === 0) {
      progreso.ultimaFila = filaActual - 1;
      props.setProperty(progresoKey, JSON.stringify(progreso));
    }
  }
  
  progreso.completado = true;
  progreso.ultimaFila = lastRow;
  progreso.terminado = new Date().toISOString();
  props.setProperty(progresoKey, JSON.stringify(progreso));
  
  const totalElapsed = (new Date().getTime() - startTime) / 1000;
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('âœ… MIGRACIÃ“N AÃ‘O ' + anio + ' COMPLETADA');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('Total filas:   ' + progreso.total);
  console.log('Procesadas:    ' + progreso.procesadas);
  console.log('Insertadas:    ' + progreso.insertadas);
  console.log('Omitidas:      ' + progreso.omitidas);
  console.log('Fallidas:      ' + progreso.fallidas);
  console.log('Tiempo total:  ' + Math.round(totalElapsed) + ' segundos');
  console.log('Velocidad:     ' + Math.round(progreso.insertadas / totalElapsed) + ' inserts/seg');
}

/**
 * ðŸš€ Migrar aÃ±o 2024 completo
 */
function migrar2024() {
  migrarAnio(2024);
}

/**
 * ðŸš€ Migrar aÃ±o 2025 completo
 */
function migrar2025() {
  migrarAnio(2025);
}

/**
 * ðŸš€ Migrar 2026 hasta ayer (excluye atenciones de hoy)
 */
function migrar2026() {
  const hoy = Utilities.formatDate(new Date(), 'GMT-5', 'yyyy-MM-dd');
  console.log('ðŸ—“ï¸ Migrando 2026 con fecha < ' + hoy);
  migrarAnio(2026, hoy);
}

/**
 * ðŸ“‹ Ver progreso de todas las migraciones
 */
function verProgresoMigracion() {
  const props = PropertiesService.getScriptProperties();
  const anios = [2024, 2025, 2026];
  
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ“Š PROGRESO DE MIGRACIÃ“N');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  for (const anio of anios) {
    const progreso = props.getProperty('MIGRACION_' + anio);
    if (progreso) {
      const p = JSON.parse(progreso);
      const pct = Math.round(p.procesadas / p.total * 100);
      console.log('\nðŸ“… AÃ±o ' + anio + ':');
      console.log('   Estado:      ' + (p.completado ? 'âœ… COMPLETADO' : 'â³ EN PROGRESO ' + pct + '%'));
      console.log('   Total:       ' + p.total);
      console.log('   Procesadas:  ' + p.procesadas);
      console.log('   Insertadas:  ' + p.insertadas);
      console.log('   Omitidas:    ' + p.omitidas);
      console.log('   Fallidas:    ' + p.fallidas);
      console.log('   Ãšltima fila: ' + p.ultimaFila);
    } else {
      console.log('\nðŸ“… AÃ±o ' + anio + ': Sin iniciar');
    }
  }
}

/**
 * ðŸ”„ Resetea progreso de un aÃ±o (para re-migrar)
 */
function resetearProgresoMigracion(anio) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('MIGRACION_' + anio);
  console.log('âœ… Progreso del aÃ±o ' + anio + ' reseteado');
}

/**
 * ðŸ”„ Resetear progreso de TODOS los aÃ±os
 */
function resetearTodoElProgreso() {
  const props = PropertiesService.getScriptProperties();
  const anios = [2024, 2025, 2026];
  
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ”„ RESETEANDO PROGRESO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  for (const anio of anios) {
    const key = 'MIGRACION_' + anio;
    const tenia = props.getProperty(key);
    if (tenia) {
      props.deleteProperty(key);
      console.log('âœ… Borrado: MIGRACION_' + anio);
    } else {
      console.log('â„¹ï¸ Sin progreso previo: MIGRACION_' + anio);
    }
  }
  
  console.log('\nâœ… TODO LIMPIO - Listo para migrar desde cero');
  console.log('\nðŸ‘‰ SIGUIENTE PASO: Ejecutar migrar2024');
}
/**
 * ðŸ§ª TEST: Verificar que el endpoint stats de Azure funciona
 */
function testStatsAzure() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª TEST endpoint atenciones/stats');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  try {
    const startTime = new Date().getTime();
    const result = getEstadisticasAzure({});
    const elapsed = new Date().getTime() - startTime;
    
    console.log('\nðŸ“Š RESULTADO:');
    console.log('Success:', result.success);
    console.log('Tiempo Apps Scriptâ†’Azure:', elapsed, 'ms');
    console.log('Tiempo SQL Azure:', result.elapsed, 'ms');
    console.log('Fuente:', result.fuente);
    
    if (result.success && result.resumen_global) {
      console.log('\nðŸ“‹ RESUMEN GLOBAL:');
      console.log('Total:', result.resumen_global.total);
      console.log('Hoy:', result.resumen_global.hoy);
      console.log('Este mes:', result.resumen_global.este_mes);
      console.log('En proceso:', result.resumen_global.en_proceso);
      console.log('Finalizados:', result.resumen_global.finalizados);
      
      console.log('\nðŸ“… POR AÃ‘O:');
      console.log(JSON.stringify(result.por_anio, null, 2));
      
      console.log('\nðŸ¢ POR EMPRESA:');
      console.log(JSON.stringify(result.por_empresa, null, 2));
    } else {
      console.log('âŒ Error:', result.error);
    }
    
    console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('âœ… TEST COMPLETADO');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  } catch (e) {
    console.error('âŒ ExcepciÃ³n:', e.toString());
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ðŸš€ ENDPOINTS AZURE SQL - getEstadisticasAzure + getPreloadOptimizado
// FASE 7.5 - OptimizaciÃ³n del preload con stats SQL agregadas
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Helper: URL base de Azure
 */
function _azureBaseUrl_() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('AZURE_API_URL');
  if (!apiUrl) throw new Error('AZURE_API_URL no configurada');
  return apiUrl;
}

/**
 * Helper: Headers de autenticaciÃ³n Azure
 */
function _azureAuthHeaders_() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('AZURE_API_KEY');
  if (!apiKey) throw new Error('AZURE_API_KEY no configurada');
  return { 'x-functions-key': apiKey };
}

/**
 * ðŸš€ Obtiene estadÃ­sticas agregadas desde Azure SQL
 * Llama al endpoint /api/atenciones/stats que ejecuta SQL agregado
 * 
 * @param {Object} filtros - { anio, empresa }
 * @returns {Object} - { success, resumen_global, por_mes, por_anio, por_empresa, por_estado, por_supervisor, por_tipo, elapsed, fuente }
 */
function getEstadisticasAzure(filtros) {
  filtros = filtros || {};
  
  try {
    const baseUrl = _azureBaseUrl_();
    const headers = _azureAuthHeaders_();
    
    // Construir query string
    const params = [];
    if (filtros.anio)    params.push('anio=' + encodeURIComponent(filtros.anio));
    if (filtros.empresa) params.push('empresa=' + encodeURIComponent(filtros.empresa));
    const queryString = params.length > 0 ? '?' + params.join('&') : '';
    
    const url = baseUrl + '/atenciones/stats' + queryString;
    const options = {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true
    };
    
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(url, options);
    const elapsed = new Date().getTime() - startTime;
    const code = response.getResponseCode();
    
    if (code === 200) {
      const data = JSON.parse(response.getContentText());
      data.tiempo_apps_script = elapsed;
      return data;
    } else {
      console.error('Stats Azure error:', code, response.getContentText());
      return { success: false, error: 'HTTP ' + code };
    }
  } catch (e) {
    console.error('Stats Azure exception:', e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Mapea respuesta de stats Azure al formato que espera el frontend
 */
function _statsAzureToFrontend_(az) {
  if (!az || !az.success || !az.resumen_global) return null;
  
  const r = az.resumen_global;
  return {
    hoy:         r.hoy || 0,
    mes:         r.este_mes || 0,
    anio:        r.este_anio || r.total || 0,
    total:       r.total || 0,
    enProceso:   r.en_proceso || 0,
    finalizados: r.finalizados || 0,
    porMes:      az.por_mes || {},
    porTipo:     az.por_tipo || {},
    porEstado:   az.por_estado || {}
  };
}

/**
 * ðŸš€ VersiÃ³n optimizada de getPreload usando Azure SQL para stats
 * - Stats vienen de Azure (rÃ¡pido)
 * - Visitas, casos, etc. siguen viniendo de Sheets (sin cambios)
 * - Si Azure falla, fallback a getPreload original
 */
function getPreloadOptimizado(p) {
  const startTime = new Date().getTime();
  p = p || {};
  
  try {
    const cache = CacheService.getUserCache();
    const cacheKey = 'preload_opt_' + (p.usuario || '') + '_' + (p.rol || '');
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed._ts && (Date.now() - parsed._ts) < 5 * 60 * 1000) {
          return { success: true, data: parsed, fromCache: true };
        }
      } catch(e) {}
    }
    
    const rol = p.rol || '';
    const usuario = p.usuario || '';
    const empresa = p.empresa || '';
    const esAdmin = ['administrador','administrador 01','administrador 02','coordinador','jefa_rl'].includes(rol);
    
    // â”€â”€ Stats desde Azure (rÃ¡pido) â”€â”€
    let stats = null;
    let fuenteStats = 'AZURE';
    let tiempoStats = 0;
    
    const filtrosStats = {};
    if (empresa && empresa !== 'TODAS' && empresa !== 'AMBAS') {
      filtrosStats.empresa = empresa;
    }
    
    const statsAzure = getEstadisticasAzure(filtrosStats);
    
    if (statsAzure && statsAzure.success) {
      stats = _statsAzureToFrontend_(statsAzure);
      tiempoStats = statsAzure.tiempo_apps_script || 0;
    }
    
    // Fallback: si Azure fallÃ³, usar getEstadisticas de Sheets
    if (!stats) {
      console.log('âš ï¸ Azure stats fallÃ³, fallback a Sheets');
      try {
        const r = getEstadisticas(p);
        if (r.success) {
          stats = r.data;
          fuenteStats = 'SHEETS';
        }
      } catch(e) {
        console.error('getEstadisticas error:', e);
      }
    }
    
    // Si todo fallÃ³, fallback a getPreload original
    if (!stats) {
      console.log('âš ï¸ Stats fallÃ³ completo, usando getPreload original');
      return getPreload(p);
    }
    
    // â”€â”€ Atenciones: solo para supervisores en preload â”€â”€
    let atenciones = [];
    if (!esAdmin) {
      try { const d = getAtenciones(p); if (d.success) atenciones = d.data; } catch(e){}
    }
    
    // â”€â”€ Visitas â”€â”€
    let visitas = [];
    try { const d = getVisitas(p); if (d.success) visitas = d.data; } catch(e){}
    
    // â”€â”€ Casos â”€â”€
    let casos = [];
    try { const d = getCasos(p); if (d.success) casos = d.data; } catch(e){}
    
    // â”€â”€ Fusiones â”€â”€
    let fusiones = [];
    try { const d = getFusiones(p); if (d.success) fusiones = d.data; } catch(e){}
    
    // â”€â”€ Solicitudes (solo admins) â”€â”€
    let solicitudes = [];
    try { if (esAdmin) { const d = getSolicitudes(p); if (d.success) solicitudes = d.data; } } catch(e){}
    
    // â”€â”€ Supervisores â”€â”€
    let supervisores = [];
    try { const d = getSupervisores(); if (d.success) supervisores = d.data; } catch(e){}
    
    // â”€â”€ Usuarios (solo admin puro) â”€â”€
    let usuarios = [];
    try { if (rol === 'administrador') { const d = getUsuarios(); if (d.success) usuarios = d.data; } } catch(e){}
    
    const tiempoTotal = new Date().getTime() - startTime;
    
    const result = {
      atenciones: atenciones,
      stats: stats,
      visitas: visitas,
      casos: casos,
      fusiones: fusiones,
      solicitudes: solicitudes,
      estadisticasAdmin: null,
      usuarios: usuarios,
      supervisores: supervisores,
      timestamp: new Date().getTime(),
      _ts: Date.now(),
      // Metadata FASE 7.5
      fuente_atenciones: fuenteStats,
      tiempo_atenciones_ms: tiempoStats,
      tiempo_total_ms: tiempoTotal
    };
    
    // Guardar en cache
    try { cache.put(cacheKey, JSON.stringify(result), 300); } catch(e){}
    
    return { success: true, data: result };
    
  } catch(e) {
    console.error('getPreloadOptimizado error:', e.toString());
    // Fallback completo
    return getPreload(p);
  }
}
/**
 * ðŸš€ VersiÃ³n optimizada de getAtenciones usando Azure SQL
 * Si Azure responde, usa Azure (rÃ¡pido)
 * Si Azure falla, fallback a getAtenciones original (Sheets)
 */
function getAtencionesOptimizado(p) {
  p = p || {};

  // â­ SEGURIDAD: supervisores solo ven sus propias atenciones (defense in depth)
  const ROLES_ADMIN = ['administrador','administrador 01','administrador 02','coordinador','jefa_rl'];
  const rolNorm = String(p.rol || '').trim().toLowerCase();
  const esAdmin = ROLES_ADMIN.indexOf(rolNorm) >= 0;
  if (!esAdmin) {
    const nombreSup = String(p.nombre || p.usuario || '').trim();
    if (!nombreSup) return { success: false, error: 'No autorizado: falta identificaciÃ³n de usuario' };
    p.supervisor = nombreSup; // forzar filtro independientemente de lo que mande el frontend
  }

  try {
    // Intentar Azure primero
    const filtros = {};
    if (p.dni)        filtros.dni = p.dni;
    if (p.empresa && p.empresa !== 'AMBAS') filtros.empresa = p.empresa;
    if (p.supervisor) filtros.supervisor = p.supervisor;
    if (p.limite)     filtros.limite = p.limite;
    if (p.pagina)     filtros.pagina = p.pagina;
    
    const startTime = new Date().getTime();
    const result = listAtencionesAzure(filtros);
    const elapsed = new Date().getTime() - startTime;
    
    if (result && result.success && result.data) {
      // Mapear datos de Azure al formato esperado por el frontend
      const dataMapeada = result.data.map(function(a) {
        return {
          nro: a.nro || a.id,
          fecha_atencion: a.fecha_atencion ? String(a.fecha_atencion).substring(0, 10) : '',
          hora_inicio: a.hora_inicio || '',
          hora_termino: a.hora_termino || '',
          nro_semana: a.nro_semana || '',
          mes: a.mes || '',
          anio: a.anio || '',
          dni: a.dni || '',
          nombre: a.nombre || '',
          sexo: a.sexo || '',
          fecha_inicio_periodo: a.fecha_inicio_periodo ? String(a.fecha_inicio_periodo).substring(0, 10) : '',
          empresa: a.empresa || '',
          fundo: a.fundo || '',
          cargo: a.cargo || '',
          ruta: a.ruta || '',
          codigo: a.codigo || '',
          fundo_actual: a.fundo_actual || '',
          celular: a.celular || '',
          supervisor: a.supervisor || '',
          detalle_documento: a.detalle_documento || '',
          fecha_inicio_doc: a.fecha_inicio_doc ? String(a.fecha_inicio_doc).substring(0, 10) : '',
          fecha_termino_doc: a.fecha_termino_doc ? String(a.fecha_termino_doc).substring(0, 10) : '',
          dias_transcurridos: a.dias_transcurridos || 0,
          responsable_recepcion: a.responsable_recepcion || '',
          observaciones: a.observaciones || '',
          estado: a.estado || 'EN PROCESO',
          fecha_registro: a.fecha_creacion || a.fecha_registro || '',
          usuario_sistema: a.usuario_sistema || ''
        };
      });
      
      console.log('âœ… getAtencionesOptimizado: Azure OK - ' + dataMapeada.length + ' resultados en ' + elapsed + 'ms');
      return {
        success: true,
        data: dataMapeada,
        total: result.total,
        fuente: 'AZURE',
        tiempo: elapsed
      };
    }
  } catch (e) {
    console.error('getAtencionesOptimizado Azure error:', e.toString());
  }
  
  // Fallback: usar getAtenciones original (Sheets)
  console.log('âš ï¸ Fallback a Sheets para getAtenciones');
  return getAtenciones(p);
}
/**
 * ðŸ§ª DIAGNÃ“STICO: Comparar lo que tiene Sheets vs lo que devuelve getVisitas
 */
function testVisitaCompletaDiagnostico() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ws = ss.getSheetByName('Visitas_Campo');
  
  if (!ws) {
    console.log('âŒ Hoja Visitas_Campo no existe');
    return;
  }
  
  const lastRow = ws.getLastRow();
  console.log('ðŸ“Š Total filas en hoja: ' + lastRow);
  
  if (lastRow < 2) return;
  
  // ÃšLTIMA visita
  const ultimaFila = ws.getRange(lastRow, 1, 1, ws.getLastColumn()).getValues()[0];
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ“‹ LO QUE HAY EN GOOGLE SHEETS:');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('Nro: ' + ultimaFila[0]);
  console.log('Fecha registro: ' + ultimaFila[1]);
  console.log('Empresa: ' + ultimaFila[2]);
  console.log('Supervisor: ' + ultimaFila[3]);
  console.log('DNI: ' + ultimaFila[4]);
  console.log('Correo: ' + ultimaFila[5]);
  console.log('Fundo: ' + ultimaFila[6]);
  console.log('Punto: ' + ultimaFila[7]);
  console.log('Fecha inicio: ' + ultimaFila[8]);
  console.log('Fecha fin: ' + ultimaFila[9]);
  console.log('Semana: ' + ultimaFila[10]);
  console.log('Fecha informe: ' + ultimaFila[11]);
  console.log('Para: ' + ultimaFila[12]);
  console.log('Asunto: ' + ultimaFila[13]);
  console.log('Desarrollo: ' + (ultimaFila[14] ? 'TIENE (' + ultimaFila[14].length + ' chars)' : 'VACÃO'));
  console.log('Rutas: ' + (ultimaFila[15] ? 'TIENE' : 'VACÃO'));
  console.log('Acciones: ' + (ultimaFila[16] ? 'TIENE' : 'VACÃO'));
  console.log('Compromisos: ' + (ultimaFila[17] ? 'TIENE' : 'VACÃO'));
  console.log('Observaciones: ' + (ultimaFila[18] ? 'TIENE' : 'VACÃO'));
  console.log('Motivo: ' + (ultimaFila[19] || 'VACÃO'));
  console.log('Fotos: ' + (ultimaFila[20] || '0'));
  console.log('Estado: ' + ultimaFila[21]);
  console.log('Registrado por: ' + ultimaFila[22]);
  console.log('Enlace informe: ' + (ultimaFila[23] || 'VACÃO'));
  
  // Probar getVisitas
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ“¤ LO QUE DEVUELVE getVisitas AL FRONTEND:');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  const result = getVisitas({});
  if (result.success && result.data.length > 0) {
    const ultima = result.data[result.data.length - 1];
    console.log('Campos devueltos:', Object.keys(ultima).length);
    console.log(JSON.stringify(ultima, null, 2));
    
    console.log('\nâš ï¸ CAMPOS QUE FALTAN (formulario los necesita):');
    const camposEsperados = ['correo', 'punto', 'fecha_inicio', 'fecha_fin',
                              'para', 'asunto', 'desarrollo', 'rutas', 
                              'acciones', 'compromisos', 'observaciones',
                              'motivo', 'fotos'];
    let faltan = [];
    camposEsperados.forEach(function(c) {
      if (ultima[c] === undefined || ultima[c] === null) {
        faltan.push(c);
      }
    });
    console.log('   Faltan: ' + faltan.join(', '));
    console.log('   Total que faltan: ' + faltan.length);
  }
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('âœ… DIAGNÃ“STICO COMPLETADO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
}
/**
 * ðŸ§ª TEST: Verificar que login devuelve cargo
 */
function testLoginCargo() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ws = ss.getSheetByName('Usuarios');
  const rows = ws.getDataRange().getValues();
  
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª VERIFICACIÃ“N COLUMNA CARGO');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('Total usuarios: ' + (rows.length - 1));
  console.log('Total columnas: ' + rows[0].length);
  console.log('');
  console.log('ðŸ“‹ ENCABEZADOS:');
  for (let i = 0; i < rows[0].length; i++) {
    console.log('  Columna ' + String.fromCharCode(65 + i) + ' (Ã­ndice ' + i + '): ' + rows[0][i]);
  }
  
  console.log('');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ‘¥ USUARIOS Y CARGOS:');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  let conCargo = 0;
  let sinCargo = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const usuario = String(rows[i][1] || '').trim();
    const nombre = String(rows[i][3] || '').trim();
    const cargo = String(rows[i][9] || '').trim();
    
    if (cargo) {
      conCargo++;
      console.log('âœ… ' + usuario + ' (' + nombre + ') â†’ ' + cargo);
    } else {
      sinCargo++;
      console.log('âŒ ' + usuario + ' (' + nombre + ') â†’ SIN CARGO');
    }
  }
  
  console.log('');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ“Š RESUMEN:');
  console.log('   Con cargo:  ' + conCargo);
  console.log('   Sin cargo:  ' + sinCargo);
  console.log('   Total:      ' + (conCargo + sinCargo));
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  if (sinCargo === 0) {
    console.log('ðŸŽ‰ Â¡TODOS los usuarios tienen su cargo asignado!');
    console.log('ðŸŽ¯ Listo para PASO 3: modificar saveVisita');
  } else {
    console.log('âš ï¸ Faltan ' + sinCargo + ' usuarios por asignar cargo');
    console.log('ðŸ”§ Ve a la hoja Usuarios y completa la columna J');
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ELIMINAR VISITA - Mover a hoja Visitas_Eliminadas
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
/**
 * Elimina una visita moviÃ©ndola a la hoja "Visitas_Eliminadas"
 * Solo admins autorizados pueden ejecutar esta funciÃ³n
 * 
 * @param {Object} d - {nro, usuario, motivo}
 * @returns {Object} - {success, mensaje} o {success:false, error}
 */
function eliminarVisita(d) {
  try {
    // â”€â”€ Validar permisos â”€â”€
    if (!d.usuario || !ADMINS_ELIMINAR_VISITA.includes(d.usuario)) {
      return { 
        success: false, 
        error: 'Sin permisos: solo administradores pueden eliminar visitas' 
      };
    }
    
    if (!d.nro) {
      return { success: false, error: 'Numero de visita requerido' };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const wsOrigen = ss.getSheetByName('Visitas_Campo');
    if (!wsOrigen) {
      return { success: false, error: 'Hoja Visitas_Campo no encontrada' };
    }
    
    // â”€â”€ Buscar la fila por nro â”€â”€
    const data = wsOrigen.getDataRange().getValues();
    const headers = data[0];
    let filaIdx = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(d.nro)) {
        filaIdx = i;
        break;
      }
    }
    
    if (filaIdx === -1) {
      return { success: false, error: 'Visita NÂ° ' + d.nro + ' no encontrada' };
    }
    
    const filaDatos = data[filaIdx];
    
    // â”€â”€ Verificar/crear hoja Visitas_Eliminadas â”€â”€
    let wsDestino = ss.getSheetByName('Visitas_Eliminadas');
    if (!wsDestino) {
      wsDestino = ss.insertSheet('Visitas_Eliminadas');
      // Copiar encabezados de origen + agregar 3 columnas
      const headersDestino = headers.concat(['Eliminado_por', 'Fecha_eliminacion', 'Motivo_eliminacion']);
      wsDestino.appendRow(headersDestino);
      // Formato: negrita en encabezados
      wsDestino.getRange(1, 1, 1, headersDestino.length).setFontWeight('bold');
    }
    
    // â”€â”€ Mover fila a hoja eliminadas â”€â”€
    const filaCompleta = filaDatos.concat([
      d.usuario,                                  // Eliminado_por
      new Date(),                                 // Fecha_eliminacion
      d.motivo || 'Sin motivo especificado'       // Motivo_eliminacion
    ]);
    wsDestino.appendRow(filaCompleta);
    
    // â”€â”€ Eliminar fila original â”€â”€
    // filaIdx es 0-based en array, pero deleteRow es 1-based
    // AdemÃ¡s sumamos 1 porque incluye encabezado
    wsOrigen.deleteRow(filaIdx + 1);
    
    // â”€â”€ Actualizar Firebase (refrescar contadores) â”€â”€
    try {
      if (typeof actualizarFirebaseModulos === 'function') {
        actualizarFirebaseModulos();
      }
    } catch(e) {
      Logger.log('Firebase update error (no crÃ­tico): ' + e);
    }
    
    Logger.log('âœ… Visita ' + d.nro + ' eliminada por ' + d.usuario);
    
    return { 
      success: true, 
      mensaje: 'Visita NÂ° ' + d.nro + ' archivada correctamente',
      eliminado_por: d.usuario,
      fecha: new Date().toISOString()
    };
    
  } catch(e) {
    Logger.log('âŒ Error eliminando visita: ' + e);
    return { 
      success: false, 
      error: 'Error: ' + e.toString() 
    };
  }
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ELIMINAR CASO - Mover a hoja Casos_Eliminados
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
/**
 * Elimina un caso moviÃ©ndolo a la hoja "Casos_Eliminados"
 * Solo admins autorizados (jtimoteo, ovilela, jchavez) pueden ejecutar
 * 
 * @param {Object} d - {nro, usuario, motivo}
 * @returns {Object} - {success, mensaje} o {success:false, error}
 */
function eliminarCaso(d) {
  try {
    // â”€â”€ Validar permisos â”€â”€
    if (!d.usuario || !ADMINS_ELIMINAR_CASO.includes(String(d.usuario).trim().toLowerCase())) {
      return { 
        success: false, 
        error: 'Sin permisos: solo administradores autorizados pueden eliminar casos' 
      };
    }
    
    if (!d.nro) {
      return { success: false, error: 'Numero de caso requerido' };
    }
    
    // â”€â”€ Validar motivo (mÃ­nimo 10 caracteres) â”€â”€
    const motivo = String(d.motivo || '').trim();
    if (motivo.length < 10) {
      return { 
        success: false, 
        error: 'El motivo es obligatorio y debe tener al menos 10 caracteres' 
      };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const wsOrigen = ss.getSheetByName('BD_Casos');
    if (!wsOrigen) {
      return { success: false, error: 'Hoja BD_Casos no encontrada' };
    }
    
    // â”€â”€ Buscar la fila por nro â”€â”€
    const data = wsOrigen.getDataRange().getValues();
    const headers = data[0];
    let filaIdx = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(d.nro)) {
        filaIdx = i;
        break;
      }
    }
    
    if (filaIdx === -1) {
      return { success: false, error: 'Caso NÂ° ' + d.nro + ' no encontrado' };
    }
    
    const filaDatos = data[filaIdx];
    
    // â”€â”€ Verificar/crear hoja Casos_Eliminados â”€â”€
    let wsDestino = ss.getSheetByName('Casos_Eliminados');
    if (!wsDestino) {
      wsDestino = ss.insertSheet('Casos_Eliminados');
      // Copiar encabezados de origen + agregar 3 columnas de auditorÃ­a
      const headersDestino = headers.concat(['Eliminado_por', 'Fecha_eliminacion', 'Motivo_eliminacion']);
      wsDestino.appendRow(headersDestino);
      wsDestino.getRange(1, 1, 1, headersDestino.length).setFontWeight('bold');
    }
    
    // â”€â”€ Mover fila a hoja eliminados â”€â”€
    const filaCompleta = filaDatos.concat([
      d.usuario,                                  // Eliminado_por
      new Date(),                                 // Fecha_eliminacion
      motivo                                      // Motivo_eliminacion (ya validado)
    ]);
    wsDestino.appendRow(filaCompleta);
    
    // â”€â”€ Eliminar fila original â”€â”€
    // filaIdx es 0-based en array, deleteRow es 1-based, +1 por header
    wsOrigen.deleteRow(filaIdx + 1);
    
    // â”€â”€ Actualizar Firebase (refrescar contadores) â”€â”€
    try {
      if (typeof actualizarFirebaseModulos === 'function') {
        actualizarFirebaseModulos();
      }
    } catch(e) {
      Logger.log('Firebase update error (no crÃ­tico): ' + e);
    }
    
    Logger.log('âœ… Caso ' + d.nro + ' eliminado por ' + d.usuario + ' - Motivo: ' + motivo);
    
    return { 
      success: true, 
      mensaje: 'Caso NÂ° ' + d.nro + ' archivado correctamente',
      eliminado_por: d.usuario,
      fecha: new Date().toISOString()
    };
    
  } catch(e) {
    Logger.log('âŒ Error eliminando caso: ' + e);
    return { 
      success: false, 
      error: 'Error: ' + e.toString() 
    };
  }
}
/**
 * ðŸ§ª TEST: Verificar permisos de eliminaciÃ³n
 */
function testEliminarVisitaPermisos() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª TEST PERMISOS ELIMINAR VISITA');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('Admins autorizados: ' + ADMINS_ELIMINAR_VISITA.join(', '));
  
  // Test 1: Usuario no autorizado
  const test1 = eliminarVisita({ nro: 999, usuario: 'azapata' });
  console.log('\nTest 1 (azapata): ' + JSON.stringify(test1));
  if (!test1.success && test1.error.includes('permisos')) {
    console.log('âœ… Correcto: rechaza no-admin');
  } else {
    console.log('âŒ Error: deberia rechazar');
  }
  
  // Test 2: Sin nro
  const test2 = eliminarVisita({ usuario: 'jtimoteo' });
  console.log('\nTest 2 (sin nro): ' + JSON.stringify(test2));
  if (!test2.success && test2.error.includes('Numero')) {
    console.log('âœ… Correcto: pide numero');
  } else {
    console.log('âŒ Error: deberÃ­a pedir nro');
  }
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('âœ… TESTS COMPLETADOS');
  console.log('Para probar eliminaciÃ³n real, usar el dashboard');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MIGRACIÃ“N: Agregar columnas SECTOR y SUPERVISOR a Inventario
//  Ejecutar UNA VEZ desde el editor de Apps Script
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function invMigrarColumnasSectorSupervisor() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const hI = ss.getSheetByName(INV_SH_INGRESOS);
  if (hI) {
    const headers = hI.getRange(1, 1, 1, Math.max(14, hI.getLastColumn())).getValues()[0];
    if (!headers[12]) hI.getRange(1, 13).setValue('SECTOR');
    if (!headers[13]) hI.getRange(1, 14).setValue('SUPERVISOR');
    hI.getRange('M1:N1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    Logger.log('â†ª INV_Ingresos + SECTOR (col 13) + SUPERVISOR (col 14)');
  }
  
  const hA = ss.getSheetByName(INV_SH_ARMADOS);
  if (hA) {
    const headers = hA.getRange(1, 1, 1, Math.max(9, hA.getLastColumn())).getValues()[0];
    if (!headers[7]) hA.getRange(1, 8).setValue('SECTOR');
    if (!headers[8]) hA.getRange(1, 9).setValue('SUPERVISOR');
    hA.getRange('H1:I1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    Logger.log('â†ª INV_Canastas_Armadas + SECTOR (col 8) + SUPERVISOR (col 9)');
  }
  
  const hE = ss.getSheetByName(INV_SH_ENTREGAS);
  if (hE) {
    const headers = hE.getRange(1, 1, 1, Math.max(11, hE.getLastColumn())).getValues()[0];
    if (!headers[10]) hE.getRange(1, 11).setValue('SUPERVISOR');
    hE.getRange('K1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    Logger.log('â†ª INV_Entregas + SUPERVISOR (col 11)');
  }
  
  Logger.log('â•â•â• MigraciÃ³n completada â•â•â•');
  return { success: true };
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  FUNCIONES LECTURA INVENTARIO (con SECTOR y SUPERVISOR)
//  Sobrescriben cualquier versiÃ³n anterior
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function invLeerIngresos() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_INGRESOS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 14).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], producto: r[2], cantidad: Number(r[3]) || 0,
    unidad: r[4], fechaIngreso: r[5], fechaVenc: r[6], lote: r[7],
    responsable: r[8], proveedor: r[9], observaciones: r[10], usuario: r[11],
    sector: r[12] || '', supervisor: r[13] || ''
  }));
}

function invLeerArmados() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_ARMADOS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 9).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], cantidad: Number(r[3]) || 0,
    responsable: r[4], observaciones: r[5], usuario: r[6],
    sector: r[7] || '', supervisor: r[8] || ''
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function invLeerEntregas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_ENTREGAS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 11).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], empresa: r[3], sector: r[4],
    cantidad: Number(r[5]) || 0, responsable: r[6], documento: r[7],
    observaciones: r[8], usuario: r[9], supervisor: r[10] || ''
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MÃ“DULO INVENTARIO V3 â€” Sectores y Supervisores
//  Sectores: hoja propia INV_Sectores con CRUD
//  Supervisores: leÃ­dos desde hoja "usuarios" (rol=supervisor, activo=TRUE)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const INV_SH_SECTORES = 'INV_Sectores';

const INV_SECTORES_INICIALES = [
  'OLIVARES BAJO',
  'ADMINISTRACION',
  'PLANTA RAPEL',
  'OPERACIONES CAMPO',
  'DEPARTAMENTO TECNICO',
  'EL PAPAYO',
  'LIMONES',
  'LOS OLIVARES',
  'SANTA ROSA',
  'ALGARROBOS',
  'SAN VICENTE',
  'PUNTA ARENAS',
  'APROA',
  'CAMPO A',
  'FUNDO VARIOS'
];

// SETUP â€” Ejecutar UNA VEZ desde el editor
function invSetupSectores() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let h = ss.getSheetByName(INV_SH_SECTORES);
  if (!h) {
    h = ss.insertSheet(INV_SH_SECTORES);
    h.appendRow(['ID', 'NOMBRE', 'ACTIVO', 'CREADO', 'CREADO_POR']);
    h.getRange('A1:E1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    INV_SECTORES_INICIALES.forEach((nombre, idx) => {
      const id = 'S' + (Date.now() + idx);
      h.appendRow([id, nombre, true, new Date(), 'sistema']);
    });
    Logger.log('âœ“ ' + INV_SH_SECTORES + ' creado con ' + INV_SECTORES_INICIALES.length + ' sectores');
  } else {
    Logger.log('â€¢ ' + INV_SH_SECTORES + ' ya existe');
  }
  Logger.log('â•â•â• Setup sectores completado â•â•â•');
}

// CRUD SECTORES
function invListarSectores() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_SECTORES);
    if (!h || h.getLastRow() < 2) return { success: true, sectores: [] };
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 5).getValues();
    const sectores = datos
      .filter(r => r[0] && r[2] === true)
      .map(r => ({ id: r[0], nombre: r[1], activo: r[2] }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { success: true, sectores };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function invAgregarSector(body) {
  try {
    const nombre = (body.nombre || '').trim().toUpperCase();
    if (!nombre) return { success: false, error: 'Nombre vacÃ­o' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_SECTORES);
    if (!h) return { success: false, error: 'Ejecutar invSetupSectores() primero' };

    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if ((datos[r][1] || '').toString().toUpperCase() === nombre && datos[r][2] === true) {
        return { success: false, error: 'Ya existe un sector con ese nombre' };
      }
    }

    const id = 'S' + Date.now();
    h.appendRow([id, nombre, true, new Date(), body.usuario || '']);
    return { success: true, item: { id, nombre, activo: true } };
  } catch (e) { return { success: false, error: e.message }; }
}

function invEditarSector(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_SECTORES);
    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        if (body.nombre) h.getRange(r + 1, 2).setValue(body.nombre.trim().toUpperCase());
        return { success: true };
      }
    }
    return { success: false, error: 'Sector no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

function invEliminarSector(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_SECTORES);
    const datos = h.getDataRange().getValues();
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === body.id) {
        h.getRange(r + 1, 3).setValue(false);
        return { success: true };
      }
    }
    return { success: false, error: 'Sector no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

// SUPERVISORES desde hoja "usuarios"
function invListarSupervisores() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName('usuarios');
    if (!h || h.getLastRow() < 2) {
      return { success: false, error: 'Hoja "usuarios" vacÃ­a o no encontrada' };
    }

    const datos = h.getRange(2, 1, h.getLastRow() - 1, 11).getValues();

    const supervisores = datos
      .filter(r => {
        const rol = String(r[4] || '').trim().toLowerCase();
        const activo = r[6] === true || String(r[6]).toUpperCase() === 'TRUE';
        return rol === 'supervisor' && activo && r[3];
      })
      .map(r => ({
        usuario: String(r[1] || '').trim(),
        nombre: String(r[3] || '').trim(),
        sector: String(r[10] || '').trim().toUpperCase(),
        cargo: String(r[9] || '').trim()
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { success: true, supervisores };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// DEBUG opcional
function testSupervisoresYSectores() {
  Logger.log('=== SUPERVISORES ===');
  Logger.log(JSON.stringify(invListarSupervisores(), null, 2));
  Logger.log('=== SECTORES ===');
  Logger.log(JSON.stringify(invListarSectores(), null, 2));
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MÃ“DULO HORAS â€” Sistema de AcumulaciÃ³n y Permisos
//  Solo accesible por: jtimoteo, ovilela, jchavez
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const HORAS_SH_REGISTROS = 'registros';
const HORAS_SH_MOTIVOS = 'MOTIVOS';
const HORAS_SH_AUDITORIA = 'HORAS_AUDITORIA';
const HORAS_TRAB_RAPEL = 'Trabajadores_RAPEL';
const HORAS_TRAB_VERFRUT = 'Trabajadores_VERFRUT';

const HORAS_ADMINS = ['jtimoteo', 'ovilela', 'jchavez'];

const HORAS_MOTIVOS_DEFAULT = [
  'AcumulaciÃ³n',
  'Permiso',
  'CompensaciÃ³n',
  'Tardanza',
  'Falta justificada',
  'Trabajo en dÃ­a libre'
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SETUP â€” Ejecutar UNA VEZ desde el editor
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Hoja registros
  let h = ss.getSheetByName(HORAS_SH_REGISTROS);
  if (!h) {
    h = ss.insertSheet(HORAS_SH_REGISTROS);
    h.appendRow([
      'ID', 'FECHA_REGISTRO', 'REGISTRADO_POR',
      'DNI', 'NOMBRE', 'EMPRESA', 'CARGO',
      'FECHA_ENTRADA', 'HORA_ENTRADA', 'FECHA_SALIDA', 'HORA_SALIDA',
      'HORAS_TRABAJADAS', 'JORNADA_ESPERADA',
      'HORAS_ACUMULADAS', 'HORAS_PERMISO', 'HORAS_DEUDA',
      'MOTIVO', 'DETALLE', 'OBSERVACIONES', 'ALERTA',
      'ESTADO', 'APROBADO_POR', 'APROBADO_EN'
    ]);
    h.getRange('A1:W1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    h.setColumnWidths(1, 23, 130);
    Logger.log('âœ“ Hoja registros creada con 23 columnas');
  } else {
    Logger.log('â€¢ Hoja registros ya existe');
  }
  
  // Hoja MOTIVOS
  h = ss.getSheetByName(HORAS_SH_MOTIVOS);
  if (!h) {
    h = ss.insertSheet(HORAS_SH_MOTIVOS);
    h.getRange(1, 1).setValue('MOTIVO').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    HORAS_MOTIVOS_DEFAULT.forEach(m => h.appendRow([m]));
    Logger.log('âœ“ Hoja MOTIVOS creada con ' + HORAS_MOTIVOS_DEFAULT.length + ' motivos');
  } else {
    Logger.log('â€¢ Hoja MOTIVOS ya existe');
  }
  
  // Hoja auditoria
  h = ss.getSheetByName(HORAS_SH_AUDITORIA);
  if (!h) {
    h = ss.insertSheet(HORAS_SH_AUDITORIA);
    h.appendRow(['FECHA', 'USUARIO', 'ACCION', 'REGISTRO_ID', 'DETALLES']);
    h.getRange('A1:E1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('âœ“ Hoja HORAS_AUDITORIA creada');
  }
  
  Logger.log('â•â•â• Setup horas completado â•â•â•');
  return { success: true };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VALIDAR ADMIN
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasEsAdmin(usuario) {
  return HORAS_ADMINS.indexOf(String(usuario || '').toLowerCase().trim()) >= 0;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AUDITORIA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasLog(usuario, accion, registroId, detalles) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_AUDITORIA);
    if (h) h.appendRow([new Date(), usuario || '', accion, registroId || '', detalles || '']);
  } catch (e) { /* silencioso */ }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BUSCAR TRABAJADOR POR DNI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasBuscarTrabajador(body) {
  try {
    const dni = String(body.dni || '').trim();
    if (!dni) return { success: false, error: 'DNI requerido' };
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hojas = [
      { nombre: HORAS_TRAB_RAPEL, empresa: 'RAPEL' },
      { nombre: HORAS_TRAB_VERFRUT, empresa: 'VERFRUT' }
    ];
    
    for (const conf of hojas) {
      const h = ss.getSheetByName(conf.nombre);
      if (!h || h.getLastRow() < 2) continue;
      
      const datos = h.getRange(1, 1, h.getLastRow(), 15).getValues();
      for (let r = 1; r < datos.length; r++) {
        if (String(datos[r][0] || '').trim() === dni) {
          return {
            success: true,
            trabajador: {
              dni: dni,
              nombre: String(datos[r][14] || '').trim(),  // col O = Ã­ndice 14
              cargo: String(datos[r][7] || '').trim(),    // col H = Ã­ndice 7
              regimen: String(datos[r][8] || '').trim(),  // col I = Ã­ndice 8
              fechaInicio: datos[r][5] || '',             // col F = Ã­ndice 5
              empresa: conf.empresa
            }
          };
        }
      }
    }
    
    return { success: false, error: 'DNI ' + dni + ' no encontrado en RAPEL ni VERFRUT' };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CALCULAR JORNADA ESPERADA (puede iterar varios dÃ­as)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasCalcularJornadaUnDia(fecha) {
  let f;
  
  // Si viene como string "YYYY-MM-DD", parsearlo manualmente para evitar UTC bug
  if (typeof fecha === 'string' && fecha.length >= 10) {
    const partes = fecha.substring(0, 10).split('-');
    if (partes.length === 3) {
      f = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    } else {
      f = new Date(fecha);
    }
  } else {
    f = new Date(fecha);
  }
  
  if (isNaN(f.getTime())) return 0;
  
  const mes = f.getMonth() + 1;
  const dia = f.getDay();  // 0=dom, 1=lun, ..., 6=sab
  
  Logger.log('Calculando jornada para ' + f.toDateString() + ' (mes=' + mes + ', dia=' + dia + ')');
  
  if (mes <= 5) {
    // Temporada alta: enero-mayo
    return (dia >= 1 && dia <= 5) ? 9.6 : 0;
  } else {
    // Temporada baja: junio-diciembre
    if (dia >= 1 && dia <= 5) return 8.75;
    if (dia === 6) return 5.75;
    return 0;
  }
}

function horasCalcularJornadaTotal(fechaIni, fechaFin) {
  // Parsear fechas manualmente para evitar bug UTC
  function parsearFecha(f) {
    if (typeof f === 'string' && f.length >= 10) {
      const p = f.substring(0, 10).split('-');
      if (p.length === 3) {
        return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
      }
    }
    return new Date(f);
  }
  
  const f1 = parsearFecha(fechaIni);
  const f2 = parsearFecha(fechaFin);
  
  if (isNaN(f1.getTime()) || isNaN(f2.getTime())) return 0;
  
  let total = 0;
  const cur = new Date(f1);
  while (cur <= f2) {
    // Pasar la fecha como Date directamente
    const mes = cur.getMonth() + 1;
    const dia = cur.getDay();
    if (mes <= 5) {
      total += (dia >= 1 && dia <= 5) ? 9.6 : 0;
    } else {
      if (dia >= 1 && dia <= 5) total += 8.75;
      else if (dia === 6) total += 5.75;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.round(total * 100) / 100;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CALCULAR SALDO PREVIO DE UN TRABAJADOR
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasCalcularSaldo(dni) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(HORAS_SH_REGISTROS);
  if (!h || h.getLastRow() < 2) return { acum: 0, perm: 0, deuda: 0, saldo: 0 };
  
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 23).getValues();
  let acum = 0, perm = 0, deuda = 0;
  
  datos.forEach(r => {
    if (String(r[3] || '').trim() === String(dni).trim()) {
      const estado = String(r[20] || '').toLowerCase();
      if (estado !== 'rechazado') {
        acum += Number(r[13]) || 0;
        perm += Number(r[14]) || 0;
        deuda += Number(r[15]) || 0;
      }
    }
  });
  
  return {
    acum: Math.round(acum * 100) / 100,
    perm: Math.round(perm * 100) / 100,
    deuda: Math.round(deuda * 100) / 100,
    saldo: Math.round((acum - perm - deuda) * 100) / 100
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// REGISTRAR HORAS â€” con compensaciÃ³n corregida matemÃ¡ticamente
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasRegistrar(body) {
  try {
    const r = body.registro || {};
    
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores pueden registrar' };
    }
    
    if (!r.dni || !r.motivo) {
      return { success: false, error: 'DNI y motivo son obligatorios' };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    if (!h) return { success: false, error: 'Ejecutar horasSetup() primero' };
    
const motivo = String(r.motivo || '').toLowerCase().trim();
let horasTrabajadas = Number(r.horasTrabajadas) || 0;
let horasAcum = 0, horasPermiso = 0, horasDeuda = 0;
let alerta = '', estado = 'aprobado';

const jornadaEsp = (r.fechaEntrada && r.fechaSalida)
  ? horasCalcularJornadaTotal(r.fechaEntrada, r.fechaSalida)
  : (r.fechaEntrada ? horasCalcularJornadaUnDia(r.fechaEntrada) : 0);

// â¬‡ï¸ NUEVO: Si frontend no enviÃ³ horasTrabajadas, calcular desde fechas/horas
if (horasTrabajadas === 0 && r.fechaEntrada && r.horaEntrada && r.fechaSalida && r.horaSalida) {
  try {
    const ent = new Date(r.fechaEntrada + 'T' + r.horaEntrada + ':00');
    const sal = new Date(r.fechaSalida + 'T' + r.horaSalida + ':00');
    if (sal > ent) {
      horasTrabajadas = (sal - ent) / 3600000;  // ms a horas
      // Descontar 45 min refrigerio si jornada >= 5h
      if (horasTrabajadas >= 5) {
        horasTrabajadas -= 0.75;
      }
      horasTrabajadas = Math.round(horasTrabajadas * 100) / 100;
    }
  } catch(e) { /* ignorar errores de parse */ }
}
    
    // LÃ³gica por motivo
    if (motivo === 'acumulaciÃ³n' || motivo === 'acumulacion') {
      // Horas extra que sobran sobre la jornada
      if (horasTrabajadas > jornadaEsp) {
        horasAcum = Math.round((horasTrabajadas - jornadaEsp) * 100) / 100;
      }
      alerta = 'AcumulaciÃ³n registrada';
      
    } else if (motivo === 'permiso') {
      // Calcular horas de permiso (1 dÃ­a o varios)
      let horasPermisoSolicitadas = Number(r.horasPermiso) || 0;
      
      if (horasPermisoSolicitadas === 0 && r.fechaEntrada && r.fechaSalida) {
        // Permiso dÃ­a(s) completo(s)
        horasPermisoSolicitadas = horasCalcularJornadaTotal(r.fechaEntrada, r.fechaSalida);
      }
      
      // Validaciones
      const dias = (r.fechaEntrada && r.fechaSalida)
        ? Math.floor((new Date(r.fechaSalida) - new Date(r.fechaEntrada)) / (24*60*60*1000)) + 1
        : 1;
      
      if (dias >= 2) {
        alerta = 'OBSERVADO: Permiso por ' + dias + ' dÃ­a(s). Requiere validaciÃ³n.';
        estado = 'pendiente';
      } else if (horasPermisoSolicitadas > 12) {
        alerta = 'OBSERVADO: Permiso excede 12 horas. Revisar autorizaciÃ³n.';
        estado = 'pendiente';
      } else {
        alerta = 'Permiso registrado';
      }
      
      // CompensaciÃ³n CORREGIDA con saldo previo
      const saldo = horasCalcularSaldo(r.dni);
      
      if (saldo.saldo >= horasPermisoSolicitadas) {
        // Saldo cubre todo el permiso
        horasPermiso = horasPermisoSolicitadas;
        horasDeuda = 0;
        alerta += ' - Cubierto con saldo (' + saldo.saldo.toFixed(2) + 'h disponibles)';
      } else if (saldo.saldo > 0) {
        // Saldo parcial: cubre lo que puede, resto va a deuda
        horasPermiso = saldo.saldo;
        horasDeuda = Math.round((horasPermisoSolicitadas - saldo.saldo) * 100) / 100;
        alerta += ' - ' + saldo.saldo.toFixed(2) + 'h del saldo + ' + horasDeuda.toFixed(2) + 'h de deuda';
      } else {
        // Sin saldo: todo es deuda
        horasPermiso = 0;
        horasDeuda = horasPermisoSolicitadas;
        alerta += ' - Sin saldo: ' + horasDeuda.toFixed(2) + 'h registradas como deuda';
      }
      
      horasTrabajadas = 0;
      
    } else if (motivo === 'compensaciÃ³n' || motivo === 'compensacion') {
      // Recupera horas de deuda explÃ­citamente
      horasAcum = horasTrabajadas;
      alerta = 'CompensaciÃ³n registrada (recupera deuda)';
    } else {
      // Tardanza, falta justificada, trabajo dÃ­a libre, etc.
      alerta = 'Registro de tipo: ' + r.motivo;
    }
    
   // â”€â”€â”€ COMPENSACIÃ“N AUTOMÃTICA con registro de auditorÃ­a â”€â”€â”€
let acumOriginal = horasAcum;  // guardar para usar en el registro principal
let necesitaCompensacion = false;
let montoCompensacion = 0;

if (horasAcum > 0) {
  const saldo = horasCalcularSaldo(r.dni);
  if (saldo.deuda > 0) {
    if (horasAcum >= saldo.deuda) {
      // La acumulaciÃ³n cubre toda la deuda
      montoCompensacion = saldo.deuda;
      necesitaCompensacion = true;
      alerta += ' - Deuda previa de ' + saldo.deuda.toFixed(2) + 'h SALDADA con compensaciÃ³n automÃ¡tica';
    } else {
      // La acumulaciÃ³n cubre parte de la deuda
      montoCompensacion = horasAcum;
      necesitaCompensacion = true;
      alerta += ' - CompensaciÃ³n de ' + horasAcum.toFixed(2) + 'h aplicada a deuda';
    }
  }
}
    function eliminarRegistroPrueba() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName('registros');
  const datos = h.getDataRange().getValues();
  
  for (let i = datos.length - 1; i >= 1; i--) {
    if (datos[i][0] === 'H1777523036280') {  // ID del registro malo
      h.deleteRow(i + 1);
      Logger.log('âœ“ Eliminado registro de prueba');
      return;
    }
  }
  Logger.log('No se encontrÃ³ el registro');
}
    
    // Generar ID
    const id = 'H' + Date.now();
    
    // Insertar fila
    h.appendRow([
      id,
      new Date(),
      body.usuario || '',
      String(r.dni).trim(),
      r.nombre || '',
      r.empresa || '',
      r.cargo || '',
      r.fechaEntrada || '',
      r.horaEntrada || '',
      r.fechaSalida || '',
      r.horaSalida || '',
      Math.round(horasTrabajadas * 100) / 100,
      Math.round(jornadaEsp * 100) / 100,
      Math.round(horasAcum * 100) / 100,
      Math.round(horasPermiso * 100) / 100,
      Math.round(horasDeuda * 100) / 100,
      r.motivo || '',
      r.detalle || '',
      r.observaciones || '',
      alerta,
      estado,
      '',
      ''
    ]);
    
    horasLog(body.usuario, 'REGISTRAR', id, r.motivo + ' / ' + r.dni);
    // â”€â”€â”€ REGISTRO DE COMPENSACIÃ“N AUTOMÃTICA â”€â”€â”€
if (necesitaCompensacion && montoCompensacion > 0) {
  const idComp = 'HC' + Date.now();
  h.appendRow([
    idComp,
    new Date(),
    body.usuario || '',
    String(r.dni).trim(),
    r.nombre || '',
    r.empresa || '',
    r.cargo || '',
    '',  // sin fecha entrada
    '',
    '',
    '',
    0,   // sin horas trabajadas
    0,   // sin jornada
    -montoCompensacion,  // â† ACUMULADAS NEGATIVAS (resta saldo a favor)
    0,
    -montoCompensacion,  // â† DEUDA NEGATIVA (cancela la deuda)
    'CompensaciÃ³n automÃ¡tica',
    'Auto: vinculado a registro ' + id,
    'CompensaciÃ³n de ' + montoCompensacion.toFixed(2) + 'h: acumulaciÃ³n cubre deuda previa',
    'CompensaciÃ³n automÃ¡tica',
    'aprobado',
    body.usuario || '',
    new Date()
  ]);
  
  horasLog(body.usuario, 'COMPENSACION_AUTO', idComp, 
    'Compensa ' + montoCompensacion + 'h de deuda con acumulaciÃ³n de ' + id);
}
function limpiarMisRegistros() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName('registros');
  const datos = h.getDataRange().getValues();
  
  let eliminados = 0;
  for (let i = datos.length - 1; i >= 1; i--) {
    if (String(datos[i][3]).trim() === '46073509') {  // tu DNI
      h.deleteRow(i + 1);
      eliminados++;
    }
  }
  Logger.log('Eliminados: ' + eliminados + ' registros');
}
    
    return {
      success: true,
      id: id,
      registro: {
        id: id,
        horasTrabajadas: horasTrabajadas,
        jornadaEsperada: jornadaEsp,
        horasAcum: horasAcum,
        horasPermiso: horasPermiso,
        horasDeuda: horasDeuda,
        alerta: alerta,
        estado: estado
      }
    };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LISTAR REGISTROS (con filtros opcionales)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasListar(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    if (!h || h.getLastRow() < 2) return { success: true, registros: [] };
    
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 23).getValues();
    let regs = datos.filter(r => r[0]).map(r => ({
      id: r[0],
      fechaRegistro: r[1],
      registradoPor: r[2],
      dni: String(r[3] || '').trim(),
      nombre: r[4],
      empresa: r[5],
      cargo: r[6],
      fechaEntrada: r[7],
      horaEntrada: r[8],
      fechaSalida: r[9],
      horaSalida: r[10],
      horasTrabajadas: Number(r[11]) || 0,
      jornadaEsperada: Number(r[12]) || 0,
      horasAcumuladas: Number(r[13]) || 0,
      horasPermiso: Number(r[14]) || 0,
      horasDeuda: Number(r[15]) || 0,
      motivo: r[16],
      detalle: r[17],
      observaciones: r[18],
      alerta: r[19],
      estado: r[20] || 'aprobado',
      aprobadoPor: r[21],
      aprobadoEn: r[22]
    }));
    
    if (body && body.dni) {
      regs = regs.filter(r => r.dni === String(body.dni).trim());
    }
    if (body && body.estado) {
      regs = regs.filter(r => r.estado === body.estado);
    }
    
    regs.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));
    return { success: true, registros: regs };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EDITAR REGISTRO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasEditar(body) {
  try {
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores pueden editar' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    const datos = h.getDataRange().getValues();
    const r = body.registro || {};
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === body.id) {
        if (r.observaciones !== undefined) h.getRange(i + 1, 19).setValue(r.observaciones);
        // AquÃ­ podrÃ­as agregar mÃ¡s campos editables
        horasLog(body.usuario, 'EDITAR', body.id, JSON.stringify(r));
        return { success: true };
      }
    }
    return { success: false, error: 'Registro no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ELIMINAR REGISTRO (soft delete - marca como rechazado)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasEliminar(body) {
  try {
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores pueden eliminar' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    const datos = h.getDataRange().getValues();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === body.id) {
        h.getRange(i + 1, 21).setValue('rechazado');
        h.getRange(i + 1, 22).setValue(body.usuario || '');
        h.getRange(i + 1, 23).setValue(new Date());
        horasLog(body.usuario, 'ELIMINAR', body.id, '');
        return { success: true };
      }
    }
    return { success: false, error: 'Registro no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// APROBAR REGISTRO PENDIENTE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasAprobar(body) {
  try {
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores pueden aprobar' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    const datos = h.getDataRange().getValues();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === body.id) {
        h.getRange(i + 1, 21).setValue('aprobado');
        h.getRange(i + 1, 22).setValue(body.usuario || '');
        h.getRange(i + 1, 23).setValue(new Date());
        horasLog(body.usuario, 'APROBAR', body.id, '');
        return { success: true };
      }
    }
    return { success: false, error: 'Registro no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESUMEN INDIVIDUAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasResumenIndividual(body) {
  try {
    const dni = String(body.dni || '').trim();
    if (!dni) return { success: false, error: 'DNI requerido' };
    
    const lista = horasListar({ dni: dni });
    if (!lista.success) return lista;
    
    const saldo = horasCalcularSaldo(dni);
    
    return {
      success: true,
      dni: dni,
      registros: lista.registros,
      totales: saldo,
      comentario: saldo.saldo > 0
        ? 'Saldo a favor: ' + saldo.saldo.toFixed(2) + ' horas'
        : (saldo.saldo < 0
            ? 'Deuda pendiente: ' + Math.abs(saldo.saldo).toFixed(2) + ' horas'
            : 'Sin saldo pendiente')
    };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESUMEN GENERAL (todos los trabajadores)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasResumenGeneral() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_REGISTROS);
    if (!h || h.getLastRow() < 2) return { success: true, resumen: [] };
    
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 23).getValues();
    const map = {};
    
    datos.forEach(r => {
      const dni = String(r[3] || '').trim();
      if (!dni) return;
      const estado = String(r[20] || '').toLowerCase();
      if (estado === 'rechazado') return;
      
      if (!map[dni]) {
        map[dni] = {
          dni: dni,
          nombre: r[4],
          empresa: r[5],
          cargo: r[6],
          acum: 0, perm: 0, deuda: 0
        };
      }
      map[dni].acum += Number(r[13]) || 0;
      map[dni].perm += Number(r[14]) || 0;
      map[dni].deuda += Number(r[15]) || 0;
    });
    
    const resumen = Object.values(map).map(t => ({
      ...t,
      acum: Math.round(t.acum * 100) / 100,
      perm: Math.round(t.perm * 100) / 100,
      deuda: Math.round(t.deuda * 100) / 100,
      saldo: Math.round((t.acum - t.perm - t.deuda) * 100) / 100
    })).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    
    return { success: true, resumen };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MOTIVOS â€” CRUD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasListarMotivos() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_MOTIVOS);
    if (!h || h.getLastRow() < 2) return { success: true, motivos: [] };
    
    const datos = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
    const motivos = datos
      .map(r => String(r[0] || '').trim())
      .filter(m => m)
      .sort((a, b) => a.localeCompare(b));
    return { success: true, motivos };
  } catch (e) { return { success: false, error: e.message }; }
}

function horasAgregarMotivo(body) {
  try {
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores' };
    }
    const nombre = String(body.nombre || '').trim();
    if (!nombre) return { success: false, error: 'Nombre vacÃ­o' };
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_MOTIVOS);
    if (!h) return { success: false, error: 'Hoja MOTIVOS no encontrada' };
    
    const datos = h.getDataRange().getValues();
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0] || '').toLowerCase().trim() === nombre.toLowerCase()) {
        return { success: false, error: 'Ya existe ese motivo' };
      }
    }
    
    h.appendRow([nombre]);
    horasLog(body.usuario, 'AGREGAR_MOTIVO', '', nombre);
    return { success: true, motivo: nombre };
  } catch (e) { return { success: false, error: e.message }; }
}

function horasEliminarMotivo(body) {
  try {
    if (!horasEsAdmin(body.usuario)) {
      return { success: false, error: 'Solo administradores' };
    }
    const nombre = String(body.nombre || '').trim();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(HORAS_SH_MOTIVOS);
    const datos = h.getDataRange().getValues();
    
    for (let i = datos.length - 1; i >= 1; i--) {
      if (String(datos[i][0] || '').trim() === nombre) {
        h.deleteRow(i + 1);
        horasLog(body.usuario, 'ELIMINAR_MOTIVO', '', nombre);
        return { success: true };
      }
    }
    return { success: false, error: 'Motivo no encontrado' };
  } catch (e) { return { success: false, error: e.message }; }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TEST
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function horasTest() {
  Logger.log('=== Setup ===');
  Logger.log(JSON.stringify(horasSetup()));
  Logger.log('=== Motivos ===');
  Logger.log(JSON.stringify(horasListarMotivos()));
  Logger.log('=== Buscar DNI 46073509 ===');
  Logger.log(JSON.stringify(horasBuscarTrabajador({ dni: '46073509' })));
}
function testBuscarReal() {
  // âš ï¸ CAMBIA AQUÃ por un DNI REAL que sepas que existe en
  // Trabajadores_RAPEL o Trabajadores_VERFRUT
  const dniReal = 46073509;
  
  Logger.log('Buscando DNI: ' + dniReal);
  const resultado = horasBuscarTrabajador({ dni: dniReal });
  Logger.log(JSON.stringify(resultado, null, 2));
}
// Test 1: Â¿EstÃ¡ horasSetup ejecutado?
function testHojas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const r = ss.getSheetByName('registros');
  const m = ss.getSheetByName('MOTIVOS');
  Logger.log('registros: ' + (r ? 'âœ“ existe con ' + r.getLastRow() + ' filas' : 'âŒ NO existe'));
  Logger.log('MOTIVOS: ' + (m ? 'âœ“ existe con ' + (m.getLastRow()-1) + ' motivos' : 'âŒ NO existe'));
}

// Test 2: Â¿Funciona la bÃºsqueda?
function testBuscarReal() {
  const dniReal = 'TU_DNI_AQUI'; // pon un DNI real
  Logger.log(JSON.stringify(horasBuscarTrabajador({dni: dniReal}), null, 2));
}
function testDiagnostico() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  Logger.log('â•â•â• VERIFICANDO HOJAS â•â•â•');
  
  const hojas = ['Trabajadores_RAPEL', 'Trabajadores_VERFRUT'];
  hojas.forEach(nombre => {
    const h = ss.getSheetByName(nombre);
    if (!h) {
      Logger.log('âŒ Hoja "' + nombre + '" NO EXISTE');
      return;
    }
    
    const ultimaFila = h.getLastRow();
    const ultimaCol = h.getLastColumn();
    Logger.log('âœ“ Hoja "' + nombre + '" â†’ ' + ultimaFila + ' filas Ã— ' + ultimaCol + ' cols');
    
    // Mostrar primeros 3 DNIs (col A, filas 2, 3, 4)
    if (ultimaFila >= 4) {
      const muestra = h.getRange(2, 1, 3, 1).getValues();
      Logger.log('  Primeros 3 DNIs: ' + JSON.stringify(muestra.map(r => r[0])));
    }
    
    // Mostrar fila 2 completa (primer trabajador)
    if (ultimaFila >= 2) {
      const fila2 = h.getRange(2, 1, 1, Math.min(20, ultimaCol)).getValues()[0];
      Logger.log('  Fila 2 (cols A-T): ' + JSON.stringify(fila2));
    }
  });
  
  Logger.log('â•â•â• HEADERS DE COLUMNAS â•â•â•');
  hojas.forEach(nombre => {
    const h = ss.getSheetByName(nombre);
    if (!h) return;
    const headers = h.getRange(1, 1, 1, Math.min(20, h.getLastColumn())).getValues()[0];
    Logger.log(nombre + ' headers: ' + JSON.stringify(headers));
  });
}
function testBuscarConDNIDelArchivo() {
  // Vamos a usar el PRIMER DNI de RAPEL que existe seguro
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName('Trabajadores_RAPEL');
  const dniReal = String(h.getRange(2, 1).getValue()).trim();
  
  Logger.log('DNI tomado directamente de la hoja: "' + dniReal + '"');
  Logger.log('Tipo: ' + typeof dniReal);
  Logger.log('Largo: ' + dniReal.length);
  
  Logger.log('â•â•â• Ejecutando horasBuscarTrabajador â•â•â•');
  const resultado = horasBuscarTrabajador({ dni: dniReal });
  Logger.log(JSON.stringify(resultado, null, 2));
}
function verificarMigracion() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName('registros');
  
  Logger.log('Total registros: ' + (h.getLastRow() - 1));
  Logger.log('Total columnas: ' + h.getLastColumn());
  
  // Verificar primeros 3 registros
  const muestra = h.getRange(2, 1, 3, 23).getValues();
  muestra.forEach((r, i) => {
    Logger.log('Fila ' + (i + 2) + ': DNI=' + r[3] + ' | Nombre=' + r[4] + ' | Empresa=' + r[5] + ' | Motivo=' + r[16] + ' | Estado=' + r[20]);
  });
  
  // Verificar empresas vacÃ­as
  const datos = h.getRange(2, 6, h.getLastRow() - 1, 1).getValues();
  const sinEmpresa = datos.filter(r => !r[0]).length;
  Logger.log('âš ï¸ Registros sin empresa: ' + sinEmpresa);
  
  // Verificar IDs duplicadas
  const ids = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().map(r => r[0]);
  const idsUnicos = new Set(ids);
  Logger.log(ids.length === idsUnicos.size ? 'âœ“ IDs Ãºnicas OK' : 'âš ï¸ IDs DUPLICADAS detectadas');
}
function testJornada() {
  Logger.log('â•â•â• TEST JORNADAS â•â•â•');
  Logger.log('Lunes 27/04/2026: ' + horasCalcularJornadaUnDia('2026-04-27') + ' (esperado: 9.6)');
  Logger.log('Domingo 26/04/2026: ' + horasCalcularJornadaUnDia('2026-04-26') + ' (esperado: 0)');
  Logger.log('SÃ¡bado 25/04/2026: ' + horasCalcularJornadaUnDia('2026-04-25') + ' (esperado: 0)');
  Logger.log('Lunes 06/07/2026: ' + horasCalcularJornadaUnDia('2026-07-06') + ' (esperado: 8.75)');
  Logger.log('SÃ¡bado 11/07/2026: ' + horasCalcularJornadaUnDia('2026-07-11') + ' (esperado: 5.75)');
  Logger.log('Total semana abril (27-30): ' + horasCalcularJornadaTotal('2026-04-27', '2026-04-30') + ' (esperado: 38.4)');
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  TRIGGER DE RESET DIARIO PARA DASHBOARD
//  Resetea contador "atenciones de hoy" cada dÃ­a a las 00:01 Lima
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function crearTriggerResetDiario() {
  // Eliminar triggers viejos del mismo handler para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'recalcularEstadisticasCompletas') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Crear nuevo trigger diario a las 00:01 hora Lima
  ScriptApp.newTrigger('recalcularEstadisticasCompletas')
    .timeBased()
    .atHour(0)
    .nearMinute(1)
    .everyDays(1)
    .inTimezone('America/Lima')
    .create();
  
  Logger.log('âœ“ Trigger creado: recalcularEstadisticasCompletas cada dÃ­a a 00:01 Lima');
  return { success: true, mensaje: 'Trigger creado' };
}

function listarTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Total triggers: ' + triggers.length);
  triggers.forEach(t => {
    Logger.log('Handler: ' + t.getHandlerFunction() + ' | Tipo: ' + t.getEventType());
  });
  return triggers.map(t => ({ 
    handler: t.getHandlerFunction(), 
    tipo: String(t.getEventType()) 
  }));
}
function diagnosticarFirebaseEstadisticas() {
  Logger.log('â•â•â• DIAGNÃ“STICO â•â•â•');
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const NOMBRE_HOJA = 'BB. DE REGISTROS 2026';
  const h = ss.getSheetByName(NOMBRE_HOJA);
  
  if (!h) {
    Logger.log('âŒ NO existe hoja "' + NOMBRE_HOJA + '"');
    return;
  }
  
  Logger.log('âœ“ Hoja "' + NOMBRE_HOJA + '": ' + h.getLastRow() + ' filas, ' + h.getLastColumn() + ' columnas');
  
  // Headers
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  Logger.log('â•â•â• HEADERS â•â•â•');
  headers.forEach((header, idx) => {
    Logger.log('Col ' + (idx + 1) + ' (' + String.fromCharCode(65 + idx) + '): ' + header);
  });
  
  // Mostrar fila 2 (primer registro real)
  if (h.getLastRow() >= 2) {
    Logger.log('â•â•â• FILA 2 (primer registro) â•â•â•');
    const fila2 = h.getRange(2, 1, 1, Math.min(15, h.getLastColumn())).getValues()[0];
    fila2.forEach((valor, idx) => {
      Logger.log('Col ' + (idx + 1) + ' (' + String.fromCharCode(65 + idx) + ') ' + headers[idx] + ': ' + JSON.stringify(valor));
    });
  }
  
  // Ãšltima fila (registro mÃ¡s reciente)
  if (h.getLastRow() >= 3) {
    Logger.log('â•â•â• ÃšLTIMA FILA (registro mÃ¡s reciente) â•â•â•');
    const ultima = h.getRange(h.getLastRow(), 1, 1, Math.min(15, h.getLastColumn())).getValues()[0];
    ultima.forEach((valor, idx) => {
      Logger.log('Col ' + (idx + 1) + ' (' + String.fromCharCode(65 + idx) + ') ' + headers[idx] + ': ' + JSON.stringify(valor));
    });
  }
  
  const hoyStr = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  const mesActual = hoyStr.substring(0, 7);
  Logger.log('â•â•â• FECHAS â•â•â•');
  Logger.log('Hoy: ' + hoyStr);
  Logger.log('Mes actual: ' + mesActual);
  
  Logger.log('â•â•â• EJECUTANDO recalcularEstadisticasCompletas â•â•â•');
  try {
    const resultado = recalcularEstadisticasCompletas();
    Logger.log('Resultado: ' + JSON.stringify(resultado, null, 2));
  } catch(e) {
    Logger.log('Error en recalcular: ' + e.message);
  }
}
function eliminarTriggerResetDiario() {
  const triggers = ScriptApp.getProjectTriggers();
  let eliminados = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'recalcularEstadisticasCompletas') {
      ScriptApp.deleteTrigger(t);
      eliminados++;
    }
  });
  Logger.log('âœ“ Eliminados ' + eliminados + ' triggers');
  return { eliminados };
}
function verificarSistemaCompleto() {
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('  VERIFICACIÃ“N DEL SISTEMA - 30/04/2026');
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  let problemas = 0;
  let okCount = 0;
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. VERIFICAR HOJAS CRÃTICAS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ“‹ 1. HOJAS CRÃTICAS:');
  const hojasCriticas = [
    'BB. DE REGISTROS 2024',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS 2026',
    'Visitas_Campo',
    'Casos',
    'Fusiones_Buses',
    'usuarios',
    'Trabajadores_RAPEL',
    'Trabajadores_VERFRUT',
    'registros',
    'MOTIVOS',
    'INV_Sectores'
  ];
  
  hojasCriticas.forEach(nombre => {
    const h = ss.getSheetByName(nombre);
    if (h) {
      Logger.log('  âœ“ ' + nombre + ': ' + h.getLastRow() + ' filas');
      okCount++;
    } else {
      Logger.log('  âŒ ' + nombre + ': NO EXISTE');
      problemas++;
    }
  });
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. VERIFICAR FUNCIONES BACKEND CRÃTICAS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ”§ 2. FUNCIONES BACKEND:');
  const funcionesCriticas = [
    'recalcularEstadisticasCompletas',
    'actualizarFirebaseRapido',
    'getPreloadOptimizado',
    'login',
    'guardarAtencion',
    'guardarVisitaCampo',
    'guardarCaso',
    'invGetAll',
    'invRegistrarIngreso',
    'horasRegistrar',
    'horasBuscarTrabajador',
    'invListarSectores',
    'invListarSupervisores'
  ];
  
  funcionesCriticas.forEach(nombre => {
    try {
      if (typeof eval(nombre) === 'function') {
        Logger.log('  âœ“ ' + nombre);
        okCount++;
      } else {
        Logger.log('  âŒ ' + nombre + ': NO EXISTE');
        problemas++;
      }
    } catch(e) {
      Logger.log('  âŒ ' + nombre + ': ERROR - ' + e.message);
      problemas++;
    }
  });
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. PROBAR LOGIN (sin afectar nada)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ” 3. SISTEMA DE LOGIN:');
  try {
    const hUsers = ss.getSheetByName('usuarios');
    if (hUsers && hUsers.getLastRow() >= 2) {
      const datos = hUsers.getRange(2, 1, hUsers.getLastRow() - 1, 11).getValues();
      const activos = datos.filter(r => r[6] === true).length;
      const supervisores = datos.filter(r => 
        String(r[4]).toLowerCase().trim() === 'supervisor' && r[6] === true
      ).length;
      const admins = datos.filter(r => 
        String(r[4]).toLowerCase().trim() === 'administrador' && r[6] === true
      ).length;
      Logger.log('  âœ“ Usuarios activos: ' + activos);
      Logger.log('  âœ“ Supervisores: ' + supervisores);
      Logger.log('  âœ“ Administradores: ' + admins);
      okCount++;
    } else {
      Logger.log('  âŒ Hoja usuarios vacÃ­a o no existe');
      problemas++;
    }
  } catch(e) {
    Logger.log('  âŒ Error verificando usuarios: ' + e.message);
    problemas++;
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. VERIFICAR INVENTARIO
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ“¦ 4. MÃ“DULO INVENTARIO:');
  try {
    const sect = invListarSectores();
    Logger.log('  âœ“ Sectores: ' + (sect.sectores ? sect.sectores.length : 0));
    
    const sup = invListarSupervisores();
    Logger.log('  âœ“ Supervisores en inventario: ' + (sup.supervisores ? sup.supervisores.length : 0));
    
    const all = invGetAll();
    if (all.success) {
      Logger.log('  âœ“ Stock canastas armadas: ' + (all.canastasArmadas || 0));
      Logger.log('  âœ“ Stock canastas entregadas: ' + (all.canastasEntregadas || 0));
      okCount++;
    } else {
      Logger.log('  âš ï¸ invGetAll devolviÃ³ error: ' + all.error);
    }
  } catch(e) {
    Logger.log('  âŒ Error en inventario: ' + e.message);
    problemas++;
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. VERIFICAR HORAS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nâ° 5. MÃ“DULO HORAS:');
  try {
    const motivos = horasListarMotivos();
    Logger.log('  âœ“ Motivos: ' + (motivos.motivos ? motivos.motivos.length : 0));
    
    const hReg = ss.getSheetByName('registros');
    if (hReg) {
      Logger.log('  âœ“ Registros de horas: ' + (hReg.getLastRow() - 1));
      okCount++;
    }
  } catch(e) {
    Logger.log('  âŒ Error en horas: ' + e.message);
    problemas++;
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. VERIFICAR TRIGGERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nâ±ï¸ 6. TRIGGERS:');
  try {
    const triggers = ScriptApp.getProjectTriggers();
    Logger.log('  Total triggers: ' + triggers.length);
    triggers.forEach(t => {
      Logger.log('  - ' + t.getHandlerFunction() + ' (' + t.getEventType() + ')');
    });
  } catch(e) {
    Logger.log('  âš ï¸ ' + e.message);
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 7. PROBAR CÃLCULO DE FECHA (zona horaria)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸŒ 7. ZONA HORARIA:');
  const hoyLima = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
  const hoyGmt5 = Utilities.formatDate(new Date(), 'GMT-5', 'yyyy-MM-dd HH:mm:ss');
  Logger.log('  Lima: ' + hoyLima);
  Logger.log('  GMT-5: ' + hoyGmt5);
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RESUMEN
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('  RESUMEN DEL DIAGNÃ“STICO');
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('  âœ… OK: ' + okCount);
  Logger.log('  âŒ Problemas: ' + problemas);
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  if (problemas === 0) {
    Logger.log('  ðŸŽ‰ SISTEMA OPERATIVO - Sin problemas detectados');
  } else {
    Logger.log('  âš ï¸ Se detectaron problemas, revisar arriba');
  }
  
  return { ok: okCount, problemas: problemas };
}
function verificarFuncionesReales() {
  Logger.log('â•â•â• FUNCIONES REALES DEL SISTEMA â•â•â•');
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Buscar funciones con palabras clave
  const palabras = ['Atencion', 'Visita', 'Caso', 'Fusion', 'Login'];
  
  // Test directo del flujo principal: handle()
  if (typeof handle === 'function') {
    Logger.log('âœ“ handle() existe (router principal)');
  } else {
    Logger.log('âŒ handle() NO existe - PROBLEMA GRAVE');
  }
  
  // Probar respuesta del backend (sin afectar nada)
  try {
    Logger.log('\n--- Probando getPreloadOptimizado ---');
    const params = { usuario: 'jtimoteo', empresa: 'ambas' };
    const result = getPreloadOptimizado(params);
    if (result && (result.atenciones || result.success)) {
      Logger.log('âœ“ getPreloadOptimizado responde correctamente');
      Logger.log('  - Total atenciones: ' + (result.atenciones ? result.atenciones.length : 'N/A'));
      Logger.log('  - Stats hoy: ' + JSON.stringify(result.stats || {}));
    } else {
      Logger.log('âš ï¸ getPreloadOptimizado devolviÃ³: ' + JSON.stringify(result).substring(0, 200));
    }
  } catch(e) {
    Logger.log('âŒ Error en getPreloadOptimizado: ' + e.message);
  }
  
  // Verificar Firebase
  Logger.log('\n--- Estado de Firebase ---');
  try {
    if (typeof _fbPatchEstadisticas === 'function') {
      Logger.log('âœ“ _fbPatchEstadisticas existe (sincronizaciÃ³n Firebase)');
    }
  } catch(e) {
    Logger.log('Error: ' + e.message);
  }
  
  Logger.log('\nâ•â•â• FIN â•â•â•');
}
function auditoriaSeguridad() {
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('  AUDITORÃA DE SEGURIDAD');
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
  let alertas = [];
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. CONTRASEÃ‘AS EN TEXTO PLANO
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ” 1. ALMACENAMIENTO DE CONTRASEÃ‘AS:');
  const hUsers = ss.getSheetByName('usuarios');
  if (hUsers && hUsers.getLastRow() >= 2) {
    const datos = hUsers.getRange(2, 1, hUsers.getLastRow() - 1, 5).getValues();
    let textoPlano = 0;
    let conHash = 0;
    
    datos.forEach(r => {
      const pass = String(r[2] || '');
      if (pass.length === 64 && /^[a-f0-9]+$/i.test(pass)) {
        conHash++;
      } else if (pass.length > 0) {
        textoPlano++;
      }
    });
    
    if (textoPlano > 0) {
      Logger.log('  ðŸ”´ CRÃTICO: ' + textoPlano + ' contraseÃ±as en TEXTO PLANO');
      alertas.push('PASSWORDS_PLAINTEXT');
    } else {
      Logger.log('  âœ“ ContraseÃ±as hasheadas');
    }
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. CONFIGURACIÃ“N DE WEB APP
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸŒ 2. EXPOSICIÃ“N DEL APPS SCRIPT:');
  Logger.log('  âš ï¸ Verificar manualmente:');
  Logger.log('     Deploy â†’ Manage deployments â†’ âœï¸');
  Logger.log('     "Who has access" debe ser:');
  Logger.log('     - "Anyone with Google Account" (mejor)');
  Logger.log('     - NO "Anyone, even anonymous"');
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. DETECTAR TOKENS HARDCODED
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ”‘ 3. DETECTAR SECRETOS EN CÃ“DIGO:');
  Logger.log('  âš ï¸ Verificar manualmente que NO haya:');
  Logger.log('     - FIREBASE_TOKEN = "..." en cÃ³digo');
  Logger.log('     - AZURE_KEY = "..." en cÃ³digo');
  Logger.log('     - apiKey: "AIza..." en cÃ³digo');
  Logger.log('     - "Bearer xyz..." en cÃ³digo');
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. INTENTOS DE LOGIN FALLIDOS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸš« 4. PROTECCIÃ“N CONTRA FUERZA BRUTA:');
  const cache = CacheService.getScriptCache();
  Logger.log('  âš ï¸ Verificar si login() implementa:');
  Logger.log('     - Contador de intentos por IP');
  Logger.log('     - Bloqueo temporal despuÃ©s de N fallos');
  Logger.log('     - Captcha en login');
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. LOGS DE AUDITORÃA
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ“ 5. AUDITORÃA DE ACCIONES:');
  const hAud = ss.getSheetByName('HORAS_AUDITORIA');
  if (hAud) {
    Logger.log('  âœ“ HORAS_AUDITORIA existe (' + hAud.getLastRow() + ' eventos)');
  } else {
    Logger.log('  âš ï¸ Falta auditorÃ­a general (no solo horas)');
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. ROLES Y PERMISOS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nðŸ‘¥ 6. ROLES:');
  if (hUsers) {
    const datos = hUsers.getRange(2, 5, hUsers.getLastRow() - 1, 1).getValues();
    const roles = {};
    datos.forEach(r => {
      const rol = String(r[0] || '').toLowerCase().trim();
      roles[rol] = (roles[rol] || 0) + 1;
    });
    Logger.log('  DistribuciÃ³n de roles: ' + JSON.stringify(roles));
  }
  
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RESUMEN
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Logger.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('  ALERTAS DETECTADAS: ' + alertas.length);
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  alertas.forEach(a => Logger.log('  ðŸ”´ ' + a));
  
  return { alertas: alertas };
}
function verLogin() {
  // Ver funciÃ³n login() para saber cÃ³mo estÃ¡ estructurada
  Logger.log('â•â•â• VER ESTRUCTURA DE login() â•â•â•');
  
  if (typeof login !== 'function') {
    Logger.log('âŒ login() no existe');
    return;
  }
  
  // Buscar referencia a la funciÃ³n
  Logger.log('âœ“ login() existe');
  
  // Test no-destructivo
  Logger.log('\n--- Test con credenciales falsas ---');
  try {
    const r1 = login({ usuario: 'usuario_falso', password: 'wrongpass' });
    Logger.log('Resultado: ' + JSON.stringify(r1).substring(0, 300));
  } catch(e) {
    Logger.log('Error: ' + e.message);
  }
  
  Logger.log('\n--- InformaciÃ³n del flujo ---');
  Logger.log('1. FunciÃ³n recibe: { usuario, password }');
  Logger.log('2. Lee hoja "usuarios"');
  Logger.log('3. Compara password con la guardada');
  Logger.log('4. Si coincide, devuelve token o info del usuario');
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  invSetupReceta â€” Corrige receta a 1 unidad/canasta + columna EXPORTADORA
//  Ejecutar UNA VEZ desde el editor de Apps Script
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const INV_RECETA_OBJETIVO = [
  { producto: 'Arroz',            cantidad: 1, unidad: 'KG' },
  { producto: 'Avena',            cantidad: 1, unidad: 'UND' },
  { producto: 'AzÃºcar',           cantidad: 1, unidad: 'KG' },
  { producto: 'Fideo',            cantidad: 1, unidad: 'PQT' },
  { producto: 'Fideo canuto',     cantidad: 1, unidad: 'PQT' },
  { producto: 'Galleta vainilla', cantidad: 1, unidad: 'PQT' },
  { producto: 'Leche',            cantidad: 1, unidad: 'UND' }
];

function invSetupReceta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hRec = ss.getSheetByName(INV_SH_RECETA);
  
  if (!hRec) {
    Logger.log('âŒ Hoja ' + INV_SH_RECETA + ' no existe. Ejecuta invSetup() primero.');
    return { success: false, error: 'Hoja no existe' };
  }
  
  const datos = hRec.getDataRange().getValues();
  const headers = datos[0].map(h => String(h).toLowerCase());
  
  const idxProducto = headers.findIndex(h => h.includes('producto'));
  const idxCantidad = headers.findIndex(h => h.includes('cantidad'));
  const idxUnidad = headers.findIndex(h => h.includes('unidad'));
  
  if (idxProducto < 0 || idxCantidad < 0) {
    Logger.log('âŒ Columnas no encontradas en INV_Receta');
    return { success: false, error: 'Columnas no encontradas' };
  }
  
  let actualizados = 0;
  let agregados = 0;
  
  INV_RECETA_OBJETIVO.forEach(obj => {
    let encontrado = false;
    
    for (let i = 1; i < datos.length; i++) {
      const prodActual = String(datos[i][idxProducto] || '').toLowerCase().trim();
      const prodObjetivo = obj.producto.toLowerCase().trim();
      
      if (prodActual === prodObjetivo) {
        if (datos[i][idxCantidad] !== obj.cantidad) {
          hRec.getRange(i + 1, idxCantidad + 1).setValue(obj.cantidad);
          actualizados++;
        }
        if (idxUnidad >= 0) {
          const unidadActual = String(datos[i][idxUnidad] || '').toLowerCase();
          if (unidadActual !== obj.unidad.toLowerCase()) {
            hRec.getRange(i + 1, idxUnidad + 1).setValue(obj.unidad);
          }
        }
        encontrado = true;
        break;
      }
    }
    
    if (!encontrado) {
      const id = 'R' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const nuevaFila = new Array(headers.length).fill('');
      nuevaFila[0] = id;
      nuevaFila[idxProducto] = obj.producto;
      nuevaFila[idxCantidad] = obj.cantidad;
      if (idxUnidad >= 0) nuevaFila[idxUnidad] = obj.unidad;
      hRec.appendRow(nuevaFila);
      agregados++;
    }
  });
  
  Logger.log('âœ“ Receta actualizada: ' + INV_RECETA_OBJETIVO.length + ' productos con cantidad=1');
  INV_RECETA_OBJETIVO.forEach(obj => {
    Logger.log('   - ' + obj.producto + ': ' + obj.cantidad + ' ' + obj.unidad);
  });
  Logger.log('  Actualizados: ' + actualizados + ' | Agregados: ' + agregados);
  
  // Asegurar columna EXPORTADORA en INV_Entregas
  const hEnt = ss.getSheetByName(INV_SH_ENTREGAS);
  if (hEnt) {
    const lastCol = hEnt.getLastColumn();
    const headEnt = hEnt.getRange(1, 1, 1, lastCol).getValues()[0];
    const tieneExp = headEnt.some(h => String(h).toUpperCase() === 'EXPORTADORA');
    
    if (!tieneExp) {
      hEnt.getRange(1, lastCol + 1).setValue('EXPORTADORA');
      hEnt.getRange(1, lastCol + 1).setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
      Logger.log('â†ª ' + INV_SH_ENTREGAS + ' + EXPORTADORA (col ' + (lastCol + 1) + ')');
    } else {
      Logger.log('  ' + INV_SH_ENTREGAS + ' ya tiene EXPORTADORA');
    }
  }
  
  Logger.log('â•â•â• invSetupReceta completado â•â•â•');
  return { success: true, actualizados, agregados };
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEST TEMPORAL - Validar eliminarCaso (borrar despuÃ©s)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function testEliminarCasoValidaciones() {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ§ª TEST VALIDACIONES eliminarCaso');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('Admins autorizados: ' + ADMINS_ELIMINAR_CASO.join(', '));
  
  // Test 1: Usuario no autorizado
  const test1 = eliminarCaso({ 
    nro: 999999, 
    usuario: 'azapata', 
    motivo: 'motivo de prueba largo' 
  });
  console.log('\nðŸ“‹ Test 1 - Usuario NO autorizado (azapata):');
  console.log('   ' + JSON.stringify(test1));
  if (!test1.success && test1.error.includes('permisos')) {
    console.log('   âœ… CORRECTO: rechaza no-admin');
  } else {
    console.log('   âŒ ERROR: deberia rechazar');
  }
  
  // Test 2: Sin nro
  const test2 = eliminarCaso({ 
    usuario: 'jtimoteo', 
    motivo: 'motivo de prueba largo' 
  });
  console.log('\nðŸ“‹ Test 2 - Sin numero de caso:');
  console.log('   ' + JSON.stringify(test2));
  if (!test2.success && test2.error.includes('Numero')) {
    console.log('   âœ… CORRECTO: pide numero');
  } else {
    console.log('   âŒ ERROR: deberia pedir nro');
  }
  
  // Test 3: Motivo muy corto
  const test3 = eliminarCaso({ 
    nro: 999999, 
    usuario: 'jtimoteo', 
    motivo: 'corto' 
  });
  console.log('\nðŸ“‹ Test 3 - Motivo de 5 caracteres (insuficiente):');
  console.log('   ' + JSON.stringify(test3));
  if (!test3.success && test3.error.includes('10 caracteres')) {
    console.log('   âœ… CORRECTO: rechaza motivo corto');
  } else {
    console.log('   âŒ ERROR: deberia rechazar motivo corto');
  }
  
  // Test 4: Caso inexistente (con datos vÃ¡lidos pero nro que no existe)
  const test4 = eliminarCaso({ 
    nro: 999999, 
    usuario: 'jtimoteo', 
    motivo: 'motivo de prueba con suficiente longitud' 
  });
  console.log('\nðŸ“‹ Test 4 - Caso inexistente NÂ° 999999:');
  console.log('   ' + JSON.stringify(test4));
  if (!test4.success && test4.error.includes('no encontrado')) {
    console.log('   âœ… CORRECTO: avisa caso no existe');
  } else {
    console.log('   âŒ ERROR: deberia avisar no encontrado');
  }
  
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('âœ… VALIDACIONES PROBADAS');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
}
function diagnosticarDNI_02808775() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dniBuscado = '02808775';
  const dniSinCero = '2808775';
  
  Logger.log('=== DIAGNÃ“STICO DNI 02808775 (IPANAQUE ESPINOZA) ===');
  Logger.log('Total de hojas en el spreadsheet: ' + ss.getSheets().length);
  
  ss.getSheets().forEach(sheet => {
    const nombre = sheet.getName();
    const data = sheet.getDataRange().getValues();
    
    // Buscar en TODAS las columnas, ambas variantes
    let encontrado = null;
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        const cell = data[i][j];
        const cellStr = cell !== null && cell !== undefined ? cell.toString().trim() : '';
        if (cellStr === dniBuscado || cellStr === dniSinCero) {
          encontrado = {
            fila: i + 1,
            columna: j + 1,
            valor: cell,
            tipo: typeof cell,
            stringificado: cellStr,
            longitud: cellStr.length
          };
          break;
        }
      }
      if (encontrado) break;
    }
    
    if (encontrado) {
      Logger.log('âœ… HOJA: "' + nombre + '"');
      Logger.log('   Fila: ' + encontrado.fila + ' | Columna: ' + encontrado.columna);
      Logger.log('   Valor: ' + encontrado.valor);
      Logger.log('   Tipo: ' + encontrado.tipo);
      Logger.log('   Como string: "' + encontrado.stringificado + '" (longitud: ' + encontrado.longitud + ')');
    } else {
      Logger.log('âŒ HOJA: "' + nombre + '" â€” no encontrado');
    }
  });
  
  Logger.log('=== FIN DIAGNÃ“STICO ===');
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TRIGGER onEdit â€” InvalidaciÃ³n automÃ¡tica de cache
// Se ejecuta cuando un usuario edita las hojas de trabajadores
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    
    const hoja = e.range.getSheet().getName();
    
    // Solo invalidar cuando se editan las hojas de trabajadores
    const HOJAS_TRABAJADORES = ['Trabajadores_RAPEL', 'Trabajadores_VERFRUT'];
    if (HOJAS_TRABAJADORES.indexOf(hoja) === -1) return;
    
    // Limpiar SOLO el cache de la hoja editada (no toca el otro)
    const cache = CacheService.getScriptCache();
    const key = 'v2_' + hoja;
    
    for (let i = 0; i < 20; i++) {
      cache.remove(key + '_' + i);
    }
    cache.remove(key + '_meta');
    
    Logger.log('âœ“ Cache invalidado: ' + hoja + 
               ' | Celda: ' + e.range.getA1Notation() + 
               ' | Usuario: ' + (e.user ? e.user.getEmail() : 'desconocido'));
    
  } catch(err) {
    Logger.log('onEdit error: ' + err.toString());
  }
}
// ============================================================
// SYNC TRABAJADORES Sheets â†’ Azure SQL
// Mantiene: vos editÃ¡s Sheets como siempre.
// Cada 6h: este cÃ³digo sincroniza a Azure SQL para Node.js.
// ============================================================

const SPREADSHEET_ID_TRAB = '1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw';
const AZURE_FUNCTION_URL  = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/sync';
const AZURE_FUNCTION_KEY = PropertiesService.getScriptProperties().getProperty('AZURE_FUNCTION_KEY');

function _formatearFecha(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return Utilities.formatDate(v, 'America/Lima', 'yyyy-MM-dd');
  }
  return null;
}

function _str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function _int(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function leerHojaTrabajadores(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID_TRAB);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la hoja: ' + sheetName);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const rows = data.slice(1); // saltar headers

  return rows.map(row => ({
    dni:              _str(row[0]),
    ap_paterno:       _str(row[1]),
    ap_materno:       _str(row[2]),
    nombres:          _str(row[3]),
    codigo_trab:      _str(row[4]),
    fecha_inicio:     _formatearFecha(row[5]),
    sexo:             _str(row[6]),
    oficio:           _str(row[7]),
    tipo_regimen:     _str(row[8]),
    id_empresa:       _str(row[9]),
    zona_labor:       _str(row[10]),
    direccion:        _str(row[11]),
    total:            _int(row[12]),
    empresa:          _str(row[13]),
    nombre_completo:  _str(row[14]),
    ruta:             _str(row[15]),
    cod:              _str(row[16]),
    fecha_termino:    _formatearFecha(row[17]),
    fecha_nacimiento: _formatearFecha(row[18])
  })).filter(r => r.dni); // descartar filas sin DNI
}

/**
 * FunciÃ³n principal del sync.
 * Ejecutala manualmente la PRIMERA vez para validar.
 * DespuÃ©s el trigger se encarga.
 */
function syncTrabajadoresAAzure() {
  const startTime = new Date();
  Logger.log('ðŸš€ Iniciando sync Trabajadores â†’ Azure SQL');

  try {
    Logger.log('ðŸ“– Leyendo Trabajadores_RAPEL...');
    const rapel = leerHojaTrabajadores('Trabajadores_RAPEL');
    Logger.log('   âœ“ ' + rapel.length + ' filas');

    Logger.log('ðŸ“– Leyendo Trabajadores_VERFRUT...');
    const verfrut = leerHojaTrabajadores('Trabajadores_VERFRUT');
    Logger.log('   âœ“ ' + verfrut.length + ' filas');

    Logger.log('ðŸŒ Enviando a Azure...');
    const response = UrlFetchApp.fetch(AZURE_FUNCTION_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-functions-key': AZURE_FUNCTION_KEY },
      payload: JSON.stringify({ rapel: rapel, verfrut: verfrut }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code === 200) {
      const result = JSON.parse(text);
      const elapsedMs = new Date() - startTime;
      Logger.log('âœ… Sync OK en ' + elapsedMs + 'ms');
      Logger.log('   RAPEL:   recibidos=' + result.results.rapel.total_recibidos +
                 ', insertados=' + result.results.rapel.inserted);
      Logger.log('   VERFRUT: recibidos=' + result.results.verfrut.total_recibidos +
                 ', insertados=' + result.results.verfrut.inserted);
      return result;
    } else {
      Logger.log('âŒ HTTP ' + code + ': ' + text);
      throw new Error('Sync fallÃ³ con HTTP ' + code);
    }
  } catch (e) {
    Logger.log('âŒ Error: ' + e.message);
    Logger.log(e.stack);
    throw e;
  }
}

/**
 * Configura el trigger automÃ¡tico cada 6h.
 * Ejecutar UNA SOLA VEZ despuÃ©s de validar el sync manual.
 */
function configurarTriggerSyncTrabajadores() {
  // Eliminar triggers previos del mismo nombre
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'syncTrabajadoresAAzure') {
      ScriptApp.deleteTrigger(t);
      Logger.log('ðŸ—‘ EliminÃ© trigger previo');
    }
  });

  // Crear trigger cada 6h
  ScriptApp.newTrigger('syncTrabajadoresAAzure')
    .timeBased()
    .everyHours(6)
    .create();

  Logger.log('âœ… Trigger configurado: cada 6 horas');
}
function testGetEstadisticasFix() {
  const r = getEstadisticas({ rol: 'administrador', empresa: 'AMBAS' });
  if (r.success) {
    Logger.log('âœ… getEstadisticas OK');
    Logger.log('Total: ' + r.data.total);
    Logger.log('Hoy: ' + r.data.hoy);
    Logger.log('Mes: ' + r.data.mes);
    Logger.log('En proceso: ' + r.data.porEstado['EN PROCESO']);
  } else {
    Logger.log('âŒ Error: ' + JSON.stringify(r));
  }
}function testActualizarFirebaseRapido() {
  actualizarFirebaseRapido({
    fecha_atencion: '2026-05-12',
    estado: 'EN PROCESO',
    empresa: 'VERFRUT',
    supervisor: 'TEST_FECHA'
  });
  Logger.log('âœ… Ejecutado. VerificÃ¡ Firebase ahora.');
}
function testGetEstadisticasFix() {
  const r = getEstadisticas({ rol: 'administrador', empresa: 'AMBAS' });
  if (r.success) {
    Logger.log('âœ… getEstadisticas OK');
    Logger.log('Total: ' + r.data.total);
    Logger.log('Hoy: ' + r.data.hoy);
    Logger.log('Mes: ' + r.data.mes);
    Logger.log('En proceso: ' + r.data.porEstado['EN PROCESO']);
  }
}
function auditUsuarios() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ws = ss.getSheetByName('usuarios') || ss.getSheetByName('Usuarios');
  if (!ws) { Logger.log('âŒ Hoja no encontrada'); return; }
  
  const rows = ws.getDataRange().getValues();
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('ðŸ“Š AUDIT HOJA USUARIOS');
  Logger.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  Logger.log('Total filas (con header): ' + rows.length);
  Logger.log('Total usuarios:           ' + (rows.length - 1));
  Logger.log('Total columnas:           ' + (rows[0] ? rows[0].length : 0));
  Logger.log('');
  Logger.log('ðŸ“‹ HEADERS:');
  if (rows[0]) rows[0].forEach((h, i) => Logger.log('  Col ' + String.fromCharCode(65 + i) + ' (' + i + '): ' + h));
  Logger.log('');
  Logger.log('ðŸ‘¤ SAMPLE PRIMER USUARIO (sin password):');
  if (rows[1]) {
    rows[1].forEach((v, i) => {
      const valor = (i === 2) ? '[PASSWORD OCULTA]' : v;
      Logger.log('  ' + String.fromCharCode(65 + i) + ': ' + valor);
    });
  }
  Logger.log('');
  Logger.log('ðŸ” PASSWORDS ANALYSIS:');
  let textoPlano = 0, hasheadas = 0, vacias = 0;
  for (let i = 1; i < rows.length; i++) {
    const p = String(rows[i][2] || '');
    if (!p) vacias++;
    else if (p.length === 60 && p.startsWith('$2')) hasheadas++;
    else textoPlano++;
  }
  Logger.log('  Texto plano: ' + textoPlano);
  Logger.log('  Hasheadas:   ' + hasheadas);
  Logger.log('  VacÃ­as:      ' + vacias);
  Logger.log('');
  Logger.log('ðŸ‘¥ DISTRIBUCIÃ“N ROLES:');
  const roles = {};
  for (let i = 1; i < rows.length; i++) {
    const r = String(rows[i][4] || '').toLowerCase().trim();
    roles[r] = (roles[r] || 0) + 1;
  }
  Object.keys(roles).forEach(r => Logger.log('  ' + r + ': ' + roles[r]));
}
// ============================================================
// SYNC USUARIOS Sheets â†’ Azure SQL
// ============================================================

const AZURE_USUARIOS_SYNC_URL = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/usuarios/sync';

function syncUsuariosAAzure() {
  const startTime = new Date();
  Logger.log('ðŸš€ Iniciando sync Usuarios â†’ Azure SQL');

  try {
    const apiKey = AZURE_FUNCTION_KEY;
    if (!apiKey) throw new Error('AZURE_FUNCTION_KEY no configurado');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('usuarios') || ss.getSheetByName('Usuarios');
    if (!ws) throw new Error('Hoja usuarios no encontrada');

    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) {
      Logger.log('âš ï¸ Sin usuarios para sincronizar');
      return;
    }

    Logger.log('ðŸ“– Leyendo ' + (rows.length - 1) + ' usuarios...');

    // Mapeo segÃºn headers: A=id, B=usuario, C=password, D=nombre, E=rol, F=empresa,
    //                      G=activo, H=fecha_creacion, I=correo, J=cargo, K=sector
    const usuarios = rows.slice(1).filter(r => r[0] && r[1]).map(r => {
      const fechaCreacion = (r[7] instanceof Date)
        ? Utilities.formatDate(r[7], 'America/Lima', 'yyyy-MM-dd HH:mm:ss')
        : (r[7] ? String(r[7]) : null);

      return {
        id_sistema:     String(r[0] || '').trim(),
        usuario:        String(r[1] || '').trim(),
        password:       String(r[2] || '').trim(),
        nombre:         String(r[3] || '').trim(),
        rol:            String(r[4] || '').trim().toLowerCase(),
        empresa:        String(r[5] || '').trim().toUpperCase(),
        activo:         String(r[6]).trim().toUpperCase() === 'TRUE',
        fecha_creacion: fechaCreacion,
        correo:         String(r[8] || '').trim(),
        cargo:          String(r[9] || '').trim(),
        sector:         String(r[10] || '').trim()
      };
    });

    Logger.log('âœ“ ' + usuarios.length + ' usuarios listos para enviar');
    Logger.log('ðŸŒ Enviando a Azure...');

    const response = UrlFetchApp.fetch(AZURE_USUARIOS_SYNC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-functions-key': apiKey },
      payload: JSON.stringify({ usuarios: usuarios }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code === 200) {
      const result = JSON.parse(text);
      const elapsedMs = new Date() - startTime;
      Logger.log('âœ… Sync OK en ' + elapsedMs + 'ms');
      Logger.log('   Total recibidos: ' + result.total_recibidos);
      Logger.log('   Insertados:      ' + result.inserted);
      Logger.log('   Actualizados:    ' + result.updated);
      Logger.log('   Fallidos:        ' + result.failed);
      if (result.errors && result.errors.length > 0) {
        Logger.log('   Errores:');
        result.errors.forEach(e => Logger.log('     - ' + JSON.stringify(e)));
      }
      return result;
    } else {
      Logger.log('âŒ HTTP ' + code + ': ' + text);
      throw new Error('Sync fallÃ³ con HTTP ' + code);
    }
  } catch (e) {
    Logger.log('âŒ Error: ' + e.message);
    throw e;
  }
}
function _recrearTriggerSyncTrabajadores() {
  // 1. DiagnÃ³stico: listar triggers actuales
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('=== Triggers actuales: ' + triggers.length + ' ===');
  triggers.forEach(function(t) {
    Logger.log('  - ' + t.getHandlerFunction() + ' | tipo: ' + t.getEventType());
  });

  // 2. Borrar TODOS los triggers de syncTrabajadoresAAzure (ghost o no)
  var borrados = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'syncTrabajadoresAAzure') {
      ScriptApp.deleteTrigger(t);
      borrados++;
    }
  });
  Logger.log('ðŸ—‘ï¸ Triggers de syncTrabajadoresAAzure borrados: ' + borrados);

  // 3. Crear trigger NUEVO cada 6 horas
  ScriptApp.newTrigger('syncTrabajadoresAAzure')
    .timeBased()
    .everyHours(6)
    .create();
  Logger.log('âœ… Trigger nuevo creado: syncTrabajadoresAAzure cada 6 horas');

  // 4. Verificar
  var final = ScriptApp.getProjectTriggers();
  var ok = false;
  final.forEach(function(t) {
    if (t.getHandlerFunction() === 'syncTrabajadoresAAzure') {
      ok = true;
      Logger.log('ðŸ”Ž Trigger activo | ID: ' + t.getUniqueId());
    }
  });
  Logger.log(ok ? 'âœ… VERIFICACION OK' : 'âŒ FALLO: no se encontro el trigger');
}
/* ============================================================
   MÃ“DULO MANTENIMIENTO DE UNIDADES â€” Backend GAS (COMPLETO)
   Estructura hoja "Registro de Mantenimiento" (18 columnas A-R):
   A ID_Solicitud  B Fecha_Solicitud  C DNI  D Nombre_Solicitante
   E Empresa  F Cod_Interno  G Unidad  H N_Licencia  I Tipo_Licencia
   J Revalidacion_Licencia  K Estado_Licencia  L Kilometraje
   M Tipo_Mantenimiento  N Observaciones  O Estado_Solicitud
   P Fecha_Programada  Q Comentario_Admin  R Fecha_Respuesta_Admin
 
   Las funciones devuelven OBJETOS PLANOS (handle() los envuelve).
   Usa la constante SPREADSHEET_ID ya existente en codigo.gs.
   ============================================================ */
 
var _HOJA_RESPONSABLES = 'BB.DD. RESPONSABLES';
var _HOJA_REGISTRO     = 'Registro de Mantenimiento';
var _CORREO_ADMIN      = 'joel.timoteo@unifrutti.com';
 
/* Formatea fecha (Date o string) a dd/MM/yyyy */
function _fmtFechaMant(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'America/Lima', 'dd/MM/yyyy');
  }
  return String(v).trim();
}
 
/* ------------------------------------------------------------
   1) BUSCAR responsable por DNI  (recibe params)
   BB.DD. RESPONSABLES: A=DNI B=Nombre C=correo D=cargo E=MODELO
   F=MARCA G=COD.INTERNO ... N=NÂ°LICENCIA(idx13) O=F.EXPEDICION(14)
   P=F.REVALIDACION(15) Q=EMPRESA(16)
   ------------------------------------------------------------ */
function buscarResponsableMantenimiento(params) {
  try {
    var dni = String((params && params.dni) || '').trim();
    if (!/^\d{8}$/.test(dni)) return { ok:false, msg:'DNI invÃ¡lido (8 dÃ­gitos)' };
 
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(_HOJA_RESPONSABLES);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_RESPONSABLES };
 
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === dni) {
        return { ok:true, data: {
          nombre:        String(data[i][1]  || '').trim(),  // B
          correo:        String(data[i][2]  || '').trim(),  // C
          cargo:         String(data[i][3]  || '').trim(),  // D
          modelo:        String(data[i][4]  || '').trim(),  // E
          marca:         String(data[i][5]  || '').trim(),  // F
          codInterno:    String(data[i][6]  || '').trim(),  // G
          numLicencia:   String(data[i][13] || '').trim(),  // N  <- AUTOMÃTICO
          fExpedicion:   _fmtFechaMant(data[i][14]),        // O
          fRevalidacion: _fmtFechaMant(data[i][15]),        // P
          empresa:       String(data[i][16] || '').trim()   // Q
        }};
      }
    }
    return { ok:false, msg:'DNI no encontrado en responsables' };
  } catch (err) {
    return { ok:false, msg:'Error: ' + err.message };
  }
}
 
/* ------------------------------------------------------------
   2) GUARDAR solicitud + CORREO al admin  (recibe body)
   Hoja "Registro de Mantenimiento" columnas A-R (18)
   ------------------------------------------------------------ */
function guardarSolicitudMantenimiento(d) {
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(_HOJA_REGISTRO);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_REGISTRO };
 
    var last = sh.getLastRow();
    var id   = 'SOL-' + ('000' + last).slice(-3);
    var ahora = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm');
 
    sh.appendRow([
      id,                                          // A ID_Solicitud
      ahora,                                       // B Fecha_Solicitud
      d.dni || '',                                 // C DNI
      d.nombre || '',                              // D Nombre_Solicitante
      d.empresa || '',                             // E Empresa
      d.codInterno || '',                          // F Cod_Interno
      ((d.modelo||'') + ' ' + (d.marca||'')).trim(), // G Unidad
      d.numLicencia || '',                         // H N_Licencia
      d.tipoLicencia || '',                        // I Tipo_Licencia
      d.fRevalidacion || '',                       // J Revalidacion_Licencia
      d.estadoLicencia || '',                      // K Estado_Licencia
      d.kilometraje || '',                         // L Kilometraje
      d.tipoMantenimiento || '',                   // M Tipo_Mantenimiento
      d.observaciones || '',                       // N Observaciones
      'PENDIENTE',                                 // O Estado_Solicitud
      '',                                          // P Fecha_Programada
      '',                                          // Q Comentario_Admin
      '',                                          // R Fecha_Respuesta_Admin
      d.solicitante || ''                          // S Usuario_Solicitante
    ]);
 
    try {
      var asunto = 'ðŸ”§ Nueva Solicitud de Mantenimiento â€” ' + id + ' (' + (d.nombre||'') + ')';
      var html =
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">' +
        '<div style="background:#0a2463;color:#fff;padding:20px;border-radius:8px 8px 0 0">' +
        '<h2 style="margin:0;font-size:18px">Nueva Solicitud de Mantenimiento</h2>' +
        '<p style="margin:4px 0 0;font-size:13px;opacity:.85">' + id + ' &middot; ' + ahora + '</p></div>' +
        '<div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px">' +
        '<h3 style="color:#0a2463;font-size:14px;margin:0 0 8px">Solicitante</h3>' +
        '<p style="margin:2px 0;font-size:13px"><b>Nombre:</b> ' + (d.nombre||'') + ' &middot; <b>DNI:</b> ' + (d.dni||'') + '</p>' +
        '<p style="margin:2px 0;font-size:13px"><b>Empresa:</b> ' + (d.empresa||'') + '</p>' +
        '<h3 style="color:#0a2463;font-size:14px;margin:16px 0 8px">Unidad</h3>' +
        '<p style="margin:2px 0;font-size:13px"><b>Unidad:</b> ' + (d.modelo||'') + ' ' + (d.marca||'') + ' &middot; <b>CÃ³d:</b> ' + (d.codInterno||'') + '</p>' +
        '<p style="margin:2px 0;font-size:13px"><b>Kilometraje:</b> ' + (d.kilometraje||'') + ' km</p>' +
        '<h3 style="color:#0a2463;font-size:14px;margin:16px 0 8px">Licencia</h3>' +
        '<p style="margin:2px 0;font-size:13px"><b>N&deg;:</b> ' + (d.numLicencia||'') + ' &middot; <b>Tipo:</b> ' + (d.tipoLicencia||'') + '</p>' +
        '<p style="margin:2px 0;font-size:13px"><b>Revalidaci&oacute;n:</b> ' + (d.fRevalidacion||'') + ' &middot; <b>Estado:</b> ' + (d.estadoLicencia||'') + '</p>' +
        '<h3 style="color:#0a2463;font-size:14px;margin:16px 0 8px">Mantenimiento solicitado</h3>' +
        '<p style="margin:2px 0;font-size:13px"><b>Tipo:</b> ' + (d.tipoMantenimiento||'') + '</p>' +
        '<p style="margin:2px 0;font-size:13px"><b>Observaciones:</b> ' + (d.observaciones||'(sin observaciones)') + '</p>' +
        '<div style="background:#fef3c7;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#92400e">' +
        '&#9200; Pendiente de programar fecha desde el Panel Admin.</div>' +
        '</div></div>';
      MailApp.sendEmail({ to:_CORREO_ADMIN, subject:asunto, htmlBody:html });
    } catch (eMail) { Logger.log('Mant correo admin: ' + eMail.message); }
 
    return { ok:true, id:id };
  } catch (err) {
    return { ok:false, msg:'Error: ' + err.message };
  }
}
 
/* ------------------------------------------------------------
   3) LISTAR solicitudes  (recibe params)
   - params.dni -> solo ese DNI (vista usuario)
   - sin dni    -> todas (panel admin)
   ------------------------------------------------------------ */
function listarSolicitudesMantenimiento(params) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(_HOJA_REGISTRO);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_REGISTRO };
 
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return { ok:true, data: [] };
 
    // Mapa DNI -> correo (desde BB.DD. RESPONSABLES, una sola lectura)
    var correos = {};
    var shR = ss.getSheetByName(_HOJA_RESPONSABLES);
    if (shR) {
      var dr = shR.getDataRange().getValues();
      for (var k = 1; k < dr.length; k++) {
        correos[String(dr[k][0]).trim()] = String(dr[k][2] || '').trim(); // A=DNI, C=correo
      }
    }
 
    var filtroDni  = String((params && params.dni) || '').trim();
    var filtroUser = String((params && params.solicitante) || '').trim().toLowerCase();
    var out = [];
    for (var i = data.length - 1; i >= 1; i--) {     // mÃ¡s recientes primero
      var r = data[i];
      var dni = String(r[2] || '').trim();           // C
      var usuario = String(r[18] || '').trim().toLowerCase(); // S Usuario_Solicitante
      if (filtroDni  && dni !== filtroDni) continue;
      if (filtroUser && usuario !== filtroUser) continue;
      out.push({
        id:             String(r[0]  || ''),         // A
        fechaSolicitud: _fmtFechaMant(r[1]),         // B
        dni:            dni,                          // C
        nombre:         String(r[3]  || ''),         // D
        empresa:        String(r[4]  || ''),         // E
        codInterno:     String(r[5]  || ''),         // F
        unidad:         String(r[6]  || ''),         // G
        numLicencia:    String(r[7]  || ''),         // H
        tipoLicencia:   String(r[8]  || ''),         // I
        revalidacion:   _fmtFechaMant(r[9]),         // J
        estadoLic:      String(r[10] || ''),         // K
        km:             String(r[11] || ''),         // L
        tipo:           String(r[12] || ''),         // M
        observaciones:  String(r[13] || ''),         // N
        estado:         String(r[14] || 'PENDIENTE'),// O
        fechaProgramada:_fmtFechaMant(r[15]),        // P
        comentarioAdmin:String(r[16] || ''),         // Q
        solicitante:    String(r[18] || ''),         // S
        correo:         correos[dni] || ''           // join BB.DD.
      });
    }
    return { ok:true, data: out };
  } catch (err) {
    return { ok:false, msg:'Error: ' + err.message };
  }
}
 
/* ------------------------------------------------------------
   4) PROGRAMAR mantenimiento (admin)  (recibe body)
   body: { id, fechaProgramada, comentario, estado, admin }
   Actualiza O (estado), P (fecha prog), Q (comentario), R (fecha resp)
   y notifica por correo al solicitante.
   ------------------------------------------------------------ */
function programarMantenimiento(d) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(_HOJA_REGISTRO);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_REGISTRO };
 
    var data = sh.getDataRange().getValues();
    var fila = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(d.id).trim()) { fila = i + 1; break; }
    }
    if (fila === -1) return { ok:false, msg:'No se encontrÃ³ la solicitud ' + d.id };
 
    var ahora  = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm');
    var estado = (d.estado || 'PROGRAMADO').toUpperCase();
 
    sh.getRange(fila, 15).setValue(estado);                  // O Estado_Solicitud
    sh.getRange(fila, 16).setValue(d.fechaProgramada || ''); // P Fecha_Programada
    sh.getRange(fila, 17).setValue(d.comentario || '');      // Q Comentario_Admin
    sh.getRange(fila, 18).setValue(ahora);                   // R Fecha_Respuesta_Admin
 
    // Notificar al solicitante (correo desde BB.DD. RESPONSABLES por DNI)
    try {
      var dni    = String(data[fila-1][2] || '').trim();     // C
      var unidad = String(data[fila-1][6] || '').trim();     // G
      var correo = '';
      var shR = ss.getSheetByName(_HOJA_RESPONSABLES);
      if (shR && dni) {
        var dr = shR.getDataRange().getValues();
        for (var j = 1; j < dr.length; j++) {
          if (String(dr[j][0]).trim() === dni) { correo = String(dr[j][2] || '').trim(); break; }
        }
      }
      if (correo) {
        var asunto = 'ðŸ”§ Mantenimiento ' + (estado==='COMPLETADO'?'COMPLETADO':'PROGRAMADO') + ' â€” ' + d.id;
        var html =
          '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">' +
          '<div style="background:#0a2463;color:#fff;padding:20px;border-radius:8px 8px 0 0">' +
          '<h2 style="margin:0;font-size:18px">Tu mantenimiento fue ' + (estado==='COMPLETADO'?'completado':'programado') + '</h2></div>' +
          '<div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px">' +
          '<p style="font-size:13px"><b>Solicitud:</b> ' + d.id + ' &middot; <b>Unidad:</b> ' + unidad + '</p>' +
          '<div style="background:#dbeafe;border-radius:6px;padding:14px;margin:12px 0;text-align:center">' +
          '<div style="font-size:12px;color:#1e40af">FECHA DE MANTENIMIENTO</div>' +
          '<div style="font-size:24px;font-weight:bold;color:#0a2463">' + (d.fechaProgramada||'') + '</div></div>' +
          (d.comentario ? '<p style="font-size:13px"><b>Indicaciones:</b> ' + d.comentario + '</p>' : '') +
          '<p style="font-size:12px;color:#64748b;margin-top:14px">Coordinaci&oacute;n de Relaciones Laborales</p>' +
          '</div></div>';
        MailApp.sendEmail({ to:correo, subject:asunto, htmlBody:html });
      }
    } catch (eMail) { Logger.log('Mant correo solicitante: ' + eMail.message); }
 
    return { ok:true };
  } catch (err) {
    return { ok:false, msg:'Error: ' + err.message };
  }
}
 
/* ============================================================
   ROUTING â€” los 4 case dentro del switch de handle():
 
       case 'buscarResponsableMantenimiento': result = buscarResponsableMantenimiento(params); break;
       case 'guardarSolicitudMantenimiento':  result = guardarSolicitudMantenimiento(body);    break;
       case 'listarSolicitudesMantenimiento': result = listarSolicitudesMantenimiento(params); break;
       case 'programarMantenimiento':         result = programarMantenimiento(body);           break;
 
   ============================================================ */
 
 
/* ============================================================
   FUNCIÃ“N DE PRUEBA â€” ejecutar UNA VEZ desde el editor de
   Apps Script para AUTORIZAR el permiso de envÃ­o de correo.
   (Seleccionar _testCorreoMantenimiento en el desplegable y
    presionar Ejecutar. Aceptar los permisos que pida Google.)
   ============================================================ */
function _testCorreoMantenimiento() {
  MailApp.sendEmail({
    to: _CORREO_ADMIN,
    subject: 'âœ… Prueba de correo â€” MÃ³dulo Mantenimiento',
    htmlBody: '<p>Si recibÃ­s este correo, el envÃ­o automÃ¡tico del mÃ³dulo de mantenimiento <b>ya estÃ¡ autorizado y funcionando</b>.</p>'
  });
  Logger.log('Correo de prueba enviado a ' + _CORREO_ADMIN);
}
 
/* DiagnÃ³stico rÃ¡pido: cuÃ¡ntas columnas y filas tiene la hoja Registro */
function _diagMantenimiento() {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(_HOJA_REGISTRO);
  if (!sh) { Logger.log('NO existe la hoja ' + _HOJA_REGISTRO); return; }
  var data = sh.getDataRange().getValues();
  Logger.log('Filas: ' + data.length + ' | Columnas: ' + (data[0] ? data[0].length : 0));
  Logger.log('Encabezados: ' + JSON.stringify(data[0]));
  if (data.length > 1) Logger.log('Ãšltima fila: ' + JSON.stringify(data[data.length-1]));
}
/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  PACK COMPLETO â€” Cache + Pre-warm del Resumen General
 *  
 *  Contiene:
 *    1. resumenEjecutivoCached      â€” wrapper de cache (10 min)
 *    2. getResumenGeneralCached     â€” wrapper de cache + slice 100
 *    3. prewarmCacheResumen         â€” calcula y deja cache caliente
 *    4. configurarTriggerPrewarmResumen â€” crea trigger cada 5 min
 *    5. limpiarCacheResumen         â€” helper manual
 *  
 *  RESULTADO:
 *    TODA carga del Resumen General <500ms, incluso la primera del dÃ­a.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  1) resumenEjecutivoCached
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function resumenEjecutivoCached(body) {
  try {
    body = body || {};
    const empresa = String(body.empresa || 'AMBAS').toUpperCase();
    const forzar  = body.forzar === true || body.forzar === 'true';
    
    const cache = CacheService.getScriptCache();
    const cacheKey = 'resumenEjecutivo_v3_' + empresa;
    
    if (!forzar) {
      try {
        const cached = cache.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed._fromCache = true;
          return parsed;
        }
      } catch(e) { Logger.log('Cache read: ' + e); }
    }
    
    const result = resumenEjecutivo(body);
    
    if (result && result.success) {
      try {
        result._cachedAt = Date.now();
        const ser = JSON.stringify(result);
        if (ser.length < 95000) {
          cache.put(cacheKey, ser, 600);  // 10 min
        }
      } catch(e) { Logger.log('Cache write: ' + e); }
    }
    
    return result;
  } catch(e) {
    Logger.log('resumenEjecutivoCached fatal: ' + e);
    return resumenEjecutivo(body);
  }
}
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  2) getResumenGeneralCached (cache + slice 100)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getResumenGeneralCached(p) {
  try {
    p = p || {};
    const empresa = String(p.empresa || 'AMBAS').toUpperCase();
    const mes     = String(p.mes  || '');
    const anio    = String(p.anio || '');
    const forzar  = p.forzar === true || p.forzar === 'true';
    
    const cache = CacheService.getScriptCache();
    const cacheKey = 'getResumenGeneral_v2_' + empresa + '_' + mes + '_' + anio;
    
    if (!forzar) {
      try {
        const cached = cache.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed._fromCache = true;
          return parsed;
        }
      } catch(e) { Logger.log('Cache read: ' + e); }
    }
    
    const result = getResumenGeneral(p);
    
    // Reducir slice de 1000 a 100
    if (result && result.success && result.data && Array.isArray(result.data.lista)) {
      result.data.lista = result.data.lista.slice(0, 100);
    }
    
    if (result && result.success) {
      try {
        result._cachedAt = Date.now();
        const ser = JSON.stringify(result);
        if (ser.length < 95000) {
          cache.put(cacheKey, ser, 600);  // 10 min
        }
      } catch(e) { Logger.log('Cache write: ' + e); }
    }
    
    return result;
  } catch(e) {
    Logger.log('getResumenGeneralCached fatal: ' + e);
    return getResumenGeneral(p);
  }
}
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  3) prewarmCacheResumen â€” corre cada 5 min, llena el cache
//     antes de que los usuarios pidan datos
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function prewarmCacheResumen() {
  const inicio = new Date();
  try {
    // Pre-calcular solo AMBAS (lo mÃ¡s usado). RAPEL y VERFRUT
    // se cachean en demanda cuando alguien los pide.
    resumenEjecutivoCached({ empresa: 'AMBAS', forzar: true });
    getResumenGeneralCached({ empresa: 'AMBAS', forzar: true });
    
    const elapsed = (new Date() - inicio) / 1000;
    Logger.log('âœ… Pre-warm Resumen OK en ' + elapsed.toFixed(1) + 's');
  } catch(e) {
    Logger.log('âŒ Pre-warm error: ' + e);
  }
}
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  4) configurarTriggerPrewarmResumen â€” EJECUTAR UNA VEZ
//     Crea trigger cada 5 minutos. Si ya existe, no duplica.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function configurarTriggerPrewarmResumen() {
  // Eliminar triggers viejos del mismo handler (evita duplicados)
  const triggers = ScriptApp.getProjectTriggers();
  let eliminados = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'prewarmCacheResumen') {
      ScriptApp.deleteTrigger(t);
      eliminados++;
    }
  });
  if (eliminados > 0) Logger.log('ðŸ—‘ Triggers previos eliminados: ' + eliminados);
  
  // Crear trigger nuevo cada 5 minutos
  ScriptApp.newTrigger('prewarmCacheResumen')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('âœ… Trigger creado: prewarmCacheResumen cada 5 minutos');
  
  // Ejecutar primera vez ya mismo para llenar el cache de entrada
  Logger.log('ðŸ”¥ Ejecutando primera vez para llenar cache...');
  prewarmCacheResumen();
  Logger.log('âœ… Todo listo. El cache se va a mantener caliente automÃ¡ticamente.');
}
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  5) limpiarCacheResumen â€” helper manual
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function limpiarCacheResumen() {
  const cache = CacheService.getScriptCache();
  ['AMBAS', 'RAPEL', 'VERFRUT'].forEach(function(emp) {
    cache.remove('resumenEjecutivo_v3_' + emp);
    cache.remove('getResumenGeneral_v2_' + emp + '__');
  });
  Logger.log('âœ… Cache de Resumen limpiado');
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  5) getResponsablesEnRango â€” NUEVA funciÃ³n para el combo dinÃ¡mico
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getResponsablesEnRango(p) {
  try {
    const fechaDesde = String((p && p.fechaDesde) || '').trim();
    const fechaHasta = String((p && p.fechaHasta) || '').trim();
 
    // Sin fechas â†’ todos los usuarios activos
    if (!fechaDesde && !fechaHasta) {
      const rows = getSheet('Usuarios').getDataRange().getValues();
      const lista = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        const usuario = String(rows[i][1] || '').trim();
        const activo  = String(rows[i][6]).trim().toUpperCase() === 'TRUE';
        if (usuario && activo) lista.push(usuario);
      }
      lista.sort();
      return { success: true, data: lista };
    }
 
    // Con fechas â†’ solo supervisores que tienen atenciones en el rango
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const anio = new Date().getFullYear();
    const hojas = [
      'BB. DE REGISTROS 2024',
      'BB. DE REGISTROS 2025',
      'BB. DE REGISTROS ' + anio,
      'BB. DE REGISTROS'
    ];
 
    const supSet = new Set();
    hojas.forEach(function(nombreHoja) {
      const ws = ss.getSheetByName(nombreHoja);
      if (!ws) return;
      const rows = ws.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        let fechaAt = '';
        if (rows[i][1] instanceof Date) {
          fechaAt = Utilities.formatDate(rows[i][1], 'GMT-5', 'yyyy-MM-dd');
        } else {
          fechaAt = String(rows[i][1] || '').substring(0, 10);
        }
        if (fechaDesde && fechaAt && fechaAt < fechaDesde) continue;
        if (fechaHasta && fechaAt && fechaAt > fechaHasta) continue;
 
        const sup = String(rows[i][18] || '').trim();
        if (sup) supSet.add(sup);
      }
    });
 
    const lista = Array.from(supSet).sort();
    return { success: true, data: lista };
  } catch(e) {
    Logger.log('getResponsablesEnRango error: ' + e);
    return { success: false, error: e.toString() };
  }
}
 // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  6) limpiarCacheV2 â€” ejecutar 1 vez para invalidar cache viejo
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function limpiarCacheV2() {
  const cache = CacheService.getScriptCache();
  for (let i = 0; i < 20; i++) {
    cache.remove('v2_Trabajadores_RAPEL_' + i);
    cache.remove('v2_Trabajadores_VERFRUT_' + i);
  }
  cache.remove('v2_Trabajadores_RAPEL_meta');
  cache.remove('v2_Trabajadores_VERFRUT_meta');
  Logger.log('Cache v2 limpiado OK');
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  PATCH VISITAS DE CAMPO v2 â€” Fotos URL + Enlace PDF Azure
 *
 *  Reemplaza al PATCH_VISITAS_FOTOS anterior (este lo incluye y suma).
 *  Schema robusto: detecta columnas dinÃ¡micamente por header.
 *  Si "Enlace Informe PDF" no existe en la hoja, lo agrega al final.
 *
 *  PEGAR AL FINAL del archivo codigo.gs en el editor de Apps Script.
 *  Las funciones nuevas con mismo nombre sobrescriben las viejas
 *  por hoisting de JavaScript.
 *
 *  DESPUÃ‰S DE PEGAR:
 *    1. Guardar (Ctrl+S)
 *    2. Click "Implementar" â†’ "Administrar implementaciones" â†’ âœï¸
 *    3. VersiÃ³n: "Nueva versiÃ³n" â†’ "Implementar"
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
 
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  HELPER: asegurar que existe columna "Enlace Informe PDF"
//  Si no existe, la crea al final. Devuelve el Ã­ndice (1-based).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _asegurarColEnlaceInformeVisita(ws) {
  if (!ws) return -1;
  const lastCol = ws.getLastColumn();
  if (lastCol < 1) return -1;
  const headers = ws.getRange(1, 1, 1, lastCol).getValues()[0];
  // Buscar variantes posibles
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (h === 'enlace informe pdf' || h === 'enlace informe' || h === 'pdf informe' || h === 'pdf azure' || h === 'enlace pdf') {
      return i + 1; // 1-based
    }
  }
  // No existe â†’ crearla al final
  const nuevaCol = lastCol + 1;
  ws.getRange(1, nuevaCol).setValue('Enlace Informe PDF');
  ws.getRange(1, nuevaCol).setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
  Logger.log('Columna "Enlace Informe PDF" creada en col ' + nuevaCol);
  return nuevaCol;
}
 
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  saveVisita â€” guarda URLs de fotos en col 21 + URL del PDF dinÃ¡mico
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function saveVisita(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) {
      ws = ss.insertSheet('Visitas_Campo');
      ws.appendRow([
        'NÂ°','Fecha Registro','Empresa','Supervisor','DNI','Correo',
        'Fundo','Punto','Fecha Inicio','Fecha Fin','Semana',
        'Fecha Informe','Para','Asunto','Desarrollo','Rutas',
        'Acciones','Compromisos','Observaciones','Motivo Retraso',
        'Fotos URLs','Estado','Registrado Por',
        'Temporada','DÃ­as Transcurridos','DÃ­as Permitidos','DÃ­as Retraso','% Avance','% Retraso',
        'Enlace Informe PDF'
      ]);
    }
 
    const lastRow = ws.getLastRow();
    const nro = lastRow;
 
    // Calcular dÃ­as hÃ¡biles y estado
    let estado = 'EN PLAZO';
    if (d.fecha_fin) {
      const ff  = new Date(d.fecha_fin);
      const hoy = new Date();
      let dias = 0, cur = new Date(ff);
      cur.setDate(cur.getDate() + 1);
      while (cur <= hoy) {
        if (cur.getDay() !== 0) dias++;
        cur.setDate(cur.getDate() + 1);
      }
      if (dias > 7) estado = 'RETRASADO';
    }
 
    // Fotos URLs (col 21)
    let fotosStr = '';
    if (Array.isArray(d.fotos_urls)) {
      fotosStr = d.fotos_urls.filter(Boolean).join('|');
    } else if (typeof d.fotos === 'string' && d.fotos.indexOf('http') !== -1) {
      fotosStr = d.fotos;
    } else {
      fotosStr = '';
    }
 
    // appendRow con las 29 columnas estÃ¡ndar
    ws.appendRow([
      nro,
      new Date(),
      d.empresa || '',
      d.supervisor || '',
      d.dni || '',
      d.correo || '',
      d.fundo || '',
      d.punto || '',
      d.fecha_inicio || '',
      d.fecha_fin || '',
      d.semana || '',
      d.fecha_informe || '',
      d.para || '',
      d.asunto || '',
      d.desarrollo || '',
      d.rutas || '',
      d.acciones || '',
      d.compromisos || '',
      d.observaciones || '',
      d.motivo || '',
      fotosStr,                     // col 21: URLs de fotos
      estado,                       // col 22
      d.registrado_por || '',       // col 23
      d.temporada || '',            // col 24
      d.dias_transcurridos || 0,    // col 25
      d.dias_permitidos || 1,       // col 26
      d.dias_retraso || 0,          // col 27
      d.pct_avance || '0.00',       // col 28
      d.pct_retraso || '0.00'       // col 29
    ]);
 
    // Escribir el enlace_informe PDF en la columna dinÃ¡mica
    if (d.enlace_informe) {
      const colEnlace = _asegurarColEnlaceInformeVisita(ws);
      if (colEnlace > 0) {
        const filaInsertada = ws.getLastRow();
        ws.getRange(filaInsertada, colEnlace).setValue(String(d.enlace_informe));
        Logger.log('Enlace PDF guardado en fila ' + filaInsertada + ' col ' + colEnlace);
      }
    }
 
    try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase mÃ³dulos: ' + em); }
    return {
      success: true,
      nro: nro,
      estado: estado,
      fotos_count: fotosStr ? fotosStr.split('|').length : 0,
      enlace_informe: d.enlace_informe || ''
    };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
 
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  getVisitas â€” devuelve fotos_urls y enlace_informe (detectado dinÃ¡mico)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getVisitas(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) return { success: true, data: [], debug: 'hoja no encontrada' };
 
    // Detectar dinÃ¡micamente la columna del enlace_informe (Ã­ndice 0-based)
    const lastCol = ws.getLastColumn();
    const headers = ws.getRange(1, 1, 1, lastCol).getValues()[0];
    let idxEnlace = -1;
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i] || '').toLowerCase().trim();
      if (h === 'enlace informe pdf' || h === 'enlace informe' || h === 'pdf informe' || h === 'pdf azure' || h === 'enlace pdf') {
        idxEnlace = i;
        break;
      }
    }
 
    const allRows = ws.getDataRange().getValues();
    const rawRows = allRows.slice(1).filter(function(r){ return r[0] !== '' && r[0] !== null && r[0] !== undefined; });
    if (!rawRows.length) return { success: true, data: [] };
 
    var data = rawRows.map(function(r) {
      // Parsear col 21 (Ã­ndice 20)
      let fotos_urls = [];
      let fotos_count = 0;
      const rawFotos = r[20];
      if (typeof rawFotos === 'string' && rawFotos.indexOf('http') !== -1) {
        fotos_urls = rawFotos.split('|').filter(Boolean);
        fotos_count = fotos_urls.length;
      } else if (typeof rawFotos === 'number') {
        fotos_count = rawFotos;
      } else if (typeof rawFotos === 'string' && rawFotos.match(/^\d+$/)) {
        fotos_count = parseInt(rawFotos);
      }
 
      // Enlace PDF: usar columna dinÃ¡mica si existe, sino fallback a col 24 (legado)
      let enlace_informe = '';
      if (idxEnlace >= 0) {
        enlace_informe = String(r[idxEnlace] || '');
      } else {
        enlace_informe = String(r[23] || '');
      }
 
      return {
        nro:            r[0],
        fecha_reg:      r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd HH:mm') : String(r[1]||'').substring(0,16),
        empresa:        String(r[2]||''),
        supervisor:     String(r[3]||'').trim(),
        dni:            r[4],
        correo:         String(r[5]||''),
        fundo:          String(r[6]||''),
        sector:         String(r[6]||''),
        punto:          String(r[7]||''),
        fecha_inicio:   r[8] instanceof Date ? Utilities.formatDate(r[8],'America/Lima','yyyy-MM-dd') : String(r[8]||'').substring(0,10),
        fecha_fin:      r[9] instanceof Date ? Utilities.formatDate(r[9],'America/Lima','yyyy-MM-dd') : String(r[9]||'').substring(0,10),
        semana:         r[10],
        fecha_informe:  r[11] instanceof Date ? Utilities.formatDate(r[11],'America/Lima','yyyy-MM-dd') : String(r[11]||'').substring(0,10),
        para:           String(r[12]||''),
        asunto:         String(r[13]||''),
        desarrollo:     String(r[14]||''),
        rutas:          String(r[15]||''),
        acciones:       String(r[16]||''),
        compromisos:    String(r[17]||''),
        observaciones:  String(r[18]||''),
        motivo:         String(r[19]||''),
        fotos:          rawFotos,             // raw (compatibilidad)
        fotos_urls:     fotos_urls,           // array de URLs Azure
        fotos_count:    fotos_count,
        estado:         String(r[21]||''),
        registrado_por: String(r[22]||''),
        enlace_informe: enlace_informe,       // URL del PDF en Azure
        temporada:      idxEnlace === 23 ? '' : String(r[23]||''),  // si idxEnlace=23, "Temporada" se desplaza
        dias_transcurridos:  parseInt(r[24]) || 0,
        dias_permitidos:     parseInt(r[25]) || 1,
        dias_retraso:        parseInt(r[26]) || 0,
        pct_avance:          String(r[27]||'0.00'),
        pct_retraso:         String(r[28]||'0.00')
      };
    });
 
    if (p.empresa && p.empresa !== 'AMBAS') data = data.filter(function(v){ return v.empresa === p.empresa; });
    if (p.mes) data = data.filter(function(v){ return v.fecha_reg && new Date(v.fecha_reg).getMonth()+1 == p.mes; });
    if (p.supervisor) {
      var normStr = function(s) {
        return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      };
      var supBuscar = normStr(p.supervisor);
      data = data.filter(function(v){ return normStr(v.supervisor).indexOf(supBuscar) !== -1; });
    }
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  PACK MEJORAS CONSULTA POR DNI + BUSCAR TRABAJADOR
 *  Para pegar en el editor de Apps Script (Sistema RL v3.0)
 *
 *  CAMBIOS:
 *   1) cargarDatosTrabajadores  â†’ lee 19 cols + agrega cumpleanos
 *   2) getCacheKey              â†’ v2_ â†’ v3_ (invalida cache automÃ¡ticamente)
 *   3) buscarTrabajador         â†’ devuelve campo cumpleanos
 *   4) consultaDNI              â†’ acepta fechaDesde/fechaHasta/supervisor
 *                                  + enriquece con ruta/codigo/cumpleanos
 *   5) getResponsablesEnRango   â†’ NUEVA funciÃ³n para combo dinÃ¡mico
 *
 *  INSTRUCCIONES:
 *   A) Reemplazar las 4 funciones existentes con las versiones de abajo
 *      (usar Ctrl+F para encontrar las viejas y reemplazarlas)
 *   B) Agregar getResponsablesEnRango al final del archivo
 *   C) Agregar el case 'getResponsablesEnRango' en handle()
 *   D) Click en "Implementar versiÃ³n nueva" desde Administrar implementaciones
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
 
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO A) REEMPLAZAR cargarDatosTrabajadores
 * UbicaciÃ³n: lÃ­nea ~611 de codigo.gs
 * Cambios: lee 19 cols (antes 18) + agrega cumpleaÃ±os al array
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function cargarDatosTrabajadores(hoja) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(hoja);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  // CAMBIO: leer 19 columnas (antes 18) para incluir fecha_nacimiento (col 19, idx 18)
  const rows = sh.getRange(2, 1, lastRow - 1, 19).getValues();
  const datos = [];
  for (let i = 0; i < rows.length; i++) {
    const r   = rows[i];
    const dni = String(r[0] || '').trim().replace(/\.0$/, '');
    const nom = String(r[14] || '').trim();
    if (!dni && !nom) continue;
    datos.push([
      dni,                                    // 0: DNI
      nom,                                    // 1: Nombre
      String(r[6]  || '').trim(),             // 2: Sexo
      r[5] instanceof Date ? Utilities.formatDate(r[5],'GMT-5','yyyy-MM-dd') : String(r[5]||'').trim(), // 3: FIP
      String(r[10] || '').trim(),             // 4: Fundo
      String(r[7]  || '').trim(),             // 5: Cargo
      String(r[15] || '').trim(),             // 6: Ruta
      String(r[16] || '').trim(),             // 7: Codigo
      r[17] instanceof Date ? Utilities.formatDate(r[17],'GMT-5','yyyy-MM-dd') : String(r[17]||'').trim(), // 8: FTP
      String(r[13] || '').trim(),             // 9: Empresa
      String(r[8]  || '').trim(),             // 10: Regimen
      // NUEVO 11: CumpleaÃ±os (fecha_nacimiento, col 19, idx 18)
      r[18] instanceof Date ? Utilities.formatDate(r[18],'GMT-5','yyyy-MM-dd') : String(r[18]||'').trim()
    ]);
  }
  return datos;
}
 
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO B) REEMPLAZAR getCacheKey
 * UbicaciÃ³n: lÃ­nea ~639 de codigo.gs
 * Cambio: v2_ â†’ v3_ para invalidar el cache antiguo (que no tiene cumpleanos)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function getCacheKey(hoja) { return 'v3_' + hoja; }
 
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO C) REEMPLAZAR buscarTrabajador
 * UbicaciÃ³n: lÃ­nea ~601 de codigo.gs
 * Cambio: destructuring incluye cumpleanos + objeto devuelto tambien
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function buscarTrabajador(p) {
  const q      = (p.q || '').toLowerCase().trim();
  const empUp  = (p.empresa || '').toUpperCase();
  const empNorm = (empUp.indexOf('RAPEL') !== -1 && empUp.indexOf('VERFRUT') === -1) ? 'RAPEL'
                : (empUp.indexOf('VERFRUT') !== -1) ? 'VERFRUT'
                : 'AMBAS';
  if (!q || q.length < 2) return { success: true, data: [] };
  const esDNI = /^[0-9]+$/.test(q);
  let res = [];
  const buscar = (hoja, empresa) => {
    try {
      let datos = getDatosCached(hoja);
      if (!datos) { datos = cargarDatosTrabajadores(hoja); setDatosCached(hoja, datos); }
      for (let i = 0; i < datos.length && res.length < 20; i++) {
        // CAMBIO: destructuring incluye cumpleanos (Ã­ndice 11)
        const [dniRaw, nombre, sexo, fip, fundo, cargo, ruta, codigo, ftp, empSheet, regimen, cumpleanos] = datos[i];
        const dni   = esDNI && dniRaw.length === 7 ? '0' + dniRaw : dniRaw;
        const qNorm = esDNI && q.length === 8 && q.startsWith('0') ? q.substring(1) : q;
        const coincide = esDNI
          ? dni === q || dniRaw === q || dniRaw === qNorm
          : nombre.toLowerCase().includes(q);
        if (coincide) {
          res.push({
            dni, nombre, sexo,
            fecha_inicio_periodo:  fip||'',
            fecha_termino_periodo: ftp||'',
            empresa: empSheet || empresa,
            fundo, cargo, ruta, codigo,
            cumpleanos: cumpleanos || '',   // NUEVO campo
            regimen: regimen||'',
            fundo_actual: fundo,
            celular: ''
          });
        }
      }
    } catch(e) { Logger.log('buscarTrabajador error ' + hoja + ': ' + e.toString()); }
  };
  if (empNorm === 'RAPEL'   || empNorm === 'AMBAS') buscar('Trabajadores_RAPEL',   'RAPEL');
  if (empNorm === 'VERFRUT' || empNorm === 'AMBAS') buscar('Trabajadores_VERFRUT', 'VERFRUT');
  return { success: true, data: res };
}
 
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO D) REEMPLAZAR consultaDNI
 * UbicaciÃ³n: lÃ­nea ~470 de codigo.gs
 * Cambios:
 *   - Acepta params opcionales: fechaDesde, fechaHasta, supervisor
 *   - DNI ahora es opcional si hay otros filtros
 *   - Enriquece cada atenciÃ³n con ruta/codigo/cumpleanos (lookup contra Trabajadores)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function consultaDNI(p) {
  const dni        = String(p.dni        || '').trim();
  const fechaDesde = String(p.fechaDesde || '').trim();
  const fechaHasta = String(p.fechaHasta || '').trim();
  const supervisor = String(p.supervisor || '').trim().toLowerCase();
 
  if (!dni && !fechaDesde && !fechaHasta && !supervisor) {
    return { success: false, error: 'Ingresa un DNI o un rango de fechas para buscar' };
  }
  if (dni && dni.length < 7) {
    return { success: false, error: 'DNI invÃ¡lido (mÃ­nimo 7 dÃ­gitos)' };
  }
 
  const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anio = new Date().getFullYear();
  const hojas = [
    'BB. DE REGISTROS 2024',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS ' + anio,
    'BB. DE REGISTROS'
  ];
 
  // Normalizador para matching flexible (sin acentos, lowercase)
  const norm = function(s) {
    return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  };
  const supNorm = norm(supervisor);
 
  let lista = [];
  let trabajador = null;
  const vistos = new Set();
 
  hojas.forEach(function(nombreHoja) {
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) return;
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) return;
 
    for (let i = 1; i < rows.length; i++) {
      // Filtro DNI (col 7)
      if (dni && String(rows[i][7]).trim() !== dni) continue;
 
      // Filtro fecha (col 1 = fecha_atencion) â€” ESTE ES EL FIX
      let fechaAt = '';
      if (rows[i][1] instanceof Date) {
        fechaAt = Utilities.formatDate(rows[i][1], 'GMT-5', 'yyyy-MM-dd');
      } else {
        fechaAt = String(rows[i][1] || '').substring(0, 10);
      }
      if (fechaDesde && fechaAt && fechaAt < fechaDesde) continue;
      if (fechaHasta && fechaAt && fechaAt > fechaHasta) continue;
 
      // Filtro supervisor flexible: matchea contra cualquier columna
      // (col 18 = supervisor, col 23 = responsable_recepcion, col 27 = usuario_sistema)
      if (supervisor) {
        let encontrado = false;
        for (let ci = 0; ci < rows[i].length; ci++) {
          const val = norm(rows[i][ci]);
          if (val && val.indexOf(supNorm) !== -1) { encontrado = true; break; }
        }
        if (!encontrado) continue;
      }
 
      // Dedup
      const k = String(rows[i][0]) + '_' + nombreHoja;
      if (vistos.has(k)) continue;
      vistos.add(k);
 
      let o = {};
      COLS.forEach(function(h, j) { o[h] = rows[i][j]; });
      o.fecha_atencion = fechaAt;
      lista.push(o);
 
      if (!trabajador && dni) {
        trabajador = {
          dni:     rows[i][7],
          nombre:  rows[i][8],
          empresa: rows[i][11],
          cargo:   rows[i][13],
          fundo:   rows[i][12]
        };
      }
    }
  });
 
  lista.sort(function(a, b) {
    return String(b.fecha_atencion).localeCompare(String(a.fecha_atencion));
  });
 
  // Enriquecer con ruta/codigo/cumpleanos desde Trabajadores
  if (lista.length) {
    try {
      let mapTrab = {};
      const trabsR = getDatosCached('Trabajadores_RAPEL')   || cargarDatosTrabajadores('Trabajadores_RAPEL');
      const trabsV = getDatosCached('Trabajadores_VERFRUT') || cargarDatosTrabajadores('Trabajadores_VERFRUT');
      [trabsR, trabsV].forEach(function(arr) {
        arr.forEach(function(t) {
          if (t[0]) mapTrab[String(t[0]).trim()] = { ruta: t[6], codigo: t[7], cumpleanos: t[11] };
        });
      });
      lista = lista.map(function(o) {
        const t = mapTrab[String(o.dni || '').trim()] || {};
        if (!o.ruta)   o.ruta   = t.ruta   || '';
        if (!o.codigo) o.codigo = t.codigo || '';
        o.cumpleanos = t.cumpleanos || '';
        return o;
      });
    } catch(e) { Logger.log('Enriquecer consultaDNI: ' + e); }
  }
 
  Logger.log('consultaDNI ' + (dni||'(sin DNI)') + ' [' + (fechaDesde||'') + '/' + (fechaHasta||'') + '] sup=' + (supervisor||'') + ': ' + lista.length + ' atenciones');
  return { success: true, data: lista, trabajador: trabajador, total: lista.length };
}
 
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO E) AGREGAR getResponsablesEnRango (NUEVA funciÃ³n)
 * UbicaciÃ³n: al final del archivo
 *
 * Devuelve la lista de usuarios para el combo de Responsable.
 *  - Sin fechas â†’ todos los usuarios activos de hoja Usuarios
 *  - Con fechas â†’ solo supervisores Ãºnicos que tienen atenciones en el rango
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function getResponsablesEnRango(p) {
  try {
    const fechaDesde = String((p && p.fechaDesde) || '').trim();
    const fechaHasta = String((p && p.fechaHasta) || '').trim();
 
    // â”€â”€ CASO 1: SIN fechas â†’ todos los usuarios activos por NOMBRE COMPLETO â”€â”€
    if (!fechaDesde && !fechaHasta) {
      const rows = getSheet('Usuarios').getDataRange().getValues();
      // Columnas: A=id(0), B=usuario(1), C=password(2), D=nombre(3), G=activo(6)
      const lista = [];
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        const nombre = String(rows[i][3] || '').trim();  // â† NOMBRE COMPLETO
        const activo = String(rows[i][6]).trim().toUpperCase() === 'TRUE';
        if (nombre && activo) lista.push(nombre);
      }
      lista.sort();
      return { success: true, data: lista };
    }
 
    // â”€â”€ CASO 2: CON fechas â†’ nombres completos de quienes atendieron en el rango â”€â”€
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const anio = new Date().getFullYear();
    const hojas = [
      'BB. DE REGISTROS 2024',
      'BB. DE REGISTROS 2025',
      'BB. DE REGISTROS ' + anio,
      'BB. DE REGISTROS'
    ];
 
    const supSet = new Set();
    hojas.forEach(function(nombreHoja) {
      const ws = ss.getSheetByName(nombreHoja);
      if (!ws) return;
      const rows = ws.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        // Fecha en col 1
        let fechaAt = '';
        if (rows[i][1] instanceof Date) {
          fechaAt = Utilities.formatDate(rows[i][1], 'GMT-5', 'yyyy-MM-dd');
        } else {
          fechaAt = String(rows[i][1] || '').substring(0, 10);
        }
        if (fechaDesde && fechaAt && fechaAt < fechaDesde) continue;
        if (fechaHasta && fechaAt && fechaAt > fechaHasta) continue;
 
        // Supervisor en col 18 (ya viene como nombre completo en registros nuevos)
        const sup = String(rows[i][18] || '').trim();
        if (sup) supSet.add(sup);
      }
    });
 
    const lista = Array.from(supSet).sort();
    return { success: true, data: lista };
  } catch(e) {
    Logger.log('getResponsablesEnRango error: ' + e);
    return { success: false, error: e.toString() };
  }
}
 
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * PASO F) AGREGAR el case en handle()
 * UbicaciÃ³n: dentro del switch(action) en handle(), lÃ­nea ~30-100
 *
 * Agregar esta lÃ­nea (despuÃ©s del case 'buscarTrabajador' por ejemplo):
 *
 *      case 'getResponsablesEnRango':  result = getResponsablesEnRango(params); break;
 *
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
 /*************************************************************************
 * FICHA DEL CONDUCTOR + ALERTA DIARIA DE LICENCIAS
 * Sistema RR.LL â€” lee la hoja "BB.DD. RESPONSABLES"
 * ----------------------------------------------------------------------
 * Incluye:
 *   A) fichaConductor(dni)      -> datos completos del conductor (12 campos)
 *   B) alertaLicenciasDiaria()  -> correo diario con licencias vencidas /
 *                                  por vencer (solo si hay alguna)
 *   C) _testAlertaLicencias()   -> prueba manual de la alerta
 *
 * PASOS:
 *   1) Pega TODO este bloque al FINAL del cÃ³digo GAS del Sistema RL.
 *   2) Edita ALERTA_LIC_DESTINATARIOS (abajo) con los correos reales.
 *   3) En doGet, agrega el case de 'fichaConductor' (instrucciones al final).
 *   4) Run -> _testAlertaLicencias (revisa el Log y tu bandeja).
 *   5) Crea el activador diario:
 *      Activadores (reloj) -> AÃ±adir activador ->
 *        FunciÃ³n: alertaLicenciasDiaria
 *        Origen: SegÃºn tiempo -> Temporizador por dÃ­as -> 7:00 a 8:00
 *   6) Implementar -> âœï¸ -> Nueva versiÃ³n.
 *************************************************************************/
 
var FICHA_HOJA_RESPONSABLES = 'BB.DD. RESPONSABLES';
var ALERTA_LIC_DIAS_AVISO = 30; // dÃ­as de anticipaciÃ³n para "POR VENCER" (igual que el frontend)
var ALERTA_LIC_DESTINATARIOS = [
  'joel.timoteo@unifrutti.com'
  // , 'olga.vilela@unifrutti.com'
  // , 'jorge.chavez@unifrutti.com'
];
 
// ---------- util: normaliza encabezados (mayÃºsculas, sin tildes ni sÃ­mbolos) ----------
function _ficNorm(s) {
  return String(s || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita tildes (Ã‘->N)
    .replace(/[^A-Z0-9]/g, '');                          // quita espacios, Âº, :, puntos
}
 
// ---------- util: Ã­ndice de columna por encabezado normalizado ----------
function _ficMapaColumnas(headers) {
  var H = headers.map(_ficNorm);
  function ix() { // acepta varios alias por campo
    for (var i = 0; i < arguments.length; i++) {
      var j = H.indexOf(_ficNorm(arguments[i]));
      if (j >= 0) return j;
    }
    return -1;
  }
  return {
    dni:        ix('DNI'),
    usuario:    ix('Usuario:', 'USUARIO'),
    correo:     ix('correo de usuario', 'CORREO'),
    cargo:      ix('cargo'),
    modelo:     ix('MODELO'),
    marca:      ix('MARCA'),
    anio:       ix('AÃ‘O', 'ANIO'),
    estatus:    ix('ESTATUS'),
    zona:       ix('Zona de Recorrido', 'ZONA DE RECORRIDO'),
    numLic:     ix('NÂº DE LICENCIA', 'N DE LICENCIA', 'NÂ° DE LICENCIA', 'NRO DE LICENCIA'),
    fExp:       ix('F. DE EXPEDICIÃ“N', 'F DE EXPEDICION', 'F. DE EXPEDICION'),
    fRev:       ix('F.DE REVALIDACION', 'F. DE REVALIDACION', 'F DE REVALIDACION'),
    // Licencia de CARRO (columnas nuevas; si no existen, todo sale vacÃ­o sin romper nada)
    numLicCarro: ix('NÂ° DE LICENCIA CARRO', 'NÂº DE LICENCIA CARRO', 'N DE LICENCIA CARRO', 'LICENCIA CARRO'),
    fExpCarro:   ix('F. DE EXPEDICIÃ“N CARRO', 'F DE EXPEDICION CARRO', 'F. EXPEDICION CARRO'),
    fRevCarro:   ix('F. DE REVALIDACIÃ“N CARRO', 'F DE REVALIDACION CARRO', 'F. REVALIDACION CARRO', 'F.DE REVALIDACION CARRO'),
    empresa:    ix('EMPRESA')
  };
}
 
// ---------- util: formatea fechas a dd/MM/yyyy (acepta Date o texto) ----------
function _ficFecha(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, 'America/Lima', 'dd/MM/yyyy');
  }
  return String(v).trim();
}
 
// ---------- util: Date desde celda (Date o texto dd/MM/yyyy / yyyy-MM-dd) ----------
function _ficParseFecha(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return v;
  var s = String(v || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var d = new Date(s);
  return isNaN(d) ? null : d;
}
 
// ========== A) FICHA DEL CONDUCTOR ==========
function fichaConductor(dni) {
  try {
    var d = String(dni || '').trim();
    if (!/^\d{8}$/.test(d)) return { ok: false, msg: 'DNI invÃ¡lido' };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(FICHA_HOJA_RESPONSABLES);
    if (!sh) return { ok: false, msg: 'No existe la hoja ' + FICHA_HOJA_RESPONSABLES };
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return { ok: false, msg: 'La hoja estÃ¡ vacÃ­a' };
    var col = _ficMapaColumnas(data[0]);
    if (col.dni < 0) return { ok: false, msg: 'No se encontrÃ³ la columna DNI' };
 
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (String(row[col.dni] || '').trim() === d) {
        function gv(i) { return i >= 0 ? String(row[i] || '').trim() : ''; }
        return {
          ok: true,
          data: {
            dni:           d,
            usuario:       gv(col.usuario),
            correo:        gv(col.correo),
            cargo:         gv(col.cargo),
            modelo:        gv(col.modelo),
            marca:         gv(col.marca),
            anio:          gv(col.anio),
            estatus:       gv(col.estatus),
            zonaRecorrido: gv(col.zona),
            numLicencia:   gv(col.numLic),
            fExpedicion:   _ficFecha(col.fExp >= 0 ? row[col.fExp] : ''),
            fRevalidacion: _ficFecha(col.fRev >= 0 ? row[col.fRev] : ''),
            numLicenciaCarro:   gv(col.numLicCarro),
            fExpedicionCarro:   _ficFecha(col.fExpCarro >= 0 ? row[col.fExpCarro] : ''),
            fRevalidacionCarro: _ficFecha(col.fRevCarro >= 0 ? row[col.fRevCarro] : ''),
            empresa:       gv(col.empresa)
          }
        };
      }
    }
    return { ok: false, msg: 'DNI no encontrado en ' + FICHA_HOJA_RESPONSABLES };
  } catch (err) { return { ok: false, msg: err.message }; }
}
 
// ========== A2) LISTA TOTAL DE CONDUCTORES ==========
function listaConductores() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(FICHA_HOJA_RESPONSABLES);
    if (!sh) return { ok: false, msg: 'No existe la hoja ' + FICHA_HOJA_RESPONSABLES };
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return { ok: true, items: [] };
    var col = _ficMapaColumnas(data[0]);
    var items = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      function gv(i) { return i >= 0 ? String(row[i] || '').trim() : ''; }
      var dni = gv(col.dni), usuario = gv(col.usuario);
      if (!dni && !usuario) continue; // fila vacÃ­a
      items.push({
        dni:           dni,
        usuario:       usuario,
        cargo:         gv(col.cargo),
        modelo:        gv(col.modelo),
        marca:         gv(col.marca),
        anio:          gv(col.anio),
        estatus:       gv(col.estatus),
        zonaRecorrido: gv(col.zona),
        numLicencia:   gv(col.numLic),
        fExpedicion:   _ficFecha(col.fExp >= 0 ? row[col.fExp] : ''),
        fRevalidacion: _ficFecha(col.fRev >= 0 ? row[col.fRev] : ''),
        numLicenciaCarro:   gv(col.numLicCarro),
        fExpedicionCarro:   _ficFecha(col.fExpCarro >= 0 ? row[col.fExpCarro] : ''),
        fRevalidacionCarro: _ficFecha(col.fRevCarro >= 0 ? row[col.fRevCarro] : ''),
        empresa:       gv(col.empresa)
      });
    }
    return { ok: true, items: items };
  } catch (err) { return { ok: false, msg: err.message }; }
}
 
// ========== B) ALERTA DIARIA DE LICENCIAS ==========
function alertaLicenciasDiaria() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(FICHA_HOJA_RESPONSABLES);
  if (!sh) { Logger.log('No existe la hoja ' + FICHA_HOJA_RESPONSABLES); return; }
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  var col = _ficMapaColumnas(data[0]);
 
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var vencidas = [], porVencer = [];
 
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var nombre = col.usuario >= 0 ? String(row[col.usuario] || '').trim() : '';
    var dniV   = col.dni >= 0 ? String(row[col.dni] || '').trim() : '';
    if (!nombre && !dniV) continue; // fila vacÃ­a
 
    // Revisa AMBAS licencias: MOTO (columnas originales) y CARRO (columnas nuevas)
    var licencias = [
      { tipo: 'ðŸ MOTO',  iRev: col.fRev,      iNum: col.numLic },
      { tipo: 'ðŸš— CARRO', iRev: col.fRevCarro, iNum: col.numLicCarro }
    ];
    for (var L = 0; L < licencias.length; L++) {
      var cfg = licencias[L];
      if (cfg.iRev < 0) continue; // la columna no existe aÃºn
      var fRev = _ficParseFecha(row[cfg.iRev]);
      if (!fRev) continue; // sin fecha: ese conductor no tiene esta licencia, no alertar
      fRev.setHours(0, 0, 0, 0);
      var dias = Math.floor((fRev - hoy) / 86400000);
      var item = {
        nombre: nombre || '(sin nombre)',
        dni: dniV,
        tipo: cfg.tipo,
        lic: cfg.iNum >= 0 ? String(row[cfg.iNum] || '').trim() : '',
        zona: col.zona >= 0 ? String(row[col.zona] || '').trim() : '',
        empresa: col.empresa >= 0 ? String(row[col.empresa] || '').trim() : '',
        fecha: Utilities.formatDate(fRev, 'America/Lima', 'dd/MM/yyyy'),
        dias: dias
      };
      if (dias < 0) vencidas.push(item);
      else if (dias <= ALERTA_LIC_DIAS_AVISO) porVencer.push(item);
    }
  }
 
  if (vencidas.length === 0 && porVencer.length === 0) {
    Logger.log('Sin licencias vencidas ni por vencer. No se envÃ­a correo.');
    return;
  }
 
  vencidas.sort(function(a, b) { return a.dias - b.dias; });
  porVencer.sort(function(a, b) { return a.dias - b.dias; });
 
  function tabla(items, color, titulo, textoDias) {
    if (!items.length) return '';
    var filas = items.map(function(i) {
      return '<tr>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0">' + i.nombre + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">' + i.dni + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:bold">' + i.tipo + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">' + (i.lic || 'â€”') + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0">' + (i.zona || 'â€”') + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">' + (i.empresa || 'â€”') + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center">' + i.fecha + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:' + color + '">' + textoDias(i.dias) + '</td>' +
      '</tr>';
    }).join('');
    return '<h3 style="color:' + color + ';font-family:Arial;margin:18px 0 6px">' + titulo + ' (' + items.length + ')</h3>' +
      '<table style="border-collapse:collapse;font-family:Arial;font-size:13px;width:100%">' +
      '<tr style="background:#0a2540;color:#fff">' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">Conductor</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">DNI</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">Tipo</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">NÂ° Licencia</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">Zona</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">Empresa</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">F. RevalidaciÃ³n</th>' +
        '<th style="padding:7px 10px;border:1px solid #0a2540">SituaciÃ³n</th>' +
      '</tr>' + filas + '</table>';
  }
 
  var html = '<div style="font-family:Arial">' +
    '<h2 style="color:#0a2540">ðŸªª Alerta de Licencias de Conducir â€” Sistema RR.LL</h2>' +
    '<p style="font-size:13px;color:#475569">Resumen diario generado el ' +
      Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm') + ' (hora Lima).</p>' +
    tabla(vencidas, '#dc2626', 'ðŸ”´ LICENCIAS VENCIDAS', function(d) { return 'VenciÃ³ hace ' + Math.abs(d) + ' dÃ­as'; }) +
    tabla(porVencer, '#d97706', 'ðŸŸ¡ POR VENCER (prÃ³ximos ' + ALERTA_LIC_DIAS_AVISO + ' dÃ­as)', function(d) { return 'Vence en ' + d + ' dÃ­as'; }) +
    '<p style="font-size:12px;color:#94a3b8;margin-top:16px">Correo automÃ¡tico del Sistema RR.LL Â· MÃ³dulo Solicitud de Mantenimiento. Fuente: hoja ' + FICHA_HOJA_RESPONSABLES + '.</p>' +
  '</div>';
 
  var asunto = 'ðŸªª Licencias: ' + vencidas.length + ' vencida(s), ' + porVencer.length + ' por vencer â€” ' +
    Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy');
 
  MailApp.sendEmail({
    to: ALERTA_LIC_DESTINATARIOS.join(','),
    subject: asunto,
    htmlBody: html
  });
  Logger.log('Correo enviado: ' + vencidas.length + ' vencidas, ' + porVencer.length + ' por vencer.');
}
 
// ========== C) PRUEBA MANUAL ==========
function _testAlertaLicencias() {
  alertaLicenciasDiaria();
  Logger.log('Listo. Revisa el Log de arriba y la bandeja de: ' + ALERTA_LIC_DESTINATARIOS.join(', '));
}
 
/*************************************************************************
 * ROUTER (doGet) â€” para que el botÃ³n ðŸªª del mÃ³dulo funcione.
 *
 * Busca en tu doGet dÃ³nde se atiende 'buscarResponsableMantenimiento'
 * y agrega lo anÃ¡logo para 'listaConductores' (y 'fichaConductor' si
 * quieres conservar tambiÃ©n la consulta individual). SegÃºn tu estilo:
 *
 *   Si es switch:
 *     case 'listaConductores':
 *       result = listaConductores();
 *       break;
 *     case 'fichaConductor':
 *       result = fichaConductor(e.parameter.dni);
 *       break;
 *
 *   Si es if/else:
 *     if (action === 'listaConductores') {
 *       return ContentService.createTextOutput(JSON.stringify(listaConductores()))
 *         .setMimeType(ContentService.MimeType.JSON);
 *     }
 *     if (action === 'fichaConductor') {
 *       return ContentService.createTextOutput(JSON.stringify(fichaConductor(e.parameter.dni)))
 *         .setMimeType(ContentService.MimeType.JSON);
 *     }
 *************************************************************************/
 /*************************************************************************
 * EVALUACIÃ“N 360 v2 â€” Backend corregido (Sistema RR.LL)
 * ----------------------------------------------------------------------
 * Corrige:
 *  1. Mapeo backendâ†”frontend (antes los puntajes se guardaban en 0)
 *  2. Periodo MENSUAL con UPSERT: una evaluaciÃ³n por supervisor por mes
 *     (si re-evalÃºas el mismo mes, ACTUALIZA la fila, no duplica)
 *  3. EliminaciÃ³n REAL: mueve la fila a 'Evaluaciones360_Eliminadas'
 *     (solo admins), patrÃ³n igual a Visitas/Casos
 *  4. getEvaluaciones360 devuelve TODO el detalle (competencias con
 *     respuestas) para que radar/evoluciÃ³n funcionen en cualquier PC
 *
 * Hoja: 'BB.DD-EVALUACIONES' â€” se agregan 2 columnas al final:
 *   T: Periodo  (yyyy-MM, ej. 2026-06)
 *   U: Detalle  (JSON con competencias y respuestas)
 * Las 19 columnas existentes NO se mueven. Datos antiguos se conservan.
 *
 * PASOS:
 *  1) Pegar TODO este bloque al FINAL de codigo.gs (sobrescribe por
 *     hoisting las versiones viejas de save/get).
 *  2) Agregar en el switch de handle() UNA lÃ­nea (las otras 2 ya existen):
 *       case 'deleteEvaluacion360': result = deleteEvaluacion360(body); break;
 *  3) Ejecutar UNA VEZ desde el editor: eval360Setup
 *     (crea columnas Periodo/Detalle y rellena Periodo en filas antiguas)
 *  4) Implementar â†’ âœï¸ â†’ Nueva versiÃ³n.
 *************************************************************************/
 
var EVAL360_HOJA = 'BB.DD-EVALUACIONES';
var EVAL360_HOJA_ELIM = 'Evaluaciones360_Eliminadas';
var ADMINS_EVAL360 = ['jtimoteo', 'ovilela', 'jchavez'];
 
// â”€â”€ Encabezados base (19) + nuevos (2) â”€â”€
var EVAL360_HEADERS = ['ID','Fecha EvaluaciÃ³n','Evaluador','Supervisor Evaluado',
  'Empresa','Fundo/Sector','Puntaje Liderazgo','Puntaje ComunicaciÃ³n',
  'Puntaje Cumplimiento','Puntaje GestiÃ³n Equipo','Puntaje ResoluciÃ³n',
  'Puntaje PlanificaciÃ³n','Puntaje Total','% Cumplimiento','Nivel',
  'Observaciones','Recomendaciones','Usuario Registro','Fecha Registro',
  'Periodo','Detalle'];
 
// â”€â”€ Helpers â”€â”€
function _e360Sheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName(EVAL360_HOJA);
  if (!ws) {
    ws = ss.insertSheet(EVAL360_HOJA);
    ws.appendRow(EVAL360_HEADERS);
    ws.getRange(1, 1, 1, EVAL360_HEADERS.length)
      .setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    ws.setFrozenRows(1);
  }
  return ws;
}
 
function _e360Fecha(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, 'America/Lima', 'yyyy-MM-dd');
  }
  return String(v).substring(0, 10);
}
 
// Periodo yyyy-MM desde una fecha yyyy-MM-dd (o Date)
function _e360Periodo(fecha) {
  var f = _e360Fecha(fecha);
  return f.length >= 7 ? f.substring(0, 7) : '';
}
 
// Promedio de una competencia desde el array de respuestas del frontend
function _e360PromComp(competencias, nombre) {
  if (!Array.isArray(competencias)) return 0;
  for (var i = 0; i < competencias.length; i++) {
    var c = competencias[i];
    if (String(c.nombre || '').toLowerCase().indexOf(nombre) === 0) {
      return Math.round((Number(c.promedio) || 0) * 100) / 100;
    }
  }
  return 0;
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETUP / MIGRACIÃ“N â€” Ejecutar UNA VEZ desde el editor
// Agrega columnas Periodo (T) y Detalle (U) si no existen,
// y rellena Periodo en filas antiguas desde Fecha EvaluaciÃ³n.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function eval360Setup() {
  var ws = _e360Sheet();
  var lastCol = ws.getLastColumn();
  var headers = ws.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
 
  var idxPeriodo = headers.indexOf('Periodo');
  var idxDetalle = headers.indexOf('Detalle');
 
  if (idxPeriodo === -1) {
    lastCol++;
    ws.getRange(1, lastCol).setValue('Periodo')
      .setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    idxPeriodo = lastCol - 1;
    Logger.log('âœ“ Columna Periodo creada en col ' + lastCol);
  } else {
    Logger.log('â€¢ Columna Periodo ya existe (col ' + (idxPeriodo + 1) + ')');
  }
 
  if (idxDetalle === -1) {
    lastCol++;
    ws.getRange(1, lastCol).setValue('Detalle')
      .setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    idxDetalle = lastCol - 1;
    Logger.log('âœ“ Columna Detalle creada en col ' + lastCol);
  } else {
    Logger.log('â€¢ Columna Detalle ya existe (col ' + (idxDetalle + 1) + ')');
  }
 
  // Backfill de Periodo en filas antiguas (desde Fecha EvaluaciÃ³n, col B)
  var lastRow = ws.getLastRow();
  var rellenadas = 0;
  if (lastRow > 1) {
    var fechas = ws.getRange(2, 2, lastRow - 1, 1).getValues();
    var periodos = ws.getRange(2, idxPeriodo + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < fechas.length; i++) {
      if (!periodos[i][0]) {
        var per = _e360Periodo(fechas[i][0]);
        if (per) { periodos[i][0] = per; rellenadas++; }
      }
    }
    if (rellenadas > 0) {
      ws.getRange(2, idxPeriodo + 1, lastRow - 1, 1).setValues(periodos);
    }
  }
  Logger.log('âœ“ Periodos rellenados en filas antiguas: ' + rellenadas);
  Logger.log('â•â•â• eval360Setup completado â•â•â•');
  return { success: true, rellenadas: rellenadas };
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SAVE v2 â€” UPSERT por (supervisor, periodo)
// Recibe el payload REAL del frontend:
//   { id, supervisor, empresa, fecha, evaluador, obs,
//     competencias:[{nombre, promedio, respuestas:[...]}, ...],
//     promGlobal, porcentaje, clasificacion, evaluadorUser }
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function saveEvaluacion360(d) {
  try {
    if (!d || !d.supervisor) return { success: false, error: 'Falta supervisor' };
    var fecha = _e360Fecha(d.fecha) || Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
    var periodo = d.periodo || _e360Periodo(fecha);
    if (!periodo) return { success: false, error: 'No se pudo determinar el periodo' };
 
    var ws = _e360Sheet();
    var lastCol = ws.getLastColumn();
    var headers = ws.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
    var idxPeriodo = headers.indexOf('Periodo');
    var idxDetalle = headers.indexOf('Detalle');
    if (idxPeriodo === -1 || idxDetalle === -1) {
      return { success: false, error: 'Ejecutar eval360Setup() primero (faltan columnas Periodo/Detalle)' };
    }
 
    // Puntajes por competencia (promedios 1-5) desde el array del frontend
    var comps = d.competencias || [];
    var pLid = _e360PromComp(comps, 'liderazgo');
    var pCom = _e360PromComp(comps, 'comunicaci');
    var pCum = _e360PromComp(comps, 'cumplimiento');
    var pGes = _e360PromComp(comps, 'gesti');
    var pRes = _e360PromComp(comps, 'resoluci');
    var pPla = _e360PromComp(comps, 'planificaci');
 
    // Puntaje total = suma de todas las respuestas (mÃ¡x 80)
    var total = 0;
    comps.forEach(function(c) {
      (c.respuestas || []).forEach(function(r) { total += Number(r.valor) || 0; });
    });
 
    var nivel = d.clasificacion || d.nivel || '';
    var obs = d.obs !== undefined ? d.obs : (d.observaciones || '');
    var usuarioReg = d.evaluadorUser || d.usuario_registro || '';
    var detalleJSON = '';
    try { detalleJSON = JSON.stringify(comps); } catch(eJ) { detalleJSON = '[]'; }
 
    // â”€â”€ Buscar fila existente del mismo (supervisor, periodo) â†’ UPSERT â”€â”€
    var lastRow = ws.getLastRow();
    var filaExistente = -1;
    var idExistente = '';
    if (lastRow > 1) {
      var datos = ws.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var supBuscar = String(d.supervisor).trim().toLowerCase();
      for (var i = 0; i < datos.length; i++) {
        var supFila = String(datos[i][3] || '').trim().toLowerCase();
        var perFila = String(datos[i][idxPeriodo] || '').trim();
        if (supFila === supBuscar && perFila === periodo) {
          filaExistente = i + 2;
          idExistente = String(datos[i][0] || '');
          break;
        }
      }
    }
 
    var id = filaExistente !== -1 && idExistente ? idExistente : (d.id || ('EVA-' + Date.now()));
 
    var fila = new Array(lastCol).fill('');
    fila[0]  = id;
    fila[1]  = fecha;
    fila[2]  = d.evaluador || usuarioReg;
    fila[3]  = String(d.supervisor).trim();
    fila[4]  = d.empresa || '';
    fila[5]  = d.sector || '';
    fila[6]  = pLid;  fila[7]  = pCom;  fila[8]  = pCum;
    fila[9]  = pGes;  fila[10] = pRes;  fila[11] = pPla;
    fila[12] = total;
    fila[13] = Number(d.porcentaje) || 0;
    fila[14] = nivel;
    fila[15] = obs;
    fila[16] = d.recomendaciones || '';
    fila[17] = usuarioReg;
    fila[18] = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm');
    fila[idxPeriodo] = periodo;
    fila[idxDetalle] = detalleJSON;
 
    if (filaExistente !== -1) {
      ws.getRange(filaExistente, 1, 1, lastCol).setValues([fila]);
      Logger.log('âœ“ EvaluaciÃ³n ACTUALIZADA: ' + d.supervisor + ' / ' + periodo + ' (fila ' + filaExistente + ')');
      return { success: true, id: id, accion: 'actualizada', periodo: periodo };
    } else {
      ws.appendRow(fila);
      Logger.log('âœ“ EvaluaciÃ³n CREADA: ' + d.supervisor + ' / ' + periodo);
      return { success: true, id: id, accion: 'creada', periodo: periodo };
    }
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET v2 â€” devuelve registros completos (con competencias)
// Compatible con filas antiguas sin Detalle (reconstruye desde
// los puntajes planos si existen).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getEvaluaciones360(p) {
  try {
    var ws = _e360Sheet();
    var lastRow = ws.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };
    var lastCol = ws.getLastColumn();
    var headers = ws.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h).trim(); });
    var idxPeriodo = headers.indexOf('Periodo');
    var idxDetalle = headers.indexOf('Detalle');
 
    var rows = ws.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var data = [];
 
    rows.forEach(function(r) {
      if (!r[0]) return;
      var fecha = _e360Fecha(r[1]);
      var periodo = idxPeriodo >= 0 && r[idxPeriodo] ? String(r[idxPeriodo]).trim() : _e360Periodo(fecha);
 
      // Competencias: del JSON si existe; si no, reconstruir desde columnas planas
      var competencias = [];
      if (idxDetalle >= 0 && r[idxDetalle]) {
        try { competencias = JSON.parse(r[idxDetalle]); } catch(eJ) { competencias = []; }
      }
      if (!competencias.length) {
        var planas = [
          ['Liderazgo', r[6]], ['ComunicaciÃ³n', r[7]], ['Cumplimiento', r[8]],
          ['GestiÃ³n de Equipo', r[9]], ['ResoluciÃ³n de Problemas', r[10]], ['PlanificaciÃ³n', r[11]]
        ];
        planas.forEach(function(pc) {
          var v = Number(pc[1]) || 0;
          if (v > 0) competencias.push({ nombre: pc[0], promedio: v, respondidas: 0, total: 0, respuestas: [] });
        });
      }
 
      data.push({
        id: String(r[0]),
        fecha: fecha,
        periodo: periodo,
        evaluador: String(r[2] || ''),
        supervisor: String(r[3] || '').trim(),
        empresa: String(r[4] || ''),
        sector: String(r[5] || ''),
        competencias: competencias,
        total: Number(r[12]) || 0,
        porcentaje: Number(r[13]) || 0,
        clasificacion: String(r[14] || ''),
        obs: String(r[15] || ''),
        evaluadorUser: String(r[17] || ''),
        fechaRegistro: _e360Fecha(r[18])
      });
    });
 
    if (p && p.empresa && p.empresa !== 'AMBAS') {
      data = data.filter(function(e) { return e.empresa === p.empresa; });
    }
    if (p && p.supervisor) {
      var q = String(p.supervisor).toLowerCase();
      data = data.filter(function(e) { return e.supervisor.toLowerCase().indexOf(q) !== -1; });
    }
    if (p && p.periodo) {
      data = data.filter(function(e) { return e.periodo === String(p.periodo); });
    }
 
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DELETE â€” eliminaciÃ³n real (mueve a Evaluaciones360_Eliminadas)
// Solo admins. body: { id, usuario, motivo? }
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function deleteEvaluacion360(d) {
  try {
    var usuario = String(d.usuario || '').trim().toLowerCase();
    if (ADMINS_EVAL360.indexOf(usuario) === -1) {
      return { success: false, error: 'Sin permisos: solo administradores pueden eliminar evaluaciones' };
    }
    if (!d.id) return { success: false, error: 'ID de evaluaciÃ³n requerido' };
 
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = _e360Sheet();
    var data = ws.getDataRange().getValues();
    var headers = data[0];
    var filaIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(d.id)) { filaIdx = i; break; }
    }
    if (filaIdx === -1) return { success: false, error: 'EvaluaciÃ³n ' + d.id + ' no encontrada' };
 
    var wsDest = ss.getSheetByName(EVAL360_HOJA_ELIM);
    if (!wsDest) {
      wsDest = ss.insertSheet(EVAL360_HOJA_ELIM);
      wsDest.appendRow(headers.concat(['Eliminado_por', 'Fecha_eliminacion', 'Motivo_eliminacion']));
      wsDest.getRange(1, 1, 1, headers.length + 3).setFontWeight('bold');
    }
    wsDest.appendRow(data[filaIdx].concat([d.usuario, new Date(), d.motivo || 'Sin motivo especificado']));
    ws.deleteRow(filaIdx + 1);
 
    Logger.log('âœ“ EvaluaciÃ³n ' + d.id + ' eliminada por ' + d.usuario);
    return { success: true, mensaje: 'EvaluaciÃ³n archivada correctamente' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEST rÃ¡pido (no escribe nada)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function _testEval360() {
  var g = getEvaluaciones360({});
  Logger.log('Total evaluaciones: ' + (g.data ? g.data.length : 'ERROR: ' + g.error));
  if (g.data && g.data.length) {
    Logger.log('Primera: ' + JSON.stringify(g.data[0]).substring(0, 500));
  }
  var del = deleteEvaluacion360({ id: 'NOEXISTE', usuario: 'azapata' });
  Logger.log('Test permisos delete (debe rechazar): ' + JSON.stringify(del));
}
/*************************************************************************
 * PACK ESTADÃSTICAS + RESUMEN GENERAL v2 â€” Sistema RR.LL
 * ----------------------------------------------------------------------
 * Corrige:
 *  1. getEstadisticasAdmin: ahora SÃ filtra por AÃ‘O (p.anio) y la
 *     tendencia de 6 meses se alinea al aÃ±o pedido â†’ arregla el filtro
 *     "AÃ±o" de EstadÃ­sticas y la comparativa con el aÃ±o anterior
 *     (lÃ­neas punteadas + indicadores de crecimiento).
 *  2. getResumenGeneral: devuelve agregados calculados sobre TODOS los
 *     registros filtrados (porMes, porAnio, porEstado), no sobre el
 *     recorte de 1,000 â†’ los grÃ¡ficos del Resumen dejan de mentir.
 *     AdemÃ¡s normaliza mes/aÃ±o por fila (acepta meses en texto de hojas
 *     antiguas, ej. "Mayo") derivÃ¡ndolos de la fecha cuando haga falta.
 *
 * PASOS:
 *  1) Pegar TODO este bloque al FINAL de codigo.gs (sobrescribe por
 *     hoisting las versiones anteriores de ambas funciones).
 *  2) EDITAR UNA LÃNEA en el switch de handle():
 *       ANTES:  case 'resumenEjecutivo': result = resumenEjecutivo(body); break;
 *       AHORA:  case 'resumenEjecutivo': result = resumenEjecutivoCached(body); break;
 *     (asÃ­ el pre-warm de cachÃ© por fin se aprovecha)
 *  3) Ejecutar _testEstadisticasResumenV2 y revisar el Log.
 *  4) Implementar â†’ âœï¸ â†’ Nueva versiÃ³n.
 *************************************************************************/
 
// â”€â”€ Mapa meses en texto â†’ nÃºmero (hojas antiguas) â”€â”€
var _RG_MES_NUM = {
  'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
  'julio':7,'agosto':8,'septiembre':9,'setiembre':9,'octubre':10,
  'noviembre':11,'diciembre':12
};
 
// Normaliza {mes, anio, fechaStr} de una fila de atenciones
// r[1]=fecha_atencion, r[5]=mes, r[6]=anio
function _rgNormFila(r) {
  var fechaStr = '';
  if (r[1] instanceof Date) {
    fechaStr = Utilities.formatDate(r[1], 'America/Lima', 'yyyy-MM-dd');
  } else {
    fechaStr = String(r[1] || '').replace(/T.*/, '').substring(0, 10);
  }
  var mes = parseInt(r[5]);
  if (isNaN(mes) || !mes) {
    var txt = String(r[5] || '').toLowerCase().trim();
    mes = _RG_MES_NUM[txt] || 0;
  }
  var anio = parseInt(r[6]) || 0;
  // La fecha manda si existe (mÃ¡s confiable que las columnas mes/aÃ±o)
  if (fechaStr.length >= 7) {
    var mF = parseInt(fechaStr.substring(5, 7));
    var aF = parseInt(fechaStr.substring(0, 4));
    if (mF > 0) mes = mF;
    if (aF > 0) anio = aF;
  }
  return { mes: mes, anio: anio, fechaStr: fechaStr };
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 1) getEstadisticasAdmin v2 â€” con filtro de AÃ‘O real
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getEstadisticasAdmin(p) {
  try {
    var ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoy         = new Date();
    var mesActual   = hoy.getMonth() + 1;
    var anioActual  = hoy.getFullYear();
    var filtroEmp   = (p.empresa    || '').toUpperCase();
    var filtroSup   = (p.supervisor || '').toLowerCase();
    var filtroMes   = p.mes  ? parseInt(p.mes)  : 0;
    var filtroAnio  = p.anio ? parseInt(p.anio) : 0;   // â­ NUEVO
 
    // â”€â”€ ATENCIONES: combinar 2024+2025+actual+base â”€â”€
    var hojas = ['BB. DE REGISTROS 2024','BB. DE REGISTROS 2025','BB. DE REGISTROS ' + anioActual,'BB. DE REGISTROS'];
    var vistosAt = new Set();
    var rawAt = [];
    hojas.forEach(function(n) {
      var ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        var k = n + '_' + String(r[0]);
        if (!k || vistosAt.has(k)) return;
        vistosAt.add(k); rawAt.push(r);
      });
    });
 
    var atenciones = [];
    for (var i = 0; i < rawAt.length; i++) {
      var r = rawAt[i];
      if (!r[0] && !r[7]) continue;
      var ma = normalizarFecha(r[1]);
      atenciones.push({
        supervisor: String(r[18] || '').trim(),
        empresa:    String(r[11] || '').toUpperCase(),
        estado:     String(r[25] || '').toUpperCase(),
        mes:        ma.mes,
        anio:       ma.anio
      });
    }
 
    // â”€â”€ VISITAS â”€â”€
    var wsVis  = ss.getSheetByName('Visitas_Campo');
    var rawVis = wsVis ? wsVis.getDataRange().getValues().slice(1) : [];
    var visitas = [];
    for (var j = 0; j < rawVis.length; j++) {
      var rv = rawVis[j];
      if (!rv[0]) continue;
      var mv = normalizarFecha(rv[1]);
      visitas.push({
        supervisor: String(rv[3]  || '').trim(),
        empresa:    String(rv[2]  || '').toUpperCase(),
        estado:     String(rv[21] || '').toUpperCase(),
        mes:        mv.mes,
        anio:       mv.anio
      });
    }
 
    // â”€â”€ CASOS â”€â”€
    var wsCas  = ss.getSheetByName('BD_Casos');
    var rawCas = wsCas ? wsCas.getDataRange().getValues().slice(1) : [];
    var casos  = [];
    for (var k = 0; k < rawCas.length; k++) {
      var rc = rawCas[k];
      if (!rc[0]) continue;
      var mc = normalizarFecha(rc[1]);
      casos.push({
        supervisor: String(rc[9]  || '').trim(),
        empresa:    String(rc[4]  || '').toUpperCase(),
        estado:     String(rc[15] || '').toUpperCase(),
        mes:        mc.mes,
        anio:       mc.anio
      });
    }
 
    // â”€â”€ FUSIONES â”€â”€
    var wsFus  = ss.getSheetByName('Fusiones_Buses');
    var rawFus = wsFus ? wsFus.getDataRange().getValues().slice(1) : [];
    var fusiones = [];
    for (var f = 0; f < rawFus.length; f++) {
      var rf = rawFus[f];
      if (!rf[0]) continue;
      var mf = normalizarFecha(rf[1]);
      fusiones.push({
        supervisor: String(rf[5]  || '').trim(),
        empresa:    '',
        estado:     String(rf[27] || '').toUpperCase(),
        totalTrab:  parseInt(rf[12] || 0),
        mes:        mf.mes,
        anio:       mf.anio
      });
    }
 
    // â”€â”€ Filtros (ahora incluye AÃ‘O) â”€â”€
    function applyFilters(arr) {
      var out = arr;
      if (filtroEmp && filtroEmp !== 'AMBAS') {
        out = out.filter(function(x){ return x.empresa === filtroEmp || x.empresa === ''; });
      }
      if (filtroSup) {
        out = out.filter(function(x){ return x.supervisor.toLowerCase().indexOf(filtroSup) !== -1; });
      }
      if (filtroAnio) {
        out = out.filter(function(x){ return x.anio === filtroAnio; });   // â­ NUEVO
      }
      if (filtroMes) {
        out = out.filter(function(x){ return x.mes === filtroMes; });
      }
      return out;
    }
    atenciones = applyFilters(atenciones);
    visitas    = applyFilters(visitas);
    casos      = applyFilters(casos);
    fusiones   = applyFilters(fusiones);
 
    // â”€â”€ Referencias "este mes": si hay aÃ±o filtrado, contra ese aÃ±o â”€â”€
    var refAnio = filtroAnio || anioActual;
 
    // â”€â”€ STATS GLOBALES â”€â”€
    var stats = {
      atenciones: {
        total:       atenciones.length,
        enProceso:   atenciones.filter(function(x){ return x.estado === 'EN PROCESO'; }).length,
        finalizados: atenciones.filter(function(x){ return x.estado === 'FINALIZADO' || x.estado === 'RESUELTO'; }).length,
        esteMes:     atenciones.filter(function(x){ return x.mes === mesActual && x.anio === refAnio; }).length
      },
      visitas: {
        total:      visitas.length,
        enPlazo:    visitas.filter(function(x){ return x.estado.indexOf('RETRAS') === -1; }).length,
        retrasadas: visitas.filter(function(x){ return x.estado.indexOf('RETRAS') !== -1; }).length,
        esteMes:    visitas.filter(function(x){ return x.mes === mesActual && x.anio === refAnio; }).length
      },
      casos: {
        total:      casos.length,
        enPlazo:    casos.filter(function(x){ return x.estado.indexOf('RETRAS') === -1; }).length,
        retrasados: casos.filter(function(x){ return x.estado.indexOf('RETRAS') !== -1; }).length,
        esteMes:    casos.filter(function(x){ return x.mes === mesActual && x.anio === refAnio; }).length
      },
      fusiones: {
        total:        fusiones.length,
        pendientes:   fusiones.filter(function(x){ return x.estado === 'PENDIENTE'; }).length,
        validados:    fusiones.filter(function(x){ return x.estado === 'VALIDADO'; }).length,
        trabajadores: fusiones.reduce(function(s,x){ return s + x.totalTrab; }, 0),
        esteMes:      fusiones.filter(function(x){ return x.mes === mesActual && x.anio === refAnio; }).length
      }
    };
 
    // â”€â”€ POR SUPERVISOR â”€â”€
    var porSupervisor = {};
    function acumSup(arr, modulo) {
      for (var n = 0; n < arr.length; n++) {
        var x = arr[n];
        var s = x.supervisor || 'Sin asignar';
        if (!porSupervisor[s]) {
          porSupervisor[s] = {
            nombre: s,
            atenciones:0, atEnProceso:0, atFinalizados:0,
            visitas:0, viRetrasadas:0,
            casos:0, caRetrasados:0,
            fusiones:0
          };
        }
        if (modulo === 'at') {
          porSupervisor[s].atenciones++;
          if (x.estado === 'EN PROCESO') porSupervisor[s].atEnProceso++;
          if (x.estado === 'FINALIZADO' || x.estado === 'RESUELTO') porSupervisor[s].atFinalizados++;
        }
        if (modulo === 'vis') {
          porSupervisor[s].visitas++;
          if (x.estado.indexOf('RETRAS') !== -1) porSupervisor[s].viRetrasadas++;
        }
        if (modulo === 'cas') {
          porSupervisor[s].casos++;
          if (x.estado.indexOf('RETRAS') !== -1) porSupervisor[s].caRetrasados++;
        }
        if (modulo === 'fus') porSupervisor[s].fusiones++;
      }
    }
    acumSup(atenciones, 'at');
    acumSup(visitas,    'vis');
    acumSup(casos,      'cas');
    acumSup(fusiones,   'fus');
 
    // â”€â”€ TENDENCIA 6 meses, ALINEADA al aÃ±o pedido â”€â”€
    // Sin filtro de aÃ±o: Ãºltimos 6 meses reales.
    // Con filtro de aÃ±o (ej. 2025): los MISMOS 6 meses calendario pero de
    // ese aÃ±o â†’ permite superponer las lÃ­neas aÃ±o actual vs anterior.
    var tendencia = [];
    var labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    for (var t = 5; t >= 0; t--) {
      var td    = new Date(hoy.getFullYear(), hoy.getMonth() - t, 1);
      var tMes  = td.getMonth() + 1;
      var tAnio = filtroAnio
        ? (filtroAnio + (td.getFullYear() - hoy.getFullYear()))   // â­ alinear al aÃ±o pedido
        : td.getFullYear();
      tendencia.push({
        label:      labels[tMes - 1],
        atenciones: atenciones.filter(function(x){ return x.mes === tMes && x.anio === tAnio; }).length,
        visitas:    visitas.filter(function(x){    return x.mes === tMes && x.anio === tAnio; }).length,
        casos:      casos.filter(function(x){      return x.mes === tMes && x.anio === tAnio; }).length,
        fusiones:   fusiones.filter(function(x){   return x.mes === tMes && x.anio === tAnio; }).length
      });
    }
 
    return { success: true, data: { stats: stats, porSupervisor: porSupervisor, tendencia: tendencia, filtros: { anio: filtroAnio || '', mes: filtroMes || '' } } };
 
  } catch(e) {
    return { success: false, error: 'getEstadisticasAdmin: ' + e.toString() };
  }
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 2) getResumenGeneral v2 â€” agregados sobre TODO + meses en texto
// Devuelve: total, lista (slice 1000), porSupervisor,
//           porMes {yyyy-MM: n}, porAnio {yyyy:{total,proc,res}},
//           porEstado {EN PROCESO, FINALIZADO}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getResumenGeneral(p) {
  var ss3 = SpreadsheetApp.openById(SPREADSHEET_ID);
  var anioActual = new Date().getFullYear();
 
  var hojas = [
    'BB. DE REGISTROS 2024',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS ' + anioActual,
    'BB. DE REGISTROS'
  ];
  var vistos = new Set();
  var lista = [];
  hojas.forEach(function(nombreHoja) {
    var ws = ss3.getSheetByName(nombreHoja);
    if (!ws) return;
    var rows = ws.getDataRange().getValues();
    if (rows.length < 2) return;
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0] && !rows[i][7]) continue;
      var k = nombreHoja + '_' + String(rows[i][0]);
      if (vistos.has(k)) continue;
      vistos.add(k);
      var o = {};
      COLS.forEach(function(h, j) { o[h] = rows[i][j]; });
      // â­ Normalizar mes/aÃ±o/fecha (acepta meses en texto de hojas viejas)
      var nrm = _rgNormFila(rows[i]);
      o.mes = nrm.mes;
      o.anio = nrm.anio;
      o.fecha_atencion = nrm.fechaStr;
      lista.push(o);
    }
  });
 
  // â”€â”€ Filtros (sobre valores normalizados) â”€â”€
  if (p.empresa && p.empresa !== 'AMBAS') {
    lista = lista.filter(function(a){ return String(a.empresa).toUpperCase() === p.empresa; });
  }
  if (p.mes)  lista = lista.filter(function(a){ return a.mes  === parseInt(p.mes); });
  if (p.anio) lista = lista.filter(function(a){ return a.anio === parseInt(p.anio); });
 
  // â”€â”€ Por supervisor (RESUELTO y FINALIZADO son sinÃ³nimos) â”€â”€
  var ps = {};
  lista.forEach(function(a) {
    var s = String(a.supervisor || 'Sin asignar').trim();
    if (!ps[s]) ps[s] = { nombre:s, total:0, pendientes:0, resueltos:0, enProceso:0 };
    ps[s].total++;
    var e = String(a.estado || '').toUpperCase();
    if (e === 'PENDIENTE')                       ps[s].pendientes++;
    if (e === 'RESUELTO' || e === 'FINALIZADO')  ps[s].resueltos++;
    if (e === 'EN PROCESO')                      ps[s].enProceso++;
  });
 
  // â”€â”€ â­ AGREGADOS COMPLETOS (sobre TODA la lista filtrada, no el slice) â”€â”€
  var porMes = {};      // 'yyyy-MM' â†’ n
  var porAnio = {};     // 'yyyy' â†’ {total, proc, res}
  var porEstado = { 'EN PROCESO': 0, 'FINALIZADO': 0 };
  lista.forEach(function(a) {
    var e = String(a.estado || '').toUpperCase();
    if (e === 'EN PROCESO') porEstado['EN PROCESO']++;
    if (e === 'FINALIZADO' || e === 'RESUELTO') porEstado['FINALIZADO']++;
    if (a.anio > 0 && a.mes > 0) {
      var mk = a.anio + '-' + ('0' + a.mes).slice(-2);
      porMes[mk] = (porMes[mk] || 0) + 1;
      var ak = String(a.anio);
      if (!porAnio[ak]) porAnio[ak] = { total:0, proc:0, res:0 };
      porAnio[ak].total++;
      if (e === 'EN PROCESO') porAnio[ak].proc++;
      if (e === 'FINALIZADO' || e === 'RESUELTO') porAnio[ak].res++;
    }
  });
 
  lista.sort(function(a, b) { return String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)); });
 
  return {
    success: true,
    data: {
      total: lista.length,
      lista: lista.slice(0, 1000),
      porSupervisor: ps,
      porMes: porMes,        // â­ NUEVO
      porAnio: porAnio,      // â­ NUEVO
      porEstado: porEstado   // â­ NUEVO
    }
  };
}
 
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEST â€” Ejecutar desde el editor y revisar el Log
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function _testEstadisticasResumenV2() {
  Logger.log('â•â•â• TEST 1: getEstadisticasAdmin con anio=' + (new Date().getFullYear()-1) + ' â•â•â•');
  var e1 = getEstadisticasAdmin({ empresa: 'AMBAS', anio: String(new Date().getFullYear()-1) });
  if (e1.success) {
    Logger.log('Atenciones ' + (new Date().getFullYear()-1) + ': ' + e1.data.stats.atenciones.total + ' (debe ser SOLO de ese aÃ±o)');
    Logger.log('Tendencia: ' + JSON.stringify(e1.data.tendencia.map(function(t){ return t.label + ':' + t.atenciones; })));
  } else Logger.log('âŒ ' + e1.error);
 
  Logger.log('â•â•â• TEST 2: getEstadisticasAdmin sin filtros â•â•â•');
  var e2 = getEstadisticasAdmin({ empresa: 'AMBAS' });
  Logger.log(e2.success ? 'Atenciones total histÃ³rico: ' + e2.data.stats.atenciones.total : 'âŒ ' + e2.error);
 
  Logger.log('â•â•â• TEST 3: getResumenGeneral agregados â•â•â•');
  var r = getResumenGeneral({ empresa: 'AMBAS' });
  if (r.success) {
    Logger.log('Total: ' + r.data.total + ' | lista (slice): ' + r.data.lista.length);
    Logger.log('porAnio: ' + JSON.stringify(r.data.porAnio));
    Logger.log('porEstado: ' + JSON.stringify(r.data.porEstado));
    Logger.log('porMes (meses): ' + Object.keys(r.data.porMes).length);
  } else Logger.log('âŒ ' + r.error);
 
  Logger.log('â•â•â• TEST 4: filtro mes con meses en texto (mayo) â•â•â•');
  var r2 = getResumenGeneral({ empresa: 'AMBAS', mes: '5' });
  Logger.log(r2.success ? 'Registros de mayo (todos los aÃ±os): ' + r2.data.total : 'âŒ ' + r2.error);
}
// â•â•â•â• FIX _rgNormFila: soporta fechas en texto dd/MM/yyyy + sanidad de aÃ±o â•â•â•â•
function _rgNormFila(r) {
  var fechaStr = '';
  if (r[1] instanceof Date) {
    fechaStr = Utilities.formatDate(r[1], 'America/Lima', 'yyyy-MM-dd');
  } else {
    var s = String(r[1] || '').replace(/T.*/, '').trim();
    // â­ Fechas en texto dd/MM/yyyy (hojas antiguas)
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      fechaStr = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    } else {
      fechaStr = s.substring(0, 10);
    }
  }
  var mes = parseInt(r[5]);
  if (isNaN(mes) || !mes) {
    var txt = String(r[5] || '').toLowerCase().trim();
    mes = _RG_MES_NUM[txt] || 0;
  }
  var anio = parseInt(r[6]) || 0;
  // La fecha manda si es vÃ¡lida (yyyy-MM-dd)
  if (/^\d{4}-\d{2}/.test(fechaStr)) {
    var mF = parseInt(fechaStr.substring(5, 7));
    var aF = parseInt(fechaStr.substring(0, 4));
    if (mF >= 1 && mF <= 12) mes = mF;
    if (aF > 0) anio = aF;
  }
  // â­ Sanidad: aÃ±os imposibles no entran a los agregados
  if (anio < 2015 || anio > 2100) anio = 0;
  if (mes < 1 || mes > 12) mes = 0;
  return { mes: mes, anio: anio, fechaStr: fechaStr };
}
/*************************************************************************
 * UPDATE FUSION â€” EdiciÃ³n de registros de Fusiones de Buses
 * ----------------------------------------------------------------------
 * Permite editar un registro existente desde el botÃ³n âœï¸ Editar del
 * dashboard. Localiza la fila por ID (FUS-XXXX) y actualiza los campos
 * editables usando mapeo por CABECERA (seguro ante columnas nuevas).
 * NO toca: ID, Fecha, Hora, Usuario original.
 * Estado vuelve a "Pendiente" para que el administrador revalide.
 * Fotos: el frontend envÃ­a la URL nueva o conserva la existente.
 *
 * PASOS:
 *  1) Pegar este bloque al FINAL de codigo.gs
 *  2) Agregar el case en el switch de handle() (junto a saveFusion):
 *       case 'updateFusion': result = updateFusion(body); break;
 *  3) Implementar â†’ âœï¸ â†’ Nueva versiÃ³n.
 *************************************************************************/
 
function updateFusion(d) {
  try {
    if (!d.id) return { success: false, error: 'ID de fusiÃ³n no proporcionado' };
 
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Fusiones_Buses');
    if (!ws) return { success: false, error: 'Hoja Fusiones_Buses no encontrada' };
 
    var data = ws.getDataRange().getValues();
    var headers = data[0].map(function(h){ return String(h).toLowerCase().trim(); });
 
    // Mapeo por cabecera (tolerante a tildes/variantes)
    function col(frags) {
      for (var i = 0; i < headers.length; i++) {
        var ok = frags.every(function(f){ return headers[i].indexOf(f) !== -1; });
        if (ok) return i;
      }
      return -1;
    }
    var C = {
      id:           col(['id']),
      sector:       col(['sector']),
      supervisor:   col(['supervisor', 'responsable']),
      reemplazo:    col(['reemplazo']),
      reemplazante: col(['reemplazante']),
      reemplazado:  col(['reemplazado']),
      cantBuses:    col(['cantidad', 'buses']),
      rutaOrig:     col(['ruta', 'original']),
      codOrig:      col(['digo', 'original']),       // "CÃ³digo Ruta Original"
      totalTrab:    col(['total', 'trabaja']),
      ruta1:        col(['ruta', 'destino 1']),
           cod1:         col(['digo', 'ruta 1']),
      per1:         col(['personal', 'ruta 1']),
      cod2:         col(['digo', 'ruta 2']),
      per2:         col(['personal', 'ruta 2']),
      cod3:         col(['digo', 'ruta 3']),
      per3:         col(['personal', 'ruta 3']),
      ruta2:        col(['ruta', 'destino 2']),
      cod2:         col(['digo', 'destino 2']),
      per2:         col(['personal', 'destino 2']),
      ruta3:        col(['ruta', 'destino 3']),
      cod3:         col(['digo', 'destino 3']),
      per3:         col(['personal', 'destino 3']),
      motivo:       col(['motivo']),
      obs:          col(['observa']),
      foto1:        col(['foto 1']),
      foto2:        col(['foto 2']),
      foto3:        col(['foto 3']),
      estado:       col(['estado'])
    };
    if (C.id === -1) return { success: false, error: 'Columna ID no encontrada en la hoja' };
 
    // Localizar la fila por ID
    var fila = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][C.id]).trim() === String(d.id).trim()) { fila = r + 1; break; }
    }
    if (fila === -1) return { success: false, error: 'FusiÃ³n ' + d.id + ' no encontrada' };
 
    // Escribir solo campos editables (si la columna existe)
    function setC(idx, val) {
      if (idx !== -1 && val !== undefined) ws.getRange(fila, idx + 1).setValue(val);
    }
    setC(C.sector,       d.sector || '');
    setC(C.supervisor,   d.supervisor || '');
    setC(C.reemplazo,    d.reemplazo || 'No');
    setC(C.reemplazante, d.reemplazante || '');
    setC(C.reemplazado,  d.reemplazado || '');
    setC(C.cantBuses,    d.cantBuses || '');
    setC(C.rutaOrig,     d.rutaOrigen || '');
    setC(C.codOrig,      d.codOrigen || '');
    setC(C.totalTrab,    d.totalTrab || '');
    setC(C.ruta1, d.ruta1 || '');  setC(C.cod1, d.codigo1 || '');  setC(C.per1, d.personal1 || '');
    setC(C.ruta2, d.ruta2 || '');  setC(C.cod2, d.codigo2 || '');  setC(C.per2, d.personal2 || '');
    setC(C.ruta3, d.ruta3 || '');  setC(C.cod3, d.codigo3 || '');  setC(C.per3, d.personal3 || '');
    setC(C.motivo,       d.motivo || '');
    setC(C.obs,          d.observaciones || '');
    setC(C.foto1,        d.foto1 || '');
    setC(C.foto2,        d.foto2 || '');
    setC(C.foto3,        d.foto3 || '');
    // Tras editar, vuelve a Pendiente para revalidaciÃ³n del administrador
    setC(C.estado,       'Pendiente');
 
    return { success: true, message: 'FusiÃ³n ' + d.id + ' actualizada' };
 
  } catch(e) {
    return { success: false, error: 'updateFusion: ' + e.toString() };
  }
}
 
// â”€â”€ TEST: verifica el mapeo de columnas sin modificar nada â”€â”€
function _testUpdateFusionMapeo() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName('Fusiones_Buses');
  var headers = ws.getDataRange().getValues()[0];
  Logger.log('Cabeceras (' + headers.length + '): ' + JSON.stringify(headers));
  var r = updateFusion({ id: '__NO_EXISTE__' });
  Logger.log('Resultado esperado "no encontrada": ' + JSON.stringify(r));
}
function _testFusionAlineacion() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var ws = ss.getSheetByName('Fusiones_Buses');
  var data = ws.getDataRange().getValues();
  if (data.length < 2) { Logger.log('Sin registros para verificar'); return; }
  var headers = data[0];
  var fila = data[data.length - 1]; // Ãºltimo registro
  Logger.log('â•â•â• Cabecera â†’ Valor (Ãºltimo registro) â•â•â•');
  for (var i = 0; i < headers.length; i++) {
    Logger.log((i+1) + '. ' + headers[i] + ' â†’ "' + String(fila[i]).substring(0, 40) + '"');
  }
}
// â•â•â•â• updateFusion v2 â€” Ã­ndices FIJOS alineados a los DATOS reales â•â•â•â•
// (la cabecera de Fusiones_Buses tiene una columna fantasma "Responsable"
//  y estÃ¡ desfasada; los datos siempre han usado este orden fijo)
function updateFusion(d) {
  try {
    if (!d.id) return { success: false, error: 'ID de fusiÃ³n no proporcionado' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Fusiones_Buses');
    if (!ws) return { success: false, error: 'Hoja Fusiones_Buses no encontrada' };

    var data = ws.getDataRange().getValues();
    var fila = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === String(d.id).trim()) { fila = r + 1; break; }
    }
    if (fila === -1) return { success: false, error: 'FusiÃ³n ' + d.id + ' no encontrada' };

    // Columnas 5-28 (datos reales): Sector, Supervisor, Reemplazo, Reemplazante,
    // Reemplazado, CantBuses, RutaOrig, CodOrig, TotalTrab, R1,C1,P1, R2,C2,P2,
    // R3,C3,P3, Motivo, Observaciones, Foto1-3, Estado
    var valores = [
      d.sector || '', d.supervisor || '', d.reemplazo || 'No',
      d.reemplazante || '', d.reemplazado || '', d.cantBuses || '',
      d.rutaOrigen || '', d.codOrigen || '', d.totalTrab || '',
      d.ruta1 || '', d.codigo1 || '', d.personal1 || '',
      d.ruta2 || '', d.codigo2 || '', d.personal2 || '',
      d.ruta3 || '', d.codigo3 || '', d.personal3 || '',
      d.motivo || '', d.observaciones || '',
      d.foto1 || '', d.foto2 || '', d.foto3 || '',
      'Pendiente'  // tras editar, el administrador revalida
    ];
    ws.getRange(fila, 5, 1, valores.length).setValues([valores]);
    return { success: true, message: 'FusiÃ³n ' + d.id + ' actualizada' };
  } catch(e) {
    return { success: false, error: 'updateFusion: ' + e.toString() };
  }
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INFORMES INTEGRALES DE DESEMPEÃ‘O (EvaluaciÃ³n 360)
   Hoja: Informes_Integrales (se crea sola la primera vez)
   Acciones: saveInformeIntegral Â· updateInformeIntegral Â· getInformesIntegrales
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
 
var HOJA_INFORMES_INTEGRALES = 'Informes_Integrales';
 
function _ssInformesInt() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById('1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw');
}
 
function _hojaInformesInt() {
  var ss = _ssInformesInt();
  var h = ss.getSheetByName(HOJA_INFORMES_INTEGRALES);
  if (!h) {
    h = ss.insertSheet(HOJA_INFORMES_INTEGRALES);
    h.appendRow(['id', 'fecha_creacion', 'fecha_actualizacion', 'supervisor', 'periodo',
                 'percepcion', 'com_colaboradores', 'com_jefaturas', 'com_supervisores',
                 'com_administrador', 'com_visitas', 'observaciones',
                 'calificacion_global', 'nivel', 'generado_por']);
    h.setFrozenRows(1);
  }
  return h;
}
 
/* Guarda un informe nuevo. d = datos del POST */
function saveInformeIntegral(d) {
  try {
    var h = _hojaInformesInt();
    var id = 'INF-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd-HHmmss');
    var ahora = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss');
    h.appendRow([
      id, ahora, ahora,
      d.supervisor || '', d.periodo || '', d.percepcion || '',
      d.com_colaboradores || '', d.com_jefaturas || '', d.com_supervisores || '',
      d.com_administrador || '', d.com_visitas || '', d.observaciones || '',
      d.calificacion_global || '', d.nivel || '', d.generado_por || ''
    ]);
    return { success: true, id: id };
  } catch (e) {
    return { success: false, error: 'saveInformeIntegral: ' + e.message };
  }
}
 
/* Actualiza un informe existente por id (mapeo por cabeceras, seguro ante columnas nuevas) */
function updateInformeIntegral(d) {
  try {
    if (!d.id) return { success: false, error: 'Falta id' };
    var h = _hojaInformesInt();
    var datos = h.getDataRange().getValues();
    var cab = datos[0];
    var col = {};
    for (var c = 0; c < cab.length; c++) col[String(cab[c]).trim()] = c + 1;
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim() === String(d.id).trim()) {
        var fila = i + 1;
        var set = function (campo, valor) {
          if (col[campo] && valor !== undefined) h.getRange(fila, col[campo]).setValue(valor);
        };
        set('fecha_actualizacion', Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'));
        set('supervisor', d.supervisor); set('periodo', d.periodo); set('percepcion', d.percepcion);
        set('com_colaboradores', d.com_colaboradores); set('com_jefaturas', d.com_jefaturas);
        set('com_supervisores', d.com_supervisores); set('com_administrador', d.com_administrador);
        set('com_visitas', d.com_visitas); set('observaciones', d.observaciones);
        set('calificacion_global', d.calificacion_global); set('nivel', d.nivel);
        set('generado_por', d.generado_por);
        return { success: true, id: d.id };
      }
    }
    return { success: false, error: 'Informe no encontrado: ' + d.id };
  } catch (e) {
    return { success: false, error: 'updateInformeIntegral: ' + e.message };
  }
}
 
/* Lista informes (mÃ¡s recientes primero). p.supervisor opcional para filtrar */
function getInformesIntegrales(p) {
  try {
    p = p || {};
    var h = _hojaInformesInt();
    var datos = h.getDataRange().getValues();
    if (datos.length < 2) return { success: true, data: [] };
    var cab = datos[0].map(function (x) { return String(x).trim(); });
    var out = [];
    for (var i = 1; i < datos.length; i++) {
      var o = {};
      for (var c = 0; c < cab.length; c++) o[cab[c]] = datos[i][c];
      if (p.supervisor && String(o.supervisor).toUpperCase().indexOf(String(p.supervisor).toUpperCase()) === -1) continue;
      out.push(o);
    }
    out.reverse();
    return { success: true, data: out };
  } catch (e) {
    return { success: false, error: 'getInformesIntegrales: ' + e.message };
  }
}
 /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ESTADOS DE MANTENIMIENTO: ATENDIDO / CERRADO con fecha
   ----------------------------------------------------------------
   - actualizarEstadoMantenimiento({id, estado, admin})
       estado: 'ATENDIDO' -> registra fechaAtencion + atendidoPor
               'CERRADO'  -> registra fechaCierre + cerradoPor
   - getEstadosMantenimiento() -> { id: {fechaAtencion, fechaCierre, ...} }
 
   La hoja y las columnas se localizan SOLAS (tolerante a nombres).
   Si faltan las columnas nuevas, se crean al final de la hoja.
 
   ROUTER â€” agrega en el switch de handle(), antes del default:
     case 'actualizarEstadoMantenimiento': result = actualizarEstadoMantenimiento(body); break;
     case 'getEstadosMantenimiento':       result = getEstadosMantenimiento();           break;
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
 
// Localiza la hoja de solicitudes de mantenimiento
function _mantHoja() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var nombres = ['Solicitudes_Mantenimiento', 'SolicitudesMantenimiento',
                 'Solicitudes Mantenimiento', 'Solicitudes_Mant', 'Mantenimiento'];
  for (var i = 0; i < nombres.length; i++) {
    var h = ss.getSheetByName(nombres[i]);
    if (h) return h;
  }
  // Fallback: busca la hoja cuya cabecera tenga las columnas tÃ­picas del mÃ³dulo
  var hojas = ss.getSheets();
  for (var j = 0; j < hojas.length; j++) {
    var lastCol = hojas[j].getLastColumn();
    if (lastCol < 3 || hojas[j].getLastRow() < 1) continue;
    var cab = hojas[j].getRange(1, 1, 1, lastCol).getValues()[0].join('|').toLowerCase();
    if (cab.indexOf('fechaprogramada') !== -1 ||
        (cab.indexOf('tipomantenimiento') !== -1) ||
        (cab.indexOf('kilometraje') !== -1 && cab.indexOf('estado') !== -1)) {
      return hojas[j];
    }
  }
  return null;
}
 
function _mantNorm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
}
 
// Mapa de columnas (1-based). Crea las columnas nuevas si no existen.
function _mantColumnas(h) {
  var lastCol = h.getLastColumn();
  var cab = h.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = {};
  for (var c = 0; c < cab.length; c++) idx[_mantNorm(cab[c])] = c + 1;
  function buscar() {
    for (var i = 0; i < arguments.length; i++) {
      var k = _mantNorm(arguments[i]);
      if (idx[k]) return idx[k];
    }
    return 0;
  }
  function asegurar(nombre) {
    var col = buscar(nombre);
    if (col) return col;
    var nueva = h.getLastColumn() + 1;
    h.getRange(1, nueva).setValue(nombre);
    idx[_mantNorm(nombre)] = nueva;
    return nueva;
  }
  return {
    id:           buscar('id', 'numSolicitud', 'n_solicitud'),
    estado:       buscar('estado'),
    fechaAtencion: asegurar('fechaAtencion'),
    atendidoPor:   asegurar('atendidoPor'),
    fechaCierre:   asegurar('fechaCierre'),
    cerradoPor:    asegurar('cerradoPor')
  };
}
 
function actualizarEstadoMantenimiento(d) {
  try {
    d = d || {};
    var estado = String(d.estado || '').toUpperCase().trim();
    if (!d.id) return { ok: false, msg: 'Falta el id de la solicitud' };
    if (estado !== 'ATENDIDO' && estado !== 'CERRADO') return { ok: false, msg: 'Estado invÃ¡lido: ' + estado };
    var h = _mantHoja();
    if (!h) return { ok: false, msg: 'No se encontrÃ³ la hoja de solicitudes de mantenimiento' };
    var col = _mantColumnas(h);
    if (!col.id || !col.estado) return { ok: false, msg: 'La hoja no tiene columnas id/estado reconocibles' };
 
    var ids = h.getRange(2, col.id, Math.max(h.getLastRow() - 1, 1), 1).getValues();
    var hoy = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy');
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(d.id).trim()) {
        var fila = i + 2;
        h.getRange(fila, col.estado).setValue(estado);
        if (estado === 'ATENDIDO') {
          h.getRange(fila, col.fechaAtencion).setValue(hoy);
          h.getRange(fila, col.atendidoPor).setValue(d.admin || '');
        } else {
          h.getRange(fila, col.fechaCierre).setValue(hoy);
          h.getRange(fila, col.cerradoPor).setValue(d.admin || '');
        }
        return { ok: true, id: d.id, estado: estado, fecha: hoy };
      }
    }
    return { ok: false, msg: 'Solicitud no encontrada: ' + d.id };
  } catch (e) {
    return { ok: false, msg: 'actualizarEstadoMantenimiento: ' + e.message };
  }
}
 
function getEstadosMantenimiento() {
  try {
    var h = _mantHoja();
    if (!h) return { ok: true, data: {} };
    var col = _mantColumnas(h);
    if (!col.id || h.getLastRow() < 2) return { ok: true, data: {} };
    var n = h.getLastRow() - 1;
    var ids = h.getRange(2, col.id, n, 1).getValues();
    function leer(c) { return c ? h.getRange(2, c, n, 1).getValues() : null; }
    function fmt(v) {
      if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
        return Utilities.formatDate(v, 'America/Lima', 'dd/MM/yyyy');
      }
      return String(v || '').trim();
    }
    var fa = leer(col.fechaAtencion), ap = leer(col.atendidoPor);
    var fc = leer(col.fechaCierre),   cp = leer(col.cerradoPor);
    var out = {};
    for (var i = 0; i < n; i++) {
      var id = String(ids[i][0]).trim();
      if (!id) continue;
      var o = {};
      if (fa && fmt(fa[i][0])) o.fechaAtencion = fmt(fa[i][0]);
      if (ap && fmt(ap[i][0])) o.atendidoPor = fmt(ap[i][0]);
      if (fc && fmt(fc[i][0])) o.fechaCierre = fmt(fc[i][0]);
      if (cp && fmt(cp[i][0])) o.cerradoPor = fmt(cp[i][0]);
      if (Object.keys(o).length) out[id] = o;
    }
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, msg: 'getEstadosMantenimiento: ' + e.message };
  }
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PACK CASOS v2 â€” Matching tolerante de nombres + combo dinÃ¡mico
   ----------------------------------------------------------------
   1) _casoNombreMatch  â€” compara nombres SIN importar el orden
      (arregla: casos viejos guardados "ZAPATA SUAREZ ALEX FABIAN"
       ahora SÃ le figuran a "ALEX FABIAN ZAPATA SUAREZ")
      Validado: 10/10 nombres reales, 0 cruces falsos.
   2) getCasos v2       â€” idÃ©ntico al tuyo + el matcher como respaldo
   3) getSupervisoresCasos â€” combo de casos desde la hoja Usuarios

   PEGAR AL FINAL de codigo.gs (sobrescribe getCasos por hoisting).

   ROUTER â€” agrega UNA lÃ­nea en el switch de handle():
     case 'getSupervisoresCasos': result = getSupervisoresCasos(); break;
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// Compara dos nombres por palabras (â‰¥3 letras), sin tildes ni orden.
// Requiere al menos 2 palabras coincidentes (o todas si hay menos).
function _casoNombreMatch(a, b) {
  function norm(s) {
    return ' ' + String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim() + ' ';
  }
  var A = norm(a), B = norm(b);
  if (A === '  ' || B === '  ') return false;
  var toks = B.trim().split(' ').filter(function(t) { return t.length >= 3; });
  if (!toks.length) return false;
  var need = Math.min(2, toks.length);
  var hit = 0;
  for (var i = 0; i < toks.length; i++) {
    if (A.indexOf(' ' + toks[i] + ' ') !== -1) hit++;
  }
  return hit >= need;
}

// â•â•â•â• getCasos v2 â€” igual al original + matcher tolerante â•â•â•â•
function getCasos(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('BD_Casos');
    if (!ws) return { success: true, data: [] };
    const rows = p.historial
      ? ws.getDataRange().getValues()
      : [['hdr'], ...getRowsCurrentYear(ws, 500, 1)];
    if (rows.length <= 1) return { success: true, data: [] };
    let data = rows.slice(1).map(r => ({
      nro:            r[0],
      fecha_reg:      r[1] ? Utilities.formatDate(new Date(r[1]),'America/Lima','yyyy-MM-dd') : '',
      dni:            r[2],
      nombre:         r[3],
      empresa:        r[4],
      cargo:          r[5],
      sector:         r[6],
      ingreso:        r[7],
      termino:        r[8],
      supervisor:     r[9],
      motivo:         r[10],
      motivo_extra:   r[11],
      fecha_reporte:  r[12]||'',
      fecha_limite:   r[13]||'',
      temporada:      r[14],
      estado:         r[15],
      porcentaje:     r[16]||0,
      dias_retraso:   r[17]||0,
      motivo_retraso: r[18],
      redaccion:      r[19],
      nombre_informe: String(r[20]||''),
      enlace_informe: String(r[21]||''),
      nombre_reporte: String(r[22]||''),
      enlace_reporte: String(r[23]||''),
      registrado_por: String(r[24]||''),
      gravedad:       String(r[25]||'BAJO'),
      estado_gestion: String(r[26]||'PENDIENTE'),
      tipo_sancion:         String(r[27]||''),
      sancion_fecha_inicio: r[28] instanceof Date ? Utilities.formatDate(r[28],'America/Lima','yyyy-MM-dd') : String(r[28]||''),
      sancion_fecha_fin:    r[29] instanceof Date ? Utilities.formatDate(r[29],'America/Lima','yyyy-MM-dd') : String(r[29]||''),
      sancion_dias:         Number(r[30])||0
    }));

    // Filtrar por rol: supervisor solo ve sus registros
    var ROLES_ADMIN_CASOS = ['administrador','administrador 01','administrador 02','coordinador','jefa_rl'];
    var rolNorm = String(p.rol||'').trim().toLowerCase();
    var esAdmin = ROLES_ADMIN_CASOS.indexOf(rolNorm) >= 0;

    if (!esAdmin) {
      var usuarioNorm = String(p.usuario||'').trim().toLowerCase();
      var nombreNorm  = String(p.nombre ||'').trim().toLowerCase();

      data = data.filter(function(c){
        var sup = String(c.supervisor    ||'').trim().toLowerCase();
        var reg = String(c.registrado_por||'').trim().toLowerCase();
        if (!sup && !reg) return false;

        return reg === usuarioNorm
            || reg === nombreNorm
            || sup === usuarioNorm
            || sup === nombreNorm
            || (sup && usuarioNorm && sup.indexOf(usuarioNorm) >= 0)
            || (sup && nombreNorm  && sup.indexOf(nombreNorm)  >= 0)
            || _casoNombreMatch(sup, nombreNorm);   // â­ NUEVO: nombres invertidos
      });
    }
    if (p.empresa)    data = data.filter(c => c.empresa === p.empresa);
    if (p.motivo)     data = data.filter(c => c.motivo === p.motivo);
    if (p.supervisor) data = data.filter(c => String(c.supervisor||'').toLowerCase().includes(String(p.supervisor).toLowerCase()) || _casoNombreMatch(c.supervisor, p.supervisor));
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// â•â•â•â• getSupervisoresCasos â€” combo de casos desde hoja Usuarios â•â•â•â•
// Columnas (igual que login/invListarSupervisores):
//   B=usuario(1) D=nombre(3) E=rol(4) G=activo(6) J=cargo(9) K=sector(10)
function getSupervisoresCasos() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var h = ss.getSheetByName('Usuarios') || ss.getSheetByName('usuarios');
    if (!h) return { success: false, error: 'Hoja Usuarios no encontrada' };
    var rows = h.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var nombre = String(r[3] || '').trim();
      if (!nombre) continue;
      var rol    = String(r[4] || '').trim().toLowerCase();
      var activo = r[6] === true || String(r[6]).trim().toUpperCase() === 'TRUE';
      var cargo  = String(r[9] || '').toUpperCase();
      var sector = String(r[10] || '').toUpperCase().trim();
      if (!activo) continue;
      if (rol !== 'supervisor') continue;
      if (sector === 'BIENESTAR SOCIAL' || sector === 'RECLUTAMIENTO') continue;
      if (cargo.indexOf('SUPERVISOR') === -1 && cargo.indexOf('ASISTENTE DE RELACIONES') === -1) continue;
      out.push(nombre);
    }
    out.sort();
    return { success: true, data: out };
  } catch (e) {
    return { success: false, error: 'getSupervisoresCasos: ' + e.message };
  }
}
