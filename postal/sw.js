const CACHE = 'postal-visual-overhaul-2026-08-16-v1';
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('postal') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
