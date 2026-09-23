const CACHE_NAME = 'trilhos-app-shell-v1';
const APP_SHELL = [
  '/',
  '/patio/acesso',
  '/admin/login',
  '/manifest.json',
];

// Install event: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Exact public shell URLs — safe to cache at runtime because they carry no
// session-specific content (same set precached at INSTALL time above).
const RUNTIME_CACHEABLE_EXACT = ['/', '/patio/acesso', '/admin/login', '/manifest.json'];

// Only static, non-authenticated assets may be cached at runtime. In
// particular, this must NEVER match authenticated page HTML/RSC payloads
// such as /admin/* (besides /admin/login) or /patio/* (besides
// /patio/acesso) — those can contain another user's data and must never be
// replayed from cache on a shared kiosk tablet with no logout flow.
function isRuntimeCacheable(pathname) {
  if (RUNTIME_CACHEABLE_EXACT.includes(pathname)) return true;
  if (pathname.startsWith('/_next/static/')) return true;
  if (pathname.startsWith('/icons/')) return true;
  return false;
}

// Fetch event: network-first strategy for GET on allow-listed paths, cached
// with a fallback to the cache on network failure. Everything else is left
// entirely to the browser (we simply don't call respondWith) — no caching,
// no fallback — so a network failure on an authenticated route surfaces as
// a normal failed navigation instead of silently replaying stale,
// potentially authenticated content.
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Only ever consider caching same-origin, allow-listed requests. Anything
  // else falls through to the browser's default network handling untouched.
  if (url.origin !== self.location.origin || !isRuntimeCacheable(url.pathname)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fall back to cache if network fails
        return caches.match(event.request);
      })
  );
});
