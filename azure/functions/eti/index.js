/* ═══════════════════════════════════════════════════════════════════════════
   eti (_ETI_SUPABASE_V1, 05-nov-2026) — Datos de Evaluacion ETI y Capacitaciones ETI en Supabase
   Cada coleccion de Firestore es una tabla eti.<coleccion> (id, datos jsonb). Mismas consultas
   que usa el codigo (where ==, >=, <=, <, >, in, array-contains · orderBy · limit).
     POST /api/eti/consultar  { col, filtros:[[campo,op,valor]], orden:[campo,'asc'|'desc'], limite }
     POST /api/eti/doc        { col, id }
     POST /api/eti/escribir   { ops:[{ col, id, op:'set'|'update'|'delete', datos, merge }] }
     POST /api/eti/importar   { col, docs:[{ id, datos }] }        (solo administrador)
     POST /api/eti/contar     { cols:[...] }                         (solo administrador)
     POST /api/eti/encuesta   { ses, resp:{...} }                    (sin sesion: respuesta de la encuesta de satisfaccion)
   Permisos: sin sesion SOLO lo que usa la pagina QR del trabajador (leer sesion/config/programacion
   del dia y guardar su respuesta). Todo lo demas exige la sesion del Sistema RR.LL. (Bearer).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const COLS = ['respuestas_qr', 'evaluaciones_conocimiento', 'config_eti', 'sesiones_qr', 'programaciones_eti',
  'programaciones_eval', 'informes_enviados', 'evaluaciones_depuradas', 'banco_historial',
  'capacitaciones', 'supervisores_eti', 'usuarios_eti',
  'informes_eti', 'informes_cap',
  'encuestas_qr', 'encuestas_sat',
  'alertas_ref'];   /* _ALERTAS_REF_V1 (06-nov): seguimiento del reforzamiento por ruta y tema */   /* _ENCUESTA_SAT_V1 (05-nov): QR de encuesta de satisfaccion y sus respuestas */   /* _CAP_INFORME_V1: informes de capacitacion del Sistema RR.LL. */   /* _INFORME_ETI_V1 (05-nov): informes INF-SC-GH-03 emitidos (solo Supabase) */
/* informes ya emitidos: solo estos usuarios (o un administrador) pueden corregirlos o borrarlos */
const EDITORES_INFORME = ['jtimoteo', 'lcastillo'];
const editorInforme = (u) => !!u && (esAdminU(u) || EDITORES_INFORME.indexOf(String(u.usuario || '').toLowerCase()) >= 0);
const LECTURA_ANONIMA = ['sesiones_qr', 'config_eti', 'programaciones_eval'];
const DOC_ANONIMO = ['encuestas_qr'];   /* _ENCUESTA_SAT_V1: la pagina del trabajador lee SOLO su QR (por id), nunca la lista */
function esAdminU(u) { return !!u && /^admin/i.test(String(u.rol || '')); }
const OPS = { '==': '=', '>=': '>=', '<=': '<=', '<': '<', '>': '>' };
const env = (k) => (typeof process !== 'undefined' && process.env && process.env[k]) || '';

function pool() {
  const db = require('../shared/db');
  if (typeof db.pgDirecto !== 'function') throw new Error('Este modulo solo funciona con Supabase');
  return db.pgDirecto();
}
function sesion(req) {
  try {
    const a = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
    if (!a.startsWith('Bearer ') || !env('JWT_SECRET')) return null;
    return require('jsonwebtoken').verify(a.slice(7).trim(), env('JWT_SECRET'));
  } catch (e) { return null; }
}
const esAdmin = (u) => !!u && /^admin/i.test(String(u.rol || ''));
function col(c) { if (COLS.indexOf(c) < 0) throw Object.assign(new Error('Coleccion no permitida: ' + c), { status: 400 }); return c; }
const campoOk = (f) => /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(String(f));
function ruta(f) { return '{' + String(f).split('.').join(',') + '}'; }

async function consultar(b, u) {
  const c = col(b.col);
  if (!u && LECTURA_ANONIMA.indexOf(c) < 0) throw Object.assign(new Error('Sesion requerida'), { status: 401 });
  const w = [], v = [];
  for (const f of (Array.isArray(b.filtros) ? b.filtros : [])) {
    const [campo, op, valor] = f;
    if (!campoOk(campo)) throw Object.assign(new Error('Campo invalido'), { status: 400 });
    v.push(ruta(campo)); const pc = '$' + v.length;
    if (OPS[op]) { v.push(JSON.stringify(valor)); w.push(`(datos #> ${pc}::text[]) ${OPS[op]} $${v.length}::jsonb`); }
    else if (op === 'in') { v.push(JSON.stringify(Array.isArray(valor) ? valor : [])); w.push(`(datos #> ${pc}::text[]) IN (SELECT jsonb_array_elements($${v.length}::jsonb))`); }
    else if (op === 'array-contains') { v.push(JSON.stringify([valor])); w.push(`jsonb_typeof(datos #> ${pc}::text[]) = 'array' AND (datos #> ${pc}::text[]) @> $${v.length}::jsonb`); }
    else throw Object.assign(new Error('Operador no soportado: ' + op), { status: 400 });
    /* Firestore no compara tipos distintos: el valor del documento debe ser del mismo tipo que el filtro */
    if (OPS[op] && op !== '==') { v.push(valor === null ? 'null' : Array.isArray(valor) ? 'array' : typeof valor === 'object' ? 'object' : typeof valor === 'boolean' ? 'boolean' : typeof valor === 'number' ? 'number' : 'string'); w.push(`jsonb_typeof(datos #> ${pc}::text[]) = $${v.length}`); }
  }
  let orden = 'id';
  if (Array.isArray(b.orden) && b.orden[0]) {
    if (!campoOk(b.orden[0])) throw Object.assign(new Error('Campo invalido'), { status: 400 });
    v.push(ruta(b.orden[0]));
    orden = `(datos #> $${v.length}::text[]) ${String(b.orden[1]).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}, id`;
    w.push(`(datos #> $${v.length}::text[]) IS NOT NULL`);   /* como Firestore: orderBy excluye los que no tienen el campo */
  }
  const lim = Math.max(1, Math.min(20000, parseInt(b.limite, 10) || 20000));
  const r = await pool().query(`SELECT id, datos FROM eti.${c}${w.length ? ' WHERE ' + w.join(' AND ') : ''} ORDER BY ${orden} LIMIT ${lim}`, v);
  return { success: true, docs: r.rows };
}

async function leerDoc(b, u) {
  const c = col(b.col);
  if (!u && LECTURA_ANONIMA.indexOf(c) < 0 && DOC_ANONIMO.indexOf(c) < 0) throw Object.assign(new Error('Sesion requerida'), { status: 401 });
  const r = await pool().query(`SELECT id, datos FROM eti.${c} WHERE id = $1`, [String(b.id)]);
  return { success: true, existe: r.rows.length > 0, id: String(b.id), datos: r.rows.length ? r.rows[0].datos : null };
}

async function escribir(b, u) {
  const ops = Array.isArray(b.ops) ? b.ops.slice(0, 500) : [];
  if (!ops.length) return { success: true, aplicadas: 0 };
  for (const o of ops) {
    col(o.col);
    if (!o.id || String(o.id).length > 200) throw Object.assign(new Error('id invalido'), { status: 400 });
    /* sin sesion: solo la respuesta del trabajador (crear o marcar azOk), nunca borrar */
    if (!u && !(o.col === 'respuestas_qr' && (o.op === 'set' || o.op === 'update'))) throw Object.assign(new Error('Sesion requerida'), { status: 401 });
  }
  const cli = await pool().connect();
  try {
    await cli.query('BEGIN');
    for (const o of ops) {
      const id = String(o.id), d = JSON.stringify(o.datos || {});
      if ((o.col === 'informes_eti' || o.col === 'informes_cap') && !editorInforme(u)) {   /* _INFORME_ETI_V1: el supervisor solo crea su informe; corregir o borrar = editores */
        const ya = await cli.query(`SELECT 1 FROM eti.${o.col} WHERE id = $1`, [id]);
        if (o.op === 'delete' || ya.rows.length) throw Object.assign(new Error('Solo los administradores de informes pueden corregir un informe emitido'), { status: 403 });
      }
      if (o.col === 'alertas_ref' && o.op === 'delete' && !editorInforme(u)) throw Object.assign(new Error('Solo los administradores pueden borrar un seguimiento'), { status: 403 });   /* _ALERTAS_REF_V1 */
      if (o.col === 'encuestas_sat' && !editorInforme(u)) throw Object.assign(new Error('Las respuestas de la encuesta no se pueden modificar'), { status: 403 });   /* _ENCUESTA_SAT_V1: el supervisor no puede tocar su propia evaluacion */
      if (o.op === 'delete') await cli.query(`DELETE FROM eti.${o.col} WHERE id = $1`, [id]);
      else if (o.op === 'set' && !o.merge) await cli.query(`INSERT INTO eti.${o.col} (id, datos, origen) VALUES ($1, $2::jsonb, $3)
          ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado = now(), origen = EXCLUDED.origen`, [id, d, o.origen || 'espejo']);
      else if (o.op === 'set' || o.op === 'update') {
        /* update de Firestore: claves con punto ("a.b") cambian solo ese subcampo; set merge = mezcla profunda */
        const plano = {}, rutas = [];
        for (const [k, val] of Object.entries(o.datos || {})) { if (o.op === 'update' && k.indexOf('.') > 0) rutas.push([k.split('.'), val]); else plano[k] = val; }
        await cli.query(`INSERT INTO eti.${o.col} (id, datos, origen) VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (id) DO UPDATE SET datos = ${o.op === 'update' ? `eti.${o.col}.datos || EXCLUDED.datos` : `eti.mezclar(eti.${o.col}.datos, EXCLUDED.datos)`}, actualizado = now()`,
          [id, JSON.stringify(plano), o.origen || 'espejo']);
        /* "a.b.c": crea los mapas intermedios que falten (como Firestore) y cambia solo esa hoja */
        for (const [p, val] of rutas) { const n = {}; let x = n; p.forEach((k, i) => { if (i === p.length - 1) x[k] = val; else x = (x[k] = {}); });
          await cli.query(`UPDATE eti.${o.col} SET datos = eti.mezclar(datos, $2::jsonb), actualizado = now() WHERE id = $1`, [id, JSON.stringify(n)]); }
      } else throw Object.assign(new Error('op invalida: ' + o.op), { status: 400 });
      await cli.query(`INSERT INTO eti._bitacora (coleccion, id, op, usuario, origen) VALUES ($1, $2, $3, $4, $5)`, [o.col, id, o.op, (u && u.usuario) || 'anonimo', o.origen || 'espejo']);
    }
    await cli.query('COMMIT');
    return { success: true, aplicadas: ops.length };
  } catch (e) { try { await cli.query('ROLLBACK'); } catch (x) {} throw e; } finally { cli.release(); }
}

/* _ENCUESTA_SAT_V1 (05-nov): respuesta del trabajador a la encuesta de satisfaccion (sin sesion).
   El servidor valida el QR (existe, abierto, vigente) y copia los datos de la capacitacion desde el QR,
   asi nadie puede cambiar supervisor, tema o fecha desde el celular. Solo se aceptan las respuestas validas. */
const ESC5 = ['p1', 'p2', 'p3', 'p4b', 'p5', 'p8', 'p9'];
function hoyLima() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); }
async function encuesta(b) {
  const sid = String(b.ses || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  if (!sid) throw Object.assign(new Error('Codigo QR no valido'), { status: 400 });
  const q = await pool().query('SELECT datos FROM eti.encuestas_qr WHERE id = $1', [sid]);
  if (!q.rows.length) throw Object.assign(new Error('Encuesta no encontrada'), { status: 404 });
  const S = q.rows[0].datos || {};
  if (S.estado !== 'abierta' || (S.expira && Date.now() > S.expira)) throw Object.assign(new Error('Esta encuesta ya fue cerrada'), { status: 409 });
  const r = (b.resp && typeof b.resp === 'object') ? b.resp : {}, d = {};
  ESC5.forEach(function (k) { const n = parseInt(r[k], 10); if (n >= 1 && n <= 5) d[k] = n; });
  if (r.p4 === 'si' || r.p4 === 'no') d.p4 = r.p4; if (d.p4 !== 'si') delete d.p4b;
  if (['si', 'no', 'nose'].indexOf(r.p6) >= 0) d.p6 = r.p6;
  if (['corto', 'adecuado', 'largo'].indexOf(r.p7) >= 0) d.p7 = r.p7;
  if (['obrero', 'empleado'].indexOf(r.tipo) >= 0) d.tipo = r.tipo;
  if (r.sexo === 'H' || r.sexo === 'M') d.sexo = r.sexo;
  d.sector = String(r.sector || S.sector || '').trim().slice(0, 80);
  d.ruta = String(r.ruta || '').trim().slice(0, 60);
  d.coment = String(r.coment || '').trim().slice(0, 600);
  if (['p1', 'p2', 'p3', 'p5', 'p9'].some(function (k) { return !d[k]; })) throw Object.assign(new Error('Faltan respuestas'), { status: 400 });
  Object.assign(d, { ses: sid, sup: S.sup || '', usuario: S.usuario || '', emp: S.emp || '', tema: S.tema || '', ciclo: S.ciclo || '',
    capId: S.capId || '', fecha: S.fecha || hoyLima(), ts: Date.now(), en: new Date().toISOString() });
  const id = sid + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  await pool().query(`INSERT INTO eti.encuestas_sat (id, datos, origen) VALUES ($1, $2::jsonb, 'qr')`, [id, JSON.stringify(d)]);
  await pool().query(`INSERT INTO eti._bitacora (coleccion, id, op, usuario, origen) VALUES ('encuestas_sat', $1, 'set', 'anonimo', 'qr')`, [id]);
  return { success: true, id: id };
}

async function importar(b, u) {
  if (!esAdmin(u)) throw Object.assign(new Error('Solo el administrador'), { status: 403 });
  const c = col(b.col), docs = Array.isArray(b.docs) ? b.docs.slice(0, 1000) : [];
  if (!docs.length) return { success: true, importados: 0 };
  const r = await pool().query(`INSERT INTO eti.${c} (id, datos, origen)
      SELECT x->>'id', COALESCE(x->'datos', '{}'::jsonb), 'importacion' FROM jsonb_array_elements($1::jsonb) x
      ON CONFLICT (id) DO UPDATE SET datos = EXCLUDED.datos, actualizado = now(), origen = 'importacion'`, [JSON.stringify(docs)]);
  return { success: true, importados: r.rowCount };
}

async function contar(b, u) {
  if (!esAdmin(u)) throw Object.assign(new Error('Solo el administrador'), { status: 403 });
  const out = {};
  for (const c of (Array.isArray(b.cols) && b.cols.length ? b.cols : COLS)) {
    col(c);
    const r = await pool().query(`SELECT COUNT(*)::int AS n, COALESCE(md5(string_agg(id || ':' || md5(datos::text), ',' ORDER BY id)), '') AS huella FROM eti.${c}`);
    out[c] = r.rows[0];
  }
  return { success: true, colecciones: out };
}

module.exports = async function (context, req) {
  const t0 = Date.now();
  const accion = context.bindingData && context.bindingData.accion;
  const u = sesion(req), b = (req.body && typeof req.body === 'object') ? req.body : {};
  try {
    let r;
    if (accion === 'consultar') r = await consultar(b, u);
    else if (accion === 'doc') r = await leerDoc(b, u);
    else if (accion === 'escribir') r = await escribir(b, u);
    else if (accion === 'importar') r = await importar(b, u);
    else if (accion === 'contar') r = await contar(b, u);
    else if (accion === 'encuesta') r = await encuesta(b);
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    if (r && typeof r === 'object') r.ms = Date.now() - t0;   /* _ETI_MS_V1: tiempo del servidor (diagnostico de velocidad) */
    context.res = { status: 200, body: r };
  } catch (e) {
    if (!e.status) context.log.error('[eti] ' + accion + ': ' + e.message);
    context.res = { status: e.status || 500, body: { success: false, error: e.message } };
  }
};
