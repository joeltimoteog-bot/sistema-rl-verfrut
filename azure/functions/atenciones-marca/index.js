/* ════════════════════════════════════════════════════════════════════════
   atenciones-marca — _AT_VIGIA_V1 (02-nov-2026)
   Marca de cambio ultraligera de la tabla Atenciones, para que cada pestaña del
   dashboard detecte en ≤30 s que alguien registró o editó una atención, sin depender
   de Firebase ni del Apps Script (esa cadena fallaba y los usuarios tenían que recargar).
   GET atenciones/marca  →  { success, max_id, modificado, hoy, marca }
     max_id      último id insertado (PK: instantáneo)
     modificado  última modificación (índice IX_At_modificado: instantáneo)
     hoy         atenciones con fecha_atencion = hoy (Lima)
     marca       texto que cambia si cambió cualquiera de los tres
   Caché en memoria 8 s por instancia: 30 pestañas consultando cada 30 s = ~1 consulta
   real cada 8 s como máximo. Exige sesión (Bearer).
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

let _c = { ts: 0, body: null };
const CACHE_MS = 8000;

module.exports = async function (context, req) {
  const u = exigirAuth(context, req); if (u === null) return;
  const ahora = Date.now();
  if (_c.body && ahora - _c.ts < CACHE_MS) { context.res = { status: 200, headers: { 'X-Cache': 'HIT' }, body: _c.body }; return; }
  try {
    const pool = await getPool();
    const hoyLima = new Date(ahora - 5 * 3600e3).toISOString().slice(0, 10);
    const r = await pool.request().input('hoy', sql.Date, hoyLima).query(`
      SELECT (SELECT MAX(id) FROM Atenciones) AS max_id,
             (SELECT MAX(modificado) FROM Atenciones) AS modificado,
             (SELECT COUNT(*) FROM Atenciones WHERE fecha_atencion = @hoy) AS hoy`);
    const x = r.recordset[0] || {};
    const mod = x.modificado ? new Date(x.modificado).toISOString() : '';
    const body = { success: true, max_id: x.max_id || 0, modificado: mod, hoy: x.hoy || 0, marca: (x.max_id || 0) + '|' + mod + '|' + (x.hoy || 0), ms: Date.now() - ahora };
    _c = { ts: Date.now(), body };
    context.res = { status: 200, headers: { 'X-Cache': 'MISS' }, body };
  } catch (e) {
    context.log.error('atenciones-marca: ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
