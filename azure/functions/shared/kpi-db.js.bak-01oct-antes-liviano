/* ═══════════════════════════════════════════════════════════════════════════
   kpi-db (_KPI_RRLL_V1, 30-set-2026) — tablas y lectura del modulo de KPIs RR.LL.
   Tablas reales en Azure SQL (se crean solas):
     dbo.KPI_Personas    personas evaluadas (archivo de la empresa)
     dbo.KPI_Notas       nota del curso de Legislacion Laboral (SOLO se agregan filas: la ultima vale)
     dbo.KPI_AtRegistro  fecha y hora en que se REGISTRO cada atencion (anio, nro)
     dbo.KPI_Ultimo      ultimo resultado de cada persona/KPI (para detectar cambios)
     dbo.KPI_Historial   foto diaria de cada KPI (evolucion; no se borra)
     dbo.KPI_Alertas     bitacora de alertas: el mensaje NUNCA se edita ni se borra;
                         solo se anota una vez cuando salio el correo
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const cumplDb = require('./cumpl-db');
const TH = require('./tablas-hoja');
const CUW = require('./cumpl-guardar');
const ETI = require('./kpi-eti');
const K = require('./kpi-motor');
const { crearMotor } = require('./cumpl-motor');

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = (async () => {
    await pool.request().query(`
      IF OBJECT_ID('dbo.KPI_Personas', 'U') IS NULL
        CREATE TABLE dbo.KPI_Personas (usuario NVARCHAR(60) NOT NULL PRIMARY KEY, dni NVARCHAR(15) NULL, nombre NVARCHAR(200) NOT NULL,
          empresa NVARCHAR(20) NULL, tipo NVARCHAR(10) NOT NULL, puesto NVARCHAR(150) NULL, ingreso DATE NULL, alias NVARCHAR(1000) NULL,
          activo BIT NOT NULL DEFAULT 1, orden INT NOT NULL DEFAULT 0, actualizado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
      IF OBJECT_ID('dbo.KPI_Notas', 'U') IS NULL
        CREATE TABLE dbo.KPI_Notas (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, usuario NVARCHAR(60) NOT NULL, nota DECIMAL(4,1) NOT NULL,
          fecha_examen DATE NULL, constancia NVARCHAR(1000) NULL, observacion NVARCHAR(500) NULL,
          registrado_por NVARCHAR(60) NOT NULL, registrado_en DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
      IF OBJECT_ID('dbo.KPI_AtRegistro', 'U') IS NULL
        CREATE TABLE dbo.KPI_AtRegistro (anio INT NOT NULL, nro INT NOT NULL, fecha_registro DATETIME2(0) NOT NULL,
          fuente NVARCHAR(20) NOT NULL, creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), CONSTRAINT PK_KPI_AtRegistro PRIMARY KEY (anio, nro));
      IF OBJECT_ID('dbo.KPI_Ultimo', 'U') IS NULL
        CREATE TABLE dbo.KPI_Ultimo (usuario NVARCHAR(60) NOT NULL, codigo NVARCHAR(5) NOT NULL, estado NVARCHAR(20) NULL,
          num DECIMAL(10,2) NULL, den DECIMAL(10,2) NULL, pct DECIMAL(9,6) NULL, nivel INT NULL, actualizado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT PK_KPI_Ultimo PRIMARY KEY (usuario, codigo));
      IF OBJECT_ID('dbo.KPI_Historial', 'U') IS NULL
        CREATE TABLE dbo.KPI_Historial (fecha DATE NOT NULL, usuario NVARCHAR(60) NOT NULL, codigo NVARCHAR(5) NOT NULL,
          num DECIMAL(10,2) NULL, den DECIMAL(10,2) NULL, pct DECIMAL(9,6) NULL, nivel INT NULL, nota DECIMAL(4,2) NULL,
          actualizado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), CONSTRAINT PK_KPI_Historial PRIMARY KEY (fecha, usuario, codigo));
      IF OBJECT_ID('dbo.KPI_Alertas', 'U') IS NULL
        CREATE TABLE dbo.KPI_Alertas (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, clave NVARCHAR(200) NOT NULL CONSTRAINT UQ_KPI_Alertas UNIQUE,
          creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), usuario NVARCHAR(60) NULL, nombre NVARCHAR(200) NULL, codigo NVARCHAR(5) NULL,
          tipo NVARCHAR(20) NOT NULL, mensaje NVARCHAR(1000) NOT NULL, detalle NVARCHAR(MAX) NULL, inicial BIT NOT NULL DEFAULT 0,
          enviado DATETIME2(0) NULL, destinatarios NVARCHAR(400) NULL);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_KPI_Alertas_env') CREATE INDEX IX_KPI_Alertas_env ON dbo.KPI_Alertas (enviado, id);
      IF NOT EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TR_KPI_Alertas_inmutable')
        EXEC('CREATE TRIGGER dbo.TR_KPI_Alertas_inmutable ON dbo.KPI_Alertas AFTER UPDATE, DELETE AS
          BEGIN
            IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id = d.id
                       WHERE i.id IS NULL OR i.mensaje <> d.mensaje OR i.tipo <> d.tipo OR ISNULL(i.usuario, '''') <> ISNULL(d.usuario, '''')
                          OR i.creado <> d.creado OR (d.enviado IS NOT NULL AND ISNULL(i.enviado, ''19000101'') <> d.enviado))
            BEGIN RAISERROR(''La bitacora de alertas KPI no se puede editar ni borrar'', 16, 1); ROLLBACK TRANSACTION; END
          END');
      IF OBJECT_ID('dbo.KPI_CierreMes', 'U') IS NULL
        CREATE TABLE dbo.KPI_CierreMes (mes CHAR(7) NOT NULL PRIMARY KEY, desde DATE NOT NULL, hasta DATE NOT NULL,
          cerrado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), cerrado_por NVARCHAR(60) NOT NULL, nota_equipo DECIMAL(4,2) NULL,
          cumpl_equipo DECIMAL(6,4) NULL, datos NVARCHAR(MAX) NOT NULL);
      IF NOT EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TR_KPI_CierreMes_inmutable')
        EXEC('CREATE TRIGGER dbo.TR_KPI_CierreMes_inmutable ON dbo.KPI_CierreMes AFTER UPDATE, DELETE AS
          BEGIN RAISERROR(''Un mes cerrado no se edita ni se borra'', 16, 1); ROLLBACK TRANSACTION; END');
      IF NOT EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'TR_KPI_Notas_inmutable')
        EXEC('CREATE TRIGGER dbo.TR_KPI_Notas_inmutable ON dbo.KPI_Notas AFTER UPDATE, DELETE AS
          BEGIN RAISERROR(''Las notas registradas no se editan ni se borran: registre una nueva'', 16, 1); ROLLBACK TRANSACTION; END');`);
    const n = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.KPI_Personas');
    if (!n.recordset[0].n) {
      for (let i = 0; i < K.PERSONAS.length; i++) {
        const p = K.PERSONAS[i];
        await pool.request().input('u', sql.NVarChar(60), p.usuario).input('d', sql.NVarChar(15), p.dni).input('n', sql.NVarChar(200), p.nombre)
          .input('e', sql.NVarChar(20), p.empresa).input('t', sql.NVarChar(10), p.tipo).input('p', sql.NVarChar(150), p.puesto)
          .input('i', sql.Date, p.ingreso).input('o', sql.Int, i).input('a', sql.NVarChar(1000), (p.alias || []).join('|') || null)
          .query('INSERT INTO dbo.KPI_Personas (usuario, dni, nombre, empresa, tipo, puesto, ingreso, alias, orden) VALUES (@u, @d, @n, @e, @t, @p, @i, @a, @o)');
      }
    }
  })().catch(e => { listo = null; throw e; });
  return listo;
}

const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const limaYmd = (d) => d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d) : '';

/* datos del motor de Cumplimiento (casos, config con feriados y ausencias, usuarios) */
async function datosCumpl(pool) {
  await cumplDb.asegurarTablas(pool);
  const r = await pool.request().query("SELECT clave, datos FROM dbo.CUMPL_Datos WHERE clave IN ('casos','config','usuarios','sups','restricc','constantes')");
  const D = {};
  r.recordset.forEach(f => { D[f.clave] = JSON.parse(f.datos); });
  if (!D.casos || !D.config) return null;
  try { const m = await TH.marcas(pool, ['cumpl_config', 'cumpl_restricc']); if (m) { const w = await CUW.paraMotor(pool); if (w) { D.config = w.config; D.restricc = w.restricc; } } } catch (e) {}
  D.visitas = [];
  return D;
}

/* fecha en que se subio el informe de cada caso: operaciones de Azure (desde el 26-set) + historial de Cumplimiento */
async function fechasInforme(pool) {
  const out = {};
  const poner = (nro, f, fuente) => { const k = String(nro); if (!f) return; if (!out[k] || f < out[k].fecha) out[k] = { fecha: f, fuente }; };
  try {
    const r = await pool.request().query(`SELECT nro, MIN(creado) AS f FROM dbo.CV_Ops
      WHERE tipo = 'casos' AND accion IN ('saveCaso', 'updateCaso') AND nro IS NOT NULL AND respuesta LIKE '%"success":true%'
        AND cuerpo LIKE '%"enlace_informe":"http%' GROUP BY nro`);
    r.recordset.forEach(x => poner(x.nro, limaYmd(x.f), 'registro de Azure'));
  } catch (e) {}
  try {
    const r = await pool.request().query(`IF OBJECT_ID('dbo.Cumpl_Historial', 'U') IS NOT NULL
      SELECT caso, MIN(fecha) AS f FROM dbo.Cumpl_Historial
      WHERE caso IS NOT NULL AND (actividad LIKE 'Carga de documentos%' OR actividad LIKE 'Cierre del caso%') AND documentos LIKE '%Informe%'
      GROUP BY caso`);
    (r.recordset || []).forEach(x => poner(x.caso, x.f instanceof Date ? limaYmd(x.f) : String(x.f || '').slice(0, 10), 'historial de Cumplimiento'));
  } catch (e) {}
  return out;
}

async function atenciones(pool) {
  const ini = new Date(Date.parse(K.PERIODO.ini + 'T00:00:00Z') - 25 * 86400000).toISOString().slice(0, 10);   /* 25 dias antes: lo que vence dentro del periodo */
  const r = await pool.request().input('ini', sql.Date, ini).query(`
    SELECT a.anio, a.nro, CONVERT(CHAR(10), a.fecha_atencion, 120) AS fecha_atencion, a.hora_inicio, a.usuario_sistema, a.supervisor, a.estado, a.nombre,
           CONVERT(CHAR(16), r.fecha_registro, 120) AS fecha_registro
    FROM dbo.Atenciones a LEFT JOIN dbo.KPI_AtRegistro r ON r.anio = a.anio AND r.nro = a.nro
    WHERE a.fecha_atencion >= @ini`);
  return r.recordset;
}

async function personas(pool) {
  const r = await pool.request().query('SELECT usuario, dni, nombre, empresa, tipo, puesto, CONVERT(CHAR(10), ingreso, 120) AS ingreso, alias, activo FROM dbo.KPI_Personas ORDER BY orden, nombre');
  return r.recordset.map(p => ({ usuario: p.usuario, dni: p.dni, nombre: p.nombre, empresa: p.empresa, tipo: p.tipo, puesto: p.puesto,
    ingreso: p.ingreso, activo: !!p.activo, alias: String(p.alias || '').split('|').map(s => s.trim()).filter(Boolean) }));
}

async function notas(pool) {
  const r = await pool.request().query(`SELECT n.usuario, n.nota, CONVERT(CHAR(10), n.fecha_examen, 120) AS fecha, n.constancia, n.registrado_por
    FROM dbo.KPI_Notas n WHERE n.id = (SELECT MAX(id) FROM dbo.KPI_Notas x WHERE x.usuario = n.usuario)`);
  const o = {}; r.recordset.forEach(x => { o[String(x.usuario).toLowerCase()] = { nota: +x.nota, fecha: x.fecha, constancia: x.constancia, por: x.registrado_por }; });
  return o;
}

/* Calcula todo. hoy opcional ('aaaa-mm-dd'). */
/* Lee TODO una vez (para calcular varios rangos seguidos sin volver a la base) */
async function cargar(pool) {
  await asegurarTablas(pool);
  const D = await datosCumpl(pool);
  if (!D) throw new Error('Cumplimiento aun no tiene datos en Azure');
  const m = crearMotor(D);
  const [inf, ats, per, nts, eti] = await Promise.all([fechasInforme(pool), atenciones(pool), personas(pool), notas(pool), ETI.leer(pool)]);
  let sync = null;
  try { const s = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'kpi_eti_sync'"); sync = s.recordset.length ? s.recordset[0].valor : null; } catch (e) {}
  return { M: m._kpi, personas: per, informes: inf, atenciones: ats, eti, notas: nts, eti_sync: sync };
}
function calcularCon(B, hoy, desde, hasta) {
  const res = K.calcular(Object.assign({}, B, { hoy: hoy || hoyLima(), desde, hasta }));
  res.eti_sync = B.eti_sync;
  return res;
}
async function calcular(pool, hoy, desde, hasta) {
  return calcularCon(await cargar(pool), hoy, desde, hasta);
}

/* Serie diaria: por cada dia, lo que VENCIA ese dia (equipo y persona) */
const DIA_MS = 86400000;
function serie(B, hoy, desde, hasta) {
  const out = [];
  const ini = Date.parse(desde + 'T00:00:00Z'), fin = Date.parse(hasta + 'T00:00:00Z');
  if (!(ini <= fin) || (fin - ini) / DIA_MS > 124) throw new Error('Rango de fechas invalido (maximo 4 meses)');
  for (let t = ini; t <= fin; t += DIA_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (d > hoy) break;
    const r = K.calcular(Object.assign({}, B, { hoy, desde: d, hasta: d }));
    const eq = {}, per = {};
    r.personas.forEach(p => {
      per[p.usuario] = {};
      p.kpis.forEach(k => {
        if (k.estado !== 'ok' || k.codigo === 'K4' || !k.den) return;
        eq[k.codigo] = eq[k.codigo] || { num: 0, den: 0 };
        eq[k.codigo].num += k.num; eq[k.codigo].den += k.den;
        per[p.usuario][k.codigo] = [k.num, k.den];
      });
    });
    out.push({ fecha: d, equipo: eq, personas: per });
  }
  return out;
}

/* ── CIERRE MENSUAL (inmutable) ── */
function rangoMes(mes) {
  const y = +mes.slice(0, 4), m = +mes.slice(5, 7);
  const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { desde: mes + '-01', hasta: fin };
}
async function cierres(pool) {
  const r = await pool.request().query(`SELECT mes, CONVERT(CHAR(10), desde, 120) AS desde, CONVERT(CHAR(10), hasta, 120) AS hasta,
    CONVERT(NVARCHAR(30), cerrado, 126) AS cerrado, cerrado_por, nota_equipo, cumpl_equipo FROM dbo.KPI_CierreMes ORDER BY mes`);
  return r.recordset;
}
async function informeMes(pool, mes) {
  const r = await pool.request().input('m', sql.Char(7), mes).query(`SELECT mes, CONVERT(NVARCHAR(30), cerrado, 126) AS cerrado, cerrado_por, datos FROM dbo.KPI_CierreMes WHERE mes = @m`);
  if (!r.recordset.length) return null;
  const x = r.recordset[0];
  return Object.assign(JSON.parse(x.datos), { mes: x.mes, cerrado: x.cerrado, cerrado_por: x.cerrado_por });
}
async function cerrarMes(pool, mes, por, B) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) throw new Error('Mes invalido');
  const R = rangoMes(mes), hoy = hoyLima();
  if (hoy <= R.hasta) return { success: false, error: 'El mes ' + mes + ' aun no termina (se cierra desde el ' + R.hasta + ' a las 23:59)' };
  if (R.hasta < K.PERIODO.ini) return { success: false, error: 'Antes del inicio de la medicion' };
  const ya = await pool.request().input('m', sql.Char(7), mes).query('SELECT 1 AS x FROM dbo.KPI_CierreMes WHERE mes = @m');
  if (ya.recordset.length) return { success: true, yaCerrado: true };
  const base = B || await cargar(pool);
  const res = calcularCon(base, hoy, R.desde, R.hasta);
  res.serie = serie(base, hoy, R.desde, R.hasta);
  const conNota = res.personas.filter(p => p.nota != null), conC = res.personas.filter(p => p.cumpl != null);
  const notaEq = conNota.length ? conNota.reduce((s, p) => s + p.nota, 0) / conNota.length : null;
  const cumplEq = conC.length ? conC.reduce((s, p) => s + p.cumpl, 0) / conC.length : null;
  delete res.avisos;
  await pool.request().input('m', sql.Char(7), mes).input('d', sql.Date, R.desde).input('h', sql.Date, R.hasta)
    .input('p', sql.NVarChar(60), por).input('n', sql.Decimal(4, 2), notaEq).input('c', sql.Decimal(6, 4), cumplEq)
    .input('j', sql.NVarChar(sql.MAX), JSON.stringify(res))
    .query(`IF NOT EXISTS (SELECT 1 FROM dbo.KPI_CierreMes WHERE mes = @m)
            INSERT INTO dbo.KPI_CierreMes (mes, desde, hasta, cerrado_por, nota_equipo, cumpl_equipo, datos) VALUES (@m, @d, @h, @p, @n, @c, @j)`);
  return { success: true, mes, nota_equipo: notaEq, cumpl_equipo: cumplEq };
}
/* el mes anterior se cierra solo (lo llama kpi-reloj) */
async function cierreAutomatico(pool) {
  const hoy = hoyLima(), y = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
  const prev = m === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (m - 1)).slice(-2);
  if (prev < K.PERIODO.ini.slice(0, 7) || prev > K.PERIODO.fin.slice(0, 7)) return null;
  const ya = await pool.request().input('m', sql.Char(7), prev).query('SELECT 1 AS x FROM dbo.KPI_CierreMes WHERE mes = @m');
  if (ya.recordset.length) return null;
  return cerrarMes(pool, prev, 'automático');
}

/* Guarda la foto y registra las alertas NUEVAS (cambios de nivel + vencimientos/preventivas).
   La primera vez solo deja la "linea base" (inicial = 1, no se envia correo). */
async function registrar(pool, res) {
  const ult = {};
  (await pool.request().query('SELECT usuario, codigo, nivel, estado FROM dbo.KPI_Ultimo')).recordset.forEach(x => { ult[x.usuario + '|' + x.codigo] = x; });
  const primera = Object.keys(ult).length === 0;
  const nuevas = [];
  res.personas.forEach(p => {
    p.kpis.forEach(k => {
      if (k.estado !== 'ok' || !k.nivel) return;
      const a = ult[p.usuario + '|' + k.codigo];
      const antes = a && a.nivel ? a.nivel : null;
      const pctTxt = (Math.round(k.pct * 1000) / 10) + '%';
      const malas = (k.evidencia || []).filter(e => e.ok === false).slice(0, 8).map(e => e.ref + ': ' + e.detalle);
      if (k.nivel < 3 && (antes === null || antes >= 3))
        nuevas.push({ clave: 'nivel:' + p.usuario + ':' + k.codigo + ':' + res.hoy + ':' + k.nivel, usuario: p.usuario, nombre: p.nombre, codigo: k.codigo, tipo: 'BAJO_META',
          mensaje: p.nombre + ' · ' + k.corto + ' bajó a ' + pctTxt + ' (nivel ' + k.nivel + ', meta ' + Math.round(k.meta * 100) + '%)', detalle: malas.join('\n') });
      else if (antes !== null && k.nivel < 3 && k.nivel < antes)   /* sigue bajo la meta y empeoro */
        nuevas.push({ clave: 'nivel:' + p.usuario + ':' + k.codigo + ':' + res.hoy + ':' + k.nivel, usuario: p.usuario, nombre: p.nombre, codigo: k.codigo, tipo: 'BAJO_META',
          mensaje: p.nombre + ' · ' + k.corto + ' bajó más: ' + pctTxt + ' (nivel ' + antes + ' → ' + k.nivel + ', meta ' + Math.round(k.meta * 100) + '%)', detalle: malas.join('\n') });
      else if (antes !== null && antes < 3 && k.nivel >= 3)
        nuevas.push({ clave: 'recupera:' + p.usuario + ':' + k.codigo + ':' + res.hoy, usuario: p.usuario, nombre: p.nombre, codigo: k.codigo, tipo: 'RECUPERA',
          mensaje: p.nombre + ' · ' + k.corto + ' volvió a la meta: ' + pctTxt + ' (nivel ' + k.nivel + ')', detalle: '' });
    });
  });
  (res.avisos || []).forEach(a => nuevas.push({ clave: a.clave, usuario: a.usuario, nombre: a.nombre, codigo: a.codigo, tipo: a.tipo,
    mensaje: a.nombre + ' · ' + a.mensaje, detalle: '' }));
  let creadas = 0;
  for (const a of nuevas) {
    try {
      const r = await pool.request().input('k', sql.NVarChar(200), a.clave.slice(0, 200)).input('u', sql.NVarChar(60), a.usuario || null)
        .input('n', sql.NVarChar(200), a.nombre || null).input('c', sql.NVarChar(5), a.codigo || null).input('t', sql.NVarChar(20), a.tipo)
        .input('m', sql.NVarChar(1000), a.mensaje.slice(0, 1000)).input('d', sql.NVarChar(sql.MAX), a.detalle || null).input('i', sql.Bit, primera ? 1 : 0)
        .query(`IF NOT EXISTS (SELECT 1 FROM dbo.KPI_Alertas WHERE clave = @k)
                INSERT INTO dbo.KPI_Alertas (clave, usuario, nombre, codigo, tipo, mensaje, detalle, inicial, enviado)
                VALUES (@k, @u, @n, @c, @t, @m, @d, @i, CASE WHEN @i = 1 THEN SYSUTCDATETIME() ELSE NULL END)`);
      if (r.rowsAffected && r.rowsAffected[0]) creadas++;
    } catch (e) { if (!/UQ_KPI_Alertas|duplicate/i.test(e.message || '')) throw e; }
  }
  /* ultimo + historial del dia */
  for (const p of res.personas) {
    for (const k of p.kpis) {
      const r = pool.request().input('u', sql.NVarChar(60), p.usuario).input('c', sql.NVarChar(5), k.codigo).input('e', sql.NVarChar(20), k.estado)
        .input('num', sql.Decimal(10, 2), k.num || 0).input('den', sql.Decimal(10, 2), k.den || 0).input('pct', sql.Decimal(9, 6), k.pct == null ? null : k.pct)
        .input('niv', sql.Int, k.nivel || null).input('f', sql.Date, res.hoy).input('nota', sql.Decimal(4, 2), p.nota);
      await r.query(`MERGE dbo.KPI_Ultimo AS x USING (SELECT @u AS usuario, @c AS codigo) AS s ON x.usuario = s.usuario AND x.codigo = s.codigo
          WHEN MATCHED THEN UPDATE SET estado = @e, num = @num, den = @den, pct = @pct, nivel = @niv, actualizado = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (usuario, codigo, estado, num, den, pct, nivel) VALUES (@u, @c, @e, @num, @den, @pct, @niv);
        MERGE dbo.KPI_Historial AS x USING (SELECT @f AS fecha, @u AS usuario, @c AS codigo) AS s ON x.fecha = s.fecha AND x.usuario = s.usuario AND x.codigo = s.codigo
          WHEN MATCHED THEN UPDATE SET num = @num, den = @den, pct = @pct, nivel = @niv, nota = @nota, actualizado = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (fecha, usuario, codigo, num, den, pct, nivel, nota) VALUES (@f, @u, @c, @num, @den, @pct, @niv, @nota);`);
    }
  }
  return { alertas_nuevas: creadas, linea_base: primera };
}

async function alertas(pool, limite) {
  const r = await pool.request().input('n', sql.Int, limite || 200).query(`SELECT TOP (@n) id, CONVERT(NVARCHAR(30), creado, 126) AS creado, usuario, nombre, codigo, tipo, mensaje, detalle, inicial,
    CONVERT(NVARCHAR(30), enviado, 126) AS enviado, destinatarios FROM dbo.KPI_Alertas ORDER BY id DESC`);
  return r.recordset;
}

module.exports = { asegurarTablas, cargar, calcular, calcularCon, serie, cerrarMes, cierreAutomatico, cierres, informeMes, rangoMes, registrar, alertas, personas, hoyLima, _t: { fechasInforme, atenciones } };
