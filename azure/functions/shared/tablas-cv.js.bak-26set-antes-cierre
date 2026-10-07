/* ═══════════════════════════════════════════════════════════════════════════
   _TABLAS_CV_V1 (26-set-2026) — TABLAS REALES de Casos y Visitas en Azure SQL
   ---------------------------------------------------------------------------
   dbo.Casos y dbo.Visitas: una fila por registro, una columna por dato, con su
   tipo (fecha, numero, texto). 'fila' = posicion en la hoja (mantiene el orden).
   Las columnas siguen lo que REALMENTE hay en cada columna de la hoja (censo
   cvCensoColumnas del 26-set), no los titulos (en BD_Casos estan corridos).
   Aqui tambien se arma cada registro EXACTAMENTE como lo entrega getCasos /
   getVisitas, para que la pantalla reciba lo mismo que hoy.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');

/* [columna, indice en la hoja, tipo]  tipos: int, num, fecha, dni, fotos, t<largo>, tmax */
const COLS = {
  casos: [
    ['nro', 0, 'int'], ['fecha_reg', 1, 'fecha'], ['dni', 2, 'dni'], ['nombre', 3, 't150'], ['empresa', 4, 't20'],
    ['cargo', 5, 't100'], ['sector', 6, 't100'], ['ingreso', 7, 'fecha'], ['termino', 8, 'fecha'], ['supervisor', 9, 't150'],
    ['motivo', 10, 't200'], ['motivo_extra', 11, 't500'], ['fecha_reporte', 12, 'fecha'], ['fecha_limite', 13, 'fecha'],
    ['temporada', 14, 't50'], ['estado', 15, 't50'], ['porcentaje', 16, 'num'], ['dias_retraso', 17, 'num'],
    ['motivo_retraso', 18, 't2000'], ['redaccion', 19, 'tmax'], ['nombre_informe', 20, 't500'], ['enlace_informe', 21, 't1000'],
    ['nombre_reporte', 22, 't500'], ['enlace_reporte', 23, 't1000'], ['registrado_por', 24, 't150'], ['gravedad', 25, 't20'],
    ['estado_gestion', 26, 't30'], ['tipo_sancion', 27, 't100'], ['sancion_fecha_inicio', 28, 'fecha'], ['sancion_fecha_fin', 29, 'fecha'],
    ['sancion_dias', 30, 'num'], ['ultima_alerta', 31, 'tfecha100']
  ],
  visitas: [
    ['nro', 0, 'int'], ['fecha_reg', 1, 'fecha'], ['empresa', 2, 't20'], ['supervisor', 3, 't150'], ['dni', 4, 'dni'],
    ['correo', 5, 't150'], ['fundo', 6, 't100'], ['punto', 7, 't300'], ['fecha_inicio', 8, 'fecha'], ['fecha_fin', 9, 'fecha'],
    ['semana', 10, 'num'], ['fecha_informe', 11, 'fecha'], ['para', 12, 't150'], ['asunto', 13, 't500'], ['desarrollo', 14, 'tmax'],
    ['rutas', 15, 'tmax'], ['acciones', 16, 'tmax'], ['compromisos', 17, 'tmax'], ['observaciones', 18, 'tmax'], ['motivo', 19, 't500'],
    ['fotos', 20, 'fotos'], ['estado', 21, 't30'], ['registrado_por', 22, 't150'], ['temporada', 23, 't50'],
    ['dias_transcurridos', 24, 'num'], ['dias_permitidos', 25, 'num'], ['dias_retraso', 26, 'num'], ['pct_avance', 27, 'num'],
    ['pct_retraso', 28, 'num'], ['enlace_informe', 29, 't1000']
  ]
};
const TABLA = { casos: 'dbo.Casos', visitas: 'dbo.Visitas' };

function tipoSql(t) {
  if (t === 'int') return 'INT NULL';
  if (t === 'num') return 'FLOAT NULL';
  if (t === 'fecha') return 'DATETIME2(3) NULL';
  if (t === 'dni') return 'NVARCHAR(15) NULL';
  if (t === 'fotos') return 'NVARCHAR(MAX) NULL, fotos_n FLOAT NULL';
  if (t === 'tmax') return 'NVARCHAR(MAX) NULL';
  if (t === 'tfecha100') return 'NVARCHAR(100) NULL';
  return 'NVARCHAR(' + t.slice(1) + ') NULL';
}
function ddl(tipo) {
  const t = TABLA[tipo], cols = COLS[tipo].map(c => c[0] + ' ' + tipoSql(c[2])).join(',\n      ');
  return `IF OBJECT_ID('${t}', 'U') IS NULL
    CREATE TABLE ${t} (
      id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_${tipo} PRIMARY KEY,
      fila INT NOT NULL CONSTRAINT UQ_${tipo}_fila UNIQUE,
      ${cols},
      creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      actualizado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
  IF COL_LENGTH('${t}', 'fila') IS NULL THROW 50001, 'Ya existe ${t} con otra estructura: no se toca', 1;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_${tipo}_nro') CREATE INDEX IX_${tipo}_nro ON ${t}(nro);
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_${tipo}_sup') CREATE INDEX IX_${tipo}_sup ON ${t}(supervisor);`;
}
let listo = {};
function asegurarTablas(pool, tipo) {
  if (!listo[tipo]) listo[tipo] = pool.request().query(ddl(tipo)).catch(e => { listo[tipo] = null; throw e; });
  return listo[tipo];
}

/* ── celda de la hoja (Date llega como {$d:ISO}) → valor de columna ── */
function esFecha(x) { return x && typeof x === 'object' && '$d' in x; }
function convertir(x, t, col, problemas, fila) {
  const mal = (m) => { problemas.push('fila ' + fila + ' ' + col + ': ' + m); return null; };
  if (x === '' || x === null || x === undefined) return t === 'fotos' ? [null, null] : null;
  if (t === 'int') return (typeof x === 'number' && x % 1 === 0) ? x : mal('se esperaba numero entero, hay ' + JSON.stringify(x).slice(0, 40));
  if (t === 'num') return typeof x === 'number' ? x : mal('se esperaba numero, hay ' + JSON.stringify(x).slice(0, 40));
  if (t === 'fecha') { if (!esFecha(x) || !x.$d) return mal('se esperaba fecha, hay ' + JSON.stringify(x).slice(0, 40)); return new Date(x.$d); }
  if (t === 'dni') { const s = String(x); return s.length <= 15 ? s : mal('DNI de ' + s.length + ' caracteres'); }
  if (t === 'fotos') return typeof x === 'number' ? [null, x] : [String(x), null];
  if (t === 'tfecha100') return esFecha(x) ? x.$d : String(x).slice(0, 100);
  if (esFecha(x)) return mal('se esperaba texto, hay una fecha');
  const s = String(x);
  if (t !== 'tmax' && s.length > parseInt(t.slice(1), 10)) return mal('texto de ' + s.length + ' caracteres (maximo ' + t.slice(1) + ')');
  return s;
}
function tipoMssql(t) {
  if (t === 'int') return sql.Int;
  if (t === 'num') return sql.Float;
  if (t === 'fecha') return sql.DateTime2(3);
  if (t === 'dni') return sql.NVarChar(15);
  if (t === 'tmax') return sql.NVarChar(sql.MAX);
  if (t === 'tfecha100') return sql.NVarChar(100);
  return sql.NVarChar(parseInt(t.slice(1), 10));
}
/* Arma la tabla para carga masiva. filas = [[celda, celda...], ...] en orden de hoja. */
function armarCarga(tipo, filas) {
  const problemas = [], T = new sql.Table(TABLA[tipo]); T.create = false;
  T.columns.add('fila', sql.Int, { nullable: false });
  COLS[tipo].forEach(c => {
    if (c[2] === 'fotos') { T.columns.add('fotos', sql.NVarChar(sql.MAX), { nullable: true }); T.columns.add('fotos_n', sql.Float, { nullable: true }); }
    else T.columns.add(c[0], tipoMssql(c[2]), { nullable: true });
  });
  filas.forEach((r, i) => {
    const vals = [i + 1];
    COLS[tipo].forEach(c => {
      const v = convertir(r[c[1]], c[2], c[0], problemas, i + 2);
      if (c[2] === 'fotos') vals.push(v[0], v[1]); else vals.push(v);
    });
    T.rows.add.apply(T.rows, vals);
  });
  return { T, problemas };
}

/* ── registro de la tabla → objeto igual al de getCasos / getVisitas ── */
const LIMA = 5 * 3600e3;
const p2 = n => (n < 10 ? '0' : '') + n;
function limaYmd(d) { const x = new Date(d.getTime() - LIMA); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); }
function limaYmdHm(d) { const x = new Date(d.getTime() - LIMA); return limaYmd(d) + ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()); }
const raw = v => (v === null || v === undefined) ? '' : (v instanceof Date ? v.toISOString() : v);
const txt = v => (v === null || v === undefined) ? '' : String(v);
function dniOut(v) { if (v === null || v === undefined) return ''; return /^[1-9]\d*$/.test(v) && v.length <= 15 ? Number(v) : v; }

function casoDeFila(r) {
  return {
    nro: raw(r.nro), fecha_reg: r.fecha_reg ? limaYmd(r.fecha_reg) : '', dni: dniOut(r.dni), nombre: raw(r.nombre),
    empresa: raw(r.empresa), cargo: raw(r.cargo), sector: raw(r.sector), ingreso: raw(r.ingreso), termino: raw(r.termino),
    supervisor: raw(r.supervisor), motivo: raw(r.motivo), motivo_extra: raw(r.motivo_extra),
    fecha_reporte: raw(r.fecha_reporte), fecha_limite: raw(r.fecha_limite), temporada: raw(r.temporada), estado: raw(r.estado),
    porcentaje: r.porcentaje || 0, dias_retraso: r.dias_retraso || 0, motivo_retraso: raw(r.motivo_retraso), redaccion: raw(r.redaccion),
    nombre_informe: txt(r.nombre_informe), enlace_informe: txt(r.enlace_informe), nombre_reporte: txt(r.nombre_reporte),
    enlace_reporte: txt(r.enlace_reporte), registrado_por: txt(r.registrado_por), gravedad: r.gravedad || 'BAJO',
    estado_gestion: r.estado_gestion || 'PENDIENTE', tipo_sancion: txt(r.tipo_sancion),
    sancion_fecha_inicio: r.sancion_fecha_inicio ? limaYmd(r.sancion_fecha_inicio) : '',
    sancion_fecha_fin: r.sancion_fecha_fin ? limaYmd(r.sancion_fecha_fin) : '',
    sancion_dias: Number(r.sancion_dias) || 0
  };
}
function visitaDeFila(r) {
  const fotosRaw = r.fotos_n !== null && r.fotos_n !== undefined ? r.fotos_n : (r.fotos === null || r.fotos === undefined ? '' : r.fotos);
  let fotos_urls = [], fotos_count = 0;
  if (typeof fotosRaw === 'string' && fotosRaw.indexOf('http') !== -1) { fotos_urls = fotosRaw.split('|').filter(Boolean); fotos_count = fotos_urls.length; }
  else if (typeof fotosRaw === 'number') fotos_count = fotosRaw;
  else if (typeof fotosRaw === 'string' && fotosRaw.match(/^\d+$/)) fotos_count = parseInt(fotosRaw);
  const ymd = d => d ? limaYmd(d) : '';
  return {
    nro: raw(r.nro), fecha_reg: r.fecha_reg ? limaYmdHm(r.fecha_reg) : '', empresa: txt(r.empresa), supervisor: txt(r.supervisor).trim(),
    dni: dniOut(r.dni), correo: txt(r.correo), fundo: txt(r.fundo), sector: txt(r.fundo), punto: txt(r.punto),
    fecha_inicio: ymd(r.fecha_inicio), fecha_fin: ymd(r.fecha_fin), semana: raw(r.semana), fecha_informe: ymd(r.fecha_informe),
    para: txt(r.para), asunto: txt(r.asunto), desarrollo: txt(r.desarrollo), rutas: txt(r.rutas), acciones: txt(r.acciones),
    compromisos: txt(r.compromisos), observaciones: txt(r.observaciones), motivo: txt(r.motivo),
    fotos: fotosRaw, fotos_urls, fotos_count, estado: txt(r.estado), registrado_por: txt(r.registrado_por),
    enlace_informe: txt(r.enlace_informe), temporada: txt(r.temporada),
    dias_transcurridos: parseInt(r.dias_transcurridos) || 0, dias_permitidos: parseInt(r.dias_permitidos) || 1,
    dias_retraso: parseInt(r.dias_retraso) || 0, pct_avance: String(r.pct_avance || '0.00'), pct_retraso: String(r.pct_retraso || '0.00')
  };
}
/* Casos "recientes" = los que getCasos muestra sin historial (getRowsCurrentYear: ultimas 500 filas,
   con N°, y fecha de registro vacia o del año pasado en adelante). */
function esReciente(r, total) {
  if (r.fila <= total - 500 || !r.nro) return false;
  if (!r.fecha_reg) return true;
  return new Date(r.fecha_reg.getTime() - LIMA).getUTCFullYear() >= new Date(Date.now() - LIMA).getUTCFullYear() - 1;
}

/* _TABLAS_CV_V2: lectura para las pantallas y cumplimiento. Solo relee las tablas cuando
   cambia la marca de carga (CV_Estado 'tablas_casos' / 'tablas_visitas'); si aun no hay
   marca devuelve null y quien llama usa el camino anterior. */
let memoria = { ver: null, d: null };
async function leerCV(pool) {
  const e = await pool.request().query("SELECT clave, valor FROM dbo.CV_Estado WHERE clave IN ('tablas_casos', 'tablas_visitas') ORDER BY clave");
  if (e.recordset.length < 2) return null;
  const ver = e.recordset.map(x => x.valor).join('|');
  if (memoria.ver === ver) return memoria.d;
  const c = (await pool.request().query('SELECT * FROM dbo.Casos ORDER BY fila')).recordset;
  const v = (await pool.request().query('SELECT * FROM dbo.Visitas ORDER BY fila')).recordset;
  const d = { casos: c.map(casoDeFila), recientes: c.filter(f => esReciente(f, c.length)).map(casoDeFila),
              visitas: v.filter(f => f.nro !== null).map(visitaDeFila) };
  memoria = { ver, d };
  return d;
}

module.exports = { COLS, TABLA, asegurarTablas, armarCarga, casoDeFila, visitaDeFila, esReciente, leerCV };
