// ============================================================
// SISTEMA RL v3.0 - VERFRUT & RAPEL
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
      case 'subirArchivoAzure':    result = subirArchivoAzure(body);    break;
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
      case 'saveSolicitudAcceso':    result = saveSolicitudAcceso(body);    break;
      case 'getSolicitudesAcceso':   result = getSolicitudesAcceso(params); break;
      case 'resolverAccesoTemporal': result = resolverAccesoTemporal(body); break;
      case 'verificarAccesoTemporal':result = verificarAccesoTemporal(body);break;
      case 'guardarCapacitacion':    result = capGuardar(body);             break;
      case 'listarCapacitaciones':   result = capListar(params);            break;
      case 'exportarCapacitaciones': result = capExportar(params);          break;
      case 'invGetAll':              result = invGetAll();                   break;
      case 'invGuardarMeta':         result = invGuardarMeta(body);         break;
      case 'invAgregarReceta':       result = invAgregarReceta(body);       break;
      case 'invEliminarReceta':      result = invEliminarReceta(body);      break;
      case 'invAgregarResponsable':  result = invAgregarResponsable(body);  break;
      case 'invRegistrarIngreso':    result = invRegistrarIngreso(body);    break;
      case 'invRegistrarArmado':     result = invRegistrarArmado(body);     break;
      case 'invRegistrarEntrega':    result = invRegistrarEntrega(body);    break;
      case 'invDatosReporte':        result = invDatosReporte(body);        break;
      case 'invGuardarReporteDrive': result = invGuardarReporteDrive(body); break;
      case 'invListarProductos':    result = invListarProductos();         break;
      case 'invAgregarProducto':    result = invAgregarProducto(body);     break;
      case 'invEditarProducto':     result = invEditarProducto(body);      break;
      case 'invEliminarProducto':   result = invEliminarProducto(body);    break;
      case 'invEditarIngreso':      result = invEditarIngreso(body);       break;
      case 'invEliminarIngreso':    result = invEliminarIngreso(body);     break;
      case 'invEditarArmado':       result = invEditarArmado(body);        break;
      case 'invEliminarArmado':     result = invEliminarArmado(body);      break;
      case 'invEditarEntrega':      result = invEditarEntrega(body);       break;
      case 'invEliminarEntrega':    result = invEliminarEntrega(body);     break;
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
  // ── Caché de la hoja Usuarios (5 min) para logins concurrentes rápidos ──
  const scriptCache = CacheService.getScriptCache();
  const USUARIOS_KEY = 'login_usuarios_rows';
  let rows = null;
  try {
    const cached = scriptCache.get(USUARIOS_KEY);
    if (cached) rows = JSON.parse(cached);
  } catch(e) {}

  if (!rows) {
    const sheet   = getSheet('Usuarios');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 1) {
      // Leer primeras 50 filas (usuarios frecuentes suelen estar al inicio)
      const top  = Math.min(50, lastRow);
      rows = sheet.getRange(1, 1, top, lastCol).getValues();
      // Si hay más de 50, leer el resto y concatenar
      if (lastRow > 50) {
        const resto = sheet.getRange(51, 1, lastRow - 50, lastCol).getValues();
        rows = rows.concat(resto);
      }
    } else {
      rows = [];
    }
    try { scriptCache.put(USUARIOS_KEY, JSON.stringify(rows), 300); } catch(e) {}
  }

  const uBuscado = String(d.usuario).trim();
  const pBuscado = String(d.password).trim();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const usuario  = String(r[1]).trim();
    const password = String(r[2]).trim();
    const activo   = String(r[6]).trim().toUpperCase();
    if (usuario === uBuscado && password === pBuscado) {
      if (activo !== 'TRUE') return { success: false, error: 'Usuario inactivo. Contacta al administrador.' };
      const fundos = FUNDOS_SUPERVISOR[usuario] || [];
      const necesitaElegirFundo = SUP_MULTI.includes(usuario);
      return {
        success: true,
        user: {
          id:                String(r[0]).trim(),
          usuario:           usuario,
          nombre:            String(r[3]).trim(),
          rol:               String(r[4]).trim().toLowerCase(),
          empresa:           String(r[5]).trim().toUpperCase(),
          correo:            String(r[8] || '').trim(),
          fundos:            fundos,
          necesitaElegirFundo: necesitaElegirFundo
        }
      };
    }
  }
  return { success: false, error: 'Usuario o contrasena incorrectos.' };
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

// ── Helper: obtener hoja por año ──
// Retorna la hoja según el año. Si no existe la del año, usa 'BB. DE REGISTROS' como respaldo.
function getSheetAnio(anio) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const anioTarget = anio ? parseInt(anio) : anioActual;
  const sheet = ss.getSheetByName('BB. DE REGISTROS ' + anioTarget);
  if (sheet) return sheet;
  return ss.getSheetByName('BB. DE REGISTROS');
}

// ── Helper: obtener todas las hojas de años disponibles ──
function getSheetsAnios() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = [];
  ss.getSheets().forEach(ws => {
    const n = ws.getName();
    if (/^BB\. DE REGISTROS \d{4}$/.test(n)) sheets.push(ws);
  });
  // También incluir la hoja base si no hay anuales
  if (!sheets.length) {
    const base = ss.getSheetByName('BB. DE REGISTROS');
    if (base) sheets.push(base);
  }
  return sheets;
}

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
  let rows = [];
  if (p.historial === 'todos') {
    // Combinar todas las hojas de años
    const sheets = getSheetsAnios();
    sheets.forEach(ws => {
      const wsRows = ws.getDataRange().getValues().slice(1);
      rows = rows.concat(wsRows);
    });
    // También leer hoja base si tiene registros no cubiertos
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const base = ss.getSheetByName('BB. DE REGISTROS');
    if (base) {
      const baseRows = base.getDataRange().getValues().slice(1);
      rows = rows.concat(baseRows);
    }
    // Deduplicar por nro
    const vistos = new Set();
    rows = rows.filter(r => {
      const k = String(r[0]);
      if (!k || vistos.has(k)) return false;
      vistos.add(k); return true;
    });
  } else if (p.anio) {
    // Hoja del año específico
    const sheet = getSheetAnio(p.anio);
    if (!sheet) return { success: true, data: [] };
    rows = sheet.getDataRange().getValues().slice(1);
  } else {
    const _rolAt = p.rol || '';
    if (_rolAt === 'supervisor') {
      // Supervisores: solo año actual
      const sheet = getSheetAnio(null);
      if (!sheet) return { success: true, data: [] };
      rows = p.historial
        ? sheet.getDataRange().getValues().slice(1)
        : getRowsCurrentYear(sheet, 1000, 1);
    } else {
      // Administradores: combinar 2024, 2025 y 2026
      const _ssAt = SpreadsheetApp.openById(SPREADSHEET_ID);
      const _anioAt = new Date().getFullYear();
      [_anioAt, _anioAt - 1, _anioAt - 2].forEach(function(a) {
        const ws = _ssAt.getSheetByName('BB. DE REGISTROS ' + a);
        if (ws) rows = rows.concat(ws.getDataRange().getValues().slice(1));
      });
      const _baseAt = _ssAt.getSheetByName('BB. DE REGISTROS');
      if (_baseAt) rows = rows.concat(_baseAt.getDataRange().getValues().slice(1));
      const _vistosAt = new Set();
      rows = rows.filter(function(r) { const k = String(r[0]); if (!k || _vistosAt.has(k)) return false; _vistosAt.add(k); return true; });
    }
  }
  if (!rows.length) return { success: true, data: [] };

  let lista = rows
    .filter(r => r[0] || r[7])
    .map((r, i) => {
      let o = {}; COLS.forEach((h, j) => o[h] = r[j]);
      // Normalizar fecha
      if (o.fecha_atencion instanceof Date) o.fecha_atencion = fmt(o.fecha_atencion,'yyyy-MM-dd');
      o._fila = i + 2;
      return o;
    });

  const rol = p.rol || '';
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
    d.estado || 'PENDIENTE',
    new Date(),
    d.usuario_sistema || ''
  ]);
  // Actualización incremental de Firebase (GET+PATCH, ~500ms, no lee hojas)
  try { actualizarFirebaseRapido(d); } catch(e) { console.warn('[Firebase] incremento falló:', e.message); }
  return { success: true, nro: nro, hoja: nombreHoja };
}
// ============================================================
// ATENCIONES - UPDATE
// ============================================================
function updateAtencion(d) {
  // Buscar en la hoja del año actual primero, luego en hojas de otros años, y finalmente en la base
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const candidatos = [];
  // Hoja año actual
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
        // Verificar permiso: comparar usuario_sistema (col 28, índice 27) con el username enviado
        if (d.rol === 'supervisor' && String(rows[i][27]).trim() !== String(d.usuario).trim()) {
          return { success: false, error: 'No tienes permiso para editar este registro.' };
        }
        const r = i + 1;
        if (d.fecha_atencion    !== undefined) sheet.getRange(r,  2).setValue(d.fecha_atencion);
        if (d.hora_inicio       !== undefined) sheet.getRange(r,  3).setValue(d.hora_inicio);
        if (d.hora_termino      !== undefined) sheet.getRange(r,  4).setValue(d.hora_termino);
        if (d.sexo              !== undefined) sheet.getRange(r, 10).setValue(d.sexo);
        if (d.fecha_inicio_periodo !== undefined) sheet.getRange(r, 11).setValue(d.fecha_inicio_periodo);
        if (d.empresa           !== undefined) sheet.getRange(r, 12).setValue(d.empresa);
        if (d.fundo             !== undefined) sheet.getRange(r, 13).setValue(d.fundo);
        if (d.cargo             !== undefined) sheet.getRange(r, 14).setValue(d.cargo);
        if (d.ruta              !== undefined) sheet.getRange(r, 15).setValue(d.ruta);
        if (d.fundo_actual      !== undefined) sheet.getRange(r, 17).setValue(d.fundo_actual);
        if (d.celular           !== undefined) sheet.getRange(r, 18).setValue(d.celular);
        if (d.detalle_documento !== undefined) sheet.getRange(r, 20).setValue(d.detalle_documento);
        if (d.fecha_inicio_doc  !== undefined) sheet.getRange(r, 21).setValue(d.fecha_inicio_doc);
        if (d.fecha_termino_doc !== undefined) sheet.getRange(r, 22).setValue(d.fecha_termino_doc);
        if (d.dias_transcurridos!== undefined) sheet.getRange(r, 23).setValue(d.dias_transcurridos);
        if (d.responsable_recepcion !== undefined) sheet.getRange(r, 24).setValue(d.responsable_recepcion);
        if (d.observaciones     !== undefined) sheet.getRange(r, 25).setValue(d.observaciones);
        if (d.estado            !== undefined) sheet.getRange(r, 26).setValue(d.estado);
        try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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
  // Buscar en la hoja del año actual primero, luego en hojas de otros años, y finalmente en la base
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const candidatos = [];
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
        if (d.rol === 'supervisor' && String(rows[i][18]).trim() !== String(d.usuario).trim()) {
          return { success: false, error: 'No tienes permiso para eliminar este registro.' };
        }
        sheet.deleteRow(i + 1);
        try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual = new Date().getFullYear();
  const esAdmin = (p.rol === 'administrador' || p.rol === 'administrador 01' || p.rol === 'administrador 02');

  // Determinar qué hojas leer
  let hojas = [];
  if (p.anio === 'todos' && esAdmin) {
    // Buscar en todas las hojas de años
    hojas = getSheetsAnios();
    const base = ss.getSheetByName('BB. DE REGISTROS');
    if (base) hojas.push(base);
  } else if (p.anio) {
    const ws = getSheetAnio(p.anio);
    if (ws) hojas.push(ws);
  } else {
    // Por defecto: año actual + hoja base (combinar resultados)
    const wsAnio = ss.getSheetByName('BB. DE REGISTROS ' + anioActual);
    if (wsAnio) hojas.push(wsAnio);
    const wsBase = ss.getSheetByName('BB. DE REGISTROS');
    if (wsBase) hojas.push(wsBase);
  }

  let lista = [], trabajador = null;
  const vistos = new Set();

  hojas.forEach(sheet => {
    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) return;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][7]).trim() === dni) {
        const k = String(rows[i][0]);
        if (k && vistos.has(k)) continue;
        if (k) vistos.add(k);
        let o = {};
        COLS.forEach((h, j) => o[h] = rows[i][j]);
        lista.push(o);
        if (!trabajador) trabajador = { dni: rows[i][7], nombre: rows[i][8], empresa: rows[i][11], cargo: rows[i][13], fundo: rows[i][12] };
      }
    }
  });

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
function buscarTrabajador(p) {
  const q   = (p.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return { success: true, data: [] };
  // Normalizar empresa: acepta 'RAPEL S.A.C', 'VERFRUT S.A.C', 'RAPEL', 'VERFRUT', 'AMBAS' o vacío
  const empUp   = (p.empresa || '').toUpperCase();
  const empNorm = (empUp.indexOf('RAPEL') !== -1 && empUp.indexOf('VERFRUT') === -1) ? 'RAPEL'
                : (empUp.indexOf('VERFRUT') !== -1) ? 'VERFRUT'
                : 'AMBAS';
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
  const ss2 = SpreadsheetApp.openById(SPREADSHEET_ID);
  const anioActual2 = new Date().getFullYear();
  const _rolEst = p.rol || '';
  const _esAdminEst = (_rolEst !== 'supervisor');
  let rows;
  if (_esAdminEst) {
    // Administradores: combinar 2024, 2025 y 2026 deduplicando por nro
    let _rawEst = [];
    [anioActual2, anioActual2 - 1, anioActual2 - 2].forEach(function(a) {
      const ws = ss2.getSheetByName('BB. DE REGISTROS ' + a);
      if (ws) _rawEst = _rawEst.concat(ws.getDataRange().getValues().slice(1));
    });
    const _baseEst = ss2.getSheetByName('BB. DE REGISTROS');
    if (_baseEst) _rawEst = _rawEst.concat(_baseEst.getDataRange().getValues().slice(1));
    const _vistosEst = new Set();
    _rawEst = _rawEst.filter(function(r) { const k = String(r[0]); if (!k || _vistosEst.has(k)) return false; _vistosEst.add(k); return true; });
    rows = [['hdr'], ..._rawEst];
  } else {
    // Supervisores: solo año actual
    const sheetNueva = ss2.getSheetByName('BB. DE REGISTROS ' + anioActual2);
    const sheetBase  = ss2.getSheetByName('BB. DE REGISTROS');
    const sheet = sheetNueva || sheetBase;
    if (!sheet) return { success:true, data:{hoy:0,mes:0,anio:0,total:0,pendientes:0,porMes:{},porTipo:{},porEstado:{}} };
    rows = [['hdr'], ...getRowsCurrentYear(sheet, 2000, 1)];
  }
  if (rows.length < 2) return { success:true, data:{hoy:0,mes:0,anio:0,total:0,pendientes:0,porMes:{},porTipo:{},porEstado:{}} };
  
  const mesN  = new Date().getMonth() + 1;
  const aniN  = new Date().getFullYear();
  const hoyStr = fmt(new Date(), 'yyyy-MM-dd');

  let lista = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] && !rows[i][7]) continue;
    let o = {};
    COLS.forEach((h, j) => o[h] = rows[i][j]);
    // Normalizar fecha_atencion a string yyyy-MM-dd
    if (o.fecha_atencion instanceof Date) {
      o.fecha_atencion = fmt(o.fecha_atencion, 'yyyy-MM-dd');
    } else {
      o.fecha_atencion = String(o.fecha_atencion || '').substring(0, 10);
    }
    // Normalizar mes y anio (pueden venir como número o string)
    o.mes  = parseInt(o.mes)  || 0;
    o.anio = parseInt(o.anio) || 0;
    // Si mes/anio son 0, calcularlos de la fecha
    if (!o.mes && o.fecha_atencion.length >= 7) {
      const parts = o.fecha_atencion.split('-');
      o.anio = parseInt(parts[0]) || 0;
      o.mes  = parseInt(parts[1]) || 0;
    }
    lista.push(o);
  }

  const rol = p.rol || '';
if (rol === 'supervisor') {
  const buscar = String(p.usuario||'').trim().toLowerCase();
  const nombre = String(p.nombre||'').trim().toLowerCase();
  lista = lista.filter(a => {
    const sup = String(a.supervisor||'').trim().toLowerCase();
    return sup === buscar || sup === nombre;
  });
}
  if (p.empresa && p.empresa !== 'AMBAS' && p.empresa !== '') {
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

  const porEstado = { PENDIENTE: 0, 'EN PROCESO': 0, RESUELTO: 0 };
  lista.forEach(a => { const e = String(a.estado || 'PENDIENTE').toUpperCase(); if (porEstado.hasOwnProperty(e)) porEstado[e]++; });

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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let rawRows = [];

  if (p.anio === 'todos') {
    // Combinar todas las hojas de años
    const sheets = getSheetsAnios();
    sheets.forEach(ws => { rawRows = rawRows.concat(ws.getDataRange().getValues().slice(1)); });
    const base = ss.getSheetByName('BB. DE REGISTROS');
    if (base) rawRows = rawRows.concat(base.getDataRange().getValues().slice(1));
    // Deduplicar
    const vistos = new Set();
    rawRows = rawRows.filter(r => {
      const k = String(r[0]);
      if (!k || vistos.has(k)) return false;
      vistos.add(k); return true;
    });
  } else if (p.anio) {
    const sheet = getSheetAnio(p.anio);
    if (!sheet) return { success:true, data:{lista:[],porSupervisor:{}} };
    rawRows = sheet.getDataRange().getValues().slice(1);
  } else {
    // Por defecto: combinar 2024, 2025 y 2026
    const anioActual2 = new Date().getFullYear();
    [anioActual2, anioActual2 - 1, anioActual2 - 2].forEach(function(a) {
      const ws = ss.getSheetByName('BB. DE REGISTROS ' + a);
      if (ws) rawRows = rawRows.concat(ws.getDataRange().getValues().slice(1));
    });
    const wsBase2 = ss.getSheetByName('BB. DE REGISTROS');
    if (wsBase2) rawRows = rawRows.concat(wsBase2.getDataRange().getValues().slice(1));
    // Deduplicar por nro de registro
    const vistosDef = new Set();
    rawRows = rawRows.filter(function(r) {
      const k = String(r[0]);
      if (!k || vistosDef.has(k)) return false;
      vistosDef.add(k); return true;
    });
  }

  if (!rawRows.length) return { success:true, data:{lista:[],porSupervisor:{}} };
  let lista = [];
  rawRows.forEach(r => {
    if (!r[0] && !r[7]) return;
    let o = {};
    COLS.forEach((h, j) => o[h] = r[j]);
    lista.push(o);
  });
  if (p.empresa && p.empresa !== 'AMBAS') lista = lista.filter(a => String(a.empresa).toUpperCase() === p.empresa);
  if (p.mes)  lista = lista.filter(a => String(a.mes)  === p.mes);
  if (p.anio && p.anio !== 'todos') lista = lista.filter(a => String(a.anio) === p.anio);

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
  const anioActual = new Date().getFullYear();

  // Leer PRIMERO 2026, luego 2025 y 2024 como respaldo — NO la hoja base sin año
  let lista = [];
  const anios = [anioActual, anioActual - 1, anioActual - 2]; // ej: 2026, 2025, 2024
  const hojasInfo = [];

  anios.forEach(function(anio) {
    const nombreHoja = 'BB. DE REGISTROS ' + anio;
    const ws = ss.getSheetByName(nombreHoja);
    if (!ws) {
      console.log('[getReporteCorreo] Hoja no existe: ' + nombreHoja);
      return;
    }
    const rows = ws.getDataRange().getValues();
    if (rows.length < 2) {
      console.log('[getReporteCorreo] Hoja sin datos: ' + nombreHoja);
      return;
    }
    let countHoja = 0;
    for (let i = 1; i < rows.length; i++) {
      // Saltar fila si nro (col A, índice 0) Y fecha_atencion (col B, índice 1) están vacíos
      if (!rows[i][0] && !rows[i][1]) continue;
      let o = {};
      COLS.forEach(function(h, j) { o[h] = rows[i][j]; });
      // Normalizar fecha_atencion a yyyy-MM-dd para comparar con fi/ff
      let f = '';
      if (o.fecha_atencion instanceof Date) {
        f = Utilities.formatDate(o.fecha_atencion, 'GMT-5', 'yyyy-MM-dd');
      } else {
        f = String(o.fecha_atencion || '').replace(/T.*/,'').substring(0, 10);
      }
      if (f >= fi && f <= ff) {
        lista.push(o);
        countHoja++;
      }
    }
    console.log('[getReporteCorreo] ' + nombreHoja + ': ' + countHoja + ' registros en rango [' + fi + ' – ' + ff + ']');
    hojasInfo.push({ hoja: nombreHoja, encontrados: countHoja });
  });

  // Deduplicar por nro (columna A, índice 0)
  const vistos = new Set();
  lista = lista.filter(function(o) {
    const k = String(o.nro || '');
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  console.log('[getReporteCorreo] Total tras deduplicar: ' + lista.length);

  // Filtrar por supervisor: columna S (índice 18) o usuario_sistema (columna AB, índice 27)
  if (p.rol === 'supervisor') {
    const usr = String(p.usuario || '').toLowerCase().trim(); // username de login
    const nom = String(p.nombre  || '').toLowerCase().trim(); // nombre completo
    lista = lista.filter(function(a) {
      const sup  = String(a.supervisor      || '').toLowerCase().trim();
      const uSis = String(a.usuario_sistema || '').toLowerCase().trim();
      return sup.includes(usr) || sup.includes(nom) ||
             usr.includes(sup) || nom.includes(sup) ||
             uSis === usr || uSis === nom;
    });
    console.log('[getReporteCorreo] Tras filtro supervisor (usr=' + usr + '): ' + lista.length);
  }

  if (p.empresa && p.empresa !== 'AMBAS') {
    lista = lista.filter(function(a) { return String(a.empresa || '').toUpperCase() === p.empresa; });
    console.log('[getReporteCorreo] Tras filtro empresa (' + p.empresa + '): ' + lista.length);
  }

  const resumenMap = {};
  lista.forEach(function(a) {
    const key = (a.empresa||'')+'||'+(a.detalle_documento||'')+'||'+(a.responsable_recepcion||'');
    if (!resumenMap[key]) resumenMap[key] = { empresa:a.empresa||'', tipo:a.detalle_documento||'', responsable:a.responsable_recepcion||'', cantidad:0 };
    resumenMap[key].cantidad++;
  });
  const resumen = Object.values(resumenMap).sort(function(a,b){ return b.cantidad - a.cantidad; });
  lista.sort(function(a,b){ return String(a.fecha_atencion).localeCompare(String(b.fecha_atencion)); });

  console.log('[getReporteCorreo] Respuesta final — total: ' + lista.length + ' | hojas consultadas: ' + JSON.stringify(hojasInfo));
  return { success:true, data:lista, resumen:resumen, total:lista.length, hojasInfo:hojasInfo };
}

// ============================================================
// FIREBASE ESTADÍSTICAS — actualización en tiempo real
// CONFIGURACIÓN REQUERIDA:
//   Apps Script > Configuración > Propiedades del script:
//     FIREBASE_DB_SECRET = <Database Secret de Firebase RTDB>
//   Firebase RTDB Rules /estadisticas:
//     { ".read": true, ".write": "auth != null" }
// ============================================================
const FIREBASE_DB_URL = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';

function _fbPatchEstadisticas(stats) {
  const secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
  if (!secret) {
    console.warn('[Firebase] FIREBASE_DB_SECRET no configurado. Ve a Apps Script > ' +
      'Configuración > Propiedades del script y agrega FIREBASE_DB_SECRET con tu Database Secret.');
    return;
  }
  try {
    const url = FIREBASE_DB_URL + '/estadisticas.json?auth=' + secret;
    const resp = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(stats),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    if (code !== 200) {
      console.warn('[Firebase] PATCH /estadisticas falló HTTP ' + code + ': ' + resp.getContentText().substring(0, 200));
    } else {
      console.log('[Firebase] /estadisticas actualizado OK — total: ' + (stats.resumen_global && stats.resumen_global.total));
    }
  } catch(e) {
    console.error('[Firebase] Error en _fbPatchEstadisticas:', e.message);
  }
}

// Actualización incremental rápida de Firebase (GET + PATCH, sin leer hojas)
// Llamada desde saveAtencion después de guardar la fila.
function actualizarFirebaseRapido(d) {
  var secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
  if (!secret) { console.warn('[actualizarFirebaseRapido] FIREBASE_DB_SECRET no configurado'); return; }

  var now        = new Date();
  var hoyStr     = Utilities.formatDate(now, 'GMT-5', 'yyyy-MM-dd');
  var mesActual  = now.getMonth() + 1;
  var anioActual = now.getFullYear();
  var fechaAt    = String(d.fecha_atencion || hoyStr).substring(0, 10);
  var anioAt     = parseInt(fechaAt.substring(0, 4)) || anioActual;
  var mesAt      = parseInt(fechaAt.substring(5, 7)) || mesActual;
  var estado     = String(d.estado || '').toUpperCase();
  var emp        = String(d.empresa || '').toUpperCase();
  // Clave del supervisor: usuario_sistema o supervisor, sin caracteres especiales
  var supKey     = String(d.usuario_sistema || d.supervisor || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || '';
  var supNombre  = String(d.supervisor || d.usuario_sistema || supKey);
  var mesKey     = anioAt + '_' + String(mesAt).padStart(2, '0');

  var baseUrl = FIREBASE_DB_URL + '/estadisticas.json?auth=' + secret;
  try {
    // 1. Leer estadísticas actuales de Firebase
    var getResp = UrlFetchApp.fetch(baseUrl, { method: 'GET', muteHttpExceptions: true });
    var fb = {};
    try { fb = JSON.parse(getResp.getContentText() || '{}') || {}; } catch(pe) { fb = {}; }

    // 2. Incrementar resumen_global
    var rg = fb.resumen_global || { total:0, hoy:0, este_mes:0, en_proceso:0, finalizados:0 };
    rg.total = (rg.total || 0) + 1;
    if (fechaAt === hoyStr)                             rg.hoy       = (rg.hoy       || 0) + 1;
    if (mesAt === mesActual && anioAt === anioActual)   rg.este_mes  = (rg.este_mes  || 0) + 1;
    if (estado === 'EN PROCESO')  rg.en_proceso  = (rg.en_proceso  || 0) + 1;
    if (estado === 'FINALIZADO')  rg.finalizados = (rg.finalizados || 0) + 1;
    rg.ultima_actualizacion = now.getTime();

    // 3. Incrementar por_supervisor
    var ps = fb.por_supervisor || {};
    if (supKey) {
      var ps_sup = ps[supKey] || { nombre: supNombre, total:0, este_mes:0, en_proceso:0, finalizados:0 };
      ps_sup.nombre = supNombre;
      ps_sup.total  = (ps_sup.total || 0) + 1;
      if (mesAt === mesActual && anioAt === anioActual) ps_sup.este_mes  = (ps_sup.este_mes  || 0) + 1;
      if (estado === 'EN PROCESO') ps_sup.en_proceso  = (ps_sup.en_proceso  || 0) + 1;
      if (estado === 'FINALIZADO') ps_sup.finalizados = (ps_sup.finalizados || 0) + 1;
      ps[supKey] = ps_sup;
    }

    // 4. Incrementar por_mes
    var pm = fb.por_mes || {};
    var pm_mes = pm[mesKey] || { total:0, rapel:0, verfrut:0 };
    pm_mes.total = (pm_mes.total || 0) + 1;
    if (emp === 'RAPEL')   pm_mes.rapel   = (pm_mes.rapel   || 0) + 1;
    if (emp === 'VERFRUT') pm_mes.verfrut = (pm_mes.verfrut || 0) + 1;
    pm[mesKey] = pm_mes;

    // 5. Escribir todo en un solo PATCH
    var patch = { resumen_global: rg, por_supervisor: ps, por_mes: pm, ultima_actualizacion: now.getTime() };
    UrlFetchApp.fetch(baseUrl, {
      method: 'PATCH', contentType: 'application/json',
      payload: JSON.stringify(patch), muteHttpExceptions: true
    });
    console.log('[actualizarFirebaseRapido] OK — supervisor:', supKey, '| total global:', rg.total);
  } catch(e) {
    console.error('[actualizarFirebaseRapido] Error:', e.message);
  }
}

// ============================================================
// FIREBASE — MÓDULOS (visitas, casos, fusiones, capacitaciones)
// ============================================================
function normalizarFechaStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'GMT-5', 'yyyy-MM-dd');
  return String(val).substring(0, 10).replace(/T.*/,'');
}

function actualizarFirebaseModulos() {
  var secret = PropertiesService.getScriptProperties().getProperty('FIREBASE_DB_SECRET');
  if (!secret) { console.warn('[actualizarFirebaseModulos] FIREBASE_DB_SECRET no configurado'); return; }

  var ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
  var now = new Date();
  var mesActStr = Utilities.formatDate(now, 'GMT-5', 'yyyy-MM');

  // ─── VISITAS ───────────────────────────────────────────────
  // Columnas: [0]=N° [1]=FechaReg [21]=Estado
  var wsV = ss.getSheetByName('Visitas_Campo');
  var vis = { total: 0, en_plazo: 0, retrasadas: 0, este_mes: 0 };
  if (wsV && wsV.getLastRow() > 1) {
    wsV.getDataRange().getValues().slice(1).forEach(function(r) {
      if (!r[0]) return;
      vis.total++;
      var est = String(r[21] || '').toUpperCase();
      if (est === 'EN PLAZO') vis.en_plazo++;
      else if (est === 'RETRASADO') vis.retrasadas++;
      if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) vis.este_mes++;
    });
  }

  // ─── CASOS ────────────────────────────────────────────────
  // Columnas: [0]=N° [1]=FechaReg [15]=Estado
  var wsC = ss.getSheetByName('BD_Casos');
  var cas = { total: 0, en_plazo: 0, retrasados: 0, este_mes: 0 };
  if (wsC && wsC.getLastRow() > 1) {
    wsC.getDataRange().getValues().slice(1).forEach(function(r) {
      if (!r[0]) return;
      cas.total++;
      var est = String(r[15] || '').toUpperCase();
      if (est === 'EN PLAZO' || est === 'EN PROCESO') cas.en_plazo++;
      else if (est === 'RETRASADO') cas.retrasados++;
      if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) cas.este_mes++;
    });
  }

  // ─── FUSIONES ─────────────────────────────────────────────
  // Columnas: [0]=ID [1]=Fecha [12]=TotalTrab [27]=Estado
  var wsF = ss.getSheetByName('Fusiones_Buses');
  var fus = { total: 0, pendientes: 0, validados: 0, este_mes: 0, trabajadores: 0 };
  if (wsF && wsF.getLastRow() > 1) {
    wsF.getDataRange().getValues().slice(1).forEach(function(r) {
      if (!r[0]) return;
      fus.total++;
      var est = String(r[27] || '').toLowerCase();
      if (est === 'pendiente') fus.pendientes++;
      else if (est === 'validado') fus.validados++;
      if (normalizarFechaStr(r[1]).substring(0, 7) === mesActStr) fus.este_mes++;
      fus.trabajadores += parseInt(r[12]) || 0;
    });
  }

  // ─── CAPACITACIONES ───────────────────────────────────────
  // Columnas: [0]=ID [2]=Fecha [16]=TotalAsistentes
  var wsK = ss.getSheetByName('CAPACITACIONES_HDR');
  var cap = { total: 0, este_mes: 0, total_asistentes: 0 };
  if (wsK && wsK.getLastRow() > 1) {
    wsK.getDataRange().getValues().slice(1).forEach(function(r) {
      if (!r[0]) return;
      cap.total++;
      if (normalizarFechaStr(r[2]).substring(0, 7) === mesActStr) cap.este_mes++;
      cap.total_asistentes += parseInt(r[16]) || 0;
    });
  }

  // ─── PUT a Firebase ───────────────────────────────────────
  var url = FIREBASE_DB_URL + '/estadisticas_modulos.json?auth=' + secret;
  var payload = { visitas: vis, casos: cas, fusiones: fus, capacitaciones: cap, ultima_actualizacion: now.getTime() };
  try {
    UrlFetchApp.fetch(url, { method: 'PUT', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    console.log('[actualizarFirebaseModulos] OK — vis:', vis.total, '| cas:', cas.total, '| fus:', fus.total, '| cap:', cap.total);
  } catch(e) {
    console.error('[actualizarFirebaseModulos] Error:', e.message);
  }
}

function _buildListaParaFirebase(rawRows) {
  var lista = [];
  rawRows.forEach(function(row) {
    if (!row[0] && !row[1]) return;
    var o = {};
    COLS.forEach(function(h, j) { o[h] = row[j]; });
    if (o.fecha_atencion instanceof Date) {
      o.fecha_atencion = Utilities.formatDate(o.fecha_atencion, 'GMT-5', 'yyyy-MM-dd');
    } else {
      o.fecha_atencion = String(o.fecha_atencion || '').substring(0, 10).replace(/T.*/,'');
    }
    o.mes  = parseInt(o.mes)  || 0;
    o.anio = parseInt(o.anio) || 0;
    if ((!o.mes || !o.anio) && o.fecha_atencion.length >= 7) {
      var parts = o.fecha_atencion.split('-');
      o.anio = parseInt(parts[0]) || 0;
      o.mes  = parseInt(parts[1]) || 0;
    }
    lista.push(o);
  });
  return lista;
}

function _calcularStatsParaFirebase(lista) {
  var ahora      = new Date();
  var anioActual = ahora.getFullYear();
  var mesActual  = ahora.getMonth() + 1;
  var hoyStr     = Utilities.formatDate(ahora, 'GMT-5', 'yyyy-MM-dd');
  var ts         = ahora.getTime();

  var enProceso  = lista.filter(function(a){ return String(a.estado||'').toUpperCase() === 'EN PROCESO';  }).length;
  var finalizados = lista.filter(function(a){ return String(a.estado||'').toUpperCase() === 'FINALIZADO'; }).length;

  // ── resumen_global ──
  var resumen_global = {
    total:                lista.length,
    hoy:                  lista.filter(function(a){ return a.fecha_atencion === hoyStr; }).length,
    este_mes:             lista.filter(function(a){ return a.mes === mesActual && a.anio === anioActual; }).length,
    en_proceso:           enProceso,
    finalizados:          finalizados,
    ultima_actualizacion: ts
  };

  // ── por_supervisor ──
  var por_supervisor = {};
  lista.forEach(function(a) {
    var key = String(a.usuario_sistema || '').trim().toLowerCase().replace(/\s+/g,'_') ||
              String(a.supervisor      || '').trim().toLowerCase().replace(/[^a-z0-9_]/g,'_');
    if (!key) return;
    if (!por_supervisor[key]) {
      por_supervisor[key] = { nombre: a.supervisor || key, total:0, este_mes:0, en_proceso:0, finalizados:0 };
    }
    por_supervisor[key].total++;
    if (a.mes === mesActual && a.anio === anioActual) por_supervisor[key].este_mes++;
    var est = String(a.estado||'').toUpperCase();
    if (est === 'EN PROCESO')  por_supervisor[key].en_proceso++;
    if (est === 'FINALIZADO')  por_supervisor[key].finalizados++;
  });

  // ── por_mes ──
  var por_mes = {};
  lista.forEach(function(a) {
    if (!a.anio || !a.mes) return;
    var clave = a.anio + '-' + String(a.mes).padStart(2,'0');
    if (!por_mes[clave]) por_mes[clave] = { total:0, rapel:0, verfrut:0 };
    por_mes[clave].total++;
    var emp = String(a.empresa||'').toUpperCase();
    if (emp === 'RAPEL')   por_mes[clave].rapel++;
    if (emp === 'VERFRUT') por_mes[clave].verfrut++;
  });

  // ── por_empresa ──
  var por_empresa = {};
  ['RAPEL','VERFRUT'].forEach(function(emp) {
    var sub = lista.filter(function(a){ return String(a.empresa||'').toUpperCase() === emp; });
    por_empresa[emp] = {
      total:      sub.length,
      este_mes:   sub.filter(function(a){ return a.mes === mesActual && a.anio === anioActual; }).length,
      en_proceso: sub.filter(function(a){ return String(a.estado||'').toUpperCase() === 'EN PROCESO'; }).length
    };
  });

  return {
    resumen_global:       resumen_global,
    por_supervisor:       por_supervisor,
    por_mes:              por_mes,
    por_empresa:          por_empresa,
    ultima_actualizacion: ts
  };
}

// Llamado automáticamente después de cada saveAtencion()
function actualizarEstadisticasFirebase() {
  var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  var anioActual = new Date().getFullYear();
  var rawRows    = [];
  [anioActual, anioActual - 1].forEach(function(a) {
    var ws = ss.getSheetByName('BB. DE REGISTROS ' + a);
    if (ws) rawRows = rawRows.concat(ws.getDataRange().getValues().slice(1));
  });
  // Deduplicar por nro
  var vistos = new Set();
  rawRows = rawRows.filter(function(r) {
    var k = String(r[0]); if (!k || vistos.has(k)) return false; vistos.add(k); return true;
  });
  var lista = _buildListaParaFirebase(rawRows);
  var stats = _calcularStatsParaFirebase(lista);
  _fbPatchEstadisticas(stats);
  console.log('[Firebase] actualizarEstadisticasFirebase — ' + lista.length + ' registros procesados');
}

// Ejecutar manualmente desde Apps Script para sincronizar datos masivos
// Endpoint: action=recalcularEstadisticasCompletas
function recalcularEstadisticasCompletas() {
  var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  var anioActual = new Date().getFullYear();
  var rawRows    = [];
  [anioActual, anioActual - 1, anioActual - 2].forEach(function(a) {
    var ws = ss.getSheetByName('BB. DE REGISTROS ' + a);
    if (ws) {
      var data = ws.getDataRange().getValues().slice(1);
      rawRows = rawRows.concat(data);
      console.log('[recalcular] BB. DE REGISTROS ' + a + ': ' + data.length + ' filas');
    }
  });
  var base = ss.getSheetByName('BB. DE REGISTROS');
  if (base) {
    var data2 = base.getDataRange().getValues().slice(1);
    rawRows = rawRows.concat(data2);
    console.log('[recalcular] BB. DE REGISTROS (base): ' + data2.length + ' filas');
  }
  // Deduplicar por nro
  var vistos2 = new Set();
  rawRows = rawRows.filter(function(r) {
    var k = String(r[0]); if (!k || vistos2.has(k)) return false; vistos2.add(k); return true;
  });
  var lista  = _buildListaParaFirebase(rawRows);
  var stats  = _calcularStatsParaFirebase(lista);
  _fbPatchEstadisticas(stats);
  console.log('[recalcular] Completado — ' + lista.length + ' registros enviados a Firebase');
  return { success: true, total: lista.length };
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
    try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
    return { success: true, nro: nro, estado: estado };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getVisitas(p) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const ws = ss.getSheetByName('Visitas_Campo');
    if (!ws) return { success: true, data: [] };

    // Leer todas las filas (getRowsCurrentYear filtraba por año y dejaba fuera registros válidos)
    const rawRows = ws.getDataRange().getValues().slice(1);
    if (!rawRows.length) return { success: true, data: [] };
    const rows = [['header'], ...rawRows]; // compatibilidad con slice(1) abajo

    // Visitas_Campo: r[0]=N° r[1]=Fecha r[2]=Empresa r[3]=Supervisor r[4]=DNI
    // r[5]=Correo r[6]=Fundo r[7]=Punto r[8]=FechaInicio r[9]=FechaFin r[10]=Semana
    // r[11]=FechaInforme r[12]=Para r[13]=Asunto r[14]=Desarrollo r[15]=Rutas
    // r[16]=Acciones r[17]=Compromisos r[18]=Observaciones r[19]=MotivoRetraso
    // r[20]=NFotos r[21]=Estado r[22]=RegistradoPor r[23]=Temporada
    let data = rawRows.filter(r => r[0]).map(r => ({
      nro:             r[0],
      fecha_reg:       r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','yyyy-MM-dd') : String(r[1]||'').substring(0,10),
      empresa:         String(r[2]||''),
      supervisor:      String(r[3]||'').trim(),
      dni:             r[4],
      correo:          String(r[5]||''),
      fundo:           String(r[6]||''),
      sector:          String(r[6]||''),
      punto:           String(r[7]||''),
      fecha_inicio:    r[8] instanceof Date ? Utilities.formatDate(r[8],'America/Lima','yyyy-MM-dd') : String(r[8]||'').substring(0,10),
      fecha_fin:       r[9] instanceof Date ? Utilities.formatDate(r[9],'America/Lima','yyyy-MM-dd') : String(r[9]||'').substring(0,10),
      semana:          r[10],
      fecha_informe:   r[11] instanceof Date ? Utilities.formatDate(r[11],'America/Lima','yyyy-MM-dd') : String(r[11]||'').substring(0,10),
      para:            String(r[12]||''),
      asunto:          String(r[13]||''),
      desarrollo:      String(r[14]||''),
      rutas:           String(r[15]||''),
      acciones:        String(r[16]||''),
      compromisos:     String(r[17]||''),
      observaciones:   String(r[18]||''),
      motivo_retraso:  String(r[19]||''),
      n_fotos:         r[20] || 0,
      estado:          String(r[21]||''),
      registrado_por:  String(r[22]||'')
    }));

    var normStr = function(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); };
    if (p.empresa)    data = data.filter(v => v.empresa === p.empresa);
    if (p.mes)        data = data.filter(v => v.fecha_reg && new Date(v.fecha_reg).getMonth()+1 == p.mes);
    if (p.supervisor) data = data.filter(v => normStr(v.supervisor).includes(normStr(p.supervisor)));

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
// SUBIR ARCHIVO A GOOGLE DRIVE — DESACTIVADO (migrado a Azure)
// ============================================================
// var CASOS_FOLDER_ID   = '1gkdxFcHcJ7COW6r2h_0vlZ1KJEIk1PV-';
// var FUSIONES_FOLDER_ID = '';
//
// function subirArchivo(d) { ... }  // Reemplazado por registrarArchivoAzure

// ============================================================
// AZURE BLOB STORAGE — Registro de archivos subidos
// ============================================================
var AZURE_LOG_SHEET = 'Archivos_Azure';

// ============================================================
// AZURE BLOB STORAGE — Subida directa desde backend
// Props requeridas: AZURE_SAS_CASOS_RL, AZURE_SAS_VISITAS_CAMPO, AZURE_SAS_DOCUMENTOS
// ============================================================
function subirArchivoAzure(d) {
  try {
    if (!d.base64)  return { success: false, error: 'base64 requerido' };
    if (!d.nombre)  return { success: false, error: 'nombre requerido' };
    if (!d.carpeta) return { success: false, error: 'carpeta requerido' };

    var props    = PropertiesService.getScriptProperties();
    var propKey  = 'AZURE_SAS_' + String(d.carpeta).toUpperCase().replace(/-/g, '_').replace(/\./g, '_');
    var sasToken = props.getProperty(propKey) || props.getProperty('AZURE_SAS_TOKEN');
    if (!sasToken) return { success: false, error: 'SAS token no configurado. Propiedad esperada: ' + propKey };

    var storageUrl  = 'https://sistemarlverfrut.blob.core.windows.net';
    var modulo      = d.modulo || d.carpeta.split('-')[0];
    var ts          = new Date().getTime();
    var nombreUnico = modulo + '/' + ts + '_' + d.nombre;
    var blobUrl     = storageUrl + '/' + d.carpeta + '/' + nombreUnico + '?' + sasToken;

    var base64Clean = String(d.base64).replace(/^data:[^;]+;base64,/, '');
    var bytes       = Utilities.base64Decode(base64Clean);
    var mimeType    = d.mimeType || 'application/octet-stream';

    var response = UrlFetchApp.fetch(blobUrl, {
      method:           'put',
      contentType:      mimeType,
      payload:          bytes,
      headers:          { 'x-ms-blob-type': 'BlockBlob' },
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code !== 201) {
      return { success: false, error: 'Azure HTTP ' + code + ': ' + response.getContentText().substring(0, 300) };
    }

    var urlPublica = storageUrl + '/' + d.carpeta + '/' + nombreUnico;

    // Registrar en hoja Archivos_Azure si se envía contexto
    if (d.modulo) {
      try {
        registrarArchivoAzure({
          urlArchivo:    urlPublica,
          nombreArchivo: d.nombre,
          tipoArchivo:   mimeType,
          tamanoArchivo: bytes.length,
          contenedor:    d.carpeta,
          modulo:        modulo,
          fechaSubida:   new Date().toISOString(),
          usuario:       d.usuario  || '',
          empresa:       d.empresa  || '',
          casoId:        d.casoId   || '',
          visitaId:      d.visitaId || ''
        });
      } catch(regErr) {
        Logger.log('subirArchivoAzure: error registrando en Sheets: ' + regErr);
      }
    }

    return { success: true, url: urlPublica, nombre: d.nombre, contenedor: d.carpeta, modulo: modulo };
  } catch(e) {
    return { success: false, error: 'subirArchivoAzure: ' + e.toString() };
  }
}

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

    var fecha      = new Date();
    var tamanoMb   = d.tamanoArchivo ? (d.tamanoArchivo / (1024 * 1024)).toFixed(2) : '';
    var referencia = d.casoId ? 'Caso #' + d.casoId
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
      referencia,
      ''
    ]);

    if (d.casoId)   _actualizarEnlaceCaso(ss, d.casoId, d.urlArchivo);
    if (d.visitaId) _actualizarEnlaceVisita(ss, d.visitaId, d.urlArchivo);

    return { success: true, url: d.urlArchivo, nombre: d.nombreArchivo };
  } catch(e) {
    return { success: false, error: 'registrarArchivoAzure: ' + e.toString() };
  }
}

function _actualizarEnlaceCaso(ss, casoId, url) {
  try {
    var ws = ss.getSheetByName('BD_Casos');
    if (!ws) return;
    var data = ws.getDataRange().getValues();
    var headers = data[0];
    var colNro = headers.indexOf('N°');
    var colEnlace = headers.indexOf('enlace_informe');
    if (colNro === -1 || colEnlace === -1) return;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][colNro]) === String(casoId)) {
        if (!data[i][colEnlace]) {
          ws.getRange(i + 1, colEnlace + 1).setValue(url);
        }
        break;
      }
    }
  } catch(e) {
    Logger.log('_actualizarEnlaceCaso: ' + e.toString());
  }
}

function _actualizarEnlaceVisita(ss, visitaId, url) {
  try {
    var ws = ss.getSheetByName('BD_Visitas');
    if (!ws) return;
    var data = ws.getDataRange().getValues();
    var headers = data[0];
    var colId = headers.indexOf('ID');
    var colEnlace = headers.indexOf('enlace_archivo');
    if (colId === -1 || colEnlace === -1) return;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][colId]) === String(visitaId)) {
        if (!data[i][colEnlace]) {
          ws.getRange(i + 1, colEnlace + 1).setValue(url);
        }
        break;
      }
    }
  } catch(e) {
    Logger.log('_actualizarEnlaceVisita: ' + e.toString());
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
    try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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
    try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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

    // ── ATENCIONES: combinar 2024, 2025 y 2026 deduplicando por nro ──
    var _rawAtAll = [];
    [anioActual, anioActual - 1, anioActual - 2].forEach(function(a) {
      var ws = ss.getSheetByName('BB. DE REGISTROS ' + a);
      if (ws) _rawAtAll = _rawAtAll.concat(ws.getDataRange().getValues().slice(1));
    });
    var _baseAt = ss.getSheetByName('BB. DE REGISTROS');
    if (_baseAt) _rawAtAll = _rawAtAll.concat(_baseAt.getDataRange().getValues().slice(1));
    var _vistosAtAdmin = new Set();
    var rawAt = _rawAtAll.filter(function(r) { var k = String(r[0]); if (!k || _vistosAtAdmin.has(k)) return false; _vistosAtAdmin.add(k); return true; });
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

    // ── VISITAS: r[0]=N° r[1]=Fecha r[2]=Empresa r[3]=Supervisor r[21]=Estado ──
    var wsVis   = ss.getSheetByName('Visitas_Campo');
    var rawVis  = wsVis ? getRowsCurrentYear(wsVis, 500, 1) : [];
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

    // ── CASOS: r[0]=N° r[1]=Fecha r[4]=Empresa r[9]=Supervisor r[15]=Estado ──
    var wsCas   = ss.getSheetByName('BD_Casos');
    var rawCas  = wsCas ? getRowsCurrentYear(wsCas, 500, 1) : [];
    var casos   = [];
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

    // ── FUSIONES: r[0]=ID r[1]=Fecha r[5]=Supervisor r[12]=TotalTrab r[27]=Estado ──
    var wsFus   = ss.getSheetByName('Fusiones_Buses');
    var rawFus  = wsFus ? getRowsCurrentYear(wsFus, 300, 1) : [];
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

    // ── Aplicar filtros ──
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
        total:      atenciones.length,
        pendientes: atenciones.filter(function(x){ return x.estado === 'PENDIENTE'; }).length,
        enProceso:  atenciones.filter(function(x){ return x.estado === 'EN PROCESO'; }).length,
        resueltos:  atenciones.filter(function(x){ return x.estado === 'RESUELTO'; }).length,
        esteMes:    atenciones.filter(function(x){ return x.mes === mesActual && x.anio === anioActual; }).length
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
            atenciones:0, atPendientes:0, atResueltos:0,
            visitas:0, viRetrasadas:0,
            casos:0, caRetrasados:0,
            fusiones:0
          };
        }
        if (modulo === 'at') {
          porSupervisor[s].atenciones++;
          if (x.estado === 'PENDIENTE') porSupervisor[s].atPendientes++;
          if (x.estado === 'RESUELTO')  porSupervisor[s].atResueltos++;
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
      var td  = new Date(hoy.getFullYear(), hoy.getMonth() - t, 1);
      var tMes = td.getMonth() + 1;
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
    // Cache de Apps Script: evita recalcular si el mismo usuario entra varias veces
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
    const esAdmin = (rol === 'administrador' || rol === 'administrador 01' || rol === 'administrador 02');

    // ── Atenciones ── (admins las cargan lazy al abrir el módulo — son miles de registros)
    let atenciones = [];
    if (!esAdmin) {
      try { const d = getAtenciones(p); if (d.success) atenciones = d.data; } catch(e){}
    }

    // ── Stats dashboard ──
    let stats = { hoy:0, mes:0, anio:0, total:0, enProceso:0, porMes:{}, porTipo:{}, porEstado:{} };
    try { const d = getEstadisticas(p); if (d.success) stats = d.data; } catch(e){}

    // ── Visitas ──
    let visitas = [];
    try { const d = getVisitas(p);     if (d.success) visitas = d.data; } catch(e){}

    // ── Casos ──
    let casos = [];
    try { const d = getCasos(p);       if (d.success) casos = d.data; } catch(e){}

    // ── Fusiones ──
    let fusiones = [];
    try { const d = getFusiones(p);    if (d.success) fusiones = d.data; } catch(e){}

    // ── Solicitudes (solo admin) ──
    let solicitudes = [];
    try { if (esAdmin) { const d = getSolicitudes(p); if (d.success) solicitudes = d.data; } } catch(e){}

    // ── Estadísticas admin: NO incluir en preload (muy pesado)
    // Se carga bajo demanda cuando el usuario abre esa sección
    let estadisticasAdmin = null;

    // ── Supervisores (para select en nueva visita) ──
    let supervisores = [];
    try { const d = getSupervisores(); if (d.success) supervisores = d.data; } catch(e){}

    // ── Usuarios (solo administrador puro) ──
    let usuarios = [];
    try { if (rol === 'administrador') { const d = getUsuarios(p); if (d.success) usuarios = d.data; } } catch(e){}

    const result = {
      atenciones, stats, visitas, casos, fusiones,
      solicitudes, estadisticasAdmin, usuarios, supervisores,
      timestamp: new Date().getTime(),
      _ts: Date.now()
    };

    // Guardar en cache por 10 minutos
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
    Logger.log('[getEvaluaciones360] total registros devueltos: ' + data.length);
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
        try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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
        try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
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
  // Limpiar cache primero
  const cache = CacheService.getScriptCache();
  for (let i = 0; i < 20; i++) {
    cache.remove('v2_Trabajadores_RAPEL_' + i);
    cache.remove('v2_Trabajadores_VERFRUT_' + i);
  }
  cache.remove('v2_Trabajadores_RAPEL_meta');
  cache.remove('v2_Trabajadores_VERFRUT_meta');
  
  // Cargar datos frescos
  const datos = cargarDatosTrabajadores('Trabajadores_RAPEL');
  Logger.log('Total filas RAPEL: ' + datos.length);
  if (datos.length > 0) {
    Logger.log('DNI fila 1: [' + datos[0][0] + ']');
    Logger.log('Nombre fila 1: ' + datos[0][1]);
  }
  // Buscar
  const q = '70356687';
  const encontrado = datos.filter(d => d[0] === q);
  Logger.log('Buscando ' + q + ': ' + encontrado.length + ' resultados');
}

// ══════════════════ ACCESOS TEMPORALES ══════════════════

function saveSolicitudAcceso(d) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) {
      ws = ss.insertSheet('Solicitudes_Acceso');
      ws.appendRow(['N°','Fecha Solicitud','Usuario','Nombre','Empresa',
        'Motivo','Horas Solicitadas','Estado','Resuelto Por','Hora Fin','Fecha Resolución']);
      ws.getRange(1,1,1,11).setFontWeight('bold');
    }
    // N° correlativo: lastRow da la última fila ocupada.
    // Si la hoja tiene header en fila 1, lastRow=1 → primer registro será nro=1.
    // Si ya hay datos, lastRow=N → nuevo registro será nro=N (= cantidad actual de datos).
    var lastRow = ws.getLastRow();
    var tieneHeader = String(ws.getRange(1,1).getValue()).toLowerCase().indexOf('n') === 0;
    var nro = tieneHeader ? lastRow : lastRow + 1; // sin header: filas = registros
    ws.appendRow([
      nro,
      new Date(),
      d.usuario         || '',
      d.nombre          || '',
      d.empresa         || '',
      d.motivo          || '',
      d.horas_solicitadas || '',
      'PENDIENTE',
      '', '', ''
    ]);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function getSolicitudesAcceso(p) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: true, data: [] };
    var rows = ws.getDataRange().getValues();
    if (rows.length === 0) return { success: true, data: [] };
    // Detectar si la primera fila es encabezado (columna A = 'N°' o texto)
    var primeraCelda = String(rows[0][0]||'').toLowerCase();
    var tieneHeader  = isNaN(Number(rows[0][0])) && primeraCelda !== '';
    var dataRows     = tieneHeader ? rows.slice(1) : rows;
    if (dataRows.length === 0) return { success: true, data: [] };
    var data = dataRows.filter(function(r){ return r[0] !== ''; }).map(function(r, i) {
      var filaReal = tieneHeader ? i + 2 : i + 1;
      // hora_fin puede ser Date (Sheets lo parsea como fecha 30/12/1899 HH:mm) → formatear como HH:mm
      var horaFinRaw = r[9];
      var horaFinStr = '';
      if (horaFinRaw instanceof Date) {
        horaFinStr = Utilities.formatDate(horaFinRaw, 'America/Lima', 'HH:mm');
      } else {
        var s = String(horaFinRaw||'').trim();
        horaFinStr = s.match(/^\d{1,2}:\d{2}/) ? s.substring(0,5) : '';
      }
      return {
        fila:             filaReal,
        nro:              r[0],
        fecha:            r[1] instanceof Date ? Utilities.formatDate(r[1],'America/Lima','dd/MM/yyyy HH:mm') : String(r[1]||'').substring(0,16),
        usuario:          String(r[2]||''),
        nombre:           String(r[3]||''),
        empresa:          String(r[4]||''),
        motivo:           String(r[5]||''),
        horas_solicitadas: parseInt(r[6]) || 0,
        estado:           String(r[7]||'PENDIENTE'),
        resuelto_por:     String(r[8]||''),
        hora_fin:         horaFinStr,
        fecha_resolucion: r[10] instanceof Date ? Utilities.formatDate(r[10],'America/Lima','dd/MM/yyyy HH:mm') : String(r[10]||'')
      };
    });
    if (p && p.estado) data = data.filter(function(s){ return s.estado === p.estado; });
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function resolverAccesoTemporal(d) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: false, error: 'Hoja no encontrada' };
    var fila  = parseInt(d.fila);
    // Usar horas del cuerpo si viene (selector frontend), sino leer de la hoja
    var horas = parseInt(d.horas) || parseInt(ws.getRange(fila, 7).getValue()) || 1;
    var horaFin = '';
    if (d.decision === 'APROBADO') {
      var fin = new Date();
      fin.setHours(fin.getHours() + horas);
      horaFin = Utilities.formatDate(fin, 'America/Lima', 'HH:mm');
    }
    ws.getRange(fila, 8).setValue(d.decision || '');
    ws.getRange(fila, 9).setValue(d.resuelto_por || d.aprobado_por || '');
    ws.getRange(fila, 10).setValue(horaFin);
    ws.getRange(fila, 11).setValue(new Date());
    return { success: true, hora_fin: horaFin };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function verificarAccesoTemporal(d) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var ws = ss.getSheetByName('Solicitudes_Acceso');
    if (!ws) return { success: true, tieneAcceso: false };
    var rows = ws.getDataRange().getValues();
    var ahora = new Date();
    var usuario = String(d.usuario || '').toLowerCase();
    for (var i = rows.length - 1; i >= 1; i--) {
      var r = rows[i];
      if (String(r[2]||'').toLowerCase() !== usuario) continue;
      if (String(r[7]||'') !== 'APROBADO') continue;
      var horaFinStr = String(r[9]||'');
      if (!horaFinStr) continue;
      // Construir fecha/hora fin de hoy
      var partes = horaFinStr.split(':');
      var fin = new Date();
      fin.setHours(parseInt(partes[0]), parseInt(partes[1]), 0, 0);
      if (ahora <= fin) {
        return { success: true, tieneAcceso: true, hasta: horaFinStr };
      }
    }
    return { success: true, tieneAcceso: false };
  } catch(e) {
    return { success: true, tieneAcceso: false };
  }
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO CAPACITACIONES
// Hojas: CAPACITACIONES_HDR (cabecera) + BD_Capacitaciones (asistentes)
// ═══════════════════════════════════════════════════════════════

function capSetupInicial() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Hoja cabecera
  let hHdr = ss.getSheetByName('CAPACITACIONES_HDR');
  if (!hHdr) {
    hHdr = ss.insertSheet('CAPACITACIONES_HDR');
    hHdr.appendRow([
      'ID', 'EMPRESA', 'FECHA', 'TIPO', 'TEMA', 'FUENTE', 'AREA', 'LUGAR',
      'HORA_INICIO', 'HORA_TERMINO', 'TOTAL_HORAS',
      'CAP_DNI', 'CAP_NOMBRE', 'CAP_CARGO',
      'N_HOMBRES', 'N_MUJERES', 'TOTAL_ASISTENTES',
      'USUARIO', 'USUARIO_NOMBRE', 'TIMESTAMP'
    ]);
    hHdr.getRange(1, 1, 1, 20).setFontWeight('bold').setBackground('#0a2463').setFontColor('#ffffff');
  }

  // Hoja asistentes
  let hAsis = ss.getSheetByName('BD_Capacitaciones');
  if (!hAsis) {
    hAsis = ss.insertSheet('BD_Capacitaciones');
    hAsis.appendRow([
      'ID_CAP', 'N', 'DNI', 'NOMBRE', 'EMPRESA', 'CARGO', 'SEXO', 'OBSERVACIONES', 'TIMESTAMP'
    ]);
    hAsis.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0a2463').setFontColor('#ffffff');
  }

  return { success: true };
}

function capGuardar(body) {
  try {
    capSetupInicial();
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hHdr  = ss.getSheetByName('CAPACITACIONES_HDR');
    const hAsis = ss.getSheetByName('BD_Capacitaciones');

    if (!hHdr)  return { success: false, error: 'Hoja CAPACITACIONES_HDR no encontrada. Ejecuta capSetupInicial() manualmente.' };
    if (!hAsis) return { success: false, error: 'Hoja BD_Capacitaciones no encontrada. Ejecuta capSetupInicial() manualmente.' };

    const asistentes = body.asistentes;
    if (!Array.isArray(asistentes) || asistentes.length === 0) {
      return { success: false, error: 'No se recibieron asistentes. Total recibido: ' + JSON.stringify(asistentes) };
    }

    const now  = new Date();
    const pad2 = n => String(n).padStart(2, '0');
    const id   = 'CAP-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) +
                 '-' + pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());

    // Guardar cabecera
    hHdr.appendRow([
      id,
      body.empresa        || '',
      body.fecha          || '',
      body.tipo           || '',
      body.tema           || '',
      body.fuente         || '',
      body.area           || '',
      body.lugar          || '',
      body.hora_inicio    || '',
      body.hora_termino   || '',
      body.total_horas    || 0,
      body.cap_dni        || '',
      body.cap_nombre     || '',
      body.cap_cargo      || '',
      body.n_hombres      || 0,
      body.n_mujeres      || 0,
      asistentes.length,
      body.usuario        || '',
      body.usuario_nombre || '',
      now
    ]);

    // Guardar asistentes
    asistentes.forEach(function(a) {
      hAsis.appendRow([
        id,
        a.n      || '',
        a.dni    || '',
        a.nombre || '',
        a.empresa|| '',
        a.cargo  || '',
        a.sexo   || '',
        a.obs    || '',
        now
      ]);
    });

    SpreadsheetApp.flush(); // forzar escritura inmediata
    try { actualizarFirebaseModulos(); } catch(em) { console.warn('[Firebase] módulos falló:', em.message); }
    console.log('[capGuardar] OK — id:', id, '| asistentes:', asistentes.length);
    return { success: true, id: id, total: asistentes.length };
  } catch(e) {
    console.error('[capGuardar] ERROR:', e.toString());
    return { success: false, error: e.toString() };
  }
}

function capListar(p) {
  try {
    capSetupInicial();
    const ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hHdr = ss.getSheetByName('CAPACITACIONES_HDR');
    if (!hHdr || hHdr.getLastRow() < 2) return { success: true, data: [] };

    const rows = hHdr.getDataRange().getValues();
    const head = rows[0].map(h => String(h).toLowerCase().replace(/ /g, '_'));
    const empresa = (p.empresa || '').toUpperCase();
    const esAdmin = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'].indexOf(
      (p.rol || '').toLowerCase()
    ) !== -1;

    const data = rows.slice(1)
      .filter(r => {
        if (empresa && String(r[1] || '').toUpperCase() !== empresa) return false;
        if (!esAdmin && String(r[17] || '') !== (p.usuario || '')) return false;
        return true;
      })
      .map(r => ({
        id:               r[0],
        empresa:          r[1],
        fecha:            r[2] ? String(r[2]).split('T')[0] : '',
        tipo:             r[3],
        tema:             r[4],
        fuente:           r[5],
        area:             r[6],
        lugar:            r[7],
        hora_inicio:      r[8],
        hora_termino:     r[9],
        total_horas:      r[10],
        cap_nombre:       r[12],
        total_asistentes: r[16],
        usuario:          r[17],
        usuario_nombre:   r[18]
      }))
      .reverse(); // más recientes primero

    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function capExportar(p) {
  try {
    capSetupInicial();
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const hHdr  = ss.getSheetByName('CAPACITACIONES_HDR');
    const hAsis = ss.getSheetByName('BD_Capacitaciones');
    if (!hAsis || hAsis.getLastRow() < 2) return { success: true, data: [] };

    const empresa = (p.empresa || '').toUpperCase();
    const desde   = p.desde || '';
    const hasta   = p.hasta || '';
    const esAdmin = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'].indexOf(
      (p.rol || '').toLowerCase()
    ) !== -1;

    // Mapa de cabeceras para filtro
    const hdrRows = hHdr && hHdr.getLastRow() > 1 ? hHdr.getDataRange().getValues() : [];
    const capMap  = {};
    hdrRows.slice(1).forEach(r => { capMap[String(r[0])] = { empresa: String(r[1] || ''), fecha: String(r[2] || '').split('T')[0], tema: String(r[4] || ''), usuario: String(r[17] || '') }; });

    const asisRows = hAsis.getDataRange().getValues();
    const data = asisRows.slice(1)
      .filter(r => {
        const idCap = String(r[0]);
        const cap   = capMap[idCap] || {};
        if (empresa && (cap.empresa || '').toUpperCase() !== empresa) return false;
        if (desde && (cap.fecha || '') < desde) return false;
        if (hasta && (cap.fecha || '') > hasta) return false;
        if (!esAdmin && (cap.usuario || '') !== (p.usuario || '')) return false;
        return true;
      })
      .map(r => ({
        id_cap:   r[0],
        n:        r[1],
        dni:      r[2],
        nombre:   r[3],
        empresa:  r[4],
        cargo:    r[5],
        sexo:     r[6],
        fecha:    (capMap[String(r[0])] || {}).fecha || '',
        tema:     (capMap[String(r[0])] || {}).tema  || ''
      }));

    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// MÓDULO INVENTARIO CANASTAS
// ============================================================

const INV_SHEETS = {
  productos:    'INV_Productos',
  receta:       'INV_Receta',
  responsables: 'INV_Responsables',
  meta:         'INV_Meta',
  ingresos:     'INV_Ingresos',
  armados:      'INV_Canastas_Armadas',
  entregas:     'INV_Entregas'
};

function invSheet(key) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(INV_SHEETS[key]);
}

// Crea las 6 hojas y carga 7 responsables iniciales. Ejecutar UNA VEZ desde el editor.
function invSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const defs = [
    { key: 'receta',       hdr: ['producto', 'cantidad', 'unidad', 'activo'] },
    { key: 'responsables', hdr: ['nombre', 'activo'] },
    { key: 'meta',         hdr: ['meta_canastas', 'actualizado_en', 'actualizado_por'] },
    { key: 'ingresos',     hdr: ['id', 'producto', 'cantidad', 'unidad', 'fecha_venc', 'responsable', 'fecha', 'usuario'] },
    { key: 'armados',      hdr: ['id', 'cantidad', 'fecha', 'usuario'] },
    { key: 'entregas',     hdr: ['id', 'empresa', 'sector', 'cantidad', 'responsable', 'fecha', 'usuario'] }
  ];

  defs.forEach(function(def) {
    var sh = ss.getSheetByName(INV_SHEETS[def.key]);
    if (!sh) {
      sh = ss.insertSheet(INV_SHEETS[def.key]);
      sh.appendRow(def.hdr);
      sh.getRange(1, 1, 1, def.hdr.length).setFontWeight('bold');
    }
  });

  var shResp = ss.getSheetByName(INV_SHEETS['responsables']);
  var responsablesInit = [
    'Jaime Siancas',
    'Deysi Quispe',
    'Joel Timoteo Gonza',
    'Olga Vilela Ludeña',
    'Jorge Chávez Córdova',
    'Alex Tineo Ramos',
    'Yhanelly Luzon Venegas'
  ];
  var existentes = shResp.getLastRow() > 1
    ? shResp.getRange(2, 1, shResp.getLastRow() - 1, 1).getValues().map(function(r) { return String(r[0]).trim(); })
    : [];
  responsablesInit.forEach(function(n) {
    if (existentes.indexOf(n) === -1) shResp.appendRow([n, 'TRUE']);
  });

  var shMeta = ss.getSheetByName(INV_SHEETS['meta']);
  if (shMeta.getLastRow() < 2) {
    shMeta.appendRow([0, new Date().toISOString(), 'setup']);
  }

  return { success: true, msg: 'invSetup completado' };
}

// Devuelve todo el estado del inventario en una sola llamada
function invGetAll() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    function sheetRows(key) {
      var sh = ss.getSheetByName(INV_SHEETS[key]);
      if (!sh || sh.getLastRow() < 2) return [];
      return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    }

    var receta = sheetRows('receta')
      .filter(function(r) { return String(r[3]).toUpperCase() !== 'FALSE'; })
      .map(function(r) { return { producto: String(r[0]), cantidad: Number(r[1]), unidad: String(r[2]) }; });

    var responsables = sheetRows('responsables')
      .filter(function(r) { return String(r[1]).toUpperCase() !== 'FALSE'; })
      .map(function(r) { return String(r[0]); });

    var metaRows = sheetRows('meta');
    var meta = metaRows.length > 0 ? Number(metaRows[metaRows.length - 1][0]) : 0;

    var productos = sheetRows('productos')
      .filter(function(r) { return String(r[2]).toUpperCase() !== 'FALSE'; })
      .map(function(r) { return { id: String(r[0]), nombre: String(r[1]) }; });

    // cols: id, producto, cantidad, unidad, fecha_venc, responsable, fecha, usuario
    var ingresos = sheetRows('ingresos').map(function(r) {
      return {
        id:          String(r[0]),
        producto:    String(r[1]),
        cantidad:    Number(r[2]),
        unidad:      String(r[3] || ''),
        fecha_venc:  r[4] ? Utilities.formatDate(new Date(r[4]), 'America/Lima', 'yyyy-MM-dd') : '',
        responsable: String(r[5]),
        fecha:       r[6] ? Utilities.formatDate(new Date(r[6]), 'America/Lima', 'yyyy-MM-dd') : '',
        usuario:     String(r[7])
      };
    });

    var armados = sheetRows('armados').map(function(r) {
      return {
        id:       String(r[0]),
        cantidad: Number(r[1]),
        fecha:    r[2] ? Utilities.formatDate(new Date(r[2]), 'America/Lima', 'yyyy-MM-dd') : '',
        usuario:  String(r[3])
      };
    });

    var entregas = sheetRows('entregas').map(function(r) {
      return {
        id:          String(r[0]),
        empresa:     String(r[1]),
        sector:      String(r[2]),
        cantidad:    Number(r[3]),
        responsable: String(r[4]),
        fecha:       r[5] ? Utilities.formatDate(new Date(r[5]), 'America/Lima', 'yyyy-MM-dd') : '',
        usuario:     String(r[6])
      };
    });

    return { success: true, data: { meta: meta, productos: productos, receta: receta, responsables: responsables, ingresos: ingresos, armados: armados, entregas: entregas } };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invGuardarMeta(body) {
  try {
    var sh = invSheet('meta');
    sh.appendRow([Number(body.meta_total || body.meta || 0), new Date().toISOString(), String(body.usuario || '')]);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invAgregarReceta(body) {
  try {
    var sh   = invSheet('receta');
    var prod = String(body.producto).trim();
    var rows = sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function(r) { return String(r[0]).trim().toLowerCase(); })
      : [];
    if (rows.indexOf(prod.toLowerCase()) !== -1) return { success: false, error: 'Producto ya existe en receta' };
    sh.appendRow([prod, Number(body.cantidad), String(body.unidad || 'kg'), 'TRUE']);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEliminarReceta(body) {
  try {
    var sh   = invSheet('receta');
    var prod = String(body.producto).trim().toLowerCase();
    if (sh.getLastRow() < 2) return { success: false, error: 'Receta vacía' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toLowerCase() === prod) {
        sh.getRange(i + 2, 4).setValue('FALSE');
        return { success: true };
      }
    }
    return { success: false, error: 'Producto no encontrado' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invAgregarResponsable(body) {
  try {
    var sh     = invSheet('responsables');
    var nombre = String(body.nombre || '').trim();
    if (!nombre) return { success: false, error: 'Nombre requerido' };
    var existentes = sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function(r) { return String(r[0]).trim().toLowerCase(); })
      : [];
    if (existentes.indexOf(nombre.toLowerCase()) !== -1) return { success: false, error: 'Responsable ya existe' };
    sh.appendRow([nombre, 'TRUE']);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invRegistrarIngreso(body) {
  try {
    var sh = invSheet('ingresos');
    var id = 'ING-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd-HHmmss');
    var fv = (body.fecha_venc || body.fecha_vencimiento) ? new Date((body.fecha_venc || body.fecha_vencimiento) + 'T12:00:00') : '';
    var fechaIngreso = body.fecha ? new Date(body.fecha + 'T12:00:00') : new Date();
    // cols: id, producto, cantidad, unidad, fecha_venc, responsable, fecha, usuario
    sh.appendRow([
      id,
      String(body.producto),
      Number(body.cantidad),
      String(body.unidad || ''),
      fv,
      String(body.responsable || ''),
      fechaIngreso,
      String(body.usuario || '')
    ]);
    return { success: true, id: id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invRegistrarArmado(body) {
  try {
    var sh = invSheet('armados');
    var id = 'ARM-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd-HHmmss');
    sh.appendRow([
      id,
      Number(body.cantidad),
      new Date(),
      String(body.usuario || '')
    ]);
    return { success: true, id: id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invRegistrarEntrega(body) {
  try {
    var sh = invSheet('entregas');
    var id = 'ENT-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd-HHmmss');
    sh.appendRow([
      id,
      String(body.empresa || '').toUpperCase(),
      String(body.sector  || ''),
      Number(body.cantidad),
      String(body.responsable || ''),
      new Date(),
      String(body.usuario || '')
    ]);
    return { success: true, id: id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invDatosReporte(body) {
  try {
    var all = invGetAll();
    if (!all.success) return all;
    var d    = all.data;
    var emp  = String(body.empresa || '').toUpperCase();
    var desde = String(body.desde || '');
    var hasta = String(body.hasta || '');

    var entregas = d.entregas.filter(function(e) {
      if (emp && e.empresa !== emp) return false;
      if (desde && e.fecha < desde) return false;
      if (hasta && e.fecha > hasta) return false;
      return true;
    });

    var armados = d.armados.filter(function(a) {
      if (desde && a.fecha < desde) return false;
      if (hasta && a.fecha > hasta) return false;
      return true;
    });

    return { success: true, data: { meta: d.meta, receta: d.receta, responsables: d.responsables, ingresos: d.ingresos, armados: armados, entregas: entregas } };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invGuardarReporteDrive(body) {
  try {
    if (!body.base64 || !body.nombre) return { success: false, error: 'base64 y nombre requeridos' };
    var decoded = Utilities.base64Decode(body.base64);
    var blob    = Utilities.newBlob(decoded, 'application/pdf', body.nombre);
    var folder  = DriveApp.getRootFolder();
    var file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: file.getUrl(), id: file.getId() };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}


// ── Catálogo de productos (INV_Productos) ──
// Cols: ID, NOMBRE, ACTIVO, CREADO, CREADO_POR

function invSetupCatalogo() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(INV_SHEETS['productos']);
  if (!sh) {
    sh = ss.insertSheet(INV_SHEETS['productos']);
    sh.appendRow(['id', 'nombre', 'activo', 'creado', 'creado_por']);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  var productos = [
    'Arroz', 'Menestra', 'Azúcar', 'Gaseosa', 'Galleta',
    'Chocolate', 'Panetón', 'Fideo', 'Fideo canuto',
    'Avena', 'Leche', 'Aceite', 'Galleta vainilla'
  ];
  var existentes = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().map(function(r) { return String(r[1]).trim().toLowerCase(); })
    : [];
  productos.forEach(function(n) {
    if (existentes.indexOf(n.toLowerCase()) === -1) {
      var id = 'PROD-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random()*1000);
      sh.appendRow([id, n, 'TRUE', new Date().toISOString(), 'setup']);
      Utilities.sleep(50);
    }
  });
  return { success: true, msg: 'invSetupCatalogo completado' };
}

function invListarProductos() {
  try {
    var sh = invSheet('productos');
    if (!sh || sh.getLastRow() < 2) return { success: true, data: [] };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    var data = rows.map(function(r) {
      return { id: String(r[0]), nombre: String(r[1]), activo: String(r[2]).toUpperCase() !== 'FALSE' };
    });
    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invAgregarProducto(body) {
  try {
    var sh     = invSheet('productos');
    var nombre = String(body.nombre || '').trim();
    if (!nombre) return { success: false, error: 'Nombre requerido' };
    var existentes = sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().map(function(r) { return String(r[1]).trim().toLowerCase(); })
      : [];
    if (existentes.indexOf(nombre.toLowerCase()) !== -1) return { success: false, error: 'Producto ya existe' };
    var id = 'PROD-' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMddHHmmss');
    sh.appendRow([id, nombre, 'TRUE', new Date().toISOString(), String(body.usuario || '')]);
    return { success: true, id: id };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEditarProducto(body) {
  try {
    var sh     = invSheet('productos');
    var id     = String(body.id || '');
    var nombre = String(body.nombre || '').trim();
    if (!id || !nombre) return { success: false, error: 'id y nombre requeridos' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin productos' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        sh.getRange(i + 2, 2).setValue(nombre);
        return { success: true };
      }
    }
    return { success: false, error: 'Producto no encontrado' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEliminarProducto(body) {
  try {
    var sh = invSheet('productos');
    var id = String(body.id || '');
    if (!id) return { success: false, error: 'id requerido' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin productos' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        sh.getRange(i + 2, 3).setValue('FALSE');
        return { success: true };
      }
    }
    return { success: false, error: 'Producto no encontrado' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ── Editar / eliminar Ingresos ──
// cols: id(0), producto(1), cantidad(2), unidad(3), fecha_venc(4), responsable(5), fecha(6), usuario(7)

function invEditarIngreso(body) {
  try {
    var sh = invSheet('ingresos');
    var id = String(body.id || '');
    if (!id) return { success: false, error: 'id requerido' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin ingresos' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        var fv   = body.fecha_venc ? new Date(body.fecha_venc + 'T12:00:00') : rows[i][4];
        var fing = body.fecha      ? new Date(body.fecha + 'T12:00:00')      : rows[i][6];
        sh.getRange(i + 2, 2).setValue(String(body.producto   || rows[i][1]));
        sh.getRange(i + 2, 3).setValue(Number(body.cantidad  !== undefined ? body.cantidad : rows[i][2]));
        sh.getRange(i + 2, 4).setValue(String(body.unidad    || rows[i][3]));
        sh.getRange(i + 2, 5).setValue(fv);
        sh.getRange(i + 2, 6).setValue(String(body.responsable || rows[i][5]));
        sh.getRange(i + 2, 7).setValue(fing);
        return { success: true };
      }
    }
    return { success: false, error: 'Ingreso no encontrado' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEliminarIngreso(body) {
  try {
    var sh = invSheet('ingresos');
    var id = String(body.id || '');
    if (!id) return { success: false, error: 'id requerido' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin ingresos' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        sh.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, error: 'Ingreso no encontrado' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ── Editar / eliminar Armados ──
// Helpers para validar stock

function _invTotalesActuales(ss) {
  function shRows(name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  }
  var recetaRows = shRows(INV_SHEETS['receta']).filter(function(r) { return String(r[3]).toUpperCase() !== 'FALSE'; });
  var receta = recetaRows.map(function(r) { return { producto: String(r[0]), cantidad: Number(r[1]) }; });

  var ingPorProd = {};
  shRows(INV_SHEETS['ingresos']).forEach(function(r) {
    var k = String(r[1]); ingPorProd[k] = (ingPorProd[k] || 0) + Number(r[2]);
  });

  var totalArmadas = 0;
  shRows(INV_SHEETS['armados']).forEach(function(r) { totalArmadas += Number(r[1]); });

  var totalEntregadas = 0;
  shRows(INV_SHEETS['entregas']).forEach(function(r) { totalEntregadas += Number(r[3]); });

  return { receta: receta, ingPorProd: ingPorProd, totalArmadas: totalArmadas, totalEntregadas: totalEntregadas };
}

function _invStockValido(t, nuevasArmadas) {
  // Devuelve true si con nuevasArmadas el stock de todos los productos es >= 0
  for (var i = 0; i < t.receta.length; i++) {
    var r    = t.receta[i];
    var ing  = t.ingPorProd[r.producto] || 0;
    var cons = nuevasArmadas * r.cantidad;
    if (ing - cons < 0) return false;
  }
  return true;
}

function invEditarArmado(body) {
  try {
    var sh  = invSheet('armados');
    var id  = String(body.id || '');
    var nuevaCant = Number(body.cantidad);
    if (!id) return { success: false, error: 'id requerido' };
    if (isNaN(nuevaCant) || nuevaCant < 0) return { success: false, error: 'cantidad inválida' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin armados' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    var idx  = -1;
    var oldCant = 0;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) { idx = i; oldCant = Number(rows[i][1]); break; }
    }
    if (idx === -1) return { success: false, error: 'Armado no encontrado' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var t  = _invTotalesActuales(ss);
    var nuevasTotales = t.totalArmadas - oldCant + nuevaCant;

    // Si aumenta: validar stock
    if (nuevaCant > oldCant && !_invStockValido(t, nuevasTotales)) {
      return { success: false, error: 'Stock insuficiente para aumentar la cantidad' };
    }
    // Si reduce: no dejar disponibles negativos (armadas >= entregadas)
    if (nuevaCant < oldCant && nuevasTotales < t.totalEntregadas) {
      return { success: false, error: 'No se puede reducir: ya se entregaron ' + t.totalEntregadas + ' canastas' };
    }

    var fecha = body.fecha ? new Date(body.fecha + 'T12:00:00') : rows[idx][2];
    sh.getRange(idx + 2, 2).setValue(nuevaCant);
    sh.getRange(idx + 2, 3).setValue(fecha);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEliminarArmado(body) {
  try {
    var sh = invSheet('armados');
    var id = String(body.id || '');
    if (!id) return { success: false, error: 'id requerido' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin armados' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    var idx     = -1;
    var oldCant = 0;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) { idx = i; oldCant = Number(rows[i][1]); break; }
    }
    if (idx === -1) return { success: false, error: 'Armado no encontrado' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var t  = _invTotalesActuales(ss);
    var nuevasTotales = t.totalArmadas - oldCant;
    if (nuevasTotales < t.totalEntregadas) {
      return { success: false, error: 'No se puede eliminar: quedarían disponibles negativos (entregadas: ' + t.totalEntregadas + ')' };
    }

    sh.deleteRow(idx + 2);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// ── Editar / eliminar Entregas ──

function invEditarEntrega(body) {
  try {
    var sh = invSheet('entregas');
    var id = String(body.id || '');
    var nuevaCant = Number(body.cantidad);
    if (!id) return { success: false, error: 'id requerido' };
    if (isNaN(nuevaCant) || nuevaCant < 0) return { success: false, error: 'cantidad inválida' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin entregas' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
    var idx     = -1;
    var oldCant = 0;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) { idx = i; oldCant = Number(rows[i][3]); break; }
    }
    if (idx === -1) return { success: false, error: 'Entrega no encontrada' };

    if (nuevaCant > oldCant) {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var t  = _invTotalesActuales(ss);
      var disponibles = t.totalArmadas - t.totalEntregadas + oldCant - nuevaCant;
      if (disponibles < 0) {
        return { success: false, error: 'Solo hay ' + (t.totalArmadas - t.totalEntregadas + oldCant) + ' disponibles para asignar' };
      }
    }

    var fecha = body.fecha ? new Date(body.fecha + 'T12:00:00') : rows[idx][5];
    sh.getRange(idx + 2, 2).setValue(String(body.empresa    || rows[idx][1]).toUpperCase());
    sh.getRange(idx + 2, 3).setValue(String(body.sector     || rows[idx][2]));
    sh.getRange(idx + 2, 4).setValue(nuevaCant);
    sh.getRange(idx + 2, 5).setValue(String(body.responsable || rows[idx][4]));
    sh.getRange(idx + 2, 6).setValue(fecha);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

function invEliminarEntrega(body) {
  try {
    var sh = invSheet('entregas');
    var id = String(body.id || '');
    if (!id) return { success: false, error: 'id requerido' };
    if (sh.getLastRow() < 2) return { success: false, error: 'Sin entregas' };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        sh.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, error: 'Entrega no encontrada' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
