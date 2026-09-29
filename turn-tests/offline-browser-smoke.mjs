import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Offline play (#1030): after one online launch, TURN in airplane mode starts, shows
// ROADBOOK and GARAGE with their car pictures and races, with three.js served from
// TURN's own origin. A server answering with errors falls back to the stored copies.
// A new release's worker takes over quietly and asks to restart, and one that could
// not store every file leaves the previous release in charge. TURN NEXT, too.
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
let serverDown = false;
let serverError = false;
let failingPath = null;
const server = http.createServer(async (request, response) => {
  if (serverDown) {
    request.socket.destroy();
    return;
  }
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (serverError || pathname === failingPath) {
      response.writeHead(500);
      response.end();
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root)) throw new Error('Outside fixture root');
    let body = await fs.readFile(filename);
    if (nextRelease && pathname === '/turn/sw.js') {
      body = Buffer.from(body.toString('utf8').replace(/const RELEASE = '[^']+';/, `const RELEASE = '${nextRelease}';`));
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

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => {
    if (error.message.includes('different audio context') && error.stack.includes('organic-ribbon')) return;
    errors.push(error.message);
  });
  const cdnThree = [];
  context.on('request', (request) => {
    if (/cdn\.jsdelivr\.net\/npm\/three@/.test(request.url())) cdnThree.push(request.url());
  });
  // For TURN and for TURN NEXT, whose storage reads its keys under "turn-next:".
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
      globalThis.Storage.prototype.setItem.call(localStorage, `turn-next:${key}`, value);
    }
    Object.defineProperty(globalThis.navigator, 'standalone', { configurable: true, value: true });
  });
  const ready = () => page.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });

  // Online: the worker installs and stores the whole release.
  await page.goto(`${origin}/turn/`);
  await ready();
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

  // Online, but the server answers every request with an error: TURN still starts.
  serverError = true;
  await page.reload();
  await ready();
  assert.equal(await page.locator('.roadbook-card').count() > 0, true, 'With server errors, TURN starts from its stored copies');
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
  nextRelease = `${precache.release}-next`;
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

  // Complete, it takes over and asks to restart.
  assert.equal(await updateOutcome(), 'activated', 'A complete release is installed');
  await page.waitForSelector('.turn-update-toast', { timeout: 120000 });
  assert.equal((await page.locator('.turn-update-toast-text').textContent()).trim(), 'New TURN version ready');
  await Promise.all([page.waitForEvent('load'), page.locator('.turn-update-toast-restart').click()]);
  await ready();
  const after = await offlineStatus();
  assert.equal(after.release, nextRelease, 'After RESTART the new release is in charge');

  // TURN NEXT stores its own list (its page resolves against <base href="/turn/">) and starts offline.
  const next = await context.newPage();
  next.setDefaultTimeout(30000);
  next.on('pageerror', (error) => errors.push(`TURN NEXT: ${error.message}`));
  await next.goto(`${origin}/turn-next/`);
  await next.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  const nextStatus = await installed(next);
  const nextList = JSON.parse(await fs.readFile(new URL('../turn-next/offline-precache.json', import.meta.url), 'utf8'));
  assert.equal(nextStatus?.files, nextList.files.length, 'TURN NEXT stores every listed file');
  await context.setOffline(true);
  serverDown = true;
  await next.reload();
  await next.waitForFunction(() => document.documentElement.classList.contains('turn-home-ready'), null, { timeout: 60000 });
  assert.equal(await next.locator('.roadbook-card').count() > 0, true, 'Offline, TURN NEXT lists the tracks');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`Offline: ${status.files} files stored; airplane-mode ROADBOOK, GARAGE and race; server errors; incomplete and complete updates; TURN NEXT (${nextStatus.files} files) passed.`);
} finally {
  await browser.close();
  server.close();
}
