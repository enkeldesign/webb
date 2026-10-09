/* TURN stores complete releases. Navigations and build-tagged modules use the
   same release; a failed update never publishes a partial store. Keep the previous
   complete release for bounded startup recovery, plus releases used by open pages. */

const RELEASE = '20261009-r413';
const SCOPE = new URL(self.registration.scope).pathname;
const NAME = SCOPE.replace(/\//g, '') || 'turn';
const PRECACHE = `${NAME}-precache-${RELEASE}`;
const RUNTIME = `${NAME}-runtime-${RELEASE}`;
const EXTERNAL = 'turn-external-v1';
const STATUS_KEY = `${SCOPE}__offline-status`;
const NAVIGATION_TIMEOUT_MS = 4000;
const RESOURCE_TIMEOUT_MS = 8000;
const BATCH = 8;
const RELEASE_QUERY_MS = 1000;
const PINNED_EXTERNAL = [
  /^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[0-9a-f]{40}\//,
  /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\//
];
const TIMED_OUT = Symbol('timed out');
const FAILED = Symbol('failed');

async function prepareRelease() {
    const cache = await caches.open(PRECACHE);
    const list = await (await fetch(`${SCOPE}offline-precache.json?build=${RELEASE}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })).json();
    if (list.release !== RELEASE || !Array.isArray(list.files) || !list.files.length) {
      throw new Error('TURN offline: deployment changed during installation');
    }
    const total = list.files.length;
    // Only the first install: an update downloads quietly, the release in charge still plays offline.
    let storageFailed = false;
    let failed = 0;
    for (let index = 0; index < total; index += BATCH) {
      await Promise.all(list.files.slice(index, index + BATCH).map(async (file) => {
        if (await cache.match(file)) return;
        try {
          const response = await fetch(file, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
          if (response.ok) await cache.put(file, response);
          else failed += 1;
        } catch (error) {
          storageFailed ||= error.name === 'QuotaExceededError' || error.name === 'SecurityError';
          failed += 1;
        }
      }));
      await report({ stored: Math.min(index + BATCH, total) - failed, total });
    }
    // Incomplete: keep the previous release and its caches; the next visit resumes.
    if (failed) {
      await report({ stored: total - failed, total, failed, reason: storageFailed ? 'storage' : 'preparation' });
      throw new Error(`TURN offline: ${failed} of ${total} files failed to store`);
    }
    // Paths are mutable on the server. Check both ends of the download so a deploy
    // in flight cannot mark a mixture complete; incomplete files can resume safely.
    const finalList = await (await fetch(`${SCOPE}offline-precache.json`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })).json();
    const entry = await cache.match(`${SCOPE}index.html`);
    if (finalList.release !== RELEASE || !entry || !(await entry.text()).includes(`cacheKey: '${RELEASE}'`)) {
      throw new Error('TURN offline: release changed before completion');
    }
    const status = { release: RELEASE, files: total, failed, coherent: true };
    await cache.put(STATUS_KEY, new Response(JSON.stringify(status), { headers: { 'content-type': 'application/json' } }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(prepareRelease().then(() => self.skipWaiting()));
});

async function report(progress) {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    client.postMessage({ type: 'turn-offline-progress', release: RELEASE, ...progress });
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await dropUnusedReleases();
  })());
});

// The release a cache or a request belongs to: "20261003-r376" (a key may carry a
// suffix, "20261003-r376-social-browser").
const releaseOf = (value) => value?.match(/\d{8}-r\d+/)?.[0] || null;
const revision = (release) => Number(release.split('-r')[1]);

// Which release each open page runs. A page that cannot say (one in the background
// that the browser has frozen, or one from before pages could answer) may run any
// earlier release: then every release stays until all open pages can say.
async function releasesInUse() {
  const windows = await self.clients.matchAll({ type: 'window' });
  return Promise.all(windows.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(releaseOf(event.data?.release));
    client.postMessage({ type: 'turn-release-query' }, [channel.port2]);
    setTimeout(resolve, RELEASE_QUERY_MS, null);
  })));
}

async function dropUnusedReleases() {
  const answers = await releasesInUse();
  if (answers.includes(null)) return;
  const keys = (await caches.keys()).filter((key) =>
    key.startsWith(`${NAME}-precache-`) || key.startsWith(`${NAME}-runtime-`));
  const keep = new Set([RELEASE, ...answers]);
  const previous = keys.filter((key) => key.startsWith(`${NAME}-precache-`) && revision(releaseOf(key)) < revision(RELEASE))
    .sort((a, b) => revision(releaseOf(b)) - revision(releaseOf(a)));
  for (const key of previous) {
    if (await (await caches.open(key)).match(STATUS_KEY)) { keep.add(releaseOf(key)); break; }
  }
  for (const key of keys) {
    const release = releaseOf(key);
    // A newer release may be storing its files right now.
    if (!keep.has(release) && revision(release) < revision(RELEASE)) await caches.delete(key);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'turn-repair-release' && event.ports?.[0]) {
    event.waitUntil(prepareRelease().then(
      () => event.ports[0].postMessage({ repaired: true }),
      () => event.ports[0].postMessage({ repaired: false })
    ));
    return;
  }
  if (event.data?.type === 'turn-activate-complete') {
    event.waitUntil((async () => {
      if (await (await caches.open(PRECACHE)).match(STATUS_KEY)) await self.skipWaiting();
    })());
    return;
  }
  // A page has started (or restarted): earlier releases may have no page left.
  if (event.data?.type === 'turn-page-release') {
    event.waitUntil(dropUnusedReleases());
    return;
  }
  // The page asks how ready offline play is: { release, files, failed } or null.
  if (event.data?.type !== 'turn-offline-status' || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    const response = await (await caches.open(PRECACHE)).match(STATUS_KEY);
    event.ports[0].postMessage(response ? await response.json() : { release: RELEASE, files: 0, failed: 1, coherent: true });
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    // TURN's release includes the YOUR TURN modules its game imports (sharing).
    if (!url.pathname.startsWith(SCOPE) && !url.pathname.startsWith('/turn/') && !url.pathname.startsWith('/yourturn/')) return;
    if (request.mode === 'navigate') {
      if (url.pathname === SCOPE || url.pathname === `${SCOPE}index.html`) event.respondWith(navigate(request));
      else if (url.pathname.startsWith(SCOPE)) event.respondWith(otherPage(request));
      return;
    }
    event.respondWith(sameOrigin(request, url));
    return;
  }
  if (PINNED_EXTERNAL.some((pattern) => pattern.test(request.url))) event.respondWith(pinned(request));
});

function race(promise, ms) {
  return Promise.race([
    promise.catch(() => FAILED),
    new Promise((resolve) => setTimeout(resolve, ms, TIMED_OUT))
  ]);
}

function keep(cacheName, key, response) {
  if (!response.ok || response.status !== 200 || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(cacheName).then((cache) => cache.put(key, copy)).catch(() => {});
}

async function fromCaches(request, url) {
  const exact = await (await caches.open(RUNTIME)).match(request);
  if (exact) return exact;
  const precached = await (await caches.open(PRECACHE)).match(url.pathname);
  if (precached) return precached;
  // A file this release never listed: the newest kept copy for the path, any build.
  return caches.match(request, { ignoreSearch: true });
}

// A file of a stored release is that build: answer from the store at once. For this
// release, waiting on a slow network first made startup take minutes on a poor
// connection, one file after another. For a page still running an earlier release,
// the network (or this release's store) would hand it this release's file instead.
async function storedRelease(url) {
  const release = releaseOf(url.searchParams.get('build'));
  if (!release) return null;
  const name = `${NAME}-precache-${release}`;
  if (release !== RELEASE && !(await caches.has(name))) return null;
  const cache = await caches.open(name);
  if (!(await cache.match(STATUS_KEY))) return null;
  return cache.match(url.pathname);
}

async function sameOrigin(request, url) {
  const stored = await storedRelease(url);
  if (stored) return stored;
  const requested = releaseOf(url.searchParams.get('build'));
  // An unavailable earlier build must fail explicitly: an old open page must never
  // receive current game bytes. Current-release resources that are intentionally not
  // in the game precache (for example /turn/stats/) still use network/runtime caching.
  if (requested && requested !== RELEASE) return new Response('TURN release unavailable', { status: 503 });
  const network = fetch(request);
  const first = await race(network, RESOURCE_TIMEOUT_MS);
  const answered = first !== FAILED && first !== TIMED_OUT;
  if (answered && first.ok) {
    keep(RUNTIME, request, first);
    return first;
  }
  // No answer, or an error (a deploy in progress, an outage): the kept copy if there is one.
  const cached = requested
    ? await (await caches.open(RUNTIME)).match(request)
    : await fromCaches(request, url);
  if (cached) {
    if (!answered) network.then((late) => keep(RUNTIME, request, late)).catch(() => {});
    return cached;
  }
  if (answered) return first;
  return first === TIMED_OUT ? network : Response.error();
}

async function navigate(request) {
  const requested = releaseOf(new URL(request.url).searchParams.get('turn-release'));
  const keys = await caches.keys();
  const candidates = [...new Set([requested, RELEASE, ...keys
    .filter((key) => key.startsWith(`${NAME}-precache-`))
    .map(releaseOf).sort((a, b) => revision(b) - revision(a))])].filter(Boolean);
  for (const release of candidates) {
    const name = `${NAME}-precache-${release}`;
    if (!keys.includes(name)) continue;
    const cache = await caches.open(name);
    const marker = await cache.match(STATUS_KEY);
    const entry = await cache.match(`${SCOPE}index.html`);
    if (marker && entry) return entry;
  }
  // No complete offline entry survived: try the network, but never promote its
  // document into another release's cache. The inline startup coordinator repairs it.
  try { return await fetch(request, { signal: AbortSignal.timeout(NAVIGATION_TIMEOUT_MS) }); }
  catch { return new Response(OFFLINE_PAGE, { status: 503, headers: { 'content-type': 'text/html' } }); }
}

// Other pages in the app (usage statistics, the history reader) are not stored ahead;
// offline, a page that was never opened says so and leads back to the game instead of
// leaving the installed app on a browser error.
async function otherPage(request) {
  let response = null;
  try {
    response = await fetch(request);
  } catch {
    // Offline: below.
  }
  if (response?.ok) {
    keep(RUNTIME, request, response);
    return response;
  }
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  return response || new Response(OFFLINE_PAGE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

const OFFLINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#08090a">
<title>Offline · TURN</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
    box-sizing: border-box; background: #fff8e8; color: #08090a; font: 17px/1.4 system-ui, -apple-system, sans-serif; }
  main { max-width: 26rem; padding: 24px; border: 3px solid #08090a; border-radius: 20px; background: #fffcf2; box-shadow: 8px 8px 0 #08090a; }
  h1 { margin: 0 0 8px; font-size: 1.75rem; font-weight: 900; text-transform: uppercase; }
  p { margin: 0 0 20px; }
  a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border: 3px solid #08090a; border-radius: 12px;
    background: #ea5da1; box-shadow: 4px 4px 0 #08090a; color: #08090a; font-weight: 900; letter-spacing: 0.04em; text-decoration: none; }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>This page needs a connection. TURN itself works offline: your tracks, cars and records are on this device.</p>
  <a href="${SCOPE}">BACK TO TURN</a>
</main>
</body>
</html>`;

async function pinned(request) {
  const cache = await caches.open(EXTERNAL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.status === 200) cache.put(request, response.clone()).catch(() => {});
  return response;
}
