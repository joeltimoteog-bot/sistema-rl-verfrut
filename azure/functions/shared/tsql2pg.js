/* ═══════════════════════════════════════════════════════════════════════════
   shared/tsql2pg.js — _TSQL2PG_V1 (05-nov-2026)
   Traduce el SQL de SQL Server (T-SQL) que usan las funciones a PostgreSQL.
   Lo usa shared/db-pg.js; las funciones siguen escribiendo sus consultas igual.

   Cubre lo que se repite en el código:
     @param → $n · [col] → col · dbo. → (nada) · N'texto' → 'texto'
     TOP n / TOP (n) → LIMIT n · OFFSET n ROWS FETCH NEXT m ROWS ONLY → LIMIT m OFFSET n
     GETDATE()/SYSUTCDATETIME()/SYSDATETIME()/GETUTCDATE() → hora UTC
     ISNULL( → COALESCE( · LEN( → LENGTH( · CHARINDEX(a,b) → STRPOS(b,a)
     NVARCHAR(MAX)/NTEXT → TEXT · NVARCHAR(n) → VARCHAR(n) · BIT → SMALLINT · DATETIME2/DATETIME → TIMESTAMP
     WITH (NOLOCK|UPDLOCK|HOLDLOCK|ROWLOCK|READPAST) → (se quita)
     OUTPUT INSERTED.x → RETURNING x
     alias "AS camelCase" → AS "camelCase" (Postgres pasaría a minúsculas el nombre del campo)
     IF OBJECT_ID / IF COL_LENGTH / IF NOT EXISTS (… sys.…) seguidos de CREATE/ALTER → se omiten
       (el esquema ya existe en Supabase: lo creó migracion/migrar.js)
   Lo que no cubre (MERGE complejo, DECLARE, bloques IF…ELSE de lógica) devuelve un aviso en
   'pendiente' para corregirlo a mano en la función.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* separa en sentencias por ';' respetando textos entre comillas */
function partir(sqlTxt) {
  const out = []; let cur = '', enStr = false;
  for (let i = 0; i < sqlTxt.length; i++) {
    const ch = sqlTxt[i];
    if (ch === "'") { enStr = !enStr; cur += ch; continue; }
    if (!enStr && ch === '-' && sqlTxt[i + 1] === '-') { const fin = sqlTxt.indexOf('\n', i); i = fin < 0 ? sqlTxt.length : fin; cur += '\n'; continue; }
    if (!enStr && ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* aplica fn solo fuera de los textos entre comillas */
function fueraDeTextos(s, fn) {
  return s.split(/('(?:[^']|'')*')/).map((p, i) => (i % 2 ? p : fn(p))).join('');
}

/* reemplaza NOMBRE(arg1, arg2, ...) respetando paréntesis anidados; fn devuelve el texto nuevo o null */
function reescribir(s, nombre, fn) {
  const re = new RegExp('\\b' + nombre + '\\s*\\(', 'gi'); let out = '', i = 0, m;
  while ((m = re.exec(s))) {
    let j = m.index + m[0].length, nivel = 1, args = [], ini = j;
    for (; j < s.length && nivel; j++) {
      const ch = s[j];
      if (ch === "'") { j = s.indexOf("'", j + 1); if (j < 0) return s; continue; }
      if (ch === '(') nivel++; else if (ch === ')') { nivel--; if (!nivel) { args.push(s.slice(ini, j).trim()); break; } }
      else if (ch === ',' && nivel === 1) { args.push(s.slice(ini, j).trim()); ini = j + 1; }
    }
    if (nivel) return s;
    const nuevo = fn(args);
    if (nuevo == null) continue;
    out += s.slice(i, m.index) + nuevo; i = j + 1; re.lastIndex = j + 1;
  }
  return out + s.slice(i);
}
const FMT = { '120': 'YYYY-MM-DD HH24:MI:SS', '121': 'YYYY-MM-DD HH24:MI:SS.MS', '126': 'YYYY-MM-DD"T"HH24:MI:SS.MS', '127': 'YYYY-MM-DD"T"HH24:MI:SS.MS', '23': 'YYYY-MM-DD', '112': 'YYYYMMDD', '108': 'HH24:MI:SS', '103': 'DD/MM/YYYY' };
const UNIDAD = { minute: 'mins', mi: 'mins', n: 'mins', hour: 'hours', hh: 'hours', day: 'days', dd: 'days', d: 'days', month: 'months', mm: 'months', m: 'months', year: 'years', yy: 'years', yyyy: 'years', second: 'secs', ss: 'secs', s: 'secs', week: 'weeks', wk: 'weeks' };
function funcionesFecha(t) {
  t = t.replace(/\bSYSDATETIMEOFFSET\s*\(\s*\)/gi, 'now()');
  /* SWITCHOFFSET(x, '-05:00') → hora local de esa zona (sin zona) */
  t = reescribir(t, 'SWITCHOFFSET', (a) => a.length === 2 ? "((" + a[0] + ") at time zone 'utc' + interval " + a[1] + ')' : null);
  t = reescribir(t, 'DATEADD', (a) => { const u = UNIDAD[String(a[0]).toLowerCase()]; return a.length === 3 && u ? '(' + a[2] + " + make_interval(" + u + ' => (' + a[1] + ')::int))' : null; });
  t = reescribir(t, 'CONVERT', (a) => {
    if (a.length === 2 && /^(DATE|TIME|TIMESTAMP|DATETIME2?|INT|INTEGER|BIGINT|SMALLINT|FLOAT|REAL|BIT|(N?VAR)?CHAR\s*\(\s*(\d+|MAX)\s*\)|N?VARCHAR|DECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)|NUMERIC\s*\(\s*\d+\s*,\s*\d+\s*\))$/i.test(a[0]))
      return 'CAST(' + a[1] + ' AS ' + a[0].replace(/^DATETIME2?$/i, 'TIMESTAMP').replace(/^BIT$/i, 'SMALLINT').replace(/^N?VARCHAR\s*\(\s*MAX\s*\)$/i, 'TEXT').replace(/^NVARCHAR/i, 'VARCHAR').replace(/^NCHAR/i, 'CHAR') + ')';
    if (a.length !== 3) return null;
    const ty = a[0].match(/^N?(VAR)?CHAR\s*\(\s*(\d+)\s*\)$/i), f = FMT[a[2]];
    if (!ty || !f) return null;
    if (a[2] === '126' || a[2] === '127') return "LEFT(regexp_replace(to_char(" + a[1] + ", '" + f + "'), '\\.000$', ''), " + ty[2] + ')';   /* SQL Server omite .000 */
    return 'LEFT(to_char(' + a[1] + ", '" + f + "'), " + ty[2] + ')';
  });
  for (const [f, campo] of [['YEAR', 'YEAR'], ['MONTH', 'MONTH'], ['DAY', 'DAY']]) t = reescribir(t, f, (a) => a.length === 1 ? 'EXTRACT(' + campo + ' FROM ' + a[0] + ')::int' : null);
  t = reescribir(t, 'TRY_CONVERT', (a) => a.length === 2 ? 'CAST(' + a[1] + ' AS ' + a[0] + ')' : null);
  t = reescribir(t, 'TRY_CAST', (a) => (a.length === 1 && /\sAS\s/i.test(a[0])) ? 'CAST(' + a[0] + ')' : null);
  return t;
}

/* ── IF de T-SQL: en Supabase el esquema ya existe completo, así que OBJECT_ID/COL_LENGTH se conocen ── */
const KW = /^(SELECT|INSERT|UPDATE|DELETE|MERGE|BEGIN|ALTER|CREATE|DROP|SET|WITH|THROW|RAISERROR|PRINT|EXEC)\b/i;
function topNivel(s, desde, fn) {   /* recorre s fuera de paréntesis y comillas; fn(i) devuelve true para parar */
  let n = 0;
  for (let i = desde; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") { const j = s.indexOf("'", i + 1); if (j < 0) return -1; i = j; continue; }
    if (ch === '(') { n++; continue; } if (ch === ')') { n--; continue; }
    if (n === 0 && /\s/.test(s[i - 1] || ' ') && fn(i)) return i;
  }
  return -1;
}
function evaluarTermino(t) {
  const x = t.trim().replace(/^\(\s*([\s\S]*)\s*\)$/, '$1').trim();
  if (/^(OBJECT_ID|COL_LENGTH|INDEXPROPERTY|TYPE_ID)\s*\([^)]*\)\s+IS\s+NOT\s+NULL$/i.test(x)) return true;
  if (/^(OBJECT_ID|COL_LENGTH|TYPE_ID)\s*\([^)]*\)\s+IS\s+NULL$/i.test(x)) return false;
  if (/^(NOT\s+)?EXISTS\s*\(/i.test(x)) return x;        /* condición real: queda en SQL */
  return undefined;                                       /* no se sabe resolver */
}
function resolverIf(st) {
  if (!/^\s*IF\b/i.test(st)) return { st };
  const s = st.trim(), ini = s.match(/^IF\s+/i)[0].length;
  const k = topNivel(s, ini, (i) => KW.test(s.slice(i)));
  if (k < 0) return { st, pend: 'bloque IF de T-SQL' };
  const cond = s.slice(ini, k);
  let resto = s.slice(k);
  const e = topNivel(resto, 0, (i) => /^ELSE\b/i.test(resto.slice(i)));
  const a = (e < 0 ? resto : resto.slice(0, e)).trim(), b = e < 0 ? null : resto.slice(e + 4).trim();
  const partes = []; let i0 = 0;
  topNivel(cond, 0, (i) => { if (/^AND\b/i.test(cond.slice(i))) { partes.push(cond.slice(i0, i)); i0 = i + 3; } return false; });
  partes.push(cond.slice(i0));
  let estatico = true; const dinamicos = [];
  for (const p of partes) { const v = evaluarTermino(p); if (v === undefined) return { st, pend: 'bloque IF de T-SQL' }; if (v === false) estatico = false; else if (v !== true) dinamicos.push(v); }
  if (/^(THROW|RAISERROR)\b/i.test(a) && !dinamicos.length) {   /* IF <cond> THROW n, 'mensaje', s */
    if (!estatico) return { st: b };
    const msg = (a.match(/'((?:[^']|'')*)'/) || [, 'Error'])[1];
    return { st: "DO $$ BEGIN RAISE EXCEPTION '" + msg.replace(/'/g, "''") + "'; END $$" };
  }
  if (/^BEGIN\b/i.test(a)) return { st: estatico ? null : b, pend: estatico && !/\bCREATE\b/i.test(a) ? 'bloque IF de T-SQL' : null };
  if (!dinamicos.length) return { st: estatico ? a : b };
  if (!estatico) return { st: b };
  const D = dinamicos.join(' AND ');
  if (b) return { st, pend: 'bloque IF de T-SQL' };
  const ins = a.match(/^(INSERT\s+INTO\s+[\w.\[\]]+\s*\([^)]*\))\s*VALUES\s*\(([\s\S]*)\)\s*$/i);
  if (ins) return { st: ins[1] + ' SELECT ' + ins[2] + ' WHERE ' + D };
  if (/^(UPDATE|DELETE)\b/i.test(a)) { const w = topNivel(a, 0, (i) => /^WHERE\b/i.test(a.slice(i))); return { st: w < 0 ? a + ' WHERE ' + D : a.slice(0, w) + 'WHERE (' + D + ') AND ' + a.slice(w + 5) }; }
  return { st, pend: 'bloque IF de T-SQL' };
}

/* ORDER BY: SQL Server ordena los NULL como el valor más bajo (ASC → primero, DESC → al final);
   Postgres al revés. Se agrega NULLS FIRST/LAST a cada columna del ORDER BY que no lo indique. */
function nulosComoSqlServer(s) {
  const re = /\bORDER\s+BY\s+/gi; let m, out = '', i = 0;
  while ((m = re.exec(s))) {
    let j = m.index + m[0].length, n = 0, ini = j; const items = [];
    for (; j <= s.length; j++) {
      const ch = s[j];
      if (ch === "'") { const k = s.indexOf("'", j + 1); if (k < 0) break; j = k; continue; }
      if (ch === '(') { n++; continue; }
      if (ch === ')' && n > 0) { n--; continue; }
      const resto = s.slice(j);
      if (j === s.length || (n === 0 && (ch === ')' || ch === ';' || /^\s+(LIMIT|OFFSET|FOR|UNION|EXCEPT|INTERSECT|RETURNING|FETCH)\b/i.test(resto)))) { items.push(s.slice(ini, j)); break; }
      if (n === 0 && ch === ',') { items.push(s.slice(ini, j)); ini = j + 1; }
    }
    const nuevo = items.map(it => {
      if (/\bNULLS\s+(FIRST|LAST)\b/i.test(it) || !it.trim()) return it;
      const desc = /\bDESC\s*$/i.test(it.trim());
      return it.replace(/\s*$/, '') + (desc ? ' NULLS LAST' : ' NULLS FIRST') + (it.match(/\s*$/) || [''])[0];
    }).join(',');
    out += s.slice(i, m.index + m[0].length) + nuevo; i = m.index + m[0].length + items.join(',').length; re.lastIndex = i;
  }
  return out + s.slice(i);
}

/* SELECT ... GROUP BY sin ORDER BY: SQL Server suele devolverlo ordenado por el agrupamiento y las pantallas
   lo muestran así. Postgres no garantiza orden: se agrega ORDER BY con las mismas columnas del GROUP BY. */
function ordenComoGroupBy(s) {
  if (!/^\s*SELECT\b/i.test(s)) return s;
  let n = 0, gb = -1, ob = -1, fin = s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") { const k = s.indexOf("'", i + 1); if (k < 0) return s; i = k; continue; }
    if (ch === '(') { n++; continue; } if (ch === ')') { n--; continue; }
    if (n !== 0 || !/\s/.test(s[i - 1] || ' ')) continue;
    const r = s.slice(i);
    if (/^GROUP\s+BY\b/i.test(r)) gb = i; else if (/^ORDER\s+BY\b/i.test(r)) ob = i;
    else if (/^(UNION|EXCEPT|INTERSECT)\b/i.test(r)) return s;
    else if (gb >= 0 && fin === s.length && /^(HAVING|LIMIT|OFFSET|FOR)\b/i.test(r)) fin = i;
  }
  if (gb < 0 || ob >= 0) return s;
  const lista = s.slice(gb, fin).replace(/^GROUP\s+BY\s+/i, '').trim();
  if (!lista || /\b(ROLLUP|CUBE|GROUPING)\b/i.test(lista)) return s;
  let fin2 = s.length; const lim = /\s(LIMIT|OFFSET)\b[\s\S]*$/i.exec(s.slice(gb)); if (lim) fin2 = gb + lim.index;
  return s.slice(0, fin2).replace(/\s*$/, '') + ' ORDER BY ' + lista + s.slice(fin2);
}

const UTC = "(now() at time zone 'utc')";

function esDDLProtegido(st) {
  const l = st.replace(/\s+/g, ' ').trim().toUpperCase();
  if (/^IF\s+(NOT\s+)?(OBJECT_ID|COL_LENGTH|EXISTS\s*\(\s*SELECT\b[^)]*\bFROM\s+SYS\.|INDEXPROPERTY|TYPE_ID)/.test(l) && /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|UNIQUE|NONCLUSTERED|CLUSTERED)/.test(l)) return true;
  if (/^(CREATE|ALTER)\s+(TABLE|INDEX|UNIQUE|NONCLUSTERED)/.test(l)) return true;
  /* triggers creados con EXEC('CREATE TRIGGER ...'): en Supabase ya existen (migracion/complementos.sql) */
  if (/^IF\s+(NOT\s+)?EXISTS\s*\(\s*SELECT\b[^)]*\bFROM\s+SYS\.TRIGGERS/.test(l) && /\bEXEC\s*\(/.test(l)) return true;
  return false;
}

function traducirSentencia(st, nombres) {
  const pendiente = [];
  st = st.replace(/^\s*(\/\*[\s\S]*?\*\/\s*)+/, '');      // comentarios de bloque al inicio
  if (/^\s*(BEGIN|END)\s*$/i.test(st)) return { sql: null, pendiente };
  if (esDDLProtegido(st)) return { sql: null, pendiente };   /* se omite: el esquema ya existe */
  const ri = resolverIf(st);
  if (ri.pend) pendiente.push(ri.pend);
  else { if (ri.st == null) return { sql: null, pendiente }; st = ri.st; if (esDDLProtegido(st)) return { sql: null, pendiente }; }
  /* bloqueo para no guardar dos veces a la vez: sp_getapplock → candado de Postgres hasta el fin de la transacción */
  const lk = st.match(/^\s*EXEC\s+sp_getapplock\b[\s\S]*?@Resource\s*=\s*N?'([^']+)'/i);
  if (lk) return { sql: "SELECT pg_advisory_xact_lock(hashtext('" + lk[1] + "'))", pendiente };
  if (/^\s*EXEC\s+sp_releaseapplock\b/i.test(st)) return { sql: null, pendiente };
  /* renumerar filas: WITH x AS (SELECT fila, rn = ROW_NUMBER() OVER (...) FROM t) UPDATE x SET fila = rn */
  const cte = st.match(/^\s*WITH\s+(\w+)\s+AS\s*\(\s*SELECT\s+(\w+)\s*,\s*(\w+)\s*=\s*ROW_NUMBER\s*\(\s*\)\s*OVER\s*\(([^)]*)\)\s*FROM\s+([\w.\[\]]+)\s*\)\s*UPDATE\s+\1\s+SET\s+\2\s*=\s*\3\s*$/i);
  if (cte) { const t = cte[5].replace(/^dbo\./i, '').replace(/[\[\]]/g, ''); return { sql: 'UPDATE ' + t + ' SET ' + cte[2] + ' = x__.' + cte[3] + ' FROM (SELECT ctid AS c__, ROW_NUMBER() OVER (' + cte[4] + ') AS ' + cte[3] + ' FROM ' + t + ') x__ WHERE ' + t + '.ctid = x__.c__', pendiente }; }
  /* SET LOCK_TIMEOUT n → lock_timeout (milisegundos) */
  const lt = st.match(/^\s*SET\s+LOCK_TIMEOUT\s+(-?\d+)\s*$/i);
  if (lt) return { sql: +lt[1] < 0 ? 'SET lock_timeout = 0' : 'SET lock_timeout = ' + lt[1], pendiente };
  /* total de filas por estadística de SQL Server → COUNT(*) */
  const ps = st.match(/^\s*SELECT\s+SUM\s*\(\s*row_count\s*\)\s+AS\s+(\w+)\s+FROM\s+sys\.dm_db_partition_stats\s+WHERE\s+object_id\s*=\s*OBJECT_ID\s*\(\s*N?'(?:dbo\.)?(\w+)'\s*\)[\s\S]*$/i);
  if (ps) return { sql: 'SELECT COUNT(*) AS ' + ps[1] + ' FROM ' + ps[2], pendiente };
  /* WITH (UPDLOCK/HOLDLOCK/XLOCK) sobre una tabla → candado de Postgres sobre esa tabla hasta el fin de la transacción */
  const previas = [];
  st.replace(/\b(?:FROM|JOIN|UPDATE|INTO|MERGE)\s+(?:dbo\.)?\[?(\w+)\]?(?:\s+(?:AS\s+)?(?!WITH\b)\w+)?\s+WITH\s*\(([^)]*)\)/gi, (m, tabla, opc) => {
    if (/UPDLOCK|HOLDLOCK|XLOCK|TABLOCKX/i.test(opc)) { const q = "SELECT pg_advisory_xact_lock(hashtext('tabla:" + tabla.toLowerCase() + "'))"; if (!previas.includes(q)) previas.push(q); }
    return m;
  });
  let s = st.replace(/\b(\w+)\s*=\s*(ROW_NUMBER|RANK|DENSE_RANK)\s*\(\s*\)\s*OVER\s*\(([^)]*)\)/gi, '$2() OVER ($3) AS $1');
  /* _TRAN_LIKE_V1 (05-nov): BEGIN TRAN / COMMIT sueltos los maneja db-pg (envuelve el lote en una transaccion) */
  if (/^\s*(BEGIN\s+TRAN(SACTION)?|COMMIT(\s+TRAN(SACTION)?)?)\s*$/i.test(s)) return { sql: null, pendiente };
  /* LIKE 'bs[_]%' de SQL Server (corchete = literal) → 'bs\_%' en Postgres */
  s = s.replace(/(\bLIKE\s+N?')([^']*)(')/gi, (m, a, pat, c) => a + pat.replace(/\[_\]/g, '\\_').replace(/\[%\]/g, '\\%') + c);
  if (/^\s*(DECLARE|SET\s+NOCOUNT|SET\s+XACT_ABORT|BEGIN\s+TRAN|COMMIT|ROLLBACK)\b/i.test(s)) {
    if (/^\s*SET\s+(NOCOUNT|XACT_ABORT)\b/i.test(s)) return { sql: null, pendiente };
    pendiente.push('sentencia T-SQL de control: ' + s.slice(0, 40));
  }
  if (/^\s*MERGE\b/i.test(s)) {
    /* MERGE dbo.T AS x ... → MERGE INTO T AS x ... ; SET x.col = → SET col = */
    s = s.replace(/^\s*MERGE\s+(?!INTO\b)/i, 'MERGE INTO ');
    s = s.replace(/(\bUPDATE\s+SET\s+|,\s*)(\w+)\.(\w+)\s*=/gi, (m, pre, al, col) => pre + col + ' =');
  } else if (/\bMERGE\b/i.test(s)) pendiente.push('MERGE (revisar)');

  s = fueraDeTextos(s, (p) => {
    let t = p;
    t = t.replace(/@@ROWCOUNT/gi, '__ROWCOUNT__');
    /* parámetros @nombre → $n (el mismo nombre reutiliza el mismo número) */
    /* cada aparición lleva su propio $n (Postgres deduce el tipo por posición: así un mismo @valor
       puede ir como texto en un SELECT y como citext en un WHERE sin "inconsistent types") */
    t = t.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (m, n) => { nombres.lista.push(n.toLowerCase()); return '$' + nombres.lista.length; });
    t = t.replace(/\[([^\]\s][^\]]*)\]/g, (m, n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : '"' + n.toLowerCase() + '"');
    t = t.replace(/\bdbo\./gi, '');
    t = t.replace(/\bCOLLATE\s+Latin1_General_BIN2?\b/gi, 'COLLATE "C"').replace(/\bCOLLATE\s+(SQL_)?Latin1_General_\w+/gi, '').replace(/\bCOLLATE\s+Modern_Spanish_\w+/gi, '');
    t = t.replace(/\b(GETDATE|SYSUTCDATETIME|SYSDATETIME|GETUTCDATE|CURRENT_TIMESTAMP)\s*\(\s*\)/gi, UTC);
    t = t.replace(/\bISNULL\s*\(/gi, 'COALESCE(');
    t = t.replace(/\bLEN\s*\(/gi, 'LENGTH(');
    t = t.replace(/\bNEWID\s*\(\s*\)/gi, 'gen_random_uuid()');
    t = t.replace(/\bN?VARCHAR\s*\(\s*MAX\s*\)/gi, 'TEXT').replace(/\bNTEXT\b/gi, 'TEXT');
    t = t.replace(/\bNVARCHAR\b/gi, 'VARCHAR').replace(/\bNCHAR\b/gi, 'CHAR');
    t = t.replace(/\bDATETIME2?\b(\s*\(\s*\d+\s*\))?/gi, 'TIMESTAMP');
    t = t.replace(/\bAS\s+BIT\b/gi, 'AS SMALLINT').replace(/\bAS\s+INT\b/gi, 'AS INTEGER');
    t = t.replace(/\bWITH\s*\(\s*(NOLOCK|UPDLOCK|HOLDLOCK|ROWLOCK|READPAST|TABLOCK)(\s*,\s*(NOLOCK|UPDLOCK|HOLDLOCK|ROWLOCK|READPAST|TABLOCK))*\s*\)/gi, '');
    t = t.replace(/\bCHARINDEX\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/gi, 'STRPOS($2, $1)');
    /* CONVERT(DATE, x) / CONVERT(VARCHAR(n), x) sin estilo → CAST */
    t = t.replace(/\bCONVERT\s*\(\s*(DATE|TIMESTAMP|INTEGER|INT|SMALLINT|BIGINT|VARCHAR\s*\(\s*\d+\s*\)|TEXT)\s*,\s*([^,()]+(?:\([^()]*\))?)\s*\)/gi, 'CAST($2 AS $1)');
    /* alias con mayúsculas: AS totalHoy → AS "totalHoy" */
    t = t.replace(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)\b/g, (m, a) => (/[A-Z]/.test(a) && !/^(TEXT|VARCHAR|CHAR|DATE|TIMESTAMP|INTEGER|INT|SMALLINT|BIGINT|NUMERIC|DECIMAL|FLOAT|REAL|BOOLEAN|UUID)$/i.test(a) ? 'AS "' + a + '"' : m));
    return t;
  });
  /* N'texto' → 'texto' */
  s = s.replace(/\bN'/g, "'");
  s = ordenComoGroupBy(s);
  if (/\bORDER\s+BY\b/i.test(s)) s = nulosComoSqlServer(s);
  /* funciones de fecha sobre la sentencia completa (sus argumentos pueden llevar textos: SWITCHOFFSET(x, '-05:00')) */
  s = funcionesFecha(s);
  if (/\bCONVERT\s*\(/i.test(s)) pendiente.push('CONVERT con estilo');
  if (/\b(DATEADD|DATEDIFF|DATEPART|DATENAME|EOMONTH|FORMAT|OPENJSON|STRING_AGG|STUFF|PATINDEX|IIF)\s*\(/i.test(s)) pendiente.push('función de fecha/texto T-SQL: ' + (s.match(/\b(DATEADD|DATEDIFF|DATEPART|DATENAME|EOMONTH|FORMAT|OPENJSON|STRING_AGG|STUFF|PATINDEX|IIF)\b/i) || [])[1]);
  /* OUTPUT INSERTED.a, INSERTED.b → RETURNING a, b (va al final del INSERT) */
  const out = s.match(/\bOUTPUT\s+((?:INSERTED|DELETED)\.[A-Za-z_*][A-Za-z0-9_]*(?:\s+AS\s+"?[A-Za-z_][A-Za-z0-9_]*"?)?(?:\s*,\s*(?:INSERTED|DELETED)\.[A-Za-z_*][A-Za-z0-9_]*(?:\s+AS\s+"?[A-Za-z_][A-Za-z0-9_]*"?)?)*)/i);
  if (out) { s = s.replace(out[0], ''); s = s.trim() + ' RETURNING ' + out[1].replace(/\b(INSERTED|DELETED)\./gi, ''); }
  /* (SELECT TOP n ...) entre paréntesis (subconsultas, UNION ALL) → (SELECT ... LIMIT n) */
  for (let guard = 0; guard < 50; guard++) {
    const m = /\(\s*SELECT\s+(DISTINCT\s+)?TOP\s*\(?\s*(\$\d+|\d+)\s*\)?\s+/i.exec(s); if (!m) break;
    let n = 1, j = m.index + 1;
    for (; j < s.length && n; j++) { const ch = s[j]; if (ch === "'") { j = s.indexOf("'", j + 1); if (j < 0) break; continue; } if (ch === '(') n++; else if (ch === ')') n--; }
    if (n || j < 0) break;
    const fin = j - 1;   /* posición del ')' que cierra */
    s = s.slice(0, m.index) + '(SELECT ' + (m[1] || '') + s.slice(m.index + m[0].length, fin) + ' LIMIT ' + m[2] + s.slice(fin);
  }
  /* TOP n → LIMIT n (solo el TOP del SELECT principal) */
  const top = s.match(/^\s*SELECT\s+(DISTINCT\s+)?TOP\s*\(?\s*(\$\d+|\d+)\s*\)?\s+/i);
  if (top) { s = s.replace(top[0], 'SELECT ' + (top[1] || '')); s = s.trim() + ' LIMIT ' + top[2]; }
  if (/\bTOP\s*\(?\s*(\$\d+|\d+)/i.test(s)) pendiente.push('TOP dentro de subconsulta');
  /* OFFSET n ROWS FETCH NEXT m ROWS ONLY */
  s = s.replace(/\bOFFSET\s+(\$\d+|\d+)\s+ROWS?\s+FETCH\s+(?:NEXT|FIRST)\s+(\$\d+|\d+)\s+ROWS?\s+ONLY/gi, 'LIMIT $2 OFFSET $1');
  return { sql: s, pendiente, previas };
}

/* traduce un texto completo (puede traer varias sentencias). Cada sentencia lleva su propia
   numeración $1..$n, porque Postgres ejecuta una sentencia por vez con sus propios parámetros. */
function traducir(sqlTxt) {
  const sentencias = [], pendiente = [];
  for (const st of partir(String(sqlTxt))) {
    const nombres = { lista: [], idx: {} };
    const r = traducirSentencia(st, nombres);
    (r.previas || []).forEach(q => sentencias.push({ sql: q, params: [] }));
    if (r.sql) sentencias.push({ sql: r.sql, params: nombres.lista });
    r.pendiente.forEach(p => pendiente.push(p));
  }
  return { sentencias, pendiente };
}

module.exports = { traducir, partir };
