const { sql, getPool } = require('../shared/db');

// Helper: parsea fechas que pueden venir como Date, string ISO, o número serial de Sheets
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Sheets/Excel: días desde 30-dic-1899
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: convierte a string y trimea
function s(v, max) {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  if (str === '') return null;
  return max && str.length > max ? str.substring(0, max) : str;
}

// Helper: convierte a entero
function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

async function syncTabla(pool, tableName, rows) {
  if (!rows || rows.length === 0) return { inserted: 0, total_recibidos: 0 };

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Vaciar la tabla
    await transaction.request().query(`DELETE FROM dbo.${tableName}`);

    // 2. Bulk insert
    const table = new sql.Table(tableName);
    table.create = false;
    table.columns.add('dni',              sql.NVarChar(20),  { nullable: false });
    table.columns.add('ap_paterno',       sql.NVarChar(100), { nullable: true  });
    table.columns.add('ap_materno',       sql.NVarChar(100), { nullable: true  });
    table.columns.add('nombres',          sql.NVarChar(150), { nullable: true  });
    table.columns.add('codigo_trab',      sql.NVarChar(50),  { nullable: true  });
    table.columns.add('fecha_inicio',     sql.Date,          { nullable: true  });
    table.columns.add('sexo',             sql.NChar(1),      { nullable: true  });
    table.columns.add('oficio',           sql.NVarChar(150), { nullable: true  });
    table.columns.add('tipo_regimen',     sql.NVarChar(50),  { nullable: true  });
    table.columns.add('id_empresa',       sql.NVarChar(50),  { nullable: true  });
    table.columns.add('zona_labor',       sql.NVarChar(150), { nullable: true  });
    table.columns.add('direccion',        sql.NVarChar(255), { nullable: true  });
    table.columns.add('total',            sql.Int,           { nullable: true  });
    table.columns.add('empresa',          sql.NVarChar(20),  { nullable: true  });
    table.columns.add('nombre_completo',  sql.NVarChar(300), { nullable: true  });
    table.columns.add('ruta',             sql.NVarChar(100), { nullable: true  });
    table.columns.add('cod',              sql.NVarChar(50),  { nullable: true  });
    table.columns.add('fecha_termino',    sql.Date,          { nullable: true  });
    table.columns.add('fecha_nacimiento', sql.Date,          { nullable: true  });

    let descartados = 0;
    for (const row of rows) {
      const dni = s(row.dni, 20);
      if (!dni) { descartados++; continue; } // sin DNI no se inserta

      table.rows.add(
        dni,
        s(row.ap_paterno, 100),
        s(row.ap_materno, 100),
        s(row.nombres, 150),
        s(row.codigo_trab, 50),
        parseDate(row.fecha_inicio),
        s(row.sexo, 1),
        s(row.oficio, 150),
        s(row.tipo_regimen, 50),
        s(row.id_empresa, 50),
        s(row.zona_labor, 150),
        s(row.direccion, 255),
        toInt(row.total),
        s(row.empresa, 20),
        s(row.nombre_completo, 300),
        s(row.ruta, 100),
        s(row.cod, 50),
        parseDate(row.fecha_termino),
        parseDate(row.fecha_nacimiento)
      );
    }

    const bulkResult = await transaction.request().bulk(table);
    await transaction.commit();

    return {
      total_recibidos: rows.length,
      inserted: bulkResult.rowsAffected,
      descartados_sin_dni: descartados
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

module.exports = async function (context, req) {
  context.log('trabajadores-sync triggered');
  const startTime = Date.now();

  try {
    const body = req.body || {};
    const rapel = Array.isArray(body.rapel) ? body.rapel : null;
    const verfrut = Array.isArray(body.verfrut) ? body.verfrut : null;

    if (!rapel && !verfrut) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'Debe enviar al menos uno de los arrays: rapel o verfrut'
        }
      };
      return;
    }

    const pool = await getPool();
    const results = {};

    if (rapel)   results.rapel   = await syncTabla(pool, 'Trabajadores_RAPEL', rapel);
    if (verfrut) results.verfrut = await syncTabla(pool, 'Trabajadores_VERFRUT', verfrut);

    const elapsed = Date.now() - startTime;
    context.log('Sync completado en', elapsed, 'ms');

    context.res = {
      status: 200,
      body: {
        success: true,
        results: results,
        elapsed_ms: elapsed,
        fuente: 'AZURE_SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en trabajadores-sync:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message,
        code: e.code,
        name: e.name
      }
    };
  }
};