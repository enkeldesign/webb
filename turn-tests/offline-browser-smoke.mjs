import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Offline play (#1030): after one online launch, TURN in airplane mode starts, shows
// ROADBOOK and GARAGE with their car pictures and races, with three.js served from
// TURN's own origin. The first download shows its progress and then that TURN is
// ready to play offline. A server answering with errors falls back to the stored copies.
// A new release's worker takes over quietly and asks to restart, and one that could
// not store every file leaves the previous release in charge.
// Chromium only: Playwright drives service workers and offline mode there.
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary'
};
// The test can publish a "next release" of the worker: same code, another name. It can
// make the server answer with errors, for everything or for one file. And it can take
// the server away entirely: offline mode in the browser alone does not reach a service
// worker's own requests, so airplane mode here also means no server at all.
let nextRelease = null;
let currentRelease = null;
// Small modules without side effects, each marked with the release that served it.
// The update check loads two the page has not loaded yet.
const PROBES = [
  '/turn/garage/garage-selection.js', '/turn/race/replay-codec.js', '/turn/achievements/filter-state.js',
  '/turn/audio/music/drum-kits.js', '/turn/audio/music/arp-voices.js', '/turn/audio/music/lead-voices.js',
  '/turn/audio/music/bass-voices.js', '/turn/assets/cars/supercar-data-1.js', '/turn/assets/cars/supercar-data-2.js'
];
let serverDown = false;
let serverError = false;
let failingPath = null;
let failOnce = null;
let slowPath = null;
const server = http.createServer(async (request, response) => {
  if (serverDown) {
    request.socket.destroy();
    return;
  }
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === slowPath) await new Promise((resolve) => globalThis.setTimeout(resolve, 12000));
    if (serverError || pathname === failingPath || pathname === failOnce) {
      if (pathname === failOnce) failOnce = null;
      response.writeHead(500);
      response.end();
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    let body = await fs.readFile(filename);
    if (nextRelease && pathname === '/turn/offline-precache.json') {
      const list = JSON.parse(body.toString());
      list.release = nextRelease;
      body = Buffer.from(JSON.stringify(list));
    }
    if (nextRelease && pathname === '/turn/sw.js') {
      body = Buffer.from(body.toString('utf8').replace(/const RELEASE = '[^']+';/, `const RELEASE = '${nextRelease}';`));
    }
    // The next release's entry page and modules differ from this one's. A real release
    // carries its key in every file that names one (entry page, worker, modules and
    // stylesheets), so the simulated next release does too: a file left naming the
    // current key would ask a fresh install for a release it does not have.
    if (nextRelease && /\.(?:html|m?js|css|json|webmanifest)$/.test(pathname)) {
      body = Buffer.from(body.toString('utf8').replaceAll(currentRelease, nextRelease));
    }
    if (PROBES.includes(pathname)) {
      body = Buffer.concat([body, Buffer.from(
        `\nglobalThis.__turnProbe = { ...globalThis.__turnProbe, '${pathname}': '${nextRelease ? 'next' : 'current'}' };\n`)]);
    }
    response.writeHead(200, { 'content-type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
    response.end(body);
  } catch (_) {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const precache = JSON.parse(await fs.readFile(new URL('../turn/offline-precache.json', import.meta.url), 'utf8'));
currentRelease = precache.release;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  const cdnThree = [];
  context.on('request', (request) => {
    if (/cdn\.jsdelivr\.net\/npm\/three@/.test(request.url())) cdnThree.push(request.url());
  });
  await context.addInitScript(() => {
    const settings = {
      'turn-offline-under-test': '1',
      'turn-low-graphics-v1': '1',
      'turn-steering-mode-v1': 'manual',
      'turn-audio-enabled-v1': 'off',
      'turn-racing-music-volume-v1': '0'
    };
    for (const [key, value] of Object.entries(settings)) {
      globalThis.Storage.prototype.setItem.call(localStorage, key, value);
    }
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 120000 }).catch(async (error) => {
    console.error(await page.evaluate(() => ({ copy: document.querySelector('.install-copy')?.textContent, url: globalThis.location.href, release: globalThis.__TURN_BUILD__, progress: document.querySelector('progress')?.value })), errors);
    throw error;
  });

  // Fresh installation is identified from storage/controller state, before Home.
  const started = Date.now();
  await page.goto(`${origin}/turn/`, { waitUntil: 'commit' });
  await page.waitForSelector('[data-startup-state="install"]');
  assert.equal(await page.locator('html.turn-home-ready').count(), 0);
  await ready();
  console.log(`Fresh installation and Home: ${Date.now() - started} ms`);
  assert.equal(await page.locator('.turn-offline-progress, .turn-update-toast').count(), 0,
    'No second preparation surface after Home');
  const offlineStatus = (target = page) => target.evaluate(async () => {
    const offline = globalThis.__turnOffline;
    if (!offline || !globalThis.navigator.serviceWorker.controller) return null;
    return offline.status();
  });
  const installed = async (target) => {
    for (const started = Date.now(); Date.now() - started < 120000;) {
      const value = await offlineStatus(target);
      if (value) return value;
      await target.waitForTimeout(500);
    }
    return null;
  };
  const status = await installed(page);
  assert.ok(status, 'The offline worker installs and reports its release');
  assert.equal(status.release, precache.release, 'The worker stores the current release');
  assert.equal(status.files, precache.files.length, 'The worker stores every listed file');
  assert.equal(status.failed, 0, 'No listed file failed to store');
  assert.deepEqual(cdnThree, [], 'Three.js comes from TURN\'s own origin, not the CDN');

  // The prior worker persisted a newer network document in an older runtime store.
  // Even with that poisoned entry surviving, navigation must select the complete release.
  await page.evaluate(async (release) => {
    const cache = await globalThis.caches.open(`turn-runtime-${release}`);
    await cache.put('/turn/index.html', new globalThis.Response('<script>throw new Error("poisoned runtime document")</script>', {
      headers: { 'content-type': 'text/html' }
    }));
  }, currentRelease);
  // Online, but the server answers every request with an error: TURN still starts, in
  // one document load. The stored release includes every module TURN's game imports,
  // the YOUR TURN sharing modules too (#1117): one only the server had failed startup
  // and sent TURN through recovery into a terminal failure.
  serverError = true;
  let loads = 0;
  const countLoad = () => { loads += 1; };
  page.on('load', countLoad);
  await page.reload();
  await ready();
  page.off('load', countLoad);
  assert.equal(await page.locator('.roadbook-card').count() > 0, true, 'With server errors, TURN starts from its stored copies');
  assert.equal(loads, 1, 'With a complete stored release, a server error is not a startup failure: no recovery restart');
  assert.equal(await page.evaluate(async () => typeof (await import('/yourturn/protocol-social.js?revision=r1')).makeChallengeUrl), 'function',
    'TURN\'s YOUR TURN sharing modules come from the stored release');
  serverError = false;

  // Airplane mode: TURN starts, ROADBOOK and GARAGE show, a race starts.
  await context.setOffline(true);
  serverDown = true;
  await page.reload();
  await ready();
  assert.equal(await page.locator('.roadbook-card').count() > 0, true, 'Offline, ROADBOOK lists the tracks');
  await page.locator('.m8-track-continue').click();
  await page.waitForSelector('.garage');
  await page.waitForTimeout(800);
  await page.locator('.garage-all-cars-button').click().catch(() => {});
  const stills = await page.evaluate(async () => {
    const images = [...document.querySelectorAll('.garage-car-still')].filter((image) => image.getClientRects().length).slice(0, 4);
    await Promise.all(images.map((image) => (image.complete ? null : new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }))));
    return images.map((image) => image.naturalWidth > 0);
  });
  assert.ok(stills.length > 0 && stills.every(Boolean), `Offline, ALL CARS shows the car pictures (${stills})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.garage-race').click();
  await page.waitForSelector('#controls:not([hidden])', { timeout: 60000 });
  assert.equal(await page.evaluate(() => document.body.classList.contains('turn-race-active')), true, 'Offline, a race starts');

  // A page in the app that was never opened says it needs a connection and leads back.
  const other = await context.newPage();
  await other.goto(`${origin}/turn/stats/`);
  assert.equal((await other.locator('h1').textContent()).trim(), "You're offline");
  assert.equal(await other.locator('a').getAttribute('href'), '/turn/', 'The offline page leads back to TURN');
  await other.close();

  // Back online, a new release's worker takes over and asks to restart, after the race.
  await context.setOffline(false);
  serverDown = false;
  await page.locator('.back-to-lot-button').click();
  await ready();
  nextRelease = precache.release.replace(/r(\d+)$/, (_, revision) => `r${Number(revision) + 1}`);
  const updateOutcome = () => page.evaluate(async () => {
    const registration = await globalThis.navigator.serviceWorker.getRegistration('/turn/');
    await registration.update();
    const worker = registration.installing || registration.waiting;
    if (!worker) return 'no new worker';
    if (worker.state === 'redundant' || worker.state === 'activated') return worker.state;
    return new Promise((resolve) => worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant' || worker.state === 'activated') resolve(worker.state);
    }));
  });

  // A new release that cannot store one of its files does not take over.
  failingPath = precache.files.find((file) => file.endsWith('.glb'));
  assert.equal(await updateOutcome(), 'redundant', 'An incomplete release is not installed');
  assert.equal((await offlineStatus()).release, precache.release, 'The previous release stays in charge');
  assert.equal(await page.locator('.turn-update-toast').count(), 0, 'No update toast for an incomplete release');
  failingPath = null;

  // Complete, it takes over silently. The open game keeps its release until next launch.
  assert.equal(await updateOutcome(), 'activated', 'A complete release is installed');
  assert.equal(await page.locator('.turn-offline-progress').count(), 0, 'An update downloads quietly');
  assert.equal(await page.locator('.turn-update-toast').count(), 0, 'Routine updates offer no player choice');

  // Until then the open page keeps its own release: a module it loads now is its own
  // build, online and offline, though the server and the new worker have the next one.
  const probe = (file, release) => page.evaluate(async ([path, key]) => {
    await import(`${path}?build=${key}`);
    return globalThis.__turnProbe?.[path];
  }, [file, release]);
  const unloaded = await page.evaluate((paths) => {
    const loaded = new Set(globalThis.performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname));
    return paths.filter((path) => !loaded.has(path) && !globalThis.__turnProbe?.[path]);
  }, PROBES);
  assert.ok(unloaded.length >= 2, `Two probe modules are not loaded yet (${unloaded})`);
  assert.equal(await probe(unloaded[0], currentRelease), 'current', 'Online, the open page loads its own release\'s module');
  await context.setOffline(true);
  serverDown = true;
  assert.equal(await probe(unloaded[1], currentRelease), 'current', 'Offline, the open page loads its own release\'s module');
  await context.setOffline(false);
  serverDown = false;

  await page.reload();
  await ready();
  const after = await offlineStatus();
  assert.equal(after.release, nextRelease, 'After RESTART the new release is in charge');
  assert.equal(await probe(unloaded[0], nextRelease), 'next', 'After RESTART the page loads the new release\'s modules');
  assert.equal(await page.evaluate((release) => globalThis.caches.has(`turn-precache-${release}`), currentRelease), true,
    'Keep the previous complete release for recovery');
  const warmStart = Date.now();
  await page.reload();
  await ready();
  console.log(`Warm startup: ${Date.now() - warmStart} ms`);
  await page.evaluate(async (release) => {
    const cache = await globalThis.caches.open(`turn-precache-${release}`);
    await cache.delete('/turn/platform/web-platform.js');
  }, nextRelease);
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(async (release) => Boolean(await (await globalThis.caches.open(`turn-precache-${release}`)).match('/turn/platform/web-platform.js')), nextRelease), true,
    'Partial eviction is repaired before bootstrapping the game');
  // Terminate the document, then relaunch with the same worker and storage.
  const relaunched = await context.newPage();
  await relaunched.goto(`${origin}/turn/`);
  await relaunched.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'));
  assert.equal(await relaunched.evaluate(() => globalThis.__TURN_BUILD__.cacheKey), nextRelease);
  await relaunched.close();

  // TURN NEXT is retired: its address leads to TURN.
  const next = await context.newPage();
  await next.goto(`${origin}/turn-next/`);
  await next.waitForURL(`${origin}/turn/`);
  await next.close();
  assert.deepEqual(errors, [], 'no page errors');

  // Bounded automatic recovery precedes a meaningful action; blocked
  // website data still starts TURN (kept for this visit only).
  serverDown = false;
  const startup = async ({ denyStorage = false } = {}) => {
    const fresh = await browser.newContext({ viewport: { width: 852, height: 393 }, serviceWorkers: 'block' });
    await fresh.addInitScript((deny) => {
      Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
      if (deny) {
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          get() { throw new globalThis.DOMException('The operation is insecure.', 'SecurityError'); }
        });
      } else {
        globalThis.localStorage.setItem('turn-low-graphics-v1', '1');
      }
    }, denyStorage);
    const freshPage = await fresh.newPage();
    freshPage.setDefaultTimeout(30000);
    return { fresh, freshPage };
  };
  {
    const { fresh, freshPage } = await startup();
    // A file loaded before the race world starts, so no 3D competes with the check.
    failingPath = '/turn/ui/lap-result-toast.js';
    await freshPage.goto(`${origin}/turn/`);
    await freshPage.waitForFunction(() => Boolean(document.querySelector('.turn-startup-reload')), null, { timeout: 30000 });
    assert.match(await freshPage.locator('.install-copy').textContent(), /could not start/, 'A failed start says so after automatic recovery');
    assert.equal(new URL(freshPage.url()).searchParams.get('turn-recovery'), '2', 'Automatic retries are bounded');
    await freshPage.reload();
    await freshPage.waitForSelector('.turn-startup-reload');
    assert.equal(new URL(freshPage.url()).searchParams.get('turn-recovery'), '2', 'Reload cannot restart the retry loop');
    failingPath = null;
    await Promise.all([freshPage.waitForEvent('load'), freshPage.locator('.turn-startup-reload').click()]);
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    assert.equal(await freshPage.locator('.turn-startup-reload').count(), 0, 'RELOAD starts TURN once the file loads');
    await fresh.close();
  }
  {
    // The main script itself cannot load: the page still offers RELOAD.
    const { fresh, freshPage } = await startup();
    failingPath = '/turn/app.js';
    await freshPage.goto(`${origin}/turn/`);
    await freshPage.waitForFunction(() => Boolean(document.querySelector('#installGate .turn-startup-reload')), null, { timeout: 30000 });
    failingPath = null;
    await Promise.all([freshPage.waitForEvent('load'), freshPage.locator('.turn-startup-reload').click()]);
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    await fresh.close();
  }
  {
    const { fresh, freshPage } = await startup({ denyStorage: true });
    await freshPage.goto(`${origin}/turn/`);
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    assert.equal(await freshPage.evaluate(() => document.documentElement.dataset.turnStorage), 'memory',
      'With website data blocked, TURN starts and keeps progress for this visit');
    await fresh.close();
  }
  {
    const { fresh, freshPage } = await startup();
    failOnce = '/turn/ui/lap-result-toast.js';
    await freshPage.goto(`${origin}/turn/`);
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    assert.equal(await freshPage.locator('.turn-startup-reload').count(), 0, 'Transient failure recovers without a button');
    await fresh.close();
  }
  {
    const { fresh, freshPage } = await startup();
    slowPath = '/turn/app.js';
    await freshPage.goto(`${origin}/turn/`, { waitUntil: 'commit' });
    await freshPage.waitForSelector('[data-startup-state="slow"]');
    assert.match(await freshPage.locator('.install-copy').textContent(), /TAKING A LITTLE LONGER/);
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
    assert.equal(await freshPage.locator('.turn-startup-reload').count(), 0, 'Slow successful startup is not a failure');
    slowPath = null;
    await fresh.close();
  }
  {
    const fresh = await browser.newContext({ viewport: { width: 852, height: 393 } });
    await fresh.addInitScript(() => {
      Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
      localStorage.setItem('turn-offline-under-test', '1');
      localStorage.setItem('turn-player-preservation-probe', 'keep me');
    });
    const freshPage = await fresh.newPage();
    failingPath = precache.files.find((file) => file.endsWith('.glb'));
    await freshPage.goto(`${origin}/turn/`);
    await freshPage.waitForSelector('.turn-startup-reload', { timeout: 120000 });
    assert.equal(await freshPage.locator('html.turn-home-ready').count(), 0, 'Incomplete first preparation does not promise playability');
    assert.equal(await freshPage.evaluate(() => localStorage.getItem('turn-player-preservation-probe')), 'keep me');
    failingPath = null;
    await freshPage.locator('.turn-startup-reload').click();
    await freshPage.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 120000 });
    assert.equal(await freshPage.locator('.turn-offline-progress').count(), 0);
    await fresh.close();
  }
  console.log(`Offline: ${status.files} files; fresh/warm/offline/slow starts, release isolation, retained rollback, silent update, relaunch, automatic recovery, persistent failure and interrupted preparation passed.`);
} finally {
  await browser.close();
  server.close();
}
