/************************************************************************
 * COPIAS DE SEGURIDAD AUTOMÁTICAS — Sistemas VERFRUT / RAPEL
 * ----------------------------------------------------------------------
 * Respalda cada día, sin intervención manual:
 *   1) Las hojas de cálculo (copia completa en Google Drive)
 *   2) La nube Firestore de los sistemas ETI (JSON por colección)
 *   3) El canal RTDB de RR.LL: presencia, mensajes e historial (JSON)
 *
 * Todo queda en la carpeta de Drive "Backups Sistemas VERFRUT",
 * en subcarpetas por fecha (Backup 2026-07-25). Los respaldos con más
 * de BK_DIAS_CONSERVAR días se mueven solos a la papelera.
 *
 * INSTALACIÓN (una sola vez):
 *   1. Entra a script.google.com con tu cuenta y crea un proyecto nuevo
 *      (o pégalo en el mismo proyecto del reporte semanal).
 *   2. Pega este archivo completo.
 *   3. (Opcional) Completa los IDs de las hojas de Bienestar y de
 *      Evaluaciones ETI en BK_HOJAS (el ID es la parte larga de la URL
 *      de la hoja, entre /d/ y /edit). Si quedan vacíos, se omiten.
 *   4. Ejecuta una vez la función  instalarDisparadorBackup  (botón ▶).
 *      Autoriza los permisos cuando lo pida.
 *   5. Listo: correrá todos los días a las 3 am. Para probar ya mismo,
 *      ejecuta  ejecutarBackupAhora  y revisa tu Drive.
 ************************************************************************/

var BK_CORREO = 'joel.timoteog@gmail.com';   // avisos (errores y resumen de los lunes)
var BK_CARPETA = 'Backups Sistemas VERFRUT';
var BK_DIAS_CONSERVAR = 60;

// Hojas de cálculo a respaldar (deja id:'' para omitir una)
var BK_HOJAS = [
  { nombre: 'Sistema RRLL',              id: '1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw' },
  { nombre: 'Bienestar Social',          id: '' },   // ← pega aquí el ID de la hoja de Bienestar
  { nombre: 'Registros Evaluaciones ETI', id: '' }   // ← pega aquí el ID de la hoja de Evaluaciones (opcional)
];

// Nube Firestore de los sistemas ETI
var BK_FS_PROYECTO = 'sistema-eti-verfrut';
var BK_FS_APIKEY   = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
var BK_FS_COLECCIONES = ['evaluaciones_conocimiento', 'programaciones_eval',
                         'capacitaciones', 'supervisores_eti', 'programaciones_eti', 'usuarios_eti'];

// Canal RTDB del Sistema RR.LL
var BK_RTDB_URL   = 'https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
var BK_RTDB_RUTAS = ['presencia', 'mensajes', 'historial'];

/** Crea el disparador diario (ejecutar UNA vez). */
function instalarDisparadorBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ejecutarBackupAhora') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ejecutarBackupAhora').timeBased().everyDays(1).atHour(3).create();
  Logger.log('✅ Disparador instalado: backup diario a las 3 am. Prueba ahora con ejecutarBackupAhora().');
}

/** Ejecuta el respaldo completo (también sirve para probar manualmente). */
function ejecutarBackupAhora() {
  var inicio = new Date();
  var resumen = [];
  var errores = [];
  var zona = 'GMT-5';
  var fechaTxt = Utilities.formatDate(inicio, zona, 'yyyy-MM-dd');

  try {
    var raiz = bkCarpetaRaiz_();
    var carpetaDia = bkSubcarpeta_(raiz, 'Backup ' + fechaTxt);

    // ── 1) Hojas de cálculo ──
    BK_HOJAS.forEach(function (h) {
      if (!h.id) return;
      try {
        var archivo = DriveApp.getFileById(h.id);
        archivo.makeCopy(h.nombre + ' — copia ' + fechaTxt, carpetaDia);
        resumen.push('📄 Hoja "' + h.nombre + '": copiada');
      } catch (e) {
        errores.push('Hoja "' + h.nombre + '": ' + e);
      }
    });

    // ── 2) Firestore (sistemas ETI) ──
    BK_FS_COLECCIONES.forEach(function (col) {
      try {
        var docs = bkFirestoreColeccion_(col);
        carpetaDia.createFile(col + '.json', JSON.stringify(docs, null, 1), 'application/json');
        resumen.push('☁️ Firestore "' + col + '": ' + docs.length + ' registros');
      } catch (e) {
        errores.push('Firestore "' + col + '": ' + e);
      }
    });

    // ── 3) RTDB RR.LL (presencia / mensajes / historial) ──
    BK_RTDB_RUTAS.forEach(function (ruta) {
      try {
        var r = UrlFetchApp.fetch(BK_RTDB_URL + '/' + ruta + '.json', { muteHttpExceptions: true });
        if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
        var texto = r.getContentText() || 'null';
        carpetaDia.createFile('rtdb_' + ruta + '.json', texto, 'application/json');
        resumen.push('💬 RTDB "' + ruta + '": ' + Math.round(texto.length / 1024) + ' KB');
      } catch (e) {
        errores.push('RTDB "' + ruta + '": ' + e);
      }
    });

    // ── 4) Limpieza de respaldos antiguos ──
    var borrados = bkLimpiarAntiguos_(raiz);
    if (borrados) resumen.push('🧹 Respaldos antiguos movidos a papelera: ' + borrados);

  } catch (eGeneral) {
    errores.push('Error general: ' + eGeneral);
  }

  var duracion = Math.round((new Date() - inicio) / 1000);
  Logger.log('Backup terminado en ' + duracion + ' s\n' + resumen.join('\n') +
             (errores.length ? '\nERRORES:\n' + errores.join('\n') : ''));

  // Correo: siempre si hubo errores; resumen de confirmación solo los lunes
  var esLunes = (new Date().getDay() === 1);
  if (errores.length || esLunes) {
    var asunto = errores.length
      ? '⚠️ Backup Sistemas VERFRUT — con errores (' + fechaTxt + ')'
      : '✅ Backup Sistemas VERFRUT — todo correcto (' + fechaTxt + ')';
    var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0a2540">' +
      '<h2 style="margin:0 0 10px">' + asunto + '</h2>' +
      '<p>Copia de seguridad diaria (' + duracion + ' s). Carpeta en Drive: <b>' + BK_CARPETA + ' / Backup ' + fechaTxt + '</b></p>' +
      '<ul><li>' + resumen.join('</li><li>') + '</li></ul>' +
      (errores.length ? '<p style="color:#b91c1c"><b>Errores:</b></p><ul><li>' + errores.join('</li><li>') + '</li></ul>' : '') +
      '<p style="color:#64748b;font-size:12px">Los respaldos se conservan ' + BK_DIAS_CONSERVAR + ' días. — Sistema automático</p></div>';
    MailApp.sendEmail({ to: BK_CORREO, subject: asunto, htmlBody: html });
  }
}

/* ───────────────────────── auxiliares ───────────────────────── */

function bkCarpetaRaiz_() {
  var it = DriveApp.getFoldersByName(BK_CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BK_CARPETA);
}

function bkSubcarpeta_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

/** Descarga una colección completa de Firestore vía REST (con paginación). */
function bkFirestoreColeccion_(col) {
  var base = 'https://firestore.googleapis.com/v1/projects/' + BK_FS_PROYECTO +
             '/databases/(default)/documents/' + col + '?pageSize=300&key=' + BK_FS_APIKEY;
  var docs = [];
  var token = '';
  var vueltas = 0;
  do {
    var url = base + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
    var data = JSON.parse(r.getContentText() || '{}');
    (data.documents || []).forEach(function (d) {
      docs.push({ _id: String(d.name || '').split('/').pop(), _campos: d.fields || {} });
    });
    token = data.nextPageToken || '';
    vueltas++;
  } while (token && vueltas < 50);
  return docs;
}

/** Mueve a la papelera las subcarpetas "Backup AAAA-MM-DD" con más de BK_DIAS_CONSERVAR días. */
function bkLimpiarAntiguos_(raiz) {
  var limite = new Date();
  limite.setDate(limite.getDate() - BK_DIAS_CONSERVAR);
  var borrados = 0;
  var it = raiz.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var m = f.getName().match(/^Backup (\d{4})-(\d{2})-(\d{2})$/);
    if (!m) continue;
    var fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (fecha < limite) { f.setTrashed(true); borrados++; }
  }
  return borrados;
}
