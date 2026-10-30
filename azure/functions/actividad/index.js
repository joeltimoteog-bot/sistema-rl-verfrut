/* ═══════════════════════════════════════════════════════════════════════════
   actividad (_ACTIVIDAD_V1, 29-oct-2026) — ACTIVIDAD DE USUARIOS
   POST /api/actividad/{accion}   (con el token del login RR.LL.)
     ingreso  { sistema, modulo }  -> suma 1 ingreso de hoy (dbo.Actividad_Ingresos)
     resumen  { anio }             -> usuarios, accesos, registros e ingresos por usuario/modulo/mes
     horas    { usuario, anio? }   -> detalle de lo que ese usuario registro en Acumulacion de Horas
   Quien ve a TODOS: el dueño (jtimoteo), los administradores y quien tenga "act_todos" en Acceso a
   Modulos. Los demas solo se ven a si mismos. Solo lectura de las tablas de negocio.
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../shared/db');

const DUENO = 'jtimoteo';
const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02'];
const low = (v) => String(v == null ? '' : v).toLowerCase().trim();
const norm = (v) => low(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { const t = jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); return t && t.usuario ? t : null; } catch (e) { return null; }
}
let tablaLista = null;
function asegurar(pool) {
  if (!tablaLista) tablaLista = pool.request().query(`
    IF OBJECT_ID('dbo.Actividad_Ingresos', 'U') IS NULL
      CREATE TABLE dbo.Actividad_Ingresos (fecha DATE NOT NULL, usuario NVARCHAR(60) NOT NULL, sistema NVARCHAR(40) NOT NULL,
        modulo NVARCHAR(80) NOT NULL, n INT NOT NULL DEFAULT 0, ultimo DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Actividad_Ingresos PRIMARY KEY (fecha, usuario, sistema, modulo));`).catch(e => { tablaLista = null; throw e; });
  return tablaLista;
}
async function veTodos(pool, t) {
  const u = low(t.usuario);
  if (u === DUENO || ROLES_ADMIN.indexOf(low(t.rol)) >= 0) return true;
  try {
    const r = await pool.request().input('u', sql.NVarChar(60), u)
      .query("SELECT COUNT(*) AS n FROM dbo.PermisosModulos WHERE usuario = @u AND modulo = 'act_todos' AND permitido = 1");
    return r.recordset[0].n > 0;
  } catch (e) { return false; }
}
function limaHoy() { const d = new Date(Date.now() - 5 * 3600e3); return d.toISOString().slice(0, 10); }
function fechaDe(v) {   /* celda de Google ({$d,$s}) o texto/fecha */
  if (v && typeof v === 'object' && v.$d) v = v.$d;
  const d = new Date(v); return isNaN(d.getTime()) ? null : new Date(d.getTime() - 5 * 3600e3);
}

async function ingreso(pool, t, b) {
  const sis = String(b.sistema || 'RR.LL.').slice(0, 40), mod = String(b.modulo || '').trim().slice(0, 80);
  if (!mod) return { success: false, error: 'Falta el modulo' };
  await pool.request().input('f', sql.Date, limaHoy()).input('u', sql.NVarChar(60), low(t.usuario))
    .input('s', sql.NVarChar(40), sis).input('m', sql.NVarChar(80), mod).query(`
    MERGE dbo.Actividad_Ingresos WITH (HOLDLOCK) AS x
    USING (SELECT @f AS fecha, @u AS usuario, @s AS sistema, @m AS modulo) AS y
      ON x.fecha = y.fecha AND x.usuario = y.usuario AND x.sistema = y.sistema AND x.modulo = y.modulo
    WHEN MATCHED THEN UPDATE SET n = x.n + 1, ultimo = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (fecha, usuario, sistema, modulo, n) VALUES (@f, @u, @s, @m, 1);`);
  return { success: true };
}

async function resumen(pool, t, b) {
  const anio = parseInt(b.anio, 10) || new Date().getFullYear();
  const todos = await veTodos(pool, t), yo = low(t.usuario);
  const U = (await pool.request().query(`SELECT usuario, nombre, rol, empresa, cargo, sector, activo, eliminado FROM dbo.usuarios`)).recordset
    .map(u => ({ usuario: low(u.usuario), nombre: u.nombre || '', rol: u.rol || '', empresa: u.empresa || '', cargo: u.cargo || '', sector: u.sector || '',
      activo: (u.activo === true || u.activo === 1 || String(u.activo).trim().toUpperCase() === 'TRUE') && !(u.eliminado === true || u.eliminado === 1),
      eliminado: u.eliminado === true || u.eliminado === 1 }))
    .filter(u => u.usuario && (todos || u.usuario === yo));
  const porNombre = {}; U.forEach(u => { porNombre[norm(u.nombre)] = u.usuario; porNombre[norm(u.usuario)] = u.usuario; });
  const quien = (v) => { const k = norm(v); return k ? (porNombre[k] || k) : ''; };
  const visible = (u) => todos || u === yo;
  const reg = {};   /* clave usuario|sistema|modulo|mes -> n */
  const sumar = (u, sis, mod, mes, n) => { if (!u || !visible(u) || !mes) return; const k = u + '|' + sis + '|' + mod + '|' + mes; reg[k] = (reg[k] || 0) + (n || 1); };
  const errores = [];
  const q = async (nombre, fn) => { try { await fn(); } catch (e) { errores.push(nombre + ': ' + e.message); } };

  await q('Atenciones', async () => {
    const r = await pool.request().input('a', sql.Int, anio).query(`SELECT usuario_sistema AS u, MONTH(d) AS m, COUNT(*) AS n
      FROM (SELECT usuario_sistema, TRY_CONVERT(date, fecha_atencion) AS d FROM dbo.Atenciones) x WHERE YEAR(d) = @a GROUP BY usuario_sistema, MONTH(d)`);
    r.recordset.forEach(x => sumar(quien(x.u), 'Sistema RR.LL.', 'Atenciones', x.m, x.n));
  });
  await q('Acumulación de horas', async () => {
    const r = await pool.request().input('a', sql.Int, anio).query(`SELECT registrado_por AS u, MONTH(fecha_registro) AS m, COUNT(*) AS n
      FROM dbo.Horas_Registros WHERE YEAR(fecha_registro) = @a AND ISNULL(estado, '') <> 'rechazado' AND ISNULL(motivo, '') NOT LIKE 'Compensaci%autom%'
      GROUP BY registrado_por, MONTH(fecha_registro)`);
    r.recordset.forEach(x => sumar(quien(x.u), 'Sistema RR.LL.', 'Acumulación de horas', x.m, x.n));
  });
  await q('Capacitaciones', async () => {
    const r = await pool.request().input('a', sql.Int, anio).query(`SELECT creada_por AS u, MONTH(fecha_registro) AS m, COUNT(*) AS n
      FROM dbo.Cap_Cabeceras WHERE YEAR(fecha_registro) = @a GROUP BY creada_por, MONTH(fecha_registro)`);
    r.recordset.forEach(x => sumar(quien(x.u), 'Sistema RR.LL.', 'Capacitaciones', x.m, x.n));
  });
  for (const [tabla, mod, col] of [['dbo.CV_Casos', 'Casos', 24], ['dbo.CV_Visitas', 'Visitas de campo', 22]]) {
    await q(mod, async () => {
      const r = await pool.request().query(`SELECT datos FROM ${tabla}`);
      r.recordset.forEach(x => { let d; try { d = JSON.parse(x.datos); } catch (e) { return; }
        const f = fechaDe(d && d[1]); if (!f || f.getUTCFullYear() !== anio) return;
        const v = d[col]; sumar(quien(v && typeof v === 'object' ? v.$s : v), 'Sistema RR.LL.', mod, f.getUTCMonth() + 1, 1); });
    });
  }
  let ingresos = [];
  await q('Ingresos', async () => {
    await asegurar(pool);
    const r = await pool.request().input('a', sql.Int, anio).query(`SELECT usuario, sistema, modulo, MONTH(fecha) AS m, SUM(n) AS n, MAX(ultimo) AS ultimo
      FROM dbo.Actividad_Ingresos WHERE YEAR(fecha) = @a GROUP BY usuario, sistema, modulo, MONTH(fecha)`);
    ingresos = r.recordset.filter(x => visible(low(x.usuario))).map(x => [low(x.usuario), x.sistema, x.modulo, x.m, x.n, x.ultimo]);
  });
  let accesos = {};
  await q('Accesos', async () => {
    const r = await pool.request().query('SELECT usuario, modulo, permitido FROM dbo.PermisosModulos');
    r.recordset.forEach(x => { const u = low(x.usuario); if (!visible(u)) return; (accesos[u] = accesos[u] || {})[x.modulo] = !!x.permitido; });
  });
  const registros = Object.keys(reg).map(k => { const p = k.split('|'); return [p[0], p[1], p[2], +p[3], reg[k]]; });
  return { success: true, anio, todos, yo, usuarios: U, accesos, registros, ingresos, errores, ingresosDesde: 'oct-2026', fuente: 'azure' };
}

async function horas(pool, t, b) {
  const todos = await veTodos(pool, t), objetivo = low(b.usuario) || low(t.usuario);
  if (!todos && objetivo !== low(t.usuario)) return { success: false, error: 'Solo puedes ver tus propios registros.' };
  const r = await pool.request().input('u', sql.NVarChar(60), objetivo).query(`SELECT id, fecha_registro, registrado_por, dni, nombre, empresa, fecha_entrada,
      hora_entrada, fecha_salida, hora_salida, horas_trabajadas, jornada_esperada, horas_acumuladas, horas_permiso, horas_deuda, motivo, estado, aprobado_por
    FROM dbo.Horas_Registros WHERE LOWER(registrado_por) = @u ORDER BY fecha_registro DESC`);
  return { success: true, usuario: objetivo, filas: r.recordset };
}

module.exports = async function (context, req) {
  const accion = context.bindingData.accion;
  const out = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  try {
    const t = token(req);
    if (!t) return out(401, { success: false, error: 'Sin sesion valida' });
    const pool = await getPool(), b = req.body || {};
    if (accion === 'ingreso') { await asegurar(pool); return out(200, await ingreso(pool, t, b)); }
    if (accion === 'resumen') return out(200, await resumen(pool, t, b));
    if (accion === 'horas') return out(200, await horas(pool, t, b));
    return out(404, { success: false, error: 'Accion desconocida' });
  } catch (e) {
    context.log.error('[actividad] ' + accion + ': ' + e.message);
    return out(500, { success: false, error: e.message });
  }
};
