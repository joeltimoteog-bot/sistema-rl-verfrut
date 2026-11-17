const CACHE_VERSION = 'v4.0.0-ver';   /* _SW_VERSION_V1 + _SW_CAMBIOS_V1 (17-nov-2026) · NO cambiar el nombre: se perderian las copias */
const CACHE_NAME    = 'sistema-rl-' + CACHE_VERSION;
const BASE          = '/sistema-rl-verfrut';
// Solo lo mínimo para soporte offline básico — el resto se pide por red
const ARCHIVOS_BASE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/favicon.ico',
  BASE + '/frontend/images/icon-192.png',
  BASE + '/frontend/images/icon-512.png',
  BASE + '/frontend/images/apple-touch-icon.png',
  BASE + '/frontend/images/favicon-32.png',
  BASE + '/frontend/images/favicon-16.png',
  BASE + '/frontend/pages/horas.html',
  BASE + '/frontend/js/horas.js',
];
/* ═══════════════════════════════════════════════════════════════════════════
   _SW_VERSION_V1 (17-nov-2026) — cambiar de modulo sin esperar a la red
   PROBLEMA: en CADA cambio de modulo el SW volvia a preguntar al servidor por los ~117 scripts de la pagina
   (network-first) y recien despues la mostraba: el Dashboard tardaba 6 a 16 s en quedar listo aunque todos
   los archivos ya estaban guardados.
   SOLUCION: la publicacion genera version.json (commit) en cada git push. Al abrir una pagina se lee
   version.json (1 peticion chica, ~0,4 s, una vez por minuto):
     · misma version que la guardada  -> pagina, scripts y estilos salen AL INSTANTE de la copia guardada.
     · version nueva (hubo publicacion) -> se borran las copias de html/js/css y todo se pide a la red (como antes).
     · sin version.json / sin red      -> se hace exactamente lo de antes (network-first con copia de respaldo).
   SEGURO: ninguna copia de html/js/css se usa si tiene mas de 12 h; pasado eso se vuelve a pedir a la red.
   _SW_CAMBIOS_V1 (17-nov-2026): version.json trae ademas "cambios" (los archivos de los ultimos 30 commits). Si la
   version guardada esta en esa lista, al publicar se borran SOLO los archivos que cambiaron desde entonces
   (normalmente 1 a 4) y el resto sigue saliendo al instante. Si no esta (o no hay lista), se borra todo como antes.
   ═══════════════════════════════════════════════════════════════════════════ */
const VER_URL   = BASE + '/version.json';
const VER_KEY   = BASE + '/__sw_version__';
const MAX_EDAD  = 12 * 3600 * 1000;     // una copia de html/js/css no se usa si tiene mas de 12 h
const VER_VIGOR = 60 * 1000;            // un chequeo de version vale 1 minuto
let verMem = null;                      // { v: 'commit', t: ms del ultimo chequeo OK }
let chequeo = null;                     // chequeo en curso (todas las peticiones lo comparten)
let falloT = 0;                         // ultimo chequeo fallido (no se reintenta en 1 minuto)

function esCodigo(pathname) { return /\.(html|js|css)$/.test(pathname) || pathname.endsWith('/'); }
function sinQuery(u) { const x = new URL(u); x.search = ''; return x.href; }

async function verGuardada() {
  if (verMem) return verMem.v;
  try {
    const c = await caches.open(CACHE_NAME);
    const r = await c.match(VER_KEY);
    if (!r) return null;
    verMem = { v: await r.text(), t: 0 };
    return verMem.v;
  } catch (e) { return null; }
}

/* devuelve 'igual' | 'nueva' | 'primera' | 'desconocida' */
function revisarVersion() {
  if (verMem && verMem.t && (Date.now() - verMem.t) < VER_VIGOR) return Promise.resolve('igual');
  if (falloT && (Date.now() - falloT) < VER_VIGOR) return Promise.resolve('desconocida');
  if (chequeo) return chequeo;
  chequeo = (async () => {
    try {
      const ctl = new AbortController();
      const reloj = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(VER_URL + '?sw=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
      clearTimeout(reloj);
      if (!r.ok) { falloT = Date.now(); return 'desconocida'; }
      const j = await r.json();
      const v = String((j && j.version) || '').trim();
      if (!v) { falloT = Date.now(); return 'desconocida'; }
      falloT = 0;
      const ant = await verGuardada();
      if (ant === v) { verMem = { v, t: Date.now() }; return 'igual'; }
      const c = await caches.open(CACHE_NAME);
      if (ant) {   // hubo publicacion: fuera las copias que cambiaron (o todas las de html/js/css si no se sabe cuales)
        const quitar = archivosCambiados(j, ant);   // Set de rutas, o null = no se sabe -> todo
        const keys = await c.keys();
        await Promise.all(keys.filter((k) => { try { const p = new URL(k.url).pathname; return esCodigo(p) && (!quitar || quitar.has(p)); } catch (e) { return false; } })
                              .map((k) => c.delete(k)));
      }
      await c.put(VER_KEY, new Response(v));
      verMem = { v, t: Date.now() };   // las copias viejas ya se borraron: lo que falte se pide a la red y se guarda
      return ant ? 'nueva' : 'primera';
    } catch (e) {
      falloT = Date.now();
      return 'desconocida';
    } finally {
      chequeo = null;
    }
  })();
  return chequeo;
}

/* _SW_CAMBIOS_V1: rutas que cambiaron entre la version guardada (ant) y la publicada; null si no se puede saber */
function archivosCambiados(j, ant) {
  try {
    const L = j && j.cambios;
    if (!Array.isArray(L) || !L.length) return null;
    const i = L.findIndex((x) => x && x.v === ant);
    if (i <= 0) return null;                       // la guardada no esta en la lista (muy antigua): se borra todo
    const s = new Set();
    for (let k = 0; k < i; k++) {
      const a = L[k] && L[k].a;
      if (!Array.isArray(a)) return null;
      a.forEach((p) => { s.add(String(p)); if (/\/index\.html$/.test(p)) s.add(String(p).replace(/index\.html$/, '')); });
    }
    return s;
  } catch (e) { return null; }
}

function guardarCopia(clave, resp) {
  try {
    const h = new Headers(resp.headers);
    h.set('x-sw-guardado', String(Date.now()));
    return resp.blob().then((b) => caches.open(CACHE_NAME)
      .then((c) => c.put(clave, new Response(b, { status: resp.status, statusText: resp.statusText, headers: h }))))
      .catch(() => {});
  } catch (e) { return Promise.resolve(); }
}
function copiaFresca(r) {
  if (!r) return false;
  const t = Number(r.headers.get('x-sw-guardado') || 0);
  return t > 0 && (Date.now() - t) < MAX_EDAD;
}

// ── Instalar: pre-cachear mínimo offline ──
self.addEventListener('install', (event) => {
  // Activacion automatica: el SW nuevo toma control sin esperar al toast,
  // asi los cambios desplegados llegan al recargar sin limpiar cache a mano.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        ARCHIVOS_BASE.map(url =>
          cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e.message))
        )
      ))
  );
});
// ── Activar: eliminar caches de versiones anteriores ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((n) => n.startsWith('sistema-rl-') && n !== CACHE_NAME)
          .map((n) => {
            console.log('[SW] Eliminando cache antigua:', n);
            return caches.delete(n);
          })
      ))
      .then(() => self.clients.claim())
  );
});
// ── Fetch ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Ignorar peticiones a otros orígenes (API, Firebase, CDN fonts)
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;
  if (url.pathname === VER_URL) return;   // version.json siempre directo a la red
  const dest = event.request.destination;
  const esDocumento = event.request.mode === 'navigate' || dest === 'document' || dest === 'iframe' ||
                      url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  const esHTMLoJS = esDocumento || dest === 'script' || dest === 'style' ||
                    url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (esHTMLoJS) {
    // las paginas se guardan sin el ?v=... (el HTML es el mismo); scripts y estilos con su ?v= exacto
    const clave = esDocumento ? sinQuery(event.request.url) : event.request;
    event.respondWith((async () => {
      /* _SW_VERSION_V1: misma version publicada y copia de menos de 12 h -> al instante */
      try {
        const estado = await revisarVersion();
        if (estado === 'igual' || estado === 'nueva') {   /* 'nueva': las copias cambiadas ya se borraron; las que quedan valen */
          const c = await caches.open(CACHE_NAME);
          const r = await c.match(clave);
          if (copiaFresca(r)) return r;
        }
      } catch (e) {}
      return redPrimero(event, clave, esDocumento);
    })());
    return;
  }
  // Cache-first para imágenes, fuentes e iconos (cambian raramente)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        if (resp && resp.status === 200) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copia));
        }
        return resp;
      });
    })
  );
});

/* Lo de siempre (sin cambios de fondo): network-first REAL con copia de respaldo.
   cache:'no-cache' obliga a revalidar contra el servidor (GitHub Pages sirve max-age=600).
   _SW_RED_LENTA_V1: si la red no contesta en 4 s (scripts/estilos) o 12 s (paginas, _SW_DOC_12S_V1) y hay copia,
   se muestra la copia y la red sigue en segundo plano actualizandola. Sin copia se espera a la red.
   _CAIDAS_V1: index.html solo como respaldo de una PAGINA (nunca en lugar de un .js/.css). */
function redPrimero(event, clave, esDocumento) {
  const red = fetch(event.request, { cache: 'no-cache' })
    .then((resp) => {
      if (resp && resp.status === 200 && resp.type === 'basic') event.waitUntil(guardarCopia(clave, resp.clone()));
      return resp;
    });
  event.waitUntil(red.catch(() => {}));
  const copiaGuardada = caches.open(CACHE_NAME).then((c) => c.match(clave))
    .then((r) => r || caches.match(event.request));
  return new Promise((resolver) => {
    let listo = false;
    const dar = (r) => { if (!listo && r) { listo = true; resolver(r); } };
    const reloj = setTimeout(() => { copiaGuardada.then((c) => { if (c) dar(c); }); }, esDocumento ? 12000 : 4000);
    red.then((r) => { clearTimeout(reloj); dar(r); })
       .catch(() => {
         clearTimeout(reloj);
         copiaGuardada.then((c) => c || (esDocumento ? caches.match(BASE + '/index.html') : null))
           .then((c) => dar(c || Response.error()));
       });
  });
}
// ── Mensaje desde el cliente para forzar activación inmediata ──
// Acepta tanto el formato nuevo {type:'SKIP_WAITING'} (toast de actualización)
// como el legacy event.data === 'skipWaiting' por compatibilidad.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' ||
      (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});
