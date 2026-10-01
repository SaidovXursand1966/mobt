/* ============================================================
   MOBT — Service Worker
   Maktab inspektor-psixologi uchun oflayn ishlash dasturi. X.saidov. Urgut. 
============================================================ */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'mobt-cache-' + CACHE_VERSION;
const RUNTIME_CACHE = 'mobt-runtime-' + CACHE_VERSION;

// Keshlanadigan statik fayllar (oflayn ishlash uchun)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './xlsx.full.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png'
];

/* === O'RNATISH === */
self.addEventListener('install', event => {
  console.log('[SW] O\'rnatilmoqda...', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Statik fayllar keshlanmoqda');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Kesh xatosi:', err))
  );
});

/* === AKTIVLASHTIRISH === */
self.addEventListener('activate', event => {
  console.log('[SW] Aktivlashtirilmoqda...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => {
            console.log('[SW] Eski kesh o\'chirilmoqda:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* === SO'ROVLARNI USHLASH === */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Faqat GET so'rovlar
  if (request.method !== 'GET') return;

  // Faqat http/https
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Keshda bor — darhol qaytaramiz, fonda yangilaymiz
        event.waitUntil(
          fetch(request)
            .then(response => {
              if (response && response.status === 200 && response.type === 'basic') {
                const clone = response.clone();
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, clone);
                });
              }
            })
            .catch(() => { /* oflayn — muhim emas */ })
        );
        return cachedResponse;
      }

      // Keshda yo'q — internetdan olamiz
      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          // Oflayn va keshda yo'q — bosh sahifani qaytaramiz
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Oflayn rejim', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
    })
  );
});

/* === XABARLAR === */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
