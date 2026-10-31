/************************************************************************
 * BITÁCORA DE ALMUERZOS — guarda el detalle diario en "BB.ALMUERZOS"
 * ----------------------------------------------------------------------
 * PROBLEMA QUE CORRIGE: el módulo de Programación de Almuerzos llama a la
 * acción 'registrarEnvioAlmuerzos' al enviar el correo del día, pero esa
 * acción no existía en codigo.gs → nunca se guardaba nada.
 *
 * QUÉ GUARDA: una fila por colaborador ACTIVO del día, con fecha, hora,
 * DNI, nombre, comedor, tipo de comida, si recoge en taper, empresa,
 * observación y quién envió. Si se reenvía el mismo día, reemplaza lo de
 * ese día (sin duplicados).
 *
 * INSTALACIÓN (2 pasos, en el Apps Script del sistema RR.LL):
 *
 * 1. Pega este archivo completo como archivo nuevo (o al final de codigo.gs).
 *
 * 2. En el switch de doPost/handle (parte alta de codigo.gs), agrega esta
 *    línea junto a los otros case de almuerzos (busca 'getAlmuerzos'):
 *
 *      case 'registrarEnvioAlmuerzos': result = registrarEnvioAlmuerzos(body); break;
 *
 *    Guarda → Implementar → Gestionar implementaciones → ✏️ → Nueva versión.
 ************************************************************************/

function registrarEnvioAlmuerzos(d) {
  try {
    var ss = SpreadsheetApp.openById('1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw');
    var bb = ss.getSheetByName('BB.ALMUERZOS');
    if (!bb) bb = ss.insertSheet('BB.ALMUERZOS');

    // Encabezados (solo la primera vez)
    if (bb.getLastRow() === 0) {
      bb.appendRow(['Fecha', 'Hora', 'DNI', 'Nombre y Apellidos', 'Comedor',
                    'Tipo comida', 'Recojo taper', 'Empresa', 'Observación', 'Enviado por']);
      bb.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#0a2463').setFontColor('#ffffff');
      bb.setFrozenRows(1);
    }

    var lista = d.colaboradores || [];
    if (!lista.length) return { success: false, error: 'No llegó el detalle de colaboradores' };

    var ahora   = new Date();
    var hoyTxt  = Utilities.formatDate(ahora, 'America/Lima', 'dd/MM/yyyy');
    var horaTxt = Utilities.formatDate(ahora, 'America/Lima', 'HH:mm');

    // Re-envío del mismo día → borrar lo de hoy antes de guardar (sin duplicados)
    var lr = bb.getLastRow();
    if (lr > 1) {
      var fechas = bb.getRange(2, 1, lr - 1, 1).getValues();
      for (var i = fechas.length - 1; i >= 0; i--) {
        var v = fechas[i][0];
        var f = (v instanceof Date) ? Utilities.formatDate(v, 'America/Lima', 'dd/MM/yyyy') : String(v).trim();
        if (f === hoyTxt) bb.deleteRow(i + 2);
      }
    }

    var filas = lista.map(function (c) {
      return [hoyTxt, horaTxt, "'" + String(c.dni || ''), c.nombre || '', c.comedor || '',
              c.tipo_comida || 'ALMUERZO', c.taper ? 'SÍ' : '', c.empresa || '',
              c.observacion || '', d.remitente_nombre || d.usuario || ''];
    });
    bb.getRange(bb.getLastRow() + 1, 1, filas.length, 10).setValues(filas);

    return { success: true, guardados: filas.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
