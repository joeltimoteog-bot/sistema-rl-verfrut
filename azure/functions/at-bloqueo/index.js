/* ═══════════════════════════════════════════════════════════════════════════
   at-bloqueo (_AT_BLOQUEO_V1, 12-nov-2026) — Bloqueo temporal del Registro de Atenciones
   POST /api/at-bloqueo/estado     (sin sesion)  -> { success, ahoraMs, bloqueos:[{id,motivo,mensaje,desdeMs,hastaMs}] }
        Solo dice si hay un bloqueo activo o programado y su mensaje. Lo consultan la pantalla y el Apps Script.
   POST /api/at-bloqueo/listar     (administrador) -> ultimos 40 bloqueos, con su estado
   POST /api/at-bloqueo/programar  (administrador) { motivo, fecha:'AAAA-MM-DD', desde:'HH:MM', hasta:'HH:MM', mensaje }
                                                   o { motivo, ahora:true, minutos, mensaje }   (hora de Lima)
   POST /api/at-bloqueo/cancelar   (administrador) { id }   -> si estaba activo, el registro se abre al instante
   Reglas: dura como maximo 2 horas; no puede terminar en el pasado; no se borra nada (cancelar = marca).
   Quien programa sale del token del login (administrador, coordinador, jefatura o el creador del sistema).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const B = require('../shared/at-bloqueo');
const MOTIVOS = ['Cierre de quincena', 'Cierre de mes', 'Otro'];
const MSG_DEF = 'El registro de atenciones está bloqueado temporalmente porque el área de Bienestar está descargando la base de atenciones para validar los registros realizados.';
const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 600);
function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
const lima = (fecha, hm) => new Date(fecha + 'T' + hm + ':00-05:00');   /* Peru no cambia de hora: siempre UTC-5 */
const estadoDe = (x, ah) => x.cancelado ? 'Cancelado' : ah < new Date(x.desde).getTime() ? 'Programado' : ah < new Date(x.hasta).getTime() ? 'Activo' : 'Terminado';

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  try {
    if (accion === 'estado') {
      const v = await B.vigentes();
      context.res = { status: 200, body: { success: true, ahoraMs: Date.now(), bloqueos: v } }; return;
    }
    if (['listar', 'programar', 'cancelar'].indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    if (!B.exento(t)) { context.res = { status: 403, body: { success: false, error: 'Solo el administrador programa el bloqueo de atenciones' } }; return; }
    const p = B.pool();
    if (!p) { context.res = { status: 503, body: { success: false, error: 'Este modulo solo funciona con Supabase' } }; return; }
    const usuario = String(t.usuario).toLowerCase().trim();

    if (accion === 'listar') {
      const r = await p.query(`SELECT id, motivo, mensaje, desde, hasta, creado_por, cancelado, cancelado_por FROM rl.at_bloqueos ORDER BY desde DESC LIMIT 40`);
      const ah = Date.now();
      context.res = { status: 200, body: { success: true, ahoraMs: ah, mensajePorDefecto: MSG_DEF, motivos: MOTIVOS,
        data: r.rows.map((x) => ({ id: x.id, motivo: x.motivo, mensaje: x.mensaje, desdeMs: new Date(x.desde).getTime(), hastaMs: new Date(x.hasta).getTime(),
          creado_por: x.creado_por, cancelado_por: x.cancelado_por || '', estado: estadoDe(x, ah) })) } }; return;
    }
    if (accion === 'programar') {
      const motivo = MOTIVOS.indexOf(s(b.motivo, 40)) >= 0 ? s(b.motivo, 40) : 'Otro';
      let desde, hasta;
      if (b.ahora === true) {
        const min = Math.max(5, Math.min(120, parseInt(b.minutos, 10) || 30));
        desde = new Date(); hasta = new Date(desde.getTime() + min * 60000);
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s(b.fecha, 10)) || !/^\d{2}:\d{2}$/.test(s(b.desde, 5)) || !/^\d{2}:\d{2}$/.test(s(b.hasta, 5))) {
          context.res = { status: 200, body: { success: false, error: 'Indica la fecha, la hora de inicio y la hora de fin' } }; return;
        }
        desde = lima(s(b.fecha, 10), s(b.desde, 5)); hasta = lima(s(b.fecha, 10), s(b.hasta, 5));
      }
      if (isNaN(desde) || isNaN(hasta)) { context.res = { status: 200, body: { success: false, error: 'Fecha u hora no valida' } }; return; }
      if (hasta <= desde) { context.res = { status: 200, body: { success: false, error: 'La hora de fin debe ser posterior a la de inicio' } }; return; }
      if (hasta.getTime() - desde.getTime() > 120 * 60000) { context.res = { status: 200, body: { success: false, error: 'El bloqueo no puede durar mas de 2 horas' } }; return; }
      if (hasta.getTime() <= Date.now()) { context.res = { status: 200, body: { success: false, error: 'Ese horario ya paso' } }; return; }
      const mensaje = s(b.mensaje, 600) || MSG_DEF;
      /* no se permiten dos bloqueos que se pisen */
      const cruce = await p.query(`SELECT id FROM rl.at_bloqueos WHERE cancelado = false AND desde < $2 AND hasta > $1 LIMIT 1`, [desde, hasta]);
      if (cruce.rows.length) { context.res = { status: 200, body: { success: false, error: 'Ya hay un bloqueo programado que se cruza con ese horario. Cancela ese primero.' } }; return; }
      const r = await p.query(`INSERT INTO rl.at_bloqueos (motivo, desde, hasta, mensaje, creado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [motivo, desde, hasta, mensaje, usuario]);
      B.olvidar();
      context.log('[_AT_BLOQUEO_V1] ' + usuario + ' programo el bloqueo ' + r.rows[0].id + ' (' + motivo + ') de ' + desde.toISOString() + ' a ' + hasta.toISOString());
      context.res = { status: 200, body: { success: true, id: r.rows[0].id, desdeMs: desde.getTime(), hastaMs: hasta.getTime() } }; return;
    }
    if (accion === 'cancelar') {
      const id = parseInt(b.id, 10) || 0;
      const r = await p.query(`UPDATE rl.at_bloqueos SET cancelado = true, cancelado_por = $2, cancelado_en = now() WHERE id = $1 AND cancelado = false AND hasta > now()`, [id, usuario]);
      B.olvidar();
      context.log('[_AT_BLOQUEO_V1] ' + usuario + ' cancelo el bloqueo ' + id);
      context.res = { status: 200, body: { success: r.rowCount > 0, error: r.rowCount ? undefined : 'Ese bloqueo ya termino o ya estaba cancelado' } }; return;
    }
  } catch (e) {
    context.log.error('[at-bloqueo] ' + accion + ': ' + e.message);
    /* estado nunca debe romper la pantalla: ante cualquier falla, "sin bloqueos" */
    if (accion === 'estado') { context.res = { status: 200, body: { success: true, ahoraMs: Date.now(), bloqueos: [], aviso: 'sin datos' } }; return; }
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
