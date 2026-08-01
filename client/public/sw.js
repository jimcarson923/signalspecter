// SignalSpecter Service Worker — v3 (network-first)
const CACHE_NAME = 'signalspecter-v3';

// Install — skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network FIRST for everything (no stale cache)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always hit network for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Network-first for app shell — always get fresh bundle
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'SignalSpecter Alert', {
      body: data.body ?? 'New signal detected',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: 'specter-alert',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
