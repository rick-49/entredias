const CACHE = 'entre-dias-pwa-v2';
const SHELL = ['/', '/app', '/dashboard', '/dados', '/styles.css', '/mobile.css', '/landing.css', '/dashboard.css', '/app.js', '/dashboard.js', '/dados.js', '/install.js', '/local-data.js', '/shared.js', '/analytics.js', '/csv.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // Uma versão nova só assume após fechar as janelas antigas: evita interromper uma avaliação.
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
