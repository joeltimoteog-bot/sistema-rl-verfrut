/* ═══════════════════════════════════════════════════════════════════════════
   _ADAPTADOR_EDGE_V1 (05-nov-2026) — Ejecuta las MISMAS funciones de Azure dentro de
   una Supabase Edge Function. Convierte la peticion web (Request) al formato de Azure
   (context, req), llama a la funcion original y devuelve context.res como Response.
   El codigo de cada funcion NO cambia: Azure y Supabase corren lo mismo.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const RUTAS = require('./_rutas_edge.js');

/* plantilla "atenciones/{accion}" → expresion regular con nombres */
const TABLA = RUTAS.map(function (r) {
  const nombres = [];
  const patron = '^' + r.ruta.split('/').map(function (p) {
    const m = p.match(/^\{(\w+)(?::[^}]*)?(\?)?\}$/);
    if (m) { nombres.push(m[1]); return m[2] ? '?([^/]*)' : '([^/]+)'; }
    return p.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  }).join('/') + '/?$';
  /* rutas fijas primero (atenciones/guardar antes que atenciones/{accion}) */
  return Object.assign({ re: new RegExp(patron, 'i'), nombres: nombres, fijas: nombres.length === 0 ? 1 : 0 }, r);
}).sort(function (a, b) { return b.fijas - a.fijas || b.ruta.length - a.ruta.length; });

function cors(request) {
  const origen = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origen,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || 'authorization, content-type, x-client-info, apikey, x-functions-key',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'x-rl-edge'
  };
}

function registro(prefijo) {
  const f = function () { console.log.apply(console, [prefijo].concat([].slice.call(arguments))); };
  f.info = f; f.verbose = function () {};
  f.warn = function () { console.warn.apply(console, [prefijo].concat([].slice.call(arguments))); };
  f.error = function () { console.error.apply(console, [prefijo].concat([].slice.call(arguments))); };
  return f;
}

async function manejar(request) {
  const url = new URL(request.url);
  const C = cors(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: C });

  /* /api/<ruta> (nombre de la Edge Function = api); tambien acepta /functions/v1/api/<ruta> */
  const ruta = url.pathname.replace(/^\/(functions\/v1\/)?api\/?/, '').replace(/^\/+/, '');
  if (ruta === '' || ruta === 'salud') {
    return new Response(JSON.stringify({ success: true, servicio: 'rl-api-supabase', rutas: TABLA.length, hora: new Date().toISOString() }),
      { status: 200, headers: Object.assign({ 'Content-Type': 'application/json' }, C) });
  }
  let r = null, m = null;
  for (const t of TABLA) { m = ruta.match(t.re); if (m && t.metodos.indexOf(request.method) >= 0) { r = t; break; } }
  if (!r) return new Response(JSON.stringify({ success: false, error: 'Ruta no disponible en Supabase: ' + ruta }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json', 'X-RL-Edge': 'sin-ruta' }, C) });

  /* _FASE3_V1: rutas con llave (authLevel "function" en Azure): la misma llave de Azure en ?code= o x-functions-key.
     Las llaves validas vienen del secreto RL_FN_KEYS (separadas por coma). Sin llave valida → 401, igual que Azure. */
  if (r.llave) {
    const dada = url.searchParams.get('code') || request.headers.get('x-functions-key') || '';
    const validas = String((typeof process !== 'undefined' && process.env.RL_FN_KEYS) || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!dada || validas.indexOf(dada) < 0) return new Response(JSON.stringify({ success: false, error: 'Llave de funcion invalida o ausente' }), { status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, C) });
  }
  const params = {}; r.nombres.forEach(function (n, i) { params[n] = m[i + 1] !== undefined ? decodeURIComponent(m[i + 1]) : undefined; });
  const query = {}; url.searchParams.forEach(function (v, k) { if (k !== 'forceFunctionRegion') query[k] = v; });   /* _EDGE_REGION_V1: parametro de Supabase, no de la funcion */
  const headers = {}; request.headers.forEach(function (v, k) { headers[k.toLowerCase()] = v; });

  let rawBody = '', body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    rawBody = await request.text();
    if (rawBody) { try { body = JSON.parse(rawBody); } catch (e) { body = rawBody; } }
  }
  const req = { method: request.method, url: request.url, originalUrl: request.url, headers: headers, query: query, params: params, body: body, rawBody: rawBody };
  const context = { log: registro('[' + r.fn + ']'), bindingData: Object.assign({}, query, params), res: null, invocationId: crypto.randomUUID(), executionContext: { functionName: r.fn } };

  try {
    if (r.reloj) {   /* funcion de reloj: se ejecuta como en Azure (context, timer) y se responde con su resultado */
      const t0 = Date.now(); await r.h(context, { isPastDue: false, schedule: {} });
      return new Response(JSON.stringify({ success: true, reloj: r.fn, ms: Date.now() - t0 }), { status: 200, headers: Object.assign({ 'Content-Type': 'application/json' }, C) });
    }
    const ret = await r.h(context, req);
    const res = context.res || ret || { status: 204 };
    const h = Object.assign({}, res.headers || {}, C);
    let cuerpo = res.body;
    const tieneTipo = Object.keys(h).some(function (k) { return k.toLowerCase() === 'content-type'; });
    if (cuerpo === undefined || cuerpo === null) cuerpo = null;
    else if (typeof cuerpo === 'string') { if (!tieneTipo) h['Content-Type'] = 'text/plain; charset=utf-8'; }
    else if (cuerpo instanceof Uint8Array || cuerpo instanceof ArrayBuffer) { /* binario tal cual */ }
    else { cuerpo = JSON.stringify(cuerpo); if (!tieneTipo) h['Content-Type'] = 'application/json; charset=utf-8'; }
    return new Response(cuerpo, { status: res.status || 200, headers: h });
  } catch (err) {
    console.error('[' + r.fn + '] excepcion: ' + (err && err.stack || err));
    return new Response(JSON.stringify({ success: false, error: 'Error interno: ' + (err && err.message) }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, C) });
  }
}

module.exports = { manejar: manejar, rutas: TABLA.length };
