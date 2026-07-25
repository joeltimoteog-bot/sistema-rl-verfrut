/* =========================================================================
 * MANT-UNIDADES · Gestión de unidades — Sistema RL · Unifrutti
 * -------------------------------------------------------------------------
 * Permite desde el módulo de Mantenimiento (pestaña 🚗 Unidades, solo admin):
 *  - mant_actualizarUnidad: cambiar la unidad asignada a un conductor.
 *  - mant_agregarMovilidad: registrar un conductor/movilidad nuevo
 *    (incluye unidades ARRENDADAS).
 *
 * INSTALACIÓN (2 pasos):
 * 1. Archivo nuevo "mant-unidades" en el editor de Apps Script → pegar TODO.
 * 2. En el switch de doPost agrega estos 2 case:
 *
 *      case 'mant_actualizarUnidad':  result = mant_actualizarUnidad(params); break;
 *      case 'mant_agregarMovilidad':  result = mant_agregarMovilidad(params); break;
 *
 *    Luego: Implementar → Administrar implementaciones → ✏️ → Nueva versión.
 *
 * Usa las mismas constantes ya existentes: SPREADSHEET_ID y _HOJA_RESPONSABLES.
 * Columnas fijas (igual que buscarResponsableMantenimiento):
 *   A dni · B nombre · C correo · D cargo · E modelo · F marca · G codInterno · Q empresa
 * ========================================================================= */

var MANT_UNID_ADMINS = ['jtimoteo'];

function _mantEsAdmin_(p) {
  var u = String((p && p.admin) || (p && p._sesion && p._sesion.usuario) || '').toLowerCase();
  return MANT_UNID_ADMINS.indexOf(u) >= 0;
}

function _mantColPropiedad_(headers) {
  for (var i = 0; i < headers.length; i++) {
    if (/propiedad|estatus/i.test(String(headers[i]))) return i;
  }
  return -1;
}

function mant_actualizarUnidad(p) {
  try {
    if (!_mantEsAdmin_(p)) return { ok:false, msg:'Solo el administrador puede cambiar unidades.' };
    var dni = String((p && p.dni) || '').trim();
    if (!/^\d{8}$/.test(dni)) return { ok:false, msg:'DNI inválido.' };
    var marca = String(p.marca || '').trim(), modelo = String(p.modelo || '').trim(), cod = String(p.codInterno || '').trim();
    if (!marca || !modelo || !cod) return { ok:false, msg:'Faltan datos de la nueva unidad.' };

    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(_HOJA_RESPONSABLES);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_RESPONSABLES };
    var data = sh.getDataRange().getValues();
    var colProp = _mantColPropiedad_(data[0]);

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === dni) {
        var fila = i + 1;
        var anterior = String(data[i][5] || '') + ' ' + String(data[i][4] || '') + ' (' + String(data[i][6] || '') + ')';
        sh.getRange(fila, 5).setValue(modelo);      // E modelo
        sh.getRange(fila, 6).setValue(marca);       // F marca
        sh.getRange(fila, 7).setValue(cod);         // G codInterno
        if (colProp >= 0) sh.getRange(fila, colProp + 1).setValue(String(p.propiedad || 'PROPIA'));
        else if (String(p.propiedad || '') === 'ARRENDADA') sh.getRange(fila, 6).setValue(marca + ' (ARRENDADA)');
        return { ok:true, msg:'Unidad actualizada. Antes: ' + anterior + ' → Ahora: ' + marca + ' ' + modelo + ' (' + cod + ').' };
      }
    }
    return { ok:false, msg:'DNI no encontrado en la hoja de responsables.' };
  } catch (e) { return { ok:false, msg:'Error: ' + e.message }; }
}

function mant_agregarMovilidad(p) {
  try {
    if (!_mantEsAdmin_(p)) return { ok:false, msg:'Solo el administrador puede registrar movilidades.' };
    var dni = String((p && p.dni) || '').trim();
    if (!/^\d{8}$/.test(dni)) return { ok:false, msg:'DNI inválido.' };
    var nombre = String(p.nombre || '').trim();
    var marca = String(p.marca || '').trim(), modelo = String(p.modelo || '').trim(), cod = String(p.codInterno || '').trim();
    if (!nombre || !marca || !modelo || !cod) return { ok:false, msg:'Faltan datos obligatorios.' };

    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(_HOJA_RESPONSABLES);
    if (!sh) return { ok:false, msg:'No existe la hoja ' + _HOJA_RESPONSABLES };
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === dni) {
        return { ok:false, msg:'Ese DNI ya está registrado (' + String(data[i][1] || '') + '). Usa "Cambio de unidad".' };
      }
    }
    var lastCol = sh.getLastColumn();
    var fila = new Array(lastCol).fill('');
    fila[0] = dni;                                       // A
    fila[1] = nombre;                                    // B
    fila[2] = String(p.correo || '').trim();             // C
    fila[3] = String(p.cargo || '').trim();              // D
    fila[4] = modelo;                                    // E
    fila[5] = (String(p.propiedad || '') === 'ARRENDADA' && _mantColPropiedad_(data[0]) < 0)
              ? marca + ' (ARRENDADA)' : marca;          // F
    fila[6] = cod;                                       // G
    if (lastCol >= 17) fila[16] = String(p.empresa || '');  // Q empresa
    var colProp = _mantColPropiedad_(data[0]);
    if (colProp >= 0 && colProp < lastCol) fila[colProp] = String(p.propiedad || 'PROPIA');
    sh.appendRow(fila);
    return { ok:true, msg:'Movilidad registrada: ' + nombre + ' → ' + marca + ' ' + modelo + ' (' + cod + ')' +
                          (String(p.propiedad||'')==='ARRENDADA' ? ' · ARRENDADA' : '') + '.' };
  } catch (e) { return { ok:false, msg:'Error: ' + e.message }; }
}
