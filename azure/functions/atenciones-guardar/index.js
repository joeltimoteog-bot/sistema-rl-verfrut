/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-guardar (_AT_AZURE_PRIMERO_V1, 26-set-2026)
   POST /api/atenciones/guardar   (la pantalla, con el token del login)
   Guarda la Nueva Atencion DIRECTO en Azure y entrega el N°:
     · N° = el mayor entre el contador del año y el N° mas alto ya guardado, + 1,
       dentro de una transaccion con candado: dos guardados simultaneos nunca
       reciben el mismo N° (aunque sean 200 a la vez).
     · client_id (huella del formulario): si llega dos veces (doble clic,
       reintento tras un corte) devuelve el MISMO N° y no crea otra fila.
     · La fila de la hoja de Google la escribe despues el Apps Script
       (atHojaDesdeAzure), con este mismo N°.
   Apagado (AtConfig azure_primero <> '1') o sin token -> 503/401 y la pantalla
   guarda por Google como siempre. ?prueba=1 -> calcula todo y DESHACE (no guarda).
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../shared/db');
const G = require('../shared/at-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
const INSERT = `INSERT INTO dbo.Atenciones (
    nro, fecha_atencion, hora_inicio, hora_termino, nro_semana, mes, anio, dni, nombre, sexo, fecha_inicio_periodo,
    empresa, fundo, cargo, ruta, codigo, fundo_actual, celular, supervisor, detalle_documento, nro_licencia, parentesco,
    fecha_inicio_doc, fecha_termino_doc, dias_transcurridos, responsable_recepcion, observaciones, estado, usuario_sistema,
    autorizado_por, fecha_termino_periodo)
  OUTPUT INSERTED.id INTO @t
  VALUES (@nro, @fecha_atencion, @hora_inicio, @hora_termino, @nro_semana, @mes, @anio, @dni, @nombre, @sexo, @fecha_inicio_periodo,
    @empresa, @fundo, @cargo, @ruta, @codigo, @fundo_actual, @celular, @supervisor, @detalle_documento, @nro_licencia, @parentesco,
    @fecha_inicio_doc, @fecha_termino_doc, @dias_transcurridos, @responsable_recepcion, @observaciones, @estado, @usuario_sistema,
    @autorizado_por, @fecha_termino_periodo);`;   /* _AT_COLS_V1 */

async function yaGuardado(pool, clave) {
  const r = await pool.request().input('k', sql.NVarChar(80), clave).query('SELECT nro, anio FROM dbo.AtIdem WHERE clave = @k');
  return r.recordset[0] || null;
}

module.exports = async function (context, req) {
  const b = req.body || {};
  const prueba = String((req.query && req.query.prueba) || '') === '1';
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const pool = await getPool();
    await G.asegurarTablas(pool);
    if (!prueba && (await G.config(pool, 'azure_primero')) !== '1') {
      context.res = { status: 503, body: { success: false, apagado: true, error: 'Guardado en Azure apagado' } }; return;
    }
    const d = G.armar(b);
    if (!/^\d{8}$/.test(d.dni) && !/^[A-Za-z0-9]{6,15}$/.test(d.dni)) { context.res = { status: 400, body: { success: false, error: 'DNI invalido' } }; return; }
    if (!d.nombre) { context.res = { status: 400, body: { success: false, error: 'Falta el nombre' } }; return; }
    if (!d.usuario_sistema) d.usuario_sistema = String(t.usuario).slice(0, 50);
    const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 80);
    const L = G.lima(), anioHoja = L.anio;

    if (clave && !prueba) {
      const p = await yaGuardado(pool, clave);
      if (p) { context.res = { status: 200, body: { success: true, nro: p.nro, duplicadoEvitado: true, hoja: 'BB. DE REGISTROS ' + anioHoja, fuente: 'azure' } }; return; }
    }

    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let nro, id;
    try {
      /* el candado va SOLO sobre la fila del contador: todos los guardados por Azure
         pasan por ella en fila india (milisegundos). El MAX de la tabla es solo para
         respetar los N° que haya puesto Google (respaldo) y no bloquea a nadie. */
      const c = await tx.request().input('a', sql.Int, anioHoja).query(`
        SELECT (SELECT ultimo FROM dbo.AtNroContador WITH (UPDLOCK, HOLDLOCK) WHERE anio = @a) AS ultimo,
               (SELECT MAX(nro) FROM dbo.Atenciones WITH (NOLOCK) WHERE anio = @a) AS maxAz`);
      const ult = c.recordset[0].ultimo || 0, maxAz = c.recordset[0].maxAz || 0;
      nro = Math.max(ult, maxAz) + 1;
      const r = tx.request();
      r.input('nro', sql.Int, nro).input('fecha_atencion', sql.Date, d.fecha_atencion)
       .input('hora_inicio', sql.NVarChar(10), d.hora_inicio).input('hora_termino', sql.NVarChar(10), d.hora_termino)
       .input('nro_semana', sql.Int, d.nro_semana).input('mes', sql.Int, d.mes).input('anio', sql.Int, d.anio)
       .input('dni', sql.NVarChar(15), d.dni).input('nombre', sql.NVarChar(200), d.nombre).input('sexo', sql.NVarChar(10), d.sexo)
       .input('fecha_inicio_periodo', sql.Date, d.fecha_inicio_periodo).input('empresa', sql.NVarChar(50), d.empresa)
       .input('fundo', sql.NVarChar(100), d.fundo).input('cargo', sql.NVarChar(150), d.cargo).input('ruta', sql.NVarChar(50), d.ruta)
       .input('codigo', sql.NVarChar(50), d.codigo).input('fundo_actual', sql.NVarChar(100), d.fundo_actual)
       .input('celular', sql.NVarChar(20), d.celular).input('supervisor', sql.NVarChar(100), d.supervisor)
       .input('detalle_documento', sql.NVarChar(500), d.detalle_documento).input('nro_licencia', sql.NVarChar(40), d.nro_licencia)
       .input('parentesco', sql.NVarChar(40), d.parentesco).input('fecha_inicio_doc', sql.Date, d.fecha_inicio_doc)
       .input('fecha_termino_doc', sql.Date, d.fecha_termino_doc).input('dias_transcurridos', sql.Int, d.dias_transcurridos)
       .input('responsable_recepcion', sql.NVarChar(150), d.responsable_recepcion).input('observaciones', sql.NVarChar(sql.MAX), d.observaciones)
       .input('estado', sql.NVarChar(30), d.estado).input('usuario_sistema', sql.NVarChar(50), d.usuario_sistema)
       .input('autorizado_por', sql.NVarChar(100), d.autorizado_por).input('fecha_termino_periodo', sql.Date, d.fecha_termino_periodo)   /* _AT_COLS_V1 */
       .input('a', sql.Int, anioHoja).input('k', sql.NVarChar(80), clave || ('sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)));
      const ins = await r.query(`SET NOCOUNT ON; DECLARE @t TABLE (id INT); ${INSERT}
        DECLARE @id INT = (SELECT TOP 1 id FROM @t);
        MERGE dbo.AtNroContador AS x USING (SELECT @a AS anio) AS s ON x.anio = s.anio
          WHEN MATCHED THEN UPDATE SET ultimo = @nro, actualizado = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (anio, ultimo) VALUES (@a, @nro);
        INSERT INTO dbo.AtIdem (clave, nro, atencion_id, anio) VALUES (@k, @nro, @id, @a);
        SELECT @id AS id;`);
      id = ins.recordset[0].id;
      if (prueba) await tx.rollback(); else await tx.commit();
      /* _KPI_RRLL_V1 (30-set-2026): hora exacta en que se registro la atencion (KPI "registrada el mismo dia"). Nunca frena el guardado. */
      if (!prueba) {
        try {
          await pool.request().input('a', sql.Int, d.anio).input('n', sql.Int, nro).input('f', sql.NVarChar(16), L.ymd + ' ' + L.hm)
            .query(`IF OBJECT_ID('dbo.KPI_AtRegistro', 'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.KPI_AtRegistro WHERE anio = @a AND nro = @n)
                    INSERT INTO dbo.KPI_AtRegistro (anio, nro, fecha_registro, fuente) VALUES (@a, @n, CAST(@f AS DATETIME2(0)), 'azure')`);
        } catch (eK) { context.log.warn('[atenciones-guardar] KPI_AtRegistro: ' + eK.message); }
      }
    } catch (e) {
      try { await tx.rollback(); } catch (e2) {}
      /* misma huella guardada al mismo tiempo por otro envio -> devolver ese N° */
      if (clave && /PRIMARY KEY|duplicate key/i.test(e.message || '')) {
        const p = await yaGuardado(pool, clave);
        if (p) { context.res = { status: 200, body: { success: true, nro: p.nro, duplicadoEvitado: true, hoja: 'BB. DE REGISTROS ' + anioHoja, fuente: 'azure' } }; return; }
      }
      throw e;
    }
    context.res = { status: 200, body: {
      success: true, nro, id: prueba ? null : id, prueba, hoja: 'BB. DE REGISTROS ' + anioHoja, fuente: 'azure', azure: 'directo', _cols30: true,
      nro_licencia: d.nro_licencia, parentesco: d.parentesco, mes: d.mes, anio: d.anio, nro_semana: d.nro_semana,
      fecha_atencion: d.fecha_atencion, hora_inicio: d.hora_inicio, estado: d.estado, fecha_registro: L.ymd } };
  } catch (err) {
    context.log.error('[atenciones-guardar] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
