// ============================================================
// SISTEMA RL v3.0 - VERFRUT & RAPEL // v3
// Google Apps Script - API completa
// ============================================================

const SPREADSHEET_ID = '1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw';

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
      case 'getAtenciones':     result = getAtenciones(params);    break;
      case 'getAtencionesOptimizado': result = getAtencionesOptimizado(params); break;
      case 'saveAtencion':      result = saveAtencion(body);       break;
      case 'updateAtencion':    result = updateAtencion(body);     break;
      case 'deleteAtencion':    result = deleteAtencion(body);     break;
      case 'buscarTrabajador':  result = buscarTrabajador(params); break;
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
      case 'updateCaso':          result = updateCaso(body);             break;
      case 'recalcularEstadisticasCompletas': result = recalcularEstadisticasCompletas(); break;
      case 'saveSolicitudAcceso':     result = saveSolicitudAcceso(body);       break;
      case 'aprobarAccesoTemporal':   result = aprobarAccesoTemporal(body);     break;
      case 'verificarAccesoTemporal': result = verificarAccesoTemporal(params); break;
      case 'getSolicitudesAcceso':    result = getSolicitudesAcceso(params);    break;
      case 'resolverAccesoTemporal':  result = aprobarAccesoTemporal(body);     break;
      case 'subirArchivoAzure':       result = subirArchivoAzure(body);         break;
 
      // ═══════════════ MÓDULO CAPACITACIONES ═══════════════
      case 'guardarCapacitacion':          result = capGuardar(body);          break;
      case 'listarCapacitaciones':         result = capListar(body);           break;
      case 'exportarCapacitaciones':       result = capExportar(body);         break;
      case 'estadisticasCapacitaciones':   result = capEstadisticas(body);     break;
      // ═════════════════════════════════════════════════════
     // ═══════════════ MÓDULO INVENTARIO ═══════════════════
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
      // ═════════════════════════════════════════════════════
     // ═══════════════ MÓDULO INVENTARIO V2 ═════════════════
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
      // ═════════════════════════════════════════════════════
     
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
  // Cache de hoja Usuarios para múltiples logins simultáneos
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
            fundos:             fundos,
            necesitaElegirFundo: necesitaElegirFundo
          }
        };
      }
    }
    return null;
  };

  // Buscar en primeras 50 filas (más rápido)
  encontrado = buscar(1, 51);
  // Si no encontró, buscar el resto
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

// ── Lectura optimizada: últimas N filas de una hoja ──
// Evita leer miles de filas históricas innecesariamente
function getRowsOptimized(sheet, maxRows) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];          // solo header
  const startRow = Math.max(2, lastRow - maxRows + 1);
  const numRows  = lastRow - startRow + 1;
  return sheet.getRange(startRow, 1, numRows, lastCol).getValues();
}

// Lectura del año actual: lee desde atrás hasta encontrar filas del año anterior
function getRowsCurrentYear(sheet, maxRows, colFecha) {
  const lastRow  = sheet.getLastRow();
  const lastCol  = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  const anioActual = new Date().getFullYear();
  // Leer en bloques de 500 desde el final
  const bloque = Math.min(maxRows, lastRow - 1);
  const startRow = Math.max(2, lastRow - bloque + 1);
  const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
  // Filtrar solo año actual (o sin fecha = incluir)
  return rows.filter(r => {
    if (!r[0]) return false;
    const fecha = r[colFecha];
    if (!fecha) return true;
    const d = (fecha instanceof Date) ? fecha : new Date(fecha);
    return isNaN(d.getTime()) || d.getFullYear() >= anioActual - 1; // año actual y anterior
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
        const k = String(r[0]);
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
try { actualizarFirebaseRapido(d); } catch(e) { Logger.log('Firebase rapid error: ' + e); }
  return { success: true, nro: nro, hoja: nombreHoja };
}
// ============================================================
// ATENCIONES - UPDATE
// ============================================================
function updateAtencion(d) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const candidatos = [];

  // Buscar en hojas por año primero, luego base
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
        // Verificar permisos: comparar usuario_sistema (col 27, índice 27)
        if (d.rol === 'supervisor' && String(rows[i][27]).trim() !== String(d.usuario).trim()) {
          return { success: false, error: 'No tienes permiso para editar este registro.' };
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
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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
  
  // Buscar en hoja del año actual primero
  const sheetAnio = ss.getSheetByName('BB. DE REGISTROS ' + anioActual);
  if (sheetAnio) candidatos.push(sheetAnio);
  
  // Años anteriores
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
         try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
        return { success: true };
      }
    }
  }
  return { success: false, error: 'Registro no encontrado.' };
}

// ============================================================
// CONSULTA POR DNI
// ============================================================
function consultaDNI(p) {
  const dni = String(p.dni || '').trim();
  if (!dni || dni.length < 7) return { success: false, error: 'Ingresa un DNI valido.' };
  const rows = getSheet('BB. DE REGISTROS').getDataRange().getValues();
  if (rows.length < 2) return { success: true, data: [], trabajador: null };
  let lista = [], trabajador = null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][7]).trim() === dni) {
      let o = {};
      COLS.forEach((h, j) => o[h] = rows[i][j]);
      lista.push(o);
      if (!trabajador) trabajador = { dni: rows[i][7], nombre: rows[i][8], empresa: rows[i][11], cargo: rows[i][13], fundo: rows[i][12] };
    }
  }
  lista.sort((a, b) => String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)));
  return { success: true, data: lista, trabajador };
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
  const rows = sh.getRange(2, 1, lastRow - 1, 18).getValues();
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
    ]);
  }
  return datos;
}
function getCacheKey(hoja) { return 'v2_' + hoja; }

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
    cache.put(key + '_' + i, json.substring(i * size, (i + 1) * size), 600);
  }
  cache.put(key + '_meta', JSON.stringify({ chunks }), 600);
}
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
        const [dniRaw, nombre, sexo, fip, fundo, cargo, ruta, codigo, ftp, empSheet, regimen] = datos[i];
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
    // Supervisores: solo año actual
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
        const k = String(r[0]);
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
// ============================================================
// RESUMEN GENERAL
// ============================================================
function getResumenGeneral(p) {
  const ss3 = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anio3 = new Date().getFullYear();
  const shR = ss3.getSheetByName('BB. DE REGISTROS ' + anio3) || ss3.getSheetByName('BB. DE REGISTROS');
  if (!shR) return { success:true, data:{lista:[],porSupervisor:{}} };
  const rows = shR.getDataRange().getValues();
  if (rows.length < 2) return { success:true, data:{lista:[],porSupervisor:{}} };
  let lista = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] && !rows[i][7]) continue;
    let o = {};
    COLS.forEach((h, j) => o[h] = rows[i][j]);
    lista.push(o);
  }
  if (p.empresa && p.empresa !== 'AMBAS') lista = lista.filter(a => String(a.empresa).toUpperCase() === p.empresa);
  if (p.mes)  lista = lista.filter(a => String(a.mes)  === p.mes);
  if (p.anio) lista = lista.filter(a => String(a.anio) === p.anio);

  const ps = {};
  lista.forEach(a => {
    const s = String(a.supervisor || 'Sin asignar').trim();
    if (!ps[s]) ps[s] = { nombre:s, total:0, pendientes:0, resueltos:0, enProceso:0 };
    ps[s].total++;
    const e = String(a.estado || '').toUpperCase();
    if (e === 'PENDIENTE')  ps[s].pendientes++;
    if (e === 'RESUELTO')   ps[s].resueltos++;
    if (e === 'EN PROCESO') ps[s].enProceso++;
  });
  lista.sort((a, b) => String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)));
  return { success:true, data:{ lista:lista.slice(0,500), porSupervisor:ps } };
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

  // Leer de hojas por año: 2026, 2025, 2024
  const hojas = [
    'BB. DE REGISTROS 2026',
    'BB. DE REGISTROS 2025',
    'BB. DE REGISTROS 2024'
  ];

  hojas.forEach(nombreHoja => {
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) { hojasInfo.push({hoja: nombreHoja, encontrados: 0, motivo: 'no existe'}); return; }
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) { hojasInfo.push({hoja: nombreHoja, encontrados: 0, motivo: 'vacía'}); return; }
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      // Columna A=nro(0), B=fecha_atencion(1)
      if (!rows[i][0] && !rows[i][1]) continue;
      let o = {};
      COLS.forEach((h, j) => o[h] = rows[i][j]);
      // Normalizar fecha columna B (índice 1)
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
// MÓDULO VISITAS DE CAMPO
// ============================================================
function saveVisita(d) {
  try {
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) {
      ws = ss.insertSheet('Visitas_Campo');
      ws.appendRow([
        'N°','Fecha Registro','Empresa','Supervisor','DNI','Correo',
        'Fundo','Punto','Fecha Inicio','Fecha Fin','Semana',
        'Fecha Informe','Para','Asunto','Desarrollo','Rutas',
        'Acciones','Compromisos','Observaciones','Motivo Retraso',
        'N° Fotos','Estado','Registrado Por',
        'Temporada','Días Transcurridos','Días Permitidos','Días Retraso','% Avance','% Retraso'
      ]);
    }
    const lastRow = ws.getLastRow();
    const nro     = lastRow; // N° correlativo

    // Calcular días hábiles y estado
    let estado = 'EN PLAZO';
    if (d.fecha_fin) {
      const ff   = new Date(d.fecha_fin);
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
     try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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
        nro:            r[0],
        fecha_reg:      r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd') : String(r[1]||'').substring(0,10),
        empresa:        String(r[2]||''),
        supervisor:     String(r[3]||'').trim(),
        dni:            r[4],
        fundo:          String(r[6]||''),
        sector:         String(r[6]||''),
        semana:         r[10],
        fecha_informe:  r[11] instanceof Date ? Utilities.formatDate(r[11],'America/Lima','yyyy-MM-dd') : String(r[11]||'').substring(0,10),
        estado:         String(r[21]||''),
        enlace_informe: String(r[23]||''),
        registrado_por: String(r[22]||'')
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
// MÓDULO SUPERVISORES (compartido entre módulos)
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
// AZURE BLOB STORAGE — Registro de archivos subidos
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
        'Fecha', 'Módulo', 'Empresa', 'Usuario',
        'Nombre Archivo', 'Tipo', 'Tamaño (bytes)', 'Tamaño (MB)',
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
// MÓDULO CASOS
// ============================================================
function saveCaso(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('BD_Casos');
    if (!ws) {
      ws = ss.insertSheet('BD_Casos');
      ws.appendRow([
        'N°','Fecha Registro','DNI','Nombre','Empresa','Cargo','Sector',
        'Ingreso','Término','Supervisor','Motivo','Motivo Extra',
        'Fecha Reporte','Fecha Límite','Temporada','Estado','% Avance',
        'Días Retraso','Motivo Retraso','Redacción',
        'Informe','Enlace Informe','Reporte','Enlace Reporte','Registrado Por'
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
      d.estado || '',
      d.porcentaje || 0,
      d.dias_retraso || 0,
      d.motivo_retraso || '',
      d.redaccion || '',
      d.nombre_informe || '',
      d.enlace_informe || '',
      d.nombre_reporte || '',
      d.enlace_reporte || '',
      d.registrado_por || ''
    ]);
     try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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
  estado_gestion: String(r[26]||'PENDIENTE')
}));
    // Filtrar por rol: supervisor solo ve sus registros
    if (p.rol !== 'administrador') {
      data = data.filter(c => c.registrado_por === p.usuario ||
                              c.supervisor.toLowerCase().includes(p.usuario.toLowerCase()));
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
// MÓDULO SOLICITUDES DE EDICIÓN
// ============================================================
function saveSolicitud(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let ws = ss.getSheetByName('Solicitudes_Edicion');
    if (!ws) {
      ws = ss.insertSheet('Solicitudes_Edicion');
      ws.appendRow([
        'N°','Fecha Solicitud','N° Visita','Supervisor','Empresa',
        'Fundo','Semana','Fecha Informe','Motivo','Solicitado Por',
        'Estado','Resuelto Por','Fecha Resolución','Motivo Rechazo'
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

// ══════════════════ FUSIONES DE BUSES ══════════════════

function saveFusion(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let hoja = ss.getSheetByName('Fusiones_Buses');
    if(!hoja) {
      hoja = ss.insertSheet('Fusiones_Buses');
      hoja.appendRow([
        'ID','Fecha','Hora','Usuario','Sector','Supervisor Responsable',
        'Reemplazo','Supervisor Reemplazante','Supervisor Reemplazado',
        'Cantidad Buses','Ruta Original','Código Ruta Original','Total Trabajadores',
        'Ruta Destino 1','Código Ruta 1','Personal Ruta 1',
        'Ruta Destino 2','Código Ruta 2','Personal Ruta 2',
        'Ruta Destino 3','Código Ruta 3','Personal Ruta 3',
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
    try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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

// ══════════════════ ESTADÍSTICAS ADMIN CONSOLIDADAS ══════════════════
// Normalizar fecha a {mes, anio} — función global (fuera de getEstadisticasAdmin)
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

    // ── ATENCIONES: combinar 2024+2025+2026+base ──
    var hojas = ['BB. DE REGISTROS 2024','BB. DE REGISTROS 2025','BB. DE REGISTROS ' + anioActual,'BB. DE REGISTROS'];
    var vistosAt = new Set();
    var rawAt = [];
    hojas.forEach(function(n) {
      var ws = ss.getSheetByName(n);
      if (!ws) return;
      ws.getDataRange().getValues().slice(1).forEach(function(r) {
        var k = String(r[0]);
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

    // ── VISITAS ──
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

    // ── CASOS ──
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

    // ── FUSIONES ──
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

    // ── Filtros ──
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

    // ── STATS GLOBALES ──
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

    // ── POR SUPERVISOR ──
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

    // ── TENDENCIA últimos 6 meses ──
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

// ══════════════════ PRELOAD - CARGA INICIAL COMPLETA ══════════════════
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

    // ── Atenciones: solo para supervisores en preload ──
    // Admins cargan atenciones lazy (cuando abren el módulo)
    let atenciones = [];
    if (!esAdmin) {
      try { const d = getAtenciones(p); if (d.success) atenciones = d.data; } catch(e){}
    }

    // ── Stats dashboard (siempre, para todos) ──
    let stats = { hoy:0, mes:0, anio:0, total:0, enProceso:0, finalizados:0, porMes:{}, porTipo:{}, porEstado:{} };
    try { const d = getEstadisticas(p); if (d.success) stats = d.data; } catch(e){}

    // ── Visitas ──
    let visitas = [];
    try { const d = getVisitas(p); if (d.success) visitas = d.data; } catch(e){}

    // ── Casos ──
    let casos = [];
    try { const d = getCasos(p); if (d.success) casos = d.data; } catch(e){}

    // ── Fusiones ──
    let fusiones = [];
    try { const d = getFusiones(p); if (d.success) fusiones = d.data; } catch(e){}

    // ── Solicitudes (solo admins) ──
    let solicitudes = [];
    try { if (esAdmin) { const d = getSolicitudes(p); if (d.success) solicitudes = d.data; } } catch(e){}

    // ── Estadísticas admin: carga bajo demanda ──
    let estadisticasAdmin = null;

    // ── Supervisores ──
    let supervisores = [];
    try { const d = getSupervisores(); if (d.success) supervisores = d.data; } catch(e){}

    // ── Usuarios (solo admin puro) ──
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
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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
        if (d.estado         !== undefined) ws.getRange(r, 16).setValue(d.estado);
        if (d.porcentaje     !== undefined) ws.getRange(r, 17).setValue(d.porcentaje);
        if (d.dias_retraso   !== undefined) ws.getRange(r, 18).setValue(d.dias_retraso);
        if (d.motivo_retraso !== undefined) ws.getRange(r, 19).setValue(d.motivo_retraso);
        if (d.redaccion      !== undefined) ws.getRange(r, 20).setValue(d.redaccion);
        if (d.nombre_informe !== undefined) ws.getRange(r, 21).setValue(d.nombre_informe);
        if (d.enlace_informe !== undefined) ws.getRange(r, 22).setValue(d.enlace_informe);
        if (d.nombre_reporte !== undefined) ws.getRange(r, 23).setValue(d.nombre_reporte);
        if (d.enlace_reporte !== undefined) ws.getRange(r, 24).setValue(d.enlace_reporte);
        if (d.gravedad       !== undefined) ws.getRange(r, 26).setValue(d.gravedad);
        if (d.estado_gestion !== undefined) ws.getRange(r, 27).setValue(d.estado_gestion);
        try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
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
      ws.appendRow(['ID','Fecha Evaluación','Evaluador','Supervisor Evaluado',
        'Empresa','Fundo/Sector','Puntaje Liderazgo','Puntaje Comunicación',
        'Puntaje Cumplimiento','Puntaje Gestión Equipo','Puntaje Resolución',
        'Puntaje Planificación','Puntaje Total','% Cumplimiento','Nivel',
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
// ══════════════════ FIREBASE ESTADÍSTICAS ══════════════════

function _fbPatchEstadisticas(data) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('⚠️ FIREBASE_DB_SECRET no configurado en propiedades del script');
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
        const k = String(r[0]);
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

    Logger.log('Estadísticas Firebase actualizadas: ' + total + ' registros');
  } catch(e) {
    Logger.log('actualizarEstadisticasFirebase error: ' + e.toString());
  }
}

function recalcularEstadisticasCompletas() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const anio = new Date().getFullYear();
    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const hoyStr = Utilities.formatDate(hoy, 'GMT-5', 'yyyy-MM-dd');

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
      let fecha = '';
      if (r[1] instanceof Date) {
        fecha = Utilities.formatDate(r[1], 'GMT-5', 'yyyy-MM-dd');
      } else {
        fecha = String(r[1]||'').substring(0, 10);
      }

      let mesNum  = parseInt(r[5]) || 0;
      let anioNum = parseInt(r[6]) || 0;
      if (!mesNum && fecha.length >= 7) {
        mesNum  = parseInt(fecha.substring(5, 7)) || 0;
        anioNum = parseInt(fecha.substring(0, 4)) || 0;
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
        ultima_actualizacion: Date.now()
      },
      por_supervisor: porSupervisor,
      por_mes: porMes,
      por_anio: porAnio,
      por_empresa: porEmpresa
    });

    Logger.log('✅ Total: ' + total);
    Logger.log('HOY: ' + hoyN + ' | MES: ' + esteMes + ' | EN PROCESO: ' + enProceso + ' | FINALIZADOS: ' + finalizados);
    Logger.log('RAPEL: ' + porEmpresa.RAPEL.total + ' | VERFRUT: ' + porEmpresa.VERFRUT.total);
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
      ws.appendRow(['N°','Fecha','Usuario','Nombre','Motivo',
        'Horas Solicitadas','Estado','Aprobado Por',
        'Hora Inicio','Hora Fin','Fecha Resolución']);
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

    for (var i = startIndex; i < rows.length; i++) {
      if (String(rows[i][2]).trim() === String(d.usuario).trim() &&
          String(rows[i][6]).toUpperCase().trim() === 'PENDIENTE') {

        // Si admin no especificó horas, usar las solicitadas
        if (!horasAprobadas) horasAprobadas = parseInt(rows[i][5]) || 1;

        var ahora = new Date();
        var hastaMillis = ahora.getTime() + (horasAprobadas * 60 * 60 * 1000);
        var horaFin = new Date(hastaMillis);

        var filaSheet = i + 1;
        ws.getRange(filaSheet, 7).setValue(d.decision || 'APROBADO');
        ws.getRange(filaSheet, 8).setValue(aprobadoPor);
        ws.getRange(filaSheet, 9).setValue(Utilities.formatDate(ahora, 'GMT-5', 'HH:mm'));
        ws.getRange(filaSheet, 10).setValue(Utilities.formatDate(horaFin, 'GMT-5', 'HH:mm'));
        ws.getRange(filaSheet, 11).setValue(ahora);
        ws.getRange(filaSheet, 12).setValue(hastaMillis);
        ws.getRange(filaSheet, 6).setValue(horasAprobadas);

        return {
          success: true,
          hastaHora: Utilities.formatDate(horaFin, 'GMT-5', 'HH:mm'),
          hastaFecha: Utilities.formatDate(horaFin, 'GMT-5', 'dd/MM/yyyy HH:mm'),
          horasAprobadas: horasAprobadas,
          expiraEn: hastaMillis,
          decision: d.decision || 'APROBADO'
        };
      }
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

    // Recorrer DESDE EL FINAL (más reciente primero)
    for (var i = rows.length - 1; i >= 1; i--) {
      var usuarioFila = String(rows[i][2] || '').trim();
      var estadoFila  = String(rows[i][6] || '').toUpperCase().trim();

      // Solo filas APROBADAS del usuario
      if (usuarioFila !== String(p.usuario).trim()) continue;
      if (estadoFila !== 'APROBADO') continue;

      // ✅ FIX: Leer timestamp expiración desde columna 12 (r[11])
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
      // Si expiró, seguir buscando por si hay otra aprobación más nueva
    }

    return { success: true, tieneAcceso: false, motivo: 'sin aprobación vigente' };
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
        // Leer timestamp de expiración (columna 12)
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
// ══════════════════ AZURE BLOB STORAGE ══════════════════

function subirArchivoAzure(d) {
  try {
    const props = PropertiesService.getScriptProperties();
    const account  = props.getProperty('AZURE_STORAGE_ACCOUNT') || 'sistemarlverfrut';
    const carpeta  = d.carpeta || 'casos-rl';
    
    // Seleccionar SAS token según contenedor
    let sasToken, container;
    if (carpeta === 'Visitas_Campo' || carpeta === 'visitas-campo') {
      sasToken  = props.getProperty('AZURE_SAS_VISITAS_CAMPO') || props.getProperty('AZURE_SAS_TOKEN');
      container = props.getProperty('AZURE_CONTAINER_VISITAS') || 'visitas-campo';
    } else {
      sasToken  = props.getProperty('AZURE_SAS_CASOS_RL') || props.getProperty('AZURE_SAS_TOKEN');
      container = props.getProperty('AZURE_CONTAINER_CASOS') || 'casos-rl';
    }

    if (!sasToken) return { success: false, error: 'SAS Token no configurado' };

    // Limpiar base64 — eliminar prefijo data:...;base64,
    let b64 = d.base64 || d.datos || '';
    if (!b64) return { success: false, error: 'base64 vacío' };
    if (b64.indexOf(',') !== -1) b64 = b64.split(',')[1];
    b64 = b64.replace(/\s/g, ''); // eliminar espacios y saltos de línea

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
 * ═══════════════════════════════════════════════════════════════════
 *  MÓDULO CAPACITACIONES — Backend Apps Script
 *  Sistema RR.LL. v3.0 — Verfrut / Rapel
 *
 *  IMPORTANTE: Estas funciones retornan OBJETOS planos (no
 *  ContentService), porque handle(e) ya se encarga del JSON.
 * ═══════════════════════════════════════════════════════════════════
 */
 
// ══════════════ CONFIGURACIÓN ══════════════
const CAP_SHEET_BBDD = 'BD_Capacitaciones';      // Hoja de asistentes
const CAP_SHEET_HDR  = 'CAPACITACIONES_HDR';     // Hoja de cabeceras
 
 
// ═══════════════════════════════════════════════════════════════════
//  SETUP INICIAL — Ejecutar UNA VEZ desde el editor
// ═══════════════════════════════════════════════════════════════════
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
    Logger.log('✓ Hoja creada: ' + CAP_SHEET_HDR);
  } else {
    Logger.log('• Hoja ya existe: ' + CAP_SHEET_HDR);
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
    Logger.log('✓ Hoja creada: ' + CAP_SHEET_BBDD);
  } else {
    Logger.log('• Hoja ya existe: ' + CAP_SHEET_BBDD);
  }
 
  Logger.log('═══ Setup completado ═══');
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  GUARDAR CAPACITACIÓN (cabecera + asistentes en batch)
// ═══════════════════════════════════════════════════════════════════
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
 try { actualizarFirebaseModulos(); } catch(em) { Logger.log('Firebase módulos: ' + em); }
    return {
      success: true,
      idCapacitacion: actividad.idCapacitacion,
      registrosGuardados: asistentes.length,
      mensaje: 'Capacitación guardada correctamente'
    };
 
  } catch (err) {
    Logger.log('ERROR capGuardar: ' + err.message);
    return { success: false, error: err.message };
  }
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  LISTAR CAPACITACIONES con filtros opcionales
// ═══════════════════════════════════════════════════════════════════
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
      // Admin puede filtrar por supervisor específico
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

    // Tendencia últimos 6 meses
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
 
 
// ═══════════════════════════════════════════════════════════════════
//  EXPORTAR ASISTENTES POR RANGO DE FECHAS
// ═══════════════════════════════════════════════════════════════════
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
    if (!bbdd) return { success: true, registros: [] };
 
    const datos = bbdd.getDataRange().getValues();
    if (datos.length < 2) return { success: true, registros: [] };
 
    const headers = datos[0];
    const registros = [];
 
    for (let r = 1; r < datos.length; r++) {
      const obj = {};
      headers.forEach((h, i) => obj[h] = datos[r][i]);
 
      const fechaCap = (obj['FECHA_CAPACITACION'] || '').toString().split('T')[0];
      if (fechaCap < desde || fechaCap > hasta) continue;
      if (empresa && obj['EMPRESA'] !== empresa) continue;
 
      registros.push(obj);
    }
    return { success: true, registros: registros, total: registros.length };
  } catch (err) {
    Logger.log('ERROR capExportar: ' + err.message);
    return { success: false, error: err.message };
  }
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════
function capToCamel(s) {
  return s.toString().toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  UTILIDADES DE DEBUG
// ═══════════════════════════════════════════════════════════════════
function capVerificarHojas() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const hdr  = ss.getSheetByName(CAP_SHEET_HDR);
  const bbdd = ss.getSheetByName(CAP_SHEET_BBDD);
 
  Logger.log('══ Estado de hojas ══');
  Logger.log(CAP_SHEET_HDR + ': ' + (hdr ? '✓ existe (' + hdr.getLastRow() + ' filas)' : '✗ NO EXISTE'));
  Logger.log(CAP_SHEET_BBDD + ': ' + (bbdd ? '✓ existe (' + bbdd.getLastRow() + ' filas)' : '✗ NO EXISTE'));
}
 
function capTestGuardado() {
  const body = {
    actividad: {
      idCapacitacion: 'TEST-' + Date.now(),
      empresa: 'RAPEL',
      tipo: 'CAPACITACIÓN',
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
      { dni: '72345678', nombres: 'GARCÍA LÓPEZ, PEDRO', cargo: 'Aplicador', sexo: 'M', fundo: 'F1' },
      { dni: '72345679', nombres: 'MENDOZA RÍOS, ANA',   cargo: 'Packing',   sexo: 'F', fundo: 'F2' },
    ]
  };
 
  const resp = capGuardar(body);
  Logger.log('Respuesta: ' + JSON.stringify(resp));
}
/**
 * ═══════════════════════════════════════════════════════════════════
 *  MÓDULO INVENTARIO DE CANASTAS — Backend Apps Script
 *  Sistema RR.LL. v3.0 — Verfrut / Rapel
 *
 *  IMPORTANTE: Estas funciones retornan OBJETOS planos (no
 *  ContentService), porque handle(e) ya se encarga del JSON.
 *
 *  PDF: Se genera y descarga directamente desde el navegador del
 *  usuario, NO se sube a Drive.
 * ═══════════════════════════════════════════════════════════════════
 */
 
// ══════════════ CONFIGURACIÓN ══════════════
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
  'Olga Vilela Ludeña',
  'Jorge Chávez Córdova',
  'Alex Tineo Ramos',
  'Yhanelly Luzon Venegas'
];
 
 
// ═══════════════════════════════════════════════════════════════════
//  SETUP — Ejecutar UNA VEZ desde el editor
// ═══════════════════════════════════════════════════════════════════
function invSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
 
  // RECETA
  let h = ss.getSheetByName(INV_SH_RECETA);
  if (!h) {
    h = ss.insertSheet(INV_SH_RECETA);
    h.appendRow(['ID', 'PRODUCTO', 'UNIDAD', 'CANTIDAD', 'CREADO', 'CREADO_POR']);
    h.getRange('A1:F1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('✓ ' + INV_SH_RECETA);
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
    Logger.log('✓ ' + INV_SH_RESPONSABLES + ' con ' + INV_RESPONSABLES_INICIALES.length + ' iniciales');
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
    Logger.log('✓ ' + INV_SH_META);
  }
 
  // INGRESOS
  h = ss.getSheetByName(INV_SH_INGRESOS);
  if (!h) {
    h = ss.insertSheet(INV_SH_INGRESOS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'PRODUCTO', 'CANTIDAD', 'UNIDAD', 'FECHA_INGRESO', 'FECHA_VENC', 'LOTE', 'RESPONSABLE', 'PROVEEDOR', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:L1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('✓ ' + INV_SH_INGRESOS);
  }
 
  // ARMADOS
  h = ss.getSheetByName(INV_SH_ARMADOS);
  if (!h) {
    h = ss.insertSheet(INV_SH_ARMADOS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'FECHA_ARMADO', 'CANTIDAD', 'RESPONSABLE', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:G1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('✓ ' + INV_SH_ARMADOS);
  }
 
  // ENTREGAS
  h = ss.getSheetByName(INV_SH_ENTREGAS);
  if (!h) {
    h = ss.insertSheet(INV_SH_ENTREGAS);
    h.appendRow(['ID', 'FECHA_REGISTRO', 'FECHA_ENTREGA', 'EMPRESA', 'SECTOR', 'CANTIDAD', 'RESPONSABLE', 'DOCUMENTO', 'OBSERVACIONES', 'USUARIO']);
    h.getRange('A1:J1').setFontWeight('bold').setBackground('#0a2463').setFontColor('white');
    h.setFrozenRows(1);
    Logger.log('✓ ' + INV_SH_ENTREGAS);
  }
 
  Logger.log('═══ Setup inventario completado ═══');
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  GET ALL — Carga inicial (todo en una sola llamada)
// ═══════════════════════════════════════════════════════════════════
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
 
// ═══════════════════════════════════════════════════════════════════
//  RECETA
// ═══════════════════════════════════════════════════════════════════
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
    const item = body.item;
    if (!item || !item.producto || !item.unidad || !item.cantidad) {
      return { success: false, error: 'Datos incompletos' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_RECETA);
    const id = 'R' + Date.now();
    h.appendRow([id, item.producto, item.unidad, Number(item.cantidad), new Date(), body.usuario || '']);
    return { success: true, item: { id, producto: item.producto, unidad: item.unidad, cantidad: Number(item.cantidad) } };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invEliminarReceta(body) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_RECETA);
    const datos = h.getDataRange().getValues();
    for (let r = datos.length - 1; r >= 1; r--) {
      if (datos[r][0] === body.id) { h.deleteRow(r + 1); break; }
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  RESPONSABLES
// ═══════════════════════════════════════════════════════════════════
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
      return { success: false, error: 'Nombre vacío' };
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
    const datos = h.getDataRange().getValues();
    for (let r = datos.length - 1; r >= 1; r--) {
      if (datos[r][0] === body.id) { h.deleteRow(r + 1); break; }
    }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  META
// ═══════════════════════════════════════════════════════════════════
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const h = ss.getSheetByName(INV_SH_META);
    const datos = h.getDataRange().getValues();
    let rowTotal = -1, rowDesc = -1;
    for (let r = 1; r < datos.length; r++) {
      if (datos[r][0] === 'total') rowTotal = r + 1;
      if (datos[r][0] === 'descripcion') rowDesc = r + 1;
    }
    if (rowTotal === -1) { h.appendRow(['total', body.meta.total, new Date()]); }
    else { h.getRange(rowTotal, 2).setValue(body.meta.total); h.getRange(rowTotal, 3).setValue(new Date()); }
    if (rowDesc === -1) { h.appendRow(['descripcion', body.meta.descripcion, new Date()]); }
    else { h.getRange(rowDesc, 2).setValue(body.meta.descripcion); h.getRange(rowDesc, 3).setValue(new Date()); }
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  INGRESOS
// ═══════════════════════════════════════════════════════════════════
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
      i.observaciones || '', i.usuario || ''
    ]);
    return { success: true, id };
  } catch (e) { return { success: false, error: e.message }; }
}
 
function invLeerIngresos() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const h = ss.getSheetByName(INV_SH_INGRESOS);
  if (!h || h.getLastRow() < 2) return [];
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 12).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], producto: r[2], cantidad: Number(r[3]) || 0,
    unidad: r[4], fechaIngreso: r[5], fechaVenc: r[6], lote: r[7],
    responsable: r[8], proveedor: r[9], observaciones: r[10], usuario: r[11]
  }));
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  ARMADOS
// ═══════════════════════════════════════════════════════════════════
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
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 7).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], cantidad: Number(r[3]) || 0,
    responsable: r[4], observaciones: r[5], usuario: r[6]
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  ENTREGAS
// ═══════════════════════════════════════════════════════════════════
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
  const datos = h.getRange(2, 1, h.getLastRow() - 1, 10).getValues();
  return datos.filter(r => r[0]).map(r => ({
    id: r[0], fechaRegistro: r[1], fecha: r[2], empresa: r[3], sector: r[4],
    cantidad: Number(r[5]) || 0, responsable: r[6], documento: r[7],
    observaciones: r[8], usuario: r[9]
  })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
 
 
// ═══════════════════════════════════════════════════════════════════
//  CÁLCULO DE STOCK (clave del sistema)
// ═══════════════════════════════════════════════════════════════════
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
 
    // Fecha de vencimiento más próxima
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
 
 
// ═══════════════════════════════════════════════════════════════════
//  REPORTES (devuelven datos para que el frontend genere PDF)
// ═══════════════════════════════════════════════════════════════════
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
 
 
// ═══════════════════════════════════════════════════════════════════
//  DEBUG
// ═══════════════════════════════════════════════════════════════════
function invDebug() {
  const r = invGetAll();
  Logger.log(JSON.stringify(r, null, 2));
}
 /**
 * ═══════════════════════════════════════════════════════════════════
 *  MÓDULO INVENTARIO V2 — Catálogo productos + Editar/Eliminar
 * ═══════════════════════════════════════════════════════════════════
 */
 
const INV_SH_PRODUCTOS = 'INV_Productos';
 
const INV_PRODUCTOS_INICIALES = [
  'Arroz',
  'Menestra',
  'Azúcar',
  'Gaseosa',
  'Galleta',
  'Chocolate',
  'Panetón',
  'Fideo',
  'Fideo canuto',
  'Avena',
  'Leche',
  'Aceite',
  'Galleta vainilla'
];
 
 
// SETUP CATÁLOGO — Ejecutar UNA VEZ desde el editor
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
    Logger.log('✓ ' + INV_SH_PRODUCTOS + ' creado con ' + INV_PRODUCTOS_INICIALES.length + ' productos');
  } else {
    Logger.log('• ' + INV_SH_PRODUCTOS + ' ya existe');
  }
  Logger.log('═══ Catálogo de productos completado ═══');
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
    if (!nombre) return { success: false, error: 'Nombre vacío' };
 
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
      return { success: false, error: 'No puedes eliminar: ya hay ' + totalEntregadas + ' canastas entregadas y solo quedarían ' + (totalArmadas - cantElim) };
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
// ═══════════════════════════════════════════════════════════════════
//  FIREBASE TIEMPO REAL — Actualización rápida al guardar atención
//  Se llama desde saveAtencion para actualizar SOLO contadores
//  necesarios. Rápido (~1-2 segundos) y no bloquea el guardado.
//  El trigger cada 5 min recalcula todo como respaldo.
// ═══════════════════════════════════════════════════════════════════
 
function actualizarFirebaseRapido(d) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('⚠️ FIREBASE_DB_SECRET no configurado');
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
 
    // ── 1. Leer resumen_global actual y actualizar ──
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
 
    UrlFetchApp.fetch(urlGlobal, {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify(global),
      muteHttpExceptions: true
    });
 
    // ── 2. Actualizar contadores del supervisor específico ──
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
 
    // ── 3. Actualizar por empresa ──
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
 
    Logger.log('✓ Firebase rápido actualizado OK');
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
// ═══════════════════════════════════════════
// ACTUALIZAR FIREBASE MÓDULOS (tiempo real)
// ═══════════════════════════════════════════
function normalizarFechaStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'GMT-5', 'yyyy-MM-dd');
  return String(val).substring(0, 10).replace(/T.*/, '');
}

function actualizarFirebaseModulos() {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
    if (!secret) {
      Logger.log('⚠️ FIREBASE_DB_SECRET no configurado');
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
    Logger.log('✓ Firebase módulos OK');
  } catch(e) {
    Logger.log('actualizarFirebaseModulos error: ' + e.toString());
  }
}

// ============================================================
// FASE A: ATENCIONES VIA AZURE SQL (con fallback a Sheets)
// ============================================================
function _azureBaseUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty('AZURE_API_URL');
  if (!url) throw new Error('AZURE_API_URL no configurada en Script Properties');
  return url.replace(/\/+$/, '');
}

function _azureAuthHeaders_() {
  var key = PropertiesService.getScriptProperties().getProperty('AZURE_API_KEY');
  if (!key) throw new Error('AZURE_API_KEY no configurada en Script Properties');
  return { 'x-functions-key': key };
}

function listAtencionesAzure(filtros) {
  filtros = filtros || {};
  var qs = [];
  ['supervisor','empresa','desde','hasta','dni','estado','limite','pagina'].forEach(function(k){
    var v = filtros[k];
    if (v !== undefined && v !== null && v !== '') {
      qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    }
  });
  var url = _azureBaseUrl_() + '/atenciones' + (qs.length ? '?' + qs.join('&') : '');
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: _azureAuthHeaders_(),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('Azure HTTP ' + code + ': ' + resp.getContentText().substring(0, 300));
  }
  return JSON.parse(resp.getContentText());
}

function consultarAtencionesOptimizado(filtros) {
  filtros = filtros || {};
  try {
    var t0 = Date.now();
    var result = listAtencionesAzure(filtros);
    var elapsed = Date.now() - t0;
    if (result && result.success) {
      console.log('[consultarAtencionesOptimizado] Azure OK ' + (result.total || 0) + ' regs en ' + elapsed + 'ms');
      return {
        success: true,
        data: result.data || [],
        total: result.total,
        pagina: result.pagina,
        limite: result.limite,
        fuente: 'AZURE',
        tiempo: elapsed
      };
    }
  } catch(e) {
    console.log('[consultarAtencionesOptimizado] Azure error: ' + e.toString());
  }
  return { success: false, error: 'Azure no disponible', fuente: 'NONE' };
}

// Wrapper compatible con getAtenciones(p): mismo shape de salida.
// Mapea filtros del frontend al schema de Azure y, si Azure falla, hace fallback a getAtenciones.
function getAtencionesOptimizado(p) {
  p = p || {};
  var azFiltros = { limite: 50000, pagina: 1 };
  var rol = String(p.rol || '').toLowerCase();
  if (rol === 'supervisor') {
    azFiltros.supervisor = String(p.nombre || p.usuario || '').trim();
  }
  if (p.empresa && p.empresa !== 'AMBAS') {
    azFiltros.empresa = p.empresa;
  }
  // Sin historial: replica getRowsCurrentYear restringiendo al año en curso
  if (!p.historial) {
    var anio = new Date().getFullYear();
    azFiltros.desde = anio + '-01-01';
    azFiltros.hasta = anio + '-12-31';
  }

  var r = consultarAtencionesOptimizado(azFiltros);
  if (r.success) {
    var lista = r.data || [];
    // Filtros adicionales por compat futura (mes/anio/estado/q): hoy ningún callsite los pasa.
    if (p.mes)    lista = lista.filter(function(a){ return String(a.mes) === String(p.mes); });
    if (p.anio)   lista = lista.filter(function(a){ return String(a.anio) === String(p.anio); });
    if (p.estado) lista = lista.filter(function(a){ return String(a.estado||'').toUpperCase() === String(p.estado).toUpperCase(); });
    if (p.q) {
      var q = String(p.q).toLowerCase();
      lista = lista.filter(function(a){ return String(a.dni||'').indexOf(q) >= 0 || String(a.nombre||'').toLowerCase().indexOf(q) >= 0; });
    }
    console.log('[getAtencionesOptimizado] Azure ' + r.tiempo + 'ms, total=' + (r.total||lista.length) + ', filtrado=' + lista.length);
    return { success: true, data: lista, fuente: 'AZURE', tiempo: r.tiempo };
  }
  console.log('[getAtencionesOptimizado] Fallback → Sheets (getAtenciones)');
  var fb = getAtenciones(p);
  if (fb && fb.success) fb.fuente = 'SHEETS';
  return fb;
}
