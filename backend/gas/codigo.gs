// ============================================================
// Google Apps Script — Sistema RL v2
// Módulo: Registro de Casos
// ============================================================

// ── Configuración (ajustar antes de desplegar) ────────────────
var CONFIG = {
  SHEET_ID:        'TU_SHEET_ID_AQUI',      // ID del Google Spreadsheet
  DRIVE_FOLDER_ID: 'TU_CARPETA_RAIZ_ID',    // ID de la carpeta raíz en Drive
  SHEET_CASOS:     'Casos',                 // Nombre de la hoja de casos
  MAX_MB:          10                       // Tamaño máximo de archivos en MB
};

// ── Mapeo usuario → nombre de carpeta en Drive ────────────────
var DRIVE_USER_MAP = {
  'ptamayo':    'PTAMAYO',
  'atineo':     'ATINEO',
  'fpulache':   'FPULACHE',
  'yluzon':     'YLUZON',
  'sviera':     'SVIERA',
  'ecastro':    'ECASTRO',
  'almartinez': 'ALMARTINEZ',
  'fzapata':    'FZAPATA',
  'rmolero':    'RMOLERO',
  'ovilela':    'OVILELA',
  'jchavez':    'JCHAVEZ',
  'jtimoteo':   'JTIMOTEO',
  'mmechato':   'MURIEL MECHATO',
  'javendano':  'JAVENDANI',
  'jsiancas':   'JSIANCAS',
  'smiranda':   'SMIRANDA'
};

// ── Columnas del sheet Casos (orden exacto de la hoja) ────────
var COLS_CASOS = [
  'nro',
  'fecha_registro',
  'dni',
  'nombre',
  'empresa',
  'cargo',
  'sector',
  'ingreso',
  'termino',
  'supervisor',
  'motivo',
  'motivo_extra',
  'fecha_reporte',
  'fecha_inicio_plazo',
  'fecha_limite',
  'temporada',
  'estado_plazo',
  'estado_caso',
  'estado_gestion',
  'gravedad',
  'redaccion',
  'motivo_retraso',
  'dias_habiles_transcurridos',
  'dias_restantes',
  'porcentaje_avance',
  'fecha_conclusion',
  'nombre_informe',
  'archivo_informe_url',
  'nombre_reporte',
  'archivo_descargo_url',
  'carpeta_drive',
  'usuario_registro',
  'registrado_por'
];

// ── Router GET ────────────────────────────────────────────────
function doGet(e) {
  var p = e.parameter;
  var action = p.action || '';
  var result;
  try {
    if      (action === 'getCasos')            result = getCasos(p);
    else if (action === 'buscarTrabajador')   result = buscarTrabajador(p);
    else if (action === 'getEvaluaciones360') result = getEvaluaciones360(p);
    else result = { success: false, error: 'Acción GET no reconocida: ' + action };
  } catch (err) {
    result = { success: false, error: err.message };
    Logger.log('doGet error [' + action + ']: ' + err.message);
  }
  return _jsonResponse(result);
}

// ── Router POST ───────────────────────────────────────────────
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { body = {}; }
  var action = body.action || '';
  var result;
  try {
    if      (action === 'subirArchivo')      result = subirArchivo(body);
    else if (action === 'saveCaso')          result = saveCaso(body);
    else if (action === 'updateCaso')        result = updateCaso(body);
    else if (action === 'saveEvaluacion360') result = saveEvaluacion360(body);
    else result = { success: false, error: 'Acción POST no reconocida: ' + action };
  } catch (err) {
    result = { success: false, error: err.message };
    Logger.log('doPost error [' + action + ']: ' + err.message);
  }
  return _jsonResponse(result);
}

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════
// DRIVE: Gestión de carpetas /rl/año/usuario
// ════════════════════════════════════════════════════════════

/**
 * Obtiene la carpeta raíz del proyecto en Drive.
 * Si no existe 'rl' dentro de la raíz configurada, la crea.
 * @returns {Folder}
 */
function getRootRL() {
  var root = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var it = root.getFoldersByName('rl');
  if (it.hasNext()) return it.next();
  Logger.log('Creando carpeta raíz /rl');
  return root.createFolder('rl');
}

/**
 * Obtiene o crea la carpeta /rl/{año}
 * @param {string|number} año
 * @returns {Folder}
 */
function getCarpetaAnio(año) {
  var rl = getRootRL();
  var nombre = String(año);
  var it = rl.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  Logger.log('Creando carpeta /rl/' + nombre);
  return rl.createFolder(nombre);
}

/**
 * Obtiene o crea la carpeta /rl/{año}/{usuario}
 * Aplica el mapeo DRIVE_USER_MAP para normalizar el nombre.
 * @param {string} usuario  - login del usuario (ej. 'jtimoteo')
 * @param {string|number} año
 * @returns {Folder}
 */
function getCarpetaUsuario(usuario, año) {
  var carpetaAnio = getCarpetaAnio(año);
  var nombreUsuario = DRIVE_USER_MAP[String(usuario).toLowerCase()] || String(usuario).toUpperCase();
  var it = carpetaAnio.getFoldersByName(nombreUsuario);
  if (it.hasNext()) return it.next();
  Logger.log('Creando carpeta /rl/' + año + '/' + nombreUsuario);
  return carpetaAnio.createFolder(nombreUsuario);
}

// ════════════════════════════════════════════════════════════
// DRIVE: Subida de archivos
// ════════════════════════════════════════════════════════════

/**
 * Sube un archivo PDF a Drive en la ruta /rl/{año}/{usuario}
 * Si ya existe un archivo con el mismo nombre, lo reemplaza.
 *
 * Parámetros esperados en body:
 *   nombre   {string} - nombre final del archivo (ej. 12345678_informe_20260325.pdf)
 *   mimeType {string} - 'application/pdf'
 *   base64   {string} - contenido en base64
 *   carpeta  {string} - nombre de carpeta/usuario (ej. 'JTIMOTEO')
 *   año      {string} - año (ej. '2026')
 */
function subirArchivo(params) {
  var nombre   = params.nombre   || 'archivo.pdf';
  var mimeType = params.mimeType || 'application/pdf';
  var base64   = params.base64   || '';
  var carpeta  = params.carpeta  || params.usuario_registro || 'SIN_USUARIO';
  var año      = Number(params.año) || new Date().getFullYear();

  // Validar tamaño (base64 ~= 4/3 del binario)
  var bytes = Math.ceil((base64.length * 3) / 4);
  if (bytes > CONFIG.MAX_MB * 1024 * 1024) {
    return { success: false, error: 'El archivo supera los ' + CONFIG.MAX_MB + 'MB permitidos' };
  }

  // Validar que sea PDF por MIME
  if (mimeType !== 'application/pdf') {
    return { success: false, error: 'Solo se permiten archivos PDF' };
  }

  try {
    var folder = getCarpetaUsuario(carpeta, año);
    var blob   = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, nombre);

    // Reemplazar si ya existe un archivo con ese nombre
    var existentes = folder.getFilesByName(nombre);
    while (existentes.hasNext()) {
      existentes.next().setTrashed(true);
    }

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var enlace = 'https://drive.google.com/file/d/' + file.getId() + '/view';
    var ruta   = '/rl/' + año + '/' +
                 (DRIVE_USER_MAP[String(carpeta).toLowerCase()] || String(carpeta).toUpperCase());

    Logger.log('Archivo subido: ' + ruta + '/' + nombre);
    return { success: true, enlace: enlace, carpeta: ruta, fileId: file.getId() };

  } catch (err) {
    Logger.log('Error subirArchivo: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════════
// SHEETS: Gestión de casos
// ════════════════════════════════════════════════════════════

/**
 * Retorna la hoja de casos del spreadsheet configurado.
 * @returns {Sheet}
 */
function getSheetCasos() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_CASOS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_CASOS);
  }
  return sh;
}

/**
 * Asegura que la hoja tenga los headers definidos en COLS_CASOS.
 * Solo escribe headers si la primera fila está vacía.
 */
function asegurarHeadersCasos() {
  var sh      = getSheetCasos();
  var primera = sh.getRange(1, 1, 1, COLS_CASOS.length).getValues()[0];
  if (!primera[0] || primera[0] !== 'nro') {
    sh.getRange(1, 1, 1, COLS_CASOS.length).setValues([COLS_CASOS]);
    sh.setFrozenRows(1);
    Logger.log('Headers escritos en hoja ' + CONFIG.SHEET_CASOS);
  }
}

/**
 * Guarda un nuevo caso en Google Sheets.
 * Asigna automáticamente el número correlativo (última fila - 1).
 */
function saveCaso(params) {
  asegurarHeadersCasos();
  var sh   = getSheetCasos();
  var last = sh.getLastRow(); // fila 1 = headers
  var nro  = last;            // nro = index desde 1 (ajustable)

  var fila = COLS_CASOS.map(function (col) {
    if (col === 'nro')            return nro;
    if (col === 'fecha_registro') return new Date().toISOString().split('T')[0];
    var val = params[col];
    return (val !== undefined && val !== null) ? val : '';
  });

  sh.appendRow(fila);
  Logger.log('Caso guardado N°' + nro + ' — ' + (params.nombre || ''));
  return { success: true, nro: nro };
}

/**
 * Actualiza un caso existente identificado por su número (campo 'nro').
 * No sobreescribe nro ni fecha_registro.
 * Solo actualiza campos que vienen en params y no están vacíos.
 */
function updateCaso(params) {
  asegurarHeadersCasos();
  var sh      = getSheetCasos();
  var nro     = String(params.nro);
  var data    = sh.getDataRange().getValues();
  var headers = data[0];
  var nroIdx  = headers.indexOf('nro');

  if (nroIdx === -1) {
    return { success: false, error: 'Columna nro no encontrada en la hoja' };
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nroIdx]) === nro) {
      COLS_CASOS.forEach(function (col, j) {
        // No modificar clave primaria ni fecha de creación
        if (col === 'nro' || col === 'fecha_registro') return;
        var val = params[col];
        if (val !== undefined && val !== null && val !== '') {
          sh.getRange(i + 1, j + 1).setValue(val);
        }
      });
      Logger.log('Caso actualizado N°' + nro);
      return { success: true, nro: nro };
    }
  }

  return { success: false, error: 'Caso N° ' + nro + ' no encontrado' };
}

/**
 * Obtiene casos con filtros opcionales.
 * Admite filtros: empresa, motivo, supervisor, rol, usuario, nombre.
 * Si el rol no es admin, devuelve solo los casos del usuario.
 */
function getCasos(params) {
  var sh   = getSheetCasos();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [] };

  var headers    = data[0];
  var empresa    = params.empresa    || '';
  var motivo     = params.motivo     || '';
  var supervisor = (params.supervisor || '').toLowerCase();
  var rol        = (params.rol       || '').toLowerCase();
  var usuario    = (params.usuario   || '').toLowerCase();
  var nombre     = (params.nombre    || '').toLowerCase();

  // Roles con acceso total
  var rolesAdmin = ['admin', 'admin01', 'admin02', 'rrhh'];
  var esAdmin    = rolesAdmin.indexOf(rol) !== -1;

  // Primer nombre para búsqueda parcial
  var primerNombre = nombre.split(' ')[0];

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function (h, j) { row[h] = data[i][j]; });

    // Filtros de columna
    if (empresa    && row.empresa !== empresa)    continue;
    if (motivo     && row.motivo  !== motivo)     continue;
    if (supervisor && String(row.supervisor || '').toLowerCase().indexOf(supervisor) === -1) continue;

    // Filtro de visibilidad por rol
    if (!esAdmin) {
      var supStr = String(row.supervisor    || '').toLowerCase();
      var regStr = String(row.registrado_por || '').toLowerCase();
      var usrStr = String(row.usuario_registro || '').toLowerCase();
      var visible = supStr.indexOf(primerNombre) !== -1 ||
                    regStr.indexOf(primerNombre) !== -1 ||
                    usrStr.indexOf(usuario)       !== -1;
      if (!visible) continue;
    }

    rows.push(row);
  }

  return { success: true, data: rows };
}

// ════════════════════════════════════════════════════════════
// EVALUACIÓN 360° — Gestión de supervisores y evaluaciones
// ════════════════════════════════════════════════════════════

var SHEET_EVAL360     = 'BB.DD-EVALUACIONES';
var SHEET_SUPS_EVAL   = 'SUPERVISORES_EVAL';

var COLS_EVAL360 = [
  'id','fecha_registro','supervisor','empresa','fecha_evaluacion','evaluador','evaluador_user',
  'promedio_global','porcentaje','clasificacion','observaciones',
  'comp_liderazgo','comp_comunicacion','comp_cumplimiento',
  'comp_gestion_equipo','comp_resolucion','comp_planificacion',
  'detalle_json'
];

function getSheetEval360() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName(SHEET_EVAL360);
  if (!sh) {
    sh = ss.insertSheet(SHEET_EVAL360);
    sh.getRange(1, 1, 1, COLS_EVAL360.length).setValues([COLS_EVAL360]);
    sh.setFrozenRows(1);
    Logger.log('Hoja ' + SHEET_EVAL360 + ' creada');
  }
  return sh;
}

function getSheetSupsEval() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName(SHEET_SUPS_EVAL);
  if (!sh) {
    sh = ss.insertSheet(SHEET_SUPS_EVAL);
    sh.getRange(1, 1, 1, 3).setValues([['nombre','empresa','sector']]);
    sh.setFrozenRows(1);
    Logger.log('Hoja ' + SHEET_SUPS_EVAL + ' creada');
  }
  return sh;
}

/**
 * Guarda una evaluación 360° en Google Sheets.
 * Evita duplicados por id.
 */
function saveEvaluacion360(params) {
  var sh = getSheetEval360();
  var id = String(params.id || '');
  if (!id) return { success: false, error: 'ID de evaluación requerido' };

  // Verificar duplicado
  var data = sh.getDataRange().getValues();
  var headers = data[0] || [];
  var idIdx = headers.indexOf('id');
  if (idIdx !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === id) {
        return { success: true, msg: 'Evaluación ya registrada', nro: i };
      }
    }
  }

  // Extraer promedios por competencia
  var comps = params.competencias || [];
  var getComp = function(nombre) {
    var c = comps.filter(function(x){ return x.nombre === nombre; })[0];
    return c ? parseFloat(c.promedio).toFixed(2) : '';
  };

  var fila = COLS_EVAL360.map(function(col) {
    switch(col) {
      case 'id':                return id;
      case 'fecha_registro':    return new Date().toISOString().split('T')[0];
      case 'supervisor':        return params.supervisor || '';
      case 'empresa':           return params.empresa || '';
      case 'fecha_evaluacion':  return params.fecha || '';
      case 'evaluador':         return params.evaluador || '';
      case 'evaluador_user':    return params.evaluadorUser || '';
      case 'promedio_global':   return params.promGlobal || '';
      case 'porcentaje':        return params.porcentaje || '';
      case 'clasificacion':     return params.clasificacion || '';
      case 'observaciones':     return params.obs || '';
      case 'comp_liderazgo':       return getComp('Liderazgo');
      case 'comp_comunicacion':    return getComp('Comunicación');
      case 'comp_cumplimiento':    return getComp('Cumplimiento');
      case 'comp_gestion_equipo':  return getComp('Gestión de Equipo');
      case 'comp_resolucion':      return getComp('Resolución de Problemas');
      case 'comp_planificacion':   return getComp('Planificación');
      case 'detalle_json':      return JSON.stringify(comps);
      default: return '';
    }
  });

  sh.appendRow(fila);
  Logger.log('Evaluación 360° guardada: ' + (params.supervisor || '') + ' id=' + id);
  return { success: true, id: id };
}

/**
 * Retorna todas las evaluaciones 360° guardadas.
 * Opcionalmente filtra por supervisor o empresa.
 */
function getEvaluaciones360(params) {
  var sh   = getSheetEval360();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [] };

  var headers    = data[0];
  var supervisor = (params.supervisor || '').toLowerCase();
  var empresa    = params.empresa || '';

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function(h, j) { row[h] = data[i][j]; });

    if (supervisor && String(row.supervisor || '').toLowerCase().indexOf(supervisor) === -1) continue;
    if (empresa    && row.empresa !== empresa) continue;

    // Reconstruir objeto compatible con localStorage
    var ev = {
      id:            String(row.id || ''),
      supervisor:    row.supervisor || '',
      empresa:       row.empresa    || '',
      fecha:         row.fecha_evaluacion || '',
      evaluador:     row.evaluador  || '',
      evaluadorUser: row.evaluador_user || '',
      promGlobal:    row.promedio_global || '',
      porcentaje:    parseInt(row.porcentaje) || 0,
      clasificacion: row.clasificacion || '',
      obs:           row.observaciones || '',
      fechaRegistro: row.fecha_registro || '',
      competencias:  []
    };
    // Parsear detalle JSON si existe
    try {
      if (row.detalle_json) ev.competencias = JSON.parse(row.detalle_json);
    } catch(e) {}

    rows.push(ev);
  }

  return { success: true, data: rows };
}

// ════════════════════════════════════════════════════════════
// Función de prueba (ejecutar manualmente para verificar config)
// ════════════════════════════════════════════════════════════
function testConexion() {
  try {
    var sh = getSheetCasos();
    Logger.log('Hoja encontrada: ' + sh.getName() + ' — filas: ' + sh.getLastRow());
    var folder = getRootRL();
    Logger.log('Carpeta raíz /rl encontrada: ' + folder.getName());
    Logger.log('Test OK');
  } catch (e) {
    Logger.log('Test FALLO: ' + e.message);
  }
}
