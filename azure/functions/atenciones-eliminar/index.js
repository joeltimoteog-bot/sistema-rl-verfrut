/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-eliminar (_AT_ELIMINAR_SUPABASE_V1, 12-nov-2026)
   POST /api/atenciones/eliminar   { nro, id?, dni?, motivo }   (la pantalla, con el token del login)
   ELIMINA DE VERDAD la atencion en Supabase. Hasta hoy "eliminar" solo borraba la fila de la hoja de
   Google y la pantalla OCULTABA el registro: en Supabase seguia existiendo (reaparecia y seguia contando
   en las estadisticas y en la base que descarga Bienestar).
   · Antes de borrar, la fila COMPLETA se copia a dbo.Atenciones_Respaldo (JSON + quien + motivo), dentro
     de la misma transaccion: si la copia falla, no se borra nada. Nada se pierde.
   · Permisos (los mismos que deleteAtencion del Apps Script, pero con el usuario y el rol del TOKEN):
     un supervisor solo elimina lo que el registro (usuario_sistema) o donde figura como supervisor;
     los demas roles, cualquiera.
   · Durante un bloqueo temporal (_AT_BLOQUEO_V1) tampoco se elimina (403 con el aviso).
   · Se ubica por id (lo que la pantalla tiene) y se comprueba que sea ese N°. Sin id: por N° (+DNI) en el
     año mas reciente; si hay mas de una fila con ese N°, NO se borra (409) para no llevarse otra atencion.
   · La fila de la hoja y la PAPELERA las sigue haciendo el Apps Script despues (lo pide la pantalla).
   ?prueba=1 -> hace todo y DESHACE (no borra).   Apagar: secreto AT_ELIMINAR_SUPABASE=0 (responde 503).
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
const low = (v) => String(v == null ? '' : v).trim().toLowerCase();

module.exports = async function (context, req) {
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const prueba = String((req.query && req.query.prueba) || '') === '1';
  const t0 = Date.now();
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    if (String(process.env.AT_ELIMINAR_SUPABASE || '') === '0') { context.res = { status: 503, body: { success: false, apagado: true, error: 'Eliminacion en Supabase apagada' } }; return; }
    if (!prueba) { const _bq = await require('../shared/at-bloqueo').revisar(t); if (_bq) { context.res = { status: 403, body: _bq }; return; } }
    const nro = parseInt(b.nro, 10);
    if (!nro) { context.res = { status: 400, body: { success: false, error: 'Falta N°' } }; return; }
    const pool = await getPool();

    /* 1) ubicar la atencion */
    let filas = [];
    const id = parseInt(b.id, 10) || 0;
    if (id) {
      const f = await pool.request().input('id', sql.Int, id).query('SELECT * FROM dbo.Atenciones WHERE id = @id');
      filas = f.recordset.filter((x) => parseInt(x.nro, 10) === nro);   /* el id debe ser de ESE N° */
    }
    if (!filas.length) {
      const dni = String(b.dni == null ? '' : b.dni).trim();
      const f = await pool.request().input('n', sql.Int, nro).input('d', sql.NVarChar(15), dni).query(`
        SELECT * FROM dbo.Atenciones
        WHERE nro = @n AND (@d = N'' OR dni = @d)
          AND anio = (SELECT MAX(anio) FROM dbo.Atenciones WHERE nro = @n AND (@d = N'' OR dni = @d))`);
      filas = f.recordset;
    }
    if (!filas.length) { context.res = { status: 404, body: { success: false, noEsta: true, error: 'Atencion no encontrada en Supabase' } }; return; }
    if (filas.length > 1) { context.res = { status: 409, body: { success: false, ambiguo: true, error: 'Hay ' + filas.length + ' atenciones con el N° ' + nro + '. No se elimino ninguna: avisa al administrador.' } }; return; }
    const fila = filas[0];

    /* 2) permisos: el rol y el usuario salen del TOKEN */
    const rol = low(t.rol), usuario = String(t.usuario).trim();
    if (rol === 'supervisor' && low(fila.usuario_sistema) !== low(usuario) && low(fila.supervisor) !== low(usuario)) {
      context.res = { status: 403, body: { success: false, error: 'No tienes permiso para eliminar este registro.' } }; return;
    }

    /* 3) copia completa + borrado, en una sola transaccion */
    const motivo = String(b.motivo == null ? '' : b.motivo).trim();
    const datos = JSON.stringify(Object.assign({}, fila, { _eliminada_por: usuario, _eliminada_en: new Date().toISOString(), _motivo: motivo }));
    const etiqueta = ('eliminada por ' + usuario + (motivo ? ': ' + motivo : '')).slice(0, 100);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let borradas = 0;
    try {
      await new sql.Request(tx).input('id', sql.Int, fila.id).input('datos', sql.NVarChar(sql.MAX), datos).input('m', sql.NVarChar(100), etiqueta)
        .query('INSERT INTO dbo.Atenciones_Respaldo (id, datos, motivo) VALUES (@id, @datos, @m)');
      const d = await new sql.Request(tx).input('id', sql.Int, fila.id).query('SET NOCOUNT ON; DELETE FROM dbo.Atenciones WHERE id = @id; SELECT @@ROWCOUNT AS n;');
      borradas = d.recordset[0].n;
      if (borradas !== 1) throw new Error('Se esperaba borrar 1 fila y serian ' + borradas);
      if (prueba) await tx.rollback(); else await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    if (!prueba) { try { require('../shared/stats-pizarron').invalidar(); } catch (eP) {} }
    const ms = Date.now() - t0;
    context.log('[atenciones-eliminar] _AT_ELIMINAR_SUPABASE_V1: N° ' + nro + ' (id ' + fila.id + ', DNI ' + String(fila.dni || '').trim() + ') eliminada por ' + usuario + (motivo ? ' · motivo: ' + motivo.slice(0, 80) : '') + ' · ' + ms + ' ms' + (prueba ? ' [PRUEBA, deshecho]' : ''));
    context.res = { status: 200, body: { success: true, nro, id: fila.id, dni: String(fila.dni || '').trim(), prueba, fuente: 'supabase', ms } };
  } catch (err) {
    context.log.error('[atenciones-eliminar] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
