/* ═══════════════════════════════════════════════════════════════════════════
   shared/db-pg.js — _DB_SUPABASE_V1 (05-nov-2026)
   Capa de conexión a Supabase (PostgreSQL) con la MISMA forma que mssql, para que
   las funciones no cambien:   const { sql, getPool } = require('../shared/db');
     pool.request().input('x', sql.NVarChar(50), v).query('SELECT ... WHERE c = @x')
     → { recordset, recordsets, rowsAffected }
     new sql.Transaction(pool) · tx.begin(...) · tx.request() · new sql.Request(tx) · commit/rollback
     new sql.Table('t') + columns.add + rows.add + request.bulk(T)
   El SQL de SQL Server se traduce con shared/tsql2pg.js.
   Las columnas que en SQL Server eran BIT se devuelven como true/false (igual que mssql)
   y los nombres de columna recuperan sus mayúsculas originales (esquema-pg.json).
   Variable de entorno: SUPABASE_DB_URL (cadena de conexión "Session pooler" o "Transaction pooler").
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { Pool, types } = require('pg');
const { traducir } = require('./tsql2pg');

/* tipos devueltos como los entregaba mssql */
types.setTypeParser(1114, (s) => new Date(s.replace(' ', 'T') + 'Z'));          /* timestamp → Date (UTC) */
types.setTypeParser(1184, (s) => new Date(s));                                   /* timestamptz */
types.setTypeParser(1082, (s) => new Date(s + 'T00:00:00Z'));                    /* date → Date a medianoche UTC */
types.setTypeParser(1700, (s) => parseFloat(s));                                 /* numeric → número */
types.setTypeParser(20, (s) => { const n = Number(s); return Number.isSafeInteger(n) ? n : s; });   /* bigint (COUNT) → número */

let ESQ = { columnasBit: {}, columnasOriginales: {} };
try { ESQ = Object.assign(ESQ, require('./esquema-pg.json')); } catch (e) { console.warn('[db-pg] sin esquema-pg.json: nombres en minúsculas y bits como 0/1'); }
const BITS = new Set([].concat(...Object.values(ESQ.columnasBit || {})));
const ORIG = ESQ.columnasOriginales || {};

function arreglarFila(row) {
  const o = {};
  for (const k of Object.keys(row)) {
    let v = row[k];
    if (BITS.has(k) && (v === 0 || v === 1)) v = v === 1;
    o[ORIG[k] || k] = v;
  }
  return o;
}

/* ── tipos: sql.NVarChar, sql.NVarChar(50), sql.Decimal(10,2)... solo se usan como marca ── */
function marca(nombre) { const f = function () { return f; }; f.tipo = nombre; return f; }
const ISOLATION_LEVEL = { READ_UNCOMMITTED: 'READ UNCOMMITTED', READ_COMMITTED: 'READ COMMITTED', REPEATABLE_READ: 'REPEATABLE READ', SERIALIZABLE: 'SERIALIZABLE', SNAPSHOT: 'REPEATABLE READ' };

function valorParam(v, tipo) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    if (tipo === 'Date') return v.toISOString().slice(0, 10);
    return v.toISOString().replace('T', ' ').replace('Z', '');
  }
  return v;
}

/* cada $n lleva el tipo que la función declaró (sql.Int, sql.Date...): Postgres no adivina tipos como SQL Server */
const CAST = { Int: 'integer', BigInt: 'bigint', SmallInt: 'smallint', TinyInt: 'smallint', Bit: 'smallint', Float: 'double precision', Real: 'real',
  Decimal: 'numeric', Numeric: 'numeric', Money: 'numeric', Date: 'date', DateTime: 'timestamp', DateTime2: 'timestamp', SmallDateTime: 'timestamp',
  DateTimeOffset: 'timestamptz', Time: 'time', UniqueIdentifier: 'uuid', VarBinary: 'bytea' };
/* los textos (NVarChar...) van SIN tipo: Postgres los toma como la columna (citext) y compara sin mayúsculas, como SQL Server */
const TEXTOS = /^(NVarChar|VarChar|NChar|Char|NText|Text|Xml)$/;
function tipoDe(v, t) {
  if (t && TEXTOS.test(t)) return null;
  if (t && CAST[t]) return CAST[t];
  if (typeof v === 'boolean') return 'smallint';
  if (typeof v === 'number') return Number.isInteger(v) ? 'bigint' : 'double precision';
  if (v instanceof Date) return 'timestamp';
  return null;
}
function conTipos(sqlTxt, params, vals, tipos) {
  let s = sqlTxt.replace(/\$(\d+)\b(?!\s*::)/g, (m, i) => { const n = params[+i - 1]; const t = tipoDe(vals[n], tipos[n]); return t ? m + '::' + t : m; });
  /* MERGE ... USING (SELECT $1 AS usuario ...): los textos como citext para comparar sin mayúsculas, igual que SQL Server */
  s = s.replace(/(\bUSING\s*\(\s*SELECT\s)([^()]*)(\))/i, (m, a, lista, c) => a + lista.replace(/\$(\d+)\b(?!\s*::)/g, (x, i) => { const n = params[+i - 1]; const v = vals[n], t = tipos[n]; return (typeof v === 'string' && (!t || TEXTOS.test(t))) ? x + '::extensions.citext' : x; }) + c);
  return s;
}

let pgPool = null;
function pg() {
  if (pgPool) return pgPool;
  const cs = process.env.RL_DB_URL || process.env.SUPABASE_DB_URL;   /* _EDGE_V1: en Supabase Edge, SUPABASE_DB_URL es reservada; se usa RL_DB_URL (pooler) */
  if (!cs) throw new Error('Falta SUPABASE_DB_URL en la configuración de la Function App');
  /* _CONEXIONES_V1 (05-nov): max 5 por servidor (DBPG_MAX), se sueltan a los 10 s: 6 servidores x 5 = 30 < Pool Size 40 de Supabase */
  pgPool = new Pool({ connectionString: cs, ssl: /sslmode=disable|@(127\.0\.0\.1|localhost)[:/]/.test(cs) ? false : { rejectUnauthorized: false }, max: +(process.env.DBPG_MAX || 5), idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000, statement_timeout: 60000 });
  pgPool.on('error', (e) => console.error('[db-pg] error del pool:', e && e.message));
  /* las tablas del sistema viven en el esquema "rl" (migracion/migrar.js); public queda para lo antiguo */
  pgPool.on('connect', (c) => { c.query('SET search_path TO ' + (process.env.SUPABASE_SCHEMA || 'rl') + ', public, extensions').catch(() => {}); });
  return pgPool;
}

class Request {
  constructor(dueno) { this._d = dueno && dueno._esTx ? dueno : POOL; this._p = {}; this._t = {}; }
  input(nombre, a, b) {
    const k = String(nombre).toLowerCase();
    if (b === undefined && !(typeof a === 'function' && a.tipo)) { this._p[k] = a; }
    else { this._p[k] = b; this._t[k] = a && a.tipo; }
    return this;
  }
  output() { return this; }
  async query(texto, ...vals) {
    if (Array.isArray(texto) && texto.raw) {   /* request.query`... ${x}` */
      let s = texto[0]; vals.forEach((v, i) => { const n = '__t' + i; this._p[n] = v; s += '@' + n + texto[i + 1]; }); texto = s;
    }
    const tr = traducir(texto);
    if (tr.pendiente.length) console.warn('[db-pg] SQL sin traducción completa (' + tr.pendiente.join(' | ') + '): ' + String(texto).replace(/\s+/g, ' ').slice(0, 160));
    const cli = await this._d._cliente();
    const recordsets = [], rowsAffected = [];
    let ultimoConteo = 0;   /* @@ROWCOUNT: filas afectadas por la sentencia anterior */
    /* _TRAN_LIKE_V1 (05-nov): lote con BEGIN TRAN ... COMMIT (fuera de un Transaction) → todo o nada */
    const loteTx = /\bBEGIN\s+TRAN/i.test(String(texto)) && !this._d._esTx;
    try {
      if (loteTx) await cli.c.query('BEGIN');
      for (const st of tr.sentencias) {
        const txt = conTipos(st.sql, st.params, this._p, this._t).replace(/__ROWCOUNT__/g, String(ultimoConteo));
        let r;
        try { r = await cli.c.query(txt, st.params.map(n => valorParam(this._p[n], this._t[n]))); }
        catch (e) { e.sqlPg = txt; if (process.env.DBPG_DEBUG) e.message += ' [SQL: ' + txt.replace(/\s+/g, ' ').slice(0, 300) + ']'; throw e; }
        ultimoConteo = r.rowCount || 0;
        if (/^SELECT pg_advisory_xact_lock\(/.test(st.sql)) continue;   /* candados internos: no son resultados para la función */
        if (r.fields && r.fields.length) recordsets.push(r.rows.map(arreglarFila));
        rowsAffected.push(r.rowCount || 0);
      }
      if (loteTx) await cli.c.query('COMMIT');
    } catch (e) {
      if (loteTx) { try { await cli.c.query('ROLLBACK'); } catch (e2) {} }
      throw e;
    } finally { cli.liberar(); }
    const recordset = recordsets[0] || [];
    return { recordset, recordsets, rowsAffected, output: {} };
  }
  async bulk(tabla) {
    const cols = tabla.columns.map(c => '"' + String(c.name).toLowerCase() + '"');
    const nombre = String(tabla.path || tabla.name).replace(/^\[?dbo\]?\./i, '').replace(/[\[\]]/g, '').toLowerCase();
    const filas = tabla.rows;
    const cli = await this._d._cliente();
    try {
      const porConsulta = Math.max(1, Math.min(1000, Math.floor(60000 / Math.max(1, cols.length))));
      for (let k = 0; k < filas.length; k += porConsulta) {
        const sub = filas.slice(k, k + porConsulta), v = [];
        const tuplas = sub.map((f, i) => { tabla.columns.forEach((c, j) => v.push(valorParam(f[j], c.type && c.type.tipo))); return '(' + cols.map((_, j) => '$' + (i * cols.length + j + 1)).join(',') + ')'; });
        await cli.c.query('INSERT INTO ' + nombre + ' (' + cols.join(',') + ') VALUES ' + tuplas.join(','), v);
      }
    } finally { cli.liberar(); }
    return { rowsAffected: filas.length };
  }
}

class Transaction {
  constructor() { this._esTx = true; this._c = null; }
  async begin(nivel) {
    this._c = await pg().connect();
    /* SERIALIZABLE de SQL Server espera con candados; en Postgres rechazaría los guardados simultáneos.
       Todas esas transacciones toman un candado explícito (sp_getapplock / UPDLOCK → pg_advisory_xact_lock),
       así que READ COMMITTED + candado da el mismo resultado: uno detrás de otro, sin errores. */
    const nv = (nivel === 'SERIALIZABLE' || nivel === 'REPEATABLE READ' || typeof nivel !== 'string') ? 'READ COMMITTED' : nivel;
    await this._c.query('BEGIN ISOLATION LEVEL ' + nv);
    return this;
  }
  request() { return new Request(this); }
  async _cliente() { if (!this._c) throw new Error('Transacción no iniciada'); return { c: this._c, liberar: () => {} }; }
  async commit() { try { await this._c.query('COMMIT'); } finally { this._c.release(); this._c = null; } }
  async rollback() { if (!this._c) return; try { await this._c.query('ROLLBACK'); } finally { try { this._c.release(); } catch (e) {} this._c = null; } }
}

class Table {
  constructor(nombre) { this.name = this.path = nombre; this.create = false; const cols = []; cols.add = (n, t) => cols.push({ name: n, type: t }); this.columns = cols; const rows = []; rows.add = (...v) => rows.push(v); this.rows = rows; }
}

const POOL = {
  connected: true,
  request() { return new Request(POOL); },
  on() { return POOL; },
  async _cliente() { const c = await pg().connect(); return { c, liberar: () => c.release() }; },
  async close() { if (pgPool) { await pgPool.end(); pgPool = null; } }
};

const sql = new Proxy({ _pg: true, Request, Transaction, Table, ISOLATION_LEVEL, MAX: -1, connect: async () => POOL }, {
  get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z]/.test(k)) return (t[k] = marca(k)); return undefined; }
});

async function getPool() { pg(); return POOL; }

module.exports = { sql, getPool };
