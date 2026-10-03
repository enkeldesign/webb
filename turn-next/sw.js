/* TURN NEXT is retired (#1045). A device that installed it gets this worker on its
   next visit: it removes TURN NEXT's stored copy, unregisters itself and sends any
   open TURN NEXT page to TURN. */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('turn-next-')) await caches.delete(key);
    }
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      client.navigate('/turn/').catch(() => {});
    }
  })());
});
