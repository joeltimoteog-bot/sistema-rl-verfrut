/* ═══════════════════════════════════════════════════════════════════
   prec (_PREC_AZURE_V1, 31-oct-2026) — Casos Precedentes (banco de referencia de RR.LL.)
   POST /api/prec/{listar|obtener|guardar|editar|eliminar|materias}   Authorization: Bearer <token del login>
   · 100 % Azure: tabla dbo.Casos_Precedentes con columnas propias (sin hoja de Google).
   · Lectura: cualquier usuario con sesion. Escritura/eliminacion: solo administracion (mismos roles que compromiso).
   · Eliminar es logico (activo = 0): nada se pierde.
   _PREC_USUARIO_V1 (12-nov-2026) — precedentes POR USUARIO con aviso general:
   · Cualquier usuario con sesion registra sus precedentes (formulario breve, sin PDF): DNI, ruta, codigo, area,
     tema del reporte, fecha, motivo que se le atribuye, descripcion breve y por que queda como precedente.
   · Cada usuario VE, EDITA y ELIMINA solo los suyos. La administracion ve y gestiona todos.
   · POST /api/prec/aviso { dni }: aviso GENERAL de reincidencia. Para ese DNI devuelve los casos y precedentes
     ya registrados por CUALQUIER usuario, pero solo: tipo, fecha, motivo, quien lo registro y su sector.
     El detalle (descripcion, observacion, ficha) solo lo ve quien lo registro y la administracion.
   · Columnas nuevas: migracion/prec-bloqueo/01-prec-bloqueo.sql (hay que aplicarlo ANTES de publicar).
   · Volver a las reglas anteriores (todos ven, solo administracion escribe): secreto PREC_POR_USUARIO=0.
   ═══════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { sql } = require('../shared/db');   /* _PREC_PG_V1 (05-nov): mismo sql que la base activa (Azure o Supabase) */
const { getPool } = require('../shared/db');

const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02', 'coordinador', 'jefa_rl'];
const SANCIONES = ['Sin sancion', 'Llamada de atencion', 'Amonestacion verbal', 'Amonestacion escrita', 'Suspension sin goce de haber', 'Despido', 'Renuncia / cese', 'Otro'];
const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 4000);
let listo = null;

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return require('../shared/auth.js').verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
function asegurarTabla(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.Casos_Precedentes', 'U') IS NULL
      CREATE TABLE dbo.Casos_Precedentes (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Casos_Precedentes PRIMARY KEY,
        codigo NVARCHAR(20) NOT NULL CONSTRAINT UQ_Casos_Precedentes_codigo UNIQUE,
        dni NVARCHAR(20) NULL, nombre NVARCHAR(200) NULL, empresa NVARCHAR(60) NULL, fundo NVARCHAR(120) NULL, cargo NVARCHAR(120) NULL,
        caso_nro NVARCHAR(40) NULL, caso_fecha DATE NULL,
        materia NVARCHAR(120) NOT NULL, hechos NVARCHAR(MAX) NOT NULL, procedimiento NVARCHAR(MAX) NOT NULL,
        sancion NVARCHAR(80) NOT NULL, motivo_precedente NVARCHAR(MAX) NOT NULL, palabras_clave NVARCHAR(400) NULL,
        adjuntos NVARCHAR(MAX) NULL,
        creado_por NVARCHAR(100) NOT NULL, creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        actualizado_por NVARCHAR(100) NULL, actualizado DATETIME2(0) NULL,
        activo BIT NOT NULL DEFAULT 1);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Casos_Precedentes_dni') CREATE INDEX IX_Casos_Precedentes_dni ON dbo.Casos_Precedentes (dni);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Casos_Precedentes_materia') CREATE INDEX IX_Casos_Precedentes_materia ON dbo.Casos_Precedentes (materia, activo);
  `).catch(e => { listo = null; throw e; });
  return listo;
}
function fila(r) {
  let adj = []; try { adj = JSON.parse(r.adjuntos || '[]'); } catch (e) {}
  return Object.assign({}, r, { adjuntos: adj, caso_fecha: r.caso_fecha ? new Date(r.caso_fecha).toISOString().slice(0, 10) : null });
}
const POR_USUARIO = () => String((typeof process !== 'undefined' && process.env && process.env.PREC_POR_USUARIO) || '') !== '0';
const dniOk = (d) => /^\d{8}$/.test(d) || /^[A-Za-z0-9]{6,15}$/.test(d);
const ymd = (v) => { if (!v) return null; try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return null; } };
/* _PREC_USUARIO_V1: formulario breve */
function validarBreve(b, edicion) {
  const faltan = [];
  if (!dniOk(s(b.dni, 20)) && !(edicion && !s(b.dni))) faltan.push('DNI del trabajador');   /* un precedente anterior sin DNI se puede seguir editando */
  if (!s(b.materia)) faltan.push('tema del reporte');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(b.caso_fecha, 10))) faltan.push('fecha');
  if (!s(b.motivo_falta)) faltan.push('motivo que se le atribuye');
  if (!s(b.hechos)) faltan.push('descripcion breve');
  if (!s(b.motivo_precedente)) faltan.push('por que queda como precedente');
  return faltan;
}
/* nombre y sector de quien registra, desde el padron unico (si no esta, queda el usuario) */
async function quien(pool, usuario, t) {
  try {
    const r = await pool.request().input('u', sql.NVarChar(100), usuario)
      .query('SELECT TOP (1) p.nombre_mostrar, COALESCE(sc.nombre, p.sector) AS sector FROM dbo.personas p LEFT JOIN dbo.sectores sc ON sc.codigo = p.sector WHERE p.usuario = @u ORDER BY p.vigente DESC, p.id DESC');   /* personas.sector guarda el CODIGO del sector: se muestra el nombre */
    if (r.recordset.length) return { nombre: s(r.recordset[0].nombre_mostrar, 200) || s(t && t.nombre, 200) || usuario, sector: s(r.recordset[0].sector, 120) };
  } catch (e) {}
  return { nombre: s(t && t.nombre, 200) || usuario, sector: '' };
}
function validar(b) {
  const faltan = [];
  if (!s(b.materia)) faltan.push('materia');
  if (!s(b.hechos)) faltan.push('hechos');
  if (!s(b.procedimiento)) faltan.push('como se procedio');
  if (!s(b.sancion)) faltan.push('sancion');
  if (!s(b.motivo_precedente)) faltan.push('por que queda como precedente');
  return faltan;
}
function cargar(rq, b) {
  rq.input('dni', sql.NVarChar(20), s(b.dni, 20) || null).input('nombre', sql.NVarChar(200), s(b.nombre, 200) || null)
    .input('empresa', sql.NVarChar(60), s(b.empresa, 60).toUpperCase() || null).input('fundo', sql.NVarChar(120), s(b.fundo, 120) || null)
    .input('cargo', sql.NVarChar(120), s(b.cargo, 120) || null).input('caso_nro', sql.NVarChar(40), s(b.caso_nro, 40) || null)
    .input('caso_fecha', sql.Date, /^\d{4}-\d{2}-\d{2}$/.test(s(b.caso_fecha, 10)) ? s(b.caso_fecha, 10) : null)
    .input('materia', sql.NVarChar(120), s(b.materia, 120)).input('hechos', sql.NVarChar(sql.MAX), s(b.hechos, 20000))
    .input('procedimiento', sql.NVarChar(sql.MAX), s(b.procedimiento, 20000)).input('sancion', sql.NVarChar(80), s(b.sancion, 80) || 'No aplica')
    .input('ruta', sql.NVarChar(60), s(b.ruta, 60) || null).input('cod', sql.NVarChar(40), s(b.cod_trabajador, 40) || null)
    .input('area', sql.NVarChar(120), s(b.area, 120) || null).input('mfalta', sql.NVarChar(300), s(b.motivo_falta, 300) || null)   /* _PREC_USUARIO_V1 */
    .input('motivo', sql.NVarChar(sql.MAX), s(b.motivo_precedente, 20000)).input('claves', sql.NVarChar(400), s(b.palabras_clave, 400) || null)
    .input('adjuntos', sql.NVarChar(sql.MAX), JSON.stringify(Array.isArray(b.adjuntos) ? b.adjuntos.slice(0, 20).map(a => ({ nombre: s(a.nombre, 200), url: s(a.url, 1000), tipo: s(a.tipo, 60) })) : []));
  return rq;
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') { context.res = { status: 204 }; return; }
  const accion = context.bindingData.accion;
  const ACC = ['listar', 'obtener', 'guardar', 'editar', 'eliminar', 'materias', 'aviso'];
  try {
    if (ACC.indexOf(accion) < 0) { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    const t = token(req);
    if (!t || !t.usuario) { context.res = { status: 401, body: { success: false, error: 'Sin sesion valida' } }; return; }
    const esAdm = ROLES_ADMIN.indexOf(String(t.rol || '').toLowerCase().trim()) >= 0 || String(t.usuario).toLowerCase() === 'jtimoteo';
    const usuario = String(t.usuario).toLowerCase();
    const b = req.body || {};
    const pool = await getPool(); await asegurarTabla(pool);
    const porU = POR_USUARIO();   /* _PREC_USUARIO_V1 */

    /* _PREC_USUARIO_V1: aviso general de reincidencia (solo lo minimo de lo registrado por otros) */
    if (accion === 'aviso') {
      const dni = s(b.dni, 20);
      if (!dniOk(dni)) { context.res = { status: 200, body: { success: true, items: [], casos: 0, precedentes: 0 } }; return; }
      const yo = await quien(pool, usuario, t), mios = [usuario, s(yo.nombre).toLowerCase(), s(t.nombre).toLowerCase()].filter(Boolean);
      const [rp, rc] = await Promise.all([
        pool.request().input('dni', sql.NVarChar(20), dni).query(`SELECT TOP (50) id, codigo, caso_fecha, creado, materia, motivo_falta, creado_por, creado_nombre, creado_sector
          FROM dbo.Casos_Precedentes WHERE activo = 1 AND dni = @dni ORDER BY COALESCE(caso_fecha, creado) DESC, id DESC`),
        pool.request().input('dni', sql.NVarChar(20), dni).query(`SELECT TOP (50) nro, fecha_reg, fecha_reporte, motivo, sector, supervisor, registrado_por
          FROM dbo.Casos WHERE dni = @dni AND nro IS NOT NULL ORDER BY COALESCE(fecha_reporte, fecha_reg) DESC, nro DESC`).catch(() => ({ recordset: [] }))
      ]);
      const excluir = parseInt(b.excluir_id, 10) || 0;
      const items = [];
      rp.recordset.filter((x) => x.id !== excluir).forEach((x) => {
        const mio = s(x.creado_por).toLowerCase() === usuario;
        items.push({ tipo: 'PRECEDENTE', fecha: ymd(x.caso_fecha || x.creado), motivo: s(x.motivo_falta, 200) || s(x.materia, 120),
          por: s(x.creado_nombre, 200) || s(x.creado_por, 100), sector: s(x.creado_sector, 120), mio: mio, id: (mio || esAdm) ? x.id : undefined, codigo: (mio || esAdm) ? x.codigo : undefined });
      });
      rc.recordset.forEach((x) => {
        const reg = s(x.registrado_por).toLowerCase(), sup = s(x.supervisor).toLowerCase();
        const mio = mios.indexOf(reg) >= 0 || mios.indexOf(sup) >= 0;
        items.push({ tipo: 'CASO', fecha: ymd(x.fecha_reporte || x.fecha_reg), motivo: s(x.motivo, 200), por: s(x.supervisor, 150) || s(x.registrado_por, 150),
          sector: s(x.sector, 120), mio: mio, nro: (mio || esAdm) ? x.nro : undefined });
      });
      items.sort((a, c) => String(c.fecha || '').localeCompare(String(a.fecha || '')));
      const tope = Math.min(Math.max(parseInt(b.tope, 10) || 5, 1), 20);
      context.res = { status: 200, body: { success: true, items: items.slice(0, tope), total: items.length,
        casos: items.filter((x) => x.tipo === 'CASO').length, precedentes: items.filter((x) => x.tipo === 'PRECEDENTE').length } }; return;
    }

    if (accion === 'materias') {
      const r = await pool.request().query('SELECT materia, COUNT(*) AS n FROM dbo.Casos_Precedentes WHERE activo = 1 GROUP BY materia ORDER BY n DESC');
      context.res = { status: 200, body: { success: true, materias: r.recordset, sanciones: SANCIONES } }; return;
    }
    if (accion === 'listar') {
      const rq = pool.request(); const w = ['activo = 1'];
      /* _PREC_USUARIO_V1: cada usuario lista solo los suyos; la administracion todos (y puede filtrar por quien registro) */
      if (porU && !esAdm) { w.push('creado_por = @yo'); rq.input('yo', sql.NVarChar(100), usuario); }
      else if (porU && s(b.creado_por)) { w.push('creado_por = @de'); rq.input('de', sql.NVarChar(100), s(b.creado_por, 100).toLowerCase()); }
      if (s(b.dni)) { w.push('dni = @dni'); rq.input('dni', sql.NVarChar(20), s(b.dni, 20)); }
      if (s(b.materia)) { w.push('materia = @materia'); rq.input('materia', sql.NVarChar(120), s(b.materia, 120)); }
      if (s(b.sancion)) { w.push('sancion = @sancion'); rq.input('sancion', sql.NVarChar(80), s(b.sancion, 80)); }
      if (s(b.empresa)) { w.push('empresa = @empresa'); rq.input('empresa', sql.NVarChar(60), s(b.empresa, 60).toUpperCase()); }
      if (/^\d{4}$/.test(s(b.anio))) { w.push('YEAR(COALESCE(caso_fecha, creado)) = @anio'); rq.input('anio', sql.Int, +s(b.anio)); }
      if (s(b.q)) { w.push('(hechos LIKE @q OR procedimiento LIKE @q OR motivo_precedente LIKE @q OR palabras_clave LIKE @q OR nombre LIKE @q OR codigo LIKE @q OR caso_nro LIKE @q OR motivo_falta LIKE @q OR dni LIKE @q)'); rq.input('q', sql.NVarChar(200), '%' + s(b.q, 150) + '%'); }
      const top = Math.min(Math.max(parseInt(b.top, 10) || 200, 1), 500);
      const r = await rq.query(`SELECT TOP (${top}) id, codigo, dni, nombre, empresa, fundo, cargo, caso_nro, caso_fecha, materia, sancion, palabras_clave,
          LEFT(hechos, 220) AS hechos, LEFT(motivo_precedente, 220) AS motivo_precedente, creado_por, creado, actualizado,
          ruta, cod_trabajador, area, motivo_falta, creado_sector, creado_nombre
        FROM dbo.Casos_Precedentes WHERE ${w.join(' AND ')} ORDER BY COALESCE(caso_fecha, creado) DESC, id DESC`);
      context.res = { status: 200, body: { success: true, data: r.recordset.map(x => Object.assign(x, { caso_fecha: x.caso_fecha ? new Date(x.caso_fecha).toISOString().slice(0, 10) : null })), total: r.recordset.length } }; return;
    }
    if (accion === 'obtener') {
      const r = await pool.request().input('id', sql.Int, parseInt(b.id, 10) || 0).query('SELECT * FROM dbo.Casos_Precedentes WHERE id = @id AND activo = 1');
      if (!r.recordset.length) { context.res = { status: 200, body: { success: false, error: 'No existe el precedente' } }; return; }
      if (porU && !esAdm && s(r.recordset[0].creado_por).toLowerCase() !== usuario) { context.res = { status: 403, body: { success: false, error: 'Ese precedente lo registro otro usuario: solo el y la administracion ven el detalle' } }; return; }   /* _PREC_USUARIO_V1 */
      context.res = { status: 200, body: { success: true, data: fila(r.recordset[0]) } }; return;
    }
    if (!porU && !esAdm) { context.res = { status: 403, body: { success: false, error: 'Solo administracion puede registrar o modificar precedentes' } }; return; }
    /* _PREC_USUARIO_V1: editar o eliminar = solo quien lo registro o la administracion */
    if (porU && !esAdm && (accion === 'editar' || accion === 'eliminar')) {
      const due = await pool.request().input('id', sql.Int, parseInt(b.id, 10) || 0).query('SELECT creado_por FROM dbo.Casos_Precedentes WHERE id = @id AND activo = 1');
      if (!due.recordset.length) { context.res = { status: 200, body: { success: false, error: 'No existe el precedente' } }; return; }
      if (s(due.recordset[0].creado_por).toLowerCase() !== usuario) { context.res = { status: 403, body: { success: false, error: 'Ese precedente lo registro otro usuario' } }; return; }
    }
    if (accion === 'guardar') {
      const faltan = porU ? validarBreve(b) : validar(b);
      if (faltan.length) { context.res = { status: 200, body: { success: false, error: 'Falta: ' + faltan.join(', ') } }; return; }
      const tx = new sql.Transaction(pool); await tx.begin();
      try {
        const n = await new sql.Request(tx).query("SELECT ISNULL(MAX(CAST(SUBSTRING(codigo, 6, 10) AS INT)), 0) + 1 AS n FROM dbo.Casos_Precedentes WITH (UPDLOCK, HOLDLOCK) WHERE codigo LIKE 'PREC-%'");
        const codigo = 'PREC-' + String(n.recordset[0].n).padStart(4, '0');
        const yo = await quien(pool, usuario, t);   /* _PREC_USUARIO_V1: nombre y sector de quien registra (para el aviso general) */
        const rq = cargar(new sql.Request(tx), b).input('codigo', sql.NVarChar(20), codigo).input('u', sql.NVarChar(100), usuario)
          .input('csec', sql.NVarChar(120), yo.sector || null).input('cnom', sql.NVarChar(200), yo.nombre || null);
        await rq.query(`INSERT INTO dbo.Casos_Precedentes (codigo, dni, nombre, empresa, fundo, cargo, caso_nro, caso_fecha, materia, hechos, procedimiento, sancion, motivo_precedente, palabras_clave, adjuntos, creado_por,
            ruta, cod_trabajador, area, motivo_falta, creado_sector, creado_nombre)
          VALUES (@codigo, @dni, @nombre, @empresa, @fundo, @cargo, @caso_nro, @caso_fecha, @materia, @hechos, @procedimiento, @sancion, @motivo, @claves, @adjuntos, @u,
            @ruta, @cod, @area, @mfalta, @csec, @cnom)`);
        await tx.commit();
        context.log('[prec] ' + usuario + ' registro ' + codigo);
        context.res = { status: 200, body: { success: true, codigo } }; return;
      } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    }
    if (accion === 'editar') {
      const id = parseInt(b.id, 10) || 0; const faltan = porU ? validarBreve(b, true) : validar(b);
      if (!id) { context.res = { status: 200, body: { success: false, error: 'Falta el id' } }; return; }
      if (faltan.length) { context.res = { status: 200, body: { success: false, error: 'Falta: ' + faltan.join(', ') } }; return; }
      const rq = cargar(pool.request(), b).input('id', sql.Int, id).input('u', sql.NVarChar(100), usuario);
      const r = await rq.query(`UPDATE dbo.Casos_Precedentes SET dni = @dni, nombre = @nombre, empresa = @empresa, fundo = @fundo, cargo = @cargo, caso_nro = @caso_nro, caso_fecha = @caso_fecha,
          materia = @materia, hechos = @hechos, procedimiento = @procedimiento, sancion = @sancion, motivo_precedente = @motivo, palabras_clave = @claves, adjuntos = @adjuntos,
          ruta = @ruta, cod_trabajador = @cod, area = @area, motivo_falta = @mfalta,
          actualizado_por = @u, actualizado = SYSUTCDATETIME() WHERE id = @id AND activo = 1`);
      context.res = { status: 200, body: { success: r.rowsAffected[0] > 0, error: r.rowsAffected[0] ? undefined : 'No existe el precedente' } }; return;
    }
    if (accion === 'eliminar') {
      const id = parseInt(b.id, 10) || 0;
      const r = await pool.request().input('id', sql.Int, id).input('u', sql.NVarChar(100), usuario)
        .query('UPDATE dbo.Casos_Precedentes SET activo = 0, actualizado_por = @u, actualizado = SYSUTCDATETIME() WHERE id = @id AND activo = 1');
      context.log('[prec] ' + usuario + ' elimino id ' + id);
      context.res = { status: 200, body: { success: r.rowsAffected[0] > 0, error: r.rowsAffected[0] ? undefined : 'No existe el precedente' } }; return;
    }
  } catch (err) {
    context.log.error('[prec] ' + accion + ': ' + err.message);
    context.res = { status: 500, body: { success: false, error: err.message } };
  }
};
