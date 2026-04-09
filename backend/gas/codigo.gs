// ============================================================
// Google Apps Script — Sistema RL v2
// Módulo: Registro de Casos
// ============================================================

// ── Configuración (ajustar antes de desplegar) ────────────────
var CONFIG = {
  SHEET_ID:        '1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw', // ID del Google Spreadsheet
  DRIVE_FOLDER_ID: '1gkdxFcHcJ7COW6r2h_0vlZ1KJEIk1PV-', // ID de la carpeta raíz en Drive
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
    if      (action === 'getCasos')              result = getCasos(p);
    else if (action === 'buscarTrabajador')     result = buscarTrabajador(p);
    else if (action === 'getEvaluaciones360')   result = getEvaluaciones360(p);
    else if (action === 'getAtenciones')        result = getAtenciones(p);
    else if (action === 'getEstadisticas')      result = getEstadisticas(p);
    else if (action === 'getEstadisticasAdmin') result = getEstadisticasAdmin(p);
    else if (action === 'getResumenGeneral')    result = getResumenGeneral(p);
    else if (action === 'consultaDNI')          result = consultaDNI(p);
    else if (action === 'getPreload')           result = getPreload(p);
    else if (action === 'getSupervisoresEval') result = getSupervisoresEval(p);
    else if (action === 'getReporteCorreo')    result = getReporteCorreo(p);
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
    else if (action === 'saveAtencion')      result = saveAtencion(body);
    else if (action === 'updateAtencion')    result = updateAtencion(body);
    else if (action === 'login')             result = login(body);
    else if (action === 'updateVisita')      result = updateVisita(body);
    else if (action === 'saveSupervisorEval') result = saveSupervisorEval(body);
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
// AUTH: Login
// ════════════════════════════════════════════════════════════

// Fundos asignados por supervisor (login los incluye en user)
var FUNDOS_SUPERVISOR = {
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

// Supervisores que atienden múltiples fundos → deben elegir fundo al ingresar
var SUP_MULTI = ['ptamayo', 'mmechato', 'rmolero'];

/**
 * Valida credenciales contra la hoja 'Usuarios'.
 * Columnas por índice (fila 1 = encabezado, datos desde fila 2):
 *   A(0):id  B(1):usuario  C(2):password  D(3):nombre
 *   E(4):rol  F(5):empresa  G(6):activo  H(7):fecha_creacion  I(8):correo
 *
 * @param {{usuario:string, password:string}} params
 * @returns {{success:boolean, user?:object, error?:string}}
 */
function login(params) {
  var usuario  = String(params.usuario  || '').trim().toLowerCase();
  var password = String(params.password || '').trim();

  if (!usuario || !password) {
    return { success: false, error: 'Usuario y contraseña son requeridos.' };
  }

  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName('Usuarios');
  if (!sh) {
    Logger.log('login: hoja Usuarios no encontrada');
    return { success: false, error: 'Configuración de usuarios no disponible.' };
  }

  var data = sh.getDataRange().getValues();
  if (data.length < 2) {
    return { success: false, error: 'No hay usuarios registrados.' };
  }

  // data[0] = encabezados, data[1..] = filas de datos
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var rowUsr = String(r[1] || '').trim().toLowerCase();

    if (rowUsr !== usuario) continue;

    // Verificar cuenta activa: columna G (índice 6)
    var activo = r[6];
    var estaActivo = (activo === true) || (String(activo).toUpperCase() === 'TRUE');
    if (!estaActivo) {
      return { success: false, error: 'Cuenta inactiva. Contacta al administrador.' };
    }

    // Verificar contraseña: columna C (índice 2)
    var rowPass = String(r[2] || '').trim();
    if (rowPass !== password) {
      return { success: false, error: 'Contraseña incorrecta.' };
    }

    // Credenciales correctas — construir objeto user
    var fundos           = FUNDOS_SUPERVISOR[usuario] || [];
    var necesitaElegirFundo = SUP_MULTI.indexOf(usuario) !== -1;

    var user = {
      usuario:             rowUsr,
      nombre:              String(r[3] || rowUsr),
      rol:                 String(r[4] || 'user').toLowerCase(),
      empresa:             String(r[5] || ''),
      correo:              String(r[8] || ''),
      fundos:              fundos,
      necesitaElegirFundo: necesitaElegirFundo
    };

    Logger.log('login OK: ' + rowUsr + ' | rol: ' + user.rol + ' | fundos: ' + fundos.join(', '));
    return { success: true, user: user };
  }

  return { success: false, error: 'Usuario no encontrado.' };
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

    // Alias explícitos para URLs de documentos — fuerza string para evitar
    // que Google Sheets devuelva Date u otros tipos no-string
    row.enlace_informe  = String(row.archivo_informe_url  || data[i][27] || '').trim();
    row.enlace_reporte  = String(row.archivo_descargo_url || data[i][29] || '').trim();
    // Normalizar también los campos originales
    row.archivo_informe_url  = row.enlace_informe;
    row.archivo_descargo_url = row.enlace_reporte;

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
// ATENCIONES — Hojas multi-año (Sistema RL v3.0)
// ════════════════════════════════════════════════════════════

var SHEET_AT_BASE  = 'BB. DE REGISTROS';
var SHEET_VISITAS  = 'BB. DE VISITAS';
var SHEET_FUSIONES = 'BB. DE FUSIONES';

// Años que tienen hoja propia. Ampliar cada 1 de enero.
var ANIOS_CON_HOJA = [2024, 2025, 2026];

var COLS_AT = [
  'nro', 'fecha_registro', 'fecha_atencion', 'hora_inicio', 'hora_termino',
  'nro_semana', 'mes', 'anio',
  'dni', 'nombre', 'sexo',
  'fecha_inicio_periodo', 'fecha_termino_periodo',
  'empresa', 'fundo', 'cargo', 'ruta', 'codigo', 'fundo_actual', 'celular',
  'detalle_documento', 'fecha_inicio_doc', 'fecha_termino_doc', 'dias_transcurridos',
  'responsable_recepcion', 'observaciones', 'estado', 'supervisor',
  'usuario_sistema', 'usuario_registro'
];

var ROLES_ADMIN_AT = ['admin', 'admin01', 'admin02', 'rrhh'];

// ─────────────────────────────────────────────────────────────
/**
 * matchSupervisor — convierte un nombre completo de supervisor
 * en su clave de usuario del sistema (username).
 * Útil para cruzar datos entre hojas con nombres distintos.
 * @param {string} nombreCompleto
 * @returns {string} username o el nombre original en minúsculas
 */
function matchSupervisor(nombreCompleto) {
  if (!nombreCompleto) return '';
  var s = String(nombreCompleto).toLowerCase().trim();
  var NOMBRES_MAP = {
    'tamayo':    'ptamayo',
    'tineo':     'atineo',
    'pulache':   'fpulache',
    'luzon':     'yluzon',
    'luzón':     'yluzon',
    'viera':     'sviera',
    'castro':    'ecastro',
    'martinez':  'almartinez',
    'martínez':  'almartinez',
    'zapata':    'fzapata',
    'molero':    'rmolero',
    'mechato':   'mmechato',
    'avendano':  'javendano',
    'avendaño':  'javendano',
    'siancas':   'jsiancas',
    'miranda':   'smiranda',
    'vilela':    'ovilela',
    'chavez':    'jchavez',
    'chávez':    'jchavez',
    'timoteo':   'jtimoteo'
  };
  var keys = Object.keys(NOMBRES_MAP);
  for (var i = 0; i < keys.length; i++) {
    if (s.indexOf(keys[i]) !== -1) return NOMBRES_MAP[keys[i]];
  }
  return s;
}

// ── Helpers de fecha ──────────────────────────────────────────
function _hoyStr() {
  return new Date().toISOString().split('T')[0];
}
function _pad2(n) {
  return n < 10 ? '0' + n : String(n);
}
function _nroSemana(fecha) {
  var inicio = new Date(fecha.getFullYear(), 0, 1);
  var dias   = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}
function _strInicio(s, prefix) {
  return String(s || '').indexOf(prefix) === 0;
}

// ─────────────────────────────────────────────────────────────
/**
 * Retorna la hoja de atenciones del año indicado.
 * Si no existe la hoja del año → usa 'BB. DE REGISTROS' como respaldo.
 * @param {string|number|null} anio  null = año actual
 * @returns {Sheet|null}
 */
function getSheetAnio(anio) {
  var ss         = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var target     = anio ? Number(anio) : new Date().getFullYear();
  var nombreAnio = SHEET_AT_BASE + ' ' + target;

  var sh = ss.getSheetByName(nombreAnio);
  if (sh) return sh;

  // Respaldo: hoja base sin sufijo
  var shBase = ss.getSheetByName(SHEET_AT_BASE);
  if (shBase) {
    Logger.log('getSheetAnio: ' + nombreAnio + ' no existe → usando ' + SHEET_AT_BASE);
    return shBase;
  }

  Logger.log('getSheetAnio: no se encontró hoja para año ' + target);
  return null;
}

/**
 * Obtiene o crea la hoja 'BB. DE REGISTROS {anio}' con headers.
 */
function _getOCrearSheetAnio(anio) {
  var ss     = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var nombre = SHEET_AT_BASE + ' ' + anio;
  var sh     = ss.getSheetByName(nombre);
  if (sh) return sh;
  sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, COLS_AT.length).setValues([COLS_AT]);
  sh.setFrozenRows(1);
  Logger.log('Creada hoja: ' + nombre);
  return sh;
}

/**
 * Retorna [{anio, sh}] para cada año en ANIOS_CON_HOJA cuya hoja exista.
 */
function _todasLasHojas() {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var result = [];
  ANIOS_CON_HOJA.forEach(function (a) {
    var sh = ss.getSheetByName(SHEET_AT_BASE + ' ' + a);
    if (sh) result.push({ anio: a, sh: sh });
  });
  return result;
}

/**
 * Lee todas las filas de una hoja de atenciones aplicando filtros de
 * empresa y visibilidad por rol.
 */
function _leerAtenciones(sh, filtros) {
  filtros = filtros || {};
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers   = data[0];
  var empresa   = filtros.empresa  || '';
  var esAdmin   = filtros.esAdmin  || false;
  var usuario   = (filtros.usuario || '').toLowerCase();
  var nombre    = (filtros.nombre  || '').toLowerCase();
  var primerNom = nombre.split(' ')[0];

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function (h, j) { row[h] = data[i][j]; });

    if (empresa && empresa !== 'AMBAS' && row.empresa !== empresa) continue;

    if (!esAdmin) {
      var supStr = String(row.supervisor       || '').toLowerCase();
      var usrStr = String(row.usuario_sistema  || '').toLowerCase();
      var regStr = String(row.usuario_registro || '').toLowerCase();
      if (
        supStr.indexOf(primerNom) === -1 &&
        usrStr.indexOf(usuario)   === -1 &&
        regStr.indexOf(usuario)   === -1
      ) continue;
    }

    rows.push(row);
  }
  return rows;
}

/**
 * Lee filas de cualquier hoja con filtros opcionales de empresa y supervisor.
 */
function _leerFilasSheet(sh, empresa, sup) {
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function (h, j) { row[h] = data[i][j]; });
    if (empresa && empresa !== 'AMBAS' && row.empresa !== empresa) continue;
    if (sup) {
      var supVal = String(row.supervisor || '').toLowerCase();
      if (supVal.indexOf(sup) === -1) continue;
    }
    rows.push(row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
/**
 * getAtenciones — retorna atenciones con soporte multi-año.
 * p.historial = 'todos'|true  → combina todas las hojas
 * p.anio                      → hoja del año específico
 * (default)                   → hoja del año actual
 */
function getAtenciones(p) {
  var esAdmin = ROLES_ADMIN_AT.indexOf((p.rol || '').toLowerCase()) !== -1;
  var filtros = { empresa: p.empresa, esAdmin: esAdmin, usuario: p.usuario, nombre: p.nombre };
  var historial = p.historial;
  var todasHojas = (historial === 'todos' || historial === 'true' || historial === true);

  if (todasHojas) {
    var todas = _todasLasHojas();
    if (todas.length === 0) {
      var shFb = getSheetAnio(null);
      return shFb ? { success: true, data: _leerAtenciones(shFb, filtros) }
                  : { success: false, error: 'No se encontró la hoja de atenciones' };
    }
    var acum = [];
    todas.forEach(function (x) { acum = acum.concat(_leerAtenciones(x.sh, filtros)); });
    return { success: true, data: acum };
  }

  var sh = p.anio ? getSheetAnio(p.anio) : getSheetAnio(null);
  if (!sh) return { success: false, error: 'Hoja de atenciones no encontrada' };
  return { success: true, data: _leerAtenciones(sh, filtros) };
}

/**
 * saveAtencion — guarda en la hoja del año actual.
 * En enero crea automáticamente la hoja del año siguiente.
 */
function saveAtencion(params) {
  var hoy        = new Date();
  var anio       = hoy.getFullYear();
  var mes        = hoy.getMonth() + 1;
  var nombreHoja = SHEET_AT_BASE + ' ' + anio; // 'BB. DE REGISTROS 2026'

  // Obtiene o crea 'BB. DE REGISTROS {anio}' — NUNCA usa la hoja base como destino
  var sh = _getOCrearSheetAnio(anio);
  if (!sh) throw new Error('No se pudo obtener ni crear la hoja "' + nombreHoja + '"');
  if (sh.getName() !== nombreHoja) {
    throw new Error('Hoja incorrecta: se obtuvo "' + sh.getName() + '" pero se esperaba "' + nombreHoja + '"');
  }

  var nro = sh.getLastRow(); // fila 1 = headers → primer registro nro=1

  var fechaAt    = params.fecha_atencion ? new Date(params.fecha_atencion + 'T12:00:00') : hoy;
  var semana     = _nroSemana(fechaAt);
  var fechaHoyS  = hoy.toISOString().split('T')[0];

  var fila = COLS_AT.map(function (col) {
    switch (col) {
      case 'nro':              return nro;
      case 'fecha_registro':   return fechaHoyS;
      case 'nro_semana':       return semana;
      case 'mes':              return mes;
      case 'anio':             return anio;
      case 'usuario_registro': return params.registrado_por || params.usuario_sistema || '';
      default:
        var v = params[col];
        return (v !== undefined && v !== null) ? v : '';
    }
  });

  sh.appendRow(fila);
  Logger.log('[saveAtencion] OK — N°' + nro + ' guardado en "' + sh.getName() + '" (' + (params.nombre || '') + ')');

  // Pre-crear hoja del año siguiente en enero para evitar demora
  if (mes === 1) {
    var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var proxAnio = anio + 1;
    if (!ss.getSheetByName(SHEET_AT_BASE + ' ' + proxAnio)) {
      _getOCrearSheetAnio(proxAnio);
      Logger.log('[saveAtencion] Pre-creada hoja para ' + proxAnio);
    }
  }

  return {
    success:        true,
    nro:            nro,
    anio:           anio,
    mes:            mes,
    nro_semana:     semana,
    fecha_registro: fechaHoyS,
    hoja:           sh.getName()
  };
}

/**
 * updateAtencion — actualiza una atención por nro.
 * Busca primero en año actual, luego en años anteriores.
 */
function updateAtencion(params) {
  var esAdmin     = ROLES_ADMIN_AT.indexOf((params.rol || '').toLowerCase()) !== -1;
  var nro         = String(params.nro);
  var anioActual  = new Date().getFullYear();

  // Hojas a buscar: año actual primero, luego históricos en orden descendente
  var sheetsABuscar = [];
  var shActual = getSheetAnio(null);
  if (shActual) sheetsABuscar.push(shActual);
  for (var ai = ANIOS_CON_HOJA.length - 1; ai >= 0; ai--) {
    if (ANIOS_CON_HOJA[ai] !== anioActual) {
      var shHist = getSheetAnio(ANIOS_CON_HOJA[ai]);
      if (shHist) sheetsABuscar.push(shHist);
    }
  }

  for (var s = 0; s < sheetsABuscar.length; s++) {
    var sh      = sheetsABuscar[s];
    var data    = sh.getDataRange().getValues();
    var headers = data[0];
    var nroIdx  = headers.indexOf('nro');
    if (nroIdx === -1) continue;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][nroIdx]) !== nro) continue;

      // Verificar permiso
      if (!esAdmin) {
        var sup = String(data[i][headers.indexOf('supervisor')]      || '').toLowerCase();
        var usr = String(data[i][headers.indexOf('usuario_sistema')] || '').toLowerCase();
        var reg = String(data[i][headers.indexOf('usuario_registro')]|| '').toLowerCase();
        var me  = (params.usuario || '').toLowerCase();
        if (sup !== me && usr !== me && reg !== me) {
          return { success: false, error: 'No tienes permiso para editar esta atención' };
        }
      }

      // Actualizar campos (no tocar nro ni fecha_registro)
      COLS_AT.forEach(function (col, j) {
        if (col === 'nro' || col === 'fecha_registro') return;
        var val = params[col];
        if (val !== undefined && val !== null && val !== '') {
          sh.getRange(i + 1, j + 1).setValue(val);
        }
      });
      Logger.log('Atención actualizada N°' + nro);
      return { success: true, nro: nro };
    }
  }

  return { success: false, error: 'Atención N° ' + nro + ' no encontrada' };
}

/**
 * getEstadisticas — conteos por período para el usuario/rol.
 * p.anio → hoja específica (default: año actual)
 */
function getEstadisticas(p) {
  var esAdmin = ROLES_ADMIN_AT.indexOf((p.rol || '').toLowerCase()) !== -1;
  var filtros = { empresa: p.empresa, esAdmin: esAdmin, usuario: p.usuario, nombre: p.nombre };
  var sh = p.anio ? getSheetAnio(p.anio) : getSheetAnio(null);
  if (!sh) return { success: false, error: 'Hoja de atenciones no encontrada' };

  var ats  = _leerAtenciones(sh, filtros);
  var hoy  = _hoyStr();
  var mesS = hoy.substring(0, 7);

  var stats = { hoy: 0, mes: 0, anio: ats.length, pendientes: 0, porMes: {}, porEstado: {} };
  ats.forEach(function (a) {
    var fa  = String(a.fecha_atencion || '');
    var est = String(a.estado || '').toUpperCase();
    if (fa === hoy)                  stats.hoy++;
    if (_strInicio(fa, mesS))        stats.mes++;
    if (est === 'PENDIENTE')         stats.pendientes++;
    var ym = fa.substring(0, 7);
    if (ym) stats.porMes[ym] = (stats.porMes[ym] || 0) + 1;
    stats.porEstado[est] = (stats.porEstado[est] || 0) + 1;
  });

  return { success: true, data: stats };
}

/**
 * getEstadisticasAdmin — stats completas: módulos, por supervisor y tendencia 6 meses.
 */
function getEstadisticasAdmin(p) {
  var ss      = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var empresa = p.empresa    || '';
  var sup     = (p.supervisor || '').toLowerCase();
  var mesStr  = _hoyStr().substring(0, 7);

  // Atenciones: solo hoja del año solicitado (default = año actual)
  // Si p.anio está vacío o no viene → leer solo BB. DE REGISTROS 2026
  var shAt = p.anio ? getSheetAnio(p.anio) : getSheetAnio(null);
  var ats  = shAt ? _leerFilasSheet(shAt, empresa, sup) : [];

  // Visitas
  var shVis = ss.getSheetByName(SHEET_VISITAS);
  var vis   = shVis ? _leerFilasSheet(shVis, empresa, sup) : [];

  // Casos
  var cas = [];
  try {
    var casRes = getCasos({ empresa: empresa, rol: 'admin', supervisor: sup });
    if (casRes.success) cas = casRes.data;
  } catch(e) { Logger.log('getEstadisticasAdmin-casos: ' + e.message); }

  // Fusiones
  var shFus = ss.getSheetByName(SHEET_FUSIONES);
  var fus   = shFus ? _leerFilasSheet(shFus, empresa, sup) : [];

  // ── Stats globales ─────────────────────────────────────
  function estCount(arr, campo, val) {
    return arr.filter(function(r){ return String(r[campo]||'').toUpperCase()===val; }).length;
  }
  function mesCount(arr, campo) {
    return arr.filter(function(r){ return _strInicio(String(r[campo]||''), mesStr); }).length;
  }

  var stats = {
    atenciones: {
      total:      ats.length,
      pendientes: estCount(ats, 'estado', 'PENDIENTE'),
      enProceso:  estCount(ats, 'estado', 'EN PROCESO'),
      resueltos:  estCount(ats, 'estado', 'RESUELTO'),
      esteMes:    mesCount(ats, 'fecha_atencion')
    },
    visitas: {
      total:      vis.length,
      enPlazo:    estCount(vis, 'estado_plazo', 'EN PLAZO'),
      retrasadas: estCount(vis, 'estado_plazo', 'RETRASADA'),
      esteMes:    mesCount(vis, 'fecha_visita')
    },
    casos: {
      total:      cas.length,
      enPlazo:    estCount(cas, 'estado_plazo', 'EN PLAZO'),
      retrasados: estCount(cas, 'estado_plazo', 'RETRASADO'),
      esteMes:    mesCount(cas, 'fecha_reporte')
    },
    fusiones: {
      total:        fus.length,
      pendientes:   estCount(fus, 'estado', 'PENDIENTE'),
      validados:    estCount(fus, 'estado', 'VALIDADO'),
      esteMes:      mesCount(fus, 'fecha'),
      trabajadores: fus.reduce(function(acc,f){ return acc + (parseInt(f.trabajadores||f.cantidad||0)||0); }, 0)
    }
  };

  // ── Por supervisor ─────────────────────────────────────
  var porSupervisor = {};

  function agrupar(registros, modulo, campoFechaMes) {
    registros.forEach(function (r) {
      var k = String(r.supervisor || '— sin supervisor —').toLowerCase().trim();
      if (!porSupervisor[k]) {
        porSupervisor[k] = {
          nombre:       r.supervisor || '— sin supervisor —',
          atenciones:   0, atPendientes: 0, atResueltos: 0,
          visitas:      0, viRetrasadas: 0,
          casos:        0, caRetrasados: 0,
          fusiones:     0
        };
      }
      var ps  = porSupervisor[k];
      var est = String(r.estado || r.estado_plazo || '').toUpperCase();
      if (modulo === 'at') {
        ps.atenciones++;
        if (est === 'PENDIENTE') ps.atPendientes++;
        if (est === 'RESUELTO')  ps.atResueltos++;
      } else if (modulo === 'vis') {
        ps.visitas++;
        if (est === 'RETRASADA') ps.viRetrasadas++;
      } else if (modulo === 'cas') {
        ps.casos++;
        if (est === 'RETRASADO') ps.caRetrasados++;
      } else if (modulo === 'fus') {
        ps.fusiones++;
      }
    });
  }

  agrupar(ats, 'at',  'fecha_atencion');
  agrupar(vis, 'vis', 'fecha_visita');
  agrupar(cas, 'cas', 'fecha_reporte');
  agrupar(fus, 'fus', 'fecha');

  // ── Tendencia últimos 6 meses ──────────────────────────
  var tendencia = [];
  for (var i = 5; i >= 0; i--) {
    var d  = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    var ym = d.getFullYear() + '-' + _pad2(d.getMonth() + 1);
    var lbl = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth() + 1]
              + ' ' + d.getFullYear();
    tendencia.push({
      label:      lbl,
      atenciones: ats.filter(function(a){ return _strInicio(String(a.fecha_atencion||''), ym); }).length,
      visitas:    vis.filter(function(v){ return _strInicio(String(v.fecha_visita||v.fecha||''), ym); }).length,
      casos:      cas.filter(function(c){ return _strInicio(String(c.fecha_reporte||c.fecha_registro||''), ym); }).length,
      fusiones:   fus.filter(function(f){ return _strInicio(String(f.fecha||''), ym); }).length
    });
  }

  return { success: true, data: { stats: stats, porSupervisor: porSupervisor, tendencia: tendencia } };
}

/**
 * getResumenGeneral — lista de atenciones + totales por supervisor.
 * p.anio = 'todos' → todas las hojas (solo admins deben llamarlo así)
 * p.anio = año     → hoja específica
 * (default)        → año actual
 */
function getResumenGeneral(p) {
  var lista;
  if (p.anio === 'todos') {
    var todas = _todasLasHojas();
    lista = [];
    todas.forEach(function (x) { lista = lista.concat(_leerFilasSheet(x.sh, p.empresa || '', '')); });
  } else {
    var sh = p.anio ? getSheetAnio(p.anio) : getSheetAnio(null);
    if (!sh) return { success: false, error: 'Hoja no encontrada' };
    lista = _leerFilasSheet(sh, p.empresa || '', '');
  }

  // Filtro por mes si viene
  if (p.mes) {
    var mesN = parseInt(p.mes);
    lista = lista.filter(function (a) {
      var m = parseInt((String(a.fecha_atencion || '').split('-')[1] || '0'));
      return m === mesN;
    });
  }

  // Agrupar por supervisor
  var ps = {};
  lista.forEach(function (a) {
    var k = String(a.supervisor || '— sin supervisor —').toLowerCase().trim();
    if (!ps[k]) ps[k] = { nombre: a.supervisor || '— sin supervisor —', total: 0, pendientes: 0, enProceso: 0, resueltos: 0 };
    ps[k].total++;
    var est = String(a.estado || '').toUpperCase();
    if (est === 'PENDIENTE')  ps[k].pendientes++;
    if (est === 'EN PROCESO') ps[k].enProceso++;
    if (est === 'RESUELTO')   ps[k].resueltos++;
  });

  return { success: true, data: { lista: lista, porSupervisor: ps } };
}

/**
 * consultaDNI — historial de atenciones por DNI.
 * p.anio = 'todos' → busca en todos los años (solo admins)
 * p.anio = año     → hoja específica
 * (default)        → año actual
 */
function consultaDNI(p) {
  var esAdmin = ROLES_ADMIN_AT.indexOf((p.rol || '').toLowerCase()) !== -1;
  var dni     = String(p.dni || '').trim();
  if (!dni) return { success: false, error: 'DNI requerido' };

  var buscarTodos = (p.anio === 'todos') && esAdmin;
  var resultados  = [];

  function _buscarEnSheet(sh) {
    var data    = sh.getDataRange().getValues();
    if (data.length < 2) return;
    var headers = data[0];
    var dniIdx  = headers.indexOf('dni');
    if (dniIdx === -1) return;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][dniIdx]) === dni) {
        var row = {};
        headers.forEach(function (h, j) { row[h] = data[i][j]; });
        resultados.push(row);
      }
    }
  }

  if (buscarTodos) {
    _todasLasHojas().forEach(function (x) { _buscarEnSheet(x.sh); });
  } else {
    var sh = p.anio ? getSheetAnio(p.anio) : getSheetAnio(null);
    if (!sh) return { success: false, error: 'Hoja no encontrada' };
    _buscarEnSheet(sh);
  }

  var trabajador = resultados.length > 0 ? {
    dni:     resultados[0].dni,
    nombre:  resultados[0].nombre,
    sexo:    resultados[0].sexo,
    empresa: resultados[0].empresa,
    cargo:   resultados[0].cargo,
    fundo:   resultados[0].fundo
  } : null;

  return { success: true, data: resultados, trabajador: trabajador };
}

/**
 * getPreload — carga inicial del dashboard.
 * Lee solo 'BB. DE REGISTROS {año actual}' para máxima velocidad.
 * Retorna el objeto CACHE completo: atenciones, visitas, casos, fusiones.
 */
function getPreload(p) {
  var esAdmin = ROLES_ADMIN_AT.indexOf((p.rol || '').toLowerCase()) !== -1;
  var filtros = { empresa: p.empresa, esAdmin: esAdmin, usuario: p.usuario, nombre: p.nombre };
  var ss      = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  // Atenciones: solo año actual
  var shAt = getSheetAnio(null);
  var ats  = shAt ? _leerAtenciones(shAt, filtros) : [];

  // Visitas
  var vis   = [];
  var shVis = ss.getSheetByName(SHEET_VISITAS);
  if (shVis) {
    var supFilt = esAdmin ? '' : (p.nombre || p.usuario || '');
    vis = _leerFilasSheet(shVis, p.empresa || '', supFilt);
  }

  // Casos
  var cas = [];
  try {
    var casRes = getCasos({ empresa: p.empresa || '', rol: p.rol, usuario: p.usuario, nombre: p.nombre });
    if (casRes.success) cas = casRes.data;
  } catch(e) { Logger.log('getPreload-casos: ' + e.message); }

  // Fusiones
  var fus   = [];
  var shFus = ss.getSheetByName(SHEET_FUSIONES);
  if (shFus) {
    var supFiltF = esAdmin ? '' : (p.nombre || p.usuario || '');
    fus = _leerFilasSheet(shFus, p.empresa || '', supFiltF);
  }

  // Stats admin (solo si es admin, en segundo plano al precargar)
  var estadisticasAdmin = null;
  if (esAdmin) {
    try {
      var admRes = getEstadisticasAdmin({ empresa: p.empresa || '', supervisor: '' });
      if (admRes.success) estadisticasAdmin = admRes.data;
    } catch(e) { Logger.log('getPreload-estadisticasAdmin: ' + e.message); }
  }

  var cache = { atenciones: ats, visitas: vis, casos: cas, fusiones: fus };
  if (estadisticasAdmin) cache.estadisticasAdmin = estadisticasAdmin;

  Logger.log('getPreload: at=' + ats.length + ' vis=' + vis.length + ' cas=' + cas.length + ' fus=' + fus.length);
  return { success: true, data: cache };
}

// ════════════════════════════════════════════════════════════
// VISITAS — updateVisita
// ════════════════════════════════════════════════════════════

/**
 * updateVisita — actualiza una visita en 'BB. DE VISITAS' por nro.
 * No sobrescribe nro ni fecha_registro.
 */
function updateVisita(params) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sh = ss.getSheetByName(SHEET_VISITAS);
  if (!sh) return { success: false, error: 'Hoja BB. DE VISITAS no encontrada' };

  var nro = String(params.nro || '');
  if (!nro) return { success: false, error: 'Parámetro nro requerido' };

  var data    = sh.getDataRange().getValues();
  var headers = data[0];
  var nroIdx  = headers.indexOf('nro');
  if (nroIdx === -1) return { success: false, error: 'Columna nro no encontrada en BB. DE VISITAS' };

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nroIdx]) !== nro) continue;

    headers.forEach(function (col, j) {
      if (col === 'nro' || col === 'fecha_registro') return;
      var val = params[col];
      if (val !== undefined && val !== null && val !== '') {
        sh.getRange(i + 1, j + 1).setValue(val);
      }
    });

    Logger.log('[updateVisita] Visita N°' + nro + ' actualizada');
    return { success: true, nro: nro };
  }

  return { success: false, error: 'Visita N° ' + nro + ' no encontrada' };
}

// ════════════════════════════════════════════════════════════
// EVALUACIÓN 360° — Supervisores evaluables
// ════════════════════════════════════════════════════════════

/**
 * getSupervisoresEval — lista de supervisores del sheet SUPERVISORES_EVAL.
 * Filtra por empresa si se proporciona.
 */
function getSupervisoresEval(params) {
  var sh   = getSheetSupsEval();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [] };

  var headers = data[0];
  var empresa = params.empresa || '';
  var rows    = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function (h, j) { row[h] = data[i][j]; });
    if (!row.nombre) continue;
    if (empresa && row.empresa && row.empresa !== empresa) continue;
    rows.push(row);
  }

  return { success: true, data: rows };
}

/**
 * saveSupervisorEval — agrega un supervisor a SUPERVISORES_EVAL.
 * Evita duplicados por nombre.
 * Parámetros: nombre, empresa, sector
 */
function saveSupervisorEval(params) {
  var nombre = String(params.nombre || '').trim();
  if (!nombre) return { success: false, error: 'Nombre de supervisor requerido' };

  var sh      = getSheetSupsEval();
  var data    = sh.getDataRange().getValues();
  var headers = data[0] || ['nombre', 'empresa', 'sector'];
  var nomIdx  = headers.indexOf('nombre');

  // Verificar duplicado
  if (nomIdx !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][nomIdx]).trim().toLowerCase() === nombre.toLowerCase()) {
        return { success: true, msg: 'Supervisor ya registrado', nro: i };
      }
    }
  }

  sh.appendRow([nombre, params.empresa || '', params.sector || '']);
  Logger.log('[saveSupervisorEval] Guardado: ' + nombre);
  return { success: true, nombre: nombre };
}

// ════════════════════════════════════════════════════════════
// TRABAJADORES — buscarTrabajador
// ════════════════════════════════════════════════════════════

/**
 * buscarTrabajador — busca trabajadores en la hoja 'TRABAJADORES'
 * por DNI o nombre parcial.
 * Parámetros: q (DNI o nombre), empresa ('RAPEL'|'VERFRUT'|'AMBAS')
 */
function buscarTrabajador(params) {
  var ss      = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var q       = String(params.q || '').trim().toLowerCase();
  var empresa = (params.empresa || '').toUpperCase();

  // Determinar qué hojas leer según empresa solicitada
  var nombreHojas = [];
  if (empresa === 'RAPEL') {
    nombreHojas = ['Trabajadores_RAPEL'];
  } else if (empresa === 'VERFRUT') {
    nombreHojas = ['Trabajadores_VERFRUT'];
  } else {
    // AMBAS u omitido → buscar en ambas hojas
    nombreHojas = ['Trabajadores_RAPEL', 'Trabajadores_VERFRUT'];
  }

  var rows = [];

  nombreHojas.forEach(function (nombreHoja) {
    var sh = ss.getSheetByName(nombreHoja);
    if (!sh) {
      Logger.log('[buscarTrabajador] Hoja no encontrada: ' + nombreHoja);
      return;
    }

    var data = sh.getDataRange().getValues();
    if (data.length < 2) return;

    var headers = data[0];

    for (var i = 1; i < data.length; i++) {
      if (rows.length >= 50) break; // Límite global de resultados

      var row = {};
      headers.forEach(function (h, j) { row[h] = data[i][j]; });

      // Filtro búsqueda por DNI o nombre
      if (q) {
        var dni    = String(row.dni    || '').toLowerCase();
        var nombre = String(row.nombre || '').toLowerCase();
        if (dni.indexOf(q) === -1 && nombre.indexOf(q) === -1) continue;
      }

      rows.push(row);
    }
  });

  return { success: true, data: rows };
}

// ════════════════════════════════════════════════════════════
// REPORTE CORREO — getReporteCorreo
// ════════════════════════════════════════════════════════════

/**
 * Busca atenciones en 'BB. DE REGISTROS {año}' primero,
 * luego en 'BB. DE REGISTROS' como fallback.
 * Params: fecha_inicio, fecha_fin, empresa, responsables (CSV)
 */
function getReporteCorreo(p) {
  var fi          = p.fecha_inicio || '';
  var ff          = p.fecha_fin    || '';
  var empresa     = p.empresa      || '';
  var respFiltro  = p.responsables
    ? p.responsables.split(',').map(function(r){ return r.trim(); }).filter(function(r){ return r; })
    : [];

  var ss   = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var anio = new Date().getFullYear();
  var sh   = ss.getSheetByName(SHEET_AT_BASE + ' ' + anio);
  if (!sh) sh = ss.getSheetByName(SHEET_AT_BASE); // fallback
  if (!sh) return { success: false, error: 'Hoja de registros no encontrada' };

  Logger.log('[getReporteCorreo] Leyendo hoja: ' + sh.getName());

  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { success: true, data: [], resumen: [], total: 0 };

  var headers = data[0];
  var rows    = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function(h, j) { row[h] = data[i][j]; });

    var fa = String(row.fecha_atencion || '');
    if (fi && fa < fi) continue;
    if (ff && fa > ff) continue;
    if (empresa && empresa !== 'AMBAS' && row.empresa !== empresa) continue;
    if (respFiltro.length > 0) {
      var resp = String(row.responsable_recepcion || '').trim();
      if (respFiltro.indexOf(resp) === -1) continue;
    }

    rows.push(row);
  }

  // Calcular resumen agrupado
  var resumenMap = {};
  rows.forEach(function(r) {
    var k = (r.empresa||'') + '|' + (r.detalle_documento||'') + '|' + (r.responsable_recepcion||'');
    if (!resumenMap[k]) {
      resumenMap[k] = {
        empresa:     r.empresa              || '',
        tipo:        r.detalle_documento    || '—',
        responsable: r.responsable_recepcion|| '—',
        cantidad:    0
      };
    }
    resumenMap[k].cantidad++;
  });
  var resumen = [];
  for (var k in resumenMap) { if (resumenMap.hasOwnProperty(k)) resumen.push(resumenMap[k]); }

  return { success: true, data: rows, resumen: resumen, total: rows.length };
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
