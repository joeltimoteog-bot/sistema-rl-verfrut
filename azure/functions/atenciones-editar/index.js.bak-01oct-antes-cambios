/* ═══════════════════════════════════════════════════════════════════════════
   atenciones-editar (_EDIT_AZURE_PRIMERO_V1, 01-oct-2026)
   POST /api/atenciones/editar   (la pantalla, con el token del login)
   EDITAR una atencion DIRECTO en Azure (antes: 18 s por la hoja de Google).
   Misma regla que updateAtencion del Apps Script:
     · Solo se cambian los campos que llegan (un campo ausente no se toca).
     · Supervisor que NO registro la atencion: solo puede cambiar el ESTADO.
     · N° licencia / parentesco / autorizado por / fin de periodo: solo desde el
       formulario completo (trae autorizado_por) y un campo vacio NO borra lo guardado.
   La hoja de Google la actualiza despues la pantalla (updateAtencionDesdeAzure).
   Respuestas: 200 ok · 403 sin permiso (Google diria lo mismo, no se reintenta)
     · 404 no esta en Azure / 409 N° ambiguo / 400 dato malo / 503 apagado
       -> la pantalla edita por Google como siempre.
   INTERRUPTOR: AtConfig 'azure_editar' = '0' apaga; sin valor sigue a 'azure_primero'.
   ?prueba=1 -> hace todo y DESHACE (no guarda).
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../shared/db');
const G = require('../shared/at-guardar');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}

/* campo del formulario -> [tipo, largo] (mismos campos que escribe updateAtencion en la hoja) */
const TXT = { hora_inicio: 10, hora_termino: 10, empresa: 50, fundo: 100, cargo: 150, ruta: 50, fundo_actual: 100,
  celular: 20, detalle_documento: 500, responsable_recepcion: 150, estado: 30 };
const FECHAS = ['fecha_inicio_periodo', 'fecha_inicio_doc', 'fecha_termino_doc'];
const NO_CUENTAN = ['action', 'nro', 'rol', 'usuario', 'estado', 'client_id'];   /* para decidir "solo cambia el estado" */

async function interruptor(pool) {
  const [ed, prim] = await Promise.all([G.config(pool, 'azure_editar'), G.config(pool, 'azure_primero')]);
  if (ed === '0') return false;
  if (ed === '1') return true;
  return prim === '1';
}

module.exports = async function (context, req) {
  const b = req.body || {};
  const prueba = String((req.query && req.query.prueba) || '') === '1';
  const t0 = Date.now();
  try {
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const nro = parseInt(b.nro, 10);
    if (!nro) { context.res = { status: 400, body: { success: false, error: 'Falta N°' } }; return; }
    const pool = await getPool();
    await G.asegurarTablas(pool);
    if (!prueba && !(await interruptor(pool))) {
      context.res = { status: 503, body: { success: false, apagado: true, error: 'Edicion en Azure apagada' } }; return;
    }

    /* 1) ubicar la atencion: el año mas reciente con ese N° (como la hoja del año primero) */
    const dni = String(b.dni == null ? '' : b.dni).trim();
    const f = await pool.request().input('n', sql.Int, nro).input('d', sql.NVarChar(15), dni).query(`
      SELECT id, anio, dni, usuario_sistema FROM dbo.Atenciones
      WHERE nro = @n AND (@d = N'' OR dni = @d)
        AND anio = (SELECT MAX(anio) FROM dbo.Atenciones WHERE nro = @n AND (@d = N'' OR dni = @d))`);
    const filas = f.recordset;
    if (!filas.length) { context.res = { status: 404, body: { success: false, noEsta: true, error: 'Atencion no encontrada en Azure' } }; return; }
    const dnis = Array.from(new Set(filas.map(x => String(x.dni || '').trim())));
    if (dnis.length > 1) { context.res = { status: 409, body: { success: false, ambiguo: true, error: 'N° repetido con distinto DNI' } }; return; }
    const fila = filas[0];

    /* 2) permisos (igual que updateAtencion): el rol y el usuario salen del TOKEN */
    const rol = String(t.rol || b.rol || '').trim().toLowerCase();
    const usuario = String(t.usuario).trim();
    const soloEstado = Object.keys(b).filter(k => NO_CUENTAN.indexOf(k) < 0).length === 0;
    const ajeno = rol === 'supervisor' && String(fila.usuario_sistema || '').trim() !== usuario;
    if (ajeno && !soloEstado) { context.res = { status: 403, body: { success: false, error: 'No tienes permiso para editar este registro.' } }; return; }
    if (ajeno) context.log('[atenciones-editar] cambio de estado por otro supervisor: N° ' + nro + ' por ' + usuario + ' (registro de ' + fila.usuario_sistema + ')');

    /* 3) armar el UPDATE solo con lo que llego */
    const P = [], set = [];   /* [nombre, tipo, valor] -> se cargan en la transaccion */
    const r = { input(n, ty, v) { P.push([n, ty, v]); return r; } };
    Object.keys(TXT).forEach(k => {
      if (b[k] === undefined) return;
      r.input(k, sql.NVarChar(TXT[k]), String(b[k] == null ? '' : b[k]).trim().slice(0, TXT[k])); set.push(k + ' = @' + k);
    });
    if (b.observaciones !== undefined) { r.input('observaciones', sql.NVarChar(sql.MAX), String(b.observaciones == null ? '' : b.observaciones)); set.push('observaciones = @observaciones'); }
    FECHAS.forEach(k => { if (b[k] === undefined) return; r.input(k, sql.Date, G.fechaValida(b[k])); set.push(k + ' = @' + k); });
    if (b.dias_transcurridos !== undefined) { r.input('dias_transcurridos', sql.Int, parseInt(b.dias_transcurridos, 10) || 0); set.push('dias_transcurridos = @dias_transcurridos'); }
    if (b.fecha_atencion !== undefined) {
      const fa = G.fechaValida(b.fecha_atencion);
      if (fa) {   /* el año (clave del registro) no cambia, igual que la sincronizacion desde la hoja */
        r.input('fecha_atencion', sql.Date, fa).input('mes', sql.Int, +fa.slice(5, 7)).input('nro_semana', sql.Int, G.semana(fa));
        set.push('fecha_atencion = @fecha_atencion', 'mes = @mes', 'nro_semana = @nro_semana');
      }
    }
    if (b.autorizado_por !== undefined) {   /* _AT_COLS_V1: un campo vacio NO borra lo que ya estaba */
      r.input('nro_licencia', sql.NVarChar(40), String(b.nro_licencia || '').trim().slice(0, 40))
       .input('parentesco', sql.NVarChar(40), G.parValor(b.parentesco))
       .input('autorizado_por', sql.NVarChar(100), String(b.autorizado_por || '').trim().slice(0, 100))
       .input('fecha_termino_periodo', sql.Date, G.fechaValida(b.fecha_termino_periodo));
      set.push("nro_licencia = CASE WHEN @nro_licencia <> N'' THEN @nro_licencia ELSE nro_licencia END",
               "parentesco = CASE WHEN @parentesco <> N'' THEN @parentesco ELSE parentesco END",
               "autorizado_por = CASE WHEN @autorizado_por <> N'' THEN @autorizado_por ELSE autorizado_por END",
               'fecha_termino_periodo = COALESCE(@fecha_termino_periodo, fecha_termino_periodo)');
    }
    if (!set.length) { context.res = { status: 200, body: { success: true, nro, sinCambios: true, fuente: 'azure' } }; return; }

    r.input('n', sql.Int, nro).input('a', sql.Int, fila.anio).input('d', sql.NVarChar(15), String(fila.dni || ''));
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let filasAct = 0;
    try {
      const q = new sql.Request(tx);
      P.forEach(x => q.input(x[0], x[1], x[2]));
      const u = await q.query(`SET NOCOUNT ON; UPDATE dbo.Atenciones SET ${set.join(', ')} WHERE nro = @n AND anio = @a AND dni = @d; SELECT @@ROWCOUNT AS n;`);
      filasAct = u.recordset[0].n;
      if (prueba) await tx.rollback(); else await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    if (!prueba) { try { require('../shared/stats-pizarron').invalidar(); } catch (eP) {} }   /* las cifras del Dashboard toman el cambio (p. ej. FINALIZADO) */
    const ms = Date.now() - t0;
    context.log('[atenciones-editar] N° ' + nro + ' (' + fila.anio + ') por ' + usuario + ': ' + set.length + ' campo(s), ' + filasAct + ' fila(s), ' + ms + ' ms' + (prueba ? ' [PRUEBA, deshecho]' : ''));
    context.res = { status: 200, body: { success: true, nro, anio: fila.anio, filas: filasAct, campos: set.length, prueba, fuente: 'azure', ms } };
  } catch (err) {
    context.log.error('[atenciones-editar] ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
