/* =========================================================================
 * REPORTE SEMANAL AUTOMÁTICO — Coordinación RR.LL · Unifrutti
 * -------------------------------------------------------------------------
 * Envía cada LUNES A LAS 6 AM un correo con el resumen de cumplimiento del
 * equipo: informes de visitas, casos sin cerrar, capacitaciones ETI vencidas
 * y evaluaciones ETI vencidas. Sin trabajo manual.
 *
 * INSTALACIÓN (una sola vez, 3 minutos):
 * 1. Entra a script.google.com con tu cuenta → "Nuevo proyecto".
 * 2. Borra el contenido y pega TODO este archivo. Nómbralo "Reporte Semanal RRLL".
 * 3. En el menú de funciones (arriba), elige "instalarDisparadorSemanal" y
 *    pulsa ▶ Ejecutar. Autoriza los permisos cuando lo pida.
 * 4. Listo: cada lunes 6-7 am te llegará el reporte. Para probarlo ahora
 *    mismo, ejecuta la función "reporteSemanal" y revisa tu correo.
 * ========================================================================= */

var RPT_DESTINO = 'joel.timoteog@gmail.com';   // ← correo(s) destino, separa con comas
var RPT_GAS_CUMPL = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
var RPT_FS = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
var RPT_FS_KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';

function instalarDisparadorSemanal() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'reporteSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('reporteSemanal')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  Logger.log('✅ Disparador instalado: todos los lunes entre 6 y 7 am.');
}

function _rptFsVal(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(_rptFsVal);
  if (v.mapValue) {
    var o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(function (k) { o[k] = _rptFsVal(f[k]); });
    return o;
  }
  return null;
}
function _rptFsGet(col) {
  try {
    var r = UrlFetchApp.fetch(RPT_FS + col + '?pageSize=300&key=' + RPT_FS_KEY, { muteHttpExceptions: true });
    var j = JSON.parse(r.getContentText() || '{}');
    return (j.documents || []).map(function (d) {
      var o = {}, f = d.fields || {};
      Object.keys(f).forEach(function (k) { o[k] = _rptFsVal(f[k]); });
      return o;
    });
  } catch (e) { return []; }
}
function _rptHoyISO() {
  return Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
}
function _rptDias(desdeISO, hastaISO) {
  return Math.round((new Date(hastaISO) - new Date(desdeISO)) / 86400000);
}

function reporteSemanal() {
  var hoy = _rptHoyISO();

  // 1) Cumplimiento RR.LL (visitas y casos) — misma fuente que el Monitor
  var visitas = [], casos = [];
  try {
    var r = UrlFetchApp.fetch(RPT_GAS_CUMPL + '?action=getCumplimiento&usuario=jtimoteo', { muteHttpExceptions: true });
    var c = JSON.parse(r.getContentText() || '{}');
    if (c && c.success) {
      (c.pendientesVisitas || []).forEach(function (p) {
        visitas.push({ nom: p.nombre || '?', est: p.estado === 'plazo_hoy' ? 'plazo HOY' : 'VENCIDO' });
      });
      var porNom = {};
      (c.casosPendientes || []).forEach(function (p) {
        var n = p.nombre_mostrar || '?';
        porNom[n] = (porNom[n] || 0) + 1;
      });
      Object.keys(porNom).forEach(function (n) { casos.push({ nom: n, n: porNom[n] }); });
    }
  } catch (e) {}

  // 2) Capacitaciones ETI vencidas
  var caps = [];
  _rptFsGet('programaciones_eti').forEach(function (p) {
    if (p.estado === 'ejecutada') return;
    var fechas = (p.fechas && p.fechas.length ? p.fechas.slice().sort() : [p.fechaProgramada, p.fechaFin || p.fechaProgramada].filter(Boolean).sort());
    if (!fechas.length) return;
    var fin = fechas[fechas.length - 1];
    if (hoy > fin) caps.push({ sup: p.supervisor || '?', sector: p.sector || '', tema: p.tema || '', dias: _rptDias(fin, hoy) });
  });

  // 3) Evaluaciones ETI vencidas
  var evals = [];
  _rptFsGet('programaciones_eval').forEach(function (p) {
    if (p.estado === 'ejecutada') return;
    var ejec = p.fechasEjecutadas || [];
    var pend = (p.fechas || []).filter(function (f) { return ejec.indexOf(f) < 0; }).sort();
    var venc = pend.filter(function (f) { return f < hoy; });
    if (venc.length) evals.push({ sup: p.sup || '?', fechas: venc.join(', '), dias: _rptDias(venc[0], hoy) });
  });

  var total = visitas.length + casos.length + caps.length + evals.length;

  // 4) Armar el correo HTML
  function tabla(titulo, filas, cab) {
    if (!filas.length) return '<p style="color:#16a34a;margin:6px 0;">✅ ' + titulo + ': sin pendientes.</p>';
    var h = '<h3 style="margin:14px 0 6px;color:#0f172a;">' + titulo + ' (' + filas.length + ')</h3>' +
      '<table border="0" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;width:100%;max-width:560px;">' +
      '<tr style="background:#003DA5;color:#fff;">' + cab.map(function (c) { return '<th align="left" style="padding:6px 8px;">' + c + '</th>'; }).join('') + '</tr>';
    filas.forEach(function (f, i) {
      h += '<tr style="background:' + (i % 2 ? '#f1f5f9' : '#fff') + ';">' +
        f.map(function (v) { return '<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">' + v + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table>';
  }

  var fechaTxt = Utilities.formatDate(new Date(), 'America/Lima', "EEEE d 'de' MMMM 'de' yyyy");
  var html =
    '<div style="font-family:Arial,sans-serif;color:#1e293b;">' +
    '<div style="background:linear-gradient(120deg,#003DA5,#0050C8);color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">' +
    '<h2 style="margin:0;">📊 Reporte Semanal de Cumplimiento — RR.LL</h2>' +
    '<div style="opacity:.85;font-size:13px;">' + fechaTxt + ' · Generado automáticamente</div></div>' +
    '<div style="border:1px solid #e2e8f0;border-top:none;padding:16px 20px;border-radius:0 0 12px 12px;">' +
    '<p style="font-size:15px;"><b>Total de pendientes del equipo: ' + total + '</b></p>' +
    tabla('🎓 Capacitaciones ETI vencidas', caps.map(function (x) { return [x.sup, x.sector, x.tema, x.dias + ' día(s) de atraso']; }), ['Supervisor', 'Sector', 'Tema', 'Atraso']) +
    tabla('⭐ Evaluaciones ETI vencidas', evals.map(function (x) { return [x.sup, x.fechas, x.dias + ' día(s) de atraso']; }), ['Supervisor', 'Fechas pendientes', 'Atraso']) +
    tabla('📋 Informes de visitas pendientes', visitas.map(function (x) { return [x.nom, x.est]; }), ['Usuario', 'Estado']) +
    tabla('📁 Casos registrados sin informe/reporte', casos.map(function (x) { return [x.nom, x.n + ' caso(s)']; }), ['Usuario', 'Cantidad']) +
    '<p style="font-size:12px;color:#64748b;margin-top:16px;">Fuentes: Monitor RR.LL (cumplimiento) · Sistema ETI Capacitaciones · Sistema de Evaluaciones ETI.<br>' +
    'Reporte generado por el sistema — Coordinación RR.LL · Unifrutti Group.</p></div></div>';

  MailApp.sendEmail({
    to: RPT_DESTINO,
    subject: '📊 Reporte Semanal RR.LL — ' + total + ' pendiente(s) del equipo · ' + hoy,
    htmlBody: html
  });
  Logger.log('✅ Reporte enviado a ' + RPT_DESTINO + ' (' + total + ' pendientes).');
}
