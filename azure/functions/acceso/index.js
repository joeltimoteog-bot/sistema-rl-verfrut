/* ═══════════════════════════════════════════════════════════════════════════
   acceso  (_ACCESO_AZURE_V1, 26-set-2026) — ACCESO A MODULOS desde Azure
   POST /api/acceso/{accion}   accion = permisosListar | permisosGuardar |
        accesoHorarioDeUsuario | accesoHorarioListar | accesoHorarioGuardar |
        accesoHorarioEliminar
   Seguridad: quien es y que rol tiene sale del TOKEN FIRMADO del login (JWT),
   no de lo que manda el navegador. Cambiar permisos u horarios exige token
   valido de administrador, aunque el resto del sistema este en modo suave.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const A = require('../shared/acceso-db');

const PERM_LEGADO = ['jtimoteo','ovilela','jchavez','ecastro','sviera','almartinez','mmechato','rmolero','smiranda',
  'ptamayo','atineo','fpulache','fzapata','yluzon','javendano','jsiancas','dquispe','lmorales','nestrada','dreyna',
  'tvera','rfigueroa','cbecerra','dsanchez','mportocarrero','jhernandez','jfernandez','lcovenas','cviviana','mypanaque','jborrero'];
const PERM_DEFECTO = ['mod_dashboard', 'navAt', 'navMisEstadisticas'];
const PERM_ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02'];
const AH_ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}
const esAdminPerm = (t) => !!t && PERM_ROLES_ADMIN.indexOf(A.usr(t.rol)) >= 0;
const esAdminHor = (t) => !!t && (A.usr(t.usuario) === 'jtimoteo' || AH_ROLES_ADMIN.indexOf(A.usr(t.rol)) >= 0);
const NO_AUTORIZADO = (msg) => ({ status: 403, body: { success: false, error: msg, requiereToken: true } });

async function permisosListar(b, t) {
  const p = await A.pool();
  const quien = A.usr((t && t.usuario) || b.usuario);
  const rol = A.usr((t && t.rol) || b.rol);
  if (b.todos) {
    if (!esAdminPerm(t)) return NO_AUTORIZADO('Solo un administrador puede ver todos los permisos.');
    const r = await p.request().query('SELECT usuario, modulo, permitido FROM dbo.PermisosModulos');
    const out = {};
    r.recordset.forEach(x => { (out[x.usuario] = out[x.usuario] || {})[x.modulo] = !!x.permitido; });
    return { status: 200, body: { success: true, permisos: out, vacio: false, esAdmin: true, fuente: 'azure' } };
  }
  const r = await p.request().input('u', A.sql.NVarChar(60), quien)
    .query('SELECT modulo, permitido FROM dbo.PermisosModulos WHERE usuario = @u');
  let mios = null;
  if (r.recordset.length) { mios = {}; r.recordset.forEach(x => { mios[x.modulo] = !!x.permitido; }); }
  if (!mios && PERM_LEGADO.indexOf(quien) < 0 && PERM_ROLES_ADMIN.indexOf(rol) < 0 && ['coordinador', 'jefa_rl'].indexOf(rol) < 0) {
    return { status: 200, body: { success: true, permisos: {}, vacio: false, porDefecto: true, permitidos: PERM_DEFECTO, usuario: quien, fuente: 'azure' } };
  }
  return { status: 200, body: { success: true, permisos: mios || {}, vacio: !mios, usuario: quien, fuente: 'azure' } };
}

async function permisosGuardar(b, t) {
  if (!esAdminPerm(t)) return NO_AUTORIZADO('Solo un administrador puede cambiar permisos.');
  const objetivo = A.usr(b.usuarioObjetivo);
  if (!objetivo) return { status: 200, body: { success: false, error: 'Falta indicar de que usuario son los permisos.' } };
  const mods = b.modulos || {}, claves = Object.keys(mods).filter(k => String(k).trim());
  if (!claves.length) return { status: 200, body: { success: false, error: 'No se recibio ningun modulo.' } };
  const p = await A.pool(), por = A.usr(t.usuario);
  const tx = new A.sql.Transaction(p);
  await tx.begin();
  let borradas = 0;
  try {
    const d = await tx.request().input('u', A.sql.NVarChar(60), objetivo).query('DELETE FROM dbo.PermisosModulos WHERE usuario = @u');
    borradas = (d.rowsAffected && d.rowsAffected[0]) || 0;
    for (const k of claves) {
      await tx.request().input('u', A.sql.NVarChar(60), objetivo).input('m', A.sql.NVarChar(80), String(k).slice(0, 80))
        .input('p', A.sql.Bit, mods[k] ? 1 : 0).input('por', A.sql.NVarChar(60), por)
        .query('INSERT INTO dbo.PermisosModulos (usuario, modulo, permitido, actualizado, por) VALUES (@u, @m, @p, SYSUTCDATETIME(), @por)');
    }
    await tx.commit();
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  const permitidos = claves.filter(k => mods[k]).length;
  return { status: 200, body: { success: true, usuario: objetivo, total: claves.length, permitidos, reemplazadas: borradas, fuente: 'azure' } };
}

async function leerHorarios(p) {
  const r = await p.request().query('SELECT * FROM dbo.AccesoHorarios');
  return r.recordset.map(A.filaHorario).filter(f => f.usuario);
}

async function accesoHorarioDeUsuario(b) {
  const usuario = A.usr(b.usuario);
  if (!usuario) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'sin usuario' } };
  const p = await A.pool();
  const r = await p.request().input('u', A.sql.NVarChar(60), usuario).query('SELECT * FROM dbo.AccesoHorarios WHERE usuario = @u AND activo = 1');
  const reg = r.recordset.length ? A.filaHorario(r.recordset[0]) : null;
  if (!reg) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'sin horario propio', fuente: 'azure' } };
  if (reg.ini < 0 || reg.fin < 0) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'horas invalidas' } };
  const L = A.limaAhora();
  if (reg.desde && L.iso < reg.desde) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'aun no vigente', vigenteDesde: reg.desde } };
  if (reg.hasta && L.iso > reg.hasta) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'vencido', vigenteHasta: reg.hasta } };
  const h = L.h, dowHoy = L.dow, dowAyer = dowHoy === 1 ? 7 : dowHoy - 1, cruza = reg.fin <= reg.ini;
  let dentro = false, finAbs = null;
  if (!cruza) { if (reg.dias.indexOf(dowHoy) >= 0 && h >= reg.ini && h < reg.fin) { dentro = true; finAbs = reg.fin; } }
  else {
    if (reg.dias.indexOf(dowHoy) >= 0 && h >= reg.ini) { dentro = true; finAbs = reg.fin + 24; }
    else if (reg.dias.indexOf(dowAyer) >= 0 && h < reg.fin) { dentro = true; finAbs = reg.fin; }
  }
  if (!dentro) return { status: 200, body: { success: true, tieneAcceso: false, motivo: 'fuera de su horario', horario: A.txt(reg.ini) + ' a ' + A.txt(reg.fin), dias: reg.dias, fuente: 'azure' } };
  const minutos = Math.max(1, Math.round((finAbs - h) * 60));
  return { status: 200, body: { success: true, tieneAcceso: true, hastaHora: A.txt(reg.fin), hasta: A.txt(reg.fin),
    expiraEn: Date.now() + minutos * 60000, minutosRestantes: minutos, fuente: 'horario_propio', origen: 'azure' } };
}

async function accesoHorarioListar(b, t) {
  if (!esAdminHor(t)) return NO_AUTORIZADO('Solo un administrador puede ver los horarios de acceso.');
  const filas = (await leerHorarios(await A.pool())).map(f => ({
    fila: 0, usuario: f.usuario, horaInicio: A.txt(f.ini), horaFin: A.txt(f.fin), dias: f.dias, desde: f.desde, hasta: f.hasta,
    activo: f.activo, nota: f.nota, cruzaMedianoche: f.fin <= f.ini, actualizado: f.actualizado, por: f.por }));
  return { status: 200, body: { success: true, horarios: filas, hoja: 'Azure', total: filas.length, fuente: 'azure' } };
}

async function accesoHorarioGuardar(b, t) {
  if (!esAdminHor(t)) return NO_AUTORIZADO('Solo un administrador puede cambiar los horarios de acceso.');
  const d = b.horario || {};
  const destino = A.usr(d.usuario);
  if (!destino) return { status: 200, body: { success: false, error: 'Falta el usuario.' } };
  const ini = A.hora(d.horaInicio), fin = A.hora(d.horaFin);
  if (ini < 0 || fin < 0) return { status: 200, body: { success: false, error: 'Horas invalidas. Usa el formato 05:30 y 23:00.' } };
  if (ini === fin) return { status: 200, body: { success: false, error: 'La hora de inicio y la de fin no pueden ser la misma.' } };
  const desde = A.fecha(d.desde), hasta = A.fecha(d.hasta);
  if (d.desde && !desde) return { status: 200, body: { success: false, error: 'Fecha DESDE invalida. Usa 2026-09-28.' } };
  if (d.hasta && !hasta) return { status: 200, body: { success: false, error: 'Fecha HASTA invalida. Usa 2026-12-31.' } };
  if (desde && hasta && hasta < desde) return { status: 200, body: { success: false, error: 'HASTA no puede ser anterior a DESDE.' } };
  const ds = A.dias(d.dias), activo = !(d.activo === false || String(d.activo).toUpperCase() === 'NO');
  const p = await A.pool();
  await p.request()
    .input('u', A.sql.NVarChar(60), destino).input('i', A.sql.NVarChar(5), A.txt(ini)).input('f', A.sql.NVarChar(5), A.txt(fin))
    .input('d', A.sql.NVarChar(20), ds.join(',')).input('de', A.sql.NVarChar(10), desde || null).input('ha', A.sql.NVarChar(10), hasta || null)
    .input('a', A.sql.Bit, activo ? 1 : 0).input('n', A.sql.NVarChar(300), String(d.nota || '').slice(0, 300))
    .input('s', A.sql.NVarChar(20), A.limaAhora().sello).input('por', A.sql.NVarChar(60), A.usr(t.usuario))
    .query(`MERGE dbo.AccesoHorarios AS x USING (SELECT @u AS usuario) AS s ON x.usuario = s.usuario
            WHEN MATCHED THEN UPDATE SET hora_inicio=@i, hora_fin=@f, dias=@d, desde=@de, hasta=@ha, activo=@a, nota=@n, actualizado=@s, por=@por
            WHEN NOT MATCHED THEN INSERT (usuario, hora_inicio, hora_fin, dias, desde, hasta, activo, nota, actualizado, por)
                                  VALUES (@u, @i, @f, @d, @de, @ha, @a, @n, @s, @por);`);
  return { status: 200, body: { success: true, fila: 0, usuario: destino, horario: A.txt(ini) + ' a ' + A.txt(fin),
    cruzaMedianoche: fin <= ini, dias: ds, desde, hasta, activo, aviso: 'Surte efecto en el siguiente ingreso de ' + destino + '.', fuente: 'azure' } };
}

async function accesoHorarioEliminar(b, t) {
  if (!esAdminHor(t)) return NO_AUTORIZADO('Solo un administrador puede quitar horarios de acceso.');
  const destino = A.usr(b.destino);
  if (!destino) return { status: 200, body: { success: false, error: 'Falta el usuario.' } };
  const p = await A.pool();
  const r = await p.request().input('u', A.sql.NVarChar(60), destino).query('DELETE FROM dbo.AccesoHorarios WHERE usuario = @u');
  if (!((r.rowsAffected && r.rowsAffected[0]) > 0)) return { status: 200, body: { success: false, error: 'Ese usuario no tenia horario propio.' } };
  return { status: 200, body: { success: true, usuario: destino, aviso: 'Vuelve al horario general 05:30 a 17:00.', fuente: 'azure' } };
}

const ACCIONES = { permisosListar, permisosGuardar, accesoHorarioDeUsuario, accesoHorarioListar, accesoHorarioGuardar, accesoHorarioEliminar };

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const fn = ACCIONES[accion];
  if (!fn) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida: ' + accion } }; return; }
  try {
    const r = await fn(req.body || {}, token(req));
    context.res = { status: r.status, body: r.body };
  } catch (e) {
    context.log.error('[acceso] ' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
