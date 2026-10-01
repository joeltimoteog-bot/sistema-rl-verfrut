/* ═══════════════════════════════════════════════════════════════════════════
   at-guardar (_AT_AZURE_PRIMERO_V1, 26-set-2026) — piezas comunes del guardado
   de atenciones "primero en Azure". Tablas (se crean solas):
     dbo.AtNroContador (anio, ultimo)  -> ultimo N° entregado por año (hoja del año)
     dbo.AtIdem (clave, nro, atencion_id, anio, en_hoja, creado)
                -> huella de cada guardado: evita duplicados por doble clic o
                   reintento, y marca si la fila ya se copio a la hoja de Google
     dbo.AtConfig (clave, valor)       -> 'azure_primero' = '1' activa el guardado
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql } = require('./db');

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.AtNroContador', 'U') IS NULL
      CREATE TABLE dbo.AtNroContador (anio INT NOT NULL PRIMARY KEY, ultimo INT NOT NULL, actualizado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
    IF OBJECT_ID('dbo.AtIdem', 'U') IS NULL
      CREATE TABLE dbo.AtIdem (clave NVARCHAR(80) NOT NULL PRIMARY KEY, nro INT NOT NULL, atencion_id INT NULL, anio INT NOT NULL,
        en_hoja BIT NOT NULL DEFAULT 0, creado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AtIdem_hoja')
      CREATE INDEX IX_AtIdem_hoja ON dbo.AtIdem (en_hoja, creado);
    IF OBJECT_ID('dbo.AtConfig', 'U') IS NULL
      CREATE TABLE dbo.AtConfig (clave NVARCHAR(40) NOT NULL PRIMARY KEY, valor NVARCHAR(200) NULL, actualizado DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
    /* _AT_COLS_V1 (28-set-2026): campos del formulario que no se guardaban */
    IF COL_LENGTH('dbo.Atenciones', 'autorizado_por') IS NULL ALTER TABLE dbo.Atenciones ADD autorizado_por NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.Atenciones', 'fecha_termino_periodo') IS NULL ALTER TABLE dbo.Atenciones ADD fecha_termino_periodo DATE NULL;`)
    .catch(e => { listo = null; throw e; });
  return listo;
}

/* Fecha y hora de Lima */
function lima() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  const hh = p.hour === '24' ? '00' : p.hour;
  return { ymd: p.year + '-' + p.month + '-' + p.day, hm: hh + ':' + p.minute, anio: +p.year };
}

/* getSemana del Apps Script: f = fecha a las 12:00 */
function semana(ymd) {
  const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7) - 1, d = +ymd.slice(8, 10);
  const f = Date.UTC(y, m, d, 12), ini = Date.UTC(y, 0, 1);
  return Math.ceil((Math.floor((f - ini) / 86400000) + new Date(ini).getUTCDay() + 1) / 7);
}

/* parValor_ del Apps Script */
function parValor(v) {
  const t = String(v == null ? '' : v).trim().toUpperCase();
  if (!t) return '';
  const validos = ['PADRE', 'MADRE', 'HERMANO(A)', 'HIJO(A)', 'ESPOSA(O)', 'CONYUGE', 'CONVIVIENTE'];
  return validos.indexOf(t) >= 0 ? t : t.slice(0, 40);
}

function fechaValida(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = +s.slice(0, 4);
  if (y < 1900 || y > 2100) return null;
  const f = new Date(s + 'T00:00:00Z');
  return (isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== s) ? null : s;
}

const LARGOS = { hora_inicio: 10, hora_termino: 10, nombre: 200, sexo: 10, empresa: 50, fundo: 100, cargo: 150, ruta: 50,
  codigo: 50, fundo_actual: 100, celular: 20, supervisor: 100, detalle_documento: 500, nro_licencia: 40, parentesco: 40,
  responsable_recepcion: 150, estado: 30, usuario_sistema: 50, autorizado_por: 100 };   /* _AT_COLS_V1: + autorizado_por */

/* Arma la atencion igual que saveAtencion del Apps Script */
function armar(b) {
  const L = lima(), d = {};
  Object.keys(LARGOS).forEach(k => { d[k] = String(b[k] == null ? '' : b[k]).trim().slice(0, LARGOS[k]); });
  d.dni = String(b.dni || '').trim();
  d.fecha_atencion = fechaValida(b.fecha_atencion) || L.ymd;
  if (!d.hora_inicio) d.hora_inicio = L.hm;
  if (!d.estado) d.estado = 'EN PROCESO';
  d.nro_licencia = String(b.nro_licencia || '').trim().slice(0, 40);
  d.parentesco = parValor(b.parentesco);
  d.fecha_inicio_periodo = fechaValida(b.fecha_inicio_periodo);
  d.fecha_termino_periodo = fechaValida(b.fecha_termino_periodo);   /* _AT_COLS_V1 */
  d.fecha_inicio_doc = fechaValida(b.fecha_inicio_doc);
  d.fecha_termino_doc = fechaValida(b.fecha_termino_doc);
  d.dias_transcurridos = parseInt(b.dias_transcurridos, 10) || 0;
  d.observaciones = String(b.observaciones == null ? '' : b.observaciones);
  d.anio = +d.fecha_atencion.slice(0, 4);
  d.mes = +d.fecha_atencion.slice(5, 7);
  d.nro_semana = semana(d.fecha_atencion);
  return d;
}

/* _GUARDAR_RAPIDO_V1 (01-oct-2026): el interruptor se recuerda 30 s (antes: 1 consulta por cada guardado) */
const _cfgCache = new Map();
async function config(pool, clave) {
  const c = _cfgCache.get(clave);
  if (c && Date.now() - c.ts < 30000) return c.v;
  const v = await configBD(pool, clave);
  _cfgCache.set(clave, { ts: Date.now(), v });
  return v;
}
async function configBD(pool, clave) {
  await asegurarTablas(pool);
  const r = await pool.request().input('k', sql.NVarChar(40), clave).query('SELECT valor FROM dbo.AtConfig WHERE clave = @k');
  return r.recordset.length ? r.recordset[0].valor : null;
}

module.exports = { asegurarTablas, lima, semana, parValor, armar, config, fechaValida };
