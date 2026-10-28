/* ═══════════════════════════════════════════════════════════════════════════
   _USR_AZURE_V1 (27-set-2026) — USUARIOS y ACCESOS TEMPORALES primero en Azure
   ---------------------------------------------------------------------------
   saveUsuario / updateUsuario   → dbo.usuarios (la tabla del login). Contraseña CIFRADA
                                   (bcrypt); a la hoja va la version cifrada, nunca legible.
   saveSolicitudAcceso           → dbo.Acceso_Solicitudes (la pide el propio usuario: su
                                   usuario sale del token). Horas: las que pidio (antes siempre 1).
   resolverAccesoTemporal        → aprobar / rechazar (= aprobarAccesoTemporal del Apps Script)
   Permisos (decision de Joel, 27-set): crear/editar usuarios y resolver accesos SOLO jtimoteo.
   OJO: en estas acciones 'usuario' del cuerpo NO es quien opera (es el usuario creado,
   editado o el que pide el acceso); quien opera sale SIEMPRE del token.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const bcrypt = require('bcryptjs');
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['saveUsuario', 'updateUsuario', 'saveSolicitudAcceso', 'resolverAccesoTemporal', 'aprobarAccesoTemporal', 'cambiarMiClave', 'desbloquearUsuario', 'eliminarUsuario', 'restaurarUsuario'];   /* _USR_BAJA_V1 */   /* _SEG_USUARIOS_V1 */   /* _CLAVE_POLITICA_V1 */
const POL = require('./clave-politica');
const DUENOS = ['jtimoteo'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
function lima(ms) { const x = new Date(ms - 5 * 3600e3); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes() }; }
const hhmm = ms => { const p = lima(ms); return p2(p.h) + ':' + p2(p.mi); };                                     /* formatDate(...,'HH:mm') */
const dmyhm = ms => { const p = lima(ms); return p2(p.d) + '/' + p2(p.m) + '/' + p.y + ' ' + p2(p.h) + ':' + p2(p.mi); };   /* 'dd/MM/yyyy HH:mm' */

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'usr_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}
async function cambiarFila(tx, clave, fila, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, fila);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}

async function ejecutar(pool, accion, b, operador, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  if (accion === 'aprobarAccesoTemporal') accion = 'resolverAccesoTemporal';
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'acc_solicitudes');
  const op = String(operador || '').trim().toLowerCase();
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const no = e => ({ status: 200, body: { success: false, error: e } });
  /* _CLAVE_POLITICA_V1 (18-oct-2026): cualquier usuario cambia SU propia clave: verifica la actual (bcrypt),
     exige la regla minima y sigue por el mismo camino que updateUsuario (bcrypt en Azure, sha256 en la hoja). */
  let propia = false;
  if (accion === 'cambiarMiClave') {
    if (!op) return no('Sin sesion valida.');
    const actual = String(b.actual || ''), nueva = String(b.nueva || '');
    if (!actual || !nueva) return no('Escribe tu contraseña actual y la nueva.');
    const pol = POL.evaluar(nueva, op);
    if (!pol.ok) return no('La nueva contraseña no cumple la regla: ' + pol.motivos.join('; ') + '.');
    if (nueva === actual) return no('La nueva contraseña debe ser distinta a la actual.');
    const ru = await pool.request().input('u', sql.NVarChar(100), op).query('SELECT password FROM dbo.usuarios WHERE LOWER(usuario) = @u AND activo = 1');
    if (!ru.recordset.length) return no('Usuario no encontrado.');
    const stored = String(ru.recordset[0].password || '');
    const okActual = /^\$2[aby]\$/.test(stored) ? await bcrypt.compare(actual, stored) : stored === actual;
    if (!okActual) return no('La contraseña actual no es correcta.');
    b = { usuario: op, password: nueva, client_id: b.client_id };
    accion = 'updateUsuario'; propia = true;
  }
  if (accion !== 'saveSolicitudAcceso' && !propia && DUENOS.indexOf(op) < 0)
    return no(accion === 'resolverAccesoTemporal' ? 'Solo el administrador del sistema puede aprobar o rechazar accesos temporales.' : 'Solo el administrador del sistema puede crear o modificar usuarios.');
  /* _USR_BAJA_V1 (27-oct-2026): "Eliminar" = dar de baja. No se borra la fila: queda eliminado = 1 (con fecha, quien y
     motivo) y activo = 0 (el login de los 4 sistemas solo deja entrar a activos). Sus registros historicos no se tocan.
     La lista /usuarios/lista ya no lo muestra (salvo ?incluirEliminados=1). "Restaurar" lo devuelve activo.
     El cambio de 'activo' sigue el camino normal de updateUsuario, asi la hoja de Google queda igual que Azure. */
  if (accion === 'eliminarUsuario' || accion === 'restaurarUsuario') {
    const uu = String(b.usuario || '').trim();
    if (!uu) return no('Falta el usuario.');
    if (accion === 'eliminarUsuario' && (DUENOS.indexOf(uu.toLowerCase()) >= 0 || uu.toLowerCase() === op)) return no('No puedes eliminar tu propia cuenta de administrador.');
    await pool.request().query("IF COL_LENGTH('dbo.usuarios','eliminado') IS NULL ALTER TABLE dbo.usuarios ADD eliminado BIT NULL, eliminado_en DATETIME2(0) NULL, eliminado_por NVARCHAR(100) NULL, motivo_baja NVARCHAR(300) NULL");
    const rq = pool.request().input('u', sql.NVarChar(100), uu.toLowerCase());
    if (accion === 'eliminarUsuario') {
      rq.input('por', sql.NVarChar(100), op).input('mot', sql.NVarChar(300), String(b.motivo || '').trim().slice(0, 300) || null);
      const r0 = await rq.query("UPDATE dbo.usuarios SET eliminado = 1, eliminado_en = SYSUTCDATETIME(), eliminado_por = @por, motivo_baja = @mot WHERE LOWER(LTRIM(RTRIM(usuario))) = @u");
      if (!r0.rowsAffected[0]) return no('Usuario no encontrado.');
    } else {
      const r0 = await rq.query("UPDATE dbo.usuarios SET eliminado = 0 WHERE LOWER(LTRIM(RTRIM(usuario))) = @u");
      if (!r0.rowsAffected[0]) return no('Usuario no encontrado.');
    }
    b = { usuario: uu, activo: accion === 'eliminarUsuario' ? 'FALSE' : 'TRUE', client_id: b.client_id ? String(b.client_id) + '-act' : undefined };
    accion = 'updateUsuario';
  }
  /* _SEG_USUARIOS_V1 (26-oct-2026): el administrador libera un bloqueo por intentos sin tocar la clave. */
  if (accion === 'desbloquearUsuario') {
    const uu = String(b.usuario || '').trim().toLowerCase();
    if (!uu) return no('Falta el usuario.');
    await pool.request().input('u', sql.NVarChar(100), uu)
      .query("IF OBJECT_ID('dbo.Login_Intentos','U') IS NOT NULL UPDATE dbo.Login_Intentos SET fallos = 0, bloqueado_hasta = NULL WHERE usuario = @u");
    return { status: 200, body: { success: true, usuario: uu, mensaje: 'Bloqueo liberado; el usuario ya puede intentar entrar.' } };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now(), ahora = new Date(ms);
  let hash = null, hashHoja = null;
  if (accion === 'saveUsuario' && String(b.password || '').trim()) hash = await bcrypt.hash(String(b.password).trim(), 10);
  if (accion === 'updateUsuario' && b.password) hash = await bcrypt.hash(String(b.password), 10);
  /* _CLAVE_HOJA_SHA_V1 (18-oct-2026): a la hoja de Google va 'sha256$sal$hex' (Apps Script puede verificarla con
     Utilities.computeDigest para el login de respaldo); en Azure sigue bcrypt. Nunca texto legible. */
  if (hash) { const crypto = require('crypto'); const sal = crypto.randomBytes(8).toString('hex');
    const txt = accion === 'saveUsuario' ? String(b.password).trim() : String(b.password);
    hashHoja = 'sha256$' + sal + '$' + crypto.createHash('sha256').update(sal + txt, 'utf8').digest('hex'); }

  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'usr_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    let resp, cuerpo = { accion }, tocar = [], extra = {};

    if (accion === 'saveUsuario') {
      const usuario = String(b.usuario || '').trim();
      if (!usuario || !hash) { await tx.rollback(); return no('Usuario y contraseña son obligatorios.'); }
      const ex = await tx.request().query('SELECT id_sistema, usuario FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK)');
      if (ex.recordset.some(x => String(x.usuario || '').trim().toLowerCase() === usuario.toLowerCase())) { await tx.rollback(); return no('Ese usuario ya existe.'); }
      const ids = new Set(ex.recordset.map(x => String(x.id_sistema)));
      let id; do { id = 'US-' + Math.floor(Math.random() * 90000 + 10000); } while (ids.has(id));
      const fila = [id, usuario, hash, String(b.nombre || '').trim(), String(b.rol || 'supervisor').trim().toLowerCase(),
        String(b.empresa || 'AMBAS').trim().toUpperCase(), true, ahora.toISOString(), String(b.correo || '').trim()];
      await tx.request().input('id', sql.NVarChar(50), id).input('u', sql.NVarChar(50), usuario).input('p', sql.NVarChar(255), hash)
        .input('n', sql.NVarChar(200), fila[3]).input('r', sql.NVarChar(50), fila[4]).input('e', sql.NVarChar(50), fila[5])
        .input('f', sql.DateTime2, ahora).input('c', sql.NVarChar(200), fila[8] || null)
        .query(`INSERT INTO dbo.usuarios (id_sistema, usuario, password, nombre, rol, empresa, activo, fecha_creacion, correo, fecha_sync)
                VALUES (@id, @u, @p, @n, @r, @e, 1, @f, @c, GETDATE())`);
      cuerpo.fila = fila.slice(); cuerpo.fila[2] = hashHoja || hash;   /* _CLAVE_HOJA_SHA_V1 */
      resp = { success: true };
      extra._clave_ok = await bcrypt.compare(String(b.password).trim(), hash);

    } else if (accion === 'updateUsuario') {
      const ex = await tx.request().query('SELECT id_sistema, usuario FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK)');
      const u = ex.recordset.find(x => String(x.usuario).trim() === String(b.usuario).trim());
      if (!u) { await tx.rollback(); return no('Usuario no encontrado.'); }
      const r = tx.request().input('id', sql.NVarChar(50), String(u.id_sistema)), sets = [];
      cuerpo.usuario = String(b.usuario).trim();
      if (b.activo !== undefined) { r.input('a', sql.Bit, String(b.activo).trim().toUpperCase() === 'TRUE' ? 1 : 0); sets.push('activo = @a'); cuerpo.activo = b.activo; }
      if (b.password) { r.input('p', sql.NVarChar(255), hash); sets.push('password = @p'); cuerpo.password = hashHoja || hash;   /* _CLAVE_HOJA_SHA_V1 */
        try { await tx.request().query("IF COL_LENGTH('dbo.usuarios','clave_fuerte') IS NULL ALTER TABLE dbo.usuarios ADD clave_fuerte BIT NULL, clave_cambiada DATETIME2(0) NULL"); } catch (eC) {}
        try { await tx.request().query("IF COL_LENGTH('dbo.usuarios','clave_temporal') IS NULL ALTER TABLE dbo.usuarios ADD clave_temporal BIT NULL"); } catch (eC) {}
        r.input('cf', sql.Bit, POL.evaluar(String(b.password), String(b.usuario)).ok ? 1 : 0); sets.push('clave_fuerte = @cf'); sets.push('clave_cambiada = SYSUTCDATETIME()');
        /* _CLAVE_TEMPORAL_V1: si la pone el administrador es temporal (el usuario debe cambiarla al entrar); si la cambia el propio usuario, deja de serlo */
        r.input('ct', sql.Bit, propia ? 0 : 1); sets.push('clave_temporal = @ct');
        /* y se levanta cualquier bloqueo por intentos */
        try { await tx.request().input('lu', sql.NVarChar(100), String(b.usuario).trim().toLowerCase()).query("IF OBJECT_ID('dbo.Login_Intentos','U') IS NOT NULL DELETE FROM dbo.Login_Intentos WHERE usuario = @lu"); } catch (eL) {} }   /* _SEG_USUARIOS_V1 */
      if (b.correo) { r.input('c', sql.NVarChar(200), String(b.correo)); sets.push('correo = @c'); cuerpo.correo = b.correo; }
      if (sets.length) await r.query(`UPDATE dbo.usuarios SET ${sets.join(', ')}, fecha_sync = GETDATE() WHERE id_sistema = @id`);
      resp = { success: true };

    } else if (accion === 'saveSolicitudAcceso') {
      const T = await TH.leer(pool, 'acc_solicitudes');
      if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de solicitudes de acceso aun no cargada' } }; }
      const nro = T.filas.length + 1;                                                   /* = ws.getLastRow() (con cabecera) */
      const horas = b.horas || b.horas_solicitadas || 1;                                 /* antes solo leia 'horas': siempre 1 */
      const fila = [nro, ahora, op, b.nombre || '', b.motivo || '', horas, 'PENDIENTE', '', '', '', ''];
      await CAP.agregarFilas(tx, 'acc_solicitudes', [fila.map(CAP.comoHoja)]); tocar.push('acc_solicitudes');
      cuerpo.fila = fila.map((v, i) => i === 1 ? { $f: ahora.toISOString() } : v);
      resp = { success: true, nro };
      extra._celdas = fila.map(CAP.comoHoja);

    } else {   /* resolverAccesoTemporal */
      const T = await TH.leer(pool, 'acc_solicitudes');
      if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de solicitudes de acceso aun no cargada' } }; }
      const filas = T.filas, pend = r => S(r[2] === undefined ? '' : r[2]).trim() === String(b.usuario).trim() && S(r[6] === undefined ? '' : r[6]).toUpperCase().trim() === 'PENDIENTE';
      let i = -1;
      if (b.fila) { const k = parseInt(b.fila, 10) - 2; if (k >= 0 && k < filas.length && pend(filas[k])) i = k; }   /* fila de la hoja (con cabecera) */
      if (i < 0) i = filas.findIndex(pend);
      if (i < 0) { await tx.rollback(); return no('Solicitud pendiente no encontrada para: ' + b.usuario); }
      let horas = parseInt(b.horas || b.horas_aprobadas, 10) || 0;
      if (!horas) horas = parseInt(S(filas[i][5] === undefined ? '' : filas[i][5]), 10) || 1;
      const hasta = ms + horas * 3600e3, decision = b.decision || 'APROBADO';
      const celdas = filas[i].slice(); while (celdas.length < 12) celdas.push('');
      celdas[5] = CAP.comoHoja(horas); celdas[6] = CAP.comoHoja(decision); celdas[7] = CAP.comoHoja(op);
      celdas[8] = CAP.comoHoja(hhmm(ms)); celdas[9] = CAP.comoHoja(hhmm(hasta)); celdas[10] = CAP.comoHoja(ahora); celdas[11] = CAP.comoHoja(hasta);
      await cambiarFila(tx, 'acc_solicitudes', i + 1, celdas); tocar.push('acc_solicitudes');
      cuerpo.fila = i + 2; cuerpo.usuario = String(b.usuario).trim(); cuerpo.nro = S(filas[i][0]);
      cuerpo.valores = { horas, decision, aprobado_por: op, hora_inicio: hhmm(ms), hora_fin: hhmm(hasta), fecha: ahora.toISOString(), expira: hasta };
      resp = { success: true, hastaHora: hhmm(hasta), hastaFecha: dmyhm(hasta), horasAprobadas: horas, expiraEn: hasta, decision };
      extra._celdas = celdas;
    }
    if (tocar.length) await CAP.tocarMarcas(tx, tocar);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), op || null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'usr', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; Object.assign(resp, extra); } else await tx.commit();
    return { status: 200, body: resp };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (clave && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}
module.exports = { ejecutar, encendido, ACCIONES };
