/* ═══════════════════════════════════════════════════════════════════════════
   eti-sync (_ETI_SYNC_V1, 05-nov-2026) — Copia Firestore -> Supabase desde el SERVIDOR
   Capacitaciones ETI usa Firebase modular y no guarda la sesion del RR.LL., asi que su
   espejo se hace aqui: cada 10 min pg_cron llama esta ruta (con llave), se leen las
   colecciones de Firestore por REST y se dejan IGUALES en eti.<coleccion>
   (altas, cambios y bajas). No toca la pagina de Capacitaciones ni Firestore (solo lee).
     POST /api/eti-sync   { cols?: [...] }   (llave x-functions-key; por defecto las 4 de Capacitaciones)
   Proteccion: si Firestore devuelve 0 documentos y Supabase tiene datos, NO se borra nada.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const PROYECTO = 'sistema-eti-verfrut';
const API_KEY = 'AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';   /* clave web publica del proyecto (la misma de la pagina) */
const PERMITIDAS = ['respuestas_qr', 'evaluaciones_conocimiento', 'config_eti', 'sesiones_qr', 'programaciones_eti',
  'programaciones_eval', 'informes_enviados', 'evaluaciones_depuradas', 'banco_historial',
  'capacitaciones', 'supervisores_eti', 'usuarios_eti'];
const POR_DEFECTO = ['capacitaciones', 'supervisores_eti', 'programaciones_eti', 'usuarios_eti'];

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
    const cols = (Array.isArray(b.cols) && b.cols.length ? b.cols : POR_DEFECTO).filter(function (c) { return PERMITIDAS.indexOf(c) >= 0; });
    const res = {};
    for (const c of cols) {
      const docs = await leerColeccion(c);
      const cli = await pool.connect();
      try {
        await cli.query('BEGIN');
        const antes = (await cli.query(`SELECT COUNT(*)::int AS n FROM eti.${c}`)).rows[0].n;
        const up = await cli.query(`INSERT INTO eti.${c} (id, datos, origen)
            SELECT x->>'id', COALESCE(x->'datos', '{}'::jsonb), 'sync' FROM jsonb_array_elements($1::jsonb) x
            ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado = now(), origen = 'sync'
            WHERE eti.${c}.datos IS DISTINCT FROM EXCLUDED.datos`, [JSON.stringify(docs)]);
        let borrados = 0;
        if (docs.length || antes === 0) {
          const del = await cli.query(`DELETE FROM eti.${c} WHERE NOT (id = ANY($1::text[]))`, [docs.map(function (d) { return d.id; })]);
          borrados = del.rowCount;
        }
        if (up.rowCount || borrados) await cli.query(`INSERT INTO eti._bitacora (coleccion, id, op, usuario, origen) VALUES ($1, $2, $3, $4, $5)`,
          [c, '*', 'sync', 'servidor', 'sync: ' + up.rowCount + ' altas/cambios, ' + borrados + ' bajas']);
        await cli.query('COMMIT');
        res[c] = { firestore: docs.length, altasCambios: up.rowCount, bajas: borrados };
      } catch (e) { try { await cli.query('ROLLBACK'); } catch (x) {} throw e; } finally { cli.release(); }
    }
    context.res = { status: 200, body: { success: true, colecciones: res, ms: Date.now() - t0 } };
  } catch (e) {
    context.log.error('[eti-sync] ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
