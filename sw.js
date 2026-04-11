const CACHE_NAME = 'sistema-rl-v1';
const APPS_SCRIPT_ORIGIN = 'https://script.google.com';

// Archivos estáticos a pre-cachear al instalar
const STATIC_ASSETS = [
  '/sistema-rl-verfrut/',
  '/sistema-rl-verfrut/index.html',
  '/sistema-rl-verfrut/frontend/pages/dashboard.html',
  '/sistema-rl-verfrut/frontend/pages/estadisticas.html',
  '/sistema-rl-verfrut/frontend/pages/evaluacion360.html',
  '/sistema-rl-verfrut/frontend/pages/resumen.html',
  '/sistema-rl-verfrut/frontend/images/logo-unifrutti.jpg',
  '/sistema-rl-verfrut/manifest.json'
];

// ── Instalar: pre-cachear estáticos ──
self.addEventListener('install', event => {
  console.log('[SW] Instalando — cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activar: limpiar caches anteriores ──
self.addEventListener('activate', event => {
  console.log('[SW] Activando — limpiando caches antiguas');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Eliminando cache antigua:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first para llamadas a la API de Apps Script
  if (url.origin === APPS_SCRIPT_ORIGIN) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Network-first para Firebase Realtime Database
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first para archivos estáticos (HTML, imágenes, fuentes, JS de CDN)
  if (event.request.method === 'GET') {
    event.respondWith(cacheFirst(event.request));
  }
});

// Estrategia: cache-first (sirve desde cache, actualiza en background)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch(e) {
    // Sin red y sin cache: respuesta offline básica para HTML
    if (request.headers.get('Accept')?.includes('text/html')) {
      return new Response('<h2 style="font-family:sans-serif;padding:24px;color:#0a2463">Sin conexión — Sistema RL</h2><p style="font-family:sans-serif;padding:0 24px;color:#64748b">Conecta a internet para usar el sistema.</p>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    throw e;
  }
}

// Estrategia: network-first (intenta red, usa cache como respaldo)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch(e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}
