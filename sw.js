const CACHE_VERSION = 'v3.2.0-icons-unifrutti';
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
];

// ── Instalar: pre-cachear mínimo offline ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        ARCHIVOS_BASE.map(url =>
          cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e.message))
        )
      ))
      .then(() => self.skipWaiting())
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

// ── Fetch: network-first para HTML/JS/CSS, cache-first para imágenes/fuentes ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar peticiones a otros orígenes (API, Firebase, CDN fonts)
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  const esHTMLoJS =
    event.request.destination === 'document' ||
    event.request.destination === 'script'   ||
    event.request.destination === 'style'    ||
    url.pathname.endsWith('.html')            ||
    url.pathname.endsWith('.js')             ||
    url.pathname.endsWith('.css');

  if (esHTMLoJS) {
    // Network-first: siempre intenta la red para obtener la versión más reciente
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copia));
          }
          return resp;
        })
        .catch(() =>
          caches.match(event.request)
            .then((c) => c || caches.match(BASE + '/index.html'))
        )
    );
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

// ── Mensaje desde el cliente para forzar activación inmediata ──
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
