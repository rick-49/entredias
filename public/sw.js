const CACHE = 'entre-dias-pwa-v7';
const SHELL = ['/', '/app', '/dashboard', '/dados', '/saude', '/relatorio', '/comunidade', '/styles.css', '/mobile.css', '/landing.css', '/dashboard.css', '/share.css', '/features.css', '/app.js', '/dashboard.js', '/dados.js', '/saude.js', '/relatorio.js', '/comunidade.js', '/reference-dialog.js', '/push-client.js', '/contribute.js', '/install.js', '/share.js', '/share-data.js', '/local-data.js', '/shared.js', '/health-model.js', '/medication-catalog.js', '/contribution-model.js', '/pdf-report.js', '/vendor/jspdf.umd.min.js', '/analytics.js', '/csv.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
  // Assume após baixar todos os arquivos; a página decide quando pode recarregar.
});
self.addEventListener('push', event => {
  let data = {}; try { data = event.data?.json() || {}; } catch { /* Usa texto genérico. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Entre dias', { body: data.body || 'Reserve um momento para registrar como você se sente.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'entre-dias-referencia', data: { url: data.url || '/app?referencia=hoje' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/app?referencia=hoje', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).pathname.startsWith('/app'));
    if (existing) { await existing.navigate(target.href); return existing.focus(); }
    return self.clients.openWindow(target.href);
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('entre-dias-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Usa o shell da mesma versão. Dados pessoais ficam no IndexedDB, nunca no cache HTTP.
    const cached = await cache.match(url.pathname);
    return cached || fetch(event.request);
  }));
});
