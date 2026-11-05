/* ═══════════════════════════════════════════════════════════════════════════
   archivos (_FASE4_V1, 05-nov-2026) — Fotos y PDF en Supabase Storage
   Corre SOLO en Supabase (Edge Function "api"): usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
   que Supabase ya entrega a sus funciones (nunca salen de ahi). Requiere la llave de funcion.
     POST /api/archivos/preparar           crea los buckets publicos casos-rl, visitas-campo, documentos
     POST /api/archivos/subir              { contenedor, nombre, base64, tipo } -> { success, enlace, url }
     POST /api/archivos/migrar             { contenedor, marcador, lote } copia de Azure Blob (mismo nombre)
     POST /api/archivos/estado             cuenta los archivos ya copiados por bucket
   La direccion publica nueva es:  <SUPABASE_URL>/storage/v1/object/public/<contenedor>/<nombre>
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { StorageSharedKeyCredential, BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions } = require('@azure/storage-blob');

const BUCKETS = ['casos-rl', 'visitas-campo', 'documentos'];
const env = (k) => (typeof process !== 'undefined' && process.env && process.env[k]) || '';

function supa() {
  const url = env('SUPABASE_URL').replace(/\/+$/, ''), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Este modulo solo funciona en Supabase');
  return { url, key, h: { Authorization: 'Bearer ' + key, apikey: key } };
}
function contenedorDe(c) {
  const x = String(c || '').trim();
  if (x === 'Visitas_Campo' || x === 'visitas-campo') return 'visitas-campo';
  if (x === 'documentos') return 'documentos';
  return 'casos-rl';
}
const limpiarNombre = (n) => String(n || ('archivo_' + Date.now() + '.pdf')).replace(/[^a-zA-Z0-9._-]/g, '_');
const rutaUrl = (n) => String(n).split('/').map(encodeURIComponent).join('/');
const publica = (s, bucket, nombre) => s.url + '/storage/v1/object/public/' + bucket + '/' + rutaUrl(nombre);

async function subirBytes(s, bucket, nombre, bytes, tipo) {
  const r = await fetch(s.url + '/storage/v1/object/' + bucket + '/' + rutaUrl(nombre), {
    method: 'POST', headers: Object.assign({ 'Content-Type': tipo || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '3600' }, s.h), body: bytes
  });
  if (!r.ok) throw new Error('Storage HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

async function preparar() {
  const s = supa(), out = {};
  for (const b of BUCKETS) {
    const r = await fetch(s.url + '/storage/v1/bucket', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ id: b, name: b, public: true }) });
    const t = await r.text();
    out[b] = r.ok ? 'creado' : (/exist|duplicate/i.test(t) ? 'ya existia' : 'HTTP ' + r.status + ' ' + t.slice(0, 120));
  }
  return { success: true, buckets: out };
}

async function subir(b) {
  const s = supa();
  let b64 = String(b.base64 || b.datos || '');
  if (!b64) return { success: false, error: 'base64 vacío' };
  if (b64.indexOf(',') !== -1) b64 = b64.split(',')[1];
  b64 = b64.replace(/\s/g, '');
  const bytes = Buffer.from(b64, 'base64');
  const bucket = contenedorDe(b.contenedor || b.carpeta), nombre = limpiarNombre(b.nombre);
  await subirBytes(s, bucket, nombre, bytes, b.mimeType || b.tipo || 'application/pdf');
  const u = publica(s, bucket, nombre);
  return { success: true, enlace: u, url: u, bytes: bytes.length, contenedor: bucket };
}

async function migrar(b) {
  const s = supa();
  const cuenta = env('STORAGE_ACCOUNT_NAME'), llave = env('STORAGE_ACCOUNT_KEY');
  if (!cuenta || !llave) throw new Error('Faltan STORAGE_ACCOUNT_NAME / STORAGE_ACCOUNT_KEY');
  const bucket = contenedorDe(b.contenedor), lote = Math.max(1, Math.min(40, parseInt(b.lote, 10) || 15));
  const cred = new StorageSharedKeyCredential(cuenta, llave);
  const base = env('AZ_BLOB_ENDPOINT') || ('https://' + cuenta + '.blob.core.windows.net');   /* AZ_BLOB_ENDPOINT solo para pruebas */
  const cont = new BlobServiceClient(base, cred).getContainerClient(bucket);
  const sas = generateBlobSASQueryParameters({ containerName: bucket, permissions: ContainerSASPermissions.parse('r'), expiresOn: new Date(Date.now() + 30 * 60000) }, cred).toString();
  const pagina = (await cont.listBlobsFlat().byPage({ continuationToken: b.marcador || undefined, maxPageSize: lote }).next()).value;
  const items = (pagina && pagina.segment && pagina.segment.blobItems) || [];
  let copiados = 0; const errores = [];
  for (const it of items) {
    try {
      const r = await fetch(base + '/' + bucket + '/' + rutaUrl(it.name) + '?' + sas);
      if (!r.ok) throw new Error('Azure HTTP ' + r.status);
      const bytes = new Uint8Array(await r.arrayBuffer());
      await subirBytes(s, bucket, it.name, bytes, (it.properties && it.properties.contentType) || r.headers.get('content-type') || 'application/octet-stream');
      copiados++;
    } catch (e) { errores.push({ nombre: it.name, error: String(e.message || e).slice(0, 160) }); }
  }
  const siguiente = (pagina && pagina.continuationToken) || '';
  return { success: true, contenedor: bucket, revisados: items.length, copiados, errores, marcador: siguiente, fin: !siguiente };
}

async function estado() {
  const s = supa(), out = {};
  for (const b of BUCKETS) {
    let n = 0, offset = 0;
    for (let i = 0; i < 50; i++) {
      const r = await fetch(s.url + '/storage/v1/object/list/' + b, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ prefix: '', limit: 1000, offset }) });
      if (!r.ok) { out[b] = 'HTTP ' + r.status; break; }
      const arr = await r.json(); n += arr.length; offset += arr.length;
      if (arr.length < 1000) { out[b] = n; break; }
    }
  }
  return { success: true, archivos: out };
}

/* _FASE4_DIRECTO_V1: "subir" acepta la sesion del usuario (las pantallas suben directo, sin Apps Script)
   o la llave de funcion (Apps Script). Las demas acciones exigen la llave de funcion. */
function llaveValida(req) {
  const q = (req.query && req.query.code) || '', h = (req.headers && req.headers['x-functions-key']) || '';
  const dada = String(q || h || '').trim();
  const validas = env('RL_FN_KEYS').split(',').map(x => x.trim()).filter(Boolean);
  return !!dada && validas.indexOf(dada) >= 0;
}
function sesionValida(req) {
  try {
    const a = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
    if (!a.startsWith('Bearer ') || !env('JWT_SECRET')) return null;
    return require('jsonwebtoken').verify(a.slice(7).trim(), env('JWT_SECRET'));
  } catch (e) { return null; }
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const conLlave = llaveValida(req), usuario = conLlave ? null : sesionValida(req);
  if (!conLlave && !(accion === 'subir' && usuario)) { context.res = { status: 401, body: { success: false, error: accion === 'subir' ? 'Sesion o llave requerida' : 'Llave de funcion invalida o ausente' } }; return; }
  try {
    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    let r;
    if (accion === 'preparar') r = await preparar();
    else if (accion === 'subir') { r = await subir(b); if (usuario) context.log('[archivos] ' + (usuario.usuario || '?') + ' subio ' + (r.contenedor || '') + '/' + String(b.nombre || '').slice(0, 80)); }
    else if (accion === 'migrar') r = await migrar(b);
    else if (accion === 'estado') r = await estado();
    else { context.res = { status: 404, body: { success: false, error: 'Accion desconocida' } }; return; }
    context.res = { status: 200, body: r };
  } catch (e) {
    context.log.error('[archivos] ' + accion + ': ' + e.message);
    context.res = { status: 500, body: { success: false, error: e.message } };
  }
};
