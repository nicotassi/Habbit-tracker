// Ritmo: cache de la app para abrir rápido y sin conexión. Los datos viajan a Supabase y nunca se cachean.
// La página principal se pide siempre fresca (sin la cache del navegador) para que las versiones nuevas lleguen enseguida.
const CACHE = 'ritmo-v5';
const CORE = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith(
    fetch(isPage ? new Request(req, { cache: 'no-store' }) : req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(isPage ? './' : req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(isPage ? './' : req).then((r) => r || caches.match('./')))
  );
});

// Avisos push (los manda el servidor aunque la app esté cerrada)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ritmo', {
    body: d.body || '', tag: d.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '';
  const target = new URL('./' + hash, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ type: 'nav', hash });
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
