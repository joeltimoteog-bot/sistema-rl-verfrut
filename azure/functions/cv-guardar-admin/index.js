/* ═══════════════════════════════════════════════════════════════════════════
   cv-guardar-admin (_CV_AZURE_PRIMERO_V1) — solo con la llave (lo usa el Apps Script)
   GET  mantenimiento/cv/estado                     encendido, contadores, pendientes
   POST mantenimiento/cv/encender  {maxCasos, maxVisitas}   inicia contadores y enciende
   POST mantenimiento/cv/apagar
   GET  mantenimiento/cv/pendientes                 operaciones que faltan copiar a la hoja
   POST mantenimiento/cv/marcar    {ids:[..]} | {id, error}
   POST mantenimiento/cv/simular   {accion, datos, usuario}   hace todo y DESHACE
   POST mantenimiento/cv/horas{Encender|Apagar|Estado|Simular}   (_HORAS_AZURE_PRIMERO_V1)
   POST mantenimiento/cv/fus{Encender|Apagar|Simular}   (_FUS_AZURE_V1)
   POST mantenimiento/cv/sol{Encender|Apagar|Simular}   (_SOL_AZURE_V1)
   POST mantenimiento/cv/cumpl{Encender|Apagar|Simular|Motor}   (_CUMPL_W_V1)
   POST mantenimiento/cv/usr{Encender|Apagar|Simular|Usuarios}   (_USR_AZURE_V1)
   POST mantenimiento/cv/mant{Encender|Apagar|Simular}   (_MANT_AZURE_V1)
   POST mantenimiento/cv/e360{Encender|Apagar|Simular}   (_E360_AZURE_V1)
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('../shared/db');
const G = require('../shared/cv-guardar');
const CAP = require('../shared/cap-guardar');   /* _CAP_AZURE_PRIMERO_V1 */
const HOR = require('../shared/horas-guardar');   /* _HORAS_AZURE_PRIMERO_V1 */
const FUS = require('../shared/fus-guardar');   /* _FUS_AZURE_V1 */
const SOL = require('../shared/sol-guardar');   /* _SOL_AZURE_V1 */
const CUW = require('../shared/cumpl-guardar');   /* _CUMPL_W_V1 */
const USR = require('../shared/usr-guardar');   /* _USR_AZURE_V1 */
const MANT = require('../shared/mant-guardar');   /* _MANT_AZURE_V1 */
const E360 = require('../shared/e360-guardar');   /* _E360_AZURE_V1 */

async function ponerEstado(pool, clave, valor) {
  await pool.request().input('k', sql.NVarChar(40), clave).input('v', sql.NVarChar(400), valor)
    .query(`MERGE dbo.CV_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
            WHEN MATCHED THEN UPDATE SET valor = @v, actualizado = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES (@k, @v);`);
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion, b = req.body || {};
  const res = (status, body) => { context.res = { status, body }; };
  try {
    const pool = await getPool(); await G.asegurarTablas(pool);
    if (accion === 'estado') {
      const r = await pool.request().query(`SELECT
        (SELECT valor FROM dbo.CV_Estado WHERE clave = 'azure_primero') AS azure_primero,
        (SELECT ultimo FROM dbo.CV_Contador WHERE tipo = 'casos') AS contador_casos,
        (SELECT ultimo FROM dbo.CV_Contador WHERE tipo = 'visitas') AS contador_visitas,
        (SELECT COUNT(*) FROM dbo.CV_Ops WHERE en_hoja = 0) AS pendientes,
        (SELECT COUNT(*) FROM dbo.CV_Ops WHERE en_hoja = 0 AND error IS NOT NULL) AS con_error,
        (SELECT COUNT(*) FROM dbo.CV_Ops) AS operaciones,
        (SELECT COUNT(*) FROM dbo.Casos) AS casos, (SELECT COUNT(*) FROM dbo.Visitas) AS visitas`);
      return res(200, Object.assign({ success: true }, r.recordset[0]));
    }
    if (accion === 'encender' || accion === 'contadores') {   /* contadores: solo los inicia, sin encender */
      const mc = parseInt(b.maxCasos, 10), mv = parseInt(b.maxVisitas, 10);
      if (isNaN(mc) || isNaN(mv)) return res(400, { success: false, error: 'Faltan maxCasos / maxVisitas' });
      for (const [t, m] of [['casos', mc], ['visitas', mv]]) {
        await pool.request().input('t', sql.NVarChar(20), t).input('m', sql.Int, m)
          .query(`MERGE dbo.CV_Contador AS x USING (SELECT @t AS tipo) AS s ON x.tipo = s.tipo
                  WHEN MATCHED THEN UPDATE SET ultimo = CASE WHEN x.ultimo > @m THEN x.ultimo ELSE @m END, actualizado = SYSUTCDATETIME()
                  WHEN NOT MATCHED THEN INSERT (tipo, ultimo) VALUES (@t, @m);`);
      }
      if (accion === 'contadores') return res(200, { success: true, contadores: { casos: mc, visitas: mv } });
      await ponerEstado(pool, 'azure_primero', '1');
      return res(200, { success: true, encendido: true });
    }
    if (accion === 'apagar') { await ponerEstado(pool, 'azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'pendientes') {
      const r = await pool.request().query('SELECT TOP 50 id, tipo, accion, nro, usuario, cuerpo, error FROM dbo.CV_Ops WHERE en_hoja = 0 ORDER BY id');
      return res(200, { success: true, ops: r.recordset.map(o => Object.assign(o, { cuerpo: JSON.parse(o.cuerpo) })) });
    }
    if (accion === 'marcar') {
      if (Array.isArray(b.ids) && b.ids.length) {
        await pool.request().query(`UPDATE dbo.CV_Ops SET en_hoja = 1, aplicado = SYSUTCDATETIME(), error = NULL WHERE id IN (${b.ids.map(x => parseInt(x, 10)).filter(x => !isNaN(x)).join(',') || '0'})`);
      }
      if (b.id && b.error) await pool.request().input('id', sql.Int, b.id).input('e', sql.NVarChar(500), String(b.error).slice(0, 500)).query('UPDATE dbo.CV_Ops SET error = @e WHERE id = @id');
      return res(200, { success: true });
    }
    /* _CAP_AZURE_PRIMERO_V1 */
    if (accion === 'capEncender') { await ponerEstado(pool, 'cap_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'capApagar') { await ponerEstado(pool, 'cap_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'capSimular') { const r = await CAP.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', b.rol || 'administrador', true); return res(r.status, r.body); }
    /* _USR_AZURE_V1 */
    if (accion === 'e360Encender') { await ponerEstado(pool, 'e360_azure_primero', '1'); return res(200, { success: true, encendido: true }); }   /* _E360_AZURE_V1 */
    if (accion === 'e360Apagar') { await ponerEstado(pool, 'e360_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'e360Simular') { const r = await E360.ejecutar(pool, b.accion, b.datos || {}, b.operador || 'jtimoteo', true, b.ahora); return res(r.status, r.body); }
    if (accion === 'mantEncender') { await ponerEstado(pool, 'mant_azure_primero', '1'); return res(200, { success: true, encendido: true }); }   /* _MANT_AZURE_V1 */
    if (accion === 'mantApagar') { await ponerEstado(pool, 'mant_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'mantSimular') { const r = await MANT.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', true, b.ahora); return res(r.status, Object.assign({ success: !!r.body.ok }, r.body)); }
    if (accion === 'usrEncender') { await ponerEstado(pool, 'usr_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'usrApagar') { await ponerEstado(pool, 'usr_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'usrSimular') { const r = await USR.ejecutar(pool, b.accion, b.datos || {}, b.operador || 'jtimoteo', true, b.ahora); return res(r.status, r.body); }
    if (accion === 'usrUsuarios') {   /* para comparar con la hoja: SIN contraseñas (solo si esta cifrada o no) */
      const r = await pool.request().query("SELECT id_sistema, usuario, nombre, rol, empresa, activo, correo, CASE WHEN password LIKE '$2%' THEN 1 ELSE 0 END AS cifrada FROM dbo.usuarios ORDER BY id_sistema");
      return res(200, { success: true, usuarios: r.recordset });
    }
    /* _CUMPL_W_V1 */
    if (accion === 'cumplEncender') { await ponerEstado(pool, 'cumpl_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'cumplApagar') { await ponerEstado(pool, 'cumpl_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'cumplSimular') { const r = await CUW.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', b.rol || 'administrador', true, b.ahora); return res(r.status, r.body); }
    if (accion === 'cumplMotor') { const m = await CUW.paraMotor(pool); return res(m ? 200 : 404, m ? Object.assign({ success: true }, m) : { success: false, error: 'Tablas aun no cargadas' }); }
    /* _SOL_AZURE_V1 */
    if (accion === 'solEncender') { await ponerEstado(pool, 'sol_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'solApagar') { await ponerEstado(pool, 'sol_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'solSimular') { const r = await SOL.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', true); return res(r.status, r.body); }
    /* _FUS_AZURE_V1 */
    if (accion === 'fusEncender') { await ponerEstado(pool, 'fus_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'fusApagar') { await ponerEstado(pool, 'fus_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'fusSimular') { const r = await FUS.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', true); return res(r.status, r.body); }
    /* _HORAS_AZURE_PRIMERO_V1 */
    if (accion === 'horasEncender') { await ponerEstado(pool, 'horas_azure_primero', '1'); return res(200, { success: true, encendido: true }); }
    if (accion === 'horasApagar') { await ponerEstado(pool, 'horas_azure_primero', '0'); return res(200, { success: true, encendido: false }); }
    if (accion === 'horasEstado') {
      const r = await pool.request().query(`SELECT (SELECT valor FROM dbo.CV_Estado WHERE clave = 'horas_azure_primero') AS horas_azure_primero,
        (SELECT COUNT(*) FROM dbo.CV_Ops WHERE tipo = 'horas' AND en_hoja = 0) AS pendientes, (SELECT COUNT(*) FROM dbo.CV_Ops WHERE tipo = 'horas') AS operaciones`);
      return res(200, Object.assign({ success: true }, r.recordset[0]));
    }
    if (accion === 'horasSimular') { const r = await HOR.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', true, b.ahora); return res(r.status, r.body); }
    if (accion === 'simular') {
      const r = await G.ejecutar(pool, b.accion, b.datos || {}, b.usuario || 'jtimoteo', true);
      return res(r.status, r.body);
    }
    return res(404, { success: false, error: 'Accion desconocida' });
  } catch (e) {
    context.log.error('[cv-guardar-admin] ' + accion + ': ' + e.message);
    return res(500, { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') });
  }
};
