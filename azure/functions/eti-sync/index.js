/* ═══════════════════════════════════════════════════════════════════════════
   eti-sync (_ETI_SYNC_V1, 05-nov-2026) — Copia Firestore -> Supabase desde el SERVIDOR
   Capacitaciones ETI usa Firebase modular y no guarda la sesion del RR.LL., asi que su
   espejo se hace aqui: cada 10 min pg_cron llama esta ruta (con llave), se leen las
   colecciones de Firestore por REST y se dejan IGUALES en eti.<coleccion>
   (altas, cambios y bajas). No toca la pagina de Capacitaciones ni Firestore (solo lee).
     POST /api/eti-sync   { cols?: [...] }   (llave x-functions-key; por defecto las 4 de Capacitaciones)
   Proteccion: si Firestore devuelve 0 documentos y Supabase tiene datos, NO se borra nada.
   _ETI_SYNC_V2 (11-nov-2026): el servidor pasa a ser quien mantiene iguales las 12 colecciones.
     · Las 4 de Capacitaciones siguen en cada pasada (10 min). Las otras 8 van UNA vez por hora
       (la pasada que cae en los primeros 10 minutos de la hora) o cuando se pide { todas: true }.
       Asi las lecturas a Firestore suben poco (cuota diaria). Se apaga con el secreto ETI_SYNC_TODO=0.
     · No pisa ni borra lo que el navegador acaba de escribir: solo toca filas cuya ultima
       actualizacion es ANTERIOR al momento en que se empezo a leer Firestore.
     · Solo da de baja lo que el mismo servidor ya habia visto en Firestore; lo demas lo informa en "sobran".
     · Una coleccion que falla no detiene a las demas (queda anotada en la respuesta).
     · Las cuentas de los ETI se copian SIN huella de clave ni clave, aunque reaparezcan en Firestore.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const PROYECTO = 'sistema-eti-verfrut';
const API_KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';   /* clave web publica del proyecto (la misma de la pagina) */
const PERMITIDAS = ['respuestas_qr', 'evaluaciones_conocimiento', 'config_eti', 'sesiones_qr', 'programaciones_eti',
  'programaciones_eval', 'informes_enviados', 'evaluaciones_depuradas', 'banco_historial',
  'capacitaciones', 'supervisores_eti', 'usuarios_eti'];
const POR_DEFECTO = ['capacitaciones', 'supervisores_eti', 'programaciones_eti', 'usuarios_eti'];
/* _ETI_SYNC_V2: las demas, una vez por hora */
const RESTO = PERMITIDAS.filter(function (c) { return POR_DEFECTO.indexOf(c) < 0; });
const envS = function (k) { return (typeof process !== 'undefined' && process.env && process.env[k]) || ''; };
const SIN_CLAVE = { usuarios_eti: ['password_hash', 'password'] };

/* valor tipado de Firestore REST -> JSON (igual que lo guarda el espejo: fechas en ISO) */
function valor(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return new Date(v.timestampValue).toISOString();
  if ('stringValue' in v) return v.stringValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return { latitude: v.geoPointValue.latitude || 0, longitude: v.geoPointValue.longitude || 0 };
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(valor);
  if ('mapValue' in v) return campos((v.mapValue && v.mapValue.fields) || {});
  return null;
}
function campos(f) { const o = {}; Object.keys(f || {}).forEach(function (k) { o[k] = valor(f[k]); }); return o; }

async function leerColeccion(c) {
  const docs = []; let token = '', vueltas = 0;
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents/' + c
      + '?pageSize=300&key=' + API_KEY + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = await fetch(url);
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error('Firestore ' + c + ': HTTP ' + r.status + ' ' + ((j.error && j.error.message) || ''));
    (j.documents || []).forEach(function (d) {
      const p = String(d.name).split('/');
      if (p[p.length - 2] === c) docs.push({ id: p[p.length - 1], datos: campos(d.fields) });
    });
    token = j.nextPageToken || '';
  } while (token && ++vueltas < 100);
  return docs;
}

module.exports = async function (context, req) {
  const t0 = Date.now();
  try {
    const db = require('../shared/db');
    if (typeof db.pgDirecto !== 'function') throw new Error('Este modulo solo funciona con Supabase');
    const pool = db.pgDirecto();
    const b = (req && req.body && typeof req.body === 'object') ? req.body : {};
    let pedir = POR_DEFECTO;
    if (Array.isArray(b.cols) && b.cols.length) pedir = b.cols;
    else if (envS('ETI_SYNC_TODO') !== '0' && (b.todas === true || new Date().getUTCMinutes() < 10)) pedir = POR_DEFECTO.concat(RESTO);   /* _ETI_SYNC_V2 */
    const cols = pedir.filter(function (c) { return PERMITIDAS.indexOf(c) >= 0; });
    const res = {}; let fallas = 0;
    for (const c of cols) {
     try {   /* _ETI_SYNC_V2: cada coleccion por separado */
      const inicio = (await pool.query('SELECT now() AS t')).rows[0].t;   /* hora de la base ANTES de leer Firestore */
      const docs = await leerColeccion(c);
      if (SIN_CLAVE[c]) docs.forEach(function (d) { SIN_CLAVE[c].forEach(function (k) { if (d.datos && k in d.datos) delete d.datos[k]; }); });
      const cli = await pool.connect();
      try {
        await cli.query('BEGIN');
        const antes = (await cli.query(`SELECT COUNT(*)::int AS n FROM eti.${c}`)).rows[0].n;
        const up = await cli.query(`INSERT INTO eti.${c} (id, datos, origen)
            SELECT x->>'id', COALESCE(x->'datos', '{}'::jsonb), 'sync' FROM jsonb_array_elements($1::jsonb) x
            ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado = now(), origen = 'sync'
            WHERE eti.${c}.datos IS DISTINCT FROM EXCLUDED.datos AND eti.${c}.actualizado < $2`, [JSON.stringify(docs), inicio]);
        let borrados = 0, sobran = 0;
        const ids = docs.map(function (d) { return d.id; });
        /* _ETI_SYNC_V2: el servidor solo da de baja lo que EL MISMO ya vio en Firestore (origen = 'sync').
           Lo que el navegador escribio en Supabase y todavia no aparece en Firestore (celular sin senal) NO se borra: se cuenta en "sobran". */
        if (ids.length) await cli.query(`UPDATE eti.${c} SET origen = 'sync' WHERE id = ANY($1::text[]) AND origen IS DISTINCT FROM 'sync' AND actualizado < $2`, [ids, inicio]);
        if (docs.length || antes === 0) {
          const del = await cli.query(`DELETE FROM eti.${c} WHERE NOT (id = ANY($1::text[])) AND actualizado < $2 AND origen = 'sync'`, [ids, inicio]);
          borrados = del.rowCount;
          sobran = (await cli.query(`SELECT COUNT(*)::int AS n FROM eti.${c} WHERE NOT (id = ANY($1::text[]))`, [ids])).rows[0].n;
        }
        if (up.rowCount || borrados) await cli.query(`INSERT INTO eti._bitacora (coleccion, id, op, usuario, origen) VALUES ($1, $2, $3, $4, $5)`,
          [c, '*', 'sync', 'servidor', 'sync: ' + up.rowCount + ' altas/cambios, ' + borrados + ' bajas']);
        await cli.query('COMMIT');
        res[c] = { firestore: docs.length, altasCambios: up.rowCount, bajas: borrados, sobran: sobran };
      } catch (e) { try { await cli.query('ROLLBACK'); } catch (x) {} throw e; } finally { cli.release(); }
     } catch (e) { fallas++; res[c] = { error: e.message }; context.log.error('[eti-sync] ' + c + ': ' + e.message); }
    }
    context.res = { status: fallas && fallas === cols.length ? 500 : 200, body: { success: !(fallas && fallas === cols.length), colecciones: res, fallas: fallas, ms: Date.now() - t0 } };
  } catch (e) {
    context.log.error('[eti-sync] ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
