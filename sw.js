/* Postula — service worker
   Guarda la app para que abra sin internet y recibe capturas compartidas
   desde la galería ("Compartir → Postula"). */

const VERSION = 'v1';
const SHELL_CACHE = 'postula-shell-' + VERSION;
const RUNTIME_CACHE = 'postula-runtime-v1';
const SHARED_CACHE = 'postula-shared';

const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];

const SHARED_URL = () => new URL('/__shared', self.location.origin).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.indexOf('postula-shell-') === 0 && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Captura compartida desde otra app.
  if (request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET') return;

  // Misma app: sirve del caché y actualiza en segundo plano.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Lector OCR (Tesseract) y sus datos: caché primero.
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'unpkg.com' ||
      url.hostname.indexOf('tessdata') !== -1) {
    event.respondWith(cacheFirst(request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;

  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Sin conexión</title>' +
    '<p style="font-family:system-ui;padding:24px;text-align:center">' +
    'Esta app necesita abrirse al menos una vez con internet.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    const file = form.get('image');

    if (file && typeof file === 'object' && file.size > 0) {
      const cache = await caches.open(SHARED_CACHE);
      await cache.put(
        SHARED_URL(),
        new Response(file, {
          headers: { 'content-type': file.type || 'image/png' }
        })
      );
    }
  } catch (err) { /* si falla, se abre la app normal */ }

  const target = new URL('./?shared=1', self.registration.scope).href;
  return Response.redirect(target, 303);
}
