// v2: o handler de fetch passou a recusar HTML/RSC autenticado, mas qualquer
// tablet que rodou a versão anterior ainda tem esse conteúdo gravado em disco no
// cache 'trilhos-app-shell-v1'. Trocar o nome faz o handler de `activate` abaixo
// apagar o cache antigo inteiro na próxima ativação — é o que completa a correção.
const CACHE_NAME = 'trilhos-app-shell-v3';
// Telas do Pátio (HTML) guardadas para uso sem internet. NUNCA inclui /admin.
const PATIO_CACHE = 'trilhos-patio-v1';
const APP_SHELL = [
  '/',
  '/patio/acesso',
  '/admin/login',
  '/manifest.json',
  '/offline.html',
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
          if (cacheName !== CACHE_NAME && cacheName !== PATIO_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Exact public shell URLs — safe to cache at runtime because they carry no
// session-specific content (same set precached at INSTALL time above).
const RUNTIME_CACHEABLE_EXACT = ['/', '/patio/acesso', '/admin/login', '/manifest.json', '/offline.html'];

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

// ── Pátio sem internet ───────────────────────────────────────────────────────
// O Pátio precisa abrir e funcionar sem sinal (os lançamentos ficam no aparelho e são
// enviados depois). Por isso as TELAS do Pátio (/patio e /patio/*, nunca /admin) ficam
// guardadas: rede primeiro; se a rede falhar, usa a cópia guardada.
// Respostas redirecionadas (sessão expirada → /patio/acesso) nunca são guardadas.
function ehNavegacaoPatio(request, url) {
  return (
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    (url.pathname === '/patio' || url.pathname.startsWith('/patio/')) &&
    url.pathname !== '/patio/acesso'
  );
}

function comLimite(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!ehNavegacaoPatio(event.request, url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(PATIO_CACHE);
      const guardada = await cache.match(url.pathname);
      try {
        // Com cópia guardada, não deixa o operador esperando uma rede "pendurada".
        const resposta = guardada ? await comLimite(fetch(event.request), 6000) : await fetch(event.request);
        if (resposta && resposta.status === 200 && resposta.type === 'basic' && !resposta.redirected) {
          cache.put(url.pathname, resposta.clone());
        }
        return resposta;
      } catch {
        return (
          guardada ||
          (await cache.match('/patio')) ||
          (await caches.match('/offline.html')) ||
          Response.error()
        );
      }
    })(),
  );
});

// Aquecimento: a página manda a lista de telas do Pátio; o service worker baixa o HTML (já
// com o cookie de acesso) e também os arquivos JS/CSS que cada tela usa, para abrir offline.
const PADRAO_ATIVOS = /(?:\/_next\/)?static\/(?:chunks|css)\/[A-Za-z0-9_\-./%~()@[\]]+?\.(?:js|css)/g;

async function aquecerPatio(urls) {
  const telas = await caches.open(PATIO_CACHE);
  const estaticos = await caches.open(CACHE_NAME);
  for (const bruta of urls) {
    try {
      const url = new URL(bruta, self.location.origin);
      if (url.origin !== self.location.origin || !(url.pathname === '/patio' || url.pathname.startsWith('/patio/'))) continue;
      const resposta = await fetch(url.pathname, { credentials: 'same-origin', redirect: 'manual', headers: { Accept: 'text/html' } });
      if (resposta.status !== 200 || resposta.type !== 'basic') continue;
      const html = await resposta.clone().text();
      await telas.put(url.pathname, resposta);
      const ativos = new Set();
      for (const achado of html.match(PADRAO_ATIVOS) || []) {
        const caminho = achado.startsWith('/_next/') ? achado : '/_next/' + achado.replace(/^\//, '');
        ativos.add(caminho);
        ativos.add(caminho.replace(/\[/g, '%5B').replace(/\]/g, '%5D'));
      }
      for (const ativo of ativos) {
        try {
          if (await estaticos.match(ativo)) continue;
          const r = await fetch(ativo);
          if (r.ok) await estaticos.put(ativo, r);
        } catch {
          // Um arquivo que não baixou não impede o resto.
        }
      }
    } catch {
      // Sem rede agora: tenta de novo na próxima abertura.
    }
  }
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.tipo !== 'aquecer-patio' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(aquecerPatio(event.data.urls));
});

// ── Avisos (push) ────────────────────────────────────────────────────────────
// A Portaria libera a carreta → o servidor manda um aviso para o tablet do Pátio.
self.addEventListener('push', (event) => {
  let aviso = { titulo: 'Controle de Trilhos', corpo: '', url: '/patio/remetidos' };
  try {
    if (event.data) aviso = { ...aviso, ...event.data.json() };
  } catch {
    // aviso sem corpo legível: mostra o padrão
  }
  event.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'carreta-liberada',
      renotify: true,
      requireInteraction: true,
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/patio/remetidos', self.location.origin);
  // Só abre telas do próprio sistema (nunca um endereço vindo de fora).
  const url = destino.origin === self.location.origin ? destino.href : self.location.origin + '/patio/remetidos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.startsWith(self.location.origin) && 'focus' in janela) {
          return janela.focus().then((j) => ('navigate' in j ? j.navigate(url) : j));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
