/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-eliminadas (_AT_ELIMINADAS_VIVO_V1, 12-nov-2026)
   GET /api/atenciones/eliminadas   (con sesion)  ->  { success, marca, eliminadas:[{ id, nro, dni }] }
   Lista corta de las atenciones ELIMINADAS en los ultimos 45 dias (maximo 400), para que la pantalla de
   CADA usuario quite de su lista lo que otro elimino. Antes, quien eliminaba dejaba de verla, pero los
   demas la seguian viendo hasta recargar (la actualizacion en vivo solo traia altas y cambios, nunca bajas).
   Sale de dbo.Atenciones_Respaldo (motivo 'eliminada…'), que es donde atenciones/eliminar deja la copia.
   Solo devuelve id, N° y DNI: nada del contenido de la atencion. Memoria 15 s por instancia.
   La marca (ultimo rid) tambien viaja en vigia/marcas como 'at_eliminadas'.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { getPool } = require('../shared/db');
function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
let _c = { ts: 0, body: null };

module.exports = async function (context, req) {
  const u = token(req);
  if (!u || !u.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
  const t0 = Date.now();
  if (_c.body && t0 - _c.ts < 15000) { context.res = { status: 200, headers: { 'X-Cache': 'HIT' }, body: _c.body }; return; }
  try {
    const pool = await getPool();
    const r = await pool.request().query(`SELECT TOP (400) rid, id, datos FROM dbo.Atenciones_Respaldo
        WHERE motivo LIKE 'eliminada%' AND fecha >= DATEADD(day, -45, SYSUTCDATETIME()) ORDER BY rid DESC`);
    const out = []; let marca = 0;
    (r.recordset || []).forEach((x) => {
      if (x.rid > marca) marca = x.rid;
      let d = {}; try { d = JSON.parse(x.datos || '{}'); } catch (e) { d = {}; }
      out.push({ id: x.id, nro: d.nro == null ? null : d.nro, dni: String(d.dni == null ? '' : d.dni).trim() });
    });
    const body = { success: true, marca: String(marca), eliminadas: out, ms: Date.now() - t0 };
    _c = { ts: Date.now(), body };
    context.res = { status: 200, headers: { 'X-Cache': 'MISS' }, body };
  } catch (e) {
    context.log.error('atenciones-eliminadas: ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
